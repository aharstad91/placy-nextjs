# Placy bruktbolig: en mobil samtale som bygger grensesnittet

Dato: 12. september 2026. Oppdragsgiver: Andreas. Mottaker: Claude.
Status: produktbrief og foreslått gjennomføring, ikke implementert eller validert.

## Oppdraget fra Andreas

Utdyp konseptet og bygg en enkel prototype i eksisterende Next.js-miljø. Målet er å undersøke om en mobil opplevelse kan føles som å snakke med en lokalkjent digital boligguide, samtidig som relevante visuelle elementer dukker opp under samtalen. Andreas omtaler følelsen som en «digital megler»; produktets faktiske ansvar i denne prototypen er boligens beliggenhet og livet rundt den.

Dette dokumentet sammenfatter Andreas' muntlige braindump. Kravene under er hans uttrykte ønsker; teknisk struktur, prøveopplegg og implementeringsrekkefølge er forslag fra Codex som Claude kan forbedre. Ikke behandle forslagene som ferdig produktdesign.

Andreas valgte uttrykkelig bort Stasjonskvartalet/nybygg underveis. Bruk **én bruktbolig**, gjerne en enebolig. Fiktive data er tillatt for å teste opplevelsen. Dette er et selvstendig prototypeløp; Nyhavna-demoen skal fortsatt kunne brukes til sitt møte.

## Goal — autonom gjennomføring (uttrykkelig bestilt av Andreas)

**Mål:** Bygg og lever en fungerende, mobilførst Placy-prototype for én bruktbolig, der brukeren starter en norsk talesamtale om boligens beliggenhet, og samtalen løpende viser relevante svartekster, stedskort, bilder, selgererfaringer, kilder og kart. Tale, kategoritrykk og kartvalg skal dele kontekst. Leveransen skal gjøre det mulig for Andreas å teste om dette føles som en lokalkjent digital boligguide i et naturlig, app-lignende grensesnitt.

Jobb autonomt fra denne briefen gjennom kort planlegging, implementering, integrasjon og nødvendig verifisering. Ta reversible produkt- og teknikkvalg selv og dokumenter viktige antakelser. Ikke stopp ved en plan, et skjermbilde eller en simulering når ekte tale kan kobles til. Stopp for brukeravklaring bare ved en konkret nødvendig avhengighet eller et valg utenfor mandatet; fortsett uavhengig arbeid imens. Ingen push, offentlig utrulling eller endring av Nyhavna-demoen inngår.

**Ferdig når:**

1. Bruktboligeksemplet kan åpnes på en oppgitt lokal URL og har hele flyten fra boligbilde/talestart til dynamiske blokker og fullskjermskart.
2. Ekte norsk tale og lesbart transkript er koblet til. Brukerens kategoritrykk og kartvalg følges opp i samme samtale, og avbrudd/stopp virker.
3. Dokumenterte fakta, selgererfaringer og fiktive data er korrekt merket og behandlet. Relevante ukjente svar blir ikke oppdiktet.
4. De konkrete akseptansekriteriene i briefen er kontrollert så langt miljøet tillater, og nødvendige repo-sjekker er gjennomført. Faktisk API-prøve skilles fra simulering; fysisk telefonprøve som ikke kan utføres, står eksplisitt som åpen.
5. Andreas får URL, kort bruksbeskrivelse, testresultater, kjente begrensninger og et kort læringsnotat. Koden er bevart lokalt og arbeid utenfor scope er urørt.

Ikke marker fullt validert brukeropplevelse dersom mikrofon, telefon eller uinnvidd bruker ikke er prøvd. En ekstern blokkering skal beskrives konkret med hva som faktisk er ferdig; ikke gi et simuleringsresultat status som ekte talevalidering.

### Underagenter og tokenbevisst orkestrering

Andreas ber uttrykkelig om underagenter, med hovedagenten som ansvarlig for helhet, integrasjon og ferdigstillelse. Bruk dem der oppgaver kan utføres uavhengig, og hold hovedagenten i nyttig arbeid parallelt.

Foreslått første fordeling, etter at hovedagenten har låst en liten felles data-/hendelseskontrakt:

