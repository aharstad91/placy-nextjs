---
title: "Mobil 3D-camera-lock via UI-knapper istedenfor gesture-rotate"
type: feat
status: active
date: 2026-04-30
---

# Mobil 3D-camera-lock via UI-knapper istedenfor gesture-rotate

## Overview

Plan 003 (`docs/plans/2026-04-30-003-feat-3d-map-touch-camera-lock-plan.md`) implementerte selektiv pinch-blokkering (variant B) i håp om å bevare 2-finger-rotate som mobil orbit-ekvivalent. Testet på iPhone — 2-finger-rotate fungerte ikke i praksis, og brukeren konkluderte at hele gesture-modellen er for tungvindt på mobil.

Ny strategi: gi opp gesture-basert rotasjon på touch. Blokker ALL touch-interaksjon på 3D-kartet og eksponer eksisterende `Map3DControls`-knapper (rotate-left/rotate-right via `flyCameraTo`) som primær UX. Knappene finnes allerede i kodebasen (`components/map/Map3DControls.tsx`) og rendres i `MapView3D` når `activated === true` — men på mobil ligger de skjult bak bottom-sheet (`BoardCategoryGrid` + `BoardPeekCard`). Planen flytter knappene over bottom-sheet og forenkler touch-blokkeringen.

## Problem Frame

### Hva som ikke fungerte med plan 003

Plan 003's variant B sammenlignet finger-avstanden mellom touchstart og touchmove med en 10px-terskel for å skille pinch fra rotate. På iPhone:
- Naturlig 2-finger-rotate har små avstands-variasjoner (fingre er aldri perfekt synkroniserte) → terskelen ble passert → rotate ble blokkert sammen med pinch
- Brukeren opplevde det som at rotate "ikke fungerte" — gesture-rotate som mobil orbit-ekvivalent var ikke et reelt alternativ

Variant A (blokker all multi-touch) ville ha samme effekt — rotate dør uansett. Konklusjonen er: gesture-basert rotasjon på touch er ikke en levedyktig vei.

### Hvorfor knapp-basert UX faktisk fungerer

`Map3DControls` bruker Googles `flyCameraTo` med 400ms-animasjoner. Tidligere institutional learning (`docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md`) advarte mot JS-drevet kamera-styring — men advarselen gjaldt JS som FIGHTER mot en aktiv gesture (rAF-loop som skriver heading mens brukeren drar). Knapp-trigget `flyCameraTo` har ingen samtidig gesture å konkurrere mot, og 400ms-animasjonen er Googles native — smørbløt.

Knappene er allerede i kodebasen, allerede koblet på `mapInstance`, allerede med 45° steg per klikk (`headingStep = 45`). De er ikke synlige på mobil fordi `bottom-4 right-4`-posisjonen ligger bak bottom-sheet-en.

### Hvorfor blokkere ALLE touch-events nå

Hvis vi beholder selektiv blokkering (1-finger pan blokkert, 2-finger gesture passerer), risikerer vi at brukerne aktiverer pinch-zoom eller rotate ved et uhell — og disse fightes av Google's interne handler på uforutsigbare måter når vi delvis intervenerer. Helt-blokk er deterministisk: ingen touch flytter kameraet, kun knapper gjør det. Brukeren mister ingenting siden gesture-rotate uansett ikke var brukbart.

## Requirements Trace

- R1. Brukeren skal kunne rotere kameraet rundt eiendommen på mobil via UI-knapper (samme rotate-CW/rotate-CCW som desktop allerede har)
- R2. Touch-events på 3D-kartet skal ikke flytte kameraet (ingen pan, ingen pinch-zoom, ingen tilt) — kameraet er ankret av cameraLock-konfig + knapper
- R3. Eksisterende mus-event-hijack på desktop forblir uendret (drag = orbit fungerer som før)
- R4. Knappene må være synlige og treffbare på mobil — over bottom-sheet, innenfor safe-area, fingervennlig størrelse (44×44 px minimum per Apple HIG)
- R5. Knappene skal også være synlige på desktop (ingen regresjon — de er allerede der)

## Scope Boundaries

