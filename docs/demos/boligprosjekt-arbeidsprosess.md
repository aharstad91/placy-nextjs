# Arbeidsprosess: neste boligprosjekt som lokal demo

**Status:** skrevet etter Leangenbukta-rammen (U1–U4), før innholdsenhetene.
**Kode:** `lib/demo/local-board/`, `lib/live/demos.ts`, `app/demo/<id>/`.
**Format og profil:** `lib/demo/local-board/schema.ts`, `docs/demos/board-profiler.md`.
**Sist oppdatert:** 2026-09-18.

Dette er oppskriften for å sette opp et nytt boligprosjekt som lokal demo. Den bygger på to gjennomføringer: Nyhavna, som etablerte metoden, og Leangenbukta, som var den første som gjenbrukte den uten å kopiere motoren.

Én regel styrer resten: **et nytt prosjekt er data og konfigurasjon, ikke kode.** Må du endre noe i `lib/demo/local-board/`, `lib/live/` eller `lib/realtime/` for å få prosjektet ditt til å virke, har du funnet et hull i den delte kjernen — fiks hullet generelt, ikke med en sjekk på ditt eget prosjektnavn. Det er nøyaktig den feilen `lib/demo/local-board/registry.ts` finnes for å hindre, og `lib/demo/local-board/third-project.test.ts` beviser at et helt fremmed datasett går gjennom kjeden uten en eneste kodelinje for seg selv.

---

## 1. Prosjektoppsett

Fire ting skal på plass før noe innhold finnes: en datamappe, en oppføring i registeret, en rute og en merkevare.

### 1.1 Datamappa

```bash
mkdir -p data/demo/<id>
```

`<id>` er datasettets ID overalt: mappenavn, registeroppføring, rutenavn, prefiks i innholds-hashen og verdien `dataset=<id>` som Live-samtalen bruker. Små bokstaver, tall og bindestrek. Konvensjonen så langt er `<prosjekt>-lokal` (`nyhavna-lokal`, `leangenbukta-lokal`), som skiller den lokale demoen fra et provisjonert board med samme navn.

Fem faste filer og ett stedsformat skal ligge der. Alle må finnes, også de tomme — lasteren stopper på en manglende fil, med vilje:

| Fil | Innhold | Tom start |
|---|---|---|
| `board.json` | Identitet, kartutsnitt, kategorier, hilsen, stemmens setninger | Objekt med kategorier |
| `sources.json` | Kilderegisteret. Stabile ID-er alt annet peker på | `[]` |
| `places.json` | Stedene som får markør i små datasett | `[]` |
| `topics.json` | Temakunnskap, og `development`-objektet for bygg og fasiliteter | `[]` |
| `faq.json` | Spørsmål og svar, per kategori eller for hele området | `[]` |
| `conversations.json` | Samtaleeksempler. **Testgrunnlag, aldri faktakilde** | `[]` |

`conversations.json` lastes ikke av `loadDataset` og importeres ikke av `voice.ts`. En transkripsjon er hva noen sa, ikke hva som er sant, og den skal aldri kunne havne i modellens kunnskapsgrunnlag ved et uhell.

Når et prosjekt får et bredt POI-register, erstattes `places.json` med et atomisk filpar:

- **`places-audited.json`** — håndreviderte steder med sammendrag, fakta og kilder. Researchbyggeren eier fila.
- **`places-register.json`** — genererte registersteder med navn, type, adresse, kartanker og lagret reisetid. Registerimporten eier fila.

Ikke behold `places.json` samtidig. Lasteren avviser både sammenblandede formater og steder som ligger i feil kunnskapslag. Dette gjør det mulig å regenerere research og register uavhengig uten at den ene prosessen overskriver den andre.

Et minimalt `board.json` som laster:

```jsonc
{
  "schemaVersion": 1,
  "profile": "housing-development",
  "id": "<id>",
  "name": "<Prosjektnavn>",
  "center": { "lat": 63.0, "lng": 10.0 },
  "greeting": "Hei, jeg er guiden din på <Prosjektnavn>. …",
  "projectInfoLabel": "det kildekontrollerte materialet om <Prosjektnavn>",
  "pinSubtitle": "",
  "categories": [
    { "id": "<kategori-id>", "name": "…", "icon": "ShoppingBag", "color": "#4b6a4f" }
  ]
}
```

