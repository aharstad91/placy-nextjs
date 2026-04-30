---
title: "Touch-paritet for 3D-kart camera-lock i rapport-board"
type: feat
status: superseded
date: 2026-04-30
superseded_by: docs/plans/2026-04-30-004-feat-3d-map-mobile-rotate-buttons-plan.md
---

# Touch-paritet for 3D-kart camera-lock i rapport-board

> **Status:** Erstattet av [plan 004](2026-04-30-004-feat-3d-map-mobile-rotate-buttons-plan.md).
> Variant B (selektiv pinch-blokkering via avstand-delta) ble testet på iPhone og fungerte
> ikke i praksis — 2-finger-rotate hadde naturlige avstand-variasjoner som trigget pinch-
> blokken. Plan 004 forenkler til variant A (blokker all touchmove) og delegerer rotasjon
> til UI-knapper i `Map3DControls`.

## Overview

3D-kartet (`MapView3D` via `BoardMap3D`) har en låst kamera-opplevelse på desktop: drag = orbit rundt center, scroll-zoom blokkert, dobbeltklikk-zoom blokkert. På mobil er dette IKKE låst — brukeren kan panne fritt med én finger og pinch-zoome ut av orbit-radien. Mobil-shellen mounter samme `BoardMap`-komponent som desktop, så koden er felles — forskjellen er at låse-mekanismene er implementert som mus-event-hijack som touch-events ikke trigger.

Mål: gi mobil samme låste opplevelse som desktop, innenfor det som er teknisk mulig på touch-plattformer.

## Problem Frame

### Hvorfor mobil føles ulåst i dag

`components/map/map-view-3d.tsx:209-321` håndhever orbit-as-default ved å fange `pointerdown`/`pointermove`/`mousedown`/`mousemove` i capture-phase og spoofe `ctrlKey=true` via `Object.defineProperty`. Google's interne gesture-tolkning leser `ctrlKey` for å velge mellom PAN (ingen modifier) og ROTATE (ctrl-modifier). Resultat på desktop: alle drags blir orbit.

Touch-events har ingen `ctrlKey`-felt — `PointerEvent.ctrlKey` er alltid `false` for `pointerType === "touch"`. Hijack-en sjekker eksplisitt og returnerer tidlig (`if ((e as PointerEvent).pointerType === "touch") return;`). Touch-pan, pinch-zoom og to-finger-tilt går derfor uberørt til Google's native gesture-handling (`GestureHandling.GREEDY`). Bounds (1.5km half-side) clamper pan, men brukeren kan fortsatt skli rundt i en 3km×3km firkant og pinch-zoome innenfor altitude-grensene (150–1200m).

Pinch-zoom er eksplisitt notert som "IKKE blokkert" i `docs/solutions/feature-implementations/google-maps-3d-orbit-mode-via-ctrlkey-hijack-20260415.md`. Dette er en kjent TODO som denne planen lukker.

### Er det en god grunn til at det er slik?

Nei, det er en oversett kant — ikke et bevisst valg. Tidligere iterasjoner (dokumentert i `docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md`) forkastet JS-drevet kamera-kontroll fordi `flyCameraTo` i rAF-loop konkurrerte mot Googles WebGL-pipeline og hakket. Konklusjonen var: la Google's native gestures få lov, begrens via deklarative props (`bounds`, `minAltitude`/`maxAltitude`, `minTilt`/`maxTilt`). Dette gjelder fortsatt — vi skal IKKE prøve å bygge custom touch-rotate via JS.

Begrensningen vi har: vi kan ikke gjøre 1-finger-touch-drag om til ROTATE slik mus-drag blir. Google's touch-handler bruker ikke `ctrlKey` — den teller `TouchEvent.touches.length` for å velge gesture-type. Vi kan kun BLOKKERE bestemte touch-events i capture-phase, ikke konvertere dem.

### Konsekvens for paritet-definisjon

