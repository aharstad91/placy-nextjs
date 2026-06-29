# Moat 1 (Lokalkunnskap) — strategi → build-input for rebuilden

> **Dato:** 2026-06-28
> **Type:** Strategi→build-bro. Kobler forretnings-/produktdesignet av Moat 1 til de eksisterende rebuild-PRD-ene. **Ikke en ny PRD** — input til `prd/08-lokalkunnskap-moat.md` (+ berører PRD 3, 12, 15).
> **Kilder:** `docs/strategy/2026-06-27-data-moatene-lokalkunnskap-innsikt.md` (full moat-design), `docs/strategy/2026-06-27-premium-single-bruktmarked-spor.md` §9, memory `project_placy_grunnpakke_chain_model`, `project_markus_bruktmegler_spor`.
> **Mål:** At den strategiske moat-designen er reflektert i byggrekkefølgen før beads/ralphy kjører — eller eksplisitt deferret med peker, ikke tapt.

---

## TL;DR

PRD 8 er **moden og strategisk på linje** med Lokalkunnskap-designen: den eier kuraterings-/arve-systemet som Placy-eid IP, har provenance-felt, og holder «ÉN Placy-validert kanon»-tenancy-modellen. Lag A/B-distinksjonen mapper rent på den eksisterende grafen (Lag A = PRD 3-ingest, Lag B = PRD 8-kuratering). **Tre ting fra strategien er ikke specet i en leveranse-unit og bør avklares:** (1) megler-UGC-flaten (den selvbetjente berikelses-flywheelen), (2) «Meglers tanker» (attributert megler-stemme), (3) freshness/re-verifiserings-løkka. Alle tre kan følge etter MVP — men eierskap bør låses nå så de ikke faller mellom PRD 8/12/15.

---

## 1. Hva PRD 8 allerede treffer (ikke rør — bekreftet på linje med strategien)

| Strategi-prinsipp | Dekket i PRD 8 |
|---|---|
| Lokalkunnskap = **Placy-eid IP**, ikke kundens/meglerens | §1 + §6 tenancy-note: ÉN standardisert Placy-validert kanon per nærområde; meglere bidrar additivt; eierskap eksplisitt Placy (term-sheet-poeng) |
| **Delt, strøk-indeksert DB** (ikke per-prosjekt-JSON) | `place_knowledge` + `areas.report_editorial` arvet per skolekrets-polygon; PRD 1 eier skjemaet |
| **Provenance/confidence** som førsteklasses felt | `place_knowledge`: `confidence`, `source_url`, `source_name`, `verified_at`, `display_ready`; trust-gate i lese-stien |
| **Lag B er det ownbare** (kuratering, ikke rådata) | Hele PRD 8 eier kuraterings-/arve-SYSTEMET; lese-stien gater på trust + `display_ready` |
| Strøk/skolekrets som aggregerings-akse | `find-area-for-point` → skolekrets-polygon; editorial arvet ned per polygon |

**Lag A/B-distinksjonen mapper rent på grafen — bekreft, ikke bygg om:**
- **Lag A (commodity-ingest — table stakes):** `import-public-pois` (NSR/Barnehagefakta/Overpass) lever i **PRD 3 (provisjon)**, distinkt fra Google-importen. Det er riktig sted — Lag A er stillas, ikke moat.
- **Lag B (kuratering — moaten):** **PRD 8.** IP-realiteten (OSM = ODbL, kommune/Geonorge = NLOD → rådata kan ikke gjerdes inn) bekrefter nettopp at det ownbare er kuratering-laget PRD 8 eier. Strategien og PRD-en sier det samme.

> **Konklusjon:** Moat 1s *kjerne* er bygget riktig. Gapene under er additive flater og løkker, ikke en omskriving.

---

## 2. Gap: hva strategien la til som ikke har en leveranse-unit

### Gap 1 — Megler-UGC-flaten (den selvbetjente berikelses-flywheelen) — eierskap uavklart

**Strategien:** Kjernen i Lokalkunnskap-flywheelen er at megleren selv beriker sin listings nærområde (på **desktop**): får lenke → ser auto-fylt kart → bekrefter/korrigerer, legger til egne perler, laster opp bilder, skriver innsikt → lander i Placys delte DB. «Jo enklere og bedre muligheter vi gir meglerne, jo mer data logger og lagrer vi for gjenbruk.» Dette er den motiverte, gratis kuratering-arbeidskraften som er asymmetrien mot Norkart.

**PRD-status:** PRD 8 §6 *anerkjenner* additiv megler-bidrag i tenancy-noten, men spec-er ingen **megler-vendt** flate. PRD 15 = den *interne* nivå-2-kuratering-arbeidsflyten (build-time skills/scripts, admin-only i starten). PRD 12 = minimalt admin-skall. Den selvbetjente megler-flaten faller mellom de to.

**Anbefaling:** Lås eierskap. Enten (a) utvid PRD 15s arbeidsflyt-overflate til å ha en megler-vendt modus, eller (b) opprett en egen oppfølgings-PRD «megler-bidrags-flate». **Kan følge etter MVP** (nivå-1-board er autonomt og trenger ikke megler-input for å vises), men det er den høyest-leverede moat-materen — bør ikke driftes inn ad hoc. Bygger på `apply-area-staging`-kjernen PRD 8 Unit 4 allerede ekstraherer (eksplisitt «som BÅDE script OG fremtidig overflate kan dele») → fundamentet er der.

