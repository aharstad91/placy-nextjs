-- =============================================================================
-- Migrasjon 080 — Sekundærindekser på v2-kjernegrafen
-- =============================================================================
-- HVA: Indekser på FK-kolonnene fra migrasjon 079 + pois.category_id. v2 hadde
-- kun PK-er og events-indeksene — alle FK-side-oppslag gikk via seq scan:
--   - project_pois/product_pois har composite PK med project_id/product_id
--     FØRST, så poi_id-siden er udekket → CASCADE-sletting av en POI (079)
--     scanner hele jointabellen per rad
--   - products.project_id (produktoppslag per prosjekt i board-lesestien)
--   - projects.customer_id (NO ACTION-sjekken ved kunde-sletting + admin-filter)
--   - pois.category_id (kategori-filtrering/tellinger i admin)
--
-- HVORFOR NÅ: Tabellene er små i dag (1 237 rader i jointabellene, 5 386 pois)
-- så dette er forsikring, ikke akutt — men grunnpakke/kjede-modellen er planen
-- om å skalere antall boards kraftig, og FK-kolonner-skal-ha-indeks bør være
-- vane fra linje 1. Indeksene er billige (små tabeller, lav skrivefrekvens).
--
-- ROLLBACK: DROP INDEX v2.<navn> for hver av de 5.
-- =============================================================================

CREATE INDEX IF NOT EXISTS project_pois_poi_id_idx ON v2.project_pois (poi_id);
CREATE INDEX IF NOT EXISTS product_pois_poi_id_idx ON v2.product_pois (poi_id);
CREATE INDEX IF NOT EXISTS products_project_id_idx ON v2.products (project_id);
CREATE INDEX IF NOT EXISTS projects_customer_id_idx ON v2.projects (customer_id);
CREATE INDEX IF NOT EXISTS pois_category_id_idx ON v2.pois (category_id);
