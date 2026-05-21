---
topic: sidebar-spotify-anatomi
created: 2026-05-21
status: requirements
extends:
  - docs/brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md
related:
  - PROJECT-LOG.md (2026-05-21-entries)
---

# Sidebar Spotify-anatomi — kategori-nav i player + helhetlig sidebar-redesign

## Problem & motivasjon

Etter at rail (`BoardRail`) ble skjult for å presse fram bedre kategori-navigasjon i scroll + player, må vi løse to ting samtidig:

1. **Kategori-navigasjon må inn i en surface som ikke er rail.** Scroll alene er ikke nok — med 7-8 kategori-seksjoner blir det mye vertikal scroll uten oversikt.
2. **Audio-tour (USP) må promoteres bedre.** Bruker uttalte: "TROR jeg vil at flest mulig skal bli guidet." Den nåværende `BottomPlayer`-CTA i idle er for passiv — gjemt nederst i scroll-flata.

I tillegg: mobil-paritet er avgjørende ("vi må være knallgode på mobil"). Brukeren foreslo å adoptere Spotifys artist-page-mønster som felles mal for både mobil og desktop — løser tre problemer i ett anatomisk grep:

- **Spotify-pattern:** hero-image + tittel + meta + action-row med stor play + numerert "Popular"-liste under + bottom-player.
- Den runde play-knappen er gjenkjennelig som "play this" uten å være salesy CTA.
- Numerert kategori-liste er nav + indeks + "reisen er sekvensiell"-signal i ett.
- Bottom-player som tar over fokus når aktiv er et kjent mønster folk allerede vet hvordan funker.
- **Desktop-mobil-paritet:** Samme komponent-tre, mindre divergens i kodebasen.

Strategisk vinkel (fra bruker): hvis audio-tour-mønsteret fungerer godt på eiendom, åpner det for gjenbruk på events + turisme. Investering i å gjøre auto-modus naturlig er compounded value.

## Goals

1. Erstatte rail som kategori-navigasjon via en numerert indeks-liste i topp-sidebar.
2. Promotere audio-tour via en stor, gjenkjennelig play-knapp i top-hero (Spotify-style).
3. Slanke topp-tekst-vekt (40-50 ord velkomst i stedet for 70-ord-pitch).
4. Beholde dagens kategori-seksjoner (pitch + chips) under indeksen — additivt, lav risiko.
5. Holde bottom-player skjult i idle (ingen dobbel CTA), synlig kun under aktiv tour.
6. Levere én komponent-arkitektur som fungerer både på desktop og mobil.

## Anatomi (vedtatt)

Sidebar (desktop ≥lg som vertikal strip, mobil <lg som bottom-sheet) — én komponent, samme tre, layout-respons:

```
┌─────────────────────────────────┐
│  [Hero-illustrasjon, bredde]    │
│                                 │
│  StasjonsKvartalet              │  Stor tittel (text-2xl/3xl)
│  Brattøra · 8 min walking-tour  │  Lokasjon · tour-lengde (sub-line)
│                                 │
│  ⓘ N punkter · 7 kategorier     │  Meta-pill (akkumulert)
│                                 │
│  Kort velkomst-tekst            │  40-50 ord (ny tekst, ikke pitch)
│                                 │
│       [···]    [del]    ●▶      │  Action-row: sekundære + stor play
│                                 │
│  ─────────────────────────────  │
│  ÅPNINGEN · 7 KATEGORIER         │  Eyebrow-heading
│  1 [▦] Hverdagsliv         8 ▸  │  Kategori-row
│  2 [▦] Barn & oppvekst     6 ▸  │
│  …                              │
│  ─────────────────────────────  │
│                                 │
│  [Kategori-seksjoner som i dag] │  Eksisterende — pitch + chips
│                                 │
│  ╭─────────────────────────────╮│
│  │ Bottom-player (KUN aktiv)    ││  Skjult i idle/ended
│  ╰─────────────────────────────╯│
└─────────────────────────────────┘
```

