---
title: "feat: Inline POI-kortsystem med 5 varianter i Story"
type: feat
date: 2026-04-08
brainstorm: docs/brainstorms/2026-04-08-inline-poi-kortsystem-brainstorm.md
deepened: 2026-04-08
---

# feat: Inline POI-kortsystem med 5 varianter i Story

## Enhancement Summary

**Deepened on:** 2026-04-08
**Review agents used:** kieran-typescript-reviewer, julik-frontend-races-reviewer, architecture-strategist, code-simplicity-reviewer, performance-oracle, transport-api-explorer

### Key Improvements from Deepening
1. **AbortController i useRealtimeData** — alle 5 reviewere flagget manglende request cancellation. Must-fix.
2. **Promise.allSettled** erstatter Promise.all — isolerer feil mellom datakilder
3. **Forenklet filstruktur** — alle varianter inline i StoryPOIDialog.tsx, ikke separate filer
4. **CardVariant type + assertNever** — typesafe variant-rendering med exhaustive switch
5. **Skoledata fra poiMetadata** — ikke nye felter på POI-interface, bruk type guard
6. **useEffect-stabilisering** — depend på poi?.id, ikke fetchData callback

### Spenning: YAGNI vs brukerens krav
Simplicity-reviewer anbefalte å droppe Hyre og School (ingen data enda). Bruker sa eksplisitt "Alt i én omgang." **Alle 5 varianter bygges**, men med forenklet struktur.

---

## Overview

Refaktorer `StoryPOIDialog` til et kortsystem med 5 varianter. Alle varianter deler en felles header (ikon, navn, kategori, lukk-knapp). Under headeren er innholdet spesialisert: standard POI-info, sanntidsavganger, sykkeltilgjengelighet, bildelingsdata, eller skoleinformasjon. Variant velges automatisk basert på POI-data.

## Problem Statement / Motivation

Nåværende `StoryPOIDialog` viser kun standard POI-data (rating, editorial hook, local insight) uansett type. Transport-POI-er (bussholdeplasser, bysykkelstasjoner, Hyre) mangler sanntidsdata som gjør dem nyttige. Skoler mangler trinn/type-info som boligkjøpere trenger. Kortene er nøkkelen til at brukeren forstår nabolaget — de må vise kontekstuelt riktig innhold.

## Proposed Solution

**Én dialog-komponent med inline variant-sections.** Ikke separate filer per variant — alt i `StoryPOIDialog.tsx` med typesafe switch og `assertNever`. Følger mønsteret fra ReportPOICard (én komponent, ikke mange varianter).

### Arkitektur

```
StoryPOIDialog.tsx (~200-250 linjer)
  ├─ Header section (ikon, navn, kategori, close-knapp) — ALLTID
  ├─ Meta section (rating + gangtid) — ALLTID (når data finnes)
  └─ switch(getCardVariant(poi)):
     ├─ "standard"  → editorialHook + localInsight
     ├─ "transit"   → Entur sanntidsavganger (via useRealtimeData)
     ├─ "bysykkel"  → ledige sykler/låser (via useRealtimeData)
     ├─ "hyre"      → tilgjengelige biler (via useRealtimeData)
     ├─ "school"    → trinn + type + editorialHook + localInsight
     └─ default     → assertNever(variant)
```

### Research Insights: Filstruktur

**Simplicity-reviewer:** "Extracting components that have exactly one call site is premature abstraction." DialogHeader og DialogMeta forblir inline sections i StoryPOIDialog — ikke egne komponenter. `getCardVariant()` er 6 linjer og hører hjemme i toppen av StoryPOIDialog.tsx, ikke egen fil.

### Variant-deteksjon

```typescript
const SCHOOL_CATEGORY_IDS = ["school", "kindergarten"] as const;

type CardVariant = "transit" | "bysykkel" | "hyre" | "school" | "standard";

function getCardVariant(poi: POI): CardVariant {
  if (poi.enturStopplaceId) return "transit";
  if (poi.bysykkelStationId) return "bysykkel";
  if (poi.hyreStationId) return "hyre";
  if (SCHOOL_CATEGORY_IDS.includes(poi.category.id as typeof SCHOOL_CATEGORY_IDS[number])) return "school";
  return "standard";
}

function assertNever(x: never): never {
  throw new Error(`Unexpected variant: ${x}`);
}
```

