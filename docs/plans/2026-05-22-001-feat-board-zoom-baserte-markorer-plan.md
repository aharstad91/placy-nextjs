---
title: "feat: Zoom-baserte markører på rapport-board"
type: feat
status: active
date: 2026-05-22
origin: docs/brainstorms/2026-05-22-board-zoom-baserte-markorer-brainstorm.md
---

# feat: Zoom-baserte markører på rapport-board

## Overview

Gjør `BoardMarker` zoom-adaptiv via tre tiers (`dot` → `icon` → `icon+label`). Lav zoom gir små fargede prikker (kollisjons-håndtering); høy zoom gir POI-navn som tekst-label til høyre for ikon-sirkelen (Snapchat-mønster). Aktiv markør viser alltid label uavhengig av zoom — *med unntak* av når desktop `popupMode="mini"` er aktiv (da tar `BoardPOIMiniPopup` over POI-navn-rendering for å unngå dobbel-navn). `BoardPOILabel.tsx` deprecates etter kalibrerings-runden. Kun 2D Mapbox-board (`components/variants/report/board/`); 3D-versjonen er deferred. Spike-modus, ikke produksjon.

## Problem Frame

Dagens `BoardMarker` har to faste tilstander (8×8 px inaktiv, 11×11 = 44 px aktiv) uavhengig av zoom. Ved lav zoom kolliderer ~50 markører over Trondheim sentrum; ved høy zoom forblir markørene anonyme sirkler. Brukeren ber om zoom-driven adaptasjon som matcher Snapchat-Maps' label-mønster.

Brainstormen ratifiserte tre tiers, kun POI-navn på label, standardisert farge, inline-label deprecates `BoardPOILabel`, og parallel-impl mot eksisterende `useMapZoomState` (semantisk inkompatibel med vår per-prop-tilnærming).

## Requirements Trace

**Zoom-tier-modell**

- R1. Tre tiers (`` `dot` ``/`` `icon` ``/`` `icon+label` ``) drevet av kartets zoom-nivå (see origin: `docs/brainstorms/2026-05-22-board-zoom-baserte-markorer-brainstorm.md` R1)
- R2. Kalibrerings-utgangspunkt-terskler (~13, ~16), endelige verdier settes under visuell test (R2)
- R14. Dot-tier hit-area = 24×24 px via padding på ytre marker-div + `overflow: visible`

**Label-utforming**

- R3. Label inneholder kun POI-navn. **Truncation:** `max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` — overflowing navn får ellipsis. (R3)
- R4. Font 10 px som kalibrerings-gulv, `-webkit-font-smoothing: antialiased` aktivert (R4)
- R5. Tekstfarge `stone-900` (`#1c1917`) — samme som dagens `BoardPOILabel`-pille (R5)
- R6. `text-shadow: 0 0 3px rgba(255,255,255,0.9), 0 0 6px rgba(255,255,255,0.6)` (R6)
- R7. **Label er absolute-positioned `<span>` til høyre for ikon-sirkelen** (`position: absolute; left: 100%; top: 50%; transform: translateY(-50%); margin-left: 8px`). Dette holder ikon-sirkelen som eneste bbox-bidragsyter til `<Marker>`-elementet, så `anchor="bottom"` pinner faktisk ikon-sirkelens bunn-senter til POI-koordinaten (ikke midten av flex-row [ikon | label]).
- R8. Label `pointer-events: none` + `aria-hidden="true"` (ikon-sirkel-elementet bærer accessible-name via dets `aria-label`/`role`). Forhindrer dobbel-rendering for skjermlesere og at klikk konkurrerer med ikon-sirkelen.

**Vise/skjule-regel**

- R9. Label vises på markører med `isVisible=true` ved `` `icon+label` ``-tier. Fade-out-markører (`isVisible=false`) viser ikke label — label er child av samme indre div som har `opacity: isVisible ? 1 : 0`, så label arver kategori-fade automatisk. (R9)
- R10. Aktiv markør (klikket POI) viser alltid label, uavhengig av zoom-tier.
  - **På `` `dot` ``-tier:** aktiv markør promoteres visuelt til `` `icon` ``-tier-størrelse (sirkel + ikon) så label har et anker. `<Dot/>` og `<IconCircle/>` rendres begge sentrert på samme x-akse (begge har `position: absolute; left: 50%; transform: translateX(-50%)` inni ytre marker-container) så tap-koordinaten ikke skifter horisontalt ved promotion.
- R10a. Hjem-markøren (`HomeMarker`) får IKKE label-tier — egen visuell identitet (R10).
- R10b. **`BoardPOILabel.tsx` deprecates** når inline-label lander. Inline-label tar over rollen som aktiv-POI-label.
- R10c. **Mini-popup-konflikt-regel** (resolved decision): når `popupMode === "mini"` OG `isActive`, skjul inline-label for den aktive markøren — `BoardPOIMiniPopup` viser allerede `{poi.name}` så inline-label ville duplisert navnet. Inline-label rendres fortsatt for alle non-active markører på `` `icon+label` ``-tier, og for aktiv markør når popup-mode ikke er mini (typisk mobil/sheet-mode).

**Tier-overgang og kalibrering**

- R11. Tier-overgang er CSS opacity-transition (200 ms ease-out) på `<Label/>`-`<span>`-elementet, trigget av endring i `zoomTier`-prop. Tier-fade og kategori-fade kjører parallelt på forskjellige sub-elementer; CSS-opacity multipliseres gjennom DOM-hierarkiet, så samtidige fades komponerer multiplikativt. I praksis akseptabelt fordi simultane kategori+tier-overganger er sjeldne.
- R12. Debug-affordance: `console.log` på zoom-event mens vi kalibrerer; fjernes når terskler er låst (R12).
- R13. **Initial zoom-tier beregnes før første marker-render**: hookens `useState`-initializer leser `mapRef.current?.getMap()?.getZoom()` lazy. Hvis ref er null ved første mount, returnerer `"icon"` som default — det aksepteres som maks-én-render-flash for spike. På 3D→2D-toggle re-mounter Mapbox via 4-state-maskinen; hooken kjører lazy-init på nytt med Mapbox-instansens initial zoom (typisk `pendingCamera.zoom`).

