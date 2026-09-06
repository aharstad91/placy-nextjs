# FAQ-katalogen, sammenslått: 80 spørsmål etter to uavhengige forslag og én verifikasjonsrunde

**Dato:** 2026-09-06  
**Type:** Sammenslått katalog (research + forslag, ingen implementering)  
**Kilder:** [Claudes rapport](2026-09-06-faq-katalog-10-per-tema-rapport.md) · [Astras svar](2026-09-06-faq-katalog-astra-svar.md) · [prompten til Astra](2026-09-06-faq-katalog-astra-prompt.md) · verifikasjon kjørt som workflow 2026-09-06 (8 sammenslåings-agenter + 8 verifikatorer, 16 agenter, alle mot boardets faktiske data for Wesselsløkka)  
**Status:** Klar til beslutning. Neste steg er å fikse systemfeilene i § 5 før katalogen utvides.

---

## 0. Sammendrag

1. **80 spørsmål, 15 nye siden Claudes rapport.** 65 av Claudes id-er er beholdt, 7 av Astras nye er tatt inn (`tjenester-samme-sted`, `ferdig-ved-innflytting`, `sfo`, `dagligvare-sondag`, `tur-med-vogn`, `gruppetrening`, `frivilligsentral`), og verifikatorene bidro med 8 (`barnehage-alder`, `skoleskyss`, `pizza`, `spesialbutikk-mat`, `sykkelrute`, `bil-til-byen`, `spesialtrening`, `kirke`). 21 spørsmål ble snevret så teksten lover nøyaktig det kilden bærer — Astras hovedinnvending, og den holdt.
2. **Klassene etter verifikasjon:** se tabellen i § 4.9. Fem åpningstids-spørsmål er nedgradert fra S til S+ fordi åpningstider i dag kommer fra et manuelt månedsscript, ikke pipelinen.
3. **Verifikasjonen fant en produksjonsfeil som gjør alle dagens Wesselsløkka-svar feil:** lesestien henter `project_pois` uten range, PostgREST kapper på 1 000 rader, og Wesselsløkka har **1 615**. 615 POI-er mister reisetid, og «nærmeste spisested» blir Burger King på 9 minutter i stedet for VYDA på 4. Feilen treffer alle boards med over 1 000 POI-er. Den, ankerfeilen og tre andre må fikses før noen katalog-utvidelse (§ 5).
4. **Astra hadde rett på tre ting og feil på én.** Rett: kilde-mot-løfte, at Google fjernet FAQ rich results 7. mai 2026 (bekreftet mot Googles endringslogg — Claudes AI-siterings-avsnitt er tonet ned i § 1), og at personaene manglet aleneboeren, skiftarbeideren og den som vil komme i gang. Feil: å klassifisere navngitte deterministiske kilder som kuratert — «frekvens», «siste avgang», «marka» og «lading» er S+ med Entur, Naturbase og NOBIL, ikke K.

---

## 1. Rettelser til research-delen i Claudes rapport

- **AI-sitering (§ 1c i rapporten) tones ned.** Google la ut varsel 8. mai 2026 om at FAQ rich results ikke lenger vises fra 7. mai 2026, og fjernet dokumentasjonen 15. juni 2026. Tallene 25 % AI Overviews, 44 % av siteringer og 40–60 ord er bransjeanalyser, ikke etablerte årsakssammenhenger. 40–60 ord beholdes som redaksjonell ramme fordi det gir svar som leses på mobil, ikke som søkemotorregel.
- **Kildene beviser ikke at akkurat disse 80 er de mest stilte.** Asker-panelet, Nordvik 2026, FINN (Eiendomsundersøkelsen 2022) og visningssjekklistene sier hvilke *temaer* kjøpere veier. Prioriteringen inne i hvert tema er begrunnede hypoteser til `faq_opened` har målt dem.
- **NN/G-regelen står:** «do not make up questions that are not being asked» er identisk med «dikter aldri» — og `faq_opened` er nå i drift, så katalogen kan ryddes på data.
- **Påstanden «ingen konkurrent svarer i spørsmålsform»** er ikke systematisk kontrollert. Den gjelder FINN Nabolagsprofil, Marketer/HomeKey, Kvass og Fastout slik vi har sett dem, ikke mer.

---

## 2. Prinsippene som avgjorde uenighetene

1. **Kilden må svare på det spørsmålet lover.** Der Claude hadde et bredt spørsmål med en smal kilde, er spørsmålet snevret og id-en beholdt. «Er det rolig?» ble «Ligger boligen i støysone fra vei?». Aldri omklassifisert til K når kilden er navngitt og deterministisk.
2. **Tre klasser, ikke to.** S = data boardet har i dag. S+ = én navngitt ny kilde. K = skjønn. Astras KURATERT-merking ble S+ der kilden faktisk finnes.
3. **Begge persona-settene gjelder.** Plass 1–5 er det megleren får på hver visning; plass 6–10 dekker den som ellers faller ut (aleneboeren, skiftarbeideren, den delte omsorgen, den som vil begynne å trene, den som flytter alene).
4. **S slår K når behovet er sammenlignbart.** K kom inn bare der ingen S/S+ dekker behovet (`gruppetrening`, `samlingspunkt`, `voksenaktivitet`, `idrettslag`, `kulturskole`, `akebakke`) eller der prosjektet uansett vil skrive svaret (`ferdig-ved-innflytting`).
5. **Én id per svarform.** `naermest` er slått inn i `gangavstand`, `idrettsanlegg-barn` i `idrettsanlegg`, `stamsted` i `samlingspunkt`, `arena` i `kulturscene`, `kort-turrunde` i `turstier`, `kjeder` i `treningssenter`, `kaffe-for-jobb` i `kafe`/`bakeri`, `hva-skjer` i `voksenaktivitet`/`samlingspunkt`.
6. **Rader laget av hva dataene kan telle, ikke av et kjøperbehov, går ut.** `mest-av`, `gront-andel`, `vegetarisk-middag`.
7. **Modus-nøytrale spørsmål.** Transport-spørsmålene sa «buss»; kilden (Entur trip, stops.modes) er buss, tog, trikk, T-bane og bybane. På en Oslo-adresse hadde svaret motsagt spørsmålet. Nå: «avganger», «linjene», «til sentrum».

---

## 3. Personas, sammenslått

**Området (startsiden).** Den som skal forstå stedet på ti sekunder, og den som sammenligner hverdager. Har annonsen åpen på mobilen og kjenner ikke bydelen — eller kjenner den delvis og veier en etablert adresse mot et nybygg i første byggetrinn. Beslutning: er dette verdt en visning, og fungerer hverdagen fra dag én? Spør: hvordan kommer jeg til byen, hva ligger rundt meg, får jeg unna ærendene til fots, er det trafikkstøy, blir det bygget mer rett ved, hvem bor her. Plass 6–10 rommer den som ellers faller ut: aleneboeren som vil samle ærender på én tur, skiftarbeideren som trenger noe åpent etter 22, familien på en regnværssøndag, og nybyggkjøperen som må vite hva som er klart ved innflytting. Dårlig svar: tre nærmeste steder der ett er en hundepark, eller «åpent til midnatt» om et sted 40 minutter unna.

**Barn & oppvekst.** Forelderen som planlegger ti år frem, og forelderen med delt omsorg som må vite hvor mye av barnas liv som flytter med. Barn fra 0 til 14, eller barn som er planlagt. Spørsmålene bak spørsmålene: hvilken skole BLIR det (barne- og ungdomstrinn, ikke nærmeste), kan barnet gå selv, får vi barnehageplass, hva gjør barna etter skoletid. Plass 1–5 er det megleren får på hver visning; plass 6–10 dekker den som ellers faller ut: to-hjems-forelderen som trenger SFO og ungdomstrinnet like mye som barneskolen, og småbarnsforelderen som trenger helsestasjon og lekeplass. Svarene er sogning, gangtid og antall — aldri «trygt» eller «barnevennlig».

**Hverdagsliv.** Den som drar husholdningens logistikk, og den som vil klare seg selv — begge til fots. Logistikksjefen handler på vei hjem, henter pakker og følger barn til lege; aleneboeren på 68 har solgt eneboligen og må vite at butikk, apotek og legesenter ligger i gangavstand uten å be noen om hjelp. Skiftarbeideren trenger å vite hvor sent på hverdager og hvor på søndag hun får handlet mat. Felles beslutning: får jeg unna ærendene til fots, uten omvei og uten bil? Dårlig svar: nærmeste apotek på 17 minutter når senterets ligger på 8, eller «butikk i nærheten» uten klokkeslett.

**Mat & drikke.** Den som vil at nabolaget skal ha et eget liv — paret uten små barn, familien på fredag, og den som nettopp har flyttet til byen og bor alene. Beslutningen er den samme for alle tre: må vi til byen for alt? De lurer på om det er et sted å møtes over en kaffe, et bakeri lørdag morgen, takeaway eller levering på fredag, et sted å sitte ute i mai, og om matvanene (vegetarisk, barnemeny) kan videreføres uten å planlegge en helaften. Skiftarbeideren og morgenpendleren trenger kaffen før jobb og noe som er åpent på søndag. Godt svar navngir steder med målt gangtid — også dem inne på kjøpesenteret — og legger til sykkelringen når gangavstanden er tynn. Dårlig svar er «Ja — Burger King og Egon» som bevis på et matliv, eller Sabrura 40 minutter unna som søndagsåpent.

**Natur & friluftsliv.** Den som må ut, og den som må kunne komme ut. Løperen, hundeeieren og skigåeren vil vite hvor turen starter, hvor skiløypa og lysløypa går og hvor de kommer til sjøen — uten bil. Samtidig: 59-åringen med redusert gangkapasitet og forelderen med barnevogn trenger en konkret start, kort runde, kjent underlag og håndterbar stigning. Beslutningen for begge er om naturen kan brukes hjemmefra i hverdagen, ikke bare sees på kartet. Dårlig svar: «Brøset Hundepark, 3 minutter» som eneste grøntområde, eller «Estenstadmarka starter rett fra nabolaget» uten målt gangtid til en inngang.

**Transport.** Den som skal klare seg med én bil eller ingen. Det kan være pendleren med jobb i sentrum, på Gløshaugen, St. Olavs eller Sluppen, som lurer på dør-til-dør-tid og om bussen går ofte nok til at bil nummer to kan droppes. Det kan like gjerne være helsefagarbeideren med tidligvakt og sen avslutning, som må vite om bussen går klokka 06 og 23, ikke bare i rush. Og det er den som bor alene og vil komme hjem fra byen uten taxi, eller sykle når bussen ikke passer. Felles beslutning: fungerer kollektivtilbudet når jeg faktisk reiser, ikke bare på papiret? Standarden må derfor gi tall for både rush og kveld, og navngi reisemål kjøperen kjenner.

**Trening & aktivitet.** Den som vil fortsette — og den som vil begynne. Den første har trent tre ganger i uka i årevis, har medlemskap i en kjede, svømmer og spiller padel, og spør om rutinen overlever flyttingen: er kjeden min her, kan jeg trene før jobb, hvor er svømmehallen. Den andre er 47 og har ikke trent på år; han trenger noe i gangavstand med forståelige adgangsvilkår — en gruppetime, en treningspark uten medlemskap, et idrettslag som tar imot nybegynnere. Begge stiller megleren det samme første spørsmålet («er det treningssenter i nærheten?»), og barnefamilien stiller det neste («hvor trener barna?»). Plass 1–5 svarer på visningsspørsmålene (nærmeste senter, svømmehall, bane og hall, åpningstider, kjeder); plass 6–10 sørger for at den som skal komme i gang, og den som spiller padel eller går på skøyter, også får sitt.

**Opplevelser.** Den som flytter til bydelen uten nettverk og lurer på om det er liv her eller bare et soverom — nyinnflyttet til byen, eller 56 og alene etter et samlivsbrudd. Beslutningen er om hun finner noe å gå til som gjentar seg: bibliotek, kor, kurs, en scene, et sted folk møtes — også med lite fritidsbudsjett. Familien er med: kino, bowling og kulturskole for seksåringen og fjortenåringen i ukene de bor her, og en plan for regnværssøndagen (svares på Området). Det egentlige spørsmålet er «hvor kan jeg bli en deltaker, ikke bare en besøkende?», så gjentatt deltakelse og åpne møteplasser går foran severdigheter. Dårlig svar: temaet har null spørsmål i dag, og «Trondheim Kunstmuseum, 40 minutter» som første rad.

---

## 4. Katalogen — 80 spørsmål

Rekkefølgen er prioriteten. **Kilde:** S = standard i dag · S+ = standard med én navngitt ny kilde · K = kuratert. **Opprinnelse:** claude / astra / begge / ny (fra verifikasjonen). Eksempelsvarene er verifikatorens rettede versjon der den finnes; de bygger på boardets data slik de leses i dag — og fordi lesestien kapper poolen på 1 000 rader (§ 5), skal alle minuttall re-deriveres etter fiksen. [VERIFISER] markerer det som mangler eller strider.

### 4.1 Området (startsiden)

| # | id | Spørsmål | Kilde | Opprinnelse |
|---|---|---|---|---|
| 1 | `til-byen` | Hvordan kommer jeg meg til byen? | S | claude |
| 2 | `gangavstand` | Hva finnes innen ti minutters gange? | S | begge |
| 3 | `uten-bil` | Hvilke ærender kan jeg gjøre til fots? | S | begge |
| 4 | `rolig` | Ligger boligen i støysone fra vei? | S+ | begge |
| 5 | `blir-det-bygget` | Er det nye reguleringsplaner i nærheten? | S+ | begge |
| 6 | `tjenester-samme-sted` | Hvor kan jeg samle flere ærender på én tur? | S | astra |
| 7 | `hvem-bor-her` | Hvem bor i nabolaget? | S+ | claude |
| 8 | `ferdig-ved-innflytting` | Hva er klart ved innflytting? | K | astra |
| 9 | `apent-sent` | Er noe åpent sent på kvelden? | S+ | begge |
| 10 | `regnvaersdag` | Hva finnes innendørs i nærheten? | S | begge |

**1. `til-byen` — Hvordan kommer jeg meg til byen?** (S)  
*Hvorfor:* Claudes prioritet, beholdt på Området etter regel 5 (Astra ville slå den inn i Transports «til-sentrum»). Første spørsmål fra alle som ikke kjenner bydelen; kortform med lenke inn i Transport, fullformen bor der.  
*Kilde:* boardFacts.cityCentre (Entur trip precomputet ved provisjonering) + POI-pool bus med gangtid for holdeplassen + tema-lenke til transport. Bygger finnes (tilByen).  
*Wesselsløkka:* Til Trondheim S tar det 20 minutter med linje 12 og bytte til linje 10, eller 24 minutter direkte med linje 12. Bussen går fra Brøset Hageby, ett minutt fra boligen; Brøsetflata ligger 4 minutter unna. Se Transport for holdeplassene og linjene i nabolaget.

**2. `gangavstand` — Hva finnes innen ti minutters gange?** (S)  
*Hvorfor:* Enig (Astra 1, Claude 3) — og slått sammen med «naermest»: én sortert liste over gangtider gir både de nærmeste navnene og tallet, så to rader var samme bygger to ganger (regel 4). Gir stedet skala på ett blikk. Snevret etter verifikasjon: Spørsmålet er et kjøperbehov, men tallet «16 steder» er det pipelinen tilfeldigvis kan telle: 8 av de 16 er bussholdeplasser, én er hundeparken (personaens eget eksempel på dårlig svar), og 7 anker-medlemmer med gangtid ≤10 (Coop Mega, Boots, Rosenborg bakeri, Fresh Fitness, Feelgood, to trafikkskoler) er utelatt — verifisert mot poolen: 16 uten medlemmer, 23 med.  
*Kilde:* Alle POI-er med precomputet gangtid ≤10/≤5 min, MED anker-medlemmer og UTEN holdeplasser i tallet; fire nærmeste navngis. Absorberer «naermest». Bygger finnes, må justeres.  
*Wesselsløkka:* Innenfor ti minutter til fots ligger SUMART Dagligvare (3 minutter), Brøset Hundepark (3), Valentinlyst Senter (7) med Coop Mega, Boots Apotek, Rosenborg bakeri, Fresh Fitness og Feelgood, Bromstad barnehage (8), Burger King (9), bysykkelstativet på Valentinlyst (9) og Brøset barnehage (10). Nærmeste holdeplass, Brøset Hageby, ligger ett minutt unna; sju holdeplasser til ligger innenfor ti.

**3. `uten-bil` — Hvilke ærender kan jeg gjøre til fots?** (S)  
*Hvorfor:* Flyttet inn fra Hverdagsliv (regel 5, Astras forslag; Claude hadde den som nr. 2 der). Terskelspørsmålet på tvers av temaer: hvilke ærendtyper er dekket til fots — for logistikksjefen og for aleneboeren som vil klare seg selv. Hverdagsliv må slippe id-en. Snevret etter verifikasjon: «Klarer jeg» ber om en dom, og regelen sier ingen vurderinger; kilden leverer en kategoriliste.  
*Kilde:* Ærendkategorier (supermarket, pharmacy, bakery, gym, shopping, barnehage, bike, doctor) med precomputet gangtid ≤10 min som kjerne og ≤15 min som andre ring, inkl. anker-medlemmer. Bygger finnes (utenBil) men taper i dag apotek/bakeri/trening til ankeret.  
*Wesselsløkka:* Dagligvare, apotek, bakeri, treningssenter og kjøpesenter ligger innenfor ti minutter til fots: SUMART Dagligvare (3 minutter) og Valentinlyst Senter (7) med Coop Mega, Boots Apotek, Rosenborg bakeri og Fresh Fitness. Barnehage (Bromstad, 8 minutter) og bysykkel (Valentinlyst, 9) ligger også innenfor ti; Bunnpris Angelltrøa og Kiwi Strinda (14) innenfor femten.

