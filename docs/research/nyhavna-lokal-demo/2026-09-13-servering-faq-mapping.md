# Servering: kontroll, revisjon og mapping til lokal demo

Kontrollert 13. september 2026. Grunnlag: `2026-09-13-servering-nyhavna.md`, bevart uendret. Dette dokumentet er revisjonssporet; bare kuraterte JSON-filer lastes av demoen.

## Omfang og metode

Rapporten har **14 FAQ-er, 66 faktaoppføringer og 34 stedsoppføringer**. P-30 samler seks virksomheter, så 34 oppføringer er ikke 34 enkeltsteder. Alle oppføringer er gjennomgått. Oppgavetekstens oppgitte tall 40 fakta stemmer ikke med de 66 unike F-ID-ene.

Tre gjennomganger: (1) vurderte alle oppføringer mot tilgjengelig kilde og relevans; (2) sjekket at valgte utsagn faktisk har riktig kilde/status og at alle øvrige har begrunnelse; (3) kontrollerte risikoutsatte egne valg på nytt, særlig søndag, alder, kaffepris, allergener og geografi.

Kildekontrollen bruker egne virksomhetssider og kommunale/utbyggersider. Google Places-, Kartverket- og Mapbox-endepunktene i rapporten er ikke lagrede oppslagsresultater. Vi importerer derfor ingen katalogattributter, koordinater eller gangminutter fra dem. Dette sier ikke at rapportens målinger er feil. Kobbes gate 2 er dessuten et annet referansepunkt enn boardets sentrum og ingen valgt boligadresse.

Alle 6 gamle serverings-ID-er er beholdt. 14 reviderte FAQ-er erstatter 6 importerte; 29 søkbare serveringsnotater gir dybde. 30 kildeoppføringer er lagt til, og eksisterende plankilder gjenbrukes. Alle andre kategorier er bevart. `places.json` er fortsatt tom.

## FAQ i samtalerekkefølge

| Nr. | Demo-ID | Spørsmål | Redaksjonell endring |
|---|---|---|---|
| 1 | `spisesteder` | Hva finnes av spisesteder på Nyhavna i dag? | Navngitte tilbud erstatter udokumentert antall og gangradius. |
| 2 | `kafe` | Hvor kan jeg ta en kaffe eller spise frokost? | Ingen nærmest-rangering fra Dora som om det var boligen. |
| 3 | `bakeri` | Hvor kjøper jeg brød og bakervarer? | Bruker dokumenterte bakerier; Buran-tid holdes tilbake. |
| 4 | `servering-familiemiddag` | Hvor kan vi spise en vanlig middag med barna? | Skiller aldersvilkår, ingen påstått universell barnepris. |
| 5 | `servering-barnemeny` | Hvilke steder har dokumenterte tilbud for barn? | Aldersgrensene står i svaret, ikke gjemt i et kildefelt. |
| 6 | `pizza` | Hvor kan vi få pizza, takeaway eller en rask matbit? | Beholder pizza-ID og dekker også takeaway; lover ikke levering. |
| 7 | `servering-pris` | Hva koster det å spise ute i nærområdet? | Eksempelretter med dato og størrelse, ikke generelt markedsprisnivå. |
| 8 | `servering-vegetar` | Hva finnes av vegetarisk og vegansk mat? | Bare eksplisitt veganske valg; allergi avklares direkte. |
| 9 | `servering-aktivitet` | Hvor kan vi kombinere mat med noe barna kan gjøre? | Aktivitet og matkostnad skilles. |
| 10 | `uteliv` | Hvor kan vi gå ut og spise eller ta et glass om kvelden? | Stedstype og kveldsbruk, ingen udokumentert nærmest-påstand. |
| 11 | `servering-ute` | Hvor kan vi spise ute eller sitte ved sjøen? | Dokumenterte alternativer og vær-/sesongforbehold. |
| 12 | `sondagsapent` | Hvilke alternativer har vi på søndager? | Åpningstid er datert; primærkildekonflikt sies tydelig. |
| 13 | `servering-sent` | Hvor kan vi få mat sent på kvelden? | Kjøkken er ikke bar; nattmat-hullet sies direkte. |
| 14 | `servering-fremtid` | Kommer det flere kafeer og restauranter når Nyhavna bygges ut? | Planforslag for delområde, ingen åpning eller aktør lovet. |