## Scope Boundaries

- **Kun rapport-board** (`components/variants/report/board/`). `AdaptiveMarker`, `useMapZoomState`, ExplorerMap, ReportInteractiveMap, GuideMap, TripMap, admin-kart — alle uberørt.
- **Kun 2D Mapbox** (`BoardMap.tsx` + `BoardMarker.tsx`). 3D Google Maps (`BoardMap3D.tsx`, `Marker3DPin`) er deferred.
- **Threshold-iterasjon foran label-budget**: start ved zoom ≥ 16, hev iterativt hvis kollisjoner. Label-budget kommer kun hvis threshold-justering ikke holder.
- **Ingen kategori-fargede labels**, **ingen rating-badge**, **ingen editorial sparkle**, **ingen interaksjon-endring** (klikk/hover/tooltip).

### Deferred to Separate Tasks

- 3D-versjon (`BoardMap3D.tsx` + `Marker3DPin`): rAF-tween-mønster må gjenbrukes fra `useTweenedOpacities`, egen plan-runde.
- Label-budget hvis threshold-iterasjon ikke holder: kommer som follow-up hvis live-kalibrering avslører kollisjoner.
- Kategori-fargede labels: polish-runde senere.
- "User-initiated zoom only"-gate hvis scripted kamera-bevegelser gir uønsket label-flash.
- Active-label-suppress under audio-tour playback hvis live-test viser det som støy.

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/board/BoardMarker.tsx` — dagens marker. Opacity og transform settes på **indre div** (linje 62-67 i nåværende fil), ikke på ytre `<Marker>` (som kun har `pointerEvents` og `cursor`). Plan-implementasjonen må respektere dette element-hierarkiet.
- `components/variants/report/board/BoardMap.tsx` — kartcontainer (`mapBodyRef`-div omslutter `<Map>`), eier `mapRef`, håndterer `applyIllustratedTheme` ved `onLoad`. Markører rendres via `markerStates.map(...)` (alle POIer alltid, `isVisible`-flag styrer fade).
- `components/variants/report/board/BoardPOILabel.tsx` — eksisterende `<Marker anchor="bottom" offset={[0, -52]}>` som rendrer pille **over** aktiv POI (52 px opp). NB: dette er en posisjonell forskjell fra den nye inline-labelen som sitter **til høyre** for ikon-sirkelen — `BoardPOILabel`-deprecation flytter aktiv-POI-label fra over til siden. Gjør visuell sammenligning i Unit 5 før commit av Unit 4-sletting.
- `components/variants/report/board/BoardPOIMiniPopup.tsx` — desktop-popup for aktiv POI som viser `{poi.name}` blant annet. Eier mini-popup-rendering. Inline-label på aktiv POI undertrykkes for å unngå dobbel-navn (R10c).
- `components/map/adaptive-marker.tsx` — referanse-mønster (DOM-attribute-driven CSS via descendant-selector). Vi bruker IKKE descendant-selector — per-prop er enklere for Board.
- `lib/hooks/useMapZoomState.ts` — referanse-hook (~30 linjer), gir mønster for zoom-event-lytting + cleanup. Vår nye hook er enklere (returnerer React-state istedenfor å skrive DOM-attribute).
- `app/globals.css` linje 342-428 — eksisterende `[data-zoom-state="..."]`-regler. Ikke gjenbrukt; vår CSS er inline / Tailwind i `BoardMarker.tsx`.

### Institutional Learnings

- `docs/solutions/ui-bugs/adaptive-markers-zoom-state-timing-bug-20260208.md` — historisk timing-bug der `useMapZoomState` ikke aktiverte ved mount. Lærdom: zoom-tier-beregning må eksplisitt fyre ved `onLoad`, ikke kun ved zoom-event. Relevant for R13.
- `docs/solutions/ui-bugs/mapbox-markers-invisible-missing-css-EventRoute-20260413.md` — Mapbox-markører usynlig pga manglende CSS. Lærdom: `react-map-gl/mapbox` `<Marker>`-elementer trenger eksplisitt CSS for å vises (default er null styling). Validér at absolute-positioned label får `display: block` eller er inni en `position: relative`-container.
- `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md` — BoardMap bruker samme 2D/3D-toggle-mønster. Lærdom: 2D→3D unmounter Mapbox helt, så 3D→2D må kjøre `onLoad`-stien igjen → R13 (initial zoom-tier ved toggle).

### External References

Ingen — vi har sterke lokale patterns (`AdaptiveMarker` + `BoardMarker` fade).

## Key Technical Decisions

- **Per-prop, ikke DOM-attribute** (transparent rationale): Per-prop er idiomatisk React og enklere å resonnere om for ~50 markører × én re-render per tier-cross. DOM-attribute-mønsteret med scoped CSS hadde også fungert teknisk (Board kunne hatt egen `[data-board-zoom-state]`-blokk uten å forurense globals.css), men gir et lag indireksjon mellom JSX og styling som ikke er verdt det for denne størrelsen. `React.memo` med custom comparator (`poi.id, isVisible, isActive, zoomTier, color, icon`) holder re-render-mengden under kontroll.
- **Ny hook `useBoardZoomTier`, ikke reuse `useMapZoomState`** (with verification, jf. Resolved Open Questions): Den eksisterende hooken signaturen er `(mapRef, containerRef, options) => void` — den skriver `container.dataset.zoomState` og returnerer ingenting. Vår per-prop-tilnærming krever `(mapRef, mapLoaded) => BoardZoomTier`. Å transformere den eksisterende til vårt mønster ville krevd å endre return-type på en hook med to aktive call-sites (ExplorerMap, ReportInteractiveMap) — out-of-scope for spike og forurenser delte komponenter. Ny hook er ~20 linjer.
- **Korriger faktum**: Aktiv `BoardMarker` er `w-11 h-11` = **44 px** (ikke 36 px som tidligere skriv). Inaktiv er `w-8 h-8` = 32 px.
- **Label er absolute-positioned, ikke flex-sibling**: For å bevare `anchor="bottom"`-semantikk (ikon-sirkelens bunn-senter pinnet til POI-koordinaten) ligger label utenfor flex-flow. Inner-container er `position: relative`, label er `position: absolute; left: 100%; margin-left: 8px`. `<Marker>`-bbox forblir lik ikon-sirkel-bbox uansett om label er synlig.
- **`<Dot/>` og `<IconCircle/>` sentrert på samme x-akse**: Begge har `position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%)` inni inner-container. Tap-koordinat (sentrum av begge) flytter ikke når R10-promotion fra dot→icon skjer.
- **DOM-hierarki (korrigert)**: Ytre `<Marker>` har kun `pointerEvents` og `cursor` (uendret). **Inner div** har `position: relative` + `opacity: isVisible ? 1 : 0` (kategori-fade, eksisterende). Inni inner div: `<Dot/>` + `<IconCircle/>` (absolute, centered) + `<Label/>` (absolute, rightward) — alle som søsken. Label arver inner div's `opacity` (kategori-fade) og har egen `opacity` for tier-fade — multipliseres av nettleseren.
- **Lazy useState-init for zoom-tier**: Hookens `useState`-initializer er `() => mapRef.current?.getMap()?.getZoom() != null ? computeZoomTier(mapRef.current.getMap().getZoom()) : "icon"`. Hvis map-ref er klar ved første render, ingen flash. Hvis ikke (typisk Mapbox-mount-rekkefølge), returnerer default `"icon"` og hooken oppdaterer via `useEffect` etter `setMapLoaded(true)` — max én render-cycle flash. Akseptabelt for spike.
- **Alle tre elementer alltid i DOM, opacity-toggled**: `<Dot/>`, `<IconCircle/>`, `<Label/>` rendres alltid (ingen conditional mount). Hver har inline `style.opacity` styrt av `effectiveTier` og `isActive` — `<Dot/>` opacity 1 ved `effectiveTier === "dot"`, ellers 0; `<IconCircle/>` opacity 1 ved `effectiveTier !== "dot"`, ellers 0; `<Label/>` opacity 1 ved (`effectiveTier === "icon+label"` ELLER `isActive`) OG ikke `(popupMode === "mini" && isActive)`. Alle har `transition: opacity 200ms ease-out`. Tier-overgang skjer som CSS-fade.
- **Mini-popup-konflikt-regel (R10c)**: Resolved beslutning — skjul inline-label når `popupMode === "mini" && isActive` for å unngå dobbel-navn-rendering. Aktiv-POI-navn vises via BoardPOIMiniPopup på desktop; via inline-label på mobile (eller andre popup-modes).
- **Aktiv-label i tour-mode**: R10 promotion gjelder også under audio-tour. Aktive POIer under tour-playback viser label uansett zoom-tier. Hvis dette gir visuell støy ved auto-advance, suppress via `tourActive && isActive`-condition er deferred follow-up — vurdert ved live-kalibrering i Unit 5.
- **Tier-fade og kategori-fade multipliseres**: Begge er opacity-transitions på forskjellige sub-elementer. CSS-opacity nestes multiplikativt (ikke max-merge). I praksis er samtidige overganger sjeldne, og den multiplikative kombinasjonen er visuelt akseptabel. Verifiseres som spesifikt scenario i Unit 5.
- **`BoardPOILabel` deprecates ETTER kalibrering**: Unit 5 kalibrerer FØR Unit 4 sletter, slik at vi kan fallbacke til pille-mønsteret hvis inline-label-på-aktiv-POI feiler visuelt (jf. swap i Implementation Units-rekkefølge).
- **Debug-console.log som conditional const**: Hardkodet `const DEBUG_ZOOM = true` i `useBoardZoomTier`. Hvis ESLint `no-console` aktivert, bruk `// eslint-disable-next-line no-console` på linja — spike-pragmatisk.

