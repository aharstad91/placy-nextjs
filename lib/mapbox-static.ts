/**
 * Mapbox Static Images API utility.
 * Generates static map image URLs for SEO pages (no JS required).
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface StaticMapOptions {
  lat: number;
  lng: number;
  zoom?: number;
  width?: number;
  height?: number;
  marker?: boolean;
  markerColor?: string;
  style?: string;
  retina?: boolean;
}

/**
 * Generate a Mapbox Static Images API URL.
 * Returns null if the Mapbox token is not configured.
 */
export function getStaticMapUrl({
  lat,
  lng,
  zoom = 15,
  width = 600,
  height = 400,
  marker = true,
  markerColor = "1a1a1a",
  style = "mapbox/light-v11",
  retina = true,
}: StaticMapOptions): string | null {
  if (!MAPBOX_TOKEN) return null;

  const retinaFlag = retina ? "@2x" : "";
  const markerOverlay = marker
    ? `pin-s+${markerColor}(${lng},${lat})/`
    : "";

  return `https://api.mapbox.com/styles/v1/${style}/static/${markerOverlay}${lng},${lat},${zoom},0/${width}x${height}${retinaFlag}?access_token=${MAPBOX_TOKEN}&attribution=false&logo=false`;
}

/**
 * Generate a static map URL with multiple markers.
 */
export function getStaticMapUrlMulti({
  markers,
  zoom,
  width = 600,
  height = 400,
  style = "mapbox/light-v11",
  retina = true,
}: {
  markers: Array<{ lat: number; lng: number; color?: string }>;
  zoom?: number;
  width?: number;
  height?: number;
  style?: string;
  retina?: boolean;
}): string | null {
  if (!MAPBOX_TOKEN || markers.length === 0) return null;

  const retinaFlag = retina ? "@2x" : "";

  const markerOverlay = markers
    .map((m) => `pin-s+${m.color ?? "1a1a1a"}(${m.lng},${m.lat})`)
    .join(",");

  // Auto-fit: use "auto" instead of center/zoom
  const position = zoom
    ? `${markers[0].lng},${markers[0].lat},${zoom},0`
    : "auto";

  return `https://api.mapbox.com/styles/v1/${style}/static/${markerOverlay}/${position}/${width}x${height}${retinaFlag}?access_token=${MAPBOX_TOKEN}&attribution=false&logo=false&padding=40`;
}
