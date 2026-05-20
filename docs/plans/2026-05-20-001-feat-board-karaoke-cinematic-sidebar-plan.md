---
title: feat — Board karaoke text-sync + cinematic sidebar
type: feat
status: active
date: 2026-05-20
origin: docs/brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md
---

# feat — Board karaoke text-sync + cinematic sidebar

## Overview

Lever to UX-effekter som forsterker auto/manual-modus-konseptet i rapport-board (Stasjonskvartalet):

1. **Karaoke ord-for-ord** på audio-manus-tekst når voice-over spiller, basert på character-level timings fra ElevenLabs `/with-timestamps`-endpoint.
2. **Cinematic sidebar-active-state** — aktiv kategori står fram med opacity 100% + scale 1.15 + glow; inaktive dimmes til 30%; rail-bg fader mot transparent. Effekten er alltid på, scroll-driven i manual og audio-driven i auto.

Dette er en isolert UX-spike som leverer R18-R19b + KD9-KD10 fra brainstorm-dokumentet (se origin). Den **rører ikke** lead/body-tekst-rendering, POI-overlay, helhetlig scroll, eller pitch-text-pipeline (R1-R17) — det er separat plan.

## Problem Frame

Audio-tour på Stasjonskvartalet har i dag en player som flyter over en UI hvor sidebar-rail-en er navigasjons-affordance, ikke fokus-element, og hvor det ikke finnes noen visuell tilbakemelding på "hvor er voice-over nå i teksten". Det skaper to opplevelses-svakheter:

1. **Ingen kobling mellom det øret hører og det øyet ser** — brukeren får ingen forsterkning av at audio er "tett på" innholdet.
2. **Sidebar oppfattes som passiv** — den viser hvilken kategori som er aktiv, men hierarkiet er for flatt til at brukeren føler at "her er det vi snakker om nå".

Karaoke + cinematic forsterker både auto-modus (audio-driven) og manual-modus (scroll-driven) ved å gi tydelig visuell forankring uten å rive eksisterende lead/body-arkitektur (se origin).

## Requirements Trace

- R18. Karaoke ord-for-ord, kun i auto-modus (se origin)
- R18b. TTS-pipeline må bygge timing-data (`/with-timestamps`-endpoint, lagre timings per spor) (se origin)
- R19. Cinematic sidebar-active-state, alltid på (opacity 30/100, scale 1.15, glow, rail-bg-fade) (se origin)
- R19b. Aktiv-state-kilde-prioritet: audio vinner over scroll i split-brain (se origin)
- KD9. Karaoke kun i auto-modus, ikke scroll-basert i manual (se origin)
- KD10. Cinematic sidebar er alltid på, samme visuelle uttrykk i begge moduser (se origin)

## Scope Boundaries

- **Kun rapport-board (eiendom).** Explorer, Guide, Hotel/Næring forblir uendret.
- **Kun Stasjonskvartalet** som validerings-prosjekt. Andre prosjekter har ikke `audioTourEnabled === true` i dag.
- **Karaoke virker kun på `category.audio?.manus`-tekst** som allerede eksisterer i board-data. Ingen ny Gemini-pitch-pipeline. Hvis et spor ikke har manus, ingen karaoke-blokk.
- **Karaoke-blokken er separat UI-element**, ikke en erstatning av lead/body. Vises kun når et spor spiller. Lead/body-tekst forblir uendret som primær tekst.
- **TTS-uttale av problemord** (kajakk, Nidelva, Bakklandet) er parkert i `PROJECT-LOG.md` 2026-05-20-entry. Karaoke skal virke på dagens audio-spor med kjente uttalefeil — det aksepteres som "godt nok" i pilot.
- **Ingen URL-state for karaoke-token-position** — refresh nullstiller. Pause/scrub bevares via audio-element.

### Deferred to Separate Tasks

- **R1-R17 (helhetlig scroll, POI-overlay, pitch-text-pipeline):** Egen plan, se `docs/plans/2026-05-18-001-feat-rapport-board-helhetlig-narrativ-plan.md` for R1-R17-scope.
- **Pronunciation-fiks for problemord:** Notert i `PROJECT-LOG.md` 2026-05-20 — bygges når kommersiell pilot trigger PVC-investering eller når ElevenLabs lanserer pronunciation-support på turbo_v2_5.
- **Karaoke i mobil-modus:** Mobil-rendering har egen layout (`BoardMobileSheet`); validering der utsettes til etter desktop-MVP er bekreftet "føles riktig".

