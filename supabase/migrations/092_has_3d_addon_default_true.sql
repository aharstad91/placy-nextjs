-- 3D/satelitt blir standard, ikke tilvalg (2026-09-08)
--
-- projects.has_3d_addon gater satelitt- og 3D-visningen i board-kartet
-- (BoardMap.tsx: showViewToggle={has3dAddon}). Med flagget av står boardet på
-- rent Mapbox-2D uten kartveksler i det hele tatt.
--
-- Kolonnen ble innført (065) og senere spesifisert (PRD 3, r03.5 AC2) som et
-- BETALT ADDON med default FALSE. Den produktbeslutningen er reversert:
-- satelitt og 3D er nå del av grunnleveransen på alle nye boards, og
-- provisjoneringen sender true med mindre kalleren eksplisitt sier fra
-- (CLI-opt-out `--no-3d`).
--
-- Endrer BARE kolonne-defaulten. Eksisterende rader står urørt — backfill av
-- gamle boards er en separat, bevisst handling.

ALTER TABLE v2.projects
  ALTER COLUMN has_3d_addon SET DEFAULT TRUE;

COMMENT ON COLUMN v2.projects.has_3d_addon IS
  'Gater satelitt-/3D-visningen i board-kartet. Default TRUE fra 2026-09-08 — '
  'satelitt og 3D er standard, ikke tilvalg. Sett FALSE eksplisitt for boards '
  'som bevisst skal være rene Mapbox-2D (CLI: --no-3d).';
