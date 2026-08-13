-- =============================================================================
-- Migrasjon 084 — v2.pois.grounding (per-POI Google-grounded innhold)
-- =============================================================================
-- HVA: Ny nullable jsonb-kolonne `grounding` på v2.pois.
--
-- HVORFOR: «Utforsk»-knappen i board-POI-popupene sender i dag brukeren ut av
-- Placy til Google AI Mode (?udm=50). Innholdet skal i stedet vises i en modal
-- inne i Placy, generert build-time per POI via Gemini + Google Search-grounding
-- (ingen runtime-LLM). Da må det grounded innholdet lagres per POI.
--
-- HVORFOR PÅ pois OG IKKE products.config: grounded stedsinnhold er
-- prosjekt-uavhengig POI-data — samme sted kan ligge på flere boards og skal
-- ikke genereres på nytt per board. `opening_hours_json` (og `poi_metadata`,
-- `gallery_images`) er den etablerte presedensen for cachet ekstern-data per
-- POI. Merk at products.config.reportConfig.themes[].grounding er et ANNET lag
-- (tema/strøk-skala) med eget skjema og egen versjonsakse — de to skal ikke
-- blandes.
--
-- FORM: nullable, INGEN default. Fravær betyr «ikke generert ennå», ikke «tom».
-- Ingen default → ingen table rewrite, og ingen backfill-lås på en tabell som
-- deles av alle tre produkter.
--
-- SHAPE (validert i TS av PoiGroundingViewSchema, lib/types.ts):
--   {
--     poiGroundingVersion: 1,
--     generated?: {                    -- provider-swappbart lag
--       provider: "gemini-search-grounding",
--       narrative, sources[], searchEntryPointHtml, searchQueries[],
--       model, fetchedAt, qualityGate: { passed, sourceCount, charCount, reason? }
--     },
--     curated?: { narrative, curatedAt }   -- Placy-eid lag, overlever swap
--   }
--
-- GOOGLE ToS: searchEntryPointHtml er PÅKREVD på grounding-provideren, lagres
-- DOMPurify-sanert og rendres verbatim. Grounded tekst kan lagres i inntil 2 år
-- (Gemini API Additional Terms) — `generated.fetchedAt` er alderskilden.
--
-- ROLLBACK: ALTER TABLE v2.pois DROP COLUMN grounding;
-- =============================================================================

ALTER TABLE v2.pois ADD COLUMN IF NOT EXISTS grounding jsonb;

COMMENT ON COLUMN v2.pois.grounding IS
  'Build-time Google-grounded stedsinnhold for Utforsk-modalen. Shape validert av PoiGroundingViewSchema (lib/types.ts), versjonert via poiGroundingVersion. To lag: generated (provider-swappbart) + curated (Placy-eid). searchEntryPointHtml lagres sanert og rendres verbatim (Google ToS). Maks lagringsalder 2 år, se generated.fetchedAt.';
