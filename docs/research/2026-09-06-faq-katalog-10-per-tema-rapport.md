# FAQ-katalogen: 10 spørsmål per tema + 10 for området

**Dato:** 2026-09-06
**Type:** Research + forslag (ingen implementering)
**Utløser:** Andreas: *«jeg har stor tro på at disse spørsmål og svar er det som blir svært viktig i placy. for det er så konkret … det blir ankerpunkt videre inn i bruken av kartet … jeg ønsker at vi har en prosess her hvor det skapes 10 stykk FAQ per kategori + 10 for startsiden om selve området.»* Tillegg underveis: personas per kategori, og at standarden må være god nok for bruktbolig alene — prosjekter overstyrer.
**Parallelt løp:** Samme oppdrag er sendt GPT Astra ([prompten](2026-09-06-faq-katalog-astra-prompt.md), [svaret](2026-09-06-faq-katalog-astra-svar.md)). **Sammenslått og verifisert versjon: [2026-09-06-faq-katalog-sammenslatt.md](2026-09-06-faq-katalog-sammenslatt.md) — den gjelder foran denne der de avviker** (bl.a. er AI-siterings-avsnittet i § 1c nedtonet, og fem åpningstids-rader er S+ ikke S).
**Bygger på:** [brainstorm 2026-08-22](../brainstorms/2026-08-22-faq-lokalkunnskap-niva1-requirements.md), worklog 2026-08-22/23/27, `lib/editorial/category-specs.ts` (katalogen), `lib/generators/faq-generator.ts` (byggerne).

---

## 0. Sammendrag

1. **Formatet er riktig, og forskningen støtter det.** Boligkjøpere spør om det samme overalt — skole, kollektiv, dagligvare, natur, støy, parkering — og spørsmål-og-svar er formatet både mennesker og AI-assistenter plukker opp. NN/G-regelen «aldri finn på spørsmål som ikke stilles» er identisk med vår «dikter aldri»-regel. Ingen konkurrent (FINN Nabolagsprofil inkludert) svarer i spørsmålsform.
2. **Standarden er hovedjobben.** Bruktbolig får bare standardlaget; prosjekter overstyrer på samme spørsmåls-id. Av de 80 foreslåtte spørsmålene kan **48 svares av standarden i dag**, **28 med én ny datakilde** (Entur-rutetabell, SSB grunnkrets, støysonekart, NOBIL, planinnsyn, Places-attributter), og bare **4 er kuratert-eneste**.
3. **Wesselsløkka viser 26 svar i dag, og fire av dem er feil på en måte som skader tilliten**: FAQ-en ser ikke inn i kjøpesenter-ankeret (Boots Apotek på 8 minutter tapes for Apotek 1 på 17; Fresh Fitness på 6 tapes for TrenHer på 15), «trene tidlig/sent» svarer med et studentkontor som er åpent 08–15.45, søndagsåpent-svaret nevner steder 40 minutter unna, og skolen boligen sogner til har ingen gangtid. Dette må fikses **før** katalogen utvides — ti spørsmål med fire feil er verre enn fem riktige.
4. **Prosessen** er seks steg: personas → kandidatspørsmål (dette dokumentet + Astra, slås sammen) → klassifisér hver som Standard / Standard+ny kilde / Kuratert → svarform per spørsmål → byggere + test på tre adresser (Brøset, Grilstad, Sundsøya) → mål med `faq_opened` og rydd kvartalsvis.

---

## 1. Hvorfor spørsmål-og-svar er riktig format

### 1a. Det kjøperne spør om er stabilt og kjent

Kildene er samstemte om hvilke fem–seks ting som avgjør nabolagsvalget, og de matcher temaene i boardet nesten én-til-én:

| Kilde | Hva den sier |
|---|---|
| Asker kommunes innbyggerpanel, boforhold og boligbehov 2023 (Husbanken-arkivet) | Friluftsområder nevnes av **91 %** som viktig å ha i nærheten; holdeplass og butikker «viktig for de fleste»; skole/barnehage avtar med alder; **7 av 10** handler dagligvarer i nærmiljøet. |
| Nordvikundersøkelsen 2026 (Norstat for Nordvik, 26 steder) | Det folk er mest stolte av: beliggenhet/tilgjengelighet, turområder og natur, **ro og stillhet**, gode naboer, nærhet til sentrum. Det de savner: «tettere fellesskap». |
| FINN (bedriftskunde, Nabolagsprofil) | **82 %** mener beliggenhet er en viktig driver, **73 %** at nabolaget er viktig ved boligvalg. |
| Sjekklister for visning (eiendomsmegler.no, Krogsveen) | Sol, støy/trafikk, kollektiv, skole/barnehage, dagligvare, parkering/elbillader, sykkelparkering. Krogsveen: «besøk området på ulike tidspunkter». |
| NAR Profile of Home Buyers and Sellers 2025 (USA, ~170 000 utsendte) | Nabolagets kvalitet **59 %**, nærhet til familie/venner 47 %; nærhet til jobb har falt fra 52 % (2014) til **31 %** — livsstil og fellesskap veier mer, pendling mindre. |
| OsloMet (Turner m.fl., registerdata 20 000 familier 1993–2017) | Folk velger nabolag etter hvem som bor der (formue, likhet). Det er spørsmålet «hvem bor her?» — som FINN svarer på med SSB-tall og vi ikke gjør. |

To ting følger. Temaene våre dekker det kjøperne spør om, så katalogen kan bygges ut uten å endre temastrukturen. Og tre spørsmål vi ikke svarer på i dag går igjen i alle kildene: **støy/ro**, **hvem bor her**, og **blir det bygget noe**. Alle tre kan standardiseres fra offentlige kilder (støysonekart, SSB grunnkrets, kommunens planinnsyn).

### 1b. Spørsmål-og-svar som beslutningsstøtte

Nielsen Norman Group («FAQs Still Deliver Great Value»): FAQ-er virker fordi de svarer i brukerens ordforråd, viser åpenhet og lar leseren *eliminere* temaer raskt ved å skanne spørsmål. Deres viktigste regel står som nr. 7 på lista over de ti verste designfeilene: **«Do not make up questions that are not being asked»** — oppdiktede spørsmål undergraver tilliten til hele siden. Det er nøyaktig vår «dikter aldri»-regel, bare speilvendt: vi må heller ikke dikte *spørsmål*. Derfor er `faq_opened`-målingen (som nå er i drift, `FAQSection.tsx:96`) ikke bare innsikt til utbygger, men kvalitetsporten for katalogen: spørsmål ingen åpner skal ut.

