/**
 * Geospatial Utilities
 *
 * Shared functions for distance calculations, bounding box operations,
 * and point-in-polygon tests.
 * Used by poi-discovery.ts, queries.ts, and school-zones.ts.
 */

/**
 * Convert degrees to radians
 */
export function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate distance between two points using Haversine formula.
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate bounding box for a center point and radius.
 * Returns approximate lat/lng bounds for database pre-filtering.
 *
 * Note: 1 degree latitude ≈ 111km everywhere.
 * 1 degree longitude varies by latitude (111km at equator, 0 at poles).
 */
export function calculateBoundingBox(
  center: { lat: number; lng: number },
  radiusMeters: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos(center.lat * Math.PI / 180));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/**
 * Validate coordinates are within valid ranges.
 * Latitude: -90 to 90
 * Longitude: -180 to 180
 */
export function isValidCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// ---------- Point-in-Polygon ----------

/**
 * GeoJSON Polygon or MultiPolygon geometry.
 * Coordinate pairs are [x, y] — for WGS84 GeoJSON that means [lng, lat].
 */
export interface GeoJsonPolygonGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

/**
 * Ray-casting point-in-polygon test.
 * Polygon is an array of [x, y] coordinate pairs (closed ring).
 *
 * Coordinate-system agnostic: point and ring must use the same planar system —
 * [lng, lat] for WGS84 GeoJSON (pass x = lng, y = lat), or projected
 * coordinates like UTM (pass x = easting, y = northing).
 *
 * Boundary semantics are half-open (classic ray-cast): points exactly on the
 * lower/left edges count as inside, points on the upper/right edges as outside.
 */
export function pointInPolygon(x: number, y: number, polygon: number[][]): boolean {
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
 *
 * Only exterior rings are tested — holes (interior rings) are ignored, so a
 * point inside a hole still counts as inside. This preserves the original
 * school-zones behavior.
 */
export function pointInGeometry(
  x: number,
  y: number,
  geometry: GeoJsonPolygonGeometry
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

/**
 * Generate polygon coordinates approximating a circle on a map.
 * Used for Mapbox Source/Layer visualization of discovery radius.
 *
 * @returns Array of [lng, lat] coordinate pairs forming a closed polygon
 */
export function createCircleCoordinates(
  lng: number,
  lat: number,
  radiusMeters: number,
  points: number = 64
): [number, number][] {
  const km = radiusMeters / 1000;
  const coords: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = km * Math.cos(angle);
    const dy = km * Math.sin(angle);

    const latOffset = dy / 111.32;
    const lngOffset = dx / (111.32 * Math.cos((lat * Math.PI) / 180));

    coords.push([lng + lngOffset, lat + latOffset]);
  }

  return coords;
}
