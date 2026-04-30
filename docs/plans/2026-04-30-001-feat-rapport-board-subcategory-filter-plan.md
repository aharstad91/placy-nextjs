---
title: Sub-kategori-filter for POI-liste på rapport-board
type: feat
status: active
date: 2026-04-30
---

# Sub-kategori-filter for POI-liste på rapport-board

## Overview

Når et tema (BoardCategory) inneholder mange POI-er — f.eks. mat-temaet på Nøstebukten Brygge med 31 punkter fordelt på bakeri, restaurant, pub og kafé — er Punkter-lista vanskelig å skanne. Sub-kategoriene er allerede tilgjengelig på hver POI (`raw.category`), men brukeren har ingen måte å filtrere på dem.

Vi legger til et sub-kategori-filter (shadcn Popover med checkbox-list, count og "Vis/Skjul alle"-toggle) over Punkter-lista. Filteret påvirker både POI-lista (desktop accordion + mobile reading-modal Punkter-tab) og kart-markørene innenfor det aktive temaet — slik at "Punkter (X)" og synlige markører forblir konsistente.

Mønsteret gjenbruker den visuelle og interaksjonsmessige logikken fra `ExplorerThemeChips` i Explorer-produktet, men tilpasses til rapport-board sin enklere kontekst (filter for ett aktivt tema om gangen, ikke alle tema samtidig).

## Problem Frame

**Bruker-problemet:** På `/eiendom/<kunde>/<prosjekt>/rapport-board` velger leseren et tema (f.eks. mat) og får opp Punkter-tabben. For tema med >10 POI er listen overveldende — det er vanskelig å se forskjell på "hvor mange restauranter har vi i området" vs. "hvor mange bakerier". Markørene på kartet bruker sub-kategori-ikoner (kopp, knife/fork, vinglass) men listen viser bare tema-fargen, så det krever konstant øye-bevegelse mellom kart og liste.

**Forretnings-konsekvens:** Rapporten skal hjelpe en kjøper å danne seg et bilde av nabolaget kvalitativt — om det ikke er enkelt å differensiere typer mat-tilbud, mister rapporten faglig tyngde for store områder.

## Requirements Trace

- R1. Brukeren skal kunne se hvilke sub-kategorier som finnes innenfor et tema, med antall POI per sub-kategori.
- R2. Brukeren skal kunne skjule/vise hver sub-kategori individuelt.
- R3. Brukeren skal kunne skjule/vise alle sub-kategorier samtidig ("Skjul alle"/"Vis alle"-knapp).
- R4. Punkter-tab-tellingen og kart-markører skal være konsistent med synlig filter-tilstand.
- R5. Filteret må fungere både på desktop (BoardDetailPanel) og mobil (BoardReadingModal).
- R6. Filteret skal kun vises når temaet har ≥2 forskjellige sub-kategorier (ingen verdi for tema med kun én).
- R7. Filter-tilstand resettes ved bytte av aktivt tema (kontekstuelt per kategori — ingen overraskelse når man går tilbake til samme tema senere).

## Scope Boundaries

- Filteret virker **kun innenfor det aktive temaet** — vi filtrerer ikke på tvers av tema (det skjer allerede via tema-valget).
- Filteret påvirker **ikke** "Andre i kategorien"-listen i `BoardPOISheet` (mobil POI-detalj) — den er en relatert-POI-liste, ikke hovedlista.
- Vi legger **ikke** filter-tilstand i URL-en (jf. prototype-stadium, ingen krav om delelinker for filter).
- Vi gjør **ingen** endringer i datamodellen eller pipeline (`board-data.ts` adapter er uendret — sub-kategorier hentes fra eksisterende `poi.raw.category`).
- Vi endrer **ikke** Explorer-produktets eksisterende filter-mønster — vi gjenbruker visuelt språk, men implementerer som ny komponent fordi data-shape er forskjellig (board: ett tema → mange sub-kat; explorer: mange tema → mange sub-kat).

## Context & Research

### Relevant Code and Patterns

