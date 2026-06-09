---
title: "feat: Kulturnatt event-board — felles fundament"
type: feat
status: active
date: 2026-06-09
deepened: 2026-06-09
origin: docs/brainstorms/2026-06-09-kulturnatt-port-requirements.md
related_plans:
  - docs/plans/2026-06-09-002-feat-kulturnatt-event-board-variants-plan.md
---

# feat: Kulturnatt event-board — felles fundament

## Overview

Port festival/event-opplevelsen (Kulturnatt 2025) inn i den nye rapport-board-arkitekturen: venstre sidebar + persistent 3D/2D-kart + live transport. Denne planen leverer det **felles fundamentet** som begge sammenligningsvarianter (A og B, se [varianter-planen](2026-06-09-002-feat-kulturnatt-event-board-variants-plan.md)) bygger på — bygges på en **base-branch** før worktrees brancher ut.

Kjernebeslutningen: en **event-native dataadapter** (`eventToBoardData`) mater de eksisterende board-skall-komponentene direkte, i stedet for report-kuraterings-pipelinen (`transformToReportData`/`getReportThemes`).

> **Viktig revisjon etter plan-review (2026-06-09):** Flere steder der den første planen sa "gjenbruk", er det faktisk *ny* plumbing — markør-filtrering, collection i board-verdenen, og per-event drill-in finnes ikke i board-skallet i dag. Uten audio faller board-skallet dessuten til boligrapportens tomtilstand (megler-chrome). Disse er nå eksplisitte units/beslutninger.

## Problem Frame

Den gamle Kulturnatt-prototypen er en Explorer (Kompass-onboarding + `?c=`-delbar "Min samling"), servert som productType `explorer` på `/eiendom/...` og `/event/...`. Den nye board-arkitekturen er bygget for productType `report` (bolig/næring), er **ikke event-bevisst**, og `app/event/[customer]/[project]/page.tsx` rendrer i dag bare `ExplorerPage`. Ingen event-prosjekt har board-opplevelse. (se origin: `docs/brainstorms/2026-06-09-kulturnatt-port-requirements.md`)

**Verifisert mot prod-DB (2026-06-09):** `kulturnatt-trondheim_kulturnatt-2025` finnes, tags `["Event"]`, 132 `kn-*`-POIer (alle `event_dates: ["2025-09-12"]`, én kveld). 8 Event-prosjekter totalt — flere fler-dags (Festspillene i Bergen 2026, Olavsfest 2025, Arendalsuka 2026).

## Requirements Trace

- R1. Kulturnatt-opplevelsen kjører på board-arkitekturen med nytt sidebar-skall + 3D/2D-kart (event-native rute, se Key Decisions D1).
- R2. Board-modellen gjøres event-bevisst (dato + start/slutt-tid), additivt så boligrapporter ikke brytes.
- R3. Tema/dag/tid-filtrering via gjenbruk av `lib/hooks/useKompassFilter.ts` (drevet på `raw`-POIen, se D5).
- R4. Kartet viser events som markører og reagerer på aktivt filter/valgt dag (ny filter-søm, Unit 4).
- R5. Live transport (Entur/bysykkel) i highlight-rader (se D7 — arvet integrasjon, verifiseres).
- R6. "Min samling": lagre events → `?c=`-delbar URL, med rehydrering i ny rute (Unit 5).
- R7. Mobile-first (bottom-sheet på mobil, sidebar på desktop) (Unit 7).
- R12–R17. Delte interaksjonsregler (tomtilstand, tid-bøtter, single-night dag-regel, timeless-bøtte, per-event drill-in, sortering) — defineres her så A/B blir rettferdig (Unit 4 + Unit 6).

## Scope Boundaries
- Sidebarens variant-spesifikke innhold (filter-liste vs. toggle) er **ikke** her — leveres som swappable seam (Unit 3/varianter-planen).
- Ingen audio-tur / 3D-kamera-narrativ for events.
- Foundationen bygges **event-agnostisk** (alle Event-taggede prosjekter), demoes mot Kulturnatt.

