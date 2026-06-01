---
title: Megler-pitch audio-tour på rapport-board
type: feat
status: active
date: 2026-05-17
origin: docs/brainstorms/2026-05-16-megler-pitch-audio-tour-brainstorm.md
---

# Megler-pitch audio-tour på rapport-board

## Overview

Bygger en 3-minutters audio-tour-modus over rapport-board som gjenskaper meglerens nabolagsspitch på en visning. Build-time pipeline genererer pitch-manus + ElevenLabs-audio per kategori (Hjem + 5 tema). Runtime renderer en player-banner som overtar panel-toppen, dimmer body-tekst, og pulser aktiv kategori i rail/tab-bar mens audioen spiller. Track-skifte synkroniserer kart-bounds og detail-panel som om bruker klikket i rail. Pilot leveres for Spro Havn-rapport (Banenor / Propr-distribusjon).

Plan-omfang er prototype-først: minimum levedyktig implementasjon for én norsk Placy-stemme, committed audio-binærer i `public/`, manuell QA før release. Refactor til ekstern blob-storage og skalering til library voices (Creator-plan) er deferred til etter pilot-validering.

## Problem Frame

Kjøperen på en fysisk visning får meglerens sammenhengende nabolagsspitch — "Solsiden er rett rundt hjørnet, T-banen tar fem minutter, gourmet-bakeriet åpner kl. 7". I dag må Placy-rapporten konsumeres ved å klikke seg gjennom 6 kategorier, og målgruppen som ikke er sterke på kart/navigasjon får ikke utbytte. Audio-touren gjenskaper pitch-opplevelsen mens visuell sync (kart-bounds, illustrasjon, body-tekst) gir referansen tilbake.

Pilot-kontekst er signert Propr-distribusjonsavtale (1700 listinger/år). Audio-tour er en kandidat-differensiator til Propr-portalen som vi viser fram for Kjetil/Karoline. Se origin-doc for full Resolve-Before-Planning-historikk.

## Requirements Trace

Direkte fra origin-doc (R1-R13). Hvert implementeringsunit peker tilbake:

- **R1** "▶ Start tour"-CTA i Hjem-panel — Unit 4
- **R2** Én track per aktiv kategori inkl. Hjem, fast rekkefølge — Unit 3, Unit 4
- **R3** Audio starter umiddelbart (delt `<audio>`-element for iOS unlock-persistens) — Unit 4
- **R4** Track-skifte synkroniserer kategori i UI + kart — Unit 3
- **R5** Tour-modus visuell signatur (dim body, pulse rail) — Unit 5
- **R6** Player-banner: teller, progress, kontroller — Unit 4
- **R7** Klikk på annen kategori under tour → pause + navigate — Unit 3, Unit 5
- **R8** Tour-end-skjerm med 3 shortcuts — Unit 6
- **R9** Manus build-time per track (Hjem fra heroIntro, kategori fra grounding) — Unit 1, Unit 7
- **R10** Muntlig kuratorisk tone, ~70 ord per track — Unit 1
- **R11** ElevenLabs Daniel, multilingual_v2, MP3 — Unit 2
- **R12** Pilot kun norsk, lang-param i pipeline — Unit 1, Unit 2
- **R13** Mobile sheet pinnet til 320px under tour — Unit 5

Suksess-kriterier (fra origin-doc) er sjekket i Verification per unit + i samlet `## System-Wide Impact`.

## Scope Boundaries

- **Kun rapport-board for Eiendom-Bolig** (ikke Explorer/Guide/Hotel/Adresse/Næring).
- **Kun auto-pitch med Placy-stemmen** (megler-egen-innspilling defer til premium-segment).
- **Kun norsk i pilot.** Lang-param `no` er default i pipeline.
- **Ingen POI-pulse synkronisering mid-track.** POIer reagerer kun ved kategori-bytte.
- **Ingen runtime LLM eller TTS.** Alt build-time per CLAUDE.md.
- **Ingen admin-UI for manus/stemme-redigering.** Stemme er pipeline-konfigurasjon.
- **Ingen URL-state for play-progress.** Refresh starter på Hjem; delelink er ikke pilot-mål.
- **Ingen "min reise"-deling** (i motsetning til Story Mode-brainstorm 2026-04-07).

### Deferred to Separate Tasks

- Engelsk og andre språk: separat pipeline-utvidelse hvis spesifikt segment (relocation, cruise) etterspør.
- Library voices (Aria/Charlotte/Laura) + Creator-plan ($22/mnd): re-validering når Propr-skala blir reelt.
- Vercel Blob (eller annen ekstern store) for audio: refactor av build-script + URL-resolver hvis pilot validerer.
- MediaSession API for iOS/Android lock-screen-kontroller: lav-friksjon enhancement hvis brukerfeedback krever det.
- Tilgjengelighet beyond ARIA-labels (full keyboard nav, screen reader-test): post-pilot bar.
- Story Mode-brainstorm (2026-04-07): parkert; arkiveres som ikke-pursued hvis audio-tour fungerer.

## Context & Research

### Relevant Code and Patterns

**BoardContext og state-pattern:**
- `components/variants/report/board/board-state.tsx` — `useReducer + createContext`, phases `default | active | poi`, actions `SELECT_CATEGORY | OPEN_POI | BACK_TO_ACTIVE | RESET_TO_DEFAULT`. Ikke utvid med ny `phase: "tour"` — bruk ortogonal store (se Key Decisions).
- `lib/store.ts` — global Zustand (ikke brukt for board-state).
- `lib/stores/kompass-store.ts` (precedent fra `docs/solutions/feature-implementations/kompass-event-recommendation-prototype-20260311.md`) — separat, ephemeral, non-persisted Zustand-store for sub-feature-state med `useShallow`-selector. Audio-tour-store følger denne malen.

**Player-surface mounting:**
- `components/variants/report/board/desktop/BoardDetailPanel.tsx` — 400px sidekolonne, `DefaultEmptyState` for Hjem-panel, `CategoryDetail` for aktive kategorier. Player-banner lift'es UT av scroll-container som første barn av outer `<section>`.
- `components/variants/report/board/mobile/BoardMobileSheet.tsx` — Vaul-sheet, snap-points `["96px", "320px", 0.5, 1]`, `dismissible={false}`. Snap-state er lokal `useState`. `RESET_TO_DEFAULT` dispatches når sheet drages til `"96px"` mens phase ≠ default — gjenbrukes som tour-close-gest per R13.
- `components/variants/report/board/desktop/BoardRail.tsx` — 48x48 thumbnails, active = layered box-shadow ring. Pulse-animasjon = additivt `::after`-shadow.
- `components/variants/report/board/mobile/BoardCategoryTabBar.tsx` — 56x56 thumbnails, active = `border-stone-900`. Pulse-animasjon = absolute-positioned outline-element (unngå border-width-shift).

**Eksisterende panel-data:**
- `components/variants/report/board/BoardCategoryInfoTab.tsx` — renderer `category.lead + category.body + category.grounding`. Manus-prompt sourcer fra samme felter via `board-data.ts:adaptCategory`.
- `components/variants/report/board/board-data.ts` — `adaptBoardData` mapper `report.heroIntro` → `data.home.heroIntro` og `report.heroImage` → `data.home.heroImage`. Utvides med `data.home.audio?: { url; durationSec? }` og `theme.audioSrc?: string`.

