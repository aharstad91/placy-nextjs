---
title: "fix: Report sub-sections for all categories + formula-based POI scoring"
type: fix
date: 2026-02-10
brainstorm: docs/brainstorms/2026-02-10-poi-tier-system-quality-curation-brainstorm.md
phase: "Fase 1 of POI Tier System"
---

# fix: Report sub-sections for all categories + formula-based POI scoring

## Overview

Fase 1 of the POI Tier System. Two focused changes that work immediately without database changes:

1. **Bug fix:** When a theme has sub-sections (categories >15 POIs), ALL categories should render as proper sub-sections — not just the large ones. Currently small categories like "Bakeri" (15 POIs) lose their header, highlights, stats, and "Vis mer" button.

2. **Scoring improvement:** Replace the simple `byRatingDesc` sort with `rating × log2(1 + reviewCount)` for better POI ranking that balances quality and popularity.

## Problem

### Bug: Small categories lose formatting
When "Mat & Drikke" has sub-sections for Restaurant (36 POIs) and Bar (18 POIs), smaller categories like Bakeri (15 POIs) get dumped into a bare `CompactPOIList` at the bottom — no header, no highlight carousel, no stats, no "Vis mer".

**Root causes:**
1. `buildSubSections()` uses strict `>` (line 182): Bakeri with exactly 15 POIs fails `15 > 15`
2. Only categories exceeding threshold become sub-sections. Remaining categories get flat rendering (lines 259-267 in ReportThemeSection.tsx)

### Scoring: Pure rating sort is insufficient
`byRatingDesc()` sorts only by `googleRating`. A place rated 5.0 with 2 reviews outranks a 4.7 with 2000 reviews. The formula `rating × log2(1 + reviews)` balances quality and confidence.

## Proposed Solution

### Change 1: All categories as sub-sections

Modify `buildSubSections()` to include ALL categories (not just large ones) when any category exceeds threshold. This makes the "remaining POIs" code path in ReportThemeSection.tsx unnecessary.

**Before:** Only categories with `pois.length > 15` become sub-sections.
**After:** When ANY category exceeds threshold, ALL categories become sub-sections (each with highlights, list, hidden, stats, quote).

### Change 2: Formula-based score

Replace `byRatingDesc` comparator with formula-based scoring:
```
score = rating × log2(1 + reviewCount)
```

Tested against Scandic Lerkendal data (297 POIs) — produces sensible rankings where high-quality well-reviewed places top the list, but newer/niche spots remain competitive.

## Acceptance Criteria

- [x] Bakeri (15 POIs) renders as proper sub-section with header, highlights, stats, and "Vis mer"
- [x] ALL categories within a theme render as sub-sections when any category exceeds threshold
- [x] Highlights (top carousel) are selected by formula score, not just rating
- [x] POI compact list is sorted by formula score within each sub-section
- [x] Theme-level `allPOIs` preserved for mobile/other consumers
- [x] Composite scroll keys (`themeId:categoryId`) work for all sub-sections
- [x] No visual regression for themes without sub-sections (FlatThemeContent path unchanged)

## Technical Approach

### File: `lib/utils/poi-score.ts`

#### Task 1: New scoring helper — `calculateReportScore()`

Add to the existing `poi-score.ts` file (co-located with `calculatePOIScore()` and `calculateWeightedPOIScore()`). Follows the `calculate*Score` naming convention established in the codebase.

```typescript
// lib/utils/poi-score.ts — new export
export function calculateReportScore(poi: POI): number {
  const rating = poi.googleRating ?? 0;
  const reviews = poi.googleReviewCount ?? 0;
  if (rating === 0) return 0;
  return rating * Math.log2(1 + reviews);
}
```

### File: `components/variants/report/report-data.ts`

#### Task 2: Replace `byRatingDesc` with formula sort (line 119-124)

Import `calculateReportScore` from `poi-score.ts` and replace the inline comparator.

```typescript
// BEFORE
function byRatingDesc(a: POI, b: POI): number {
  return (b.googleRating ?? 0) - (a.googleRating ?? 0);
}

// AFTER
import { calculateReportScore } from "@/lib/utils/poi-score";

function byFormulaScore(a: POI, b: POI): number {
  return calculateReportScore(b) - calculateReportScore(a);
}
```

