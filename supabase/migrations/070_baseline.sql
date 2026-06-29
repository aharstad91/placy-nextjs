-- ============================================================================
-- 070_baseline.sql — Placy v2 kanonisk baseline-skjema
-- ============================================================================
-- Sommer-rebuild 2026 · PRD 1 (prd-datamodell-supabase) · Units 01.1 + 01.2 + 01.5
--
-- Dette er den KANONISKE, AUTORITATIVE DDL-en som erstatter 69 inkrementelle
-- migrasjoner (001–069) som lese-/forståelses-kontrakt. Den oppretter hele det
-- nye skjemaet FERSKT i et eget Postgres-schema `v2`, ved siden av `public`.
--
-- OPERASJONSMODELL (additiv, lav-risiko, reversibel — se PRD 1 §Migrasjonsmekanikk):
--   • `public`-legacy RØRES IKKE av denne filen (ingen ALTER, ingen DROP).
--     `public` er akkumulert test-rot uten reell prod-data og står urørt som
--     fallback. Drop av `public`-legacy er et SEPARAT, gated decommission-steg
--     (PRD 1 Unit 3) som kjøres FØRST når demo-paritet er validert.
--   • Reversibelt: er noe galt → `DROP SCHEMA v2 CASCADE` og kjør på nytt.
--   • Kjøres via psql mot pooler-URL, IKKE `supabase db push` (NNN-format
--     inkompatibelt) — se PRD 1 Unit 7 + runbook. `/effort high` holder.
--
-- KOLONNE-KONTRAKT: Kolonnenavn, -antall og NOT NULL er EKSAKT fra
--   docs/rebuild/prod-schema-snapshot.txt (introspeksjon 2026-06-26). 13 keeper-
--   tabeller, 168 kolonner totalt. Avvik ville brutt 14 nedstrøms-PRD-er stille.
--
-- BESLUTNINGER UTOVER SNAPSHOT (snapshot bærer kun navn/type/null — disse er
-- kanoniske valg for et reelt, brukbart skjema; ingen påvirker kolonne-/NN-paritet):
--   • PRIMÆRNØKLER: naturlige nøkler — `id` for entitetstabeller, komposite
--     (de to text-koblings-kolonnene) for join-tabeller, (category_id, locale)
--     for category_slugs.
--   • FK-LØST: snapshot bruker FK-løse text-koblinger (f.eks. pois.area_id uten
--     erklært FK). `v2` speiler dette — INGEN FOREIGN KEY-constraints på keeper-
--     tabeller (PRD 1 Åpent spm #2 + Beslutning). FK vurderes kun for `events`.
--   • ARRAY-ELEMENTTYPE: snapshotens «ARRAY» → `text[]` (alle er string-lister:
--     postal_codes, editorial_sources, trust_flags, gallery_images, event_dates,
--     event_tags, story_hero_images, tags).
--   • DEFAULTS: created_at/updated_at → now(); uuid-PK (generation_requests.id,
--     translations.id) → gen_random_uuid(); pois.trust_flags → '{}'::text[] (så
--     PRD 3-provisjon kan opprette POI før PRD 4 scorer trust); projects.has_3d_addon
--     → false (PRD 3 overstyrer via CLI-input).
--   • UNIQUE: category_slugs(locale, slug) [rute-oppslag] + translations(locale,
--     entity_type, entity_id, field) [i18n upsert-nøkkel, PRD 5] — load-bearing.
--
-- FILEN ER KOMPLETT (Units 01.1 schema + 01.2 events + 01.5 RLS/GRANT, nederst).
-- Neste steg er IKKE en filendring: PRD 1 Unit 7 / bead r01.7 KJØRER denne filen
-- mot Supabase-prod via psql (additivt, men irreversibelt mot prod → /effort xhigh).
--
-- ERD: docs/rebuild/baseline-erd.md (mermaid — 13 tabeller + events).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS v2;


-- ---------------------------------------------------------------------------
-- customers (3) — kunde-eier av prosjekter; `intern` er reservert default-nøkkel
--                 for no-customer-provisjon (PRD 1 note #12c; seedes av provisjon)
-- ---------------------------------------------------------------------------
CREATE TABLE v2.customers (
  id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);


-- ---------------------------------------------------------------------------
-- categories (5) — delt POI-taksonomi
-- ---------------------------------------------------------------------------
CREATE TABLE v2.categories (
  id text NOT NULL,
  name text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);


-- ---------------------------------------------------------------------------
-- category_slugs (6) — lokaliserte SEO-slugs per kategori
-- ---------------------------------------------------------------------------
CREATE TABLE v2.category_slugs (
  category_id text NOT NULL,
  locale text NOT NULL,
  slug text NOT NULL,
  seo_title text,
  seo_description text,
  intro_text text,
  PRIMARY KEY (category_id, locale),
  UNIQUE (locale, slug)
);


-- ---------------------------------------------------------------------------
-- areas (17) — geo-hierarki (city→bydel→strøk) + moat-editorial (PRD 8)
-- ---------------------------------------------------------------------------
CREATE TABLE v2.areas (
  id text NOT NULL,
  name_no text NOT NULL,
  name_en text NOT NULL,
  slug_no text NOT NULL,
  slug_en text NOT NULL,
  description_no text,
  description_en text,
  center_lat numeric NOT NULL,
  center_lng numeric NOT NULL,
  zoom_level integer,
  active boolean,
  created_at timestamptz DEFAULT now(),
  parent_id text,
  level text NOT NULL,
  boundary jsonb,
  postal_codes text[],
  report_editorial jsonb,
  PRIMARY KEY (id)
);


-- ---------------------------------------------------------------------------
-- projects (22) — board/prosjekt; has_3d_addon NN (tier/addon-kontrakt, PRD 2)
-- ---------------------------------------------------------------------------
CREATE TABLE v2.projects (
  id text NOT NULL,
  customer_id text NOT NULL,
  name text NOT NULL,
  url_slug text NOT NULL,
  center_lat numeric NOT NULL,
  center_lng numeric NOT NULL,
  description text,
  version integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  short_id text NOT NULL,
  venue_type text,
  discovery_circles jsonb,
  welcome_tagline text,
  default_product text NOT NULL,
  welcome_image text,
  welcome_title text,
  tags text[],
  theme jsonb,
  homepage_url text,
  has_3d_addon boolean DEFAULT false NOT NULL,
  venue_context text,
  PRIMARY KEY (id)
);


-- ---------------------------------------------------------------------------
-- products (10) — produkt/board-instans; config jsonb NN (tier-manifest-bærer, PRD 2)
-- ---------------------------------------------------------------------------
CREATE TABLE v2.products (
  id text NOT NULL,
  project_id text NOT NULL,
  product_type text NOT NULL,
  config jsonb NOT NULL,
  story_title text,
  story_intro_text text,
  story_hero_images text[],
  version integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);


-- ---------------------------------------------------------------------------
-- pois (53) — kritisk nedstrøms-kontrakt; trust_flags NN (PRD 4)
--   event_*-kolonnene (46–51) beholdes reference-only (event-spor parkert, PRD 1 Besl. 5)
-- ---------------------------------------------------------------------------
CREATE TABLE v2.pois (
  id text NOT NULL,
  name text NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  address text,
  category_id text,
  google_place_id text,
  google_rating numeric,
  google_review_count integer,
  google_maps_url text,
  photo_reference text,
  editorial_hook text,
  local_insight text,
  story_priority text,
  editorial_sources text[],
  featured_image text,
  description text,
  entur_stopplace_id text,
  bysykkel_station_id text,
  hyre_station_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  trust_score numeric,
  trust_flags text[] DEFAULT '{}'::text[] NOT NULL,
  trust_score_updated_at timestamptz,
  google_website text,
  google_business_status text,
  google_price_level integer,
  poi_tier smallint,
  tier_reason text,
  is_chain boolean,
  is_local_gem boolean,
  poi_metadata jsonb,
  tier_evaluated_at timestamptz,
  area_id text,
  opening_hours_json jsonb,
  google_phone text,
  opening_hours_updated_at timestamptz,
  facebook_url text,
  gallery_images text[],
  photo_resolved_at timestamptz,
  source text,
  nsr_id text,
  barnehagefakta_id text,
  osm_id text,
  event_dates text[],
  event_time_start text,
  event_time_end text,
  event_description text,
  event_url text,
  event_tags text[],
  parent_poi_id text,
  anchor_summary text,
  PRIMARY KEY (id)
);


-- ---------------------------------------------------------------------------
-- place_knowledge (15) — Placy-eid lokalkunnskap-IP (moat); skjema-keeper (PRD 8)
-- ---------------------------------------------------------------------------
CREATE TABLE v2.place_knowledge (
  id text NOT NULL,
  poi_id text,
  area_id text,
  topic text NOT NULL,
  fact_text text NOT NULL,
  fact_text_en text,
  structured_data jsonb,
  confidence text NOT NULL,
  source_url text,
  source_name text,
  sort_order integer,
  display_ready boolean,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  verified_at timestamptz,
  PRIMARY KEY (id)
);


-- ---------------------------------------------------------------------------
-- generation_requests (18) — megler-self-serve adresse→rapport-flyt
-- ---------------------------------------------------------------------------
CREATE TABLE v2.generation_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  address text NOT NULL,
  address_normalized text NOT NULL,
  email text NOT NULL,
  housing_type text NOT NULL,
  status text NOT NULL,
  geocoded_lat double precision,
  geocoded_lng double precision,
  geocoded_city text,
  address_slug text NOT NULL,
  project_id text,
  result_url text,
  error_message text,
  consent_given boolean NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  customer_id text,
  PRIMARY KEY (id)
);


-- ---------------------------------------------------------------------------
-- translations (8) — i18n-grunnlag (EN/NO) for PRD 5
-- ---------------------------------------------------------------------------
CREATE TABLE v2.translations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  locale text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  field text NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (locale, entity_type, entity_id, field)
);