**4. `rolig` — Ligger boligen i støysone fra vei?** (S+)  
*Hvorfor:* Snevret (Astras innvending tatt inn): støykartet bærer vegtrafikkstøy, ikke «ro». Klassifisert S+ og ikke K (regel 1) fordi kilden er navngitt og deterministisk. Støy er øverst på Krogsveens visningsliste og Nordvik 2026 — megleren får spørsmålet på hver visning. Snevret etter verifikasjon: «Utsatt for trafikkstøy» lover en påstand om boligen; kildene dekker bare bestemte veier.  
*Kilde:* Kommunens strategiske støykart (forurensningsforskriften kap. 5, dekker alle veier i Trondheim) eller Statens vegvesens støyvarselkart (riks/fylkesvei). Rad vises bare når kartet dekker veiklassen — «utenfor sone» sies aldri uten dekning.  
*Wesselsløkka:* Boligen ligger [VERIFISER: i gul / i rød] støysone fra vei ifølge [VERIFISER: Statens vegvesens støyvarselkart / Trondheim kommunes strategiske støykart, årstall]. Kartet dekker [VERIFISER: riks- og fylkesveier / veier med over 8 200 kjøretøy i døgnet]; nærmeste kartlagte vei er [VERIFISER: Omkjøringsvegen (E6), avstand]. Kartet gjelder vegtrafikk; bane, fly og byggeaktivitet er ikke med.

**5. `blir-det-bygget` — Er det nye reguleringsplaner i nærheten?** (S+)  
*Hvorfor:* Enig (Claude 9, Astra 6), snevret: planinnsyn dokumenterer vedtatte og pågående planer, ikke at noe blir bygget — så spørsmålet sier «planlagt». S+ og ikke K (regel 1). Klassisk visningsspørsmål («hva skjer med tomta ved siden av»), og på Brøset er det selve historien. Snevret etter verifikasjon: «Planlagt utbygging» lover at noe skal bygges; registeret (kommunalt planregister / Geonorge plandata) holder reguleringsplaner.  
*Kilde:* Kommunalt planregister / Geonorge plandata: reguleringsplaner innen 500 m vedtatt siste fem år eller under behandling, med navn, formål og status. Eldre planer filtreres bort.  
*Wesselsløkka:* Wesselsløkka ligger i områdeplanen for Brøset [VERIFISER planid og vedtaksår], som regulerer hele Brøset til boliger, grøntområder og skole. Innen 500 meter er [VERIFISER antall] reguleringsplaner vedtatt de siste fem årene: [VERIFISER navn, formål, år]. [VERIFISER antall] planforslag ligger til behandling hos Trondheim kommune: [VERIFISER navn]. En vedtatt plan er ikke det samme som at bygging er i gang.

**6. `tjenester-samme-sted` — Hvor kan jeg samle flere ærender på én tur?** (S)  
*Hvorfor:* Ny fra Astra, tatt inn etter regel 5. Dekker aleneboeren og logistikksjefen som planlegger én tur, ikke fire. Er S i dag: anker-registeret (kjøpesenter-familien med parent_poi_id) er nøyaktig denne dataen, og svaret er tverrgående (dagligvare, apotek, bakeri, trening).  
*Kilde:* Anker-registeret: POI-er med ≥4 medlemmer via parent_poi_id (kjøpesenter-familien), precomputet gangtid til ankeret, medlemmer gruppert per kategori. Nærmeste anker først, neste med sykkeltid. Ingen bygger i dag, men dataen ligger i poolen (parent=).  
*Wesselsløkka:* På Valentinlyst Senter, 7 minutter til fots, ligger Coop Mega, Boots Apotek, Rosenborg bakeri, Fresh Fitness og Feelgood samlet. Neste samlingspunkt er Moholtsenteret, 22 minutter til fots eller 9 med sykkel, med MENY, Apotek 1 og Sabi Sushi [VERIFISER at Moholt Storsenter, 19 minutter, ikke er registrert som anker]. Sirkus Shopping, 11 minutter med sykkel, har Coop Mega, Vitusapotek og Rosenborg bakeri.

**7. `hvem-bor-her` — Hvem bor i nabolaget?** (S+)  
*Hvorfor:* Claudes prioritet, beholdt på Området etter regel 5 (Astra ville ha den i reserve fordi kretsen ikke beskriver nybyggets kjøpere). Det uuttalte spørsmålet (OsloMet); FINN svarer med SSB-tall, vi gjør det ikke. Astras innvending møtes med en fast setning om at tallene gjelder dagens beboere i kretsen, og årstall vises alltid.  
*Kilde:* SSB statistikkbanken: befolkning etter alder per grunnkrets og husholdningstype per grunnkrets; grunnkrets fra boligkoordinat via SSB/Kartverkets grunnkretspolygon → boardFacts.population {krets, år, total, andel <18, andel ≥67, andel par med barn}. Regel: årstallet vises alltid sammen med tallet. Ingen bygger i dag.  
*Wesselsløkka:* I grunnkretsen [VERIFISER navn] bodde det [VERIFISER] personer per 1. januar [VERIFISER årstall]; [VERIFISER] prosent var 15 år eller yngre og [VERIFISER] prosent 67 år eller eldre. [VERIFISER] prosent av husholdningene var par med barn (SSB, [VERIFISER årstall og at feltet finnes per grunnkrets]). Tallene beskriver dagens beboere i grunnkretsen rundt boligen, ikke de som flytter inn i Wesselsløkka.

**8. `ferdig-ved-innflytting` — Hva er klart ved innflytting?** (K)  
*Hvorfor:* Ny fra Astra, tatt inn etter regel 5 og regel 3 (K som prosjektet uansett vil skrive). Astras Området-persona — den som sammenligner hverdager — trenger skillet mellom det som finnes, det som er planlagt og det som er klart ved innflytting. Vises bare der prosjektet har skrevet svaret.  
*Kilde:* Prosjektets kuraterte svar i reportConfig.globalFaq på denne id-en: datert utbygger-/operatørbekreftelse per byggetrinn. Ingen bygger; på bruktboliger rendres raden ikke. Det eksisterende tilbudet rundt boligen kan standarden legge ved fra poolen.  
*Wesselsløkka:* Ved innflytting [VERIFISER: første halvår 2027 ifølge nettsiden, 2028 ifølge kartet] er [VERIFISER: gangveier, uteområder og fellesfunksjoner i byggetrinn 1] ferdige. Det som finnes rundt boligen i dag, er uavhengig av utbyggingen: SUMART Dagligvare (3 minutter), Valentinlyst Senter (7) og holdeplassen Brøset Hageby (ett minutt). Ny skole på Brøset og senere byggetrinn kommer etter innflytting [VERIFISER dato].

**9. `apent-sent` — Er noe åpent sent på kvelden?** (S+)  
*Hvorfor:* Enig (Claude 6, Astra 9). Dekker skiftarbeideren og kveldsfriksjonen på tvers av temaer (dagligvare, trening, servering). Astras krav om radius og uttrykkelig terskel går inn i byggeren, ikke i spørsmålet — dagens svar nevner steder 35–45 minutter unna.  
*Kilde:* Cachede åpningstider (i dag manuelt månedsscript `refresh-opening-hours.ts` — må inn i pipelinen) + radius 15 min + kategorifilter; terskel 21:00 (`AREA_LATE_MIN` i koden). Bygger finnes.  
*Wesselsløkka:* [Ingen rad på Wesselsløkka i dag: ingen sted innenfor 15 minutter til fots har cachede åpningstider.] Når Valentinlyst-medlemmene er cachet: «Fresh Fitness Valentinlyst holder åpent til midnatt på hverdager, 6 minutter til fots på Valentinlyst Senter. Coop Mega i samme senter stenger 22, 8 minutter unna. Tidene gjelder mandag til fredag.» [VERIFISER begge mot cache, ikke nettside].

**10. `regnvaersdag` — Hva finnes innendørs i nærheten?** (S)  
*Hvorfor:* Flyttet inn fra Opplevelser (regel 5, Astras forslag; Claude hadde den som nr. 2 der). Familiens søndag samler innendørs tilbud på tvers av Opplevelser, Trening og Barn — ingen enkeltkategori kan svare. Opplevelser beholder «bibliotek» og «kino» som enkeltspørsmål. Snevret etter verifikasjon: «Hva gjør vi» lover steder familien kan gå rett inn i; kilden kan ikke skille drop-in fra klubb/booking.  
*Kilde:* Innendørs-kategorier (library, swimming, museum, cinema, gym, idrettshaller via idrettsanlegg-ankeret) med precomputet gangtid ≤15 min eller sykkeltid ≤15 min; nærmeste per kategori navngis. Ingen bygger i dag.  
*Wesselsløkka:* Trondheim folkebibliotek Moholt [VERIFISER norsk visningsnavn] ligger 21 minutter til fots eller 10 med sykkel. Svømmehallen i Charlottenlundhallen [VERIFISER publikumsåpne tider] er 13 minutter med sykkel, og Trondheim Kunstmuseum Gråmølna 15. Leangen Idrettsanlegg, 12 minutter til fots, har islek [VERIFISER publikumstider] i tillegg til hallene for organisert idrett.

*Reserve (ute av topp ti):* `naermest` — Slått sammen med «gangavstand»: én sortert gangtidsliste gir både de nærmeste navnene og tallet, så to rader var samme bygger to ganger (regel 4). Sammenslåingen ga 11 kandidater til 10 plasser, og ingen persona faller ut uten denne. Bygger-koden gjenbrukes i gangavstand. · `mest-av` — Reserve per orkestrator (regel 5). Astras innvending står: temaenes POI-antall måler kategoridefinisjon og datadekning, ikke nabolagets karakter. · `sykkel-10` — Reserve per orkestrator (regel 5). Transports «sykkel-til-byen» gir ett navngitt mål; sykkeltider er precomputet, så byggeren er billig å hente tilbake om kjøpere etterspør radiusen. · `til-arbeidsplassene` — Flyttet til Transport (regel 5), ikke reserve — men skal ikke deklareres på Området. · `trinnfri-hverdag` — Reserve. Navngitt kilde finnes (Google Places accessibilityOptions.wheelchairAccessibleEntrance, ev. OSM wheelchair=*), men den bærer bare inngangen, ikke ruten spørsmålet lover — og det er ingen ledig plass. Åpner en plass seg: snevre til «Har nærbutikkene trinnfri inngang?» som S+ på samme id. · `flom-skred` — Kandidat med sterk kilde: NVEs aktsomhetskart (flom, skred, kvikkleire) — søsterspørsmålet til støy. Vurder å bytte inn mot «regnvaersdag» etter faq_opened. · `bredband` — Kandidat: «Er det fiber i gata?» — Nkoms dekningskart. Ingen tema eier det, så Området. · `bebyggelse` — Kandidat: «blokker eller småhus?» — SSB/Matrikkel bygningstype innen 300 m.

### 4.2 Barn & oppvekst

| # | id | Spørsmål | Kilde | Opprinnelse |
|---|---|---|---|---|
| 1 | `krets` | Hvilken skolekrets sogner boligen til? | S | begge |
| 2 | `skolevei` | Hvor lang er skoleveien til fots? | S | begge |
| 3 | `barnehage-dekning` | Hvor mange barnehager ligger i gangavstand? | S | begge |
| 4 | `barnehage-alder` | Tar barnehagene i nærheten imot ettåringer? | S | ny |
| 5 | `lekeplass` | Hvor er nærmeste lekeplass? | S | begge |
| 6 | `sfo` | Hvilket SFO-tilbud hører til barneskolen? | S+ | astra |
| 7 | `oppvekst-fritid` | Hva kan barna gjøre etter skoletid? | S | begge |
| 8 | `vgs-naerhet` | Hvilke videregående skoler kan jeg nå med buss? | S | begge |
| 9 | `skoleskyss` | Har barna rett på gratis skoleskyss? | S+ | ny |
| 10 | `helsestasjon` | Hvor er nærmeste helsestasjon? | S+ | begge |

**1. `krets` — Hvilken skolekrets sogner boligen til?** (S)  
*Hvorfor:* Enig (nr. 1 hos begge). Astras nye `ungdomsskole-krets` er slått inn her etter regel 4: byggeren `krets` skriver alt begge trinn i samme svar når schoolZone.ungdomsskole er fylt. Behovet: sogning, ikke nærmeste skole, er det megleren får på hver visning.  
*Kilde:* Kommunens kretspolygoner (barne- og ungdomsskole) + NSR (trinn, elevtall med årstall, eierform). Ett svar, to setninger — `schoolZone.ungdomsskole` er tom på Wesselsløkka (datafeil).  
*Wesselsløkka:* Boligen sogner til Eberg skole, med 1.–7. trinn og 382 elever [VERIFISER: årstall for elevtallet fra NSR]. Ungdomstrinnet hører til Blussuvoll skole [VERIFISER: schoolZone.ungdomsskole er tom på boardet; Blussuvoll er kommunens oppgitte mottaksskole, ikke polygon-bekreftet]. Kretsen følger adressen, ikke nærmeste skole. Gangtidene til begge skolene står under skoleveien.

**2. `skolevei` — Hvor lang er skoleveien til fots?** (S)  
*Hvorfor:* Enig (nr. 2 hos begge). Ett svar dekker begge kretsskolene (regel 4). Astras innvending — gangtid avgjør ikke om barnet kan gå alene — får egen rad (`skolevei-fortau`, plass 9) i stedet for å utvanne denne. Behovet: logistikken rundt levering og henting.  
*Kilde:* Precomputet gangtid (project_pois.travel_times.walk) til skolene i schoolZone. Krever at reisetids-precompute dekker registerimporterte POI-er — Eberg skole (nsr-979195052) har travelTime null i dag (Claude § 5 feil 4).  
*Wesselsløkka:* Til Eberg skole er det [VERIFISER: gangtid — Eberg skole har ingen precomputet reisetid på boardet; nettsiden sier «rundt ti minutter», som ikke er målt]. Til Blussuvoll skole, der ungdomstrinnet hører til, er det 15 minutter til fots og 6 med sykkel. Tidene er beregnet gangrute fra boligen til skolens registrerte adresse, ikke luftlinje.

**3. `barnehage-dekning` — Hvor mange barnehager ligger i gangavstand?** (S)  
*Hvorfor:* Enig, Astras prioritet (3, opp fra Claudes 4). Antall alternativer innen samme gangtid er det eneste standarden ærlig kan si om barnehage. Behovet: har vi noe å velge i.  
*Kilde:* NBR-barnehager i poolen (64) + precomputet gangtid; telling ≤10 og ≤15 min. Bygger `barnehageDekning` finnes og svarer riktig i dag. Registeret heter NBR (Astras rettelse), ikke NSR.  
*Wesselsløkka:* 2 barnehager ligger innenfor ti minutters gange: Bromstad barnehage på 8 minutter og Brøset barnehage på 10. Innenfor et kvarter er det 10, blant dem Hagebyen private barnehage (11 minutter), Leangen kulturbarnehage (13) og Angelltrøa barnehage (14). Tallet gjelder barnehager i NBR med målt gangtid fra boligen, ikke ledige plasser.

**4. `barnehage-alder` — Tar barnehagene i nærheten imot ettåringer?** (S)  
*Hvorfor:* Ny (verifikatorens forslag, erstatter Claudes/Astras «barnehage-plass» som viste seg å være nasjonal lov + kommunenavn, identisk på alle adresser). Småbarnsforelderen spør ikke bare hvor mange, men om de tar små barn.  
*Kilde:* NBR-feltet AlderstrinnFra/AlderstrinnTil (finnes alt i barnehagemalen, id `alder`) + precomputet gangtid ≤15 min.  
*Wesselsløkka:* Bromstad barnehage (8 minutter) og Brøset barnehage (10 minutter) tar imot barn fra [VERIFISER: NBR AlderstrinnFra] år. Av de ti barnehagene innenfor et kvarter tar [VERIFISER] imot barn under to år. Tallet er registerets aldersgrense, ikke barnehagens venteliste.

**5. `lekeplass` — Hvor er nærmeste lekeplass?** (S)  
*Hvorfor:* Enig; løftet til 5 (begge hadde 6) fordi de fem første skal være det megleren får på hver visning, og lekeplass er småbarnsforelderens første spørsmål. Behovet: et sted som kan brukes i dag, ikke en illustrasjon.  
*Kilde:* POI-pool `lekeplass` (94) + precomputet gangtid; 4 innen 15 min. Bygger `lekeplass` finnes. Prosjektets egne lekeplasser er ikke bygd og ligger ikke i poolen — det svaret er prosjektets overstyring på samme id.  
*Wesselsløkka:* Ole Hogstads veg lek er nærmeste lekeplass, 11 minutter til fots og 4 med sykkel. Eberg Sykkelpark ligger 13 minutter unna og Strinda Hageby lek 14. Innenfor et kvarter til fots er det 4 registrerte lekeplasser. Gangtidene er beregnet fra boligen til lekeplassens registrerte punkt [VERIFISER: «Moholt grusbane» ligger som lekeplass på 11 minutter — kategorifeil?].