### Research Insights: Variant-deteksjon

**Architecture-reviewer:** Vurder `poi.poiMetadata?.schoolLevel` som primærsignal for skole-variant, med kategori-ID som fallback. Mer robust enn streng-matching.

**TypeScript-reviewer:** `assertNever` i default-casen sikrer at nye varianter compilerer ikke uten render-kode.

## Technical Considerations

### Lazy datahenting med AbortController

**ALLE 5 reviewere flagget:** `useRealtimeData` mangler AbortController. Fikses som del av denne featuren.

```typescript
// useRealtimeData.ts — nøkkelendringer
useEffect(() => {
  const controller = new AbortController();

  async function fetchData() {
    // Reset data immediately on POI change (prevents stale rendering)
    setState(prev => ({ ...prev, loading: true, entur: undefined, bysykkel: undefined, hyre: undefined }));

    const results = await Promise.allSettled([
      poi.enturStopplaceId ? fetchEntur(poi.enturStopplaceId, controller.signal) : null,
      poi.bysykkelStationId ? fetchBysykkel(poi.bysykkelStationId, controller.signal) : null,
      poi.hyreStationId ? fetchHyre(poi.hyreStationId, controller.signal) : null,
    ]);

    if (controller.signal.aborted) return;
    // Process settled results independently — one failure doesn't suppress others
  }

  fetchData();
  const interval = setInterval(fetchData, POLLING_INTERVAL);
  return () => { controller.abort(); clearInterval(interval); };
}, [poi?.id, poi?.enturStopplaceId, poi?.bysykkelStationId, poi?.hyreStationId]);
```

**Nøkkelendringer fra reviews:**
1. **AbortController** — thread `signal` inn i alle fetch-kall, abort i cleanup (Julik)
2. **Promise.allSettled** erstatter Promise.all — Entur nede blokkerer ikke bysykkel-data (Julik)
3. **Depend på poi?.id** — ikke fetchData callback, unngår ustabile useEffect-deps (Julik)
4. **Reset data ved POI-bytte** — umiddelbart sett loading=true for å unngå stale rendering (Julik)
5. **Conditional fetch** — bare kall APIer som POI-en har ID for (Performance)

### Race Condition Testing

**Fra Julik-reviewer — reproduserbare tester:**
1. **Stale data race:** Throttle til Slow 3G, klikk bus-POI, klikk bike-POI mens loading → se om busdata vises under bike-navn
2. **Polling overshoot:** Sett POLLING_INTERVAL=3000, åpne dialog, vent 2.5s, lukk → sjekk Network for fetch etter close
3. **Reference instability:** console.log i useEffect, pan/zoom kart → effect skal IKKE fyre uten POI-endring

### Hyre API

Nytt endepunkt `/api/hyre/route.ts` basert på Entur Mobility v2 GraphQL.

```typescript
// app/api/hyre/route.ts
// Endpoint: https://api.entur.io/mobility/v2/graphql
// Query: stations(ids: [stationId]) with system filter "hyrenorge"
// Response: { stationName: string, numVehiclesAvailable: number }

interface HyreStationResponse {
  stationName: string;
  numVehiclesAvailable: number;
}
```

Gjenbruker GraphQL-query fra `scripts/import-hyre-stations.ts` men filtrert til enkelt-stasjon.

### Skole-metadata

**TypeScript-reviewer:** IKKE legg til `schoolLevel`/`schoolType` direkte på POI-interface. Bruk type guard på eksisterende `poiMetadata` JSONB:

```typescript
// Type guard for school metadata
interface SchoolMetadata {
  schoolLevel?: string;     // "1.–7. trinn", "8.–10. trinn", "Vg1–Vg3"
  schoolType?: "public" | "private";
}

function getSchoolMetadata(poi: POI): SchoolMetadata | null {
  const meta = poi.poiMetadata;
  if (!meta || typeof meta !== "object") return null;
  if (!("schoolLevel" in meta) && !("schoolType" in meta)) return null;
  return meta as SchoolMetadata;
}
```

**Architecture-reviewer:** Hydrer schoolLevel/schoolType i server data layer (`story-data.ts`) for clean component access.

### Feilhåndtering

- Promise.allSettled betyr at én API-feil ikke blokkerer andre
- Hver variant sjekker sin data: `if (realtimeData.entur)` → vis avganger, ellers vis "Sanntidsdata utilgjengelig"
- Aldri tom dialog — alltid minst header + gangtid

