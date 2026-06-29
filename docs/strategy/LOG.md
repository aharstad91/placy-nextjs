# Strategi-loggbok

> Kronologisk loggbok over strategiske beslutninger, sporvalg, og forretningsmodell-endringer.
> Speiler `PROJECT-LOG.md`-mønsteret, men holder strategiske beslutninger separat fra tekniske/operasjonelle.
> Oppdateres etter strategi-sesjoner, salgs-/kunde-møter, sporvalg, prising-endringer, eller når en strategisk hypotese valideres/falsifiseres.
> Aldri slett — bare legg til. Beslutninger som superseders, markeres med peker til ny dato.

**Format per entry:**
- `## YYYY-MM-DD — <kort tittel>`
- **Beslutning:** Hva ble landet (1-3 setninger)
- **Begrunnelse:** Hvorfor (1-2 setninger)
- **Detaljer:** Lenke til strategi-dokument hvis det finnes
- **Status:** Aktiv / Supersedert <dato> / Validert / Falsifisert

---

## 2026-06-28 — Moat 2 (Innsikt) skjerpet: kontekst-konvolutt, viewport-heat maps, konsentrert-volum-validering, UX-som-instrument

**Beslutning (fortsetter 06-27-moat-tråden):** Fire grep som hever Innsikt fra «tellinger» til forsvarbar, segmentert etterspørsel. (1) **Viewport-heat maps i en privat megler-analyse-visning** (intern, ikke offentlig): kart som samler hvor folk ser/panorerer/zoomer + klikk. Vekt etter intensjon — zoom-inn + dwell > rå panorering; rute-forespørsler høyest; delta-mot-strøk > absolutte klikk. To visninger på samme strøm: per-board-dashboard (klebrighet) vs. aggregert strøk-heat map (sellbar markedsintel). (2) **Kontekst-konvolutt på HVERT event = confounding-fiksen (viktigste grep):** rått klikk lyver (skole langs Ladestien → skole-klikk i naturkontekst = turstien, ikke skolen). Hvert event bærer modus+aktive kategorier, travel_mode, time_budget, viewport, hjem-anker. **Løftet: kontekst gjør engasjement om til segmentering** (klynge kjøpere per strøk → persona-attribuert, forsvarbar anekdote). + negativ-rom og sekvens som signal; **fang maksimalt granulert, rapportér kun over volum-terskel** (aggregér opp, aldri disaggregér ned). (3) **Konsentrert volum validerer raskere enn spredt:** 100 boards i 5 strøk = 5 validerte profiler; spredt = 100 anekdoter. **«Vinn én kjede» + «volum validerer moaten» = samme trekk** (EM1 ~60 % Trondheim → konsentrert samme-strøk-volum). Ranheim-først = datavaliderings-strategi, ikke bare pilot. (4) **UX er datainnsamlings-apparatet:** signal finnes bare hvis UX fremkaller det → travel-mode-toggle må gjøres synlig/fristende; kategori-rekkefølge er både nudge og topp-prioritets-signal (logg alltid *presentert* rekkefølge i konteksten, ellers er åpne-rekkefølge-signalet confounded).

**Begrunnelse:** Granularitet er ikke bare presisjon — det er narrativ spesifisitet som overlever gransking, og det som gjør Innsikt om fra «hva er populært» til «hvem er kjøperne». Confounding (tvetydig signal) er verre enn manglende signal fordi det ser ut som innsikt.

**Detaljer:** `docs/strategy/2026-06-27-data-moatene-lokalkunnskap-innsikt.md` — seksjon «Innsikt-skjerping (2026-06-28)» + utvidet event-skjema (kontekst-konvolutt + viewport-felt).

**Status:** Aktiv — build-input til rebuild (event-skjema m/ kontekst-konvolutt + viewport-events fra board v1; UX-grep for travel-mode + kategori-rekkefølge). Åpent: hvordan adaptiv kategori-rekkefølge konkret styres uten å forurense signalet.

---

## 2026-06-27 (forts. 2) — Data-moatene navngitt + designet: Lokalkunnskap + Innsikt

**Beslutning:** De to data-moatene (identifisert som «tosidig moat» 2026-06-25) navngitt og operasjonalisert: **Moat 1 = Lokalkunnskap** (tilbud — hva som ER der), **Moat 2 = Innsikt** (etterspørsel — hva kjøpere VIL ha). Begge må bygges inn i sommer-rebuilden **fra linje 1**.

**Kjerne-design:** (1) **To lag for begge** — commodity-ingest (Lag A: kommune/Geonorge/OSM — table stakes, ikke moat) er stillas som gjør proprietær kuratering (Lag B: verifisering/innsikt/bilder/aggregert engasjement — moaten) billig. (2) **IP-realitet:** OSM (ODbL) + kommune-data (NLOD) kan ikke gjerdes inn → det ownbare er *kuratering-laget*, ikke rådataen. (3) **Lokalkunnskap:** delt strøk-indeksert `pois`-DB (ikke per-prosjekt-JSON) + kart-admin + megler-UGC-flywheel — **på desktop, ikke mobil** (korreksjon; sluttbruker-board forblir mobil); provenance/confidence/freshness som førsteklasses felt. (4) **Innsikt = mekanismen som gjør grunnpakka klebrig** (engangs → ARR): per-board engasjements-rapport. Tracking-katalog landet; rikeste signaler = **rute-forespørsler** + **«hva leter du etter»-nudge**. Personvern: anonym + aggregert (feature, ikke begrensning). (5) **Per-board analytics = ÉN sentral event-strøm sliced per `board_id`, IKKE siloer** (siloer dreper aggregat-moaten); rå-capture sanntid + batch-rapport hver X timer; strøk/skolekrets = aggregerings-aksen. (6) **Kryss-løkke:** Innsikt prioriterer hvilke Lokalkunnskap-punkter som kurateres; akkumulerings-løkka (rikere strøk → bedre board → flere meglere → mer berikelse) er den egentlige moaten. Fokus ett strøk (Ranheim) først.

