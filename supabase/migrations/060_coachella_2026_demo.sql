-- Migration: Coachella 2026 Festival Demo
-- Creates customer, project, categories, POIs, and linkage for a Coachella festival demo.
-- Demonstrates Placy for events/festivals.

BEGIN;

-- ============================================
-- 1. Festival-specific categories
-- ============================================
INSERT INTO categories (id, name, icon, color) VALUES
  -- Scener
  ('main_stage',       'Hovedscene',        'Music',       '#8b5cf6'),
  ('outdoor_stage',    'Utescene',          'Music2',      '#7c3aed'),
  ('tent_stage',       'Teltscene',         'Music3',      '#6d28d9'),
  ('dj_stage',         'DJ-scene',          'Disc3',       '#a855f7'),
  ('art_stage',        'Kunstscene',        'Palette',     '#c084fc'),
  -- Mat & Drikke
  ('food_vendor',      'Matbod',            'UtensilsCrossed', '#ef4444'),
  ('bar_festival',     'Bar',               'Beer',        '#dc2626'),
  ('water_station',    'Vannstasjon',       'Droplets',    '#38bdf8'),
  ('vip_dining',       'VIP Dining',        'Wine',        '#b91c1c'),
  -- Fasiliteter
  ('restroom',         'Toalett',           'Bath',        '#22c55e'),
  ('medical',          'Førstehjelp',       'Cross',       '#ef4444'),
  ('charging_festival','Ladestasjon',       'BatteryCharging', '#22c55e'),
  ('info_booth',       'Informasjon',       'Info',        '#3b82f6'),
  ('lockers',          'Garderobe',         'Lock',        '#22c55e'),
  -- Transport & Inngang
  ('entrance',         'Inngang',           'DoorOpen',    '#3b82f6'),
  ('parking_festival', 'Parkering',         'Car',         '#64748b'),
  ('shuttle',          'Shuttle',           'Bus',         '#3b82f6'),
  ('rideshare',        'Rideshare',         'Navigation',  '#3b82f6'),
  -- Kunst & Opplevelser
  ('art_installation', 'Kunstinstallasjon', 'Sparkles',    '#f59e0b'),
  ('merch',            'Merch',             'ShoppingBag', '#f59e0b'),
  ('sponsor_activation','Sponsor Lounge',   'Star',        '#f59e0b'),
  ('lounge',           'Lounge',            'Armchair',    '#f59e0b'),
  -- Camping
  ('campground',       'Camping',           'Tent',        '#10b981'),
  ('glamping',         'Glamping',          'Home',        '#10b981'),
  ('camping_hub',      'Camping Hub',       'Store',       '#10b981'),
  ('camping_showers',  'Dusj',              'ShowerHead',  '#10b981')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. Customer: Goldenvoice (Coachella promoter)
-- ============================================
INSERT INTO customers (id, name) VALUES
  ('goldenvoice', 'Goldenvoice')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. Project: Coachella 2026
-- Empire Polo Club center: 33.680176, -116.237099
-- ============================================
INSERT INTO projects (id, customer_id, name, url_slug, center_lat, center_lng, description, short_id, default_product, tags) VALUES
  ('goldenvoice_coachella-2026', 'goldenvoice', 'Coachella 2026', 'coachella-2026',
   33.6815, -116.2380,
   'Coachella Valley Music and Arts Festival 2026 — Empire Polo Club, Indio, California. April 10-12 & 17-19, 2026.',
   'cc2026x', 'explorer', ARRAY['Event'])
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. Product: Explorer
-- ============================================
INSERT INTO products (id, project_id, product_type, config, story_title, story_intro_text) VALUES
  ('goldenvoice_coachella-2026_explorer',
   'goldenvoice_coachella-2026',
   'explorer',
   '{}'::jsonb,
   'Coachella 2026',
   'Utforsk festivalområdet — finn scener, mat, fasiliteter og opplevelser.')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. POIs — Scener (8 stages)