**Build-time pipeline:**
- `.claude/skills/generate-rapport/SKILL.md` — eksisterende pipeline (Steg 0-10). Audio-steg går mellom Steg 8 (QA) og Steg 9 (DB-lagre).
- `scripts/gemini-grounding.ts` — referanse-pattern for parallel per-kategori LLM-kall, Promise.allSettled med p-limit, deep-merge PATCH med optimistic lock (`updated_at=eq.{read_value}`), `revalidateTag("product:${projectId}")` cache-bust (samme single-ID-format som `scripts/curate-narrative.ts:499`). **ALLOWED_REPORTCONFIG_KEYS og PRESERVED_REPORTCONFIG_KEYS whitelists** må utvides med `audio`, `audioVersion`, og `heroAudio` ellers PATCH avvises.
- `scripts/curate-narrative.ts` — eksempel på "prepare + apply" two-stage script-pattern hvis manus-generering trenger QA-step før audio bygger.
- `scripts/elevenlabs-validation.ts` — validert produksjons-shape (plain fetch, `eleven_multilingual_v2`, `Daniel = onwK4e9ZLuTAKqWW03F9`, settings `stability=0.5/similarity_boost=0.75/style=0/use_speaker_boost=true`, `mp3_44100_128`). Kopierbar til pipelines som er bygger.

**Editorial voice:**
- `.claude/skills/curator/SKILL.md` + `references/voice-principles.md` — 6 kjerneprinsipper. Banned-liste (regex-håndhevet) gjelder. Eksisterende `intro_text`-tekst-type er 600-900 tegn skrevet; muntlig 70-ord-pitch-register er nytt og trenger inline-spec i manus-prompt.

**Static asset pattern:**
- `docs/solutions/architecture-patterns/hand-drawn-spot-icons-ai-generated-20260413.md` — `THEME_ICONS: Record<string,string>` → `/illustrations/icons/{slug}-icon.png`, `ReportTheme.iconSrc?: string`. Audio følger samme: `THEME_AUDIO_BASE` → `/audio/{projectSlug}/{categoryId}.mp3`, `ReportTheme.audioSrc?: string`, `ReportConfig.heroAudio?: { url; ... }`.

### Institutional Learnings

- **`docs/solutions/api-integration/gemini-grounding-pattern-20260418.md`** — Foreldre-pattern for build-time LLM-integrasjon. Følges for audio: header-auth (`xi-api-key`), build-time-only, `z.literal(1)` version-bump, deep-merge PATCH, `revalidateTag` cache-bust, omit-on-failure (ikke null). Audio legger til binær-asset-placement og TTS-provider-ToS-attribusjon.
- **`docs/solutions/feature-implementations/generate-bolig-quality-pipeline-rewrite-20260228.md`** — Steg-ordering er fragilt; nye steg må plasseres bevisst. Audio går etter Steg 8 (QA) og før Steg 9 (DB-lagre).
- **PROJECT-LOG.md 2026-04-30 (kveld)** — Multi-snap-sheet refactor. `BoardState.phase` ble redusert fra 4 til 3 — `OPEN_READING`/`readingTab` slettet atomisk. **Audio må IKKE legge til ny `phase`-verdi.** Bruk separat Zustand-store.
- **`docs/solutions/architecture-patterns/hand-drawn-spot-icons-ai-generated-20260413.md`** — Per-kategori AI-asset → `public/`-tree → config-map ↔ `ReportTheme`-optional-felt. Direkte mal for audio-asset-plassering.
- **`docs/solutions/feature-implementations/kompass-event-recommendation-prototype-20260311.md`** — Separat ephemeral Zustand-store for sub-feature. Mal for `lib/stores/audio-tour-store.ts`.
- **Memory `project_stage_prototype.md`** — Prototype-stadium, ingen live klient-trafikk, null-downtime-patterns er over-engineering. Committed MP3 til `public/audio/` er passende.
- **Memory `feedback_mobile_native_ux.md`** — Adaptive komponenter når mønstre divergerer. Player-banner deler logikk via felles `usePlayerBannerState`-hook, men renderer ulikt på desktop (panel-toppen) vs mobile (sheet-topp).

### External References

Skipping external research per Phase 1.2-vurdering. Patterns lever lokalt; ElevenLabs er validert; iOS-autoplay-restriksjoner er adressert via delt `<audio>`-element-strategi etablert i web-audio-standard-pattern (single user-gestured element forblir unlocked på iOS Safari).

## Key Technical Decisions

- **Tour-state lever i `lib/stores/audio-tour-store.ts` (Zustand), ikke som ny `BoardState.phase`.** Begrunnelse: 2026-04-30-disiplinen sa eksplisitt at ephemeral sub-UI state skal ut av `BoardState`. `audio-tour-store` er sibling til `kompass-store.ts`-precedent. Synker med `BoardContext` via en `useAudioTourSync`-hook (ved track-skifte dispatches `SELECT_CATEGORY`).
- **Delt `<audio>`-element + sekvensiell `src`-bytte.** Begrunnelse: Standard web-pattern for playlist; iOS Safari unlocker elementet etter første user-gestured play, og det forblir unlocked for resten av session. Pre-instantiation av N elementer er over-engineering for 6 tracks.
- **`reportConfig.audioVersion: z.literal(1)`** (top-level, parallelt med `groundingVersion`-pattern). Bump → re-gen alle audio-tracks for alle prosjekter. Per-tema `themes[].audio.version` er overflødig fordi versjons-bump-trigger er stemme-/modell-/manus-prompt-endring som affecter alle tracks samtidig.
- **`reportConfig.themes[].audio = { url, voice, model, generatedAt, manus }`** + **`reportConfig.heroAudio = { url, voice, model, generatedAt, manus }`** for Hjem-track (Hjem er ikke en `BoardCategory`).
- **Whitelist-update i `scripts/gemini-grounding.ts`**: `ALLOWED_REPORTCONFIG_KEYS` + `PRESERVED_REPORTCONFIG_KEYS` får `"audio"`, `"audioVersion"`, `"heroAudio"` lagt til. Uten dette avvises PATCH.
- **Audio-storage = `public/audio/{projectSlug}/{categoryId}.mp3`** + `public/audio/{projectSlug}/hjem.mp3`. `projectSlug` er `ProjectContainer.urlSlug` (`stasjonskvartalet`), ikke marketing-navnet. URL-felter i DB peker til denne statiske pathen.
- **Empty-state: ingen partial-tour.** Render Start-tour-CTA kun hvis `data.home.audio` OG hver aktive `theme.audioSrc` er definert. Hvis bygg feiler på én, fail-fast: bygg-skript exit ≠ 0 og Andreas fikser manuelt.
- **Visual tour-mode-signatur via `data-tour-active`-attribute på panel-rot**, ikke per-komponent state. CSS `:where([data-tour-active]) [data-board-body]` dimmer. Reduserer prop-drilling og holder visning-logikk i CSS.
- **Cache-bust via `revalidateTag("product:${projectId}")`** kalles av audio-build-script etter PATCH lykkes — samme single-ID-format som `scripts/gemini-grounding.ts:452` og `scripts/curate-narrative.ts:499`.

## Open Questions

### Resolved During Planning

- **Cache-busting:** Top-level `reportConfig.audioVersion: z.literal(1)` bump → re-gen.
- **Tour-state-arkitektur:** Separat Zustand-store (`audio-tour-store.ts`), ikke `BoardState`-utvidelse.
- **`<audio>`-element-strategi:** Delt element + sekvensiell `src`-bytte for iOS unlock-persistens.
- **Map-pan ved track-skifte:** Gjenbruker eksisterende `BoardMap` fitBounds smooth-animasjon ved `SELECT_CATEGORY`. Ingen ny logikk.
- **Storage:** `public/audio/{projectSlug}/{categoryId}.mp3`. Vercel serverer statisk fra `public/`.
- **Mobile player-banner-plassering:** Sticky top på sheet (over body-content). Sheet pinnet til 320px peek per R13.

