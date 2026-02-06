import type { POI } from "@/lib/types";
import type { ThemeDefinition } from "./theme-definitions";
import type { VenueProfile } from "./venue-profiles";
import { calculateWeightedPOIScore } from "@/lib/utils/poi-score";
import { EXPLORER_THEME_CAPS, EXPLORER_TOTAL_CAP } from "./explorer-caps";
import { CATEGORY_TO_THEME } from "./default-themes";

/**
 * Apply Explorer caps: blacklist → score → per-theme cap → total cap.
 *
 * 1. Remove blacklisted categories
 * 2. Score all POIs with venue-profile weights
 * 3. Apply per-transport-category caps (e.g., max 4 bus stops)
 * 4. Per theme: take top N by score
 * 5. Dedup and enforce total cap
 */
export function applyExplorerCaps(
  pois: POI[],
  themes: ThemeDefinition[],
  profile: VenueProfile
): POI[] {
  // 1. Remove blacklisted categories
  const blacklist = new Set(profile.categoryBlacklist);
  const eligible = pois.filter((poi) => !blacklist.has(poi.category.id));

  // 2. Score all POIs
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

  // 3. Apply per-transport-category caps
  const transportCapped = applyTransportCaps(scored, profile);

  // 4. Per theme: take top N by score
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

  // 5. Handle any POIs with unmapped categories (catch-all)
  const unmapped = transportCapped
    .filter((s) => !CATEGORY_TO_THEME[s.poi.category.id] && !selectedIds.has(s.poi.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  for (const { poi } of unmapped) {
    selectedIds.add(poi.id);
    result.push(poi);
  }

  // 6. Enforce total cap
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
