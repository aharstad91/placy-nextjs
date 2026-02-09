---
title: "feat: Konsekvent hvit marker-tooltip for hover og klikk"
type: feat
date: 2026-02-09
---

# Konsekvent hvit marker-tooltip for hover og klikk

## Overview

Erstatt de to forskjellige tooltip-designene (mork hover-tooltip + hvit klikk-pille) med en enkelt `<MarkerTooltip>` komponent som brukes i begge tilstander. Tooltip-en er alltid hvit, alltid over markoren, og har identisk innhold uavhengig av interaksjonstype. Forskjellen mellom hover og klikk uttrykkes kun gjennom markorens egne effekter (pulse, scale, shadow).

**Brainstorm:** `docs/brainstorms/2026-02-09-konsekvent-marker-tooltip-brainstorm.md`

## Problem Statement

I dag har vi to helt forskjellige tooltip-implementasjoner:

| Aspekt | Hover (na) | Klikk (na) |
|--------|-----------|------------|
| Bakgrunn | Mork (`bg-gray-900/90`) | Hvit (`bg-white`) |
| Plassering | Over markor | Under markor |
| Innhold | Navn, kategori, rating, reisetid | Navn, reisetid, Rute-knapp |
| Design | Tooltip med pil ned | Pille uten pil |

Disse er duplisert i 3 map-varianter (ExplorerMap, TripMap, ReportStickyMap) med sma variasjoner. Totalt 6 forskjellige tooltip-blokker i kodebasen.

## Proposed Solution

Ny `<MarkerTooltip>` komponent med hvit bakgrunn, plassert over markor, som brukes for bade hover og klikk via en enkel `{(isHovered || isActive) && <MarkerTooltip ... />}` betingelse.

### Komponent-API

```tsx
// components/map/marker-tooltip.tsx

interface MarkerTooltipProps {
  name: string;
  categoryName: string;
  categoryColor: string;
  categoryId: string;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  /** Reisetid i hele minutter, pre-rundet av caller. Ikke rund internt. */
  travelTimeMinutes?: number | null;
  travelMode?: TravelMode;
  /** Override kategorinavn med egendefinert tekst (f.eks. "Start" i TripMap) */
  subtitle?: string;
}
```

### Visuelt design

```
+------------------------------------------+
|  Boba Joy Trondheim                      |
|  Kafe  ·  * 4.7 (124)  ·  Fo 5 min      |
+------------------------------------------+
         V  (pil ned)
```

- Hvit bakgrunn, `rounded-lg`, `shadow-lg border border-gray-100`
- Navn: `text-xs font-semibold text-gray-900`
- Andre rad: `text-[11px] text-gray-500` med dot-separatorer
- GoogleRating med `variant="light"`
- Pil ned (rotert firkant) i hvit
- Animasjon: `animate-fade-in` (eksisterende 0.15s ease-out)

## Technical Approach

### Fase 1: Opprett `<MarkerTooltip>` komponent

**Fil:** `components/map/marker-tooltip.tsx`

Ny selvstendig komponent som:
- Rendrer hvit tooltip med innhold basert pa props
- Bruker `shouldShowRating()` fra `@/lib/themes/rating-categories` (allerede delt utility)
- Viser travel time kun nar `travelTimeMinutes` er gitt
- Viser riktig travel mode-ikon basert pa `travelMode` prop
- Aksepterer `subtitle` prop for TripMap-spesifikk tekst ("Start")
- Bruker `pointer-events-none` (som dagens hover-tooltip)

```tsx
// Pseudo-kode for layout
<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap pointer-events-none z-20 animate-fade-in">
  <div className="bg-white px-3 py-1.5 rounded-lg shadow-lg border border-gray-100 text-xs">
    <div className="font-semibold text-gray-900 truncate max-w-[200px]">{name}</div>
    <div className="flex items-center gap-1.5 mt-0.5 text-gray-500">
      <span>{subtitle ?? categoryName}</span>
      {/* Rating med shouldShowRating-filter */}
      {shouldShowRating(categoryId) && googleRating > 0 && (
        <>
          <span className="text-gray-300">·</span>
          <GoogleRating variant="light" size="xs" ... />
        </>
      )}
      {/* Travel time */}
      {travelTimeMinutes != null && (
        <>
          <span className="text-gray-300">·</span>
          <TravelIcon className="w-3 h-3" />
          <span>{travelTimeMinutes} min</span>
        </>
      )}
    </div>
  </div>
  {/* Pil ned */}
  <div className="w-2 h-2 bg-white border-b border-r border-gray-100 rotate-45 mx-auto -mt-1.5" />
</div>
```

### Fase 2: Integrer i ExplorerMap

**Fil:** `components/variants/explorer/ExplorerMap.tsx`

1. Erstatt bade hover-tooltip (linje ~324-348) OG aktiv-pille (linje ~350-381) med:

```tsx
{(isHovered || isThisActive) && (
  <MarkerTooltip
    name={poi.name}
    categoryName={poi.category.name}
    categoryColor={poi.category.color}
    categoryId={poi.category.id}
    googleRating={poi.googleRating}
    googleReviewCount={poi.googleReviewCount}
    travelTimeMinutes={poiTravelTime != null ? Math.round(poiTravelTime / 60) : null}
    travelMode={travelMode}
  />
)}
```

2. Fjern `Navigation`-import (Rute-knapp forsvinner)

**Viktig:** `poiTravelTime` er i sekunder (`poi.travelTime[travelMode]`), sa del pa 60 for minutter. Dette fikser ogsa den eksisterende inkonsistensen der ExplorerMap viser sekunder som minutter.

