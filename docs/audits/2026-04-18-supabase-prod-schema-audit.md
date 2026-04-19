# Supabase Prod-Schema Audit for Report-produktet

**Dato:** 2026-04-18
**Kontekst:** Beslutning om å bygge Report som standalone prod-produkt i greenfield-miljø. Sandbox (placy-ralph) beholdes som playground. Dette dokumentet kartlegger hva Report faktisk trenger fra Supabase, og foreslår et rent prod-schema.

---

## TL;DR

Sandbox-basen har **19 aktive tabeller + 2 legacy-artifakter + 1 ubrukt view**, akkumulert gjennom 66 migrasjoner. Report-produktet bruker bare **10 av disse tabellene (Report-kjerne)** — resten er Explorer/Guide/Story/Trips/self-serve-demo som tilhører andre produkter.

**Dead weight:**
- **9 tabeller** som Report aldri leser (trips, collections, generation_requests, etc.)
- **24 seed-migrasjoner** med prosjekt-spesifikk editorial copy (hører i data, ikke schema)
- **~15 kolonner** spredt over `pois`, `projects`, `products` som Report pipeline hverken skriver eller leser (story_*, event_*, category_override_id)
- **2 parallelle strukturer for tema-tekster** — legacy `theme_stories`/`story_sections` (tom for nye prosjekter) vs. ny `products.config.reportConfig` (faktisk brukt)

**Forslag:** Clean prod-schema med **10 tabeller** som støtter Report + /generate-rapport-pipelinen. POI-IPen (editorial_hooks, local_insights, tiers, place_knowledge) migreres selektivt. Estimert initial migrasjon er **én SQL-fil** for DDL + **et data-export/import-script** for POI-IP.

---

## Metodikk

Tre parallelle audits:

1. **Schema-enumerering** — Alle 66 migrasjoner i `supabase/migrations/` gjennomgått. Produkt: komplett katalog over nåværende tabeller, kolonner, constraints, indexes, RLS, triggers.
2. **Report-lesing** — Hver Supabase-query i `components/variants/report/`, `lib/supabase/queries.ts`, `app/eiendom/**` spores fra `.from()` til UI-render. Produkt: liste over kolonner som faktisk rendres.
3. **Report-skriving** — Hver skrive-operasjon fra `.claude/skills/generate-rapport/`, `.claude/skills/placy-illustrations/`, `/generate-bolig` og relaterte API-er. Produkt: liste over kolonner pipelinen populerer.

Agentrapportene er bevart som kilder; dette dokumentet er syntesen.

---

## Nåværende schema (sandbox)

### 19 aktive tabeller

| # | Tabell | Opprettet i | Formål | Report bruker? |
|---|--------|-------------|--------|----------------|
| 1 | `customers` | 001 | Tenant-root | ✅ Read |
| 2 | `projects` | 006 | Prosjekt-container | ✅ Read + Write |
| 3 | `products` | 006 | Produkt-instans (Report/Explorer/Guide) | ✅ Read + Write |
| 4 | `pois` | 001 | Point of Interest (delt POI-pool) | ✅ Read + Write |
| 5 | `categories` | 001 | POI-kategorier (ikon, farge) | ✅ Read |
| 6 | `project_pois` | 006 | POI-pool per prosjekt | ✅ Read + Write |
| 7 | `product_pois` | 006 | POI-utvalg per produkt (featured) | ✅ Read + Write |
| 8 | `product_categories` | 006 | Kategori-visning per produkt | ✅ Read + Write |
| 9 | `translations` | 010 | EN-oversettelser | ✅ Read + Write |
| 10 | `areas` | 018 | Geografisk hierarki (city/bydel/strøk) | ✅ Read (kun pipeline) |
| 11 | `project_categories` | 005 | Kategori-override per prosjekt | ❌ DEAD — obsolete fra 005 |
| 12 | `collections` | 003 | Shopping/wishlist-feature | ❌ Ikke Report |
| 13 | `category_slugs` | 018 | SEO-slugs for Explorer public pages | ❌ Ikke Report |
| 14 | `trips` | 016 | Guide-produktets turer | ❌ Guide-produkt |
| 15 | `trip_stops` | 016 | Guide turpunkter | ❌ Guide-produkt |
| 16 | `project_trips` | 016 | Prosjekt→tur-kobling | ❌ Guide-produkt |
| 17 | `place_knowledge` | 038 | Verifiserte fakta om områder | ⚠️ Pipeline-research, ikke UI |
| 18 | `generation_requests` | 046 | Selvbetjent megler-demo | ❌ Demo-only |
| 19 | `theme_stories` | 001 | Legacy tema-tekster (fallback) | ⚠️ Legacy — tom for nye prosjekter |
| + | `theme_story_sections` | 001 | Legacy undertekster | ⚠️ Legacy |
| + | `theme_section_pois` | 001 | Legacy POI→seksjon-kobling | ⚠️ Legacy |
| + | `story_sections` | 001 | Legacy generiske seksjoner | ⚠️ Legacy |
| + | `section_pois` | 001 | Legacy POI→seksjon-kobling | ⚠️ Legacy |

