---
title: "Skeleton Loading for Report Page"
type: feat
date: 2026-02-04
deepened: 2026-02-04
---

# Skeleton Loading for Report Page

## Enhancement Summary

**Deepened on:** 2026-02-04
**Research agents used:** best-practices-researcher, framework-docs-researcher, kieran-typescript-reviewer, julik-frontend-races-reviewer, performance-oracle, code-simplicity-reviewer, architecture-strategist

### Key Improvements from Research
1. **Simplified scope** - Focus on map loading only, not page-level hydration (SSR data is already present)
2. **Race condition fixes** - Capture mount time inside useEffect, add mounted flag
3. **Performance optimizations** - Consolidated IntersectionObserver, visibility-based animation pause
4. **Architectural clarity** - Document two distinct loading patterns (AsyncLoadState vs HydrationState)

### Critical Finding: SSR vs Async Loading

**Report page data is SSR - no async loading.** Unlike Explorer which fetches travel times via API, Report receives all data via props. Page-level skeleton for "hydration" would add artificial delay to content that renders immediately.

**Recommended approach:** Focus skeleton loading on **map tiles only** (lazy-loaded per section), not page-level content.

---

## Overview

Implementer skeleton loading for Report-sidens lazy-loadede kart-seksjoner. Report har andre forutsetninger enn Explorer (SSR vs async API):

| Aspect | Explorer | Report |
|--------|----------|--------|
| Data source | Async API calls (`useTravelTimes`) | SSR - data in `project` prop |
| Loading state | Real - waiting for network | Maps only - lazy-loaded per section |
| Skeleton scope | Full page until API returns | Per-section map loading |

**Focus areas:**
1. ~~Initial page load~~ - SSR handles this
2. ~~Hydration delay~~ - Content renders immediately
3. **Map tiles loading** - Skeleton mens Mapbox-fliser lastes per seksjon
4. **Image loading** - Klar til fremtidig bildestøtte i Report-kort

## Problem Statement / Motivation

Report-siden viser innhold umiddelbart via SSR. Det reelle problemet er:
- **Map pop-in** - Kart "popper" inn når bruker scroller til en seksjon
- **Layout shift** - Når kartet rendres og tar plass
- **Inconsistent loading UX** - Current `animate-pulse` differs from Explorer's shimmer

Explorer-løsningen (dokumentert i `docs/solutions/ux-loading/skeleton-loading-explorer-20260204.md`) demonstrerer shimmer-mønsteret vi skal bruke for kart.

## Technical Approach

### Arkitektonisk beslutning: To lastingsmønstre

Placy har to distinkte lastingsmønstre:

| Mønster | Bruksområde | State Machine |
|---------|-------------|---------------|
| **AsyncLoadState** | Explorer, Guide (async API) | `"initial" \| "loading" \| "loaded" \| "error" \| "refreshing"` |
| **HydrationState** | Report (SSR + lazy maps) | Ingen page-level state, per-section `isInView` |

Report bruker **ikke** page-level state machine fordi data er SSR. Fokus er per-section lazy loading.

### Implementasjonsplan

#### Fase 1: Forbedret Map Skeleton (Eneste nye komponent)

**SkeletonReportMap.tsx** - erstatter basic pulse:

```typescript
// components/ui/SkeletonReportMap.tsx
"use client";

interface SkeletonReportMapProps {
  className?: string;
}

export function SkeletonReportMap({ className }: SkeletonReportMapProps) {
  return (
    <div
      className={cn(
        "w-full h-full bg-[#f5f3f0] flex items-center justify-center",
        className
      )}
      aria-hidden="true"
      role="presentation"
    >
      <div className="flex flex-col items-center gap-3">
        {/* Map pin icon placeholder */}
        <div className="w-12 h-12 rounded-full skeleton-shimmer" />
        <div className="h-3 w-24 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}
```

### Research Insight: Reuse existing components

Eksisterende `SkeletonMapOverlay.tsx` kan brukes direkte. Vurder om ny komponent er nødvendig.

#### Fase 2: Forbedret IntersectionObserver (Race Condition Fix)

**Problem identifisert av julik-frontend-races-reviewer:**
- Nåværende kode kan skape multiple observers ved re-renders
- Cleanup returnerer `undefined` når `isInView` er true

**Forbedret implementasjon:**

```typescript
// ReportInteractiveMapSection.tsx - forbedret lazy loading
const observerRef = useRef<IntersectionObserver | null>(null);
const [isInView, setIsInView] = useState(false);

useEffect(() => {
  // Skip if already in view or no element
  if (isInView || !sectionRef.current) return;

  // Don't create duplicate observers
  if (observerRef.current) return;

  observerRef.current = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observerRef.current?.disconnect();
        observerRef.current = null;
      }
    },
    { rootMargin: "100px" }
  );

  observerRef.current.observe(sectionRef.current);

  return () => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  };
}, [isInView]);
```

### Research Insight: Consolidated Observer

For bedre ytelse med 5+ seksjoner, vurder page-level observer som deles mellom seksjoner.

#### Fase 3: Oppdater Map Loading UI

Erstatt `animate-pulse` med shimmer:

```typescript
// ReportInteractiveMapSection.tsx
// Før:
{!isInView && (
  <div className="w-full h-full bg-[#f5f3f0] animate-pulse flex items-center justify-center">
    <span className="text-[#8a8a8a] text-sm">Laster kart...</span>
  </div>
)}

// Etter:
{!isInView && <SkeletonReportMap />}
```

