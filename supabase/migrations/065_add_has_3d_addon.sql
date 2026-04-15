-- Add has_3d_addon flag to projects table for 2D/3D map toggle gating
-- Default FALSE — only Wesselsløkka demo gets TRUE in this migration

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS has_3d_addon BOOLEAN NOT NULL DEFAULT FALSE;

-- Comment for documentation
COMMENT ON COLUMN projects.has_3d_addon IS
  'Paid add-on flag: enables Google Maps 3D toggle in report map modals. Default FALSE.';

-- Enable 3D for Wesselsløkka demo project
UPDATE projects
SET has_3d_addon = TRUE
WHERE url_slug = 'wesselslokka';