## Open Questions

### Resolved During Planning

- **Reuse `useMapZoomState` eller ny hook?** Ny hook. **Verifisering**: Den eksisterende hooken returnerer `void` og skriver til `container.dataset.zoomState`. Vår per-prop-tilnærming krever React-state-return per markør. Å endre return-type ville berørt to call-sites (ExplorerMap, ReportInteractiveMap) som er out-of-scope. Ny `useBoardZoomTier` er ~20 linjer. Konklusjon: parallel impl rasjonelt.
- **Label-element type (`<div>` absolute vs `<span>` flex)?** `<span>` med `position: absolute` (R7) — ikke flex-sibling. Bevarer `anchor="bottom"`-semantikk.
- **Anchor-strategi**: `<Marker anchor="bottom">` bevares, men label er utenfor `<Marker>`-bbox via absolute positioning — ikon-sirkelens bbox dominerer.
- **Mini-popup-konflikt**: Skjul inline-label når `popupMode === "mini" && isActive` (R10c) — BoardPOIMiniPopup viser allerede POI-navn.
- **Single PR for inline-label + BoardPOILabel-deprecation, eller to-trinns?** Two-step *innenfor samme PR*: Unit 2 implementerer inline-label, Unit 5 kalibrerer, Unit 4 sletter pille. Slik kan kalibrering avdekke feil før sletting.
- **Truncation av lange POI-navn**: `max-width: 120px; overflow: hidden; text-overflow: ellipsis` (R3).
- **Default zoomTier pre-load**: `"icon"` fallback hvis map-ref er null ved init; lazy-init prøver `map.getZoom()` først. Max én render-flash akseptert (R13).

