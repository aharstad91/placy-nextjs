-- 071: Reisetid-precompute på v2.project_pois (bead 2nj, Andreas-godkjent 2026-07-06)
--
-- Boardets datamotor (components/variants/report/report-data.ts) leser
-- POI.travelTime.walk med haversine-fallback. Precompute gir presise
-- «X min»-labels i stedet for luftlinje-estimat.
--
-- Grain: prosjekt↔POI (tidene avhenger av prosjekt-ORIGO — hører hjemme på
-- relasjonen, ikke på delte v2.pois).
--
-- Enhets-KONTRAKT: MINUTTER (Math.ceil av Mapbox Matrix-durasjon/60) — samme
-- kontrakt som POI.travelTime i lib/types.ts. NULL = ikke beregnet → boardet
-- faller tilbake til haversine.
--
-- Read-side (cutover-kontrakt): når board-lesingen flyttes til v2 (r01.3),
-- skal project_pois.travel_times mappes → POI.travelTime i container-loaderen.

ALTER TABLE v2.project_pois ADD COLUMN IF NOT EXISTS travel_times jsonb;

COMMENT ON COLUMN v2.project_pois.travel_times IS
  'Precompute (bead 2nj): {"walk": min, "bike": min, "car": min} fra prosjekt-origo via Mapbox Matrix. Minutter (ceil). NULL = ikke beregnet (haversine-fallback på board).';
