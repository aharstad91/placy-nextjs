---
title: "POI Tier System Fase 2 — DB, Sorting, Mutations, Code Review Patterns"
date: 2026-02-10
category: feature-implementations
tags:
  - poi-tier
  - report
  - explorer
  - supabase
  - migration
  - sorting
  - editorial-preservation
  - code-review
  - type-safety
severity: medium
module:
  - lib/supabase/mutations.ts
  - lib/supabase/queries.ts
  - components/variants/report/report-data.ts
  - lib/themes/apply-explorer-caps.ts
  - lib/utils/poi-score.ts
  - supabase/migrations/017_add_poi_tier_system.sql
symptoms:
  - All POIs treated equally regardless of quality
  - Dense urban areas show too many mediocre results
  - No way to distinguish local gems from chain restaurants
---

# POI Tier System Fase 2 — Implementation Learnings

## Problem

POIs were sorted only by formula score (rating × reviews) or proximity. Dense areas like Trondheim centrum showed 30+ restaurants with no quality distinction. A local gem with 4.5★ and 200 reviews ranked identically to a chain restaurant with 4.5★ and 200 reviews.

## Solution: Three-Tier Classification

Added a 3-tier system (1=best, 2=good, 3=filler) stored globally on `pois` table with tier-aware sorting in Report and Explorer.

**Architecture decision:** Global tiers on `pois` (not per-product) because tier reflects intrinsic POI quality. `featured` remains per-product via `product_pois`.

## Key Patterns & Gotchas

### 1. NULL_TIER_VALUE = 2.5 (Partial Rollout Strategy)

**Problem:** During rollout, most POIs lack tier data. Treating null as tier 3 penalizes unevaluated popular POIs. Treating null as tier 1 promotes unknowns.

**Solution:** `NULL_TIER_VALUE = 2.5` — unevaluated POIs sort between tier 2 and tier 3.

```typescript
export const NULL_TIER_VALUE = 2.5;

export function byTierThenScore(a: POI, b: POI): number {
  const aTier = a.poiTier ?? NULL_TIER_VALUE;
  const bTier = b.poiTier ?? NULL_TIER_VALUE;
  if (aTier !== bTier) return aTier - bTier;
  return calculateReportScore(b) - calculateReportScore(a);
}
```

**Why this works:** When ALL POIs have null tiers (pre-evaluation), all get 2.5, all tiers are equal, sorting falls through to pure score — identical to pre-feature behavior. Zero behavioral change without tier data.

### 2. Named CHECK Constraints (Learned from Migration 015)

**Gotcha:** Migration 014 (`poi_trust_score`) used unnamed CHECK constraints. Migration 015 had to retroactively fix this. Don't repeat.

```sql
-- BAD: unnamed constraint (auto-generated name varies by PG version)
ALTER TABLE pois ADD COLUMN poi_tier SMALLINT CHECK (poi_tier IN (1, 2, 3));

-- GOOD: named constraint (easy to ALTER later)
ALTER TABLE pois ADD COLUMN poi_tier SMALLINT
  CONSTRAINT pois_poi_tier_valid CHECK (poi_tier IN (1, 2, 3));
```

### 3. Truthiness Bug in Editorial Overwrite Guard

**Gotcha:** JavaScript truthiness breaks strict null-check policies.

```typescript
// BAD: empty string "" is falsy — bypasses the entire check block
if (data.editorial_hook || data.local_insight) { ... }
// BAD: !existing?.editorial_hook is true for BOTH null AND ""
if (!existing?.editorial_hook && data.editorial_hook) { ... }

// GOOD: strict null/undefined checks
if (existing?.editorial_hook === null && data.editorial_hook !== undefined) {
  updatePayload.editorial_hook = data.editorial_hook;
}
```

**Rule:** When the policy is "only write if currently null", always use `=== null` and `!== undefined`. Never rely on truthiness for editorial preservation.

### 4. Supabase Update Type Safety with Conditional Fields

**Gotcha:** Spreading `Record<string, unknown>` into a Supabase `.update()` payload defeats type checking.

```typescript
// BAD: cast defeats all type safety
const editorialUpdate: Record<string, unknown> = {};
// ... conditionally add fields ...
await supabase.from("pois").update({
  poi_tier: data.poi_tier,
  ...editorialUpdate,
} as Record<string, unknown>);  // <-- no type checking at all

// GOOD: build payload as Record, add fields conditionally
const updatePayload: Record<string, unknown> = {
  poi_tier: data.poi_tier,
  tier_reason: data.tier_reason,
  // ... core fields ...
};
if (existing?.editorial_hook === null && data.editorial_hook !== undefined) {
  updatePayload.editorial_hook = data.editorial_hook;
}
await supabase.from("pois").update(updatePayload as Record<string, unknown>);
```