**Detaljer:** `docs/strategy/2026-06-27-data-moatene-lokalkunnskap-innsikt.md` — full plan: IP-realitet, kilde-pipeline, OSM, admin, megler-UGC, provenance; Innsikt tracking-katalog (A–F m/ gull-signaler), verdi-stige, per-board-arkitektur, volum-gating, build-imperativer.

**Status:** Aktiv — navn låst, design landet, build-input til rebuild. Åpent: konkrete norske åpne-data-endepunkter (Geonorge/kommune/OSM Overpass-queries) + datamodell/admin-spec ved rebuild-start.

---

## 2026-06-27 (forts.) — Solkart/Norkart-benchmark + grunnpakke-inntektsmodell (nivå 1) + «vinn én kjede»-GTM

**Beslutning:** Samme sesjon utvidet fra premium-single til hele tier-stigen. (1) **Solkartet** på Ranheim-listingen = **Norkarts «3D Solforhold»**, *plattform-bundlet* på partners.no (ikke kjøpt per bolig): forbruker ~100 kr, per listing til megler ~0, kjede-lisens = B2B SaaS. Det er **et andre null-anker** for «interaktivt kart i annonsen» (etter boligfilm ~6–12k) og avslører to forretningsmodeller: *autonomt + plattform-bundlet + ~gratis* (= Placy nivå 1, Norkart er markedsbeviset) vs *bespoke kreativ per-listing* (= premium-single). (2) **Andreas' kjernevisjon ratifisert: Placy som fast inventar i grunnpakka på alle boliger** — volum/plattform-modell, nivå 1, «ruller og går». (3) **Norkart logget som benchmark/konkurrent + mulig plattform-partner.**

**Begrunnelse + tall:** Eiendom Norge: **108 657 bruktboliger solgt 2025** (rekord, +9,4 %, snitt 4,42M) = grunnpakke-poolen. Grunnpakke-pris anker-prises lavt (Solkart-lærdom) → **300–800/listing kjede-SaaS**, ikke 1 500 (da à la carte). Revenue = pris × distribusjon: 1 megler ~100 listings = 50–100k/år (proof); EM1 nasjonalt ~25 000 = 12,5–25M @ 500–1 000; full grunnpakke 108 657 = 54–109M. Bekrefter Markus' 100–200M-tak med hardt tall + viser trappa. **Bindende begrensning = distribusjon, ikke TAM/pris/produkt.**

**Claude-syntese (sparring):** (1) **Vinn ÉN kjede som plattform-standard** (EM1/DNB/Partners), slik Norkart vant partners.no — hele forretningen i ett møte, ikke salg til tusenvis. Wedge: «bli den neste Solkart, for hele nærområdet». Kjeden betaler allerede Norkart for Solkart → budsjettlinje + presedens finnes. (2) **To-lags modell:** nivå 1 grunnpakke (volum/ARR, ruller) + premium-single (margin, à la carte) sameksisterer. Tyngdepunkt mot Markus' volum/kjede-tese. (3) **Advarsel:** oppfattes Placy som Solkart-aktig widget → pris kollapser mot ~0; premium-single MÅ posisjoneres som bespoke redaksjonelt. (4) **De to data-moatene** (Markus 2026-06-25) må bygges inn i sommer-rebuilden **fra linje 1**: (a) lokalkunnskap som Placy-eid IP = førsteklasses delt strøk-DB (ikke per-prosjekt-JSON), (b) engasjements-instrumentering fra dag 1 (data du ikke logget finnes ikke). Commodity-geodata = widget-skjebne (Norkart); moatene = ueksproprierbar. Kobling til `[[project_summer_rebuild]]`.

**Detaljer:** `docs/strategy/2026-06-27-premium-single-bruktmarked-spor.md` seksjon 7–9 (Solkart/Norkart, grunnpakke-inntektsmodell m/ full distribusjons-trapp-tabell, to-lags syntese + GTM + de to moatene). `aktor-map.md` oppdatert med Norkart.

**Status:** Aktiv — grunnpakke/nivå-1 = volum-modellens kjerne, GTM = vinn én kjede; premium-single = margin-laget oppå. Distribusjon er flaskehalsen → forsterker verdien av kommersiell partner m/ kjede-tilgang (Aleksander/Markus) eller plattform-integrasjon. Åpent: hvilken kjede er første target for grunnpakke-avtalen.

---

## 2026-06-27 — Premium-single på bruktmarkedet = tredje rung (pris hänger på posisjonering, ikke film-anker)

