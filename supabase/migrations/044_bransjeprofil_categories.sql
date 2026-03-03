-- Migration: New categories for bransjeprofil system
-- Adds categories needed by Eiendom - Bolig and Eiendom - Næring profiles.
-- Uses ON CONFLICT DO NOTHING for idempotency.

-- New categories for Eiendom - Bolig
INSERT INTO categories (id, name, icon, color) VALUES
  ('bowling', 'Bowling', 'Disc', '#0ea5e9'),
  ('amusement', 'Aktivitetspark', 'Ticket', '#0ea5e9'),
  ('theatre', 'Teater', 'Drama', '#0ea5e9'),
  ('fitness_park', 'Treningspark', 'TreePine', '#ec4899'),
  ('charging_station', 'Ladestasjon', 'Zap', '#3b82f6')
ON CONFLICT (id) DO NOTHING;

-- New categories for Eiendom - Næring
INSERT INTO categories (id, name, icon, color) VALUES
  ('scooter', 'Sparkesykkel', 'Bike', '#3b82f6'),
  ('airport_bus', 'Flybuss', 'Plane', '#3b82f6'),
  ('conference', 'Konferanselokale', 'Users', '#8b5cf6')
ON CONFLICT (id) DO NOTHING;

-- Also add missing categories referenced in code
INSERT INTO categories (id, name, icon, color) VALUES
  ('convenience', 'Nærbutikk', 'Store', '#22c55e'),
  ('dentist', 'Tannlege', 'Cross', '#22c55e'),
  ('bank', 'Bank', 'Landmark', '#22c55e'),
  ('post_office', 'Postkontor', 'Mail', '#22c55e'),
  ('swimming', 'Svømmehall', 'Waves', '#ec4899'),
  ('ferry', 'Ferge', 'Ship', '#3b82f6')
ON CONFLICT (id) DO NOTHING;

-- Category slugs for new categories (locale required, PK = category_id + locale)
INSERT INTO category_slugs (category_id, locale, slug) VALUES
  ('bowling', 'no', 'bowling'),
  ('amusement', 'no', 'aktivitetsparker'),
  ('theatre', 'no', 'teater'),
  ('fitness_park', 'no', 'treningspark'),
  ('charging_station', 'no', 'ladestasjon'),
  ('scooter', 'no', 'sparkesykkel'),
  ('airport_bus', 'no', 'flybuss'),
  ('conference', 'no', 'konferanse'),
  ('convenience', 'no', 'naerbutikk'),
  ('dentist', 'no', 'tannlege'),
  ('bank', 'no', 'bank'),
  ('post_office', 'no', 'postkontor'),
  ('swimming', 'no', 'svommehall'),
  ('ferry', 'no', 'ferge')
ON CONFLICT DO NOTHING;
