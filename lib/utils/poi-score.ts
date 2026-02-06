/**
 * POI Scoring for generate-hotel quality ranking.
 *
 * Score = (rating × reviewWeight) + proximityBonus
 * - reviewWeight: min(reviewCount / 50, 1.0) — steder med mange anmeldelser vektes høyere
 * - proximityBonus: lineær bonus for steder innen 15 min gange, maks 0.5
 */

export interface POIScoreInput {
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

/**
 * Estimate walk time from distance in meters.
 * Assumes 80m/min average walking speed in urban areas.
 */
export function estimateWalkMinutes(
  distanceMeters: number
): number {
  return distanceMeters / 80;
}

/**
 * Calculate distance between two coordinates in meters (Haversine).
 */
export function distanceBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