For Placy er det tre grunner til at formatet treffer bedre enn prosa:

- **Megleren gjenkjenner det.** Spørsmålene er de megleren får på hver visning. Det gjør boardet til et verktøy megleren kan stå inne for, ikke en tekst megleren må lese korrektur på.
- **Svaret er et sted på kartet.** Hvert stedsnavn i et svar flyr kartet dit. Spørsmålet blir inngangen til kartet, ikke en tekstblokk ved siden av det.
- **Spørsmåls-id-en er kontrakten.** Samme id på tvers av standard, kuratert og en fremtidig chat-ruter. Katalogen er også gap-rapporten: deklarert minus vist per adresse sier hvilken datakilde som mangler.

### 1c. Spørsmål-og-svar som siterbar enhet (søk og AI)

Contently (mars 2026) og flere analyser av AI-søk sier det samme: spørsmål-svar-par er formatet AI-assistenter siterer, fordi enheten matcher en brukers prompt. Konkrete tall derfra: **25 % av Google-søk** utløste AI Overview i Q1 2026; **44 % av ChatGPT-siteringer** kommer fra de første 30 % av teksten; anbefalt svarlengde **40–60 ord**, første setning skal svare fullt ut; spørsmål under 15 ord. En påstand om at FAQPage-skjema gir 3,2× høyere sjanse for AI Overview går igjen i bransjeartikler, men er leverandørdata — bruk den ikke som fakta.

For boardet i seg selv (embeddet i iframe) betyr dette mindre. Det betyr mye for **placy.no-sidene per strøk** som kan komme senere: en «Brøset»-side med de samme 80 spørsmålene er en side søkemotorer forstår. Skriv svarene i den formen fra starten (40–60 ord, svar først), så koster det ingenting.

### 1d. Inkumbenten svarer ikke i spørsmål

FINN Nabolagsprofil viser avstander, SSB-statistikk og beboer-undersøkelse per adresse, men som datapunkter og kart — ikke som svar på spørsmål. Ingen norsk aktør vi har kartlagt (Nabolagsprofil, Marketer/HomeKey, Kvass, Fastout) formulerer nabolaget som spørsmål og svar. Det er en ledig posisjon, og den er billig for oss fordi katalogen allerede finnes.

---

## 2. Prinsippet: standard først, overstyring etterpå

Andreas' formulering: *«dette kan jo standardiseres, så for bruktbolig med standard tekst funker det, og med boligprosjekter kan vi skrive over, men jo bedre standard, jo bedre.»*

Det er allerede slik koden er bygd (to lag, én stemme, `source` er intern). Konsekvensen for katalogen er en **klassifisering per spørsmål**, som styrer hva vi bygger:

| Klasse | Betyr | Hvor svaret bor |
|---|---|---|
| **S — Standard i dag** | Bygger finnes eller kan skrives fra data vi alt har på hvert board (POI-pool + gangtid, NSR, kretspolygoner, Entur-fakta, åpningstider) | `faq-generator.ts`, én bygger per id |
| **S+ — Standard med ny kilde** | Deterministisk, men trenger ett nytt build-time-oppslag (navngitt per spørsmål) | Nytt steg i provisjoneringen → `boardFacts` → bygger |
| **K — Kuratert** | Krever skjønn eller lokalkunnskap registrene ikke har | `reportConfig.themes[].faq[]` / `globalFaq[]` per prosjekt eller strøk |

Kvalitetskravet til standarden må være høyere enn til det kuraterte, ikke lavere, fordi den står alene på 108 000 bruktboliger i året. Regler som gjelder alle svar (uendret fra 08-22, gjentatt fordi de er testkriteriene):

- Positive påstander alene. Poolen er recall-begrenset, så «finnes ikke» kan vi aldri si.
- Tall som er målt. Gangtid bare der den er precomputet.
- Ulik svarform per tema. Skole = sogning, barnehage = antall, dagligvare = nærmeste + neste, restaurant = ja/forbehold, transport = retninger.
- 40–60 ord, første setning svarer. Stedsnavn lenkes.
- Ingen vurderinger («trygt», «koselig»), ingen score.

---

## 3. Personas — hvem åpner hvert tema, og hva lurer de egentlig på

Personaen bestemmer rekkefølgen på spørsmålene (1 = det megleren får hver gang) og svarformen. Én persona per tema er en forenkling; den er valgt som *den som åpner temaet først*.

**Området (startsiden) — «Den som skal forstå stedet på ti sekunder».** Har annonsen åpen på mobilen, kjenner ikke bydelen. Beslutning: er dette verdt en visning? Lurer egentlig på: hva slags sted er dette, hvor lang tid tar det til byen, hvem bor her, er det rolig, og blir det bygget noe rett ved. Dårlig svar: tre nærmeste steder der ett er en hundepark.

**Barn & oppvekst — «Forelderen som planlegger ti år frem».** Barn 0–12 eller planlegger barn. Beslutning: kan vi bo her til barna er ferdige på ungdomsskolen? Lurer egentlig på: hvilken skole *blir* det (ikke nærmeste, men den boligen sogner til), kan barnet gå selv, får vi barnehageplass, hvor er de andre barna, hva gjør de etter skoletid. Dårlig svar: «Eberg skole, 382 elever» uten gangtid.

**Hverdagsliv — «Logistikksjefen».** Den som drar husholdningen: handler på vei hjem, henter pakker, følger barn til lege. Beslutning: får jeg unna ærendene til fots, uten omvei? Lurer egentlig på: hva ligger på veien hjem, hvor sent kan jeg handle, hvor får jeg hjelp når noen er syk. Dårlig svar: nærmeste apotek på 17 minutter når det ligger ett på 8.

**Mat & drikke — «Paret som vil at nabolaget skal ha et eget liv».** Voksne uten små barn, eller familien på fredag. Beslutning: må vi til byen for alt? Lurer egentlig på: er det et sted å møtes, et bakeri lørdag morgen, takeaway fredag, kaffe før jobb. Dårlig svar: «Ja — Burger King og Egon» som bevis på spisesteder.

