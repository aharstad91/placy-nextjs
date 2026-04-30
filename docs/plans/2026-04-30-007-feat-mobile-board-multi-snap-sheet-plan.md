---
title: Mobile board — multi-snap sheet med Google Maps-flyt
type: feat
status: completed
date: 2026-04-30
deepened: 2026-04-30
completed: 2026-04-30
---

# Mobile board — multi-snap sheet med Google Maps-flyt

## Overview

Erstatt dagens fire-komponent mobile-flyt (BoardCategoryGrid → BoardPeekCard → BoardReadingModal → BoardPOISheet) med **ett multi-snap bottom-sheet** inspirert av Google Maps-appen, med en alltid-synlig horisontal kategori-tab-bar i bunnen.

Sheet-en har fire snap-stages:
- **Stage 1** — kollapset til kun tab-bar (Hjem-knapp + kategorier).
- **Stage 2** — peek: kategorinavn + Beliggenhet/Punkter-tabs synlig over tab-bar.
- **Stage 3** — halv: tabs + innholdsstart, scrollbart.
- **Stage 4** — full: alt innhold synlig (akvarell, brødtekst, POI-accordion, "Les mer"-disclosure).

Innholdet i sheet-en er det samme som desktop-sidekolonnen viser i `BoardDetailPanel` (kategori-tittel, BoardTabs, BoardCategoryInfoTab, SubCategoryFilter, BoardPunkterAccordion). Samme state-machine — kun mobil-rendering endres.

POI-klikk på kart åpner POI-detaljen i samme sheet (ikke et separat sheet) — sheet snapper til stage 3 og viser BoardPOIDetails med pinned action-bar over tab-bar. Tilbake-knapp returnerer til kategori-visning.

## Problem Frame

Dagens mobile-flyt har fire fasespesifikke ark som hver erstatter forrige:

```
default        active            reading           poi
────────       ──────────        ──────────────    ──────────────
CategoryGrid   PeekCard          ReadingModal      POISheet
(grid)         (lead+knapper)    (Info|Punkter)    (rich POI)
```

Etter paritet-planen (2026-04-30-005) er hver enkeltdel polert, men strukturen krever fortsatt at brukeren navigerer gjennom 3 separate ark for å gå fra "se kart" til "lese om en POI", og må mentalt re-orientere ved hver overgang. Det er ikke Google Maps-følelsen brukeren ønsker — der ligger ett anker-sheet alltid synlig, og kategori- og POI-bytte skjer som snap-overganger inni samme overflate.

