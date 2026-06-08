---
title: "feat: Sanntids transport-data i board-popups"
type: feat
status: active
date: 2026-06-08
---

# feat: Sanntids transport-data i board-popups

## Overview

Board-popupene (`BoardPOIMiniPopup` og `BoardPOI3DMiniPopup`) viser i dag kun ikon, navn, adresse og "Utforsk"-lenke. `useRealtimeData`-hooken og `RealtimeSection`-renderingen finnes allerede i `ReportMapDrawer.tsx`, men er aldri koblet til board-laget. Resultatet er at å klikke på en bussholdeplass eller bysykkelstasjon i rapport-board ikke viser avganger eller tilgjengelighetsdata — stikk i strid med det brukerne ser i screenshotene fra det gamle report-formatet.

## Problem Frame

Transport og mobilitet er et kritisk salgsargument for næringseiendom (pendler-perspektiv). Brukerne forventer at å klikke på "Hesthagen bussholdeplass" viser neste avganger, og at å klikke på "Trondheim Bysykkel: Abels gate" viser ledige sykler. Dette fungerer i den gamle rapport-komponenten via `ReportMapDrawer`, men ikke i `rapport-board` som bruker board-popup-arkitekturen.

## Requirements Trace

- R1. Klikk på bussholdeplass i board → popup viser neste 3 avganger (linjekode, retning, "om X min", sanntid-indikator)
- R2. Klikk på bysykkelstasjon → popup viser ledige sykler + ledige låser
- R3. Klikk på Hyre-stasjon → popup viser antall ledige biler
- R4. Fungerer identisk i 2D-kart (BoardPOIMiniPopup) og 3D-kart (BoardPOI3DMiniPopup)
- R5. Ingen duplikat rendering-logikk — delt komponent, ikke copy-paste

## Scope Boundaries

- Ingen endring i transport-API-er — alle 4 endepunkter er fullt funksjonelle
- Ingen endring i `useTransportDashboard`-hooken — det er et eget dashboard-scope
- Mobile bottom-sheet (popupMode === "sheet") er **deferred** — komponenten finnes ikke som fil; scope er kun `popupMode === "mini"` (desktop, lg+)
- Ingen nye import-scripts eller database-endringer

### Deferred to Separate Tasks

- Mobile bottom-sheet transport-data: krever at BoardMobileSheet-komponenten skrives/finnes, tas separat

## Context & Research

### Relevant Code og Patterns

- `components/variants/report/ReportMapDrawer.tsx:37-38` — eksisterende `isTransportPOI` + `useRealtimeData`-mønsteret som kopieres
- `components/variants/report/ReportMapDrawer.tsx:383-451` — `RealtimeSection`-funksjonen som ekstraheres
- `components/variants/report/board/BoardPOIMiniPopup.tsx` — 2D popup, mangler transport
- `components/variants/report/board/BoardPOI3DMiniPopup.tsx` — 3D popup, mangler transport
- `lib/hooks/useRealtimeData.ts` — poller `/api/entur`, `/api/bysykkel`, `/api/hyre` parallelt
- `components/variants/report/board/board-data.ts:44` — `BoardPOI.raw: POI` inneholder `enturStopplaceId`, `bysykkelStationId`, `hyreStationId`

### Institutional Learnings

- `docs/solutions/integration-issues/entur-quay-direction-grouping-Report-20260410.md` — quay-arkitektur; `useRealtimeData` bruker flat `departures`, ikke quay-gruppert — OK for popup (bare 3 avganger)
- `docs/solutions/architecture-patterns/entur-mobility-v2-universal-transport-api-20260410.md` — API-arkitektur; alt cacher 30s server-side

## Key Technical Decisions

- **Ekstraher RealtimeSection til delt fil** i stedet for å duplisere: `ReportMapDrawer.tsx` og begge board-popups kan importere fra ett sted. Kodebase-hygiene-regelen krever at gammel kode slettes når ny overtar.
- **`poi.raw`-tilgang**: Board-popupene har `BoardPOI`-type, ikke `POI` — transport-IDene nås via `poi.raw.enturStopplaceId` etc. Hooken tar `POI | null`, så `poi.raw` sendes direkte.
- **3D-popup og rAF**: `BoardPOI3DMiniPopup` bruker `requestAnimationFrame` for CSS-transform-oppdateringer direkte på DOM. `useRealtimeData` bruker `useState` og trigger React re-renders hvert 60s. Disse er uavhengige — rAF skriver til `wrapperRef.current.style.transform`, React-state trigger re-render av innholdet. Ingen konflikt. Popup vokser oppover (anchored via `translate(-50%, -100%)`), korrekt oppførsel.
- **Loading skeleton i mini-popup**: Holder seg enkel — loading-state vises ikke eksplisitt, da hooken returnerer `loading: false` etter første fetch. Popup viser transport-seksjonen kun etter `realtimeData.lastUpdated` er satt (samme mønster som `ReportMapDrawer.tsx:228`).

