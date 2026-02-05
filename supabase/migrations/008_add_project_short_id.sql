-- Migration: Add short_id to projects
-- Description: Add 7-character nanoid-style short_id for cleaner URLs
-- Example: /admin/projects/xK7mQ2p instead of /admin/projects/trondheim-kommune_prisbellonnet-arkitektur

BEGIN;

-- ============================================
-- Step 1: Add short_id column
-- ============================================

ALTER TABLE projects
ADD COLUMN short_id TEXT;

-- ============================================
-- Step 2: Generate short_id for existing projects
-- ============================================

-- Use a combination of random characters (alphanumeric, URL-safe)
-- Similar to nanoid output: a-zA-Z0-9
CREATE OR REPLACE FUNCTION generate_short_id(length INTEGER DEFAULT 7)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Generate unique short_id for each existing project
DO $$
DECLARE
  proj RECORD;
  new_short_id TEXT;
  attempts INTEGER;
BEGIN
  FOR proj IN SELECT id FROM projects WHERE short_id IS NULL LOOP
    attempts := 0;
    LOOP
      new_short_id := generate_short_id(7);
      attempts := attempts + 1;

      -- Check if short_id already exists
      IF NOT EXISTS (SELECT 1 FROM projects WHERE short_id = new_short_id) THEN
        UPDATE projects SET short_id = new_short_id WHERE id = proj.id;
        EXIT;
      END IF;

      -- Safety: max 100 attempts
      IF attempts > 100 THEN
        RAISE EXCEPTION 'Could not generate unique short_id after 100 attempts';
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- Step 3: Make short_id NOT NULL and UNIQUE
-- ============================================

ALTER TABLE projects
ALTER COLUMN short_id SET NOT NULL;

ALTER TABLE projects
ADD CONSTRAINT projects_short_id_unique UNIQUE (short_id);

-- ============================================
-- Step 4: Add index for fast lookups
-- ============================================

CREATE INDEX idx_projects_short_id ON projects(short_id);

-- ============================================
-- Step 5: Keep the helper function for new projects
-- ============================================

-- The generate_short_id function is kept for potential use in triggers
-- but the application will use nanoid from JavaScript for consistency

COMMIT;