**6. `sfo` — Hvilket SFO-tilbud hører til barneskolen?** (S+)  
*Hvorfor:* Ny fra Astra. Id-en `sfo` finnes alt i skolemalen (category-specs.ts:193) som «Finnes det SFO?», kuratert-eneste — teksten erstattes og klassen løftes til S+ fordi Udir GSI er en navngitt deterministisk kilde. Behovet: to-hjems-forelderen og alle som jobber fulltid planlegger arbeidsdagen rundt SFO.  
*Kilde:* Ny navngitt kilde: Udir GSI (Grunnskolens Informasjonssystem) — SFO per skole: antall barn per trinn og åpningstid per uke, med årstall. Kretsskolen fra schoolZone. Nasjonal konstant: 12 gratis timer per uke for 1.–3. trinn.  
*Wesselsløkka:* Eberg skole har SFO for 1.–4. trinn [VERIFISER: Udir GSI — antall barn i SFO og åpningstid per uke, med årstall]. Tolv timer i uka er gratis for 1.–3. trinn gjennom den nasjonale ordningen; pris og åpningstid utover det bestemmes av Trondheim kommune. SFO følger kretsskolen, så tilbudet gjelder barn som sogner til Eberg.

**7. `oppvekst-fritid` — Hva kan barna gjøre etter skoletid?** (S)  
*Hvorfor:* Astras kortere tekst og prioritet (7; Claude 8). Får `idrettsanlegg-barn` sitt Barn-innhold ved at byggeren blir sammensatt (idrett + fritidsklubb + bibliotek + svømmehall), mens anleggslista flytter til Trening `idrettsanlegg` (regel 5). Behovet: barn og ungdom trenger steder utenom skole, ikke bare organisert idrett.  
*Kilde:* Sammensatt bygger over poolen: `idrett` (inkl. anker-medlemmer under Leangen idrettspark google-ChIJHbzUMFEwbUYRtcKkq-oGhM4 og osm-way-5081810), `fritidsklubb`, `library`, `swimming`; gangtid ≤15 min eller sykkel ≤10. Dagens bygger `oppvekstFritid` ser bare fritidsklubb og krever gangavstand — derfor ingen rad på Wesselsløkka i dag.  
*Wesselsløkka:* Nærmest ligger idretten: Leangen bydelshallen 12 minutter til fots, Bingen 12 og Freidigbanen med kunstgress 13, alle i Leangen idrettspark. Urban fritidsklubb ligger 21 minutter til fots eller 8 med sykkel, og Trondheim Public Library Moholt 21 til fots eller 10 med sykkel. Innenfor et kvarter til fots ligger 11 idrettsanlegg.

**8. `vgs-naerhet` — Hvilke videregående skoler kan jeg nå med buss?** (S)  
*Hvorfor:* Astras prioritet (8, ned fra Claudes 3) og tekst: inntaket er karakterbasert, spørsmålet gjelder undergruppen med tenåring, og byggeren rangerer på reisetid — ikke nærhet — så Astras formulering er den ærlige. Behovet: 14-åringen i delt-omsorg-personaen står foran valget om to år.  
*Kilde:* NSR ErVideregaaendeSkole + Entur journey-planner (boardFacts) + gangtid/sykkeltid der målt. Bygger `vgsNaerhet` finnes og svarer riktig i dag. Strinda vgs har travelTime null (registerimport).  
*Wesselsløkka:* Cissi Klein videregående er raskest å nå: 13 minutter med linje 12, eller 24 minutter til fots og 9 med sykkel. Strinda videregående tar 16 minutter [VERIFISER: reisemåte — boardet oppgir ingen linje]. Inntaket til videregående er karakterbasert og fylkeskommunalt og følger ikke adressen, så svaret gjelder reisetid, ikke sogning.

**9. `skoleskyss` — Har barna rett på gratis skoleskyss?** (S+)  
*Hvorfor:* Ny (verifikatorens forslag, erstatter «skolevei-fortau» som falt på ufullstendig NVDB-registrering). Det ene barnespørsmålet som rammer ruralt hardere enn urbant — og standarden skal stå på 108 000 boliger.  
*Kilde:* Opplæringsloven § 7-1 (2 km for 1. trinn, 4 km fra 2. trinn, målt langs gangvei) + gangrute-avstand i meter til kretsskolen (Entur/Mapbox walkMeters). Bare positiv form: «retten gjelder fra …», aldri «har ikke rett».  
*Wesselsløkka:* Retten til gratis skoleskyss gjelder fra to kilometer for 1. trinn og fire kilometer fra 2. trinn, målt langs gangveien. Til Eberg skole er skoleveien [VERIFISER: meter langs gangrute], til Blussuvoll skole [VERIFISER]. Trafikkfarlig vei kan gi rett uavhengig av avstand og vurderes av kommunen.

**10. `helsestasjon` — Hvor er nærmeste helsestasjon?** (S+)  
*Hvorfor:* Enig; Claudes klasse (S+) fordi Falkenborg helsestasjon bare tilfeldigvis ligger i poolen under `doctor` — en standard for 108 000 boliger trenger egen kategori. Prioritet 10 (Astra 10, Claude 9). Behovet: småbarnsforeldre spør, og ingen konkurrent svarer.  
*Kilde:* Ny kategori `helsestasjon` via Google Places textSearch «helsestasjon» innen bbox (evt. NHN Adresseregisteret som register). I dag: Falkenborg helsestasjon i poolen under `doctor`, 25 min gange / 10 sykkel — eksemplet kan skrives fra boardets data, men byggeren må skille på navn eller kategori.  
*Wesselsløkka:* Falkenborg helsestasjon er nærmeste helsestasjon, 25 minutter til fots eller 10 med sykkel. Helsestasjonen følger barn fra 0 til 5 år og tar imot uten henvisning; hvilken helsestasjon familien hører til, bestemmer Trondheim kommune etter adresse [VERIFISER: kommunens helsestasjonsinndeling]. Fra skolestart overtar skolehelsetjenesten på kretsskolen.

*Reserve (ute av topp ti):* `barnefamilier` — Orkestratorens regel 5: dekkes av `hvem-bor-her` på Området (S+ SSB grunnkrets, årstall alltid vist). Første erstatter for plass 9 hvis `skolevei-fortau` avvises. · `ungdomsskole-krets` — Astras nye id, slått inn i `krets` etter regel 4 — byggeren skriver alt begge trinn. Tom ungdomsskole på Wesselsløkka er en datafeil i zoned-school-selection, ikke et katalogbehov. · `idrettsanlegg-barn` — Flyttet til Trening `idrettsanlegg` (regel 5). Barn beholder idretten via den sammensatte `oppvekst-fritid`-byggeren. · `profil` — Skolemalens eksisterende id («privatskole/steiner/montessori»). Kan bli S via NSR ErPrivatskole («Finnes det privatskole i nærheten?») hvis faq_opened viser etterspørsel; ikke et visningsspørsmål i dag. · `barnehage-plass` — Tatt ut etter verifikasjon — se begrunnelse i reserve-notatet. · `skolevei-fortau` — Tatt ut etter verifikasjon — se begrunnelse i reserve-notatet.

### 4.3 Hverdagsliv

| # | id | Spørsmål | Kilde | Opprinnelse |
|---|---|---|---|---|
| 1 | `hverdagshandel` | Hvor gjør jeg hverdagshandelen? | S | begge |
| 2 | `apotek` | Hvor er nærmeste apotek? | S | begge |
| 3 | `kjopesenter` | Hvor er nærmeste kjøpesenter? | S | begge |
| 4 | `legesenter` | Hvor er nærmeste legesenter? | S | begge |
| 5 | `pakker-post` | Hvor er nærmeste Post i butikk? | S+ | begge |
| 6 | `dagligvare-lengst-apent` | Hvor sent kan jeg handle mat på hverdager? | S+ | begge |
| 7 | `dagligvare-sondag` | Hvor kan jeg handle dagligvarer på søndag? | S+ | astra |
| 8 | `tannlege` | Finnes det tannlege i nærheten? | S | begge |
| 9 | `vinmonopol` | Hvor er nærmeste Vinmonopol? | S+ | begge |
| 10 | `legevakt-sykehus` | Hvor er nærmeste legevakt? | S+ | claude |

**1. `hverdagshandel` — Hvor gjør jeg hverdagshandelen?** (S)  
*Hvorfor:* Enig (begge nr. 1). Dagligvare er det ærendet som gjentas oftest og som megleren får spørsmål om på hver visning.  
*Kilde:* POI-pool supermarket + convenience med precomputet gangtid (project_pois.travel_times.walk). Byggeren finnes (`hverdagshandel` i faq-generator.ts). Krav: medlemmer av kjøpesenter-anker (parent_poi_id) må inn i lista — i dag fjernes Coop Mega før byggeren ser den.  
*Wesselsløkka:* SUMART Dagligvare er nærmest, 3 minutter til fots. Coop Mega på Valentinlyst Senter ligger 8 minutter unna, med Bunnpris Angelltrøa og Kiwi Strinda på 14. Til sammen ligger 4 dagligvarebutikker innenfor et kvarter til fots, og med sykkel er Coop Mega 4 minutter unna.

**2. `apotek` — Hvor er nærmeste apotek?** (S)  
*Hvorfor:* Enig (Astra 2; Claudes 3 ble 2 da uten-bil gikk til Området). Kort vei til medisiner spørres om av småbarnsforeldre og eldre, og apoteket ligger nesten alltid i lokalsenteret.  
*Kilde:* POI-pool pharmacy + precomputet gangtid. Eksisterende id og bygger (`apotek`). Krav: ankermedlemmer inn — Boots Apotek (parent=Valentinlyst Senter) tapes i dag.  
*Wesselsløkka:* Boots Apotek på Valentinlyst Senter er nærmeste apotek, 8 minutter til fots eller 4 med sykkel. Apotek 1 Strindheim er alternativet, 17 minutter til fots. Apotek 1 Moholt ligger 22 minutter unna, 8 med sykkel — med sykkel er alle tre innenfor 10 minutter.

**3. `kjopesenter` — Hvor er nærmeste kjøpesenter?** (S)  
*Hvorfor:* Astras prioritet (3, Claude hadde 6). «Hvor er nærmeste senter?» er spørsmålet som samler flere ærender i ett svar, og for aleneboeren er senteret selve hverdagen.  
*Kilde:* POI-pool shopping + precomputet gangtid, pluss medlemslista fra parent_poi_id (kjøpesenter-ankeret, lib/board/anchor-families.ts). Eksisterende id og bygger (`kjopesenter`); medlemsoppramsingen er ny.  
*Wesselsløkka:* Valentinlyst Senter er nærmeste kjøpesenter, 7 minutter til fots og 4 med sykkel. På senteret ligger blant annet Coop Mega, Boots Apotek, Rosenborg bakeri, Fresh Fitness og Feelgood [UTVALGSREGEL: ærendkategorier, maks fem]. Neste kjøpesenter er Moholt Storsenter, 19 minutter til fots eller 7 med sykkel, deretter Moholtsenteret på 22 minutter.

**4. `legesenter` — Hvor er nærmeste legesenter?** (S)  
*Hvorfor:* Claudes prioritet (4; Astra 5). Barn blir syke, og aleneboeren vil vite hvor legen er — men svaret er plassering, ikke ledig fastlegeplass.  
*Kilde:* POI-pool `doctor` (filtrert til legesenter/fastlege — kategorien blander spesialister) + gangtid. Recall-flagg: Valentinlyst Legesenter finnes på senteret men mangler i poolen. Bedre kilde på sikt: Helsenorges fastlegeliste.  
*Wesselsløkka:* [VERIFISER: Valentinlyst Legesenter, Anders Estenstads veg 18] er nærmeste legesenter, [VERIFISER: gangtid, trolig ca. 8] minutter til fots. Persaunet legesenter ligger 15 minutter unna til fots eller 7 med sykkel, og Leangen legesenter 28 minutter til fots og 12 med sykkel. Svaret viser hvor legesentrene ligger; ledig fastlegeplass må sjekkes på helsenorge.no.

**5. `pakker-post` — Hvor er nærmeste Post i butikk?** (S+)  
*Hvorfor:* Astras prioritet, dempet ett hakk (Astra 4, Claude 7). Pakkehenting er et ukentlig ærend for nesten alle, men spørres sjeldnere om på selve visningen enn butikk, apotek, senter og lege. Snevret etter verifikasjon: «pakker og post» lover alle transportører; Bring Pickup Point API dekker bare Posten/Bring-nettet (Post i butikk, Posten pakkebokser).  
*Kilde:* Bring Pickup Point API (Post i butikk + pakkebokser) + gangtid. Dekker ikke PostNord/Helthjem — derfor snevret til «Post i butikk».  
*Wesselsløkka:* Nærmeste Post i butikk er [VERIFISER: Coop Mega Valentinlyst, fra Bring Pickup Point API], 8 minutter til fots eller 4 med sykkel. [VERIFISER: neste hentested] ligger [VERIFISER: gangtid] unna. Pakker fra andre transportører har egne hentesteder; svaret viser Postens hentesteder som ligger i gangavstand fra boligen.

**6. `dagligvare-lengst-apent` — Hvor sent kan jeg handle mat på hverdager?** (S+)  
*Hvorfor:* Astras prioritet og formulering (Astra 6, Claude 8), snevret til hverdager. Skiftarbeideren og den som trener etter jobb trenger et klokkeslett, ikke et butikknavn. Omklassifisert etter verifikasjon: Klassen S («data på boardet i dag») holder ikke: åpningstider skrives ikke av pipelinen (null treff på opening_hours i lib/pipeline utover dedupe-vekting), men av scripts/refresh-opening-hours.  
*Kilde:* Cachede åpningstider (må inn i pipelinen — i dag manuelt script) + `supermarket`/`convenience` ≤15 min.  
*Wesselsløkka:* [VERIFISER: butikk med lengst hverdagsåpent] holder åpent til [VERIFISER: klokkeslett] mandag til fredag og ligger [VERIFISER: gangtid] minutter til fots fra boligen. [VERIFISER: neste butikk] stenger [VERIFISER: klokkeslett], [VERIFISER: gangtid] minutter unna. Tidene gjelder når alle fem hverdagene har samme åpningstid; helligdager og avvik sjekkes hos butikken.

**7. `dagligvare-sondag` — Hvor kan jeg handle dagligvarer på søndag?** (S+)  
*Hvorfor:* Ny fra Astra. Søndagshandel er en annen beslutning enn søndagsåpne restauranter (`sondagsapent` i Mat & drikke), og dekker skiftarbeideren og aleneboeren som ellers faller ut. Omklassifisert etter verifikasjon: Samme kildefeil som rad 6: søndagslinja finnes bare der refresh-opening-hours.  
*Kilde:* Søndagslinja i cachede åpningstider (må inn i pipelinen) + `supermarket`/`convenience` ≤15 min. Ikke duplikat av `sondagsapent` (som er servering).  
*Wesselsløkka:* På søndag holder [VERIFISER: butikk] åpent [VERIFISER: fra–til], [VERIFISER: gangtid] minutter til fots fra boligen. [VERIFISER: neste søndagsåpne butikk] ligger [VERIFISER: gangtid] minutter unna og har åpent [VERIFISER: fra–til]. Tidene gjelder ordinære søndager; på helligdager sjekkes butikken.

**8. `tannlege` — Finnes det tannlege i nærheten?** (S)  
*Hvorfor:* Astras prioritet (8; Claude 5). Kontinuitet i helsetjenester betyr noe for den som flytter, men tannlegen besøkes sjeldnere enn butikk, pakkehenting og matbutikkens stengetid.  
*Kilde:* POI-pool dentist + precomputet gangtid. Eksisterende id og bygger (`tannlege`). Null treff = ingen rad og gap-rapport, aldri «finnes ikke».  
*Wesselsløkka:* Nærmeste tannlege er [VERIFISER: klinikk], [VERIFISER: gangtid] til fots. [VERIFISER: neste klinikk] ligger [VERIFISER: gangtid] unna, og [VERIFISER: antall] tannleger ligger innenfor et kvarter til fots. Dette er de registrerte klinikkene på kartet; om en klinikk tar imot nye pasienter, bekreftes hos klinikken.