**Beslutning:** Tier→segment-modellen avklart til en **3-rungs stige**: volum-megler (~1–2k) / **premium-single (topp-eiendom brukt, kuratert nærområde-board)** / utbygger (250k). Andreas reiste tesen ut fra en premium-listing (Ranheimslivegen 31 B, Ranheim, 14,99M, med dronevideo + boligfilm + megler på kamera med VO): rom for et **nivå-2 Placy for topp-eiendommer i bruktmarkedet** som gjenbruker eksisterende film + megler-VO. Fyller den orphaned cella mellom nivå 1 og utbygger, og matcher Aleksanders «25k single premium (Collins vei)»-anker. **Pris: list/anker ~19–25k (posisjonert som nærområde-intelligens), forvent validert transaksjon 12–18k.**

**Begrunnelse + viktig korreksjon (samme sesjon):** Andreas delte den faktiske videografen (Huy Rebel Production, huyrebel.com): dronefilm/dronefoto **fra 5 000,– ink. mva**, boligfilm «ta kontakt», «kombiner og få rabatt» → hele medieproduksjonen kostet realistisk **~6–12k, ikke 15–40k**. Det **falsifiserer** den første «25k ligger midt i kino-film-båndet 15–40k»-begrunnelsen, og dommen «10–15k = underprising». Korrigert bilde: to ankre drar i hver sin retning — *prod.kost-pol* (megler ser «enda et medie-tillegg» à ~5–10k/linje → tak ~10–15k) vs *verdi-pol* (200–300k totalspend, provisjon 150–225k → 15–25k mulig). Den bindende begrensningen nær sikt er **meglerens mentale anker, ikke eiendommens verdi** (Markus: megler behandler medie-tillegg som billige linjer). Å flytte megleren til kategori-anker = posisjonerings-jobb. Megler tar uansett *ingen* separat «talent-post» for video → kloning av megler-stemme har null talent-kost (friksjon = samtykke/jus).

**Claude-syntese (sparring):** (1) Premium-single = Markus' lavfrikssjons-megler-kanal × Aleksanders premium-prising. (2) **Krever ingen ny bygging** — gjenbruker eksisterende kuratert board → trekker ikke tid fra engasjement-/stats-modul + lokalkunnskap-DB. Marginen er enorm uansett (marginalkost ~null); lav input-kost presser pris*taket* via anker, ikke marginen. (3) **Gjenbruks-regel:** eksisterende video + ekte megler-VO inn direkte; kloning kun for *ny* nærområde-narrasjon. (4) **Ranheim-listing = ideelt pilot-eksemplar.** (5) **Videograf (Huy Rebel) som kanal/footage-kilde** — sitter allerede i rommet med megler/selger; kan gjenbruke film direkte eller upselge board oppå. (6) **Risikoer:** tynt segment (margin/proof), leverings-readiness (norsk-TTS, establishing-shot parkert), 3 prispunkter forsterker channel-konflikt. (7) **Disiplin:** ikke et nytt spor — samme megler, samme motor, tredje pris; SKU å validere i august.

**Detaljer:** `docs/strategy/2026-06-27-premium-single-bruktmarked-spor.md` — korrigert kostnadsstack (Huy Rebel-priser), to-pol-pris-analyse, Ranheim-pilot, videograf-kanal, risikoer, 5 neste steg, kilder. `aktor-map.md` oppdatert med premium-single-rung + Ranheimslivegen-listing + Huy Rebel.

**Status:** Aktiv — tredje rung ratifisert, pris-tallet åpent (anker 19–25k, forvent 12–18k), avgjøres av august-pilot. Komplementær til 2026-06-25 + 2026-06-23. Åpent: hvilken megler/listing blir første betalte premium-single, og det skarpe «hvorfor 25k her vs 1k der»-channel-svaret.

---

## 2026-06-25 — Markus: bruktmegler-først som motvekt til utbygger-først + mulig partner nr. 2 (Bergen)

**Beslutning:** Markus (forretningsutvikler, Bergen-basert, brainstormet Placy Reels 2026-05-24) så samme demo som Aleksander og leverte **motsatt segment-anbefaling**: led med *vanlige bruktmeglere* (annenhåndsmarkedet), ikke utbyggere. Begrunnelse: utbygger = engangskunde + org-salg + seigt; megler har full myndighet (lavthengende frukt), 85–90 % av volumet er bruktbolig (motsyklisk), og megleren har et *større, mer konkret* behov (konkurrerer mot 50 annonser/uke, må spille på nærområdet). Prismekanisme: per boenhet (~790–1 500/2 000). Ingen beslutning hard-ratifisert — treffer den åpne segment-underbeslutningen fra 2026-06-23.

**Begrunnelse:** Dette er nettopp motforestillingen Claude flagget mot Aleksander (utbygger-først er konjunkturavhengig; bør være sekvens, ikke enten/eller) — nå fra en uavhengig kilde. To-av-to forretningsutviklere lener seg inn i Placy. Markus åpnet døra mykt for samarbeid med Bergen som naturlig by nr. 2 (han bor der, siterte samme bruktbolig-tall som Trondheim).

