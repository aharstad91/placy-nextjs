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

## Overview

Bygg de to sidebar-navigasjonsmodellene som skal sammenlignes live, hver i sin git-worktree branchet fra det felles fundamentet ([fundament-planen](2026-06-09-001-feat-kulturnatt-event-board-foundation-plan.md)). Eneste variabel mellom dem er sidebarens innhold:

- **Variant A — Explorer i nytt skall:** filter-drevet event-liste (tema/dag/tid-kontroller + sortert liste, kart-sentrisk).
- **Variant B — Hybrid / festival-native:** `[Kategorier | Program]`-toggle med tidslinje sortert på klokkeslett.

Lever begge kjørbart + screenshots (mobil + desktop) + helhetsvurdering. Andreas velger vinner.

## Problem Frame

Vi vet ikke hvilken navigasjonsmodell som føles riktigst for festival-planlegging, så vi bygger begge og bedømmer dem side om side. Fundamentet (event-adapter, board-rute, filter, Min samling, mobil-sheet) er felles; her divergerer kun sidebar-innholdet. (se origin: `docs/brainstorms/2026-06-09-kulturnatt-port-requirements.md`)

## Requirements Trace

- R8. Variant A: filter-drevet event-liste (Kompass-DNA i nytt skall).
- R9. Variant B: `[Kategorier|Program]`-toggle + Program-view (tidslinje på klokkeslett).
- R10. Begge bygges fullverdig i hver sin worktree, branchet fra felles fundament-branch.
- R11. Leveranse: begge kjørbare + screenshots (mobil + desktop) + helhetsvurdering (mobil-følelse + demo-verdi for Midtbyen).
- R17. Variant B: filter virker in-place uansett aktiv fane; fane-valg nullstilles ikke ved filterendring.

## Scope Boundaries

- Ingen ny dataadapter eller rute-endring her — alt det er fundament (plan 001).
- Vinner velges **ikke** i denne planen; den leverer beslutningsgrunnlaget.

### Deferred to Separate Tasks
- Produksjonsherding av vinner-varianten (etter at Andreas har valgt): egen oppgave.

## Context & Research

### Relevant Code and Patterns
- **Divergens-søm:** `components/variants/report/reels/DesktopStorySidebar.tsx` — header + footer + CardRouter er delt; innholdet mellom dem (`SidebarContentPreview` i dag) er det som swappes. Anbefalt seam: `sidebarVariant`-prop / slot-prop for innhold, ikke fork av hele `DesktopStorySidebar`.
- **Variant A-logikk finnes allerede:** `lib/hooks/useKompassFilter.ts` (filtrering + kronologisk sortering), `lib/kompass-store.ts` (valg-state). Variant A er i hovedsak å rendre denne filtreringen i board-sidebarens innholds-slot.
- **Variant B-tidslinje:** `KompassTimeline`-grupperingslogikk (group-by-`eventTimeStart`) i Kompass-stacken er direkte gjenbrukbar.
- **Delte interaksjonsregler:** R12–R17 levert i fundament (plan 001, Unit 4) — begge varianter arver tomtilstand, tid-bøtter, single-night dag-regel, timeless-bøtte, drill-in, sortering.

### Institutional Learnings
- `docs/solutions/workflow-issues/parallel-sessions-require-worktrees-20260208.md` + `docs/solutions/build-errors/next-cache-corruption-parallel-sessions-20260215.md` — én sesjon per mappe; ulike porter; `scripts/setup-worktree.sh` (symlinker `.env.local`, installerer deps, sletter `.next`). `.supabase/` kopieres ikke.
- `docs/solutions/logic-errors/trust-filter-missing-report-data-layer-20260208.md` — enhver felles filtrering/synlighet skal ligge i fundamentet, ikke i én variant, ellers lekker den andre.

### Verified Facts (prod-DB, 2026-06-09)
- Fler-dags Event-prosjekter finnes: `festspillene-bergen_festspillene-2026`, `olavsfest_olavsfest-2025`, `arendalsuka_arendalsuka-2026` → validerings-overflate for Variant B's tidslinje (Kulturnatt alene er én kveld).

## Key Technical Decisions

