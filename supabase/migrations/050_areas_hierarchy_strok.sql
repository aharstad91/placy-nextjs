-- Migration 050: Extend areas with hierarchy (city → bydel → strøk)
--
-- Real estate in Trondheim operates at "strøk" level (~22 named neighborhoods).
-- This migration adds parent_id, level, boundary, and postal_codes to areas,
-- then seeds all 4 bydeler and ~25 strøk for Trondheim.
--
-- Knowledge cascade: Brøset → Lerkendal → Trondheim
-- POIs can be tagged at strøk level for precise neighborhood matching.

BEGIN;

-- ============================================
-- Step 1: Extend areas table with hierarchy
-- ============================================

ALTER TABLE areas ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES areas(id);
ALTER TABLE areas ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'city'
  CHECK (level IN ('city', 'bydel', 'strok'));
ALTER TABLE areas ADD COLUMN IF NOT EXISTS boundary JSONB;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS postal_codes TEXT[];

CREATE INDEX IF NOT EXISTS idx_areas_parent ON areas(parent_id);
CREATE INDEX IF NOT EXISTS idx_areas_level ON areas(level);

-- Mark existing trondheim as city
UPDATE areas SET level = 'city' WHERE id = 'trondheim';

-- ============================================
-- Step 2: Seed 4 bydeler
-- ============================================

INSERT INTO areas (id, name_no, name_en, slug_no, slug_en, parent_id, level, center_lat, center_lng, zoom_level) VALUES
  ('midtbyen',  'Midtbyen',  'Midtbyen',  'midtbyen',  'midtbyen',  'trondheim', 'bydel', 63.4305, 10.3951, 13),
  ('ostbyen',   'Østbyen',   'East City', 'ostbyen',   'east-city', 'trondheim', 'bydel', 63.4400, 10.4400, 13),
  ('lerkendal', 'Lerkendal', 'Lerkendal', 'lerkendal', 'lerkendal', 'trondheim', 'bydel', 63.4100, 10.3900, 13),
  ('heimdal',   'Heimdal',   'Heimdal',   'heimdal',   'heimdal',   'trondheim', 'bydel', 63.3600, 10.3500, 13)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Step 3: Seed strøk — Midtbyen bydel
-- ============================================

