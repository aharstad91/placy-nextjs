---
title: "feat: Story-flate-separasjon (plan A) — nabolagsflaten blir mobil-standard"
type: feat
status: active
date: 2026-08-06
origin: docs/brainstorms/2026-08-06-story-som-ortogonalt-tillegg-requirements.md
---

# feat: Story-flate-separasjon (plan A) — nabolagsflaten blir mobil-standard

## Overview

Mobilflaten i rapport-boardet er i dag forket av VO-tilstedeværelse: har boardet
lyd får du story-flaten, mangler den får du nabolagsflaten. Plan A fjerner forken
og gjør nabolagsflaten til den underliggende flaten på alle boards, med storyen
som et overlegg åpnet av én affordans. Plan B (`…-002-…-plan-B.md`) strammer
innholdet i selve story-flaten.

Denne planen eier **monteringen, bryteren og inngangen**. Den eier ikke hva som
står inne i story-flaten.

## Problem Frame

`components/variants/report/reels/ReportReelsPage.tsx` avleder flatevalg fra en
datategenskap i stedet for fra produktpakking:

```
hasAudioMobile       = firstIdx !== -1
mapIsSurface         = state.mapOpen || !hasAudioMobile
neighbourhoodSurface = !hasAudioMobile && boardRevealed
```

Konsekvensen er at storyen *erstatter* nabolagsflaten i stedet for å legge seg på
den, og derfor ikke kan selges som tillegg — heller ikke på et
`reportTier: 1`-board, som er der volumet ligger. `lib/types.ts:450-452` fastslår
at VO er en ortogonal akse som ikke gater på tier; koden motsier sin egen
deklarasjon (se origin: `docs/brainstorms/2026-08-06-story-som-ortogonalt-tillegg-requirements.md`).

## Requirements Trace

- R1. Nabolagsflaten monteres som underliggende mobilflate på alle boards, uten
  betingelse på VO. Story-flaten er et overlegg som aldri erstatter monteringen.
- R2. Én inngang: spill-av-affordans i trailing kant av sheet-headeren, med ikon
  **og** tekst med varighet. Må ikke forstyrre `onSurfaceHeightChange`-målingen.
- R3. Uten spillbar VO: ingen affordans, flaten observerbart identisk med
  `feat/mobil-nabolagsflate` ved `916a601`.
- R4. Én mobil-kodesti for flatevalg.
- R10. Story-flaten skal ikke krasje eller utløse reload på fysisk iPhone med
  `gmp-map-3d` montert under. `filmMode` er avkreftet som mekanisme.
- R11. `storyAutoplay` som ortogonalt flagg, default `false`.
- R12. `?play=1` i flagg-kontrakten, mater samme switch som `storyAutoplay`.
- R13. Lukk, feiltilstand og sekvens-slutt lander alle på nabolagsflaten.
- R14. `stasjonskvartalet` settes `storyAutoplay: true` — synlig ankomst uendret.
- R15. De to endringene StasjonsKvartalet får er forbedringer, verifisert som det.
- R16. Ingen merge til `main` før R14/R15 er verifisert på fysisk iPhone.
- R28. Hintet (`neighbourhood-hint`) og spill-av-affordansen konkurrerer ikke ved
  ankomst.

## Scope Boundaries

- Desktop er urørt. `ReportReelsPage.tsx:729` returnerer separat render for
  `isDesktop` med `DesktopStorySidebar`.
- Ingen endring i provisjonerings-pipelinen eller `lib/pipeline/`.
- Ingen endring i audio-tour-generering.
- Ingen nye medie-produksjoner.

### Deferred to Separate Tasks

- **Innholdet i story-flaten** (chrome-budsjett, gester, tilstander, a11y,
  `welcome`/`home`/`outro`-bakgrunn): plan B, `2026-08-06-002-feat-story-frame-plan-B.md`.