I tillegg er BoardCategoryGrid (Image #4: "HVA LURER DU PÅ?"-horisontale kort) og BoardPeekCard (Image #3: "BARN & OPPVEKST"-flytende kort) bottom-anchored panels som visuelt kjemper om plass og oppdagbarhet. Brukeren peker på at desktop sin kompakte kategori-rail er bedre — bare horisontalt på mobil.

Vi er i prototype-stadium (memory: project_stage_prototype) — ingen live klienter — så vi kan rive ut hele mobile-flyten og bygge én ny shell. Desktop-flyten er eksplisitt urørt.

## Requirements Trace

- **R1.** Ett multi-snap bottom-sheet (vaul) erstatter `BoardCategoryGrid`, `BoardPeekCard`, `BoardReadingModal` og `BoardPOISheet`. Sheet-en er alltid mountet og minst stage-1-synlig (aldri dismissed).
- **R2.** Sheet-en har fire snap-stages: kollapset (kun tab-bar), peek (kategorinavn + tabs), halv (tabs + innhold), full (alt). Brukeren kan dra fritt mellom stagene.
- **R3.** Tab-bar i bunnen er alltid mountet og minst delvis synlig på tvers av snap-stages. Inneholder Hjem-knapp først (matcher desktop `BoardRail`-rekkefølge) + alle kategorier som horisontal-scroll med snap-x. Reelle datasett kan ha 6–18 kategorier (per `lib/themes/bransjeprofiler.ts`); tab-bar viser ~6 knapper synlig per 390px-viewport, resten oppdages via horisontal swipe + right-edge gradient-fade affordance + auto-scroll-to-active ved kategori-bytte.
- **R4.** Klikk på kategori i tab-bar → `SELECT_CATEGORY` + auto-snap til stage 2 (peek). Klikk på Hjem → `RESET_TO_DEFAULT` + auto-snap til stage 1 (kollapset).
- **R5.** Sheet-innholdet ved stage 2+ er det samme som desktop `BoardDetailPanel` viser for valgt kategori (kategori-tittel, BoardTabs, BoardCategoryInfoTab, SubCategoryFilter, BoardPunkterAccordion).
- **R6.** Klikk på POI-marker på kartet → `OPEN_POI` + auto-snap til stage 3, sheet viser `BoardPOIDetails` med tilbake-knapp og pinned `BoardPOIActionBar` over tab-bar.
- **R7.** Map-padding-bottom følger sheet-snapen så markører ikke gjemmes under sheet ved `fitBounds`. Snap-overgang utløser ikke kamera-bevegelse — kun stage-bytte (per learnings/poi-click-no-camera-move).
- **R8.** Sheet er ikke-modal og uten mørkt overlay — kartet er alltid interaktivt bak sheet.

## Scope Boundaries

**Inn i scope:**
- Ny komponent `components/variants/report/board/mobile/BoardMobileSheet.tsx` (multi-snap shell).
- Ny komponent `components/variants/report/board/mobile/BoardCategoryTabBar.tsx` (alltid-synlig kategorivelger).
- Refactor av `components/variants/report/board/board-state.tsx` (snap-stage-integrasjon, eventuelle action-justeringer).
- Refactor av `components/variants/report/board/ReportBoardPage.tsx` (`BoardScaffold` mounter ny shell istedenfor 4 komponenter).
- Map-padding-sync i `components/variants/report/board/BoardMap.tsx`.
- Sletting av `BoardCategoryGrid`, `BoardPeekCard`, `BoardSwitcherChip`, `BoardReadingModal`, `BoardPOISheet`.

**Ute av scope (eksplisitte non-goals):**
- Endringer i desktop-flyten (`BoardDesktopShell`, `BoardDetailPanel`, `BoardRail`, `BoardPOIAccordion`).
- Endringer i `BoardPOIDetails` / `BoardPOIActionBar` / `BoardCategoryInfoTab` / `BoardPunkterAccordion` / `SubCategoryFilter` ut over hva integrasjonen krever (de delte komponentene gjenbrukes som de er).
- Endringer i `transformToReportData` eller `adaptBoardData`.
- Endringer i map-rendering, marker-style, eller path-layer ut over `mapPadding`.
- Endringer i `lib/store.ts` eller andre Zustand-stores.
- 3D-kart-tilstand (egen plan: 2026-04-30-003 og 2026-04-30-004).
- URL-state for delelinker.
- Egen swipe-mellom-POIer-gesture (carousel) — Unit 5 leverer cross-fade ved POI-bytte (samme oppførsel som dagens BoardPOISheet).

### Deferred to Separate Tasks

- **PWA / installable shell** — utenfor denne planen.
- **Compound-refresh av docs/solutions/** — etter denne planen er kjørt, kandidat for nytt solutions-dok om "vaul multi-snap mobile shell pattern" hvis det fester seg som konvensjon.

## Context & Research

### Relevant Code and Patterns

**Filer som blir slettet (etter ny shell er på plass):**
- `components/variants/report/board/mobile/BoardCategoryGrid.tsx` (Image #4 — "HVA LURER DU PÅ?")
- `components/variants/report/board/mobile/BoardPeekCard.tsx` (Image #3 — "BARN & OPPVEKST"-kort)
- `components/variants/report/board/mobile/BoardSwitcherChip.tsx` (kun brukt av BoardPeekCard)
- `components/variants/report/board/mobile/BoardReadingModal.tsx`
- `components/variants/report/board/mobile/BoardPOISheet.tsx`

**Filer som gjenbrukes uendret (delte mellom desktop og mobil):**
- `components/variants/report/board/BoardCategoryInfoTab.tsx` — akvarell + leadSegments + bodyParagraphs + "Les mer om {label}"-disclosure. Brukes inni Beliggenhet-tab i ny sheet.
- `components/variants/report/board/SubCategoryFilter.tsx` med `variant="mobile"` — chip-rad (per paritet-plan Unit 4). Brukes i Punkter-tab.
- `components/variants/report/board/mobile/BoardPunkterAccordion.tsx` — Radix Accordion type=multiple, hver POI inline med BoardPOIDetails. Brukes i Punkter-tab.
- `components/variants/report/board/mobile/BoardTabs.tsx` — pill-tab-komponent (Beliggenhet|Punkter).
- `components/variants/report/board/BoardPOIDetails.tsx` med `hideActionBar` prop. Brukes når sheet viser POI-detalj.
- `components/variants/report/board/BoardPOIDetails.tsx` eksport `BoardPOIActionBar`. Brukes som pinned bar over tab-bar.
- `components/variants/report/board/BoardMap.tsx` — får ny prop/effekt for `mapPadding.bottom` synket med snap-stage.

**Snap-pattern referanse:**
- `components/variants/report/board/mobile/BoardPOISheet.tsx` (snap-points `[0.5, 1]`, `modal={false}`, ingen overlay, cross-fade `bodyVisible`-state). Ny shell utvider dette mønsteret til 4 stages og legger til pinned tab-bar.
- `components/variants/explorer/ExplorerBottomSheet.tsx` (alternativ — ren-touch snap med `[180, 420, 760]` px). Ikke vaul — tas kun som referanse på snap-på-px-størrelse.

**Vaul-primitiv:**
- `components/ui/drawer.tsx` — shadcn-wrapper. Vi bruker `DrawerPrimitive.Content` direkte (som BoardPOISheet gjør) for å unngå auto-overlay og full kontroll over drag-handle.

**State-machine:**
- `components/variants/report/board/board-state.tsx` — `BoardPhase = "default" | "active" | "reading" | "poi"`. Etter refactor: `"default" | "active" | "poi"` (reading-fase fjernes — innholdet er innebygd i sheet ved stage 2+ av active-fasen).
- `components/variants/report/board/board-state.test.ts` (12 tester) — må oppdateres for fjernet `reading`-fase og evt. ny snap-stage-relatert state.

**Routing-entry:**
- `components/variants/report/board/ReportBoardPage.tsx` linje 81–109 (`BoardScaffold`) — `useIsDesktop()` JS-gating. Mobile-grenen mounter dagens 4 komponenter; etter refactor kun `<BoardMobileSheet />`.

### Institutional Learnings

Fra `docs/solutions/` (per ce-learnings-researcher):

- **`docs/solutions/ui-patterns/apple-style-slide-up-modal-with-backdrop-blur-20260415.md`** — keyframes må namespaces per komponent (`board-sheet-snap-up`, ikke `slide-up`). Grep `@keyframes` i `app/globals.css` før nye animasjoner legges til.
- **`docs/solutions/ui-bugs/modal-backdrop-half-viewport-css-animation-collision-20260215.md`** — duplicate `@keyframes` kan forskyve elementer flere hundre piksler. Kompinent-namespacing er ufravikelig.
- **`docs/solutions/feature-implementations/profil-filter-eiendom-bolig-20260407.md`** — bottom-sheet med `bg-black/25` så markører bak forblir synlige. Vi går ett skritt videre: ingen overlay i det hele tatt (modal=false).
- **`docs/solutions/architecture-patterns/guide-library-spotify-pattern-20260204.md`** — horizontal-scroll med `flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory` og fixed-width children. Mønster for tab-bar.
- **`docs/solutions/architecture-patterns/placy-guide-mobile-prototype.md`** + memory `feedback_mobile_native_ux` — adaptive komponenter er Placy-policy. Mobile-only sheet, desktop-rail urørt.
- **`docs/solutions/ui-patterns/explorer-desktop-layout-pattern.md`** — `mapPadding.bottom = sheet-snap-height`, `fitBounds(maxZoom: currentZoom)`, `duration: 400`. Mønster for map-padding-sync.
- **`docs/solutions/ux-improvements/poi-click-no-camera-move-20260207.md`** — kamera flyttes ikke ved marker-klikk, kun ved list/sheet-row-klikk. `fitRoute`-boolean styrer.
- **`docs/solutions/ux-improvements/active-poi-card-pinned-sidebar-20260208.md`** — aktiv POI utenfor scrollbart område. Action-bar pinnes med `flex-shrink-0` (mønster fra paritet-plan Unit 2).
- **Memory `feedback_disclosure_animations`** — max-height-animasjon alene er signal nok; ingen auto-scroll ved snap-overgang. Gjelder sheet-state-bytte også.

### External References

- [vaul — multi-snap drawer](https://github.com/emilkowalski/vaul) — `snapPoints` aksepterer både number (0–1) og string (`"96px"`). `dismissible={false}` for alltid-anchored. `modal={false}` for å beholde kart-interaksjon.
- [Apple HIG — Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) — orientering for snap-stage-tall (peek/medium/large).

## Key Technical Decisions

- **Vaul snap-points i blandet format:** `["96px", "320px", 0.5, 0.92]` — fast pikselhøyde for stage 1 (tab-bar) og stage 2 (peek), prosent for stage 3 (halv) og stage 4 (full). Begrunnelse: tab-bar-høyde er kjent i piksler (uavhengig av viewport), mens halv/full er meningsfulle som prosent. Vaul støtter blanding av number + string i samme array.
- **`dismissible={false}` + `modal={false}` + `handleOnly={true}` + ingen DrawerOverlay** — sheet er aldri lukket, kartet er aldri sløret bak en mørk slør (men dekkes fysisk av sheet ved høye stages), bruker kan ikke "miste" kategorivelgeren ved drag-down. **`handleOnly={true}` avgjør gesture-konflikten** mellom vaul vertikal-drag og tab-bar horisontal-scroll: kun trekk på drag-handle (eller eksplisitt header-område) drar sheet, mens berøring på tab-bar-thumbnails går rett til native horizontal-scroll. Hvis vaul-versjon ikke støtter `handleOnly` → fallback: legg `touch-action: pan-x` på tab-bar-elementet og verifiser at vaul respekterer det. Begge avgjøres ved Unit 2 manuell test.
- **State-machine reduseres til tre faser:** `"default" | "active" | "poi"`. `"reading"`-fasen forsvinner fordi sheet-en *er* lese-flaten. **`readingTab` fjernes fra `BoardState` helt** — tab-state er ren UI-lokal state inne i `BoardMobileSheet` (`useState<"info" | "punkter">("info")`, reset til `"info"` ved kategori-bytte via `useEffect` på `state.activeCategoryId`). Action `OPEN_READING` slettes; ingen erstatnings-action trengs siden tab-bytte er rent klient-side i sheet-komponenten.
- **Snap-stage som derivert state, ikke discrete state-felt** — sheet-en bruker vaul sin lokale `activeSnapPoint`/`setActiveSnapPoint` (samme som BoardPOISheet). Imperativ snap-justering ved phase-bytte gjøres via `useEffect`-watcher: phase=default→stage 1, phase=active→stage 2 (kun ved overgang fra default), phase=poi→stage 3. Ingen ny `BoardAction` for snap-stage. Begrunnelse: holder state-machine slank, snap-styring forblir UI-konsekvens av phase, ikke separat dimensjon.
- **Tab-bar er pinned inne i Drawer-content (ikke utenfor)** — vaul-drawer er den eneste containeren som krysser snap-stages konsistent. Tab-bar plassert som siste, ikke-flexible barn (`flex-shrink-0`) i `<DrawerPrimitive.Content className="flex flex-col">`. Innholdet over (`flex-1 overflow-y-auto`) krymper ned til 0 høyde ved stage 1.
- **Hjem-knapp først i tab-bar** — matcher desktop `BoardRail`-rekkefølge. Bruker Lucide `Home`-ikon i en sirkel (`w-12 h-12 rounded-full`). Dispatch `RESET_TO_DEFAULT` + auto-snap til stage 1.
- **POI-detalj inni samme sheet, ikke separat drawer** — `OPEN_POI` snapper til stage 3 og bytter sheet-innhold til `<BoardPOIDetails poi hideActionBar />` + pinned `<BoardPOIActionBar poi />` (over tab-bar). Tilbake-knapp i header utløser `BACK_TO_ACTIVE`. Cross-fade `bodyVisible`-mønster fra dagens `BoardPOISheet` portes inn.
- **Map-padding-bottom synkes med snap-stage via `useEffect` i `BoardScaffold`** — leser `activeSnapPoint` fra sheet-context og setter `mapPaddingBottom`-prop på `<BoardMap>`. Stage 1 → 96px, stage 2 → 320px, stage 3 → 50dvh, stage 4 → bypass map-padding (kart er nesten fullt sløret av sheet uansett — beholder forrige verdi). Snap-overgang utløser ikke `fitBounds` automatisk; padding er passiv input til neste eksplisitte `fitBounds`-kall.
- **CSS-keyframes namespaces `board-sheet-*`** — alle nye animasjoner i `app/globals.css` får prefiks. Grep `@keyframes` før innskudd (per learning-pattern).
- **Mobile-only komponent** — `BoardMobileSheet` mountes kun når `useIsDesktop() === false` (samme JS-gating som idag i `BoardScaffold`).

## Open Questions

### Resolved During Planning

- **Skal POI-klikk fra map fortsatt åpne et separat sheet?** — Nei. Avgjort med bruker: alt skjer i samme sheet (Google Maps-stil). `BoardPOISheet` slettes.
- **Skal kategorivelgeren ha Hjem-knapp?** — Ja, Hjem først (matcher desktop `BoardRail`).
- **Skal sheet kunne dismisses helt?** — Nei. `dismissible={false}` — sheet er alltid minst stage 1.
- **Skal sheet ha mørkt overlay?** — Nei. `modal={false}` + ingen `DrawerOverlay` (samme som dagens BoardPOISheet).
- **Beholde "reading"-fasen i state-machine?** — Nei. Slettes; tab-state for Beliggenhet/Punkter holdes som lokal state inni sheet.
- **Skal vi fjerne dagens `cross-fade` ved POI-bytte?** — Nei. Mønsteret porteres inn fra `BoardPOISheet` (Unit 5).

### Deferred to Implementation

- **Eksakt høyde i piksler for stage 2 (peek)** — 320px er gjetning. Etter safe-area-bunnpadding (~34px iPhone), tab-bar (~96px), drag-handle (~20px), kategori-header (~56px), BoardTabs (~44px) er reelt body-tease ~70px. Vurder å heve stage 2 til 380–420px hvis bruker ikke får meningsfull body-tease ved peek. Justeres ved verifisering på 390x844-viewport.
- **Animasjon-curve for snap-overgang** — vaul har egen spring-default. Verifiser at det matcher Apple-style cubic-bezier(0.32, 0.72, 0, 1). Hvis ikke, override.
- **POI-tilbake-knapp-plassering** — øvre venstre i POI-content-headeren (Lucide `ChevronLeft`-ikon). Avgjøres ved Unit 5.
- **Cross-fade på phase=poi→active-overgang** — dagens cross-fade (Unit 5) trigger på `activePOIId`-endring. Phase-overgang fra poi til active (tilbake-knapp eller kategori-bytte) bytter content brått uten transition. Vurder å utvide cross-fade til også å fyre på phase-endringer hvis det føles abrupt. Avgjøres ved manuell QA i Unit 5.
- **Stage 4 (0.92) UX-implikasjon for kart-interaksjon** — R8 sier "kartet er alltid interaktivt", men ved stage 4 dekker sheet 92% av viewport — bare ~67px kart synlig. Funksjonelt er kartet ikke interaktivt på dette stadiet. Mitigering: drag-handle veldig prominent ved stage 4 så bruker enkelt drar ned. Vurder om R8 skal omformuleres til "kartet er ikke sløret av overlay; sheet kan flyttes ved drag når som helst". Avgjøres ved Unit 2 verifisering.
- **Vaul mid-drag callback-frekvens** — vaul-typedefinisjon eksponerer ikke om `setActiveSnapPoint` kalles kontinuerlig under drag eller kun ved snap-stop. Test på Unit 2-tid: hvis kontinuerlig, throttle til 100ms eller fyre kun ved drag-end. Hvis kun ved stop, ingen mitigasjon nødvendig.
- **`dismissible={false}` UX-tradeoff** — bruker har ingen "kun-kart"-visning (alltid 96px tab-bar bunnen). Hvis dette føles begrensende, vurder en collapse-affordance: long-press på drag-handle eller dedikert FAB som temporært kollapser tab-bar til 0. Defer til etter første prototype-test.
- **Network error state for POI-data i sheet** — sheet er alltid mountet; hvis BoardPOIDetails feiler å renderre (manglende data), sheet-content-area er tom mens tab-bar forblir. Vurder eksplisitt error-state med retry-knapp inni content-area. Defer til reell error-håndtering kreves (gjelder også desktop accordion — felles løsning).
- **Empty-state ved sub-cat-filter-tom** — Unit 4 nevner "0 POIer i kategori"-state. Når sub-cat-filter aktivt skjuler alle POIer (men kategorien har POIer), trenger separat melding "Ingen punkter matcher filteret" (med "Vis alle"-knapp som idag i SubCategoryFilter). Dagens MobileChipRow-pattern dekker dette delvis — verifiser at samme oppførsel fortsatt virker i ny accordion-kontekst.
- **Auto-snap policy ved kategori-bytte i poi-fasen** — bruker er i phase=poi, klikker en annen kategori i tab-bar → `SELECT_CATEGORY` (phase blir active, activePOIId nullstilles). Fra hvilken snap? Hvis bruker var ved stage 1 (kollapset), bør sheet snappe til stage 2 så ny kategori-content er synlig. Hvis ved stage 3+, behold. Implementer i useEffect-watcheren.
- **Focus management og a11y** — plan dekker ikke ARIA-roller, focus-flytting ved snap-overgang/phase-bytte, eller skjermleser-annonsering. Defer til etter prototype-validering — vurder om mobile-first PWA er primær target eller ikke.
- **Visuell tyngde av drag-handle vs tab-bar ved stage 1** — drag-handle er øverst i sheet-content over flex-1-content. Ved stage 1 kollapser flex-1 til 0 høyde, så drag-handle ligger rett over tab-bar. Verifiser at de visuelt ikke konkurrerer; vurder å skjule drag-handle ved stage 1 (`{snap !== "96px" && <handle />}`) hvis det gjør tab-bar tydeligere som primær affordance.

## High-Level Technical Design

> *Disse skissene illustrerer flyt og struktur, ikke implementasjons-spec. Implementer-agenten bør tilpasse navn og detaljer.*

### Sheet-struktur (på tvers av snap-stages)

```
┌─────────────────────────────────┐ ← stage 4 (~92% viewport)
│  ─── (drag-handle)              │
│  [←] Kategorinavn              X│ ← header (kun ved phase=active eller poi)
│  ┌─────────────────────────────┐│
│  │ [Beliggenhet] [Punkter (N)] ││ ← BoardTabs
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ Akvarell                    ││ ← stage 3 starter her
│  │ Body / SubCatFilter +       ││   scrollbart innhold
│  │   Punkter-accordion         ││   (flex-1 overflow-y-auto)
│  │ "Les mer om..."-disclosure  ││
│  └─────────────────────────────┘│
│  [Vis rute][Utforsk][Ring][Web] │ ← (kun ved phase=poi)
│                                 │   pinned BoardPOIActionBar
├─────────────────────────────────┤
│  [🏠] [🍴] [👶] [🌳] [🚌] [🏃] │ ← tab-bar (alltid synlig)
└─────────────────────────────────┘ ← stage 1 (96px) — kun tab-bar synlig
```

### Phase × snap-stage matrise

```
phase=default
  ├─ stage 1 (default): tab-bar synlig, ingen sheet-content
  └─ (stage 2-4 ikke meningsfullt — drag-up uten valgt kategori snapper tilbake til 1)

phase=active (kategori valgt)
  ├─ stage 1: tab-bar synlig, kategori er "valgt" men sheet-content gjemt
  ├─ stage 2 (default ved phase-overgang): tab-bar + kategori-header + tabs
  ├─ stage 3: + akvarell + body / Punkter-accordion-start
  └─ stage 4: alt innhold + "Les mer"-disclosure scrollbart

phase=poi (POI valgt fra map eller Punkter-accordion)
  ├─ stage 1: tab-bar synlig, POI gjemt (uvanlig — bruker har dratt ned)
  ├─ stage 2: tab-bar + POI-header (navn + adresse)
  ├─ stage 3 (default ved phase-overgang): + cover + meta + body
  └─ stage 4: alt POI-innhold + Andre-i-kategorien
```

### State-machine-overgang

```
default → SELECT_CATEGORY(id) → active (snap auto: 1→2)
default → OPEN_POI(id, categoryId?) → poi (snap auto: 1→3)
active  → OPEN_POI(id) → poi (snap stays at current eller bumps til 3 hvis lavere)
active  → RESET_TO_DEFAULT → default (snap auto: any→1)
poi     → BACK_TO_ACTIVE → active (snap stays)
poi     → SELECT_CATEGORY(id) → active (snap stays)
poi     → RESET_TO_DEFAULT → default (snap auto: any→1)
* → bruker drar sheet → snap endres uten å påvirke phase
```

### Komponent-mounting (etter refactor)

```tsx
// ReportBoardPage.tsx → BoardScaffold
{!isDesktop && <BoardMobileSheet />}
{/* tidligere: BoardCategoryGrid + BoardPeekCard + BoardReadingModal + BoardPOISheet */}
```

`BoardMobileSheet` rendrer:
- Drawer (vaul, `snapPoints=["96px","320px",0.5,0.92]`, `dismissible={false}`, `modal={false}`, `handleOnly={true}`)
  - DrawerContent (custom — ikke shadcn DrawerContent for å droppe overlay)
    - drag-handle (visuell affordance for å dra; `handleOnly={true}` betyr at gestures kun startet på handle drar sheet)
    - flex-1 overflow-y-auto min-h-0:
      - if phase=default: empty
      - if phase=active: `<header>{categoryLabel}</header><BoardTabs/><tab=info?BoardCategoryInfoTab:SubCatFilter+BoardPunkterAccordion>`
      - if phase=poi: `<header><back-btn/>{poiName}</header><BoardPOIDetails hideActionBar/>`
    - flex-shrink-0 (kun ved phase=poi): `<BoardPOIActionBar/>`
    - flex-shrink-0 (alltid): `<BoardCategoryTabBar/>` (med thumbnail + label + kategori-navn under)

## Implementation Units

### Phase 1 — Fundament (state-machine + shell)

- [ ] **Unit 1: State-machine refactor + atomic deletion av reading-fase-konsumenter**

**Goal:** Slett `"reading"`-fasen fra `BoardPhase`, `OPEN_READING`-action fra `BoardAction`, `readingTab` fra `BoardState`. Atomisk i samme commit: slett `BoardReadingModal.tsx`, `BoardPeekCard.tsx` og `BoardSwitcherChip.tsx` siden de leser `phase === "reading"` og dispatcher `OPEN_READING` — uten samtidig sletting feiler `tsc --noEmit`. Mount-stedene midlertidig stub-es i `ReportBoardPage.tsx` til Unit 2 leverer ny shell.

**Requirements:** R5 (delvis — forberedelse for sheet-content), R1 (begynner sletteflyt)

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/board/board-state.tsx`
- Modify: `components/variants/report/board/board-state.test.ts`
- Modify: `components/variants/report/board/ReportBoardPage.tsx` (fjern imports og mount av de tre slettede komponentene; mid-flight er mobile-grenen kun `<BoardCategoryGrid />` + `<BoardPOISheet />` til Unit 2/7 fullfører)
- Delete: `components/variants/report/board/mobile/BoardReadingModal.tsx`
- Delete: `components/variants/report/board/mobile/BoardPeekCard.tsx`
- Delete: `components/variants/report/board/mobile/BoardSwitcherChip.tsx`
- Delete (om finnes): tilhørende `*.test.tsx` for disse tre komponentene.

