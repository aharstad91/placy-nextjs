---
title: Report sub-category splitting for large themes
category: feature-implementations
tags: [report, sub-sections, composite-keys, data-transform, scroll-sync, sticky-map, formula-score, poi-scoring]
date: 2026-02-10
severity: medium
module: report
symptoms:
  - Theme with 80+ POIs renders as one giant flat list
  - No visual hierarchy within large themes like "Mat & Drikke"
  - Map shows all theme markers at once making it hard to distinguish categories
---

# Report sub-category splitting for large themes

## Problem

When a Report theme (e.g. "Mat & Drikke") contains many POIs spread across several categories (restaurant, café, bar, bakery), they all rendered as one flat list. For Scandic Lerkendal with 80+ food POIs, users had to scroll through an undifferentiated wall of cards with no way to focus on a specific category.

## Solution

### Runtime sub-section splitting

When a category within a theme exceeds a configurable threshold (15 POIs), it's automatically broken out as a nested sub-section with its own header, stats, quote, highlight cards, and compact list.

**Key files:**
- `components/variants/report/report-data.ts` — Data model + `buildSubSections()` logic
- `components/variants/report/ReportThemeSection.tsx` — Sub-section rendering
- `components/variants/report/ReportPage.tsx` — Scroll tracking with composite keys
- `components/variants/report/ReportStickyMap.tsx` — Sub-section-aware marker filtering
- `lib/utils/category-score.ts` — Quote templates for sub-categories

### Data model

```ts
export interface ReportSubSection {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  stats: ReportThemeStats;
  highlightPOIs: POI[];
  listPOIs: POI[];
  hiddenPOIs: POI[];
  allPOIs: POI[];
  displayMode: ThemeDisplayMode;
  quote: string;
}

// Added to ReportTheme:
subSections?: ReportSubSection[];
```

### Threshold constant

```ts
/** When any category within a theme has >= this many POIs, all categories become sub-sections */
export const SUB_SECTION_THRESHOLD = 15;
```

### Splitting logic in `buildSubSections()`

Groups POIs by `poi.category.id`. When ANY category meets the threshold (`>=`), ALL categories in the theme become sub-sections — not just the large ones. Each sub-section's POIs are sorted by formula score.

```ts
function buildSubSections(
  themePOIs: POI[],
  parentDisplayMode: ThemeDisplayMode,
  projectId: string,
): ReportSubSection[] {
  const byCat = new Map<string, POI[]>();
  for (const poi of themePOIs) {
    const catId = poi.category.id;
    const arr = byCat.get(catId);
    if (arr) arr.push(poi);
    else byCat.set(catId, [poi]);
  }

  // When ANY category meets threshold, ALL become sub-sections
  const hasLargeCat = Array.from(byCat.values()).some(
    (pois) => pois.length >= SUB_SECTION_THRESHOLD
  );
  if (!hasLargeCat) return [];

  const allCats = Array.from(byCat.entries());
  allCats.sort((a, b) => b[1].length - a[1].length);

  return allCats.map(([catId, catPOIs]) => {
    const sortedCatPOIs = [...catPOIs].sort(byFormulaScore);
    // Build sub-section with highlights, stats, quotes from sortedCatPOIs...
  });
}
```

### Composite keys for scroll tracking

Sub-sections use composite keys `"themeId:categoryId"` for scroll tracking and expand state. The `useActiveSection` hook returns either `"mat-drikke"` (theme) or `"mat-drikke:restaurant"` (sub-section).

```ts
// In ReportPage.tsx — parse activeSectionId
const activeThemeId = activeSectionId?.split(":")[0] ?? null;
const activeSubSectionCategoryId = activeSectionId?.includes(":")
  ? activeSectionId.split(":")[1]
  : null;
```

### Map marker filtering

`ReportStickyMap` receives both `activeThemeId` and `activeSubSectionCategoryId`. A pre-computed `activePoiIds` Set provides O(1) visibility checks:

```ts
const activeSectionKeyForIds = activeSubSectionCategoryId
  ? `${activeThemeId}:${activeSubSectionCategoryId}`
  : activeThemeId;

const activePoiIds = useMemo(() => {
  if (!activeSectionKeyForIds) return new Set<string>();
  return new Set((poisByTheme[activeSectionKeyForIds] ?? []).map((p) => p.id));
}, [activeSectionKeyForIds, poisByTheme]);

const isPoiInActiveSection = useCallback(
  (poiId: string) => activePoiIds.has(poiId),
  [activePoiIds]
);
```

### Formula-based scoring

POIs within sub-sections are sorted by formula score instead of raw rating:

```ts
// lib/utils/poi-score.ts
export function calculateReportScore(poi: Pick<POIScoreInput, "googleRating" | "googleReviewCount">): number {
  const rating = poi.googleRating ?? 0;
  const reviews = poi.googleReviewCount ?? 0;
  if (rating === 0) return 0;
  return rating * Math.log2(1 + reviews);
}

// report-data.ts
function byFormulaScore(a: POI, b: POI): number {
  return calculateReportScore(b) - calculateReportScore(a);
}
```

The formula `rating × log2(1 + reviews)` balances quality with review confidence. A 4.7-rated place with 2000 reviews (score 51.7) outranks a 5.0-rated place with 2 reviews (score 7.9).