Rapportens `servering-paa-nyhavna`, `kafe-naermest`, `bakeri-broed`, `middag-med-venner`, `sondagsaapent` og `takeaway` bruker henholdsvis de bevarte ID-ene `spisesteder`, `kafe`, `bakeri`, `uteliv`, `sondagsapent` og `pizza`. De åtte øvrige temaene er beholdt med lokale servering-ID-er. Alle 14 rapport-FAQ-er er revidert, ingen kopiert ordrett.

## Alle fakta – beslutning og mål

27 revider, 23 behold, 16 hold tilbake. «Behold» betyr at faktakjernen er bekreftet; ikke at hele råteksten kopieres. Noen bekreftede detaljer er ikke relevante for denne første samtaledemoen. Mål uten prefiks viser `servering-<mål>` i `topics.json`.

| ID | Beslutning | Mål | Begrunnelse |
|---|---|---|---|
| F-A01 | Revider | monkey / FAQ spisesteder | Oversikten er ikke en uttømmende telling av spisesteder. |
| F-A02 | Behold | dora-kaffe | Offentlig kafé skilles fra interne byggfasiliteter. |
| F-A03 | Hold tilbake | — | Instagram kunne ikke leses; eksakte tider ikke nybekreftet. |
| F-A04 | Behold | dora-kaffe | Kun skillet mellom offentlig kafé og interne fasiliteter tas inn. |
| F-A05 | Behold | havet | Servering, badstu og kultur er dokumentert. |
| F-A06 | Behold | dahls | Adresse og egen stedsangivelse bekreftet. |
| F-A07 | Behold | bowling-mat / bowling-familie | Aktivitet og mat har eget belegg. |
| F-A08 | Revider | monkey | Utsalg omtales av utbygger; eksakte tider og matservering ikke bekreftet. |
| F-B01 | Revider | ramp | Bruk S12; Facebook var utilgjengelig ved ny kontroll. |
| F-B02 | Revider | ramp | Burgertyper beholdes; udaterert og omstridt kjøkkentid holdes tilbake. |
| F-B03 | Hold tilbake | — | Bare Google-opplysninger uten lagret API-resultat. |
| F-B04 | Hold tilbake | — | Kildetilgang, ikke kunnskap som skal sies til brukeren. |
| F-B05 | Hold tilbake | — | Dagligvarekandidat, ikke dokumentert aktuelt serveringstilbud. |
| F-B06 | Hold tilbake | — | Bokkafé omtalt; dagens servering og åpning ikke bekreftet. |
| F-C01 | Behold | ladejarlen-barn | Barnevilkåret følger priseksemplet. |
| F-C02 | Hold tilbake | egon (bare forbehold) | Kjedens dynamiske meny lot seg ikke etterprøve; avdelingspris ukjent. |
| F-C03 | Revider | egon | Avdelingssiden bekrefter pizzabuffet; priser, aldersvilkår og buffetdager holdes tilbake. |
| F-C04 | Revider | sabrura | Barneregel beholdes; samme voksenpris for alle måltider er ikke bekreftet. |
| F-C05 | Behold | bowling-familie | Mat inngår ikke i familiepakken; presisert. |
| F-C06 | Behold | — | Pristabell kontrollert, men detaljert seriepris er ikke valgt inn i første demo. |
| F-C07 | Revider | leos | Oppdatert død URL; priser ikke hentet betyr ikke upublisert. |
| F-C08 | Revider | barnemeny-uavklart | Fravær i én meny er ikke motbevis. Olivia-PDF nevner også Ramsalt. |
| F-C09 | Revider | dahls-meny | Ingen barneseksjon i den leste PDF-en, ikke bevist manglende barnetilbud. |
| F-D01 | Behold | bowling-mat | Velger noen priseksempler med størrelse; ingen billigst-rangering. |
| F-D02 | Revider | ladejarlen-mat / ladejarlen-barn | Barnepris var feilpresentert som voksenpris. To egne menyer har interne prisavvik. |
| F-D03 | Behold | dahls-meny | Sesongdatert PDF kontrollert, velger tre retter. |
| F-D04 | Behold | bistro-mat | Bruk faktisk meny; forsiden har også eksempelinnhold som ikke må brukes. |
| F-D05 | Revider | snurr | Laveste kaffepris gjelder espresso; lunsjspennet var ikke uttømmende. |
| F-D06 | Behold | una | Utvalgte pizzapriser kontrollert på egen meny. |
| F-D07 | Hold tilbake | egon (bare forbehold) | Kjedepriser kan ikke gjøres til bekreftede Solsiden-priser. |
| F-D08 | Hold tilbake | barnemeny-uavklart (bare forbehold) | Generell kjedemeny er feil grunnlag for lokal pris; lokalfil har også stedsavvik. |
| F-E01 | Revider | FAQ spisesteder / kafe | Fjerner udokumentert eksklusivitet om mandag ettermiddag. |
| F-E02 | Revider | havet-tider | Søndagskonflikt finnes mellom primærkilder. Rapportens lørdagstid for badstu var også feil; ikke importert. |
| F-E03 | Behold | dahls | Kjøkken og bar skilles, konsertforbehold beholdes. |
| F-E04 | Behold | ladejarlen-tid | Midlertidige tider beholdes uten privat sykdomsårsak. |
| F-E05 | Behold | ladejarlen-tid | Kafépausen må følge anbefalingen. |
| F-E06 | Behold | snurr | Egen side prioriteres fremfor katalogens avvik. |
| F-E07 | Hold tilbake | — | Buran-utslaget dokumenteres ikke på kjedens side; katalogtider ikke nybekreftet. |
| F-E08 | Hold tilbake | FAQ servering-sent (opplyser hullet) | Nattmattilbud er ikke primærbekreftet. Ingen klokkeslett fra Google importeres. |
| F-E09 | Revider | bistro | Søndag er ikke oppgitt, ikke uttrykkelig bekreftet stengt. |
| F-E10 | Hold tilbake | — | Y har bare katalogbelegg i materialet. |
| F-E11 | Behold | rosendal | Forestillingsåpning må ikke tolkes som utvidet kjøkkentid; bare relevant del importeres. |
| F-F01 | Revider | ladejarlen-mat | Bare eksplisitte veganske tilpasninger brukes, ikke gjetting fra rettnavn. |
| F-F02 | Revider | dahls-meny | Falafelburger har melk og egg; ikke vegansk som standard. |
| F-F03 | Revider | havet-mat | Vegansk konsept betyr ikke at hele serveringen er vegansk; tilbehør har melk. |
| F-F04 | Revider | bistro-mat | Rettnavn gir ikke vegansk status; melk er oppgitt. |
| F-F05 | Behold | bowling-mat | Glutenfri menyoppføring er ikke garanti mot krysskontakt. |
| F-F06 | Behold | sabrura | Tillegg bekreftet; individuell allergihåndtering må avklares. |
| F-F07 | Revider | FAQ servering-vegetar / relevante forbehold | Avgrenser til hva vi har kontrollert; sier ikke at alle steder mangler rutiner. |
| F-G01 | Behold | eksisterende oppvekst-bading | Ingen dublett. Kommunens badeplass-side kontrollert på nytt. |
| F-G02 | Behold | eksisterende oppvekst-bading / v-badeplass | Nedbørsforbehold finnes i kilden; ikke påstand om dagens vannprøve. |
| F-G03 | Revider | FAQ servering-ute | Fjerner Google-listen; bruker HAVET ved sjøen og Egons egen utebeskrivelse. |
| F-G04 | Revider | havet | Selve anlegget bekreftet; antall badstuer og sesong utelates. |
| F-H01 | Behold | havet-alder | Tids- og arrangementsforbehold følger aldersgrensene. |
| F-H02 | Revider | havet | Egen bordbestilling er dokumentert; ikke en uttrykkelig regel om gratis adgang uten bading. |
| F-H03 | Behold | — | Vilkår kontrollert, men arrangementsledsagerplasser er ikke valgt inn i matdemoen. |
| F-H04 | Hold tilbake | — | Negativt tilgjengelighetsattributt ikke bekreftet av Ramp. |
| F-H05 | Revider | rosendal-adkomst | Rosendal har konkret egenkilde; øvrige Google-attributter holdes tilbake. |
| F-I01 | Revider | planer | Bytter feil kildeattribusjon til utbyggers Transittkaia-side, holder planforslagstatus. |
| F-I02 | Revider | planer | Etappe-/markedsopplysningen finnes hos utbygger. Ingen garanti om restauranter ved innflytting. |
| F-I03 | Revider | planer | Manglende aktører avgrenses til kontrollerte sider, ikke hele offentligheten. |
| F-I04 | Hold tilbake | bistro (bare adresse/drift) | Nyest og åpningsmåned er ikke dokumentert. |
| F-J01 | Revider | snurr / bistro | Adressene er bekreftet; rute og koordinater er ikke lastet inn. |
| F-J02 | Hold tilbake | — | Google-adresse uten ny kildekontroll. Ingen behov for kartdata nå. |
| F-J03 | Hold tilbake | — | Sportsbarens attributter ikke bekreftet; ikke automatisk uegnet for barn. |
| F-J04 | Hold tilbake | — | Uavklart drift; manglende adresseoppslag beviser ikke at stedet ikke finnes. |