- **Kategorispiller**: egen runde etter plan B.
- **Per-strøk VO-amortisering**: eget spor.
- **Wesselsløkkas innholdshull**: ikke her.

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/reels/ReportReelsPage.tsx` — forken, peek-geometrien,
  `ReelsAudioShell` med advance-timer og guards.
- `components/variants/report/board/neighbourhood/NeighbourhoodSurface.tsx` —
  nabolagsflaten. Låser dokument-scroll ved mount, rapporterer okklusjonshøyde
  via `onSurfaceHeightChange`, viser engangs-hintet.
- `components/variants/report/board/neighbourhood/NeighbourhoodSheet.tsx` — sheeten
  som eier headeren affordansen skal inn i.
- `components/variants/report/board/board-url-flags.ts` — flagg-kontrakten
  (`?film=1`, `?fly=1`, `?establishing=1`, `?author=1`). `?play=1` føyer seg inn her.
- `components/variants/report/reels/reels-state.tsx` — `mapOpen`, `teaserArmed`,
  `defaultMapOpenForCard`, `UNLOCK_AUDIO`/`audioUnlocked`.
- `lib/types.ts` — `reportTier` i reportConfig, `has3dAddon` på prosjektnivå.

### Institutional Learnings

- `docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md`
  — **må leses før arbeid starter.** Dokumenterer hvorfor to-flate-modellen ser ut
  som den gjør. Tre lærdommer som binder denne planen:
  1. `gmp-map-3d` kan ikke gjøres ikke-interaktiv via `GestureHandling` (ingen
     `NONE`). Eneste beskyttelse er et gjennomsiktig pointer-events-skjold over
     kartlaget. Story-flaten som overlegg må ikke svekke det skjoldet.
  2. Én persistent kart-instans, avslørt i ulik geometri via en `mapStyle`-ternær.
     Aldri en nr. 2 — det ville lekke WebGL-kontekst.
  3. `defaultMapOpenForCard` + reset per beat var fiksen for en **lock-bug-klasse**
     («exit-affordanser flate-koblet, ikke beat-koblet»). Plan B fjerner
     `ReelsTransport` fra mobil; garantien må da flyttes eksplisitt til ✕.
- `docs/solutions/ui-bugs/google-maps-3d-webgl-context-crash-touch-devices-20260415.md`
  — iOS WebKit tåler **kun én aktiv WebGL-kontekst per side**. Story-flaten bruker
  video og bilder, ikke WebGL, så overlegget legger ikke til en kontekst. Men
  regelen gjelder: ingen andre WebGL-flater kan monteres samtidig.
- `docs/solutions/performance-issues/webgl-context-leak-per-render-probe-20260603.md`
  — kontekst-lekkasjen er **allerede fikset** (`useWebGLCheck` cacher og frigjør
  proben). Etter fiks: 3 unike kontekster, flatt, gjennom 23s avspilling med full
  kamerabevegelse. Konsekvens for R10: risikoen er **minne**, ikke kontekst-antall.
  Doccen inneholder også måleharnessen vi skal gjenbruke (`WeakSet` over
  `HTMLCanvasElement.prototype.getContext` via `initScript`), og advarselen om at
  GPU-prosessen forurenser målinger på tvers av tab-lukking — mål i frisk browser.

### External References

- [3D Maps — Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/reference/3d-map)
  — `Map3DElement`; «mode må settes for at 3D-kartet skal begynne å rendre», som er
  den eneste dokumenterte render-bryteren og derfor kandidat i Unit 1.
- [Maps JavaScript API Release Notes](https://developers.google.cn/maps/documentation/javascript/releases)
  — nevner (a) fiks for minnelekkasje når `Map3DElement` legges til/fjernes
  dynamisk fra DOM, og (b) forbedret minnehåndtering for Map 3D mot OOM på iOS.
  **Uverifisert for vår versjon.** Hvis (a) holder, kan «aldri unmount»-regelen i
  praksis være foreldet — det er en av tre hypoteser Unit 1 tester.

## Key Technical Decisions

- **Storyen er et ortogonalt tillegg, ikke «nivå 2».** `lib/types.ts:450-452`
  fastslår at VO ikke gater på `reportTier`. Tier-framingen ville låst mersalget
  til boards med kuratert editorial (se origin).
- **`storyAutoplay` og `?play=1` mater samme switch.** Én bryter, to innganger,
  ingen fork. Bevarer StasjonsKvartalets ankomst uten et legacy-spor.
- **R10 måles før noe bygges.** Dagens `stasjonskvartalet` har allerede story +
  persistent 3D-kart samtidig på mobil. Taket er derfor målbart på eksisterende
  kode, uten kodeendring — og hvis det ikke holder, endrer det designet før vi har
  investert i det.
- **Nabolagsflaten monteres alltid, også under et autoplay-overlegg.** Alternativet
  (hopp over montering når autoplay er på) ville gjeninnført to kodestier og
  brutt R4.

## Open Questions

### Resolved During Planning

- **Er `filmMode` render-stopp?** Nei. Konsumeres kun av
  `use-board-marker-set.ts:146` (tom markørliste) og `BoardMap3D.tsx:232,256`
  (reveal-kaskade). Markørsynlighet, ikke rendering.
- **Er WebGL-kontekst-antall risikoen i R10?** Nei — lekkasjen er fikset og målt
  flat på 3. Risikoen er minnetrykk fra videodekoding + lyd + tiles.
- **Hvor legges `?play=1`?** I den eksisterende kontrakten i
  `board-url-flags.ts`, som allerede bærer fire flagg med samme lesemønster.

### Deferred to Implementation

- **Hvor `storyAutoplay` hører hjemme i datamodellen.** `reportTier` ligger i
  reportConfig, `has3dAddon` på prosjektnivå. Avgjøres når Unit 2 leser hvordan
  `has3dAddon` faktisk tråes gjennom `lib/supabase/v2-queries.ts` — inkludert om
  config er JSONB og migrasjon dermed er unødvendig.
- **Om `mapOpen`-undermaskinen skal slettes eller beholdes for desktop.** Krever at
  Unit 3 ser hva som faktisk blir uåpnelig på mobil. Selve oppryddingen ligger i
  plan B Unit 1, som eier fjerningen av peek-CTA-en.
- **Om sheet-headeren har fysisk plass** til ikon + tekst + varighet ved siden av
  «Nabolaget» på de smaleste enhetene. Måles i Unit 5.

## High-Level Technical Design

> *Dette illustrerer den tiltenkte tilnærmingen og er retningsgivende for
> gjennomgang, ikke en implementasjonsspesifikasjon. Den implementerende agenten
> skal behandle det som kontekst, ikke kode å reprodusere.*

Bryteren har tre innganger og én utgang. Poenget er at ingen av inngangene
oppretter en egen kodesti:

```
storyAutoplay (board-flagg)  ┐
?play=1       (URL-flagg)    ├─→  storyOpen: boolean  ─→  <StoryOverlay/>
[▶]           (bruker-tapp)  ┘         │
                                       └─ lukk / feil / slutt → false → nabolagsflaten