- **Swappable innholds-seam, ikke fork:** Begge varianter mater innhold inn i samme `DesktopStorySidebar`-skall (og samme mobil-sheet) via en innholds-prop. Holder "eneste variabel = nav-modell" ærlig og minimerer drift.
- **Fundament fryses ved split:** tag fundament-branchen før worktrees brancher ut. Fix oppdaget etter divergens → back-merge til base → propager til begge worktrees.
- **Multi-day-validering:** primær demo-overflate = Kulturnatt (Midtbyen-publikum). I tillegg pekes begge varianter mot ett fler-dags-prosjekt (Festspillene/Olavsfest) for å eksersere tidslinje-differensiatoren.

## Open Questions

### Resolved During Planning
- *Forker vi `DesktopStorySidebar` per variant?* → Nei, swappable innholds-prop (renere sammenligning).
- *Hvordan unngå at single-night-data skjuler forskjellen?* → Valider begge mot et fler-dags-prosjekt i tillegg til Kulturnatt.

### Deferred to Implementation
- Eksakt visuell tetthet i Program-view (kontinuerlig klokke-akse vs. bøtte-headere): avgjøres mot faktisk data.
- Om mobil Variant B-toggle ligger i sheet-header eller som segmentkontroll øverst i listen: avgjøres ved mobil-test.

## High-Level Technical Design

> *Directional guidance for review, ikke implementasjonsspesifikasjon.*

```
            FELLES FUNDAMENT (plan 001, base-branch, tagget)
                            │
        ┌───────────────────┴────────────────────┐
   worktree A (port 3001)                    worktree B (port 3002)
   sidebarVariant="filter"                   sidebarVariant="program"
        │                                          │
   VariantAFilteredEventList                  VariantBProgramTimeline
   [Tema▾][Dag▾][Tid▾]                        [ Kategorier | Program ]
   └ event-liste (tid-sortert)                  Program: 15:00┬ 16:00┼ 17:00┴
                                                Kategori: gjenbruker preview-grid
        └──────────── samme BoardMap + Min samling + mobil-sheet ──────────┘
```

## Implementation Units

- [ ] **Unit 1: Swappable sidebar-innholds-seam**

**Goal:** Etabler den delte seam-en der variant-innhold injiseres i sidebar (desktop) og bottom-sheet (mobil), uten å fork-e skallet.

**Requirements:** R10

**Dependencies:** Fundament plan 001 (Unit 3, 4, 6)

**Files:**
- Modify: `components/variants/report/reels/DesktopStorySidebar.tsx` (ny `sidebarContent?: ReactNode`-prop — **dette er den første content-prop-en**; `DesktopStorySidebar` har ingen `children`/slot i dag)
- Modify: mobil-sheet-wiring i `components/variants/report/reels/ReportReelsPage.tsx` (samme innholds-slot på mobil)
- Test: `components/variants/report/reels/DesktopStorySidebar.test.tsx`

**Approach:**
- Seam-en treffer **`!hasPlayableContent`-grenen** (DesktopStorySidebar:684–697): når `sidebarContent` er satt, erstatter den `<SidebarContentPreview>`-elementet; player-grenen er urørt (boligrapport beholder preview ved å ikke sende prop).
- Forutsetter fundamentets ingen-audio-event-modus (plan-001 D3): megler-placeholder-footer + basic-splash er allerede undertrykt for events, så variant-innholdet ikke arver eiendoms-chrome.
- Begge varianter dispatch-er samme `SELECT_CATEGORY`/`OPEN_POI` til `board-state`; markør-filtrering + per-event drill-in + collection er fundament (plan-001 Unit 4–6), ikke duplisert per variant.

**Patterns to follow:** `!hasPlayableContent`-grenen i `DesktopStorySidebar` (linje 684–697). NB: ingen eksisterende content-slot finnes — dette innfører den.

**Test scenarios:**
- Happy path: med `sidebarContent` rendres injisert innhold mellom header/footer.
- Edge case: uten prop rendres `SidebarContentPreview` (boligrapport-regresjon).
- Integration: innholds-klikk dispatcher korrekt til `board-state` (kart reagerer).

**Verification:** Seam fungerer; boligrapport uendret; begge slots (desktop + mobil) tar innhold.

