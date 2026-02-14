---
module: Explorer & Report
date: 2026-02-14
problem_type: best_practice
component: frontend_stimulus
symptoms:
  - "No internal links from Explorer/Report POI cards to public SEO pages"
  - "Public POI pages at /{area}/steder/{slug} had no inbound links from products"
root_cause: missing_workflow_step
resolution_type: code_fix
severity: medium
tags: [seo, internal-linking, explorer, report, poi-cards, area-slug]
---

# "Les mer" CTA on Explorer and Report POI Cards

## Problem

Public POI pages at `/{area}/steder/{slug}` existed but had no internal links from Explorer or Report products. This meant:
- No SEO juice flowing from product pages to public pages
- Users couldn't discover detailed public POI pages from the product views

## Solution

Added a "Les mer" CTA button on expanded POI cards in both Report (MapPopupCard) and Explorer (ExplorerPOICard) that links to the public POI page.

### Key Implementation Details

**1. Area slug resolution** (`lib/public-queries.ts`):
```typescript
export async function getAreaSlugForProject(productId: string): Promise<string | null> {
  // Joins: product_pois → pois(area_id) → areas(slug_no)
  const { data: poiRow } = await client
    .from("product_pois")
    .select("pois(area_id)")
    .eq("product_id", productId)
    .limit(1)
    .single();
  // ... then looks up areas.slug_no
}
```

**2. URL construction** (in card component):
```typescript
const poiPageUrl = areaSlug ? `/${areaSlug}/steder/${slugify(poi.name)}` : null;
```

**3. Prop threading** — `areaSlug` flows through:
- Server page (`explore/page.tsx` or `report/page.tsx`)
- Page component (`ExplorerPage` / `ReportPage`)
- Container components (`ExplorerPOIList`, `ExplorerPanel`, `ReportStickyMap`)
- Card component (`ExplorerPOICard` / `MapPopupCard`)

### Critical Bug: product_pois vs project_pois

Initial implementation used `project_pois` table with `project_id`, but `projectData.id` is a **product UUID** from the `products` table, not a project container ID. The `project_pois` table uses container IDs (e.g., `scandic_scandic-nidelven`), while `product_pois` uses product UUIDs.

**Wrong:** `client.from("project_pois").eq("project_id", productId)` → always returns null
**Correct:** `client.from("product_pois").eq("product_id", productId)` → works

### Files Changed

- `lib/public-queries.ts` — `getAreaSlugForProject()` function
- `app/for/[customer]/[project]/explore/page.tsx` — calls resolver, passes areaSlug
- `app/for/[customer]/[project]/report/page.tsx` — calls resolver, passes areaSlug
- `components/variants/explorer/ExplorerPage.tsx` — accepts and threads areaSlug
- `components/variants/explorer/ExplorerPOIList.tsx` — passes areaSlug to cards
- `components/variants/explorer/ExplorerPanel.tsx` — passes areaSlug to cards
- `components/variants/explorer/ExplorerPOICard.tsx` — renders "Les mer" CTA
- `components/variants/report/MapPopupCard.tsx` — renders "Les mer" CTA
- `components/variants/report/ReportPage.tsx` — threads areaSlug
- `components/variants/report/ReportStickyMap.tsx` — threads areaSlug

## Prevention

When querying POI-related tables, always check which ID type the table expects:
- `product_pois.product_id` → product UUID (from `products.id`)
- `project_pois.project_id` → project container ID (e.g., `customer_slug`)
