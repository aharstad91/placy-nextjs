-- Add customer_id to generation_requests
-- Links self-service generation requests to actual brokerage customers
-- Nullable: existing rows keep NULL (legacy "selvbetjent")
-- ON DELETE SET NULL: preserves audit trail if customer is deleted

ALTER TABLE generation_requests
  ADD COLUMN customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX idx_generation_requests_customer ON generation_requests(customer_id);
