# Barn og oppvekst – reviderte FAQ og mapping av kunnskap

Dato: 13. september 2026. Redaksjonelt arbeidsdokument for Nyhavna-demoen. Ingen endringer i demoens JSON, kart eller kode.

Grunnlag: [Claudes opprinnelige rapport](2026-09-13-barn-oppvekst-claude-original.md), de åtte importerte oppvekstspørsmålene i `data/demo/nyhavna-lokal/faq.json` og de elleve spørsmålene Andreas og Codex har valgt. Originalrapporten er bevart uendret som researchmateriale; den skal ikke lastes direkte inn som verifisert kunnskap.

Alle 11 målspørsmål, alle 14 FAQ-er i rapporten og alle 42 definerte faktaposter er gjennomgått. Relevante primærkilder er åpnet og kontrollert for svarforslagene. Dette er ikke en bekreftelse av alle enkeltopplysninger i originalrapporten: uavklarte detaljer er holdt tilbake og oppført nedenfor. Ingen skolevei, koordinater eller adressebasert tildeling er målt eller kontrollert i kart.

## Avklart retning og svarform

Andreas har bekreftet hele Nyhavna som ramme og bred dekning for barnefamilier. Opplysninger som bare gjelder Transittkaia, beholder denne avgrensningen. Familien med barn på 10 og 14 år er én testcase; den skal ikke være en antakelse i alle samtaler eller i faste FAQ-svar.

Som foreløpig referansepunkt for fremtidige avstandsmålinger brukes eksisterende `board.center`: **63.43980508893858, 10.41725655026434**, hentet fra `data/demo/nyhavna-lokal/board.json`. Dette er et praktisk standardvalg gjort av Codex, ikke en boligadresse valgt av Andreas. Punktets tilknytning til tilgjengelig gang-/sykkelvei må kontrolleres før rutemåling. Eventuelle avstander merkes «fra demoens referansepunkt». Skolekrets og helsestasjon må fortsatt avklares med faktisk adresse.

