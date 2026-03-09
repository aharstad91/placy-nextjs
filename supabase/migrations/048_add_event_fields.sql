-- Add event-specific fields to POIs for event/festival projects
-- These are flat columns (not JSONB) following the existing pattern (facebook_url, gallery_images)

ALTER TABLE pois ADD COLUMN IF NOT EXISTS event_dates text[];
ALTER TABLE pois ADD COLUMN IF NOT EXISTS event_time_start text;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS event_time_end text;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS event_description text;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS event_url text;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS event_tags text[];

-- Index for day filter queries (GIN index on array column)
CREATE INDEX IF NOT EXISTS idx_pois_event_dates ON pois USING GIN (event_dates);

COMMENT ON COLUMN pois.event_dates IS 'Event dates as YYYY-MM-DD strings, e.g. ["2026-04-18", "2026-04-19"]';
COMMENT ON COLUMN pois.event_time_start IS 'Event start time as HH:MM, e.g. "10:00"';
COMMENT ON COLUMN pois.event_time_end IS 'Event end time as HH:MM, e.g. "16:00"';
COMMENT ON COLUMN pois.event_description IS 'Event-specific description (separate from POI description)';
COMMENT ON COLUMN pois.event_url IS 'Link to organizer event page (external)';
COMMENT ON COLUMN pois.event_tags IS 'Tags like ["Gratis", "Barnevennlig", "Forhåndsregistrering"]';

-- Migrate existing Kulturnatt data: extract time from poi_metadata.time → event_time_start/end
-- poi_metadata.time format: "15:00–18:00" or "15:00"
UPDATE pois
SET
  event_time_start = split_part(poi_metadata->>'time', '–', 1),
  event_time_end = CASE
    WHEN poi_metadata->>'time' LIKE '%–%'
    THEN split_part(poi_metadata->>'time', '–', 2)
    ELSE NULL
  END
WHERE poi_metadata->>'time' IS NOT NULL
  AND event_time_start IS NULL;