**Note:** The `as Record<string, unknown>` cast on the final `.update()` is still needed because the payload is built dynamically. The improvement is that core fields are statically typed in the object literal, and only the conditional fields are added dynamically.

### 5. Upsert Preservation — Always Add New Columns

**Gotcha:** `upsertPOIsWithEditorialPreservation()` has a manual SELECT + merge pattern. New columns are **silently dropped** unless added in three places:

1. `.select()` column list
2. Map constructor (existingMap)
3. Merge logic (preserving existing values)

Same applies to `getPOIsWithinRadius()` which manually constructs `DbPoi` objects from RPC response.

**Checklist for new columns:**
- [ ] Add to `DbPoi` Row/Insert/Update types in `lib/supabase/types.ts`
- [ ] Add to `POI` interface in `lib/types.ts`
- [ ] Add to `transformPOI()` in `lib/supabase/queries.ts`
- [ ] Add to `getPOIsWithinRadius()` manual DbPoi construction
- [ ] Add to `upsertPOIsWithEditorialPreservation()` SELECT + map + merge
- [ ] Add to migration SQL

### 6. Simplify Highlight Cascade — Avoid Premature Optimization

**Before (over-engineered):**
```typescript
const tier1 = pois.filter((p) => p.poiTier === 1);
if (tier1.length >= HIGHLIGHT_FALLBACK_COUNT) {
  return tier1.sort(byFormulaScore).slice(0, HIGHLIGHT_FALLBACK_COUNT);
}
const tier1Ids = new Set(tier1.map((p) => p.id));
const rest = pois.filter((p) => !tier1Ids.has(p.id)).sort(byFormulaScore);
return [...tier1, ...rest].slice(0, HIGHLIGHT_FALLBACK_COUNT);
```

**After (simpler — step 3 already handles the >= case):**
```typescript
const tier1 = pois.filter((p) => p.poiTier === 1);
const rest = pois.filter((p) => p.poiTier !== 1).sort(byFormulaScore);
return [...tier1, ...rest].slice(0, HIGHLIGHT_FALLBACK_COUNT);
```

The `>= HIGHLIGHT_FALLBACK_COUNT` early return was a premature optimization that added a branch for zero benefit.

### 7. Type Narrowing at DB Boundary

**Pattern:** DB types are wide (`number | null`), domain types are narrow (`1 | 2 | 3`). Cast at the boundary where DB meets domain:

```typescript
// In transformPOI() — the DB→domain boundary
poiTier: (dbPoi.poi_tier as 1 | 2 | 3 | null) ?? undefined,
```

**In TierFields interface — hand-written types can be narrow:**
```typescript
interface TierFields {
  poi_tier: 1 | 2 | 3 | null;  // not number | null
}
```

## File Inventory

| File | Change |
|------|--------|
| `supabase/migrations/017_add_poi_tier_system.sql` | 6 columns + 4 partial indexes + named CHECK |
| `lib/supabase/types.ts` | DbPoi Row/Insert/Update extended |
| `lib/types.ts` | POI interface extended with 6 optional tier fields |
| `lib/supabase/queries.ts` | transformPOI() + getPOIsWithinRadius() mapping |
| `lib/supabase/mutations.ts` | TierFields, updatePOITier(), upsert preservation |
| `components/variants/report/report-data.ts` | byTierThenScore(), simplified pickHighlights() |
| `lib/themes/apply-explorer-caps.ts` | Tier-aware sorting in theme + unmapped categories |
| `lib/utils/poi-score.ts` | NULL_TIER_VALUE constant |
| `components/variants/report/report-data.test.ts` | 4 unit tests for byTierThenScore |

## Prevention Checklist

| Risk | Prevention |
|------|-----------|
| Unnamed constraints | Always name: `CONSTRAINT table_column_valid CHECK (...)` |
| Truthiness in null guards | Use `=== null` / `!== undefined`, never `!value` |
| New columns silently dropped | Follow 6-step checklist above for every new column |
| Partial rollout breaks sorting | Use fractional NULL_TIER_VALUE (2.5) for backward compat |
| Re-import destroys tier data | Always add new fields to upsert preservation |
| Editorial overwrite | Strict null-check policy: only write if existing `=== null` |

## Related Docs

- [Fase 1: Report sub-category splitting](./report-subcategory-splitting-20260210.md)
- [POI Trust Validation Pipeline](./poi-trust-validation-pipeline-20260208.md)
- [Supabase Graceful Column Fallback](../database-issues/supabase-graceful-column-fallback-20260206.md)
- [Editorial Hooks — No Perishable Info](../best-practices/editorial-hooks-no-perishable-info-20260208.md)
- [Generate Hotel Scoring & Capping](./generate-hotel-scoring-featured-capping-20260206.md)
