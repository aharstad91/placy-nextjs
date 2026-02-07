-- Migration 013: Add discovery_circles to projects
-- Multi-circle discovery area for POI import
-- Nullable JSONB array of {lat, lng, radiusMeters} objects
-- NULL = use fallback (single circle from center_lat/center_lng)

ALTER TABLE projects
  ADD COLUMN discovery_circles JSONB DEFAULT NULL;

COMMENT ON COLUMN projects.discovery_circles IS
  'Array of {lat, lng, radiusMeters} objects defining POI discovery area';