- **UI-agent:** mobilskall, bunnkategorier, blokkvisning og kartmodal mot simulerte hendelser. Eier bare avtalte komponentfiler.
- **Data-agent:** sammenhengende boligfixture, fakta-/selger-/eksempelmerking, lokale oppslag og relevant datavalidering. Eier bare fixture- og oppslagsfiler.
- **Hovedagent:** Realtime-adapter, session-livssyklus, felles kontrakt, integrasjon og målrettet sluttprøve.

Dette er en foreslått arbeidsdeling, ikke et krav om parallelle agenter i alle faser. Maksimalt to underagenter samtidig som standard; ingen rekursiv delegering. Hver agent får et kort oppdrag med filansvar, nødvendige referanser, forventet resultat og stoppkriterium. Ikke send full samtalehistorikk eller hele repoet når en kort brief holder. Ikke la flere agenter lese, endre eller teste samme område uten konkret behov.

Bruk en rimeligere tilgjengelig modell til avgrensede implementeringsoppgaver når den passer. Sol er et tidligere uttrykt ønske fra Andreas **dersom miljøet faktisk tilbyr den**; ikke anta at Claude-harnessen kan velge Codex-modeller. Oppgi faktisk modell hvis kjent, og bruk tilgjengelig alternativ uten å installere en ny modellruter. Reserver den mest kapable modellen til uklar produktlogikk, integrasjon og vanskelige feil.

Samle korte leveranser: endrede filer, utført verifisering, åpne funn. Unngå lange gjentatte planer, statuspolling, parallelle fulltester, brede reviewpaneler og flere runder uten et nytt konkret funn. Hovedagenten vurderer resultatet før nye oppgaver startes. Kjør relevante lokale sjekker underveis og én samlet nødvendig sluttkontroll; gjenta bare det nye endringer eller feil berører.

Skill **utviklingsagentenes tokenforbruk** fra **prototypens Realtime-forbruk**. Bygg og test UI med lokal simulering først. Planlegg en kort ekte funksjonsprøve med navngitte spørsmål og stoppkriterium; avslutt API-samtalen etter testen. Ikke kjør en lang automatisk samtale for å teste skjermlayout. Før en kort oversikt over agentoppdrag, testkjøringer og rapportert bruk der verktøyene gir tall. Manglende forbrukstall oppgis som ukjent, aldri som et oppdiktet budsjett eller besparelse.

Andreas har ikke satt et tallfestet tokenbudsjett. Optimaliser arbeidsmåten uten å kutte de avtalte funksjonene. Ved uventet høy bruk: stopp den kostbare aktiviteten, finn årsaken og fortsett med billigere lokal verifisering der det er mulig. Ikke la autonomi bety en ubegrenset testsløyfe.

## Hypotesen

En boligkjøper kan få bedre forståelse av hverdagen rundt boligen gjennom en naturlig samtale som samtidig viser steder, bilder, kilder og kart. Mobilbrukeren kan veksle mellom å snakke, lese og trykke uten å måtte lære et nytt system eller forklare konteksten på nytt.

Vi tester forståelse, flyt og opplevd lokalkunnskap. «Revolusjonerende», betalingsvilje og bedre boligsalg er foreløpig ambisjoner, ikke dokumenterte effekter. Bruktbolig er allerede et aktivt Placy-spor, jf. `docs/strategy/2026-09-11-bruktbolig-spor.md`; denne prototypen erstatter ikke det kommersielle pilotarbeidet.

## Opplevelsen Andreas beskriver

