---
title: "feat: Kulturnatt event-board — Variant A & B + sammenligning"
type: feat
status: active
date: 2026-06-09
deepened: 2026-06-09
origin: docs/brainstorms/2026-06-09-kulturnatt-port-requirements.md
depends_on: docs/plans/2026-06-09-001-feat-kulturnatt-event-board-foundation-plan.md
---

# feat: Kulturnatt event-board — Variant A & B + sammenligning

## Status / Resume Point (2026-06-09)

> **Dette dokumentet er selvstendig nok til å gjenoppta Variant B-bygging etter en context-compact.** Les status + Unit 2 + nøkkelfilene under; alt annet er kontekst.

**Fundamentet er bygget, verifisert og tagget.** Branch `feat/event-board-foundation`, tag `event-board-foundation-frozen` (HEAD `8efae48`), 8 commits, **ikke pushet**. Verifisert: vitest 680/680, `next build` 63/63 sider, live i nettleser (Kulturnatt 131 events + fler-dags Festspillene 15 dag-seksjoner), null megler-chrome, filter→liste+markør+kamera-fit fungerer, konsoll ren.

**Viktig realitet:** Fundamentet **realiserer allerede Variant A.** `components/variants/report/board/event/EventFilterPanel.tsx` ER den filter-drevne event-listen (tema/dag/tid-chips + dato-seksjonert kronologisk liste), wiret via `ReportReelsPage` (event-modus) → desktop-sidebar + `EventMobileSheet` (mobil). **Program-tidslinjen Variant B trenger finnes også allerede** som den dato-seksjonerte listen (`lib/event-board/event-day-sections.ts` → `buildDaySections`).

**Gjenstår for sammenligningen:**
- **Variant A:** ferdig = fundamentet som det er. Ingen ny kode.
- **Variant B:** den faktiske nye jobben — `EventHybridPanel` med `[Kategorier | Program]`-toggle. *Program*-fanen gjenbruker den eksisterende dato-seksjonerte listen; *Kategorier*-fanen er en **NY** board-aktig kategori-grid-inngang (kort per kategori → velg → se kategoriens events). Gjenbruk `EventDetailPanel` (drill-in), collection-sømmen (`use-board-collection`), `useEventBoardFilter` (filter-state). Bygges i egen worktree fra taggen.
- **Sammenligning:** screenshots (mobil + desktop, Kulturnatt + fler-dags) + helhetsvurdering (Unit 3).

**Resume-kommandoer:** worktree fra tag, eller `git checkout feat/event-board-foundation`. Dev: `PORT=3005 npm run dev` → `localhost:3005/event/kulturnatt-trondheim/kulturnatt-2025/board` (single-night) + `/event/festspillene-bergen/festspillene-2026/board` (fler-dags).

**Nøkkelfiler bygget i fundamentet:**
- `lib/event-board/`: `event-board-data.ts` (`eventToBoardData`-adapter), `useEventBoardFilter.ts`, `event-day-sections.ts` (`buildDaySections`, dato-bevisst), `event-filter-constants.ts` (tid-bøtter), `marker-visibility.ts`, `use-board-collection.ts`.
- `components/variants/report/board/event/`: `EventFilterPanel.tsx` (= Variant A), `EventDetailPanel.tsx` (drill-in), `EventMobileSheet.tsx` (mobil), `BoardCollectionDrawer.tsx` (Min samling).
- `components/variants/report/board/`: `BoardMap.tsx` (`visiblePoiIds`-prop + `eventMode`-fit), `board-camera-fit.ts`, `board-state.tsx` (visiblePoiIds-kontekst).
- `app/event/[customer]/[project]/board/page.tsx` (rute), `components/variants/report/reels/ReportReelsPage.tsx` (`boardData`-input + event-modus-routing).

## Overview

Vi sammenligner to sidebar-navigasjonsmodeller for festival-board live:

- **Variant A — Explorer i nytt skall:** filter-drevet event-liste. **Realisert av fundamentet** (`EventFilterPanel`).
- **Variant B — Hybrid / festival-native:** `[Kategorier | Program]`-toggle der Program = den eksisterende dato-seksjonerte listen, og Kategorier = en ny kategori-grid-inngang.

Bygges i to worktrees fra tagget fundament, leveres side om side med screenshots + helhetsvurdering. Andreas velger vinner.

## Problem Frame

