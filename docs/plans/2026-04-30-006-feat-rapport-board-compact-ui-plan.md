---
title: "Kompakt rapport-board-UI: ikon-only rail + tetter Punkter-liste"
type: feat
status: active
date: 2026-04-30
---

# Kompakt rapport-board-UI: ikon-only rail + tetter Punkter-liste

## Overview

Rapport-boardets desktop-UI har mye luft sammenlignet med produkter som Discord — venstre rail bruker 104px med store illustrasjons-kort + tekst-label, og Punkter-accordion-en har 12px vertical padding + 10px gap mellom kort. Med mye innhold å vise (47+ POI-er per kategori er vanlig) merkes lufta som unødvendig spilt vertikal og horisontal plass.

Discord-mønsteret: smalere icon-only rail med tooltip på hover for full label, og tettere stacking i innholds-lister. Dette er det vi etterligner. Mobil-UI berøres ikke (egen oppgave hvis ønsket senere).

## Problem Frame

### Hva som er for luftig i dag

**BoardRail (`components/variants/report/board/desktop/BoardRail.tsx`)**
- Width: 104px
- Container padding: `px-3 py-5` (12px / 20px)
- Hjem-knapp: `h-[72px]` med ikon + tekst stacked vertikalt
- Kategori-knapper: `h-[88px]`, illustrasjon 56×56 + label under
- Gap mellom knapper: `gap-1.5` (6px)
- Brukeren ser maks 5-6 kategorier samtidig på en typisk laptop-høyde — flere må scrolles til (selv om kun 6 finnes i dag)

**BoardPOIAccordion (`components/variants/report/board/desktop/BoardPOIAccordion.tsx`)**
- Cards: `py-3 px-3.5` (12px / 14px)
- Gap mellom cards: `gap-2.5` (10px)
- Ikon-circle: 32×32 (allerede komprimert i forrige runde)
- Med 47 POI-er i en kategori betyr 10px gap + 56px card-høyde = ~3100px total → mye scroll

**BoardDetailPanel (`components/variants/report/board/desktop/BoardDetailPanel.tsx`)**
- Width: 400px
- Inner container: `px-6 py-6` (24px hver vei)
- Header `pb-5` + tabs + content med ekstra `pb-6` på tab-innhold

### Mål

Rapport-boardet skal føles som et tett verktøy som viser mye informasjon effektivt — ikke et luftig magasin-layout. Brukeren har bedt om Discord-aktig kompaktethet. Vi går for ikon-only rail med tooltips og strammere accordion-padding/gap.

## Requirements Trace

- R1. Venstre rail blir ikon-only — kun illustrasjon, ingen tekst-label under. Rail-bredde reduseres fra 104px til ~64px. 6 kategorier får plass på mindre skjerm uten scroll.
- R2. Hover på rail-knapp viser tooltip med full kategori-label (og evt. count). Discord-mønster: chip ved siden av knappen, ikke over.
- R3. Punkter-accordion-cards får tettere padding og gap — `py-3 → py-2.5`, `gap-2.5 → gap-1.5`. Behold lesbarhet.
- R4. Detail-panel-padding strammes — `px-6 py-6 → px-5 py-5`, `pb-5 → pb-4` på header.
- R5. Endringer gjelder kun desktop-shell (`components/variants/report/board/desktop/*`). Mobil (BoardCategoryGrid + BoardPeekCard + BoardReadingModal) berøres ikke.
- R6. Total desktop-shell-bredde reduseres fra 504px (104+400) til ~464px (64+400). BoardScaffold-wrapper i `ReportBoardPage.tsx` må oppdatere `lg:left-[504px]` på kart-containeren tilsvarende.

## Scope Boundaries

