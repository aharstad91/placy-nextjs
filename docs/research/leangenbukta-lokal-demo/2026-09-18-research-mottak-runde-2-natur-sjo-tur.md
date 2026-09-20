# Leangenbukta – mottak av kategoriresearch, runde 2: natur, sjø og tur

Mottatt fra Andreas i samtalen 18.09.2026 som resultat av den bestilte Opus-researchen. Rapporten er bevart i `docs/research/leangenbukta-lokal-demo/raw/2026-09-18-opus-natur-sjo-tur-runde-2.md` med opprinnelige formuleringer, påstander, kilder og forbehold. Originalen skal ikke rettes; vurderinger og senere kildekontroll føres separat.

## Bruk i masterplanen

Rapporten er kandidatgrunnlag for kategorien Natur i U6 i `docs/plans/2026-09-18-1124-feat-leangenbukta-board-master-plan.md`. Den bidrar også med noen kandidater til Opplevelser og Servering, men disse skal ikke automatisk importeres eller dupliseres mellom kategoriene.

Ingen opplysning er importert til runtime-data. Betegnelsene «Dokumentert», «I bruk» og «Kontrolldato» er rapportforfatterens. Kilde-URL-ene er ikke åpnet på nytt i denne mottaksrunden. Kontrollpunktene under gjelder intern sammenheng, tidslogikk, kartklarhet og samsvar med masterplanens evidensmodell.

## Mottatt dekning

- 170 linjer og 23 961 tegn rårapport.
- 15 rader i den strukturerte faktatabellen.
- 10 foreslåtte kartpunkter.
- 6 foreslåtte kjøperspørsmål.
- 8 eksplisitte kunnskapshull.
- 5 hoveddeler: forbindelse/trasé, turmål, turforslag, bruksforhold og eierskap/tilgang.

Dette er et mottaksregnskap, ikke antall atomære fakta. Hver tabellrad og hvert prosavsnitt inneholder flere selvstendige påstander som må splittes før endelig X-av-Y-kontroll og importbeslutning.

## Kontrollpunkter før kuratering og import

