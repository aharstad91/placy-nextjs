-- Migration 067: Rename lowerNarrative / extendedBridgeText → leadText
--
-- Scope: products.config.reportConfig.themes[] for alle rader med product_type='report'.
-- Prod-data: 0 rader har lowerNarrative (defensive branch), 65 temaer har kun
-- extendedBridgeText som primærfelt. Se docs/brainstorms/2026-04-22-leadtext-refactor-brainstorm.md.
--
-- Hardening:
--   - NULLIF + COALESCE i CASE-branches hopper forbi empty-string/null-verdier
--   - COALESCE rundt subquery = safety-net mot NULL-subquery (bevarer original array)
--   - WHERE-guards:
--       product_type = 'report'                      (scope eksplisitt)
--       jsonb_typeof(themes) = 'array'               (hindrer exception hvis themes er objekt)
--       jsonb_array_length(themes) > 0               (hindrer NULL fra jsonb_agg på tom array)

BEGIN;

UPDATE products p
SET config = jsonb_set(
  config,
  '{reportConfig,themes}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN COALESCE(NULLIF(theme->>'lowerNarrative', ''), NULL) IS NOT NULL THEN
            (theme - 'lowerNarrative' - 'extendedBridgeText')
              || jsonb_build_object('leadText', theme->'lowerNarrative')
          WHEN COALESCE(NULLIF(theme->>'extendedBridgeText', ''), NULL) IS NOT NULL THEN
            (theme - 'extendedBridgeText')
              || jsonb_build_object('leadText', theme->'extendedBridgeText')
          ELSE theme
        END
      )
      FROM jsonb_array_elements(p.config->'reportConfig'->'themes') AS theme
    ),
    p.config->'reportConfig'->'themes'
  )
)
WHERE p.product_type = 'report'
  AND p.config->'reportConfig'->'themes' IS NOT NULL
  AND jsonb_typeof(p.config->'reportConfig'->'themes') = 'array'
  AND jsonb_array_length(p.config->'reportConfig'->'themes') > 0;

COMMIT;

-- Verifiseringsqueries (kjør etter COMMIT):
--
--   -- Residual: må returnere 0 rader
--   SELECT id, project_id
--   FROM products
--   WHERE config->'reportConfig'->'themes' @? '$[*].lowerNarrative'
--      OR config->'reportConfig'->'themes' @? '$[*].extendedBridgeText';
--
--   -- Per-rad post-count (sammenlign med pre-count CSV tatt før migrasjon):
--   SELECT
--     p.id,
--     p.project_id,
--     (SELECT COUNT(*)
--      FROM jsonb_array_elements(p.config->'reportConfig'->'themes') t
--      WHERE COALESCE(NULLIF(t->>'leadText',''), NULL) IS NOT NULL
--     ) AS themes_with_lead
--   FROM products p
--   WHERE p.product_type = 'report'
--     AND p.config->'reportConfig'->'themes' IS NOT NULL;
