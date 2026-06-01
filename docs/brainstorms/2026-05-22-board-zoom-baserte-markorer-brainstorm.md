---
date: 2026-05-22
topic: board-zoom-baserte-markorer
---

# Zoom-baserte markører på rapport-board

## Problem Frame

Board-kartet (rapport-board-spike) viser POI-markører i to faste tilstander: 8×8 (inaktiv) og 11×11 (aktiv) — uavhengig av zoom-nivå. To problemer:

1. **Ved lav zoom** (oversiktsmodus, hele byen i viewport): mange markører i én klynge gir kollisjoner og visuell støy — markørene konkurrerer om plass og er vanskelige å lese (typisk eksempel: ~50 markører fordelt over Trondheim sentrum ved zoom < 13, kategorier overlapper og ikon-detaljer går tapt).
2. **Ved høy zoom** (nær-modus, gate-/kvartal-nivå): brukeren har eksplisitt vist interesse for de få markørene som er igjen i viewport, men markøren forblir en anonym farget sirkel — navnet er bare tilgjengelig etter klikk.

Hypotesen er at zoom-nivået er et sterkt signal på brukerens interessenivå, og bør drive både *informasjonsmengden* og *visuell tetthet* per markør. **Snapchat-mønsteret** (referansebilde fra Snapchat-Maps) viser dette: ved nær-zoom rendres POI-navn som tekst-label horisontalt ved siden av en sirkulær markør/thumbnail. Labelen står ikke under markøren, font-størrelsen er lav, og fargen står i kontrast til kart-bakgrunnen.

Kartmotoren har allerede `AdaptiveMarker` + `useMapZoomState` som løser et lignende problem for Explorer/ReportInteractiveMap, men labels er deaktivert der i dag (`computeZoomState` returnerer kun `"dot"` eller `"icon"` — `"icon-rating"` og `"full-label"` er definert i typesignaturen men dormant). Board-kartet bruker en parallell, enklere implementasjon (`BoardMarker.tsx`) og må få sin egen versjon av samme mønster.

## Requirements

**Zoom-tier-modell** (terminologi: `tier` = zoom-state. State-navn skrives alltid i backticks: `dot`, `icon`, `icon+label`.)
- R1. Tre `tier`s, drevet av kartets zoom-nivå:
  - `dot` (zoom < ~13): liten farget prikk (6–8 px visuelt). Ingen ikon, ingen ring. **Hit-area er 24×24 px** via padding på ytre marker-div + `overflow: visible` på `<Marker>`-wrapper, så tap-target ikke regresjonerer på mobil.
  - `icon` (~13 ≤ zoom < ~16): dagens BoardMarker-sirkel med kategori-ikon (~32 px, beholder fade og active-state).
  - `icon+label` (zoom ≥ ~16): ikon-sirkel + POI-navn som tekst-label ved siden.
- R2. Eksakte break-points er **kalibrerings-utgangspunkt**, ikke endelige — vi flytter dem under visuell test (jf. R12).

**Label-utforming**
- R3. Labelen inneholder kun POI-navn — ingen kategori, ingen travel time, ingen rating.
- R4. Font-size starter på 10 px som kalibrerings-gulv. 10 px ligger under browser-standard 12 px-floor; aksepter at sub-12 px krever eksplisitt `-webkit-font-smoothing: antialiased` og kan trenge justering opp til 11–12 px under kalibrering.
- R5. Tekstfarge er standardisert (ikke kategori-farget): **`stone-900` (`#1c1917`)** — samme verdi som dagens `BoardPOILabel`-pille bruker. Én farge for alle labels i denne iterasjonen.
- R6. Tekst har `text-shadow` for halo/kontrast mot kart-bakgrunn. **Default:** `text-shadow: 0 0 3px rgba(255,255,255,0.9), 0 0 6px rgba(255,255,255,0.6)` (dobbel hvit halo). Matcher kontrast-rom i den illustrerte Mapbox-paletten Board bruker.
- R7. Layout: label rendres horisontalt ved siden av ikon-sirkelen (matcher Snapchat-mønsteret), ikke under. **Default impl:** `<Marker anchor="bottom">` bevares som i dag, label er en `<span>`-søsken til ikon-sirkelen i et flex-row container. Coordinate-pin sitter dermed under venstre kant av label-strukturen (matcher Snapchat hvor pin er under thumbnail, ikke under tekst).
- R8. Label-tekst er ikke-interaktiv (`pointer-events: none`) — kun ikon-sirkelens bbox tar klikk. Click-target endrer seg ikke når label kommer/går.