## Context & Research

### Relevant Code and Patterns

- `lib/audio-tour/elevenlabs-client.ts` — flat `generateAudio`-funksjon som returnerer `{ bytes, voice, model }`. Må utvides til å returnere `timings` ved bytte til `/with-timestamps`-endpoint.
- `scripts/audio-tour-build.ts` — orchestrer TTS-bygging og PATCH-er audio-objekt til Supabase. Må lagre `timings` per spor.
- `lib/types.ts` — `ReportThemeAudio`-type med `url`, `voice`, `model`, `generatedAt`, `manus`. Må utvides med `timings`.
- `components/variants/report/board/board-data.ts` — `adaptAudio`-funksjonen filtrerer audio-objekt før det eksponeres til board-laget. Må gjennomføre timings.
- `components/variants/report/board/audio-tour/use-audio-element.tsx` — eksponerer `currentTime` og `duration` via `AudioElementContext`. KaraokePitchText forbruker `currentTime` derfra.
- `components/variants/report/board/audio-tour/use-audio-tour-sync.ts` — sync mellom audio-store og BoardContext; brukes til å vite hvilken kategori-ID som er aktiv.
- `components/variants/report/board/desktop/BoardRail.tsx` — har allerede `active`-prop, `tourTrack`-state, og `pulsesDuringTour`-prop. Forsterke visuelt uttrykk.
- `components/variants/report/board/mobile/BoardCategoryTabBar.tsx` — speil av desktop-rail. Samme oppgradering.
- `lib/stores/audio-tour-store.ts` — Zustand-store for phase, trackIndex, tracks.

### Institutional Learnings

- `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md` — build-time-LLM-mønster (relevant fordi TTS-build også er build-time). audioVersion-bump-pattern brukes til å trigge re-gen.
- Worklog 2026-05-18 — Erik @ turbo_v2_5 + stability 0.75 er bestemt landing. Audio-version-bump er hvordan vi tvinger re-gen av spor når pipelinen endrer seg.

### External References

- ElevenLabs API: `/v1/text-to-speech/{voice_id}/with-timestamps` — returnerer JSON med `audio_base64` + `alignment.characters/character_start_times_seconds/character_end_times_seconds`. Bekreftes empirisk ved første pipeline-test.

## Key Technical Decisions

- **Karaoke-blokken er separat fra lead/body, vises kun ved aktiv avspilling.** Begrunnelse: spike-scope tillater ikke å rive lead/body (R17 parkert). Karaoke-tekst er en ny UI-modul som rendrer `category.audio.manus` med ord-spans, og er kun synlig når audio spiller for det sporet. I manual-mode er den skjult, og brukeren ser kun lead/body. Implikasjon: bruker ser to versjoner av tekst (lead/body i manual, audio-manus i auto). Det aksepteres som spike-trade-off; full unifisering kommer med R17.
- **Token-grenser er ord, ikke tegn.** Karaoke-effekten opererer på `<span>`-per-ord, men input-timings er character-level. En token-mapping-funksjon konverterer char-indekser til ord-spans (split på whitespace, hver token får start_ms fra første tegn). Begrunnelse: ord-presisjon er det opplevelses-koherent skillet (per brainstorm-preview); tegn-nivå ville flimre.
- **Cinematic-effekten er alltid på, men "active"-tilstand bestemmes av audio når den spiller.** I split-brain (R19b/R10): audio er source-of-truth selv om scroll-state divergerer. Effekten kjøres samme måte uansett kilde — ulik state-trigger, samme visuelle uttrykk.
- **audioVersion-bump trigger re-gen av alle 8 spor på Stasjonskvartalet.** Pipeline-endringen til `/with-timestamps` betyr at eksisterende MP3-er må re-genereres for å få timings-data. audioVersion bumpes fra 4 → 5 i `lib/types.ts` (per worklog 2026-05-18).
- **Karaoke-state-vedlikehold er deklarativ.** Ingen interval-timer eller imperativ animation; opacity for hvert ord-span er en pure-funksjon av (currentTime, tokenStart, tokenEnd). React re-rendrer ved hver `currentTime`-tick fra audio-element (~4 Hz). Begrunnelse: enklere edge-case-håndtering (scrub, pause, modus-bytte settes automatisk via currentTime-endring).