**Natur & friluftsliv — «Den som må ut».** Løper, går tur med hund eller barnevogn, går på ski. Beslutning: kommer jeg ut i grønt uten bil? Lurer egentlig på: hvor starter turen, er det lys om vinteren, hvor er skiløypa, hvor kommer jeg til sjøen. Dårlig svar: bare «Brøset Hundepark, 3 minutter».

**Transport — «Pendleren uten bil nummer to».** Jobb i sentrum, på Gløshaugen, St. Olavs eller Sluppen. Beslutning: klarer vi oss med én bil, eller ingen? Lurer egentlig på: dør-til-dør til jobb, hvor ofte går bussen, når går siste buss hjem, kan jeg sykle. Dårlig svar: «linje 12 mot Dragvoll og linje 12 mot Marienborg» uten frekvens.

**Trening & aktivitet — «Den som trener tre ganger i uka».** Har medlemskap i en kjede, svømmer, spiller padel. Beslutning: fortsetter rutinen min her? Lurer egentlig på: er min kjede her, kan jeg trene før jobb, hvor er svømmehallen, hvor spiller jeg. Dårlig svar: «Sit holder åpent 08–15.45».

**Opplevelser — «Den som flytter til byen og lurer på hva man gjør her».** Også familien en regnværssøndag. Beslutning: er det liv her, eller bare et soverom? Lurer egentlig på: bibliotek, kino, hva skjer i bydelen, hvor møtes folk. Dårlig svar: temaet har null spørsmål i dag.

---

## 4. Katalogen — 80 spørsmål

Rekkefølgen er prioriteten. Eksempelsvarene for Wesselsløkka er skrevet fra **boardets faktiske data** (POI-pool med precomputet gangtid, `boardFacts`, registerfakta) der de finnes; fakta fra `wesselslokka.no` er merket (nettsiden); alt som ikke er bekreftet er merket **[VERIFISER]**. «Standard i dag:» viser hva byggeren faktisk skriver nå, der det avviker fra ønsket svar.

Tegnforklaring kilde: **S** standard i dag · **S+** standard med ny kilde (navngitt) · **K** kuratert.

### 4.1 Området (startsiden)

| # | id | Spørsmål | Hvorfor | Kilde | Wesselsløkka |
|---|---|---|---|---|---|
| 1 | `til-byen` | Hvordan kommer jeg meg til byen? | Første spørsmål fra alle som ikke kjenner bydelen. | S | Til Trondheim S tar det 20 minutter med linje 12 og bytte til 10, eller 24 minutter direkte med linje 12 fra Brøset Hageby. Se Transport for holdeplassene. *(Nettsiden sier «8 minutter med buss til sentrum» — avviker fra Entur. [VERIFISER] hva som menes.)* |
| 2 | `naermest` | Hva ligger nærmest boligen? | Gir stedet skala med én gang. | S | Nærmest ligger Brøset Hageby holdeplass (ett minutt), SUMART Dagligvare (3 minutter) og Valentinlyst Senter (7 minutter). *Standard i dag: nevner Brøset Hundepark som nr. 2. Forslag: nærmeste per tema, ikke tre nærmeste totalt.* |
| 3 | `gangavstand` | Hvor mye ligger i gangavstand? | «10-minuttersbyen» i ett tall. | S | 16 steder på kartet ligger innenfor ti minutter til fots, 4 av dem innenfor fem. *(Boardets `summary` sier «95 tilbud innen gangavstand» — to definisjoner av gangavstand på samme board. Rydd.)* |
| 4 | `sykkel-10` | Hva rekker jeg på ti minutter med sykkel? | Brøset er planlagt for sykkel; sykkeltider er alt precomputet. | S | Innenfor ti minutter på sykkel ligger Valentinlyst Senter, Leangen bydelshall, Moholt Storsenter, Fresh Fitness og 3T Moholt. *(Tallet på steder ≤10 min sykkel må telles av byggeren.)* |
| 5 | `mest-av` | Hva er det mest av i nabolaget? | Forteller karakteren uten å vurdere. | S | Oppvekst er størst med 267 steder, Servering følger med 135. |
| 6 | `apent-sent` | Er noe åpent sent på kvelden? | Hverdagsfriksjon. | S | *Standard i dag: Dokkparken og Grilstad mall «til midnatt» — begge langt utenfor gangavstand. Byggeren mangler radius.* Ønsket: Coop Mega Valentinlyst holder åpent til 23 på hverdager (nettsiden/leadText, [VERIFISER] åpningstid). |
| 7 | `rolig` | Er det rolig i området? | Nordvik 2026: ro og stillhet er det folk verdsetter mest. | **S+** Støysonekart (Statens vegvesen / kommunens støykart, gul og rød sone) | Boligen ligger utenfor gul støysone fra vei [VERIFISER mot støykart]. Brøset er regulert med bilfrie soner internt (nettsiden). |
| 8 | `hvem-bor-her` | Hvem bor i nabolaget? | OsloMet: det avgjørende, uuttalte spørsmålet. FINN svarer med SSB-tall, vi ikke. | **S+** SSB befolkning per grunnkrets (alder, husholdningstype) | I grunnkretsen bor det [X] personer; [Y] % er under 18 år, [Z] % av husholdningene er par med barn [VERIFISER, SSB]. |
| 9 | `blir-det-bygget` | Blir det bygget noe i nærheten? | Ingen konkurrent svarer. Brøset er selve svaret her. | **S+** Kommunens planinnsyn (vedtatte reguleringsplaner innen 500 m) | Ja. Wesselsløkka er første byggetrinn av områdeplanen for Brøset (vedtatt 2013), som legger opp til en ny bydel med over halvparten av arealet som grøntområder. Flere byggetrinn følger [VERIFISER planinnsyn for neste trinn]. |
| 10 | `til-arbeidsplassene` | Hvor lang tid tar det til de store arbeidsplassene? | NAR: pendling veier mindre enn før, men er fortsatt 31 %. Per by: St. Olavs, Gløshaugen, Sluppen, Værnes. | **S+** Entur trip mot konfigurert liste per by | Til St. Olavs hospital [X] minutter med buss, til Gløshaugen [Y], til Værnes [Z] [VERIFISER, Entur]. |

*Ikke med, og hvorfor:* «Hva kjennetegner strøket?» er introen (`karakteristikk`), ikke en rad. «Hvilken skolekrets?» og «nærmeste holdeplass» hører til temaene sine (regelen fra 08-27: bare tverrgående spørsmål på området).

