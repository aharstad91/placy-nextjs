---
module: report/reels
tags: [mobile, reels, board, audio-tour, state-machine, google-3d, ux, two-surface]
problem_type: architecture-pattern
date: 2026-06-16
related:
  - docs/brainstorms/2026-06-16-mobil-rapport-board-ux-requirements.md
  - docs/plans/2026-06-16-001-feat-mobil-rapport-board-ux-plan-A.md
  - docs/plans/2026-06-16-002-feat-mobil-rapport-board-ux-plan-B.md
  - docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md
---

# Mobil rapport-board: to-flate-modell (historie ↔ kart) + vedvarende transport

## Problem

Den mobile rapport-board-opplevelsen presset narrativ **avspilling** og kart-**utforskning** inn i én bottom-sheet med fire snap-states (`peek 10% / quarter 40% / half 65% / full 100%`), styrt av et `ReelsPhase`-enum. Affordanser (exit-chevron, kart-kontroller, «åpne kart»-hint) var koblet til *beat-type*, ikke til *flate*. Symptomer (funnet ved iPhone-gjennomgang):

1. Auto/Fri/Kart/3D-kontrollene alltid utbrettet (for mye chrome).
2. Ingen avspillings/posisjons-GUI på mobil (pause/hvor-er-jeg/hopp) — fantes kun desktop.
3. Dobbel «åpne kart»-CTA (én ekte knapp + én kosmetisk `pointer-events-none`-pill).
4. Uklart hvor mye kart 50%-staten skulle vise.
5. «Swipe opp for neste» var en *død* affordanse (`ReelsStack` var `pointer-events-none` i map-full).
6. Mini-kart-preview var pan/zoom-bar (så ødelagt ut).
7. **Lock-bug**: på map-forward beats (outro/«oppsummering») dekket fullskjerm-kartet den scrollbare feeden, og `showCollapse` var false (`!isMapForwardBeat`) → kun «Fortsett», ingen vei tilbake.

## Løsning: to flater, én vedvarende transport

Erstatt 4-snap-modellen med **to fullskjerm-flater** + en avledet boolean `mapOpen`:

- **Historie-flate** (`!mapOpen`): det aktive kortet rendres direkte (`CardRouter`), ingen scroll-feed. Ren narrativ.
- **Kart-flate** (`mapOpen`): persistent fullskjerm-kart + pins + progressivt avslørte kontroller + tydelige exits.
- `mapOpen` avledes per beat (`defaultMapOpenForCard`: welcome/home/outro → kart; kategori/summary/megler/intro → historie) og **nullstilles ved hvert `SET_ACTIVE_INDEX`**. Exit-affordanser blir dermed flate-koblet, ikke beat-koblet → **lock-bug-klassen er umulig** (det finnes alltid en transport med tappbare segmenter + chevron/Tilbake).

**Vedvarende transport** (`ReelsTransport`, til stede på begge flater): play/pause + sammenhengende segmentert progress (gjenbruk av `StoryProgressBar`) + tappbare segmenter → hopp + `n/total` + kontekstuell veksler (`Kart →` på historie / `← Tilbake` på kart-flate fra kategori / `Fortsett →` på map-forward beats / skjult på summary/megler).

**Progress-gated kart-teaser**: kartet vises ikke under narrasjon; ved kategori-VO-slutt armes en teaser (samme persistente kart-instans avslørt i en bunn-stripe, ikke-interaktiv) + en timet, passiv auto-advance. Ignorer → touren går videre; tapp → kart-flate.

## Kritiske tekniske lærdommer