- **Ikke i scope:** Custom rAF-orbit eller flyCameraAround-loop med touch-tracking — eksplisitt forkastet i plan 003 og tidligere iterasjoner
- **Ikke i scope:** Egen mobil-spesifikk knapp-design (ny komponent, ny styling) — hvis eksisterende `Map3DControls` er for tett/uleselig på mobil, foretrekk minimal CSS-justering over redesign
- **Ikke i scope:** Continuous-rotate ved langtrykk (hold-knapp = roter kontinuerlig). 45°-steg per klikk er tilstrekkelig for paritet med desktops drag-orbit
- **Ikke i scope:** Tilt-knapper og zoom-knapper på mobil — `tilt` og `range` er allerede klampet av `cameraLock`-konfig, og brukeren har ikke etterspurt dem. Hold mobil-UX minimal: rotate + compass.

### Deferred to Separate Tasks

- Plan 003-implementasjonen (commits `a91cbc2`, `cba4f99`, `3c0cd2f` på `feat/3d-touch-camera-lock`): Variant B må erstattes med variant A (blokker all multi-touch). Plan 004 erstatter dem fullstendig — ikke et separat task, men en oppdatering av samme fil.

## Context & Research

### Relevant Code and Patterns

- `components/map/Map3DControls.tsx:113-191` — alle knappene er allerede der (kompass, rotate CCW/CW, tilt up/down, zoom +/-). `headingStep` defaulter til 45°, `flyCameraTo` med 400ms duration. Posisjon: `absolute bottom-4 right-4 z-10`.
- `components/map/map-view-3d.tsx:382-392` — `Map3DControls` rendres som søsken til `<Map3D>` når `activated === true`. `showZoom={false}` — zoom-knappene er allerede skjult i board-konteksten. Tilt-knappene er fortsatt synlige.
- `components/map/map-view-3d.tsx:209-321` — touch-blokkeringen fra plan 003 (commit `a91cbc2` + `cba4f99` på `feat/3d-touch-camera-lock`-branchen). Skal forenkles til variant A (blokker all touch).
- `components/variants/report/board/mobile/BoardCategoryGrid.tsx:14` — bottom-sheet på mobil sitter `absolute inset-x-0 bottom-0`. Høyde varierer med innhold, men dekker typisk 25-40% av viewport-høyden.
- `components/variants/report/board/mobile/BoardPeekCard.tsx:15` — peek-card sitter også `absolute inset-x-0 bottom-0`, brukes når en kategori er aktiv.
- `components/variants/report/board/BoardMap.tsx:287` — 2D/3D-toggle (`ModeToggle`) sitter `absolute top-3 right-3 z-30`. Høyre-side er allerede tatt i top-area.

### Institutional Learnings

- `docs/solutions/feature-implementations/google-maps-3d-orbit-mode-via-ctrlkey-hijack-20260415.md` — vil oppdateres i Unit 4 til å reflektere at gesture-rotate på touch er forkastet og at knapp-UX er den valgte løsningen.
- `docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md` — bekrefter at `flyCameraTo` fra knapper (ingen samtidig gesture) er trygg. Det var rAF-loop som skrev heading midt i en aktiv drag som hakket — knapp-trigget animasjon har ingen tilsvarende race-tilstand.

### External References

- Apple HIG: Minimum tap target er 44×44 pt. Eksisterende knapper er `w-10 h-10` (40×40 px) → marginalt under. Vurder å øke til `w-11 h-11` (44px) på mobil eller akseptere at 40px i praksis er greit på iOS (Safari treffer rundt knappene med ~5px slop).

## Key Technical Decisions

- **Forkast gesture-basert rotate på mobil**: Variant B fra plan 003 fungerer ikke. Variant A (blokker all multi-touch) er det vi går for — kombinert med UI-knapper for rotate.
- **Knapp-basert kamera-kontroll via `flyCameraTo`**: `Map3DControls` finnes allerede og bruker `flyCameraTo`. Ingen race med aktive gesturer siden vi blokkerer all touch.
- **Repositioner Map3DControls over bottom-sheet på mobil**: Endre `bottom-4` til en verdi som er over bottom-sheet, eller flytt til venstre side / top-region. Avgjør i implementasjon basert på faktisk skjerm-sjekk.
- **Behold knappene synlige på desktop også**: De er allerede der og fungerer som power-user-snarvei. Ingen regresjon.
- **Skjul tilt-knapper på mobil (men ikke desktop)**: Mobil-UX skal være minimal. Tilt er klampet av `cameraLock` uansett. Implementeres via en `showTilt`-prop på `Map3DControls`, eller responsive Tailwind-klasse (`hidden lg:flex` på tilt-blokken).