---

- [ ] **Unit 2: Variant A — filter-drevet event-liste**

**Goal:** Implementer Variant A's sidebar-innhold: tema/dag/tid-kontroller + kronologisk sortert event-liste.

**Requirements:** R8

**Dependencies:** Unit 1

**Files:**
- Create: `components/variants/report/reels/VariantAFilteredEventList.tsx`
- Test: `components/variants/report/reels/VariantAFilteredEventList.test.tsx`

**Approach:**
- Gjenbruk `useKompassFilter`/`kompass-store` (fundament) for filtrering + sortering.
- Tema-toggles + dag-chips (degenerert per R13 på Kulturnatt) + tid-bøtte-chips (R13-konstanter).
- Listerad-klikk → `OPEN_POI` + fly-to via `MapAdapter`.

**Patterns to follow:** `KompassTabs`/Kompass-liste-rendering; `lib/map/map-adapter.ts` for fly-to.

**Test scenarios:**
- Happy path: filtervalg oppdaterer listen; liste tid-sortert, timeless sist (R16).
- Edge case: 0 treff → tomtilstand-CTA (fra fundament).
- Edge case: single-day → dag-kontroll degenerert (R13).
- Integration: rad-klikk flyr kameraet til venue i både 2D og 3D.

**Verification:** Variant A kjører på `/event/kulturnatt-trondheim/kulturnatt-2025/board`; filter + liste + kart synkront.

---

- [ ] **Unit 3: Variant B — [Kategorier|Program]-toggle + tidslinje**

**Goal:** Implementer Variant B's sidebar-innhold: fane-toggle med kategori-view + klokke-tidslinje.

**Requirements:** R9, R17

**Dependencies:** Unit 1

**Files:**
- Create: `components/variants/report/reels/VariantBProgramTimeline.tsx`
- Test: `components/variants/report/reels/VariantBProgramTimeline.test.tsx`

**Approach:**
- `[Kategorier | Program]`-segmentkontroll. Kategori-view gjenbruker preview-grid-logikk; Program-view rendrer board-native rader som dispatcher `OPEN_POI`.
- **Ekstraher/gjenbruk kun `groupByTime`-hjelperen** fra `KompassTimeline` — ikke importer komponenten (den drar inn `ExplorerPOICard` + `POI[]`-shape + `collectionPOIs`). Dag-seksjons-laget kommer fra fundamentet (plan-001 D6, dato-bevisst), så fler-dags (Festspillene) ikke kollapser dag1-15:00 og dag3-15:00 i samme node.
- R14: "Tidspunkt ikke oppgitt"-bøtte i Program-view. R17: filter virker in-place uansett aktiv fane; fane nullstilles ikke ved filterendring. Overlappende events stables i samme tids-slot.

**Patterns to follow:** `groupByTime`-logikken i `components/variants/explorer/KompassTimeline.tsx` (hjelper, ikke komponent), dag-seksjons-aggregat + R13-konstanter fra fundament (plan-001 Unit 4).

**Test scenarios:**
- Happy path: Program-view viser events i klokke-rekkefølge; toggle bytter til kategori-grid.
- Edge case: events uten tid → egen merket bøtte (R14).
- Edge case (fler-dags, Festspillene): events fordeles på dag-seksjoner i tidslinjen.
- Edge case: filterendring beholder aktiv fane (R17).
- Integration: tidslinje-rad-klikk → `OPEN_POI` + fly-to.

**Verification:** Variant B kjører; Program-view korrekt på Kulturnatt (én kveld) og på et fler-dags-prosjekt.

---

- [ ] **Unit 4: Worktree-oppsett + multi-day validerings-overflate**

**Goal:** Sett opp de to worktreene fra tagget fundament-branch, kjørbare på hver sin port, pekt mot Kulturnatt + et fler-dags-prosjekt.

**Requirements:** R10

**Dependencies:** Plan-001 komplett + Foundation Freeze Gate passert. **Unit 1 (swappable seam) lander på base-branchen** før split; variant-INNHOLDET (Unit 2 = Variant A, Unit 3 = Variant B) bygges **per-tree etter split**, ikke på base.