Vi vet ikke hvilken navigasjonsmodell som føles riktigst for festival-planlegging, så vi bygger begge og bedømmer side om side. Fundamentet (event-adapter, board-rute, filter, Min samling, drill-in, mobil-sheet) er felles; her divergerer kun sidebar-innholdet — og siden Variant A allerede er fundamentet, er den nye koden i praksis kun Variant B. (se origin: `docs/brainstorms/2026-06-09-kulturnatt-port-requirements.md`)

## Requirements Trace

- R9. Variant B: `[Kategorier|Program]`-toggle + Program-view (dato-seksjonert tidslinje).
- R10. Begge varianter kjørbare, hver i sin worktree fra tagget fundament-branch.
- R11. Leveranse: begge kjørbare + screenshots (mobil + desktop) + helhetsvurdering (mobil-følelse + demo-verdi for Midtbyen).
- R17. Variant B: filter virker in-place uansett aktiv fane; fane-valg nullstilles ikke ved filterendring.
- (R8 — Variant A filter-liste — er allerede levert av fundamentet, `EventFilterPanel`.)

## Scope Boundaries

- Ingen ny dataadapter, rute eller delt interaksjonsregel her — alt det er fundament (plan 001).
- Vinner velges **ikke** i denne planen; den leverer beslutningsgrunnlaget.

### Deferred to Separate Tasks
- Produksjonsherding av vinner-varianten (etter at Andreas har valgt): egen oppgave.

## Context & Research

### Relevant Code and Patterns
- **Variant A = fundamentet:** `components/variants/report/board/event/EventFilterPanel.tsx` rendres i event-modus via `ReportReelsPage` → `ResponsiveLayoutInner` → desktop-sidebar / `EventMobileSheet`. Ingen ny kode for A.
- **Variant B-byggekloss (Program-fanen finnes):** den dato-seksjonerte listen i `EventFilterPanel` (drevet av `useEventBoardFilter` + `buildDaySections`) ER Program-visningen. Variant B trenger å (a) faktorere ut liste-renderingen så den kan gjenbrukes i en fane, og (b) bygge en ny Kategorier-grid-fane + segment-toggle.
- **Variant-mekanisme:** siden hver variant er sin egen worktree, bytter worktree B hvilken panel-komponent event-modus rendrer (`EventFilterPanel` → `EventHybridPanel`). Ingen runtime `sidebarVariant`-prop nødvendig — worktree = variant. Boligrapport-stien er uansett urørt (event-modus-gren).
- **Delt og gjenbrukbart:** `EventDetailPanel` (drill-in), `use-board-collection` (Min samling/`?c=`), `useEventBoardFilter` (filter+seksjoner), `BoardMap` `visiblePoiIds`-søm — alt i fundamentet, deles av begge varianter.

### Institutional Learnings
- `docs/solutions/workflow-issues/parallel-sessions-require-worktrees-20260208.md` + `docs/solutions/build-errors/next-cache-corruption-parallel-sessions-20260215.md` — én sesjon per mappe; ulike porter; `scripts/setup-worktree.sh` (symlinker `.env.local`, installerer deps, sletter `.next`). `.supabase/` kopieres ikke.
- `docs/solutions/logic-errors/trust-filter-missing-report-data-layer-20260208.md` — felles filtrering ligger allerede i fundamentet, ikke per variant.

### Verified Facts (prod-DB + live, 2026-06-09)
- Fler-dags Event-prosjekter finnes og rendrer korrekt dato-seksjonert: `festspillene-bergen_festspillene-2026` (16 dager, 15 dag-seksjoner live-verifisert), `olavsfest_olavsfest-2025`, `arendalsuka_arendalsuka-2026`.

## Key Technical Decisions

- **Worktree = variant:** worktree A er fundamentet uendret (Variant A); worktree B legger til `EventHybridPanel` (Variant B). Begge brancher fra tag `event-board-foundation-frozen`. Eneste forskjell = sidebar-panelet event-modus rendrer.
- **Program-fanen gjenbruker eksisterende liste:** ikke bygg en ny tidslinje — Program = den dato-seksjonerte listen som allerede finnes. Faktorér ut renderingen så både `EventFilterPanel` (A) og `EventHybridPanel` (B) kan dele den.
- **Fundament er frosset (tagget):** fix oppdaget under Variant B-bygging som tilhører fundamentet → land på fundament-branchen og re-tagg, propager til begge worktrees.

