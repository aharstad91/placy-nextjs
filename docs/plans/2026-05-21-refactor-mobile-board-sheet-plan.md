---
title: Refactor mobile board sheet to adopt desktop scroll panel
type: refactor
status: active
date: 2026-05-21
origin: docs/brainstorms/2026-05-21-mobile-board-sheet-requirements.md
---

# Refactor mobile board sheet to adopt desktop scroll panel

## Overview

Erstatte dagens kompleksitet i mobile board-flata (~928 LOC + dependency-cleanup) med en minimal vaul-sheet som mounter den eksisterende desktop `BoardScrollPanel` som-er. Dette gir mobil-paritet med desktop-sidebaren, fjerner divergent legacy-kode (`BoardCategoryTabBar`, `BoardPunkterAccordion`, `BoardTabs`, `BoardLiveTransport`, og — via dependency-graf — `BoardPOIDetails`), og forenkler sheet-mekanikken til bi-snap (peek + full).

## Problem Frame

Sidebar-Spotify-anatomien (2026-05-21) landet desktop-versjonen og slo fast som mål: *"Levere én komponent-arkitektur som fungerer både på desktop og mobil."* Open question der ble deferred til mobile-implementasjon. Origin-doc-en (`docs/brainstorms/2026-05-21-mobile-board-sheet-requirements.md`) lukker det og spesifiserer hvordan: mobil-sheet skal gjenbruke `BoardScrollPanel` som content-tre.

I dag lever mobil på en parallell arkitektur: en 448-LOC vaul-Drawer med 4 snap-stages, en pinnet bunn-tab-bar (213 LOC), POI-detalj-view inni sheet (BoardPOIDetails + BoardLiveTransport), og to støttekomponenter (Punkter-accordion + tabs). Alt det skal ut. Desktop-`BoardScrollPanel` mountes direkte i en ny minimal sheet, og en pinned `BottomPlayer` lever som sibling utenfor sheet.

## Requirements Trace

- **R1.** Mobil gjenbruker desktop `BoardScrollPanel` som primært content-tre (origin: Goal 1)
- **R2.** Kart-i-bakgrunn med sheet-over beholdes (Placy-konvensjon — origin: Goal 2)
- **R3.** Slett legacy-komponenter (~928 LOC ut), oppdateres til ~535 LOC ekstra via dependency-cleanup av `BoardPOIDetails` (origin: Goal 3)
- **R4.** Audio-player pinned sibling utenfor sheet, alltid synlig når aktiv (origin: Goal 4)
- **R5.** POI-tap defereres til separat oppgave — no-op placeholders (origin: Goal 5)
- **R6.** Sheet-mekanikk forenklet til 2 snap-stages: peek (default) + full (origin: Goal 6)

## Scope Boundaries

- Ingen endring til desktop-arkitektur (BoardDesktopShell, BoardScrollPanel-content)
- Ingen endring til kart-komponenter (BoardMap, BoardMap3D, markører, popups)
- Ingen endring til audio-tour-state, karaoke-rendering, eller cover-illustrasjoner
- Ingen POI-tap-koordinasjon (chip-tap → sheet-snap + kart-fly-to) — placeholders kun
- Ingen auto-snap ved play-events — bruker styrer sheet-posisjon manuelt
- Ingen forsøk på å bevare gammel sheet sin tab-switching (Info/Punkter) — content-modellen er desktop-`BoardScrollPanel`-en uansett

### Deferred to Separate Tasks

