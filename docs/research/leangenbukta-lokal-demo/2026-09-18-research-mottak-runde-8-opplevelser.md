# Leangenbukta – mottak av kategoriresearch, runde 8: opplevelser

Mottatt fra Andreas i samtalen 18.09.2026. Rapporten er bevart ordrett i `docs/research/leangenbukta-lokal-demo/raw/2026-09-18-opus-opplevelser-runde-8.md`. Originalen skal ikke rettes; kildekontroll og importbeslutninger føres separat.

Rapporten er kandidatgrunnlag for Opplevelser i U6 i masterplanen. Ingen data er importert, og kildene er ikke åpnet på nytt i denne mottaksrunden.

## Mottatt dekning

- 365 linjer og 40 973 tegn rårapport.
- 14 kandidatrader.
- 9 foreslåtte kartankere/koblinger.
- 16 kjøperspørsmål.
- 13 uttrykkelige avklaringsspørsmål fordelt på fire mottakergrupper.
- 17 kildegrupper med 53 URL-forekomster i rapportens kildeoversikt.

## Kritisk prosjektforveksling

Seksjon 9, `EXP-14` og det tilhørende kjøpersvaret bruker reguleringsplan **r20170034** som grunnlag for «Leangenbukta Torget». Dette er planen for Leangen Bolig/travbaneområdet, et naboprosjekt som de tidligere researchrundene uttrykkelig skiller fra Leangenbukta. Leangenbuktas egen vedtatte plan er **r20160019** for Haakon VIIs gate 14.

Påstandene om gatetun `f_SGT1-3`, felt `BKB1`, offentlig gangpassasje, forsamlingslokale og senere endring i Travbanevegen kan derfor ikke importeres som fakta om Leangenbukta. De må fjernes fra Leangenbukta-grunnlaget. Eventuelle fakta om torg, offentlig ferdsel, fellesfunksjoner, kulturformål eller kunst må utledes på nytt fra r20160019 og prosjektets egne dokumenter.

## Kontrollpunkter før import

