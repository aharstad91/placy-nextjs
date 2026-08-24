---
title: "feat: Satelitt-modus i boardets kart-veksler"
type: feat
status: active
date: 2026-08-24
origin: docs/brainstorms/2026-08-24-satelitt-modus-kart-veksler-requirements.md
---

# feat: Satelitt-modus i boardets kart-veksler

## Overview

Kart-veksleren på rapport-boardet får et tredje segment: «Kart | Satelitt | 3D». Satelitt er Google 3D-motoren sett rett ovenfra (tilt 0°, nord opp) — en vedvarende, director-eid kameratilstand, ikke en ny kartmotor. Satelitt↔3D veksles med én myk kameraflyvning; Kart↔(Satelitt/3D) forblir dagens motorbytte. Boards med 3D-tillegg men uten voice-over åpner i Satelitt; basic-introen beholder banen sin men lander ovenfra.

## Problem Frame

Boardet mangler rett-ovenfra-orienteringen folk kjenner fra Google Maps satellitt og FINN-kartet — den letteste visningen å orientere seg i. Satellittbildet finnes allerede i 3D-motoren; det som mangler er kameraposituren og en tilstand som holder den. (Se origin: `docs/brainstorms/2026-08-24-satelitt-modus-kart-veksler-requirements.md` — alle R-referanser under peker dit.)

## Requirements Trace

- R1. Tredje segment «Kart | Satelitt | 3D» i alle veksler-flater; kun boards med `has3dAddon`.
- R2. Satelitt↔3D = myk kameraflyvning i Google-motoren; Kart↔resten = dagens motorbytte.
- R3. Satelitt = tilt ≈ 0°, nord opp.
- R4. Auto-orbit av i Satelitt; Auto/Fri-segmentet skjult.
- R5. POI-/kategoriklikk i Satelitt gir NY director-eid flyvning: pan+zoom, tilt 0, heading 0.
- R6. 3D-addon-boards uten voice-over åpner i Satelitt; basic-introen beholder bane/reveal men lander ovenfra; segmentet viser «Satelitt» under og etter.
- R7. VO-boards åpner som i dag; manuelt Satelitt-valg etterpå respekteres.
- R8. Satelitt som vedvarende tilstand: (a) director-flyvninger klampes til tilt/heading 0, (b) VO-beats vinner mens de spiller og Satelitt gjenopprettes etterpå, (c) manuell tilt-/rotasjonsdrag flipper segmentet til «3D», (d) retur til 3D gjenopptar forrige kameramodus.
- R9. Veksler under flyvning: optimistisk aktivt segment, mid-flight-klikk avbryter og omdirigerer, aktivt segment er no-op.
- R10. Modusvalg er in-memory per sesjon; overlever navigasjon/«Vis alle»/Kart-mellomsteg; ingen URL-param.

## Scope Boundaries

- Ingen Mapbox satellitt-stil; ingen ny tile-kilde eller motor.
- Boards uten 3D-tillegg er uendret (ren Mapbox, ingen veksler).
- Flyturenes sweep/varighet/reveal og orbit-koreografi urørt — avviket er basic-introens tilt-profil og landingspositur på Satelitt-default-boards.
- Ingen markør-/label-endringer (tier-terskler gjelder uendret — `lib/board/camera-zoom.ts` leser skalaen tilt-uavhengig med vilje).

### Deferred to Separate Tasks