-- Coordinates estimated from aerial photography of Empire Polo Club.
-- The festival grounds span the polo fields, oriented roughly NW-SE.
-- Coachella Stage is in the NW, tents are in the central-east area.
-- ============================================

-- COACHELLA STAGE (Main Stage) — NW corner of the festival grounds
INSERT INTO pois (id, name, lat, lng, category_id, description, address) VALUES
  ('cc26-stage-coachella', 'Coachella Stage', 33.6835, -116.2408, 'main_stage',
   'Hovedscenen — Coachella''s ikoniske hovedscene for headlinere og store artister. Sabrina Carpenter (fredag), Justin Bieber (lørdag), Karol G (søndag).',
   'Empire Polo Club, Indio, CA');

-- OUTDOOR THEATRE — East of main stage
INSERT INTO pois (id, name, lat, lng, category_id, description, address) VALUES
  ('cc26-stage-outdoor', 'Outdoor Theatre', 33.6828, -116.2378, 'outdoor_stage',
   'Utescene for mellomstore til store artister. Disclosure, David Byrne, BigBang og Laufey.',
   'Empire Polo Club, Indio, CA');

-- SAHARA TENT — Large tent in the SE area
INSERT INTO pois (id, name, lat, lng, category_id, description, address) VALUES
  ('cc26-stage-sahara', 'Sahara Tent', 33.6795, -116.2345, 'tent_stage',
   'Stor teltscene for elektronisk musikk og high-energy shows. Sexyy Red, Rezz, Kaskade.',
   'Empire Polo Club, Indio, CA');

-- MOJAVE TENT — Central-east area
INSERT INTO pois (id, name, lat, lng, category_id, description, address) VALUES
  ('cc26-stage-mojave', 'Mojave Tent', 33.6812, -116.2358, 'tent_stage',
   'Teltscene for indie, rock og alternativ musikk. Blood Orange, Interpol, FKA Twigs, Iggy Pop.',
   'Empire Polo Club, Indio, CA');

-- GOBI TENT — Near Mojave
INSERT INTO pois (id, name, lat, lng, category_id, description, address) VALUES
  ('cc26-stage-gobi', 'Gobi Tent', 33.6808, -116.2348, 'tent_stage',
   'Teltscene for verdensmusikk, indie og nye artister. Creepy Nuts, Davido, The Rapture.',
   'Empire Polo Club, Indio, CA');

-- SONORA TENT — Smaller tent
INSERT INTO pois (id, name, lat, lng, category_id, description, address) VALUES
  ('cc26-stage-sonora', 'Sonora Tent', 33.6818, -116.2368, 'tent_stage',
   'Intim teltscene for punk, indie og oppdagelser. Hot Mulligan, Wednesday, Model/Actriz.',
   'Empire Polo Club, Indio, CA');

-- YUMA TENT — Southeast corner
INSERT INTO pois (id, name, lat, lng, category_id, description, address) VALUES
  ('cc26-stage-yuma', 'Yuma Tent', 33.6790, -116.2338, 'dj_stage',
   'Innendørs DJ-scene for house, techno og electronic. Gordo, Armin van Buuren x Adam Beyer, Røyksopp.',
   'Empire Polo Club, Indio, CA');

-- QUASAR STAGE — South area
INSERT INTO pois (id, name, lat, lng, category_id, description, address) VALUES
  ('cc26-stage-quasar', 'Quasar', 33.6785, -116.2375, 'dj_stage',
   'Storskala DJ-scene. Deep Dish, David Guetta, Fatboy Slim.',
   'Empire Polo Club, Indio, CA');

-- DO LAB — Southwest, art/music area
INSERT INTO pois (id, name, lat, lng, category_id, description, address) VALUES
  ('cc26-stage-dolab', 'Do LaB', 33.6822, -116.2418, 'art_stage',
   'Kunstnerisk scene med overraskelser, art og elektronisk musikk. Andy C, Tinashe, OMNOM.',
   'Empire Polo Club, Indio, CA');

