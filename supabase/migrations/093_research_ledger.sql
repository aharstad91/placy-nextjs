-- =============================================================================
-- Migrasjon 093 — versjonert researchledger
-- =============================================================================
-- Lagrer hele reviewresultatet fra en researchpakke. Tabellene er audit-only
-- og service-role-only; ordinære boards skal senere lese en kontrollert
-- published_knowledge-projeksjon, aldri rå ledger-rader direkte.
--
-- full_snapshot/delta håndteres atomisk av importøren:
--   * ny versjon av samme claim_id supersederer den aktive versjonen
--   * full_snapshot supersederer også aktive claims som mangler i samme scope
--   * delta lar claims som ikke er med stå aktive
-- =============================================================================

BEGIN;

CREATE TABLE v2.research_packages (
  package_hash   text        NOT NULL,
  package_id     text        NOT NULL,
  schema_version integer     NOT NULL,
  project_id     text        NOT NULL,
  project_name   text        NOT NULL,
  package_mode   text        NOT NULL,
  scope_key      text        NOT NULL,
  reviewed_at    date        NOT NULL,
  source_path    text,
  imported_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (package_hash),
  CONSTRAINT research_packages_project_package_uniq
    UNIQUE (project_id, package_id),
  CONSTRAINT research_packages_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES v2.projects(id) ON DELETE CASCADE,
  CONSTRAINT research_packages_schema_version_check
    CHECK (schema_version = 1),
  CONSTRAINT research_packages_mode_check
    CHECK (package_mode IN ('full_snapshot', 'delta'))
);

CREATE TABLE v2.research_entities (
  package_hash          text        NOT NULL,
  entity_id             text        NOT NULL,
  canonical_id          text        NOT NULL,
  name                  text        NOT NULL,
  entity_kind           text        NOT NULL,
  scope                 text        NOT NULL,
  geography             text        NOT NULL,
  reusable_across_boards boolean    NOT NULL,
  reuse_constraints     text,
  board_id              text,
  mapping_status        text        NOT NULL,
  mapped_poi_id         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (package_hash, entity_id),
  CONSTRAINT research_entities_package_hash_fkey
    FOREIGN KEY (package_hash) REFERENCES v2.research_packages(package_hash)
    ON DELETE CASCADE,
  CONSTRAINT research_entities_mapped_poi_id_fkey
    FOREIGN KEY (mapped_poi_id) REFERENCES v2.pois(id),
  CONSTRAINT research_entities_scope_check
    CHECK (scope IN ('global_place', 'project', 'address', 'board_view')),
  CONSTRAINT research_entities_mapping_status_check
    CHECK (mapping_status IN ('mapped', 'unmapped', 'not_applicable', 'rejected')),
  CONSTRAINT research_entities_mapping_shape_check
    CHECK ((mapping_status = 'mapped') = (mapped_poi_id IS NOT NULL))
);