Nabolagsflaten er montert uansett verdi på storyOpen.
```

Dagens tilstand mot ønsket tilstand:

| | I dag | Etter plan A |
|---|---|---|
| Board med VO, mobil | story-flate; nabolagsflate finnes ikke | nabolagsflate montert; story som overlegg |
| Board uten VO, mobil | nabolagsflate; story finnes ikke | uendret, og ingen affordans |
| `stasjonskvartalet` | story ved ankomst | story ved ankomst (autoplay), nabolagsflate under |
| Flatevalg avledet av | `hasAudioMobile` | ingenting — begge er alltid der |

## Implementation Units

- [ ] **Unit 1: Mål minnetaket på dagens StasjonsKvartalet (ingen kodeendring)**

**Goal:** Fastslå om story + persistent `gmp-map-3d` samtidig holder på fysisk
iPhone, og om noen mekanisme kan strupe 3D-rendringen. Svaret avgjør om R10 blir
et tiltak eller en dokumentert måling — og det er billigst å få nå, før noe er
bygd, fordi dagens board allerede er i nettopp den tilstanden.

**Requirements:** R10

**Dependencies:** Ingen. Kjøres på `feat/mobil-nabolagsflate` som den står.

**Files:**
- Create: `docs/solutions/performance-issues/story-3d-minnetak-maaling-20260806.md`
  (funnene, uansett utfall — dette er institusjonell kunnskap)
- Modify: ingen produksjonsfiler i denne uniten

**Approach:**
- Mål på fysisk iPhone i Chrome, inkognito, én fane, **frisk browser-start** —
  GPU-prosessen cacher WebGL-kontekster på tvers av tab-lukking og forurenser
  ellers målingen (dokumentert i
  `docs/solutions/performance-issues/webgl-context-leak-per-render-probe-20260603.md`).
- Gjenbruk `WeakSet`-proben over `HTMLCanvasElement.prototype.getContext` fra samme
  doc for å telle **unike** canvas, ikke `getContext`-kall.
- Kjør StasjonsKvartalets fulle sekvens gjennom til megler-kortet. Logg unike
  kontekster, og om siden reloader eller krasjer.
- Test tre kandidat-mekanismer for å strupe 3D, i økende risiko:
  1. `mode`-egenskapen på `Map3DElement` — dokumentert som det som *starter*
     rendringen, altså eneste dokumenterte bryter.
  2. `visibility: hidden` / `display: none` på kart-containeren — kan la
     nettleseren droppe compositing, men Googles renderer kan holde sin egen
     rAF-løkke gående uansett.
  3. Om upstream-fiksen for add/remove-minnelekkasje betyr at unmount nå er
     trygt. Denne er den mest verdifulle hvis den holder, fordi den ville
     pensjonert «aldri unmount»-regelen — og den farligste å tro på uten bevis.
- Konkluder eksplisitt. «Ingen mekanisme funnet» er et gyldig og nyttig resultat.

**Execution note:** Dette er en måle-unit, ikke en bygge-unit. Ingen produksjonskode
skal endres. Hvis en mekanisme viser seg å virke, hører implementeringen i plan B.

**Patterns to follow:**
- Måleharness og red herrings: `docs/solutions/performance-issues/webgl-context-leak-per-render-probe-20260603.md`
- iOS-ensidig WebGL-kontekstregel: `docs/solutions/ui-bugs/google-maps-3d-webgl-context-crash-touch-devices-20260415.md`

**Test scenarios:**
- Test expectation: none — måle-unit uten atferdsendring. Leveransen er
  løsningsdokumentet med tall og konklusjon.

**Verification:**
- Dokumentet finnes, navngir enhet og iOS-versjon, og oppgir unike
  WebGL-kontekster over full sekvens.
- Hver av de tre kandidat-mekanismene har en eksplisitt dom: virker / virker ikke
  / utestet og hvorfor.
- R10 i origin-dokumentet er oppdatert fra åpent spørsmål til konklusjon.

---

- [ ] **Unit 2: `storyAutoplay`-flagget og `?play=1` — bryteren uten UI**

**Goal:** Én boolean som avgjør om story-flaten er åpen, med tre innganger som
alle skriver til samme sted. Ingen visuell endring i denne uniten.

**Requirements:** R11, R12

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/board/board-url-flags.ts`
- Modify: `lib/types.ts`
- Modify: `lib/supabase/v2-queries.ts` (kun hvis flagget må tråes gjennom lesestien)
- Test: `components/variants/report/board/board-url-flags.test.ts`

