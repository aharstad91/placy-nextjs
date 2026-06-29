# Data-moatene: Lokalkunnskap (Moat 1) + Innsikt (Moat 2)

**Dato:** 2026-06-27
**Type:** Strategi/produkt-design (de to data-moatene — plan, tracking-katalog, arkitektur)
**Deltakere:** Andreas + Claude
**Status:** Aktiv — navn låst, plan + tracking-katalog + per-board-arkitektur landet. Moat 2 skjerpet 2026-06-28 (kontekst-konvolutt, viewport-heat maps, konsentrert-volum-validering, UX-som-instrument — se egen seksjon). Build-input til sommer-rebuilden ([[project_summer_rebuild]]); må inn **fra linje 1**.

> De to moatene ble identifisert i Markus-praten (`2026-06-25`) som «tosidig moat» og oppsummert i `2026-06-27-premium-single-bruktmarked-spor.md` seksjon 9. Dette dokumentet navngir dem og legger den operative planen.

**Navn (låst 2026-06-27):**
- **Moat 1 = Lokalkunnskap** — tilbudssiden: hva som ER der.
- **Moat 2 = Innsikt** — etterspørselssiden: hva kjøpere VIL ha.

---

## Den avgjørende distinksjonen (gjelder begge): to lag, ikke ett

**Lag A — commodity-innhenting.** Offentlig tilgjengelig (kommune-data, OSM, parker, holdeplasser, sol). Gjør Placy *bedre enn Google/Finn* (de gidder ikke), men er **ikke en moat mot en seriøs konkurrent** (Norkart kan hente samme kilder). Table stakes.

**Lag B — proprietær kuratering + akkumulering.** Lokal innsikt, verifisering, redaksjonell kontekst, bilder, levd kunnskap, aggregert engasjement. Finnes i ingen database, kan ikke skrapes. **Dette er moaten.**

Grepet: **Lag A er stillaset som gjør Lag B billig å produsere** — auto-ingest alt offentlig så kuratoren aldri starter på blankt ark; de reviderer/beriker de siste 10 % som er gullet.

---

## Moat 1 — Lokalkunnskap (tilbudssiden)

### IP-realiteten (skjerper «Placy-eid IP»)
- **OSM er ODbL** (share-alike): kan brukes m/ attribusjon, men rå-OSM-punkter kan **ikke gjerdes inn som Placys eiendom**.
- **Kommune/Geonorge er typisk NLOD/CC-BY**: gratis m/ attribusjon, men commodity.
- Konsekvens: **det ownbare moat-laget er kuratering-laget oppå punktene** — den verifiserte, kontekstualiserte, foto-dokumenterte, engasjement-rangerte kunnskapen om hvilke punkter som betyr noe og hvorfor. Ikke rådataen.

### Kildene (Lag A — ingest-pipeline)
Geonorge (WFS/WMS), Kartverket (Matrikkel/adresser/høyde), kommunens kart-API (taxi-holdeplasser, lekeplasser, idrettsanlegg, turstier, skolekretser — polygoner finnes alt), Entur (`/api/entur`), GBFS bysykkel (`/api/bysykkel`), evt. Miljødirektoratet Naturbase. **OSM via Overpass** er gull for hyperlokale amenities Google mangler: `leisure=pitch` (sport=volleyball), `playground`, `outdoor_fitness`, `viewpoint`, `dog_park`. Forbehold: ujevn dekning + varierende kvalitet + ODbL.

### Admin/mapping-verktøy (rebuild-leveranse)
- **Delt, strøk-indeksert `pois`-tabell i Supabase** — *ikke* per-prosjekt-JSON. Dette er selve moat-fra-linje-1-poenget.
- **Kart-admin (Mapbox):** se alle punkter i et strøk, filtrer på source/kategori/status; **review-kø** for ingestede punkter (godkjenn/berik/forkast); klikk-å-legg-til m/ skjema (kategori, navn, `editorialHook`, `localInsight`, bilder, kilde, confidence, status).
- Eksisterende brikker: POI-typene har alt `editorialHook`/`localInsight`; `curator`-skill (redaksjonell stemme); `validate-poi-trust`-skill. Mangler: delt DB + CRUD-admin på kart.

