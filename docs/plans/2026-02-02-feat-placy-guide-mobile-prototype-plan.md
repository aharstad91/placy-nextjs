---
title: "feat: Placy Guide Mobile Prototype"
type: feat
date: 2026-02-02
deepened: 2026-02-02
reviewed: 2026-02-02
brainstorm: docs/brainstorms/2026-02-02-placy-guide-produkt-brainstorm.md
---

# feat: Placy Guide Mobile Prototype

## Enhancement Summary

**Deepened on:** 2026-02-02
**Research agents used:** 12 (frontend-design, kieran-typescript-reviewer, performance-oracle, architecture-strategist, julik-frontend-races-reviewer, code-simplicity-reviewer, pattern-recognition-specialist, mapbox-best-practices, bottom-sheet-best-practices, explorer-learnings, nextjs-data-loading, walking-tour-ux)

### Key Improvements from Research
1. **Simplified component structure:** 8 → 3 components for MVP
2. **Type-safe data model:** Branded IDs, discriminated unions, unit suffixes
3. **Performance:** GPU-accelerated animations, single multi-waypoint API call
4. **Race condition prevention:** State machine patterns, transition locks
5. **10x UX patterns:** GPS-triggered content, compass direction, wrong-turn alerts

### Critical Findings
- Use `transform: translateY()` instead of `height` for 60fps bottom sheet
- Single Mapbox Directions call with all 7 waypoints (not 7 calls)
- Separate static config from runtime state in TypeScript types
- Apply hydration guard for localStorage persistence

### Improvements from Plan Review (2026-02-02)
- **Branded type constructors:** Add `createPOIId()`, `createGuideStopId()` for safe ID creation
- **Exhaustiveness checking:** Add `assertNever` utility for discriminated unions
- **AbortController:** Proper cancellation for route fetching
- **Error types:** Define `GuideError` class with specific error codes
- **Zod validation:** Validate JSON at data boundaries
- **Non-empty array:** Enforce at least one stop in guide

---

## Overview

Bygg en fungerende mobil-prototype for Placy Guide — kuraterte gåturer med navigasjons-modus UX. Prototypen validerer konseptet med én hardkodet guide ("10,000 skritt Trondheim", 7 stopp) før full infrastruktur bygges.

**Mål:** 10x bedre UX enn Visit Norway-eksempelet på mobil.