### Gap 2 — «Meglers tanker» (attributert megler-stemme) — net-ny, må navngis i deferred-sporet

**Strategien (2026-06-27, sparring):** En strukturert slot der megleren bidrar sitt *eget* perspektiv på nærområdet — som Sem & Johnsens «selger forteller», men megler-versjonen (gjenbrukbar ekspert-take, ikke engangs emosjon). **Den ikke-opplagte fella:** attributert megler-innhold («Frank Robert mener X om Ranheim») er meglerens *merkevare* og kan ikke fritt gjenbrukes på en konkurrents listing. **Designløsningen:** splitt to lag —
1. **Presentasjons-laget (attributert):** «Meglers tanker» med navn/ansikt/stemme → meglerens brand, vises kun på *deres* listinger.
2. **Kunnskaps-laget (de-attributert):** de underliggende faktiske nuggetsene ekstraheres til Lokalkunnskap-kanonen *uten* personlig stemme → akkumulerer, eies av Placy, arves av neste listing i strøket.

**PRD-status:** PRD 8 §6 + Deferred-tabellen **deferrer eksplisitt per-megler editorial-LAG** («ikke bygg spekulativt fler-tenant-lag-system»). Det var riktig kall gitt info da — men strategien har nå *navngitt og designet* funksjonen, og attributert/de-attributert-splitten gjør at den IKKE er et generisk fler-tenant-lag (kanonen forblir Placys; bare presentasjonen er per-megler).

**Anbefaling:** Oppdater PRD 8 Deferred-raden for per-megler-lag til å referere «Meglers tanker» ved navn + attributert/de-attributert-splitten, så designet ikke må gjenoppfinnes når kravet kommer. **Deferret er fortsatt riktig for v2-MVP** — men la den deferres *informert*, ikke som et udefinert «hvis krav dukker opp».

### Gap 3 — Freshness / re-verifiserings-løkka — felt finnes, mekanisme mangler

**Strategien:** «Lokalkunnskap råtner» (kafé legger ned) → re-verifisering er førsteklasses, ikke en engangsjobb.

**PRD-status:** Feltene finnes (`verified_at`, `confidence`, `display_ready`), men ingen unit eier en *re-verifiserings-mekanisme* (hva utløser re-sjekk, hvordan confidence degraderes over tid, hvordan stale punkter flagges).

**Anbefaling:** Egen oppfølging post-MVP. Lavt presserende (på prototype-volum med få strøk holder manuell QA), men noter det som en kjent skyld i PRD 8 så det ikke ser ut som «løst» fordi feltene eksisterer.

### Gap 4 — Kryss-moat-løkka (Innsikt → hvilke punkter kurateres) — ikke koblet

**Strategien:** Innsikt (Moat 2) forteller hvilke Lokalkunnskap-punkter som faktisk betyr noe → prioriter kuratering/re-verifisering der. Akkumulerings-løkka er den egentlige moaten.

**PRD-status:** PRD 8 refererer ikke PRD 13s engasjements-data som kuratering-prioriterings-input. De to moatene er specet uavhengig.

**Anbefaling:** Fremtidig integrasjon (krever at Moat 2 har volum først). Noter koblingen som retning: når `getEngagementStats`/strøk-aggregat finnes, blir «hvilke punkter får mest engasjement» en input til kurator-køen. Ikke MVP.

---

## 3. Anbefalinger — prioritert, mappet til PRD

| # | Gap | Handling | Eier-PRD | Prioritet |
|---|-----|----------|----------|-----------|
| 1 | Megler-UGC-flate | Lås eierskap (utvid PRD 15-overflate ELLER egen PRD); bygg på `apply-area-staging`-kjernen | PRD 15 / ny | **Post-MVP, men lås eierskap nå** |
| 2 | «Meglers tanker» | Oppdater PRD 8 Deferred-rad med navn + attributert/de-attributert-split | PRD 8 (deferred-tracking) | Deferret — informert, ikke udefinert |
| 3 | Freshness/re-verifisering | Noter som kjent skyld; egen oppfølging | PRD 8 (åpne spørsmål) | Post-MVP, lavt |
| 4 | Kryss-moat-løkke | Noter retning (Innsikt → kurator-kø) | PRD 8 ↔ 13 | Etter Moat 2-volum |

**Ingen av disse blokkerer MVP** (instrumentert, Ranheim-dypt nivå-1-board). Moat 1s byggekritiske kjerne er allerede i PRD 8 + PRD 3. Dette er flywheel- og løkke-laget oppå.

---

## 4. Hvordan bruke denne

Fold gap 1–2 inn i de berørte PRD-ene (eierskaps-avklaring + deferred-tracking) **før** beads serialiserer byggrekkefølgen, så de ikke faller ut. Gap 3–4 er post-MVP-notater. Ingenting her endrer Moat 1s kritiske sti — det sikrer at flywheelen som *mater* moaten har en hjemme-adresse.

Se søsterrapporten `moat-2-innsikt-build-input.md` for Moat 2 — der er gapet større og mer tidskritisk (event-skjemaet må reconciles før PRD 1/13 bygges).
