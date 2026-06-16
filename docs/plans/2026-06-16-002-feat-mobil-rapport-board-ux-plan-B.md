---
title: "feat: Mobil rapport-board — teaser, FAB og edge-cases"
type: feat
status: active
date: 2026-06-16
origin: docs/brainstorms/2026-06-16-mobil-rapport-board-ux-requirements.md
---

# Mobil rapport-board — Plan B (invitasjon + polish + edge-cases)

> Del 2 av 2. Bygger på **Plan A** (`docs/plans/2026-06-16-001-feat-mobil-rapport-board-ux-plan-A.md`): to-flate state-modell, transport-bar og skjold må være på plass først.

## Overview

Plan B legger på det som gjør modellen ferdig: den **progress-gated kart-teaseren** som inviterer seg selv inn ved kapittel-slutt, en **ny timet auto-advance** for kategori-beats (eksisterer ikke i dag), **⚙ FAB progressiv avsløring** av kart-kontrollene, og **robusthet for edge-cases** (no-audio, iOS-unlock, summary/megler, ingen-3D-addon, kart-tilstander, backgrounding/error).

## Problem Frame

Med fundamentet (Plan A) på plass mangler invitasjonen som binder historie til kart uten å eksponere kart for mye, en avspillingsflyt som faktisk avanserer kategorier passivt, mindre kart-chrome, og dekning for tilstander modellen ellers kan snuble i. Se origin: `docs/brainstorms/2026-06-16-mobil-rapport-board-ux-requirements.md`.

## Requirements Trace

- R7. Ingen kart på historie-flaten mens VO spiller.
- R8. Kart-glimt animeres opp ved VO-slutt (samme persistente instans + skjold, ikke-interaktivt).
- R9. Ignorer → auto-advance fortsetter; tapp/manuell kart-åpning → pause auto-advance + kanseller timer.
- R10. Teaser kun på kategori-beats.
- R11. Kart-kontroller kollapset til ⚙ FAB + popover, kun kart-flate.
- R12. Drag bytter Auto→Fri automatisk (behold `onDragTakeover`).
- R17. No-audio: fall tilbake til eksisterende no-audio-flate; ingen transport.
- R18. iOS lyd-unlock: transport først etter unlock.
- R19. Summary/megler: skjul veksler, ingen teaser, kortets eget innhold.
- R20. Ingen-3D-addon/ingen-VO: betinget/skjult FAB.
- R21. Kart-flate-tilstander (laste/feil/tomt POI-sett).
- R22. Robusthet: backgrounding + audio-error har alltid en vei ut.

## Scope Boundaries

- Bygger kun videre på Plan A; endrer ikke desktop, event-board eller map-engine-arkitektur.
- Ingen re-opptak/re-generering av audio/manus.

### Deferred to Separate Tasks

