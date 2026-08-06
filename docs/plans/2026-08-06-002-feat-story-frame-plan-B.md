---
title: "feat: Story-framen (plan B) — fortellingen alene, uten oppslagsverket"
type: feat
status: active
date: 2026-08-06
origin: docs/brainstorms/2026-08-06-story-som-ortogonalt-tillegg-requirements.md
---

# feat: Story-framen (plan B) — fortellingen alene, uten oppslagsverket

## Overview

Plan A gjør nabolagsflaten til mobil-standard og storyen til et overlegg. Plan B
strammer innholdet i selve overlegget: kartkortet ut, tekstlaget urørt, to knapper,
definerte tilstander, og gester som ikke krever at brukeren har lært et nytt
mønster.

Denne planen eier **hva som står i story-flaten og hvordan den oppfører seg**. Den
eier ikke monteringen eller bryteren.

## Problem Frame

Story-flaten viser i dag fortelling og oppslagsverk samtidig. I
`components/variants/report/reels/ReportReelsPage.tsx:936-960` ligger et peek-slør
med «Se N punkter»-CTA (`PEEK_MINIMIZED_VISIBLE = "125px"`) oppå story-slidet. Det
okkluderer karaoke-teksten og gir fem konkurrerende elementer i én viewport.

Flaten er ikke for avansert i delene sine — den er umodal. Målgruppen er en
boligkjøper som kommer kald fra en annonse i Chrome på iPhone, uten app-affordanser
og uten innlært forventning til flaten (se origin:
`docs/brainstorms/2026-08-06-story-som-ortogonalt-tillegg-requirements.md`).

Én ting gjør denne planen mer risikofylt enn den ser ut. `ReelsTransport` — som
plan B fjerner fra mobil — er dokumentert som nettopp det som gjorde en
**lock-bug-klasse umulig**: «exit-affordanser blir flate-koblet, ikke beat-koblet
→ det finnes alltid en transport med tappbare segmenter + chevron/Tilbake»
(`docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md`).
Fjerner vi transporten uten å flytte garantien eksplisitt til ✕, gjeninnfører vi
en buggklasse som allerede er betalt for én gang.

## Requirements Trace

- R5. Under avspilling: bilde/video, kategorilabel, karaoke-tekst,
  progresjonsindikator, og **nøyaktig to knapper** — ✕ og 🔊. Tappesoner og
  hold-gester teller ikke mot budsjettet.
- R6. Peek-sløret og «Se N punkter» fjernes. Kartet er ikke synlig i story-modus.
- R7. Karaoke-teksten beholdes.
- R8. Auto-advance ved spor-slutt; tapp høyre = frem, tapp venstre = tilbake,
  **langt trykk = pause** så lenge det holdes.
- R9. «Se stedene» vises **én gang, ved slutten av hele sekvensen**.
- R10. Story-flaten skal ikke krasje eller utløse reload på fysisk iPhone med
  `gmp-map-3d` montert under.
- R18. Ingen fast chrome kan okkluderes; lesbar kontrast over lyst som mørkt
  medieinnhold; ✕ og 🔊 minimum 44×44 pt.
- R19. Lyd starter **på** ved story-start.
- R20. Definert ventetilstand mens første medie- og lydspor bufrer.
- R21. Definert feiltilstand når et spor ikke kan lastes; gjenbruk
  `phase === "error"` og `resume()`.
- R22. Terminal sluttilstand: ingen loop, ingen stille auto-retur.
- R23. `welcome`, `home` og `outro` må ha en visuell bakgrunn som ikke er kartet.
- R24. `prefers-reduced-motion` respekteres.
- R25. Karaoke-teksten er ekte DOM-tekst eksponert for skjermleser.
- R26. Langt trykk er pause-mekanismen som oppfyller WCAG 2.2.2.

## Scope Boundaries

- Desktop er urørt. `DesktopStorySidebar` beholder `StoryProgressBar`,
  `ReelsTransport` og dagens navigasjon.
- Monteringen, bryteren og inngangsaffordansen tilhører plan A.
- Ingen nye medie-produksjoner. Eksisterende assets på de to testboardene.
- Ingen endring i audio-tour-generering eller manus.

### Deferred to Separate Tasks

- **Kategorispiller** — samme spiller med kortlista filtrert på `categoryId`, med
  utgang til kategorisiden. Egen runde rett etter denne; `CategoryReelCard` og
  `buildCategoryTracks()` finnes alt, så arbeidet er filtrering og én ekstra utgang.
- **Instrumentering av fullføringsrate** — `lib/instrumentation/log-event.ts`
  finnes; hendelsesnavn avgjøres når spilleren står.
