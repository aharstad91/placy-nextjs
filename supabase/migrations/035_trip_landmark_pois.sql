-- Create 'sightseeing' POI category and landmark POIs for trips
-- These are well-known Trondheim landmarks not yet in the POI database.
-- Pattern: INSERT with gen_random_uuid(), area_id='trondheim', trust_score=1.0

BEGIN;

-- 0. Create 'sightseeing' category (FK target for POIs below)
INSERT INTO categories (id, name, icon, color)
VALUES ('sightseeing', 'Sightseeing', 'Eye', '#6366f1')
ON CONFLICT (id) DO NOTHING;

-- 1. Gamle Bybro (landmark bridge) — distinct from existing "Gamle Bybro plass" (park/bike station)
INSERT INTO pois (id, name, lat, lng, category_id, area_id, editorial_hook, local_insight, trust_score)
VALUES (
  gen_random_uuid()::TEXT,
  'Gamle Bybro',
  63.4269, 10.4009,
  'sightseeing', 'trondheim',
  'Johan Caspar von Cicignon tegnet den første broen i 1681, etter bybrannen som la Trondheim i aske. Carl Adolf Dahl bygde dagens versjon i 1861 — den siste av fire gjenoppbygginger.',
  'Lykkens Portal på bysiden fikk sitt navn etter Kristian Oskar Hoddøs vals «Nidelven stille og vakker du er», skrevet en aprilnatt i 1940 mens han sto her og så utover elva.',
  1.0
);

-- 2. Ravnkloa (fish market at the harbour)
INSERT INTO pois (id, name, lat, lng, category_id, area_id, editorial_hook, local_insight, trust_score)
VALUES (
  gen_random_uuid()::TEXT,
  'Ravnkloa',
  63.4345, 10.3945,
  'sightseeing', 'trondheim',
  'Fiskemarkedet på Ravnkloa har ligget ved enden av Munkegata i over hundre år. Lonely Planet kåret det til ett av Norges tre beste sjømatmarkeder.',
  'Herfra tar du båten til Munkholmen — den lille øya som har vært kloster, festning og henrettelsessted, og nå er byens mest populære badeplass om sommeren.',
  1.0
);

-- 3. Stiftsgården (royal residence building) — distinct from existing "Stiftsgårdsparken" (park)
INSERT INTO pois (id, name, lat, lng, category_id, area_id, editorial_hook, local_insight, trust_score)
VALUES (
  gen_random_uuid()::TEXT,
  'Stiftsgården',
  63.4317, 10.3950,
  'sightseeing', 'trondheim',
  'Cecilie Christine Schøller lot Skandinavias største trebygning reise seg på Munkegata mellom 1774 og 1778. 140 rom fordelt på 4000 kvadratmeter senbarokk — bygd som privat bolig for en enke.',
  'Kongefamilien har brukt Stiftsgården som offisiell residens i Trondheim siden 1800. Under kroninger og kongelige besøk flagges det fra alle vinduer langs hele fasaden.',
  1.0
);

COMMIT;
