# Leangenbukta – mottak av kategoriresearch, runde 6: servering

Mottatt fra Andreas i samtalen 18.09.2026. Rapporten er bevart ordrett i `docs/research/leangenbukta-lokal-demo/raw/2026-09-18-opus-servering-runde-6.md`. Originalen skal ikke rettes; kildekontroll og importbeslutninger føres separat.

Rapporten er kandidatgrunnlag for Servering i U6 i masterplanen. Ingen data er importert, og kildene er ikke åpnet på nytt i denne mottaksrunden.

## Mottatt dekning

- 414 linjer og 54 178 tegn rårapport.
- 21 kandidatrader.
- 7 foreslåtte startpunkter.
- 12 kjøperspørsmål.
- 15 uttrykkelige kunnskapshull.
- 15 avklaringsspørsmål.
- 55 URL-oppføringer i rapportens kildeoversikt.

## Kontrollpunkter før import

| ID | Observasjon | Behandling før import |
|---|---|---|
| S1 | Rapporten beskriver søndagstilbudet som «godt dekket». | Dette er en redaksjonell vurdering basert på et ikke-uttømmende utvalg. Vis konkrete åpne steder og tider, uten dekningskarakteristikk. |
| S2 | Alle åpningstider, avvikstider og sesonger er ferskvare. | Lag tidsfestede påstander med kontrolldato og utløps-/oppfriskningsbehov; ikke skriv dem som varige egenskaper. |
| S3 | City Lade er stengt søndag, mens enkelte virksomheter har egne tider. | Hold senterets åpningstid og hvert serveringssteds åpningstid som separate påstander. |
| S4 | Egon og Snurr antas å ha egen inngang fordi Solrekka er åpen når senteret er stengt. | Dette er en rimelig slutning, men ikke dokumentert inngangsgeometri. Kartfest faktisk inngang før rute eller søndagsadkomst vises. |
| S5 | Rosenborg Bakeri City Lade og Espresso House får antatt senteråpningstid. | Ikke importer antatte tider. Behold virksomheten som medlem med åpningstid `unresolved` til egen kilde er kontrollert. |
| S6 | De fleste City Lade-medlemmene er hentet fra en medlemsoversikt sist endret i 2023. | Bekreft aktuell driftsstatus og navn per virksomhet; medlemsliste og nåværende drift er forskjellige påstander. |
| S7 | Rapporten kaller Egon lengst kveldsåpent og Dromedar tidligst åpent. | Sammenligningene avhenger av at utvalget er komplett og tidene er aktuelle. Bruk konkrete tider uten superlativer. |
| S8 | Egon omtales som den klart største dokumenterte uteserveringen. | Oppgitt kapasitet kan vises med kilde og dato, men ikke rangeres mot ufullstendig kandidatsett. |
| S9 | Snurr og Egon er to markører på samme del av City Lade. | Vurder ett Solrekka-anker med to medlemmer dersom kartet blir tett; behold separate virksomhetsfakta. |
| S10 | DIGG og Krem har internt motstridende åpningstider i primærkilder. | Bevar konflikten eksplisitt og ikke velg én tid før aktuell filial bekrefter. |
| S11 | Ladekaia har fire ulike tidsvarianter, også to på egen side. | Status og timer skal stå sesongavhengig/uavklart. Ikke la én generell ukeplan overstyre datert sesonginformasjon. |
| S12 | Ladekaia omtales både som daglig åpen og sesongstyrt. | Skill ordinær serveringssesong, arrangementsdrift, private arrangementer og eventuell stenging. |
| S13 | Sponhusets åpningstid kommer fra skiftende sosiale profiler og historiske innlegg. | Fang publiseringsdato og sesong. Kontroller aktiv ukeplan før demoen viser «åpent nå» eller faste tider. |
| S14 | Café Victoria følger museets åpningstider, som endres med sesong. | Kafeen trenger egen gjeldende status; museumssesong er ikke en permanent kaféplan. |
| S15 | Det er uavklart om kafébesøk på Café Victoria krever billett. | Ikke presenter stedet som fritt tilgjengelig før adgangsvilkår er bekreftet. |
| S16 | Lade Arenas egne data er fra 2022, mens nyere opplysninger kommer fra kataloger. | Utsett alle virksomheter og tider der til senter eller virksomhet bekrefter dagens tilbud. |
| S17 | Burger King og Café Benoni er bare kandidatfunn. | Ikke opprett aktive steder fra foretaks-/katalogoppføring alene. |
| S18 | Kompis beskrives som eneste dokumenterte restaurant utenfor de tre store sentrene. | Dette er en ufullstendig sammenligning. Bevar virksomheten, men fjern eksklusivitetsutsagnet. |
| S19 | Sponhuset beskrives som å gi «småskala, ikke-kommersiell turfølelse». | Sponhuset er en kommersiell kafé. Ikke importer estetiske eller misvisende klassifiseringer. |
| S20 | Kommunalt offentlig toalett ved Sponhuset nevnes sammen med kaféfasiliteter. | Knytt toalettet til friområdet Ringvebukta, ikke til serveringsstedets fasiliteter. |
| S21 | Uteservering er dokumentert på ulikt nivå for Solrekka, Egon, Ladekaia og Sponhuset. | Skill felles senterareal, virksomhetens egne plasser, kapasitet og sesong. |
| S22 | Skjenking nevnes uten kontroll av bevilling og vilkår. | Ikke importer bevilling, aldersgrense eller skjenketid før kommunal bevillingskilde er kontrollert. |
| S23 | Takeaway, nettbestilling og levering blandes delvis. | Modellér dem separat. En appoppføring eller takeaway betyr ikke at adressen kan få levering. |
| S24 | Wolt-tider for Rosenborg Bakeri er leveringsvindu, ikke butikkens åpningstid. | Oppbevar som egen tjenesteplan og aldri bruk den som virksomhetstid. |
| S25 | Foodora og Wolt dekker Trondheim, men prosjektadressen er ikke testet. | Ikke lov levering til Haakon VIIs gate 14; dette må sjekkes med konkret adresse og dato. |
| S26 | «Ingen kommersiell servering i selve Leangenbukta» bygger på at ingen aktør ble funnet. | Bruk «ingen offentlig bekreftet serveringsaktør funnet per kontrolldato». Fravær av funn er ikke fysisk nåstatus. |
| S27 | Framtidstabellen sier at virksomhet i drift er «Nei». | Endre til «ingen virksomhet bekreftet i gjennomgåtte kilder» til direkte kontroll er utført. |
| S28 | Næringsareal er dokumentert, men størrelse, egnethet og bruk er ukjent. | Ikke kategoriser lokalene som framtidig servering uten dokumentasjon om formål, teknikk eller leietaker. |
| S29 | Loungen i Knutepunktet beskrives av utbygger som et beboerfellesareal som «kan fungere som kafé». | Modellér som prosjektfasilitet for beboere, ikke serveringssted. Bevar sitatet som forklaring på bruksmulighet. |
| S30 | Loungens tilgang og ferdigstillelse er tidsfølsom. | Skill planlagt funksjon, faktisk åpning og adgangsvilkår. Oppdater hvis kommersiell drift eller regler senere endres. |
| S31 | Naboprosjektets planlagte tilbud er tydelig skilt fra Leangenbukta. | Behold dette som eksklusjonsregel og ikke som kartinnhold for prosjektet. |
| S32 | Rapporten bruker ca. 14 km som én lengde for Ladestien. | Natur-rapporten dokumenterer motstridende lengder og endepunkter. Ikke importer ett tall uten ruteavgrensning. |
| S33 | Ladekaia og Sponhuset sies å ligge direkte på Ladestien. | Kontroller traségeometri og faktisk inngang før dette brukes i ruting eller presis karttekst. |
| S34 | Ladekaias busslinjer gjentas fra virksomhetens side. | Transportdata skal komme fra den tidsfestede transportkilden og ikke dupliseres som stabil serveringsfakta. |
| S35 | Bare noen få koordinater finnes, og de kommer fra Tripadvisor eller Wolt. | De er kandidatkoordinater. Kartfest besøksinngang mot autoritativt kart eller virksomheten. |
| S36 | Ingen av startutvalgets innganger er presist dokumentert. | Ingen markør er rute- eller avstandsklar før inngang/adkomstpunkt er verifisert. |
| S37 | Flere kandidater har sammensatte kategorier som `Servering/Hverdag`. | Velg én primær kategori og bruk medlemskap/sekundærkobling for kryssvisning. |
| S38 | Senter, serveringssted og tilbud kan bli tre duplikater på kartet. | Bruk ett fysisk anker der det er naturlig, med virksomheter og tjenester som medlemmer. |
| S39 | Kjøpersvarene bruker konkrete tider fra rapporten uten synlig kontrolldato. | Anja må oppgi at tider er kontrollert 18.09.2026 og bør sjekkes før besøk, eller hente dem på nytt. |
| S40 | «To dokumenterte steder langs Ladestien» kan leses som en komplett opptelling. | Presenter Ladekaia og Sponhuset som dokumenterte kandidater i utvalget, ikke som alle steder langs ruta. |
| S41 | Barnemeny, barnestol, tilgjengelighet og toalett er stort sett uavklart. | Ikke bruk familievennlig- eller tilgjengelighetsmerker uten fasilitetsspesifikk kilde. |
| S42 | Kildelisten er omfattende, men påstandsradene har ikke alltid entydig kilde og dato. | Import krever påstandsnivå-proveniens, kontrolltid og markering av primærkilde, sekundærkilde eller slutning. |

## Foreløpig behandlingsretning

Sterke kandidater etter ny kontroll er Ladekaia, Sponhuset, Egon, Snurr, Kompis, Dromedar og Café Victoria. Senterbaserte virksomheter bør normalt ligge som medlemmer under senterankeret. Solrekka kan være ett anker med Egon og Snurr dersom to markører gir unødvendig tetthet.

Ikke importer antatte senteråpningstider, superlativer, katalogkoordinater, leveringsdekning, uverifisert Lade Arena-innhold eller framtidig servering i Leangenbukta. Loungen skal ligge som beboerfasilitet, og næringslokalene skal beholde `planned/unresolved` uten serveringsikon.

## Dekning

Hele rapporten er lest. Alle 21 kandidatrader, 7 foreslåtte startpunkter, 12 kjøperspørsmål, 15 kunnskapshull, 15 avklaringsspørsmål og 55 URL-oppføringer er omfattet av 42 kontrollpunkter. Ingen påstand er uavhengig kildeverifisert eller importert i denne mottaksrunden.
