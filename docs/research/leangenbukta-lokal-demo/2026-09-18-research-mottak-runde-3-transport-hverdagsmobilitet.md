# Leangenbukta – mottak av kategoriresearch, runde 3: transport og hverdagsmobilitet

Mottatt fra Andreas i samtalen 18.09.2026 som resultat av den bestilte researchen. Rapporten er bevart ordrett i `docs/research/leangenbukta-lokal-demo/raw/2026-09-18-opus-transport-hverdagsmobilitet-runde-3.md`. Originalen skal ikke rettes; kildekontroll, normalisering og importbeslutninger føres separat.

## Bruk i masterplanen

Rapporten er kandidatgrunnlag for kategorien Transport i U6 i `docs/plans/2026-09-18-1124-feat-leangenbukta-board-master-plan.md`. Den inneholder også prosjektfakta om parkering, lading og bildeling som overlapper U5. Disse skal kobles til de samme prosjektobjektene og kildepåstandene, ikke kopieres som et separat transportsett.

Ingen opplysning er importert til runtime-data. Kilde-URL-ene er ikke åpnet på nytt i denne mottaksrunden. Rapportens «Dokumentert», «I drift», «Gjeldende» og kontrolldato er derfor forfatterens vurderinger. Transportdata må i tillegg klassifiseres etter hvor raskt de endres.

## Mottatt dekning

- 268 linjer og 35 762 tegn rårapport.
- 39 rader i den strukturerte faktatabellen.
- 13 foreslåtte kartpunkter.
- 11 foreslåtte kjøperspørsmål.
- 16 eksplisitte kunnskapshull.
- 20 spørsmål fordelt på utbygger, AtB, Bane NOR/SJ og kommune/Miljøpakken/Statens vegvesen.
- Seks delområder: kollektiv, tog, gange, sykkel, bil/parkering og tilgjengelighet/vinter.

Dette er mottaksdekning, ikke atomært faktaregnskap. Flere tabellrader inneholder linje, stopp, status, tid, tilgang og kilde som må deles i selvstendige påstander før endelig X-av-Y-kontroll.

## Kontrollpunkter før kuratering og import