-- ---------------------------------------------------------------------------
-- project_pois (3) — prosjekt↔POI join
-- ---------------------------------------------------------------------------
CREATE TABLE v2.project_pois (
  project_id text NOT NULL,
  poi_id text NOT NULL,
  sort_order integer,
  PRIMARY KEY (project_id, poi_id)
);


-- ---------------------------------------------------------------------------
-- product_pois (5) — produkt↔POI join; featured NN
-- ---------------------------------------------------------------------------
CREATE TABLE v2.product_pois (
  product_id text NOT NULL,
  poi_id text NOT NULL,
  category_override_id text,
  sort_order integer,
  featured boolean NOT NULL,
  PRIMARY KEY (product_id, poi_id)
);


-- ---------------------------------------------------------------------------
-- product_categories (3) — produkt↔kategori join
-- ---------------------------------------------------------------------------
CREATE TABLE v2.product_categories (
  product_id text NOT NULL,
  category_id text NOT NULL,
  display_order integer,
  PRIMARY KEY (product_id, category_id)
);


-- ============================================================================
-- events (8) — engasjements-instrumentering (greenfield, PRD 1 Unit 2 / r01.2)
--   Data-moat fra linje 1. Aggregert/anonymt; ingen individuell tracking uten
--   samtykke. session_id er en anonym, ikke-personidentifiserende økt-nøkkel
--   (eies/genereres server-side av PRD 13 — aldri i Zustand). payload (jsonb)
--   holdes som en ÅPEN konvolutt for Moat-2-kontekst (PRD 13) — IKKE lås event-
--   formen til en naken {category_id} når Fase-1-loggeren bygges; data logget
--   uten kontekst kan aldri repareres. CHECK-settet utvides via senere migrasjon
--   + EVENT_TYPES-bump (to-stegs grense, PRD 13).
-- ============================================================================
CREATE TABLE v2.events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_type text NOT NULL,
  project_id text,
  product_id text,
  poi_id text,
  payload jsonb,
  session_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT events_event_type_check CHECK (
    event_type IN ('board_viewed', 'category_opened', 'voiceover_played', 'poi_clicked')
  )
);

