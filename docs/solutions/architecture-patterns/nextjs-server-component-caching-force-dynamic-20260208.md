---
title: "Server Component Caching: force-dynamic for Admin Pages with User-Editable Data"
date: 2026-02-08
category: architecture-patterns
module: app/admin
tags:
  - nextjs
  - caching
  - revalidatePath
  - server-components
  - force-dynamic
  - admin
severity: high
status: resolved
symptoms:
  - "Admin page shows stale data after API mutation"
  - "Discovery circles imported via PATCH endpoint not visible on reload"
  - "Only hard-refresh (Cmd+Shift+R) updates the page"
  - "Page component receives unchanged data despite successful API update"
root_cause: "Server component pages cache their rendered output by default. Without `export const dynamic = 'force-dynamic'`, Next.js caches the entire page response. Calling `revalidatePath()` in the API route has no effect if the page is not marked as dynamic."
affected_files:
  - app/admin/projects/[id]/page.tsx
  - app/api/admin/projects/[id]/route.ts
---

# Server Component Caching: force-dynamic for Admin Pages with User-Editable Data

## Problem

The admin project detail page at `app/admin/projects/[id]/page.tsx` displayed stale data after mutations via the Import tab's PATCH endpoint. When discovery circles were saved:

1. User clicks "Save" in the Import tab
2. PATCH request to `/api/admin/projects/[id]` updates the database
3. API route calls `revalidatePath("/admin/projects/[id]")`
4. Page reload returns the old cached response
5. Circles show 1 instead of 3

Hard-refreshing (Cmd+Shift+R) always showed the correct data, confirming the issue was Next.js caching, not a data problem.

## Root Cause

Next.js App Router caches server-rendered pages aggressively. By default, pages are **statically generated at build time** and the rendered HTML is cached indefinitely unless explicitly marked as dynamic.

The admin project detail page had no caching directive:

```typescript
// ❌ Missing force-dynamic
export default async function ProjectDetailPage({ params }) {
  const project = await db.projects.findById(params.id);
  return <ProjectDetail project={project} />;
}
```

When this page rendered at build time (or on first request in dev), Next.js cached the response. Subsequent requests returned the cached version, even though:
- The underlying data changed
- `revalidatePath()` was called in the API route

`revalidatePath()` only works if the page is marked as **dynamic** or **incrementally static**.

## Solution

Add `export const dynamic = "force-dynamic"` to any admin page that displays user-editable data:

### 1. Admin Project Detail Page

```typescript
// app/admin/projects/[id]/page.tsx

export const dynamic = "force-dynamic"; // Required: user edits via Import tab

export default async function ProjectDetailPage({ params }) {
  const { id } = params;
  const project = await db.projects.findById(id);

  if (!project) notFound();

  return <ProjectDetail project={project} />;
}
```

### 2. API Route with revalidatePath

The PATCH endpoint already calls `revalidatePath()`, which now works:

```typescript
// app/api/admin/projects/[id]/route.ts

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();

  // Update database
  const updated = await db.projects.update(params.id, body);

  // Revalidate the admin page so it fetches fresh data
  revalidatePath(`/admin/projects/${params.id}`);

  return NextResponse.json(updated);
}
```

## How It Works

**Without `force-dynamic`:**
1. Page renders → Next.js caches the entire response
2. API mutates data → calls `revalidatePath()`
3. User reloads → Next.js returns cached response (ignoring revalidation)

**With `force-dynamic`:**
1. Page renders → Next.js does NOT cache (marked dynamic)
2. API mutates data → calls `revalidatePath()`
3. User reloads → Next.js re-executes the server component → fetches fresh data

## Key Design Decisions

1. **`force-dynamic` vs `revalidate = 0`:**
   - `force-dynamic`: Page NEVER cached; every request re-runs the component
   - `revalidate = 0`: Page cached until explicitly revalidated

   For admin pages with frequent mutations, `force-dynamic` is safer and simpler.

2. **Place directive at page level, not layout:**
   - Page-level directives apply only to that page
   - Layout directives cascade to all child pages (too broad for admin)

3. **Pair with `revalidatePath()` in API routes:**
   - `force-dynamic` handles page re-rendering
   - `revalidatePath()` invalidates related pages (e.g., `/admin/projects` list after deleting a project)

## Prevention Pattern

When building admin pages that accept user edits, follow this checklist:

**Page component (`page.tsx`):**
```typescript
export const dynamic = "force-dynamic"; // Always include this line
```

**API route that mutates (`route.ts`):**
```typescript
// After writing to database:
revalidatePath("/admin/page-path");
```

**No need for `force-dynamic` if:**
- The page is read-only (no edits)
- Data is fetched from a source that updates itself (unlikely for admin)

## Common Pitfalls

| Pitfall | Why It Fails | Fix |
|---------|-------------|-----|
| Add `force-dynamic` to layout | Disables caching for all nested pages unnecessarily | Use page-level directives |
| Forget `revalidatePath()` in API route | Page re-renders, but related lists still stale | Always call `revalidatePath()` after mutations |
| Use `revalidate = 0` without understanding it | Still caches first request; only helps second+ | Use `force-dynamic` for true no-cache behavior |
| Assume `revalidatePath()` works without `force-dynamic` | It doesn't; page must be dynamic first | Pair both directives |

## Examples in Codebase

- **Admin project detail:** `/app/admin/projects/[id]/page.tsx` (import/edit circles)
- **Admin projects list:** `/app/admin/projects/page.tsx` (create/delete projects)

Both should have `export const dynamic = "force-dynamic"` at the top.

## Testing

1. Open admin project detail page
2. Go to Import tab and upload discovery circles
3. Click Save
4. Reload the page (regular reload, not hard refresh)
5. New circles should appear immediately

If data doesn't update, verify:
- `export const dynamic = "force-dynamic"` is present on the page
- API route calls `revalidatePath()` with the correct path

## References

- Next.js Docs: [Dynamic Routes and Caching](https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic-rendering)
- Related: `docs/solutions/architecture-patterns/nextjs-revalidate-endpoint-supabase-rest-20260206.md` (external API writes)
- Related: `docs/solutions/best-practices/nextjs-admin-interface-pattern-20260124.md`
