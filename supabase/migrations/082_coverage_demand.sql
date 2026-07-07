-- =============================================================================
-- Migrasjon 082 — coverage_demand: etterspørselslogg for avviste adresser
-- =============================================================================
-- HVA: Ny tabell v2.coverage_demand + funksjon v2.record_coverage_demand().
-- Hver adresse som geofencen (findAreaForPoint) avviser fordi den ligger UTENFOR
-- kuratert dekning logges her — som styringsdata for hvilke strøk som kurateres
-- neste (via /curate-area). Egen tabell, IKKE en status-rad i generation_requests:
-- unngår kollisjon med 7-dagers-dup-sjekken (en avvist adresse som blir dekket
-- samme uke skal ikke blokkeres) og holder PII-grensen enkel.
--
-- DEDUP + TELLER: unik på (address_normalized, office_slug) med NULLS NOT
-- DISTINCT (PG15+; verifisert PG 17.6) slik at den ÅPNE sidens avvisninger
-- (office_slug = NULL) også dedupes. record_coverage_demand() gjør en atomisk
-- INSERT … ON CONFLICT DO UPDATE med hits+1 + last_seen_at=now() — retry-/demo-
-- støy skjevvrir ikke kurateringsprioriteringen (ren insert per treff ville det).
--
-- PII-GRENSE: `email` er valgfri og lagres KUN når record_coverage_demand kalles
-- med p_email != NULL — dvs. ved den EKSPLISITTE «varsle meg når stedet dekkes»-
-- opt-in-en (R17), ikke ved den vanlige avvisningen. COALESCE(EXCLUDED.email,
-- eksisterende) betyr at en senere opt-in KAN sette e-post, men et treff uten
-- e-post NULLER aldri en tidligere lagret. Service-role-only (RLS default-deny),
-- aldri eksponert i noe GET-svar — samme grense som generation_requests.
--
-- INGEN retensjonspolicy i piloten (akseptert prototype-tradeoff). service_role
-- trenger eksplisitt table-grant + EXECUTE på funksjonen (nye objekter arver
-- ikke 070s ALL TABLES-grant).
--
-- KJØRES via psql direkte (CLAUDE.md). Additiv + reversibel (se ROLLBACK).
-- =============================================================================

BEGIN;

CREATE TABLE v2.coverage_demand (
  id                 uuid             NOT NULL DEFAULT gen_random_uuid(),
  address            text             NOT NULL,
  address_normalized text             NOT NULL,
  geocoded_lat       double precision,
  geocoded_lng       double precision,
  office_slug        text,
  email              text,
  hits               integer          NOT NULL DEFAULT 1,
  first_seen_at      timestamptz      NOT NULL DEFAULT now(),
  last_seen_at       timestamptz      NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT coverage_demand_addr_office_uniq
    UNIQUE NULLS NOT DISTINCT (address_normalized, office_slug)
);

-- Atomisk «logg avvisning»: dedup på (address_normalized, office_slug), tell
-- hits, bevar/sett e-post via COALESCE. SECURITY INVOKER (default): kalles av
-- service_role som har INSERT/UPDATE-grant + BYPASSRLS.
CREATE OR REPLACE FUNCTION v2.record_coverage_demand(
  p_address            text,
  p_address_normalized text,
  p_lat                double precision,
  p_lng                double precision,
  p_office_slug        text,
  p_email              text
) RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO v2.coverage_demand
    (address, address_normalized, geocoded_lat, geocoded_lng, office_slug, email)
  VALUES
    (p_address, p_address_normalized, p_lat, p_lng, p_office_slug, p_email)
  ON CONFLICT (address_normalized, office_slug) DO UPDATE SET
    hits         = v2.coverage_demand.hits + 1,
    last_seen_at = now(),
    email        = COALESCE(EXCLUDED.email, v2.coverage_demand.email),
    geocoded_lat = COALESCE(v2.coverage_demand.geocoded_lat, EXCLUDED.geocoded_lat),
    geocoded_lng = COALESCE(v2.coverage_demand.geocoded_lng, EXCLUDED.geocoded_lng);
$$;

-- service_role: eksplisitt grant (nye objekter arver ikke 070s ALL TABLES-grant)
GRANT SELECT, INSERT, UPDATE, DELETE ON v2.coverage_demand TO service_role;

-- Funksjoner grantes EXECUTE til PUBLIC som default. Selv med SECURITY INVOKER
-- (INSERT-en ville feilet for anon som mangler table-grant) trekker vi EXECUTE
-- fra PUBLIC — defense-in-depth, samme default-deny-stance som RLS-en. Kun
-- service_role skal kunne kalle denne.
REVOKE EXECUTE ON FUNCTION v2.record_coverage_demand(
  text, text, double precision, double precision, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION v2.record_coverage_demand(
  text, text, double precision, double precision, text, text
) TO service_role;

-- default-deny: RLS på, INGEN anon/authenticated-policy → service-role-only.
ALTER TABLE v2.coverage_demand ENABLE ROW LEVEL SECURITY;

COMMIT;

-- PostgREST-skjemacache: reload så .schema("v2").rpc("record_coverage_demand")
-- og tabellen blir synlig uten å vente på neste auto-reload.
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFISERING ETTER KJØRING:
--   -- teller opp ved gjentatt treff (ikke ny rad):
--   SELECT v2.record_coverage_demand('Melhusvegen 1, Melhus','melhusvegen 1, melhus',63.0,10.2,NULL,NULL);
--   SELECT v2.record_coverage_demand('Melhusvegen 1, Melhus','melhusvegen 1, melhus',63.0,10.2,NULL,NULL);
--   SELECT address_normalized, office_slug, hits, email FROM v2.coverage_demand;
--   -- forvent: 1 rad, hits=2, email=NULL. Rydd opp: DELETE FROM v2.coverage_demand;
--
-- ROLLBACK (kjør KUN hvis 082 må angres):
--   DROP FUNCTION v2.record_coverage_demand(text,text,double precision,double precision,text,text);
--   DROP TABLE v2.coverage_demand;
-- =============================================================================
