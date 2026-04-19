---
module: Next.js Build
date: 2026-04-18
problem_type: build_error
component: development_workflow
symptoms:
  - "PageNotFoundError: Cannot find module for page: /api/collections"
  - "PageNotFoundError: Cannot find module for page: /api/admin/trust-validate/update"
  - "Error: Failed to collect page data for /api/admin/import (code: ENOENT)"
  - "npm run build exits with error while npm run dev is running"
root_cause: config_error
resolution_type: workflow_improvement
severity: medium
tags: [build, next-cache, dev-server, race-condition, workflow, app-router]
---

# Troubleshooting: `npm run build` Fails with ENOENT While Dev Server Runs

## Problem

Running `npm run build` while `npm run dev` is already serving on port 3000 causes build to fail with `PageNotFoundError` / `ENOENT` errors for API routes that demonstrably exist on disk. The compiled route files exist in `.next/server/app/api/...` but the build process cannot read them because the dev server is simultaneously writing/invalidating them.

## Environment

- Module: Next.js build toolchain
- Next.js Version: 14.2.35 (App Router)
- Affected Component: `npm run build` when executed in parallel with `npm run dev` against the same `.next` directory
- Date: 2026-04-18

## Symptoms

Build output terminates with errors like:

```
PageNotFoundError: Cannot find module for page: /api/collections
    at getPagePath (next/dist/server/require.js:94:15)
    ...
    code: 'ENOENT'

PageNotFoundError: Cannot find module for page: /api/admin/trust-validate/update
    code: 'ENOENT'

> Build error occurred
Error: Failed to collect page data for /api/admin/import
```

Source `route.ts` files exist at the expected paths (`app/api/collections/route.ts`, `app/api/admin/import/route.ts`). Compiled artifacts exist in `.next/server/app/api/collections/route.js` etc. TypeScript and ESLint pass.

## What Didn't Work

**Attempted Solution 1:** Re-running `npm run build` without action — failed identically.
- **Why it failed:** Dev server was still live on :3000, still overwriting `.next` with HMR changes, still colliding with the build process.

## Solution

Stop the dev server, clean the cache, build alone, then restart dev:

```bash
# 1. Kill the dev server
lsof -i :3000 -sTCP:LISTEN -t | xargs kill

# 2. Wipe .next to avoid any stale state
rm -rf .next

# 3. Build cleanly
npm run build

# 4. Restart dev server if needed
npm run dev
```

Build completed successfully with all API routes generated.

## Why This Works

1. **Root cause:** Next.js `npm run dev` and `npm run build` both read/write the same `.next` directory. Dev server's HMR (hot module replacement) invalidates and rewrites compiled chunks on source changes. When `next build` runs concurrently, it calls `getPagePath()` to locate compiled route modules, but the dev server has just overwritten or deleted the file the build expected to find — resulting in `ENOENT`.

2. **Why separation fixes it:** With dev server stopped, `.next` is owned by a single process. `rm -rf .next` ensures the build starts from a clean slate (no stale chunks from dev). The build then completes deterministically.

3. **Why this differs from [next-cache-corruption-parallel-sessions](./next-cache-corruption-parallel-sessions-20260215.md):** That doc covers two `npm run dev` processes conflicting (webpack chunk ID desync manifesting as runtime 500s). This doc covers `npm run dev` + `npm run build` conflicting (App Router page resolution manifesting as build-time `ENOENT`). Same root cause (shared `.next`), different trigger, different error surface.

## Prevention

- **Never run `npm run build` while `npm run dev` is live on the same project directory.** The two tools share `.next` and will collide.
- **Preferred workflow for verification builds:** create a worktree (`git worktree add ../placy-ralph-build main && ../placy-ralph/scripts/setup-worktree.sh`). The worktree has its own `.next`, so build and dev can coexist in parallel directories.
- **Quick workflow for a one-off build:** stop dev, `rm -rf .next && npm run build`, restart dev. ~30 seconds of downtime.
- **Pre-flight check:** before `npm run build`, run `lsof -i :3000 -sTCP:LISTEN -t` — if it returns a PID, dev is running and build will fail.
- **Consider adding a `build:solo` npm script** that checks port 3000 and refuses to run if dev is up. Not strictly required but prevents the trap.

## Related Issues

- See also: [next-cache-corruption-parallel-sessions-20260215.md](./next-cache-corruption-parallel-sessions-20260215.md) — Two `npm run dev` processes conflicting (webpack chunk ID desync at runtime)
- See also: [parallel-sessions-require-worktrees-20260208.md](../workflow-issues/parallel-sessions-require-worktrees-20260208.md) — General parallelism guidance

**Memory reference:** `CLAUDE.md` → `Git Worktrees` section; `MEMORY.md` → "Git Worktrees — MIN JOBB å håndtere".
