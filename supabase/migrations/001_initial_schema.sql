-- Placy Database Schema
-- Migration: 001_initial_schema
-- Description: Initial database setup with all core tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Kategorier (delt bibliotek)
-- ============================================
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,        -- Lucide icon name
  color TEXT NOT NULL,       -- Hex color
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- POIs (delt bibliotek)
-- ============================================
CREATE TABLE pois (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat DECIMAL NOT NULL,
  lng DECIMAL NOT NULL,
  address TEXT,
  category_id TEXT REFERENCES categories(id),

  -- Google Places
  google_place_id TEXT,
  google_rating DECIMAL,
  google_review_count INTEGER,
  google_maps_url TEXT,
  photo_reference TEXT,

  -- Editorial
  editorial_hook TEXT,
  local_insight TEXT,
  story_priority TEXT CHECK (story_priority IN ('must_have', 'nice_to_have', 'filler')),
  editorial_sources TEXT[],
  featured_image TEXT,
  description TEXT,

  -- Transport integrations
  entur_stopplace_id TEXT,
  bysykkel_station_id TEXT,
  hyre_station_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for category lookups
CREATE INDEX idx_pois_category_id ON pois(category_id);

-- Index for Google Place ID (for deduplication)
CREATE INDEX idx_pois_google_place_id ON pois(google_place_id);

-- ============================================
-- Kunder
-- ============================================
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Prosjekter
-- ============================================
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  name TEXT NOT NULL,
  url_slug TEXT NOT NULL,
  center_lat DECIMAL NOT NULL,
  center_lng DECIMAL NOT NULL,

  -- Story metadata
  story_title TEXT,
  story_intro_text TEXT,
  story_hero_images TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id, url_slug)
);

-- Index for customer lookups
CREATE INDEX idx_projects_customer_id ON projects(customer_id);

-- Index for URL routing
CREATE INDEX idx_projects_url_slug ON projects(url_slug);

-- ============================================
-- Kobling: Project <-> POI (mange-til-mange)
-- ============================================
CREATE TABLE project_pois (
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  poi_id TEXT REFERENCES pois(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, poi_id)
);

-- Index for POI lookups
CREATE INDEX idx_project_pois_poi_id ON project_pois(poi_id);

-- ============================================
-- Theme Stories
-- ============================================
CREATE TABLE theme_stories (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  bridge_text TEXT,
  illustration TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, slug)
);

-- Index for project lookups
CREATE INDEX idx_theme_stories_project_id ON theme_stories(project_id);

-- ============================================
-- Story Sections (main story sections)
-- ============================================
CREATE TABLE story_sections (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'image_gallery', 'poi_list', 'theme_story_cta', 'map')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  category_label TEXT,
  title TEXT,
  bridge_text TEXT,
  content TEXT,
  images TEXT[],
  theme_story_id TEXT REFERENCES theme_stories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for project lookups
CREATE INDEX idx_story_sections_project_id ON story_sections(project_id);

-- ============================================
-- Section POIs (hvilke POIs vises i en section)
-- ============================================
CREATE TABLE section_pois (
  section_id TEXT REFERENCES story_sections(id) ON DELETE CASCADE,
  poi_id TEXT REFERENCES pois(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (section_id, poi_id)
);

-- ============================================
-- Theme Story Sections
-- ============================================
CREATE TABLE theme_story_sections (
  id TEXT PRIMARY KEY,
  theme_story_id TEXT REFERENCES theme_stories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  images TEXT[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for theme story lookups
CREATE INDEX idx_theme_story_sections_theme_story_id ON theme_story_sections(theme_story_id);

-- ============================================
-- Theme Story Section POIs
-- ============================================
CREATE TABLE theme_section_pois (
  section_id TEXT REFERENCES theme_story_sections(id) ON DELETE CASCADE,
  poi_id TEXT REFERENCES pois(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (section_id, poi_id)
);

-- ============================================
-- Updated At Trigger Function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_pois_updated_at
  BEFORE UPDATE ON pois
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_story_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_section_pois ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for anonymous users)
CREATE POLICY "Allow public read access" ON categories FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON pois FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON projects FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON project_pois FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON theme_stories FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON story_sections FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON section_pois FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON theme_story_sections FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON theme_section_pois FOR SELECT USING (true);

-- Service role has full access (for admin operations)
CREATE POLICY "Service role full access" ON categories FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON pois FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON customers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON projects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON project_pois FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON theme_stories FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON story_sections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON section_pois FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON theme_story_sections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON theme_section_pois FOR ALL USING (auth.role() = 'service_role');
