-- Partial unique indexes for public POI source IDs
-- Matches the existing barnehagefakta_id pattern

CREATE UNIQUE INDEX IF NOT EXISTS idx_pois_nsr_id
  ON pois (nsr_id)
  WHERE nsr_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pois_osm_id
  ON pois (osm_id)
  WHERE osm_id IS NOT NULL;