### Deferred to Implementation

- **`opacity: 0.5` dim-level for body-text** — provisional. Iteres visuelt mot dev-server før commit av PR.
- **Pulse-keyframe-detalj** (oscillation-style, timing, easing) — bestemmes ved visuell iterasjon. Notér i Unit 5.
- **Player-banner høyde (px) og collapsed-state** — iteres mot 64-72px range. Påvirker padding-top på panel-body.
- **Tour-end-skjerm visuelt hierarki** — primær-knapp (restart) får full-bredde primary-color; sekundære knapper (kategori-shortcut, kontakt megler) er secondary-style under.
- **iOS first-audio-latency mot 5s-måltallet** — testes empirisk på Spro Havn-prototype før commit. Hvis >5s: legg til `<audio preload="metadata">` på Hjem-mount eller preload-link i `<head>`. Service worker / edge-CDN er over-engineering for prototype.
- **Mid-tour audio-error UX-detalj** — pause + vis "Lyd-feil — prøv igjen"-state i player-banner. Eksakt copy/icon bestemmes ved implementasjon.
- **Segmented progressbar min-segment-width** — defer; pilot har 6 segmenter som er innenfor komfortabel range.

## Output Structure

```
components/variants/report/board/audio-tour/        (ny)
├── PlayerBanner.tsx                                 (ny — delt komponent)
├── PlayerBanner.module.css                          (ny — pulse-keyframes hvis trengs)
├── TourEndScreen.tsx                                (ny)
├── StartTourButton.tsx                              (ny — CTA i Hjem-panel)
└── use-audio-tour-sync.ts                           (ny — kobler store til BoardContext)

lib/stores/
└── audio-tour-store.ts                              (ny — Zustand, mal: kompass-store.ts)

scripts/
├── audio-manus-write.ts                             (ny — LLM-manus-generering, Steg 8c.1)
└── audio-tour-build.ts                              (ny — ElevenLabs-call, Steg 8c.2)

public/audio/stasjonskvartalet/                      (ny — committed for pilot)
├── hjem.mp3
└── {categoryId}.mp3 × aktive tema

.claude/skills/generate-rapport/
└── SKILL.md                                         (modifisert — Steg 8c innskutt)

components/variants/report/board/
├── board-data.ts                                    (modifisert — adaptCategory + adaptBoardData)
├── desktop/BoardDetailPanel.tsx                     (modifisert — sticky player-banner + start-CTA)
├── desktop/BoardRail.tsx                            (modifisert — pulse-marker)
├── mobile/BoardMobileSheet.tsx                      (modifisert — player-banner + tour-aware snap-pin)
└── mobile/BoardCategoryTabBar.tsx                   (modifisert — pulse-marker)

lib/types.ts                                         (modifisert — ReportThemeAudio + ReportConfig.heroAudio/audioVersion)
scripts/gemini-grounding.ts                          (modifisert — whitelist-update)
```

## High-Level Technical Design

> *Denne illustrerer intendert tilnærming og er directional guidance for review, ikke implementation specification.*

**Tour-state-flyt (runtime):**

```
[idle]
  │  click Start tour
  ▼
[playing track 0 (Hjem)]
  │
  ├── audio.ended → next track → SELECT_CATEGORY(theme[0]) → [playing track 1]
  │
  ├── user clicks pause → [paused]
  │     │ user clicks resume → [playing]
  │     │ user clicks close → [idle]
  │
  ├── user clicks category in rail/tab-bar →
  │     │ SELECT_CATEGORY(targetCat) → [paused]
  │     │ player-banner viser "Fortsett tour"-knapp
  │
  ├── user dragger mobile sheet til 96px →
  │     │ RESET_TO_DEFAULT → [paused + close-intent]
  │
  └── last track audio.ended → [ended] (tour-end-skjerm)
```

**Build-pipeline-flyt (Steg 8c):**

```
Steg 7: Skriv kategori-tekster (eksisterende)
       │ produserer themes[].leadText, bridgeText, grounding.curatedNarrative
Steg 8: QA-sjekk (eksisterende)
       │
Steg 8c.1: audio-manus-write.ts
       │ for hver track (Hjem + N kategorier):
       │   prompt = Curator-voice + ~70-ord-pitch-spec + kontekst-input
       │   kall Claude → manus
       │   PATCH themes[].audio.manus / heroAudio.manus
       │
Steg 8c.2: audio-tour-build.ts
       │ for hver track:
       │   fetch ElevenLabs (Daniel, multilingual_v2, voice_settings)
       │   write public/audio/{slug}/{categoryId}.mp3
       │   PATCH themes[].audio.{url,voice,model,generatedAt}
       │   PATCH reportConfig.heroAudio for Hjem
       │ revalidateTag("product:{customer}_{slug}")
       │
Steg 9: Lagre (eksisterende, andre felt)
Steg 10: Verifiseringsrapport (eksisterende)
```

## Implementation Units

- [ ] **Unit 1: Manus-generering (build-pipeline Steg 8c.1)**

**Goal:** Bygg `scripts/audio-manus-write.ts` som genererer pitch-manus per track (Hjem + per aktiv kategori) og PATCH-er Supabase-`reportConfig`.

**Requirements:** R9, R10, R12

**Dependencies:** Eksisterende grounding+curation må være kjørt (`themes[].grounding.curatedNarrative` finnes).

**Files:**
- Create: `scripts/audio-manus-write.ts`
- Create: `lib/audio-tour/manus-prompt.ts` (system-prompt + per-track-template)
- Modify: `lib/types.ts` (ny `ReportThemeAudio` + `ReportConfig.heroAudio`/`audioVersion` Zod-shapes)
- Modify: `scripts/gemini-grounding.ts` (utvid `ALLOWED_REPORTCONFIG_KEYS` + `PRESERVED_REPORTCONFIG_KEYS` med `audio`, `audioVersion`, `heroAudio`)
- Test: `scripts/audio-manus-write.test.ts` (vitest)

**Approach:**
- Skript leser eksisterende DB-row (samme pattern som `gemini-grounding.ts`), bygger track-liste fra `reportConfig.themes[]` (filtrer på `enabled !== false`) + Hjem.
- Per track: build prompt med Curator-voice-prinsipper + 70-ord muntlig-pitch-spec + input-tekst (Hjem = `heroIntro` + `area.name`; kategori = `leadText + bridgeText + grounding.curatedNarrative.markdown`).
- Inkluder forrige-track-konktekst i prompt for naturlig overgang ("Så til familielivet — …").
- `Promise.allSettled` med `p-limit(3)` (lavere enn grounding fordi tracks bygger sekvensiell-overgang-kontekst — semi-paralell OK, full paralell ville miste continuity).
- PATCH deep-merge med optimistic lock (`updated_at=eq.{read_value}`), omit-on-failure ikke null-write.
- Lang-param default `no`, framtidsprofil for `en` (men ikke kjøres).

**Patterns to follow:**
- `scripts/gemini-grounding.ts` (parallel-call, PATCH, whitelist)
- `scripts/curate-narrative.ts` (prepare+apply two-stage hvis manus trenger manuell QA før audio)
- `.claude/skills/curator/SKILL.md` + `references/voice-principles.md`

**Test scenarios:**
- Happy path: 6 tema + Hjem, alle har grounding → 7 manus-objekter, alle ≤80 ord, ingen banned-words (regex-validering).
- Edge case: kategori med tom `bridgeText` → manus genereres fra `leadText + grounding` uten å feile.
- Edge case: prosjekt uten `themes[]` → script exit 0 med "no tracks to generate"-melding.
- Error path: Claude API 5xx på én track → log fail, andre tracks fortsetter, exit non-zero, ingen partial-PATCH.
- Error path: whitelist mangler `audio`-nøkkel → PATCH avvises, klar feilmelding peker mot fil/linje.
- Integration: kjør mot Spro Havn DB-state → verifiser at `themes[].audio.manus` + `heroAudio.manus` skrives og kan leses tilbake.

