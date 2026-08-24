# OSM som kandidat-kilde inn i /curate-area — ikke som pin-kilde i provisjoneringen

**Dato:** 2026-08-24
**Status:** Fase 1 komplett (K1, K2, K3, K4) 2026-08-24. Fase 2–3 gjenstår.
**Utløser:** Andreas så at OSM-kartet over Grilstad/Ranheim er tett av objekter Google mangler (lekeplasser, bordbenker, badeplasser, grillplasser) — men også tett av objekter som er *feil å vise*: private borettslags-parkeringer og gårdsrom-lekeplasser markert som om de var nabolagets. Bekymringen er ikke datamengde, det er misforståelses-risiko hos meglerens boligkjøper.

---

## Premisset må korrigeres først

Utgangsspørsmålet var «skal vi ta inn OSM?». Det er allerede gjort. Faktisk tilstand i prod per 2026-08-24:

- **787 av 5 642 rader i `v2.pois` har `source = "osm"`** — fordelt på 36 kategorier: `restaurant` 122, `haircare` 68, `cafe` 64, `park` 47, `supermarket` 41, `bar` 34, `idrett` 167, `lekeplass` 9, `badeplass` 2, m.fl.
- **Den løpende pipelinen importerer bare idrettsanlegg.** `lib/pipeline/import-public-pois.ts:422-426` spør Overpass om nøyaktig fire tag-mønstre: `leisure=sports_centre`, `leisure=pitch` med `sport~soccer|football|handball|tennis|basketball`, `leisure=swimming_pool`. De øvrige ~620 OSM-radene stammer fra tidligere seeding/`074`-migrasjonen, ikke fra dagens pipeline.
- **Navnekravet er den bærende sperren.** `import-public-pois.ts:471` (`if (!name) continue;`) forkaster alt uten navn. Målt på Ranheim: av 298 OSM-objekter innenfor 1 km av Strindfjordvegen 10 er **258 navnløse** — inkludert alle 69 parkeringene og alle 18 lekeplassene. Andreas' fryktscenario har derfor ikke materialisert seg via dagens pipeline.

**Men navnekravet er ikke tilstrekkelig.** Der OSM *har* navn, slipper den gjennom nøyaktig den klassen feil bekymringen handler om. Dagens ni `lekeplass`-rader med `source=osm` er:

| Rad | Hva det faktisk er |
|-----|--------------------|
| `Ila barnehage`, `Iladalen barnehage` | Barnehager — feilkategorisert som lekeplass |
| `Lekerom/stellerom` | Stellerom, sannsynligvis i et kjøpesenter |
| `Leo's lekeland` | Kommersielt innendørs lekeland med billettpris |
| `Mummyhuset` | Uklart hva |
| `Buran lekeplass`, `Marinen lekeplass`, `Strandveiparken lekeplass`, `Lekeplass andre avdeling TKB` | Reelle lekeplasser (den siste er en barnehage-avdeling) |

Fire av ni er gyldige. Det er sperren som mangler, ikke datakilden.

---

## Kildehierarkiet dette bygger på

Én setning styrer hele spesifikasjonen:

> **OSM bidrar med geometri og terreng. Google bidrar med virksomheter. Entur bidrar med kollektiv. Barnehagefakta/NSR bidrar med institusjoner.** Ingen kilde får bidra der en annen er autoritativ.

Google indekserer *virksomheter* — noe med eier, åpningstid og omtaler. OSM indekserer *fysiske objekter* uavhengig av om noen eier dem. Det er komplementet, og det er også grensen: OSM skal aldri levere en restaurant, kafé, frisør eller butikk til et board, fordi Google har åpningstider, telefon og bilder på samme sted og OSM bare legger til foreldelses-risiko.

---

## Mål

1. **Ingen OSM-objekt havner på et board uten at det å ta feil om det er kostnadsfritt.** Leveres av krav K1–K4 (fire-porten) og K7 (kategori-revisjon).
2. **Mikro-dataen OSM er unik på blir tilgjengelig for kurator uten å bli pins.** Leveres av krav K5 (strøk-sveip) og K6 (aggregat-fakta).
3. **`/curate-area` får OSM som eksplisitt kilde i tekstskrivings-steget, med kildestempel.** Leveres av krav K8.

