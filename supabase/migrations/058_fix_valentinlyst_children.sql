-- Migration 058: Fix Valentinlyst Senter child POIs
--
-- Based on valentinlyst.no/butikker/ and distance verification:
-- - Studio Sax AS (366m away) is NOT inside the senter → remove as child
-- - Grande Frisør (23m, "I. Grande frisør AS" on butikker-list) → add
-- - Rosenborg bakeri Valentinlyst (25m) → add
-- - Vinmonopolet 390 reviews (72m, the real one) → add
-- - Fresh Fitness Valentinlyst (82m) → add
-- - Feelgood (83m, "Feelgood Valentinlyst" on butikker-list) → add
--
-- Kept: Coop Mega Valentinlyst, Boots Apotek, Valentinlyst Vinmonopol (duplicate Google listing)

BEGIN;

-- Remove Studio Sax (not actually inside the senter)
UPDATE pois
SET parent_poi_id = NULL
WHERE id = 'google-ChIJlR-9u7IxbUYRyxbo-XpuR2M';

-- Add newly identified children
UPDATE pois
SET parent_poi_id = 'google-ChIJnW_zJ20xbUYRqaLffSVJpgY'
WHERE id IN (
  'google-ChIJIXixBrIxbUYRnqDXNaB2ukA',  -- Grande Frisør
  'google-ChIJc1Rpf20xbUYRwzOzsSBjVys',  -- Rosenborg bakeri Valentinlyst
  'google-ChIJa_R17K0xbUYRd3-yrjGjbF4',  -- Vinmonopolet (390 reviews — the real one)
  'google-ChIJVYE8i60xbUYRAIOAaEbnZOg',  -- Fresh Fitness Valentinlyst
  'google-ChIJVT8VyhsxbUYRAB3GC9dih_w'   -- Feelgood
);

-- Update anchor_summary to reflect expanded offering
UPDATE pois
SET anchor_summary = 'Dagligvare, apotek, frisør, vinmonopol, bakeri, trening og mer'
WHERE id = 'google-ChIJnW_zJ20xbUYRqaLffSVJpgY';

COMMIT;
