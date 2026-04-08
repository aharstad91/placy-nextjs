import type { POI, Coordinates } from "@/lib/types";
import type { ThemeDefinition } from "./theme-definitions";
import type { VenueProfile } from "./venue-profiles";
import { calculateWeightedPOIScore, NULL_TIER_VALUE } from "@/lib/utils/poi-score";
import { MIN_TRUST_SCORE } from "@/lib/utils/poi-trust";
import { buildCategoryToTheme } from "./bransjeprofiler";

export interface NearbyGuarantee {
  center: Coordinates;
  countPerTheme: number;
  maxWalkMinutes: number;
}

function haversineMeters(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Apply Explorer caps: trust filter → blacklist → score → per-theme cap → total cap.
 *
 * 1. Trust filter: remove untrusted POIs (score < MIN_TRUST_SCORE), null = show
 * 2. Remove blacklisted categories
 * 3. Score all POIs with venue-profile weights
 * 4. Apply per-transport-category caps (e.g., max 4 bus stops)
 * 5. Per theme: guarantee nearest POIs, then fill with top scored
 * 6. Handle unmapped categories, then enforce total cap
 */
export function applyExplorerCaps(
  pois: POI[],
  themes: ThemeDefinition[],
  profile: VenueProfile,
  themeCaps: Record<string, number>,
  totalCap: number,
  nearbyGuarantee?: NearbyGuarantee
): POI[] {
  // 1. Trust filter: remove untrusted POIs, null = show (backward compatible)
  const trusted = pois.filter((poi) => {
    if (poi.trustScore == null) return true;
    return poi.trustScore >= MIN_TRUST_SCORE;
  });

  // 2. Remove blacklisted categories
  const blacklist = new Set(profile.categoryBlacklist);
  const eligible = trusted.filter((poi) => !blacklist.has(poi.category.id));

  // 3. Score all POIs
  const scored = eligible.map((poi) => ({
    poi,
    score: calculateWeightedPOIScore(
      {
        googleRating: poi.googleRating,
        googleReviewCount: poi.googleReviewCount,
        walkMinutes: poi.travelTime?.walk,
        category: poi.category.id,
      },
      profile
    ),
  }));

  // 4. Apply per-transport-category caps
  const transportCapped = applyTransportCaps(scored, profile);

  // Build category → theme lookup from provided themes
  const categoryToTheme = buildCategoryToTheme(themes);

  // 5. Per theme: guarantee nearest POIs, then fill with top scored
  const selectedIds = new Set<string>();
  const result: POI[] = [];

  const maxGuaranteeMeters = nearbyGuarantee
    ? nearbyGuarantee.maxWalkMinutes * 80
    : 0;

  for (const theme of themes) {
    const cap = themeCaps[theme.id] ?? 10;
    const themeCats = new Set(theme.categories);
    const candidates = transportCapped.filter(
      (s) => themeCats.has(s.poi.category.id) && !selectedIds.has(s.poi.id)
    );

    // 5a. Guarantee nearest POIs per theme (if enabled)
    const guaranteed: typeof candidates = [];
    if (nearbyGuarantee && nearbyGuarantee.countPerTheme > 0) {
      const sorted = [...candidates].sort(
        (a, b) =>
          haversineMeters(nearbyGuarantee.center, a.poi.coordinates) -
          haversineMeters(nearbyGuarantee.center, b.poi.coordinates)
      );
      for (const s of sorted) {
        if (guaranteed.length >= nearbyGuarantee.countPerTheme) break;
        if (haversineMeters(nearbyGuarantee.center, s.poi.coordinates) <= maxGuaranteeMeters) {
          guaranteed.push(s);
        }
      }
    }

    // 5b. Fill remaining cap with top scored (excluding already guaranteed)
    const guaranteedIds = new Set(guaranteed.map((s) => s.poi.id));
    const remaining = candidates
      .filter((s) => !guaranteedIds.has(s.poi.id))
      .sort((a, b) => {
        const aTier = a.poi.poiTier ?? NULL_TIER_VALUE;
        const bTier = b.poi.poiTier ?? NULL_TIER_VALUE;
        if (aTier !== bTier) return aTier - bTier;
        return b.score - a.score;
      })
      .slice(0, cap - guaranteed.length);

    for (const { poi } of [...guaranteed, ...remaining]) {
      selectedIds.add(poi.id);
      result.push(poi);
    }
  }

  // 6. Handle any POIs with unmapped categories (catch-all)
  // Use remaining capacity so projects with custom categories (e.g. architecture prizes) aren't truncated
  const unmappedCap = Math.max(totalCap - result.length, 0);
  const unmapped = transportCapped
    .filter((s) => !categoryToTheme[s.poi.category.id] && !selectedIds.has(s.poi.id))
    .sort((a, b) => {
      const aTier = a.poi.poiTier ?? NULL_TIER_VALUE;
      const bTier = b.poi.poiTier ?? NULL_TIER_VALUE;
      if (aTier !== bTier) return aTier - bTier;
      return b.score - a.score;
    })
    .slice(0, unmappedCap);

  for (const { poi } of unmapped) {
    selectedIds.add(poi.id);
    result.push(poi);
  }

  // 7. Enforce total cap
  return result.slice(0, totalCap);
}

/**
 * Apply per-transport-category caps (e.g., max 4 bus stops, 6 bike stations).
 * Keeps top N by score per transport category.
 */
function applyTransportCaps(
  scored: { poi: POI; score: number }[],
  profile: VenueProfile
): { poi: POI; score: number }[] {
  const transportCatCounts = new Map<string, number>();

  return scored.filter((s) => {
    const catId = s.poi.category.id;
    const cap = profile.transportCaps[catId];

    // No cap for this category — keep it
    if (cap === undefined) return true;

    const current = transportCatCounts.get(catId) ?? 0;
    if (current >= cap) return false;

    transportCatCounts.set(catId, current + 1);
    return true;
  });
}