Desktop: 1 musedrag = orbit. Wheel = blokkert. Dblclick = blokkert.
Mobil: ingen 1-finger-gesture kan bli orbit. Det vi kan gjøre er å:
1. Blokkere 1-finger-pan (preventDefault på touchmove når `touches.length === 1`)
2. Blokkere pinch-zoom (preventDefault på touchmove når `touches.length >= 2` og avstanden mellom fingrene endres — eller bare alltid blokkere multi-touch-pinch)
3. La 2-finger-rotate-gesture overleve som mobil-ekvivalent for orbit

Dette gir samme *opplevelse* (kamera er ankret rundt eiendommen, kan ikke skli vekk eller zoome ut), men ulik *gesture* (2 fingre på mobil, 1 finger med drag på desktop). Det er den nærmeste paritet vi kan oppnå uten å kjempe mot Googles render-loop.

## Requirements Trace

- R1. Brukeren skal ikke kunne panne ut av eiendommens nabolag på mobil 3D-kart (samme låste følelse som desktop)
- R2. Brukeren skal ikke kunne pinch-zoome ut av orbit-radien (matcher desktop wheel-block + altitude-grenser)
- R3. Brukeren skal fortsatt kunne se eiendommen fra ulike vinkler på mobil — 2-finger-rotate beholdes som orbit-ekvivalent
- R4. Endringer må ikke regrere desktop-oppførsel (mus-event-hijack, dblclick-block, wheel-block)
- R5. Endringer må ikke kjempe mot Google's WebGL-pipeline (ingen JS-drevet kamera-skriving — kun event-blocking i capture-phase)

## Scope Boundaries

- **Ikke i scope:** JS-drevet touch-rotate via `flyCameraTo`/`flyCameraAround` — eksplisitt forkastet i tidligere iterasjoner som hakkete
- **Ikke i scope:** Egen mobil-spesifikk `panHalfSideKm`-verdi (bounds er allerede 1.5km og fungerer like bra på touch som mus)
- **Ikke i scope:** Endring i `BoardMap3D.tsx` eller `BoardMap.tsx` — paritet-bug-en er i `MapView3D` og fixes der
- **Ikke i scope:** Touch-paritet for andre 3D-kart (Explorer, Report-blokk) — disse bruker også `MapView3D` og får fixet gratis, men eksplisitt verifisering av deres oppførsel er ikke en del av denne planen
- **Ikke i scope:** Visuell indikasjon for brukeren om at 2-finger-rotate er tilgjengelig (gesture-hint-overlay) — kan vurderes som separat oppgave hvis brukerne sliter med å oppdage det

## Context & Research

### Relevant Code and Patterns

- `components/map/map-view-3d.tsx:209-321` — der mus-event-hijack bor. Touch-blocking skal legges som søsken til mus-handlerne i samme `useEffect`, ikke en ny effect
- `components/map/map-view-3d.tsx:332` — wrapper-divens `touch-none` (Tailwind `touch-action: none`). Allerede satt — dette hindrer browser-scroll/zoom men ikke Google's egne touch-handlers
- `components/map/map-view-3d.tsx:350` — `gestureHandling={activated ? GestureHandling.GREEDY : GestureHandling.AUTO}`. Vi rører IKKE denne — endring av mode ville påvirke desktop også
- `components/variants/report/blocks/report-3d-config.ts:19-31` — `DEFAULT_CAMERA_LOCK`. `minAltitude: 150` / `maxAltitude: 1200` håndheves natively av Google → pinch-zoom på mobil clampes vertikalt allerede, men kameraet kan fortsatt zoome innenfor det vinduet og det føles ikke låst nok
- `components/variants/report/board/BoardMap3D.tsx:43-91` — `BoardMap3D` er kun en wrapper som passer `cameraLock` videre. Ikke endring nødvendig her
- `components/variants/report/board/ReportBoardPage.tsx:79-107` — `BoardScaffold` mounter `BoardMap` ÉN gang for både mobil og desktop. Bekreftet: ingen mobil-spesifikk wrapper finnes

