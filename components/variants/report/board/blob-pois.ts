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

const METERS_PER_DEG_LAT = 110540;
const metersPerDegLng = (latDeg: number) =>
  111320 * Math.cos((latDeg * Math.PI) / 180);

/** En POI valgt for den rette dronetur-flyoveren: `at` er hvor langs flylinja
 *  (0 = start, 1 = slutt) punktet projiseres → reveal-rekkefølge = fly-over-orden. */
export interface FlyoverBlob {
  poi: POI;
  at: number;
}

/**
 * Velger POI-ene som ligger NÆR den rette flylinja (start→slutt) og sorterer dem i
 * FLY-OVER-rekkefølge (langs linja). Brukt av den rette establishing-droneturen så
 * sirkelpunktene tegnes inn fortløpende etter hvert som kameraet passerer dem.
 *
 *  • Projiserer hver POI på segmentet start→slutt (lokalt meter-rom). `at` =
 *    klampet parameter langs linja [0,1]; perpendikulær avstand = nærhet til ruta.
 *  • Beholder kun POI-er innenfor `corridorMeters` fra linja (segment-avstand, ikke
 *    bare endepunktene).
 *  • Er det flere enn `limit`, beholdes de NÆRMEST linja, deretter sorteres alt på
 *    `at` (stigende) → rekkefølgen kameraet flyr over dem.
 *
 * Ren funksjon (ingen React/DOM) → enhetstestbar.
 */
export function selectFlyoverBlobs(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  categories: BoardCategory[],
  corridorMeters: number,
  limit: number,
  excludeIds?: Set<string>,
): FlyoverBlob[] {
  // Lokalt meter-rom forankret i start (god nok i ett strøk).
  const mLng = metersPerDegLng(start.lat);
  const ax = 0;
  const ay = 0;
  const bx = (end.lng - start.lng) * mLng;
  const by = (end.lat - start.lat) * METERS_PER_DEG_LAT;
  const len2 = bx * bx + by * by || 1;

  const seen = new Set<string>();
  const within: { poi: FlyoverBlob; perp: number }[] = [];

  for (const category of categories) {
    for (const boardPoi of category.pois) {
      const poi = boardPoi.raw;
      if (seen.has(poi.id)) continue;
      seen.add(poi.id);
      if (excludeIds?.has(poi.id)) continue;

      const px = (poi.coordinates.lng - start.lng) * mLng;
      const py = (poi.coordinates.lat - start.lat) * METERS_PER_DEG_LAT;
      const tRaw = ((px - ax) * bx + (py - ay) * by) / len2;
      const t = tRaw < 0 ? 0 : tRaw > 1 ? 1 : tRaw; // klamp til segmentet
      const projX = ax + t * bx;
      const projY = ay + t * by;
      const perp = Math.hypot(px - projX, py - projY);
      if (perp > corridorMeters) continue;
      within.push({ poi: { poi, at: t }, perp });
    }
  }

  // Klipp til de nærmeste linja om vi er over budsjettet, sorter så på fly-over-orden.
  within.sort((a, b) => a.perp - b.perp);
  const kept = within.slice(0, Math.max(0, limit)).map((w) => w.poi);
  kept.sort((a, b) => a.at - b.at);
  return kept;
}