CREATE TABLE v2.research_claims (
  id                     uuid        NOT NULL DEFAULT gen_random_uuid(),
  package_hash           text        NOT NULL,
  project_id             text        NOT NULL,
  scope_key              text        NOT NULL,
  claim_id               text        NOT NULL,
  subject_id             text        NOT NULL,
  canonical_id           text        NOT NULL,
  scope                  text        NOT NULL,
  geography              text        NOT NULL,
  field                  text        NOT NULL,
  value                  jsonb       NOT NULL,
  temporal_kind          text        NOT NULL,
  review_status          text        NOT NULL,
  source_urls            text[]      NOT NULL DEFAULT '{}',
  source_titles          text[]      NOT NULL DEFAULT '{}',
  source_type            text,
  source_date            text,
  observed_at            date        NOT NULL,
  valid_from             date,
  valid_until            date,
  confidence             text        NOT NULL,
  conflict_notes         text,
  editorial_note         text,
  approved_copy          text,
  reason                 text,
  reusable_across_boards boolean     NOT NULL,
  reuse_constraints      text,
  board_id               text,
  mapping_status         text        NOT NULL,
  mapped_poi_id          text,
  publication_eligible   boolean     NOT NULL DEFAULT false,
  superseded_at          timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT research_claims_package_claim_uniq
    UNIQUE (package_hash, claim_id),
  CONSTRAINT research_claims_package_hash_fkey
    FOREIGN KEY (package_hash) REFERENCES v2.research_packages(package_hash)
    ON DELETE CASCADE,
  CONSTRAINT research_claims_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES v2.projects(id) ON DELETE CASCADE,
  CONSTRAINT research_claims_subject_fkey
    FOREIGN KEY (package_hash, subject_id)
    REFERENCES v2.research_entities(package_hash, entity_id) ON DELETE CASCADE,
  CONSTRAINT research_claims_mapped_poi_id_fkey
    FOREIGN KEY (mapped_poi_id) REFERENCES v2.pois(id),
  CONSTRAINT research_claims_scope_check
    CHECK (scope IN ('global_place', 'project', 'address', 'board_view')),
  CONSTRAINT research_claims_temporal_kind_check
    CHECK (temporal_kind IN (
      'existing', 'regulated', 'planned', 'marketed',
      'under_construction', 'inference', 'absence_of_evidence', 'historical'
    )),
  CONSTRAINT research_claims_review_status_check
    CHECK (review_status IN (
      'approved', 'approved_time_sensitive', 'historical', 'unresolved', 'rejected'
    )),
  CONSTRAINT research_claims_confidence_check
    CHECK (confidence IN ('low', 'medium', 'high')),
  CONSTRAINT research_claims_mapping_status_check
    CHECK (mapping_status IN ('mapped', 'unmapped', 'not_applicable', 'rejected')),
  CONSTRAINT research_claims_mapping_shape_check
    CHECK ((mapping_status = 'mapped') = (mapped_poi_id IS NOT NULL)),
  CONSTRAINT research_claims_validity_order_check
    CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from <= valid_until),
  CONSTRAINT research_claims_publication_check
    CHECK (
      publication_eligible = false OR
      review_status = 'approved' OR
      (review_status = 'approved_time_sensitive' AND valid_until IS NOT NULL)
    )
);

-- Én aktiv versjon av en stabil claim innen prosjekt og pakkescope.
CREATE UNIQUE INDEX research_claims_current_uniq
  ON v2.research_claims (project_id, scope_key, claim_id)
  WHERE superseded_at IS NULL;

CREATE INDEX research_claims_current_project_idx
  ON v2.research_claims (project_id, scope_key, review_status)
  WHERE superseded_at IS NULL;

CREATE INDEX research_claims_mapped_poi_idx
  ON v2.research_claims (mapped_poi_id)
  WHERE mapped_poi_id IS NOT NULL AND superseded_at IS NULL;