**Approach:**
- `BoardPhase` reduseres fra `"default" | "active" | "reading" | "poi"` til `"default" | "active" | "poi"`.
- `OPEN_READING`-action fjernes fra `BoardAction`-union.
- `BoardState.readingTab` slettes helt (per KTD-beslutning — tab-state er rent UI-lokal i ny sheet).
- `BACK_TO_ACTIVE` fra phase=poi går tilbake til active (uendret). Fra phase=reading (eksisterer ikke lenger) → slett denne grenen.
- `useEffect` i `BoardProvider` som dispatch'er `BACK_TO_ACTIVE` ved sub-kategori-filter-endring (linje 129–142) beholdes uendret. Bare grenen som tidligere reagerte på `phase === "reading"` slettes — verifiser via grep at den ikke aksesserer `state.readingTab` lenger.
- Sletteflyten: `BoardReadingModal` leser `state.phase === "reading"`; `BoardPeekCard` dispatcher `OPEN_READING` og bruker `BoardSwitcherChip`; `BoardSwitcherChip` har ingen øvrige konsumenter (bekreft via grep). Alle tre slettes atomisk i samme commit som state-machine-endringen — det er den eneste måten `tsc --noEmit` forblir grønn etter Unit 1. Brukervisning mid-flight (mellom Unit 1 og Unit 2) er degradert (kun BoardCategoryGrid + BoardPOISheet mounter), men dette er prototype og dev-only mellom-tilstand.
- Bekreft `THEME_SCENE_SRC`-utility (importert av BoardCategoryGrid + nytt BoardCategoryTabBar i Unit 3) er i delt fil og overlever Unit 1-slettingen. Hvis konstanten bor inni en av de slettede filene, flytt den til `lib/utils/` først.

