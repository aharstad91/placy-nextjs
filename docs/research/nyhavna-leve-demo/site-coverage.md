# Dekningsoversikt for nyhavna.no

Kontrollert 13. september 2026. Dokumentet svarer på ett spørsmål: hvilke av
Nyhavna Utviklings egne sider ligger bak den talestyrte omvisningen, og hva er
bevisst utelatt. Innholdet er lagt i `lib/demo/nyhavna-leve/site-knowledge.ts`.

De fire «Leve»-sidene som allerede er kildekontrollert i
`lib/demo/nyhavna-leve/knowledge.ts` er ikke gjentatt her. De står i tabellen
med merkelappen «Dekket i knowledge.ts», og fakta på dem som mangler i
knowledge.ts er listet som kandidater lenger nede.

## Tall

| Mål | Antall |
|---|---:|
| Sider oppdaget i sitemap | 61 |
| Sider gjennomgått | 61 |
| Sider innarbeidet i site-knowledge.ts | 34 |
| Sider dekket av knowledge.ts fra før | 4 |
| Sider utelatt | 23 |
| Poster i site-knowledge.ts | 60 |
| Åpne hull (se egen seksjon) | 6 |

Kartleggingen startet i `https://nyhavna.no/robots.txt`, som peker på
`https://nyhavna.no/sitemap`. Den adressen svarer med XML-sitemap, mens
`/sitemap.xml` gir 404. Alle 61 adressene i sitemapet ble hentet med `curl -sL`
og lest som serverrendret HTML. Ingen sider krevde innlogging, og ingen PDF-er
ble lastet ned.

## Sider

