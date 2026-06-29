# Datamodell + Supabase-baseline — PRD

> **Dato:** 2026-06-26 (revidert 2026-06-27 — fersk `v2`-schema-strategi, se walkthrough-revisjon nederst)
> **Status:** Brainstormet og besluttet. Klar for utvikling.
> **Lag:** Delt (fundament — avhengighetsrot for hele rebuilden)
> **PRD-nr:** 1 av 15 (sommer-rebuild 2026)
> **Kontekst:** Første fundament-PRD i sommer-rebuilden. Definerer ÉN ren, kanonisk Supabase-baseline som erstatter 69 inkrementelle migrasjoner, og bygger data-moaten (instrumentering + lokalkunnskap-IP) inn fra linje 1. Alle 14 øvrige PRD-er hviler på denne. Baseline opprettes **ferskt i et nytt `v2`-Postgres-schema** i samme Supabase-database; `public`-legacy røres ikke (det er akkumulert test-rot uten reell prod-data) og droppes senere som et eget, gated opprydding-steg. Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md` (autoritativ 15-PRD-kontrakt) og `docs/rebuild/prod-schema-snapshot.txt` (24-tabell-introspeksjon, 2026-06-26).

---

## Produktvisjon / Formål

Denne PRD-en etablerer **datakontrakten** for hele Placy-rebuilden. Det gamle systemet har akkumulert 69 migrasjoner, 24 tabeller i `public`-schemaet hvorav 11 er døde Trip/Guide- og scroll-artikkel-rester, og — kritisk — **null engasjements-instrumentering**. Innholdet i dagens database er akkumulert test-rot (databasen er live kun for testing — ingen reell kunde-/prod-data), så `public`-schemaet vokter ingenting verdifullt. Rebuilden bygger derfor ett rent baseline-skjema **ferskt i et nytt `v2`-schema** ved siden av `public`, og bygger data-moaten inn fra første linje.

To strategiske grep skiller denne baseline fra det gamle:

1. **Engasjements-instrumentering fra linje 1.** Det gamle systemet har ingen `events`-tabell og ingen analytics-avhengighet (verifisert greenfield mot `prod-schema-snapshot.txt` — ingen events-tabell blant de 24, og mot `package.json` — ingen analytics-dep). Rebuildens MVP er et *instrumentert* nivå-1-board. Event-skjemaet må stå i baseline slik at nedstrøms board-PRD-er kan logge mot det uten ny migrasjon.
2. **Lokalkunnskap-DB som Placy-eid IP.** `place_knowledge` (15 kolonner) er allerede i prod, men dens rolle som *term-sheet-relevant eid IP* — lokale innsikter "ikke på Google" som eies av Placy, ikke kunden — må forankres i baseline-skjemaet og RLS-policyene.

**Alt nedenfor i stacken konsumerer denne PRD-en.** Baseline-skjemaet + re-derived `@/lib/types` er den primære nedstrøms-grensen for de 14 øvrige PRD-ene.

Dette er en **lav-risiko, additiv og reversibel operasjon**: baseline opprettes ferskt i et nytt `v2`-schema ved siden av `public`. `public`-legacy røres ikke og står som fallback — er noe galt med `v2`, dropper vi bare `v2` og kjører på nytt. Det finnes ingen ekte prod-data å miste (databasen er live kun for testing), så ingen migrasjon mot populerte tabeller og intet rad-antall-datavern er nødvendig. Den faktiske høyrisiko-operasjonen — å droppe `public`-legacy — er **deferred og gated** på at rebuilden er validert (demo-paritet), og tas som et eget, eksplisitt opprydding-steg senere. `/effort high` holder for hele denne PRD-en; ingen `xhigh` kreves for `v2`-opprettelsen.

---

## Migrasjonsmekanikk (operasjonsmodell — les FØR enhver kjøring)

Dette er en additiv, lav-blast-radius-operasjon. Databasen inneholder kun akkumulert test-rot (live for testing, ingen reell kunde-/prod-data), så det finnes ingenting i `public` som må migreres eller vernes. Operasjonsmodellen er derfor eksplisitt valgt:

**Valgt modell: fersk `v2`-schema-baseline — alle tabeller opprettes ferskt i et nytt Postgres-schema ved siden av `public`.**

- `070_baseline.sql` oppretter `CREATE SCHEMA IF NOT EXISTS v2` og deretter alle 13 tabellene som **faktiske `CREATE TABLE v2.<navn>`** (IKKE `IF NOT EXISTS`-no-op mot eksisterende tabeller — `v2` er tomt, så dette er ekte CREATE) + `events`-tabellen, alt ferskt i `v2`. Den er fortsatt den **kanoniske, autoritative DDL-en** og sannhetskilden som erstatter de 69 inkrementelle filene som lese-/forståelses-kontrakt — men nå reproduserer den skjemaet ved å FAKTISK opprette det i `v2`.
- **`public`-legacy røres IKKE av denne migrasjonen.** Det gjelder både de gamle keeper-tabellene (53-kol `pois`, `areas.report_editorial`, `place_knowledge` osv. slik de står i `public`) OG de 11 legacy-tabellene. Ingen in-place `ALTER`, ingen `DROP`, ingen rad-antall-datavern — det er ingenting reelt å beskytte, og `public` står urørt som fallback.
- **`v2` må eksponeres i Supabase API:** Settings → API → Exposed schemas må inkludere `v2`, og DDL-en må `GRANT USAGE ON SCHEMA v2` + tabellrettigheter (`SELECT`/`INSERT`/`UPDATE`/`DELETE` etter behov) til `anon`, `authenticated` og `service_role` slik at PostgREST/`supabase-js` kan nå tabellene. `supabase-js`-klientene peker til `v2` via `.schema('v2')` per kall eller `db: { schema: 'v2' }` i klient-konfigen (se Unit 5/6).
- **`v2` er reversibelt:** er noe galt, `DROP SCHEMA v2 CASCADE` og kjør på nytt — `public` er intakt.

> Skjema-navnet `v2` er et arbeidsnavn (et valg, ikke et krav). Behold det som default; bekreft endelig navn før kjøring (Åpent spørsmål #6).
>
> Drop av `public`-legacy er IKKE en del av denne migrasjonen. Det er rebuildens egentlige decommission-steg og er **deferred + gated** på demo-paritet-validering — se Unit 3 (planlagt opprydding) og Scope Boundaries → Deferred.

---

## Arkitektur-kontekst

I rebuild-mantraet **"del nedover stacken, diverger oppover i UX"** sitter denne PRD-en på *bunnen av stacken*: datamodell, skjema og tilgangskontrakt er ALLTID delt — aldri forket per tier. Nivå (1|2) er et felt på `products.config` (eid av PRD 2), ikke forket kode eller forket skjema. Render-laget gater ALDRI på `reportTier` (verifisert: ingen `reportTier`-referanse i `@/components/variants/report/board/BoardMap3D` eller `@/components/variants/report/reels/ReportReelsPage`).

### Nedstrøms-kontrakt-kart (hvem konsumerer baseline-skjemaet)

| Nedstrøms-PRD | Konsumerer fra baseline | Kontraktsfelt baseline MÅ levere |
|---|---|---|
| PRD 2 — tier-capability-manifest | `products.config` (jsonb), `projects.has_3d_addon` | `products.config NOT NULL`, `projects.has_3d_addon NOT NULL` |
| PRD 3 — provisjon | pois, projects, products, project_pois, areas, generation_requests | Alle keeper-felt + offentlig-kilde-felt (`pois.source/nsr_id/barnehagefakta_id/osm_id`) |
| PRD 4 — trust-google-places | `pois.trust_score`, `pois.trust_flags`, `pois.poi_tier`, Google-felt | `pois.trust_flags NOT NULL`, `trust_score`, alle `google_*`-felt |
| PRD 5 — board-data-state | pois, products, areas, translations, place_knowledge | editorial-felt + `translations`-tabell (i18n) |
| PRD 8 — lokalkunnskap-moat | `place_knowledge`, `areas.report_editorial`, `areas`-hierarki | `place_knowledge` (15 kol), `areas.report_editorial` (jsonb), `areas.parent_id/level` |
| PRD 11 — realtime-transport | `pois.entur_stopplace_id/bysykkel_station_id/hyre_station_id` | De tre kobling-feltene |
| PRD 13 — instrumentering | **`events`-tabell (NY)** | `events` i baseline (greenfield — denne PRD eier skjemaet) |
| Alle 14 | `@/lib/types` re-derived fra nytt skjema | Typ-paritet skjema ↔ types |

---

## Eksisterende kodebase

### Bæres over (keeper / port-with-rewrite)

| Modul / objekt | @/-sti eller tabell | Verdict | Tier |
|---|---|---|---|
| Supabase server-klient | `@/lib/supabase/client` (`createServerClient`) | keeper-core (m/ nøkkel-kontrakt-fix, se Unit 5) | delt |
| Supabase public/SEO-klient | `@/lib/supabase/public-client` (`createPublicClient`, `SUPABASE_CACHE_TAG`) | keeper-core | delt |
| Query-wrappere | `@/lib/supabase/queries` | port-with-rewrite (nye `v2`-wrappere, se Unit 6; gammel `public`-trim er cutover) | delt |
| Mutation-wrappere | `@/lib/supabase/mutations` | port-with-rewrite (mot `v2`) | delt |
| Modul-eksport | `@/lib/supabase/index` (`supabase`, `isSupabaseConfigured`, `createServerClient`) | keeper-core | delt |
| Genererte DB-typer | `@/lib/supabase/database.types` + `@/lib/supabase/types` | re-generér fra `v2`-skjemaet | delt |
| Domene-typer | `@/lib/types` | re-derive fra `v2`-skjemaet (trim Trip/Guide/scroll-typer) | delt |
| 13 tabell-skjemaer | se Datakontrakt | keeper-skjema (eksakte kolonner per snapshot; opprettes ferskt i `v2`) | delt |

### Slettes / forlates (dead / reference-only)

| Objekt | Tabell / sti | Verdict | Begrunnelse |
|---|---|---|---|
| Trip-stacken | `trips`, `trip_stops`, `project_trips` | drop (deferred, gated) | Guide-produkt parkert; ingen rebuild-konsument |
| Scroll-artikkel-stacken | `story_sections`, `section_pois`, `theme_stories`, `theme_story_sections`, `theme_section_pois` | drop (deferred, gated) | Erstattet av board-data-modellen (PRD 5) |
| Legacy-prosjekt-rester | `projects_legacy`, `project_pois_legacy` | drop (deferred, gated) | Erstattet av `projects`/`project_pois` |
| Samlinger | `collections` | drop (deferred, gated) | Explorer-samlinger ikke i rebuild-scope |
| Event-felt på `pois` | `pois.event_*` (event_dates, event_time_start/end, event_description, event_url, event_tags) | reference-only (BEHOLD kolonner i `v2`) | Event-spor PARKERT; kolonnene beholdes i `v2`-skjemaet (snapshot-paritet), men ingen rebuild-PRD aktiverer dem |
| place_knowledge-SYSTEMET (kode rundt) | `@/app/admin/knowledge` + forlatt editorial-system-kode | dead (kode), KEEPER (skjema) | Manifest linje 7 lister "place_knowledge-systemet" som cruft; manifest linje 149/735 holder *skjemaet/dataene* som moat-IP keeper. Denne PRD beholder kun skjema+data; system-koden er PRD 8s ansvar / utenfor scope |

> Drop-presisering: De fem "drop"-radene over (11 legacy-tabeller) ligger i `public` og droppes IKKE av baseline-kjøringen. De fjernes i det gated decommission-steget (Unit 3) når demo-paritet er validert. `v2` bygges rent uten dem.

> Event-felt-presisering: De seks `event_*`-kolonnene på `pois` BEHOLDES i baseline (de er en del av pois-snapshotet og å droppe dem er unødvendig destruktivt for et parkert spor), men markeres reference-only. Ingen unit i denne PRD-en eller nedstrøms aktiverer dem. Dette er en "implementer riktig"-grense, ikke et scope-kutt.

> place_knowledge system-vs-skjema-presisering: Manifestet *ser* selvmotsigende ut (linje 7 nevner "place_knowledge-systemet" blant cruft som ikke skal med; linje 149 + 735 holder place_knowledge som "skjema-IP keeper"). Skillet er reelt: **SYSTEMET** (forlatt editorial-kode rundt, `@/app/admin/knowledge`) er dødt og er ikke i denne PRD-ens scope; **SKJEMAET + DATAENE** (15 kol + live rader) er moat-IP og beholdes verbatim. Denne PRD følger keeper-lesningen for skjema/data (Unit 4).

---

## Datakontrakt / Skjema

### Baseline-tabeller — KEEPER (13)

Disse 13 skjemaene opprettes ferskt som `CREATE TABLE v2.<navn>`. Kolonneantall og navn er **eksakt** fra `docs/rebuild/prod-schema-snapshot.txt` slik at `v2`-skjemaet matcher snapshot-kolonnene og koden treffer. NN = NOT NULL i snapshot ("NO"-kolonnen).

| Tabell | Kolonner (snapshot) | Nøkkel-felt baseline må reprodusere ordrett |
|---|---|---|
| `areas` | 17 | `parent_id`, `level` (NN), `boundary` (jsonb), `postal_codes` (array), `report_editorial` (jsonb) — moat-hierarki |
| `categories` | 5 | `id`(NN), `name`(NN), `icon`(NN), `color`(NN) |
| `category_slugs` | 6 | `category_id`+`locale`+`slug` (NN), seo-felt |
| `customers` | 3 | `id`(NN), `name`(NN) |
| `generation_requests` | 18 | `status`(NN), `consent_given`(NN), `address_slug`(NN), `customer_id`, `project_id` — megler-self-serve-flyt |
| `place_knowledge` | 15 | `topic`(NN), `fact_text`(NN), `confidence`(NN), `structured_data`(jsonb), `source_url/name`, `display_ready`, `verified_at` — **moat-IP** |
| `pois` | 53 | se egen tabell under |
| `product_categories` | 3 | `product_id`+`category_id`(NN), `display_order` |
| `product_pois` | 5 | `product_id`+`poi_id`(NN), `featured`(NN), `category_override_id`, `sort_order` |
| `products` | 10 | `config`(jsonb, NN — tier-manifest-bærer), `product_type`(NN), `version`(NN), story_*-felt |
| `project_pois` | 3 | `project_id`+`poi_id`(NN), `sort_order` |
| `projects` | 22 | `has_3d_addon`(boolean, NN), `default_product`(NN), `short_id`(NN), `theme`(jsonb), `discovery_circles`(jsonb), `venue_context` |
| `translations` | 8 | `locale`+`entity_type`+`entity_id`+`field`+`value` (alle NN) — i18n-grunnlag for PRD 5 |

### `pois` — 53 kolonner (kritisk nedstrøms-kontrakt)

Gruppert etter konsument-PRD. Alle navn ordrett fra snapshot (linje 74–126).

| Gruppe | Kolonner | Konsumeres av |
|---|---|---|
| Kjerne | `id`(NN), `name`(NN), `lat`(NN), `lng`(NN), `address`, `category_id`, `area_id`, `description` | Alle |
| Google-berikelse | `google_place_id`, `google_rating`, `google_review_count`, `google_maps_url`, `google_website`, `google_business_status`, `google_price_level`, `google_phone`, `photo_reference`, `featured_image`, `gallery_images`, `photo_resolved_at` | PRD 4 |
| Trust/kvalitet | `trust_score`, `trust_flags`(NN), `trust_score_updated_at`, `poi_tier`, `tier_reason`, `is_chain`, `is_local_gem`, `poi_metadata`(jsonb), `tier_evaluated_at` | PRD 4 |
| Editorial | `editorial_hook`, `local_insight`, `story_priority`, `editorial_sources`, `anchor_summary` | PRD 5, 8 |
| Realtime-transport-kobling | `entur_stopplace_id`, `bysykkel_station_id`, `hyre_station_id` | PRD 11 |
| Åpningstider | `opening_hours_json`(jsonb), `opening_hours_updated_at` | PRD 11 |
| Offentlig kilde | `source`, `nsr_id`, `barnehagefakta_id`, `osm_id` | PRD 3 |
| Hierarki | `parent_poi_id` | PRD 3 |
| Sosial | `facebook_url` | PRD 4 |
| Event (reference-only, BEHOLD) | `event_dates`, `event_time_start`, `event_time_end`, `event_description`, `event_url`, `event_tags` | (parkert) |
| Tidsstempler | `created_at`, `updated_at` | Alle |

### Legacy-tabeller i `public` — DEFERRED DROP (11)

`trips`, `trip_stops`, `project_trips`, `story_sections`, `section_pois`, `theme_stories`, `theme_story_sections`, `theme_section_pois`, `projects_legacy`, `project_pois_legacy`, `collections`.

Disse droppes IKKE av baseline-migrasjonen. De ligger i `public` og fjernes først i det gated decommission-steget når demo-paritet er validert (se Unit 3 + Deferred). De gamle keeper-tabellene i `public` droppes i samme steg.

### NY tabell — `events` (greenfield, denne PRD eier skjemaet)

Data-moat-instrumentering. Aggregert engasjement, ingen individuell tracking uten samtykke. Skjemaet står i baseline slik at PRD 13 og board-PRD-ene (5, 9) kan logge mot det uten ny migrasjon. Greenfield — fantes ikke i `public`, og opprettes (som alle de øvrige) ferskt i `v2` (jf. Migrasjonsmekanikk).

| Kolonne | Type | Null | Rolle |
|---|---|---|---|
| `id` | uuid (default gen_random_uuid) | NO | PK |
| `event_type` | text | NO | board_viewed / category_opened / voiceover_played / poi_clicked |
| `project_id` | text | YES | FK-løs kobling (lik snapshot-konvensjon for `pois.area_id`) |
| `product_id` | text | YES | hvilket produkt/board |
| `poi_id` | text | YES | for poi_clicked |
| `payload` | jsonb | YES | hendelsesspesifikt (kategori-id, voiceover-segment osv.) |
| `session_id` | text | YES | anonym, ikke-personidentifiserende økt-nøkkel |
| `created_at` | timestamptz (default now()) | NO | tidsstempel |

> ERD-skisse leveres i baseline-migrasjonens kommentarblokk + i `@/docs/rebuild/baseline-erd.md` (mermaid) som del av Unit 1.

> **Moat-2-perspektiv (forretningsutvikling 2026-06-28) — fremtidig retning, IKKE en baseline-endring nå.** `payload` (jsonb) er bevisst en ÅPEN konvolutt: Moat-2-designen (`docs/rebuild/moat-2-innsikt-build-input.md`) vil at hvert event bærer en `payload.context`-konvolutt (brukerens tilstand: `mode`, aktive kategorier, `travel_mode`, `time_budget`, `map_center/zoom`, `home_anchored`). jsonb-formen støtter dette uten skjema-endring. `event_type`-CHECK forventes også å vokse (de to ⭐⭐-signalene `route_requested` + `search_intent`, samt `travel_mode_changed`/`map_viewport`) via den utvidbare CHECK+`EVENT_TYPES`-mekanismen. **🔴 Eneste tids-følsomme:** når PRD 13 Fase-1-loggeren faktisk bygges, IKKE lås event-formen til en naken `{category_id}`-payload — data logget uten kontekst kan aldri få den tilbake (den konsentrerte Ranheim-tidlig-volumen er valideringsdataen). Ingen handling i baseline nå; flagget så det ikke tapes (full detalj i moat-2-rapporten + PRD 13 Moat-perspektiv-seksjon).

---

## Implementation Units (7 av maks 8)

### Unit 1 — Baseline-skjema-fil (`v2` fersk CREATE + ERD)

- **Mål:** Én `supabase/migrations/070_baseline.sql` som oppretter `CREATE SCHEMA IF NOT EXISTS v2` + den kanoniske, autoritative DDL-en for de 13 keeper-tabellene som faktiske `CREATE TABLE v2.<navn>` med eksakt kolonne-paritet mot snapshot. `public` røres ikke. Oppfyller Goal A.
- **Filer:** `supabase/migrations/070_baseline.sql`, `@/docs/rebuild/baseline-erd.md` (mermaid ERD)
- **Akseptansekriterier (definert før impl.):**
  1. `CREATE SCHEMA IF NOT EXISTS v2`, deretter faktiske `CREATE TABLE v2.<navn>` for hver av de 13 tabellene (ekte CREATE i et tomt schema — IKKE `IF NOT EXISTS`-no-op, IKKE in-place `ALTER`). **`public`-schemaet (gamle keeper- OG legacy-tabeller) røres ikke** (jf. Migrasjonsmekanikk).
  2. Hver av de 13 `v2`-tabellene har NØYAKTIG samme kolonnenavn og -antall som snapshot (areas 17, pois 53, projects 22, generation_requests 18, place_knowledge 15, products 10, translations 8, category_slugs 6, categories 5, product_pois 5, customers 3, product_categories 3, project_pois 3) — `v2` MÅ matche snapshot-kolonnene eksakt så nedstrøms-koden treffer.
  3. NOT NULL-constraints matcher snapshot "NO"-kolonnen for hver kolonne (verifiseres mot hele snapshot-filen, linje 4–275; keeper-tabellene ligger på linje 4–147 og 234–241, pois-blokken på 74–126).
  4. `products.config`, `projects.has_3d_addon`, `pois.trust_flags` er NOT NULL (tier/trust-kontrakt).
  5. ERD-fil rendrer mermaid uten syntaksfeil og viser de 13 tabellene + `events`.
- **Avhengigheter:** ingen (rot)

### Unit 2 — `events`-tabell + indekser (instrumenterings-greenfield)

- **Mål:** Legg `events`-tabellen (`CREATE TABLE v2.events`) inn i baseline-migrasjonen med spørrings-effektive indekser. Greenfield-tabell som ikke fantes i `public`. Oppfyller Goal C.
- **Filer:** `supabase/migrations/070_baseline.sql` (samme fil, egen seksjon)
- **Akseptansekriterier:**
  1. `events`-tabell med de 8 kolonnene over; `id` default `gen_random_uuid()`, `created_at` default `now()`.
  2. Indeks på `(project_id, created_at)` og på `(event_type, created_at)` for aggregeringsspørringer.
  3. `event_type` har CHECK-constraint på det startsettet PRD 13 prototyper (board_viewed, category_opened, voiceover_played, poi_clicked) — utvidbart via senere migrasjon.
  4. Verifisert at INSERT av en test-event via psql lykkes mot baseline lokalt.
- **Avhengigheter:** Unit 1 (samme migrasjonsfil)

### Unit 3 — Planlagt drop av `public`-legacy (deferred, gated)

- **Mål:** Definer det gated opprydding-steget som fjerner hele `public`-legacy (både de 11 døde Trip/Guide-/scroll-tabellene OG de gamle keeper-tabellene) FØRST når demo-paritet er validert. Dette er IKKE en del av baseline-kjøringen (`070_baseline.sql`) — `v2` lever parallelt med `public` til rebuilden er bevist. Decommission-steget får sin egen migrasjonsfil/PR. Oppfyller Goal A (komplett kollaps når validert).
- **Filer:** egen senere migrasjon/PR (f.eks. `NNN_drop_public_legacy.sql`) — IKKE `070_baseline.sql`
- **Akseptansekriterier (for det fremtidige drop-steget):**
  1. Steget gates eksplisitt på «demo-paritet validert» (kriterium definert i Åpent spørsmål #8) og krever Andreas' go. Inntil da står hele `public` urørt som fallback.
  2. Drop-steget kjører `DROP TABLE IF EXISTS` for de 11 legacy-tabellene (trips, trip_stops, project_trips, story_sections, section_pois, theme_stories, theme_story_sections, theme_section_pois, projects_legacy, project_pois_legacy, collections) OG de gamle keeper-tabellene i `public`. (Alternativt `DROP SCHEMA public CASCADE` + nyopprettelse hvis renere — vurderes når steget skrives.)
  3. FK-status avklares FØR drop-steget skrives: snapshot-koblingene er FK-løse text-felt (f.eks. `pois.area_id`). Bekreft via `information_schema.table_constraints` at ingen FK krysser tabeller som droppes i ulik rekkefølge. Hvis ingen relevant FK: plain `DROP TABLE IF EXISTS` uten `CASCADE`. Bruk `CASCADE` KUN ved en intern legacy→legacy FK, med eksplisitt kommentar om hvilken FK. (Denne FK-avklaringen er fortsatt relevant — den flyttes bare til drop-steget.)
  4. Etter drop-steget returnerer en REST-spørring mot en droppet `public`-tabell 404/feil (verifikasjon i det stegets egen runbook).
- **Avhengigheter:** demo-paritet validert (ikke en baseline-avhengighet; deferred)

### Unit 4 — Lokalkunnskap-moat-skjema (Placy-eid IP)

- **Mål:** Forankre `place_knowledge` + `areas.report_editorial`/`areas`-hierarki som eid IP-lag i `v2`-baseline. Skjema-DESIGNEN, moat-IP-konseptet og RLS-relevansen er uendret; det er kun datavernet (som vernet test-data) som faller bort. Oppfyller Goal D + Goal G.
- **Filer:** `supabase/migrations/070_baseline.sql` (`v2.place_knowledge` + `v2.areas`-seksjon), `@/docs/rebuild/moat-data-contract.md` (eierskaps-/IP-notat)
- **Akseptansekriterier:**
  1. `v2.place_knowledge` (15 kol) reprodusert ordrett, inkl. `confidence`(NN), `display_ready`, `verified_at`, `structured_data`(jsonb), `source_url`/`source_name`.
  2. `v2.areas.report_editorial`(jsonb), `areas.parent_id`, `areas.level`(NN), `areas.boundary`(jsonb), `areas.postal_codes`(array) reprodusert — hierarki for city→bydel→strøk (konsumeres av PRD 8).
  3. **Ingen datavern nødvendig:** `v2` opprettes tomt, og `public`-innholdet er test-rot uten reell verdi — det skal ikke migreres eller telles. `public` står uansett intakt som kilde inntil legacy decommissioneres (Unit 3), så hvis noe kuratert innhold i `public` viser seg verdt å beholde, kan det re-seedes eksplisitt inn i `v2` senere som et valgfritt steg. Default er ferskt `v2`. (Erstatter det tidligere pre/post-rad-antall-vernet, som vernet test-data.)
  4. IP-notat dokumenterer at moat-data eies av Placy (ikke kunde/megler), presiserer system-vs-skjema-skillet (manifest linje 7 vs 149/735: system-kode dødt, skjema/data keeper), og peker til at *gating* av nivå-2-editorial er PRD 8s ansvar (ikke denne PRD-en).
- **Avhengigheter:** Unit 1

### Unit 5 — RLS-policies + klient-nøkkel-kontrakt (tilgangskontrakt på DB- og app-nivå)

- **Mål:** Row Level Security som håndhever server-only skrivetilgang og kontrollert lesetilgang, OG en klient-nøkkel-kontrakt som hindrer at RLS brytes stille av anon-fallback. Policyene opprettes på `v2.*`-tabellene. Oppfyller Goal B.
- **Filer:** `supabase/migrations/070_baseline.sql` (RLS-seksjon), `@/lib/supabase/client` (nøkkel-fallback-fix)
- **Akseptansekriterier:**
  1. RLS aktivert (`ENABLE ROW LEVEL SECURITY`) på alle 14 `v2`-tabeller (13 keeper + events). Alle policy-mål er `v2.<navn>` (schema-targeting — policyene gjelder `v2`, ikke `public`-legacy som lever urørt parallelt).
  2. Lese-policy: publiseringsklare board-data (`v2.`pois, products, projects, areas, categories, category_slugs, translations, product_pois, product_categories, project_pois) lesbare for anon-rollen (SEO/public-board krever det). Forutsetter at `v2` er eksponert i Supabase API + `GRANT USAGE`/tabellrettigheter er satt (jf. Migrasjonsmekanikk).
  3. Skrive-policy: INSERT/UPDATE/DELETE på alle `v2`-tabeller KUN for service-role (provisjon/admin/server-actions). `v2.events` er INSERT-only for service-role (server-action-logg), ingen anon-skriv.
  4. `v2.place_knowledge` lese-policy gater på `display_ready = true` for anon (moat-IP eksponeres ikke rå).
  5. **Klient-nøkkel-kontrakt (verifisert problem):** `createServerClient()` i `@/lib/supabase/client` faller i dag tilbake til anon-nøkkelen når `SUPABASE_SERVICE_ROLE_KEY` mangler (`client.ts:30` — `process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`). Med RLS aktiv bryter denne fallbacken "service-role-only"-skrive-policyen (AC3), `events` INSERT-only (AC3), og admin-lesing av non-display-ready `place_knowledge` (`getAllKnowledgeAdmin`, `queries.ts:1606`) — alt feiler/filtreres da STILLE. Løs via én av: (a) fjern anon-fallback for service-kontekst slik at `createServerClient()` fail-fast-er (kaster) når `SUPABASE_SERVICE_ROLE_KEY` mangler i server-runtime; eller (b) behold fallback men legg en runtime-assert + eksplisitt dokumentert env-nøkkel-kontrakt (hvilke nøkler MÅ være satt i prod/preview for at RLS-kontrakten holder). Velg (a) som default (fail-fast > stille feil).
- **Avhengigheter:** Unit 1, Unit 2, Unit 4

### Unit 6 — Generér `v2`-DB-typer + nye `v2`-wrappere/`@/lib/types`

- **Mål:** TypeScript-paritet mellom `v2`-skjemaet og applikasjonstyper. Generér DB-typer fra `v2`, og skriv rebuildens nye wrappere/`@/lib/types` mot `v2`. Den live-koblede trimmingen av eksisterende `queries.ts`/`mutations.ts` (54 referanser til legacy-tabeller, `mutations.ts` skriver theme_*-tabeller) flyttes til cutover/opprydding — den gamle koden lever videre mot `public` til legacy decommissioneres (Unit 3). Oppfyller Goal E.
- **Filer:** `@/lib/types`, `@/lib/supabase/database.types`, `@/lib/supabase/types`, samt nye `v2`-wrappere (`@/lib/supabase/queries`/`mutations` skrives mot `v2`; gammel kode-trim mot `public` er cutover)
- **Akseptansekriterier:**
  1. `@/lib/supabase/database.types` generert fra `v2`-skjemaet (introspeksjon med `--schema v2`), inneholder `events` + de 13 keeper-tabellene fra `v2`, ingen av de 11 legacy-tabellene.
  2. `@/lib/types` (rebuildens nye/oppdaterte domene-typer mot `v2`) har ingen referanser til de døde symbolene (verifisert i fil): `StorySection` (linje 110), `ThemeStory` (124), `ThemeStorySection` (133), `Trip`/`TripStop`/`ProjectTrip` (801/790/846), `TripConfig`/`TripStopConfig`, `TripCategory`/`TripDifficulty`/`TripSeason` (739/752/754), `TripStopId` (701), `createTripStopId` (711), og felt-referanser `activeThemeStory`/`themeStories`/`trails`. ("Collection" finnes IKKE i `lib/types.ts` — den eneste Trail/Collection-typen der er `TrailCollection` (167), knyttet til `trails`; verifiser om den skal trimmes med Trip-stacken.)
  3. **`v2`-wrapperne targeter `v2`-schemaet:** nye/oppdaterte `queries.ts`/`mutations.ts`-funksjoner som board-MVP-stien bruker, peker til `v2` via `.schema('v2')` / `db: { schema: 'v2' }`. Trimming av de gamle legacy-tabell-referansene i `public`-koden er IKKE et baseline-krav — den utføres i cutover/opprydding når `public` decommissioneres (Unit 3). Inntil da kan gammel `public`-rettet kode og nye `v2`-wrappere sameksistere.
  4. **Error-handling (CLAUDE.md-regel fra linje 1):** De nye `v2`-wrapperne bevarer/forbedrer eksplisitt error-handling på hvert Supabase-kall. Det eksisterende mønsteret som svelger feil stille (`queries.ts` returnerer `return []` ved `error || !data`, f.eks. linje 193/217/221) skal IKKE arves uendret inn i `v2`-wrapperne uten minst logging av error — ingen stille swallow.
  5. De nye `v2`-wrapperne kompilerer mot `v2`-typene; board-MVP-stien leser/skriver mot `v2`.
  6. `npx tsc --noEmit` gir 0 feil; `npm run lint` 0 errors; `npm test` passerer.
- **Avhengigheter:** Unit 1, Unit 2

### Unit 7 — Kjør `v2`-baseline via psql + verifikasjon

- **Mål:** Kjør `v2`-baseline mot databasen via psql (IKKE `supabase db push`), eksponer `v2` i Supabase API, og verifiser kolonne-eksistens + RLS mot `v2`. `public` røres ikke, så ingen backup eller datavern. Oppfyller Goal A + Goal F + Goal G.
- **Filer:** `@/docs/rebuild/baseline-migration-runbook.md` (kjøre- og verifikasjons-runbook)
- **Akseptansekriterier:**
  1. Migrasjonen kjøres med `psql` mot pooler-URL (`source .env.local && /opt/homebrew/Cellar/libpq/.../psql "$POOLER_URL" -f supabase/migrations/070_baseline.sql`) — `supabase db push` brukes IKKE (NNN-nummerering inkompatibel). Kjøringen er additiv (`CREATE SCHEMA v2` + `CREATE TABLE v2.*`); `public` berøres ikke.
  2. **`v2`-API-eksponering:** `v2` lagt til i Settings → API → Exposed schemas, og `GRANT USAGE`/tabellrettigheter til `anon`/`authenticated`/`service_role` verifisert (engangs-config, jf. Åpent spørsmål #7). Ingen `pg_dump`-backup og ingen pre/post rad-antall nødvendig — `public` er urørt og er selv fallbacken.
  3. Post-flight kolonne-eksistens-sjekk via REST mot `v2` for hvert kritisk felt, f.eks.:
     `curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/pois?select=trust_flags,entur_stopplace_id,editorial_hook&limit=1" -H "Accept-Profile: v2" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"` returnerer 200 med feltene (`Accept-Profile: v2` targeter `v2`-schemaet).
  4. **Demo-paritet-validering (bonus-test av pipelinen):** Referanse-boardene (Wesseløkka / Stasjonskvartalet / Ranheim) **re-provisjoneres inn i `v2` via PRD 3** (de migreres IKKE fra `public`). At de provisjoneres rent inn i `v2` og rendrer med demo-paritet er samtidig en ende-til-ende-test av at `v2`-skjemaet + RLS + wrappere henger sammen, og er kriteriet som gater det senere `public`-drop-steget (Unit 3).
  5. Verifiser at `v2.events` aksepterer en test-INSERT via service-role REST.
  6. **RLS-røyktest (begge retninger) mot `v2`:** (a) anon-rollen kan IKKE skrive til noen `v2`-tabell og kan IKKE lese non-display-ready `v2.place_knowledge`; (b) service-role (via `createServerClient()` med ekte `SUPABASE_SERVICE_ROLE_KEY` satt) KAN lese non-display-ready `v2.place_knowledge` (admin-lesing fungerer — verifiserer at klient-nøkkel-fixen i Unit 5 holder).
- **Avhengigheter:** Unit 1, 2, 4, 5, 6 (alt `v2`-skjema + typer ferdig før kjøring; Unit 3 er deferred opprydding, ikke en forutsetning)

> **Fullstendighet:** 7 av 7 planlagte units dekket. Ingen sampling — hver av de 24 snapshot-tabellene er eksplisitt klassifisert (13 keeper-skjemaer opprettes ferskt i `v2` via Unit 1/4; 11 legacy markert for deferred, gated `public`-drop via Unit 3) og hver kritisk poi-feltgruppe har en navngitt nedstrøms-konsument.

---

## Goals → Requirements-kobling

| Goal | Leveres av (requirement / unit) |
|---|---|
| **A.** Ett rent baseline-skjema (kanonisk, ferskt i `v2`) som erstatter 69 migrasjoner | Unit 1 (`v2` fersk CREATE) + Unit 7 (kjør mot db) + Unit 3 (gated `public`-drop når validert) |
| **B.** Server-only tilgangskontrakt håndhevet på DB- og app-nivå | Unit 5 (RLS-policies på `v2.*` + klient-nøkkel-kontrakt) |
| **C.** Engasjements-instrumentering fra linje 1 | Unit 2 (`v2.events`-tabell + indekser) |
| **D.** Lokalkunnskap-moat som Placy-eid IP forankret i skjema | Unit 4 (`v2.place_knowledge` + areas + IP-notat) |
| **E.** TypeScript-paritet skjema ↔ applikasjon (`v2`-typer + nye wrappere) | Unit 6 (generér `v2`-typer + `v2`-wrappere + error-handling) |
| **F.** Verifisert mot db (kolonne-eksistens mot `v2`) | Unit 7 (psql-kjøring + REST-verifikasjon mot `v2`) |
| **G.** Legacy intakt til validert; re-seed valgfritt (intet IP-tap) | Unit 4 (`public` urørt som kilde; re-seed valgfritt) + Unit 7 (`v2` additivt; `public` fallback) |

---

## Utviklingsløp (faser)

### Fase 1 — Skjema-forfatning (offline, mot lokal/staging)

- **Mål:** Komplett `070_baseline.sql` (`v2` fersk-CREATE-modell) + ERD + IP-notat, kjørbart mot en lokal/tom Postgres der det oppretter `v2` med alle 14 tabeller rent.
- **Leveranse:** Unit 1, 2, 4 ferdig; migrasjonen kjører rent lokalt med null feil og oppretter `v2`-skjemaet komplett (`public` berøres ikke). (Unit 3 er deferred opprydding og forfattes når demo-paritet er validert.)
- **Autonomi-nivå:** Høy. Rent DDL-arbeid forankret i snapshot; ingen designvalg.

### Fase 2 — Tilgangskontrakt + typeparitet

- **Mål:** RLS-policies på `v2.*` + klient-nøkkel-fix på plass; `v2`-DB-typer generert, `v2`-wrappere/`@/lib/types` skrevet, kompilerer.
- **Leveranse:** Unit 5, 6 ferdig; `npx tsc --noEmit`, `npm run lint`, `npm test` passerer.
- **Autonomi-nivå:** Middels. De nye `v2`-wrapperne targeter et nytt schema og RLS-nøkkel-kontrakten berører `createServerClient`-oppførsel og må testes. (Trimming av gammel `public`-rettet kode er cutover, ikke en del av denne fasen.)

### Fase 3 — `v2`-baseline-kjøring (additiv, reversibel — lav risiko)

- **Mål:** `v2`-baseline kjørt mot databasen via psql, `v2` eksponert i API, alt verifisert mot `v2`.
- **Leveranse:** Unit 7 ferdig; `v2` opprettet additivt (`public` urørt), `v2`-API-eksponering verifisert, REST-verifikasjon mot `v2` grønn, RLS-røyktest grønn (begge retninger), referanse-boardene re-provisjonert inn i `v2` (demo-paritet).
- **Autonomi-nivå:** Middels/høy. Operasjonen er additiv og reversibel (`DROP SCHEMA v2 CASCADE` og kjør på nytt; `public` er intakt) — ingen `xhigh` nødvendig. `/effort high` holder.

> **Senere fase (deferred, gated): `public`-legacy decommission.** Den faktiske høyrisiko-operasjonen — drop av hele `public`-legacy (11 døde + gamle keeper-tabeller) — er Unit 3 og kjøres som et eget, eksplisitt steg FØRST når demo-paritet er validert (kriterium i Åpent spørsmål #8). Da er den irreversibel og krever Andreas' go; foreslå `/effort xhigh` for det stegets egen kjøring. Ikke en del av denne PRD-ens leveranse-løp.

---

## Beslutninger

| # | Beslutning | Begrunnelse |
|---|---|---|
| 1 | Kollaps 69 migrasjoner → ÉN kanonisk baseline (`070_baseline.sql`) | CARRY-OVER-MANIFEST; fjerner akkumulert drift og dødt skjema som lese-kontrakt |
| 2 | Behold 13 keeper-tabell-SKJEMAER med eksakt kolonne-paritet mot snapshot | Nedstrøms-kontrakt; avvik ville brutt 14 PRD-er stille |
| 3 | **Fersk `v2`-schema-baseline, IKKE in-place reconciliation** | Databasen har ingen reell prod-data (kun test-rot); ingenting å verne. Opprett alt ferskt som `CREATE TABLE v2.*` ved siden av `public`; additivt og reversibelt (`DROP SCHEMA v2` ved feil) |
| 4 | Drop 11 legacy (Trip/Guide + scroll-artikkel + collections) — **deferred + gated** | Ingen rebuild-konsument, men droppes først når demo-paritet er validert (sammen med gamle `public`-keeper-tabeller); ikke en del av baseline-kjøringen |
| 5 | BEHOLD `pois.event_*`-kolonner som reference-only (i `v2`-skjemaet) | Event-spor parkert, ikke dødt; å utelate er unødvendig avvik fra snapshot ("implementer riktig", ikke kutt) |
| 6 | `events`-tabell i baseline fra linje 1 (`v2.events`) | Data-moat-grep; board-PRD-er logger uten ny migrasjon |
| 7 | `place_knowledge`-SKJEMA + areas-hierarki forankret som eid IP; system-KODE er dødt | Manifest linje 7 (system cruft) vs 149/735 (skjema-IP keeper); skillet er reelt, ikke selvmotsigelse |
| 8 | **Datavern moot** — `public` står intakt til validert; re-seed inn i `v2` valgfritt | Dataene i `public` er test-rot uten reell verdi, og `public` røres uansett ikke; pre/post rad-antall vernet ingenting reelt |
| 9 | RLS på `v2.*`: skriv kun service-role, `events` INSERT-only, `place_knowledge` anon-les gated på `display_ready` | Håndhever server-only-kontrakten på DB-nivå, ikke bare i app |
| 10 | Fail-fast på manglende `SUPABASE_SERVICE_ROLE_KEY` i server-kontekst (fjern anon-fallback) | Dagens fallback (`client.ts:30`) bryter RLS-skrive/admin-lese STILLE; stille feil er verre enn crash i prototype |
| 11 | Kjør via psql med NNN-nummerering, IKKE `supabase db push` | CLAUDE.md: `db push` inkompatibelt med NNN-format |
| 12 | Verifikasjon mot `v2` via REST kolonne-eksistens (`Accept-Profile: v2`) + RLS-røyktest | "Ferdig betyr ferdig" — baseline ikke ferdig før `v2` er eksponert og verifisert; ingen datavern-rad-antall siden `public` er urørt |
| 13 | Generér `v2`-typer + skriv nye `v2`-wrappere; gammel `public`-kode-trim er cutover | Typeparitet mot `v2`; gammel kode lever mot `public` til legacy decommissioneres — ingen big-bang-sletting i baseline |
| 14 | **`v2`-schema-strategi + gated `public`-drop** (arbeidsnavn `v2`) | Bygg nytt ved siden av legacy; valider demo-paritet før irreversibel decommission; `v2`-navn bekreftes (Åpent spørsmål #6), API-eksponering er engangs-config (#7) |

### Walkthrough-revisjon 2026-06-27

Andreas (eier) besluttet i en walkthrough en strategi-endring som omskriver migrasjons-/risiko-modellen i denne PRD-en. To fakta lå til grunn: (1) det finnes **ingen reell kunde-/prod-data** — alt i databasen er akkumulert test-rot, live kun for testing; (2) strategien er å **gjenbruke samme Supabase-database, men bygge den nye Placy i et eget nytt Postgres-schema (`v2`), parallelt** med `public`-legacy.

Hva endringen erstatter:

- **Migrasjonsmodell:** *in-place reconciliation mot eksisterende populerte keeper-tabeller* → **fersk `CREATE TABLE v2.*` av hele skjemaet i et nytt `v2`-schema**. `public`-legacy røres ikke av baseline-kjøringen.
- **Datavern:** *pre/post rad-antall for å verne Sem & Johnsen-editorial-IP* → **moot**. Dataene var test-rot; `public` står uansett intakt som kilde til validert, og re-seed inn i `v2` er et valgfritt senere steg.
- **Risiko-profil:** *rebuildens høyeste-risiko irreversible operasjon mot ekte prod-data (`/effort xhigh`)* → **lav-risiko, additiv, reversibel** (`DROP SCHEMA v2` ved feil; `public` er fallback). `/effort high` holder for hele PRD-en.
- **Legacy-drop:** *droppet som del av baseline-kjøringen (Unit 3)* → **deferred + gated** på demo-paritet-validering, som rebuildens egentlige decommission-steg (egen migrasjon/PR; `xhigh` for den kjøringen).

Skjema-innholdet (de 13 tabellenes kolonne-kontrakter, `events`-skjemaet, `pois`-53-kol-gruppering, RLS-designet, nedstrøms-kontrakt-kartet, type-paritet) er **uendret** — det er kun migrasjons-, data-vern- og risiko-strategien som er revidert.

---

## Scope Boundaries

Denne PRD-en dekker: baseline-skjemaet opprettet ferskt i `v2` (13 keeper-skjemaer + `events`), `v2`-API-eksponering, RLS-tilgangskontrakten på `v2.*` + klient-nøkkel-kontrakten, lokalkunnskap-moat-*skjemaet* i `v2`, `v2`-type-generering + nye `v2`-wrappere, og `v2`-baseline-kjøring + verifikasjon. Den PLANLEGGER (men kjører ikke) det gated `public`-legacy-drop-steget.

Denne PRD-en dekker IKKE (trekkes via kontrakt-kartet):

- **Tier capability-manifest-typen** (`reportTier` zod-literal, capability-felt, `report-defaults.ts`-taksonomi) — eies av **PRD 2 (prd-tier-capability-manifest)**. Baseline leverer kun bæreren (`products.config` jsonb, `projects.has_3d_addon`).
- **Render-gating på tier** — eksisterer ikke og skal ikke bygges (verifisert ingen `reportTier`-ref i render-laget). Tier er deklarasjon+validering (PRD 2).
- **Event-logging-logikken** (server-actions som skriver til `events`, aggregering, dashboards, samtykke-håndtering, `session_id`-generering) — eies av **PRD 13 (prd-instrumentering)**. Baseline leverer kun tabellen.
- **Moat-gating, editorial-arv og place_knowledge-SYSTEM-kode** (`inherit-area-editorial`, `find-area-for-point`, area-staging, curate-area, `@/app/admin/knowledge`) — eies av **PRD 8 (prd-lokalkunnskap-moat)**. Baseline leverer kun skjemaet + verner dataene.
- **Trust-scoring-logikk** og Google Places-berikelse — eies av **PRD 4 (prd-trust-google-places)**. Baseline leverer kun feltene.

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|---|---|
| Server-action event-logging + aggregering + samtykke-håndtering + `session_id`-kilde | **PRD 13 (prd-instrumentering)** — prototypes tidlig/serielt etter denne PRD-en |
| Tier-manifest-typer + `report-defaults.ts` taksonomi | **PRD 2 (prd-tier-capability-manifest)** |
| Moat write-tooling + system-kode (`curate-area`, boundary-uttrekk, area-seed ~25 strøk, forlatt admin/knowledge-opprydding) | **PRD 8 (prd-lokalkunnskap-moat)** |
| Trust/Google-berikelses-pipeline | **PRD 4 (prd-trust-google-places)** |
| **Drop `public`-legacy (gated på demo-paritet-validering)** — rebuildens egentlige decommission-steg | **Unit 3** (egen senere migrasjon/PR) — kjøres FØRST når `v2` er bevist via re-provisjonerte referanse-boards; fjerner både de 11 døde og de gamle `public`-keeper-tabellene |
| Re-seed av evt. verdifullt kuratert `public`-innhold inn i `v2` (valgfritt) | Egen valgfri task hvis noe i `public` viser seg verdt å beholde; default er ferskt `v2` |
| Migrasjon-arkivering av de 69 gamle filene (oppryddingstask) | Egen oppryddings-PR etter at `v2`-baseline er verifisert (Fase 3) |
| Trimming av gammel `public`-rettet `queries.ts`/`mutations.ts`-kode (54 legacy-refs) | Cutover/opprydding sammen med `public`-legacy-drop (Unit 3) — gammel kode lever mot `public` til da |
| `events`-retensjon/partisjonering | **PRD 13** — utsatt til volum tilsier det (prototype-stadium, ikke over-engineer) |

---

## Åpne spørsmål

1. **`events`-retensjon/partisjonering:** Default: ingen partisjonering nå (prototype-stadium) — avklar med PRD 13. (Flyttet til Deferred over som ikke-blokkerende.)
2. **FK-constraints vs snapshot-konvensjon:** Snapshot viser FK-løse text-koblinger (f.eks. `pois.area_id` uten erklært FK). `v2`-baseline speiler dagens FK-løse konvensjon for keeper-tabeller. Vurder FK kun for nye `events`-koblinger. (FK-avklaringen for det fremtidige `public`-drop-steget ligger i Unit 3 AC3.)
3. **Anon-lesetilgang granularitet:** `generation_requests` inneholder e-post + consent ⇒ service-role-only (ikke anon-lesbar) i `v2`-RLS. Default landet; bekreft at ingen annen keeper-tabell har PII som krever samme behandling.
4. **~~Backup-mekanisme før prod-kjøring:~~ MOOT** — `v2`-opprettelsen er additiv og rører ikke `public`, så `public` er selv fallbacken og ingen `pg_dump`-backup kreves for baseline-kjøringen. (Backup blir relevant igjen først ved det gated `public`-drop-steget, Unit 3.)
5. **`events.session_id`-kilde:** Genereres server-side eller klient-side (cookie)? Berører PRD 13s server-action-design — flagges, ikke løses her (Deferred til PRD 13).
6. **Eksakt `v2`-schema-navn:** Arbeidsnavn `v2` brukt gjennomgående. Bekreft endelig navn før kjøring (alternativer: `placy_v2`, `rebuild`, e.l.). Navnet er et valg, ikke et krav.
7. **`v2`-API-eksponering i Supabase (engangs-config):** `v2` må legges til i Settings → API → Exposed schemas, og `GRANT USAGE`/tabellrettigheter til `anon`/`authenticated`/`service_role` må settes, før PostgREST/`supabase-js` kan nå `v2`. Avklar om dette gjøres via dashboard, DDL i migrasjonen, eller begge (Unit 7 AC2).
8. **Kriteriet for «demo-paritet validert» (gater `public`-drop):** Hva må være sant før `public`-legacy decommissioneres (Unit 3)? Default-forslag: de tre referanse-boardene (Wesseløkka / Stasjonskvartalet / Ranheim) re-provisjonert rent inn i `v2` og rendrer med demo-paritet mot dagens demo. Bekreft eksakt aksept-kriterium + Andreas' go-punkt.

---

## Avhengigheter (PRD-graf)

```
                 [ INGEN ]
                     |
                     v
        PRD 1 — prd-datamodell-supabase   (DENNE — fundament-rot)
                     |
   +-----------------+------------------+--------------------+
   v                 v                  v                    v
PRD 2            PRD 13            PRD 3 / 4            PRD 5 / 8 / 11
nivå-modell      instrumentering   provisjon/trust     board-data/moat/transport
   |             (tidlig+serielt)        |                    |
   +-----------------+------------------+--------------------+
                     v
            (alle 14 øvrige PRD-er)
```

**Blokkeres av:** ingen. Bygges først.
**Blokkerer:** ALLE 14 øvrige PRD-er. PRD 2 og PRD 13 starter umiddelbart etter denne; PRD 13 (instrumentering) kjøres tidlig og serielt fordi server-action-loggen vokser inn i board-PRD-ene (5, 9) og må logge mot `events`-tabellen denne PRD-en leverer.
