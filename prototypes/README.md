# Placy prototype-miljø

Vanilla HTML/CSS/JS-prototyper for å iterere på nivå-1-boardet på minutter i
stedet for timer. Ingen Next, ingen build-steg, ingen worktrees — lagre fil, se
resultat på telefon og desktop samtidig.

## Kom i gang

```bash
npm run proto          # server på :4400 med live-reload + LAN-URL for mobil
```

Åpne URL-en som printes på telefonen (samme wifi). Alle åpne faner laster
automatisk på nytt når en fil lagres. Repoets `public/` serveres som fallback,
så de ekte kategori-illustrasjonene vises.

## Nivå 1 = board uten lyd

Nivå-skillet er **avspillbar lyd**, ikke redaksjonelt innhold. Det er den
forgreiningen produksjonen faktisk gjør: `isPlayableAudio` (krever både `url`
og ikke-tom `manus`) → `hasPlayableContent` på desktop, `hasAudioMobile` på
mobil. Har boardet lyd, vises spiller-flaten; har det ikke lyd, vises
kategori-oversikten — og det er nivå-1-flaten vi itererer på.

**Kuratert vs. ukuratert er en uavhengig akse.** Et nivå-1-board kan godt ha
kuratert strøkstekst. Samme UI, ulik datarikdom. Snapshot-scriptet skriver
nivået i `meta.tier` så det ikke er tvil.

## Ekte board-data

```bash
npm run proto:data -- megler-harstad strindfjordvegen-10-7053-ranheim-norge
npm run proto:data -- klp-eiendom ferjemannsveien-10
```

Snapshotet lander i `_data/` (gitignored) og inneholder tre ting:

| Nøkkel | Hva |
|--------|-----|
| `meta` | `tier` (1/2), `hasPlayableAudio`, `audioThemes` |
| `board` | Den **avledede** modellen — samme `transformToReportData` → `adaptBoardData` boardet selv rendrer |
| `project` | Rå `Project` fra v2-lesestien, inkludert `reportConfig` |

Bruk `board` når du gjenskaper dagens flate. Den deterministiske
minimum-garantien (generert kategoritekst, highlights, FAQ) oppstår
**nedstrøms** av `products.config` — leser du rå config, ser et ukuratert
nivå-1-board tomt ut selv om boardet faktisk viser tekst.

## Prototypene

| # | Hva | Spørsmål |
|---|-----|----------|
| `00-niva1-baseline` | **Baseline** — dagens nivå-1-board, gjenskapt | Ingen. Den er målestokken. |
| `01-fortelling-scroll` | Kandidat-retning | Kan boardet leses som én fortelling der kartet bare følger med? |
| `02-en-stemme-to-formater` | Mobil-kortets innhold | Desktop selger stedet, mobil viser avstander. Skal mobil-kortet ha stemmen, tallene, eller begge? |
| `03-svar-forst` | Hierarki | Hun har alt valgt stedet. Hva om boardet svarer først og indeksen ligger bak ett trykk? |
| `04-fortelling-i-boardet` | Presentasjon vs. utforsking | Kan meglerens utvalg presenteres som en guidet rekkefølge inne i sheeten — uten lyd, uten bilder, og uten at ett kartpunkt må trykkes? |

`04` har to grep som er verdt å ta med videre uansett hva dommen blir: sheeten
har **én hvilestilling gjennom hele omvisningen** (innholdet scroller, vinduet
står av seg selv — en flate som vokser av hvert trykk er en følge brukeren ikke
ba om, mens en du drar eller slår sammen er en du styrer), og **ingenting lukker
seg selv** (åpner du to steder, står begge åpne til du lukker dem). Transporten
ligger i et fast dekk utenfor sheeten, så den ikke flytter seg med innholdet —
og sammenslått legger handlen seg over dekket, ikke bak det.

Alle har en **← Prototyper**-chip øverst til venstre tilbake til galleriet.
Den injiseres av `Proto.mountBackLink()` i `_shared/proto.js` og kommer gratis
på hver ny prototype så lenge fila lastes — også de som ikke bruker baselinen.
Trenger prototypen eget verktøy samme sted, bruk `--proto-back-w` (chippens
målte bredde) til å legge deg ved siden av, slik `02` gjør.

Alle har også en veksler øverst til høyre mellom **Kuratert** (Ranheim) og
**Ukuratert** (Ferjemannsveien) — samme UI, to nivåer av datarikdom. `02` har i
tillegg en variant-veksler øverst til venstre: **Tall** (= baselinen) /
**Stemme** / **Begge**, og `04` har **Tett** / **Fortelling** pluss **Megler** /
**Nærmest** — den siste bytter bare ut hvem som plukket de tre stedene i hvert
stopp, så forskjellen mellom en åpen og en ferdig kuratert versjon kan kjennes
på samme board.

## Iterasjoner overstyrer, de kopierer ikke

Baselinen er felles kilde. En iterasjon overstyrer bare det den faktisk tester,
så en endring i produksjonsflaten forplanter seg til alle prototyper i stedet
for å råtne i hver sin kopi:

```js
Baseline.override({
  mobileCard(cat, list) { ... },   // mobil-kortet
  desktopCard(cat) { ... },        // desktop-kortet
  sheetTop() { ... },              // før kategori-lista på mobil
  sidebarTop() { ... },            // før kategori-lista på desktop
  onClick(target, ev) { ... },     // true = iterasjonen håndterte trykket
  marker(poi, cat) { ... },        // { dim, label, hidden, className }, null = baselinen
  sheetTitle() { ... },            // teksten i mobil-sheetens grab-handle
});
Baseline.start(BOARD, opts);       // ALLTID etter override
```

`marker` finnes fordi labels settes i JS: en iterasjon kan ikke navngi utvalgte
punkter fra CSS. Trenger du et tredje nivå mellom «dempet» og «ikke dempet»,
returner en `className` og styl den selv — det er slik `04` skiller de tre
navngitte stedene fra kategorien rundt og fra resten av nabolaget.

`Baseline.util` gir byggeklossene baselinen selv bruker — `esc`, `icon`,
`minutesOf`, `categorySubline`, `buildList`, `linkedText`, `byMinutesThenName`,
`openPoi`, `selectCategory`, `showAll`, `fitCategory`, `rerender()`,
`redrawMarkers()`, `state()`. `Baseline.baseMobileCard` / `baseDesktopCard` lar
en override delegere tilbake til baselinen (slik `03` gjør når indeksen åpnes).

**Markør-gotcha:** Mapbox GL skriver `opacity` og `pointer-events` **inline** på
markør-roten hver frame. En regel på `.marker` taper mot den — demping må ligge
på barna (`.marker.dim .pin`), og skal pinnene gjøres inerte, kreves
`pointer-events: none !important` fordi klikk-lytteren sitter på roten.

Trenger iterasjonen å rive opp mer enn dette, er `cp -r 00-niva1-baseline`
fortsatt riktig — men da er det en ny flate, ikke en iterasjon.

## Baselinen er trofast, og hvor den ikke er det står det

`00-niva1-baseline` er portert fra `DesktopStorySidebar.tsx`,
`NeighbourhoodSheet.tsx`, `NeighbourhoodCategoryCard.tsx`, `CategoryPage.tsx`,
`FAQSection.tsx` og `HighlightsDisclosure.tsx`. Mål, farger, easing og tekster
er hentet derfra, ikke gjenoppfunnet — CSS-kommentarene navngir Tailwind-klassen
hver regel kommer fra.

**Desktop og mobil er bevisst ulike flater.** Det er ikke drift:

| | Desktop | Mobil |
|---|---------|-------|
| Skall | 438 px sidekolonne, `#f2e9dc` | Sheet fra 0.34 til 0.86 av rammen (gulv 236 px), `#f5f1ea` |
| Kategorikort | Illustrasjon + kuratert lead-prosa | Ikon-tint + dekningstall + 3 POI-rader + «Se alle N» |
| Indeks-lista | Alle kategorier | **Utsnitts-scopet** — å dra kartet ER filteret |
| Drill-in | Samme kolonne, **kun det som er i utsnittet** | Eget panel (58 % av rammen), **hele kategorien** |
| POI-trykk | Mini-popup ved markøren | Modalen ER POI-flaten (ingen mini-popup) |

Avvik fra produksjon er merket `AVVIK` i koden. Prototype-veksleren øverst til
høyre finnes ikke i produksjon.

**Scroll-posisjon overlever en render.** `render()` bygger `#app` på nytt, og
uten hjelp hopper de rullbare flatene til topps hver gang noe rendrer — og
kartet rendrer på hver `moveend`, altså midt i lesingen. Baselinen tar vare på
`scrollTop` i `.catpage-scroll` og sidekolonnens `.scroll` over renderen. For
sheeten er posisjonen ikke bare lesestedet — den ER høyden — så den huskes i
`state().sheetScroll` og settes av `sizeMobileSurface` sammen med høydene den
hører til. Det er en portingskostnad React ikke har, ikke en oppførsel fra
produksjonen.

## Mobil-sheeten: ett tall, én eier

Sheeten er **én scroller med en gjennomsiktig spacer over kroppen**:

```
.sheet-outer   scroller, høy som taket (0.86 av rammen), pointer-events: none
  .sheet-spacer  gjennomsiktig, høy som veien fra sammenslått til taket
  .sheet         kroppen — bakgrunn, radius, skygge, pointer-events: auto
                 min-høyde = taket, uansett hvor lite innhold
    .grab          position: sticky, top: 0 — sheetens overkant, og ALT som er
                   synlig når flaten er slått sammen (derfor står tittelen i den)
    .sheet-body    innholdet (IKKE en scroller)
```

Fingeren flytter **ett tall**: `scrollTop`. Under spacerens høyde er det
sheetens høyde, over den er det innholdet som går under headeren. Derfor finnes
det ingen overlevering mellom «dra sheeten» og «scroll i lista» — veien opp og
veien tilbake er samme bevegelse, og ingenting kan ryke midt i en gest. Taket er
scrollerens egen overkant, så kroppen kan ikke komme over det uansett innhold.

