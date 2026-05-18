---
title: Rapport-board helhetlig narrativ + audio-tour modus
type: feat
status: active
date: 2026-05-18
origin: docs/brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md
---

# Rapport-board helhetlig narrativ + audio-tour modus

## Overview

Rapport-boardet (eiendom-produkt) bytter fra **kategori-paginering med rik per-kategori-tekst + inline POI-cards** til **én helhetlig scroll med slank pitch-tekst per kategori-seksjon, scroll-drevet kart-pin-veksling, og audio-tour som modus-toggle mellom manuell og auto-scroll fortelling**. POI-detaljer løsrives til et overlay som åpnes ved markør-klikk. Build-time pitch-tekst-pipeline genererer ~60-90-ords narrativ per kategori basert på eksisterende Gemini-grounding.

Refactoret må stå på egne ben i to varianter:
- **Minimum-viable (audio off)** — slank pitch + pins + overlay må alene være bedre enn dagens detalj-tunge versjon
- **Media-rich (audio on)** — opt-in lag som forsterker, ikke fundamentet

**Eksekverings-strategi: spike-first.** Plan-execution starter med **Unit 0 (walking-skeleton spike)** i worktree-isolert gren før noen av Unit 1-7 startes. Spiken validerer KD1 (scroll-tracking-mekanikk) og KD2 (slank-pitch-premiss) mot ekstern bruker (Propr/BaneNor) på en Vercel-preview-URL — uten å touche `main` eller build-time-pipelinen. Positiv signal → kontinuer til Unit 1. Negativ signal → forkast worktree-grenen, åpne KD1/KD2 på nytt. Spike-koden carry-forwarder som baseline for Unit 2-3 hvis validert.

## Problem Frame

Dagens board har en *referansebok-arkitektur* (kategori-pagineing, lead+body+disclosure, opp til 47 POI-cards). Tre samtidige smerter motiverte re-tenkningen (se origin):
1. Editorial-skalering — kurering skalerer ikke til Propr-pilots 1700 listinger/år
2. Kvalitetsbar paralyserer — demos føles evig WIP
3. Bruker-overload + audio-mismatch — to konkurrerende modaliteter kjemper om plass

Gemini-eksperiment viste at slank "for deg som"-pitch (60-90 ord) føles komplett uten POI-card-krykker. Audio-tour-pilot avdekket at narrativ-modus flyter ikke med dagens UI.

## Requirements Trace

Sporbar til origin-brainstormens R1–R17 og KD1–KD8:

- R1–R5b (Board-struktur): én scroll, slank pitch, scroll-tracking, Hjem-kart-state → **Unit 2, Unit 3, Unit 4**
- R6–R10b (Audio-modus): top + per-kategori play, snap-per-track, mid-tour, source-of-truth split-brain, end-of-tour → **Unit 6**
- R11–R14 (POI-overlay): marker-click, states, dismiss-regler, mobil-pattern → **Unit 5**
- R15–R17 (Innhold-pipeline): pitchText additivt, lead/body retention, to renderinger fra én kilde → **Unit 1**
- KD1: scroll-tracking *bygges nytt* → **Unit 2**
- KD2 + KD7: slank-tekst + ekstern validering før irreversibel sletting → **Unit 1 + Unit 7 (delayed deletion)**
- KD3: play-knapp som modus-toggle → **Unit 6**
- KD4: POI-overlay over inline cards → **Unit 5**
- KD5: én kilde-grounding, to renderinger → **Unit 1**
- KD6: 1-2 timer er edit-target, ikke skalering → **Unit 1 (null-touch-default)**
- KD8: Audio er én av tre uavhengige ambisjoner → **alle units; Unit 7 verifiserer at audio-off er bedre enn dagens**

## Scope Boundaries

- **Kun rapport-board (eiendom).** Explorer, Guide, Hotel/Næring/Adresse forblir uendret.
- **Norsk-only.** Engelsk audio + tekst kan komme senere.
- **Ingen runtime LLM eller TTS** — alt build-time per CLAUDE.md.
- **Ingen admin-UI** for å redigere pitch-tekst eller styre seksjoner.
- **POI-overlay KUN klikk-fra-markør-drevet i pilot** — ingen "Se alle 47"-CTA, ingen master-liste.
- **Ingen URL-state for scroll-posisjon eller åpen POI** — refresh tar deg til toppen.
- **`audioTourEnabled`-flag respekteres** — non-audio-prosjekter får manuell scroll-modus uten play-knapper.
- **Audio-tour iOS Safari autoplay-mekanikk** er allerede løst i forrige brainstorm (2026-05-16) — denne planen rør ikke `<audio>`-element-håndtering eller iOS-unlock-pattern.

### Deferred to Separate Tasks

- **Manus-curatering for 6 gjenværende kategori-audio på StasjonsKvartalet** (~4-6 timer): defer til etter pilot-feedback fra Propr.
- **Professional Voice Cloning (PVC)**: defer til etter kommersiell pilot-signing.
- **Engelsk language-track**: defer til separat brainstorm hvis Hurtigruten/Havila-segment etterspør.

## Context & Research

### Relevant Code and Patterns

**Scroll-tracking referansemønster:**
- `lib/hooks/useActiveSection.ts` — IntersectionObserver med `intersectionRect.height`-arbitration (NB: ikke `intersectionRatio`), `refCount` for re-init når sections mounter/unmounter, debounce 200ms `leading: true`. Trenger root-parameter for board-container.

**Board-arkitektur:**
- `components/variants/report/board/board-state.tsx` — 3-fase machine (`default | active | poi`). Phases simplifiserer i denne planen.
- `components/variants/report/board/board-data.ts` — `adaptBoardData`, branded id-typer (`BoardCategoryId`, `BoardPOIId`).
- `components/variants/report/board/ReportBoardPage.tsx` — entry-point, `h-screen overflow-hidden`-shell.
- `components/variants/report/board/desktop/BoardDesktopShell.tsx` — 480px strip (Rail 80px + Panel 400px).
- `components/variants/report/board/desktop/BoardRail.tsx` — kategori-ikoner.
- `components/variants/report/board/desktop/BoardDetailPanel.tsx` — dagens panel (slettes/erstattes).
- `components/variants/report/board/mobile/BoardMobileSheet.tsx` — Vaul Drawer, snap-points `["96px","320px",0.5,1]`, phase-rendered.
- `components/variants/report/board/BoardCategoryInfoTab.tsx` — dagens "rich content"-renderer (Beligenhet-tab).
- `components/variants/report/board/BoardMap.tsx` — `visiblePOIs` derives fra `state.phase`/`activeCategoryId`.
- `components/variants/report/board/BoardMarker.tsx` — Mapbox-marker, klikk dispatcher `OPEN_POI`.

**Audio-tour:**
- `components/variants/report/board/audio-tour/use-audio-tour-sync.ts` — to-veis sync med `lastDispatchSource`-ref-pattern.
- `components/variants/report/board/audio-tour/PlayerBanner.tsx` — sticky-top chrome.
- `components/variants/report/board/audio-tour/StartTourButton.tsx` — Home-fase CTA.
- `lib/stores/audio-tour-store.ts` — Zustand ephemeral store, `phase`, `pauseReason`. Mangler `mode`-flag i dag.
- `components/variants/report/board/audio-tour/tour-mode.css` — `[data-tour-active]` dimmer `[data-board-body]`.

**Content-pipeline kanonisk mønster:**
- `scripts/audio-manus-write.ts` — `prepare`/`apply` subkommandoer, `.audio-staging/<pid>/`-staging, optimistic lock via PostgREST `updated_at=eq.X`, deep-merge PATCH, `ALLOWED_REPORTCONFIG_KEYS`-whitelist.
- `lib/audio-tour/manus.ts` — pure validators (`validateManus`, `countWords`, `findBannedWords`).
- `lib/audio-tour/manus-prompt.ts` — Claude Code-skill prompt-bygger.
- `lib/gemini/grounding.ts` — build-time Gemini-grounding-pattern.

