---
title: Board UX som ny rapport-variant (mobile-first React + Mapbox)
type: feat
status: active
date: 2026-04-29
deepened: 2026-04-29
origin: public/prototypes/board-ux.html
---

# Board UX som ny rapport-variant (mobile-first React + Mapbox)

## Overview

Porter den fungerende vanilla-prototypen i `public/prototypes/board-ux.html` til en ekte React-rapport-variant under en parallell route (`/eiendom/[customer]/[project]/rapport-board`). Bygg paritet med prototypen på mobil (state machine, peek-card, switcher-chip, reading-modal med Info/Punkter-tabs, POI bottom-sheet) og adaptive desktop (rail + panel + persistent kart). Dette er Phase 1 av en ny rapport-variant — Mapbox 3D / Google Photorealistic 3D Tiles legges til i en oppfølgingsplan etter at 2D-foundation er bevist på reell rapport-data (Wesselsløkka).

## Problem Frame

`public/prototypes/board-ux.html` har modnet til en UX som vi ønsker å gjøre til den nye rapport-flowen. Prototypen er testet på mobil og desktop, og har vist at state-machine-tilnærmingen (default → active → reading → poi) gir bedre UX enn dagens scroll-baserte rapport. Men vanilla-fila kan ikke bruke ekte rapport-data, ekte Mapbox 2D, eller leve i app-routingen. Vi må porte den til React mens vi gjenbruker eksisterende rapport-data-laget (`transformToReportData`), Mapbox-infra (`react-map-gl/mapbox`, `RouteLayer`, `useRouteData`), og shadcn/ui-primitivene (`Drawer`, `Tabs`).

Vi går parallelt — `/rapport` lever videre — for å validere mot reell data uten å låse oss til board-paradigmet før det er bevist.

**Kunde-perspektiv:** Rapportene selges til eiendomsutviklere (Broset Utvikling, KLP m.fl.) som bruker dem som markedsmateriell — embedded på prosjektsider, delt i sales-emails, ofte eksportert som PDF-snapshot. Board endrer artefaktet fra "redaksjonell artikkel" (linjær, scannbar, share-vennlig) til "interaktiv map-opplevelse" (krever interaksjon for å avsløre innhold). Det betyr (a) URL-state for delelinker er ikke en bonus men en eksplisitt kunde-leveranse hvis board skal bli THE rapport, (b) embeddability og PDF-fallback må vurderes før migrering, (c) kunder bør se board-formatet og gi feedback før vi retirer scroll-rapporten. Disse spørsmålene resolveres ikke i Phase 1 (intern validering på Wesselsløkka), men flagges nå slik at deferred items (URL-state, locale) ikke blir behandlet som "nice-to-have" når de potensielt er table stakes.

## Requirements Trace

- **R1.** Ny rapport-variant tilgjengelig på `/eiendom/[customer]/[project]/rapport-board` for samme kundedata som dagens `/rapport`
- **R2.** Server-loader og theme-tokens gjenbrukes uendret fra dagens rapport (samme data, samme cache-strategi)
- **R3.** State machine: `default → active → reading → poi` med smooth transitions, matcher prototypens flyt
- **R4.** Mobil: kategori-grid (horizontal scroll), peek-card med switcher-chip (hamburger + 3 stablede thumbnails), reading-modal full-screen med Info/Punkter-tabs, POI bottom-sheet med drag-handle
- **R5.** Mapbox 2D-kart med markører, sentrert på prosjektets `centerCoordinates`, med path-tegning fra Home til aktiv POI og travel-time-chip
- **R6.** Desktop (≥1024px): adaptive layout med venstre rail (kategori-ikoner), midt-panel (kategori-detalj med Info/Punkter-tabs), høyre persistent kart
- **R7.** Mobile-native UX: shadcn Drawer (vaul) for bottom-sheets, full-screen modal-overgang for reading, native scroll-bouncing
- **R8.** Mapbox-CSS lastes per route-tre (krav for ny route)
- **R9.** Reell rapport-data (Wesselsløkka — `broset-utvikling-as/wesselslokka`) renderes korrekt med kategorier fra `report-themes.ts` og POI-er fra ReportData

## Scope Boundaries

**Inn i scope (denne planen):**
- Parallell route `rapport-board/` med egen `layout.tsx` + `page.tsx`
- Mobile state machine, alle prototype-komponenter portert til React
- Adaptive desktop layout (rail + panel + map)
- Mapbox 2D med path og travel-chip
- Gjenbruk av `transformToReportData` og eksisterende ReportData-shape

**Ute av scope (eksplisitte non-goals):**
- Erstatte eller deaktivere eksisterende `/rapport`-route
- Endringer i Supabase-skjema, `getProductAsync`, eller `transformToReportData`
- Curated-content-pipeline-endringer (vi konsumerer eksisterende `editorialHook`/`localInsight`)
- Auth, sharing, deep-linking via URL-state
- Locale-toggle (NO/EN) — kommer i senere iterasjon
- Auto-fokus / IntersectionObserver scroll-binding (board er ikke scroll-basert)

### Deferred to Separate Tasks

- **Mapbox 3D / Google Photorealistic 3D Tiles toggle** — egen oppfølgingsplan etter 2D-foundation er bevist. Bygger på `UnifiedMapModal`-shell-mønster (`docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md`). Plan-fil: `docs/plans/YYYY-MM-DD-NNN-feat-board-3d-mode-plan.md` (opprettes når Phase 1+2 er landet).
- **URL-state for delelinker** (`?cat=barn-oppvekst&poi=panurkrans`) — egen oppfølgingsplan
- **Migrering av `/rapport` til board-paradigmet** — først etter board er validert mot ≥3 reelle prosjekter

## Validation Strategy

**Intent:** Dette skal bli THE rapport — ikke en evig parallell variant. Parallell route er en wedge for å redusere risiko under utvikling, ikke en permanent koeksistens. Hvis board består validering, retires `/rapport` (og `/rapport-paraform` hvis det fortsatt lever). Hvis board feiler validering, retires `/rapport-board`.

### Success criteria

Phase 1 success (denne planen) måles på:
- **Funksjonell paritet**: alle 9 requirements lander, Wesselsløkka rendrer korrekt på mobil og desktop, ingen åpenbare regresjoner mot prototype-UX
- **Tekniske milestones**: state machine håndterer race-conditions ved rask kategori-/POI-bytte uten visuell flicker eller stale state, mapbox-markørene rendrer (mapbox-gl.css OK), path tegnes innen 500ms