**Referanse:** [Visit Norway 10,000 skritt](https://www.visitnorway.no/reisemal/byferie/10-000-skritt/trondheim/)

---

## Problem Statement / Motivation

Visit Norway og andre tilbyr gåturer som statiske artikler med kart. UX-problemene:

1. **Ingen mobilvennlig navigasjon** — må scrolle mellom liste og kart
2. **Ingen geolokasjon** — vet ikke hvor du er i forhold til neste stopp
3. **Ingen progressjon** — ingen følelse av fremgang
4. **Ingen interaktivitet** — kan ikke klikke på markører

Placy Guide løser dette med:
- Kart-først UX med ekspanderbart panel
- Sanntids brukerposisjon
- Progressbar og "merk som besøkt"
- Interaktive markører og rutevisning

### Research Insights: What Makes Walking Tours 10x Better

Based on research of Detour, AllTrails, Komoot, and GPSmyCity:

| Pattern | Description | Priority |
|---------|-------------|----------|
| **GPS-triggered content** | Auto-play/show content on arrival | MVP |
| **Distance/time to next** | Always visible in UI | MVP |
| **Visual progress tracker** | Stops completed with checkmarks | MVP |
| **Compass direction** | Arrow pointing to next stop | Should-have |
| **Wrong-turn alerts** | Notification when off-route | Nice-to-have |
| **Completion badges** | GPS-verified arrival | Nice-to-have |

**Key insight from Detour:** "Once you start a walk, you should never have to look at your phone."

---

## Proposed Solution

### Mobil UX: Navigasjons-modus

```
┌─────────────────────────┐
│                         │
│    KART (fullskjerm)    │
│    • Rutelinje (blå)    │
│    • Nummererte markører│
│    • Din posisjon (puls)│
│                         │
├─────────────────────────┤
│ ● ● ● ○ ○ ○ ○   3/7     │ ← Progressbar
├─────────────────────────┤
│ 3  Nidarosdomen         │
│    340m · 4 min gåing   │ ← Kompakt panel (peek)
└─────────────────────────┘
```

### Research Insights: Bottom Sheet Best Practices

**Snap points optimized for walking tours:**
- **Peek (140-180px):** Current stop name + distance — maximum map visibility
- **Half (45vh):** Full stop details + image — browsing mode
- **Full (88vh):** Scrollable content — reading mode

**Critical performance pattern:**
```tsx
// BAD - triggers layout recalculation every frame
<div style={{ height: displayHeight }} />

// GOOD - GPU-accelerated, compositor-only
<div style={{
  height: maxHeight,
  transform: `translateY(${maxHeight - displayHeight}px)`,
  willChange: 'transform'
}} />
```

### Desktop UX: Split-view

```
┌──────────────────┬──────────────────────────┐
│  LISTE           │                          │
│                  │        KART              │
│  1 ● Sellanraa   │        med rute          │
│  2 ○ Torget      │        og markører       │
│  3 ● Nidaros ←   │                          │
│  ...             │                          │
├──────────────────┤                          │
│  Rute: 3.4 km    │                          │
│  ~45 min å gå    │                          │
└──────────────────┴──────────────────────────┘
```

---

## Technical Approach

### 1. Datamodell (Improved from TypeScript Review)

**Research insight:** Separate static configuration from runtime state. Use branded IDs for type safety.

```typescript
// lib/types.ts

// Branded types for compile-time ID safety
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };
export type POIId = Brand<string, "POIId">;
export type GuideStopId = Brand<string, "GuideStopId">;

// Constructor functions for branded types (from review)
export function createPOIId(value: string): POIId {
  if (!value || typeof value !== 'string') {
    throw new Error(`Invalid POI ID: ${value}`);
  }
  return value as POIId;
}

export function createGuideStopId(value: string): GuideStopId {
  if (!value || typeof value !== 'string') {
    throw new Error(`Invalid GuideStop ID: ${value}`);
  }
  return value as GuideStopId;
}

// Exhaustiveness checking utility (from review)
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

export type ProductType = "explorer" | "report" | "portrait" | "guide";
export type GuideDifficulty = "easy" | "moderate" | "challenging";

// Non-empty array type (from review)
type NonEmptyArray<T> = [T, ...T[]];

// === STATIC CONFIGURATION (JSON/database) ===

export interface GuideStopConfig {
  id: GuideStopId;
  poiId: POIId;
  // Optional overrides (resolved against POI at runtime)
  nameOverride?: string;
  descriptionOverride?: string;
  imageUrlOverride?: string;
  transitionText?: string; // "Herfra går du over brua..."
}

export interface GuideConfig {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  difficulty?: GuideDifficulty;
  stops: NonEmptyArray<GuideStopConfig>; // At least one stop required
  // Pre-computed totals with unit suffixes
  precomputedDistanceMeters?: number;
  precomputedDurationMinutes?: number;
}

// === RUNTIME STATE (Zustand store) ===

export type GuideStopStatus =
  | { type: "available" }
  | { type: "active" }
  | { type: "completed"; completedAt: number }; // Unix timestamp for serialization

// Type guard for status narrowing
export function isCompletedStop(
  status: GuideStopStatus
): status is { type: "completed"; completedAt: number } {
  return status.type === "completed";
}

// Extend Project
export interface Project {
  // ...existing fields
  guideConfig?: GuideConfig;
}
```

**Key improvements from research:**
- Branded IDs prevent mixing `poiId` and `stopId`
- **Constructor functions** (`createPOIId`, `createGuideStopId`) ensure safe ID creation
- **`assertNever`** enables compile-time exhaustiveness checking on discriminated unions
- **`NonEmptyArray`** enforces at least one stop at type level
- Unit suffixes (`Meters`, `Minutes`) prevent unit confusion
- Array index determines order (no redundant `order` field)
- **Unix timestamps** instead of Date for JSON serialization compatibility
- **Type guard** (`isCompletedStop`) for safe status narrowing

### 2. Komponentstruktur (Simplified from Code Simplicity Review)

**Original plan:** 8 components
**Simplified MVP:** 3 new files

```
components/variants/guide/
├── GuidePage.tsx      # Orchestrator + state + inline stop data
├── GuideMap.tsx       # Map + route + inline markers
└── GuideStopPanel.tsx # Bottom content + inline progress dots
```

**Why simplified:**
- `GuideBottomSheet.tsx` → Use `ExplorerBottomSheet` directly
- `GuideProgressBar.tsx` → Inline 15 lines in `GuideStopPanel`
- `GuideStopMarker.tsx` → Inline in `GuideMap` (20 lines)
- `GuideCompletionModal.tsx` → Defer to v2
- `GuideDesktopSidebar.tsx` → Defer (mobile-first MVP)

**Estimated reduction:** ~400 LOC, 5 fewer files

### 3. Gjenbruk fra Explorer

| Komponent | Fil | Gjenbruk |
|-----------|-----|----------|
| `ExplorerBottomSheet` | `components/variants/explorer/ExplorerBottomSheet.tsx` | Direkte import |
| `RouteLayer` | `components/map/route-layer.tsx` | Direkte import |
| `useGeolocation` | `lib/hooks/useGeolocation.ts` | Direkte import |
| Map base patterns | `components/variants/explorer/ExplorerMap.tsx` | Fork + forenkle |

### Research Insight: Architecture Recommendation

**Fork vs Composition:** The architecture review recommends composition over forking, but for MVP, a focused fork is acceptable. Future refactor should extract shared `MapCanvas` component.

### 4. Page Routing

**Oppdater `app/[customer]/[project]/page.tsx`:**

```typescript
// Legg til etter Report-case
if (projectData.productType === "guide") {
  return <GuidePage project={projectData} />;
}
```

### 5. Hardkodet testdata

**Ny fil `data/projects/visitnorway/10000-skritt-trondheim.json`**

Data loading follows existing pattern in `lib/data-server.ts` — automatic discovery via dynamic `fs` loading.

---

## Implementation Phases

### Fase 1: Datamodell + Routing (Grunnlag)

**Mål:** Guide-type fungerer i systemet med type-sikker infrastruktur

- [ ] Legg til `"guide"` i `ProductType` union (`lib/types.ts`)
- [ ] Definer branded types med constructor-funksjoner (`createPOIId`, `createGuideStopId`)
- [ ] Legg til `assertNever` og `NonEmptyArray` utilities
- [ ] Definer `GuideStopConfig` og `GuideConfig` interfaces
- [ ] Utvid `Project` interface med `guideConfig?: GuideConfig`
- [ ] Opprett `GuideError` klasse med error codes
- [ ] Opprett Zod-schema for JSON-validering
- [ ] Legg til routing-case i `app/[customer]/[project]/page.tsx`
- [ ] Opprett stub `GuidePage.tsx` som viser "Guide placeholder"

**Filer:**
- `lib/types.ts` (oppdater)
- `lib/errors/guide-errors.ts` (ny)
- `lib/validation/guide-schema.ts` (ny)
- `app/[customer]/[project]/page.tsx` (oppdater)
- `components/variants/guide/GuidePage.tsx` (ny)

### Fase 2: Testdata (Innhold)

**Mål:** Hardkodet guide med realistisk innhold

- [ ] Opprett katalog `data/projects/visitnorway/`
- [ ] Lag `10000-skritt-trondheim.json` med 7 stopp
- [ ] Hent koordinater for alle 7 steder
- [ ] Skriv korte beskrivelser per stopp
- [ ] Verifiser at guide laster på `/visitnorway/10000-skritt-trondheim`

**Filer:**
- `data/projects/visitnorway/10000-skritt-trondheim.json` (ny)

### Fase 3: Mobil Kart (Kjerne-UX)

**Mål:** Fullskjerm kart med rute og markører

- [ ] Opprett `GuideMap.tsx` basert på `ExplorerMap.tsx`
- [ ] Fjern filter/cluster-logikk (ikke relevant)
- [ ] Legg til nummererte markører (inline, ikke egen komponent)
- [ ] Hent rute fra Mapbox Directions (alle 7 punkter i én request)
- [ ] Vis rutelinje med `RouteLayer`
- [ ] Fit map bounds til hele ruten ved load

**Research Insights: Map Performance**

```typescript
// Single multi-waypoint call (recommended)
const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${allWaypoints}?geometries=geojson`;
// Expected: 300-500ms total

// NOT 7 separate calls (anti-pattern)
// Would be: 1.4-2.8s total
```

**Critical pattern from learnings:**
```typescript
mapRef.current.fitBounds(
  [[minLng, minLat], [maxLng, maxLat]],
  {
    padding: mapPadding,
    duration: 400,
    maxZoom: mapRef.current.getZoom() // Never zoom in beyond current
  }
);
```

**Filer:**
- `components/variants/guide/GuideMap.tsx` (ny)

### Fase 4: Bottom Sheet + Panel (Mobil navigasjon)

**Mål:** Ekspanderbart panel med stopp-detaljer

- [ ] Bruk `ExplorerBottomSheet` direkte (ikke wrapper)
- [ ] Opprett `GuideStopPanel.tsx` med:
  - Stopp-navn og nummer (large, editorial typography)
  - Avstand til stopp (fra useGeolocation)
  - Beskrivelse
  - Bilde (hvis tilgjengelig)
  - Neste/Forrige knapper
  - Inline progressbar (7 prikker)
- [ ] Koble panel til state: `currentStopIndex`
- [ ] Implementer navigasjon: next/prev endrer `currentStopIndex`

**Research Insights: Bottom Sheet Performance**

Use `transform: translateY()` instead of animating `height`:
```tsx
style={{
  height: maxHeight, // Fixed
  transform: `translateY(${maxHeight - displayHeight}px)`,
  willChange: isDragging ? 'transform' : 'auto',
  transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
}}
```

**Snap points (mobil):**
- Peek: 140px (kompakt: navn + avstand)
- Half: 45vh (full stopp-info)
- Full: 88vh (med scrollbart innhold)

**Filer:**
- `components/variants/guide/GuideStopPanel.tsx` (ny)

### Fase 5: Geolokasjon + Progressjon (Interaktivitet)

**Mål:** "Du er her" og progressjon-tracking

- [ ] Integrer `useGeolocation` hook i `GuidePage`
- [ ] Vis brukerposisjon på kart (pulserende markør)
- [ ] Beregn avstand fra bruker til nåværende stopp
- [ ] Implementer "Merk som besøkt"-knapp
- [ ] Lagre besøkte stopp med hydration guard (se below)
- [ ] Oppdater progressbar basert på besøkte stopp
- [ ] Differensier markører: besøkt (grå), nåværende (blå), kommende (hvit)

**Research Insights: Hydration Guard for localStorage (Improved from Review)**

```tsx
// Prevent flash when hydrating from localStorage
// With proper typing and error boundary

interface GuidePageClientProps {
  project: Project & { guideConfig: GuideConfig }; // Require guideConfig
}

function GuidePageClient({ project }: GuidePageClientProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return <GuidePageSkeleton stopCount={project.guideConfig.stops.length} />;
  }

  return (
    <ErrorBoundary
      fallback={<GuideErrorFallback error="Noe gikk galt med guiden" />}
    >
      <GuidePage project={project} />
    </ErrorBoundary>
  );
}
```

**Improvements:**
- **Typed props** — `GuidePageClientProps` requires `guideConfig` to be present
- **Dynamic skeleton** — passes `stopCount` for accurate placeholder
- **Error boundary** — catches runtime errors with user-friendly fallback

**Research Insights: Geolocation Battery Optimization**

```typescript
const positionOptions: PositionOptions = {
  enableHighAccuracy: false,  // Use cell/wifi when possible
  timeout: 15000,
  maximumAge: 30000,          // Accept cached positions
};
```

**Filer:**
- `components/variants/guide/GuidePage.tsx` (oppdater)
- `components/variants/guide/GuideMap.tsx` (oppdater)

### Fase 6: Desktop Layout (Sekundær - DEFERRED)

**Deferred from MVP.** Mobile-first validation. Desktop in v2.

---

## Race Condition Prevention (from Frontend Races Review)

### Critical Races to Prevent

| Race | Severity | Mitigation |
|------|----------|------------|
| Bottom sheet drag + map pan | High | `e.stopPropagation()` on drag handle + disable `dragPan` |
| GPS + stop navigation | High | State machine + stale check on route fetch |
| Route fetch + fitBounds | Medium | Verify `routeData.stopId === currentStopIndex` before fitting |
| Sheet animation + nav buttons | Medium | Transition lock: disable nav during 350ms animation |
| localStorage hydration | Medium | Hydration guard component |

### State Machine Pattern for Route Fetching (Improved from Review)

**Use proper discriminated union with AbortController:**

```typescript
// lib/types.ts - Route state type
type RouteState =
  | { status: "idle" }
  | { status: "fetching"; forStopIndex: number }
  | { status: "ready"; route: RouteData; forStopIndex: number }
  | { status: "error"; error: GuideError; forStopIndex: number };

