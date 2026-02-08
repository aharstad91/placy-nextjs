---
title: Report scroll-synced sticky map with 50/50 split layout
category: feature-implementations
tags: [report, mapbox, intersection-observer, scroll-sync, sticky-map, marker-pooling]
date: 2026-02-08
severity: medium
symptoms:
  - Per-section independent maps are slow (5 WebGL contexts)
  - Map transitions jarring between sections
  - No visual connection between scrolling content and map
---

# Report scroll-synced sticky map with 50/50 split layout

## Problem

The Report product rendered 5 independent Mapbox GL instances (one per theme section), each with its own WebGL context. This caused:
- Slow initial load (5 map tiles downloads)
- Jarring transitions between sections
- No visual continuity — user loses spatial context when scrolling

## Solution

### Architecture: Single map instance with marker pooling

Replace per-section maps with one page-level sticky map in a 50/50 split layout.

**Key files:**
- `components/variants/report/ReportStickyMap.tsx` — Single Mapbox instance
- `lib/hooks/useActiveSection.ts` — IntersectionObserver for scroll detection
- `components/variants/report/ReportPOICard.tsx` — Compact photo card
- `lib/utils/map-icons.ts` — Shared icon resolution

### Marker pooling pattern

Pre-render ALL markers at mount with `opacity: 0`. Toggle active theme markers to `opacity: 1`. This is GPU-composited (no DOM mutations during scroll).

```tsx
// All markers rendered once, toggled by opacity
{allPOIs.map((poi) => {
  const isActive = isPoiInActiveTheme(poi.id);
  return (
    <Marker key={poi.id} ...>
      <div style={{
        opacity: isActive ? 1 : 0,
        pointerEvents: isActive ? "auto" : "none",
      }}>
        {/* icon */}
      </div>
    </Marker>
  );
})}
```

### IntersectionObserver with height arbitration

Use `intersectionRect.height` (visible pixels) instead of `intersectionRatio` for determining which section is "active". Tall sections never reach high ratios, so ratio-based comparison incorrectly favors short sections.

```tsx
// In useActiveSection.ts
Array.from(entries.entries()).forEach(([id, entry]) => {
  const visibleHeight = entry.intersectionRect.height;
  if (visibleHeight > bestHeight) {
    bestHeight = visibleHeight;
    bestId = id;
  }
});
```

### Observer initialization with ref counting

The IntersectionObserver effect needs to (re)initialize when sections mount. Use a `refCount` state variable incremented by callback refs to trigger the effect:

```tsx
const [refCount, setRefCount] = useState(0);

const registerSectionRef = useCallback((themeId: string) => {
  // Returns cached callback that increments refCount on mount
  return (el: HTMLElement | null) => {
    if (el) { sectionRefs.current.set(themeId, el); setRefCount(c => c + 1); }
    else { sectionRefs.current.delete(themeId); setRefCount(c => c - 1); }
  };
}, []);

useEffect(() => {
  // Re-runs when refCount changes → observer always tracks current sections
}, [refCount, debouncedSet]);
```

### `map.stop()` before `fitBounds()`

Prevents animation pile-up when scrolling quickly between sections:

```tsx
map.getMap().stop();  // Cancel any in-flight animation
map.fitBounds([...], { padding: 60, duration: 300, maxZoom: 16 });
```

## Gotchas

1. **`Map` import shadowing**: `react-map-gl/mapbox` exports a `Map` component that shadows `globalThis.Map`. Use `Record<string, POI[]>` instead of `new Map<string, POI[]>()`.

2. **`for...of` on Map without `--downlevelIteration`**: Use `Array.from(map.entries()).forEach()` instead.

3. **Hooks before early return**: Token check must come after all hooks in the component. Move `if (!token) return null` to just before the JSX return.

4. **Event listener cleanup**: WebGL context loss and drag/zoom listeners added in `onLoad` callback must be cleaned up in a separate `useEffect` (not the callback itself).

5. **Cooperative gestures**: Use `cooperativeGestures={true}` to require Ctrl+scroll for zoom — prevents accidental zoom while reading article content.

## Layout

```
Desktop (lg+):                    Mobile (<lg):
┌──────────┬──────────┐          ┌────────────────────┐
│  Content │  Sticky  │          │     Content         │
│  (50%)   │  Map     │          │  ┌──────────────┐   │
│          │  (50%)   │          │  │ Inline Map   │   │
│  Theme 1 │  Synced  │          │  └──────────────┘   │
│  Theme 2 │  markers │          │     Theme 2         │
│  Theme 3 │          │          │  ┌──────────────┐   │
│  ...     │          │          │  │ Inline Map   │   │
└──────────┴──────────┘          └────────────────────┘
```

## Time saved

- Building from scratch: ~4 hours
- With this solution documented: ~1 hour (copy patterns, avoid gotchas)
