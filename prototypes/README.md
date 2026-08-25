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

Alle har en **← Prototyper**-chip øverst til venstre tilbake til galleriet.
Den injiseres av `Proto.mountBackLink()` i `_shared/proto.js` og kommer gratis
på hver ny prototype så lenge fila lastes — også de som ikke bruker baselinen.
Trenger prototypen eget verktøy samme sted, bruk `--proto-back-w` (chippens
målte bredde) til å legge deg ved siden av, slik `02` gjør.

Alle har også en veksler øverst til høyre mellom **Kuratert** (Ranheim) og
**Ukuratert** (Ferjemannsveien) — samme UI, to nivåer av datarikdom. `02` har i
tillegg en variant-veksler øverst til venstre: **Tall** (= baselinen) /
**Stemme** / **Begge**.

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
});
Baseline.start(BOARD, opts);       // ALLTID etter override
```

`Baseline.util` gir byggeklossene baselinen selv bruker — `esc`, `icon`,
`minutesOf`, `categorySubline`, `buildList`, `linkedText`, `byMinutesThenName`,
`openPoi`, `selectCategory`, `fitCategory`, `rerender()`, `state()`.
`Baseline.baseMobileCard` / `baseDesktopCard` lar en override delegere tilbake
til baselinen (slik `03` gjør når indeksen åpnes).

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
| Skall | 438 px sidekolonne, `#f2e9dc` | Fri-drag sheet 0.34–0.86 av rammen (gulv 236 px), `#f5f1ea` |
| Kategorikort | Illustrasjon + kuratert lead-prosa | Ikon-tint + dekningstall + 3 POI-rader + «Se alle N» |
| Indeks-lista | Alle kategorier | **Utsnitts-scopet** — å dra kartet ER filteret |
| Drill-in | Samme kolonne, **kun det som er i utsnittet** | Eget panel (58 % av rammen), **hele kategorien** |
| POI-trykk | Mini-popup ved markøren | Modalen ER POI-flaten (ingen mini-popup) |

Avvik fra produksjon er merket `AVVIK` i koden. Prototype-veksleren øverst til
høyre finnes ikke i produksjon.

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