- Instrumentering av modus-veksling (fra/til-event) for å etterprøve Satelitt-default-hypotesen: eget lite tiltak i Moat 2-sporet, tas etter at featuren lever.

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/board/BoardMap.tsx` — eier `view`-state (linje ~178: `useState<"2d" | "3d">(has3dAddon ? "3d" : "2d")`), `handleModeChange` (~711) med kamera-bro `rangeToZoom`/`zoomToRange` (`lib/utils/camera-map.ts`), `handleDragTakeover` (~227), `hasVoiceOver` beregnes samme sted (~189).
- `components/variants/report/board/BoardMapControls.tsx` — `VIEW_OPTIONS` («Kart»/«3D»), `showCamera = view === "3d" && showCameraMode`, delt `controlsBody` mellom full pille og collapsed ⚙-FAB (tredje segment dukker automatisk opp begge steder).
- `components/variants/report/board/board-3d-camera-director.ts` — `decideCameraIntent` (ren funksjon; ORBIT_TILT 50, POI_TILT 60, SUMMARY_TILT 52), no-op i «free». **Clamp-punktet.**
- `components/variants/report/board/use-board-3d-camera.ts` — eneste eksekverer av director-intents. Token-en er en PRIVAT ref som kun guarder hookens egne utsatte callbacks — den er ikke en gjenbrukbar kanselleringsmekanisme utenfra; sat↔3d-flyvningen må derfor bo i director-strømmen (se Key Technical Decisions).
- `components/variants/report/board/board-flythrough-orchestrator.ts` + `board-intro-flythrough.ts` — basic-intro: `buildBasicIntroPath(orbitRange)` lander i dag på tilt 52/heading start+90; `introPoseAt` er ren og testet. Outro-summary-flyet (skriver utenom director) ligger i orkestratoren.
- `BoardMap3D.tsx` (~455–480) — drag-takeover-lytteren (pointerdown/wheel/touchstart) som i dag flipper Auto→Fri; mønsteret for R8c.
- Union-typen `"2d" | "3d"` finnes KUN i `BoardMap.tsx`, `BoardMapControls.tsx` (+ tester) — utvidelsen er lokal.

### Institutional Learnings

- `docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md` — flyCameraTo 300–500 ms for diskrete UI-overganger; ALDRI JS-snap-back mot WebGL-pipelinen; kopier LatLngAltitude eksplisitt (getters); UI som søsken til gmp-map-3d.
- `docs/solutions/feature-implementations/google-maps-3d-intro-flythrough-20260603.md` — flythrough drives rAF/raw-props (ikke chained flyCameraTo); director yield-er via `introActive`; landing-handoff må matche directorens neste intent (ellers hopp).
- `docs/solutions/performance-issues/webgl-context-leak-per-render-probe-20260603.md` — gmp-map-3d unmountes ALDRI; Satelitt MÅ gjenbruke samme instans. Verifisering: telle unike WebGL-canvas i frisk Chrome.
- `docs/solutions/feature-implementations/google-maps-3d-orbit-mode-via-ctrlkey-hijack-20260415.md` — OBS: hijacken dokumentet beskriver er senere FJERNET (boardet kjører alltid freeMode; `map-view-3d.tsx` ~332). Drag er native pan i dag — ingen hijack å skru av i Satelitt.
- `docs/solutions/ui-bugs/google-maps-3d-marker-template-swap-spokelser-20260823.md` — aldri bytt Marker3D-komponenttype (spøkelses-teksturer); ingen markør-endringer i denne planen.
- `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md` — spam-click-guard på motor-toggle + zoom↔range-konvertering.
- `lib/board/camera-zoom.ts` (rationale i fila) — tier-avlesning er tilt-uavhengig; ved tilt 0 er den eksakt. Ingen nye terskler.

## Key Technical Decisions

- **View-typen utvides til `"2d" | "sat" | "3d"`** i BoardMap/BoardMapControls; `showMapbox`-/`isFront`-/`publishViewport`-gates endres fra `view === "3d"` til `view !== "2d"` der de betyr «Google-motoren er front». `showCamera` (Auto/Fri) forblir `view === "3d"` — det gir R4 gratis.
- **Clamp-arkitektur (R8a)**: `decideCameraIntent` får en `overhead: boolean`-input. I overhead produseres KUN pan+zoom-poser med tilt/heading 0: POI-intent klampes; kategori-klikk gir en poi-lignende pan+zoom-intent (ALDRI cinematic, ALDRI cut — auto-utledede kategorikameraer skiller seg kun i heading ±12°, så en klampet cinematic ville kollapse til et dødt stillbilde bak cut-fade i opptil 16 s); idle er en egen overhead-hvile-INTENT med pose (senter/range fra gjeldende kamera eller hvileposituren) — ikke en fri-hold-no-op, ellers har 2D→sat-i-auto, welcome-beat-slutt og beat-gjenoppretting ingen skriver som etablerer tilt 0. De to skriverne utenfor directoren håndteres separat: outro-summary-flyet klampes i orkestratoren, basic-intro-landingen i path-builderen. Flythrough-BANER røres ikke.
- **I Satelitt er directoren aktiv også på basic-boards** (som i dag står i «free» uten flyvninger): overhead-tilstanden er director-eid, så POI-/kategoriklikk gir flyvning (R5 er ny oppførsel — se origin).
- **Satelitt↔3D-overgangen eies av directoren** — view/overhead er director-input, og overgangen materialiserer som ett `flyCameraTo`-kall (~500 ms, ny konstant, finjusteres i akseptansen; læringsdokumentet fraråder rAF-choreografi for diskrete UI-overganger). Eierskapet er poenget: en flyvning startet i `handleModeChange` ville blitt drept av director-effektens `stopCameraAnimation` når overhead-dep-en endres (to konkurrerende skrivere), og hookens token-kansellering er IKKE tilgjengelig utenfra (privat ref som kun guarder hookens egne utsatte callbacks). Inne i directoren gjelder token-mønsteret, og R9s avbryt-og-omdiriger følger av at et nytt `flyCameraTo` erstatter det pågående. Cut-transition (`cutVisible`) skal ALDRI fyre på en ovenfra↔skrå-overgang — prevIntent-håndteringen må unnta den. Sat→3d-målet er en RE-EVALUERING av intents med overhead=false (åpen POI → uklampet POI-pose; ellers behold brukerens gjeldende senter/range og løft tilt til ORBIT_TILT) — aldri en lagret klampet pose, aldri hjem-teleport etter at brukeren har panorert.
- **Default-regel i eksisterende initializer**: `has3dAddon ? (hasVoiceOver ? "3d" : "sat") : "2d"` — `hasVoiceOver` er alt tilgjengelig i BoardMap; ingen ny plumbing, ingen konfig (R6/R7).
- **Tilt-drift-deteksjon (R8c)**: drag er ALLEREDE pan — boardet kjører alltid freeMode med Googles native gesture-modell, og den gamle ctrlKey-orbit-hijacken er FJERNET fra koden (`map-view-3d.tsx` ~332: «var no-op i freeMode og er derfor fjernet»). Unit 4 er derfor kun drift-observasjon: etter pointer-grab i sat, observer faktisk tilt-/heading-avvik over terskel (~5°, heading med 0/360-wraparound) → flipp segmentet til «3D». Pan-drag forblir Satelitt. I sat undertrykkes samtidig dagens grab-takeover (auto→free) og free-hinten — ellers klobber én pan cameraMode på VO-boards og R8d gjenoppretter feil modus; forrige cameraMode snapshotes ved sat-inngang og gjenopprettes ved retur til 3D.
- **Satelitt-hvileposituren gjenbruker orbitRange** (spread-skalert fra `useBoardMarkerSet`) med tilt 0/heading 0 — samme innramming som i dag, og tier-valget er stabilt per camera-zoom-designet.

## Open Questions

### Resolved During Planning

- Hvileposituren (range/høyde): gjenbruk spread-skalert orbitRange — samme kilde som dagens intro-landing; ingen ny fit-logikk.
- Segmentbredde mobil: view-knappene er thumb-løse px-knapper; tre segmenter verifiseres på 320 px i akseptansen (Unit 6), med tettere padding som fallback — ikke kortere label.
- Kart-mellomsteg (R10): med tre segmenter velger brukeren eksplisitt retur-modus; ingen minne-mekanikk trengs utover å ikke resette view-state.

### Deferred to Implementation

- Eksakt flyvningsvarighet Satelitt↔3D og ev. egen POI-range i Satelitt (start med `POI_RANGE`): tunes visuelt i akseptansen — tallene kan ikke velges uten å se ekte tiles.
- Tilt-drift-terskelen (~5°) og om flippen trenger et hint («Du ser nå i 3D»): avgjøres når interaksjonen kan kjennes på.

## Implementation Units

- [ ] **Unit 1: View-modellen «sat» + tredje segment i veksleren**

**Goal:** `"sat"` som gyldig view-verdi med «Satelitt»-segment i pillen og FAB-popoveren.

**Requirements:** R1, R3 (statisk positur), R4, R10

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/board/BoardMap.tsx`
- Modify: `components/variants/report/board/BoardMapControls.tsx`
- Test: `components/variants/report/board/BoardMapControls.test.tsx`, `components/variants/report/board/BoardMap.test.tsx`

