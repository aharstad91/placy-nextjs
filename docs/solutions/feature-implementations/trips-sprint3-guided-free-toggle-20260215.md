---
module: Trips
date: 2026-02-15
problem_type: feature_implementation
component: trip_mode_toggle
symptoms:
  - "Users locked into sequential guided route"
  - "No way to explore stops in own order"
root_cause: missing_feature
severity: medium
tags: [trips, guided-mode, free-mode, toggle, distance-sorting, localStorage]
---

# Trips Sprint 3 — Guided/Free Mode Toggle

## Context

Trips v2 originally only supported guided mode (sequential stops with route polyline). Sprint 3 adds a Free mode where users explore stops in any order, sorted by proximity.

## Solution

### 1. DB Migration

Added `default_mode` column to `trips` table:

```sql
ALTER TABLE trips
ADD COLUMN default_mode TEXT NOT NULL DEFAULT 'guided'
CHECK (default_mode IN ('guided', 'free'));
```

### 2. Type Flow

`TripMode = "guided" | "free"` flows through:
- `lib/types.ts` → `Trip.defaultMode`, `TripConfig.defaultMode`
- `lib/supabase/types.ts` → `DbTrip.default_mode`
- `lib/supabase/queries.ts` → `transformTrip()` maps column
- `lib/trip-adapter.ts` → passes to `TripConfig`

### 3. UI Toggle

`TripModeToggle` — pill-style segmented control with Route/Compass icons. Placed in both mobile header and desktop sidebar (TripHeader).

### 4. State Management

- `tripMode` state initialized from `trip.defaultMode`
- Persisted per trip: `localStorage.setItem('trip-mode-${tripId}', mode)`
- Read on mount with fallback to trip default

### 5. Free Mode Behavior

- **Map**: `routeCoordinates` and `routeSegments` set to `undefined` → no polyline
- **Stop order**: Sorted by haversine distance from user GPS (or from trip center if no GPS)
- **Stop panel**: All stops visible in scrollable list with distance badges
- **Stop detail**: No prev/next buttons, no transition text, only "Merk som besøkt"

### 6. Guided Mode (unchanged)

- Sequential route with polyline
- Prev/next navigation
- Transition texts between stops

## Key Decisions

- **localStorage not Supabase for mode preference** — no auth required, instant, per-device
- **Haversine distance, not walking distance** — avoids API calls, good enough for sorting
- **Free mode sorts from user position or trip center** — fallback when GPS unavailable
- **Distance badges only in free mode** — guided mode has route context already

## Prevention

When adding new trip features, check if behavior should differ between guided/free modes. The `tripMode` prop is available throughout the component tree.

## Related

- Sprint 1: `trips-sprint1-poi-content-seeding-20260215.md`
- Sprint 2: `trips-sprint2-preview-mode-20260215.md`
- Guide gamification: `guide-gamification-gps-verification.md`
