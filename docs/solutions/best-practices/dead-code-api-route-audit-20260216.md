---
module: System
date: 2026-02-16
problem_type: best_practice
component: tooling
symptoms:
  - "API routes exist with zero frontend callers"
  - "Components exported but never imported"
  - "Unused Google Maps JS API dependency via dead 3D map components"
root_cause: missing_workflow_step
resolution_type: code_fix
severity: medium
tags: [dead-code, api-routes, google-api, cost-reduction, cleanup]
---

# Best Practice: Audit API Routes and Components for Dead Code

## Problem

After migrating from Google Places API (Legacy) to Places API (New) and removing the photo proxy, several API routes and components remained in the codebase with zero callers. These dead routes still had Google API keys configured, creating unnecessary attack surface and cognitive overhead.

## Environment
- Module: System-wide
- Stack: Next.js 14 (App Router), TypeScript
- Date: 2026-02-16

## Symptoms
- `app/api/places/route.ts` (GET + POST, 187 lines) — zero imports from any component or page
- `components/map/map-view-3d.tsx` + `TripMap3D.tsx` + `ExplorerMap3D.tsx` + `useMap3DCamera.ts` (1019 lines) — exported but never imported
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env var required by dead code only

## What Didn't Work

**Direct solution:** The dead code was identified through systematic grep analysis after completing the photo proxy removal.

## Solution

**Two-step audit pattern:**

### Step 1: Find all files that reference an external dependency
```bash
# Find every file that calls Google APIs
grep -r "googleapis.com\|GOOGLE_PLACES_API_KEY\|GOOGLE_MAPS_API_KEY" --include="*.ts" --include="*.tsx"
```

### Step 2: For each file, check if anything imports/calls it
```bash
# For API routes — check if any component fetches this endpoint
grep -r "/api/places" --include="*.ts" --include="*.tsx" components/ app/ lib/

# For components — check if anything imports the export
grep -r "import.*MapView3D\|import.*TripMap3D\|import.*ExplorerMap3D" --include="*.ts" --include="*.tsx"
```

### Results

| File | Lines | Callers | Action |
|------|-------|---------|--------|
| `app/api/places/route.ts` | 187 | 0 | Deleted |
| `components/map/map-view-3d.tsx` | 350 | 2 (also dead) | Deleted |
| `components/variants/trip/TripMap3D.tsx` | 170 | 0 | Deleted |
| `components/variants/explorer/ExplorerMap3D.tsx` | 230 | 0 | Deleted |
| `lib/hooks/useMap3DCamera.ts` | 269 | 0 (only by deleted files) | Deleted |

**Total: 1206 lines of dead code removed, one unnecessary Google API dependency eliminated.**

### Typecheck verification
```bash
# Always verify after deletion — if tsc passes (ignoring pre-existing script errors), the deletion is safe
npx tsc --noEmit 2>&1 | grep -v "scripts/"
```

## Why This Works

Dead API routes accumulate naturally during feature evolution. A route that was actively used during development (e.g., for testing Google Places responses) may become dead after data is moved to the database. Without periodic audits, these routes persist indefinitely, carrying:

1. **Security risk** — exposed endpoints with API keys, even if uncalled
2. **Cognitive overhead** — developers assume all routes are active
3. **Dependency cost** — env vars and API keys maintained for unused features

The grep-based audit is fast (<10 seconds) and definitive. If `grep -r` for an API route path returns zero hits in `components/` and `app/` (excluding the route itself), the route is dead.

## Prevention

- **After every migration:** Run the two-step audit on the migrated subsystem
- **Before cost optimization:** Map all API callers first — you may find the "expensive" route has zero users
- **Grep before deleting:** Always verify with `grep -r "import.*ComponentName"` — a component may be imported by another dead component (chain deletion)
- **Typecheck after deletion:** `npx tsc --noEmit` catches any missed references

## Related Issues

- See also: [places-api-new-photo-migration-20260216.md](./places-api-new-photo-migration-20260216.md) — the migration that created these dead routes
- See also: [api-route-security-hardening-20260216.md](./api-route-security-hardening-20260216.md) — security hardening of routes before deletion
- See also: [google-api-runtime-cost-leakage-20260215.md](../performance-issues/google-api-runtime-cost-leakage-20260215.md) — the cost analysis that motivated this cleanup