- **Per-strøk VO-amortisering** — eget spor.

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/reels/ReportReelsPage.tsx` — peek-geometrien
  (`:842-884`), peek-CTA-en (`:936-960`), advance-timeren (`:415-419`),
  teaser-garden (`:474-485`), `phase === "error"` og `resume()` (`:637`).
- `components/variants/report/reels/reels-state.tsx` — `mapOpen`, `teaserArmed`,
  `defaultMapOpenForCard` (`:58-61`, returnerer `true` for welcome/home/outro),
  `UNLOCK_AUDIO`/`audioUnlocked` (`:38`).
- `components/variants/report/reels/reels-data.ts` — `decideTrackEndedAction()`
  (`:540`), `CATEGORY_ADVANCE_PAUSE_MS`, `CATEGORY_TEASER_MS`, kort-typene,
  `isAudioBearing()`, `audioDurationSec()`.
- `components/variants/report/reels/ReelSwipeStack.tsx`, `CategoryReel.tsx`,
  `IntroReel.tsx`, `SummaryReel.tsx`, `MeglerReel.tsx` — kort-renderne.
- `components/variants/report/reels/KaraokeTeleprompter.tsx` og
  `components/variants/report/board/audio-tour/KaraokePitchText.tsx`,
  `karaoke-tokens.ts` — tekstlaget som skal beholdes.
- `components/variants/report/board/audio-tour/use-audio-element.tsx` — lyd-livssyklus,
  `onTrackEnded`-rebinding.
- `components/variants/report/reels/NowPlayingCard.tsx`, `ReelsMenu.tsx`,
  `ReelsTransport.tsx`, `StoryProgressBar.tsx` — chrome som skal vurderes for
  mobil-fjerning, men som desktop fortsatt bruker.

### Institutional Learnings

`docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md`
— **les hele før arbeid starter.** Fem lærdommer binder denne planen:

1. **Lock-bug-klassen.** Transporten var garantien for at det alltid fantes en vei
   ut. Plan B fjerner den fra mobil → ✕ må overta garantien eksplisitt, og det må
   testes for hver korttype.
2. **Advance-timerens tre guards** var de to dyreste bugene i modellen:
   `!state.mapOpen` (timeren skal ikke armes mens brukeren er på kartflaten),
   kansellering ved `visibilitychange === "hidden"` (overlevde ellers backgrounding
   og fyrte ved retur), og en fire-time-guard som leser fersk state via `stateRef`
   og avbryter hvis `activeIndex` endret seg. `mapOpen` blir alltid falsk på mobil
   etter denne planen, men **de to andre guardene må overleve refaktoreringen**.
3. **Play/pause på ikke-audio-kort.** `trackIndex` står igjen på siste audio-spor
   (outro) når man parkerer på summary/megler; naiv `resume()` spilte outro-VO
   disembodied. Direkte relevant for langt-trykk-pause (Unit 4) og terminal
   sluttilstand (Unit 6).
4. **`gmp-map-3d` kan ikke gjøres ikke-interaktiv via `GestureHandling`.** Eneste
   beskyttelse er et gjennomsiktig pointer-events-skjold. Story-flaten dekker
   kartet visuelt, men skjoldet skal ikke fjernes fordi overlegget «likevel
   dekker».
5. **Swipe-basert kapittelnavigasjon ble bevisst utelatt i v1** fordi transporten
   eide navigasjonen. Når transporten går, blir tappesonene den eneste
   navigasjonen — det er en bevisst reversering, ikke en videreføring.

`docs/solutions/performance-issues/webgl-context-leak-per-render-probe-20260603.md`
— kontekst-lekkasjen er fikset; risikoen i R10 er minne, ikke kontekst-antall.
Måleharness og advarsel om GPU-forurensning på tvers av tab-lukking.

`docs/solutions/ui-bugs/google-maps-3d-webgl-context-crash-touch-devices-20260415.md`
— iOS WebKit tåler kun én aktiv WebGL-kontekst per side.

### External References

- [3D Maps — Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/reference/3d-map)
  — `mode` må settes for at 3D-kartet skal begynne å rendre. Eneste dokumenterte
  render-bryter, testet i plan A Unit 1.

## Key Technical Decisions

- **Langt trykk pauser, ikke tapp.** Tapp er navigasjon (R8). Å droppe pause helt
  ville brutt WCAG 2.2.2 for auto-advancing innhold; å legge pause på tapp ville
  kollidert med navigasjonen. Langt trykk er Instagram-konvensjonen, koster null
  synlige elementer, og er mønsteret målgruppen alt har lært.
- **✕ arver transportens lock-bug-garanti.** Ikke et bieffekt-krav, men den
  eksplisitte erstatningen for en mekanisme institusjonell kunnskap sier vi ikke kan
  være uten.
- **Lyd starter på.** Spill-av-tappet er iOS-unlock-gesten. Muted-som-trygg-default
  er den vanlige videokonvensjonen og ville tømt storyen for innholdet sitt — R7s
  begrunnelse for karaoke antar implisitt at lyd er på.
- **«Se stedene» én gang til slutt, ikke per kategori.** Sju utgangsramper gjennom
  fortellingen ville gjeninnført nettopp den midt-i-story-affordansen R6 fjerner.
- **`decideTrackEndedAction()` er der R6 og R9 møtes.** Å fjerne peek-CTA-en
  fjerner det eneste mobile kallet til `setMapOpen(true)`, og overgangsmodellen for
  hva som skjer ved spor-slutt bor i samme funksjon som avgjør når «Se stedene»
  skal vises. De er én refaktorering.

## Open Questions

### Resolved During Planning

- **Skal karaoke flyttes til kategorisiden?** Nei. Karaoke *er* undertekstlaget og
  er det som gjør VO-en brukbar med lyden av. Det som skal ut av framen er
  kartkortet, ikke tekst (se origin: Key Decisions).
- **Hva betyr «segment-slutt» i R9?** Slutten på hele sekvensen, ikke per kategori.
- **Er kontekst-antall risikoen i R10?** Nei — lekkasjen er fikset og målt flat.
  Risikoen er minnetrykk fra videodekoding + lyd + tiles.

### Deferred to Implementation

- **Om `NowPlayingCard`, `ReelsMenu` og `ReelsTransport` blir desktop-only eller
  helt døde.** Avgjøres i Unit 3 når det er synlig hva desktop faktisk fortsatt
  leser. Ingen av dem slettes før desktop-stien er sporet.
- **Hvor mye av `mapOpen`-undermaskinen som blir dødt på mobil.**
  `teaserArmed`, `CATEGORY_TEASER_MS`, `PEEK_MINIMIZED_VISIBLE` og deler av
  `decideTrackEndedAction()` mister sin mobile trigger. Unit 1 kartlegger; sletting
  skjer bare der desktop ikke leser det.
- **Hva «dempet» auto-advance konkret betyr under `prefers-reduced-motion`** —
  lengre visningstid, ingen medieovergang, eller manuell avansering. Unit 7.
- **Om karaoke-tempoet er ≤ sporlengden for alle segmenter.** Ved kort video og
  lang tekst kan en stille leser miste tekst før auto-advance fyrer. Måles på reelle
  spor i Unit 7, ikke antatt.
- **Om plan A Unit 1 fant en render-strupe-mekanisme.** Fant den én, implementeres
  den i Unit 1 her (som allerede rører kart-geometrien). Fant den ingen, står R10
  som en dokumentert måling.

## High-Level Technical Design

> *Dette illustrerer den tiltenkte tilnærmingen og er retningsgivende for
> gjennomgang, ikke en implementasjonsspesifikasjon. Den implementerende agenten
> skal behandle det som kontekst, ikke kode å reprodusere.*

Tilstandene story-flaten kan være i, og hvordan man forlater hver av dem. Poenget
med diagrammet er at **✕ finnes i alle tilstander** — det er lock-bug-garantien:

```
                    ┌──────────────┐
        [▶] ───────▶│   VENTER     │  R20  (bufrer første spor)
                    └──────┬───────┘
                           │              ✕ ──▶ nabolagsflaten
                    ┌──────▼───────┐
              ┌────▶│   SPILLER    │  R5, R7, R19
              │     └──┬────┬───┬──┘
    slipp     │        │    │   │ tapp h/v ──▶ neste/forrige kort  (R8)
              │        │    │   └── spor slutt ──▶ neste kort      (R8)
              │  hold  │    │
              │  (R8)  │    │ lastefeil
        ┌─────┴─────┐  │    ▼
        │  PAUSET   │◀─┘  ┌──────────────┐
        └───────────┘     │    FEIL      │  R21
              ✕           └──────┬───────┘
              │                  │  resume() / ✕
              │           ┌──────▼───────┐
              └──────────▶│  nabolags-   │
                          │    flaten    │◀── «Se stedene»
                          └──────────────┘         │
                    ┌──────────────┐               │
   siste kort ─────▶│  FERDIG      │───────────────┘
                    │  R22 terminal│  ingen loop
                    └──────────────┘
