---
title: Travel-time-chip på path-midten (fjern duplisering, unngå POI-overlapp)
type: fix
status: active
date: 2026-04-30
---

# Travel-time-chip på path-midten (fjern duplisering, unngå POI-overlapp)

## Overview

På rapport-board vises gangtid-info to ganger samtidig når en POI er aktiv: én HTML-overlay sentrert horisontalt over kart-viewporten (`BoardTravelChip`), og én SVG-badge rendret inn i 3D-kartet av `RouteLayer3D` ved sluttpunktet av ruten — som dekker selve POI-markøren.

Vi fjerner HTML-overlayen helt, og flytter chip-en (både i 2D og 3D) til midten av selve ruten, slik at den ligger på path-en mellom hjem og POI. Det gir én tydelig tids-indikator som forteller "her er ruten, dette er hvor langt det er", uten å skjule verken POI-markøren eller midten av kartet.

## Problem Frame

To redundante tids-elementer skaper visuell støy. Dagens situasjon:

| Element | Posisjon | Modus | Problem |
|---|---|---|---|
| `BoardTravelChip` (HTML) | `left: 50%, bottom: calc(50dvh + 16px)` | 2D + 3D | Sentrert midt i viewporten, dekker kart-innhold; rendres uavhengig av kart-modus |
| `RouteLayer3D` SVG-badge | Ved siste path-koordinat (= POI-koordinat) | Kun 3D | Dekker selve POI-markøren brukeren nettopp klikket — POI'en "forsvinner" visuelt |

Når brukeren klikker en POI på 3D-kartet, ser de begge samtidig (skjermbilde fra brukeren bekrefter dette). HTML-overlayen sier `🕐 13 min` mens 3D-badgen sier `🚶 13 min` — samme info, to steder, ingen ekstra verdi.

**Forretnings-konsekvens:** Path-en og tids-info er en del av rapport-fortellingen ("hvor langt er det fra hjem til viktige steder"). Når tids-elementet dekker POI-markøren, eller flyter løst midt på kartet, mister vi den geografiske forankringen som gjør board-formatet meningsfylt.

## Requirements Trace

- R1. Brukeren skal se gangtid fra hjem til aktiv POI på path-en — én gang, ikke to.
- R2. Tids-chipet skal ikke dekke POI-markøren brukeren klikket på.
- R3. Tids-chipet skal ikke dekke hjem-markøren (kan ligge nær start, men ikke på).
- R4. Atferden skal være konsistent mellom 2D Mapbox og 3D Google Tiles.
- R5. Chip-utseendet skal beholde dagens visuelle design (pill med ikon + minutt-tall) — bare plasseringen endres.

## Scope Boundaries

