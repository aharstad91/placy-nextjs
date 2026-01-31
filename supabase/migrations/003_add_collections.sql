-- Placy Database Schema
-- Migration: 003_add_collections
-- Description: Add collections table for Explorer collection/checkout feature

CREATE TABLE collections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT,
  poi_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collections_slug ON collections(slug);
CREATE INDEX idx_collections_project_id ON collections(project_id);
CREATE INDEX idx_collections_created_at ON collections(created_at);

-- RLS: Public read via slug lookup, server-side write only
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read collections by slug"
  ON collections FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on collections"
  ON collections FOR ALL
  USING (auth.role() = 'service_role');
