---
module: Public Category Pages
date: 2026-02-14
problem_type: performance_issue
component: frontend_stimulus
symptoms:
  - "Mobile LCP 4.4s (red) on PageSpeed Insights for /trondheim/bakerier"
  - "Performance score 85/100 on mobile"
  - "LCP element: CategoryHighlights image (Google Places photo via proxy)"
  - "Resource load duration 1,580ms on Slow 4G for LCP image"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [pagespeed, lcp, image-optimization, google-places, proxy-chain, isr, next-image, cdn-caching]
---

# Troubleshooting: Mobile LCP 4.4s caused by Google Places photo proxy chain

## Problem
Mobile PageSpeed performance score was 85 with LCP at 4.4s (red). The LCP element was a Google Places photo served through a 3-hop proxy chain, adding unnecessary network latency on mobile connections.

## Environment
- Module: Public category pages (Next.js App Router, ISR)
- Stack: Next.js 14, Vercel, Google Places API, next/image
- Affected Component: `components/public/CategoryHighlights.tsx`, `app/api/places/photo/route.ts`
- Date: 2026-02-14

## Symptoms
- Mobile PageSpeed Performance: 85/100
- LCP: 4.4s (red) — should be < 2.5s for green
- LCP element: First image in "Redaksjonens favoritter" section (CategoryHighlights)
- LCP breakdown: TTFB 0ms, Resource load delay 610ms, Resource load duration 1,580ms, Element render delay 30ms
- Desktop was fine (99 Performance, 0.8s LCP) because fast network masks the proxy overhead

## What Didn't Work

**Attempted Solution 1:** Using `priority` prop on next/image for LCP images
- **Why it wasn't enough:** `priority` adds `fetchpriority="high"` and `<link rel="preload">`, which helps the browser discover the image earlier (reducing the 610ms delay somewhat). But the actual image download still went through the full proxy chain, keeping the 1,580ms resource load duration.

**Attempted Solution 2:** Initial attempt to resolve photo URLs using `poi.photoReference`
- **Why it failed:** The `photo_reference` column was NULL in the database for the relevant POIs. The photo reference was instead embedded inside the `featured_image` column as a proxy URL string (`/api/places/photo?photoReference=...&maxWidth=800`). Had to extract the reference from the URL with regex.

## Solution

### Root fix: Resolve Google Places photo redirects at ISR time

The Google Places Photo API returns a 302 redirect to a public `lh3.googleusercontent.com` URL. By resolving this redirect at ISR build time, we can use the direct CDN URL in `<Image>`, eliminating the proxy chain entirely.

**Before (slow — 3 network hops):**
```
Browser → /_next/image → /api/places/photo (serverless) → Google Places API → 302 → lh3.googleusercontent.com
```

**After (fast — 1 network hop):**
```
Browser → /_next/image → lh3.googleusercontent.com (direct)
```

**New utility — `lib/resolve-photo-url.ts`:**
```typescript
export async function resolveGooglePhotoUrl(
  photoReference: string,
  maxWidth = 400,
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${apiKey}`;
    const res = await fetch(url, { redirect: "manual", cache: "force-cache" });

    if (res.status === 302) {
      const location = res.headers.get("location");
      if (location?.includes("googleusercontent.com")) {
        return location;
      }
    }
    return null;
  } catch {
    return null;
  }
}
```

**Usage in category page — `app/(public)/[area]/[category]/page.tsx`:**
```typescript
// Extract photoReference from proxy URL in featured_image column
await Promise.all(
  editorialFeatured.slice(0, 2).map(async (poi) => {
    const ref =
      poi.photoReference ??
      poi.featuredImage?.match(/photoReference=([^&]+)/)?.[1];
    if (ref) {
      const decoded = decodeURIComponent(ref);
      const resolved = await resolveGooglePhotoUrl(decoded, 400);
      if (resolved) poi.featuredImage = resolved;
    }
  }),
);
```

### Supporting changes

**Photo proxy caching — `app/api/places/photo/route.ts`:**
```typescript
// Before:
"Cache-Control": "public, max-age=2592000",
"CDN-Cache-Control": "public, max-age=2592000",

// After:
"Cache-Control": "public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400",
```

**Image optimization cache — `next.config.mjs`:**
```javascript
images: {
  minimumCacheTTL: 2592000, // 30 days — match photo proxy cache
  // ... remotePatterns
}
```

## Why This Works

1. **Root cause:** The LCP image went through 3 network hops: browser → Vercel's `/_next/image` optimizer → our `/api/places/photo` serverless function → Google Places Photo API (which itself 302-redirects to `lh3.googleusercontent.com`). On mobile Slow 4G, each hop adds 200-600ms of latency.

2. **The solution works because:** Google Places Photo API consistently returns a 302 redirect to a **public** `lh3.googleusercontent.com/places/...` or `/place-photos/...` URL. These URLs:
   - Contain no API key (safe to expose to clients)
   - Are long-lived (months to years)
   - Are served from Google's global CDN (fast worldwide)

3. **ISR caching means minimal cost:** Since the category page uses ISR (`revalidate = 86400`), the Google API call to resolve the redirect happens only once per 24h per page. The resolved URL is then baked into the rendered HTML.

4. **Graceful fallback:** If the resolve fails (expired reference, API error), `poi.featuredImage` keeps its original proxy URL value. The page still works, just with the slower proxy chain.

## Key Discovery: featured_image contains proxy URLs

The `featured_image` column in the database was populated with proxy URL strings like:
```
/api/places/photo?photoReference=AcnlKN3Fg0Y...&maxWidth=800
```

This means ALL image loading went through the serverless proxy, even when `featuredImage` was set. The `photo_reference` column was NULL for many POIs. To resolve the redirect, we had to extract the photoReference from the proxy URL using regex: `poi.featuredImage?.match(/photoReference=([^&]+)/)?.[1]`.

## Results

| Metric | Desktop | Mobile (before) | Mobile (after) |
|--------|---------|-----------------|----------------|
| Performance | 99 | 85 | **97** |
| LCP | 0.8s | 4.4s (red) | **2.6s** (yellow) |
| TBT | 0ms | 0ms | 0ms |
| CLS | 0 | 0 | 0 |

## Prevention

- **Never use API proxies for LCP-critical images.** If an image is above the fold and likely to be the LCP element, resolve to a direct CDN URL at build/ISR time
- **Check what `featured_image` actually contains.** Don't assume it's a direct URL — it might be a proxy path
- **Use `s-maxage` and `stale-while-revalidate`** on all image proxy endpoints for proper Vercel CDN caching
- **Set `minimumCacheTTL`** in next.config to match your image proxy's cache duration
- **Measure mobile separately.** Desktop scores can be perfect while mobile suffers from network-sensitive issues (proxy chains, large images) that fast connections mask

## Related Issues

- See also: [seo-keyword-strategy-public-site-20260213.md](../best-practices/seo-keyword-strategy-public-site-20260213.md) — SEO strategy for the same public pages
- See also: [public-seo-site-route-architecture-20260213.md](../architecture-patterns/public-seo-site-route-architecture-20260213.md) — Architecture for the public site routes