## Open Questions

### Resolved During Planning

- **Hvor i layout skal karaoke-blokken vises?** Over lead/body som ny modul, kun synlig når audio spiller for sporet. Lead/body forblir uendret. (Bestemt av spike-scope og KD9.)
- **Hva er token-presisjonen?** Ord, ikke tegn. Token-mapper konverterer char-timings til word-tokens. (Bestemt av brainstorm-preview-valg.)
- **Hva skjer ved spor-overgang i karaoke?** Forrige spors karaoke fryses på 100% opacity (alle ord opplyst, signaliserer "fullført"); ny spors karaoke starter på 0%. (Forslag i origin Open Questions, akseptert.)

### Deferred to Implementation

- **Eksakt CSS-easing for opacity-transition** (200ms ease-out per brainstorm-preview, men nøyaktig kurve testes visuelt).
- **Drift-toleranse mellom karaoke og audio.** Success-kriterium sier ≤200ms; faktisk drift måles og evalueres etter første rendering.
- **Edge-case: bruker scrubber bakover** — token-state må re-sync til ny currentTime. Triviell fordi opacity er pure-funksjon, men skal verifiseres empirisk.
- **Edge-case: audio-error mid-track** — karaoke-state. Sannsynligvis bare bli stående på siste opplyste ord. Verifiseres empirisk.
- **Glow-fargen i cinematic-state** — kategori-spesifikk farge fra eksisterende kategori-tema, eller en felles stone/amber-farge? Testes visuelt.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Karaoke-token-mapping (Unit 3):**

```
INPUT:
  text = "I Stasjonskvartalet blir hverdagen effektiv."
  timings = {
    characters: ["I", " ", "S", "t", "a", ...],
    character_start_times_seconds: [0.0, 0.1, 0.2, ...],
    character_end_times_seconds: [0.1, 0.2, 0.3, ...]
  }
  currentTime = 1.4s

TOKEN-MAPPING (build once per text+timings):
  tokens = [
    { text: "I", startMs: 0,    endMs: 100  },
    { text: "Stasjonskvartalet", startMs: 200, endMs: 1800 },
    { text: "blir", startMs: 1900, endMs: 2200 },
    ...
  ]

RENDER (per currentTime-tick):
  for each token:
    opacity = currentTime * 1000 >= token.startMs ? 1.0 : 0.4
  return <span opacity={opacity}>{token.text}</span>
```

**Cinematic-state-flow (Unit 5):**

```
                  ┌─ scroll-driven (manual mode) ──┐
state.activeCategoryId ──────────────────────────────┐
                                                     ├─→ BoardRail
tourTrack ────────────────────────────────────────────┘    (active prop)
                  └─ audio-driven (auto mode) ─────┘

Visual effect, both sources:
  inactive:  opacity 30%, scale 1.0
  active:    opacity 100%, scale 1.15, glow (kategori-farge, blur 20px),
             rail-bg fader til transparent når noe er aktivt
  transition: 400ms ease-out med slight bounce på scale
```

## Implementation Units

- [ ] **Unit 1: TTS-pipeline-bytte til `/with-timestamps`**

**Goal:** Bytte ElevenLabs-kall fra dagens flat-mp3-endpoint til `/with-timestamps`, returnere `{ bytes, voice, model, timings }`. Lagre timings i `ReportThemeAudio.timings` per spor og PATCH-e til Supabase. Bump `audioVersion` for å trigge re-gen.

**Requirements:** R18b

**Dependencies:** Ingen — første unit.

**Files:**
- Modify: `lib/audio-tour/elevenlabs-client.ts`
- Modify: `scripts/audio-tour-build.ts`
- Modify: `lib/types.ts` (legg til `timings` på `ReportThemeAudio`)

