---
title: "feat: 3D-kart — deaktiver dobbeltklikk-zoom og senk default-tilt"
type: feat
status: active
date: 2026-04-30
---

# feat: 3D-kart — deaktiver dobbeltklikk-zoom og senk default-tilt

## Overview

To små UX-fix på rapport-boardets 3D-kart (Google Photorealistic 3D Tiles):

1. **Dobbeltklikk-zoom blokkeres** så brukeren ikke kan miste det fastlåste kamera-fokuset rundt boligen ved å dobbeltklikke kartet.
2. **Default-tilt ved 2D→3D-toggle endres fra 60° til 45°** — bruker har testet og funnet 45° som beste startpunkt (mindre 3D-krevende, men fortsatt tydelig 3D-følelse).

## Problem Frame

Når brukeren toggler fra 2D til 3D i rapport-boardet, settes tilt til 60° (hardkodet i `BoardMap.tsx:136`). I praksis gir dette et for skrått startpunkt — 3D-rendering blir krevende å lese, og det skygger for kart-konteksten. Bruker har testet manuelt: pressed "Tilt opp" til floor (minTilt=15°, top-down/2D-look), så "Tilt ned" 2 nivåer (+30°), landet på 45° — og det føltes som beste balanse.

I tillegg: Google's `Map3DElement` har default dobbeltklikk-zoom som flytter kameraet nærmere klikket. Det er en gestus som kan dra brukeren ut av det boligen-sentriske ankeret som boundary-clipping og altitude-grenser sikter på å bevare. Gjeldende `MapView3D` blokkerer allerede scroll-wheel-zoom (`blockZoomWheel` på linje 231–234) — vi følger samme mønster for dblclick.

## Requirements Trace

- R1. Dobbeltklikk på 3D-kartet skal IKKE flytte kameraet (zoom inn/ut)
- R2. Andre gesturer (drag → orbit, shift+drag → tilt, touch-pan, klikk på POI) skal IKKE påvirkes
- R3. Default-tilt når brukeren toggler 2D→3D skal være 45° (ikke 60°)
- R4. `DEFAULT_CAMERA_LOCK.tilt = 45` (fallback når pendingCamera mangler) er allerede korrekt — endring må holde dem konsistente

## Scope Boundaries