**Vise/skjule-regel**
- R9. Ved `icon+label`-tier får **alle markører med `isVisible=true`** label. Markører som er midt i fade-out (`isVisible=false`) viser ikke label, slik at label følger markørens egen synlighet under kategori-overganger. Ingen label-budget i v1 — kalibrerings-strategien (R2) flytter terskelen opp hvis kollisjoner oppstår.
- R10. **Aktiv markør** (klikket POI) viser alltid label, uavhengig av zoom-tier.
  - **På `dot`-tier:** aktiv markør promoteres visuelt til `icon`-tier-størrelse (sirkel + ikon) så labelen har et anker å stå ved siden av. Speiler hvordan `AdaptiveMarker` håndterer aktiv-dot-state.
  - **Hjem-markøren får IKKE label-tier i v1**: HomeMarker har egen visuell identitet (større sirkel + hus-ikon) og er forventet kontekst for leseren — å labele "Hjem" konstant i kartet ville være redundant. Eksplisitt valg, ikke utelatelse.
  - **`BoardPOILabel.tsx` (eksisterende pille som rendres på offset `[0, -52]` over aktiv POI) deprecates** når denne featuren lander. Inline-label tar over rollen som "aktiv POI-label" — én label-surface, ikke to.
- R11. Tier-overgang er **CSS opacity-transition** på label-elementet (200ms ease-out), trigget av endring i `zoomTier`-prop på BoardMarker. **2D bruker CSS-transition** (gjenbruker mekanismen vi nettopp landet for kategori-fade). **rAF-tween** (`useTweenedOpacities`) brukes kun for 3D, der CSS-transitions ikke virker på Google Maps-rasteriserte SVG-markører.

**Kalibrerings-affordance**
- R12. Mens vi tester må zoom-nivået være synlig — enten via `console.log` ved zoom-event (matcher tidligere workflow) eller via en debug-overlay i kart-hjørnet. Fjernes/skjules når terskelene er kalibrert.

## Success Criteria

- Ved lav zoom (oversiktsmodus) blir kart-flaten merkbart roligere — markører kolliderer ikke og hue-identitet via dot-farge er fortsatt tydelig (sjekkes mot ~50-POI-densitets-scenario over Trondheim sentrum).
- Ved nær-zoom (gate-/kvartal-nivå) viser markørene navnet uten at brukeren må klikke — vi kan se "Krambua", "Fyr på Valentinlyst" osv. direkte i kartet.
- Tier-overgangene oppleves smooth — ingen popping, ingen FOUC av labels.
- Aktiv markør forblir alltid identifiserbar med navn, selv ved lav zoom (etter klikk gir det kontekst). Ingen dobbel-label (pille + inline) på aktiv POI.
- Etter en kalibrerings-runde med brukeren føler vi at terskelene treffer riktig — vi har én eller to revisjoner av break-points basert på live-test.

## Scope Boundaries

