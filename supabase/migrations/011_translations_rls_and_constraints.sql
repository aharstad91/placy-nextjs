-- Enable RLS and add constraints to translations table
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- Allow public read access (translations are public content for Report frontend)
CREATE POLICY "Allow public read access" ON translations
  FOR SELECT USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role full access" ON translations
  FOR ALL USING (auth.role() = 'service_role');

-- Constrain locale to supported values
ALTER TABLE translations
  ADD CONSTRAINT translations_locale_check CHECK (locale IN ('no', 'en'));

-- Constrain entity_type to known types
ALTER TABLE translations
  ADD CONSTRAINT translations_entity_type_check CHECK (entity_type IN ('poi', 'theme', 'report'));

-- Add NOT NULL to timestamps
ALTER TABLE translations ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE translations ALTER COLUMN updated_at SET NOT NULL;