**Approach:**
- Utvid union-typen og `VIEW_OPTIONS` (label «Satelitt», aria «Satellitt ovenfra»); rekkefølge Kart | Satelitt | 3D.
- Gates: `showMapbox = !has3dAddon || view === "2d"` (uendret semantikk), `isFront`/`publishViewport` → `view !== "2d"`; `showCamera` forblir `view === "3d"`.
- Kart↔Satelitt motorbytte gjenbruker dagens bro: 2D→sat lander tilt 0/heading 0 på konvertert range; sat→2D er eksakt (`rangeToZoom` med tilt 0).

**Patterns to follow:** Dagens `VIEW_OPTIONS`-segmentmønster; spam-guard fra unified-map-modal-læringen.

**Test scenarios:**
- Happy path: tre segmenter rendres med riktige labels/aria når `showViewToggle`; klikk «Satelitt» kaller `onViewChange("sat")`.
- Happy path: Auto/Fri-segmentet er skjult når view er «sat» (R4).
- Edge case: `showViewToggle=false` → ingen segmenter (uendret).
- Integration (BoardMap.test): `lastControls()` viser view-flyt for «sat»; showMapbox er false når view er «sat».

**Verification:** Segmentet synlig i både full pille og ⚙-popover; veksling Kart↔Satelitt fungerer som dagens motorbytte.