- **Kun rapport-board** (`components/variants/report/board/`). Vi rører ikke `AdaptiveMarker`, `useMapZoomState`, eller andre kart-varianter (Explorer, ReportInteractiveMap, Guide, Trip, admin-kart) — *med unntak av* at plan-fasen verifiserer om `useMapZoomState` kan gjenbrukes som-er; se Outstanding Questions.
- **Kun 2D Mapbox** (`BoardMap.tsx` + `BoardMarker.tsx`). 3D Google Maps (`BoardMap3D.tsx` + `Marker3DPin`) er deferred — kan være tyngre å få til siden Google rasteriserer SVG per render, og kan ende som egen runde.
- **Threshold-strategi**, ikke "no label-budget": vi starter ved zoom ≥ 16. Hvis live-kalibrering avslører kollisjoner ved typisk POI-tetthet, hever vi terskelen iterativt (16 → 16.5 → 17) før vi vurderer label-budget. Label-budget er fortsatt deferred, men er en akseptert follow-up *hvis* threshold-justering ikke holder.
- **Ingen kategori-fargede labels** i v1. Standardisert farge først; kategori-farge er en mulig polish-runde senere.
- **Ingen rating-badge eller editorial sparkle** i label-state — Board-konseptet bruker ikke disse.
- **Ingen endring** av interaksjon (klikk, hover, tooltip) — kun visuell tier-state og label-surface-konsolidering (deprecate `BoardPOILabel`).

## Key Decisions

- **Parallell impl er en hypotese, ikke et settled valg**: Brainstormen ratifiserer ikke parallel-impl uten test. `useMapZoomState` har allerede `"dot" | "icon" | "icon-rating" | "full-label"`-enum og `labelBudget`-option i typesignaturen, og er ~30 linjer med zoom→DOM-attribute-writer. Plan-fasen **må først verifisere** kost ved gjenbruk (én hook-anrop med konfigurerbare terskler) før parallel impl velges. Hvis gjenbruk koster lite ekstra → gjenbruk. Hvis det krever signifikant utvidelse → parallell impl er ok.
- **Tre `tier`s, ikke fire**: Vi dropper `icon-rating`-state som finnes i `AdaptiveMarker` — Board viser ikke Google-rating på markører.
- **Kun POI-navn på label, ikke kategori/travel time**: Snapchat-mønsteret bruker bare navn. Mer info gir kollisjoner. Travel time vises i sidebar/popup uansett.
- **Standardisert label-farge, ikke kategori-farge**: Mindre visuell støy i første iterasjon. Vi vurderer kategori-farge senere hvis det føles utvasket.
- **Threshold-iterasjon foran label-budget**: Heller enn å implementere label-budget eller priority-system, satser vi på at terskel-kalibrering naturlig løser kollisjoner. Label-budget er deferred follow-up *hvis* threshold ikke holder, ikke en garantert utelatelse.
- **`BoardPOILabel` deprecates**: Den eksisterende offset-pille for aktiv POI erstattes av inline-label. Én label-surface gir konsistent UX og fjerner dobbel-label-risiko.
- **2D bruker CSS-transition for fade, ikke rAF**: BoardMarker bruker allerede CSS opacity/transform-transitions for kategori-fade. Tier-overgang gjenbruker samme mekanisme. rAF-tween-mønsteret (`useTweenedOpacities`) er forbeholdt 3D der CSS ikke virker.
- **Console.log / debug-overlay for zoom**: Kalibrering krever feedback. Matcher hvordan vi gjorde det forrige gang adaptive thresholds ble satt (jf. commit `8180729 set dot→icon threshold to zoom 13`).

## Dependencies / Assumptions