**9. `vinmonopol` — Hvor er nærmeste Vinmonopol?** (S+)  
*Hvorfor:* Enig (begge 9). Et konkret norsk ærend som stilles med jevne mellomrom; presist sted slår en generell butikkliste. Omklassifisert etter verifikasjon: Google `liquor_store` + navnegate er feil kilde når Vinmonopolet selv publiserer et åpent butikk-API (apis.  
*Kilde:* Vinmonopolets åpne butikk-API (alle utsalg, koordinater, åpningstider) — komplett nasjonalt register, bedre enn Google `liquor_store` + navnegate.  
*Wesselsløkka:* Vinmonopolet Valentinlyst er nærmeste utsalg, [VERIFISER: gangtid fra butikk-API-koordinat, trolig ca. 8] minutter til fots eller 4 med sykkel. Polet holder åpent mandag til fredag 10–18 og lørdag 10–16 [VERIFISER mot butikk-API]. Neste utsalg er [VERIFISER: navn og gangtid]. Søndag er alle utsalg stengt.

**10. `legevakt-sykehus` — Hvor er nærmeste legevakt?** (S+)  
*Hvorfor:* Snevret (Claudes id, Astras innvending). Trygghetsspørsmålet for aleneboeren og småbarnsforelderen er legevakten — hvor drar jeg når fastlegen er stengt — ikke sykehuset, som nås via 113. Vant plass 10 over Astras `sykkelverksted` fordi behovet gjelder alle 108 000 bruktboliger.  
*Kilde:* helsenorge.no «Finn legevakt» / kommunens legevakt-oppføring (én eller få per kommune, deterministisk fra kommunepolygonet) som build-time-oppslag → POI → precomputet reisetid bil/buss. Ikke Google `hospital`, som blander private klinikker og ikke bærer «legevakt».  
*Wesselsløkka:* Nærmeste legevakt er [VERIFISER: Trondheim legevakt, adresse fra helsenorge.no], [VERIFISER: reisetid] med bil og [VERIFISER] med buss. Nærmeste holdeplass ved boligen er Brøset Hageby, ett minutt unna, med linje 12 mot sentrum. Legevakten nås på 116 117 når fastlegen er stengt.

*Reserve (ute av topp ti):* `sykkelverksted` — Astras nye id. Behovet er reelt på Brøset (bilfri bydel), men prosjektspesifikt og lavfrekvent for 108 000 bruktboliger; Wesselsløkka har eget sykkelverksted som fellesfunksjon, så prosjektet skriver det uansett (K). Poolens `bike`-kategori er bare bysykkelstativer; en standard trenger OSM-taggen service:bicycle:repair=yes (S+). Tapte plass 10 mot legevakt. · `frisor` — Ny kandidat (haircare, 38 i poolen, nærmeste 19 minutter). Frisør står alt i ÆREND-lista for `uten-bil` og dekker aleneboerens «andre tjenester», men besøkes hver 6.–8. uke og avgjør sjelden et boligvalg. Tas inn hvis faq_opened-målingen viser etterspørsel. · `veterinar` — Ny kandidat (kategorien `veterinar` finnes i pipelinen, 0 i poolen rundt Brøset). Reelt for dyreeiere — Brøset Hundepark 3 minutter unna antyder mange — men for smal persona til topp ti i grunnkatalogen. · `returpunkt` — Kandidat: «Hvor leverer jeg glass og metall?» — sortere.no (LOOP) publiserer returpunkter.

*Verifikatorens øvrige forslag:* «Hvor er nærmeste bibliotek?» — Spørres på visning av barnefamilier og pensjonister; kategorien `library` finnes i pipelinen (poi-discovery.ts linje 80) og poolen har 3 (Moholt 21 min) — S i dag. Men osm-gate.ts sier at temaet «opplevelser» er globalt deaktivert, så biblioteket rendrer ingen steder; en Hverdagsliv-rad er det eneste stedet det ville vises.

### 4.4 Mat & drikke

| # | id | Spørsmål | Kilde | Opprinnelse |
|---|---|---|---|---|
| 1 | `spisesteder` | Kan jeg spise ute uten å dra til byen? | S | begge |
| 2 | `takeaway` | Hvor henter jeg takeaway? | S+ | begge |
| 3 | `kafe` | Hvor er nærmeste kafé? | S | begge |
| 4 | `bakeri` | Finnes det bakeri? | S | begge |
| 5 | `sondagsapent` | Hvilke spisesteder er åpne på søndag? | S+ | begge |
| 6 | `sitte-ute` | Hvor kan jeg sitte ute og spise? | S+ | begge |
| 7 | `barnevennlig` | Hvor kan vi spise ute med barna? | S+ | begge |
| 8 | `uteliv` | Hvor er nærmeste pub eller bar? | S | begge |
| 9 | `pizza` | Hvor er nærmeste pizzasted? | S | ny |
| 10 | `spesialbutikk-mat` | Finnes det spesialbutikk for mat i nærheten? | S+ | ny |

**1. `spisesteder` — Kan jeg spise ute uten å dra til byen?** (S)  
*Hvorfor:* Enig (begge plass 1). Ja/nei-spørsmålet megleren får på hver visning; bredden er svaret, ikke en anbefaling. Astras korreksjon tas inn: navngitte kjeder er et gyldig svar, så vurderende ord («tynt») er ute. Claudes tillegg tas inn: når ≤2 ligger innen 15 min til fots, legges sykkelringen (≤10 min) til.  
*Kilde:* POI-pool restaurant/cafe/bar/bakery + precomputet gangtid (DINING_RADIUS_MIN = 15) og sykkeltid; ankermedlemmer (parent=) må inn i tellingen; hale med boardFacts.cityCentre (Entur) når gangringen har ≤2.  
*Wesselsløkka:* Ja, fire spisesteder ligger innenfor ti minutter til fots: VYDA restaurant (4 minutter), Sabi Sushi Valentinlyst og Rosenborg bakeri på Valentinlyst Senter (8) og Burger King (9). Egon Tårnet ligger et kvarter unna. Med sykkel innen ti minutter kommer flere til, blant dem Il Fornaio og Viva Italia (7) og Domino's Pizza Moholt (8).

**2. `takeaway` — Hvor henter jeg takeaway?** (S+)  
*Hvorfor:* Astras prioritet (2, Claude hadde 4) — ferdig middag hjem er spørsmålet også for den som bor alene og sjelden går på restaurant. Slått sammen med Astras nye «mat-hjemlevering»: samme bygger, samme POI-sett, to attributter på samme sted. Omklassifisert fra Astras K til S+ fordi kilden er navngitt. Snevret etter verifikasjon: Ordet «levert» i «Hvor får jeg takeaway eller mat levert?» leses av kjøperen som levering til adressen.  
*Kilde:* Google Places API (New), atmosfære-feltene `takeout` og `delivery` per spisested (må legges til i NEARBY_FIELD_MASK / Place Details i pipelinen) + precomputet gang- og sykkeltid. Regel: levering omtales som stedets tilbud, aldri som dekning for adressen.  
*Wesselsløkka:* VYDA restaurant, 4 minutter til fots, er nærmeste sted med henting [VERIFISER: takeout-attributt]; Sabi Sushi Valentinlyst (8) og Burger King (9) følger [VERIFISER: takeout]. Med sykkel innen ti minutter kommer Domino's Pizza Moholt (8) og Sabi Sushi Moholt (9) til, som også tilbyr levering [VERIFISER: delivery].

**3. `kafe` — Hvor er nærmeste kafé?** (S)  
*Hvorfor:* Enig (Claude 2, Astra 3; lander på 3 fordi takeaway tok plass 2). Møteplassen for paret og den sosiale inngangen for den nyinnflyttede. Begge krever at bakerier med kafédel og sentermedlemmer teller — dagens svar (Filo Café, 22 min) taper Rosenborg bakeri på 8 fordi ankermedlemmer filtreres ut. Snevret etter verifikasjon: Byggeren (faq-generator.  
*Kilde:* POI-pool `cafe` + bakerier med kafé + gangtid, radius 15 min. Bygger finnes, mangler radius (svarer i dag «Filo Café, 22 minutter» på «i nabolaget»).  
*Wesselsløkka:* Dromedar Kaffebar på Sirkus Shopping er nærmeste kafé, 22 minutter til fots eller 10 med sykkel; Filo Café & Restaurant ligger like langt unna til fots, og Jordbærpikene Leangen ett minutt lenger. Nærmere ligger Rosenborg bakeri Valentinlyst, 8 minutter til fots på Valentinlyst Senter [VERIFISER: kafédel — Places-typer lagres ikke på boardet i dag].

**4. `bakeri` — Finnes det bakeri?** (S)  
*Hvorfor:* Enig (Claude 3, Astra 4). Lørdagsmorgen-ærendet er noe annet enn å finne en kafé med sitteplasser. Begge peker på samme feil: bakeriet inne på senteret må telle likt med eget lokale.  
*Kilde:* POI-pool bakery + precomputet gang- og sykkeltid, inkludert ankermedlemmer (parent=); nærmeste + neste, sykkeltid som hale når neste er >15 min til fots.  
*Wesselsløkka:* Rosenborg bakeri Valentinlyst ligger 8 minutter til fots, inne på Valentinlyst Senter. Neste bakeri er Mikalsen bakery, 19 minutter til fots eller 8 med sykkel, og med sykkel innen elleve minutter rekker du også Rosenborg bakeri på Sirkus Shopping og DromedarBakeriet.

**5. `sondagsapent` — Hvilke spisesteder er åpne på søndag?** (S+)  
*Hvorfor:* Astras prioritet (5, Claude hadde 9) og snevret: søndagsservering skal ikke blandes med søndagshandel, og dagens bygger ser alt bare på restaurant/cafe/bar/bakery, så spørsmålet sier nå det byggeren faktisk svarer. Claudes feilfunn tas inn: byggeren mangler radius og viser Sabrura 40 minutter unna. Snevret etter verifikasjon: Byggeren (faq-generator.  
*Kilde:* Søndagslinja i cachede åpningstider (må inn i pipelinen) for restaurant/cafe/bar/bakery ≤15 min. Bygger finnes, mangler radius.  
*Wesselsløkka:* [VERIFISER: spisested innen et kvarter med søndagstid] holder åpent på søndag [tid]. Kandidatene innenfor et kvarter til fots er VYDA restaurant (4 minutter), Sabi Sushi Valentinlyst og Rosenborg bakeri (8), Burger King (9) og Egon Tårnet (15). Nærmeste sted med registrert søndagsåpning på boardet er Sabrura Sticks & Sushi, 34 minutter til fots (13–22).

**6. `sitte-ute` — Hvor kan jeg sitte ute og spise?** (S+)  
*Hvorfor:* Enig (begge 6). Sommerspørsmålet for paret og familien. Astras presisering «og spise» beholdes fordi «sitte ute» alene kan leses som parkbenk under en tema-overskrift. Omklassifisert fra Astras K til S+ — kilden er navngitt og deterministisk.  
*Kilde:* Places-attributt `outdoorSeating` (Place Details, bare for servering-POI-er — searchNearby med Atmosphere løfter alle kall til dyr SKU). Id endret fra `uteservering` som kolliderer med per-POI-spørsmålet i restaurantmalen.  
*Wesselsløkka:* [VERIFISER: spisested med outdoorSeating] har uteservering, [gangtid] minutter til fots. Kandidatene innenfor et kvarter til fots er VYDA restaurant (4 minutter), Sabi Sushi Valentinlyst (8), Burger King (9) og Egon Tårnet (15); med sykkel innen ti minutter kommer blant andre Il Fornaio (7), IKEA Restaurant Leangen (8) og Sabi Sushi Moholt (9) til.

**7. `barnevennlig` — Hvor kan vi spise ute med barna?** (S+)  
*Hvorfor:* Enig (begge 7). Familiens fredag. Claudes formulering beholdes fordi de to Places-attributtene sammen bærer den; Astras innsnevring til «barnemeny» var drevet av K-klassifiseringen, som faller når kilden er navngitt. Svaret navngir bare steder med registrert barnemeny eller barnetilrettelegging.  
*Kilde:* Google Places API (New), atmosfære-feltene `menuForChildren` og `goodForChildren` per spisested (må inn i feltmasken) + precomputet gang- og sykkeltid. Barnestol/vognplass påstås ikke.  
*Wesselsløkka:* [VERIFISER: spisested med goodForChildren eller menuForChildren] har barnemeny, [gangtid] minutter til fots. Kandidatene innenfor et kvarter er VYDA restaurant (4 minutter), Sabi Sushi Valentinlyst (8), Burger King (9) og Egon Tårnet (15); med sykkel innen ti minutter kommer blant andre IKEA Restaurant Leangen og Domino's Pizza Moholt (8) til.

**8. `uteliv` — Hvor er nærmeste pub eller bar?** (S)  
*Hvorfor:* Enig (Claude 8, Astra 9). Voksent møtested. Claudes regel tas inn: når nærmeste er over 20 minutter, peker svaret til byen — men via Transport «til-sentrum», siden «til-byen» er områdets kortform. Astras poeng om adgangskrav (studentkjeller) løses ved at standarden bare sier navn og tid; adgang er K-overstyring. Snevret etter verifikasjon: Byggeren (faq-generator.  
*Kilde:* POI-pool `bar` + gangtid, radius 15 min; utenfor radius pekes til `til-byen`. Bygger finnes, mangler radius.  
*Wesselsløkka:* Nærmeste barer på kartet ligger 21 minutter til fots eller 11 med sykkel: Dragvollkjelleren, Aarhønekroa, LaBamba og Omega & Psykolosjen Kielder. Hønsehuset ligger 29 minutter unna. Når nærmeste er over 20 minutter, peker svaret til byen: linje 12 og 10 tar 20 minutter til Trondheim S, se Transport.

**9. `pizza` — Hvor er nærmeste pizzasted?** (S)  
*Hvorfor:* Ny (erstatter Astras «vegetarisk-middag», som falt fordi `servesVegetarianFood` er sant for nesten alle spisesteder). Fredagsspørsmålet i klartekst; Norges mest bestilte takeaway.  
*Kilde:* Google-type `pizza_restaurant` (må lagres — v2.pois har i dag ingen `types`-kolonne, så S forutsetter den) + gangtid, radius 15 min til fots / 10 på sykkel.  
*Wesselsløkka:* Nærmeste pizzasted på kartet er [VERIFISER etter at 1 000-radsfeilen er rettet — poolen leses i dag ufullstendig]. Domino's Pizza Moholt ligger 21 minutter til fots og 8 minutter med sykkel; Il Fornaio [VERIFISER] 7 minutter med sykkel.

**10. `spesialbutikk-mat` — Finnes det spesialbutikk for mat i nærheten?** (S+)  
*Hvorfor:* Ny (erstatter «kaffe-for-jobb», som ble samme POI som `kafe` og `bakeri`). Fisk, kjøtt, internasjonal matbutikk — det den nyinnflyttede uten nettverk og matvaner fra andre land spør om.  
*Kilde:* Google-typer `butcher_shop`, `seafood_market`/`fish`, `asian_grocery_store`, `food_store` (krever lagring av `types`) + gangtid ≤15 min.  
*Wesselsløkka:* SUMART Dagligvare ligger 3 minutter til fots og er [VERIFISER: type butikk — internasjonal matbutikk?]. Andre spesialbutikker for mat innenfor et kvarter: [VERIFISER etter kategori-utvidelse].

*Reserve (ute av topp ti):* `mat-hjemlevering` — Astras nye id, slått inn i «takeaway» (regel 4): samme Places-bygger, samme POI-sett, `takeout` og `delivery` er to attributter på samme sted. Spørsmålet slik Astra stilte det («til adressen») lover adressedekning attributtet ikke bærer; som hale i takeaway sies bare «tilbyr levering». Gjenopprett som egen id bare hvis en kilde med leveringspolygon per adresse (f.eks. Foodora/Wolt-API) blir navngitt. · `stamsted` — Claudes K-spørsmål «Hvor møtes nabolaget?», flyttet UT av Mat & drikke og slått inn i Opplevelser «samlingspunkt» per regel 5 (orkestratorens beslutning, Astra foreslo det samme). Prosjektets felleslokaler og Valentinlyst Senter som lokalsenter skrives som K-overstyring der, ikke her. · `uteservering` — Tatt ut etter verifikasjon — se begrunnelse i reserve-notatet. · `vegetarisk-middag` — Tatt ut etter verifikasjon — se begrunnelse i reserve-notatet. · `kaffe-for-jobb` — Tatt ut etter verifikasjon — se begrunnelse i reserve-notatet.

*Verifikatorens øvrige forslag:* «Hvor er nærmeste Vinmonopol?» — Verken Claude eller Astra har det, men det er det ene drikke-spørsmålet megleren får på nesten hver visning. Deterministisk og alt i data: `liquor_store` er pipeline-kategori, prosjektpoolen har Vinmonopolet Valentinlyst 8 minutter unna. Foreslått som erstatning for `vegetarisk-middag` (rad 9); orkestratoren må avgjøre om raden bor i Mat & drikke (byggeren leser via allPois) eller Hverdagsliv (der REPORT_THEME_DEFAULTS har kategorien).

### 4.5 Natur & friluftsliv

| # | id | Spørsmål | Kilde | Opprinnelse |
|---|---|---|---|---|
| 1 | `gronntomrade` | Hvor er nærmeste park eller grøntområde? | S | begge |
| 2 | `turstier` | Hvor kommer jeg inn på nærmeste tursti? | S+ | begge |
| 3 | `marka` | Hvor lang tid tar det til marka? | S+ | begge |
| 4 | `hund` | Hvor er nærmeste hundepark? | S | begge |
| 5 | `ski` | Hvor er nærmeste skiløype? | S+ | begge |
| 6 | `bading` | Kan jeg bade i nærheten? | S | begge |
| 7 | `sykkelrute` | Hvor går nærmeste sykkelrute? | S+ | ny |
| 8 | `tur-med-vogn` | Hvor er nærmeste turvei for barnevogn? | S+ | astra |
| 9 | `lysloype-lopetur` | Hvor er nærmeste lysløype? | S+ | begge |
| 10 | `akebakke` | Hvor er nærmeste akebakke? | K | begge |

**1. `gronntomrade` — Hvor er nærmeste park eller grøntområde?** (S)  
*Hvorfor:* Enig (begge #1). 91 % vil ha friluft nær, og det er det første megleren får på hver visning. Astras innvending tas inn: hundeparken er ikke et oppholdsområde og skal ikke svare her.  
*Kilde:* POI-pool kategori park + outdoor med precomputet gangtid, ekskludert kategori hundepark og navn som inneholder «hundepark»; nærmeste + to neste, antall innen 15 min til fots.  
*Wesselsløkka:* Spruten er nærmeste park, 12 minutter til fots eller 5 med sykkel. Persaunet park ligger 14 minutter unna, Torsheim plass og Tyholtsletta 16. Innen et kvarter til fots ligger to parker på kartet. Brøset Hundepark, 3 minutter fra boligen, er et eget område for hunder.

**2. `turstier` — Hvor kommer jeg inn på nærmeste tursti?** (S+)  
*Hvorfor:* Snevret (Claude #2, Astra #3). «Hvor går turstiene?» lover en beskrivelse kilden ikke bærer; en inngang med gangtid er det ruten-geometrien faktisk gir. Behovet: hvor begynner turen, uten bil. Snevret etter verifikasjon: Ordet «starter» loves ikke av kilden: Turrutebasen gir en linje, og gangruta går til nærmeste punkt på linja — det er et påkoblingspunkt, ikke et startpunkt.  
*Kilde:* Kartverkets Tur- og friluftsruter (Turrutebasen, Geonorge WFS), objekttype Fotrute: nærmeste punkt på ruta → gangrute → gangtid, rutenavn. Supplert av Overpass route=hiking/foot (reportConfig.trails) når den er reell — Wesselsløkkas fem lagrede ruter er plassholdere.  
*Wesselsløkka:* [VERIFISER: nærmeste Fotrute i Turrutebasen] er nærmeste tursti, [VERIFISER: gangtid] minutter til fots til nærmeste punkt på ruta, [VERIFISER: lengde] kilometer og gradert [VERIFISER: gradering]. På kartet i dag er Nidelva elvesti nærmeste navngitte sti, 33 minutter til fots eller 13 med sykkel, og Ladestien ligger 42 minutter til fots eller 17 med sykkel.

**3. `marka` — Hvor lang tid tar det til marka?** (S+)  
*Hvorfor:* Snevret (Claude #3, Astra #4). Trondheim-spesifikt og spurt på hver visning. Astras formulering tas: en gangrute til nærmeste punkt på marka-polygonet ER en inngang, og det er deterministisk — så S+, ikke K. Snevret etter verifikasjon: «Inngang» finnes ikke i kilden: Naturbase-polygonene har ingen innganger, og en gangrute til nærmeste kant kan ende ved et gjerde eller en fylkesvei.  
*Kilde:* Naturbase (Miljødirektoratet) områdetype «Marka» + «Store turområder med tilrettelegging» → gangtid til nærmeste kant. Polygonene har ingen innganger — derfor «hvor lang tid», ikke «hvor er inngangen».  
*Wesselsløkka:* [VERIFISER: Estenstadmarka mot Naturbase-polygon] er nærmeste marka, [VERIFISER: gangtid] minutter til fots og [VERIFISER: sykkeltid] med sykkel til nærmeste punkt på området. Spruten, 12 minutter til fots, er nærmeste park, og Kuhaugen ligger 19 minutter unna.

**4. `hund` — Hvor er nærmeste hundepark?** (S)  
*Hvorfor:* Snevret (Claude #4, Astra #6). Hundeeiere er en stor gruppe og poolen har svaret i dag. Astra har rett i at kategorien ikke dokumenterer inngjerding — derfor lover spørsmålet hundepark, ikke løsområde. Claudes prioritet.  
*Kilde:* POI-pool kategori hundepark (Google dog_park / OSM leisure=dog_park) + navnefallback «hundepark» i POI-navn, med precomputet gangtid. På Wesselsløkka ligger begge hundeparkene i kategori park, så byggeren må lese navnet til de er omkategorisert.  
*Wesselsløkka:* Brøset Hundepark er nærmeste hundepark, 3 minutter til fots eller 2 med sykkel. Bare bussholdeplassen Brøset Hageby ligger nærmere boligen. Én hundepark til ligger på kartet, uten målt gangtid [VERIFISER: navn og avstand]. Nærmeste park ellers er Spruten, 12 minutter til fots eller 5 med sykkel.

**5. `ski` — Hvor er nærmeste skiløype?** (S+)  
*Hvorfor:* Claudes prioritet (Claude #6, Astra #9), løftet til 5: i Trondheim er skiløypa et fast visningsspørsmål halve året. Klassen løftes fra Claudes feed-idé og Astras K til S+ med Turrutebasen som deterministisk geometri.  
*Kilde:* Turrutebasen objekttype Skiløype: nærmeste punkt på løypa → gangtid, rutenavn. skisporet.no bare som lenke for dagens preparering, aldri som fakta i svaret.  
*Wesselsløkka:* [VERIFISER: Skiløype-navn fra Turrutebasen] er nærmeste skiløype, [VERIFISER: gangtid] minutter til fots til nærmeste punkt på løypa. Løypa er [VERIFISER: lengde] kilometer og gradert [VERIFISER: gradering]. Dagens preparering står på skisporet.no.

**6. `bading` — Kan jeg bade i nærheten?** (S)  
*Hvorfor:* Enig (Claude #7, Astra #8). Sommerspørsmålet på visning, og en av de få radene som fungerer i dag. Løftet til 6 fordi S slår S+ når behovet er sammenlignbart.  
*Kilde:* POI-pool kategori badeplass + precomputet gangtid for gange, sykkel og bil; nærmeste + alternativene.  
*Wesselsløkka:* Devlebukta er nærmeste badeplass, 37 minutter til fots, 17 med sykkel eller 9 med bil. Rotvollfjæra ligger 15 minutter unna med sykkel og 9 med bil, Strandveikaia 19 med sykkel. Alle tre badeplassene på kartet ligger innenfor 20 minutter med sykkel og et kvarter med bil.

**7. `sykkelrute` — Hvor går nærmeste sykkelrute?** (S+)  
*Hvorfor:* Ny (verifikatorens forslag, erstatter Astras «kort-turrunde» som var delmengde av `turstier` fra samme kilde). Hver rad i temaet oppgir sykkeltid, men ingen sa hvor man sykler tur.  
*Kilde:* Turrutebasen (Kartverket) objekttype Sykkelrute — samme kilde og bygger som `turstier`, null ekstra oppslag.  
*Wesselsløkka:* [VERIFISER: nærmeste Sykkelrute i Turrutebasen, rutenavn og gangtid til påkoblingspunktet]. Brøset er planlagt med gjennomgående gang- og sykkelveier (områdeplanen 2013) [VERIFISER hva som er bygd].

**8. `tur-med-vogn` — Hvor er nærmeste turvei for barnevogn?** (S+)  
*Hvorfor:* Ny fra Astra (#5), tatt inn som erstatning for `gront-andel`. Dekker både barnevogn-forelderen og trinnfri-behovet (rullestol er samme felt). Astras K løftes til S+ med Turrutebasens tilpasning-felt. Snevret etter verifikasjon: Feltet finnes: Turrutebasen 20171210 har codelisten Tilpasning med verdiene Gående=G, Barnevogn=B, Rullestol=R, Sykkel=S, Annet=A på FotruteInfo, så S+ er legitimt.  
*Kilde:* Turrutebasen felt tilpasning (verdier Barnevogn / Rullestol) på Fotrute: nærmeste punkt → gangtid, lengde og rutenavn. Uten feltverdi for kommunen: ingen rad.  
*Wesselsløkka:* [VERIFISER: Fotrute med tilpasning B eller R i Turrutebasen] er nærmeste turvei tilrettelagt for barnevogn, [VERIFISER: gangtid] minutter fra boligen og [VERIFISER: lengde] kilometer, med [VERIFISER: underlagstype] underlag. Spruten, 12 minutter til fots, og Persaunet park, 14 minutter, er de nærmeste parkene på kartet.

**9. `lysloype-lopetur` — Hvor er nærmeste lysløype?** (S+)  
*Hvorfor:* Snevret (Claude #5, Astra #7). «Lysløype eller løperunde» er to egenskaper i ett spørsmål; belysning er det feltet kilden har. Vinterhalvårets hverdagstur etter jobb. Astras K avvist: Turrutebasen har belysning som felt.  
*Kilde:* Turrutebasen felt belysning=Ja på Fotrute/Skiløype: nærmeste punkt → gangtid, belyst lengde, rutenavn. Alternativ: OSM lit=yes på piste/path. Delvis belyst løype oppgis med belyst strekning, ikke som gjennomgående.  
*Wesselsløkka:* [VERIFISER: rute med belysning=JA i Turrutebasen] er nærmeste lysløype, [VERIFISER: gangtid] minutter til fots fra boligen, med [VERIFISER: lengde] kilometer belyst strekning. Løypa er registrert som [VERIFISER: Fotrute eller Skiløype] med [VERIFISER: underlagstype] underlag.

**10. `akebakke` — Hvor er nærmeste akebakke?** (K)  
*Hvorfor:* Enig i behovet (Claude #8, Astra #10), Claudes formulering. Trondheimsvinteren for barnefamilier. Astras K avvist etter regel 1, men datafunnet gir henne delvis rett: navnesøket treffer bare Blusuvoll på Wesselsløkka. Omklassifisert etter verifikasjon: S+ krever én navngitt deterministisk kilde.  
*Kilde:* Kuratert: navnesøk («akebakke» i Spruten, Akebakken Blussuvoll) er heuristikk, ikke register. Prosjekt/strøk skriver svaret.  
*Wesselsløkka:* Akebakken Blusuvoll er nærmeste registrerte akebakke, 21 minutter til fots eller 8 med sykkel. Spruten friområde, 12 minutter til fots eller 5 med sykkel, har akebakke [VERIFISER: kuratert påstand fra områdebeskrivelsen]. Begge ligger innenfor ti minutter med sykkel fra boligen.

*Reserve (ute av topp ti):* `til-fjorden` — Regel 5. Kystlinjeavstand svarer ikke på adgang til sjøen; `bading` og `turstier` (Ladestien) dekker bruken. Tas opp igjen som prosjekt-K der fjordtilgang er sentral. · `gront-andel` — Regel 5. Prosent grøntareal i 500-metersring er verken en rute eller et brukbart sted; «53 % grønt» er planlagt andel for ferdig Brøset, ikke dagens tilgjengelighet. Erstattet av `tur-med-vogn`. · `batliv` — Eksisterende id, utelatt av begge. Marina-kategorien er tom på Wesselsløkka og en marina-POI dokumenterer ikke båtplass. Beholdes deklarert (id er kontrakten), men utenfor topp ti til et kystprosjekt trenger den. · `kort-turrunde` — Tatt ut etter verifikasjon — se begrunnelse i reserve-notatet. · `skoyter` — Dekkes av `is-skoyter` under Trening.

### 4.6 Transport

| # | id | Spørsmål | Kilde | Opprinnelse |
|---|---|---|---|---|
| 1 | `naermeste-holdeplass` | Hvor er nærmeste holdeplass? | S | begge |
| 2 | `til-sentrum` | Hvor lang tid tar det til sentrum? | S | begge |
| 3 | `linjer` | Hvor går linjene fra nærmeste holdeplass? | S | begge |
| 4 | `frekvens` | Hvor ofte er det avganger på hverdager? | S+ | begge |
| 5 | `til-arbeidsplassene` | Hvor lang tid tar det til de store arbeidsplassene? | S+ | begge |
| 6 | `siste-buss` | Når går siste avgang hjem fra sentrum? | S+ | begge |
| 7 | `sykkel-til-byen` | Hvor lang tid tar det å sykle til sentrum? | S+ | begge |
| 8 | `bil-til-byen` | Hvor lang tid tar det med bil til sentrum? | S+ | ny |
| 9 | `tog` | Hvor er nærmeste togstasjon? | S | begge |
| 10 | `lading` | Hvor finnes offentlig elbillading i nærheten? | S+ | begge |

**1. `naermeste-holdeplass` — Hvor er nærmeste holdeplass?** (S)  
*Hvorfor:* Enig (begge på plass 1). Tilkomsten til kollektiv er det første megleren får spørsmål om, og boardet har både luftlinjeavstand og precomputet gangtid, så Astras innvending om at meter ikke er gangtid løses ved å vise begge.  
*Kilde:* boardFacts.stops fra Entur (stopPlace, distanceM luftlinje) + POI-pool bus med precomputet gangtid. Wesselsløkka: 8 holdeplasser innenfor 10 min, 16 innenfor 15.  
*Wesselsløkka:* Brøset Hageby er nærmeste holdeplass, ett minutt til fots og 90 meter fra boligen. Brøsetflata ligger 4 minutter unna, Teglverkskrysset 6 og Solvollvegen 7. Innenfor ti minutters gange ligger åtte bussholdeplasser i alt, blant dem Valentinlyst på 9 minutter og Bromstadsvingen på 10.

**2. `til-sentrum` — Hvor lang tid tar det til sentrum?** (S)  
*Hvorfor:* Astras prioritet (opp fra 3 til 2) og Astras formulering. Reisetiden er det kjøperen egentlig spør om; linjene er middelet. Området beholder «til-byen» som kortform med lenke hit (regel 5), så fullformen må stå høyt i temaet. Snevret etter verifikasjon: Ordet «med buss» lover mer smalt enn kilden svarer: TRIP_QUERY i transit-facts.  
*Kilde:* boardFacts.cityCentre (Entur trip, modus-nøytral: buss, tog, trikk, T-bane, bybane) — derfor uten «med buss» i spørsmålet.  
*Wesselsløkka:* Til Trondheim S tar det 20 minutter med linje 12 og bytte til linje 10. Linje 12 går direkte på 24 minutter, med om lag 500 meter gange i reisen mot 90 meter for den raskeste. Reisetidene er hentet fra Entur for en hverdag klokka 08 og regnes fra boligens adresse, gange inkludert.

**3. `linjer` — Hvor går linjene fra nærmeste holdeplass?** (S)  
*Hvorfor:* Astras formulering, Claudes plass (3, ned fra 2 fordi til-sentrum gikk opp). Ett tema per spørsmål (regel 6): Claudes «hvilke linjer, og hvor går de» var to. Retningsnavn hjelper også den som ikke kjenner linjenumrene. Snevret etter verifikasjon: Ordet «bussene» har samme modus-problem som til-sentrum: boardFacts.  
*Kilde:* boardFacts.stops[].directions (Entur estimatedCalls per quay: destinations i frekvensrekkefølge + lines). Wesselsløkka: linje 12 begge retninger fra Brøset Hageby; Brøsetflatas linjer ikke rendret i dag.  
*Wesselsløkka:* Fra Brøset Hageby går linje 12 i begge retninger: mot Dragvoll, og mot Marienborg via Strindh.-sentrum. Enkelte avganger i sentrumsretning er skiltet Spektrum via Strindh.-sentrum. Brøsetflata, Teglverkskrysset og Solvollvegen, alle innenfor 500 meter, har de samme to retningene med linje 12. Retningene er skiltteksten Entur oppgir for hver side av vegen.

**4. `frekvens` — Hvor ofte er det avganger på hverdager?** (S+)  
*Hvorfor:* Enig (begge plass 4), snevret til «på hverdager» slik Astra foreslo, og klassifisert S+ ikke K: kilden er navngitt (Entur estimatedCalls), og board-facts sampler alt 30 avganger per quay i et 2-timers rushvindu. Svarformatet gir to tall (rush og kveld) så skiftarbeideren dekkes. Snevret etter verifikasjon: S+ holder: DEPARTURES_QUERY med startTime/timeRange er deterministisk for valgt dato, og telling per time er ett nytt felt.  
*Kilde:* Entur estimatedCalls for nærmeste holdeplass, telt per time i to hverdagsvinduer (07–09 og 19–21), én retning om gangen. Nytt felt i boardFacts; samme API som linjer bruker i dag. Wesselsløkka: ikke lagret ennå.  
*Wesselsløkka:* Fra Brøset Hageby går linje 12 mot Marienborg via Strindh.-sentrum [VERIFISER: antall] ganger i timen mellom 07 og 09 på hverdager, og [VERIFISER: antall] ganger i timen mellom 19 og 21. Mot Dragvoll er tallene [VERIFISER: antall] og [VERIFISER: antall]. Tellingen er Enturs avgangsliste for holdeplassen på én vanlig hverdag, én retning om gangen.

**5. `til-arbeidsplassene` — Hvor lang tid tar det til de store arbeidsplassene?** (S+)  
*Hvorfor:* Flyttet inn fra Området (regel 5), Claudes formulering, Astras plass (5). Claudes tekst lover en liste standarden kan holde; Astras «jobb og studiested» lover en personlig reise ingen standard kan gi. S+ ikke K: Entur trip mot en konfigurert liste er samme mekanisme board-facts alt bruker for sentrum og videregående.  
*Kilde:* Entur trip fra boligen til en konfigurert destinasjonsliste per by (Trondheim: St. Olavs hospital, NTNU Gløshaugen, Sluppen), lagt i samme destinations-array som cityCentre og VGS i lib/pipeline/board-facts.ts. Wesselsløkka: bare VGS-reisene finnes i dag (Cissi Klein 13 min med linje 12, Strinda 16).  
*Wesselsløkka:* Til St. Olavs hospital tar det [VERIFISER: minutter] med [VERIFISER: linje], til NTNU Gløshaugen [VERIFISER: minutter] og til Sluppen [VERIFISER: minutter]. Reisetidene beregnes med Entur fra boligen på et rushtidspunkt, på samme måte som reisen til Trondheim S på 20 minutter.

**6. `siste-buss` — Når går siste avgang hjem fra sentrum?** (S+)  
*Hvorfor:* Enig, Astras formulering og plass (6). Snevret til «fra sentrum» fordi det er det kilden bærer: siste avgang fra sentrumsstoppet mot nærmeste holdeplass. S+ ikke K: Entur rutetabell er navngitt og deterministisk. Dekker både byturen og den som avslutter vakta sent. Snevret etter verifikasjon: S+ holder (Entur trip med arriveBy/sen dateTime er deterministisk per ruteperiode), men «siste buss» har modus-problemet, og i Trondheim er nattavgangene ofte andre linjer enn dagslinja — svaret må navngi linjen Entur faktisk gir.  
*Kilde:* Entur estimatedCalls/trip fra sentrumsstoppet (samme stopp som cityCentre) til nærmeste holdeplass, siste avgang per ukedagstype (hverdag, natt til lørdag/søndag). Nytt felt i boardFacts. Wesselsløkka: ikke lagret.  
*Wesselsløkka:* Siste avgang fra Trondheim S mot boligen går [VERIFISER: klokkeslett] på hverdager og [VERIFISER: klokkeslett] natt til lørdag og søndag, med linje [VERIFISER: linje]. Tidene er Enturs siste reise fra sentrumsstoppet til boligens adresse for hver ukedagstype. Reisen ender på [VERIFISER: holdeplass], [VERIFISER: minutter] til fots fra boligen.

**7. `sykkel-til-byen` — Hvor lang tid tar det å sykle til sentrum?** (S+)  
*Hvorfor:* Enig (Claude 6, Astra 7 → 7). S+ ikke K: sykkeltid er alt precomputet for hver POI i poolen med Mapbox; ett ekstra oppslag mot sentrumsstoppets koordinat gir tallet. Brøset er planlagt for sykkel, og aleneboeren uten bil trenger alternativet når bussen ikke passer.  
*Kilde:* Mapbox Directions (cycling) fra boligen til sentrumsstoppets koordinat, samme rutemotor som gangtidene. Wesselsløkka: sentrumstid ikke beregnet, men poolen har 15 min sykkel til Solsiden og 17 til Dronningens gate (taxi-holdeplass-POI-er), 4 min til bysykkelstativet på Valentinlyst.  
*Wesselsløkka:* Til Trondheim S tar det [VERIFISER: minutter] på sykkel fra boligen, beregnet med samme rutemotor som gangtidene på kartet og til samme sentrumspunkt som bussreisen. Nærmeste bysykkelstativ, Trondheim Bysykkel: Valentinlyst, ligger 4 minutter unna på sykkel og 9 minutter til fots. Sykkeltiden regnes uten stopp og venting.

**8. `bil-til-byen` — Hvor lang tid tar det med bil til sentrum?** (S+)  
*Hvorfor:* Ny (verifikatorens forslag, erstatter «bysykkel» som finnes i fem byer). Personaen var «én bil eller ingen», men de fleste av de 108 000 bruktboligene er bilhusholdninger — standarden må svare dem også.  
*Kilde:* Samme Mapbox-oppslag som `sykkel-til-byen` (ett kall til byens sentrumspunkt, profil driving, utenom rush).  
*Wesselsløkka:* Til Trondheim S tar det [VERIFISER: Mapbox biltid] minutter med bil utenom rush. Tallet gjelder kjøretid; parkering i sentrum inngår ikke.

**9. `tog` — Hvor er nærmeste togstasjon?** (S)  
*Hvorfor:* Enig (begge 7–8 → 8), Astras formulering. Regel 1: kilden er en stasjons-POI med gangtid, ikke togavganger, så «går det tog herfra» lover mer enn byggeren holder. Id beholdes fordi Ranheim har et kuratert svar på den.  
*Kilde:* POI-pool train + precomputet gangtid og sykkeltid; boardFacts.stops med modes=rail supplerer innenfor 700 m. Wesselsløkka: 0 train i poolen — Leangen stasjon mangler (recall-hull, Claude § 5). Raden vises ikke før stasjonen er hentet inn.  
*Wesselsløkka:* [VERIFISER: Leangen stasjon] er nærmeste togstasjon på kartet, [VERIFISER: minutter] til fots og [VERIFISER: minutter] på sykkel fra boligen. Stasjonen er hentet inn som eget sted med målt gangtid, på samme måte som holdeplassene og bysykkelstativene. Neste stasjon er [VERIFISER: navn], [VERIFISER: minutter] til fots. Tidene gjelder fra boligens adresse.

**10. `lading` — Hvor finnes offentlig elbillading i nærheten?** (S+)  
*Hvorfor:* Enig (Claude 9, Astra 9 → 9), Astras avgrensning til offentlig lading fordi det er det NOBIL bærer; prosjektets parkeringskjeller er en annen påstand. S+ (Claude) ikke Astras «STANDARD bare ved POI»: NOBIL er navngitt og offentlig. Én-bils-husholdningen i bruktmarkedet spør om dette.  
*Kilde:* NOBIL (åpent ladestasjonsregister, Enova): stasjonsnavn, antall ladepunkter, effekt, operatør, offentlig tilgang; gangtid precomputes som for POI-er. Wesselsløkka: 0 charging_station i poolen; leadText hevder lading på Valentinlyst [VERIFISER].  
*Wesselsløkka:* Nærmeste offentlige ladestasjon er [VERIFISER: navn], [VERIFISER: minutter] til fots fra boligen, med [VERIFISER: antall] ladepunkter på opptil [VERIFISER: kW]. Stasjonen driftes av [VERIFISER: operatør]. Neste ladestasjon er [VERIFISER: navn], [VERIFISER: minutter] unna. Opplysningene hentes fra NOBIL, det offentlige ladestasjonsregisteret, og gjelder ladepunkt med offentlig tilgang.

*Reserve (ute av topp ti):* `til-flyplassen` — S+ (Entur trip mot TRD), men Astras innvending står: daglige reiser går foran, og «Trondheims mest stilte reisespørsmål» er udokumentert. Kan dekkes uten egen rad ved å legge Værnes inn i destinasjonslista til til-arbeidsplassene. · `parkering-gjester` — K uten navngitt deterministisk kilde: Trondheim kommunes soneparkeringskart sier bare om gata er boligsone, ikke gjesters vilkår. Behovet er reelt i et bilfritt prosjekt, men prosjektet skriver det selv i det kuraterte laget; for 108 000 bruktboliger står raden tom. · `bildeling` — S (kategori carshare), men 0 i poolen på Wesselsløkka og ingen av forslagene tok den inn i topp ti. Tas inn når poolen har data; leadText påstår bildeling på Valentinlyst [VERIFISER]. · `bysykkel` — Tatt ut etter verifikasjon — se begrunnelse i reserve-notatet. · `forste-avgang` — Kandidat for skiftarbeideren: speilvendt `siste-buss`, samme Entur-kall. · `gange-til-byen` — Kandidat for sentrumsnære bruktboliger.

### 4.7 Trening & aktivitet

| # | id | Spørsmål | Kilde | Opprinnelse |
|---|---|---|---|---|
| 1 | `treningssenter` | Hvor er nærmeste treningssenter? | S | begge |
| 2 | `svommehall` | Finnes det svømmehall i nærheten? | S | begge |
| 3 | `idrettsanlegg` | Hvor finnes baner og idrettshaller i nærheten? | S | begge |
| 4 | `trene-tidlig-sent` | Kan jeg trene før jobb eller sent på kvelden? | S+ | begge |
| 5 | `spesialtrening` | Finnes det yoga, kampsport eller klatring her? | S+ | ny |
| 6 | `treningspark` | Er det utendørs treningspark? | S+ | begge |
| 7 | `gruppetrening` | Hvor kan jeg bli med på gruppetrening? | K | astra |
| 8 | `padel-tennis` | Hvor kan jeg spille padel, tennis eller squash? | S+ | begge |
| 9 | `is-skoyter` | Hvor er nærmeste ishall eller skøytebane? | S+ | begge |
| 10 | `idrettslag` | Hvilke idrettslag holder til i nabolaget? | K | begge |

**1. `treningssenter` — Hvor er nærmeste treningssenter?** (S)  
*Hvorfor:* Enig — plass 1 hos begge. Det første spørsmålet megleren får om trening på hver visning; svaret må være det faktisk nærmeste, også når senteret ligger inne i et kjøpesenter.  
*Kilde:* POI-pool `gym` INKLUDERT ankermedlemmer (parent=Valentinlyst Senter) + precomputet gangtid; nærmeste + neste. Dagens bygger får lista uten ankermedlemmene og svarer TrenHer 15 min — ankerfeilen fra Claude § 5.  
*Wesselsløkka:* Fresh Fitness Valentinlyst er nærmeste treningssenter, 6 minutter til fots og 3 med sykkel. Feelgood ligger i samme senter, 8 minutter unna. TrenHer og Feel24 Tyholt ligger begge 15 minutter til fots, og 3T Moholt 19 minutter til fots eller 8 med sykkel.

**2. `svommehall` — Finnes det svømmehall i nærheten?** (S)  
*Hvorfor:* Enig i behovet, løftet til 2 (Astra 3, Claude 4). Svømmehallen spørres om av familier, svømmere og eldre — det bredeste «finnes det»-spørsmålet i temaet.  
*Kilde:* POI-pool `swimming` + precomputet gange/sykkel/bil. Når POI-navnet er generisk («Svømmehall»), hentes anleggsnavnet fra parent-ankeret (Charlottenlundhallen). Publikumsbading er et [VERIFISER]-felt, ikke et K-krav.  
*Wesselsløkka:* Nærmeste svømmehall ligger ved Charlottenlundhallen, 30 minutter til fots, 13 med sykkel eller 10 med bil [VERIFISER: POI-en heter bare «Svømmehall» — anleggsnavn og tider for publikumsbading]. Anlegget har også kunstgrasbane og skatepark [VERIFISER: Charlottenlund kunstgrasbane og Charlottenlund skatepark ligger under samme anker uten reisetid].

**3. `idrettsanlegg` — Hvor finnes baner og idrettshaller i nærheten?** (S)  
*Hvorfor:* Slått sammen med idrettsanlegg-barn (regel 5), Astras formulering. Familien spør «hvor trener barna», voksne spør om hall og bane — samme anlegg, ett svar; 110 idretts-POI-er er temaets største innhold.  
*Kilde:* POI-pool `idrett` + gangtid. Merk: `idrett` ligger i Oppvekst-temaets kategoriliste, ikke Trenings — byggeren må lese `allPois`, eller kategorilisten endres.  
*Wesselsløkka:* Eberg idrettsplass er nærmeste anlegg, 12–15 minutter til fots: Bingen (12 minutter), Freidigbanen kunstgress (13) og Eberg kunstgress (15). Leangen bydelshallen er nærmeste idrettshall, 12 minutter til fots og 5 med sykkel, med Leangen Curlinghall (13) og Ruta 7'er (14) i samme idrettspark. Blussuvollhallen ligger 15 minutter unna.

**4. `trene-tidlig-sent` — Kan jeg trene før jobb eller sent på kvelden?** (S+)  
*Hvorfor:* Enig, senket til 4 (Astra 2, Claude 3). Rutinen fortsetter bare hvis senteret er åpent når du faktisk har tid; svaret må komme fra medlemmenes adgangstid, ikke fra et kontor.  
*Kilde:* Cachede åpningstider for `gym` ≤15 min (må inn i pipelinen; ingen gym innen 15 min har tider i dag). Bygger må kreve åpning ≤06 eller stenging ≥22 og navnefilter — svarer i dag «Sit 08–15.45» fra et kontor 37 min unna.  
*Wesselsløkka:* Fresh Fitness Valentinlyst, 6 minutter til fots, holder åpent 05–24 på hverdager [VERIFISER: freshfitness.no sier 05–24, valentinlyst.no 05–23; ikke døgnåpent; tiden er ikke cachet i poolen]. Feelgood i samme senter ligger 8 minutter unna [VERIFISER åpningstider]. 3T Moholt, 19 minutter til fots, [VERIFISER åpningstider].

**5. `spesialtrening` — Finnes det yoga, kampsport eller klatring her?** (S+)  
*Hvorfor:* Ny (verifikatorens forslag, erstatter «kjeder» som ble identisk med `treningssenter`-svaret). Astras 47-åring som vil komme i gang finner lavterskelen oftere i en yogaklasse eller bokseklubb enn på et senter.  
*Kilde:* Google-typer `yoga_studio`, `martial_arts_school`/`boxing`, `climbing_gym` (krever lagring av `types`) + gangtid ≤15 min / sykkel ≤10.  
*Wesselsløkka:* The Norwegian Combat Academy ligger 16 minutter til fots og 7 minutter med sykkel. Yoga og klatring: [VERIFISER etter kategori-utvidelse — poolen har ikke typene i dag].

**6. `treningspark` — Er det utendørs treningspark?** (S+)  
*Hvorfor:* Astras prioritet (6, Claude 8). Den som vil komme i gang trenger et sted uten medlemskap og terskel; Claudes formulering beholdt fordi den matcher det kilden bærer (regel 1). Omklassifisert etter verifikasjon: «0 treff på Brøset — recall-hull» er feil diagnose.  
*Kilde:* OSM `leisure=fitness_station` — `fitness_park` har INGEN produsent i pipelinen i dag (ikke i Google-kartet, ikke i OSM-porten; 1 POI i hele prod).  
*Wesselsløkka:* Ingen rad på Wesselsløkka i dag: poolen har 0 `fitness_park`, og kategorien har ingen kilde i pipelinen. Malen er «X er nærmeste utendørs treningspark, N minutter til fots». Kandidater som må re-kategoriseres først: Moholt Trimpark (22 minutter til fots, 10 med sykkel, ligger som treningssenter) og Calisthenics/Street Workout Bars (43 minutter til fots, 18 med sykkel, ligger som idrettsanlegg).

**7. `gruppetrening` — Hvor kan jeg bli med på gruppetrening?** (K)  
*Hvorfor:* Ny fra Astra. Gruppetimen er den laveste terskelen for den som ikke har trent på år; ingen S/S+ dekker behovet, og prosjektet skriver det uansett — Wesselsløkkas tematekst gjør det allerede.  
*Kilde:* Kuratert per prosjekt/strøk: navngitt senter, type gruppetimer, adgang (medlemskap/drop-in). Ingen register eller Places-attributt dokumenterer gruppetimer; standarden kan bare gi navn og gangtid på gym-POI-ene, og det er alt rad 1 og 5.  
*Wesselsløkka:* Feelgood på Valentinlyst Senter, 8 minutter til fots, har gruppetimer [VERIFISER: temateksten sier at kjedene på Valentinlyst dekker styrke og gruppetimer; timeplan og adgang må bekreftes]. Fresh Fitness i samme senter ligger 6 minutter unna [VERIFISER gruppetilbud]. 3T Moholt ligger 19 minutter til fots eller 8 med sykkel [VERIFISER gruppetilbud].

**8. `padel-tennis` — Hvor kan jeg spille padel, tennis eller squash?** (S+)  
*Hvorfor:* Enig (Claude 7, Astra 8 → 9). Racketidrett er den voksenidretten som vokser raskest; svaret må navngi anlegget uten å love alle tre idrettene.  
*Kilde:* OSM `sport=padel／tennis／squash` / Google-typer på `idrett`-POI-er + gange/sykkel/bil. I dag identifiserbart bare på navn (Nyhavna padel, Lade tennisbaner, Lade tennishall) — typetaggen er den nye kilden. Vis bare idrettene som faktisk er funnet.  
*Wesselsløkka:* Nyhavna padel er nærmeste padelanlegg, 37 minutter til fots, 17 med sykkel eller 12 med bil. Lade tennisbaner ligger 40 minutter til fots, 19 med sykkel og 10 med bil; Lade tennishall ligger i samme idrettspark [VERIFISER: mangler reisetid i poolen]. Begge er identifisert på navn [VERIFISER: sport-tagg fra OSM/Google].

**9. `is-skoyter` — Hvor er nærmeste ishall eller skøytebane?** (S+)  
*Hvorfor:* Claudes formulering og klasse (S+), Astras plass (9 → 10). Trondheimsvinteren: ishall og skøytebane er et sesongbehov for familier og hockeyforeldre, og typetaggen svarer på «hvor», ikke på publikumstider.  
*Kilde:* OSM `leisure=ice_rink` / `sport=ice_skating／ice_hockey` / Google `ice_skating_rink` på `idrett`- og `park`-POI-er + reisetid. På Brøset: Jakobsli skøytebane (36/16/11), Skøytebane ved Solsiden Senter (park, 34 min); Leangen-ishallene (Leangen Bolig Arena, Leangenhallen) ligger under Leangen-ankeret uten reisetid.  
*Wesselsløkka:* Jakobsli skøytebane er nærmeste skøytebane med målt reisetid, 36 minutter til fots, 16 med sykkel eller 11 med bil. Leangen idrettspark, 12–17 minutter til fots, har ishaller ifølge temateksten [VERIFISER: Leangen Bolig Arena og Leangenhallen ligger i poolen uten reisetid; Leangen Curlinghall har 13 minutter]. Skøytebanen ved Solsiden Senter ligger 34 minutter unna.

**10. `idrettslag` — Hvilke idrettslag holder til i nabolaget?** (K)  
*Hvorfor:* Snevret og omklassifisert (begge K → S+). Klubbene er inngangen til organisert aktivitet for barn og for voksne som vil begynne; NIFs klubbregister gir navn, idrett og adresse deterministisk, mens «idrettsmiljøet» var en vurdering. Omklassifisert etter verifikasjon: S+ krever én navngitt deterministisk kilde.  
*Kilde:* Kuratert. NIFs klubbsøk er et nettsidesøk uten API; eneste realistiske S+-vei er Frivillighetsregisteret (data.brreg.no).  
*Wesselsløkka:* Freidig [VERIFISER klubbnavn] holder til på Eberg idrettsplass, 13–15 minutter til fots, og Strindheim IL [VERIFISER] på Leangen idrettspark, 12–17 minutter unna. Hvilke idretter de tilbyr, hentes fra NIFs klubbsøk [VERIFISER: kilden er ikke koblet; klubbnavnene er avledet av POI-ene Freidigbanen og Strindheim kunstgrasbane].

*Reserve (ute av topp ti):* `spa-badstue` — Regel 5. Thai Klinikk (24 min, medlem av Sirkus Shopping) beviser verken spa eller badstue, og fjordsauna-kategorien mangler i poolen. Tas opp igjen med egen, navngitt badstue-kilde. · `klatring` — Ny S+-kandidat funnet i poolen: Grip Klatring Leangen 19 min til fots / 8 med sykkel, Trondheim Buldresenter 38 min, Buld.no uten reisetid. Kilde: OSM sport=climbing / Google-type. Venter til faq_opened viser om plass 6–10 faktisk åpnes. · `idrettsanlegg-barn` — Slått inn i idrettsanlegg (regel 5) — ingen egen rad i Trening; Barn beholder oppvekst-fritid for alderstilpasset aktivitet. · `kjeder` — Tatt ut etter verifikasjon — se begrunnelse i reserve-notatet. · `skatepark-sykkelpark` — Kandidat for tweens: Google `skateboard_park` + OSM; Eberg Sykkelpark finnes alt i poolen.

### 4.8 Opplevelser

| # | id | Spørsmål | Kilde | Opprinnelse |
|---|---|---|---|---|
| 1 | `bibliotek` | Hvor er nærmeste bibliotek? | S | begge |
| 2 | `kino` | Hvor er nærmeste kino? | S | begge |
| 3 | `kulturscene` | Hvor er nærmeste scene eller kulturhus? | S+ | begge |
| 4 | `samlingspunkt` | Hvilke møteplasser er åpne for alle? | K | begge |
| 5 | `voksenaktivitet` | Hvor kan jeg bli med på kor, kurs eller klubb? | K | begge |
| 6 | `kirke` | Hvor er nærmeste kirke eller menighetshus? | S | ny |
| 7 | `frivilligsentral` | Hvor er nærmeste frivilligsentral? | S+ | ny |
| 8 | `bowling-aktivitet` | Hvor kan vi spille bowling? | S+ | begge |
| 9 | `museum` | Hvor er nærmeste museum? | S | begge |
| 10 | `kulturskole` | Hvor går barna på kulturskole? | K | ny |

**1. `bibliotek` — Hvor er nærmeste bibliotek?** (S)  
*Hvorfor:* Enig (begge nr. 1). Gratis, for alle aldre, og det ene kulturtilbudet nesten alle adresser i landet har innen rekkevidde — det faste stedet både for barnefamilien og for den som bor alene.  
*Kilde:* POI-pool kategori library (Google-type library) + precomputet gang-/sykkeltid. Bygger: nærmeste med målt reisetid + neste; rader uten reisetid hoppes over, og enheter som ikke er utlånsbibliotek (Trøndelag fylkesbibliotek) skal ikke telle. Neste kilde ved recall-hull: Nasjonalbibliotekets Base Bibliotek.  
*Wesselsløkka:* Trondheim folkebibliotek Moholt er nærmeste bibliotek, 21 minutter til fots eller 10 med sykkel. Det er et folkebibliotek, åpent for alle, og det eneste på kartet med målt reisetid fra boligen. Åpningstider, utlån og arrangementer står på bibliotekets egne sider.

**2. `kino` — Hvor er nærmeste kino?** (S)  
*Hvorfor:* Enig; Claudes prioritet (3→2, fordi samlingspunkt og hva-skjer er K og kino er det konkrete opplevelses-spørsmålet megleren får). Astras presisering tatt inn: reisetiden skal gjelde kinoens inngang, ikke sentrum.  
*Kilde:* POI-pool kategori cinema (Google movie_theater) + precomputet gang-/sykkel-/biltid. Bygger krever målt reisetid — rader uten (KinoNor, Kosmorama) faller bort. Bussreise til kinoen er ikke målt; Entur-tallet 20/24 min i boardFacts gjelder Trondheim S og skal ikke gjenbrukes som kinotid.  
*Wesselsløkka:* Prinsen kino er nærmeste kino, 42 minutter til fots, 18 med sykkel eller 15 med bil. Det er den eneste kinoen på kartet med målt reisetid fra boligen. Program og billetter finner du på kinoens egne sider; åpningstider er ikke registrert.

**3. `kulturscene` — Hvor er nærmeste scene eller kulturhus?** (S+)  
*Hvorfor:* Slått sammen med arena (regel 5). Astras formulering fordi den dekker bruk — konserter på Spektrum og kamper på Lerkendal like godt som teater. Snevret til det kategoriene bærer: sted og reisetid, ikke program. Snevret etter verifikasjon: Ordene «konserter og forestillinger» lover program; Places-typene performing_arts_theater/concert_hall/cultural_center gir bare et sted.  
*Kilde:* Ny navngitt kilde: Google Places-typene performing_arts_theater, concert_hall og cultural_center må inn i GOOGLE_CATEGORY_MAP (lib/pipeline/poi-discovery.ts) → temaets deklarerte kategori theatre, som har ingen produsent i dag (0 i poolen). Arenaer kommer alt via stadium/sports_complex → idrett. Bygger: nærmeste scene + nærmeste arena med målt reisetid.  
*Wesselsløkka:* [VERIFISER: navn] er nærmeste scene eller kulturhus, [VERIFISER] minutter til fots eller [VERIFISER] med sykkel. Neste på kartet er [VERIFISER: navn og reisetid]. Hva som spilles der, står i arrangørens eget program; kartet viser stedet og reisen dit.

**4. `samlingspunkt` — Hvilke møteplasser er åpne for alle?** (K)  
*Hvorfor:* Slått sammen med stamsted (regel 5). Astras prioritet (3, mot Claudes 9): «hvor møtes folk her» er visningsspørsmålet på nybygg, og prosjektet vil uansett skrive det (regel 3). K fordi ingen kilde dokumenterer at folk faktisk samles et sted.  
*Kilde:* Kuratert per prosjekt/strøk i reportConfig.themes[].faq[]. Svaret skal skille eksisterende lokalsenter (Valentinlyst Senter — boardets kjopesenter-fakta og ankermedlemmene), planlagt torg (kommunens områdeplan for Brøset) og beboer-fellesrom med adgangsvilkår. Ingen standard-bygger.  
*Wesselsløkka:* Valentinlyst Senter er bydelens åpne møteplass i dag, 7 minutter til fots, med Coop Mega og Rosenborg bakeri i senteret. [VERIFISER: om områdeplanen for Brøset regulerer et torg, hvor og når]. Biblioteket på Moholt, 21 minutter unna, er åpent for alle uten kjøp.

**5. `voksenaktivitet` — Hvor kan jeg bli med på kor, kurs eller klubb?** (K)  
*Hvorfor:* Astras prioritet (2, mot Claudes 10), dempet til 6 fordi plass 1–5 er visningsspørsmålene og plass 6 er første persona-plass; aleneboeren som vil delta er personaen som ellers faller ut. K fordi et åpent tilbud med påmelding ikke står i noe register.  
*Kilde:* Kuratert: navngitt arrangør, aktivitet, øvingssted, målgruppe og vei inn, i reportConfig.themes[].faq[]. Ingen standard-bygger. Den deterministiske døra til samme behov er egen rad (frivilligsentral, nr. 7).  
*Wesselsløkka:* [VERIFISER: kor, kurs eller klubb] hos [VERIFISER: arrangør] tar imot nye deltakere; øvingene er på [VERIFISER: sted], [VERIFISER] minutter til fots. Påmelding og pris står hos arrangøren [VERIFISER]. Trondheim folkebibliotek Moholt, 21 minutter unna, har åpne arrangementer for voksne [VERIFISER: program].

**6. `kirke` — Hvor er nærmeste kirke eller menighetshus?** (S)  
*Hvorfor:* Ny (verifikatorens forslag, erstatter «hva-skjer» som overlappet `voksenaktivitet` og `samlingspunkt`). For 56-åringen alene er menigheten det vanligste faste, gratis møtestedet i Norge, og det finnes i alle kommuner.  
*Kilde:* POI-pool kategori `kirke` (finnes i temalisten) + gangtid; komplett kilde på sikt: Kirkesøk (Den norske kirke).  
*Wesselsløkka:* Nærmeste kirke på kartet er [VERIFISER — kategorien er tom i Wesselsløkka-poolen; Strinda kirke og Berg kirke er kandidater]. Menighetshusets faste tilbud (kor, formiddagstreff) skrives av prosjektet, ikke standarden.

**7. `frivilligsentral` — Hvor er nærmeste frivilligsentral?** (S+)  
*Hvorfor:* Ny fra sammenslåingen. S+ slår K på sammenlignbart behov (regel 3): frivilligsentralen er institusjonen bygd for at nye innbyggere skal bli deltakere, og den finnes i nesten alle kommuner — så standarden får en rad for Astras persona også på de 108 000 bruktboligene.  
*Kilde:* Ny navngitt kilde: Norges Frivilligsentralers register over alle sentraler med adresse (frivilligsentral.no; Kulturdirektoratets tilskuddsliste). Build-time-oppslag → boardFacts → POI med precomputet gangtid. Ingen kategori i poolen i dag. Bygger: nærmeste + neste.  
*Wesselsløkka:* Nærmeste frivilligsentral er [VERIFISER: navn], [VERIFISER] minutter til fots eller [VERIFISER] med sykkel. Sentralen står i Norges Frivilligsentralers register og er åpen for alle som vil delta eller bidra. Hva den tilbyr akkurat nå, står på sentralens egen side.

**8. `bowling-aktivitet` — Hvor kan vi spille bowling?** (S+)  
*Hvorfor:* Astras formulering (snevret): «aktivitetssenter» skjuler ulike tilbud og alderskrav. Dekker tenåringen med delt omsorg og bursdagen. Begge hadde S; den er S+ fordi kategorien ikke har noen produsent.  
*Kilde:* Ny navngitt kilde: Google Places-typen bowling_alley → temaets deklarerte kategori bowling (ingen produsent i GOOGLE_CATEGORY_MAP, 0 i poolen — søkehull, ikke fravær). Bygger: nærmeste + neste med målt reisetid.  
*Wesselsløkka:* Dere kan spille bowling hos [VERIFISER: anlegg], [VERIFISER] minutter til fots eller [VERIFISER] med sykkel. Det er nærmeste bowlinghall på kartet med målt reisetid fra boligen. Åpningstider, priser og bestilling av baner står på anleggets egne sider.

**9. `museum` — Hvor er nærmeste museum?** (S)  
*Hvorfor:* Enig; Astras prioritet (9→10): relevant for noen, sjelden hverdagsavgjørende. Svaret skal gjelde en avdeling som er åpen for publikum, ikke en administrasjonsadresse eller et stengt bygg.  
*Kilde:* POI-pool kategori museum (Google-type museum) + precomputet gang-/sykkeltid; 11 i poolen, nærmeste 33 min. Bygger: nærmeste + to neste med målt reisetid; rader uten (The Armoury) faller bort. Publikumsstatus finnes ikke i poolen.  
*Wesselsløkka:* Trondheim Kunstmuseum Gråmølna er nærmeste museum, 33 minutter til fots eller 15 med sykkel. Deretter følger Nordenfjeldske Kunstindustrimuseum, 39 minutter til fots [VERIFISER: om åpent for publikum], og Trondheim Kunstmuseum, 40 minutter til fots eller 16 med sykkel. Åpningstider og utstillinger står på museenes egne sider.

**10. `kulturskole` — Hvor går barna på kulturskole?** (K)  
*Hvorfor:* Ny fra sammenslåingen, erstatter Astras barneforestillinger (K) med en deterministisk rad for samme persona: forelderen med barn på seks og fjorten. Alle kommuner har kulturskole ved lov, så standarden kan alltid svare. Omklassifisert etter verifikasjon: «Hvor holder kulturskolen til?» leses av forelderen som «hvor skal barnet mitt gå».  
*Kilde:* Kuratert: registeret gir kommunens administrasjonsadresse (for Brøset ~40 min unna), mens undervisningen kan skje på Eberg — det er undervisningsstedet forelderen spør om.  
*Wesselsløkka:* Trondheim kommunale kulturskole gir undervisning i musikk, dans, teater og visuell kunst [VERIFISER: hvilke undervisningssteder som ligger i bydelen, f.eks. Eberg eller Blussuvoll, og reisetid]. Søknad, priser og ventetid står på kulturskolens sider.

*Reserve (ute av topp ti):* `barneforestillinger` — Astras nye K. Behovet dekkes av kulturskole (S+, ny, nr. 9), oppvekst-fritid (Barn) og regnvaersdag (Området) — regel 3: S/S+ slår K. Et prosjekt kan fortsatt skrive det på egen id senere. · `gratis-kultur` — Astras nye K. bibliotek (S, nr. 1) svarer alt gratis-behovet med data vi har; museers gratisdager og kommunale gratistilbud krever kuratering per sted. · `arena` — Slått inn i kulturscene (regel 5). Ikke egen id; arenaene kommer via stadium/sports_complex → idrett og nevnes i kulturscene-svaret. · `stamsted` — Slått inn i samlingspunkt (regel 5). Mat & drikke-id, K hos begge; «Hvor møtes nabolaget?» er dekket av samlingspunkts formulering. · `regnvaersdag` — Flyttet til Området (regel 5). Ikke i dette temaet — men byggeren der bør hente bibliotek og bowling fra Opplevelsers kategorier, så flyttingen ikke mister dem. · `amusement` — Temaets deklarerte kategori amusement (lekeland/aktivitetspark) er vurdert som eget spørsmål og forkastet: behovet dekkes av regnvaersdag på Området. Nevnes fordi kategorien står uten spørsmål og uten produsent i GOOGLE_CATEGORY_MAP. · `hva-skjer` — Tatt ut etter verifikasjon — se begrunnelse i reserve-notatet.

### 4.9 Oppsummert per klasse

| Tema | S | S+ | K |
|---|---|---|---|
| Området (startsiden) | 5 | 4 | 1 |
| Barn & oppvekst | 7 | 3 | 0 |
| Hverdagsliv | 5 | 5 | 0 |
| Mat & drikke | 5 | 5 | 0 |
| Natur & friluftsliv | 3 | 6 | 1 |
| Transport | 4 | 6 | 0 |
| Trening & aktivitet | 3 | 5 | 2 |
| Opplevelser | 4 | 3 | 3 |
| **Sum** | **36** | **37** | **7** |

Mot Claudes rapport (48 / 28 / 4) har S sunket og S+ steget. Forklaringen er ærligere klassifisering, ikke færre svar: fem åpningstids-rader er S+ til `refresh-opening-hours` ligger i pipelinen, `pizza`/`spesialbutikk-mat`/`spesialtrening` krever at Places-typer lagres (v2.pois har ingen `types`-kolonne), og `treningspark`/`bowling` har ingen produsent i pipelinen i dag.

---

## 5. Systemfunn fra verifikasjonen — fiks disse før katalogen utvides

Verifikatorene leste koden og databasen, ikke bare dokumentene. Funnene, i prioritert rekkefølge:

1. **Lesestien kapper poolen på 1 000 rader.** `lib/supabase/v2-queries.ts` (ca. linje 229) henter `project_pois` uten range; PostgREST svarer `content-range: 0-999/1615` for Wesselsløkka (verifisert 2026-09-06). 615 POI-er får ingen reisetid, og alle «nærmeste»-svar blir feil: VYDA restaurant (4 min) forsvinner bak Burger King (9), seks spisesteder ≤15 min blir to, sykkelringen på 16 steder blir tre. Treffer alle boards med over 1 000 `project_pois` og alle temaer. Fiks: paginer eller bruk `chunkIds`-mønsteret (`lib/supabase/chunk-ids.ts`) — samme feilklasse som PostgREST-`.in()`-grensen fra 2026-08.
2. **FAQ-byggerne ser ikke inn i ankrene.** `report-data.ts` linje 655–661 fjerner medlemmer av kjøpesenter-ankre før `generateCategoryFaq`. På Brøset er tre av seks spisesteder, apoteket, bakeriet og to treningssentre medlemmer av Valentinlyst Senter. Rad 1–4 i Hverdagsliv og halve Mat & drikke forutsetter fiksen.
3. **Åpningstider er ikke pipeline-data.** De skrives av `scripts/refresh-opening-hours.ts`, et manuelt månedsscript per prosjekt (COMMANDS.md 126–135). Fem katalog-rader avhenger av dem. Enten inn i provisjoneringen (`regularOpeningHours` i feltmasken er gratis når `rating` alt er Enterprise), eller radene forblir S+.
4. **Radius og terskel mangler i fire byggere.** `apentSent` (terskel 21:00 i `AREA_LATE_MIN`, ingen radius, ingen kategorifilter → «Dokkparken til midnatt»), `sondagsapent`, `kafe`, `uteliv` (svarer 21–22 min på «i nabolaget»), `trene-tidlig-sent` (ingen tidlig/sen-terskel, ingen navnefilter → «Sit 08–15.45» fra et kontor 37 min unna). `utenBil`-lista mangler bakeri/gym/barnehage/bysykkel og skal ikke ha `doctor` (kategorien inneholder gynekolog/urolog/nevrolog).
5. **`google_business_status` filtreres ikke i FAQ-stien.** Frumento er CLOSED_TEMPORARILY med trust 0,85 og ble navngitt i fire eksempler.
6. **Kategorier uten produsent.** `fitness_park`, `bowling`, `carshare` står i temalistene men har ingen mapping i `poi-discovery.ts`/`osm-gate.ts` — de kan aldri fylles. `swimming` har 4 POI-er i hele prod (Pirbadet mangler). Wesselsløkka er ikke re-provisjonert etter kategorifiksen 2026-08-12 og grocery-fiksen 2026-08-24, så «0 tannleger/0 Vinmonopol» er stale pool, ikke fravær — Valentinlyst Legesenter og Vinmonopolet Valentinlyst finnes begge på senteret.
7. **Registerimporterte POI-er mangler reisetid** (Eberg skole `nsr-979195052`, Strinda vgs). Kan delvis være 1 000-radsfeilen — verifiser etter fiks 1.
8. **`idrett` ligger i Oppvekst-temaet, ikke Trening** (`report-defaults.ts` linje 46 vs 90). `idrettsanlegg`-raden må lese `allPois` eller kategorilisten endres.
9. **Katalog-mekanikk:** `THEME_BOARD_QUESTIONS` har ingen `opplevelser`-nøkkel (temaet er globalt deaktivert); `uteservering` som FAQ-id kolliderer med per-POI-spørsmålet i restaurantmalen (derfor `sitte-ute`); v2.pois lagrer ikke Places `types`; Ranheims kuraterte `tog`-svar («Ja. …») svarer på den gamle spørsmålsteksten og må skrives om når teksten endres.
10. **Boardets `summary` og FAQ-en bruker to definisjoner av gangavstand** («95 tilbud» mot «16 steder»). Standarden bør eie tallet.

---

## 6. Avgjorte uenigheter per tema

Kort form: tema, hva striden sto om, hva som ble valgt. Full begrunnelse ligger i workflow-journalen.

**Området (startsiden)**

- *11 kandidater til 10 plasser* — «naermest» slås inn i «gangavstand» og går til reserve.
- *til-byen: Området eller Transport* — Blir på Området i kortform med lenke; «til-sentrum» i Transport i fullform.
- *rolig: K eller S+, og hvor bredt* — S+ med snevret spørsmål «Er boligen utsatt for trafikkstøy?».
- *blir-det-bygget: K eller S+* — S+ (planinnsyn) med snevret spørsmål «Er det planlagt utbygging i nærheten?».
- *gangavstand: hvilken formulering* — Astras «Hva finnes innen ti minutters gange?» (36 tegn) over Claudes «Hvor mye ligger i gangavstand?» (30).
- *hvem-bor-her: Astras nybygg-innvending* — Beholdt som S+ på plass 7 med to faste svarregler: årstall alltid vist, og setningen «tallene beskriver dagens beboere i grunnkretsen, ikke de som flytter inn».
- *tjenester-samme-sted mot Hverdagslivs kjopesenter* — Området eier medlemslisten fra anker-registeret; Hverdagslivs «kjopesenter» svarer «nærmeste + alternativ» uten å liste medlemmer.
- *uten-bil dobbeltdeklarasjon* — Hverdagsliv må slette «uten-bil» fra THEME_BOARD_QUESTIONS når Området får den.
- *apent-sent: terskel i spørsmålet* — Claudes «Er noe åpent sent på kvelden?» beholdt; Astras terskel (≥22) og 15-minuttersradius går inn i byggeren.
- *ferdig-ved-innflytting: plass 5 eller 8* — Plass 8.
- *trinnfri-hverdag: finnes en kilde?* — Reserve, med S+-sti dokumentert.
- *gangavstand-tallet og ankrene* — Eksempelet bruker boardets 16; byggeren må velge om anker-medlemmer telles separat (23) og om holdeplasser er «steder» (8 av 16).

**Barn & oppvekst**

- *`ungdomsskole-krets` (Astra, ny) vs. ett `krets`-svar (Claude)* — Slått inn i `krets`. Ingen ny id.
- *`barnehage-plass`: Claude S+ bred («Hvor lett»), Astra K snevret («Hvor sjekker jeg ledige»)* — Snevret til «Hvordan søker jeg barnehageplass her?», klasse S+.
- *`vgs-naerhet` prioritet 3 (Claude) vs. 8 (Astra) og formulering* — Astras prioritet 8 og Astras tekst.
- *`helsestasjon` klasse: S (Astra) vs. S+ (Claude)* — S+ med egen kategori.
- *`sfo`: K hos Astra og i dagens kode («Finnes det SFO?», kilde søk)* — Inn på plass 6 som S+ med Astras tekst.
- *Tiende rad: `barnefamilier` (Claude) vs. ny `skolevei-fortau`* — Ny id `skolevei-fortau` (S+ NVDB) på plass 9; `barnefamilier` i reserve.
- *`oppvekst-fritid` etter at `idrettsanlegg-barn` flyttet til Trening* — Astras korte tekst; byggeren gjøres sammensatt (idrett + fritidsklubb + bibliotek + svømmehall).
- *Elevtall i `krets`-svaret (Astra: unødvendig, uten årstall)* — Beholdt (382 elever) fordi boardet har tallet fra NSR, men flagget for årstall.
- *Claudes «Strinda vgs 21 minutter til fots» og «linje 22»* — Fjernet fra eksemplet.

**Hverdagsliv**

- *`uten-bil` ut av Hverdagsliv til Området* — Fulgt (regel 5). Ikke med i temaets ti.
- *`kjopesenter` på plass 3 (Astra) eller 6 (Claude)* — Plass 3.
- *`pakker-post` plass (Astra 4, Claude 7) og klasse* — Plass 5, klasse S+.
- *Formulering av `dagligvare-lengst-apent`* — Astras «Hvor sent kan jeg handle mat på hverdager?» (42 tegn).
- *`dagligvare-sondag` inn som ny rad (Astra)* — Inn på plass 7; holdt adskilt fra nr. 6.
- *`tannlege` plass 5 (Claude) eller 8 (Astra)* — Plass 8.
- *Plass 10: `legevakt-sykehus` (Claude) eller `sykkelverksted` (Astra)* — `legevakt-sykehus`, snevret til «Hvor er nærmeste legevakt?», klasse S+.
- *`legesenter` klasse og datakvalitet* — S med navnegate på `doctor`; Astras fastlege-forbehold inn i svarmalen.
- *Coop Mega Valentinlysts stengetid (leadText 23 vs valentinlyst.no 22)* — Ingen tall i eksempelet; [VERIFISER] på begge.
- *Leangen legesenters åpningstid i eksempelet* — Ikke brukt.
- *Astras påstand om frisør, Vinmonopol og post i butikk på Valentinlyst Senter* — Ikke tatt inn i `kjopesenter`-svaret; flagget.
- *Svarform for `hverdagshandel`* — Nærmeste + neste + antall innenfor 15 minutter + sykkeltid til senterbutikken.

**Mat & drikke**

- *Plass 2: takeaway (Astra) eller kafe (Claude)* — Astras prioritet: takeaway på 2, kafe på 3.
- *Klasse på attributt-spørsmålene (takeaway, uteservering, barnevennlig, vegetarisk)* — S+ med Google Places API (New) atmosfære-feltene som navngitt kilde — ikke K som Astra satte.
- *mat-hjemlevering som egen id* — Slått inn i takeaway (regel 4); spørsmålet utvidet til «Hvor får jeg takeaway eller mat levert?».
- *sondagsapent: spørsmålstekst og plass* — Astras snevring «Hvor kan jeg spise ute på søndag?» og plass 5; Claudes radiusfiks (15 min) inn i byggeren.
- *barnevennlig: bred (Claude) eller «barnemeny» (Astra)* — Claudes «Hvor kan vi spise ute med barna?» beholdt.
- *vegetarisk-middag: inn eller ikke, og ordlyd* — Inn på plass 9 (ny fra Astra), snevret til «Hvor kan jeg spise vegetarisk?», id beholdt som `vegetarisk-middag`.
- *kaffe-for-jobb: ut (Astra) eller inn (Claude)* — Inn på plass 10 (Claude), ikke slått inn i kafe.
- *uteliv: fallback til byen* — Når nærmeste bar er >20 min til fots, får svaret en Entur-hale og lenke til Transport `til-sentrum` — ikke til områdets `til-byen`.
- *Åpningstids-radene (sondagsapent, kaffe-for-jobb) er S, men tomme på Wesselsløkka* — Klassen holdes S; byggesteget «legg `places.regularOpeningHours` i NEARBY_FIELD_MASK» flagges som forutsetning.
- *spisesteder: kjeder som svar og «tynt»* — Astras korreksjon tatt inn: navngitte kjeder er gyldig svar; vurderende ord fjernet. Claudes sykkelring beholdt.

**Natur & friluftsliv**

- *Hundepark som svar på «nærmeste grøntområde»* — Astra har rett: `gronntomrade` ekskluderer kategori hundepark og navn med «hundepark». Spruten (12 min) blir nærmeste park på Wesselsløkka.
- *`hund`: S eller K* — S, spørsmålet snevret til «Hvor er nærmeste hundepark?».
- *`turstier`: formulering og kilde* — Astras formulering («starter»), Claudes klasse S+, men kilden byttes til Kartverkets Turrutebasen fordi boardets `reportConfig.trails` er plassholderdata.
- *`marka`: S+ eller K* — S+ med Naturbase friluftslivsområder / Trondheim kommunes markagrense som polygon, Astras formulering om inngang.
- *`lysloype-lopetur`: splitt og klasse* — Snevret til «Hvor er nærmeste lysløype?», S+ via Turrutebasens belysning-felt. Ikke splittet i to id-er.
- *`ski`: kilde* — Turrutebasen Skiløype som fakta-kilde, skisporet.no bare som lenke.
- *`akebakke`: S+ eller K* — S+ (navnetagg + OSM piste:type=sled), men med flagg.
- *Astras nye `kort-turrunde` og `tur-med-vogn`* — Begge tas inn, som S+ (Turrutebasen gradering/lengde og tilpasning), på plass 7 og 8 — ikke 2 og 5.
- *`kort-turrunde` som egen id eller foldet inn i `turstier`* — Egen id.
- *`til-fjorden`, `gront-andel`, `batliv` ut av topp ti* — Reserve, som orkestratoren bestemte.
- *Rekkefølge 1–6* — Claudes rekkefølge for 1–4, `ski` løftet til 5, `bading` til 6.

**Transport**

- *Rekkefølge til-sentrum / linjer (plass 2 og 3)* — til-sentrum på 2, linjer på 3 (Astras rekkefølge).
- *linjer: spørsmålstekst* — Astras «Hvor går bussene fra nærmeste holdeplass?».
- *frekvens: K (Astra) eller S+ (Claude)* — S+, snevret til «på hverdager», to tall (rush og kveld).
- *til-arbeidsplassene: tema, klasse og tekst* — Flyttet til Transport (regel 5), S+ med Claudes formulering «de store arbeidsplassene».
- *siste-buss: K (Astra) eller S+ (Claude)* — S+ med Astras snevring «fra sentrum».
- *sykkel-til-byen: K (Astra) eller S+ (Claude)* — S+.
- *tog: spørsmålstekst* — Astras «Hvor er nærmeste togstasjon?», id beholdt.
- *lading: avgrensning og kilde* — Astras «offentlig elbillading», Claudes S+ via NOBIL.
- *Plass 10: bysykkel (Claude) mot parkering-gjester (Astra) og til-flyplassen (Claude)* — bysykkel inn; de to andre til reserve.
- *naermeste-holdeplass: meter mot gangtid* — Svaret viser begge; tekst uendret.

**Trening & aktivitet**

- *kjeder — plass (Claude 2 mot Astra 10)* — Plass 5, siste i visningsbåndet.
- *Rekkefølge trene-tidlig-sent mot svommehall og idrettsanlegg* — svommehall 2, idrettsanlegg 3, trene-tidlig-sent 4 (begge hadde tidlig-sent på 2–3).
- *is-skoyter — klasse og formulering (Claude S+ «ishall eller skøytebane» mot Astra K «gå på skøyter»)* — S+ med Claudes formulering.
- *treningspark — formulering (Claude «utendørs treningspark» mot Astra «trene utendørs uten medlemskap»)* — Claudes formulering.
- *idrettsanlegg — formulering etter sammenslåing med idrettsanlegg-barn* — Astras «Hvor finnes baner og idrettshaller i nærheten?».
- *idrettslag — klasse (begge K)* — S+ via NIFs klubbsøk, spørsmålet snevret til «holder til i nabolaget». Orkestratoren kan overprøve.
- *gruppetrening (K, ny fra Astra) — inn eller ut, og plass* — Inn, plass 8.
- *padel-tennis — klasse (Astra STANDARD mot Claude S+)* — S+.
- *trene-tidlig-sent — byggerregel* — Rad bare ved åpning ≤06 eller stenging ≥22, radius 15 min, og bare POI-er som er treningssentre. Terskelen ≥22 (orkestrator) mot ≥23 (byggeren i dag) må avklares.
- *svommehall — Astras krav om bekreftet publikumsadgang* — Forblir S. Publikumsbading er et [VERIFISER]-felt i svaret, ikke et krav som gjør raden K.
- *kjeder-eksempel — Claude sa Sit innen 20 minutter* — Sit tatt ut av «innen 20 minutter»-lista.

**Opplevelser**

- *Tema-forutsetning: Opplevelser vises ikke på boardene i dag* — Alle ti rader forutsetter at temaet re-aktiveres og får tema-hjem — legges som forutsetning, ikke som katalogspørsmål.
- *hva-skjer: klasse (Claude S+ mot Astra K)* — K, med Claudes kortere formulering.
- *voksenaktivitet: prioritet 2 (Astra) mot 10 (Claude)* — Prioritet 6, og en ny S+-rad frivilligsentral på 7.
- *samlingspunkt: prioritet 3 (Astra) mot 9 (Claude), formulering og stamsted* — Prioritet 4, Astras formulering, absorberer stamsted.
- *kulturscene + arena: formulering og kilde* — Astras «Hvor kan jeg se konserter og forestillinger?», S+ med konkrete Places-typer.
- *bowling-aktivitet: begge sa S* — S+, Astras snevrede formulering.
- *Astras nye barneforestillinger og gratis-kultur* — Begge til reserve; kulturskole (ny S+) tar barnekultur-plassen.
- *kino: reisetid med buss* — Astra har rett — 20/24 minutter gjelder Trondheim S, ikke Prinsen.
- *museum: prioritet 6 (Claude) mot 9 (Astra)* — Astras prioritet, satt til 10.
- *Regel 5-flyttinger for dette temaet* — Fulgt uten innvending: regnvaersdag ut til Området, arena og stamsted inn.

---

## 7. Neste steg

1. Fiks § 5 punkt 1, 2, 4 og 5 (lesestien, ankrene, radius/terskel, business_status). Re-provisjonér Wesselsløkka. Kjør dumpen på nytt og re-derivér alle eksempler i § 4.
2. Legg de 80 id-ene inn i `category-specs.ts` (ny `opplevelser`-nøkkel, flyttinger etter § 2 punkt 5, nye tekster), hev test-gulvet til 10 først når byggerne for S-radene finnes.
3. Skriv byggerne for S-radene, deretter S+ i rekkefølgen: åpningstider inn i pipelinen (5 rader), Entur rutetabell (`frekvens`, `siste-buss`, `til-arbeidsplassene`), støysonekart (`rolig`), SSB grunnkrets (`hvem-bor-her`), Turrutebasen (`turstier`, `sykkelrute`, `tur-med-vogn`, `lysloype-lopetur`, `ski`).
4. Wesselsløkka-workshop med HEM: K-radene (`ferdig-ved-innflytting`, `samlingspunkt`, `voksenaktivitet`, `idrettslag`, `gruppetrening`, `akebakke`, `kulturskole`) og prosjektets egne fakta (lekeplasser og idrettsplass på feltet, torget).
5. Etter 30 dager per board: rydd på `faq_opened`.
