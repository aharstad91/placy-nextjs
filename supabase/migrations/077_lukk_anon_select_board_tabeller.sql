-- =============================================================================
-- Migrasjon 077 — Lukk anon/authenticated SELECT på board-tabellene i v2
-- =============================================================================
-- HVA: Trekker tilbake SELECT-grant for BÅDE anon og authenticated på de 11
-- board-tabellene i v2, og sletter de åpne SELECT-policyene (USING(true), samt
-- place_knowledge sin USING(display_ready=true)). Etter dette kan KUN service_role
-- (som bypasser RLS) lese disse tabellene. RLS forblir aktivert (default-deny).
--
-- HVORFOR: Board-flaten er 100% server-rendret. Etter migrasjon 077 leser
-- lib/supabase/v2-queries.ts og lib/supabase/translations.ts via service-role-
-- nøkkelen på serveren (createServerClient, bypasser RLS). Den offentlige anon-
-- nøkkelen ble tidligere brukt som board-lesevei, men GRANT + USING(true)-
-- policyene fra 070_baseline gjorde at HELE innholdet i disse tabellene var fritt
-- lesbart av enhver med prosjekt-URL + anon-nøkkel via PostgREST
-- (bekreftet live 2026-07-06: GET /rest/v1/pois?select=* med Accept-Profile: v2
-- returnerte 5 386 rader). Dette er Lokalkunnskap-moaten. Vi lukker anon-
-- eksponeringen på hele board-datasettet. Samme klasse som collections-PII-lekken
-- (lukkes av 076).
--
-- collections HÅNDTERES IKKE HER — lukkes av migrasjon 076. Ikke dupliser.
--
-- authenticated tas MED i revoke: Placy har ingen innloggingsflyt (ingen per-
-- bruker-auth, jf. lib/admin/require-admin.ts), så authenticated-rollen er
-- uoppnåelig i dag. Å la den beholde USING(true)-bulklesing ville vært et latent
-- hull idet en auth-flyt en gang legges til. Vi lukker den nå (default-deny);
-- en fremtidig innlogget board-flyt må da designe scoped RLS eksplisitt.
--
-- KJØRES IKKE AUTOMATISK — xhigh-review kreves før produksjonskjøring.
-- Kode-forutsetning: v2-queries.ts + translations.ts MÅ være deployet på
-- service-role FØR denne kjøres (ellers dør boardene). Verifiser board-render
-- etter kode-deploy, deretter kjør denne.
-- =============================================================================

BEGIN;

-- Fjern SELECT-grant for anon OG authenticated (table-privilege). Kombinert med
-- DROP POLICY under er dette dobbel sikring.
REVOKE SELECT ON
  v2.areas, v2.categories, v2.category_slugs, v2.pois, v2.products,
  v2.product_categories, v2.product_pois, v2.project_pois, v2.projects,
  v2.translations, v2.place_knowledge
FROM anon, authenticated;

-- Slett de åpne SELECT-policyene. Uten policy nekter RLS all ikke-service-role-
-- lesing (default-deny). Policy-navn verifisert mot 070_baseline (linje 399-412).
DROP POLICY IF EXISTS areas_anon_select                  ON v2.areas;
DROP POLICY IF EXISTS categories_anon_select             ON v2.categories;
DROP POLICY IF EXISTS category_slugs_anon_select         ON v2.category_slugs;
DROP POLICY IF EXISTS pois_anon_select                   ON v2.pois;
DROP POLICY IF EXISTS products_anon_select               ON v2.products;
DROP POLICY IF EXISTS product_categories_anon_select     ON v2.product_categories;
DROP POLICY IF EXISTS product_pois_anon_select           ON v2.product_pois;
DROP POLICY IF EXISTS project_pois_anon_select           ON v2.project_pois;
DROP POLICY IF EXISTS projects_anon_select               ON v2.projects;
DROP POLICY IF EXISTS translations_anon_select           ON v2.translations;
DROP POLICY IF EXISTS place_knowledge_display_ready_select ON v2.place_knowledge;

-- RLS forblir aktivert (ingen DISABLE ROW LEVEL SECURITY). service_role bypasser
-- RLS og påvirkes ikke — board-lesestien fungerer uendret.

COMMIT;

-- =============================================================================
-- VERIFISERING ETTER KJØRING (to lag)
-- =============================================================================
-- 1. NEGATIV (anon skal nå nektes) — MERK: Accept-Profile: v2 er påkrevd, ellers
--    treffer kallet public-skjemaet og gir 404 uansett (falsk PASS):
--      source .env.local && curl -s -o /dev/null -w "%{http_code}\n" \
--        "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/pois?select=id&limit=1" \
--        -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
--        -H "Accept-Profile: v2"
--    -> forvent 401 (permission denied). Gjenta for: products, areas, categories,
--       category_slugs, translations, product_pois, product_categories,
--       project_pois, projects, place_knowledge.
-- 2. POSITIV (boardene skal fortsatt rendre via service-role): åpne de 6 board-
--    URLene i nystartet Chrome, verifiser POI-er + editorial + 0 konsollfeil.
--
-- =============================================================================
-- ROLLBACK (kjør KUN hvis 077 forårsaket board-nedetid) — gjenoppretter 070-
-- baseline-tilstanden EKSAKT (anon + authenticated SELECT + åpne policyer):
-- =============================================================================
-- BEGIN;
-- GRANT SELECT ON
--   v2.areas, v2.categories, v2.category_slugs, v2.pois, v2.products,
--   v2.product_categories, v2.product_pois, v2.project_pois, v2.projects,
--   v2.translations, v2.place_knowledge
-- TO anon, authenticated;
-- CREATE POLICY areas_anon_select              ON v2.areas              FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY categories_anon_select         ON v2.categories         FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY category_slugs_anon_select     ON v2.category_slugs     FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY pois_anon_select               ON v2.pois               FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY products_anon_select           ON v2.products           FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY product_categories_anon_select ON v2.product_categories FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY product_pois_anon_select       ON v2.product_pois       FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY project_pois_anon_select       ON v2.project_pois       FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY projects_anon_select           ON v2.projects           FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY translations_anon_select       ON v2.translations       FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY place_knowledge_display_ready_select ON v2.place_knowledge FOR SELECT TO anon, authenticated USING (display_ready = true);
-- COMMIT;