**Patterns to follow:**
- Eksisterende reducer-pattern (`useReducer`-kall i `BoardProvider`).
- `OPEN_POI`-action som setter både `phase` og `activePOIId` simultant — samme pattern.

**Test scenarios:**
- Happy path: `SELECT_CATEGORY` fra default → phase=active. Uendret.
- Happy path: `OPEN_POI` fra active → phase=poi. Uendret.
- Edge case: `BACK_TO_ACTIVE` fra poi → phase=active, `activePOIId=null`. Uendret.
- Edge case: `RESET_TO_DEFAULT` fra phase=poi → initial state. Uendret.
- Removed: alle `OPEN_READING`-tester (3 tester per dagens fil) slettes.
- Removed: `BACK_TO_ACTIVE` fra phase=reading (1 test) slettes.

**Verification:**
- `npm test board-state` — alle tester passerer (med ovenfor-listede tester slettet).
- `npx tsc --noEmit` — **ingen typefeil i hele kodebasen** etter atomisk sletting av reading-fase-konsumenter. Verifiser før commit.
- `npm run dev` — siden mounter og rendrer på desktop (uendret). Mobile-grenen rendrer kun BoardCategoryGrid + BoardPOISheet (degradert mellom-tilstand er forventet til Unit 2/7 fullfører).
- Grep-verifikasjon: `grep -r "OPEN_READING\|phase === \"reading\"\|BoardSwitcherChip\|BoardPeekCard\|BoardReadingModal" components/ app/ lib/` returnerer 0 treff.

---

- [ ] **Unit 2: BoardMobileSheet shell med 4 snap-stages**

**Goal:** Bygg ny `BoardMobileSheet`-komponent som er en vaul Drawer med fire snap-stages (`"96px"`, `"320px"`, `0.5`, `0.92`), ikke-modal, ikke-dismissible, ingen overlay. Kun struktur — innhold legges til i Unit 4/5.

**Requirements:** R1, R2, R8

**Dependencies:** Unit 1

**Files:**
- Create: `components/variants/report/board/mobile/BoardMobileSheet.tsx`
- Reuse: `components/ui/drawer.tsx` (DrawerPrimitive direkte, samme som BoardPOISheet)
- Reference: `components/variants/report/board/mobile/BoardPOISheet.tsx` for snap-pattern, `bodyVisible`-state, action-bar-styling.

**Approach:**
- Komponent leser `useBoard()` for phase. Sheet er alltid mountet (`open={true}`).
- `snapPoints = ["96px", "320px", 0.5, 0.92]`, `dismissible={false}`, `modal={false}`, `handleOnly={true}`. Hvis `handleOnly`-prop ikke finnes i installert vaul-versjon (sjekk `node_modules/vaul/dist/index.d.ts`), fallback: legg `style={{ touchAction: "pan-x" }}` på tab-bar-elementet i Unit 3 og verifiser at vaul respekterer det.
- `activeSnapPoint`/`setActiveSnapPoint` lokal `useState`. Initial verdi avhenger av phase: phase=default → `"96px"`, phase=active → `"320px"`, phase=poi → `0.5`.
- `useEffect` watcher på `state.phase` (ikke på snap): ved phase-overgang, kall `setActiveSnapPoint(getDefaultSnapForPhase(state.phase))`. Watcher kun fyrer ved phase-endringer, ikke ved snap-endringer fra bruker-drag — derfor kan bruker dra fritt mellom stages innenfor samme phase uten at noen useEffect overstyrer.
- **Mid-drag race-mitigasjon:** Hvis vaul eksponerer `isDragging`/`isOpen`-state via interne hooks, hopp over `setActiveSnapPoint` mens drag pågår. Hvis ikke (sannsynlig — vaul DialogProps eksporterer ikke dette i dets type-def), aksepter at en phase-dispatch midt i drag kan justere snap. Bruker-impact: rask multi-handling der bruker drar og en marker-klikk fyrer samtidig vil føle "stoppet". Mitigasjon: `OPEN_POI`-dispatchen kommer fra map-marker-klikk, og finger på map ≠ finger på sheet, så samtidig-drag-og-klikk er mekanisk uvanlig. Dokumenter som ikke-blokkerende edge case.
- **Eksponere snap-tilstand til parent:** `BoardMobileSheet` aksepterer optional `onSnapChange?: (snap: string | number) => void`. Wrapper rundt `setActiveSnapPoint`: ved hver setter-kall, invoker callback. Brukes av `BoardScaffold` i Unit 6 for map-padding-sync. Default: callback kan være undefined.
- DrawerContent struktureres som `flex flex-col h-full`:
  - drag-handle (samme som BoardPOISheet: `mx-auto mt-3 h-1.5 w-[100px] rounded-full bg-stone-300`).
  - placeholder header (Unit 4 fyller).
  - `flex-1 overflow-y-auto min-h-0` content-slot (Unit 4 fyller). `min-h-0` så flex-shrink fungerer ved stage 1.
  - `flex-shrink-0` action-bar slot (Unit 5 fyller, kun ved phase=poi).
  - `flex-shrink-0` tab-bar slot (Unit 3 fyller).
