---
module: Report
date: 2026-03-04
problem_type: logic_error
component: data_transform
symptoms:
  - "First 6 POIs in theme section show 3x same category (e.g. 3 bike stations) instead of diverse mix"
  - "Nearby bus stop hidden behind 'Hent flere' while distant train station shown in first batch"
  - "byTierThenScore overwrites distance sorting completely — proximity information lost"
root_cause: wrong_sort_strategy
resolution_type: algorithm_replacement
severity: medium
tags: [report, poi-sorting, round-robin, diversification, tier-system, category, first-load]
---

# Report POI Sorting Shows Clustered Categories in First Load

## Problem

The first 6 POIs shown in each Report theme section clustered around high-scoring categories instead of showing diverse category representation. For example, Transport & Mobilitet would show 3 bike stations and 2 train stations instead of 1 bus + 1 bike + 1 train + 1 tram.

## Environment

- Module: Report / `components/variants/report/report-data.ts`
- Stack: Next.js 14, TypeScript
- Function: `transformToReportData()` line 386
- Date: 2026-03-04

## Symptoms

- StasjonsKvartalet Transport & Mobilitet: first 6 = Lademoen stasjon, 3x bysykkel, Trondheim S, hurtigbåtterminalen
- Nearby bus stop "Søndre gate Regionbuss" (200m) hidden behind "Hent flere"
- Distant train station "Lademoen" (1km) shown in first batch due to high Google review score
- Same pattern in all themes — Mat & Drikke showed 3 restaurants instead of 1 restaurant + 1 cafe + 1 bakeri

## Root Cause

The sorting pipeline had two steps:

1. Distance sort (nearest first) — correct
2. `byTierThenScore` re-sort — **overwrote distance order completely**

```typescript
// Step 2 destroyed step 1's distance information
const sorted = [...filtered].sort(byTierThenScore);
const { visiblePOIs, hiddenPOIs } = splitVisibleHidden(sorted);
```

`byTierThenScore` sorted by tier (1 < 2 < 3), then by `rating × log₂(1 + reviewCount)`. This meant POIs with many Google reviews always floated to the top, regardless of proximity. A bus stop with 0 reviews (perfectly useful) lost to a train station with 500 reviews 1km away.

## Solution

Replaced flat `byTierThenScore` sort with `diversifiedSelection()` — a category-diversified round-robin algorithm.

### New algorithm: `diversifiedSelection`

```typescript
export function diversifiedSelection(
  pois: POI[],
  center: Coordinates,
  count: number = INITIAL_VISIBLE_COUNT,
): { visiblePOIs: POI[]; hiddenPOIs: POI[] } {
  if (pois.length === 0) return { visiblePOIs: [], hiddenPOIs: [] };

  // 1. Group by category
  const byCat = new Map<string, POI[]>();
  for (const poi of pois) {
    const catId = poi.category.id;
    const arr = byCat.get(catId);
    if (arr) arr.push(poi);
    else byCat.set(catId, [poi]);
  }

  // 2. Sort each category: tier → distance (not score)
  const comparator = byTierThenDistance(center);
  byCat.forEach((catPOIs) => catPOIs.sort(comparator));

  // 3. Round-robin across categories
  const categories = Array.from(byCat.keys());
  const selected: POI[] = [];
  const indices = new Map<string, number>(categories.map((c) => [c, 0]));
  const totalAvailable = Math.min(count, pois.length);
  let catIdx = 0;

  while (selected.length < totalAvailable) {
    const catId = categories[catIdx % categories.length];
    const catPOIs = byCat.get(catId);
    const idx = indices.get(catId);
    if (catPOIs !== undefined && idx !== undefined && idx < catPOIs.length) {
      selected.push(catPOIs[idx]);
      indices.set(catId, idx + 1);
    }
    catIdx++;
  }

  // 4. Hidden: everything not selected, sorted tier → distance
  const selectedIds = new Set(selected.map((p) => p.id));
  const hidden = pois.filter((p) => !selectedIds.has(p.id)).sort(comparator);
  return { visiblePOIs: selected, hiddenPOIs: hidden };
}
```

### New comparator: `byTierThenDistance`

```typescript
function byTierThenDistance(center: Coordinates) {
  return (a: POI, b: POI): number => {
    const aTier = a.poiTier ?? NULL_TIER_VALUE;
    const bTier = b.poiTier ?? NULL_TIER_VALUE;
    if (aTier !== bTier) return aTier - bTier;
    const aDist = a.travelTime?.walk ?? haversineMeters(center, a.coordinates);
    const bDist = b.travelTime?.walk ?? haversineMeters(center, b.coordinates);
    return aDist - bDist;
  };
}
```

### Sub-sections also updated

`buildSubSections` switched from `byTierThenScore` to `byTierThenDistance(center)` — sub-sections are already per-category, so only the within-category sort mattered.

## Key Design Decisions

1. **No ≤2-category fallback.** Round-robin degenerates correctly for 1-2 categories (sequential/alternating picks). Extra branch adds divergence risk without value.

2. **`totalAvailable = Math.min(count, pois.length)` as termination.** Guarantees the while-loop always terminates because all POIs exist in category buckets. No safety break needed.

3. **Google score ignored for sorting.** A bus stop with 0 reviews is as useful as one with 500. Tier (curator assessment) and distance are the only relevant factors.

4. **Applies to ALL themes, not just transport.** Mat & Drikke also benefits: 1 restaurant + 1 cafe + 1 bakeri > 3 restaurants.

## TypeScript Gotcha

`Map.values()` returns an iterator that fails with `for...of` when TypeScript `target` is below ES2015 (or `downlevelIteration` is off). Use `map.forEach()` instead:

```typescript
// Fails: TS2802
for (const catPOIs of byCat.values()) { ... }

// Works:
byCat.forEach((catPOIs) => { ... });
```

## Prevention

- **When replacing a sort, check what information the previous steps provide.** The distance sort was valuable context that `byTierThenScore` destroyed.
- **Google review scores are not relevant for all POI types.** Transport infrastructure doesn't need high ratings to be useful.
- **Round-robin algorithms don't need special cases for small inputs.** Test with 1, 2, and N categories — if the general algorithm handles all correctly, don't add branches.

## Related Issues

- [POI Tier System](../feature-implementations/poi-tier-system-fase2-learnings-20260210.md) — tier values and NULL_TIER_VALUE = 2.5
- [Trust Filter Missing from Report](../logic-errors/trust-filter-missing-report-data-layer-20260208.md) — similar "filter at wrong layer" pattern
