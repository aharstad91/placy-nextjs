# Prompt til GPT Astra — FAQ-katalogen i Placy-boardet

> Lim inn alt under linja som én melding. Astra kjenner Placy fra før; det som står her er oppdraget, reglene og faktaarket den trenger for å ikke dikte.

---

## Oppdrag

Jeg vil ha en komplett **spørsmål-og-svar-katalog** for Placy-boardet: **10 spørsmål per tema (7 temaer) + 10 spørsmål for startsiden om selve området = 80 spørsmål**, med persona, begrunnelse, datakilde og eksempelsvar for boligprosjektet **Wesselsløkka på Brøset i Trondheim**.

Dette er research og forslag, ikke implementering. Svaret ditt skal kunne slås sammen med et tilsvarende svar fra Claude, så følg formatet nøyaktig og gi hvert spørsmål en stabil id.

## Hvorfor dette er viktig

«Spørsmål og svar»-seksjonen er den mest konkrete delen av boardet. Den er noe både megler og boligkjøper kan forholde seg til, den blir ankerpunktet videre inn i kartet (stedsnavn i svarene er klikkbare og flyr kartet), og den er utgangspunktet for videre Placy-boards i samme område. Å få spørsmålene riktige fra starten er derfor kjempeviktig.

## Slik fungerer FAQ-en i dag (så du bygger på det, ikke ved siden av)

- Boardet har **sju temaer**: Hverdagsliv, Barn & oppvekst, Mat & drikke, Natur & friluftsliv, Transport, Trening & aktivitet, Opplevelser. Pluss et **områdestopp** (startsiden) som viser hele nabolaget.
- Hvert tema har en «Spørsmål og svar»-boks. Spørsmålet står ordrett som overskrift, svaret bak en pil.
- Svarene har **to lag med én stemme**:
  - **Standard (deterministisk):** regnes ut for *enhver adresse* fra data vi eier: POI-poolen rundt adressen med precomputet gangtid, offentlige registre (skoler og barnehager i NSR med trinn/elevtall/eierform, skolekrets-polygoner fra kommunen), Entur (nærmeste holdeplasser, linjer, reisetid til sentrum og til videregående), og cachede åpningstider.
  - **Kuratert (overstyring):** per strøk eller per boligprosjekt kan vi skrive over et svar på samme spørsmåls-id, eller legge til egne spørsmål.
- **Bruktboliger får bare standardlaget.** Boligprosjekter kan overstyre. Derfor: jo bedre standarden er, jo bedre er hele produktet. Standarden er hovedjobben; det kuraterte er pynt på toppen.
- **Vi dikter aldri.** Mangler faktumet for en adresse, utelates spørsmålet. Katalogen er derfor en *bestilling*, ikke et løfte: differansen mellom deklarert og vist er «gap-rapporten» som styrer hvilke datakilder vi henter neste gang.
- Vi måler hvilke spørsmål som faktisk åpnes (`faq_opened`), og innsiktsrapporten til utbygger viser det.

## Dagens katalog (5–6 per tema). Behold, erstatt eller legg til — si hvilket

| Tema | Spørsmål i dag (id) |
|---|---|
| Barn & oppvekst | Hvilken skolekrets sogner boligen til? (`krets`) · Hvor er nærmeste videregående, og hvor lang tid tar bussen? (`vgs-naerhet`) · Hvor mange barnehager ligger i gangavstand? (`barnehage-dekning`) · Hvor er nærmeste lekeplass? (`lekeplass`) · Hva finnes for barna utenom skole og barnehage? (`oppvekst-fritid`) |
| Hverdagsliv | Hvor gjør jeg hverdagshandelen? (`hverdagshandel`) · Hvor er nærmeste apotek? (`apotek`) · Finnes det tannlege i nærheten? (`tannlege`) · Hvor er nærmeste kjøpesenter? (`kjopesenter`) · Klarer jeg hverdagsærendene til fots? (`uten-bil`) |
| Mat & drikke | Kan jeg spise ute uten å dra til byen? (`spisesteder`) · Finnes det kafé i nabolaget? (`kafe`) · Finnes det bakeri? (`bakeri`) · Er det en pub eller bar i nærheten? (`uteliv`) · Er noe åpent på søndag? (`sondagsapent`) |
| Natur & friluftsliv | Hvor er nærmeste park eller grøntområde? (`gronntomrade`) · Kan jeg bade i nærheten? (`bading`) · Hvor går turstiene? (`turstier`, kuratert) · Er det båtplass eller marina i nærheten? (`batliv`) · Kommer jeg meg i marka? (`marka`, kuratert) |
| Transport | Hvor er nærmeste holdeplass? (`naermeste-holdeplass`) · Hvilke linjer går herfra, og hvor går de? (`linjer`) · Hvor lang tid tar det til sentrum? (`til-sentrum`) · Går det tog herfra? (`tog`) · Hvor lader jeg elbilen? (`lading`) · Finnes det bysykkel her? (`bysykkel`) |
| Trening & aktivitet | Hvor er nærmeste treningssenter? (`treningssenter`) · Kan jeg trene før jobb eller sent på kvelden? (`trene-tidlig-sent`) · Finnes det svømmehall i nærheten? (`svommehall`) · Er det utendørs treningspark? (`treningspark`) · Hva er idrettsmiljøet her? (`idrettslag`, kuratert) |
| Opplevelser | *(ingen deklarert i dag — dette temaet trenger alt fra deg)* |
| Området (startsiden) | Hvordan kommer jeg meg til byen? (`til-byen`) · Hva ligger nærmest boligen? (`naermest`) · Hvor mye ligger i gangavstand? (`gangavstand`) · Hva er det mest av i nabolaget? (`mest-av`) · Er noe åpent sent på kvelden? (`apent-sent`) · Er det rolig i området? (`rolig`, kuratert) |