---

## Den bærende regelen: konsekvens, ikke datakvalitet

Filteret er et **konsekvens-filter**, ikke et kvalitetsfilter. Spørsmålet er ikke «hvor sikker er dataen?» men «hva koster det om vi tar feil?»

- En navngitt idrettshall: tar vi feil, står det et litt galt navn på et bygg som utvilsomt er der. Kostnad ≈ 0.
- En lekeplass: tar vi feil, har vi fortalt en boligkjøper at barna har en lekeplass som tilhører et annet borettslags gårdsrom. Kostnad = tillit hos meglerens kunde, som er hele produktet.

Nedsiden er asymmetrisk. Derfor: **tvilstilfeller faller ut, ikke inn.** En benk vi går glipp av koster ingenting.

---

## To baner, skilt av konsekvens

### Bane A — `v2.pois` (publiserbar, vises som pin på kartet)

Et OSM-objekt får bli POI bare hvis **alle fire portene** passeres:

**Port 1 — tag-hvitelisten.** Kun disse, og kun disse:

| OSM-tag | Placy-kategori | Hvorfor trygg |
|---------|----------------|---------------|
| `leisure=sports_centre` | `idrett` | Offentlig anlegg per definisjon, navngitt |
| `leisure=sports_hall` | `idrett` | Samme |
| `leisure=pitch` + `sport=*` | `idrett` | Samme (dagens sport-liste beholdes) |
| `leisure=swimming_pool` | `swimming` | Samme |
| `leisure=track` | `idrett` | Samme |
| `leisure=park` | `park` | Kommunalt friområde — men se Port 3 |
| `leisure=marina` | `marina` | Navngitt anlegg |
| `natural=beach` | `badeplass` | Allemannsretten gjelder; strandlinje er ikke privatiserbar |
| `tourism=viewpoint` | `outdoor` | Offentlig utsiktspunkt |

**Port 2 — navn påkrevd.** Dagens `if (!name) continue;` beholdes uendret. Ingen unavngitt objekt blir POI, noensinne.

**Port 3 — adgang må ikke ekskludere publikum.** Forkast hvis `access ∈ {private, customers, permit, no, residents}`. Merk at fravær av `access` regnes som *godkjent* for Bane A-taggene over, fordi hvitelisten allerede er valgt for kategorier der offentlig adgang er strukturelt gitt. Det er nettopp derfor `leisure=playground` ikke kan ligge i hvitelisten: der er fravær av `access` det vanlige (12 av 18 på Ranheim), og default-antakelsen «offentlig» er feil.

**Port 4 — kategori utledes fra taggen, aldri fra navnet.** Tabellen over er hele mappingen. Ingen navne-heuristikk, ingen nøkkelord-matching. Det er navne-utledning som produserte `Leo's lekeland` som lekeplass.

**Permanent utestengt fra Bane A**, med grunn (skal stå i koden som kommentar, ikke bare her):

| Tag | Grunn |
|-----|-------|
| `amenity=parking`, `parking_entrance`, `bicycle_parking` | 47 av 69 på Ranheim har ingen `access`-tag — privat og offentlig er ikke skillbart. Og parkering er ikke en grunn til å kjøpe bolig. |
| `leisure=playground` | 12 av 18 utagget, 0 navngitte i OSM-sveipet; de navngitte i basen i dag er barnehager, et stellerom og et betalt lekeland. Kommer fra SSB/kommunale data i stedet, se «Utsatt». |
| `amenity=bench`, `picnic_table`, `bbq`, `shelter`, `lounger`, `toilets`, `waste_basket`, `drinking_water` | Navnløse av natur. Hører i aggregat-tekst (Bane B), ikke som pin. |
| `natural=tree`, `rock`, `scrub` | Mikro-geometri uten beslutningsverdi for en boligkjøper. |
| `shop=*`, `amenity=restaurant|cafe|fast_food|bar|pharmacy|dentist|doctor|fuel|post_office`, `office=*`, `craft=*`, `healthcare=*` | Google er autoritativ: åpningstider, telefon, bilder, omtaler. OSM tilfører bare foreldelses-risiko. |
| `place=square`, `man_made=*`, `historic=*` | Uklar kategori-tilhørighet; `Archidiakoni plass` og `Blussuvoll plass` ligger i basen som `park` i dag og er ikke parker i noen brukbar forstand. |