// In component:
const [routeState, setRouteState] = useState<RouteState>({ status: "idle" });

useEffect(() => {
  if (routeState.status === "fetching") return;

  const abortController = new AbortController();
  setRouteState({ status: "fetching", forStopIndex: currentStopIndex });

  fetchRoute(stops, { signal: abortController.signal })
    .then(route => {
      setRouteState({
        status: "ready",
        route,
        forStopIndex: currentStopIndex
      });
    })
    .catch(error => {
      if (error.name === 'AbortError') return; // Cancelled, ignore
      setRouteState({
        status: "error",
        error: new GuideError(error.message, 'ROUTE_CALCULATION_FAILED'),
        forStopIndex: currentStopIndex
      });
    });

  // Cleanup: abort on unmount or re-run
  return () => abortController.abort();
}, [currentStopIndex]);
```

**Benefits over original pattern:**
- **AbortController** cancels in-flight requests on unmount (prevents memory leaks)
- **Typed state** with discriminated union enables exhaustive matching
- **Error state** captures failures for UI feedback
- **No stale closure** — `forStopIndex` is stored in state, not captured

---

## Error Handling (from Review)

### GuideError Class

```typescript
// lib/errors/guide-errors.ts

export type GuideErrorCode =
  | 'ROUTE_CALCULATION_FAILED'
  | 'ROUTE_CALCULATION_TIMEOUT'
  | 'GEOLOCATION_UNAVAILABLE'
  | 'GEOLOCATION_PERMISSION_DENIED'
  | 'POI_NOT_FOUND'
  | 'INVALID_GUIDE_CONFIG';