- `components/variants/explorer/ExplorerThemeChips.tsx` — autoritativt mønster for popover-filter med checkbox-list, count, partial-state (X/Y), og "Vis alle/Skjul alle". Bruk `disabledCategories: Set<string>` som sannhetskilde (negativ form: aktivt = ikke i settet).
- `components/variants/report/board/desktop/BoardPOIAccordion.tsx` — Punkter-listen på desktop, mottar `category: BoardCategory` og rendrer `category.pois`. Filtrering skjer enklest ved å derive en `visiblePois`-liste før render.
- `components/variants/report/board/mobile/BoardReadingModal.tsx` (linje 98-110) — Punkter-tab på mobil bruker `cat.pois.map(...)` direkte med `BoardRelatedPOICard`. Samme filtreringspunkt som desktop.
- `components/variants/report/board/BoardMap.tsx` (linje 84-96) — `visiblePOIs` useMemo. Må respektere filteret når `state.phase !== "default"` (dvs. kun innenfor aktivt tema).
- `components/variants/report/board/board-state.tsx` — sentral state via reducer. Filter-state legges som lokal `useState<Set<string>>` i en hook som lever ved siden av reducer-state, eller i nytt context-felt. Reducer trenger ikke utvides hvis vi legger filter som separat hook.
- `components/variants/report/board/board-data.ts` — `BoardPOI.raw.category` har `id`, `name`, `icon`, `color`. Disse brukes som sub-kategori-kilde.
- `components/ui/popover.tsx`, `components/ui/checkbox.tsx` — shadcn-komponenter er allerede installert.

### Institutional Learnings

- `feedback_mobile_native_ux.md` (memory): Mobile-native UX er viktig — adaptive komponenter når mønstre divergerer. Vurder om popover-pattern fra desktop er rett på mobil, eller om mobil bør ha bottom-sheet/drawer-variant.
- `feedback_disclosure_animations.md` (memory): max-height-animasjon ved expand er signal nok, scroll kun ved kollaps. Relevant hvis vi animerer filter-popover.
- `docs/plans/2026-02-09-category-filter-ux-plan.md` — eksisterende plan for explorer-filter-UX som bekrefter klikk-på-hele-chippen-åpner-dropdown-mønsteret. Bruk som referanse for interaksjon, ikke som mal for implementasjon.

### External References

Ingen eksterne kilder konsultert — sterk lokal pattern dekker hele behovet.

## Key Technical Decisions

- **Filter-state lever som lokal hook, ikke i reducer.** Reducer styrer navigasjon (phase + active IDs). Filter er rent visuelt og resetter ved kategori-bytte. Å legge det i reducer øker kompleksitet uten gevinst. Vi lager en `useSubCategoryFilter` hook som tar `activeCategoryId` og returnerer `{ hiddenSubCategoryIds, toggle, toggleAll, reset }`.
- **Filter resettes ved bytte av aktivt tema.** Kontekstuell per kategori. Hvis brukeren velger mat → skjuler bakeri → bytter til transport → tilbake til mat: bakeri vises igjen. Dette matcher mental modell ("hver kategori har sitt fokus").
- **Filteret påvirker både liste og kart-markører.** Konsistens — hvis "Punkter (8)" står over lista, må 8 markører vises på kartet. Inkonsistens her er forvirrende.
- **Sub-kategorier deriveres on-the-fly fra `category.pois`.** Ingen endring i `board-data.ts`. Komponenten beregner `subCategoryInfo: Map<id, {name, icon, color, count}>` lokalt. Holder dataflow enkelt.
- **Filter skjules helt for tema med <2 sub-kategorier.** Ingen verdi i et filter med ett valg. Reduserer visuelt støy for små tema.
- **shadcn `Popover` (desktop) + `Drawer` (mobil) som UI-shell.** Mobile-native: full-skjerm/bunn-drawer på mobil føles bedre enn liten popover. `BoardReadingModal` bruker allerede vaul-drawer som hovedmodal — sub-kategori-filteret må unngå drawer-i-drawer-konflikt; bruk shadcn Popover/inline-disclosure innenfor drawer-en eller en simpel inline-checklist åpnet via knapp.
- **Negativ filter-form (`hidden`-set, ikke `visible`-set).** Matcher Explorer-pattern. Tom set = alle synlige (default-tilstand). Enklere å resonnere om "alt er på som default".

## Open Questions

### Resolved During Planning