**Verification:**
- Manus-objekter eksisterer for alle aktive tracks på Spro Havn etter skript-kjøring.
- Manuell lytte-test (Andreas leser manus høyt): muntlig kuratorisk tone, ingen banned-words, naturlige overganger.
- Whitelist-test: kjør `gemini-grounding.ts --apply` etterpå og bekreft at audio-felt overlever PATCH.

---

- [ ] **Unit 2: Audio-generering (build-pipeline Steg 8c.2)**

**Goal:** Bygg `scripts/audio-tour-build.ts` som leser manus fra Supabase, kaller ElevenLabs per track, lagrer MP3 til `public/audio/{slug}/` og PATCH-er audio-URL + metadata.

**Requirements:** R11, R12

**Dependencies:** Unit 1 (manus må finnes i DB).

**Files:**
- Create: `scripts/audio-tour-build.ts`
- Create: `lib/audio-tour/elevenlabs-client.ts` (kopier fetch-pattern fra `scripts/elevenlabs-validation.ts`)
- Create: `public/audio/.gitkeep` (eksplisitt at directory eksisterer)
- Test: `scripts/audio-tour-build.test.ts`

**Approach:**
- Skript tar `--project <urlSlug>` arg, leser `reportConfig` fra DB, bygger track-liste.
- Per track: kall ElevenLabs med Daniel (`onwK4e9ZLuTAKqWW03F9`), `eleven_multilingual_v2`, validated voice_settings.
- Lagre MP3 til `public/audio/{projectSlug}/{categoryId}.mp3` (Hjem → `hjem.mp3`).
- `Promise.allSettled` med `p-limit(5)` (ElevenLabs tåler parallel; ingen continuity-krav).
- PATCH `reportConfig.themes[].audio = { url: "/audio/{slug}/{categoryId}.mp3", voice: "daniel", model: "eleven_multilingual_v2", generatedAt: ISOString, manus: "<from Unit 1>" }`. Hjem → `reportConfig.heroAudio` parallelt.
- Sett `reportConfig.audioVersion: 1` på top-level.
- Empty-state-guard: hvis EN track feiler, exit non-zero og logg hvilke. Partial-PATCH er ikke OK — enten alle eller ingen (release-blocker per origin-doc-decision).
- Cache-bust: kall `revalidateTag("product:${projectId}")` (via samme import som `gemini-grounding.ts:452` bruker) etter PATCH lykkes.

**Patterns to follow:**
- `scripts/elevenlabs-validation.ts` (fetch-shape, voice settings, error-handling)
- `scripts/gemini-grounding.ts` (PATCH + cache-bust + Promise.allSettled-pattern)

**Test scenarios:**
- Happy path: 7 manus i DB → 7 MP3 skrevet, alle ≥50KB, alle URLs PATCH'et korrekt.
- Edge case: én manus mangler → skript exit non-zero, logg "manus missing for {trackId}", ingen partial-write.
- Error path: ElevenLabs 401 (auth fail) → tydelig melding "Sjekk ELEVENLABS_API_KEY", exit non-zero.
- Error path: ElevenLabs 402 (quota) → tydelig melding "ElevenLabs-quota oppbrukt", exit non-zero.
- Error path: Disk-write feiler (`public/audio/`-dir mangler eller readonly) → klar feilmelding, ingen partial DB-write.
- Integration: re-kjør på samme prosjekt → MP3-er overskrives, DB-URLs forblir samme, `generatedAt` oppdateres.

**Verification:**
- `ls public/audio/stasjonskvartalet/` viser 7 MP3-filer (hjem + 6 kategorier).
- `psql ... SELECT config->'reportConfig'->'themes'->0->'audio' FROM products ...` returnerer `{ url, voice, model, generatedAt, manus }`.
- Andreas lytter til alle 7 og signerer kvaliteten (uttale på "Stasjonskvartalet", "Brattørkaia", "Midtbyen", "Solsiden" er OK).

---

- [ ] **Unit 3: Audio-tour state-store + sync-hook**

**Goal:** Bygg Zustand-store for tour-state og kobling-hook som synkroniserer med `BoardContext`.

**Requirements:** R2, R4, R7

**Dependencies:** Ingen (rent klient).

**Files:**
- Create: `lib/stores/audio-tour-store.ts`
- Create: `components/variants/report/board/audio-tour/use-audio-tour-sync.ts`
- Test: `lib/stores/audio-tour-store.test.ts`
- Test: `components/variants/report/board/audio-tour/use-audio-tour-sync.test.tsx` (React Testing Library)

**Approach:**
- Store-state: `{ phase: "idle" | "playing" | "paused" | "ended" | "error", trackIndex: number, tracks: AudioTrack[], pauseReason?: "manual" | "category-clicked" | "audio-error" }`.
- Store-actions: `start(tracks)`, `pause(reason)`, `resume()`, `goToTrack(index)`, `next()`, `prev()`, `close()`, `setError()`.
- `AudioTrack = { categoryId: BoardCategoryId | "home"; url: string; manus: string; durationSec?: number }`.
- `use-audio-tour-sync.ts` lytter på `state.trackIndex` (via Zustand-selector) — når den endrer seg, dispatcher den `SELECT_CATEGORY` (eller `RESET_TO_DEFAULT` for Hjem-track) til `BoardContext`.
- Motsatt retning: `use-audio-tour-sync.ts` lytter også på `BoardContext.state.activeCategoryId`. Hvis bruker klikker en kategori som ikke matcher `tracks[trackIndex].categoryId` mens phase === "playing", kall `pause("category-clicked")`.
- Bruk `useShallow`-selector-pattern fra `kompass-store.ts` for å unngå rerender-storm.

**Patterns to follow:**
- `lib/stores/kompass-store.ts` (Zustand-shape, `useShallow`, ephemeral non-persisted)
- `components/variants/report/board/board-state.tsx` (consumer-pattern for `useReducer`-state)

**Test scenarios:**
- Happy path: `start([hjem, kat1, kat2])` → phase=playing, trackIndex=0; `next()` → trackIndex=1; ved siste track + `next()` → phase=ended.
- Happy path: store-trackIndex-change → BoardContext får `SELECT_CATEGORY`-dispatch (verifiseres via mock dispatch).
- Edge case: `start([])` → phase forblir idle, ingen crash.
- Edge case: `goToTrack(5)` mens `tracks.length === 3` → no-op, log warning, state uendret.
- Integration: BoardContext-`SELECT_CATEGORY` på kategori utenfor tour-rekkefølge → `pause("category-clicked")` kalles.
- Integration: `pause()` etterfulgt av `resume()` → phase=playing, trackIndex uendret.
- Edge case: `close()` fra hvilket som helst state → phase=idle, trackIndex=0.

**Verification:**
- Store-test-suite green.
- Manuell test: åpne `/eiendom/banenor-eiendom/stasjonskvartalet/rapport-board` med en mock-store-init, klikk en kategori, verifiser at sync-hook trigger pause.

---

- [ ] **Unit 4: Player-banner + Start-tour-CTA + delt `<audio>`-element**

**Goal:** Bygg player-banner-komponenten som rendres når tour er aktiv, og start-tour-CTA i Hjem-panel.

**Requirements:** R1, R3, R6

**Dependencies:** Unit 3 (store finnes).

