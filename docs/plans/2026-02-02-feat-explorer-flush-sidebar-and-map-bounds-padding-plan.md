---
title: "Explorer: Flush sidebar split layout and map bounds padding"
type: feat
date: 2026-02-02
---

# Explorer: Flush sidebar split layout and map bounds padding

## Overview

Two desktop layout changes to ExplorerPage: (1) add padding to map `fitBounds` so edge markers aren't clipped, and (2) change sidebar from floating glassmorphism overlay to a flush split-panel layout.

## Problem Statement

1. **Markers clipped at edges** — `fitBounds` uses `{ left: 0, top: 0, right: windowWidth * 0.4, bottom: 0 }`. The right-padding accounts for the sidebar overlay, but top/bottom/left have zero padding, so markers near the bounding box edges sit right at the viewport edge and are hard to see or click.

2. **Sidebar over-designed for MVP** — The floating glassmorphism panel (`top-6 right-6 bottom-6`, rounded corners, backdrop-blur, border, shadow) adds visual complexity that isn't needed at this stage. A simpler flush layout is cleaner and avoids the map-behind-sidebar overlap pattern.

## Proposed Solution

### Change 1: Map bounds padding

Update `desktopMapPadding` in `ExplorerPage.tsx` to include padding on all sides:

```typescript
// ExplorerPage.tsx:397-403
const desktopMapPadding = {
  left: 60,
  top: 60,
  right: typeof window !== "undefined" ? window.innerWidth * 0.4 + 60 : 560,
  bottom: 60,
};
```

This ensures markers have breathing room on all edges. The right-padding still accounts for sidebar width plus the extra margin.

### Change 2: Flush split layout

Replace the current absolute-positioned overlay pattern with a flex split:

**Current structure (map fullscreen + sidebar overlay):**
```
<div relative>
  <div absolute inset-0>  <!-- map: full viewport -->
  <div absolute top-6 right-6 bottom-6 w-[40%]>  <!-- sidebar: floats over map -->
```

**New structure (flex split):**
```
<div flex h-full>
  <div flex-1>  <!-- map: takes remaining width -->
  <div w-[40%]>  <!-- sidebar: flush right panel -->
```

Sidebar changes:
- Remove: `absolute top-6 right-6 bottom-6 rounded-2xl border border-white/50 shadow-[-4px_0_24px_rgba(0,0,0,0.06)] backdrop-blur-md bg-white/90`
- Add: `w-[40%] bg-white flex-shrink-0 border-l border-gray-200`

Map container changes:
- Remove: `absolute inset-0`
- Add: `flex-1 relative` (map fills remaining space)

Map padding changes:
- Since the map no longer extends behind the sidebar, remove the sidebar-width from right-padding:

```typescript
const desktopMapPadding = {
  left: 60,
  top: 60,
  right: 60,
  bottom: 60,
};
```

## Acceptance Criteria

- [x] All map markers have visible padding from viewport edges on initial load (`ExplorerPage.tsx`)
- [x] Desktop sidebar is flush: `top-0 right-0 bottom-0`, no border-radius, no backdrop-blur, no shadow (`ExplorerPage.tsx`)
- [x] Map and sidebar are side-by-side flex children, map does not extend behind sidebar (`ExplorerPage.tsx`)
- [x] Map `fitBounds` padding is 60px on all four sides (`ExplorerPage.tsx`)
- [x] Map right-padding no longer includes sidebar width (map only occupies its own flex area) (`ExplorerPage.tsx`)
- [x] Mobile layout is unaffected (`ExplorerPage.tsx`)
- [x] Fly-to-active-POI padding remains correct (`ExplorerMap.tsx`)

## Files to Change

| File | Change |
|------|--------|
| `components/variants/explorer/ExplorerPage.tsx:397-403` | Update `desktopMapPadding` to 60px all sides |
| `components/variants/explorer/ExplorerPage.tsx:410-417` | Change desktop layout from absolute to flex, map from `absolute inset-0` to `flex-1 relative` |
| `components/variants/explorer/ExplorerPage.tsx:420` | Strip glassmorphism classes, make sidebar flush with `border-l border-gray-200 bg-white` |

## References

- `components/variants/explorer/ExplorerMap.tsx:86-92` — fitBounds call that consumes `mapPadding`
- `components/variants/explorer/ExplorerMap.tsx:95-107` — flyTo call that also uses `mapPadding`
