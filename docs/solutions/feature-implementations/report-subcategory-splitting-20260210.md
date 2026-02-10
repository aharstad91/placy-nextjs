---
title: Report sub-category splitting for large themes
category: feature-implementations
tags: [report, sub-sections, composite-keys, data-transform, scroll-sync, sticky-map]
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
export const SUB_SECTION_THRESHOLD = 15;
```

### Splitting logic in `buildSubSections()`

Groups sorted POIs by `poi.category.id`, checks which categories exceed the threshold, and builds `ReportSubSection[]` for large categories. Small categories remain in the parent theme's flat list.

```ts
function buildSubSections(
  sortedPOIs: POI[],
  parentDisplayMode: ThemeDisplayMode,
  projectId: string,
): ReportSubSection[] {
  const byCat = new Map<string, POI[]>();
  for (const poi of sortedPOIs) {
    const catId = poi.category.id;
    const arr = byCat.get(catId);
    if (arr) arr.push(poi);
    else byCat.set(catId, [poi]);
  }

  const largeCats = Array.from(byCat.entries())
    .filter(([, pois]) => pois.length > SUB_SECTION_THRESHOLD);
  if (largeCats.length === 0) return [];

  // Build sub-sections with own highlights, stats, quotes...
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

### Shared helpers (DRY pattern)

Extracted 4 helper functions used by both `buildSubSections` and `transformToReportData`:
- `byRatingDesc()` — sort comparator for POIs by rating
- `pickHighlights()` — featured-first highlight selection
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

## Prevention / best practices

- When adding new categories that might exceed the threshold, no code change needed — splitting is automatic.
- When adding new category IDs, add matching quote templates in `category-score.ts` to avoid falling back to generic defaults.
- The threshold of 15 is tuned for the Scandic Lerkendal dataset. Adjust `SUB_SECTION_THRESHOLD` if projects typically have different density distributions.

## Related

- [Report scroll-synced sticky map](./report-scroll-synced-sticky-map-20260208.md) — The parent architecture this builds on
- `docs/plans/2026-02-09-feat-report-subcategory-splitting-plan.md` — Original implementation plan