## Open Questions

### Deferred to Implementation
- Kategorier-grid: kort med kategori-ikon/farge/antall → klikk filtrerer til kategorien (setter `selectedThemes`) og bytter til Program-fanen, eller viser en egen kategori-liste i grid-fanen? Avgjøres mot faktisk føling.
- Mobil Variant B: ligger toggle i sheet-header eller som segmentkontroll øverst i listen? Avgjøres ved mobil-test.
- Visuell tetthet i kategori-grid (2 vs 3 kolonner) — avgjøres mot data.

## High-Level Technical Design

> *Directional guidance for review, ikke implementasjonsspesifikasjon.*

```
            FELLES FUNDAMENT (plan 001) — tag event-board-foundation-frozen
            event-modus rendrer EventFilterPanel (= Variant A, LIVE)
                            │
        ┌───────────────────┴────────────────────┐
   worktree A (port 3001)                    worktree B (port 3002)
   = fundamentet uendret                     event-modus rendrer EventHybridPanel
   EventFilterPanel:                         [ Kategorier | Program ]
   [Tema][Dag][Tid] + dato-seksjonert liste   Program  = gjenbruk dato-seksjonert liste
                                              Kategorier = NY grid (kort per kategori)
        └──── samme BoardMap + EventDetailPanel + Min samling + mobil-sheet ────┘
```

## Implementation Units

- [ ] **Unit 1: Worktree-oppsett (begge varianter fra tagget fundament)**

**Goal:** To kjørbare worktrees fra `event-board-foundation-frozen` — A = fundamentet (Variant A), B = arbeidskopi for Variant B.

**Requirements:** R10

**Dependencies:** Fundament komplett + tagget (✅ `event-board-foundation-frozen`).

**Files:** Ingen kildekode — git-/worktree-operasjoner.

**Approach:**
- `git worktree add ../placy-ralph-variant-a feat/event-board-foundation` (eller fra taggen) — Variant A, ingen endring.
- `git worktree add ../placy-ralph-variant-b -b feat/event-board-variant-b event-board-foundation-frozen`.
- Kjør `../placy-ralph/scripts/setup-worktree.sh` i hver (symlinker `.env.local`, deps, sletter `.next`). Porter `PORT=3001` (A) / `PORT=3002` (B).
- `.supabase/` kopieres ikke — irrelevant her (ingen migrasjoner i denne fasen).

**Test scenarios:** Test expectation: none — oppsett (verifiseres ved at begge dev-servere starter og rendrer event-board).

**Verification:** A på 3001 og B på 3002 rendrer `/event/kulturnatt-trondheim/kulturnatt-2025/board`.

---

- [ ] **Unit 2: Variant B — `EventHybridPanel` ([Kategorier | Program]-toggle + kategori-grid)**

**Goal:** Bygg Variant B's sidebar-panel i worktree B: segment-toggle med en ny Kategorier-grid-inngang + Program-fane som gjenbruker den eksisterende dato-seksjonerte listen.

**Requirements:** R9, R17

**Dependencies:** Unit 1 (worktree B).

**Files (worktree B):**
- Create: `components/variants/report/board/event/EventHybridPanel.tsx` (+ `.test.tsx`)
- Refactor (lett): faktorér listerendringen ut av `EventFilterPanel.tsx` til en delt liste-komponent (f.eks. `EventProgramList.tsx`) som både A og B kan rendre — unngå duplisering.
- Modify: event-modus-rendering i `ReportReelsPage.tsx` (worktree B rendrer `EventHybridPanel` i stedet for `EventFilterPanel`) + `EventMobileSheet.tsx` (samme bytte på mobil).

**Approach:**
- `[Kategorier | Program]`-segmentkontroll øverst. **Program** = `EventProgramList` (eksisterende dato-seksjonerte liste fra `useEventBoardFilter` + `buildDaySections`). **Kategorier** = ny grid: kort per `boardData.categories` (ikon/farge/antall); klikk → sett `selectedThemes`=[kategori] og bytt til Program-fanen (eller vis kategoriens events i grid-fanen — se Open Questions).
- R17: filter (tema/dag/tid) virker in-place uansett aktiv fane; fane-valget nullstilles ikke ved filterendring.
- Gjenbruk `EventDetailPanel` (drill-in via `OPEN_POI`), `use-board-collection` (Min samling), `visiblePoiIds`-sømmen (markører) — uendret fra fundamentet.