**Types & data:**
- `lib/types.ts:280-361` — `ReportConfig`, `ReportThemeConfig`, `audioTourEnabled`, `audioVersion`. **`heroIntro: string` finnes allerede** på `ReportConfig`.
- `components/variants/report/report-data.ts` — `transformToReportData`, `getReportThemes`.

### Institutional Learnings

- **`docs/solutions/feature-implementations/report-scroll-synced-sticky-map-20260208.md`** — den foundational scroll-→-map-dispatch-pattern. **Direkte applikabel** for board (selv om Report siden forlot den).
- **`docs/solutions/ui-bugs/report-subsection-markers-layout-overlap-20260210.md`** — IntersectionObserver-arbitration på `intersectionRect.height`, ikke `intersectionRatio`. Kritisk for store seksjoner.
- **`docs/solutions/feature-implementations/report-map-popup-card-20260213.md`** — source-discriminator-pattern (`{ source: "card" | "marker" }`). Direkte presedens for vår audio/scroll/marker source-discriminator.
- **`docs/solutions/architecture-patterns/report-kart-per-kategori-modal-20260409.md`** — Reports pivot vekk fra sticky-map til per-kategori-modal. **Conflict-flag**: vi bygger sticky-map *igjen* for board fordi produkttypene er ulike (board = utforskning, Report = lineær-lesning). Bevisst valg, ikke autopilot.
- **`docs/solutions/api-integration/gemini-grounding-pattern-20260418.md`** — kanonisk build-time content-gen-pattern. Følg samme golden pattern for pitchText (Zod-literal version, deep-merge PATCH, `revalidateTag`).
- **`docs/solutions/ui-patterns/apple-style-slide-up-modal-with-backdrop-blur-20260415.md`** — Mobile POI-overlay MÅ bruke `Sheet`/`SheetContent`, IKKE `Dialog` (close-animasjon feiler stille i Dialog).

### External References

Ingen — internt UX-arbeid med veletablerte interne mønstre.

## Key Technical Decisions

- **KD-Plan-1: Source-discriminator på SELECT_CATEGORY-dispatch.** Action-shape blir `{ type: "SELECT_CATEGORY", id, source: "scroll" | "audio" | "rail" }`. Reducer eier `activeCategoryId` (master), audio-tour-store eier `mode + trackIndex`. Subscribers leser kun `activeCategoryId`. Forhindrer split-brain. Mønster fra POI-popup-card-løsning.
- **KD-Plan-2: Audio er source-of-truth for kart-pin/sidebar i split-brain-state.** Når `mode === "autoscroll"` og bruker har scrollet bort fra audio-track, fortsetter `activeCategoryId` å følge audio-spor (dispatched with `source: "audio"`). Scroll-tracking pauses sin egen dispatch under autoscroll, men starter igjen ved manuell modus eller bruker-scroll-takeover.
- **KD-Plan-3: pitchText er nytt additivt felt på `ReportConfig.themes[]`.** Ikke erstatt `leadText` — beholdt som inert data for rollback (R15b/KD7). Schema bumpes med `pitchTextVersion: z.literal(1)` separat fra `groundingVersion` og `audioVersion`.
- **KD-Plan-4: Scroll-tracking-hook gjenbruker `useActiveSection`-mønsteret men parameteriserer `root`.** Ny `lib/hooks/useBoardActiveSection.ts` ELLER `useActiveSection` får valgfri `root?: HTMLElement | null`-parameter. Andre alternativet er enklere, men risikerer regresjon i Report-laget. Anbefaling: ny hook (`useBoardActiveSection`), kopier observer-shape eksplisitt.
- **KD-Plan-5: `OPEN_POI`-dispatch beholdes som primær vei til POI-overlay.** Markør-klikk → `OPEN_POI` → `state.phase === "poi"` → render `POIOverlay`-komponent. Holder dispatch-modellen intakt, gjenbruker eksisterende `BoardPathLayer` + `BoardPOILabel` som triggers på `phase === "poi"`.
- **KD-Plan-6: 3-fase machine forenkles til 2-fase (`default | poi`).** "active" forsvinner siden scroll alltid har en aktiv kategori. `activeCategoryId` er nå alltid satt (default = første kategori eller "home"). `phase === "poi"` aktiveres kun ved `OPEN_POI`.
- **KD-Plan-7: BoardMobileSheet får ny phase eller utvidet content-rendering for continuous-scroll.** Ikke stacked Drawer for POI-overlay — bruk eksisterende phase-pattern (`phase === "poi"` rendrer overlay-state innenfor samme sheet, ikke ny Drawer-instans). Hver phase har egen scroll-container.
- **KD-Plan-8: pitchText-CLI er separat fra audio-manus-CLI.** Selv om de deler grounding-input, kjøres `npx tsx scripts/pitch-write.ts prepare/apply <pid>` separat før `audio-manus-write.ts`. Audio-manus kan bruke pitchText som input via `prevTrackSummary`-pattern. Holder konsernene atskilt.

## Open Questions

### Resolved During Planning

- **Tekstgenererings-prosess (origin Open Question):** Følger `audio-manus-write.ts`-mønster — CLI prepare/apply + Claude Code-skill for manus-skriving. Build-time, reproduserbart.
- **`heroIntro`-felt-eksistens:** Bekreftet eksisterer på `ReportConfig` (lib/types.ts:342). R16 bruker dette feltet direkte; ingen nytt felt nødvendig for elevator-pitch.
- **`pitchText` vs erstatte `lead`/`body`:** Additivt nytt felt. Beholder `lead`/`body` som inert data for rollback. Per KD7.
- **Audio-vs-scroll source-of-truth:** Audio vinner i split-brain (KD-Plan-2). Mønster: source-discriminator på dispatch.

### Deferred to Implementation

- **Eksakt rute for fjerning av `useSubCategoryFilter`-state:** Slett helt vs behold for kart-pin-filtrering. Avgjøres i Unit 7 etter Unit 3 viser om sub-filter har bruk i continuous-scroll-modus.
- **Sub-category-pattern fra `report-subcategory-splitting-20260210.md`:** Hvis board får sub-kategorier i fremtiden, kommer dette opp igjen. Per nå: ikke implementer composite-key-pattern.
- **Eksakt API-form for pitch-genereringsprompt:** Følger `lib/audio-tour/manus-prompt.ts`-form men spesifikk prompt-tekst skrives i Unit 1.
- **Mapbox `flyTo`/`fitBounds` ved scroll-driven kategori-bytte:** Skal kameraet flytte seg per kategori-bytte under scroll, eller forbli statisk? `BoardMap.tsx` har eksplisitt "ingen phase-drevne camera-moves"-kommentar i dag. Sannsynligvis: subtilt `fitBounds` til kategoriens pins ved scroll-tracking-dispatch. Beslutning i Unit 3.
- **`scroll-snap` CSS vs imperativ JS-snap:** Snap-per-track for autoscroll kan implementeres som CSS `scroll-snap-type: y mandatory` på container + `scroll-snap-align: start` på seksjoner. Avgjøres i Unit 6 etter Unit 2 har scroll-container-shape.
- **Hjem-seksjon kart-state implementering:** Når Hjem er aktiv: skjul kategori-pins, behold prosjekt-pin, zoom til nabolagsnivå. Eksakt zoom-nivå + transition-tuning i Unit 3.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### State-koordinering (master/slave med source-discriminator)