### Deferred to Implementation

- **POI-tetthet ved zoom 16 på Trondheim sentrum-demo**. Måles i Unit 5 kalibrering. Hvis >8–10 POIs typisk synlig → label-budget må re-vurderes som hot follow-up.
- **`text-shadow`-formel mot `applyIllustratedTheme`-paletten**. Snap screenshot under Unit 5; juster halo hvis kontrast er svak. Default `0 0 3px rgba(255,255,255,0.9)` antas å holde.
- **Eksakte zoom-terskler** (R2). Start `` `dot` ``<13, `` `icon` ``13–16, `` `icon+label` ``≥16. Kalibreres i Unit 5.
- **Visuell sammenligning av pille (52 px over) vs inline (8 px høyre) for aktiv-POI**: Snap side-by-side screenshots i Unit 5 før Unit 4-sletting. Eier-ansvar: Unit 5.
- **Active-label-suppress under audio-tour**: Hvis live-test viser at auto-advance-labels gir støy, implementer suppress.
- **Requirements grouping**: Vurder tema-grupper i origin-brainstorm-stil (Zoom-tier-modell / Label-utforming / Vise-skjule-regel / Tier-overgang & Kalibrering) for navigerbarhet. Polish — ingen funksjonell konsekvens.
- **Label margin-shift ved 32→44 px aktiv-promotion**: Label flytter 12 px til høyre når icon-circle utvider seg. Akseptér eller skift til fixed-offset relativt til icon-circle-senter som polish.
- **ESLint `no-console`**: Verifiser at `console.log` i `useBoardZoomTier` passerer pre-commit. Bruk `eslint-disable-next-line` på linja om nødvendig.

## High-Level Technical Design

> *Dette illustrerer datafly og prop-propagering — directional guidance, ikke implementasjons-spec.*

```
[Mapbox Map]
  │
  │  map.on("zoom") → computeZoomTier(zoom)
  │  (initial zoom via lazy useState-init: map.getZoom() når mapRef.current finnes)
  │
  v
[BoardMap]                ─────────► useBoardZoomTier(mapRef, mapLoaded)
  │                                   returns: `dot` | `icon` | `icon+label`
  │
  │  passes zoomTier prop to each marker
  │
  v
[BoardMarker]
  │
  │  effectiveTier = isActive && zoomTier === `dot` ? `icon` : zoomTier
  │
  │  <Marker anchor="bottom" /> ─── pointerEvents only
  │    └── <innerDiv style.opacity = isVisible ? 1 : 0, position: relative>  ─── kategori-fade
  │          ├── <Dot/>        ─ absolute, centered. opacity 1 ved effectiveTier=`dot`
  │          ├── <IconCircle/> ─ absolute, centered. opacity 1 ved effectiveTier ≠ `dot`
  │          └── <Label/>      ─ absolute, left: 100%, ml-8px.
  │                              opacity 1 ved (effectiveTier=`icon+label` || isActive)
  │                                       og ikke (popupMode="mini" && isActive)
  │
  └─ alle tre alltid i DOM, opacity-toggled, CSS transition 200ms ease-out
```

Tier-overgang skjer som CSS opacity-transition. Eksisterende kategori-fade (`isVisible`) ligger på inner-div og påvirker label via opacity-arv. Tier-fade-opacity (på label) og inner-div-opacity (kategori-fade) multipliseres av nettleseren.

## Implementation Units

- [ ] **Unit 1: `useBoardZoomTier`-hook**

**Goal:** Lytt på Mapbox `zoom`-event og returner gjeldende tier som React-state. Initial-tier beregnes lazy via `useState`-initializer; oppdateres ved `mapLoaded=true` og ved hver zoom-overgang.

**Requirements:** R1, R2, R12, R13

**Dependencies:** Ingen

**Files:**
- Create: `components/variants/report/board/use-board-zoom-tier.ts`

**Approach:**
- Hook tar `mapRef: React.RefObject<MapRef>` og `mapLoaded: boolean` som input.
- Eksporter type `BoardZoomTier = "dot" | "icon" | "icon+label"`.
- `computeZoomTier(zoom: number): BoardZoomTier` — pure function, eksporteres. Konstanter `DOT_BREAKPOINT = 13`, `LABEL_BREAKPOINT = 16` eksporteres for testbarhet og fremtidig kalibrering.
- `useState`-initializer er lazy: `() => { const z = mapRef.current?.getMap()?.getZoom(); return z != null ? computeZoomTier(z) : "icon"; }`. Hvis map-ref er klar ved første render — ingen flash. Hvis ikke, fallback `"icon"`.
- `useEffect` (avhengig av `mapLoaded`): når `mapLoaded` er true og `mapRef.current` finnes, kalkuler tier på nytt via `map.getZoom()` (dekker tilfellet der lazy-init ikke fant ref). Lytter på `map.on("zoom", updateTier)`.
- `useRef`-guard mot duplicate setState ved samme tier (matcher `useMapZoomState`-mønsteret).
- `DEBUG_ZOOM` const øverst: `if (DEBUG_ZOOM) console.log("[BoardZoomTier]", zoom.toFixed(2), "→", newTier)`. Default `true`, settes `false` ved feature-done. Bruk `// eslint-disable-next-line no-console` om nødvendig.
- Cleanup: `map.off("zoom", ...)` i useEffect-return.

**Patterns to follow:**
- `lib/hooks/useMapZoomState.ts` — event-listener-mønster, `useRef`-guard mot duplicate state-updates, cleanup-pattern.
- `components/variants/report/board/use-tweened-opacities.ts` — Board-spesifikk hook-konvensjon (filnavn `use-*.ts` i samme mappe som komponenten).

