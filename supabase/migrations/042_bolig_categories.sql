-- Migration 042: Bolig categories and POI source tracking
-- Adds skole, barnehage, idrett categories for residential projects
-- Adds source column and external ID columns for dedup across data providers

BEGIN;

-- Step 1: New categories for residential reports
INSERT INTO categories (id, name, icon, color) VALUES
  ('skole', 'Skole', 'GraduationCap', '#f59e0b'),
  ('barnehage', 'Barnehage', 'Baby', '#f59e0b'),
  ('idrett', 'Idrettsanlegg', 'Trophy', '#f59e0b')
ON CONFLICT (id) DO NOTHING;

-- Step 2: Source column for data governance
ALTER TABLE pois ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS idx_pois_source ON pois(source);

-- Backfill existing POIs
UPDATE pois SET source = 'google' WHERE google_place_id IS NOT NULL AND source IS NULL;
UPDATE pois SET source = 'entur' WHERE entur_stopplace_id IS NOT NULL AND source IS NULL;
UPDATE pois SET source = 'bysykkel' WHERE bysykkel_station_id IS NOT NULL AND source IS NULL;

-- Step 3: External ID columns with partial unique indexes (database-level dedup)
ALTER TABLE pois ADD COLUMN IF NOT EXISTS nsr_id TEXT;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS barnehagefakta_id TEXT;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS osm_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pois_nsr_id ON pois(nsr_id) WHERE nsr_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pois_barnehagefakta_id ON pois(barnehagefakta_id) WHERE barnehagefakta_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pois_osm_id ON pois(osm_id) WHERE osm_id IS NOT NULL;

-- Step 4: SEO slugs for new categories (Norwegian + English)
INSERT INTO category_slugs (category_id, locale, slug, seo_title) VALUES
  ('skole', 'no', 'skoler', 'Skoler i nærheten'),
  ('skole', 'en', 'schools', 'Nearby Schools'),
  ('barnehage', 'no', 'barnehager', 'Barnehager i nærheten'),
  ('barnehage', 'en', 'kindergartens', 'Nearby Kindergartens'),
  ('idrett', 'no', 'idrettsanlegg', 'Idrettsanlegg i nærheten'),
  ('idrett', 'en', 'sports-facilities', 'Nearby Sports Facilities')
ON CONFLICT (category_id, locale) DO NOTHING;

COMMIT;
