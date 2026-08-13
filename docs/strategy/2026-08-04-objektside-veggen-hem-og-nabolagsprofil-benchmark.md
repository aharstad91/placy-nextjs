# Objektside-veggen, HEM som embed-kandidat, og benchmarken mot FINN Nabolagsprofil

**Dato:** 2026-08-04
**Type:** Strategi + teknisk due diligence (distribusjon / plattform-eierskap / konkurrent-benchmark)
**Deltakere:** Andreas + Claude
**Utløser:** Andreas ba om å definere **produktet og flyten** en megler faktisk gjennomfører, og stilte det avgjørende spørsmålet: *«vil de få inn dette på siden til eiendomsmegler1? vil en iframe kunne legges inn noe plass mon tro? eller må det faktisk utvikling til — det er en stor utfordring i så fall.»*

**Status:** Aktiv. **Spørsmålet er besvart, og svaret er nei for EM1.** Interaktivt Placy-innhold kan ikke legges på `eiendomsmegler1.no`s objektsider uten at plattform-eier bygger det. Konsekvensen er ikke at sporet dør, men at **kontor-piloten kjøper bevis + dør, ikke distribusjon** — og at **Heimdal Eiendomsmegling (hem.no) er den eneste identifiserte kandidaten som kan bestemme seg for en embed alene.** Bygger på `2026-08-04-em1-grilstadporten-kontor-pilot.md` (kontor-piloten), `2026-07-09-megler-system-distribusjons-wedge.md` (system-wedgen — korrigeres her på to punkter), `2026-06-27-premium-single-bruktmarked-spor.md` §7–9 (grunnpakke + widget-fellen).

---

## 1. Veggen: objektsiden rendrer ikke tredjeparts-innhold

Verifisert på DOM-nivå i **153 cachede EM1-annonsesider** (samme datasett som §2a i kontor-pilot-doccen):

| Test | Resultat |
|---|---|
| `<iframe>` i annonsesidene | **0** |
| `dangerouslySetInnerHTML` / `__html` | **0** — ingen felt rendrer rå HTML |
| Tagger som overlever fra meglerens tekstfelt | `<li>` `<ul>` `<br>` `<strong>` — og ingenting annet |
| `<a>`-elementer inne i tekstblokkene | **0** |
| URL-er som ligger som **død klartekst** i de samme blokkene | **108** (regjeringen.no, klarefinans.no, nbbl.no) |

Den siste raden er beviset: meglerne og standardtekstene limer alt inn URL-er i prosa, og de blir **ikke klikkbare**. Det finnes en markup-pipeline (meglerne skriver `<b>` og `<li>`, og det blir ekte DOM-elementer — se Mads Larsens Lilleby-annonse der punktet «Se video.» er skrevet som `<li>Se video.`), men whitelisten er ren tekstformatering. Overlever ikke en anker-tag, overlever ikke en iframe.

**Hvem eier flaten — to navn, og ingen av dem er et kontor:**

- **Nettstedet:** hele siden bruker `ffe-*`-klasser = SpareBank 1s **Felles Front End**-designsystem. `eiendomsmegler1.no` er en SpareBank 1-plattform delt av alle 12 regionselskapene. Et kontor kan ikke shippe noe; EM1 Midt-Norge sannsynligvis ikke alene heller.
- **Fagsystemet:** objektet lever i **Webtop Solutions** — `em1.webtopsolutions.com/flow/api/Public/Cases/<guid>/…`, bud og visningspåmelding på `…/tide/`. Webtop ble del av **Visma Real Estate** i 2021 (norsk system: Stream).

**Det ene arbitrære URL-feltet:** `videos[].url` (+ `virtualViewings[].url`). 5 av 153 annonser bruker det, med tre ulike URL-former (`player.vimeo.com/video/…`, bar `vimeo.com/<id>?share=copy`, `youtube.com/shorts/…`) — altså et fritt felt megleren fyller. Nesten sikkert host-whitelistet for player-konvertering, men det er **den minste tenkelige dev-asken: én host i en whitelist, ikke en ny komponent.**

**Uverifisert:** responsheaderne deres. Skulle de en dag rendre en iframe, må CSP-en slippe `frame-src` til Placys domene — en andre dev-post hos dem.

---

## 2. Salgsoppgaven er en PDF, ikke en flate

Håpet om en dyp, megler-kontrollert HTML-flate er sjekket og avvist. `em1.webtopsolutions.com/flow/api/Public/Cases/<guid>/Files/<fileguid>` svarer:

```
content-type: application/pdf
content-disposition: inline; filename=Salgsoppgave - Østmovegen 6 D.pdf.pdf
```

Ingen embed, ingen interaktivitet. Og den arver mobil-problemet i §3: en QR i PDF-en funker når arket er printet, men leses PDF-en på telefonen kan du ikke skanne den. En klikkbar hyperlenke får megleren ikke inn — PDF-en bygges av Webtop fra case-data, og en bar URL i et prosafelt blir tekst.

---

## 3. QR er en fysisk-verden-affordanse — og karusellens produkt er innhold, ikke en peker

Andreas' innvending, som er riktig: *«hvordan vil UX være å faktisk få åpnet en QR-kode når en selv sitter på en mobil via finn.no?»*

Du kan ikke skanne din egen skjerm. Utveiene finnes men er ekspert-atferd (Android: «Circle to Search» langtrykk hjem; iOS: skjermbilde → Bilder → Live Text). Tre-fire steg midt i en skroll. **QR hører til prospektet i hånda på visningen, plakat i vinduet, skilt på gjerdet, storskjerm på kontoret — ikke i annonsen.**

**Karusellen vil ha nabolagskartet, ikke en lenke til det.** Slot'en godtar ikke-foto (plantegning er standard, og EM1 rendrer alt et Google statisk kart-bilde i «Kart»-seksjonen), og **hvert bilde har et `caption`-felt megleren skriver selv**. Null trykk, null friksjon, identisk på FINN og på eiendomsmegler1.no.

Nytt artefakt som faller ut: **nabolagskart-bildegenerator**, 1–3 slides fra samme bestilling som lenka og QR-en.
1. Kartet med meglerens fremhevede steder og gangtider påskrevet
2. Kategori-stripe (Mat & drikke, Skole, Transport, Trening) med navngitte steder og minutter
3. Evt. skolekrets

Designkrav: FINN viser dette fullskjerm på liten skjerm og rekomprimerer (`quality(70)`, `strip_exif`). **Stor type, høy kontrast, ingen tynne linjer. Test på 390 px bredde.** Caption blir tekst-pekeren: *«Alle stedene med gangtid: placy.no/ostmovegen»*.
**Prisen, sagt ærlig: et bilde gir null måling.** Moat 2 finnes ikke på den flaten.

**Uverifisert risiko:** FINNs bilderetningslinjer er strengere enn EM1s egen side. Et kart/infografikk-slide ligger i plantegning-familien og er trygt; et **QR-slide** ligger nærmere reklame. Anbefaling som omgår spørsmålet: **kartet i karusellen, QR-en på papir.**

**Megler-kontrollerte flater, rangert:**

| Flate | Trykkbar på mobil | Dev hos dem | Målbar |
|---|---|---|---|
| **«Nyttige lenker»-slot i FINN-annonsen via meglersystem-feed (§3b, 2026-08-11)** | **ja** (app + desktop) | nei — systemfelt (Vitec bevist, Webtop uavklart) | **ja** (`?src=finn`) |
| Visningsbekreftelse / SMS etter visning (Webtop Tide) | **ja** | nei | ja |
| Meglerens direkte utsendelse til interessenter | **ja** | nei | ja |
| Karusellbilde (kartet selv) | trenger ikke være | nei | **nei** |
| `videos[].url`-feltet | ja, som CTA | **én host i whitelist** | ja |
| Klartekst-URL i «Verdt å merke seg» | nei — må skrives av | nei | delvis |
| QR i karusellen | **nei** | nei | ja |
| Ekte iframe | ja | ny komponent + CSP | ja |

**Konsekvens for asken i møtet:** du skal ikke be Kristian om noe han ikke har myndighet til. Ber om tre måneder på **bilde + lenke + QR**, med `?src=`-attribusjon fra dag én — og *hvis* tallene holder, er det han som tar embed-asken videre til SpareBank 1 og Visma med data i hånda.

---

## 3b. FINN-annonsen har en klikkbar lenke-slot likevel: «Nyttige lenker» via meglersystem-feeden (2026-08-11)

**Utløser:** Andreas fant en DNB-annonse med megler-skrevne, klikkbare lenker i FINN-appen — først «kommer for salg»-annonsen (nybygg/planned-vertikalen), deretter den aktive salgsannonsen i **homes-vertikalen**: Villa Humlehaugen, Humlehaugvegen 37, Ranheim, **finnkode 468757276**, prisantydning 42,9 M.

**Verifisert:** «Nyttige lenker»-boksen inneholder de tre standard (Meld interesse / Se komplett salgsoppgave / Gi bud) pluss to megler-skrevne, på både app og desktop:

- «TRYKK FOR VIDEO» → `villahumlehaugen.no/Boligfilm Humleveien - huyrebel.mov`
- «TRYKK FOR HJEMMESIDE» → `villahumlehaugen.no/`

To ting som betyr mer enn de ser ut:
1. **Video-lenken er en rå `.mov`-fil på eget domene** → vilkårlig URL, fri lenketekst, ingen host-whitelist. (Kontrast til §1s hypotese om host-whitelistet `videos[].url` hos EM1.)
2. **Vertikalen er «Bolig til salgs» (homes)** — samme annonseskjema som hele bruktvolumet. Boligen er nybygg (byggeår 2026), men skjemaet diskriminerer ikke på boligens alder.

**Presisering av §3-tabellen:** Fritekst-veggen står — FINN-hjelpesenteret bekrefter at lenker i annonsetekst ikke er klikkbare («Klartekst-URL i Verdt å merke seg»-raden er fortsatt riktig). Men det finnes en **strukturert lenkekanal fra meglersystem-feeden** som tabellen manglet: klikkbar på mobil (appen samler alle annonse-lenker i «Nyttige lenker»-boksen; desktop sprer dem — det var forskjellen Andreas så), null dev hos noen, målbar med `?src=finn`. **Det reparerer «et bilde gir null måling»-prisen fra §3 — Moat 2 finnes på FINN-flaten likevel.** Self-serve-SharePanel har allerede `?src=finn`-lenken klar til å limes inn.

**Slotten står tom i praksis:** 6 av 6 vanlige bruktannonser sjekket (3 DNB, 2 EM1, 1 EIE) har bare standard-/kjedelenker → ledig plass på hele bruktmarkedet.