**Files:**
- Create: `components/variants/report/board/audio-tour/PlayerBanner.tsx`
- Create: `components/variants/report/board/audio-tour/StartTourButton.tsx`
- Create: `components/variants/report/board/audio-tour/use-audio-element.ts` (hook som mounter delt `<audio>`-element)
- Modify: `components/variants/report/board/desktop/BoardDetailPanel.tsx` (mount StartTourButton i `DefaultEmptyState`, mount PlayerBanner sticky-top utenfor scroll-container)
- Modify: `components/variants/report/board/mobile/BoardMobileSheet.tsx` (mount StartTourButton i `DefaultHomeContent`, mount PlayerBanner sticky-top inni sheet-header)
- Modify: `components/variants/report/board/board-data.ts` (adapt `data.home.audio` og `theme.audioSrc` fra `reportConfig.heroAudio` / `themes[].audio.url`)
- Test: `components/variants/report/board/audio-tour/PlayerBanner.test.tsx`

**Approach:**
- `use-audio-element.ts` mounter ett `<audio ref>` element (renderes som første barn av `ReportBoardPage`-root). Hook returnerer `play()`, `pause()`, `setSrc()`, `currentTime`, `duration`. Watch `audio.onended` → kaller store-`next()`. Watch `audio.onerror` → kaller store-`setError()`.
- Når `store.trackIndex` endrer seg: `setSrc(tracks[trackIndex].url)` + `play()` (samme element, så iOS-unlock holder).
- `PlayerBanner.tsx` (~64-72px høyde): venstre = kategori-illustrasjon thumbnail; midt = track-teller (`3/6`) + kategori-navn + segmentert progressbar (én div per track, fyll = `currentTime/duration` for aktiv segment, 100% for spilt-tidligere); høyre = prev/play-pause/next + lukk.
- Når `store.phase === "paused" && pauseReason === "category-clicked"`: vis "Fortsett tour"-knapp som primary-action i banner (erstatter play-pause-knappen visuelt).
- Når `store.phase === "ended"`: PlayerBanner unmounts; TourEndScreen tar over (Unit 6).
- `StartTourButton.tsx`: viser kun hvis `data.home.audio && allActiveThemesHaveAudio`. Rendres under `home.heroIntro` og over "Velg en kategori"-footer i Hjem-panel. Klikk: build `tracks[]` fra adapted data, kall `store.start(tracks)`.
- Felles `use-audio-element` for desktop + mobile (mountes på root, ikke per surface).

**Patterns to follow:**
- `components/variants/report/board/desktop/BoardDetailPanel.tsx` (`DefaultEmptyState`-struktur)
- `components/variants/report/board/mobile/BoardMobileSheet.tsx` (`DefaultHomeContent`-struktur)
- `lib/stores/kompass-store.ts` consumer-pattern (`useShallow`)

**Test scenarios:**
- Happy path: klikk Start tour → audio-element får `src = "/audio/stasjonskvartalet/hjem.mp3"`, `play()` kalles, banner viser "1/7 — Hjem".
- Happy path: audio.ended på track 1 → store.next(), src oppdateres til track 2, banner-counter viser "2/7".
- Edge case: ingen audio i `data.home.audio` → StartTourButton renderer ikke.
- Edge case: én aktiv tema mangler audio → StartTourButton renderer ikke (helhetlig empty-state-policy).
- Error path: audio.onerror trigger → banner viser "Lyd-feil"-state, phase=error.
- Integration: pause via player-banner-knapp → audio.pause() kalles, phase=paused, knapp viser play-icon.
- Integration: skip-next-knapp → store.next() + audio-src-bytte, kategori i UI byttes synkront.

**Verification:**
- Player-banner vises korrekt på desktop (`/rapport-board` viewport 1280x800) og mobile (375x812 iPhone 13 mini emulering via chrome-devtools MCP).
- iOS Safari: bruk Chrome DevTools MCP til å verifisere at audio starter <2s etter klikk på en fresh page-load.
- Manuell test: klikk start-tour → lytt til alle 7 tracks via skip-next, ingen audio-cut-off mellom tracks.

---

- [ ] **Unit 5: Tour-modus visuell signatur — body-dim, rail/tab-pulse, mobile sheet-pin**

**Goal:** Implementer den distinkte visuelle "tour-modus"-statusen som signaliserer at audio styrer opplevelsen.

**Requirements:** R5, R7, R13

**Dependencies:** Unit 4 (player-banner mountes).

**Files:**
- Modify: `components/variants/report/board/desktop/BoardDetailPanel.tsx` (legg `data-tour-active` attr på outer-section + `data-board-body` attr på body-tekst-container)
- Modify: `components/variants/report/board/mobile/BoardMobileSheet.tsx` (samme attr-mønster + tour-aware snap-pin)
- Modify: `components/variants/report/board/desktop/BoardRail.tsx` (legg `data-active-during-tour` på aktiv-RailButton + CSS pulse)
- Modify: `components/variants/report/board/mobile/BoardCategoryTabBar.tsx` (samme attr + CSS pulse)
- Create: `components/variants/report/board/audio-tour/tour-mode.css` (CSS module med `data-tour-active`/`data-active-during-tour`-selektorer + pulse-keyframes)
- Modify: `app/globals.css` (importer tour-mode.css hvis ikke CSS-module-bundling allerede plukker det opp)
- Test: visuell verifisering via chrome-devtools MCP (ikke unit-test — visuelt mønster)

**Approach:**
- CSS-driven via attributes for å unngå prop-drilling: når `store.phase === "playing" || "paused"`, sett `data-tour-active` på `BoardDetailPanel`-outer-section (desktop) og `BoardMobileSheet`-content-root (mobile).
- Dim-rule: `:where([data-tour-active]) [data-board-body] { opacity: 0.5; transition: opacity 240ms ease; }`. Marker eksisterende body-tekst-containere (`BoardCategoryInfoTab` body-paragraphs) med `data-board-body`.
- Pulse-rule: `[data-active-during-tour] { animation: tour-pulse 2s ease-in-out infinite; }` med keyframe som oscillerer en `box-shadow`-ring (`0 0 0 0 rgba(28,25,23,0.4)` → `0 0 0 6px rgba(28,25,23,0)`).
- Sett `data-active-during-tour` på aktiv `RailButton`/`CategoryButton` når `store.phase === "playing"` og `tracks[trackIndex].categoryId === cat.id`.
- `prefers-reduced-motion: reduce` short-circuits keyframes.
- Mobile sheet-pin (R13): `BoardMobileSheet` ser etter `store.phase === "playing" || "paused"`. Når aktiv: i `setSnap`-callback, hvis bruker drar til `"96px"` → kall `store.close()` istedenfor `RESET_TO_DEFAULT` (lukk tour-gest). Hvis bruker drar opp til `0.5` eller `1` → tillatt. Hvis bruker drar til `"320px"` → tillatt (default-snap under tour).
- Faktisk pin-mekanikk: ved tour-start, kall `setSnap("320px")` én gang. La user-drag respekteres etter det, men 96px-drag tolkes som close-tour-gest.

**Patterns to follow:**
- `components/variants/report/board/mobile/BoardMobileSheet.tsx` eksisterende `RESET_TO_DEFAULT`-hook ved 96px-drag (PROJECT-LOG 2026-04-30)
- `data-*`-attribute-pattern (eksisterende konvensjon i Tailwind/HTML)

