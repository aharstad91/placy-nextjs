import type { Map as MapboxMap } from "mapbox-gl";

/** Default interactive map style (streets with labels) */
export const MAP_STYLE_DEFAULT = "mapbox://styles/mapbox/streets-v12";

/** Light style for admin previews and static maps */
export const MAP_STYLE_LIGHT = "mapbox://styles/mapbox/light-v11";

/**
 * Mapbox Standard style — used for illustrated, warm-toned maps.
 * Requires post-load configuration via `applyIllustratedTheme()`.
 */
export const MAP_STYLE_STANDARD = "mapbox://styles/mapbox/standard";

/**
 * Hide Mapbox's default POI, place, and transit labels.
 * Keeps only our custom markers visible.
 *
 * Call this in the map's onLoad handler.
 */
export function hideDefaultPOILabels(map: MapboxMap): void {
  const layers = map.getStyle()?.layers || [];
  for (const layer of layers) {
    if (
      layer.id.includes("poi") ||
      layer.id.includes("place-label") ||
      layer.id.includes("transit")
    ) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
}

/**
 * Apply a warm, illustrated look to the Mapbox Standard style.
 *
 * Uses the "faded" theme with dawn lighting and warm color overrides
 * for a softer, nature-friendly aesthetic.
 *
 * Call in the map's `style.load` event (fires after `onLoad`).
 */
export function applyIllustratedTheme(map: MapboxMap): void {
  try {
    // Faded theme gives a softer, muted base
    map.setConfigProperty("basemap", "theme", "faded");
    // Dawn lighting adds warmth
    map.setConfigProperty("basemap", "lightPreset", "dawn");
    // Warm earth-tone land color
    map.setConfigProperty("basemap", "colorLand", "hsl(40, 40%, 92%)");
    // Lush green spaces
    map.setConfigProperty("basemap", "colorGreenspace", "hsl(130, 35%, 78%)");
    // Soft blue water
    map.setConfigProperty("basemap", "colorWater", "hsl(205, 45%, 82%)");
    // Subtle road colors
    map.setConfigProperty("basemap", "colorRoads", "hsl(35, 20%, 88%)");
    map.setConfigProperty("basemap", "colorMotorways", "hsl(35, 25%, 82%)");
    map.setConfigProperty("basemap", "colorTrunks", "hsl(35, 22%, 85%)");
    // Hide default POI labels — we use our own AdaptiveMarkers
    map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
    map.setConfigProperty("basemap", "showTransitLabels", false);
  } catch {
    // Graceful fallback — Standard style config not available
    // This can happen if the style hasn't fully loaded yet
    console.warn("Could not apply illustrated theme — style config not ready");
  }
}
