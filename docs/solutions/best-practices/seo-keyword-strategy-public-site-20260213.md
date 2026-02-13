---
module: Public Site
date: 2026-02-13
problem_type: best_practice
component: documentation
symptoms:
  - "No strategy for which POI categories to prioritize for SEO"
  - "Unknown search volume for local Trondheim keywords"
  - "Public site built without keyword-driven content planning"
root_cause: inadequate_documentation
resolution_type: documentation_update
severity: medium
tags: [seo, keywords, search-volume, google-ranking, content-strategy, trondheim, public-site]
---

# SEO Keyword Strategy for placy.no Public Site

## Problem

Public SEO site (`feat/placy-public-seo-site` branch) was built with correct technical SEO (JSON-LD, sitemap, hreflang, ISR) but lacked a data-driven strategy for which categories and content to prioritize for Google ranking.

## Environment
- Module: Public Site (placy.no)
- Stack: Next.js 14, Supabase, Vercel
- Area: Trondheim (pilot city, ~210K population)
- Date: 2026-02-13

## Trondheim POI Inventory (1853 total)

| Category | POIs | SEO Priority | Notes |
|----------|------|-------------|-------|
| Buss | 682 | Skip | Transit, not search-relevant |
| Park | 139 | High | Low competition, good data volume |
| Restaurant | 119 | Highest | Top search volume category |
| Lekeplass | 116 | High | Parent segment, zero competition |
| Bysykkel | 83 | Low | Niche |
| Kafé | 71 | High | Strong search volume |
| Frisør | 54 | Medium | Local intent |
| Bildeling | 54 | Low | Niche |
| Treningssenter | 53 | Medium | Local search |
| Hotell | 44 | Strategic | Highest volume but Booking.com dominates |
| Bar | 43 | High | Good volume, medium competition |
| Taxi | 35 | Low | Utility |
| Bakeri | 27 | Medium | Winnable niche |
| Badeplass | 26 | High (seasonal) | Summer explosion, near-zero competition |
| Spa | 26 | Medium | Commercial intent |
| Dagligvare | 25 | Low | Low search volume |
| Museum | 20 | Medium | Tourist-relevant |
| Trikk | 20 | Skip | Transit |

## Estimated Monthly Search Volumes (Norway)

Exact volumes require Google Keyword Planner (free with Ads account). These are informed estimates for a Norwegian city of ~210K population:

| Keyword | Est. monthly searches | Competition |
|---------|----------------------|-------------|
| "hotell trondheim" | 5,000–15,000 | Very high (Booking, Hotels.com) |
| "restaurant trondheim" | 2,000–5,000 | High (TripAdvisor, VisitTrondheim) |
| "bar trondheim" / "utesteder trondheim" | 1,000–3,000 | Medium |
| "badeplasser trondheim" | 1,000–5,000 (seasonal) | Low |
| "kafé trondheim" | 800–2,000 | Medium |
| "beste restaurant trondheim" | 500–1,500 | Medium |
| "museum trondheim" | 500–2,000 | Medium |
| "lekeplass trondheim" | 500–2,000 | Low |
| "parker i trondheim" | 300–1,000 | Low |
| "bakeri trondheim" | 200–800 | Low |

**Key insight:** "badeplasser trondheim" and "lekeplass trondheim" have significant volume but almost no quality competition online. These are quick wins.

## Ranking Strategy

### What technical SEO is already done (PR #29)
- JSON-LD structured data (LocalBusiness, BreadcrumbList, ItemList)
- XML sitemap with all POIs
- Hreflang alternates (NO/EN)
- Static generation with ISR (24h revalidate)
- Semantic URLs (`/trondheim/restauranter`)
- Mapbox Static Images (no client-side JS for map previews)

### What actually moves the needle for ranking

#### 1. Unique content on category pages
Google ranks pages with **unique, useful content** above those with just listings. Category pages need:
- **Intro text** (2-3 paragraphs) unique per category/city
- **Editorial hooks** displayed prominently on POI cards (we have `editorialHook` + `localInsight` data)
- **Quality sorting** using tier system (tier 1 POIs first)

#### 2. Long-tail content pages
Create dedicated pages for high-intent searches:

| Page | Target keyword | Est. volume |
|------|---------------|-------------|
| `/trondheim/beste-restauranter` | "beste restauranter trondheim" | 500–1,500 |
| `/trondheim/badeplasser` | "badeplasser trondheim" | 1,000–5,000 |
| `/trondheim/uteservering` | "uteservering trondheim" | 500–2,000 |
| `/trondheim/bakklandet` | "bakklandet trondheim" | 500–1,000 |
| `/trondheim/familievennlig` | "familierestaurant trondheim" | 100–500 |

#### 3. FAQ schema on category pages
Add FAQ structured data with questions like:
- "Hvor mange restauranter er det i Trondheim?"
- "Hva er de beste restaurantene i Trondheim?"

#### 4. Link building (authority signals)
- Submit sitemap to Google Search Console
- Get links from local sources (VisitTrondheim, Adressa, local blogs)
- Share category pages on social media for initial traffic signals

### Priority order for implementation

**Phase 1 — Quick wins (biggest impact per effort):**
1. Write intro text for top 5 category pages (restaurant, kafé, bar, badeplass, park)
2. Display `editorialHook` prominently on POI cards and detail pages
3. Create 3-5 curated list pages (beste restauranter, badeplasser, bakklandet)

**Phase 2 — Technical boost:**
1. Add FAQ schema to category pages
2. Optimize Core Web Vitals (LCP, CLS)
3. Set up Google Search Console for placy.no
4. Submit sitemap

**Phase 3 — Authority building:**
1. Get links from local sources
2. Write "Trondheim matguide 2026" as linkbait content
3. Social media sharing for traffic signals

### Realistic timeline

| Timeframe | Expected result |
|-----------|----------------|
| 0–1 month | Google indexes pages, appears on page 3–5 |
| 1–3 months | Long-tail keywords (badeplasser, bakklandet) rank page 1–2 |
| 3–6 months | Category pages climb to page 1–2 for medium competition |
| 6–12 months | "restaurant trondheim" potentially top 10, depending on content + links |

## Prevention / Future Guidance

- **Always do keyword research before building public pages** — prioritize categories by search volume, not just data availability
- **Verify search volumes** using Google Keyword Planner (free) before investing in content for a category
- **Content is king** — technical SEO is table stakes, unique editorial content is the differentiator
- **Track rankings** with Google Search Console after launch — adjust strategy based on real data
- **Seasonal content** (badeplasser, uteservering) should be published 1-2 months before season starts

## How to Verify Search Volumes

Use [Google Keyword Planner](https://ads.google.com/intl/no_no/home/tools/keyword-planner/) (free with Google Ads account, no need to pay for ads):
1. Enter keywords: "restaurant trondheim", "kafé trondheim", "bar trondheim", etc.
2. Set location to Norway
3. Takes 5 minutes, gives exact 1K–10K range brackets

## Related Issues

- See also: [public-seo-site-route-architecture-20260213.md](../architecture-patterns/public-seo-site-route-architecture-20260213.md) — Technical architecture for the public SEO site
