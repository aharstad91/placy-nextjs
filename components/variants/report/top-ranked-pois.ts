import type { POI } from "@/lib/types";

/**
 * Ranking-score for én POI. Høyere = bedre.
 * Tier-vekt: tier 1 = 3, tier 2 = 2, tier 3/null = 1. Missing rating = 0 → synker til bunn.
 * Invariant: poiTier ∈ {1,2,3}. Verdier utenfor gir meningsløs score.
 */
export function rankScore(
  poi: Pick<POI, "googleRating" | "poiTier">,
): number {
  return (poi.googleRating ?? 0) * (4 - (poi.poiTier ?? 3));
}

/**
 * Rangerer POI-er etter rankScore, cap ved `limit`. Returnerer `readonly POI[]`
 * for å propagere immutability-kontrakten til callsites. Input muteres ikke.
 *
 * Invariant: `getTopRankedPOIs(p, 10).slice(0, 6)` === `getTopRankedPOIs(p, 6)`.
 * Begge sorterer samme input med samme sammenligning; skillet er kun `limit`.
 */
export function getTopRankedPOIs(
  pois: readonly POI[],
  limit: number,
): readonly POI[] {
  if (limit < 1) return [];
  return [...pois]
    .sort((a, b) => rankScore(b) - rankScore(a))
    .slice(0, limit);
}

/**
 * Anchor-slot: faste kategorier som skal pinne seg i slider slot 1..N.
 * Flere slots med samme categoryId gir tre-av-samme-type (f.eks. 3 gyms nærmest-first).
 */
export interface AnchorSlot {
  categoryId: string;
}

/**
 * Per-tema kuraterte ankerplass-slots. Slot 0..N-1 fylles av matchende POI-er,
 * resterende slots av ranking-fill. Tomme anchors (ingen matching POI) faller
 * tilbake til ranking — slideren er alltid full (opp til limit).
 *
 * Se docs/brainstorms/2026-04-20-kuratert-poi-slots-lazy-kart-brainstorm.md
 */
export const THEME_ANCHOR_SLOTS: Record<string, readonly AnchorSlot[]> = {
  "barn-oppvekst": [
    { categoryId: "barnehage" },
    { categoryId: "skole" },
    { categoryId: "lekeplass" },
  ],
  "hverdagsliv": [
    { categoryId: "supermarket" },
    { categoryId: "pharmacy" },
    { categoryId: "shopping" },
  ],
  "trening-aktivitet": [
    { categoryId: "gym" },
    { categoryId: "gym" },
    { categoryId: "gym" },
  ],
  "transport": [
    { categoryId: "bus" },
    { categoryId: "bike" },
    { categoryId: "carshare" },
  ],
  "natur-friluftsliv": [
    { categoryId: "park" },
    { categoryId: "outdoor" },
    { categoryId: "badeplass" },
  ],
  "opplevelser": [
    { categoryId: "library" },
    { categoryId: "cinema" },
  ],
  // mat-drikke: ingen anchor-slots → pure ranking
};

/**
 * Curated POI-utvalg til slider. Returnerer opp til `limit` POI-er:
 * 1. Anchor-slots fylt i rekkefølge — innen samme categoryId velges nærmeste (travelTime.walk asc)
 * 2. Manglende anchor-slot hopper videre (ingen padding mellom)
 * 3. Resterende slots fylt med ranking-fill (rankScore desc, ingen duplikater)
 *
 * Input muteres ikke. Output er `readonly POI[]`.
 */
export function getCuratedPOIs(
  pois: readonly POI[],
  themeId: string,
  limit: number,
): readonly POI[] {
  if (limit < 1) return [];
  const anchors = THEME_ANCHOR_SLOTS[themeId] ?? [];
  const byWalk = [...pois].sort(
    (a, b) =>
      (a.travelTime?.walk ?? Infinity) - (b.travelTime?.walk ?? Infinity),
  );
  const result: POI[] = [];

  for (const anchor of anchors) {
    if (result.length >= limit) break;
    const idx = byWalk.findIndex((p) => p.category.id === anchor.categoryId);
    if (idx >= 0) {
      result.push(byWalk.splice(idx, 1)[0]);
    }
  }

  const pinned = new Set(result.map((p) => p.id));
  const ranked = [...byWalk]
    .filter((p) => !pinned.has(p.id))
    .sort((a, b) => rankScore(b) - rankScore(a));
  for (const poi of ranked) {
    if (result.length >= limit) break;
    result.push(poi);
  }

  return result;
}
