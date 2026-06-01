---
title: Rapport-Reels — mobil-first vertikal stack for Stasjonskvartalet
type: feat
status: active
date: 2026-05-24
deepened: 2026-05-24
origin: docs/brainstorms/2026-05-24-placy-reels-brainstorm.md
---

# Rapport-Reels — mobil-first vertikal stack for Stasjonskvartalet

## Overview

Ny mobil-first route `/eiendom/[customer]/[project]/rapport-reels` (MVP: Stasjonskvartalet) som rendrer en vertikal stack av full-viewport "kort", én per kategori, i Reels/TikTok/Shorts-mønster. Hvert kategori-kort har to faser i samme DOM-node: først parallax-stillbilde + voice over (~10 sek), deretter et kart med kategori-filtrerte markører som fader inn. Swipe-up bytter kort.

Routen er parallell til dagens `rapport-board` — ikke erstatning. Eksisterende byggekloss-systemer (audio-tour-store, kart-komponent, illustrasjoner, kategori-data) gjenbrukes så langt det går; det nye er kun komposisjons-laget over.

## Problem Frame

Brainstormen (`docs/brainstorms/2026-05-24-placy-reels-brainstorm.md`) lander to innsikter:

1. **SOME-Reels-pipelinen vi har bygget** produserer assets (animerte illustrasjoner, voice over, kompositt-video) som ER Placy-asset. De samme illustrasjonene som lever i Rapporten, samme TTS-pipeline som audio-tour.
2. **Mobile-Rapporten i dag** lever som bottom-sheet over kart. Det er funksjonelt, men har ingen "scroll-stopper"-fortelling — bruker må aktivt utforske for å forstå nærområdet.

Hypotesen: stacked Reels-feed (én per kategori) bruker SOME-grammatikken som *grunnform* for mobil-Rapporten, ikke som markedsføring av den. Bruker swiper gjennom kategoriene, ser hver presentert visuelt + auditivt, og får kartet aktivert ved completion eller tap. Det er Rapporten omskrevet som feed, ikke en ny visning av samme data.

## Requirements Trace

- **R1.** Mobil bruker kan åpne `/eiendom/banenor-eiendom/stasjonskvartalet/rapport-reels` og se intro-Reel autoplay
- **R2.** Swipe-up bytter til neste kort (CSS scroll-snap)
- **R3.** Voice over starter automatisk når kategori-kort kommer i view, stoppes når kort forlates
- **R4.** Når voice over slutter ELLER bruker tapper på Reelen, fader kartet inn med kun den kategoriens markører
- **R5.** Tap på "trykk for å utforske"-overlay aktiverer pan/zoom på kartet
- **R6.** Swipe-up når som helst tar bruker til neste kategori (uavhengig av om kart er aktivert)
- **R7.** Audio fra forrige kort overlapper ikke med nytt kort (cleanup ved swipe)
- **R8.** MVP inkluderer intro-kort + 2 kategori-kort (Mat & drikke, Transport)

## Scope Boundaries

- Mobil-only — desktop får enkel "Best på mobil — åpne på telefonen" / redirect til `/rapport-board`. Ikke responsiv layout for desktop.
- Kun Stasjonskvartalet (Banenor Eiendom) som prosjekt
- Kun 2 kategori-kort: **Mat & drikke** og **Transport** (validér flyten først)
- Parallax på stillbilder, **ikke** Veo-animerte løkker
- Tap-to-skip på voice over (returnerende brukere)
- Per-kategori audio fra eksisterende `BoardAudioTrack` (allerede generert)
- Ingen ny audio-generering, ingen nye illustrasjoner, ingen ny Veo-rendering
- Ingen analytics/telemetri-instrumentering i MVP

### Deferred to Separate Tasks

- **Veo-animerte løkker per kategori**: Visuell oppgradering fra parallax-stillbilder. Avhenger av MVP-flow-validering. Egen plan når MVP er testet.
- **Resterende kategorier** (Hverdagsliv, Natur & friluftsliv, Opplevelser, Trening & aktivitet, Barn & oppvekst): Rulles ut etter MVP-validering — krever ingen ny kode, bare data-utvidelse.
- **Andre prosjekter enn Stasjonskvartalet**: Etter MVP. Krever verifisering at hvert prosjekt har audio + illustrasjoner per kategori.
- **Erstatning av `rapport-board`**: Parallell rute først. Konsoliderings-beslutning kommer etter brukertesting.
- **Desktop-versjon**: Hvis MVP validerer, vurder hvordan det skal oppføre seg på desktop (split-view? feed-mode? redirect?).
- **"Neste kategori"-knapp i kart-fasen**: Bruker foreslo en X-sirkel; vi forutsetter at swipe-up holder for MVP. Kommer eventuelt etter brukertest.
- **Analytics/engagement-måling**: Hvilke kort fullføres, hvor lang tid per kort, hvor mange aktiverer kartet. Egen instrumentering-task.

## Context & Research

### Relevant Code and Patterns

**Routing og data:**
- `app/eiendom/[customer]/[project]/rapport-board/page.tsx` — kopier-mal for ny route. Server-component med `params: Promise<{customer, project}>`, `unstable_cache` med tag `product:${customer}_${projectSlug}`, parallel data-fetch.
- `lib/data-server.ts` — `getProductAsync(customer, projectSlug, "report")` returnerer prosjekt-data fra Supabase.
- `components/variants/report/board/board-data.ts` — `BoardData`, `BoardCategory`, `BoardAudioTrack`-typer. **NB: lever i `components/`, ikke `lib/board/`** (kun `featured-pois.ts` der).

**Audio-tour (gjenbruk uendret):**
- `lib/stores/audio-tour-store.ts` — Zustand store med `phase: idle|playing|paused|ended|error`, `tracks[]`, `trackIndex`, actions `start/pause/resume/goToTrack/next/prev/close`.
- `components/variants/report/board/audio-tour/use-audio-element.tsx` — `<audio>`-element mountet ÉN gang i `AudioElementProvider` (iOS unlock-mønster). Eksponerer `currentTime + duration` via Context.
- `components/variants/report/board/audio-tour/KaraokePitchText.tsx` — props `{text, timings?, isActive, className?}`. Linje-nivå-måling via `useLayoutEffect` + DOM bounding rects. Fallback til klartekst når `timings` mangler.

