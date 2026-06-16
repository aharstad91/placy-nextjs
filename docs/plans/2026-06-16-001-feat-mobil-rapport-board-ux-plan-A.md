---
title: "feat: Mobil rapport-board — fundament (state-modell + transport + quick-wins)"
type: feat
status: active
date: 2026-06-16
origin: docs/brainstorms/2026-06-16-mobil-rapport-board-ux-requirements.md
---

# Mobil rapport-board — Plan A (fundament)

> Del 1 av 2. **Plan B** (`docs/plans/2026-06-16-002-feat-mobil-rapport-board-ux-plan-B.md`) dekker teaser, ⚙ FAB og edge-cases (R17–R22) og bygger på fundamentet her.

## Overview

Rebygg mobil-interaksjonsmodellen for rapport-boardet til **to fullskjerm-flater (historie ↔ kart) med én vedvarende avspiller-transport**. Plan A legger fundamentet: uavhengige quick-wins først (så prototypen er testbar tidlig og ikke kan låse seg), deretter selve state-modellen som erstatter det 5-verdis `ReelsPhase`-enumet, transport-baren (gjenbruk av `StoryProgressBar`), og omskrivingen av mobil-laget i `ReportReelsPage.tsx`.

## Problem Frame

Mobil presser narrativ avspilling og kart-utforskning inn i én bottom-sheet med fire snap-states (`peek/quarter/half/full`) og beat-koblede affordanser. Det gir visuell støy, en pan/zoom-bar mini-preview, dobbel åpne-kart-CTA, og en lock-bug på oppsummering. Se origin: `docs/brainstorms/2026-06-16-mobil-rapport-board-ux-requirements.md`. Makro-valg (rebygg, ikke polish) er ratifisert.

## Requirements Trace

- R1. To fullskjerm-flater (historie ↔ kart) erstatter 4-snap-enumet.
- R2. Aktiv flate avledes per beat; nullstilles ved kapittel-bytte.
- R3. Historie-flate viser ren narrativ uten kart mens VO spiller.
- R4. Vedvarende transport-bar på begge flater (play/pause + segmentert progress + `n/total`).
- R5. Tappbare progress-segmenter → hopp til kapittel.
- R6. Kontekstuell flate-veksler (`Kart →` / `← Tilbake` / `Fortsett →`); summary/megler skjuler den.
- R13. Kart kun interaktivt på kart-flaten (pointer-events-skjold på ikke-aktiv/preview).
- R14. Flate-koblede exit-affordanser (topp-chevron + bunn-`Tilbake`); fjerner lock-bug.
- R15. Fjern «Swipe opp for neste»-løgn-hint.
- R16. Fjern kosmetisk «Klikk for å åpne kart»-pill.

(Teaser R7–R10, FAB R11–R12, edge-cases R17–R22 → Plan B.)

## Scope Boundaries

- Desktop-layout (`DesktopStorySidebar` + permanent kart, ≥1024 px) endres ikke.
- Event-board (`EventMobileSheet`) berøres ikke.
- Ingen endring i map-engine-arkitektur (persistent `gmp-map-3d` + 2D-overlay beholdes).
- Ingen re-opptak/re-generering av audio/manus.

### Deferred to Separate Tasks

