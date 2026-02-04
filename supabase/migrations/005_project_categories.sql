-- Migration: Add project-specific categories
-- Allows projects to have custom categories that override global categories for POIs

-- Create project_categories table
CREATE TABLE project_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'map-pin',
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Prevent duplicate category names within a project
  CONSTRAINT unique_category_name_per_project UNIQUE (project_id, name)
);

CREATE INDEX idx_project_categories_project ON project_categories(project_id);

-- Add RLS policies
ALTER TABLE project_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON project_categories
  FOR SELECT USING (true);

CREATE POLICY "Service role full access" ON project_categories
  FOR ALL USING (auth.role() = 'service_role');

-- Extend project_pois with project_category_id (nullable override)
ALTER TABLE project_pois
ADD COLUMN project_category_id UUID REFERENCES project_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_project_pois_category ON project_pois(project_category_id);

-- Create view for resolved categories (encapsulates COALESCE logic)
CREATE VIEW project_pois_with_resolved_category AS
SELECT
  pp.project_id,
  pp.poi_id,
  p.name as poi_name,
  p.lat,
  p.lng,
  p.address as poi_address,
  p.google_rating,
  p.google_review_count,
  p.photo_reference,
  p.editorial_hook,
  p.local_insight,
  COALESCE(pc.id, c.id) as category_id,
  COALESCE(pc.name, c.name) as category_name,
  COALESCE(pc.icon, c.icon) as category_icon,
  COALESCE(pc.color, c.color) as category_color,
  pc.id IS NOT NULL as is_project_override
FROM project_pois pp
JOIN pois p ON p.id = pp.poi_id
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN project_categories pc ON pc.id = pp.project_category_id;

-- Down migration (for rollback):
-- DROP VIEW IF EXISTS project_pois_with_resolved_category;
-- ALTER TABLE project_pois DROP COLUMN IF EXISTS project_category_id;
-- DROP INDEX IF EXISTS idx_project_pois_category;
-- DROP INDEX IF EXISTS idx_project_categories_project;
-- DROP POLICY IF EXISTS "Public read access" ON project_categories;
-- DROP POLICY IF EXISTS "Service role full access" ON project_categories;
-- DROP TABLE IF EXISTS project_categories;