**Kart (gjenbruk med tilpasning):**
- `components/variants/report/board/BoardMap.tsx` — bruker `react-map-gl/mapbox` v8. Ingen kategori-filter-prop i dag; filtrering er internt via `useBoard()`.
- `components/variants/report/board/BoardMarker.tsx` — har `isVisible`-prop med opacity+scale-transition (300ms). Bruker DOM-identitet på tvers av kategori-skifter. Gull for vår use case.

**Hooks:**
- `lib/hooks/useMediaQuery.ts` — SSR-safe matchMedia-wrapper. Bruk `(min-width: 1024px)` for desktop-detect.

**SOME-video:**
- Den eksisterende `composed-some-kategori.mp4` lever på `~/Desktop/placy-test/output/`. Må kopieres inn i `public/reels/stasjonskvartalet/intro.mp4` som del av denne planen.

### Institutional Learnings

- **`docs/solutions/feature-implementations/report-scroll-synced-sticky-map-20260208.md`** — kritisk: bruk ÉN delt Mapbox-instans + GPU-opacity-toggle på markører, ikke remount per kort. iOS Safari WebGL-context-limit gjør N-instans-løsning ustabil.
- **`docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md`** — bekrefter samme: kun ÉN aktiv WebGL-context per side på iOS Safari.
- **`docs/solutions/architecture-patterns/map-adapter-pattern-20260419.md`** — token-pattern for cancellable kamera-pan. Bruker ved rask swipe (gammel `flyTo()` må kanselleres når ny kategori aktiveres).
- **`docs/solutions/ui-bugs/adaptive-markers-zoom-state-timing-bug-20260208.md`** — bruk eksplisitt `mapLoaded`-flag fra `onLoad`-callback som dep, ikke ref-objekter.
- **`docs/solutions/ui-bugs/mapbox-markers-invisible-missing-css-EventRoute-20260413.md`** — `mapbox-gl.css` må eksplisitt importeres i hver ny route, ellers blir markører 937px brede og usynlige.

### External References

Ikke aktuelt — eksisterende repo-mønstre + brainstorm-research er tilstrekkelig.

## Key Technical Decisions

- **Scroll-mekanikk: CSS `scroll-snap-type: y mandatory`**, ikke Framer Motion drag. Begrunnelse: Framer Motion er ikke installert. CSS-snap er native, mobil-vennlig, GPU-akselerert. `IntersectionObserver` med `threshold: 0.7` tracker aktivt kort.

- **State-mgmt: egen `ReelsContext` (React Context + useReducer)**, ikke gjenbruk `BoardContext`. Begrunnelse: ReelsContext har en annen modell som ikke maps rent til BoardContext. `useAudioTourStore` (Zustand) deles uendret.

- **Phase-state-modell: global current-card phase + index**, ikke per-kategori-Record. State-shape: `{ cards: ReelsCard[], activeIndex: number, currentPhase: "intro" | "audio-locked" | "reel" | "map" | "map-activated" }`. Når bruker swiper til nytt kort, resetter `currentPhase` til kortets default ("intro" for intro-kort, "reel" for kategori). Returbesøk til samme kort starter også fra default — vi behandler hver visning som ny. Forenkler både rendring og audio-orkestrering.

- **Mapbox: lazy-mount-once på første map-fase**, ikke shared-from-start. Begrunnelse: iOS Safari WebGL-context-limit krever én instans, men lazy-mount eliminerer også camera-leak-problemet (ingen stale flyTo-state fra forrige kategori synlig under intro/reel-fasen). Når første kategori-kort skifter til map-fase, mountes ReelsMap én gang og lever resten av sesjonen. Markører rendres kun for MVP-kategoriene (Mat & drikke + Transport), filtrert via `isVisible`-prop på `BoardMarker`.

- **Kart-kamera: `fitBounds` på kategoriens POI-er**, ikke `flyTo({center: categoryCentroid})`. `BoardCategory` har ingen precomputed centroid; bruk `mapboxgl.LngLatBounds` fra `category.pois.map(p => p.coords)` med padding for at karaoke-overlayen ikke dekker markørene. Token-pattern fra `map-adapter-pattern-20260419.md` kansellerer pågående `fitBounds` hvis bruker swiper raskt.

- **Voice over: én pre-bygget tracks-array + `goToTrack(i)` på swipe**, ikke `start([single-track])` per kort. Eksakt API: `useAudioTourStore.start(tracks: AudioTrack[])` (positional arg, ikke options-objekt — verifisert mot `lib/stores/audio-tour-store.ts:97`). Reels-routen kaller `start(allCategoryTracks)` én gang ved første kategori-aktivering, deretter `goToTrack(i)` på IntersectionObserver-trigger. Eliminerer rapid-swipe race conditions og matcher store-API-en direkte.

- **iOS Safari audio-unlock: eksplisitt "Start opplevelsen"-knapp på intro-kortet** før noen audio kan spille. Brukerens tap på knappen kaller `audio.play()` + umiddelbart `pause()` for å unlocke `<audio>`-elementet for resten av sesjonen. Etterpå kan IntersectionObserver-callbacks trigge `goToTrack(i)` uten å treffe iOS-autoplay-policy. Eliminerer load-bearing antakelse fra opprinnelig plan.

- **Karaoke i Reels-fasen: ja, via `KaraokePitchText`** med eksisterende `timings`-data på `BoardAudioTrack`. Fallback til statisk tekst når `timings` mangler (eksisterende komponent-oppførsel).

- **Parallax: statisk illustrasjon i MVP**. Ingen scroll-driven parallax i Unit 5. Hvis det føles dødt etter manuell test, kan en subtle 5% `translate3d`-drift legges til som Unit 8-polish — men ikke et MVP-krav. Begrunnelse: parallax svarer ikke på "fungerer Reels-flyten for Placy?" — det er gold-plating. Veo-animerte løkker (deferred) er den ekte visuelle oppgraderingen.

