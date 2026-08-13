-- 089: tillat 'krets' som boundary_source på v2.areas
--
-- Migrasjon 088 innførte to verdier: 'curated' (håndtegnet eller håndjustert) og
-- 'derived' (avledet fra områdets postal_codes). 'derived' viste seg å arve en
-- gjetning: postnumrene i migrasjon 050 ble håndskrevet sammen med
-- senterkoordinater som beviselig bommer — Vikåsen står med 63.4300/10.4800,
-- som ligger utenfor hele VIKÅSEN-skolekretsen.
--
-- 'krets' er en tredje kvalitet: maskinsatt, men fra Trondheim kommunes egne
-- skolekretspolygoner (NLOD, data/geo/trondheim/barneskolekrets.json) i stedet
-- for fra en håndskrevet postnummerliste. Den er autoritativ på geometri, men
-- ikke verifisert mot markedets strøkgrenser — skolekretsnavn er ikke alltid
-- strøknavn, og RANHEIM-kretsen er kjent smalere enn markeds-Ranheim.
--
-- Rangeringen som gjelder videre: curated > krets > derived.
--
-- Ingen rader endres her. Selve byttet gjøres av
-- scripts/apply-krets-boundaries.ts --apply, som aldri rører 'curated'.

BEGIN;

ALTER TABLE v2.areas DROP CONSTRAINT IF EXISTS areas_boundary_source_valid;

ALTER TABLE v2.areas
  ADD CONSTRAINT areas_boundary_source_valid
  CHECK (boundary_source IS NULL OR boundary_source IN ('curated', 'krets', 'derived'));

COMMIT;