- **Google 3D (`gmp-map-3d`) kan ikke gjøres ikke-interaktiv via `GestureHandling`** — `@vis.gl/react-google-maps` har bare `AUTO/COOPERATIVE/GREEDY` (ingen `NONE`; `AUTO` panner fortsatt). Løsning: et **gjennomsiktig pointer-events-skjold** (`<div className="absolute inset-0 z-10" style={{touchAction:"none"}}>`) over kart-laget når `interactive=false`. 2D-Mapbox bruker `interactive={false}`. Se `BoardMap.tsx` (`interactive`-prop). Skjoldet er den ENESTE beskyttelsen mot pan/zoom på historie-flaten — den persistente 3D-instansen rives aldri (WebGL-context-lekk), så den er alltid «under».
- **Én persistent kart-instans, avslørt i ulik geometri.** Teaser-glimt, historie-bakgrunn og kart-flate er SAMME `gmp-map-3d` (aldri en nr. 2 — det ville lekke WebGL-kontekst). Geometrien (fullskjerm z-0 bak historie / bunn-stripe z-20 teaser / fullskjerm z-20 kart-flate) styres av en `mapStyle`-ternær med `transition-all`.
- **Auto-advance-timer + async-races** (de to dyreste bugene, fanget i emulering + frontend-races-review):
  - Hvis kategori-VO slutter MENS bruker er på kart-flaten må timeren IKKE armes (guard `!state.mapOpen`) — ellers rykkes bruker av kartet.
  - Timeren må kanselleres ved `visibilitychange === "hidden"` (overlevde ellers backgrounding og fyrte ved retur → brøt no-auto-resume).
  - **Fire-time-guard**: les fersk state via en `stateRef` i `setTimeout`-callbacken og avbryt hvis `activeIndex` endret seg / `mapOpen` / `!teaserArmed`. Dekker bl.a. segment-tapp på SAMME kapittel (som reduceren no-op-er → activeIndex-cleanupen treffer ikke). `onTrackEnded` re-bindes hver render (dep i `use-audio-element` effekt 3), så closuren er fersk — men callbacken trenger likevel guarden.
- **`StoryProgressBar` var gjenbrukbar 1:1** for fyll/notch-rendering (rAF + lengde-vekting, ingen desktop-avhengigheter) — men de tappbare hit-zones var NYTT (notchene var dekorative `<span aria-hidden>`). Ekstrahert til delt modul; valgfri `onSeekToChapter`-prop holder desktop byte-identisk.
- **FAB-plassering vs transport**: kollapset ⚙-FAB lå opprinnelig bunn-midt (gammel kontroll-sone) og ble skjult bak den nye transport-baren. Flyttet til topp-høyre (klarer transport-bunn + caption topp-midt + chevron topp-venstre). På welcome-beaten skjules kontrollene uansett via `controlsReady={!isWelcomeBeat}` (flythrough eier skjermen).
- **Play/pause på ikke-audio-kort**: `trackIndex` står igjen på siste audio-spor (outro) når man parkerer på summary/megler; naiv `resume()` spilte da outro-VO disembodied. Løsning: «spill av på nytt» fra første kapittel når aktivt kort ikke er audio-bærende eller phase er `ended`.

## Filer

- `components/variants/report/reels/reels-state.tsx` — `mapOpen`/`teaserArmed`, `defaultMapOpenForCard`, reset per beat. `ReelsPhase` smalnet til `"intro"|"reel"`.
- `components/variants/report/reels/ReportReelsPage.tsx` — `ReelsAudioShell` (advance-timer + guards), to-flate mobil-render.
- `components/variants/report/reels/ReelsTransport.tsx`, `MapTeaser.tsx`, `StoryProgressBar.tsx` (delt).
- `components/variants/report/board/BoardMap.tsx` (`interactive`-skjold + `collapsedControls`), `BoardMapControls.tsx` (`collapsed` FAB-modus).

## Hva som ble bekreftet under verifisering (Chrome devtools iPhone, Stasjonskvartalet)

Splash → welcome/home kart-flate (transport + caption) → kategori historie-flate (karaoke + `Kart →`) → kart-flate (chevron + Tilbake + ⚙ FAB topp-høyre) → segment-hopp → outro/«oppsummert» navigerbar → megler. Alle 9 segmenter tappbare hele veien — **lock-bugen er borte**. Google 3D rendrer i devtools-emuleringen.

## Gjenstår (deferred, lav prioritet)

- Fake-timers-test for advance-timer-livssyklusen (reduceren er enhetstestet; den imperative timeren er kun emulering-verifisert).
- `MobileReportSplash` aria-hidden-på-fokusert-knapp-warning (pre-eksisterende, ved fade-out).
- Swipe-basert kapittel-nav (bevisst utelatt i v1 — transport eier navigasjon).
