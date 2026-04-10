-- Migration 057: Set parent-child relationships for Valentinlyst Senter (Wesselsløkka)
--
-- Parent: Valentinlyst Senter (google-ChIJnW_zJ20xbUYRqaLffSVJpgY)
-- Children: Coop Mega, Boots Apotek, Valentinlyst Vinmonopol, Studio Sax

BEGIN;

-- Set anchor_summary on parent
UPDATE pois
SET anchor_summary = 'Dagligvare, apotek, frisør, vinmonopol, bakeri og mer'
WHERE id = 'google-ChIJnW_zJ20xbUYRqaLffSVJpgY';

-- Link children to parent
UPDATE pois
SET parent_poi_id = 'google-ChIJnW_zJ20xbUYRqaLffSVJpgY'
WHERE id IN (
  'google-ChIJIXixBrIxbUYRnjSMCB3ZQ18',  -- Coop Mega Valentinlyst
  'google-ChIJg9EJ5a0xbUYRqXUubNoSmFs',  -- Boots Apotek
  'google-ChIJvVr87q0xbUYR8ejILMI4p5s',  -- Valentinlyst Vinmonopol
  'google-ChIJlR-9u7IxbUYRyxbo-XpuR2M'   -- Studio Sax AS
);

COMMIT;