- Vi endrer **ikke** path-tegningen eller path-fargen (`BoardPathLayer` / `RouteLayer3D` polyline-styling er uendret).
- Vi endrer **ikke** path-fetch-logikk eller `useRouteData`-kontrakten.
- Vi legger **ikke** til navigasjonshjelp (segment-by-segment direksjoner, gatenavn, manøver-pil) — kun en statisk midtpunkt-chip.
- Vi løfter **ikke** `useRouteData` til delt context, selv om både 2D-chip og 3D-badge bruker den (beholder dagens dual-fetch — er allerede dokumentert som akseptabelt for prototype-stadium i `BoardTravelChip.tsx:14-17`).

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/board/BoardTravelChip.tsx` — HTML-overlayen som skal slettes. ~40 linjer, kun ett kallested (mountes i `BoardMap.tsx:280`).
- `components/map/route-layer-3d.tsx` (linje 155-210) — 3D-badge-effect. Bruker `endCoord = routeData.coordinates[routeData.coordinates.length - 1]`. Det er linja som må endres til midpoint.
- `components/map/route-layer-3d.tsx` `buildBadgeSVG()` (linje 44-70) — SVG-badge-byggeren beholdes uendret, kun position-prop til `Marker3DInteractiveElement` endres.
- `components/variants/report/board/BoardMap.tsx` — vil få et nytt 2D path-midpoint marker-element (react-map-gl `Marker` med HTML-content).
- `components/variants/report/board/BoardPathLayer.tsx` — bruker `useRouteData` og rendrer GeoJSON path. Kan ikke selv eie midpoint-marker (Source/Layer-tre er per Mapbox-konvensjon for line-data, ikke for HTML-content). Midpoint-marker bør være sibling-komponent.
- `lib/map/use-route-data.ts` — gir `{ coordinates: {lat, lng}[], travelMinutes: number }`. Coordinates-shape brukes både i 2D (etter reshape til `[lng, lat]`) og 3D direkte.

### Institutional Learnings

- `feedback_disclosure_animations.md` (memory) — relevant for chip-fade-inn ved POI-bytte. Dagens `BoardPathLayer` har allerede line-opacity-fade-mønster (linje 36-43) som chip-en bør matche for ikke å virke abrupt.
- `docs/plans/2026-04-29-001-feat-board-ux-rapport-variant-plan.md` — opprinnelig plan som introduserte både `BoardTravelChip` og `RouteLayer3D`. Dokumenterer at "RouteLayer rendrer egen travel-marker når `travelTime` passes — dobbel chip hvis BoardTravelChip også mountes" (feasibility-funn). Gjenværende symptom — vi fikser det nå.

### External References

Ingen eksterne kilder. Mønsteret er codebase-internt og rent geometrisk.

## Key Technical Decisions

- **Midpoint = midt-index av `coordinates`-arrayen.** For walking-routes (typisk 50-300 koordinater over 200-1500m) er middelelementet visuelt godt nok. Cumulative-distance-midpoint (halvveis langs faktisk avstand) er mer presist men mer kode — vurderes hvis middel-index ser malplassert ut i praksis.
- **Felles helper `pathMidpoint(coordinates)`** brukes både i 2D-marker og 3D-badge. Sentral logikk = ett sannhetspunkt for hva "midt" betyr.
- **2D-chip rendres som `<Marker>` (react-map-gl/mapbox)** med HTML-content. Mapbox `Marker` projiserer lat/lng → screen automatisk og oppdateres ved pan/zoom. Bedre enn `<Layer>` med `symbol`-type fordi vi vil ha pill-utseendet (rund border, skygge, gangmann-ikon) som er enklere i HTML enn som Mapbox-style.
- **3D-chip bruker fortsatt `Marker3DInteractiveElement` med SVG-template** — bare position-prop endres fra endCoord til midpoint. Resten av byggeren er uendret.
- **Chip skjules når path-en er for kort til å være meningsfull.** Hvis `coordinates.length < 3`, hoppes chip-rendering over (en path med to punkter har ikke en synlig "midt" — det er bare en linje fra start til slutt). Verifisert som edge case i tests.
- **Beholde visuell stil:** Pill-form med klokkeikon + `X min`-tekst (samme som dagens BoardTravelChip + RouteLayer3D-badge). Ingen design-iterasjon her — kun plasserings-fix.

## Open Questions

### Resolved During Planning

- Skal 2D også få chip på path-midten, eller bare 3D? **Ja — feature-paritet, begge moduser viser tid på samme sted.** (Bekreftet av bruker.)
- Beholde dagens dual-fetch fra `useRouteData` (BoardPathLayer + chip-komponenten kaller hver sin)? **Ja, dagens er akseptabel for prototype.** Hvis duplikat-fetcher senere blir et problem, løft til shared context som dokumentert i `BoardTravelChip.tsx:14-17`.
- Midt-index vs. cumulative-distance-midpoint? **Midt-index** for nå (enklere, godt nok visuelt). Sjekk i implementasjon.

### Deferred to Implementation

- Eksakt z-index-/altitude-justering for 3D-chip-en på midpoint (nåværende `altitude: 12` for endCoord — kan trenge justering for ikke å overlappe path-linjen visuelt på 3D-skrå).
- Skal 2D-chipet ha pointer-events disabled (samme som dagens HTML-overlay) eller være klikkbart? Nåværende plan: pointer-events disabled — det er en ren info-display, og vi vil ikke kapre marker-klikk.
- Hvis path-midpoint havner under et bygg eller annen okkluderende geometri på 3D-kartet, kan SVG-badge bli vanskelig å se. Verifiseres i prod-testing — fix er å heve altitude.

## High-Level Technical Design

> *Dette illustrerer den intenderte tilnærmingen og er retningsgivende for review, ikke implementasjonsspesifikasjon. Implementerende agent behandler det som kontekst, ikke kode-å-reprodusere.*

```
useRouteData(activePOI, home)
   │ returns { coordinates: {lat,lng}[], travelMinutes }
   │
   ├── BoardPathLayer (2D)        ← uendret, tegner GeoJSON line
   │
   ├── BoardPathMidpointMarker (2D, NY)
   │   └── react-map-gl Marker @ pathMidpoint(coordinates)
   │       └── HTML pill: 🕐 X min
   │
   └── RouteLayer3D (ENDRET)
       ├── Polyline3D                ← uendret
       └── Marker3DInteractive @ pathMidpoint(coordinates)  ← NY posisjon
           └── SVG template: 🚶 X min
