---
module: Next.js Dev Server
date: 2026-02-15
problem_type: build_error
component: development_workflow
symptoms:
  - "Report page loads infinitely with spinner"
  - "HTTP 500: Cannot find module './1682.js' in webpack-runtime.js"
  - "missing required error components, refreshing..."
root_cause: config_error
resolution_type: environment_setup
severity: medium
tags: [next-cache, webpack, parallel-sessions, dev-server, worktree]
---

# Troubleshooting: .next Cache Corruption from Parallel Sessions

## Problem

The Report page at `/for/scandic/scandic-nidelven/report` loaded infinitely (constant spinner/reload). The dev server returned HTTP 500 with webpack unable to find compiled chunks.

## Environment
- Module: Next.js Dev Server
- Next.js Version: 14 (App Router)
- Affected Component: All server-rendered pages (webpack-runtime.js)
- Date: 2026-02-15

## Symptoms
- Page shows "missing required error components, refreshing..." in an infinite loop
- `curl` returns HTTP 500 with error: `Cannot find module './1682.js'` in webpack-runtime.js
- The full require stack traces through `webpack-runtime.js` → `pages/_document.js` → `next/dist/server`
- After clearing cache, first request returns 404 until error components rebuild, then resolves

## What Didn't Work

**Attempted Solution 1:** Restarting the dev server without clearing `.next` cache.
- **Why it failed:** The corrupt webpack chunks persisted in `.next/server/`. Restarting the server just re-loaded the same broken chunks.

## Solution

**Commands run:**

```bash
# 1. Kill the running dev server
kill $(lsof -i :3000 -t) 2>/dev/null

# 2. Delete the corrupt .next cache
rm -rf .next

# 3. Restart the dev server (clean compile)
npm run dev
```

First page load after restart takes 5-6 seconds as webpack recompiles everything from scratch. Subsequent loads are normal speed.

## Why This Works

1. **Root cause:** Multiple Claude Code sessions (or worktrees) running against the same project directory cause webpack chunk IDs to go out of sync. One session compiles and writes chunk `./1682.js`, another session's HMR invalidates or overwrites it, leaving a reference to a non-existent file.

2. **Why deletion fixes it:** `.next/server/` contains compiled server-side chunks keyed by numeric IDs. These IDs are not stable across compilation runs. A clean compile regenerates all chunks with consistent IDs.

3. **Underlying issue:** Next.js dev server assumes single-process ownership of `.next/`. Parallel processes writing to the same `.next/` directory violate this assumption. This is particularly common with Claude Code parallel sessions where multiple agents may trigger file saves and HMR simultaneously.

## Prevention

- **Always use git worktrees for parallel sessions.** Each worktree gets its own `.next/` directory, preventing cross-contamination. Setup script (`scripts/setup-worktree.sh`) already handles this.
- **Delete `.next` as first debugging step** when dev server shows mysterious 500 errors or infinite reloads. It's fast (rm + 5s recompile) and eliminates the most common cause.
- **One dev server per working directory.** Never run `npm run dev` from two terminals in the same repo.
- **`setup-worktree.sh` deletes `.next` by default** — this is intentional and should not be removed from the script.

## Related Issues

No related issues documented yet.

**Memory reference:** This pattern is documented in `MEMORY.md` under "Parallelle sesjoner KREVER git worktrees" and in `CLAUDE.md` under "Git Worktrees".