- **Kart-gestures: disabled via react-map-gl-props (`dragPan={false} scrollZoom={false} doubleClickZoom={false} touchZoomRotate={false}`) ved initial render**. Når bruker tapper "trykk for å utforske"-overlay, kaller vi imperativt `map.dragPan.enable()` osv. på Mapbox-instansen. (NB: `mapboxgl-handlers-disabled-by-default` fra første utkast finnes ikke som Mapbox-flag — fjernet.)

- **Desktop-fallback: client-side `useMediaQuery("(min-width: 1024px)")` + "Best på mobil"-skjerm**, ikke server-side UA-redirect. Begrunnelse: UA-deteksjon bryter Chrome DevTools mobile-emulering (alle dev/test-økter ville fått redirect). Client-gate respekterer viewport, fungerer i devtools, og holder routing-laget enkelt.

- **"Trykk for å utforske"-overlay: bottom-center pill, pulse-animasjon (ring-pulse), persistent inntil tap**. Swipe-up er alltid escape (bytter kort uten å aktivere kartet). Ingen X-dismiss i MVP — overlay forblir til bruker enten aktiverer eller swiper.

## Open Questions

### Resolved During Planning

- **Skal vi reuse `BoardContext` eller lage `ReelsContext`?** → Egen `ReelsContext`. Modellene er forskjellige nok at deling skaper mer kompleksitet enn den eliminerer.
- **Mapbox-instans-strategi?** → Lazy-mount-once på første map-fase. Eliminerer iOS WebGL-limit OG camera-leak mellom kategorier.
- **Reuse `useAudioTourStore` eller eget audio-system?** → Reuse uendret. API: `start(tracks: AudioTrack[])` (positional) + `goToTrack(i)` + `close()`.
- **Audio-orkestrerings-modell?** → Pre-bygd tracks-array ved provider init + `goToTrack(i)` på swipe. Ikke `start([single-track])` per kort (rapid-swipe race).
- **iOS Safari audio-autoplay?** → Eksplisitt "Start opplevelsen"-knapp på intro-kortet unlocker `<audio>` for sesjonen. Etterpå kan IntersectionObserver-callbacks trygt kalle `goToTrack(i)`.
- **Phase-state-shape?** → Global `{cards, activeIndex, currentPhase}`, ikke per-kategori-Record. Returbesøk behandles som ny visning (reset til default phase for kortet).
- **Hvilke kategorier for MVP?** → Mat & drikke + Transport.
- **Hvor skal SOME-videoen ligge?** → `public/reels/stasjonskvartalet/intro.mp4`. Kopieres i Unit 1 (asset-kopiering er del av route-skeleton).
- **Karaoke i Reels-fasen?** → Ja, via `KaraokePitchText` med eksisterende timings (fallback til statisk tekst).
- **Parallax i MVP?** → Nei, statisk illustrasjon. Subtle drift kan legges til som Unit 8-polish hvis flow-validering krever mer dynamikk.
- **Desktop-strategi?** → Client-side `useMediaQuery` med "Best på mobil"-skjerm. Ikke server-side UA-redirect (bryter DevTools-emulering).
- **Kamera-kontroll: flyTo eller fitBounds?** → `fitBounds` fra `category.pois.map(p => p.coords)` med top-padding for karaoke-overlay.

### Deferred to Implementation

- **Optimal `IntersectionObserver.threshold`**: Start på 0.7, iterer mot mobil-feel.
- **Tap-to-skip vs. tap-to-activate-map disambiguation**: Samme region, ulike faser. Én `onClick`-handler med `switch (currentPhase)`: i `"reel"` skipper til `"map"`, i `"map"` aktiverer kartet. Inert i `"map-activated"`.
- **`fitBounds`-padding-verdier**: Topp-padding må romme karaoke-overlay (~140px), bunn-padding må romme activate-overlayen (~80px). Tunes etter første visuelle test.
- **End-of-feed-state**: Hva ser bruker etter siste kategori-kort? Sannsynligvis "Se hele rapporten"-CTA-kort med lenke til `/rapport-board`. Spec'es i Unit 8 hvis tid; ellers en hard scroll-stop er akseptabel for MVP.
- **Video-pause på tab-switch (intro-kortet)**: Page Visibility API + `play()` ved synlig + `activeIndex === 0`. Spec'es i Unit 8.

## High-Level Technical Design

> *Dette illustrerer intendert komposisjon og er retnings-veiledning for review, ikke implementasjons-spesifikasjon.*

```
/rapport-reels page (server-component, data-fetch identisk med rapport-board)
│
└─ ReportReelsPage (client)
   │
   ├─ DesktopGate (useMediaQuery) ─ render "Best på mobil"-skjerm på desktop
   │
   └─ <if mobile> ReelsProvider (ReelsContext + AudioElementProvider)
      │
      ├─ ReelsStack (h-100dvh overflow-y-scroll snap-y mandatory)
      │   │
      │   ├─ IntroReel (snap-start h-100dvh)
      │   │    ├─ <video> muted autoplay loop playsInline
      │   │    └─ "Start opplevelsen"-knapp (iOS unlock-tap)
      │   │
      │   ├─ CategoryReel × 2 (snap-start h-100dvh)
      │   │    │ currentPhase styrer hva som rendres:
      │   │    │   "reel"          → IllustrasjonsLag + KaraokePitchText synlige
      │   │    │   "map"           → IllustrasjonsLag fader ut, ReelsMap synlig,
      │   │    │                     "trykk for å utforske"-pill vises
      │   │    │   "map-activated" → samme som "map" + Mapbox-gestures aktive,
      │   │    │                     pill skjult
      │   │    │
      │   │    ├─ IllustrasjonsLag (statisk illustrasjon, full-bleed)
      │   │    ├─ KaraokePitchText (alltid under audio i reel-fase)
      │   │    └─ MapActivationOverlay (synlig kun i "map"-fase)
      │   │
      │   └─ IntersectionObserver (threshold 0.7)
      │        → setActiveIndex(i)
      │        → audio-store.goToTrack(i - introOffset)
      │        → currentPhase reset til kortets default
      │
      └─ ReelsMap (lazy-mount-once, position:fixed bak stack)
           │ Mountes første gang en kategori-card når "map"-fase.
           │ Lever resten av sesjonen, fader synlig kun når
           │ activeIndex peker på en kategori i map-fase.
           │
           ├─ <Map> react-map-gl, gestures disabled by default
           └─ BoardMarker[] (KUN MVP-kategorier)
                └─ isVisible = (marker.categoryId === activeCategoryId &&
                                currentPhase in ["map","map-activated"])
```

