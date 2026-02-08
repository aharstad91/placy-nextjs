---
title: "feat: Adaptive Zoom-Based Map Markers + Illustrated Map Style"
type: feat
date: 2026-02-08
brainstorm: docs/brainstorms/2026-02-08-adaptive-markers-map-style-brainstorm.md
tech-audit: 2026-02-08 — YELLOW verdict, 12 mitigations applied
---

# feat: Adaptive Zoom-Based Map Markers + Illustrated Map Style

## Overview

Implement zoom-adaptive markers that progressively reveal information as users zoom in, combined with a softer illustrated map style. Markers transition through four states (Dot → Icon → Icon+Rating → Full Label) with smooth CSS transitions. Built as a shared `AdaptiveMarker` component for Explorer and Report products.

## Problem Statement

Current markers are static — always the same `w-8 h-8` circle regardless of zoom level. At low zoom, this creates visual clutter with overlapping markers. At high zoom, markers show too little information despite available screen real estate. The current map style (`streets-v12`) is generic and doesn't match the warm, inviting brand identity Placy aims for.

## Proposed Solution

### Architecture

A new `AdaptiveMarker` component that:
1. Wraps `react-map-gl/mapbox` `<Marker>` internally — a true drop-in replacement
2. Pre-renders all visual elements with CSS opacity toggling (GPU-composited, zero DOM mutations during zoom)
3. Responds to zoom state via CSS descendant selectors on the map container — zero React re-renders on zoom
4. Replaces inline marker rendering in ExplorerMap and ReportInteractiveMap

### Zoom State Mapping

| State | Zoom Range | Visual | Size |
|-------|-----------|--------|------|
| **dot** | < 11 | Category-colored circle | 8px visual, 24px tap target |
| **icon** | 11 – 12.99 | Category circle + white Lucide icon | 28px |
| **icon-rating** | 13 – 14.99 | Icon + green rating badge | 28px + 18px badge |
| **full-label** | ≥ 15 | Icon + rating + name + category text | 36px icon + label |

Breakpoints are lower-bound inclusive: zoom ≥ 11 enters `icon` state. Upper bounds are exclusive: zoom 13.0 enters `icon-rating`, not `icon`.

### Component API

```typescript
// components/map/adaptive-marker.tsx

interface AdaptiveMarkerProps {
  poi: POI;
  isActive?: boolean;
  isHovered?: boolean;
  onClick?: () => void;  // stopPropagation handled internally
  onHover?: (hovering: boolean) => void;
  zIndex?: number;
  children?: ReactNode; // Product-specific overlays (sparkle badge, info pill, etc.)
}
```

**Key design decisions:**
- **No `zoomState` prop** — zoom state is handled via CSS container `data-zoom-state` attribute on the map wrapper. This eliminates mass React re-renders when all markers cross a zoom threshold.
- **Wraps `<Marker>`** — component renders its own `react-map-gl/mapbox` `<Marker>` using `poi.coordinates` for positioning. Consumers don't need their own `<Marker>` wrapper.
- **Simple `onClick`** — `e.originalEvent.stopPropagation()` is called internally; consumers receive a clean `() => void` callback.
- **`<button>` element** — wraps visual content in `<button>` for accessibility, with `aria-label="{poi.name}, {poi.category.name}"`.
- **Hover state is lifted** — `isHovered`/`onHover` allow the parent to manage single-hover state (only one marker hovered at a time). Hover state is NOT managed inside AdaptiveMarker.
- **Tooltip rendering is NOT part of AdaptiveMarker** — tooltips are product-specific (Explorer has travel time + rating; Report has none). Render tooltips in the consuming component, not in the shared marker.

### Zoom State via CSS Container (Performance-Critical)

Instead of passing `zoomState` as a prop to each marker (which causes 100 React re-renders on every zoom boundary crossing), the zoom state is applied as a `data-zoom-state` attribute on the map wrapper div via a ref:

```typescript
// lib/hooks/useMapZoomState.ts
"use client";

export type ZoomState = "dot" | "icon" | "icon-rating" | "full-label";

export function useMapZoomState(
  mapRef: React.RefObject<MapRef | null>,
  containerRef: React.RefObject<HTMLDivElement | null>
): void {
  // Listens to native Mapbox GL `zoom` event via mapRef.getMap()
  // Writes data-zoom-state to containerRef.current (DOM attribute, no React state)
  // Uses ref-based guard to skip writes when state hasn't changed
  // Default: "full-label" (ExplorerMap starts at zoom 15, Report at zoom 14)
  // Cleanup: removes event listener on unmount
}
```

