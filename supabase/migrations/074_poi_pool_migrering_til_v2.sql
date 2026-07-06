-- 074: Bulk-migrering av POI-poolen public.pois → v2.pois (Andreas-godkjent
-- 2026-07-06: «Migrer til v2»). KJØRES I XHIGH-SESJON — masse-mutasjon mot prod.
--
-- Fakta lagt til grunn (målt 2026-07-06):
--   • public.pois: 5 327 rader (2 640 m/ editorial = Lokalkunnskap/Moat 1)
--   • 263 finnes alt i v2 via place/nsr/osm-id → hoppes over
--   • Interne duplikater: 14 place_id-dupes + 76 navn+koordinat-dupes blant
--     de 3 119 uten ekstern id → kanonisk rad velges (editorial foretrekkes)
--   • 347 id-overlapp public.pois.id ↔ v2.pois.id — ALLE samme fysiske sted
--     (347/347 samme koordinat, 0 motstridende; verifisert i kjøre-sesjonen)
--   • Kolonne-paritet public.pois = v2.pois (verifisert, 53 kolonner)
--
-- REVERSIBILITET: alle innsatte rader tagges poi_metadata.pool_migration='074'
--   → angre = DELETE FROM v2.pois WHERE poi_metadata->>'pool_migration'='074'
--     (plus revert av place_knowledge/translations-remappene under).
--
-- Kjør ETTER 072/073. Etterpå: re-kjør IKKE 072 (dekkes av steg 3 her).

BEGIN;

-- ---------------------------------------------------------------------------
-- Steg 0: Kanonisk nøkkel per fysisk sted + valg av kanonisk public-rad
-- (editorial-rik rad vinner; deretter nyeste)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _canon AS
SELECT DISTINCT ON (place_key) id AS canon_pub_id, place_key
FROM (
  SELECT id,
    COALESCE(
      'g:' || google_place_id,
      'n:' || nsr_id,
      'o:' || osm_id,
      'x:' || lower(name) || ':' || round(lat::numeric, 4) || ':' || round(lng::numeric, 4)
    ) AS place_key,
    editorial_hook, updated_at
  FROM public.pois
) x
ORDER BY place_key, (editorial_hook IS NOT NULL) DESC, updated_at DESC NULLS LAST;

-- ---------------------------------------------------------------------------
-- Steg 1: Komplett kart public-id → v2-id.
--   a) Sted finnes alt i v2 (place/nsr/osm) → eksisterende v2-id
--   b) Ellers: kanonisk rad gjenbruker public-id-en (begge id-kolonner er
--      TEXT — målt 2026-07-06; alle 347 id-overlapp er samme fysiske sted,
--      så gjenbruk er trygt og ON CONFLICT (id) DO NOTHING dekker dem)
--   c) Duplikat-rader peker på sin kanoniske rads v2-id
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _pool_map AS
WITH canon_v2 AS (
  SELECT c.place_key, c.canon_pub_id,
    COALESCE(ex.id, c.canon_pub_id) AS v2_id,
    (ex.id IS NOT NULL) AS already_in_v2
  FROM _canon c
  JOIN public.pois p ON p.id = c.canon_pub_id
  LEFT JOIN LATERAL (
    SELECT v.id FROM v2.pois v WHERE
      (p.google_place_id IS NOT NULL AND v.google_place_id = p.google_place_id)
      OR (p.nsr_id IS NOT NULL AND v.nsr_id = p.nsr_id)
      OR (p.osm_id IS NOT NULL AND v.osm_id = p.osm_id)
    ORDER BY v.id LIMIT 1
  ) ex ON true
)
SELECT p.id AS pub_id, cv.v2_id, cv.already_in_v2, cv.canon_pub_id
FROM public.pois p
JOIN _canon c ON c.place_key = COALESCE(
    'g:' || p.google_place_id,
    'n:' || p.nsr_id,
    'o:' || p.osm_id,
    'x:' || lower(p.name) || ':' || round(p.lat::numeric, 4) || ':' || round(p.lng::numeric, 4))
JOIN canon_v2 cv ON cv.place_key = c.place_key;