- [ ] **Unit 2: Satelitt↔3D-kameraflyvningen + veksler-tilstand under flyvning**

**Goal:** Ett mykt `flyCameraTo` mellom ovenfra og skrå; optimistisk segment; avbryt-og-omdiriger.

**Requirements:** R2, R9

**Dependencies:** Unit 1

**Files:**
- Modify: `components/variants/report/board/board-3d-camera-director.ts` (overhead-input, ny varighetskonstant, overhead-hvilepose)
- Modify: `components/variants/report/board/use-board-3d-camera.ts` (overhead↔skrå-overganger uten cut)
- Modify: `components/variants/report/board/BoardMap.tsx` (handleModeChange: sat↔3d endrer bare view-state — flyvningen eies av director-strømmen)
- Test: `components/variants/report/board/BoardMap.test.tsx`, `components/variants/report/board/board-3d-camera-director.test.ts`

**Approach:**
- sat↔3d er IKKE motorbytte: samme instans, og flyvningen eies av DIRECTOREN (overhead som input) — en flyvning startet i handleModeChange ville blitt drept av director-effektens stopCameraAnimation når dep-ene endres. Ett `flyCameraTo` (~500 ms).
- Mål sat: behold senter/range, tilt/heading → 0. Mål 3d: re-evaluer intents med overhead=false (åpen POI → uklampet POI-pose; ellers behold brukerens senter/range, tilt → ORBIT_TILT) — aldri lagret klampet pose, aldri hjem-teleport etter panorering.
- Cut-overlayen (`cutVisible`) fyrer ALDRI på ovenfra↔skrå — prevIntent-unntaket testes eksplisitt.
- `setView` settes umiddelbart ved klikk (optimistisk); nytt segment-klikk mid-flight erstatter pågående flyvning (nytt flyCameraTo, best-effort stopCameraAnimation); klikk på aktivt segment no-op.
- Kopier LatLngAltitude-felt eksplisitt ved bygging av endCamera (getters-fella).

