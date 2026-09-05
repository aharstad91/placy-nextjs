-- =============================================================================
-- Migrasjon 086 — ny event-type `faq_opened` for Innsikt (Moat 2)
-- =============================================================================
-- HVA: Utvider CHECK-constrainten `events_event_type_check` på v2.events med
--      `faq_opened`.
--
-- HVORFOR: Et åpnet FAQ-spørsmål er UTTALT behov — «hvilken skolekrets sogner
--      boligen til?» er et annet signal enn et klikk på en skole-pin. Det er
--      det billigste segment-signalet boardet har, og det har vært
--      uinstrumentert. Spørsmåls-id er kontrakten (FAQ-katalogen); teksten
--      lagres ikke, den slås opp ved aggregering.
--
-- 🔒 TO-STEGS UTVIDELSESGRENSEN (lib/instrumentation/event-types.ts): denne
-- migrasjonen MÅ landes FØR koden begynner å sende typen.
--
-- DROP + ADD, ikke ALTER — samme grunn som 085 (constrainten er inline i
-- 070_baseline.sql; Postgres har ingen ALTER CONSTRAINT ... CHECK).
--
-- ROLLBACK:
--   ALTER TABLE v2.events DROP CONSTRAINT events_event_type_check;
--   ALTER TABLE v2.events ADD CONSTRAINT events_event_type_check CHECK (
--     event_type IN ('board_viewed','category_opened','voiceover_played',
--                    'poi_clicked','poi_explore_opened','poi_outbound_clicked')
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
    'poi_outbound_clicked',
    'faq_opened'
  )
);

COMMIT;

-- --- Verifisering (kjøres manuelt etter migrering) ---------------------------
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conname = 'events_event_type_check';
-- SELECT tgname FROM pg_trigger
-- WHERE tgrelid = 'v2.events'::regclass AND NOT tgisinternal;
