---
module: Products
date: 2026-02-05
problem_type: logic_error
component: database
symptoms:
  - "Explorer page shows '0 av 0 steder synlige' despite 84 POIs selected in admin"
  - "Kategorier (0) shown in filter dropdown"
  - "No POI markers on map"
root_cause: logic_error
resolution_type: code_fix
severity: critical
tags: [product-categories, explorer, empty-categories, fallback, supabase-query]
---

# Troubleshooting: Explorer Shows 0 POIs When product_categories Is Empty

## Problem

The public Explorer page showed "0 av 0 steder synlige" with no markers on the map, despite the admin UI correctly showing 84 POIs selected for the Explorer product. The category filter showed "Kategorier (0)".

## Environment

- Module: Products / Supabase query layer
- Stack: Next.js 14, TypeScript, Supabase
- Affected Component: `lib/supabase/queries.ts` — `getProductFromSupabase()`
- Date: 2026-02-05

## Symptoms

- Explorer page at `/klp-eiendom/test-prosjekt/explore` showed "0 av 0 steder synlige"
- Category filter showed "Kategorier (0)" — zero categories
- Map had no POI markers, only the center pin
- Admin page at `/admin/projects/oimYCMG` correctly showed "1 produkt · 84 POI-er"
- `product_pois` table had 84 entries for the product (correct)
- `product_categories` table had 0 entries for the product (the problem)

## What Didn't Work

**Direct solution:** The problem was identified and fixed on the first attempt after tracing the data flow from admin to public page.

## Solution

The fix adds a fallback in `getProductFromSupabase()`: when `product_categories` is empty, derive categories from the selected POIs' global categories instead.

**Code changes:**

```typescript
// Before (broken):
// lib/supabase/queries.ts lines 830-832
const productCatSet = new Set(product.categoryIds);
const categories = container.categories.filter((cat) => productCatSet.has(cat.id));

// After (fixed):
// If product_categories is populated, use it; otherwise derive from selected POIs
let categories: typeof container.categories;
if (product.categoryIds.length > 0) {
  const productCatSet = new Set(product.categoryIds);
  categories = container.categories.filter((cat) => productCatSet.has(cat.id));
} else {
  // Derive categories from the POIs selected for this product
  const poiCategoryIds = new Set(
    pois.map((poi) => poi.category?.id).filter((id): id is string => !!id)
  );
  categories = container.categories.filter((cat) => poiCategoryIds.has(cat.id));
}
```

## Why This Works

1. **Root cause:** The admin UI manages `product_pois` (which POIs belong to a product) but never populates `product_categories` (which categories are visible for the product). The `getProductFromSupabase()` function used `product_categories` to filter visible categories — when empty, zero categories meant zero POIs were shown.

2. **The fix:** When `product_categories` is empty (the common case since admin never writes to it), the function now derives categories from the POIs that are already selected for the product. Each POI has a global `category` from the `categories` table, so we collect unique category IDs from the selected POIs and use those.

3. **Non-breaking:** If `product_categories` IS populated (future admin feature), it still takes precedence. The fallback only activates when the table is empty.

## Prevention

- When adding a query that joins two tables (here: `product_pois` AND `product_categories`), verify that both tables are actually populated by the admin UI
- If a junction table is optional or managed separately, always provide a fallback derivation path
- Test the full data flow from admin write to public read — don't assume intermediate tables are populated just because the schema allows it

## Related Issues

No related issues documented yet.