## Open Questions

### Resolved During Planning

- **Skal vi prøve én siste tuning av variant B (større terskel)?** Nei — selv med 30-50px terskel er rotate-gesture inkonsistent på touch (avhenger av brukerens finger-precision). Knapp-UX er deterministisk og enklere å forklare.
- **Skal mobil få helt egen kontroll-komponent?** Nei — `Map3DControls` med `showZoom={false}` + `showTilt={false}` (ny prop) gir mobil-set. Forenkler vedlikehold.
- **Skal continuous-rotate (hold-knapp) være med?** Nei — 45°-steg er tilstrekkelig for paritet med desktops drag-orbit (som også er steg-basert via 45°-vinkel-deltas). Kan legges til senere hvis brukerne savner det.

### Deferred to Implementation

- **Eksakt y-posisjon for knappene på mobil**: Bottom-sheet-høyden varierer med innhold. Implementer med `bottom-[35vh]` eller en `safe-area-inset-bottom`-justert verdi, juster basert på faktisk skjerm-sjekk på iPhone.
- **Skal compass-knappen være synlig på mobil?** Den er nyttig (reset til nord), men tar plass. Test på faktisk enhet — hvis den føles overflødig ved siden av rotate-CCW/CW, skjul den. Default: behold den.
- **Hvordan visuelt indikere "tap her for å rotere" første gang?** Ikke i scope nå — anta at ikon-affordansen (rotate-piler) er klar nok. Hvis bruker-feedback viser at den ikke er, vurder en tooltip/hint som separat oppgave.

## Implementation Units

- [ ] **Unit 1: Bytt touch-blokkering fra variant B til variant A**

**Goal:** Blokker ALL touch-interaksjon på 3D-kartet (1-finger og multi-finger). Erstatter selektiv pinch-deteksjon fra plan 003.

**Requirements:** R2, R3

**Dependencies:** Ingen.

**Files:**
- Modify: `components/map/map-view-3d.tsx`

**Approach:**
- Fjern `blockPinchZoom`-handler, `pinchDistance`-helper, `trackPinchStart`-handler, `resetPinchOnEnd`-handler, og `initialPinchDist`-state-variabel fra useEffect
- Endre `blockSingleTouchPan` til `blockAllTouchMove` (eller behold navn for diff-minimalitet, men endre body)
- Body: preventDefault + stopPropagation hvis `e.touches.length >= 1` (alle touchmove-events). Ikke noe length-check trengs — alle touch blokkeres
- Fjern `touchstart`/`touchend`/`touchcancel`-listenerne (ble brukt for pinch-tracking, ikke nødvendig lenger)
- Cleanup-funksjonen forenkles tilsvarende

**Patterns to follow:**
- Samme capture+passive: false-options som wheel-blockeren (`map-view-3d.tsx:295-307`)
- Hold all logikk i den eksisterende useEffect-en — ingen ny effect

**Test scenarios:**
- Happy path: På mobil 3D-kart, 1-finger-drag flytter ikke kameraet (heading/center/range/tilt forblir uendret)
- Happy path: Pinch flytter ikke kameraet (range/altitude uendret)
- Happy path: 2-finger-drag flytter ikke kameraet (rotate er borte — det er forventet, knapper tar over)
- Edge case: Tap på POI-marker fungerer fortsatt — `Marker3D.onClick` fyrer på `click`-event, ikke `touchmove`. Verifiser at vi ikke blokkerer click-events fra POI-markører
- Regression: Mus-orbit på desktop uendret. `forceOrbitGesture` returnerer fortsatt tidlig på `pointerType === "touch"`, så koden er konsistent.

**Verification:**
- På iPhone: ingen touch-gesture flytter kameraet i 3D-modus. POI-marker-klikk fungerer. På desktop: drag = orbit som før.

- [ ] **Unit 2: Repositioner Map3DControls så de er synlige på mobil**

**Goal:** Sørge for at rotate-knappene ikke ligger bak `BoardCategoryGrid`/`BoardPeekCard` på mobil.

**Requirements:** R4

**Dependencies:** Ingen.

**Files:**
- Modify: `components/map/Map3DControls.tsx`

