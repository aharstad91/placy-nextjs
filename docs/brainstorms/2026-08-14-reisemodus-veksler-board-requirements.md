---
date: 2026-08-14
topic: reisemodus-veksler-board
---

# Reisemodus-veksler på rapport-boardet (gå / sykkel / bil)

## Problem Frame

Rapport-boardet oppgir alle avstander som gangtid, og bare gangtid. Det gjør at boardet
systematisk **undersolgt** hver adresse som ikke er tett by — og det er de fleste adressene
i dagens salgspipeline (Grilstadporten, Brundalen, Ranheim, Sundsøya).

Målt på `intern_martin-barstads-veg-23c` (Ranheim, provisjonert 2026-08-14):

| modus | spenn | distinkte verdier |
|-------|-------|-------------------|
| gå | 6–35 min | 26 |
| sykkel | 3–17 min | 15 |
| bil | 3–12 min | 10 |

Konkrete punkter fra samme board (gå → sykkel → bil):

- Solbakken barnehage: **35 → 17 → 11**
- Charlottenlund videregående skole: **31 → 14 → 12**
- Hansbakkfjæra: **28 → 16 → 8**

Boardet forteller i dag bare den første kolonnen. En kjøper som sykler eller kjører leser
«35 minutter» og avskriver et sted som ligger elleve minutter unna. Dette er Placys egen
versjon av svakheten vi bruker som argument mot FINNs Nærområdet-kart: kartet får området
til å se tommere ut enn det er, bare med minutter i stedet for pins.

Målingen avkrefter også bekymringen for at alternativ-modusene blir informasjonsløse.
Jeg forventet at bil-modus ville kollapse alt til «4 min» på et board med 2 km radius, men
den beholder 10 distinkte verdier, og sykkel beholder 15. Rekkefølgen endrer seg reelt:
Hansbakkfjæra er 28. nærmeste til fots og blant de nærmeste i bil.

Motoren finnes allerede. `lib/pipeline/travel-times.ts` støtter walk/bike/car, og
`v2.project_pois.travel_times` har tomme `bike`/`car`-slots per POI. Provision kaller bare
`["walk"]`. Det som mangler er valget, formidlingen og dataen.

En eldre variant av dette fantes i Explorer-produktets sidebar (permanent segmentkontroll med
gå/sykkel/bil, koblet til en Zustand-store). Både Explorer og storen døde i cutover 2026-07-06.
Vi gjenskaper ikke den kontrollen — vi bygger Airbnb-formen brukeren ba om.

## Requirements

**Modusvalg og oppførsel**

- R1. Boardet har én aktiv reisemodus: **gå (default), sykkel eller bil**. Gå er alltid
  utgangspunktet ved lasting. Modusen er noe brukeren aktivt velger — boardet gjetter aldri
  hvordan leseren beveger seg.
- R2. Valget gjelder **hele boardet**. Alle minutt-tall som vises leser aktiv modus:
  kategorikortenes tidsspenn (i dag «6–22 min»), stedslistene i drill-in-panelet, og
  tids-chipen på ruta.
- R3. Valget lever i økten, ikke per punkt. Velger du sykkel og åpner neste sted, står sykkel
  fortsatt. Ny sidelasting starter på gå igjen (R1) — defaulten skal aldri kunne bli borte
  for en leser som ikke selv valgte noe.
- R4. Sortering og rangering følger aktiv modus, ikke alltid gangtid. Målingen viser at dette
  er en reell omrokering, ikke kosmetikk.
- R5. Modusvalget finnes **to steder med delt tilstand**:
  (a) en chip på ruta når et punkt er åpent — kollapset viser aktiv modus + tid for det
  punktet, utvidet viser alle tre tidene med den aktive markert, og en fotnote som sier at
  tidene er omtrentlige;
  (b) i den vedvarende kart-kontrollen når ingen punkt er åpent.
  Endring på ett sted er umiddelbart synlig på det andre. Begrunnelsen for at det må være to:
  chipen eksisterer bare i `phase === "poi"`, mens kategorilistene viser minutter hele tiden —
  uten (b) er board-omfattende modus utilgjengelig før leseren har klikket et punkt.

  Anatomien, som referanse for planleggingen:

  ```
  (a) PUNKT ÅPENT — chip på ruta            (b) INGEN PUNKT ÅPENT — kart-kontrollen
                                                 (dagens BoardMapControls-pille)
      ╭──────────────────╮
      │  🚲  17 min   ⌄  │  kollapset        ╭──────────────────────────────────╮
      ╰──────────────────╯                   │  🚶  🚲  🚗  │  Kart      3D     │
              │ klikk                        ╰──────────────────────────────────╯
              ▼                                     ▲
      ╭──────────────────╮                          └── samme tilstand som chipen
      │  🚶   35 min     │
      │  🚲   17 min  ✓  │  utvidet
      │  🚗   11 min     │
      │ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │
      │  Omtrentlige     │
      ╰──────────────────╯
  ```

  Chipen sitter i dag på rutens midtpunkt (`BoardPathMidpointMarker`, bevisst valgt
  2026-04-30 for å ikke dekke POI-markøren). Den plasseringen beholdes.
