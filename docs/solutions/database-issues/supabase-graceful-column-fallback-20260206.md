---
title: "Supabase Graceful Column Fallback Pattern"
category: database-issues
tags: [supabase, migration, graceful-degradation, error-handling]
module: queries
date: 2026-02-06
symptom: "try/catch block never catches Supabase column-not-found errors"
root_cause: "Supabase JS client returns errors in response, doesn't throw"
---

# Supabase Graceful Column Fallback Pattern

## Problem

When querying a column that doesn't exist yet (e.g., `featured` on `product_pois` before migration 009 is applied), the code needs to handle this gracefully without crashing. This is common during rolling deployments or when developing locally with outdated database schema.

**Symptom:** Application fails or shows errors when querying newly added columns that haven't been migrated yet.

**Impact:** Breaks the app for users/environments where migrations haven't been applied, violates graceful degradation principle.

## Root Cause

The Supabase JavaScript client uses `fetch` internally and follows the pattern of returning errors in the response object `{ data, error }`. **It does NOT throw exceptions for query errors**, including column-not-found errors.

This means try/catch blocks are **completely ineffective** for handling Supabase query errors. The catch block will never execute, giving a false sense of safety.

## Wrong Approach (try/catch)

```typescript
// ❌ WRONG: Supabase client doesn't throw on column errors
let featuredPoiIds: string[] = [];
try {
  const { data: featuredData } = await supabase
    .from("product_pois")
    .select("poi_id")
    .eq("product_id", prod.id)
    .eq("featured" as string, true);
  featuredPoiIds = (featuredData || []).map(fp => fp.poi_id);
} catch {
  // ⚠️ This catch block NEVER fires — Supabase returns error in response
  console.log("This will never be logged");
}
```

**Why this fails:**
- The catch block is dead code
- Errors are silently ignored (destructuring `{ data }` without checking `error`)
- Application continues with potentially incorrect data (`featuredData` could be `null`)

## Correct Approach (error response)

```typescript
// ✅ CORRECT: Check error in response object
let featuredPoiIds: string[] = [];
const { data: featuredData, error: featuredError } = await supabase
  .from("product_pois")
  .select("poi_id")
  .eq("product_id", prod.id)
  .eq("featured" as string, true); // Cast needed before types are regenerated
if (!featuredError) {
  featuredPoiIds = (featuredData || []).map(fp => fp.poi_id);
}
// If featuredError exists, column doesn't exist — gracefully skip
// Application continues with empty array (safe fallback)
```

**Why this works:**
- Explicitly destructures both `data` and `error`
- Checks `error` before using `data`
- Provides safe fallback (empty array) when column doesn't exist
- No crashes, graceful degradation

## Key Gotchas

### 1. Type Cast Required Before Regenerating Types

When a column is newly added, TypeScript types generated from the database schema won't include it yet.

```typescript
// Type error: Property 'featured' does not exist on type 'product_pois'
.eq("featured", true)

// ✅ Solution: Cast to string temporarily
.eq("featured" as string, true)

// TODO: Remove cast after running:
// npm run supabase:types
```

**Best practice:** Add a TODO comment to remove the cast after regenerating types.

### 2. Boolean Column Coercion Pitfall

When setting boolean values from a Set, be careful with truthiness coercion:

```typescript
// ❌ WRONG: .has() returns false, not undefined
const featured = featuredPoiIds.has(poi.id) || undefined;
// Result: false (not undefined) when not in set

// ✅ CORRECT: Explicit ternary for boolean mapping
const featured = featuredPoiIds.has(poi.id) ? true : undefined;
// Result: true or undefined (never false)
```

**Why this matters:** Postgres boolean columns can be `NULL`, and Supabase treats `undefined` as NULL. Passing `false` explicitly is different from passing `undefined`/`NULL`.

### 3. Always Provide Fallback Values

```typescript
// ❌ WRONG: featuredPoiIds is undefined if error occurs
let featuredPoiIds;
const { data, error } = await supabase.from("product_pois").select("poi_id");
if (!error) {
  featuredPoiIds = data.map(fp => fp.poi_id);
}

// ✅ CORRECT: Initialize with safe default
let featuredPoiIds: string[] = [];
const { data, error } = await supabase.from("product_pois").select("poi_id");
if (!error) {
  featuredPoiIds = (data || []).map(fp => fp.poi_id);
}
```

