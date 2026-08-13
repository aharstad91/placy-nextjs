-- =============================================================================
-- Migrasjon 087 — v2.postal_areas.source_updated_at: timestamptz → date
-- =============================================================================
-- HVA: Endrer kolonnetypen fra timestamptz til date.
--
-- HVORFOR: Kartverkets `app:oppdateringsdato` er en DATO («2015-10-01»), ikke et
-- tidspunkt. Som timestamptz diktet Postgres opp en tidssone og returnerte
-- «2015-10-01T00:00:00+00:00». Importens endringssjekk (needsWrite) sammenligner
-- kildens verdi med den lagrede, og krysset dermed en formatgrense: de 16 radene
-- som HAR en oppdateringsdato ble rapportert som «endret» ved hver kjøring, selv
-- når ingenting var endret. Da mister «andre kjøring gir 0 endringer» sin verdi
-- som idempotens-signal — og det signalet er hele grunnen til at kolonnen finnes.
--
-- Feilen ble innført i 086 (samme dag) og oppdaget da importen ble kjørt to
-- ganger. Rettes som egen migrasjon fordi 086 alt er anvendt i produksjon: å
-- skrive om en anvendt migrasjonsfil ville gjort filhistorikken uenig med
-- databasen, som er nøyaktig kilden til «virker lokalt, brekker i prod».
--
-- DATATAP: ingen reelt. Alle 16 eksisterende verdier står på midnatt UTC, så
-- cast til date er tapsfritt. Verifisert før kjøring:
--   SELECT count(*) FROM v2.postal_areas
--   WHERE source_updated_at IS NOT NULL
--     AND source_updated_at <> date_trunc('day', source_updated_at);
--   -- forvent 0
--
-- Parseren trunkerer i tillegg kildeverdien til de første 10 tegnene, slik at et
-- fullt tidsstempel fra Kartverket en gang i framtiden fortsatt sammenlignes
-- stabilt i stedet for å gjøre raden evig «endret».
--
-- KJØRES via psql direkte. Reversibel (se ROLLBACK).
-- =============================================================================

BEGIN;

ALTER TABLE v2.postal_areas
  ALTER COLUMN source_updated_at TYPE date
  USING source_updated_at::date;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFISERING ETTER KJØRING:
--   SELECT postnummer, source_updated_at FROM v2.postal_areas
--   WHERE source_updated_at IS NOT NULL ORDER BY postnummer LIMIT 3;
--   -- forvent «2015-10-01», ikke «2015-10-01T00:00:00+00:00»
--
--   -- og deretter: to påfølgende dry-run av importen skal gi 0 endret.
--
-- ROLLBACK (kjør KUN hvis 087 må angres):
--   ALTER TABLE v2.postal_areas
--     ALTER COLUMN source_updated_at TYPE timestamptz
--     USING source_updated_at::timestamptz;
-- =============================================================================
