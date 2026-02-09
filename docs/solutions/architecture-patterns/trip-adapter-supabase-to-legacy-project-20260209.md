---
title: "Trip Adapter: Supabase Trip → Legacy Project Shape for UI Components"
date: 2026-02-09
category: architecture-patterns
module: lib/trip-adapter, lib/supabase/queries, app/trips, app/[customer]/[project]/trips
tags:
  - trip
  - adapter-pattern
  - supabase
  - legacy-migration
  - project-overrides
  - seo
  - poi-cross-reference
severity: low
status: resolved
symptoms:
  - "Trip UI components consume legacy Project type but data now lives in Supabase Trip tables"
  - "Need project-specific overrides (start POI, reward, branding) on shared trips"
  - "Need SEO-friendly /trips/[slug] route without project context"
  - "Explorer POI cards don't show which trips a POI belongs to"
root_cause: "Trip UI components (TripPage, TripStopPanel, TripStopList, TripMap) were built against the legacy Project/TripConfig shape. WP1 introduced new Supabase tables (trips, trip_stops, project_trips) with different types (Trip, TripStop, ProjectTripOverride). A bridge was needed."
affected_files:
  - lib/trip-adapter.ts
  - lib/supabase/queries.ts
  - lib/data-server.ts
  - app/[customer]/[project]/trips/page.tsx
  - app/[customer]/[project]/trips/[tripSlug]/page.tsx
  - app/[customer]/[project]/trips/TripLibraryClient.tsx
  - app/trips/[slug]/page.tsx
  - app/api/poi-trips/route.ts
  - components/variants/explorer/ExplorerPOICard.tsx
---

# Trip Adapter: Supabase Trip → Legacy Project Shape

## Problem

WP1 delivered new Supabase tables (`trips`, `trip_stops`, `project_trips`) with their own TypeScript types (`Trip`, `TripStop`, `ProjectTripOverride`). But the entire trip UI stack (`TripPage`, `TripStopPanel`, `TripStopList`, `TripMap`, `TripIntroOverlay`) was built to consume the legacy `Project` type with `tripConfig`.

Rewriting all UI components to accept `Trip` directly would be high-risk and high-effort. We needed a bridge.

## Solution: Adapter Pattern

Created a thin adapter function `tripToProject()` in `lib/trip-adapter.ts` that converts `Trip` + optional `ProjectTripOverride` → `Project`.

### Core Adapter

```typescript
// lib/trip-adapter.ts
export function tripToProject(
  trip: Trip,
  override?: ProjectTripOverride
): Project {
  // 1. Build stops — prepend start POI if override provides one
  let stops = [...trip.stops];
  if (override?.startPoi) {
    const startStop: TripStop = {
      id: createTripStopId(`start-${override.startPoi.id}`),
      poi: override.startPoi,
      sortOrder: -1,
      nameOverride: override.startName,
    };
    stops = [startStop, ...stops];
  }

  // 2. Map stops → POI[] (applying per-stop overrides)
  const pois: POI[] = stops.map((stop) => ({
    ...stop.poi,
    ...(stop.nameOverride ? { name: stop.nameOverride } : {}),
  }));

  // 3. Map stops → TripStopConfig[]
  const stopConfigs: TripStopConfig[] = stops.map((stop) => ({
    id: stop.id,
    poiId: createPOIId(stop.poi.id),
    transitionText: stop.transitionText,
  }));

  // 4. Build reward — project override > trip default
  const reward = buildRewardConfig(trip, override);

  // 5. Build TripConfig + return Project
  return {
    id: trip.id,
    name: trip.title,
    productType: "guide",
    centerCoordinates: trip.center,
    pois,
    tripConfig: { id: trip.id, title: trip.title, stops: stopConfigs, reward, ... },
    ...
  };
}
```

### Key Design Decisions