### Deferred to Separate Tasks
- Live TRD Events-feed (alltid-på): egen arkitektur-beslutning (strategi P1) — bruker 2025-snapshot.
- Innsiktslag (analytics): egen oppgave.
- Visit Trondheim-sporet: eget senere løp.
- Bevaring av gammel prototype-URL (`/eiendom/kulturnatt-trondheim/kulturnatt-2025`) via redirect til ny board-rute, hvis Midtbyen trenger det: avgjøres når demo deles.

## Context & Research

### Relevant Code and Patterns
- **Event Explorer-rute (datalast-mønster):** `app/event/[customer]/[project]/page.tsx` — `getProductAsync(..., "explorer")` + `getBransjeprofil(tags)`. NB: dens `?c=`-gren er bare en boolsk caps-skip; **rehydreringen (`getCollectionBySlug`) finnes kun i `app/eiendom/[customer]/[project]/page.tsx` (~linje 172)** — det er presedensen for Unit 5.
- **Board-skall:** `components/variants/report/reels/ReportReelsPage.tsx` — `boardData = adaptBoardData(reportData)` (linje 107), så `buildReelsCards` + `ReelsProvider`/`BoardProvider`/`BoardReelsSync`/`ReelsAudioShell` + `ResponsiveLayout`. **Uten audio: `buildReelsCards` gir 0 audio-kort → `hasPlayableContent=false` (DesktopStorySidebar:606) → `SidebarContentPreview`-grenen (med hardkodet "Ansvarlig megler"-placeholder-footer) + basic-splash.**
- **Board-datamodell:** `components/variants/report/board/board-data.ts` — `BoardData`/`BoardCategory`/`BoardPOI` (branded IDs; `categoryId`, original POI under `raw`). `adaptBoardData` tar `ReportData` (linje 11).
- **`BoardMap`:** `components/variants/report/board/BoardMap.tsx` — `markerStates` (linje ~188) utleder synlighet KUN fra `state.phase`/`activeCategory`/`subFilter.hiddenIds`. `board-state.tsx` reducer har INGEN filter-action (kun SELECT_CATEGORY/OPEN_POI/BACK/RESET/INTRO). Markør-filtrering = ny søm.
- **Filter-stack:** `lib/hooks/useKompassFilter.ts` — signatur `(pois: POI[], ...)`, leser `poi.category.id`/`poi.eventDates`/`poi.eventTimeStart`, **sorterer på `eventTimeStart` (HH:MM, dato-blind)**. `lib/kompass-store.ts` (valg-state), `lib/hooks/useEventDayFilter.ts`.
- **Drill-in i dag:** `CategoryDetailView` i `DesktopStorySidebar.tsx` er gated på `activeCat.editorial` og viser *kategori*-kuratering — ikke per-event. Adapteren utelater `editorial` → per-event drill-in (R15) er net-new (Unit 6).
- **Min samling:** `lib/collection-store.ts` (`useCollection`/`addToCollection`, client `persist`), `getCollectionBySlug` (`lib/supabase/queries.ts:681`). All collection-UI lever i dag i `ExplorerPage` — ikke i board-skallet.

