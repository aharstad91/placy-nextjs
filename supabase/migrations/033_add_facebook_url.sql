-- Add Facebook page URL to POIs
ALTER TABLE pois
  ADD COLUMN IF NOT EXISTS facebook_url TEXT
  CHECK (facebook_url IS NULL OR facebook_url ~ '^https://');

COMMENT ON COLUMN pois.facebook_url IS 'Facebook page URL for this POI';