**Approach:**
- `?play=1` føyes inn i den eksisterende kontrakten sammen med `film`, `fly`,
  `establishing`, `author` — samme lesemønster, samme defaults-objekt.
- `storyAutoplay` deklareres der de andre ortogonale flaggene bor. Les hvordan
  `has3dAddon` faktisk kommer fram til boardet før du velger nivå; velg det som
  ikke krever migrasjon hvis config er JSONB.
- Flagget er en **deklarasjon**, ikke en runtime-bryter i seg selv — samme rolle
  som `reportTier` beskriver for seg selv i `lib/types.ts:450-455`. Selve
  åpne-tilstanden er komponent-state som flagget seeder.

**Patterns to follow:**
- `board-url-flags.ts` — `readBoardUrlFlags` / `readBoardUrlFlagsFromWindow` og
  defaults-objektet.
- `has3dAddon` i `lib/types.ts` for hvordan et ortogonalt flagg deklareres og
  dokumenteres.

**Test scenarios:**
- Happy path: `?play=1` → `playMode: true`; ingen query → `false`.
- Happy path: `?play=1&film=1` → begge flagg satt uavhengig, ingen implikasjon
  mellom dem (til forskjell fra `?fly=1` som *impliserer* film-modus).
- Edge case: `?play=0`, `?play=true`, `?play=` → alle `false`. Kontrakten er
  strengt `=== "1"`, som de fire eksisterende flaggene.