| ID | Observasjon | Behandling før import |
|---|---|---|
| E1 | BLUF beskriver tilbudet som «konsentrert» og enkelte steder som de «tydeligste» ankerne. | Dette er redaksjonelle vurderinger uten definert sammenligningsgrunnlag. Vis verifiserte steder og egenskaper uten områdevurdering eller rangering. |
| E2 | Seksjon 9 presenterer r20170034 som plan for Leangenbukta. | Avvis hele plangrunnlaget i seksjonen for dette prosjektet. Bruk bare r20160019 til prosjektfakta. |
| E3 | `EXP-14 Leangenbukta Torget` bygger på r20170034. | Ikke opprett eller importer objektet. Et eventuelt torgobjekt må bygges på nytt fra korrekt plan og kontrollert, faktisk status. |
| E4 | Kjøpersvaret om framtidige kultur- og opplevelsestilbud gjentar gatetun, offentlig gangpassasje og BKB1 fra naboplanen. | Svaret er ugyldig for Leangenbukta og må skrives på nytt etter kontroll av r20160019. |
| E5 | Endringen for Travbanevegen 4A, 4B og 6B omtales som en senere endring uten tydelig nok prosjektavgrensning. | Behold kun som eksklusjonskunnskap om naboprosjektet; ikke knytt den til Leangenbukta. |
| E6 | Knutepunktet og beboerfellesarealene er dokumentert fra Leangenbuktas egne kilder, men blandes med naboplanen. | Skill utbyggerens prosjektfakta fra planpåstandene. Modellér Knutepunktet som beboerfasilitet, ikke offentlig kulturarena. |
| E7 | Manglende bindende bestemmelse om offentlig kunst konkluderes etter gjennomgang av feil plan. | Konklusjonen gjelder ikke Leangenbukta. Kontroller r20160019 før status settes til `unresolved` eller fravær. |
| E8 | Rapportteksten har mange løse kildeetiketter som `ringve`, `trondheim`, `Wikipedia` og `tripadvisor`. | Påstand–kilde-koblingen er ikke maskinelt brukbar. Rekonstruer påstandsnivå-proveniens med eksakt URL, kildedato og kontrolltid. |
| E9 | Kontrolldato 18.09.2026 brukes samtidig som flere kilder mangler publiserings-/oppdateringsdato. | Lagre `observed_at` separat fra kildens egen dato; kontrolldato beviser ikke at innholdet ble oppdatert da. |
| E10 | Ringves åpningstider, juleavvik og billettpriser er sesong- og årsspesifikke. | Importer som tidsavgrensede påstander med `valid_from/to`; oppfrisk før visning etter sesongskifte. |
| E11 | Ringve museum, botanisk hage, Café Victoria og omvisninger beskrives på samme tun. | Opprett separate tjenester/adgangsregler, men gjenbruk samme anleggs-/stedsrelasjon. Adgang til én del må ikke arves av de andre. |
| E12 | Kjøpersvaret sier i praksis at kafébesøk ikke krever museumsbillett, mens rapporten ellers sier dette ikke er dokumentert. | Behold kaféadgang `unresolved` til Ringve bekrefter den. Ikke gi et kategorisk «nei». |
| E13 | Ringve botaniske hage har egen adresse og foreslås både som Natur-anker og opplevelseskobling. | Gjenbruk Natur-objektet. Ikke lag en ny Opplevelser-markør; koble hagen til Ringve-anlegget og vis gratis adgang separat. |
| E14 | Opplysning om omvisninger i botanisk hage støttes delvis av tredjepartskilde. | Bruk NTNU som autoritativ kilde for drift, adgang og eventuell booking. |
| E15 | Ringve-parkens tilgjengelighet omtales fra turistkilde som egnet for rullestol/barnevogn. | Ikke importer universell tilgjengelighet. Kontroller konkrete porter, stier, stigning, dekke og sesong hos NTNU/Ringve. |
| E16 | Rockheim tas med utenfor hovedområdet fordi det er nasjonalt museum og deler kombinasjonsbillett med Ringve. | Behandle som ekstern behovsreferanse, ikke automatisk lokalt kartanker. Avgjør med redaksjonell radius og brukerbehov. |
| E17 | Rockheim Live-fakta kommer delvis fra en sekundær konsertportal. | Bruk Rockheims/MiSTs egne sider for scene, adgang og kommende program. |
| E18 | Rockheim-priser har konflikt mellom offisiell side og tredjepartskilder. | Bruk bare aktuell offisiell prisliste med kontrolltid; ikke vis gamle tredjepartspriser. |
| E19 | Lade kirkes byggeår har flere historiske varianter. | Dette er lav nytte for boligkjøperdemoen. Hvis det tas med, bruk autoritativ kulturminne-/kirkelig kilde og en forsiktig datering. |
| E20 | «Åpen kirke» tirsdag 12–13 behandles som fast helårstid. | Kontroller menighetens aktuelle kalender og gyldighetsperiode. Gudstjeneste, åpen kirke og omvisning er separate adgangstyper. |
| E21 | Kirkegård/uteområde beskrives som tilgjengelig uten tydelig kilde, og faktisk inngang er ukjent. | Ikke importer adgang eller rute før offentlig port og eventuelle tidsregler er kontrollert. |
| E22 | Lade kirke har motstridende katalog-/Wikipedia-koordinater. | Kartfest faktisk publikumsinngang fra autoritativt kart; ikke velg bygningsmidt eller sekundær koordinat. |
| E23 | Leangen gårds park omtales som offentlig tilgjengelig, men tidligere runde hadde adgangstider som `unresolved`. | Reparer konflikten med kommunal kilde eller direkte kontroll av port/adgangstid før publisering. |
| E24 | Faktatabellen gir Leangen gård park åpningstid «dagtid» uten dokumentert tidsregel. | Ikke importer «dagtid». Bruk ukjent åpningstid til kommunen har bekreftet adgang. |
| E25 | Hovedbygningen beskrives som privat utleiebar med Wikipedia som støtte. | Bekreft dagens utleie, vielser og representasjonsbruk hos Trondheim kommune før det brukes i kjøpersvar. |
| E26 | `EXP-05` sier bygningen er «lukket for publikum». | Formuler mer presist: ordinær publikumsadgang er ikke dokumentert; adgang kan finnes ved vielser, utleie eller særarrangement. |
| E27 | Ladehammeren/Våttahaugen samler utsikt, lekeplass, krigsminner, gravrøys og kunst fra flere sekundærkilder. | Del påstandene atomisk og verifiser hvert kulturminne/kunstverk før innhold eller fasilitetsmerker importeres. |
| E28 | `EXP-06` setter uteområdet til «døgnåpent» og status «tilgjengelig». | Begge er for sterke uten lokal adgangs-/tilgjengelighetskilde. Bruk fri ferdsel bare når den er dokumentert, og unngå tvetydig `tilgjengelig`. |
| E29 | Ladestien omtales med ca. 8 km i denne rapporten, mens andre runder har andre lengder og endepunkter. | Ikke importer én lengde uten navngitt strekning. Gjenbruk den avklarte Natur-traséen. |
| E30 | Rullestol-/barnevognpåstand om Ladestien kommer fra turportal/Visit Trondheim. | Bruk kommunens opplysning bare for den eksplisitte strekningen Sponhuset–Grilstad; ikke generaliser til hele stien. |
| E31 | Ladekaia omtales som å ha «jevnlige» konserter ut fra historiske arrangementer. | Et historisk utvalg dokumenterer ikke fast frekvens. Koble bare kommende, verifiserte arrangementer til Servering-objektet. |
| E32 | Flere Ladekaia-konserter og Ladehammerfestivalen 2026 var passert på kontrolldato. | Behold som historikk, ikke aktivt innhold. Kalenderhendelser må ha start/slutt og automatisk utløp. |
| E33 | En Songkick-oppføring brukes som mulig kommende konsert. | Verifiser mot Ladekaia/Dora3 eller billettutsteder før publisering; aldri lov arrangement fra aggregatoren alene. |
| E34 | Ladehammerfestivalen omtales som årlig. | Sted/arrangør kan være varig, men hver utgave krever ny bekreftet dato. Ikke opprett framtidig hendelse ved antatt gjentakelse. |
| E35 | Leo's Lekeland har motstridende helgetider og tidsfølsomme priser/tilbud. | Bruk filialens offisielle, aktuelle side. Modellér ferieavvik og kampanjedager separat fra ordinære tider. |
| E36 | «Åpent hele året» for Leo's støttes av sekundærkilde samtidig som flere helligdagsavvik finnes. | Ikke bruk absolutt helårsformulering; vis ordinær drift med dokumenterte avvik. |
| E37 | Leos koordinat og tilgjengelighet kommer fra katalog. | Kontroller faktisk inngang og fasiliteter før kart/ruting eller tilgjengelighetsmerke. |
| E38 | Lucky Bowl mangler besøksadresse og inngang og ligger utenfor Lade. | Ikke opprett kartpunkt før identitet, adresse, dagens aktivitetstilbud og tider er verifisert hos operatøren. |
| E39 | Lucky Bowl kombinerer mange aktiviteter med separate priser, tider og aldersregler. | Modellér anlegget som ett sted med tjenester; ikke la én åpningstid eller pris arves av alle aktivitetene. |
| E40 | Rapporten sier at det ikke finnes kino på Lade. | Formuler «ingen kino ble dokumentert i gjennomgåtte kilder» til et uttømmende søk er gjort. |
| E41 | Nova/Prinsen og Vitensenteret ligger utenfor lokalt hovedområde. | Bruk dem som eksterne svar på udekkede behov hvis produktet tillater det; ikke bland dem med lokale standardmarkører. |
| E42 | Kjøpersvaret sier at kino, konserter og Lucky Bowl «normalt» krever booking. | Skill billettkjøp, reservasjon og anbefalt forhåndsbestilling per aktør; ikke generaliser. |
| E43 | LKV/BABEL har tidsfølsomt program, uklar nåværende adresse og tabellen antyder flytting. | Utsett til dagens visningsrom, publikumsinngang og aktiv utstilling er bekreftet på offisiell side. |
| E44 | Gratis park/hage, billettmuseum, kafé og omvisning blandes lett på samme sted. | Modellér pris og adgang på tilbudsnivå; et gratis uteområde skal ikke gjøre hele anlegget «gratis». |
| E45 | Flere tabellrader bruker sammensatte primærkategorier som `Natur/kulturminne` og `Opplevelser/Hverdag`. | Velg én primær kategori per objekt og bruk relasjoner/tags for kryssvisning. |
| E46 | Opplevelser overlapper Natur, Servering og tidligere Oppvekst-runder. | Gjenbruk Ringve-hagen, Ladehammeren, Leangen gård, Ladestien og Ladekaia som samme objekter; ikke opprett duplikatmarkører. |
| E47 | Forslaget på ni ankere inkluderer duplikater og flere steder utenfor området. | Start med et mindre lokalt utvalg: Ringve museum, Lade kirke, Leangen gård park og Leo's etter verifisering; koble Natur- og Servering-objekter og legg eksterne behov separat. |
| E48 | De fleste koordinater og faktiske innganger har lav eller middels sikkerhet. | Ingen avstandsberegning, ruting eller «nærmest»-svar før besøksinngang er kontrollert. |
| E49 | Tilgjengelighet omtales fra turist-, katalog- og sekundærkilder. | Ikke publiser heis-, HC-, rullestol- eller barnevognattributter uten fasilitetsspesifikk primærkilde. |
| E50 | Negative funn om offentlige arrangementer og kulturtilbud i prosjektet presenteres delvis som nåstatus. | Bruk «ingen bekreftet aktør/arrangement funnet i kontrollerte kilder per dato», og hold manglende funn adskilt fra dokumentert fravær. |

## Foreløpig behandlingsretning

Sterke lokale kandidater etter ny kontroll er Ringve Musikkmuseum, Lade kirke, Leangen gård park og Leo's Lekeland. Ringve botaniske hage og Ladehammeren skal gjenbruke Natur-objektene. Ladekaia skal gjenbruke Servering-objektet og bare få verifiserte kalenderhendelser. Rockheim, Trondheim Kino, Vitensenteret og Lucky Bowl er eksterne behovsreferanser og bør ikke automatisk ligge i standardutsnittet for Leangenbukta.

Alle prosjektpåstander fra r20170034 forkastes for Leangenbukta. Opplevelser i selve prosjektet må vurderes på nytt mot r20160019 og faktiske utbyggerkilder. Knutepunktet forblir en beboerfasilitet, og markedsført torg/møteplass blir ikke kulturarena uten egen dokumentasjon.

## Dekning

Hele rapporten er lest. Alle 14 kandidatrader, 9 foreslåtte kartankere/koblinger, 16 kjøperspørsmål, 13 avklaringsspørsmål og 53 URL-forekomster er omfattet av 50 kontrollpunkter. Ingen påstand er uavhengig kildeverifisert eller importert i denne mottaksrunden.