**Claude-syntese (sparring):** (1) **Tier → segment:** nivå 1 (autonomt) → bruktmegler; nivå 2 (kuratert, 50t) → utbygger. Begge rådgivere sa nivåene server to behov og kan sameksistere — uenigheten er om *rekkefølgen*. (2) **Anbefalt: led med megler (Markus), kjør utbygger parallelt (Aleksander, august)** — treffer den bindende usikkerheten (kald → første validerte betaling), bruker en varm kontakt (Christian), og megler-data *mater* utbygger-pitchen. (3) **Ny moat-akse: lokalkunnskap som Placy-eid IP** (volleyballbane/taxi-holdeplass «ikke på Google») → tosidig moat sammen med engasjements-data; må eies av Placy, ikke megleren (term sheet-sak). (4) **Engasjements-/innsikts-modul nå trippel-bekreftet** (Markus + Claude + Andreas selv) = eneste build på kritisk sti. (5) **To-av-to validerer tesen, ikke betalingsviljen** — grunn til å kjøre testen, ikke bevis på å bestå. (6) **Channel-konflikt uløst:** per-enhet vs per-prosjekt på overlappende meglerteam. (7) **To partnere hever kravet til struktur** (pris/framing-eierskap, cap table, revenue-def).

**Detaljer:** `docs/strategy/2026-06-25-markus-bruktmegler-vs-utbygger.md` — full segment-sammenligning (Markus vs Aleksander), moat, data-USP, Bergen-aksen, tier→segment-syntese, prising, UX-funn, konsekvens for Aleksander-term sheet, 5 neste steg + 3 åpne spørsmål. `aktor-map.md` oppdatert med Markus + Christian (EM1 secondhand) / Frank Robert som pilot-targets.

**Status:** Aktiv — segment-rekkefølge anbefalt (megler først), ikke hard-ratifisert (venter til august). Komplementær til, ikke supersedering av, 2026-06-23. Åpne spørsmål: (a) inviteres Markus inn som partner nr. 2 (Bergen) eller holdes som rådgiver? (b) første betalte pilot-megler — Christian eller Frank Robert? (c) skal Claude skrive 1-siders nivå-1-megler-spec til august?

---

## 2026-06-23 — Aleksander tilbyr kommersialiseringspartnerskap + utbygger som spydspiss (eiendomssporet)

**Beslutning:** Aleksander (forretningsutvikler, jobbet med Andreas i mange år) tilbød å gjøre kommersialiseringsjobben på eiendomssporet — kjøre utbygger-møter sammen med Andreas, strukturert som **no cure, no pay → opsjon til å kjøpe eierandel ved en revenue-milestone (foreslått ~500k)**. Andreas positiv. Innen eiendom anbefalte Aleksander **utbyggere som spydspiss** (høy margin, korte beslutningsveier, «bevisst behovet», prosjektet bærer seg raskt) fremfor megler-/per-genererings-massen (lav margin, salgsintensivt, høy kommersiell tilretteleggingskost). Andreas heller mot denne retningen.

**Begrunnelse:** Andreas har eksplisitt behov for en spisset, resultatsulten kommersiell medspiller (Kona/Claude dekker ikke det). Utbygger-først skjerper kjede-først-retningen og tvinger fokus mot Andreas' egen navngitte risiko («jeg jager hele tiden uten å treffe ett område 100%»). Priser nevnt (25k single premium, 250k/24 mnd utbygger + 50t klargjøring) bekrefter prisgrunnlaget fra 2026-02-01.

**Claude-innspill (sparring):** (1) Partnerskaps-strukturen er det eneste semi-irreversible — få andel %, kjøps-pris/verdsettelse og «revenue»-definisjon ned som term sheet før møtene. (2) Utbygger-først bør være en *sekvens*, ikke enten/eller — nybygg er konjunkturavhengig (Aleksander sa selv «nybygg sliter»), masse/bruktbolig er motsyklisk → utbygger for margin/proof, kjede/masse for volum senere. (3) Dropp «beskjedent supplement»-språket i salgsrommet (prisanker-dreper + forsterker underprising) — bruk Champions League / kontekstlag-vs-Marketer-posisjonering. (4) Pris av verdi/alternativkost, ikke av egen ~null marginalkost (margin-historie ≠ pris-historie). (5) Dra aggregert engasjements-statistikk per prosjekt FREM som differensiator (moat + løser engangssalg-vs-ARR). Turisme-aksen holdes parkert (hotell-først står, jf. 2026-05-06).

**Detaljer:** `docs/strategy/2026-06-23-aleksander-kommersialisering-utbygger-spor.md` — full segmentering (partner, segment, posisjonering, pris, GTM, data-USP, turisme, tech, founder-kontekst), 5 neste steg, 2 åpne spørsmål. `aktor-map.md` oppdatert med Aleksander + utbygger-prospekter (Koteng, Brøseth/Trym, Sunnland) og EM1-/Megler1-kontakter.

**Tillegg (samme sesjon — verifisert mot diarisert transkript `~/Desktop/placy-synk-aleks-ny.json`):** (1) **Alt er kaldt** — Andreas: «bare prat, ingen validering fra kunder enda» → bindende usikkerhet = betalingsvilje, ikke segment/pris/tilbud/tilgang. (2) **Ekspert- ≠ markedsvalidering:** hele den kommersielle ryggraden (segment, begge prisene, ARR-taket, posisjonering, partnerskapsstruktur) kom fra Aleks uoppfordret etter én demo → de-risker *tesen*, ikke *etterspørselen*; ikke coast på hans konviksjon. (3) **Realisme 2026 (Claude-judgment):** fullt 250k-salg signert ~25–35 %, to salg ~10–15 %, første betalte «ja» (uansett størrelse) ~60–70 % → reframet 2026-mål = *fra kald til første validerte betaling* + pipeline, ikke 250k-close; de-risk via betalt pilot m/ forhåndsavtalt opptrapping (anker høyt, forplikt smått); 2×250k = 500k = Aleks' opsjons-trigger. (4) **Partnerskap = kommersiell hjerne, ikke selger** → opsjonen kjøper GTM-IP + key-person-risiko + Andreas må eie tesen selv; primærverdi = fokus, ikke nettverk. (5) **Pris-frame per person:** «supplement» (Andreas) vs «Champions League/stå i prisen» (Aleks) → avtal at Aleks eier pris/framing i rommet. (6) **Diagnose: 500 t produkt / ~0 t kommersialisering** → atferdsrisiko = retrett til produktbygging; eneste build på kritisk sti = stats-/engasjementsmodul.