- Persist filter på tvers av kategori-bytte? **Nei — reset ved bytte**, kontekstuelt per kategori.
- Skal kart-markører også filtreres? **Ja — konsistens med liste-tellingen.**
- Skal filteret virke i `BoardPOISheet` "Andre i kategorien"-list? **Nei — det er en relatert-list, ikke hovedlista. Filteret begrenser seg til Punkter-tab og kart-markører.**

### Deferred to Implementation

- Eksakt UI-mekanikk på mobil innen drawer-en (popover-i-drawer vs. inline disclosure vs. bottom-sheet-i-bottom-sheet) — bekreftes når komponenten testes mot vaul-drawer i praksis. Risiko: drawer-i-drawer kan ha stacking/scroll-konflikter.
- Skal sub-kategori-ikonet i listen (BoardPOIAccordion) være tema-fargen eller sub-kategoriens egen farge? Per nå er det tema-fargen (`category.color`). Kan vurderes å bruke `poi.raw.category.color` for ekstra differensiering — men dette er en estetikk-beslutning som tas i implementasjon.

## High-Level Technical Design

> *Dette illustrerer den intenderte tilnærmingen og er retningsgivende for review, ikke implementasjonsspesifikasjon. Implementerende agent behandler det som kontekst, ikke kode-å-reprodusere.*

```
BoardProvider
├── useSubCategoryFilter(activeCategoryId)   ← ny hook
│   └── state: hiddenIds: Set<string>
│   └── effect: reset når activeCategoryId endres
│
├── BoardDetailPanel (desktop)
│   └── Tab "Punkter":
│       └── <SubCategoryFilter category=... hiddenIds=... onToggle=... />
│       └── <BoardPOIAccordion category={filteredCategory} />   ← filter applied
│
├── BoardReadingModal (mobile)
│   └── Tab "Punkter":
│       └── <SubCategoryFilter ... variant="mobile" />
│       └── liste av <BoardRelatedPOICard /> for filteredCategory.pois
│
└── BoardMap
    └── visiblePOIs: når phase !== "default", filtrer ut pois hvor
        poi.raw.category.id ∈ hiddenIds
```

Filter-mekanisme i `<SubCategoryFilter />`:

```
trigger: chip/knapp som viser "Filter (X/Y)" eller "Vis alle"-state
popover/drawer-content:
  ┌─────────────────────────────────────┐
  │ [icon] Bakeri              (8) [✓] │
  │ [icon] Restaurant         (12) [✓] │
  │ [icon] Pub                 (4) [ ] │  ← skjult
  │ [icon] Kafé                (7) [✓] │
  ├─────────────────────────────────────┤
  │ [eye] Skjul alle / Vis alle         │
  └─────────────────────────────────────┘
```

## Implementation Units

- [ ] **Unit 1: Sub-kategori-derivering + filter-hook**

**Goal:** Etablere data-shape og state-håndtering for filteret. Hooken er fundamentet alle andre units bygger på.

**Requirements:** R1, R2, R7

**Dependencies:** Ingen.

**Files:**
- Create: `components/variants/report/board/use-sub-category-filter.ts`
- Create: `components/variants/report/board/use-sub-category-filter.test.ts`

**Approach:**
- `useSubCategoryFilter(activeCategoryId: string | null)` returnerer `{ hiddenIds: Set<string>, toggle(id), toggleAll(allIds), reset() }`.
- Reset (clear set) når `activeCategoryId` endres (useEffect på id-endring).
- Helper: `deriveSubCategories(category: BoardCategory): SubCategoryInfo[]` — itererer `category.pois`, dedupliserer på `raw.category.id`, returnerer `{ id, name, icon, color, count }[]` sortert etter count desc (for naturlig rekkefølge i UI).

**Patterns to follow:**
- Set-basert state-pattern fra `ExplorerThemeChips` (negativ filter-form).
- Branded ID-typer fra `board-data.ts` der relevant (sub-kategori-IDer er rene strenger fra `Category.id`, ikke nødvendig å brande).

**Test scenarios:**
- Happy path: hook returnerer tom `hiddenIds` på init → alle sub-kat synlige.
- Happy path: `toggle("bakeri")` → "bakeri" i hiddenIds; igjen → fjernet.
- Happy path: `toggleAll(["bakeri","restaurant","pub","kafé"])` når alle synlig → alle skjult; igjen → alle synlig.
- Edge case: `activeCategoryId` endres fra "mat" til "transport" → hiddenIds resettes til tom set.
- Edge case: `activeCategoryId === null` (default-phase) → toggle/toggleAll er no-op (eller ikke kalles fra konsumenten).
- Happy path: `deriveSubCategories(category)` på tema med 31 POI fordelt på 4 sub-kat → returnerer 4 entries med korrekt `count` per sub-kat.
- Edge case: `deriveSubCategories` på tema der alle POI har samme sub-kat → returnerer ett entry. Konsumenten skal kunne skjule filter basert på `length < 2`.