**Test scenarios:**
- Happy path: ved mount med `map.getZoom() = 11`, hooken returnerer `"dot"`.
- Happy path: ved mount med `map.getZoom() = 14`, returnerer `"icon"`.
- Happy path: ved mount med `map.getZoom() = 17`, returnerer `"icon+label"`.
- Operator-edge: Verifiser at `computeZoomTier(DOT_BREAKPOINT - 0.001) === "dot"` og `computeZoomTier(DOT_BREAKPOINT) === "icon"`. (Tester `>=`-operator, ikke eksakt verdi — slik at break-points kan kalibreres uten å bryte tester.)
- Operator-edge: Verifiser at `computeZoomTier(LABEL_BREAKPOINT - 0.001) === "icon"` og `computeZoomTier(LABEL_BREAKPOINT) === "icon+label"`.
- Edge case: `mapLoaded = false` ved mount → returnerer default-tier (`"icon"`) og setter ikke opp listener før `mapLoaded = true`.
- Edge case: rapid zoom (60fps gestures) → setState fyrer kun ved faktisk tier-endring (verifiser via `useRef`-guard).
- Cleanup: unmount kaller `map.off("zoom", ...)`.
- Test expectation: Skriv `__tests__/use-board-zoom-tier.test.ts` med Vitest hvis enkelt; ellers defer til manuell sjekk via Unit 5 og console.log.

**Verification:**
- I dev-server: kart-load logger initial-tier matchende zoom 13.5 (`"icon"`). Manuell zoom inn/ut krysser tier-grenser, console.log viser overgang én gang per kryssing.

---

- [ ] **Unit 2: Utvid `BoardMarker.tsx` med `zoomTier`-prop, inline-label og dot-rendering**

**Goal:** Markøren tar imot `zoomTier`-prop og rendrer dot, ikon-sirkel og inline-label som alle alltid er i DOM. Aktiv markør overstyrer dot-tier. Mini-popup-konflikt-regel respekteres.

**Requirements:** R1, R3, R4, R5, R6, R7, R8, R9, R10, R10c, R11, R14

**Dependencies:** Unit 1 (hook eksporterer type `BoardZoomTier`)

**Files:**
- Modify: `components/variants/report/board/BoardMarker.tsx`

**Approach:**
- Legg til props: `zoomTier: BoardZoomTier`, `suppressLabel: boolean` (for mini-popup-konflikt-regel — `BoardMap.tsx` beregner og passer inn). Import type fra `./use-board-zoom-tier`.
- Beregn render-mode: `const effectiveTier = isActive && zoomTier === "dot" ? "icon" : zoomTier`. Dette implementerer R10 (aktiv promoteres fra dot til icon).
- DOM-hierarki:
  - Ytre `<Marker>`: `pointerEvents`, `cursor`, `zIndex`. **Ingen opacity her** (samme som dagens).
  - **Inner div** (`position: relative` + `padding: 8px` + `overflow: visible` for R14): har `opacity: isVisible ? 1 : 0` + `transition: opacity 300ms` (kategori-fade, eksisterende).
  - **Innenfor inner div**, tre absolute-positioned søsken-elementer:
    - `<Dot/>`: 8 px farget prikk (kalibrerings-start; 6-8 px range), `position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%)`, `opacity` basert på `effectiveTier === "dot"`. Bakgrunn `color` (kategori-farge, fortsatt fra mutedColor-utility).
    - `<IconCircle/>`: dagens sirkel (32 px standard / 44 px aktiv). Samme centering-mønster (`position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%)`). `opacity` basert på `effectiveTier !== "dot"`. Tap-koordinat (sentrum) er identisk med `<Dot/>` — promotion-overgang forskyver ikke klikk-anker.
    - `<Label/>` (`<span>`): `position: absolute; left: 100%; top: 50%; transform: translateY(-50%); margin-left: 8px`, `opacity` basert på (`effectiveTier === "icon+label"` ELLER `isActive`) OG IKKE `suppressLabel`. Stilarter: `font-size: 10px`, `font-weight: 600`, `color: stone-900`, `text-shadow: 0 0 3px rgba(255,255,255,0.9), 0 0 6px rgba(255,255,255,0.6)`, `-webkit-font-smoothing: antialiased`, `white-space: nowrap`, `max-width: 120px`, `overflow: hidden`, `text-overflow: ellipsis`, `pointer-events: none`. Attributter: `aria-hidden="true"`.
- Alle tre absolute-elementer har `transition: opacity 200ms ease-out` (R11). Label-opacity multipliseres med inner-div-opacity (kategori-fade) av nettleseren — så label fader ut når markøren fader ut, uten ekstra logikk.
- `React.memo` med custom comparator: `(prev, next) => prev.poi.id === next.poi.id && prev.color === next.color && prev.icon === next.icon && prev.isActive === next.isActive && prev.isVisible === next.isVisible && prev.zoomTier === next.zoomTier && prev.suppressLabel === next.suppressLabel`.
- Hjem-markøren er en separat komponent (`HomeMarker.tsx`) — ingen endringer der (R10a).

**Patterns to follow:**
- Eksisterende `BoardMarker.tsx` (commit `d9dc703`) — inline `style` opacity/transform-pattern, `isActive`-størrelse-styring, opacity på inner-div.
- `components/map/adaptive-marker.tsx` — slot-struktur (dot, icon, label som søsken). NB: AdaptiveMarker bruker DOM-attribute-pattern, vår er per-prop.

