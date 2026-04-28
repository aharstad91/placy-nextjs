---
title: Deaktiver distansebasert opacity-dimming for POI-ikoner i 3D Google Maps-modal
type: refactor
status: active
date: 2026-04-28
---

# Deaktiver distansebasert opacity-dimming for POI-ikoner i 3D Google Maps-modal

## Overview

Fjerner distansebasert opacity-logikk i `ReportOverviewMap` slik at alle POI-ikoner i 3D Google Maps-modalen rendres med full opacity (1.0). I dag dimmes POI-er som ligger >1200m fra prosjektsenter til opacity 0.3, mens nære POI-er rendres med 1.0. Konseptet leverer ikke god UX i sin nåværende form og fjernes inntil videre — kan revurderes som separat oppgave senere.

## Problem Frame

Når man åpner 3D-modalen i en rapport, ser man at POI-er langt unna prosjektet er tydelig dimmet (opacity 0.3). Dette gjør kartet visuelt urolig og skaper inntrykk av at POI-ene er "halvt aktivert" eller utilgjengelige, selv om de er klikkbare og fullt funksjonelle. De andre kart-variantene i appen (Mapbox 2D, ReportThemeMap) har ikke denne logikken — alle POI-er rendres likt.

Vi ønsker konsistent visuell behandling: alle POI-er får full opacity i 3D-modalen, identisk med øvrige kart.

## Requirements Trace

- R1. Alle POI-ikoner i 3D Google Maps-modalen rendres med opacity 1.0
- R2. Ingen distansebasert visuell dimming gjenstår i `ReportOverviewMap`
- R3. `MapView3D`-komponenten fortsetter å fungere som i dag for andre konsumenter (defaulter til opacity 1 når `opacities`-prop er undefined)
- R4. Ingen regresjon i 2D-kartet eller andre rapport-blokker

## Scope Boundaries

- Kun `components/variants/report/blocks/ReportOverviewMap.tsx` endres
- `MapView3D`-komponenten beholder sin `opacities`-prop (kan brukes av andre konsumenter senere)
- 2D Mapbox-kartet (`ReportThemeMap`) berøres ikke — har ikke denne logikken
- Annen 3D-funksjonalitet (camera lock, tab-filtre, sheet, project site pin) endres ikke

### Deferred to Separate Tasks

- Fremtidig distanse-basert UX (f.eks. fade-out, color-grading, eller annet visuelt hierarki for fjerne POI-er): kan revurderes som separat brainstorm/plan senere

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/blocks/ReportOverviewMap.tsx:18-19` — konstantene `NEAR_THRESHOLD_M = 1200` og `FAR_OPACITY = 0.3` (kun brukt i denne filen)
- `components/variants/report/blocks/ReportOverviewMap.tsx:8` — `import { calculateDistance } from "@/lib/utils/geo"` (kun brukt inne i `poisWithOpacity`-useMemo)
- `components/variants/report/blocks/ReportOverviewMap.tsx:118-131` — `poisWithOpacity`-useMemo som bygger array med opacity per POI
- `components/variants/report/blocks/ReportOverviewMap.tsx:133-137` — `opacities`-useMemo som bygger Record for rask oppslag
- `components/variants/report/blocks/ReportOverviewMap.tsx:244` — `opacities={opacities}` sendes som prop til `<MapView3D>`
- `components/map/map-view-3d.tsx:312` — defaulter til opacity 1: `opacity={opacities?.[poi.id] ?? 1}` (gjør at fjerning av propen er trygg)
- `components/map/Marker3DPin.tsx:52` — markøren defaulter også til opacity 1 hvis ikke spesifisert: `opacity={opacity ?? 1}`

### Institutional Learnings

- Placy CLAUDE.md "Kodebase-hygiene": når noe gammelt erstattes/fjernes, slett det umiddelbart — ingen kommentert-ut kode eller dead imports

## Key Technical Decisions

- **Slett logikken fullstendig, ikke flag-gat den.** Konseptet revurderes ikke i nær fremtid; å beholde død kode bak en flag øker støy. Git-historikken er kilde for evt. gjenoppretting.
- **Behold `opacities`-prop på `MapView3D`.** Komponentens API er allerede generisk og kan brukes av andre konsumenter senere uten endring.
- **Fjern også den ubrukte `calculateDistance`-importen** — etter at `poisWithOpacity` er fjernet, er importen død og blir flagget av ESLint.

## Open Questions

### Resolved During Planning

- Skal `MapView3D`s `opacities`-prop også fjernes? **Nei** — den er en generisk API på en delt komponent og defaulter til 1 når undefined. Ingen kostnad ved å beholde den.
- Trenger vi backwards-compat eller en flag? **Nei** — Placy er i prototype/demo-stadium (per memory) og endringen er en ren visuell tilbakerulling.

## Implementation Units

- [ ] **Unit 1: Fjern distansebasert opacity-logikk i ReportOverviewMap**

**Goal:** Fjern all distansebasert opacity-beregning slik at alle POI-er rendres med opacity 1.0 i 3D-modalen.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/blocks/ReportOverviewMap.tsx`

**Approach:**
- Slett konstantene `NEAR_THRESHOLD_M` og `FAR_OPACITY` (linjer 18-19)
- Slett `poisWithOpacity`-useMemo (linjer 118-131)
- Slett `opacities`-useMemo (linjer 133-137)
- Fjern `opacities={opacities}`-prop fra `<MapView3D>`-instansen i `google3dSlot` (linje 244)
- Fjern `import { calculateDistance } from "@/lib/utils/geo"` (linje 8) — blir ubrukt etter at `poisWithOpacity` er fjernet
- Resultat: `<MapView3D>` mottar ikke lenger `opacities`-prop, og defaulter til 1.0 per POI via eksisterende fallback i `map-view-3d.tsx:312`

**Patterns to follow:**
- Slett død kode helt (CLAUDE.md "Kodebase-hygiene") — ingen kommentert-ut kode

**Test scenarios:**
- *Test expectation: none — ren sletting av visuell beregning, ingen ny atferd. Verifisering skjer via mekaniske sjekker + visuell test.*

**Verification:**
- `npm run lint` passerer (ingen unused imports)
- `npx tsc --noEmit` passerer
- `npm run build` passerer
- Visuell test: åpne en rapport (f.eks. `/eiendom/[customer]/[project]/rapport`), klikk "Utforsk i 3D", bekreft at alle POI-ikoner — inkludert de langt unna prosjektsenter — rendres med full opacity og er like skarpe som de nære

## System-Wide Impact

- **API surface parity:** `MapView3D` brukes flere steder (`grep "MapView3D"` for å bekrefte) — propen `opacities` beholdes som valgfri, så øvrige konsumenter er upåvirket
- **Unchanged invariants:** `MapView3D`-komponentens API endres ikke; `Marker3DPin`s opacity-fallback endres ikke; 2D Mapbox-rendering endres ikke
- **Integration coverage:** Visuell verifikasjon i 3D-modalen er nødvendig — dette er en visuell endring som ikke fanges av enhetstester

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Andre `MapView3D`-konsumenter forventer at `opacities` settes | Lav — propen er valgfri og defaulter til 1. Quick grep bekrefter at kun `ReportOverviewMap` setter den i dag. |
| Visuell regresjon i andre rapport-seksjoner | Lav — endringen er lokalisert til `ReportOverviewMap.tsx` og påvirker kun 3D-modalens rendering |

## Sources & References

- Berørt fil: `components/variants/report/blocks/ReportOverviewMap.tsx`
- Avhengig komponent: `components/map/map-view-3d.tsx` (uendret, men dokumentert default-fallback på linje 312)
