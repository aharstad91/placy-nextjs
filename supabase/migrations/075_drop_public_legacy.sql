-- 075: DROP av hele public-legacy (r01.3). IRREVERSIBEL — KJØRES KUN I
-- XHIGH-SESJON etter at 074 (POI-pool-migrering) er kjørt og verifisert.
--
-- Gating (drop-plan §1): demo-paritet PASSERT 2026-07-06; Andreas' go GITT
-- 2026-07-06 («public kan vi nå slette, alt dette er gammelt rot»);
-- /effort xhigh settes i kjøre-sesjonen.
--
-- PRE-FLIGHT (kjør disse FØRST — alle må være sanne før droppen):
--   1. 074 kjørt: SELECT count(*) FROM v2.pois WHERE poi_metadata->>'pool_migration'='074';  -- > 4000
--   2. Ingen danglende place_knowledge:
--      SELECT count(*) FROM v2.place_knowledge pk WHERE pk.poi_id IS NOT NULL
--        AND NOT EXISTS (SELECT 1 FROM v2.pois v WHERE v.id::text = pk.poi_id);  -- = 0
--   3. Re-verifiser FK-kartet (kun interne public-FK-er, ingen kryss til v2):
--      SELECT count(*) FROM information_schema.table_constraints
--      WHERE constraint_type='FOREIGN KEY' AND table_schema='public';  -- 35 per 2026-07-06
--   4. Git-backupene finnes: docs/rebuild/backup-public-*-2026-07-06.json
--
-- Rekkefølge: barn før forelder (FK-kartet 2026-07-06). Plain DROP,
-- ingen CASCADE. Selve public-SKJEMAET beholdes (Supabase/PostgREST
-- forventer at det eksisterer; extensions/grants ligger der).

BEGIN;

DROP TABLE IF EXISTS public.section_pois;
DROP TABLE IF EXISTS public.theme_section_pois;
DROP TABLE IF EXISTS public.story_sections;
DROP TABLE IF EXISTS public.theme_story_sections;
DROP TABLE IF EXISTS public.theme_stories;
DROP TABLE IF EXISTS public.trip_stops;
DROP TABLE IF EXISTS public.project_trips;
DROP TABLE IF EXISTS public.trips;
DROP TABLE IF EXISTS public.project_pois_legacy;
DROP TABLE IF EXISTS public.projects_legacy;
DROP TABLE IF EXISTS public.collections;
DROP TABLE IF EXISTS public.product_pois;
DROP TABLE IF EXISTS public.product_categories;
DROP TABLE IF EXISTS public.products;
DROP TABLE IF EXISTS public.project_pois;
DROP TABLE IF EXISTS public.generation_requests;
DROP TABLE IF EXISTS public.projects;
DROP TABLE IF EXISTS public.place_knowledge;
DROP TABLE IF EXISTS public.pois;
DROP TABLE IF EXISTS public.category_slugs;
DROP TABLE IF EXISTS public.categories;
DROP TABLE IF EXISTS public.areas;
DROP TABLE IF EXISTS public.translations;
DROP TABLE IF EXISTS public.customers;

COMMIT;

-- POST-DROP-VERIFIKASJON (drop-plan §5):
--   1. SELECT count(*) FROM information_schema.tables
--      WHERE table_schema='public' AND table_type='BASE TABLE';  -- = 0
--   2. REST mot droppet tabell gir PostgREST-feil (ikke 200 med []):
--      curl "$SUPABASE_URL/rest/v1/trips?limit=1" -H "apikey: $ANON"
--   3. Alle v2-boards rendrer (smoke 200 + ett board i nystartet Chrome).
--   4. Fulle gates: tsc 0, lint 0 errors, alle tester, build.