-- ---------------------------------------------------------------------------
-- Steg 2: Sett inn kanoniske rader som ikke alt finnes i v2
-- ---------------------------------------------------------------------------
INSERT INTO v2.pois (
  id, name, lat, lng, address, category_id, google_place_id, google_rating,
  google_review_count, google_maps_url, photo_reference, editorial_hook,
  local_insight, story_priority, editorial_sources, featured_image, description,
  entur_stopplace_id, bysykkel_station_id, hyre_station_id, created_at,
  updated_at, trust_score, trust_flags, trust_score_updated_at, google_website,
  google_business_status, google_price_level, poi_tier, tier_reason, is_chain,
  is_local_gem, poi_metadata, tier_evaluated_at, area_id, opening_hours_json,
  google_phone, opening_hours_updated_at, facebook_url, gallery_images,
  photo_resolved_at, source, nsr_id, barnehagefakta_id, osm_id, event_dates,
  event_time_start, event_time_end, event_description, event_url, event_tags,
  parent_poi_id, anchor_summary
)
SELECT
  m.v2_id, p.name, p.lat, p.lng, p.address, p.category_id, p.google_place_id,
  p.google_rating, p.google_review_count, p.google_maps_url, p.photo_reference,
  p.editorial_hook, p.local_insight, p.story_priority, p.editorial_sources,
  p.featured_image, p.description, p.entur_stopplace_id, p.bysykkel_station_id,
  p.hyre_station_id, p.created_at, p.updated_at, p.trust_score, p.trust_flags,
  p.trust_score_updated_at, p.google_website, p.google_business_status,
  p.google_price_level, p.poi_tier, p.tier_reason, p.is_chain, p.is_local_gem,
  COALESCE(p.poi_metadata, '{}'::jsonb) || '{"pool_migration": "074"}'::jsonb,
  p.tier_evaluated_at, p.area_id, p.opening_hours_json, p.google_phone,
  p.opening_hours_updated_at, p.facebook_url, p.gallery_images,
  p.photo_resolved_at, p.source, p.nsr_id, p.barnehagefakta_id, p.osm_id,
  p.event_dates, p.event_time_start, p.event_time_end, p.event_description,
  p.event_url, p.event_tags, p.parent_poi_id, p.anchor_summary
FROM _pool_map m
JOIN public.pois p ON p.id = m.canon_pub_id AND p.id = m.pub_id  -- kun kanoniske
WHERE NOT m.already_in_v2
ON CONFLICT (id) DO NOTHING;

-- parent_poi_id peker på public-id-er → remap til v2-id-er (etter insert)
UPDATE v2.pois v
SET parent_poi_id = m.v2_id::text
FROM _pool_map m
WHERE v.poi_metadata->>'pool_migration' = '074'
  AND v.parent_poi_id = m.pub_id;

-- ---------------------------------------------------------------------------
-- Steg 3: Fullfør remappene som ventet på poolen
-- ---------------------------------------------------------------------------
-- 3a. place_knowledge: 114 danglende rader (poi_id = public-id)
UPDATE v2.place_knowledge pk
SET poi_id = m.v2_id::text
FROM _pool_map m
WHERE pk.poi_id = m.pub_id
  AND NOT EXISTS (SELECT 1 FROM v2.pois v WHERE v.id::text = pk.poi_id);

-- 3b. resterende poi-translations (slug-æraen — 072 dekket kun ekstern-id-match)
INSERT INTO v2.translations (id, locale, entity_type, entity_id, field, value, created_at, updated_at)
SELECT t.id, t.locale, t.entity_type, m.v2_id::text, t.field, t.value, t.created_at, t.updated_at
FROM public.translations t
JOIN _pool_map m ON m.pub_id = t.entity_id
WHERE t.entity_type = 'poi'
ON CONFLICT (locale, entity_type, entity_id, field) DO NOTHING;

DROP TABLE _canon;
DROP TABLE _pool_map;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verifikasjon (kjøres etter COMMIT):
-- ---------------------------------------------------------------------------
SELECT 'v2.pois totalt' AS sjekk, count(*)::text AS verdi FROM v2.pois
UNION ALL
SELECT 'derav pool-migrert (074)', count(*)::text FROM v2.pois WHERE poi_metadata->>'pool_migration' = '074'
UNION ALL
SELECT 'm/ editorial i v2', count(*)::text FROM v2.pois WHERE editorial_hook IS NOT NULL
UNION ALL
SELECT 'danglende place_knowledge (skal være 0)', count(*)::text
  FROM v2.place_knowledge pk WHERE pk.poi_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM v2.pois v WHERE v.id::text = pk.poi_id)
UNION ALL
SELECT 'poi-translations i v2', count(*)::text FROM v2.translations WHERE entity_type = 'poi';