### 4.2 Barn & oppvekst

| # | id | Spørsmål | Hvorfor | Kilde | Wesselsløkka |
|---|---|---|---|---|---|
| 1 | `krets` | Hvilken skolekrets sogner boligen til? | Spørsmålet megleren får på hver visning. | S | Boligen sogner til Eberg skole, 1.–7. trinn, offentlig, 382 elever. Ungdomstrinnet hører til Blussuvoll skole, 8.–10. trinn, som tar imot elever fra Eberg, Åsvang, Strindheim og Berg (kommunen). *Standard i dag: mangler ungdomstrinnet — `schoolZone.ungdomsskole` er tom på boardet.* |
| 2 | `skolevei` | Hvor lang er skoleveien til fots? | Avgjør om barnet kan gå selv. | S (gangtid til kretsskolen) | Til Eberg skole er det rundt ti minutter til fots (nettsiden), til Blussuvoll 15 minutter. *Standard i dag: kan ikke svare — Eberg skole har ingen precomputet gangtid på boardet (registerimporterte POI-er får ikke reisetid).* |
| 3 | `vgs-naerhet` | Hvor er nærmeste videregående, og hvor lang tid tar bussen? | Inntaket er karakterbasert, så nærhet og reisetid er det vi kan si. | S | Cissi Klein videregående er raskest å komme til: 13 minutter med linje 12. Strinda videregående tar 16 minutter med linje 22, eller 21 minutter til fots. Begge er offentlige. |
| 4 | `barnehage-dekning` | Hvor mange barnehager ligger i gangavstand? | Antall er svaret for en som mangler plass. | S | 2 barnehager ligger innenfor 10 minutters gange: Bromstad barnehage på 8 minutter og Brøset barnehage på 10. Innenfor et kvarter er det 10, blant dem Hagebyen private barnehage og Leangen kulturbarnehage. |
| 5 | `barnehage-plass` | Hvor lett er det å få barnehageplass? | Det egentlige spørsmålet bak nr. 4. | **S+** Kommunens barnehageopptak / BASIL (ledige plasser, kapasitet) | [VERIFISER — Trondheim kommune publiserer ledige plasser per barnehage]. |
| 6 | `lekeplass` | Hvor er nærmeste lekeplass? | Småbarnsforelderens hverdag. | S | Ole Hogstads veg lek er nærmeste lekeplass, 11 minutter unna. Eberg Sykkelpark ligger 13 minutter til fots. *(Nettsiden lover lekeplasser inne på Wesselsløkka — ikke bygd ennå, derfor ikke i poolen. Prosjektet bør overstyre.)* |
| 7 | `idrettsanlegg-barn` | Hvor trener barna — nærmeste bane og hall? | Organisert idrett er det største oppvekst-innholdet i poolen (110 steder). | S | Leangen bydelshall ligger 12 minutter unna, Eberg idrettsplass med kunstgress 15 minutter, Blussuvollhallen 15. *(Nettsiden: Brøset idrettsplass 3 minutter — finnes ikke i poolen. [VERIFISER] om den er bygd.)* |
| 8 | `oppvekst-fritid` | Hva finnes for barna utenom skole og barnehage? | Fritidsklubb, bibliotek, svømmehall samlet. | S | Urban fritidsklubb ligger 21 minutter til fots eller 8 med sykkel. Moholt bibliotek er 21 minutter unna. *Standard i dag: ingen rad — byggeren ser bare `fritidsklubb` og krever gangavstand.* |
| 9 | `helsestasjon` | Hvor er nærmeste helsestasjon? | Småbarnsforeldre spør; ingen svarer. | **S+** Egen kategori (ligger i dag som `doctor`) | Falkenborg helsestasjon ligger 25 minutter til fots, 10 med sykkel. |
| 10 | `barnefamilier` | Bor det mange barnefamilier her? | «Hvor er de andre barna?» | **S+** SSB grunnkrets (andel 0–17 år) | [VERIFISER, SSB]. Brøset som ny bydel vil endre tallet raskt — vis årstall for tallet. |

### 4.3 Hverdagsliv

| # | id | Spørsmål | Hvorfor | Kilde | Wesselsløkka |
|---|---|---|---|---|---|
| 1 | `hverdagshandel` | Hvor gjør jeg hverdagshandelen? | 7 av 10 handler i nærmiljøet. | S | SUMART Dagligvare er nærmest, 3 minutter til fots. Coop Mega på Valentinlyst Senter ligger 8 minutter unna, Bunnpris Angelltrøa 14. *Standard i dag: hopper over Coop Mega fordi den er medlem av senter-ankeret.* |
| 2 | `uten-bil` | Klarer jeg hverdagsærendene til fots? | Terskelspørsmålet. | S | Dagligvare, apotek, kjøpesenter og bakeri ligger innenfor 10 minutter til fots. *Standard i dag: «dagligvare og kjøpesenter» — apotek og bakeri tapes til ankeret.* |
| 3 | `apotek` | Hvor er nærmeste apotek? | | S | Boots Apotek på Valentinlyst Senter ligger 8 minutter til fots. Apotek 1 Strindheim er alternativet, 17 minutter. *Standard i dag: bare Apotek 1, 17 minutter.* |
| 4 | `legesenter` | Hvor er nærmeste legesenter? | Barn blir syke. | S | Persaunet legesenter ligger 15 minutter til fots, 7 med sykkel. |
| 5 | `tannlege` | Finnes det tannlege i nærheten? | | S | *Ingen rad: poolen har 0 tannleger rundt Brøset — recall-hull, ikke fravær. Gap-rapport.* |
| 6 | `kjopesenter` | Hvor er nærmeste kjøpesenter? | | S | Valentinlyst Senter er nærmeste, 7 minutter til fots, med dagligvare, apotek, bakeri og treningssenter. Moholt Storsenter ligger 19 minutter unna, Sirkus Shopping 23. |
| 7 | `pakker-post` | Hvor henter jeg pakker og post? | Hver uke, for alle. | **S+** Posten/Bring hentesteder (åpent API) eller Places-attributt | Post i butikk finnes på Valentinlyst Senter og Bunnpris Angelltrøa (nettsiden) [VERIFISER]. |
| 8 | `dagligvare-lengst-apent` | Hvilken dagligvare har lengst åpent? | Etter trening, etter sen jobb. | S (cachede åpningstider) | Coop Mega Valentinlyst holder åpent til 23 på hverdager (leadText) [VERIFISER]. |
| 9 | `vinmonopol` | Hvor er nærmeste Vinmonopol? | Norsk hverdagsspørsmål. | S (kategori `liquor_store`) | *Ingen rad: kategorien er tom i poolen selv om boardets sammendrag nevner polet på Valentinlyst. Recall-hull.* |
| 10 | `legevakt-sykehus` | Hvor er nærmeste legevakt eller sykehus? | Trygghetsspørsmålet. | S (kategori `hospital`) | St. Olavs hospital [VERIFISER reisetid — trolig linje 12/10 via sentrum, kan svares av `til-arbeidsplassene`-oppslaget]. |