OpenAI anbefaler en kort Live-instruks med tydelig mål og frihet i formulering og samtaleføring. Guiden foreslår én–to korte setninger for rutinespørsmål som en **valgfri** lengdestyring dersom svarene trenger justering. Det er ikke en universell setningsgrense. Detaljerte arbeidsregler hører til backenden. [OpenAI: Prompting GPT-Live](https://developers.openai.com/api/docs/guides/live-prompting)

Vår redaksjonelle anvendelse:

- **Sidebar:** normalt 2–4 korte setninger. Et direkte svar, konkrete eksempler og vesentlige forbehold som trengs for å forstå svaret.
- **Stemme:** normalt én–to korte setninger om ett relevant poeng først. Utvid når spørsmålet krever det eller brukeren ber om dybde. Et viktig forbehold skal ikke utelates for å møte lengdemålet.
- **Samme kunnskap på begge flater:** FAQ-en er et kuratert svargrunnlag, ikke obligatorisk ordrett opplesning. Stemmen kan prioritere etter barnas alder og det som allerede er sagt, med samme fakta og forbehold.
- **Hjelp samtalen videre:** gi et nyttig svar før nye brede spørsmål. Still høyst ett relevant oppfølgingsspørsmål når det hjelper, uten å avslutte alle svar med et spørsmål. Ikke spør etter alder eller behov som allerede er oppgitt.
- **Kilder:** vis lenkene i grensesnittet. I tale kan relevant utgiver nevnes naturlig, særlig ved planstatus; ikke les URL-er eller interne kilde-ID-er høyt.

Disse konkrete valgene er Placy-anbefalinger basert på dokumentasjonen og samtaleøvelsen. Naturlighet og faktisk verktøy-/faktabruk må prøves hver for seg, med lytting til reelle samtaler. [OpenAI: Voice agents – evaluering](https://developers.openai.com/api/docs/guides/voice-agents#evaluate-your-voice-agent)

Dette dokumenterer ønsket oppførsel. Live-instruksen og JSON-demoen er ikke endret i denne runden.

## 1. Forslag til spørsmål og korte svar

Rekkefølgen er til sidebar. Stemmen bør velge relevant inngang etter barnas alder og brukerens spørsmål. Svarene er redaksjonelle forslag basert på kontrollen nedenfor, ikke ferdige vedtak om en families skoleplass eller fremtidige tilbud.

**Dekning** gjelder om kunnskapen besvarer spørsmålet: *Tilstrekkelig* betyr et dokumentert førstesvar, ikke uttømmende kunnskap. *Delvis* betyr at en vesentlig del av spørsmålet fortsatt mangler svar. Etter supplering er 6 spørsmål tilstrekkelig dekket og 5 delvis dekket. Rapporten alene manglet de tre temaene skoleskyss, videregående og helsestasjon.

| # | Spørsmål | Foreslått førstesvar | Dekning |
|---|---|---|---|
| 1 | **Hva finnes for barnefamilier i dag, og hva er planlagt på Nyhavna?** | Rundt Nyhavna finnes allerede skoler, barnehager og parker. Strandveiparken har blant annet lek, ballspill og parkour. På Transittkaia er barnehage, nye byrom og elvepromenade foreslått. For familien er det viktig å skille dagens tilbud fra det som faktisk blir ferdig til innflytting. [Strandveiparken][V-PARK-S], [Transittkaia – kommunens arkiverte høring][V-PLAN], [Kommunens barnehageregister][V-BHG-REG] | Tilstrekkelig som oversikt. |
| 2 | **Hvilke barnehager finnes i nærområdet, og hva bør vi vite om å få plass?** | Svartlamon kunst- og kulturbarnehage, Lademoen, Nedre Elvehavn og Voldsminde er alternativer rundt området. Dere søker gjennom kommunens portal. Nærhet gir ikke garanti for plass i ønsket barnehage, så leveringsruten og opptaket bør vurderes sammen. [Kommunens barnehageregister][V-BHG-REG], [Kommunen: Barnehageplass][V-BHG-OPPTAK] | Tilstrekkelig som oversikt; tilgjengelige plasser og ruter er ikke fastslått. |
| 3 | **Hvilke barneskoler og ungdomsskoler er aktuelle hvis vi flytter til Nyhavna?** | Planmaterialet for Transittkaia peker på Lilleby barneskole og Rosenborg ungdomsskole. Det er derfor naturlig å undersøke disse først. Hvilken skole barnet faktisk sokner til, må sjekkes for boligadressen og tidspunktet dere flytter inn. [Planbeskrivelse Transittkaia][V-PLANB], [Kommunen: Finn din skolekrets][V-KRETS] | Delvis: navngitte utgangspunkt, men ingen konkret bolig eller fremtidig tilhørighet er avklart. |
| 4 | **Hvordan er skoleveien til fots og på sykkel?** | Vi må følge ruten fra den aktuelle boligen før vi kan beskrive skoleveien ordentlig. Kryssinger og anleggstrafikk er viktige å undersøke. Det er planlagt en ny gang- og sykkelforbindelse mellom Lilleby skole og Strandveien, men vi har ikke bekreftet at den er åpnet. [Barnas representants uttalelse om Transittkaia][V-BARN-PLAN], [Vegvesenet: Lilleby skole–Nordtvedts gate][V-SYKKEL] | Delvis: ingen målt rute, avstand eller gjennomgang av dagens kryssinger. |
| 5 | **Når kan barn på Nyhavna ha rett til gratis skoleskyss?** | I grunnskolen er avstandsgrensen mer enn to kilometer på første trinn og mer enn fire kilometer på andre til tiende trinn. Særlig farlig eller vanskelig skolevei, eller behov knyttet til sykdom, skade eller nedsatt funksjonsevne, kan også gi rett ved kortere avstand. Barnets situasjon må vurderes konkret. [Trøndelag: skoleskyss i grunnskolen][V-SKYSS] | Tilstrekkelig som generell regel; ingen individuell rett er avgjort. |
| 6 | **Hvilke videregående skoler finnes i nærheten, og hvordan kommer ungdommen seg dit?** | Thora Storm og Trondheim Katedralskole er to alternativer i sentrum. Begge tilbyr studiespesialisering; Thora Storm har også blant annet helse- og oppvekstfag, mens Katedralskolen tilbyr musikk og medier og kommunikasjon. Programvalg og inntak avgjør hva som er aktuelt. Reiseruten fra boligen gjenstår å undersøke. [Thora Storm videregående skole][V-VGS-TS], [Trondheim Katedralskole][V-VGS-TK], [Trøndelag: inntak][V-INNTAK] | Delvis: dokumenterte eksempler, men ingen reisetider eller fullstendig skoleoversikt. |
| 7 | **Hvor kan barna leke og være ute i nærområdet?** | Strandveiparken har lekeområde, flerbruksbane og parkour. Lademoparken har lek for de minste, mens Ladeparken har blant annet vannlek og plass til ballspill. Det gir ulike muligheter etter alder og aktivitet; hvilken park som blir enklest å bruke i hverdagen, avhenger av boligen. [Strandveiparken][V-PARK-S], [Lademoparken][V-PARK-L], [Ladeparken][V-PARK-LADE] | Tilstrekkelig om tilbud; avstander er ikke målt. |
| 8 | **Hvilke fritidsaktiviteter finnes i nærheten for barn og ungdom?** | For barn på mellomtrinnet er Jubateateret på Lademoen et tilbud å undersøke. For ungdom finnes Lade fritidsklubb med blant annet gaming, og Lade Motor har et fast tilbud fra 13 år. BUA Lademoen låner ut sports- og friluftsutstyr gratis. Kursplasser og aktuelle terminer må sjekkes. [Kommunen: kulturtilbud for barn][V-KULTUR], [Lade fritidsklubb][V-KLUBB], [Lade Motor][V-MOTOR], [Røde Kors: BUA Lademoen][V-BUA] | Delvis: gode eksempler, men organisert idrett og aktuelt teateropptak mangler. |
| 9 | **Hvor kan ungdom møte venner uten å måtte kjøpe noe?** | Lade fritidsklubb er gratis og har gaming, aktivitetsrom og mat på klubbkveldene. Ute kan Strandveiparken brukes til å møtes, spille ball eller prøve parkour. Klubb og park gir to ulike muligheter: et tilbud med voksne til stede, og et sted ungdom kan bruke på egen hånd. [Lade fritidsklubb][V-KLUBB], [Strandveiparken][V-PARK-S] | Tilstrekkelig som førstesvar. Klubbens nøyaktige besøksalder må avklares før aldersbestemt anbefaling. |
| 10 | **Hvilken helsestasjon er aktuell for familier på Nyhavna, og hvor ligger den?** | Helsestasjon for småbarn bestemmes ut fra bostedsadressen, så vi må sjekke adressen før vi peker ut riktig sted. For barn i skolealder finnes skolehelsetjenesten på alle skolene i Trondheim. Den er gratis og kan kontaktes direkte av barn og foreldre. [Kommunen: Finn din helsestasjon][V-HELSE], [Kommunen: Skolehelsetjenesten][V-SKOLEHELSE] | Delvis: riktig tjeneste forklart, men bestemt helsestasjon og tilhørende adresse er ikke valgt. |
| 11 | **Hva bør vi som barnefamilie undersøke før vi kjøper på Nyhavna?** | Begynn med hva som faktisk vil være tilgjengelig ved innflytting: skole, skolevei, uteområder og fritidstilbud. Be også om oversikt over byggearbeid rundt boligen og hvordan gangveier blir ivaretatt. Støy, utearealer og sikring mot vannet bør avklares for det konkrete bygget, ikke bare for bydelen samlet. [Barnas representants uttalelse om Transittkaia][V-BARN-PLAN], [ROS-analyse Transittkaia][V-ROS], [Kommunen: Finn din skolekrets][V-KRETS] | Tilstrekkelig som redaksjonell sjekkliste, ikke en vurdering av et bestemt kjøp. |

## 2. Koblinger og kunnskap som skal ligge bak svarene

`F-*` er ID-er fra originalrapporten. De betyr **ikke** at originalteksten skal kopieres uendret: bruk behandlingen i faktakontrollen i del 4. `N-*` er nye, dokumenterte fakta foreslått nedenfor. `V-*` er kildene kontrollert i denne runden og lenket i del 6.

| FAQ | Foreslått FAQ-ID | Faktagrunnlag | Relevant dybde / oppfølging | Kilde-ID-er |
|---|---|---|---|---|
| 1 | `oppvekst-naa-og-planlagt` (ny) | F-PLAN-02/09/10/11; F-BHG-03; F-LEK-03; F-SKOLE-05 | Hva er foreslått på Transittkaia? Når kan barnehagen komme? Finnes det en bekreftet åpning for ny skole? Skille mellom delområder og planalternativer. | V-PLAN, V-PLANB, V-NYHAVNA, V-PARK-S, V-BHG-REG |
| 2 | `barnehage-dekning` (behold ID) | F-BHG-01/02/03; N-BHG-OPPTAK | Søknadsprosess; eksisterende barnehager kontra foreslått Transittkaia-barnehage. Adressebasert leveringsrute og ledige plasser er hull. | V-BHG-REG, V-BHG-OPPTAK, V-BHG-L, V-BHG-N, V-BHG-V, V-PLAN |
| 3 | `krets` (behold ID) | F-SKOLE-01/02/03/04/04b/05 | Skolekrets kontra kapasitet for utbygging; skoleadresser; datert planstatus. Tall om elevmengde skal ikke bli en påstand om kvalitet eller ledig plass. | V-PLANB, V-KRETS, V-KAPASITET, V-LILLEBY, V-ROSENBORG |
| 4 | `skolevei` (behold ID) | F-TRAFF-01/02/03 | Dagens rute kontra fremtidig sykkelforbindelse; midlertidige traseer i anleggsperioden. Ingen gangminutter før rute er målt. | V-SYKKEL, V-BARN-PLAN |
| 5 | `skoleskyss` (behold ID) | N-SKYSS | Avstandsberegning, søknad og individuell vurdering. Egenvalgt annen skole kan påvirke skyssretten. | V-SKYSS, V-SKYSS-REG, V-KRETS |
| 6 | `vgs-naerhet` (behold ID) | N-VGS | Programvalg og inntak. Utvid med relevante skoler etter ungdommens interesser; ikke ranger nærmest uten måling. | V-VGS-TS, V-VGS-TK, V-INNTAK |
| 7 | `lekeplass` (behold ID) | F-LEK-01/02/03/04 | Velg park etter aktivitet og alder. Buranbanen er et ekstra eksempel. Historisk stenging er erstattet med gjenåpningsinformasjon. | V-PARK-S, V-PARK-AAPEN, V-PARK-L, V-PARK-LADE, V-BURAN |
| 8 | `oppvekst-fritid` (behold ID) | F-FRI-01/02/03/04 | Mellomtrinn kontra ungdom; drop-in kontra fast deltakelse; BUA som utstyrslån. Idrettslag, påmelding og semesterstatus mangler. | V-KULTUR, V-KLUBB, V-MOTOR, V-BUA |
| 9 | `ungdom-moteplasser` (ny) | F-FRI-01/05/07; F-LEK-03 | Rosenborgs KLUBBEN som skoletilknyttet oppfølging; gratisstatus der er ikke bekreftet. Kommunens områdeanalyse er datert perspektiv, ikke fasit om alle ungdommers hverdag. | V-KLUBB, V-PARK-S, V-ROSENBORG, V-OMRADE |
| 10 | `helsestasjon` (behold ID) | N-HELSE | Småbarnshelsestasjon kontra skolehelsetjeneste. Konkret oppslag må gi riktig kontor og adresse. | V-HELSE, V-SKOLEHELSE |
| 11 | `oppvekst-for-kjop` (ny) | F-PLAN-02/08; F-TRAFF-03; F-MILJO-01/02/03/04/05/06 | Tiltak og forhold ved innflytting, ikke bare dagens industriområde. Tekniske miljødetaljer brukes når de er relevante for spørsmålet. | V-NYHAVNA, V-BARN-PLAN, V-ROS, V-KRETS |

### Nye fakta fra denne kontrollen

| Ny ID | Innhold som kan lagres | Kilder |
|---|---|---|
| N-BHG-OPPTAK | Kommunen har felles søknadsportal. Hovedopptak har frist 1. mars; suppleringsopptak gjelder blant annet tilflyttere gjennom året. Rett til plass er ikke garanti for ønsket barnehage. Nedre Elvehavn og Voldsminde inngår i samme enhet, Sentrum barnehager. | V-BHG-OPPTAK, V-BHG-N, V-BHG-V |
| N-SKYSS | Generelle avstandsgrenser for grunnskoleskyss og alternative grunnlag for individuell rett, som gjengitt i FAQ 5. Bruk fylkets regler og beregning, ikke demoens anslåtte reisetid. | V-SKYSS, V-SKYSS-REG |
| N-VGS | De to skolene og utdanningstilbudene omtalt i FAQ 6 er bekreftet på skolenes egne sider. Inntak og programvalg må holdes adskilt fra grunnskolens skolekrets. Ingen verifiserte reiseruter følger denne faktaposten. | V-VGS-TS, V-VGS-TK, V-INNTAK |
| N-HELSE | Småbarnshelsestasjon følger bosted; skolehelsetjenesten finnes på alle skoler, er gratis og kan kontaktes uten henvisning. Ingen helsestasjon er tildelt hele Nyhavna i dette datasettet. | V-HELSE, V-SKOLEHELSE |

## 3. Viktige rettelser før import

1. **Strandveiparken er åpen igjen.** Kommunen oppgir gjenåpning 26. mai 2025. Ikke viderefør 2023-stenging som dagens status. [Kommunens gjenåpningsartikkel][V-PARK-AAPEN]
2. **Kapasitetskartet handler om utbygging.** Fjern rapportens slutning om at rød farge i seg selv betyr at barnet risikerer en annen skole. [Kommunen: forklaring av skolekapasitetskart][V-KAPASITET]
3. **Avgrens skoleopplysningene til planområdet.** Planbeskrivelsen omtaler Transittkaia; den dokumenterer ikke alle adresser som markedsføres som Nyhavna. [Planbeskrivelse Transittkaia][V-PLANB], [Kommunen: Finn din skolekrets][V-KRETS]
4. **Dato for lesing er ikke dato for fakta.** Høringssiden for Transittkaia er arkivert og oppdatert 15.04.2026. Høringens sluttdato har passert. Siste endelige vedtaksstatus ble ikke avklart i denne kontrollen; det er ikke det samme som at planen sikkert er ubehandlet. [Transittkaia – kommunens arkiverte høring][V-PLAN]
5. **Sykkelprosjektet har motstridende tidsanslag.** Vegvesenets side sier «bygging forberedes» og oppgir både 2027 og 2028 som åpningsanslag i ulike avsnitt. Ikke skriv at det allerede bygges eller velg ett år som sikkert. [Vegvesenet: Lilleby skole–Nordtvedts gate][V-SYKKEL]
6. **BUA-koblingen har en forklaring.** BUA Leangen flyttet og ble BUA Lademoen i 2026. Den gamle Facebook-adressen er derfor ikke bevis på feil sted. Bruk Røde Kors' nåværende side. [Røde Kors: BUA Lademoen][V-BUA], [Røde Kors: åpningen etter flytting][V-BUA-HIST]
7. **Aktivitetene må knyttes til riktig sted.** Kilden dokumenterer Jubateater på Lademoen for 4.–7. trinn, ikke alle danse- og Tweenies-tilbudene på samme oversiktsside. Lade Motor krever fast deltakelse og er fra 13 år. [Kommunen: kulturtilbud for barn][V-KULTUR], [Lade Motor][V-MOTOR]
8. **Rapportens kildestruktur trenger reparasjon.** F-PLAN-05 brukes, men er aldri definert. KILDE-10 og KILDE-16 er samme ROS-PDF. F-PLAN-07 står under transport. Behold sporbarhet, men fjern brutt referanse og duplisert kilde ved senere import.
9. **Miljøbeskrivelsen må ha riktig omfang.** ROS gjelder Transittkaia og skiller mellom eksisterende situasjon og foreslåtte tiltak. Tall og soner kan ikke overføres direkte til enhver fremtidig bolig. Analysen beskriver også tiltak og vurderer prosjektet som gjennomførbart med oppfølging. [ROS-analyse Transittkaia][V-ROS]

## 4. Behandling av samtlige 42 faktaposter

**Behold** = kjerneopplysningen kan brukes med oppgitt kilde og avgrensning. **Revider** = korriger ordlyd, status, omfang eller kilde før bruk. **Hold** = ikke ta detaljpåstanden inn i aktiv kunnskap uten videre kontroll. Ved «revider» gjelder godkjenningen bare den avgrensede opplysningen i tabellen, ikke hele originalposten.

| Faktapost | Behandling | Plassering / presisering | Kilder |
|---|---|---|---|
| F-PLAN-01 | Revider | Bakgrunn til FAQ 1. Bruk «kommunedelplan fra 2016»; aprilvedtaket ble fulgt av justeringer. Ikke velg én endelig dato uten vedtakskjeden. | V-PLAN, V-KDP-NOTAT |
| F-PLAN-02 | Behold | FAQ 1/11, bare som utbyggers betingede anslag: byggestart 2027 og innflytting 2029. | V-NYHAVNA |
| F-PLAN-08 | Revider | FAQ 1/11. Langvarig, etappevis utvikling er støttet. Hold eksakt 10–30 år og 440 000 m² utenfor; ingen varighet ved en bestemt bolig følger av disse tallene. | V-HAVN |
| F-PLAN-09 | Behold | Bakgrunn: kvalitetsprogram vedtatt 19.05.2022, veiledende. Ikke et løfte om ferdige tilbud. | V-DOKUMENTER |
| F-PLAN-10 | Behold | Bakgrunn: kommunen oppgir KPA vedtatt 27.03.2025 og føringer for tjenesteyting/idrett. Ikke realiseringsvedtak for en skole. | V-PLAN |
| F-PLAN-11 | Revider | Høringshistorikk. Fire alternativer og frist er dokumentert; «på offentlig ettersyn nå» tas ut. | V-PLAN |
| F-SKOLE-01 | Revider | FAQ 3. Lilleby/Rosenborg gjelder Transittkaia i planmaterialet, ikke ubetinget hele Nyhavna. | V-PLANB s. 21 |
| F-SKOLE-02 | Behold | FAQ 3. Adressebasert skolekrets. | V-KRETS |
| F-SKOLE-03 | Revider | Oppfølging FAQ 3. Datert kapasitetsopplysning i planarbeidet; ikke individuell plassavgjørelse. | V-PLANB s. 21, V-KAPASITET |
| F-SKOLE-04 | Hold | Historiske elev-/prognose-/kapasitetstall er ikke tilstrekkelig etterkontrollert. Skolens navn og adresse kan brukes fra egen side. | V-LILLEBY |
| F-SKOLE-04b | Revider | Skolen oppgir ca. 500 elever. Fjern udokumentert vurdering «nær kapasitet 400–600». Elevtall utelates fra førstesvaret. | V-ROSENBORG |
| F-SKOLE-05 | Revider | Bakgrunn FAQ 1/3: plassering og planprosess uavklart i datert materiale. Skriv «ingen åpning bekreftet i materialet», ikke at ingen nyere beslutning kan finnes. | V-PLANB s. 21 |
| F-BHG-01 | Revider | Ikke «ingen barnehager på Nyhavna». Skill Transittkaia fra nærområdet og ordinær barnehage fra åpent tilbud. Fjern 54 plasser og nærmeste-rangering. | V-PLANB s. 20–21, V-BHG-L |
| F-BHG-02 | Behold | FAQ 2. Bekreftede eksisterende alternativer fra kommunens register. Ingen plassgaranti. | V-BHG-REG, V-BHG-N, V-BHG-V |
| F-BHG-03 | Revider | FAQ 1/2. Foreslått barnehage; tidspunkt avhenger av alternativ og utbygging. Hold nøyaktig utearealkrav utenfor til bestemmelsene er kontrollert. | V-PLAN, V-PLANB s. 2–3 |
| F-LEK-01 | Behold | FAQ 7. Lademoparken og småbarnslek. | V-PARK-L |
| F-LEK-02 | Behold | FAQ 7. Ladeparken og aktiviteter; bruk fungerende parkside. | V-PARK-LADE |
| F-LEK-03 | Revider | FAQ 7/9. Erstatt stengt-status med oppgradert/gjenåpnet 2025. | V-PARK-S, V-PARK-AAPEN |
| F-LEK-04 | Behold | Oppfølging FAQ 7. Buranbanen er aktivitetspark, ikke bare gammel grusbane. | V-BURAN |
| F-FRI-01 | Revider | FAQ 8/9. Gratis klubb bekreftet. Motstridende gaming-ukedag på siden; ikke kopier onsdag. Minste besøksalder er uavklart. | V-KLUBB |
| F-FRI-02 | Revider | FAQ 8. Lade Motor fra 13 år; fast, forpliktende deltakelse, ikke generell drop-in. | V-MOTOR |
| F-FRI-03 | Revider | FAQ 8. Behold Jubateater 4.–7. trinn; fjern udokumentert dans/Tweenies/gratisstatus på Lademoen. Semesteropptak gjenstår. | V-KULTUR |
| F-FRI-04 | Behold | FAQ 8. Gratis utstyrslån i Innherredsveien 91; kilde byttes til operatør. Ikke presenter som ungdomsklubb. | V-BUA, V-BUA-HIST |
| F-FRI-05 | Revider | Oppfølging FAQ 9. Rosenborgs KLUBBEN er primært for skolens elever; gratisstatus er ikke bekreftet. | V-ROSENBORG |
| F-FRI-06 | Revider | Bakgrunn, mest relevant for Servering/Opplevelser. Havet har ulike aldersgrenser per tilbud og arrangement; ikke én regel for hele området. | V-HAVET |
| F-FRI-07 | Revider | Oppfølging FAQ 9. Attribuer innbyggernes beskrivelse av mangler til kommunens områdeanalyse; ikke «nesten ingen tilbud» som fasit. | V-OMRADE |
| F-BAD-01 | Behold | Bakgrunn under Natur/bading. Offentlig badebrygge; egnethet for et bestemt barn krever mer enn at anlegget finnes. | V-BADEPLASS |
| F-BAD-02 | Revider | Bakgrunn ved bade-spørsmål. Treårsklassifisering er ikke dagens enkeltprøve eller et permanent badeforbud. | V-BADEVANN |
| F-BAD-03 | Revider | Skill realisert pilot fra fremtidig arealformål. Ikke gjenta gammel landdel-status som dagens bygge-status. | V-PILOT, V-PLANB s. 7 |
| F-BAD-04 | Revider | Pirbadet beholdes som alternativ. Gamle priser 135/180 tas ut. Eventuelle nye priser må angi kjøpskanal og dato; ingen «noen minutter unna». | V-PIRBADET |
| F-TRAFF-01 | Revider | FAQ 4/11. Datert beskrivelse av planområdet; ikke sikkerhetsvurdering av enhver skolevei. | V-ROS s. 7, V-BARN-PLAN |
| F-TRAFF-02 | Revider | FAQ 4. Planlagt forbindelse; byggestatus og årstall må ikke fremstilles sikrere enn prosjektsiden. | V-SYKKEL |
| F-TRAFF-03 | Behold | FAQ 4/11. Behov for trygg skolevei og hensyn i anleggsperioden, med konkret uttalelse fra barnas representant. | V-BARN-PLAN |
| F-TRANS-01 | Revider | Transport-bakgrunn. Lademoen stasjon/R70 bekreftet. Stasjonsavstand er ikke gangrute; busstilbud krever egen kilde. | V-BANENOR |
| F-TRANS-02 | Revider | Transport-bakgrunn. Revidert planbeskrivelse omtaler mobilitetsplan som vedtatt 29.01.2026. Selve vedtaksprotokollen er ikke lest; ingen slutning om ferdig metrobuss. | V-PLANB s. 23, V-MOBILITET-REF |
| F-PLAN-07 | Revider | Transport-bakgrunn: planmål om lite biltrafikk, ikke dagens tilstand. Utelat 0,3 parkeringstall fra eldre ROS; nytt planmateriale bruker andre forutsetninger. | V-PLANB s. 92 |
| F-MILJO-01 | Revider | FAQ 11-bakgrunn: avgrens støypåstand til undersøkt område og situasjon. | V-ROS s. 7–9, 14–15 |
| F-MILJO-02 | Revider | Modellert luftkvalitet i avgrenset område; ikke måling i fremtidige hjem. | V-ROS s. 9–10, 15 |
| F-MILJO-03 | Behold | Forurensningsfunn må følges av krav til håndtering og kontroll. | V-ROS s. 34, 39 |
| F-MILJO-04 | Behold | Fortsatt havnevirksomhet inngår i planforutsetningene. | V-ROS s. 9, 47 |
| F-MILJO-05 | Revider | Kilden omtaler kanter og redningsstiger. Det er ikke dokumentasjon på ferdig sikring for småbarn. | V-ROS s. 47–48 |
| F-MILJO-06 | Revider | Innledende undersøkelser fant ikke deponigass. Behold betinget oppfølging; bomber omtales i en avgrenset anleggsvurdering. Ikke generell farepåstand. | V-ROS s. 39–42 |

Gjennomgangen av de 42 faktapostene gir **13 behold, 28 revider og 1 hold tilbake**. Dette er redaksjonelle beslutninger i dokumentet; originalrapporten og demoens data er ikke endret.

Den udefinerte **F-PLAN-05** skal ikke bli en faktapost ved automatisk import. Det relevante innholdet om byrom/promenade kan dokumenteres med V-PLAN i FAQ 1; detaljer om lekeplasskrav krever egne kontrollerte bestemmelser.

## 5. Alt innhold får en plass – uten flere hovedspørsmål nå

| FAQ i Claude-rapporten | Plass i vår struktur |
|---|---|
| 1 Skolekrets | FAQ 3 |
| 2 Skolekapasitet | Oppfølging til FAQ 3, med korrigert betydning |
| 3 Ny skole | FAQ 1 og oppfølging til FAQ 3 |
| 4 Barnehager | FAQ 2; foreslått ny barnehage til FAQ 1 |
| 5 Lek | FAQ 7 |
| 6 Fritid | FAQ 8 |
| 7 Gratis møteplasser | FAQ 9 |
| 8 Skolevei | FAQ 4 |
| 9 Kollektivtransport | Bakgrunn til skole-/aktivitetsreiser; detaljsvar hører også til Transport |
| 10 Bading | Bakgrunn ved oppfølgingsspørsmål; primært Natur |
| 11 Miljøforhold | Bakgrunn til FAQ 11, geografisk og tidsmessig avgrenset |
| 12 Byggeperiode | FAQ 1/11, ingen fast varighet ved en bestemt bolig |
| 13 Kaikanter | Bakgrunn til FAQ 11 og spørsmål om sjø/lek |
| 14 Før boligkjøp | FAQ 11 |

Ved senere import beholdes de åtte eksisterende FAQ-ID-ene i del 2 og tre nye opprettes. Ingen steder/pins opprettes i denne runden. Rapportens stedsoversikt er kandidater til en senere fase; koordinater og adresseavvik er ikke godkjent gjennom denne FAQ-kontrollen.

### Kunnskapshull som faktisk gjenstår

| Hull | Hva som må til | Berørte FAQ |
|---|---|---|
| Konkret bolig og innflyttingstid | Adresse/prosjektavgrensning og relevant tidspunkt for skolekrets og helsestasjon. Ikke anta at et punkt midt på Nyhavna representerer alle boliger. | 3, 4, 10 |
| Skole- og videregåenderuter | Mål gang-/sykkel-/kollektivruter fra valgt startpunkt; kontroller kryssinger og anleggsomlegginger separat. | 4, 6 |
| Siste Transittkaia-/skolevedtak | Les oppdatert planregister/saksprotokoll. Daterte planforslag er ikke bevis for at ingen senere vedtak finnes. | 1, 3, 11 |
| Sykkelprosjektets reelle fremdrift | Avklar motstridende opplysninger før det gis et årstall eller sies «under bygging». | 4 |
| Fritid med bredde | Suppler med relevante idrettslag, alderstrinn, sted og påmelding. Kontroller teaterets semester og klubbens besøksalder. | 8, 9 |
| Plasser og opptak | Ledige barnehage-/kursplasser kan ikke avledes fra at tilbudet finnes. | 2, 8 |

### Før dette legges i JSON

Bruk de korte svarene som førstesvar og lagre kontrollert bakgrunn separat med kilde-ID-er. Ikke legg hele rapporten inn i stemmeinstruksen. Skill fakta, forslag, datert historikk og uavklart status. Behold `checkedAt` (når kilden ble lest) adskilt fra kildens dato og perioden opplysningen gjelder. Ikke sett en samlet «verifisert»-etikett på originalrapporten.

Svarene med delvis dekning kan brukes som ærlige førstesvar, men skal ikke markeres som full dekning av behovet. Ved manglende detalj skal agenten si hva den mangler og bruke det den faktisk vet. Ingen automatisk nettsøking eller JSON-import er implementert her.

## 6. Kilder kontrollert i denne runden

Kontrolldato for nedenstående kilder: 13.09.2026. Oppdatert-dato er oppgitt der den ble funnet; en oppdatert nettside kan fortsatt ha eldre underavsnitt. PDF-sidetall er dokumentets sider, 1-basert. V-PLANB ble lastet ned fra kommunens nåværende lenke og lest med `pdftotext` fordi nettleserverktøyets PDF-parser feilet.

| ID | Primærkilde / hva den støtter | Dokumentdato eller merknad |
|---|---|---|
| V-PLAN | [Transittkaia – kommunens arkiverte høring][V-PLAN] | Oppdatert 15.04.2026. Høringsfrist 28.04.2026. Ikke bevis på siste vedtaksstatus. Erstatter bred bruk av KILDE-14. |
| V-PLANB | [Planbeskrivelse Transittkaia][V-PLANB] | Rev. 30.01.2026, særlig s. 20–21, 23 og 92. Forslagsstillers materiale publisert av kommunen; detaljbeskrivelsen gjelder primært alternativ 1/2. |
| V-NYHAVNA | [Utbyggers Transittkaia-side][V-NYHAVNA] | Betingede tidsanslag, ikke vedtatte datoer. Tilsvarer KILDE-18. |
| V-DOKUMENTER | [Nyhavnas dokumentoversikt][V-DOKUMENTER] | Vedtak/rolle for kvalitetsprogrammet. |
| V-KDP-NOTAT | [Kommunens notat om justering av 2016-vedtak][V-KDP-NOTAT] | 20.05.2016; forklarer hvorfor flere vedtaksdatoer forekommer. |
| V-HAVN | [Kommunen om gradvis utvikling og fortsatt byhavn][V-HAVN] | 21.04.2021, historisk planforutsetning om flerårig utvikling. Ingen oppdatert ferdigdato. |
| V-BARN-PLAN | [Barnas representants uttalelse om Transittkaia][V-BARN-PLAN] | Én side, dato ikke synlig. Skolevei, lek og anleggsperiode. |
| V-ROS | [ROS-analyse Transittkaia][V-ROS] | Artelia, 21.03.2025, v2.2, 57 sider. Erstatter dobbeltføring KILDE-10/16. |
| V-SYKKEL | [Vegvesenet: Lilleby skole–Nordtvedts gate][V-SYKKEL] | Statusfelt «bygging forberedes»; motstridende årstall internt. KILDE-24. |
| V-MOBILITET-REF | [Planinitiativ Bunkerkvartalet, kap. 6.8][V-MOBILITET-REF] | 30.01.2026, s. 19, omtaler bystyrevedtak 29.01.2026. Sekundær bekreftelse i et primært plandokument; protokollen er ikke kontrollert. |
| V-KRETS | [Kommunen: Finn din skolekrets][V-KRETS] | Oppdatert 18.06.2025. KILDE-08. |
| V-KAPASITET | [Kommunen: forklaring av skolekapasitetskart][V-KAPASITET] | Oppdatert 18.08.2026. Dokumenterer kartets funksjon, ikke en families tildeling. |
| V-LILLEBY | [Lilleby skole][V-LILLEBY] | Oppdatert 19.08.2026; eldre underavsnitt forekommer. |
| V-ROSENBORG | [Rosenborg skole][V-ROSENBORG] | Oppdatert 08.09.2026; skole og KLUBBEN. KILDE-15. |
| V-BHG-REG | [Kommunens barnehageregister][V-BHG-REG] | Erstatter Finn-områdeprofilen som dokumentasjon for eksisterende barnehager. |
| V-BHG-L | [Lademoen barnehage][V-BHG-L] | Østersunds gate 3. |
| V-BHG-N | [Nedre Elvehavn barnehage][V-BHG-N] | Dyre Halses gate 6, Sentrum barnehager. |
| V-BHG-V | [Voldsminde barnehage][V-BHG-V] | Mellomveien 5, Sentrum barnehager. |
| V-BHG-OPPTAK | [Kommunen: Barnehageplass][V-BHG-OPPTAK] | Opptaksprosess og søknad. Ikke ledige plasser per barnehage. |
| V-SKYSS | [Trøndelag: skoleskyss i grunnskolen][V-SKYSS] | Generelle regler og saksgang. |
| V-SKYSS-REG | [Retningslinjer for grunnskoleskyss][V-SKYSS-REG] | Vedtatt 10.04.2025, særlig s. 5–8 og 19. |
| V-VGS-TS | [Thora Storm videregående skole][V-VGS-TS] | Egne utdanningstilbud; Suhms gate 6. |
| V-VGS-TK | [Trondheim Katedralskole][V-VGS-TK] | Egne utdanningstilbud. |
| V-INNTAK | [Trøndelag: inntak][V-INNTAK] | Inntak 2026/27. Ingen lovnad om bestemt skoleplass. |
| V-HELSE | [Kommunen: Finn din helsestasjon][V-HELSE] | Tilhørighet krever bosted; ikke avklart for en bolig her. |
| V-SKOLEHELSE | [Kommunen: Skolehelsetjenesten][V-SKOLEHELSE] | Tilbud på alle skoler og direkte kontakt. |
| V-PARK-S | [Strandveiparken][V-PARK-S] | Nåværende parkbeskrivelse, oppgradering ferdig mai 2025. |
| V-PARK-AAPEN | [Kommunens gjenåpningsartikkel][V-PARK-AAPEN] | Oppgir gjenåpning 26.05.2025. Erstatter stengingsnyheten som nåtidskilde. |
| V-PARK-L | [Lademoparken][V-PARK-L] | Park og lek. KILDE-21. |
| V-PARK-LADE | [Ladeparken][V-PARK-LADE] | Fungerende lenke erstatter gammel KILDE-22. |
| V-BURAN | [Buranbanen][V-BURAN] | Aktivitetspark oppgradert 2023. |
| V-KLUBB | [Lade fritidsklubb][V-KLUBB] | Oppdatert 03.09.2026; ulike ukedager i overskrift og brødtekst. KILDE-11. |
| V-MOTOR | [Lade Motor][V-MOTOR] | Oppdatert 17.10.2025; alder og deltakelsesvilkår. |
| V-KULTUR | [Kommunen: kulturtilbud for barn][V-KULTUR] | Oppdatert 15.12.2025; kontroller sted per aktivitet. |
| V-BUA | [Røde Kors: BUA Lademoen][V-BUA] | Operatørens egen side, gratis utlån og adresse. |
| V-BUA-HIST | [Røde Kors: åpningen etter flytting][V-BUA-HIST] | Åpning 27.05.2026; forklarer Leangen-navnet. |
| V-OMRADE | [Kommunen: områdesatsing Lademoen][V-OMRADE] | Områdeanalyse; ikke fullstendig register over tilbud. |
| V-HAVET | [Havet][V-HAVET] | Nåværende tilbud og aldersgrenser per del/arrangement. |
| V-BADEPLASS | [Kommunen: Strandveikaia badeplass][V-BADEPLASS] | Offentlig anlegg, ikke individuell egnethetsvurdering. |
| V-BADEVANN | [Kommunen: badevannskvalitet][V-BADEVANN] | Skill flerårig klassifisering fra aktuelle prøver. |
| V-PILOT | [Kommunen: pilotbadeplass][V-PILOT] | Historikk om sjødel 2022; gammel restarbeidsstatus videreføres ikke. |
| V-PIRBADET | [Pirbadets egne priser][V-PIRBADET] | Pris avhenger av kjøpskanal; gamle tall i rapporten er erstattet som kildegrunnlag. |
| V-BANENOR | [Bane NOR: Lademoen stasjon][V-BANENOR] | Tog og stasjonsadresse, ikke busstilbud eller gangrute. |

[V-PLAN]: https://www.trondheim.kommune.no/aktuelt/kunngjoring-arealplan/arkiv-planer-kunngjort/2026/Transittkaia-detaljregulering/
[V-PLANB]: https://www.trondheim.kommune.no/globalassets/10-bilder-og-filer/10-byutvikling/byplankontoret/1b_offentlig-ettersyn/2026/transittkaia/2.-planbeskrivelse.pdf
[V-NYHAVNA]: https://nyhavna.no/bo/transittkaia/
[V-DOKUMENTER]: https://nyhavna.no/om-selskapet/strategiske-dokumenter-og-planer-for-utviklingen-av-nyhavna/
[V-KDP-NOTAT]: https://www.trondheim.kommune.no/globalassets/10-bilder-og-filer-eksternt/10-byutvikling/byplankontoret/kommuneplan/kdp_nyhavna_k20110005/notat-til-bystyret-datert-20.05.2016.pdf
[V-HAVN]: https://www.trondheim.kommune.no/aktuelt/nyhetssaker/2021/etablerer-felles-eiendomsselskap--for-a-utvikle-nyhavna-til-ny-bydel/
[V-BARN-PLAN]: https://www.trondheim.kommune.no/globalassets/10-bilder-og-filer/10-byutvikling/byplankontoret/1b_offentlig-ettersyn/2026/transittkaia/53.-uttalelse-fra-barnas-reprentant.pdf
[V-ROS]: https://www.trondheim.kommune.no/globalassets/10-bilder-og-filer/10-byutvikling/byplankontoret/1b_offentlig-ettersyn/2026/transittkaia/40.-ros-analyse.pdf
[V-SYKKEL]: https://www.vegvesen.no/vegprosjekter/prosjekt/lillebynordtvedtsgate/
[V-MOBILITET-REF]: https://www.trondelagfylke.no/globalassets/dokumenter/plan-og-areal/regionalt-planforum/innmeldingbakgrunnsinformasjon/2026/var/22.04-trondheim---skippergata/202604~2.pdf
[V-KRETS]: https://www.trondheim.kommune.no/tema/skole/praktisk-informasjon-skole/finn-din-skolekrets/
[V-KAPASITET]: https://www.trondheim.kommune.no/tema/bygg-kart-og-eiendom/kart/temakart/
[V-LILLEBY]: https://www.trondheim.kommune.no/org/oppvekst/skoler/lilleby-skole/
[V-ROSENBORG]: https://www.trondheim.kommune.no/org/oppvekst/skoler/rosenborg-skole/
[V-BHG-REG]: https://www.trondheim.kommune.no/tema/barnehage/praktisk-informasjon-foreldre-barnehage/barnehager-i-trondheim/
[V-BHG-L]: https://www.trondheim.kommune.no/org/oppvekst/private-barnehager/lademoen-barnehage/
[V-BHG-N]: https://www.trondheim.kommune.no/org/oppvekst/barnehager/sentrum-bhgr/nedre-elvehavn-bhg/
[V-BHG-V]: https://www.trondheim.kommune.no/org/oppvekst/barnehager/sentrum-bhgr/voldsminde-bhg/
[V-BHG-OPPTAK]: https://www.trondheim.kommune.no/tema/barnehage/barnehageplass/
[V-SKYSS]: https://www.trondelagfylke.no/en/vare-tjenester/samferdsel/Skoleskyss/skoleskyss---grunnskole/
[V-SKYSS-REG]: https://www.trondelagfylke.no/contentassets/bd4a82788cb346598d2b5e12f17e3134/retningslinjer-for-skoleskyss-i-grunnskole_vedtatt-i-ft-100425.pdf
[V-VGS-TS]: https://web.trondelagfylke.no/thora-storm-videregaende-skole/
[V-VGS-TK]: https://web.trondelagfylke.no/trondheim-katedralskole/
[V-INNTAK]: https://www.trondelagfylke.no/inntak
[V-HELSE]: https://www.trondheim.kommune.no/tema/helse-og-omsorg/helsetjenester/helsestasjon/helsestasjon-hovedsak/helsestasjonene/
[V-SKOLEHELSE]: https://www.trondheim.kommune.no/tema/skole/trondheimsskolen/skolehelsetjenesten/
[V-PARK-S]: https://www.trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/parker-og-byrom/strandveiparken/
[V-PARK-AAPEN]: https://trondheim.kommune.no/aktuelt/om-kommunen/annet/prosjekter-fra-a-a/omradesatsingene-i-trondheim/nytt-fra-omradesatsingene/nytt-fra-omradesatsingene/strandveiparken-er-apen--ventetiden-er-over2/
[V-PARK-L]: https://www.trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/parker-og-byrom/lademoparken/
[V-PARK-LADE]: https://www.trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/parker-og-byrom/ladeparken/
[V-BURAN]: https://www.trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/parker-og-byrom/buranbanen/
[V-KLUBB]: https://www.trondheim.kommune.no/tema/kultur-og-fritid/aktivitetstilbudkulturtilbud/fritidsklubber/lade-fritidsklubb/
[V-MOTOR]: https://www.trondheim.kommune.no/tema/kultur-og-fritid/aktivitetstilbudkulturtilbud/fritidsklubber/lade-motor/
[V-KULTUR]: https://www.trondheim.kommune.no/tema/kultur-og-fritid/aktivitetstilbudkulturtilbud/kulturbarn/kulturtilbudforbarn/
[V-BUA]: https://www.rodekors.no/lokalforeninger/trondelag/trondheim/aktiviteter-og-kurs/sosialinkludering/bua/
[V-BUA-HIST]: https://www.rodekors.no/lokalforeninger/trondelag/trondheim/aktuelt/2026/apningsfest/
[V-OMRADE]: https://trondheim.kommune.no/aktuelt/om-kommunen/annet/prosjekter-fra-a-a/omradesatsingene-i-trondheim/omradene/lademoen/
[V-HAVET]: https://www.havetarena.no/
[V-BADEPLASS]: https://www.trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/badeplasser/badeplasser-i-saltvann/strandveikaia-nyhavna/
[V-BADEVANN]: https://www.trondheim.kommune.no/tema/klima-miljo-og-naring/skogbruk/badevannskvalitet/
[V-PILOT]: https://sites.google.com/trondheim.kommune.no/badeplasser/utvikling-av-badeplasser/strandveikaia-pilotbadeplass
[V-PIRBADET]: https://www.pirbadet.no/priser/
[V-BANENOR]: https://www.banenor.no/reise-og-trafikk/stasjoner/-l-/lademoen/