1. **Ankomst:** En mobil forside med bilde av boligen, navn/adresse, kort introduksjon og en tydelig «Snakk om nabolaget»-knapp. Før aktivering er mikrofon og betalt samtale av. Skrivemodus kan komme senere; tale er den avtalte prototypens inngang.
2. **Kom i gang:** Knappen aktiverer samtalen. Brukeren får en kort muntlig introduksjon og synlige knagger, eksempelvis dagligvare, barn og oppvekst eller turmuligheter. Eksempel på tone: «Hei! Jeg kan hjelpe deg å bli kjent med området rundt boligen. Hva er viktig for deg i hverdagen?» Forslagene hjelper uten å kreve et manus.
3. **Samtalen blir en side:** Det guiden sier kan også leses. Svaret kan ledsages av stedskort, bilder, kildehenvisninger, selgererfaringer eller et kartutsnitt. Dette skal oppleves som en sammenhengende mobilside, ikke bare et fast kart med en stemmeknapp.
4. **Kategorier nederst:** Gjenbruk kategoriideen fra boardet. Et trykk på «Barn og oppvekst» blir forstått i samtalen og får en kort, relevant muntlig respons. Brukerens handling endrer både synlig kontekst og samtalens retning.
5. **Kart ved behov:** Et kartutsnitt vises som en blokk når geografien hjelper. Trykk åpner et kart over hele skjermen; lukk går tilbake til samme sted i samtalen. Stedsvalg i kartet følger med tilbake.
6. **Les mer:** Et kort svar om kollektivtilbud kan vise holdeplasskort og lenke til mer informasjon. Brukeren skal kunne undersøke videre uten at guiden leser opp alt.
7. **Selgerens erfaring:** Ta med et lite «Dette sier selgeren»-grunnlag om hvordan det oppleves å bo her. Andreas nevnte Sem & Johnsen som inspirasjon; dette er hans referanse, ikke et eksternt konsept som er undersøkt i denne sesjonen.

Samtalen skal føles lokalkjent, varm og presis. Unngå opplesning av ID-er, verktøysteg, lange kilde-URL-er og gjentatte «jeg skal undersøke»-setninger. Ikke bruk «spør om hva som helst» hvis demoen bare dekker noen temaer.

## Innhold for én troverdig demoverden

Velg ett kompakt og sammenhengende eksempel: boligprofil, noen dagligvarer, holdeplasser, barnehager/skoler, turmuligheter og noen korte selgererfaringer. Nok dybde til minst tre oppfølgingsspørsmål i hvert tema er viktigere enn antall steder. La Claude velge konkret bolig/nabolag etter å ha sett eksisterende data og bilder.

Hvert innholdselement trenger stabil ID og tydelig opphav:

| Type | Presentasjon og bruk |
|---|---|
| Dokumentert lokal opplysning | Faktapåstand med faktisk kilde og kontrolltidspunkt. Lenker må støtte påstanden. |
| Selgerens erfaring | Tilskrives selgeren: «Selgeren forteller …». En personlig opplevelse av ro eller hyggelige naboer blir ikke en universell sannhet. |
| Fiktivt eksempel | Tydelig «Eksempeldata» i demoen og relevant kort. Ikke dikt opp virkelige selgersitater, dokumentasjon eller kilde-URL-er. |
| Ukjent | Et kort ærlig svar og eventuelt faktisk kilde for videre undersøkelse. |

Skillet må også følge med i verktøyresultatene, ikke bare i skjermteksten. Nærmeste skole er ikke automatisk tildelt skolekrets. Ikke påstå skoleplass, opptak, åpningstid, rutetilbud, reisetid eller tilgjengelighet uten passende grunnlag. En fiktiv skolekrets kan demonstreres i en tydelig fiktiv demoverden, men ikke knyttes til en reell adresse som bekreftet opplysning.

Bilder og kart må passe sammen med eksemplet. Illustrasjoner merkes når de ikke viser boligen eller stedet. Unngå en blanding av reelle kartmarkører og fiktive steder som ser faktaverifisert ut.

## Foreslått enkel teknisk ramme

Bruk en separat route og egne komponenter i en isolert worktree. Next.js/React/TypeScript og Placy-kartet er utgangspunktet. Mobil nettleser er første leveranse; native-app, appbutikk, innlogging, ny database, CMS, vektorsøk og generell agentplattform er ikke nødvendig for hypotesen.

**Ett datasett, én samtale, et lite antall faste blokktyper.** Modellen velger kjent innhold med validerte ID-er. React rendrer på forhånd definerte blokker; modellen genererer ikke vilkårlig HTML, React-kode eller nye URL-er. Begynn med svartekst, stedskort, kartutsnitt, selgererfaring og kilde/les-mer-kort. Bilder kan være del av disse blokkene.

Forslag til flyt:

`Stemme eller kategoritrykk → oppdatert samtalekontekst → lokalt faktaoppslag → kort talesvar/transkript + strukturerte blokker`

En lokal, versjonert fixture kan dekke hele kunnskapsbehovet. Hold store bilder, rå prosjektdata og tidligere komplette kort ute av samtalekonteksten. La UI beholde historikken uten å sende alt tilbake hver gang. Ikke legg på en egen språkmodell for layout eller en egen tekstchat-backend i første prototype.

Gjenbruk transport og opprydding der det er praktisk, men Nyhavna-endepunktet er i dag bundet til Nyhavna-snapshot og instruksjoner. Det kan ikke brukes uendret til en annen bolig. Skill boligdata/prompt/verktøy fra forbindelsen, eller lag et avgrenset prototypeendepunkt. Ikke bygg omfattende generalisering bare for to demoer.

### Samspill som må være eksplisitt

- Skille mellom **brukerens kategoritrykk**, som kan utløse ett svar, og **agentens kategoriendring**, som ikke skal starte en ny svarsløyfe.
- Nye brukerhandlinger overtar fra gamle svar. Raske trykk skal ikke køe opp flere introduksjoner. Sene verktøyresultater skal ikke flytte brukeren tilbake til et forlatt tema.
- Knytt visuelle blokker til riktig svar og dedupliser hendelser. La kart-/kortinnhold og det som sies handle om samme sted.
- Autoskroll når brukeren følger samtalen; bevar posisjonen når brukeren leser eldre innhold. Lukk fullskjermskart uten å miste siden.
- Synlige tilstander for tilkobling, lytting, tenking, tale, pause og feil. Brukeren må kunne stoppe lyd og mikrofon umiddelbart.
- Avvist mikrofon gir forståelig hjelp og et fortsatt brukbart visuelt eksempel. Ikke legg til full skrivemodus bare for å løse dette.
- Følg mobilens safe areas, dynamisk skjermhøyde og lydbegrensninger. Fysisk telefonprøve krever en fungerende sikker origin og bevisst lokal tilgang; `127.0.0.1` på telefonen er ikke Mac-en.

### Forbruk og arbeidsmåte

Andreas påpekte høyt forbruk i forrige utviklingsrunde. Arbeid med en lokal, deterministisk simulering av samtalehendelser for layout, kort, avbrudd og kategoritrykk. Simuleringen skal være tydelig merket i utvikling og kan ikke brukes som bevis på naturlig samtalekvalitet. Koble deretter til ekte tale og gjennomfør en kort, avgrenset funksjonsprøve. Ingen lange automatiske samtaler eller brede agentteam som standard.

Behold serverstyrt avslutning, inaktivitetsgrense og opprydding. Mikrofon av er ikke nødvendigvis API-samtale avsluttet. Ikke presenter en klienttimer eller tokenestimat som et garantert kronebudsjett. Behold Ash som utgangspunkt fra forrige løp; stemmevalg er ikke det nye eksperimentet.

## Plan som Claude kan utdype

| Trinn | Leveranse | Hva det avklarer |
|---|---|---|
| 1. Avklar utforming i kode | Én kort beskrivelse av mobilflyt, fixture og blokktyper; opprett isolert worktree | At alle uttrykte ønsker er dekket uten å importere hele board-grensesnittet |
| 2. Bygg visuell sekvens | Forside, bunnkategorier, lesbar samtale, kort og kartmodal med simulerte hendelser | Om opplevelsen fungerer på liten skjerm før betalt tale |
| 3. Koble samtalen | Ekte Realtime, boligspesifikke oppslag, tale/transkript og validerte UI-kommandoer | Om modellen kan styre og følge den samme flaten |
| 4. Prøv avbrudd og innhold | Tre temaer i dybden, selgererfaring, ukjent svar, raske kategoritrykk og kart-retur | Om flyt og tillit holder uten fast manus |
| 5. Lever en prøvbar prototype | Lokal URL, nødvendige kontroller og kort rapport med faktisk teststatus | Hva Andreas kan prøve, hva vi lærte og hva som fortsatt er usikkert |

Ikke la planleggingen bli en stor egen leveranse. Claude skal videreutvikle konseptet og bygge; dette dokumentet er en tydelig start, ikke et ferdig skjermdesign.

