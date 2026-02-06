/**
 * POI Scoring for generate-hotel quality ranking.
 *
 * Score = (rating × reviewWeight) + proximityBonus
 * - reviewWeight: min(reviewCount / 50, 1.0) — steder med mange anmeldelser vektes høyere
 * - proximityBonus: lineær bonus for steder innen 15 min gange, maks 0.5
 */

interface POIScoreInput {
  googleRating?: number | null;
  googleReviewCount?: number | null;
  walkMinutes?: number | null;
}

export function calculatePOIScore(poi: POIScoreInput): number {
  const rating = poi.googleRating ?? 0;
  const reviewWeight = Math.min((poi.googleReviewCount ?? 0) / 50, 1.0);
  const walkMin = poi.walkMinutes ?? 15;
  const proximityBonus = Math.max(0, (15 - walkMin) / 15) * 0.5;
  return rating * reviewWeight + proximityBonus;
}