## Open Questions

### Resolved During Planning

- **Finnes transport-IDer på board-POIs?** Ja — `BoardPOI.raw: POI` eksponerer hele det originale POI-objektet inkl. `enturStopplaceId`, `bysykkelStationId`, `hyreStationId`.
- **Virker hooken for næringseiendom (Teknostallen)?** Så lenge transport-POIene er linket til prosjektet i databasen (via `project_pois`/`product_pois`) — ja. Data-koblinger er allerede gjort for Teknostallen (per 2026-04-10-plan, TC-08).
- **Popup-bredde 260px vs 320px (ReportMapDrawer)**: `RealtimeSection` rendrer kompakt tekst-lister som fungerer ved 260px. Ingen layout-endring nødvendig.

### Deferred to Implementation

- **Finnes det transport-POIer for næringseiendom-prosjektene i prod-databasen?** Sjekk om Teknostallen-prosjektet har busstopp/bysykkel-POIer linked — gjøres ved å åpne `/eiendom/klp-eiendom/teknostallen/rapport-board` og inspisere nettverkskall.

## Implementation Units

- [x] **Unit 1: Ekstraher POIRealtimeSection til delt komponent**

**Goal:** Flytte `RealtimeSection`-funksjonen fra `ReportMapDrawer.tsx` til en standalone fil som begge board-popups kan importere.

**Requirements:** R5

**Dependencies:** Ingen

**Files:**
- Create: `components/variants/report/blocks/POIRealtimeSection.tsx`
- Modify: `components/variants/report/ReportMapDrawer.tsx`

**Approach:**
- Kopier `RealtimeSection`-funksjonen (linje 383–451 i `ReportMapDrawer.tsx`) til ny fil
- Rename til `POIRealtimeSection` for å unngå navnekollisjon og for klarhet
- Props-interface forblir identisk: `{ realtimeData: ReturnType<typeof useRealtimeData>; poi: POI }`
- `poi`-parameteren brukes i dag kun for fremtidig bruk (ikke i render-logikken) — behold som-er for paritet
- Flytt import av `Bus`, `Bike`, `Car` og `formatRelativeDepartureTime` til den nye filen
- I `ReportMapDrawer.tsx`: erstatt inline `RealtimeSection` med import av `POIRealtimeSection`, slett den lokale funksjonen

**Patterns to follow:**
- `components/variants/report/blocks/TransitDashboardCard.tsx` — samme katalog, samme mønster for report-blocks

**Test scenarios:**
- Test expectation: none — ren ekstraksjon/rename, ingen atferdsendring. Verifiseres visuelt.

**Verification:**
- `RealtimeSection` eksisterer ikke lenger i `ReportMapDrawer.tsx`
- Gammel rapport (`/eiendom/{kunde}/{prosjekt}/rapport`) viser fortsatt transport-data i kart-drawern

---

- [x] **Unit 2: Legg til transport-data i BoardPOIMiniPopup (2D)**

**Goal:** Board 2D-popup viser live avganger og sykkel-tilgjengelighet for transport-POIs.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1 (POIRealtimeSection eksisterer)

**Files:**
- Modify: `components/variants/report/board/BoardPOIMiniPopup.tsx`

**Approach:**
- Legg til `useRealtimeData` og `POIRealtimeSection` som imports
- Sett `const isTransportPOI = !!(poi.raw.enturStopplaceId || poi.raw.bysykkelStationId || poi.raw.hyreStationId)` — mønster fra `ReportMapDrawer.tsx:37`
- Kall `useRealtimeData(isTransportPOI ? poi.raw : null)`
- Plasser `<POIRealtimeSection>` mellom body-tekst og "Utforsk"-knapp, kun når `realtimeData.lastUpdated` er satt (unngår layout-shift mens data hentes)
- Popupen er 260px bred — `POIRealtimeSection` er kompakt nok til dette uten endringer

**Patterns to follow:**
- `components/variants/report/ReportMapDrawer.tsx:37-38, 228-229` — eksakt samme gate-logikk