`pinSubtitle: ""` er ikke pynt. Utelater du feltet, faller kartmarkøren tilbake på sin egen standardtekst «Nybygg 2028» — en påstand om byggeår et tomt datasett ikke har dekning for, midt i kartet fra første sekund.

`center` er demoens faste referansepunkt, ikke en bestemt bolig. Alle reisetider måles herfra, og det skal sies i klartekst der det har betydning.

### 1.2 Registeroppføringen

Legg prosjektet inn i `LOCAL_DEMOS` i `lib/demo/local-board/registry.ts`:

```ts
{
  id: "<id>",
  directory: "data/demo/<id>",
  readme: "docs/research/<id>/README.md",
  features: {
    faqProgress: true,
    revealPlaces: true,
    followHighlightCategory: true,
    unscopedCategoryList: true,
    narrationFocus: true,
    voicePacing: true,
    guidedPersona: true,
  },
},
```

Dette er den eneste lista over mapper som kan lastes. En ID som ikke står her finnes ikke, og faller aldri tilbake på en annen demo.

**Skriv alle flaggene ut, ikke gjenbruk `ALL_FEATURES`.** Delte du konstanten, ville et framtidig flagg slått seg på hos deg uten at noen hadde vurdert om datasettet ditt bærer innholdet flagget forutsetter.

Hva hvert flagg gjør:

| Flagg | Slår på | Forutsetter i datasettet |
|---|---|---|
| `faqProgress` | Sidebaren viser hvilke spørsmål samtalen har vært innom | At `faq.json` har spørsmål |
| `revealPlaces` | Kartkommandoen `reveal_places` og «Vis flere steder» med utvidet radius | At `discoveryCategoryIds` peker på kategorier med flere likeverdige steder |
| `followHighlightCategory` | Kategorien følger stedene guiden fremhever | Steder fordelt på flere kategorier |
| `unscopedCategoryList` | Kategorilista viser hele utvalget, ikke bare det kartutsnittet dekker | — |
| `narrationFocus` | Kartet følger stedet stemmen nevner akkurat nå | Steder med markør |
| `voicePacing` | Tempoinstruksen legges på hilsenen | — |
| `guidedPersona` | Samtalen presenteres som den navngitte guiden Anja, ikke som «Placy» | En hilsen skrevet i guidens stemme |

Flaggene inngår i innholds-hashen sammen med datasettet (`datasetId` i `lib/demo/local-board/board.ts`). Endrer du et flagg, endrer du det brukeren ser, og en åpen fane får beskjed om å laste på nytt. Det er riktig.

### 1.3 Ruta

```bash
mkdir -p app/demo/<id>
```

Tre filer, kopiert i struktur fra `app/demo/leangenbukta-lokal/` og tilpasset:

- **`page.tsx`** — `export const dynamic = "force-dynamic"`, `notFound()` i produksjon, og så `getLocalDemo("<id>")` → `loadDataset` → `buildLocalProject` → `buildLocalBoard`. La feilen fra lasteren boble opp som den er; den peker på fil, felt og hva som manglet.
- **`layout.tsx`** — Mapbox-stilarket (`https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css`), prosjektets font via `next/font/local`, favicon, og en wrapper-div med merkevareklassen.
- **`lokal-board-gate.tsx`** — `"use client"`, og `<ReportReelsPage … boardMode="report" layout="framed" placePanel />`.

Mapbox-stilarket er ikke valgfritt. Uten det ligger 2D-kartets markører ustilt i dokumentflyten under lerretet i stedet for på kartet.

### 1.4 Merkevaren — det som faktisk må lages

Fire ting, og ikke flere:

1. **`<id>-brand.css`** i rutemappa, scopet til én klasse (`.<prosjekt>-board`) så den delte rapportflaten beholder sitt vanlige utseende. Hent fargene fra kundens egne stilark eller logo, og skriv i kommentaren hvor hver farge kom fra.
2. **Overskriftsfont** som `next/font/local` i `layout.tsx`, med woff2-filene under `public/demo/<id>-nettside/` eller tilsvarende.
3. **Kvadratisk logo** under `public/demo/<id>/`, referert fra `board.json` som `"pinImage": "/demo/<id>/<logo>.svg"`. Den fyller prosjektmarkørens skive. Sett `pinAccent` til utbyggerens farge hvis logoen krever det.
4. **Favicon** i `layout.tsx` sin `metadata.icons`.