- Bruk `bg-stone-50/95 backdrop-blur` og `rounded-t-3xl` på toppen av sheet.
- Safe-area: `paddingBottom: "env(safe-area-inset-bottom, 0px)"` på tab-bar-slot wrapper (Unit 3).
- Ingen DrawerOverlay-rendering. Bruk DrawerPrimitive.Content direkte (ikke shadcn DrawerContent som auto-mounter overlay).

**Patterns to follow:**
- `components/variants/report/board/mobile/BoardPOISheet.tsx` linje 14–199 — overall sheet-struktur. Den nye sheet-en er en utvidelse til 4 stages med pinned tab-bar.
- Memory: prefiks-namespacing av keyframes — hvis vi legger til CSS-animasjoner ut over vaul-defaults, prefiks med `board-sheet-*`. Grep `@keyframes` i `app/globals.css` først.
- Memory: ingen auto-scroll ved snap-overgang — innhold skal ikke `scrollIntoView` ved drag.

**Test scenarios:**
- Test expectation: ingen unit-tester for shell selv (vaul-integrasjon best testet manuelt). Verifiseres via Unit 7 manuell QA.
- Manuell verifisering på 390x844-viewport: sheet rendres, drag-handle synlig, kan dras mellom alle 4 stages, holder seg på snap. Map er interaktivt bak (modal=false).
- Edge case: dra sheet helt ned — `dismissible={false}` betyr at det snapper tilbake til stage 1, ikke lukkes.

**Verification:**
- Mobil-bredde i dev-browser: sheet vises, kan dras mellom alle 4 snap-stages, holder seg ved hver stage. Tap utenfor sheet (på kart) — kartet responderer (modal=false).
- Snap-overgang ved phase-bytte: dispatch `SELECT_CATEGORY` (eks. via dev-tools eller midlertidig button) → snap auto-justerer til "320px".

---

- [ ] **Unit 3: BoardCategoryTabBar — Hjem + kategorier horisontal**

**Goal:** Ny komponent som rendrer en horisontal-scroll tab-bar med Hjem-knapp først og deretter alle kategorier som thumbnail-knapper. Plassert som flex-shrink-0 inni `BoardMobileSheet` (alltid synlig, alle snap-stages).

**Requirements:** R3, R4

**Dependencies:** Unit 2

**Files:**
- Create: `components/variants/report/board/mobile/BoardCategoryTabBar.tsx`
- Modify: `components/variants/report/board/mobile/BoardMobileSheet.tsx` (mount tab-bar)
- Reference: `components/variants/report/board/desktop/BoardRail.tsx` for kategori-knapp-styling, `components/variants/report/board/mobile/BoardCategoryGrid.tsx` for akvarell-thumbnail-pattern, `components/variants/report/board/SubCategoryFilter.tsx` linje 169–246 for `MobileChipRow` horizontal-scroll-mønster.

**Approach:**
- Komponent leser `useBoard()` for `state.activeCategoryId` (highlighter aktiv kategori-knapp). Mottar `onSnapChange?` callback fra parent (`BoardMobileSheet`) for å trigge snap-justering ved kategori-bytte.
- Layout: `<div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-3 pb-2 pt-2" style={{ touchAction: "pan-x" }}>` med safe-area-padding-bottom på wrapping container, ikke på selve scroll-elementet (så scroll-content går helt til bunn). `touchAction: "pan-x"` er fallback for gesture-konflikten hvis vaul `handleOnly` ikke ble valgt.
- Tab-bar total-høyde: ~96px (matcher snap stage 1 = `"96px"`). Per-knapp: `w-14` (56px) thumbnail + 2px-label-spacing + 12px-label-tekst + 4px-margin = ~74px-totalhøyde, sentrert vertikalt i 96px-containeren med safe-area-bunnpadding.
- Hjem-knapp: Lucide `Home`-ikon (24px) sentrert i `w-14 h-14 rounded-full bg-stone-100 hover:bg-stone-200`. Under: tekst `"Hjem"` (12px font-medium tracking-tight stone-700). Klikk → `dispatch({ type: "RESET_TO_DEFAULT" })` + `onSnapChange?.("96px")`.
- Kategori-knapper: akvarell-thumbnail (`THEME_SCENE_SRC[category.id] ?? category.illustration?.src`) i `w-14 h-14 rounded-2xl border-2 border-transparent`. Aktiv kategori → `border-stone-900` (eller `category.color`). Under thumbnail: kategori-navn (12px font-medium stone-700, max 1 linje, `truncate`, max-width matcher knapp 56px). Klikk → `dispatch({ type: "SELECT_CATEGORY", id: cat.id })` + `onSnapChange?.("320px")` kun hvis nåværende snap < `"320px"`.
- Snap-til-aktiv: ved `state.activeCategoryId`-endring (ikke ved klikk på samme aktiv knapp), scroll knappen inn i view (`scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })`).
- Same-category re-tap-policy: hvis bruker klikker den allerede aktive kategori-knappen → snap til `"320px"` (recover-affordance når sheet er kollapset til stage 1). Brukeren kan alltid hente sheet-en opp via en ekstra tap på aktiv kategori.
- Phase=poi tab-bar-state: vis `state.activeCategoryId` (POI-ens kategori) med samme aktiv-border. Brukerens mentale modell: POI-en tilhører kategorien, så kategori-border indikerer "denne kategoriens POI vises". Klikk på samme kategori i poi-fasen dispatcher `BACK_TO_ACTIVE` (eksplisitt vei tilbake til kategori-listen).
- Right-edge gradient-fade affordance for å antyde flere kategorier til høyre: `<div className="pointer-events-none absolute top-0 right-0 bottom-safe w-12 bg-gradient-to-l from-stone-50/95 to-transparent">` over scroll-container. Synlig kun når scroll-content faktisk overflowes (kan stå alltid synlig som enkel implementering).
- POI-count-badge: ikke i tab-bar (begrenset plass på 56x56 med tekst-label). Beholdes i sheet-content-headeren (Punkter-tab viser `(N)` som idag).

**Patterns to follow:**
- `components/variants/report/board/desktop/BoardRail.tsx` — Hjem først + kategorier-mapping. Samme rekkefølge.
- `components/variants/report/board/SubCategoryFilter.tsx` linje 169–246 (MobileChipRow) — horizontal-scroll med fixed-width children.
- `tailwind.config.ts` — `scrollbar-hide`-plugin er allerede registrert.
- Memory `feedback_disclosure_animations` — ingen auto-scroll ved expand. Men `scrollIntoView` på aktiv tab-bar-knapp er OK fordi det er en eksplisitt klikk-konsekvens, ikke disclosure.

**Test scenarios:**
- Happy path: Tab-bar rendrer Hjem først + alle kategorier i `data.categories`-rekkefølge.
- Happy path: Klikk Hjem fra phase=active → state.phase=default, state.activeCategoryId=null, sheet snap=`"96px"`.
- Happy path: Klikk kategori X fra phase=default → state.phase=active, state.activeCategoryId=X, sheet snap=`"320px"`. Aktiv knapp får border.
- Happy path: Klikk kategori Y fra phase=active (kategori X aktiv) → activeCategoryId=Y, snap holder `"320px"` (eller høyere hvis bruker har dratt opp). Aktiv-border flytter til Y. Y-knappen scroller inn i view.
- Edge case: Klikk samme kategori-knapp som allerede er aktiv → snap til `"320px"` (recover sheet hvis nede ved stage 1). Ingen `SELECT_CATEGORY`-dispatch, ingen scrollIntoView (knappen er allerede valgt og typisk synlig).
- Edge case: Tabbar-overflow på 6+ kategorier (forventet på reelle datasett med opptil 18 kategorier per `lib/themes/bransjeprofiler.ts`) → horizontal-scroll fungerer. Right-edge gradient-fade affordance synlig. Snap-til-aktiv ved kategori-bytte sentrerer knappen via `scrollIntoView`.
- Integration: Klikk POI på map (phase=poi) → tab-bar viser POI-ens kategori med aktiv-border (samme styling som phase=active). Klikk på samme kategori i poi-fasen → `BACK_TO_ACTIVE`-dispatch (eksplisitt tilbake-vei).
- Integration: handleOnly/touch-action gesture-test — touch ned på tab-bar-thumbnail og swipe horisontalt → kun tab-bar scroller, sheet-en beveger seg ikke. Touch ned på drag-handle og swipe vertikalt → kun sheet snapper, tab-bar scroller ikke.

