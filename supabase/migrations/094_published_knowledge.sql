-- =============================================================================
-- Migrasjon 094 — én deduplisert published_knowledge-projeksjon
-- =============================================================================
-- `publication_eligible` er strukturell: godkjent, og for tidsfølsomme claims
-- med eksplisitt valid_until. Datoporten vurderes i viewet ved HVER lesning.
-- Dermed blir en framtidig claim synlig på valid_from og forsvinner etter
-- valid_until uten reimport eller cronjobb.
--
-- Promotert place_knowledge vinner når samme source_claim_id finnes begge
-- steder. Ledger-raden beholdes for revisjon, men vises ikke dobbelt.
-- =============================================================================

BEGIN;

ALTER TABLE v2.place_knowledge
  ADD COLUMN source_claim_id text;

CREATE UNIQUE INDEX place_knowledge_source_claim_id_uniq
  ON v2.place_knowledge (source_claim_id)
  WHERE source_claim_id IS NOT NULL;

CREATE OR REPLACE FUNCTION v2.set_research_claim_publication_eligibility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.publication_eligible :=
    NEW.review_status = 'approved'
    OR (
      NEW.review_status = 'approved_time_sensitive'
      AND NEW.valid_until IS NOT NULL
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER research_claims_publication_eligibility
  BEFORE INSERT OR UPDATE OF review_status, valid_until
  ON v2.research_claims
  FOR EACH ROW
  EXECUTE FUNCTION v2.set_research_claim_publication_eligibility();

UPDATE v2.research_claims
SET publication_eligible =
  review_status = 'approved'
  OR (review_status = 'approved_time_sensitive' AND valid_until IS NOT NULL);

CREATE VIEW v2.published_knowledge
WITH (security_invoker = true)
AS
  SELECT
    'place:' || pk.id AS id,
    pk.source_claim_id,
    NULL::text AS project_id,
    pk.poi_id,
    CASE WHEN pk.poi_id IS NOT NULL THEN 'global_place' ELSE 'address' END AS scope,
    COALESCE(pk.poi_id, pk.area_id, pk.id) AS subject_id,
    NULL::text AS subject_name,
    pk.topic,
    pk.topic AS field,
    pk.fact_text,
    pk.structured_data,
    pk.confidence,
    CASE WHEN pk.source_url IS NULL THEN '{}'::text[] ELSE ARRAY[pk.source_url] END AS source_urls,
    CASE WHEN pk.source_name IS NULL THEN '{}'::text[] ELSE ARRAY[pk.source_name] END AS source_titles,
    'approved'::text AS review_status,
    'existing'::text AS temporal_kind,
    pk.verified_at::date AS observed_at,
    NULL::date AS valid_from,
    NULL::date AS valid_until,
    true AS reusable_across_boards,
    NULL::text AS board_id,
    CASE WHEN pk.poi_id IS NULL THEN 'not_applicable' ELSE 'mapped' END AS mapping_status
  FROM v2.place_knowledge pk
  WHERE pk.display_ready = true

  UNION ALL

  SELECT
    'research:' || rc.id::text AS id,
    rc.claim_id AS source_claim_id,
    rc.project_id,
    rc.mapped_poi_id AS poi_id,
    rc.scope,
    rc.subject_id,
    entity.name AS subject_name,
    entity.entity_kind AS topic,
    rc.field,
    COALESCE(
      rc.approved_copy,
      CASE
        WHEN jsonb_typeof(rc.value) = 'string' THEN rc.value #>> '{}'
        ELSE rc.value::text
      END
    ) AS fact_text,
    rc.value AS structured_data,
    rc.confidence,
    rc.source_urls,
    rc.source_titles,
    rc.review_status,
    rc.temporal_kind,
    rc.observed_at,
    rc.valid_from,
    rc.valid_until,
    rc.reusable_across_boards,
    rc.board_id,
    rc.mapping_status
  FROM v2.research_claims rc
  JOIN v2.research_entities entity
    ON entity.package_hash = rc.package_hash
   AND entity.entity_id = rc.subject_id
  WHERE rc.superseded_at IS NULL
    AND rc.publication_eligible = true
    AND (rc.valid_from IS NULL OR rc.valid_from <= current_date)
    AND (rc.valid_until IS NULL OR rc.valid_until >= current_date)
    AND NOT EXISTS (
      SELECT 1
      FROM v2.place_knowledge promoted
      WHERE promoted.source_claim_id = rc.claim_id
        AND promoted.display_ready = true
    );

REVOKE ALL ON v2.published_knowledge FROM PUBLIC, anon, authenticated;
GRANT SELECT ON v2.published_knowledge TO service_role;

REVOKE EXECUTE ON FUNCTION
  v2.set_research_claim_publication_eligibility() FROM PUBLIC;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Rollback (før viewet tas i bruk):
-- DROP VIEW v2.published_knowledge;
-- DROP TRIGGER research_claims_publication_eligibility ON v2.research_claims;
-- DROP FUNCTION v2.set_research_claim_publication_eligibility();
-- DROP INDEX v2.place_knowledge_source_claim_id_uniq;
-- ALTER TABLE v2.place_knowledge DROP COLUMN source_claim_id;