**Verification:**
- Tester passerer.
- Hook returnerer riktig state-shape under manuell testing av kategori-bytte.

---

- [ ] **Unit 2: SubCategoryFilter-komponent (shadcn Popover + Drawer-aware)**

**Goal:** Bygg den visuelle filter-knappen + popover/drawer-innhold, som kan plasseres over Punkter-listen i både desktop og mobil.

**Requirements:** R1, R2, R3, R5, R6

**Dependencies:** Unit 1.

**Files:**
- Create: `components/variants/report/board/SubCategoryFilter.tsx`
- Create: `components/variants/report/board/SubCategoryFilter.test.tsx`

**Approach:**
- Props: `subCategories: SubCategoryInfo[]`, `hiddenIds: Set<string>`, `onToggle(id)`, `onToggleAll()`, `variant: "desktop" | "mobile"`.
- Trigger-knapp: viser tekst som "Filtrér" + count-badge (`(X/Y)` når noe filtrert, ellers `(Y)`). Form-faktor matcher Punkter-tab-headeren.
- Desktop: shadcn `Popover` (følger Explorer-mønster).
- Mobil: vurder shadcn `Popover` først; hvis stacking/scroll-konflikt mot vaul-drawer i `BoardReadingModal` oppstår, bruk inline-disclosure (collapse/expand under knappen) i stedet. Beslutning tas i implementasjon.
- Skjul hele komponenten (return null) når `subCategories.length < 2`.
- Innhold: liste av rader med sub-kat-ikon (sirkel med farge), navn, count, og checkbox-tilstand. "Vis/Skjul alle" i bunnen med separator over.
- Styling: gjenbruk visuelle primitiver fra `ExplorerThemeChips` (sirkel-ikon w-6 h-6, font-sizes, separator-linje).

**Patterns to follow:**
- `ExplorerThemeChips.tsx` linje 178-228 (popover-content med checkbox-rader + toggle-alle).
- `getFilledIcon(iconName)` fra `lib/utils/map-icons-filled` for sub-kat-ikon-rendering (matcher BoardMarker).

**Test scenarios:**
- Happy path: rendrer trigger med korrekt count "(2/4)" når 2 av 4 sub-kat er skjult.
- Happy path: klikk på checkbox-rad kaller `onToggle(id)` med riktig id.
- Happy path: klikk på "Skjul alle" når alle synlig → kaller `onToggleAll()`. Knapp-tekst er "Skjul alle".
- Happy path: klikk på "Vis alle" når alle skjult → kaller `onToggleAll()`. Knapp-tekst er "Vis alle".
- Edge case: `subCategories.length === 1` → komponenten returnerer null (ingenting renderes).
- Edge case: `subCategories.length === 0` → komponenten returnerer null.
- Edge case: `variant="mobile"` rendrer i mobil-vennlig form (test-assert at mobile-variant container har riktig shadcn-element eller layout-klasser).
- Integration: trigger-klikk åpner popover (desktop), close-on-outside-click fungerer.

**Verification:**
- Komponenten kan brukes isolert i Storybook eller manuell test-side med dummy-data.
- Visual fidelity matcher Explorer-pattern (referanse-screenshot).

---

- [ ] **Unit 3: Wire filter inn i Punkter-listen (desktop + mobil)**

**Goal:** Koble filter-hook + komponent inn i Punkter-tabben på desktop (BoardDetailPanel/BoardPOIAccordion) og mobil (BoardReadingModal).

**Requirements:** R1, R2, R4, R5, R6, R7

**Dependencies:** Unit 1, Unit 2.

**Files:**
- Modify: `components/variants/report/board/desktop/BoardDetailPanel.tsx`
- Modify: `components/variants/report/board/desktop/BoardPOIAccordion.tsx`
- Modify: `components/variants/report/board/mobile/BoardReadingModal.tsx`
- Create/extend: `components/variants/report/board/desktop/BoardPOIAccordion.test.tsx` (hvis ikke finnes — verifiser først)