### Bane B — dossier (kurator-input, rendres aldri)

Alt annet med signal går til `data/areas/<slug>.osm-scan.md` og videre inn i `<slug>.dossier.md`. Den fila er allerede etablert konvensjon (`ranheim.dossier.md`, `straumen.dossier.md`, `oppdal.dossier.md`) med kildestempel per observasjon og eksplisitt «IKKE publiseringstekst — kurator-input» i toppen. Bane B skriver **aldri** til databasen.

Bane B inneholder tre ting:
1. **Bane A-kandidater** listet med `osm-<type><id>` slik at de kan verifiseres før de importeres.
2. **Aggregat-fakta per tema** (under) — tall og geometri kurator kan skrive `body` fra.
3. **Avvisnings-regnskap**: antall forkastet per regel, med regelnavn. Ingen stille trunkering — hvis 69 parkeringer falt ut, står det at 69 parkeringer falt ut.

---

## Aggregat-fakta per tema (Bane B)

Dette er hva OSM faktisk kan bidra med i `body`-teksten uten misforståelses-risiko, fordi geometri ikke har eier:

| Tema | OSM-bidrag | Ikke fra OSM |
|------|-----------|--------------|
| `natur-friluftsliv` | Strandlinje-meter innenfor polygonet (`natural=coastline`), park-areal i m² (`leisure=park`), km merket sti (`highway=path|footway` med `informal≠yes`), navngitte badeplasser, antall rasteplasser | — |
| `trening-aktivitet` | Bane A-anlegg + `leisure=fitness_station` som antall | Treningssentre (Google) |
| `transport` | Km sykkelveg (`highway=cycleway`), antall sykkelparkeringer som *aggregat* | Holdeplasser og linjer (Entur er autoritativ) |
| `barn-oppvekst` | Kun lekeplasser med eksplisitt `access=yes`, ellers «ikke kartlagt» | Barnehager (Barnehagefakta), skoler (NSR) |
| `hverdagsliv` | Ingenting | Google |
| `mat-drikke` | Ingenting | Google |

Regelen for `barn-oppvekst` er verdt å understreke: på Ranheim gir den 5 lekeplasser av 18 — de fem OSM-bidragsytere faktisk har tagget som offentlige. Det er konservativt ved konstruksjon, og feilen som gjenstår er «vi nevner for få», som er den ufarlige retningen.

---

## Status etter Fase 1 (implementert 2026-08-24)

`lib/pipeline/osm-gate.ts` + `lib/pipeline/osm-gate.test.ts` (61 tester) er skrevet, og
`import-public-pois.ts` ruter all Overpass-import gjennom porten. Fixturen er et reelt
Overpass-sveip over PRODUKSJONS-bboxen rundt Grilstad Marina (63.43826/10.50872, radius
2 500 m) — 781 objekter, lest 2026-08-24 — så tallene i testene er etterprøvbare mot ekte data.

**Resultat: 14 av 781 objekter godkjent.** De 12 anleggene den gamle hardkodede spørringen
importerte er alle med (ingen regresjon), pluss to nye: `Grilstadstranda` (badeplass) og
`Grilstad Marina` (marina). Avvist: 171 parkeringer, 57 lekeplasser, 52 sykkelparkeringer,
184 trær, 25 benker, 17 baner uten navn, 13 baner uten brukbar `sport`.

### Tre endringer i hvitelisten mot spesifikasjonen over

1. **`amenity=library`, `amenity=theatre`, `amenity=cinema` er tatt UT.** Temaet deres
   («opplevelser») ligger i `GLOBAL_DISABLED_REPORT_THEMES` siden 2026-04-28. Import ville
   lagt radene i poolen uten at de rendret noe sted — samme recall-bug som `marina`/`hundepark`
   hadde før 2026-08-12, bare i motsatt retning. En test håndhever nå at hver kategori porten
   kan produsere ligger i et AKTIVT tema.
