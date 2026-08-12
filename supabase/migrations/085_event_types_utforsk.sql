-- =============================================================================
-- Migrasjon 085 — to nye event-typer for Utforsk-modalen
-- =============================================================================
-- HVA: Utvider CHECK-constrainten `events_event_type_check` på v2.events med
--      `poi_explore_opened` og `poi_outbound_clicked`.
--
-- HVORFOR: «Utforsk»-klikket er det sterkeste interessesignalet per POI, og det
-- har vært UINSTRUMENTERT — brukeren forsvant til Google og signalet gikk tapt
-- for Moat 2 (Innsikt). De to typene skiller de to utfallene:
--   poi_explore_opened   — modalen ble åpnet inne i Placy
--   poi_outbound_clicked — fallback-lenken ble klikket (POI uten innhold)
--
-- 🔒 TO-STEGS UTVIDELSESGRENSEN (lib/instrumentation/event-types.ts): denne
-- migrasjonen MÅ landes FØR koden begynner å sende de nye typene. Koden skal
-- aldri sende en event_type DB-CHECK-en avviser.
--
-- HVORFOR DROP + ADD OG IKKE ALTER: constrainten er definert INLINE i
-- CREATE TABLE i 070_baseline.sql:347 — det finnes ingen egen ADD CONSTRAINT å
-- endre, og Postgres har ingen «ALTER CONSTRAINT ... CHECK». Hele det utvidede
-- settet må derfor gjenskapes.
--
-- MERK om 078_events_volum_tak.sql: den migrasjonen er IKKE presedens for
-- CHECK-endring — den legger til en BEFORE INSERT-volumguard og en
-- append-only-trigger på SAMME tabell, uten å røre constraints. Triggerne er
-- separate objekter og påvirkes ikke av at en CHECK byttes ut, men de skal
-- fortsatt virke etterpå (verifiseres nedenfor).
--
-- ToS-GRENSE: vi logger AT modalen ble åpnet og AT fallback-lenken ble klikket.
-- Vi logger ALDRI klikk på enkelte kildelenker eller Search Suggestions —
-- tracking av interaksjoner med spesifikke Grounded Results er forbudt per
-- Gemini API Additional Terms.
--
-- ROLLBACK:
--   ALTER TABLE v2.events DROP CONSTRAINT events_event_type_check;
--   ALTER TABLE v2.events ADD CONSTRAINT events_event_type_check CHECK (
--     event_type IN ('board_viewed','category_opened','voiceover_played','poi_clicked')
--   );
--   (Rull tilbake KODEN først — ellers avvises rader som alt sendes.)
-- =============================================================================

BEGIN;

ALTER TABLE v2.events DROP CONSTRAINT events_event_type_check;

ALTER TABLE v2.events ADD CONSTRAINT events_event_type_check CHECK (
  event_type IN (
    'board_viewed',
    'category_opened',
    'voiceover_played',
    'poi_clicked',
    'poi_explore_opened',
    'poi_outbound_clicked'
  )
);

COMMIT;

-- --- Verifisering (kjøres manuelt etter migrering) ---------------------------
-- 1) Constrainten dekker seks typer:
--    SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'events_event_type_check';
--
-- 2) Volumguard + append-only fra 078 lever fortsatt:
--    SELECT tgname FROM pg_trigger
--    WHERE tgrelid = 'v2.events'::regclass AND NOT tgisinternal;
