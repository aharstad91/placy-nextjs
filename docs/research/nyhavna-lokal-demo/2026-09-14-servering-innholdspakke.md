# Servering — innholdspakke til Nyhavna-demoen

Dato: 14. september 2026. Møte: 16. september, ifølge Andreas. Status: ferdig redaksjonelt forslag til gjennomgang; ikke importert i demoen og ikke lyttetestet.

## Hensikt

Besøkende skal kunne forestille seg noen egne vaner rundt Nyhavna: en kaffepause, en enkel middag og en kveld med venner. Anja skal kunne følge interessen videre med konkrete opplysninger om stedene. Lene skal få høre hvordan Nyhavnas innhold kan bli en samtale som tilpasses den som spør. Dette er møtets arbeidshypotese, ikke en bekreftet beskrivelse av Lenes mandat.

Pakken inneholder én introduksjon, seks hovedspørsmål og tolv bakgrunnsnotater. Fem eksisterende kartsteder gjenbrukes; tre nye steder foreslås. Kildene beskriver tilbudene nå, ikke hva som garantert finnes ved framtidig innflytting.

## Introduksjon til kategorien

**Forslag til tale:**

På Nyhavna kan du begynne med en kaffe hos Dora Kaffebar i Kobbes gate. I Ladebekken finner du Snurr for frokost og Nyhavna BistroBar for middag. På BistroBar har de også småretter som kan deles rundt bordet. Hva er du mest nysgjerrig på — steder du kan bruke i hverdagen, eller en kveld ute med venner?

Kilder: [Dora Eiendom][S02], [Snurr][S03], [BistroBar-menyen][S04]. Kartrekkefølge: `dora-kaffebar` → `snurr-nyhavna` → `nyhavna-bistro`. Alle tre finnes i den aktive demoen.

Introduksjonen skal åpne samtalen. Bakgrunnsnotatene hentes fram når interessen tilsier det. Et konkret spørsmål om ett sted besvares før et nytt valg tilbys. Anja trenger ikke avslutte hvert svar med et spørsmål.

## Seks samtaleinnganger

Svarene er forslag til førstesvar. Kildehenvisningene skal følge kunnskapen, men trenger ikke leses opp som en del av hvert talesvar.

### Q1 — Hvor kan jeg ta en kaffe eller spise frokost?

**Førstesvar:** Dora Kaffebar ligger i Kobbes gate 2 og er også åpen for folk som kommer innom uten å jobbe i bygget. Snurr i Ladebekken har både kaffe og frokostretter. Dora er et sted å se nærmere på for en kaffepause, og Snurr hvis du vil ha noe å spise til.

**Videre:** «Må jeg jobbe i bygget?» → N01. «Hva kan jeg spise hos Snurr?» / «Har de noe vegansk?» → N02.

Kart: `dora-kaffebar`, `snurr-nyhavna`. Kilder: [S02][S02], [S03][S03]. Behold eksisterende FAQ-ID `kafe`.

### Q2 — Hvor kan vi gå ut og spise med venner?

**Førstesvar:** Nyhavna BistroBar i Ladebekken har småretter til deling og egne hovedretter. E.C. Dahls har både pub og restaurant, så det er også et alternativ å se på. Vil dere dele litt forskjellig mat, eller er dere mer interessert i bryggerimiljøet?

**Videre:** «Hva slags småretter?» → N03. «Er det noen lokal tilknytning i maten?» → N04. «Hva er forskjellen på puben og restauranten?» → N09.

Kart: `nyhavna-bistro`; E.C. Dahls etter egen kartkontroll. Kilder: [S04][S04], [S10][S10]. Behold eksisterende FAQ-ID `spisesteder`.

### Q3 — Hvor kan vi spise en enkel middag med barna eller hente med mat?

**Førstesvar:** Ladejarlen har pizza og en egen barnepizza for barn under tolv år. De tilbyr også takeaway med henting. Hvis dere vil gjøre noe sammen samtidig, har Dora 1 både bowling og enkel mat. Da kan vi se nærmere på middagen eller aktiviteten, avhengig av hva dere har lyst til.