**Approach:**
- Endre `generateAudio` i `elevenlabs-client.ts` til å kalle `/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128`. Response er JSON med `audio_base64` (base64-encoded MP3) og `alignment` (timings).
- Returnere `GenerateAudioResult` utvidet med `timings: { characters: string[], characterStartTimesSeconds: number[], characterEndTimesSeconds: number[] }`.
- I `audio-tour-build.ts`: lagre timings i `audio.timings` (og `heroAudio.timings`) ved PATCH til Supabase.
- Bump `audioVersion` 4 → 5 i `lib/types.ts` + `scripts/audio-tour-build.ts` + `scripts/audio-manus-write.ts`.
- Kjør `npx tsx scripts/audio-tour-build.ts banenor-eiendom_stasjonskvartalet --force` for å re-generere alle 8 spor med timings.
- Verifiser i Supabase at `audio.timings` er lagret på alle 8 categories + heroAudio.

**Patterns to follow:**
- Eksisterende audioVersion-bump-mønster i `scripts/audio-tour-build.ts`.
- Eksisterende optimistic-lock-PATCH i `audio-tour-build.ts`.

**Test scenarios:**
- Happy path: kall til `generateAudio` returnerer `{ bytes, voice, model, timings }` der timings.characters.length matches manus-tegn-antall (omtrent, med whitespace-håndtering).
- Edge case: kort manus (<10 ord) — timings genereres uten feil.
- Edge case: manus med spesialtegn (æøå, bindestrek, anførselstegn) — timings inkluderer disse uten å falle over.
- Error path: ugyldig API-key → eksisterende error-håndtering kaster forståelig feilmelding.
- Integration: kjør hele `audio-tour-build.ts`-pipelinen mot Stasjonskvartalet med `--force`. Alle 8 spor får oppdatert `audio.timings` i Supabase.

**Verification:**
- Supabase REST-query mot `report_themes` returnerer `timings`-objekt med character-arrays for alle 8 spor.
- Lengde av `characters`-array matches omtrent manus-tegn-antall.
- `audioVersion` er 5 etter pipeline-kjøring.

---

- [ ] **Unit 2: Datamodell + board-data-adapter for timings**

**Goal:** Gjennomføre `audio.timings` fra Supabase-lag til board-data-lag, slik at front-end-komponenter kan forbruke det per kategori og hjem.

**Requirements:** R18b

**Dependencies:** Unit 1 (datamodell må først finnes i `lib/types.ts`).

**Files:**
- Modify: `components/variants/report/board/board-data.ts` (`adaptAudio`-funksjonen)
- Modify: `lib/types.ts` hvis ikke ferdig fra Unit 1

**Approach:**
- I `board-data.ts`: utvid `BoardAudio`-type med `timings: AudioTimings | null`.
- I `adaptAudio`: hvis `audio.url` og `audio.manus` og `audio.timings` finnes → returnere `{ url, manus, timings }`. Hvis `timings` mangler → returnere `{ url, manus, timings: null }` (graceful fallback når audio finnes men ikke timings).
- Re-eksportere `AudioTimings`-type fra `board-data.ts` for forbruk av karaoke-komponenten.

**Patterns to follow:**
- Eksisterende `adaptAudio`-mønster med "partial audio = undefined" (board-data.ts:115).

**Test scenarios:**
- Happy path: `audio = { url, manus, timings }` → adapter returnerer alle tre felter.
- Edge case: `audio = { url, manus }` (timings mangler) → adapter returnerer `{ url, manus, timings: null }`.
- Edge case: `audio = { manus }` (url mangler) → adapter returnerer `undefined` (eksisterende oppførsel).
- Integration: `adaptBoardData` med Stasjonskvartalet-payload produserer `BoardCategory.audio.timings` på alle 8 spor.

**Verification:**
- TypeScript-compile uten feil.
- Unit-test bekrefter adapter-oppførsel for alle audio-shape-varianter.

---

- [ ] **Unit 3: `KaraokePitchText`-komponent**

**Goal:** Pure komponent som rendrer audio-manus med ord-spans og opacity-state synket til `currentTime` fra audio-element-context.

**Requirements:** R18, KD9

**Dependencies:** Unit 2 (timings må være tilgjengelig i board-data).

**Files:**
- Create: `components/variants/report/board/audio-tour/KaraokePitchText.tsx`
- Create: `components/variants/report/board/audio-tour/KaraokePitchText.test.tsx`
- Create: `components/variants/report/board/audio-tour/karaoke-tokens.ts` (pure token-mapper)
- Create: `components/variants/report/board/audio-tour/karaoke-tokens.test.ts`