```css
/* CSS descendant selectors handle all visibility — zero React re-renders */
.adaptive-marker .icon-circle { opacity: 0; transition: opacity 150ms ease-out; }
.adaptive-marker .rating-badge { opacity: 0; transition: opacity 150ms ease-out; }
.adaptive-marker .name-label { opacity: 0; transition: opacity 150ms ease-out; }

[data-zoom-state="icon"] .adaptive-marker .icon-circle { opacity: 1; }
[data-zoom-state="icon-rating"] .adaptive-marker .icon-circle,
[data-zoom-state="icon-rating"] .adaptive-marker .rating-badge { opacity: 1; }
[data-zoom-state="full-label"] .adaptive-marker .icon-circle,
[data-zoom-state="full-label"] .adaptive-marker .rating-badge,
[data-zoom-state="full-label"] .adaptive-marker .name-label { opacity: 1; }
```

**Why this approach:**
- Crossing a zoom boundary (e.g., 12.99 → 13.01) writes one DOM attribute. The browser's CSS engine handles the rest in a single style recalc pass — orders of magnitude faster than 100 React component re-renders.
- `React.memo` on AdaptiveMarker now only guards against `isActive`/`isHovered` changes (1-2 markers at a time), which is its intended use case.

## Technical Approach

### Phase 1: AdaptiveMarker Component + Hook + Utilities

**Files to create:**
- `components/map/adaptive-marker.tsx` — The shared marker component
- `lib/hooks/useMapZoomState.ts` — Zoom state via DOM attribute (no React state)
- `lib/utils/map-icons.ts` — Shared `getIcon()` utility (currently duplicated in 3+ files)
- `lib/themes/map-styles.ts` — Centralized MAP_STYLE constants + `hideDefaultPOILabels()` utility

**Files to modify:**
- `app/globals.css` — Add marker transition styles (keep `marker-pulse-ring` — GuideMap depends on it)

**AdaptiveMarker implementation details:**

1. **Wraps `<Marker>`** from `react-map-gl/mapbox` — uses `poi.coordinates.lng/lat`, `anchor="center"`, and `style={{ zIndex }}`
2. **Uses `<button>`** as the clickable wrapper — `aria-label="{poi.name}, {poi.category.name}"`, `tabindex="0"`
3. **Pre-render all elements** at mount — dot circle, icon circle, rating badge, name label, category text
4. **Toggle visibility via CSS classes** — each element has class-based opacity controlled by `data-zoom-state` on parent container
5. **CSS transitions:** `transition: opacity 150ms ease-out, transform 150ms ease-out`
6. **No permanent `will-change`** — modern browsers auto-promote elements with active CSS transitions. Avoids 100 permanent GPU compositor layers on mobile.
7. **Dot state:** Category-colored circle (8px), invisible `padding` to ensure 24×24px minimum tap target
8. **Icon state:** Category-colored circle (28px) with white Lucide icon centered (resolved via shared `getIcon()` from `lib/utils/map-icons.ts`)
9. **Icon+Rating state:** Same as icon + green rating badge (18px circle, positioned top-right)
   - Rating badge only renders when `poi.googleRating != null && poi.googleRating > 0` AND `shouldShowRating(poi.category.id)` is true
   - Rating formatted with `toFixed(1)` to match Google Maps convention
10. **Full Label state:** Same as icon+rating + horizontal layout with name (bold, 14px, truncated ~18ch) and category text (regular, 12px, gray)
11. **Active state:** `transform: scale(1.15)` + `box-shadow: 0 4px 12px rgba(0,0,0,0.25)`
    - **Active at dot state:** Visually promote to minimum `icon` size (28px) so active marker is always clearly visible and connects to the info pill below
12. **Hover state:** `transform: scale(1.08)` + lighter shadow
13. **`React.memo`** with custom comparator (poi.id, isActive, isHovered) — no `zoomState` in comparator since it's CSS-driven
14. **`prefers-reduced-motion`:** `transition: none` — skip animations but keep static transforms (scale on active)
15. **`children` slot** for product-specific overlays rendered below the marker
16. **Use `cn()` utility** from `@/lib/utils` for conditional class merging (matches ExplorerMap pattern)

