-- Add 'sightseeing' to trips.category CHECK constraint
-- Uses IF EXISTS for safety (inline CHECK from migration 016 may have auto-generated name)
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_category_check;
ALTER TABLE trips ADD CONSTRAINT trips_category_check
  CHECK (category IN ('food', 'culture', 'nature', 'family', 'active', 'hidden-gems', 'sightseeing'));
