-- =============================================================================
-- Migrasjon 090 — anker-oppløsning i v2: containment-kolonne + rekkverk
-- =============================================================================
-- HVA:
--   1. Ny kolonne `v2.pois.contained_in_ids text[]` — Googles `containingPlaces`
--      på Placy-id-form (`google-<placeId>`), lagret ved discovery.
--   2. Selv-refererende FK + CHECK + indeks på `v2.pois.parent_poi_id`, som
--      070_baseline opprettet som en bar kolonne uten noe av rekkverket.
--
-- HVORFOR contained_in_ids:
--   Et kjøpesenter er ÉN destinasjon, ikke 40 butikker. `lib/board/anchor-
--   membership.ts` avgjør medlemskap via tre gater, og Googles egen
--   `containingPlaces` er den autoritative av dem. Målt 2026-08-27 mot
--   searchNearby i produksjons-feltmasken: 20 av 20 `clothing_store` innen 300 m
--   av Sirkus Shopping bar feltet, alle med samme container-id
--   (ChIJVZdRQJoxbUYRTcToJ4smjeM = vår egen `google-`-id for senteret). Feltet
--   ligger i Pro-SKU-en, samme nivå som `displayName` og `businessStatus` som
--   masken alt ba om — og masken ber alt om `rating`/`userRatingCount`
--   (Enterprise), så tillegget hever ikke prisnivået.
--
-- HVORFOR EGEN KOLONNE OG IKKE poi_metadata:
--   `poi_metadata` er et BEVART felt i upsert-stien
--   (`upsertPOIsWithEditorialPreservation` skriver `existing?.poi_metadata`,
--   aldri importdataens). Å legge containment der ville krevd at hele
--   metadata-bevaringen ble bygd om fra overskriv til flett, for alle kallere.
--   Presedensen for cachet Google-data per POI er egne kolonner
--   (`opening_hours_json`, `grounding`, `gallery_images`).
--
-- HVORFOR REKKVERKET PÅ parent_poi_id:
--   056 la FK, CHECK og indeks på `public.pois`. Skjemaet ble droppet i 075, og
--   070_baseline gjenskapte kolonnen bar. Fra og med pipeline-steget (Unit 2)
--   skrives den maskinelt over hele poolen, og da må databasen håndheve at et
--   anker finnes, at ingen POI er sitt eget anker, og at oppslaget «hvem er
--   medlem av X» ikke er en full scan av 5 883 rader.
--
-- FORM: begge nullable, INGEN default. Fravær av `contained_in_ids` betyr
--   «ikke hentet ennå» (POI-er discovered før denne migrasjonen), ikke «ligger
--   ikke i noe bygg». Ingen default → ingen table rewrite.
--
-- ROLLBACK:
--   ALTER TABLE v2.pois DROP COLUMN contained_in_ids;
--   ALTER TABLE v2.pois DROP CONSTRAINT pois_parent_poi_id_fkey;
--   ALTER TABLE v2.pois DROP CONSTRAINT pois_parent_not_self;
--   DROP INDEX v2.idx_pois_parent_poi_id;
-- =============================================================================

ALTER TABLE v2.pois ADD COLUMN IF NOT EXISTS contained_in_ids text[];

COMMENT ON COLUMN v2.pois.contained_in_ids IS
  'Googles containingPlaces på Placy-id-form (google-<placeId>), hentet ved discovery. Autoritativ gate 1 i anker-oppløsningen (lib/board/anchor-membership.ts). NULL = ikke hentet ennå, ikke «ligger ikke i noe bygg».';

-- Rydd bort eventuelle foreldreløse pekere FØR FK-en, ellers feiler ALTER.
-- Per 2026-08-27: 4 rader har parent_poi_id (Valentinlyst-barna fra 057/058,
-- remappet i 074) og alle peker på en eksisterende rad — spørringen er et vern,
-- ikke en forventet endring.
UPDATE v2.pois c
SET parent_poi_id = NULL
WHERE c.parent_poi_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM v2.pois p WHERE p.id = c.parent_poi_id);

UPDATE v2.pois SET parent_poi_id = NULL WHERE parent_poi_id = id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'v2.pois'::regclass AND conname = 'pois_parent_poi_id_fkey'
  ) THEN
    ALTER TABLE v2.pois
      ADD CONSTRAINT pois_parent_poi_id_fkey
      FOREIGN KEY (parent_poi_id) REFERENCES v2.pois(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'v2.pois'::regclass AND conname = 'pois_parent_not_self'
  ) THEN
    ALTER TABLE v2.pois
      ADD CONSTRAINT pois_parent_not_self
      CHECK (parent_poi_id IS NULL OR parent_poi_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pois_parent_poi_id
  ON v2.pois (parent_poi_id) WHERE parent_poi_id IS NOT NULL;

-- Verifikasjon
SELECT 'contained_in_ids finnes' AS sjekk,
       (SELECT count(*)::text FROM information_schema.columns
        WHERE table_schema='v2' AND table_name='pois' AND column_name='contained_in_ids') AS verdi
UNION ALL
SELECT 'parent-constraints', (SELECT count(*)::text FROM pg_constraint
  WHERE conrelid='v2.pois'::regclass AND conname IN ('pois_parent_poi_id_fkey','pois_parent_not_self'))
UNION ALL
SELECT 'parent-indeks', (SELECT count(*)::text FROM pg_indexes
  WHERE schemaname='v2' AND tablename='pois' AND indexname='idx_pois_parent_poi_id')
UNION ALL
SELECT 'rader med parent_poi_id', (SELECT count(*)::text FROM v2.pois WHERE parent_poi_id IS NOT NULL);
