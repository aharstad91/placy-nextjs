---
module: Public Site
date: 2026-02-16
problem_type: best_practice
component: documentation
symptoms:
  - "POI detail page JSON-LD uses wrong schema type for hotels (Restaurant instead of Hotel)"
  - "openingHours uses Google Places weekday_text format instead of schema.org OpeningHoursSpecification"
  - "PostalAddress missing addressLocality and postalCode — incomplete for local SEO"
  - "JSON-LD image field is single string, not array — misses gallery images"
  - "og:type is generic 'website' instead of 'place' for location pages"
root_cause: inadequate_documentation
resolution_type: code_fix
severity: high
tags: [seo, json-ld, structured-data, schema-org, rich-results, google, local-seo, open-graph, poi-detail, public-site]
---

# SEO Audit: POI Detail Page Structured Data & Metadata

## Problem

Full SEO audit of `placy.no/trondheim/steder/britannia-hotel` revealed 13 concrete improvement opportunities in structured data, metadata, and technical SEO. The page has good fundamentals (JSON-LD, sitemap, hreflang, ISR) but several issues that reduce Google Rich Results eligibility and local SEO signals.

## Environment
- Module: Public Site (placy.no)
- Stack: Next.js 14, Supabase, Vercel
- Affected files:
  - `components/seo/POIJsonLd.tsx` — JSON-LD structured data
  - `app/(public)/[area]/steder/[slug]/page.tsx` — generateMetadata + page component
  - `app/layout.tsx` — root layout (missing favicon, Organization schema)
  - `app/sitemap.ts` — sitemap generation
- Date: 2026-02-16
- Audit page: https://placy.no/trondheim/steder/britannia-hotel

## Current State (What's Already Good)

- Title tag 58 chars, includes keyword + city + brand
- Meta description with editorial hook
- Canonical URL + hreflang no/en
- Open Graph + Twitter Card tags with image
- JSON-LD with Restaurant/LocalBusiness schema + AggregateRating
- BreadcrumbList JSON-LD
- XML sitemap with all POIs
- ISR 24h revalidation
- Semantic heading hierarchy (H1 > H2 > H3)
- Alt text on all images
- Preconnect to Mapbox API

## Findings — Prioritized by Impact

### 1. HIGH: openingHours uses wrong format
**File:** `components/seo/POIJsonLd.tsx:76`

**Current:** Uses Google Places `weekday_text` strings directly:
```json
"openingHours": ["Monday: Open 24 hours", "Tuesday: 07:00–23:00", ...]
```

**Should be:** schema.org `openingHoursSpecification`:
```json
"openingHoursSpecification": [
  {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "opens": "00:00",
    "closes": "23:59"
  }
]
```

**Impact:** Google may ignore incorrectly formatted opening hours in Rich Results.

### 2. HIGH: PostalAddress incomplete
**File:** `components/seo/POIJsonLd.tsx:51-57`

**Current:**
```json
"address": {
  "@type": "PostalAddress",
  "streetAddress": "Dronningens gate 5",
  "addressCountry": "NO"
}
```

**Missing:** `addressLocality` (city name) and `postalCode`. Google strongly prefers complete addresses for local business results.

**Fix:** Add `addressLocality: area.nameNo` at minimum. PostalCode would require a database field or parsing from Google Places data.

### 3. HIGH: JSON-LD image is single string, not array
**File:** `components/seo/POIJsonLd.tsx:73`

**Current:** `"image": "https://..."` (one image)

**Should be:** Array of all gallery images:
```json
"image": ["https://img1...", "https://img2...", "https://img3..."]
```

**Impact:** Google prefers multiple images and may show richer results. We already have `galleryImages` data — just need to pass it to the component.

### 4. HIGH: No generateStaticParams for POI pages
**File:** `app/(public)/[area]/steder/[slug]/page.tsx`

Guide pages have `generateStaticParams` but POI detail pages don't. Without it, pages are built on-demand (ISR), meaning first visit has slow TTFB and crawlers may get slower responses.

**Fix:** Add `generateStaticParams` that returns all POI slugs per area.

### 5. MEDIUM: Sitemap lastmod is identical for all URLs
**File:** `app/sitemap.ts` (or equivalent)

All 1100+ URLs have the same `lastmod` timestamp (`2026-02-15T22:36:14.443Z`). Google ignores `lastmod` that doesn't reflect real content changes.

**Fix:** Use `poi.updated_at` from database for real per-page lastmod values.

### 6. MEDIUM: og:type is "website" for location pages
**File:** `app/(public)/[area]/steder/[slug]/page.tsx:46`