### 4.4 Mat & drikke

| # | id | Spørsmål | Hvorfor | Kilde | Wesselsløkka |
|---|---|---|---|---|---|
| 1 | `spisesteder` | Kan jeg spise ute uten å dra til byen? | Ja/nei-spørsmålet. | S | Ja, men tynt til fots: Burger King ligger 9 minutter unna og Egon Tårnet 15. Med sykkel åpner Moholt seg på 8–9 minutter, med Sabi Sushi, Domino's og Frumento. *Standard i dag: «Ja — 2 spisesteder … Burger King og Egon» — sant, men ikke det leseren vil høre. Forslag: når ≤2 innen gange, legg til sykkelringen.* |
| 2 | `kafe` | Finnes det kafé i nabolaget? | Møteplassen. | S | Rosenborg bakeri på Valentinlyst Senter har kafé, 8 minutter til fots. Nærmeste rene kafé er Dromedar på Sirkus Shopping, 22 minutter til fots eller 10 med sykkel. *Standard i dag: Filo Café, 22 minutter — bakeriet tapes til ankeret.* |
| 3 | `bakeri` | Finnes det bakeri? | Lørdag morgen. | S | Rosenborg bakeri Valentinlyst ligger 8 minutter til fots. Mikalsen bakery er 19 minutter unna. *Standard i dag: bare Mikalsen.* |
| 4 | `takeaway` | Hvor henter jeg takeaway? | Fredagsspørsmålet. | **S+** Places-attributter `takeout`/`delivery` (Atmosphere-SKU) | Burger King (9 min), Domino's Pizza Moholt og Sabi Sushi Moholt (begge ca. 9 min med sykkel) tilbyr henting [VERIFISER attributt]. |
| 5 | `kaffe-for-jobb` | Hvor får jeg kaffe før jobb? | Morgenrutinen; svarform = tidligst åpent. | S (åpningstider) | [VERIFISER — Rosenborg bakeri Valentinlyst åpner trolig 07]. |
| 6 | `uteservering` | Hvor kan jeg sitte ute? | Sommerspørsmålet. | **S+** Places-attributt `outdoorSeating` | [VERIFISER]. |
| 7 | `barnevennlig` | Hvor kan vi spise ute med barna? | Familiens fredag. | **S+** Places-attributter `goodForChildren`/`menuForChildren` | Egon Tårnet, 15 minutter til fots, [VERIFISER attributt]. |
| 8 | `uteliv` | Er det en pub eller bar i nærheten? | | S | Dragvollkjelleren ligger 21 minutter til fots. *(Ærlig svar: uteliv er en bytur herfra. Standarden bør heller peke på `til-byen` når nærmeste er over 20 min.)* |
| 9 | `sondagsapent` | Er noe åpent på søndag? | | S | *Standard i dag: Sabrura Sticks & Sushi ×2 — 40 minutter unna. Byggeren mangler radius (samme feil som `apent-sent`).* |
| 10 | `stamsted` | Hvor møtes nabolaget? | Det Nordvik-respondentene savner: fellesskap. | **K** | Prosjektet overstyrer: f.eks. felleslokalene på Wesselsløkka, Valentinlyst Senter som lokalsenter [K]. |

### 4.5 Natur & friluftsliv

| # | id | Spørsmål | Hvorfor | Kilde | Wesselsløkka |
|---|---|---|---|---|---|
| 1 | `gronntomrade` | Hvor er nærmeste park eller grøntområde? | 91 % vil ha friluft nær. | S | Brøset Hundepark ligger 3 minutter til fots. Spruten friområde med akebakke er 12 minutter unna, Persaunet park 14. |
| 2 | `turstier` | Hvor går turstiene? | | **S+** `reportConfig.trails` (2 registrert) + OSM turstier; K for beskrivelse | Estenstadmarka med stier og skiløyper starter fra nabolaget, Ladestien langs fjorden ligger ca. 40 minutter til fots eller 17 med sykkel (leadText/poolen). [VERIFISER inngang til Estenstadmarka]. |
| 3 | `marka` | Kommer jeg meg i marka? | Trondheim-spesifikt og viktig. | **S+** Markagrense-polygon (kommunens kart) → avstand | Estenstadmarka [avstand VERIFISER]. |
| 4 | `hund` | Hvor kan hunden løpe fritt? | Hundeeiere er en stor gruppe; poolen har svaret. | S (kategori hundepark) | Brøset Hundepark ligger 3 minutter til fots. |
| 5 | `lysloype-lopetur` | Finnes det lysløype eller løperunde? | Vinterhalvåret. | **S+** Kommunens lysløyper / OSM `lit=yes` | [VERIFISER — Estenstadmarka har lysløype fra Tyholt/Dragvoll]. |
| 6 | `ski` | Hvor er nærmeste skiløype? | | **S+** skisporet.no-feed (åpent) | [VERIFISER — Estenstadmarka]. |
| 7 | `bading` | Kan jeg bade i nærheten? | | S | Devlebukta er nærmeste badeplass, 37 minutter til fots eller 17 med sykkel. Rotvollfjæra ligger 15 minutter unna med sykkel. |
| 8 | `akebakke` | Hvor er nærmeste akebakke? | Trondheimsvinteren, barnefamilier. | **S+** Navnetagg (Spruten «med akebakke», Akebakken Blussuvoll) | Spruten friområde har akebakke, 12 minutter unna. Akebakken Blussuvoll ligger 21 minutter til fots. |
| 9 | `til-fjorden` | Hvor langt er det til fjorden? | Trondheim = fjordby. | **S+** Avstand til kystlinje (Kartverket) | [VERIFISER — Ladestien ca. 17 min med sykkel]. |
| 10 | `gront-andel` | Hvor mye grønt er det rundt boligen? | «Norges grønneste nabolag» — målt, ikke påstått. | **S+** Andel grøntareal innen 500 m (AR5/OSM landuse) | Over halvparten av arealet på Brøset er satt av til grøntområder (områdeplanen) — standarden bør regne ut tallet for 500-metersringen. |

