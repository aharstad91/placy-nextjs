/**
 * School Zone Lookup — Trondheim Kommune
 *
 * Determines which barneskole and ungdomsskole zone a given WGS84 coordinate
 * falls within, using official school zone polygons from Trondheim kommune's
 * GeoServer (kart.trondheim.kommune.no/geoserver/abas/wfs).
 *
 * Data is stored as GeoJSON in data/geo/trondheim/ (EPSG:25832, UTM 32N).
 * We convert WGS84 → UTM32N at query time and run point-in-polygon.
 */

import barneskolekretserRaw from "@/data/geo/trondheim/barneskolekrets.json";
import ungskolekretserRaw from "@/data/geo/trondheim/ungskolekrets.json";

// ---------- Types ----------

interface SchoolZoneResult {
  barneskole: string | null;
  ungdomsskole: string | null;
}

interface GeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  properties: Record<string, unknown>;
}

interface GeoJsonCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

// ---------- Coordinate Conversion ----------

/**
 * Convert WGS84 (lat/lng) to EPSG:25832 (UTM zone 32N).
 * Central meridian: 9°E. Accurate to ~1m for Norway.
 */
function wgs84ToUtm32(lat: number, lon: number): { easting: number; northing: number } {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const lon0 = 9.0; // UTM zone 32 central meridian

  const e2 = 2 * f - f * f;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const lon0Rad = (lon0 * Math.PI) / 180;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const T = tanLat * tanLat;
  const C = (e2 / (1 - e2)) * cosLat * cosLat;
  const A = (lonRad - lon0Rad) * cosLat;

  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * latRad -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) * Math.sin(2 * latRad) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) * Math.sin(4 * latRad) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * latRad));

  const ep2 = e2 / (1 - e2);

  const easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A * A * A * A * A) / 120) +
    500000;

  const northing =
    k0 *
    (M +
      N *
        tanLat *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A * A * A * A * A * A) / 720));

  return { easting, northing };
}

// ---------- Point-in-Polygon ----------

/**
 * Ray-casting point-in-polygon test.
 * Polygon is an array of [x, y] coordinate pairs (closed ring).
 */
function pointInPolygon(x: number, y: number, polygon: number[][]): boolean {
  let inside = false;
  const n = polygon.length;
  let j = n - 1;

  for (let i = 0; i < n; i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    j = i;
  }

  return inside;
}

/**
 * Check if a point falls within any ring of a geometry (Polygon or MultiPolygon).
 */
function pointInGeometry(
  x: number,
  y: number,
  geometry: GeoJsonFeature["geometry"]
): boolean {
  if (geometry.type === "Polygon") {
    // First ring is the exterior boundary
    return pointInPolygon(x, y, geometry.coordinates[0] as number[][]);
  }
  if (geometry.type === "MultiPolygon") {
    // Check each polygon in the multi-polygon
    return (geometry.coordinates as number[][][][]).some((polygon) =>
      pointInPolygon(x, y, polygon[0])
    );
  }
  return false;
}

// ---------- Public API ----------

/**
 * Look up which barneskole and ungdomsskole zone a WGS84 coordinate belongs to.
 *
 * @param lat - Latitude in WGS84 (e.g. 63.418)
 * @param lng - Longitude in WGS84 (e.g. 10.395)
 * @returns School names, or null if the point is outside Trondheim's school zones
 *
 * @example
 * ```ts
 * const zone = getSchoolZone(63.418, 10.395);
 * // { barneskole: "SINGSAKER", ungdomsskole: "ROSENBORG" }
 * ```
 */
export function getSchoolZone(lat: number, lng: number): SchoolZoneResult {
  const { easting, northing } = wgs84ToUtm32(lat, lng);

  const barneData = barneskolekretserRaw as unknown as GeoJsonCollection;
  const ungData = ungskolekretserRaw as unknown as GeoJsonCollection;

  let barneskole: string | null = null;
  let ungdomsskole: string | null = null;

  for (const feature of barneData.features) {
    if (pointInGeometry(easting, northing, feature.geometry)) {
      barneskole = feature.properties.barneskolenavn as string;
      break;
    }
  }

  for (const feature of ungData.features) {
    if (pointInGeometry(easting, northing, feature.geometry)) {
      ungdomsskole = feature.properties.ungskolenavn as string;
      break;
    }
  }

  return { barneskole, ungdomsskole };
}

/**
 * Get all available barneskolekrets names.
 */
export function getAllBarneskoler(): string[] {
  const data = barneskolekretserRaw as unknown as GeoJsonCollection;
  return data.features
    .map((f) => f.properties.barneskolenavn as string)
    .sort((a, b) => a.localeCompare(b, "nb"));
}

/**
 * Get all available ungdomsskolekrets names.
 */
export function getAllUngdomsskoler(): string[] {
  const data = ungskolekretserRaw as unknown as GeoJsonCollection;
  return data.features
    .map((f) => f.properties.ungskolenavn as string)
    .sort((a, b) => a.localeCompare(b, "nb"));
}
