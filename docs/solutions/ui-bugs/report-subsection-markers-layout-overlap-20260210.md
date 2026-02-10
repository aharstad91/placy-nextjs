---
title: Report sub-section markers disappear + map overlaps cards
date: 2026-02-10
category: ui-bugs
tags: [intersection-observer, sticky-map, marker-pool, layout, sub-sections, report]
module: report
symptoms:
  - Map markers disappear when scrolling to sub-sections (e.g. Kafe)
  - Map overlaps compact card content at narrower viewports
  - Right column of 2-column card layout clipped by map boundary
severity: high
pr: "#27"
related:
  - feature-implementations/report-scroll-synced-sticky-map-20260208.md
  - feature-implementations/report-subcategory-splitting-20260210.md
  - ui-bugs/adaptive-markers-zoom-state-timing-bug-20260208.md
---

# Report sub-section markers disappear + map overlaps cards

## Problem

Three interconnected bugs in the Report sticky map after adding sub-section splitting:

1. **Markers vanish on sub-section scroll**: Scrolling to a sub-section like "Kafe" showed zero markers on the map, even though the sub-section had 29 POIs.

2. **Marker pool missing sub-section POIs**: Even after fixing the observer, markers still didn't appear because the pre-rendered marker pool only contained theme-level POIs.

3. **Map overlaps cards at narrower viewports**: The 50/50 layout split caused the right column of compact cards to be clipped by the map at ~1280px viewport width.

## Root Cause

### Bug 1: IntersectionObserver always picks parent over child

The `useActiveSection` hook uses `intersectionRect.height` (visible pixels) to determine the active section. A theme `<section>` wraps its child sub-section `<div>`s, so the parent **always** has more visible pixels than any individual child. The observer never selected a sub-section ID like `"mat-drikke:cafe"` — it always picked `"mat-drikke"`.

### Bug 2: Marker pool only indexed by theme ID

`ReportStickyMap`'s `allPOIs` memo iterated only `poisByTheme[theme.id]` for pre-rendering. Sub-section POIs keyed as `poisByTheme["mat-drikke:cafe"]` were never added to the marker pool, so there were no `<Marker>` elements to toggle visible.

### Bug 3: 50/50 split too tight for 2-column cards

With `w-1/2` (50%) for both panels, the content panel at 1280px had only ~512px for content (after 64px padding on each side). Two compact card columns with images + names + ratings didn't fit.

## Solution

### Fix 1: Sub-section preference in IntersectionObserver

After finding the best section by visible height, add a second pass: if the winner is a theme-level ID (no `:`), scan for its most-visible intersecting sub-section.

```typescript
// useActiveSection.ts — after initial bestId selection
if (bestId !== null && !bestId.includes(":")) {
  const themePrefix = bestId + ":";
  let bestSubHeight = 0;

  for (let i = 0; i < entryList.length; i++) {
    const [id, entry] = entryList[i];
    if (
      id.startsWith(themePrefix) &&
      entry.isIntersecting &&
      entry.intersectionRect.height > bestSubHeight
    ) {
      bestSubHeight = entry.intersectionRect.height;
      bestId = id;
    }
  }
}
```

### Fix 2: Expand marker pool to include sub-section POIs

```typescript
// ReportStickyMap.tsx — allPOIs memo
for (const theme of themes) {
  // Theme-level POIs
  for (const poi of poisByTheme[theme.id] ?? []) { ... }
  // Sub-section POIs (may not overlap with theme-level)
  for (const sub of theme.subSections ?? []) {
    const subKey = `${theme.id}:${sub.categoryId}`;
    for (const poi of poisByTheme[subKey] ?? []) { ... }
  }
}
```

A `seen` Set prevents duplicate markers.

### Fix 3: 60/40 layout split

```diff
-<div className="w-1/2 px-16 min-w-0 overflow-hidden">  // Left
-<div className="w-1/2 pt-16 pr-16 pb-16">              // Right
+<div className="w-[60%] px-16 min-w-0 overflow-hidden"> // Left
+<div className="w-[40%] pt-16 pr-16 pb-16">             // Right
```

### Bonus: INITIAL_VISIBLE_COUNT 6 → 12

Increased compact cards before "Vis meg mer" from 6 to 12 per category.

## Key Gotcha: TypeScript narrowing with `let` in closures

The original observer used `.forEach()` to iterate entries. TypeScript narrows a `let` variable captured in a closure to `never` after the closure, making `bestId.includes(":")` fail to compile. Fix: use indexed `for` loops instead of `.forEach()`.

Also: `Map.entries()` can't be iterated with `for...of` without `downlevelIteration`. Use `Array.from(entries.entries())` with indexed loops.

## Prevention

- **When adding nested DOM sections tracked by IntersectionObserver**: always test that child elements can be selected as "active", not just parents. Parent wrappers will always have more visible pixels.
- **When adding new keying schemes for POI lookups**: verify that ALL consumers of the POI pool (marker rendering, visibility checks, fitBounds) use the new keys.
- **When using 2-column card layouts in a split-panel design**: test at `lg` breakpoint (1024px) and common laptop widths (1280px, 1366px).

## Files Changed

| File | Change |
|------|--------|
| `lib/hooks/useActiveSection.ts` | Sub-section preference after height arbitration |
| `components/variants/report/ReportStickyMap.tsx` | Marker pool includes sub-section POIs |
| `components/variants/report/ReportPage.tsx` | 60/40 layout split |
| `components/variants/report/report-data.ts` | INITIAL_VISIBLE_COUNT = 12 |