**Leverandør-spørsmålet (delvis besvart):**

- **Vitec Next (DNB, HEM, Nordvik, Aktiv m.fl.): bevist.** DNB-annonsen er Vitec (`bud.vitecnext.no/MSDNB/…`), og lenkene er lagt inn per oppdrag med fri tekst av megler.
- **Webtop/Visma (EM1, EIE): ubevist utenfra.** Feeden deres pusher flere lenker til samme FINN-boks — «Eiendommens hjemmeside», «Bestill salgsoppgave», Visningspåmelding, Energiattest-PDF — så *røret finnes*. Men alle observerte er kjedekonfigurerte standardtyper med identisk `cid=partner;;finn;;em1mn_…`-sporing; selv Frank Robert Baes eget Grilstad Marina-oppdrag (finnkode 466364768) har ingen fri lenke. Enten eksponerer ikke Webtop feltet for megler, eller EM1-konfigen gjør det ikke. **Avgjøres med ett skjermbilde fra Webtop** — god mikro-ask til Kristian/Frank Robert som samtidig tester viljen deres.
- **Mulig gate hos FINN, uverifisert:** video i boligannonse krever «utvidet prospekt»-pakken → lenkefeltene kan være pakke-gatet snarere enn system-gatet.

**Risiko:** FINNs annonseregler forbyr lenker til «FINNs konkurrenter» og markedsføring av andre produkter/tjenester — og FINN opererer selv Nabolagsprofil (§6). En Placy-stedsside om boligens nabolag ligger i samme kategori som prosjektsiden DNB lenker til her, og bør stå seg som «informasjon om boligen» — men flaten er leid, og FINN har hjemmel til å fjerne lenker de vil lese som konkurrent-lenker. **Kanalen er en oppgradering av FINN-flaten (bilde + klikkbar lenke), ikke fundamentet.** Visningsbekreftelse-, karusell- og QR-sporet (§3) består urørt.

**Konsekvens for asken:** «UTFORSK NABOLAGET → placy.no/<strøk>?src=finn» er én utfylling i meglersystemet. For Vitec-kjeder (HEM!) er den bevist mulig i dag; for EM1 er selve spørsmålet «kan dere legge inn en lenke her?» en ufarlig møteåpner.

### Sveip-resultat samme dag: 187 annonser, 7 agenter — leverandør-spørsmålet besvart så langt det kan besvares utenfra

Sonnet-sveip over EM1 (61), EIE (63), PrivatMegleren (25), Nordvik (14+), Krogsveen (14), pluss DNB/BOA/Tinholt/Bakke Sørvik-enkeltfunn. Fagsystem klassifisert per annonse via Gi bud-/visningslenkens domene.

**Fagsystem-landskapet (biffangst med egenverdi):**
- **Webtop er multi-tenant på subdomener:** `em1.`, `em1nn.`, `eie.`, `pm.`, `boa.`, `partners.webtopsolutions.com` — **PrivatMegleren kjører Webtop, ikke Vitec** (antagelse falsifisert).
- **Vitec Next per Installationid:** DNB=`MSDNB`, Nordvik=`MSNOP`, Krogsveen=`MSKR`. `meglervisning.no` er et delt visningslag oppå begge; `tryggbudgivning.no` er tredjeparts bud (PM-minoritet, Bakke Sørvik).
- **EM1s 12 regionselskap deler ikke infrastruktur:** mn/nn = Webtop, Sør-Rogaland = meglervisning-basert, minst to annonser med `bud.vitecnext.no`/Visma OneBroker-innslag. «EM1 kjører Webtop» er en region-sannhet (Midt-Norge), ikke en kjede-sannhet — konsistent med 08-04-kontordoccens «ingen nasjonal beslutningstaker».

**Hovedfunnet, per leverandør og vertikal:**

| | Prosjekt-annonser (`/project/`) | Brukt (`/homes/`) |
|---|---|---|
| **Vitec Next** | — | **Fri tekst + vilkårlig URL bevist** (DNB: «TRYKK FOR …» → rå `.mov` + villahumlehaugen.no). Nordvik: «Social Video» → `portal.diakrit.com` (produktfelt, ekstern URL i praksis). Krogsveen: 0. |
| **Webtop** | **Fri tekst + vilkårlig URL bevist:** EIE Villa Granheim har «Prosjektets hjemme**isde**» *(skrivefeilen = menneske-tastet)* + **«Boligvelger»** → gjelstenbolig.no; BOA → nebbaveien.no; EM1 mn+nn ×4-6 «Se prosjektets hjemmeside» (bobroset.no, vannkanten.net, strandveiparken.no, godthaboya.no, Skanska, ankerhagen-hamar.no). Feltet er valgfritt — ikke alle prosjektannonser har det. | **0 av ~119.** Ikke én fri lenke på Webtop-brukt (EM1+EIE+PM samlet). Men faste felt KAN peke eksternt også på brukt: én PM-annonse har «Se komplett salgsoppgave» → `fredensborgbolig.no/vestbyen`. |

**Konklusjonen som står igjen:**
1. **FINN-lenkearrayen er felles og åpen** (tekst + URL, alle vertikaler, appen samler alt i «Nyttige lenker»). Gaten ligger i fagsystemenes UI per oppdragstype, ikke hos FINN.
2. **Prosjekt/nybygg: kanalen er åpen hos BEGGE leverandører i dag.** En Placy-lenke på en prosjektannonse er bevist mulig for både Vitec- og Webtop-kjeder — treffer utbygger-sporet (Aleksander) og HEM-nybygg direkte.
3. **Brukt: bevist kun hos DNB (Vitec).** HEM er Vitec → sannsynligvis mulig, men DNB-konfig-forbeholdet står til noen ser feltet i Vitec-UI-et (spørsmål til Einar). EM1-brukt ser stengt ut utenfra — forvent «nei» på brukt i møtet, og bruk prosjektside-feltet som EM1-åpningen.
4. **Inkumbent-detalj:** EIE-annonser lister «Nabolagsprofil» → `profil.nabolag.no` som egen oppføring i Nyttige lenker — FINNs eget produkt sitter allerede i slotten hos enkelte kjeder. Placy-asken er «én oppføring til i samme liste».
5. Enkelt-enhets-annonsen i Villa Granheim-prosjektet har IKKE prosjektlenkene → lenkene bor på prosjekt-nivå-oppdraget, ikke per enhet.

### Kort-kode («Placy-kode») — tillegget som gjør karusellbildet målbart (2026-08-11)

Andreas' idé, landet som retning: bildegenerator-slidene (§3) får en kort, tastbar kode påtrykt — **`placy.no/A424G` → riktig board**, à la finnkoden. Koden ligger i URL-stien (ett steg å taste), IKKE bak et søkefelt på et subdomene (to steg, forutsetter en vane ingen har). 4–5 tegn, case-insensitiv, ingen forvekslbare tegn (0/O, 1/l/I). **Måling-ved-eksklusjon:** alle klikkbare flater har alt `?src=` → direkte-treff på `/KODE` uten src = tastet fra bilde/papir/salgsoppgave-tekst → «et bilde gir null måling» (§3) er i praksis reparert, og kanalen virker også der Webtop-brukt-lenkefeltet er stengt. Distribusjonen er samtidig markedsføring (hvert bilde bærer placy.no), men i meglermøter selges mekanismen, ikke navnet. Bygges som tillegg til bildegeneratoren (åpen beslutning 5): kode-tabell + 301, kode i SharePanel, påtrykt slides med stor type (§3-designkravet gjelder koden mest av alt).

---

## 3c. Slotten er teknisk ledig, men kommersielt bebodd: Fastout selger «Områdevideo» inn i den (2026-08-12)

§3b konkluderte med at «Nyttige lenker» står tom på bruktmarkedet. Det gjelder *våre* konkurrenter på nabolagsdata — men ikke kategorien «vis meg området». Andreas fant en FINN-annonse (finnkode **446069340**) der slotten inneholder **«Områdevideo»** → `apps.fastout.com/DynamicDroneView.aspx?panoguid=565a8b3f-…`. Verifisert i browser.

**Hva det faktisk er (browser-verifisert, ikke tekst-fetch):**

- **Ikke en video.** Et statisk **360°-dronepanorama** i Marzipano — ett stillbilde du drar rundt i, zoomer og går fullskjerm i. `viewer.scene().hotspotContainer()` gir seks hotspots, alle håndsatte: objektet (grønn pin, «Til salgs! Velkommen på visning.»), **Trondheim Sentrum 1 km**, **Solsiden 2 km**, **Tyholttårnet**, **Kristiansten festning**, **NTNU Gløshaugen**.
- Panoramaet står i `63.424785, 10.408563` (Singsaker, med utsikt over Kristiansten mot fjorden).
- **Ingen kategorier, ingen reisetid, ingen oppdatering, ingen `?src=`-måling.** Avstandene er luftlinje skrevet inn i etiketten.

**Forretningsmodellen deres:**

- **`panobankguid` ≠ `panoguid`** → de selger ut av en **forhåndsfløyet panorama-bank**; samme opptak gjenbrukes på flere boliger i samme område. Andreas bekrefter at dekningen er bred i Norge. Det er **samme amortisering som Placys per-strøk-kurering** — én kostnad, mange listings — kommersielt validert av noen andre, i vår slot.
- **Pris: 1 295 kr eks. mva per stk**, self-serve (`/consumer/PaymentDroneView.aspx`, Stripe/Visa/MC, levert som lenke på e-post, ingen angrerett). To forbehold: `culture=sv-SE` → tallet er trolig **SEK**, og dette er consumer-/ad-hoc-sporet, så **kjedeprisen er lavere**. Bruk tallet som **tak i kategorien**, ikke som markedspris.
- Svensk selskap (`fastout.com` → `fastout.se`, ingen `.no`). Kjedekunder i Sverige: Fastighetsbyrån, Skandinavisk Fastighetsförmedling, Bjurfors, HusmanHagberg, Mäklarringen — «vinn ÉN kjede» utført i praksis, ett marked unna.

**Hva det betyr for oss:**