**Fase-transisjoner per kategori-kort:**
- `mount + IntersectionObserver-aktivering → "reel"` (audio.goToTrack)
- `"reel" → "map"` (audio.phase==="ended" ELLER user tap)
- `"map" → "map-activated"` (user tap på activation-pill)
- `swipe-bort → ny activeIndex` (audio.goToTrack til nytt kort, gammelt kort reseter til default ved neste visning)

## Implementation Units

- [ ] **Unit 1: Route + page-skeleton + DesktopGate + asset-kopiering + data-preflight**

**Goal:** Bootstrap ny route. Server-component henter prosjekt-data identisk med rapport-board. Client-komponent `ReportReelsPage` wrapper en `DesktopGate` som viser "Best på mobil"-skjerm hvis ikke mobile-viewport. SOME-videoen kopieres til `public/reels/`, og vi pre-verifiserer at MVP-kategoriene har audio.

**Requirements:** R1, R8

**Dependencies:** Ingen

**Files:**
- Create: `app/eiendom/[customer]/[project]/rapport-reels/page.tsx`
- Create: `components/variants/report/reels/ReportReelsPage.tsx` (placeholder + DesktopGate)
- Create: `components/variants/report/reels/DesktopGate.tsx`
- Create: `public/reels/stasjonskvartalet/intro.mp4` (kopiert fra `~/Desktop/placy-test/output/composed-some-kategori.mp4`)

**Approach:**
- Kopier `rapport-board/page.tsx` 1:1, bytt komponent-importer til `ReportReelsPage`. Behold `unstable_cache`, `generateMetadata`, parallel data-fetch.
- Importer `mapbox-gl/dist/mapbox-gl.css` i route-fila (kjent gotcha fra `mapbox-markers-invisible-missing-css-EventRoute-20260413.md`).
- `DesktopGate` (client-komponent): bruker `useMediaQuery("(min-width: 1024px)")`. Hvis desktop, render "Placy Reels — best på mobil. Scan QR for å åpne på telefonen" + QR-bilde + lenke til `/rapport-board`. Hvis mobil, render `children`.
- **Audio-pre-flight (manuell del av Unit 1)**: Verifiser med en `console.log` av `boardData.categories.filter(c => c.id in ["mat-drikke", "transport"]).map(c => ({id: c.id, hasAudio: !!c.audio?.url, hasManus: !!c.audio?.manus, hasTimings: !!c.audio?.timings}))`. Hvis Transport mangler audio i Supabase-data, ESCALER: enten generér audio først, eller bytt MVP-kategori.
- **Asset-verifikasjon**: `ffprobe public/reels/stasjonskvartalet/intro.mp4` skal returnere 720×1280 9:16. Hvis ikke, re-encode med ffmpeg før commit.

**Patterns to follow:**
- `app/eiendom/[customer]/[project]/rapport-board/page.tsx` for page-struktur
- `lib/hooks/useMediaQuery.ts` for viewport-deteksjon

**Test scenarios:**
- *Test expectation: none — placeholder-route, validér manuelt.*

**Verification:**
- Mobil-viewport viser placeholder ("Reels — Stasjonskvartalet")
- Desktop-viewport viser "Best på mobil"-skjerm med QR + lenke
- Pre-flight-loggen bekrefter at Mat & drikke + Transport har audio.url + audio.manus
- Video-fila åpner og spiller i nettleser (720×1280)

---

- [ ] **Unit 2: ReelsContext + reels-data builder**

**Goal:** Etabler state-modellen for Reels-stacken: hvilke kort som skal rendres, hvilket som er aktivt, og hver kategori-korts fase. Bygg en data-transform fra `BoardData` til en `ReelsCard[]`-array.

**Requirements:** R2, R3, R4

**Dependencies:** Unit 1

**Files:**
- Create: `components/variants/report/reels/reels-data.ts`
- Create: `components/variants/report/reels/reels-state.tsx` (ReelsContext + Provider + useReels hook)

**Approach:**
- `ReelsCard`-type:
  - `IntroReelCard = { kind: "intro", videoSrc: string }`
  - `CategoryReelCard = { kind: "category", categoryId: string, illustrationSrc: string, audio: BoardAudioTrack, lead: string }`
- `buildReelsCards(boardData)`:
  - Første element: IntroReel med fast `videoSrc`
  - Resten: filtrer `boardData.categories` til de som har både `audio` (med `url+manus`) og `illustration`. MVP-config: hardkod begrensning til `["mat-drikke", "transport"]`.
- `buildCategoryTracks(cards)`: ekstraher `card.audio` fra alle `CategoryReelCard` til én `AudioTrack[]` som `useAudioTourStore.start(tracks)` kan ta. Eksponer indexMapping `audioIndex → cardIndex` (cardIndex = audioIndex + 1, fordi intro tar indeks 0).
- ReelsContext-state: `{ cards: ReelsCard[], activeIndex: number, currentPhase: "intro" | "audio-locked" | "reel" | "map" | "map-activated", audioUnlocked: boolean, mapMounted: boolean }`
- ReelsContext-actions: `setActiveIndex(i)`, `setPhase(phase)`, `markAudioUnlocked()`, `markMapMounted()`
- `audioUnlocked` settes til true etter at bruker har tappet "Start opplevelsen"-knappen (Unit 4)
- `mapMounted` settes til true første gang en kategori-card går i map-fase (Unit 7)
- useReels()-hook for å konsumere

**Patterns to follow:**
- `components/variants/report/board/board-data.ts` for transform-funksjon-stil (`buildBoardData`)
- `components/variants/report/board/board-state.tsx` for Context + useReducer

