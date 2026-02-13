---
module: Public Site
date: 2026-02-13
problem_type: best_practice
component: frontend_stimulus
symptoms:
  - "No intro text on category pages despite DB support"
  - "Editorial hooks hidden on mobile"
  - "No FAQ structured data for category pages"
  - "No curated guide/list pages for SEO"
  - "Sensitive routes exposed to crawlers"
root_cause: incomplete_setup
resolution_type: code_fix
severity: medium
tags: [seo, content-strategy, structured-data, faq-schema, curated-lists, robots-txt, next-js]
---

# SEO Content Strategy — Public Site Phase 1

## Context

The public site at placy.no had the technical infrastructure (routes, pages, DB schema) but lacked content optimizations needed for organic search ranking. Category pages supported `introText` from the `category_slugs` table but had no data. Editorial hooks were hidden on mobile. No FAQ structured data existed. No curated guide pages existed despite having 1000+ POIs with tier data.

## Solution

### 1. DB Migration — Intro Texts + Missing Slugs

`supabase/migrations/019_seo_intro_texts_and_missing_slugs.sql`

- Added `intro_text` for top 5 categories (restaurant, cafe, bar, badeplass, park) in both NO and EN
- Added missing `category_slugs` for park, badeplass, lekeplass, hundepark, outdoor
- Content is editorial, locally relevant, ~150 words per category

### 2. Editorial Hook Visibility

`app/(public)/[area]/[category]/page.tsx` and EN equivalent

- Changed from `hidden sm:block` to always visible with `line-clamp-1`
- Mobile users now see editorial hooks, improving engagement and SEO content density

### 3. FAQ Structured Data

`components/seo/FAQJsonLd.tsx` — reusable component

- Added to both NO and EN category pages
- Dynamic questions: "How many [category] in [area]?" and "What are the best rated?"
- Also added to curated guide pages
- XSS-safe with `\u003c` escaping in JSON output

### 4. Curated Guide Pages

`lib/curated-lists.ts` — config-driven list definitions
`app/(public)/[area]/guide/[slug]/page.tsx` — guide page route
`lib/public-queries.ts` — `getCuratedPOIs` query function

Three initial guides for Trondheim:
- **Beste restauranter** — tier 1 restaurants, limit 20
- **Badeplasser** — all swimming spots
- **Bakklandet** — cross-category with bounding box filter

Each guide has: BreadcrumbJsonLd, ItemListJsonLd, FAQJsonLd, editorial intro, POI grid, "See also" linking.

### 5. robots.txt

`app/robots.ts` — added `/trips/` and `/test-3d/` to disallow list

## Key Decisions

- **Config-driven curated lists** over DB-driven: simpler, no admin UI needed yet, easy to add new lists
- **Bounding box filter** for geographic guides (Bakklandet): enables neighborhood-scoped content
- **generateStaticParams** for guide pages: ISR with 24h revalidation, pre-built at deploy time
- **Reusable FAQ component**: same component works on category and guide pages

## Prevention

- Always validate bbox coordinates with `Number.isFinite` before passing to PostgREST
- Use explicit `!= null` checks instead of falsy checks for optional filter parameters
- In `generateStaticParams`, use the outer loop key (areaId) not inner data fields for route params

## Related

- `docs/solutions/best-practices/seo-keyword-strategy-public-site-20260213.md` — keyword research that informed content priorities