-- ============================================
-- 6. POIs — Mat & Drikke (~15 vendors)
-- Spread across the festival grounds
-- ============================================

INSERT INTO pois (id, name, lat, lng, category_id, description) VALUES
  ('cc26-food-nobu', 'Nobu', 33.6820, -116.2390, 'food_vendor',
   'Eksklusiv japansk mat fra den verdensberømte restaurantkjeden.'),
  ('cc26-food-villas-tacos', 'Villa''s Tacos', 33.6815, -116.2385, 'food_vendor',
   'LA-favoritt med autentiske mexicanske tacos.'),
  ('cc26-food-love-hour', 'Love Hour', 33.6810, -116.2393, 'food_vendor',
   'Populær LA-restaurant med kreativ meny.'),
  ('cc26-food-court-north', 'Food Court Nord', 33.6825, -116.2395, 'food_vendor',
   'Samling av matboder nær hovedscenen med variert utvalg.'),
  ('cc26-food-court-central', 'Food Court Sentral', 33.6808, -116.2370, 'food_vendor',
   'Sentralt matområde mellom scenene med asiatisk, meksikansk og amerikansk mat.'),
  ('cc26-food-court-south', 'Food Court Sør', 33.6792, -116.2365, 'food_vendor',
   'Matboder nær Sahara og Yuma med streetfood og snacks.'),
  ('cc26-food-vegan-garden', 'Vegan Garden', 33.6818, -116.2375, 'food_vendor',
   'Plantebasert matområde med veganske alternativer.'),
  ('cc26-food-ice-cream', 'Ice Cream Stand', 33.6802, -116.2355, 'food_vendor',
   'Iskrem og frosne godbiter — perfekt i Coachella-varmen.'),
  ('cc26-bar-beer-garden', 'Beer Garden', 33.6820, -116.2385, 'bar_festival',
   'Stort ølhage-område med craft beer og cocktails.'),
  ('cc26-bar-heineken-house', 'Heineken House', 33.6800, -116.2360, 'bar_festival',
   'Heineken-sponset bar med DJ-sets og kalde drikker.'),
  ('cc26-bar-cocktail-lounge', 'Cocktail Lounge', 33.6812, -116.2398, 'bar_festival',
   'Craft cocktails og premium spirits.'),
  ('cc26-water-north', 'Vannstasjon Nord', 33.6830, -116.2400, 'water_station',
   'Gratis vannpåfylling. Husk å drikke vann i Coachella-varmen!'),
  ('cc26-water-central', 'Vannstasjon Sentral', 33.6810, -116.2365, 'water_station',
   'Gratis vannpåfylling midt på festivalområdet.'),
  ('cc26-water-south', 'Vannstasjon Sør', 33.6788, -116.2355, 'water_station',
   'Gratis vannpåfylling nær de sørlige scenene.');

-- ============================================
-- 7. POIs — Fasiliteter (~12)
-- ============================================

