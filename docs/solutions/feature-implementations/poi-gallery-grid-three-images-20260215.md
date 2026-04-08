---
title: "POI Image Gallery Grid — 3 Images from Google Places"
date: 2026-02-15
category: feature-implementations
tags: [google-places, photos, gallery, grid-layout, responsive, backfill]
module: public/poi-detail
symptoms:
  - POI detail pages show only a single hero image
  - Desktop layout has wasted horizontal space above the fold
  - No visual variety — all POI pages look identical in image area
root_cause: Only 1 photo fetched per POI from Google Places API; gallery_images column did not exist
---

# POI Image Gallery Grid — 3 Images from Google Places

## Problem

POI detail pages (e.g., `/trondheim/steder/antikvariatet`) displayed a single 21:9 hero image. Google Places API returns up to 10 photos per place, but only the first was used. The desktop layout felt flat compared to competitors like Google Maps which show a multi-image grid.

## Solution

### 1. Database Migration

Added `gallery_images text[]` column to the `pois` table:

```sql
-- supabase/migrations/040_add_gallery_images.sql
ALTER TABLE pois ADD COLUMN IF NOT EXISTS gallery_images text[];
```

### 2. Type & Query Updates

Added `galleryImages?: string[]` to the `POI` TypeScript interface and mapped it in `transformPublicPOI`:

```typescript
// lib/types.ts
galleryImages?: string[];

// lib/public-queries.ts — in transformPublicPOI
galleryImages: Array.isArray(dbPoi.gallery_images) ? (dbPoi.gallery_images as string[]) : undefined,
```

### 3. Backfill Script

Created `scripts/backfill-gallery-images.ts` — fetches up to 3 photos per POI from Google Places Details API, resolves them to direct CDN URLs (`lh3.googleusercontent.com`), and stores in `gallery_images[]`.

```bash
npx tsx scripts/backfill-gallery-images.ts --area trondheim
```

**Results:** 481 of 553 Trondheim POIs updated. 72 had no photos on Google. Cost ~$15 total.

Photo sizes: main image at 800px, secondary images at 400px.

### 4. UI — Responsive Grid Layout

```tsx
{galleryImages.length >= 3 ? (
  <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] md:grid-rows-2 gap-1 rounded-xl overflow-hidden mb-6 md:h-[340px]">
    {/* Main image — full height on left */}
    <div className="relative aspect-[16/9] md:aspect-auto md:row-span-2 bg-[#f5f3f0]">
      <Image src={galleryImages[0]} alt={poi.name} fill className="object-cover" priority />
    </div>
    {/* Secondary images — stacked on right, hidden on mobile */}
    <div className="hidden md:block relative bg-[#f5f3f0]">
      <Image src={galleryImages[1]} alt={`${poi.name} — bilde 2`} fill className="object-cover" />
    </div>
    <div className="hidden md:block relative bg-[#f5f3f0]">
      <Image src={galleryImages[2]} alt={`${poi.name} — bilde 3`} fill className="object-cover" />
    </div>
  </div>
) : galleryImages.length > 0 ? (
  /* Fallback: single 21:9 hero image */
) : null}
```

**Layout behavior:**
- **Desktop (md+):** 2fr/1fr grid, 2 rows. Main image spans both rows on left, 2 smaller images stacked on right. Fixed height 340px.
- **Mobile:** Only the main image shown at 16:9. Secondary images hidden with `hidden md:block`.
- **Fallback:** POIs with < 3 images show the original single 21:9 hero. POIs with 0 images show nothing.

### 5. Fetch Script Updated

`lib/utils/fetch-poi-photos.ts` now resolves up to 3 gallery images alongside the featured image for new POIs going forward.

## Key Decisions

- **`gallery_images` stores all 3 URLs**, not just the 2 extras. First element matches `featured_image`. Simpler for the UI to consume.
- **Mobile shows only 1 image** — 3 tiny images on a 390px screen adds nothing. Clean single image is better.
- **Fixed height (340px) on desktop** instead of aspect-ratio — prevents the grid from being too short or too tall depending on container width.
- **Google Places API returns up to 10 photos** — we only fetch 3. Can increase later if a larger gallery is needed.

## Prevention / Best Practices

**Always resolve Google Photo URLs to CDN at admin/build time:**
The redirect chain `photo API → 302 → lh3.googleusercontent.com` adds latency if done at page render. Resolve at backfill time and store the direct CDN URL.

**Backfill scripts should be idempotent and area-scoped:**
`--area trondheim` flag lets you backfill incrementally. Skips POIs that already have `gallery_images`.

**Google Places API cost awareness:**
- Details API (fields=photos): ~$0.007 per call
- Photo API (resolve redirect): ~$0.007 per call
- 3 photos per POI = ~$0.028 per POI
- 553 POIs = ~$15 for full backfill

## Related Files

**Created:**
- `supabase/migrations/040_add_gallery_images.sql` — Schema change
- `scripts/backfill-gallery-images.ts` — Batch backfill script

**Modified:**
- `app/(public)/[area]/steder/[slug]/page.tsx` — Gallery grid UI
- `lib/types.ts` — `galleryImages` field
- `lib/public-queries.ts` — `gallery_images` mapping
- `lib/utils/fetch-poi-photos.ts` — Fetch up to 3 photos

**Related docs:**
- `docs/solutions/feature-implementations/auto-fetch-poi-photos-after-import-20260208.md` — Original photo fetch pipeline
- `docs/solutions/performance-issues/mobile-lcp-image-proxy-chain-20260214.md` — Why CDN URLs are better than proxy