**Videre:** «Gjelder barnepizzaen en trettenåring?» → N05. «Kan vi hente maten selv?» → N06. «Hvordan er bowling med barn?» → N11.

Kart: `ladejarlen`, `dora-bowling`. Kilder: [S05][S05], [S12][S12], [S13][S13]. Foreslått FAQ-ID: `servering-enkel-middag`.

### Q4 — Kan vi kombinere middag med en opplevelse ved vannet?

**Førstesvar:** På HAVET kan dere kombinere et restaurantbesøk hos BarbeintQ med badstue. Restauranten lager mat i vedfyrte smokere. Det kan være en anledning til å gjøre litt mer ut av kvelden; tilgjengelige tidspunkt og vilkår må dere se hos HAVET.

**Videre:** «Hva slags mat er det?» → N07. «Må vi ta badstue?» / «Gjelder samme åpningstid for alt?» → N08.

Kart: HAVET etter egen kartkontroll. Kilder: [S08][S08], [S09][S09]. Foreslått FAQ-ID: `servering-mat-og-opplevelse`.

### Q5 — Hva gir mat- og drikkemiljøet her særpreg?

**Førstesvar:** Her finnes også virksomheter som lager noe selv. Monkey Brew er et håndverksbryggeri med utsalg på Nyhavna. Hos E.C. Dahls kan du spise i puben eller restauranten med bryggeriet som ramme. De to stedene gir ulike innganger til å bli kjent med bryggerimiljøet.

**Videre:** «Kan vi bare sette oss på Monkey Brew og ta en øl?» → N10. «Finnes det omvisning?» → N09/N10, med bestillingsforbehold. «Har restaurantene lokale forbindelser også?» → N04.

Kart: Monkey Brew og E.C. Dahls etter egen kartkontroll. Kilder: [S10][S10], [S11][S11], [S15][S15]. Foreslått FAQ-ID: `servering-saerpreg`.

### Q6 — Kommer det flere kaféer og restauranter når boligene bygges?

**Førstesvar:** På Transittkaia legger utbygger opp til servering og andre tilbud på bakkeplan, blant annet rundt Doratorget. Det er en del av planene for bydelen. Hvilke virksomheter som kommer, og når de åpner, er ikke bekreftet i denne innholdspakken.

**Videre:** «Er Doratorget der allerede?» / «Kan vi regne med dette ved innflytting?» → N12. «Hva kan vi bruke nå?» → tilbake til dagens steder i Q1–Q5.

Kart: `transittkaia`, med planstatus. Doratorget har ikke eget aktivt kartpunkt. Kilde: [S14][S14]. Foreslått FAQ-ID: `servering-framtid`.

## Tolv bakgrunnsnotater

Dette er faktagrunnlaget bak oppfølgingene. Anja skal velge det som besvarer spørsmålet, ikke lese hele notatet. ID-ene N01–N12 er dokumentets referanser; forslag til varige tema-ID-er står i overleveringen.

### N01 — Dora Kaffebar er tilgjengelig for besøkende

Kaffebaren ligger i første etasje i Kobbes gate 2. Den er åpen både for byggets brukere og andre som ferdes i området, og følger byggets åpningstider. Nyhavna omtaler brød, søtbakst og håndverkskaffe. [Dora Eiendom][S02], [Nyhavna][S01]

**Bruk:** Spørsmål om hvem som kan besøke stedet, hva som finnes der og en kaffepause på dagtid. Byggets takterrasser, personalrestaurant og øvrige kontorfasiliteter er ikke dokumentert som kafégjestenes tilbud. Eksakte åpningstider er ikke fastsatt her.

### N02 — Snurr kan brukes til et måltid

Snurr Nyhavna ligger i Ladebekken 24D. Menyen har frokost, påsmurt mat og varme retter. Tomat og avokado på surdeigsbrød er merket vegansk. Avdelingen har også en lenke for klikk og hent. [Snurr][S03]