## Beslutninger

### Top-hero
- **Hjem-pitch (70-ord-manus) blir AUDIO-only.** Leses kun av megler-stemmen i tour. Karaoke-effekten på Hjem-spor faller bort (ingen tekst å synke mot). *Begrunnelse: prioritering av audio-first; topp må ikke duplisere pitchen som tekst og audio samtidig.*
- **Ny slank velkomst-tekst (40-50 ord).** Setter rammen, peker mot audio for detalj. Genereres ved siden av pitchen (samme LLM-pipeline kan utvides).
- **Meta-pill:** "N punkter · 7 kategorier" — akkumulert tall over alle kategorier. Forteller skala uten å vise lista her (lista kommer like under).
- **Tour-lengde i sub-line:** "Brattøra · 8 min walking-tour" — total audio-varighet eller estimert lese-tid. Konkret commitment-info.

### Action-row
- **Stor rund play-knapp** (Spotify-grønn eller Placy-aksent — fargen avgjøres ved implementering). Klikk = start tour fra Hjem. Under aktiv tour: blir pause-knapp (samme posisjon, samme størrelse). Konsistent affordance.
- **Sekundære actions:** "···" (mer-meny) + "del" (kopier rapport-lenke). Mer-menyen er forberedt for fremtidig kontakt-megler, share-handlere, osv. — i pilot kan den være tom eller minimal.
- **Ingen "Følg"-knapp.** Spotify-pattern krever ikke alle elementene, kun mønsteret.

### Index-list
- **Numerert 1–N**, én row per kategori. Hjem inkluderes IKKE i listen (Hjem er top-hero — å liste den i indeksen ville dupliseres).
- **Row-innhold:** nummer + kategori-thumbnail (akvarell-mini, samme som dagens rail-icons) + label + antall punkter + chevron.
- **Klikk-semantikk (smart, modus-bevisst):**
  - **Idle (ingen tour):** scroll til kategori-seksjon i sidebar.
  - **Aktiv tour:** jump audio til den kategoriens spor (samme som CategoryAudioButton i dag).
- **Played-state visualisering:** Spilte kategorier får visuell markør (haket-ikon eller grønn-tint). Reuse av `playedCategoryIds` fra audio-tour-store. Mønsteret er identisk med hvordan Spotify markerer spilte sanger.
- **Active-state:** Kategori som spilles akkurat nå, eller scroll-aktiv kategori, får sterkere markering (full opacity + subtil bg-tint). Reuse av eksisterende section-progress-modell.

### Kategori-seksjoner (under indeksen)
- **Beholdes uendret.** Pitch + chips fortsetter å fungere som i dag. Indeksen er nav-snarvei, ikke erstatning.
- Border/spacing kan justeres senere når vi ser hvordan helheten ser ut.

### Bottom-player
- **Skjult i idle/ended.** Top-hero eier "start tour"-CTA-rollen — bunnen skal ikke duplisere.
- **Synlig kun under aktiv tour (playing/paused/error).** Da er den controller-flate: track-meta, transport-controls, lukk-knapp.
- I praksis betyr dette at `BottomPlayer`-komponenten må omstruktureres så `IdleState` kan returnere null (eller fjernes helt) — `StartTourButton` flyttes til top-hero.

### Mobile vs desktop
- **Én komponent-arkitektur.** Samme `<SidebarHero>` + `<CategoryIndex>` + `<CategorySections>` + `<BottomPlayer>` brukes på begge.
- **Layout-respons:** Desktop får sidebaren som vertikal 400px-strip (som i dag). Mobil får den som bottom-sheet (vaul) med samme innhold.
- Konsekvens: BoardCategoryInfoTab (dagens mobile-tab) blir trolig overflødig — kategori-seksjonen ER samme komponenten på begge plattformer.

## Scope boundaries