**Approach:**
- Lift `useSubCategoryFilter` til `BoardDetailPanel` (desktop) og `BoardReadingModal` (mobil) — der `category` allerede er tilgjengelig via `useActiveCategory`.
- Beregn `filteredPois = category.pois.filter(p => !hiddenIds.has(p.raw.category.id))` før render.
- Send `filteredPois` til `BoardPOIAccordion` (eller endre signaturen til å ta `pois` direkte i stedet for hele `category`-objektet — vurder enkelhet vs. minimal endring).
- Plasser `<SubCategoryFilter />` over POI-listen, under tab-trigger.
- Oppdater Punkter-tab-tellingen til å bruke `filteredPois.length` (vurdér: vis "Punkter (8/12)" når filtrert, eller bare "(8)"? Foreslår: "(filteredCount)" for ren tabbing-UX, med "Filtrér"-trigger som viser X/Y-mønsteret).
- Reset filter ved kategori-bytte er allerede dekket av Unit 1 (hooken).

**Patterns to follow:**
- `BoardPOIAccordion`s eksisterende reset-on-category-change pattern (linje 47-49) — analog for filter.
- `BoardReadingModal`s tab-state-reset pattern (linje 18-21) som bygger på `open`-flagget.

**Test scenarios:**
- Happy path: desktop — på mat-tema, skjul "bakeri" → accordion viser ikke bakeri-POI-er, count "Punkter (X)" oppdateres.
- Happy path: mobil — i reading-modal Punkter-tab, skjul "pub" → BoardRelatedPOICard-listen er filtrert tilsvarende.
- Happy path: bytt fra mat → transport → tilbake til mat → filter er resettet (alle synlig).
- Edge case: tema med kun én sub-kategori → `<SubCategoryFilter />` rendrer ikke, accordion fungerer som før.
- Edge case: skjul ALLE sub-kategorier → filteredPois er tom, accordion viser tom-state (enten current default eller en ny "Ingen punkter matcher filter"-tekst).
- Integration: åpne accordion-item, skjul sub-kat som ikke inneholder den åpne POI-en → POI forblir åpen og synlig (forventet, siden den ikke er filtrert ut).
- Integration: åpne accordion-item, skjul sub-kat som **inneholder** den åpne POI-en → POI forsvinner fra lista. Verifiser at `state.activePOIId` håndteres greit (faller tilbake til BACK_TO_ACTIVE eller forblir uten visuell konflikt).

**Verification:**
- Manuell test på `/eiendom/obos/nostebukten-brygge/rapport-board` — mat-tema viser filter med 4 sub-kat, filtrering fungerer.
- Tab-counter er konsistent med synlig liste.
- Reset ved kategori-bytte verifisert.

---

- [ ] **Unit 4: Wire filter inn i kart-markører**

**Goal:** Sørg for at kart-markører i aktivt tema også filtreres, slik at synlig kart matcher synlig liste.

**Requirements:** R4

**Dependencies:** Unit 1, Unit 3.

**Files:**
- Modify: `components/variants/report/board/BoardMap.tsx`
- Modify (potentially): `components/variants/report/board/board-state.tsx` (kun hvis vi velger å eksponere `hiddenIds` via context i stedet for å duplisere hooken)

**Approach:**
- BoardMap trenger tilgang til samme `hiddenIds` som BoardDetailPanel/BoardReadingModal bruker. To alternativer:
  - **Alt A:** Eksponer `hiddenIds` via `BoardContext` (legg til som en separat slot ved siden av reducer-state). BoardMap leser via `useBoard()`.
  - **Alt B:** Lift `useSubCategoryFilter` til `BoardScaffold` eller `BoardProvider`-wrapper, drill props til både panel/modal og BoardMap.
- **Foreslår Alt A** — passer monorepo-konvensjonen (context har `state`, `dispatch`, `data`; legg til `subFilter`). Mindre prop-drilling.
- I BoardMap `visiblePOIs`-useMemo (linje 84-96): når `state.phase !== "default"`, filtrer `activeCategory.pois` med `!hiddenIds.has(p.raw.category.id)`.
- I default-phase: ingen filter (oversiktsmodus viser alle markører i alle tema).