| ID | Observasjon i rapporten | Behandling før import |
|---|---|---|
| T1 | `Haakon VIIs gate 14` brukes som foreløpig prosjektpunkt. | Fastsett faktisk inngang/rutestart for beboere før gang-, sykkel- eller bilruter beregnes. Et adressepunkt eller tomtesentrum skal ikke få inngangspresisjon. |
| T2 | Holdeplass- og linjegrunnlaget kommer delvis fra trafikkanalyser for nr. 4 og 27/27B. | Bruk analysene som historiske kandidatkilder. Avstander, nærmeste holdeplass, adkomst og eiendomsspesifikke trafikkforhold kan ikke overføres til nr. 14. |
| T3 | En arrangementsartikkel fra AtB i juni 2026 brukes til å bekrefte det ordinære linjebildet. | Kontroller gjeldende stoppmønster direkte i AtB/Entur/NeTEx. Et arrangementsopplegg kan ha ekstrabusser, omkjøringer eller et annet stoppmønster enn normal drift. |
| T4 | «Haakon VIIs gate 25» kan leses både som adresse og holdeplassnavn; ingen plattformside eller stopp-ID er registrert. | Hent offisiell stoppesteds-ID og plattform/quay per retning. Kart, rute og gangtid skal bruke korrekt plattform, ikke et gatenavn eller stoppområdets sentrum. |
| T5 | Linje 13/20 ved Leangenbukta og linje 2/15 ved Haakon VIIs gate 25 er støttet av 2022-analyse og delvis 2026-arrangementsinformasjon. | Før inn bare etter direkte kontroll av gjeldende ruteplan. Bevar gyldighetsperiode og dato for neste kjente ruteendring. |
| T6 | Formuleringen «særdeles god tilgang til kollektivtransport» er hentet fra analyse av en naboeiendom. | Ikke importer som Placy-vurdering. Presenter konkrete stopp, linjer og ruter når disse er kontrollert. |
| T7 | Frekvenstabellen er fra 24.08.2022, men brukes i et foreslått kjøpersvar. | Ikke bruk tallene i runtime-demoen. De kan beholdes som historisk research, mens dagens frekvens må hentes fra gjeldende ruteplan og knyttes til retning, dagstype og tidsrom. |
| T8 | Nattbussteksten sier at «alle busser unntatt 112 og 114» går hvert 30. minutt, men ingen nattlinje for Lade/Leangen er identifisert. | Kontroller original ordlyd og konkrete nattlinjer/stopp. Ikke la teksten forstås som at ordinære linjer 2, 13, 15 og 20 kjører om natten. |
| T9 | Direkte forbindelser til sentrum, Strindheim, Lerkendal og Grilstad angis på linjenivå. | Kontroller per holdeplass og retning. «Lerkendal» er ikke automatisk dør-til-dør-forbindelse til Gløshaugen, og linjenavn alene gir ikke reisetid eller gangetappe. |
| T10 | Rutetid og sanntid er riktig skilt, men sanntid nevnes som mulig kunnskap. | Den lokale demoen bør bruke kontrollert rutetabell eller tydelig datert eksempel. Ikke lagre dynamisk sanntid som varig boardfakta uten egen live-integrasjon. |
| T11 | Metrobusstrasé langs Haakon VIIs gate klassifiseres som planlagt/delfinansiert og ikke bygd ut fra en analyse fra 2023. | Hent nåværende prosjektstatus fra byvekstavtale/Miljøpakken. Finansieringsstatus i 2023 dokumenterer ikke status i september 2026. |
| T12 | Arrangementsstenging kl. 22.30–23.30 beskrives detaljert. | Behandle som betinget arrangementsinformasjon med hendelsesdato, ikke permanent nabolagsfakta. Den er kun relevant når det faktisk er et arrangement med varslet stenging. |
| T13 | Leangen stasjon kobles til R70 og retningene Trondheim, Lerkendal og Steinkjer. | Kontroller hvilke avganger som faktisk stopper, endestasjoner og eventuelle togbytter i gjeldende Entur/SJ-ruteplan. En stasjonsside med retninger er ikke en full rutetabell. |
| T14 | Heisen ved Leangen stasjon er ute av drift per 18.09.2026. | Dette er svært flyktig driftsstatus. Bruk bare med tydelig `kontrollert_dato`, kort utløp og krav om ny kontroll før demo; ikke gjør den til permanent stasjonsegenskap. |
| T15 | Kjøpersvaret sier kategorisk at stasjonen ikke er tilgjengelig med barnevogn/rullestol fordi heisen er ute. | Bekreft at det ikke finnes alternativ trinnfri plattformadkomst. Skill midlertidig heisavvik, stasjonens grunnutforming og reisendes konkrete behov. |
| T16 | HC-parkering 300 meter unna, plattformmål og gangveg uten rekkverk samles under stasjonen. | Registrer fasiliteter separat med posisjon og tilgang. Avstand til plattform må kontrolleres som faktisk rute, ikke bare oppgitt omtrentlig avstand. |
| T17 | Rotvoll stasjon er ikke undersøkt, men nevnes som neste stasjon. | Ikke opprett POI eller reiseråd utover et eksplisitt kunnskapshull før primærkilder er kontrollert. |
| T18 | Avstanden 3,49 km fra Trondheim S er jernbanens kilometrering. | Ikke bruk den som gangavstand, avstand fra boligen eller reisetid. Den kan utelates fra kjøpersvaret om tid til sentrum. |
| T19 | Rundkjøringen omtales som tidligere ulykkespunkt og ferdig oppgradert. | Historisk risikobeskrivelse og gjennomført tiltak svarer ikke på om dagens konkrete skole-/holdeplassrute er trygg. Behold som anleggshistorikk eller utelat fra kjøperrettet svar. |
| T20 | Inn-/utkjøring over fortau og sykkelfelt ved nr. 27/27B omtales i gangdelen. | Ikke overfør til prosjektets adkomst ved nr. 14. Bruk først når situasjonsplan og faktisk inngang er kontrollert. |
| T21 | Hovedsykkelvegens 7 meters bredde, fravær av kryssende biltrafikk og små høydeforskjeller presenteres samlet. | Kontroller om egenskapene gjelder prosjektstandarden eller hver ferdig delstrekning. Representer trasé og egenskaper per segment; unngå universelle påstander om hele reisen. |
| T22 | Forventede 2 000 syklister per døgn og framtidig sammenheng brukes i bakgrunnsteksten. | Bevar som prognose med kilde og forutsetning eller utelat. Det er ikke nåstatus eller direkte kjøpernytte. |
| T23 | Åpnede sykkeletapper er oppgitt med dato, mens Strandveien–Gildheim/Pirbrua står som usikker. | Kartlegg faktisk sammenhengende geometri og påkobling fra prosjektet. En liste over ferdige etapper beviser ikke en sammenhengende rute fra boligen. |
| T24 | Bysykkel har 66, 67 eller over 70 stasjoner, og stasjonene kan flyttes. | Ikke bruk totaltallet som beslutningskritisk fakta. Dynamiske dokker bør ikke være faste kartpunkter; vis eventuelt tjenesten som tema og hent nærmeste aktive stasjon ved demonstrasjon. |
| T25 | Bysykkelens sesong, åpningstid og AtB-fordel er ferskvare. | Knyt alle tre til konkret kilde og gyldighetsdato. Kontroller før publisering eller tale; ikke generaliser «mars–desember» uten operatørens aktuelle sesongmelding. |
| T26 | P-kjeller, over 1 000 sykkelplasser og lading gjentas fra runde 1 som etablert trinnvis. | Følg kontrollpunktene K8/K12 fra runde 1. Skill planlagt total, levert kapasitet, tilgang per byggetrinn og faktisk operativ lading. |
| T27 | «Minimum 0,5 bilplass per boenhet» gjentas uten ny direkte kontroll av bestemmelsen. | Kontroller ordlyd, om normen er minimum/maksimum og hvilke bolig-/gjesteplasser den gjelder før bruk. Ikke la gjentakelse i flere rapporter telle som uavhengig bekreftelse. |
| T28 | APCOA-anlegget i nr. 27 føres under offentlig parkering. | Klassifiser som privat kommersiell parkering dersom det faktisk er allment tilgjengelig. Ikke bland med kommunal gateparkering eller prosjektets beboerparkering. |
| T29 | Bilførerandel 26 % fra RVU 2018/2019 beskrives som «i området». | Identifiser geografisk sone og formål før eventuell bruk. Historisk områdestatistikk har liten verdi som kjøperfakta og bør normalt utelates. |
| T30 | En avkortet setning om ulykkesdata nevnes. | Ikke importer eller parafraser før full originaltekst og konklusjon er lest. |
| T31 | Oppsummering og kjøpersvar sier at bom 59 og/eller 60 passeres mot sentrum eller E6, mens detaljdelen sier at konkret bommønster ikke er beregnet. | Dette er en intern konflikt. Behold bomstasjoner og satser som kandidater, men knytt ingen bom til en destinasjon før en bestemt bilrute fra riktig utkjøring er beregnet. |
| T32 | Bomtakster, rushperioder, timesregel og månedstak er detaljerte og aktuelle per 08.09.2026. | Behandle som pris-/regeldata med kort gyldighet og ny kontroll før demo. Bevar vilkår om avtale/brikke; ikke la en passert dato automatisk videreføre satsene. |
| T33 | Tilleggsbomsnitt mot E6 sør/øst omtales uten beregnet rute. | Ikke bruk i FAQ før rute og faktisk passering er dokumentert. Et generelt reisemål som «E6» er ikke presist nok. |
| T34 | Rundkjøringens sentrum, bommer og en hel sykkeltrasé foreslås som likeartede kartpunkter. | Skill `stop_platform`, `station_entrance`, `parking`, `bridge`, `route_segment`, `junction` og `toll_point`. En trasé bør være linje/tema, og rundkjøringssenteret er ikke et naturlig brukerpunkt. |
| T35 | Ingen av transportpunktene har primærkildeverifiserte koordinater, og flere URL-er bruker `...` eller «samme som over». | Hent fulle URL-er og stabile ID-er. Bruk Entur/NeTEx for stopp/plattform, autoritativ stasjons-/kartkilde for innganger og Vegamot/NVDB for bompunkt. |
| T36 | Kjøpersvaret «Kan jeg ta toget til jobb?» svarer ja uten å vite arbeidssted eller aktuell avgang. | Svar med hvilke retninger som kan undersøkes og be om reisemål; ikke lov en praktisk arbeidsreise uten rutetid og siste gangetappe. |
| T37 | «Alle busser har lave innganger og ramper» kommer fra Visit Trondheim og gjelder kjøretøy, ikke stopp. | Bruk AtB som primærkilde hvis dette skal med. Skill kjøretøytilgang fra plattform, kantstein, leskur og gangrute til holdeplassen. |
| T38 | Rapporten avstår fra å kalle rutene trygge, barnevognvennlige eller universelt tilgjengelige. | Behold denne grensen. Slike egenskaper må dokumenteres for konkret rute og aktuell driftsstatus. |
| T39 | Stabil infrastruktur, rutetabeller, live driftsavvik og priser står i samme faktatabell. | Gi påstander en aktualitetsklasse: `stable`, `scheduled`, `live_status` eller `price_rule`, med kontroll- og eventuell utløpsdato. Dette hindrer at en gammel heisfeil eller takst fremstår som evig fakta. |
| T40 | Rapporten anbefaler ikke reisetider uten dokumentert ruteberegning. | Behold regelen. Hver tid må lagre startpunkt, endepunkt, transportmåte, beregningskilde og beregningsdato. |