**Files:**
- Ingen kildekode-filer her; arbeidstre-/branch-operasjoner + verifisering.

**Approach:**
- Sekvens (oppløser tidligere selvmotsigelse): (1) fundament + Unit 1-seam landes og base-branchen **tagges/fryses**; (2) `git worktree add ../placy-ralph-variant-a -b feat/event-board-variant-a` og `...-variant-b`; (3) `scripts/setup-worktree.sh` i hver; (4) Variant A bygges i tree A, Variant B i tree B. Porter `PORT=3001`/`PORT=3002`.
- Fix oppdaget etter split → back-merge til base → propager til begge trees (driver ellers fra hverandre).
- Verifiser begge mot `/event/kulturnatt-trondheim/kulturnatt-2025/board` (én kveld) og `/event/festspillene-bergen/festspillene-2026/board` (fler-dags).

**Execution note:** Følg worktree-læringene (`.supabase/` ikke kopiert; `.next` slettes av setup-script).

**Test scenarios:**
- Test expectation: none — infrastruktur/oppsett (verifiseres ved at begge dev-servere starter og rendrer).

**Verification:** Begge worktrees kjører samtidig (3001/3002), rendrer event-board for både single-night og fler-dags-prosjekt.

---

- [ ] **Unit 5: Sammenligning + leveranse**

**Goal:** Produser beslutningsgrunnlaget: screenshots (mobil + desktop) av begge varianter + kort helhetsvurdering.

**Requirements:** R11

**Dependencies:** Unit 4

**Files:**
- Create: `docs/plans/kulturnatt-variant-comparison.md` (vurdering + screenshot-referanser)

**Approach:**
- Screenshots desktop + mobil-viewport (390px) for begge varianter, på Kulturnatt + fler-dags.
- Vurder mot avgjør-signaler (origin Success Criteria): tommel-rekkevidde på toggle, skanne-hastighet tidslinje vs. liste på mobil, hvor raskt man bygger en kveldsplan.
- **Variant B's differensiator (tidslinjen) må vurderes på fler-dags-prosjektet, ikke bare Kulturnatt** (der den er undertrykt). Tie-breaker "ship Variant A hvis uavklart" fyrer kun *etter* at B er testet på fler-dags — ellers ville single-night-demoen avgjort til fordel for A uten å ha eksersert B's faktiske fortrinn.
- Ingen VT-framing.

**Test scenarios:**
- Test expectation: none — leveranse-/vurderingsartefakt.

**Verification:** Sammenligningsdokument med screenshots fra begge varianter (mobil + desktop, begge datasett) + anbefaling klart for Andreas' valg.

## System-Wide Impact

- **Interaction graph:** Begge varianter dispatcher samme board-state-actions; kart/Min samling/mobil-sheet er felles og uendret.
- **Unchanged invariants:** `SidebarContentPreview`-default (boligrapport) er urørt — variant-innhold er opt-in via prop.
- **Integration coverage:** Verifiser at felles filtrering ligger i fundament (ikke duplisert per variant) for å unngå lekkasje (jf. trust-filter-læring).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Worktrees driver fra hverandre etter split | Fundament tagget; post-divergens-fix back-merges til base |
| Sammenligning forblir uavklart | Tie-breaker definert (ship A); fler-dags-data ekserserer faktisk forskjell |
| Variant B-tidslinje degenererer på single-night | Valideres også mot fler-dags-prosjekt |

## Sources & References
- **Origin:** [docs/brainstorms/2026-06-09-kulturnatt-port-requirements.md](../brainstorms/2026-06-09-kulturnatt-port-requirements.md)
- **Fundament-plan:** [docs/plans/2026-06-09-001-feat-kulturnatt-event-board-foundation-plan.md](2026-06-09-001-feat-kulturnatt-event-board-foundation-plan.md)
- Nøkkelkode: `components/variants/report/reels/DesktopStorySidebar.tsx`, `lib/hooks/useKompassFilter.ts`, `lib/map/map-adapter.ts`
- Læringer: `docs/solutions/workflow-issues/parallel-sessions-require-worktrees-20260208.md`, `docs/solutions/logic-errors/trust-filter-missing-report-data-layer-20260208.md`
