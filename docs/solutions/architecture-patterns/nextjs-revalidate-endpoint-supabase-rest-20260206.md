---
title: "Revalidate Endpoint: Cache Invalidation for Supabase REST Writes"
date: 2026-02-06
category: architecture-patterns
module: api/admin
tags:
  - nextjs
  - cache-invalidation
  - revalidatePath
  - supabase
  - rest-api
  - agent-native
  - isr
severity: high
status: resolved
symptoms:
  - "Pages show stale data after Supabase REST API writes"
  - "Admin UI does not reflect newly created projects or POIs"
  - "Public pages serve cached versions after external data changes"
  - "Only hard-refresh (Cmd+Shift+R) or redeployment updates pages"
root_cause: "Supabase REST API writes bypass Next.js server actions entirely. revalidatePath() only triggers inside server actions or route handlers — external REST calls never invoke it."
affected_files:
  - app/api/admin/revalidate/route.ts
---

# Revalidate Endpoint: Cache Invalidation for Supabase REST Writes

## Problem

Next.js caches server-rendered pages aggressively. When data is written via Server Actions, `revalidatePath()` is called automatically. But when data is written directly to Supabase via REST API (from scripts, Claude Code skills, or external agents), the cache is never invalidated.

This means:
- A skill like `/generate-hotel` creates a project via Supabase REST
- The admin page at `/admin/projects` still shows the old list
- The public pages at `/{customer}/{project}/report` serve stale or 404 content
- Only a hard refresh or redeployment fixes it

## Solution

A thin POST endpoint at `/api/admin/revalidate`:

```typescript
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

const MAX_PATHS = 20;

export async function POST(request: NextRequest) {
  if (process.env.ADMIN_ENABLED !== "true") {
    return NextResponse.json({ error: "Admin ikke aktivert" }, { status: 403 });
  }

  let body: { paths?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { paths } = body;

  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    paths.length > MAX_PATHS ||
    paths.some((p: unknown) => typeof p !== "string" || !p.startsWith("/"))
  ) {
    return NextResponse.json(
      { error: `paths must be 1-${MAX_PATHS} absolute paths` },
      { status: 400 }
    );
  }

  for (const path of paths as string[]) {
    revalidatePath(path, "layout");
  }

  return NextResponse.json({ revalidated: paths });
}
```

## Key Design Decisions

1. **`"layout"` mode:** Revalidates the page AND all nested routes, not just the exact path. Essential for pages with dynamic sub-routes.

2. **`MAX_PATHS = 20`:** Safety valve against accidental mass invalidation. A single pipeline rarely needs more than 3-5 paths.

3. **`ADMIN_ENABLED` guard:** Consistent with all other admin endpoints. Disabled by default in production.

4. **Input validation:** Try/catch on `request.json()`, type narrowing on each element, absolute path requirement.

## Usage Pattern

After any Supabase REST writes, call the endpoint with affected paths:

```bash
POST http://localhost:3000/api/admin/revalidate
{
  "paths": [
    "/admin/projects",
    "/admin/projects/{shortId}",
    "/{customerId}/{urlSlug}"
  ]
}
```

This pattern is used by:
- `/generate-hotel` skill (Step 7)
- Any future script or agent that writes to Supabase outside Server Actions

## When to Use This vs Server Actions

| Scenario | Use |
|----------|-----|
| Admin UI forms (buttons, modals) | Server Actions with built-in `revalidatePath()` |
| Claude Code skills / external scripts | Supabase REST + `/api/admin/revalidate` |
| Batch import scripts | Supabase REST + `/api/admin/revalidate` at end |

## Prevention

When adding new admin write paths, ask: "Does this write go through a Server Action?"
- **Yes** → `revalidatePath()` is handled automatically
- **No** → Add a call to `/api/admin/revalidate` after writes complete

## References

- Commit: `a3b2053` feat: add /generate-hotel skill with canonical slugify and revalidate endpoint
- Commit: `cf8221c` fix: address code review findings
- Related: `docs/solutions/best-practices/nextjs-admin-interface-pattern-20260124.md`
- Related: `docs/solutions/ux-improvements/nanoid-short-urls-admin-projects-20260205.md`
- Related: `docs/solutions/logic-errors/empty-product-categories-explorer-zero-pois-20260205.md`