2. **`amenity=community_centre` er tatt UT.** `fritidsklubb` ligger i «Barn & Oppvekst», men
   OSM-taggen betyr bare «forsamlingslokale». Det ene treffet i sveipet er
   «Rotvoll kunstnerkollektiv SA» — et kunstnerkollektiv vist under Barn & Oppvekst er
   nøyaktig den feilkategoriseringen porten finnes for å hindre.
3. **`leisure=park` og `tourism=viewpoint` står, men ga null treff her.** Alle 2 parker og
   alle 4 utsiktspunkt i bboxen er navnløse, så Port 2 avviste dem. Reglene er beholdt fordi
   de er riktige der dataen er bedre; at de er stille på Ranheim er den ufarlige retningen.

### Funn under implementeringen: id-konvensjonene divergerte

De to skrivestiene bygde POI-ID-er ulikt, og det var en latent duplikat-bombe:

| Skrivesti | `id` | `osm_id` |
|-----------|------|----------|
| `scripts/seed-osm-pois.ts:202` | `osm-node-123` | `node/123` |
| `import-public-pois.ts` (før) | `osm-node123` | `osm-node123` |

Alle 662 `osm-*`-radene i basen har seed-formen — pipelinens Overpass-kilde hadde aldri
skrevet en rad, fordi Overpass svarte 406 på Node-fetch sin default User-Agent. Idet den
kilden begynner å virke (User-Agent-fiksen samme dag), ville pipelinen slått opp
`osm_id = "osm-node123"`, ikke funnet raden med `osm_id = "node/123"`, og satt inn en ny rad
ved siden av. Begge skrivestier følger nå seed-formen, via `osmPoiId()`/`osmSourceId()` i
`osm-gate.ts`.

### Åpent hull porten ikke dekker

`linkNaturPois` i `import-public-pois.ts` lenker **eksisterende** POI-er fra hele poolen i
kategoriene `lekeplass`, `badeplass`, `park`, `outdoor` innenfor radius, opp til 20 — uten å
spørre porten. De ni tvilsomme `lekeplass`-radene kan altså fortsatt nå et board den veien.
De er ulenket i dag (verifisert 2026-08-24), så hullet er latent, ikke aktivt. Det lukkes
sammen med K7-revisjonen: fjerner man `lekeplass` fra linkeren nå, forsvinner også de fire
legitime lekeplassene fra boards som viser dem i dag, og det er en produktendring, ikke en
opprydding.

---

## Krav

**K1** — `lib/pipeline/osm-gate.ts`: fire-porten som ren funksjon. Tar et Overpass-element, returnerer `{ accept: true, categoryId }` eller `{ accept: false, reason }` med maskinlesbar `reason`.

**K2** — `import-public-pois.ts` ruter all Overpass-import gjennom `osm-gate`. Overpass-spørringen utvides til hvitelistens tagger. Ingen rad skrives uten at gaten godkjente den, og avvisninger telles i `ImportPublicPoisResult.warnings`.

**K3** — Tverr-kilde-dedup av sammenfallende pins: samme kategori + samme normaliserte navn innenfor 200 m regnes som samme sted, og bare én pin vises. Se «Slik K3 faktisk landet» under — plasseringen og rangeringsregelen ble begge andre enn spesifisert her, og begge endringene ble funnet ved å måle mot prod.

**K4** — Kategori-mappingen fra Port 4 er en frosset tabell i `osm-gate.ts` med test som feiler hvis noen legger til en tag uten å begrunne den i kommentar.

**K5** — `scripts/osm-area-scan.ts`: leser boundary-polygonet fra `data/areas/<slug>.staging.json`, sveiper Overpass, skriver `data/areas/<slug>.osm-scan.md`.

```bash
npx tsx scripts/osm-area-scan.ts --file data/areas/<slug>.staging.json [--out <sti>]
```

Implementasjonsnote: boundary-polygonene varierer fra 20 til 399 punkter (`ranheim` 20, `straumen` 25, `eberg` 399). Bruk **bbox-spørring mot Overpass + punkt-i-polygon-filtrering i TS**, ikke Overpass' `poly:`-filter — det unngår både lengdegrensen og treg polygon-matching på serversiden, og geometri-matematikken trengs uansett til K6.