- Edge case: flagget leses uten `window` (SSR) uten å kaste.

**Verification:**
- Flagget er lesbart både fra søkestreng og fra `window`.
- Ingen visuell endring på noe board — bryteren har ingen konsument ennå.
- Eksisterende flagg-tester er uendret og grønne.

---

- [ ] **Unit 3: Nabolagsflaten monteres ubetinget, `mapIsSurface` kollapser**

**Goal:** Fjern forken. Nabolagsflaten er den underliggende mobilflaten
uavhengig av VO.

**Requirements:** R1, R3, R4

**Dependencies:** Unit 2 (bryteren må finnes, selv uten konsument)

**Files:**
- Modify: `components/variants/report/reels/ReportReelsPage.tsx`
- Test: `components/variants/report/board/neighbourhood/NeighbourhoodSurface.test.tsx`
- Test: `components/variants/report/reels/__tests__/` (eksisterende suite for
  flatevalg — utvid, ikke erstatt)

**Approach:**
- `neighbourhoodSurface` slutter å gate på `!hasAudioMobile`. `mapIsSurface`
  reduseres til å handle om `mapOpen` alene, og `hasAudioMobile` beholdes kun der
  den faktisk betyr «finnes det lyd» (f.eks. om affordansen skal vises), aldri
  som flatevelger.
- `mapPaddingBottom` og `publishViewport` gikk før på `neighbourhoodSurface`; når
  den blir alltid sann, må det verifiseres at kartets padding og
  utsnitts-publisering fortsatt oppfører seg riktig på VO-boards som ikke har hatt
  nabolagsflate før.
- **Ikke rør peek-geometrien i denne uniten.** Den fjernes i plan B Unit 1, og å
  gjøre begge samtidig gjør regresjoner uatskillelige.

**Execution note:** Karakteriser først. Denne uniten endrer atferd på to boards
som i dag aldri har sett nabolagsflaten (`byggetrinn-4`, `stasjonskvartalet`) —
skriv dekning for dagens oppførsel før du fjerner gatingen, så det blir synlig
hva som faktisk endret seg.

**Patterns to follow:**
- `docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md`
  — særlig at det kun finnes én persistent kart-instans, avslørt i ulik geometri
  via en `mapStyle`-ternær. Ikke monter en nr. 2.

**Test scenarios:**
- Happy path: board med spillbar VO → nabolagsflaten er montert etter
  `boardRevealed`.
- Happy path: board uten VO → nabolagsflaten er montert som før, uendret.
- Integration: `onSurfaceHeightChange` rapporterer en høyde på VO-boards, og
  `mapPaddingBottom` mottar den — kartets senter kompenserer for sheeten på
  boards som ikke hadde dette før.
- Integration: kun én `gmp-map-3d` er montert gjennom hele flyten.
- Edge case: board med VO men der lydsporet ikke er spillbart
  (`isPlayableAudio` false) → behandles som uten VO, ingen affordans.
- Error path: `data.categories` tom → nabolagsflaten viser tom-tilstanden i
  stedet for å kaste.

**Verification:**
- `ReportReelsPage.tsx` inneholder ingen forgrening på `hasAudioMobile` for valg
  av mobilflate (R4).
- Alle fire testboards rendrer nabolagsflaten på mobil.
- `ferjemannsveien-10` og `cutover-pilot` er visuelt umulige å skille fra
  `916a601`.

---

- [ ] **Unit 4: Story-flaten som overlegg, med alle utganger tilbake**

**Goal:** Storyen monteres over nabolagsflaten og lander alltid tilbake på den.

**Requirements:** R13, monteringssiden av R2

**Dependencies:** Unit 3

**Files:**
- Modify: `components/variants/report/reels/ReportReelsPage.tsx`
- Test: `components/variants/report/reels/__tests__/`

**Approach:**
- Overlegget monteres over nabolagsflaten, ikke i stedet for. Nabolagsflaten
  låser dokument-scroll ved mount; overlegget må ikke låse den opp igjen ved
  unmount mens nabolagsflaten fortsatt står.