### Fase 3: Integrer i TripMap

**Fil:** `components/variants/trip/TripMap.tsx`

1. Erstatt hover-tooltip (~linje 275-287) OG aktiv-pille (~linje 289-304) med:

```tsx
{(isHovered || isActive) && (
  <MarkerTooltip
    name={stop.name}
    categoryName={stop.category.name}
    categoryColor={stop.category.color}
    categoryId={stop.category.id}
    subtitle={isStartPoint ? "Start" : undefined}
  />
)}
```

TripMap viser ikke rating eller reisetid i tooltip — kun navn og kategori/subtitle.

### Fase 4: Integrer i ReportStickyMap

**Fil:** `components/variants/report/ReportStickyMap.tsx`

1. Erstatt hover-tooltip (~linje 343-368) OG eventuell aktiv-label med:

```tsx
{(isHovered || isActive) && (
  <MarkerTooltip
    name={poi.name}
    categoryName={poi.category.name}
    categoryColor={poi.category.color}
    categoryId={poi.category.id}
    googleRating={poi.googleRating}
    googleReviewCount={poi.googleReviewCount}
    travelTimeMinutes={walkMinutes}
    travelMode="walk"
  />
)}
```

**Merk:** ReportStickyMap bruker IKKE `AdaptiveMarker`, men tooltip-en er en standalone komponent som posisjoneres relativt til forelder-elementet. Den fungerer uavhengig av marker-type.

### Fase 5: Opprydding

- Fjern ubrukte importer (`Navigation` fra lucide-react der Rute-knappen var)
- Verifiser at `animate-fade-in` i `globals.css` fungerer med hvit bakgrunn (den gjor det — den animerer opacity/translate, ikke farge)
- Legg til `prefers-reduced-motion` regel for `.animate-fade-in` i `globals.css`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .animate-fade-in { animation: none; }
  }
  ```

## Acceptance Criteria

- [x] Ny `components/map/marker-tooltip.tsx` komponent med props-interface
- [x] ExplorerMap: hover og klikk viser identisk hvit tooltip over markor
- [x] ExplorerMap: Rute-knappen fjernet fra tooltip
- [x] ExplorerMap: `(isHovered || isThisActive)` betingelse — ingen flicker ved klikk
- [x] TripMap: hover og klikk viser hvit tooltip med `subtitle="Start"` for forste stopp
- [x] ReportStickyMap: hover og klikk viser hvit tooltip (fungerer uten AdaptiveMarker)
- [x] GoogleRating bruker `variant="light"` i tooltip
- [x] Travel time vises i minutter (konverter fra sekunder der nodvendig)
- [x] `shouldShowRating()` filtrering beholdes
- [x] Tooltip har pil ned mot markor
- [x] Ingen endringer i markorens aktiv-effekter (pulse, scale, shadow)
- [x] Ingen endringer i bottom sheet (mobil)
- [x] Ingen endringer i zoom-adaptiv oppforsel
- [x] `pointer-events-none` pa tooltip (hindrer at den blokkerer klikk pa markorer under)
- [x] `prefers-reduced-motion` regel for `.animate-fade-in` i globals.css
- [x] Barrel export i `components/map/index.ts`

## Scope

### Inkludert
- `components/map/marker-tooltip.tsx` (ny fil)
- `components/map/index.ts` (legg til barrel export)
- `components/variants/explorer/ExplorerMap.tsx` (erstatt 2 tooltip-blokker)
- `components/variants/trip/TripMap.tsx` (erstatt 2 tooltip-blokker)
- `components/variants/report/ReportStickyMap.tsx` (erstatt 1-2 tooltip-blokker)
- `app/globals.css` (legg til `prefers-reduced-motion` for `.animate-fade-in`)

### Eksplisitt ekskludert
- `ExplorerMap3D` / `TripMap3D` (3D-varianter, annet rendersystem)
- `ReportInteractiveMap` (har ingen tooltips i dag)
- Bottom sheet / mobil-layout
- Marker-ikon/form/zoom-oppforsel
- Sidebar POI-kort

## Risiko og edge cases

| Edge case | Handtering |
|-----------|-----------|
| Markor naer toppen av viewport | Tooltip klippes — samme som i dag. Ingen flip-logikk. |
| Dot zoom-state (zoom < 13) | Tooltip vises — markoren promoteres til icon-storrelse ved aktiv. |
| To tooltips synlige samtidig (hover B + aktiv A) | Tillatt — markor-effektene (pulse) skiller tilstandene. |
| Langt POI-navn | `truncate max-w-[200px]` pa navnefeltet. |
| Manglende rating/reisetid | Feltet vises ikke, dot-separator skjules. |
| Mobil (ingen hover) | Tooltip vises kun ved tap (aktiv), bottom sheet tar over for detaljer. |

## References

- **Brainstorm:** `docs/brainstorms/2026-02-09-konsekvent-marker-tooltip-brainstorm.md`
- **Eksisterende hover-tooltip:** `components/variants/explorer/ExplorerMap.tsx:324-348`
- **Eksisterende aktiv-pille:** `components/variants/explorer/ExplorerMap.tsx:350-381`
- **AdaptiveMarker:** `components/map/adaptive-marker.tsx`
- **GoogleRating:** `components/ui/GoogleRating.tsx`
- **Animasjoner:** `app/globals.css:108-132`
- **Zoom-state hook:** `lib/hooks/useMapZoomState.ts`
- **shouldShowRating:** `lib/themes/rating-categories.ts` (delt utility, importert av 7+ filer)
