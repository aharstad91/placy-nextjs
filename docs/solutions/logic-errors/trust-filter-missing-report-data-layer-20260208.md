---
module: POI Trust System
date: 2026-02-08
problem_type: logic_error
component: service_object
symptoms:
  - "Fake/untrusted POIs (student organizations, fake cafés) visible in Report view despite trust_score=0"
  - "Trust filter only applied in Explorer (apply-explorer-caps.ts), not in data layer"
  - "Report and Explorer using same POI pool (project_pois) but different trust enforcement"
root_cause: scope_issue
resolution_type: code_fix
severity: medium
tags: [trust-score, report, explorer, data-layer, poi-filtering, queries]
---

# Troubleshooting: Trust Filter Missing from Report Data Path

## Problem

Untrusted POIs (e.g., "Château de Sorgenfri" — a student project, "Online, linjeforeningen for informatikk" — a student union at NTNU) appeared in the Report view even after their `trust_score` was set to 0. The trust filter existed only in the Explorer capping pipeline, not in the shared data layer.

## Environment

- Module: POI Trust System / Supabase Queries
- Stack: Next.js 14, TypeScript, Supabase
- Affected Components: `lib/supabase/queries.ts`, Report view, Explorer view
- Date: 2026-02-08

## Symptoms

- Fake POIs visible in Report view at `/scandic/scandic-lerkendal/report`
- Same POIs correctly hidden in Explorer (trust filter in `apply-explorer-caps.ts` working)
- POIs had `trust_score=null` (never validated) — backward-compatible rule showed them
- After setting `trust_score=0`, Explorer hid them but Report still showed them

## What Didn't Work

**Attempted Solution 1:** Removing POIs from `theme_section_pois` / `section_pois`
- **Why it failed:** POIs had 0 rows in these tables — Report fetches them via `project_pois` directly, not via story structure.

**Attempted Solution 2 (considered):** Removing POIs from `project_pois`
- **Why it failed conceptually:** This breaks the shared POI pool model. Both Explorer and Report should draw from the same project POI pool — the fix should be filtering, not data removal.

## Solution

Added `filterTrustedPOIs()` function in the data layer (`lib/supabase/queries.ts`) and applied it in both POI-fetching code paths.

**Code changes:**

```typescript
// lib/supabase/queries.ts — NEW: Import trust threshold
import { MIN_TRUST_SCORE } from "../utils/poi-trust";

// NEW: Shared trust filter function
/** Filter out untrusted POIs. null = show (backward compatible), score < threshold = hide. */
function filterTrustedPOIs(pois: POI[]): POI[] {
  return pois.filter((poi) => {
    if (poi.trustScore == null) return true;
    return poi.trustScore >= MIN_TRUST_SCORE;
  });
}
```

Applied in two places:

```typescript
// 1. Legacy path: getProjectPOIs() — used by getProjectFromSupabase()
const allPois = projectPois.map((pp) => { /* transform */ });
return filterTrustedPOIs(allPois);  // ← NEW

// 2. New hierarchy path: getProjectContainerFromSupabase()
const allPois: POI[] = (projectPois || []).map((pp) => { /* transform */ });
const pois = filterTrustedPOIs(allPois);  // ← NEW
```

**Database changes (one-off):**

```sql
-- Set trust_score=0 for known fake POIs
UPDATE pois SET trust_score = 0, trust_flags = '{suspect_no_website_perfect_rating,suspicious_domain}'
WHERE id IN (
  'google-ChIJZ2WuQq8xbUYRI90fI1pq0qI',  -- Château de Sorgenfri
  'google-ChIJnZH7VwAxbUYRFiQFXvsd-VA',   -- Goathouse
  'google-ChIJJ6LxKb4xbUYRMNk7jUXtrH4'    -- Online, linjeforeningen for informatikk
);
```

## Why This Works

1. **Root cause:** The trust filter was scoped to Explorer only (`apply-explorer-caps.ts` step 1). Report used the same `project_pois` pool but had no equivalent filter. This is a classic "filter at the wrong layer" bug.

2. **Fix location:** Moving the filter to the data layer (`queries.ts`) ensures ALL consumers — Explorer, Report, and any future product — get pre-filtered trusted POIs. The Explorer caps filter becomes a harmless safety net.

3. **Backward compatibility preserved:** `null` trust_score still means "show" — existing POIs without validation are not affected. Only explicitly scored POIs below `MIN_TRUST_SCORE` (0.5) are filtered.

## Prevention

- **Filter at the data layer, not the product layer.** When a filter should apply to all consumers of a data source, put it where the data is fetched, not where it's rendered.
- **When adding cross-cutting concerns (trust, permissions, soft-delete), audit all query paths.** Search for all callers of the underlying table/function.
- **The Explorer caps pipeline is for Explorer-specific logic** (per-theme caps, scoring, blacklisted categories). Trust filtering is universal and belongs in `queries.ts`.

## Related Issues

- See also: [POI Trust Validation Pipeline](../feature-implementations/poi-trust-validation-pipeline-20260208.md) — The trust system implementation
- See also: [Google Places Junk Results Filtering](../api-integration/google-places-junk-results-filtering-20260208.md) — Pre-import filtering of junk results