-- Ett RPC-kall = én Postgres-transaksjon. Enhver constraint-/FK-feil ruller
-- tilbake både pakke, entiteter, supersedering og claims.
CREATE OR REPLACE FUNCTION v2.import_research_package(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_hash       text := p_payload->>'package_hash';
  v_project_id text := p_payload->>'project_id';
  v_scope_key  text := p_payload->>'scope_key';
  v_mode       text := p_payload->>'package_mode';
  v_imported   timestamptz := now();
  v_entities   integer := 0;
  v_claims     integer := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM v2.research_packages WHERE package_hash = v_hash
  ) THEN
    RETURN jsonb_build_object(
      'status', 'unchanged',
      'package_hash', v_hash,
      'entities', 0,
      'claims', 0
    );
  END IF;

  INSERT INTO v2.research_packages (
    package_hash, package_id, schema_version, project_id, project_name,
    package_mode, scope_key, reviewed_at, source_path, imported_at
  ) VALUES (
    v_hash,
    p_payload->>'package_id',
    (p_payload->>'schema_version')::integer,
    v_project_id,
    p_payload->>'project_name',
    v_mode,
    v_scope_key,
    (p_payload->>'reviewed_at')::date,
    NULLIF(p_payload->>'source_path', ''),
    v_imported
  );

  INSERT INTO v2.research_entities (
    package_hash, entity_id, canonical_id, name, entity_kind, scope,
    geography, reusable_across_boards, reuse_constraints, board_id,
    mapping_status, mapped_poi_id
  )
  SELECT
    v_hash,
    entity->>'entity_id',
    entity->>'canonical_id',
    entity->>'name',
    entity->>'entity_kind',
    entity->>'scope',
    entity->>'geography',
    (entity->>'reusable_across_boards')::boolean,
    NULLIF(entity->>'reuse_constraints', ''),
    NULLIF(entity->>'board_id', ''),
    entity->>'mapping_status',
    NULLIF(entity->>'mapped_poi_id', '')
  FROM jsonb_array_elements(p_payload->'entities') AS entity;
  GET DIAGNOSTICS v_entities = ROW_COUNT;

  -- Ny versjon av en medsendt claim erstatter alltid den gamle. Et komplett
  -- snapshot erstatter i tillegg aktive claims som ikke lenger er med.
  UPDATE v2.research_claims existing
  SET superseded_at = v_imported
  WHERE existing.project_id = v_project_id
    AND existing.scope_key = v_scope_key
    AND existing.superseded_at IS NULL
    AND (
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_payload->'claims') AS incoming
        WHERE incoming->>'claim_id' = existing.claim_id
      )
      OR (
        v_mode = 'full_snapshot'
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(p_payload->'claims') AS incoming
          WHERE incoming->>'claim_id' = existing.claim_id
        )
      )
    );

  INSERT INTO v2.research_claims (
    package_hash, project_id, scope_key, claim_id, subject_id, canonical_id,
    scope, geography, field, value, temporal_kind, review_status,
    source_urls, source_titles, source_type, source_date, observed_at,
    valid_from, valid_until, confidence, conflict_notes, editorial_note,
    approved_copy, reason, reusable_across_boards, reuse_constraints,
    board_id, mapping_status, mapped_poi_id, publication_eligible
  )
  SELECT
    v_hash,
    v_project_id,
    v_scope_key,
    claim->>'claim_id',
    claim->>'subject_id',
    claim->>'canonical_id',
    claim->>'scope',
    claim->>'geography',
    claim->>'field',
    claim->'value',
    claim->>'temporal_kind',
    claim->>'review_status',
    ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(claim->'source_urls', '[]'::jsonb))
    ),
    ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(claim->'source_titles', '[]'::jsonb))
    ),
    NULLIF(claim->>'source_type', ''),
    NULLIF(claim->>'source_date', ''),
    (claim->>'observed_at')::date,
    NULLIF(claim->>'valid_from', '')::date,
    NULLIF(claim->>'valid_until', '')::date,
    claim->>'confidence',
    NULLIF(claim->>'conflict_notes', ''),
    NULLIF(claim->>'editorial_note', ''),
    NULLIF(claim->>'approved_copy', ''),
    NULLIF(claim->>'reason', ''),
    (claim->>'reusable_across_boards')::boolean,
    NULLIF(claim->>'reuse_constraints', ''),
    NULLIF(claim->>'board_id', ''),
    claim->>'mapping_status',
    NULLIF(claim->>'mapped_poi_id', ''),
    CASE
      WHEN claim->>'review_status' = 'approved'
        THEN (NULLIF(claim->>'valid_from', '') IS NULL
          OR NULLIF(claim->>'valid_from', '')::date <= current_date)
          AND (NULLIF(claim->>'valid_until', '') IS NULL
            OR NULLIF(claim->>'valid_until', '')::date >= current_date)
      WHEN claim->>'review_status' = 'approved_time_sensitive'
        THEN NULLIF(claim->>'valid_until', '') IS NOT NULL
          AND NULLIF(claim->>'valid_until', '')::date >= current_date
          AND (NULLIF(claim->>'valid_from', '') IS NULL
            OR NULLIF(claim->>'valid_from', '')::date <= current_date)
      ELSE false
    END
  FROM jsonb_array_elements(p_payload->'claims') AS claim;
  GET DIAGNOSTICS v_claims = ROW_COUNT;

  RETURN jsonb_build_object(
    'status', 'imported',
    'package_hash', v_hash,
    'entities', v_entities,
    'claims', v_claims
  );
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  v2.research_packages, v2.research_entities, v2.research_claims
TO service_role;

ALTER TABLE v2.research_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.research_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.research_claims ENABLE ROW LEVEL SECURITY;
-- Ingen anon/authenticated-policy: researchledgeren er service-role-only.

REVOKE EXECUTE ON FUNCTION v2.import_research_package(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION v2.import_research_package(jsonb) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Rollback (kun før avhengige projeksjoner tas i bruk):
-- DROP TABLE v2.research_claims;
-- DROP TABLE v2.research_entities;
-- DROP TABLE v2.research_packages;
