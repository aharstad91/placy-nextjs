-- Legg til homepage_url for rapport-header "tilbake"-link.
-- Brukes i PlacyReportHeader og PlacyReportFooter for å lenke
-- tilbake til kundens hjemmeside. Nullable — skjules hvis ikke satt.
--
-- CHECK-constraint sikrer http(s)-protokoll (blokkerer javascript:,
-- data:, vbscript: — XSS-mitigasjon på DB-nivå).

BEGIN;

ALTER TABLE projects
ADD COLUMN homepage_url TEXT NULL
CONSTRAINT homepage_url_format CHECK (
  homepage_url IS NULL
  OR homepage_url ~* '^https?://'
);

COMMENT ON COLUMN projects.homepage_url IS
  'URL til kundens hjemmeside. Brukes i PlacyReportHeader som "tilbake"-link og i footer. Nullable — hvis ikke satt, skjules linken. CHECK-constraint sikrer http(s)-protokoll.';

COMMIT;

-- Rollback (kjør manuelt ved behov):
-- BEGIN;
-- ALTER TABLE projects DROP CONSTRAINT homepage_url_format;
-- ALTER TABLE projects DROP COLUMN homepage_url;
-- COMMIT;
