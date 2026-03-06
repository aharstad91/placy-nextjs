-- Migration 047: Fixes for generation_requests
-- 1. Change ON DELETE CASCADE to SET NULL (preserve request records if project deleted)
-- 2. Add updated_at trigger
-- 3. Add index on address_normalized for duplicate detection

-- Fix FK constraint: SET NULL instead of CASCADE
ALTER TABLE generation_requests
  DROP CONSTRAINT IF EXISTS generation_requests_project_id_fkey;
ALTER TABLE generation_requests
  ADD CONSTRAINT generation_requests_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Add updated_at trigger (reuse existing function)
CREATE TRIGGER update_generation_requests_updated_at
  BEFORE UPDATE ON generation_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add index for duplicate detection
CREATE INDEX idx_generation_requests_normalized ON generation_requests(address_normalized);
