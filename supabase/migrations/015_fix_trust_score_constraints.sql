-- Fix trust_score constraints (follow-up to 014)
-- Adds NOT NULL DEFAULT on trust_flags, names constraints, bounds trust_score precision

BEGIN;

-- Name the anonymous CHECK constraints from 014
-- Drop anonymous and recreate with names
ALTER TABLE pois DROP CONSTRAINT IF EXISTS pois_trust_score_check;
ALTER TABLE pois ADD CONSTRAINT pois_trust_score_range CHECK (trust_score >= 0.0 AND trust_score <= 1.0);

ALTER TABLE pois DROP CONSTRAINT IF EXISTS pois_google_business_status_check;
ALTER TABLE pois ADD CONSTRAINT pois_google_business_status_valid
  CHECK (google_business_status IN ('OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'));

ALTER TABLE pois DROP CONSTRAINT IF EXISTS pois_google_price_level_check;
ALTER TABLE pois ADD CONSTRAINT pois_google_price_level_range
  CHECK (google_price_level >= 0 AND google_price_level <= 4);

-- Ensure trust_flags is never NULL (always empty array)
UPDATE pois SET trust_flags = '{}' WHERE trust_flags IS NULL;
ALTER TABLE pois ALTER COLUMN trust_flags SET NOT NULL;
ALTER TABLE pois ALTER COLUMN trust_flags SET DEFAULT '{}';

-- Bound trust_score precision to 2 decimal places
ALTER TABLE pois ALTER COLUMN trust_score TYPE NUMERIC(3,2);

COMMIT;