- Tre veier ut — lukk, feiltilstand, sekvens-slutt — går alle til samme
  tilstand: overlegg lukket, nabolagsflate synlig. Ingen vei ender på fullskjerm
  kart (det var dagens utgang og er en av de to forbedringene i R15).
- Pointer-events-skjoldet som beskytter mot pan/zoom på `gmp-map-3d` må fortsatt
  ligge over kartlaget når overlegget er åpent. Overlegget er tettere, men
  skjoldet er den eneste beskyttelsen og skal ikke fjernes fordi noe annet
  tilfeldigvis dekker det.

**Patterns to follow:**
- Scroll-låsen i `NeighbourhoodSurface.tsx` (lagrer og gjenoppretter
  `body.style.overflow` og `overscrollBehavior`) — samme disiplin for overlegget.
- Skjold-mønsteret i `docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md`.

**Test scenarios:**
- Happy path: bryteren settes → overlegget monteres, nabolagsflaten er fortsatt
  montert under.
- Happy path: lukk → overlegget unmountes, nabolagsflaten er synlig og
  interaktiv.
- Integration: dokument-scroll er fortsatt låst etter at overlegget er lukket, så
  lenge nabolagsflaten står.
- Integration: kategorisiden kan pushes etter at overlegget er lukket — board-state
  og kamera er ikke etterlatt i story-tilstand.
- Edge case: overlegget åpnes og lukkes to ganger på rad uten at scroll-låsen
  eller kamera-tilstanden drifter.
- Error path: overlegget lukkes mens et lydspor spiller → lyden stopper, ingen
  disembodied VO over nabolagsflaten.

**Verification:**
- Nabolagsflaten er montert i alle tilstander av bryteren.
- Ingen vei ut av storyen ender på fullskjerm kart.
- Ingen `unmount` av `gmp-map-3d` ved åpning eller lukking.

---

- [ ] **Unit 5: Spill-av-affordansen i sheet-headeren, uten å konkurrere med hintet**

**Goal:** Én synlig inngang til storyen, som forteller hva den lover, og som ikke
stjeler ankomsten fra det eksisterende kart-hintet.

**Requirements:** R2, R28, R3

**Dependencies:** Unit 4

**Files:**
- Modify: `components/variants/report/board/neighbourhood/NeighbourhoodSheet.tsx`
- Modify: `components/variants/report/board/neighbourhood/NeighbourhoodSurface.tsx`
- Test: `components/variants/report/board/neighbourhood/NeighbourhoodSheet.test.tsx`
- Test: `components/variants/report/board/neighbourhood/NeighbourhoodSurface.test.tsx`

**Approach:**
- Affordansen ligger i trailing kant av headeren, bærer ikon **og** tekst med
  varighet («Omvisning · 2 min»). Et umerket ikon er det som skjer hvis
  avgjørelsen skyves til implementering, og det er avgjort i brainstormen at det
  ikke er godt nok for en kald bruker fra en boligannonse (se origin).
- Varigheten avledes fra faktisk sporlengde, ikke hardkodes. `audioDurationSec()`
  finnes i `reels-data.ts`.
- Affordansen vises kun når spillbar VO finnes. `isPlayableAudio` /
  `pickPlayableAudio` i `board-data.ts` er den eksisterende sannheten for det.
- R28: hintet ligger i liste-body, affordansen i headeren — de er strukturelt
  atskilte alt i dag. Gjør den atskillelsen til en bevisst, testet avgjørelse i
  stedet for et sammentreff, og avgjør hvilken som eier oppmerksomheten ved
  ankomst.
- Høydemålingen (`onSurfaceHeightChange`) driver kartets bottom-padding og
  utsnitts-rektangelet. En ny rad i headeren endrer den høyden; verifiser at
  kartet fortsatt kompenserer riktig i alle hvileposisjoner.

**Patterns to follow:**
- Hintets eksisterende oppførsel i `NeighbourhoodSurface.tsx`: avvises ved første
  kart-gest, lest fra `viewportGestures`, ikke fra rektangel-diff (kommentaren der
  forklarer hvorfor — `setPadding` flytter både `south` og `north`).
- `audioDurationSec()` i `components/variants/report/reels/reels-data.ts`.

