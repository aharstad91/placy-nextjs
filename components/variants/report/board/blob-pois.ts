import { getDistanceMeters } from "@/lib/map-utils";
import type { POI } from "@/lib/types";
import type { BoardCategory } from "./board-data";

/**
 * Velger «nærmeste-N»-settet som vises som blobs (små farge-prikker) under
 * velkommen-flyover-en — etableringen av nærområdet før audio-touren tar over.
 *
 * Hvorfor nærmeste, ikke score-rangert (topRankedPois): blobs skal formidle
 * «se hvor mye som ligger rundt deg» mens kameraet senker seg inn på objektet.
 * Da er fysisk nærhet den meningsfulle aksen — det nære nabolaget tegner seg inn
 * rundt hjemmet. Den kuraterte/score-rangerte visningen hører til kategori-beatene.
 *
 * Settet er deduplikert på POI-id (samme sted kan ligge i to kategorier) og
 * beholder kategori-fargen via `poi.category.color` — hver blob fargelegges av
 * sin kategori, så fargemiksen alene antyder bredden i tilbudet.
 *
 * Ren funksjon (ingen React/DOM) → enhetstestbar.
 */
export function selectBlobPOIs(
  home: { lat: number; lng: number },
  categories: BoardCategory[],
  limit: number,
  excludeIds?: Set<string>,
): POI[] {
  const seen = new Set<string>();
  const candidates: { poi: POI; distance: number }[] = [];

  for (const category of categories) {
    for (const boardPoi of category.pois) {
      const poi = boardPoi.raw;
      if (seen.has(poi.id)) continue;
      seen.add(poi.id);
      // POI-er som vises som vanlige legend-pins ekskluderes så vi ikke får en
      // blob-prikk OPPÅ en full pin på samme sted.
      if (excludeIds?.has(poi.id)) continue;
      candidates.push({
        poi,
        distance: getDistanceMeters(home, poi.coordinates),
      });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.slice(0, Math.max(0, limit)).map((c) => c.poi);
}
