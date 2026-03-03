---
title: "Report unified POI card grid"
date: 2026-03-03
tags: [report, poi-cards, grid, lazy-loading, css]
category: ui-patterns
module: components/variants/report
symptoms:
  - Two different POI card formats (highlight cards + compact rows) in Report
  - Visual inconsistency between editorial and functional theme sections
  - Compact rows not scannable enough
---

# Report Unified POI Card Grid

## Problem

Report had two POI card formats: large highlight cards (ReportPOICard, ~180px horizontal scroll) for top 3 POIs, and compact 2-column rows (ReportPOIRow, ~52px) for the rest. This created visual inconsistency and the compact rows were hard to scan.

## Solution

Unified all POIs to use `ReportPOICard` in a responsive grid:
- Desktop: `grid-cols-3` (3 columns)
- Mobile: `grid-cols-2` (2 columns)
- Show 6 cards initially per section, "Hent flere (N)" for the rest

## Key Deletions

- `ReportPOIRow` — compact row component (inline in ReportThemeSection.tsx)
- `CompactPOIList` — two-column interleaved grid
- `pickHighlights()` — highlight selection logic
- `CATEGORY_DISPLAY_MODE` — editorial/functional distinction for card rendering
- `ThemeDisplayMode` type
- `HIGHLIGHT_FALLBACK_COUNT` constant

## Data Model Change

Before:
```typescript
interface ReportTheme {
  highlightPOIs: POI[];  // top 3 featured
  listPOIs: POI[];       // visible compact
  hiddenPOIs: POI[];     // behind load-more
  displayMode: ThemeDisplayMode;
}
```

After:
```typescript
interface ReportTheme {
  pois: POI[];          // first 6, sorted by tier+score
  hiddenPOIs: POI[];    // behind load-more
}
```

## Gotchas

### 1. Multiple consumers of data model
`ReportStickyMap` and `ReportInteractiveMapSection` both read `highlightPOIs`/`listPOIs` to determine which markers to show on the map. When changing the data model, update ALL consumers.

### 2. Mobile uses separate rendering path
Desktop uses `StickyMapContent` → `POICardGrid` → `ReportPOICard`.
Mobile uses `ReportInteractiveMapSection` → `ReportHighlightCard`.
These are completely separate code paths — changes to one don't affect the other.

### 3. PageTransition transform breaks position:fixed
`PageTransition` sets `transform: translateY(0)` after its animation, which creates a CSS containing block. This breaks `position: fixed` for any descendant (like FloatingNav). Fix: clear `el.style.transform = ""` after the transition ends via `transitionend` event.

### 4. INITIAL_VISIBLE_COUNT change (12 → 6)
Reduced from 12 to 6 because big cards take ~3x more vertical space than compact rows. Two rows of 3 = 6 cards gives similar visual density to the old 12 compact rows.