**Test scenarios:**
- *Happy path*: `buildReelsCards(stasjonskvartalet-data)` returnerer array med 3 elementer (1 intro + 2 kategori-kort)
- *Edge case*: kategori uten audio filtreres ut
- *Edge case*: kategori uten illustrasjon filtreres ut
- *Test expectation*: én unit-test på `reels-data.ts` med 2-3 mock-scenarier i `components/variants/report/reels/__tests__/reels-data.test.ts`

**Verification:**
- Data-transform returnerer riktig antall kort for MVP-konfigurasjonen
- ReelsContext kan konsumeres via useReels() uten å throwe

---

- [ ] **Unit 3: ReelsStack — scroll-snap container + IntersectionObserver**

**Goal:** Den vertikale snap-containeren som holder alle kortene. Tracker aktivt kort via IntersectionObserver og synker til ReelsContext. Ingen kart-logikk her — bare layout og aktiv-kort-detection.

**Requirements:** R2, R6

**Dependencies:** Unit 2

**Files:**
- Create: `components/variants/report/reels/ReelsStack.tsx`
- Modify: `components/variants/report/reels/ReportReelsPage.tsx` (bytt placeholder ut med ReelsStack)

**Approach:**
- Container: `<div className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory">`
- Hvert barn-element fra `cards`-array rendres i en `<section className="h-[100dvh] snap-start snap-always relative">`
- IntersectionObserver mountes ÉN gang, observerer alle barn-sections. Når section krysser `threshold: 0.7`, kall `setActiveIndex(i)` på ReelsContext
- Skjul nettleser-scrollbar (`scrollbar-hide` utility eller egen `[&::-webkit-scrollbar]:hidden`)
- Foreløpig render: alle kort viser placeholder ("Card i: <kind>") — selve Reel-komponentene kommer i Unit 4+5

**Patterns to follow:**
- IntersectionObserver-bruk: `components/variants/report/board/board-scroll-panel/use-board-active-section.ts`
- Scroll-snap CSS: `components/variants/report/guide/GuideMapLayout.tsx` (horisontal snap, men samme grammatikk)

**Test scenarios:**
- *Test expectation: none — manuell test i mobil-viewport. Verifisér at swipe-up navigerer mellom kort og at activeIndex oppdateres (DevTools React-inspector).*

**Verification:**
- Swipe-up i mobil-viewport snapper til neste kort
- React DevTools viser at `activeIndex` på ReelsContext oppdateres
- Ingen scrollbar synlig

---

- [ ] **Unit 4: IntroReel — SOME-video-kort + iOS audio-unlock-knapp**

**Goal:** Første kort i stacken viser den eksisterende SOME-videoen. Autoplay-on-mount, muted, loop, playsinline. "Start opplevelsen"-knapp på toppen unlocker `<audio>`-elementet for resten av sesjonen ved første tap (kritisk for iOS).

**Requirements:** R1

**Dependencies:** Unit 3

**Files:**
- Create: `components/variants/report/reels/IntroReel.tsx`
- Modify: `components/variants/report/reels/ReelsStack.tsx` (rendre IntroReel for `kind: "intro"`-kort)

**Approach:**
- `<video src={card.videoSrc} autoPlay muted loop playsInline className="h-full w-full object-cover">`
- Når kortet IKKE er aktivt (activeIndex !== 0), pause videoen via ref
- **"Start opplevelsen"-knapp**, sentralt plassert pill: synlig kun mens `audioUnlocked === false`. Tap → kjør iOS-unlock-sekvens på `<audio>`-elementet (`play(); pause();` mens i user-gesture-stack) → dispatch `markAudioUnlocked()` → knapp fader ut.
- **Swipe-up-hint** (når `audioUnlocked === true`): subtle chevron-up + "Swipe opp" som forsvinner etter 3 sek eller på første scroll.
- Ingen voice-over på selve intro-kortet — SOME-videoen er muted og self-contained.

**Patterns to follow:**
- iOS audio-unlock-mønster: `components/variants/report/board/audio-tour/use-audio-element.tsx` (StartTourButton)
- HTML5 video iOS-attributter: `playsInline muted autoPlay loop`

**Test scenarios:**
- *Test expectation: manuell test på iOS Safari real device (eller Safari på Mac som proxy).* Sjekkliste:
  - Videoen autoplayer ved page-load
  - "Start opplevelsen"-knappen vises
  - Tap unlocker audio, knappen fader ut, swipe-hint vises
  - Swipe til kategori-kort: voice over spiller på iOS

**Verification:**
- Bruker som tapper unlock-knappen får audio til å fungere i resten av sesjonen
- Bruker som swiper uten å tappe får ikke audio (kjent failure mode — kategori-kortet kan vise hint om å gå tilbake til intro)
- iOS Safari spiller videoen uten krasj

---

- [ ] **Unit 5: CategoryReel — reel-fase (statisk illustrasjon + voice over + karaoke)**

**Goal:** Kategori-kort i sin reel-fase: statisk illustrasjon (full-bleed), voice over starter automatisk når kortet blir aktivt OG `audioUnlocked === true`, karaoke-tekst rendres synkron med voice over. Tap på kortet skipper voice over og trigger map-fase. NB: rendring av selve kart-fasen lever i Unit 6 — denne unit-en logger phase-skifte til console.

**Requirements:** R3, R7

**Dependencies:** Unit 2, Unit 3, Unit 4 (for audioUnlocked-state)

**Files:**
- Create: `components/variants/report/reels/CategoryReel.tsx`
- Create: `components/variants/report/reels/use-reels-audio-orchestration.ts`
- Modify: `components/variants/report/reels/ReelsStack.tsx` (rendre CategoryReel for `kind: "category"`-kort)
- Modify: `components/variants/report/reels/reels-state.tsx` (ReelsProvider kaller `useAudioTourStore.start(allCategoryTracks)` én gang ved første kategori-aktivering)

