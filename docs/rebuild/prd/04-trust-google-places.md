# PRD 4 — Trust-scoring + Google Places-berikelse

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling.
> **Lag:** Lag 1 (hviler kun på fundamentet PRD 1; ingen tier-forking — `trust_*`/`poi_tier`/`google_*` er delte POI-felt som alle nivåer leser likt)
> **PRD-nr:** 4 av 15 (sommer-rebuild 2026)
> **Slug:** `prd-trust-google-places`
> **Kontekst:** Berikelses- og kvalitetslaget over POI-dataen. Eier Google Places-enrichment, den deterministiske trust-heuristikken (Layer 1+2), Google-foto-henting + CDN-proxy, og kontrakten for poi-tier-feltene. To-fase **re-enrichment FØR scoring** der rekkefølgen er load-bearing: POI-importen (`import-pois.ts:170–172`) nuller `google_website`/`google_business_status`/`google_price_level` eksplisitt (men BEVARER `google_rating`/`google_review_count` fra discovery, linje 157–158). Uten en re-enrichment-fase scores POIene på de nullede signalene: en legitim Google-POI UTEN bevart anmeldelses-signal (<50 reviews) faller til `no_website`-score 0.45 (< `MIN_TRUST_SCORE` 0.5) og skjules feilaktig. Høyt-anmeldte steder (≥200 reviews) skjules IKKE (0.6 − 0.15 + 0.2 = 0.65), så premisset er IKKE «alle POIer» — re-les-rekkefølgen er load-bearing for å unngå at lav-/middels-anmeldte legitime steder filtreres bort. Manglende API-nøkkel → POIen forblir `trust_score = null` (= vis), aldri degradert score. Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md` (linje 752 image-proxy→PRD4; linje 770 trust-felt-bekreftelse), `docs/rebuild/prod-schema-snapshot.txt` (pois-blokk linje 74–126 = kolonne-REFERANSE for v2-baseline, ikke live-prod-mål) og `docs/rebuild/prd/00-INDEX.md` linje 28. **Skjema:** alle felt skrives mot `v2.pois` (`.schema('v2')`); referanse-boardet re-provisjoneres i v2 av PRD 3.

---

## 1. Produktvisjon / Formål

Google Places gir Placy POI-volum, men ikke kvalitet. Et rått Places-søk returnerer spøkelses-bedrifter, permanent stengte steder, kjeder uten lokal verdi og falske 5.0-vurderinger med tre anmeldelser. Denne PRD-en eier **berikelses- og kvalitetslaget** som gjør rå Google-POIer til board-verdige POIer:

1. **Berikelse** — hent de Places-feltene importen ikke gir (`google_website`, `google_business_status`, `google_price_level`, ferske `google_rating`/`google_review_count`). *(Foto — `featured_image`/`gallery_images` — DEFERRED 2026-06-27, egen senere task.)*
2. **Trust-scoring** — en deterministisk, build-time heuristikk (Layer 1+2) som gir hver Google-POI en `trust_score` (0.0–1.0) + forklarende `trust_flags`, slik at read-time-filteret (`filterTrustedPOIs`, «null = vis, < 0.5 = skjul») biter på nye boards.
3. **Foto-proxy** *(DEFERRED 2026-06-27 — egen senere foto-task)* — en streng-allowlisted bilde-proxy for Google-MyMaps-bilder som ikke kan serveres direkte til klient.

To prinsipper skiller dette laget:

- **Rekkefølgen er kontrakt.** Enrichment MÅ kjøre FØR scoring, og scoringen MÅ re-lese radene etter enrichment, ellers scores POIene på de nullede import-signalene. Dette er en eksisterende, verifisert bug-fiks (`validate-report-trust.ts:114–166`), ikke en ny idé — rebuilden bevarer den 1:1.
- **Manglende nøkkel → stillNull, aldri degradert score.** Uten `GOOGLE_PLACES_API_KEY` enriches ingen POI, og de havner i `stillNull` med `trust_score = null` (= vis) i stedet for å få en feilaktig lav score (`validate-report-trust.ts:119–127`). Et board er ikke «evaluert» før `stillNull` er QA-klarert.

**Hvem konsumerer dette:** PRD 3 (provisjon) orkestrerer enrichment+scoring som pipeline-steg; PRD 5 (board-data) leser `featured_image`/`google_rating`/`trust_score`/`poi_tier` for visning og sortering. Denne PRD-en eier verdiene; den eier IKKE provisjons-orkestreringen eller board-rendringen av dem.

---

## 2. Mål (Goals)

Hvert mål kobler til minst én konkret requirement/unit i §7.

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | Port den deterministiske trust-heuristikken (Layer 1+2) verbatim som ren, I/O-fri funksjon med single-source flag-taksonomi. | `calculateHeuristicTrust` + `ALL_TRUST_FLAGS` + `batchValidateTrust` portet (Unit 1). |
| **G2** | Bevar SSRF-hardenet website-sjekken (privat-IP/redirect-TOCTOU-vern) uten regresjon. | `validateExternalUrl` + `checkWebsite` portet med eksisterende SSRF-tester (Unit 1). |
| **G3** | Lever den delte Places-enrichment-fasen (kandidat = `google_place_id` ∧ mangler `google_website`) med fail-soft per-POI concurrency-pool. | `enrichTrustSignals` + `fetchPlaceDetails`/`TRUST_ENRICHMENT_FIELDS` portet (Unit 2). |
| **G4** | Lever to-fase trust-pipeline-steget med load-bearing rekkefølge (enrich → re-les → score → persister) og `stillNull`-QA-kontrakt. | `validateReportTrust` portet inkl. re-les-fasen + `stillNull` (Unit 3). |
| **G5** *(DEFERRED — foto utsatt 2026-06-27, se §10)* | Google-foto-henting (Places API New, $0-tier): `featured_image`/`gallery_images`/`photo_reference` uten å slette eksisterende foto ved API-feil. | Unit 4 (deferred). |
| **G6** *(DEFERRED — foto utsatt 2026-06-27, se §10)* | Streng-allowlistet foto-proxy for ikke-direkteserverbare Google-bilder. | Unit 5 (deferred). |
| **G7** | Forankre poi-tier-skrivekontrakten (`poi_tier`/`tier_reason`/`is_chain`/`is_local_gem`/`poi_metadata`/`tier_evaluated_at`) inkl. editorial-overwrite-vern, og dokumentere at selve klassifiseringen kjøres av en build-time skill. | `updatePOITier`-mutasjonskontrakt + tier-skill-kontraktnotat (Unit 6). |
| **G8** | Bevis at semantikken er bevart og koden passerer alle mekaniske porter. | Test-port (`enrich-report-pois.test.ts` + trust-tester) + grønne lint/test/tsc/build (Unit 7). |

---

## 3. Arkitektur-/migrasjons-kontekst + nedstrøms-kontrakt-kart

I mantraet **«del nedover stacken, diverger oppover i UX»** sitter denne PRD-en på **berikelses-/kvalitetslaget rett over baseline**: `trust_*`-, `poi_tier`- og `google_*`-feltene er POI-kolonner som ALLE nivåer leser identisk. Det finnes ingen tier-forking her — trust-filteret gjelder nivå 1/2 likt (to-nivå-modell, walkthrough 2026-06-27). Render-laget gater ALDRI på `reportTier` (verifisert: ingen `reportTier`-ref i `BoardMap3D`/`ReportReelsPage`, jf. CARRY-OVER linje 770 patch #2), og denne PRD-en innfører ingen ny tier-gating.

**Migrasjons-kontekst (v2-schema):** Alle felt denne PRD-en skriver til EKSISTERER i **`v2.pois`** — referanse-boardet re-provisjoneres i v2-schemaet av PRD 3 (ikke in-place prod-data; samme kolonner re-derives i v2). All trust-/tier-/foto-skriving går mot `v2.*`: tabell-kall via `.schema('v2')`, rå REST via `Accept-Profile: v2` (les) / `Content-Profile: v2` (skriv). `docs/rebuild/prod-schema-snapshot.txt` (pois-blokk linje 74–126) er en **kolonne-REFERANSE** for hvilke kolonner som skal finnes — IKKE et live-prod-mål; de samme kolonnene re-derives i `v2.pois`. Denne PRD-en innfører INGEN ny migrasjon; den fyller felt PRD 1 leverer i v2-baseline.

> **LLM-kontekst (CLAUDE.md-regel):** Layer 1+2 er rent deterministisk og I/O-fri — ingen LLM. Layer 3 («Claude web search», flaggene `found_on_tripadvisor`/`claude_review_passed` osv., `poi-trust.ts:29–35`) og poi-tier-klassifiseringen kjøres av build-time **skills/kommandoer** (`/validate-poi-trust`, `.claude/commands/validate-poi-trust.md`), ALDRI runtime. Denne PRD-en porter heuristikk-koden + skrivekontrakten; skill-orkestreringen av Layer 3 er reference-only carry-over.

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument-PRD | Hva den konsumerer | Kontraktsfelt PRD 4 MÅ levere |
|---------------|--------------------|-------------------------------|
| PRD 3 — provisjon | `enrichReportPois`, `validateReportTrust` som pipeline-steg | `validateReportTrust(projectId)` → `ValidateReportTrustResult` `{scored, skipped, skippedPublic, stillNull, warnings}` (`validate-report-trust.ts:28–38`, IKKE admin-routens form); `enrichReportPois` → google/photos-stats |
| PRD 5 — board-data-state | `pois.google_rating`/`google_review_count`/`trust_score`/`poi_tier` for visning + sortering (foto-feltene `featured_image`/`gallery_images` er **null til foto-task lander** — deferred 2026-06-27) | Berikede/scorede felt persistert på pois-raden; `filterTrustedPOIs`-semantikk («null = vis»). **Ripple:** PRD 5 må rendre no-photo-fallback (kategorifarge/pin) til foto er på plass. |
| PRD 11 — realtime-transport | (ingen — PRD 11 leser kobling-felt fra baseline, ikke fra dette laget) | n/a |

### Avgrensning mot tilstøtende PRD-er

- **Grounding/Gemini-berikelse** (editorial-fact-feed) er IKKE her — eies av **PRD 7**. Denne PRD-en berører kun Google Places-signaler + trust, ikke editorial-innhold.
- **Board-rendring av trust-badges/foto** er IKKE her — eies av **PRD 9** (board-skall-UI). Denne PRD-en leverer feltene; visningen er nedstrøms.
- **`filterTrustedPOIs`-funksjonen selv** (`queries.ts:49`) bor i query-wrapperen (PRD 1s port-with-rewrite av `@/lib/supabase/queries`). Denne PRD-en EIER read-time-trust-semantikken som kontrakt (terskel `MIN_TRUST_SCORE`, «null = vis»), men funksjonen lever fysisk i query-laget og porteres der; her dokumenteres terskel-kontrakten den må respektere.

---

## 4. Eksisterende kodebase

### Bæres over (keeper-core / port-with-rewrite)

| Fil (@/-sti) | Verdict | Rolle (verifisert) |
|--------------|---------|--------------------|
| `@/lib/utils/poi-trust.ts` (400 LOC) | keeper-core (port verbatim) | `calculateHeuristicTrust` (ren, linje 106), `ALL_TRUST_FLAGS` single-source (linje 19–38), `MIN_TRUST_SCORE = 0.5` (linje 73), `validateExternalUrl` SSRF (linje 184), `checkWebsite` redirect-manual (linje 262), `batchValidateTrust` domene-dedup-pool (linje 331), `buildTrustSignals` (linje 312). |
| `@/lib/google-places/fetch-place-details.ts` (96 LOC) | port-with-rewrite (header-auth-migrering) | `fetchPlaceDetails` (linje 51), `TRUST_ENRICHMENT_FIELDS` (linje 32), `DEFAULT_FIELDS` (linje 20), 10s timeout (linje 41). Nøkkel i `key=`-querystring i dag (linje 57, legacy Places) — Unit 2 migrerer til Places New header-auth (speil `photo-api.ts:48–52`), se §5.4. Kall-stier: `trust-enrichment.ts:91` + `app/api/places/[placeId]/route.ts:74`. |
| `@/lib/google-places/trust-enrichment.ts` (174 LOC) | keeper-core (port verbatim) | `enrichTrustSignals` fail-soft pool (linje 58), `mapPoiRowToPOIForTrust` (linje 158), kandidat-filter `google_place_id ∧ !google_website` (linje 72–73). |
| `@/lib/pipeline/validate-report-trust.ts` (190 LOC) | keeper-core (port verbatim) | To-fase steg: skip public (linje 96), enrich (linje 128), re-les etter enrich (linje 149), score+persister (linje 168), `stillNull` (linje 35/141). |
| `@/lib/google-places/photo-api.ts` (98 LOC) | keeper-core (port verbatim) | `fetchPhotoNames` (linje 42, kaster på ≠404 for ikke å slette foto, linje 59–61), `resolvePhotoUri` (linje 74, $0 skipHttpRedirect), nøkkel i `X-Goog-Api-Key`-header (linje 51/82 — header-konform). |
| `@/lib/utils/fetch-poi-photos.ts` (150 LOC) | keeper-core (port + dokumenter Supabase-divergens) | `fetchAndCachePOIPhotos` (linje 33), kandidat = `google_place_id ∧ !featured_image` (linje 62), batch 10 + 500ms-delay (linje 10–11). **OBS: snakker med Supabase via rå REST mot `/rest/v1/` med service-role-nøkkel i header (linje 47–48 select, linje 115–116 PATCH), IKKE via `@/lib/supabase`-wrapperen — i kontrast til Unit 3 (`createServerClient`). Build-time/CLI-kontekst (ingen cookie); divergensen må dokumenteres eller fjernes i Unit 4, ikke skjules av «port verbatim» (se §5.4 + Unit 4 AC5).** |
| `@/lib/pipeline/enrich-report-pois.ts` (154 LOC) | keeper-core (port verbatim) | `enrichReportPois` (linje 63), `BOLIG_GOOGLE_CATEGORIES`/`NAERING_GOOGLE_CATEGORIES` (linje 13/32), foto-batch-kall (linje 128). |
| `@/app/api/image-proxy/route.ts` (42 LOC) | port-with-rewrite | Foto-proxy, host-allowlist `mymaps.usercontent.google.com` (linje 3). Manifest linje 752 tildeler denne til PRD 4. |
| `@/lib/supabase/mutations.ts` → `updatePOITrustScore` (linje 590) + `updatePOITier` (linje 634) | port-with-rewrite (lever fysisk i PRD 1-portet mutations-wrapper) | Trust-persist (linje 590, validerer 0–1 + flag), tier-persist (linje 634, editorial-overwrite-vern linje 673–681; existing-select linje 657 mangler `error`-sjekk → fikses i Unit 6 AC2). |
| `@/lib/pipeline/enrich-report-pois.test.ts` | keeper-core (port + utvid) | Akseptansekriterie-kilde for enrichment. |
| `@/.claude/commands/validate-poi-trust.md` | reference-only (skill-kontrakt) | Build-time Layer 1+2+3-orkestrering via admin-API + Supabase; dokumenterer Layer 3 + tier-klassifisering. |

### Slettes / forlates (reference-only / dead)

| Objekt | Verdict | Begrunnelse |
|--------|---------|-------------|
| `pois.event_*`-relevans for trust | n/a | Trust rører ikke event-felt; event-spor parkert (PRD 1 beholder kolonnene reference-only). |
| Layer 3 runtime-implementasjon | finnes ikke / reference-only | Layer 3 er flagg-taksonomi (`poi-trust.ts:29–35`) + skill-orkestrering, ingen runtime-kode å porte. Build-time only (CLAUDE.md). |
| Render-gating på trust/tier | finnes ikke / skal ikke bygges | Read-time-filter (`filterTrustedPOIs`) er eneste gating; ingen `reportTier`-gating (patch #2). |

> **`updatePOITier`-kaller-presisering (verifisert):** `grep` etter `updatePOITier(` på tvers av `lib`/`scripts`/`app` gir INGEN programmatisk kaller i repoet — funksjonen kalles av admin/skill-pathen (`/validate-poi-trust` + tier-klassifiserings-skill), ikke av en pipeline-fil. Den faktiske tier-KLASSIFISERINGS-logikken (chain-deteksjon, local-gem-heuristikk) lever i skill-laget, ikke i en portbar `.ts`-modul **(uverifisert hvor presist klassifiseringen kjører — avklar i Unit 6 om den skal flyttes til en portbar `lib/`-modul eller forbli skill-eid)**. Denne PRD-en porter SKRIVEKONTRAKTEN (`updatePOITier`) + dokumenterer skill-kontrakten; den oppfinner ingen ny klassifiserer.

---

## 5. Datakontrakt / Skjema

Alle felt eksisterer i `v2.pois` (PRD 1 baseline re-provisjonert i v2; snapshot linje 74–126 = kolonne-REFERANSE, ikke live-prod-mål). Denne PRD-en SKRIVER til disse via `v2.*` (`.schema('v2')` for tabell-kall, `Content-Profile: v2` for rå REST-skriv); den eier ingen migrasjon.

### 5.1 Felt PRD 4 EIER (skriver til)

| Felt (prod-kolonne) | Type (snapshot) | Skrives av | Snapshot-linje |
|---------------------|-----------------|------------|----------------|
| `google_website` | text | `enrichTrustSignals` | 99 |
| `google_business_status` | text | `enrichTrustSignals` | 100 |
| `google_price_level` | integer | `enrichTrustSignals` | 101 |
| `google_rating` | numeric | `enrichTrustSignals` (refresh — se OBS) | 81 |
| `google_review_count` | integer | `enrichTrustSignals` (refresh — se OBS) | 82 |
| `trust_score` | numeric (YES) | `updatePOITrustScore` | 96 |
| `trust_flags` | ARRAY (**NO**/NOT NULL) | `updatePOITrustScore` | 97 |
| `trust_score_updated_at` | timestamptz | `updatePOITrustScore` | 98 |
| `poi_tier` | smallint | `updatePOITier` (skill-drevet) | 102 |
| `tier_reason` | text | `updatePOITier` | 103 |
| `is_chain` | boolean | `updatePOITier` | 104 |
| `is_local_gem` | boolean | `updatePOITier` | 105 |
| `poi_metadata` | jsonb | `updatePOITier` | 106 |
| `tier_evaluated_at` | timestamptz | `updatePOITier` | 107 |
| `featured_image` | text | `fetchAndCachePOIPhotos` *(deferred U4)* | 89 |
| `gallery_images` | ARRAY | `fetchAndCachePOIPhotos` *(deferred U4)* | 113 |
| `photo_reference` | text | `fetchAndCachePOIPhotos` *(deferred U4)* | 84 |
| `photo_resolved_at` | timestamptz | `fetchAndCachePOIPhotos` *(deferred U4)* | 114 |
| `facebook_url` | text | (ingen populerende kilde — manuelt/seed-felt: skrives kun manuelt/seed (migration 033) + passthrough-mappinger som videresender eksisterende verdi `queries.ts:104/264`, `public-queries.ts:272`; lest av board + JSON-LD. Verifisert kontroll-runde 2026-06-27) | 112 |

> **OBS — `refresh` kan stille NULLE eksisterende rating/review_count (verifisert):** `trust-enrichment.ts:109–110` skriver `google_rating: details.rating ?? null` / `google_review_count: details.reviewCount ?? null` — ubetinget coalesce til null, IKKE «behold eksisterende ved undefined». En POI som hadde gyldig rating/review_count fra import (`import-pois.ts:157–158`) kan dermed få det NULLET ut hvis Place Details-svaret mangler feltet — et stille data-tap som «refresh»-merkelappen skjuler. Kontrast: foto-pathen er eksplisitt vernet mot akkurat dette (`photo-api.ts:59–61` kaster på ≠404 «to prevent data deletion»), men rating-refreshen mangler samme vern. Adresseres i Unit 2 AC6.

### 5.2 Felt PRD 4 KONSUMERER (leser, eier ikke)

| Felt | Eies av | Brukt til |
|------|---------|-----------|
| `pois.google_place_id` | PRD 3 (import) | Kandidat-gate for enrichment/foto (linje 80) |
| `pois.id`/`name`/`lat`/`lng`/`address`/`category_id` | PRD 1 | `mapPoiRowToPOIForTrust` (POI-mapping) |
| `project_pois.poi_id` | PRD 1 | Avgrens trust-scoring til prosjektets POIer |

### 5.3 Trust-heuristikk-kontrakt (semantikk som MÅ bevares 1:1)

`calculateHeuristicTrust(signals): { score, flags, needsClaudeReview }` — ren funksjon, ingen I/O. Verifisert oppførsel (`poi-trust.ts:106–170`):

| Regel | Effekt på score | Flag |
|-------|-----------------|------|
| `businessStatus === "CLOSED_PERMANENTLY"` | hard `score = 0`, returnerer tidlig | `permanently_closed` |
| Base | `0.6` (`BASE_SCORE`) | — |
| `!website ∧ rating === 5.0 ∧ reviews < 100` | `−0.3` | `suspect_no_website_perfect_rating` |
| `!website` (ellers) | `−0.15` | `no_website` |
| `websiteResponds === true` | `+0.1` | `website_ok` |
| `isSuspiciousDomain` | `−0.3` | `suspicious_domain` |
| `hasPriceLevel` | `+0.05` | `has_price_level` |
| `businessStatus === "OPERATIONAL"` | `+0.05` | — |
| `reviews >= 200` | `+0.2` | `high_review_count` |
| `reviews >= 50` (ellers) | `+0.1` | `moderate_review_count` |
| Clamp | `[0, 1]`, 2 desimaler | — |
| `needsClaudeReview` | `true` hvis `0.3 ≤ score ≤ 0.7` | (→ Layer 3 skill) |

`MIN_TRUST_SCORE = 0.5` (linje 73) er read-time-terskelen. `filterTrustedPOIs` (`queries.ts:49`): `trustScore == null → vis`; `< 0.5 → skjul`. Denne PRD-en eier terskelen + «null = vis»-semantikken som kontrakt; funksjonen porteres fysisk i PRD 1s query-wrapper.

`ALL_TRUST_FLAGS` (linje 19–38) er single source of truth — `TrustFlag`-typen OG `VALID_TRUST_FLAGS`-settet deriveres fra den. `updatePOITrustScore` validerer hver flag mot settet (`mutations.ts:601–605`) og score-range 0–1 (linje 596).

### 5.4 SSRF + API-nøkkel-kontrakt (sikkerhetsregler — håndheves i akseptansekriterier)

- **Website-sjekk SSRF (`poi-trust.ts:184–303`):** `validateExternalUrl` blokkerer privat-IP-range, bare-IP, IPv6, localhost, sky-metadata-endepunkter (`169.254.169.254`/`metadata.google.internal`), ikke-http-protokoll, og krever FQDN. `checkWebsite` bruker `redirect: "manual"` + validerer redirect-target (TOCTOU-vern, linje 278–292). MÅ porteres uten regresjon.
- **Foto-proxy SSRF (`image-proxy/route.ts:3/19`):** Streng host-allowlist (`ALLOWED_HOSTS = ["mymaps.usercontent.google.com"]`) — ikke privat-IP-blokklist, men positiv allowlist. Port-with-rewrite: behold allowlist-mønsteret; vurder å utvide allowlisten KUN hvis et nytt verifisert verts-behov finnes (ikke spekulativt).
- **API-nøkkel-plassering (CLAUDE.md-regel — verifisert brudd, dom landet 2026-06-27):** `photo-api.ts` bruker korrekt `X-Goog-Api-Key`-header (linje 51/82). MEN `fetch-place-details.ts:57` legger nøkkelen i `key=`-**querystring** (`...&key=${apiKey}`) mot legacy Places API (`maps.googleapis.com/maps/api/place/details`), som ikke støtter header-auth. **Besluttet (a):** Unit 2 migrerer `fetchPlaceDetails` til Places API (New) header-auth ved å speile det EKSISTERENDE mønsteret i `photo-api.ts:48–52` (`X-Goog-Api-Key` + `X-Goog-FieldMask`). Migreringen lukker CLAUDE.md-regelen «API-nøkkel i header, ALDRI URL» for BEGGE kall-stier som treffer `fetchPlaceDetails`: pipeline-stien (`trust-enrichment.ts:91`) OG klient-route-stien (`app/api/places/[placeId]/route.ts:74`). NOTE: migrering medfører feltnavn-skift legacy→Places-New camelCase + `FieldMask` — felt-mappingen (`TRUST_ENRICHMENT_FIELDS`/`DEFAULT_FIELDS`) må oppdateres tilsvarende (jf. §11 Q1).
- **Lint dekker IKKE disse to reglene (verifisert):** `eslint.config.mjs:11–22` har kun én `no-restricted-imports`-regel (`name: "@supabase/supabase-js"`); den ser verken `fetch("/rest/v1/...")` eller `key=`-i-querystring. Derfor passerer både `fetch-place-details.ts:57` (key i URL) og `fetch-poi-photos.ts:47/116` (rå REST-Supabase) lint uten advarsel. «Grønn lint» beviser IKKE CLAUDE.md-konformitet for nøkkel-plassering eller wrapper-bruk — disse må verifiseres eksplisitt (grep-/test-assertion, se Unit 7 AC5).
- **Supabase-wrapper-divergens (`fetch-poi-photos.ts` — verifisert):** Filen skriver POI-foto via rå REST-PATCH mot `${supabaseUrl}/rest/v1/pois?id=eq...` (linje 115–116) med service-role-nøkkel i header (linje 47–48), IKKE via `@/lib/supabase`-wrapperen PRD 1 eier — i kontrast til `validate-report-trust.ts:44` (`createServerClient()`). Dette er ikke et klient-Supabase-brudd (build-time/CLI, ingen cookie-kontekst), men det omgår wrapper-laget. Unit 4 må eksplisitt enten (a) porte filen til `createServerClient`-instans i tråd med resten av pipeline-laget, eller (b) dokumentere i fil-header HVORFOR rå REST beholdes (service-role-skriving uten cookie-kontekst i CLI). Ikke la det forbli udokumentert under «port verbatim».

---

## 6. Implementation Units (7 av maks 8)

### Unit 1 — Trust-heuristikk-kjerne (Layer 1+2, ren + SSRF) port verbatim
- **Mål (→ G1, G2):** Port `poi-trust.ts` verbatim — ren scoring, single-source flag-taksonomi, SSRF-hardenet website-sjekk.
- **Filer:** `@/lib/utils/poi-trust.ts`.
- **Avhengigheter:** PRD 1 (`POI`-type re-derives fra baseline).
- **Akseptansekriterier:**
  1. `calculateHeuristicTrust` produserer identiske score/flags som §5.3-tabellen for alle ni regler + clamp + `needsClaudeReview`-vindu (0.3–0.7).
  2. `ALL_TRUST_FLAGS` er eneste kilde; `TrustFlag` og `VALID_TRUST_FLAGS` deriveres fra den (ingen duplikatliste).
  3. `validateExternalUrl` blokkerer alle kategoriene i §5.4 (privat-IP, bare-IP, IPv6, localhost, metadata, ikke-http, ikke-FQDN); `checkWebsite` bruker `redirect: "manual"` + validerer redirect-target.
  4. `batchValidateTrust` dedupliserer website-sjekk per domene og kjører concurrency-pool uten deadlock (pool teller alltid ned, også ved synkron throw / catch).
  5. Eksisterende `poi-trust`-tester passerer uendret (de er akseptansekriterie-kilden); `MIN_TRUST_SCORE = 0.5` eksportert.

### Unit 2 — Places-enrichment-fase (delt) port + nøkkel-kontrakt-avklaring
- **Mål (→ G3):** Port `fetch-place-details.ts` + `trust-enrichment.ts` — kandidat-filter, fail-soft pool, og lukk/dokumenter API-nøkkel-plasseringen.
- **Filer:** `@/lib/google-places/fetch-place-details.ts`, `@/lib/google-places/trust-enrichment.ts`.
- **Avhengigheter:** PRD 1 (`createServerClient`-typen + `POI`), Unit 1 (`POI`-mapping mates til scoring).
- **Akseptansekriterier:**
  1. `enrichTrustSignals` velger kun kandidater med `google_place_id ∧ !google_website`; tom kandidatliste → no-op (returnerer `{enriched:0, failedPoiIds:[], errors:[]}`).
  2. Per-POI fail-soft: fetch-/DB-feil og «place not found» legges i `errors` + `failedPoiIds`, stopper aldri poolen; pool-nedtelling skjer også ved synkron throw (deadlock-vern, linje 136–148).
  3. `fetchPlaceDetails` bruker `TRUST_ENRICHMENT_FIELDS` (5 felt) for enrichment, 10s timeout (`AbortController`), returnerer `null` ved `status !== "OK"`.
  4. **API-nøkkel-kontrakt (CLAUDE.md — BEKREFTET migrering, dom 2026-06-27):** `fetchPlaceDetails` migreres til Places API (New) header-auth ved å speile det eksisterende mønsteret i `photo-api.ts:48–52` (`X-Goog-Api-Key` + `X-Goog-FieldMask`); nøkkelen forsvinner fra `key=`-querystringen (linje 57). Migreringen lukker regelen for BEGGE kall-stier (`trust-enrichment.ts:91` OG `app/api/places/[placeId]/route.ts:74`). Feltnavn-skift legacy→Places-New camelCase + `FieldMask` (`TRUST_ENRICHMENT_FIELDS`/`DEFAULT_FIELDS`) oppdateres i samme port.
  5. `facebook_url`-skrive-kilden er AVKLART (kontroll-runde 2026-06-27): INGEN enrichment-fase populerer `pois.facebook_url`. Det er et manuelt/seed-felt (migration 033) + passthrough-mappinger som kun videresender eksisterende verdi (`queries.ts:104/264`, `public-queries.ts:272`), lest av board + JSON-LD. Unit 2 dokumenterer dette i fil-header — enrichment skal IKKE forsøke å fylle feltet.
  6. **Rating/review_count-refresh uten utilsiktet null-overskriving:** enrichment overskriver `google_rating`/`google_review_count` KUN når Place Details faktisk returnerer en verdi; ved `undefined`/manglende felt beholdes eksisterende DB-verdi (ingen stille null-overskriving av bevart import-data, `import-pois.ts:157–158`). Alternativt: dokumenter eksplisitt i fil-header at refresh-til-null er ønsket atferd. Dagens kode (`trust-enrichment.ts:109–110`) coalescer ubetinget til null — per CLAUDE.md «ferdig betyr ferdig» skal dette ikke forbli implisitt.

### Unit 3 — To-fase trust-pipeline-steg (enrich → re-les → score → persister)
- **Mål (→ G4):** Port `validate-report-trust.ts` med load-bearing rekkefølge + `stillNull`-kontrakt.
- **Filer:** `@/lib/pipeline/validate-report-trust.ts`.
- **Avhengigheter:** Unit 1, Unit 2, PRD 1 (`updatePOITrustScore` i portet mutations-wrapper).
- **Akseptansekriterier:**
  1. Offentlige kilde-POIer (uten `google_place_id`) skippes BEVISST → `skippedPublic`, beholder `trust_score = null` (= vis). `manual_override`-flagg og allerede-scorede → `skipped`.
  2. Rekkefølgen er enrich (Unit 2) → re-les radene (`select * in scoreIds`) → score (`batchValidateTrust`) → persister (`updatePOITrustScore`). Scoringen ser ALDRI de nullede import-signalene (`google_website`/`business_status`/`price_level`). Rekkefølgen er load-bearing spesielt for lav-/middels-anmeldte legitime POIer (<50 bevarte reviews) som ellers ville falt til `no_website`-score 0.45 og blitt filtrert bort; høyt-anmeldte (≥200) berøres ikke (scorer 0.65), men rekkefølge-kontrakten gjelder uansett.
  3. Manglende `GOOGLE_PLACES_API_KEY` → POIer som trenger enrichment scores IKKE; de legges i `stillNull` med warning (linje 119–127). Ingen degradert score.
  4. Fail-soft per POI gjennom hele steget; ingen unlinking fra `project_pois`/`product_pois` (filtrering, ikke sletting). Henting-feil gir warning + dagens oppførsel (alle null = vis), ikke abort.
  5. Returkontrakt `{scored, skipped, skippedPublic, stillNull, warnings}` matcher signaturen `validate-report-trust.ts:28–38` eksporterer i dag (`ValidateReportTrustResult`) — dette er PRD 3-konsumkontrakten. (MERK: admin-routens stats-form `{trusted, flagged, needsClaudeReview, skipped}` i `app/api/admin/trust-validate/route.ts:32–42` er en SEPARAT, ikke-delt kontrakt — det er ingen bakoverkompatibilitets-binding mot den.)

### Unit 4 — Google-foto-henting (Places API New, $0) port verbatim
> **⏸ DEFERRED (eier-beslutning 2026-06-27):** Foto trengs ikke i første runde — legges til senere. Spec beholdt fullt intakt (porteres når foto-task aktiveres). Påvirker ikke trust-kjernen (Unit 1–3, 6). Se §10 Deferred.
- **Mål (→ G5):** Port `photo-api.ts` + `fetch-poi-photos.ts` — sett `featured_image`/`gallery_images`/`photo_reference` uten å slette foto ved API-feil.
- **Filer:** `@/lib/google-places/photo-api.ts`, `@/lib/utils/fetch-poi-photos.ts`.
- **Avhengigheter:** PRD 1 (pois-skjema).
- **Akseptansekriterier:**
  1. `fetchPhotoNames` bruker Places API (New) `X-Goog-FieldMask: photos`; returnerer `[]` KUN ved ekte 404, KASTER ved andre ≠ok-statuser (403/429/500) for ikke å feiltolke API-feil som «ingen foto» og slette eksisterende data.
  2. `resolvePhotoUri` bruker `skipHttpRedirect=true` ($0-tier) og returnerer direkte CDN-URL.
  3. `fetchAndCachePOIPhotos` targeter kun POIer med `google_place_id ∧ !featured_image`; batch 10 + 500ms-delay mellom batcher; setter `featured_image` (800px) + opptil 3 `gallery_images` + `photo_reference` (new-format-navn) + `photo_resolved_at`.
  4. Per-POI fail-soft: foto-feil teller `failed` + `errors`, stopper aldri batchen; POIen faller tilbake til kategorifarge.
  5. **Supabase-tilgangskontrakt avklart (verifisert divergens):** `fetch-poi-photos.ts` snakker i dag med Supabase via rå REST (`/rest/v1/`, service-role i header, linje 47–48/115–116), ikke via `@/lib/supabase`-wrapperen. Porten MÅ resultere i ett av to eksplisitte utfall: (a) ta inn en `createServerClient`-instans i tråd med PRD 1s wrapper-eierskap og resten av pipeline-laget, ELLER (b) beholde rå REST MED en fil-header-kommentar som dokumenterer hvorfor (service-role-skriving uten cookie-kontekst i CLI). Ikke etterlat udokumentert wrapper-bypass.

### Unit 5 — Foto-proxy (host-allowlist SSRF) port-with-rewrite
> **⏸ DEFERRED (eier-beslutning 2026-06-27):** Henger på Unit 4 (foto) — porteres sammen med foto-task. Spec beholdt fullt intakt. Se §10 Deferred.
- **Mål (→ G6):** Port `image-proxy/route.ts` for Google-MyMaps-bilder som ikke kan serveres direkte.
- **Filer:** `@/app/api/image-proxy/route.ts`.
- **Avhengigheter:** PRD 1 (ingen DB; ren proxy).
- **Akseptansekriterier:**
  1. Streng host-allowlist håndheves: `mymaps.usercontent.google.com` → 200 med bildebuffer + cache-headere; alle andre verter → 403; manglende/ugyldig `url` → 400; upstream-feil → 502.
  2. Cache-headere bevart (`Cache-Control`/`CDN-Cache-Control: public, max-age=2592000`).
  3. Allowlisten utvides KUN ved et verifisert nytt verts-behov, ikke spekulativt (vokt scope; «implementer riktig» ≠ utvid).

### Unit 6 — poi-tier-skrivekontrakt + tier-skill-kontraktnotat
- **Mål (→ G7):** Forankre `updatePOITier`-skrivekontrakten (inkl. editorial-overwrite-vern) og dokumentere at klassifiseringen er skill-drevet build-time.
- **Filer:** `@/lib/supabase/mutations.ts` (`updatePOITier` + `updatePOITrustScore`, lever i PRD 1-portet wrapper), `@/docs/rebuild/poi-tier-classification-contract.md` (nytt notat).
- **Avhengigheter:** PRD 1 (mutations-wrapper portet), Unit 1 (`VALID_TRUST_FLAGS`-validering).
- **Akseptansekriterier:**
  1. `updatePOITrustScore` validerer score 0–1 + hver flag mot `VALID_TRUST_FLAGS`, setter `trust_score`/`trust_flags`/`trust_score_updated_at`, eksplisitt error-håndtering (kaster med tydelig melding ved DB-feil — ingen stille swallow).
  2. `updatePOITier` validerer `poi_tier ∈ {1,2,3}`, skriver tier-felt + `poi_metadata` + `tier_evaluated_at`, og bevarer hand-crafted editorial: skriver `editorial_hook`/`local_insight`/`editorial_sources` KUN når eksisterende verdi er null (`mutations.ts:673–681`). **NB — to distinkte akser:** `poi_tier` (1–3, POI-klassifisering chain/local-gem — `mutations.ts:647`) er en EGEN akse, IKKE board-`reportTier` (1|2, to-nivå-modell). De to skal ALDRI konflateres; `poi_tier`-rangen `{1,2,3}` er uendret av to-nivå-forenklingen. **Port-with-rewrite-forbedring (verifisert svakhet i dag):** existing-selecten (`mutations.ts:657`) destrukturerer kun `{ data: existing }` uten `error`-sjekk — ved select-feil blir `existing` `undefined`, `existing?.editorial_hook === null` blir `false`, og editorial droppes STILLE (i strid med AC1s «ingen stille swallow»). Porten MÅ sjekke `error` på existing-selecten og kaste ved feil, slik at `undefined`-existing ikke stille hopper over editorial-vernet (oversetter kvalitetsfunn til «implementer riktig», ikke 1:1-port av en eksisterende stille bug).
  3. Kontraktnotatet dokumenterer at Layer 3 (Claude web search-flagg) + tier-klassifisering kjøres av `/validate-poi-trust`-skill (build-time, ALDRI runtime), og avklarer eksplisitt om klassifiserings-LOGIKKEN skal flyttes til en portbar `lib/`-modul eller forbli skill-eid (åpent — se §10 Q3).
  4. `facebook_url`/poi-tier-felt-konsum dokumentert for PRD 5 (board-data leser dem).

### Unit 7 — Pipeline-orkestrering (enrichReportPois) port + test-port + mekaniske porter
> **Foto-del DEFERRED 2026-06-27:** `enrichReportPois` porteres nå for import + Google-enrichment-orkestrering; `fetchAndCachePOIPhotos`-kallet (foto-fasen) wires inn når foto-task lander (Unit 4). Foto-leddene i AC1/AC3 er deferred til da.
- **Mål (→ G3, G8; G5 deferred):** Port `enrich-report-pois.ts` (provisjon-orkestreringen) og bevis semantikk via tester + grønne porter.
- **Filer:** `@/lib/pipeline/enrich-report-pois.ts`, `@/lib/pipeline/enrich-report-pois.test.ts`.
- **Avhengigheter:** Unit 2 (enrichment); Unit 4 (foto) er DEFERRED — foto-kallet wires inn senere.
- **Akseptansekriterier:**
  1. `enrichReportPois` kaller `importPOIsToProject` (foto-kallet `fetchAndCachePOIPhotos` deferred — Unit 4); `BOLIG_GOOGLE_CATEGORIES` (14) default, `NAERING_GOOGLE_CATEGORIES` (13, hotel inn / shopping_mall+spa ut) ved næringsprofil.
  2. CLI-`revalidatePath`-throw fanges (data er allerede skrevet) → leser faktisk antall fra DB, fortsetter med warning (linje 97–116) — ikke abort.
  3. Manglende `GOOGLE_PLACES_API_KEY` → foto-fasen skippes med warning, POIer bruker kategorifarge (linje 145–146); manglende Supabase-env kaster tidlig (linje 79–81).
  4. Eksisterende `enrich-report-pois.test.ts` passerer etter port + utvides for kategoriliste-divergens (bolig vs næring).
  5. **Mekaniske porter grønne — MEN ikke som CLAUDE.md-bevis:** `npm run lint` (0 errors), `npm test`, `npx tsc --noEmit`, `npm run build` passerer. Siden `eslint.config.mjs:11–22` beviselig IKKE fanger rå-REST-Supabase eller nøkkel-i-querystring (kun `@supabase/supabase-js`-import), legges to EKSPLISITTE, verifiserbare assertions i tillegg: (a) en grep-/test-assertion som verifiserer at `GOOGLE_PLACES_API_KEY` ALDRI havner i en URL-querystring i `lib/google-places/**` (lukker CLAUDE.md «nøkkel i header, ALDRI URL» — jf. Unit 2 AC4); (b) en sjekk for at all enrichment-/foto-skriving går via godkjent path (wrapper ELLER dokumentert rå-REST-unntak per Unit 4 AC5). «Grønn lint» listes IKKE som bevis på disse to reglene.

> **Fullstendighet:** 7 units spesifisert (5 aktive: U1–U3, U6, U7; 2 deferred: U4 foto-henting + U5 foto-proxy, eier-beslutning 2026-06-27). Hver fil i §4 keeper/port-tabellen er eksplisitt eid av en unit (poi-trust→U1, fetch-place-details+trust-enrichment→U2, validate-report-trust→U3, photo-api+fetch-poi-photos→U4 *(deferred)*, image-proxy→U5 *(deferred)*, mutations tier/trust→U6, enrich-report-pois→U7). Hvert §5.1-skrivefelt har en navngitt skriver (foto-feltene skrives av deferred U4).

---

## 7. Goals → Requirements-kobling

| Goal | Leveres av (requirement / unit) |
|------|---------------------------------|
| **G1.** Trust-heuristikk-kjerne (ren) | Unit 1 (`calculateHeuristicTrust` + `ALL_TRUST_FLAGS` + `batchValidateTrust`) |
| **G2.** SSRF-hardenet website-sjekk | Unit 1 (`validateExternalUrl` + `checkWebsite`) |
| **G3.** Delt Places-enrichment-fase | Unit 2 (`enrichTrustSignals` + `fetchPlaceDetails`) + Unit 7 (orkestrering) |
| **G4.** To-fase trust-pipeline (rekkefølge) + `stillNull` | Unit 3 (`validateReportTrust`) |
| **G5.** Google-foto-henting *(DEFERRED 2026-06-27)* | Unit 4 (`fetchPhotoNames`/`resolvePhotoUri` + `fetchAndCachePOIPhotos`) + Unit 7 foto-ledd — alle deferred |
| **G6.** Foto-proxy (allowlist) *(DEFERRED 2026-06-27)* | Unit 5 (`image-proxy/route.ts`) — deferred |
| **G7.** poi-tier-skrivekontrakt + skill-kontrakt | Unit 6 (`updatePOITier`/`updatePOITrustScore` + kontraktnotat) |
| **G8.** Semantikk bevart + mekaniske porter grønne | Unit 7 (test-port + lint/test/tsc/build) |

---

## 8. Utviklingsløp (faser)

### Fase 1 — Ren kjerne (offline, ingen I/O-avhengighet)
- **Mål:** Trust-heuristikken + SSRF-vernet + flag-taksonomien portet og testet uten nett/DB.
- **Leveranse:** Unit 1 ferdig; eksisterende `poi-trust`-tester grønne; ren funksjon bevist deterministisk.
- **Autonomi-nivå:** Høy. Ren port av godt testet, I/O-fri kode.

### Fase 2 — Berikelse (I/O-lag)
- **Mål:** Places-enrichment portet; API-nøkkel-kontrakten lukket/dokumentert. *(Foto-henting + foto-proxy DEFERRED 2026-06-27 — egen foto-task senere.)*
- **Leveranse:** Unit 2 ferdig; nøkkel i header (eller dokumentert avgrensning). *(Unit 4/5 deferred.)*
- **Autonomi-nivå:** Middels. API-nøkkel-flytt (Unit 2 AC4) og `facebook_url`-kilde-avklaring (Unit 2 AC5) krever verifikasjon mot faktisk API-oppførsel.

### Fase 3 — Orkestrering + tier-kontrakt + porter
- **Mål:** To-fase trust-steget, enrich-orkestreringen, tier-skrivekontrakten og alle mekaniske porter på plass.
- **Leveranse:** Unit 3, 6, 7 ferdig; rekkefølge-kontrakten verifisert (enrich→re-les→score); `stillNull`-QA-kontrakt levert til PRD 3; lint/test/tsc/build grønne.
- **Autonomi-nivå:** Middels. Tier-klassifiserings-eierskap (Q3) må avklares; ellers mekanisk port + integrasjonstest.

---

## 9. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | Trust-heuristikk (Layer 1+2) er deterministisk, ren, I/O-fri — ingen runtime-LLM | CLAUDE.md: ALDRI runtime-LLM. Layer 3 er build-time skill |
| 2 | Enrichment FØR scoring; scoring re-leser radene etter enrich | Importen nuller `google_website`/`business_status`/`price_level` (`import-pois.ts:170–172`) men bevarer rating/review_count (157–158); uten re-enrich scorer lav-/middels-anmeldte (<50 reviews) `no_website` 0.45 og skjules feilaktig (høyt-anmeldte ≥200 scorer 0.65 og skjules ikke) |
| 3 | Manglende `GOOGLE_PLACES_API_KEY` → `stillNull` (`trust_score = null` = vis), ALDRI degradert score | Stille feilaktig masse-skjuling er verre enn synlig QA-flagg (`validate-report-trust.ts:119–127`) |
| 4 | Offentlige kilde-POIer (NSR/Barnehagefakta/Overpass/Entur/bysykkel) skippes BEVISST — beholder null | Heuristikken er for kommersielle Google-POIer; ville gitt skoler/barnehager 0.45 og skjult dem |
| 5 | `filterTrustedPOIs`: «null = vis, < 0.5 = skjul» | Bakoverkompatibel default; nye boards biter via scoring (`queries.ts:48–53`) |
| 6 *(foto-task, deferred 2026-06-27)* | Foto-API kaster på ≠404, returnerer `[]` kun ved ekte 404 | Forhindrer at API-feil feiltolkes som «ingen foto» og sletter eksisterende `featured_image` (`photo-api.ts:59–61`) |
| 7 *(foto-task, deferred 2026-06-27)* | Foto-proxy bruker positiv host-allowlist, ikke privat-IP-blokklist | Snevrere angrepsflate for et kjent enkelt-verts-behov (`image-proxy:3`) |
| 8 | API-nøkkel i `X-Goog-Api-Key`-header (default); legacy query-nøkkel flagges for migrering | CLAUDE.md: nøkkel i header ALDRI URL. `fetch-place-details.ts:57` bruker query i dag (legacy API) |
| 9 | `ALL_TRUST_FLAGS` er single source of truth for type + valideringssett | Unngår drift mellom flag-liste, type og DB-validering (`poi-trust.ts:19–38`) |
| 10 | `updatePOITier` bevarer hand-crafted editorial (skriver kun ved null) | Tier-reklassifisering skal ikke klobbe kuratert hook/insight (`mutations.ts:673–681`); porten legger til `error`-sjekk på existing-selecten (657) så vernet ikke svelger stille (Unit 6 AC2) |
| 11 | poi-tier-KLASSIFISERINGEN forblir build-time skill-drevet; PRD 4 eier kun skrivekontrakten | Klassifiseringslogikken lever i skill-laget; ingen portbar `lib/`-klassifiserer funnet (verifisert: ingen `updatePOITier`-kaller i repo) |

### Kontroll-runde 2026-06-27

- **`facebook_url` AVKREFTET (§5.1/Unit 2 AC5/§11 Q2 LØST):** Ingen enrichment-fase populerer `pois.facebook_url`. Verifisert: skrives kun manuelt/seed (migration 033) + passthrough-mappinger som videresender eksisterende verdi (`queries.ts:104/264`, `public-queries.ts:272`); lest av board + JSON-LD. Tidligere «uverifisert hvilken fase»-formulering rettet til verifisert dom; Unit 2 dokumenterer i fil-header at enrichment ikke fyller feltet.
- **legacy `key=` BEKREFTET → header-auth-migrering besluttet (§5.4/§4/Unit 2 AC4/§11 Q1 LØST):** `fetch-place-details.ts:57` bruker `key=`-querystring (legacy Places). Header-auth-mønsteret finnes ALLEREDE i `photo-api.ts:48–52` (`X-Goog-Api-Key` + `X-Goog-FieldMask`, Places New). Dom (a): Unit 2 migrerer `fetchPlaceDetails` til Places New header-auth (speil photo-api.ts), lukker CLAUDE.md-regelen for begge kall-stier — `trust-enrichment.ts:91` OG `app/api/places/[placeId]/route.ts:74`. NOTE: feltnavn-skift legacy→Places-New camelCase + FieldMask må oppdateres.

---

## 10. Scope Boundaries

**Denne PRD-en dekker:** Google Places-enrichment (`enrichTrustSignals` + `fetchPlaceDetails`), den deterministiske trust-heuristikken (Layer 1+2: `calculateHeuristicTrust`, `batchValidateTrust`, SSRF-website-sjekk), to-fase trust-pipeline-steget (`validateReportTrust` med load-bearing rekkefølge + `stillNull`), enrich-orkestreringen (`enrichReportPois`, import + Google-enrichment), og poi-tier-SKRIVEKONTRAKTEN (`updatePOITier`/`updatePOITrustScore`) + tier-skill-kontraktnotatet. **DEFERRED 2026-06-27 (egen foto-task senere):** Google-foto-henting (`fetchPhotoNames`/`resolvePhotoUri`/`fetchAndCachePOIPhotos`, Unit 4), foto-proxyen (`image-proxy`, Unit 5), og foto-leddet i `enrichReportPois`.

**Denne PRD-en dekker IKKE** (trekkes via kontrakt-kartet §3):

- **Grounding/Gemini editorial-berikelse** (fact-feed, `editorial_hook`/`local_insight`-GENERERING, søk-grounding) — eies av **PRD 7 (prd-grounding-curation)**. Denne PRD-en rører kun Google-signaler + trust, og `updatePOITier` BEVARER editorial (skriver ikke nytt innhold).
- **Board-rendring av trust-badges / foto-visning** — eies av **PRD 9 (prd-board-skall-ui)**. Denne PRD-en leverer feltene, ikke UI-et.
- **`filterTrustedPOIs`-funksjonens fysiske implementasjon** + query-wrapper-port — lever i **PRD 1** (`@/lib/supabase/queries` port-with-rewrite). Denne PRD-en eier read-time-trust-SEMANTIKKEN (terskel + «null = vis») som kontrakt query-laget respekterer.
- **POI-import (Google discovery, `import-pois.ts`)** — eies av **PRD 3 (prd-provisjon)**. `enrichReportPois` KALLER `importPOIsToProject`, men importen selv (kategori-søk, Entur/bysykkel-discovery) eies oppstrøms.
- **poi-tier-KLASSIFISERINGSLOGIKKEN** (chain-deteksjon, local-gem-heuristikk) — build-time skill (`/validate-poi-trust`), reference-only carry-over. PRD 4 eier kun skrivekontrakten.

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| **Google-foto-henting (Unit 4: `photo-api.ts` + `fetch-poi-photos.ts`)** — `featured_image`/`gallery_images`/`photo_reference`/`photo_resolved_at` | **Egen foto-task (senere — eier-beslutning 2026-06-27).** Spec fullt bevart i Unit 4. Til da: POIer rendres med kategorifarge/pin (no-photo-fallback i PRD 5/9). |
| **Foto-proxy (Unit 5: `image-proxy/route.ts`)** | **Egen foto-task (senere — eier-beslutning 2026-06-27).** Spec bevart i Unit 5; henger på Unit 4. |
| Foto-leddet i `enrichReportPois` (`fetchAndCachePOIPhotos`-kallet) | Wires inn med foto-task (Unit 4); Unit 7 porteres uten det nå |
| Editorial-fact-feed + `editorial_hook`/`local_insight`-generering (grounding) | **PRD 7 (prd-grounding-curation)** |
| Trust-badge-/foto-VISNING på boardet | **PRD 9 (prd-board-skall-ui)** |
| `filterTrustedPOIs`-funksjonens fysiske port (query-wrapper) | **PRD 1 (prd-datamodell-supabase)** — port-with-rewrite av `@/lib/supabase/queries` |
| POI-discovery/import (Google kategori-søk) | **PRD 3 (prd-provisjon)** |
| poi-tier-klassifiserings-skill (Layer 3 + chain/gem) — evt. flytt til portbar `lib/`-modul | **Egen avklaringstask** etter Q3 (§11); default: forblir skill-eid build-time |
| Migrering av trust-enrichment til Places API (New) for full header-auth | Foldes inn i Unit 2 hvis avklart (a); ellers dokumentert avgrensning |

---

## 11. Åpne spørsmål

1. **(LØST — kontroll-runde 2026-06-27)** **API-nøkkel-migrering:** BEKREFTET at `fetch-place-details.ts:57` bruker legacy Places API med `key=`-query-nøkkel. Dom: migrer til Places API (New) header-auth (Unit 2 AC4) ved å speile `photo-api.ts:48–52` (`X-Goog-Api-Key` + `X-Goog-FieldMask`); lukker regelen for begge kall-stier (`trust-enrichment.ts:91`, `app/api/places/[placeId]/route.ts:74`). Påvirker ikke Fase 1; utføres i Fase 2. Berører felt-mapping (legacy `user_ratings_total` → new-format camelCase + FieldMask).
2. **(LØST — kontroll-runde 2026-06-27)** **`facebook_url`-populeringskilde:** AVKREFTET at noen enrichment-fase fyller `pois.facebook_url`. Verifisert dom: INGEN populerende kilde — feltet skrives kun manuelt/seed (migration 033) + passthrough-mappinger som videresender eksisterende verdi (`queries.ts:104/264`, `public-queries.ts:272`); lest av board + JSON-LD. Unit 2 AC5 dokumenterer dette i fil-header; enrichment skal ikke forsøke å fylle feltet.
3. **(ikke-blokkerende for Fase 1–2)** **poi-tier-klassifiserings-eierskap:** Skal chain/local-gem-klassifiseringen forbli skill-eid build-time, eller flyttes til en portbar `lib/poi-tier-classifier.ts`? Default landet: forblir skill-eid (ingen portbar klassifiserer funnet i repo). Påvirker kun Unit 6-kontraktnotatets formulering.
4. **(ikke-blokkerende)** **Foto-proxy-allowlist-bredde:** Kun `mymaps.usercontent.google.com` i dag. Bekreft at ingen andre Google-foto-verter (f.eks. Places New-CDN) trenger proxy — Places New-foto serveres som direkte CDN-URL (`resolvePhotoUri`) og trenger trolig ikke proxy. Default: behold enkelt-vert-allowlist.

---

## 12. Avhengigheter (PRD-graf)

```
        PRD 1 — prd-datamodell-supabase
        (pois google_*/trust_*/poi_tier/featured_image-felt,
         createServerClient, mutations-wrapper, POI-type)
                          │
                          ▼
        ┌──── PRD 4 — prd-trust-google-places (DENNE) ────┐
        │   enrich → (re-les) → score → persister;        │
        │   tier-skrivekontrakt (foto DEFERRED 2026-06-27)│
        └──────────────────┬──────────────────┬───────────┘
                           │                  │
                           ▼                  ▼
                  PRD 3 — provisjon     PRD 5 — board-data-state
                  (orkestrerer          (leser featured_image/
                   enrich+score som      rating/trust_score/poi_tier;
                   pipeline-steg)        respekterer «null = vis»)
