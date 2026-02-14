---
module: Data Import
date: 2026-02-14
problem_type: best_practice
component: database
symptoms:
  - "Explorer page renders but shows 0 POIs after import script completes successfully"
  - "product_pois table populated correctly but getProjectContainerFromSupabase returns empty array"
  - "SSR data fetch returns pois: [] despite POIs existing in pois table"
root_cause: missing_workflow_step
resolution_type: code_fix
severity: high
tags: [arcgis, riksantikvaren, data-import, supabase, poi-linking, project-pois, product-pois, dual-table, geojson]
---

# Troubleshooting: POIs Invisible After Import — Dual Table-Linking Required

## Problem
After importing 200 fredede bygninger from Riksantikvaren ArcGIS REST API, the Explorer page rendered correctly but showed zero POIs. The import script had only populated `product_pois` but missed the required `project_pois` table, which serves as the project-level POI pool that `product_pois` filters against.

## Environment
- Module: Data Import (scripts/import-riksantikvaren.ts)
- Stack: Next.js 14, TypeScript, Supabase
- Affected Component: Supabase POI linking tables (`project_pois` + `product_pois`)
- Date: 2026-02-14

## Symptoms
- Explorer page at `/for/trondheim-kommune/fredede-bygninger/explore` renders with map and UI but 0 POIs
- `product_pois` table has 200 rows correctly linked to product
- `pois` table has 200 rows with correct data
- SSR `getProductAsync()` returns `{ pois: [] }` in server component

## What Didn't Work

**Attempted Solution 1:** Checked if POIs were inserted correctly
- **Why it failed:** POIs were in the `pois` table with correct data — not the issue.

**Attempted Solution 2:** Checked `product_pois` linkage
- **Why it failed:** `product_pois` was correctly populated with all 200 POI links — not the issue either.

## Solution

The data fetching chain requires **two** junction tables to be populated:

1. **`project_pois`** — the project-level POI pool (container). Queried by `getProjectContainerFromSupabase()` in `lib/supabase/queries.ts:705`
2. **`product_pois`** — the product-level filter. Used by `getProductFromSupabase()` in `lib/supabase/queries.ts:868` to select which POIs from the container appear in this specific product

**Code changes:**

```typescript
// Before (broken) — only product_pois:
const productPoiLinks = pois.map((poi, i) => ({
  product_id: productId,
  poi_id: poi.id,
  sort_order: i,
}));
await supabase.from("product_pois").upsert(productPoiLinks);

// After (fixed) — BOTH project_pois AND product_pois:

// Step 1: Link POIs to project pool (project_pois)
await supabase.from("project_pois").delete().eq("project_id", projectId);
const projectPoiLinks = pois.map((poi) => ({
  project_id: projectId,
  poi_id: poi.id,
}));
for (let i = 0; i < projectPoiLinks.length; i += 500) {
  await supabase.from("project_pois").insert(projectPoiLinks.slice(i, i + 500));
}

// Step 2: Link POIs to product (product_pois)
await supabase.from("product_pois").delete().eq("product_id", productId);
const productPoiLinks = pois.map((poi, index) => ({
  product_id: productId,
  poi_id: poi.id,
  sort_order: index,
}));
for (let i = 0; i < productPoiLinks.length; i += 500) {
  await supabase.from("product_pois").insert(productPoiLinks.slice(i, i + 500));
}
```

## Why This Works

The Placy data model uses a two-level POI linking architecture:

1. **Project level (`project_pois`):** Acts as a "container pool" of all POIs available to a project. `getProjectContainerFromSupabase()` queries this table to build the base POI set.

2. **Product level (`product_pois`):** Filters the container pool down to the specific POIs shown in a given product (Explorer, Guide, or Report). `getProductFromSupabase()` intersects the container POIs with `product_pois` entries.

If `project_pois` is empty, the container returns zero POIs, and `product_pois` has nothing to filter — resulting in an empty Explorer even though POIs exist in the `pois` table.

This is analogous to a many-to-many relationship where both sides of the join must be populated: `project ↔ project_pois ↔ pois ↔ product_pois ↔ product`.

## Additional Learnings: ArcGIS REST API Import Pattern

### API Query Pattern
```
GET https://kart.ra.no/arcgis/rest/services/Distribusjon/Kulturminner20180301/MapServer/1/query
  ?where=kommune LIKE '%Trondheim%'
  &outFields=*
  &outSR=4326
  &f=geojson
  &resultRecordCount=1000
  &resultOffset=0
```

Key parameters:
- `outSR=4326` — WGS84 coordinates (required for Mapbox)
- `f=geojson` — GeoJSON format (vs default JSON)
- `resultRecordCount` + `resultOffset` — pagination (max 1000 per request)
- Layer 1 = FredaBygninger (protected buildings, point geometry)

### Category Classification from `kulturminneOpprinneligFunksjon`
The field contains free-text function descriptions. Map to categories via keyword matching:
- "Religiøs", "Kirke" → Kirker og kapell
- "Bolig", "bosetning" → Bolighus
- "Forsvar", "Militær" → Forsvar og militært
- "Helse", "pleie" → Helse og pleie
- "Næring", "handel" → Næring og handel
- Fallback → Øvrige kulturminner

### Stable POI IDs
Use `ra-{lokalId}` format for idempotent upserts. The `lokalId` field from Riksantikvaren is stable across API calls.

## Prevention

- **Always populate both `project_pois` AND `product_pois`** in import scripts. Treat this as a mandatory two-step linking pattern.
- Reference `scripts/import-riksantikvaren.ts` as the canonical example for external API imports that create the full chain: customer → project → product → categories → POIs → project_pois → product_pois.
- When debugging "POIs imported but invisible", check `project_pois` first — it's the most commonly missed table.
- The data fetching chain is: `getProductAsync()` → `getProductFromSupabase()` → `getProjectContainerFromSupabase()` (needs `project_pois`) → filter by `product_pois`.

## Related Issues

- See also: [import-external-geographic-data-20260125.md](./import-external-geographic-data-20260125.md) — general pattern for geographic data imports
- See also: [import-wfs-geographic-data-20260125.md](./import-wfs-geographic-data-20260125.md) — WFS-specific import pattern (similar API pagination approach)