**Approach:**
- **Audio-init**: i ReelsProvider, lytt på `activeIndex` og `audioUnlocked`. Når aktiv-index treffer første kategori-card og `audioUnlocked && !audioStarted`, kall `useAudioTourStore.start(allCategoryTracks)` der `allCategoryTracks` er pre-bygd fra `buildCategoryTracks(cards)` (Unit 2).
- **useReelsAudioOrchestration**: lytt på `activeIndex` og kort-mapping. Når kategori-card blir aktivt, kall `useAudioTourStore.goToTrack(audioIndex)` der `audioIndex = activeIndex - 1` (intro tar plass 0). Hvis bruker er på intro-kortet, ingen audio-action.
- **Audio-onEnded → fase-bytte**: subscribe på `useAudioTourStore` sin `phase`. Når den blir `"ended"` OG `currentPhase === "reel"`, dispatch `setPhase("map")` til ReelsContext.
- **Tap-handler**: `<div className="absolute inset-0" onClick={handleTap}>` der handleTap gjør:
  ```
  switch (currentPhase) {
    case "reel": setPhase("map"); break;  // skip voice over
    case "map": /* Unit 6 håndterer activate-overlay-tap */; break;
  }
  ```
- **Illustrasjon**: `getCategoryIllustrationSrc(projectSlug, categoryId)` returnerer URL. Render som `<Image fill style={{objectFit:"cover"}} priority={isActive} />`. Statisk — ingen parallax i MVP.
- **Karaoke**: `<KaraokePitchText text={card.audio.manus} timings={card.audio.timings} isActive={isActive && currentPhase === "reel"} />`. Plassert sentralt, semi-transparent backdrop for lesbarhet.

**Execution note:** Audio-orchestration er hjørnsteinen for R3 og R7. Verifiser empirisk i nettleser at audio veksler riktig ved swipe.

**Patterns to follow:**
- `BottomPlayer.tsx` for hvordan `useAudioTourStore` konsumeres
- `KaraokePitchText.tsx` for karaoke-rendring
- `lib/themes/category-illustrations.ts` for illustrasjons-URL (NB: `BoardCategory.illustration` kan også brukes direkte — bruk det som er enklest å reach fra `card.illustrationSrc`)
- Karaoke: `<KaraokePitchText text={card.audio.manus} timings={card.audio.timings} isActive={isReelActive && phase==="reel"} />` plassert sentralt over illustrasjonen
- Tap-handler: `<div className="absolute inset-0" onClick={() => phase === "reel" && setPhase(cardKey, "map")}>` (men kun aktiv i reel-fase — sjekkes i handler)

**Test scenarios:**
- *Happy path*: Bruker tapper "Start opplevelsen", swiper til Mat & drikke → `goToTrack(0)` kjøres → voice over starter → karaoke lyser linje for linje → audio.onEnded → `currentPhase` blir "map"
- *Happy path*: Bruker tapper på Reelen midtveis i voice over → audio stopper → `currentPhase` blir "map" umiddelbart
- *Edge case*: Bruker swiper Mat & drikke → Transport mens voice over kjører → `goToTrack(1)` skifter spor sømløst
- *Edge case*: Bruker swiper Transport → tilbake til Mat & drikke → `goToTrack(0)` re-starter Mat & drikke audio fra topp
- *Test expectation: manuell test* + valgfritt en unit-test på `useReelsAudioOrchestration` med mocket store

**Verification:**
- Voice over starter når kategori-kort blir aktivt (forutsatt audioUnlocked)
- Voice over veksler riktig mellom kategorier ved swipe (`goToTrack`-kall observerbart i React DevTools)
- Karaoke-tekst synker med voice over (eller fallback til statisk tekst hvis timings mangler)
- Tap på Reelen i reel-fase trigger map-fase (console.log; ReelsMap rendres ennå ikke)

---

- [ ] **Unit 6: CategoryReel — map-fase (kart-aktivering + overlay)**

**Goal:** Når aktivt kategori-kort har `currentPhase === "map"`, fader IllustrasjonsLag + KaraokePitchText ut og avdekker ReelsMap under. "Trykk for å utforske"-pill vises bottom-center med pulse-animasjon. Tap kaller `setPhase("map-activated")` som signalerer ReelsMap å enable Mapbox-gestures.

**Requirements:** R4, R5

**Dependencies:** Unit 5, Unit 7

**Files:**
- Modify: `components/variants/report/reels/CategoryReel.tsx`

**Approach:**
- IllustrasjonsLag-wrapper får `transition-opacity duration-700`. `currentPhase` styrer opacity:
  - `"reel"` → opacity 1, pointer-events auto
  - `"map" | "map-activated"` → opacity 0, pointer-events none
- KaraokePitchText har samme transition + `isActive={currentPhase === "reel"}` (lukker karaoke når map-fase begynner)
- **MapActivationOverlay**: bottom-center pill (`absolute bottom-20 left-1/2 -translate-x-1/2`), tekst "Trykk for å utforske", ring-pulse via `animate-ping` rundt et hvitt sentralt punkt. Synlig kun når `currentPhase === "map"`. Tap → `setPhase("map-activated")`.
- Tap-handler på CategoryReel-rooten (samme onClick fra Unit 5) håndterer fase-skifter via switch på `currentPhase`. Map-fase swiper-up er alltid escape (scroll-snap håndterer dette automatisk).
- Når bruker swiper bort fra kortet, IntersectionObserver-trigger på nytt kort gjør `setActiveIndex(i+1)` + `setPhase` resetes til default. Hvis bruker swiper tilbake, samme reset gjelder (returbesøk = ny visning per Decision).

**Patterns to follow:**
- Opacity-transition + pointer-events-grammatikk: `BoardMarker.tsx`
- Ring-pulse-animasjon: standard Tailwind `animate-ping`

**Test scenarios:**
- *Happy path*: `currentPhase === "map"` → illustrasjon + karaoke fader ut over 700ms → kart blir synlig under → "trykk for å utforske"-pill vises bottom-center med pulse
- *Happy path*: Bruker tapper pill → pill forsvinner → `currentPhase === "map-activated"` → bruker kan pan/zoom (verifiseres i Unit 7)
- *Edge case*: Bruker swiper bort i map-fase uten å aktivere kartet → ingen state-rester på det forrige kortet
- *Edge case*: Bruker swiper tilbake til forrige kort → kortet starter på `"reel"` igjen, voice over re-spilles
- *Test expectation: manuell test*

