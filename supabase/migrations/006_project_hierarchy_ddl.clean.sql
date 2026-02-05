-- Migration: Project Hierarchy DDL
-- Description: Create new hierarchy structure (Customer - Project container - Products)
-- Phase 1 of migration: Schema changes only, no data migration

BEGIN;

-- ============================================
-- Step 1: Preserve existing tables
-- ============================================

-- Rename existing projects table (will migrate data later)
ALTER TABLE projects RENAME TO projects_legacy;
ALTER TABLE project_pois RENAME TO project_pois_legacy;

-- Rename indexes
ALTER INDEX idx_projects_customer_id RENAME TO idx_projects_legacy_customer_id;
ALTER INDEX idx_projects_url_slug RENAME TO idx_projects_legacy_url_slug;
ALTER INDEX idx_project_pois_poi_id RENAME TO idx_project_pois_legacy_poi_id;

-- Update foreign keys on dependent tables to point to legacy
-- theme_stories references projects(id)
ALTER TABLE theme_stories DROP CONSTRAINT theme_stories_project_id_fkey;
ALTER TABLE theme_stories
  ADD CONSTRAINT theme_stories_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects_legacy(id) ON DELETE CASCADE;

-- story_sections references projects(id)
ALTER TABLE story_sections DROP CONSTRAINT story_sections_project_id_fkey;
ALTER TABLE story_sections
  ADD CONSTRAINT story_sections_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects_legacy(id) ON DELETE CASCADE;

-- project_categories references projects(id) - but it uses UUID, need to check
-- Actually project_categories.project_id is UUID but projects.id is TEXT
-- This is a schema inconsistency that needs fixing

-- ============================================
-- Step 2: Create new projects table (containers)
-- ============================================

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL CHECK (length(name) > 0),
  url_slug TEXT NOT NULL CHECK (url_slug ~ '^[a-z0-9-]+$'),
  center_lat DECIMAL NOT NULL CHECK (center_lat BETWEEN -90 AND 90),
  center_lng DECIMAL NOT NULL CHECK (center_lng BETWEEN -180 AND 180),
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, url_slug)
);

-- Indexes for new projects
CREATE INDEX idx_projects_customer_id ON projects(customer_id);
CREATE INDEX idx_projects_url_slug ON projects(url_slug);

-- ============================================
-- Step 3: Create products table
-- ============================================

CREATE TABLE products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL CHECK (product_type IN ('explorer', 'report', 'guide')),
  config JSONB NOT NULL DEFAULT '{}',
  -- Story fields (moved from projects_legacy)
  story_title TEXT,
  story_intro_text TEXT,
  story_hero_images TEXT[],
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, product_type)
);

CREATE INDEX idx_products_project_id ON products(project_id);
CREATE INDEX idx_products_product_type ON products(product_type);

-- ============================================
-- Step 4: Create project_pois (shared POI pool)
-- ============================================

CREATE TABLE project_pois (
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  poi_id TEXT REFERENCES pois(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (project_id, poi_id)
);

CREATE INDEX idx_project_pois_poi_id ON project_pois(poi_id);

-- ============================================
-- Step 5: Create product_pois (product POI selection)
-- ============================================

CREATE TABLE product_pois (
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  poi_id TEXT REFERENCES pois(id) ON DELETE RESTRICT,
  category_override_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (product_id, poi_id)
);

CREATE INDEX idx_product_pois_poi_id ON product_pois(poi_id);

-- ============================================
-- Step 6: Create product_categories (category visibility per product)
-- ============================================

CREATE TABLE product_categories (
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  display_order INTEGER DEFAULT 0,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX idx_product_categories_category ON product_categories(category_id);

-- ============================================
-- Step 7: Triggers for updated_at
-- ============================================

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Step 8: Row Level Security
-- ============================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read" ON projects FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON project_pois FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON product_pois FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON product_categories FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service role full access" ON projects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON products FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON project_pois FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON product_pois FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON product_categories FOR ALL USING (auth.role() = 'service_role');

COMMIT;