INSERT INTO pois (id, name, lat, lng, category_id, description) VALUES
  ('cc26-restroom-north', 'Toalett Nord', 33.6832, -116.2402, 'restroom',
   'Toalettanlegg nær hovedscenen.'),
  ('cc26-restroom-central-w', 'Toalett Sentral Vest', 33.6815, -116.2400, 'restroom',
   'Toalettanlegg på vestsiden av festivalområdet.'),
  ('cc26-restroom-central-e', 'Toalett Sentral Øst', 33.6805, -116.2350, 'restroom',
   'Toalettanlegg nær Gobi og Mojave.'),
  ('cc26-restroom-south', 'Toalett Sør', 33.6785, -116.2360, 'restroom',
   'Toalettanlegg nær Quasar og sørlig inngang.'),
  ('cc26-medical-main', 'Førstehjelp Hovedstasjon', 33.6815, -116.2388, 'medical',
   'Hovedstasjon for medisinsk hjelp — sykepleiere og leger tilgjengelig 24/7.'),
  ('cc26-medical-south', 'Førstehjelp Sør', 33.6790, -116.2358, 'medical',
   'Medisinsk stasjon i sørlig del av festivalområdet.'),
  ('cc26-charging-1', 'Lading Nord', 33.6825, -116.2393, 'charging_festival',
   'Gratis telefonlading nær hovedscenen.'),
  ('cc26-charging-2', 'Lading Sentral', 33.6805, -116.2365, 'charging_festival',
   'Gratis telefonlading midt på festivalområdet.'),
  ('cc26-info-main', 'Info & Hittegods', 33.6810, -116.2395, 'info_booth',
   'Informasjon, hittegods og generell assistanse.'),
  ('cc26-info-entrance', 'Info ved Inngang', 33.6798, -116.2400, 'info_booth',
   'Informasjonspunkt ved hovedinngangen.'),
  ('cc26-lockers-1', 'Garderobe Vest', 33.6812, -116.2405, 'lockers',
   'Sikre skap for verdisaker. Dagspriser tilgjengelig.'),
  ('cc26-lockers-2', 'Garderobe Øst', 33.6800, -116.2345, 'lockers',
   'Sikre skap nær de østlige scenene.');

-- ============================================
-- 8. POIs — Transport & Inngang (~8)
-- ============================================

INSERT INTO pois (id, name, lat, lng, category_id, description) VALUES
  ('cc26-entrance-main', 'Hovedinngang', 33.6795, -116.2400, 'entrance',
   'Hovedinngang til festivalområdet fra Avenue 51.'),
  ('cc26-entrance-vip', 'VIP-inngang', 33.6800, -116.2410, 'entrance',
   'Separat inngang for VIP- og Artist-pass.'),
  ('cc26-entrance-camping', 'Camping-inngang', 33.6840, -116.2420, 'entrance',
   'Inngang fra campingområdet til festivalområdet.'),
  ('cc26-parking-main', 'Hovedparkering', 33.6770, -116.2410, 'parking_festival',
   'Hovedparkeringsplass — følg skilting fra Avenue 51.'),
  ('cc26-parking-preferred', 'Preferred Parking', 33.6775, -116.2395, 'parking_festival',
   'Premium parkering nærmere inngangen. Forhåndskjøp påkrevd.'),
  ('cc26-shuttle-drop', 'Shuttle Drop-off', 33.6780, -116.2405, 'shuttle',
   'Av- og påstigningspunkt for festivalshuttler fra hoteller i området.'),
  ('cc26-rideshare-zone', 'Uber/Lyft Zone', 33.6768, -116.2400, 'rideshare',
   'Designated pickup/drop-off for Uber og Lyft.'),
  ('cc26-bike-valet', 'Sykkel-parkering', 33.6790, -116.2410, 'parking_festival',
   'Gratis sikker sykkelparkering.');

-- ============================================
-- 9. POIs — Kunst & Opplevelser (~8)
-- ============================================

INSERT INTO pois (id, name, lat, lng, category_id, description) VALUES
  ('cc26-art-spectra', 'Spectra', 33.6820, -116.2413, 'art_installation',
   'Coachella''s ikoniske regnbuetårn — synlig fra hele festivalområdet. 7 etasjer med farget glass.'),
  ('cc26-art-overview', 'Overview Effect', 33.6825, -116.2405, 'art_installation',
   'Storskala kunstinstallasjon som inviterer til refleksjon over perspektiv og tilknytning.'),
  ('cc26-art-desert-bloom', 'Desert Bloom', 33.6813, -116.2415, 'art_installation',
   'Kinetisk skulptur inspirert av ørkenen som blomstrer — beveger seg med vinden.'),
  ('cc26-art-neon-garden', 'Neon Garden', 33.6805, -116.2410, 'art_installation',
   'Neon-opplyst hage med interaktive lysinstallasjoner.'),
  ('cc26-merch-main', 'Festival Merch Store', 33.6808, -116.2395, 'merch',
   'Offisiell Coachella-merch — t-skjorter, hatter, plakater og samlerartikler.'),
  ('cc26-merch-artist', 'Artist Merch', 33.6803, -116.2388, 'merch',
   'Merch fra festivalens artister.'),
  ('cc26-amex-lounge', 'American Express Lounge', 33.6818, -116.2382, 'sponsor_activation',
   'Eksklusiv lounge for American Express-kortholdere med AC, drikker og snacks.'),
  ('cc26-lounge-vip', 'VIP Rose Garden', 33.6822, -116.2392, 'lounge',
   'VIP-lounge i rosehagen med premium mat, drikke og utsikt til hovedscenen.');

