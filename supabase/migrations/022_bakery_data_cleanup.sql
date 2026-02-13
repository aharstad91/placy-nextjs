-- ============================================
-- 022: Bakery data cleanup
-- Remove misclassified POIs and fix editorial errors.
-- ============================================

-- ============================================
-- 1. MISCLASSIFIED — suppress non-bakeries
-- ============================================

-- Kung Fu Bao — a bao/dumpling restaurant, not a bakery
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Kung Fu Bao%' AND category_id = 'bakery';

-- Frederikke Kaffebar — a café, not a bakery
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Frederikke Kaffebar%' AND category_id = 'bakery';

-- Snurr Stjørdal — this is a hair salon (frisørsalong), not a bakery
-- The editorial hook even says "Frisørsalong" — clear misclassification
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Snurr Stj_rdal%' AND category_id = 'bakery';


-- ============================================
-- 2. FIX EDITORIAL — correct wrong/weak hooks
-- ============================================

-- Snurr Teknostallen — T2 bakery missing editorial content
UPDATE pois SET
  editorial_hook = 'Snurr Håndverksbakeri på Teknobyen serverer surdeigsbrød og bakst til studenter og ansatte ved NTNU — alt bakt fra bunnen av, hver dag.',
  local_insight = 'Ligger rett ved Teknobyen-holdeplassen — perfekt for en rask frokostbit før forelesning. Surdeigen er signaturvaren.'
WHERE name ILIKE '%Snurr%Tekno%' AND category_id = 'bakery';
