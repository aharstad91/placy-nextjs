-- =============================================================================
-- Migrasjon 079 — FK-er på kjernegrafen i v2 (projects/customers/pois-koblingene)
-- =============================================================================
-- HVA: Legger til 6 foreign keys på v2-kjernegrafen:
--   1. projects.customer_id      → customers.id      (NO ACTION — beskytt prosjekter)
--   2. project_pois.project_id   → projects.id       (CASCADE — ren jointabell)
--   3. project_pois.poi_id       → pois.id           (CASCADE — ren jointabell)
--   4. products.project_id       → projects.id       (CASCADE — product eies av prosjekt)
--   5. product_pois.product_id   → products.id       (CASCADE — ren jointabell)
--   6. product_pois.poi_id       → pois.id           (CASCADE — ren jointabell)
--
-- HVORFOR: v2 hadde NULL foreign keys (kun PK-er). PostgREST krever FK for å
-- resolve nested selects, så to kodeveier var døde med PGRST200:
--   - app/admin/projects/[id]/page.tsx: `customers (id, name)`-join → notFound()
--     for ALLE prosjekter (admin-detaljsiden 404-et, bekreftet i Chrome 2026-07-06)
--   - lib/utils/fetch-poi-photos.ts: `pois(...)`-join på project_pois
-- FK-ene gir samtidig integritetsvern på kjernegrafen (Lokalkunnskap-moaten):
-- ingen dinglende project_pois/product_pois etter POI-sletting, og kunder med
-- prosjekter kan ikke slettes stille fra admin (FK-feil surfaces i UI).
--
-- ON DELETE-valg: jointabeller + products CASCADE-er (medlemskap skal dø med
-- parent — matcher dagens manuelle delete-rekkefølge i admin). customer→projects
-- er NO ACTION med vilje: å slette en kunde skal IKKE rive med seg prosjekter.
--
-- FORUTSETNING (verifisert mot prod 2026-07-06 FØR kjøring): 0 orphans på alle
-- 5 relasjoner (project_pois→projects/pois, products→projects,
-- product_pois→products/pois). DO-blokken under re-verifiserer ved kjøretid og
-- aborterer med feilmelding hvis data har driftet siden sjekken.
--
-- ROLLBACK: ALTER TABLE ... DROP CONSTRAINT for hver av de 6 constraint-navnene.
-- =============================================================================

BEGIN;

-- Kjøretids-vern: aborter hvis orphans har oppstått etter pre-sjekken
DO $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM v2.projects p
    LEFT JOIN v2.customers c ON c.id = p.customer_id
    WHERE p.customer_id IS NOT NULL AND c.id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'orphans: projects.customer_id (%)', n; END IF;

  SELECT count(*) INTO n FROM v2.project_pois pp
    LEFT JOIN v2.projects p ON p.id = pp.project_id WHERE p.id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'orphans: project_pois.project_id (%)', n; END IF;

  SELECT count(*) INTO n FROM v2.project_pois pp
    LEFT JOIN v2.pois po ON po.id = pp.poi_id WHERE po.id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'orphans: project_pois.poi_id (%)', n; END IF;

  SELECT count(*) INTO n FROM v2.products pr
    LEFT JOIN v2.projects p ON p.id = pr.project_id WHERE p.id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'orphans: products.project_id (%)', n; END IF;

  SELECT count(*) INTO n FROM v2.product_pois pp
    LEFT JOIN v2.products pr ON pr.id = pp.product_id WHERE pr.id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'orphans: product_pois.product_id (%)', n; END IF;

  SELECT count(*) INTO n FROM v2.product_pois pp
    LEFT JOIN v2.pois po ON po.id = pp.poi_id WHERE po.id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'orphans: product_pois.poi_id (%)', n; END IF;
END $$;

ALTER TABLE v2.projects
  ADD CONSTRAINT projects_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES v2.customers(id);

ALTER TABLE v2.project_pois
  ADD CONSTRAINT project_pois_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES v2.projects(id) ON DELETE CASCADE;

ALTER TABLE v2.project_pois
  ADD CONSTRAINT project_pois_poi_id_fkey
  FOREIGN KEY (poi_id) REFERENCES v2.pois(id) ON DELETE CASCADE;

ALTER TABLE v2.products
  ADD CONSTRAINT products_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES v2.projects(id) ON DELETE CASCADE;

ALTER TABLE v2.product_pois
  ADD CONSTRAINT product_pois_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES v2.products(id) ON DELETE CASCADE;

ALTER TABLE v2.product_pois
  ADD CONSTRAINT product_pois_poi_id_fkey
  FOREIGN KEY (poi_id) REFERENCES v2.pois(id) ON DELETE CASCADE;

COMMIT;

-- PostgREST cacher skjema-relasjoner — uten reload ser den ikke de nye FK-ene
-- og nested selects fortsetter å feile med PGRST200 til neste auto-reload.
NOTIFY pgrst, 'reload schema';
