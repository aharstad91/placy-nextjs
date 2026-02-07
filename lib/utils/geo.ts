/**
 * Geospatial Utilities
 *
 * Shared functions for distance calculations and bounding box operations.
 * Used by both poi-discovery.ts and queries.ts.
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
