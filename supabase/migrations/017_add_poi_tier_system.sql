-- POI Tier System columns
ALTER TABLE pois ADD COLUMN poi_tier SMALLINT
  CONSTRAINT pois_poi_tier_valid CHECK (poi_tier IN (1, 2, 3));
ALTER TABLE pois ADD COLUMN tier_reason TEXT;
ALTER TABLE pois ADD COLUMN is_chain BOOLEAN DEFAULT false;
ALTER TABLE pois ADD COLUMN is_local_gem BOOLEAN DEFAULT false;
ALTER TABLE pois ADD COLUMN poi_metadata JSONB DEFAULT '{}';
ALTER TABLE pois ADD COLUMN tier_evaluated_at TIMESTAMPTZ;

-- Indexes for tier-based queries
CREATE INDEX idx_pois_tier ON pois(poi_tier) WHERE poi_tier IS NOT NULL;
CREATE INDEX idx_pois_chain ON pois(is_chain) WHERE is_chain = true;
CREATE INDEX idx_pois_local_gem ON pois(is_local_gem) WHERE is_local_gem = true;

-- Index for finding unevaluated POIs
CREATE INDEX idx_pois_tier_unevaluated ON pois(created_at) WHERE poi_tier IS NULL;

-- Backfill: ensure existing rows have empty JSONB (not NULL)
UPDATE pois SET poi_metadata = '{}' WHERE poi_metadata IS NULL;