-- ============================================
-- 10. POIs — Camping (~6)
-- Camping is north/west of the main festival area
-- ============================================

INSERT INTO pois (id, name, lat, lng, category_id, description) VALUES
  ('cc26-camp-lot8', 'Lot 8 Camping', 33.6850, -116.2425, 'campground',
   'Generell camping med plass til telt og bil. Førstemann til mølla-plassering.'),
  ('cc26-camp-companion', 'Companion Camping', 33.6855, -116.2410, 'campground',
   'Camping med tilgang til strøm og andre bekvemmeligheter.'),
  ('cc26-glamping-safari', 'Safari Glamping', 33.6858, -116.2395, 'glamping',
   'Luksuriøse safari-telt med seng, strøm og dedikerte dusjer.'),
  ('cc26-glamping-lake', 'Lake Eldorado Glamping', 33.6860, -116.2415, 'glamping',
   'Premium glamping ved en kunstig innsjø med lounge-område.'),
  ('cc26-camping-hub', 'Camping Hub & General Store', 33.6848, -116.2418, 'camping_hub',
   'Butikk, matboder, aktiviteter og DJ-sets for campinggjester. Åpent hele døgnet.'),
  ('cc26-camping-showers', 'Camping Dusjer', 33.6852, -116.2420, 'camping_showers',
   'Dusjfasiliteter for campinggjester. Åpent 06:00-02:00.');

-- ============================================
-- 11. Link all POIs to the project
-- ============================================

INSERT INTO project_pois (project_id, poi_id, sort_order)
SELECT 'goldenvoice_coachella-2026', id, ROW_NUMBER() OVER (ORDER BY id)
FROM pois WHERE id LIKE 'cc26-%'
ON CONFLICT (project_id, poi_id) DO NOTHING;

-- ============================================
-- 12. Link all POIs to the explorer product
-- ============================================

INSERT INTO product_pois (product_id, poi_id, sort_order)
SELECT 'goldenvoice_coachella-2026_explorer', id, ROW_NUMBER() OVER (ORDER BY id)
FROM pois WHERE id LIKE 'cc26-%'
ON CONFLICT (product_id, poi_id) DO NOTHING;

-- ============================================
-- 13. Link all used categories to the product
-- ============================================

INSERT INTO product_categories (product_id, category_id, display_order)
SELECT DISTINCT 'goldenvoice_coachella-2026_explorer', category_id, 0
FROM pois WHERE id LIKE 'cc26-%' AND category_id IS NOT NULL
ON CONFLICT (product_id, category_id) DO NOTHING;

-- ============================================
-- 14. Set event dates on stage POIs
-- Weekend 1: April 10-12, Weekend 2: April 17-19
-- ============================================

UPDATE pois SET
  event_dates = ARRAY['2026-04-10', '2026-04-11', '2026-04-12', '2026-04-17', '2026-04-18', '2026-04-19'],
  event_time_start = '14:00',
  event_time_end = '01:00',
  event_url = 'https://coachella.com/schedule'
WHERE id LIKE 'cc26-stage-%';

COMMIT;