### Legacy-artifakter (aldri droppet)

- `projects_legacy` — omdøpt fra `projects` i 006, data migrert, aldri slettet
- `project_pois_legacy` — samme skjebne
- `project_pois_with_resolved_category` (VIEW) — opprettet i 005, aldri brukt, aldri droppet

### 66 migrasjoner, fordeling

- **~43 DDL-migrasjoner** (schema-endringer)
- **~24 rene seed-migrasjoner** (INSERT/UPDATE av editorial copy for Scandic, Wesselsløkka, kaféer, bakerier, Coachella, etc.)
- **2 duplikat-nummereringer** (041a/041b, 042a/042b, 044a/044b, 048a/048b)

---

## Report-lesing: hva rendres faktisk

### 10 tabeller brukt av Report-UI + pipeline

| Tabell | Kolonner faktisk lest | Merknader |
|--------|----------------------|-----------|
| `customers` | `id` | Kun validering av customer-slug |
| `projects` | `id`, `name`, `url_slug`, `center_lat`, `center_lng`, `customer_id`, `venue_type`, `tags`, `theme`, `description`, `welcome_*`, `homepage_url`, `has_3d_addon`, `default_product`, `version`, timestamps | |
| `products` | `id`, `project_id`, `product_type`, `config` (JSONB — kun `reportConfig`-key brukt), `story_title` (fallback for rapportnavn), version, timestamps | `story_intro_text`, `story_hero_images` select'ed men ikke brukt av Report |
| `pois` | `id`, `name`, `lat/lng`, `address`, `category_id`, `description`, `featured_image`, `google_place_id`, `google_rating`, `google_review_count`, `google_maps_url`, `editorial_hook`, `local_insight`, `entur_stopplace_id`, `bysykkel_station_id`, `hyre_station_id`, `trust_score`, `poi_tier`, `is_local_gem`, `poi_metadata`, `parent_poi_id`, `facebook_url` | 6 event-kolonner + `opening_hours_json` + `google_phone` + `osm_id`/`nsr_id`/`barnehagefakta_id` select'ed men ikke brukt |
| `categories` | `id`, `name`, `icon`, `color` | |
| `project_pois` | `project_id`, `poi_id` | Link-tabell |
| `product_pois` | `product_id`, `poi_id`, `sort_order`, `featured` | `sort_order` brukes for sortering, men pipeline skriver det ikke → default 0 for alle |
| `product_categories` | `product_id`, `category_id`, `display_order` | Fallback-ordering hvis `config.themes` mangler |
| `translations` | `locale='en'`, `entity_type` ∈ {poi, theme, product}, `entity_id`, `field`, `value` | |
| `areas` | Lest av `/generate-rapport` pipeline for strøk-kontekst. Report-UI leser ikke direkte. | |

### Legacy tema-tekst-struktur — lest men tom for nye prosjekter