### Institutional Learnings
- `trip-adapter-supabase-to-legacy-project-20260209.md` — presedens for `eventToBoardData` (render-klar shape, override-kjede, ingen konsument-rewrite).
- `event-dates-dayfilter-oho-20260310.md` — dag-filter gates på Event-bransjeprofil (`tags ⊇ "Event"`). Kulturnatt har `["Event"]`.
- `kompass-event-recommendation-prototype-20260311.md` — filter-stacken er event-native; fail-open tid-filter.
- `unified-map-modal-2d-3d-toggle-20260415.md` + `webgl-context-leak-per-render-probe-20260603.md` — aldri to kart-engines samtidig; ingen per-render WebGL-probe (Variant B's live tidslinje).
- `mapbox-markers-invisible-missing-css-EventRoute-20260413.md` — **løst:** `ReportReelsPage.tsx:3` importerer `mapbox-gl/dist/mapbox-gl.css`, så CSS er garantert uansett layout (vurder å fjerne remote `<link>` i `app/event/layout.tsx` for å unngå versjons-skew).
- `parallel-sessions-require-worktrees-20260208.md`, `trust-filter-missing-report-data-layer-20260208.md` — felles filtrering i fundament, ikke per variant (ellers lekker).

## Key Technical Decisions

- **D1 — Event-native rute i `/event/`-namespacet:** ny subrute `app/event/[customer]/[project]/board/`. Events har eget rute-tre (i dag kun Explorer); board legges her, unngår report-productType-gating under `/eiendom/`. Begge varianter bruker samme rute-sti; skilles av branch + port (3001/3002). *Avviker bevisst fra origin R1s "samme URL"* — gammel prototype-URL er Explorer; board får ny home. Redirect er en senere demo-beslutning (Deferred).
- **D2 — Løft `boardData` ut som input:** `ReportReelsPage` får valgfri prop `boardData?: BoardData`. Hvis satt (event-rute) → brukes direkte; hvis utelatt (report-rute) → bygges via `adaptBoardData(reportData)` som før. Bakoverkompatibelt; report-tester urørt.
- **D3 — Event er en egen "ingen-audio"-modus, ikke boligrapportens tomtilstand:** seam-en (Unit 3 + varianter-planen) erstatter `SidebarContentPreview`-grenen *og* undertrykker megler-placeholder-footer + "Utforsk nærområdet"-splash for events. Akseptansekrav: **null megler/eiendoms-strenger på event-board**.
- **D4 — Event-felter additivt (optional) på `BoardPOI`/`BoardCategory`:** boligrapporter urørt (uendret invariant). De nye feltene er *display-only*.
- **D5 — Filteret kjører på `raw`-POIen:** `useKompassFilter` forblir `POI[]`-basert; vi mater `boardData.categories.flatMap(c => c.pois.map(p => p.raw))`. Adapteren **må bevare `eventDates`/`eventTimeStart`/`eventTimeEnd` på `raw`** (de er der allerede fra DB). Ingen hook-refaktor.
- **D6 — Dato-bevisst sortering + dag-seksjoner i fundamentet:** sorter på `eventDates[0] + eventTimeStart` (ikke tid alene); bygg dag-seksjons-laget i fundamentet (ikke i Variant B). Valider mot et fler-dags-prosjekt **før** base-branchen tagges/fryses.
- **D7 — Live transport arvet, ikke net-new:** highlight-rad-transport bruker samme Entur/bysykkel-integrasjon som boligrapporter; jobben er kun å sikre at event-highlights eksponerer riktige stopp-IDer. Verifiseres i Unit 6.
- **D8 — Event-agnostisk fundament:** virker for alle Event-taggede prosjekter.

## Open Questions

### Resolved During Planning
- *Finnes 2025-dataen?* → Ja (132 `kn-*`-POIer, tags `["Event"]`), verifisert mot prod-DB.
- *Hvilken rute?* → Ny `/event/.../board`-subrute (D1).
- *Single-night degenererer sammenligningen?* → Tidslinje testes på Kulturnatt (10t kveld) + fler-dags-prosjekt; dato-bevisst sortering (D6) sikrer fler-dags-korrekthet.
- *Backward-compat for `ReportReelsPage`?* → Valgfri `boardData`-prop (D2).

### Deferred to Implementation
- Eksakt event→`BoardCategory`-mapping (label/ikon/farge per `kn-*`/`fib-*`) + asset-fallback når kategori-illustrasjon mangler (event-kategorier matcher ikke bolig-asset-IDer → tomme thumbnails ellers).
- Om `has3dAddon` settes for events (3D base-engine) eller om events starter i ren 2D — påvirker WebGL/marker-re-render-stien.
- Om event-board gjenbruker rapport-board sin `themeStyle`-CSS-var-wrapper eller rendrer med default Tailwind-tokens (sende `enTranslations={}`).

## High-Level Technical Design

> *Directional guidance for review, ikke implementasjonsspesifikasjon.*

```
EVENT-RUTE (ny)                              REPORT-RUTE (uendret)
app/event/[c]/[p]/board/page.tsx             app/eiendom/[c]/[p]/rapport-board/page.tsx
  getProductAsync(..., "explorer")             getProductAsync(..., "report")
  + getBransjeprofil(tags ⊇ "Event")                    │
  + ?c= → getCollectionBySlug (eiendom-presedens)        │
        │                                                │
  eventToBoardData(project, features)  ◄─NY        adaptBoardData(reportData)
  (raw POI beholder event-felter; audioTourEnabled:false)│
        └──────────────► BoardData ◄──────────────────────┘
                            │
        <ReportReelsPage boardData={...} />   ◄── D2: boardData som valgfri input
                            │  (ingen audio → D3 event-modus, ikke megler-tomtilstand)
        ┌───────────────────┴───────────────────┐
   sidebar-innhold (swappable seam)          BoardMap
   - default: SidebarContentPreview          - NY: visiblePoiIds-prop ∩ markerStates
   - Variant A/B fylles i varianter-planen   - filter-drevet (Unit 4)
   filter: useKompassFilter(raw POIs)        - dato-bevisst sort (D6)
```

## Implementation Units

- [ ] **Unit 1: Event-bevisste board-typer (additivt)**

**Goal:** Utvid `BoardPOI`/`BoardCategory` med valgfrie display-felter for dato/tid.

**Requirements:** R2

**Dependencies:** Ingen

**Files:** Modify `components/variants/report/board/board-data.ts`; Test `components/variants/report/board/board-data.test.ts`

**Approach:** Optional `eventDates?: string[]`, `eventTimeStart?: string`, `eventTimeEnd?: string` på `BoardPOI` (display-only; filteret leser `raw` per D5). Behold branded-ID-kontrakten. `adaptBoardData` (report) lar dem være `undefined`.

**Patterns to follow:** Eksisterende optional-felt (`address?`, `body?`) på `BoardPOI`.

**Test scenarios:**
- Happy path: `BoardPOI` med event-felter leses korrekt.
- Edge case: `BoardPOI` uten event-felter (boligrapport) uendret — eksisterende asserts grønne.

**Verification:** `npx tsc --noEmit` rent; board-data-tester grønne.

---

- [ ] **Unit 2: Event-native adapter (`eventToBoardData`)**

**Goal:** Produser `BoardData` direkte fra event-POIer + kategorier, uten report-pipelinen.

**Requirements:** R1, R2, R4

**Dependencies:** Unit 1

**Files:** Create `lib/event-board/event-board-data.ts`; Test `lib/event-board/event-board-data.test.ts`

**Approach:**
- Map event-kategorier → `BoardCategory` (id/label/icon/color fra `project.categories`), `pois` med display-felter (Unit 1).
- **Bevar `eventDates`/`eventTimeStart`/`eventTimeEnd` på `BoardPOI.raw`** (D5) så `useKompassFilter` virker uendret.
- `audioTourEnabled: false`, ingen `editorial`/`welcome`/`outro`/`summary` (D3 håndterer ingen-audio-modus). `poisById`-Map for grounding.
- Speil `lib/trip-adapter.ts`.

**Patterns to follow:** `lib/trip-adapter.ts` (`tripToProject`), output-kontrakt i `board-data.ts`.

**Test scenarios:**
- Happy path: 132 Kulturnatt-POIer → `BoardData` med korrekt kategori-antall; `raw` bærer event-feltene.
- Edge case: `event_dates: []` vs `undefined` → begge ikke-dagfiltrerbare (konsistent med `useKompassFilter`-semantikk `eventDates && length>0`).
- Edge case: POI med kategori-id som ikke finnes i `project.categories` → fallback eller drop (definer).
- Edge case: kategori uten POIer droppes; alle-kategorier-tomme → board rendrer tomtilstand uten krasj.
- Integration: output gjennom `buildReelsCards`/`ReelsProvider`/`BoardProvider` uten å kaste når intro/home/welcome/outro/summary/audio alle mangler.

**Verification:** Adapter-output rendres av skallet (Unit 3) uten runtime-feil; felt-mapping-tester grønne.

---

- [ ] **Unit 3: Event-board-rute + skall-refaktor + ingen-audio-modus**

**Goal:** Ny rute som rendrer board-skallet fra event-data; `boardData` som input; event-modus uten megler/splash-chrome.

**Requirements:** R1, R7

**Dependencies:** Unit 2

**Files:**
- Create `app/event/[customer]/[project]/board/page.tsx` (server; datalast som event-Explorer-ruten, kaller `eventToBoardData`; `?c=`-håndtering forberedt for Unit 5; `enTranslations={}`/themeStyle-beslutning per deferred Q)
- Modify `components/variants/report/reels/ReportReelsPage.tsx` (valgfri `boardData?: BoardData`-prop, D2; ingen-audio-event-modus, D3)
- Modify `components/variants/report/reels/DesktopStorySidebar.tsx` (undertrykk megler-placeholder-footer + basic-splash når event-modus / `brokers` tom)
- Test `app/event/[customer]/[project]/board/page.test.tsx` + en boligrapport-regresjonstest

**Approach:** `force-dynamic`. Last `getProductAsync(..., "explorer")` + `getBransjeprofil(tags)`. Bygg `boardData` via `eventToBoardData`. `mapbox-gl.css` er garantert via `ReportReelsPage.tsx:3` (ingen ny layout nødvendig). Events starter i 2D med mindre `has3dAddon` (deferred Q).

**Patterns to follow:** `app/event/[customer]/[project]/page.tsx` (datalast/`notFound`), `app/eiendom/.../rapport-board/page.tsx` (board-entry + themeStyle).

**Test scenarios:**
- Happy path: `/event/kulturnatt-trondheim/kulturnatt-2025/board` rendrer sidebar + kart med events (nettleser-sjekk).
- Happy path (D3): **ingen "Ansvarlig megler"/eiendoms-strenger** synlige på event-board.
- Error path: ukjent prosjekt → `notFound()`.
- Edge case (regresjon): en boligrapport (`/eiendom/.../rapport-board`) rendrer uendret — report-tester grønne.
- Integration: markører synlige (mapbox-css ok); ingen WebGL-context-feil i konsoll.

**Verification:** Event-board + boligrapport rendrer korrekt; ingen megler-chrome på events; ingen WebGL-feil.

---

- [ ] **Unit 4: Filter + markør-søm + dato-bevisst sortering + delte interaksjonsregler**

**Goal:** Koble filtrering til board, etabler ny markør-filter-søm i `BoardMap`, dato-bevisst sortering, og de delte interaksjonsreglene (R12–R16) begge varianter arver.

**Requirements:** R3, R4, R12, R13, R14, R16

**Dependencies:** Unit 3

**Files:**
- Create `lib/event-board/event-filter-constants.ts` (tid-bøtte-grenser, delt)
- Modify board-sidebar-container (kobler `useKompassFilter(raw POIs)`/`kompass-store`/`useEventDayFilter`)
- Modify `components/variants/report/board/BoardMap.tsx` (**ny `visiblePoiIds?: Set<string>`-prop, intersekt inn i `markerStates.visibleIds`**) + `components/variants/report/board/board-state.tsx` (vurder ny filter-action eller container-nivå state)
- Test `lib/event-board/event-filter-constants.test.ts` + filter/markør-integrasjonstest

**Approach:**
- D5: filter på `raw`-POIer; `recommendedIds` driver `visiblePoiIds` til `BoardMap`. `subFilter` + dag/tid-filter må komponere.
- D6: sorter på `eventDates[0] + eventTimeStart` (dato-bevisst); bygg dag-seksjons-aggregat brukt av både filter og fremtidig Program-view.
- R13: `useEventDays(pois).length === 1` (Kulturnatt) → dag-kontroll vises **read-only dato-label** (valgt fast regel, ikke skjult — beholder kontekst).
- R12: tomtilstand-tekst + "nullstill filter"-CTA når filtrert antall = 0 (og minst ett aktivt filter); delt skeleton.
- R14: events uten `eventTimeStart` → "Tidspunkt ikke oppgitt"-gruppe (fail-open).
- R16: standard-sortering dato+tid stigende, timeless sist.

**Patterns to follow:** `useKompassFilter`, `markerStates`-memo i `BoardMap`, `use-board-zoom-tier`.

**Test scenarios:**
- Happy path: velg tema → kun matchende events i liste + markører på kart (`visiblePoiIds`).
- Happy path (fler-dags): events sortert dato-så-tid; dag1-15:00 og dag3-15:00 er adskilt (ikke kollapset).
- Edge case: single-day → dag-kontroll read-only label (R13).
- Edge case: tid-filter + event uten tid → vises (fail-open).
- Edge case: 0 treff → tomtilstand + CTA.
- Integration: filterendring → `BoardMap`-markører oppdateres uten remount (ingen WebGL-lekk); kamera-fit bruker filtrert sett.

**Verification:** Filter oppdaterer liste + kart synkront; dato-bevisst rekkefølge korrekt på fler-dags-prosjekt; single-day-regel aktiv på Kulturnatt.

---

- [ ] **Unit 5: "Min samling" — lagre + `?c=`-rehydrering i board-ruten**

**Goal:** Lagre-til-samling og delbar URL i event-board, inkl. rehydrering av delt lenke. Net-new i board-verdenen.

**Requirements:** R6

**Dependencies:** Unit 4 (bruker `visiblePoiIds`-sømmen)

**Files:**
- Modify `app/event/[customer]/[project]/board/page.tsx` (`?c=` → `getCollectionBySlug` → preselekterte POI-IDer)
- Create/Modify board-collection-UI (lagre-knapp, samling-visning/drawer i board-skallet — port minimalt fra `CollectionDrawer`)
- Test collection-rehydrering-test for board-ruten

**Approach:**
- **Presedens: `app/eiendom/[customer]/[project]/page.tsx:172` (`getCollectionBySlug`)** — IKKE event-Explorer-rutas boolske `c`-sjekk.
- `?c=<slug>` → preselekter/highlight events via `visiblePoiIds`-sømmen (Unit 4) + egen "collection"-markørstil.
- Gjenbruk `useCollection`/`addToCollection` (`lib/collection-store.ts`).

**Patterns to follow:** `?c=`-rehydrering i `app/eiendom/[customer]/[project]/page.tsx`, `CollectionDrawer`.

**Test scenarios:**
- Happy path: legg til 3 events → samling viser 3; del-URL genereres.
- Happy path: åpne `?c=<slug>` → de 3 forhåndsvalgt/highlightet på kart + liste (verifiser at det faktisk rehydrerer, ikke bare parser param).
- Edge case: ugyldig/utløpt slug → tom samling, ingen krasj.

**Verification:** Delt lenke reproduserer lagret samling i board-ruten; 404 unngås.

---

- [ ] **Unit 6: Per-event drill-in detalj (R15) + transport-verifisering**

**Goal:** Net-new per-event detalj-panel (ikke editorial CategoryDetailView), med legg-i-samling-knapp; verifiser arvet live transport.

**Requirements:** R15, R5

**Dependencies:** Unit 4

**Files:**
- Create per-event detalj-komponent (sidebar-panel desktop / utvid bottom-sheet mobil) — tittel, tid, sted, beskrivelse, legg-i-samling
- Modify `DesktopStorySidebar.tsx` / mobil-sheet (rute event-klikk hit, ikke til editorial-gated `CategoryDetailView`)
- Test per-event-drill-in-test

**Approach:**
- Klikk på event (liste/tidslinje/markør) → `OPEN_POI` → per-event-panel. **Ikke** gjenbruk `CategoryDetailView` (editorial-gated, kategori-nivå; adapteren utelater editorial).
- D7: highlight-rad-transport bruker eksisterende Entur/bysykkel-integrasjon — verifiser at event-venues eksponerer stopp-IDer der relevant.

**Patterns to follow:** `BoardPOIMiniPopup` (per-POI), highlight-rad-transport i `DesktopStorySidebar`.

**Test scenarios:**
- Happy path: event-klikk åpner panel med korrekt metadata + fungerende legg-i-samling.
- Happy path: fly-to venue (via `MapAdapter`) i 2D og 3D.
- Edge case: event uten beskrivelse/tid → panel degraderer pent.
- Integration: transport-rad viser live data der venue har stopp-ID.

**Verification:** Per-event-panel virker på desktop + mobil; ingen editorial-avhengighet; transport-rad live der relevant.

---

- [ ] **Unit 7: Mobil bottom-sheet for event-innhold**

**Goal:** Event-board fungerer mobile-first via eksisterende bottom-sheet-faser.

**Requirements:** R7, R17

**Dependencies:** Unit 4, Unit 6

**Files:** Modify mobil-layer-wiring i `ReportReelsPage.tsx` (`MapLayer`/`ResponsiveLayout`); Test mobil-rendering (viewport-emulering)

**Approach:** Gjenbruk faser `reel/map-quarter/map-half/map-full`. R17: definer peek/halv/full kart-synlighet; "Min samling" via persistent affordance (topp-bar-ikon/FAB). Marker-tap → sheet til peek/half med per-event-detalj (Unit 6).

**Patterns to follow:** `MapLayer`-fasehåndtering, `CategoryReel` sheet-høyde.

**Test scenarios:**
- Happy path (390px): peek viser event-liste; dra opp → half/full.
- Edge case: marker-tap åpner detalj i sheet uten å skjule kartet helt.
- Edge case: "Min samling"-affordance synlig/trykkbar i alle faser.

**Verification:** På 390px: faser fungerer, kart aldri helt skjult i peek, samling tilgjengelig.

## Foundation Freeze Gate (før base-branch tagges)

Tagg/frys fundamentet **først** når alt dette holder (ellers driver variantene fra hverandre):
- [ ] Event-board rendrer uten megler/eiendoms-chrome (D3).
- [ ] Filter + markør-søm fungerer; dato-bevisst sortering verifisert på et **fler-dags**-prosjekt (Festspillene/Olavsfest), ikke bare Kulturnatt (D6).
- [ ] Per-event drill-in (Unit 6) virker på desktop + mobil.
- [ ] `?c=`-rehydrering reproduserer samling.
- [ ] Boligrapport-regresjon grønn.

## System-Wide Impact
- **Interaction graph:** Ny `/event/.../board`-rute; endret `ReportReelsPage`-signatur (`boardData`-input); ny `visiblePoiIds`-prop på `BoardMap`; mulig ny board-state-filter-action.
- **Error propagation:** Ukjent prosjekt → `notFound()`; collection-slug-feil → tom samling.
- **State lifecycle risks:** WebGL — ingen dobbel-mount; ingen per-render WebGL-probe i filter/sheet-re-render; mutér ett kart-element.
- **API surface parity:** `ReportReelsPage` + `BoardMap` + `board-state` endres additivt/bakoverkompatibelt; report-rute urørt.
- **Unchanged invariants:** Boligrapporter (`/eiendom/.../rapport-board`) — event-felter optional, `adaptBoardData` urørt, megler-chrome kun undertrykt i event-modus. Regresjonssjekk på minst én navngitt boligrapport (f.eks. Teknostallen).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Ingen-audio-skall viser megler-chrome på events | D3: seam erstatter preview + undertrykker footer/splash; akseptansetest på null megler-strenger |
| `useKompassFilter` shape-mismatch (POI vs BoardPOI) | D5: filtrer på `raw`; adapter bevarer event-felter på `raw` |
| Markør-filtrering antatt "gjenbruk", er net-new | Unit 4: eksplisitt `visiblePoiIds`-søm + board-state |
| Dato-blind sortering → fler-dags kollapser | D6: dato+tid-sortering + dag-seksjoner i fundament; valider fler-dags før freeze |
| `ReportReelsPage`-refaktor brekker boligrapport | D2 bakoverkompatibel; navngitt boligrapport-regresjon |
| WebGL-lekk ved hyppig filter-re-render | Cache probe, mutér ett kart-element (læring) |

## Documentation / Operational Notes
- Etter landing: kandidat for `/ce-compound` — ingen `board-data`/event-adapter-læringsdoc finnes i dag.

## Sources & References
- **Origin:** [docs/brainstorms/2026-06-09-kulturnatt-port-requirements.md](../brainstorms/2026-06-09-kulturnatt-port-requirements.md)
- **Søsterplan:** [docs/plans/2026-06-09-002-feat-kulturnatt-event-board-variants-plan.md](2026-06-09-002-feat-kulturnatt-event-board-variants-plan.md)
- Nøkkelkode: `app/event/[customer]/[project]/page.tsx`, `app/eiendom/[customer]/[project]/page.tsx` (collection), `components/variants/report/reels/ReportReelsPage.tsx`, `components/variants/report/reels/DesktopStorySidebar.tsx`, `components/variants/report/board/BoardMap.tsx`, `components/variants/report/board/board-data.ts`, `components/variants/report/board/board-state.tsx`, `lib/hooks/useKompassFilter.ts`, `lib/trip-adapter.ts`
- Læringer: `trip-adapter-supabase-to-legacy-project-20260209.md`, `event-dates-dayfilter-oho-20260310.md`, `unified-map-modal-2d-3d-toggle-20260415.md`, `webgl-context-leak-per-render-probe-20260603.md`, `trust-filter-missing-report-data-layer-20260208.md`