Migration success (Phase 2+, ikke denne planen) måles på:
- **Kvalitativt**: bruker (Andreas) tester begge formatene og foretrekker board uten qualifications. Minst én ekstern kunde (eiendomsutvikler) ser begge og gir preferanse-signal
- **Distribusjon**: URL-state for delelinker fungerer; PDF-fallback eller embed-strategi avklart
- **Coverage**: board lander rent på minst 3 ulike prosjekt-typer (boligprosjekt, hotell, kommersielt) uten tema-spesifikke hacks

### Kill criteria

`rapport-board` retires hvis ETT av disse holder etter Phase 1:
- Mapbox-rendering eller state-machine viser uløselige race-conditions (selv etter 2 iterations)
- Kunde-feedback er konsistent negativ på interaktiv-vs-artikkel-formatet (≥2 av 3 kunder)
- Drift-kostnad per rapport-format > sparte timer fra forbedret UX (vurderes ved Phase 2-start)

`/rapport` (scroll-versjonen) retires når:
- Board har lansert på ≥3 reelle prosjekter med kunde-godkjenning
- URL-state og distribusjon-features er på plass (deferred items levert)
- 30-dagers parallell drift uten kritiske bugs på board

### Måleform

Manuell og kvalitativ i Phase 1 (én bruker, én test-prosjekt). Analytics + kunde-intervjuer ved Phase 2-migration. Ingen A/B-tracking i Phase 1 — for tidlig.

## Context & Research

### Relevant Code and Patterns

- `app/eiendom/[customer]/[project]/rapport/page.tsx` — eksisterende server-loader-mønster (`unstable_cache(getProductAsync(...))`, theme-CSS-vars-injeksjon, `revalidate = 3600`)
- `app/eiendom/[customer]/[project]/rapport-paraform/page.tsx` + `components/variants/report/paraform/` — etablert paraform-variant, bekrefter "ny søsken-mappe"-mønsteret
- `components/variants/report/report-data.ts` — `transformToReportData(project)` → `ReportData` med `themes`, `allProjectPOIs`, `centerCoordinates`, `heroMetrics`. Brukes uendret av board.
- `components/variants/report/report-themes.ts` — `getReportThemes(project)` slår sammen bransjeprofil + reportConfig
- `components/variants/report/ReportThemeMap.tsx` — Mapbox 2D-shell med markers, `previewMode`, `cooperativeGestures`. Mønster å følge for `BoardMap`.
- `lib/map/use-route-data.ts` — Zod-validert, AbortController-cancel, 200ms debounced fetch til `/api/directions`. Direkte gjenbrukbar for path-tegning.
- `components/map/RouteLayer` — Mapbox source/layer for ruter. Direkte gjenbrukbar.
- `components/ui/drawer.tsx` — vaul-basert bottom-sheet med drag-handle, snap-points
- `components/ui/sheet.tsx` — Radix side-sheet (kan vurderes for desktop, men vi bruker grid-layout)
- `components/ui/tabs.tsx` — shadcn Tabs for Info/Punkter
- `lib/store.ts` — pre-bygde shallow-selectors (`useTravelSettings`). Ikke utvid for board-state.
- `lib/kompass-store.ts` — referanse for "egen Zustand-store for prototype-feature" (skip; useReducer dekker board)
- `lib/types.ts` — `POI`-typen med `editorialHook`, `localInsight` (server-pre-rendret)
- `public/prototypes/board-ux.html` — gjeldende prototype, sannhetskilde for komponentlogikk og styling

### Institutional Learnings

- `docs/solutions/architecture-patterns/placy-guide-mobile-prototype.md` — mal for mobile-first kart-produkt-variant. Eksplisitt route-state-machine, AbortController, hydration-guard for `window`/`localStorage`, branded ID-typer, single multi-waypoint-call mot `/api/directions`.
- `docs/solutions/ui-bugs/mapbox-markers-invisible-missing-css-EventRoute-20260413.md` — **kritisk**: hver ny route-tre MÅ ha egen `layout.tsx` som loader `https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css`. Layouts arves kun innenfor samme route-undertre.
- `docs/solutions/ui-bugs/adaptive-markers-zoom-state-timing-bug-20260208.md` — par alltid `mapRef` med en `mapLoaded`-boolean i useEffect-deps. Refs trigger ikke re-render.
- `docs/solutions/architecture-patterns/map-adapter-pattern-20260419.md` — token-pattern (rAF-guard + token-bump per call) for å kansellere overlappende `flyTo`-kall. Siste vinner.
- `docs/solutions/architecture-patterns/report-kart-per-kategori-modal-20260409.md` — `!max-w-none` på shadcn `DialogContent` (responsive-prefiks slår vanlig `max-w-none`); `cooperativeGestures` på alle kart i scrollbart innhold.
- `docs/solutions/best-practices/cross-product-component-reuse-guide-report-20260213.md` — kopiér eksakte Tailwind-klasser fra eksisterende rapport (`w-[50%] px-16`, `rounded-2xl`); `activePOISource: "card" | "marker"`-discriminator for bidireksjonell kart↔kort-state.

### External References

