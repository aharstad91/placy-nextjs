-- Migration: 038_place_knowledge
-- Description: Create place_knowledge table for structured city facts
-- Feature: City Knowledge Base (IP)
-- Tech audit: All 10 mitigations applied

BEGIN;

-- Step 1: Create table

CREATE TABLE place_knowledge (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,

  -- Kobling til sted (nøyaktig én av disse MÅ settes)
  poi_id TEXT REFERENCES pois(id) ON DELETE CASCADE,
  area_id TEXT REFERENCES areas(id) ON DELETE RESTRICT,

  -- Klassifisering
  topic TEXT NOT NULL,

  -- Innhold
  fact_text TEXT NOT NULL,
  fact_text_en TEXT,
  structured_data JSONB DEFAULT '{}',

  -- Kvalitet
  confidence TEXT NOT NULL DEFAULT 'unverified',

  -- Kilde
  source_url TEXT,
  source_name TEXT,

  -- Sortering og synlighet
  sort_order INTEGER DEFAULT 0,
  display_ready BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,

  -- Named constraints
  CONSTRAINT place_knowledge_topic_valid CHECK (topic IN (
    'history', 'architecture', 'food', 'culture', 'people',
    'nature', 'practical', 'local_knowledge', 'spatial'
  )),
  CONSTRAINT place_knowledge_confidence_valid CHECK (confidence IN (
    'verified', 'unverified', 'disputed'
  )),
  CONSTRAINT place_knowledge_parent_check CHECK (
    (poi_id IS NOT NULL AND area_id IS NULL) OR
    (poi_id IS NULL AND area_id IS NOT NULL)
  ),
  CONSTRAINT place_knowledge_fact_text_nonempty CHECK (length(fact_text) > 0),
  CONSTRAINT place_knowledge_source_url_safe CHECK (
    source_url IS NULL OR source_url ~ '^https?://'
  )
);

-- Step 2: Indexes optimized for actual query patterns

-- Public queries: WHERE poi_id = $1 AND display_ready = true ORDER BY sort_order
CREATE INDEX idx_pk_poi_display ON place_knowledge(poi_id, sort_order)
  WHERE poi_id IS NOT NULL AND display_ready = true;

-- Area queries: WHERE area_id = $1 AND display_ready = true ORDER BY sort_order
CREATE INDEX idx_pk_area_display ON place_knowledge(area_id, sort_order)
  WHERE area_id IS NOT NULL AND display_ready = true;

-- Admin queries (no display_ready filter)
CREATE INDEX idx_pk_topic ON place_knowledge(topic);
CREATE INDEX idx_pk_poi_topic ON place_knowledge(poi_id, topic, sort_order)
  WHERE poi_id IS NOT NULL;
CREATE INDEX idx_pk_area_topic ON place_knowledge(area_id, topic, sort_order)
  WHERE area_id IS NOT NULL;

-- Step 3: Triggers

-- Auto-update updated_at (reuse existing function from migration 001)
CREATE TRIGGER update_place_knowledge_updated_at
  BEFORE UPDATE ON place_knowledge
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-set verified_at when confidence changes to 'verified'
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
  FOR EACH ROW EXECUTE FUNCTION set_place_knowledge_verified_at();

-- Step 4: Row Level Security

ALTER TABLE place_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read display-ready knowledge" ON place_knowledge
  FOR SELECT USING (display_ready = true);

CREATE POLICY "Service role full access" ON place_knowledge
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
