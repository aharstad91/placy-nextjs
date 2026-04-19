-- Add venue_context to projects table
-- Drives illustration anchor selection (suburban vs urban style)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS venue_context TEXT
  DEFAULT 'suburban'
  CHECK (venue_context IN ('suburban', 'urban'));

-- Mark known urban projects retroactively
UPDATE projects
SET venue_context = 'urban'
WHERE id IN (
  'banenor-eiendom_stasjonskvartalet'
);