1. **De er i en annen jobb.** Bilde, ikke data: «hvordan ser det ut herfra» mot «hva finnes her, hvor langt unna, hva betyr det for deg som skal bo her». Det de sitter på er **bildedekning**, ikke kunnskap.
2. **Placys 3D-kart er allerede et supersett** — fotorealistisk 3D + flythrough lar deg fly hvor som helst i stedet for å se fra ett fast dronepunkt, og pinnene er datadrevne i stedet for håndsatte.
3. **Priskonsekvens (intern, aldri pitch):** kontoravgift 15–25k/3 mnd ÷ ~50 boliger/kvartal ≈ **300–500 kr/bolig — under ett Fastout-panorama.** Kun forsvarssvar hvis «vi har jo Fastout» kommer i rommet; per-bolig-regning foran megler er fortsatt feil ramme (§5c).
4. **Self-serve-kjøp av områdeinnhold er bevist** — megler legger inn kort uten innkjøpsprosess. Støtter `feat/megler-self-serve` (adresse → board → delingslenke), som ligger ubrukt i worktree.
5. **Forbehold som skal med: det rurale asymmetri-argumentet (§5f) treffer dem IKKE.** FINNs Nærområdet-kart blir tomt på Inderøy — et dronefoto blir det ikke. Mot Fastout er aksen **data vs. bilde**, aldri dekning.

**Status:** Kartlagt, ingen handling, ingen kontakt. Samarbeid ikke aktuelt nå (Andreas), men norsk flyfoto-dekning + svenske kjedeavtaler gjør partner-vinkelen verdt å ha i bakhodet. Aktør-rad i `aktor-map.md`.

---

## 4. Produktet og flyten (Andreas' skisse, forankret i det som finnes)

Andreas' skisse: *URL med innlogging (magic link / SSO) → registrer adressen med noen ekstra valg → send inn bestilling → ferdig lenke etter et par minutter, med embed-kode.*

**~80 % er bygd** på `feat/megler-self-serve` (uflettet, worktree `../placy-megler`).

| Steg | Status | Hva som mangler |
|---|---|---|
| **1. Innlogging** | **finnes ikke** — `app/megler/`, `components/megler/`, `lib/megler/` har null treff på auth/session/login; `/megler/[slug]` er en åpen URL | **Magic link via Supabase Auth + e-postdomene-allowlist per kontor** (`broker_offices`, migrasjon 081). Domenet *er* autorisasjonen. **Ikke Google SSO** — EM1 er SpareBank 1-eid og kjører nesten sikkert Microsoft/Entra; legg Entra til hvis kontoravtale blir kjedeavtale |
| **2. Registrer boligen** | `OfficeGenererForm`: adresse-autocomplete + e-post + samtykke | Tre felt til, ikke mer: **hvilken megler** (dropdown fra kontoret — bærer utvalget per strøk per megler, §6b i kontor-doccen, + attribusjon), **annonse-URL** (valgfri — kobler board til objektet), og e-post faller bort (kommer fra innlogging) |
| **3. Bestilling** | POST `/api/generation-requests`: rate limit → office-lookup → `findAreaForPoint` → `record_coverage_demand` ved miss → dedup → `provisionReportBoard()` → status → bekreftelses-e-post. Kjører inline = «et par minutter» | — |
| **4. Hva de får** | `SharePanel`: kopier lenke (`?src=finn`), kopier iframe (`?embed=1&src=embed`), QR-nedlasting (`?src=qr`), forhåndsvisning | **«I salgsoppgaven»-blokk**: QR som PNG i riktig størrelse + ferdig tekstlinje til «Verdt å merke seg» + **karusellbildene** (§3). Iframe-snippeten blir liggende, men skal ikke være det første de ser |
| **5. Strøk-utvalget** | visningssiden finnes (`board-data.ts:315–334`) | Krever auth (steg 1) + kuraterte strøk |

**Rekkefølge:** auth → megler-felt + salgsoppgave/karusell-artefakt → kurér Brundalen/Væretrøa → utvalgsflaten. **Embed er ikke på lista før noen har tall.**

---

## 5. HEM (hem.no) — den eneste kandidaten som kan si ja til en embed alene

Inspisert i browser (Cloudflare bot-beskyttelse blokkerer curl og WebFetch; robots.txt tillater objektsider).

**Presedensen ligger på objektsiden deres, og den er en iframe:**

```html
<iframe class="lazyload scroll-colored" frameborder="0"
        data-src="https://profil.nabolag.no/468795091?t=1"></iframe>
```

700 × 700 px, lazyloadet, under seksjonen «Nabolagsprofil». Og:

- **Ingen `Content-Security-Policy`. Ingen `X-Frame-Options`.** Ingen `frame-src` å be om unntak fra.
- **Craft CMS** (`generator: SEOmatic`, robots.txt disallower `/cpresources/`, `/vendor/`, `/cache/`) — eget nettsted, egen mal. Asken er **«legg inn én lazyload-iframe ved siden av den dere har»** = tre linjer Twig.
- Objekt-URLer er fagsystem-GUIDer på rot (`/1A44166E-…`), **561 aktive annonser**.
- **Fagsystem: Vitec Next** (`bud.vitecnext.no`, `meglervisning.no`) — ikke Webtop.
- Selskap: etablert 1996, **~2 574 salg i 2021 (882 prosjekt → ~1 700 brukt)**, 100+ ansatte, 9 kontor (Solsiden, Byåsen, Høyskoleparken, Heimdal sentrum, Rosten + Stjørdal, Melhus, Orkanger, Støren). Eiere: MelhusBanken, Heimdal Gruppen AS, ansatte — **ingen allianse over seg.**

### De har to ulike problemer — to ulike produkter

| | EM1 Grilstadporten | Heimdal Eiendomsmegling |
|---|---|---|
| Nabolagsflate på objektsiden i dag | **ingen** — skriver prosa selv | **nabolag.no i iframe** |
| Kan bestemme embed alene | **nei** (SpareBank 1 FFE, 12 selskap) | **ja** |
| Teknisk barriere | ny komponent + CSP | **ingen** |
| Fagsystem | Webtop / Visma Real Estate | Vitec Next |
| Konkurrent i slot'en | ingen | betalende inkumbent |
| Varm kontakt | **Kristian Sundland** | ingen |
| Bruktbolig-volum | ~200/år | ~1 700/år |
| Grunnpakke @500–800 | 100–160k/år | **0,85–1,4M/år** |

**EM1 har innholdsproblemet, men ingen slot** → Placy selger dem *arbeidet og kvaliteten* (bildet, teksten, lenken).
**HEM har sloten, men har outsourcet innholdet** → Placy selger dem *flaten*.

Ingen av de to pitchene forutsetter den andre.

---

## 5b. Wesselsløkka er den varme døra inn til HEM — og det første stedet Placy faktisk kan embeddes

Andreas' observasjon: *«sånne som Wesselsløkka, det er jo via Heimdal Eiendom. De jobber mye med å vise fram området. De har til og med en stor fysisk 3D-modell på visningssenteret.»* Den holder, og den løser åpen beslutning 3 (ingen varm kontakt hos HEM).

**Konsernrelasjonen:** **Heimdal Bolig** er utbygger (`heimdalbolig.no/boligprosjekt/wesselslokka/`), **HEM selger** (`prosjekt.hem.no/wesselslokka` + annonser på `hem.no`), og **Heimdal Gruppen AS er blant HEMs største eiere** sammen med MelhusBanken og de ansatte. Et Wesselsløkka-oppdrag er derfor **ikke en omvei til utbygger-sporet — det er et HEM-oppdrag.** Stigen: prosjekt → referanse inne i konsernet → HEMs bruktbolig-meglere → embed-asken på objektsidene.

**`wesselslokka.no` kan embedde oss i dag, uten utvikler:**
- Plattform **Squarespace**. **Ingen `Content-Security-Policy`.** (`x-frame-options: SAMEORIGIN` gjelder andres framing av *dem*, ikke vår.)
- De har alt iframes på siden: «Bestill avtale»-widget (`allow="payment"`), Google Maps, Vimeo.
- Squarespace har innebygd **Code/Embed-blokk** → en markedsperson limer inn iframen i editoren på minutter.
- Siden har alt seksjonene **«Området»** og **«Kart»** — plassen er tegnet.

`prosjekt.hem.no/wesselslokka` er HEMs prosjekt-hub (Craft/SEOmatic, ingen CSP) som **301-er til `wesselslokka.no` med UTM-tagger**. For prosjekter *uten* egen side hoster hubben antakelig hele prosjektsiden → én HEM-kontrollert mal for alle slike. **Uverifisert mini-wedge, verdt en titt.**

**De har alt kjøpt premisset:** «Norges grønneste nabolag», 10-minutters-byen, Bjørkealléen, Bekkedalen som gjenåpnet bekk, infosenter i Brøsetvegen 100 med stor fysisk 3D-modell + Vimeo-film av modellen. Ingen overbevisningsjobb på at nærområdet selger.

**Vårt board står klart:** `placy.no/eiendom/broset-utvikling-as/wesselslokka/rapport-board` svarer **200**. `reportTier: 2`, `has_3d_addon: true`, `homepage_url` peker alt på `wesselslokka.no`, 7 temaer med grounding, `district: Brøset`. Senteret (63.4221 / 10.4506) faller **innenfor Eberg-polygonet** → ingen geofence-vegg.

**Kjente hull i boardet (verifisert 08-04, ikke lukket — Andreas utsatte det):**
- `opplevelser` mangler `editorial`-nøkkelen helt (har `leadText`, `bridgeText`, `grounding`) — og POI-poolen for temaet er tynn: **5 POI-er, 4 av dem bibliotek** (2 NTNU-interne). Kun Moholt bibliotek og Gråmølna har hooks.
- `highlightPoiIds` er tom på `barn-oppvekst` og `transport`. Verifiserte kandidater i `project_pois` (103 POI-er totalt): barn-oppvekst → `nsr-979195052` (Eberg skole, hook «Nærskolen for Brøset») + `bhf-broset-barnehage` (408 m, **mangler hook**); transport → `entur-NSR-StopPlace-43929` (Brøset Hageby, 40 m, live avganger) + `bysykkel-155` (Kong Øysteins veg, 679 m, **mangler hook**); opplevelser → `google-ChIJbfptqcoxbUYRjHpaKmnBMds` (Moholt bibliotek) + `google-ChIJh1NiM6AxbUYRtXQ9byVdTAI` (Gråmølna).
- **Radius-drift i `editorial.body`-tekstene:** flere bodyer peker på POI-er 2–3 km unna som om de var nærmeste. `barn-oppvekst.editorial.body` sier «Domkirken, Singsaker og Prestegårdsjordet barnehage ligger alle innenfor noen hundre meter» — mens `leadText` på samme tema korrekt sier **«Eberg skole er nærmeste barneskole»**. Samme mønster i `transport` («bysykkelstasjonene ved Gløshaugen, Singsaker og Idrettsbygget» — nærmeste er Kong Øysteins veg, 679 m) og `natur-friluftsliv` (Høgskoleparken). **`leadText` er riktig, `editorial.body` har driftet.** Årsak sannsynligvis 2 500 m discovery-radius. Dette må rettes før boardet vises til Heimdal — en megler som kjenner Brøset ser det umiddelbart, og det er samme feilklasse vi kritiserer FINN for (§6).
- Backup av gjeldende config: `$CLAUDE_JOB_DIR/tmp/wl-product-backup.json` (68 kB).

