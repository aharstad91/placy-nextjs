-- Track when photo URLs were last resolved from Google
-- Enables bi-weekly refresh to keep lh3 CDN URLs fresh (they can expire)

ALTER TABLE pois
  ADD COLUMN IF NOT EXISTS photo_resolved_at TIMESTAMPTZ;

COMMENT ON COLUMN pois.photo_resolved_at IS 'When featured_image URL was last resolved from Google Places Photo API';

-- Backfill for POIs that already have resolved CDN URLs
UPDATE pois SET photo_resolved_at = NOW()
WHERE featured_image LIKE 'https://lh3.googleusercontent.com%'
  AND photo_resolved_at IS NULL;