```
                  ┌──────────────────────────┐
                  │  BoardContext (master)   │
                  │  - activeCategoryId      │
                  │  - phase: "default"|"poi"│
                  └──────────┬───────────────┘
                             │ subscribes
        ┌────────────────────┼───────────────────┐
        │                    │                   │
        ▼                    ▼                   ▼
  ┌──────────┐         ┌──────────┐        ┌──────────┐
  │ BoardMap │         │ Rail     │        │POIOverlay│
  │ (visible │         │(highlight│        │ (when    │
  │  pins)   │         │ active)  │        │ phase=poi│
  └──────────┘         └──────────┘        └──────────┘

  Dispatchers (with source-discriminator):
  ┌─────────────────┐  source: "scroll"
  │ useBoardActive  │──────────────────────┐
  │ Section hook    │                      │
  └─────────────────┘                      ▼
                                  ┌──────────────────┐
  ┌─────────────────┐             │ SELECT_CATEGORY  │
  │ useAudioTourSync│  "audio"    │ { id, source }   │
  │ (when mode=auto)│────────────▶│                  │
  └─────────────────┘             └──────────────────┘
                                          ▲
  ┌─────────────────┐  "rail"             │
  │ Rail click      │─────────────────────┘
  └─────────────────┘
```

### Audio-tour mode-toggle state-machine

```
   manual mode                autoscroll mode
   ┌─────────┐    play         ┌──────────────┐
   │ idle    │────────────────▶│ playing      │
   └─────────┘                 │ (autoscroll  │
        ▲                      │  drives      │
        │                      │  scroll)     │
        │ close/end            └──────┬───────┘
        │                             │
        │                  user scroll│ (autoscroll
        │                             │  pauses,
        │                             │  audio cont.)
        │                             ▼
        │                  ┌──────────────────┐
        │                  │ split-brain      │
        │                  │ (audio=truth for │
        │                  │  pin/sidebar)    │
        │                  └──────┬───────────┘
        │                         │ "Tilbake til lyden"
        │                         │  pill click
        │                         ▼
        │                  (snap back to       
        │                   audio position →
        │                   autoscroll resumes)
        └───────────────── pause
```

### Build-time pipeline-ordre

```
1. Gemini-grounding (existing)        scripts/<grounding-CLI>
       │
       ▼
2. PitchText generation (NEW)         scripts/pitch-write.ts prepare → skill → apply
       │ (uses grounding as input)
       ▼
3. Audio-manus (existing, now uses    scripts/audio-manus-write.ts prepare → skill → apply
   pitchText as prevTrackSummary)
       │
       ▼
4. ElevenLabs TTS build (existing)    scripts/audio-tour-build.ts
```

## Implementation Units

- [ ] **Unit 0: Walking-skeleton spike (worktree-isolert UX-premiss-validering)**

**Goal:** Etabler en demoable prototype som validerer KD1 (scroll-tracking) og KD2 (slank-pitch føles komplett) FØR vi investerer i Unit 1-7. Worktree-isolert, Vercel-preview-shippable, reverterbar ved å forkaste grenen.

**Requirements:** KD1, KD2, KD8 (audio-off-minimum-viable). Validerer Root α (audio som passenger, ikke driver) og Root β (slank-pitch-hypotesen) fra brainstormens review-loop mot ekstern bruker før vi går videre.

**Dependencies:** Ingen. Bruker eksisterende `theme.leadText`/`body` som stub for pitch-tekst (Unit 1 introduserer dedikert `pitchText`-felt etter spike er validert).

**Files:** *(Worktree-grenede endringer på `feat/board-narrativ-spike` — IKKE merget til `main` før validering. Hvis spike validert, carry-forwarder filene til Unit 2-3; hvis forkastet, slettes hele grenen.)*
- Worktree: `git worktree add ../placy-ralph-board-spike -b feat/board-narrativ-spike` + `scripts/setup-worktree.sh`
- Create: `lib/hooks/useBoardActiveSection.ts` (samme shape som Unit 2 spec — denne carry-forwarder hvis validert)
- Create: `components/variants/report/board/desktop/BoardScrollPanel.tsx` (minimal-versjon: Hjem + kategori-seksjoner med trimmet `leadText`/`body` som stub-tekst + scroll-driven kart-pin-veksling)
- Modify: `components/variants/report/board/desktop/BoardDesktopShell.tsx` (renderer `BoardScrollPanel` istedenfor `BoardDetailPanel` i `phase === "default"`)
- Modify: `components/variants/report/board/BoardMap.tsx` (visiblePOIs derives fra `activeCategoryId` i `default`-fase)
- Modify: `components/variants/report/board/board-state.tsx` (source-discriminator på SELECT_CATEGORY — minimum subset av Unit 2)

**Approach:**
- **I scope:** desktop, StasjonsKvartalet, audio-OFF-modus, scroll-driven kart-pin-veksling, slank-tekst-stub i seksjoner
- **Hopper over:** mobile (Unit 4), POI-overlay (Unit 5), audio-tour-modus-toggle (Unit 6), pitchText-pipeline (Unit 1), legacy-cleanup (Unit 7), full test-coverage
- **Stub-data:** Bruk eksisterende `theme.leadText` + `body` som seksjons-tekst. Hvis lengste seksjon er >~100 ord, lag en manuell trimmet versjon i Supabase JSONB (PATCH via curl) for å matche slank-pitch-premissen. Ingen pitchText-felt opprettes ennå.
- **Audio-off:** Sett `audioTourEnabled: false` midlertidig i Supabase under spike (eller bare la audio-tour-store ligge uberørt — komponentene rendres bare når flag er true)
- **Dev-port:** Worktree kjører på `PORT=3001 npm run dev` per memory-konvensjon
- **Deploy:** Vercel auto-deployer preview-URL ved push til `feat/board-narrativ-spike`. Preview er demonstrerbar uten å touche `main`.
- **Ekstern delivery:** Send preview-URL + kort loom-video (~30 sek) til Kjetil/Karoline (Propr) og/eller Mathias (BaneNor Eiendom). Be om skriftlig respons + 15-min oppfølgings-samtale hvis svaret er tvetydig.
- **Tilbakemelding-vindu:** Maks 3-5 dager før beslutning om å fortsette eller revertere.

**Execution note:** Dette er en spike — kvalitets-baren er "demoable + reversible", ikke "produksjonsferdig". OK å skip-tester her hvis det forsinker validering. Hvis spike validert, carry-forwarder koden som baseline for Unit 2-3 (de blir "harden + extend"-units i stedet for "create"). Hvis ikke validert, forkast `feat/board-narrativ-spike` og oppdater `docs/strategy/LOG.md` med læringen.

**Patterns to follow:**
- `lib/hooks/useActiveSection.ts` — observer-shape (kopier, ikke importer)
- `components/variants/report/board/desktop/BoardDetailPanel.tsx` — eksisterende panel-shell (referanse for hva spike erstatter midlertidig)
- `docs/solutions/feature-implementations/report-scroll-synced-sticky-map-20260208.md` — scroll-→-map-dispatch-pattern

**Test scenarios:**
- *Manuelt happy path:* Scroll i BoardScrollPanel → kart-pins veksler korrekt mellom kategorier på Stasjonskvartalet.
- *Manuelt happy path:* Klikk på rail-ikon scroller til riktig seksjon.
- *Manuelt edge case:* Hjem-seksjon i view → kart skjuler kategori-pins, viser kun prosjekt-pin.
- *Ekstern validering:* Minst én ekstern bruker (Kjetil/Karoline/Mathias) får preview-URL og responderer skriftlig.

**Verification:**
- Vercel-preview-URL deploys uten build-errors.
- Manuell smoketest på worktree dev-server bekrefter scroll + kart-sync på Stasjonskvartalet.
- Ekstern bruker har respondert innen 5 dager. **Beslutningsgate:**
  - ✅ **Positive signaler** (≥1 av: "ja det er bedre", "føles komplett uten cards", "audio kan ridde-along") → continue til Unit 1 med spike-kode som baseline
  - ❌ **Negative signaler** (≥1 av: "savner detaljene", "for tynt", "skjønner ikke kart-vekslingen") → STOP. Forkast worktree-grenen. Reopen brainstorm KD1/KD2.
- Uansett utfall: oppdater `docs/strategy/LOG.md` med konkret tilbakemelding (sitat hvis mulig) og beslutning.

---

- [ ] **Unit 1: pitchText pipeline (build-time CLI + skill + types)**