Report-UI'en leser fortsatt `theme_stories`, `theme_story_sections`, `theme_section_pois`, `story_sections`, `section_pois`. For Wesselsløkka/Stasjonskvartalet (nye prosjekter via `/generate-rapport`) er disse tabellene **tomme** — tekstene lever i `products.config.reportConfig`. For gamle prosjekter (Scandic Nidelven) leser UI'en fortsatt her.

**Konklusjon:** Dette er dobbel struktur. Prod-schema bør standardisere på én — `products.config.reportConfig`.

---

## Report-skriving: hva pipelinen populerer

### 7 tabeller som `/generate-bolig` + `/generate-rapport` + `/placy-illustrations` skriver til

| Tabell | Operasjon | Kolonner skrevet | Fra hvilket steg |
|--------|-----------|------------------|------------------|
| `projects` | INSERT (1×) | id, customer_id, name, url_slug, center_lat/lng, short_id, venue_type, area_id, discovery_circles, has_3d_addon, venue_context | Steg 2b |
| `products` | INSERT (1×) | id, project_id, product_type='report', config | Steg 2c |
| `products` | PATCH (2×) | config.reportConfig (heroIntro, motiver, themes[].bridgeText/extendedBridgeText/readMoreQuery), config.reportConfig.heroImage | Steg 8a + 8b |
| `pois` | INSERT/UPSERT (~30-150) | name, lat/lng, address, category_id, google_*, editorial_hook, local_insight, source, nsr_id, barnehagefakta_id, osm_id | Steg 3a-3f |
| `pois` | PATCH | editorial_hook, local_insight (via Steg 3b-4, Steg 7), area_id (Steg 3g), poi_metadata | Spredt |
| `project_pois` | INSERT/DELETE | Link under discovery, unlink under filtering | Steg 3-4 |
| `product_pois` | UPSERT + PATCH | product_id, poi_id, featured (default false → true for top-3-per-kategori) | Steg 5a-5b |
| `product_categories` | DELETE+INSERT | product_id, category_id, display_order | Steg 5c |
| `translations` | UPSERT | locale='en', entity_type, entity_id, field, value | Steg 3b-4, 7, 8a |

### Kolonner Report leser, men pipeline aldri skriver

- `product_pois.sort_order` — default 0 for alle. UI sorterer på dette? Uklart hvor verdi kommer fra.
- `pois.poi_tier` — legacy trust-scoring-script har skrevet dette. Pipeline forvalter det ikke.
- `pois.is_chain`, `is_local_gem`, `tier_reason` — samme, legacy tier-system.
- `projects.theme`, `welcome_*`, `homepage_url` — satt manuelt via admin-UI, ikke pipeline.

### Kolonner pipeline skriver, men Report aldri leser

Ingen identifisert — pipelinen er disiplinert på dette punktet.

---

## Delta: Dead weight vs. Report-kjerne

### Tabeller som droppes i prod-schema

| Tabell | Hvorfor | Notat |
|--------|---------|-------|
| `project_categories` | Obsolete fra 005, erstattet av 006 | VIEW `project_pois_with_resolved_category` følger med |
| `collections` | Shopping-feature, ikke Report | |
| `category_slugs` | SEO-slugs for Explorer public pages | Report har ingen SEO-slugger på kategori-nivå |
| `trips`, `trip_stops`, `project_trips` | Guide-produkt | |
| `generation_requests` | Selvbetjent megler-demo | Hører i sandbox, ikke prod |
| `theme_stories`, `theme_story_sections`, `theme_section_pois` | Legacy tema-tekst-struktur | Erstattet av `products.config.reportConfig` |
| `story_sections`, `section_pois` | Legacy generisk struktur | Samme |
| `projects_legacy`, `project_pois_legacy` | Migrasjons-artifakter | |

**Totalt:** 11 tabeller droppes. Prod får **10 tabeller** (vs. 19 i sandbox).

### Kolonner som droppes fra kjernetabeller