export class GuideError extends Error {
  constructor(
    message: string,
    public readonly code: GuideErrorCode
  ) {
    super(message);
    this.name = 'GuideError';
  }
}

export function isGuideError(error: unknown): error is GuideError {
  return error instanceof GuideError;
}
```

### Zod Validation at JSON Boundaries

```typescript
// lib/validation/guide-schema.ts
import { z } from 'zod';

const GuideStopConfigSchema = z.object({
  id: z.string().min(1),
  poiId: z.string().min(1),
  nameOverride: z.string().optional(),
  descriptionOverride: z.string().optional(),
  imageUrlOverride: z.string().url().optional(),
  transitionText: z.string().optional(),
});

const GuideConfigSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  difficulty: z.enum(['easy', 'moderate', 'challenging']).optional(),
  stops: z.array(GuideStopConfigSchema).min(1), // At least one stop
  precomputedDistanceMeters: z.number().positive().optional(),
  precomputedDurationMinutes: z.number().positive().optional(),
});

export function parseGuideConfig(data: unknown): GuideConfig {
  const parsed = GuideConfigSchema.parse(data);
  return {
    ...parsed,
    stops: parsed.stops.map(stop => ({
      ...stop,
      id: createGuideStopId(stop.id),
      poiId: createPOIId(stop.poiId),
    })) as NonEmptyArray<GuideStopConfig>,
  };
}
```

**Filer:**
- `lib/errors/guide-errors.ts` (ny)
- `lib/validation/guide-schema.ts` (ny)

---

## Acceptance Criteria

### Funksjonelle krav

- [ ] Guide vises på URL `/visitnorway/10000-skritt-trondheim`
- [ ] Kart viser rutelinje gjennom alle 7 stopp
- [ ] Markører har nummer-badges (1-7)
- [ ] Bottom sheet viser nåværende stopp med navn, beskrivelse, avstand
- [ ] Bruker kan navigere med Neste/Forrige-knapper
- [ ] Progressbar oppdateres ved navigasjon
- [ ] "Merk som besøkt" endrer markør-visuelt
- [ ] Geolokasjon viser brukerposisjon på kart (hvis tillatt)

### Performance Benchmarks (from Performance Review)

| Metric | Target | Notes |
|--------|--------|-------|
| Route calculation | < 500ms | Single multi-waypoint API call |
| Time to Interactive | < 2.5s | Lazy load non-critical |
| Frame rate during drag | 60fps | Use `transform`, not `height` |
| Battery drain per hour | < 5% | Adaptive geolocation accuracy |

### Quality Gates

- [ ] TypeScript kompilerer uten feil
- [ ] Ingen console errors/warnings
- [ ] Manuell test: Gå gjennom hele guiden på mobil
- [ ] Bottom sheet maintains 60fps during drag
- [ ] Zod-validering fanger ugyldig JSON-data
- [ ] Error boundary viser fallback ved runtime-feil
- [ ] AbortController cancels fetch ved navigasjon/unmount

---

## Dependencies & Prerequisites

**Eksisterende:**
- Mapbox Directions API (eksisterer allerede: `/api/directions`)
- Geolocation hook (`lib/hooks/useGeolocation.ts`)
- Bottom sheet (`ExplorerBottomSheet.tsx`)
- Route layer (`components/map/route-layer.tsx`)

**Ny avhengighet:**
- `zod` — JSON schema validation (må installeres: `npm install zod`)

---

## Risk Analysis & Mitigation (Enhanced)

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Mapbox Directions-kall med 7 punkter er tregt | Lav | Medium | Single multi-waypoint request |
| Bottom sheet fungerer ikke bra med kart bak | Lav | Høy | Use `transform` animation, test on real devices |
| Geolokasjon gir dårlig UX ved "denied" | Medium | Medium | Graceful degradation, re-enable prompt |
| Race conditions mellom GPS/nav/sheet | Medium | High | State machine + transition locks |
| localStorage hydration flash | Medium | Medium | Hydration guard component |

---

## Open Questions (Updated)

### Kritiske (må avklares før implementering)

1. **Linear vs non-linear navigasjon?**
   - **Beslutning:** Tillat jumping — fysisk vandring håndhever ikke rekkefølge

2. **Progressjon-persistens?**
   - **Beslutning:** localStorage for MVP med hydration guard

### Viktige (påvirker UX)

3. **Proximity threshold for auto-mark?**
   - **Beslutning:** Ikke i MVP. Manuell "merk som besøkt" kun.

4. **Completion experience?**
   - **Beslutning:** Toast + confetti i MVP. Full modal i v2.

---

## References & Research

### Internal References

- Explorer patterns: `components/variants/explorer/ExplorerMap.tsx:153-170`
- Route fitting: `components/variants/explorer/ExplorerMap.tsx:124-139`
- Bottom sheet: `components/variants/explorer/ExplorerBottomSheet.tsx`
- Geolocation: `lib/hooks/useGeolocation.ts`
- Route layer: `components/map/route-layer.tsx`
- Learnings: `docs/solutions/ui-patterns/explorer-desktop-layout-pattern.md`

### External References

- [Mapbox Directions API](https://docs.mapbox.com/api/navigation/directions/)
- [react-map-gl Documentation](https://visgl.github.io/react-map-gl/)
- [AllTrails Hands-Free Updates](https://www.alltrails.com/press/)
- [Detour Walking Tour Innovation](https://techcrunch.com/2014/07/30/detour/)

### Research Agents Applied

1. **Frontend Design:** Typography (DM Serif Display), color system, marker states
2. **TypeScript Review:** Branded IDs, discriminated unions, unit suffixes
3. **Performance Oracle:** GPU animation, single API call, battery optimization
4. **Architecture Strategist:** Composition over forking, state management patterns
5. **Frontend Races:** State machine, transition locks, hydration guard
6. **Code Simplicity:** 8 → 3 components, inline small UI elements
7. **Pattern Recognition:** Follow Explorer's mobile/desktop pattern
8. **Mapbox Best Practices:** fitBounds, memoized markers, padding
9. **Bottom Sheet Practices:** transform animation, safe areas, accessibility
10. **Explorer Learnings:** Route fitting, padding strategies, TypeScript gotchas
11. **Data Loading:** Dynamic fs pattern, no static imports
12. **Walking Tour UX:** GPS-triggered, distance-to-next, progress tracker

### Plan Review Improvements (2026-02-02)

**From Kieran TypeScript Review:**
- Constructor functions for branded types (`createPOIId`, `createGuideStopId`)
- `assertNever` utility for exhaustive switch statements
- AbortController for proper fetch cancellation
- `GuideError` class with typed error codes
- Zod schemas for JSON validation at boundaries
- `NonEmptyArray<T>` for stops array
- Unix timestamps instead of Date for serialization
- Type guards (`isCompletedStop`) for status narrowing
- Typed `RouteState` discriminated union with error state
- Error boundary around main component

---

## Success Metrics

**Prototype validering:**
- [ ] Intern dogfooding: Gå turen i Trondheim med prototypen
- [ ] UX-feedback: Er det 10x bedre enn Visit Norway?
- [ ] Teknisk: Kan vi enkelt legge til flere guider?

**Go/No-Go for full Guide-produkt:**
- Fungerer navigasjons-modus i praksis?
- Er datamodellen fleksibel nok?
- Er gjenbruk fra Explorer tilstrekkelig?