**Test scenarios:**
- Happy path: `zoomTier="dot"`, `isActive=false`, `isVisible=true`, `suppressLabel=false` → kun `<Dot/>` opacity 1; `<IconCircle/>` og `<Label/>` opacity 0.
- Happy path: `zoomTier="icon"`, `isActive=false` → `<IconCircle/>` opacity 1; `<Dot/>` og `<Label/>` opacity 0.
- Happy path: `zoomTier="icon+label"`, `isActive=false` → `<IconCircle/>` + `<Label/>` opacity 1; `<Dot/>` opacity 0.
- R10 promotion: `zoomTier="dot"`, `isActive=true`, `suppressLabel=false` → `<IconCircle/>` + `<Label/>` opacity 1 (effektiv-tier blir `"icon"`, isActive trigger label).
- R10c suppression: `zoomTier="icon+label"`, `isActive=true`, `suppressLabel=true` → `<IconCircle/>` opacity 1; `<Label/>` opacity 0 (selv om alle øvrige label-betingelser er oppfylt).
- R9 gating: `zoomTier="icon+label"`, `isActive=false`, `isVisible=false` → inner-div opacity 0 fader hele markøren (inkl. label-arv).
- Anchor-test (visuell): rendrer markør med synlig label ved zoom 17; sjekk at ikon-sirkelens bunn-senter pinner POI-koordinaten (label flyter ut til høyre uten å skifte ikon-posisjon).
- Click-target: dot-tier-markør klikkbar innenfor 24×24 hit-area (padding-8 på inner-div). Klikk på label-span trigger IKKE `onClick`.
- Tier-overgang: bytt `zoomTier` fra `"icon"` til `"icon+label"`; label fader inn over ~200ms (verifiser via Chrome DevTools getComputedStyle-sampling).
- Edge case: lang POI-name (>30 tegn) → label trunkereres med ellipsis ved 120 px.
- Test expectation: Manuell visuell verifisering via dev-server (R12 console.log + screenshots) er primary test.

**Verification:**
- Screenshot fra Chrome viser tre tier-states: zoom 11 (dots), zoom 14 (icons), zoom 17 (icons + labels).
- Aktiv markør viser label ved alle tre tiers (klikk på POI ved zoom 11 → markøren har icon + label).
- Aktiv POI på desktop med `popupMode="mini"` viser IKKE inline-label (mini-popup viser navn istedenfor).
- Klikk-target funker på dot-tier-markør på mobil.

---

- [ ] **Unit 3: Koble `useBoardZoomTier` inn i `BoardMap.tsx`**

**Goal:** BoardMap kaller hooken, beregner `zoomTier` og `suppressLabel`-per-markør, propagerer som props.

**Requirements:** R10c, R11, R12, R13

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `components/variants/report/board/BoardMap.tsx`

**Approach:**
- Importer `useBoardZoomTier` fra `./use-board-zoom-tier`.
- Kall `const zoomTier = useBoardZoomTier(mapRef, mapLoaded)` etter `useState`-deklarasjoner.
- For hver `<BoardMarker>` i `markerStates.map(...)`, beregn `suppressLabel`-prop: `const suppressLabel = popupMode === "mini" && state.activePOIId === poi.id`. Pass `zoomTier={zoomTier}` og `suppressLabel={suppressLabel}`.
- R13 — initial-state: hookens lazy `useState`-initializer + `useEffect`-retry ved `mapLoaded=true` dekker både første mount og 3D→2D-toggle (Mapbox unmountes og re-mountes via 4-state-machine, `mapLoaded` resetes til false og settes true igjen).
- Ingen endringer på `markerStates`, `visiblePOIs`, eller tour-fitBounds-logikken.

**Patterns to follow:**
- `useBoard()`-pattern: hooken returnerer state, propageres som props. Ingen Zustand-ekspansjon nødvendig.

**Test scenarios:**
- Happy path: page-load på board-side med default zoom 13.5 → alle markører rendres med `zoomTier="icon"` umiddelbart (lazy-init treffer hvis mapRef.current er ready ved første render). Max én render-flash ellers.
- Toggle 2D→3D→2D: tilbake i 2D bruker `pendingCamera.zoom` (typisk fallbackZoom ~14.3), hooken re-evaluerer → tier matcher.
- Manuell zoom: scroll-zoom inn fra 13.5 → 17 logger tier-overganger ved 13 og 16-grenser (console.log fra Unit 1).
- Edge case: rask zoom (pinch-gesture mobil) som krysser to tier-grenser på <300ms → tier oppdaterer to ganger, marker-fader følger med.
- Integration: under audio-tour-fitBounds (`maxZoom: 15.5`) holder tier seg på `"icon"` (under 16-terskel). Verifiserer at scripted zoom ikke uintended trigger `icon+label`-tier i tour-mode.
- Mini-popup-konflikt: klikk POI på desktop → `state.activePOIId` settes, `popupMode === "mini"` → `suppressLabel=true` for den ene markøren. BoardPOIMiniPopup rendres med POI-navn.

**Verification:**
- Manuell test: page-load → max én render-cycle med default tier før korrekt tier settes; ikke synlig kvalitet-tap.
- Toggle 2D→3D→2D bevarer tier-konsistens.
- Tour-mode kjører gjennom kategorier uten label-flash (zoom holder seg ≤ 15.5).
- Aktiv POI på desktop: kun mini-popup viser navn (inline-label suppressed).

---

- [ ] **Unit 4: Kalibrering og verifikasjon** *(swap rekkefølge — kommer FØR sletting)*

**Goal:** Visuell test av tre tiers, justere terskler basert på live-feedback, og adressere deferred Open Questions (POI-tetthet ved zoom 16, text-shadow vs illustrert-palett, mini-popup-konflikt, pille-vs-inline-sammenligning). **Denne unit kommer før sletting av `BoardPOILabel`** så vi kan fallbacke til pille-mønsteret hvis inline-label-strategien feiler visuelt.

**Requirements:** R2, R12, samt alle "Deferred to Implementation"-questions

**Dependencies:** Unit 1, Unit 2, Unit 3

**Files:**
- Modify: `components/variants/report/board/use-board-zoom-tier.ts` (justere konstanter, sett `DEBUG_ZOOM=false`)
- Modify: `components/variants/report/board/BoardMarker.tsx` (eventuell text-shadow / font-justering)
- Update worklog: `PROJECT-LOG.md`

