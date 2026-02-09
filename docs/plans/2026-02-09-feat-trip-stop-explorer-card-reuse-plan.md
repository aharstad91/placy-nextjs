---
title: "feat: Reuse Explorer POI card in Trip stop panel"
type: feat
date: 2026-02-09
---

# feat: Reuse Explorer POI card in Trip stop panel

## Overview

Replace the minimal Trip stop detail view (just name, category, distance, and "Merk som besøkt" button) with the rich ExplorerPOICard component that shows hero image, editorial hook, rating, opening hours, realtime transit data, Google Maps links, and address. The "Lagre" button should be hidden in trip context.

## Problem Statement

The Explorer product shows a rich, informative POI card (image, editorial hook, rating, opening hours, transit departures, bike share, action links). The Trip product shows the exact same POIs but with a stripped-down view showing only name, category, and a distance badge. Users lose valuable information when viewing a stop on a trip — they can't see opening hours, get directions, or read the editorial context.

## Proposed Solution

Refactor `ExplorerPOICard` to accept optional props that control which features are visible, then use it inside both `TripStopPanel` (mobile bottom sheet) and `TripStopList` (desktop accordion). Keep the trip-specific controls (prev/next navigation, "Merk som besøkt" GPS verification button) as a separate footer below the reused card.

### Architecture: Wrapper Approach

Rather than adding many conditional props to ExplorerPOICard, create a **`TripStopDetail`** wrapper component that:
1. Renders `ExplorerPOICard` in always-expanded mode (no collapsed state needed)
2. Hides the "Lagre" button by simply not passing `onToggleCollection`
3. Adds trip-specific UI below: transition text, navigation arrows, mark-complete button

## Technical Approach

### What ExplorerPOICard already supports

The card already conditionally hides the "Lagre" button when `onToggleCollection` is not provided — the button only renders `{onToggleCollection && (...)}`. So **no changes needed** to hide it.

The card uses `isActive` to toggle between collapsed and expanded state. For trip usage, we always want the expanded view.

### Changes Needed

#### 1. ExplorerPOICard — Minor Props Addition

`components/variants/explorer/ExplorerPOICard.tsx`

Add optional props:
- `alwaysExpanded?: boolean` — skip collapsed state, always show expanded view
- `hideChevron?: boolean` — hide the collapse/expand chevron indicator
- `className?: string` — allow parent to control wrapper styling

When `alwaysExpanded` is true:
- Don't render the collapsed state at all
- Don't render the clickable role="button" wrapper (no onClick needed)
- The expanded content is always visible

```typescript
interface ExplorerPOICardProps {
  poi: POI;
  isActive: boolean;
  onClick?: () => void;              // Make optional (not needed when always expanded)
  openingHours?: OpeningHoursData;
  travelTimesLoading?: boolean;
  travelMode?: TravelMode;
  isInCollection?: boolean;
  onToggleCollection?: (poiId: string) => void;
  // New props
  alwaysExpanded?: boolean;
  hideChevron?: boolean;
  className?: string;
}
```

#### 2. New Component: TripStopDetail

`components/variants/trip/TripStopDetail.tsx`

Thin wrapper that composes:
1. `ExplorerPOICard` (always expanded, no save button)
2. Trip-specific transition text (from stopConfig)
3. Navigation + mark-complete buttons (existing logic from TripStopPanel)

```typescript
interface TripStopDetailProps {
  stop: POI;
  stopConfig?: TripStopConfig;
  stopIndex: number;
  totalStops: number;
  isCompleted: boolean;
  isFirstStop: boolean;
  isLastStop: boolean;
  distanceToStop?: number | null;
  userPosition?: Coordinates | null;
  gpsAvailable?: boolean;
  onNext: () => void;
  onPrev: () => void;
  onMarkComplete: (gpsVerified: boolean, accuracy?: number, coords?: Coordinates) => void;
}
```

#### 3. Update TripStopPanel (Mobile)

`components/variants/trip/TripStopPanel.tsx`

Replace the custom stop info rendering with `TripStopDetail`. The progress dots and overall structure stay. The navigation buttons move into TripStopDetail.

#### 4. Update TripStopList (Desktop Accordion)

`components/variants/trip/TripStopList.tsx`