- **POI-tap-flyt på mobil** — chip-tap, grounding-link-tap, sheet-til-peek-auto-snap + kart-fly-to + mini-popup. Separat oppgave; vil sannsynligvis trenge re-introduksjon av POI-detalj-mønster i annen form.
- **`BoardLiveTransport` re-introduksjon** — hvis live transport-widget skal være i scroll-panelet senere, kommer den tilbake som content-modul. Ikke i denne planen.
- **Refactor av desktop til samme fixed-bottom-player-pattern** — denne planen lar desktop beholde sin in-flow BottomPlayer i scroll-panel. Hvis vi vil at desktop også skal ha viewport-bred fixed-bottom player, gjøres det i egen runde.

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/board/ReportBoardPage.tsx` — `BoardScaffold` styrer mounting via `useIsDesktop()`. Her fjernes `BoardCategoryTabBar`-mounting; her mountes ny mobile `BottomPlayer`-sibling.
- `components/variants/report/board/desktop/BoardScrollPanel.tsx` — gjenbrukes som-er i mobile sheet. Krever én liten prop-endring (`mountBottomPlayer?: boolean`) for å unngå dobbel-rendring av player.
- `components/variants/report/board/mobile/BoardMobileSheet.tsx` — rewrites til minimal vaul-Drawer (~50-80 LOC) som mounter `<BoardScrollPanel mountBottomPlayer={false} />`.
- `components/variants/report/board/audio-tour/BottomPlayer.tsx` — rendres uten posisjons-styling i dag (flow-element med `border-t` + `shadow`). Wrapping i en `fixed inset-x-0 bottom-0 z-50`-div gjøres i BoardScaffold.
- `vaul`-bibilotek — allerede installert og brukt; `Drawer`-primitiver i `@/components/ui/drawer.tsx`. Snap-config: `["30%", 1]` eller tilsvarende (avgjøres i implementasjon).

### Institutional Learnings

- CLAUDE.md "Kodebase-hygiene": Når du bygger noe nytt som erstatter noe gammelt, SLETT det gamle umiddelbart. Ingen dead code, ingen kommenterte blokker.
- CLAUDE.md "Output-fokus": Verifiser at features FUNGERER (screenshots/manuell sjekk). Mobil-QA på 375px-viewport er primær verifikasjon.
- Memory `feedback_mobile_native_ux`: Bottom-sheets på mobil, sidekolonner på desktop — ikke tvunget felles. Denne planen overholder det: mobil får ekte bottom-sheet, desktop beholder 400px strip.
- Memory `feedback_worktree_dev_server`: Dev-server kjører på `:3002` i denne worktreen — verifisering skal skje der.

### External References

Ingen. Vaul-Drawer-API er allerede brukt i kodebasen; ingen ny ekstern teknologi.

## Key Technical Decisions

- **Bi-snap via vaul `snapPoints={["30%", 1]}`** (eller tilsvarende verdier): én peek-stage som viser kart + hero-illustrasjon-peek, og full (1.0). Default = peek. Endelige snap-tall avgjøres ved implementasjon basert på enheten.
- **`BoardScrollPanel` får én ny prop `mountBottomPlayer?: boolean` (default true).** Bakoverkompatibelt for desktop. Mobil sender `false`. Player mountes i scaffold som sibling.
- **`BottomPlayer` rendres uendret** — vaul-sheet wrapper den i en `fixed inset-x-0 bottom-0 z-50`-div på mobil. Desktop forblir uberørt.
- **`BoardPOIDetails.tsx` slettes også.** Den brukes kun av de mobile-filene som slettes; ingen desktop-bruk. Bekreftet via grep.
- **`useIsDesktop()` beholdes** som breakpoint-styrer i scaffold. Ingen ny breakpoint-logikk introduseres.
- **Drag-mønster (handle-only vs hele-sheet)** — vaul-default beholdes (hele sheet draggable). Hvis konflikt med scroll inni `BoardScrollPanel` oppstår, justeres til handle-only ved implementasjon.

## Open Questions

### Resolved During Planning

- **Hvor mountes `BottomPlayer` på mobil?** Som sibling i `BoardScaffold` med `fixed bottom-0 z-50`. `BoardScrollPanel` mountes med ny `mountBottomPlayer={false}`-prop for å unngå dobbel.
- **Hva med `BoardPOIDetails.tsx`?** Slett — den brukes kun av legacy mobile-komponenter som forsvinner. Verifisert.
- **Hva med `BoardLiveTransport.tsx`?** Slett etter at `BoardPOIDetails` er borte (dens eneste consumer utenfor mobile-folder).

### Deferred to Implementation

- **Eksakte snap-verdier** (peek-prosent og overgangsfølelse) — testes interaktivt på 375px-viewport.
- **Drag-handle vs hele-sheet-draggable** — start med vaul-default; juster hvis konflikt med vertikal scroll.
- **Skjul `CategoryFeaturedChips` på mobil eller behold som no-op?** Avgjøres når vi ser hvor klikkbart chips ser ut på enhet. Hvis de villeder, skjules de via conditional render i `BoardScrollPanel` eller en ny prop.
- **iOS Safari `overflow:hidden`-workaround** — beholdes i `BoardScaffold` for nå. Test om fortsatt nødvendig etter ny sheet-arkitektur; hvis ikke, fjernes i en oppfølger.

## Implementation Units

- [x] **Unit 1: Legg til `mountBottomPlayer` prop på `BoardScrollPanel`**

**Goal:** Gjør det mulig å mounte `BoardScrollPanel` uten dens innebygde `BottomPlayer`, slik at mobil kan mounte player som sibling utenfor sheet.

**Requirements:** R4

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/board/desktop/BoardScrollPanel.tsx`

**Approach:**
- Legg til prop `mountBottomPlayer?: boolean` med default `true`
- Wrap `<BottomPlayer />`-rendringen i `{mountBottomPlayer && <BottomPlayer />}`
- Ingen andre endringer

**Patterns to follow:**
- Eksisterende prop-defaulting-mønster i komponenten (om noen)
- Bevarer eksisterende kommentar-stil — uendret rendring-logikk for resten

