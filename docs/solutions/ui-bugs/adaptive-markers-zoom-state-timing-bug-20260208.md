---
module: Explorer, Report
date: 2026-02-08
problem_type: ui_bug
component: frontend_hooks
symptoms:
  - "Adaptive markers stuck in default icon state regardless of zoom level"
  - "data-zoom-state attribute never set on map container"
  - "Labels, rating badges, and dot states never appear"
  - "useMapZoomState hook appears to do nothing"
root_cause: timing_bug
resolution_type: code_fix
severity: high
tags: [map, adaptive-markers, zoom-state, useEffect, timing, hooks, mapbox]
---

# Adaptive Markers Not Activating — useMapZoomState Timing Bug

## Problem

`AdaptiveMarker` components rendered correctly in the DOM but never changed visual state (dot → icon → icon-rating → full-label). All markers stayed in the CSS fallback state (icon only). The `data-zoom-state` attribute was never set on the map container div.

## Root Cause

`useMapZoomState` hook had a classic React ref timing bug:

```typescript
useEffect(() => {
  const map = mapRef.current?.getMap();
  if (!map || !containerRef.current) return; // ← always null at mount
  // ... set data-zoom-state ...
}, [mapRef, containerRef, labelBudget]); // ← refs never change!
```

**The problem:** `useEffect` dependencies were only ref objects (`mapRef`, `containerRef`) which are stable across renders. The effect ran once at mount when `mapRef.current` was still `null` (Mapbox hadn't loaded yet), hit the early return, and never ran again because its dependencies never changed.

## Solution

Added `mapLoaded` as an option that callers pass after the map's `onLoad` fires:

```typescript
// Hook signature
export function useMapZoomState(
  mapRef, containerRef,
  options?: { mapLoaded?: boolean; labelBudget?: number; markerCount?: number }
)

// Caller
const [mapLoaded, setMapLoaded] = useState(false);
useMapZoomState(mapRef, mapContainerRef, { mapLoaded });
// In onLoad callback: setMapLoaded(true)
```

When `mapLoaded` flips to `true`, the effect re-runs and `mapRef.current` is now available.

## Key Lesson

**Never rely solely on ref objects as useEffect dependencies to detect when external resources (maps, canvases, third-party libraries) are ready.** Refs don't trigger re-renders. Always pair with a boolean state signal (`mapLoaded`, `isReady`, etc.) that flips when the resource fires its load callback.

## Label Budget (Dormant Feature)

During this fix, we also implemented label budget logic in the hook:

- When `markerCount > labelBudget` at full-label zoom, sets `data-label-budget-exceeded="true"`
- CSS rules in `globals.css` suppress labels for non-active/hovered markers
- **Currently disabled** (`labelBudget` defaults to `Infinity`)
- **UX decision**: At high POI density (50-80+), full-label state creates unreadable overlap. Hover tooltips are the primary name-discovery mechanism. Label budget can be activated later by passing `{ labelBudget: 15, markerCount: pois.length }`.

## Files Changed

- `lib/hooks/useMapZoomState.ts` — Added `mapLoaded` dependency + label budget logic
- `components/variants/explorer/ExplorerMap.tsx` — Pass `{ mapLoaded }` to hook
- `components/variants/report/ReportInteractiveMap.tsx` — Added `mapLoaded` state + pass to hook