**Det som IKKE skal kopieres fra en tidligere demo:**

- **Fiktiv megler.** Nyhavna-porten legger på en eksempelmegler; Leangenbukta gjør det ikke. Har prosjektet ingen navngitt kontaktperson i det kildekontrollerte materialet, skal demoen ikke starte med en person som ikke finnes. Adapterens `hideBrokerCard: true` blir stående.
- **`assets.brand`.** Flagget peker på `/illustrations/<slug>-logo.svg`, `-splash.jpg` og `-splash-video.mp4` (`lib/themes/project-brand.ts`). Finnes ikke de tre filene, gir flagget tre 404-er i stedet for splash-skjermens tekst-wordmark.
- **Prosjektspesifikke tekster i kode.** Hilsen, hva guiden presenterer, hvem den ikke er ansatt hos, delområdereglene og ordvalget hører i `board.json` sitt `voice`-objekt. Feltene er eksakte setninger, ikke maler: den som skriver innholdet ser nøyaktig hva guiden får vite, og en utelatt setning blir borte i stedet for å bli en tom plassholder.
- **Reisetider, koordinater og antall.** Se punkt 4.
- **Kvoter.** Antall steder eller FAQ-er fra forrige prosjekt er ikke et mål.

---

## 2. Researchbestillingen

Research leveres som **filer**, ikke som chat. Den lagres rått og uendret, og kurateres deretter i et eget dokument. Runtime leser aldri råmaterialet.

### 2.1 Per prosjekt (bygg, fasiliteter, tidslinje)

Bestill én post per objekt — prosjektet som helhet, hvert bygg, hver fasilitet, hvert uteområde — med disse feltene tydelig adskilt:

- **Hva objektet er:** prosjekt, bygg, fasilitet eller uteområde.
- **Byggets status:** står det, bygges det, er det planlagt, vedtatt, en visjon, eller uavklart.
- **Er tilbudet åpnet:** åpent, ikke åpnet, forventet, eller ukjent. **Dette er et annet spørsmål enn byggestatusen.**
- **Oppgitt tidspunkt, i kildens egen presisjon:** «Q2 2027», «høsten 2027». Aldri normalisert til en dato, og aldri oversatt til «snart».
- **Hvem som har adgang:** alle beboere, navngitte bygg, offentlig, eller uavklart. Med dokumenterte vilkår hvis kilden har dem.
- **Uttrykkelig bekreftelse ved innflytting,** per navngitt bygg og med kilde. Ingen kilde = ingen kobling.
- **Motstrid:** når to kilder sier hver sin ting, skal begge leveres med hver sin kildehenvisning. Ikke be researcheren velge.

Krav til hver eneste påstand: **kilde-URL til den spesifikke siden** (ikke forsiden), **utgiver** og **kontrolldato**. En påstand uten dette er en kandidat, ikke et fakta.

Hvorfor de fire første er fire og ikke ett felt: at bygget står ferdig sier ingenting om treningsrommet er åpent, at en åpning er ventet i 2027 sier ingenting om hvem som får bruke det, og en oppgitt innflyttingsdato er ikke en bekreftelse på at fasiliteten finnes da. Ett samlefelt tvinger den som skriver innhold til å velge hvilken av dem som vinner — og stemmen sier valget som om det var kilden. `docs/demos/board-profiler.md` har hele modellen.

### 2.2 Per kategori (nærområdet)

Én bestilling per kategori. Be om:

- **Kandidatsteder** med navn, adresse, koordinater, hva slags sted det er, og kilde-URL per sted.
- **Spørsmålene en kjøper faktisk stiller** i denne kategorien, ikke spørsmålene et board kan svare på.
- **Kunnskap uten ett bestemt sted** — hvordan området henger sammen, hva som er vedtatt, hvordan hverdagen ser ut — som blir temaer i stedet for markører.
- **Eksplisitte hull:** hva kilden ikke sier. Et dokumentert hull er et resultat, ikke en mangel ved leveransen.

Ingen reisetider fra researcheren. De beregnes i punkt 4, fra ditt eget senter.

---

## 3. Kandidatliste og kontroll

### 3.1 Råmaterialet blir liggende

```bash
mkdir -p docs/research/<id>/raw
```

Legg den leverte rapporten der, uendret, med faktisk filsti og dato registrert. Originalen skal kunne leses etterpå for å se hva som ble utelatt og hvorfor. Den lastes aldri som verifisert kunnskap.