**Approach:**
- `karaoke-tokens.ts`: pure funksjon `mapCharTimingsToWords(text, timings) → Token[]`. Hver token = `{ text, startMs, endMs, charStartIndex, charEndIndex }`. Splitt på whitespace; for hver ord-token, finn første og siste tegn-indeks i timings-arrayet og hent ut start/end-ms.
- `KaraokePitchText.tsx`: forbruker `useAudioElement()` for `currentTime`. Tar props: `{ text, timings, isActive }`. Hvis `isActive === false` eller `timings === null` → rendrer tekst i full opacity uten karaoke-effekt (manual-modus). Hvis `isActive === true` → kjør token-mapper, render `<span>` per token med opacity = funksjon av currentTime vs token.startMs.
- Opacity-transition: `transition-opacity duration-200 ease-out` (Tailwind utility).
- Whitespace-håndtering: render whitespace mellom spans som tekst-noder (ikke spans).

**Patterns to follow:**
- Pure-funksjon + react-komponent-skille (eksisterende mønster i `lib/curation/poi-linker.ts` + `LinkedSegments.tsx`).

**Test scenarios:**
- Happy path: enkel tekst med 3 ord og kjente timings → token-mapper returnerer 3 tokens med korrekte start/end-ms.
- Happy path (komponent): isActive=true og currentTime=0 → alle spans har opacity 0.4. currentTime=2s med token2.startMs=1500 → token1+token2 har opacity 1.0, token3 har 0.4.
- Edge case: tom tekst → tom token-array, komponent rendrer ingenting.
- Edge case: tekst med flere whitespace mellom ord → tokens har korrekt charStartIndex som ikke kollapser whitespace.
- Edge case: tekst med æøå-tegn → tokens har korrekt start/end-ms (verifiser at multibyte-tegn ikke skifter indekser feil).
- Edge case: tekst med bindestrek ("Bakk-lan-na" som ett ord) → ett token, ikke tre.
- Edge case: isActive=false → ingen karaoke-effekt, tekst rendres i full opacity som klartekst.
- Edge case: timings=null → samme oppførsel som isActive=false.
- Error path: timings.character-array har annen lengde enn tekst (data-corruption) → komponent failer gracefully (logger advarsel, rendrer tekst uten karaoke).
- Integration: rendres med ekte audio-element-context og tids-tick → opacity-state oppdateres ~4 Hz.

**Verification:**
- Komponent-tester passerer (Vitest).
- Visuelt: render i Storybook eller dedikert test-side, snippet av Stasjonskvartalet-spor 1 (~30 sekunder). Karaoke synker ord-for-ord med audio.

---

- [ ] **Unit 4: Integrere `KaraokePitchText` i layout**

**Goal:** Vise `KaraokePitchText` over lead/body i `BoardCategoryInfoTab` (kategori-seksjoner) og i `BoardScrollPanel` (Hjem-seksjonen) når audio spiller på det aktuelle sporet.

**Requirements:** R18, KD9

**Dependencies:** Unit 3.

**Files:**
- Modify: `components/variants/report/board/BoardCategoryInfoTab.tsx`
- Modify: `components/variants/report/board/desktop/BoardScrollPanel.tsx`

**Approach:**
- I `BoardCategoryInfoTab`: hvis `category.audio?.manus && category.audio?.timings` → render `<KaraokePitchText text={category.audio.manus} timings={category.audio.timings} isActive={isAudioActiveForCategory(category.id)} />` over eksisterende lead/body-blokk. `isAudioActiveForCategory` utledes fra `useAudioTourStore`-state (phase === "playing" && tracks[trackIndex].categoryId === category.id).
- I `BoardScrollPanel`: samme mønster for `home.audio` på Hjem-seksjonen.
- Visuell plassering: KaraokePitchText-blokken vises mellom kategori-illustrasjon og lead/body, med tydelig padding/border som indikerer "this is the currently-playing track". Eksakt styling bestemmes visuelt i Unit 6.
- I manual-modus (audio ikke playing eller spiller annet spor): KaraokePitchText er fortsatt mounted, men `isActive=false` → rendres som klartekst i full opacity. Vurder å skjule helt for å unngå dobling med lead/body — testes visuelt.

