import type { POI, Coordinates } from "@/lib/types";

interface PortraitContextMapProps {
  pois: POI[];
  center: Coordinates;
}

/**
 * Static Mapbox map showing chapter POI locations.
 * Uses the Static Images API for lightweight, non-interactive rendering.
 */
export default function PortraitContextMap({
  pois,
  center,
}: PortraitContextMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || pois.length === 0) return null;

  // Build marker pins from POIs
  const markers = pois
    .map((poi) => {
      const color = poi.category.color.replace("#", "");
      return `pin-s+${color}(${poi.coordinates.lng},${poi.coordinates.lat})`;
    })
    .join(",");

  // Calculate bounding box to fit all POIs
  const lngs = pois.map((p) => p.coordinates.lng);
  const lats = pois.map((p) => p.coordinates.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // Add padding to bounds
  const lngPad = Math.max((maxLng - minLng) * 0.3, 0.003);
  const latPad = Math.max((maxLat - minLat) * 0.3, 0.002);

  const bbox = `[${minLng - lngPad},${minLat - latPad},${maxLng + lngPad},${maxLat + latPad}]`;

  // Static map URL with auto-fit bounds
  const url = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${markers}/auto/800x400@2x?padding=40&access_token=${token}`;

  const altText = `Kart som viser ${pois.length} steder: ${pois
    .slice(0, 3)
    .map((p) => p.name)
    .join(", ")}${pois.length > 3 ? ` og ${pois.length - 3} til` : ""}`;

  return (
    <div className="my-14 md:my-20">
      <img
        src={url}
        alt={altText}
        loading="lazy"
        className="w-full rounded-lg shadow-sm"
        style={{ aspectRatio: "2/1" }}
      />
    </div>
  );
}
