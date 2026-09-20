# Leangenbukta – mottak av kategoriresearch, runde 5: oppvekst

Mottatt fra Andreas i samtalen 18.09.2026. Rapporten er bevart ordrett i `docs/research/leangenbukta-lokal-demo/raw/2026-09-18-opus-oppvekst-runde-5.md`. Originalen skal ikke rettes; kildekontroll og importbeslutninger føres separat.

Rapporten er kandidatgrunnlag for Oppvekst i U6 i masterplanen. Ingen data er importert, og kildene er ikke åpnet på nytt i denne mottaksrunden.

## Mottatt dekning

- 418 linjer og 60 320 tegn rårapport.
- 20 kandidatrader.
- 12 kjøperspørsmål.
- 17 uttrykkelige kunnskapshull.
- 16 avklaringsspørsmål.
- 62 nummererte kildeoppføringer i rapportens egen oversikt.

## Kontrollpunkter før import

| ID | Observasjon | Behandling før import |
|---|---|---|
| O1 | Skolekretsen er korrekt holdt uavklart. | Ingen skole knyttes til adressen før kommunens adresseoppslag/kartvedlegg er kontrollert for riktig skoleår. |
| O2 | Lade skole omtales som relevant kandidat. | Nærhet eller naboplaner er ikke bevis på krets eller rett til plass. |
| O3 | Juridisk henvisning til opplæringsloven § 8-1 kan være basert på eldre lovnummerering. | Kontroller gjeldende forskrift og hjemmel før juridisk tekst brukes av Anja. |
| O4 | «Ikke fritt skolevalg» forenkler reglene. | Forklar nærskoleprinsipp og mulighet til å søke skolebytte med kommunens ordlyd; ikke gi juridisk konklusjon utover kilden. |
| O5 | Lade skole 1.–10. trinn klassifiseres som `stable`, samtidig som ungdomstrinnet beskrives som midlertidig. | Bruk aktuell driftsstatus med kontrolldato, ikke permanent egenskap. |
| O6 | 663 elever omtales sammen med kapasitet. | Elevtall, dimensjonert kapasitet, anbefalt utnyttelse og ledige plasser er forskjellige størrelser. Ingen restkapasitet kan beregnes. |
| O7 | Historiske kapasitetsmål 700/790 og framtidig ungdomsskole kommer fra eldre planer. | Bevar som historisk planforutsetning; hent gjeldende skolebehovsplan før nåpåstander. |
| O8 | Medieprognoser for 2035 er riktig merket svake. | Ikke importer før kommunal primærkilde og scenario/vedtaksstatus er kontrollert. |
| O9 | Skolehelsetjenestens arbeidsdager og navngitte SFO-kontakter er tatt med. | Dette er unødvendig og raskt foreldet for demoen; ikke importer personnavn, telefonplan eller bemanningsdager. |
| O10 | Planlagt barnehage beskrives som «regulert, ikke vedtatt bygget». | Tryggere tekst er «regulert; separat byggebeslutning ikke funnet». Selve reguleringsvedtaket er et vedtak, men ikke byggestart. |
| O11 | Tabellen sier barnehagen «ikke under bygging» og «ikke i drift: nei» basert på manglende funn. | Manglende kilde beviser ikke fysisk nåstatus. Bruk `byggestatus uavklart` til direkte, datert kontroll finnes. |
| O12 | Rapporten mangler plankartdetaljer og rekkefølgekrav som tidligere rapporter allerede har kandidater for. | Samordne med runde 1–2: maks 1 700 m² og turveg før brukstillatelse er kandidater som må kildekontrolleres én gang, ikke researches parallelt. |
| O13 | Fireavdelingsbarnehager i kommunedelplan brukes som bakgrunn. | Ikke overfør generell tomtestandard til Leangenbuktas konkrete kapasitet. |
| O14 | Plassering beskrives med utbyggermateriell, presse og selgers egenerklæring. | Hent plankartgeometri. Private salgsopplysninger skal ikke bestemme markør. |
| O15 | Travbaneprosjektets barnehage og skolekrets er tydelig skilt. | Behold som eksklusjonsregel i researchloggen, ikke som tilbud i Leangenbukta-boardet. |
| O16 | Ladesletta har 85 plasser mot 86 barn og ulikt areal. | Dette er trolig godkjent kapasitet mot faktisk barnetall/tidspunkt, ikke nødvendigvis konflikt. Lag separate påstander. |
| O17 | Barnehagekapasitet og barnetall kan endres årlig. | Knyt til rapporteringsår og ikke bruk som løfte om ledig plass. |
| O18 | Ladesletta-koordinat kommer fra Barnehagekartet; kulturbarnehagen fra Cylex. | Kartfest faktisk inngang mot autoritativt kart/virksomheten. Cylex-koordinat er kun kandidat. |
| O19 | Lade barnehager behandles som én enhet med administrativ adresse. | Opprett eventuelt separate fysiske barnehager; enhetskontor er ikke nødvendigvis besøkssted. |
| O20 | Opptaksfrister støttes delvis av sider for andre barnehageenheter. | Bruk kommunens sentrale, gjeldende opptaksside for kommuneomfattende regler. |
| O21 | «Offentlig» brukes både om eierform, tjeneste og fysisk adgang. | Skill kommunal eier, samordnet opptak, rett til plass og adgang til bygning/uteområde. |
| O22 | SFO-priser og regler er omfattende og tidsfølsomme. | Bruk egen `price_rule`/gyldighetsdato; kontroller terskelen ved 12 timer og satsene før demo. |
| O23 | Gratis halv plass kan leses som gratis SFO generelt. | Oppgi trinn, timegrense, kostpenger og gyldighetsår presist. |
| O24 | Oppstartsdatoer for skoleåret 2026/27 er kortlivet kalenderinformasjon. | Ikke importer som varig prosjektkunnskap. |
| O25 | Kommunens generelle adgangstekst for skole-/barnehagelekeplasser brukes bredt. | Kontroller om den gjelder alle kommunale anlegg og lokale unntak; ikke overfør til private barnehager. |
| O26 | Lade skole lek, Ladeparken og Ringvebukta mangler koordinater og innganger. | Ikke kartklare før faktisk adkomst er kartfestet. |
| O27 | «Rullevennlig dekke» tolkes delvis som tilgjengelighet. | Bevar konkret dekke; ikke lov universell tilgjengelighet for hele anlegget. |
| O28 | Leangen gård park er allerede Natur-kandidat og er ikke lekeplass. | Én primær kategori/markør; Oppvekst kan referere til samme objekt uten duplikat. |
| O29 | Prosjektets uteområder kalles felles for beboere og «ikke offentlig». | Fellesformål beviser ikke nødvendigvis at allmennheten er utestengt. Adgang skal stå uavklart til vedtekter/skilt/kilde finnes. |
| O30 | «Ladestien passerer gjennom prosjektet» gjentas som nåfakta. | Samordne med Natur-notatet, som skiller eksisterende trasé, adkomststi og framtidig o_GT. |
| O31 | Kunstisbanens sesongtekst «ca. fra 1. i sesongen» er ufullstendig. | Ikke importer tider før original side og aktuell sesongplan er kontrollert. |
| O32 | Leangen Ishall bygger på Wikipedia og «antatt i drift». | Utsett til kommunal/anleggsside bekrefter drift, publikumstilgang og inngang. |
| O33 | Lade fritidsklubbs målgruppe blander generell kommunal hovedregel og Lade-spesifikt tilbud. | Kontroller eksakt lokal målgruppe, åpning og påmeldingskrav. |
| O34 | Lade Motor er ikke drop-in. | Bevar adgangs-/rekrutteringsvilkår; ikke presenter som åpent tilbud for alle. |
| O35 | Korpsets egne sider har motstridende kontingent. | Ikke oppgi pris før korpset bekrefter. Korps og kulturskole er separate betalinger. |
| O36 | SK Trygg/Lade mangler sesong, pris, påmelding og ledighet. | Behold som kandidat/tema uten løfte om medlemskap. |
| O37 | Flere objekter bruker sammensatte kategorier som `Oppvekst/Natur`. | Velg én primær kategori og sekundærkobling etter felles kategorioppsett. |
| O38 | Veidelen kaller jernbanen Meråkerbanen, mens Transportrapporten/Bane NOR omtaler Leangen på Nordlandsbanen. | Avklar korrekt banebetegnelse og fysisk trasé før bruk. |
| O39 | Startpunktet er prosjektadressen, ikke faktisk port/bygg. | Ingen skolevei eller kryssing beregnes før start og mål-inngang er fastsatt. |
| O40 | At gata har fire lysregulerte kryss sier ikke hvilket kryss en elev bruker. | Kartlegg konkret rute; historisk oppgradering er ikke bevis på trygg skolevei. |
| O41 | Kjøpersvaret «barnehagen er ikke under bygging» er sterkere enn evidensen. | Svar at byggestart ikke er dokumentert i gjennomgåtte kilder. |
| O42 | Kapasitetssvaret nevner 790 og 663 tett. | Si uttrykkelig at differansen ikke viser ledige skoleplasser eller rett til opptak. |
| O43 | Faktatabellen bruker «offentlig» adgang for skole/SFO/barnehager. | Offentlig tjeneste betyr ikke fri fysisk adgang; lag egne felter for eier, opptak og utearealtilgang. |
| O44 | Flere kartkandidater har lav plasseringssikkerhet, men anbefales som kartpunkt. | Ingen publisering før inngang og koordinatkilde er verifisert. |

## Foreløpig behandlingsretning

Sterke kandidater etter kontroll er Lade skole som skoleanker, dokumenterte fysiske barnehager, kommunale lekeplasser og Lade fritidsklubb. SFO, korps og Lade Motor bør være medlemmer/tema under eksisterende anker. Planlagt barnehage vises bare etter plankartfesting, med status «regulert; byggestart og åpning uavklart».

Ikke importer skolekrets, påstått ledig kapasitet, trygg skolevei, uverifiserte innganger, medieprognoser, personnavn, gamle oppstartsdatoer eller motstridende priser.

## Dekning

Hele rapporten er lest. Alle 20 kandidatrader, 12 kjøperspørsmål, 17 kunnskapshull, 16 avklaringsspørsmål og rapportens 62 kildeoppføringer er omfattet av 44 kontrollpunkter. Ingen påstand er uavhengig kildeverifisert eller importert i denne mottaksrunden.
