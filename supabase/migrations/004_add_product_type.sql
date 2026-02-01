ALTER TABLE projects
  ADD COLUMN product_type TEXT NOT NULL DEFAULT 'explorer'
  CHECK (product_type IN ('explorer', 'report', 'portrait'));
