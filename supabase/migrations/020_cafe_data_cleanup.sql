-- ============================================
-- 020: Café data cleanup
-- Remove duplicates and misclassified POIs by setting
-- trust_score below MIN_TRUST_SCORE (0.5) so they are
-- filtered out of public queries.
-- ============================================

-- ============================================
-- 1. DUPLICATES — keep the one with highest review count,
--    suppress the other(s) with trust_score = 0.1
-- ============================================

-- Jacobsen & Svart — keep the one with most reviews
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Jacobsen%Svart%'
  AND category_id = 'cafe'
  AND id != (
    SELECT id FROM pois
    WHERE name ILIKE '%Jacobsen%Svart%' AND category_id = 'cafe'
    ORDER BY COALESCE(google_review_count, 0) DESC
    LIMIT 1
  );

-- Sellanraa — keep the one with most reviews
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Sellanraa%'
  AND category_id = 'cafe'
  AND id != (
    SELECT id FROM pois
    WHERE name ILIKE '%Sellanraa%' AND category_id = 'cafe'
    ORDER BY COALESCE(google_review_count, 0) DESC
    LIMIT 1
  );

-- Godt Brød Thomas Angells gate — keep the one with most reviews
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Godt Brød%Thomas Angell%'
  AND category_id = 'cafe'
  AND id != (
    SELECT id FROM pois
    WHERE name ILIKE '%Godt Brød%Thomas Angell%' AND category_id = 'cafe'
    ORDER BY COALESCE(google_review_count, 0) DESC
    LIMIT 1
  );

-- Godt Brød Solsiden — keep the one with most reviews
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Godt Brød%Solsiden%'
  AND category_id = 'cafe'
  AND id != (
    SELECT id FROM pois
    WHERE name ILIKE '%Godt Brød%Solsiden%' AND category_id = 'cafe'
    ORDER BY COALESCE(google_review_count, 0) DESC
    LIMIT 1
  );

-- Jordbærpikene Solsiden — keep the one with most reviews
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Jordbærpikene%Solsiden%'
  AND category_id = 'cafe'
  AND id != (
    SELECT id FROM pois
    WHERE name ILIKE '%Jordbærpikene%Solsiden%' AND category_id = 'cafe'
    ORDER BY COALESCE(google_review_count, 0) DESC
    LIMIT 1
  );

-- ============================================
-- 2. MISCLASSIFIED — suppress non-cafés
-- These are not cafés and should not appear in the café listing.
-- ============================================

UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE category_id = 'cafe'
  AND name IN (
    'TRD Nutrition Herbalife',
    'Online linjeforening',
    'YX 7-Eleven',
    'TEKS Kunstsenter',
    'Mellom Social Space',
    'SITO Stripa',
    'Sit Kafe Elektro',
    'Cafe-Sito Realfagbygget'
  );

-- Also try ILIKE for slight name variations
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE category_id = 'cafe'
  AND trust_score IS DISTINCT FROM 0.1  -- skip already updated
  AND (
    name ILIKE '%TRD Nutrition%'
    OR name ILIKE '%Online linjeforening%'
    OR name ILIKE '%YX 7-Eleven%'
    OR name ILIKE '%TEKS Kunstsenter%'
    OR name ILIKE '%Mellom Social Space%'
    OR name ILIKE '%SITO Stripa%'
    OR name ILIKE '%Sit Kafe Elektro%'
    OR name ILIKE '%Cafe-Sito Realfag%'
    OR name ILIKE '%Café-Sito Realfag%'
  );