### 3.2 Dekningsregnskapet

`docs/research/<id>/coverage.md` er regnskapet. Det svarer på ett spørsmål: hvilke kandidater kom inn, hva ble tatt inn, og hva ble utelatt — med begrunnelse per rad.

Tabellen har disse kolonnene:

| Kandidat | Kilde (URL) | Kontrolldato | Beslutning | Begrunnelse |
|---|---|---|---|---|

**Beslutningen er ett av tre ord:**

- **Tatt inn** — påstanden er kontrollert mot primærkilden og ligger i datasettet.
- **Utelatt** — vurdert og valgt bort. Begrunnelsen sier hvorfor, ikke bare «ikke relevant».
- **Uavklart** — vi har sett dette, men det er ikke bekreftet. Slike påstander sies **aldri** som fakta. De legges inn med `verification: "unresolved"` og brukes som forbehold.

Toppen av dokumentet bærer tallene: *X av Y kandidater vurdert, Z tatt inn, W utelatt, U uavklart.* Aldri bare antall importerte — det skjuler at resten ikke ble sett på.

Gjør tre gjennomganger, ikke én: fatt beslutninger på alt, gå så gjennom det som ble stående som «uavklart» på nytt, og ta til slutt en stikkprøve av egne beslutninger mot primærkilden.

### 3.3 Regelen som koster mest å bryte

**En databasekontroll teller ikke som en nettsidekontroll.** Henter du en kandidat fra det provisjonerte boardet, poolen eller et snapshot, betyr `checkedAt` da at du kontrollerte mot den lagrede databaseoppføringen — ikke at du kontrollerte stedets egen nettside på nytt. Skriv det i `coverage.md`, og sett `provenance` på stedet:

```jsonc
"provenance": { "provider": "supabase", "recordId": "<id>", "importedAt": "2026-09-18" }
```

Skal påstanden bære vekt i samtalen, åpne primærkilden og sett en ny `checkedAt`.

Ingen automatisk import av hele poolen. Kandidater derfra vurderes én for én, som alle andre.

---

## 4. Import

Nå skrives datasettet. Hele formatet står i `lib/demo/local-board/schema.ts`, som er kommentert felt for felt.

### 4.1 Det som er felles for alle profiler

Dette ser likt ut enten prosjektet er et boligprosjekt, en bruktbolig eller et næringsbygg:

- **`board.json`** — identitet, senter, kategorier, hilsen, `voice`-setningene, `presentation`-manuset og `discoveryCategoryIds`.
- **`sources.json`** — kilderegisteret. Skriv det først; alt annet peker hit.
- **Stedsformatet** — bruk `places.json` for et lite, håndskrevet utvalg. Bruk `places-audited.json` + `places-register.json` når boardet kombinerer revidert kunnskap med bred kartdekning. Runtime slår dem sammen; byggerne skriver hver sin fil.
- **`faq.json`** — spørsmål og svar. Rekkefølgen i fila er rekkefølgen på skjermen. Svar kan bære `[tekst](category:id)` og `[navn](poi:sted-id)`, som blir klikkbare og oppgis til stemmen.
- **`topics.json`** uten `development` — temakunnskap som ikke hører til ett sted.
- **`checkedAt`, `sourceIds` og `caveats`** på alt. Det er ikke pynt: hele poenget er at stemmen bare sier ting som har dekning, og sier fra når noe er usikkert eller planlagt.

### 4.2 Det som er boligprosjektspesifikt

- **`profile: "housing-development"`** i `board.json`. Feltet er påkrevd uten standardverdi. Et datasett som ikke har tatt stilling ville arvet boligprosjektets begreper uten å ha innholdet som gir dem mening. Oppgir du `resale` eller `commercial`, lastes datasettet ikke — de er dokumenterte grenser, ikke tilgjengelige valg.
- **`development`-objektet på et tema i `topics.json`.** Det er her byggestatus, åpning, tidspunkt, adgang, innflyttingskobling og motstrid bor. Feltene, verdiene og reglene står i **`docs/demos/board-profiler.md`**, som også har et fullt eksempel. Kortversjonen:
  - `availability: "open"` krever `availabilityClaimId`. At noe er åpent må ha kilde.
  - `moveInLinks` er den eneste måten å si «tilgjengelig ved innflytting». Den peker på ett bygg og én kilde. **Bygg B arver ikke bygg As bekreftelse.**
  - `timing.text` beholder kildens presisjon. Ingen kode sammenligner den med dagens dato. En passert forventning er en gammel forventning, ikke en åpning.
  - `conflicts` lar begge påstander bli stående. Ingen rangering.
  - Et objekt uten koordinat er lovlig. Det forblir søkbart tema og får ingen markør.