**Test scenarios:**
- Happy path: klikk «Satelitt» fra 3D → flyCameraTo mot tilt 0/heading 0 med ny varighetskonstant; view er «sat» umiddelbart.
- Happy path: klikk «3D» fra sat → flyr tilbake til skrå positur; etter panorering i sat beholdes brukerens senter (ingen hjem-teleport).
- Edge case: dobbeltklikk samme segment → én flyvning (no-op på aktivt).
- Error path: segment-bytte mid-flight → forrige flyvning erstattes, ny startes.
- Integration: 2D→sat med cameraMode «auto» → kameraet ender på tilt 0-positur (broen er free-gatet i dag — må også dekke auto).
- Integration: sat→3d på idle auto-board → ÉN myk flyvning, `cutVisible` fyrer aldri.

**Verification:** Overgangen oppleves som én kontinuerlig bevegelse i browser; ingen kutt/reload.

- [ ] **Unit 3: Director-eid overhead-tilstand (clamp + VO-beats + gjenoppretting)**

**Goal:** Alle kamera-skrivere respekterer Satelitt: director-intents klampes; outro klampes; VO-beats vinner og Satelitt gjenopprettes.

**Requirements:** R5, R8a, R8b, R8d

**Dependencies:** Unit 1–2

**Files:**
- Modify: `components/variants/report/board/board-3d-camera-director.ts` (overhead-input i `decideCameraIntent`)
- Modify: `components/variants/report/board/use-board-3d-camera.ts` (send overhead fra view-state)
- Modify: `components/variants/report/board/board-flythrough-orchestrator.ts` (outro-clamp + gjenoppretting etter beat)
- Modify: `components/variants/report/board/BoardMap.tsx` / `BoardMap3D.tsx` (prop-flyt)
- Test: `components/variants/report/board/board-3d-camera-director.test.ts`, `components/variants/report/board/board-flythrough-orchestrator.test.ts`

**Approach:**
- `decideCameraIntent({ ..., overhead })`: poi-intent → tilt/heading 0 (range: start med `POI_RANGE` — merk at hvileposituren bruker orbitRange, POI zoomer tettere); kategori → poi-lignende pan+zoom-intent (senter = kategoriens framing-midtpunkt, range fra config, tilt/heading 0, ALDRI kind «cinematic», ALDRI cut); idle → egen overhead-hvile-intent MED pose (aldri orbit) — R4. Fri-hold-no-op er ikke nok: uten pose har 2D→sat-i-auto og beat-gjenoppretting ingen skriver.
- I Satelitt er directoren aktiv også der cameraMode i dag er «free» (basic-boards): overhead-tilstanden eier kameraet, POI-/kategoriklikk flyr.
- VO-beats (welcome/outro) kjører uendret (introActive-yield finnes); når beaten slutter og view er «sat»: fly tilbake til overhead-hvileposituren. R8d: retur til 3D gjenoppretter forrige cameraMode (auto → orbit-re-aim).
- OBS: konstant-pinning-testen i director-testen pinner produserte tilts verbatim — utvid bevisst.

**Test scenarios:**
- Happy path: `decideCameraIntent` med overhead + åpen POI → intent med tilt 0, heading 0.
- Happy path: overhead + idle → fri-hold, aldri orbit-intent.
- Edge case: overhead + kategori-klikk → pan+zoom-intent, aldri kind «cinematic», aldri cut.
- Edge case: overhead + idle → hvile-intent med pose (tilt 0), aldri orbit.
- Integration: outro-beat i sat → summary-fly klampes; etter beat gjenopprettes overhead-positur.
- Integration: retur sat→3d på VO-board → auto-modus gjenopptas (orbit-re-aim).
- Integration: welcome-beat-slutt i sat → overhead-hvileposituren gjenopprettes.

**Verification:** POI-klikk i Satelitt panorerer/zoomer uten å tilte; VO-tour spiller uendret og slipper kameraet tilbake ovenfra.

- [ ] **Unit 4: Gestures i Satelitt — pan-drag + tilt-drift-flip**

**Goal:** Drag panorerer (nord opp bevares); faktisk tilt-/rotasjonsdrift flipper segmentet til «3D».

**Requirements:** R8c

**Dependencies:** Unit 1–3

**Files:**
- Modify: `components/variants/report/board/BoardMap3D.tsx` (takeover-lytter + tilt-observasjon)
- Test: kolokert `*.test.tsx` ved siden av kilden (board-mappens faktiske mønster; `__tests__/` brukes ikke for dette)

