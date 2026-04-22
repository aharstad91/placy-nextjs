-- Rollback for migration 067: leadText → extendedBridgeText
--
-- PRIMÆR ROLLBACK: restore fra pg_dump tatt før 067 kjørt.
-- DETTE ER SEKUNDÆR BEST-EFFORT, kun trygg hvis ingen leadText-skrivinger
-- har skjedd etter 067 (dvs. skill-filer eller generator-kode har ikke
-- skrevet nytt innhold).
--
-- Før denne SQL kjøres: git revert på kode + skill-endringer som har
-- deployet leadText-navnet. Ellers kan rapport-generering skrive
-- extendedBridgeText mens koden leser leadText → stille data-tap.
--
-- Reverser til extendedBridgeText (matcher prod-state før 067), ikke
-- lowerNarrative. Prod hadde 0 rader med lowerNarrative før migrasjon.
--
-- Samme hardening-mønster som forward: NULLIF-guard, COALESCE safety-net,
-- jsonb_typeof='array' og jsonb_array_length > 0 i WHERE.

BEGIN;

UPDATE products p
SET config = jsonb_set(
  config,
  '{reportConfig,themes}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN COALESCE(NULLIF(theme->>'leadText', ''), NULL) IS NOT NULL THEN
            (theme - 'leadText')
              || jsonb_build_object('extendedBridgeText', theme->'leadText')
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

-- Verifisering etter rollback:
--
--   -- Må returnere 0 rader (ingen leadText igjen):
--   SELECT id, project_id
--   FROM products
--   WHERE config->'reportConfig'->'themes' @? '$[*].leadText';
--
--   -- Må vise extendedBridgeText for alle temaer som tidligere hadde leadText:
--   SELECT id, project_id,
--     jsonb_path_query_array(config->'reportConfig'->'themes', '$[*].extendedBridgeText')
--   FROM products
--   WHERE product_type = 'report';