**Status:** Aktiv — intensjon om partnerskap landet, struktur ikke konkretisert. Åpne underbeslutninger: (1) partnerskaps-term sheet (andel/pris/revenue-def), (2) første utbygger-target (Koteng / Brøseth-Trym / Sunnland), (3) utbygger-spec («hva får du for 250k»). Hard-ratifisering av utbygger-først venter på disse. Tilbud fra Claude (ikke startet): håndtrykk-notat (samarbeids-ramme) + discovery/pilot-tilbud-skisse.

---

## 2026-06-03 — Innsikt: «nærområde» er bransjens vinnerterm for lokasjon (copy/posisjonering)

**Innsikt:** EiendomsMegler 1 (landets største meglerkjede) bruker «nærområde» som sentralt begrep i sin nasjonale selger-kampanje: *«Selge bolig? Vi kjenner ditt nærområde, vår erfaring er din fordel.»* Av synonymene **beliggenhet / nabolag / nærområde / område** ser **«nærområde»** ut til å treffe best i bransje-copy — det signaliserer lokalkunnskap og nærhet uten å være så klinisk som «beliggenhet» eller så avgrenset som «nabolag».

**Konsekvens for Placy:** Report er nettopp et nærområde-produkt (kontekstlaget rundt boligen — det Marketer/HomeKey er tynne på, jf. entry 2026-06-02). Vi bør lene oss på **«nærområde»** i copy/pitch mot meglere og i selve rapport-boardet (overskrifter, splash-tekst, seksjons-labels) fremfor «beliggenhet»/«nabolag». Aligner Placys språk med det markedslederen allerede har normalisert hos kjøper/selger.

**Detaljer:** Observert i EiendomsMegler 1-display-annonse (selger-funnel). Ingen egen sesjons-doc — copy-signal, ikke beslutning. Relatert: konkurranse-/kontekstlag-posisjoneringen i 2026-06-02 Marketer/HomeKey-entry.

**Status:** Innsikt — informerer copy/posisjonering på eiendomssporet. Ikke validert i egen test.

---

## 2026-06-02 — Marketer/HomeKey kartlagt som konkurrent/benchmark

**Beslutning:** Marketer Real Estate Technologies (Oslo, 2016, ~68 ansatte, ~$26,9M reist, ~32 % NO-markedsandel nybygg, rebrander til HomeKey.ai / M360-plattform) kartlagt som proptech-aktøren bak Stasjonskvartalets boligvelger + 3D-flythrough-intro. Posisjonering landet: **ikke konkurrér på transaksjonslaget** (boligvelger/annonser/CRM — de har skala + kapital), **konkurrér/komplementér på kontekstlaget** (lokasjons-/nabolagsintelligens via Report) der de er tynne. Marketer er potensiell distribusjons-partner (Placy som innholdslag inni deres boligvelger) ELLER fremtidig konkurrent hvis de utvider inn i område-innhold.

**Begrunnelse:** Stasjonskvartalet (klient vi jobber med) har kjøpt en Marketer-leveranse — synlig på `stasjonskvartalet.no/boligvelger`. Flythrough-videoen deres (3D-bymodell + prosjektets arkitekt-modell plassert inn + waypoint-kamera) er nettopp det rapport-boardet vårt gjør *live* på ekte Google-fotogrammetri. Det gir både en teknisk benchmark og et klart bilde av hvor Placy IKKE bør slåss head-on. Antatt prising: flythrough alene ~20–60k NOK, full kampanje 6–7-sifret — vs. Placys ~120 kr for hele image-to-video-showcasen (unit-economics-argument).

**Detaljer:** `docs/strategy/2026-06-02-marketer-homekey-konkurrent.md` — full profil, leveranse-teknikk, pris-estimat, differensiering (transaksjonslag vs kontekstlag), partner-vs-konkurrent.

**Status:** Aktiv — konkurrent-intel, ikke kontakt. Åpent: bekreft Stasjonskvartalets utbygger + DNBs rolle; vurder partner-tilnærming til Marketer/HomeKey.

---

## 2026-06-02 — Megler-stemme-kloning som personaliserings- og avtale-spak

**Beslutning:** ElevenLabs voice cloning anerkjennes som fremtidig grep med to dokumenterte bruk: (a) **per-megler personalisering** — gjenskap meglerens egen stemme så Rapport/Reels/audio-tour høres ut som *deres* megler, tilbudt som premium-oppgradering; (b) **dialekt-stemme som kjede-avtale-spak** — en lokal dialekt-husstemme (f.eks. trønder) som komponent i en meglerkjede-avtale. Default forblir nøytral husstemme ("Erik"); kloning er oppside-akse, ikke MVP-krav. Endrer ikke prioriteringen i 2026-05-06-beslutningen.

