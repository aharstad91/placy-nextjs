---
title: feat: SEO Content Strategy — Intro Texts, FAQ Schema, Curated Lists
type: feat
date: 2026-02-13
---

# SEO Content Strategy for placy.no

## Overview

Add content and technical SEO improvements to public pages: category intro texts, FAQ structured data, curated list pages, editorial hook visibility, missing category slugs, and robots.txt.

## Phase 1: Content (Highest Impact)

### 1.1 DB Migration — Intro texts + missing category slugs
- [ ] Add `intro_text` for top 5 NO categories: restaurant, kafé, bar, badeplass, park
- [ ] Add missing `category_slugs` for: park, badeplass, lekeplass (currently missing from DB)
- [ ] File: `supabase/migrations/019_seo_intro_texts_and_missing_slugs.sql`

### 1.2 Editorial hook visibility improvements
- [ ] In `CompactPOIRow`: show `editorialHook` on mobile too (currently `hidden sm:block`)
- [ ] Make hook text slightly more prominent with better truncation
- [ ] File: `app/(public)/[area]/[category]/page.tsx`

### 1.3 Curated list pages
- [ ] Create query: `getTopPOIsForArea(areaId, options)` — supports filter by tier, rating, limit
- [ ] Create route: `app/(public)/[area]/guide/[slug]/page.tsx`
- [ ] Create config for curated lists in `lib/curated-lists.ts`:
  - "beste-restauranter" → restaurant category, tier 1, top rated
  - "badeplasser" → badeplass category, all
  - "bakklandet-guide" → filter by coordinates/neighborhood (Bakklandet bbox)
- [ ] Add JSON-LD (ItemListJsonLd) and meta tags
- [ ] Link curated lists from area page

## Phase 2: Technical SEO Boost

### 2.1 FAQ schema on category pages
- [ ] Create `components/seo/FAQJsonLd.tsx`
- [ ] Generate FAQ items dynamically (count, top-rated, areas)
- [ ] Add to NO and EN category pages
- [ ] File: `components/seo/FAQJsonLd.tsx`

### 2.2 robots.txt
- [ ] Create `app/robots.ts` — allow public routes, disallow internal app routes
- [ ] File: `app/robots.ts`

## Acceptance Criteria

- [ ] Category pages show intro text for top 5 categories
- [ ] FAQ schema renders on category pages (verify with Google Rich Results Test)
- [ ] At least 3 curated list pages accessible at `/trondheim/guide/*`
- [ ] `editorialHook` visible on mobile in compact rows
- [ ] `/robots.txt` correctly allows public, blocks internal routes
- [ ] TypeScript compiles without errors
- [ ] All pages render without client-side errors