**K6** — Aggregat-utregnerne fra tabellen over: strandlinje-meter, park-areal, sti-km, sykkelveg-km. Testes mot Ranheim, som har kjente tall fra `ranheim.dossier.md`.

**K7** — Revisjonsrapport over de 787 eksisterende OSM-radene: hvilke ville passert dagens fire-port, hvilke ikke, gruppert per avvisningsgrunn. **Rapport, ingen mutasjon.**

**K8** — `/curate-area`-kommandoen får steg 2b «OSM-sveip» mellom kandidatmenyen og tekstskrivingen, samt en eksplisitt regel: *et OSM-objekt kan aldri bli `highlightCandidate` med mindre det har passert Bane A og finnes i `v2.pois`* — re-arven dropper det ellers som `ikke-i-db`.

---

## Faser

**Fase 1 — porten (K1, K2, K3, K4).** Rein logikk med tester. Ingen rader muteres; K3 fjerner bare lenker. Etter denne fasen kan pipelinen importere bredere enn i dag uten å slippe inn noe misvisende.

**Fase 2 — dossier-banen (K5, K6).** Ny script + geometri. Leser Overpass og skriver fil. Berører ikke databasen i det hele tatt.

**Fase 3 — wiring og revisjon (K7, K8).** Kommandodokumentet oppdateres, og revisjonsrapporten over eksisterende rader skrives.

Opprydding av de 236 overtallige radene i basen er ikke en del av noen fase — se «Scope-grenser».

---

## Funnet under spesifiseringen: 14 doble pins på fire boards

Ikke bestilt, men funnet ved å måle. Alle 5 642 rader i `v2.pois` klynget på normalisert navn + haversine-avstand under 200 m, krysset med `v2.project_pois`:

- **208 duplikat-klynger i basen, 236 overtallige rader.** 147 av klyngene (169 rader) har minst én `source=osm`-rad.
- **Men bare 9 av dem er synlige for noen.** 4 666 av 5 642 rader har ingen prosjekt-lenke i det hele tatt — de ligger i basen uten å vises på noe board. Synlige doble pins: **9 tilfeller på 4 boards, 14 overtallige pins.**

Og det viktigste: **det er ikke primært et OSM-problem.** Fordelingen av de 9:

| Board | Duplikat | Kilder involvert |
|-------|----------|------------------|
| `placy-demo_strindfjordvegen-10` | `Recharge Charging Station` 4x | 4 forskjellige `google-`-IDer |
| `megler-harstad_strindfjordvegen-10-…` | `Recharge Charging Station` 4x | samme fire |
| `grilstad-marina_byggetrinn-4` | `Recharge Charging Station` 3x | samme kilde |
| alle tre Ranheim-boards | `Rotvollfjæra` 2x | intern `badeplass-`-seed + `google-` |
| `placy-demo_strindfjordvegen-10` | `Extra Arena` 2x | to UUID-rader, begge OSM-avledet, 80 m fra hverandre |
| `grilstad-marina_byggetrinn-4` | `Trondheim Båtforening` 2x | UUID + `google-` |
| `placy-demo_sundsoya` | `Sakshaug skole` 2x | `nsr-` + `osm-node-` |

Seks av ni er kryss-kilde-kollisjoner (Google mot intern seed, NSR mot OSM), og den tyngste enkeltsaken er Googles egne data: «Recharge Charging Station» finnes som tre til fire distinkte Google-place-IDer innenfor 200 m — sannsynligvis fire reelle ladepunkter på samme anlegg, alle med identisk navn. Det er korrekt data presentert dårlig.

**Konsekvens for kartet:** `lib/board/spread-co-located.ts` sprer sammenfallende pins på en liten sirkel i stedet for å stable dem, så duplikatene vises som separate pins ved siden av hverandre — de skjuler seg ikke. Ranheim-boardet Andreas ser på har fire «Recharge Charging Station»-pins, to «Extra Arena» og to «Rotvollfjæra».