**Begrunnelse:** Teknisk nesten gratis å innføre — pipelinen tar allerede `voiceId` som parameter, så en klone er en konfig-akse, ikke en ombygging. Personlig megler-stemme er differensiator mot statiske områdesider i boligkjøper-segmentet; lokal dialekt-stemme er et eksklusivt, lavmarginalkost-salgsargument *til* en kjede og autentisitet *til* deres kunder. To veier i ElevenLabs: IVC (1–2 min opptak, few-shot) for spike/demo, PVC (30 min–3 t, fine-tuner) for produkt.

**Avlastet:** Ikke et aktivt spor — hotell-prioritet står. Per-megler-onboarding (opptaks-/klone-rutine) og self-serve er separate utviklings-fasespørsmål, ikke MVP. Samtykke-/opphørs-flyt for navngitt stemme er uløst og blokkerer ekstern pilot. Emosjonell respons (tillitsbyggende vs. creepy) er udokumentert og må valideres.

**Detaljer:** `docs/strategy/2026-06-02-megler-stemme-kloning-spor.md` — IVC vs PVC-sammenligning, de to grepene utdypet, samtykke/jus/opphør, risici, neste steg.

**Status:** Hypotese — ikke validert. Neste konkrete trinn: IVC-spike (én megler, ~2 min opptak, swap `voiceId` i ett Reels-spor, lytt) før PVC-investering.

---

## 2026-05-24 — Placy Reels lansert som tverr-sporvalg-asset

**Beslutning:** SOME-video-konseptet brainstormet med Markus får navnet **Placy Reels** og defineres som funnel-asset for ALLE Placy-produkter (Explorer/Guide/Report), ikke et separat produkt. Tech-spike validert (Veo 3.0 fast + ElevenLabs Erik + ffmpeg single-pass) med Stasjonskvartalet-pilot, per-video variabel kost ~$1-3. Reels bakes inn i eksisterende pilot-pakker som tilleggs-verdi (hotell-pilot 1490/mnd får Explorer + Reels, ikke prising-separasjon i fase 1). Pipelinen designes cross-vertical fra dag 1 (bolig + hotell + event + cruise + DMO) selv om aktive spor per LOG.md-beslutning 2026-05-06 forblir uendret (hotell først, cruise til fase 3).

**Begrunnelse:** Reels er strategisk hevarm med liten downside: gratis komposisjons-lag (ffmpeg), nesten-gratis variabel kost, men forsterker salgsargumentet i hvert eksisterende spor med en konkret SOME-distribuerbar asset som målgrupper faktisk ser. Hotell-spor: pre-arrival excitement vs. lobby-QR. Event-spor: ferdig markedsføringsverktøy til arrangør, ikke bare Placy-link. Megler-spor: SOME-funnel inn til Rapport. Cross-vertical-design fra start unngår teknisk gjeld når cruise/DMO-faser åpner. Markus' "voice over er gull på mobile flater" + tech-spike-resultat ("haha dette er veldig bra!") gir produkt-konfidens.

**Avlastet:** Reels endrer ikke prioriteringen i 2026-05-06-beslutningen. Det erstatter ikke profesjonelle visningsvideoer for premium-prosjekter. Det krever ikke separat GTM i fase 1. Self-serve-UI for meglere (Propr-skalering) er separat utviklings-faseproblem, ikke MVP. End-card-design er kjent gap som må lukkes før ekstern demo. Varemerke-verifikasjon av "Reels" mot Meta er åpent punkt med plan B-navn (Placy Stories/Teaser/Snippets).

**Detaljer:**
- `docs/brainstorms/2026-05-24-placy-reels-brainstorm.md` — produkt-konseptet (navn, formål, målgrupper, MVP, tech-pipeline, åpne spørsmål)
- `docs/strategy/2026-05-24-placy-reels-cross-vertical.md` — strategisk plassering (hvordan Reels forsterker hvert eksisterende spor, prising-bake-inn, cruise-design-from-day-1)
- `PROJECT-LOG.md` 2026-05-24 — tech-spike-verifikasjon

**Status:** Aktiv — neste konkrete trinn er (1) SOME-best-practice-research for short-form lokasjons-marketing, (2) alternativ manus-versjon for Stasjonskvartalet (A/B-grunnlag), (3) polert end-card-design før kunde-demo, (4) demo i pågående megler-samtaler + bake inn i hotell-pilot-pitch når VT-intro materialiserer.

---

## 2026-05-08 — Fellesmail sendt til Kulturnatt/Midtbyen Mgmt/VT-trio

**Beslutning:** Fellesmail sendt til Nanna Berntsen (Kulturnatt), Sissel Piene (Midtbyen Management) og Kari Aarnes (Visit Trondheim) som oppfølging fra introduksjonsmøtet 2026-05-06. Subject: *"Takk for møtet — her er Kulturnatt-prototypen"*. Innhold: takk + kort oppsummering av møtepunkter (TRD Events som levende feed, multi-nettsted-arkitektur, næring på midtbyen.no) + Kulturnatt-prototype-URL + flag-løfte om dedikert mail til Kari. Myk CTA (*"tar gjerne en runde to når dere har snakket internt"*). Bevisst ingen pris/pitch — strukturert som hold-varm.