**`pois`** (dropper ~15 kolonner):
- `story_priority` — legacy Story
- `hyre_station_id` — mobility-feature, ikke Report
- `opening_hours_json`, `google_phone`, `opening_hours_updated_at` — Explorer-bruk, ikke Report
- `event_dates`, `event_time_start`, `event_time_end`, `event_description`, `event_url`, `event_tags` — event-feature (Coachella-demo)
- `gallery_images` — ikke lest av Report
- `editorial_sources` — select'ed men ikke rendret
- `anchor_summary` — lagt til i 056, aldri implementert i UI

**`pois`** (beholdes, men usikker):
- `osm_id`, `nsr_id`, `barnehagefakta_id`, `source` — pipeline bruker for dedupe under re-import. **Behold.**
- `trust_score`, `trust_flags`, `trust_score_updated_at` — brukes av pipeline for kvalitets-filtrering. **Behold.**
- `facebook_url` — Report leser. **Behold.**
- `parent_poi_id`, `anchor_summary` — parent-child (Valentinlyst-senter). Report bruker `parent_poi_id` for filtrering. **Behold parent_poi_id, drop anchor_summary.**
- `photo_resolved_at` — caching-artefakt. **Drop — løses per request.**
- `photo_reference` — select'ed men ikke brukt av Report (erstattet av `featured_image`). **Drop.**

**`projects`** (dropper ~5 kolonner):
- `story_title`, `story_intro_text`, `story_hero_images` — legacy Story
- `product_type` — legacy fra 004 (før 006-hierarkiet). `products.product_type` er kanonisk.
- `default_product` — kun én produkttype i prod (report). Redundant.
- `discovery_circles` — pipeline bruker, UI leser ikke. **Drop eller behold for re-discovery?** Forslag: drop, re-compute ved behov.

**`products`** (dropper 3 kolonner):
- `story_title` — Report bruker dette som fallback for rapportnavn. Refactor Report til å bruke `projects.name` istedet.
- `story_intro_text`, `story_hero_images` — ikke brukt av Report.

**`product_pois`** (dropper 1 kolonne):
- `category_override_id` — aldri skrevet, aldri lest. DEAD.
- `sort_order` — behold, men pipeline må populere. Eller erstatt med tier-basert ordering.

### Seed-data-migrasjoner (24 stk) som ikke skal med

Disse er prosjekt-spesifikk editorial copy — hører i export/import av POI-IP, ikke i prod-schema-migrasjonen:
- 020-031 (kafé/bakeri/restaurant/museum editorial)
- 028, 030-031 (Scandic bridgeTexts og kategori-descriptions)
- 037 (Scandic project_trips)
- 039 (place_knowledge seed for Trondheim)
- 049 (Brøset bridge_text)
- 051-055 (transport/AI-links narrative-UPDATEs)
- 057-060 (Valentinlyst/Wesselsløkka parent_pois + Coachella demo)
- 062-064 (Wesselsløkka marketing copy)

---

## Foreslått prod-schema

### Kjerneprinsipper

1. **10 tabeller** — Report-only, ingen Explorer/Guide/Story/Trips-komplikasjoner
2. **Én canonical struktur for tema-tekster** — `products.config.reportConfig` JSONB. Ingen `theme_stories`-fallback.
3. **Flat `products.product_type`** — fortsatt felt, for fremtidig utvidelse (Guide/Explorer i separate prod-instanser, eller multi-produkt senere), men default 'report'.
4. **Én migrasjon** — DDL i `001_prod_schema.sql`. Data kommer via import-script, ikke migrasjoner.
5. **RLS fra dag én** — public read på alt Report-UI trenger, service role for pipeline writes.

### Tabellsammendrag

