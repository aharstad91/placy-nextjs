---
title: "Supabase Client fetch Caching: cache no-store for Server-Side Queries"
date: 2026-02-09
category: architecture-patterns
module: lib/supabase
tags:
  - nextjs
  - supabase
  - caching
  - fetch
  - server-components
  - stale-data
severity: high
status: resolved
symptoms:
  - "Newly created Supabase records not visible in queries"
  - "Product list shows 2 products when 3 exist in database"
  - "Direct REST API call returns correct data but app does not"
  - "Dev server restart temporarily fixes missing data"
  - "getProductFromSupabase returns null for newly created product"
root_cause: "Next.js 14 caches all fetch() calls by default in server components. Supabase JS client uses fetch() internally. Without cache: 'no-store' on the Supabase client's global fetch config, all Supabase queries return stale cached responses."
affected_files:
  - lib/supabase/client.ts
  - lib/supabase/queries.ts
---

# Supabase Client fetch Caching: cache no-store for Server-Side Queries

## Problem

After creating a new Trip product in Supabase for Scandic Nidelven (via direct SQL/REST), the product did not appear anywhere in the app:

1. Admin projects list showed only 2 products (Explorer, Report) instead of 3
2. Admin project detail page showed only 2 products
3. Frontend tab bar showed only 2 tabs
4. Trip page returned "Ingen turdata funnet — Dette prosjektet mangler tripConfig"

Direct verification via Supabase REST API confirmed the product existed:

```bash
curl -s "$SUPABASE_URL/rest/v1/products?project_id=eq.scandic_scandic-nidelven&select=id,product_type" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq
# Returns 3 products: explorer, report, guide ✓
```

Restarting the dev server temporarily fixed the issue, but it returned on subsequent requests.

## Root Cause

Next.js 14 App Router caches **all `fetch()` calls** by default in server components. The Supabase JS client (`@supabase/supabase-js`) uses `fetch()` internally for all database queries. This means every Supabase query was cached indefinitely after its first execution.

The original Supabase client configuration had no caching override:

```typescript
// ❌ No cache control — Next.js caches all Supabase queries
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

When the app first queried products (returning 2), Next.js cached that response. Adding a third product in the database had no effect because the app kept returning the cached 2-product response.

**This is a different layer than `force-dynamic` on page components.** Even with `force-dynamic`, if the Supabase client's internal `fetch()` calls are cached, the server component re-executes but gets stale data from the fetch cache.

## Solution

Add `cache: "no-store"` to the Supabase client's global fetch configuration:

```typescript
// lib/supabase/client.ts

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: (url, options = {}) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    })
  : null;
```

This ensures every internal `fetch()` call made by the Supabase client bypasses the Next.js cache.

## How It Works

**Without `cache: "no-store"` on Supabase client:**
1. Server component calls `supabase.from("products").select(...)`
2. Supabase JS calls `fetch("https://xxx.supabase.co/rest/v1/products?...")`
3. Next.js caches the response (default behavior)
4. Next request → Next.js returns cached response → stale data

**With `cache: "no-store"` on Supabase client:**
1. Server component calls `supabase.from("products").select(...)`
2. Supabase JS calls `fetch("https://xxx.supabase.co/rest/v1/products?...", { cache: "no-store" })`
3. Next.js does NOT cache the response
4. Next request → fresh data from Supabase

## Relationship to Other Caching Fixes

Next.js 14 has **multiple caching layers** that can each cause stale data:

| Layer | What It Caches | Fix | Documented In |
|-------|---------------|-----|---------------|
| **fetch() Data Cache** | Individual fetch responses | `cache: "no-store"` on fetch | **This document** |
| **Full Route Cache** | Rendered server component output | `export const dynamic = "force-dynamic"` | `nextjs-server-component-caching-force-dynamic-20260208.md` |
| **Router Cache** | Client-side prefetched routes | `router.refresh()` or `revalidatePath()` | `nextjs-revalidate-endpoint-supabase-rest-20260206.md` |

For Supabase-backed pages, you may need fixes at **all three layers**:

1. Supabase client: `cache: "no-store"` (this fix)
2. Page component: `export const dynamic = "force-dynamic"` (for admin pages)
3. API routes: `revalidatePath()` after mutations

## Key Design Decisions

1. **Global fetch override vs per-query:** Setting `cache: "no-store"` globally on the client affects all queries. This is correct for our use case — we never want cached Supabase data in server components.

2. **Module-level singleton:** The Supabase client is a module-level singleton (`export const supabase = ...`). The cache override is applied once at creation time and applies to all queries throughout the app.

3. **Spread existing options:** The fetch wrapper uses `{ ...options, cache: "no-store" }` to preserve any other options Supabase sets (like headers, body, method) while only overriding the cache behavior.

## Prevention Pattern

When creating a Supabase client for use in Next.js server components, **always** add cache control:

```typescript
const supabase = createClient(url, key, {
  global: {
    fetch: (url, options = {}) =>
      fetch(url, { ...options, cache: "no-store" }),
  },
});
```

## Common Pitfalls

| Pitfall | Why It Fails | Fix |
|---------|-------------|-----|
| Only add `force-dynamic` to pages | Supabase fetch still cached at data layer | Add `cache: "no-store"` to Supabase client |
| Restart dev server to "fix" caching | Only clears in-memory cache temporarily | Fix the root cause with `cache: "no-store"` |
| Add `cache: "no-store"` only to some queries | Other queries still stale | Use global fetch override on client |
| Assume Supabase bypasses Next.js cache | It doesn't — uses standard `fetch()` | Always configure cache explicitly |

## Testing

1. Create a new product via Supabase REST API or dashboard
2. Reload the admin projects page (regular reload)
3. New product should appear immediately without dev server restart
4. Verify on frontend: new product tab should be visible

## References

- Related: `docs/solutions/architecture-patterns/nextjs-server-component-caching-force-dynamic-20260208.md`
- Related: `docs/solutions/architecture-patterns/nextjs-revalidate-endpoint-supabase-rest-20260206.md`
- Next.js Docs: [Data Fetching and Caching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- Supabase Docs: [Custom Fetch](https://supabase.com/docs/reference/javascript/initializing)
