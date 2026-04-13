---
module: Event Route / Explorer
date: 2026-04-13
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Map markers invisible on /event/ route (pins missing)"
  - "116 markers exist in DOM but have no visible size"
  - "Mapbox marker width: 937px instead of 38px"
  - "Same data and components work correctly on /eiendom/ route"
root_cause: config_error
resolution_type: config_change
severity: high
tags: [mapbox, nextjs-layout, css-cascade, map-markers, route-setup]
---

# Troubleshooting: Mapbox Markers Invisible on New Route

## Problem
When creating a new Next.js route that uses Mapbox (Explorer component), the map
markers became invisible — pins that worked perfectly on `/eiendom/` disappeared
on the new `/event/` route, even though the same component and data were used.

## Environment
- Module: `/event/[customer]/[project]` route (new Coachella demo)
- Next.js version: 14 (App Router)
- Affected Component: ExplorerPage + Mapbox GL JS via react-map-gl
- Date: 2026-04-13

## Symptoms
- Map loaded correctly and showed the correct area (Empire Polo Club)
- Sidebar listed all 57 POIs with correct travel times
- Categories, filtering, and dropdowns all worked
- **Zero pins visible on the map itself**
- Console showed no errors
- `document.querySelectorAll('.mapboxgl-marker').length` returned 116 (markers existed)
- Inspecting marker styles revealed `width: 937.805px` (full map width)
- Same URL under `/eiendom/goldenvoice/coachella-2026` showed pins correctly

## What Didn't Work

**Attempted Solution 1:** Checked `showSkeleton`/`loadState` state machine
- **Why it failed:** State machine ran correctly — `loadState` transitioned to "loaded"
  even with `useDirectDistance` enabled (no Mapbox API calls).

**Attempted Solution 2:** Verified POI data flow from migration → query → ExplorerPage
- **Why it failed:** POIs arrived correctly. `filteredPOIs.length === 57`. Travel
  times worked. Nothing in the data layer was wrong.

**Attempted Solution 3:** Compared `mapProps` between working and broken routes
- **Why it failed:** Props were identical. `pois`, `activeCategories`, `center`
  were all passed correctly.

**Key breakthrough:** Used DevTools to inspect actual rendered marker elements
and discovered the `.mapboxgl-marker` container was `937px` wide instead of `38px`.

## Solution

Create a parent layout file that loads Mapbox's stylesheet:

```tsx
// app/event/layout.tsx
export default function EventLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
```

This mirrors `app/eiendom/layout.tsx` which already does the same thing for
the Eiendom route tree.

## Why This Works

Mapbox GL JS requires its stylesheet (`mapbox-gl.css`) for correct marker
rendering. Without this CSS:

1. The `.mapboxgl-marker` class has **no width/height constraint** — it inherits
   from its container (the map canvas, which is ~937px wide).
2. Each marker has `transform: translate(-50%, -50%)` to center it on its
   coordinates. With a 937px width, this means the marker's center is offset
   by ~468px from the actual coordinate.
3. All 116 markers overlap, each spanning the entire map width, making them
   visually indistinguishable from the map background.
4. The inner `<button>` elements (the actual colored circles) were 38px wide
   and styled correctly — but they were centered inside a 937px parent, so they
   all rendered at vastly shifted positions.

Next.js layout.tsx files are only scoped to their route tree. Since
`app/event/` is a sibling of `app/eiendom/`, it does NOT inherit the CSS link
from `app/eiendom/layout.tsx`. A new route tree that uses Mapbox needs its
own parent layout loading the CSS.

## Prevention

- **When creating any new route tree that uses Mapbox**, add a `layout.tsx`
  at the route group level that loads `mapbox-gl.css`.
- Currently required in: `app/eiendom/layout.tsx`, `app/for/layout.tsx`,
  `app/admin/layout.tsx`, `app/kart/layout.tsx`, `app/event/layout.tsx`.
- **Consider centralizing** — load `mapbox-gl.css` in the root layout
  (`app/layout.tsx`) to avoid this trap for future routes. Trade-off: loads on
  every page, not just map pages.
- **Debug signal**: If Mapbox renders the map tiles correctly but markers
  behave strangely (invisible, mispositioned, wrong size), suspect missing
  `mapbox-gl.css` before looking at data flow.

## Related Issues

- See also: [adaptive-markers-zoom-state-timing-bug-20260208.md](./adaptive-markers-zoom-state-timing-bug-20260208.md) —
  different marker issue, but same component (AdaptiveMarker + Mapbox).