- **`hideBrokerCard`** settes av adapteren; ingen fiktiv megler.

### 4.3 Reisetider

Reisetider beregnes fra **dette prosjektets senter**, med **riktig reisemåte**, og legges inn som `travelTime: { walk, bike, car }` i hele minutter. De kopieres aldri fra et annet prosjekt, og de gjettes aldri — utelat heller feltet.

Skill tre ting som ser like ut: **rutetid** (hvor lang tid ruten tar), **gangtid til holdeplass** (som er noe annet enn busstiden), og **luftlinjeradius** (som styrer hvilke steder «vis flere» henter, ikke hvor lang tid noe tar). Bland dem, og guiden sier et tall som ikke betyr det lytteren tror.

### 4.4 Manuset

`presentation` i `board.json` er den kuraterte fortellingen, adskilt fra transkripter og spørsmål/svar. Hver del har `id`, `categoryId`, `text`, `placeIds`, `sourceIds` og `checkedAt`, og høyst 1200 tegn. Rekkefølgen i lista er omvisningens rekkefølge, og stedene nevnes i samme rekkefølge som `placeIds`.

---

## 5. Validering

```bash
npx vitest run lib/demo/local-board
```

Lasteren stopper med vilje på et halvt datasett. En demo som starter med hull er verre enn en som ikke starter: da oppdages hullet på møtet i stedet for i terminalen.

Feilmeldingene og hva de betyr:

| Melding | Hva som er galt |
|---|---|
| `Fant ikke <sti>. Demoen trenger alle seks filene …` | En av de seks filene mangler. Tomme filer skal være `[]`, ikke fraværende. |
| `<fil> er ikke gyldig JSON: …` | Syntaksfeil. Meldingen bærer parserens egen posisjon. |
| `<fil> har ugyldige data:` med punktliste | Skjemafeil. Hver linje er sti i JSON-en pluss hva som manglet. Første ti vises. |
| `Profilen «…» er dokumentert men ikke implementert` | `profile` er `resale` eller `commercial`. Egen feil, ikke en referansefeil: dette kan ikke rettes i datasettet. |
| `Datasettet i <mappe>/ har brutte referanser:` med punktliste | En ID peker på noe som ikke finnes. Vanligst: ukjent `sourceId`, ukjent `categoryId`, ukjent `placeId` i et manus eller en FAQ-lenke. |
| `… ID-en(e) … finnes flere ganger` | Dublett-ID i en av filene. |
| `development.availability: «open» krever availabilityClaimId` | Du har sagt at noe er åpent uten en påstand med kilde. |
| `development.moveInLinks: ukjent confirmedBy «…»` | Innflyttingskoblingen mangler kilde i `sources.json`. |
| `… «…» er ikke et tema med objectType «building»` | `access.buildingIds` eller `moveInLinks.buildingId` peker på noe som ikke er et bygg. |
| `origin er "imported", men sourceIds er tom` | Et svar gjengitt fra et annet board må si hvor teksten kommer fra. |
| `locationNote er forbeholdet til en omtrentlig plassering` | Sett `locationPrecision: "approximate"`, eller fjern notatet. |

Kjør også hele kjeden før du regner rammen som ferdig:

```bash
npx vitest run lib/demo/local-board lib/live
npx tsc --noEmit
npm run lint
```

---

## 6. Skjermkontroll og samtaletest

De to er forskjellige prøver, og den ene kan ikke stå for den andre.

### 6.1 Mekanisk test

Enhetstester og DOM-tester beviser at datasettet laster, at referansene holder, at kategoriene og markørene er der, og at verktøyene bærer prosjektets eget navn. De beviser **ikke** at samtalen er god.

Skjermkontrollen kjøres i nettleser på desktop 1440 × 900 og mobil 390 × 844:

```bash
PORT=<port> npm run dev
# http://localhost:<port>/demo/<id>
```

