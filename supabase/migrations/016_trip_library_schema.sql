-- Migration: 016_trip_library_schema
-- Description: Create Trip Library tables (trips, trip_stops, project_trips)
-- Part of: WP1 — Trip Library Platform
-- Tech audit: All 12 mitigations applied (see PRD Del 6)

BEGIN;

-- ============================================
-- Step 1: trips — Global, Placy-owned trips
-- ============================================

CREATE TABLE trips (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title TEXT NOT NULL CHECK (length(title) > 0),
  description TEXT,
  url_slug TEXT NOT NULL UNIQUE CHECK (url_slug ~ '^[a-z0-9-]+$'),
  cover_image_url TEXT,
  category TEXT CHECK (category IN ('food', 'culture', 'nature', 'family', 'active', 'hidden-gems')),
  difficulty TEXT CHECK (difficulty IN ('easy', 'moderate', 'challenging')),
  season TEXT CHECK (season IN ('spring', 'summer', 'autumn', 'winter', 'all-year')) DEFAULT 'all-year',
  tags TEXT[] DEFAULT '{}',
  featured BOOLEAN DEFAULT false,

  -- Geography (NOT NULL — all trips are location-based)
  city TEXT NOT NULL,
  region TEXT,
  country TEXT DEFAULT 'NO',
  center_lat DECIMAL NOT NULL CHECK (center_lat BETWEEN -90 AND 90),
  center_lng DECIMAL NOT NULL CHECK (center_lng BETWEEN -180 AND 180),

  -- Precomputed (stop_count maintained by trigger, others set by application)
  distance_meters DECIMAL,
  duration_minutes INTEGER,
  stop_count INTEGER DEFAULT 0,

  -- Default reward (can be overridden per project via project_trips)
  default_reward_title TEXT,
  default_reward_description TEXT,

  -- Metadata
  created_by TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trips_city ON trips(city);
CREATE INDEX idx_trips_category ON trips(category);
CREATE INDEX idx_trips_city_published ON trips(city) WHERE published = true;

-- Trigger: auto-update updated_at
CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Step 2: trip_stops — Stops within a trip
-- ============================================

CREATE TABLE trip_stops (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  poi_id TEXT NOT NULL REFERENCES pois(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Overrides (null = use POI defaults)
  name_override TEXT,
  description_override TEXT,
  image_url_override TEXT,

  -- Narrative content
  transition_text TEXT,
  local_insight TEXT
);
-- No UNIQUE(trip_id, sort_order) — ordering enforced by ORDER BY in queries.
-- This matches the existing pattern (theme_story_sections has no such constraint).

-- Indexes
CREATE INDEX idx_trip_stops_trip ON trip_stops(trip_id);
CREATE INDEX idx_trip_stops_poi ON trip_stops(poi_id);

-- Trigger: auto-update trips.stop_count on INSERT/DELETE
CREATE OR REPLACE FUNCTION update_trip_stop_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE trips SET stop_count = (
    SELECT COUNT(*) FROM trip_stops WHERE trip_id = COALESCE(NEW.trip_id, OLD.trip_id)
  ) WHERE id = COALESCE(NEW.trip_id, OLD.trip_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_trip_stop_count
  AFTER INSERT OR DELETE ON trip_stops
  FOR EACH ROW EXECUTE FUNCTION update_trip_stop_count();

-- ============================================
-- Step 3: project_trips — Links trips to projects with overrides
-- ============================================

CREATE TABLE project_trips (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,

  -- Hotel-specific start point override
  start_poi_id TEXT REFERENCES pois(id) ON DELETE SET NULL,
  start_name TEXT,
  start_description TEXT,
  start_transition_text TEXT,

  -- Hotel-specific reward override
  reward_title TEXT,
  reward_description TEXT,
  reward_code TEXT,
  reward_validity_days INTEGER,

  -- Hotel-specific branding
  welcome_text TEXT,

  UNIQUE(project_id, trip_id)
);

-- Indexes
CREATE INDEX idx_project_trips_project ON project_trips(project_id);
CREATE INDEX idx_project_trips_trip ON project_trips(trip_id);

-- ============================================
-- Step 4: Row Level Security
-- ============================================

-- trips: published trips are public, all access for service_role
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read published trips" ON trips
  FOR SELECT USING (published = true);

CREATE POLICY "Service role full access" ON trips
  FOR ALL USING (auth.role() = 'service_role');

-- trip_stops: cascade visibility from parent trip
ALTER TABLE trip_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read stops of published trips" ON trip_stops
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_stops.trip_id AND trips.published = true)
  );

CREATE POLICY "Service role full access" ON trip_stops
  FOR ALL USING (auth.role() = 'service_role');

-- project_trips: cascade visibility from linked trip
ALTER TABLE project_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for published trips" ON project_trips
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = project_trips.trip_id AND trips.published = true)
  );

CREATE POLICY "Service role full access" ON project_trips
  FOR ALL USING (auth.role() = 'service_role');

COMMIT;