```

Chrome-budsjettet i R5, som en avgrensning mot dagens tilstand:

| Element | I dag | Etter plan B |
|---|---|---|
| Bilde/video | ja | ja |
| Karaoke-tekst | ja, okkludert av kartkortet | ja, aldri okkludert (R18) |
| Kategorilabel | ja | ja |
| Progresjon | `StoryProgressBar` + `n/total` i transport | progresjonsindikator |
| Kartkort + «Se N punkter» | ja | **fjernet** (R6) |
| `NowPlayingCard` (navn, «20 steder», 5/6) | ja | **fjernet fra mobil** |
| `ReelsMenu` (`⋯`) | ja | **fjernet fra mobil** |
| `ReelsTransport` (play/pause, segmenter) | ja | **fjernet fra mobil** |
| ✕ lukk | nei (chevron i transport) | **ja — lock-bug-garantien** |
| 🔊 lyd av/på | i transport | ja |
| **Knapper totalt** | 5+ | **2** |

## Implementation Units

- [ ] **Unit 1: Fjern peek og kartkortet; kartlegg `mapOpen`-undermaskinen**

**Goal:** Kartet er ikke synlig i story-modus, og det er dokumentert hva som blir
dødt på mobil når peek-CTA-en mister sin eneste kaller.

**Requirements:** R6, R10

**Dependencies:** Plan A Unit 3 og Unit 4 (nabolagsflaten ubetinget, overlegget
montert). Plan A Unit 1s konklusjon om render-strupemekanisme.

**Files:**
- Modify: `components/variants/report/reels/ReportReelsPage.tsx`
- Modify: `components/variants/report/reels/reels-state.tsx` (kun hvis
  `teaserArmed` viser seg dødt på begge flater)
- Test: `components/variants/report/reels/__tests__/`

**Approach:**
- Fjern peek-sløret, «Se N punkter»-CTA-en, `peekActive`, `peekExpanded`,
  `peekPlaceCount` og `PEEK_MINIMIZED_VISIBLE` fra mobilstien.
- Kartlegg — ikke slett blindt — hva som mister sin trigger: `setMapOpen(true)` har
  peek-CTA-en som eneste mobile kaller, så `mapOpen` blir styrt utelukkende av
  `defaultMapOpenForCard()` per kort. Spor hva `decideTrackEndedAction()`,
  `teaserArmed`, `CATEGORY_TEASER_MS` og `CATEGORY_ADVANCE_PAUSE_MS` faktisk gjør
  når `mapOpen` aldri settes av bruker.
- **Slett bare det desktop ikke leser.** `DesktopStorySidebar` bruker samme
  datamodell og deler av samme maskineri; sporet må følges før noe fjernes.
- **Behold advance-timerens to overlevende guards:** kansellering ved
  `visibilitychange === "hidden"`, og fire-time-guarden som leser fersk state via
  `stateRef`. `!state.mapOpen`-guarden blir en no-op på mobil, men de to andre er
  dokumentert som de dyreste bugene i modellen og skal ikke forsvinne i ryddingen.
- Hvis plan A Unit 1 fant en render-strupemekanisme, implementeres den her.

**Execution note:** Karakteriser først. Skriv dekning for dagens spor-slutt-oppførsel
per korttype før du rører `decideTrackEndedAction()` — den koder en overgangsmodell
som er lettere å bevare enn å gjenskape.

**Patterns to follow:**
- `docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md`
  — hele avsnittet «Auto-advance-timer + async-races».
- `mapStyle`-ternæren i `ReportReelsPage.tsx` for hvordan én kart-instans avsløres
  i ulik geometri.

**Test scenarios:**
- Happy path: kategori-kort under avspilling → ingen kartkort, ingen
  «Se N punkter» i DOM.
- Happy path: spor slutter på et kategori-kort → neste kort, uten teaser-mellomsteg.
- Integration: `visibilitychange === "hidden"` under avspilling → advance-timeren
  kanselleres og fyrer ikke ved retur til fanen.
- Integration: `activeIndex` endres mens timeren løper → fire-time-guarden avbryter,
  ingen dobbelt-advance.
- Integration: kun én `gmp-map-3d` er montert; ingen unmount ved åpning/lukking.
- Edge case: segment-tapp på samme kapittel (reduceren no-op-er) → ingen
  dobbelt-advance.
- Edge case: desktop-renderen er uendret — `DesktopStorySidebar` beholder sin
  progresjon og transport.

**Verification:**
- Kartet er ikke synlig i story-modus på mobil.
- Karaoke-teksten er ikke okkludert av noe.
- Det som er slettet, er verifisert ulest av desktop.
- De to overlevende timer-guardene har testdekning.

---

- [ ] **Unit 2: `welcome`, `home` og `outro` får en bakgrunn som ikke er kartet**

**Goal:** De tre korttypene som i dag bruker kartet som primærflate får en visuell
bakgrunn som holder når kartet forsvinner.

**Requirements:** R23, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `components/variants/report/reels/reels-state.tsx`
  (`defaultMapOpenForCard`)
- Modify: `components/variants/report/reels/CategoryReel.tsx` eller de aktuelle
  kort-renderne
- Test: `components/variants/report/reels/__tests__/`

**Approach:**
- `defaultMapOpenForCard()` returnerer `true` for `welcome`, `home` og `outro` —
  altså er kartet deres primærflate i dag. R6 fjerner den. Uten tiltak faller de
  tilbake til `illustrationSrc`, og resultatet må ses, ikke antas.
- `welcomeVideoSrc()` og `homeVideoSrc()` returnerer bare noe for medlemmer av
  `REELS_MONTAGE_PROJECTS`, som i praksis er `stasjonskvartalet` alene. På
  `byggetrinn-4` finnes derfor ingen video for disse kortene — verifiser hva
  `illustrationSrc` faktisk gir der.
- Er fallbacken tom eller svak på et testboard, er det et innholdsfunn som skal
  rapporteres, ikke skjules bak en gradient.

**Patterns to follow:**
- `posterForVideo()` og `thumbView()` i `reels-data.ts` for hvordan bilde velges
  med fallback.

**Test scenarios:**
- Happy path: `welcome`-kort på `stasjonskvartalet` → video-bakgrunn, ikke kart.
- Happy path: `welcome`-kort på `byggetrinn-4` → illustrasjon, ikke kart, ikke tom
  flate.
- Edge case: kort uten både `videoBgSrc` og `illustrationSrc` → definert
  fallback-bakgrunn, aldri gjennomsiktig ned til kartet.
- Edge case: `outro`-kort → samme behandling som welcome/home.
- Integration: karaoke-teksten er lesbar mot hver av de tre bakgrunnstypene (R18).

**Verification:**
- Ingen av de tre korttypene viser kartet.
- Ingen av dem viser en tom eller gjennomsiktig flate på noe testboard.

---

- [ ] **Unit 3: Chrome-budsjettet — to knapper, aldri okkludert, ✕ som lock-bug-garanti**

**Goal:** Story-flaten har nøyaktig to knapper, all fast chrome er lesbar og
uokkludert, og det finnes alltid en vei ut fra hver korttype.

**Requirements:** R5, R7, R18

**Dependencies:** Unit 1

**Files:**
- Modify: `components/variants/report/reels/ReportReelsPage.tsx`
- Modify: `components/variants/report/reels/NowPlayingCard.tsx`,
  `ReelsMenu.tsx`, `ReelsTransport.tsx` (mobil-fjerning; desktop-sti intakt)
- Test: `components/variants/report/reels/__tests__/`

**Approach:**
- Mobil får ✕ og 🔊 og ingenting mer. `NowPlayingCard`, `ReelsMenu` og
  `ReelsTransport` fjernes fra mobilstien — men **ikke slettes** før desktop-stien
  er sporet (se Deferred to Implementation).
- **✕ arver transportens garanti.** Institusjonell kunnskap sier at flate-koblede
  exit-affordanser er det som gjorde lock-bug-klassen umulig. Når transporten går,
  må ✕ være til stede og tappbar i **hver** tilstand og på **hver** korttype —
  inkludert `summary` og `megler`, som ikke er audio-bærende, og `intro`, som ikke
  har lyd i det hele tatt.
- R18 gjelder all fast chrome, ikke bare karaoke: ✕, 🔊 og progresjonsindikatoren
  må holde lesbar kontrast over både lyst og mørkt medieinnhold, og ✕/🔊 må ha
  minimum 44×44 pt treffflate.
- Karaoke-teksten skal aldri okkluderes (R7). Det var kartkortets feil i dag; sørg
  for at ingen ny chrome tar dens plass.

**Patterns to follow:**
- Kontrast-håndtering i eksisterende kort-rendere som legger tekst over foto.
- `tour-mode.css` i `components/variants/report/board/audio-tour/` for
  karaoke-typografi.

**Test scenarios:**
- Happy path: under avspilling er nøyaktig to knapper i DOM — ✕ og 🔊.
- Happy path: ✕ er tappbar og lander på nabolagsflaten.
- Integration (lock-bug): for **hver** korttype (`intro`, `welcome`, `home`,
  `category`, `outro`, `summary`, `megler`) finnes en tappbar vei ut. Ingen korttype
  kan fange brukeren. Dette er den viktigste testen i planen.
- Edge case: ✕ og 🔊 har ≥44×44 pt treffflate.
- Edge case: karaoke-tekst over et lyst bilde er fortsatt lesbar.
- Edge case: `NowPlayingCard`, `ReelsMenu` og `ReelsTransport` er ikke i DOM på
  mobil.
- Integration: desktop beholder `ReelsTransport` og `StoryProgressBar` uendret.

**Verification:**
- Ingen korttype kan fange brukeren.
- Nøyaktig to knapper på mobil.
- Desktop-renderen er uendret.

---

- [ ] **Unit 4: Lyd på ved start, tappesoner og langt trykk som pause**

**Goal:** Lyden spiller fra første sekund, navigasjonen er tapp, og pause finnes
uten å legge til et synlig element.

**Requirements:** R19, R8, R26

**Dependencies:** Unit 3

**Files:**
- Modify: `components/variants/report/reels/ReportReelsPage.tsx`
- Modify: `components/variants/report/reels/ReelSwipeStack.tsx`
- Modify: `components/variants/report/board/audio-tour/use-audio-element.tsx` (kun
  hvis pause/resume trenger en ny inngang)
- Test: `components/variants/report/reels/__tests__/`

**Approach:**
- Spill-av-tappet fra plan A er iOS-unlock-gesten. `UNLOCK_AUDIO` /
  `audioUnlocked` finnes; lyden skal starte **på**, ikke muted. Dette er eksplisitt
  fordi muted-som-trygg-default er den vanlige videokonvensjonen og ville gjort
  hele VO-produktet stille (se origin: R19).
- Tappesoner: høyre halvdel frem, venstre halvdel tilbake. Sonene ligger på
  medieflaten og teller ikke mot R5s knappebudsjett. Merk at swipe-navigasjon ble
  bevisst utelatt i forrige runde fordi transporten eide navigasjonen — nå er
  tappesonene den eneste navigasjonen, som er en bevisst reversering.
- Langt trykk pauser så lenge det holdes, og gjenopptar ved slipp (R26, WCAG
  2.2.2). Terskelen må være lang nok til at et vanlig navigasjonstapp ikke leses
  som hold.
- **Fallgruve fra institusjonell kunnskap:** `trackIndex` står igjen på siste
  audio-spor når man parkerer på et ikke-audio-kort (`summary`, `megler`). Naiv
  `resume()` spilte da outro-VO disembodied. Pause/resume må håndtere at aktivt
  kort ikke er audio-bærende.

**Patterns to follow:**
- `isAudioBearing()` i `reels-data.ts` for å avgjøre om et kort har lyd.
- Play/pause-håndteringen beskrevet i
  `docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md`
  under «Play/pause på ikke-audio-kort».
- `use-reels-toggle-play.ts` for eksisterende toggle-semantikk.

**Test scenarios:**
- Happy path: story åpnes → lyd spiller, ikke muted.
- Happy path: tapp høyre → neste kort. Tapp venstre → forrige kort.
- Happy path: langt trykk → avspilling pauser. Slipp → gjenopptar samme spor fra
  samme posisjon.
- Edge case: langt trykk på første kort, slipp → gjenopptar, hopper ikke.
- Edge case: tapp venstre på første kort → ingen navigasjon, ingen krasj.
- Edge case: tapp høyre på siste kort → terminal sluttilstand (Unit 6), ikke loop.
- Error path: langt trykk mens aktivt kort ikke er audio-bærende (`summary`,
  `megler`) → ingen disembodied VO fra et tidligere spor.
- Edge case: 🔊 slår av lyden → karaoke-teksten fortsetter å følge sporet, så
  fortellingen er fortsatt lesbar.
- Integration: hold-terskelen er lang nok til at et navigasjonstapp ikke leses som
  pause.

**Verification:**
- Lyd spiller fra start på fysisk iPhone etter ett tapp.
- Pause fungerer og oppfyller WCAG 2.2.2.
- Ingen disembodied VO i noen tilstand.

---

- [ ] **Unit 5: Ventetilstand og feiltilstand**

**Goal:** Brukeren får aldri en frossen eller blank flate som leser som at knappen
ikke virket.

**Requirements:** R20, R21, R13

**Dependencies:** Unit 4

**Files:**
- Modify: `components/variants/report/reels/ReportReelsPage.tsx`
- Modify: `components/variants/report/reels/EmbedArrivalLoader.tsx` (kun hvis
  mønsteret kan gjenbrukes)
- Test: `components/variants/report/reels/__tests__/`

**Approach:**
- Ventetilstand (R20): fra tapp til første medie- og lydspor er klart. Målgruppen
  er på mobilnett; latens er reell, og en blank fullskjerm i to sekunder leser som
  en død knapp.
- Feiltilstand (R21): gjenbruk `phase === "error"` og `resume()` som finnes i
  splash-flyten (`ReportReelsPage.tsx:637`). Ikke stille hopp til neste spor —
  det leser som at appen er ødelagt.
- Begge tilstander må ha ✕ tilgjengelig (R18, Unit 3), og feiltilstanden må kunne
  lande på nabolagsflaten (R13).

**Patterns to follow:**
- `EmbedArrivalLoader.tsx` for etappe-basert lastetekst, hvis mønsteret passer.
- `phase === "error"` / `resume()`-håndteringen i splash-flyten.

**Test scenarios:**
- Happy path: tapp → ventetilstand vises → første kort spiller.
- Happy path: første spor er cachet → ventetilstanden er kort eller hoppes over
  uten flimmer.
- Error path: lydsporet returnerer 404 → feiltilstand vises, ikke blank flate.
- Error path: videobakgrunnen feiler men lyden er ok → fortellingen fortsetter med
  fallback-bakgrunn.
- Error path: `resume()` fra feiltilstand → avspilling gjenopptas.
- Error path: ✕ fra feiltilstand → nabolagsflaten (R13).
- Edge case: ✕ under ventetilstand → nabolagsflaten, ingen hengende lasting.
- Integration: nettverk faller ut midt i sekvensen → feiltilstand, ikke stille stopp.

**Verification:**
- Ingen tilstand viser en blank fullskjerm uten forklaring.
- ✕ er tilgjengelig i både vente- og feiltilstand.

---

- [ ] **Unit 6: Terminal sluttilstand og «Se stedene» én gang**

**Goal:** Sekvensen slutter én gang, tydelig, med én vei videre.

**Requirements:** R9, R22, R13

**Dependencies:** Unit 5

**Files:**
- Modify: `components/variants/report/reels/ReportReelsPage.tsx`
- Modify: `components/variants/report/reels/reels-data.ts`
  (`decideTrackEndedAction()`)
- Test: `components/variants/report/reels/__tests__/`

**Approach:**
- «Se stedene» vises **én gang**, etter siste kort. Ikke per kategori — sju
  utgangsramper ville gjeninnført midt-i-story-affordansen R6 fjerner.
- Sluttilstanden er terminal: ingen loop, ingen stille auto-retur. Brukeren velger
  å gå videre.
- **Fallgruven:** siste kort i sekvensen er `megler` (eller `summary`), som ikke er
  audio-bærende. `trackIndex` står da igjen på outro-sporet. Sluttilstanden må ikke
  kunne trigge en `resume()` som spiller outro-VO på nytt.
- `decideTrackEndedAction()` er felles med desktop. Endringer der må verifiseres
  mot `DesktopStorySidebar`.

**Patterns to follow:**
- `decideTrackEndedAction()` og `TrackEndedAction`-typen i `reels-data.ts`.
- «Play/pause på ikke-audio-kort» i
  `docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md`.

**Test scenarios:**
- Happy path: siste kort ferdig → sluttilstand med «Se stedene».
- Happy path: «Se stedene» → nabolagsflaten.
- Edge case: «Se stedene» finnes **ikke** ved slutten av et kategori-kort midt i
  sekvensen.
- Edge case: sekvensen looper ikke — siste kort går ikke til første.
- Edge case: ingen stille auto-retur; sluttilstanden står til brukeren handler.
- Error path: sluttilstand trigger ikke `resume()` av et gammelt lydspor.
- Integration: desktops spor-slutt-oppførsel er uendret etter endring i
  `decideTrackEndedAction()`.
- Edge case: board med kun ett audio-bærende kort → sluttilstanden nås korrekt.

**Verification:**
- «Se stedene» vises nøyaktig én gang per gjennomspilling.
- Ingen loop, ingen disembodied VO.
- Desktop uendret.

---

- [ ] **Unit 7: Tilgjengelighet — reduced-motion, skjermleser, tekst-tempo**

**Goal:** Storyen er brukbar for de som slår av bevegelse, bruker skjermleser, eller
leser i stedet for å lytte.

**Requirements:** R24, R25, R7

**Dependencies:** Unit 6

**Files:**
- Modify: `components/variants/report/reels/KaraokeTeleprompter.tsx`
- Modify: `components/variants/report/board/audio-tour/KaraokePitchText.tsx`
- Modify: `components/variants/report/reels/ReportReelsPage.tsx`
- Test: `components/variants/report/reels/KaraokeTeleprompter.test.tsx`
- Test: `components/variants/report/board/audio-tour/KaraokePitchText.test.tsx`

**Approach:**
- `prefers-reduced-motion` (R24): fullskjerms auto-advance med medieoverganger og
  animert karaoke er høy bevegelse. Avgjør konkret hva «dempet» betyr — lengre
  visningstid, ingen medieovergang, eller manuell avansering — og implementer det
  ene.
- Skjermleser (R25): karaoke-teksten skal være ekte DOM-tekst, ikke et dekorativt
  lag. For en video- og lydførst modal er dette forskjellen mellom null og noe
  informasjon for VoiceOver.
- Tekst-tempo: auto-advance er bundet til **spor**-slutt, ikke lese-slutt. Mål på
  reelle spor om karaoke-tempoet er ≤ sporlengden for alle segmenter. Er det ikke
  det, kan en stille leser miste tekst ved kort video og lang tekst — og da er R7s
  premiss («brukbar med lyden av») ikke innfridd.

**Patterns to follow:**
- `karaoke-tokens.ts` for hvordan tekst deles i tokens mot timings.
- Eksisterende tester i `KaraokeTeleprompter.test.tsx` og `karaoke-tokens.test.ts`.

**Test scenarios:**
- Happy path: karaoke-tekst er i DOM som lesbar tekst, ikke bare visuelle tokens.
- Happy path: `prefers-reduced-motion: reduce` → dempet oppførsel er aktiv og
  observerbar.
- Edge case: langt karaoke-manus mot kort spor → teksten er fullt lesbar før
  auto-advance, eller avanseringen utsettes.
- Edge case: spor uten `timings` → teksten vises statisk og fullstendig, ikke
  animert bit for bit.
- Integration: med lyd av og reduced-motion på er hele fortellingen fortsatt
  tilgjengelig.
- Edge case: skjermleser leser kategorilabel og karaoke-tekst i meningsfull
  rekkefølge.

**Verification:**
- Karaoke-teksten er eksponert for skjermleser.
- `prefers-reduced-motion` har en observerbar, definert effekt.
- Tekst-tempo-forholdet er målt på reelle spor og dokumentert.

## System-Wide Impact

- **Interaction graph:** `decideTrackEndedAction()`, `StoryProgressBar`,
  `use-audio-element` og `reels-state` deles med desktop. Hver endring i dem må
  verifiseres mot `DesktopStorySidebar`.
- **Error propagation:** Feiltilstanden gjenbruker `phase === "error"` fra
  splash-flyten. Alle feilveier lander på nabolagsflaten (R13), aldri på fullskjerm
  kart eller en fastlåst modal.
- **State lifecycle risks:** `trackIndex` som står igjen på siste audio-spor ved
  ikke-audio-kort er en dokumentert kilde til disembodied VO. Berører Unit 4 og
  Unit 6. Advance-timerens `visibilitychange`-kansellering og `stateRef`-guard må
  overleve Unit 1s opprydding.
- **API surface parity:** Desktop beholder transport og progresjon. Mobil mister
  dem. Divergensen er bevisst (se origin: Scope Boundaries), men betyr at
  delte komponenter nå har to kallesteder med ulike krav.
- **Integration coverage:** Lock-bug-testen i Unit 3 må kjøre mot **alle sju**
  korttyper. Enhetstester på reduceren beviser ikke at ✕ er tappbar i en gitt
  render.
- **Unchanged invariants:** `gmp-map-3d` unmountes aldri, og
  pointer-events-skjoldet beholdes selv når overlegget dekker kartet.
  `DesktopStorySidebar` er funksjonelt uendret. Karaoke-teksten beholdes — det er
  kartkortet som fjernes, ikke tekstlaget.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Å fjerne `ReelsTransport` gjeninnfører lock-bug-klassen | Unit 3 flytter garantien eksplisitt til ✕, med en integrasjonstest per korttype. Dette er planens viktigste test. |
| Advance-timerens guards forsvinner i oppryddingen | Unit 1 har eksplisitte tester for `visibilitychange`-kansellering og fire-time-guarden. Begge er dokumentert som de dyreste bugene i modellen. |
| `welcome`/`home`/`outro` blir tomme når kartet fjernes | Unit 2 verifiserer fallback på **begge** testboards. `byggetrinn-4` har ingen montage-video. |
| Endringer i `decideTrackEndedAction()` treffer desktop | Hver unit som rører den har en desktop-uendret-test. |
| Disembodied VO ved sluttilstand eller pause på ikke-audio-kort | Unit 4 og Unit 6 har eksplisitte error-path-tester for dette dokumenterte problemet. |
| Karaoke-tempo overskrider sporlengden → stille lesere mister tekst | Unit 7 måler på reelle spor. Er premisset brutt, er det et funn som må rapporteres, ikke skjules. |
| Sletting av `NowPlayingCard`/`ReelsMenu`/`ReelsTransport` brekker desktop | Ingen sletting før desktop-stien er sporet. Fjerning fra mobilsti først, sletting eventuelt senere. |

## Documentation / Operational Notes

- Unit 7s måling av karaoke-tempo mot sporlengde bør dokumenteres i
  `docs/solutions/` hvis den avdekker et systematisk misforhold — det ville påvirke
  manus-produksjonen, ikke bare denne flaten.
- Etter plan B bør
  `docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md`
  oppdateres eller etterfølges: to-flate-modellen den beskriver er ikke lenger
  mobilens modell. Doccens lærdommer om WebGL, skjold og timer-guards gjelder
  fortsatt og må bæres videre, ikke arkiveres.
- Arbeidet skjer i samme worktree som plan A (`../placy-story`,
  `feat/story-opt-in`).

## Sources & References

- **Origin document:** [docs/brainstorms/2026-08-06-story-som-ortogonalt-tillegg-requirements.md](docs/brainstorms/2026-08-06-story-som-ortogonalt-tillegg-requirements.md)
- **Plan A (flate-separasjon):** `docs/plans/2026-08-06-001-feat-story-flate-separasjon-plan-A.md`
- Institusjonelt: `docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md`
- Institusjonelt: `docs/solutions/performance-issues/webgl-context-leak-per-render-probe-20260603.md`
- Institusjonelt: `docs/solutions/ui-bugs/google-maps-3d-webgl-context-crash-touch-devices-20260415.md`
- Forrige runde på samme flate: `docs/brainstorms/2026-08-03-mobil-nabolagsflate-requirements.md`
- [3D Maps — Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/reference/3d-map)
