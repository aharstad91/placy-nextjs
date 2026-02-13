-- ============================================
-- Areas (cities/regions for public site)
-- ============================================
CREATE TABLE areas (
  id TEXT PRIMARY KEY,
  name_no TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug_no TEXT NOT NULL UNIQUE,
  slug_en TEXT NOT NULL UNIQUE,
  description_no TEXT,
  description_en TEXT,
  center_lat DECIMAL NOT NULL,
  center_lng DECIMAL NOT NULL,
  zoom_level INTEGER DEFAULT 13,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link POIs to areas
ALTER TABLE pois ADD COLUMN area_id TEXT REFERENCES areas(id);
CREATE INDEX idx_pois_area_id ON pois(area_id);

-- ============================================
-- Category slugs for public SEO pages (i18n)
-- ============================================
CREATE TABLE category_slugs (
  category_id TEXT REFERENCES categories(id),
  locale TEXT NOT NULL CHECK (locale IN ('no', 'en')),
  slug TEXT NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  intro_text TEXT,
  PRIMARY KEY (category_id, locale)
);

CREATE INDEX idx_category_slugs_slug ON category_slugs(slug, locale);

-- ============================================
-- Seed: Trondheim
-- ============================================
INSERT INTO areas (id, name_no, name_en, slug_no, slug_en, center_lat, center_lng, zoom_level)
VALUES ('trondheim', 'Trondheim', 'Trondheim', 'trondheim', 'trondheim', 63.4305, 10.3951, 13);

-- Set area_id for all existing Trondheim POIs
UPDATE pois SET area_id = 'trondheim' WHERE area_id IS NULL;

-- ============================================
-- Seed: Category slugs (NO + EN)
-- Only inserts for categories that actually exist in the database
-- ============================================
INSERT INTO category_slugs (category_id, locale, slug, seo_title)
SELECT v.category_id, v.locale, v.slug, v.seo_title
FROM (VALUES
  ('restaurant', 'no', 'restauranter', 'Restauranter i Trondheim'),
  ('restaurant', 'en', 'restaurants', 'Restaurants in Trondheim'),
  ('cafe', 'no', 'kafeer', 'Kafeer i Trondheim'),
  ('cafe', 'en', 'cafes', 'Cafes in Trondheim'),
  ('bar', 'no', 'barer', 'Barer i Trondheim'),
  ('bar', 'en', 'bars', 'Bars in Trondheim'),
  ('bakery', 'no', 'bakerier', 'Bakerier i Trondheim'),
  ('bakery', 'en', 'bakeries', 'Bakeries in Trondheim'),
  ('museum', 'no', 'museer', 'Museer i Trondheim'),
  ('museum', 'en', 'museums', 'Museums in Trondheim'),
  ('cinema', 'no', 'kinoer', 'Kinoer i Trondheim'),
  ('cinema', 'en', 'cinemas', 'Cinemas in Trondheim'),
  ('library', 'no', 'biblioteker', 'Biblioteker i Trondheim'),
  ('library', 'en', 'libraries', 'Libraries in Trondheim'),
  ('supermarket', 'no', 'dagligvare', 'Dagligvare i Trondheim'),
  ('supermarket', 'en', 'supermarkets', 'Supermarkets in Trondheim'),
  ('pharmacy', 'no', 'apotek', 'Apotek i Trondheim'),
  ('pharmacy', 'en', 'pharmacies', 'Pharmacies in Trondheim'),
  ('shopping', 'no', 'shopping', 'Shopping i Trondheim'),
  ('shopping', 'en', 'shopping', 'Shopping in Trondheim'),
  ('haircare', 'no', 'frisor', 'Frisører i Trondheim'),
  ('haircare', 'en', 'hair-salons', 'Hair Salons in Trondheim'),
  ('gym', 'no', 'treningssentre', 'Treningssentre i Trondheim'),
  ('gym', 'en', 'gyms', 'Gyms in Trondheim'),
  ('spa', 'no', 'spa', 'Spa i Trondheim'),
  ('spa', 'en', 'spas', 'Spas in Trondheim'),
  ('swimming', 'no', 'svommehaller', 'Svømmehaller i Trondheim'),
  ('swimming', 'en', 'swimming-pools', 'Swimming Pools in Trondheim'),
  ('sightseeing', 'no', 'severdigheter', 'Severdigheter i Trondheim'),
  ('sightseeing', 'en', 'sightseeing', 'Sightseeing in Trondheim'),
  ('food-drink', 'no', 'mat-og-drikke', 'Mat og drikke i Trondheim'),
  ('food-drink', 'en', 'food-and-drink', 'Food & Drink in Trondheim'),
  ('hotel', 'no', 'hoteller', 'Hoteller i Trondheim'),
  ('hotel', 'en', 'hotels', 'Hotels in Trondheim')
) AS v(category_id, locale, slug, seo_title)
WHERE EXISTS (SELECT 1 FROM categories c WHERE c.id = v.category_id)
ON CONFLICT (category_id, locale) DO NOTHING;

-- RLS: public read access for areas and category_slugs
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Areas are publicly readable" ON areas FOR SELECT USING (true);

ALTER TABLE category_slugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Category slugs are publicly readable" ON category_slugs FOR SELECT USING (true);
