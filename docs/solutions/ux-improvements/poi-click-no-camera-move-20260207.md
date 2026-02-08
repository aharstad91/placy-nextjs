---
module: Explorer
date: 2026-02-07
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Map camera moves and zooms on every POI marker click, breaking user's visual context"
  - "User loses their current viewport position when clicking a marker"
  - "fitBounds runs on both map marker clicks and list card clicks with no distinction"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [map, marker-click, camera, fitbounds, ux, viewport, explorer]
---

# POI Click: No Camera Movement on Map Marker, Keep fitBounds on List Click

## Problem
When clicking a POI marker on the Explorer map, `fitBounds()` fired automatically to show the full route between origin and destination. This broke the user's visual context — they lost their current zoom level and position. The same behavior applied to both map marker clicks and sidebar list card clicks, when only list clicks should trigger camera repositioning.

## Environment
- Module: Explorer
- Stack: Next.js 14, react-map-gl/mapbox, Zustand
- Affected Components: `ExplorerMap.tsx`, `ExplorerPage.tsx`, `route-layer.tsx`
- Date: 2026-02-07

## Symptoms
- Clicking any POI marker on the map triggers `fitBounds()` animation (400ms)
- Map pans and potentially zooms out to show the full route
- User loses their carefully positioned viewport
- No distinction between "click on map" vs "click on sidebar card"

## What Didn't Work
**Direct solution:** The problem was identified and fixed on the first attempt through a two-part approach.

## Solution

### Part 1: Conditional fitBounds via `fitRoute` prop

Added a `fitRoute` boolean state to `ExplorerPage.tsx` that tracks the click source:

```typescript
// ExplorerPage.tsx
const [fitRoute, setFitRoute] = useState(false);

// List click — fit map to show route
const handlePOIClick = useCallback((poiId: string) => {
  setActivePOI((prev) => (prev === poiId ? null : poiId));
  setFitRoute(true);
}, []);

// Map marker click — no camera movement
const handleMapPOIClick = useCallback((poiId: string) => {
  setActivePOI((prev) => (prev === poiId ? null : poiId));
  setFitRoute(false);
  setHighlightedPOI(poiId);
  setTimeout(() => setHighlightedPOI(null), 2000);
}, []);
```

The `fitBounds` effect in `ExplorerMap.tsx` checks `fitRoute` before executing:

```typescript
// ExplorerMap.tsx
useEffect(() => {
  if (!fitRoute || !mapRef.current || !mapLoaded || !routeData?.coordinates.length || !activePOI) return;
  // ... fitBounds logic
}, [fitRoute, routeData, mapLoaded, mapPadding, activePOI]);
```

### Part 2: Travel time badge at destination instead of midpoint

Moved the travel time badge from the route midpoint to the destination (clicked POI), so users always see travel info near the marker even when zoomed in:

```typescript
// route-layer.tsx — Before:
const midpoint = useMemo(() => {
  const [start, end] = [coordinates[0], coordinates[coordinates.length - 1]];
  return { lng: (start[0] + end[0]) / 2, lat: (start[1] + end[1]) / 2 };
}, [coordinates]);
// anchor="center"

// After:
const endpoint = useMemo(() => {
  const last = coordinates[coordinates.length - 1];
  return { lng: last[0], lat: last[1] };
}, [coordinates]);
// anchor="bottom-left" (offset from POI marker)
```

## Why This Works

1. **Two click handlers already existed** (`handlePOIClick` for list, `handleMapPOIClick` for map) — the distinction was already in the code but not used for camera control
2. **`fitRoute` prop** cleanly separates intent: list clicks need context-setting (show full route), map clicks don't (user is already looking at the map)
3. **Badge at endpoint** ensures travel time is visible regardless of zoom — the user sees the path extending from somewhere and the duration near the POI, intuitively understanding they can zoom out to see the full route

## Prevention

- When adding map camera behaviors, always consider whether the trigger is from the map itself (user has visual context) vs an external UI element (user may need context-setting)
- Use a prop/state flag to distinguish click sources rather than removing camera behavior entirely
- Place informational overlays (badges, labels) near the point of interaction, not at arbitrary positions that may be off-screen

## Related Issues
- See also: [explorer-desktop-layout-pattern.md](../ui-patterns/explorer-desktop-layout-pattern.md)