Kontroller at kategori, kartpunkt, detaljpanel, FAQ og stemmekontrollen er tilgjengelige uten skjult innhold eller blokkerende overlapp. Lagre skjermbildene i `docs/research/<id>/screenshots/` med dato i filnavnet.

### 6.2 Lyttetest

Fem spørsmålstyper **per kategori**:

1. **Bredt spørsmål** — «hva finnes for barnefamilier her?» Guiden skal gi en oversikt og et valg, ikke lese opp alt.
2. **Konkret sted** — «fortell om <sted>». Bare det stedet, med reisetid og reisemåte sagt sammen med navnet.
3. **Oppfølging** — «hvor langt er det dit?» Svaret skal bli i temaet, ikke hoppe til neste kategori.
4. **Spørsmål uten dekning** — noe datasettet ikke har. Guiden skal si at den ikke har grunnlag, uten å gjette, og uten å antyde at tilbudet ikke finnes i virkeligheten.
5. **Avbrudd og fortsettelse** — avbryt midt i en manusdel, still et faktaspørsmål, si «fortsett». Riktig del skal gjenopptas. **Stillhet alene skal ikke starte neste del.**

For et boligprosjekt kommer tre prøver til, som treffer nettopp det profilen finnes for:

6. «Kan jeg trene der nå?» når bygget er ferdig og fasilitetens åpning er ukjent. Svaret skal ikke slutte fra bygg til fasilitet.
7. «Er det klart når jeg flytter inn?» når det finnes en forventning, men ingen uttrykkelig bekreftelse. Forventningen forklares, tilgangen loves ikke, og en bekreftelse for bygg A brukes ikke for bygg B.
8. Et spørsmål der kildene spriker. Begge blir stående, uenigheten blir synlig, og guiden velger ikke et vilkårlig svar.

Resultatet føres i **`docs/research/<id>/conversation-evaluation.md`**: hva du sa, hva guiden svarte, hva kartet gjorde, og avviket hvis det var et. Skriv det ned per kategori — en kategori uten lyttetest er ikke innholdsferdig, selv om skjemaet er gyldig.

En tom kategori er et manglende **demogrunnlag**, ikke et fravær av tilbud i virkeligheten. Det skal både dokumentet og guiden si.

---

## 7. Oppdatering og gjenopptakelse

Slik oppfører demoen seg når innholdet endres mens noen ser på den.

**Hashen endrer seg ved hver endring.** `datasetId(dataset, descriptor)` i `lib/demo/local-board/board.ts` er en sha256 over hele datasettet **og** deskriptoren, prefikset med datasett-ID-en. Resultatet ligger på boardet som `demoSnapshotId`. Endrer du én setning i én JSON-fil, eller ett funksjonsflagg i registeret, får boardet en ny `snapshotId`.

**Endringer i ett datasett rører ikke et annet.** Hashen er per datasett. Skriver du i Leangenbuktas filer, står Nyhavnas `snapshotId` uendret, og motsatt. Det er bevist i `lib/demo/local-board/third-project.test.ts`.

**En aktiv samtale beholder sitt datasett.** Samtaletilstanden lages per sesjon av `createConversation()` i `lib/live/demos.ts` og bærer datagrunnlaget den startet med. En pågående samtale bytter ikke innhold under føttene på lytteren.

**En ny samtale fra en gammel fane blir avvist.** Ruta `/api/prototype/live` kontrollerer `snapshotId`, og en fane som sto åpen mens innholdet ble endret får beskjed om å laste på nytt. Alternativet — en guide som er uenig med skjermen — er verre.

**Ingen ny bygging.** Ruta er `force-dynamic`. Lagre JSON, last siden på nytt, start en ny samtale.

Arbeidsrutinen blir derfor: rediger filene → `npx vitest run lib/demo/local-board` → last siden på nytt → start en **ny** samtale → lyttetest.

---

## Kjente koblinger

Kartlagt 2026-09-18 med:

```bash
grep -rn -i "nyhavna" --include='*.ts' --include='*.tsx' \
  lib/demo/local-board lib/live components/variants/report/board app/demo/leangenbukta-lokal \
  | grep -v '\.test\.' | grep -v '^\S*:[0-9]*:\s*\(\*\|//\)'
```

Ingen av treffene gir et nytt prosjekt feil innhold på skjermen eller i tale. De fordeler seg på fire grupper.

