import type { Coordinates, POI } from "@/lib/types";
import { resolveThemeId } from "@/lib/themes";

/**
 * Rene POI-utvelgere for hero-insight-kortet (Tier 1), skilt ut fra den
 * `"use client"`-merkede `ReportHeroInsight.tsx` slik at `getHeroInsightPOIIds`
 * kan KALLES server-side. `transformToReportData` (render) og
 * provisjonerings-pipelinen (via `/api/admin/inherit-editorial`) trenger den —
 * en funksjon eksportert fra en `"use client"`-modul kan ikke kalles fra server.
 * Ingen React/JSX her, kun ren logikk (samme funksjonskropper som før).
 */

/** Haversine distance in meters */
function haversineM(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Walk minutes — uses travelTime if available, else estimates from haversine x 1.3 road factor */
export function estimateWalkMin(poi: POI, center: Coordinates): number {
  if (poi.travelTime?.walk != null) return Math.round(poi.travelTime.walk);
  return Math.round((haversineM(center, poi.coordinates) * 1.3) / 83);
}

function byWalk(pois: POI[], center: Coordinates): POI[] {
  return [...pois].sort(
    (a, b) => estimateWalkMin(a, center) - estimateWalkMin(b, center),
  );
}

function ofCats(pois: POI[], ...ids: string[]): POI[] {
  const s = new Set(ids);
  return pois.filter((p) => s.has(p.category.id));
}

export function nearestOf(
  pois: POI[],
  center: Coordinates,
  ...catIds: string[]
): POI | undefined {
  return byWalk(ofCats(pois, ...catIds), center)[0];
}

export const KULTUR_TYPES: { catIds: string[]; label: string }[] = [
  { catIds: ["library"], label: "Bibliotek" },
  { catIds: ["cinema"], label: "Kino" },
  { catIds: ["museum"], label: "Museum" },
  { catIds: ["theatre"], label: "Teater" },
  { catIds: ["bowling", "amusement"], label: "Underholdning" },
];

/** Tier 1 extractors — returns the POIs shown in the hero insight card */
const TIER1_EXTRACTORS: Record<
  string,
  (pois: POI[], center: Coordinates) => POI[]
> = {
  transport: (pois, center) => {
    const result: POI[] = [];
    const seen = new Set<string>();
    // Transit stops
    for (const catId of ["train", "tram", "bus"]) {
      for (const poi of byWalk(ofCats(pois, catId), center)) {
        if (!seen.has(poi.id) && result.length < 4) {
          result.push(poi);
          seen.add(poi.id);
        }
      }
    }
    // Nearest bysykkel + carshare for dashboard labels
    const bike = nearestOf(pois, center, "bike");
    if (bike && !seen.has(bike.id)) { result.push(bike); seen.add(bike.id); }
    const car = nearestOf(pois, center, "carshare");
    if (car && !seen.has(car.id)) { result.push(car); seen.add(car.id); }
    return result;
  },
  opplevelser: (pois, center) => {
    return KULTUR_TYPES.map((t) => nearestOf(pois, center, ...t.catIds)).filter(
      Boolean,
    ) as POI[];
  },
};

/**
 * Returns the set of POI IDs used in the hero insight card (Tier 1).
 * Used by the text generator to avoid repeating these in prose.
 */
export function getHeroInsightPOIIds(
  themeId: string,
  pois: POI[],
  center: Coordinates,
): Set<string> {
  const resolved = resolveThemeId(themeId);
  const extractor = TIER1_EXTRACTORS[resolved];
  if (!extractor) return new Set();
  return new Set(extractor(pois, center).map((p) => p.id));
}