### Duplikat-opprydding

`formatDepartureTime` → `formatRelativeDepartureTime` i `lib/utils/format-time.ts`.

**TypeScript-reviewer:** Gi funksjonen et beskrivende navn og legg til unit test.

### Impact on ExplorerPOICard

**Architecture-reviewer flagget:** Hyre-utvidelse i `useRealtimeData` betyr at ExplorerPOICard automatisk mottar Hyre-data uten render-kode. Akseptabelt — vi dokumenterer at ExplorerPOICard Hyre-rendering er deferred.

### Performance Bug Fix

**Performance-reviewer fant:** `poi-card-expanded.tsx` linje 65 sender `poi` unconditionally til `useRealtimeData` uten å sjekke om POI har transport-IDer. Fiks: gate med `poi.enturStopplaceId || poi.bysykkelStationId ? poi : null`.

## Acceptance Criteria

### Funksjonelle krav
- [ ] Standard POI-kort viser rating, editorial hook, local insight, gangtid (som nå)
- [ ] Kollektivtransport-kort viser neste avganger med linje, destinasjon, transportmodus
- [ ] Bysykkel-kort viser ledige sykler og ledige låser
- [ ] Hyre-kort viser antall tilgjengelige biler
- [ ] Skole-kort viser trinn og type (offentlig/privat) + editorial innhold
- [ ] Variant velges automatisk basert på POI-data (ingen manuell konfigurasjon)
- [ ] Sanntidsdata hentes lazy (først ved dialog-åpning)
- [ ] Sanntidsdata oppdateres mens dialogen er åpen (polling 60s)
- [ ] Alle kort har felles header (ikon, navn, kategori, lukk-knapp)
- [ ] Dialog lukkes med backdrop-klikk, Escape, eller X-knapp

### Ikke-funksjonelle krav
- [ ] Loading-state (skeleton/spinner) mens sanntidsdata hentes
- [ ] Graceful fallback ved API-feil (vis standard innhold + feilmelding)
- [ ] Ingen layout shift når data lastes inn
- [ ] TypeScript: CardVariant type med assertNever, ingen `any`
- [ ] Alle imports bruker `@/`-prefix
- [ ] AbortController for request cancellation ved POI-bytte og dialog-close
- [ ] Promise.allSettled for feil-isolering mellom datakilder

## Implementation Phases

### Steg 0: Fix useRealtimeData (prerequisite) → TC-09, TC-11, TC-12

Fix latent bugs i `useRealtimeData` før variant-arbeid starter:
1. Legg til AbortController — thread `signal` inn i alle fetch-kall
2. Stabiliser useEffect dependencies — bruk `poi?.id` og transport-IDer, ikke `fetchData`
3. Reset data ved POI-bytte — umiddelbart sett loading=true
4. Bytt fra Promise.all til Promise.allSettled
5. Fiks `poi-card-expanded.tsx` linje 65 — gate `useRealtimeData` med transport-ID-sjekk

**Filer:**
- Endre: `lib/hooks/useRealtimeData.ts`
- Endre: `components/poi/poi-card-expanded.tsx`

**Verifisering:** Eksisterende Explorer/Report transport-rendering fungerer som før, men med bedre cleanup.

### Steg 1: Variant-infrastruktur i StoryPOIDialog → TC-01, TC-09, TC-10

Refaktorer `StoryPOIDialog.tsx`:
1. Legg til `CardVariant` type og `getCardVariant()` i toppen av filen (inline, ikke separat fil)
2. Organiser header som named section (ikke eget komponent)
3. Organiser meta (rating + gangtid) som named section
4. `StandardContent` case i switch — editorialHook + localInsight (nåværende innhold)
5. Bruk `switch(variant)` med `assertNever` default

**Filer:**
- Endre: `components/variants/story/StoryPOIDialog.tsx`

**Verifisering:** Standard POI-kort ser identisk ut som før refaktoren.

### Steg 2: Kollektivtransport-variant (Entur) + formatRelativeDepartureTime → TC-02, TC-07, TC-08

1. Legg til `"transit"` case i switch i `StoryPOIDialog.tsx`
2. Bruk `useRealtimeData` hook (allerede fikset i steg 0)
3. Vis: linjenummer med farge, destinasjon, relativ tid ("2 min")
4. Loading skeleton mens data hentes
5. Max 4 avganger
6. Ekstraher `formatRelativeDepartureTime` til `lib/utils/format-time.ts`

