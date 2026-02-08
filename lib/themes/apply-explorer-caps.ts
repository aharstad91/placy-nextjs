import type { POI } from "@/lib/types";
import type { ThemeDefinition } from "./theme-definitions";
import type { VenueProfile } from "./venue-profiles";
import { calculateWeightedPOIScore } from "@/lib/utils/poi-score";
import { MIN_TRUST_SCORE } from "@/lib/utils/poi-trust";
import { EXPLORER_THEME_CAPS, EXPLORER_TOTAL_CAP } from "./explorer-caps";
import { CATEGORY_TO_THEME } from "./default-themes";

/**
 * Apply Explorer caps: trust filter → blacklist → score → per-theme cap → total cap.
 *
 * 1. Trust filter: remove untrusted POIs (score < MIN_TRUST_SCORE), null = show
 * 2. Remove blacklisted categories
 * 3. Score all POIs with venue-profile weights
 * 4. Apply per-transport-category caps (e.g., max 4 bus stops)
 * 5. Per theme: take top N by score
 * 6. Handle unmapped categories, then enforce total cap
 */
export function applyExplorerCaps(
  pois: POI[],
  themes: ThemeDefinition[],
  profile: VenueProfile
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

  // 5. Per theme: take top N by score
  const selectedIds = new Set<string>();
  const result: POI[] = [];

  for (const theme of themes) {
    const themeCap = EXPLORER_THEME_CAPS[theme.id] ?? 10;
    const themeCats = new Set(theme.categories);

    // POIs in this theme, sorted by score desc
    const themePOIs = transportCapped
      .filter((s) => themeCats.has(s.poi.category.id) && !selectedIds.has(s.poi.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, themeCap);

    for (const { poi } of themePOIs) {
      selectedIds.add(poi.id);
      result.push(poi);
    }
  }

  // 6. Handle any POIs with unmapped categories (catch-all)
  // Use remaining capacity so projects with custom categories (e.g. architecture prizes) aren't truncated
  const unmappedCap = Math.max(EXPLORER_TOTAL_CAP - result.length, 0);
  const unmapped = transportCapped
    .filter((s) => !CATEGORY_TO_THEME[s.poi.category.id] && !selectedIds.has(s.poi.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, unmappedCap);

  for (const { poi } of unmapped) {
    selectedIds.add(poi.id);
    result.push(poi);
  }

  // 7. Enforce total cap
  return result.slice(0, EXPLORER_TOTAL_CAP);
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
