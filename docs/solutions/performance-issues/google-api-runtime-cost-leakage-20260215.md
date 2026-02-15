---
module: Google Places Integration
date: 2026-02-15
problem_type: performance_issue
component: api_integration
symptoms:
  - "339 NOK Google Maps Platform bill for half-month February"
  - "7,589 Places API requests in 15 days"
  - "useOpeningHours hook fires Places Details on every viewport change"
  - "Photo proxy /api/places/photo called on every image render"
root_cause: runtime_api_calls_instead_of_cached_data
severity: high
tags: [google-places, api-cost, caching, supabase, performance]
---

# Google Places API Runtime Cost Leakage

## Problem

339 NOK Google Maps Platform costs in first half of February 2026. Three sources:

1. **useOpeningHours hook** — fetched Places Details (Contact + Atmosphere fields) for up to 10 POIs per viewport change. Expensive SKU ($0.017/call).
2. **Photo proxy** — `/api/places/photo` called on every image render. Each call = 1 Places Photo API request.
3. **In-memory cache** — `Map()` cache in `/api/places/[placeId]` resets on every Vercel cold start/deploy, making it useless.

## Root Cause

Data that should be fetched once at import time was being fetched at runtime on every page view. The `featured_image` column stored proxy URLs (`/api/places/photo?photoReference=...`) instead of direct CDN URLs.

## Solution

### 1. Photo URLs — resolve at import time

Google Places Photo API returns 302 redirect to `lh3.googleusercontent.com` — public, no API key needed, long-lived.

**Batch script** `scripts/resolve-photo-urls.ts`:
- Resolves all proxy URLs to CDN URLs in one batch
- Distinguishes "resolved OK" / "expired reference" / "network error"
- Idempotent — skips POIs already having CDN URLs

**Import-time fix** in `lib/utils/fetch-poi-photos.ts`:
- New POIs imported via curator now resolve CDN URL immediately

### 2. Opening hours + phone — cache in Supabase

**Migration** `032_opening_hours_phone_cache.sql`:
- Added `opening_hours_json JSONB`, `google_phone TEXT`, `opening_hours_updated_at TIMESTAMPTZ`

**Batch script** `scripts/refresh-opening-hours.ts`:
- Fetches opening_hours + phone for all POIs with google_place_id
- Stores `weekday_text` array (NOT `open_now` — that's computed client-side)
- Run monthly or as needed

**Client changes:**
- `useOpeningHours` rewritten — reads from `poi.openingHoursJson`, computes `isOpen` from `weekday_text`
- `MapPopupCard` — removed `fetch()`, uses `computeIsOpen` shared utility
- `poi-card-expanded` — uses `poi.googleWebsite` and `poi.googlePhone` directly

### 3. Key insight: compute `isOpen` client-side

Storing `open_now` from Google would create stale data (snapshot at fetch time). Instead, store `weekday_text` and compute open/closed in the browser using current time. Handles:
- "Closed" / "Open 24 hours"
- Single range: "8:00 AM – 5:00 PM"
- Multiple ranges: "8:00 AM – 12:00 PM, 1:00 PM – 5:00 PM"
- Overnight: "6:00 PM – 2:00 AM"

## Files Changed

| File | Change |
|------|--------|
| `lib/types.ts` | Added `googlePhone`, `openingHoursJson` to POI |
| `lib/hooks/useOpeningHours.ts` | Rewritten — no API calls, reads cached data |
| `lib/public-queries.ts` | Added field mappings |
| `lib/supabase/queries.ts` | Added field mappings + `getPOIsWithinRadius` |
| `lib/utils/fetch-poi-photos.ts` | Resolves CDN URL at import time |
| `components/poi/poi-card-expanded.tsx` | Uses cached website/phone |
| `components/variants/report/MapPopupCard.tsx` | Uses cached hours, shared `computeIsOpen` |
| `app/(public)/[area]/[category]/page.tsx` | Removed ISR-time `resolveGooglePhotoUrl` |
| `scripts/resolve-photo-urls.ts` | One-time batch migration |
| `scripts/refresh-opening-hours.ts` | Monthly refresh script |
| `supabase/migrations/032_opening_hours_phone_cache.sql` | New columns |

## Prevention

- Never store proxy URLs in database — always resolve to final CDN URL at import time
- Never fetch Google API at runtime for data that changes slowly (hours, phone, photos)
- In-memory caches on Vercel serverless are worthless — use Supabase
- When caching time-dependent data: store the raw schedule, compute state client-side

## Expected Impact

~15,000 → <100 API calls/month (only new imports + monthly refresh)
