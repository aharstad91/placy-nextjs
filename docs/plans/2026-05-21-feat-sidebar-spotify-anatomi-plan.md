---
created: 2026-05-21
status: active
origin: docs/brainstorms/2026-05-21-sidebar-spotify-anatomi-requirements.md
related:
  - docs/brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md
  - PROJECT-LOG.md (2026-05-21-entries)
---

# Plan — Sidebar Spotify-anatomi: indeks-liste + auto-mode-promotering

## Problem & goals

Sidebar-redesign etter Spotify-artist-page-mønsteret. Erstatte `BoardRail`-funksjonen med en numerert indeks-liste øverst i sidebar, og flytte "Start tour"-CTA fra `BottomPlayer`-idle til en stor rund play-knapp i top-hero. Bottom-player vises kun under aktiv tour. Felles komponent-arkitektur for desktop og mobil.

Goals fra requirements-doken (`origin`):
1. Erstatte rail som kategori-nav via numerert indeks-liste i top-sidebar
2. Promotere audio-tour via stor play-knapp i hero (Spotify-style)
3. Slanke topp-tekst (40-50 ord velkomst i stedet for 70-ord-pitch)
4. Beholde kategori-seksjoner under indeksen
5. Bottom-player skjult i idle, synlig kun aktiv tour
6. Én komponent-arkitektur for desktop + mobil

## Origin

`docs/brainstorms/2026-05-21-sidebar-spotify-anatomi-requirements.md` — full anatomi, beslutninger, scope-grenser og success criteria er ratifisert der. Denne planen er HOW.

Relatert: `docs/brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md` (R3 og R8 om kategori-seksjons-form og audio-mode-toggle) — anatomien her er en forlengelse, ikke et brudd. Pitch + chips per seksjon beholdes som i R3; index-list er nytt nav-lag i tillegg.

## Approach

Bygge tre nye komponenter (`SidebarHero`, `CategoryIndex`, mulig felles `SidebarShell`) og refaktorere `BoardScrollPanel` + `BottomPlayer` + `BoardMobileSheet` til å bruke dem. `BoardRail.tsx` slettes (allerede unmounted). `BoardCategoryInfoTab.tsx` vurderes for sletting/refaktor avhengig av om mobile sheet kan mounte samme scroll-panel som desktop.

Eksisterende state-API er tilstrekkelig: `useAudioTourSectionProgress` + `playedCategoryIds` for indeks-row-state, `OPEN_POI`-dispatch for any POI-engagement, `pickFeaturedPOIs` for chips i seksjoner.

## Scope boundaries

### In scope
- `SidebarHero`-komponent (hero-image, tittel, sub-line, meta-pill, slank velkomst, action-row m/ stor play)
- `CategoryIndex`-komponent (numerert liste, smart klikk, played/active-state)
- Refaktor `BoardScrollPanel`: bytt ut `HomeSection` med `SidebarHero`, sett inn `CategoryIndex` mellom hero og kategori-seksjoner
- Refaktor `BottomPlayer`: skjul i idle/ended; behold aktiv state som controller
- Mobile-paritet: enten mounte `BoardScrollPanel` i mobil-sheet eller bygge speil-komponent som bruker samme bygge-blokker
- Slette `BoardRail.tsx` + alle interne hooks der (komponent er allerede unmounted)
- Slette `BoardCategoryInfoTab.tsx` hvis mobile-sheet kan bruke `BoardScrollPanel` direkte

### Out of scope
- "Følg"-knapp eller andre Spotify-elementer
- Auto-play av audio på landing (krever brukerbeslutning + browser-policy-håndtering)
- Karaoke på Hjem-velkomst-tekst (Hjem-pitch er audio-only)
- Endringer i `CategoryFeaturedChips` eller `pickFeaturedPOIs` (fungerer som-er)
- Curator-UI for featured POIs (allerede deferred i tidligere plan)

### Deferred to separate tasks
- **Generering av slank velkomst-tekst (40-50 ord) via LLM-pipeline:** Første implementasjon bruker eksisterende `heroIntro` (truncated til først setning eller to) eller hardkoder for pilot. Skikkelig generering kan komme senere.
- **Tour-lengde i sub-line:** Pilot viser kun antall spor ("7 spor"). Total audio-varighet krever at audio-durations hydreres ved build — gjøres separat hvis ønskelig.
- **Mer-meny-innhold (kontakt-megler, kopi-link, share):** Plassholder i pilot, populeres når use-case-er er klare.

## Implementation units