**Current:** `type: "website"`
**Should be:** `type: "place"` for POI pages, or `"restaurant"` / `"hotel"` for specific types.

### 7. MEDIUM: priceRange missing in structured data
**File:** `components/seo/POIJsonLd.tsx`

Google recommends `priceRange` for LocalBusiness/Restaurant/Hotel. Not currently included.

**Fix:** Requires a database field or heuristic. Could map from Google Places `price_level` (1-4) to "$"–"$$$$".

### 8. MEDIUM: Missing favicon and apple-touch-icon
**File:** `app/layout.tsx`

No `<link rel="icon">` or `<link rel="apple-touch-icon">` in root layout. Google displays favicons in search results.

### 9. MEDIUM: Wrong schema type mapping for some POIs
**File:** `components/seo/POIJsonLd.tsx:12-26`

Britannia Hotel gets `Restaurant` schema because its `category.id` is likely `restaurant`. Hotels with restaurant focus still should use `Hotel` as primary type, potentially with `Restaurant` as secondary.

**Fix:** Consider a `schemaTypeOverride` field on POI, or use `Hotel` when the POI name contains "Hotel/Hotell".

### 10. LOW-MEDIUM: Missing twitter:site meta tag
**File:** `app/(public)/[area]/steder/[slug]/page.tsx` generateMetadata

No `twitter.site` or `twitter.creator` in metadata. Add `@placy_no` (or whatever the Twitter handle is).

### 11. LOW-MEDIUM: No Organization schema on site level
**File:** `app/layout.tsx`

A site-wide `Organization` or `WebSite` schema with logo, name, sameAs (social profiles) strengthens E-E-A-T signals.

### 12. LOW: robots.txt blocks /api/ including image proxy
**File:** `public/robots.txt`

`Disallow: /api/` blocks `/api/places/photo` which serves POI images. Images served via this proxy can't be crawled.

**Note:** This is mostly mitigated now that we use `featuredImage` (direct Supabase URLs) instead of the photo proxy for most POIs. Only legacy POIs without `featuredImage` are affected.

### 13. LOW: Missing currenciesAccepted/paymentAccepted
Optional schema.org fields that add minor local SEO signal. Low priority.

## Priority Implementation Order

| # | Tiltak | Effort | Impact | Files |
|---|--------|--------|--------|-------|
| 1 | Parse openingHours to OpeningHoursSpecification | Medium | High | POIJsonLd.tsx |
| 2 | Add addressLocality to PostalAddress | Low | High | POIJsonLd.tsx |
| 3 | Pass galleryImages array to JSON-LD | Low | High | POIJsonLd.tsx, page.tsx |
| 4 | Add generateStaticParams | Medium | High | page.tsx, public-queries.ts |
| 5 | Real lastmod in sitemap | Medium | Medium | sitemap.ts |
| 6 | Change og:type to "place" | Low | Medium | page.tsx |
| 7 | Add priceRange from price_level | Low | Medium | POIJsonLd.tsx |
| 8 | Add favicon + apple-touch-icon | Low | Medium | layout.tsx, /public |
| 9 | Fix schema type for hotels | Low | Medium | POIJsonLd.tsx |
| 10 | Add twitter:site | Low | Low-Med | page.tsx |
| 11 | Add Organization schema | Low | Low-Med | layout.tsx |
| 12 | Exempt image proxy from robots.txt | Low | Low | robots.txt |

## Prevention / Future Guidance

- **Test structured data with Google Rich Results Test** after every change to JSON-LD components
- **Use Google Search Console** to monitor rich result eligibility and errors
- **Run PageSpeed Insights** on mobile for every public page change
- **Schema type should match the POI**, not just the category — consider override field
- **Opening hours must be schema.org format**, not raw Google Places format
- **Sitemap lastmod must reflect real changes** or Google ignores it entirely

## Related Issues

- See also: [seo-keyword-strategy-public-site-20260213.md](../best-practices/seo-keyword-strategy-public-site-20260213.md) — SEO keyword strategy and content planning
- See also: [public-seo-site-route-architecture-20260213.md](../architecture-patterns/public-seo-site-route-architecture-20260213.md) — Technical route architecture
- See also: [mobile-lcp-image-proxy-chain-20260214.md](../performance-issues/mobile-lcp-image-proxy-chain-20260214.md) — LCP performance fix for image proxy
- See also: [sitemap-robots-404-production-PublicSite-20260213.md](../integration-issues/sitemap-robots-404-production-PublicSite-20260213.md) — Sitemap/robots.txt production fix