- Teaser, ⚙ FAB, edge-cases → Plan B (samme brainstorm).

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/reels/ReportReelsPage.tsx` — `MapLayer` (~630-802), `ResponsiveLayoutInner` (~419-616), mobil-branch (~599-615). MapLayer skrives om i sin helhet (ikke patch).
- `components/variants/report/reels/reels-state.tsx` — `ReelsPhase`-enum, `defaultPhaseForCard` (nullstiller kun intro), `setActiveIndex`-reducer.
- `components/variants/report/reels/ReelsStack.tsx` — scroll-snap + `IntersectionObserver` → `setActiveIndex` (22-46); `pointer-events-none` i map-full (69/75). Eier kapittel-advance i dag.
- `components/variants/report/reels/DesktopStorySidebar.tsx` — `StoryProgressBar` (477-577, module-private, ikke eksportert; rAF-fyll + dekorative notch-`<span aria-hidden>`).
- `components/variants/report/board/BoardMap.tsx` (persistent `gmp-map-3d` ~415-424, `BoardMapControls` ~498-509), `BoardMap3D.tsx` (`onDragTakeover`), `MapView3D.tsx` (`gestureHandling` AUTO/GREEDY — ingen NONE).
- `components/variants/report/reels/reels-data.ts` — `cardIndexToAudioIndex` / `audioIndexToCardIndex`.
- `components/variants/report/board/audio-tour/use-audio-element.tsx`, `lib/stores/audio-tour-store.ts`, `use-reels-audio-orchestration.ts`.

### Institutional Learnings

- `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md` — 2D/3D-toggle (informer Plan B FAB).
- `docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md` — Auto/Fri-kamera + 3D-gesture (informer R13-skjold).
- `docs/solutions/architecture-patterns/report-kart-per-kategori-modal-20260409.md` — per-kategori kart-flate-presedens.
- `docs/solutions/architecture-patterns/map-adapter-pattern-20260419.md` — map-adapter-grenser.
- `docs/solutions/architecture-patterns/placy-guide-mobile-prototype.md` — mobil-prototype-mønstre.

## Key Technical Decisions

- **Erstatt `ReelsPhase`-enumet med avledet flate-tilstand.** Ny tilstand: `mapOpen: boolean` i `reels-state` (+ avledet `surface = mapOpen ? "map" : "story"`). Default per beat: map-forward (welcome/home/outro) → `mapOpen=true`; ellers `false`. `setActiveIndex` nullstiller `mapOpen` til beat-default (fikser lock-bug strukturelt — exits blir flate-koblet, ikke beat-koblet).
- **`ReelsStack` mister scroll-snap/IO-navigasjonsrollen.** I to-flate-modellen finnes ikke vertikal swipe-mellom-kort lenger. Kapittel-advance eies av transport-segment-tap + auto-advance (Plan B). `ReelsStack` repurposes til å rendre aktivt korts historie-flate (ingen IO som skriver `setActiveIndex`). *Ingen swipe-nav i v1 — dokumentert beslutning; kan revurderes.*
- **Ekstraher `StoryProgressBar` → delt modul** (`components/variants/report/reels/StoryProgressBar.tsx`), eksportert, brukt av både desktop-sidebar og mobil-transport. Ren flytt (ingen logikk-endring) + ny tappbar hit-zone-rad.
- **Pointer-events-skjold for ikke-interaktivt kart** (R13). Et gjennomsiktig lag over kart-arealet når kartet ikke er aktiv flate; `BoardMap` får et `interactive`-flagg (default true) som gater skjoldet. 3D kan ikke gjøres ikke-interaktiv via `GestureHandling` (ingen NONE). 2D-fallback bruker `interactive={false}`.
- **Interim lock-guard i Phase 1** (2-linjers): render exit-affordansen når `mapFullscreen` uansett beat-type i dagens `MapLayer`, så prototypen ikke kan låse seg mens rebygget pågår. Superseed-es av Unit A7.

## Open Questions

### Resolved During Planning

- Hvem eier `setActiveIndex` etter at `ReelsStack`-IO fjernes? → transport-segment-tap + auto-advance (Plan B). `ReelsStack` blir ren render av aktiv flate.
- Beholde eller erstatte enum? → erstatt med `mapOpen` (avledet `surface`); enklere og fjerner muddy mellomting.
- Skjold vs gesture-modus for ikke-interaktivt 3D? → skjold (ingen `GestureHandling.NONE`).

### Deferred to Implementation

- Eksakt animasjons-timing for flate-overgang (story ↔ map) — finn ved implementering mot mobil-emulering.
- Om `ReelsStack` beholdes som tynn wrapper eller foldes inn i den nye mobil-render — avgjøres når A7 skrives.

## High-Level Technical Design

> *Illustrerer intendert tilnærming — directional guidance for review, ikke implementasjons-spesifikasjon.*

```
reels-state:  mapOpen: boolean   (surface = mapOpen ? "map" : "story")
              setActiveIndex(i) → mapOpen = defaultMapOpenForCard(cards[i])
              defaultMapOpenForCard: welcome|home|outro → true, ellers false

ReportReelsPage (mobil):
  <PersistentMap interactive={surface === "map"} />     (skjold når !interactive)
  {surface === "story" && <StorySurface card />}        (ReelsStack-render, ingen IO)
  <ReelsTransport>                                       (alltid, post-unlock)
     [⏸] [StoryProgressBar (tappbar)] [n/total] [kontekstuell veksler]
  {surface === "map" && <MapExits chevron + bunn-Tilbake>}
