-- Migration 064: Wesselsløkka heroIntro — Apple-style emphasis
--
-- Legger **emphasis** rundt kjernepåstanden ("byens mest gjennomtenkte nabolag")
-- slik at ReportHero renderer to-tone: darker emphasis + softer surrounding text.
-- Matcher samme mønster som bridgeTexts i migration 062/063.
--
-- Ingen tekst lagt til — kun markup rundt eksisterende claim.

UPDATE products
SET config = jsonb_set(
  config,
  '{reportConfig,heroIntro}',
  '"Wesselsløkka ligger på Brøset, mellom Valentinlyst og Strindheim — på høyden øst i Trondheim. Over halvparten av området er viet til park og grøntareal, noe som gjør dette til **byens mest gjennomtenkte nabolag** for de som vil ha natur rett utenfor døren og hverdagen innen gangavstand."'::jsonb
)
WHERE id = 'c87b51f6-9cf7-4738-b452-cbea0bb62c65';