**Verification:**
- Illustrasjon fader ut når voice over slutter eller user tapper
- Kart synlig under med kun den aktive kategoriens markører (Unit 7)
- "Trykk for å utforske"-pill med pulse vises og forsvinner ved tap
- Etter tap kan kartet pan/zoomes

---

- [ ] **Unit 7: ReelsMap — lazy-mount-once Mapbox-instans + fitBounds + gesture-kontroll**

**Goal:** Én Mapbox-instans som mountes FØRSTE gang en kategori-card når map-fase, lever resten av sesjonen. Markører for MVP-kategoriene (Mat & drikke + Transport) rendres alle, men kun aktiv kategori har `isVisible=true`. Gestures disabled initially via react-map-gl-props; enables imperativt når `currentPhase === "map-activated"`. Camera-kontroll bruker `fitBounds` fra kategoriens POI-koordinater.

**Requirements:** R4, R5

**Dependencies:** Unit 2

**Files:**
- Create: `components/variants/report/reels/ReelsMap.tsx`
- Modify: `components/variants/report/reels/ReportReelsPage.tsx` (conditional mount av ReelsMap når `mapMounted === true`)

**Approach:**
- **Lazy-mount-trigger**: ReportReelsPage observerer `mapMounted` fra ReelsContext. Når en CategoryReel første gang setter `currentPhase === "map"`, dispatcher den `markMapMounted()`. ReportReelsPage rendrer da `<ReelsMap />` som søsken til ReelsStack med `position: fixed inset-0 z-0`. Stacken sitter på `z-10` med transparent backgrounds slik at kartet shines gjennom når illustration-laget fader ut.
- **Initial viewport**: senter på prosjekt-koordinater (Stasjonskvartalet), zoom 13.
- **Mapbox-instans**: `<Map>` fra `react-map-gl/mapbox`. Gestures disabled via props: `dragPan={false} scrollZoom={false} doubleClickZoom={false} touchZoomRotate={false} touchPitch={false}`.
- **Gesture-enable**: useEffect på `currentPhase === "map-activated"` for aktivt kategori-kort. Hent map-instansen via `mapRef.current?.getMap()`, kall `map.dragPan.enable()`, `scrollZoom.enable()`, `doubleClickZoom.enable()`, `touchZoomRotate.enable()`. Disable igjen ved swipe bort fra kortet.
- **Markører**: render `BoardMarker[]` kun for MVP-kategoriene. `isVisible = (marker.categoryId === activeCategoryId && currentPhase in ["map", "map-activated"])`. Andre markører har opacity 0.
- **Camera-kontroll**: når aktivt kategori-kort skifter til `"map"`-fase, compute `bbox = new mapboxgl.LngLatBounds()`, iterer `category.pois` og kall `bbox.extend([poi.lng, poi.lat])`. Kall `map.fitBounds(bbox, { padding: { top: 140, bottom: 120, left: 40, right: 40 }, duration: 800 })`. Padding top dekker karaoke-fade-out-laget, bottom dekker activate-pillen.
- **Token-pattern** (fra `map-adapter-pattern-20260419.md`): hold ref til `cancelTokenRef`. Ved ny fitBounds, sett token. Hvis annen fitBounds starter før forrige er ferdig, sjekk token før animasjon settes — kanseller gammel via `map.stop()`.

**Patterns to follow:**
- `components/variants/report/board/BoardMap.tsx` for Mapbox-init og react-map-gl-konvensjoner
- `components/variants/report/board/BoardMarker.tsx` for `isVisible`-grammatikken (gjenbrukes uendret)
- `docs/solutions/architecture-patterns/map-adapter-pattern-20260419.md` for camera-token

**Test scenarios:**
- *Happy path*: Bruker swiper til Mat & drikke + audio.onEnded → `mapMounted === true` → ReelsMap mountes → `fitBounds` til kategoriens POIer → Mat & drikke-markører synlige med opacity 1
- *Happy path*: Bruker tapper "Trykk for å utforske" → gestures aktiveres → pan/zoom virker
- *Edge case*: Bruker swiper raskt Mat & drikke → Transport → Mat & drikke → kun siste fitBounds fullfører (token-pattern), ingen interpolation-feil
- *Integration*: Map-instansen lever én gang — verifiser via React DevTools at mapRef beholder samme instans
- *Edge case*: iOS Safari — ingen WebGL-context-krasj
- *Test expectation: manuell test på iOS Safari real device (eller minst Safari på Mac som proxy)*

**Verification:**
- Én Mapbox-instans lever for hele session
- Markører fader inn/ut riktig basert på aktivt kort
- Pan/zoom virker etter mapActivated, ikke før
- iOS Safari håndterer flere kart-fase-transisjoner uten krasj

---

- [ ] **Unit 8: End-to-end-flyt + cleanup + edge cases**

**Goal:** Stitch alle enhetene sammen. Test full bruker-flyt på Stasjonskvartalet. Håndtér edge cases: bruker forlater siden midt i voice over, bytter tab, swiper raskt, etc.

**Requirements:** R1–R7

**Dependencies:** Unit 1–7

**Files:**
- Modify: `components/variants/report/reels/ReportReelsPage.tsx` (samle alle providers + stack + map)
- Modify: `components/variants/report/reels/use-reels-audio-orchestration.ts` (Page Visibility API for tab-switch)

**Approach:**
- Test golden path: åpne route → intro spiller → swipe → Mat & drikke voice over → audio slutter → kart fader inn → tap aktiverer pan/zoom → swipe → Transport
- Edge cases:
  - **Tab-switch (audio)**: lytt på `document.visibilityState` — `useAudioTourStore.pause()` når hidden, ikke auto-resume når visible (bruker tar initiativ)
  - **Tab-switch (intro video)**: når visibility blir `"visible"` OG `activeIndex === 0`, kall `videoRef.current?.play()` (iOS Safari pauser muted video automatisk ved tab-switch men resumer ikke alltid)
  - **Window blur** (telefon låst): samme behandling som tab-switch
  - **Rask swipe**: `goToTrack(i)` på audio-store er idempotent — hvert nytt activeIndex trigger nytt goToTrack-kall som overskriver forrige. Token-pattern på fitBounds for kartet (Unit 7).
  - **Returbesøk til samme kort**: scroll-snap støtter swipe-up/down naturlig. IntersectionObserver trigger på re-entry, currentPhase reset til kortets default → audio re-starter via goToTrack
  - **Unmount-cleanup**: `useEffect` cleanup i ReelsProvider kaller `useAudioTourStore.close()` ved unmount av Reels-routen (forhindrer at audio fortsetter på andre routes)
