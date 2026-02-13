---
title: Public SEO Site Route Architecture
date: 2026-02-13
category: architecture-patterns
tags: [next.js, seo, routing, isr, i18n, mapbox]
module: public-site
symptoms:
  - Need public SEO pages alongside existing B2B routes
  - Need ISR for PageSpeed without breaking B2B realtime data
  - Need bilingual routes (NO/EN) without i18n framework
---

# Public SEO Site Route Architecture

## Problem

Placy had 1000+ POIs with editorial content hidden behind B2B routes (`/scandic/scandic-lerkendal/report`). Nothing was visible to Google. Needed to expose content via public SEO-optimized routes while keeping B2B routes working.

## Solution

### Route Group separation

```
app/
├── (public)/              # SEO pages — ISR, public layout
│   ├── page.tsx           # Homepage
│   ├── [area]/page.tsx    # /trondheim
│   ├── [area]/[category]/ # /trondheim/restauranter
│   ├── [area]/steder/[slug]/ # /trondheim/steder/britannia
│   └── en/                # English mirror
├── for/                   # B2B — realtime, customer layout
│   └── [customer]/[project]/
├── admin/                 # Admin panel
└── api/                   # API routes
```

### Key architectural decisions

1. **Separate Supabase clients**: `createPublicClient()` without `cache: "no-store"` for ISR compatibility. B2B client keeps `force-dynamic`.

2. **Middleware routing**: `KNOWN_AREAS` and `KNOWN_CUSTOMERS` arrays. First segment determines route group. Legacy redirects `/scandic/...` → `/for/scandic/...` with 308.

3. **Category slugs in database**: `category_slugs` table with locale column enables i18n without a framework. Norwegian: `/trondheim/restauranter`, English: `/en/trondheim/restaurants`.

4. **POI slugs generated dynamically**: `slugify(poi.name)` at query time. No slug column in DB (avoids migration for 1000+ POIs). TODO: Add slug column for performance.

5. **Mapbox Static API for PageSpeed**: Static map images on POI pages instead of interactive Mapbox GL JS. No JS loaded = PageSpeed 100 for maps.

6. **English routes as separate files**: Not using i18n framework. English pages under `app/(public)/en/` mirror Norwegian structure with translated labels. Simple, no dependencies.

## Gotchas

- **ISR + Supabase**: The main Supabase client sets `cache: "no-store"` globally. This breaks ISR. Must use a separate untyped client for public pages.
- **Route conflicts**: `app/page.tsx` and `app/(public)/page.tsx` conflict. Moved old homepage to `app/for/page.tsx`.
- **Migration FK constraints**: Category slugs seed data must use `WHERE EXISTS` subquery — not all categories exist in every deployment.
- **NEXT_PUBLIC_ env vars in static maps**: Mapbox token in static map URLs is intentionally public (same as JS client). Rate limiting via Mapbox dashboard.
- **Slugify ordering**: Norwegian æ/ø/å replacements MUST run before NFD normalization. Use `lib/utils/slugify.ts`, never inline.

## Files

- `lib/supabase/public-client.ts` — ISR-compatible client
- `lib/public-queries.ts` — All public data queries
- `lib/mapbox-static.ts` — Static map URL generator
- `middleware.ts` — Route discrimination
- `supabase/migrations/018_areas_and_category_slugs.sql` — Areas + category slugs
- `components/seo/` — JSON-LD components (POI, Breadcrumb, ItemList)
- `components/public/` — Header, Footer, Breadcrumb, SaveButton, CollectionBar