- R6. Modus uten data skjules i stedet for å vises tom. Et board som bare har gangtider skal
  se ut som i dag, ikke som en ødelagt veksler.

**Reisetids-data**

- R7. Gang-, sykkel- og biltid precomputes per POI ved provisjonering, slik at et modusbytte
  ikke koster nettverkskall og aldri viser spinner. Rutegeometrien (linjen på kartet) hentes
  fortsatt live per modus — den kan ikke precomputes meningsfullt.
- R8. Eksisterende boards backfilles. Verifisert 2026-08-14: 9 boards, 1 519 POI-er, **0 med
  sykkel- eller biltid**. I tillegg mangler 147 POI-er (10 %) gangtid, konsentrert på tre
  boards — Grilstad Marina 58 % dekning, Sundsøya 53 %, Oppdal sentrum 77 %. Backfillen skal
  derfor reparere gå også, ikke bare legge til de to nye. (Kommentaren i
  `lib/board/neighbourhood-list.ts` som hevder 100 % dekning på alle mål-boards er utdatert.)
  Full jobb ≈ 128 Matrix-forespørsler.
- R9. Bolk-inndelingen i reisetids-beregningen må aldri produsere en bolk med én destinasjon.
  Verifisert 2026-08-14: Mapbox Matrix svarer `HTTP 422 — "minimum number of matrix elements
  is 2"`. Beregningen deler i bolker på 24, så boards med POI-antall 25/49/73/97 mister sitt
  siste punkts reisetid stille. Dette er årsaken til at Martin Barstads veg 23C står med
  96 av 97 (EMES Charge ladestasjon), ikke dårlige koordinater. Feilen tredobles når tre
  profiler regnes.

**Kart og rute**

- R10. Rutelinjen fra boligen til det åpne punktet følger aktiv modus. En sykkelrute er en
  annen linje enn en gangrute, og en linje som ikke matcher tallet undergraver tallet.
- R11. Chipen fungerer i begge kartmotorer (Mapbox 2D og Google 3D). Verifisert begrensning:
  i 3D er tids-merket i dag en inline-SVG inne i et Google `Marker3DInteractiveElement`, og
  templaten må inneholde `<img>` eller `<svg>` — et utvidbart HTML-panel kan ikke ligge inni
  den. Mønsteret som finnes for dette i kodebasen er HTML-overlegg posisjonert via
  `projectLatLngToScreen`, samme grep som 3D-POI-popupen bruker.
- R12. Utvidet chip kolliderer ikke med POI-popupen eller kart-kontrollen.

**Tekst-rammen**

- R13. De statiske tekstene som lover «alt i gangavstand» gjøres modus-nøytrale. Verifisert
  tre forekomster: `components/variants/report/reels/reels-data.ts:454` (hero-undertekst),
  og `components/variants/report/reels/ReportReelsPage.tsx:715` og `:726` (embed-tekster).
  Dette er allerede feil uavhengig av denne funksjonen: hero-teksten på Martin Barstads veg
  23C sier «i gangavstand» mens den reelle spredningen er 6–35 minutter.
  De **genererte** kategoritekstene (`lib/generators/bridge-text-generator.ts`, ni «i
  gangavstand»-formuleringer) og **kuratert** strøk-editorial står uendret: de beskriver
  stedet, ikke leserens valgte perspektiv, og de er sanne i begge tilfeller.

**Måling (Moat 2)**

- R14. Aktiv reisemodus bæres i kontekst-konvolutten på engagement-events, slik at vi kan
  lese hvilke reisemåter kjøpere faktisk bytter til — per strøk og per boligtype. Verifisert:
  `EngagementContextEnvelope` i `lib/instrumentation/event-types.ts:49` navngir eksplisitt
  `travel_mode` som additivt utvidelses-eksempel, og payloaden er jsonb. Dette krever derfor
  **ingen** ny event-type og **ingen** DB-CHECK-migrasjon — to-stegs-utvidelsesgrensen
  gjelder ikke her.

## Success Criteria

- På `intern_martin-barstads-veg-23c` kan leseren gå fra «Solbakken barnehage 35 min» til
  «17 min» ved å velge sykkel — uten spinner — og stedslistene reordner seg.
- Gå er det leseren møter ved hver sidelasting, hver gang, uten unntak.
- Et nyprovisjonert board har reisetid på **alle** POI-er i alle tre modus (97 av 97, ikke
  96 av 97).
- De tre boardsene med hull (Grilstad Marina, Sundsøya, Oppdal sentrum) har full
  gangtidsdekning etter backfill.
- Boards uten sykkel/bil-data ser uendret ut — ingen tom veksler, ingen ødelagt layout.
- Modusbytter er lesbare i Moat-2-dataene.
- Chipen oppfører seg likt i 2D og 3D.

## Scope Boundaries

- **Kollektiv er ikke en modus i denne omgangen.** Endepunktet finnes (`/api/entur` POST
  reiseplanlegging, bygd men uten konsument i dag), men kollektivtid er klokkeavhengig og kan
  ikke precomputes — det er en annen datasti med andre feilmoduser.
