---
title: "Explorer: Origin settings, route dismissal, save UX, custom packages, geolocation prompt"
type: feat
date: 2026-02-02
---

# Explorer: Origin settings, route dismissal, save UX, custom packages, geolocation prompt

Five improvements to the Explorer product — focused on the Trondheim prisbelønnet arkitektur use case but applicable to all projects.

## 1. Project-level origin mode setting

### Problem

Today, `centerCoordinates` serves as both the map center and the fixed origin for travel time calculations. The geolocation hook always requests GPS on load. For a project like "Prisbelønnet arkitektur i Trondheim" there is no single "Point A" (it's not a hotel), but Torget is a sensible default center. We need a project-level setting to control origin behavior.

### Proposed solution

Add an `originMode` field to the Project type with three possible values:

```typescript
// lib/types.ts
export interface Project {
  // ... existing fields
  originMode?: "geolocation" | "fixed" | "geolocation-with-fallback";
}
```

| Mode | Behavior |
|------|----------|
| `"geolocation"` | Current behavior — request GPS immediately, use GPS as origin when near |
| `"fixed"` | Never request GPS. Always use `centerCoordinates` as origin. No blue dot. |
| `"geolocation-with-fallback"` | **Default for all projects.** Don't auto-request GPS. Use `centerCoordinates` as origin until user explicitly enables GPS (see item 5). If GPS is enabled and near, switch to GPS origin. |

For the Trondheim architecture project: set `originMode: "geolocation-with-fallback"` and `centerCoordinates` to Torget (63.4305, 10.3951).

### Files to change

- `lib/types.ts:7-20` — Add `originMode` to Project interface
- `components/variants/explorer/ExplorerPage.tsx:42-50` — Read `originMode`, conditionally call `useGeolocation`
- `lib/hooks/useGeolocation.ts` — Add `enabled` parameter to control whether `watchPosition` is called
- `data/projects/trondheim-kommune/prisbellonnet-arkitektur.json` — Set `originMode` and update `centerCoordinates` to Torget

### Acceptance criteria

- [x] `originMode: "fixed"` — no geolocation prompt, no blue dot, travel times from `centerCoordinates`
- [x] `originMode: "geolocation-with-fallback"` — starts with `centerCoordinates`, allows manual GPS enable
- [x] `originMode: "geolocation"` — legacy behavior, auto-request GPS
- [x] Default (field omitted) = `"geolocation-with-fallback"`
- [x] Trondheim project uses Torget as center

---

## 2. Route dismissal and pulse position fix

### Problem

a) The pulsing blue dot animation (`animate-ping` on `w-8 h-8` div) is misaligned with the solid blue dot (`w-4 h-4`). The ping div is not centered relative to the marker.

b) There's no way to dismiss a route by clicking on the map background. Users must click the same POI again (non-obvious). Clicking elsewhere on the map should clear the active POI and route.

### Proposed solution

**Pulse fix:** The pulse ring and solid dot are both absolutely positioned children of a relative flex container. The pulse div at `w-8 h-8` is larger than the dot at `w-4 h-4`. Both need `absolute` + centering transforms, or use Tailwind's `inset-0` approach with the pulse being a sibling of fixed size. Simplest fix:

```tsx
<div className="relative w-8 h-8 flex items-center justify-center">
  {/* Pulse ring — fills parent, stays centered */}
  <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
  {/* Solid dot — centered in parent */}
  <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg z-10" />
</div>
```

**Route dismissal:** Add an `onClick` handler to the Map component that clears `activePOI` when clicking on the map background (not on a marker).

```tsx
// ExplorerMap.tsx
<Map
  onClick={(e) => {
    // Only dismiss if no marker was clicked
    // (marker clicks call e.originalEvent.stopPropagation())
    onDismissActive?.();
  }}
  // ... rest of props
/>
```

In `ExplorerPage.tsx`:
```tsx
const handleDismissActive = useCallback(() => {
  setActivePOI(null);
}, []);
```

### Files to change

- `components/variants/explorer/ExplorerMap.tsx:270-290` — Fix pulse positioning, add map onClick
- `components/variants/explorer/ExplorerPage.tsx:194-200` — Add `handleDismissActive` callback, pass to map

