-- Cache opening hours and phone from Google Places
-- Eliminates runtime API calls for opening hours display

ALTER TABLE pois
  ADD COLUMN IF NOT EXISTS opening_hours_json JSONB,
  ADD COLUMN IF NOT EXISTS google_phone TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN pois.opening_hours_json IS 'Cached Google opening hours: {"weekday_text": [...]}';
COMMENT ON COLUMN pois.google_phone IS 'Cached phone number from Google Places';
COMMENT ON COLUMN pois.opening_hours_updated_at IS 'When opening hours were last refreshed';