- [vaul Drawer documentation](https://vaul.emilkowal.ski/) — drag-gester, snap-points, nested drawers (shadcn Drawer er bygget på dette)

### Memory-policies som gjelder

- **Mobile-native UX er svært viktig** (`memory/feedback_mobile_native_ux.md`) — adaptive parallelle komponenter når mønstre divergerer; bottom-sheets på mobil, sidekolonner på desktop. Aldri tvinge én layout.
- **Disclosure uten auto-scroll** (`memory/feedback_disclosure_animations.md`) — max-height-animasjon alene er signal nok ved expand; scroll kun ved kollaps.
- **Ikke push hver endring** (`memory/feedback_no_auto_push.md`) — vent på milestones eller eksplisitt push-forespørsel.
- **Prototype-stadium** (`memory/project_stage_prototype.md`) — null-downtime-patterns er over-engineering. Deploy-nedetid på minutter tolereres.

## Key Technical Decisions

- **Route-mønster: parallell søsken-mappe (`rapport-board/`)** — følger paraform-mønsteret eksakt. Klar separasjon, ingen URL-param-magi, `/rapport` lever uendret.
- **Server-loader gjenbrukes 1:1** — kopier `rapport/page.tsx` til `rapport-board/page.tsx`, swap `<ReportPage>` mot `<ReportBoardPage>`. Samme `unstable_cache`-tag, samme revalidate, samme theme-CSS-vars-wrapper.
- **State machine: `useReducer` lokalt i `ReportBoardPage.tsx`** — board-state er ephemeral per visit, deles ikke på tvers av sider. Egen Zustand-store er overkill (jf. learning fra `placy-guide-mobile-prototype.md`).
- **Mapbox 2D: ny `BoardMap.tsx`, gjenbruk overlays** — `ReportThemeMap` er per-tema og har bagasje vi ikke vil ha. Bygg minimal `BoardMap` med `react-map-gl/mapbox`'s `<Map>`, marker-layer, `RouteLayer`, og POI-label/travel-chip som overlays. Bruk `useRouteData` direkte for path-tegning.
- **Adaptive layout: parallelle DOM-trær** (`hidden lg:flex` + `lg:hidden`) — etablert mønster i kodebasen. Felles state machine, separate komponenter for mobil og desktop. Per memory-policy om mobile-native UX.
- **Bottom-sheet: shadcn Drawer (vaul)** — gir drag-handle, snap-points, og native-feel gratis. Full-screen reading-modal er også Drawer (`direction="bottom"`, full høyde).
- **Data-adapter: ny `board-data.ts`** — mapper `ReportData.themes[]` → `BoardCategory[]` og `theme.pois` → `BoardPOI[]`. Tynt lag som tar bort rapport-spesifikk støy (`subSections`, `trails`, `grounding`) og normaliserer til board-modellen.
- **Branded ID-typer** (`BoardCategoryId`, `BoardPOIId`) — forhindrer ID-blanding mellom theme-IDer og POI-IDer i state-reducer.
- **Path-fetch: enkelt walking-rute fra Home til aktiv POI** — bruk eksisterende `useRouteData` med `profile=walking`. Ingen multi-waypoint nå.
- **3D deferred** — egen oppfølgingsplan. 2D-foundation må valideres på Wesselsløkka først.
- **Zustand ↔ reducer-bro for travel-mode** — `useTravelSettings` (Zustand) styrer global travel-mode (walk/bike/car) på tvers av Placy-produkter. Phase 1 hardkoder `walking` i `useRouteData` — board respekterer ikke global travel-mode ennå. Når global travel-mode skal bygges inn (Phase 2 eller separat oppgave): reducer subscriber til `useTravelSettings` via selector i `ReportBoardPage`-toppen, og `useRouteData` re-fetcher via sin innebygde 200ms-debounce + AbortController. Dette er ikke `useEffect`-data-fetch — det er reactive subscription via Zustand selector som passes som arg til hooken. Ingen brudd på CLAUDE.md.

## Open Questions

### Resolved During Planning

- **Hvor lever board-state?** → Lokalt i `ReportBoardPage` med `useReducer`. Ikke i `usePlacyStore` eller egen Zustand-store.
- **Skal vi gjenbruke `ReportThemeMap` eller bygge ny `BoardMap`?** → Bygg ny `BoardMap`. ReportThemeMap har preview-mode og rapport-spesifikk logikk vi ikke trenger.
- **Hvordan håndtere reading-modal vs POI-sheet samtidig?** → Modal lukkes (slides ned) når POI-sheet åpnes. State-reducer setter `state = "poi"` og fjerner reading. Matcher prototypen.
- **Hvilken kunde/data skal vi sikte mot for første test?** → `broset-utvikling-as/wesselslokka` (eksplisitt nevnt av brukeren).

### Deferred to Implementation

- **Path-bezier-kurvatur i ekte koordinatrom** — prototypen brukte SVG quadratic bezier i pixel-rom; ekte ruter kommer fra `/api/directions`. Hvis ruten ser flat/lite kunstnerisk ut, vurder kontroll-punkt-tweaking, men ikke pre-bestem.
- **Marker-design** — gjenbruk eksisterende kategori-marker-styling fra `ReportThemeMap`, eller lag enklere board-spesifikke. Avgjøres i Unit 3.
- **Snap-point pixel-juster** — default `[0.5, 0.9]` er besluttet, men vaul kan kreve pixel-offsets på små viewports (<700px høyde). Juster under impl hvis nødvendig.

### Doc-review findings (2026-04-29) — deferred P2 + FYI

P2 findings ikke adressert i deepening-pass; resolveres ved ce-work eller egne tasks:

- **Unit 1 og Unit 3 dual-claimer R8 (mapbox-gl.css)** — Unit 1 leverer, Unit 3 bør ikke re-claime. Liten tekstuell fiks. (coherence)
- **RouteLayer coordinate-shape mismatch og innebygd travel-chip** — `useRouteData` returnerer `{lat, lng}[]`, RouteLayer forventer `[lng, lat][]`. RouteLayer rendrer egen travel-marker når `travelTime` passes — dobbel chip hvis BoardTravelChip også mountes. Velg én strategi i Unit 7. (feasibility)
- **ReportTheme har ikke `body`-felt** — Unit 5 referer `theme.body || theme.upperNarrative`, men `body` finnes ikke. Bestem kanonisk kilde (`upperNarrative`? konkatenering av `intro + bridgeText + upperNarrative`?) før Unit 5 implementeres. (feasibility)
- **ReportThemeMap-rejection underbegrunnet** — Plan dismisser gjenbruk uten konkrete LOC-eller-feature-eksempler. Verifiser ved Unit 3-impl om en `mode` prop til ReportThemeMap ville fungert; hvis ja, refactor mot gjenbruk per CLAUDE.md "slett gammelt"-regel. (adversarial)
- **Adaptive parallel DOM-trær surface-area** — 60% delt / 40% divergerende. Vurder ved Unit 8 om én komponent med `layout: 'drawer' | 'panel'` prop reduserer surface area. (adversarial)
- **transformToReportData uendret-claim ikke verifisert mot Wesselsløkka** — Sjekk faktisk Wesselsløkka-data før Unit 2-impl: populerer `theme.upperNarrative`/`leadText`/`intro` for hver tema? Har POI-er `editorialHook`/`localInsight`? Hvis felt er tomme, regredierer Unit 5/6. (adversarial)
- **Tilgjengelighet / keyboard-nav i Drawer** — Vaul focus-trap er på, men keyboard-nav inne i Reading Modal og POI-sheet er ikke spesifisert (Tab-rekkefølge, focus-return på close, arrow-keys for POI-kort i Punkter-tab). Spesifiser ved Unit 5/6-impl. (design-lens)
- **iOS safe-area-inset i Drawer-content** — `env(safe-area-inset-bottom)` må appliseres på Drawer-content, ikke wrapper. Mobile-native-policy gjør dette kritisk. Test på reell iPhone. (design-lens, gated_auto med konkret fix)
- **Device-rotasjon under poi-state** — Snap-points er viewport-prosent; portrait→landscape endrer 90% snap fra ~750px til ~370px. Vurder rotation-listener som re-snapper, eller dokumenter som akseptert prototype-friksjon. (design-lens)
- **Behavioral assumption: scan-vs-explore-reader** — Board antar utforsknings-intent; scroll-rapport antar lese-intent. Bruker som kommer fra eiendoms-listing for "rask sjekk" kan oppleve board som tregere. Måle dette ved Phase 2-validation. (product-lens)

FYI (lav-konfidens, til informasjon):

- **mapbox-gl.css i `app/eiendom/layout.tsx` allerede lastet** — Den parent-layouten loader mapbox-gl.css; ny `rapport-board/layout.tsx` er muligens redundant. Verifiser ved Unit 1 om markører rendrer uten egen layout.tsx; hvis ja, dropp filen. (feasibility)
- **Identity/positioning-skift** — Report var posisjonert som "redaksjonelle artikler"; board flytter det mot Explorer-territorium. Kan være riktig, men er en posisjonerings-bet ikke nevnt i planen. (product-lens)
- **Compounding: tre rapport-routes** — `/rapport`, `/rapport-paraform`, `/rapport-board` koeksisterer. Validation Strategy adresserer kill criteria, men paraform-status er fortsatt åpen. (product-lens)
- **3D-deferral kan kompromittere validation-signal** — Hvis brukeren forventer 3D som del av board-verdien, gir 2D-only Phase 1 forvirret signal "er board bedre?" vs "er 3D bedre?". Vurder å kjøre 3D parallelt eller eksplisitt teste 2D-only-validering. (adversarial)

## High-Level Technical Design

> *Dette illustrerer den tiltenkte arkitekturen og er retningsgivende for review, ikke implementasjonsspec. Implementerende agent skal behandle det som kontekst, ikke kode å reprodusere.*

### State machine

```mermaid
stateDiagram-v2
    [*] --> default
    default --> active: tap category card / rail icon
    active --> default: tap switcher-chip / rail "Home"
    active --> reading: tap "Les mer" / desktop "Info" tab default
    reading --> active: tap close / scrim
    reading --> poi: tap POI in Punkter tab
    active --> poi: tap POI marker on map
    poi --> active: tap close / drawer drag-down
    poi --> poi: tap related POI (in-place swap)
```

**Sub-state (orthogonal): path-fetch lifecycle.** Når `phase === "poi"` har path-fetch sin egen mini-state-machine: `idle → fetching → loaded | error`. Dette håndteres internt av `useRouteData` (200ms debounce + AbortController) og er ikke modellert i hovedreduceren — reducer eksponerer `activePOIId`, hooken returnerer `{data, error}`, BoardPathLayer/BoardTravelChip rendrer betinget. Race-håndtering:

- **Rask POI-bytte under in-flight fetch:** AbortController kanselerer forrige fetch når `activePOIId` endres. Token-pattern (egen rAF-guarded `flyTo`-call i BoardMap) sikrer at siste kamera-bevegelse vinner.
- **Stale path ved fetch-feil:** Når ny POI velges, ryddes forrige path *umiddelbart* (sett `coordinates = []`), så fetcher. Hvis ny fetch feiler, forblir det tomt — ikke stale path fra forrige POI. Travel-chip vises kun når `data !== null`.
- **Loading-state:** Travel-chip viser pulserende skeleton-tekst i fetch-vinduet (200ms debounce + nett). POI-label vises umiddelbart ved POI-valg (uavhengig av path-fetch). Path-line tegnes først når data ankommer.
- **In-flight ved phase-change til "active"/"default":** AbortController kanselerer; ingen stale render.

### Komponent-tre

```
ReportBoardPage (use client, eier reducer)
├── BoardMap (Mapbox 2D)
│   ├── HomeMarker
│   ├── POIMarkers (filtrert per activeCategory)
│   ├── PathLayer (RouteLayer + useRouteData)
│   ├── TravelChip (overlay)
│   └── POILabel (overlay)
├── Mobile UI (visible < 1024px)
│   ├── BoardCategoryGrid (state="default")
│   ├── BoardPeekCard + SwitcherChip (state="active")
│   ├── BoardReadingModal (state="reading", vaul Drawer full-height)
│   │   └── Tabs: Info | Punkter
│   └── BoardPOISheet (state="poi", vaul Drawer)
└── Desktop UI (visible ≥ 1024px)
    ├── BoardRail (kategori-ikoner, "Home" øverst)
    └── BoardDetailPanel (kategori-detalj med Info/Punkter Tabs, POI-detail som subview)
```

### Dataflyt

```
Server (rapport-board/page.tsx)
  └─ getProductAsync(customer, slug, "report")
     └─ transformToReportData(project) → ReportData
        └─ <ReportBoardPage data={reportData} />  (klient)
           └─ adaptBoardData(reportData) → { categories: BoardCategory[], home: { center, name } }
              └─ useReducer<BoardState> + render
```

## Implementation Units

- [ ] **Unit 1: Route scaffold + server-loader-kopi**

**Goal:** Ny route-mappe `rapport-board/` med `layout.tsx` (mapbox-gl.css) og `page.tsx` som henter samme data som `/rapport` og rendrer en placeholder-`<ReportBoardPage>`.

**Requirements:** R1, R2, R8

**Dependencies:** Ingen

**Files:**
- Create: `app/eiendom/[customer]/[project]/rapport-board/layout.tsx`
- Create: `app/eiendom/[customer]/[project]/rapport-board/page.tsx`
- Create: `components/variants/report/board/ReportBoardPage.tsx` (placeholder som rendrer "Board UX kommer" + dump av `data.themes.length`)
- Test: `app/eiendom/[customer]/[project]/rapport-board/__tests__/page.test.tsx`

**Approach:**
- Kopiér `rapport/page.tsx` linje for linje, swap `<ReportPage>` mot `<ReportBoardPage>`. Samme `unstable_cache`-tag, samme `generateMetadata`, samme `revalidate = 3600`, samme theme-CSS-vars-wrapper.
- `layout.tsx` injiserer mapbox-gl.css via `<link rel="stylesheet">` (matcher mønster fra eksisterende route-trær med kart).
- `ReportBoardPage` (placeholder) er `"use client"` og tar `data: ReportData` som prop.

**Patterns to follow:**
- `app/eiendom/[customer]/[project]/rapport/page.tsx`
- `app/eiendom/[customer]/[project]/rapport-paraform/page.tsx`
- mapbox-gl.css-pattern fra learning `mapbox-markers-invisible-missing-css-EventRoute-20260413.md`

**Test scenarios:**
- *Happy path:* GET `/eiendom/broset-utvikling-as/wesselslokka/rapport-board` returnerer 200 og rendrer placeholder-tekst.
- *Integration:* Server-rendret HTML inneholder `<link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css">`.
- *Edge case:* Ukjent kunde/prosjekt-slug → 404 (samme atferd som `/rapport`).

**Verification:**
- Browser viser placeholder med korrekt theme-tokens (samme `--primary` som `/rapport`).
- Eksisterende `/rapport`-route fungerer uendret.

---

- [ ] **Unit 2: Board-data-adapter + state-machine-shell**

**Goal:** `ReportBoardPage` blir reell klient-rot med `useReducer`-state machine og data-adapter som mapper ReportData → BoardCategory[]/BoardPOI[].

**Requirements:** R3, R9

**Dependencies:** Unit 1

**Files:**
- Create: `components/variants/report/board/board-data.ts` (`adaptBoardData(reportData) → BoardData`, branded typer `BoardCategoryId`, `BoardPOIId`)
- Create: `components/variants/report/board/board-state.ts` (`type BoardState`, `BoardAction`, `boardReducer`, initial state)
- Modify: `components/variants/report/board/ReportBoardPage.tsx` (bruk reducer, eksponér state-API til children via React Context eller prop-drilling)
- Test: `components/variants/report/board/__tests__/board-state.test.ts`
- Test: `components/variants/report/board/__tests__/board-data.test.ts`

**Approach:**
- `BoardState`: `{ phase: "default" | "active" | "reading" | "poi", activeCategoryId: BoardCategoryId | null, activePOIId: BoardPOIId | null }`
- `BoardAction`: `SELECT_CATEGORY` | `OPEN_READING` | `OPEN_POI` | `BACK_TO_ACTIVE` | `RESET_TO_DEFAULT`
- Reducer er ren funksjon, lett unit-testbar.
- `adaptBoardData` filtrerer bort tomme themes (themes uten POIer) og normaliserer feltnavn (theme.id → categoryId, theme.name → label, theme.icon → ikon, theme.intro/leadText → lead, theme.image/illustration → illustration).
- React Context (`BoardStateContext`) brukes for å unngå prop-drilling til dype barn (peek, modal, sheet).

**Patterns to follow:**
- Branded typer fra `placy-guide-mobile-prototype.md`-learning
- Reducer-mønstre i kodebasen (sjekk om noe finnes; ellers bruk standard React `useReducer` med diskriminerte unioner)

**Test scenarios:**
- *Happy path (state):* `boardReducer({phase:"default"}, {type:"SELECT_CATEGORY", id:"x"})` → `{phase:"active", activeCategoryId:"x"}`.
- *Happy path (state):* Fra `active` + `OPEN_POI` → `phase:"poi"` med `activePOIId` satt.
- *Edge case (state):* `OPEN_POI` mens `phase="default"` (ingen aktiv kategori) → no-op (eller kast/log warning, beslutning i impl.).
- *Edge case (state):* `RESET_TO_DEFAULT` fra hvilken som helst phase → nullstiller alt.
- *Happy path (data):* `adaptBoardData` med Wesselsløkka-fixture returnerer ≥3 kategorier med ikke-tom `pois`-array.
- *Edge case (data):* Theme uten POIer filtreres bort.

**Verification:**
- Reducer-tester passerer.
- `ReportBoardPage` rendrer fortsatt placeholder, men har nå live state-logging i dev-mode (`console.log(state)` for å bekrefte transisjoner).

---

- [ ] **Unit 3: BoardMap (Mapbox 2D-shell med markers)**

**Goal:** Faktisk Mapbox-kart i `ReportBoardPage` som sentrerer på `data.centerCoordinates`, viser HomeMarker og POIMarkers (filtrert per `activeCategoryId`).

**Requirements:** R5, R8, R9

**Dependencies:** Unit 2

**Files:**
- Create: `components/variants/report/board/BoardMap.tsx`
- Create: `components/variants/report/board/BoardMarker.tsx` (POI-marker med kategori-farge + ikon)
- Create: `components/variants/report/board/HomeMarker.tsx`
- Modify: `components/variants/report/board/ReportBoardPage.tsx` (mounter BoardMap som hoved-bakgrunn)
- Test: `components/variants/report/board/__tests__/BoardMap.test.tsx`

**Approach:**
- `BoardMap` bruker `react-map-gl/mapbox`'s `<Map>` med `mapStyle` fra `data.mapStyle ?? <default>`, sentrert på `data.centerCoordinates`, `cooperativeGestures: true`.
- Markører rendres som `<Marker>` (ikke layer-source) for klikk-håndtering. Filtreres per `activeCategoryId` (alle synlige i `default`, kun aktiv kategori i `active`/`reading`/`poi`).
- Marker-popup: `anchor="bottom"`, `offset={[0,-20]}` (jf. learning fra cross-product-reuse).
- Klikk på POI-marker → `dispatch({type:"OPEN_POI", id})`.
- Klikk på Home-marker → `dispatch({type:"RESET_TO_DEFAULT"})`.
- `mapLoaded`-state: boolean som flippes i `onLoad`-callback. Brukes i useEffect-deps for fitToBounds-kall.
- Når `activeCategoryId` endres, fitBounds til kategoriens POIer + Home (med padding).

**Patterns to follow:**
- `components/variants/report/ReportThemeMap.tsx` (Mapbox-shell, `cooperativeGestures`)
- Token-pattern fra `map-adapter-pattern-20260419.md` (rAF-guard + token-bump for fly-cancel)
- mapLoaded-boolean fra `adaptive-markers-zoom-state-timing-bug-20260208.md`

**Test scenarios:**
- *Happy path:* Render med Wesselsløkka-fixture → kart viser Home + alle POIer på `default`.
- *Happy path:* `activeCategoryId="barn-oppvekst"` → kun barn-oppvekst-markører synlige + kart fitter til de POIene.
- *Integration:* Klikk på POI-marker dispatcher `OPEN_POI` med riktig ID.
- *Edge case:* Tomt POI-array (ingen synlige) → kart fitter til Home med default-zoom, ingen krasj.
- *Error path:* Manglende Mapbox-token → graceful fallback (skeleton eller error-tekst, ikke krasj).

**Verification:**
- Kart rendrer markører for Wesselsløkka.
- Klikk på markør oppdaterer state (verifiseres via React DevTools eller test).
- Ingen "markers invisible 937px"-bug (mapbox-gl.css er lastet).

---

- [ ] **Unit 4: Category Grid + Peek Card + Switcher Chip (mobil, state="default" og "active")**

**Goal:** Mobil-UI for kategori-utforsking. Default: horizontal scroll-grid med kategorikort. Active: peek-card stiger opp + switcher-chip vises over kortet.

**Requirements:** R3, R4

**Dependencies:** Unit 2 (state-machine + Context), Unit 3 (kart-bakgrunn for visuell kontekst)

**Files:**
- Create: `components/variants/report/board/mobile/BoardCategoryGrid.tsx`
- Create: `components/variants/report/board/mobile/BoardPeekCard.tsx`
- Create: `components/variants/report/board/mobile/BoardSwitcherChip.tsx`
- Modify: `components/variants/report/board/ReportBoardPage.tsx` (mount mobile-treet med `lg:hidden`-wrapper)
- Test: `components/variants/report/board/__tests__/BoardCategoryGrid.test.tsx`
- Test: `components/variants/report/board/__tests__/BoardPeekCard.test.tsx`

**Approach:**
- `BoardCategoryGrid`: horizontal scroll-container med kategorikort. Hvert kort: bakgrunns-illustrasjon (`next/image` med `fill`), tittel, undertittel, count-badge øverst-høyre. Klikk → `SELECT_CATEGORY`.
- Synlig kun når `phase === "default"` (CSS-translate ut når annet).
- `BoardPeekCard`: bunn-fixed kort med backdrop-blur. Eyebrow (kategori-undertittel), lead-tekst, "Les mer"-knapp. Synlig når `phase === "active"`.
- "Les mer" → `OPEN_READING`.
- `BoardSwitcherChip`: chip over peek-card med hamburger-ikon + 3 stablede thumbnails av andre kategorier (jf. iOS-folder-stil). Dynamisk filtrering (de 3 første kategoriene som ikke er aktiv). Klikk → `RESET_TO_DEFAULT`.
- Bruk eksakte Tailwind-klasser fra prototypen (kopiér fra `board-ux.html`).

**Patterns to follow:**
- Eksisterende `next/image`-bruk i rapport-blokker
- Backdrop-blur og glassmorphism-mønstre i `components/variants/report/`

**Test scenarios:**
- *Happy path:* I `default`, klikk på kategori-kort → state blir `active` med riktig categoryId, grid skjules, peek vises.
- *Happy path:* Switcher-chip viser nøyaktig 3 thumbnails av ANDRE kategorier (ikke aktiv).
- *Edge case:* Kategori uten illustration-felt → fallback-bakgrunn.
- *Edge case:* Fra `active`, klikk switcher-chip → state blir `default`, peek skjules, grid vises.
- *Integration:* Klikk "Les mer" → state blir `reading`, peek skjules, modal åpnes (testes i Unit 5).

**Verification:**
- Mobile viewport (390×844) viser flow visuelt korrekt vs prototype.
- Smooth transitions (CSS `transform translateY` + `transition`).

---

- [ ] **Unit 5: Reading Modal med Info/Punkter Tabs (mobil, state="reading")**

**Goal:** Full-screen reading-modal med kategoritittel, lead, og Info/Punkter-tabs. Info-fanen viser hero-bilde + body. Punkter-fanen viser klikkbare POI-kort (klikk → POI-sheet).

**Requirements:** R3, R4

**Dependencies:** Unit 4

**Files:**
- Create: `components/variants/report/board/mobile/BoardReadingModal.tsx`
- Create: `components/variants/report/board/mobile/BoardRelatedPOICard.tsx` (gjenbrukes i POI-sheet og desktop)
- Modify: `components/variants/report/board/ReportBoardPage.tsx` (mount modal i mobile-treet)
- Test: `components/variants/report/board/__tests__/BoardReadingModal.test.tsx`

**Approach:**
- Bruk shadcn `Drawer` (vaul) med `direction="bottom"` og full-høyde. Open-state styres av `phase === "reading"`.
- **Mount-strategi for reading→poi-overgang:** parallell mount. Reading-Drawer og POI-Drawer er BEGGE mountert i DOM samtidig (ikke conditional unmount). Open-state synkront satt av reducer: `phase="reading"` → reading-Drawer `open=true`, poi-Drawer `open=false`; `phase="poi"` → reading-Drawer `open=false`, poi-Drawer `open=true`. Vaul håndterer hver Drawer's egen close/open-animasjon parallelt (~250ms hver), gir samtidig slide-down + slide-up uten Framer Motion. Forbruker en ekstra POI-Drawer-instans i DOM når reading er åpen, men det er billig.
- Inni: tittel (kategori-undertittel), lead, `<Tabs defaultValue="info">` med tabs Info og Punkter.
- Info-tab: hero-bilde (`next/image fill`) + body-paragrafer (fra theme.body eller theme.upperNarrative).
- Punkter-tab: liste av `BoardRelatedPOICard` (én per POI i kategorien). Klikk → `OPEN_POI`.
- onClose / drag-down → `BACK_TO_ACTIVE`.
- Reset til Info-tab ved hver åpning.
- Scroll til topp ved åpning.

**Patterns to follow:**
- shadcn Drawer-bruk (sjekk eksisterende `components/ui/drawer.tsx` og hvor den er brukt)
- shadcn Tabs-bruk
- `!max-w-none`-fix fra `report-kart-per-kategori-modal-20260409.md`

**Test scenarios:**
- *Happy path:* `phase="reading"` → modal åpen, Info-tab aktiv, hero-bilde og body synlig.
- *Happy path:* Switch til Punkter → POI-liste vises, Info-innhold skjult.
- *Happy path:* Klikk POI i Punkter → `OPEN_POI` dispatched med riktig ID.
- *Edge case:* Kategori uten body-tekst → tom Info-tab uten krasj.
- *Edge case:* Drag-down på modal → `BACK_TO_ACTIVE` (modal lukkes).
- *Integration:* Reading + POI-sheet samtidig → kun POI-sheet synlig (modal skjult per state-machine).

**Verification:**
- Drag-handle synlig og funksjonell.
- Tab-bytte er smooth (ingen flicker).
- POI-klikk → modal slides ned og POI-sheet stiger opp samtidig.

---

- [ ] **Unit 6: POI Bottom Sheet (mobil, state="poi")**

**Goal:** Bottom-sheet for POI-detaljer med drag-handle, ikon, navn, info-linje, body-tekst, og "Andre i kategorien"-relaterte POIer.

**Requirements:** R3, R4, R7

**Dependencies:** Unit 5

**Files:**
- Create: `components/variants/report/board/mobile/BoardPOISheet.tsx`
- Modify: `components/variants/report/board/ReportBoardPage.tsx` (mount sheet i mobile-treet)
- Test: `components/variants/report/board/__tests__/BoardPOISheet.test.tsx`

**Approach:**
- shadcn `Drawer` med `direction="bottom"`. Snap-points: `[0.5, 0.9]` med default på `0.5` ved åpning. 50%-default sikrer at kart, path, og travel-chip er synlige bak sheet-en — POI-konteksten på kartet er en del av UX-en. Bruker drar opp til 90% for å lese mer body-tekst. Hvis snap-binding føles upresis under impl, juster til konkrete pixel-offsets, men hold default ≤ 60% for kart-synlighet.
- Open-state styres av `phase === "poi"`.
- Header: ikon (kategori-marker-stil), navn, undertekst (kategori-navn).
- Info-linje: adresse / avstand-info.
- Body: POI body-tekst (lorem ipsum hvis prototype-data; ekte POI body fra `editorialHook`/`localInsight` ved real data).
- "Andre i kategorien": list av `BoardRelatedPOICard` (samme komponent som Unit 5). Klikk → `OPEN_POI` (in-place swap, ikke close+open).
- Close-knapp eller drag-down → `BACK_TO_ACTIVE`.

**Patterns to follow:**
- vaul snap-points dokumentasjon
- shadcn Drawer (allerede brukt i Unit 5)

**Test scenarios:**
- *Happy path:* `phase="poi"` med valgt POI → sheet åpen, korrekt navn/info/body.
- *Happy path:* Klikk relatert POI → state-`activePOIId` oppdateres, sheet swapper innhold uten close-animasjon.
- *Edge case:* POI uten body-tekst → tom body-seksjon uten krasj.
- *Edge case:* POI er den eneste i kategorien → "Andre i kategorien"-seksjon skjules.
- *Edge case:* Drag-down → `BACK_TO_ACTIVE`, sheet lukkes, peek-card vises igjen.
- *Integration:* Åpning av POI-sheet trigger path-tegning på kartet (testes i Unit 7).

**Verification:**
- Drag-handle responderer på touch.
- Smooth open/close.
- Related POI-swap er rask (ingen flicker).

---

- [ ] **Unit 7: Map overlays (PathLayer, TravelChip, POILabel)**

**Goal:** Når `phase === "poi"`, tegn path fra Home til aktiv POI på kartet, vis travel-time-chip og POI-label som overlays.

**Requirements:** R3, R5

**Dependencies:** Unit 6

**Files:**
- Create: `components/variants/report/board/BoardPathLayer.tsx`
- Create: `components/variants/report/board/BoardTravelChip.tsx`
- Create: `components/variants/report/board/BoardPOILabel.tsx`
- Modify: `components/variants/report/board/BoardMap.tsx` (mount overlays betinget av state)
- Test: `components/variants/report/board/__tests__/BoardPathLayer.test.tsx`

**Approach:**
- `BoardPathLayer`: bruk `useRouteData(activePOI, projectCenter)` fra `lib/map/use-route-data.ts`. Faktisk eksportert signatur er `(activePOI: POI | null, projectCenter: {lat, lng})` — profile er hardkodet til `walking` internt i hooken. Returnerer GeoJSON med koordinat-shape `{lat, lng}[]`. Render som `<Source>` + `<Layer>` (line-layer med kategori-farge); reshape til `[lng, lat][]` ved boundary. *Hvis bike/car må støttes senere: utvid hook eksplisitt — deferred til separat oppgave.*
- `BoardTravelChip`: HTML-overlay (ikke Mapbox-marker) — flyter over kartet med `position: absolute`. Viser travel-time-tekst fra `useRouteData`-resultat.
- `BoardPOILabel`: HTML-overlay som peker på aktiv POI (project-koordinat → screen-koordinat via `map.project()`). Viser POI-navn.
- AbortController-cancel håndteres allerede i `useRouteData`.
- Token-pattern for fly-til-POI: når `phase` blir "poi", `flyTo(poi.coords)` med token-bump.
- **Path-fade ved POI-/kategori-bytte:** når `activePOIId` endres mens `phase === "poi"`, fade gammel path ut først (300ms opacity 1→0), så vis ny path når den ankommer (100ms opacity 0→1 ved `data` truthy). Bruker `mapbox-gl`'s `paint['line-opacity']` med transition-property satt i layer-config. Travel-chip rotates ved samme overgang (mount/unmount Framer-style med opacity, ikke layout-skift).

**Patterns to follow:**
- `useRouteData` (`lib/map/use-route-data.ts`)
- Token-pattern fra `map-adapter-pattern-20260419.md`
- `RouteLayer` for line-rendering (sjekk om finnes; ellers bygg minimal Source+Layer)

**Test scenarios:**
- *Happy path:* `phase="poi"` med valgt POI → path GeoJSON returneres fra `/api/directions`, line tegnes på kartet.
- *Happy path:* Travel-chip viser tid-tekst (f.eks. "5 min").
- *Edge case:* `/api/directions` feiler → silent error (ingen path, ingen chip), POI-sheet fortsatt funksjonell.
- *Edge case:* Rask kategori-/POI-bytte → forrige fetch kanselleres (token-bump), ingen race-condition.
- *Edge case:* `phase` → "active" eller "default" → path fjernes, chip skjules.
- *Integration:* Klikk POI på kart → state="poi" → flyTo + path tegnes.

**Verification:**
- Manuell test: klikk POI → path tegnes innen 500ms (debounce + fetch + render).
- Ingen overlapp-bugs (gammel path som ikke fjernes).
- Ytelse: 60fps under fly-animasjon.

---

- [ ] **Unit 8: Desktop adaptive layout (rail + panel + persistent map)**

**Goal:** Desktop-UI (≥1024px) med venstre rail (kategori-ikoner), midt-panel (kategori-detalj med Info/Punkter Tabs, POI-detail som subview), høyre persistent kart. Samme state machine som mobil.

**Requirements:** R3, R6, R7

**Dependencies:** Unit 7

**Files:**
- Create: `components/variants/report/board/desktop/BoardRail.tsx`
- Create: `components/variants/report/board/desktop/BoardDetailPanel.tsx`
- Create: `components/variants/report/board/desktop/BoardDesktopShell.tsx` (grid-layout: rail + panel + map)
- Modify: `components/variants/report/board/ReportBoardPage.tsx` (mount desktop-treet med `hidden lg:grid`-wrapper)
- Test: `components/variants/report/board/__tests__/BoardDetailPanel.test.tsx`

**Approach:**
- CSS Grid: `grid-template-columns: 104px 400px 1fr` (rail / panel / map).
- `BoardRail`: vertikal ikon-stripe med "Home" øverst og kategori-ikoner under. Aktiv kategori highlightet.
  - Klikk Home → `RESET_TO_DEFAULT`.
  - Klikk kategori → `SELECT_CATEGORY`.
- `BoardDetailPanel`:
  - `phase="default"`: tom-tilstand med "Velg kategori i raden til venstre"-tekst.
  - `phase="active"|"reading"`: kategori-tittel, lead, Tabs (Info | Punkter). Info: bilde + body. Punkter: liste av POI-kort.
  - `phase="poi"`: Punkter-tab er aktiv, viser POI-detail som subview (med tilbake-knapp til list-view).
- **Desktop POI back-affordance:** "Tilbake"-knappen i POI-subview dispatcher `BACK_TO_ACTIVE` og forblir på Punkter-fanen (ikke reset til Info). Brukeren navigerte fra Punkter inn i POI-en og forventer å returnere til Punkter — Info-fanen kan brukeren bytte til manuelt om ønsket.
- Felles state med mobil; render-trærene er parallelle, ikke felles DOM.
- Kart i tredje kolonne er den samme `BoardMap`-komponenten — kart-state er global (ikke duplisert).

**Patterns to follow:**
- Adaptive layout-mønster fra `report-kart-per-kategori-modal-20260409.md` (drawer venstre desktop / bunn mobil)
- Eksisterende rail-pattern hvis det finnes (sjekk `components/variants/explorer/`)

**Test scenarios:**
- *Happy path:* Desktop-viewport (1280×800) → rail + panel + kart synlig, mobile-tre skjult.
- *Happy path:* Klikk kategori i rail → `SELECT_CATEGORY` dispatched, panel viser kategori-detalj, kart fitter til kategoriens POIer.
- *Happy path:* I Punkter-tab, klikk POI → `OPEN_POI`, panel swapper til POI-detail-subview, path tegnes på kart.
- *Happy path:* Tilbake-knapp i POI-detail → `BACK_TO_ACTIVE`, panel tilbake til kategori-detalj.
- *Edge case:* Resize fra desktop til mobile-viewport → DOM-tre swapper (mobile vises, desktop skjules), state bevares.
- *Integration:* Klikk POI-marker på kartet i desktop-mode → panel oppdateres, ikke bottom-sheet.

**Verification:**
- Manuell test: 1280px og 1920px viewports.
- Resize-test: dra browser fra 1024px til 1023px og tilbake — ingen state-tap.
- POI-mønster på desktop er panel-subview, ikke bottom-sheet.

## System-Wide Impact

- **Interaction graph:** Ny route bruker eksisterende `getProductAsync`/`unstable_cache`-pipeline. Cache-tag `product:${customer}_${slug}` deles med `/rapport` — `revalidateTag` invaliderer begge varianter.
- **State lifecycle risks:** Path-fetch-cancellation må håndteres ved rask kategori-/POI-bytte (AbortController + token). Allerede dekket i `useRouteData`.
- **API surface parity:** Ingen endringer i `/api/directions`, `/api/travel-times`, `getProductAsync`. Ren konsum.
- **Unchanged invariants:** `/rapport` lever uendret. `transformToReportData` er pure og deles. `lib/store.ts` utvides ikke.
- **Integration coverage:** End-to-end: server-loader → klient-page → state machine → kart-overlays. Krever manuell verifisering på Wesselsløkka-data.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Mapbox-markører usynlige på ny route (`mapbox-gl.css`-feil) | `layout.tsx` injiserer CSS i Unit 1; verifiseres i smoke-test |
| Race-condition mellom fly-til + path-fetch ved rask POI-bytte | Token-pattern + AbortController; `useRouteData` har det innebygd |
| `cooperativeGestures` skaper friksjon på mobil scroll-i-kart | Bekreft via touch-test; juster om brukeren rapporterer issues |
| Adaptive layout-DOM dupliserer state (mobile + desktop tre) | Felles state via Context — verifiser at ingen subtree har egen lokal state for kategori/POI |
| Drawer + Modal samtidig (z-index, focus-trap) | shadcn Drawer håndterer dette; verifiser at kun én er åpen om gangen |
| Path-tegning ser flat/lite kunstnerisk ut sammenlignet med prototypens SVG-bezier | Ekte ruter er sannferdige (bedre UX-signal); ikke fals det. Hvis det blir et issue, vurder små overlays. |

## Documentation / Operational Notes

- Ingen migrasjoner, ingen nye env-vars.
- Etter Unit 1 landet: legg til kort note i `PROJECT-LOG.md` om at `rapport-board/`-route er live for testing.
- Ingen rollback-prosedyre nødvendig — parallell route, kan slettes uten å påvirke `/rapport`.
- Vercel-deploy: gjenbruk eksisterende preview-URLer.

## Sources & References

- **Origin:** `public/prototypes/board-ux.html` (gjeldende prototype, brukt som funksjonell spec)
- **Eksisterende rapport:** `app/eiendom/[customer]/[project]/rapport/page.tsx`
- **Etablert variant-mønster:** `app/eiendom/[customer]/[project]/rapport-paraform/page.tsx`, `components/variants/report/paraform/`
- **Data-transform:** `components/variants/report/report-data.ts`
- **Mapbox-shell-mønster:** `components/variants/report/ReportThemeMap.tsx`
- **Path-fetch:** `lib/map/use-route-data.ts`
- **Learnings:**
  - `docs/solutions/architecture-patterns/placy-guide-mobile-prototype.md`
  - `docs/solutions/ui-bugs/mapbox-markers-invisible-missing-css-EventRoute-20260413.md`
  - `docs/solutions/ui-bugs/adaptive-markers-zoom-state-timing-bug-20260208.md`
  - `docs/solutions/architecture-patterns/map-adapter-pattern-20260419.md`
  - `docs/solutions/architecture-patterns/report-kart-per-kategori-modal-20260409.md`
  - `docs/solutions/best-practices/cross-product-component-reuse-guide-report-20260213.md`
- **External:** [vaul Drawer](https://vaul.emilkowal.ski/)
- **Memory-policies:** `feedback_mobile_native_ux.md`, `feedback_disclosure_animations.md`, `feedback_no_auto_push.md`, `project_stage_prototype.md`
