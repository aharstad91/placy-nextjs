# Nyhavna: FAQ som inngang til samtale og kart

Dato: 14. september 2026. Revidert etter Andreas sin høytlesning og tilbakemelding. Status: redaksjonelt demoopplegg; ikke implementert i boardet.

## Hva demoen skal vise

Brukeren velger eller spør om et tema, Placy gir en enkel oversikt over området, og kartet viser stedene som omtales. FAQ-ene angir hva demoen har innhold til å svare på. Brukeren skal også kunne snakke fritt og hoppe mellom dem.

Dette erstatter førsteutkastets familiescenario med barn på ti og fjorten. Alderstilpassede aktivitetsråd, barnemenyer, enkeltretter, priser og mattilpasninger inngår ikke i denne demoens redaksjonelle minimum. Forslaget om at en bestemt park eller klubb passer ungdommens sosiale liv er tatt ut.

Ranheim-opptakene gir formen: hva finnes, hvor ligger det, hvordan kommer man dit, og hvor finner man mer informasjon? Andreas sine nye stedseksempler er researchinnganger. De er ikke automatisk bekreftede fakta eller beskrivelser av hvordan alle ungdommer lever.

## Fast utgangspunkt er landet

Demoen bruker eksisterende kartmidtpunkt fra `board.json`: **63.43980508893858, 10.41725655026434**. Vis punktet som **«Nyhavna – demoens utgangspunkt»**. Det er et valgt referansepunkt, ikke en boligadresse eller en påstand om områdets geografiske midtpunkt.

Alle demoens reisetider skal beregnes fra dette punktet. Det trengs ikke en boligadresse for å lage sammenlignbare demotider. Brukerrettet korttekst: «Reisetider fra markert punkt på Nyhavna».

Første ruteberegning er gjennomført 14. september 2026 gjennom prosjektets Mapbox-proxy:

| Mål | Til fots | Gangavstand | På sykkel | Sykkelavstand |
| --- | --- | --- | --- | --- |
| Lilleby skole, Ladeveien 1 | ca. 16 min | 1 288 m | ca. 6 min | 1 506 m |
| Rosenborg skole, Stadsing Dahls gate 1 | ca. 20 min | 1 522 m | ca. 10 min | 2 288 m |