**Test scenarios:**
- Happy path: Desktop rendring uten prop → BottomPlayer rendres (default true bevart)
- Happy path: Render med `mountBottomPlayer={false}` → BottomPlayer-elementet er ikke i DOM
- Test expectation: `npm run lint && npx tsc --noEmit` passerer; ingen render-test påkrevd for boolean-toggle (visuell verifikasjon via Unit 2)

**Verification:**
- TypeScript-compile passerer
- Desktop-rendring uendret (manuell sjekk på `lg+`-viewport: player synlig som før når spor spiller)

---

- [x] **Unit 2: Ny minimal `BoardMobileSheet` + `BoardScaffold`-integrasjon**

**Goal:** Erstatte legacy `BoardMobileSheet` med en minimal vaul-Drawer som mounter `<BoardScrollPanel mountBottomPlayer={false} />`. Fjern `BoardCategoryTabBar`-mounting fra scaffold. Mount `BottomPlayer` som fixed-bottom sibling i scaffold (mobile-only).

**Requirements:** R1, R2, R4, R6

**Dependencies:** Unit 1 (krever `mountBottomPlayer`-prop)

**Files:**
- Modify: `components/variants/report/board/mobile/BoardMobileSheet.tsx` (rewrites — fra ~448 LOC til ~50-80 LOC)
- Modify: `components/variants/report/board/ReportBoardPage.tsx`

**Approach:**
- `BoardMobileSheet`:
  - `Drawer` (vaul) med `open={true}`, `dismissible={false}`, `modal={false}`
  - `snapPoints={["30%", 1]}` (peek + full) — tall finjusteres
  - Default snap = `"30%"` (peek)
  - Innhold: `<BoardScrollPanel mountBottomPlayer={false} />`
  - Behold drag-handle øverst (vaul-default)
  - Slett ALL legacy logikk (phase-sniffing, POI-fade, BoardTabs, BoardPunkterAccordion, BoardPOIDetails, SidebarHero, QueueOverlay)
- `ReportBoardPage` / `BoardScaffold`:
  - Fjern import + mounting av `BoardCategoryTabBar`
  - Mobil-tre (`!isDesktop`) består av: `<BoardMobileSheet />` + `<div className="fixed inset-x-0 bottom-0 z-50"><BottomPlayer /></div>`
  - Behold `useIsDesktop()` og overflow-lock-effekten

**Patterns to follow:**
- `vaul`-Drawer-bruk i nåværende `BoardMobileSheet.tsx:1-50` (oppsett av `Drawer`/`DrawerPortal`)
- Sibling-mounting-mønster fra dagens `BoardCategoryTabBar`-mounting i scaffold (`fixed inset-x-0 bottom-0 z-50`)
- Hold kommentarer minimale, dokumenter kun snap-valg og BottomPlayer-mounting-årsak

**Execution note:** Sjekk visuelt på 375px-viewport mellom hver større endring — vaul portal-rendering er vanskelig å feilsøke uten å se det.

**Test scenarios:**
- Happy path: Side-load på 375px → sheet synlig på peek-stage, kart synlig over sheet, hero-illustrasjon-peek synlig nederst
- Happy path: Dra sheet opp → snapper til full, alle BoardScrollPanel-content synlig (hero + index + kategori-kort + karaoke)
- Happy path: Spor aktiv (start tour via hero-play) → BottomPlayer synlig som sticky-bottom over sheet, både i peek og full
- Happy path: Pause spor / lukk tour → BottomPlayer fjernes (phase=idle/ended → returnerer null)
- Edge case: Sheet i full + bruker scroller content til bunn → BottomPlayer dekker ikke siste content-rad (sjekk padding-bottom)
- Integration: Karaoke-tekst rendres ord-for-ord med samme oppførsel som desktop når sheet er i full
- POI placeholder: Tap på POI-chip i kategori-kort → ingen JS-feil, ingen state-endring, ingen visuell respons (no-op)
- Test expectation: Ingen vitest-test for selve sheet-en (vaul-portal-rendering brittle å teste). Manuell QA i 2D + 3D-modus på 375px.

**Verification:**
- Manuell test på `localhost:3002` (worktree-port) ved 375px-bredde i Chrome DevTools mobile emulation
- Skjermbilder for peek + full + spor-aktiv tatt og verifisert
- `npm run lint && npx tsc --noEmit` passerer

---

- [ ] **Unit 3: Slett legacy mobile-filer + `BoardPOIDetails`**

**Goal:** Fjern alle dead-code-filer nå som ny `BoardMobileSheet` ikke lenger refererer dem.

**Requirements:** R3

**Dependencies:** Unit 2 (sletteable filer må først være uten consumere)

