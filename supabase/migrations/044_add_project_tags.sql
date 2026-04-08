-- Add tags array to projects for categorizing by industry/type
ALTER TABLE projects ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Index for tag filtering
CREATE INDEX idx_projects_tags ON projects USING GIN (tags);