**Approach:**
- Drag er allerede pan (native freeMode-gestures; den gamle orbit-hijacken er fjernet fra koden) — ingen gesture-endring trengs.
- Etter pointer-grab i sat: observer `map3d.tilt`/`heading`; avvik over terskel (~5°; heading med 0/360-wraparound) → `onViewChange("3d")` (speiler Auto→Fri-takeover; ingen snap-back mot WebGL-pipelinen — læringsregel).
- Undertrykk dagens grab-takeover (auto→free) og free-hinten mens view er «sat» — cameraMode røres ikke av pan; forrige cameraMode snapshotes ved sat-inngang (R8d).
- Pillen skal aldri lyve: flippen skjer i det posituren faktisk brytes, ikke på grab.

**Test scenarios:**
- Happy path: pan-drag i sat → view forblir «sat».
- Happy path: tilt-avvik over terskel → view flipper til «3d».
- Edge case: grab uten bevegelse → ingen flip.
- Integration: pointerdown i sat på VO-board i auto → cameraMode forblir «auto», ingen free-hint.

**Verification:** To-finger-tilt/ctrl-drag i browser flipper segmentet; vanlig pan gjør det ikke.

- [ ] **Unit 5: Satelitt-default + basic-intro lander ovenfra**

**Goal:** 3D-addon-boards uten voice-over åpner i Satelitt; «Utforsk nabolaget»-introen beholder bane/reveal men lander tilt 0/heading 0.

**Requirements:** R6, R7

**Dependencies:** Unit 1–4 (default-Satelitt skal aldri shippes uten drift-flippen — ellers kan pillen lyve i default-tilstanden på hvert basic-board)

**Files:**
- Modify: `components/variants/report/board/BoardMap.tsx` (init: `has3dAddon ? (hasVoiceOver ? "3d" : "sat") : "2d"`; OBS: `hasVoiceOver`-useMemo-en er i dag deklarert ETTER view-useState-en — flytt den opp, ellers TDZ-feil)
- Modify: `components/variants/report/board/board-intro-flythrough.ts` (landingsvariant: tiltEnd 0, heading-slutt 0)
- Modify: `components/variants/report/board/board-flythrough-orchestrator.ts` (velg variant når view er «sat»)
- Test: `components/variants/report/board/board-intro-flythrough.test.ts` (buildBasicIntroPath-suiten, linje ~153), `BoardMap.test.tsx`

**Approach:**
- Landingsvarianten er parametre på `buildBasicIntroPath` — sweep/varighet/reveal urørt. To realiteter fra koden: `headingEnd` finnes ikke som felt (heading = startHeading + sweep·s, så headingEnd 0 realiseres som `startHeading = −sweepDeg`), og `staticOnly` (reducedMotion) holder banens STARTpose — overhead-varianten må derfor enten klampe tiltStart også, eller la staticOnly bruke landingsposen (s=1). Merk: med tiltEnd 0 interpolerer introen tilt 57→0, så mellompositurene blir mer ovenfra enn i dag — «bane urørt» gjelder sweep/varighet/reveal, ikke tilt-profilen.
- Handoff-regelen fra intro-læringen: directorens første intent etter END_INTRO må matche landingen (overhead fri-hold) — ellers hopp. Unit 3 gir dette.
- VO-boards: init uendret («3d»), introer uendret.

**Test scenarios:**
- Happy path: `buildBasicIntroPath` med overhead-landing → siste pose tilt 0, heading 0, range = orbitRange.
- Happy path: BoardMap init — addon uten VO → «sat»; addon med VO → «3d»; uten addon → «2d».
- Edge case: `reducedMotion` (staticOnly) → statisk ovenfra-positur uten flytur.
- Integration: etter END_INTRO i sat skjer ingen kamera-bevegelse (fri-hold matcher landingen).

**Verification:** Strindfjordvegen-boardet (basic) åpner ovenfra, intro avslører pins og lander ovenfra; StasjonsKvartalet (VO) uendret.