- **Ikke i scope:** Mobil bottom-sheet-stramming. `BoardCategoryGrid` og `BoardPeekCard` har egne layout-bekymringer.
- **Ikke i scope:** Tema-illustrasjon-redesign. Vi krymper bare visningen, ikke selve assetene.
- **Ikke i scope:** Erstatte HoverCard eller bygge ut Popover. Vi legger til en tynn `Tooltip`-komponent som brukes spesifikt for rail-labels.
- **Ikke i scope:** Endringer i map-kart-overflater eller BoardDetailPanel `Beliggenhet`-tab-innhold. Kun layout-padding på containere.

### Deferred to Separate Tasks

- Mobil kompakt-UX: behandles i `docs/plans/2026-04-30-005-feat-rapport-board-mobile-ux-paritet-plan.md` (eksisterende, ikke berørt av denne planen).

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/board/desktop/BoardRail.tsx` — `RailButton`-komponent med illustrasjon + label. Endres til ikon-only.
- `components/variants/report/board/desktop/BoardDesktopShell.tsx:15` — `w-[504px]` shell. Endres til `w-[464px]` (eller variabel via const).
- `components/variants/report/board/ReportBoardPage.tsx:85` — `lg:left-[504px]` på kart-container. Må synkes med shell-bredden.
- `components/variants/report/board/desktop/BoardPOIAccordion.tsx:115` — `gap-2.5` på Accordion-rooten + `py-3 px-3.5` på AccordionTrigger.
- `components/variants/report/board/desktop/BoardDetailPanel.tsx:131` — `px-6 py-6` på CategoryDetail-rooten.
- `components/ui/hover-card.tsx` — eksisterende, men med `w-72 p-4` for tunge popover-innhold (rich content). Ikke egnet for kort tooltip.
- `radix-ui` meta-package (^1.4.3) i `package.json` — gir tilgang til `Tooltip` direkte: `import { Tooltip as TooltipPrimitive } from "radix-ui"`. Ingen ny dependency.

### Institutional Learnings

- Ingen direkte relevante lærings-dokumenter. Tett UI-arbeid følger generelle Tailwind-konvensjoner.

### External References

- Discord sin sidebar-pattern: ikon-only knapper i 72px bred rail, tooltip-chip ved siden av knappen ved hover. (Brukeren refset via skjermbilde — ikke ekstern dokumentasjon.)

## Key Technical Decisions

- **Ikon-only rail med tooltip** istedenfor "stramt-men-med-tekst": brukeren har eksplisitt referert til Discord-mønsteret, og illustrasjonen alene er en sterk affordance når den støttes av hover-label.
- **Lag ny `components/ui/tooltip.tsx`** som tynn wrapper rundt `radix-ui`s Tooltip-primitive: følger samme mønster som `accordion.tsx`, `hover-card.tsx`, `popover.tsx`. Ikke gjenbruk HoverCard — den er for tunge innhold (w-72 p-4) og krever klikk på touch.
- **Parameteriser rail-bredden i ett sted**: definer `RAIL_WIDTH_PX = 64` (eller bruk Tailwind-klasse direkte) og bruk samme verdi i `BoardRail`, `BoardDesktopShell`, og `ReportBoardPage`. Forhindrer drift når dette skal justeres senere.
- **Gap/padding-tall**: stramme verdier basert på Tailwind-skala, ikke piksler. `gap-1.5 → gap-1`, `py-3 → py-2.5`, `px-6 → px-5`. Holder rytme i designsystemet.
- **Tooltip-trigger via `asChild`**: Radix' standard mønster — eksisterende `<button>` blir tooltip-trigger uten ekstra DOM-wrapper.
- **Behold illustrasjon-størrelse 56×56 i ikon-only rail**: krymper rail-bredden til ~64px (56px asset + 4px padding hver vei). Tema-illustrasjonene er allerede designet i 1:1-format og leser fint i 56px.

## Open Questions

### Resolved During Planning

- **Skal Hjem-knappen også bli ikon-only?** Ja — paritet med kategori-knappene. Tooltip viser "Hjem" på hover.
- **Hvilken illustrasjon-størrelse?** Behold 56×56 — passer i ny rail-bredde og er konsistent med tema-illustrasjonene andre steder.
- **Skal tooltip vises på touch også?** Nei — touch-paritet er ikke i scope. Tooltips er kun en hover-affordance på desktop. Mobil-shellen mounterer ikke `BoardRail` (mobil bruker `BoardCategoryGrid`).
- **Hvor mye tetter Punkter-accordion?** `gap-2.5 → gap-1.5` (10→6px) og `py-3 → py-2.5` (12→10px). Mer aggressivt enn det krymper teksten for tett.

### Deferred to Implementation

- **Eksakt tooltip-styling**: Skal tooltipen ha shadow, border, eller bare fast bakgrunn? Implementer en variant som matcher app-rytmen (stone-900 bg, white text, sm padding) og juster basert på hvordan det leser visuelt.
- **Active-state på ikon-only knapp**: I dag bruker rail-knappen `backgroundColor` med `hexWithAlpha(category.color, 0.12)` på active. Ved kun-ikon må active-indikatoren leses tydelig — vurder ring eller venstre-side-bar (samme `inset 3px 0 0 ${color}` som accordion bruker for active POI). Avgjør i implementasjon basert på faktisk visning.

## Implementation Units

- [ ] **Unit 1: Lag `components/ui/tooltip.tsx`**

**Goal:** Tynn wrapper rundt `radix-ui`s Tooltip — Trigger + Content + Provider. Reusable for fremtidige tooltips utenfor rail.

**Requirements:** R2

**Dependencies:** Ingen.

**Files:**
- Create: `components/ui/tooltip.tsx`

**Approach:**
- Følg samme mønster som `components/ui/hover-card.tsx`: `Tooltip`, `TooltipTrigger`, `TooltipContent`, og `TooltipProvider`-eksporter
- TooltipContent-styling: stone-900 bg, white text, `text-xs font-medium`, `px-2 py-1` padding, `rounded-md`, `shadow-md`, `z-50`
- Default `sideOffset={8}` så tooltipen sitter litt unna trigger
- Default `side="right"` (passer rail-bruk; kan overrides per call site)
- Animasjon: data-state-baserte enter/exit som hover-card.tsx allerede gjør

**Patterns to follow:**
- `components/ui/hover-card.tsx` for komponentstruktur og Portal-bruk
- `components/ui/popover.tsx` for ekstra struktur-referanse

**Test scenarios:**
- Test expectation: none — ny shadcn-style UI-wrapper uten egen forretningslogikk. Visuell verifisering skjer i Unit 2.

**Verification:**
- Komponenten kan brukes som `<Tooltip><TooltipTrigger asChild><button>...</button></TooltipTrigger><TooltipContent>...</TooltipContent></Tooltip>` uten TS-feil.

- [ ] **Unit 2: Konverter `BoardRail` til ikon-only med tooltips**

**Goal:** Krym rail til 64px, fjern tekst-label fra `RailButton` og `Hjem`-knapp, legg til tooltip på hover.

**Requirements:** R1, R2

**Dependencies:** Unit 1.

**Files:**
- Modify: `components/variants/report/board/desktop/BoardRail.tsx`

**Approach:**
- Endre `<aside>`-bredde fra `w-[104px]` til `w-[64px]`. Padding `px-3` → `px-1` (4px). `py-5` → `py-3` (12px).
- Hjem-knapp: fjern label-span, behold ikon. Wrap i `<Tooltip>` med "Hjem" som content. Høyde `h-[72px]` → `h-12` (48px).
- `RailButton`: fjern `<span>` med `firstWord`. Wrap hele button-en i `<Tooltip>` med `category.label` som content. Høyde `h-[88px]` → `h-14` (56px) — passer den 56px illustrasjonen alene + 0 padding rundt.
- Active-indikator: behold backgroundColor-tinten, men også legg til en venstre-bar via `boxShadow: 'inset 3px 0 0 ${color}'` (som accordion bruker) for sterkere "valgt"-signal i den lille knappen.
- TooltipProvider må wrappe hele `<aside>` — Radix krever én Provider per tooltip-tre.

**Patterns to follow:**
- `components/variants/report/board/desktop/BoardPOIAccordion.tsx:135-138` for inset boxShadow active-indikator-mønster
- `components/ui/hover-card.tsx` for Tooltip-bruk

**Test scenarios:**
- Happy path: Hover på Hjem-knapp viser tooltip "Hjem" til høyre. Hover på Mat-knapp viser "Mat & Drikke".
- Happy path: Klikk på kategori-knapp dispatcher `SELECT_CATEGORY` som før. Klikk på Hjem dispatcher `RESET_TO_DEFAULT`.
- Happy path: Active-state har både bakgrunns-tint og venstre-bar i kategori-fargen.
- Edge case: Når brukeren klikker på en knapp, skjul tooltipen umiddelbart (Radix gjør dette via blur/leave). Verifiser at tooltipen ikke henger igjen etter active-bytte.
- Regression: Selector og dispatch-flyt uendret — `useBoard` brukes som før, ingen endring i state-håndtering.

**Verification:**
- Rail er 64px bred, kun illustrasjoner synlige. Hover viser tooltip-chip til høyre. Klikk fungerer som før. Active-state leses tydelig.

- [ ] **Unit 3: Stram padding/gap i `BoardDetailPanel` og `BoardPOIAccordion`**

**Goal:** Tettere visuell rytme i Punkter-lista og kategori-detalj-containere.

**Requirements:** R3, R4

**Dependencies:** Ingen (kan landes parallelt med Unit 2, men separat commit).

**Files:**
- Modify: `components/variants/report/board/desktop/BoardDetailPanel.tsx`
- Modify: `components/variants/report/board/desktop/BoardPOIAccordion.tsx`

**Approach:**
- `BoardDetailPanel.tsx`:
  - `CategoryDetail`-root: `px-6 py-6` → `px-5 py-5`
  - `header`: `pb-5` → `pb-4`
  - `<h2>`: `text-2xl` beholdes, men vurder `pb-1` på header hvis tabs-avstand kjennes for tett
  - Tabs-innhold (`tab === "info"` og `tab === "punkter"`): `pb-6` → `pb-5` på wrapper
- `BoardPOIAccordion.tsx`:
  - Accordion root: `gap-2.5` → `gap-1.5` (10→6px)
  - AccordionTrigger className: `py-3 px-3.5` → `py-2.5 px-3.5` (vertical bare; horisontal beholdes)
  - Inner content gap: `gap-3` → `gap-2.5` mellom ikon og tekst-stack
  - AccordionContent className: `pb-3.5 pt-0` beholdes — innholdet inni skal ikke krympes ytterligere

**Test scenarios:**
- Test expectation: visuelle endringer uten ny logikk. Manuell sjekk i nettleser dekker.
- Happy path: Punkter-lista viser flere kort i samme viewport-høyde. Adresse-tekst ikke avkuttet.
- Edge case: Veldig kort kategori (1-2 POI-er) — accordion-en ser ikke "tom" eller for stramt presset ut.
- Regression: Active-poi-indikator (venstre-bar via `boxShadow`) leses fortsatt tydelig på den lavere card-høyden.

**Verification:**
- Punkter-listen passer flere kort i viewporten. Ingen tekst-overflow eller layout-brudd.

- [ ] **Unit 4: Sync shell-bredden i `BoardDesktopShell` og `ReportBoardPage`**

**Goal:** Reflekter den nye rail-bredden i shell-wrapperen og kart-offset.

**Requirements:** R6

**Dependencies:** Unit 2 (rail-bredde må være endret først).

**Files:**
- Modify: `components/variants/report/board/desktop/BoardDesktopShell.tsx`
- Modify: `components/variants/report/board/ReportBoardPage.tsx`

**Approach:**
- `BoardDesktopShell.tsx`: `w-[504px]` → `w-[464px]`. (64 rail + 400 panel = 464.)
- `ReportBoardPage.tsx`: `lg:left-[504px]` → `lg:left-[464px]`. Holder kart-containeren synket med shell-bredden.
- Vurder å ekstrahere bredden til en delt const (f.eks. i `board-data.ts` eller en ny `board-layout.ts`-fil) hvis det føles riktig — men hold scope tett: rene number-bytter holder for nå, og du kan refactore senere hvis bredden endres ofte.

**Test scenarios:**
- Test expectation: ren CSS-justering uten ny logikk.
- Happy path: Desktop-shell + kart aligner uten gap eller overlap.
- Edge case: Smal desktop-bredde (lg-breakpoint = 1024px). Kartet får 1024-464 = 560px — fortsatt brukbart for orbit/POI-interaksjon.
- Regression: Mobile (<lg) uberørt — shell og rail er allerede `hidden lg:flex`/`hidden lg:block`.

**Verification:**
- Ingen visuell glipp mellom shell og kart. Kart-toggle (2D/3D, `top-3 right-3`) sitter fortsatt synlig inne i kart-arealet.

## System-Wide Impact

- **Interaction graph:** `BoardRail`, `BoardDesktopShell`, `ReportBoardPage`, `BoardDetailPanel`, `BoardPOIAccordion` — alle desktop-only. Mobile shell uberørt.
- **Error propagation:** Ingen — rene UI-endringer uten ny error-håndtering.
- **State lifecycle risks:** Tooltip-Provider lever inne i rail. Når rail unmounteres (ikke realistisk i denne app, men prinsipielt), ryddes Radix-listenere automatisk.
- **API surface parity:** Ingen nye props på eksisterende komponenter. `Tooltip`-komponenten er ny eksport men brukes lokalt.
- **Integration coverage:** Ingen new cross-layer flow.
- **Unchanged invariants:** State-flow (`useBoard`, dispatchers), kart-rendering, POI-detalj-innhold (`BoardPOIDetails`), `BoardCategoryInfoTab` — alt uendret.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Tooltip-bibliotek ikke pre-installert i `radix-ui` meta-package | `radix-ui ^1.4.3` inkluderer Tooltip (verifiser via `radix-ui/dist/tooltip` ved import). Hvis ikke, installer `@radix-ui/react-tooltip` separat. |
| Ikon-only rail mister opplevd-affordance for nye brukere | Tooltips på hover (Discord-mønster) gir labelen tilbake umiddelbart. Aksepterer at touch-brukere på desktop (sjelden) mister labelen — de bruker uansett mobile shellen. |
| Stram accordion-padding gjør lange kategori-navn (47+ POI-er) for tett å lese | `truncate` er allerede satt på navn og adresse fra forrige runde. Gap reduseres til 6px, men card-height forblir lesbar (ikke nedunder 48px). |
| Bredde-endring fra 504px → 464px påvirker andre kart-overflater | Endringen er gated på `lg:`-breakpoint og påvirker kun `ReportBoardPage`-rendering. Andre rapport-vis (Explorer, Visning) bruker ikke `BoardDesktopShell`. |

## Documentation / Operational Notes

- Visuell QA på desktop (Chrome, Firefox, Safari) etter implementasjon. Mobile QA ikke nødvendig (shell er `hidden lg:flex`).
- Hvis tooltip-stylingen ikke matcher app-rytmen, juster TooltipContent-className i `components/ui/tooltip.tsx` — single source of truth.
- Brukeren kan reverseres separat per unit: Unit 2 (rail) og Unit 3 (accordion-padding) er uavhengige og kan rolle tilbake hver for seg.

## Sources & References

- Origin: brukerens skjermbilde-sammenligning (rapport-board vs Discord) + ekspisitt direktiv om kompakt-UI
- Related code: `components/variants/report/board/desktop/*`, `components/ui/hover-card.tsx`, `components/ui/popover.tsx`
- Mobile-paritet (separat plan): `docs/plans/2026-04-30-005-feat-rapport-board-mobile-ux-paritet-plan.md`
