-- ============================================
-- Add missing category slugs for SEO-relevant categories
-- ============================================
INSERT INTO category_slugs (category_id, locale, slug, seo_title)
SELECT v.category_id, v.locale, v.slug, v.seo_title
FROM (VALUES
  ('park', 'no', 'parker', 'Parker i Trondheim'),
  ('park', 'en', 'parks', 'Parks in Trondheim'),
  ('badeplass', 'no', 'badeplasser', 'Badeplasser i Trondheim'),
  ('badeplass', 'en', 'swimming-spots', 'Swimming Spots in Trondheim'),
  ('lekeplass', 'no', 'lekeplasser', 'Lekeplasser i Trondheim'),
  ('lekeplass', 'en', 'playgrounds', 'Playgrounds in Trondheim'),
  ('hundepark', 'no', 'hundeparker', 'Hundeparker i Trondheim'),
  ('hundepark', 'en', 'dog-parks', 'Dog Parks in Trondheim'),
  ('outdoor', 'no', 'utendorsaktiviteter', 'Utendørsaktiviteter i Trondheim'),
  ('outdoor', 'en', 'outdoor-activities', 'Outdoor Activities in Trondheim')
) AS v(category_id, locale, slug, seo_title)
WHERE EXISTS (SELECT 1 FROM categories c WHERE c.id = v.category_id)
ON CONFLICT (category_id, locale) DO NOTHING;

-- ============================================
-- Add intro texts for top SEO categories (Norwegian)
-- ============================================
UPDATE category_slugs SET intro_text =
  'Trondheim har et mangfoldig restauranttilbud — fra Michelin-stjerner på Speilsalen og Credo til koselige nabolagsrestauranter i Bakklandet og på Solsiden. Byen er et av Norges sterkeste matbyer, med et kjøkken som feirer lokale råvarer fra Trøndelag. Her finner du alt fra fine dining til uformelle burgerbarer og autentisk asiatisk.'
WHERE category_id = 'restaurant' AND locale = 'no';

UPDATE category_slugs SET intro_text =
  'Trondheims kaféscene er levende og variert. Fra prisvinnende kaffebrennere som Jacobsen & Svart og Pala til sjarmerende kaféer i trehusene langs Bakklandet. Studentbyen gir en unik energi til kafélivet — her finner du alt fra stille lesekroker til livlige brunchsteder.'
WHERE category_id = 'cafe' AND locale = 'no';

UPDATE category_slugs SET intro_text =
  'Utforsk barscenen i Trondheim — fra cocktailbarer i sentrum til lokale ølbarer med håndbrygget fra trønderske mikrobryggeri. Solsiden og Nedre Elvehavn er populære områder med uteservering om sommeren, mens Bakklandet byr på intime puber med karakter.'
WHERE category_id = 'bar' AND locale = 'no';

UPDATE category_slugs SET intro_text =
  'Trondheim og omegn har flotte badeplasser for varme sommerdager. Fra Korsvika og Sjøbadet på Lade til Munkholmen midt i fjorden. Flere steder har sandstrand, stupebrett og tilrettelagte fasiliteter. Badesesongen varer typisk fra juni til august.'
WHERE category_id = 'badeplass' AND locale = 'no';

UPDATE category_slugs SET intro_text =
  'Trondheim er en grønn by med mange flotte parker og friområder. Fra den historiske Ringve Botaniske Hage til Bymarka med sine turstier og badevannet Lianvatnet. Byens parker er populære for piknik, jogging og rekreasjon året rundt.'
WHERE category_id = 'park' AND locale = 'no';

-- ============================================
-- Add intro texts for top SEO categories (English)
-- ============================================
UPDATE category_slugs SET intro_text =
  'Trondheim boasts a diverse restaurant scene — from Michelin-starred Speilsalen and Credo to cozy neighborhood eateries in Bakklandet and Solsiden. The city is one of Norway''s strongest food cities, celebrating local ingredients from the Trøndelag region.'
WHERE category_id = 'restaurant' AND locale = 'en';

UPDATE category_slugs SET intro_text =
  'Trondheim''s café scene is vibrant and varied. From award-winning coffee roasters like Jacobsen & Svart and Pala to charming cafés in the wooden houses along Bakklandet. The student city brings unique energy — find everything from quiet reading nooks to lively brunch spots.'
WHERE category_id = 'cafe' AND locale = 'en';

UPDATE category_slugs SET intro_text =
  'Explore Trondheim''s bar scene — from cocktail bars downtown to local craft beer pubs featuring Trøndelag microbreweries. Solsiden and Nedre Elvehavn are popular for summer outdoor seating, while Bakklandet offers intimate pubs with character.'
WHERE category_id = 'bar' AND locale = 'en';

UPDATE category_slugs SET intro_text =
  'Trondheim and surroundings offer great swimming spots for warm summer days. From Korsvika and Sjøbadet at Lade to Munkholmen island in the fjord. Several spots have sandy beaches, diving boards and facilities. Swimming season typically runs June through August.'
WHERE category_id = 'badeplass' AND locale = 'en';

UPDATE category_slugs SET intro_text =
  'Trondheim is a green city with many beautiful parks and outdoor areas. From the historic Ringve Botanical Garden to Bymarka with its hiking trails and swimming lake Lianvatnet. The city''s parks are popular for picnics, jogging and recreation year-round.'
WHERE category_id = 'park' AND locale = 'en';
