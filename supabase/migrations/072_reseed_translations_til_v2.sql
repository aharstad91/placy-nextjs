-- 072: Re-seed public.translations → v2.translations med id-remap (drop-plan §3).
--
-- entity_id-remap per entity_type:
--   poi:    public.pois.id (text) → v2.pois.id (uuid) via google_place_id,
--           fallback nsr_id, fallback osm_id. Slug-æra-id-er (ikke i public.pois
--           med identitetsnøkkel) kopieres IKKE — dekket av git-backupen
--           (docs/rebuild/backup-public-translations-2026-07-06.json).
--   theme:  rene tema-id-strenger kopieres as-is; kompositter
--           `<productUuid>_<themeId>` (36 tegn uuid + '_') får produkt-delen
--           remappet via prosjekt-slug-join (customer_id + url_slug + product_type).
--   report: entity_id = produkt-uuid → samme produkt-remap.
--
-- RE-KJØRBAR: ON CONFLICT DO NOTHING på både PK og unique-nøkkelen
-- (locale, entity_type, entity_id, field). MÅ re-kjøres etter hver ny
-- provisjonering av et board med EN-oversettelser, og fullføres FØR
-- public-droppen (mapping-kilden public.pois/products forsvinner da).

-- Produkt-remap-kart (public produkt-uuid → v2 produkt-uuid)
CREATE TEMP TABLE _prod_map AS
SELECT pp.id::text AS pub_id, vp.id::text AS v2_id
FROM public.products pp
JOIN public.projects pj ON pj.id = pp.project_id
JOIN v2.projects vj ON vj.customer_id = pj.customer_id AND vj.url_slug = pj.url_slug
JOIN v2.products vp ON vp.project_id = vj.id AND vp.product_type = pp.product_type;

-- POI-remap-kart (public poi-id → deterministisk ÉN v2 poi-id)
CREATE TEMP TABLE _poi_map AS
SELECT DISTINCT ON (p.id) p.id AS pub_id, v.id::text AS v2_id
FROM public.pois p
JOIN v2.pois v ON (
  (p.google_place_id IS NOT NULL AND v.google_place_id = p.google_place_id)
  OR (p.google_place_id IS NULL AND p.nsr_id IS NOT NULL AND v.nsr_id = p.nsr_id)
  OR (p.google_place_id IS NULL AND p.nsr_id IS NULL AND p.osm_id IS NOT NULL AND v.osm_id = p.osm_id)
)
ORDER BY p.id, v.id;

-- 1. poi-rader
INSERT INTO v2.translations (id, locale, entity_type, entity_id, field, value, created_at, updated_at)
SELECT t.id, t.locale, t.entity_type, m.v2_id, t.field, t.value, t.created_at, t.updated_at
FROM public.translations t
JOIN _poi_map m ON m.pub_id = t.entity_id
WHERE t.entity_type = 'poi'
ON CONFLICT (locale, entity_type, entity_id, field) DO NOTHING;

-- 2. theme-rader, rene tema-id-er (ikke uuid-prefikset komposit)
INSERT INTO v2.translations (id, locale, entity_type, entity_id, field, value, created_at, updated_at)
SELECT t.id, t.locale, t.entity_type, t.entity_id, t.field, t.value, t.created_at, t.updated_at
FROM public.translations t
WHERE t.entity_type = 'theme'
  AND t.entity_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_'
ON CONFLICT (locale, entity_type, entity_id, field) DO NOTHING;

-- 3. theme-rader, komposit <productUuid>_<themeId> → remap produkt-delen
INSERT INTO v2.translations (id, locale, entity_type, entity_id, field, value, created_at, updated_at)
SELECT t.id, t.locale, t.entity_type, m.v2_id || substring(t.entity_id FROM 37), t.field, t.value, t.created_at, t.updated_at
FROM public.translations t
JOIN _prod_map m ON m.pub_id = substring(t.entity_id, 1, 36)
WHERE t.entity_type = 'theme'
  AND t.entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_'
ON CONFLICT (locale, entity_type, entity_id, field) DO NOTHING;

-- 4. report-rader (entity_id = produkt-uuid)
INSERT INTO v2.translations (id, locale, entity_type, entity_id, field, value, created_at, updated_at)
SELECT t.id, t.locale, t.entity_type, m.v2_id, t.field, t.value, t.created_at, t.updated_at
FROM public.translations t
JOIN _prod_map m ON m.pub_id = t.entity_id
WHERE t.entity_type = 'report'
ON CONFLICT (locale, entity_type, entity_id, field) DO NOTHING;

DROP TABLE _prod_map;
DROP TABLE _poi_map;

-- Verifikasjon (kjøres etter): antall per entity_type i v2.translations
SELECT entity_type, count(*) FROM v2.translations GROUP BY entity_type ORDER BY 1;