**Approach:**
- Endre wrapper-divens posisjonering fra `absolute bottom-4 right-4 z-10` til en verdi som ligger over mobil bottom-sheet
- Mulighet A: `bottom-[35vh] lg:bottom-4` — løfter knappene 35% opp på mobil, beholder desktop-posisjon
- Mulighet B: Flytt til høyre-side midt på (`top-1/2 right-4 -translate-y-1/2`) — alltid samme plass på alle viewports, og fjerner avhengighet av bottom-sheet-høyde
- Anbefalt: B fordi den er bottom-sheet-uavhengig og fungerer både når sheet er kollapset og ekspandert. Implementer B først, fall tilbake til A hvis høyre-midten kolliderer med ModeToggle (`top-3 right-3`)
- Verifiser at z-index ikke konflikter med `BoardCategoryGrid` (z-10) eller `ModeToggle` (z-30) — Map3DControls trenger minst z-10, helst z-20 for å ligge over bottom-sheet

**Patterns to follow:**
- `components/variants/report/board/mobile/BoardSwitcherChip.tsx` — `safe-area-inset`-håndtering hvis den brukes andre steder i mobil-UI

**Test scenarios:**
- Happy path: På mobil, knappene er synlige uavhengig av om bottom-sheet er kollapset, ekspandert, eller viser peek-card
- Happy path: På desktop, knappene er der de var (bottom-right) — eller akseptert ny plass hvis vi velger samme posisjon overalt
- Edge case: Når 2D/3D-toggle er aktiv og `ModeToggle` står oppe i høyre hjørne, krasjer ikke rotate-knappene mot den
- Edge case: Liten skjerm (iPhone SE-bredde) — knappene tar ikke unødig plass, blokkerer ikke kart-interaksjon

**Verification:**
- På iPhone: rotate-knappene er synlige og treffbare uten å avsløre bottom-sheet. Klikk roterer kameraet 45° med smooth animasjon.

- [ ] **Unit 3: Skjul tilt-knapper på mobil**

**Goal:** Forenkle mobil-UX — kun rotate + compass synlige, tilt skjult.

**Requirements:** R4 (minimal mobil-UI)

**Dependencies:** Unit 2 (samme fil, lettere som separat commit for å gjøre rollback enklere hvis tilt savnes)

**Files:**
- Modify: `components/map/Map3DControls.tsx`

**Approach:**
- To valg:
  - **A (responsive Tailwind):** Legg til `hidden lg:flex` på tilt-blokken (linje 150-167). Ingen ny prop, ren CSS.
  - **B (eksplisitt prop):** Legg til `showTilt?: boolean` (default `true`) lik den eksisterende `showZoom`-mønsteret. Konsumenter avgjør per kart.
- Anbefalt: A, fordi tilt-prefereransen sannsynligvis er konsistent (alltid skjult på mobil for alle 3D-kart-bruk) og A unngår prop-drilling fra `MapView3D`.
- Hvis andre 3D-kart-kontekster trenger tilt på mobil, eskalér til B i en senere oppgave.

**Patterns to follow:**
- `showZoom`-prop i samme fil for B-varianten

**Test scenarios:**
- Happy path: På mobil, tilt-knappene er ikke synlige
- Happy path: På desktop, tilt-knappene er synlige som før
- Regression: `cameraLock.minTilt`/`maxTilt` håndheves fortsatt av Google natively — brukeren kan ikke tilt-e ut av rammen via touch (den er blokkert) eller mus (orbit-modus uten tilt-modifier)

**Verification:**
- På iPhone: tilt-knapper ikke synlige. På desktop: synlige.

- [ ] **Unit 4: Oppdater institutional learning + plan 003**

**Goal:** Reflektere at gesture-rotate på touch er forkastet og at knapp-UX er den valgte løsningen.

**Requirements:** R2 (kunnskap-vedlikehold)

**Dependencies:** Unit 1, 2, 3 — oppdateres etter implementasjon og verifisering.

**Files:**
- Modify: `docs/solutions/feature-implementations/google-maps-3d-orbit-mode-via-ctrlkey-hijack-20260415.md`
- Modify: `docs/plans/2026-04-30-003-feat-3d-map-touch-camera-lock-plan.md` (legg til notat øverst om at planen er erstattet av 004)

