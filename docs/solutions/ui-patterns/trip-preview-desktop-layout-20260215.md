---
title: Trip Preview Desktop Layout — Dual-Render with Sticky Map
category: ui-patterns
module: Trip
tags: [responsive, desktop, sticky-map, dual-render, tailwind]
date: 2026-02-15
severity: medium
---

# Trip Preview Desktop Layout

## Problem
TripPreview.tsx had only a mobile-optimized single-column layout. On desktop (1440px), the page looked like a stretched mobile view — full-width hero, tiny inline map, wasted horizontal space.

## Solution
Added a desktop layout using the established dual-render pattern (lg:hidden + hidden lg:block) with a 50/50 content/map split following ReportPage's sticky map pattern.

### Desktop Layout Structure
```
┌──────────────────────────────────────────┐
│  Hero (full-width, h-[400px])            │
│  Metadata stripe (px-16)                 │
├───────────────────┬──────────────────────┤
│  Content (50%)    │  Sticky Map (50%)    │
│  px-16            │  top-20              │
│  Description      │  h-[calc(100vh-     │
│  Stop list        │    5rem-4rem)]       │
│  Reward teaser    │  rounded-2xl         │
│  CTA button       │                      │
└───────────────────┴──────────────────────┘
```

### Key Pattern: Shared Sub-Components
Extracted `HeroImage`, `HeroOverlay` as shared sub-components used in both mobile and desktop. Shared JSX fragments (`metadataItems`, `rewardTeaser`) as variables to eliminate duplication.

### Key Pattern: PreviewStopCard `desktop` Prop
Rather than separate components, added a `desktop?: boolean` prop to control:
- Thumbnail size: `w-14 h-14` (mobile) → `w-20 h-20` (desktop)
- Text clamp: `line-clamp-2` (mobile) → `line-clamp-3` (desktop)
- Title size: `text-sm` (mobile) → `text-base` (desktop)

## Gotchas

### 1. Use Established Sticky Map Values
Always use `sticky top-20 h-[calc(100vh-5rem-4rem)]` — this is the standard across ReportPage and GuideMapLayout. Don't invent new values.

### 2. Add max-w-[1920px] mx-auto
Prevents ultrawide stretching on large monitors. Found in cross-product reuse guide.

### 3. Dual Map Rendering is Acceptable
Both mobile and desktop sections include TripPreviewMap. The hidden instance's container has `display: none` (zero dimensions), so Mapbox GL doesn't initialize tiles. The only cost is a duplicate `/api/directions` fetch — same tradeoff as TripPage and ExplorerPage.

### 4. Don't Use useMediaQuery for Layout Switching
It breaks SSR (server doesn't know viewport size) and causes a flash of wrong layout. The Tailwind `hidden`/`lg:hidden` pattern is the established approach.

### 5. Desktop CTA is Not Sticky
On desktop the CTA button is in normal document flow, not sticky. Sticky CTA is a mobile pattern (limited viewport). On desktop, users scroll through all stops before clicking "Start turen".

## Reference Files
- `components/variants/trip/TripPreview.tsx` — The implementation
- `components/variants/report/ReportPage.tsx` — Reference for 50/50 split + sticky map
- `components/variants/explorer/ExplorerPage.tsx` — Reference for dual-render pattern
