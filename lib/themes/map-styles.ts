import type { Map as MapboxMap } from "mapbox-gl";

/** Default interactive map style (streets with labels) */
export const MAP_STYLE_DEFAULT = "mapbox://styles/mapbox/streets-v12";

/** Light style for admin previews and static maps */
export const MAP_STYLE_LIGHT = "mapbox://styles/mapbox/light-v11";

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