### Institutional Learnings

- `docs/solutions/feature-implementations/google-maps-3d-orbit-mode-via-ctrlkey-hijack-20260415.md` — dokumenterer ctrlKey-hijack-mønsteret og kaller eksplisitt ut at "Pinch-zoom på mobil er IKKE blokkert" som åpen TODO. Denne planen lukker den.
- `docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md` — dokumenterer hvorfor JS-drevet kamera-kontroll ble forkastet. Sentral guard: ikke prøv å skrive `map3d.heading = ...` i en touch-event-handler.
- `docs/solutions/ui-bugs/google-maps-3d-webgl-context-crash-touch-devices-20260415.md` — viser at touch-events kan konsumeres av `<gmp-map-3d>` shadow-DOM. Capture-phase listener må sitte på wrapper-divens lyttere, ikke på map3d-elementet selv. Mønsteret vi følger.

### External References

- Google Maps Photorealistic 3D Tiles dokumentasjon (refset via ctrlKey-hijack-mønster) — bekrefter at touch-handler bruker `TouchEvent.touches.length` til gesture-disambiguation. Ingen offentlig API for å overstyre touch-gesture-mapping. Vår eneste tilgang er event-blocking i capture-phase.

## Key Technical Decisions

- **Bruk capture-phase touch-event-blocking** istedenfor JS-drevet camera-control: Følger samme mønster som mus-event-hijack, ingen WebGL-pipeline-konflikter, ingen rAF-loops å drifte.
- **Blokker basert på `TouchEvent.touches.length`** istedenfor å sjekke gesture-type: Enklere å resonnere om, og deterministisk per finger-antall.
- **Behold `GestureHandling.GREEDY`**: Endring av denne verdien ville påvirket alle plattformer. Touch-blocking på vår side blokkerer kun det vi spesifikt ikke vil ha.
- **2-finger-rotate som mobil orbit-ekvivalent**: Akseptert ulikhet i gesture vs desktop. Alternative (blokkere alle touch-events → statisk kart) tar bort verdien av 3D-visning.
- **Ingen mobil-detektering via viewport-size**: Touch-event-handlers fyrer kun når brukeren faktisk bruker touch — desktop får aldri besøk fra dem. Eksplisitt mobil-gating ville krevd `useIsDesktop`-prop-drilling som er unødvendig.

## Open Questions

### Resolved During Planning

- **Skal vi lage egen mobil-`panHalfSideKm`?** Nei — bounds er allerede 1.5km og håndheves natively. Det er pinch-zoom og 1-finger-pan som mangler blokkering, ikke bounds-radien.
- **Skal vi blokkere alle touch-events og gjøre kartet statisk på mobil?** Nei — det fjerner verdien av 3D. 2-finger-rotate er en akseptabel orbit-ekvivalent.
- **Skal vi endre `gestureHandling`-mode?** Nei — det er global og ville påvirke desktop. Touch-blocking på vår side er presis nok.

### Deferred to Implementation

- **Hvor aggressiv skal touchmove-blockingen være?** Vi vet at `touches.length === 1` skal blokkeres. For pinch (`touches.length >= 2`) er spørsmålet om vi skal blokkere ALL multi-touch (som da også dreper 2-finger-rotate vi ønsker å beholde) eller kun pinch-spesifikk bevegelse (sjekke om finger-avstanden endres). Implementering må teste begge på faktisk enhet — start enkelt med "blokker kun 1-finger-pan, la multi-touch passere" og legg til pinch-spesifikk handling kun hvis brukerne fortsatt zoomer ut av orbit.
- **`touch-action: none` på wrapper og `<gmp-map-3d>`**: Wrapper har `touch-none` (`map-view-3d.tsx:332`). Map3D-elementet selv har `touchAction: "none"` i style-prop (linje 351). Begge er allerede der — implementering verifiserer at preventDefault på vår handler faktisk når Google's interne handler først.
- **Test på faktisk iOS-enhet**: WebKit's håndtering av touch-events i shadow-DOM kan avvike fra Chrome Android. Implementering må verifisere på begge.

