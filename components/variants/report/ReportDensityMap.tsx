import type { POI, Coordinates } from "@/lib/types";

interface ReportDensityMapProps {
  pois: POI[];
  center: Coordinates;
}

export default function ReportDensityMap({
  pois,
  center,
}: ReportDensityMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || pois.length === 0) return null;

  // Project center marker (larger, dark)
  const centerMarker = `pin-l+1a1a1a(${center.lng},${center.lat})`;

  // POI markers colored by category
  const poiMarkers = pois
    .map((poi) => {
      const color = poi.category.color.replace("#", "");
      return `pin-s+${color}(${poi.coordinates.lng},${poi.coordinates.lat})`;
    })
    .join(",");

  const markers = `${centerMarker},${poiMarkers}`;

  const url = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${markers}/auto/800x400@2x?padding=50&access_token=${token}`;

  const altText = `Kart over ${pois.length} steder i kategorien: ${pois
    .slice(0, 3)
    .map((p) => p.name)
    .join(", ")}${pois.length > 3 ? ` og ${pois.length - 3} til` : ""}`;

  return (
    <div className="my-6">
      <img
        src={url}
        alt={altText}
        loading="lazy"
        className="w-full rounded-xl shadow-sm"
        style={{ aspectRatio: "2/1" }}
        onError={(e) => {
          // Hide broken map image
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}