**Bruk:** Frokost, lunsj, mat med hjem og konkrete plantebaserte alternativer. Menymerking gir ikke garanti for allergenfri tilberedning. Unngå å gjengi hele menyen eller presentere en kontrollert meny som tilgjengelig lagerbeholdning.

### N03 — BistroBar har mat for deling og hovedretter

Menyen skiller mellom snacks, småretter og hovedretter. Smårettene beskrives som egnet til forrett eller deling; eksempler er tartar og stracciatella. Fish and chips er et eksempel blant hovedrettene. [BistroBar][S04]

**Bruk:** Forklare måltidsformen når venner vil spise sammen. Ingen slutning om støynivå, prisnivå eller garantert ledig bord. Eksempelrettene er fra menyen lest 14. september.

### N04 — En konkret forbindelse mellom lokale matsteder

BistroBars meny navngir Snurr som leverandør av surdeigsbrød. Den oppgir også stracciatella fra Toddum gård. Dette er to konkrete leverandøreksempler. [BistroBar][S04]

**Bruk:** Utdype lokal tilknytning uten å hevde at alle råvarer er lokale. Forbindelsen til Snurr kan gi en naturlig overgang til bakeriet i samtalen. Det er ikke dokumentasjon av en fast, felles besøksopplevelse.

### N05 — Ladejarlen har et konkret barnetilbud

Ladejarlens meny har barnepizza med valgfri topping for barn under tolv år. Menyen omfatter også ordinær pizza og middagsretter. [Ladejarlen][S05]

**Bruk:** Enkle familiealternativer og spørsmål om alder. Ikke utvid barnevilkåret til tolvåringer eller eldre. Barnestoler, lekerom og plass til barnevogn er ikke kontrollert. Kaféens vaffelsøndag skal ikke foreslås som et aktivt tilbud; nettsiden oppgir pause. [Kaféstatus][S07]

### N06 — Takeaway hos Ladejarlen

Ladejarlen tilbyr bestilling for henting. Nettstedet lenker også til leveringstjenester, men leveringsdekning til en bestemt adresse er ikke kontrollert. [Ladejarlen][S05]

**Bruk:** «Kan vi ta med maten hjem?» og «Leverer de til boligen?» Henting kan omtales; konkret hjemlevering må sjekkes med adresse. Stedet oppgir midlertidige åpningstider. Unngå å love et bestemt kjøkkentidspunkt. [Åpningstider][S06]

### N07 — BarbeintQ gir maten en egen karakter

BarbeintQ er restauranttilbudet ved HAVET i Strandveien 104. Matlagingen bruker vedfyrte smokere, langsom varme og røyk. Restauranten beskriver alternativer med kjøtt, fisk, vegetarisk og vegansk mat. [HAVET servering][S08]

**Bruk:** Smak, matlagingsmåte og variasjon. Unngå å likestille restaurantens generelle beskrivelse med at alle alternativer er tilgjengelige til enhver tid. Ingen allergengaranti.

### N08 — Mat og badstue på samme sted

HAVET foreslår selv restaurantbesøk før eller etter badstue. Restaurant, bar og badstue har egne åpningstider og vilkår. Aldersregler varierer med tilbud, tidspunkt og arrangement. [HAVET servering][S08], [HAVET FAQ][S09]

**Bruk:** Utvikle interessen fra middag til en kveld med aktivitet. Kildene presenterer restaurantbesøket som et eget tilbud; ikke gjør badstue til et krav for å spise. Ikke lov at matserveringen er åpen fordi baren er åpen, eller at et bestemt opplegg passer alle barn. Ingen fast søndagsplan foreslås i pakken.

### N09 — E.C. Dahls har både pub og restaurant

E.C. Dahls Pub og Kjøkken ligger i Strandveien 71. Puben beskriver uformell mat og øl, mens restauranten framhever lokale råvarer og kombinasjoner av mat og øl. Det finnes også tilbud om omvisning og smaking. [E.C. Dahls][S10]

**Bruk:** Skille mellom en matbit, restaurantmiddag og en organisert opplevelse. Omvisning skal avtales. Konsertdager kan gi avvik i åpning og matservering. Ikke lov et arrangement på besøksdagen uten datert program.