### In scope
- Ny `SidebarHero`-komponent (eller utvidet `HomeSection`) med image, tittel, sub-line, meta-pill, ny velkomst-tekst, action-row med stor play.
- Ny `CategoryIndex`-komponent (numerert liste, smart klikk-semantikk, played/active-state).
- Endring i `BottomPlayer`: skjul i idle.
- Ny "velkomst-tekst"-felt på `BoardHome` eller `ReportConfig` — kortere variant av heroIntro.
- Mobile-paritet via felles komponenter.

### Out of scope
- "Følg"-knapp eller andre Spotify-elementer vi ikke trenger.
- Auto-play av audio på landing (browser-policy-utfordring, og brukeren landet på "klikk-CTA"-modell i denne brainstormen).
- Karaoke på Hjem-velkomst (Hjem-pitch er audio-only; karaoke gjelder fortsatt kategori-spor).
- Endringer i kategori-seksjoner under indeksen (pitch + chips beholdes som i dag).

### Deferred to separate tasks
- **Curator-flyt for featured POIs per kategori** (allerede deferred i tidligere plan).
- **Generering av slank velkomst-tekst (40-50 ord):** Kan håndteres som content-pipeline-utvidelse senere. I første implementasjon kan vi enten bruke `heroIntro` slik den er (men vise færre setninger) eller hardkode for pilot.
- **Mer-meny-innhold:** Kontakt-megler, kopi-link, share. Plassholder i første implementasjon, populeres når use-case-er er klare.

## Success criteria

1. Brukeren ser umiddelbart hvor mange kategorier som finnes og kan hoppe direkte til hvilken som helst — uten å scrolle.
2. Audio-tour-CTA er synlig **above the fold** ved landing (top-hero), ikke gjemt nederst.
3. Mobile-versjonen føles "native" — Spotify-aktig, ikke som en omformatert desktop-sidebar.
4. Når audio-tour spiller, kommuniserer indeksen tydelig hvilken kategori som er current + hvilke som er spilt.
5. Ingen visuell "dobbel CTA" — top-hero og bottom-player konkurrerer aldri om samme rolle.
6. Brukeren kan starte tour uten å lese forklarende tekst — play-knappen er selv-forklarende.

## Open questions (ikke-blokkerende)

- **Tour-lengde i sub-line:** Skal det være total audio-varighet (krever audio-durations samles på build), estimert lese-tid, eller bare antall spor? Pilot kan starte med antall spor ("7 spor · ~8 min" eller bare "7 spor"), oppgraderes når audio-durations er hydrert.
- **Velkomst-tekst-kilde:** Bruke eksisterende `heroIntro` (kanskje truncated), eller introdusere et nytt felt for kort variant? Avgjøres ved plan/implementasjon.
- **Mobile bottom-sheet vs full-screen:** Spotify har full-screen artist-page på mobil. Vår nåværende mobil bruker bottom-sheet (vaul) med snap-stages. Skal vi vurdere full-screen take-over når tour spiller? Defer til mobile-implementasjon — første runde holder bottom-sheet for backward-compat.
- **Index-row chevron-klikk vs row-klikk:** Hele rowen er klikkbar, chevron er bare visuell affordance. Greit?

## Avhengigheter / antakelser

- `useAudioTourSectionProgress` og `playedCategoryIds` fra audio-tour-store er allerede etablerte — gjenbrukes for index-row-state.
- `OPEN_POI`-dispatch finnes for å åpne POI-overlay — chip-klikk-mønsteret fra `CategoryFeaturedChips` reuses for any POI-engagement fra indeksen.
- Eksisterende `BoardScrollPanel` + `BoardCategoryInfoTab` representerer dagens kategori-rendering — kan refaktoreres til felles komponent for desktop/mobil-paritet.
- `BoardRail.tsx` er midlertidig unmounted — slettes når denne anatomien er implementert (vi trenger ikke rail når indeks-liste tar over rollen).