**Derfor er K3 formulert som tverr-kilde-dedup ved lenking, ikke som en OSM-spesifikk `osm_id`-backfill.** Det er også et mildere inngrep: det fjerner 14 *lenker*, ikke POI-rader, og en fjernet lenke er reversibel ved re-provisjonering. De 236 overtallige radene i basen kan ligge — de er usynlige, og oppryddingen der er et eget mutasjonsløp.

## Slik K3 faktisk landet (implementert 2026-08-24)

`lib/pipeline/dedupe-colocated-pins.ts` + 19 tester. To avvik fra spesifikasjonen over, begge funnet ved å kjøre den mot prod før innkobling:

### 1. Dedupen hører i hydreringen, ikke i lenkingen

Spec'en sa «ved lenking til `project_pois`». Det er feil sted, av en grunn som først ble tydelig da jeg målte: **boardet rendrer `product_pois`, ikke `project_pois`.** `project_pois` er poolen, og den bærer de precomputede reisetidene (migrasjon 071). Å droppe en rad fra poolen ville kastet reisetiden og gjort valget varig.

Dedupen ligger derfor i `hydrate-report.ts`, som er steget som deriverer `product_pois` fra poolen (delete + re-insert). Det gir tre ting: poolen forblir komplett, valget er en ren visnings-beslutning som re-hydrering gjenoppretter, og fordi hydreringen er ett felles chokepoint nedstrøms for BÅDE Google-importen og de offentlige kildene, trengs ikke to separate fikser i to lenkestier.

### 2. Innhold slår kilde — kilde-prioritet alene skjulte kuratert Lokalkunnskap

Spec'en sa «kilde-prioritet: Google > registre > OSM > interne seeds». Implementert slik ville den droppet **`badeplass-grilstadstranda`** — som har `editorial_hook`, `poi_tier`, `is_local_gem`, `area_id` og `grounding` — til fordel for **`osm-relation-20106862`**, som har ingenting utover `osm_id`. Interne seeds er nemlig sist i kilde-rangeringen, og OSM er over dem.

Rangeringen er derfor: **beskyttet ID → redaksjonelt innhold → Google-metadata → kilde → OSM-geometritype → ID.** Redaksjonell tekst rangeres over Google-metadata fordi den er Placy-eid og håndskrevet per sted, mens rating/åpningstider/bilder kan hentes på nytt av pipelinen når som helst — og fordi `highlightCandidates` i strøkets editorial peker på KONKRETE POI-IDer: skjules den kuraterte raden, forsvinner høydepunktet fra boardet.

`protectedIds` er lagt inn som en eksplisitt seam for kallere som vet om slike eksterne pekere. Hydreringen bruker den ikke i dag.

### Resultatet på prod

15 pins skjult på 3 boards, 0 gjenstående duplikater etter re-hydrering:

| Board | Skjult |
|-------|--------|
| `grilstad-marina_byggetrinn-4` | 8 — 3 barnehager (OSM mot Barnehagefakta), Grilstadstranda (OSM mot kuratert seed), EXTRA Arena (OSM-node mot OSM-way med editorial), Trondheim Båtforening (Google mot rad med editorial), 2 ladestasjoner |
| `placy-demo_strindfjordvegen-10` | 4 — Extra Arena, 3 ladestasjoner |
| `megler-harstad_strindfjordvegen-10-…` | 3 — 3 ladestasjoner |

Merk at «Recharge Charging Station» finnes i flere klynger: de tre innenfor 200 m ble én pin, men de to som ligger 450 m+ unna er egne steder og beholdes. Terskelen skiller dem uten navnelogikk.

Verifisert i browser på begge Ranheim-boards: én `Extra Arena`-pin, én ladestasjon per anlegg. Før-snapshots i `backups/*-product_pois-før-dedup.json`.

---

## Scope-grenser

### Inkludert
Porten, strøk-sveipen, aggregat-fakta, `/curate-area`-wiringen, revisjonsrapporten over eksisterende rader.