### 4.6 Transport

| # | id | Spørsmål | Hvorfor | Kilde | Wesselsløkka |
|---|---|---|---|---|---|
| 1 | `naermeste-holdeplass` | Hvor er nærmeste holdeplass? | | S | Brøset Hageby ligger 90 meter fra boligen, Brøsetflata 250 meter. |
| 2 | `linjer` | Hvilke linjer går herfra, og hvor går de? | | S | Fra Brøset Hageby går linje 12 mot Dragvoll og mot Marienborg og Spektrum via Strindheim og sentrum. *Standard i dag: «linje 12 … og linje 12 …» — retningene bør slås sammen.* Nettsiden nevner også linje 113 fra Brøsetflata [VERIFISER]. |
| 3 | `til-sentrum` | Hvor lang tid tar det til sentrum? | | S | Til Trondheim S tar det 20 minutter med linje 12 og bytte til 10, eller 24 minutter direkte. |
| 4 | `frekvens` | Hvor ofte går bussen? | Det pendleren egentlig spør om. | **S+** Entur estimatedCalls i rush (avganger/time) | Linje 12 går hvert 15. minutt (boardets sammendrag) [VERIFISER mot Entur]. |
| 5 | `siste-buss` | Når går siste buss hjem? | Bytur uten bil. | **S+** Entur rutetabell | [VERIFISER]. |
| 6 | `sykkel-til-byen` | Hvor lang tid tar det å sykle til sentrum? | Brøset er planlagt for sykkel. | **S+** Mapbox sykkeltid til byens sentrumspunkt (ett oppslag) | [VERIFISER — ca. 15–20 minutter]. |
| 7 | `tog` | Går det tog herfra? | | S | *Ingen rad: Leangen stasjon mangler i poolen (0 `train`). Nettsiden: 5 minutter med sykkel til Leangen, R60/R70. Recall-hull.* |
| 8 | `bysykkel` | Finnes det bysykkel her? | | S | Trondheim Bysykkel har stativ på Valentinlyst (9 minutter) og Kong Øysteins veg (10 minutter). |
| 9 | `lading` | Hvor lader jeg elbilen? | Krogsveen-sjekklista. | **S+** NOBIL (åpent ladestasjonsregister) | *Ingen rad i dag: 0 `charging_station` i poolen.* Wesselsløkka har parkeringskjeller (nettsiden) [ladepunkter VERIFISER]. |
| 10 | `til-flyplassen` | Hvor lang tid tar det til Værnes? | Trondheims mest stilte reisespørsmål. | **S+** Entur trip mot TRD | [VERIFISER — trolig linje 12 til Trondheim S + tog/flybuss]. |

*Kandidat som falt ut:* `bildeling` (S, kategori `carshare`, 0 i poolen) — tas inn når poolen har data.

### 4.7 Trening & aktivitet

| # | id | Spørsmål | Hvorfor | Kilde | Wesselsløkka |
|---|---|---|---|---|---|
| 1 | `treningssenter` | Hvor er nærmeste treningssenter? | | S | Fresh Fitness på Valentinlyst Senter ligger 6 minutter til fots, Feelgood i samme senter 8. TrenHer og Feel24 Tyholt ligger begge et kvarter unna. *Standard i dag: TrenHer 15 min — ankerfeilen igjen.* |
| 2 | `kjeder` | Hvilke treningskjeder finnes i nærheten? | «Er min kjede her?» — medlemskapet flytter med. | S (kjedegjenkjenning på navn) | Fresh Fitness, Feelgood, 3T (Moholt, 19 minutter), Feel24 og Sit er representert innenfor 20 minutter til fots. |
| 3 | `trene-tidlig-sent` | Kan jeg trene før jobb eller sent på kvelden? | | S (åpningstider) | *Standard i dag: «Sit holder åpent 08–15.45» — feil POI (studentkontor) og feil logikk. Byggeren må kreve åpning ≤06 eller stenging ≥22, ellers ingen rad.* Fresh Fitness er døgnåpent for medlemmer [VERIFISER]. |
| 4 | `svommehall` | Finnes det svømmehall i nærheten? | | S | Nærmeste svømmehall ligger 30 minutter til fots, 13 med sykkel [VERIFISER hvilken — POI heter bare «Svømmehall»]. |
| 5 | `idrettsanlegg` | Hvor er nærmeste idrettshall og kunstgress? | Voksenidrett og lag. | S | Leangen bydelshall ligger 12 minutter unna, Eberg idrettsplass med kunstgress 15, Blussuvollhallen 15. |
| 6 | `is-skoyter` | Hvor er nærmeste ishall eller skøytebane? | Trondheimsvinteren. | **S+** Navne-/typetagg (Leangen ishaller, Curlinghall) | Leangen har to ishaller og curlinghall, 12–13 minutter til fots (leadText/poolen). |
| 7 | `padel-tennis` | Hvor kan jeg spille padel, tennis eller squash? | Raskest voksende voksenidrett. | **S+** Google-typer/OSM `sport=*` | [VERIFISER]. |
| 8 | `treningspark` | Er det utendørs treningspark? | | S | *Ingen rad: 0 `fitness_park` i poolen.* |
| 9 | `spa-badstue` | Finnes det spa eller badstue i nærheten? | | S | Thai Klinikk på Sirkus Shopping ligger 24 minutter til fots. *(Tynt. Fjordsauna-kategorien mangler i poolen.)* |
| 10 | `idrettslag` | Hva er idrettsmiljøet her? | | **K** | Kuratert: Freidig (Eberg), Strindheim IL [VERIFISER]. |

### 4.8 Opplevelser

Temaet har **null** deklarerte spørsmål i dag. Kategoriene (museum, bibliotek, kino, bowling, teater) er urbane; i forstad vil standarden svare tynt, og det er riktig — men bibliotek og «regnværsdag» kan svares nesten overalt.