**1. Navn på moduler og typer (uproblematisk).** `NyhavnaConversation`, `createNyhavnaConversation`, `conversationTools`, `nyhavnaFaqCatalog`, `nyhavna-chapters`, `nyhavna-knowledge`, `nyhavna-greeting`. Dette er den delte samtalemotoren som ble skrevet for Nyhavna først og siden gjort generell. Alle tar stedsnavnet som parameter: `nyhavnaFaqCatalog(board, dataset.board.name)` og `conversationTools(labels)` produserer tekster med **ditt** prosjektnavn. Navnene er historikk, ikke oppførsel. Å døpe dem om er et eget, mekanisk oppdrag som berører den frosne Nyhavna-demoen, og hører ikke hjemme her.

**2. Det frosne snapshotet (`nyhavna-leve`) og loggfilene (uproblematisk).** `getNyhavnaSnapshot`, `NYHAVNA_LABELS`, `nyhavnaInstructions`, `nyhavnaProjectInfo`, `DEFAULT_LIVE_DATASET = "nyhavna-leve"`, og filnavnene `.context/nyhavna-live-session.json` og `.context/nyhavna-live.log`. Snapshotet er en egen, frossen demo ved siden av de lokale, og loggfilene er lokale utviklingsspor.

**3. Standardverdier som en lokal demo aldri treffer (verdt å kjenne til).** Tre steder har en Nyhavna-verdi som fallback, og i alle tre setter den lokale kjeden feltet eksplisitt:

| Sted | Fallback | Hvorfor den ikke treffer |
|---|---|---|
| `app/api/prototype/live/route.ts:91` | `NYHAVNA_VOICE_INSTRUCTIONS` når `demo.voiceInstructions` mangler | `lokalDemo()` setter alltid `buildLocalVoiceInstructions(dataset)` |
| `components/variants/report/board/voice/board-voice.tsx:183` | `NYHAVNA_GREETING_INSTRUCTION` når `data.demoGreeting` mangler | `greeting` er påkrevd i `board.json`, og adapteren legger det på boardet |
| `lib/realtime/nyhavna-conversation.ts:161` | `NYHAVNA_CURATED` når `deps.curatedFor` mangler | `buildVoiceDeps(dataset)` setter alltid datasettets egen provider |

Konsekvensen hvis en av dem likevel utelates er alvorlig — guiden ville snakket om Nyhavna på et annet prosjekts board — men den kan ikke oppstå gjennom `lokalDemo()`, og `lib/live/demos.test.ts` holder på det. **Setter du senere sammen en LiveDemo utenfor `lokalDemo()`, må alle tre settes eksplisitt.**

**4. Én gjenstående eksakt slug-sjekk i delt kode (funn, ikke rettet).** `components/variants/report/reels/ReportReelsPage.tsx:705` og `:708`:

```ts
const [splashVisible, setSplashVisible] = useState(boardData.projectSlug !== "nyhavna");
const [boardRevealed, setBoardRevealed] = useState(boardData.projectSlug === "nyhavna");
```

Det frosne `nyhavna`-boardet hopper over velkomstsplashen; alle andre boards, inkludert begge lokale demoer, viser den. Oppførselen er riktig i dag, og et nytt prosjekt arver den riktige grenen automatisk — men betingelsen er et prosjektnavn i delt kode, ikke et flagg.

Riktig fiks er et felt på boardet (for eksempel `skipSplash`) satt av det frosne snapshotets egen byggesti. Den er ikke gjort her, fordi den berører den frosne Nyhavna-demoen, og R2 krever at eksisterende Nyhavna-atferd bevares. Endringen hører hjemme i en egen runde med Nyhavna-regresjon på plass.

---

## Lesing videre

- `docs/demos/board-profiler.md` — profilene, `development`-objektet og reglene rundt tid og adgang.
- `lib/demo/local-board/schema.ts` — hele dataformatet, kommentert felt for felt.
- `docs/research/nyhavna-lokal-demo/README.md` — første gjennomføring av metoden.
- `docs/research/leangenbukta-lokal-demo/README.md` — andre gjennomføring, og status per enhet.
- `docs/research/nyhavna-leve-demo/site-coverage.md` og `curated-source-audit.md` — dekningsregnskap og kilderevisjon i praksis.
- `lib/demo/local-board/third-project.test.ts` — beviset for at et tredje prosjekt er data, ikke kode.