INSERT INTO areas (id, name_no, name_en, slug_no, slug_en, parent_id, level, center_lat, center_lng, zoom_level, postal_codes) VALUES
  ('sentrum',    'Sentrum',    'City Centre',  'sentrum',    'city-centre',  'midtbyen', 'strok', 63.4305, 10.3951, 15, '{7010,7011,7012,7013}'),
  ('bakklandet', 'Bakklandet', 'Bakklandet',   'bakklandet', 'bakklandet',   'midtbyen', 'strok', 63.4300, 10.4035, 16, '{7013}'),
  ('ila',        'Ila',        'Ila',          'ila',        'ila',          'midtbyen', 'strok', 63.4340, 10.3750, 15, '{7018}'),
  ('singsaker',  'Singsaker',  'Singsaker',    'singsaker',  'singsaker',    'midtbyen', 'strok', 63.4230, 10.3950, 15, '{7030}'),
  ('tyholt',     'Tyholt',     'Tyholt',       'tyholt',     'tyholt',       'midtbyen', 'strok', 63.4220, 10.4150, 15, '{7020}'),
  ('byasen',     'Byåsen',     'Byasen',       'byasen',     'byasen',       'midtbyen', 'strok', 63.4050, 10.3500, 14, '{7021,7022,7023,7024}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Step 4: Seed strøk — Østbyen bydel
-- ============================================

INSERT INTO areas (id, name_no, name_en, slug_no, slug_en, parent_id, level, center_lat, center_lng, zoom_level, postal_codes) VALUES
  ('mollenberg',       'Møllenberg',       'Mollenberg',       'mollenberg',       'mollenberg',       'ostbyen', 'strok', 63.4350, 10.4100, 16, '{7014}'),
  ('lademoen',         'Lademoen',         'Lademoen',         'lademoen',         'lademoen',         'ostbyen', 'strok', 63.4380, 10.4150, 15, '{7042}'),
  ('solsiden',         'Solsiden',         'Solsiden',         'solsiden',         'solsiden',         'ostbyen', 'strok', 63.4370, 10.4050, 16, '{7014}'),
  ('rosenborg',        'Rosenborg',        'Rosenborg',        'rosenborg',        'rosenborg',        'ostbyen', 'strok', 63.4310, 10.4200, 15, '{7014}'),
  ('lade',             'Lade',             'Lade',             'lade',             'lade',             'ostbyen', 'strok', 63.4450, 10.4350, 15, '{7041,7066,7067}'),
  ('strindheim',       'Strindheim',       'Strindheim',       'strindheim',       'strindheim',       'ostbyen', 'strok', 63.4320, 10.4350, 15, '{7043,7044,7068}'),
  ('leangen',          'Leangen',          'Leangen',          'leangen',          'leangen',          'ostbyen', 'strok', 63.4300, 10.4500, 15, '{7044}'),
  ('charlottenlund',   'Charlottenlund',   'Charlottenlund',   'charlottenlund',   'charlottenlund',   'ostbyen', 'strok', 63.4350, 10.4700, 14, '{7045}'),
  ('jakobsli',         'Jakobsli',         'Jakobsli',         'jakobsli',         'jakobsli',         'ostbyen', 'strok', 63.4200, 10.4500, 15, '{7058,7059}'),
  ('ranheim',          'Ranheim',          'Ranheim',          'ranheim',          'ranheim',          'ostbyen', 'strok', 63.4350, 10.5200, 14, '{7053,7054,7055,7056}'),
  ('vikasen',          'Vikåsen',          'Vikasen',          'vikasen',          'vikasen',          'ostbyen', 'strok', 63.4300, 10.4800, 15, '{7040}'),
  ('brundalen',        'Brundalen',        'Brundalen',        'brundalen',        'brundalen',        'ostbyen', 'strok', 63.4250, 10.4600, 15, '{7047}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Step 5: Seed strøk — Lerkendal bydel
-- ============================================

INSERT INTO areas (id, name_no, name_en, slug_no, slug_en, parent_id, level, center_lat, center_lng, zoom_level, postal_codes) VALUES
  ('lerkendal-strok',  'Lerkendal',    'Lerkendal',    'lerkendal-strok',  'lerkendal-area',  'lerkendal', 'strok', 63.4120, 10.3900, 15, '{7030}'),
  ('moholt',           'Moholt',       'Moholt',       'moholt',           'moholt',          'lerkendal', 'strok', 63.4150, 10.4200, 15, '{7050}'),
  ('broset',           'Brøset',       'Broset',       'broset',           'broset',          'lerkendal', 'strok', 63.4190, 10.4180, 16, '{7050}'),
  ('valentinlyst',     'Valentinlyst', 'Valentinlyst', 'valentinlyst',     'valentinlyst',    'lerkendal', 'strok', 63.4200, 10.4280, 15, '{7049}'),
  ('nardo',            'Nardo',        'Nardo',        'nardo',            'nardo',           'lerkendal', 'strok', 63.4100, 10.4000, 15, '{7031,7032}'),
  ('flatasen',         'Flatåsen',     'Flatasen',     'flatasen',         'flatasen',        'lerkendal', 'strok', 63.3950, 10.3800, 15, '{7079}'),
  ('eberg',            'Eberg',        'Eberg',        'eberg',            'eberg',           'lerkendal', 'strok', 63.4200, 10.4100, 15, '{7033}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Step 6: Seed strøk — Heimdal bydel
-- ============================================

INSERT INTO areas (id, name_no, name_en, slug_no, slug_en, parent_id, level, center_lat, center_lng, zoom_level, postal_codes) VALUES
  ('heimdal-strok', 'Heimdal',   'Heimdal',   'heimdal-strok', 'heimdal-area', 'heimdal', 'strok', 63.3600, 10.3500, 15, '{7080,7081,7082}'),
  ('tiller',        'Tiller',    'Tiller',    'tiller',        'tiller',       'heimdal', 'strok', 63.3700, 10.3900, 14, '{7075,7078}'),
  ('kolstad',       'Kolstad',   'Kolstad',   'kolstad',       'kolstad',      'heimdal', 'strok', 63.3800, 10.3800, 15, '{7058}'),
  ('saupstad',      'Saupstad',  'Saupstad',  'saupstad',      'saupstad',     'heimdal', 'strok', 63.3750, 10.3600, 15, '{7078}'),
  ('kattem',        'Kattem',    'Kattem',    'kattem',         'kattem',       'heimdal', 'strok', 63.3500, 10.3100, 14, '{7083}'),
  ('byneset',       'Byneset',   'Byneset',   'byneset',       'byneset',      'heimdal', 'strok', 63.3600, 10.2500, 13, '{7070,7072}')
ON CONFLICT (id) DO NOTHING;

COMMIT;
