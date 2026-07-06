-- 074b: Editorial-backfill etter 074. 73 public-rader m/ editorial hadde en
-- v2-motpart UTEN editorial (fantes alt i v2 fra provisjonering → hoppet over
-- av 074s insert). Lokalkunnskap (Moat 1) skal ikke dø med public-droppen.
--
-- Additiv: fyller KUN editorial-felter der v2.editorial_hook IS NULL — rører
-- aldri board-kuraterte verdier (story_priority, poi_tier osv. urørt).
-- REVERSIBILITET: tagget poi_metadata.editorial_backfill='074b'
--   → angre = NULL-stille editorial_hook/local_insight/editorial_sources
--     WHERE poi_metadata->>'editorial_backfill'='074b'.

BEGIN;

WITH cand AS (
  SELECT v.id AS v2_id, p.editorial_hook, p.local_insight, p.editorial_sources,
         p.updated_at
  FROM public.pois p
  JOIN v2.pois v ON (
    v.id = p.id
    OR (p.google_place_id IS NOT NULL AND v.google_place_id = p.google_place_id)
    OR (p.nsr_id IS NOT NULL AND v.nsr_id = p.nsr_id)
    OR (p.osm_id IS NOT NULL AND v.osm_id = p.osm_id))
  WHERE p.editorial_hook IS NOT NULL AND v.editorial_hook IS NULL
),
best AS (
  SELECT DISTINCT ON (v2_id) *
  FROM cand
  ORDER BY v2_id, updated_at DESC NULLS LAST
)
UPDATE v2.pois v
SET editorial_hook    = b.editorial_hook,
    local_insight     = COALESCE(v.local_insight, b.local_insight),
    editorial_sources = COALESCE(v.editorial_sources, b.editorial_sources),
    poi_metadata      = COALESCE(v.poi_metadata, '{}'::jsonb)
                          || '{"editorial_backfill": "074b"}'::jsonb
FROM best b
WHERE v.id = b.v2_id AND v.editorial_hook IS NULL;

COMMIT;

-- Verifikasjon:
SELECT 'backfyllte v2-rader (074b)' AS sjekk, count(*)::text AS verdi
  FROM v2.pois WHERE poi_metadata->>'editorial_backfill' = '074b'
UNION ALL
SELECT 'public-editorial uten v2-motpart (skal være 0)', count(*)::text
FROM public.pois p
WHERE p.editorial_hook IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM v2.pois v
    WHERE v.editorial_hook IS NOT NULL AND (
      v.id = p.id
      OR (p.google_place_id IS NOT NULL AND v.google_place_id = p.google_place_id)
      OR (p.nsr_id IS NOT NULL AND v.nsr_id = p.nsr_id)
      OR (p.osm_id IS NOT NULL AND v.osm_id = p.osm_id)
    )
  )
UNION ALL
SELECT 'm/ editorial i v2 totalt', count(*)::text
  FROM v2.pois WHERE editorial_hook IS NOT NULL;