**Filer:**
- Endre: `components/variants/story/StoryPOIDialog.tsx`
- Ny: `lib/utils/format-time.ts`
- Endre: `components/variants/explorer/ExplorerPOICard.tsx` (bruk ny utility)
- Endre: `components/poi/poi-card-expanded.tsx` (bruk ny utility)

**Verifisering:** Klikk på bussholdeplass i Story → viser sanntidsavganger.

### Steg 3: Bysykkel-variant → TC-03, TC-07, TC-08

1. Legg til `"bysykkel"` case i switch
2. Bruk `useRealtimeData` (allerede støtter bysykkel)
3. Vis: ledige sykler, ledige låser, stasjonsstatus (åpen/stengt)
4. Loading skeleton

**Filer:**
- Endre: `components/variants/story/StoryPOIDialog.tsx`

**Verifisering:** Klikk på bysykkelstasjon → viser tilgjengelighet.

### Steg 4: Hyre-variant (ny API + hook-utvidelse) → TC-04, TC-07, TC-08

1. Lag `/api/hyre/route.ts` — Entur Mobility v2 GraphQL for enkelt-stasjon med typed response
2. Utvid `useRealtimeData` med `hyre?` felt og conditional fetch
3. Legg til `"hyre"` case i switch
4. Vis: antall tilgjengelige biler
5. Loading skeleton

**Filer:**
- Ny: `app/api/hyre/route.ts`
- Endre: `lib/hooks/useRealtimeData.ts`
- Endre: `components/variants/story/StoryPOIDialog.tsx`

**Verifisering:** Klikk på Hyre-stasjon i Story → viser tilgjengelige biler.

### Steg 5: Skole/barnehage-variant → TC-05, TC-06

1. Lag `getSchoolMetadata()` type guard i StoryPOIDialog (henter fra `poiMetadata`)
2. Legg til `"school"` case i switch
3. Vis: trinn-info, type (offentlig/privat), + standard editorial innhold under
4. Oppdater `lib/utils/map-icons.ts` med `GraduationCap` import

**Filer:**
- Endre: `components/variants/story/StoryPOIDialog.tsx`
- Endre: `lib/utils/map-icons.ts`

**Verifisering:** Klikk på skole → viser trinn + type + editorial innhold. Uten metadata → viser standard innhold.

### Steg 6: Opprydding og mekaniske sjekker → TC-13

1. Verifiser visuell konsistens på tvers av varianter (screenshot)
2. Slett dead code fra gammel StoryPOIDialog
3. Kjør: `npm run lint && npx tsc --noEmit && npm test && npm run build`

## Test Cases

### Funksjonelle (P1)

```
TC-01 | Functional | P1
Requirement: Standard POI-kort viser rating, editorial hook, local insight, gangtid
Given: POI uten transport-IDer og ikke skole-kategori
When: Bruker klikker på POI-navn i teksten
Then: Modal åpnes med header (ikon, navn, kategori), rating, gangtid, editorialHook, localInsight

TC-02 | Functional | P1
Requirement: Kollektivtransport-kort viser sanntidsavganger
Given: POI med enturStopplaceId
When: Bruker klikker på holdeplassnavn i teksten
Then: Modal åpnes → loading skeleton → avgangstavle med linje, destinasjon, relativ tid

TC-03 | Functional | P1
Requirement: Bysykkel-kort viser tilgjengelighet
Given: POI med bysykkelStationId
When: Bruker klikker på stasjonsnavn i teksten
Then: Modal åpnes → loading skeleton → ledige sykler, ledige låser, åpen/stengt

TC-04 | Functional | P1
Requirement: Hyre-kort viser tilgjengelige biler
Given: POI med hyreStationId
When: Bruker klikker på Hyre-stasjon i teksten
Then: Modal åpnes → loading skeleton → antall tilgjengelige biler

TC-05 | Functional | P1
Requirement: Skole-kort viser trinn og type
Given: POI med kategori "school" og poiMetadata.schoolLevel="1.–7. trinn", poiMetadata.schoolType="public"
When: Bruker klikker på skolenavn i teksten
Then: Modal viser "Barneskole · Offentlig", trinninfo, + editorial innhold

TC-06 | Functional | P2
Requirement: Skole-kort uten metadata faller tilbake til standard
Given: POI med kategori "school" men uten schoolLevel/schoolType i poiMetadata
When: Bruker klikker på skolenavn
Then: Modal viser standard innhold (editorial hook + local insight) uten trinn/type-seksjon
```