**Patterns to follow:** `EventFilterPanel.tsx` (filter-chips + dato-seksjonert liste + collection-toggle), `SidebarContentPreview`/board-kategori-grid for grid-stil, `board-state` `OPEN_POI`.

**Test scenarios:**
- Happy path: toggle bytter mellom kategori-grid og dato-seksjonert program; begge viser events.
- Happy path: klikk kategori-kort → filtrerer til kategorien (markører + liste).
- Edge case (R17): filterendring beholder aktiv fane.
- Edge case: events uten tid → "Tidspunkt ikke oppgitt"-bøtte i Program (arvet fra fundament).
- Edge case (fler-dags Festspillene): Program viser korrekte dag-seksjoner.
- Integration: rad-/kort-klikk → `OPEN_POI` → `EventDetailPanel`; markører + kamera reagerer.

**Verification:** Variant B kjører på 3002 mot Kulturnatt (én kveld) + Festspillene (fler-dags); toggle + grid + drill-in + Min samling fungerer; ingen megler-chrome; boligrapport urørt.

---

- [ ] **Unit 3: Sammenligning + leveranse**

**Goal:** Produser beslutningsgrunnlaget: screenshots (mobil + desktop) av begge varianter + kort helhetsvurdering.

**Requirements:** R11

**Dependencies:** Unit 2.

**Files:** Create: `docs/plans/kulturnatt-variant-comparison.md` (vurdering + screenshot-referanser).

**Approach:**
- Screenshots desktop + mobil-viewport (390px) for Variant A (3001) og Variant B (3002), på Kulturnatt + et fler-dags-prosjekt.
- Vurder mot avgjør-signaler (origin Success Criteria): tommel-rekkevidde på toggle, skanne-hastighet kategori-grid vs. filtrert liste på mobil, hvor raskt man bygger en kveldsplan i Min samling.
- **Variant B's differensiator (kategori-grid + toggle) må vurderes på fler-dags-prosjektet**, ikke bare Kulturnatt. Tie-breaker "ship Variant A hvis uavklart" fyrer kun *etter* at B er testet på fler-dags.
- Ingen VT-framing (Midtbyen-spor).

**Test scenarios:** Test expectation: none — leveranse-/vurderingsartefakt.

**Verification:** Sammenligningsdokument med screenshots fra begge varianter (mobil + desktop, begge datasett) + anbefaling klart for Andreas' valg.

## System-Wide Impact

- **Interaction graph:** Begge varianter dispatcher samme `board-state`-actions; `BoardMap`/Min samling/`EventDetailPanel`/mobil-sheet er felles og uendret.
- **Unchanged invariants:** Boligrapport-stien (`/eiendom/.../rapport-board`) er urørt — variant-bytte skjer kun i event-modus-grenen, i worktree B.
- **Integration coverage:** Felles filtrering/synlighet ligger i fundamentet (ikke duplisert per variant) — jf. trust-filter-læring.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Liste-refaktor (uttrekk fra EventFilterPanel) brekker Variant A | A er egen worktree/uendret; refaktoren skjer i B. Hvis uttrekket skal deles, land det på fundament-branchen + re-tagg + propager |
| Worktrees driver fra hverandre | Fundament tagget; fundament-fix back-merges til base og propageres |
| Sammenligning forblir uavklart | Tie-breaker definert (ship A); fler-dags-data ekserserer Variant B's fortrinn |

## Sources & References
- **Origin:** [docs/brainstorms/2026-06-09-kulturnatt-port-requirements.md](../brainstorms/2026-06-09-kulturnatt-port-requirements.md)
- **Fundament-plan:** [docs/plans/2026-06-09-001-feat-kulturnatt-event-board-foundation-plan.md](2026-06-09-001-feat-kulturnatt-event-board-foundation-plan.md)
- Nøkkelkode (fundament): `components/variants/report/board/event/EventFilterPanel.tsx`, `lib/event-board/event-day-sections.ts`, `lib/event-board/useEventBoardFilter.ts`, `components/variants/report/reels/ReportReelsPage.tsx`
- Læringer: `docs/solutions/workflow-issues/parallel-sessions-require-worktrees-20260208.md`, `docs/solutions/logic-errors/trust-filter-missing-report-data-layer-20260208.md`
