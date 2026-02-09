---
title: "Trip Product Supabase Integration: tripConfig Extraction and Product Linking"
date: 2026-02-09
category: feature-implementations
module: lib/supabase, app/admin
tags:
  - trip
  - supabase
  - product-config
  - tripConfig
  - product-pois
  - admin
severity: medium
status: resolved
symptoms:
  - "Trip page shows 'Ingen turdata funnet — Dette prosjektet mangler tripConfig'"
  - "Trip product not visible in admin UI"
  - "Admin shows Guide icon/label instead of Trip"
root_cause: "Three issues: (1) No guide-type product existed in Supabase for the project, (2) getProductFromSupabase only extracted reportConfig from product.config but not tripConfig, (3) Admin UI labels and icons used 'Guide' instead of 'Trip'."
affected_files:
  - lib/supabase/queries.ts
  - app/admin/projects/projects-admin-client.tsx
  - app/admin/projects/[id]/project-detail-client.tsx
---

# Trip Product Supabase Integration: tripConfig Extraction and Product Linking

## Problem

After renaming Guide to Trip in the UI, the Trip product needed to work as a real Supabase-backed product (not just JSON files). Three things were missing:

1. **No product record**: No `guide`-type product existed in Supabase for Scandic Nidelven
2. **Missing tripConfig extraction**: `getProductFromSupabase()` extracted `reportConfig` from `product.config` JSONB but ignored `tripConfig`
3. **Wrong admin labels**: Admin UI still showed "Guide" with Map icon instead of "Trip" with Route icon

## Solution

### 1. Create Product Record with POIs

Created guide-type product linked to the shared POI pool:

```sql
-- Create the product
INSERT INTO products (id, project_id, product_type, config)
VALUES (
  'fed88632-...',
  'scandic_scandic-nidelven',
  'guide',
  '{"tripConfig": { ... }}'
);

-- Link all project POIs to the trip product
INSERT INTO product_pois (product_id, poi_id)
SELECT 'fed88632-...', poi_id
FROM product_pois
WHERE product_id = '<explorer-product-id>';
```

The `tripConfig` stored in `product.config` JSONB:

```json
{
  "tripConfig": {
    "id": "scandic-nidelven-byvandring",
    "title": "Trondheim Byvandring",
    "description": "En klassisk byvandring...",
    "difficulty": "easy",
    "category": "culture",
    "stops": [
      { "id": "stop-start", "poiId": "<supabase-poi-uuid>", "transitionText": "..." },
      { "id": "stop-1", "poiId": "<supabase-poi-uuid>", "transitionText": "..." }
    ],
    "reward": { "title": "15% rabatt i baren", ... }
  }
}
```

### 2. Extract tripConfig in getProductFromSupabase

Added tripConfig extraction parallel to existing reportConfig pattern:

```typescript
// lib/supabase/queries.ts — inside getProductFromSupabase()

// Extract reportConfig (existing)
const reportConfig = (product.config as Record<string, unknown>)?.reportConfig as
  | import("@/lib/types").ReportConfig
  | undefined;

// Extract tripConfig (new — same pattern)
const tripConfig = (product.config as Record<string, unknown>)?.tripConfig as
  | import("@/lib/types").TripConfig
  | undefined;

return {
  ...projectData,
  reportConfig,
  tripConfig,  // Added to return object
};
```

### 3. Update Admin UI Labels

```typescript
// app/admin/projects/projects-admin-client.tsx
// app/admin/projects/[id]/project-detail-client.tsx

// Before
import { Map } from "lucide-react";
guide: { label: "Guide", icon: Map, color: "amber", route: "guide" }

// After
import { Route } from "lucide-react";
guide: { label: "Trip", icon: Route, color: "amber", route: "trip" }
```

## Key Pattern: Product Config JSONB

Products store product-type-specific config in the `config` JSONB column:

| Product Type | Config Key | Interface |
|-------------|-----------|-----------|
| `explorer` | (none) | — |
| `report` | `reportConfig` | `ReportConfig` |
| `guide` | `tripConfig` | `TripConfig` |

When adding a new product type, remember to:
1. Store config under a specific key in `product.config`
2. Extract it in `getProductFromSupabase()` with proper type casting
3. Return it from the function

## Important: POI Pool is Shared

All products in a project share the same POI pool. When creating a new product:
- Copy POI links from an existing product in the same project
- The `product_pois` junction table links products to POIs
- Trip stops reference specific POIs by their Supabase UUID (`poiId` in stopConfig)

## References

- Related: `docs/solutions/architecture-patterns/supabase-client-fetch-caching-nextjs-20260209.md` (caching fix needed for new products to appear)
- Types: `lib/types.ts` — `TripConfig`, `ProductType`
- Query: `lib/supabase/queries.ts` — `getProductFromSupabase()`
