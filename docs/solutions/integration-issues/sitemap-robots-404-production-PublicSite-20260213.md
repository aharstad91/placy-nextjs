---
module: Public Site
date: 2026-02-13
problem_type: integration_issue
component: development_workflow
symptoms:
  - "placy.no/sitemap.xml returns 404 HTML page instead of XML"
  - "placy.no/robots.txt returns 404 HTML page instead of text"
  - "Google has no way to discover or crawl any public pages"
root_cause: config_error
resolution_type: config_change
severity: critical
tags: [seo, sitemap, robots-txt, vercel, next-js, deployment, google-indexing]
---

# Troubleshooting: sitemap.xml and robots.txt Return 404 in Production

## Problem

Both `placy.no/sitemap.xml` and `placy.no/robots.txt` return a 404 HTML page instead of their expected XML/text content. This completely blocks Google from discovering and indexing any public pages on the site. The code exists (`app/sitemap.ts`, `app/robots.ts`) but is not being served correctly in the Vercel production deployment.

## Environment

- Module: Public Site (placy.no)
- Stack: Next.js 14, Vercel, Supabase
- Affected routes: `/sitemap.xml`, `/robots.txt`
- Date: 2026-02-13

## Symptoms

- `curl -sL https://placy.no/sitemap.xml` returns a full HTML 404 page with `<meta name="robots" content="noindex"/>`
- `curl -sL https://placy.no/robots.txt` returns the same HTML 404 page
- The 404 page itself contains `noindex` meta tag, so Google is actively told NOT to index
- All ~630 potential public pages (areas, categories, POIs in NO+EN) are invisible to search engines
- Google Search Console would show zero indexed pages

## Investigation

### What we verified exists in code

1. **`app/sitemap.ts`** — Dynamic sitemap generator querying Supabase for areas, categories, POIs. Generates ~630 URLs for Trondheim alone.

2. **`app/robots.ts`** — Returns rules allowing `/` and disallowing `/for/`, `/admin/`, `/api/`. Points to `https://placy.no/sitemap.xml`.

3. **`app/(public)/` route group** — Full public site with ISR, generateMetadata, JSON-LD structured data, hreflang alternates.

4. **SEO components** — `POIJsonLd`, `BreadcrumbJsonLd`, `ItemListJsonLd`, `FAQJsonLd` all implemented and used.

### Root cause hypotheses

The code exists but isn't serving. Possible causes:

1. **Vercel deployment not including the route** — `app/sitemap.ts` may need a redeploy or the build is stale
2. **Middleware conflict** — `middleware.ts` routes based on `KNOWN_AREAS` and `KNOWN_CUSTOMERS`. It may be intercepting `/sitemap.xml` and `/robots.txt` requests and routing them to 404
3. **Route group conflict** — `app/(public)/` route group may be catching all root-level requests before `app/sitemap.ts` gets a chance
4. **Build error** — `sitemap.ts` queries Supabase at build time. If Supabase connection fails during build, the route may be excluded silently

### Most likely cause: Middleware interception

The `middleware.ts` file discriminates routes by first path segment. `sitemap.xml` and `robots.txt` are root-level files that don't match any known area or customer slug. The middleware may be sending them to a catch-all 404 instead of letting Next.js handle them as special routes.

## Solution

**NOT YET FIXED** — This document captures the finding for resolution in the next session.

### Recommended fix approach

1. **Check middleware.ts** — Add explicit passthrough for `/sitemap.xml` and `/robots.txt`:
   ```typescript
   // In middleware matcher or early return
   const PASSTHROUGH_PATHS = ['/sitemap.xml', '/robots.txt', '/favicon.ico'];
   if (PASSTHROUGH_PATHS.some(p => pathname === p)) {
     return NextResponse.next();
   }
   ```

2. **Test locally** — Run `npm run build && npm start` and verify:
   ```bash
   curl http://localhost:3000/sitemap.xml | head -20
   curl http://localhost:3000/robots.txt
   ```

3. **Verify Supabase connection at build time** — Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available in Vercel build environment (sitemap.ts needs them).

4. **Deploy and verify** — After fix, submit sitemap to Google Search Console.

## Why This Matters

This is a **critical SEO blocker**. Without sitemap.xml and robots.txt:
- Google cannot discover any of the ~630 public pages
- No organic search traffic is possible
- All the SEO infrastructure (JSON-LD, hreflang, metadata, ISR) is wasted
- The entire public site might as well not exist from Google's perspective

### SEO context from this session

- **Volume with quality matters** — 300 POIs with editorial hooks > 3000 POIs with just Google data
- **Category pages are the main ranking targets** — `/trondheim/restauranter` matches "restaurant trondheim" search intent
- **Thin content risk** — POI pages without editorial_hook/local_insight are thin content that can hurt domain authority
- **Topical authority feedback loop** — More quality pages → Google trusts domain more → existing pages rank better
- **Placy's differentiator** — Editorial hooks, local insights, tier curation, contextual recommendations. Google has the rest.

## Prevention

- **Always test sitemap.xml and robots.txt after deployment** — Add to deploy checklist
- **Middleware should explicitly whitelist known Next.js special routes** (sitemap.xml, robots.txt, favicon.ico, manifest.json)
- **Monitor Google Search Console** — Set up after launch, check indexing status weekly
- **Verify build-time data access** — Sitemap generators that query databases need env vars available at build time, not just runtime

## Related Issues

- See also: [public-seo-site-route-architecture-20260213.md](../architecture-patterns/public-seo-site-route-architecture-20260213.md) — Route architecture that may be causing the conflict
- See also: [seo-content-strategy-public-site-20260213.md](../feature-implementations/seo-content-strategy-public-site-20260213.md) — Content strategy that depends on this being fixed
- See also: [seo-keyword-strategy-public-site-20260213.md](../best-practices/seo-keyword-strategy-public-site-20260213.md) — Keyword strategy that requires Google indexing