**Test scenarios:**
- Happy path: board med spillbar VO → affordansen er synlig i headeren med tekst
  og varighet.
- Happy path: tapp på affordansen → bryteren settes, overlegget åpnes.
- Happy path: board uten spillbar VO → ingen affordans i headeren.
- Edge case: VO finnes men mangler `timings` → affordansen vises fortsatt
  (spillbarhet krever url + manus, ikke timings).
- Edge case: smal viewport (360 px) → ikon, tekst og varighet får plass ved siden
  av «Nabolaget» uten å bryte layout eller kutte tekst.
- Integration: `onSurfaceHeightChange` rapporterer den nye headerhøyden, og kartets
  bottom-padding følger — boligen havner ikke bak sheeten.
- Integration: hintet og affordansen er samtidig i DOM ved ankomst uten å overlappe
  visuelt.

**Verification:**
- Affordansen er tappbar, merket, og viser reell varighet.
- Uten VO er headeren identisk med `916a601`.
- Kartets kompensasjon er riktig i alle sheet-hvileposisjoner.

---

- [ ] **Unit 6: StasjonsKvartalet-vern og enhetsverifisering**

**Goal:** Kundedemoens synlige ankomst er uendret, og det er bevist på enhet før
noe kan merges.

**Requirements:** R14, R15, R16, R10

**Dependencies:** Unit 5, og Unit 1s konklusjon

**Files:**
- Modify: `stasjonskvartalet`s board-konfigurasjon (`storyAutoplay: true`) — via
  data, ikke kode
- Modify: `docs/solutions/performance-issues/story-3d-minnetak-maaling-20260806.md`
  (etter-måling ved siden av før-målingen fra Unit 1)
- Test: `components/variants/report/reels/__tests__/` — flagg-kombinasjonene
  (`storyAutoplay` × VO-tilstedeværelse × `?play=1`) er enhetstestbare og skal ikke
  hvile på manuell enhets-verifisering alene

**Approach:**
- Sett flagget og verifiser at story-flaten åpner ved splash-fade, som i dag.
- Bekreft at nabolagsflaten er montert under hele tiden (R1) — den skal være der
  selv om brukeren aldri ser den før storyen lukkes.
- De to endringene kunden faktisk får er begge forbedringer, og skal verifiseres
  som forbedringer, ikke bare som «ikke ødelagt»: kartkortet som okkluderte
  karaoke-teksten er borte, og utgangen lander på nabolagslista i stedet for
  fullskjerm kart.
- Gjenta minnemålingen fra Unit 1 på den nye koden og sammenlign. Regresjon her er
  en merge-blokker, ikke en observasjon.

**Execution note:** Verifisering skjer på **fysisk iPhone**, Chrome, inkognito,
én fane, frisk browser-start. Devtools-emulering er ikke tilstrekkelig for denne
uniten — hele R16 finnes fordi `stasjonskvartalet` er en lenke som er sendt til
kunde, og merge til `main` deployer til produksjon.

**Test scenarios:**
- Happy path: `storyAutoplay: true` → story-flaten åpner automatisk ved
  splash-fade.
- Happy path: lukk → lander på nabolagslista, ikke fullskjerm kart.
- Integration: nabolagsflaten er montert gjennom hele autoplay-forløpet.
- Edge case: `storyAutoplay: true` på et board uten spillbar VO → ingenting åpner,
  ingen tom modal. Flagget er ikke nok alene.
- Edge case: `?play=1` på et board med `storyAutoplay: false` → åpner. De to
  inngangene er uavhengige og likeverdige.
- Error path: lydsporet feiler under autoplay → lander på nabolagsflaten (R13),
  ikke en fastlåst tom story.

**Verification:**
- StasjonsKvartalets ankomst er visuelt uendret på fysisk iPhone.
- Unike WebGL-kontekster er ikke høyere enn før-målingen.
- Ingen krasj eller reload gjennom full sekvens.
- `npm run lint` 0 errors, `npx tsc --noEmit` rent, `npm test` grønt,
  `npm run build` uten feil.

## System-Wide Impact

- **Interaction graph:** `mapIsSurface` og `hasAudioMobile` leses på flere steder i
  `ReportReelsPage.tsx` (peek-geometri, `interactive`-prop, `compactMarkers`,
  `ReelsTransport`-gating). Unit 3 rører kun flatevalget; resten tilhører plan B.