Nye utdypinger utover rapportens fakta: `servering-havet-mat` (lesbart menybilde), `servering-rosendal-mat` (pris-PDF), `servering-rosendal-adkomst` (rampe/heis), `servering-dromedar` (egen avdelingsside). Snurr-notatet presiserer vanlig kaffe versus espresso og et eksplisitt vegansk alternativ.

## Alle stedsoppføringer

Ingen kartsteder importeres. «Kunnskap» betyr at en avgrenset og kontrollert beskrivelse finnes i FAQ/notater, ikke at alle opplysninger fra stedsraden er bekreftet. Katalogpriser, Google-attributter og gangminutter er holdt utenfor for alle.

| ID | Sted | Beslutning |
|---|---|---|
| P-01 | Dora Kaffebar | Kunnskap: dora-kaffe |
| P-02 | HAVET Arena — Restaurant BarbeintQ og bar Heim | Kunnskap: havet / havet-tider / havet-alder / havet-mat |
| P-03 | E.C. Dahls Pub og Kjøkken | Kunnskap: dahls / dahls-meny |
| P-04 | Dora 1 Bowling & Biljard | Kunnskap: bowling-mat / bowling-familie |
| P-05 | Monkey Brew | Kunnskap: monkey |
| P-06 | The King | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-07 | Ramp Pub & Spiseri | Kunnskap: ramp |
| P-08 | Svartlamon Samvirkelag | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-09 | Ivar Matlaus bokkafé | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-10 | Ladejarlen (gastropub) | Kunnskap: ladejarlen-barn / ladejarlen-mat / ladejarlen-tid |
| P-11 | Ladejarlen Kafé | Kunnskap: ladejarlen-tid (pause) |
| P-12 | Brød&Sånt Buran | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-13 | S & S Kebab | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-14 | Thuy Asia Restaurant | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-15 | Y av Klempe og Dons | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-16 | Mellomveien (sportsbar) | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-17 | Rosendal Kafé (Rosendal Teater) | Kunnskap: rosendal / rosendal-mat / rosendal-adkomst |
| P-18 | Pizzabakeren Lade | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-19 | Nyhavna BistroBar | Kunnskap: bistro / bistro-mat |
| P-20 | Snurr Nyhavna | Kunnskap: snurr |
| P-21 | Leo's Lekeland Trondheim | Kunnskap: leos |
| P-22 | Sabrura Solsiden | Kunnskap: sabrura / sabrura-tid |
| P-23 | Egon Solsiden | Kunnskap: egon |
| P-24 | Olivia Solsiden | Kunnskap: barnemeny-uavklart (bare usikkerheten) |
| P-25 | Una Solsiden | Kunnskap: una / barnemeny-uavklart |
| P-26 | Godt Brød Solsiden | Kunnskap: godtbrod |
| P-27 | Dromedar Kaffebar Solsiden | Kunnskap: dromedar |
| P-28 | McDonald's Solsiden | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-29 | Héctor Food & Fiesta | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-30 | Bror Solsiden / SOT Bar & Burger / Brooklyn Diner / Heidi's Bier Bar / ØX Tap Room / Bar Passiar | Alle seks kandidatene holdes utenfor: Bror, SOT, Brooklyn, Heidi’s, ØX og Bar Passiar har bare katalogbelegg her. |
| P-31 | Cafe Løkka | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-32 | Tollbua | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-33 | Pirion Kaffebar | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |
| P-34 | Simens Isbar Brattørkaia | Bevart som researchkandidat; aktiv servering/detaljer ikke tilstrekkelig kontrollert. |

