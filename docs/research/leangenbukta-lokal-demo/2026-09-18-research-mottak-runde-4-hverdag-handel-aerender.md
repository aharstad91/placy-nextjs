# Leangenbukta – mottak av kategoriresearch, runde 4: hverdag, handel og ærender

Mottatt fra Andreas i samtalen 18.09.2026. Rapporten er bevart ordrett i `docs/research/leangenbukta-lokal-demo/raw/2026-09-18-opus-hverdag-handel-aerender-runde-4.md`. Originalen skal ikke rettes; kildekontroll, normalisering og importbeslutninger føres separat.

## Bruk i masterplanen

Rapporten er kandidatgrunnlag for Hverdag i U6 i `docs/plans/2026-09-18-1124-feat-leangenbukta-board-master-plan.md`. Opplysninger om næringslokaler overlapper U5 og skal kobles til eksisterende prosjektobjekter. Serveringssteder, helse og retur/gjenbruk kan gi kandidater til andre kategorier, men skal ikke dupliseres som uavhengige kartpunkter.

Ingen data er importert. Kildene er ikke åpnet på nytt i denne mottaksrunden. Rapportens sikkerhetsnivå, koordinater og kontrolldato er dermed forfatterens vurderinger.

## Mottatt dekning

- 191 linjer og 24 190 tegn rårapport.
- 18 kandidatrader i faktatabellen.
- 3 kjøpesentre med medlemsoversikt.
- 7 foreslåtte kartpunkt/ankre når Post i Butikk tas med.
- 9 foreslåtte kjøperspørsmål.
- 7 eksplisitte kunnskapshull og 5 avklaringsspørsmål.
- 32 kildeoppføringer.

## Kontrollpunkter før kuratering og import