**Goal:** Etablerer den build-time-genererte pitch-tekst-pipelinen. Nytt `pitchText`-felt på `ReportConfig.themes[]` og `reportConfig.heroIntroPitch` (eller eksisterende `heroIntro` overstyres via prompt). CLI-mønstret følger `audio-manus-write.ts`.

**Requirements:** R15, R15b, R16, R17, KD-Plan-3, KD-Plan-8

**Dependencies:** Ingen (uavhengig av frontend-units)

**Files:**
- Create: `scripts/pitch-write.ts`
- Create: `lib/pitch-text/manus.ts` (pure validators)
- Create: `lib/pitch-text/prompt.ts` (Claude Code-skill prompt-bygger)
- Test: `lib/pitch-text/manus.test.ts`
- Modify: `lib/types.ts` (add `pitchText?: string` to `ReportThemeConfig`; add `pitchTextVersion?: 1` to `ReportConfig`)
- Modify: `scripts/audio-manus-write.ts` (extend `ALLOWED_REPORTCONFIG_KEYS` Set til å inkludere `pitchTextVersion` slik at audio-manus-PATCH ikke avbryter på "ukjent reportConfig-nøkkel" når pitch-versjonen er satt)
- Modify: `scripts/gemini-grounding.ts` (samme whitelist-utvidelse som over)
- Modify: `components/variants/report/report-data.ts` (project `pitchText` into `ReportTheme.pitchText`)
- Modify: `components/variants/report/board/board-data.ts` (project `pitchText` into `BoardCategory.pitchText`)

**Approach:**
- CLI subkommandoer `prepare <pid>` og `apply <pid>` analogt med `audio-manus-write.ts`
- `prepare` skriver per-tema `.pitch-staging/<pid>/<themeId>.context.json` med `system_prompt + user_prompt + input_text` (grounding + lead/body som input)
- Claude Code-skill leser `.context.json`, skriver `.pitch.md` per tema (60-90 ord, "for deg som"-narrativ-stil)
- `apply` validerer ordtelling, banned-words (gjenbruk fra `lib/audio-tour/manus.ts`-mønster), deep-merge PATCH med optimistic lock
- Pure-function-modul `lib/pitch-text/manus.ts` mirroreer `lib/audio-tour/manus.ts`-shape
- Felles `BANNED_WORDS_RX` med audio-manus (TTS-stedsnavn-redusjon kommer senere i en separat audio-rendering)
- Cache-bust: `pitchTextVersion: z.literal(1)`-bump + `revalidateTag(\`product:${customer}_${slug}\`)`

**Execution note:** Start med å skrive pure-function-testene først (`manus.test.ts`) — pipelinen er enkel å test-first siden mønsteret er etablert i audio.

**Patterns to follow:**
- `scripts/audio-manus-write.ts` — CLI-struktur, prepare/apply-flyt, deep-merge PATCH, whitelist-validering
- `lib/audio-tour/manus.ts` — pure-function-skill (validateManus, countWords, findBannedWords, stripWrappingQuotes)
- `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md` — Zod-literal-version, deep-merge, `revalidateTag`

**Test scenarios:**
- *Happy path:* Validere pitch-tekst på 70 ord uten banned-words → returns success.
- *Edge case:* Pitch på 34 ord → returns error (under minimum 35).
- *Edge case:* Pitch på 91 ord → returns error (over max 90).
- *Edge case:* Pitch med leading/trailing quotes (`"Drømmer du..."`) → `stripWrappingQuotes` rensker korrekt.
- *Error path:* Pitch med banned-word ("ekstremt") → returns error med ordet identifisert.
- *Integration:* `apply`-kommando med stale `updated_at` → PATCH feiler med 409, CLI rapporterer optimistic-lock-konflikt og avbryter.
- *Integration:* `apply` på et prosjekt uten eksisterende `themes[].pitchText` → deep-merge legger til feltet, eksisterende `lead`/`body` urørt.

**Verification:**
- `npx tsx scripts/pitch-write.ts prepare banenor-eiendom_stasjonskvartalet` produserer `.pitch-staging/banenor-eiendom_stasjonskvartalet/*.context.json` for hver kategori.
- Etter manuell skill-kjøring av `.pitch.md`-filer, `npx tsx scripts/pitch-write.ts apply banenor-eiendom_stasjonskvartalet` PATCHer `reportConfig.themes[].pitchText` og bumper `pitchTextVersion` til 1.
- Verifiser via Supabase REST at feltene er populert og gamle `leadText`/`upperNarrative` er urørt.

---

- [ ] **Unit 2: Board scroll-tracking hook + source-discriminator dispatch**

**Goal:** Bygger den nye scroll-tracking-mekanikken for board-laget basert på `useActiveSection`-mønster med eksplisitt root-parameter. Innfører source-discriminator på `SELECT_CATEGORY`-dispatch.

**Requirements:** R5, KD1, KD-Plan-1, KD-Plan-4, KD-Plan-6

**Dependencies:** Ingen — foundation for Units 3, 4, 6

**Files:**
- Create: `lib/hooks/useBoardActiveSection.ts`
- Test: `lib/hooks/useBoardActiveSection.test.ts`
- Modify: `components/variants/report/board/board-state.tsx` (SELECT_CATEGORY action får `source: "scroll" | "audio" | "rail"`, fjern "active"-fase, default-state har `activeCategoryId` satt)
- Test: `components/variants/report/board/board-state.test.tsx`