Update all call sites of `byRatingDesc` to use `byFormulaScore`.

#### Task 3: Update `pickHighlights()` (line 127-132)

```typescript
// BEFORE
return [...pois].sort(byRatingDesc).slice(0, HIGHLIGHT_FALLBACK_COUNT);

// AFTER
return [...pois].sort(byFormulaScore).slice(0, HIGHLIGHT_FALLBACK_COUNT);
```

#### Task 4: Fix `buildSubSections()` — all categories when any is large (line 163-230)

The core change: when ANY category exceeds threshold, ALL categories in the theme become sub-sections. Also update `SUB_SECTION_THRESHOLD` JSDoc to reflect the `>=` semantics.

```typescript
// Update JSDoc: "Categories with >= this many POIs trigger sub-section mode"

// BEFORE (line 182)
const largeCats = Array.from(byCat.entries()).filter(
  ([, pois]) => pois.length > SUB_SECTION_THRESHOLD
);
if (largeCats.length === 0) return [];

// AFTER — split ALL categories when any meets or exceeds threshold
const hasLargeCat = Array.from(byCat.values()).some(
  (pois) => pois.length >= SUB_SECTION_THRESHOLD
);
if (!hasLargeCat) return [];

// Build sub-sections for ALL categories, sorted by count (most first)
const allCats = Array.from(byCat.entries());
allCats.sort((a, b) => b[1].length - a[1].length);
```

Then change `largeCats.map(...)` to `allCats.map(...)` in the return statement (line 189).

#### Task 5: Sort POIs within sub-sections by formula score

Currently POIs inherit theme-level sort (proximity). Consider sorting sub-section POIs by formula score so highlights aren't just the nearest POIs, but the best ones.

In `buildSubSections()`, sort `catPOIs` by formula score before passing to `pickHighlights()` and `splitVisibleHidden()`:

```typescript
// After grouping catPOIs
const sortedCatPOIs = [...catPOIs].sort(byFormulaScore);
const highlights = pickHighlights(sortedCatPOIs, parentDisplayMode);
const { listPOIs, hiddenPOIs } = splitVisibleHidden(sortedCatPOIs, highlights);
```

### File: `components/variants/report/ReportThemeSection.tsx`

#### Task 6: Clean up remaining POIs rendering (lines 259-267)

Since `buildSubSections()` now returns ALL categories, the "remaining POIs" block should rarely trigger. But as a safety net, keep it with a check:

```typescript
// Safety: remaining POIs should be empty when all cats are sub-sections
{remainingPOIs.length > 0 && (
  <div>
    <CompactPOIList
      pois={remainingPOIs}
      activePOIId={activePOIId}
      onPOIClick={onPOIClick}
    />
  </div>
)}
```

No change needed — the fix is in the data layer, not the rendering.

## Testing

### Manual verification on Scandic Lerkendal Report (`/scandic/scandic-lerkendal/report`):

1. **Bakeri section exists** — has header, icon, stats, highlights, compact list, "Vis mer"
2. **All categories have sub-sections** — Restaurant, Kafé, Bar, Bakeri (all should have section chrome)
3. **Highlight carousel** — shows top 3 by formula score (not just rating)
4. **"Vis mer" works** — click to expand shows remaining POIs
5. **Scroll sync** — map updates correctly when scrolling through sub-sections
6. **Themes without sub-sections** — still render flat (e.g., themes with <15 per category)
7. **Mobile view** — unaffected (uses `theme.allPOIs`)

### Specific data checks:

- Bakeri top 3 highlights should be: Godt Brød (38.5), Hevd Bakeri & Pizzeria (38.3), Nabolaget Bagelri (34.1) — per formula score
- Restaurant top 3: Britannia Hotel (51.7), KōH i NōR (50.0), Frati (49.5)
- Verify formula score ordering matches the brainstorm data analysis

## References

- Brainstorm: `docs/brainstorms/2026-02-10-poi-tier-system-quality-curation-brainstorm.md`
- Learnings: `docs/solutions/feature-implementations/report-subcategory-splitting-20260210.md`
- Scoring learnings: `docs/solutions/feature-implementations/generate-hotel-scoring-featured-capping-20260206.md`