**useMapZoomState hook:**
- `"use client"` directive (matches existing hooks)
- Exports `ZoomState` type from the same file (matches `useGeolocation.ts` pattern)
- Accepts `mapRef: React.RefObject<MapRef | null>` + `containerRef: React.RefObject<HTMLDivElement | null>`
- Accesses native Mapbox GL map via `mapRef.current?.getMap()`
- Listens to native `zoom` event (not a React event)
- Uses `useRef` guard to skip DOM writes when state hasn't changed (zoom events fire at 60fps during gestures)
- Writes `containerRef.current.dataset.zoomState` — one DOM write, no React state
- Default: `"full-label"` before map loads (ExplorerMap starts at zoom 15, Report at zoom 14)
- Cleanup: removes event listener on unmount via `useEffect` cleanup
- No `requestAnimationFrame` needed — Mapbox zoom events already fire within rAF

**Shared utilities:**

`lib/utils/map-icons.ts`:
```typescript
import * as LucideIcons from "lucide-react";
export function getIcon(iconName: string): LucideIcons.LucideIcon {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
  return Icon || LucideIcons.MapPin;
}
```

`lib/themes/map-styles.ts`:
```typescript
export const MAP_STYLE_DEFAULT = "mapbox://styles/mapbox/streets-v12";
export const MAP_STYLE_LIGHT = "mapbox://styles/mapbox/light-v11";
// After Phase 4 research: export const MAP_STYLE_ILLUSTRATED = "mapbox://styles/...";

export function hideDefaultPOILabels(map: mapboxgl.Map): void {
  const layers = map.getStyle()?.layers || [];
  layers.forEach((layer) => {
    if (layer.id.includes("poi") || layer.id.includes("place-label") || layer.id.includes("transit")) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  });
}
```

### Phase 2: Integrate into Explorer

**Files to modify:**
- `components/variants/explorer/ExplorerMap.tsx`

**Changes:**
1. Replace inline marker rendering (lines ~317-430) with `<AdaptiveMarker>` usage
2. Add `useMapZoomState` hook — pass `mapRef` and a wrapper `containerRef` (a new `<div ref={containerRef}>` around the map)
3. Import `getIcon` from `lib/utils/map-icons.ts` (remove inline `getIcon` callback)
4. Import `hideDefaultPOILabels` from `lib/themes/map-styles.ts` (replace inline logic in `onLoad`)
5. **Preserve existing features as children/overlays:**
   - Editorial sparkle badge (amber Sparkles icon) → rendered as child, **hidden at dot state** (badge is 16px, larger than 8px dot)
   - Active info pill (name + travel time + directions link) → rendered as child when `isActive`
   - Project center marker → kept separate (not a POI marker)
   - User GPS position dot → kept separate (not a POI marker)
6. **Hover tooltip rendered in ExplorerMap** (NOT in AdaptiveMarker) — tooltip content adapts by reading `containerRef.current?.dataset.zoomState`:
   - `dot` / `icon` state: Show full tooltip (name, category, rating, travel time) — user needs context
   - `icon-rating` state: Show tooltip with name + travel time only — category/rating already visible
   - `full-label` state: Show tooltip with travel time only — or no tooltip if `travelTime` is null
7. **Stop using `marker-pulse-ring`** in Explorer — replaced by scale+shadow active state. **Do NOT remove the CSS from `globals.css`** — GuideMap still uses it.
8. Existing zoom tracking (`onZoomChange`) remains for the "zoom in" hint message — this stays on `zoomEnd`, not continuous `zoom`
9. **Viewport density cap for full-label:** When more than ~12-15 markers are visible at full-label zoom, suppress labels for non-active/non-hovered markers via `data-label-budget-exceeded="true"` on container. Computed on `moveend` event.

### Phase 3: Integrate into Report

**Files to modify:**
- `components/variants/report/ReportInteractiveMap.tsx`

> **Note:** ReportStickyMap does not exist as a separate file. The "sticky" behavior is handled by `ReportInteractiveMapSection.tsx` which renders `ReportInteractiveMap` inside a `<div className="sticky top-20">` wrapper. Only `ReportInteractiveMap.tsx` needs marker changes.

**ReportInteractiveMap changes:**
1. Replace DOM marker path (≤15 POIs) with `<AdaptiveMarker>`
2. **Keep symbol layer fallback** for >15 POIs — AdaptiveMarker applies only to DOM path
3. Add `useMapZoomState` hook for DOM marker path — add wrapper `containerRef` div
4. Import `getIcon` from `lib/utils/map-icons.ts` (remove inline `getIcon` callback)
5. Import `hideDefaultPOILabels` from `lib/themes/map-styles.ts` (replace inline logic)
6. Symbol layer path: add zoom-based `circle-radius` interpolation for basic adaptive sizing:
   ```
   ["interpolate", ["linear"], ["zoom"], 8, 4, 11, 6, 13, 10, 15, 14]
   ```