## Alle 32 opprinnelige kilder

En kilde som ikke brukes til faktasvar blir ikke lagt inn som om den var kontrollert runtime-kilde. Flerlenkekilder er splittet der forskjellen er viktig. Nye dokumentlenker finnes som egne oppføringer i `sources.json`.

| Rapport-ID | Kontroll og bruk |
|---|---|
| S01 | Lest; utbyggers omtale, ikke komplett serveringstelling. → s-nyhavna |
| S02 | Lest; overordnet utvikling. Konkret planforankring byttet til eksisterende v-nyhavna. |
| S03 | Lest. → s-dora |
| S04 | Instagram throttlet. Ingen nybekreftede eksakte tider; ikke importert. |
| S05 | Generisk API-endepunkt uten resultat/Place-ID-er. Ikke importert som faktakilde. |
| S06 | Hjem, meny og priser lest. Splittet → s-bowling, s-bowling-mat, s-bowling-pris. |
| S07 | Nettsted lest; utsalgsdetaljer avgrenset til S01. Ikke egen runtime-kilde. |
| S08 | Lest, inkludert menybilder. → s-havet og s-havet-meny. |
| S09 | Lest. → s-havet-faq. Forsiden lagt til for søndagskonflikten. |
| S10 | Konsept inngår i kontrollen, men ikke nødvendig som separat runtime-kilde. S08 brukes. |
| S11 | Facebook ga ingen lesbar respons. Ikke merket nyverifisert; S12 brukes. |
| S12 | Lest. → s-svartlamon. Udaterte klokkeslett holdt tilbake. |
| S13 | Begge menysider lest; interne prisavvik. → s-ladejarlen og s-ladejarlen-pizza. |
| S14 | Lest; midlertidige tider. → s-ladejarlen-tid. |
| S15 | Lest; vanlig kafétilbud pauset. → s-ladejarlen-kafe. |
| S16 | Lest; avdelingsinfo/tider. → s-dahls. |
| S17 | PDF lastet og lest; sesongdatert. → s-dahls-meny. |
| S18 | Lest; espresso versus kaffe og veganmerking kontrollert. → s-snurr. |
| S19 | Begge sider lest. Forsidens eksempelretter utelatt. → s-bistro og s-bistro-meny. |
| S20 | Begge sider lest. Ingen sikker fast voksenpris. → s-sabrura og s-sabrura-solsiden. |
| S21 | Avdelingsside lest; dynamisk meny ga ikke kontrollerbar pristabell. Bare avdelingssiden importert → s-egon. |
| S22 | PDF lest; ingen barneseksjon, og Ramsalt nevnes i Solsiden-filen. → s-olivia kun med eksplisitt usikkerhet. Generell PDF-lenke var ufullstendig. |
| S23 | Lest etter omdirigering til domene uten www. → s-una. |
| S24 | Lest. → s-godtbrod. |
| S25 | Siden ga ikke tilstrekkelig lesbart innhold i ny kontroll. Ikke importert. |
| S26 | Lest med ny pris-PDF og tilgjengelighetsside. → s-rosendal, s-rosendal-meny, s-rosendal-adkomst. |
| S27 | Gammel lenke feiler; ny avdelingsside kontrollert. → s-leos. |
| S28 | Kommunesiden lest på nytt; eksisterende v-badeplass/oppvekst-bading gjenbrukes. |
| S29 | Kunngjøring lest; konkret serveringsformulering finnes på utbyggers Transittkaia-side. → v-plan og v-nyhavna. |
| S30 | API-endepunkt uten lagrede adresseresultater. Ingen koordinater importert. |
| S31 | API-endepunkt uten lagrede ruter. Ingen minutter importert. |
| S32 | Kjedesiden lest; Buran finnes ikke i teksten. Ikke nok til å bekrefte utsalgets tider. |

