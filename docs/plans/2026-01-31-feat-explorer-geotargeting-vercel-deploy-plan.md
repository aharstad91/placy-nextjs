---
title: Explorer Geotargeting + Vercel Deploy
type: feat
date: 2026-01-31
---

# Explorer Geotargeting + Vercel Deploy

## Overview

Add live GPS positioning to the Explorer map so users see themselves among the POIs with travel times calculated from their actual position. Deploy to Vercel for HTTPS mobile testing (required for `navigator.geolocation`).

## Brainstorm Reference

`docs/brainstorms/2026-01-31-explorer-geotargeting-vercel-brainstorm.md`

## Proposed Solution

A `useGeolocation` hook manages a state machine with four modes: `loading`, `gps-near` (<2km), `gps-far` (>2km hybrid), and `fallback` (denied/unavailable). The hook provides a resolved `effectiveOrigin` — either GPS coordinates or `project.centerCoordinates` — which `ExplorerPage` passes to `useTravelTimes` and the directions fetch.

## Technical Approach

### State Machine

```
                ┌─────────┐
                │ loading  │ (waiting for first GPS fix)
                └────┬─────┘
                     │ first position received
            ┌────────┴────────┐
            ▼                 ▼
      ┌──────────┐     ┌──────────┐
      │ gps-near │◄───►│ gps-far  │  (hysteresis: near at <1.8km, far at >2.2km)
      └──────────┘     └──────────┘
            │                 │
            ▼                 ▼
      ┌──────────────────────────┐
      │       fallback           │ (permission denied, timeout >120s, or API unavailable)
      └──────────────────────────┘
```

### Key Design Decisions

1. **GPS travel times bypass localStorage cache.** GPS origin moves continuously — caching in localStorage pollutes the cache and risks serving stale data. GPS-based times live in React state only. Hotel-based cache (existing `placy-travel-times-${projectId}-${travelMode}`) is untouched.

2. **Travel time recalculation is throttled.** Blue dot position updates immediately on every `watchPosition` callback. Travel time recalculation only fires when user has moved >100m from last calculation point AND >30s have passed. This prevents API hammering while walking.

3. **Hysteresis on 2km boundary.** Switch to `gps-near` at <1.8km. Switch back to `gps-far` at >2.2km. Prevents flickering when user is near the threshold.

4. **Hotel marker changes in near mode.** When `gps-near`: hotel marker becomes a small neutral pin (no "Du er her" label). Blue GPS dot is the primary reference. When `gps-far`: both markers shown at full size with labels.

5. **Geolocation attempted on all platforms.** Desktop browsers support it too. The near/far logic handles all cases.

---

## Implementation Phases

### Phase 1: `useGeolocation` Hook

Create `lib/hooks/useGeolocation.ts` — a standalone hook that encapsulates all GPS logic.

**Interface:**
```typescript
interface GeolocationState {
  userPosition: Coordinates | null;
  accuracy: number | null;
  mode: 'loading' | 'gps-near' | 'gps-far' | 'fallback';
  effectiveOrigin: Coordinates; // GPS coords when near, project center when far/fallback
  isNearProject: boolean;
  distanceToProject: number | null; // meters
  error: GeolocationPositionError | null;
}

function useGeolocation(projectCenter: Coordinates): GeolocationState
```

**Implementation details:**

- [x] Call `navigator.geolocation.watchPosition` on mount with `{ enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }`
- [x] Add haversine distance function to `lib/utils.ts` for the 2km proximity check
- [x] Implement hysteresis: `gps-near` threshold at 1.8km, `gps-far` threshold at 2.2km
- [x] Handle all three error codes: `PERMISSION_DENIED` → permanent `fallback`, `POSITION_UNAVAILABLE` → keep last position for 30s then show indicator, `TIMEOUT` → retry
- [x] On GPS signal loss >120s, transition to `fallback` mode
- [x] Clean up `watchPosition` on unmount
- [x] Start in `loading` mode, transition after first fix or error

**Files:**
- `lib/hooks/useGeolocation.ts` (new)
- `lib/utils.ts` (add `haversineDistance` function)

### Phase 2: Integrate Geolocation into ExplorerPage

Wire `useGeolocation` into the existing ExplorerPage state flow.

- [x] Call `useGeolocation(project.centerCoordinates)` in `ExplorerPage.tsx`
- [x] Replace hardcoded `project.centerCoordinates` in `useTravelTimes` call with `effectiveOrigin` from the hook
- [x] Replace hardcoded origin in directions `useEffect` (line ~189) with `effectiveOrigin`
- [x] When `mode === 'gps-near'`: skip localStorage caching in `useTravelTimes` — pass a `skipCache` flag or use a separate code path
- [x] Add throttle logic: only re-call `useTravelTimes` when user has moved >100m from last calculation, with 30s minimum interval
- [x] Update Euclidean distance fallback sort (line ~94) to use `effectiveOrigin` instead of `project.centerCoordinates`
- [x] Pass geolocation state down to `ExplorerMap` as new props