Skoleadressene er bekreftet hos [Lilleby skole](https://www.trondheim.kommune.no/org/oppvekst/skoler/lilleby-skole/) og [Rosenborg skole](https://www.trondheim.kommune.no/org/oppvekst/skoler/rosenborg-skole/). Kartverket gir adressepunktene. Fullstendige adresseoppslag, forespørsler og returnerte rutegeometrier ligger i [demo-ruter.json](2026-09-14-demo-ruter.json).

Minutter er avrundet opp av API-proxyen. Gang- og sykkelprofil velger forskjellige ruter. Rutene går til adressepunktene, ikke en manuelt kontrollert skoleport; Lillebys adressepunkt er merket `stedfestingverifisert: false` hos Kartverket. Dette er beregnede demotider, ikke en vurdering av trygg skolevei eller dagens anleggsforhold. Mapbox knytter startpunktet til veinettet cirka fire meter fra valgt koordinat.

## Foreslåtte FAQ-er som styrer innholdet

Disse 12 spørsmålene er et avgrenset utvalg for neste demo. Andre kategorier i boardet beholdes, men vises ikke som ferdig dekket gjennom dette dokumentet.

| Kategori | FAQ | Hva svaret skal inneholde | Grunnlag nå |
| --- | --- | --- | --- |
| Oppvekst | Hvilke skoler er aktuelle? | Lilleby og Rosenborg, med kort forbehold om Transittkaia og avklaring av skolekrets. | Eksisterende kontrollert materiale. |
| Oppvekst | Hvor langt er det til skolene? | Gang- og sykkeltid fra demoens punkt; skoler og ruter på kartet. | Fire ruter beregnet og lagret. |
| Oppvekst | Hvilke barnehager finnes i nærområdet? | Noen få navn, beliggenhet og lenker. | Eksisterende notat; stedsutvalg og ruter gjenstår. |
| Opplevelser / Trening / Natur | Hva kan vi gjøre som familie i nærområdet? | Bowling, padel og turmuligheter, presentert som et utvalg i området. | Dora 1 finnes i datasettet; padelside og kommunal omtale av Ladestien funnet. Ruter gjenstår. |
| Servering | Hvor finner vi kaféer og bakerier? | Snurr og Dora Kaffebar, hva slags sted de er og plasseringen. | Eksisterende materiale. |
| Servering | Hvilke restauranter finnes i nærheten? | Et lite utvalg, eksempelvis BistroBar og Ladejarlen, med lenker. | Eksisterende materiale. |
| Hverdag | Hvor handler vi dagligvarer? | To–tre butikker, avstand og eventuelle dokumenterte tjenester. | KIWI Lilleby bekreftet; flere butikker og ruter må inn. |
| Transport | Hvor er nærmeste holdeplass? | Navn, gangtid og plassering fra fast utgangspunkt. | Ny kontroll og ruteberegning trengs. |
| Transport | Hvordan kommer vi oss til sentrum? | Et enkelt kollektiv- og sykkelalternativ. | Ny kontroll trengs. |
| Transport | Kan vi bruke bildeling? | Tilbyder, hentested og lenke til vilkår og bestilling. | Nyhavna-tilbud må undersøkes. |
| Transport | Hvordan fungerer parkering? | Områdets tilbud; boligparkering beskrives bare når prosjektet oppgir det. | Ny kontroll trengs. |
| Servering | Hvor finner vi aktuelle åpningstider og menyer? | Lenker på stedskortene til virksomhetenes egne sider. | Mange lenker finnes allerede. |

Spørsmålene skal være redaksjonelle bestillinger: et punkt er klart når det har et kort svar, valgte steder, kilde og eventuelle beregnede reisetider. Manglende innhold skal fylles før punktet presenteres som et ferdig samtaletema.

## Enklere samtaleeksempel: området og skolene

**Bruker:** Hva kan vi gjøre som familie i området?

**Placy:** Her har dere blant annet bowling på Dora 1 og padel ved E.C. Dahls. For en tur ute er Ladestien et alternativ. Jeg viser stedene på kartet.

*Kart:* Vis Dora 1, padelstedet og et verifisert adkomstpunkt til Ladestien. Ikke sett en tilfeldig pin midt på en lang tursti. Dette svaret blir klart til runtime når stedene og adkomsten er verifisert. Ikke si «jeg viser» før kartfunksjonen faktisk har lykkes.

**Bruker:** Hvilke skoler er aktuelle?

**Placy:** Lilleby barneskole og Rosenborg ungdomsskole er de aktuelle skolene i planmaterialet for Transittkaia. Skoletilhørigheten må fortsatt avklares for den aktuelle boligen.

*Kart:* Vis skolene. Kortene sier «Aktuell skole for Transittkaia», ikke «Din skole».

**Bruker:** Hvor langt er det å gå?

**Placy:** Fra punktet vi bruker her på Nyhavna, er det beregnet rundt 16 minutter til Lilleby og 20 minutter til Rosenborg. Jeg viser gangrutene.

*Kart:* Vis referansepunktet og rutene fra det lagrede svaret. Rutevisning er foreslått, ikke implementert. Påstanden om hvilken skole boligen sogner til holdes adskilt fra beregningen av avstand til en skole.

## Enklere samtaleeksempel: servering og handel

**Bruker:** Hva finnes av kaféer her?

**Placy:** Snurr i Ladebekken er et alternativ for kaffe og frokost. Dere har også Dora Kaffebar i Kobbes gate. Her kan dere se hvor begge ligger.

*Kart og panel:* Vis to steder med korte beskrivelser og lenke til egen nettside. Eksakte åpningstider og anmeldelser inngår ikke i førstesvaret. Dora omtales som et dagtilbud på hverdager der eksisterende kilde støtter det; helgestengt er ikke bekreftet i materialet.

**Bruker:** Og hvis vi vil spise ute?

**Placy:** Nyhavna BistroBar i Ladebekken og Ladejarlen er to alternativer i nærområdet. På kortene finner dere lenker til menyene og åpningstidene deres.

*Kart og panel:* Fremhev restaurantene. Ingen enkeltretter, alderspriser eller generelle kvalitetskarakteristikker.

**Bruker:** Hva med dagligvarer?

**Placy, foreløpig faktagrunnlag:** KIWI Lilleby ligger i Stjørdalsveien. Der er det også pakkebokser fra Posten og PostNord.

*Redaksjonell oppgave:* Utvid til to–tre verifiserte butikker og beregn avstand før dette presenteres som områdets dagligvareoversikt. Ikke kall KIWI nærmest basert bare på dette ene oppslaget.

## FAQ som synlig framdrift

Forslag til UI, til utprøving:

- **Ikke utforsket:** spørsmålet er tilgjengelig å trykke på.
- **Aktiv:** valgt spørsmål fremheves mens samtalen handler om det. Relevante steder vises.
- **Utforsket:** en diskret hake vises etter at Placy har gitt svaret, eller brukeren har åpnet det fullstendige tekstsvaret. Ved avbrutt eller mislykket svar markeres det ikke automatisk som ferdig.

Et klikk velger temaet. Hvis stemmesamtalen er aktiv, sender klikket spørsmålet dit. Hvis stemmen ikke er aktiv, åpnes tekstsvaret med en tydelig mulighet til å snakke om det. Klikket skal ikke uventet aktivere mikrofonen.

Fri tale kan også markere en FAQ som utforsket når svaret dekker den. Et tilfeldig nevnt stedsnavn er ikke nok. Brukeren kan gå tilbake til alle spørsmål. «Utforsket» beskriver hva som er sett eller omtalt, ikke at brukeren har forstått eller godkjent det.

For første test foreslås status bare i den gjeldende økten, med mulighet til å nullstille. Ingen krav om å fullføre kategorien, tvungen rekkefølge eller poengsystem. En eventuell teller som «2 av 4 utforsket» vurderes etter testing.

## Datagrunnlag og vedlikehold

Runtime-utvalget bygges av stedsnavn, type tilbud, plassering, kort områdebeskrivelse, beregnede ruter og offisielle lenker. Menyer, enkeltpriser, rabattvilkår og detaljerte aldersregler beholdes i researcharkivet, men er ikke minimumsinnhold for denne demoen. Før en ny demo testes, må det aktive datasettutvalget faktisk avgrenses; en omskrevet tekst alene fjerner ikke detaljene fra dagens agentgrunnlag.

Åpningstider kan brukes når de er relevante og har kjent dato, men trenger ikke kopieres inn i hvert FAQ-svar. Ved konkrete spørsmål om dagens meny, tilgjengelighet eller åpning viser Placy til stedets oppdaterte side. Kilder og kontrolldato finnes i kortet; datoen trenger bare sies høyt når den påvirker svaret.

Gode anmeldelser, «fem minutter unna» og helgestengt brukes først når vurdering, reisemåte eller åpning faktisk er kontrollert. Mer generell formidling skal redusere vedlikeholdsbehovet, uten å erstatte dokumenterte opplysninger med salgsfraser.

## Kilder og status

Eksisterende [topics.json](../../../data/demo/nyhavna-lokal/topics.json) og [sources.json](../../../data/demo/nyhavna-lokal/sources.json) gir grunnlaget for skoler, barnehager, Dora 1, Snurr, Dora Kaffebar, BistroBar og Ladejarlen. Relevante notater: `oppvekst-skoler`, `oppvekst-barnehager`, `servering-bowling-familie`, `servering-snurr`, `servering-dora-kaffe`, `servering-bistro`, `servering-ladejarlen-mat`.

Nye, avgrensede kontroller 14. september:

- [KIWI Lilleby](https://kiwi.no/finn-butikk/kiwi-142-lilleby): butikk i Stjørdalsveien 2, utendørs pakkebokser fra PostNord og Posten. Ingen rangering som nærmest.
- [Nyhavna Padel](https://nyhavnapadel.no/): egen side oppgir padel, booking og Strandveien 53 ved E.C. Dahls. Siden lenker også til «Book Beach», men det alene bekrefter ikke Andreas sin beskrivelse av innendørs volleyball. Riktig virksomhetsnavn og besøksadkomst avklares ved opprettelse av kartstedet; nettsiden har også udatert åpningstekst.
- [Kommunens Ladeparken-side](https://trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/parker-og-byrom/ladeparken/): omtaler Ladestien langs sjøen som turmulighet. Adkomst fra demoens punkt er ikke beregnet ennå.
- Skoleadresser fra kommunens skolesider, adressepunkter fra Kartverket og fire ruteberegninger fra Mapbox er dokumentert over og i rutefilen.

## Neste utførelse

Ferdig i denne runden: enklere FAQ-styrt opplegg, reviderte samtaleeksempler, et fast referansepunkt, fire skoleberegninger, første bekreftede dagligvare og et konkret forslag til FAQ-status.

Deretter: fullfør det lille stedsutvalget og reisetidene som FAQ-ene krever, avgrens det aktive JSON-innholdet og koble stedene til kartet. FAQ-framdrift er et forslag fra denne tilbakemeldingen og må konkretiseres i UI-arbeidet. Ingen produktkode, eksisterende JSON-datasett eller kartfunksjon er endret i denne runden.