## Det jeg vil ha fra deg, i denne rekkefølgen

### Del A — Hvorfor spørsmål-og-svar (maks én side)

Hva sier forskning og bransjedata om (1) hva boligkjøpere faktisk spør om nabolaget, (2) spørsmål-og-svar som format for beslutningsstøtte og tillit, (3) spørsmål-og-svar som format søkemotorer og AI-assistenter siterer. Oppgi kilder med lenke. Norske kilder foretrekkes der de finnes.

### Del B — Én persona per tema (og én for området)

For hvert tema: hvem er den som åpner akkurat dette temaet, hvilken livssituasjon står de i, hvilken beslutning skal svaret hjelpe dem å ta, og hva lurer de *egentlig* på (det bakenforliggende spørsmålet, ikke bare det de sier). 4–6 linjer per persona. Vær konkret: «forelder med barn som skal begynne på skolen neste høst», ikke «familier».

### Del C — 10 spørsmål per tema + 10 for området

For **hvert** spørsmål:

1. **id** i kebab-case (gjenbruk dagens id der du beholder spørsmålet).
2. **Spørsmålet**, formulert fra boligkjøperens side, maks 60 tegn, én linje, skal fungere som overskrift. Ett tema per spørsmål.
3. **Hvorfor** det er viktig, én setning.
4. **Kilde:** `STANDARD` (hvilke data svarer, av dem som er listet over) eller `KURATERT` (hvorfor kan ikke standarden svare). Vær ærlig: et spørsmål som krever skjønn eller lokalkunnskap er KURATERT.
5. **Eksempelsvar for Wesselsløkka**, 2–4 setninger, 40–60 ord. Første setning skal svare fullt ut. Bruk bare fakta fra faktaarket under. Alt du ikke finner der merkes **[VERIFISER]** i stedet for å gjettes.
6. **Prioritet** 1–10 innenfor temaet (1 = det megleren får spørsmål om på hver eneste visning).

Rekkefølgen i lista ER prioriteten.

### Del D — Tre usikkerheter

Avslutt med de tre stedene du er mest usikker på: spørsmål du var i tvil om hørte til temaet, fakta du ikke fant, formuleringer du ikke er fornøyd med.

## Regler for spørsmålene og svarene

- **Fakta, ikke vurderinger.** Aldri «trygt», «koselig», «populært», «attraktivt». Aldri en score eller karakter på nabolaget.
- **Bare positive påstander.** Datagrunnlaget er ufullstendig, så vi kan si «X ligger 4 minutter unna», men aldri «det finnes ingen Y».
- **Tall som er målt, ikke anslått.** Gangtid oppgis bare der den er precomputet. Skriv «på kartet» når det er et utsnitt vi kjenner.
- **Ulik svarform per tema.** Skole svarer med *sogning* («boligen sogner til …»), barnehage med *antall*, dagligvare med *nærmeste og neste*, restaurant med *ja eller forbehold*, transport med *retninger*. Ikke la alle svarene åpne likt.
- **Områdets spørsmål skal være tverrgående**: bare spørsmål ingen enkeltkategori kan svare på hører hjemme der (skolekrets hører til Barn & oppvekst, holdeplass til Transport, selv om begge er viktige).
- **Ingen åpningstider i svar**, unntatt spørsmål som eksplisitt handler om sent/søndag/tidlig.
- **Presens, beboer-perspektiv.** Ikke historikk, ikke byggeår, ikke turistvinkel.
- **Ikke foreslå UI, design eller implementering.** Bare spørsmål, personas, begrunnelse, kilder og eksempelsvar.