```

**Blokkeres av:** PRD 1 (alle felt + klient + mutations-wrapper + `POI`-type).
**Blokkerer:** PRD 3 (provisjon kaller `enrichReportPois`/`validateReportTrust`), PRD 5 (board-data leser berikede/scorede felt).
**Avgrenser mot (eier ikke):** editorial-generering (PRD 7), board-rendring (PRD 9), import-discovery (PRD 3), `filterTrustedPOIs`-funksjonsport (PRD 1).

---

**Fullstendighet:** 7 implementation units spesifisert med avhengigheter + akseptansekriterier (5 aktive: U1–U3, U6, U7; 2 deferred: U4 foto-henting + U5 foto-proxy, eier-beslutning 2026-06-27 — spec fullt bevart for senere foto-task); 8 mål (G1–G8) enumerert i §2 og koblet til ≥1 unit i §7 (G5/G6 deferred sammen med foto); hver unit peker tilbake til ≥1 mål. Alle skjema-påstander forankret i `prod-schema-snapshot.txt` (pois-blokk linje 74–126, eksplisitte linjenr i §5.1) + faktisk kode (`poi-trust.ts:19/73/106/184/262/331`, `fetch-place-details.ts:32/51/57`, `trust-enrichment.ts:58/72/158`, `validate-report-trust.ts:96/114/149/168`, `photo-api.ts:42/59/74`, `fetch-poi-photos.ts:33/62`, `enrich-report-pois.ts:13/32/63/128`, `image-proxy/route.ts:3/19`, `mutations.ts:590/634/657/673–681`, `import-pois.ts:157–158/170–172`, `eslint.config.mjs:11–22`, `app/api/admin/trust-validate/route.ts:32–42`, `queries.ts:49/264`) + manifest (linje 752 image-proxy→PRD4, 770 trust-felt) + INDEX (linje 28). Kontroll-runde 2026-06-27 lukket facebook_url-kilde (ingen populerende kilde — manuelt/seed) og legacy `key=`-nøkkel (header-auth-migrering besluttet); gjenstående uverifisert punkt: tier-klassifiserer-plassering (§11 Q3). Ingen P0/P1/P2-tiers; Fase 1/2/3 etter avhengighet; deferred under Scope Boundaries med PRD-pekere; ingen render-gating spesifisert (patch #2).

---

### Walkthrough-revisjon 2026-06-27

Banket i per-PRD-walkthrough (eier-besluttet). To endringer mot kontroll-runde-baselinen:

- **Foto DEFERRED (eier-beslutning):** «vi trenger ikke foto per nå, det vil vi legge til senere.» Unit 4 (Google-foto-henting), Unit 5 (foto-proxy), G5, G6, foto-leddet i `enrichReportPois` (`fetchAndCachePOIPhotos`-kallet), og foto-felt-skrivingen (`featured_image`/`gallery_images`/`photo_reference`/`photo_resolved_at`) er flyttet til en egen, senere foto-task. **Spec er fullt bevart** (Unit 4/5 intakt) så den kan aktiveres uten re-design. **Trust-kjernen (U1–U3, U6, U7 import/enrichment) er upåvirket** — det er den faktiske verdien i PRD 4. **Ripple → PRD 5/9:** boardet må rendre no-photo-fallback (kategorifarge/pin) til foto lander; flagget i §3 nedstrøms-kontrakt.
- **To-nivå-modell (jf. PRD 2 + `00-INDEX` note #8):** stale «nivå 1/2/3 likt» (§3) → «nivå 1/2 likt». Trust-/poi_tier-/google_*-felt leses likt på begge nivåer; ingen tier-forking, ingen render-gating (uendret).

Uendret fra kontroll-runden: enrich→re-les→score-rekkefølgen (load-bearing), `stillNull`-kontrakt, Mapbox-uavhengig, header-auth-migrering (Unit 2 AC4), facebook_url = manuell/seed, tier-klassifisering skill-eid (§11 Q3 åpen serielt).