```
customers          (id, name, created_at)
projects           (id, customer_id, name, url_slug, center_lat, center_lng,
                    short_id, venue_type, venue_context, area_id, has_3d_addon,
                    tags, theme, welcome_*, homepage_url, description,
                    version, timestamps)
products           (id, project_id, product_type='report', config JSONB,
                    version, timestamps)
pois               (id, name, lat, lng, address, category_id, area_id,
                    google_place_id, google_rating, google_review_count,
                    google_maps_url, google_website, google_business_status,
                    google_price_level, featured_image, editorial_hook,
                    local_insight, description,
                    poi_tier, is_chain, is_local_gem, poi_metadata,
                    tier_reason, tier_evaluated_at,
                    trust_score, trust_flags, trust_score_updated_at,
                    entur_stopplace_id, bysykkel_station_id, facebook_url,
                    parent_poi_id, source, nsr_id, barnehagefakta_id, osm_id,
                    timestamps)
categories         (id, name, icon, color, created_at)
project_pois       (project_id, poi_id, sort_order, PK)
product_pois       (product_id, poi_id, featured, PK)
product_categories (product_id, category_id, display_order, PK)
translations       (id, locale, entity_type, entity_id, field, value,
                    UNIQUE(locale,entity_type,entity_id,field))
areas              (id, name_no, name_en, slug_no, slug_en,
                    center_lat, center_lng, zoom_level, active,
                    parent_id, level, boundary, postal_codes)
```

### Beslutninger som må tas før DDL skrives

1. **Behold `sort_order` på `product_pois`?** Hvis ja: pipeline må populere. Hvis nei: UI må sortere på `poi_tier` + `featured`.
2. **Behold `trust_*`-feltene?** De brukes av pipeline for filtrering. Alternativet er å flytte til ekstern metadata-tabell (ikke på POI), men det kompliserer queries. Forslag: behold på `pois`.
3. **Behold `poi_tier`-systemet?** Det er reell IP. Forslag: behold, men regenerér tier-evalueringer via /generate-rapport-pipelinen heller enn legacy tier-script.
4. **`place_knowledge` inn eller ut?** Tabellen leses ikke av Report-UI, kun av `/generate-rapport` under research. Forslag: behold — det er POI-IP.
5. **Engelsk oversettelse scope:** Skal prod støtte EN fra dag én, eller droppe translations inntil etterspørsel? Forslag: behold translations-tabellen, men ikke populér i MVP.

---

## Migrasjonsstrategi — POI-IP fra sandbox til prod

### Steg 1: Nytt Supabase-prosjekt
- Ny prosjekt i Supabase Dashboard (separat fra sandbox)
- Kjør én konsolidert DDL-migrasjon (`supabase/migrations/001_prod_schema.sql`)
- Aktiver RLS + policies

### Steg 2: Export fra sandbox
Data-export er selektiv — kun POI-IP som er verdifull:

```sql
-- Kjerne-data som migreres
COPY customers TO '/tmp/customers.csv';
COPY categories TO '/tmp/categories.csv';
COPY areas TO '/tmp/areas.csv';

-- POIs med bare kolonnene som lever i prod
COPY (
  SELECT id, name, lat, lng, address, category_id, area_id,
         google_place_id, google_rating, google_review_count, google_maps_url,
         google_website, google_business_status, google_price_level,
         featured_image, editorial_hook, local_insight, description,
         poi_tier, is_chain, is_local_gem, poi_metadata,
         tier_reason, tier_evaluated_at,
         trust_score, trust_flags, trust_score_updated_at,
         entur_stopplace_id, bysykkel_station_id, facebook_url,
         parent_poi_id, source, nsr_id, barnehagefakta_id, osm_id,
         created_at, updated_at
  FROM pois
  WHERE editorial_hook IS NOT NULL  -- kun POIs med faktisk IP-innhold
     OR poi_tier = 1                -- pluss topp-rangerte
) TO '/tmp/pois.csv';

-- place_knowledge for områder vi bruker
COPY place_knowledge TO '/tmp/place_knowledge.csv';
```

### Steg 3: Import til prod
- `psql prod-url -c "\\copy ..."` for hver fil
- Validering: row count sandbox vs. prod, spot-check editorial_hooks