7. **Use unfiltered POI count** for `USE_SYMBOL_LAYER_THRESHOLD` decision — prevents jarring mode switches when user toggles category filters mid-session
8. Active marker name label at non-full-label zoom states: use `children` slot to render the existing absolute-positioned name label when `isActive`

### Phase 4: Map Style

**Files to create:**
- `lib/themes/map-styles.ts` (created in Phase 1)

**Files to modify:**
- `components/variants/explorer/ExplorerMap.tsx` (line 26)
- `components/variants/report/ReportInteractiveMap.tsx` (line 8)
- `components/variants/guide/GuideMap.tsx` (line 11)
- `components/map/map-view.tsx` (line 10)
- `app/admin/pois/poi-admin-client.tsx` (line 10)
- `app/admin/projects/[id]/project-detail-client.tsx` (line 643)
- `app/admin/projects/[id]/import-tab.tsx` (line 54)
- `app/admin/import/import-client.tsx` (line 50)
- `app/admin/generate/generate-client.tsx` (line 43)

**Changes:**
1. **Research and select** a Mapbox community style matching: soft beige/cream background, illustrated trees, subtle streets, minimal visual noise
2. **Import MAP_STYLE from `lib/themes/map-styles.ts`** — replace all duplicated constants. Product maps use `MAP_STYLE_DEFAULT` (or new `MAP_STYLE_ILLUSTRATED`). Admin maps keep `MAP_STYLE_LIGHT` where they currently use `light-v11`.
3. **Import and use `hideDefaultPOILabels()`** — replace duplicated label-hiding logic in ExplorerMap, ReportInteractiveMap, GuideMap, map-view. When the map style changes, the hide logic only needs updating in one place.
4. **`ReportConfig.mapStyle` override** — per-project overrides continue to take precedence. Wire `mapStyle` prop through `ReportInteractiveMap` (currently hardcoded) to enable per-project style customization.
5. **Map style error fallback** — add `map.on('error')` handler to fall back to `MAP_STYLE_DEFAULT` if the illustrated style fails to load
6. **Static map images** — update if needed (currently use `mapbox/light-v11`)

### Phase 5: Polish & Visual QA

1. **Test all four zoom states** with 30+ POIs at varying densities
2. **Test transitions** — rapid zoom gestures, programmatic fitBounds, and single-step zoom
3. **Test mobile** — verify 24px minimum tap target works at dot state
4. **Test active/hover states** across all zoom levels in both Explorer and Report
5. **Test active marker at dot state** — verify it promotes to icon size (28px)
6. **Test sparkle badge** — verify hidden at dot state, visible from icon state onward
7. **Test viewport density cap** — verify labels suppress when >12-15 markers visible at full-label zoom
8. **Verify existing features preserved:**
   - [ ] Explorer: editorial sparkle badge appears (from icon state onward)
   - [ ] Explorer: active info pill with travel time + directions link works
   - [ ] Explorer: hover tooltip shows appropriate info per zoom state
   - [ ] Explorer: project center marker renders correctly
   - [ ] Explorer: user GPS position dot works
   - [ ] Explorer: category filter toggling hides/shows markers (with fade transition)
   - [ ] Explorer: "zoom in" hint appears at low zoom
   - [ ] Report interactive: two-way card/marker interaction
   - [ ] Report interactive: symbol layer fallback still works for >15 POIs
   - [ ] Report interactive: category filtering does not cause DOM/symbol mode switching
9. **Performance validation** — test with 60 POIs:
   - [ ] No React re-renders triggered by zoom changes (verify with React DevTools)
   - [ ] No jank during rapid zoom gestures
   - [ ] No GPU memory pressure on mobile (no permanent `will-change`)
10. **Accessibility validation:**
    - [ ] Markers are keyboard-navigable (Tab key)
    - [ ] Screen reader announces POI name + category
    - [ ] Focus indicator visible at all zoom states
    - [ ] `prefers-reduced-motion` skips transitions

## Scope Decisions

### In Scope
- AdaptiveMarker component with 4 zoom states (CSS-driven, no React re-renders on zoom)
- Explorer integration (full feature set preserved)
- Report InteractiveMap integration
- New illustrated map style for all products
- Centralized map style constant + POI-hiding utility
- Shared `getIcon()` utility
- Accessibility attributes (button, aria-label, tabindex)
- Viewport density cap for full-label state

