---
module: Google Places Integration
date: 2026-02-16
problem_type: best_practice
component: api_routes
symptoms:
  - "API key leaked in JSON response photo URLs"
  - "Unvalidated placeId/photoReference passed to Google API URLs"
  - "POST handler accepts arbitrary lat/lng/radius/type without bounds"
  - "In-memory cache with no size limit"
root_cause: missing_validation
resolution_type: code_fix
severity: high
tags: [security, api-routes, input-validation, key-leakage, google-places]
---

# API Route Security Hardening — Google Places Proxy

## Problem

All Google Places API proxy routes (`/api/places`, `/api/places/photo`, `/api/places/[placeId]`) had security vulnerabilities:

1. **API key leakage**: GET response included full Google URLs with `&key=` parameter, exposing the API key to any browser/network tab
2. **No input validation**: `placeId`, `photoReference`, `maxWidth`, `lat`, `lng`, `radius`, and `type` parameters were interpolated directly into Google API URLs without validation
3. **Unbounded cache**: In-memory Map had no size limit — an attacker could exhaust server memory with unique placeId requests

## Root Cause

Original routes were written as minimal proxies without security considerations. API key was included in response URLs for convenience, and all inputs were trusted.

## Solution

### 1. API key removed from responses

Photo URLs in GET response now use internal proxy path instead of direct Google URLs:

```typescript
// Before (INSECURE)
url: `https://maps.googleapis.com/.../photo?...&key=${apiKey}`

// After
url: `/api/places/photo?photoReference=${encodeURIComponent(ref)}&maxWidth=400`
```

### 2. Input validation with regex + bounds

```typescript
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,300}$/;
const PHOTO_REF_PATTERN = /^[A-Za-z0-9_-]{1,500}$/;

// lat: [-90, 90], lng: [-180, 180]
// radius: [1, 50000]
// type: validated against allowlist of 20 common place types
// maxWidth: clamped to [1, 1600]
// fields: filtered against allowlist of known Google fields
```

### 3. Cache size capped

```typescript
const MAX_CACHE_SIZE = 2000;
// Eviction: sort by timestamp, remove oldest entries
```

### 4. JSON parse guarded

```typescript
let body: Record<string, unknown>;
try {
  body = await request.json();
} catch {
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}
```

## Files Changed

| File | Change |
|------|--------|
| `app/api/places/route.ts` | placeId/fields validation, key removed from URLs, POST input validation |
| `app/api/places/photo/route.ts` | photoReference regex, maxWidth clamping |
| `app/api/places/[placeId]/route.ts` | placeId regex, cache size cap |
| `scripts/refresh-photo-urls.ts` | --days 0 bug fix (>= instead of >) |

## Prevention

- **Never include API keys in JSON responses** — use internal proxy routes
- **Always validate inputs at API boundaries** — regex for IDs, bounds for numbers, allowlists for enums
- **Cap in-memory caches** — unbounded Maps can be exploited for memory exhaustion
- **Wrap request.json()** — malformed body should return 400, not 500
- **Add length limits to regex patterns** — `+` allows arbitrarily long strings

## Related

- `docs/solutions/best-practices/places-api-new-photo-migration-20260216.md` — Places API (New) migration
- PR #47
