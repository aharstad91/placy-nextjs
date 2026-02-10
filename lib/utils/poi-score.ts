/**
 * POI Scoring for generate-hotel quality ranking.
 *
 * Score = (rating × reviewWeight) + proximityBonus
 * - reviewWeight: min(reviewCount / 50, 1.0) — steder med mange anmeldelser vektes høyere
 * - proximityBonus: lineær bonus for steder innen 15 min gange, maks 0.5
 */

import type { VenueProfile } from "@/lib/themes/venue-profiles";

export interface POIScoreInput {
  googleRating?: number | null;
  googleReviewCount?: number | null;
  walkMinutes?: number | null;
  category?: string;
}

export function calculatePOIScore(poi: POIScoreInput): number {
  const rating = poi.googleRating ?? 0;
  const reviewWeight = Math.min((poi.googleReviewCount ?? 0) / 50, 1.0);
  const walkMin = poi.walkMinutes ?? 15;
  const proximityBonus = Math.max(0, (15 - walkMin) / 15) * 0.5;
  return rating * reviewWeight + proximityBonus;
}

/**
 * Report scoring: rating × log2(1 + reviewCount).
 * Balances quality (rating) with confidence (review volume).
 * POIs with no rating score 0.
 */
export function calculateReportScore(poi: Pick<POIScoreInput, "googleRating" | "googleReviewCount">): number {
  const rating = poi.googleRating ?? 0;
  const reviews = poi.googleReviewCount ?? 0;
  if (rating === 0) return 0;
  return rating * Math.log2(1 + reviews);
}

/**
 * Weighted score that applies venue-profile relevance multiplier.
 * Preserves original calculatePOIScore signature for backward compatibility.
 */
export function calculateWeightedPOIScore(
  poi: POIScoreInput,
  profile?: VenueProfile
): number {
  const baseScore = calculatePOIScore(poi);
  if (!profile || !poi.category) return baseScore;
  const weight = profile.categoryWeights[poi.category] ?? 1.0;
  return baseScore * weight;
}
