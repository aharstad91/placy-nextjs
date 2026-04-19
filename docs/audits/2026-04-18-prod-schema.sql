-- ============================================================================
-- Placy Report Prod Schema — v1
-- Dato: 2026-04-18
-- Kontekst: Greenfield prod-Supabase for Report-produktet. Basert på audit
-- i docs/audits/2026-04-18-supabase-prod-schema-audit.md.
--
-- 10 tabeller. Ingen Explorer/Guide/Story/Trips/Events-legacy. Ingen tier-system.
-- Translations-tabellen droppet fra MVP — legges til ved etterspørsel.
--
-- Design-prinsipper:
-- - RLS aktivert på alle tabeller fra dag én
-- - Public read for alt Report-UI trenger, service role for pipeline writes
-- - TIMESTAMPTZ for alle tidspunkter
-- - CHECK constraints for enum-verdier (i stedet for PostgreSQL enum types)
-- - Indexes på FKs og hyppige query-paths
-- - Auto-oppdatering av updated_at via trigger
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Shared: updated_at auto-trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. customers — tenant root
-- ============================================================================
CREATE TABLE customers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(name) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read customers"
  ON customers FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on customers"
  ON customers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. areas — geografisk hierarki (city → bydel → strøk)
-- ============================================================================
CREATE TABLE areas (
  id             TEXT PRIMARY KEY,
  parent_id      TEXT REFERENCES areas(id) ON DELETE SET NULL,
  level          TEXT NOT NULL DEFAULT 'city' CHECK (level IN ('city', 'bydel', 'strok')),
  name_no        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  slug_no        TEXT NOT NULL UNIQUE,
  slug_en        TEXT NOT NULL UNIQUE,
  description_no TEXT,
  description_en TEXT,
  center_lat     DECIMAL NOT NULL CHECK (center_lat BETWEEN -90 AND 90),
  center_lng     DECIMAL NOT NULL CHECK (center_lng BETWEEN -180 AND 180),
  zoom_level     INTEGER DEFAULT 13,
  boundary       JSONB,
  postal_codes   TEXT[],
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_areas_parent ON areas(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_areas_level ON areas(level);

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read areas"
  ON areas FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on areas"
  ON areas FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. categories — POI-kategorier
-- ============================================================================
CREATE TABLE categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL CHECK (length(name) > 0),
  icon       TEXT NOT NULL,  -- Lucide icon name
  color      TEXT NOT NULL,  -- hex color
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read categories"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on categories"
  ON categories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. projects — prosjekt-container
-- ============================================================================
CREATE TABLE projects (
  id             TEXT PRIMARY KEY,  -- e.g. "broset-utvikling-as_wesselslokka"
  customer_id    TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  short_id       TEXT NOT NULL UNIQUE,  -- 7-char nanoid for deling
  name           TEXT NOT NULL CHECK (length(name) > 0),
  url_slug       TEXT NOT NULL CHECK (url_slug ~ '^[a-z0-9-]+$'),
  description    TEXT,

  -- Geografi
  center_lat     DECIMAL NOT NULL CHECK (center_lat BETWEEN -90 AND 90),
  center_lng     DECIMAL NOT NULL CHECK (center_lng BETWEEN -180 AND 180),
  area_id        TEXT REFERENCES areas(id) ON DELETE SET NULL,

  -- Venue-klassifisering
  venue_type     TEXT CHECK (venue_type IN ('hotel', 'residential', 'commercial')),
  venue_context  TEXT NOT NULL DEFAULT 'suburban' CHECK (venue_context IN ('suburban', 'urban')),

  -- Feature-flagg
  has_3d_addon   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Descriptive / whitelabel
  tags           TEXT[] DEFAULT '{}',
  theme          JSONB,

  -- Welcome / landing
  welcome_title   TEXT,
  welcome_tagline TEXT,
  welcome_image   TEXT,
  homepage_url    TEXT CHECK (homepage_url IS NULL OR homepage_url ~ '^https?://'),

  -- Versjonering
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(customer_id, url_slug)
);

CREATE INDEX idx_projects_customer_id ON projects(customer_id);
CREATE INDEX idx_projects_short_id ON projects(short_id);
CREATE INDEX idx_projects_area_id ON projects(area_id) WHERE area_id IS NOT NULL;
CREATE INDEX idx_projects_tags ON projects USING GIN(tags);

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read projects"
  ON projects FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on projects"
  ON projects FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5. products — produkt-instans (report-typen)
--
-- Beholdt som egen tabell (fremfor å flate inn i projects) fordi:
-- - config JSONB er stor og oppdateres uavhengig av prosjekt-metadata
-- - Fremtidig utvidelse (f.eks. flere Report-varianter per prosjekt) blir enkelt
-- - Eksisterende Report-kode leser fra products.config.reportConfig
-- ============================================================================
CREATE TABLE products (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_type  TEXT NOT NULL DEFAULT 'report' CHECK (product_type IN ('report')),
  config        JSONB NOT NULL DEFAULT '{}',  -- inneholder reportConfig: heroIntro, motiver, themes, heroImage
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, product_type)
);

CREATE INDEX idx_products_project_id ON products(project_id);

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read products"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on products"
  ON products FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 6. pois — Point of Interest (delt POI-pool)
--
-- Betydelig slimmer enn sandbox: ingen tier-system, ingen mobility-felt,
-- ingen event-felt, ingen legacy Story-felt, ingen gallery_images.
-- ============================================================================
CREATE TABLE pois (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL CHECK (length(name) > 0),
  category_id               TEXT NOT NULL REFERENCES categories(id),
  area_id                   TEXT REFERENCES areas(id) ON DELETE SET NULL,
  parent_poi_id             TEXT REFERENCES pois(id) ON DELETE SET NULL,

  -- Lokasjon
  lat                       DECIMAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng                       DECIMAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  address                   TEXT,

  -- Redaksjonelt innhold (IP)
  editorial_hook            TEXT,
  local_insight             TEXT,
  description               TEXT,
  featured_image            TEXT,

  -- Metadata fra kildene (JSONB — school-type, chain-status, etc.)
  poi_metadata              JSONB NOT NULL DEFAULT '{}',

  -- Google Places
  google_place_id           TEXT,
  google_rating             DECIMAL,
  google_review_count       INTEGER,
  google_maps_url           TEXT,
  google_website            TEXT,
  google_business_status    TEXT CHECK (google_business_status IS NULL OR google_business_status IN ('OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY')),
  google_price_level        INTEGER CHECK (google_price_level IS NULL OR google_price_level BETWEEN 0 AND 4),
  facebook_url              TEXT CHECK (facebook_url IS NULL OR facebook_url ~ '^https://'),

  -- Trust-score (brukt av pipeline for kvalitets-filtrering)
  trust_score               NUMERIC(3,2) CHECK (trust_score IS NULL OR trust_score BETWEEN 0.0 AND 1.0),
  trust_flags               TEXT[] NOT NULL DEFAULT '{}',
  trust_score_updated_at    TIMESTAMPTZ,

  -- Eksterne kilde-IDer (for dedupe ved re-import)
  source                    TEXT,  -- 'google' | 'nsr' | 'barnehagefakta' | 'osm' | 'manual'
  nsr_id                    TEXT,
  barnehagefakta_id         TEXT,
  osm_id                    TEXT,

  -- Transit-integrasjon
  entur_stopplace_id        TEXT,
  bysykkel_station_id       TEXT,

  -- Self-constraint
  CONSTRAINT pois_no_self_parent CHECK (parent_poi_id IS NULL OR parent_poi_id != id),

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pois_category_id ON pois(category_id);
CREATE INDEX idx_pois_area_id ON pois(area_id) WHERE area_id IS NOT NULL;
CREATE INDEX idx_pois_parent_poi_id ON pois(parent_poi_id) WHERE parent_poi_id IS NOT NULL;
CREATE INDEX idx_pois_google_place_id ON pois(google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX idx_pois_trust_score ON pois(trust_score) WHERE trust_score IS NOT NULL;
CREATE INDEX idx_pois_source ON pois(source) WHERE source IS NOT NULL;

-- Unique external IDs (idempotent re-import)
CREATE UNIQUE INDEX idx_pois_nsr_id ON pois(nsr_id) WHERE nsr_id IS NOT NULL;
CREATE UNIQUE INDEX idx_pois_barnehagefakta_id ON pois(barnehagefakta_id) WHERE barnehagefakta_id IS NOT NULL;
CREATE UNIQUE INDEX idx_pois_osm_id ON pois(osm_id) WHERE osm_id IS NOT NULL;

CREATE TRIGGER update_pois_updated_at
  BEFORE UPDATE ON pois
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read pois"
  ON pois FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on pois"
  ON pois FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 7. project_pois — POI-pool per prosjekt
-- ============================================================================
CREATE TABLE project_pois (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  poi_id     TEXT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, poi_id)
);

CREATE INDEX idx_project_pois_poi_id ON project_pois(poi_id);

ALTER TABLE project_pois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read project_pois"
  ON project_pois FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on project_pois"
  ON project_pois FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 8. product_pois — POI-utvalg per produkt (featured-flagg for highlights)
-- ============================================================================
CREATE TABLE product_pois (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  poi_id     TEXT NOT NULL REFERENCES pois(id) ON DELETE RESTRICT,
  featured   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, poi_id)
);

CREATE INDEX idx_product_pois_poi_id ON product_pois(poi_id);
CREATE INDEX idx_product_pois_featured ON product_pois(product_id) WHERE featured = TRUE;

ALTER TABLE product_pois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product_pois"
  ON product_pois FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on product_pois"
  ON product_pois FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 9. product_categories — kategori-visning per produkt
-- ============================================================================
CREATE TABLE product_categories (
  product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id   TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX idx_product_categories_category_id ON product_categories(category_id);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product_categories"
  ON product_categories FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on product_categories"
  ON product_categories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 10. place_knowledge — verifiserte fakta om POIs/områder (POI-IP)
--
-- Brukt av /generate-rapport for triangulering. Ikke lest av Report-UI direkte.
-- ============================================================================
CREATE TABLE place_knowledge (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  poi_id            TEXT REFERENCES pois(id) ON DELETE CASCADE,
  area_id           TEXT REFERENCES areas(id) ON DELETE RESTRICT,
  topic             TEXT NOT NULL CHECK (topic IN (
                      'history', 'people', 'awards', 'media', 'controversy',
                      'atmosphere', 'signature', 'culture', 'seasonal',
                      'food', 'drinks', 'sustainability', 'architecture',
                      'spatial', 'nature', 'accessibility', 'practical',
                      'insider', 'relationships', 'local_knowledge'
                    )),
  fact_text         TEXT NOT NULL CHECK (length(fact_text) > 0),
  fact_text_en      TEXT,
  structured_data   JSONB NOT NULL DEFAULT '{}',
  confidence        TEXT NOT NULL DEFAULT 'unverified' CHECK (confidence IN ('verified', 'unverified', 'disputed')),
  source_url        TEXT CHECK (source_url IS NULL OR source_url ~ '^https?://'),
  source_name       TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  display_ready     BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- XOR: knowledge tilhører enten en POI eller et område, ikke begge
  CONSTRAINT place_knowledge_parent_check
    CHECK ((poi_id IS NOT NULL AND area_id IS NULL)
        OR (poi_id IS NULL AND area_id IS NOT NULL))
);

CREATE INDEX idx_pk_poi_display ON place_knowledge(poi_id)
  WHERE poi_id IS NOT NULL AND display_ready = TRUE;
CREATE INDEX idx_pk_area_display ON place_knowledge(area_id)
  WHERE area_id IS NOT NULL AND display_ready = TRUE;
CREATE INDEX idx_pk_topic ON place_knowledge(topic);

-- Auto-set verified_at når confidence blir 'verified'
CREATE OR REPLACE FUNCTION set_place_knowledge_verified_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.confidence = 'verified' AND (OLD IS NULL OR OLD.confidence != 'verified') THEN
    NEW.verified_at = NOW();
  ELSIF NEW.confidence != 'verified' THEN
    NEW.verified_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_place_knowledge_verified_at_trigger
  BEFORE INSERT OR UPDATE OF confidence ON place_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION set_place_knowledge_verified_at();

CREATE TRIGGER update_place_knowledge_updated_at
  BEFORE UPDATE ON place_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE place_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read display-ready knowledge"
  ON place_knowledge FOR SELECT
  USING (display_ready = TRUE);

CREATE POLICY "Service role full access on place_knowledge"
  ON place_knowledge FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FERDIG
--
-- Neste steg:
-- 1. Opprett nytt Supabase-prosjekt
-- 2. Kjør denne filen som 001_prod_schema.sql
-- 3. Seed categories + areas via eget script (identisk kopi fra sandbox)
-- 4. Export POI-IP fra sandbox (editorial_hooks, place_knowledge) → prod
-- 5. Regenerer Report-produkter for demo-prosjekter via /generate-rapport
-- ============================================================================
