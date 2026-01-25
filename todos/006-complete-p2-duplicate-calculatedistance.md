---
status: complete
priority: p2
issue_id: "006"
tags: [code-review, patterns, refactoring]
dependencies: []
---

# Extract Duplicate calculateDistance Function

## Problem Statement

`calculateDistance()` (Haversine-formel) er duplisert i to filer med identisk implementasjon. Dette bryter DRY-prinsippet og skaper vedlikeholdsproblemer.

## Findings

**Pattern Recognition Agent:**
> "Duplicate `calculateDistance` Implementation. The codebase has identical implementations in two places."

**Architecture Strategist Agent:**
> "DRY violation: `lib/generators/poi-discovery.ts:417-438` defines `calculateDistance`. `lib/supabase/queries.ts:28-49` has identical implementation."

**Lokasjon 1 (`lib/generators/poi-discovery.ts:417-434`):**
```typescript
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  // ...
}
```

**Lokasjon 2 (`lib/supabase/queries.ts:28-45`):**
```typescript
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  // ... identisk
}
```

## Proposed Solutions

### Option A: Extract to lib/utils/geo.ts (Recommended)
**Effort:** Small | **Risk:** Low

```typescript
// lib/utils/geo.ts
export function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateBoundingBox(
  center: { lat: number; lng: number },
  radiusMeters: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos(center.lat * Math.PI / 180));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}
```

**Pros:** Single source of truth, kan legge til flere geo-utils
**Cons:** Ny fil

### Option B: Export from poi-discovery
**Effort:** Minimal | **Risk:** Low

Eksporter fra `poi-discovery.ts`, importer i `queries.ts`.

**Pros:** Minimalt arbeid
**Cons:** Skaper avhengighet fra queries til generators

## Recommended Action

<!-- Fylles ut under triage -->

## Technical Details

**Affected files:**
- `lib/generators/poi-discovery.ts:417-438` - fjern lokal kopi
- `lib/supabase/queries.ts:28-49` - fjern lokal kopi
- `lib/utils/geo.ts` - ny fil

**Import updates:**
```typescript
// poi-discovery.ts
import { calculateDistance, toRad } from '@/lib/utils/geo';

// queries.ts
import { calculateDistance } from '@/lib/utils/geo';
```

## Acceptance Criteria

- [ ] `calculateDistance` finnes kun ett sted
- [ ] Begge eksisterende brukere importerer fra ny lokasjon
- [ ] Ingen funksjonell endring
- [ ] Legge til `calculateBoundingBox` util samtidig

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-25 | Created | Identifisert under plan review |

## Resources

- Haversine formula: https://en.wikipedia.org/wiki/Haversine_formula