```

## Implementation Units

- [ ] **Unit A1: Quick-wins — interim lock-guard + fjern dobbel-CTA + handle-knapp-look**

**Goal:** Umiddelbart testbar prototype uten lock-trap og uten dobbel åpne-kart-CTA.

**Requirements:** R14 (interim), R16, delvis R6.

**Dependencies:** Ingen.

**Files:**
- Modify: `components/variants/report/reels/ReportReelsPage.tsx` (MapLayer: `showCollapse`-guard + fjern `showOpenPrompt`-pill + style header-handle som knapp)
- Test: `components/variants/report/reels/__tests__/maplayer-exit-guard.test.tsx` (ren logikk-assert på at exit rendres når fullscreen)

**Approach:**
- Interim lock-guard: la exit-chevron rendre når `mapFullscreen` er true uansett beat-type (ikke kun `isFullPhase && !isMapForwardBeat`). Minimal endring; superseed-es av A7.
- Fjern den kosmetiske `showOpenPrompt`-pillen («Klikk for å åpne kart», `pointer-events-none`-overlay, ~722-733).
- Gi header-handle-teksten («Trykk for å se kart») et tydelig knapp-uttrykk (chip/pill-styling på mørk sheet), behold `handleSheetTap`.

**Patterns to follow:** `docs/solutions/ui-patterns/inline-staged-reveal-button-20260418.md` for knapp-affordanse.

**Test scenarios:**
- Happy path: gitt `mapFullscreen=true` på et summary/outro-kort → exit-affordanse rendres (regресsjonsvern mot lock-bug).
- Edge case: peek/quarter (ikke fullscreen) → ingen dobbel pill, kun header-knapp.

**Verification:** På mobil-emulering: ingen flytende «Klikk for å åpne kart»-pill; fullskjerm-kart har alltid en synlig vei ut.

- [ ] **Unit A2: Pointer-events-skjold + `interactive`-flagg på BoardMap**

**Goal:** Kartet er ikke pan/zoom-bart når det ikke er aktiv flate (fikser #6, og er byggekloss for teaser i Plan B).

**Requirements:** R13.

**Dependencies:** Ingen (kan parallelt med A1).

**Files:**
- Modify: `components/variants/report/board/BoardMap.tsx` (nytt `interactive?: boolean`-prop, default true; render gjennomsiktig skjold-div over kart-arealet når false)
- Modify: `components/variants/report/board/MapView3D.tsx` (2D Mapbox-sti: `interactive={false}` når ikke-interaktiv)
- Test: `components/variants/report/board/__tests__/boardmap-interactive-shield.test.tsx`

**Approach:**
- Legg et `pointer-events-auto` gjennomsiktig lag (z over kart, under UI-chrome) som fanger/sluker gester når `interactive=false`. 3D (`gmp-map-3d`) kan ikke skrus av via `GestureHandling` (ingen NONE) — skjoldet er mekanismen.
- For 2D-fallback (ingen-3D-addon): bruk Mapbox `interactive={false}` i tillegg.
- `onDragTakeover` (Auto→Fri) skal kun fyre når `interactive=true`.

**Patterns to follow:** `docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md`.

**Test scenarios:**
- Happy path: `interactive=false` → skjold-laget rendres; `interactive=true` → ikke.
- Edge case: 2D-modus (`has3dAddon=false`) + `interactive=false` → Mapbox `interactive={false}`.
- Integration: skjold blokkerer at `onDragTakeover` trигger Auto→Fri når ikke-interaktiv.

**Verification:** På mobil-emulering: i ikke-aktiv kart-tilstand kan brukeren ikke pan/zoom kartet; tap håndteres av overliggende chrome.

- [ ] **Unit A3: Avledet flate-tilstand i reels-state (erstatt ReelsPhase-enum)**

**Goal:** Innfør `mapOpen`/`surface` og nullstilling per beat — strukturell fiks av lock-bug.

**Requirements:** R1, R2, R14.

**Dependencies:** Ingen (logikk-laget; UI kobles i A7).

**Files:**
- Modify: `components/variants/report/reels/reels-state.tsx` (legg `mapOpen` + `setMapOpen`; `defaultMapOpenForCard`; `setActiveIndex` nullstiller `mapOpen` til beat-default; fjern/avvikle 5-verdis `ReelsPhase` der den ikke lenger trengs — behold `intro` for splash-oppvarming)
- Test: `components/variants/report/reels/__tests__/reels-state-surface.test.ts`

**Approach:**
- `defaultMapOpenForCard(card)`: welcome/home/outro → true; kategori/summary/megler/intro → false.
- `setActiveIndex(i)` setter `mapOpen = defaultMapOpenForCard(cards[i])` (nullstilling — ingen tilstand henger over → lock-bug umulig).
- `intro`-tilstanden beholdes som egen flagg for splash-oppvarming (kartet varmes bak splash).

**Patterns to follow:** eksisterende reducer-stil i `reels-state.tsx`.

**Test scenarios:**
- Happy path: `setActiveIndex` til welcome → `mapOpen=true`; til kategori → `mapOpen=false`.
- Edge case: var `mapOpen=true` (bruker åpnet kart), `setActiveIndex` til summary → `mapOpen=false` (ingen henging → ingen lock).
- Edge case: `setMapOpen(true)` på kategori → surface = "map"; `setMapOpen(false)` → "story".

**Verification:** Unit-tester grønne; ingen referanse til fjernede enum-verdier kompilerer feil (tsc).

- [ ] **Unit A4: Ekstraher StoryProgressBar til delt modul**

**Goal:** Gjør progress-baren gjenbrukbar på mobil uten desktop-kobling.

**Requirements:** R4 (forutsetning).

**Dependencies:** Ingen.

**Files:**
- Create: `components/variants/report/reels/StoryProgressBar.tsx` (flyttet + eksportert)
- Modify: `components/variants/report/reels/DesktopStorySidebar.tsx` (importer fra ny modul i stedet for lokal funksjon)
- Test: `components/variants/report/reels/__tests__/story-progress-bar.test.tsx` (boundary-beregning; ren flytt verifiseres ved at desktop fortsatt rendrer likt)

**Approach:**
- Ren flytt av `StoryProgressBar` (477-577) + helpers den trenger; ingen logikk-endring (rAF-fyll, lengde-vekting, notches beholdes). Eksporter.
- Verifiser at desktop-sidebar er uendret visuelt etter flytt.

**Patterns to follow:** eksisterende komponent-doc i `StoryProgressBar`.

**Test scenarios:**
- Happy path: boundary-array beregnes likt for vektede vs like-store segmenter.
- Edge case: `tracks.length <= 1` → ingen notches.
- Test expectation: visuell paritet desktop verifiseres manuelt (ren flytt).

**Verification:** Desktop-sidebar uendret; ny modul eksporterer `StoryProgressBar`.

- [ ] **Unit A5: Mobil transport-bar (ReelsTransport)**

**Goal:** Vedvarende avspiller-transport på begge flater.

**Requirements:** R4, R6, R15.

**Dependencies:** A3 (surface-state), A4 (StoryProgressBar).

**Files:**
- Create: `components/variants/report/reels/ReelsTransport.tsx`
- Modify: `components/variants/report/reels/ReportReelsPage.tsx` (montér transport i mobil-laget)
- Test: `components/variants/report/reels/__tests__/reels-transport.test.tsx`

**Approach:**
- Slank bunn-bar: `[⏸/▶]` (les/styr `audio-tour-store.phase` via `pause`/`resume`) + `<StoryProgressBar />` + `n/total` (fra `trackIndex`/`tracks.length`) + kontekstuell veksler-slot (R6).
- Kontekstuell veksler: kategori-historie → `Kart →` (`setMapOpen(true)`); kart-flate (fra kategori) → `← Tilbake` (`setMapOpen(false)`); map-forward beat → `Fortsett →` (eksisterende `advanceBeat`); summary/megler → skjult.
- Fjern «Swipe opp for neste»-hint i samme slengen (R15) — navigasjonen bor nå her.

**Patterns to follow:** `StoryProgressBar`-footer-layout i `DesktopStorySidebar` (px-3-fluktende padding).

**Test scenarios:**
- Happy path: pause-knapp toggler `audio-tour-store.phase` playing↔paused.
- Edge case: veksler viser riktig label per beat-type (kategori/map-forward/summary/megler).
- Edge case: `n/total` reflekterer `trackIndex+1` / `tracks.length`.
- Integration: `Kart →` setter `mapOpen=true` → surface = "map".

**Verification:** Transport synlig i bunn på begge flater; veksler kontekstuell; pause virker.

- [ ] **Unit A6: Tappbare progress-segmenter → goToTrack**

**Goal:** Segment-tap hopper til kapittel (posisjon/hopp-affordanse).

**Requirements:** R5.

**Dependencies:** A4, A5.

**Files:**
- Modify: `components/variants/report/reels/StoryProgressBar.tsx` (valgfri `onSeekToChapter`-prop + tappbare hit-zones over boundary-segmentene)
- Modify: `components/variants/report/reels/ReelsTransport.tsx` (koble hit-zone → `setActiveIndex` via `audioIndex→cardIndex`)
- Test: `components/variants/report/reels/__tests__/segment-seek.test.tsx`

**Approach:**
- Bygg klikkbare soner fra `boundaries`-arrayen (i dag dekorative `<span aria-hidden>`). Tapp segment _k_ → `goToTrack(k)`-ekvivalent via `setActiveIndex(audioIndexToCardIndex(k))` (gjenbruk desktop-thumbnail-ruten).
- `onSeekToChapter` er valgfri → desktop kan velge å ikke sende den (uendret der).
- aria-labels på segmentene (Plan B kompletterer a11y).

**Patterns to follow:** desktop-thumbnail-klikk-flyt (`setActiveIndex → orchestration → goToTrack`).

**Test scenarios:**
- Happy path: tapp segment 3 → `setActiveIndex(audioIndexToCardIndex(3))`.
- Edge case: `cardIndex↔audioIndex`-mapping korrekt rundtur for ikke-audio-kort (hoppes over).
- Integration: segment-tap under kapittel-slutt-vindu kansellerer ev. planlagt advance (kobles fullt i Plan B B2).

**Verification:** Tapp på et segment hopper til riktig kapittel på mobil-emulering.

- [ ] **Unit A7: Omskriv mobil-laget i ReportReelsPage → to flater**

**Goal:** Render historie-flate ↔ kart-flate fra ny state, med flate-koblede exits.

**Requirements:** R1, R2, R3, R6, R13, R14.

**Dependencies:** A2, A3, A5, A6.

**Files:**
- Modify: `components/variants/report/reels/ReportReelsPage.tsx` (erstatt `MapLayer` + mobil-branch med to-flate-render)
- Modify: `components/variants/report/reels/ReelsStack.tsx` (fjern scroll-snap/IO-nav; render aktivt korts historie-flate)
- Test: `components/variants/report/reels/__tests__/two-surface-render.test.tsx`

**Approach:**
- `surface === "story"`: full historie-flate (video/foto + karaoke via eksisterende kort-routing), transport i bunn, ingen kart synlig (R3). Persistent kart mountet men `interactive={false}` + skjult/ikke-aktiv (warm).
- `surface === "map"`: persistent kart `interactive={true}` fullskjerm + pins; exits = topp-venstre chevron (behold) + bunn-`Tilbake` (i transporten) — begge flate-koblet, rendres uansett beat (R14, fjerner lock-bug).
- Map-forward beats: default `surface="map"`, behold `Fortsett →` (caption + skip).
- Slett død «Swipe opp for neste» (R15) og rester av `peek/quarter/half`-styling.

**Patterns to follow:** `docs/solutions/architecture-patterns/report-kart-per-kategori-modal-20260409.md`; disclosure-animasjon (max-height/opacity, ingen auto-scroll ved expand — per Placy-konvensjon).

**Test scenarios:**
- Happy path: kategori-beat → historie-flate; `Kart →` → kart-flate med chevron + `Tilbake`.
- Edge case: summary/outro i kart-flate → exit alltid synlig (lock-bug borte).
- Edge case: map-forward beat → kart-flate med `Fortsett →`, ingen `Tilbake`.
- Integration: `setActiveIndex` (auto/seek) nullstiller surface til beat-default.

**Verification:** Full gjennomgang på mobil-emulering: to rene flater, alltid en vei ut, ingen pan/zoom-bar preview, ingen dobbel CTA. (SC1, SC2, SC3 delvis; full SC-verifisering etter Plan B.)

## System-Wide Impact

- **Interaction graph:** `setActiveIndex` er nå eneste inngang til kapittel-bytte (mister `ReelsStack`-IO). `audio-tour-store` uendret som sannhetskilde. Desktop-sidebar uendret (deler kun `StoryProgressBar`-modulen).
- **State lifecycle:** `mapOpen` nullstilles per beat → ingen henging. Persistent `gmp-map-3d` mountes/​unmountes aldri (uendret invariant).
- **API surface parity:** desktop berøres kun av `StoryProgressBar`-flyttingen (ren flytt, paritet verifiseres).
- **Unchanged invariants:** audio-orchestration, `cardIndex↔audioIndex`, map-engine-arkitektur, event-board.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| MapLayer-omskriving (A7) brekker eksisterende beats | A1-interim-guard + inkrementell verifisering på emulering per unit; ren git-revert per commit |
| `StoryProgressBar`-flytt endrer desktop utilsiktet | Ren flytt uten logikk-endring; visuell paritet-sjekk desktop |
| `ReelsStack`-IO-fjerning bryter audio-orchestration (keyer på `activeIndex`) | `setActiveIndex` beholdes som inngang; kun *driveren* (IO→transport/auto-advance) endres |
| Skjold (A2) fanger tap som skulle nå chrome | z-index-rekkefølge: skjold under UI-chrome, over kart |

## Sources & References

- **Origin:** `docs/brainstorms/2026-06-16-mobil-rapport-board-ux-requirements.md`
- Plan B: `docs/plans/2026-06-16-002-feat-mobil-rapport-board-ux-plan-B.md`
- Related: `docs/solutions/architecture-patterns/report-kart-per-kategori-modal-20260409.md`, `docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md`

## Tech Audit — runde 1 (2026-06-16): YELLOW — korreksjoner (autoritative, overstyrer unit-tekst ved konflikt)

Verdikt **YELLOW**: modellen er gjennomførbar, ingen RED. Følgende kode-verifiserte korreksjoner MÅ følges av `ce-work`:

- **A2 — filsti-fiks:** Det finnes INGEN `components/variants/report/board/MapView3D.tsx`. 3D-wrapperen er `components/map/map-view-3d.tsx` (har allerede et `activated`-prop som flipper `gestureHandling` GREEDY↔AUTO — men AUTO panner fortsatt, så pointer-events-**skjoldet er den reelle mekanismen**). 2D-overlay-Mapbox som skal ha `interactive={false}` er `<Map>` i `BoardMap.tsx` (~433-491). **Skjold-z-order:** render skjoldet inni `BoardMap` over kart-canvas men under kontroll-clusteret (`BoardMapControls` er z-30); FAB (Plan B) gates til `surface==='map'` så den aldri havner under skjoldet.
- **A3 — gjør STRENGT ADDITIV:** legg til `mapOpen`/`setMapOpen`/`defaultMapOpenForCard` og la `SET_ACTIVE_INDEX` også nullstille `mapOpen` — UTEN å fjerne `ReelsPhase`/`SET_PHASE`/`currentPhase` ennå. Enum-sletting + fjerning av `setPhase`-call-sites (MapLayer, ReelsStack, `CategoryReel.tsx`) skjer i **A7** (som likevel skriver om de filene). Drop A3-verifikasjonens «fjernede enum-verdier tsc»-påstand. `defaultMapOpenForCard` kalles KUN for audio-bærende rapporter (`firstAudioBearingIndex !== -1`). `intro` og `mapOpen` er **ortogonale**: `intro` er en splash-gate over begge flater, ikke en surface-verdi.
- **A5 — timer-cancel:** `Kart →` må også **kansellere en eventuell ventende advance-timer** (wiret i Plan B B2). `← Tilbake`-gjenoppta-logikk per B2.
- **A7 — legg til `components/variants/report/reels/CategoryReel.tsx` i Files.** Den leser `state.currentPhase` + `SHEET_HEIGHT_PCT[currentPhase]` med enum-nøklene → mobil-grenen må kollapse til ÉN historie-flate-layout (karaoke forankret over transporten). A7 **eier enum-slettingen**. Render `state.cards[state.activeIndex]` **direkte** (fjern `ReelsStack` sin `IntersectionObserver` + `suppressIORef`/scrollTop; re-hjem `handlePlay`-sin `setActiveIndex(firstIdx)` slik at welcome faktisk vises uten scroll-feed). **Hold `BoardMap` persistent montert på BEGGE flater** (teaseren i Plan B avslører samme instans — ikke betinget-mount kun på `surface==='map'`). Etterlat **navngitte extension-points**: (1) teaser-slot på historie-flaten (tom i A7, fylles av B1), (2) `audioUnlocked`-gate for transport (B4), (3) no-audio-gren + summary/megler-render (B4).

**Residual risks (ce-work overvåker):** `StoryProgressBar` sin monotone `heldRef`-guard må ikke gi visuelt hopp når mobil-timer fyrer `setActiveIndex(next)`; `hasVoiceOver`/`has3dAddon` utledes i både `BoardMap` og `BoardMap3D` — bruk samme utledning.