## Foreløpig behandlingsretning

Etter senere kontroll er følgende gode kandidater for Transport-kategorien:

- Offisielle holdeplasser og plattformer med Entur-ID, retning og faktisk gangadkomst fra prosjektet.
- Leangen stasjon med korrekt inngang, gjeldende togtilbud og separat, tidsbegrenset driftsstatus for heis.
- Hangarbrua og påkobling til hovedsykkelruta når rutegeometrien fra prosjektet er kontrollert.
- Prosjektets faktiske innkjøring, beboerparkering, sykkelparkering, lading og bildeling per byggetrinn.
- Bomstasjoner og regler som datert FAQ-/temakunnskap når konkrete bilruter er kontrollert.

Følgende bør ikke importeres slik rapporten står: frekvenstall fra 2022, evalueringen «særdeles god», naboenes avstander/adkomstproblemer, den avkortede ulykkeskonklusjonen, bilførerandel 26 %, generiske nattbussutsagn og faste bysykkelmarkører.

Flyktige fakta som heisstatus, priser, rutetider og bysykkeldokker kan bare brukes med synlig datostempel og en definert rutine for ny kontroll. De bør ikke blandes med stabile fakta som stasjonsplassering eller at en bro er åpnet.

## Dekning og videre arbeid

Hele rapporten er lest. Alle 39 faktatabellrader, 13 kartkandidater, 11 kjøperspørsmål, 16 kunnskapshull og 20 avklaringsspørsmål er omfattet av vurderingen. Det er registrert 40 kontrollpunkter. Ingen påstand er uavhengig kildeverifisert eller importert i denne mottaksrunden.

Neste bearbeiding må først hente offisielle stopp-/plattform-ID-er og gjeldende ruter, fastsette prosjektets faktiske startpunkt og skille stabile data fra ferskvare. Deretter kan hver kandidat få beslutningen `importer`, `tema uten kartpunkt`, `flyktig – krev ny kontroll`, `utsett` eller `utelat`, med begrunnelse.
