-- Migration 069: Add report_editorial to areas (nabolags-editorial-arv, slice 1)
--
-- Curated per-neighborhood editorial content for the report product,
-- keyed by report theme id. Read ONLY by the provisioning pipeline
-- (create-report) in slice 1 — no API routes or render surfaces expose
-- this column directly.
--
-- JSONB shape:
--   {
--     "<theme-id>": {
--       "body": string,                  -- curated drill-in text
--       "highlightCandidates": string[], -- POI ids in curator-prioritized order
--       "image": string                  -- optional
--     }
--   }
--
-- No new table, no new RLS policies (inherits areas'), no index —
-- lookups scan the few rows where boundary IS NOT NULL.

ALTER TABLE areas ADD COLUMN IF NOT EXISTS report_editorial JSONB;

COMMENT ON COLUMN areas.report_editorial IS
  'Curated neighborhood editorial per report theme: { "<theme-id>": { "body": string, "highlightCandidates": string[], "image"?: string } }. Read only by the provisioning pipeline (slice 1).';
