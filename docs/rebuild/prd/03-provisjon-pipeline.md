# PRD 3 — Provisjonerings-pipeline (autonom board-gen)

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling.
> **Tier:** delt nedover (geocode/discovery/scoring/hydrering er ALLTID delt) — pipelinen er nivå-1-substansprodusenten og *skriver* tier-deklarasjonen (`reportTier` + `has_3d_addon`) den ikke gater på.
> **PRD-nr:** 3 av 15 (sommer-rebuild 2026)
> **Slug:** `prd-provisjon`
> **Kontekst:** Lag-2-PRD (data-/innholdsproduksjon). Den deterministiske adresse→board-banen som er den ENESTE som produserer det runtime-bekreftede board-et (CARRY-OVER-MANIFEST linje 67). Erstatter `generate-story` (manifest linje 637). Blokkeres av PRD 1 (datakontrakt), PRD 2 (taksonomi + tier-deklarasjon) og PRD 4 (trust-scoring kjøres *i* pipelinen). Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md`, `docs/rebuild/prod-schema-snapshot.txt` og faktisk pipeline-kode (`scripts/provision-rapport.ts`, `lib/pipeline/*`).

---

## 1. Produktvisjon / Formål

Denne PRD-en eier **den autonome board-gen-pipelinen**: en deterministisk, seriell bane fra `--address` til et verifisert, instrumentert nivå-1-board, der hvert steg er en ren, testbar pipeline-modul. Den er rebuildens kritiske MVP-sti (`00-INDEX` linje 64: minste sti til synlig board = `01 → 04 → 03 → 05 → 06 → 09`), og den eneste banen som i dag produserer det runtime-bekreftede board-et med 6 temaer, RSC-render og voiceover (CARRY-OVER-MANIFEST linje 67).

Tre strukturelle grep skiller rebuild-pipelinen fra dagens:

1. **ÉN provisjonerings-vei, ikke to divergerende.** I dag produserer self-serve-banen (`app/api/generation-requests/route.ts`) et **Explorer**-produkt uten tema/trust/editorial via `createGeneratedProject` + `getHousingCategories` (verifisert: `route.ts:5-8`, `route.ts:148-162`), mens CLI-banen (`scripts/provision-rapport.ts`) produserer et fullt **report**-board. De to artefaktene divergerer (manifest linje 425–427: «Self-serve vs CLI produserer ULIKE artefakter»). Rebuilden kollapser begge til ÉN komplett report-pipeline; self-serve blir en tynn inngang som kaller samme kjerne.
2. **Google- og offentlig-kilde-discovery er DISTINKTE, aldri merget.** `import-pois` (Google/Entur/Bysykkel) og `import-public-pois` (NSR/Barnehagefakta/Overpass) er to separate keeper-moduler — manifest-patch konflikt #3 (linje 758): «DISTINKTE, begge keeper i prd-provisjon. Ikke merge.» De har ulik dedup-nøkkel (`google_place_id`/`entur_stopplace_id` vs `nsr_id`/`barnehagefakta_id`/`osm_id`) og ulik tillit-default (offentlige beholder `trust_score = null` = vis).
3. **Trust-scoring kjøres som et pipeline-steg med load-bearing rekkefølge.** Steg 4 (discovery) skriver `google_website = null` fordi den bruker **Nearby Search** (`import-pois.ts:170-171`), som ikke returnerer website/business_status. Disse signalene hentes utelukkende via **Place Details** (annet Google-endepunkt, annen kostnadsklasse) i Steg 5s enrichment-pass. Trust-scoring MÅ derfor kjøre en **to-fase re-enrichment FØR scoring** ellers scorer alle legitime POIer `no_website` (0.45) og masse-skjules (verifisert: `validate-report-trust.ts:114-137`; manifest linje 99). **De to passene må IKKE merges** — splittet er en endepunkt-/kostnadsgrense (Nearby Search billig discovery vs Place Details dyr enrichment), ikke et tilfeldig artefakt. Scoring-logikken eies av PRD 4; *plasseringen* i pipelinen eies her.

Pipelinen produserer **nivå-1-substansen**; nivå-2-editorial-arv (`inheritAreaEditorial`) kjøres som siste innholds-steg men eies av PRD 8. Render-laget gater ALDRI på `reportTier` (verifisert: ingen `reportTier`-ref i `BoardMap3D`/`ReportReelsPage`, jf. `00-INDEX` note #4 (linje 91)). Pipelinen *skriver* tier-deklarasjonen via `buildReportConfig`; tier-KRAVET fanges av PRD 2s validator, som pipelinen kaller som siste akseptansesjekk.

---

## 2. Mål (Goals)

Hvert mål kobler til ≥1 konkret requirement/unit (pekerne `(→ Gx)` i §7 refererer hit).

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | Én deterministisk, seriell adresse→board-orkestrator som erstatter `generate-story` og produserer et verifisert nivå-1-board. | Orkestrator-port (Unit 1) + akseptansesjekk-port (Unit 7). |
| **G2** | Geocode + kommune-oppslag portet til ren, typet modul uten dev-server-kobling. | Geocode-port (Unit 2). |
| **G3** | Google-/sanntids-discovery skilt fra cache-invalidering, uten legacy-generators-kobling. | Google-discovery-port (Unit 3). |
| **G4** | Offentlig-kilde-discovery (NSR/Barnehagefakta/Overpass/natur) bevart som DISTINKT kilde med egen dedup. | Offentlig-discovery-port (Unit 4). |
| **G5** | `buildReportConfig` skriver `reportTier` + `has_3d_addon` (tier-deklarasjonen) og leser taksonomien fra PRD 2. | `create-report-project`-port (Unit 5). |
| **G6** | Trust-scoring kjøres i pipelinen med to-fase re-enrichment FØR scoring (rekkefølge bevart). | Trust-steg-orkestrering (Unit 6, konsumerer PRD 4-logikk). |
| **G7** | Featured-scoring + `product_categories`-populering (board-substansen som gjør 0-av-0 til faktisk innhold). | Hydrerings-port (Unit 6). |
| **G8** | Self-serve-inngang og CLI konvergerer på ÉN report-pipeline; `generation_requests`-sporing bevart. | Self-serve-konvergens (Unit 8). |

---

## 3. Arkitektur-kontekst

I mantraet **«del nedover stacken, diverger oppover i UX»** sitter pipelinen på *data-produksjons-laget*: den fyller den delte datamodellen (PRD 1) med substans som ett delt board-skall (PRD 9) rendrer likt på alle nivåer. Pipelinen forker ALDRI per tier — den skriver tier-DEKLARASJONEN inn i data (`products.config.reportConfig.reportTier` + `projects.has_3d_addon`) og lar PRD 2s validator avgjøre om deklarasjonen er dekket.

Ratifisert steg-rekkefølge (CARRY-OVER-MANIFEST linje 67: «9 sekvensielle steg adresse→verifisert board ... ratifisert arkitektur»), verifisert mot `scripts/provision-rapport.ts`:

| Steg | Modul (i dag) | Eier i rebuild | Fail-modus |
|------|---------------|----------------|------------|
| 1 Geocode + kommune | `geocode.ts` (`geocodeAddress`, `getKommunenummer`) | denne PRD (Unit 2) | kast ved <0.5 relevance / tom; kommune fail-soft |
| 2 Opprett prosjekt | `create-report-project.ts` (`createReportProject`/`buildReportConfig`) | denne PRD (Unit 5) | kast ved DB-feil; rull tilbake prosjekt ved produkt-feil (`create-report-project.ts:242-247`) |
| 3 Offentlige POI | `import-public-pois.ts` (`importPublicPois`) | denne PRD (Unit 4) | fail-soft per kilde |
| 4 Google-discovery + enrichment (**foto DEFERRED**) | `enrich-report-pois.ts` (`enrichReportPois`) | denne PRD (Unit 3) | revalidatePath-throw isoleres; foto-leddet (`fetchAndCachePOIPhotos`) er DEFERRED (note #9) — wires inn når foto-task lander, inntil da no-photo-fallback |
| 5 Trust-validering | `validate-report-trust.ts` (`validateReportTrust`) | denne PRD orkestrerer; **PRD 4 eier scoring** (Unit 6) | fail-soft; `stillNull` QA-flagg |
| 6 Hydrering | `hydrate-report.ts` (`hydrateReport`) | denne PRD (Unit 6) | kast ved link/insert-feil |
| 7 Nabolags-editorial | `inherit-area-editorial.ts` (`inheritAreaEditorial`) | **PRD 8** (konsumeres her) | fail-soft UNNTATT skrive-/lås-feil (kaster) |
| 8 Revalidering | `revalidateProject` (inline i script) | **PRD 7** (cache bustes der) | fail-soft (ny render ferskt) |
| 9 Akseptansesjekk | `acceptanceCheck` (inline) + `validateReportTier` | denne PRD orkestrerer; **PRD 2** eier validator (Unit 7) | non-zero exit ved tier-error eller tom `product_categories` |

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument-PRD | Hva den konsumerer fra provisjon |
|---------------|----------------------------------|
| `prd-board-data-state` (5) | Pipelinens output-tilstand: `project_pois`/`product_pois`/`product_categories`-rader + `products.config.reportConfig` (`board-data.ts`-transform leser dette). Deps i `00-INDEX` linje 27: PRD 5 ← 03. |
| `prd-self-serve-admin` (12) | Kanonisk provisjonerings-inngang (admin-skallet kaller samme pipeline-kjerne). `00-INDEX` linje 36: PRD 12 ← 03. |
| `prd-instrumentering` (13) | Emit-site: provisjonerings-/board-gen er en hendelseskilde inn i `events` (PRD 13 wirer emit-sites med board-PRD-ene). |

---

## 4. Eksisterende kodebase

### Bæres over (keeper-core / nivå-1)

| Modul (@/-sti) | Verdict | Rolle | Manifest-ref |
|----------------|---------|-------|--------------|
| `scripts/provision-rapport.ts` | keeper (port orkestrering) | 9-stegs orkestrator + akseptansesjekk + nivå-deklarasjon | linje 66–69 |
| `lib/pipeline/create-report-project.ts` | keeper (`delt`) | `buildReportConfig` skriver `reportTier` + `has_3d_addon`; container-ID `{customer}_{slug}`; idempotent merge | linje 71–74 |
| `lib/pipeline/import-public-pois.ts` | keeper (`nivå-1`) | NSR/Barnehagefakta/Overpass/natur; dedup via `nsr_id`/`barnehagefakta_id`/`osm_id` | linje 76–79 |
| `lib/pipeline/hydrate-report.ts` | keeper (`nivå-1`) | `product_pois`-link + featured-scoring (topp 3/kat <1500m) + `product_categories` | linje 81–84 |
| `lib/pipeline/validate-report-trust.ts` | keeper (`nivå-1`) | trust-steg-orkestrering: to-fase re-enrichment FØR scoring; offentlige beholder null | linje 96–99 |
| `lib/generators/poi-quality.ts` → `lib/pipeline/poi-quality.ts` | keeper (`nivå-1`, **flyttes**) | build-time grovfilter (stengt/avstand/navn-mismatch); eneste konsument er `poi-discovery` (`poi-discovery.ts:15`) → flyttes sammen med den til `lib/pipeline/` (Unit 3) så «ingen import fra `lib/generators/`»-regelen forblir oppfyllbar | linje 111–114 |
| `lib/pipeline/inherit-area-editorial.ts` | keeper (`nivå-2`, **eid av PRD 8**) | nabolags-editorial-arv (Steg 7); konsumeres her, eies ikke | linje 86–89 |

### Port-with-rewrite (funksjonen trengs, koden skrives om)

| Modul (@/-sti) | Verdict | Hvorfor rewrite | Manifest-ref |
|----------------|---------|-----------------|--------------|
| `lib/pipeline/geocode.ts` | port-with-rewrite (`nivå-1`) | Mapbox v5 (deprecating) + `as any`; port til **v6 (`match_code`)** med typede responser (Search Box forkastet, Beslutning #13) | linje 414–417, dedup linje 732 |
| `lib/pipeline/enrich-report-pois.ts` | port-with-rewrite (`nivå-1`) | svelger `revalidatePath`-throw via `msg.includes("revalidatePath"||"cache")` (`enrich-report-pois.ts:100`) og re-teller fra DB — skill ren data-henting fra cache-invalidering. **Eierskaps-grense:** PRD 3 eier orkestrering + cache-isolasjon i denne filen (reconciler «port-with-rewrite»); de interne enrichment-funksjonene den kaller (`fetch-place-details`/foto-proxy = `fetchAndCachePOIPhotos`) eies av PRD 4 («port verbatim» der), og foto-leddet er DEFERRED (note #9 — wires først når foto-task lander) | linje 399–402 |
| `lib/pipeline/import-pois.ts` | port-with-rewrite (`nivå-1`) | henter fra LEGACY `poi-discovery` + kaller `revalidatePath` (`import-pois.ts:8`, `:247`); port discovery inn i ren modul uten cache-kobling | linje 404–407 |
| `lib/generators/poi-discovery.ts` | port-with-rewrite (`nivå-1`) | `discoverGooglePlaces/Entur/Bysykkel` live, men i legacy-mappe + legacy Places API; port til pipeline på nye Places API | linje 409–412 |
| `app/api/generation-requests/route.ts` | port-with-rewrite (`nivå-1`) | lager EXPLORER-produkt uten tema/trust/editorial; re-wire til ÉN report-pipeline + async job | linje 424–427 |
| `app/(public)/generer/*` + `app/eiendom/(tools)/generer/*` | port-with-rewrite (`nivå-1`) | nær-duplikate former; konsolider til ÉN adaptiv form med valgfritt brokerage-felt | linje 429–437 |
| `app/api/geocode/route.ts` + `ReportAddressInput.tsx` + `AddressAutocomplete.tsx` | port-with-rewrite ELLER bevisst-behold (`nivå-1`) | **Runtime-autocomplete-banen er OGSÅ Mapbox v5** (`route.ts:24` `geocoding/v5/mapbox.places`; konsumert av `ReportAddressInput.tsx:84` + `AddressAutocomplete.tsx:65` via `/api/geocode?q=`). Enten porte til v6 sammen med pipeline-geocoden (Unit 2) eller bevisst beholde — ellers divergerer pipeline-geocode (v6) og runtime-autocomplete (v5). PRD 3-oppfølging (se Beslutning #13). | kontroll-runde 2026-06-27 |

### Slettes / forlates (dead / reference-only)

| Modul (@/-sti) | Verdict | Begrunnelse |
|----------------|---------|-------------|
| `scripts/generate-story.ts` | reference-only → slett etter re-peking | Superseded av provision-rapport. **MÅ verifisere hvilke skills (`generate-bolig`/`generate-hotel`/`generate-naering`) kjører den FØR sletting, re-pek mot provision-rapport** (manifest linje 637). |
| `lib/pipeline/create-project.ts` (`createGeneratedProject`) | **dead** | Lager explorer-produkt uten tema/tier/3d — roten til self-serve↔CLI-spriket (manifest linje 691, dedup linje 731: dead vinner). Erstattes av `createReportProject`. |
| `lib/pipeline/housing-categories.ts` (`getHousingCategories`/`HousingType`) | reference-only | TREDJE kategorimodell (manifest linje 427, 641); `report-defaults` er autoritativ. Self-serve slutter å bruke den. |
| `lib/generators/trail-fetcher.ts` | reference-only (avklar) | Turstier legitim board-substans men kun i legacy generate-story; provision-rapport henter ikke trails (manifest linje 419–422). Defer beslutning (se Åpne spørsmål #1). |
| `scripts/import-{atb-stops,bysykkel,taxi-stands,hyre-stations,kommune-pois,riksantikvaren,kml}.ts` | reference-only | Datakildene verdifulle, men bryter `@supabase/supabase-js`-regelen; KILDE-REFERANSE (endepunkter/parsing), re-implementer via pipeline (manifest linje 645). |

---

## 5. Datakontrakt / Skjema

### 5.1 Felt pipelinen SKRIVER (eier write-pathen mot PRD 1s skjema)

Alle kolonner verifisert mot `prod-schema-snapshot.txt` — som er en kolonne-REFERANSE (samme kolonner re-derives i `v2`), ikke et live-prod-mål (note #7). Pipelinen skriver mot `v2.*`-tabellene (`.schema('v2')` / rå REST `Content-Profile: v2`).

| Tabell.felt | Type (snapshot) | Skrevet av | Verifikasjon |
|-------------|------------------|------------|--------------|
| `pois.source` | text (linje 115) | Unit 3 (`google`/`entur`/`bysykkel`), Unit 4 (`nsr`/`barnehagefakta`/`osm`) | `import-public-pois.ts:48,169,243,349` |
| `pois.nsr_id` | text (linje 116) | Unit 4 | `import-public-pois.ts:160,171` |
| `pois.barnehagefakta_id` | text (linje 117) | Unit 4 | `import-public-pois.ts:239,248` |
| `pois.osm_id` | text (linje 118) | Unit 4 | `import-public-pois.ts:342,350` |
| `pois.parent_poi_id` | text (linje 125) | (kjøpesenter-hierarki — ikke skrevet i dagens pipeline; reference-only her) | snapshot linje 125 |
| `pois.google_*` (place_id, rating, review_count, maps_url, website, business_status, price_level) | div (snapshot linje 95–114) | Unit 3 via `import-pois.ts:158-172` + Unit 6 enrichment | `import-pois.ts:convertToPOIImportData` |
| `pois.trust_score`/`trust_flags` | numeric/array | Unit 6 via `updatePOITrustScore` (PRD 4) | `validate-report-trust.ts:179` |
| `products.config` (`reportConfig.reportTier` + `themes`) | jsonb NOT NULL (snapshot linje 138) | Unit 5 `buildReportConfig` | `create-report-project.ts:64-83` |
| `projects.has_3d_addon` | boolean NOT NULL (snapshot linje 184 per PRD 1) | Unit 5 (fra `--addon-3d`-input, default `false`; i dag hardkodet `true` `:217`) | `create-report-project.ts:217` |
| `project_pois` (project_id, poi_id) | text (3 kol) | Unit 3/4 (link) | `import-public-pois.ts:99-104` |
| `product_pois` (product_id, poi_id, featured) | (5 kol) | Unit 6 hydrering | `hydrate-report.ts:99-103,164-169` |
| `product_categories` (product_id, category_id, display_order) | (3 kol) | Unit 6 hydrering | `hydrate-report.ts:185-201` |
| `generation_requests` (status, project_id, result_url, completed_at, error_message, customer_id, address_slug, consent_given) | div (snapshot linje 41–58) | Unit 8 self-serve | `route.ts:124-176` + snapshot |

### 5.2 Felt/symboler pipelinen KONSUMERER (eies av andre PRD-er)

| Symbol | Eier-PRD | Verifikasjon |
|--------|----------|--------------|
| `getThemeDefaults(profile)` → 6 bolig / 5 nærings-temaer | PRD 2 (taksonomi) | `report-defaults.ts:143`; `create-report-project.ts:169` |
| `getDiscoveryRadius(city, profile)` | PRD 2 | `report-defaults.ts:168`; `provision-rapport.ts:432` |
| `REPORT_THEME_DEFAULTS` / `ReportProfile` / `ReportThemeDefault` | PRD 2 | `report-defaults.ts:16,141,7`; `hydrate-report.ts:11`, `create-report-project.ts:11-16` |
| `validateReportTier` / `summarizeTierFindings` / `ReportTierSchema` | PRD 2 (validator) | `provision-rapport.ts:52-58`; `report-tier.ts` |
| `getCameraTour(slug)` | PRD 9 (camera-tours-data) | `provision-rapport.ts:59`; injiseres til validator |
| `enrichTrustSignals` / `batchValidateTrust` / `updatePOITrustScore` / `mapPoiRowToPOIForTrust` | PRD 4 (trust-scoring) | `validate-report-trust.ts:18-24` |
| `inheritAreaEditorial` | PRD 8 (moat) | `provision-rapport.ts:45`; `inherit-area-editorial.ts` |
| `revalidateTag`/`revalidatePath`-arkitektur | PRD 7 (cache bustes der) | `provision-rapport.ts:150-177`; `import-pois.ts:8,247` |

> **Cache-isolasjon (port-with-rewrite-kjernen):** Dagens pipeline svelger `revalidatePath`-throw via streng-match (`enrich-report-pois.ts:100`) fordi `import-pois.ts` kaller `revalidatePath` i CLI-kontekst der den kaster (`import-pois.ts:247`). Rebuild SKILLER data-skriving fra cache-invalidering: discovery-modulene returnerer rene resultater; cache-busting flyttes til ett eksplisitt steg (PRD 7-arkitektur). Ingen streng-match-landmine arves.

---

## 6. Scope Boundaries

**Denne PRD-en dekker:**

1. Orkestratoren (9 sekvensielle steg) som ÉN kanonisk inngang for adresse→board.
2. Geocode + kommune-oppslag som ren typet modul.
3. Google-/sanntids-discovery (DISTINKT fra offentlig) uten cache-kobling.
4. Offentlig-kilde-discovery (NSR/Barnehagefakta/Overpass/natur) med egen dedup.
5. `create-report-project` + `buildReportConfig` (skriver tier-deklarasjon, leser taksonomi).
6. Trust-steg-ORKESTRERING (to-fase rekkefølge) + hydrering (featured + product_categories).
7. Akseptansesjekk-orkestrering (kaller PRD 2-validator).
8. Self-serve-konvergens til ÉN report-pipeline + `generation_requests`-sporing.

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| Datamodell/skjema (`pois`/`projects`/`products`/`project_pois`/`product_categories`/`generation_requests`-tabellene + kolonner) | **PRD 1 (prd-datamodell-supabase)** — pipelinen skriver mot, definerer ikke |
| Taksonomi (`report-defaults.ts`, `getThemeDefaults`/`getDiscoveryRadius`) + tier-VALIDATOR + manifest | **PRD 2 (prd-tier-capability-manifest)** — pipelinen konsumerer/kaller |
| Trust-scoring-LOGIKK + Google Places-enrichment-detaljer + foto-proxy (`enrichTrustSignals`/`batchValidateTrust`/`updatePOITrustScore`/`fetch-place-details`/`photo-api`) | **PRD 4 (prd-trust-google-places)** — pipelinen plasserer steget, eier ikke heuristikken |
| Board-data-transform (`board-data.ts` pois→BoardData) + state | **PRD 5 (prd-board-data-state)** — konsumerer pipelinens output |
| Nabolags-editorial-arv-LOGIKK (`inherit-area-editorial`, `find-area-for-point`, `area-staging`, `curate-area`) | **PRD 8 (prd-lokalkunnskap-moat)** — pipelinen kaller Steg 7, eier ikke moat-systemet |
| Cache-revalidering (`revalidateTag`/`api/revalidate*`) | **PRD 7 (prd-grounding-curation)** — cachen bustes der |
| `camera-tours.ts`-data (`getCameraTour`) injisert til akseptanse-validator | **PRD 9 (prd-board-skall-ui)** |
| Event-logging mot `events` ved provisjonering (emit-site) | **PRD 13 (prd-instrumentering)** |
| Self-serve admin-UI-skall + `middleware.ts` (routing/admin-guard) | **PRD 12 (prd-self-serve-admin)** — denne PRD leverer pipeline-kjernen inngangen kaller |
| Varig 3D-addon-KJØPSKILDE (kunde-/produkt-felt som driver `has_3d_addon` ved kjøp) | **PRD 12 (prd-self-serve-admin)** — PRD 3 leverer skrive-pathen + `--addon-3d`-input/`false`-default; addon-kjøp som forretningstilstand hører i admin-flyten |
| Turstier (`trail-fetcher`) som eksplisitt pipeline-steg vs defer | Avklares serielt (Åpne spørsmål #1); ny unit i denne PRD KUN hvis nivå-1-feature bekreftes |

**Eksplisitt ikke-scope:** render-gating på `reportTier` (verifisert: ingen ref i render-laget). Pipelinen skriver deklarasjonen; PRD 2s validator fanger kravet. Ingen unit bygger render-gating.

---

## 7. Implementation Units (8 av maks 8)

### Unit 1 — Orkestrator-port (9-stegs adresse→board, erstatter generate-story)
- **Mål (→ G1):** Port `provision-rapport.ts` til ren orkestrator-modul med eksplisitt fail-soft/kast-høylytt-kontrakt per steg; re-pek `generate:story`-skills.
- **Filer:** `@/scripts/provision-rapport.ts` (port), `@/lib/pipeline/provision.ts` (ny — kjerne-orkestrering kallbar fra CLI + server-action).
- **Akseptansekriterier:**
  1. Stegene 1–9 kjøres i ratifisert rekkefølge (§3-tabell); rekkefølgen er load-bearing og dokumentert i kode-kommentar.
  2. `import "./load-env"` (eller tilsvarende env-først-mekanisme) MÅ være første import i CLI-entry — ellers blir modul-anon-klienten permanent null (manifest linje 69; `provision-rapport.ts:27`).
  3. Steg 7 (editorial) er fail-soft for warnings MEN kaster ved skrive-/optimistisk-lås-feil (aldri delvis editorial — `provision-rapport.ts:507-510`).
  4. Orkestreringskjernen er kallbar uten TTY (non-interaktiv → nivå 1, `--tier` overstyrer; `provision-rapport.ts:119-123`), slik at Unit 8 self-serve kan dele den.
  5. `scripts/generate-story.ts`-konsumenter (skills `generate-bolig`/`generate-hotel`/`generate-naering`) er kartlagt og re-pekt mot provisjonspipelinen FØR `generate-story` slettes (manifest linje 637).
- **Avhengigheter:** PRD 1 (skjema/types), Unit 2–7 (stegene den orkestrerer).

### Unit 2 — Geocode + kommune-oppslag (port-with-rewrite)
- **Mål (→ G2):** Port `geocode.ts` til typet modul; bytt Mapbox v5 → v6/Search Box, fjern `as any`.
- **Filer:** `@/lib/pipeline/geocode.ts`.
- **Akseptansekriterier:**
  1. `geocodeAddress(query)` returnerer typet `GeocodeResult[]` (placeName/lat/lng/`confidence`/city/region) uten `any`-casts (i dag bruker v5 `geocoding/v5/mapbox.places`, `geocode.ts:28`, med `relevance` som flat float, `geocode.ts:10,48`). I valgt v6 (Beslutning #13) finnes IKKE et flatt `relevance`-felt: Geocoding v6 returnerer et `match_code`-confidence-objekt (Search Box ble vurdert men forkastet — den returnerer ingen relevance). Det typede feltet eksponeres derfor som et normalisert `confidence: number` (0–1) på `GeocodeResult`, ikke en rå provider-spesifikk verdi.
  2. **Confidence→gate-mapping er eksplisitt (kritisk — confidence er eneste kvalitetsvakt før writes):** Provider er **låst til Mapbox Geocoding v6 (`match_code`)** (Beslutning #13 / kontroll-runde 2026-06-27; Search Box forkastet). Mappingen: `match_code` med `confidence === "exact"`/`"high"` → `confidence ≥ 0.5` (passerer), `"medium"`/`"low"` → `< 0.5` (avbryt). Avbryt-gaten flyttes fra flat `relevance < 0.5` (`provision-rapport.ts:337`) til dette typede `confidence`-feltet.
  3. `getKommunenummer(lat, lng)` mot Kartverket `koordsys=4258`; fail-soft → `null` (i dag `geocode.ts:60-81`); konsekvens (NSR-skoler mangler) logges, kaster ikke.
  4. Geocode-token hentes server-side (`MAPBOX_TOKEN`); kaster hvis mangler (`geocode.ts:17-22`).
  5. Avbryt-grensen bevart load-bearing: lav confidence (`< 0.5` etter mapping i AC2) → kast/avbryt (i dag `provision-rapport.ts:337` mot `relevance`). **Regresjonstest FØR v5-banen fjernes:** ny `@/lib/pipeline/geocode.test.ts` dekker (a) `GeocodeResult`-formen (typet, ingen `any`) og (b) at avbryt-gaten fyrer på lav-confidence og IKKE på høy — så et stille-brutt gate fanges. Det finnes ingen geocode-tester i repoet i dag (verifisert: ingen `lib/pipeline/geocode*.test.ts`), så denne testen er nettet som beskytter den eneste kvalitetsvakten.
- **Avhengigheter:** ingen (rot-steg). MERK: Åpne spørsmål #3 er LØST (kontroll-runde 2026-06-27) — provider = Mapbox Geocoding v6 (`match_code`), confidence-semantikken i AC2 er låst. Unit 2 kan låses. Oppfølging: runtime-autocomplete (`/api/geocode/route.ts`) er også v5 og må porte til v6 eller bevisst beholdes (Beslutning #13).

### Unit 3 — Google-/sanntids-discovery (DISTINKT; cache-isolert)
- **Mål (→ G3):** Port `enrich-report-pois` + `import-pois` + `poi-discovery` til ren discovery-modul uten `revalidatePath`-kobling og uten legacy-generators-mappe.
- **Filer:** `@/lib/pipeline/enrich-report-pois.ts`, `@/lib/pipeline/import-pois.ts`, `@/lib/pipeline/poi-discovery.ts` (flyttet fra `lib/generators/`), `@/lib/pipeline/poi-quality.ts` (flyttet fra `lib/generators/`; eneste konsument er `poi-discovery`).
- **Akseptansekriterier:**
  1. `discoverGooglePlaces`/`discoverEnturStops`/`discoverBysykkelStations` flyttet til `lib/pipeline/`; ingen import fra `lib/generators/` (manifest linje 412: «ALDRI legg-igjen i generators/»). Dette inkluderer `poi-quality.ts` (grovfilteret som `poi-discovery` importerer via `./poi-quality`, `poi-discovery.ts:15`): den flyttes til `lib/pipeline/poi-quality.ts` og den relative importen oppdateres tilsvarende — IKKE re-skriv til `@/lib/generators/poi-quality` (ville brutt regelen). Tilhørende `poi-quality.test.ts` flyttes med.
  2. Discovery-funksjonene returnerer rene resultater UTEN å kalle `revalidatePath`; ingen `msg.includes("revalidatePath"||"cache")`-svelging arves (i dag `enrich-report-pois.ts:100`, `import-pois.ts:247`).
  3. Dedup på tvers av sirkler via `google_place_id`/`entur_stopplace_id`/`bysykkel_station_id` bevart (`import-pois.ts:304-361`).
  4. Transport-POIer settes `trust_score = 1.0`, Google-POIer `null` (`import-pois.ts:167`).
  5. `BOLIG_GOOGLE_CATEGORIES`/`NAERING_GOOGLE_CATEGORIES` bevart som profil-styrt input (`enrich-report-pois.ts:13,32`).
  6. **Foto DEFERRED (note #9; speiler PRD 4 Unit 4/5 + foto-leddet i `enrichReportPois`):** `enrich-report-pois.ts` portes for import + Google-enrichment + cache-isolasjon, MEN `fetchAndCachePOIPhotos`-kallet wires FØRST når foto-task lander. Inntil da skriver pipelinen ingen foto-felt og POI rendres med **no-photo-fallback** (kategorifarge/ikon — eid av PRD 5 transform + PRD 9 render). Spec bevares (kallet er ikke fjernet, kun ikke-wiret) så foto kan aktiveres uten re-design; når det wires er det fail-soft (POI faller tilbake til kategorifarge ved feil) og API-nøkkel i header (PRD 4 eier proxyen).
  7. Hvert Supabase-kall har eksplisitt error-håndtering (CLAUDE.md); ingen stille `return []`-swallow uten logging.
  8. **v2-targeting (note #7):** alle Supabase-kall i discovery/enrichment bruker `.schema('v2')` (rå REST: `Accept-Profile: v2` ved les / `Content-Profile: v2` ved skriv). `prod-schema-snapshot.txt` er kolonne-REFERANSE (samme kolonner re-derives i `v2`), ikke et live-prod-mål; referanse-board re-provisjoneres inn i `v2`.
- **Avhengigheter:** Unit 2 (koordinater). (Foto-proxy-grensen mot PRD 4 reaktiveres når foto-task lander, note #9.)

### Unit 4 — Offentlig-kilde-discovery (DISTINKT fra Google)
- **Mål (→ G4):** Port `import-public-pois` verbatim som SEPARAT kilde; bevar egen dedup + nærmeste-per-type + natur-cap.
- **Filer:** `@/lib/pipeline/import-public-pois.ts`.
- **Akseptansekriterier:**
  1. NSR/Barnehagefakta/Overpass IKKE merget med Google-discovery (manifest-patch konflikt #3, linje 758).
  2. Dedup via `nsr_id`/`barnehagefakta_id`/`osm_id` med pre-lookup-remap til eksisterende DB-id (`import-public-pois.ts:54-86`).
  3. NSR deterministisk nærmeste-per-type (barneskole/ungdomsskole/videregaende), tie-break alfabetisk (`import-public-pois.ts:178-195`); `resolveSchoolType` NaceKode-mapping bevart (`:112-118`).
  4. Overpass retry på 429/500/406 (`:297-304`); natur-link `MAX_NATUR=20`, sletter gamle først (`:364-430`).
  5. Fail-soft per kilde (logg + fortsett), aldri abort (`:139-142`, `:223-226`, `:314-316`).
  6. Nærings-profil hopper over skoler/barnehager/idrett (`provision-rapport.ts:438-441`).
  7. **v2-targeting (note #7):** alle Supabase-kall (dedup-lookup + insert + `project_pois`-link + natur-link/-slett) bruker `.schema('v2')` (rå REST: `Accept-Profile: v2`/`Content-Profile: v2`). `prod-schema-snapshot.txt` er kolonne-REFERANSE (samme kolonner re-derives i `v2`), ikke live-prod-mål; referanse-board re-provisjoneres inn i `v2`.
- **Avhengigheter:** Unit 2 (koordinater + kommunenummer).

### Unit 5 — create-report-project + buildReportConfig (skriver tier-deklarasjon)
- **Mål (→ G5):** Port `create-report-project`; `buildReportConfig` skriver `reportTier` (når deklarert) + `has_3d_addon`; les taksonomi fra PRD 2.
- **Filer:** `@/lib/pipeline/create-report-project.ts`.
- **Akseptansekriterier:**
  1. `buildReportConfig` skriver `reportConfig.reportTier` betinget (`reportTier !== undefined`) + `themes` fra `getThemeDefaults(profile)` (`create-report-project.ts:64-83,169`).
  2. `projects.has_3d_addon` skrives fra en eksplisitt pipeline-input (CLI-flagg `--addon-3d`, default `false`; self-serve-inngang sender `false` til ekte addon-kjøp finnes), IKKE hardkodet `true` (i dag `:217`). Dette eier PRD 3 (ikke re-deferret videre): PRD 2 §10 Q1 ga koblingen til denne PRD-en, og den landes her som inputen over. Slik reflekterer `has_3d_addon` faktisk addon-tilstand (et board uten betalt addon deklarerer `false` og rendrer ikke 3D), i stedet for alltid-`true`. 3D er et **ortogonalt render-flagg uavhengig av nivå** (walkthrough-revisjon 2026-06-27), ikke et nivå-krav — ingen validator gater 3D mot nivå. Den varige addon-kjøp-kilden (kunde-/produkt-felt i self-serve-admin) er deferred til PRD 12 (se «Deferred to Separate Tasks»); inntil da er CLI-flagget/`false`-defaulten den autoritative inputen.
  3. Container-ID `{customer}_{slug}` + slug-kollisjon-suffiks bevart (`:111,184-201`).
  4. **Intern-fallback (note #12 + PRD 1):** når INGEN kunde/brokerage oppgis (CLI uten kunde, eller self-serve-banen i Unit 8 AC4 uten valgfritt brokerage-felt) brukes den reserverte default-kunden `intern` som `{customer}`, slik at projectId/cache-tag blir `intern_<slug>`. Dette bevarer den load-bearing `{customer}_{slug}`-invarianten (PRD 7 / PRD 9) med minst kode. `intern` reserveres som default-kunde-nøkkel i PRD 1; no-brokerage-banen i Unit 8 AC4 mapper eksplisitt til `intern`. Den varige addon-kjøp-/kunde-CRUD-kilden hører i PRD 12.
  5. Idempotent merge: eksisterende prosjekt → returner ID-er uten å overskrive satte config-felt; `--update` oppdaterer kun koordinater (`:121-182`).
  6. Produkt-feil ruller tilbake prosjekt-insert (`:242-247`).
  7. `as any`-cast forbi typegen fjernet/erstattet etter PRD 1 re-typing (manifest linje 74); Supabase-kall har eksplisitt error-håndtering.
  8. **v2-targeting (note #7):** prosjekt-/produkt-insert + merge-lookup bruker `.schema('v2')` (rå REST: `Accept-Profile: v2`/`Content-Profile: v2`). `prod-schema-snapshot.txt` er kolonne-REFERANSE (samme `products.config`/`projects.has_3d_addon`-kolonner re-derives i `v2`), ikke live-prod-mål; referanse-board re-provisjoneres inn i `v2`.
- **Avhengigheter:** PRD 1 (`products`/`projects`-skjema + re-typede klienter + reservert `intern`-kunde), PRD 2 (`getThemeDefaults`/`getDiscoveryRadius`/`ReportTierSchema`).

### Unit 6 — Trust-steg-orkestrering + hydrering (to-fase rekkefølge + featured)
- **Mål (→ G6, G7):** Plasser trust-steget (to-fase re-enrichment FØR scoring) og hydrering (featured + product_categories) i pipelinen; konsumer PRD 4-scoring-logikk.
- **Filer:** `@/lib/pipeline/validate-report-trust.ts`, `@/lib/pipeline/hydrate-report.ts`.
- **Akseptansekriterier:**
  1. **Rekkefølge load-bearing — de to passene merges ALDRI:** enrichment-fasen (`enrichTrustSignals`, som henter `google_website`/`google_business_status` via Place Details) kjører FØR scoring, og scoringen re-leser radene så den ser enrichede signaler (`validate-report-trust.ts:114-160`). Grunnen til at dette ikke kan kollapses til ett pass: Steg 4-discovery bruker Nearby Search (`import-pois.ts:170-171` setter `google_website:null` fordi Nearby Search ikke returnerer website), mens Place Details er et separat, dyrere Google-endepunkt — splittet er en kostnads-/endepunktgrense, ikke et tilfeldig artefakt. En «optimalisering» som henter Place Details i Steg 4 og dropper Steg 5-re-enrichment er FORBUDT. POIer der enrichment feiler scores IKKE med degraderte signaler — de havner i `stillNull` (= vis, QA-flagg; `:118-127,140-142`).
  2. KUN POIer med `google_place_id` scores; offentlige kilde-POIer skippes bevisst og beholder `trust_score = null` (`:96-99`); `manual_override`/allerede-scoret skippes (`:100-108`).
  3. Hydrering: `product_pois` re-link (slett + re-insert), featured SETTES SIST (topp `FEATURED_TOP_N=3`/kat innenfor `FEATURED_MAX_DISTANCE_M=1500`; institusjonelle får r=4.0/rc=10) (`hydrate-report.ts:34-36,113-175`).
  4. **Featured-markering batches:** dagens kode kjører N individuelle `.update({featured:true}).eq(product_id).eq(poi_id)` i løkke (`hydrate-report.ts:164-174`) — manifest linje 84 flagger «N UPDATE-kall i løkke → batch i rebuild». Rebuild erstatter løkken med ett batch-kall (f.eks. `.update({featured:true}).in("poi_id", featuredIds).eq("product_id", productId)`, eller upsert) i stedet for per-POI-loop.
  5. `product_categories` populeres med `display_order` fra `REPORT_THEME_DEFAULTS`-rekkefølge; tom = warning «0 av 0 steder» (`hydrate-report.ts:177-207`).
  6. Trust-scoring-HEURISTIKKEN (`batchValidateTrust`/`enrichTrustSignals`/`updatePOITrustScore`) importeres fra PRD 4-moduler, defineres ikke her.
  7. Fail-soft per POI; Supabase-kall med eksplisitt error-håndtering.
  8. **v2-targeting (note #7):** trust-re-les + scoring-write + `product_pois`/`product_categories`-hydrering bruker `.schema('v2')` (rå REST: `Accept-Profile: v2`/`Content-Profile: v2`). `prod-schema-snapshot.txt` er kolonne-REFERANSE (samme kolonner re-derives i `v2`), ikke live-prod-mål; referanse-board re-provisjoneres inn i `v2`.
- **Avhengigheter:** Unit 3 + Unit 4 (POIer linket), PRD 4 (scoring-logikk).

### Unit 7 — Akseptansesjekk-orkestrering (kaller PRD 2-validator)
- **Mål (→ G1):** Port `acceptanceCheck`; verifiser board-substans + at deklarert `reportTier` er fullt dekket av skrevet config.
- **Filer:** `@/lib/pipeline/provision-acceptance.ts` (ny — ren sjekk), kalt fra Unit 1-orkestrator.
- **Akseptansekriterier:**
  1. `product_categories` ikke tom (ellers board viser 0 av 0) → non-zero exit (`provision-rapport.ts:195-206`).
  2. Tier-validering: `validateReportTier({ slug, reportConfig, has3dAddon, cameraTour: getCameraTour(slug) })` kjøres; ≥1 `error`-funn → exit 1 (`provision-rapport.ts:266-281`).
  3. Min-chips QA-flagg (arvet tema med <2 highlight-chips) er INFORMATIVT, ikke feil; body-only er bevisst legitim tilstand (`provision-rapport.ts:223-255`).
  4. `getCameraTour` (PRD 9) + tier-validator (PRD 2) injiseres/kalles; sjekken eier ikke disse symbolene.
  5. Sjekken leser via server-side query-wrapper (service-role); eksplisitt error-håndtering på Supabase-kall.
- **Avhengigheter:** Unit 5 + Unit 6 (config + hydrering skrevet), PRD 2 (validator), PRD 9 (`getCameraTour`).

### Unit 8 — Self-serve-konvergens (ÉN report-pipeline + generation_requests)
- **Mål (→ G8):** Re-wire self-serve-banen til samme report-pipeline-kjerne (Unit 1); behold `generation_requests`-status-maskin + consent; konsolider de to generer-formene.
- **Filer:** `@/app/api/generation-requests/route.ts` (port), `@/app/(public)/generer/*` + `@/app/eiendom/(tools)/generer/*` (konsolider til ÉN adaptiv form).
- **Akseptansekriterier:**
  1. Self-serve kaller orkestrerings-kjernen fra Unit 1 (report-board), IKKE `createGeneratedProject` (dead, manifest linje 691) og IKKE `getHousingCategories` (TREDJE kategorimodell, manifest linje 427).
  2. `generation_requests` status-maskin bevart: `pending`→`completed`/`failed` med `project_id`/`result_url`/`completed_at`/`error_message` (`route.ts:124-176`; snapshot linje 41–58).
  3. Consent (`consent_given` NOT NULL) + e-post-validering bevart; 7-dagers duplikat-sjekk + slug-kollisjon-suffiks (`route.ts:90-118`).
  4. `getOrCreateCustomer(brokerage)` bevart som self-serve-spesifikk verdi (manifest linje 436); konsolidert form har valgfritt brokerage-felt. **No-brokerage-banen mapper eksplisitt til den reserverte default-kunden `intern`** (note #12 / PRD 1) → container-ID `intern_<slug>` via Unit 5 AC4-fallbacken; `{customer}_{slug}`-invarianten bevares uten kunde-input.
  5. **PII-grense:** `generation_requests` inneholder e-post + consent → service-role-only (ikke anon-lesbar), jf. PRD 1 RLS-kontrakt (manifest linje 474: «Public read-by-slug RLS eksponerer email — sjekk PII»).
  6. **Async-grense (konkret akseptansemål — ikke lenger gated på åpent spørsmål):** self-serve-HTTP-svaret henger ikke på den synkrone 5–10 min pipeline-kjøringen (manifest linje 427). Minimal isolasjon er det ratifiserte målet for prototype-stadiet: HTTP returnerer umiddelbart en `generation_requests`-status (`pending`), pipelinen kjører ferdig i prosess (`pending`→`completed`/`failed`), og INGEN ekstern job-kø introduseres før volum tilsier det. Klienten poller status / `result_url`. (Åpne spørsmål #2 er nå informativt: når-kø-trengs koordineres med PRD 12, men Unit 8 bygges mot denne faste kontrakten.)
- **Avhengigheter:** Unit 1 (delt kjerne), PRD 1 (`generation_requests`-skjema).

> **Fullstendighet:** 8 av 8 units. Hver av de 7 ratifiserte stegene (geocode→akseptanse) har en navngitt eier-unit; trust + editorial + cache + camera-tours er eksplisitt markert konsumert-fra-annen-PRD. Ingen sampling.

---

## 8. Utviklingsløp (faser)

### Fase 1 — Discovery-fundament (rene kilde-moduler)
- **Mål:** Geocode + begge DISTINKTE discovery-kilder portet, cache-isolert, testbare offline.
- **Leveranse:** Unit 2, 3, 4.
- **Autonomi-nivå:** Høy for Unit 4 (verbatim port). Middels for Unit 2 (Mapbox v5→v6-bytte) og Unit 3 (cache-isolasjon + generators-flytting krever kaller-verifikasjon).

### Fase 2 — Prosjekt-skriving + substans (tier-deklarasjon + hydrering)
- **Mål:** `create-report-project` skriver tier-deklarasjon; trust-steg (to-fase) + hydrering produserer board-substansen.
- **Leveranse:** Unit 5, 6.
- **Autonomi-nivå:** Middels. Unit 6 har load-bearing rekkefølge (re-enrichment FØR scoring) som MÅ bevares; konsumerer PRD 4-logikk som må være på plass.

### Fase 3 — Orkestrering + inngangs-konvergens
- **Mål:** Én orkestrator binder stegene + akseptansesjekk; self-serve og CLI konvergerer; `generate-story` re-pekt og slettet.
- **Leveranse:** Unit 1, 7, 8.
- **Autonomi-nivå:** Middels-lav. Unit 1 er avhengig av alle steg + krever skill-re-peking før sletting; Unit 8 berører self-serve-PII + async-grense (koordineres med PRD 12). Verifiser mot et faktisk board (Ranheim/Hans Collins veg-paritet).

---

## 9. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | ÉN report-pipeline; self-serve blir tynn inngang som kaller CLI-kjernen | Manifest linje 425–427: dagens self-serve↔CLI-sprik (explorer vs report) er roten til divergens |
| 2 | Google- og offentlig-discovery forblir DISTINKTE moduler | Manifest-patch konflikt #3 (linje 758): «Ikke merge» — ulik dedup-nøkkel + tillit-default |
| 3 | Trust-scoring kjøres i pipelinen MED to-fase re-enrichment FØR scoring | `validate-report-trust.ts:114-137`; rekkefølge load-bearing (Steg 4 nuller google_website) |
| 4 | Offentlige kilde-POIer beholder `trust_score = null` (= vis), scores ikke | Heuristikken er for kommersielle; ville gitt skoler 0.45 og masse-skjult (`validate-report-trust.ts:7-9`) |
| 5 | Trust-LOGIKK eies av PRD 4; pipelinen eier kun PLASSERINGEN av steget | `00-INDEX` deps: PRD 3 ← 04; manifest linje 96–99 (orkestrering) vs PRD 4 (heuristikk) |
| 6 | `buildReportConfig` skriver tier-deklarasjon; render gater ALDRI på tier | Manifest linje 72; patch #2 (linje 757): ingen render-gating; validator fanger kravet |
| 7 | `createGeneratedProject` + `getHousingCategories` forlates (dead/reference) | Explorer-produkt uten tema/tier; TREDJE kategorimodell (manifest linje 691, 427) |
| 8 | Cache-invalidering skilles fra data-skriving; ingen revalidatePath-svelging | `enrich-report-pois.ts:100`-landmine; PRD 7 eier revalidateTag-arkitektur |
| 9 | `poi-discovery` flyttes fra `lib/generators/` til `lib/pipeline/` | Manifest linje 412: «ALDRI legg-igjen i generators/» |
| 10 | `has_3d_addon` skrives fra eksplisitt pipeline-input (CLI `--addon-3d`, default `false`), IKKE hardkodet `true`; PRD 3 EIER koblingen (ikke re-deferret) | PRD 2 §10 Q1 ga koblingen hit. Hardkodet `true` (`:217`) gjorde at `has_3d_addon` alltid var sann (3D-render-flagget var u-feilbart). 3D er ortogonalt render-flagg uavhengig av nivå (walkthrough 2026-06-27), ikke nivå-krav. Varig kjøps-kilde (kunde-/produkt-felt) → PRD 12; flagget/`false` er autoritativ til da |
| 11 | Featured SETTES SIST i hydrering (etter all linking/filtrering) | `hydrate-report.ts:7,113`; re-hydrering nuller featured → settes på nytt |
| 12 | `generate-story`-skills re-pekes FØR sletting | Manifest linje 637: verifiser `generate-bolig/hotel/naering` kjører den først |
| 13 | Geo-provider = **Mapbox Geocoding v6 (`match_code`)** (ikke Search Box); avbryt-gate flyttes fra flat `relevance` til typet `confidence`. Runtime-autocomplete (`/api/geocode/route.ts`) er OGSÅ v5 → port til v6 sammen med pipelinen ELLER bevisst behold | Andreas-beslutning 2026-06-27 (Åpne spørsmål #3 løst). v6 gir typet `match_code`-confidence; Search Box mangler relevance. Runtime-banen verifisert v5 i kontroll-runden — ellers divergerer pipeline-geocode (v6) og autocomplete (v5) |
| 14 | `pois.parent_poi_id` er reference-only, ikke nivå-1-krav; ingen pipeline-unit skriver det | Kontroll-runde 2026-06-27 (Åpne spørsmål #4 løst). `queries.ts:278`-pass-through beholdes uberørt |

### Kontroll-runde 2026-06-27

| # | Funn / dom | Konsekvens |
|---|------------|------------|
| K1 | **GEO-PROVIDER (blokker LØST):** Mapbox Geocoding v6 (`match_code`) valgt (Andreas). Unit 2 porter v5 (`geocode.ts:28`) → v6 og mapper `confidence`: `exact`/`high` passerer, `medium`/`low` avbryter; gate flyttes fra `provision-rapport.ts:337` (`relevance < 0.5`) til typet `confidence`-felt. | Åpne spørsmål #3 → LØST. Unit 2 kan låses. Beslutning #13. |
| K2 | **Runtime-autocomplete er OGSÅ v5** (ny note): `app/api/geocode/route.ts:24` + `ReportAddressInput.tsx:84` + `AddressAutocomplete.tsx:65`. Må enten porte til v6 sammen med pipelinen ELLER bevisst beholdes, ellers divergerer pipeline-geocode og runtime-autocomplete. | Hjemlet som PRD 3-oppfølging i §4 port-with-rewrite-tabell + Beslutning #13. |
| K3 | **`has_3d_addon` input-styrt (bekreftet):** hardkodet `has_3d_addon: true` (`create-report-project.ts:217`) → CLI-input (`--addon-3d`, default `false`). | Allerede dekket i Unit 5 AC2 (§7) + Beslutning #10; bekreftet uendret. |
| K4 | **`parent_poi_id` (bekreftet reference-only):** ikke nivå-1-krav; `queries.ts:278`-pass-through beholdes; ingen pipeline-unit. | Åpne spørsmål #4 → LØST. Beslutning #14. |
| K5 | **`trail-fetcher` (defer bekreftet):** `lib/generators/trail-fetcher.ts` er legacy-only (`generate-story.ts:225`); nytt board (`BoardMap3D.tsx`/`board-data.ts`) har 0 trail-refs. Behold som referanse, ikke slett før `generate-story`-dep er ryddet. | Åpne spørsmål #1 → LØST (defer). Ingen ny unit. |
| K6 | **travel-times-avklaring:** board-reisetider kommer fra build-time-precompute (`lib/generators/travel-times.ts` via `generate-story`) = PRD 3-territorium, IKKE runtime `/api/travel-times` (kun Explorer bruker runtime-banen). | Avklaring; ingen scope-endring her. |

---

## 10. Åpne spørsmål

1. **(ikke-blokkerende for Fase 1/2 — LØST 2026-06-27)** Turstier (`trail-fetcher`): nivå-1-feature med eksplisitt pipeline-steg, eller defer? **Dom: DEFER bekreftet — ingen ny pipeline-unit.** Verifisert i kontroll-runden: `lib/generators/trail-fetcher.ts` (`fetchTrails`) er legacy-only — eneste konsument er `generate-story.ts:225`; det nye board-et bruker den IKKE (`BoardMap3D.tsx`, `board/board-data.ts` har 0 trail-referanser). Behold `trail-fetcher.ts` som referanse; **ikke slett før `generate-story`-avhengigheten er ryddet** (Unit 1 / Beslutning #12). Status: ingen Unit-konsekvens i denne PRD-en.
2. **(ikke-blokkerende — løst i Unit 8 AC6)** Async job-grense: den synkrone 5–10 min self-serve-blokkeringen (manifest linje 427) er ratifisert til minimal isolasjon for prototype-stadiet (HTTP returnerer `pending`-status, pipeline kjører ferdig i prosess, ingen kø). Unit 8 AC6 bygges mot den faste kontrakten. Gjenstående informativt: når volum tilsier ekstern kø — koordineres med PRD 12 (admin-inngang), endrer ikke Unit 8s leveranse.
3. **(blokkerende for Unit 2 — LØST 2026-06-27, Andreas-beslutning)** Geo-provider OG confidence-mapping: én provider (Mapbox Geocoding v6 med `match_code`) eller Search Box (`/suggest`+`/retrieve`, ingen relevance)? **Dom: Mapbox Geocoding v6 med `match_code` velges** (ikke Search Box). Begrunnelse: v6 returnerer et typet `match_code`-confidence-objekt som lar AC2-mappingen være eksplisitt, mens Search Box ikke returnerer relevance og ville tvunget en svakere heuristikk på den eneste kvalitetsvakten før writes. Status: ikke lenger blokkerende — Unit 2 kan låses. Konkret port: dagens kode er v5 (`geocode.ts:28` `geocoding/v5/mapbox.places`, flat `relevance` `geocode.ts:10,48`); Unit 2 porter v5→v6 og mapper `match_code.confidence` til normalisert `confidence: number` (`exact`/`high` → ≥ 0.5 passerer, `medium`/`low` → < 0.5 avbryt). Avbryt-gaten flyttes fra flat `relevance < 0.5` (`provision-rapport.ts:337`) til typet `confidence`-felt. (NB: runtime-autocomplete-banen er OGSÅ v5 — se Beslutning #13.)
4. **(ikke-blokkerende — LØST 2026-06-27)** `pois.parent_poi_id` (kjøpesenter-hierarki, snapshot linje 125) skrives ikke i dagens pipeline. **Dom: reference-only — ikke et nivå-1-krav. Rebuild-pipelinen trenger det ikke; Google-discovery skal IKKE utlede det.** Behold `queries.ts`-pass-through (`queries.ts:278` `parent_poi_id: … ?? null`; les-side `queries.ts:123`) uberørt — ingen ny pipeline-unit skriver feltet. Status: avklart, ingen Unit-konsekvens.

---

## 11. Avhengigheter (PRD-graf)

```
        PRD 1 (datamodell)      PRD 2 (tier-manifest+taksonomi)      PRD 4 (trust-scoring)
              │                          │                                  │
              │   (pois/projects/        │  (getThemeDefaults,              │ (enrichTrustSignals,
              │    products/             │   getDiscoveryRadius,            │  batchValidateTrust,
              │    project_pois/         │   validateReportTier,           │  updatePOITrustScore —
              │    product_categories/   │   ReportTierSchema —            │  KJØRES i pipelinen,
              │    generation_requests)  │   SKRIVER reportTier+3d)        │  to-fase FØR scoring)
              └──────────────┬───────────┴──────────────┬─────────────────┘
                             ▼                           ▼
                  ┌──── prd-provisjon (PRD 3 — DENNE) ────┐
                  │   geocode → discovery(Google ∥ offentlig, DISTINKT)
                  │   → create-report-project(tier-decl) → trust-steg
                  │   → hydrering(featured+categories) → editorial(PRD 8)
                  │   → revalidering(PRD 7) → akseptanse(PRD 2-validator)
                  └───────────────────┬───────────────────┘
            ┌───────────────────────┬─┴───────────────────────┐
            ▼                       ▼                          ▼
   prd-board-data-state (5)   prd-self-serve-admin (12)   prd-instrumentering (13)
   (konsumerer output)        (kanonisk inngang)          (emit-site v/provisjon)
```

**Blokkeres av:** PRD 1, PRD 2, PRD 4 (`00-INDEX` linje 27: deps 01, 02, 04).
**Blokkerer:** PRD 5 (board-data konsumerer output), PRD 12 (self-serve-inngang), PRD 13-emit-sites.
**Injiserer fra (eier ikke):** `inheritAreaEditorial` (PRD 8), `getCameraTour` (PRD 9), `revalidateTag` (PRD 7).

---

**Fullstendighet:** 8 av 8 implementation units spesifisert med avhengigheter + akseptansekriterier; 8 av 8 mål (G1–G8) koblet til ≥1 unit. Alle bærende påstander forankret i `prod-schema-snapshot.txt` (generation_requests linje 41–58, pois source-kolonner 115–118/125), `CARRY-OVER-MANIFEST.md` (linje 67, 76–99, 404–437, 637, 691, 758) og faktisk kode (`provision-rapport.ts`, `create-report-project.ts`, `import-public-pois.ts`, `enrich-report-pois.ts`, `import-pois.ts`, `hydrate-report.ts`, `validate-report-trust.ts`, `geocode.ts`, `report-defaults.ts`, `app/api/generation-requests/route.ts`). Ingen P0/P1/P2-tiers; deferred work under Scope Boundaries med PRD-pekere; ingen render-gating spesifisert (patch #2).

---

### Walkthrough-revisjon 2026-06-27

Banket i per-PRD-walkthrough (eier-besluttet). To endringer mot kontroll-runde-baselinen:

- **To-nivå-modell (jf. PRD 2 + `00-INDEX` note #8):** pipelinen skriver `reportTier` `1|2` (default `1`); nivå 3 finnes ikke. Stale «nivå-3 `has3d`-grenen»-formuleringer i Unit 5 AC2 og §-tabell rad 10 reframet — `has_3d_addon` er et **ortogonalt render-flagg uavhengig av nivå**, ikke et nivå-krav, og ingen validator gater 3D mot nivå.
- **Skriver til `v2`-skjemaet (jf. PRD 1):** pipelinen leser/skriver `v2.*`-tabellene; referanse-boardene re-provisjoneres inn i `v2` (validerer demo-paritet + tester pipelinen i samme operasjon).

Uendret fra kontroll-runden: geo-provider = Mapbox Geocoding v6 (`match_code`), `has_3d_addon` som CLI-input (`--addon-3d`, default `false`), trail-fetcher DEFER, parent_poi_id reference-only.