### N10 — Monkey Brew er bryggeri og utsalg

Monkey Brew har bryggeriutsalg på Nyhavna. Utbygger oppgir Kobbes gate 10; virksomheten beskriver inngang på østsiden, overfor HAVET. Omvisning med smaking kan avtales for grupper på minst ti personer. [Nyhavnas omtale][S01], [Monkey Brew utsalg][S11]

**Bruk:** Lokalt håndverk, produksjon og gruppebesøk. Bryggeriutsalg er ikke dokumentasjon av pub eller restaurant. Ikke lov drop-in-smaking. Bruk virksomhetens aktuelle kontaktfunksjon; personnavn fra eldre omvisningstekst lagres ikke.

### N11 — Dora 1 kombinerer mat med aktivitet

Dora 1 i Kobbes gate 6 har bowling og blant annet biljard og shuffleboard. Familiebowling presenteres med barnegjerde og stativ. Matmenyen omfatter pizza, burger, toast og panini. [Dora 1 aktiviteter][S12], [Matmeny][S13]

**Bruk:** En aktivitet med familie, venner eller besøk. Mat og aktivitet skal ikke omtales som én inkludert pakke uten eget belegg. Ingen lovnad om aldersfri adgang til alle aktiviteter, ledig bane eller rask servering.

### N12 — Servering i den framtidige bydelen

Utbyggers forslag for Transittkaia legger til rette for publikumstilbud på bakkeplan og servering rundt Doratorget. Det gir en framtidsretning, men navngitte leietakere og åpninger inngår ikke i kunnskapen her. [Transittkaia][S14]

**Bruk:** «Hva mer kommer?» Planstatus følger hele svaret. Ikke gjør en områdeambisjon til et løfte om tilbud ved innflytting. Ved spørsmål om dagens tilbud brukes eksisterende virksomheter.

## Kart og innholdsutvalg

| Sted | Rolle i samtalen | Kobling til aktiv demo |
|---|---|---|
| Dora Kaffebar | Kaffepause og et sted å komme innom | Gjenbruk `dora-kaffebar` |
| Snurr Nyhavna | Frokost og lunsj | Gjenbruk `snurr-nyhavna` |
| Nyhavna BistroBar | Middag og deling rundt bordet | Gjenbruk `nyhavna-bistro` |
| Ladejarlen | Enkel middag og takeaway | Gjenbruk `ladejarlen` |
| Dora 1 | Mat og aktivitet | Gjenbruk `dora-bowling` i Opplevelser; ingen dublett |
| HAVET / BarbeintQ | Mat, vannet og badstue | Ny stedskobling; plassering og inngang må kontrolleres |
| E.C. Dahls Pub og Kjøkken | Pub, restaurant og bryggerimiljø | Ny stedskobling; plassering og inngang må kontrolleres |
| Monkey Brew | Produksjon og utsalg | Ny stedskobling; riktig inngang må kontrolleres |

De fem eksisterende ID-ene er kontrollert mot hovedarbeidskopiens aktive JSON-filer 14. september. `transittkaia` gjenbrukes i tillegg som planområde, ikke som et niende serveringssted. Ingen nye koordinater eller reisetider følger pakken. Eksisterende rutetider beholdes ved en eventuell import og må fortsatt knyttes til kartets faktiske utgangspunkt.

## Overlevering til den tekniske økten

Arbeidet ligger i en separat arbeidskopi. Dette dokumentet er et forslag som Andreas skal vurdere før de øvrige kategoriene får samme behandling. Hovedarbeidskopiens innhold er nyere enn basisen til denne grenen. Ikke erstatt JSON-filer med filer fra denne arbeidskopien.

Etter innholdsgjennomgangen kan teksten legges inn slik:

- `board.json`: erstatt teksten i manusdelen `servering` med introduksjonen. Oppdater kartrekkefølgen til de tre eksisterende ID-ene som står under introduksjonen.
- `faq.json`: oppdater `kafe` og `spisesteder`; legg til Q3–Q6. Behold `aktuelle-menyer` som et praktisk ekstraspørsmål, med lenker til stedenes egne sider. Det gir seks hovedinnganger pluss ett hjelpesvar.
- `topics.json`: N01–N12 foreslås som `servering-dora-besok`, `servering-snurr-maltid`, `servering-bistro-deling`, `servering-bistro-leverandorer`, `servering-ladejarlen-barn`, `servering-ladejarlen-henting`, `servering-havet-mat`, `servering-havet-opplevelse`, `servering-dahls-pub-restaurant`, `servering-monkey-utsalg`, `servering-bowling-mat` og `servering-framtid`. N12 skal ha planstatus. Bruk spørsmålene som søkeord, og behold forbeholdene ved hvert notat.
- De tre nåværende serveringsnotatene `demo-kafe`, `demo-spisesteder` og `demo-aktuelle-menyer` gjentar FAQ-ene. Avstem dem ved import, slik at nye notater tilfører kunnskap uten å skape motstridende kopier. Bevar eventuelle nye endringer fra den andre økten.
- `sources.json`: koble hvert utsagn til den spesifikke siden nedenfor, gjenbruk eksisterende kilde-ID der URL og innhold samsvarer. Kontrolldato er `2026-09-14`. Påstander om menytilbud er daterte opplysninger.
- Kartet må kunne følge et svar over til `dora-bowling` i Opplevelser. Gjeldende kategorikobling skal bevares. Nye steder får ikke kartmarkører før plasseringen er kontrollert, og omtales ikke som «vist» før kartet faktisk viser dem.

Hele dokumentet skal ikke legges inn som stemmeinstruks. Førstesvar og bakgrunn er kunnskap; redaksjonelle valg, kildekontroll og testbeskrivelser er arbeidsmateriale. Ingen import er utført i denne leveransen.

## Samtaleprøve etter import

| Prøve | Tre spørsmål i samme tråd | Hva prøven skal avklare |
|---|---|---|
| 1 | «Hvor tar jeg kaffe?» → «Er Dora bare for ansatte?» → «Hva med frokost på Snurr?» | Nytt innhold i begge oppfølginger, riktige steder |
| 2 | «Vi skal spise med venner» → «Hva kan vi dele på BistroBar?» → «Er det noen lokale leverandører?» | Måltidsform og leverandørdetalj uten oppramsing |
| 3 | «Vi har barn på ti og tretten» → «Har begge barnepizza?» → «Kan vi hente maten?» | Korrekt aldersvilkår og henting uten leveringsløfte |
| 4 | «Kan vi spise ved HAVET?» → «Er det bare kjøtt?» → «Kan vi kombinere med badstue?» | Matbredde og relevant aktivitet uten samme åpningstid for alt |
| 5 | «Hva er Monkey Brew?» → «Kan vi sette oss der og ta en øl?» → «Hvor kan vi heller spise i et bryggerimiljø?» | Bryggeri/utsalg skilles fra serveringssted, Dahls kan introduseres |
| 6 | «Kommer det mer servering?» → «Er det klart ved innflytting?» → «Hva finnes allerede nå?» | Planstatus beholdes, samtalen finner tilbake til dagens tilbud |

Bestått betyr at svaret bygger på notatene, tilfører relevant kunnskap i oppfølgingene og viser riktig sted når et kartsted finnes. Det skal høres ut som en samtale. Spørsmål som ikke har grunnlag får en kort avgrensning; guiden skal ikke fylle hullet med generelle antakelser.

**Status:** Alle seks kjedene er kontrollert redaksjonelt mot notatene. Ingen av dem er kjørt som faktisk talesamtale. En egen stedskontroll av Dora 1 skal også bekrefte at svaret kan bytte kategori uten å miste spørsmålet om mat.

## Kilder og kontroll

Alle kildelenkene nedenfor er åpnet i denne økten, direkte eller av en avgrenset research-agent. Kildene er virksomhetenes egne sider, eiers side eller Nyhavna Utvikling. Tidligere research fra 13. september ble brukt til å finne aktuelle spørsmål og fallgruver; rårapporten er ikke behandlet som en faktakilde.