**3D-modell i kartet (Andreas' spørsmål):** mekanismen finnes hos Google (`gmp-model-3d` / `Model3DElement` — georefererte glTF/GLB i de fotorealistiske flisene), men **den er ikke bygd hos oss** — null treff på `gmp-model-3d`, `Model3DElement`, `.glb`, `gltf` i `lib/`, `components/`, `app/`. Et render (JPG) kan ikke bli en modell; fotogrammetri krever mange bilder av et *fysisk* objekt. **Riktig kilde er utbyggerens egen fil:** BIM/IFC fra arkitekt (IFC → glTF er standard), visualiseringsmodellen bak renderne (filnavn `1213_Heimdal_Broeset_…` = viz-byrå-prosjektnummer), eller filen den fysiske modellen ble fresset fra. Ask: *«send oss IFC-en eller GLB-en»*. **Billig 80/20 uten modell: massing** — fotavtrykk + gesimshøyder fra situasjonsplanen, ekstrudert som enkle volumer; detaljerte fasader blir uhyggelige, massing blir det sjelden, og det skalerer til alle prosjekter. **Forbehold:** en modell i et kart leser som mer faktisk enn et render → deres eget «illustrativ karakter»-forbehold må følge med, og nøyaktigheten bør være *deres* ansvar via *deres* fil. **Addon-SKU, aldri i et grunnpakke-møte** (widget-fellen).

**Rekkefølge-konsekvens:** et EM1-møte der du kan si *«her ligger det, live, på en ekte prosjektside»* er et annet møte enn ett der embed er hypotetisk. **Wesselsløkka bør gå før EM1.**

**Tre motvekter:**
1. **Den fysiske 3D-modellen er både åpning og innvending.** «Vi har alt en 3D-modell» kommer. Foregrip: deres modell viser **utbyggingen**, Placy viser **nabolaget du bor i** — gangtid, navngitte steder, skolekrets. Og modellen står i et infosenter åpent tirsdager kl. 12; vår ligger i telefonen til han som skroller FINN klokka 23.
2. **Prisankeret er den reelle faren.** Nybygg er utbygger-penger. Selges Wesselsløkka som prosjekt, har HEMs bruktside hørt «Placy koster X for et prosjekt» før grunnpakke-samtalen. Det er kanalkonflikten fra 06-25 §3, nå konkret. **Si to-SKU-skillet høyt fra første møte.**
3. **Hvem er kjøperen?** Vår DB har kunden som **Brøset Utvikling AS** — ikke Heimdal Bolig, ikke HEM. Brøset er sannsynligvis et JV. Ligger markedsbudsjettet hos utbygger, lander referansen der, og introen til HEMs bruktside blir **en tjeneste du må be om eksplisitt** — samme mekanikk som Kristian-asken.

**Koordinering:** Wesselsløkka ligger midt på skjøten mellom Aleksanders utbygger-mandat (06-23, term sheet **ikke signert**) og Andreas' megler-spor. **Avklar hvem som eier kontakten før noen tar den.**

---

## 5c. Full sideinspeksjon av `wesselslokka.no` — fire funn som flytter både pitchen og prisen

Kjørt 2026-08-04 på `wesselslokka.no` (forside + `/home`) og `stasjonskvartalet.no` som ordinære sidevisninger. Squarespace-`robots.txt` sperrer trenings-crawlere (`anthropic-ai`, `ClaudeBot`, `GPTBot` m.fl.); `User-agent: *` tillater sidene som ble lest, og ingen sperret sti er rørt.

### Prosjektfakta (verifisert mot deres egen tekst)

| | Wesselsløkka | StasjonsKvartalet |
|---|---|---|
| Enheter | **122 leiligheter** («Her bygges 122 nye leiligheter») | **235 leiligheter** («skal det … bygges 235 leiligheter») |
| Rolle | **Trinn 1 av Brøset** — flere byggetrinn følger | Ett kvartal, flere salgstrinn |
| Salgsstatus | Salgsstart våren 2025, «årets mestselgende nyboliglansering 2025», fortsatt «i salg nå» | Gryta 8A nyeste salgstrinn, 13 solgte |
| Byggestart / innflytting | 2025/26 → 1. halvår 2027 (senest 30.04.28) | — |
| Boligvelger | **Marketer** `property-explorer` | **Marketer** |

**Korreksjon å ta med i Aleks-briefen:** Wesselsløkka er **ikke større enn StasjonsKvartalet i enheter** — det er litt over halvparten (122 mot 235), og StasjonsKvartalet ligger på en dyrere adresse (Brattøra / Nye Trondheim S). Det holdbare argumentet er **Brøset som bydel** (Wesselsløkka er trinn 1; infosenterets modell viser «hvordan hele Brøset vil utvikle seg når alle byggetrinn står ferdige»), ikke prosjektstørrelse. Aleks har sett StasjonsKvartalets boligvelger og husker skalaen — feil størrelsesforhold koster troverdighet i det ene rommet den trengs mest.

### Funn 1: HEM eier nettsiden — kjøperen er megleren, ikke utbyggeren

Footeren sier **«Heimdal Eiendomsmegling AS | © 2025»**. Alle seks kontaktene er `@hem.no`, med navn og direktenummer:

**Thomas Løbakk** — prosjektleder og eiendomsmegler, `tl@hem.no`, 930 29 952. Deretter Ole Sundnes (`os@`, 909 97 511), Fredrick Søbstad (`fs@`, 986 45 628), Morten Kvernland (`mk@`, 950 42 501), Martin Havdal (`mh@`, 994 22 430), Alexandra Muravskaya (`am@`, 412 63 735).

Det **erstatter motvekt 3 i §5b**: kjøperen er ikke Brøset Utvikling AS eller Heimdal Bolig, det er HEM. Døra har navn (Løbakk), men prisen blir vanskeligere — **kanalkonflikten sitter i samme rom fra første møte**, siden HEM både betaler for prosjektet og er grunnpakke-prospektet.

### Funn 2: Marketer er allerede embeddet på siden — mekanismen er bevist av en konkurrent

Boligvelgeren på `/home#velger` er **Marketer** — `property-explorer`-modulen (prosjekt `1ad192db-49e5-4422-bf6a-93f232ec046c`, company `af8e4a8c-…`, script fra `d3g6ix8apt5w4m.cloudfront.net/embed-script.min.js`), injisert som `<script>` i en **Squarespace Embed Block**.

Spørsmålet «kan Placy embeddes her» er dermed besvart **ja, av en konkurrent, på samme side**. Asken er «én blokk til, ved siden av den dere har fra Marketer». Samme leverandør som StasjonsKvartalet → head-to-head-en fra 06-02 er ikke hypotetisk lenger, og posisjonen holder: **Marketer eier boligvelgeren, nabolaget er en lenke ut til FINN. Det hullet er vårt.**

### Funn 3: FINN Nabolagsprofil er der — i sin svakest mulige form

I «Området»-seksjonen: `<a href="https://profil.nabolag.no/3732299" target="_blank">Åpne nabolagsprofil</a>`. **Ikke en iframe — en knapp som sender trafikk ut av prosjektsiden, i ny fane, midt i kjøpsreisen.**

Skarpeste salgsargument som finnes her, og det handler ikke om dybde: *«dere sender folk til FINN for å lese om nabolaget. Vi lar dem lese det hos dere.»* Merk kontrasten mot `hem.no`s objektsider, der samme leverandør ligger som **ekte iframe** (§5) — HEM behandler altså nabolagsprofilen som embed på brukt og som utgående lenke på prosjekt.

### Funn 4: de har skrevet Placy nivå 1 for hånd — og limt inn scorene Andreas kaller tull

«Området»-accordionen er manuell gangtid-prosa: Brøset barnehage 8 min, Eberg skole (1.–7.) 10 min, Blussuvoll ungdomsskole 13 min, Strinda vgs 15 min, Brøset idrettsplass 3 min, Eberg ballbane 8 min, Fresh Fitness Valentinlyst 5 min, TrenHer Angelltrøa 10 min, 3T Moholt 20 min, Valentinlystsenteret 4–5 min, Bunnpris Angelltrøa 12 min. **Statisk tekst i en trekkspilliste — ingen kart, ingen klikk, ingen måling.**

Og i samme seksjon: *«Nabolaget vurderes som svært trygt (89/100) og har lavt støynivå (90/100).»* Det er FINNs score-svada kopiert inn i deres egen brødtekst. **Argumentet mot scorene trenger ikke føres — de har selv vist at de bare hadde dem å ta av.** Nivå 1 er dessuten *validert som arbeid de faktisk gjør manuelt*, per prosjekt.

### Prising av Wesselsløkka — revidert

Andreas spurte hva en nivå-1-/nivå-2-leveranse kan ligge på. Utgangspunktet er ankrene i `2026-06-23` (utbygger 250k/24 mnd + ~50t) og `2026-06-27` (grunnpakke 300–800/listing; premium-single anker 19–25k, forvent 12–18k).

**Nivå 1 er feil SKU her — og det er ikke et pengespørsmål.** For en utbygger/prosjektselger er nivå 1 ikke et *billigere* produkt, det er et *dårligere* et. Wesselsløkka har alt kjøpt premisset (Norges grønneste nabolag, 10-minutters-byen, fysisk 3D-modell). Et ukuratert auto-board sier ingenting deres egen håndskrevne accordion ikke sier bedre. Boardet vårt er dessuten alt tier 2 med `has_3d_addon: true` → nivå 1 ville være en nedgradering. Tallet, hvis det trengs: **25–40k/12 mnd** — men det skal ikke være åpningen; det priser flaggskipet på bruktbolig-nivå og brenner 250k-ankeret før Aleks' term sheet er signert.

| | Anbefaling | Begrunnelse |
|---|---|---|
| **Listepris nivå 2** | **250k / 24 mnd + klargjøring** | Aleks' anker, urørt. Står på en-sideren, forhandles ikke ned. |
| **Det som selges nå** | **60k / 6 mnd**, alt inkludert | 250k/24 mnd ≈ 10,4k/mnd → 6 mnd = 62,5k. Piloten er **pro rata, ikke rabatt** → ankeret består. 6 mnd (ikke 3 som i EM1-piloten) fordi nybygg selges over kvartaler, ikke uker. |
| **Opptrapping** | **Brøset som helhet, flere byggetrinn** | Der ligger 250k-formen. Ett kuratert Brøset-strøk betjener hvert framtidig trinn = per-strøk-amortiseringen (`project_editorial_gemini_fable`). Langt bedre historie enn «18 måneder mer av Wesselsløkka». |
| **Gulv (walk-away)** | **40k** | Ikke åpningen. Under det er referansen verdt mer enn pengene — men **aldri gratis** (gratis gir høflig begeistring, betalt gir sannhet, 06-23 §de-risk). |
| **Per-enhet-forsvaret** | 60k / 122 = **492 kr/enhet** | Lander rett i grunnpakke-båndet 500–800. Regnestykket kommer i rommet; forsvaret er innebygd. |
| **3D-modell i kartet** | **Ute av scope, egen fase** | Ikke bygd (§5b). Å love ny kapabilitet til første betalende kunde er måten å tape penger på et referansesalg. Vurder selvkost mot at Placy eier kapabiliteten — eget avtaledokument. |

**Prisankeret i rommet er Marketer-linja på samme side** (boligvelger + prosjektside-setup: 50–200k, estimat `2026-06-02`) — **aldri** nabolagsprofil-linja, som er bundlet og billig og setter taket ved FINN.

**To advarsler.** (1) Prosjektet er ~15 mnd inn i salget og kaller seg mestselgende → hastverket er ikke deres; motargumentet er restbeholdning + trinn 2, ikke «dette selger boligene». (2) Siden HEM betaler: **si to-SKU-skillet i første setning om pris**, ikke i andre møte. «Prosjektmarkedsføring for Brøset» og «per-listing på bruktannonsene» er to produkter med to budsjettlinjer. Sies det ikke nå, har HEMs bruktside hørt ett tall før grunnpakke-samtalen — og det tallet er 60k.

**Uverifisert:** samlet salgsverdi. Prislista ligger bak Dropbox-JS (`bit.ly/WePrisliste` → `dropbox.com/scl/fi/…/WesselslokkaPrisliste.pdf`) som ikke lastes uten browser. 122 enheter med mange arealeffektive Husbank-forhåndsgodkjente boliger tilsier grovt **450–600M**, men det er anslag — hent PDF-en manuelt før prosent-av-markedsbudsjett-argumentet brukes.

**Aleks-briefen (fire punkter):** (1) 122 mot 235 — ikke gå inn med feil størrelsesforhold. (2) Marketer er på **begge** prosjektene han har sett; kontekstlag-posisjonen fra 06-02 holder. (3) Kjøperen er **megler, ikke utbygger** → bryter med «utbygger-først»-spydspissen han anbefalte; hans vurdering av om Wesselsløkka i det hele tatt skal ligge under hans mandat. (4) **Forket bare han bør avgjøre:** prises første deal som *prosjektmarkedsføring* (HEMs budsjett, lavere tall, åpner bruktsiden) eller som *utbygger-leveranse* (Heimdal Bolig / Brøset Utvikling, høyere tall, bevarer 250k-ankeret)? Det valget setter ankeret for begge sporene, og loggen sier alt at han skal eie pris-framingen i rommet. **Term sheet bør signeres før han tar en kontakt som er verdt 0,85–1,4M/år nedstrøms.**

---

## 5d. Hvem som faktisk lager `wesselslokka.no` — og hva det gjør med pitchen (2026-08-05)

Utgangspunktet var en observasjon fra Andreas: siden krasjer på Chrome/iPhone. Det ble en organisasjonsanalyse, og den flytter både kjøper, pris-argument og demo-krav.

### Krasjet er verifisert, og mekanismen er entydig

Andreas tok skjermopptak (32 s, 1180×2556 = **iPhone 14/15/16 Pro-klasse**, Chrome iOS, **inkognito, én fane** — tanketrykk utelukket). Tidslinje fra frame-analyse:

| t | Hendelse |
|---|---|
| 21,55 s | «Områdekart» kommer inn i viewport |
| 22,30 s | Neste bilde under «ÅPNE NABOLAGSPROFIL» begynner å dekode |
| **22,35 s** | **Hele viewporten blir grå — også headeren forsvinner, på én frame** |
| 22,40 s | Hvitt. Toolbar og URL står, innholdet er borte |
| ~24–27 s | Siden er tilbake, gjenopprettet på annen scroll-posisjon |
| 29,9 s | **«Can't open this page — Restart Chrome / Restart your device»** |

At headeren forsvinner *samtidig* som innholdet er beviset: en JS-feil lar DOM-en stå malt. Dette er **iOS som avvikler WebKit-innholdsprosessen for minnebruk** (Jetsam). «Can't open this page» med dødt-fane-ikonet er Chrome iOS' side for nettopp prosessdrap, ikke for nettverksfeil.

**Målt på siden:** dokument 2,39 MB ukomprimert (136 KB gzip), 1 876 elementer, **312 inline `<style>`-blokker = 339 KB CSS**, 18 seksjoner / 64 fluid-engine-blokker **alt på `/`**, 31 bilder (webp, ~6 MB → **~103 MB dekodet**), 24 JS-filer ~640 KB inkl. **5 WebGL-shader-effekter lastet uansett** og Acuity-komponenten på 126 KB.

**Fire konkrete defekter:** (1) `sizes="(max-width: 799px) 200vw, 100vw"` på to bilder → på en 393 px iPhone blir det 780 CSS-px × DPR 3 = 2 340 → browseren plukker `2500w`, ~17 MB RAM hver istedenfor ~6. (2) **Marketer-iframen opprettes av JS uten `loading="lazy"`** og strekkes til full høyde med `iframe-resizer` fra `unpkg.com` → laster ved sidelast, avlastes aldri, deler renderer. (3) `Fredrik_avduking_playv2.png` = **2 081 126 bytes** webp på 1176×1337, brukt som falsk video-poster som bare lenker til `vimeo.com/1188022173`. (4) Områdekartet er et **6877×4073 PNG** i kilde.

**Presisering som må overleve, ellers blir påstanden falsifiserbar:** kartet er *ikke* minnesluket. `sizes` gjør at mobilen plukker `1500w` = 462 KB / ~5 MB RAM. Årsaken er **kumulativ** — én-sideren akkumulerer til den dør, og nabolagsseksjonen er bare der grensen krysses. Si aldri «kartet deres krasjer siden»; det holdbare er *«én-sideren akkumulerer til den dør, og den dør konsekvent i nabolagsseksjonen.»*

**Tiltaksrekkefølge (alt uten utvikler):** boligvelgeren av forsiden → del opp én-sideren → fjern `200vw` → krymp 2 MB-posteren → nedskaler kart-kilden.

### Markedsavdelingen: fire designere, null utviklere

`hem.no/om-oss/markedsavdeling` (403 med Cloudflare-challenge for oss; Andreas leste den selv):

| Navn | Rolle | Kontakt |
|---|---|---|
| Sara Venturi | art director | sv@hem.no / 942 56 508 |
| Terje Brandslet | art director | teb@hem.no / 959 10 407 |
| Ragnhild Hov | grafisk designer | rah@hem.no / 454 87 802 |
| Bjørn Vegar Torseth | grafisk designer | bvt@hem.no / 481 88 802 |
| **Einar Ringen Jr.** | **it- og markedssjef** | — |
| Martin Holmøy Berg | it- og markedskonsulent | — |

**Fire av seks er visuelle designere. Null utviklere. «IT» er slått sammen med «marked» i begge de to siste titlene** — altså systemer og verktøy, ikke ingeniørarbeid.

Kodeforensikk som bekrefter in-house uten byrå: **ingen** treff på «designed by» / «utviklet av» / «laget av» / byrå noe sted; **custom CSS er 397 bytes på én linje** og inneholder bare to `@font-face` (Adobe Fonts «sculpin», «ivyepic») + fire `font-family`-overstyringer — null håndskrevet layout; Squarespace 7.1, `templateId 5c5a519771c10ba3470d8101`. Blokk-ID-ene bærer epoch-tidsstempel: **bygd desember 2024**, tyngste redigering **feb–mar 2025** (rett før salgsstart), deretter jevn redigering frem til **3. juli 2026**. Det er ikke et forlatt byråprosjekt — noen logger inn hver eller hver annen måned.

### Einar Ringen Jr. er kjøperen — bekreftet av Vitec

`vitecnext.no/aktuelt/velkommen-til-alle-vare-nye-kunder-i-q1-2023` (11. mai 2023): **Heimdal Eiendomsmegling gikk live på Next Megler Suite i Q1 2023**, sammen med Aktiv, Rede og Attentus. Sitatet i pressemeldingen er **Einar Ringen Jr., «It og markedssjef Heimdal»**. Samme tittel i Vitecs melding fra 2023 og på hem.no i dag → stabil i rollen i minst tre år, og han **eide fagsystem-migreringen**.

Tre konsekvenser:

1. **Han eier Vitec Next-relasjonen** — som er selve HUB-API-wedgen i `2026-07-09`. Vinner vi HEM, er Einar den varme inngangen til Vitec. Det korter ned den loggførte Nordvik→Vitec-veien.
2. **Kanalkonflikten fra §5c er ikke to kjøpere, det er én person.** Einar er kjøper både for Wesselsløkka-SKU-en og for grunnpakken på de ~1 700 bruktboligene. Godt (én relasjon, to SKU-er) — men **regn aldri per enhet foran ham.** 492 kr/enhet var en intern fornuftssjekk, ikke et argument; sagt til mannen som senere skal prise 1 700 annonser, setter det taket selv.
3. Han har allerede gjennomført det vanskeligste integrasjonsprosjektet en kjede kan gjøre. Han kan vurdere en integrasjon, og han har organisatorisk tyngde til å dytte den.

### Marginalkostnad-inversjonen — dette dreper et argument vi hadde

Fire designere på lønn betyr at **HEMs marginalkostnad for ett områdekart til er ~0 kr.** «Vi sparer dere for en designer-ettermiddag» er verdt ingenting her. Den arbeidsbesparende vinkelen er død, og den lå implisitt i flere av de loggførte pitch-formene.

Til gjengjeld har de tegnet sin egen kjøp-vs-bygg-grense, og bevisene ligger på samme side:

- **Kart, områdetekst, gangtider** → laget selv. De klarte det.
- **Boligvelger** → kjøpt fra Marketer. De klarte det ikke.

Fire designere og null utviklere kan ikke lage noe som **oppdaterer seg**, noe som er **interaktivt**, eller noe som **måler**. Placy må ligge på Marketer-siden av streken. Demoen kan ikke se ut som et penere kart — da havner vi i bøtta der de lager det selv, og de vil ha rett.

### Rekkefølge på kontakt (erstatter «Løbakk er døra» som hele planen)

| Person | Rolle i salget |
|---|---|
| **Einar Ringen Jr.** (it- og markedssjef) | **Kjøperen.** Eier verktøy, budsjett og Vitec. Ingen personlig eierskap til det håndtegnede kartet. |
| **Thomas Løbakk** (prosjektleder Wesselsløkka) | **Etterspørselen.** Vil selge leiligheter, ikke forvalte verktøy. Skaper trekket. |
| **Martin Holmøy Berg** (it- og markedskonsulent) | **Implementeringen.** Nesten garantert den som redigerer Squarespace månedlig (jf. blokk-tidsstemplene) → limer inn Code Block-en. |
| Venturi / Brandslet / Hov / Torseth | **Risikoen.** De eneste som kan si «det lager vi selv», og de har rett hvis produktet ser ut som designarbeid. Aldri inngangen. |

**Absolutt forbud i rommet:** ingen antydning om at siden eller kartet er amatørmessig. Sara eller Terje har laget det. Krasjfunnet er *vår* forståelse av hvorfor mobil er vanskelig — ikke en dom over arbeidet deres.

### Nytt pre-møte-krav (blokkerende)

**Vårt eget Wesselsløkka-board må verifiseres på samme telefon, inkognito, én fane, samme scroll — før noen kontaktes.** Boardet er `reportTier: 2` med `has_3d_addon: true`, altså det tyngste vi har. Dør det på samme enhet, er hele denne vinkelen giftig og må vites først. Se også radius-driften i `editorial.body` (§5b) — den er en visnings-innvending så lenge det er gratis, og en leveransemangel i det en faktura sendes. Løbakk har skrevet gangtidene til Brøset for hånd og er den ene leseren som ser at «Domkirken barnehage innenfor noen hundre meter» er feil.

---

## 5e. Live DOM-inspeksjon av en `hem.no`-bruktannonse — slotten finnes, og den er et kart de har bygd selv (2026-08-05)

Kjørt i Chrome med devtools mot **`hem.no/7AF8EE45-EF00-4B66-B022-2BD31AD67C46`** = *Hasselbakkvegen 5B, 7060 Charlottenlund*, merket «TRONDHEIM ØST», megler Tonje Lovise Remlo (Solsiden). GUID-en i stien er formen på en **Vitec Next oppdrags-ID** → Craft henter fra Vitec og rendrer i HEMs egen mal. Andreas' modell er bekreftet.

`hem.no` er utilgjengelig for curl og WebFetch (Cloudflare 403, ikke innlogging — sidene er offentlige). Krever egen Chrome-instans: `open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-placy"` (Chrome 136+ ignorerer debug-porten på standardprofilen).

### Teknisk: null hindringer

| Sjekk | Resultat |
|---|---|
| `content-security-policy` | **Finnes ikke.** Ikke engang report-only. |
| `x-frame-options` | `SAMEORIGIN` — gjelder *andre som rammer hem.no*, ikke hem.no som rammer oss. Irrelevant for asken. |
| `x-powered-by` | **`Craft CMS, Blitz`** (Blitz = statisk cache-plugin) |
| CSS-rammeverk | **Tailwind** (`aspect-w-1 md:aspect-h-1`, `pb-[70%] md:pb-[60%]`) |
| Sidevekt | 102 requests, **1,63 MB**, **13 054 DOM-noder**, 25 tredjepartsverter |

### `hem.no` er IKKE amatørmessig — det er wesselslokka.no som er unntaket

Kjørende på annonsesiden: **Microsoft Clarity** (`clarity.ms`, `typeof window.clarity === "function"` → **session recording/heatmaps live**), **Sentry** (feilmonitorering), **Cookiebot** (eksplisitt samtykke, alle kategorier), GTM, GA4, Facebook, Snapchat, DoubleClick, Cloudflare Insights. Dette er en instrumentert, profesjonelt bygd Craft-side. **Ingen byråkreditt i footeren** — «© 2026 Heimdal Eiendomsmegling AS», ingen «levert av» → Mustasj-hypotesen kan ikke bekreftes herfra; spør Einar.

**Konsekvens for pitchen: Einar er ikke en naiv kjøper.** Han driver Sentry, Clarity, Cookiebot, GTM og har gjennomført en Vitec-migrering. Forvent spørsmål om hva iframen laster, om den setter cookies, hvilken samtykkekategori den havner i, om han kan se den i GTM/Clarity, og hva den koster i ytelse. **Ha svarene klare.** Vurderingen «de vet ikke hva de gjør» gjelder prosjektsiden, ikke hovedsiden.

### Funnet som flytter slotten: kartet viser HEM, ikke nabolaget

Annonsesiden har **allerede et interaktivt kart** — **Leaflet 1.9.4** med **OpenFreeMap-fliser** (`tiles.openfreemap.org`, gratis, ingen Mapbox/Google-lisens), 668×401 i en Tailwind aspect-wrapper, «Åpne veibeskrivelse» → Google Maps.

**Hva de plotter i det, telt i DOM: 12 markører.** Én `icon-home` (boligen) og **elleve `avdeling`-markører med HEMs egen logo** — altså HEMs kontorer. **Null nabolags-POI-er.** Barnehagen, post-i-butikk og holdeplassene man ser i kartet er *bakt inn i OpenFreeMap-flisene*, ikke HEMs markører.

Det er den reneste produktåpningen funnet i hele sporet, og den krever ingen fornærmelse:

> **«Kartet deres viser hvor HEM ligger. Ikke hvor kjøperen skal gå.»**

### FINNs inkumbent-posisjon er svakere enn §5 antok — korreksjon

Objektsiden er en **trekkspill-stabel på 10 seksjoner**: Ukategorisert · Økonomi · Om eiendommen · **Beliggenhet og tomteforhold** · Offentlige forhold · Grunnbok · Kjøpsbetingelser · Annen viktig informasjon · **Nabolagsprofil** · Dokumenter.

**Nabolagsprofil er nr. 9 av 10, kollapset som default.** Iframen (`profil.nabolag.no/465915691?t=1`, `class="lazyload scroll-colored"`, ingen `width`/`height` — responsiv aspect-wrapper, **ikke** de 700×700 §5 loggførte) er 0×0 og laster **ikke** ved scroll. Den laster først når man klikker knappen (`<button class="flex w-full items-center text-left cursor-pointer py-4 border-b">`), og blir da 668×668. Verifisert ved faktisk klikk.

Tre følger:

1. **«De er servert av en betalende inkumbent» overdriver.** Ingen scroller forbi åtte juridiske/økonomiske trekkspill for å klikke det niende. FINN har en plass, ikke oppmerksomhet.
2. **Riktig slot å ta er ikke «ved siden av FINN på nr. 9».** Det er **kartet** (allerede synlig, over megler-kortet) eller **«Beliggenhet og tomteforhold» på nr. 4**, som semantisk er stedet.
3. **Ytelsesinnvendingen forsvinner.** Trekkspill-gated lazyload koster ingenting før klikk — motsatt av `wesselslokka.no`, der vår iframe ville gjort krasjet verre.

### Åpningsspørsmålet til Einar (bruker verktøy han alt eier)

> «Hvor mange av dem som åpner en annonse, åpner Nabolagsprofil-fanen?»

Clarity kan svare på det i løpet av minutter. **Begge svar hjelper oss:** lavt = FINNs plass er verdiløs og det reelle grepet er å flytte stedsinnhold *opp* i siden; høyt = dokumentert etterspørsel etter nettopp vårt innhold.

### Demo-mulighet som finnes i dag

Adressen er **Charlottenlund** — ett av de 7 `v2.areas`-strøkene som *har* `boundary`, og kuratert. **Et side-ved-side-oppslag på denne faktiske, aktive HEM-annonsen er byggbart nå**, uten ny kuratering. NB: den er merket «TRONDHEIM ØST» — samme sone EM1 ville ha eksklusivitet i (se `2026-08-04-em1-grilstadporten-kontor-pilot.md`). Konflikten er ikke teoretisk lenger; den har en adresse.

### Byrået er bekreftet: Mustasj (Trondheim) — og de har en uventet nabo i kundelista

`mustasj.no/arbeid/hem` bekrefter Andreas' hypotese. **Mustasj bygde og drifter `hem.no`.** Fra casen: **Craft CMS + Nuxt + ElasticSearch + Article Editor**, samarbeid **siden 2015**, løpende drift og forvaltning, og — avgjørende — **de bygde integrasjonen mot HEMs interne meglersystem** («unngå dobbeltarbeid», «eiendommer oppdateres i sanntid»). Kontaktperson navngitt på casen: **Mads**. Adresse: Ormen Langes vei 12, 7041 Trondheim.

Fire konsekvenser:

1. **De er portvokteren for bruktbolig-asken.** Twig/Tailwind-endringen i Craft-malen går gjennom Mustasj, på en drift-avtale Einar eier. Det er en kostnadslinje og en kø — ikke en blokker.
2. **De er samtidig teknisk sett den beste motparten vi kan få.** De har alt bygd Vitec-integrasjonen, så adresse, koordinater og finnkode flyter gjennom kode de eier. Vår ask er en partial som leser felt som allerede er der.
3. **Mustasj er IKKE en meglerkanal.** HEM er deres eneste eiendomskunde av 14 prosjekter. Ikke overvurder dem som flerkjede-brekkstang.
4. **Men de har SpareBank 1 SMN — to prosjekter** (Pengesmart, samfunnsnytte-kartlegging). SMN eier EM1 Midt-Norge, og `ffe-*` Felles Front End er nettopp det §1 slår fast at gjør `eiendomsmegler1.no` uembeddbar. **Ett Trondheims-byrå sitter altså både på HEMs Craft-mal og har levert digitale produkter til SpareBank 1 SMN.** Forbehold som må stå: en økonomi-læringsapp gir *ikke* commit-rettigheter i FFE, og FFE deles av 12 selskap. Dette er en **andrehånds-vei inn i SMNs digitale organisasjon**, ikke en løsning på veggen.

**Rekkefølge-anbefaling: ikke gå til Mustasj først.** Å ta byrået før kunden gjør oss til en leverandør som pitcher en underleverandør. Gå til Einar — Mustasj er *hans* leverandør. Men **nevn dem kunnskapsrikt i møtet**: det signaliserer at vi forstår stacken og avdramatiserer asken («dette er en Twig-partial i Craft, Mustasj gjør det på en time»).

*Uavklart:* casen navngir **Nuxt**, mens vi målte `x-powered-by: Craft CMS, Blitz` med Twig-rendret Tailwind-DOM. Nuxt brukes sannsynligvis til de interaktive delene (boligsøket er ElasticSearch-drevet). Ikke et problem for asken, men ikke antatt løst.

### Rettelse av rekkefølge-argumentet

Nybygg og brukt er **ikke** like enkle. På `wesselslokka.no` limer Martin Holmøy Berg inn en Embed Block selv. På `hem.no` er asken en **Twig/Tailwind-endring i Craft-malen** — liten, men det er en utviklerjobb, sannsynligvis hos et byrå, med kø og en budsjettlinje. Nybygg først står, men begrunnelsen er friksjon, ikke mulighet.

---

## 5f. Sundsøya (Inderøy) — første konkrete full-pakke-case, og det rurale asymmetri-argumentet (2026-08-11)

Andreas fant `finn.no/realestate/planned/ad.html?finnkode=468884345` — **Sundsøya, Inderøy** (Sundsøya 2, 7670): eneboliger/rekkehus/leiligheter, Eggen Arkitekter, salgsstart høst 2026, «Pris kommer». **Megler er HEM avd. Rosten** (Erik Ringseth Oxaal + Andreas Myran Steen — verifisert av Andreas' skjermbilde av annonsørkortet; NB metodefunn: FINN rendrer meglerkortet klientside, så en tekst-fetch av annonsen finner det *ikke* — meglerkort verifiseres i browser/skjermbilde, aldri via fetch). Utbygger: Sundsøya Eiendom AS (PLG Holding). Prosjektside: `nyesundsoya.no` (WordPress, `wp-content`-stier) med interessemelding-skjema. Annonsen bruker allerede «Nyttige lenker» → «Se prosjektets hjemmeside» — **asken er «én lenke til», null friksjon.**

### Full pakke — én pris, fire flater, alle målt

Casen definerer pakken som selges per nybygg-prosjekt: **(1)** Placy nivå 2 embeddet på prosjektsiden, **(2)** lenke i «Nyttige lenker» (`?src=finn`), **(3)** genererte karusellbilder i annonsens bildeslider, **(4)** kort-kode påtrykt bildene (§3b). Selges som ÉN pris per prosjekt per salgsperiode — ikke tre produkter; marginalkostnaden per ekstra flate er ~null, verdien og målbarheten stiger per flate (`?src=embed` / `?src=finn` / kode-eksklusjon). Måltallene er del av produktet: «X interessenter fra FINN-annonsen brukte nabolagskartet» er en rapport utbygger aldri har fått. **Sveipen (§3b) viste at fri lenke på prosjekt-vertikalen er åpen hos begge leverandører → full pakke er kjede-agnostisk på nybygg.** Det er den ene flaten der hele pakken alltid er mulig.

### Pris for lite prosjekt: 25–40k/salgsperiode er realistisk — og friksjonen er ikke tallet

- **Sammenlignbart i nybygg-markedspakken:** boligfilm 6–12k, 3D-visualiseringer titusener, Marketer boligvelger 50–200k, FINN-annonsering løpende. 25k ligger *under* de fleste linjene, og 2–5 % av et typisk markedsbudsjett (0,5–1,5M på 60–150M salgsverdi).
- **Friksjonen er behovsopplevelsen** («trenger vi dette for 30 boliger?») — svaret henger på forhåndssalg-fasen: interessent-lista skal bygges før salgsstart, nabolagsflaten er interessent-agn.
- **Salgskanalen avgjør:** via HEM-megleren inn i utbyggers markedspakke = realistisk; kaldt mot utbygger = tungt. Døra er Rosten-meglerne eller Einar.
- **Internt:** Inderøy er utenfor dekning (ingen strøk-polygon, tynn POI-tetthet) → håndkuratert nivå 2, 25k er nær break-even. Unntaksprising for unntaksgeografi — betalingen er distribusjonsbevis + HEM-relasjon + første eksterne faktura, ikke margin. Ikke gjør det til vane.

### Det rurale asymmetri-argumentet (Aleksander har vært på det samme)

**Informasjonsasymmetrien er størst der dataene er tynnest — og det er motsatt av hvordan inkumbenten virker.** Tilflytteren som scroller FINN fra Trondheim/Oslo kan ikke vurdere beliggenheten selv; ukjent leses som risiko, og prosjektet konkurrerer da på pris alene. Rurale prosjekter selger relokalisering — nabolagsfortellingen er halve salgsjobben.

FINNs eget «Nærområdet»-kart i annonsen **beviser poenget på skjerm**: på Sundsøya viser det 2–3 pins (busstopp, idrettsanlegg) på hele kartutsnittet — et uniformt databaseprodukt som får området til å **se tomt ut**. Samme komponent som er ok på Majorstua, er et negativt utsagn om beliggenheten på Inderøy. Og reisetids-funksjonen («Legg til sted») outsourcer personaliseringen til kjøperen — tilflytteren, som trenger den mest, vet ikke hva den skulle lagt inn. FINN/Nabolagsprofil blir *dårligere* jo mer ruralt (tynnere data, mer generisk); Placys kuraterte fortelling blir *viktigere* i samme retning. **Ruralt er der inkumbenten er svakest og behovet størst** — en posisjoneringsakse, ikke bare et salgsargument.

Dette sorterer rett inn i to-SKU-modellen: **by** = tetthet → automatisert nivå 1 → grunnpakke-volum via kjede; **ruralt** = asymmetri → håndkuratert nivå 2 → prosjekt-SKU der utbygger betaler for fortellingen. Trondheim-only-beslutningen for nabolagsprototypen står urørt — den gjaldt den *automatiserte* pipelinen, ikke betalingsviljen. **Motvekt:** per-strøk-amortiseringen (Brøset-logikken) forsvinner ruralt — kurateringen betjener ett prosjekt, ferdig. Rurale nivå 2-er er stykkgods med tynn margin, aldri volumbutikk.

### Pitch-mekanikk: side-ved-side-demoen

Demoen til HEM/utbygger kan bokstavelig talt være **FINNs Nærområdet-kart til venstre, Placy-boardet for samme adresse til høyre** — skillet mellom datapunkter og lokalkunnskap er synlig på tre sekunder, ingen forklaring nødvendig. Samme grep som «stedene + målingen» fra LocalLogic-notatet, men med FINNs egen flate som motpart. Tilflytting-vinkelen gir dessuten Rosten-meglerne et argument *de* kan bruke mot utbygger: «interessentene deres sitter ikke på Inderøy — de må få området forklart digitalt». Da selger megleren Placy for oss.

**HEM-konsekvens:** avd. Rosten er en **tredje dør** inn i HEM (i tillegg til Einar it/marked og Løbakk/Wesselsløkka) — to navngitte meglere på et prosjekt som trenger forhåndssalg-trekk *nå*. Siden kjøperen er HEM gjelder §5c-advarslene konkret: **to-SKU-skillet i første prissetning, aldri per-enhet-regning høyt.**

*Status: case identifisert, ingen kontakt tatt. Full pakke henger på bildegeneratoren + kort-koden (åpen beslutning 5 / §3b); selve embed'en på en WordPress-utbyggerside er friksjonsfri (utbyggers side, ikke HEMs malverk — samme mønster som wesselslokka.no).*

---

## 6. Benchmark: FINN Nabolagsprofil vs. Placy på samme adresse

Kjørt på **Østmovegen 6 D, 7056 Ranheim** — Frank Roberts aktive salg, finnkode 466816966 → `profil.nabolag.no/466816966`, mot vårt kuraterte Ranheim-innhold i prod.

**Leverandør-korreksjon:** `nabolag.no` redirigerer til `finn.no/nabolag/sporsmal`, og kildesiden navngir **Finn.no som operatør** («For å oppnå høyest mulig kvalitet har Finn.no i tillegg flere distribusjonspartnere»). Det åpne spørsmålet i 07-09-doccen (Eiendomsprofil uavhengig eller FINN-intern) peker altså mot **FINN-operert**. Konsekvens: HEM embedder FINNs produkt på sine egne objektsider, og «bryte med leverandøren» betyr å bryte med FINN.

### Hva de viser

Solforhold (terrenghorisont + solbane, levert av Geodata AS). Buss Presthus 5 min, Ranheim stasjon 15 min, knutepunkt 20 min. Fem skoler, tre barnehager, fire idrettsanlegg med minutter. 42 % barnefamilier mot Trondheims 28 %. «Vurdert av 82 lokalkjente». Reisetid-verktøy, sammenlign-med-der-du-bor, seks kategorier, kart.

Og fem tall:

| | Adressen | Trondheim | Merkelapp |
|---|---|---|---|
| Trygghet | 87 | 86 | «Veldig trygt» |
| Skoler | 89 | 83 | «Veldig bra» |
| **Kollektiv** | **85** | **86** | **«Meget godt kollektivtilbud»** |
| Barnehage | 91 | 86 | «Veldig bra» |
| Turmuligheter | 83 | 82 | «Nærhet til skog og mark» |

**Andreas' innvending — *«at 64 % er høflige i et nabolag er jo bare tull, 95 % nærhet til marka, javel?»* — er nå tallfestet:** tre av fem ligger 1–6 poeng fra bysnittet, og kollektivtilbudet er **under** snittet mens det står «meget godt». Deres egen kildeside sier hvorfor: vurderingene er *«aggregerte svar … om nabolagets kvaliteter **og inntrykk**»* og *«vises kun hvis det finnes **mer enn 10 besvarelser**»* — et nabolag kan karakteriseres for hver boligkjøper i Norge på grunnlag av elleve menneskers inntrykk.

### Tre demonstrerbare feil på vår adresse

1. Overskrift **«Kort gangavstand til offentlig transport»** — knutepunktet står med **20 minutter**.
2. Overskrift **«Gangavstand til skole»** — Charlottenlund barneskole står med **5 min**, som i deres egen payload er `"distanceType":"drive"`. Nærskolen, Ranheim skole, står med 11 min gange. **En barnefamilie konkluderer med feil skole** — den viktigste enkeltopplysningen i kjøpet.
3. Adressen er 7056 Ranheim, men føres under nabolaget **«Grillstad/Nerviksvegen»** — og de 82 lokalkjente har vurdert *det* området.

**Og det avgjørende:** produktet inneholder **ikke ett sted et menneske ville valgt å gå til.** Ingen kafé, bakeri, strand eller butikk. «Handel» er en kategori uten innhold på forsiden. Det er statistikk om et nabolag, ikke nabolaget.

**Kildene deres er våre kilder:** reisetider fra **Entur + Google**, demografi/matrikkel/solforhold fra **Geodata AS**, POI-er fra «utvalgte innholdsleverandører». Deres fortrinn er ikke data. Det er distribusjon.

### Hva vi viser (Ranheim, kuratert, prod: 81 POI-er, 6 kategorier)

> «Ranheim er en av få bydeler i Trondheim med egen togstasjon — lokaltoget tar deg til Trondheim S på rundt ti minutter, og videre mot Værnes uten bytte.»

> «Ranheim er bygget for barnefamilier — bokstavelig talt: utbyggingen av fjæra-områdene har skjedd med barnehager, lekeplasser og skolevei som premiss, ikke etterpåklokskap.»

Navngitte steder med grunn: Dromedar Kaffebar Overvik, Rosenborg Bakeri på Grilstad, Restaurant Romantica («langt etablert pizzeria med trofaste gjester»), Grilstadstranda, Tømmerstranda, Hansbakkfjæra, Ladestien («åtte kilometer kyststi … tilrettelagt for barnevogn og rullestol»), Ranheim skole («nærskolen i Overviks barneskolekrets»). **Null score.** Fullskjerm på mobil mot deres 700 × 700-iframe.

### Vår egen svakhet i samme datasett (må fikses før demo)

Vi har **den samme gjenbruksfeilen vi anklager EM1 for**:

- Tre badeplasser med ordrett samme setning: *«X er en populær badeplass langs Trondheimsfjorden»* + *«Sjønær bading i sommerhalvåret. Kort vei fra Overvik.»*
- To lekeplasser identisk; to grøntområder identisk
- **Grillstadfjæra og Ranheimsfjæra barnehage har ord-for-ord identisk hook og innsikt**
- Hansbakken skole har ingen tekst
- *«Kort vei fra Overvik»* står på steder som serveres til en **Østmovegen**-adresse — samme klasse feil som deres «Grillstad/Nerviksvegen»

Andreas' vurdering: dette er demo-data, så det er ingen ansvarssak. **Enig i det — men det er boardet Frank Robert klikker i, og han klikker på tre badeplasser fordi det er hans strøk.** Demo-kvalitetssak, ~30 min: vask duplikat-hooks på søsken-POIer i Ranheim/Charlottenlund, og fjern/parametrisér delområde-ankeret. Utsatt til møtet er bekreftet.

### Verdikten

- **Vi vinner på:** navngitte steder med en grunn, prosa som sier hva bydelen *er*, ingen pseudotall, drill-in per kategori, mobil-native flate.
- **De vinner på:** solforhold (vi har det ikke, og det er dyrt), nasjonal dekning, demografi — og **de sier aldri noe spesifikt nok til å kunne tas på.** Det er den *egentlige* grunnen til at det kjedelige ble standarden: institusjonell dekning uten ansvarsflate.
- **Produktkravet som følger:** vinneren er **spesifikk og uangripelig**, ikke bare mer spesifikk. Derfor må nivå 1 være komplett og faktuell, megler-utvalget **additivt aldri subtraktivt**, og stemmen skrives i presens uten årstall som forfaller (`feedback_editorial_no_years_history`).
- **«Slåbar på dybde» (07-09 §17) er for optimistisk formulert** — de har gangtidene, de har et lokalkunnskap-lag, og de sitter i begge flatene. Det de mangler er *stedene* og *målingen tilbake til megleren*.

### Salgsartefakt

**De to på én skjerm, på en adresse i et strøk vi har kuratert.** Bruk finnkoden fra annonsen → `profil.nabolag.no/<finnkode>`. For Østmovegen 6 D: `466816966`. Testspørsmålet i rommet: *«Hva husker du av dette om ti sekunder?»*

---

## 7. Konsekvenser

**a) Markedseksklusivitet koster nå noe konkret.** `2026-08-04-em1-grilstadporten-kontor-pilot.md` §6.1 sa at eksklusivitet i Trondheim Øst «koster ingenting i dag». Det var sant før vi visste at HEM er embed-kandidaten. To utveier:
- **Ikke tilby eksklusivitet i det hele tatt** — EM1 har ikke spurt om den. Å gi bort noe ingen har bedt om, for å stenge sitt eget nest beste spor, er dårlig handel.
- Eller tegn den så smalt at den ikke biter: **bruktbolig, Trondheim Øst, kun i pilotperioden.** HEMs bruktstyrke ligger sentrum/vest/sør; deres Trondheim Øst-objekter er nesten alle nybyggprosjekter (Berg Hageby, Solsletta, Prinsessehagen, Bonesvegen). Da kan sporene løpe parallelt.
- **Merk korreksjon:** HEM *har* Trondheim Øst-objekter (Brøsetvegen 2B m.fl.) — geografisk separasjon er mindre enn først antydet i denne sesjonen.

**b) Visma/Webtop er en distribusjonspartner, ikke en embed-nøkkel.** Andreas' instinkt var at veien går via leverandøren. Men **objektsiden er ikke Webtops** — den er SpareBank 1s FFE. Et Visma-partnerskap plasserer Placy i meglerens arbeidsflyt, i det som syndikeres, og potensielt i prospektet. SpareBank 1 må fortsatt rendre flaten. Og sekvensen er hard: enhver systemleverandør spør *«hvor mange av våre kunder ber om dette?»* → **Visma-sporet krever at EM1 eller HEM lever først.**