## Implementation Units

- [ ] **Unit 1: Touch-event-blocking for 1-finger-pan**

**Goal:** Hindre at 1-finger-drag på touch panner kameraet utenfor orbit-radien. Følger samme capture-phase-mønster som eksisterende mus-event-hijack.

**Requirements:** R1, R4, R5

**Dependencies:** Ingen — selvstendig endring i én fil.

**Files:**
- Modify: `components/map/map-view-3d.tsx`

**Approach:**
- Inne i den eksisterende `useEffect` som setter opp orbit-hijack (linje 209-321), legg til en `blockSingleTouchPan`-handler som registreres på `touchmove` med capture: true, passive: false
- Handler-en sjekker `e.touches.length === 1` og kaller `e.preventDefault()` + `e.stopPropagation()` for å hindre at Google's interne touch-handler tolker det som pan
- Multi-touch (rotate, tilt, pinch) passerer uberørt — vi rører kun single-touch
- Cleanup-funksjonen i samme `useEffect` må fjerne den nye handler-en (matchende `removeEventListener` med samme options)
- Touch-handler-en gates på `activated`-prop på samme måte som mus-handlere — passiv preview skal ikke blokkere noe

**Patterns to follow:**
- `forceOrbitGesture` og `blockZoomWheel` i samme effect (`map-view-3d.tsx:214-236`) — samme capture+passive: false-mønster
- `docs/solutions/feature-implementations/google-maps-3d-orbit-mode-via-ctrlkey-hijack-20260415.md` — capture-phase, før Google's shadow-DOM-listenere

**Test scenarios:**
- Happy path: På mobil 3D-kart, 1-finger-drag skal ikke flytte kameraet (heading/center forblir uendret). Verifisert via manuell test på iOS Safari og Chrome Android.
- Edge case: 1-finger-drag som starter og ender raskt (tap) skal IKKE blokkere POI-marker-klikk. Verifiser at `pointerdown`-blokkeringen vår ikke påvirker click-eventet på `Marker3D`.
- Integration: Etter at 1-finger-pan er blokkert, skal 2-finger-rotate fortsatt fungere — verifiser at to fingre rundt eiendommen orbiterer kameraet.
- Regression: På desktop med mus skal eksisterende ctrlKey-hijack ikke endres — drag = orbit som før, wheel og dblclick blokkert som før.
- Regression: I passiv preview-modus (`activated={false}`) skal ingen touch-events blokkeres (preview er ikke-interaktivt uansett, men handler-en skal ikke installeres).

**Verification:**
- På faktisk mobil enhet: 1-finger-drag flytter ikke kameraet i 3D-modus. 2-finger-rotate orbiterer kameraet. Mus-drag på desktop orbiterer som før.

- [ ] **Unit 2: Pinch-zoom-blocking på touch**

**Goal:** Hindre at pinch-gesture zoomer kameraet ut av orbit-radien. Matcher desktop wheel-block.

**Requirements:** R2, R4, R5

**Dependencies:** Unit 1 — pinch-blocking legges som søsken-handler i samme effect.

**Files:**
- Modify: `components/map/map-view-3d.tsx`

**Approach:**
- Detektere pinch krever sammenligning av finger-avstand mellom touchstart og touchmove. To valg å vurdere i implementering:
  - **A (enkel):** Blokker ALL multi-touch-bevegelse via `touchmove`-handler som sjekker `touches.length >= 2` og preventDefault-er. Konsekvens: 2-finger-rotate dør også. Da blir mobil 3D effektivt statisk.
  - **B (selektiv):** Beregn avstanden mellom de to første fingrene ved hver `touchmove`. Hvis den endres med mer enn N px sammenlignet med touchstart, preventDefault. Bevarer rotate (der avstanden er konstant).
