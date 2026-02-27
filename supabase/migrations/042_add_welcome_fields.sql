-- Add welcome screen fields to projects table
-- Used by the onboarding welcome screen to display tagline and route to default product

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS welcome_tagline TEXT,
  ADD COLUMN IF NOT EXISTS default_product TEXT NOT NULL DEFAULT 'report'
    CONSTRAINT projects_default_product_valid
    CHECK (default_product IN ('explorer', 'report', 'guide'));