**Test scenarios:**
- Happy path: Klikk på bussholdeplass med `enturStopplaceId` → seksjon vises etter ~1s med 3 avganger
- Happy path: Klikk på bysykkelstasjon → seksjon viser "X ledige sykler · Y ledige låser"
- Edge case: Klikk på vanlig POI (kafé) med ingen transport-IDs → ingen seksjon vises, popup er uendret
- Edge case: Klikk på transport-POI som feiler (API nede) → popup vises uten seksjon (Promise.allSettled stille feil)
- Edge case: `realtimeData.loading: true` på første fetch → ingen layout-shift (seksjon skjules til `lastUpdated` er satt)

**Verification:**
- Åpne `rapport-board` for et prosjekt med transport-POIs, klikk på bussholdeplass på kartet
- Popup viser avganger med linjekode, retning og "om X min" (sanntid-prikk grønn/grå)
- `npx tsc --noEmit` — 0 feil

---

- [x] **Unit 3: Legg til transport-data i BoardPOI3DMiniPopup (3D)**

**Goal:** Board 3D-popup viser live avganger og sykkel-tilgjengelighet — identisk med 2D-popup.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1 (POIRealtimeSection eksisterer)

**Files:**
- Modify: `components/variants/report/board/BoardPOI3DMiniPopup.tsx`

**Approach:**
- Identisk med Unit 2, men `poi`-typen er `BoardPOI` (ikke `POI`) — bruk `poi.raw` for alle transport-ID-sjekker og for `useRealtimeData`-kallet
- rAF-loopen i denne komponenten skriver direkte til `wrapperRef.current.style.transform` — den er uavhengig av React state. `useRealtimeData` trigger React re-renders hvert 60s, men disse berører kun det React-styrte innholdet (departure-lista), ikke rAF-posisjonerings-loopen. Ingen conflict.
- Popup er anchored `translate(-50%, -100%)` — vokser oppover ved transportdata-lasting, korrekt oppførsel.
- Filen har `// @ts-nocheck` pragma pga. løse Google Maps 3D-typer — dette gjelder fortsatt etter endringen

**Patterns to follow:**
- `components/variants/report/board/BoardPOI3DMiniPopup.tsx` — eksisterende hooks-mønster i filen
- `components/variants/report/board/BoardPOIMiniPopup.tsx` — identisk transport-integrasjon fra Unit 2

**Test scenarios:**
- Happy path: I 3D-modus, klikk på bussholdeplass → popup tracker markøren og viser avganger
- Edge case: Popup er delvis utenfor skjerm (POI nær kant) → React re-render ved data-oppdatering forstyrrer ikke rAF-tracking
- Edge case: POI-bytte (klikk ny POI mens avgangslista vises) — `useEffect` i `useRealtimeData` aborterer og rydder opp via `controller.abort()` + `clearInterval`

**Verification:**
- Åpne 3D-modus, klikk på bussholdeplass
- Popup tracker markøren korrekt, avganger vises etter ~1s
- `npx tsc --noEmit` — 0 feil (ts-nocheck allerede i filen)

## System-Wide Impact

- **Unchanged invariants:** `useTransportDashboard` og `TransitDashboardCard` i `ReportHeroInsight.tsx` er uberørt — dette er en separat transport-dashboard-visning for hele kategorien, ikke per-POI-popup. De to systemene lever side om side.
- **API-belastning:** `useRealtimeData` poller hvert 60s per aktiv popup. Én popup av gangen (brukeren har én aktiv POI). Ingen merkbar økning i API-load.
- **Error propagation:** `Promise.allSettled` i `useRealtimeData` — én feilende kilde blokkerer ikke andre. Feil vises ikke til bruker, seksjonen vises ganske enkelt ikke.
- **ReportMapDrawer paritet:** Etter Unit 1 bruker `ReportMapDrawer.tsx` og board-popupene den samme `POIRealtimeSection`-komponenten. Fremtidige endringer i transport-visningen trenger kun gjøres ett sted.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Transport-POIene for næringseiendom (Teknostallen) er ikke linket i databasen | Sjekk tidlig i implementering — åpne rapport-board og se om transport-POIs vises på kartet. Hvis ikke, er linking av POIs en separat data-task utenfor scope. |
| 3D-popup layout-shift ved data-lasting | Mitigert via `realtimeData.lastUpdated`-gate — seksjonen rendres ikke før data er lastet |

## Sources & References

- Eksisterende mønster: `components/variants/report/ReportMapDrawer.tsx:383-451`
- Transport-hook: `lib/hooks/useRealtimeData.ts`
- Board-data type: `components/variants/report/board/board-data.ts:34-45`
- Entur API-løsning: `docs/solutions/integration-issues/entur-quay-direction-grouping-Report-20260410.md`
- Transport API-arkitektur: `docs/solutions/architecture-patterns/entur-mobility-v2-universal-transport-api-20260410.md`