**Approach:**
- Start dev-server (`npm run dev`). Verifiser at console.log fra `useBoardZoomTier` viser zoom-tier-overganger.
- **Kalibreringsoppgave 1 — POI-tetthet ved zoom 16 (Deferred fra brainstorm):** Last board-page for StasjonsKvartalet-prosjektet (typisk default-demo for board-spike — verifiser med `data/projects/klp-eiendom/`). I dev-tools console: `mapboxgl.Map`-instansen kan nås via window.debug-hook eller direkte via Mapbox-ref. Kjør `map.setZoom(16)`. Tell antall POI-markører i viewport (visuelt eller via `document.querySelectorAll('.mapboxgl-marker').length` minus non-POI-markører). Hvis >10, vurder å heve `LABEL_BREAKPOINT` til 16.5 eller 17, eller flag label-budget som hot follow-up.
- **Kalibreringsoppgave 2 — text-shadow mot illustrert palett:** Snap screenshot av label på flere ulike tile-flater (vei, bygning, grønt-område, parkering). Hvis hvit halo er for svak på lyse områder, prøv `0 0 4px rgba(255,255,255,1.0)` eller legg til drop-shadow `0 1px 2px rgba(0,0,0,0.2)`.
- **Kalibreringsoppgave 3 — mini-popup-konflikt-validering:** Klikk POI på desktop. Verifiser at inline-label ER suppressed (R10c-regelen fungerer) og at BoardPOIMiniPopup viser navnet. Bytt til mobile-viewport: aktiv POI får inline-label (popup-mode ikke "mini"), og evt. mobile-sheet håndterer detalj-rendering.
- **Kalibreringsoppgave 4 — pille-vs-inline-sammenligning:** Snap side-by-side screenshots av (a) dagens BoardPOILabel-pille (52 px over markør) og (b) ny inline-label (8 px høyre). Hvis inline-label-mønsteret feiler visuelt eller funksjonelt → revert til pille (behold BoardPOILabel.tsx, fjern inline-label-rendering fra Unit 2, skip Unit 5).
- **Kalibreringsoppgave 5 — Tier-overgang smooth:** Scroll-zoom inn fra 12 til 18 jevnt. Tier-overganger ved 13 og 16 skal ikke poppe — labels fader inn over 200 ms.
- **Kalibreringsoppgave 6 — Multiplikativ opacity-sjekk:** Trig kategori-skift mens zoom er nær 16-terskel. Verifiser at samtidig kategori-fade-ut og tier-fade-ut/in på label ikke gir rare overganger.
- **Kalibreringsoppgave 7 — Dot-tier tap-target på mobil:** Bytt til mobile-viewport i Chrome DevTools (touch-emulering), test om dot-markører er klikkbare innenfor 24×24 hit-area.
- **Kalibreringsoppgave 8 — Active-label under audio-tour:** Trig tour-playback, observer aktive POIer som auto-advance. Hvis labels er støy under playback → flag suppress-under-tour som follow-up.
- Etter kalibrering: sett `DEBUG_ZOOM = false`. Oppdater eksakte terskel-konstanter hvis flyttet.
- Skriv worklog-entry i `PROJECT-LOG.md`.

**Patterns to follow:**
- Tidligere kalibrerings-iterasjoner: commit `8180729 set dot→icon threshold to zoom 13`.
- Worklog-mønster fra commit `d9dc703 feat(rapport-board): fade-animasjon`.

**Test scenarios:**
- Visuell sjekk: tre screenshots (zoom 11, 14, 17) viser tre tier-states tydelig.
- Visuell sjekk: aktiv POI ved zoom 11 viser icon + label (R10 promotion).
- Visuell sjekk: aktiv POI på desktop med mini-popup viser IKKE inline-label (R10c).
- Visuell sjekk: tier-overgang ved sakte scroll-zoom har ingen popping.
- Visuell sjekk: pille-vs-inline-sammenligning lagret som side-by-side screenshot, beslutning ratifisert.
- Mobile sjekk: dot-tier-markører er tappbare.
- Worklog: PROJECT-LOG.md inneholder ny entry datert 2026-05-22.

**Verification:**
- 6+ screenshots tatt og lagret som `screenshot-zoom-tier-*.png`.
- `DEBUG_ZOOM = false` committed.
- Worklog oppdatert.
- Alle 5 success criteria fra brainstormet er sjekket av.
- **Go/no-go-beslutning på Unit 5**: hvis kalibrering bekrefter inline-label-strategien, går vi til Unit 5 (sletting). Hvis ikke, behold BoardPOILabel og skip Unit 5.

---

- [ ] **Unit 5: Deprecate `BoardPOILabel.tsx`** *(swap rekkefølge — siste etter kalibrering)*

**Goal:** Slett `BoardPOILabel.tsx` og dens JSX-referanse i `BoardMap.tsx`. **Unit 5 kjøres kun hvis Unit 4-kalibrering bekrefter at inline-label-strategien fungerer som aktiv-POI-label-erstatning.**

**Requirements:** R10b

**Dependencies:** Unit 4 (kalibrering må bekrefte go/no-go)

**Files:**
- Delete: `components/variants/report/board/BoardPOILabel.tsx`
- Modify: `components/variants/report/board/BoardMap.tsx` (fjern import + JSX-bruk)

**Approach:**
- Verifiser via grep at `BoardPOILabel` kun importeres i `BoardMap.tsx`: `grep -r "BoardPOILabel" components/ lib/ app/`. Hvis det finnes andre call-sites, oppdater dem.
- Slett `import { BoardPOILabel }` fra `BoardMap.tsx`.
- Slett `<BoardPOILabel />` JSX-referansen.
- Slett `components/variants/report/board/BoardPOILabel.tsx`.
- Manuell visuell sjekk: aktiv POI viser nå kun inline-label fra `BoardMarker` (eller mini-popup på desktop).
- Hvis Unit 4 flagget no-go på inline-strategien: SKIP denne unit, behold BoardPOILabel, og revert eventuelt inline-label-rendering fra Unit 2.