**Verification:**
- Mobil-bredde: tab-bar synlig nederst i alle snap-stages. Klikk Hjem → sheet kollapser, kategori-aktiv-border forsvinner. Klikk kategori → sheet snapper til peek, border flyttes.
- Tab-bar overlapper ikke iOS safe-area-inset-bottom.

---

### Phase 2 — Innhold

- [ ] **Unit 4: Sheet-content for default + active phase**

**Goal:** Fyll `BoardMobileSheet`s content-slot med phase-drevet rendering. Phase=default: tom (sheet er kollapset). Phase=active: kategori-header + `BoardTabs` (Beliggenhet|Punkter) + `BoardCategoryInfoTab` ELLER `SubCategoryFilter` + `BoardPunkterAccordion` basert på valgt tab.

**Requirements:** R5

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `components/variants/report/board/mobile/BoardMobileSheet.tsx`
- Reuse: `components/variants/report/board/BoardCategoryInfoTab.tsx`, `components/variants/report/board/SubCategoryFilter.tsx` (variant=mobile), `components/variants/report/board/mobile/BoardPunkterAccordion.tsx`, `components/variants/report/board/mobile/BoardTabs.tsx`.

**Approach:**
- Lokal `tab` state (`useState<"info" | "punkter">("info")`) inni sheet. Reset til "info" ved kategori-bytte (samme som dagens `BoardReadingModal`).
- Header når phase=active: `<header className="px-5 pt-2 pb-3 flex items-center justify-between"><h2 className="text-2xl font-semibold">{category.label}</h2><DrawerClose ...skjul/></header>`. Lukk-knapp dispatch `RESET_TO_DEFAULT`.
- BoardTabs under header med Beliggenhet/Punkter (count). Punkter-count fra `category.pois.length` (eller `filteredCategory.pois.length` hvis sub-filter aktiv).
- `tab="info"` rendrer `<BoardCategoryInfoTab category poisById imageSizes="100vw"/>`.
- `tab="punkter"` rendrer `<SubCategoryFilter variant="mobile" category={...} ... />` etterfulgt av `<BoardPunkterAccordion category={filteredCategory}/>`.
- Innholdsregion: `flex-1 overflow-y-auto px-5 pb-4 min-h-0` (samme som BoardReadingModal).

**Patterns to follow:**
- `components/variants/report/board/mobile/BoardReadingModal.tsx` (slettes i Unit 7, men brukes som referanse for header + tab-rendering).
- `components/variants/report/board/desktop/BoardDetailPanel.tsx` linje 131–180 — desktop-sidekolonne-rendering. Mobile sheet skal vise samme komponenter.
- Memory `feedback_mobile_native_ux` — adaptive komponenter; vi gjenbruker delte sub-komponenter men eier rendering-skallet selv.

**Test scenarios:**
- Happy path: Phase=default → content-slot er tom (drag-handle + tab-bar synlig).
- Happy path: Phase=active, tab=info → kategori-header + tabs + akvarell + body + "Les mer"-disclosure.
- Happy path: Phase=active, tab=punkter → kategori-header + tabs + sub-cat-filter + accordion-liste.
- Happy path: Klikk Punkter-tab → tab bytter, accordion-liste scroll til toppen (ingen auto-scroll memory ignoreres her — tab-bytte er eksplisitt brukerhandling).
- Edge case: Kategori med 0 POIer → Punkter-tab viser tom-state ("Ingen punkter i denne kategorien"). Konsistent med dagens BoardReadingModal-oppførsel.
- Edge case: Kategori-bytte mens tab=punkter → tab beholdes (eller resettes til info). Dagens BoardReadingModal resetter ved kategori-bytte (`useEffect` på activeCategoryId). Behold samme.
- Integration: Klikk POI inni Punkter-accordion → utvides inline (BoardPOIDetails vises i accordion-content). Sheet endrer ikke phase. Ingen ny dispatch.
- Integration: Trykk lukk-knapp i header → `RESET_TO_DEFAULT`, sheet snapper til stage 1.

**Verification:**
- Mobil-bredde: velg en kategori i tab-bar → sheet snapper til peek, kategori-header synlig. Dra opp til halv → tabs + akvarell synlig. Dra opp til full → alt innhold scrollbart.
- Tab-bytte mellom Beliggenhet og Punkter fungerer. Sub-kat-filter chip-rad synlig i Punkter. Accordion-utvidelse i Punkter inline.

---

- [ ] **Unit 5: POI-detalj inni sheet med pinned action-bar og cross-fade**

**Goal:** Når phase=poi, sheet viser POI-header med tilbake-knapp + `BoardPOIDetails hideActionBar` + pinned `BoardPOIActionBar` over tab-bar. POI-bytte (mens sheet er åpent) cross-fader (mønster portet fra dagens BoardPOISheet).

**Requirements:** R6

**Dependencies:** Unit 2, Unit 4

**Files:**
- Modify: `components/variants/report/board/mobile/BoardMobileSheet.tsx`
- Reuse: `components/variants/report/board/BoardPOIDetails.tsx` (med `hideActionBar` prop), `components/variants/report/board/BoardPOIDetails.tsx` eksport `BoardPOIActionBar`.
- Reference: `components/variants/report/board/mobile/BoardPOISheet.tsx` (slettes i Unit 7) for `bodyVisible`-cross-fade-pattern.

**Approach:**
- Når phase=poi: header rendrer `<button onClick={() => dispatch({ type: "BACK_TO_ACTIVE" })}><ChevronLeft/></button>` til venstre, POI-navn sentrert. Lukk-knapp til høyre dispatcher `RESET_TO_DEFAULT` (eller skjules — avgjøres ved implementasjon).
- Content-slot rendrer `<BoardPOIDetails poi={renderPoi.raw} hideActionBar />`.
- Pinned `<BoardPOIActionBar poi={renderPoi.raw} />` som flex-shrink-0 over tab-bar (separat slot, IKKE inni overflow-y-auto).
- Cross-fade: lokal `bodyVisible` state-pattern fra `BoardPOISheet`. Ved `state.activePOIId`-endring: `setBodyVisible(false)` → 100ms timeout → swap `renderPoi` → `setBodyVisible(true)`. Body-wrapper får `transition-opacity duration-100` og `opacity-0 / opacity-100` basert på state.
- Snap-stage ved phase=poi initial: `0.5` (stage 3). Bruker kan dra ned til stage 2 (fortsatt POI-data synlig) eller stage 1 (bare tab-bar). Drag til stage 1 utløser ikke automatisk `BACK_TO_ACTIVE` — bruker beholder POI-context.
- Auto-snap til stage 3 ved POI-bytte (kun hvis nåværende snap er lavere). Beholder bruker-overstyrt snap hvis høyere.

**Patterns to follow:**
- `components/variants/report/board/mobile/BoardPOISheet.tsx` linje 1–199 — hele cross-fade-implementasjonen (`FADE_OUT_MS`, `FADE_IN_MS`, `bodyVisible` setState-rekkefølge).
- `components/variants/report/board/mobile/BoardPOISheet.tsx` linje 192–199 — pinned action-bar med safe-area-paddding (men her over tab-bar, så safe-area ligger på tab-bar-slot, ikke action-bar-slot).
- Memory `feedback_disclosure_animations` — cross-fade er polish-animasjon, ingen auto-scroll. ~200ms total.

