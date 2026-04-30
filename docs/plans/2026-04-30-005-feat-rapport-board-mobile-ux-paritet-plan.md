---
title: Rapport-board mobile UX-paritet og native polish
type: feat
status: active
date: 2026-04-30
---

# Rapport-board mobile UX-paritet og native polish

## Overview

Hev mobile-UX på rapport-board-flyten til å matche desktop-paritet på POI-data og legg til mobile-native polish. Etter at desktop fikk ny `BoardPOIDetails` (rating, åpningstider, businessStatus, knapper, child POIs) i Trello [xniF3kwm](https://trello.com/c/xniF3kwm), står mobil igjen som en "enklere variant" med fire reelle UX-gap: POI-listen er to klikk unna, list-kortene er flate, `BoardPOISheet` snap-point gjemmer rich content, og sub-kategori-filter er gjemt bak en popover-trigger.

Mål: bruke samme desktop-mønstre der det gir mening (accordion-inline-expand, synlige sub-kat-chips), beholde bottom-sheet-arkitekturen som mobil-native, og polere overgangene så det føles som en app.

## Problem Frame

Desktop-rapport-board har en sammenhengende strip (rail + detalj-panel + accordion) som lar brukeren skanne kategori-kontekst, POI-liste og rik POI-data uten å miste posisjonen sin. Mobile bryter samme funksjonalitet i fire separate ark:

```
default        active            reading           poi
─────────      ──────────        ──────────────    ──────────────
CategoryGrid   PeekCard          ReadingModal      POISheet
(grid)         (lead+Les mer)    (Info|Punkter)    (rich POI data)
```

Hvert ark erstatter det forrige. Når man klikker en POI i Punkter-listen, lukkes ReadingModal og POISheet åpnes — list-konteksten er borte. Og POISheet-en defaulter til 50%-snap, så cover-bilde, rating, åpningstider, knapper og live transport faller alle under fold på de fleste mobile viewports.

I tillegg: peek-card-en har bare "Les mer"-knapp, så det er ingen direkte vei til Punkter-listen — brukeren må gjøre to ekstra klikk (Les mer → Punkter-tab) for å se POI-er som lister. SubCategoryFilter (kjernefunksjon på desktop, der den er chip-rad) er på mobil pakket inn i en popover bak en trigger-knapp, så filteret er mindre oppdagbart enn det fortjener.

Vi er i prototype-fase (memory: project_stage_prototype) så vi kan endre flyten relativt fritt — ingen live klienter pages.

## Requirements Trace

- **R1.** POI-list-kort i Punkter-tab utvides inline med `BoardPOIDetails` (samme paritet som desktop accordion) i stedet for å åpne separat `BoardPOISheet` og lukke `BoardReadingModal`.
- **R2.** `BoardPOISheet` viser pinned action-bar (Vis rute · Utforsk · Ring · Nettside) alltid synlig nederst, med scrollbart innhold over. Default snap heves slik at rich content er over fold.
- **R3.** `BoardPeekCard` har segmented control (Beliggenhet · Punkter (N)) som åpner `BoardReadingModal` direkte på riktig tab — ikke bare en generisk "Les mer".
- **R4.** `SubCategoryFilter` på mobil rendrer som horizontal-scroll chip-rad, ikke gjemt bak popover. Match desktop-mønsteret.
- **R5.** `BoardCategoryGrid`-kort viser kategoriens lucide-ikon prominent som visuell hint for kategoritypen.
- **R6.** POI-bytte i `BoardPOISheet` (når aktiv POI endres mens sheet er åpen) crossfade-er mellom POI-er i stedet for å bytte innholdet brått.

## Scope Boundaries

**Inn i scope:**
- Endringer i `components/variants/report/board/mobile/` og delte komponenter den importer
- Eventuelle små refactor-er av `BoardPOIDetails.tsx` for å støtte split mellom body og action-bar
- State-machine-utvidelse hvis nødvendig for inline POI-expand uten phase-bytte

**Ute av scope (eksplisitte non-goals):**
- Endringer i desktop-flyten (BoardDesktopShell, BoardDetailPanel, BoardPOIAccordion) utover delte komponenter
- Endringer i map-rendering, marker-style, eller path-layer — UX-laget er det som endres
- 3D-kart-tilstand (egen plan: 2026-04-30-003 og 2026-04-30-004)
- URL-state for delelinker
- Endringer i ReportData-shape eller `transformToReportData`

### Deferred to Separate Tasks

- **Swipe-mellom-POIer-gesture** (full carousel) — Unit 6 leverer cross-fade ved POI-bytte, men ekte horisontal swipe-gesture med vaul mellom POI-kort kan vurderes som egen polish-iterasjon hvis cross-fade ikke føles native nok.
- **PWA / installable shell** — utenfor denne planen.

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/board/BoardPOIDetails.tsx` — den delte detalj-komponenten som allerede er i bruk på desktop (`BoardPOIAccordion`) og mobil (`BoardPOISheet`). Hovedinngang for rich POI-data.
- `components/variants/report/board/desktop/BoardPOIAccordion.tsx` — desktop-mønster for inline-expand med shadcn Accordion (`type="multiple"`, multi-open). Mobil bør gjenbruke samme pattern.
- `components/variants/report/board/mobile/BoardReadingModal.tsx` — full-height bottom-sheet med Tabs (Beliggenhet | Punkter), kalle-stedet for BoardRelatedPOICard.
- `components/variants/report/board/mobile/BoardRelatedPOICard.tsx` — flat POI-kort som per i dag bare har navn + adresse + onClick-trigger. Skal utvides til accordion-pattern eller erstattes.
- `components/variants/report/board/mobile/BoardPOISheet.tsx` — separat POI-sheet med snap-points `[0.5, 0.9]`, default `0.5`. Brukes når POI klikkes fra MAP.
- `components/variants/report/board/mobile/BoardPeekCard.tsx` — viser kategori-lead + "Les mer"-knapp som åpner ReadingModal.
- `components/variants/report/board/mobile/BoardCategoryGrid.tsx` — horisontal-scroll grid av kategori-kort på Hjem.
- `components/variants/report/board/SubCategoryFilter.tsx` — delt filter, har `variant: "desktop" | "mobile"`-prop. Mobile bruker samme Popover som desktop i dag — det er mismatchen.
- `components/variants/report/board/board-state.tsx` — state machine: `default | active | reading | poi` med dispatch-actions `OPEN_POI`, `OPEN_READING`, `BACK_TO_ACTIVE` osv.
- `components/ui/accordion.tsx` — shadcn Accordion-primitiv (Radix), brukt i BoardPOIAccordion på desktop.
- `components/ui/drawer.tsx` — vaul-baserte Drawer-komponenter (DrawerPortal, DrawerOverlay, DrawerContent) — bruker for både ReadingModal og POISheet.

### Institutional Learnings

- **Mobile-native UX-prinsipp** (memory_feedback_mobile_native_ux): adaptive komponenter når mønstre divergerer — bottom-sheets på mobil, sidekolonner på desktop, ikke tvunget felles. Denne planen følger dette: vi gjenbruker shared `BoardPOIDetails` men holder mobile-spesifikk styling (pinned action-bar) atskilt fra desktop-accordion.
- **Disclosure-animasjoner uten auto-scroll** (memory_disclosure_animations): max-height-animasjon alene er signal nok ved expand; scroll kun ved kollaps. Gjelder for accordion-pattern på mobil.
- **Prototype-stadium tolererer drift** (memory_project_stage_prototype): vi kan endre mobile-flyten relativt fritt — ingen live klient-bekymringer.
- **Worktree-gotcha**: dev-server skal kjøre på worktree-port (≥3001), ikke hovedrepo (3000). Memory: feedback_worktree_dev_server.

### External References

- [vaul — multi-snap drawer](https://github.com/emilkowalski/vaul) (allerede i bruk) — for snap-points, drag-handle. Pinned action-bar oppnås via vanlig flexbox inni DrawerContent (sticky bottom).
- [Radix Accordion](https://www.radix-ui.com/primitives/docs/components/accordion) (via shadcn) — brukes allerede på desktop.

## Key Technical Decisions

- **Beholde state-maskinen, men introdusere "list-context POI"** — i stedet for å endre fasen til `poi` når en POI klikkes fra Punkter-listen, beholder vi `phase: "reading"` og bruker en lokal accordion-state inne i ReadingModal. `activePOIId` settes uten phase-bytte. `BoardPOISheet` brukes da bare for POIer klikket direkte fra MAP. Rationale: minimerer state-machine-kompleksitet, gjenbruker desktop-pattern, beholder list-konteksten.
- **Ny dispatch-action `HIGHLIGHT_POI`** — setter `activePOIId` uten å endre `phase`. Map-markøren får highlight selv om brukeren bare har utvidet et accordion-kort i listen. Forskjellig fra `OPEN_POI` som åpner full POI-sheet. Hvis state-utvidelse er for mye scope, fall tilbake til kun lokal accordion-state og la map-marker-highlight skje via egen prop.
- **`BoardPOIDetails`-split: action-bar som egen sub-komponent** — eksporter både hele `BoardPOIDetails` (uendret bruk på desktop accordion + i mobile accordion) og en `BoardPOIActionBar`-eksport som mobile sheet kan pinne nederst. Body-delen rendres scrollbart over.
- **`BoardPOISheet` default snap = `0.85`** — ikke `0.5`. Med pinned action-bar og rich content er det å treffe snap halvveis å gjemme det meste av verdien. Vi beholder `0.5` som tilgjengelig snap-point hvis brukeren drar ned.
- **`BoardPeekCard` får segmented control istedenfor "Les mer"-knapp** — to handlinger: "Les mer" (åpne ReadingModal på Beliggenhet-tab) og "Se punkter (N)" (åpne på Punkter-tab). `OPEN_READING`-action utvides med valgfri `tab`-parameter.
- **`SubCategoryFilter` mobile-variant rendres som chip-rad** — bruker fortsatt samme komponentfil med `variant`-prop, men `mobile`-variant produserer en horisontal-scroll chip-rad i stedet for popover-trigger. Desktop-variant uendret.
- **`BoardCategoryGrid`-kort: lucide-ikon over tittel** — kategoriens `icon` (lucide-navn) rendres som prominent visual hint. Beholder eksisterende illustrasjons-bilde (ikke fjern det), men legger til ikon i øvre venstre hjørne av kortet.
- **POI-cross-fade i BoardPOISheet** — bruk `motion.div` (framer-motion er allerede i prosjektet hvis det finnes; ellers CSS transition på opacity ved POI-id-endring). Rationale: enkel native-feel uten å bygge full carousel.

## Open Questions

### Resolved During Planning

- **Skal POI klikket fra map fortsatt åpne BoardPOISheet?** — Ja. Rationale: når brukeren ser en POI på kartet (geografisk fokus), gir focus-mode mer mening enn å scrolle ReadingModal til riktig kort. Map → POISheet, List → inline accordion.
- **Skal vi flytte SubCategoryFilter ut av Popover på desktop også?** — Nei. Desktop har plass i sidekolonnen og chip-rad er allerede der i `SubCategoryFilter`-renderingen for desktop. Det er kun mobile-varianten som bruker popover i dag.
- **Skal segmented control i BoardPeekCard erstatte eller supplere Les mer-knappen?** — Erstatter. Segmented control viser begge tab-ene direkte, ingen ekstra knapp trengs.

### Deferred to Implementation

- **Eksakt navnekonvensjon for `BoardPOIActionBar`-eksporten** — kan være intern type-definisjon eller eksplisitt subkomponent. Avgjøres når split skjer.
- **Map-marker-highlight når POI-accordion utvides i ReadingModal** — om vi trenger ny `HIGHLIGHT_POI`-action eller bare lokal state med separat callback til map-laget. Avgjøres når Unit 1 implementeres og den faktiske oppførselen kan testes.
- **Animasjonskurve for cross-fade** — duration og easing finnes ut når implementasjonen kjøres. Memory: ingen auto-scroll ved expand.

## High-Level Technical Design

> *Disse skissene illustrerer flyt og struktur, ikke implementasjons-spec. Implementer-agenten bør tilpasse navn og detaljer.*

### Mobile-flyt før vs etter

```
FØR:
default → CategoryGrid
        → SELECT_CATEGORY → PeekCard (lead + Les mer)
        → OPEN_READING → ReadingModal (Info | Punkter)
                       → klikk POI → OPEN_POI → POISheet (lukker ReadingModal)

ETTER:
default → CategoryGrid (med kategori-ikon-hint)
        → SELECT_CATEGORY → PeekCard (lead + segmented [Beliggenhet | Punkter (N)])
        → OPEN_READING(tab) → ReadingModal
                            → Info-tab: tekst + grounding (uendret)
                            → Punkter-tab: SubCategoryFilter chip-rad + POI-accordion (inline expand med BoardPOIDetails)
        → klikk POI på MAP → OPEN_POI → POISheet (default snap 0.85, pinned action-bar)
```

### POISheet-layout (etter)

```
┌─────────────────────────────────┐
│  ─── (drag-handle)              │
│                              [X]│
│  ┌─────────────────────────────┐│
│  │ [Icon] Navn                 ││
│  │        KATEGORI             ││
│  │ Adresse                     ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ Cover-bilde                 ││  scrollbart
│  │ Meta-rad: rating·pris·tid   ││  innhold
│  │ Body                        ││
│  │ Live transport              ││
│  │ Åpningstider                ││
│  │ Andre i kategorien          ││
│  └─────────────────────────────┘│
│  ─────────────────────────────  │
│  [Vis rute] [Utforsk] [Ring]    │  pinned bottom
│  [Nettside]                     │
└─────────────────────────────────┘
```

## Implementation Units

### Phase 1 — POI-data-paritet (kjerne)

- [x] **Unit 1: Inline POI-accordion i Punkter-tab**

**Goal:** Bytt ut flat `BoardRelatedPOICard` i `BoardReadingModal`s Punkter-tab med en accordion som utvider hvert kort inline til full `BoardPOIDetails`. Brukeren beholder list-konteksten — ingen sheet-bytte.

**Requirements:** R1

**Dependencies:** Ingen (BoardPOIDetails finnes allerede)

**Files:**
- Modify: `components/variants/report/board/mobile/BoardReadingModal.tsx`
- Modify or replace: `components/variants/report/board/mobile/BoardRelatedPOICard.tsx` (omdannes til accordion-trigger eller erstattes med ny komponent)
- Reuse: `components/ui/accordion.tsx`, `components/variants/report/board/BoardPOIDetails.tsx`
- Modify (mulig): `components/variants/report/board/board-state.tsx` (ny `HIGHLIGHT_POI`-action hvis vi vil at map-marker skal highlightes)
- Test: `components/variants/report/board/mobile/BoardReadingModal.test.tsx` (ny eller eksisterende — sjekk om finnes)

**Approach:**
- Bruk shadcn `Accordion type="multiple"` (samme som `BoardPOIAccordion`) inne i Punkter-tab — bruker kan ha flere kort åpne samtidig.
- Trigger-delen viser eksisterende kompakte info (icon-circle + navn + adresse). Innhold-delen rendrer `<BoardPOIDetails poi={poi.raw} />`.
- POI klikket fra Punkter-listen skal IKKE bytte phase fra `reading` til `poi`. Det betyr at vi ikke kan bruke `dispatch({ type: "OPEN_POI" })` her.
- For map-marker-highlight: vurder om vi trenger `HIGHLIGHT_POI`-action eller bare bruker en lokal callback som setter `activePOIId` direkte. Velg den enkleste varianten som ikke bryter eksisterende state-machine-tester.

**Patterns to follow:**
- `components/variants/report/board/desktop/BoardPOIAccordion.tsx` — samme accordion-mønster, samme styling-tokens (rounded-2xl, border-stone-200/80, shadow). Bruk dette som referanse-implementasjon.
- `components/variants/report/board/mobile/BoardRelatedPOICard.tsx` — eksisterende trigger-styling kan beholdes.

**Test scenarios:**
- Happy path: Åpne ReadingModal på Punkter-tab → klikk POI-kort → kortet utvides inline med BoardPOIDetails-innhold (rating, åpningstider, knapper synlige hvis POI har data). Klikk samme kort igjen → kollapser.
- Happy path: Klikk to forskjellige POI-kort → begge er åpne samtidig (multi-open).
- Edge case: POI uten editorialHook/localInsight/description → kortet utvides uten body-tekst, men action-knapper (Vis rute, Utforsk) er fortsatt synlige.
- Integration: Klikk POI fra accordion → map-marker for samme POI får highlight (hvis vi implementerer HIGHLIGHT_POI-action) ELLER ingen visuell endring (hvis vi velger uten action). Verifiser at klikk fra map-marker fortsatt åpner BoardPOISheet (ikke regresjon).
- Eksisterende `board-state.test.ts` (12 tester) skal fortsatt passere uten endringer — hvis de feiler, betyr det at state-machine-endring brøt eksisterende kontrakt.

**Verification:**
- I dev-browser på mobil-bredde (390x844): velg en kategori → klikk Les mer → bytt til Punkter-tab → klikk en restaurant → kortet utvides inline med rating, åpningstider, knapper. ReadingModal er fortsatt åpen.
- Desktop-flyt (1440-bredde) er upåvirket — `BoardPOIAccordion` rendres fortsatt korrekt.

---

- [x] **Unit 2: BoardPOISheet pinned action-bar + heveet default snap**

**Goal:** Når BoardPOISheet åpnes (via map-klikk), vis action-knappene som pinned bottom-bar, heve default snap til 0.85 så cover-bilde, rating og åpningstider er over fold uten scroll.

**Requirements:** R2

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/board/BoardPOIDetails.tsx` (split action-bar til egen sub-eksport)
- Modify: `components/variants/report/board/mobile/BoardPOISheet.tsx`
- Reuse: `components/ui/drawer.tsx`

**Approach:**
- Split `BoardPOIDetails`: ekstrahér action-knapp-raden (linje ~284-340 i BoardPOIDetails.tsx) til en eksportert sub-komponent `BoardPOIActionBar` som tar `poi: POI` + `areaSlug?: string | null`.
- Hovedkomponenten `BoardPOIDetails` har ny prop `hideActionBar?: boolean` (default `false`) for å unngå dobbel-render. Eller en `BoardPOIDetailsBody` som er hele komponenten utenom action-bar. Velg den variant som er minst invasiv — accordion på desktop og mobil skal fortsatt få begge deler.
- I `BoardPOISheet`: rendrer body-delen i scrollbart område (eksisterende `flex-1 overflow-y-auto`), og ny pinned action-bar på bunn (utenfor scroll-området, men inni DrawerContent). Bruker tailwind `sticky bottom-0` ELLER bare struktureres som `flex flex-col` med action-bar som siste, ikke-flexible barn.
- Endre `DEFAULT_SNAP` fra `0.5` til `0.85`. Behold `SNAP_POINTS` som er — `[0.5, 0.9]` (eller utvid til `[0.5, 0.85, 0.95]` hvis fin-graining ønskes).

**Patterns to follow:**
- `components/variants/report/board/mobile/BoardPOISheet.tsx` — eksisterende snap-pattern via `activeSnapPoint`/`setActiveSnapPoint`.
- Eksisterende styling i BoardPOIDetails — chip-knapper med `rounded-full`, varierende bg-50-farger.

**Test scenarios:**
- Happy path: Klikk POI-marker på map → BoardPOISheet åpner med default snap 0.85, cover-bilde + rating-rad synlig over fold, action-bar synlig nederst med Vis rute + Utforsk + (hvis data) Ring + Nettside.
- Happy path: Dra sheet ned til 0.5 → action-bar er fortsatt synlig nederst, body kollapser. Dra opp til 0.95 → mer body synlig, action-bar fortsatt nederst.
- Edge case: POI uten Google-data (kun navn + adresse) → action-bar viser kun universale knapper (Vis rute + Utforsk). Sheet-en føles ikke tom — body har plass-fyll med adresse + body-tekst.
- Edge case: POI med fullstendig data (cover, rating, opening hours, alle knapper) → ingen overlap mellom scrollbart innhold og pinned action-bar. Sjekk at scroll-padding-bottom er stor nok.
- Integration: Action-bar-knapper (Vis rute, Utforsk, Ring, Nettside) fungerer fra pinned posisjon — `target="_blank"`, `rel="noopener noreferrer"` bevares.

**Verification:**
- Mobil-bredde (390x844): klikk en restaurant-marker direkte på map → POISheet åpner høyt nok at rating + cover-bilde er synlig uten scroll. Action-bar synlig på bunn med relevante knapper.
- Klikk en transport-stop (bare adresse + live transport) → samme oppførsel, action-bar viser kun Vis rute + Utforsk.

---

### Phase 2 — Reduser navigasjons-friksjon

- [x] **Unit 3: Direct Punkter-tilgang fra BoardPeekCard**

**Goal:** Bytt ut "Les mer"-knappen i `BoardPeekCard` med segmented control eller to-knapp-rad som åpner `BoardReadingModal` direkte på riktig tab.

**Requirements:** R3

**Dependencies:** Unit 1 (Punkter-tab har nytt accordion-innhold som er verdt å hoppe direkte til)

**Files:**
- Modify: `components/variants/report/board/mobile/BoardPeekCard.tsx`
- Modify: `components/variants/report/board/board-state.tsx` (utvid `OPEN_READING`-action med valgfri `tab: "info" | "punkter"`-parameter)
- Modify: `components/variants/report/board/mobile/BoardReadingModal.tsx` (les `state.readingTab` ved åpning og sett initial tab-state)
- Test: `components/variants/report/board/board-state.test.ts` (legg til test for ny tab-parameter)

**Approach:**
- `OPEN_READING`-action utvides: `{ type: "OPEN_READING"; tab?: "info" | "punkter" }`. Reducer setter ny `state.readingTab`-felt (eller passer inn som transient prop hvis state-utvidelse er for stort scope).
- `BoardReadingModal` leser `state.readingTab` ved `open`-trigger og setter sin lokale `tab`-state til den verdien (default: "info").
- `BoardPeekCard` rendres som peek + to handlingsknapper. Forslag: én "Beliggenhet"-knapp og én "Punkter (N)"-knapp. POI-count fra `cat.pois.length`. Eller én segmented control hvis det føles mer kompakt.
- Bevar `BoardSwitcherChip` på toppen og kategori-tittel + lead.

**Patterns to follow:**
- Eksisterende knapp-styling i `BoardPeekCard.tsx` (`bg-[#1a2952] text-white px-[18px] py-2.5 rounded-full`) — kan brukes for primær-knapp ("Punkter (N)") og sekundær-knapp ("Beliggenhet") får lysere variant.
- Tab-bytte-mønster i `BoardReadingModal.tsx` (`useState("info")`).

**Test scenarios:**
- Happy path: Velg kategori → PeekCard viser Beliggenhet- og Punkter-knapper. Klikk Punkter (10) → ReadingModal åpner direkte på Punkter-tab, accordion-listen er synlig.
- Happy path: Klikk Beliggenhet → ReadingModal åpner direkte på Beliggenhet-tab, Info-content er synlig.
- Edge case: Kategori med 0 POIer → Punkter-knapp er disabled eller skjult (eller viser "Punkter (0)" og åpner tom-state). Velg konsistent oppførsel.
- Integration: Lukk ReadingModal → tilbake til PeekCard → klikk en annen knapp → modal åpner med riktig tab. Tab-state skal ikke "huske" forrige valg på tvers av kategorier.
- State-machine-test: `OPEN_READING` med `tab: "punkter"` setter både `phase: "reading"` og `readingTab: "punkter"`. Eksisterende tester for `OPEN_READING` uten tab fortsatt passerer (default-fallback).

**Verification:**
- Mobil-bredde: velg Mat → PeekCard viser to knapper. Klikk Punkter (10) → modal åpner direkte på POI-list. Klikk en POI → utvides inline.
- Velg Hjem (RESET_TO_DEFAULT) → tilbake til kategori-grid. Velg Barn → PeekCard viser to knapper. Klikk Beliggenhet → modal åpner på info-tab.

---

- [x] **Unit 4: SubCategoryFilter chip-rad på mobil**

**Goal:** Erstatt mobile-popover-varianten av `SubCategoryFilter` med en horizontal-scroll chip-rad (matcher desktop-mønster) som er alltid synlig over POI-listen.

**Requirements:** R4

**Dependencies:** Unit 1 (filter-rad er over accordion-listen, må fungere godt sammen)

**Files:**
- Modify: `components/variants/report/board/SubCategoryFilter.tsx` (mobile-variant ny rendering)
- Test: `components/variants/report/board/SubCategoryFilter.test.tsx` (mobile-variant tester)

**Approach:**
- I `SubCategoryFilter.tsx`, sjekk på `variant === "mobile"`. I dag rendrer den Popover-trigger; nå skal den i mobile-mode rendre direkte: `<div className="flex gap-2 overflow-x-auto ...">` med chips per sub-kategori.
- Hver chip viser: liten farget sirkel (sub-kat-farge) + sub-kat-navn + count. Klikk toggle synlighet. "Vis alle"-chip eller annen reset-mekanisme på enden.
- Skjul filter-raden helt når `subCategories.length < 2` (eksisterende logikk, behold).
- Desktop-variant uendret.

**Patterns to follow:**
- Desktop-rendering i samme fil — der eksisterer allerede chip-style (sjekk `SubCategoryFilter.tsx`-rendering for desktop). Bruk samme chip-DOM, bare forskjellig wrapper.
- `BoardCategoryGrid.tsx` for horizontal-scroll-pattern (`overflow-x-auto snap-x snap-mandatory [-webkit-overflow-scrolling:touch] [scrollbar-width:none]`).

**Test scenarios:**
- Happy path: Mat-kategori har 4 sub-kat (restaurant, cafe, bar, bakery) — chip-rad viser 4 chips. Klikk "bar" → kun bar skjules, andre POI-er bevart i listen.
- Edge case: Kategori med 1 sub-kategori → filter-raden skjules helt. Eksisterende oppførsel.
- Edge case: Alle chips toggled av → tom-state melding "Ingen punkter matcher". "Vis alle"-knapp resetter (eksisterende oppførsel).
- Edge case: Lang sub-kat-liste (5+) → horizontal-scroll fungerer, chips snap-er.
- Existing SubCategoryFilter.test.tsx (11 tester) fortsatt passerer — kun mobile-variant-testene endres/tilføyes.

**Verification:**
- Mobile-bredde: åpne ReadingModal på Punkter-tab for Mat → chip-rad er synlig over POI-listen. Klikk en chip → POI-listen filtreres umiddelbart.
- Desktop (1440): SubCategoryFilter uendret. Eksisterende desktop-rendering test bekrefter dette.

---

### Phase 3 — Native polish

- [x] **Unit 5: Kategori-ikon-hint i BoardCategoryGrid**

**Goal:** Vis kategoriens lucide-ikon prominent på hvert grid-kort som visuell hint av kategoritypen, supplerer (ikke erstatter) eksisterende illustrasjons-bilde.

**Requirements:** R5

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/board/mobile/BoardCategoryGrid.tsx`
- Reuse: `lib/utils/map-icons-filled.ts` (hvis ikon-utility bruker filled-varianter) eller `lib/utils/map-icons.ts`

**Approach:**
- Hvert kort i `CategoryCard` får en liten ikon-circle øverst (hjørne eller sentrert over tittel). Bruker `category.icon` (lucide-navn) og `category.color` for fyllfarge — samme mønster som markører.
- Plassering: forslag øvre venstre hjørne av kortet, ev. sentrert under illustrasjons-bildet. Velg basert på visuell test — ikke skygge for illustrasjonen.
- Beholde eksisterende kort-layout (illustrasjon + spørsmål + count-badge).

**Patterns to follow:**
- `BoardMarker.tsx` for ikon-circle-styling (`w-8 h-8 rounded-full border-2`, color via inline-style).
- `markerCircleStyle` fra `lib/utils/marker-color.ts` for konsistent border + tint.
- `getFilledIcon` fra `lib/utils/map-icons-filled.ts` for å resolve lucide-ikon-navn.

**Test scenarios:**
- Test expectation: minimal — ren visuell endring, ingen behavioral change. Verifiser via dev-browser screenshot at ikonet rendrer på alle 6 kategorier (Hverdagsliv, Barn, Mat, Natur, Transport, Trening) med riktig farge.
- Edge case: Kategori uten `icon` (fallback til generisk MapPin) → rendrer fortsatt uten å krasje. Bruker `getFilledIcon` med fallback-handling.

**Verification:**
- Mobile-bredde, Hjem-fasen: alle 6 kort viser kategori-ikon (kniv/gaffel for Mat, busss for Transport, osv.) i kategori-fargen.

---

- [x] **Unit 6: Cross-fade ved POI-bytte i BoardPOISheet**

**Goal:** Når aktiv POI endres mens BoardPOISheet er åpen (f.eks. brukeren klikker en annen marker på map), cross-fade mellom POI-er istedenfor å bytte innholdet brått.

**Requirements:** R6

**Dependencies:** Unit 2 (sheet-en må allerede ha riktig struktur før vi animerer overgangen)

**Files:**
- Modify: `components/variants/report/board/mobile/BoardPOISheet.tsx`

**Approach:**
- Bruk CSS-transition på opacity ved POI-id-bytte. Lokal state for "currently rendered POI" som lagger ett tick bak `useActivePOI()`. Cross-fade ved hjelp av to absoluttposisjonerte content-lag (gammel POI fade-out, ny fade-in).
- Alternativ: bruk `framer-motion` hvis allerede i prosjektet — `<motion.div key={poi.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>` med `AnimatePresence`. Sjekk package.json først.
- Hold animasjon kort (~200ms) — dette er polish, ikke et statement.
- Snap-point må ikke endres ved POI-bytte (pin høyden).

**Patterns to follow:**
- Eksisterende transitions i mobile board-komponenter bruker tailwind `transition-transform duration-[420ms] ease-[cubic-bezier(...)]` (BoardPeekCard, BoardCategoryGrid). Match generelt animasjons-language.
- Memory: ingen auto-scroll ved expand — gjelder for inline-accordion, men cross-fade på sheet er en annen kontekst.

**Test scenarios:**
- Test expectation: minimal — animasjons-polish, ingen behavioral change. Verifiser visuelt at klikk på en annen marker mens sheet er åpen produserer fade istedenfor brå bytte.
- Happy path: Sheet åpen for POI A → klikk marker for POI B → POI A fader ut, POI B fader inn (~200ms). Header (navn + kategori) overgangslett. Action-bar fade-er også (eller persisterer hvis det føles bedre).
- Edge case: Rask multi-klikk på flere markører — animasjonen skal ikke stable opp queueing av fades. Sist-klikket POI vinner.

**Verification:**
- Mobile-bredde: åpne sheet for restaurant A. Klikk på en annen restaurant-marker. Innholdet bytter med smooth fade. Føles native.

## System-Wide Impact

- **Interaction graph:** Endret state-machine kan påvirke `useActivePOIId`-konsumenter (BoardMarker, BoardPathLayer, BoardPathMidpointMarker, BoardPOILabel). Hvis vi introduserer `HIGHLIGHT_POI`, må alle stedene som leser `state.activePOIId` bestemme om de skal handle på "highlight uten phase-bytte" eller bare når `phase === "poi"`. Marker-highlight: ja. Path-rendering (Home → POI): kun hvis `phase === "poi"` (forblir uendret).
- **Error propagation:** Ingen nye eksterne avhengigheter. Eksisterende error-håndtering i `BoardPOIDetails` (graceful skip når data mangler) gjelder uendret.
- **State lifecycle risks:** Phase-state har vært stabilt mønster i 5 dager. Endringer i `OPEN_READING` (tab-parameter) eller introduksjon av `HIGHLIGHT_POI` må ikke bryte eksisterende `board-state.test.ts` (12 tester) — kjør disse testene etter hver enhet.
- **API surface parity:** Ingen ekstern API. Kun interne component-props (BoardPOIDetails får ny `hideActionBar`-prop hvis vi går den ruten).
- **Integration coverage:** Map-marker-klikk → BoardPOISheet (eksisterende flyt) skal fortsatt fungere. List-klikk → inline accordion (ny flyt). Ingen overlapp.
- **Unchanged invariants:** Desktop-flyten er eksplisitt uendret. `BoardPOIAccordion`, `BoardDetailPanel`, `BoardDesktopShell` rører vi ikke. `transformToReportData` og `adaptBoardData` uendret.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| State-machine-utvidelse (`HIGHLIGHT_POI`) bryter eksisterende tester eller logikk i path-layer/marker-rendering | Hvis Unit 1 viser at state-utvidelse er for omfattende, fall tilbake til lokal accordion-state og la map-marker-highlight skje via separat callback. Beslutning ved Unit 1-implementasjon, ikke planning-tid. |
| `BoardPOIDetails`-split (action-bar separat eksport) kan bryte desktop-accordion hvis prop-API endres | Behold `BoardPOIDetails` som hovedeksport som rendrer alt (desktop bruker dette uendret). Legg til `BoardPOIActionBar` som separat eksport, og en prop `hideActionBar?: boolean` som mobile-sheet bruker for å skjule den fra hovedkomponenten. Desktop-konsument får ingen endring. |
| Pinned action-bar overlap med safe-area-inset-bottom på iOS | Eksisterende kode bruker `paddingBottom: "calc(... + env(safe-area-inset-bottom, 0px))"` — fortsett samme mønster i pinned action-bar-wrapperen. |
| Cross-fade-animasjon (Unit 6) krever framer-motion som ikke er i prosjektet | Sjekk package.json før Unit 6 — hvis framer-motion ikke finnes, bruk CSS-only cross-fade med double-render-pattern eller drop animasjonen og la det være "snap" (akseptabelt for prototype-fase). |
| Vaul-snap-point-endring (0.5 → 0.85) kan føles "for høyt" på små viewports | 0.85 = 85% av viewport-høyde. På 844px viewport = ~720px synlig sheet. Hvis det føles for mye, juster til 0.7. Dette er fin-tuning som tas under verifisering, ikke planning. |

## Documentation / Operational Notes

- Oppdater `PROJECT-LOG.md` med beslutninger, scope og åpne spørsmål etter Phase 3 er ferdig — én logg-oppføring som dekker alle 3 fasene.
- Vurder å skrive et solutions-dokument under `docs/solutions/ux-improvements/` for "mobile board accordion-inline-pattern" hvis det etablerer seg som konvensjon for fremtidige bottom-sheet-flyter (etter Unit 1 er kjørt og fungerer).

## Sources & References

- **Trello-kort (desktop POI-detalj-arbeidet):** [xniF3kwm](https://trello.com/c/xniF3kwm)
- **Tidligere plan (board UX foundation):** `docs/plans/2026-04-29-001-feat-board-ux-rapport-variant-plan.md`
- **Tidligere plan (sub-kategori-filter):** `docs/plans/2026-04-30-001-feat-rapport-board-subcategory-filter-plan.md`
- **Memory:** mobile-native UX, prototype-stadium, disclosure-animasjoner uten auto-scroll, worktree-dev-server.
- **PROJECT-LOG.md** — siste oppføring 2026-04-30 om POI-kort dynamisk innhold + farge-paritet.