**Patterns to follow:**
- Eksisterende slett-mønster fra commit `2fc3a1e refactor(rapport-board): slett legacy mobile-filer + BoardPOIDetails`.

**Test scenarios:**
- Happy path: klikk POI på mobil → aktiv POI viser inline-label, ingen pille.
- Happy path: klikk POI på desktop → mini-popup tar over navn-visningen, ingen pille, ingen inline-label på aktiv POI (suppressLabel-regelen).
- Build-check: `npx tsc --noEmit` passerer (ingen dangling imports).
- Lint-check: `npm run lint` passerer.

**Verification:**
- `grep -r "BoardPOILabel" components/ lib/ app/` returnerer 0 treff.
- Board-side rendres uten errors.
- TypeScript-build passerer.

## System-Wide Impact

- **Interaction graph:** `BoardMarker` får to nye props (`zoomTier`, `suppressLabel`) propagert fra `BoardMap`. Ingen andre komponenter berøres direkte; `BoardPOIMiniPopup` får implisitt rolle som aktiv-POI-navn-rendrer på desktop. `HomeMarker`, `BoardPathLayer`, `BoardPathMidpointMarker` uberørt.
- **Error propagation:** Hooken `useBoardZoomTier` har null-safe map-ref-håndtering. Hvis `mapRef.current` er null, lazy-init returnerer default-tier (`"icon"`); useEffect-retry henter ekte verdi når mapLoaded settes true.
- **State lifecycle risks:** 2D→3D→2D-toggle re-mounter Mapbox; hooken kjører lazy-init + useEffect-retry på nytt. Verifisert i Unit 3.
- **API surface parity:** Ingen — alle endringer er Board-interne.
- **Integration coverage:**
  - Audio-tour-fitBounds (`maxZoom: 15.5`) verifiseres i Unit 3 test-scenario — scripted zoom skal IKKE trigger `icon+label`-tier i tour-mode.
  - **Active-label i tour-mode**: Aktive POIer under tour-playback viser label uansett zoom-tier (R10 promotion). Hvis dette gir visuell støy → suppress under `tourActive` er deferred follow-up (vurdert i Unit 4 kalibreringsoppgave 8).
  - Mini-popup vs inline-label på desktop: `popupMode === "mini"` deaktiverer inline-label på aktiv POI (R10c).
- **Unchanged invariants:** `AdaptiveMarker`, `useMapZoomState`, ExplorerMap, ReportInteractiveMap, GuideMap, TripMap, og admin-kart får ingen endringer. Eksisterende `[data-zoom-state="..."]`-CSS-regler i `globals.css` (linje 342-428) uberørt.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Inline-label på aktiv POI fungerer visuelt verre enn dagens 52 px-over-pille | Unit 4 kalibrerings-oppgave 4 sammenligner side-by-side før Unit 5 sletter pillen. Fallback: behold BoardPOILabel + skip Unit 5 |
| Mini-popup-konflikt gir dobbel-navn-rendering | R10c-regel: `popupMode === "mini" && isActive` suppresser inline-label. Verifisert i Unit 4 |
| Tier-flash ved første render hvis lazy-init ikke finner map-ref | Akseptert som max-1-render-flash for spike; useEffect-retry henter ekte tier umiddelbart etter |
| Anchor-geometri bryter eksisterende posisjonering | Absolute-positioned label utenfor flex-flow holder `<Marker>`-bbox lik ikon-sirkel-bbox — `anchor="bottom"` semantikk uendret |
| Per-prop-mønsteret gir for mange re-renders ved zoom-overgang | `React.memo` på `BoardMarker` med custom comparator (~50 markører × én re-render per tier-cross = akseptabelt) |
| POI-tetthet ved zoom 16 produserer label-kollisjoner | Threshold-iterasjon i Unit 4; label-budget som hot follow-up |
| Tap-koordinat forskyves ved R10 dot→icon-promotion | `<Dot/>` og `<IconCircle/>` sentrert på samme x-akse i inner-container → samme klikk-anker uansett tier |
| Tier-fade og kategori-fade multipliseres uvelkommen | I praksis akseptabelt; verifisert som spesifikt scenario i Unit 4 kalibrerings-oppgave 6 |
| Label kolliderer med ESLint `no-console` ved DEBUG_ZOOM | `// eslint-disable-next-line no-console` på linjen, fjernes med `DEBUG_ZOOM = false` |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-22-board-zoom-baserte-markorer-brainstorm.md](../brainstorms/2026-05-22-board-zoom-baserte-markorer-brainstorm.md)
- Related code:
  - `components/variants/report/board/BoardMarker.tsx`
  - `components/variants/report/board/BoardMap.tsx`
  - `components/variants/report/board/BoardPOILabel.tsx`
  - `components/variants/report/board/BoardPOIMiniPopup.tsx`
  - `components/map/adaptive-marker.tsx` (reference pattern)
  - `lib/hooks/useMapZoomState.ts` (reference pattern)
  - `app/globals.css` linje 342-428 (existing `[data-zoom-state="..."]` CSS, uberørt)
- Related solutions docs:
  - `docs/solutions/ui-bugs/adaptive-markers-zoom-state-timing-bug-20260208.md`
  - `docs/solutions/ui-bugs/mapbox-markers-invisible-missing-css-EventRoute-20260413.md`
  - `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md`
- Recent commits for context:
  - `d9dc703 feat(rapport-board): fade-animasjon på kart-markører ved kategori-skifte`
  - `8180729 style: set dot→icon threshold to zoom 13` (historisk kalibrering)
  - `c9ff333 style: disable rating badges and name labels on map markers` (historisk labels-deaktivering)