**c) Aleksander-tildelingen må avklares før den gis.** Mandatet hans var utbygger-først = relasjonssalg i eiendomsbransjen. Enterprise-BD mot et programvarekonsern er en annen øvelse (lange sykluser, roadmap-kø, revenue share). Avklar om han har *den* erfaringen, ellers ligger sporet stille i seks måneder.

**d) Anbefalt sekvens:**
1. **Kjør EM1-møtet** med ærlig ramme: bilde i karusellen, lenke og QR i oppfølgingen, måling fra dag én. Ikke embed. Døra til Kristian kjøper **data, referanse og introduksjonen til EM1 Midt-Norge** — fortsatt det høyest verdsatte tilgjengelige. Den er ikke bortkastet, den kjøper noe annet enn antatt.
2. **Ingen eksklusivitet, eller smalt tegnet.**
3. **HEM parallelt som embed-sporet.** Minste tekniske ask i hele materialet.
4. **Visma parkert** til én av dem lever med tall.

---

## Åpne beslutninger

1. **Tilbys markedseksklusivitet til EM1 i det hele tatt?** (Anbefaling: nei, eller «bruktbolig / Trondheim Øst / kun pilotperioden».)
2. **Går HEM-sporet parallelt med EM1, eller etter?** → **Delvis besvart av §5b: Wesselsløkka bør gå FØR EM1**, fordi den gir en levende embed-referanse å møte EM1 med.
3. ~~**Hvem tar HEM?** Ingen varm kontakt identifisert~~ → **BESVART (§5b): Wesselsløkka er den varme døra.** Gjenstår: hvem eier kontakten — Andreas (megler-spor) eller Aleksander (utbygger-mandat)?
4. **Har Aleksander enterprise-BD-profil for Visma-sporet?**
5. **Bygges nabolagskart-bildegeneratoren før EM1-møtet?** Uten den er karusell-flaten en påstand, ikke et artefakt.
6. **Rettes radius-driften i Wesselsløkka-boardets `editorial.body`-tekster før det vises til Heimdal?** (§5b — `leadText` er riktig, `editorial.body` peker på POI-er 2–3 km unna som «nærmeste». Utsatt av Andreas 08-04, men er en visnings-blokker.)
7. **Bygges georeferert 3D-modell-støtte (`gmp-model-3d`) som addon?** Krever utbyggerens IFC/GLB, eller massing fra situasjonsplan. Ikke i grunnpakken.
8. **(2026-08-11, §3b) Eksponerer Webtop/Visma fri lenke («Nyttige lenker») for megler per oppdrag, slik Vitec Next gjør?** → **DELVIS BESVART av 187-annonse-sveipet samme dag:** Webtop har fri tekst + vilkårlig URL på **prosjekt**-annonser (Villa Granheim-beviset), men 0 av ~119 på **brukt** — feltet ser prosjekt-gatet ut i Webtop-UI-et. Gjenstår: bekrefte i selve Webtop-UI-et om brukt-oppdrag har feltet (Kristian/Frank Robert), og om Vitec-brukt-feltet er standard eller DNB-konfig (Einar/HEM). Og fortsatt: er FINN-lenkefeltet gatet på «utvidet prospekt»-pakken?