| # | id | Spørsmål | Hvorfor | Kilde | Wesselsløkka |
|---|---|---|---|---|---|
| 1 | `bibliotek` | Hvor er nærmeste bibliotek? | Gratis, for alle aldre. | S | Trondheim folkebibliotek Moholt ligger 21 minutter til fots, 10 med sykkel. |
| 2 | `regnvaersdag` | Hva gjør vi en regnværsdag? | Familiens søndag; samler innendørs på tvers. | S (svømmehall + bibliotek + bowling + museum ≤20 min sykkel/buss) | Moholt bibliotek (10 minutter med sykkel), svømmehall (13 minutter med sykkel) og Leangen med curlinghall (12 minutter til fots). |
| 3 | `kino` | Hvor er nærmeste kino? | | S | Prinsen kino i sentrum, 42 minutter til fots eller ca. 24 med buss (linje 12). |
| 4 | `hva-skjer` | Hva skjer i bydelen gjennom året? | «Er det liv her?» | **S+** Event-konteksten (Moat 2-konvolutten) / kommunens arrangementskalender | [VERIFISER]. |
| 5 | `kulturscene` | Finnes det konsertscene eller kulturhus? | | **S+** Kategori `theater`/`concert_hall` | [VERIFISER — Trondheim Spektrum ligger på linje 12]. |
| 6 | `museum` | Hvor er nærmeste museum? | | S | Trondheim Kunstmuseum Gråmølna ligger 33 minutter til fots, 15 med sykkel. |
| 7 | `bowling-aktivitet` | Hvor er nærmeste bowling eller aktivitetssenter? | Tenåringer og bursdager. | S (kategori bowling) | *Ingen rad: 0 i poolen.* |
| 8 | `arena` | Hvilke store arenaer ligger innen kort reise? | Konserter og kamper. | **S+** Kategori stadion/arena | Trondheim Spektrum og Lerkendal [VERIFISER reisetid]. |
| 9 | `samlingspunkt` | Hvor er bydelens torg eller samlingspunkt? | | **K** | Kuratert: Valentinlyst Senter / Brøsets planlagte torg [VERIFISER]. |
| 10 | `voksenaktivitet` | Finnes det kor, kurs eller klubber for voksne? | Nordvik: fellesskap er det folk savner. | **K** | Kuratert. |

### 4.9 Oppsummert per klasse

| Tema | S | S+ | K | Deklarert i dag | Vist på Wesselsløkka i dag |
|---|---|---|---|---|---|
| Området | 6 | 4 | 0 | 6 | 5 |
| Barn & oppvekst | 7 | 3 | 0 | 5 | 4 |
| Hverdagsliv | 9 | 1 | 0 | 5 | 4 |
| Mat & drikke | 6 | 3 | 1 | 5 | 5 |
| Natur & friluftsliv | 3 | 7 | 0 | 5 | 2 |
| Transport | 5 | 5 | 0 | 6 | 4 |
| Trening & aktivitet | 7 | 2 | 1 | 5 | 2 |
| Opplevelser | 5 | 3 | 2 | 0 | 0 |
| **Sum** | **48** | **28** | **4** | **37** | **26** |

(`turstier`, `marka` og `rolig` er telt som S+ fordi kilden er navngitt, selv om de i dag står som kuratert-eneste. De fire ekte K-ene er `stamsted`, `idrettslag`, `samlingspunkt` og `voksenaktivitet`.)

---

## 5. Det Wesselsløkka viser i dag, og det som må fikses i standarden først

Kjørt via boardets egen render-sti (`getProductFromSupabaseV2 → transformToReportData`) 2026-09-06. 895 POI-er i poolen, 26 FAQ-rader vist.

**Feil som skader tilliten (fiks før utvidelse):**

1. **FAQ-en ser ikke inn i ankrene.** `report-data.ts` fjerner medlemmer av kjøpesenter-ankre fra temaets liste før `generateCategoryFaq` får den. På Brøset er Valentinlyst Senter ankeret, og medlemmene er nettopp de nærmeste svarene: Coop Mega (8 min), Boots Apotek (8), Rosenborg bakeri (8), Fresh Fitness (6), Feelgood (8). Standarden svarer derfor Apotek 1 på 17 minutter, TrenHer på 15, Mikalsen bakery på 19 og Filo Café på 22. Det er den samme feilklassen vi kritiserer FINN for (riktig data, feil avstand). Byggerne må få `allPois` inkludert medlemmer, eller ankeret må «svare for» medlemmene.
2. **`trene-tidlig-sent` svarer «Sit holder åpent 08–15.45».** POI-en «Sit» er et studentsamskipnadskontor, ikke et treningssenter, og byggeren leverer et svar selv når åpningstiden ikke er tidlig eller sen. Regel: ingen rad uten åpning ≤06:00 eller stenging ≥22:00.
3. **`sondagsapent` og `apent-sent` mangler radius.** De nevner Sabrura ×2, Dokkparken og Grilstad mall — alle 35–45 minutter unna. Samme 10/15-minuttersramme som resten.
4. **Kretsskolen har ingen gangtid.** Eberg skole (`nsr-979195052`), Strinda vgs og andre registerimporterte POI-er har `travelTime = null`. `skolevei` kan ikke svares, og `krets`-svaret står uten det tallet foreldre vil ha. Reisetids-precompute må dekke registerkilder.

**Recall-hull i poolen (gap-rapporten for Brøset):** 0 tannleger, 0 Vinmonopol (`liquor_store`), 0 ladestasjoner, 0 tog (Leangen stasjon mangler), 0 treningsparker, 0 bowling, 0 bildeling. Brøset idrettsplass (nettsiden: 3 min) og Kiwi Valentinlyst (nettsiden: 4–5 min) finnes ikke i poolen — enten ikke bygd, eller ikke fanget. Hvert av disse er et deklarert spørsmål uten rad, og det er nøyaktig det gap-rapporten skal vise.

**Inkonsistens mellom lag:** boardets `summary` (Gemini/Fable-skrevet) sier «95 tilbud innen gangavstand» og «senteret på 8 minutter»; FAQ-en sier 16 steder innen 10 minutter og senteret på 7. To definisjoner av gangavstand på samme skjerm. Standarden bør eie tallet, og sammendraget bør lese det derfra.

**Det som fungerer:** `krets`, `vgs-naerhet`, `barnehage-dekning`, `naermeste-holdeplass`, `til-sentrum`, `bysykkel`, `kjopesenter`, `gronntomrade`, `bading` gir riktige, etterprøvbare svar. Det er kjernen standarden skal vokse fra.