- **Scope:** Kun rapport-board-flyten (`BoardMap.tsx` + `MapView3D` shared-komponent)
- **Ikke i scope:**
  - Endre `minTilt`/`maxTilt`-grenser
  - Endre 3D→2D-toggle-tilt (allerede 0°, korrekt for Mapbox-flat)
  - Touch-dobbeltap (Google's eget gesture-system, ikke en JS dblclick-event)
  - Endre andre MapView3D-konsumenter sin oppførsel utover dblclick-blokkering (samme mønster som scroll-wheel-blokk i dag — gjelder alle aktiverte instanser)

## Context & Research

### Relevant Code and Patterns

- `components/map/map-view-3d.tsx:207–255` — eksisterende event-hijack-pattern: `forceOrbitGesture` (PAN→ROTATE), `blockZoomWheel` (scroll-zoom). Dblclick-blokk legges samme sted, samme stil
- `components/map/map-view-3d.tsx:231–234` — `blockZoomWheel`: bruker `preventDefault()` + `stopPropagation()` i capture-fase med `passive: false`. Mønster å speile
- `components/variants/report/board/BoardMap.tsx:136` — `const tilt3d = 60;` hardkodet i `handleModeChange` for 2D→3D-overgang. Dette er kilden til avvik fra `DEFAULT_CAMERA_LOCK.tilt`
- `components/variants/report/blocks/report-3d-config.ts:19–31` — `DEFAULT_CAMERA_LOCK` med `tilt: 45`, `minTilt: 15`, `maxTilt: 75`. Allerede 45° — vi gjør toggle konsistent med denne

### Institutional Learnings

- Tidligere forsøk med JS-basert kamera-styring (rAF + flyCameraTo + manuell mouse-tracking) ga hakking — kommentert i `map-view-3d.tsx:160–166`. Event-hijacking i capture-fase er etablert, fungerende mønster
- `touch-action: none` på container er påkrevd for touch på mobile — vi må ikke fjerne det

### External References

- [Google Photorealistic 3D Tiles: Map3DElement](https://developers.google.com/maps/documentation/javascript/3d-maps-overview) — tilt 0 = nadir (top-down), tilt 90 = horisont. minTilt=15/maxTilt=75 i vår config = [mostly top-down, mostly angled]
- DOM `dblclick`-event fyrer FØR Google's interne handler hvis vi lytter i capture-fase — samme tilnærming som scroll-wheel

## Key Technical Decisions

- **Blokkér via DOM-event på container, ikke prop på Map3D**: Konsistent med eksisterende `blockZoomWheel`. `Map3DElement` eksponerer ikke en `disableDoubleClickZoom`-prop slik Mapbox gjør. Capture-fase + `preventDefault` + `stopPropagation` stopper Googles default-handler før den kjører
- **Lytt på både `dblclick` og `dblclick`** — kun ett event-navn er nok. Touch-dobbeltap blir ikke trigget som DOM dblclick i custom-elementets shadow-DOM uansett, så ingen ekstra touch-handling
- **Bruk `DEFAULT_CAMERA_LOCK.tilt` i stedet for ny magic number**: Toggle 2D→3D leser fra `report-3d-config.ts` så de to verdiene ikke kan drifte fra hverandre. Importeres allerede i `BoardMap3D.tsx:7` — vi importerer den samme i `BoardMap.tsx`
- **Behold `range`-beregning som er**: `zoomToRange(zoom, c.lat, tilt3d, w, h)` bruker tilt-verdien til å regne ut riktig kamera-range. Endring fra 60→45 påvirker output, men det er ønsket (tighter range matcher mindre tilt)

## Open Questions

### Resolved During Planning

- *Tilt-konvensjon i Google's API*: Bekreftet via `Map3DControls.tsx:154` ("Tilt opp (mer ovenfra)" decrements tilt) og Google docs — tilt 0 = top-down, tilt 90 = horisont
- *Hvilken verdi user vil ha som default*: 45°, basert på "maks (=15° floor, 2D-look) + 2 nivåer ned (+30°) = 45°" og tiltStep=15

### Deferred to Implementation

- Eksakt event-target: `dblclick` på container vs. shadow-DOM-element. Forventet at container i capture-fase fanger det, men hvis Google sin shadow-DOM stopper propagation tidligere, må vi prøve `pointerdown`-counting (2 raske pointerdown = dblclick) som fallback. Verifiseres ved manuell test i browser

## Implementation Units

- [ ] **Unit 1: Blokkér dblclick-zoom i MapView3D**

**Goal:** Forhindre at dobbeltklikk på 3D-kartet flytter kameraet nærmere klikkpunktet. Følger eksakt samme event-hijack-mønster som eksisterende `blockZoomWheel`.

**Requirements:** R1, R2

**Dependencies:** Ingen

**Files:**
- Modify: `components/map/map-view-3d.tsx`
- Test: `components/map/map-view-3d.test.tsx` (opprett kun hvis testfilen ikke finnes; hvis test-oppsett krever Google Maps-mocks som ikke eksisterer, dokumentér i Verification at manuell browser-test er primær verifisering)

**Approach:**
- Inne i `useEffect` som setter opp `forceOrbitGesture`/`blockZoomWheel` (linje 207–255), legg til en `blockDblClickZoom`-handler
- Registrér via `addEventListener("dblclick", blockDblClickZoom, { capture: true, passive: false })`
- Handler: `e.preventDefault(); e.stopPropagation();`
- Cleanup i return-funksjonen (parallell til de andre)
- POI-marker-klikk skjer på POI-marker-node (separate child-elementer rendret ved `BoardMap3D.tsx`), ikke som dblclick på kart-container — bekreft i manuell test

**Patterns to follow:**
- `components/map/map-view-3d.tsx:231–234` (`blockZoomWheel`) — samme registreringsstil og handler-form
- Capture-fase + non-passive: påkrevd for at `preventDefault()` skal nå Google's interne listener før den fyrer

**Test scenarios:**
- Happy path: Dobbeltklikk på tom kart-flate → kameraet rikker seg ikke (verifisér via `map3d.range`/`map3d.center` før og etter)
- Edge case: Dobbeltklikk på en POI-marker → POI åpnes via eksisterende `onPOIClick` (single-click semantikk på marker), kameraet rikker seg ikke
- Edge case: To raske enkeltklikk på kart-flate → ingen kamera-bevegelse, ingen dispatch (sanity-check at vi ikke har brutt single-click-flow)
- Integration: Manuell browser-test — toggle til 3D, dobbeltklikk → ingen zoom; drag → orbit fortsatt smooth; scroll → ikke zoom (regression-check)

**Verification:**
- Manuell browser-test i `npm run dev` (eller worktree på port 3001+): Last `/board/...`-rapport, toggle til 3D, dobbeltklikk flere steder på kartet, bekreft at kameraet ikke flytter seg
- Drag-gestus (orbit), shift+drag (tilt), single-click på POI-marker, og touch-pan fungerer som før
- Hvis `map-view-3d.test.tsx` finnes med relevant DOM-event-test-oppsett: legg til vitest-case der dblclick på container ikke gir kamera-flytting

---

- [ ] **Unit 2: Senk default-tilt fra 60° til 45° ved 2D→3D-toggle**

**Goal:** Når brukeren klikker 3D-toggle, starter 3D-kamera på 45° tilt i stedet for 60°. Bruker `DEFAULT_CAMERA_LOCK.tilt` som single source of truth slik at toggle-verdi og fallback-verdi ikke kan drifte.

**Requirements:** R3, R4

**Dependencies:** Ingen (uavhengig av Unit 1)

**Files:**
- Modify: `components/variants/report/board/BoardMap.tsx`
- Test: `components/variants/report/board/BoardMap.test.tsx` (oppretthold kun hvis fil/test-oppsett finnes; ellers manuell verifisering)

**Approach:**
- Importer `DEFAULT_CAMERA_LOCK` fra `@/components/variants/report/blocks/report-3d-config` i `BoardMap.tsx` (allerede importert i søsken-fil `BoardMap3D.tsx`)
- I `handleModeChange` (linje 124–189), bytt linje 136 fra `const tilt3d = 60;` til `const tilt3d = DEFAULT_CAMERA_LOCK.tilt;`
- `zoomToRange(zoom, c.lat, tilt3d, w, h)` på linje 137 plukker opp ny verdi automatisk
- Ingen endringer i 3D→2D-toggle (`tilt: 0` i Mapbox er korrekt — flat top-down)

**Patterns to follow:**
- `components/variants/report/board/BoardMap3D.tsx:7,84,86` — samme import og bruk av `DEFAULT_CAMERA_LOCK.tilt`

**Test scenarios:**
- Happy path: Toggle 2D→3D → 3D-kart starter med tilt = 45° (ikke 60°). Verifisér via `map3d.tilt` etter `gmp-cameraload`-event eller via `flyCameraTo`-spy hvis testet
- Integration: Manuell browser-test — pan/zoom/rotate i 2D, toggle til 3D → kamera lander på 45° tilt sentrert på samme lat/lng/heading; toggle tilbake → 2D pitch=0 (uendret oppførsel)
- Regression: `DEFAULT_CAMERA_LOCK.tilt` endres ikke (fortsatt 45 i `report-3d-config.ts`)

**Verification:**
- Manuell browser-test: 2D→3D-toggle → start-tilt visuelt rundt 45° (mer top-down enn før, mindre 2D enn helt flat)
- Logg `tilt3d`-verdien midlertidig under utvikling for å bekrefte 45 leses korrekt fra `DEFAULT_CAMERA_LOCK`
- Type-sjekk passerer: `npx tsc --noEmit`

## System-Wide Impact

- **Interaction graph:** `MapView3D` brukes i (a) rapport-board (`BoardMap3D.tsx`), og (b) potensielt rapport-blokken (`ReportThemeMap.tsx`/lignende). Dblclick-blokk gjelder ALLE aktiverte instanser — verifisér at dette er ønsket. (Pre-eksisterende scroll-wheel-blokk har samme scope, så konsistent posisjon)
- **Error propagation:** Ingen — DOM-event-blokkering har ingen feil-bane
- **State lifecycle risks:** Ingen — handler tilbakestilles via cleanup-funksjon i useEffect
- **API surface parity:** `DEFAULT_CAMERA_LOCK.tilt` blir nå brukt to steder (`BoardMap3D.tsx` fallback + `BoardMap.tsx` toggle). Hvis senere noen endrer fallback uten å tenke på toggle, fanges det opp av at begge bruker samme konstant
- **Unchanged invariants:** `minTilt`, `maxTilt`, `range`, `panHalfSideKm`, scroll-wheel-blokk, orbit-hijack — alle bevart

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Google's shadow-DOM kan svelge `dblclick` før container-listener treffer | Verifisér i browser. Hvis problem: implementér pointerdown-counting fallback (to `pointerdown` innenfor 300ms = dblclick) |
| Bruker som vil ha 60° tilbake (subjektiv preferanse) | Lett å justere — én konstant i `report-3d-config.ts`. Plan dokumenterer at 45° er bevisst valg basert på user-test |
| Andre MapView3D-konsumenter ikke vil ha dblclick blokkert | Søkt med `grep` — eneste aktive konsument er `BoardMap3D`. Hvis ny konsument trenger dblclick, kan vi gjøre det opt-out via `cameraLock`-flagg senere |

## Documentation / Operational Notes

- Ingen dokumentasjons-endringer påkrevd (ingen public-API-endring)
- Ingen rollout-bekymringer (Placy er prototype-stadium per memory)
- Testes manuelt i dev før commit

## Sources & References

- Related code: `components/map/map-view-3d.tsx`, `components/variants/report/board/BoardMap.tsx`, `components/variants/report/blocks/report-3d-config.ts`
- Recent commit-kontekst: `9671325 merge: feat/board-ux-rapport-variant — rapport-paritet i kategori-Beliggenhet-tab` (rapport-board nylig fusjonert til main)
