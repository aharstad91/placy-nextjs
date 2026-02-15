---
module: System
date: 2026-02-15
problem_type: best_practice
component: development_workflow
symptoms:
  - "Unsplash website is SPA-rendered, WebFetch cannot extract image URLs"
  - "Pexels API returns 403 Forbidden without API key"
  - "Pixabay downloads return 35-byte redirect files instead of images"
  - "Need free, CC-licensed images for Norwegian locations"
root_cause: wrong_api
resolution_type: workflow_improvement
severity: medium
tags: [images, wikimedia-commons, cover-images, next-js, free-images]
---

# Best Practice: Wikimedia Commons API for Free Image Sourcing

## Problem
When sourcing free images programmatically for cover images, hero banners, or editorial content, popular image services fail in non-browser contexts. Unsplash is SPA-rendered (no scrapable URLs), Pexels returns 403 without an API key, and Pixabay download links redirect instead of serving the file.

## Environment
- Module: System-wide (any project needing free images)
- Affected Component: Image sourcing for Next.js `public/` directory
- Date: 2026-02-15

## Symptoms
- WebFetch on Unsplash returns empty/minimal HTML (SPA renders client-side)
- Pexels API returns `403 Forbidden` for unauthenticated requests
- Pixabay download URLs return 35-byte redirect HTML instead of actual image data
- Need reliable, stable URLs for CC-licensed images of specific locations

## What Didn't Work

**Attempted Solution 1:** Unsplash website scraping
- **Why it failed:** Unsplash is a single-page application — HTML contains no image URLs, everything renders client-side via JavaScript

**Attempted Solution 2:** Pexels direct download
- **Why it failed:** Returns 403 Forbidden without a registered API key

**Attempted Solution 3:** Pixabay download URLs
- **Why it failed:** Download links (`pixabay.com/photos/download/...`) return a 35-byte redirect page, not the actual image binary

## Solution

Use **Wikimedia Commons REST API** which returns JSON with direct image URLs and supports thumbnail generation at any width.

**Search for images by topic:**
```bash
# Search Wikimedia Commons for images
curl "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=Bakklandet+Trondheim&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1200&format=json"
```

**Get a specific image with thumbnail:**
```bash
# Get specific file with 1200px thumbnail
curl "https://commons.wikimedia.org/w/api.php?action=query&titles=File:Bakklandet_in_Trondheim_3.jpg&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json"
```

**Download to project:**
```bash
# Download the thumbnail URL from the JSON response
curl -L -o public/trips/bakklandet.jpg \
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Bakklandet_in_Trondheim_3.jpg/1200px-Bakklandet_in_Trondheim_3.jpg"
```

**Key API parameters:**
- `iiurlwidth=1200` — generates a 1200px-wide thumbnail (good for hero images)
- `gsrnamespace=6` — search only in File namespace (images)
- `iiprop=url|size|mime` — get URL, dimensions, and MIME type
- Response contains `thumburl` (resized) and `url` (original)

**Typical file sizes:** 200-350KB for 1200px thumbnails — acceptable for web use.

**Update database:**
```typescript
// scripts/set-cover-images.ts
const imageMap: Record<string, string> = {
  "bakklandet-og-bryggene": "/trips/bakklandet.jpg",
  "smak-av-trondheim": "/trips/smak-av-trondheim.jpg",
  "midtbyen-pa-30-minutter": "/trips/midtbyen.jpg",
};

for (const [slug, path] of Object.entries(imageMap)) {
  await supabase.from("trips").update({ cover_image_url: path }).eq("slug", slug);
}
```

## Why This Works

1. **Wikimedia Commons API is a proper REST API** — returns structured JSON, not HTML that needs parsing
2. **Thumbnail generation is server-side** — `iiurlwidth` parameter creates resized versions without needing to download the full original
3. **URLs are stable** — `upload.wikimedia.org` URLs don't change or expire
4. **CC-licensed** — all Wikimedia Commons content is freely licensed (though attribution may be required)
5. **Excellent coverage of Norwegian locations** — Wikipedia editors have uploaded high-quality photos of Trondheim, Bergen, Oslo etc.

## Prevention

- **Default to Wikimedia Commons API** for free image sourcing in development/demos
- **Store images locally** in `public/` rather than relying on external URLs — eliminates CORS issues and third-party dependencies
- **Use 1200px thumbnails** — good balance between quality and file size for web heroes
- **Note licensing requirements** — Wikimedia images require attribution for production use (CC-BY-SA typically)
- **For production:** Consider professional photography or a paid service (Shutterstock, Getty) for brand-quality images

## Related Issues

- See also: [trips-visual-polish-sprint5-20260215.md](../ui-patterns/trips-visual-polish-sprint5-20260215.md)
