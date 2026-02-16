---
module: Google Places Integration
date: 2026-02-16
problem_type: best_practice
component: tooling
symptoms:
  - "Google Places Photo API costs kr 353 in 15 days (71% of total API spend)"
  - "6,248 Photo API calls in half a month from runtime proxy usage"
  - "Each page load triggers /api/places/photo proxy which calls Google"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: high
tags: [google-places, api-cost, photo-urls, lh3, cdn, caching]
---

# Google Places Photo API Cost Reduction

## Problem

Google Places Photo API costs reached kr 353 in 15 days (projected ~kr 700/month), representing 71% of total API spend. Root cause: POI images were served through a proxy endpoint (`/api/places/photo?photoReference=...`) that called Google on every page load.

## Investigation

1. Analyzed February 2026 billing data — Photo SKU was 6,248 calls at kr 353.18
2. Found 17+ files referencing proxy URL pattern `/api/places/photo?photoReference=`
3. Discovered existing `resolve-photo-urls.ts` script already resolves to CDN URLs
4. But no mechanism to track URL freshness or refresh stale URLs

## Key Findings

### lh3 CDN URLs are NOT permanent
- Google documentation says photo URLs are "short-lived" (~60 min for Photos API)
- In practice, Places API URLs last weeks to months
- **Must have a refresh mechanism** — cannot resolve once and forget

### Google TOS prohibits copying photos
- Section 10.5d: max 30-day caching of Places content
- Copying to Supabase Storage/R2 violates TOS
- Next.js Image Optimization `minimumCacheTTL` is a compliant cache layer

### Places API (New) makes photo-only calls FREE
- `Essentials IDs Only` tier: $0 per call for photo-only Place Details
- `skipHttpRedirect=true` returns `photoUri` directly (no redirect hack needed)
- Migration should be prioritized as next step

## Solution

### 1. Add `photo_resolved_at` tracking column
```sql
ALTER TABLE pois ADD COLUMN IF NOT EXISTS photo_resolved_at TIMESTAMPTZ;
```

### 2. Set timestamp on every successful resolve
```typescript
body: JSON.stringify({
  featured_image: result.url,
  photo_resolved_at: new Date().toISOString(),
}),
```

### 3. Null out expired references (don't leave stale data)
```typescript
if (result.status === "expired") {
  // Clear broken data so frontend shows fallback
  body: JSON.stringify({
    photo_reference: null,
    photo_resolved_at: null,
    featured_image: null,
  });
}
```

### 4. Create bi-weekly refresh script
```bash
npx tsx scripts/refresh-photo-urls.ts --days 14
```

### 5. Reduce `minimumCacheTTL` to 7 days
Tighter feedback loop for CDN URL freshness. Note: this is global (affects all remote images).

## Prevention

- **Always check PATCH responses** on cleanup operations (expired refs). Fire-and-forget PATCH was caught in code review — if cleanup fails silently, stale data causes repeated API calls.
- **Validate CLI arguments** — `parseInt` without NaN guard can produce `Invalid Date` in query parameters.
- **Track freshness, don't assume permanence** — any external URL can expire. Add a `*_resolved_at` column whenever caching external resources.

## Maintenance Schedule

| Script | Frequency | Estimated cost |
|--------|-----------|---------------|
| `refresh-photo-urls.ts` | Every 2 weeks | ~500 calls (~$1.50) |
| `refresh-opening-hours.ts` | Monthly | ~500 calls (~$8.50) |

## Related

- PR #45: fix/google-api-cost-reduction
- Migration 041_add_photo_resolved_at.sql
- Next priority: Migrate to Places API (New) for free photo-only calls
