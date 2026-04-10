// Trail Fetcher — Overpass API integration for hiking/cycling routes
// Shared between API route and generate-story pipeline

import type { TrailFeatureProperties, TrailFeature, TrailCollection } from "@/lib/types";

// === Overpass Response Types ===

export interface OverpassGeometryPoint {
  lat: number;
  lon: number;
}

export interface OverpassMember {
  type: string;
  ref: number;
  role: string;
  geometry?: OverpassGeometryPoint[];
}

export interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  members?: OverpassMember[];
}

export interface OverpassResponse {
  elements: OverpassElement[];
}

// === Constants ===

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const FETCH_TIMEOUT_MS = 35_000;
const RATE_LIMIT_RETRY_DELAY_MS = 5_000;
const USER_AGENT = "Placy/1.0 (kontakt@placy.no)";

// === Query Builder ===

function buildOverpassQuery(
  lat: number,
  lng: number,
  radiusMeters: number,
  types: ("bicycle" | "hiking" | "foot")[]
): string {
  const routeStatements = types
    .map(
      (type) =>
        `  relation["route"="${type}"](around:${radiusMeters},${lat},${lng});`
    )
    .join("\n");

  return `[out:json][timeout:30];
(
${routeStatements}
);
out geom;`;
}

// === Fetch with timeout and retry ===

async function fetchOverpass(query: string): Promise<OverpassResponse> {
  const body = `data=${encodeURIComponent(query)}`;

  const doFetch = async (url: string): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Try each endpoint, with retry on 429
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      let response = await doFetch(url);

      // Retry once on 429 (rate limited)
      if (response.status === 429) {
        await new Promise((resolve) =>
          setTimeout(resolve, RATE_LIMIT_RETRY_DELAY_MS)
        );
        response = await doFetch(url);
      }

      if (response.ok) {
        return response.json() as Promise<OverpassResponse>;
      }

      // 504/503 → try next endpoint
      if (response.status >= 500) continue;

      throw new Error(
        `Overpass API error: ${response.status} ${response.statusText}`
      );
    } catch (error) {
      // Network error or abort → try next endpoint
      if (url === OVERPASS_ENDPOINTS[OVERPASS_ENDPOINTS.length - 1]) {
        throw error;
      }
    }
  }

  throw new Error("All Overpass endpoints failed");
}

// === Geometry Conversion ===

function toGeoJSONCoord(point: OverpassGeometryPoint): [number, number] {
  return [point.lon, point.lat];
}

function elementToFeature(
  element: OverpassElement
): TrailFeature | null {
  const tags = element.tags ?? {};

  // Skip relations without a name
  if (!tags.name) return null;

  // Collect all way geometries from members
  const wayGeometries: [number, number][][] = [];

  if (element.members) {
    for (const member of element.members) {
      if (member.type === "way" && member.geometry && member.geometry.length > 0) {
        wayGeometries.push(member.geometry.map(toGeoJSONCoord));
      }
    }
  }

  // Skip if no geometry found
  if (wayGeometries.length === 0) return null;

  // Build geometry: single way = LineString, multiple ways = MultiLineString
  const geometry: GeoJSON.LineString | GeoJSON.MultiLineString =
    wayGeometries.length === 1
      ? { type: "LineString", coordinates: wayGeometries[0] }
      : { type: "MultiLineString", coordinates: wayGeometries };

  const routeType = (tags.route as "bicycle" | "hiking" | "foot") ?? "hiking";

  const networkValue = tags.network as "lcn" | "rcn" | "ncn" | undefined;

  const properties: TrailFeatureProperties = {
    id: String(element.id),
    name: tags.name,
    routeType,
    network: networkValue ?? null,
  };

  return {
    type: "Feature",
    geometry,
    properties,
  };
}

// === Main Export ===

export async function fetchTrails(options: {
  lat: number;
  lng: number;
  radiusKm?: number;
  types?: ("bicycle" | "hiking" | "foot")[];
}): Promise<TrailCollection> {
  const {
    lat,
    lng,
    radiusKm = 3,
    types = ["bicycle", "hiking", "foot"],
  } = options;

  const radiusMeters = Math.round(radiusKm * 1000);
  const query = buildOverpassQuery(lat, lng, radiusMeters, types);
  const data = await fetchOverpass(query);

  // Dedup relations by ID
  const seenIds = new Set<number>();
  const features: TrailFeature[] = [];

  for (const element of data.elements) {
    if (seenIds.has(element.id)) continue;
    seenIds.add(element.id);

    const feature = elementToFeature(element);
    if (feature) {
      features.push(feature);
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
