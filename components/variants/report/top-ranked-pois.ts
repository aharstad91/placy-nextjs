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