**Begrunnelse:** Sissel ba i møtet eksplisitt om at Andreas sender oppfølgings-info til Sissel + Kari (talegjenkjent som "Cicero og Karesan", korrigert 2026-05-08). Mailen leverer på den asken og holder Nanna varm mens hun er i intern prat. Bevisst ingen ide-liste eller produktforslag — det ville flyttet mailen fra hold-varm til pitch og presset mottakerne til å reagere på Andreas' agenda istedenfor å lande egen prioritering.

**Detaljer:** `docs/strategy/2026-05-06-events-spor-trondheim.md` — sesjons-dokument fra møtet, inneholder versjon C-formulering og topp 3 hotell-prospects. `aktor-map.md` oppdatert med send-status for alle tre mottakere.

**Status:** Aktiv — venter på respons. Neste konkrete trinn: dedikert versjon C-mail til Kari (hotell-pilot + felles møte med Susanne på Convention Bureau).

---

## 2026-05-06 (kveld 2) — Hotell-fokus først, performance pilot, cruise/Hurtigruten parkert

**Beslutning:** Hotell er primært gå-til-marked-spor for events/turist-pitchen. Topp 3 prospects: Britannia, Nidaros Pilegrimsgård, Scandic Nidelven. Visit Trondheim (Kari Aarnes) brukes som intro-mekanisme — versjon C-formulering: *"vi tilbyr 30-60 dagers gratis pilot for 2-3 Trondheim-hoteller før sommer-sesongen, måler engagement, leverer case study du kan bruke i medlemsrapport — hvilke hoteller har mest nytte? Kan du sende intro?"* Performance pilot-modell: 30 dagers gratis + promosjons-forpliktelse fra hotellet + pre-avtalt konverterings-terskel + tidsbegrenset eksklusivitet → 1 490/mnd × 12 mnd ved suksess. Cruise-spor (Hurtigruten Group + Havila Voyages som pilot-by-skalering) **parkert til fase 3** — etter hotell-pilot har levert case study.

**Begrunnelse:** Hoteller er stasjonære (forutsigbar salgssyklus, fast lobby for QR, samme markedssjef over tid), VT er medlemsorganisasjon for dem (lavt friksjon for varm intro), gjentatte gjester gir tidsserie-data vs. cruise som er punktdata. Eksisterende fundament: pricing finnes, Scandic-demo finnes, 17 hoteller listet i kundeprospekter. Cruise har større skalerings-potensiale (Hurtigruten 32 havner, Havila 14, pilot-by-modell elegant) men krever hotell-case study først for troverdighet, flerspråklig produkt (norsk + engelsk + tysk minimum), og lengre salgssyklus. Solo-Andreas kan ikke seriøst forfølge begge spor parallelt.

**Avlastet:** Karis QR-utsagn fra møtet ("alle hoteller, cruise, Værnes, flybuss bør ha QR-kode") dekomprimert til 30+ separate salg, ikke ett bredt prosjekt. VT er anbefalingspartner / trust-signal, ikke betalende kunde eller gateway. Avinor (Værnes) og AtB (flybuss) parkert pga. offentlig anskaffelse-treghet. Butikker via Midtbyen Management er sekundært (lav pris-tolleranse for individuelt salg).

**Detaljer:** `docs/strategy/2026-05-06-events-spor-trondheim.md` — oppdatert med diskusjons-seksjon "Sesjon 2026-05-06 kveld 2" som inneholder QR-distribusjons-analyse, pilot-by-modell-vurdering (parkert), performance pilot-struktur, og topp prospects med inngangsvinkler.

**Status:** Aktiv — neste konkrete trinn er VT-intro-mail til Kari + 1-siders pilot-pakke. Tre åpne underbeslutninger: (1) konverterings-terskel-modell (låste tall / subjektiv / hybrid), (2) parallell vs sekvensiell pitch til 3 hoteller, (3) pris-justering etter pilot-data (holde 1 490/mnd eller revurdere).

**Lukker tidligere åpne tema:** S1 (hvem blir første pilot) → hotell, S2 (VT som kunde vs partner) → partner/intro-mekanisme, S4 (cruise/turist-segment) → parkert til fase 3.

---

## 2026-05-06 (kveld) — Strategi-arbeid formalisert som eget spor (business-logg)

**Beslutning:** `docs/strategy/`-mappa opprettet for forretnings- og produktstrategi-dokumenter, separert fra `docs/brainstorms/` (tekniske feature-brainstorms) og `PROJECT-LOG.md` (worklog). Mappa inneholder:
- `LOG.md` — kronologisk strategi-loggbok som speiler `PROJECT-LOG.md`-mønsteret
- `aktor-map.md` — levende kontaktdatabase på tvers av spor (events, eiendom, hotell)
- `YYYY-MM-DD-<topic>-spor.md` — datert sesjons-dokument per stort strategisk møte/diskusjon
- `README.md` — beskriver mappa og konvensjon

CLAUDE.md oppdatert med:
- Tabell-rad for `docs/strategy/` som "business-logg" (parallell til "worklog" for `PROJECT-LOG.md`)
- Trigger-fraser: "sjekk strategien" / "sjekk business-loggen" → strategi-mappa, "sjekk loggen" / "sjekk worklogen" → PROJECT-LOG
- Implicit-trigger-regel: ved tema om strategi/kunder/prising/forretningsmodell skal `docs/strategy/` leses *før* råd gis
- Auto-prompt ved sesjon-slutt: ja/nei-spørsmål om loggføring både i business-logg og worklog