## Hull og vedlikehold

- **Aktuell besøksdag:** Åpningstid er et kontrollert øyeblikksbilde, ikke live-status. HAVETs søndag må avklares mellom egne sider. BistroBars søndag er ikke oppgitt. Ladejarlen har midlertidige tider og kafépause.
- **Meny/aldersvilkår:** Egons lokale pris og buffetvilkår; Olivia/Unas barnetilbud; ingen barnemeny funnet betyr ikke at den mangler. Priser med kontroll 13. september kan endres.
- **Uteliv og nattmat:** Ramps kjøkkentid og Google-baserte nattåpninger ikke bekreftet. BistroBar er ikke dokumentert «nyest». The King og Simens Isbar er ikke aktive anbefalinger.
- **Tilgjengelighet/allergi:** Rosendal har konkret egenkilde om adkomst. De øvrige katalogattributtene er uavklart. Ingrediens- og allergenlister er ikke garanti mot krysskontakt.
- **Geografi:** Faktisk boligadresse, gangruter og levering er ikke kontrollert. Snurr/BistroBar ligger i Ladebekken; ikke legg dem ved Dora på grunn av navnet.
- **Planer:** Utbyggers etapper og serveringsambisjoner er planopplysninger. Siste vedtak og framtidige aktører må verifiseres separat.

