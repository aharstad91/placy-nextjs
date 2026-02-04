---
title: "Placy Guide Mobile Prototype"
category: architecture-patterns
tags: [guide, mobile, map, navigation, walking-tour, bottom-sheet, mapbox]
module: guide
date: 2026-02-02
symptoms:
  - Need curated walking tour product
  - Mobile-first navigation UX
  - Multi-waypoint route display
related_issues:
  - guide-library-spotify-pattern-20260204.md
---

# Placy Guide Mobile Prototype

## Problem

Trengte et nytt produkttype "Guide" for kuraterte gåturer med navigasjons-modus UX. Visit Norway og andre tilbyr gåturer som statiske artikler - ingen mobilvennlig navigasjon, ingen geolokasjon, ingen progressjon.

## Solution

### 1. Data Model (lib/types.ts)

Branded types for type-sikkerhet:

```typescript
// Branded types
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };
export type POIId = Brand<string, "POIId">;
export type GuideStopId = Brand<string, "GuideStopId">;

// Constructor functions
export function createPOIId(value: string): POIId {
  if (!value || typeof value !== "string") {
    throw new Error(`Invalid POI ID: ${value}`);
  }
  return value as POIId;
}

// Guide config
export interface GuideConfig {
  id: string;
  title: string;
  description?: string;
  difficulty?: GuideDifficulty;
  stops: NonEmptyArray<GuideStopConfig>;
  precomputedDistanceMeters?: number;
  precomputedDurationMinutes?: number;
}
```

### 2. Component Structure

Tre komponenter:
- `GuidePage.tsx` - Orchestrator med state og route-fetching
- `GuideMap.tsx` - Kart med nummererte markører og rutelinje
- `GuideStopPanel.tsx` - Bottom sheet content med progressjon

### 3. Multi-Waypoint Route API

Oppdaterte `/api/directions` til å støtte waypoints:

```typescript
// Format: "lng,lat;lng,lat;lng,lat;..."
const waypoints = searchParams.get("waypoints");

// Map mode names to Mapbox profiles
const profileMap: Record<string, string> = {
  walk: "walking",
  bike: "cycling",
  car: "driving",
};
```

### 4. Reuse from Explorer

Gjenbrukte eksisterende komponenter:
- `ExplorerBottomSheet` - Direkte import
- `RouteLayer` - Rutevisning
- `useGeolocation` - GPS-posisjon

### 5. Test Data

JSON-fil med 7 stopp i Trondheim:
- `data/projects/visitnorway/10000-skritt-trondheim.json`

## Key Patterns

### Hydration Guard
```typescript
const [isHydrated, setIsHydrated] = useState(false);
useEffect(() => setIsHydrated(true), []);
if (!isHydrated) return <Loading />;
```

### AbortController for Fetch
```typescript
useEffect(() => {
  const abortController = new AbortController();
  fetch(url, { signal: abortController.signal })
    .then(...)
    .catch(err => {
      if (err.name === "AbortError") return;
      // handle error
    });
  return () => abortController.abort();
}, [deps]);
```

### Route State Machine
```typescript
type RouteState =
  | { status: "idle" }
  | { status: "fetching" }
  | { status: "ready"; coordinates: [number, number][] }
  | { status: "error"; message: string };
```

## Files Created

| File | Purpose |
|------|---------|
| `lib/types.ts` | Guide types, branded IDs |
| `lib/errors/guide-errors.ts` | GuideError class |
| `lib/validation/guide-schema.ts` | Zod validation |
| `components/variants/guide/GuidePage.tsx` | Main orchestrator |
| `components/variants/guide/GuideMap.tsx` | Map with markers |
| `components/variants/guide/GuideStopPanel.tsx` | Bottom sheet content |
| `data/projects/visitnorway/10000-skritt-trondheim.json` | Test guide |

## Prevention / Best Practices

1. **Alltid bruk AbortController** for fetch i useEffect
2. **Hydration guard** når du bruker localStorage eller window
3. **Single multi-waypoint API call** - ikke N separate kall
4. **Gjenbruk komponenter** fra Explorer når mulig
5. **Branded types** for ID-er som ikke skal blandes

## URL

Test guide: `/visitnorway/10000-skritt-trondheim`