1. **Start POI as synthetic stop**: Override's `startPoi` becomes a `TripStop` with `sortOrder: -1` and id `start-{poiId}`. Prepended to stops array so it renders first.

2. **Reward override chain**: `override.rewardTitle ?? trip.defaultRewardTitle`. Project-specific rewards (e.g., hotel discount) take precedence over the trip's generic reward.

3. **POI overrides via spread**: Stop-level `nameOverride`, `descriptionOverride`, `imageUrlOverride` are spread onto the POI object, allowing per-trip customization of shared POI data.

## New Supabase Queries

Three new queries were added to support the adapter and cross-references:

### getProjectIdBySlug

```typescript
// lib/supabase/queries.ts
export async function getProjectIdBySlug(
  customerSlug: string,
  projectSlug: string
): Promise<string | null>
```

Resolves a project UUID from `customer` + `project` URL slugs. Needed because trip library page receives URL params, but `getProjectTripsAsync()` needs a project ID.

### getProjectTripOverride

```typescript
export async function getProjectTripOverride(
  tripSlug: string,
  customerSlug: string,
  projectSlug: string
): Promise<ProjectTripOverride | null>
```

Fetches the `project_trips` override for a specific trip within a project. Resolves the start POI from Supabase if `start_poi_id` is set.

### getTripsByPoiId

```typescript
export async function getTripsByPoiId(
  poiId: string
): Promise<{ title: string; urlSlug: string }[]>
```

Finds published trips containing a specific POI via `trip_stops` join. Used for Explorer cross-references.

## Route Architecture

Three routes now serve trip content:

| Route | Data Source | Override | Use Case |
|-------|-----------|----------|----------|
| `/{customer}/{project}/trips` | `getProjectTripsAsync(projectId)` | Yes (per-project) | B2B trip library |
| `/{customer}/{project}/trips/[tripSlug]` | `getTripBySlugAsync()` + `getProjectTripOverrideAsync()` | Yes (per-project) | B2B trip detail |
| `/trips/[slug]` | `getTripBySlugAsync()` | No | Placy SEO route |

All three use the same adapter: `tripToProject(trip, override?)` → pass to `<TripPage project={...} />`.

## POI Cross-Reference in Explorer

Explorer POI cards now show trip badges when a POI belongs to a published trip:

```typescript
// components/variants/explorer/ExplorerPOICard.tsx
const [tripRefs, setTripRefs] = useState<{ title: string; urlSlug: string }[]>([]);

useEffect(() => {
  if (!isActive) return;
  let cancelled = false;
  fetch(`/api/poi-trips?poiId=${encodeURIComponent(poi.id)}`)
    .then((r) => r.ok ? r.json() : [])
    .then((data) => { if (!cancelled) setTripRefs(data); })
    .catch(() => {});
  return () => { cancelled = true; };
}, [isActive, poi.id]);
```

The API route (`app/api/poi-trips/route.ts`) is lightweight — only fetches when the POI card is expanded (`isActive`), with proper cancellation.

## Key Pattern: Adapter Over Rewrite

When introducing a new data model that feeds into existing UI components:

1. **Create a thin adapter** that maps new types → existing types
2. **Update data-fetching routes** to use new queries + adapter
3. **Keep UI components unchanged** — they still consume the same interface
4. **Migrate incrementally** — components can be updated to accept new types one at a time later

This avoids a risky "big bang" rewrite and lets you verify data correctness independently from UI correctness.

## References

- Adapter: `lib/trip-adapter.ts`
- New queries: `lib/supabase/queries.ts` — `getProjectIdBySlug()`, `getProjectTripOverride()`, `getTripsByPoiId()`
- Types: `lib/types.ts` — `Trip`, `TripStop`, `ProjectTripOverride`, `Project`, `TripConfig`
- WP1 schema: `supabase/migrations/` — `trips`, `trip_stops`, `project_trips` tables
- Related: `docs/solutions/feature-implementations/trip-product-supabase-integration-20260209.md`
