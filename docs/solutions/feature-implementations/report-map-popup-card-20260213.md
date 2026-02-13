---
title: Report Map Popup Card — POI Detail on Map Marker
date: 2026-02-13
category: feature-implementations
tags: [report, mapbox, popup, marker, react-map-gl, bidirectional-sync]
module: components/variants/report
symptoms:
  - Accordion expand in card list felt heavy and disconnected from the map
  - Users had to look at two places (list and map) without clear connection
  - 60/40 layout wasted map space
---

# Report Map Popup Card

## Problem

The Report view showed POI details via an accordion expand within the card list. This was disconnected from the map — clicking a card highlighted a marker, but the actual detail content appeared far from the marker in the list panel. The 60/40 content/map split also underutilized the map.

## Solution

Replace the accordion with a **popup card rendered directly over the marker on the map**. Change layout to 50/50 to give the map more room for the popup content.

### Architecture

```
ReportPage (state owner)
├── ReportThemeSection (compact card list, left panel)
│   └── ReportPOIRow (click → setActivePOI({source:"card"}))
└── ReportStickyMap (right panel)
    ├── Marker pool (all POIs, opacity-toggled)
    ├── MapPopupCard (rendered as Marker child at active POI coords)
    └── Map onClick → clear activePOI
```

### Key Design Decisions

1. **Popup as Marker child** — `react-map-gl` Marker component positions the popup at the correct lat/lng automatically. No manual coordinate-to-pixel conversion needed.

2. **Bidirectional interaction via source discriminator:**
   - `{ poiId, source: "card" }` → map flyTo + show popup
   - `{ poiId, source: "marker" }` → scroll to card + show popup (no flyTo)

3. **On-demand data fetching** — Opening hours fetched from `/api/places/{googlePlaceId}` only when a popup opens. Single useEffect with AbortController for proper cleanup on POI switch.

4. **O(1) POI lookup** — `poiById` Record instead of `allPOIs.find()` in render path. Important with 297+ POIs.

### What Was Removed

- Accordion expand from ReportPOIRow (-278 lines)
- Per-row opening hours fetch, realtime transit data, expanded content
- Chevron expand/collapse indicator

### What Was Kept in Card Rows

- Compact header: thumbnail, name, tier badge, category, rating, walk time
- Click handler → `onPOIClick(poi.id)`
- Active state styling (`bg-[#f0ede8] border-[#d4cfc8]`)
- `data-poi-id` attribute for scroll-to-card

## Code Review Findings & Fixes

1. **Race condition in dual useEffects** — Two effects with different deps (`poi.id` vs `poi.googlePlaceId`) shared a `fetchedRef`, causing missed fetches when switching POIs with same placeId. Fixed: single merged effect with AbortController.

2. **CSS selector injection** — `querySelector(`[data-poi-id="${poiId}"]`)` was vulnerable if poiId contained special chars. Fixed: `CSS.escape(poiId)`.

3. **IIFE in JSX** — Popup rendering used `{activePOI && (() => { ... })()}` pattern. Replaced with derived `popupPOI` variable and `handlePopupClose` useCallback.

## Files Changed

| File | Change |
|------|--------|
| `MapPopupCard.tsx` | **NEW** — popup card with image, editorial, hours, actions |
| `ReportPage.tsx` | Layout 50/50, onMapClick, CSS.escape |
| `ReportStickyMap.tsx` | Popup rendering, poiById, handlePopupClose |
| `ReportThemeSection.tsx` | Removed accordion from ReportPOIRow |

## Gotchas

- **Mapbox `Map` import conflict:** Don't use `new Map<K,V>()` in files that import `Map` from `react-map-gl/mapbox`. Use `Record<string, T>` instead.
- **Marker offset:** Popup Marker needs `offset={[0, -20]}` and `anchor="bottom"` to appear above the actual POI marker, not on top of it.
- **pointer-events:** Popup card needs `pointer-events: auto` for clicks to work (Marker children default to `pointer-events: none` in some setups).