- [ ] **Unit 6: Akseptanse i frisk Chrome + falsifiseringssjekk**

**Goal:** Verifisere hele opplevelsen mot ekte tiles og teste satelitt-antakelsen med definert utfall.

**Requirements:** Success criteria + Dependencies/Assumptions i origin

**Dependencies:** Unit 1–5

**Files:**
- Test: manuell/scriptet verifisering via chrome-devtools MCP (worktree-server på egen port)

**Approach & verification (outcomes):**
- TIDLIG CHECKPOINT (før Unit 2 bygges): kjør falsifiseringssjekken som en ~30-min spike — sett dagens 3D-kart manuelt til tilt 0 i konsollen og sammenlign side-om-side mot Google Maps satellitt: (1) tile-skarphet range ~800–1600 m, (2) mesh-artefakter trær/tak, (3) perspektiv-lening ved skjermkant. Feiler den → STOPP, beslutning tilbake til Andreas (omdøpe til «Ovenfra» eller gjenåpne Mapbox-satellitt) — ikke implementér fallback på egen hånd, og ikke bygg Unit 2–5 på en falsifisert premiss. Gjenta sjekken i full akseptanse til slutt.
- Kamera-props samples over tid for sat↔3d-flyvningen (jevn bane, riktig endepose); tune varighet/POI-range visuelt.
- WebGL-helse: telle unike canvas i frisk Chrome (persistent-3D-regelen).
- Labels/pins/declutter ved tilt 0 (nylig kalibrert mot skrå — eksplisitt sjekk), mini-popups, «Ramm inn».
- Mobil: tre segmenter i kompakt pille på 320 px + ⚙-popover; 0 konsollfeil.

## System-Wide Impact

- **Interaction graph:** view-state → BoardMapControls, BoardMap3D-gates (isFront/publishViewport), director-input, flythrough-orkestrator, drag-takeover. Alle endringer går gjennom eksisterende prop-flyt; ingen ny store.
- **State lifecycle:** view er in-memory (R10) — reload gir default-regelen; ingen persistens-lag røres.
- **API surface parity:** ⚙-FAB-popoveren deler `controlsBody` med full pille — tredje segment kommer automatisk begge steder; event-mobile-sheet (compact) verifiseres i Unit 6.
- **Unchanged invariants:** persistent-3D (aldri unmount), Mapbox-overlay-mønsteret, tier-terskler (camera-zoom er tilt-uavhengig), flythrough-baner, markør-komponenttyper, Auto/Fri-semantikken i 3D.
- **Integration coverage:** intro-landing→director-handoff (Unit 5), VO-beat→gjenoppretting (Unit 3) — begge er kryss-lags og dekkes av integrasjonsscenarier, ikke bare enhetstester.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Photorealistic ovenfra bærer ikke «satelitt»-merkelappen (skarphet/mesh/lening) | Falsifiseringssjekk i Unit 6 med definert eskalering til produkteier; ingen stille fallback |
| Director-clamp kolliderer med verbatim-pinnede konstanter i tester | Utvid pinning-suiten bevisst i Unit 3, ikke omgå den |
| Tilt-drift-deteksjon blir følsom/støyende | Terskel + kun etter pointer-grab; tunes i Unit 6; ingen snap-back |
| Tre segmenter sprenger kompakt pille på 320 px | Verifiseres i Unit 6; fallback = tettere padding, ikke kortere label |
| Kamera-hopp ved intro-landing→director-handoff | Handoff-regelen fra intro-læringen: første intent matcher landingsposituren (integrasjonstest i Unit 5) |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-08-24-satelitt-modus-kart-veksler-requirements.md](../brainstorms/2026-08-24-satelitt-modus-kart-veksler-requirements.md)
- Related code: `components/variants/report/board/BoardMap.tsx`, `BoardMapControls.tsx`, `board-3d-camera-director.ts`, `board-intro-flythrough.ts`, `board-flythrough-orchestrator.ts`, `use-board-3d-camera.ts`, `lib/utils/camera-map.ts`, `lib/board/camera-zoom.ts`
- Learnings: se «Institutional Learnings» over (7 docs)