**Approach:**
- I orbit-mode-læringen: oppdater "Touch-paritet"-seksjonen
  - Fjern variant B-koden (eller arkiver den som "forkastet")
  - Erstatt med variant A-kode (blokker all touchmove)
  - Legg til ny seksjon "Mobil rotate via UI-knapper" som forklarer:
    - Hvorfor gesture-rotate ikke fungerer på touch
    - Hvordan `Map3DControls` + `flyCameraTo` gir deterministisk knapp-basert rotasjon
    - At rotate-knappene må positioneres over bottom-sheet på mobil
- I plan 003: legg til en banner-notat øverst i frontmatter eller første overskrift: `**Status:** Erstattet av 004 — variant B fungerte ikke i praksis. Se docs/plans/2026-04-30-004-feat-3d-map-mobile-rotate-buttons-plan.md`. Sett `status: superseded` i frontmatter.

**Test expectation: none -- ren dokumentasjons-oppdatering uten kodeoppførsel.**

**Verification:**
- Lærings-dokumentet refererer kun til variant A som gjeldende løsning. Plan 003 er tydelig markert som erstattet.

## System-Wide Impact

- **Interaction graph:** `MapView3D` brukes av alle 3D-kart-renderere. Variant A-blokkering treffer alle (Explorer, Report-blokk, Board). Eksplisitt verifisering for andre overflater er ikke i scope, men ingen regresjons-risiko forventes — alle får knapp-UX gratis.
- **Error propagation:** `flyCameraTo` kan kaste hvis `mapInstance` er null eller WebGL-konteksten er korrupt. `Map3DControls` har allerede en `if (!map3d) return null` guard. Ingen ny error-overflate.
- **State lifecycle risks:** Ingen — touch-blokkering er stateless. Knapp-trigget `flyCameraTo` håndteres av Google's native pipeline.
- **API surface parity:** Endringen lever i `MapView3D` og `Map3DControls`, ingen prop-endringer for konsumenter (forutsatt variant A på `Map3DControls`-tilt-skjuling, ikke variant B).
- **Integration coverage:** Manuell test på iPhone er fortsatt obligatorisk — Vitest/jsdom kan ikke simulere WebGL eller touch-events autentisk.
- **Unchanged invariants:** Desktop mus-event-hijack, wheel-blocking, dblclick-blocking, bounds, altitude-grenser, tilt-grenser — alle uendret.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Helt-blokkerte touch føles som "kartet er ødelagt" hos brukeren | Knappene er synlige og affordant. Hvis det fortsatt er forvirrende, vurder en kort onboarding-hint senere. |
| Knapp-posisjon på mobil ender opp foran POI-markører | Posisjonere over høyre kant så de ikke dekker prosjekt-markøren i midten. POI-markører i kanten kan dekkes — akseptert kompromiss. |
| Tilt-skjuling på mobil savnes av brukerne | Variant A er CSS-bare og kan reverteres med ett ord (fjern `hidden lg:flex`). Lavt rollback-friksjon. |
| Vercel-preview deployment-protection gjør test vanskelig (samme problem som tidligere) | Rull til main direkte — Placy er prototype og deploy-nedetid på minutter tolereres (jf. CLAUDE.md). |

## Documentation / Operational Notes

- Etter merge til `main`, test på faktisk iPhone via `placy.no`. Hvis variant A føles riktig, behold. Hvis brukerne fortsatt vil ha gesture-rotate, eskalér til en separat plan med custom touch-handling (out of scope her).
- Merknad i `MEMORY.md` (auto-memory) hvis ny innsikt: at gesture-rotate på Google Maps 3D touch er forkastet for Placy-context.

## Sources & References

- Origin: brukerens iPhone-test av plan 003 (variant B fungerte ikke) + skjermbilde av eksisterende rotate-knapper
- Predecessor plan: `docs/plans/2026-04-30-003-feat-3d-map-touch-camera-lock-plan.md`
- Related code: `components/map/Map3DControls.tsx`, `components/map/map-view-3d.tsx`, `components/variants/report/board/BoardMap.tsx`, `components/variants/report/board/mobile/BoardCategoryGrid.tsx`
- Related learnings:
  - `docs/solutions/feature-implementations/google-maps-3d-orbit-mode-via-ctrlkey-hijack-20260415.md`
  - `docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md`
- Branch with plan 003 implementation (to be amended/extended): `feat/3d-touch-camera-lock`
