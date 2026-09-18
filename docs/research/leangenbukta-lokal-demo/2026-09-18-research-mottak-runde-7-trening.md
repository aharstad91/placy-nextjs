# Leangenbukta – mottak av kategoriresearch, runde 7: trening

Mottatt fra Andreas i samtalen 18.09.2026. Rapporten er bevart ordrett i `docs/research/leangenbukta-lokal-demo/raw/2026-09-18-opus-trening-runde-7.md`. Originalen skal ikke rettes; kildekontroll og importbeslutninger føres separat.

Rapporten er kandidatgrunnlag for Trening i U6 i masterplanen. Ingen data er importert, og kildene er ikke åpnet på nytt i denne mottaksrunden.

## Mottatt dekning

- 543 linjer og 72 274 tegn rårapport.
- 18 kandidatrader.
- 7 foreslåtte kartankere.
- 16 kjøperspørsmål.
- 19 uttrykkelige kunnskapshull.
- 26 avklaringsspørsmål fordelt på fem mottakergrupper.
- 60 URL-oppføringer i rapportens kildeoversikt.

## Kontrollpunkter før import

| ID | Observasjon | Behandling før import |
|---|---|---|
| T1 | Området beskrives som å ha «usedvanlig tett treningsinfrastruktur». | Dette er en subjektiv sammenligning uten definert geografisk eller statistisk grunnlag. Vis konkrete tilbud uten tetthetskarakteristikk. |
| T2 | Rapporten omtaler to store kommersielle kjeder og flere avdelinger. | Kjedestørrelse og komplett marked er ikke dokumentert. Modellér de verifiserte filialene enkeltvis. |
| T3 | Fresh Fitness' egen side sier at Lade Arena ikke skulle være i drift etter 01.02.2026, mens kataloger fortsatt viser åpningstider. | Primærkildens nedleggelsesvarsel veier langt tyngre enn trege kataloger. Behandle som stengt/arkivert kandidat etter én aktuell kontroll, aldri som aktiv markør. |
| T4 | Fresh Fitness-tabellen beholder åpningstid og fasiliteter som om senteret var i drift. | Eventuelle tider og fasiliteter skal merkes historiske, ikke `stable` eller aktuelle. |
| T5 | Fresh Fitness' kjedepriser brukes sammen med en filial som kan være stengt. | Kjedeprodukt og filialstatus er separate påstander; ingen pris knyttes til Lade Arena. |
| T6 | 3T-Lade omtales som eneste dokumenterte senter med bemanning hele åpningstiden. | Unngå eksklusivitetsutsagn basert på et ikke-uttømmende kandidatsett. Bevar den konkrete bemanningspåstanden med dato. |
| T7 | 30-minuttersregelen før stengetid hentes fra 3T-Midtbyen. | Ikke overfør en annen filials regel til 3T-Lade uten kjedeomfattende eller filialspesifikk kilde. |
| T8 | 3T-prisene er kampanjepriser med binding og betalingsdato. | Importer bare som tidsbegrenset pristilbud med alle vilkår og utløpsdato, eller utelat prisen fra varig faktagrunnlag. |
| T9 | 3Ts tekst om spa og basseng gjelder «utvalgte sentre». | Ikke knytt basseng eller spa til Lade før filialens fasilitetsliste bekrefter det. |
| T10 | Impulse oppgir 05–24 generelt, mens Leangens betjente tider kommer fra en gammel side. | Kontroller adgangstid per filial og hent aktuelle bemannede tider; ikke bland kjedeinformasjon og filialinformasjon. |
| T11 | Impulse-prisen er «fra 329 kr» uten produktvilkår. | Ikke sammenlign pris eller kalle senteret rimeligere før binding, innmelding, tilgang og ordinær pris er kjent. |
| T12 | FITcert-sertifisering nevnes som kjedekontekst. | Dette gir liten boligkjøperverdi og skal ikke importeres uten klart brukerbehov. |
| T13 | Katalogkandidater inkluderer klinikk, eldre gymnavn og mulig duplikat. | Behold dem bare i researchloggen. Krev offisiell virksomhetsside og dagens drift før objekter opprettes. |
| T14 | Treningsrommet i Knutepunktet beskrives som «ikke ferdigstilt» fordi ferdigstillelse ikke er dokumentert. | Tryggere status er «ferdigstillelse og åpning ikke verifisert». Manglende funn beviser ikke fysisk status. |
| T15 | Ekstern adgang til beboertreningsrommet settes til nei/stabilt fordi ingen kilde antyder den. | Fravær av omtale er ikke adgangsregel. Bruk «kun beboeradgang beskrevet; gjeste-/ekstern adgang uavklart» til vedtekter bekrefter. |
| T16 | «Alle beboere i reguleringsplanområdet» tolkes som alle sameier. | Kontroller realsameiets vedtekter, eventuelle seksjonsgrenser og kostnadsfordeling før Anja lover adgang til alle. |
| T17 | Utbyggerens «inkludert i felleskostnadene» overføres delvis mellom byggetrinn. | Knytt påstanden til salgsoppgaven/sameiet den gjelder. Ikke generaliser til samtlige boliger. |
| T18 | Ingen utstyrsliste, åpningstid eller adgangsløsning finnes for prosjektets treningsrom. | Bevar bare eksistens som planlagt fellesfasilitet; ingen kvalitets-, kapasitets- eller erstatningspåstand. |
| T19 | Leangen idrettsparks helgeåpning står som «21:00/22:00». | En tvetydig tid er ikke importerbar. Finn dagsspesifikk gjeldende åpningstid. |
| T20 | Kunstisbanen omtales som det tydeligste/best dokumenterte gratistilbudet. | Fjern rangeringen. Bevar gratis publikumstid med gjeldende sesong og driftsforbehold. |
| T21 | Publikumstid på kunstisbanen er presis på hverdager, men variabel kveld og helg. | Modellér faste og variable økter separat og lenk til aktivitetskalender; ikke lov kvelds-/helgetid. |
| T22 | Kølle og puck har konflikt mellom kommunen og sekundærkilde. | Bruk kommunens aktuelle regel, men kontroller den på nytt for sesongen før publisering. |
| T23 | Sesongrammen 2025/2026 var utløpt ved kontrolldato 18.09.2026. | Ikke importer den som kommende sesong. Hent 2026/2027-planen for åpning, sommeris og vedlikehold. |
| T24 | Sesongslutt oppgis som ca. 10. eller 15. mars og er væravhengig. | Bruk omtrentlig sesong og «sjekk driftsmelding», ikke en eksakt sluttdato. |
| T25 | «Åpen hall» dokumenteres som ordning, men konkrete haller, tider og påmelding mangler. | Ikke svar at man faktisk kan spille fotball/håndball lokalt uten medlemskap før aktiv hall og tid er verifisert. |
| T26 | En åpen kalender skilles riktig fra fri publikumsadgang. | Bevar dette som generell regel for Anja og som egen adgangstype i datamodellen. |
| T27 | Lade idrettspark beskrives fra en kommunal nyhetssak fra 2018. | Bruk den som historikk/kandidatliste. Bekreft dagens delanlegg, driftsansvar og adgang hos hver operatør. |
| T28 | Kommunalt grunneierskap kan leses som offentlig bruk. | Skill grunneier, anleggseier, driftsoperatør, booking og fri adgang per delanlegg. |
| T29 | Lade Tennisarena bygger på Facebook og kan være samme anlegg som Lade Sportsarena. | Avklar juridisk/fysisk objekt, dagens navn, inngang og bookingsystem før opprettelse. |
| T30 | Navnene Leangen Ishall, Leangen Arena og Leangen Ungdomshall blandes. | Opprett separate, autoritative anleggsobjekter og kartgeometri før aktiviteter og kalender knyttes til dem. |
| T31 | Wikipedia-fakta om ishallkapasitet og hjemmebane brukes som anleggsfakta. | Erstatt med kommune, halloperatør eller klubb før import. Kapasitet er sekundært for demoen. |
| T32 | SK Trygg/Lades medlemstall kan være udatert selv på klubbens side. | Bevar bare med publiserings-/kontrolldato og ikke bruk som popularitetsmål. |
| T33 | Allidrett «åpent for alle» tolkes som utprøvingstilbud. | Skill målgruppe, rett til prøvetime, påmelding, kapasitet og faktisk ledig plass. |
| T34 | Medlemsavgiften er merket 2023, mens aktivitetsavgiften gjelder 2025/2026. | Ikke kombiner dem til dagens totalkostnad. Hent satsene for samme sesong. |
| T35 | Trygg/Lade-hallens styrkerom oppgis til 200 kr/mnd pluss medlemskap. | Kontroller gjeldende pris, alderskrav, åpningstid, binding og om prøveadgang finnes. |
| T36 | Tabellen setter drop-in til «Nei» for styrkerommet. | Medlemskravet dokumenterer ordinær adgang, men ikke nødvendigvis alle prøveordninger. Formuler «medlemsadgang dokumentert; drop-in ikke funnet». |
| T37 | Sandvolleyballklubben oppgis å ha tilbud for alle aldersgrupper. | Kontroller konkrete grupper, inneværende sesong, medlemsvilkår og treningssteder før import. |
| T38 | Konklusjonen «ingen offentlig svømmehall dokumentert på Lade» er riktig avgrenset til funn. | Bevar som manglende dokumentert lokalt tilbud, ikke som absolutt fravær. |
| T39 | Husebybadet tas med langt utenfor hovedområdet. | Bruk primært som svar på behovet offentlig svømming; vurder om det skal være kartpunkt eller ekstern referanse i et lokalt board. |
| T40 | Husebybadets omfattende tider og priser er svært tidsfølsomme. | Knyt hver regel til kommunens dato og oppfrisk før demo; driftsavvik skal ha utløp. |
| T41 | Pirbadets publikumstilbud er ikke undersøkt, selv om stedet nevnes som alternativ. | Ikke sammenlign Huseby og Pirbadet eller velg Huseby som eneste anker før Pirbadets primærkilder er kontrollert. |
| T42 | A4 Arena annonseres åpnet i 2026, men status er ikke bekreftet. | Behold `planned/unresolved`; ikke vis som aktivt svømmetilbud. |
| T43 | Ladestien omtales igjen som å gå gjennom prosjektet i dag. | Samordne med Natur-notatet: skill eksisterende trasé/adkomst, 2017-omlegging og planlagt intern o_GT/Ladesti-trasé. |
| T44 | Rapporten sier vinterdrift på Ladestien ikke er dokumentert, mens Natur-runden fant at deler vinterbrøytes. | Bevar konflikten og finn nøyaktig strekning før Anja svarer om løping om vinteren. |
| T45 | Det står at midlertidige omlegginger «må påregnes» uten dokumentert omlegging. | Fjern spekulasjonen. Si at byggepåvirkning er uavklart. |
| T46 | Strekningen Sponhuset–Grilstad er omtalt som tilrettelagt for rullestol og barnevogn. | Bevar kun for navngitt strekning og kildeperiode; ikke oversett til universell utforming eller egnet løperute. |
| T47 | Trimstasjonen i Djupvika bygger på etableringsartikler fra 2015–2016. | Krev dagens driftskontroll, plassering og tilstand før markør eller fasilitetsløfte. |
| T48 | De fleste foreslåtte kartankrene mangler inngang og koordinater. | Ingen rute-, avstands- eller kartpublisering før faktisk publikumsinngang er kontrollert. |
| T49 | Treningsobjekter overlapper Natur og Oppvekst. | Ladestien, SK Trygg/Lade, allidrett og idrettsanlegg skal gjenbrukes som samme objekter med én primær kategori, ikke dupliseres. |
| T50 | Kjøpersvarene bruker superlativer og delvis ufullstendige sammenligninger. | Fjern «lavere pris», «eneste», «best dokumentert» og lignende; svar med verifiserte egenskaper. |
| T51 | Tilgjengelighetsopplysninger kommer delvis fra eldre planmateriale. | Ikke merk anlegg som tilgjengelige eller universelt utformet før dagens inngang, garderobe, toalett og intern rute er kontrollert. |
| T52 | Rapporten inneholder detaljert bookingadresse, sesongfordeling og prisnivå som lett foreldes. | Behold i kildegrunnlaget, men vis bare det brukeren trenger og med gyldighetsdato. |
| T53 | Flere påstander bruker kommunens Google Sites-sider uten tydelig publiseringsdato. | Lagre kontrolltid og hent eventuelle driftskalendere separat; kontrolltid er ikke det samme som kildedato. |
| T54 | Faktatabellen blander `status i dag`, historisk sesong og planlagt endring. | Normaliser `operating_status`, `valid_from/to`, `season`, `planned_status` og `observed_at` som separate felt. |

## Foreløpig behandlingsretning

Sterke kandidater etter ny kontroll er 3T-Lade, Impulse Leangen, Leangen idrettspark med separate underanlegg, Lade idrettspark, Trygg/Lade-hallen og prosjektets beboertreningsrom som prosjektattributt. Husebybadet kan brukes som ekstern behovsreferanse dersom lokal offentlig svømming fortsatt ikke finnes etter kontroll.

Fresh Fitness skal ikke publiseres som aktivt sted. «Åpen hall», Lade Tennisarena, trimstasjonen i Djupvika, A4 Arena og alle katalogkandidater utsettes til dagens drift og adgang er bekreftet. Ladestien skal gjenbruke Natur-objektet og den avklarte traséstatusen.

## Dekning

Hele rapporten er lest. Alle 18 kandidatrader, 7 foreslåtte kartankere, 16 kjøperspørsmål, 19 kunnskapshull, 26 avklaringsspørsmål og 60 URL-oppføringer er omfattet av 54 kontrollpunkter. Ingen påstand er uavhengig kildeverifisert eller importert i denne mottaksrunden.
