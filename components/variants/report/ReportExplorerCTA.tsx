import Link from "next/link";
import type { POI, Coordinates } from "@/lib/types";

interface ReportExplorerCTAProps {
  pois: POI[];
  center: Coordinates;
  explorerBaseUrl: string;
  totalPOIs: number;
}

interface CategoryCentroid {
  color: string;
  lat: number;
  lng: number;
}

function getCategoryCentroids(pois: POI[]): CategoryCentroid[] {
  const categoryGroups = new Map<
    string,
    { color: string; lats: number[]; lngs: number[] }
  >();

  for (const poi of pois) {
    const key = poi.category.id;
    if (!categoryGroups.has(key)) {
      categoryGroups.set(key, {
        color: poi.category.color,
        lats: [],
        lngs: [],
      });
    }
    const group = categoryGroups.get(key)!;
    group.lats.push(poi.coordinates.lat);
    group.lngs.push(poi.coordinates.lng);
  }

  const centroids: CategoryCentroid[] = [];
  for (const { color, lats, lngs } of Array.from(categoryGroups.values())) {
    centroids.push({
      color,
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    });
  }

  return centroids;
}

export default function ReportExplorerCTA({
  pois,
  center,
  explorerBaseUrl,
  totalPOIs,
}: ReportExplorerCTAProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || pois.length === 0) return null;

  const centroids = getCategoryCentroids(pois);

  // Center marker (larger, dark)
  const centerMarker = `pin-l+1a1a1a(${center.lng},${center.lat})`;

  // Category centroid markers
  const categoryMarkers = centroids
    .map(({ color, lat, lng }) => `pin-l+${color.replace("#", "")}(${lng},${lat})`)
    .join(",");

  const markers = `${centerMarker},${categoryMarkers}`;

  const url = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${markers}/auto/800x400@2x?padding=50&access_token=${token}`;

  const altText = `Kart over ${totalPOIs} steder fordelt på ${centroids.length} kategorier`;

  return (
    <section className="col-span-12 py-16 md:py-20 bg-[#f3f0eb] -mx-16 px-16">
      <div className="max-w-4xl">
        <div className="h-px bg-[#e8e4df] mb-12" />

        <h2 className="text-xl md:text-2xl font-semibold text-[#1a1a1a] mb-4">
          Utforsk på egenhånd
        </h2>
        <p className="text-base md:text-lg text-[#4a4a4a] leading-relaxed mb-8">
          Se alle {totalPOIs} steder på ett kart. Filtrer etter det som passer
          deg, og lag din egen liste å ta med ut.
        </p>
      </div>

      {/* Clickable map image */}
      <Link href={explorerBaseUrl} className="block mb-8">
        <img
          src={url}
          alt={altText}
          loading="lazy"
          className="w-full rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          style={{ aspectRatio: "2/1" }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </Link>

      {/* CTA button */}
      <div>
        <Link
          href={explorerBaseUrl}
          className="inline-flex items-center justify-center px-8 py-3 bg-[#1a1a1a] text-white font-medium rounded-lg hover:bg-[#333] transition-colors"
        >
          Åpne i Explorer
        </Link>
      </div>
    </section>
  );
}
