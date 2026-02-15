---
module: Trip Library
date: 2026-02-15
problem_type: logic_error
component: database
symptoms:
  - "Trip library shows only dummy placeholder trips"
  - "POI search matches bysykkel stations instead of landmarks"
  - "Several key Trondheim landmarks missing from POI database"
root_cause: logic_error
resolution_type: seed_data_update
severity: medium
tags: [trips, poi-matching, seed-data, category-filter, supabase]
---

# Trip Seed Data and POI Matching

## Problem

The Trip Library was fully built (database schema, queries, UI, admin) but showed only
dummy placeholder data because no real trips existed in the database. When creating a
seed script, POI name searches returned wrong results — transport infrastructure
(bysykkel stations, taxi stands, bus stops) matched before actual landmarks.

## Symptoms

- `TripLibraryClient.tsx` used `DUMMY_TRIPS` array with "Kommer snart" badges
- ILIKE search for "Gamle Bybro" matched "Bysykkel: Gamle Bybro" instead of "Gamle Bybro plass"
- ILIKE search for "Nidarosdomen" matched "Bispegata - Nidarosdomen" (taxi stand) instead of "Nidaros domkirke"
- "Torvet" matched "Trondheim Bysykkel: Torvet I" instead of "Torvet i Trondheim"
- Several landmarks had no POI at all: Ravnkloa, Vitensenteret, Kristiansten festning

## Root Cause

The POI database contains transport infrastructure (bike stations, taxi stands, bus stops)
that share names with landmarks. ILIKE search with no category filter returns the first
match alphabetically, which is often a transport POI.

## Solution

### 1. Category exclusion in findPoi()

```typescript
const EXCLUDED_CATEGORIES = ["bike", "taxi", "bus"];

const { data } = await client
  .from("pois")
  .select("id, name, category_id")
  .ilike("name", `%${search}%`)
  .not("category_id", "in", `(${EXCLUDED_CATEGORIES.map((c) => `"${c}"`).join(",")})`)
  .limit(1);
```

### 2. Specific search terms

Instead of generic names, use the exact POI names from the database:

| Searched | Actual POI name |
|----------|----------------|
| Nidarosdomen | Nidaros domkirke |
| Gamle Bybro | Gamle Bybro plass |
| Torvet | Torvet i Trondheim |
| Stiftsgården | Stiftsgårdsparken |
| Erkebispegården | Vestfløyen - Erkebispegården |

### 3. Missing POI substitution

For POIs that don't exist in the database, substitute with nearby alternatives
and use `nameOverride` to display the intended name:

- Ravnkloa → removed from trip (no POI exists)
- Vitensenteret → replaced with Besøkssenteret ved Nidaros domkirke
- Kristiansten festning → removed from trip (only bike station exists)
- Sverresborg museum → replaced with Rockheim

### 4. Removed DUMMY_TRIPS

After seeding 5 real trips (22 stops total), removed `DUMMY_TRIPS` array and
all dummy-related code from `TripLibraryClient.tsx`. Also cleaned up unused
server-side props (`groupedTrips`, `categoriesWithTrips`, `categoryLabels`).

## Prevention

- **Always exclude transport categories** when searching for POIs by name
- **Use `--dry-run` flag** on seed scripts to verify matches before inserting
- **Consider creating landmark POIs** for key missing sites (Ravnkloa, Kristiansten festning, Vitensenteret)

## Files Changed

- `scripts/seed-trips.ts` — new seed script with 5 trips
- `app/for/[customer]/[project]/trips/TripLibraryClient.tsx` — removed DUMMY_TRIPS
- `app/for/[customer]/[project]/trips/page.tsx` — removed unused props