| Kilde | Grunnlag | Bruk |
|---|---|---|
| S01 | [Nyhavna: café og restauranter][S01] | Dora-tilbud og Monkey Brew-adresse |
| S02 | [Dora Eiendom: Kobbes gate 2][S02] | Offentlig adgang til kaffebaren |
| S03 | [Snurr Nyhavna][S03] | Adresse, måltider, vegansk eksempel, klikk og hent |
| S04 | [Nyhavna BistroBar: meny][S04] | Deling, retteksempler og navngitte leverandører |
| S05 | [Ladejarlen: meny][S05] | Pizza, barnets aldersvilkår og henting |
| S06 | [Ladejarlen: åpningstider][S06] | Midlertidige tider; begrenser detaljløfter |
| S07 | [Ladejarlen: kafé][S07] | Vaffelsøndag satt på pause |
| S08 | [HAVET: servering][S08] | Restaurant, matlagingsmåte og tilbud |
| S09 | [HAVET: FAQ][S09] | Skille mellom tjenester og vilkår |
| S10 | [E.C. Dahls: Pub og Kjøkken][S10] | Pub, restaurant, omvisning og konsertforbehold |
| S11 | [Monkey Brew: utsalg og omvisning][S11] | Utsalg, inngang og bestilling av gruppebesøk |
| S12 | [Dora 1][S12] | Aktiviteter og familiebowling |
| S13 | [Dora 1: meny][S13] | Matutvalg |
| S14 | [Nyhavna: Transittkaia][S14] | Framtidig servering, alltid med planstatus |
| S15 | [Monkey Brew][S15] | Bryggeriets egen beskrivelse |
| S16 | [Monkey Brew: kontakt][S16] | Kontroll av personkontakt; brukes ikke i talesvar |

Kontroll omfatter **8 av 8 valgte virksomheter, 6 av 6 førstesvar og 12 av 12 bakgrunnsnotater**. Alle 16 oppførte kildesider er lest. Ingen av de åtte virksomhetene er avvist; tre mangler kontrollert kartkobling i den aktive demoen.

Andre gjennomgang kontrollerte at forbeholdene fulgte relevant innhold. Siste stikkprøve rettet oppmerksomheten mot bryggeri kontra pub, aldersvilkår, vegetarisk kontra vegansk, offentlig kafé kontra kontorfasiliteter og framtidig servering. Ingen salgs-, popularitets- eller kvalitetsrangering er utledet fra kildene.

En ekstra, avgrenset agentgjennomgang av HAVET, E.C. Dahls, Monkey Brew og Dora 1 fant ingen avvik mellom kildene og de relevante førstesvarene/notatene. Dette supplerer redaksjonell kontroll; det erstatter ikke kartkontroll eller lyttetest.

Åpne tråder: Andreas vurderer formidlingsnivået; nye kartkoblinger kontrolleres; godkjent tekst importeres med respekt for den andre øktens endringer; samtaleprøvene kjøres. Åpningstider og konkrete besøksplaner kontrolleres særskilt hvis de skal brukes på møtet. Det øvrige kategoriarbeidet har ikke startet.

[S01]: https://nyhavna.no/leve/cafe-og-restauranter/
[S02]: https://dora.no/eiendommer/nyhavna-en/
[S03]: https://snurrbakeri.no/snurr-nyhavna
[S04]: https://www.nyhavnabistrobar.no/our-menu
[S05]: https://www.ladejarlen.com/meny
[S06]: https://www.ladejarlen.com/pningstider
[S07]: https://www.ladejarlen.com/kafe
[S08]: https://www.havetarena.no/servering
[S09]: https://www.havetarena.no/faq
[S10]: https://ecdahls.no/pub-kjokken/
[S11]: https://monkeybrew.no/shop
[S12]: https://dora1.no/
[S13]: https://dora1.no/meny
[S14]: https://nyhavna.no/bo/transittkaia/
[S15]: https://monkeybrew.no/
[S16]: https://monkeybrew.no/contact