| ID | Observasjon i rapporten | Behandling før import |
|---|---|---|
| N1 | Planbeskrivelsen fra 2017 brukes som bevis på at adkomststien langs nordsiden er farbar og «i bruk» i september 2026. | Bevar 2017-påstanden som historisk dokumentasjon. Nåstatus må bekreftes med datert kilde, oppdatert kart eller feltkontroll; fravær av funnet stengningsmelding er ikke nok. |
| N2 | Tre forskjellige objekter omtales tett: Ladestien som ble flyttet ca. 900 meter i 2017, adkomststien langs eiendommens nordside og planlagt o_GT/intern forbindelse gjennom feltet. | Opprett separate objekt-ID-er og kilder. Ikke la navn, status, geometri eller åpningsinformasjon arves mellom dem. |
| N3 | At utbyggersider bruker fremtidsform, brukes som grunnlag for «ikke åpnet per september 2026». | Registrer dette som en slutning, ikke bekreftet nåstatus. Eldre eller udaterte framtidsformuleringer kan være foreldet selv om prosjektet fortsatt bygges. |
| N4 | o_GT omtales som rekkefølgekravsikret, men kravet utløses før brukstillatelse for barnehagen. | Ikke utled åpningsår fra boligprosjektets ferdigstillelse 2028–2030. Hvis barnehagen ikke har tidsplan, gir rekkefølgekravet heller ingen dato for turvegen. |
| N5 | «Ladestien går rett forbi/gjennom prosjektområdet» samler dagens trasé, grensen mot området og en framtidig trasé i én formulering. | Lag trygg tekst som sier hva som grenser til området i dag, hvilken forbindelse planmaterialet beskriver, og hva som er planlagt gjennom feltet. Ikke bruk «går gjennom» før geometri og nåstatus er kontrollert. |
| N6 | f_BUT beskrives som «forbeholdt beboerne», mens sitert bestemmelse bare sier at arealet er felles for alle boligene i planområdet. | Skill formål/eierskap fra faktisk adgangsregel. Ikke hev at allmennheten er utestengt uten bestemmelse, skilt, vedtekt eller annen direkte kilde. |
| N7 | Offentlig reguleringsformål brukes flere steder som synonym for åpen og tilgjengelig i dag. | Bevar `offentlig_regulert` separat fra `opparbeidet`, `åpen`, `midlertidig_stengt` og `faktisk_adgang`. Anleggsperioden kan påvirke tilgjengelighet. |
| N8 | Lengdene 6,4 km, under 8 km og ca. 14 km føres som motstridende. | De har ulike endepunkter og kan være forskjellige rutevarianter, ikke en reell faktakonflikt. Lag eventuelt separate ruter med start, slutt, dato og målemetode; unngå ett universelt lengdetall. |
| N9 | Ringve botaniske hage og Leangen gård omtales som i «umiddelbar nærhet». | Bruk ikke den relative formuleringen før kontrollert rute eller avstand finnes. Stedene kan fortsatt være relevante kartkandidater. |
| N10 | Kveldsturforslaget sier «østover mot Leangen gård / Ringvebukta», mens senere badeturforslag legger Ringvebukta vestover. | Kontroller retning og rute i kart. Ikke importer turforslaget før startpunkt og delmål er kartfestet. |
| N11 | Fem badeplasser beskrives som offentlige og «kommunalt driftede» fordi de finnes på kommunens badeplassider. | Kontroller hva kilden faktisk sier om drift/eierskap. Kommunal informasjonsside dokumenterer i første omgang at kommunen omtaler stedet; den beviser ikke alle driftsdetaljer. |
| N12 | «I bruk» settes på badeplasser, parker, museum, kirke og serveringssted med udaterte eller eldre kilder. | Nåstatus og sesongåpning må vurderes per sted. Permanente naturmål kan ha stabil eksistens, mens toalett, dusj, servering, pris og åpningstid krever ferskere kontroll. |
| N13 | Flere kilder i faktatabellen er forkortet med `...`, mangler protokoll eller er oppgitt som «div.». | Full, direkte URL og kildetittel må inn i kildeinventaret før en påstand kan få kilde-ID. Tabellen er ikke importklar slik den står. |
| N14 | Koordinater kommer delvis via Wikipedia eller Bobilavisen med henvisning videre til SSR/Geonorge, og Leangen-koordinatet gjelder området. | Kontroller mot primær kartkilde. Skill stedskoordinat, faktisk inngang, parkeringspunkt og rutestart; omtrentlige områdekoordinater skal ikke bli presise markører. |
| N15 | Adkomstpunkter som «ved Sponhuset», «mellom Korsvika og Rotvoll» og «p-plass før gården» er verbale kandidater uten verifisert punkt. | Ikke opprett runtime-POI før punktet er kartfestet. Behold som søke-/kontrollinstruks i manifestet. |
| N16 | Belysning er riktig merket uavklart, mens vinterbrøyting bygger på en sak fra 2019 uten avgrenset strekning. | Ikke gi generelt ja/nei-svar om vinterbruk. Registrer kilde, år og ukjent delstrekning; hent gjeldende vinterdriftskart eller svar fra kommunen. |
| N17 | Underlag og terreng beskrives samlet for hele Ladestien, og tredjepartskilder omtaler rullestol/barnevogn. | Representer forhold per delstrekning hvis de kan dokumenteres. Planens min. 2,5 meter og maks 1:10 gjelder o_GT i planområdet, ikke hele Ladestien. |
| N18 | Badevannsteksten beskriver kommunens prøveregime og råd etter regn. | Ikke projiser dette til dagens vannkvalitet ved en bestemt badeplass. En eventuell badeplasspåstand trenger sted, måledato, klassifiseringsperiode og kilde. |
| N19 | Rapporten nevner hund i bånd med tredjepartskilder. | Ikke importer som et generelt adgangs- eller regelutsagn. Båndtvang, verne-/fuglehensyn og lokale regler må hentes fra ansvarlig myndighet med gyldighetsperiode. |
| N20 | Fremtidig serveringssted, flytende badstue og forlengelse Hansbakkfjæra–Væreholmen er forslag. | Behold som historiske forslag eller utelat fra kjøperrettet demo. De må aldri vises som planlagt eller eksisterende tilbud uten nyere vedtak og status. |
| N21 | Ringve museum, Lade kirke og Ladekaia ligger tematisk mellom Natur, Opplevelser og Servering. | Gi hvert sted én primær kategori og eventuelle eksplisitte sekundærkoblinger etter felles kategoriregler. Unngå doble markører og motstridende fakta. |
| N22 | Pris og åpningstid for Ringve museum er ferskvare; Ladekaia mangler direkte kilde og kartpunkt. | Flytt disse til respektive kategorirunder eller kontroller der. Natur-rapporten alene er ikke tilstrekkelig importgrunnlag. |
| N23 | Leangen gård kombinerer park/friområde, fredet anlegg, kommunal representasjon og fugleadkomst i én enhet. | Skill offentlig uteareal, bygninger og fugleobservasjonspunkt. Bekreft faktisk tilgang, åpning og inngang før kartfesting. |
| N24 | «Egner seg for små barn», «godt tilrettelagt» og tilsvarende formuleringer kan leses som råd om sikkerhet eller tilgjengelighet. | Bevar eventuelt som tydelig kildeattribuert beskrivelse. Ikke gjør dem til Placy-vurderinger uten konkrete kriterier og aktuell kontroll. |
| N25 | Kartpunktlisten anbefaler innganger, men faktatabellen blander POI, parkering og områdepunkt. | Datamodellen må merke punktrollen: `entrance`, `parking`, `trail_access`, `venue` eller `area_anchor`. Ruting skal bruke inngang, mens visning kan bruke annet anker når det er tydelig. |