**Begrunnelse:** Strategi-beslutninger (sporvalg, kunder, prising, distribusjon) ble tidligere blandet inn i `PROJECT-LOG.md` eller fanget i feature-brainstorms (f.eks. Propr-piloten 2026-04-30 og pricing-grunnlaget 2026-02-01). Det gjorde kronologisk overblikk vanskelig og risikerte at fremtidige sesjoner gjentok eller motsa beslutninger som allerede var tatt. Andreas pekte selv på at "vi har worklog som loggfører det vi gjør — vi burde ha noe lignende for det mer strategiske".

**Detaljer:** `docs/strategy/README.md` (struktur og konvensjon), `docs/strategy/LOG.md` (denne filen), `docs/strategy/aktor-map.md` (kontaktdatabase), `CLAUDE.md` (trigger-fraser og auto-prompt-regel).

**Status:** Aktiv — første sesjon som tester konvensjonen er 2026-05-06 events-spor. Verifiseres ved bruk i kommende sesjoner; juster om noe friksjon dukker opp.

---

## 2026-05-06 — Events-spor åpnet parallelt med Propr-piloten

**Beslutning:** Event-spor (Kulturnatt Trondheim, Midtbyen Management, Visit Trondheim) kjøres parallelt med Propr-piloten på eiendomssporet. Ingen pivot — eksplisitt arbeidsdeling med begge spor i live.

**Begrunnelse:** Introduksjonsmøte 2026-05-06 ga sterkt event-momentum (Nanna Berntsen / Kulturnatt + Sissel Piene / MM + Kari Aarnes / VT). Propr-piloten er ferskt besluttet (6 dager) og ikke testet — for tidlig å pivotere. Events-momentum vil avta hvis ikke fulgt opp innen uker.

**Detaljer:** `docs/strategy/2026-05-06-events-spor-trondheim.md` — 5 hovedinnsikter, 18 åpne tema, people-map.

**Status:** Aktiv — krever konkret arbeidsdeling per uke (åpent tema S5/O2).

---

## 2026-04-30 — Propr som første distribusjonspartner (eiendomssporet)

**Beslutning:** Propr (selvbetjent boligsalg-plattform) er første distribusjonspartner for Placy rapport-board. Vis-don't-tell-åpning: Spro Havn-rapport genereres og sendes til Kjetil Eriksson (CEO) eller Karoline Gjersvik (driftssjef). Manuell pipeline i pilot-fasen — /bestill-skjema utsettes til ~10+ ukentlige bestillinger er reelt.

**Begrunnelse:** Propr har 16 990 listinger 2016-2026 (~1 700/år), svak "Nabolag"-seksjon, og ledelse med Sem & Johnsen-bakgrunn (warm-intro-bro til premium-segmentet). Markedsutvikler-sparring reframet eiendomsmeglere som distribusjonskanal, ikke sluttbruker.

**Detaljer:** `docs/brainstorms/2026-04-30-propr-distribusjons-pilot-brainstorm.md` — fire ikke-forhandlerbare avtalevilkår, suksess-kriterier (30/60/90 dager).

**Status:** Aktiv — Spro Havn-rapport ikke generert/sendt enda per 2026-05-06.

---

## 2026-02-01 — Forretningsmodell-grunnlag etablert (Explorer/Guide/Report)

**Beslutning:** Tre produkter med tre prismodeller:
- Explorer: 1 490 kr/mnd flat (per hotell/lokasjon)
- Guide (nå "Trip"): tier 990 / 1 990 / 3 999 kr/mnd
- Report: 25-35 000 kr per prosjekt
- Tablet: +599 kr/mnd tillegg

Volumtrapp på kjedeforhandling (-20% / -30% / -35% over 11 / 31 / 61 hoteller). Ingen markedseksklusivitet, kun innholdseksklusivitet som premium.

**Begrunnelse:** Markedsanalyse på ~1 200 hoteller / ~80 000 rom i Norge. Konkurranseanalyse mot Schibsted Partnerstudio (52 500+ kr/artikkel) gir Report-prising. Tier-modellen for Guide gir naturlig vekststige.

**Detaljer:** `docs/brainstorms/2026-02-01-placy-pricing-business-model-brainstorm.md` — fullstendig markedsmatrise, kjedeforhandlings-strategier, Report som leadgen.

**Status:** Aktiv som referansegrunnlag, men **ikke validert i marked** (pre-revenue per 2026-05-06). Event-prising og distribusjonsmodell mot VT-nettverket er åpne tema som ikke er dekket av denne modellen.

---

## Konvensjon for endringer

- **Ny strategisk beslutning**: Legg til ny `## YYYY-MM-DD — <tittel>`-blokk på toppen.
- **Beslutning superseders**: La gammel entry stå, men legg til linje under "Status:" → `Supersedert <dato> — se <ny entry>`.
- **Beslutning falsifiseres** (hypotese ikke holdt): Endre Status til `Falsifisert <dato>` med kort forklaring. Ikke slett.
- **Beslutning valideres** (hypotese bekreftet): Endre Status til `Validert <dato>`.
- **Detalj-lenker** skal være repo-relative (eks. `docs/strategy/...`), aldri absolutte.