---

## 6. Prosessen: fra 5 til 10 per tema, uten å miste tilliten

**Steg 1 — Personas og kandidater (denne uka).** Dette dokumentet + Astras svar slås sammen per id. Regel for sammenslåing: samme spørsmål med to formuleringer → velg den korteste som fungerer som overskrift; to ulike spørsmål på samme plass → begge inn, prioriteten avgjør hvem som vises. Mål: 10 per tema, rangert.

**Steg 2 — Klassifisér (S / S+ / K) og navngi kilden.** For hvert S+ må kilden være et konkret oppslag (Entur rutetabell, SSB grunnkrets-API, støysone-WMS, NOBIL, planinnsyn, Places-attributter, skisporet.no). Et spørsmål uten navngitt kilde er K, ikke S+. Dette blir én tabell i `category-specs.ts` (feltet `felt` finnes alt).

**Steg 3 — Skriv svarformen per spørsmål før byggeren.** Én setningsmal per id, ulik form per tema, 40–60 ord, svar i første setning, hva som skjer ved 0 / 1 / 2+ treff, og radiusen (5 / 10 / 15 min). Det er dette som hindrer «41 tekster som åpner likt». Malen er testkriteriet.

**Steg 4 — Fiks de fire feilene i §5, så byggerne for S.** Test hver bygger på tre adresser med ulik tetthet: Wesselsløkka (forstad, anker), Strindfjordvegen 10 Grilstad (kuratert strøk) og Sundsøya (ruralt). Kravet er ikke at alle 10 vises overalt — det er at ingen rad er feil. Gap-rapporten per adresse (deklarert − vist) skrives ut av testen.

**Steg 5 — Prosjektoverstyring som workshop.** For Wesselsløkka: HEM/Thomas får rollen fra møte-1-manuset — prioritere spørsmål per kategori og fylle K-ene (stamsted, idrettslag, samlingspunkt) pluss det som ikke er bygd ennå (lekeplasser og idrettsplass inne på feltet). Svarene lagres på samme id i `reportConfig.themes[].faq[]` / `globalFaq[]`. Standarden viser fortsatt alt den kan under.

**Steg 6 — Mål og rydd.** `faq_opened` er i drift. Etter 30 dager per board: spørsmål under 20 % av snittet flyttes ned eller ut (`underperformingFaq` i innsiktsmodulen gjør alt beregningen). Kvartalsvis gjennomgang av katalogen. Test-gulvet heves fra 5 til 10 deklarerte per tema når byggerne er på plass — ikke før.

**Hva som ikke endres:** spørsmåls-id som kontrakt, «dikter aldri», build-time only, ingen score. Antall viste rader kan variere per adresse; katalogen er bestillingen.

---

## 7. Anbefaling

Ikke bygg katalogen ut før ankerfeilen og de tre andre §5-feilene er rettet — de rammer nettopp Wesselsløkka, som er demoen. Deretter: slå sammen med Astra, klassifisér, skriv svarformene, og ta S-spørsmålene først (48 stykker, ingen ny datakilde). S+-spørsmålene er én datakilde hver; de tre som gir mest per krone er **støysonekart** (`rolig`), **SSB grunnkrets** (`hvem-bor-her`, `barnefamilier`) og **Entur rutetabell** (`frekvens`, `siste-buss`, `til-flyplassen`, `til-arbeidsplassene`) — tre oppslag, sju spørsmål, og alle tre er ting FINN Nabolagsprofil enten ikke har eller ikke svarer på i spørsmålsform.

---

## Kilder

- Nielsen Norman Group, *FAQs Still Deliver Great Value* — https://www.nngroup.com/articles/faqs-deliver-value/
- Nielsen Norman Group, *Top 10 Web Design Mistakes* (nr. 7: «Do not make up questions that are not being asked») — via https://www.nngroup.com/reports/strategic-design-faqs/
- Contently, *How to Write FAQs That LLMs Actually Cite (2026)* — https://contently.com/2026/03/17/faqs-that-llms-cite/
- Asker kommune, *Boforhold og boligbehov 2023* (innbyggerpanel) — https://www.asker.kommune.no/contentassets/78d969567b0f4078bc4f0a6485f06ea3/rapport-fra-en-undersokelse-i-asker-kommunes-innbyggerpanel.-boforhold-og-boligbehov-2023.pdf
- Husbanken, *Boligmarkedsanalyse Oslo* — https://biblioteket.husbanken.no/arkiv/dok/Komp/07/Boligmarkedsanalyse_Oslo.pdf
- Nordvik, *Nordvikundersøkelsen 2026* — https://www.nordvikbolig.no/nordvikundersokelsen/undersokelse-2026
- FINN, *Nabolagsprofil for bedriftskunder* — https://www.finn.no/bedriftskunde/eiendom/nabolagsprofil
- forskning.no / OsloMet, *Hvordan velger folk nabolag?* — https://www.forskning.no/by-oslomet-partner/hvordan-velger-folk-nabolag-forskerne-fikk-seg-noen-overraskelser/2703439
- UiO, *Barnefamilier må velge mellom nok plass og et godt kollektivtilbud* — https://www.uio.no/forskning/forskningsnytt/artikler/2025/barnefamilier-ma-velge-mellom-plass-og-kollektivtilbud.html
- eiendomsmegler.no, *Sjekkliste på visning* — https://eiendomsmegler.no/sjekkliste-visning-tips
- Krogsveen, *Klar for visning?* — https://www.krogsveen.no/kjope/visning
- NAR, *2025 Profile of Home Buyers and Sellers* — https://www.rirealtors.org/clientuploads/documents/NAR/Homebuyers_and_sellers_trend_2025.pdf
- Wesselsløkka (prosjektside) — https://wesselslokka.no/
- Trondheim kommune, *Blussuvoll skole* — https://www.trondheim.kommune.no/org/oppvekst/skoler/blussuvoll-skole/
- Trondheim kommune, *Områdeplan for Brøset* — https://www.trondheim.kommune.no/tema/bygg-kart-og-eiendom/arealplaner/temaplaner-prosjekter-og-utredninger/omradeplan-broset/
- Boardets egne data: `v2.products` for `broset-utvikling-as_wesselslokka` (`reportConfig.boardFacts`, hentet 2026-09-01), POI-pool via `getProductFromSupabaseV2`, kjørt 2026-09-06.
