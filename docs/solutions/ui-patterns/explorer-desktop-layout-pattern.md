---
title: "Explorer desktop layout: flush split + map bounds + route reposition"
category: ui-patterns
tags: [mapbox, layout, sidebar, fitBounds, explorer, desktop]
module: explorer
date: 2026-02-02
symptoms:
  - markers clipped at map edges
  - slow zoom animation on POI click
  - sidebar glassmorphism too complex for MVP
---

# Explorer Desktop Layout Pattern

Complete reference for the Explorer map+sidebar desktop layout, map bounds calculation, and route-based repositioning. Use this as a template when building similar map-and-list views (e.g. Trondheim Prisbellone-kartet).

## Architecture Overview

Three files, three concerns:

| File | Responsibility |
|------|----------------|
| `components/shared/ProductNav.tsx` | Top navbar — full-width, white, shared across products |
| `components/variants/explorer/ExplorerPage.tsx` | Page layout — flex split between map and sidebar |
| `components/variants/explorer/ExplorerMap.tsx` | Map behavior — bounds, route fitting, viewport tracking |

## 1. Navbar (`ProductNav.tsx`)

Full-width white navbar with `px-8` padding. No `max-width`, no `mx-auto`.

```tsx
<header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
  <div className="px-8 h-12 flex items-center justify-between">
    {/* Left: Project name */}
    <span className="text-sm font-medium text-[#1a1a1a]">{projectName}</span>
    {/* Center: Product pill toggle (if multiple products) */}
    {/* Right: Share button */}
  </div>
</header>
```

**Key decisions:**
- `bg-white border-b border-gray-200` — matches sidebar styling
- `px-8` — generous padding, no max-width constraint
- `h-12` — compact navbar height

## 2. Desktop Layout (`ExplorerPage.tsx`)

Flex split layout — map takes remaining width, sidebar is flush right panel.

```tsx
{/* Main container: full viewport minus navbar */}
<div className="h-[calc(100vh-3rem)] w-screen relative overflow-hidden bg-white">

  {/* Desktop: flex split — map + flush sidebar */}
  <div className="hidden lg:flex h-full">

    {/* Map: takes remaining width (60%) */}
    <div className="flex-1 relative">
      <ExplorerMap mapPadding={desktopMapPadding} ... />
    </div>

    {/* Sidebar: flush right panel (40%) */}
    <div className="w-[40%] flex-shrink-0 bg-white border-l border-gray-200 overflow-hidden flex flex-col">
      <ExplorerPOIList ... />
      {/* Collection footer at bottom */}
    </div>

  </div>
</div>
```

**Key decisions:**
- `hidden lg:flex` — flex layout only on desktop (lg+), mobile has separate layout
- `flex-1 relative` on map — fills remaining width naturally
- `w-[40%] flex-shrink-0` on sidebar — fixed 40% width, won't shrink
- `bg-white border-l border-gray-200` — clean, simple separator
- Map does NOT extend behind sidebar — true split, not overlay

**What was removed (previously glassmorphism):**
- `absolute top-6 right-6 bottom-6` — was overlaid on map
- `rounded-2xl` — border radius
- `bg-white/90 backdrop-blur-md` — translucent blur
- `border border-white/50 shadow-[-4px_0_24px_rgba(0,0,0,0.06)]` — border and shadow

## 3. Map Padding (`ExplorerPage.tsx`)

Since the map is a flex child (not fullscreen), padding is uniform on all sides:

```tsx
const desktopMapPadding = {
  left: 60,
  top: 60,
  right: 60,
  bottom: 60,
};
```

**Key insight:** When the map was fullscreen with sidebar overlay, `right` needed `window.innerWidth * 0.4` to account for sidebar width. With flex split, the map only occupies its own area, so all sides get equal 60px padding.

## 4. Map Behavior (`ExplorerMap.tsx`)

### Initial bounds (first load)

Fits all POIs with padding, runs once:

