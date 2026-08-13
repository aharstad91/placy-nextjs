-- =============================================================================
-- Migrasjon 088 — v2.areas.boundary_source (håndtegnet vs. avledet polygon)
-- =============================================================================
-- HVA: Ny kolonne `boundary_source` på v2.areas med verdiene 'curated' og
-- 'derived', pluss backfill av de eksisterende radene som har polygon.
--
-- HVORFOR: Fra og med denne endringen kan et områdes `boundary` avledes
-- maskinelt som unionen av områdets postnumre (se 086/087 og
-- lib/pipeline/derive-area-boundary.ts). Uten et skille mellom de to slagene blir
-- en avledet, grov form umulig å se forskjell på en kurators egen presise
-- avgrensning — og de skal behandles helt ulikt.
--
-- DEN KONKRETE FELLEN: flere strøk deler postnummer. Møllenberg, Rosenborg og
-- Solsiden er alle 7014; Brøset og Moholt er begge 7050; Lerkendal og Singsaker
-- er begge 7030. Avledet fra postnummer får de identisk geometri. `findAreaForPoint`
-- samler alle treff, advarer, og bruker `matches[0]` — altså vilkårlig valgt. I dag
-- er det ufarlig fordi ingen av dem har `report_editorial` (geofencen krever
-- BEGGE), men i det øyeblikket to av dem kureres, ville en bolig i 7014 fått
-- Rosenborg-tekst eller Solsiden-tekst etter tilfeldighetene.
--
-- Kolonnen gjør faren synlig i stedet for skjult: dekningsrapporten kan si
-- «dette området har avledet form og deler postnummer med to andre — det trenger
-- en tegnet grense før det kureres».
--
-- BACKFILL: alle rader som HAR boundary i dag er håndtegnet av en kurator
-- (verifisert: de 9 er Charlottenlund, Eberg, Lade, Malvik, Oppdal, Ranheim,
-- Sentrum, Straumen, Tyholt — alle med report_editorial). De settes til
-- 'curated'. Rader uten boundary får NULL, ikke en default: fravær av polygon
-- skal ikke se ut som et valgt opphav.
--
-- INGEN NOT NULL / INGEN DEFAULT: en NOT NULL-kolonne med default ville tvunget
-- et opphav på rader som ikke har noen form å ha opphav til.
--
-- KJØRES via psql direkte. Additiv og reversibel (se ROLLBACK).
-- =============================================================================

BEGIN;

ALTER TABLE v2.areas
  ADD COLUMN boundary_source text;

ALTER TABLE v2.areas
  ADD CONSTRAINT areas_boundary_source_valid
  CHECK (boundary_source IS NULL OR boundary_source IN ('curated', 'derived'));

UPDATE v2.areas
  SET boundary_source = 'curated'
  WHERE boundary IS NOT NULL;

-- Et opphav uten en form er meningsløst, og en form uten opphav er en rad som
-- har sneket seg forbi skrivestien.
--
-- REKKEFØLGE: denne må legges til ETTER backfillen. Lagt til før, ville de 9
-- radene som alt har boundary brutt den i samme transaksjon (boundary NOT NULL,
-- boundary_source ennå NULL) og hele migrasjonen rullet tilbake.
ALTER TABLE v2.areas
  ADD CONSTRAINT areas_boundary_source_requires_boundary
  CHECK ((boundary IS NULL) = (boundary_source IS NULL));

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFISERING ETTER KJØRING:
--   SELECT boundary_source, count(*) FROM v2.areas GROUP BY 1 ORDER BY 1;
--   -- forvent: curated 9, NULL 37
--
--   -- begge CHECK-ene skal håndheve (begge skal FEILE):
--   UPDATE v2.areas SET boundary_source = 'tegnet' WHERE id = 'ranheim';
--   UPDATE v2.areas SET boundary_source = 'derived' WHERE id = 'bakklandet';
--
-- ROLLBACK (kjør KUN hvis 088 må angres):
--   ALTER TABLE v2.areas DROP CONSTRAINT areas_boundary_source_requires_boundary;
--   ALTER TABLE v2.areas DROP CONSTRAINT areas_boundary_source_valid;
--   ALTER TABLE v2.areas DROP COLUMN boundary_source;
-- =============================================================================
