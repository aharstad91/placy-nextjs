---
title: "Skeleton Loading for Report Map Sections"
date: 2026-02-04
category: ux-loading
tags:
  - skeleton
  - loading-state
  - shimmer
  - intersection-observer
  - race-condition
  - lazy-loading
  - gpu-animation
  - react-patterns
module: report
symptom: |
  - Map "pops in" when user scrolls to a theme section
  - Inconsistent loading UX (animate-pulse differs from Explorer's shimmer)
  - Layout shift when lazy-loaded map renders
  - Potential race conditions with IntersectionObserver on re-renders
root_cause: |
  Basic animate-pulse placeholder was used instead of consistent shimmer animation.
  IntersectionObserver created without ref-based tracking, risking duplicate observers
  on component re-renders. Unlike Explorer (async API), Report data is SSR but maps
  are still lazy-loaded per section.
solution: |
  Created SkeletonReportMap component with GPU-accelerated shimmer matching Explorer's
  pattern. Fixed IntersectionObserver race condition using ref-based observer management.
  Scope limited to map loading only (not page-level) since Report uses SSR for data.
files_changed:
  - components/ui/SkeletonReportMap.tsx (created)
  - components/variants/report/ReportInteractiveMapSection.tsx (modified)
commit: 49a816c
related:
  - docs/solutions/ux-loading/skeleton-loading-explorer-20260204.md
---

# Skeleton Loading for Report Map Sections

## Problem

Report-sidens lazy-loadede kart hadde flere UX-problemer:

1. **Inkonsistent loading-animasjon** - Brukte `animate-pulse` mens Explorer bruker shimmer
2. **Kart "popper inn"** - Ingen visuell overgang når bruker scroller til en seksjon
3. **Race condition-risiko** - IntersectionObserver kunne lage duplikater ved re-renders

**Viktig kontekst:** Report-data er SSR (kommer via props), ikke async API som Explorer. Derfor trengs ikke page-level skeleton - kun per-section map loading.

## Solution

### 1. SkeletonReportMap-komponent

Ny shimmer-basert skeleton som matcher Explorer's mønster:

```typescript
// components/ui/SkeletonReportMap.tsx
"use client";

import { cn } from "@/lib/utils";

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

### 2. Race Condition-fri IntersectionObserver

Ref-basert observer-håndtering som unngår duplikater:

```typescript
// ReportInteractiveMapSection.tsx
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

### 3. Bruker SkeletonReportMap i stedet for animate-pulse

```typescript
// Før:
{!isInView && (
  <div className="w-full h-full bg-[#f5f3f0] animate-pulse flex items-center justify-center">
    <span className="text-[#8a8a8a] text-sm">Laster kart...</span>
  </div>
)}

// Etter:
{!isInView && <SkeletonReportMap />}
```

## Key Patterns

| Pattern | Implementasjon |
|---------|----------------|
| GPU Animation | Gjenbruker `.skeleton-shimmer` CSS med `transform: translateX()` |
| Ref-basert Observer | `observerRef.current` forhindrer duplikate observers |
| Early Return Guards | Sjekker `isInView` og `observerRef.current` før opprettelse |
| Cleanup | Alltid `disconnect()` og nullstill ref i cleanup |
| Pre-loading | `rootMargin: "100px"` starter lasting før element er synlig |
| Accessibility | `aria-hidden="true"` på dekorative elementer |

## Architectural Decision: SSR vs Async Loading

Placy har to distinkte lastingsmønstre:

| Mønster | Bruksområde | Skeleton-behov |
|---------|-------------|----------------|
| **AsyncLoadState** | Explorer, Guide (async API) | Page-level skeleton til data kommer |
| **HydrationState** | Report (SSR + lazy maps) | Per-section skeleton kun for kart |

Report bruker **ikke** page-level state machine fordi data er SSR. Fokus er kun på lazy-loaded map components.

## Prevention Strategies

### Når du implementerer lazy loading med IntersectionObserver:

1. **Bruk ref for observer-instansen** - Unngår duplikater ved re-renders
2. **Early return guards** - Sjekk tilstand før opprettelse
3. **Cleanup alltid** - Disconnect og nullstill i useEffect cleanup
4. **Enum over booleans** - For komplekse loading states, bruk state machine

### Når du velger skeleton-scope:

1. **Sjekk datakilde** - SSR vs async API
2. **Match eksisterende mønstre** - Bruk samme shimmer CSS som andre komponenter
3. **Unngå over-engineering** - Ikke lag page-level skeleton for SSR-data

## Pitfalls to Avoid

### 1. Observer uten ref-tracking

```typescript
// FEIL: Kan lage duplikate observers
useEffect(() => {
  const observer = new IntersectionObserver(/*...*/);
  observer.observe(ref.current);
  return () => observer.disconnect();
}, []);

// RIKTIG: Ref-basert tracking
const observerRef = useRef<IntersectionObserver | null>(null);
useEffect(() => {
  if (observerRef.current) return; // Guard mot duplikater
  observerRef.current = new IntersectionObserver(/*...*/);
  // ...
}, [isInView]);
```

### 2. Inkonsistent loading-animasjon

```css
/* FEIL: CPU-basert, annerledes enn Explorer */
.loading { animation: pulse 2s infinite; }

/* RIKTIG: GPU-akselerert, konsistent med Explorer */
.skeleton-shimmer::after {
  transform: translateX(-100%);
  animation: shimmer 1.5s ease-in-out infinite;
}
```

### 3. Over-scoping skeleton for SSR

```typescript
// FEIL: Page-level skeleton for SSR-data (unødvendig delay)
if (loadState === "loading") return <PageSkeleton />;

// RIKTIG: Kun skeleton for lazy-loaded komponenter
{!isInView && <SkeletonReportMap />}
```

## Performance Notes

- GPU-akselerert shimmer: ~5% CPU vs ~25-40% for `background-position`
- `rootMargin: "100px"` gir pre-loading uten synlig delay
- Ingen `backdrop-filter: blur()` - bevarer 60fps på mobil

## Related Documentation

- [Skeleton Loading Explorer](./skeleton-loading-explorer-20260204.md) - Komplett state machine og shimmer-implementasjon
- [Plan: Skeleton Loading Report](../../plans/2026-02-04-feat-skeleton-loading-report-plan.md) - Original plan med research insights
