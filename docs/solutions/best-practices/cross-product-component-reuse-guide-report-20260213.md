---
module: Guide
date: 2026-02-13
problem_type: best_practice
component: development_workflow
symptoms:
  - "Public category page had custom card design that didn't match Report product"
  - "GuideMapLayout built from scratch instead of reusing Report components"
  - "Layout spacing (padding, split ratio) diverged between products"
  - "No popup card on map markers in public pages"
resolution_type: code_fix
root_cause: missing_workflow_step
severity: medium
tags: [component-reuse, cross-product, guide, report, layout-consistency, publicpoi]
---

# Cross-Product Component Reuse: Guide ← Report

## Problem

The public category page (`/[area]/[category]`) had its own card design and layout that diverged from the Report product. Cards were large image grids instead of the Report's curated highlight-cards + compact rows pattern. The map lacked popup cards on marker click. Layout spacing (padding, split ratio) didn't match Report.

## Environment
- Module: Guide (public SEO pages)
- Framework: Next.js 14 (App Router), TypeScript, Tailwind CSS
- Affected Components: `GuideMapLayout.tsx`, `GuideStickyMap.tsx`, `app/(public)/[area]/[category]/page.tsx`
- Date: 2026-02-13

## Symptoms
- Public page showed large image cards in 2-column grid — didn't match Report's highlight + compact row pattern
- No popup card appeared when clicking map markers
- Desktop layout was 60/40 split instead of Report's 50/50
- Padding and spacing diverged (no `px-16`, no `rounded-2xl` on map)
- No max-width constraint for ultrawide screens

## What Didn't Work

**Attempted Solution 1:** Built custom POI cards from scratch in GuideMapLayout
- **Why it failed:** Created design drift — cards looked different from Report, duplicated logic for thumbnails, ratings, tier badges

**Attempted Solution 2:** Used 60/40 split with different padding
- **Why it failed:** User noticed the layout didn't match Report's DOM structure (`w-[50%] px-16`)

## Solution

Reuse Report components directly on public pages, enabled by the type hierarchy: `PublicPOI extends POI`.

### Key Insight: Type Compatibility

```typescript
// PublicPOI extends POI — Report components accept POI, so PublicPOI works directly
interface POI { id, name, coordinates, category, ... }
interface PublicPOI extends POI { slug, ... }

// MapPopupCard accepts POI → works with PublicPOI
<MapPopupCard poi={publicPoi} onClose={handleClose} />

// ReportPOICard accepts POI → works with PublicPOI
<ReportPOICard poi={publicPoi} isActive={...} onClick={...} />
```

### Components Reused from Report

| Component | Source | Usage in Guide |
|-----------|--------|----------------|
| `MapPopupCard` | `components/variants/report/MapPopupCard.tsx` | Popup over map markers |
| `ReportPOICard` | `components/variants/report/ReportPOICard.tsx` | Tier 1 highlight cards (horizontal scroll) |

### Layout Structure (matching Report exactly)

```tsx
{/* Desktop — 50/50 split matching Report */}
<div className="hidden lg:flex max-w-[1920px] mx-auto">
  {/* Left: Scrollable card list */}
  <div className="w-[50%] px-16 min-w-0 overflow-hidden">
    {cardList}
  </div>
  {/* Right: Sticky map */}
  <div className="w-[50%] pt-16 pr-16 pb-16">
    <div className="sticky top-20 h-[calc(100vh-5rem-4rem)] rounded-2xl overflow-hidden">
      <GuideStickyMap ... />
    </div>
  </div>
</div>
```

### Card Layout Pattern

```tsx
// Tier 1 POIs → horizontal scroll with ReportPOICard (180px wide)
<div className="flex gap-3 overflow-x-auto snap-x snap-mandatory">
  {featured.map(poi => (
    <div className="flex-shrink-0 w-[180px] snap-start">
      <ReportPOICard poi={poi} isActive={...} onClick={...} />
    </div>
  ))}
</div>

// Remaining POIs → 2-column compact rows (custom CompactPOIRow)
<div className="flex items-start gap-2.5">
  <div className="flex-1 flex flex-col gap-2.5">{leftColumn}</div>
  <div className="flex-1 flex flex-col gap-2.5">{rightColumn}</div>
</div>
```

### Popup Card on Map

```tsx
// In GuideStickyMap — popup rendered as Marker child
{popupPOI && (
  <Marker
    key={`popup-${popupPOI.id}`}
    longitude={popupPOI.coordinates.lng}
    latitude={popupPOI.coordinates.lat}
    anchor="bottom"
    style={{ zIndex: 20 }}
    offset={[0, -20]}
  >
    <MapPopupCard poi={popupPOI} onClose={handlePopupClose} />
  </Marker>
)}
```

### Bidirectional Interaction

```tsx
// activePOISource discriminates card vs marker clicks:
// "card" → map flyTo + show popup (no card scroll)
// "marker" → scroll to card + show popup (no flyTo)
const [activePOISource, setActivePOISource] = useState<"card" | "marker">("card");
```

## Why This Works

1. **Type compatibility**: `PublicPOI extends POI` means any component accepting `POI` automatically works with `PublicPOI`. No adapters, no prop mapping.

2. **Visual consistency**: Reusing `ReportPOICard` and `MapPopupCard` ensures both products look identical. Changes to Report components automatically propagate to Guide.

3. **Exact layout replication**: Copying Report's DOM structure (`w-[50%] px-16`, `sticky top-20`, `rounded-2xl`) ensures pixel-perfect layout match. Don't approximate — copy the exact classes.

## Prevention

- **Always check existing product components before building new ones.** If Report/Explorer already has a card, map popup, or layout pattern — reuse it.
- **Check type hierarchy first.** `PublicPOI extends POI` is the key enabler. If types are compatible, components should be directly reusable.
- **Copy exact Tailwind classes from Report's DOM** when matching layout. Don't approximate `px-16` as `px-4 lg:px-8` — inspect the Report DOM and copy verbatim.
- **Separate mobile and desktop layouts** in the component (`lg:hidden` + `hidden lg:flex`) and share a `cardList` fragment between them.
- **Add `max-w-[1920px] mx-auto`** on desktop containers to prevent ultrawide stretching.

## Gotchas

- **Ref type mismatch:** `cardRefs` was `Map<string, HTMLDivElement>` but CompactPOIRow uses `<button>`. Use `Map<string, HTMLElement>` (parent type) for mixed element types.
- **Page-level padding bleeds into layout:** Remove desktop padding (`lg:px-0`) from the page wrapper and let `GuideMapLayout` own its own `px-16`.
- **Marker offset for popup:** Use `offset={[0, -20]}` and `anchor="bottom"` so the popup appears above the marker, not on top of it.

## Related Issues

- See also: [report-map-popup-card-20260213.md](../feature-implementations/report-map-popup-card-20260213.md) — Original MapPopupCard implementation
- See also: [report-scroll-synced-sticky-map-20260208.md](../feature-implementations/report-scroll-synced-sticky-map-20260208.md) — Original sticky map + 50/50 layout