### Unit 1 — Refactor `BottomPlayer`: skjul i idle, ekstraher start-logic

**Goal:** Bottom-player viser KUN aktiv state. Idle/ended → returnerer null. Start-tour-logic ekstraheres så den kan gjenbrukes i hero-action-row.

**Files:**
- Modify: `components/variants/report/board/audio-tour/BottomPlayer.tsx`
- Modify (om nødvendig): `components/variants/report/board/audio-tour/StartTourButton.tsx` — sjekk eksisterende, evt. utvide til å returnere "build tracks + start"-funksjon som hook

**Approach:**
Inne i `BottomPlayer`: erstatte `isIdle ? <IdleState /> : <ActiveState />` med `isIdle ? null : <ActiveState />`. Selve start-tour-logikken (bygge `AudioTrack[]` fra `data.home.audio` + `data.categories[].audio` og kalle `start(tracks)`) ekstraheres til en `useStartTour()`-hook (i `lib/audio-tour/` eller ved `audio-tour-store.ts`) som returnerer `{ startTour: () => void, canStart: boolean }`. Hooken gating-sjekker `audioTourEnabled` + at all audio finnes.

`StartTourButton.tsx` finnes allerede — sjekk om den eier samme logikk og kan kalle hooken, eller om den selv har det inline. Konsolider så det er én sannhetskilde.

**Verification:**
- `BottomPlayer` returnerer null når phase=idle/ended
- `BottomPlayer` rendrer transport-controls når aktiv (playing/paused/error) — uendret atferd
- `useStartTour` returnerer ingen tracks → `canStart=false` (gating)
- `useStartTour` med komplette data → starter tour ved `startTour()`-kall

**Patterns to follow:**
- Eksisterende hook-mønster i `lib/stores/audio-tour-store.ts` (`useAudioTourActions` osv.)
- `useShallow` for stabil objekt-retur fra hook

### Unit 2 — Komponent: `SidebarHero`

**Goal:** Topp-seksjon av sidebar — hero-image, tittel, sub-line, meta-pill, slank velkomst, action-row med stor play.

**Files:**
- Create: `components/variants/report/board/SidebarHero.tsx`

**Approach:**
Props (initialt): `{ home: BoardHome, categories: BoardCategory[] }` — leser fra context for å regne metadata, eller henter via `useBoard()`. Layout:

1. Hero-image: `next/image` med `aspect-[4/3]`-wrap, `home.heroImage`
2. Tittel: `<h1>` med `home.name`, stor (text-2xl/3xl)
3. Sub-line: `home.address` + " · " + tour-meta ("7 spor" — antall = `categories.length + 1`)
4. Meta-pill: "N punkter · 7 kategorier" — beregn `totalPois = categories.reduce((sum, c) => sum + c.pois.length, 0)`
5. Velkomst-tekst: Bruk `home.heroIntro` truncated til første N setninger (eller en ny `home.welcomeText`-felt hvis introdusert). I pilot: ta `heroIntro` og truncate til ~40-50 ord. Hjelpe-funksjon `truncateToSentences(text, maxWords)` kan bo i `lib/utils/text.ts` (sjekk om finnes).
6. Action-row: `<div class="flex items-center gap-2">[···] [del] [stor play]</div>`. Stor play = bruker `useStartTour`-hook fra Unit 1. Play blir pause-ikon når phase=playing, play-ikon ellers. Klikk: hvis tour aktiv → toggle play/pause; hvis idle → startTour. Hvis `!canStart` → render ingen play (gating samme som dagens IdleState).

**Visual:** Stor play er ~56px rund, primær-farge (Placy-aksent eller stone-900). Sekundære "···" + "del" er smaller, mer transparent (border + subtle bg). For pilot kan "···" og "del" være no-op placeholder-buttons.

**Verification:**
- Render med komplett `BoardHome` + `BoardCategory[]` → ser ut som anatomi-skissen
- `canStart=false` (mangler audio-data) → play-knappen vises ikke
- `phase=playing` → play-ikonet bytter til pause; klikk pauser
- Akkumulert "N punkter"-tall stemmer med sum av pois på tvers av kategorier

**Patterns to follow:**
- `BoardScrollPanel.HomeSection` for image + tittel-rendering (gjenbruk styling der det gir mening)
- `BottomPlayer.ActiveState` for play/pause-toggle-logic

### Unit 3 — Komponent: `CategoryIndex`

**Goal:** Numerert liste av kategorier — nav-snarvei med smart klikk-semantikk og played/active-state.