**Approach:**
- Hook-signatur: `useBoardActiveSection(rootRef: RefObject<HTMLElement | null>, initialCategoryId: BoardCategoryId | null) => { activeCategoryId, registerSectionRef }`
- IntersectionObserver med `threshold: [0, 0.5, 1.0]` og `root: rootRef.current`
- Arbitration på `intersectionRect.height` (per institutional learning #2)
- `refCount` for re-init når seksjoner mounter/unmounter
- Debounce 200ms med `leading: true` (gjenbruk `use-debounce`)
- Bevarer at scroll-dispatch ikke kjøres når audio-tour-store har `mode === "autoscroll"` og `isAutoscrollPaused === false` (audio er source-of-truth da)
- BoardContext-reducer: SELECT_CATEGORY-action får `source`-felt; reducer logger source for debug men setter ikke fase-bytte (fasene simplifiseres parallelt)
- Fase-machine: `default` (scroll-modus) og `poi` (overlay åpen). Tidligere "active"-fase fjernes. `activeCategoryId` er alltid satt.

**Execution note:** Test-first for hook-en — observer-mocking + scroll-trigger-test er mer pålitelig enn manuell verifisering.

**Patterns to follow:**
- `lib/hooks/useActiveSection.ts` (artikkel-lag) — kopier observer-shape, ikke importer
- `components/variants/report/board/audio-tour/use-audio-tour-sync.ts` — `lastDispatchSource`-ref-pattern for å unngå cyclic dispatch
- `docs/solutions/feature-implementations/report-map-popup-card-20260213.md` — source-discriminator i action-shape

**Test scenarios:**
- *Happy path:* En seksjon scroller inn i view → hook returnerer dens id som `activeCategoryId`.
- *Edge case:* To seksjoner overlapper viewport — hook velger den med høyest `intersectionRect.height`, ikke høyest `intersectionRatio`.
- *Edge case:* Seksjon mounter etter første render → `refCount` trigger observer-re-init.
- *Edge case:* `rootRef.current === null` ved første render → hook returnerer `initialCategoryId` og venter på root.
- *Integration:* Hook dispatcher SELECT_CATEGORY med `source: "scroll"` når scroll-event trigger; rail-klikk dispatcher med `source: "rail"`; reducer aksepterer begge og setter `activeCategoryId`.
- *Integration:* Når `audio-tour-store.mode === "autoscroll"` og autoscroll IKKE er pauset, hook holder seg fra å dispatche (audio er source-of-truth).

**Verification:**
- Manuell test i dev-server: scroll i Storybook-mock eller dummy-board genererer correct `activeCategoryId`-state.
- Reducer-test bekrefter at SELECT_CATEGORY-action med ulik `source` alle setter `activeCategoryId` (source er informational, ikke styrende).

---

- [ ] **Unit 3: One-scroll desktop layout + pitchText-rendering + scroll-driven kart**

**Goal:** Bytter ut `BoardDetailPanel`s kategori-paginerte rendering til én helhetlig scroll-container med kategori-seksjoner, pitchText-rendering, og scroll-driven kart-pin-veksling.

**Requirements:** R1, R2, R3, R4, R5b, KD1, KD2 (delvis), KD8

**Dependencies:** Unit 2 (hook), Unit 1 (pitchText-data i `BoardCategory`)

**Files:**
- Create: `components/variants/report/board/desktop/BoardScrollPanel.tsx`
- Create: `components/variants/report/board/desktop/BoardCategorySection.tsx` (en seksjon = en kategori, registers section-ref)
- Create: `components/variants/report/board/desktop/BoardHomeSection.tsx` (Hjem-seksjon med bolig-hero + område-pitch)
- Create: `components/variants/report/board/desktop/BoardEndCTA.tsx` (siste seksjon, alltid-rendret "Ta kontakt med megler" + "Spill av igjen")
- Modify: `components/variants/report/board/desktop/BoardDesktopShell.tsx` (renderer `BoardScrollPanel` i `phase === "default"`)
- Modify: `components/variants/report/board/BoardMap.tsx` (visiblePOIs derives fra `activeCategoryId` i `default`-fase; Hjem-state skjuler alle kategori-pins, viser kun home-marker zoomet til nabolagsnivå)
- Test: `components/variants/report/board/desktop/BoardScrollPanel.test.tsx`

**Approach:**
- `BoardScrollPanel` er en scrollbar container (`overflow-y-auto h-screen`) som rendrer `BoardHomeSection` → `BoardCategorySection[]` → `BoardEndCTA` i rekkefølge
- Hver seksjon registrerer ref via `useBoardActiveSection`s `registerSectionRef(id)`
- Container-ref pekes til `useBoardActiveSection` som root
- `BoardCategorySection` viser: kategori-tittel, kategori-illustrasjon (eksisterende `category.illustration`), `pitchText` (ny, fra Unit 1), play-knapp (kun når `audioTourEnabled === true` og `category.audio` finnes — fra Unit 6 conditionalt)
- Ingen "Les mer"-disclosure (sletter `BoardCategoryInfoTab`-rendering av disclosure)
- `BoardHomeSection` rendrer dagens hero (illustrasjon, prosjektnavn, konseptlinje) PLUS `boardData.home.heroIntro` som elevator-pitch (~70 ord)
- `BoardMap.tsx`: når `activeCategoryId === null` (eller `null`-marker for Hjem-seksjon i view), skjul `categoryPins`, vis bare `HomeMarker`, fitBounds til prosjekt-koordinat. Bruk eksisterende `map.stop()` før `fitBounds()` (per learning #1).
- `data-board-body` attribute settes på pitchText-elementene for at `tour-mode.css` skal dimme dem under audio-tour
- `BoardScrollPanel` setter `data-tour-active="true"` på sin root-section når `audio-tour-store.phase ∈ ("playing", "paused")` (matcher eksisterende `BoardDetailPanel`-atferd som denne komponenten erstatter; uten dette feiler `[data-tour-active] [data-board-body]`-CSS-regelen stille og audio-dim-effekten brytes)
- Token-pattern (fra `BoardPOIAccordion`-mønster) for rAF-throttled scroll-to-section ved rail-klikk

**Execution note:** Karakteriser eksisterende `BoardDetailPanel`-rendering først med en smoketest så vi vet hva som forsvinner.

**Patterns to follow:**
- `components/variants/report/board/BoardCategoryInfoTab.tsx` (eksisterende rich-content-renderer — referanse for tekst-blokker)
- `components/variants/report/board/desktop/BoardPOIAccordion.tsx` (rAF-throttled scroll-token-pattern)
- `docs/solutions/feature-implementations/report-scroll-synced-sticky-map-20260208.md` — `map.stop()` før `fitBounds`, marker-pool, ref-counting

**Test scenarios:**
- *Happy path:* Render `BoardScrollPanel` med 7 kategorier; alle seksjoner renderes i rekkefølge.
- *Happy path:* `data-board-body` finnes på pitchText-elementer.
- *Integration:* Scroll til kategori-3-seksjon → `BoardContext.activeCategoryId === categories[2].id` → `BoardMap` `visiblePOIs` matcher kategori-3 POIs.
- *Integration:* Scroll til `BoardHomeSection` → `activeCategoryId === null`/`"home"` → `BoardMap` skjuler kategori-pins, viser bare HomeMarker.
- *Integration:* Klikk på rail-ikon for kategori-5 → scroll-token dispatcher scroll-to-section, `activeCategoryId` blir kategori-5 med `source: "rail"`.
- *Edge case:* Prosjekt med 0 kategorier (alle filtrert ut) → BoardScrollPanel rendres med kun Hjem-seksjon + EndCTA, ingen feil.

**Verification:**
- Manuell test mot StasjonsKvartalet-prosjekt: scroll igjennom 7 kategorier, kart oppdaterer pins riktig per seksjon.
- Hjem-seksjon viser kun prosjekt-pin.
- Rail-klikk scroller til riktig seksjon.

---

- [ ] **Unit 4: Mobile continuous-scroll (BoardMobileSheet adaptering)**

**Goal:** Adapterer `BoardMobileSheet` til å rendere continuous-scroll content i `phase === "default"` (i stedet for kategori-paginert content). Snap-points justeres for at tab-bar fortsatt er tilgjengelig.

**Requirements:** R1, R3, R4 (mobil-ekvivalent), KD7 (mobile-native)

**Dependencies:** Unit 2, Unit 3 (mobile gjenbruker `BoardCategorySection`-komponenten der mulig, eller har sin egen mobile-variant)

**Files:**
- Modify: `components/variants/report/board/mobile/BoardMobileSheet.tsx`
- Create: `components/variants/report/board/mobile/BoardMobileScrollContent.tsx` (mobile content-rendering for default-phase)
- Modify: `components/variants/report/board/mobile/BoardCategoryTabBar.tsx` (klikk dispatcher SELECT_CATEGORY med `source: "rail"`, scrolls til seksjon innenfor sheet-container; eksisterende phase-bytte fjernes hvis ikke lenger relevant)
- Test: `components/variants/report/board/mobile/BoardMobileSheet.test.tsx` (utvide eksisterende)

**Approach:**
- `phase === "default"` rendrer `BoardMobileScrollContent` (Hjem + kategori-seksjoner + EndCTA innenfor sheet-scroll-container)
- `phase === "poi"` rendrer POI-overlay-state (Unit 5)
- Snap-points: starter på `0.5` (50% høyde, peek per memory) for default; brukeren kan dra til full eller ned til peek (96px). Drag-til-bunn (96px) gjør sheet til "peek-only" så kart er synlig, men beholder scroll-position
- `BoardCategoryTabBar` (z-50 outside sheet) får klikk som scroller til seksjon innenfor sheet-container via scroll-token-pattern
- Mobile scroll-container er sheet-content-innsiden — `useBoardActiveSection` får denne som root
- Drag-down-til-96px erstatter ikke lenger `RESET_TO_DEFAULT`-dispatch (siden default ER scroll-modus); det forblir bare snap-state-bytte uten dispatch

**Patterns to follow:**
- `components/variants/report/board/mobile/BoardMobileSheet.tsx` — phase-rendering pattern, snap-point onSnap-handlers
- Memory: peek som default snap (`feedback_mobile_native_ux`, `docs/strategy/.../mobile-pattern`-konvensjoner)

**Test scenarios:**
- *Happy path:* Mobile render, `phase === "default"` → BoardMobileScrollContent renderes med scroll-container.
- *Integration:* Scroll innenfor sheet → `BoardContext.activeCategoryId` oppdateres → `BoardCategoryTabBar` highlighter aktiv kategori.
- *Integration:* Klikk på `BoardCategoryTabBar`-ikon → sheet-scroll snapper til kategori-seksjon (rAF-throttled scroll-token), `activeCategoryId` blir den valgte med `source: "rail"`.
- *Edge case:* Sheet dratt til 96px-snap → scroll-position bevares, kart er fullt synlig, men board-content er "peeking" øverst.
- *Integration:* Phase-bytte `default → poi` → sheet bytter til POI-overlay-content (testes i Unit 5).

**Verification:**
- Manuell test på mobil emulator: scroll i sheet trigger kategori-highlight i tab-bar.
- Drag-down-til-peek beholder scroll-state.

---

- [ ] **Unit 5: POI-overlay (desktop sidebar + mobile sheet phase)**

**Goal:** Bygger POI-overlay-komponent som åpnes ved markør-klikk. På desktop dekker overlay venstre sidebar; på mobil rendres samme content innenfor `BoardMobileSheet` som ny phase-content. Overlay viser klikket POI på topp + scrollbar liste over andre POIer i samme kategori. Håndterer eksplisitte states.

**Requirements:** R11, R12, R12b, R13, R13b, R14, KD-Plan-5, KD-Plan-7

**Dependencies:** Unit 3 (overlay rendres oppå BoardScrollPanel på desktop), Unit 4 (mobile-phase-pattern)

**Files:**
- Create: `components/variants/report/board/POIOverlay.tsx` (delt mellom desktop og mobile, adaptive via prop eller media query)
- Create: `components/variants/report/board/POIOverlayList.tsx` (filtrert kategori-liste innenfor overlay)
- Modify: `components/variants/report/board/BoardMap.tsx` (klikk på map-bakgrunn dispatcher `BACK_TO_ACTIVE` for å lukke overlay; klikk på annen markør dispatcher `OPEN_POI` med ny id uten close-then-reopen)
- Modify: `components/variants/report/board/desktop/BoardDesktopShell.tsx` (rendrer POIOverlay som overlay over BoardRail + BoardScrollPanel når `phase === "poi"`)
- Modify: `components/variants/report/board/mobile/BoardMobileSheet.tsx` (rendrer POIOverlay-content som `phase === "poi"`-state)
- Test: `components/variants/report/board/POIOverlay.test.tsx`

**Approach:**
- `POIOverlay` mottar `activePOIId` fra `BoardContext`, slår opp full POI fra `boardData.poisById`-Map, slår opp kategori fra `boardData.categories`
- Hero-seksjon: `editorialHook` (hvis fins), `name`, `category.illustration` som fallback om POI mangler `image`, body-tekst
- `POIOverlayList` rendrer alle POI-er i samme kategori (utenom den klikkede); klikk dispatcher `OPEN_POI` med ny id → samme overlay-flate, ny topp-POI (re-render)
- Tilstands-tabell håndteres eksplisitt: single-POI category (skjul liste, vis "Eneste sted i denne kategorien"), missing hero-bilde (fall back til kategori-illustrasjon), fetch-error (vis inline feilmelding innenfor overlay-chrome, ikke modal)
- Desktop dismiss: klikk på map-bakgrunn → `BACK_TO_ACTIVE` (lukker overlay, tilbakefører til default-fase med tidligere `activeCategoryId`). Klikk på annen markør → `OPEN_POI` med ny id, samme phase, bytter fokus uten close-animasjon.
- Mobile dismiss: drag ned fra handle → `BACK_TO_ACTIVE`. Klikk på map-bakgrunn også. Close-knapp i overlay som garantert dismiss-vei.
- Mobile rendering: bruker eksisterende `BoardMobileSheet`-phase-pattern (samme Drawer-instans, content-bytte basert på `phase`). IKKE stacked Drawer per KD-Plan-7.

**Patterns to follow:**
- `components/variants/report/board/mobile/BoardMobileSheet.tsx` (linje 166-215) — cross-fade pattern (`displayedPoiId` lagger en tick bak `state.activePOIId`) for å håndtere POI-bytte uten flicker
- `components/variants/report/board/BoardPOIDetails.tsx` — delt POI-detail-body
- `docs/solutions/feature-implementations/report-map-popup-card-20260213.md` — source-of-truth-pattern, `CSS.escape(poiId)` for safe querySelector, AbortController-mønster
- `docs/solutions/ui-patterns/apple-style-slide-up-modal-with-backdrop-blur-20260415.md` — Sheet vs Dialog (allerede Sheet via Vaul, men bekreft at samme prinsipp gjelder)

**Test scenarios:**
- *Happy path:* Klikk på markør → `OPEN_POI` dispatcher → `phase === "poi"` → POIOverlay renderes med klikket POI på topp + kategori-liste under.
- *Happy path:* Klikk på listeelement i overlay → `OPEN_POI` med ny id → samme overlay, ny topp-POI.
- *Edge case:* Kategori har bare 1 POI → klikk markør → overlay viser "Eneste sted i denne kategorien" i stedet for liste.
- *Edge case:* POI mangler `image` → overlay viser kategori-illustrasjon som fallback.
- *Error path:* Hvis POI-data ikke kan resolves (orphaned id) → vis inline feilmelding inni overlay-chrome.
- *Integration:* Klikk på map-bakgrunn (ikke en markør) → `BACK_TO_ACTIVE` → overlay lukker, tilbake til default-fase.
- *Integration:* Klikk på ANNEN markør mens overlay er åpen → `OPEN_POI` med ny id → overlay bytter fokus uten close-then-reopen-flash.
- *Edge case:* Close-knapp i overlay → garantert dismiss → tilbake til default.
- *Integration (mobile):* `phase === "poi"` i BoardMobileSheet → samme content som desktop renderes innenfor sheet, ikke ny Drawer.

**Verification:**
- Manuell test: klikk markører i ulike kategorier, bekreft korrekte states.
- Klikk på map-bakgrunn lukker overlay.
- Markør-bytte midt i overlay bytter content uten flicker.

---

- [ ] **Unit 6: Audio-tour mode-toggle + autoscroll + split-brain + end-of-tour**

**Goal:** Audio-tour-store får `mode: "manual" | "autoscroll"`-flag. Implementerer snap-per-track autoscroll, source-of-truth-håndtering i split-brain (audio vinner), "Tilbake til lyden"-pill, mid-tour atferd (R7b), og end-of-tour CTA-handling (R10b).

**Requirements:** R6, R6b, R7, R7b, R8, R9, R10, R10b, KD3, KD-Plan-2

**Dependencies:** Unit 2 (scroll-tracking + source-discriminator dispatch), Unit 3 (BoardScrollPanel mounts sections that audio-tour can snap to)

**Files:**
- Modify: `lib/stores/audio-tour-store.ts` (add `mode: "manual" | "autoscroll"`, `isAutoscrollPaused: boolean`)
- Modify: `components/variants/report/board/audio-tour/use-audio-tour-sync.ts` (utvid med autoscroll-logikk: dispatcher SELECT_CATEGORY med `source: "audio"` ved track-skifte, snapper scroll til seksjons-topp; pauser autoscroll ved bruker-scroll men holder audio gående)
- Modify: `components/variants/report/board/audio-tour/PlayerBanner.tsx` (ingen endring i base, men sjekk at den auto-dismisses ved `phase === "ended"`)
- Create: `components/variants/report/board/audio-tour/ResumeAudioPill.tsx` ("Tilbake til lyden"-pill som vises over player-banner når `isAutoscrollPaused === true`)
- Modify: `components/variants/report/board/audio-tour/StartTourButton.tsx` (klikk setter `mode: "autoscroll"`, starter spor-1)
- Modify: `components/variants/report/board/desktop/BoardCategorySection.tsx` + mobile-ekvivalent (per-kategori-play-knapp som setter `mode: "autoscroll"` og hopper til kategoriens spor — R7b mid-tour atferd)
- Test: `lib/stores/audio-tour-store.test.ts` (utvide)
- Test: `components/variants/report/board/audio-tour/use-audio-tour-sync.test.ts`

**Approach:**
- `audio-tour-store.mode`-flag: `"manual"` ved init/close, `"autoscroll"` ved play-trykk (top eller per-kategori)
- `isAutoscrollPaused` flippes til `true` når bruker-scroll detekteres (via `source: "scroll"`-dispatch fra `useBoardActiveSection`); audio fortsetter playing, men autoscroll-pause-flag forhindrer videre auto-snap
- Track-skifte i `useAudioTourSync`: dispatcher SELECT_CATEGORY med `source: "audio"` → `activeCategoryId` blir track-kategorien → BoardMap-pins følger track, sidebar highlighter track-kategori (audio er source-of-truth per KD-Plan-2)
- Når `isAutoscrollPaused === false`: scroll-snap til seksjons-topp ved track-skifte (`scrollIntoView({ behavior: "smooth", block: "start" })` på den nye seksjonen)
- Når `isAutoscrollPaused === true`: ikke snap, men `activeCategoryId` følger fortsatt audio
- `ResumeAudioPill` vises når `mode === "autoscroll" && isAutoscrollPaused === true && phase === "playing"`. Klikk: snapper scroll til nåværende track-seksjon, setter `isAutoscrollPaused: false`
- Mid-tour atferd (R7b): klikk på *annen* kategoris play-knapp → setter `trackIndex` til den kategoriens spor, holder `mode: "autoscroll"`, audio bytter umiddelbart (ingen "vent på ferdig"). Klikk på *nåværende* kategoris play-knapp → ekvivalent med player-banners pause-knapp.
- End-of-tour (R10b): når siste track avsluttes (`phase === "ended"`), player-banner auto-dismisses (eksisterende close-action i store). `BoardEndCTA` er alltid rendret som siste seksjon (uavhengig av audio-modus per KD8) — ingen separat end-of-tour-skjerm.

**Execution note:** Test-first for split-brain-logikken — det er den mest komplekse interaksjonen og verdt å karakterisere før implementering.

**Patterns to follow:**
- `components/variants/report/board/audio-tour/use-audio-tour-sync.ts` — `lastDispatchSource`-ref-pattern (kopier til scroll-vs-audio-koordinering)
- `lib/stores/audio-tour-store.ts` — Zustand-store-form med `useShallow`-selectors

**Test scenarios:**
- *Happy path:* Klikk "Start tour" på Hjem → `mode: "autoscroll"`, `trackIndex: 0`, audio starter spor-1, scroll-snap til Hjem-seksjon.
- *Happy path:* Track-skifte under autoscroll → SELECT_CATEGORY dispatcher med `source: "audio"`, scroll snapper til nytt seksjons-topp, kart-pins bytter til ny kategori.
- *Edge case:* Bruker scroller manuelt midt i et track → `isAutoscrollPaused: true`, audio fortsetter, kart-pins/sidebar følger fortsatt audio-position (ikke scroll-position).
- *Integration:* `ResumeAudioPill` vises i split-brain-state. Klikk på pill → scroll snapper tilbake til audio-spor-seksjon, `isAutoscrollPaused: false`.
- *Integration (R7b):* Audio spiller på kategori-3. Bruker klikker play-knapp på kategori-6. → `trackIndex` settes til 6, audio bytter umiddelbart, scroll snapper til kategori-6.
- *Integration (R7b):* Bruker klikker play-knapp på *nåværende* kategoris play-knapp. → player-banners pause-action triggeres.
- *Integration (R10b):* Siste spor avsluttes → `phase: "ended"`, player-banner auto-dismisses, BoardEndCTA er fortsatt rendret (var alltid der).
- *Edge case:* `audioTourEnabled === false` → ingen play-knapper, ingen player-banner, ingen autoscroll-mekanikk aktiv.

**Verification:**
- Manuell test mot StasjonsKvartalet: klikk Start tour, scroll i seksjoner, autoscroll snapper riktig.
- Scroll manuelt mens audio spiller → pill vises, audio fortsetter.
- Klikk pill → scroll snapper tilbake.
- Klikk play på annen kategori midt i tour → hopper.
- Audio-off prosjekt: manuell scroll fungerer fortsatt fullstendig.

---

- [ ] **Unit 7: Cleanup av legacy POI-card UI + scope-validering (audio-off + ekstern-validering)**

**Goal:** Slett legacy-komponenter for inline POI-cards og kategori-detalj-tabs. Beholder `lead`/`body` som inert data (R15b/KD7). Verifiserer at audio-off-modus er bedre enn dagens versjon (KD8). Sletter `useSubCategoryFilter` (eller skalerer ned til kart-pin-filtrering).

**Requirements:** R14, Scope Boundaries (state-cleanup + lead/body retention), KD7, KD8

**Dependencies:** Unit 3, 4, 5, 6 (alle må være ferdig før vi sletter erstattede komponenter)

**Files:**
- Delete: `components/variants/report/board/BoardCategoryInfoTab.tsx` (erstattet av BoardCategorySection)
- Delete: `components/variants/report/board/desktop/BoardPOIAccordion.tsx` (erstattet av POIOverlayList)
- Delete: `components/variants/report/board/desktop/BoardDetailPanel.tsx` (erstattet av BoardScrollPanel)
- Delete: `components/variants/report/board/mobile/BoardTabs.tsx` (Beliggenhet/Punkter-toggle slettet)
- Delete: `components/variants/report/board/mobile/BoardPunkterAccordion.tsx` (erstattet av POIOverlayList)
- Delete: `components/variants/report/board/SubCategoryFilter.tsx` (sub-filter fjernes fra UI)
- Modify: `components/variants/report/board/use-sub-category-filter.ts` (beholdes eller slettes — avgjøres her etter Unit 3-erfaring. Hvis kart-pin-filtrering trengs, beholdes som leaf-funksjon utenfor BoardContext)
- Modify: `components/variants/report/board/board-state.tsx` (fjern `subFilter`-felt fra context hvis sub-filter er helt slettet; ellers fjern bare effekten på POI-overlay-flow)
- Modify: `lib/types.ts` — IKKE slett `theme.leadText` / `upperNarrative` / `bridgeText`, behold som inert data per R15b
- Modify: `components/variants/report/board/board-data.ts` — IKKE slett `BoardCategory.lead` / `body`, behold som inert (kan ende opp som ubrukt felt, det er OK)
- Test: `components/variants/report/board/board-state.test.tsx` (verifiser at fjernet sub-filter ikke breaker andre dispatches)

**Approach:**
- Verifiser at ingen importer av slettede komponenter blir igjen (TypeScript-feil flagger gjenværende referanser)
- Kjør smoketests på et audio-off prosjekt (f.eks. opprett test-prosjekt med `audioTourEnabled: false`) → bekreft at minimum-viable-opplevelsen er komplett uten audio
- Internt demo-sjekkliste: minimum-viable-opplevelsen er bedre enn dagens versjon? Hvis nei, eskaler — det er en signal at KD2-premisset ikke holder, og lead/body bør re-introduseres som UI før vi commiter.
- **Eksternt validerings-checkpoint (KD7):** Før denne unit-en lander, sender minst én pilot-versjon til ekstern stemme (Kjetil/Karoline Propr eller representativ kjøper). Hvis positiv tilbakemelding → sletting kan lande. Hvis negativ → re-tenk; ikke slett.

**Execution note:** Denne unit-en er gating point for ekstern-validering. Ikke land den uten eksplisitt eksternt OK.

**Patterns to follow:**
- Placy CLAUDE.md "Kodebase-hygiene" — "Når du bygger noe nytt som erstatter noe gammelt: SLETT det gamle umiddelbart. ALDRI la dead code ligge."

**Test scenarios:**
- *Happy path:* Compile passerer uten referanser til slettede komponenter (`npx tsc --noEmit`).
- *Happy path:* `npm test` passerer (alle eksisterende tester må fortsatt passere; tester på slettede komponenter slettes).
- *Integration:* Audio-off prosjekt rendres uten feil; BoardScrollPanel + POIOverlay fungerer fullt.
- *Integration:* Audio-on prosjekt rendres uten regresjoner; PlayerBanner viser, autoscroll fungerer.
- *Edge case:* Eksisterende prosjekt-config med `theme.leadText` populert: leadText blir IKKE rendret (inert data), men forblir i Supabase-config.

**Verification:**
- `npm run lint && npm test && npx tsc --noEmit && npm run build` — alle passerer.
- Manuell test mot audio-off prosjekt: opplevelsen er bedre enn dagens versjon (subjektivt vurdert internt før ekstern validering).
- Ekstern stemme har bekreftet at slank-pitch + pins + overlay er komplett.

## System-Wide Impact

- **Interaction graph:**
  - `BoardContext`-reducer er nå master for `activeCategoryId`. Tre dispatchere (`useBoardActiveSection`/scroll, `useAudioTourSync`/audio, `BoardRail`/`BoardCategoryTabBar`/rail) skriver med `source`-discriminator.
  - `audio-tour-store` får `mode` + `isAutoscrollPaused` som påvirker hvordan `useBoardActiveSection` og `useAudioTourSync` koordinerer.
  - `BoardMap.tsx` reagerer på `activeCategoryId` (visible pins) og `state.phase` (HomeMarker, BoardPathLayer, BoardPOILabel).
  - `OPEN_POI`-dispatcher beholdes (markør-klikk → POI-overlay). `BACK_TO_ACTIVE` lukker overlay.
  - `tour-mode.css` `[data-tour-active]`-attribute blir satt på root-element når `audio-tour-store.phase === "playing"` (dimmer pitch-tekst, pulserer aktiv kategori-illustrasjon).

- **Error propagation:**
  - Pitch-tekst-generering feil: `pitch-write.ts apply` rapporterer og avbryter; ikke build-failure (per audio-pipeline-precedent). UI render fallback: hvis `pitchText` mangler, render `leadText` som fall-back (inert data er fortsatt der).
  - Audio-tour-feil: eksisterende `setError()`-flow i audio-tour-store. PlayerBanner viser "Prøv igjen". `isAutoscrollPaused: true` settes ved feil for å unngå dårlig scroll-koreografi.
  - Scroll-tracking-feil: hvis IntersectionObserver mangler entries (mounting race), `activeCategoryId` forblir på `initialCategoryId`. Smake-test: hot-reload triggrer ref-counting-re-init.

- **State lifecycle risks:**
  - `audio-tour-store` er ephemeral (ikke persistert) — refresh resetter `mode` til `"manual"`. OK per scope.
  - `BoardContext` er per-Page-instans, ikke persistert. OK.
  - `BoardCategory.pitchText` lagres i Supabase `products.config.reportConfig.themes[].pitchText`. PATCH-en bruker optimistic lock; samtidige writes feiler trygt.

- **API surface parity:**
  - Ingen API-endringer eksternt. Supabase JSONB-form utvides additivt.
  - Audio-tour API (ElevenLabs) urørt.

- **Integration coverage:**
  - Scroll → audio → kart-pin sync er den hovedflyten som krever integration-test (ikke bare unit-tester). Test-utility som mounter BoardScrollPanel med mock audio-tour-store + mock BoardMap.

- **Unchanged invariants:**
  - ReportConfig-typer i `lib/types.ts` beholder eksisterende felt (`leadText`, `body`, `upperNarrative`, `bridgeText`, `intro`, `grounding`). Kun additive felt legges til.
  - Audio-tour iOS Safari autoplay-pattern (single `<audio>`-element, first-gesture unlock) urørt.
  - Mapbox-marker-pool og `map.stop()`-pattern beholdes som-er.
  - `BoardMobileSheet` Vaul-Drawer-instans bevares — ingen stacked drawers (KD-Plan-7).
  - `transformToReportData` og `adaptBoardData` har samme signaturer; bare tilfører pitchText-projeksjon.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Slank-pitch føles tynt i ekstern brukers øye | KD7 + Unit 7 gating: ekstern validering før irreversibel sletting; lead/body som inert data for rollback |
| Sticky-map-tilnærming feiler i board som den gjorde i Report | Bevisst valg dokumentert (KD-Plan-4 + Context section); board er map-driven utforskning, ikke lineær-lesning |
| Split-brain audio-vs-scroll oppleves disorienterende | Source-of-truth-regel (audio vinner) + "Tilbake til lyden"-pill som eksplisitt signal; test-first på sync-logikken (Unit 6) |
| Pitch-tekst-kvalitet varierer mye mellom prosjekter | Manuell skill-pipeline har samme review-loop som audio-manus i dag (`prepare → review .pitch.md → apply`); kvalitets-gate i word-count + banned-words pre-PATCH |
| Performance: alle 47 markører + scroll-driven swaps | `BoardMap` `visiblePOIs` derives kun fra aktiv kategori (ikke alle samtidig); marker-pool gjenbrukes; eksisterende `map.stop()` før `fitBounds()` |
| Mobile bottom-sheet stacked-drawer-konflikter | KD-Plan-7 forbyr stacked Drawers; POI-overlay er ny phase i samme sheet |
| TypeScript-typene `BoardCategory.lead`/`body` blir "uused field"-støy | Bevisst valg per KD7. Marker som `/** @deprecated retain for rollback */` i types-fila i Unit 7 for klarhet |

## Documentation / Operational Notes

- **Etter Unit 1 lander:** Oppdater `COMMANDS.md` med `scripts/pitch-write.ts prepare/apply`-flyt.
- **Etter Unit 7 lander:** Oppdater `PROJECT-LOG.md` med arkitektur-skifte. Vurder å skrive `docs/solutions/architecture-patterns/board-helhetlig-narrativ-{date}.md` som compounding-artefakt (audio-tour-mode + scroll-tracking + source-discriminator er nye patterns i Placy).
- **StasjonsKvartalet får audio-tour aktivert allerede.** Test-prosjekt for audio-off-modus må opprettes (eller `audioTourEnabled: false`-flip midlertidig under test).
- **Rollback-stien:** Hvis ekstern validering feiler i Unit 7, revert Unit 7's deletes. Unit 1-6 forblir landed (additive endringer). `lead`/`body` rendres igjen i `BoardCategoryInfoTab` ved å re-introducer komponenten fra git-historikk.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md](../brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md)
- **Avhengig av brainstorm:** [docs/brainstorms/2026-05-16-megler-pitch-audio-tour-brainstorm.md](../brainstorms/2026-05-16-megler-pitch-audio-tour-brainstorm.md) (audio-tour-fundament: iOS autoplay, ElevenLabs-pipeline, player-banner)
- **Foundational pattern:** `docs/solutions/feature-implementations/report-scroll-synced-sticky-map-20260208.md`
- **POI-overlay pattern:** `docs/solutions/feature-implementations/report-map-popup-card-20260213.md`
- **Build-time content-gen pattern:** `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md`
- **Mobile bottom-sheet:** `docs/solutions/ui-patterns/apple-style-slide-up-modal-with-backdrop-blur-20260415.md`
- **Conflict-flag:** `docs/solutions/architecture-patterns/report-kart-per-kategori-modal-20260409.md` (Reports pivot vekk fra sticky-map; vi velger bevisst sticky-map for board)
- **Related code (key files):**
  - `lib/hooks/useActiveSection.ts`
  - `components/variants/report/board/audio-tour/use-audio-tour-sync.ts`
  - `lib/stores/audio-tour-store.ts`
  - `scripts/audio-manus-write.ts` + `lib/audio-tour/manus.ts` + `lib/audio-tour/manus-prompt.ts`
