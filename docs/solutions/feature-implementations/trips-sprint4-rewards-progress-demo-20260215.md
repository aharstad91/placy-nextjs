---
module: Trips
date: 2026-02-15
problem_type: feature_implementation
component: trip_adapter
symptoms:
  - "hotelName empty in reward voucher"
  - "No project_trips rows for Scandic demo"
root_cause: missing_data_and_adapter_bug
severity: medium
tags: [trips, rewards, project-trips, demo-data, adapter]
---

# Trips Sprint 4 — Rewards/progress demo data

## Problem

The rewards system was fully built in code (completion screen, GPS verification, confetti, voucher card, intro overlay) but non-functional in the Scandic Nidelven demo because:

1. **No `project_trips` rows** — trips weren't linked to the project with reward overrides
2. **`hotelName: ""`** — `buildRewardConfig()` in `trip-adapter.ts` hardcoded an empty string

## Investigation

Read all trip-related components and found everything was implemented:
- `TripCompletionScreen.tsx` — confetti, voucher, anti-screenshot clock
- `TripIntroOverlay.tsx` — reward teaser before trip starts
- `TripPreview.tsx` — amber reward section
- `useTripCompletion.ts` — localStorage state management
- `project_trips` table — had reward columns but no rows

The only missing piece was **data** and a one-line bug.

## Solution

### 1. Seed reward data via script

Created `scripts/seed-project-trips.ts` using Supabase JS client (not SQL migration, since CLI password was stale):

```typescript
// Insert project_trips rows with reward overrides
const row = {
  project_id: project.id,
  trip_id: trip.id,
  reward_title: "15% rabatt på middag",
  reward_description: "Vis denne skjermen i baren...",
  reward_code: "SMAK2026",
  reward_validity_days: 7,
  welcome_text: "Velkommen til Smak av Trondheim!...",
  start_poi_id: hotelPoi.id,
  start_name: "Scandic Nidelven",
};
```

### 2. Fix hotelName in adapter

```typescript
// Before (bug):
hotelName: "", // Will be populated from project context if needed

// After (fix):
hotelName: override?.startName ?? "",
```

The `startName` field in `ProjectTripOverride` is set to "Scandic Nidelven" via the `project_trips.start_name` column — a natural fit since the start point IS the hotel.

## Key Insight

**Most of Sprint 4 was already done.** The code for rewards/progress was built across Sprints 1-3 (completion screen, GPS verification, confetti, voucher, intro overlay). Sprint 4 was purely a data+adapter gap. This is a good pattern: build the code incrementally, then activate with data.

## Prevention

- When building multi-sprint features, track which components need **data** vs **code**
- Don't hardcode empty strings as placeholders — use `undefined` so TypeScript catches missing values
- The `project_trips` table is the override layer — always check it has rows for demo projects

## Files Changed

- `lib/trip-adapter.ts:133` — `hotelName: override?.startName ?? ""`
- `supabase/migrations/037_project_trips_scandic_rewards.sql` — reward data migration