### Acceptance criteria

- [x] Pulse animation centered on blue dot (visually verified)
- [x] Clicking map background dismisses active POI and route
- [x] Clicking a POI marker still selects/toggles that POI (propagation stopped)
- [x] Sidebar card collapses when route is dismissed via map click

---

## 3. Save button UX improvement

### Problem

The "+" save button is too subtle. It's a small gray circle that only shows the "Lagre" label on hover. On touch devices, hover doesn't exist, so users only see a small "+" icon. The button needs to be more discoverable.

### Proposed solution

Make the save button always show label + icon as a cohesive pill button, not just on hover:

```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    onToggleCollection(poi.id);
  }}
  className={cn(
    "flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium transition-colors",
    isInCollection
      ? "bg-sky-50 text-sky-600"
      : "bg-gray-100 text-gray-500 hover:bg-sky-50 hover:text-sky-600"
  )}
>
  {isInCollection ? (
    <>
      <Check className="w-3.5 h-3.5" />
      <span>Lagret</span>
    </>
  ) : (
    <>
      <Plus className="w-3.5 h-3.5" />
      <span>Lagre</span>
    </>
  )}
</button>
```

This removes the hover-only animation complexity and makes the button always visible and tappable.

### Files to change

- `components/variants/explorer/ExplorerPOICard.tsx:208-241` — Replace compound hover-animated label+button with single pill button

### Acceptance criteria

- [x] "Lagre" label always visible next to "+" icon (not hover-dependent)
- [x] "Lagret" + checkmark shown when saved
- [x] Works on touch devices (no hover needed)
- [x] Button is visually part of the card but clearly tappable

---

## 4. Custom package presets per project

### Problem

The hardcoded packages ("Mat & Drikke", "Praktisk", "Transport", "Aktiv", "Alt") don't make sense for an architecture award map. The "Alt" dropdown shows irrelevant filtering options. For Open House Trondheim, day-based filtering (Dag 1, Dag 2, Dag 3) would be ideal.

