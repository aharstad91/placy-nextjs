import type { Coordinates, CameraConstraints, DEFAULT_CAMERA_CONSTRAINTS } from "./types";

/**
 * Calculate bounds from an array of coordinates with optional buffer
 * Buffer ensures POIs at edges have comfortable margin
 *
 * @param coordinates Array of lat/lng coordinates
 * @param bufferRatio Ratio of diagonal to add as buffer (default 0.2 = 20%)
 * @param minBufferMeters Minimum buffer in meters (default 200)
 * @returns Bounds object with north/south/east/west
 */
export function calculateBoundsWithBuffer(
  coordinates: Coordinates[],
  bufferRatio: number = 0.2,
  minBufferMeters: number = 200
): CameraConstraints["bounds"] | undefined {
  if (coordinates.length === 0) {
    return undefined;
  }

  // Handle single coordinate - create minimum bounds
  if (coordinates.length === 1) {
    const coord = coordinates[0];
    // ~0.0045 degrees ≈ 500m at equator
    const minSpan = 0.0045;
    return {
      north: coord.lat + minSpan,
      south: coord.lat - minSpan,
      east: coord.lng + minSpan,
      west: coord.lng - minSpan,
    };
  }

  // Calculate min/max
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const coord of coordinates) {
    if (coord.lat < minLat) minLat = coord.lat;
    if (coord.lat > maxLat) maxLat = coord.lat;
    if (coord.lng < minLng) minLng = coord.lng;
    if (coord.lng > maxLng) maxLng = coord.lng;
  }

  // Calculate diagonal distance in meters (approximate)
  // 1 degree lat ≈ 111km, 1 degree lng ≈ 111km * cos(lat)
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const avgLat = (minLat + maxLat) / 2;

  const latMeters = latSpan * 111000;
  const lngMeters = lngSpan * 111000 * Math.cos(avgLat * Math.PI / 180);
  const diagonalMeters = Math.sqrt(latMeters ** 2 + lngMeters ** 2);

  // Calculate buffer: either percentage of diagonal or minimum, whichever is larger
  const bufferMeters = Math.max(diagonalMeters * bufferRatio, minBufferMeters);

  // Convert buffer back to degrees
  const latBuffer = bufferMeters / 111000;
  const lngBuffer = bufferMeters / (111000 * Math.cos(avgLat * Math.PI / 180));

  return {
    north: maxLat + latBuffer,
    south: minLat - latBuffer,
    east: maxLng + lngBuffer,
    west: minLng - lngBuffer,
  };
}

/**
 * Clamp a value between min and max
 */
export function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Check if a coordinate is within bounds
 */
export function isWithinBounds(
  coord: Coordinates,
  bounds: NonNullable<CameraConstraints["bounds"]>
): boolean {
  return (
    coord.lat >= bounds.south &&
    coord.lat <= bounds.north &&
    coord.lng >= bounds.west &&
    coord.lng <= bounds.east
  );
}

/**
 * Calculate center of bounds
 */
export function getBoundsCenter(
  bounds: NonNullable<CameraConstraints["bounds"]>
): Coordinates {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
export function getDistanceMeters(a: Coordinates, b: Coordinates): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const aVal = sinDLat * sinDLat +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));

  return R * c;
}

/**
 * Calculate bearing from point A to point B in degrees (0-360, north = 0)
 */
export function getBearing(from: Coordinates, to: Coordinates): number {
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}
