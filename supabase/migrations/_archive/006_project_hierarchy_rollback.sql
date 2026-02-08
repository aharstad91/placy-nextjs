-- Rollback: Project Hierarchy Migration
-- Run this to restore the original schema if migration fails
-- WARNING: This will lose any data created in the new tables after migration

BEGIN;

-- Drop new tables (cascade removes policies)
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS product_pois CASCADE;
DROP TABLE IF EXISTS project_pois CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Restore legacy tables
ALTER TABLE projects_legacy RENAME TO projects;
ALTER TABLE project_pois_legacy RENAME TO project_pois;

-- Restore indexes
ALTER INDEX idx_projects_legacy_customer_id RENAME TO idx_projects_customer_id;
ALTER INDEX idx_projects_legacy_url_slug RENAME TO idx_projects_url_slug;
ALTER INDEX idx_project_pois_legacy_poi_id RENAME TO idx_project_pois_poi_id;

-- Restore foreign keys
ALTER TABLE theme_stories DROP CONSTRAINT theme_stories_project_id_fkey;
ALTER TABLE theme_stories
  ADD CONSTRAINT theme_stories_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE story_sections DROP CONSTRAINT story_sections_project_id_fkey;
ALTER TABLE story_sections
  ADD CONSTRAINT story_sections_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

COMMIT;

-- Note: After rollback, run the following to verify:
-- SELECT COUNT(*) FROM projects;
-- SELECT COUNT(*) FROM project_pois;