## Foreløpig behandlingsretning

Følgende er relevante kandidater etter senere kildekontroll og kartfesting:

- Ladestien som overordnet turtema, med eksplisitte rutevarianter i stedet for ett lengdetall.
- En faktisk, nå åpen adkomst fra Leangenbukta til Ladestien.
- Ringvebukta, Djupvika, Korsvika, Devlebukta og Rotvollfjæra som bade-/turmål når inngangspunkter og gjeldende fasiliteter er kontrollert.
- Leangen gårds offentlig tilgjengelige uteareal, hvis adgang og korrekt inngang kan dokumenteres.
- Ringve botaniske hage som natur-/opplevelsesmål etter ruteberegning og aktuell kildekontroll.
- Grilstadstranda som et mulig utvidet utvalg, ikke automatisk som «nærmeste» tilbud.

Følgende bør inntil videre være tema eller kunnskapshull uten kartpunkt: framtidig o_GT gjennom feltet, ukontrollert adkomststi, belysning, vinterdrift, universell utforming per delstrekning og grensen mellom o_GT/o_GF/f_BUT.

## Dekning og videre arbeid

Hele rapporten er lest, alle 15 tabellrader, alle 10 kartkandidater, alle 6 kjøperspørsmål og alle 8 uttrykkelige kunnskapshull er omfattet av kontrollpunktene. Det er registrert 25 kontrollpunkter. Ingen påstand er uavhengig kildeverifisert eller importert i denne mottaksrunden.

Neste bearbeiding av Natur-kategorien må inventere atomære påstander, hente fullstendige URL-er, kontrollere de viktigste nåstatusene og kartfeste faktiske innganger. Deretter kan hvert kandidatsted få beslutningen `importer`, `tema uten kartpunkt`, `utsett` eller `utelat`, med begrunnelse.