- Start med Variant B fordi den bevarer rotate som orbit-ekvivalent. Hvis det viser seg vanskelig å skille pinch fra rotate på faktisk enhet, fall tilbake til Variant A og dokumenter beslutningen.
- Trygg sak: tilt (to fingre som beveger seg parallelt vertikalt) kan også produsere altitude-endring — vurder om det skal blokkeres. Min/maxAltitude (150/1200m) håndheves natively av Google, så altitude-clamp er allerede der; ekstra tilt-blokk er sannsynligvis unødvendig.

**Patterns to follow:**
- Samme capture+passive: false-options som wheel-blockeren (`map-view-3d.tsx:295-307`)
- Bruk `touchstart` til å lagre initial avstand i en `useRef`, og `touchmove` til å sammenligne — unngå closure over state for å holde det allokering-fritt
- Cleanup-funksjonen skal fjerne både `touchstart` og `touchmove`-listenere

**Test scenarios:**
- Happy path: Pinch-out på mobil 3D-kart skal ikke zoome — kameraet beholder samme range/altitude
- Happy path: Pinch-in skal ikke zoome inn forbi minAltitude
- Edge case: Tre eller flere fingre — handler-en skal håndtere `touches.length >= 2` uten å kaste; unngå out-of-bounds på `touches[1]`
- Edge case: Brukeren starter med to fingre, fjerner én, fortsetter med én — dette skal flytte over i 1-finger-pan-blokkering (Unit 1) uten lekkasje av pinch-state
- Integration: Pinch og 2-finger-rotate i samme drag-sekvens — implementering må velge tydelig hvilken som vinner. Hvis Variant B brukes, valg av tærskel (`N px`) avgjør dette
- Regression: Desktop scroll-wheel forblir blokkert som før

**Verification:**
- På faktisk mobil enhet: pinch-out og pinch-in flytter ikke kameraets altitude. 2-finger-rotate orbiterer kameraet.

- [ ] **Unit 3: Oppdater institutional learning**

**Goal:** Oppdater `docs/solutions/feature-implementations/google-maps-3d-orbit-mode-via-ctrlkey-hijack-20260415.md` med løsningen for touch-blocking, slik at TODO-en "Pinch-zoom på mobil er IKKE blokkert" lukkes.

**Requirements:** R1, R2 (kunnskap-vedlikehold)

**Dependencies:** Unit 1, Unit 2 (kun oppdateres etter at touch-blocking er implementert og verifisert)

**Files:**
- Modify: `docs/solutions/feature-implementations/google-maps-3d-orbit-mode-via-ctrlkey-hijack-20260415.md`

**Approach:**
- Legg til seksjon "Touch-paritet" som dokumenterer:
  - Hvorfor ctrlKey-hijack ikke fungerer på touch (TouchEvent har ikke ctrlKey)
  - Hvilken løsning vi valgte (capture-phase touchmove-blocking på 1-finger-pan + pinch)
  - Akseptert avvik: 2-finger-rotate er mobil orbit-ekvivalent
  - Variant A vs B-valget hvis vi måtte falle tilbake
- Oppdater "Gotchas" → "Touch har ikke `ctrlKey`"-seksjonen til å peke på den nye løsningen istedenfor å være en TODO

**Test expectation: none -- ren dokumentasjons-oppdatering uten kodeoppførsel.**

**Verification:**
- Dokumentet refererer til den oppdaterte koden i `map-view-3d.tsx` og forklarer beslutningene (særlig variant-valget).

## System-Wide Impact