**Patterns to follow:**
- Eksisterende `BoardCategoryInfoTab`-struktur (linjer 39-67) for hvordan komponenter komponeres.

**Test scenarios:**
- Happy path: Stasjonskvartalet, Mat-drikke-spor spilles → KaraokePitchText vises i Mat-drikke-seksjonen med isActive=true; andre seksjoner viser KaraokePitchText med isActive=false (eller skjult).
- Happy path: Hjem-spor spilles → KaraokePitchText vises i Hjem-seksjonen.
- Edge case: kategori uten `audio.timings` → KaraokePitchText rendres ikke (graceful fallback).
- Edge case: audio paused → isActive forblir true for siste-aktive spor (karaoke fryser).
- Integration: bytter mellom spor → forrige seksjons karaoke fryser på siste opplyste ord; ny seksjons karaoke starter fra 0%.

**Verification:**
- Visuelt på `/eiendom/banenor-eiendom/stasjonskvartalet/rapport-board`: når tour spiller, ser man karaoke-tekst over lead/body for aktivt spor.
- Manual-modus: KaraokePitchText er enten skjult eller rendres som klartekst (avhengig av visuell test-utfall).

---

- [ ] **Unit 5: Cinematic sidebar-active-state**

**Goal:** Oppgradere `BoardRail.tsx` (desktop) og `BoardCategoryTabBar.tsx` (mobile) til cinematic visuelt uttrykk: inaktive opacity 30%, aktiv opacity 100% + scale 1.15 + glow + rail-bg-fade.

**Requirements:** R19, R19b, KD10

**Dependencies:** Ingen — parallell med Unit 1-4.

**Files:**
- Modify: `components/variants/report/board/desktop/BoardRail.tsx`
- Modify: `components/variants/report/board/mobile/BoardCategoryTabBar.tsx`
- Modify: `components/variants/report/board/audio-tour/tour-mode.css` (utvidet med cinematic-CSS hvis eksisterende mønster bruker CSS-fil; ellers Tailwind direkte)
- Test: `components/variants/report/board/desktop/BoardRail.test.tsx` (opprett hvis ikke eksisterer)

**Approach:**
- I `BoardRail.tsx`: utvide eksisterende `active`-prop-styling. Inaktive knapper får `opacity-30 scale-100`. Aktiv knapp får `opacity-100 scale-110 ring-2 ring-offset-2` + en glow-effekt via `shadow-[0_0_20px_rgba(var(--cat-color),0.4)]`. Transition: `transition-all duration-400 ease-out`.
- Rail-bg: når noen knapp er aktiv, rail-container får `bg-stone-100/0` (fra `bg-stone-100/100`). Transition: 400ms.
- Label: aktiv kategori viser kategori-navn ved siden av ikon (slide-in fra venstre, 300ms). Inaktive viser ikke label.
- Audio-driven prioritet (R19b): hvis `tourTrack === cat.id`, er den aktiv (override scroll-state). Eksisterende `pulsesDuringTour`-prop dekker delvis dette, men cinematic-effekten skal være eksplisitt audio-aware.
- Samme oppgradering i `BoardCategoryTabBar.tsx` for mobil. Vurdere om scale 1.15 er passende på små skjermer; kanskje 1.08.
- Hjem-knapp får samme behandling.

**Patterns to follow:**
- Eksisterende `data-active-during-tour` data-attribute i `BoardRail.tsx`:57 + `pulsesDuringTour` i `BoardRail.tsx`:78.
- Eksisterende `tour-mode.css` for pulse-animasjon-mønster.

**Test scenarios:**
- Happy path (manual mode): scroll til Mat-drikke → Mat-drikke-knapp får opacity 100, scale 1.15, glow; andre får opacity 30.
- Happy path (auto mode): tour spiller Mat-drikke-spor → samme visuelle uttrykk, men trigget av tourTrack i stedet for scroll.
- Edge case (split-brain): autoscroll pauset (bruker scroller selv), audio fortsetter på Mat-drikke. tourTrack er sannferdig kilde → Mat-drikke forblir aktiv selv om scroll er på Transport.
- Edge case: ingen kategori aktiv (Hjem-seksjon eller på topp) → Hjem-knappen får cinematic-state, rail-bg fader.
- Edge case (reduced-motion): respekt `prefers-reduced-motion: reduce` → transitions reduseres til 0ms, scale-bounce fjernes.
- Integration: bytte fra manual til auto-mode (klikk på start-tour) → cinematic-state holder seg uten flickering.

