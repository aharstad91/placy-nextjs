-- =============================================================================
-- Migrasjon 086 — v2.postal_areas (Kartverkets postnummerområde-polygoner)
-- =============================================================================
-- HVA: Ny tabell v2.postal_areas — ett polygon per geografisk postnummer,
-- importert fra Kartverkets «Postnummerområder» (Geonorge-uuid
-- 462a5297-33ef-438a-82a5-07fff5799be3) via WFS.
--
-- HVORFOR: Placy kan i dag ikke svare på «hvilke steder dekker vi?». 37 av 46
-- rader i v2.areas mangler `boundary`, og geofencen (findAreaForPoint) krever
-- BÅDE boundary og report_editorial — det avviste 16 av 35 boliger i et reelt
-- meglerprosjekt, ikke fordi kunnskapen manglet, men fordi ingen hadde tegnet en
-- form. Postnummer er nøkkelen megleren faktisk har: Kartverkets adresse-API gir
-- postnummeret direkte fra en adresse, gratis og uten nøkkel. Med polygonene i
-- basen kan `areas.boundary` avledes som en MultiPolygon av områdets
-- `postal_codes`, og dekning blir tellbar per postnummer.
--
-- HVORFOR EGEN TABELL OG IKKE RADER I v2.areas: dette er referansegeometri vi
-- HENTER fra Kartverket, ikke kuraterte Placy-strøk vi EIER. 114 postnummerrader
-- i `areas` ville mer enn tredoblet tabellen, gjort `level`-feltet meningsløst,
-- og blandet de to datalagene. Koblingen mellom lagene er `areas.postal_codes`,
-- en kolonne som allerede finnes (skrevet av scripts/curate-area.ts) men som
-- fram til nå ikke har hatt noen leser.
--
-- MIGRASJONSNUMMERET: denne branchen er tatt fra `main` og har lokalt bare
-- migrasjoner t.o.m. 080. Men 081, 082, 084 og 085 ER kjørt i produksjon fra
-- andre brancher (broker_offices, coverage_demand, pois.grounding,
-- event_types_utforsk), og 083 ligger utracket i hovedrepoet. 086 er derfor
-- riktig neste nummer selv om det ser ut som et hopp i denne mappa —
-- databasen er sannheten, ikke filnavnene her. Sjekk `ls supabase/migrations/`
-- i alle worktrees før neste nummer velges.
--
-- FORM:
--   postnummer        text PK   -- «0010» er gyldig; som tall blir det 10
--   poststed          text      -- «RANHEIM». Flere postnumre deler poststed
--   kommunenummer     text      -- «5001». Rapporten grupperer på denne
--   kommunenavn       text      -- fra vår egen kommunekonstant, ikke fra WFS
--   boundary          jsonb     -- GeoJSON MultiPolygon, [lng, lat]
--   source_local_id   text      -- Kartverkets lokalId, for sporing tilbake
--   source_updated_at timestamptz -- Kartverkets oppdateringsdato
--   imported_at       timestamptz -- vår kjøring
--
-- HVORFOR jsonb OG IKKE PostGIS-geometri: point-in-polygon gjøres i TypeScript
-- (lib/utils/geo.ts::pointInGeometry) i hele kodebasen, og v2.areas.boundary er
-- allerede jsonb. PostGIS her ville gitt to konkurrerende sannheter om geometri
-- i samme system.
--
-- HVORFOR CHECK PÅ MultiPolygon: `pointInGeometry` håndterer både Polygon og
-- MultiPolygon, men vi normaliserer ALT til MultiPolygon ved import — også
-- postnumre med én flate. Én form i basen er enklere å avlede fra enn to, og
-- CHECK-en gjør normaliseringen strukturell i stedet for en konvensjon
-- importscriptet kan glemme.
--
-- HVORFOR CHECK PÅ POSTNUMMERFORMAT: den mest sannsynlige stille feilen i denne
-- importen er at et postnummer blir behandlet som tall et sted i kjeden, slik at
-- «0010» blir «10». CHECK-en fanger det ved skriving i stedet for at det dukker
-- opp som et manglende oppslag måneder senere.
--
-- KJØRES via psql direkte (CLAUDE.md — `supabase db push` fungerer ikke med vår
-- nummerering). Additiv og reversibel (se ROLLBACK).
-- =============================================================================

BEGIN;

CREATE TABLE v2.postal_areas (
  postnummer        text        NOT NULL,
  poststed          text        NOT NULL,
  kommunenummer     text        NOT NULL,
  kommunenavn       text        NOT NULL,
  boundary          jsonb       NOT NULL,
  source_local_id   text,
  source_updated_at timestamptz,
  imported_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (postnummer),
  CONSTRAINT postal_areas_postnummer_format
    CHECK (postnummer ~ '^[0-9]{4}$'),
  CONSTRAINT postal_areas_boundary_is_multipolygon
    CHECK (boundary->>'type' = 'MultiPolygon')
);

-- Dekningsrapporten grupperer og summerer per kommune.
CREATE INDEX postal_areas_kommunenummer_idx
  ON v2.postal_areas (kommunenummer);

-- service_role: eksplisitt grant (nye objekter arver ikke 070s ALL TABLES-grant
-- — samme fallgruve som 082 dokumenterte).
GRANT SELECT, INSERT, UPDATE, DELETE ON v2.postal_areas TO service_role;

-- default-deny: RLS på, INGEN anon/authenticated-policy → service-role-only.
-- Legg ALDRI tilbake en USING(true)-policy for anon (jf. 076/077).
ALTER TABLE v2.postal_areas ENABLE ROW LEVEL SECURITY;

COMMIT;

-- PostgREST-skjemacache: reload så tabellen blir synlig uten å vente på neste
-- auto-reload.
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFISERING ETTER KJØRING:
--   -- 1) tabellen finnes og er tom
--   SELECT count(*) FROM v2.postal_areas;                       -- forvent 0
--
--   -- 2) postnummerformat håndheves (skal FEILE)
--   INSERT INTO v2.postal_areas
--     (postnummer, poststed, kommunenummer, kommunenavn, boundary)
--   VALUES ('705', 'X', '5001', 'Trondheim',
--           '{"type":"MultiPolygon","coordinates":[]}'::jsonb);
--
--   -- 3) Polygon avvises, MultiPolygon godtas (første skal FEILE, andre OK)
--   INSERT INTO v2.postal_areas
--     (postnummer, poststed, kommunenummer, kommunenavn, boundary)
--   VALUES ('7056', 'RANHEIM', '5001', 'Trondheim',
--           '{"type":"Polygon","coordinates":[]}'::jsonb);
--   INSERT INTO v2.postal_areas
--     (postnummer, poststed, kommunenummer, kommunenavn, boundary)
--   VALUES ('7056', 'RANHEIM', '5001', 'Trondheim',
--           '{"type":"MultiPolygon","coordinates":[]}'::jsonb);
--   DELETE FROM v2.postal_areas WHERE postnummer = '7056';
--
--   -- 4) REST svarer 200 med service-role + Accept-Profile: v2,
--   --    og anon-nøkkelen får IKKE lese (RLS default-deny)
--
-- ROLLBACK (kjør KUN hvis 086 må angres):
--   DROP TABLE v2.postal_areas;
-- =============================================================================