---

## Metode-forbehold

`eiendomsmegler1.no`: robots.txt/vilkår forbyr systematisk innhenting — all analyse i §1–3 er kjørt på det eksisterende 153-siders cachede datasettet fra §2a-arbeidet (hentet med 3 sek pause), pluss én HEAD/range-forespørsel mot Webtop-filendepunktet. `hem.no`: robots.txt tillater objektsider, men Cloudflare bot-beskyttelse blokkerer curl/WebFetch → inspisert i en separat Chrome-instans (debug-port, egen profil). `profil.nabolag.no`: offentlige iframe-URLer, hentet direkte. **Datainnsamlingen skal ikke være en del av historien i noe møte.**

---

## Koblinger

- `2026-08-04-em1-grilstadporten-kontor-pilot.md` — kontor-piloten; §3b (distribusjonsvirkeligheten), §6.1 (eksklusivitet korrigert), §6b (megler-utvalg som utvalget bildene bygger på)
- `2026-07-09-megler-system-distribusjons-wedge.md` — korrigeres her: (a) EM1 Midt-Norge = **Webtop/Visma**, HEM = **Vitec Next** (bekreftet, sto som «ukjent»/«bekreftet» respektivt); (b) åpent spørsmål 1 peker mot **FINN-operert**; (c) «slåbar på dybde» er for optimistisk — inkumbenten har gangtider + eget lokalkunnskap-lag
- `2026-07-09-locallogic-benchmark-eiendom.md` — score-primitivet forkastet; inkumbenten er bygd på det = differensieringsaksen
- `2026-06-27-premium-single-bruktmarked-spor.md` §7–9 — widget-fellen, grunnpakke 500–800, «vinn én kjede»
- `2026-06-23-aleksander-kommersialisering-utbygger-spor.md` — mandatet som må avklares mot Visma-sporet
- `aktor-map.md` — HEM, Visma Real Estate/Webtop, FINN/nabolag.no