**Test scenarios:**
- Happy path: Phase=active → klikk POI-marker på map → phase=poi, snap auto til 0.5, sheet viser POI-header + cover + meta + body + action-bar pinned over tab-bar.
- Happy path: Klikk tilbake-knapp → phase=active, sheet snap holder seg (eller går til stage 2 hvis var stage 3 default). Verifiser at tab-bar fortsatt aktiv kategori-border vises.
- Happy path: POI A vises → klikk POI B-marker mens sheet åpent → cross-fade 200ms til POI B-innhold. Header oppdateres med POI B-navn.
- Edge case: Rask multi-klikk på flere markører → siste-klikk vinner, ingen kø-stabel av cross-fades.
- Edge case: Phase=poi, drag sheet til stage 1 → tab-bar synlig, POI-content gjemt. Phase forblir poi (`activePOIId` settes ikke til null). Drag opp igjen → POI-content synlig igjen.
- Integration: Phase=poi → klikk en annen kategori i tab-bar → `SELECT_CATEGORY`-dispatch resetter activePOIId og setter phase=active. Sheet snap holder eller justeres.
- Integration: Action-bar-knapper (Vis rute, Utforsk, Ring, Nettside) fungerer fra pinned posisjon — `target="_blank"`, `rel="noopener noreferrer"` bevares (samme oppførsel som dagens BoardPOISheet).

**Verification:**
- Mobil-bredde: klikk en restaurant-marker → sheet snapper til halv, viser POI med cover + rating + body + action-bar over tab-bar. Klikk en annen marker → cross-fade til ny POI.
- Trykk tilbake-knapp → tilbake til kategori-visning, kategori-header fortsatt riktig, tab-bar uendret.
- Dra POI-sheet ned til kollapset (stage 1) → tab-bar synlig, POI-context bevart. Dra opp → POI-content vises igjen.

---

### Phase 3 — Integrasjon + opprydding

- [ ] **Unit 6: Map-padding-bottom synket med snap-stage**

**Goal:** `BoardMap` får `mapPaddingBottom`-prop som settes basert på sheet-ens aktive snap-stage. Markører holdes synlige over sheet ved `fitBounds`.

**Requirements:** R7

**Dependencies:** Unit 2

**Files:**
- Modify: `components/variants/report/board/BoardMap.tsx` (legg til `mapPaddingBottom`-prop som passes til Mapbox `padding`-option).
- Modify: `components/variants/report/board/ReportBoardPage.tsx` (`BoardScaffold` leser snap-stage fra sheet, sender til BoardMap).
- Modify: `components/variants/report/board/mobile/BoardMobileSheet.tsx` (eksponer `activeSnapPoint` via context eller callback til BoardScaffold).

**Approach:**
- **Greenfield-anerkjennelse:** `BoardMap.tsx` har idag INGEN `fitBounds`/`padding`-bruk — det er rent marker-rendering uten kamera-justering. Unit 6 leverer **kun** propagering av snap-stage som `mapPaddingBottom`-prop og lagrer verdien som state på `BoardScaffold`. Bruk av padding i Mapbox-kall (selve `fitBounds`) er **utenfor scope** for denne planen — bevarer dagens "ingen kamera-bevegelse"-policy.
- Konkret leveranse: `BoardMap.tsx` aksepterer ny optional prop `mapPaddingBottom?: number` og passer den til Mapbox `map.setPadding({ bottom: mapPaddingBottom })` ved mount og når propen endres. Mapbox `setPadding` skifter ikke kamera per default — det justerer hvor "senter" tolkes ved fremtidige `fitBounds`/`flyTo`-kall. Visuelt ingen flicker.
- Callback-flyt: `<BoardMobileSheet onSnapChange={(snap) => setMapPaddingBottom(getMapPaddingBottom(snap))} />`. Konvertering:
  ```
  getMapPaddingBottom(snap):
    if snap === "96px"    → 96
    if snap === "320px"   → 320
    if snap === 0.5       → 280   // stage 3 — begrenset så markører ikke forsvinner ved bytte ned
    if snap === 0.92      → 280   // stage 4 — samme verdi som stage 3 (kart er nesten fullt sløret uansett, men beholder konsistent verdi)
    fallback              → 96
  ```
- BoardScaffold beholder `mapPaddingBottom` som useState. Sender til `<BoardMap mapPaddingBottom={mapPaddingBottom} />` kun når `!isDesktop` — desktop-kart får ingen padding-bottom.
- Mid-drag throttling: vaul-callback fyrer per snap-stop (verifiser i Unit 2). Hvis kontinuerlig under drag, throttle til 100ms eller kun oppdatere ved drag-end. Plan-default: ingen throttle (fyrer per stop).
- Per learning `poi-click-no-camera-move-20260207`: marker-klikk utløser ikke kamera-bevegelse (bare `OPEN_POI`-dispatch). Padding påvirker ikke kamera-pan, kun fremtidige `fitBounds`-kall — ingen i scope.
- Fremtidig oppfølging (utenfor denne planen): hvis senere arbeid legger til `fitBounds`-kall ved kategori-bytte eller POI-list-klikk, vil padding-verdien automatisk være riktig.

**Patterns to follow:**
- `components/variants/explorer/ExplorerPage.tsx` linje 752 — `mapPadding={{ left: 0, top: 0, right: 0, bottom: snapPoints[0] }}` — direkte presedens i Placy-koden.
- `docs/solutions/ui-patterns/explorer-desktop-layout-pattern.md` — `fitBounds` med `maxZoom: currentZoom`. Gjelder kun ved eksplisitte fitBounds-kall, ikke automatisk.

**Test scenarios:**
- Test expectation: minimal — visuell verifisering på mobil-viewport (ingen unit-tester for map-padding er praktisk uten å mocke Mapbox).
- Happy path: Phase=default, snap=`"96px"` → map-padding-bottom=96. Markører i nedre del av kartet synlige.
- Happy path: Phase=active, snap=`"320px"` → map-padding-bottom=320. Markører i nedre 320px området ikke skjult under sheet ved fitBounds.
- Happy path: Phase=active, drag-up til 0.5 → map-padding-bottom=280 (begrenset). Phase-bytte fra default→active utløser ikke automatisk fitBounds.
- Edge case: Drag fra 0.92 → 0.5 → "320px" → padding-bottom oppdateres ved hvert stop (vaul snap-event). Ingen camera-flicker fordi fitBounds ikke trigges.
- Integration: Klikk POI-marker → `OPEN_POI` → snap auto til 0.5. Map-padding-bottom=280. Verifiser at active POI-marker fortsatt synlig (ikke under sheet).

**Verification:**
- Mobil-bredde: legg en POI-marker i nedre 1/3 av kartet. Snap til stage 1 → marker synlig. Snap til stage 2 → marker synlig (ikke under sheet). Snap til stage 3 → marker delvis sløret (forventet — sheet dekker mye).

---

- [ ] **Unit 7: Mount BoardMobileSheet, slett gjenværende komponenter, oppdater tester**

**Goal:** `BoardScaffold` mounter `<BoardMobileSheet />` istedenfor de gjenværende gamle komponentene (`BoardCategoryGrid`, `BoardPOISheet`). Slett dem. Oppdater eller slett relaterte tester. (Sletting av `BoardReadingModal`, `BoardPeekCard`, `BoardSwitcherChip` skjedde allerede i Unit 1 som del av state-machine-refactor.)

**Requirements:** R1 (avslutter)

**Dependencies:** Unit 2, Unit 3, Unit 4, Unit 5, Unit 6

**Files:**
- Modify: `components/variants/report/board/ReportBoardPage.tsx` (`BoardScaffold` mobile-gren — kun `<BoardMobileSheet />` i container).
- Delete: `components/variants/report/board/mobile/BoardCategoryGrid.tsx`
- Delete: `components/variants/report/board/mobile/BoardPOISheet.tsx`
- Delete (om finnes): tilhørende `*.test.tsx`-filer for de to slettede komponentene.
- Verifiser: ingen gjenværende imports til slettede komponenter (grep + tsc).

**Approach:**
- Etter Unit 2–6 er den nye sheeten fullt funksjonell og dekker alle phaser (default, active, poi). Mount den.
- Slett gamle filer per CLAUDE.md "Når du bygger noe nytt som erstatter noe gammelt: SLETT det gamle umiddelbart".
- `THEME_SCENE_SRC`-konstanten ble flyttet til delt utility i Unit 1 (eller bekreftet allerede i delt fil). Verifiser at `BoardCategoryTabBar.tsx` (Unit 3) fortsatt har gyldig import etter sletting av `BoardCategoryGrid.tsx`.
- Oppdater `PROJECT-LOG.md` med oppføring som dekker hele plan-leveransen (én logg-entry).

**Patterns to follow:**
- CLAUDE.md "Kodebase-hygiene"-regelen — slett umiddelbart, ikke kommenter ut.
- Prototype-stadium (memory_project_stage_prototype) — vi kan slette uten frykt for live klienter.