In accordion mode, replace the expanded content section with `TripStopDetail`. The collapsed list item appearance stays unchanged. Only the expanded state body changes.

### Data Requirements

ExplorerPOICard uses two optional data sources that TripPage doesn't currently provide:
- `openingHours?: OpeningHoursData` — from `useOpeningHours` hook
- `travelMode?: TravelMode` — hardcoded as `"walk"` for trips is fine

**Opening hours:** The `useOpeningHours` hook is already used in ExplorerPage. We need to call it in TripPage for the current stop's `googlePlaceId`. This is a single API call per stop, not a bulk fetch.

**Realtime data (Entur/Bysykkel):** ExplorerPOICard already handles this internally via `useRealtimeData(isActive ? poi : null)`. It only fetches when `isActive` is true. No changes needed.

**Trip cross-references:** ExplorerPOICard fetches these via `/api/poi-trips`. This is fine to keep — it adds useful context showing which other trips include this POI.

## Acceptance Criteria

- [x] Trip mobile bottom sheet shows rich POI card (image, editorial hook, rating, hours, actions)
- [x] Trip desktop accordion shows same rich POI card in expanded state
- [x] "Lagre" button is not visible in trip context
- [x] "Vis rute" and "Google Maps" action links work correctly
- [x] Opening hours show for POIs that have Google Places data
- [x] Realtime transit/bike data appears when available
- [x] Trip-specific controls preserved: prev/next navigation, "Merk som besøkt" with GPS verification
- [x] Transition text from trip config still shows between card and controls
- [x] Collapsed accordion state unchanged (thumbnail, name, category)
- [x] Explorer product behavior unchanged (regression-free)

## Implementation Steps

- [x] **Step 1:** Add `alwaysExpanded`, `hideChevron`, `className` props to `ExplorerPOICard`
  - When `alwaysExpanded=true`, skip collapsed state and always render expanded
  - When `onClick` not provided, don't add role="button" or click handler
  - File: `components/variants/explorer/ExplorerPOICard.tsx`

- [x] **Step 2:** Create `TripStopDetail` wrapper component
  - Composes ExplorerPOICard (alwaysExpanded, no onToggleCollection) + trip controls
  - Owns GPS verification state machine (extracted from TripStopPanel/TripStopList)
  - File: `components/variants/trip/TripStopDetail.tsx`

- [x] **Step 3:** Add `useOpeningHours` for current stop in TripPage
  - Single-POI fetch, only for the active stop
  - Pass through to TripStopPanel/TripStopList
  - File: `components/variants/trip/TripPage.tsx`

- [x] **Step 4:** Update TripStopPanel to use TripStopDetail
  - Keep progress dots, swap stop info + nav buttons with TripStopDetail
  - File: `components/variants/trip/TripStopPanel.tsx`

- [x] **Step 5:** Update TripStopList accordion to use TripStopDetail
  - Keep collapsed state, swap expanded content with TripStopDetail
  - File: `components/variants/trip/TripStopList.tsx`

- [x] **Step 6:** Verify Explorer product is unaffected
  - ExplorerPOICard default behavior (no alwaysExpanded) must be identical
  - TypeScript check: `npx tsc --noEmit`

## Files Affected

| File | Change |
|------|--------|
| `components/variants/explorer/ExplorerPOICard.tsx` | Add alwaysExpanded, hideChevron, className props |
| `components/variants/trip/TripStopDetail.tsx` | **NEW** — wrapper composing ExplorerPOICard + trip controls |
| `components/variants/trip/TripStopPanel.tsx` | Simplify to use TripStopDetail |
| `components/variants/trip/TripStopList.tsx` | Use TripStopDetail in accordion expanded state |
| `components/variants/trip/TripPage.tsx` | Add useOpeningHours for current stop, pass through |

## References

- `components/variants/explorer/ExplorerPOICard.tsx` — Source component to reuse
- `components/variants/trip/TripStopPanel.tsx:155-308` — Current mobile trip panel
- `components/variants/trip/TripStopList.tsx:217-471` — Current desktop accordion
- `docs/solutions/ui-patterns/trip-desktop-accordion-sidebar-20260209.md` — Accordion pattern docs
- `docs/solutions/ux-improvements/active-poi-card-pinned-sidebar-20260208.md` — Pinned active POI pattern
