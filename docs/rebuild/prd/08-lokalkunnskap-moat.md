# PRD 8 — Lokalkunnskap-DB (Placy-eid IP-moat)

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling.
> **Lag (byggrekkefølge, fra 00-INDEX linje 32):** Lag 3 (board-flate-laget; kurerings-/arve-SYSTEMET hviler på PRD 1 + 2 + 7). NB: «Lag» = topologisk byggrekkefølge-akse, IKKE `reportTier`-capability-aksen (1/2) — de holdes bevisst adskilt («del nedover stacken, diverger oppover i UX»). Lokalkunnskap-arv brukes tyngst på `reportTier` 2 (kuratert), men selve laget gater ALDRI på `reportTier` — gating er body-eller-highlight-tilstedeværelse, fanget av PRD 2-validatoren.
> **PRD-nr:** 8 av 15 (sommer-rebuild 2026)
> **Slug:** `prd-lokalkunnskap-moat`
> **Kontekst:** Lag-3-PRD. Eier det Placy-eide IP-moat-SYSTEMET: kuraterings-/arve-pipelinen bygget mot `place_knowledge` + `areas.report_editorial`. Det gamle `place_knowledge`-systemet (`@/app/admin/knowledge` + 19-topic-backfill) er DØDT — denne PRD-en bygger nytt mot dagens skjema. Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md` (moat-blokk linje 104–118 + 644 + 699–701 + 734–736 + 756–757 + 768), `docs/rebuild/prod-schema-snapshot.txt` (`place_knowledge` linje 59–73, `areas` linje 4–20), `docs/rebuild/prd/00-INDEX.md` (linje 32 deps 01/02/07, linje 81 story-text-linker eies av PRD 7, linje 83 system-vs-skjema-skillet), og faktisk moat-kode (`lib/pipeline/inherit-area-editorial.ts`, `find-area-for-point.ts`, `area-staging.ts`, `scripts/curate-area.ts`, `extract-skolekrets-boundary.py`, `lib/public-queries.ts`).

---

## 1. Produktvisjon / Formål

Google vet hvor en kafé ligger. Google vet ikke at strøket har den beste morgensolen i byen, at skolen har et eget musikktilbud, eller at turstien bak boligfeltet er familievennlig hele året. **Lokalkunnskap-DB-en er Placy-eid IP**: lokale innsikter «ikke på Google», eid av Placy — ikke av kunden, megleren eller utbyggeren (PRD 1 §13 punkt 2; manifest linje 768). Det er moaten som gjør at en konkurrent ikke bare kan kopiere et kart.

Denne PRD-en eier **kuraterings-/arve-SYSTEMET** rundt to dataformer PRD 1 leverer skjemaet for:

1. **`areas.report_editorial`** (jsonb per skolekrets-polygon): kuratert nabolags-editorial per tema, arvet ned på board-er som ligger innenfor polygonet. Dette er **nivå-2-substansen** — kuratert prosa + highlight-POIer som hever et board fra «prikker på kart» til «fortellingen om stedet».
2. **`place_knowledge`** (15 kol): per-POI og per-area strukturerte fakta med tillit/kilde/visnings-flagg — lese-stien som eksponerer moat-IP-en kontrollert.

Tre strukturelle grep skiller rebuild-moaten fra den gamle:

- **NYTT kurator-system, ikke port av det døde.** Det forrige `place_knowledge`-systemet (`@/app/admin/knowledge` 19-topic-UI + `scripts/backfill-knowledge.ts`) er FORLATT (Feb 2026) og slettes (manifest linje 699–701; INDEX linje 83). Det LEVENDE systemet er arve-pipelinen (`inherit-area-editorial` + `find-area-for-point` + `area-staging` + `curate-area`) — den bæres over og hardnes. Kurator-KONSEPTET (en flate for å fylle moat-data) er moat-relevant; den gamle KODEN er det ikke.
- **Arv via render-kodestien, aldri replikerte filtre.** Highlight-fallback (R9) beregner board-settet via SAMME `getProductFromSupabase` → `transformToReportData` som rendering (`inherit-area-editorial.ts:9, 165–184`) — aldri en parallell filter-kopi som kan drifte fra hva board-et faktisk viser.
- **THEME_ID som single source of truth (TS→Python).** Den hardkodede Python-tema-lista i `extract-skolekrets-boundary.py:36–43` er den ENESTE drift-flaten som brekker editorial-arv STILLE. Denne PRD-en eier kodegen-verktøyet (TS→Python) som lukker den (PRD 2 §10/Beslutning 13/linje 248 ga kodegen hit).

**Hvem konsumerer dette:** PRD 3 (provisjon) KALLER `inheritAreaEditorial` som Steg 7 (eier det ikke); PRD 9 (board-skall) rendrer arvet editorial/lokalkunnskap; PRD 15-prov (nivå-2-kuratering) bygger den menneskelige kurerings-arbeidsflyt-OVERFLATEN på toppen av kjernen denne PRD-en leverer. Denne PRD-en EIER arve-/kurerings-systemet + lese-stien; den eier IKKE skjemaet (PRD 1), taksonomien (PRD 2), story-text-linkeren (PRD 7) eller board-rendringen (PRD 9).

---

## 2. Mål (Goals)

Hvert mål kobler til minst én konkret requirement/unit i §7 (pekerne `(→ Gx)` i unitene refererer hit).

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | Port punkt→polygon-oppslaget (`find-area-for-point`) som ren, fail-soft modul: ingen treff/ugyldig boundary → nivå-1-fallback (R2). | `find-area-for-point`-port (Unit 1). |
| **G2** | Port Zod-staging-kontrakten (`area-staging`) verbatim: boundary-validering, tema bundet til taksonomi (PRD 2), heterogene POI-IDer ALDRI UUID-regex. | `area-staging`-port + THEME_IDS-kobling (Unit 2). |
| **G3** | Port arve-kjernen (`inherit-area-editorial`) med atomisk read-modify-write + optimistisk lås på `products.config` og R9-klassifisering — semantikk uendret. | `inherit-area-editorial`-port (Unit 3). |
| **G4** | Ekstraher kurator-kjerne-logikken (staging→`areas`) til en testbar `lib/pipeline`-modul som BÅDE `curate-area`-scriptet OG fremtidig PRD 15-overflate kan dele. | `apply-area-staging`-ekstraksjon + `curate-area`-rewire (Unit 4). |
| **G5** | Lever TS→Python THEME_IDS-kodegen + drift-vakt-test som lukker den stille arve-bristen. | THEME_IDS-kodegen + CI-assert (Unit 5). |
| **G6** | Port lese-stien (`getPlaceKnowledge`/`getCuratedPOIs`/`getHighlightPOIs`/`getAreaKnowledge`) med trust-gate + `display_ready`-gate og ikke-stille feilhåndtering. | Lese-sti-port (Unit 6). |
| **G7** | Bekreft og bevar eksisterende kvalitets-editorial (verifisert kilde-audit, ikke antatt «Sem & Johnsen»-blokk): `pois.editorial_hook`/`local_insight`/`bridge_text` + `products.config`-bridgetext bevares PASSIVT av PRD 1s baseline-datavern; `place_knowledge`-rader (seed `039`) bevares av PRD 1; AKTIVT arbeid (om noe) = seede `areas.report_editorial`-staging for Trondheim-strøkene. Slett det døde gamle `place_knowledge`-systemet. | Kilde-audit + data-bevaring + dead-code-sletting (Unit 7). |

---

## 3. Arkitektur-/migrasjons-kontekst + nedstrøms-kontrakt-kart

I mantraet **«del nedover stacken, diverger oppover i UX»** sitter denne PRD-en på **board-flate-laget over baseline + taksonomi + grounding**: lokalkunnskap-arv er build-time/script-felt som skrives inn i `products.config.reportConfig.themes[].editorial` (via arv) og `areas.report_editorial` (via kuratering), lest identisk av alle nivåer. Det finnes INGEN tier-forking — `editorial` er et DELT felt. Nivå 2 bruker det tyngst (kuratert editorial ER nivå-2-kravet), men **selve laget gater ALDRI på `reportTier`** (verifisert: ingen `reportTier`-ref i `BoardMap3D`/`ReportReelsPage`, jf. INDEX note #4 (linje 91)). Gating-kontrakten i arve-koden er **body ELLER ≥1 overlevende highlight** (`inherit-area-editorial.ts:306–314`) — IKKE en tier-bryter. Tier-kravet på editorial fanges av PRD 2-VALIDATOREN.

**Migrasjons-kontekst:** Denne PRD-en innfører INGEN ny migrasjon. Den skriver til `areas.report_editorial` (jsonb, nullable — snapshot linje 20) og `products.config` (jsonb NOT NULL) som PRD 1 leverer, og leser `place_knowledge` (15 kol — snapshot linje 59–73). **v2-schema-banking (INDEX note #7, walkthrough-revisjon 2026-06-27):** PRD 1 oppretter hele skjemaet ferskt i et nytt `v2`-Postgres-schema (ikke in-place i `public`). ALLE Supabase-targets i denne PRD-en — `areas`, `place_knowledge`, `products`, `pois`, `project_pois` — peker derfor til `v2.*`: typed `supabase-js`-kall bruker `.schema('v2')`, og rå REST setter `Accept-Profile: v2` (les) / `Content-Profile: v2` (skriv). `prod-schema-snapshot.txt`-linjenumrene beskriver KOLONNE-FORMEN (kolonne-referanse), men de faktiske kallene går mot `v2`, ikke mot live `public`-prod. Referanse-boardene (inkl. Ranheim) re-provisjoneres inn i `v2` via PRD 3 (ikke migreres) — Fase-3-verifisering måles derfor mot et re-provisjonert `v2`-Ranheim-board. **KRITISK skjema-faktum:** `areas`-tabellen har INGEN `updated_at`-kolonne (verifisert snapshot linje 4–20; dokumentert `curate-area.ts:25–32`) — derfor er optimistisk lås på `areas`-skriving IKKE mulig, mens arve-skrivingen mot `products.config` (som HAR `updated_at`) bruker optimistisk lås. Denne asymmetrien er bevisst (se §5.4 + Beslutning 4).

> **Scope-avgrensning — area-editorial-arv er bolig-profil-skopet (load-bearing):** `area-staging.ts:21` deriverer `VALID_THEME_IDS` fra `REPORT_THEME_DEFAULTS` (de 6 bolig-temaene), IKKE fra `getThemeDefaults(profile)`. `inherit-area-editorial.ts:273` HOPPER STILLE over et hvilket som helst tema som ikke finnes i prosjektets config-temaer (kun warning). Konsekvens: et `naering`-board (som bruker `NAERING_THEME_DEFAULTS` — 5 temaer: mat-drikke/transport/trening-aktivitet/hverdagstjenester/nabolaget, `report-defaults.ts:97, 143–144`) kan IKKE arve moat-editorial for `hverdagstjenester`/`nabolaget`, og en kurator kan ikke stage editorial for `naering`-temaer (staging avviser dem som «ukjent tema»). Python-uttrekkeren bruker også de 6 bolig-temaene (`extract-skolekrets-boundary.py:36–43`). **Dette er en bevisst, dokumentert grense i denne PRD-en: area-editorial-arv + THEME_IDS-kodegen er skopet til `bolig`-tema-profilen. `naering`-profil-area-editorial er IKKE dekket** (se Deferred-tabellen). Den stille skip-en (`inherit:273`) er dermed en STATERT kontrakt — staging av et `naering`-tema er en dokumentert no-op her, ikke en latent overraskelse.

> **LLM-/innholds-kontekst (CLAUDE.md-regel):** Lokalkunnskap-INNHOLDET kurateres build-time/manuelt (staging-filer i `data/areas/*.staging.json`), ALDRI runtime-generert. Nabolags-editorial skrives i PRESENS — «hva som ER der», ikke byggeår/historikk (memory `feedback_editorial_no_years_history`) — et innholdskrav på `fact_text`/`body`, ikke en kode-regel. Ingen unit i denne PRD-en innfører runtime-LLM-kall.

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument-PRD | Hva den konsumerer | Kontraktsfelt PRD 8 MÅ levere |
|---------------|--------------------|-------------------------------|
| PRD 3 — provisjon | `inheritAreaEditorial(options)` som Steg 7 (etter hydrering, før revalidering) | `inheritAreaEditorial` + `InheritAreaEditorialResult`; fail-soft for warnings, KASTER ved skrive-/lås-feil (manifest-kontrakt; `03-prd:57, 188`) |
| PRD 9 — board-skall-UI | Arvet `editorial` (body/highlightPoiIds/image) + evt. lokalkunnskap for board-rendring | `ReportThemeEditorial`-formen skrevet på temaer; lese-sti-funksjonene hvis board skal eksponere `place_knowledge` (deferred-avklaring, se Åpne spørsmål #4) |
| PRD 15-prov — nivå-2-kuratering | Kurator-kjernen (`apply-area-staging`) som den menneskelige arbeidsflyt-overflaten bygger på | Ren, testbar `lib/pipeline`-modul (staging→`areas` read-modify-write) som overflaten kan dele uten å shelle ut til script |

### Avgrensning mot tilstøtende PRD-er

- **`place_knowledge`/`areas`-SKJEMAET** (15 kol + areas-hierarki, XOR `poi_id`/`area_id`, `id TEXT gen_random_uuid()::TEXT`) eies av **PRD 1**. Denne PRD-en skriver/leser mot det, definerer det ikke.
- **Tema-taksonomien** (`REPORT_THEME_DEFAULTS`, `VALID_THEME_IDS`, kanonisk `THEME_IDS`-eksport) eies av **PRD 2**. `area-staging.ts:21` deriverer ALLEREDE `VALID_THEME_IDS` fra `REPORT_THEME_DEFAULTS` — denne PRD-en konsumerer taksonomien, definerer den ikke.
- **Story-text-linkeren** (`linkPoisInMarkdown`-markdown-adapter via felles matcher i `lib/curation/poi-matcher.ts`) eies av **PRD 7** (INDEX linje 81; `07-prd:61, 181, 188`). **STATUS: IKKE konsumert i dag — FREMTIDIG/valgfri integrasjon, ikke en aktiv kontrakt.** Verifisert (grep `lib/pipeline/`, `scripts/curate-area.ts`, `lib/public-queries.ts`): INGEN moat-fil importerer/kaller linkeren. Arve-koden skriver `ReportThemeEditorial.body` som ren tekst (`inherit:316–320`), uten lenke-pass. HVIS inline POI-linking av arvet editorial ønskes senere, VILLE PRD 8 konsumert PRD 7s markdown-adapter — men ingen moat-kode gjør det nå. Se Åpne spørsmål #5 + Deferred-tabellen.
- **Trust-heuristikken** (`trust_score`-verdiene) eies av **PRD 4**. `MIN_TRUST_SCORE = 0.5` (`lib/utils/poi-trust.ts:73`) er den delte konstanten både R9-klassifisering (`inherit-area-editorial.ts:129`) og lese-stiens trust-gate bruker; moat-systemet LESER scores, definerer dem ikke.

---

## 4. Eksisterende kodebase

### Bæres over (keeper-core / port-with-rewrite)

| Fil (@/-sti) | Verdict | Rolle (verifisert) |
|--------------|---------|--------------------|
| `@/lib/pipeline/inherit-area-editorial.ts` | keeper-core (MOAT-KJERNE) | Arve-steget: `findAreaForPoint` → board-sett via render-kodestien (`getProductFromSupabase`+`transformToReportData`, dynamisk import `:165–171`) → per-tema highlight-fallback med R9-klassifisering (`:101–138`) → ATOMISK read-modify-write mot `products.config` med `updated_at`-optimistisk lås (`:200–229, 358–396`). `MAX_HIGHLIGHTS=3` (`:45`); gating body-eller-highlight (`:306–314`); fail-soft UNNTATT skrive-/lås-feil (`:34–36`). EID HER; KALLES av PRD 3 Steg 7. |
| `@/lib/pipeline/find-area-for-point.ts` | keeper-core | Punkt→skolekrets-polygon-oppslag mot `areas` (kun rader med boundary OG report_editorial: `.not("boundary","is",null).not("report_editorial","is",null)` `:89–92`). `pointInGeometry(lng,lat,…)` per rad (GeoJSON [lng,lat] `:125`). Multi-treff → første + warning (`:134–142`). Fail-soft: feil/ugyldig boundary → `area:null` → nivå-1-fallback. `(supabase.from as any)("areas")`-cast fordi `areas` ikke er i genererte Database-typer (`:84–89`). |
| `@/lib/pipeline/area-staging.ts` | keeper-core | Zod-staging-kontrakt: `BoundarySchema` discriminatedUnion(Polygon,MultiPolygon) lukkede ringer WGS84 (`:75`); `ThemeEditorialStagingSchema` (body/highlightCandidates/image?, `.strict()` `:84–98`) — GJENBRUKT av `inherit-area-editorial.ts:39`; `ReportEditorialSchema` nøkler bundet til `VALID_THEME_IDS` (`:100–112`); `AreaMetaSchema` INSERT-identitet (`:123`). POI-id ALDRI UUID-regex, kun ikke-tom streng (`:88–95`). `VALID_THEME_IDS = REPORT_THEME_DEFAULTS.map(t=>t.id)` (`:21`). |
| `@/scripts/curate-area.ts` | port-with-rewrite | Kurator-INNGANGEN: last staging-JSON → `areas` (INSERT m/ `meta` `:272–311`, ellers klient-side spread-merge PATCH `:312–338`). Også `--list-pois` UNION over `project_pois`+`pois` (`POI_CHUNK_SIZE=100`, `:355–461`). `import "./load-env"` FØRST (`:38`). REST m/ service-key (`areas` ikke i typed Database). **Kjerne ekstraheres til `apply-area-staging.ts` (Unit 4).** |
| `@/scripts/fetch-area-boundary.ts` | port-with-rewrite | Polygon-kilde-companion: Kartverket kommunegrense (NLOD) → staging-skjelett (areaId, meta, boundary, 6 tomme tema-templates). Kommune-subsett/grunnkrets-dissolve deferret (ingen geometri-lib). Moat-data-innmating. |
| `@/scripts/extract-skolekrets-boundary.py` | port-with-rewrite | Python-uttrekker av skolekrets-polygon (UTM EPSG:25832→WGS84, `:45`). **HARDKODER `THEME_IDS` (`:36–43`) som MÅ matche `REPORT_THEME_DEFAULTS` bolig-profil — drift brekker arv STILLE.** Rebuild: generér Python-lista fra TS `theme-ids.ts` (kodegen bygges HER, Unit 5; PRD 2 linje 190/248). |
| `@/lib/public-queries.ts` | port-with-rewrite (LESE-STI) | Moat-lese-stien: `getPlaceKnowledge`/`getPlaceKnowledgeBatch`/`getAreaKnowledge` (funksjonsdefs `:486, 503, 531`) filtrerer `.eq("display_ready", true)` (filter-linjer `:494, 516, 539`) + `sort_order`; `getHighlightPOIs` (def `:340`, `poi_tier=1` `:351` + trust-gate); `getCuratedPOIs` (area+kategori+bbox + trust-gate `:369`). Trust-gate: `.or("trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}")` (`:352, 386`). `transformPlaceKnowledge` (`:467`); `sourceUrl` via `isSafeUrl`-guard (`:477`); `SLUG_PATTERN`-injeksjonsvakt (`:14–17`). **MERK: dagens konsumenter er legacy public SEO-sider, IKKE rebuild-board (se §5.5 + Åpne spørsmål #4).** |
| `@/lib/utils/geo.ts` | keeper-core (KONSUMERT) | Geometri-utils: `pointInGeometry` (`:125`), `isValidCoordinates` (`:65`), `calculateDistance` (`:20`), `GeoJsonPolygonGeometry` (`:84`). Brukt av `find-area-for-point` + `curate-area`. |
| Eksisterende tester | keeper-core (port m/ modul) | `inherit-area-editorial.test.ts` (R9/atomisk/gating-kontrakt), `find-area-for-point.test.ts` (fail-soft), `area-staging.test.ts` (boundary/editorial/POI-id). Port med hver modul. |

### Slettes / forlates (dead / reference-only)

| Objekt (@/-sti) | Verdict | Begrunnelse |
|-----------------|---------|-------------|
| `@/app/admin/knowledge/knowledge-admin-client.tsx` (297 LOC) | **dead** | Forlatt `place_knowledge`-kurator-UI (19-topic). KONSEPTET (kurator-flate) er moat-relevant; KODEN er død — bygg nytt mot `areas`/`place_knowledge` (manifest linje 701; INDEX linje 83). Slettes (Unit 7). |
| `@/app/admin/knowledge/page.tsx` | **dead** | Server-page for forlatt knowledge-admin; kaller `getAllKnowledgeAdmin`, `ADMIN_ENABLED`-gated. Slettes (Unit 7). |
| `@/app/api/admin/knowledge/route.ts` | **dead** | PATCH-rute som setter `display_ready`/`confidence`. **`PatchSchema` bruker `z.string().uuid()` på row-id — men `place_knowledge.id` er TEXT m/ `gen_random_uuid()::TEXT`-default (ikke garantert UUID for backfill/hash-rader). IKKE arv den strenge sjekken.** Slettes (Unit 7). |
| `@/lib/supabase/queries.ts` → `getAllKnowledgeAdmin` | reference-only → slett m/ admin-UI | Service-role henter ALLE `place_knowledge`-rader (inkl. ikke-display-ready) for det DØDE admin-UI-et (`queries.ts:1606`). Fjernes når admin-UI slettes (Unit 7). |
| `@/scripts/backfill-knowledge.ts` (548 LOC) | reference-only → slett | FORLATT (Feb 2026) `place_knowledge`-seed-system (manifest linje 699). KODEN død. **MEN sha256-dedup-MØNSTERET (`computeHash(poiId,topic,normalisert factText)` `:82–84`, dedup via existing-set `:216–262`, `isSafeUrl` `:87`) er verdt å gjenbruke i nytt system (Unit 4 AC).** Filen selv slettes (Unit 7). |
| `@/lib/types.ts` → `KNOWLEDGE_TOPICS` (20 verdier inkl. legacy `local_knowledge`) | reference-only | 19-topic-systemets taksonomi (`:933–940`). Det nye systemet bruker `REPORT_THEME_DEFAULTS`-temaer for arv; `place_knowledge.topic` beholder sin egen CHECK-constraint (eies av PRD 1). Avklar om `KNOWLEDGE_TOPICS` trimmes med admin-UI-et (Åpne spørsmål #4). |
| `@/scripts/apply-curation-staging.ts` | reference-only (IKKE moat) | Audio-tour-kurering (PATCHer `products.config` audio.manus, PRD 14). Refereres KUN som optimistisk-lås-MØNSTER-presedens av `inherit-area-editorial`-headeren. Ikke eid her. |

---

## 5. Datakontrakt / Skjema

### 5.1 Felt PRD-en KONSUMERER (eies av andre PRD-er)

Alle kolonner verifisert mot `prod-schema-snapshot.txt`. **v2-schema-target (INDEX note #7):** snapshot-linjenumrene under er KOLONNE-REFERANSE (formen), ikke et live-prod-mål — alle tabellene leses/skrives i `v2`-schemaet (`.schema('v2')` for typed-klient; `Accept-Profile: v2`/`Content-Profile: v2` for rå REST).

| Tabell.felt | Type (snapshot) | Eier-PRD | Rolle i moat-systemet |
|-------------|-----------------|----------|------------------------|
| `place_knowledge.*` (15 kol, linje 59–73) | `id` TEXT NO, `poi_id`/`area_id` TEXT YES, `topic`/`fact_text`/`confidence` NO, `structured_data` jsonb, `source_url`/`source_name`, `sort_order`, `display_ready`, `verified_at` | PRD 1 | Lese-stien (Unit 6) leser; `id` er IKKE garantert UUID (`gen_random_uuid()::TEXT`) — backfill-rader bruker sha256-hash |
| `areas.report_editorial` | jsonb YES (linje 20) | PRD 1 | Arve-kilden: `{<theme-id>:{body,highlightCandidates,image?}}` — skrevet av kuratering (Unit 4), lest av arv (Unit 3) |
| `areas.boundary` | jsonb YES (linje 18) | PRD 1 | Skolekrets-polygon for punkt→polygon-oppslag (Unit 1) |
| `areas` identitet/hierarki: `id`,`name_no`,`name_en`,`slug_no`,`slug_en`,`center_lat/lng`,`level`,`parent_id`,`postal_codes` | div (linje 4–19) | PRD 1 | INSERT-identitet ved kuratering (Unit 2/4); `level`(NO) city/bydel/strok-hierarki |
| `areas` MANGLER `updated_at` | — (verifisert fravær linje 4–20) | PRD 1 | **Optimistisk lås på `areas`-skriving IKKE mulig** — kuratering bruker GET→branch klient-merge (§5.4) |
| `products.config` (`reportConfig.themes[].editorial`) | jsonb NOT NULL (PRD 1 baseline) | PRD 1 | Arve-MÅLET: `inheritAreaEditorial` skriver `editorial`-nøkkel per tema med `updated_at`-optimistisk lås |
| `pois.id`, `pois.trust_score` | TEXT / numeric | PRD 1 / PRD 4 | R9-klassifisering (`:117–136`) + lese-sti trust-gate |
| `ReportThemeEditorial` (body/highlightPoiIds/image) | `lib/types.ts:346–356` | PRD 1 | Render-feltnavnet arv SKRIVER (`highlightPoiIds`, IKKE `highlightCandidates` — `inherit:318–320`) |
| `MIN_TRUST_SCORE = 0.5` | `lib/utils/poi-trust.ts:73` | PRD 4 (konstant delt) | R9 `under-trust` + lese-sti trust-gate |
| `REPORT_THEME_DEFAULTS` / `VALID_THEME_IDS` / kanonisk `THEME_IDS` | `report-defaults.ts` / `area-staging.ts:21` / `theme-ids.ts` | PRD 2 | Taksonomi-bindingen staging validerer mot; TS→Python-kodegen-kilden (Unit 5) |
| `linkPoisInMarkdown`-markdown-adapter | `lib/curation/poi-matcher.ts` (PRD 7 Unit 5) | PRD 7 | **IKKE konsumert i dag** — FREMTIDIG/valgfri. Arve-`body` skrives som ren tekst (`inherit:316–320`). Listet her som potensielt fremtidig konsum, ikke utøvd kontrakt (se Åpne spørsmål #5 + Deferred). |

### 5.2 `areas.report_editorial`-formen (arve-kilden — eid av kuratering-laget)

Staging-/lagrings-formen per skolekrets, validert av `ThemeEditorialStagingSchema` (`area-staging.ts:84–98`, `.strict()`):

```
{ "<theme-id>": {
    "body": string,                       // kan være tom i mal; gating ved arv
    "highlightCandidates": string[],      // POI-IDer — HETEROGENE, ikke UUID (4–6 kandidater, MAX_HIGHLIGHTS=3 vises)
    "image"?: string                      // ikke-tom streng hvis satt
} }
```

**Bevisste invarianter (IKKE «fiks» til konsistens):**
- **POI-IDer i `highlightCandidates` valideres KUN som ikke-tomme strenger, ALDRI UUID-regex** (`area-staging.ts:88–95`; manifest linje 117; dok `docs/solutions/ui-bugs/poi-ids-heterogeneous-not-uuid-20260428.md`). POI-IDer er heterogene: `google-ChIJ…`, `bus-…`, `entur-NSR-…`. Den døde admin-rutens `z.string().uuid()` ville feilet for hash-id-rader — IKKE arv den.
- **Tema-nøkler bundet til `VALID_THEME_IDS`** (`area-staging.ts:100–112`): ukjent tema → høylytt feil med temanavnet. `VALID_THEME_IDS` DERIVERES fra `REPORT_THEME_DEFAULTS` (`:21`) — ingen TS-duplikat.
- **Render-feltnavn-skiftet:** arv leser `highlightCandidates` fra `areas.report_editorial`, men SKRIVER `highlightPoiIds` på `ReportThemeEditorial` (`inherit:318–320`). De to navnene er ulike og bevisst — ikke en bug.

**7↔8-editorial-grensen (kryss-PRD-opløsning, tråd c):** `areas.report_editorial` per skolekrets ER «én gang per strøk»-KILDEN for nivå-2-editorial (INDEX note #10, Gemini henter → Fable skriver, én gang per strøk). Arve-steget (`inherit-area-editorial.ts`, Unit 3) **projiserer** denne strøk-editorial-en ned til `products.config.reportConfig.themes[].editorial` som en REN KOPI ved arve-tidspunktet — INGEN LLM-kall i arve-steget (alt innhold er allerede skrevet i `areas.report_editorial` av kurerings-/skrive-laget). Dette er ortogonalt mot PRD 7s grounding-feed: PRD 7 skriver per-board fakta til `products.config.reportConfig.themes[].grounding`, mens PRD 8 skriver editorial til `products.config.reportConfig.themes[].editorial`. `grounding`- og `editorial`-nøklene er ulike JSONB-subnøkler under samme `themes[]`-objekt — ingen skrive-kollisjon mellom de to lagene.

### 5.3 Highlight-fallback + R9-klassifisering (arve-kjernens hjerte)

Per tema i `area.report_editorial` går arv gjennom `highlightCandidates` i kurator-prioritert rekkefølge og beholder de første inntil `MAX_HIGHLIGHTS=3` som finnes i temaets FILTRERTE board-sett (`inherit:281–304`). Droppede kandidater klassifiseres via ETT batch-`pois`-oppslag (`classifyDroppedCandidates:101–138`):

| R9-årsak | Trigger | Kilde |
|----------|---------|-------|
| `ikke-i-db` | POI-id finnes ikke i `pois` | `inherit:128` |
| `under-trust` | `trust_score != null && < MIN_TRUST_SCORE` | `inherit:129` |
| `utenfor-board` | Finnes m/ ok/null trust men overlevde ikke board-filtre (radius/kategori-cap/child-merge/skolekrets) — ELLER ukjent (fail-soft default) | `inherit:131–135` |

**Gating-kontrakt (`inherit:306–314`):** body ELLER ≥1 overlevende highlight bærer nivå-2-editorial. Tomme survivors + body → skriv med tom highlight-liste. Verken body eller survivors → ikke ekte nivå-2-innhold, skip med warning (forblir nivå 1). **Fail-soft-klassifisering:** kan oppslaget ikke gjennomføres → alle `utenfor-board` + warning (`:106–112`), aldri abort.

### 5.4 Atomisk skriving + optimistisk-lås-ASYMMETRI (kritisk)

To skrive-stier med ULIK låse-evne — bevisst, fordi de skriver til ulike tabeller:

| Skrive-sti | Tabell | Optimistisk lås? | Mekanisme |
|------------|--------|------------------|-----------|
| `inheritAreaEditorial` (arv, Steg 7) | `products.config` | **JA** | Beregn ALLE tema-patches FØRST → ÉN read-modify-write, PATCH med `updated_at=eq.{read}` (`inherit:358–360`); 0 rader → KASTER (`:392–396`). jsonb-vs-streng-form bevart (`:235–247`). |
| `curate-area` / `apply-area-staging` (kuratering) | `areas` | **NEI (umulig)** | `areas` MANGLER `updated_at` (snapshot linje 4–20; dok `curate-area.ts:25–32`). GET→branch: INSERT m/ meta (`:272–311`) ELLER klient-side spread-merge PATCH på `id` (`:312–338`). 0-rader-PATCH → `process.exit(1)`. |

**Kontrakt-konsekvens:** `00-INDEX` linje 32 sier «Atomisk read-modify-write + optimistisk lås» for PRD 8 — men det er FAKTISK kun oppfylt for `products.config`-skrivingen (arv). For `areas`-skrivingen (kuratering) er optimistisk lås UMULIG uten skjemaendring. Beslutning 4 lander dette: prototype-stadiet (én-operatør-PoC) GODTAR usynkronisert `areas`-skriving; å legge `updated_at` på `areas` er en PRD-1-skjemaendring som ikke er verdt det nå (race usannsynlig med én kurator). PRD 3-kontrakten («kaster ved skrive-/lås-feil», `03-prd:57, 188`) gjelder `products`-skrivingen i Steg 7, IKKE `curate-area`-skrivingen.

### 5.5 Lese-stien — konsument-realitet (load-bearing avklaring)

`getPlaceKnowledge`/`getAreaKnowledge`/`getCuratedPOIs`/`getHighlightPOIs` (`public-queries.ts`) konsumeres I DAG KUN av legacy public SEO-sider (`app/(public)/[area]/*`) — scroll-artikkel-stacken som dropps (PRD 1 LEGACY-liste). **Rebuild-board (`BoardMap3D`) leser IKKE `place_knowledge` direkte i dag.** Lese-funksjonene må eies et sted (de er moat-IP-lese-stien), men hvorvidt rebuild-board skal eksponere lokalkunnskap er board-rendring (deferred til PRD 9). Denne PRD-en PORTER lese-stien (bevarer trust-gate + `display_ready`-gate + injeksjonsvakter) så IP-en ikke mistes; den faktiske board-koblingen avklares ved PRD 9-behov (Åpne spørsmål #4). **Feilhåndterings-merknad:** dagens lese-sti returnerer `return []` ved `error || !data` (`public-queries.ts:356, 122` osv.) — stille swallow. Per CLAUDE.md + PRD 1 Unit 6-presedens skal porten legge til MINST logging av error (ikke arve stille swallow uendret).

### 5.6 Sikkerhets-/integritetskontrakten (arkitekturregler håndhevet)

| Kontrakt | Kilde | Akseptansekriterium |
|----------|-------|---------------------|
| Service-key i header (apikey/Authorization), ALDRI URL | `curate-area.ts` `restHeaders()`, `inherit:195–198` | Verifisert korrekt; bevar |
| Eksplisitt error-håndtering på alle Supabase-kall; fail-soft m/ logging, KAST ved skrive-/lås-feil | `find-area:94–99`, `inherit:34–36, 378–396` | Ingen stille `return []` uten logging |
| `@/`-prefix i lib/app; relative i scripts | `area-staging:19`, `inherit:38–41`; `curate-area:38–45` script-relative | Bevar mønster per fil-type |
| ALDRI runtime-LLM; innhold build-time/manuelt | staging-filer | Ingen unit innfører runtime-generering |
| ALDRI `@supabase/supabase-js` direkte fra klient; server/script-only | `find-area` bruker `createServerClient`; `curate-area`/`inherit` rå REST m/ service-key | Nytt PRD-15-UI (deferred) MÅ gå via server actions |
| `sourceUrl` via `isSafeUrl`-guard; slug-injeksjonsvakt | `public-queries.ts:477, 14–17` | Bevar i lese-sti-port |

---

## 6. Scope Boundaries

**Denne PRD-en dekker:** punkt→polygon-oppslag (`find-area-for-point`), Zod-staging-kontrakten (`area-staging` + THEME_IDS-binding), arve-kjernen (`inherit-area-editorial` med R9 + atomisk lås), kurator-kjerne-ekstraksjon (`apply-area-staging` delt mellom script + PRD-15-overflate), TS→Python THEME_IDS-kodegen + drift-vakt, lese-stien (`getPlaceKnowledge`/`getCuratedPOIs`/`getHighlightPOIs`/`getAreaKnowledge`), Sem & Johnsen-data-bevaring inn i nytt system, og sletting av det døde gamle `place_knowledge`-systemet.

> **Tenancy-modell (walkthrough-beslutning 2026-06-27, eier):** Moaten er ÉN standardisert, **Placy-validert** kunnskaps-kanon per nærområde — ikke per kunde/megler/kjede. Meglere BIDRAR additivt (flere POIer + innsikter oppå den delte kanonen), de får IKKE en egen forket tekst-layer. **Per-kjede/per-megler egne editorial-LAG** (f.eks. en meglerkjede som vil ha helt egen nabolagstekst som overstyrer Placy-kanonen) er bevisst IKKE bygget nå — håndteres som egen oppfølging HVIS et reelt krav dukker opp (verner mot spekulativt fler-tenant-lag-system). Se Deferred-tabellen.

**Denne PRD-en dekker IKKE:**

- **`place_knowledge`/`areas`-SKJEMA-definisjonen** (kolonner, constraints, XOR, FK) — eies av **PRD 1**.
- **Tema-taksonomien** (`REPORT_THEME_DEFAULTS`, kanonisk `THEME_IDS`-KONSTANTEN) — eies av **PRD 2**. Denne PRD-en eier kun KODEGEN-VERKTØYET som konsumerer konstanten.
- **Story-text-linker-IMPLEMENTASJONEN** (felles matcher + adaptere) — eies av **PRD 7**. **IKKE konsumert i dag** — arve-`body` skrives som ren tekst (`inherit:316–320`); inline POI-linking av arvet editorial er FREMTIDIG/valgfri (Åpne spørsmål #5, Deferred-tabell).
- **Board-rendring av lokalkunnskap/editorial** (badges, editorial-prosa-visning, highlight-pins i UI) — eies av **PRD 9**.
- **Trust-scoring-heuristikken** — eies av **PRD 4**.

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| Board-rendring av lokalkunnskap-badges/editorial-prosa + om rebuild-board eksponerer `place_knowledge` (lese-sti-board-kobling) | **PRD 9 (prd-board-skall-ui)** |
| Nivå-2 menneskelig kurerings-UI-OVERFLATE (godkjenning, QA, redaksjonell arbeidsflyt over kjernen) | **PRD 15 (prd-nivaa-2-kuratering, prov)** — bygger på `apply-area-staging`-kjernen denne PRD-en leverer |
| Story-text-linker-IMPLEMENTASJON (felles matcher + markdown/segment-adaptere) | **PRD 7 (prd-grounding-curation)** |
| Inline POI-linking av ARVET editorial-`body` (kjøre arve-`body` gjennom PRD 7s markdown-adapter før skriving) — IKKE bygget i denne PRD-en; arve-`body` er ren tekst i dag | **Egen oppfølging når/hvis inline-linking av arvet editorial besluttes** (kobler PRD 8s arve-flyt mot PRD 7s adapter; se Åpne spørsmål #5) |
| `place_knowledge`/`areas.report_editorial`-SKJEMA + areas-hierarki + `areas.updated_at`-vurdering | **PRD 1 (prd-datamodell-supabase)** |
| `naering`-profil area-editorial-arv + THEME_IDS-kodegen (denne PRD-en skoper begge til `bolig`-profilen; `inherit:273` skipper `naering`-temaer stille som dokumentert no-op) | **Egen oppfølging når næring-board krever moat-editorial** (krever profil-bevisst `VALID_THEME_IDS` via `getThemeDefaults(profile)` + profil-bevisst Python-kodegen) |
| Per-kjede/per-megler egne editorial-LAG (fler-tenant override-tekst over Placy-kanonen, f.eks. en meglerkjede med helt egen nabolagstekst) — moaten er ÉN standardisert Placy-validert kanon nå; meglere bidrar kun additivt (§6 tenancy-note). **Informert design (forretningsutvikling 2026-06-28, «Meglers tanker»):** når dette bygges, splitt presentasjons-laget (attributert — megler-brand, kun deres listinger) fra kunnskaps-laget (de-attributert — nuggets ekstrahert til Placy-kanonen). Da er det IKKE et generisk fler-tenant-lag; kanonen forblir Placys. | **Egen oppfølging HVIS et reelt kjede-/megler-krav dukker opp** (walkthrough-beslutning 2026-06-27; informert av moat-1-rapport 2026-06-28 — ikke bygg spekulativt, men designet er nå kjent, se Moat-perspektiv-seksjonen) |
| Kommune-subsett/grunnkrets-dissolve (geometri-lib for `fetch-area-boundary`) | Egen oppfølging når geometri-lib innføres (manifest: ingen geometri-lib i repo i dag) |
| `place_knowledge.topic` CHECK-constraint + om `KNOWLEDGE_TOPICS` (20-verdi legacy) trimmes | **PRD 1** (skjema) + denne PRD-ens Unit 7 (kode-rydding ved sletting) |

**Eksplisitt ikke-scope (patch #2):** render-/tier-gating på `reportTier`. Laget gater IKKE på nivå (verifisert: ingen ref i `BoardMap3D`/`ReportReelsPage`). Gating er body-eller-highlight-tilstedeværelse; tier-krav fanges av PRD 2-validatoren. **Ingen unit bygger tier-gating.**

---

## 7. Implementation Units (7 av maks 8)

### Unit 1 — `find-area-for-point`-port (punkt→polygon, fail-soft)
- **Mål (→ G1):** Port punkt→skolekrets-polygon-oppslaget som ren, fail-soft modul.
- **Filer:** `@/lib/pipeline/find-area-for-point.ts`, `@/lib/pipeline/find-area-for-point.test.ts` (port).
- **Akseptansekriterier:**
  1. `findAreaForPoint({lat,lng})` returnerer `{area, warnings}`; query treffer `v2.areas` (`.schema('v2')` på typed-klient, ELLER `Accept-Profile: v2` ved rå REST — INDEX note #7) og filtrerer KUN kuraterte rader (`.not("boundary","is",null).not("report_editorial","is",null)` `:89–92`).
  2. `pointInGeometry(lng,lat,boundary)` (GeoJSON [lng,lat]-rekkefølge `:125`) per rad; `isValidCoordinates`-vakt før oppslag (`:68`).
  3. Fail-soft: Supabase-feil ELLER ugyldig boundary-geometri → `area:null` + warning, ALDRI exception (kalleren faller til nivå 1, R2). UNNTAK: `createServerClient()` null → kaster «Supabase ikke konfigurert» (`:76–77`).
  4. Multi-treff → bruk første + warning med alle treff-IDer (`:134–142`).
  5. `(supabase.from as any)("areas")`-cast bevares MED kommentar (`areas` ikke i genererte Database-typer) ELLER fjernes hvis PRD 1 re-typer `areas` inn i `Database` (avklar mot PRD 1-leveranse; ikke fjern blindt).
  6. Eksplisitt `{data,error}`-håndtering; ingen stille return uten warning. `npx tsc --noEmit` + porterte tester grønne.
- **Avhengigheter:** PRD 1 (`areas`-skjema + re-typede klienter), `@/lib/utils/geo` (`pointInGeometry`/`isValidCoordinates`).

### Unit 2 — `area-staging`-port (Zod-kontrakt + THEME_IDS-binding)
- **Mål (→ G2):** Port Zod-staging-kontrakten verbatim; tema bundet til PRD 2-taksonomi; heterogene POI-IDer ALDRI UUID.
- **Filer:** `@/lib/pipeline/area-staging.ts`, `@/lib/pipeline/area-staging.test.ts` (port).
- **Akseptansekriterier:**
  1. `BoundarySchema` discriminatedUnion(Polygon,MultiPolygon) med lukkede ringer (første==siste `:49–59`), WGS84-range-sjekk på posisjon (`:30–44`), min 4 punkter/ring (`:47`).
  2. `ThemeEditorialStagingSchema` (`.strict()`, body/highlightCandidates/image? `:84–98`) — eksportert og GJENBRUKT av `inherit-area-editorial.ts:39` (verifiser import-kjeden intakt etter port).
  3. **POI-id valideres KUN som `z.string().min(1)`, ALDRI UUID-regex** (`:88–95`) — golden-test bekrefter at `google-ChIJ…`/`bus-…`/`entur-NSR-…` aksepteres.
  4. `VALID_THEME_IDS = REPORT_THEME_DEFAULTS.map(t=>t.id)` (`:21`) — derivert fra PRD 2-taksonomi (de 6 BOLIG-temaene), IKKE hardkodet duplikat; ukjent tema-nøkkel → høylytt feil med temanavnet (`:100–112`).
  4b. **Bolig-profil-grense (bevisst):** `VALID_THEME_IDS` deriveres fra `REPORT_THEME_DEFAULTS` (bolig), IKKE `getThemeDefaults(profile)`. Staging av et `naering`-only tema (`hverdagstjenester`/`nabolaget` fra `NAERING_THEME_DEFAULTS`, `report-defaults.ts:97`) avvises som «ukjent tema» — dette er en DOKUMENTERT no-op for denne PRD-en (se §3 + Deferred), ikke en bug. En test bekrefter at `hverdagstjenester` avvises av staging i bolig-skopet.
  5. `AreaMetaSchema` (INSERT-identitet, `.strict()` `:123–142`) + `parseAreaStaging` returnerer typed resultat eller `sti: melding`-feil-strenger (aldri exception for valideringsfeil `:172–182`).
  6. Porterte tester grønne.
- **Avhengigheter:** PRD 2 (`REPORT_THEME_DEFAULTS`).

### Unit 3 — `inherit-area-editorial`-port (arve-kjerne, semantikk uendret)
- **Mål (→ G3):** Port arve-kjernen med R9 + atomisk read-modify-write + optimistisk lås UENDRET.
- **Filer:** `@/lib/pipeline/inherit-area-editorial.ts`, `@/lib/pipeline/inherit-area-editorial.test.ts` (port).
- **Akseptansekriterier:**
  1. Flyt bevart: `findAreaForPoint` (Unit 1) → board-sett via render-kodestien (dynamisk `await import("@/lib/supabase/queries")` + `@/components/.../report-data` `:165–171`, IKKE statisk import — drar anon-klient/`use client`-kjede; underliggende `getProductFromSupabase`-lesing treffer `v2`-schemaet, INDEX note #7) → per-tema highlight-fallback → ATOMISK skriving.
  2. R9-klassifisering via ETT batch-`pois`-oppslag (`:117–122`); `ikke-i-db`/`under-trust` (`< MIN_TRUST_SCORE`)/`utenfor-board`-fallback (`:128–135`); fail-soft → alle `utenfor-board` + warning (`:106–112`).
  3. Gating: body ELLER ≥1 overlevende highlight (`:306–314`); `MAX_HIGHLIGHTS=3` visningstak (`:45`); skriver `highlightPoiIds` (IKKE `highlightCandidates`) på `ReportThemeEditorial` (`:318–320`).
  4. Atomisk: alle tema-patches beregnes FØRST → ÉN read-modify-write mot `v2.products.config` (GET + PATCH med `Accept-Profile: v2`/`Content-Profile: v2` på rå REST, ELLER `.schema('v2')` på typed-klient — INDEX note #7); PATCH med `updated_at=eq.{read}` optimistisk lås (`:358–360`); 0 rader → KASTER (`:392–396`). jsonb-vs-streng-form detektert og bevart (`:235–247`); korrupt JSON-streng → KASTER (`:240–244`).
  5. **Fail-soft for warnings, KASTER ved skrive-/optimistisk-lås-feil + korrupt config** (`:34–36, 378–396`) — kontrakten PRD 3 Steg 7 er avhengig av (`03-prd:57, 188`). GET-timeout/!ok er fail-soft skip (`:205–221`), kun PATCH/lås kaster.
  6. `import "./load-env"`-kravet dokumentert for script-kontekst (anon-klient null ellers `:29–32`); porterte tester (R9/atomisk/gating) grønne.
  7. **Eksportert kontrakt (PRD 3 Steg 7 type-verifiserer mot dette):** signaturen bevares verbatim slik at PRD 3-provisjonen kan kalle den med kompilerings-garanti — `inheritAreaEditorial(options: { projectId: string; customerSlug: string; projectSlug: string; lat: number; lng: number }): Promise<InheritAreaEditorialResult>` (`inherit:142–148`). `InheritAreaEditorialResult` eksporteres med feltene `{ skipped?: boolean; areaName?: string; themesInherited: string[]; highlights: { kept: number; dropped: DroppedHighlight[] }; warnings: string[] }` (`inherit:69–79`), der `DroppedHighlight = { themeId: string; id: string; reason: HighlightDropReason }` og `HighlightDropReason = "ikke-i-db" | "under-trust" | "utenfor-board"` (`inherit:61–67`). **`customerSlug`-merknad (INDEX note #12):** ved no-customer-board er `customerSlug` den reserverte default-kunden «intern» — provisjonen sender da `customerSlug="intern"` slik at `getProductFromSupabase` (Unit 3 AC1) treffer `intern_<slug>`-prosjektet; arve-flyten håndterer dette transparent (ingen spesial-casing kreves i denne PRD-en).
- **Avhengigheter:** Unit 1 (`findAreaForPoint`), Unit 2 (`ThemeEditorialStagingSchema`), PRD 4 (`MIN_TRUST_SCORE`-konstant), PRD 5 (`transformToReportData` render-kodestien — koordineres), PRD 1 (`ReportThemeEditorial`-type).

### Unit 4 — Kurator-kjerne-ekstraksjon (`apply-area-staging` + `curate-area`-rewire)
- **Mål (→ G4):** Ekstraher staging→`areas` read-modify-write til en ren `lib/pipeline`-modul som BÅDE scriptet OG PRD-15-overflaten kan dele.
- **Filer:** `@/lib/pipeline/apply-area-staging.ts` (ny — kjerne), `@/lib/pipeline/apply-area-staging.test.ts` (ny), `@/scripts/curate-area.ts` (rewire til å kalle kjernen).
- **Akseptansekriterier:**
  1. Kjernen tar parset `AreaStaging` (fra Unit 2) + fetch/REST-injeksjon og utfører mot `v2.areas` (rå REST med `Accept-Profile: v2` på GET / `Content-Profile: v2` på INSERT+PATCH — INDEX note #7): GET `areas`-rad → INSERT m/ `meta` hvis fraværende (`curate-area.ts:272–311`) ELLER klient-side spread-merge PATCH (staging overskriver `boundary` + de temaene den har; eksisterende temaer ikke i staging BEHOLDES; `meta` ignoreres ved update `:312–338`).
  2. **Ingen optimistisk lås (dokumentert):** `areas` mangler `updated_at` (`:25–32`); 0-rader-PATCH → tydelig feil (script: `process.exit(1)`; kjerne: kast/returnert feilresultat slik at PRD-15-overflate kan håndtere uten å exit-e prosessen).
  3. `curate-area.ts` beholder CLI-skall (`--file`/`--dry-run`/`--yes`/`--list-pois`/`--theme`/`--area`) + `import "./load-env"` FØRST (`:38`), men delegerer write-logikken til `apply-area-staging`-kjernen. `--list-pois` UNION over `v2.project_pois`+`v2.pois` (`Accept-Profile: v2`, `POI_CHUNK_SIZE=100` `:355–461`) bevart.
  4. Service-key i `restHeaders()` (apikey+Authorization Bearer), ALDRI URL; eksplisitt error-håndtering; fail-soft UNNTATT write-feil.
  5. sha256-dedup-MØNSTERET fra `backfill-knowledge.ts:82–84` (computeHash på poiId+topic+normalisert factText) vurderes gjenbrukt hvis kjernen senere skriver `place_knowledge`-rader (dokumenteres som tilgjengelig mønster; ikke påkrevd implementert i denne PRD-en med mindre `place_knowledge`-skriving legges til).
  6. `npx tsc --noEmit` + ny kjerne-test (INSERT-gren + PATCH-merge-gren) grønne.
- **Avhengigheter:** Unit 2 (`parseAreaStaging`/`AreaStaging`), `@/lib/utils/geo` (`calculateDistance` for `--list-pois`).

### Unit 5 — TS→Python THEME_IDS-kodegen + drift-vakt
- **Mål (→ G5):** Lukk den stille arve-bristen: generér Python-tema-lista fra TS `theme-ids.ts` + CI-assert som feiler ved drift.
- **Filer:** `@/scripts/gen-python-theme-ids.ts` (ny — kodegen), `@/scripts/extract-skolekrets-boundary.py` (port; `THEME_IDS` blir generert blokk), `@/scripts/extract-skolekrets-boundary.test.ts` ELLER CI-assert (ny drift-vakt).
- **Akseptansekriterier:**
  1. Kodegen leser kanonisk `THEME_IDS` (`@/lib/themes/theme-ids.ts`, PRD 2 Unit 5 = `REPORT_THEME_DEFAULTS.map(t=>t.id)`) og emitterer Python-konstanten med generert-markør (f.eks. `# GENERERT fra lib/themes/theme-ids.ts — ikke rediger manuelt`).
  2. `extract-skolekrets-boundary.py:36–43` (dagens manuelle `THEME_IDS`-liste: hverdagsliv, barn-oppvekst, mat-drikke, natur-friluftsliv, transport, trening-aktivitet) erstattes av den genererte blokken; uttrekks-logikken (UTM EPSG:25832→WGS84 `:45`, tomme tema-templates) ellers uendret.
  3. **Drift-vakt:** en test/CI-assert feiler hvis Python-`THEME_IDS` divergerer fra TS `THEME_IDS` (kjør kodegen, diff mot fil — non-zero exit ved forskjell). Dette er målet i Åpne spørsmål #3 (drift-vakt-test fremfor løpende build-step for et engangs-data-prep-script).
  4. Verifisert at de 6 genererte IDene matcher `getThemeDefaults("bolig")`-temaene fra PRD 2. **Bolig-profil-grense (bevisst):** kodegen emitterer KUN bolig-tema-profilen — `naering`-profil-Python-tema-liste er IKKE dekket i denne PRD-en (deferred; krever profil-bevisst kodegen). AC asserterer at det er bolig-skopet som genereres.
- **Avhengigheter:** PRD 2 (kanonisk `THEME_IDS`-eksport, `theme-ids.ts`).

### Unit 6 — Lese-sti-port (`place_knowledge` + curated/highlight POIs)
- **Mål (→ G6):** Port moat-lese-stien med trust-gate + `display_ready`-gate + injeksjonsvakter; ingen stille feil-swallow.
- **Filer:** `@/lib/public-queries.ts` (port av moat-lese-funksjonene).
- **Akseptansekriterier:**
  1. `getPlaceKnowledge(poiId)` / `getPlaceKnowledgeBatch` (max 100) / `getAreaKnowledge(areaId)` (funksjonsdefs `:486, 503, 531`) leser `v2.place_knowledge` (`.schema('v2')` på typed-klient, ELLER `Accept-Profile: v2` ved rå REST — INDEX note #7) og filtrerer `.eq("display_ready", true)` (filter-linjer `:494, 516, 539`) + `sort_order`; `transformPlaceKnowledge` (DbPlaceKnowledge→PlaceKnowledge `:467`); `sourceUrl` via `isSafeUrl`-guard (`:477`).
  2. `getHighlightPOIs(areaId)` (`poi_tier=1` `:351`) + `getCuratedPOIs(areaId, opts)` (area+kategori+bbox `:369`) leser `v2.pois` (INDEX note #7) og bruker trust-gate `.or("trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}")` (`:352, 386`) — null ELLER ≥ terskel = vis. `poi_tier` her er POI-klassifiserings-aksen (PRD 4, chain/local-gem), DISTINKT fra board-`reportTier` — bevares som-er.
  3. `SLUG_PATTERN`-injeksjonsvakt bevart (`:14–17`); `place_knowledge.id` behandles som TEXT (IKKE garantert UUID — ingen UUID-regex på lese-id-er).
  4. **Feilhåndtering hardnet:** dagens `return []` ved `error || !data` (`:356, 122` osv.) erstattes med MINST `console.error`/strukturert logging av error FØR fallback-retur — ingen stille swallow (CLAUDE.md; PRD 1 Unit 6-presedens).
  5. **Konsument-gap eksplisitt dokumentert (do-nothing-analyse):** Verifisert via grep at INGEN av lese-funksjonene refereres i `components/`; eneste levende konsumenter i dag er legacy SEO-sider (`app/(public)/[area]/*`, 8 filer) som står på PRD 1s LEGACY-slette-liste. **Spørringsfunksjonene er derfor DØDE-ON-ARRIVAL i rebuilden ved leveranse** — de kompilerer, men eksersises av ingenting i rebuild-board før PRD 9 evt. kobler dem (Åpne spørsmål #4). Porten rettferdiggjøres UTELUKKENDE som moat-IP-grense-bevaring (trust-gate + `display_ready`-gate + injeksjonsvakter må ikke mistes), IKKE som levende funksjonalitet. Denne AC-en finnes for at porten ikke forveksles med en aktiv board-integrasjon (CLAUDE.md «verifiser at features FUNGERER»). De rene transform/guard-hjelperne (`transformPlaceKnowledge`, `isSafeUrl`, `SLUG_PATTERN`) er testbare offline uavhengig av konsument; spørrings-funksjonene porteres så de kompilerer mot re-typede klienter.
  6. `npx tsc --noEmit` + lint grønne; eksplisitt `{data,error}`-håndtering.
- **Avhengigheter:** PRD 1 (`place_knowledge`/`pois`-skjema + `DbPlaceKnowledge` + re-typede klienter), PRD 4 (`MIN_TRUST_SCORE`).

### Unit 7 — Sem & Johnsen-data-bevaring + dead-code-sletting
- **Mål (→ G7):** Bevar eksisterende kvalitets-editorial inn i kurerings-systemets format; slett det døde gamle `place_knowledge`-systemet.
- **Filer:** `@/data/areas/*.staging.json` (data-bevaring), `@/docs/rebuild/moat-data-migration.md` (kartleggings-/migrerings-notat), slett: `@/app/admin/knowledge/{page,knowledge-admin-client}.tsx`, `@/app/api/admin/knowledge/route.ts`, `@/scripts/backfill-knowledge.ts`, `getAllKnowledgeAdmin` i `@/lib/supabase/queries.ts`.
- **Akseptansekriterier:**
  1. **Kilde-audit ER UTFØRT (premissen avklart, ikke deferred):** Den ~25-fils faste migrasjons-mengden manifest linje 644 navngir (020–031/049/053–064) er auditert fil-for-fil. **Verifisert resultat — INGEN av disse skriver `areas.report_editorial` eller `place_knowledge`** (manifestets instruksjon «ekstraher … inn i `place_knowledge`/`areas.report_editorial`» var UPRESIS om mål-tabeller). Faktisk innhold: `pois.editorial_hook`/`local_insight` (`UPDATE pois`: 020–027, 029, 057–059), `products.config`-bridgetext (028, 030, 031, 049, 053–055, 062–064), parent-POI-lenker (056–058), Coachella-demo-data (060). Den eneste `place_knowledge`-seeden er `039_seed_knowledge_trondheim.sql` (UTENFOR manifestets navngitte range). **Konsekvens for data-bevaring:** (a) `pois`-editorial-felt + `products.config`-bridgetext bevares PASSIVT av PRD 1s baseline-datavern (raddata overlever in-place — INGEN aktiv flytting kreves); (b) `place_knowledge`-rader (seed 039) bevares av PRD 1; (c) det ENESTE potensielt AKTIVE arbeidet er å seede `areas.report_editorial`-staging for Trondheim-strøkene — som er net-nytt kurator-innhold, ikke en «migrering» av noe eksisterende. Verifisert: INGEN literal «Sem Johnsen»-merkenavn-streng i migrasjonene — manifestet beskriver editorial-KVALITETEN/voicen, ikke et merkenavn. Migrerings-notatet (`docs/rebuild/moat-data-migration.md`) dokumenterer denne auditen + hvor hvert innhold bevares.
  2. **Dead-code-sletting (selvinnesluttet):** `@/app/admin/knowledge/{page,knowledge-admin-client}.tsx` (297 LOC) + `@/app/api/admin/knowledge/route.ts` + `@/scripts/backfill-knowledge.ts` (548 LOC) slettes; `getAllKnowledgeAdmin` (`queries.ts:1606`) fjernes når dens eneste konsument (admin-page) er borte. Verifiser via grep at INGEN annen levende kode refererer dem FØR sletting (kun referert av seg selv + admin-sidebar).
  3. Nabolags-editorial skrives i PRESENS, ikke årstall/historikk (memory `feedback_editorial_no_years_history`) — innholdskrav på det migrerte `body`/`fact_text`.
  4. `npm run lint` (0 errors — ingen ubrukte imports etter sletting), `npx tsc --noEmit`, `npm test` grønne; ingen dangling-referanser til slettede symboler.
- **Avhengigheter:** Unit 2 (staging-format for migrert editorial), Unit 4 (`apply-area-staging` for å skrive migrert data), PRD 1 (datavern av `place_knowledge`/`areas.report_editorial`-RADDATA gjennom baseline-migrasjonen).

> **Fullstendighet:** 7 av 7 units dekket. Hver av de 7 keeper/port-moat-filene har en navngitt eier-unit + akseptansekriterium; alle 5 dead/reference-only-objektene er eksplisitt tildelt sletting (Unit 7) eller markert KONSUMERT-fra-annen-PRD. Ingen sampling — begge skrive-stier (arv + kuratering), lese-stien, THEME_ID-drift-flaten og data-bevaringen har navngitt unit.

---

## 8. Goals → Requirements-kobling

| Goal | Leveres av (requirement / unit) |
|------|---------------------------------|
| **G1.** Punkt→polygon-oppslag (fail-soft, R2-fallback) | Unit 1 |
| **G2.** Zod-staging-kontrakt + THEME_IDS-binding (POI-id ikke-UUID) | Unit 2 |
| **G3.** Arve-kjerne (R9 + atomisk + optimistisk lås, semantikk uendret) | Unit 3 |
| **G4.** Kurator-kjerne-ekstraksjon (delt script + PRD-15-overflate) | Unit 4 |
| **G5.** TS→Python THEME_IDS-kodegen + drift-vakt | Unit 5 |
| **G6.** Lese-sti-port (trust-gate + display_ready-gate, ikke-stille feil) | Unit 6 |
| **G7.** Sem & Johnsen-data-bevaring + dead-code-sletting | Unit 7 |

---

## 9. Utviklingsløp (faser)

### Fase 1 — Rene kjerne-moduler (offline, I/O-isolert / fail-soft)
- **Mål:** Punkt→polygon, staging-kontrakt, THEME_IDS-kodegen og lese-sti står — alt offline-testbart (eller fail-soft mot Supabase) uten kuraterings-skriving.
- **Leveranse:** Unit 1, 2, 5, 6.
- **Autonomi-nivå:** Høy — verbatim/port-moduler med eksisterende test-dekning (Unit 1/2) eller rene utils (Unit 5/6). Unit 1 avhenger av PRD 1s `areas`-re-typing-valg (avklar, ikke fjern cast blindt).

### Fase 2 — Skrive-stier (arv + kuratering)
- **Mål:** Arve-kjernen (atomisk + optimistisk lås) og kurator-kjernen (GET→branch, ingen lås) portet og delt mellom script + fremtidig overflate.
- **Leveranse:** Unit 3, 4.
- **Autonomi-nivå:** Middels. Unit 3 har load-bearing semantikk (R9 + atomisk lås + render-kodesti-rekkefølge) som MÅ bevares; koordineres med PRD 5 (`transformToReportData`). Unit 4 ekstraherer kjerne uten å bryte CLI-skallet.

### Fase 3 — Data-bevaring + opprydding
- **Mål:** Sem & Johnsen-editorial migrert inn i nytt format; dødt gammelt `place_knowledge`-system slettet rent.
- **Leveranse:** Unit 7.
- **Autonomi-nivå:** Middels. Kilde-auditen er allerede utført (Unit 7 AC1 / Beslutning 11 — premissen avklart): ingen aktiv editorial-migrering kreves, kun net-ny `areas.report_editorial`-staging for Trondheim-strøk + grep-verifisert dead-code-sletting. Verifiser mot et faktisk arvet board — det **re-provisjonerte `v2`-Ranheim-boardet** (INDEX note #7: referanse-boardene re-provisjoneres inn i `v2` via PRD 3, ikke migreres), ikke et legacy-`public`-board.

---

## 10. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | NYTT kurator-system bygges mot dagens `areas`/`place_knowledge`-skjema; det gamle 19-topic-systemet slettes | Gammelt system FORLATT Feb 2026 (manifest linje 699–701); KONSEPTET (kurator-flate) moat-relevant, KODEN død (INDEX linje 83) |
| 2 | Arv beregner board-sett via render-kodestien (`getProductFromSupabase`+`transformToReportData`), aldri replikerte filtre | `inherit:9, 165–184`; replikerte filtre kan drifte fra hva board faktisk viser |
| 3 | Arve-skriving = ÉN atomisk read-modify-write mot `products.config` med optimistisk lås; per-tema-PATCH i løkke FORBUDT | `inherit:18–21, 358–396`; midt-løkke-feil ville etterlate delvis editorial og bryte tier-konsistens |
| 4 | Kuratering-skriving (`areas`) godtar INGEN optimistisk lås for prototype-stadiet | `areas` mangler `updated_at` (snapshot 4–20; `curate-area:25–32`); én-operatør-PoC, race usannsynlig; `updated_at`-tillegg er PRD-1-skjemaendring ikke verdt det nå |
| 5 | POI-IDer i `highlightCandidates` ALDRI UUID-regex, kun ikke-tom streng | Heterogene IDer (`google-ChIJ…`/`bus-…`/`entur-NSR-…`); `area-staging:88–95`; død admin-rute `z.uuid()` ville feilet for hash-rader |
| 6 | THEME_IDS genereres TS→Python via kodegen + drift-vakt-test (ikke løpende build-step) | `extract-skolekrets:36–43` er eneste stille drift-flate (manifest linje 104); engangs-data-prep-script trenger ikke runtime-kodegen, drift-vakt holder |
| 7 | Story-text-linker eies av PRD 7; arve-`body` skrives som ren tekst i denne PRD-en — linker IKKE konsumert i dag. Inline POI-linking av arvet editorial er FREMTIDIG/valgfri (Åpne spørsmål #5, Deferred). | INDEX linje 81; verifisert ingen moat-fil kaller `linkPoisInMarkdown` (`inherit:316–320` ren tekst); PRD 7 Unit 5 eier implementasjonen om/når det kobles |
| 8 | Kurator-kjerne ekstraheres til `lib/pipeline/apply-area-staging.ts`, delt mellom script + PRD-15-overflate | Speiler `inherit-area-editorial`-mønsteret (testbar lib-modul); lar PRD-15-overflate dele kjernen uten å shelle ut til script (Åpne spørsmål #5) |
| 9 | Lese-stien porteres for å bevare moat-IP-grensen; board-kobling deferred til PRD 9 | Dagens konsumenter er legacy SEO-sider; rebuild-board leser ikke `place_knowledge` ennå (§5.5) |
| 10 | Stille `return []`-feil-swallow i lese-sti hardnes med logging | CLAUDE.md error-handling-regel; PRD 1 Unit 6-presedens (`queries.ts:193/217`-mønster ikke arvet uendret) |
| 11 | Kilde-audit utført: manifestets «ekstraher inn i `place_knowledge`/`areas.report_editorial`» var UPRESIS om mål-tabeller. Ingen av de ~25 navngitte migrasjonene skriver de tabellene; de skriver `pois`-editorial + `products.config`-bridgetext (bevares passivt av PRD 1) + parent-lenker + demo. Eneste `place_knowledge`-seed er 039. AKTIVT arbeid = net-ny `areas.report_editorial`-staging for Trondheim-strøk, ikke flytting. Ingen literal merkenavn finnes. | Fil-for-fil-audit: 020–027/029/057–059 = `UPDATE pois`; 028/030/031/049/053–055/062–064 = `products` bridgetext; 056–058 = parent-POI; 060 = demo; 039 = place_knowledge-seed. Verifisert ingen «Sem Johnsen»-streng — kvalitet/voice, ikke merkenavn. |
| 12 | Nabolags-editorial i PRESENS, ikke årstall/historikk | memory `feedback_editorial_no_years_history` — innholdskrav på `body`/`fact_text` |

---

## 11. Åpne spørsmål

1. **(ikke-blokkerende for Fase 1)** `areas`-re-typing: PRD 1 §nedstrøms-kart antyder re-typing av klienter; hvis `areas` kommer inn i genererte `Database`-typer, kan `(supabase.from as any)("areas")`-casten i `find-area-for-point:84–89` fjernes. Avklar mot PRD 1-leveranse FØR Unit 1 låses — IKKE fjern casten blindt hvis `areas` fortsatt mangler i typene.
2. **(AVKLART — kilde-audit utført, se Unit 7 AC1 + Beslutning 11)** Sem & Johnsen-data-omfang: Auditen av de ~25 manifest-navngitte migrasjonene (020–031/049/053–064) viser at INGEN skriver `place_knowledge` eller `areas.report_editorial`. De skriver `pois.editorial_hook`/`local_insight` + `products.config`-bridgetext + parent-lenker + demo — alt bevart PASSIVT av PRD 1s baseline-datavern (ingen aktiv flytting). `place_knowledge`-seed er 039 (utenfor rangen), bevart av PRD 1. Manifestets «ekstraher inn i `place_knowledge`/`areas.report_editorial`» var upresis om mål-tabeller. Det eneste aktive arbeidet i Unit 7 er net-ny `areas.report_editorial`-staging for Trondheim-strøkene + dead-code-sletting — IKKE migrering av eksisterende editorial. Ingen gjenstående blokker for Unit 7.
3. **(ikke-blokkerende — løst i Unit 5)** TS→Python-kodegen-ambisjon: `extract-skolekrets-boundary.py` er et engangs-/data-prep-script (Trondheim-skolekrets-polygoner allerede uttrukket). Default landet: generér Python-konstanten fra `theme-ids.ts` + CI/test-drift-vakt (Unit 5 AC3) — IKKE et løpende build-step. Avklart.
4. **(ikke-blokkerende for Fase 1/2)** Lese-sti-board-kobling: skal rebuild-board (PRD 9) eksponere `place_knowledge` per POI? I dag konsumeres lese-stien KUN av legacy SEO-sider. Default: PRD 8 porter lese-funksjonene (bevarer IP-grensen); faktisk board-rendring + om `KNOWLEDGE_TOPICS` (20-verdi legacy) trimmes avgjøres ved PRD 9-behov. Koordineres med PRD 9 når Lag-3-board skrives.
5. **(ikke-blokkerende — ingen unit i denne PRD-en)** Story-text-linker mot arvet editorial: skal arve-`body` (i dag ren tekst, `inherit:316–320`) kjøres gjennom PRD 7s `linkPoisInMarkdown`-markdown-adapter for inline POI-lenker? Verifisert at INGEN moat-fil kaller linkeren i dag (kun `scripts/curate-narrative.ts` + `lib/curation/poi-linker.ts` — PRD 7s egen grounding-pipeline — konsumerer den). Default: IKKE koble nå (arve-`body` forblir ren tekst); avgjøres ved board-rendring (PRD 9) eller dedikert oppfølging hvis inline-lenker i arvet editorial ønskes. Inntil da er PRD 7-linkeren en FREMTIDIG/valgfri integrasjon, ikke en aktiv kontrakt.
6. **(ikke-blokkerende — løst i Unit 4/Beslutning 8)** Kurator-kjerne-plassering: `curate-area` er et script (manifest linje 168 lister «curate-area» blant moat-modulene uten path). Default landet: ekstrahér read-modify-write-kjernen til `lib/pipeline/apply-area-staging.ts` (testbar, gjenbrukbar fra script + PRD-15-overflate); scriptet blir et tynt CLI-skall. Avklart.

---

## 12. Avhengigheter (PRD-graf)

```
        PRD 1 (datamodell)        PRD 2 (tier-manifest+taksonomi)      PRD 7 (grounding-curation)
              │                            │                                   ┊ (stiplet = IKKE aktiv i dag)
              │  (place_knowledge 15 kol,  │  (REPORT_THEME_DEFAULTS,          ┊  (linkPoisInMarkdown-
              │   areas.report_editorial,  │   VALID_THEME_IDS,                ┊   markdown-adapter via
              │   areas-hierarki, ingen    │   kanonisk THEME_IDS for          ┊   felles poi-matcher —
              │   areas.updated_at,        │   TS→Python-kodegen)              ┊   FREMTIDIG/valgfri,
              │   ReportThemeEditorial)    │                                   ┊   ikke konsumert nå)
              └──────────────┬─────────────┴──────────────┬────────────────────┘
                             ▼                             ▼
                  ┌──── prd-lokalkunnskap-moat (PRD 8 — DENNE) ────┐
                  │  find-area-for-point → area-staging (Zod) →    │
                  │  inherit-area-editorial (R9 + atomisk lås på   │
                  │  products.config) ∥ apply-area-staging (areas, │
                  │  ingen lås) → THEME_IDS-kodegen → lese-sti     │
                  │  → Sem&Johnsen-bevaring + dead-code-sletting   │
                  └───────────────────┬────────────────────────────┘
            ┌───────────────────────┬─┴───────────────────────────┐
            ▼                       ▼                              ▼
   prd-provisjon (3)        prd-board-skall-ui (9)        prd-nivaa-2-kuratering (15-prov)
   (KALLER inheritArea-     (board-rendring av            (kurerings-arbeidsflyt-overflate
    Editorial som Steg 7)    editorial/lokalkunnskap)      bygget på apply-area-staging-kjernen)
```

**Blokkeres av:** PRD 1, PRD 2, PRD 7 (`00-INDEX` linje 32: deps 01, 02, 07). MERK: også funksjonell avhengighet til PRD 4 (`MIN_TRUST_SCORE`-konstant) og PRD 5 (`transformToReportData` render-kodesti) som arve-kjernen konsumerer — disse er kjøretids-koblinger, ikke INDEX-deklarerte blokkeringer.
**Blokkerer:** PRD 3 (`inheritAreaEditorial` Steg 7 — funksjonell konsument), PRD 9 (board-rendring), PRD 15-prov (kurerings-overflate på kjernen).
**Konsumerer fra (eier ikke):** `place_knowledge`/`areas`-skjema (PRD 1), taksonomi/THEME_IDS (PRD 2), `MIN_TRUST_SCORE` (PRD 4), `transformToReportData` (PRD 5). **IKKE konsumert i dag (fremtidig/valgfri):** `linkPoisInMarkdown` (PRD 7) — INDEX linje 32 lister PRD 7 som dep, men det er taksonomi/grounding-koblingen som er aktiv; selve linkeren kobles først hvis inline POI-linking av arvet editorial bygges (Åpne spørsmål #5).

---

**Fullstendighet:** 7 av 7 implementation units spesifisert med avhengigheter + akseptansekriterier; 7 av 7 mål (G1–G7) koblet til ≥1 unit, og hver unit peker tilbake til ≥1 mål. Alle bærende påstander forankret i `prod-schema-snapshot.txt` (`place_knowledge` linje 59–73, `areas` linje 4–20 inkl. verifisert fravær av `updated_at`), `CARRY-OVER-MANIFEST.md` (linje 104–118, 644, 699–701, 734–736, 756–757, 768), `00-INDEX.md` (linje 32, 81, 83, note #4 (linje 91)) og faktisk kode (`inherit-area-editorial.ts`, `find-area-for-point.ts`, `area-staging.ts`, `curate-area.ts`, `extract-skolekrets-boundary.py`, `public-queries.ts`, `poi-trust.ts:73`). Ingen P0/P1/P2-tiers; deferred work under Scope Boundaries med PRD-pekere; ingen render-/tier-gating spesifisert (patch #2). Area-editorial-arv + THEME_IDS-kodegen er eksplisitt skopet til `bolig`-profilen (§3 + Deferred); `naering`-profil deferred. Story-text-linkeren (PRD 7) er IKKE konsumert i dag — fremtidig/valgfri (Åpne spørsmål #5). Sem & Johnsen-data-premissen er avklart via fil-for-fil kilde-audit (Unit 7 AC1 / Beslutning 11): ingen aktiv editorial-migrering kreves. Gjenstående uavklart: `areas`-re-typing mot PRD 1-leveranse (Åpne spørsmål #1, ikke-blokkerende for Fase 1).

---

### Walkthrough-revisjon 2026-06-27

- **Dette laget ER der «bygg én gang per strøk» fysisk bor.** Editorial-modell-beslutningen i PRD 7 (Gemini henter → Fable skriver, én gang per strøk, lest ved render — INDEX note #10, `project_editorial_gemini_fable`) realiseres mekanisk her: `areas.report_editorial` lagres PER skolekrets-polygon og **arves ned på hvert board innenfor polygonet** (`inherit-area-editorial`). Det er denne arve-mekanismen som gjør at innholds-genereringen faktisk skjer én gang per strøk (Malvik/Ranheim-modellen) og gjenbrukes av alle listings i strøket — ikke per board.
- **To-nivå-konsekvens:** den autonome Gemini→Fable-teksten (nivå 1) og den kuraterte berikelsen (nivå 2) lever begge på strøk-nivå her. PRD 8 gater fortsatt ALDRI på `reportTier` — gating = body-eller-highlight-tilstedeværelse (Beslutning 4 / §3).
- **⚠ Koherens-tråd for den helhetlige auditten:** den presise 7↔8-koblingen må avstemmes — PRD 7 spec'er grounding PER board (`products.config…themes[].grounding`), mens «én gang per strøk» tilsier at den genererte editorial-teksten heller bør nøkles til AREA (strøk) og lande i `areas.report_editorial` + arves ned (PRD 8). Hvilket lag som eier per-strøk-genereringen vs. per-board-fakta, og hvordan nivå-1-auto-editorial nøkles (per board vs per strøk), løses i auditten — ikke surgisk her, fordi det spenner over begge PRD-ene.

---

### Moat-perspektiv (forretningsutvikling 2026-06-28) — fremtidig retning, IKKE build-nå

> **Ramme (eier 2026-06-28):** Ferske innsikter fra forretningsutvikler-møter, tatt inn som **retning** — ikke build-ordre. Moat 1s byggekritiske kjerne er allerede her + i PRD 3; dette er flywheel-/løkke-laget oppå, som jobbes videre når Moat 1 utvikles. Full design: **`docs/rebuild/moat-1-lokalkunnskap-build-input.md`**.

PRD 8 er bekreftet moden og strategisk på linje (Placy-eid IP, provenance-felt, ÉN-validert-kanon-tenancy, Lag A-ingest=PRD 3 / Lag B-kuratering=PRD 8). Det rapporten legger til som fremtidig retning:

- **Megler-UGC-flywheelen (den høyest-leverte moat-materen):** megleren beriker selv sitt listings nærområde på desktop (bekreft/korriger auto-fylt kart, legg til perler, bilder, innsikt → Placys delte DB). Den motiverte, gratis kuratering-arbeidskraften = asymmetrien mot Norkart. **Eierskap er uavklart** mellom PRD 15 (intern kuratering-arbeidsflyt) og PRD 12 (minimalt admin) — bør låses (utvid PRD 15-overflaten med megler-modus, ELLER egen oppfølgings-PRD) når flaten skal bygges. Bygger på `apply-area-staging`-kjernen Unit 4 alt ekstraherer. Post-MVP.
- **«Meglers tanker» (attributert megler-stemme):** strukturert slot for meglerens eget perspektiv. **Designnøkkelen:** splitt presentasjons-laget (attributert — megler-brand, kun på *deres* listinger) fra kunnskaps-laget (de-attributert — faktiske nuggets ekstrahert til Placy-kanonen, arves av neste listing i strøket). Dette gjør at funksjonen IKKE er et generisk fler-tenant-lag — den raffinerer per-megler-lag-deferralen i Deferred-tabellen (nå *informert*, ikke udefinert). Fortsatt deferret for MVP.
- **Freshness/re-verifisering:** feltene finnes (`verified_at`/`confidence`/`display_ready`) men ingen *mekanisme* (hva utløser re-sjekk, hvordan confidence degraderes). Kjent skyld — ikke «løst» fordi feltene finnes. Post-MVP, lavt presserende på prototype-volum.
- **Kryss-moat-løkke (Innsikt → kuratering):** når Moat 2 har volum, blir «hvilke punkter får mest engasjement» (PRD 13 `getStrokEngagement`) en prioriterings-input til kurator-køen. Akkumulerings-løkka er den egentlige moaten. Etter Moat-2-volum.

Ingen av disse blokkerer MVP (instrumentert Ranheim-dypt nivå-1-board). Bevart her så flywheelen som *mater* moaten ikke faller mellom PRD 8/12/15.