**Test scenarios:**
- Test expectation: oppfølgings-verifisering (ingen ny funksjonalitet, kun cleanup).
- Verifisering: `npx tsc --noEmit` — ingen gjenværende type-referanser til slettede komponenter.
- Verifisering: `npm run lint` — 0 errors.
- Verifisering: `npm test` — alle tester (særlig `board-state.test.ts`) passerer.
- Verifisering: `npm run build` — bygger uten feil.
- Manuell QA på mobil-viewport: hele flyten ende-til-ende. Klikk Hjem → kategori → drag-stages → klikk POI → tilbake → annen kategori → klikk POI på map.

**Verification:**
- Build + tests grønne.
- Mobil-flyt komplett: Hjem → Mat → Beliggenhet-tab → Punkter-tab → utvid POI inline → klikk Hjem → klikk Barn → ... uten regresjon.
- Desktop-flyt (1440-bredde) er upåvirket. `BoardDesktopShell`, `BoardDetailPanel`, `BoardRail`, `BoardPOIAccordion` rendrer korrekt.

## System-Wide Impact

- **Interaction graph:** State-machine slankes (3 phases vs 4). Konsumenter av `state.phase === "reading"` (`BoardReadingModal`, evt. selektorer) må oppdateres eller slettes (Unit 1, Unit 7). `useActiveCategory`, `useActivePOI`, `useFilteredActiveCategory` selektorer uendret.
- **Error propagation:** Ingen nye eksterne avhengigheter. Eksisterende error-håndtering i `BoardPOIDetails` (graceful skip når data mangler) gjelder uendret.
- **State lifecycle risks:** Vaul snap-state er lokal i `BoardMobileSheet`. Ved phase-bytte må snap auto-justeres (Unit 2 useEffect). Risiko: race ved rask multi-dispatch (snap settes før phase reflekteres). Mitigasjon: useEffect som watcher på phase, ikke i action-handlerne.
- **API surface parity:** Ingen ekstern API. Internt: `BoardMap` får ny `mapPaddingBottom`-prop (Unit 6). Desktop-konsument sender ikke prop → defaulterer til 0.
- **Integration coverage:** Map-marker-klikk → `OPEN_POI` (uendret action). Sheet-snap-respons (auto til stage 3) er ny — verifiseres manuelt. Punkter-accordion-klikk inni sheet → inline-expand uendret (paritet-plan Unit 1-arbeid bevart).
- **Unchanged invariants:** Desktop-flyten er eksplisitt uendret. `BoardDesktopShell`, `BoardDetailPanel`, `BoardRail`, `BoardPOIAccordion` rører vi ikke. `transformToReportData` og `adaptBoardData` uendret. Delte komponenter (`BoardCategoryInfoTab`, `SubCategoryFilter`, `BoardPunkterAccordion`, `BoardPOIDetails`, `BoardPOIActionBar`, `BoardTabs`) gjenbrukes som er.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Vaul støtter ikke mix av px-string og number i `snapPoints`-array | Verifiser i Unit 2-implementasjon. Fallback: bruk kun number (prosent), `[0.12, 0.4, 0.6, 0.92]` — stage 1 = 12% av viewport ≈ 100px på 844px. Litt mindre presist men funksjonelt likt. |
| `dismissible={false}` kombinert med `modal={false}` produserer uventet drag-locking | Test tidlig i Unit 2. Hvis vaul ikke støtter denne kombinasjonen, vurder en av: (a) `dismissible={true}` men onOpenChange ignorerer close-events, (b) bygge custom snap-sheet (mønster fra `ExplorerBottomSheet`). |
| Cross-fade-mønster fra BoardPOISheet refaktoreres dårlig inn i ny sheet | Port nøyaktig samme `bodyVisible`-state-mekanikk (Unit 5). Hvis det ikke fungerer, fall tilbake til ren CSS `transition-opacity` på key-prop med `key={poi.id}`. |
| Map-padding-flicker ved snap-overgang (Unit 6) | mapPadding er passiv input — fitBounds utløses ikke ved bare padding-endring. Test grundig at vaul-snap-event fires én gang per stop, ikke kontinuerlig under drag. Hvis kontinuerlig: throttle til 100ms eller kun oppdatere ved drag-end. |
| State-machine-test-fil må omskrives mye (Unit 1) | 12 → ~9 tester etter sletting av reading-fase-tester. Forventet endring, ikke risiko — men reviewer må verifisere at ingen edge-case-dekning glipper. |
| Fjerning av `BoardSwitcherChip` (kun brukt av BoardPeekCard) | Sjekk at den ikke brukes andre steder via grep. Hvis funn → vurder hvilken tab-bar-knapp som dekker samme funksjonalitet (Hjem-knapp + tilbake-knapp i POI-header). |
| Tab-bar med 6+ kategorier overlapper sub-kategori-filter chip-rad i Punkter-tab | Begge er horisontale chip-rader. Tab-bar er nederst (alltid), sub-cat-filter i sheet-content. Visuell separasjon: tab-bar bruker thumbnails (56px), sub-cat-filter bruker tekst-chips (kort). Verifiser at de ikke ser forvirrende like ut på mobile. |
| Vaul-snap-overgang ved phase-bytte introduserer dobbel-animasjon (vaul snap + content phase-change) | Test i Unit 5 — phase=active→poi snap-overgang skal være ren. Hvis dobbel: forsink content-bytte til etter snap-animasjon (delay 300ms via setTimeout). |

## Documentation / Operational Notes

- Oppdater `PROJECT-LOG.md` med én oppføring som dekker hele plan-leveransen etter Unit 7 — fokus på beslutninger (Google-Maps-stil snap-shell, sletting av 4 komponenter, paritet-plan-arbeid bevart) og på verifiseringen.
- Etter denne planen er kjørt: vurder å skrive solutions-dokument under `docs/solutions/ui-patterns/` for "vaul multi-snap mobile shell pattern" hvis mønsteret etablerer seg som konvensjon. Skal inkludere: snap-points-array-format, modal/dismissible-flag-kombinasjon, pinned-bottom-bar-pattern, map-padding-sync.
- Unit 2 grep `@keyframes` i `app/globals.css` før evt. CSS-animasjons-tilskudd — namespace alle nye keyframes som `board-sheet-*`.

## Sources & References

- **Tidligere plan (paritet):** `docs/plans/2026-04-30-005-feat-rapport-board-mobile-ux-paritet-plan.md` — alle 7 units er landet (commits `114bed4`, `384ccac`, `2a8c07f`, `e5f1167`, `815395b`, `48be9af`, `7bd5a5f`, `e9b0e8f`). Denne planen erstatter strukturen, men bevarer arbeidet i delte komponenter (BoardPOIDetails-split, BoardPunkterAccordion, SubCategoryFilter chip-rad).
- **Tidligere plan (board UX foundation):** `docs/plans/2026-04-29-001-feat-board-ux-rapport-variant-plan.md`
- **Tidligere plan (kompakt UI):** `docs/plans/2026-04-30-006-feat-rapport-board-compact-ui-plan.md`
- **Memory:** `feedback_mobile_native_ux`, `project_stage_prototype`, `feedback_disclosure_animations`, `feedback_worktree_dev_server`.
- **PROJECT-LOG.md** — siste oppføring 2026-04-30 om 3D-kart filter-sync + worktree-rydding.
- **Institutional learnings (oppsummert i Phase 1.4):**
  - `docs/solutions/ui-patterns/apple-style-slide-up-modal-with-backdrop-blur-20260415.md` (keyframe-namespacing)
  - `docs/solutions/ui-bugs/modal-backdrop-half-viewport-css-animation-collision-20260215.md` (keyframe-kollisjon)
  - `docs/solutions/feature-implementations/profil-filter-eiendom-bolig-20260407.md` (mobile bottom-sheet-presedens)
  - `docs/solutions/architecture-patterns/guide-library-spotify-pattern-20260204.md` (horisontal-scroll-mønster)
  - `docs/solutions/architecture-patterns/placy-guide-mobile-prototype.md` (adaptive komponenter)
  - `docs/solutions/ui-patterns/explorer-desktop-layout-pattern.md` (map-padding + fitBounds)
  - `docs/solutions/ux-improvements/poi-click-no-camera-move-20260207.md` (kamera-policy)
  - `docs/solutions/ux-improvements/active-poi-card-pinned-sidebar-20260208.md` (pinned-bar utenfor scroll)
- **Vaul-dokumentasjon:** https://github.com/emilkowalski/vaul (snapPoints, dismissible, modal)