**Patterns to follow:**
- Eksisterende `visiblePOIs` derivering — minimal endring, ikke ny utvelgelseslogikk.
- Context-utvidelse-pattern: legg `subFilter` som ny key på `BoardContextValue`, ikke vri på reducer.

**Test scenarios:**
- Happy path: mat-tema aktivt, skjul "bakeri" → bakeri-markører forsvinner fra kartet (eller dimmes — beslut hvilken; foreslår fjernes for konsistens med listen).
- Happy path: bytt til transport-tema → mat-filter resettet, transport-tema viser alle sine markører.
- Happy path: default-phase → alle markører i alle tema synlig (filter ignoreres).
- Edge case: skjul alle sub-kategorier → null markører i aktivt tema, men HomeMarker er fortsatt synlig.
- Integration: skjul sub-kat som inneholder `state.activePOIId` → markør forsvinner. POI-state-håndtering må være graciøs (kanskje BACK_TO_ACTIVE i sync med Unit 3, eller at man tillater "ghost"-active POI).

**Verification:**
- Manuell test: mat-tema, skjul bakeri → 8 (eller riktig antall) bakeri-markører forsvinner. Telling matcher liste.
- Bytt tema → markører i nytt tema vises uten filter.

## System-Wide Impact

- **Interaction graph:** Filter påvirker tre rendering-overflater (BoardPOIAccordion, BoardReadingModal Punkter-tab, BoardMap markører). Sannhetskilde må være ett sted (BoardContext).
- **Error propagation:** Ingen nye feilmoduser — filter-state er ren `Set<string>`, ingen async-kall. Hvis state mismatches mellom liste og kart oppstår, er det en sync-bug, ikke datafeil.
- **State lifecycle risks:** Filter-reset må fyre **én** gang per kategori-bytte (useEffect-dependency på activeCategoryId). Hvis hooken instansieres flere steder (panel + map), må de dele state — ellers desynkroniseres de. Dette er hvorfor Alt A (context) er valgt.
- **API surface parity:** Ingen endring i offentlig API (server-actions, URL-params). Frontend-only.
- **Integration coverage:** Sjekk at `state.activePOIId` ikke peker til en filtrert-ut POI etter `toggle`. Hvis ja, dispatch `BACK_TO_ACTIVE` for å unngå "ghost-active".
- **Unchanged invariants:** Reducer (`boardReducer`) er uendret. Default-phase oversiktsmodus i BoardMap er uendret. `board-data.ts` adapter er uendret.

## Risks & Dependencies

| Risiko | Mitigering |
|--------|------------|
| Drawer-i-drawer-konflikt på mobil (popover inni vaul-drawer) | Test først; fall tilbake til inline disclosure innenfor reading-modal hvis stacking eller scroll bryter. |
| `state.activePOIId` peker til filtrert-ut POI → "ghost"-active | I Unit 3, watch for endring i hiddenIds + activePOIId; dispatch BACK_TO_ACTIVE når active POI blir skjult. |
| Performance for tema med 50+ POI ved hyppig filter-toggle | Liste er allerede O(n) render. Set-lookup er O(1). Negligible på realistiske datasett (typisk <60 POI per tema). |
| Visuell støy hvis filter-trigger konkurrerer med "Punkter (X)"-tab-counter | Designbeslutning: trigger plasseres som ny rad under tabs, ikke i samme rad. |
| Sub-kategori uten ikon/farge fra fallback-data | Bruk MapPin-default fra `getFilledIcon` og stone-400 som default-farge — samme fallback som BoardCategory bruker. |

## Documentation / Operational Notes

- Ingen migrering, ingen rollback-bekymringer (frontend-only, prototype-fase tolererer kort downtime per memory `project_stage_prototype.md`).
- Når implementert, oppdater `docs/solutions/ui-patterns/` med kort solution-doc om filter-mønsteret hvis det er gjenbrukbar lærdom utover Explorer-pattern (ellers ikke).

## Sources & References

- Eksisterende mønster: `components/variants/explorer/ExplorerThemeChips.tsx`
- Eksisterende plan (referanse): `docs/plans/2026-02-09-category-filter-ux-plan.md`
- Test-URL: `/eiendom/obos/nostebukten-brygge/rapport-board`
- Trello board: Utvikling (`onb3nsLD`)
