---
module: Trips
date: 2026-02-15
problem_type: feature_implementation
component: database_migration
symptoms:
  - "Need new POI category (sightseeing) across DB + TypeScript + UI"
  - "Need new landmark POIs not yet in database"
  - "Seed script lacks update capability for iterating on trip content"
root_cause: feature_gap
severity: medium
tags: [trips, poi, migration, seed-script, categories, sightseeing]
---

# Trips Sprint 1: POI Content & Seeding Pipeline

## Problem

Sprint 1 of Trips V2 required:
1. A new `sightseeing` trip category (DB CHECK constraint + TypeScript types + UI mappings)
2. Three landmark POIs (Gamle Bybro, Ravnkloa, Stiftsgården) not in the database
3. A way to update existing trips without losing their IDs (for project_trips references)
4. Upgraded editorial content with teaser chain technique for 3 demo trips

## Investigation

### Category Addition Requires 4 Layers

Adding a new trip category touches:
1. **DB CHECK constraint** — `trips_category_check` on `trips.category`
2. **TypeScript const array** — `TRIP_CATEGORIES` in `lib/types.ts`
3. **TypeScript labels** — `TRIP_CATEGORY_LABELS` Record
4. **UI component** — `CATEGORY_GRADIENTS`, `CATEGORY_ICONS`, and `grouped` state in `TripLibraryClient.tsx`

Missing any one of these causes either a DB rejection, TypeScript error, or runtime crash.

### POI Creation Requires Category FK

The `pois.category_id` column has a foreign key to `categories(id)`. Creating POIs with `category_id = 'sightseeing'` requires the category to exist in the `categories` table first — not just in the `trips.category` CHECK constraint.

**This was the key gotcha:** Migration 034 added sightseeing to the trips CHECK constraint, but migration 035 needed to also INSERT into the `categories` table before creating POIs.

### Seed Script Upsert Pattern

The original seed script (`seed-trips.ts`) skipped existing trips. For iterating on content, we needed a `--force` flag that:
1. Deletes old `trip_stops` for the trip
2. Updates trip metadata
3. Re-inserts new stops
4. Preserves the original trip ID (critical for `project_trips` FK references)

## Solution

### Migration 034: Add sightseeing to CHECK constraint
```sql
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_category_check;
ALTER TABLE trips ADD CONSTRAINT trips_category_check
  CHECK (category IN ('food', 'culture', 'nature', 'family', 'active', 'hidden-gems', 'sightseeing'));
```

### Migration 035: Create category + landmark POIs
```sql
-- Must create category BEFORE POIs (FK constraint)
INSERT INTO categories (id, name, icon, color)
VALUES ('sightseeing', 'Sightseeing', 'Eye', '#6366f1')
ON CONFLICT (id) DO NOTHING;

-- Then create POIs with gen_random_uuid()::TEXT (matches existing pattern)
INSERT INTO pois (id, name, lat, lng, category_id, area_id, editorial_hook, local_insight, trust_score)
VALUES (gen_random_uuid()::TEXT, 'Gamle Bybro', 63.4269, 10.4009, 'sightseeing', 'trondheim', ...);
```

### Seed script --force upsert
```typescript
if (existing && !FORCE_UPDATE) {
  console.log(`  SKIP: Already exists (use --force to update)`);
  skipped++; continue;
}
// ... resolve POIs ...
if (existing) {
  await client.from("trip_stops").delete().eq("trip_id", existing.id);
  await client.from("trips").update(tripFields).eq("id", existing.id);
  tripId = existing.id;
} else {
  const { data } = await client.from("trips")
    .insert({ ...tripFields, created_by: "seed-script" }).select("id").single();
  tripId = data.id;
}
```

## Prevention

- **Adding a new category:** Always check all 4 layers (DB constraint, TypeScript types, TypeScript labels, UI component)
- **Creating POIs with new categories:** The `categories` table is the FK target — always INSERT the category before POIs
- **Seed script updates:** Use `--force --publish` for content iteration; `--dry-run` to preview first
- **Migration failures:** Use `supabase migration repair NNN --status reverted` to reset, fix the SQL, then re-push

## Related Files

- `supabase/migrations/034_add_sightseeing_trip_category.sql`
- `supabase/migrations/035_trip_landmark_pois.sql`
- `lib/types.ts:365-383` — TRIP_CATEGORIES and TRIP_CATEGORY_LABELS
- `app/for/[customer]/[project]/trips/TripLibraryClient.tsx:28-42` — UI mappings
- `scripts/seed-trips.ts` — Full seed script with --force upsert
