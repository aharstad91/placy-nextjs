-- Migration: 041_knowledge_taxonomy_v02
-- Expand topic CHECK constraint from 9 to 20 values (5 categories, 19 active + 1 legacy)
-- All existing data remains valid (only additive changes)

BEGIN;

-- Idempotent: IF EXISTS prevents failure on re-run
ALTER TABLE place_knowledge
DROP CONSTRAINT IF EXISTS place_knowledge_topic_valid;

ALTER TABLE place_knowledge
ADD CONSTRAINT place_knowledge_topic_valid CHECK (topic IN (
  -- Historien (story)
  'history', 'people', 'awards', 'media', 'controversy',
  -- Opplevelsen (experience)
  'atmosphere', 'signature', 'culture', 'seasonal',
  -- Smaken (taste)
  'food', 'drinks', 'sustainability',
  -- Stedet (place)
  'architecture', 'spatial', 'nature', 'accessibility',
  -- Innsiden (inside)
  'practical', 'insider', 'relationships',
  -- Legacy (backward compatible)
  'local_knowledge'
));

COMMIT;