CREATE INDEX events_project_created_idx ON v2.events (project_id, created_at);
CREATE INDEX events_type_created_idx ON v2.events (event_type, created_at);


-- ============================================================================
-- RLS + GRANT — tilgangskontrakt på DB-nivå (PRD 1 Unit 5 / bead r01.5)
-- ----------------------------------------------------------------------------
-- service_role BYPASSER RLS (Supabase-default, BYPASSRLS) → all skriving +
-- admin-lesing skjer server-side via service_role. «Skriv kun service-role»
-- (AC3) oppnås derfor ved å IKKE gi anon/authenticated noen skrive-policy —
-- ikke ved en eksplisitt service-role-skrive-policy. anon/authenticated får
-- KUN SELECT på det publiserings-klare board-data-settet (10 tabeller), og
-- place_knowledge kun der display_ready = true (AC4). customers /
-- generation_requests (PII) / events (instrumentering) er IKKE anon-lesbare —
-- de er låst til service_role (ingen GRANT + ingen policy).
--
-- Forutsetter at v2 er lagt til i Supabase Settings → API → Exposed schemas
-- (engangs-config, PRD 1 Åpent spm #7 / Unit 7). Rollene anon/authenticated/
-- service_role finnes i Supabase fra før (opprettes IKKE her).
-- ============================================================================

-- Schema- + tabell-GRANTs (table-privilege; RLS-policy styrer rad-tilgang i tillegg)
GRANT USAGE ON SCHEMA v2 TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA v2 TO service_role;
GRANT SELECT ON
  v2.pois, v2.products, v2.projects, v2.areas, v2.categories, v2.category_slugs,
  v2.translations, v2.product_pois, v2.product_categories, v2.project_pois,
  v2.place_knowledge
TO anon, authenticated;

-- Aktiver RLS på alle 14 v2-tabeller (default-deny for ikke-bypass-roller)
ALTER TABLE v2.areas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.category_slugs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.generation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.place_knowledge     ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.pois                ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.product_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.product_pois        ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.project_pois        ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.translations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.events              ENABLE ROW LEVEL SECURITY;

-- Anon/authenticated SELECT på publiserings-klare board-data (10 tabeller)
CREATE POLICY pois_anon_select               ON v2.pois               FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY products_anon_select           ON v2.products           FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY projects_anon_select           ON v2.projects           FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY areas_anon_select              ON v2.areas              FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY categories_anon_select         ON v2.categories         FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY category_slugs_anon_select     ON v2.category_slugs     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY translations_anon_select       ON v2.translations       FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY product_pois_anon_select       ON v2.product_pois       FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY product_categories_anon_select ON v2.product_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY project_pois_anon_select       ON v2.project_pois       FOR SELECT TO anon, authenticated USING (true);

-- place_knowledge: anon/authenticated ser KUN display_ready (moat-IP ikke rå)
CREATE POLICY place_knowledge_display_ready_select ON v2.place_knowledge
  FOR SELECT TO anon, authenticated USING (display_ready = true);

-- customers, generation_requests, events: INGEN anon/authenticated-policy →
-- kun service_role (RLS-bypass). events skrives av server-action (service_role);
-- ingen anon-skriv (AC3). Ingen skrive-policy noe sted = skriving kun service_role.