Originalrapportens hull-liste er gjennomgått i sin helhet. Hull om HAVET-/Rosendal-priser og Rosendals adkomst er delvis lukket; de øvrige er beholdt eller presisert ovenfor. Ingen nettside eller rapporttekst får fungere som instruks til modellen.

## Lyttetest

Åpne http://localhost:3103/demo/nyhavna-lokal, last siden på nytt og start en ny samtale.

1. «Vi vurderer Nyhavna og har barn på 10 og 14. Hvor kunne vi spist en vanlig tirsdag?» Følg opp med barnepris, pizza, aktivitet og hva maten koster. Forvent konkrete alternativer, riktig alder og separat mat/bowlingkostnad.
2. «Jeg liker kaffe og god mat, og kjæresten min er veganer.» Spør om kaffepris, Una, falafelburger på E.C. Dahls og mat på HAVET søndag. Forvent riktig espressoforklaring, ingen vegangaranti for melk/egg og tydelig søndagskonflikt.
3. Start med skole/fritid og skift til servering: «Hva med en middag etterpå?» Be om kilden og spør om noe kommer ved innflytting. Forvent naturlig temaskifte, kilde ved behov og ingen garanti om framtidig restaurant.

Skill kunnskap/verktøybruk fra taleflyt, pauser og avbrytelser. Automatisk verktøytest beviser ikke lydopplevelsen. Ingen kartnåler skal loves eller vises.