## Akseptanse og validering

Foreslått prøve med en uinnvidd bruker, uten forklaring utover «utforsk nabolaget rundt denne boligen»:

- Brukeren finner talestart og forstår hva hen kan spørre om.
- Et spørsmål om dagligvare gir et kort svar, relevant kort og kilde/opphav.
- Tre oppfølgingsspørsmål beholder riktig sted og skiller kjent fra ukjent.
- «Barn og oppvekst» reagerer på både tale og trykk uten dobbel respons; skolekrets håndteres ærlig.
- «Hva likte selgeren best?» viser og tilskriver selgererfaringen korrekt.
- Et kartutsnitt åpnes og lukkes uten tap av samtale eller leseposisjon.
- Brukeren kan avbryte, skifte tema og stoppe samtalen; det kommer ingen sen kartflytting eller videre lyd etter stopp.
- 390 px mobilbredde fungerer uten horisontal scrolling. Knapper og kort er brukbare med én hånd.
- Ekte norsk mikrofoninput og høyttaler på telefon testes separat fra simulering og desktop.

Noter: hvor brukeren nøler, når hen velger tale versus trykk, om kortene hjelper eller forstyrrer, om guiden snakker for mye, og om noe virker mer sikkert enn grunnlaget tillater. Registrer opplevd ventetid og faktisk rapportert API-bruk for den korte prøven. Ingen løfter om spart forbruk uten sammenlignbar måling.

## Eksisterende kode og status å orientere seg i

Maskinlokalt hovedrepo: `/Users/andreasharstad/Documents/placy`. Det har andre lokale endringer; ikke reset, stash eller commit dem som del av denne oppgaven. Denne briefen er foreløpig en lokal, usporet fil der.

Maskinlokal referanse: `/Users/andreasharstad/Documents/placy-voice-board`, gren `prototype/nyhavna-voice-board`, commit `e2d448e`. Nyhavna-demo på port 3101. Separat samtaleprototype ligger i `/Users/andreasharstad/Documents/placy-voice-conversation`, port 3102; den er ikke undersøkt i denne overleveringen. Velg ledig port til ny prototype. Ikke push uten Andreas' instruksjon.

I voice-board-worktreet, les målrettet:

| Fil | Hva som er relevant |
|---|---|
| `lib/realtime/use-realtime.ts` | WebRTC, transkript, mikrofonlivssyklus, avbrudd og referanser |
| `lib/realtime/sideband.ts`, `server-session.ts` | Serverens verktøyeierskap, svarvidereføring, tidsgrenser og hangup |
| `app/api/prototype/realtime/route.ts` | Lokal tilgang, servernøkkel og binding til Nyhavna-snapshot; må tilpasses nytt datasett |
| `components/variants/report/board/voice/BoardVoiceAssistant.tsx` | Eksempel på samspill mellom brukerhandlinger, samtale og kart |
| `components/variants/report/board/BoardMap.tsx` | Eksisterende kart og avhengigheter; vurder minste brukbare integrasjon |
| `lib/demo/nyhavna-leve/knowledge.ts`, `lib/realtime/nyhavna-knowledge.ts` | Kildestatus og kompakte faktaoppslag; gjenbruk prinsippene, ikke Nyhavna-innhold |
| `docs/research/nyhavna-leve-demo/validation.md` | Faktisk testbevis og siste retting som ennå ikke er live-verifisert |

Forrige langtest traff API-prosjektets grense på 40 000 tokens/minutt. Den siste rettingen med mindre kontekst og retry har lokale tester, men ikke ny live-bekreftelse. Ikke kall denne konfigurasjonen ferdig bevist. Dagens API-støtte må bekreftes mot aktuell dokumentasjon ved tilkobling; denne briefen er ikke en API-spesifikasjon.

Les gjeldende `CLAUDE.md` før implementering. Andreas har uttrykkelig bedt om runtime Realtime i denne prototypen; dette er et avgrenset brukerbestilt unntak fra repoets generelle build-time-only-regel, ikke en generell arkitekturendring. Ingen API-nøkler skal kopieres inn i dokumenter eller klientkode.