- **Ingen tidsbudsjett-filter** (5/10/15 min). `TimeBudget`-typen ligger i `lib/types.ts` som
  arv fra Explorer, men ingen board-flate bruker den, og vi gjeninnfører den ikke her.
- **POI-utvalget og radiusen endres ikke.** Boardet holder fortsatt alt innenfor by-radiusen
  (Trondheim 2 000 m, `lib/pipeline/report-defaults.ts`). Modusbytte re-rammer det samme
  settet — det henter ikke inn nye steder.
- **Ingen kategori-spesifikk modus-relevans.** «Bil til bussholdeplass» skjules ikke. Tallet
  er sant, og leseren valgte linsen.
- **Ingen ny global state-store.** Modusen hører i board-tilstanden, ikke i en gjenreist
  Explorer-store.

### Deferred to Separate Tasks

- **Modus-bevisst POI-radius** — at bil-modus utvider POI-settet utover gangavstand, slik at
  rurale boards kan vise sitt reelle nedslagsfelt («nærmeste kjøpesenter, 8 min i bil»). Dette
  er rural-asymmetri-argumentet, og det er en pipeline- og dekningsendring, ikke en
  UI-endring. Tas opp som eget spor når denne veksleren står.
- **Kollektiv som fjerde modus** — vurderes når Entur-reiseplanleggingen får sin første
  konsument.

## Key Decisions

- **Gå er default, alltid.** Boardet skal ikke gjette hvordan leseren beveger seg, og en
  megler skal aldri kunne dele et board som åpner i bil-modus og dermed underdriver avstander.
  Vekslingen er leserens aktive handling. (Andreas, 2026-08-14.)
- **Board-omfattende, ikke per punkt.** Poenget med funksjonen er å ikke avskrive et sted som
  «60 minutter å gå» når det er 15 minutter å kjøre — og det poenget ligger i listene, ikke
  bare i chipen på ett punkt. (Andreas, 2026-08-14.)
- **Gå / sykkel / bil, ikke Airbnbs gå / kollektiv / bil.** Målingen viser at sykkel er den
  modusen som gir mest ny informasjon på et norsk 2 km-board. Alle tre kan precomputes med
  motoren som allerede står. (Andreas, 2026-08-14.)
- **Chip + vedvarende kontroll, delt tilstand.** Anbefalingen ble bekreftet i brainstormen
  («ja, dette gir mening») uten at et alternativ ble valgt eksplisitt — den er ført som
  beslutning fordi hakens logikk er avgjørende: chipen finnes bare når et punkt er åpent, så
  board-omfattende modus krever en annen inngang også.
- **Precompute i stedet for live-henting.** Et modusbytte som viser spinner føles som et
  nettverkskall, ikke som et perspektiv-bytte. Tre profiler koster ~128 Matrix-forespørsler
  for hele porteføljen — kostnaden er ikke en avveining.
- **Prosaen forblir gang-rammet.** Generert og kuratert tekst beskriver stedet, ikke leserens
  linse. Bare de tre statiske «alt i gangavstand»-påstandene rettes, og de er overselg
  allerede i dag.

## Dependencies / Assumptions

- Reisetid måles alltid **fra boligen**, aldri fra kartsenteret (R6-regelen i
  `lib/board/neighbourhood-list.ts`). Modusbytte endrer ikke origo.
- Mapbox Matrix er kilden for alle tre modus. Kvote og rate-limit er ikke en reell skranke
  på dette volumet, men bolkingen må fikses først (R9).
- Antatt, ikke verifisert: at gangtids-hullene på Grilstad Marina, Sundsøya og Oppdal skyldes
  at POI-er er lagt til etter at reisetids-steget kjørte (re-provisjonering med `--update`),
  ikke at Matrix ikke klarer å rute til dem. Årsaken avgjør om backfill alene er nok.

## Outstanding Questions

### Deferred to Planning

- [Gjelder R5][Teknisk] Hvor bor modusvelgeren på mobil? Kart-kontrollen (`BoardMapControls`)
  er kollapset bak et ⚙-ikon på mobil i dag, og et modusvalg bak et tannhjul finner ingen.
  Nabolags-sheetens header — der minuttene faktisk leses — er den åpenbare kandidaten, men
  det er en adaptiv-layout-avgjørelse som hører i planleggingen.
- [Gjelder R11][Teknisk] Utvidet chip i 3D: HTML-overlegg via `projectLatLngToScreen`, eller
  la chipen forlate kartflaten i 3D-modus?
- [Gjelder R4][Teknisk] Skal også **kategori-rekkefølgen** re-sorteres (i dag «nærmeste
  kategori først»), eller bare stedslistene innenfor hver kategori?
- [Gjelder R8][Teknisk] Backfill via `create-report --update` per board, eller eget
  backfill-script? Avhenger av årsaken til gangtids-hullene (se Dependencies).
- [Gjelder R2][Teknisk] Dekningsbrøken «9 av 17 synlig» er viewport-basert, ikke
  tidsbasert — bekreft at modusbytte ikke skal endre den, bare tidsspennet ved siden av.

## Next Steps

-> `/ce-plan` for strukturert implementeringsplanlegging