- Swipe-basert kapittel-nav (bevisst utelatt i v1 — Plan A-beslutning).
- Event-board mobil-rebuild (eget spor hvis event reaktiveres).

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/reels/ReportReelsPage.tsx` (to-flate-render fra Plan A), `ReelsTransport.tsx`, `reels-state.tsx` (`mapOpen`/`surface`).
- `components/variants/report/board/audio-tour/use-audio-element.tsx` (`onEnded`, `currentTime`, `unlock`), `lib/stores/audio-tour-store.ts` (`phase` inkl. `error`, `pauseReason`), `use-reels-audio-orchestration.ts` (visibilitychange-pause, ingen-auto-resume).
- `components/variants/report/board/BoardMapControls.tsx` (Auto/Fri/2D/3D — kollapses til FAB), `BoardMap.tsx` (`has3dAddon`, `hasVoiceOver`), `BoardMap3D.tsx` (`onDragTakeover`).
- `components/variants/report/reels/reels-data.ts` (beat-kinds, `isAudioBearing`), `IntroReel.tsx`/`MobileReportSplash.tsx` («Start opplevelsen»-unlock).

### Institutional Learnings

- `docs/solutions/ui-patterns/apple-style-slide-up-modal-with-backdrop-blur-20260415.md` — slide-up-følelse for teaser-glimt.
- `docs/solutions/ui-patterns/progressive-disclosure-kuratert-poi-slots-20260420.md` + `inline-staged-reveal-button-20260418.md` — progressiv avsløring (FAB + teaser).
- `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md` — 2D/3D-toggle (FAB-innhold).
- `docs/solutions/ux-loading/skeleton-loading-report-map-20260204.md` — kart-laste-tilstand (R21).

## Key Technical Decisions

- **Teaser = samme persistente `gmp-map-3d`-instans avslørt**, ikke en nr. 2 (WebGL-invariant). Glimtet er et begrenset-høyde vindu nederst på historie-flaten som viser kartet (ikke-interaktivt via Plan A-skjoldet) + «Utforsk på kart»-CTA. Tapp → `setMapOpen(true)` (full kart-flate).
- **Ny timet auto-advance for kategori-beats** (eksisterer ikke i dag — `handleTrackEnded` parkerer i dag). Ved kategori-VO-slutt: vis teaser i et definert vindu (`CATEGORY_TEASER_MS`, default justeres mot lesbarhet på emulering, start ~3000 ms), deretter `setActiveIndex(neste)`. Timeren lagres i en ref og **kanselleres** ved enhver kart-entry (teaser-tapp eller manuell `Kart →`) og ved manuell seek.
- **Auto-advance pauses mens `surface === "map"`** (enhver kart-entry, ikke bare teaser-tapp) → R2-nullstilling fyrer ikke mens bruker utforsker. Retur til historie gjenopptar.
- **⚙ FAB** wrapper/utvider `BoardMapControls` til en kollapset variant: ett tannhjul → popover med Visning (2D/3D) + Kamera (Auto/Fri). Innhold betinget: uten 3D-addon ingen 2D/3D; uten VO ingen Auto/Fri; ingen relevante → FAB skjult. Plassering: bunn-midt-sonen `BoardMapControls` alt bruker (klarer Google/Mapbox-attribusjon).
- **No-audio (R17):** to-flate/transport/teaser gjelder kun når `firstAudioBearingIndex !== -1`. Uten audio: behold eksisterende no-audio-mobil-flate; transport rendres ikke (ingen tom-`tracks`/NaN).
- **iOS-unlock (R18):** transport rendres bak gate `state.audioUnlocked` (eksisterende). Før unlock = splash.

## Open Questions

### Resolved During Planning

- Teaser nr.2-instans vs samme? → samme instans avslørt (Plan A-skjold).
- Hva dismisser teaseren? → timer-utløp (auto-advance) eller tapp; manuell kart-åpning kansellerer.
- No-audio-oppførsel? → fall tilbake til eksisterende no-audio-flate, ingen transport.

### Deferred to Implementation

- Eksakt `CATEGORY_TEASER_MS` + animasjons-kurve → justeres mot mobil-emulering (lesbarhet vs flyt).
- Eksakt FAB-popover-plassering/offset → verifiser mot live attribusjon på emulering.
- Hvor mye av kartet glimtet viser (høyde-%) → justeres visuelt.

## High-Level Technical Design

> *Directional guidance for review, ikke implementasjons-spesifikasjon.*

```
Kategori-VO slutter (onEnded, autoAdvance=false):
  → vis teaser-glimt (samme kart, skjold på) + "Utforsk på kart"
  → start advanceTimer(CATEGORY_TEASER_MS)
       ├─ utløp  → setActiveIndex(neste)            (passiv lean-back)
       ├─ tapp glimt → cancel timer + setMapOpen(true)   (utforsk; advance pauset)
       └─ manuell Kart → / seek → cancel timer
  retur til historie (setMapOpen(false)) → gjenoppta

FAB (kun surface==="map"):
  [⚙] → popover { Visning: 2D|3D (hvis has3dAddon),
                  Kamera: Auto|Fri (hvis hasVoiceOver) }
  ingen relevante kontroller → FAB skjult