**Verification:**
- Visuelt: scroll og tour-avspilling viser cinematic-effekten både i desktop og mobil.
- `prefers-reduced-motion`-test: aktiver i Chrome DevTools → ingen scale-bounce, kort transition.

---

- [ ] **Unit 6: Visuell validering og polering**

**Goal:** Verifisere at karaoke + cinematic "føles riktig" på Stasjonskvartalet-rapport-boardet. Iterere på CSS-detaljer (drift, opacity-kurve, glow-intensitet) basert på visuelt utfall.

**Requirements:** Success Criteria fra origin (karaoke-drift ≤200ms, cinematic-fokus uten å konkurrere med innhold)

**Dependencies:** Unit 1-5.

**Files:**
- Iterativ modifisering av Unit 3-5 baserte på funn.
- Mulig: nye screenshots i `screenshot-karaoke-*.png` for før/etter-dokumentasjon.

**Approach:**
- Kjør dev-server (port 3001 eller 3002 fra worktree, sjekk `npm run dev`-output).
- Last `/eiendom/banenor-eiendom/stasjonskvartalet/rapport-board`.
- Manuell test-sekvens:
  1. Manual scroll gjennom alle 8 seksjoner → cinematic-effekten i sidebar, ingen karaoke-effekt (KaraokePitchText skjult eller klartekst).
  2. Start tour fra Hjem → karaoke + cinematic samarbeid på Hjem-spor.
  3. La tour glir til Mat-drikke → forrige seksjons karaoke fryser, ny starter.
  4. Pause i player → karaoke fryser på siste ord.
  5. Scrub bakover i player → karaoke re-syncs til ny posisjon.
  6. Bruker-scroll under autoscroll (split-brain) → sidebar følger audio (R19b), ikke scroll.
  7. End-of-tour → karaoke fryser på 100%, player auto-dismisses.
- Måle drift mellom karaoke og audio: ta video med skjerm-recording + audio, sammenligne ord-highlighting med voice-over-uttale. Mål drift på 3-5 ord per spor, snitt skal være ≤200ms.
- Vurdere visuelt om KaraokePitchText skal være SKJULT i manual-mode eller vises som klartekst — bestemt av om dobling med lead/body føles forvirrende.

**Patterns to follow:**
- Eksisterende worktree-screenshot-mønster (root-mappen har `screenshot-*.png`-filer fra tidligere validering).

**Test scenarios:**
- Test expectation: manuell visuell verifisering med Chrome DevTools. Ingen automatiserte tester her — det er en MVP-aksept.

**Verification:**
- Bruker (du) godkjenner subjektivt at karaoke + cinematic "føles riktig".
- Drift målt og dokumentert i `PROJECT-LOG.md`.
- Screenshots tatt for før/etter (kunne sammenlignes mot eksisterende `screenshot-mini-popup-*` for kontekst).

## System-Wide Impact

