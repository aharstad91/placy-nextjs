---
module: Admin
date: 2026-02-14
problem_type: best_practice
component: frontend_stimulus
symptoms:
  - "No admin overview of public content (areas, categories, guides, landing pages)"
  - "User lost track of what public content has been produced"
root_cause: missing_workflow_step
resolution_type: code_fix
severity: medium
tags: [admin, public-pages, inventory, supabase-pagination, server-component]
---

# Feature: Admin Public Pages Inventory

## Problem
Placy has built many public pages (category pages, guides, landing pages) but had no admin overview to see what exists. The `/admin/projects` page shows client projects, but Placy's own public content was invisible in admin.

## Environment
- Module: Admin
- Stack: Next.js 14 (App Router), TypeScript, Supabase
- Affected Components: `app/admin/public/page.tsx`, `app/admin/page.tsx`, `components/admin/admin-sidebar.tsx`
- Date: 2026-02-14

## Implementation

### 1. Dedicated inventory page: `/admin/public`

Server component that shows all public content grouped by area:

- **Summary cards**: area count, category page count, guide count, landing page count
- **Per-area sections**: POI stats, editorial coverage %, Tier 1 count
- **Category table**: name, slug, POI count, SEO title status, intro text status, external link
- **Guide table**: title, filter configuration (tier/category/bbox/limit), external link
- **Landing pages**: hardcoded list of known routes
- **Editorial coverage**: total public POIs, editorial hook %, Tier 1 count

### 2. Dashboard summary

Added "Offentlige sider" section to admin dashboard with key stats and link to `/admin/public`.

### 3. Sidebar navigation

Added "Offentlige sider" nav item between "Prosjekter" and "Trips".

## Key Technical Decisions

### Use `createPublicClient()`, not `createServerClient()`
The `areas` and `category_slugs` tables are NOT in the generated Supabase Database types (added in migration 018). The typed `createServerClient()` would fail. Used the untyped `createPublicClient()` instead — same pattern as `lib/public-queries.ts`.

### Supabase pagination for POI queries
Supabase has a 1000-row default limit. POI queries must paginate with `.range()` to avoid silent data truncation:

```typescript
const PAGE_SIZE = 1000;
const pois: PoiRow[] = [];
let page = 0;
while (true) {
  const { data, error } = await supabase
    .from("pois")
    .select("area_id, category_id, editorial_hook, poi_tier")
    .not("area_id", "is", null)
    .or(`trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}`)
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (error || !data || data.length === 0) break;
  pois.push(...data);
  if (data.length < PAGE_SIZE) break;
  page++;
}
```

### `force-dynamic` export
Admin pages with live Supabase data need `export const dynamic = "force-dynamic"` to prevent Next.js from caching stale data at build time.

### Lucide `Map` icon shadows global `Map`
Importing `Map` from `lucide-react` shadows the JavaScript `Map` constructor. Always alias it: `import { Map as MapIcon } from "lucide-react"`.

### Curated guides and landing pages are hardcoded
Guides come from `lib/curated-lists.ts`, landing pages are known Next.js routes. Both displayed as static inventory — no database queries needed.

## Prevention

- **Always paginate Supabase queries** that could return >1000 rows — use the `.range()` pattern from `app/admin/pois/page.tsx`
- **Always alias Lucide `Map`** as `MapIcon` to avoid shadowing the global Map constructor
- **Use `createPublicClient()`** for tables not in generated Database types (areas, category_slugs, area_slugs)
- **Add `force-dynamic`** to any admin page that fetches live data

## Related Issues

- See also: [seo-content-strategy-public-site-20260213.md](./seo-content-strategy-public-site-20260213.md) — the SEO strategy that created much of the public content this inventory now tracks