- **Interaction graph:** `MapView3D` brukes av tre kart-renderere: `BoardMap3D` (rapport-board), `ReportThemeSection` / `ReportOverviewMap` (statisk rapport-blokk), Explorer 3D-modus (hvis aktivert). Alle får touch-paritet gratis. Verifisering for andre kart-overflater er ikke i scope, men ingen regresjons-risiko forventes — endringen blokkerer kun touch-events i capture-phase.
- **Error propagation:** Touch-handler-feil (f.eks. `TouchEvent.touches[1]` på en single-touch event) ville kaste og dermed ikke nå `preventDefault`. Beskyttelse: tidlig return på `touches.length` før indeksering.
- **State lifecycle risks:** Pinch-state (initial avstand i `useRef`) må nullstilles når alle fingre løftes (`touchend`/`touchcancel`). Glemt cleanup → første pinch i neste drag-sekvens sammenlignes mot gammel referanse → falsk pinch-deteksjon.
- **API surface parity:** Endringen lever i `MapView3D` og er transparent for konsumenter — ingen prop-endringer. Ingen TypeScript-overflater berørt.
- **Integration coverage:** Manuell test på faktisk mobil enhet (iOS Safari + Chrome Android) er obligatorisk — Vitest jsdom kan ikke simulere WebGL eller Google Maps 3D, så automatisert dekning er begrenset.
- **Unchanged invariants:** Desktop mus-event-hijack, wheel-blocking, dblclick-blocking, bounds, altitude-grenser, tilt-grenser — alle uendret.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `preventDefault` på touchmove kan ikke nå Google's interne handler i tide (samme problem som ledet til capture-phase for mus) | Bruk capture: true + passive: false, akkurat som wheel-blockeren. Verifiser med console-log at vår handler kjører før Google's center-change fyrer. |
| Pinch vs rotate er vanskelig å skille på faktisk enhet | Variant A (blokker all multi-touch) som fallback dokumentert. Brukerne mister rotate, men det er en akseptabel kostnad hvis variant B viser seg upålitelig. |
| iOS-spesifikke quirks (gesture-passive bug, eldre WebKit) | Test på iOS Safari spesifikt før merge. `touch-action: none` på wrapper er allerede satt og hjelper. |
| Tilt via to-finger-vertikal-drag kan zoome via altitude-endring | minAltitude/maxAltitude håndheves natively → naturlig clamp. Hvis det fortsatt føles som zoom, vurder å skjerpe altitude-vinduet (men gjør det som separat oppgave). |
| Andre 3D-kart-overflater (Explorer, Report-blokk) får uventet touch-blocking | Ingen — touch-blocking gjelder kun når `activated === true`, som er konsistent med eksisterende orbit-hijack. Samme aktiverings-gate. |

## Documentation / Operational Notes

- Etter implementasjon, oppdater `docs/solutions/feature-implementations/google-maps-3d-orbit-mode-via-ctrlkey-hijack-20260415.md` (Unit 3) — TODO-en der ("pinch-zoom på mobil er IKKE blokkert") skal lukkes med peker til den nye implementasjonen.
- Hvis variant B (selektiv pinch-deteksjon) ikke fungerer på iOS, dokumenter beslutningen om å falle tilbake til variant A i samme læringsdokument.
- Manuell QA-sjekkliste for før-merge:
  - Mobil iOS Safari: 1-finger-drag flytter ikke kamera, pinch flytter ikke altitude, 2-finger-rotate orbiterer
  - Mobil Chrome Android: samme tre punkter
  - Desktop Chrome/Firefox/Safari: mus-orbit, wheel-block, dblclick-block uendret
  - Passiv preview (Explorer-side med 3D inne i et lite preview-vindu): ingen interaksjon mulig (samme som før)

## Sources & References

- Origin: brukerens skjermbilde (mobil 3D-kart med fri pan + pinch synlig) + spørsmål om paritet med desktop
- Related code: `components/map/map-view-3d.tsx`, `components/variants/report/board/BoardMap3D.tsx`, `components/variants/report/board/ReportBoardPage.tsx`
- Related learnings:
  - `docs/solutions/feature-implementations/google-maps-3d-orbit-mode-via-ctrlkey-hijack-20260415.md`
  - `docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md`
  - `docs/solutions/ui-bugs/google-maps-3d-webgl-context-crash-touch-devices-20260415.md`
- Related plan: `docs/plans/2026-04-30-002-feat-3d-map-disable-dblclick-default-tilt-plan.md` (samme fil-cluster, samme mønster)
