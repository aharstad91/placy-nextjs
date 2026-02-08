-- Trust validation fields
ALTER TABLE pois ADD COLUMN trust_score NUMERIC CHECK (trust_score >= 0.0 AND trust_score <= 1.0);
ALTER TABLE pois ADD COLUMN trust_flags TEXT[] DEFAULT '{}';
ALTER TABLE pois ADD COLUMN trust_score_updated_at TIMESTAMPTZ;

-- Google enrichment fields (Layer 1 data) — with CHECK constraints
ALTER TABLE pois ADD COLUMN google_website TEXT;
ALTER TABLE pois ADD COLUMN google_business_status TEXT
  CHECK (google_business_status IN ('OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'));
ALTER TABLE pois ADD COLUMN google_price_level INTEGER
  CHECK (google_price_level >= 0 AND google_price_level <= 4);

-- Index for Explorer filtering
CREATE INDEX idx_pois_trust_score ON pois(trust_score) WHERE trust_score IS NOT NULL;

-- Index for Claude Code workflow: find unvalidated POIs efficiently
CREATE INDEX idx_pois_trust_unvalidated ON pois(created_at) WHERE trust_score IS NULL;

-- Backfill: ensure existing rows have empty array (not NULL)
UPDATE pois SET trust_flags = '{}' WHERE trust_flags IS NULL;