```

## Implementation Units

- [ ] **Unit B1: Progress-gated kart-teaser (glimt + invitasjon)**

**Goal:** Kart-glimt stiger opp ved kategori-VO-slutt; ikke-interaktivt; tapp åpner kart.

**Requirements:** R7, R8, R10.

**Dependencies:** Plan A (A2-skjold, A3-state, A7-render).

**Files:**
- Create: `components/variants/report/reels/MapTeaser.tsx`
- Modify: `components/variants/report/reels/ReportReelsPage.tsx` (render teaser på historie-flate ved teaser-tilstand)
- Modify: `components/variants/report/reels/reels-state.tsx` (teaser-synlig-flagg, f.eks. `teaserArmed`)
- Test: `components/variants/report/reels/__tests__/map-teaser.test.tsx`

**Approach:**
- Begrenset-høyde vindu nederst på historie-flaten som avslører den persistente kart-instansen (skjold på → ikke-interaktivt) + «Utforsk på kart»-CTA. Slide-up-animasjon (max-height/opacity, ingen auto-scroll).
- Vises kun på kategori-beats etter VO-slutt (R10); aldri under VO (R7) eller på welcome/home/outro/summary/megler.
- Tapp → `setMapOpen(true)`.

**Patterns to follow:** `docs/solutions/ui-patterns/apple-style-slide-up-modal-with-backdrop-blur-20260415.md`; Placy disclosure-konvensjon (max-height, ingen auto-scroll ved expand).

**Test scenarios:**
- Happy path: kategori-beat, VO ferdig → `teaserArmed=true` → MapTeaser rendres.
- Edge case: under VO (`teaserArmed=false`) → ingen teaser (R7).
- Edge case: welcome/home/outro/summary/megler → teaser fyrer aldri (R10).
- Integration: tapp glimt → `mapOpen=true` (surface=map).

**Verification:** Mobil-emulering: glimt stiger opp ved kapittel-slutt, kan ikke pan/zoomes, tapp åpner full kart-flate.

- [ ] **Unit B2: Timet auto-advance for kategori-beats + cancel-on-entry**

**Goal:** Passiv lean-back: ignorert teaser → neste kapittel; kart-entry pauser/kansellerer.

**Requirements:** R9.

**Dependencies:** B1, Plan A (A3, A5).

**Files:**
- Modify: `components/variants/report/reels/use-reels-audio-orchestration.ts` (kategori-`onEnded` → arm teaser + start `advanceTimer`)
- Modify: `components/variants/report/reels/reels-state.tsx` (timer-ref/lifecycle om nødvendig)
- Test: `components/variants/report/reels/__tests__/category-auto-advance.test.ts`

**Approach:**
- Ny oppførsel (finnes ikke i dag): ved kategori-VO-slutt, start `advanceTimer(CATEGORY_TEASER_MS)` → `setActiveIndex(neste)`. I dag parkeres det på `map-quarter`; den koden erstattes.
- Kanseller timer ved: teaser-tapp (B1), manuell `Kart →` (A5), segment-seek (A6). Mens `surface==="map"`: ingen advance (pauset).
- Behold welcome/home auto-advance (eksisterende). Behold visibilitychange-pause + ingen-auto-resume (R22).

**Patterns to follow:** eksisterende `advanceTimerRef`/cleanup-mønster i orchestration; `handleTrackEnded`-grenene.

**Test scenarios:**
- Happy path: kategori-VO slutt, ingen interaksjon → etter `CATEGORY_TEASER_MS` → `setActiveIndex(neste)`.
- Edge case: tapp teaser i vinduet → timer kansellert, ingen advance, `mapOpen=true`.
- Edge case: manuell `Kart →` før VO-slutt → ingen timer armes mens på kart.
- Edge case: siste kategori → advance lander på outro (map-forward) uten dobbel-trigger.
- Integration: retur fra kart til historie gjenopptar uten å hoppe over kapittel.

**Verification:** Emulering: la stå → touren går videre selv; åpne kart → står stille til retur.

- [ ] **Unit B3: ⚙ FAB progressiv avsløring av kart-kontroller**

**Goal:** Kollaps Auto/Fri/2D/3D til ett tannhjul + popover, kun på kart-flaten.

**Requirements:** R11, R12, R20 (betinget innhold).

**Dependencies:** Plan A (A7 surface-state inn i BoardMap).

**Files:**
- Create: `components/variants/report/board/MapControlsFab.tsx` (eller `collapsed`-modus i `BoardMapControls.tsx`)
- Modify: `components/variants/report/board/BoardMap.tsx` (gate FAB på surface=map; send `has3dAddon`/`hasVoiceOver`)
- Test: `components/variants/report/board/__tests__/map-controls-fab.test.tsx`

**Approach:**
- Ett ⚙-ikon (bunn-midt-sonen, klarer attribusjon) → popover med Visning (2D/3D) + Kamera (Auto/Fri), gjenbruk eksisterende toggle-callbacks fra `BoardMapControls`.
- Betinget: uten `has3dAddon` → ingen 2D/3D; uten `hasVoiceOver` → ingen Auto/Fri; ingen relevante → FAB skjult helt (R20).
- `onDragTakeover` (Auto→Fri) uendret (R12).

**Patterns to follow:** `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md`; `docs/solutions/ui-patterns/progressive-disclosure-kuratert-poi-slots-20260420.md`.

**Test scenarios:**
- Happy path: kart-flate → ⚙ synlig; tapp → popover med 2D/3D + Auto/Fri.
- Edge case: `has3dAddon=false` → ingen 2D/3D i popover.
- Edge case: `hasVoiceOver=false` → ingen Auto/Fri; begge fraværende → FAB skjult.
- Edge case: historie-flate → ingen FAB.
- Integration: 2D/3D-toggle i popover bytter faktisk engine (samme callback som i dag).

**Verification:** Emulering: minimal kart-chrome; kontroller bak ett tannhjul; popover klarer Google/Mapbox-logo.

- [ ] **Unit B4: Edge-cases — innhold/gating (no-audio, iOS-unlock, summary/megler)**

**Goal:** Modellen oppfører seg riktig der narrativen ikke gjelder.

**Requirements:** R17, R18, R19.

**Dependencies:** Plan A (A5, A7).

**Files:**
- Modify: `components/variants/report/reels/ReportReelsPage.tsx` (no-audio-fallback-gren; transport bak `audioUnlocked`-gate; summary/megler-flate-render + skjult veksler)
- Test: `components/variants/report/reels/__tests__/edge-content-gating.test.tsx`

**Approach:**
- No-audio (`firstAudioBearingIndex === -1`): behold eksisterende no-audio-mobil-flate (kategori-grid/preview); transport rendres ikke (R17).
- iOS-unlock: transport rendres først når `state.audioUnlocked` (R18); før det = splash.
- Summary/megler: historie-flate rendrer kortets eget innhold; veksler skjult (R19); ingen teaser (allerede R10/B1).

**Patterns to follow:** eksisterende no-audio-sidebar-empty-state; `MobileReportSplash` unlock-gate.

**Test scenarios:**
- Happy path: rapport uten audio → ingen transport, eksisterende fallback vises.
- Edge case: før unlock → splash, ingen transport; etter unlock → transport.
- Edge case: summary/megler → veksler skjult, kortinnhold rendres, ingen teaser.

**Verification:** Emulering på no-audio-rapport + på audio-rapport (før/etter unlock) + på summary/megler-kort.

- [ ] **Unit B5: Edge-cases — kart-robusthet (2D-only, laste/feil, backgrounding/error)**

**Goal:** Alltid en vei ut; ingen blank/krasj-tilstand.

**Requirements:** R20 (kart-tilstander), R21, R22.

**Dependencies:** B3, Plan A.

**Files:**
- Modify: `components/variants/report/board/BoardMap.tsx` (lett laste-tilstand + enkel feilmelding; tomt POI-sett OK)
- Modify: `components/variants/report/reels/use-reels-audio-orchestration.ts` (audio-error → teaser fyrer ikke; transport+Kart er vei ut; visibilitychange-resume via transport-play)
- Test: `components/variants/report/reels/__tests__/edge-robustness.test.ts`

**Approach:**
- Kart-flate: lett laste-tilstand (3D normalt varm bak splash), enkel feilmelding ved tile-feil med exits intakt, tomt POI-sett → kart vises likevel (nabolags-kontekst) (R21).
- audio-error (`phase==="error"`, `onEnded` fyrer ikke): ingen teaser; transport (alltid synlig post-unlock) + `Kart →` er veien ut; SC1 dekket (R22).
- Backgrounding: behold eksisterende pause + ingen-auto-resume; gjenoppta = transport-play; teaser re-armes hvis VO alt var ferdig (R22).

**Patterns to follow:** `docs/solutions/ux-loading/skeleton-loading-report-map-20260204.md`.

**Test scenarios:**
- Happy path: tomt POI-sett → kart rendres uten krasj.
- Edge case: `phase==="error"` på kategori → ingen teaser; transport + Kart fortsatt synlig (vei ut).
- Edge case: backgrounding mid-VO → pause; retur → transport-play gjenopptar.
- Edge case: `has3dAddon=false` → kart-flate fungerer i 2D (skjold/interactive via Mapbox).

**Verification:** Emulering: simuler tom/feil/2D/backgrounding — ingen fastlåst eller blank tilstand.

## System-Wide Impact

- **Interaction graph:** ny `advanceTimer` i orchestration; teaser-tilstand i reels-state; FAB gated på surface. `audio-tour-store` uendret.
- **Error propagation:** audio-error → ingen teaser, men transport+Kart sikrer vei ut (R22/SC1).
- **State lifecycle:** advance-timer må alltid kanselleres ved kart-entry/seek/unmount (race-vern).
- **API surface parity:** `BoardMapControls`-callbacks gjenbrukes av FAB (ingen ny toggle-logikk).
- **Unchanged invariants:** map-engine, audio-orchestration-kjerne, desktop, event-board.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `CATEGORY_TEASER_MS` for kort (teaser kuttes) / for lang (treg flyt) | Juster mot mobil-emulering; start ~3000 ms |
| Advance-timer race (tapp i vinduet vs utløp) | Kanseller timer-ref ved enhver kart-entry/seek; cleanup ved unmount/`setActiveIndex` |
| To gmp-map-3d-instanser (teaser vs full) bryter WebGL-invariant | Teaser = samme instans avslørt (eksplisitt beslutning) |
| FAB-popover dekker Google/Mapbox-attribusjon (ToS) | Bunn-midt-sonen `BoardMapControls` alt bruker; verifiser på emulering |
| audio-error skjuler vei ut | Transport+Kart alltid synlig post-unlock (R22) |

## Sources & References

- **Origin:** `docs/brainstorms/2026-06-16-mobil-rapport-board-ux-requirements.md`
- Plan A: `docs/plans/2026-06-16-001-feat-mobil-rapport-board-ux-plan-A.md`
- Related: `docs/solutions/ui-patterns/apple-style-slide-up-modal-with-backdrop-blur-20260415.md`, `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md`

## Tech Audit — runde 1 (2026-06-16): YELLOW — korreksjoner (autoritative, overstyrer unit-tekst ved konflikt)

Verdikt **YELLOW**: gjennomførbart, ingen RED. Kode-verifiserte korreksjoner `ce-work` MÅ følge:

- **B2 — FEIL FIL:** `handleTrackEnded` + `advanceTimerRef` bor i `ReelsAudioShell` *inni* `components/variants/report/reels/ReportReelsPage.tsx` (~314-376), **ikke** i `use-reels-audio-orchestration.ts`. Erstatt mobil-kategori-grenen (~linje 373: `setPhase('map-quarter')`) med: arm teaser + start advance-timer → `setActiveIndex(neste)`. **GJENBRUK den ene eksisterende `advanceTimerRef`** — dens cleanup-effekt på `activeIndex`-endring kansellerer allerede ved seek. **Kanseller i tillegg eksplisitt ved `setMapOpen(true)`** (kart-entry endrer ikke `activeIndex`, så den treffer ikke activeIndex-cleanupen). Behold welcome/home auto-advance; outro auto-advancer bevisst IKKE (ingen dobbel-fyr). `handleTrackEnded` deles med desktop (isDesktop-grenen auto-advancer alt) → mobil-kategori-grenen må være mobil-gated så desktop ikke dobbelt-håndteres.
- **B1 — terminologi + gating:** standardiser på **«kart-teaser»** + state-flagg **`teaserArmed`** (ikke bland teaser/glimt/MapGlimt). Gate teaser-synlighet på `state.audioUnlocked` (R18). `teaserArmed` må utledes fra et **varig signal** (phase + track-ended-tilstand), ikke en transient event som kan gå tapt under backgrounding. Teaseren avslører den **samme persistente `BoardMap`-instansen** (som A7 holder montert på historie-flaten).
- **B3 — kontroll-utledning + gating:** `BoardMapControls` rendrer KUN under `has3dAddon` (`BoardMap.tsx` ~498); `hasVoiceOver`/`has3dAddon` utledes INNE i `BoardMap` (~107-114/161), ikke som props. FAB gjenbruker eksisterende `handleModeChange`/`handleCameraModeChange`/`cameraMode`/`showCameraMode`-wiring (ikke re-utled). `has3dAddon=false` → FAB rendrer ingenting (R20) → verifiser at 2D-only kart-flate er brukbar uten chrome. Gate FAB på `surface==='map'` OG `audioUnlocked`. **Legg til test:** drag på kart i Auto → bytter til Fri (`onDragTakeover`), FAB intercepter ikke gesten (R12).
- **B4 — REFRAME R17:** Det finnes INGEN mobil «kategori-grid/preview»-fallback i dag (den UI-en er desktop-only i `DesktopStorySidebar`). Faktisk no-audio-mobil-sti er **splash + basic 3D-intro-flythrough** (`handlePlay` willBasicIntro, `ReportReelsPage` ~455-456). R17 = behold den stien; **render bare ikke transporten** når `firstAudioBearingIndex === -1`. No-audio-grenen wrapper FØR to-flate/A7-render (bypasser surface-logikken). Drop «kategori-grid/preview» + «no-audio-sidebar-empty-state»-referansene (desktop-only).
- **B1/B3 — iOS-unlock:** teaser OG FAB gates på `state.audioUnlocked` i tillegg til sine egne betingelser (pre-unlock = kun splash).

**Residual risks (ce-work overvåker):** advance-timer-race (tapp i vinduet vs utløp) — én ref + cleanup på `activeIndex` + eksplisitt cancel på `setMapOpen(true)`; visibilitychange re-arm av teaser krever varig signal (ikke tapt event); `intro`+`mapOpen` ortogonale (se Plan A A3).