**Test scenarios:**
- Happy path: tour starter → desktop panel-section får `data-tour-active`, body-tekst opacity 0.5.
- Happy path: rail-button for aktiv tour-track får `data-active-during-tour`, pulse-animasjon kjører.
- Edge case: track-skifte → forrige pulse fjernes, ny pulse på neste rail-button (verifiseres i devtools-snapshot).
- Edge case: tour pauses → pulse-animasjon stoppes (eller fortsetter? — bestem ved visuell iterasjon).
- Edge case: `prefers-reduced-motion: reduce` → ingen pulse-animasjon, men `data-active-during-tour` settes likevel for visuell static-styling.
- Integration (mobile): start tour → sheet snapper til "320px"; bruker drar opp til 0.5 → tillatt; bruker drar ned til 96px → `store.close()` kalles, tour ends.

**Verification:**
- Chrome DevTools MCP: ta screenshot av desktop tour-modus (panel med dim + pulse + banner) og mobile (sheet pinnet + tab-bar med pulse). Sjekk visuell signatur tydelig markerer tour-mode.
- Manuell test: prefers-reduced-motion ON → ingen animasjon, men aktiv kategori er fortsatt visuelt markert.

---

- [ ] **Unit 6: Tour-end-skjerm**

**Goal:** Rendere "Hva vil du gjøre nå?"-skjermen med 3 shortcuts når siste track er ferdig.

**Requirements:** R8

**Dependencies:** Unit 3 (`phase === "ended"`), Unit 4 (banner unmounts korrekt).

**Files:**
- Create: `components/variants/report/board/audio-tour/TourEndScreen.tsx`
- Modify: `components/variants/report/board/desktop/BoardDetailPanel.tsx` (mount TourEndScreen når `store.phase === "ended"`)
- Modify: `components/variants/report/board/mobile/BoardMobileSheet.tsx` (samme)
- Test: `components/variants/report/board/audio-tour/TourEndScreen.test.tsx`

**Approach:**
- Komponent rendres fullbredde i panel/sheet-body når `phase === "ended"`.
- 3 knapper i visuell hierarki:
  1. **Primær: "Spill av igjen"** — full-bredde primary-button. Klikk → `store.start(tracks)` (samme tracks-array, restart fra trackIndex 0).
  2. **Sekundær: "Utforsk {kategori}"** — kategori velges deterministisk: første kategori i `themes[]` som ikke er Hjem og som ikke har vært overstyrt av aktiv state under tour. Fallback: første tema i `themes[]`. Klikk → `store.close()` + `dispatch(SELECT_CATEGORY)` til den valgte kategorien.
  3. **Tertiær: "Kontakt megler"** — secondary-button. Resolve mot `reportConfig.brokers[0]` (mailto:`broker.email`) eller `reportConfig.cta.url`. Hvis ingen broker/cta finnes: link til prosjekt-side eller skjul knappen.
- Footer-tekst: "Eller velg en kategori i listen for å utforske selv."
- Lukk-knapp ("×" top-right) → `store.close()` → tilbake til Hjem-panel.

**Patterns to follow:**
- `components/variants/report/board/desktop/BoardDetailPanel.tsx` `DefaultEmptyState` (struktur og typografi)
- `data.report.brokers` / `data.report.cta` lookup-mønster fra eksisterende panel-CTA-er

**Test scenarios:**
- Happy path: `phase === "ended"` → TourEndScreen rendres med 3 knapper synlige.
- Happy path: "Spill av igjen" → `store.start()` kalles med samme tracks; phase=playing, trackIndex=0.
- Happy path: "Utforsk {kategori}" → close + SELECT_CATEGORY dispatches.
- Edge case: `reportConfig.brokers` mangler OG `cta` mangler → "Kontakt megler"-knapp skjules.
- Edge case: `reportConfig.cta.url` finnes men ikke `brokers` → "Kontakt megler" → `cta.url` brukes.
- Integration: lukk-knapp → close + phase=idle, Hjem-panel synlig.

**Verification:**
- Manuell test: spill gjennom hele Spro Havn-touren, verifiser tour-end-skjerm vises på siste audio-ended.
- Devtools-snapshot på desktop + mobile.

---

- [ ] **Unit 7: Pipeline-integrasjon i `/generate-rapport`-skill**

**Goal:** Innskyt Steg 8c (manus + audio) i `.claude/skills/generate-rapport/SKILL.md` slik at audio-tour bygges automatisk for nye/oppdaterte prosjekter.

**Requirements:** R9, R11, R12

**Dependencies:** Unit 1, Unit 2 (skriptene må eksistere).

**Files:**
- Modify: `.claude/skills/generate-rapport/SKILL.md`
- Modify: `COMMANDS.md` (dokumenter nye skript-kommandoer)

**Approach:**
- Innsett nytt **Steg 8c** mellom Steg 8 (QA) og Steg 9 (DB-lagre).
- Steg 8c.1: kjør `npx tsx scripts/audio-manus-write.ts --project {urlSlug}` (sjekk exit-code, abort pipeline ved feil).
- Steg 8c.2 (gated på Andreas-QA av manus): kjør `npx tsx scripts/audio-tour-build.ts --project {urlSlug}`.
- Manuell-checkpoint mellom .1 og .2: skill ber Andreas lese manus (fetch fra DB), bekrefte at de er OK, før audio-bygging starter. Matcher eksisterende pattern fra `scripts/curate-narrative.ts` (`prepare` → human review → `apply`).
- Voice/model er hardkodet i skripene for pilot. Pipeline har ingen valg-prompt (det er en konfigurasjon vi endrer manuelt hvis voice byttes).
- Inkluder lyttebar QA-step i pipeline-output: "Lytte til `public/audio/{slug}/*.mp3` og signer kvalitet før release".

**Patterns to follow:**
- Eksisterende Steg 2.5 (grounding) og Steg 2.7 (curation) som blueprint
- `docs/solutions/feature-implementations/generate-bolig-quality-pipeline-rewrite-20260228.md` (step-ordering pitfalls)

**Test scenarios:**
- Test expectation: none — denne unit'en endrer en skill-markdown-fil + dokumentasjon, ingen test-bar logikk.

**Verification:**
- Kjør hele `/generate-rapport` mot et nytt test-prosjekt (eller re-run mot stasjonskvartalet) og bekreft at Steg 8c kjører.
- Etter pipeline: `public/audio/{slug}/`-mappe har MP3-er, DB har `audio`+`heroAudio`+`audioVersion`.
- Re-run for å verifisere idempotency (samme URLs, oppdatert `generatedAt`).

---

## System-Wide Impact