- Lege-til metrics-stubs (console.log) for engagement-debug, ikke ekte analytics i MVP

**Test scenarios:**
- *Integration*: Komplett bruker-flyt: intro → tap unlock → swipe → Mat & drikke → voice over → onEnded → map → tap activate → pan/zoom → swipe → Transport → samme syklus
- *Edge case*: Tab-switch pauser audio + intro-video; visibility-visible re-spiller intro-video hvis activeIndex===0; audio må manuelt resumes av bruker
- *Edge case*: Rask swipe 3 ganger på rad → goToTrack-kall følger siste activeIndex, ingen audio-overlap
- *Edge case*: Bruker swiper opp forbi siste kort → ingenting krasjer (scroll-snap hindrer over-scroll)
- *Edge case*: Navigér bort fra Reels-routen → audio stoppes via close() i unmount-cleanup
- *Test expectation: manuell end-to-end-test, gjerne med screenshots av hvert stadium for dokumentasjon*

**Verification:**
- Alle 8 R-krav verifiserbart oppfylt
- Ingen console-errors i Chrome DevTools eller iOS Safari
- Ingen WebGL-context-krasj på iOS
- Audio overlapper aldri
- Audio stoppes ved route-navigasjon

## System-Wide Impact

- **Interaction graph:** Ny route konsumerer `useAudioTourStore` (samme som rapport-board) — pause/play-state vil deles på tvers hvis bruker åpner begge i samme tab. Sannsynligvis OK, men noter.
- **Error propagation:** Mapbox-feil i ReelsMap må ikke krasje hele Reels-stacken — wrap i ErrorBoundary med fallback til "Reels kun" (uten kart).
- **State lifecycle risks:** ReelsContext er per-route, men `useAudioTourStore` er global. Når bruker navigerer bort fra Reels-routen, må audio stoppes (`close()` på unmount).
- **API surface parity:** Ingen — dette er en parallell route uten endringer i felles APIer.
- **Integration coverage:** iOS Safari real-device-test er obligatorisk før plan kan kalles complete — kart-instans-deling er hovedrisiko-området.
- **Unchanged invariants:** `rapport-board`-routen og dens flow er uendret. `BoardContext`, `BoardMap`, `BoardMarker` er ikke modifisert (kun konsumert). `useAudioTourStore` er uendret.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| iOS Safari WebGL-context-krasj ved mange kategori-kort | Lazy-mount-once Mapbox (Unit 7) — én instans for hele sesjonen. Test på faktisk iOS Safari-enhet i Unit 8. |
| Audio-autoplay blokkeres på iOS Safari | "Start opplevelsen"-knapp på intro-kortet unlocker `<audio>` for sesjonen (Unit 4). Etterpå kan IntersectionObserver-callbacks trygt kalle `goToTrack(i)`. |
| Karaoke-timings finnes ikke for alle kategorier | `KaraokePitchText` faller tilbake til statisk tekst når `timings` mangler. Greit for MVP. |
| Bruker swiper raskt → flere fitBounds-kall stables opp | Token-pattern fra `map-adapter-pattern-20260419.md` (Unit 7) kansellerer pågående animasjon ved ny fitBounds. |
| SOME-videoen har feil aspect ratio for embed | `ffprobe`-verifikasjon i Unit 1 pre-flight (skal være 720×1280 9:16). Hvis ikke: re-komponere via `scripts/compose-some-video.ts` før commit. |
| Stasjonskvartalet mangler Transport-audio i Supabase | Unit 1 pre-flight-log avdekker dette. Hvis manglende: bytt MVP-kategori til en som har audio, eller generér audio først via `scripts/voiceover-some.ts`. |
| Bruker swiper forbi intro uten å tappe unlock-knappen | Kategori-kort viser fallback-hint "Tap to start audio" hvis `audioUnlocked === false`. Lav-friksjons-failure mode. |

## Documentation / Operational Notes

- **Worklog-entry** når MVP er deployet: `PROJECT-LOG.md` 2026-05-24 (kveld) → ny entry når routen er live
- **docs/solutions/-entry** for audio-tour-arkitekturen (ble flagget som gap av learnings-researcher) — bør skrives etter MVP, ikke som del av denne planen
- **Ingen PR-rollout** — dette er en spike på `feat/board-narrativ-spike`-branchen som allerede er aktiv. Hold endringene på denne branchen til MVP er validert manuelt.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-24-placy-reels-brainstorm.md`
- Related plans: `docs/plans/2026-05-21-refactor-mobile-board-sheet-plan.md` (mobile-sheet-mønster), `docs/plans/2026-05-22-001-feat-board-zoom-baserte-markorer-plan.md` (kart-zoom-håndtering)
- Related code:
  - `app/eiendom/[customer]/[project]/rapport-board/page.tsx` (route-mal)
  - `components/variants/report/board/BoardMap.tsx`, `BoardMarker.tsx` (kart-gjenbruk)
  - `components/variants/report/board/audio-tour/` (audio-orchestration-gjenbruk)
  - `lib/stores/audio-tour-store.ts` (Zustand audio-store)
- Related learnings:
  - `docs/solutions/feature-implementations/report-scroll-synced-sticky-map-20260208.md`
  - `docs/solutions/architecture-patterns/map-adapter-pattern-20260419.md`
  - `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md`
  - `docs/solutions/ui-bugs/mapbox-markers-invisible-missing-css-EventRoute-20260413.md`
- Related memory: `feedback_norsk_tts_stedsnavn.md`, `feedback_mobile_native_ux.md`, `project_placy_reels.md`