**Data check:** The raw GeoJSON has no day/schedule data (`aar_ferdigstilt` and `aar_pris_utdelt` are year-only). Day-based filtering would require manual tagging or an external data source (e.g. from the Open House Trondheim event program when it's published). For now, we implement the infrastructure and use prize-category-based packages as a sensible default.

### Proposed solution

Add optional `packages` field to the Project type. If present, it overrides the global packages. If absent, fall back to `EXPLORER_PACKAGES`.

```typescript
// lib/types.ts
export interface Project {
  // ... existing fields
  packages?: CategoryPackage[];  // Optional project-specific packages
}
```

For the Trondheim architecture project, define packages based on prize types:

```json
{
  "packages": [
    { "id": "all", "name": "Alle priser", "icon": "Trophy", "categoryIds": [] },
    { "id": "houens", "name": "Houens fonds diplom", "icon": "Award", "categoryIds": ["houens-fonds-diplom"] },
    { "id": "byggeskikk", "name": "Byggeskikkprisen", "icon": "Building2", "categoryIds": ["byggeskikkpris"] },
    { "id": "oevrig", "name": "Andre priser", "icon": "Star", "categoryIds": ["betongtavlen", "bolig-byplanpris", "landskapspris", "murverkspris", "statens-pris", "annen-pris"] }
  ]
}
```

Later, when Open House Trondheim has a program with dates, POIs can be tagged with a `tags: ["dag-1"]` field and day-based packages can be added:

```json
{ "id": "dag-1", "name": "Dag 1 (Lørdag)", "icon": "Calendar", "categoryIds": [], "tagFilter": "dag-1" }
```

For now, keep it simple: packages filter by `categoryIds`.

### Files to change

- `lib/types.ts` — Add `packages?: CategoryPackage[]` to Project, import CategoryPackage type
- `components/variants/explorer/explorer-packages.ts` — Export type, keep as default
- `components/variants/explorer/ExplorerPage.tsx:50-60` — Use `project.packages ?? EXPLORER_PACKAGES`
- `components/variants/explorer/ExplorerPOIList.tsx` — Accept packages as prop (already does via props)
- `data/projects/trondheim-kommune/prisbellonnet-arkitektur.json` — Add custom packages

### Acceptance criteria

- [x] Projects with `packages` field use custom packages in dropdown
- [x] Projects without `packages` fall back to global `EXPLORER_PACKAGES`
- [x] Trondheim project shows prize-based package filters
- [x] "Alle priser" shows all 40 POIs
- [x] Existing projects (Strawberry) continue working unchanged

---

## 5. Deferred geolocation prompt

### Problem

Requesting geolocation on page load feels aggressive, especially for a public architecture map where many users are just browsing from home. The browser permission dialog interrupts the initial experience.

### Proposed solution

For `originMode: "geolocation-with-fallback"`, show a non-blocking banner at the bottom of the map after the user has interacted with at least one POI (i.e., after first `activePOI` is set). The banner suggests enabling GPS for walking directions:

```tsx
{/* Show after first POI interaction, if GPS not yet enabled */}
{showGeoPrompt && (
  <div className="absolute bottom-4 left-4 right-4 z-20 lg:left-auto lg:right-4 lg:w-72">
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 flex items-start gap-3">
      <Navigation className="w-5 h-5 text-sky-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">Aktiver posisjon</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Se avstander fra der du er nå
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={dismissGeoPrompt} className="text-xs text-gray-400">
          Ikke nå
        </button>
        <button onClick={enableGeolocation} className="text-xs font-medium text-sky-600 bg-sky-50 px-3 py-1.5 rounded-lg">
          Aktiver
        </button>
      </div>
    </div>
  </div>
)}
```

**Trigger logic:**
- Show after first POI click (user has engaged with the content)
- Don't show if `originMode === "fixed"` or GPS already enabled
- Dismissible — store dismissal in sessionStorage
- "Aktiver" button calls `navigator.geolocation.getCurrentPosition()` then enables the watch

### Files to change

- `components/variants/explorer/ExplorerMap.tsx` — Add geo prompt banner component
- `components/variants/explorer/ExplorerPage.tsx` — Track `showGeoPrompt` state, trigger after first POI click
- `lib/hooks/useGeolocation.ts` — Add `enable()` method to return value for on-demand activation

### Acceptance criteria

- [x] No automatic geolocation prompt on page load (for `geolocation-with-fallback` mode)
- [x] Banner appears after first POI interaction
- [x] "Aktiver" triggers geolocation permission
- [x] "Ikke nå" dismisses banner for session
- [x] Banner does not appear for `originMode: "fixed"`
- [x] Banner does not appear if GPS already granted
- [x] `originMode: "geolocation"` keeps current behavior (auto-request)

---

## Implementation order

1. **Item 1** (origin mode) — foundation for items 5
2. **Item 2** (route dismissal + pulse fix) — standalone, no dependencies
3. **Item 3** (save button) — standalone, no dependencies
4. **Item 4** (custom packages) — standalone, requires type change from item 1
5. **Item 5** (geo prompt) — depends on item 1 (originMode)

Items 2 and 3 can be done in parallel. Item 4 can be done in parallel with 2+3. Item 5 depends on item 1.

## References

- `lib/types.ts:7-60` — Project and POI types
- `lib/hooks/useGeolocation.ts` — Full geolocation state machine
- `lib/hooks/useTravelTimes.ts` — Travel time fetching with origin
- `components/variants/explorer/ExplorerPage.tsx` — Main Explorer page (origin, routes, packages)
- `components/variants/explorer/ExplorerMap.tsx:270-290` — Map markers and pulse effect
- `components/variants/explorer/ExplorerPOICard.tsx:208-241` — Save button current implementation
- `components/variants/explorer/ExplorerPOIList.tsx:193-231` — Package dropdown UI
- `components/variants/explorer/explorer-packages.ts` — Global package definitions
- `data/projects/trondheim-kommune/prisbellonnet-arkitektur.json` — Target project
- `docs/solutions/ui-patterns/explorer-desktop-layout-pattern.md` — Layout reference