```

Sletting: `BoardTravelChip.tsx` (40 linjer) og dens import/usage i `BoardMap.tsx:280`.

## Implementation Units

- [ ] **Unit 1: Path-midpoint helper**

**Goal:** Felles utility som beregner midpoint-koordinaten fra en path. Brukes i både 2D- og 3D-rendering.

**Requirements:** R1, R4

**Dependencies:** Ingen.

**Files:**
- Create: `components/variants/report/board/path-midpoint.ts`
- Create: `components/variants/report/board/path-midpoint.test.ts`

**Approach:**
- `pathMidpoint(coordinates: { lat: number; lng: number }[]): { lat: number; lng: number } | null` returnerer midt-elementet i arrayen.
- Returnerer `null` hvis `coordinates.length < 3` (ikke nok punkter til at "midt" er meningsfullt).
- For odde lengde: `coordinates[Math.floor(length / 2)]` — det reelle midt-elementet.
- For parlik lengde: samme — vi tar `Math.floor`-elementet (litt mot starten). Akseptabelt med tanke på presisjon.
- Pure funksjon, ingen side effects.

**Test scenarios:**
- Happy path: 5 koordinater → returnerer index 2 (midt-elementet).
- Happy path: 100 koordinater → returnerer index 50.
- Edge case: tom array → returnerer null.
- Edge case: 1 koordinat → returnerer null (ikke meningsfull "midt").
- Edge case: 2 koordinater → returnerer null (kun start og slutt).
- Edge case: 3 koordinater → returnerer index 1 (midt-elementet).
- Happy path: parlik lengde 4 → returnerer index 2 (`Math.floor(4/2)`).

**Verification:**
- Tester passerer.
- Helper kan importeres og brukes fra både 2D- og 3D-konsumenter.

---

- [ ] **Unit 2: Flytt 3D-badge til path-midpoint**

**Goal:** 3D-badgen (`Marker3DInteractiveElement` i `RouteLayer3D`) plasseres på path-midten i stedet for sluttpunktet, slik at den ikke dekker POI-markøren.

**Requirements:** R2, R4

**Dependencies:** Unit 1.

**Files:**
- Modify: `components/map/route-layer-3d.tsx`

**Approach:**
- I effect på linje 157-210 (badge-effect): erstatt `endCoord = routeData.coordinates[length-1]` med `midpoint = pathMidpoint(routeData.coordinates)`.
- Hvis `midpoint === null`, hopp over badge-rendering (early return — samme pattern som når `routeData` mangler).
- `position`-feltet i `new lib.Marker3DInteractiveElement({ position: ... })` bruker midpoint i stedet for endCoord.
- Behold `altitude: 12` foreløpig — juster i implementasjon hvis det havner under path-linjen visuelt.
- `buildBadgeSVG(minutes)` er uendret — bare posisjonen endres.

**Patterns to follow:**
- Eksisterende effect-struktur i `route-layer-3d.tsx:157-210` (lazy library load, cancelled-flag, ref-baserte cleanup).
- Early-return-pattern når data ikke er klar (linje 162-166).

**Test scenarios:**
- Test expectation: none — endring er ren posisjons-data, ingen ny logikk å teste enhetlig. Verifiseres manuelt ved 3D-modus med aktiv POI: badge står på midten av blå path-linje, ikke på POI-markøren.

**Verification:**
- Manuell test: åpne `/eiendom/obos/nostebukten-brygge/rapport-board`, toggle 3D-modus, klikk en POI med synlig walking-path. Badge sitter på midten av path-en, POI-markøren er ren.
- Hvis path er kort (<3 koordinater): badge vises ikke (skjult per midpoint-helper).

---

- [ ] **Unit 3: 2D path-midpoint marker**

**Goal:** Ny komponent som rendrer tids-chip på path-midten i 2D Mapbox-modus, parallelt med 3D-badgen.

**Requirements:** R1, R2, R4, R5

**Dependencies:** Unit 1.

**Files:**
- Create: `components/variants/report/board/BoardPathMidpointMarker.tsx`
- Modify: `components/variants/report/board/BoardMap.tsx` (mount nytt component, fjern BoardTravelChip)

**Approach:**
- Komponenten gjenbruker `useRouteData(activePOI, home)`-hook (samme som BoardPathLayer).
- Renderes kun når `state.phase === "poi"` og `routeData` er truthy og `pathMidpoint(coordinates)` returnerer ikke-null.
- Bruker `<Marker>` fra `react-map-gl/mapbox` med `longitude`/`latitude` fra midpoint.
- Inneholder en HTML-pill: rounded-full, hvit bg/95, border, klokkeikon (Lucide `Clock` — samme som dagens BoardTravelChip), `{minutes} min`-tekst.
- `pointer-events: none` så marker-klikk på POI-er nær path-en ikke blokkeres.
- Mountes i `BoardMap.tsx` som sibling til `<BoardPathLayer />`, kun i Mapbox 2D-modus (`showMapbox`-block).

**Patterns to follow:**
- `BoardTravelChip.tsx` for visuelt design (klokke + min-tekst, hvit pill, border).
- `HomeMarker.tsx` (samme mappe) for `<Marker>`-bruk fra react-map-gl/mapbox.
- `BoardPathLayer.tsx` for `useRouteData`-bruk og phase-gate.

**Test scenarios:**
- Test expectation: none for ren visuell rendering — verifiseres manuelt. 
- Hvis vi velger å skrive enkelt enhetstest: render-test med mock `useRouteData` som returnerer 5 koordinater og 13 min → komponenten matcher snapshot med `13 min`-tekst og marker rendret på midt-koordinat.

**Verification:**
- Manuell test: 2D-modus, klikk POI → tids-chip vises på midten av blå path-linje, ikke i sentrum av viewporten.
- Pan/zoom: chip følger med kartet (Mapbox `<Marker>` projiserer automatisk).
- POI-bytte: chip oppdateres til ny midpoint og minutter, ingen flicker.

---

- [ ] **Unit 4: Slett BoardTravelChip**

**Goal:** Fjerne den gamle HTML-overlayen helt — én chip per modus, ikke to.

**Requirements:** R1, R2, R3

**Dependencies:** Unit 3 (2D må ha erstatning på plass før vi sletter den eksisterende).

**Files:**
- Delete: `components/variants/report/board/BoardTravelChip.tsx`
- Modify: `components/variants/report/board/BoardMap.tsx` (fjern import og `<BoardTravelChip />`-mount)

**Approach:**
- Slett `BoardTravelChip.tsx`-filen.
- Fjern `import { BoardTravelChip } from "./BoardTravelChip";` fra `BoardMap.tsx`.
- Fjern `<BoardTravelChip />`-mount fra `BoardMap.tsx:280`.
- Per CLAUDE.md hygiene-regel: ikke kommenter ut, slett.

**Test scenarios:**
- Test expectation: none — ren sletting. Verifisering er at appen fortsatt bygger og at 2D-modus viser ny midpoint-chip i stedet.

**Verification:**
- `npx tsc --noEmit` — ingen type-feil.
- `npm run lint` — ingen unused-import-warnings.
- Manuell test: 2D-modus med aktiv POI viser kun én tids-chip (på path-midten, ikke i viewport-sentrum).

## System-Wide Impact

- **Interaction graph:** `useRouteData` kalles nå fra to steder i 2D (`BoardPathLayer` + `BoardPathMidpointMarker`) — samme som før (`BoardPathLayer` + `BoardTravelChip`). Ingen netto endring i fetch-tall.
- **Error propagation:** Hvis `useRouteData` feiler, viser hverken path eller midpoint-chip noe — samme behavior som før.
- **State lifecycle risks:** Ingen nye. Filtre, phase-bytte, POI-bytte håndteres av eksisterende reducer-pattern.
- **API surface parity:** `RouteLayer3D` og `BoardPathLayer` sin offentlige props-overflate er uendret.
- **Unchanged invariants:** Path-tegningen, path-fade-mønsteret, hjem-markøren, POI-markørene — alle uendret.

## Risks & Dependencies

| Risiko | Mitigering |
|---|---|
| Midpoint havner under bygg/terreng på 3D-kart, gjør badge usynlig | Behold `altitude: 12`, juster oppover (16-20) i impl hvis nødvendig. |
| Midt-index gir ujevn placering for ruter med mange koordinater i én del | Aksepter for nå; vurder cumulative-distance hvis det ser merkbart skjevt ut. |
| 2D-chip kan overlappe path-stroke på smal vei-rendering | Pillen har shadow + border som gir kontrast. Hvis problem: legg til `translate(-50%, -120%)` så pillen står over path-linjen i stedet for på. |
| Kort path (start ≈ slutt) | `pathMidpoint` returnerer null for <3 koordinater → ingen chip vises. Akseptabelt edge case. |

## Documentation / Operational Notes

- Ingen migrasjon, ingen rollback-bekymring (frontend-only, prototype-stadium tolererer kort downtime per memory `project_stage_prototype.md`).
- Ingen settings-endring eller hooks-justering.

## Sources & References

- Tidligere plan (kontekst): `docs/plans/2026-04-29-001-feat-board-ux-rapport-variant-plan.md`
- Affected files:
  - `components/variants/report/board/BoardTravelChip.tsx` (sletter)
  - `components/variants/report/board/BoardMap.tsx`
  - `components/map/route-layer-3d.tsx`
- Test-URL: `/eiendom/obos/nostebukten-brygge/rapport-board`
- Trello board: Utvikling (`onb3nsLD`)