- **Interaction graph:** Karaoke-state forbrukes av `KaraokePitchText` via `useAudioElement().currentTime`. `useAudioTourStore` styrer hvilken kategori som er "aktiv for karaoke" (via tracks[trackIndex].categoryId). Cinematic-state i `BoardRail` forbrukes via eksisterende `useTourActiveTrackCategory` + `state.activeCategoryId`.
- **Error propagation:** Hvis `/with-timestamps`-respons mangler timings-felt → audio-tour-build kaster eksplisitt feil (ikke silent fallback til null). Hvis Supabase mangler timings → board-data-adapter sender `timings: null`, og KaraokePitchText rendres som klartekst.
- **State lifecycle risks:** Karaoke-state nullstilles automatisk når audio-element bytter src (Unit 3 er pure-funksjon av currentTime, ingen lokal state). Ingen lekkasje. Cinematic-state følger eksisterende lifecycle.
- **API surface parity:** Karaoke-blokken vises kun i desktop-shell i denne planen. Mobil-modus får oppgradert sidebar (Unit 5) men ikke karaoke-tekst-blokken — det er deferred til etter desktop-MVP er bekreftet.
- **Integration coverage:** Token-mapper må verifiseres mot ekte ElevenLabs-respons med norske tegn (æøå, bindestrek, anførselstegn). Unit 3-tester dekker dette med syntetisk data; Unit 1 verifiserer med ekte respons.
- **Unchanged invariants:** Lead/body-rendering i `BoardCategoryInfoTab` er uendret. POI-overlay, kart-pin-state, audio-tour-store-action-er forblir like. Karaoke er additiv UI-modul, ikke en erstatning.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| ElevenLabs `/with-timestamps` returnerer ikke alignment for `eleven_turbo_v2_5` (modell-begrensning) | Verifisere empirisk i Unit 1 før vi skriver Unit 3. Hvis turbo ikke støtter — fallback til `eleven_multilingual_v2`-modell for karaoke-spor (men risikerer svensk/dansk-uttale per worklog 2026-05-18), eller deferred karaoke til vi tar PVC-investering. |
| Karaoke drift >500ms gjør effekten irriterende heller enn behagelig | Måle empirisk i Unit 6. Hvis drift er for stor — undersøk om `currentTime`-tick-frekvens fra audio-element kan økes (sannsynligvis bundet til browser, ikke vår kontroll), eller om timings-mapping har bug. |
| Cinematic-effekten i 2D-modus er "for mye drama" per brainstorm-preview-bekymring | Visuell validering i Unit 6. Mulig fallback: tune ned scale fra 1.15 til 1.08 og opacity fra 30 til 50. Iterere visuelt. |
| Re-generering av alle 8 spor (Unit 1) bruker ElevenLabs-kvote | Sjekke kvote-status før kjøring. 8 spor × ~70-90 ord ≈ 6000 tegn → ca 6000 credits. Innenfor månedsbudsjett. |
| `audioVersion`-bump trigger re-gen i alle prosjekter, men kun Stasjonskvartalet har audioTourEnabled | Kjør bare `audio-tour-build.ts banenor-eiendom_stasjonskvartalet`. audioVersion-bump er informativ-flag, ikke automatisk re-gen. |
| KaraokePitchText i manual-mode skaper dobling med lead/body | Visuell validering i Unit 6. Hvis dobling føles dårlig → skjul KaraokePitchText i manual-mode (kun mounted hvis isAudioActiveForCategory). |
| Norske tegn (æøå) i character-arrays fra ElevenLabs alignment har feil indekser pga UTF-8 multibyte | Unit 3-tester dekker dette syntetisk. Unit 1 verifiserer med ekte respons. Hvis feil — string-iteration må bruke Unicode-code-points, ikke UTF-16-units. |

## Documentation / Operational Notes

- **Etter Unit 6:** Oppdater `PROJECT-LOG.md` med entry for 2026-05-20 (eller datoen MVP lander) som dokumenterer karaoke-MVP, drift målt, og avgjørelser om cinematic-tuning.
- **Hvis turbo_v2_5 ikke støtter timings** (Unit 1 funn): oppdater `PROJECT-LOG.md` TODO-entry for TTS-uttale med ny linje om timestamp-støtte.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md` (særlig R18-R19b og KD9-KD10)
- Eksisterende plan (R1-R17, ikke i scope her): `docs/plans/2026-05-18-001-feat-rapport-board-helhetlig-narrativ-plan.md`
- Worklog 2026-05-20: TODO TTS-uttale i `PROJECT-LOG.md`
- Worklog 2026-05-18: ElevenLabs-pivot og Erik @ turbo_v2_5-landing
- Related code:
  - `lib/audio-tour/elevenlabs-client.ts`
  - `lib/audio-tour/manus.ts`
  - `scripts/audio-tour-build.ts`
  - `components/variants/report/board/board-data.ts`
  - `components/variants/report/board/audio-tour/use-audio-element.tsx`
  - `components/variants/report/board/audio-tour/use-audio-tour-sync.ts`
  - `components/variants/report/board/desktop/BoardRail.tsx`
  - `components/variants/report/board/mobile/BoardCategoryTabBar.tsx`
- External: ElevenLabs API-dokumentasjon for `/v1/text-to-speech/{voice_id}/with-timestamps`
