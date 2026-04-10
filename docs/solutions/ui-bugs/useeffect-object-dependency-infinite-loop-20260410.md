---
module: Report
date: 2026-04-10
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "MobilityCard stuck in loading state showing 'Laster...' indefinitely"
  - "API calls complete with 200 OK but data never appears in UI"
  - "Network tab shows repeated fetch calls every few milliseconds"
root_cause: async_timing
resolution_type: code_fix
severity: high
tags: [useeffect, dependency-array, infinite-loop, react-hooks, polling, usememo]
---

# Troubleshooting: useEffect Object Dependency Causes Infinite Re-render Loop

## Problem
A polling hook (`useTransportDashboard`) had a `useMemo`-derived object in its `useEffect` dependency array. Each render created a new object reference, restarting the effect — which aborted pending fetches and started new ones in an infinite loop. The Bildeling card showed "Laster..." forever despite API calls returning 200 OK.

## Environment
- Module: Report (Transport & Mobilitet)
- Framework: Next.js 14, React 18
- Affected Component: `lib/hooks/useTransportDashboard.ts`
- Date: 2026-04-10

## Symptoms
- Bildeling (car sharing) card stuck showing "–" value and "Laster..." subtitle
- Browser Network tab showed `/api/hyre` calls completing with 200 OK
- Other cards (Bysykkel, Sparkesykkel) loaded correctly (faster API response — won race condition)
- Console showed no errors

## What Didn't Work

**Initial assumption:** API or data parsing issue — checked Hyre API response, confirmed correct JSON returned. Not the cause.

## Solution

The `useEffect` dependency array included `sources` (a `useMemo` object). Even though `useMemo` should be stable, React's referential equality check saw a new object each time the parent re-rendered (triggered by the state update inside the effect itself).

**Before (broken):**
```typescript
const sources = useMemo(() => selectTransportSources(pois, center), [pois, center]);

useEffect(() => {
  async function poll() {
    // uses sources.enturStops, sources.bysykkelStation, etc.
    const results = await Promise.allSettled(promises);
    setData({ ... }); // triggers re-render → new sources → effect restarts
  }
  poll();
  const intervalId = setInterval(poll, POLLING_INTERVAL);
  return () => { controller.abort(); clearInterval(intervalId); };
}, [enturIds, bysykkelId, hyreId, center.lat, center.lng, sources]);
//                                                          ^^^^^^^^ BUG
```

**After (fixed):**
```typescript
const sources = useMemo(() => selectTransportSources(pois, center), [pois, center]);
const sourcesRef = useRef(sources);
sourcesRef.current = sources;

useEffect(() => {
  async function poll() {
    const s = sourcesRef.current; // read from ref, not closure
    // uses s.enturStops, s.bysykkelStation, etc.
  }
  poll();
  const intervalId = setInterval(poll, POLLING_INTERVAL);
  return () => { controller.abort(); clearInterval(intervalId); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [enturIds, bysykkelId, hyreId, center.lat, center.lng]);
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ stable primitives only
```

## Why This Works

1. **Root cause:** `sources` is an object. Even though `useMemo` returns the same object when deps haven't changed, React's effect cleanup + re-run cycle can cause `useMemo` to be re-evaluated when parent state changes. The effect's `setData()` call triggers a re-render, which may create a new `sources` object, which triggers the effect again → infinite loop.

2. **Fix:** Use a `useRef` to hold the current `sources` value. The ref is always up-to-date (assigned on every render) but doesn't trigger effect re-runs. The effect's dependency array only contains primitive strings (`enturIds`, `bysykkelId`, `hyreId`) and numbers (`center.lat`, `center.lng`) — these have stable values between renders.

3. **Pattern:** For any `useEffect` that polls/fetches and updates state, **never include derived objects in the dependency array**. Extract primitive keys for deps, and use `useRef` for the full object access inside the effect.

## Prevention

- **Rule:** Never put `useMemo` objects in `useEffect` dependency arrays when the effect updates state
- **Pattern:** Extract stable primitive keys (strings, numbers) for deps. Use `useRef` for object access inside effects.
- **Lint:** The `react-hooks/exhaustive-deps` ESLint rule will warn about missing deps — add an eslint-disable comment with explanation when intentionally omitting object deps.
- **Detection:** If a component is stuck loading despite successful API calls, check for infinite effect loops in Network tab (rapid repeated requests).

## Related Issues

- See also: [nextjs-server-component-caching-force-dynamic-20260208.md](../architecture-patterns/nextjs-server-component-caching-force-dynamic-20260208.md) — another caching/stale data issue in the report