### Out of Scope (Deferred)
- **Guide integration** — Guide uses numbered stop markers with completed/active/available states, fundamentally different from category-icon markers. Deferred to future iteration.
- **3D map variants** — ExplorerMap3D and GuideMap3D use Google Maps, cannot share the same React component
- **Marker clustering** — No clustering in v1. Overlapping markers render with z-index (active > hovered > default). Clustering can be added later if density becomes a problem.
- **Symbol layer adaptive markers** — The Mapbox symbol layer path in ReportInteractiveMap gets basic zoom-interpolated circle sizes but not the full 4-state design
- **Legacy `poi-marker.tsx` / `map-view.tsx`** — these use the deprecated `Project` type and are on a deprecation path. Do not update them as part of this feature.

## Acceptance Criteria

### Functional
- [ ] Markers display as colored dots at zoom < 11
- [ ] Markers show category icons at zoom 11 to 12.99
- [ ] Markers show icon + rating badge at zoom 13 to 14.99
- [ ] Markers show icon + rating + name + category at zoom ≥ 15
- [ ] Active markers at dot state promote to icon size (28px minimum)
- [ ] Rating badge only appears for categories where `shouldShowRating()` returns true and `googleRating > 0`
- [ ] CSS transitions are smooth (150ms) between states
- [ ] Active markers scale 1.15x with drop shadow
- [ ] All existing Explorer interactions preserved (hover, click, active pill, sparkle badge from icon state)
- [ ] All existing Report interactive interactions preserved (two-way card/marker)
- [ ] Labels suppressed when viewport density exceeds cap (~12-15 visible markers)
- [ ] New map style renders with illustrated trees and soft colors
- [ ] Per-project `mapStyle` overrides still work
- [ ] Map style error fallback to streets-v12 works

### Non-Functional
- [ ] Zero React re-renders triggered by zoom changes (CSS container approach)
- [ ] No permanent `will-change` on markers (browser auto-promotes during transitions)
- [ ] No visible jank during zoom with 60 markers
- [ ] Minimum 24×24px tap target at all zoom states
- [ ] `prefers-reduced-motion` skips transitions (keeps static transforms)
- [ ] Markers are accessible (`<button>`, `aria-label`, keyboard navigable)
- [ ] Map style constant centralized in `lib/themes/map-styles.ts`
- [ ] POI label hiding centralized in `hideDefaultPOILabels()` utility
- [ ] `getIcon()` centralized in `lib/utils/map-icons.ts`

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| No suitable Mapbox community style found | Fall back to custom style in Mapbox Studio, or keep streets-v12 with marker changes |
| New style breaks POI-hiding logic | Centralized `hideDefaultPOILabels()` — fix in one place. Test layer names after style selection |
| Marker overlap at low zoom makes map unreadable | Accept for v1, add clustering in future iteration |
| Label overlap at full-label state | Viewport density cap suppresses labels when >12-15 markers visible |
| Explorer tooltip redundancy at full-label state | Adaptive tooltip content per zoom state (show less when marker shows more) |
| Performance with 60+ DOM markers during rapid zoom | CSS container approach = zero React re-renders. No permanent `will-change`. Validated during Phase 5 |
| Map style fails to load | `map.on('error')` handler falls back to MAP_STYLE_DEFAULT |
| Category filter toggle causes Report DOM/symbol mode switch | Use unfiltered POI count for threshold decision |

## References

- Brainstorm: `docs/brainstorms/2026-02-08-adaptive-markers-map-style-brainstorm.md`
- Current marker component (legacy, NOT being updated): `components/map/poi-marker.tsx`
- Explorer map: `components/variants/explorer/ExplorerMap.tsx`
- Report interactive map: `components/variants/report/ReportInteractiveMap.tsx`
- Report interactive map section: `components/variants/report/ReportInteractiveMapSection.tsx`
- Rating categories: `lib/themes/rating-categories.ts`
- Institutional learning: `docs/solutions/ux-improvements/poi-click-no-camera-move-20260207.md` (zoom behavior)
- Institutional learning: `docs/solutions/ux-improvements/active-poi-card-pinned-sidebar-20260208.md` (layout stability)
- Institutional learning: `docs/solutions/feature-implementations/explorer-ux-quality-overhaul-20260206.md` (shared constant centralization pattern)