### Edge Cases (P1-P2)

```
TC-07 | Edge Case | P1
Requirement: Graceful fallback ved API-feil (Promise.allSettled)
Given: POI med enturStopplaceId, men Entur API returnerer feil
When: Dialog åpnes
Then: Viser standard POI-innhold + "Sanntidsdata utilgjengelig". Andre datakilder påvirkes ikke.

TC-08 | Edge Case | P1
Requirement: Loading state for transport-data
Given: POI med transport-ID
When: Dialog åpnes og data hentes
Then: Skeleton vises i variant-seksjonen, header vises umiddelbart. Ingen layout shift.

TC-09 | Edge Case | P1
Requirement: Dialog lukkes med cleanup (AbortController)
Given: Åpen POI-dialog med in-flight transport fetch
When: Bruker lukker dialog (backdrop / Escape / X)
Then: In-flight API-kall avbrytes via AbortController. Ingen state-oppdatering etter close.

TC-10 | Edge Case | P2
Requirement: POI uten noe innhold
Given: POI uten rating, editorialHook, localInsight, og uten transport-IDer
When: Dialog åpnes
Then: Viser header + gangtid. Ingen tom whitespace.

TC-11 | Edge Case | P2
Requirement: Sanntidsdata oppdateres uten flicker
Given: Transport-dialog er åpen
When: 60s polling-intervall firer
Then: Data oppdateres smooth uten loading-state (bare initial load viser skeleton)

TC-12 | Edge Case | P1
Requirement: Rask POI-bytte (stale data race)
Given: Transport-dialog åpen, data hentes
When: Bruker klikker på annet POI-navn
Then: Forrige request aborted, data resettet til loading, ny dialog med korrekt variant

TC-13 | Edge Case | P3
Requirement: Visuell konsistens på tvers av varianter
Given: Alle 5 varianter
When: Sammenlignet visuelt
Then: Header identisk, innhold følger same typografi/spacing
```

## Dependencies & Risks

| Risk | Sannsynlighet | Konsekvens | Mitigering |
|------|---------------|------------|------------|
| Entur API nede | Lav | Transport-kort viser feilmelding | Promise.allSettled + fallback |
| Hyre Mobility API endrer schema | Lav | Hyre-kort feiler | Typed response interface + error handling |
| Ingen Hyre-stasjoner i demodata | Medium | Kan ikke teste Hyre-kort | Sjekk Brøset-data for hyreStationId |
| Ingen skole-metadata i demodata | Medium | Skole-kort viser standard innhold | Legg til testdata manuelt |
| CSS-animasjonskollisjon | Lav | Dialog-backdrop feil | Sjekk globals.css for dupliserte keyframes |
| useRealtimeData refaktor knekker Explorer | Lav | Explorer transport-data feiler | Test Explorer etter steg 0 |

## References

### Interne
- Brainstorm: `docs/brainstorms/2026-04-08-inline-poi-kortsystem-brainstorm.md`
- Nåværende dialog: `components/variants/story/StoryPOIDialog.tsx`
- Realtime hook: `lib/hooks/useRealtimeData.ts`
- Entur API: `app/api/entur/route.ts`
- Bysykkel API: `app/api/bysykkel/route.ts`
- Hyre import: `scripts/import-hyre-stations.ts`
- POI type: `lib/types.ts:27-97`
- Ikon-map: `lib/utils/map-icons.ts`

### Løsninger fra docs/solutions (institutional learnings)
- CSS-kollisjon: `docs/solutions/ui-bugs/modal-backdrop-half-viewport-css-animation-collision-20260215.md`
- Card composition: `docs/solutions/ui-patterns/report-unified-poi-card-grid-20260303.md`
- On-demand fetch: `docs/solutions/feature-implementations/report-map-popup-card-20260213.md`
- Skeleton loading: `docs/solutions/ux-loading/skeleton-loading-report-map-20260204.md`
- Entur import: `docs/solutions/data-import/import-entur-stops-20260125.md`
- Hyre import: `docs/solutions/data-import/import-hyre-carshare-stations-20260125.md`