**Files:**
- Create: `components/variants/report/board/CategoryIndex.tsx`

**Approach:**
Props: `{ categories: BoardCategory[], onCategoryClick: (id: BoardCategoryId) => void }` — eller henter alt fra `useBoard()`. Layout:

```
<div>
  <h3 eyebrow>ÅPNINGEN · N KATEGORIER</h3>
  <ol>
    {categories.map((cat, i) => (
      <CategoryRow number={i+1} category={cat} ... />
    ))}
  </ol>
</div>
```

Hver `CategoryRow`:
- Layout: `<button class="flex items-center gap-3 w-full px-2 py-3 hover:bg-stone-100">`
- Inhold: `<span>{number}</span>` (font-mono eller subtle), kategori-thumbnail (gjenbruk `THEME_SCENE_SRC[category.id]` 40×40 rounded), `<div class="flex-1"><span>{label}</span><span class="text-stone-500">{pois.length} punkter</span></div>`, `<ChevronRight class="text-stone-400" />`
- Played/active-state via `useAudioTourSectionProgress(category.id)`:
  - `played`: subtil grønn/hake-ikon ved siden av nummeret, full opacity
  - `active`: bg-tint (samme som chip-hover-state) + full opacity
  - `unplayed`: standard, full opacity
  - `null` (idle): standard, full opacity
  - I idle/ended kan vi også vise scroll-active state — men det krever en ny `data-row-state`-attribut eller logikk lik `deriveSectionState` i scroll-panel

Klikk-semantikk (smart):
- I `useAudioTourStore`, lese `phase`:
  - `idle`/`ended` → caller scroll til seksjonen via `onCategoryClick(id)` → consumer dispatcher `SELECT_CATEGORY{source:"index"}` som triggrer scroll
  - `playing`/`paused`/`error` → caller jump audio: bygge tracks (samme som CategoryAudioButton gjør) + `goToTrack(targetIndex)`
- For å holde komponenten dum: la `CategoryIndex` selv håndtere klikk-modus-bevissthet, eller la consumer bestemme. **Beslutning:** Komponenten er smart — den vet om tour er aktiv og dispatcher korrekt. Det matcher `CategoryAudioButton`-mønsteret.

**Verification:**
- Render N rader for N kategorier
- Klikk i idle → scroll til kategori-seksjon (verifiseres ved at `state.activeCategoryId` settes)
- Klikk under aktiv tour → audio jumper til den kategorien (verifiseres ved at `trackIndex` endres)
- Played-state vises korrekt etter at noen kategorier er spilt
- Active-state vises på current kategori under tour

**Patterns to follow:**
- `CategoryAudioButton` for audio-jump-logic (build tracks + goToTrack)
- `BoardScrollPanel.deriveSectionState` for state-fallback-pattern
- `BoardRail.tsx` for thumbnail + transition-styling (selv om rail slettes, hent inspirasjon)

### Unit 4 — Integrasjon i `BoardScrollPanel` (desktop) + slett `BoardRail.tsx`

**Goal:** Erstatt `HomeSection` med `SidebarHero`. Sett inn `CategoryIndex` mellom hero og kategori-seksjonene. Slett `BoardRail.tsx`.

**Files:**
- Modify: `components/variants/report/board/desktop/BoardScrollPanel.tsx`
- Delete: `components/variants/report/board/desktop/BoardRail.tsx`

**Approach:**
I `BoardScrollPanel`:
1. Importere `SidebarHero` og `CategoryIndex`
2. Erstatte `<HomeSection ... />` med `<SidebarHero ... />`. Slette `HomeSection`-funksjonen i samme fil (intern, ingen ekstern import-bruker per nå).
3. Mellom SidebarHero og første kategori-seksjon: `<CategoryIndex />`
4. Beholde `CategorySection`-mappingen som før (pitch + chips)
5. Index-klikk håndteres internt i CategoryIndex (smart) — ingen ny dispatch fra scroll-panelet

`BoardRail.tsx` slettes — komponenten er allerede unmounted (commit `d595e87`). Per CLAUDE.md hygiene: ikke la dead code ligge.

**Verification:**
- Desktop rendrer nye sidebar med hero + index + seksjoner + (kun aktiv) player
- Klikk på index-row scroller til riktig seksjon (idle) / hopper audio (tour)
- TS-clean, lint-clean
- Ingen import-error etter rail-sletting (grep for `BoardRail` etter — bør være tomt)

**Patterns to follow:**
- Eksisterende `BoardScrollPanel`-struktur

### Unit 5 — Mobil-paritet