**Files:**
- Delete: `components/variants/report/board/mobile/BoardCategoryTabBar.tsx`
- Delete: `components/variants/report/board/mobile/BoardPunkterAccordion.tsx`
- Delete: `components/variants/report/board/mobile/BoardTabs.tsx`
- Delete: `components/variants/report/board/mobile/BoardLiveTransport.tsx`
- Delete: `components/variants/report/board/BoardPOIDetails.tsx`

**Approach:**
- Før sletting: kjør `grep -rn "<filename>"` på hver fil for å bekrefte 0 consumers utenfor mobile-folder etter Unit 2-endringene
- Slett filene
- Verifiser `npm run build` og `npx tsc --noEmit` passerer

**Patterns to follow:**
- CLAUDE.md "Kodebase-hygiene": umiddelbar slett, ingen kommenterte blokker bevart

**Test scenarios:**
- Test expectation: none — pure file deletion. Verifikasjon er at build/typecheck/lint passerer og at app fungerer som etter Unit 2.

**Verification:**
- Grep bekrefter 0 referanser til hver slettet fil
- `npm run build` passerer (Next.js bygger uten broken imports)
- `npm run lint` passerer
- `npx tsc --noEmit` passerer
- Manuell smoke-test på 375px viewport: side laster, sheet fungerer, ingen console-feil

## System-Wide Impact

- **Interaction graph:** `BoardMobileSheet` har ingen subscribers utenfor sin egen render-tree etter rewrites. `BoardPOIDetails`-konsumere er kun de mobile-filene som slettes. `BoardScrollPanel` får én ny prop med default — bakoverkompatibel.
- **Error propagation:** Ingen endring i error-flyt. Audio-tour-feilstander rendres av `BottomPlayer`s `ActiveState` som-er; den nye scaffold-wrappingen påvirker ikke phase-logikk.
- **State lifecycle risks:** Vaul portal-rendring + `useIsDesktop()`-mounting/unmounting ved breakpoint-bytte i live session må verifiseres — ny sheet skal mountes/unmountes cleanly ved resize fra desktop til mobile og motsatt. Eksisterende `BoardScaffold` håndterer dette via `useIsDesktop()`; ingen ny logikk legges til.
- **API surface parity:** Ingen API-endringer eksponert eksternt. `BoardScrollPanel` får én ny intern prop.
- **Integration coverage:** Manuell QA på begge breakpoints (375px og 1280px+) bekrefter at scaffold-logikken fortsatt mountede riktig tre per viewport.
- **Unchanged invariants:** Desktop-arkitektur (`BoardDesktopShell` + `BoardScrollPanel`-content) er uendret. Kart-komponenter er uendret. Audio-tour-state og karaoke-rendering er uendret. `BoardScrollPanel`-default-rendring (uten den nye prop-en) gir identisk output som før.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Vaul-portal + `fixed`-positioned `BottomPlayer`-sibling kan ha z-index-konflikter (sheet portal mountes til document.body, sibling er også høyt) | Test eksplisitt på enhet; juster z-indices hvis sheet-content havner over player. Player z-50 + sheet vaul-default bør være kompatibelt. |
| Sletting av `BoardLiveTransport` fjerner live transport-widget fra POI-flyt | Akseptabel — POI-detalj-flyt på mobil er deferred; live transport kommer tilbake hvis behovet rekursurer |
| `BoardScrollPanel` rendret ved 375px har ikke vært designet for det opprinnelig | Skjermbilder fra ce-brainstorm viser at det fungerer essensielt as-is; eventuelle små styling-pip ses ved manuell QA og fikses ad-hoc |
| `useIsDesktop()` har en initial false → true flip-render som kan blinke mounting/unmounting | Eksisterende oppførsel; ikke regrediert av denne planen. Hvis det blir vist å være et problem, fikses i egen runde med SSR-safe media query. |

## Documentation / Operational Notes

- Ingen docs-oppdateringer trengs (intern refactor)
- `PROJECT-LOG.md`-entry etter merge: kort note om at legacy mobile-stack er slettet og at mobile gjenbruker desktop scroll-panel. Skjermbilder før/etter inkluderes.
- Ingen feature-flag eller staged rollout — dette er en spike på worktree-branch (`feat/board-narrativ-spike`)

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-21-mobile-board-sheet-requirements.md](../brainstorms/2026-05-21-mobile-board-sheet-requirements.md)
- **Forrige requirements i samme spike:** [docs/brainstorms/2026-05-21-sidebar-spotify-anatomi-requirements.md](../brainstorms/2026-05-21-sidebar-spotify-anatomi-requirements.md)
- **Spike-brainstorm:** [docs/brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md](../brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md)
- **Eksisterende plan i samme spike:** `docs/plans/2026-05-21-feat-sidebar-spotify-anatomi-plan.md` (parallell, ikke avhengig)