#### Fase 4: Accessibility

- Skeleton-elementer får `aria-hidden="true"` (dekorative)
- Reduced motion support (allerede i globals.css via `prefers-reduced-motion`)
- Ingen live region nødvendig (ingen async data-loading)

## Acceptance Criteria

### Functional Requirements

- [x] Hver theme-seksjon viser kart-skeleton med shimmer før map er i viewport
- [x] Skeleton bruker samme `.skeleton-shimmer` CSS som Explorer (GPU-akselerert)
- [x] Kart-skeleton har samme dimensjoner som faktisk kart (500px høyde desktop)
- [x] IntersectionObserver er race-condition-fri (ref-basert cleanup)

### Non-Functional Requirements

- [ ] 60fps shimmer-animasjon på mobile enheter
- [ ] Ingen CLS (Cumulative Layout Shift) ved overgang skeleton → kart
- [ ] Respekterer `prefers-reduced-motion` (ingen animasjon)

### Quality Gates

- [ ] Lighthouse CLS score < 0.1
- [ ] Chrome DevTools Layers panel: < 20 compositor layers under skeleton
- [ ] Manuell test på CPU 4x throttle: ingen frames under 30fps

### Research Insight: Performance Benchmarks

Fra performance-oracle:
- GPU-akselerert `transform: translateX()` gir ~5% CPU vs ~25-40% for `background-position`
- Unngå `backdrop-filter: blur()` på overlays (-15 til -25 fps på mobil)

## Files to Create/Modify

### New Files
- `components/ui/SkeletonReportMap.tsx` - Shimmer-basert kart-placeholder

### Modified Files
- `components/variants/report/ReportInteractiveMapSection.tsx` - Bruk SkeletonReportMap, fiks IntersectionObserver race condition

### Files NOT Modified (Simplified Scope)

~~`components/ui/SkeletonReportHero.tsx`~~ - Ikke nødvendig, SSR-data
~~`components/ui/SkeletonReportCard.tsx`~~ - Ikke nødvendig, SSR-data
~~`components/variants/report/ReportPage.tsx`~~ - Ingen page-level state machine

## Dependencies & Prerequisites

- Eksisterende `.skeleton-shimmer` CSS i globals.css (allerede på plass)
- Eksisterende `SkeletonMapOverlay.tsx` som referanse

## Implementation Notes

### Gjenbruk fra Explorer

Følgende kan gjenbrukes direkte:
- `skeleton-shimmer` CSS-klasse (GPU-akselerert)
- Komponent-struktur fra `SkeletonMapOverlay.tsx`

### Ikke gjenbruk

- `LoadState` type - Report har ingen async data-fetching
- Page-level skeleton - SSR-data rendres umiddelbart
- `role="status" aria-live="polite"` - Ingen loading-announcements nødvendig

### Research Insights: Pitfalls to Avoid

**Fra julik-frontend-races-reviewer:**
```typescript
// FEIL: mountTimeRef captured during render, not commit
const mountTimeRef = useRef<number>(Date.now());

// RIKTIG: Capture inside effect
useEffect(() => {
  const mountTime = Date.now();
  // ...
}, []);
```

**Fra performance-oracle:**
```css
/* FEIL: Layer explosion with many shimmer elements */
.skeleton-shimmer { will-change: transform; }

/* RIKTIG: Add containment */
.skeleton-shimmer {
  contain: strict;
  content-visibility: auto;
}
```

**Fra code-simplicity-reviewer:**
- Original plan: 4 nye komponenter, ~150 LOC
- Forenklet plan: 1 komponent, ~30 LOC
- **Reduksjon: ~80%**

## Future Considerations

### If page-level skeleton becomes necessary

Bruk `useSyncExternalStore` for hydration detection (fra framework-docs-researcher):

```typescript
import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

export function useIsHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,  // Client: hydrated
    () => false  // Server: not hydrated
  );
}
```

### Scalability for large reports

For reports med 20+ seksjoner, vurder:
- Konsolidert page-level IntersectionObserver
- Virtualisert skeleton-rendering
- Visibility-based animation pause

## References & Research

### Internal References

- Eksisterende skeleton-implementasjon: `components/variants/explorer/ExplorerPage.tsx:131-179`
- Skeleton-komponenter: `components/ui/SkeletonPOICard.tsx`, `SkeletonMapOverlay.tsx`
- Shimmer CSS: `app/globals.css:147-178` (`.skeleton-shimmer`)
- Dokumentasjon: `docs/solutions/ux-loading/skeleton-loading-explorer-20260204.md`

### External References (fra research agents)

**Best Practices:**
- [Next.js Loading UI and Streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
- [TkDodo: Avoiding Hydration Mismatches with useSyncExternalStore](https://tkdodo.eu/blog/avoiding-hydration-mismatches-with-use-sync-external-store)
- [Web Animation Performance Tier List](https://motion.dev/magazine/web-animation-performance-tier-list)

**Accessibility:**
- [MDN: aria-busy attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy)
- [Semrush: Skeleton A11y](https://developer.semrush.com/intergalactic/components/skeleton/skeleton-a11y)

**Performance:**
- [CSS GPU Acceleration Guide](https://www.lexo.ch/blog/2025/01/boost-css-performance-with-will-change-and-transform-translate3d-why-gpu-acceleration-matters/)
- [Web.dev CLS Best Practices](https://web.dev/cls/)