### Megler-UGC (flywheelen) — **desktop, ikke mobil**
Megler-bidrag skjer på **data/desktop** (korrigert 2026-06-27 — admin/bidrags-flaten er desktop-først; sluttbruker-boardet forblir mobil-først; to forskjellige flater). Mekanikk: ved board-opprettelse får megler lenke → ser **auto-fylt** nærområde-kart → bekrefter/korrigerer, legger til egne perler, laster opp bilder, skriver innsikt → lander i Placys delte DB.
- Hvorfor det funker: megleren er motivert (beriker → bedre listing → selger bedre). Gratis, motivert kuratering-arbeidskraft. Asymmetrien mot Norkart (de har geodata-ingeniører, ikke en megler-drevet kuratering-flywheel koblet til et salgsprodukt).
- Guardrails: forhåndsfyll (bekreft, ikke skap); lett moderering (`status=megler-bidrag` → spot-sjekk før publisert); bilde-opplasting til Supabase storage; ToS/eierskap eksplisitt (Placy eier bidraget — Markus' term-sheet-poeng).

### Provenance + confidence + freshness (førsteklasses felt)
Hvert punkt bærer `source`, `contributor`, `verified_at`, `confidence`, `status`. Tre grunner: tillit (`validate-poi-trust`), vite hva som er commodity vs. ownbar IP, og at **lokalkunnskap råtner** (kafé legger ned) → re-verifiserings-mekanisme nødvendig.

---

## Moat 2 — Innsikt (etterspørselssiden)

### Hvorfor den er mindre opplagt
Lokalkunnskap har et fysisk referansepunkt (punkter på kart). Innsikt er **usynlig atferds-eksos** — verdien materialiserer seg først aggregert + tolket. Det vanskelige er ikke trackingen (triviell), men **å gjøre eksos om til en fortelling noen betaler for.** Verdien er asymmetrisk: board nr. 1 = nær verdiløs; aggregatet fra board nr. 500 = unik markedsintel ingen andre har (fordi ingen andre eier engasjementsflaten for nærområde-vurdering).

### Det viktigste: Innsikt gjør grunnpakka KLEBRIG
I dag = statisk board (engangs). Med en engasjements-rapport leverer Placy verdi *etter* levering, hver uke listingen er live → **mekanismen som gjør engangssalg → ARR.** Uten Innsikt er grunnpakka bare et widget (Norkart-skjebne). Med Innsikt er den et levende verktøy megleren ikke vil være uten. Innsikt er altså det som rettferdiggjør at megleren betaler *løpende* for grunnpakka ([[project_placy_grunnpakke_chain_model]]).

### Tracking-katalog (hva vi måler — sted-intensjon, ikke generisk analytics)
**A. POI/kategori:** hvilken POI åpnes + tid; **rekkefølge kategorier åpnes (første = topp-prioritet) ⭐**; «les mer»-ekspansjon; foto-swipes; hva de vender tilbake til.
**B. Kart:** pan/zoom-retning; 3D/flythrough-engasjement; **reisemodus-toggle (pendler-bekymring) ⭐**; tidsbudsjett-valg; **rute-forespørsler «fra boligen til X» = rikeste enkelt-signal (hvilke destinasjoner betyr noe: jobb/skole/treningssenter/mormor) ⭐⭐**; solkart-bruk.
**C. Uttalt intensjon:** søk/filter-termer; **interaktiv nudge «hva leter du etter / hva mangler du?» = fanger demand boardet ikke viser, gap-deteksjon ⭐⭐**.
**D. Media:** VO/audio fullføringsrate + hvor de faller av; Reels/boligfilm sett; segmenter spilt på nytt.
**E. Økt/funnel:** lengde/dybde/scroll; enhet, tid på døgnet, ukedag; inngangskilde (QR/Finn/mail/SOME); **retur-besøk over dager (høy interesse) ⭐**; del-handlinger; CTA «bestill visning»-klikk.
**F. Avledet (aggregert):** kategori-prioritetsrangering; «heat» per POI; drop-off-punkter; **per-listing vs strøk-baseline-delta ⭐**; segment-inferens (familie/ung/senior) fra kategori-miks, kun aggregert.

De to ⭐⭐ (rute-forespørsler + «hva leter du etter»-nudgen) er der den egentlige avslørte/uttalte preferansen ligger.

### Personvern-arkitektur = en FEATURE
Anonym + aggregert, aldri individuell. «73 % åpnet skole-seksjonen», ikke «bruker X». Ingen innlogging/PII/kryss-side-profiler/retargeting-cookies (parkert i loggen, riktig). GDPR-rent OG mer salgbart: markedsinnsikt, ikke overvåkning. Aggregatet *er* moaten.

### Verdi-stigen (hvem betaler / hva er produktet)
1. **Per-board megler-rapport** (nå, lett): «kjøperne brukte mest tid på skole + transport → led visningen med den historien.» Pakket som *handling*, ikke tallsuppe. = grunnpakke-klebrighet/ARR.
2. **Strøk-aggregat** (volum-gated): «på tvers av 40 Ranheim-listinger prioriterer familiekjøpere skole + uteliv.» Selges som markedsintel.
3. **Utbygger-ammunisjon** (250k-tier): «Overvik markedsføres til alle; dataen viser at X betyr mest her.»
4. **(Senere) Prediktiv/matching** — langt frem, ikke nå.

Rung 1 bygges først (wedge). Rung 2–3 = der moaten blir aktivum, men krever volum.

### Per-board arkitektur — ÉN strøm, ikke siloer
- Instrumenteringen **bakes inn i board-malen**: board får `board_id` ved opprettelse, sender events fra første visning. Null per-board oppsett. Tracker umiddelbart.
- **IKKE separat analytics-instans per board** — det fragmenterer dataen og dreper aggregat-moaten. I stedet: **én sentral event-strøm** (Supabase); «per-board analytics» = spørring filtrert på `board_id`; samme data rulles opp per strøk + globalt. Per-board-rapport og strøk-aggregat er to views på samme strøm.
- **Capture vs refresh:** fang rå-events i sanntid (mister aldri data); beregn megler-rapport på batch hver X timer (6–24t) — ikke tidskritisk, billigere, lar deg legge på volum-terskler. Live on-read kan komme senere.
- Event-skjema (lite kjerne + kontekst-konvolutt): `board_id`, `strøk`, `target` (poi/kategori/rute), `event_type`, `timestamp`, anonym `session_id` — **pluss en `context`-konvolutt på HVERT event** (se skjerpings-seksjonen): `mode` (free/kategori) + aktive kategorier, `travel_mode`, `time_budget`, `map_center` (lat/lng), `map_zoom`, `home_anchored` (bool). Konteksten reiser med eventet → aldri rekonstruér tilstand i ettertid. Events skrives via server (ikke direkte Supabase fra klient, jf. CLAUDE.md).

### Innsikt-skjerping (2026-06-28): kontekst, heat maps, konsentrert volum, UX-som-instrument

Fire grep som hever Moat 2 fra «tellinger» til «forsvarbar segmentert etterspørsel».

**1. Viewport-heat maps (intern, ikke offentlig).** Megler får en *privat* analyse-visning: et kart som samler hvor folk ser, panorerer, zoomer inn, og hvilke punkter som klikkes. To presiseringer:
- **Vekt etter intensjon, ikke aktivitet.** Zoom-inn + dwell (viewport står stille) > rå panorering (planløs). Rute-forespørsler «fra boligen til X» vektes høyest (intensjon, ikke bare engasjement). Delta-mot-strøk > absolutte klikk (den kjente kafeen får klikk uansett — bare berømmelse; avviket fra strøk-snittet sier noe om *denne* listingens kjøpere).
- **To visninger, samme strøm:** *per-board-dashboard* (megleren ser sin egen listings engasjement → klebrighet/ARR) vs. *aggregert strøk-heat map* (markedsintel på tvers → sellbart produkt til utbygger/kjede senere). Intern i v1 (tillit, ingen creepiness).

**2. Kontekst-konvolutt = confounding-fiksen (det viktigste grepet).** Et rått klikk lyver. Ranheim skole ligger langs Ladestien → et skole-klikk i *natur-kontekst* betyr «jeg utforsker turstien», ikke «jeg vurderer skolen». Et tvetydig signal er verre enn ingen (ser ut som innsikt). Fiks: hvert event bærer tilstanden brukeren var i (modus + aktive kategorier, travel_mode, time_budget, viewport, hjem-anker). Da blir skole-i-skolekontekst og skole-i-naturkontekst to forskjellige tall.
- **Løftet: kontekst gjør engasjement om til *segmentering*.** Skiller du natur- fra skole- fra transport-kontekst på tvers av mange sessions, kan du klynge kjøperne i et strøk: (a) friluftsorienterte unge par, (b) familier som optimaliserer skole+pendling, (c) nedsizende som verdsetter kollektiv. Spranget fra *«hva er populært»* → *«hvem er kjøperne, og hvilke segmenter finnes»*. For utbygger: «bygg for segmentet som dominerer her». For megler: «markedsfør mot segment Y». Anekdoten blir persona-attribuert og forsvarbar: ikke «folk klikket på skolen» (svakt), men «av kjøperne som aktivt utforsket skole-konteksten sjekket 70 % gangavstand i walk-modus» (overlever gransking).
- **Negativ-rom er også signal:** hva folk *ignorerer* der det er relevant (i transport-kontekst, aldri sjekker bussen 200m unna → bil-folk). Lesbart kun med kjent kontekst.
- **Sekvens er en kontekst-dimensjon:** natur → umiddelbart skole avslører familie-som-verdsetter-friluft. Hjem-ankrede stier er de reneste signalene.
- **Granularitet-vs-volum-spenning + resolusjon:** flere dimensjoner splitter de samme sessions i flere bøtter, hver trenger volum for signifikans. Prinsipp: **fang maksimalt granulert (billig), rapportér kun over en volum-/konfidens-terskel.** Du kan alltid aggregere opp — aldri disaggregere ned.

**3. Konsentrert volum validerer raskere enn spredt.** «Jo flere boards, jo mer validert» — riktig, med statistisk bunn: ett boards heat map er anekdote (få sessions = støy); dataen blir validert først på strøk-aggregat. **100 boards spredt over 100 strøk = 100 anekdoter; 100 boards i 5 strøk = 5 validerte strøk-profiler.** Dybde slår bredde. Synergi: **«vinn én kjede» og «volum validerer moaten» er samme trekk** — EM1 ~60 % i Trondheim → vinner du dem får du konsentrert, samme-strøk-volum → raskeste vei til validert Innsikt. «Volum inn mot privatmarked» presiseres til «volum i *konsentrerte* strøk». Ranheim-først er ikke bare pilot — det er datavaliderings-strategien.

**4. UX er datainnsamlings-apparatet (ikke passiv tracking).** Signalet finnes bare hvis UX-en *fremkaller* det. To konkrete grep inn i rebuilden:
- **Travel-mode (gå/sykkel/bil) må gjøres synlig og fristende å bruke** — er toggelen gjemt, får vi ingen pendler-intensjon å lese. UI-elementene som gjør folk bevisste på reisemodus er en forutsetning for signal B-⭐, ikke kosmetikk.
- **Kategori-rekkefølge som både nudge og signal:** rekkefølgen kategoriene presenteres i styrer hva folk åpner først (nudge), *og* rekkefølgen de selv åpner i er topp-prioritets-signalet (⭐). Mulig smart grep: la rekkefølgen tilpasse seg (per strøk-segment eller per session) — men logg alltid den *presenterte* rekkefølgen i kontekst-konvolutten, ellers kan ikke åpne-rekkefølge-signalet tolkes (confounder: åpnet de skole først fordi de bryr seg, eller fordi den lå øverst?).

### Ærlige harde deler
Volum-gating (rung 2–3 låses opp på samme distribusjon som grunnpakka → trenger kjede-avtalen); korrelasjon ≠ kausalitet (klikk ≠ kjøpsintensjon, vær ydmyk); statistisk ærlighet (volum-terskler før rapportering); ikke over-monetiser tidlig (bruk først som klebrighet + utbygger-ammo).

---

## Kryss-moat-løkka + fokus

- **Innsikt** forteller hvilke **Lokalkunnskap**-punkter som betyr noe → prioriter kuratering/re-verifisering der.
- **Lokalkunnskap** gjør **Innsikt** rikere (engasjement på et kuratert lokalt punkt er mer informativt enn på et generisk «park»).
- Sammen ko-evolverer de mot «nærområde-kunnskapen som faktisk flytter kjøpere».
- **Akkumulerings-løkka er den egentlige moaten** — ikke dataen, men maskinen: rikere strøk → bedre board → lettere salg → flere meglere → mer berikelse.
- **Disiplin:** ett strøk (Ranheim) til dyp dekning først, bevis løkka, så ekspander (Markus' dekningskart-grep). Nabolag/strøk/skolekrets er aggregerings-aksen (polygoner finnes, jf. `project_nabolag_trondheim_scope`).

---

## Build-imperativer for rebuilden (fra linje 1)
1. **Lokalkunnskap:** delt strøk-indeksert `pois`-DB med provenance/confidence/status som førsteklasses felt (ikke per-prosjekt-JSON) + kart-admin (desktop) + megler-bidrags-flate (desktop).
2. **Innsikt:** ren event-strøm fra board v1, ÉN sentral strøm sliced per board, anonym/aggregert, batch-aggregert rapport. Fang nå, analyser senere.
3. Begge: strøk/skolekrets som indekserings- og aggregerings-enhet.

## Koblinger
- `2026-06-25-markus-bruktmegler-vs-utbygger.md` (moatene først identifisert som «tosidig moat»)
- `2026-06-27-premium-single-bruktmarked-spor.md` seksjon 7–9 (Solkart/Norkart-benchmark, grunnpakke, moatene høynivå)
- `[[project_summer_rebuild]]` (begge moatene må inn fra linje 1)
- `[[project_placy_grunnpakke_chain_model]]` (Innsikt = ARR-mekanismen for grunnpakka)
