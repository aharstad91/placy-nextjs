-- =============================================================================
-- Migrasjon 091 — ny event-type `isochrones_toggled` for Innsikt (Moat 2)
-- =============================================================================
-- HVA: Utvider CHECK-constrainten `events_event_type_check` på v2.events med
--      `isochrones_toggled`.
--
-- HVORFOR: Rekkevidde-konturene (5/10/15 min) er et visningsvalg leseren slår
--      på selv. Vi vil vite om det faktisk brukes FØR vi bygger videre på det
--      — kamera-ramming etter kontur og kontur-filtrering av lista er begge
--      utsatt i påvente av nettopp dette tallet. Reisemåten ligger alt i
--      kontekst-konvolutten, så nyttelasten bærer bare ny av/på-tilstand.
--
-- 🔒 TO-STEGS UTVIDELSESGRENSEN (lib/instrumentation/event-types.ts): denne
-- migrasjonen MÅ landes FØR koden begynner å sende typen.
--
-- MERK `faq_opened`: den står i lista under fordi prod-constrainten ALT har
-- den (verifisert 2026-09-03), selv om migrasjon 086 og kode-siden ligger
-- ukommittert i hovedrepoet. Utelates den her, ville denne migrasjonen DROPPET
-- en type prod alt godtar og alt logger.
--
-- DROP + ADD, ikke ALTER — constrainten er inline i 070_baseline.sql, og
-- Postgres har ingen ALTER CONSTRAINT ... CHECK.
--
-- ROLLBACK:
--   ALTER TABLE v2.events DROP CONSTRAINT events_event_type_check;
--   ALTER TABLE v2.events ADD CONSTRAINT events_event_type_check CHECK (
--     event_type IN ('board_viewed','category_opened','voiceover_played',
--                    'poi_clicked','poi_explore_opened','poi_outbound_clicked',
--                    'faq_opened')
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
    'faq_opened',
    'isochrones_toggled'
  )
);

COMMIT;

-- VERIFISER:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'events_event_type_check';
--   → skal inneholde 'isochrones_toggled'