**Tre stopp** på det samme tallet: sammenslått (`0` — bare handlen, kartet får
nesten hele skjermen), hvilestillingen, og taket. Mellomstillinger beholdes;
magneten (`SNAP_THRESHOLD_PX`) trekker bare når bevegelsen faktisk ville stanset
nær et stopp. Hvor den stanser regnes ut, ikke gjettes: farten faller
eksponentielt, så veien som er igjen er `v / -ln(SHEET_DECAY)` ≈ 500 · v.

Kroppens min-høyde er **taket**, ikke innholdet. Det er reiseveiens garanti: et
board med ett kort (04) har ingenting å scrolle, og uten det gulvet blir taket
uoppnåelig. Det stenger samtidig høyde-tyveriet — et kart i bevegelse krymper
lista, og med innholdet som gulv forsvinner scroll-området under flaten.

**Vi driver scrollen selv** (`wireSheetSurface` + `wireSheetWindow`), med
`touch-action: none` på scrolleren. Ikke av smak: har iOS først bestemt at
strøket er en scroll, slutter den å sende `pointermove` til fingeren slippes.
Da kan ikke lista gi bevegelsen tilbake til kroppen i samme strøk — og det er
nettopp veien tilbake som skal føles sammenhengende. Farten etter slipp er
derfor vår: `SHEET_DECAY = 0.998` er iOS' egen bremsefaktor per millisekund.
Hjulet på desktop går ikke via `touch-action` og scroller nativt som før.

Tre ting som ser ut som detaljer og ikke er det:

- **`pointer-events: none` på scrolleren.** Den dekker hele takområdet; uten
  dette treffer et trykk over sheeten scrolleren i stedet for kartet. Kroppen
  er `auto`, så gesten når oss likevel (events bobler uansett `pointer-events`).
- **Klikk-låsen er vår.** Har vi hindret nettleserens egen scroll, kommer
  clicket likevel når fingeren løftes — og fordi touch har implisitt pointer
  capture havner det på raden fingeren lå **på**, ikke der den slapp. Én
  capture-lytter på scrolleren spiser det, og den ligger med vilje i
  capture-fasen: `wire()` legger all trykk-håndtering på `#app`, som er
  *forelder* til sheeten.
- **`-webkit-user-select: none` på kroppen.** Uten den spiser Safaris
  tekstmarkering trykket når fingeren lander presis på teksten i en rad.

En iterasjon som vil gi sheeten sin egen hvilestilling setter
`state().sheetRestH` og kaller `Baseline.util.sizeSheet()`. `sheetVisibleH()`
leser høyden sheeten står i nå — bruk den, ikke `offsetHeight`, når kameraet
skal padde for flaten. Ligger noe fast i rammens underkant (04 har et dekk der),
sett `state().sheetFloorInset`: sammenslått skal handlen stå **over** det, ikke
bak det.

Står flaten i hvilestillingen og hvilestillingen flytter seg, følger den med —
04 måler sitt eget vindu etter første render. Det styres av flagget
`state().sheetAtRest`, ikke av en pikselsammenligning: scroll-hendelser kommer
asynkront, så `sheetScroll` kan ligge på forrige verdi i det en render treffer,
og da flyttet flaten seg av seg selv.

`.catpage` (drill-in-panelet) har fortsatt fast høyde og nativ scroll. Den er
ikke en del av gesten.

## Lage en ny iterasjon

1. `cp -r 00-niva1-baseline 02-min-ide` — start fra baselinen, ikke fra blankt ark
2. Legg til én linje i `PROTOTYPES`-lista i `index.html`
3. Skriv spørsmålet prototypen skal besvare øverst i fila

## Regler

- **Ett spørsmål per prototype.** Den skal kunne kjennes på under et minutt.
- **Vanilla only.** CDN-bibliotek er lov (Mapbox GL, lucide), rammeverk er ikke.
- **Ekte data.** Bruk snapshots, ikke lorem ipsum — tekstmengde og POI-tetthet
  ER det som testes.
- **Ingen gesture skal være eneste vei til noe.** Sheet-handlen kan både dras og
  trykkes; det er regelen fra produksjonen og den gjelder her.
- **Dommen skrives i `PROJECT-LOG.md`** når en retning avgjøres. Prototypen
  slettes ikke, den ligger i git.

## Filer

| Fil | Hva |
|-----|-----|
| `index.html` | Galleri — lista over alle prototyper |
| `_shared/tokens.css` | Lette tokens for frie prototyper (ikke baselinen) |
| `_shared/baseline.css` | Baselinens stilark, portert fra produksjonsklassene |
| `_shared/baseline.js` | Baselinens logikk — begge flatene |
| `_shared/proto.js` | `loadBoard()` m.m. |
| `_shared/env.js` | Autogenerert av `npm run proto` (gitignored) |
| `_data/*.json` | Board-snapshots (gitignored) |
| `scripts/proto-serve.mjs` | Dev-serveren (repo-roten) |
| `scripts/export-proto-snapshot.ts` | Snapshot-eksporten (repo-roten) |