- Mapbox-kartet eksponerer `zoom`-event på map-ref (verifisert — `useMapZoomState` bruker dette allerede via `map.on("zoom", ...)`).
- **Zoom-tier formidles per-markør via prop, ikke via container-attribute**: Mapbox `<Marker>`-komponenter rendres i sin egen DOM-rot (Mapbox' marker-pool), ikke som descendants av kart-containeren. Det betyr at `data-zoom-state`-pattern fra `AdaptiveMarker` (som bruker descendant-CSS-selectors) ikke fungerer 1:1 i Board. Default: BoardMap lytter til `zoom`-event og setter en lokal `zoomTier`-state som propageres som prop til hver BoardMarker. Med typisk ~50 markører er noen re-renders akseptabelt; `React.memo` med custom comparator på `(poi.id, isVisible, isActive, zoomTier)` holder det innen rimelighet.
- **Initial zoom-tier må beregnes ved mount og ved 3D→2D-toggle** før første render. `initialViewState.zoom` (default 13.5) og 3D→2D-toggle (som mounter Mapbox helt på nytt) er begge entry-points som må kjøre `computeZoomTier()` synkront ved mount så markørene ikke flashes i feil tier.
- **Label-tier triggers både ved bruker-zoom og scripted kamera-bevegelser** (audio-tour `fitBounds`, kategori-flyTo, BoardMap3D `pendingCamera`-handoff). Vi skiller ikke på kilde. Hvis dette gir uønsket UX i tour-mode (label dukker plutselig opp ved scripted zoom), vurderes "user-initiated only"-gate som follow-up.
- **2D fade-mekanisme er CSS opacity-transition**: BoardMarker bruker allerede dette (jf. commit `d9dc703 fade-animasjon på kart-markører ved kategori-skifte`). Tier-overgang legger til en `<span>`-label i samme transition-regime — ingen ny abstraksjon, ingen ny rAF-loop.

## Outstanding Questions

### Deferred to Planning

- [Affects R1, R2, R10, R11][Technical] **Verifiser gjenbruk av `useMapZoomState` før parallel-impl-valg lukkes.** Konkret: kan vi pass'e `{ labelBudget: Infinity, mapLoaded: true }` med custom terskler (zoom 16) og få ut "full-label" som tier-signal? Hvis ja, hooken er reusable som-er bortsett fra at vi må reaktivere `"full-label"`-grenen i `computeZoomState`. Hvis det krever forking (board-spesifikke break-points eller andre tiers), parallell impl er ok.
- [Affects R6][Needs research] Skal `text-shadow`-default kalibreres mot den faktiske Mapbox-stilen Board bruker (`applyIllustratedTheme`)? Snap én screenshot av kart-tile-paletten først så vi vet om hvit halo holder, eller om vi trenger drop-shadow / `paint-order: stroke fill` på SVG-tekst.
- [Affects R12][Technical] Debug-overlay vs. console.log — kan implementeres som conditional render basert på en env-flag eller en hardkodet boolean mens vi kalibrerer.
- [Affects R9, Scope][Needs research] **Calibration prep — mål POI-tetthet ved zoom 16** på Trondheim sentrum demo-data (StasjonsKvartalet, Solsiden, Olavskvartalet) før plan-fasen begynner. Hvis >8–10 POIs typisk i viewport ved zoom 16, treat "ingen label-budget"-beslutningen som hypotese å falsifisere i kalibrerings-rundene — vi vil sannsynligvis trenge label-budget eller høyere terskel.
- [Affects R10][Technical] Implementasjons-rekkefølge for `BoardPOILabel`-deprecation: skal vi (a) bygge inline-label først og slette pille i samme PR, eller (b) bygge inline-label med pille fortsatt aktiv (dobbel-label kort periode) og rydde i follow-up? (a) er renest men gir større diff.

### Deferred to Separate Tasks

- 3D-versjonen (`BoardMap3D.tsx`). Avhenger av om mønsteret modnes — Google Maps 3D rasteriserer SVG per render, så samme rAF-tween-mønster fra `useTweenedOpacities` må sannsynligvis gjenbrukes.
- Eventuell label-budget hvis threshold-iterasjon ikke holder ved live-kalibrering.
- Kategori-fargede labels som polish-runde.
- "User-initiated zoom only"-gate for label-tier hvis scripted kamera-bevegelser gir uønsket label-flash.

## Next Steps

→ `/ce-plan` for strukturert implementasjon. Plan-fasen må starte med å verifisere useMapZoomState-reuse (jf. første Outstanding Question) før den fastlåser arkitektur.
