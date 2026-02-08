---
module: Explorer
date: 2026-02-08
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Active/expanded POI card disappears from sidebar when user pans or zooms the map"
  - "Sidebar list re-renders on every viewport change, shifting the active card out of view"
  - "User loses context of the selected POI while exploring the map around it"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [explorer, sidebar, active-poi, sticky, pinned, viewport, pan-zoom, ux, list-stability]
---

# Active POI Card Pinned at Top of Sidebar During Map Pan/Zoom

## Problem
When a user clicked a POI in the Explorer sidebar (expanding the card to show details, route, opening hours), then panned or zoomed the map, the sidebar list would re-render based on the new viewport. This caused the active card to either shift position, get pushed below the fold, or disappear entirely when the POI marker left the viewport bounds.

## Environment
- Module: Explorer
- Stack: Next.js 14, react-map-gl/mapbox, Tailwind CSS
- Affected Components: `ExplorerPOIList.tsx`, `ExplorerPage.tsx`
- Date: 2026-02-08

## Symptoms
- User clicks a POI card → card expands with image, details, route
- User pans the map while card is open → sidebar list re-populates
- Active card moves position or disappears as other POIs enter/leave viewport
- User loses the expanded card they were reading

## Root Cause
The sidebar list was rendered from a single flat array (`pois`) derived from `visiblePOIs`, which was recomputed on every viewport change via `viewportPOIIds`. The active card lived inside the same scrollable container as all other cards, so when the list items shifted (POIs entering/leaving viewport), the active card moved with them.

## What Didn't Work
**Attempt 1: Prepend active POI to the data array.**
Added the active POI to the front of `visiblePOIs` in `ExplorerPage.tsx` when it was outside viewport. This kept it in the list but didn't prevent it from being pushed down as other items re-rendered above or around it. The card still shifted position on every viewport change.

## Solution

### Two-part fix: data layer + UI layer

**Part 1: Keep active POI in data set** (`ExplorerPage.tsx`)

Ensure the active POI remains in `visiblePOIs` even when outside viewport, so its opening hours and travel times stay available:

```typescript
const visiblePOIs = useMemo(() => {
  const inViewport = filteredPOIs.filter((poi) => viewportPOIIds.has(poi.id));
  if (activePOI && !viewportPOIIds.has(activePOI)) {
    const active = filteredPOIs.find((poi) => poi.id === activePOI);
    if (active) inViewport.push(active);
  }
  return inViewport;
}, [filteredPOIs, viewportPOIIds, activePOI]);
```

**Part 2: Split active card out of scrollable list** (`ExplorerPOIList.tsx`)

The key insight: render the active card in a **separate `flex-shrink-0` container above the scrollable list**, not inside it. The list container uses `flex flex-col` with the pinned card outside the `overflow-y-auto` region:

```tsx
<div className="relative flex-1 overflow-hidden flex flex-col">
  {/* Pinned active card — always visible at top, outside scroll */}
  {activePOIData && (
    <div className="flex-shrink-0 px-8 pt-4 pb-2">
      <div className="rounded-xl border border-sky-200 ring-2 ring-sky-500 ...">
        <ExplorerPOICard poi={activePOIData} isActive ... />
      </div>
    </div>
  )}

  {/* Scrollable list of remaining POIs */}
  <div ref={listRef} className="flex-1 overflow-y-auto pb-4">
    {remainingPOIs.map((poi) => (
      <ExplorerPOICard poi={poi} isActive={false} ... />
    ))}
  </div>
</div>
```

The active POI is filtered out of the regular list to avoid duplication:

```typescript
const activePOIData = activePOI ? pois.find((p) => p.id === activePOI) : null;
const remainingPOIs = activePOIData ? pois.filter((p) => p.id !== activePOI) : pois;
```

Also replaced the `scrollIntoView` effect with a simple scroll-to-top, since the pinned card is always visible:

```typescript
useEffect(() => {
  if (activePOI && listRef.current) {
    listRef.current.scrollTop = 0;
  }
}, [activePOI]);
```

## Why This Works

1. **Flexbox layout separation:** `flex-shrink-0` on the pinned card means it always occupies its natural height at the top. The scrollable list (`flex-1 overflow-y-auto`) fills remaining space below. These are independent layout regions — changes in the scroll list cannot affect the pinned card's position.

2. **Data availability:** The active POI is kept in `visiblePOIs` even when outside viewport bounds, ensuring opening hours, travel times, and other derived data remain available for the pinned card.

3. **No duplication:** The active POI is explicitly filtered out of `remainingPOIs`, preventing it from appearing both pinned and in the list.

4. **Clean transitions:** When the user deselects the POI (clicks again), `activePOIData` becomes null, the pinned container disappears, and the POI returns to its natural position in the scrollable list.

## Prevention

- When a sidebar list is driven by dynamic/viewport-dependent data, any "selected" or "active" item should be rendered **outside** the dynamic list container — not just pinned within it
- Use `flex-shrink-0` + `flex-1 overflow-y-auto` pattern to create independent layout regions where one section is stable and the other scrolls
- Always ensure the active item's data dependencies (derived state, API data) remain available even when the item leaves the triggering condition (viewport bounds)
- Avoid `scrollIntoView` for items that should be always-visible — use layout positioning instead

## Related Issues
- See also: [poi-click-no-camera-move-20260207.md](poi-click-no-camera-move-20260207.md) — related viewport/interaction pattern
- See also: [explorer-sidebar-compact-redesign-20260207.md](explorer-sidebar-compact-redesign-20260207.md) — sidebar layout patterns
