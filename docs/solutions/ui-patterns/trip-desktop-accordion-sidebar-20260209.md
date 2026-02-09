---
module: Trip
date: 2026-02-09
problem_type: best_practice
component: frontend_stimulus
symptoms:
  - "Desktop trip sidebar split into separate list + panel sections wastes vertical space"
  - "User must mentally map list item to panel content below"
  - "Stop details disconnected from stop list position"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [accordion, sidebar, desktop, trip, collapsed-expanded, css-animation, explorer-pattern]
---

# UI Pattern: Desktop Trip Accordion Sidebar

## Problem

The desktop Trip sidebar had three separate sections stacked vertically: TripHeader (title + progress), TripStopList (compact list, max 40% height), and TripStopPanel (details for selected stop). This created a disconnected UX where the user had to mentally map between the list item and the panel below. It also wasted vertical space with the fixed 40% height cap on the list.

## Environment
- Module: Trip (components/variants/trip/)
- Stack: Next.js 14, TypeScript, Tailwind CSS
- Affected Components: TripStopList.tsx, TripPage.tsx
- Date: 2026-02-09

## Architecture

### Before (three-section layout)
```
TripHeader (title + progress bar)
TripStopList (compact list, max-h-[40%])
TripStopPanel (details for selected stop, flex-1)
```

### After (accordion layout)
```
TripHeader (unchanged)
TripStopList accordion=true (flex-1, scrollable)
  ├─ Collapsed stop: thumbnail/number + name + category
  ├─ Expanded stop (active): image strip + title + transition + description + mark complete
  └─ Collapsed stop: ...
```

## Solution

### 1. Add `accordion` prop to TripStopList

The key design decision: a single component with a boolean `accordion` prop that switches between compact list (mobile/legacy) and accordion (desktop) modes. This avoids creating a separate component while keeping the original behavior intact.

```tsx
interface TripStopListProps {
  stops: POI[];
  stopConfigs: TripStopConfig[];
  currentStopIndex: number;
  completedStops: Set<number>;
  onStopClick: (index: number) => void;
  // Props for inline panel functionality (desktop accordion mode)
  accordion?: boolean;
  distanceToStop?: number | null;
  userPosition?: Coordinates | null;
  gpsAvailable?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  onMarkComplete?: (gpsVerified: boolean, accuracy?: number, coords?: Coordinates) => void;
}
```

When `accordion=false` (default), the original compact list renders unchanged. When `accordion=true`, the full accordion with inline panel functionality renders.

### 2. CSS-driven collapsed/expanded toggle (from ExplorerPOICard)

Both states are always rendered in the DOM — toggled via CSS for smooth animation:

```tsx
{/* COLLAPSED STATE */}
<div className={cn(
  "px-5 py-3 transition-all duration-300 ease-out",
  isActive ? "opacity-0 h-0 py-0 overflow-hidden" : "opacity-100"
)}>
  {/* compact row: thumbnail + name + category */}
</div>

{/* EXPANDED STATE */}
<div className={cn(
  "transition-all duration-300 ease-out",
  isActive ? "opacity-100" : "opacity-0 h-0 overflow-hidden"
)}>
  {/* image strip + title + content */}
</div>
```

### 3. Expanded content outside button element

Interactive elements (mark complete, prev/next) must be outside the `<button>` to avoid nested interactive elements. The expanded card is split:

- **Inside `<button>`**: Collapsed state + expanded header (image strip + title)
- **Outside `<button>`**: Expanded content (transition text, description, action buttons)

Both sections share the same `isActive` CSS toggle.

### 4. GPS verification logic duplicated from TripStopPanel

The accordion mode needs the full GPS verification state machine (fallback timer, near-stop detection, countdown). This is duplicated from TripStopPanel rather than extracted to a shared hook, since:
- TripStopPanel is still used by mobile
- The verification state is tightly coupled to the UI rendering
- Extracting would add complexity for only two consumers

### 5. Auto-scroll on stop change

```tsx
useEffect(() => {
  if (accordion && activeRef.current) {
    const timeout = setTimeout(() => {
      activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
    return () => clearTimeout(timeout);
  }
}, [currentStopIndex, accordion]);
```

The 50ms delay lets the expansion animation start before scrolling, preventing the scroll from targeting the wrong position.

### 6. TripPage desktop layout simplified

```tsx
{/* Before: */}
<TripStopList ... />           {/* max-h-[40%] */}
<TripStopPanel ... />          {/* flex-1 */}

{/* After: */}
<TripStopList
  accordion
  distanceToStop={distanceToCurrentStop}
  userPosition={geo.userPosition}
  gpsAvailable={...}
  onNext={handleNext}
  onPrev={handlePrev}
  onMarkComplete={handleMarkComplete}
/>
```

Mobile layout is completely untouched — bottom sheet with TripStopPanel is preserved.

## Why This Works

1. **Contextual content**: Stop details appear inline next to the stop's position in the list, eliminating the mental mapping between list and panel
2. **Better vertical space usage**: No fixed height cap — the accordion uses `flex-1 overflow-y-auto` and scrolls naturally
3. **Familiar pattern**: Same collapsed/expanded CSS toggle as ExplorerPOICard — consistent UX across products
4. **Zero mobile regression**: The `accordion` prop defaults to `false`, so all existing usage is unaffected

## Prevention

- When building desktop sidebars with list + detail views, prefer accordion/inline expansion over separate panels
- Reuse the ExplorerPOICard collapsed/expanded CSS pattern (`opacity-0 h-0 overflow-hidden` / `opacity-100` with `transition-all duration-300 ease-out`) for consistent animation across products
- Keep interactive elements (buttons, links) outside the parent `<button>` element to avoid nested interactive element issues
- Always test both mobile and desktop layouts when modifying shared components — use the `accordion` prop pattern to branch behavior cleanly

## Related Issues

- See also: [explorer-desktop-layout-pattern.md](./explorer-desktop-layout-pattern.md) — Explorer's desktop map+sidebar layout pattern
- See also: [active-poi-card-pinned-sidebar-20260208.md](../ux-improvements/active-poi-card-pinned-sidebar-20260208.md) — Explorer's active POI card pinning in sidebar

## File References

- `components/variants/trip/TripStopList.tsx` — Accordion component (both modes)
- `components/variants/trip/TripPage.tsx:309-345` — Desktop layout using accordion
- `components/variants/trip/TripStopPanel.tsx` — Original panel (still used by mobile)
- `components/variants/explorer/ExplorerPOICard.tsx` — Source pattern for collapsed/expanded toggle
