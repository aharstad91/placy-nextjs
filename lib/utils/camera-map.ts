/**
 * Camera mapping between Mapbox GL JS zoom levels and Google Maps 3D range.
 *
 * Mapbox uses zoom levels (1-22), Google 3D uses `range` (meters from camera
 * to center point — NOT ground footprint). The conversion is derived from
 * Web Mercator projection + Google 3D perspective camera geometry.
 *
 * Key formula:
 *   metersPerPixel(zoom, lat) = C * cos(lat) / 2^(zoom + 9)
 *   range = (W * metersPerPixel * cos(tilt)) / (2 * tan(fov_h / 2))
 *
 * where fov_h = 2 * atan(aspect * tan(fov_v / 2)), fov_v defaults to 35deg.
 */

/** Earth circumference at equator in meters (WGS-84) */
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

/** Google Maps 3D default vertical field-of-view in degrees */
const DEFAULT_FOV_V_DEG = 35;

/** Mapbox GL JS uses 512px tiles, so tile offset = log2(512) = 9 */
const TILE_PIXEL_OFFSET = 9;

/**
 * Convert a Mapbox zoom level to a Google Maps 3D camera range (meters).
 *
 * @param zoom - Mapbox GL JS zoom level (typically 1-22)
 * @param latDeg - Latitude in degrees (affects Mercator scale)
 * @param tiltDeg - Camera tilt from nadir in degrees (0 = looking straight down)
 * @param viewportWidth - Viewport width in CSS pixels
 * @param viewportHeight - Viewport height in CSS pixels
 * @param fovVDeg - Vertical field-of-view in degrees (default 35)
 * @returns Camera range in meters
 *
 * @example
 * // Trondheim at zoom 15, 45deg tilt, 672x504 viewport
 * zoomToRange(15, 63.4, 45, 672, 504) // ~604m
 */
export function zoomToRange(
  zoom: number,
  latDeg: number,
  tiltDeg: number,
  viewportWidth: number,
  viewportHeight: number,
  fovVDeg: number = DEFAULT_FOV_V_DEG,
): number {
  const latRad = (latDeg * Math.PI) / 180;
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const fovVRad = (fovVDeg * Math.PI) / 180;
  const aspect = viewportWidth / viewportHeight;
  const fovHRad = 2 * Math.atan(aspect * Math.tan(fovVRad / 2));

  const metersPerPixel =
    (EARTH_CIRCUMFERENCE_M * Math.cos(latRad)) /
    Math.pow(2, zoom + TILE_PIXEL_OFFSET);
  const groundWidth = viewportWidth * metersPerPixel;
  return (groundWidth * Math.cos(tiltRad)) / (2 * Math.tan(fovHRad / 2));
}

/**
 * Convert a Google Maps 3D camera range back to a Mapbox zoom level.
 *
 * This is the inverse of {@link zoomToRange}. The returned zoom may be
 * fractional (e.g. 14.73).
 *
 * @param range - Camera range in meters
 * @param latDeg - Latitude in degrees
 * @param tiltDeg - Camera tilt from nadir in degrees
 * @param viewportWidth - Viewport width in CSS pixels
 * @param viewportHeight - Viewport height in CSS pixels
 * @param fovVDeg - Vertical field-of-view in degrees (default 35)
 * @returns Mapbox zoom level (fractional)
 *
 * @example
 * // Roundtrip: zoom -> range -> zoom
 * const range = zoomToRange(15, 63.4, 45, 672, 504);
 * rangeToZoom(range, 63.4, 45, 672, 504) // ~15.0
 */
export function rangeToZoom(
  range: number,
  latDeg: number,
  tiltDeg: number,
  viewportWidth: number,
  viewportHeight: number,
  fovVDeg: number = DEFAULT_FOV_V_DEG,
): number {
  const latRad = (latDeg * Math.PI) / 180;
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const fovVRad = (fovVDeg * Math.PI) / 180;
  const aspect = viewportWidth / viewportHeight;
  const fovHRad = 2 * Math.atan(aspect * Math.tan(fovVRad / 2));

  const groundWidth = (range * 2 * Math.tan(fovHRad / 2)) / Math.cos(tiltRad);
  const metersPerPixel = groundWidth / viewportWidth;
  return Math.log2(
    (EARTH_CIRCUMFERENCE_M * Math.cos(latRad)) / (metersPerPixel * 512),
  );
}
