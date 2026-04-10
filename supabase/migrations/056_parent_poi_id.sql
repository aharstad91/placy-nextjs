-- Migration 056: Parent-child POI hierarchy
--
-- Adds parent_poi_id (self-referencing FK) and anchor_summary to pois table.
-- Enables shopping centers to own child POIs (e.g., stores inside a mall).

BEGIN;

ALTER TABLE pois ADD COLUMN IF NOT EXISTS parent_poi_id TEXT
  CONSTRAINT pois_parent_poi_id_fkey REFERENCES pois(id) ON DELETE SET NULL;

ALTER TABLE pois ADD COLUMN IF NOT EXISTS anchor_summary TEXT;

ALTER TABLE pois ADD CONSTRAINT pois_no_self_parent
  CHECK (parent_poi_id IS NULL OR parent_poi_id != id);

CREATE INDEX IF NOT EXISTS idx_pois_parent_poi_id ON pois(parent_poi_id);

COMMIT;