### Steg 4: Generere Report-produkter på nytt
- For hvert demo-prosjekt (Wesselsløkka, Stasjonskvartalet):
  - Opprett `projects`-rad manuelt
  - Opprett `products`-rad med `product_type='report'`, tom `config`
  - Kjør `/generate-rapport` for å populere `config.reportConfig`
  - Kjør `/placy-illustrations` for hero-bilde
- Verifiser at Report rendrer korrekt

### Steg 5: Greenfield Next.js-repo
Parallelt med Supabase-migrasjonen:
- Nytt repo med minimal Next.js 14 + Tailwind setup
- Kopier kun Report-kjerne:
  - `components/variants/report/` (alle filer)
  - `components/map/` (selektivt — bare Report-brukt: MapView3D, ProjectSitePin, UnifiedMapModal, Marker3DPin, Map3DControls, Map3DFallback, ReportMapDrawer, MapPopupCard)
  - `lib/types.ts` (rydd — dropp Explorer/Guide-typer)
  - `lib/supabase/` (rensk — fjern Explorer/Guide-queries)
  - `lib/utils/` (selektivt)
  - Skills: `.claude/skills/generate-rapport/`, `.claude/skills/placy-illustrations/`, `.claude/skills/curator/`
  - Kommandoer: Ingen gamle generate-bolig/adresse/naering/hotel — bygg opp nytt fra /generate-rapport
- Ingen admin-routes, ingen (public), ingen [area], ingen trips, ingen for/event/kart

### Steg 6: Domeneoverføring
- placy.no → prod-deploy via Vercel
- Sandbox flyttes til sandbox.placy.no eller lignende

---

## Estimater (løse)

Med agenter som executor:
- **Audit (dette dokumentet):** ~5 min
- **DDL-fil + RLS-policies:** ~30 min agent-tid
- **Export/import-script:** ~30 min
- **Greenfield Next.js-setup + kopiering av Report-kode:** ~1-2 timer agent-tid
- **Verifisering (rendre Wesselsløkka i prod):** ~1 time
- **Total:** Lørdagsarbeid, som du sa.

Det som IKKE er agent-arbeid og krever deg:
- Beslutninger over (sort_order, trust_*, translations-scope)
- Supabase Dashboard-setup
- Vercel-deploy + DNS-bytte
- Verifisering av editorial_hooks etter import

---

## Beslutninger (2026-04-18)

1. **`product_pois.sort_order`** → **Beholdt.** Pipeline populerer via formel-score (rating × log₂(reviews)) + gangavstand. Erstatter tier-basert sortering.
2. **Trust-score-feltene** → **Beholdt.** Pipelinen bruker dem til å filtrere søppel før tekst-generering.
3. **`poi_tier`-systemet** → **DROPPET.** Tier var bygd for Explorer (turisme-kontekst, "lokal perle vs. kjede"). For Report-målgruppen (boligkjøpere) er nærhet + kvalitets-proxy mer relevant. Dropper kolonnene `poi_tier`, `is_chain`, `is_local_gem`, `tier_reason`, `tier_evaluated_at`. Pipeline Steg 5b omdefineres til å bruke formel-score.
4. **`place_knowledge`** → **Beholdt.** Kjernebrukt av `/generate-rapport` for triangulering. Er reell POI-IP.
5. **Translations** → **DROPPET fra MVP.** Legges til ved etterspørsel.

**Endelig tabell-telling:** 10 tabeller (customers, areas, categories, projects, products, pois, project_pois, product_pois, product_categories, place_knowledge).

---

## Leveranse

- **`docs/audits/2026-04-18-prod-schema.sql`** — konsolidert DDL for prod-Supabase. Én fil, alle 10 tabeller, RLS + policies, triggers, indexes.

## Neste steg

1. Opprette nytt Supabase-prosjekt (Dashboard-jobb)
2. Kjøre `2026-04-18-prod-schema.sql` mot det
3. Skrive export/import-script for POI-IP (editorial_hooks, place_knowledge, categories, areas)
4. Greenfield Next.js-repo parallelt
5. Regenerere Wesselsløkka + Stasjonskvartalet via `/generate-rapport` i prod
6. Validere visuelt
