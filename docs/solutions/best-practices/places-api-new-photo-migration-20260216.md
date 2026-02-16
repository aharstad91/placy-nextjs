---
module: Google Places Integration
date: 2026-02-16
problem_type: best_practice
component: tooling
symptoms:
  - "Google Places API photo costs at $17/1K + $7/1K per operation"
  - "Legacy Place Details + Photo API costing ~kr 350/month"
  - "302 redirect hack required to get CDN URLs"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [google-places, api-migration, cost-reduction, places-api-new, photo-api]
---

# Places API (New) Migration for Photo Operations

## Problem

All photo operations (fetch references, resolve CDN URLs) used Google Places Legacy API:
- Place Details: `maps.googleapis.com/maps/api/place/details/json` ($17/1K requests)
- Place Photo: `maps.googleapis.com/maps/api/place/photo` ($7/1K requests)
- Photo resolution required 302 redirect hack (`redirect: "manual"` + read Location header)
- Combined cost: ~kr 350/month for ~500 POIs

## Root Cause

Using the legacy API when Places API (New) offers the same photo operations at $0 under the "Essentials (IDs Only)" pricing tier.

## Solution

### Shared helper module: `lib/google-places/photo-api.ts`

Two functions replace all legacy photo operations:

**`fetchPhotoNames(placeId, apiKey)`** — $0 via Essentials IDs Only:
```typescript
GET https://places.googleapis.com/v1/places/{placeId}
Headers: X-Goog-Api-Key: KEY, X-Goog-FieldMask: photos
→ { photos: [{ name: "places/X/photos/REF" }] }
```

**`resolvePhotoUri(photoName, apiKey, maxWidthPx)`** — $0:
```typescript
GET https://places.googleapis.com/v1/{photoName}/media?maxWidthPx=800&skipHttpRedirect=true
Headers: X-Goog-Api-Key: KEY
→ { photoUri: "https://lh3.googleusercontent.com/..." }
```

### Key design decisions

1. **Dual-format support**: `photo_reference` column stores both legacy (opaque string) and new (`places/{id}/photos/{ref}`) formats. `isNewPhotoFormat()` detects by regex.

2. **Gradual migration**: Legacy data migrated automatically via refresh script. ISR-time resolution kept legacy fallback during transition.

3. **Error distinction**: `fetchPhotoNames` returns `[]` for 404 (no photos), but throws on 403/429/500 to prevent scripts from interpreting API errors as "no photos" and deleting existing data.

4. **API key in headers**: Consistent `X-Goog-Api-Key` header usage (not URL query params) to avoid log leakage.

5. **Photo proxy kept**: `app/api/places/photo/route.ts` still needed as fallback for components using `photoReference` directly. Will be deleted when all components use `featuredImage`.

## Files changed

| File | Change |
|------|--------|
| `lib/google-places/photo-api.ts` | NEW — shared helpers |
| `lib/utils/fetch-poi-photos.ts` | Import pipeline uses New API |
| `scripts/resolve-photo-urls.ts` | Batch resolve with migration |
| `scripts/refresh-photo-urls.ts` | Refresh with dual-format |
| `scripts/backfill-gallery-images.ts` | Gallery backfill uses New API |
| `lib/resolve-photo-url.ts` | DELETED (dead code) |

## Prevention

- **Always check API pricing tiers** before implementing Google Maps Platform integrations
- Places API (New) Essentials tier is free for basic metadata including photos
- Use `X-Goog-FieldMask` to request only needed fields — this determines pricing tier
- Never put API keys in URL query params when headers are available

## Related

- `docs/solutions/best-practices/google-places-photo-cost-reduction-20260216.md` — Phase 1: freshness tracking
- `docs/solutions/performance-issues/google-api-runtime-cost-leakage-20260215.md` — Original cost discovery