- **Error propagation:** `phase === "error"` og `resume()` finnes i splash-flyten.
  Feil i storyen skal lande på nabolagsflaten (R13), ikke bobles til en tom
  fullskjerm.
- **State lifecycle risks:** Nabolagsflaten låser dokument-scroll ved mount og
  gjenoppretter ved unmount. To flater som begge manipulerer `body.style` kan
  etterlate siden ulåst. Overlegget må ikke gjenopprette en lås nabolagsflaten
  fortsatt eier.
- **API surface parity:** Desktop (`DesktopStorySidebar`) leser samme
  `BoardData`/`ReelsCard`-modell. Endringer i kortlista eller lydvalget vil treffe
  desktop selv om denne planen ikke rører desktop-renderen.
- **Integration coverage:** Kun én `gmp-map-3d` gjennom hele flyten — bekreftes med
  integrasjonstest, ikke mock. iOS tåler én WebGL-kontekst per side.
- **Unchanged invariants:** `gmp-map-3d` unmountes aldri. Den persistente
  kart-instansen er én, avslørt i ulik geometri. Pointer-events-skjoldet er eneste
  beskyttelse mot pan/zoom under en ikke-interaktiv flate. Desktop-renderen er
  byte-uendret.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| iPhone tåler ikke story + levende 3D-kart samtidig | Unit 1 måler dette **før** noe bygges, på dagens kode. Negativt svar endrer designet mens det er gratis. |
| `stasjonskvartalet` er en levende kundelenke; merge deployer til prod | R16: ingen merge før enhetsverifisering. Unit 6 er en port, ikke en sjekkliste. |
| Nabolagsflaten på VO-boards avslører innholdshull ingen har sett før | `stasjonskvartalet` har 0 kuraterte temaer og vil vise generert tekst i lista. Ikke en blokker for plan A, men skal observeres i Unit 6 og rapporteres. |
| To flater manipulerer `body.style` → siden blir ulåst eller dobbeltlåst | Unit 4 tester lås-tilstand etter åpne/lukke-sykluser eksplisitt. |
| Advance-timerens guards mistes i refaktoreringen | `visibilitychange`-kansellering og `stateRef`-fire-time-guard er dokumentert som de to dyreste bugene i modellen. De skal ikke fjernes; plan B Unit 1 eier oppryddingen. |
| Innholdstellingene per board er uverifiserte mot Supabase | Bekreftes før testbrett-valget låses (origin: Dependencies). |

## Documentation / Operational Notes

- Unit 1 og Unit 6 leverer til
  `docs/solutions/performance-issues/story-3d-minnetak-maaling-20260806.md`. Det er
  institusjonell kunnskap uansett utfall, og erstatter gjetting neste gang noen
  vurderer å legge en tung flate over 3D-kartet.
- R10 i origin-dokumentet oppdateres fra åpent spørsmål til konklusjon når Unit 1
  er ferdig.
- Arbeidet skjer i worktree:
  `git worktree add ../placy-story -b feat/story-opt-in feat/mobil-nabolagsflate`
  — base-ref **må** være `feat/mobil-nabolagsflate` (`916a601`), ikke `main`.
  `NeighbourhoodSurface` finnes ikke på main.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-08-06-story-som-ortogonalt-tillegg-requirements.md](docs/brainstorms/2026-08-06-story-som-ortogonalt-tillegg-requirements.md)
- **Plan B (story-framen):** `docs/plans/2026-08-06-002-feat-story-frame-plan-B.md`
- Institusjonelt: `docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md`
- Institusjonelt: `docs/solutions/performance-issues/webgl-context-leak-per-render-probe-20260603.md`
- Institusjonelt: `docs/solutions/ui-bugs/google-maps-3d-webgl-context-crash-touch-devices-20260415.md`
- Forrige runde på samme flate: `docs/brainstorms/2026-08-03-mobil-nabolagsflate-requirements.md`
- [3D Maps — Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/reference/3d-map)
- [Maps JavaScript API Release Notes](https://developers.google.cn/maps/documentation/javascript/releases)