## Solution Pattern

### Template for New Column Queries

```typescript
/**
 * Query pattern for columns that may not exist yet
 * Use this when querying newly added columns before types are updated
 */
export async function queryNewColumn() {
  // 1. Initialize with safe fallback
  let results: YourType[] = [];

  // 2. Destructure BOTH data and error
  const { data, error } = await supabase
    .from("your_table")
    .select("*")
    .eq("new_column" as string, value); // Cast until types updated

  // 3. Check error before using data
  if (!error) {
    results = data || [];
  }
  // If error exists (column doesn't exist), gracefully continue with fallback

  // 4. Return/use results (always defined, may be empty)
  return results;
}
```

### When to Apply This Pattern

Use this pattern when:
- ✅ Adding new columns to existing tables
- ✅ Deploying code before running migrations
- ✅ Developing locally with schema changes
- ✅ Supporting multiple database versions simultaneously

Don't use this pattern when:
- ❌ Column has always existed (no need for graceful fallback)
- ❌ Missing column should be a hard error (critical data)
- ❌ You want to fail fast and alert developers

## Prevention

### 1. Type Generation Workflow

Add to your deployment checklist:

```bash
# After applying migrations
npm run supabase:types

# Commit updated types
git add lib/database.types.ts
git commit -m "chore: update Supabase types after migration XXX"
```

### 2. Migration + Code Coupling

When possible, structure changes to minimize coupling:

```sql
-- Migration: Add column with safe default
ALTER TABLE product_pois
ADD COLUMN featured BOOLEAN DEFAULT FALSE;

-- Later migration: Change default if needed
ALTER TABLE product_pois
ALTER COLUMN featured SET DEFAULT NULL;
```

This allows old code to continue working (gets `false` for new rows) while new code can gracefully handle the column.

### 3. Feature Flags for New Columns

For major schema changes, consider feature flags:

```typescript
const FEATURED_POIS_ENABLED = process.env.NEXT_PUBLIC_FEATURED_POIS === "true";

if (FEATURED_POIS_ENABLED) {
  const { data, error } = await supabase
    .from("product_pois")
    .select("poi_id")
    .eq("featured", true);

  if (!error) {
    featuredPoiIds = data.map(fp => fp.poi_id);
  }
}
```

This allows you to deploy code before enabling the feature, ensuring migrations are applied first.

## Real-World Example

From `/app/api/projects/[id]/route.ts` (handling `featured` column on `product_pois`):

```typescript
// Query featured POIs with graceful fallback
let featuredPoiIds: string[] = [];
const { data: featuredData, error: featuredError } = await supabase
  .from("product_pois")
  .select("poi_id")
  .eq("product_id", prod.id)
  .eq("featured" as string, true); // TODO: Remove cast after regenerating types

if (!featuredError) {
  featuredPoiIds = (featuredData || []).map(fp => fp.poi_id);
}
// If column doesn't exist, featuredPoiIds remains [] — safe fallback

// Later: Use Set for efficient lookup
const featuredSet = new Set(featuredPoiIds);

// Map POIs with featured status
const poisWithMeta = pois.map(poi => ({
  ...poi,
  featured: featuredSet.has(poi.id) ? true : undefined // Explicit ternary
}));
```

## Testing Checklist

Before deploying code with new columns:

- [ ] Test with migration applied (happy path)
- [ ] Test WITHOUT migration applied (graceful degradation)
- [ ] Verify fallback values are safe
- [ ] Check TypeScript errors after regenerating types
- [ ] Confirm boolean coercion is explicit (true/undefined, not true/false)
- [ ] Add TODO comment for removing type casts

## Related Patterns

- **Migration Sequencing:** `docs/solutions/database-issues/` (if exists)
- **Type Generation Workflow:** `COMMANDS.md` — Supabase CLI section
- **Graceful Degradation:** General principle — always provide safe defaults

## Summary

**Remember:** Supabase JS client returns `{ data, error }`, it does NOT throw. Always:
1. Destructure both `data` and `error`
2. Check `error` before using `data`
3. Initialize with safe fallback values
4. Use explicit ternary for boolean coercion
5. Cast new column names temporarily with TODO comment