**Files:**
- `components/variants/explorer/ExplorerPage.tsx` (modify)
- `lib/hooks/useTravelTimes.ts` (add `skipCache` option or origin-aware cache key)

### Phase 3: Map UI — GPS Dot, Markers, Info Box

Update ExplorerMap to render the GPS dot and handle hybrid mode.

- [x] Add blue pulsing GPS dot marker when `userPosition` is available: 14px blue dot with `animate-ping` ring and semi-transparent accuracy circle
- [x] In `gps-near` mode: change hotel marker to small neutral gray pin (no "Du er her" label)
- [x] In `gps-far` mode: keep hotel marker as-is, show GPS dot alongside it, call `fitBounds` on initial acquisition to show both
- [x] `fitBounds` only on initial GPS fix — not on subsequent updates (user controls viewport after)
- [x] Add compact dismissible info banner at top of map (below NavigationControl) in `gps-far` mode: "Du er {X} km fra {prosjektnavn}. Avstander vises herfra." with dismiss X button
- [x] Store info box dismissal in `sessionStorage` so it doesn't reappear until next session
- [x] In `fallback` mode: keep current behavior unchanged (hotel marker with "Du er her")
- [ ] Optional: show subtle origin label in panel header — "Fra din posisjon" vs "Fra {prosjektnavn}"

**Files:**
- `components/variants/explorer/ExplorerMap.tsx` (modify)
- `components/variants/explorer/ExplorerPage.tsx` (pass geolocation props)

### Phase 4: Vercel Deploy

Set up Vercel project for HTTPS mobile testing.

- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Run `vercel` in project root to create and link project
- [ ] Configure environment variables in Vercel dashboard:
  - `NEXT_PUBLIC_MAPBOX_TOKEN`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GOOGLE_PLACES_API_KEY`
- [ ] Deploy from main: `vercel --prod` or push to main for auto-deploy
- [ ] Verify HTTPS works and geolocation permission prompt appears on mobile
- [ ] Test on physical mobile device

**Files:**
- No code changes needed — Vercel auto-detects Next.js

---

## Acceptance Criteria

### Functional

- [ ] Blue GPS dot visible on map when geolocation is granted
- [ ] GPS dot follows user position in real-time
- [ ] When <2km from project: travel times calculated from user's GPS position
- [ ] When <2km: routes drawn from GPS position to selected POI
- [ ] When >2km: hybrid mode with both markers visible, map fits both
- [ ] When >2km: info banner explains distances are from the project
- [ ] When >2km: travel times from project center (as before)
- [ ] When permission denied: identical to current behavior (hotel-based)
- [ ] Travel mode switch recalculates from correct origin
- [ ] No flickering at 2km boundary (hysteresis works)
- [ ] App deployed on Vercel with HTTPS
- [ ] Geolocation works on mobile Safari and Chrome

### Non-Functional

- [ ] Travel time API calls throttled to max 1 per 30 seconds during GPS tracking
- [ ] `watchPosition` cleaned up on unmount (no memory leaks)
- [ ] Existing hotel-based localStorage cache not corrupted by GPS usage

---

## Dependencies

- `navigator.geolocation` API (browser built-in, no packages needed)
- HTTPS for mobile geolocation (Vercel provides this)
- Mapbox Matrix API for recalculated travel times (existing)

## Risks

| Risk | Mitigation |
|------|------------|
| GPS inaccuracy indoors | Accuracy circle shows reliability. Fallback to hotel if signal lost >120s |
| Mapbox API cost from frequent recalculations | 100m movement threshold + 30s minimum interval |
| Cache corruption from mixed origins | GPS times bypass localStorage entirely |
| Battery drain from watchPosition | Standard mobile browser behavior; no custom mitigation needed beyond reasonable options |

## References

- `components/variants/explorer/ExplorerMap.tsx` — current map with markers
- `components/variants/explorer/ExplorerPage.tsx` — state management, travel time integration
- `lib/hooks/useTravelTimes.ts` — travel time hook with caching
- `app/api/travel-times/route.ts` — origin-agnostic Matrix API proxy
- `app/api/directions/route.ts` — origin-agnostic Directions API proxy
- [react-map-gl GeolocateControl docs](https://visgl.github.io/react-map-gl/docs/api-reference/geolocate-control)
- [MDN Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