| URL | Tittel | Inkludert/Utelatt | Begrunnelse | Kontrollert |
|---|---|---|---|---|
| [/](https://nyhavna.no/) | Nyhavna – Nå flytter byen nærmere fjorden | Inkludert | src-forsiden: prosjektintroduksjon og beliggenhet | 2026-09-13 |
| [/hva-skjer/](https://nyhavna.no/hva-skjer/) | Hva skjer i Trondheim | Inkludert | src-hva-skjer: at det finnes en arrangementskalender; enkeltarrangementene er tidsavhengige og utelatt | 2026-09-13 |
| [/hva-skjer/aktiviteter/](https://nyhavna.no/hva-skjer/aktiviteter/) | På jakt etter hva som skjer i Trondheim? Ta turen til Nyhavna for kultur, aktiviteter, mat og opplevelser | Inkludert | src-hva-skjer-aktiviteter: eksisterende tilbud (Havet, kajakk, trening, verksted, galleri, gjenbruk) | 2026-09-13 |
| [/hva-skjer/for-barna/](https://nyhavna.no/hva-skjer/for-barna/) | Hva skjer i Trondheim for deg med barn? Å utforske Nyhavna er spennende for hele familien | Inkludert | src-hva-skjer-for-barna: barnetilbud i dag, fire planlagte barnehager, bussholdeplasser | 2026-09-13 |
| [/leve/](https://nyhavna.no/leve/) | Opplev Nyhavna | Dekket i knowledge.ts | Områdegrenser og nåsituasjon ligger allerede i nyhavnaKnowledge.area | 2026-09-13 |
| [/leve/park-og-promenade/](https://nyhavna.no/leve/park-og-promenade/) | Grønne parker og tett på vannet | Dekket i knowledge.ts | Elvepromenaden og de fem ikke-plasserte grøntområdene ligger i knowledge.ts | 2026-09-13 |
| [/leve/promenaden/](https://nyhavna.no/leve/promenaden/) | Promenaden | Inkludert | src-leve-promenaden: femte Leve-side som IKKE er dekket i knowledge.ts; gir Doraparken-koblingen | 2026-09-13 |
| [/leve/cafe-og-restauranter/](https://nyhavna.no/leve/cafe-og-restauranter/) | Café og restauranter | Dekket i knowledge.ts | Dora Kaffebar og Monkey Brew ligger i knowledge.ts | 2026-09-13 |
| [/leve/kunst-og-kultur/](https://nyhavna.no/leve/kunst-og-kultur/) | Kunst og kultur skal prege Nyhavna | Dekket i knowledge.ts | Kulturaksen, de tre kulturområdene og de 12 vernede byggene ligger i knowledge.ts | 2026-09-13 |
| [/bo/](https://nyhavna.no/bo/) | Velkommen som beboer på Nyhavna | Inkludert | src-bo: salgsstart, kjøp/leie, avstand til Midtbyen | 2026-09-13 |
| [/bo/transittkaia/](https://nyhavna.no/bo/transittkaia/) | Transittkaia | Inkludert | src-bo-transittkaia: byggetrinn, areal, innhold, parker, Doratorget, mobilitetshus | 2026-09-13 |
| [/bo/ladehammerkaia/](https://nyhavna.no/bo/ladehammerkaia/) | Ladehammerkaia | Inkludert | src-bo-ladehammerkaia: solforhold, planlagt innhold, spissbunkerne | 2026-09-13 |
| [/bo/kullkranpiren/](https://nyhavna.no/bo/kullkranpiren/) | Kullkranpiren | Inkludert | src-bo-kullkranpiren: park, bro, nybygg for akustisk musikk | 2026-09-13 |
| [/bo/strandveikaia/](https://nyhavna.no/bo/strandveikaia/) | Strandveikaia | Inkludert | src-bo-strandveikaia: nåsituasjon, kulturklynge, sjøbad, metrobuss, Strandveien 100 | 2026-09-13 |
| [/bo/bunkerkvartalet/](https://nyhavna.no/bo/bunkerkvartalet/) | Bunkerkvartalet | Inkludert | src-bo-bunkerkvartalet: planinitiativ, Dora 2 og Vitensenteret, Fyringsbunkeren og Bunkerparken | 2026-09-13 |
| [/bo/nyhetsbrev/](https://nyhavna.no/bo/nyhetsbrev/) | Følg utviklingen på Nyhavna | Utelatt | Samme påmeldingsskjema som /nyhetsbrev/; ingen egne fakta | 2026-09-13 |
| [/aktuelt/](https://nyhavna.no/aktuelt/) | Aktuelt | Utelatt | Indeksside uten egne fakta; bare datoer og lenker til de enkelte sakene | 2026-09-13 |
| [/aktuelt/klart-for-renovering-av-foerste-kulturminne/](https://nyhavna.no/aktuelt/klart-for-renovering-av-foerste-kulturminne/) | Klart for renovering av første kulturminne | Inkludert | src-aktuelt-strandveien-100: entreprenør, ferdigår 2027, bruk per etasje | 2026-09-13 |
| [/aktuelt/kan-kunst-bidra-til-bedre-byutvikling/](https://nyhavna.no/aktuelt/kan-kunst-bidra-til-bedre-byutvikling/) | Kan kunst bidra til bedre byutvikling? | Utelatt | Omtaler Trondheimsbiennalen våren 2026; ingen status- eller planfakta for området | 2026-09-13 |
| [/aktuelt/sjoevann-og-overskuddsenergi-skal-varme-opp-nyhavna/](https://nyhavna.no/aktuelt/sjoevann-og-overskuddsenergi-skal-varme-opp-nyhavna/) | Sjøvann og overskuddsenergi skal varme opp Nyhavna | Inkludert | src-aktuelt-energi: energisentral, brønnlager, 20 års utbyggingsperiode | 2026-09-13 |
| [/aktuelt/rodeo-arkitekter-skal-utvikle-bunkerkvartalet-paa-nyhavna/](https://nyhavna.no/aktuelt/rodeo-arkitekter-skal-utvikle-bunkerkvartalet-paa-nyhavna/) | Rodeo Arkitekter skal utvikle Bunkerkvartalet på Nyhavna | Inkludert | src-aktuelt-rodeo: 45 dekar tomteareal, rådgiver, samarbeidspartnere | 2026-09-13 |
| [/aktuelt/1-million-i-enova-stoette-til-ombruksprosjekt/](https://nyhavna.no/aktuelt/1-million-i-enova-stoette-til-ombruksprosjekt/) | 1 million i Enova-støtte til ombruksprosjekt | Inkludert | src-aktuelt-enova: støttebeløp og ombruksambisjon i Strandveien 100 | 2026-09-13 |
| [/aktuelt/naa-blir-det-studenthus-paa-nyhavna/](https://nyhavna.no/aktuelt/naa-blir-det-studenthus-paa-nyhavna/) | Nå blir det studenthus på Nyhavna! | Inkludert | src-aktuelt-studenthus: studentsenter i Skippergata 13 | 2026-09-13 |
| [/aktuelt/naerom-gjenvinningsstasjon-for-gaaende-og-syklende-ved-nyhavna/](https://nyhavna.no/aktuelt/naerom-gjenvinningsstasjon-for-gaaende-og-syklende-ved-nyhavna/) | NærOm | Inkludert | src-aktuelt-naerom: hverdagsfakta med åpningstider og pilotperiode | 2026-09-13 |
| [/aktuelt/ubiq-aerospace-til-nyhavna/](https://nyhavna.no/aktuelt/ubiq-aerospace-til-nyhavna/) | Ubiq Aerospace til Nyhavna Innovasjonsdistrikt | Utelatt | Enkeltbedrift; næringsprofilen dekkes på områdenivå av /jobbe/ | 2026-09-13 |
| [/aktuelt/bunkerkvartalet-kan-gi-35-000-m2-nybygg-til-havteknologimiljoeet/](https://nyhavna.no/aktuelt/bunkerkvartalet-kan-gi-35-000-m2-nybygg-til-havteknologimiljoeet/) | Bunkerkvartalet kan gi 35 000 m² nybygg til havteknologimiljøet | Inkludert | src-aktuelt-bunkerkvartalet-nybygg: arealpotensial og innflytting 2030 | 2026-09-13 |
| [/aktuelt/bunkerkvartalet-fra-krigshistorie-til-kreativt-kraftsenter/](https://nyhavna.no/aktuelt/bunkerkvartalet-fra-krigshistorie-til-kreativt-kraftsenter/) | - Vi trenger ikke plysj og pusset messing | Inkludert | src-aktuelt-bunkerkvartalet-kultur: kulturlivets ønsker, medvirkning | 2026-09-13 |
| [/aktuelt/naa-kan-du-si-din-mening-om-transittkaia/](https://nyhavna.no/aktuelt/naa-kan-du-si-din-mening-om-transittkaia/) | Nå kan du si din mening om Transittkaia | Inkludert | src-aktuelt-transittkaia-hoering: høringen og de fire alternativene | 2026-09-13 |
| [/aktuelt/hva-er-en-hoering/](https://nyhavna.no/aktuelt/hva-er-en-hoering/) | Hva er en høring? | Inkludert | src-aktuelt-hoering: kundespørsmål om høring og detaljregulering | 2026-09-13 |
| [/aktuelt/eelume-vokser-flytter-inn-i-oppussede-lokaler-paa-nyhavna/](https://nyhavna.no/aktuelt/eelume-vokser-flytter-inn-i-oppussede-lokaler-paa-nyhavna/) | Eelume vokser – flytter inn i oppussede lokaler på Nyhavna | Utelatt | Enkeltbedrift; ingen område-status- eller planfakta utover det /jobbe/ dekker | 2026-09-13 |
| [/aktuelt/en-stor-nyhet-for-alle-som-er-glade-i-kunst/](https://nyhavna.no/aktuelt/en-stor-nyhet-for-alle-som-er-glade-i-kunst/) | TSSK flytter inn på Nyhavna | Inkludert | src-aktuelt-tssk: ny kunstinstitusjon i Kullbingen, pilot 2027-2030 | 2026-09-13 |
| [/aktuelt/soek-stoette-til-arrangement-paa-nyhavna/](https://nyhavna.no/aktuelt/soek-stoette-til-arrangement-paa-nyhavna/) | Søk støtte til arrangement på Nyhavna | Inkludert | src-aktuelt-arrangementsstotte: konkret ordning med beløp og kriterier | 2026-09-13 |
| [/aktuelt/nytt-samarbeid-styrker-trondheim-som-testarena-for-havteknologi/](https://nyhavna.no/aktuelt/nytt-samarbeid-styrker-trondheim-som-testarena-for-havteknologi/) | Nytt samarbeid styrker Trondheim som testarena for havteknologi | Utelatt | Partnerskap uten stedfestede status- eller planfakta; hovedsaken ligger på et eksternt nettsted | 2026-09-13 |
| [/aktuelt/et-liv-i-soem-paa-nyhavna-bjoerg-fant-paradiset-sitt/](https://nyhavna.no/aktuelt/et-liv-i-soem-paa-nyhavna-bjoerg-fant-paradiset-sitt/) | Et liv i søm på Nyhavna – Bjørg fant paradiset sitt | Utelatt | Personportrett uten status- eller planfakta | 2026-09-13 |
| [/aktuelt/det-maritime-ki-miljoeet-har-faatt-en-havn-paa-nyhavna/](https://nyhavna.no/aktuelt/det-maritime-ki-miljoeet-har-faatt-en-havn-paa-nyhavna/) | Det maritime KI-miljøet har fått en havn på Nyhavna | Utelatt | Enkeltbedrift; næringsprofilen dekkes av /jobbe/ | 2026-09-13 |
| [/aktuelt/intensjonsavtale-med-futurebuilt/](https://nyhavna.no/aktuelt/intensjonsavtale-med-futurebuilt/) | Berit Rusten i FutureBuilt. Foto: Geir Anders Rybakken Ørslien | Inkludert | src-aktuelt-futurebuilt: forpliktelse om kriterier for Bunkerkvartalet | 2026-09-13 |
| [/aktuelt/arkitekter-med-frie-toeyler-paa-nyhavna/](https://nyhavna.no/aktuelt/arkitekter-med-frie-toeyler-paa-nyhavna/) | Arkitekter med frie tøyler på Nyhavna | Utelatt | Midlertidig biennale-prosjekt i mai; ingen varige status- eller planfakta | 2026-09-13 |
| [/aktuelt/galleri-for-fotokunst-i-strandveien-100/](https://nyhavna.no/aktuelt/galleri-for-fotokunst-i-strandveien-100/) | Galleri for fotokunst i Strandveien 100 | Inkludert | src-aktuelt-fotogalleri: eksisterende tilbud i Strandveien 100 | 2026-09-13 |
| [/aktuelt/samler-kreftene-for-aa-utvikle-nyhavna-som-nullutslippsbydel/](https://nyhavna.no/aktuelt/samler-kreftene-for-aa-utvikle-nyhavna-som-nullutslippsbydel/) | Aktørene i Nyhavna Miljøforum. Fra venstre, foran: Magnus Woll Bjartnes (Lunera Energi), Erik Erlien, Anita Olderø (begge Nyhavna Utvikling) og Elisabeth Wærnes (Trondheim Havn). Bak: Daan Boonstra (Nyhavna Utvikling), Kristian H. Lund (Dora Eiendom) og Dag Haugdal (Bane NOR Eiendom) | Inkludert | src-aktuelt-miljoforum: hvem som samarbeider om nullutslippsmålet | 2026-09-13 |
| [/aktuelt/minneutstilling-med-roar-oehlander-paa-galleri-ihundre/](https://nyhavna.no/aktuelt/minneutstilling-med-roar-oehlander-paa-galleri-ihundre/) | Foto tatt av Roar Øhlander, gjengitt med tillatelse fra arrangørene | Inkludert | src-aktuelt-galleri-ihundre: eneste side som slår fast at galleriet finnes på Nyhavna | 2026-09-13 |
| [/aktuelt/kvarteret-vil-bygge-noe-nytt-i-kultur-trondheim/](https://nyhavna.no/aktuelt/kvarteret-vil-bygge-noe-nytt-i-kultur-trondheim/) | Kvarteret vil bygge noe nytt i Kultur-Trondheim | Inkludert | src-aktuelt-kvarteret: eksisterende øvings- og produksjonsmiljø på Strandveikaia | 2026-09-13 |
| [/aktuelt/fremtidens-sjoefart-inntar-nyhavna/](https://nyhavna.no/aktuelt/fremtidens-sjoefart-inntar-nyhavna/) | En av båtene som deltar i konkurransen | Utelatt | Enkeltarrangement i august; tidsavhengig | 2026-09-13 |
| [/aktuelt/brygger-beau-dro-fra-usa-til-nyhavna-for-aa-dyrke-haandverket-sitt/](https://nyhavna.no/aktuelt/brygger-beau-dro-fra-usa-til-nyhavna-for-aa-dyrke-haandverket-sitt/) | Brygger Beau dro fra USA til Nyhavna for å dyrke håndverket sitt | Utelatt | Personportrett; Monkey Brew er dekket i knowledge.ts | 2026-09-13 |
| [/aktuelt/ny-fotoutstilling-aapner-29-august/](https://nyhavna.no/aktuelt/ny-fotoutstilling-aapner-29-august/) | Lørdag 29. august åpner en stor fotoutstilling i GalleriHundre på Nyhavna hvor du kan oppleve stor fotokunst av Marina Tennefoss, Anne Helene Gjelstad og Hanne Larsen. | Utelatt | Enkeltutstilling; galleriet som sted er dekket via minneutstillingssaken | 2026-09-13 |
| [/aktuelt/trondheim-maraton-hei-fram-loeperne-paa-nyhavna/](https://nyhavna.no/aktuelt/trondheim-maraton-hei-fram-loeperne-paa-nyhavna/) | Trondheim Maraton: Hei fram løperne på Nyhavna! | Utelatt | Enkeltarrangement 6. september; tidsavhengig | 2026-09-13 |
| [/om-selskapet/](https://nyhavna.no/om-selskapet/) | Om oss | Inkludert | src-om-selskapet: eierskap, mandat, visjon, mål om arbeidsplasser | 2026-09-13 |
| [/om-selskapet/presse/](https://nyhavna.no/om-selskapet/presse/) | Presse | Utelatt | Pressekontakt og bildearkiv; ingen fakta om området | 2026-09-13 |
| [/om-selskapet/baerekraft/](https://nyhavna.no/om-selskapet/baerekraft/) | Bærekraft på Nyhavna | Inkludert | src-baerekraft: nullutslippsmål, 50-årsperspektiv, mobilitetstiltak | 2026-09-13 |
| [/om-selskapet/selskapsnyheter/](https://nyhavna.no/om-selskapet/selskapsnyheter/) | Selskapsnyheter | Utelatt | Indeksside uten egne fakta | 2026-09-13 |
| [/om-selskapet/selskapsnyheter/anita-olderoe-blir-prosjektsjef-i-nyhavna-utvikling/](https://nyhavna.no/om-selskapet/selskapsnyheter/anita-olderoe-blir-prosjektsjef-i-nyhavna-utvikling/) | Anita Olderø blir prosjektsjef i Nyhavna Utvikling | Utelatt | Ansettelsesnyhet; ingen status- eller planfakta | 2026-09-13 |
| [/om-selskapet/selskapsnyheter/kristoffer-skjerve-blir-business-controller-i-nyhavna-utvikling-as/](https://nyhavna.no/om-selskapet/selskapsnyheter/kristoffer-skjerve-blir-business-controller-i-nyhavna-utvikling-as/) | Kristoffer N. Skjerve blir vår nye Business Controller | Utelatt | Ansettelsesnyhet; ingen status- eller planfakta | 2026-09-13 |
| [/om-selskapet/strategiske-dokumenter-og-planer-for-utviklingen-av-nyhavna/](https://nyhavna.no/om-selskapet/strategiske-dokumenter-og-planer-for-utviklingen-av-nyhavna/) | Dokumenter | Inkludert | src-dokumenter: vedtaksdatoer og status for planhierarkiet | 2026-09-13 |
| [/om-selskapet/varslingsrutiner/](https://nyhavna.no/om-selskapet/varslingsrutiner/) | Varslingsrutiner | Utelatt | Internt regelverk uten relevans for omvisningen | 2026-09-13 |
| [/innspill/](https://nyhavna.no/innspill/) | Innspill | Utelatt | Ingen brødtekst i den serverrendrede HTML-en; et eventuelt skjema er ikke lest | 2026-09-13 |
| [/personvern/](https://nyhavna.no/personvern/) | Personvern | Utelatt | Juridisk tekst uten fakta om området | 2026-09-13 |
| [/historien/](https://nyhavna.no/historien/) | Historien om Nyhavna er historien om Trondheim | Inkludert | src-historien: de fem epokene og bygningsoversikten over de 12 kulturminnene | 2026-09-13 |
| [/jobbe/](https://nyhavna.no/jobbe/) | Jobbe | Inkludert | src-jobbe: havteknologi som satsing, næringslokaler på bakkeplan | 2026-09-13 |
| [/sitemap/](https://nyhavna.no/sitemap/) | https://nyhavna.no/ | Utelatt | Maskinlesbar sidekartside; brukt til kartleggingen, ikke som faktakilde | 2026-09-13 |
| [/robotstxt/](https://nyhavna.no/robotstxt/) | Page Not Found | Utelatt | Returnerer Page Not Found; ingen innhold | 2026-09-13 |
| [/soek/](https://nyhavna.no/soek/) | Søkeresultater | Utelatt | Søkegrensesnitt uten eget innhold | 2026-09-13 |
| [/nyhetsbrev/](https://nyhavna.no/nyhetsbrev/) | Følg utviklingen på Nyhavna | Inkludert | src-nyhetsbrev: forhåndssalg og hva abonnenter får | 2026-09-13 |

## Motstridende eller eldre opplysninger

Ingen av disse er avgjort. Hver er registrert i `conflicts` på den aktuelle
posten, slik at omvisningen kan si at nettstedet spriker i stedet for å velge
side.

1. **Strandveien 100: på vent eller ferdig i 2027.** `/bo/strandveikaia/` sier
   at det videre arbeidet er satt på vent til finansieringen er sikret.
   `/aktuelt/klart-for-renovering-av-foerste-kulturminne/` sier at HENT er valgt
   som totalentreprenør og at bygget skal stå ferdig i 2027. Nettstedet daterer
   ikke hvilken opplysning som er nyest.
2. **Doratorget ligger to steder.** `/bo/transittkaia/` plasserer Doratorget
   midt på Transittkaia, i vest-enden av en kulturakse fra Dora 1.
   `/leve/kunst-og-kultur/` omtaler Doratorget som en del av Kulturaksen i
   Skippergata.
3. **Barnehagen i Transittkaias byggetrinn.** `/hva-skjer/for-barna/` sier den
   første barnehagen kommer i byggetrinn én. I alternativ 4 på høring er den
   flyttet til siste byggetrinn.
4. **Byggestart for Dora 2.** `/historien/` sier 1943 i brødteksten og 1942 i
   bygningsoversikten, på samme side.
5. **Krigsårene.** Samme side omtaler perioden både som 1941–1945 i punktlisten
   og 1940–1945 i avsnittsoverskriften.
6. **Arealet i Bunkerkvartalet.** Overskriften oppgir 35 000 m2, brødteksten et
   spenn på 25 000 til 35 000 m2.
7. **Adressen Strandveien 98 A.** `/historien/` oppgir den for både
   Verftskjøkkenet og Kjelhuset.
8. **Galleriets navn.** Skrives både «Galleri iHUNDRE» og «GalleriHundre».
9. **Doraparken.** Navngitt bare på `/leve/promenaden/`. Ingen side sier hvor
   den ligger eller hvordan den forholder seg til Doratorget.
10. **Signeringsdato uten år.** Saken om Nyhavna Miljøforum sier «torsdag 04.
    juni» uten årstall. Året er derfor ikke gjengitt i posten.
11. **Navneformen «Strandveikaka».** Overskriften på `/leve/kunst-og-kultur/`.
    Allerede registrert som uavklart i `knowledge.ts`; ikke gjentatt her.
12. **Høringens status.** Saken om høringen er datert 18. februar 2026 og
    oppgir ingen frist. Om høringen fortsatt er åpen 13. september 2026, står
    ikke noe sted.

## Skille visjon, vedtatt plan, nåsituasjon og uavklart

Hver post har ett `status`-felt. Regelen som er brukt:

- `existing` — noe som finnes eller har skjedd, og som kilden omtaler i
  nåtidsform eller som fullført. Historiske fakta ligger også her, fordi de er
  etablerte og ikke framtidspåstander. Teksten i en `existing`-post skrives i
  presens og bruker verken «planlagt» eller «skal».
- `adopted-plan` — plandokument vedtatt av Bystyret, med dato. Brukt på
  kommunedelplanen, kvalitetsprogrammet, de fire veiledende programmene og
  eierstrategien.
- `planned` — konkret plan eller prosjekt med framdrift, men ikke vedtatt som
  plandokument. Teksten sier uttrykkelig «planlagt», «foreslått» eller «etter
  planen».
- `vision` — ambisjon eller mål uten framdriftsplan. Nullutslippsmålet,
  femtiårsperspektivet, de 5 000 arbeidsplassene og innspillene fra
  kulturworkshopen.
- `unresolved` — kilden spriker eller lar spørsmålet stå åpent. Brukt på
  framdriften i Strandveien 100 og der illustrasjoner uttrykkelig viser
  muligheter og ikke vedtatte planer.

En automatisk test håndhever at ingen `existing`-post inneholder ordene
«planlagt» eller «skal». Den sjekken er leksikalsk, ikke semantisk: den fanger
de to ordene, ikke alle måter en framtidspåstand kan formuleres på.

## Kandidater fra de fire Leve-sidene

Fakta som står på sidene `knowledge.ts` dekker, men som ikke er tatt inn der.
De er ikke duplisert til `site-knowledge.ts`. Hvis de skal brukes, hører de
hjemme i `knowledge.ts`.

- **Ti strategiske virkemidler.** `/leve/kunst-og-kultur/` sier at kunst og
  kultur er løftet opp som ett av ti strategiske virkemidler i kunst- og
  kulturnæringsprogrammet.
- **Kunst i offentlig rom.** Samme side har et eget mål om at alle
  fellesområder der folk møtes — elvepromenaden, parker, allmenninger og
  offentlige bygg — får permanente verk.
- **Publikumsrettet førsteetasje.** Samme side beskriver utsalg, kafé og
  galleri i første etasje av de vernede byggene på Strandveikaia.
- **Stengetid for Monkey Brew.** `/leve/cafe-og-restauranter/` oppgir utsalg
  torsdag og fredag, og `/hva-skjer/aktiviteter/` legger til at det varer til
  klokka 17. `knowledge.ts` har åpningstiden som uavklart.
- **Doraparken-koblingen.** `/leve/park-og-promenade/` sier at Elvepromenaden
  knytter seg til Doraparken. Dette er tatt inn i `site-knowledge.ts` via den
  femte Leve-siden `/leve/promenaden/`, som ikke er dekket i `knowledge.ts`.

## Åpne hull

1. Nettstedet oppgir aldri antall boliger eller leiligheter. Det nærmeste er
   ca. 102 000 m2 nytt areal på Transittkaia.
2. PDF-ene under Strategiske dokumenter er ikke lest. Bare sidens egne
   sammendrag er brukt.
3. Arrangementskalenderen er tidsavhengig. Bare det at kalenderen finnes er
   tatt inn, ikke enkeltarrangementene.
4. Ingen koordinater eller presis avgrensning oppgis for Doratorget,
   Doraparken, Transittparken, Kullkranparken, Bunkerparken eller sjøbadet.
   Ingen av dem har fått kartmarkør.
5. `/innspill/` har ingen brødtekst i den serverrendrede HTML-en. Et eventuelt
   skjema der er ikke lest.
6. Sidene ble lest som serverrendret HTML. Innhold som først settes inn av
   JavaScript i nettleseren, er ikke fanget opp. Dette gjelder trolig
   arrangementslistene, som lastes fra en ekstern kalender.

## Innhold som er lest, men bevisst ikke gjort til egne poster

For å holde pakken på 60 poster av høy kvalitet er noen detaljer lest, men ikke
gjort til egne poster, selv om siden de står på er innarbeidet:

- de to alternative utformingene av næringsbygget på Transittkaia, med areal på
  ca. 19 400 og ca. 21 000 m2, avhengig av hvor hovedsykkelveien legges;
- Båtsmannsallmenningen som gatetun med begrenset biltilkomst;
- at næringsbygget på Transittkaia er planlagt ferdig året etter de første
  boligene, og at utbyggingstakten avhenger av marked og rekkefølgekrav;
- Dora 1 Bowling og Biljard i Kobbes gate 6;
- fellesrom med verksted, selskapslokaler og gjesterom i boligprosjektene;
- forbeholdet om at illustrasjonen av Kullkranpiren fra 2020 viser muligheter
  og ikke vedtatte planer. Det tilsvarende forbeholdet for Bunkerkvartalet er
  beholdt, inne i posten om Fyringsbunkeren.

Alt dette står i kildene som er registrert i `sources`, og kan hentes inn igjen
uten ny innhenting.
