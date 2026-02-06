-- Translations table for bilingual content (NO/EN)
-- Norwegian texts live in POI/product fields (canonical source).
-- English translations are stored here as overrides.
CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL,
  entity_type TEXT NOT NULL,       -- "poi", "theme", "report"
  entity_id TEXT NOT NULL,         -- POI id, theme id, or product id
  field TEXT NOT NULL,             -- "editorial_hook", "bridge_text", "hero_intro", etc.
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (locale, entity_type, entity_id, field)
);

CREATE INDEX idx_translations_lookup
  ON translations (entity_type, entity_id, locale);