- **Interaction graph:** `audio-tour-store` (Zustand, ny) ↔ `BoardContext` (eksisterende reducer) via `use-audio-tour-sync`-hook. To-veis: store.trackIndex-change → BoardContext.SELECT_CATEGORY; BoardContext.SELECT_CATEGORY mens tour spiller → store.pause("category-clicked"). Ingen sirkulær trigger fordi sync-hook bruker `useRef` til å sjekke om endring er tour-driven vs bruker-driven.
- **Error propagation:** Audio-element `onerror` → store.setError → player-banner viser feilstate. Build-pipeline feil → script exit non-zero → skill-pipeline aborter (matcher eksisterende mønster).
- **State lifecycle risks:** Hvis bruker navigerer bort fra `/rapport-board` (klikker logo, browser-back), unmounter `ReportBoardPage`. `audio-tour-store.close()` bør kalles i unmount-cleanup for å stoppe audio-playback og resette state — ellers fortsetter audio-elementet å spille i bakgrunnen. Test: navigate-away unmount-cleanup verifiseres i `use-audio-element.ts`.
- **API surface parity:** Eksisterende `groundingVersion`-pattern reflekteres i ny `audioVersion`. Hvis senere features (e.g., engelsk audio) introduserer eget version-felt, må samme deep-merge-PATCH-disiplin følges.
- **Integration coverage:** Cross-layer scenarios som unit-tester ikke fanger: (a) ElevenLabs API failure mid-bygg når halve tracks er skrevet; (b) Supabase PATCH-conflict ved optimistic lock (manuell retry); (c) iOS Safari som blokkerer track 2-7 hvis vi mister `<audio>`-element-unlock (sjekk via chrome-devtools på en faktisk iPhone-simulator); (d) Vaul-snap-callback frekvens når brukeren drar sheet midt i et track-skifte.
- **Unchanged invariants:** `BoardState.phase` forblir `default | active | poi` — ingen ny `"tour"`-verdi. `RESET_TO_DEFAULT`-mekanikk på drag-til-96px forblir uendret (men tolkningen utvides til "lukk tour" når tour er aktiv). Eksisterende `groundingVersion` og grounding-PATCH-pipeline berøres ikke utenfor whitelist-update.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| iOS Safari blokkerer track 2+ til tross for delt `<audio>`-element-pattern (kjent edge-case når `<audio>` re-mountes eller hot-reload bytter referansen) | Mount `<audio>` element én gang ved `ReportBoardPage`-root, ikke per-banner-mount. Verifiser empirisk på faktisk iPhone Safari (WebKit-iOS er forskjellig fra chrome-devtools' WebKit-on-Blink-emulering) før prod-deploy. Hvis brutt: defer til post-pilot — re-plan med pre-instansiert audio-array som primær-pattern. |
| ElevenLabs API-kostnad/quota når Propr-skala blir reelt (1700/år × 7 tracks = 11900 calls/år) | Free plan rekker ikke. Pre-pilot: Daniel premade dekker. Post-pilot: oppgrader til Creator-plan ($22/mnd) som dokumentert i origin-doc. Cache-bust er manuell (bump audioVersion) for å unngå utilsiktet re-gen. |
| 30 sek/track + 70 ord cap er asserted, ikke validert — kan tvinge LLM til generisk innhold som motsier Curator-voice-kravet | Adversarial F1 i origin-doc. Plan-mitigering: manuell QA-checkpoint mellom manus og audio-bygg (Unit 7) lar Andreas korrigere før ElevenLabs-quota brennes. Hvis pilot-feedback peker på "rushed/generic": revurder cap til ~120 ord (≈45 sek). |
| Body-dim på 0.5 opacity gir for lite kontrast — bruker ser ikke at tour styrer | Provisional dim-level. Visuell iterasjon i dev-server før commit (Unit 5). Backup: kombinér opacity med en `outline`-ring på panel-container for ekstra signal. |
| Whitelist-update i `gemini-grounding.ts` miss → fremtidige grounding-PATCH'er overskriver audio-felt | Test scenario i Unit 1 dekker dette. Sjekk eksplisitt i Unit 7-verifikasjon: kjør grounding etter audio-bygg og verifiser at audio-felt overlever. |
| Audio-binærer i git blåser opp repo-historikk hvis re-bygg trigger frequent commits | Pilot er 1 prosjekt × ~3MB. Hvis pilot validerer: refactor til Vercel Blob (deferred). Foreløpig: ikke commit hvis kun `generatedAt` endrer seg (skript-skip-write-if-bytes-identisk er for komplekst — manuell git-disiplin). |
| `phase === "ended"`-state låses hvis bruker refresher mid-tour (URL har ingen tour-state) | Eksplisitt scope-grense (origin-doc): "Ingen URL-state for play-progress. Refresh starter alltid på Hjem". Store unmount-cleanup garanterer ren state ved page-load. |

## Documentation / Operational Notes

- **Post-pilot solutions-doc:** Skriv `docs/solutions/feature-implementations/megler-pitch-audio-tour-{YYYYMMDD}.md` etter Propr-feedback er mottatt. Bruk newer frontmatter shape (`module`, `problem_type`, `component`, `severity`, `applies_when`, `tags`) à la `safe-jsonb-rename-migration-with-runbook-20260422.md`.
- **PROJECT-LOG-entry:** Implementer logger sesjon i `PROJECT-LOG.md` etter Unit 7 lander (matchet til CLAUDE.md auto-prompt for utviklings-sesjon).
- **Business-logg-entry:** Strategi-event ved at Spro Havn-rapporten sendes til Kjetil/Karoline med audio-tour aktiv — logges i `docs/strategy/LOG.md` per CLAUDE.md auto-prompt for strategi-sesjon.
- **Operasjonell:** ElevenLabs-API-key (`ELEVENLABS_API_KEY` i `.env.local`) er Andreas' personlige free-plan-key. Hvis CI-bygg skal kjøre audio-pipeline: ny shared key + secrets-håndtering. For pilot kjører Andreas pipeline lokalt.

## Deferred / Open Questions

### From 2026-05-17 review

6 reviewers (coherence, feasibility, product-lens, design-lens, scope-guardian, adversarial) produserte 41 funn. 3 safe-auto-fixes ble applisert (revalidateTag-format, whitelist-key heroAudio, Risks-fallback-referanse). 4 scope-guardian-funn auto-skipped per Placy CLAUDE.md "Scope is Sacred". De resterende 34 funn er deferred til implementasjons-fasen og listes her for sporbarhet.

**Strategiske spørsmål (product-lens — krever bruker-beslutning før eller tidlig i pilot):**

- [Product F1] **"Wow-faktor" er ikke falsifiable som suksess-kriterium.** Pilot kan ikke skille "feil retning" fra "riktig retning, dårlig utførelse" hvis kun Propr-feedback teller. Reviewer-forslag: definer hva "eksplisitt positiv" betyr operasjonelt; legg til analytics-event (start-rate, fullføringsrate); før-spesifiser hva som utløser Retning A-revurdering.
- [Product F3] **Premise-mismatch: Propr-distribusjons-kontekst er ikke fysisk visning.** Audio antas konsumert på samme måte som megler-pitch, men T-bane/kveld-scrolling er motsatt kontekst. Brainstorm flagget lytte-rate-fallback, men planen har ingen lytte-rate-måling eller transcript-fallback. Reviewer-forslag: tilføy minimalt analytics-spor + konkret terskel i success criteria.
- [Product F4] **Auto-pitch-skaleringsargumentet er ufullført uten manus-kvalitet uten manuell QA.** Hvis Andreas er manus-filter for 1700/år, er pilot håndlaget — ikke skalert produkt. Reviewer-forslag: enten eksplisitt anerkjenn at pilot er håndlaget (fjern 1700/år-argumentet fra Retning B-rasjonalet), eller test 3 prosjekter blindt uten Andreas-QA.
- [Product F5] **Opportunity-cost mot Propr-base-pilot.** Audio-tour-arbeid skjer mens Propr-distribusjonen er den faktiske pilot-blokkeren. Reviewer-forslag: bekreft eksplisitt at Spro Havn kan sendes til Propr uten audio-tour hvis tour ikke er klar.
- [Product F8] **80/20-alternativ ikke vurdert: 90-sek megler-Loom-video.** Menneske-stemme + ansikt embedded som top-card kan levere samme outcome med null pipeline-arbeid. Reviewer-forslag: 1-dags eksperiment før Unit 1 starter — be Propr-megler om Loom for Spro Havn, send parallelt med plain rapport, sammenlign feedback.
- [Adversarial F7] **Propr-feedback-loop er udefinert — "silence within 14 days" har ingen interpretasjon.** Reviewer-forslag: definer go/no-go-checkpoint (e.g., "30 dager: hvis Propr ikke har gitt eksplisitt positiv signal, marker som unvalidated").

**Tekniske detaljer (krever konkretisering i implementasjons-fasen):**

- [Feasibility F2] **Eksisterende `setSnap`-callback i `BoardMobileSheet.tsx:110` må EKSPLISITT endres** for tour-aware 96px-drag-tolkning. Unit 5's "Modify"-liste sier ikke at handleren reorganiseres — implementer må huske dette.
- [Feasibility F3] **iOS Safari-verifikasjon via Chrome DevTools MCP er utilstrekkelig** — Chrome devtools' device-emulering er WebKit-on-Blink, ikke faktisk iOS Safari WebKit. Audio autoplay-policy er WebKit-spesifikk. Krever faktisk iPhone eller Xcode iOS Simulator.
- [Feasibility F4] **Argument-konvensjon avviker:** Plan sier `--project <urlSlug>`, eksisterende `gemini-grounding.ts` bruker positional `<project_id>`. Velg én ved implementering, prefer positional for konsistens.
- [Feasibility F5] **Tour-state cleanup ved in-page navigasjon (POI-overlays, Next.js Link til samme route)** er ikke spesifisert. Hard unmount er dekket, men mid-tour route-bytter er ikke.
- [Feasibility F6] **Empty MP3-respons (0-byte fra ElevenLabs rate-limit) ikke runtime-guarded** — Unit 2 må legge til min-bytes-validering før `writeFileSync`.
- [Coherence C3] **Pipeline-abort-semantikk mellom Unit 1, Unit 2 og Unit 7 er ambivalent.** Konkretiseres i implementering: Steg 8c.1 exit-non-zero må abort pipeline; Steg 8c.2 må kun starte hvis ALL manus eksisterer i DB.
- [Adversarial F1] **Shared `<audio>`-element-claim trenger empirisk verifisering på faktisk iPhone** (ikke chrome-devtools-simulator). Pre-instansiert audio-array er fallback hvis primary feiler — re-plan ved behov.
- [Adversarial F2] **To-veis sync-mekanikk mellom store og BoardContext** trenger eksplisitt useRef-flag-spec i Unit 3: `lastDispatchSource: "tour" | "user"`. Legg til test-case "store.next() trigger SELECT_CATEGORY men IKKE pause('category-clicked')". Vurder kommando-bus istedet for toveis-listening.
- [Adversarial F3] **Per-track PATCH bryter "enten alle eller ingen"-invarianten** i Unit 2. Refaktorér til to-fase: (1) generér alle MP3 lokalt + valider, (2) batch-write disk + batch-PATCH samme objekt. Eller: rollback-mekanikk ved partial-fail.
- [Adversarial F4] **70-ord-cap ikke validert mot Curator-voice-kvalitet** — legg til validerings-gate i Unit 1: hvis Andreas-QA av første iterasjon viser generisk prosa, juster ord-cap (60-100 ord-range OK) før Unit 2 starter ElevenLabs-quota-brenning.
- [Adversarial F5] **Multi-tab/multi-window audio-oppførsel** ikke adressert. Velg: eksplisitt scope-grense ("ikke koordinert"), eller BroadcastChannel-pause (lav-friksjon ~10 linjer).
- [Adversarial F6] **Daniel-voice deprecation/endring** mid-pilot har ingen rollback-strategi. Legg til Risk-tabell-entry + voice-felt-logging av faktisk brukt voice-ID.

**Design-detaljer (visuell iterasjon mot dev-server i Unit 4-6):**

- [Design D1] **Paused-by-category-click substate: dim+pulse-oppførsel uavklart.** Reviewer-forslag: når pauseReason === "category-clicked", dim lifter til 1.0, pulse på ny kategori stoppes, banner går til "Fortsett tour"-compact-state. Manuell pause kan ha annen oppførsel.
- [Design D2] **Error state recovery interaction.** Store har `setError()` men ikke `retryTrack()`. Reviewer-forslag: banner viser "Prøv igjen" (retry same src) + "Hopp over" (calls next()), legg til `retryTrack()`-action.
- [Design D3] **"Fortsett tour"-resume behavior:** tre tolkninger (resume mid-playback, jump to current category-track, resume + navigate panel tilbake). Velg eksplisitt før Unit 4 stenges.
- [Design D4] **Panel-body offset-mekanikk under sticky banner** ikke spesifisert. Reviewer-forslag: CSS custom property `--tour-banner-height` på mount + `padding-top: var(--tour-banner-height)` på panel-body.
- [Design D5] **Mobile banner-plassering vs Vaul drag-handle-region.** 320px peek - 64-72px banner - 56px tab-bar = ~192px synlig content. Sticky-top inni "sheet-header" risikerer Vaul-gesture-konflikt. Specifiser om banner sitter i Vaul-header-slot eller første-barn-av-scroll-content.
- [Design D6] **Progressbar fallback uten `durationSec`** (typed optional). Velg: equal-width-segments, hide fill, eller indeterminate-state. Specifiser også fill-reset ved prev/next skip.
- [Design D7] **TourEnd "Utforsk kategori" deterministisk-logikk** med "ikke har vært overstyrt"-betingelse er ambiguøs. Reviewer-forslag: forenkle til "first non-home theme" eller legg `manuallyVisitedCategoryIds: Set<string>` til store.
- [Design D8] **Player-banner keyboard nav + focus management på track-change.** Minimum-bar: focus blir på play/pause etter auto-advance + banner som `role="region" aria-label="Lydtur"`. Full keyboard nav deferred per scope.
- [Design D9] **AI slop risk: tour-end-screen copy** ("Spill av igjen", "Kontakt megler") følger ikke Curator-voice-register. Reviewer-forslag: legg til note i Unit 6 om å sjekke labels mot `voice-principles.md`.
- [Design D10] **`data-active-during-tour` betingelse** uklar mellom "phase === playing" vs "phase !== idle". Velg `phase === "playing"` for å unngå inkonsistens mellom Unit 4 og Unit 5.

**Suppressed scope-guardian-funn (per Placy CLAUDE.md "Scope is Sacred"):** SG1 (lib/audio-tour mid-tier), SG2 (p-limit-kontinuitet), SG3 (TourEnd-simplifisering), SG4 (build-time atomicity guard — dekkes funksjonelt av A3).

**FYI residual risks:**

- Re-bygg-idempotens: ElevenLabs TTS er ikke deterministisk; samme manus → ny audio = ny git-diff selv om innhold er likt.
- Audio-binærer i git: 3MB × 1 prosjekt for pilot OK; refactor til Vercel Blob hvis Propr-skala blir reelt.
- Manus-prompt + Curator-voice-prinsipper ikke testet sammen — muntlig 70-ord-pitch-register er nytt.
- ElevenLabs free-plan på Andreas' personlige key er single-person-avhengighet.

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-16-megler-pitch-audio-tour-brainstorm.md`
- **Pattern-foreldre:** `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md` (build-time LLM + whitelist + version-bump + cache-bust)
- **State-pattern-precedent:** `docs/solutions/feature-implementations/kompass-event-recommendation-prototype-20260311.md` (separat ephemeral Zustand-store)
- **Asset-pattern-precedent:** `docs/solutions/architecture-patterns/hand-drawn-spot-icons-ai-generated-20260413.md` (`THEME_ICONS` + `iconSrc` mal for `THEME_AUDIO` + `audioSrc`)
- **Mobile-sheet-pattern:** PROJECT-LOG.md 2026-04-30-sesjonene (multi-snap-sheet refactor, reading-phase cleanup)
- **Curator-voice:** `.claude/skills/curator/SKILL.md` + `references/voice-principles.md`
- **Pipeline-skill:** `.claude/skills/generate-rapport/SKILL.md`
- **ElevenLabs-validation:** `scripts/elevenlabs-validation.ts` (validated voice IDs, model, settings)
- **Memory:** `project_stage_prototype.md`, `feedback_mobile_native_ux.md`, `trondheim_events_spor.md` (Propr-pilot-kontekst)
