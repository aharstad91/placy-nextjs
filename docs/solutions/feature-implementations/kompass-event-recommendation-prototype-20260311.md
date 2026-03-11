---
title: "Kompass — Personal Event Recommendations Prototype"
date: 2026-03-11
category: feature-implementations
tags: [kompass, events, recommendations, onboarding, zustand, explorer, olavsfest]
module: explorer
symptoms: []
---

# Kompass — Personal Event Recommendations Prototype

## Problem

Event-heavy Explorer projects (festivals, kulturnatt, etc.) can have 200+ events. Users need a way to narrow down to personally relevant events without manually scanning through everything.

## Solution: Placy Kompass

A 3-step onboarding flow that gathers user preferences, then filters and presents a personalized event timeline.

### Architecture

```
KompassOnboarding (3-step bottom sheet)
        ↓ writes to
  kompass-store.ts (Zustand, ephemeral)
        ↓ read by
  useKompassFilter hook → recommended POIs + IDs
        ↓ consumed by
  KompassTabs (tab switcher)
  KompassTimeline (vertical timeline view)
  ExplorerMap (dimmed markers via kompassHighlightIds)
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/kompass-store.ts` | Zustand store — selections, UI state, actions. Separate from main store. Not persisted (ephemeral per visit). |
| `lib/hooks/useKompassFilter.ts` | Filter hook — matches events by theme (category ID), day (eventDates), time slot (eventTimeStart hour). Returns `{ recommended, recommendedIds }`. |
| `components/variants/explorer/KompassOnboarding.tsx` | 3-step bottom sheet overlay. Step 1: Tema (multi-select categories with emojis). Step 2: Dag (single-select day). Step 3: Tid (multi-select morning/afternoon/evening). Skip CTA on all steps. |
| `components/variants/explorer/KompassTabs.tsx` | Tab header — "Kompass" vs "Alle events" with counts and active underline. |
| `components/variants/explorer/KompassTimeline.tsx` | Vertical timeline — groups events by start time, shows venue/category/price. Empty state with "Endre filter" CTA. |
| `lib/themes/bransjeprofiler.ts` | Feature flag: `kompass: true` on Event bransjeprofil. |
| `components/map/adaptive-marker.tsx` | Added `dimmed` prop — `opacity: 0.35` with CSS transition for non-recommended markers. |

### Design Decisions

1. **Separate Zustand store** — Kompass state is ephemeral (not persisted to localStorage). Clean separation from main Explorer state. Uses `useShallow` selector hooks for optimal re-renders.

2. **Category-level filtering** — Theme selection maps directly to `poi.category.id`, not to theme groups. Simpler than routing through theme→categories mapping.

3. **Time slots, not exact times** — Users think in "morning/afternoon/evening", not "14:00-16:00". Three buckets: <12, 12-17, >=17.

4. **Map dimming via opacity** — Non-recommended markers get `opacity: 0.35` rather than being hidden. Users maintain spatial awareness while focusing on recommendations.

5. **Feature flag on bransjeprofil** — `kompass: true` only on Event profile. Explorer checks `features.kompass` to conditionally render all Kompass components.

6. **Synced day filter** — When Kompass selects a day, it syncs with the existing `selectedDay` state so map and list filtering stay consistent.

### Time Slot Mapping

```typescript
type TimeSlot = "morning" | "afternoon" | "evening";
// morning:   hour < 12
// afternoon: hour >= 12 && hour < 17
// evening:   hour >= 17
```

### Integration Points

ExplorerPage orchestrates everything:
- Reads Kompass store selections
- Runs `useKompassFilter(allPOIs, themes, day, slots)`
- Passes `kompassHighlightIds` to ExplorerMap (only when Kompass tab active)
- Passes Kompass props to ExplorerPanel (mobile) and ExplorerPOIList (desktop)
- Renders KompassOnboarding overlay when `showOnboarding && features.kompass`

### Gotchas

- **Events without `eventTimeStart`** are included when time filters are active (fail-open). Better to show too many than hide events users expect.
- **Onboarding shows on every visit** — no localStorage persistence by design. Fresh start each session lets users explore differently.
- **AdaptiveMarker memo** needs `dimmed` in comparator if perf issues arise. Currently excluded for simplicity since opacity changes are rare.