### Shared helpers (DRY pattern)

Extracted 4 helper functions used by both `buildSubSections` and `transformToReportData`:
- `byFormulaScore()` — sort comparator using `calculateReportScore()` from `poi-score.ts`
- `pickHighlights()` — featured-first, fallback to top formula-scored
- `computePOIStats()` — rating/review/editorial stats
- `splitVisibleHidden()` — split into initial visible and "load more" hidden

### useLoadMore hook

Shared state machine for the "Hent flere" / "Load more" button pattern:

```ts
function useLoadMore(isExpanded: boolean, onExpand: () => void) {
  const [loadState, setLoadState] = useState<"idle" | "loading" | "done">(
    isExpanded ? "done" : "idle"
  );
  const handleLoadMore = useCallback(() => {
    setLoadState("loading");
    setTimeout(() => {
      setLoadState("done");
      setTimeout(() => onExpand(), 1000);
    }, 2000);
  }, [onExpand]);
  const showAll = loadState === "done" || isExpanded;
  return { loadState, handleLoadMore, showAll } as const;
}
```

## Key design decisions

1. **Two separate props, not composite IDs at component boundaries.** `ReportStickyMap` receives `activeThemeId` + `activeSubSectionCategoryId` — no string parsing in component logic.

2. **Theme-level lists preserved.** `theme.highlightPOIs`, `theme.listPOIs`, `theme.hiddenPOIs` still contain ALL POIs. Mobile view (`ReportInteractiveMapSection`) uses `theme.allPOIs` as before — zero mobile changes needed.

3. **`expandedThemes` Set supports both keys.** The same `Set<string>` tracks theme-level expansions (`"mat-drikke"`) and sub-section expansions (`"mat-drikke:restaurant"`).

4. **Sub-sections as separate observed regions.** Each sub-section gets its own `<div id="themeId:categoryId">` registered with `useActiveSection`, enabling per-sub-section scroll tracking and map focus.

5. **Quote templates share key-space.** `QUOTE_TEMPLATES` in `category-score.ts` maps both theme IDs (`"mat-drikke"`) and category IDs (`"restaurant"`) — `generateCategoryQuote()` resolves the right template by key.

## Gotchas / bugs fixed

### 1. Strict `>` threshold excluded edge cases

**Original bug:** `pois.length > SUB_SECTION_THRESHOLD` meant Bakeri with exactly 15 POIs failed `15 > 15`. Fixed to `>=`.

**Lesson:** When a threshold defines a minimum, always use `>=`. The name `SUB_SECTION_THRESHOLD = 15` implies "15 is the threshold" — so 15 should meet it.

### 2. Only large categories became sub-sections

**Original bug:** When a theme had sub-sections, only categories exceeding the threshold became sub-sections. Remaining categories (like Bakeri) were dumped into a bare `CompactPOIList` at the bottom — no header, no highlights, no stats, no "Vis mer" button.

**Fix:** When ANY category meets threshold, ALL categories become sub-sections. This ensures consistent formatting across the entire theme.

### 3. Pure rating sort ignored review confidence

**Original behavior:** `byRatingDesc()` sorted only by `googleRating`. A 5.0-rated place with 2 reviews outranked a 4.7 with 2000 reviews.

**Fix:** `byFormulaScore()` using `calculateReportScore()` from `poi-score.ts`. Formula: `rating × log2(1 + reviews)`. Scoring function follows the `calculate*Score` naming convention and lives alongside `calculatePOIScore()` and `calculateWeightedPOIScore()`.

### 4. Sub-section POIs inherited theme-level proximity sort

**Original behavior:** POIs within sub-sections were ordered by proximity (closest first), meaning highlights showed the nearest POIs, not the best ones.

**Fix:** Each sub-section's POIs are re-sorted by formula score before splitting into highlights/visible/hidden.

## Prevention / best practices

- When adding new categories that might exceed the threshold, no code change needed — splitting is automatic.
- When adding new category IDs, add matching quote templates in `category-score.ts` to avoid falling back to generic defaults.
- The threshold of 15 is tuned for the Scandic Lerkendal dataset. Adjust `SUB_SECTION_THRESHOLD` if projects typically have different density distributions.
- **Scoring functions belong in `lib/utils/poi-score.ts`** — follow the `calculate*Score` naming convention. Use `Pick<POIScoreInput, ...>` for narrow type requirements.
- **Use `>=` for inclusive thresholds** — if the constant is named `THRESHOLD = 15`, then 15 should meet it.
- **Unit tests for scoring:** `lib/utils/poi-score.test.ts` covers `calculateReportScore()` with known Scandic Lerkendal data values.

## Related

- [Report scroll-synced sticky map](./report-scroll-synced-sticky-map-20260208.md) — The parent architecture this builds on
- [POI scoring, featured, capping](./generate-hotel-scoring-featured-capping-20260206.md) — Original `calculatePOIScore()` and featured selection
- `docs/plans/2026-02-09-feat-report-subcategory-splitting-plan.md` — Original implementation plan
- `docs/plans/2026-02-10-fix-report-subsections-formula-score-plan.md` — Bug fix + formula scoring plan
- `docs/brainstorms/2026-02-10-poi-tier-system-quality-curation-brainstorm.md` — POI Tier System brainstorm (Fase 1 = this fix)
