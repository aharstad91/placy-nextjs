-- Migration 046: Generation requests for self-service megler pipeline
-- Allows real estate agents to request neighborhood map generation

-- Selvbetjent-kunde
INSERT INTO customers (id, name) VALUES ('selvbetjent', 'Selvbetjent')
ON CONFLICT (id) DO NOTHING;

-- Generation requests table
CREATE TABLE generation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  address_normalized TEXT NOT NULL,
  email TEXT NOT NULL,
  housing_type TEXT NOT NULL DEFAULT 'family'
    CHECK (housing_type IN ('family', 'young', 'senior')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  geocoded_lat DOUBLE PRECISION,
  geocoded_lng DOUBLE PRECISION,
  geocoded_city TEXT,
  address_slug TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  result_url TEXT,
  error_message TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_generation_requests_status ON generation_requests(status);
CREATE INDEX idx_generation_requests_created ON generation_requests(created_at DESC);
CREATE UNIQUE INDEX idx_generation_requests_slug ON generation_requests(address_slug);

-- RLS
ALTER TABLE generation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON generation_requests
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Public read by slug" ON generation_requests
  FOR SELECT USING (true);