```tsx
const hasInitialFitRef = useRef(false);
useEffect(() => {
  if (!mapRef.current || !mapLoaded || !initialBounds || hasInitialFitRef.current) return;
  hasInitialFitRef.current = true;
  mapRef.current.fitBounds(
    [[initialBounds.minLng, initialBounds.minLat],
     [initialBounds.maxLng, initialBounds.maxLat]],
    { padding: mapPadding || 60, duration: 0 }
  );
}, [mapLoaded, initialBounds, mapPadding]);
```

### Route fitting (after POI click)

When a POI is clicked, a route is fetched asynchronously. The map repositions AFTER the route arrives — no immediate zoom on click:

```tsx
useEffect(() => {
  if (!mapRef.current || !mapLoaded || !routeData?.coordinates.length) return;
  const coords = routeData.coordinates;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  mapRef.current.fitBounds(
    [[minLng, minLat], [maxLng, maxLat]],
    { padding: mapPadding || 60, duration: 400, maxZoom: mapRef.current.getZoom() }
  );
}, [routeData, mapLoaded, mapPadding]);
```

**Key decisions:**
- `maxZoom: mapRef.current.getZoom()` — never zoom IN beyond current level, only zoom out if route is larger than viewport
- `duration: 400` — quick reposition, not slow flyTo
- Triggers on `routeData` change, not on `activePOI` change
- No zoom on POI click — only reposition after route is drawn

**What was removed (previously flyTo):**
```tsx
// OLD — removed:
mapRef.current.flyTo({
  center: [poi.coordinates.lng, poi.coordinates.lat],
  zoom: Math.max(mapRef.current.getZoom(), 15),  // forced zoom to 15
  duration: 800,  // slow animation
  padding: mapPadding,
});
```

### Bounds calculation (`ExplorerPage.tsx`)

POI bounds computed with `useMemo` from all base POIs:

```tsx
const poiBounds = useMemo(() => {
  if (basePOIs.length === 0) return undefined;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const poi of basePOIs) {
    if (poi.coordinates.lat < minLat) minLat = poi.coordinates.lat;
    if (poi.coordinates.lat > maxLat) maxLat = poi.coordinates.lat;
    if (poi.coordinates.lng < minLng) minLng = poi.coordinates.lng;
    if (poi.coordinates.lng > maxLng) maxLng = poi.coordinates.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}, [basePOIs]);
```

## 5. POI Click Flow

Complete flow when user clicks a POI:

1. `setActivePOI(poiId)` — state update
2. Route fetch starts (`/api/directions?origin=...&destination=...`)
3. Sidebar expands POI card (image, description, "Vis rute" link)
4. Route data arrives → `setRouteData({ coordinates, travelTime })`
5. `RouteLayer` renders route line + travel time badge on map
6. `fitBounds` effect fires → map repositions to show full route
7. No zoom change if route fits in current viewport

## Gotchas & Lessons

1. **Don't use `flyTo` with forced zoom for POI clicks** — creates slow, jarring animation when zoomed out. Use `fitBounds` on the route instead.
2. **`maxZoom: currentZoom` prevents unnecessary zoom-in** — the map only zooms out to fit the route, never zooms in closer than the user's current view.
3. **Flex split > absolute overlay for MVP** — simpler CSS, no need to calculate sidebar width in map padding, cleaner separation of concerns.
4. **60px uniform padding** is enough to prevent edge-clipping of markers on fitBounds.
5. **`Array.from(new Set(...))` not `[...new Set(...)]`** — TypeScript without `downlevelIteration` flag doesn't support Set spread syntax. This caused a Vercel build failure.

## File References

- `components/shared/ProductNav.tsx` — navbar
- `components/variants/explorer/ExplorerPage.tsx:397-471` — desktop layout + padding
- `components/variants/explorer/ExplorerMap.tsx:81-110` — bounds + route fitting
- `components/variants/explorer/ExplorerPOIList.tsx` — sidebar content
- `components/map/route-layer.tsx` — route line + badge rendering