### Deferred to Separate Tasks
- **Opprydding av de 787 eksisterende OSM-radene.** K7 leverer rapporten som viser hva som må ryddes; selve slettingen/rekategoriseringen er et data-mutasjonsløp med eget snapshot. Tas opp når rapporten foreligger.
- **Opprydding av de 236 overtallige radene og de 4 666 ulenkede radene i `v2.pois`.** Usynlige i dag, men de gjør hver framtidig telling og hvert dedup-oppslag skittent. Eget mutasjonsløp med snapshot og angre-tagg.
- **Lekeplasser og friområder fra autoritativ kilde.** SSBs «Parker og turområder» ligger som WFS på Geonorge og er offentlige ved konstruksjon — ingen privat/offentlig-tvetydighet å gjette på. Det er den riktige kilden for `barn-oppvekst` og `natur-friluftsliv`, men det er en ny kilde-integrasjon, ikke en OSM-regel. Tas opp som eget spor.
- **ODbL-attribusjon i UI.** OSM er ODbL: attribusjon kreves, og share-alike gjelder derivert database. Mapbox-grunnkartet attribuerer allerede OSM nederst i kartet, så kravet er sannsynligvis dekket for pin-laget også — men det må verifiseres mot ODbL §4.3 før første betalte kunde, ikke som del av dette arbeidet.
- **Googles vilkår vs. blanding av kilder.** Google forbyr å bruke Places-data til å bygge eller berike en annen base. Dagens arkitektur holder kildene atskilt per rad (`source`-kolonnen, «aldri merget» per `import-public-pois.ts`-headeren), og den grensen skal ikke røres her.

---

## Akseptansekriterier

- [x] `osm-gate` avviser alle 171 parkeringer, alle 57 lekeplasser, alle 52 sykkelparkeringer og alle 25 benker i produksjons-bboxen, med korrekt `reason` per rad.
- [x] `osm-gate` godkjenner de 12 navngitte idrettsanleggene dagens pipeline importerer — ingen regresjon i det som virker i dag.
- [x] `osm-gate` avviser `Leo's lekeland`, `Lekerom/stellerom`, `Ila barnehage`, `Iladalen barnehage` og `Mummyhuset` — med de reelle OSM-taggene deres. `Iladalen barnehage` har `access=yes` og ville passert både navnekravet og adgangsporten; bare utestengelsen av hele `leisure=playground` stopper den.
- [x] Hver kategori porten kan produsere rendres i et aktivt rapport-tema (drift-test).
- [x] Begge skrivestier gir samme POI-ID for samme OSM-objekt.
- [ ] `npx tsx scripts/osm-area-scan.ts --file data/areas/ranheim.staging.json` skriver en fil med (a) Bane A-kandidater med osm-id, (b) aggregat-fakta per tema, (c) avvisnings-regnskap der summen av avviste + godkjente er lik antall elementer Overpass returnerte.
- [ ] Aggregat-tallene for Ranheim er manuelt verifisert mot kartet for minst tre av fire utregnere (strandlinje, park-areal, sti-km).
- [ ] `/curate-area.md` har steg 2b og regelen om at OSM aldri blir `highlightCandidate` uten Bane A-passering.
- [x] Etter K3: 15 sammenfallende pins skjult på 3 boards, 0 gjenstående duplikater, og beholdt rad er den med redaksjonelt innhold der det finnes (verifisert i browser på begge Ranheim-boards).
- [ ] K7-rapporten dekker alle 787 OSM-rader og rapporterer fullstendighet: «787 av 787 vurdert, X ville passert, Y avvist fordelt på Z grunner».
- [x] `npm run lint` (0 errors), `npx vitest run` (2 956 tester, 190 filer), `npx tsc --noEmit` grønt.

---

## Referanser

- `lib/pipeline/import-public-pois.ts` — dagens Overpass-import (linje 407-500), navnekravet (471), dedup-oppslaget (82-108)
- `.claude/commands/curate-area.md` — kommandoen dette hektes på, steg 2 og 3
- `data/areas/ranheim.dossier.md` — dossier-konvensjonen Bane B skriver i
- `lib/board/spread-co-located.ts` — hvorfor duplikat-rader blir synlige som separate pins
- Måledata bak tallene i dette dokumentet: Overpass-sveip 1 km rundt 63.4351071/10.5053350 (Strindfjordvegen 10), lest 2026-08-24; full skan av `v2.pois` (5 642 rader) og `v2.project_pois` (1 846 lenker) samme dag