**Goal:** Mobil-sheeten bruker samme `SidebarHero` + `CategoryIndex` + kategori-seksjoner som desktop. Vurder å erstatte `BoardCategoryInfoTab` med direkte mounting av `BoardScrollPanel` (eller felles `SidebarContent`-komponent).

**Files:**
- Modify: `components/variants/report/board/mobile/BoardMobileSheet.tsx`
- Modify/Delete: `components/variants/report/board/BoardCategoryInfoTab.tsx` (vurder under unit)

**Approach:**
Utforsk: hvordan mountes kategori-content i mobil-sheet i dag? Per `BoardMobileSheet.tsx` line 336 mountes `BoardCategoryInfoTab` for én aktiv kategori. Ny anatomi krever at mobil-sheeten viser samme scroll-stream som desktop (hero + index + alle seksjoner) — ikke en aktiv-kategori-per-gang-modell.

To valg ved start av unit:
- (a) **Felles `SidebarContent`-komponent:** Ekstraher scroll-panel-innholdet (hero + index + seksjoner) til en delt komponent som både `BoardScrollPanel` og `BoardMobileSheet` mounter. `BoardScrollPanel` wrapper med sticky bottom-player.
- (b) **Mount `BoardScrollPanel` direkte i sheet:** Hvis sheet kan håndtere den full-stack-strukturen.

Velg (a) hvis (b) bryter sheet-snap-mekanikk; valg avgjøres ved start av unit.

`BoardCategoryInfoTab.tsx` slettes hvis ny mobil-mounting ikke trenger den. Hvis den fortsatt brukes for POI-detail-tab eller andre flater, beholdes.

**Verification:**
- Mobil-sheet viser hero + index + seksjoner (samme innhold som desktop)
- Index-klikk fungerer på mobil (scroll innen sheet eller åpne kategori)
- Bottom-player (sticky?) under aktiv tour — verifiser at sheet-snap ikke konflikter
- Test på iOS Safari hvis tilgjengelig (mobil-emulering i chrome-devtools-MCP fungerer i prototyping)

**Patterns to follow:**
- Eksisterende `BoardMobileSheet`-snap-stages

### Unit 6 — Polish + verifisering

**Goal:** Helhetlig visual-sweep og test-pass.

**Files:** Justering i komponenter fra Unit 2-5 etter behov.

**Approach:**
- Manuell browser-test, desktop + mobil-emulering
- Skjekk at index-state-cues er tydelige (played/active vs unplayed)
- Verifiser at action-row-play-knappen er tilstrekkelig dominant
- Sjekk at velkomst-tekst er passende lengde (truncate-logic produserer naturlige cut-offs)
- Sjekk at bottom-player-skjul i idle ikke skaper layout-skift når tour starter
- `tsc --noEmit` 0 feil
- `npm run lint` 0 errors
- Existing tests (audio-tour-store, featured-pois) passerer
- Skjermbilder før/etter (top-hero med ny play, indeks-liste, aktiv tour-tilstand)

## Deferred to Implementation (uavklart ved planlegging)

- **Mobile mounting-strategi (a) vs (b)** i Unit 5 — avgjøres ved start av unit, etter å lese `BoardMobileSheet`-snap-logikk
- **`StartTourButton` reuse vs ekstraksjon** i Unit 1 — sjekk eksisterende fil-innhold ved start
- **Truncation-strategi for velkomst-tekst** i Unit 2 — `home.heroIntro` truncated til N setninger, eller introduser nytt felt? Pilot kan bruke første variant; refaktor til eget felt hvis vi finner ut at heroIntro ikke gir naturlige cuts
- **Plass-budsjett mellom hero og index** — visuell tuning ved Unit 4
- **"···" + "del"-knapp-innhold** — pilot er placeholder

## Verification (helhetlig)

- `tsc --noEmit` → 0 feil
- `npm run lint` → 0 errors
- Vitest → eksisterende tester grønne (ingen ny test-skriving nødvendig for ren UI-refactor)
- Browser-test desktop: hero + index + seksjoner + (aktiv) player
- Browser-test mobil-emulering: samme innhold i sheet-form
- `grep -r "BoardRail" components/` → tomt etter Unit 4
- `grep -r "BoardCategoryInfoTab" components/` → tomt eller kun i sletes-fil etter Unit 5 (avhengig av valg)

## Open questions (ikke-blokkerende — alle løses ved implementasjon)

Ingen produkt-blokker — alle åpne punkter er implementasjons-detaljer som tas inline.