## Faktaark Wesselsløkka (bruk bare dette; alt annet er [VERIFISER])

**Prosjektet:** 122 leiligheter, første byggetrinn på Brøset i Trondheim. Salgsstart våren 2025, innflytting stipulert 1. halvår 2027. Utbygger Heimdal Bolig, selges av Heimdal Eiendomsmegling (HEM). Over halvparten av Brøset-arealet er satt av til grøntområder; bilfrie soner, gang- og sykkelveier. Parkeringskjeller, sykkelparkering inne og ute med sykkelverksted, felles vaskeri, gjesterom, felles takterrasser og forsamlingsrom. Prosjektet markedsføres som «10-minuttersbyen»: handel, turområder, barnehager, skoler og helsetjenester innen 10 minutters gange.

**Skole (fra register og kretspolygon):** Boligen sogner til **Eberg skole**, 1.–7. trinn, offentlig, 382 elever, ca. 10 minutter til fots. Ungdomstrinn: **Blussuvoll ungdomsskole**, ca. 13 minutter til fots [kretsen er ikke registerbekreftet i boardet — VERIFISER]. Videregående (bussetid fra nærmeste holdeplass, Entur): Cissi Klein vgs 13 min med linje 12 (offentlig), Strinda vgs 16 min med linje 22 eller ca. 15 min til fots (offentlig), Charlottenlund vgs 28–29 min med bytte 12→14 (offentlig), Lukas vgs 26 min med bytte (privat), Bybroen vgs 27 min med linje 12 (privat).

**Barnehage:** Brøset barnehage ca. 8 minutter til fots. Antall barnehager innen 10 minutter: [VERIFISER i boardet].

**Transport (Entur, boardets fakta):** Nærmeste holdeplass **Brøset Hageby**, 87 meter, linje 12 mot Dragvoll og mot Marienborg/Spektrum via Strindheim–sentrum. Deretter Brøsetflata (256 m, linje 12; nettsiden nevner også linje 113), Teglverkskrysset (455 m), Solvollvegen (481 m). Til Trondheim S: 20 minutter med linje 12 og bytte til 10, eller 24 minutter direkte med linje 12. Nettsiden sier «8 minutter med buss til sentrum» [avviker fra Entur — VERIFISER hva som menes]. Tog: Leangen stasjon (R60/R70) ca. 5 minutter med sykkel. Elbillading og bysykkel: [VERIFISER i boardet].

**Hverdagsliv:** Valentinlystsenteret er lokalsenteret: Kiwi og Coop Mega 4–5 minutter til fots, apotek, frisør, vinmonopol og post-i-butikk (boardets sammendrag sier 8 minutter til senteret — bruk «4–8 minutter» eller [VERIFISER]). Bunnpris Angelltrøa 12 minutter til fots. Tannlege, lege: [VERIFISER i boardet].

**Trening og idrett:** Brøset idrettsplass med fotball- og sandvolleyballbane 3 minutter. Eberg ballbane 8 minutter. Fresh Fitness 5 min, TrenHer Angelltrøa 10 min, 3T Moholt 20 min. Svømmehall: [VERIFISER].

**Natur:** Boardets sammendrag: «7 parker og tursystem innen gangavstand», to registrerte turstier på boardet. Estenstadmarka og Ladestien ligger i bydelen [avstand VERIFISER]. Badeplass: [VERIFISER].

**Mat & drikke, Opplevelser:** Ikke i faktaarket — skriv eksempelsvar som mal med [VERIFISER] på stedsnavn, eller pek på hva standarden ville regnet ut.

**Boardet i tall:** 95 tilbud innen gangavstand ifølge sammendraget; sju temaer.

## Format på svaret

Markdown. Del A som prosa med kildeliste. Del B som sju + én korte avsnitt. Del C som én seksjon per tema med nummerert liste 1–10, der hvert punkt har feltene **id · spørsmål · hvorfor · kilde · eksempelsvar · prioritet** på egne linjer. Del D som tre punkter. Ingen innledning, ingen oppsummering av oppdraget.