| ID | Observasjon i rapporten | Behandling før import |
|---|---|---|
| H1 | Rapporten sier at Meny Lade har lengst hverdagsåpent 08–22, mens Rema Lade Arena oppgis 07–23. | Dette er en intern faktafeil. Fjern sammenligningen; Rema har lengre oppgitt åpningstid dersom tidene stemmer. |
| H2 | Området beskrives som et av Trondheims «tetteste handelsområder» og nesten alle ærender sies å kunne gjøres der. | Ikke importer vurderingen uten målestokk. Presenter dokumenterte tilbud og la brukeren vurdere dekningen. |
| H3 | Fem butikker kalles fullsortimentsbutikker. | Kontroller kjedenes egen butikkstype. Bruk heller nøytralt «dagligvarebutikk» når sortimentsklasse ikke er dokumentert. |
| H4 | Ingen stor butikk i «umiddelbar nærhet» er dokumentert søndagsåpen, men kandidatgrunnlaget er ikke uttømmende og Rema har motstrid. | Formuler som «ikke bekreftet i gjennomgåtte kandidater». Ikke konkluder med at søndagsåpen dagligvare mangler før offisielle filialkilder og et definert område er kontrollert. |
| H5 | Meny Lade bygger på katalogsidene alletilbudsaviser og ernær, ikke offisiell Meny-side. | Status, adresse og åpningstid må kontrolleres hos Meny/NorgesGruppen før import. |
| H6 | Rema Lade Arena bygger hovedsakelig på 1881 og Hotfrog, mens `rema.no` nevnes uten full filialkilde. | Finn offisiell filialside. Hotfrog skal ikke veie likt med primærkilden; søndagsstatus forblir uavklart. |
| H7 | Bunnpris har offisiell kilde og katalogmotstrid. | Prioriter offisiell filialside med kontrolldato. Bevar katalogavvik kun i audit, ikke som likeverdig runtime-fakta. |
| H8 | Restaurantene DIGG, Dromedar og Krem brukes i svar om søndagsåpen dagligvare. | Hold spørsmålet om dagligvare rent. Flytt serveringsåpning til Servering-runden. |
| H9 | Senterantall, omsetning, areal og parkeringsplasser kommer delvis fra Wikipedia og gamle år. | Disse tallene gir liten kjøperverdi og kan være foreldet. Utelat med mindre offisiell, aktuell kilde og tydelig bruk finnes. |
| H10 | Medlemslistene er utvalg, men kan leses som komplette. | Merk dem som «dokumenterte relevante medlemmer», med kilde per medlem og kontrolldato. Ikke bruk antallet som full dekningspåstand. |
| H11 | City Lade sies å ha to apotek, mens Apotek 1 Elefanten bare har 1881-kilde og uavklarte tider. | Bekreft medlemskap og driftsstatus hos City Lade/Apotek 1 før påstanden «to apotek» brukes. |
| H12 | LadeTorget omtales som senter, men mangler egen kandidatrad og medlemsoversikt; Boots foreslås som separat kartpunkt. | Velg konsekvent modell: LadeTorget som senteranker med Boots/Rema/Post som medlemmer, eller dokumenter hvorfor en virksomhet trenger eget punkt. |
| H13 | Post i Butikk foreslås både som medlem og eget kartpunkt, selv om prompten ber om få, redaksjonelle markører. | Bruk senter/butikk som kartanker når hentepunktet ligger inne. La Anja kjenne tjenesten uten en ekstra markør, med mindre brukerflyten krever den. |
| H14 | Postpunktene bygger delvis på 1881; åpningstid antas å følge vertbutikken. | Kontroller i Postens egen lokasjonssøker. Posttjenestens åpningstid og innleveringsfrist kan avvike fra butikkens. |
| H15 | «Nærmeste PostNord-terminal» på Torgård brukes uten rutesammenligning, og terminal er ikke nødvendigvis forbrukerens hentepunkt. | Utelat. Undersøk offisielle pakkeshops/pakkebokser som faktisk er tilgjengelige for mottakere. |
| H16 | Instabox/Helthjem «ikke dokumentert» er korrekt kunnskapshull. | Bevar som uavklart, ikke som fravær. Dynamiske hentepunkter krever aktuell operatørkontroll. |
| H17 | Alle 18 koordinater mangler eksplisitt koordinatkilde i tabellen. | Ingen markør er kartklar. Hent primær/autorativ kartkilde og skill senteranker, hovedinngang og virksomhetsinngang. |
| H18 | «Via City Lade», «flere innganger» og «info i P1» er ikke faktiske inngangspunkter. | Kartfest konkret inngang som passer gangruten fra prosjektet. Parkerings-/infosenter er ikke automatisk riktig fotgjengerinngang. |
| H19 | Senteret og medlemsbutikkene har forskjellige koordinater, men rolle og presisjon er ikke forklart. | Bruk ett anker per senter og medlemsrelasjoner. Ikke gi innendørs medlemmer falsk GPS-presisjon. |
| H20 | Kildetabellen bruker domener som `obs.no` i stedet for kilde-ID/full URL, selv om full kildeoversikt finnes senere. | Normaliser til kilde-ID-er som peker på full URL, kildedato og kontrolldato. |
| H21 | Faktatabellen mangler kildens dato, kontrolldato og koordinatkilde som prompten krevde. | Fyll feltene før kandidat kan godkjennes. Kildeoversikten alene gir ikke entydig rad-til-påstand-kobling. |
| H22 | Åpningstider er tidsfølsomme, men kjøpersvarene presenterer dem uten «kontrollert per»-formulering. | Lag datert visning eller utelat eksakte tider fra tale når ny kontroll ikke kan garanteres. Høytidsåpning må aldri utledes fra ordinære tider. |
| H23 | «City Lade samler alt på ett sted» svarer kategorisk ja. | Svar konkret hvilke dokumenterte funksjoner som finnes. «De viktigste» avhenger av brukerens ærender. |
| H24 | Vinmonopol og apotek er gode medlemsfakta, men bør normalt ikke gi doble markører. | Behold som medlemmer av senterankeret og som søkbare fakta for Anja. |
| H25 | Returpunktet er uidentifisert; NærOm/BrukOm nevnes uten kontrollert relevans eller rute. | Ikke opprett kartpunkt. Undersøk prosjektets renovasjonsløsning og kommunens faktiske returpunkter før svar om hvor beboeren leverer avfall. |
| H26 | Husstandsbeholder for glass/metall nevnes generelt. | Kontroller om ordningen gjelder Leangenbukta/sameiet og hvordan felles avfallsløsning faktisk fungerer. |
| H27 | Næringslokalet i Bygg E/H og hjørnebygget kan være samme eller ulike objekter; rapporten knytter ikke aliasene sikkert. | Bruk objekt-/aliasoversikten fra runde 1. Ikke opprett flere planlagte næringsobjekter før situasjonsplan og kilder viser skillet. |
| H28 | Omtrentlig koordinat for `LB-01` mangler kilde og kan forveksles med prosjekt-/stasjonsområdet. | Planlagt lokale skal være tema uten markør til bygg og inngang er kartfestet. |
| H29 | Lounge som «kan fungere som kafé» er riktig skilt fra kommersiell kafé, men eierskap/adgang gjentas fra runde 1. | Koble til samme fasilitetsobjekt og behold status/adgang separat. Ikke dupliser påstanden. |
| H30 | Nye Leangen/Løkka nevnes for å hindre prosjektforveksling. | Behold som eksklusjonsregel i researchloggen, ikke som Leangenbukta-tilbud. |
| H31 | Kategoriene `Transport/Hverdag` og `Natur/Hverdag` brukes som fritekst. | Velg én primær Placy-kategori per objekt og eksplisitte sekundærkoblinger; unngå nye sammensatte kategorinavn. |
| H32 | Rapporten har gode kandidat-ID-er, men de dekker ikke LadeTorget, Lade legesenter, pakkeboks eller Rema Liljendal. | Alle kandidater må få beslutning og stabil ID, også når beslutningen er `utsett` eller `utelat`, for fullstendig dekningsregnskap. |

## Foreløpig behandlingsretning

Gode senterankre etter kilde- og inngangskontroll er City Lade, Sirkus Shopping, Lade Arena og eventuelt LadeTorget. Dagligvare, apotek, Vinmonopol og Post i Butikk inne i sentrene bør i hovedsak være medlemmer, søkbare for Anja uten doble kartmarkører. Meny Lade og Bunnpris Lade kan vurderes som selvstendige punkter etter offisiell kontroll og ruteberegning.

Følgende skal ikke inn slik rapporten står: påstanden om Menys lengste åpningstid, konklusjon om manglende søndagsbutikk, katalogbaserte åpningstider, uverifiserte koordinater, gammelt senterareal/omsetning, «nærmeste PostNord-terminal» og uidentifisert returpunkt.

## Dekning og videre arbeid

Hele rapporten er lest. Alle 18 kandidatrader, 3 sentertabellrader, 7 kartforslag, 9 kjøperspørsmål, 7 kunnskapshull, 5 avklaringsspørsmål og 32 kildeoppføringer er omfattet. Det er registrert 32 kontrollpunkter. Ingen påstand er uavhengig kildeverifisert eller importert i denne mottaksrunden.

Neste behandling må etablere full rad-til-kilde-kobling, hente offisielle filialkilder, kartfeste faktiske innganger og velge senteranker versus medlemsobjekt konsekvent.
