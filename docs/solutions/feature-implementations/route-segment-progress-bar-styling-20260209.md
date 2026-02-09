---
title: Route Segment Active/Inactive Styling (Progress Bar)
date: 2026-02-09
tags:
  - mapbox
  - route-visualization
  - data-driven-styling
  - trip-progress
  - geojson
category: feature-implementations
module: Trip Guide / Map Visualization
symptoms:
  - Single monolithic route line with no progress indication
  - All route segments look identical regardless of trip progress
  - No visual distinction between completed, current, and upcoming legs
  - Map does not communicate navigation state
related_files:
  - components/map/route-layer.tsx
  - components/variants/trip/TripPage.tsx
  - components/variants/trip/TripMap.tsx
related_docs:
  - docs/solutions/architecture-patterns/placy-guide-mobile-prototype.md
  - docs/solutions/ui-patterns/trip-desktop-accordion-sidebar-20260209.md
  - docs/solutions/ui-bugs/adaptive-markers-zoom-state-timing-bug-20260208.md
---

# Route Segment Active/Inactive Styling (Progress Bar)

## Problem

Trip maps rendered the entire route as a single bold blue line. All segments looked identical regardless of which stop the user was at or which stops had been completed. This gave no sense of progress and was visually noisy.

## Root Cause

The `RouteLayer` component received a single `coordinates: [number, number][]` array from the Mapbox Directions API and rendered it as one `LineString` feature. Mapbox paint properties applied uniformly — there was no way to style individual legs differently because the route was one monolithic feature.

The `currentStopIndex` and `completedStops` state existed in `TripPage` but were never translated into route geometry that Mapbox could conditionally style.

## Solution

Split the single route into per-leg segments, each as a separate GeoJSON Feature with an `active` property. Use Mapbox data-driven expressions to style active vs inactive segments differently.

### 1. Client-Side Waypoint Matching (TripPage.tsx)

Find the closest route coordinate index for each stop using forward-only search:

```typescript
const indices: number[] = [];
for (const stop of stops) {
  let minDist = Infinity;
  let minIdx = indices.length > 0 ? indices[indices.length - 1] : 0;
  const searchStart = indices.length > 0 ? indices[indices.length - 1] : 0;

  for (let i = searchStart; i < coords.length; i++) {
    const dx = coords[i][0] - stop.coordinates.lng;
    const dy = coords[i][1] - stop.coordinates.lat;
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }
  indices.push(minIdx);
}
```

Forward-only search ensures monotonic index progression — each stop maps to a later point on the route than the previous one.

### 2. Segment Building with Progress-Bar Logic

```typescript
for (let i = 0; i < indices.length - 1; i++) {
  const start = indices[i];
  const end = indices[i + 1];
  if (end > start) {
    segments.push({
      coordinates: coords.slice(start, end + 1),
      active: i <= currentStopIndex || completedStops.has(i),
    });
  }
}
```

A segment is **active** if:
- `i <= currentStopIndex` — at or before current position (forward progress)
- `completedStops.has(i)` — start stop was marked visited (retains active state even if user navigates backwards)

### 3. Data-Driven Mapbox Expressions (route-layer.tsx)

Helper that reads the `active` property from each GeoJSON feature:

```typescript
const activeExpr = (active: string | number, inactive: string | number): Expression =>
  ["case", ["get", "active"], active, inactive] as Expression;
```

Applied across three layers:

| Layer | Property | Active | Inactive |
|-------|----------|--------|----------|
| **Glow** | width | 14 | 8 |
| | opacity | 0.25 | 0.08 |
| **Casing** | width | 8 | 5 |
| | opacity | 1 | 0.5 |
| **Main line** | color | #3b82f6 | #93c5fd |
| | width | 5 | 3 |
| | opacity | 1 | 0.4 |

### 4. Backward Compatibility

When no `segments` prop is provided, `RouteLayer` falls back to single-line mode (all active). Non-trip routes (Explorer, Report) are unaffected.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Client-side waypoint matching (no API change) | Mapbox Directions API already returns combined coordinates; splitting client-side avoids touching the API proxy |
| Squared Euclidean distance | Avoids `Math.sqrt` for ~1000+ coordinate comparisons; relative ordering is preserved |
| Forward-only search | Route is sequential; prevents matching to a coordinate from a different leg |
| `coords.slice(start, end + 1)` overlap | End coordinate of segment N = start of segment N+1, ensuring no visual gaps |
| Mapbox expressions over React state | Styling computed by GPU at render time; no React re-renders when active segment changes |

## Prevention / Reuse

- **Pattern**: Any multi-segment route visualization can reuse `RouteSegment[]` + `activeExpr` approach
- **Gotcha**: The `as unknown as number` casts are needed because react-map-gl types expect literal numbers for paint properties, but Mapbox GL JS accepts expressions at runtime
- **Testing**: Verify with trips of 2, 3, 7+ stops. Edge cases: first stop active, last stop active, navigating backwards after completing stops
