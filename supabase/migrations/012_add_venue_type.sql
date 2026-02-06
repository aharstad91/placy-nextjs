-- Add venue_type to projects table
-- Uses "venue_type" (not "project_type") to avoid confusion with product_type on products table
ALTER TABLE projects
  ADD COLUMN venue_type TEXT NOT NULL DEFAULT 'hotel'
  CONSTRAINT projects_venue_type_check CHECK (venue_type IN ('hotel', 'residential', 'commercial'));
