---
module: lib/supabase
date: 2026-02-15
problem_type: integration_issue
component: tooling
symptoms:
  - "Production JSON-LD missing telephone, openingHours, facebookUrl despite data existing in Supabase"
  - "revalidatePath does not clear Supabase fetch Data Cache on Vercel"
  - "Code works locally but not in production after deploy"
root_cause: config_error
resolution_type: code_fix
severity: high
tags: [vercel, data-cache, isr, supabase, nextjs, fetch-caching, revalidate-tag]
---

# Troubleshooting: Vercel Data Cache persists stale Supabase data across deployments

## Problem

After deploying new JSON-LD structured data fields (telephone, openingHours, facebookUrl), production showed the new code running (url and sameAs fields appeared) but the new data fields were missing. Data existed in Supabase and worked locally, but Vercel served stale cached fetch responses from previous deployments.

## Environment
- Module: lib/supabase/public-client.ts, app/api/admin/revalidate/route.ts
- Framework: Next.js 14.2.35 (App Router) on Vercel
- Affected Component: Supabase public client fetch caching, ISR revalidation
- Date: 2026-02-15

## Symptoms
- Production JSON-LD for Britannia Hotel missing `telephone: "73 80 08 00"`, `openingHours`, and `facebookUrl` in `sameAs` array
- `revalidatePath("/trondheim/steder/britannia-hotel", "layout")` called successfully but data unchanged
- `x-vercel-cache: MISS` header confirmed fresh page generation, yet stale data persisted
- Direct Supabase query (Node.js with anon key) confirmed data existed: `google_phone`, `opening_hours_json`, `facebook_url` all populated
- Clean local `next build` + `next start` showed all fields correctly
- New code WAS running in production (new `url` and `sameAs` fields appeared) — only the DATA was stale

## What Didn't Work

**Attempted Solution 1:** Calling `revalidatePath(path, "layout")` via admin endpoint
- **Why it failed:** `revalidatePath` clears the Full Route Cache (page HTML) but does NOT reliably clear the Data Cache (individual `fetch` responses) on Vercel. The Supabase fetch response was cached without a TTL from a previous deployment.

**Attempted Solution 2:** Adding `next.revalidate: 86400` to Supabase client fetch wrapper
- **Why it failed:** The new `revalidate` option only applies to NEW fetch requests. Since a cached entry already existed in the Data Cache (from the previous deployment without TTL), Vercel continued serving the stale entry. The Data Cache persists across deployments by design.

**Attempted Solution 3:** Waiting 150+ seconds for deployment propagation then re-revalidating
- **Why it failed:** This was not a deployment timing issue. The stale Data Cache entry had no expiration and would persist indefinitely regardless of new deployments.

## Solution

Two changes needed:

**1. Tag Supabase fetches for targeted cache purging** (`lib/supabase/public-client.ts`):

```typescript
// Before (broken):
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);  // fetch cached indefinitely by Next.js
}

// After (fixed):
export const SUPABASE_CACHE_TAG = "supabase-public";
const REVALIDATE_SECONDS = 86400;

export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          next: { revalidate: REVALIDATE_SECONDS, tags: [SUPABASE_CACHE_TAG] },
        }),
    },
  });
}
```

**2. Purge Data Cache via tag in revalidation endpoint** (`app/api/admin/revalidate/route.ts`):

```typescript
import { revalidatePath, revalidateTag } from "next/cache";
import { SUPABASE_CACHE_TAG } from "@/lib/supabase/public-client";

// In POST handler, BEFORE revalidatePath calls:
revalidateTag(SUPABASE_CACHE_TAG);

for (const path of paths as string[]) {
  revalidatePath(path, "layout");
}
```

## Why This Works

1. **Root cause:** Vercel's Data Cache persists `fetch` responses across deployments by design. The original Supabase client used `fetch()` without any `next` options, so Next.js cached responses with infinite TTL. Even `revalidatePath` only clears the Full Route Cache (rendered HTML) — the underlying Data Cache entries survive.

2. **`next.revalidate: 86400`** ensures new cache entries expire after 24 hours (matching the ISR period). This provides a safety net: even without manual purging, stale data self-heals within 24h.

3. **`next.tags: ["supabase-public"]`** enables targeted cache purging via `revalidateTag("supabase-public")`. This is the ONLY reliable way to force-clear Vercel's Data Cache for specific fetch responses.

4. **Key insight:** `revalidatePath` ≠ full cache purge on Vercel. Page regeneration can still use stale Data Cache entries. You need `revalidateTag` to also clear the fetch response cache.

## Prevention

- **Always configure `next.revalidate` on Supabase public client fetches.** Never rely on default infinite caching for data that changes.
- **Always add `next.tags` to cacheable fetches.** This makes manual cache purging possible without redeploying.
- **When debugging "works locally, not in production":** Check Vercel's Data Cache first. `x-vercel-cache: MISS` only means the Edge/Route Cache missed — the Data Cache is a separate layer.
- **After adding new database columns/data:** Remember that Vercel's Data Cache may still serve old responses. Either wait for `revalidate` TTL to expire or call `revalidateTag()`.

## Related Issues

- See also: [supabase-client-fetch-caching-nextjs-20260209.md](../architecture-patterns/supabase-client-fetch-caching-nextjs-20260209.md) — Same root cause family (Next.js caches Supabase fetch). That doc covers admin client needing `cache: "no-store"`. This doc covers public client needing `revalidate` + `tags` for ISR pages on Vercel.
