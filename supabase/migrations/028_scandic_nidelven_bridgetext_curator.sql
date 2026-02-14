-- ============================================
-- 028: Scandic Nidelven — Curator bridgeText upgrade
-- Rewrites all bridgeText per theme using Curator principles:
--   A: Navngi (specific names, not generalizations)
--   B: Bevegelse (spatial movement through the neighborhood)
--   C: Kontraster (contrast between different offerings)
--   D: Saklig entusiasme (verifiable facts, not superlatives)
--   E: Mennesker (people and their stories)
--   F: Sensorisk presisjon (material, sensory details)
-- ============================================

UPDATE products
SET config = jsonb_set(
  config,
  '{reportConfig,themes}',
  '[
    {
      "id": "mat-drikke",
      "icon": "UtensilsCrossed",
      "name": "Mat & Drikke",
      "bridgeText": "Bula Neobistro — åpnet av Top Chef-vinner Reneé Fagerhøi — ligger minutter fra hotellet, Backstube baker tyske surdeigsbrød i Jomfrugata, og Spontan Vinbar i Brattørgata er anbefalt i Guide Michelin.",
      "categories": ["restaurant", "cafe", "bar", "bakery"]
    },
    {
      "id": "kultur-opplevelser",
      "icon": "Landmark",
      "name": "Kultur & Opplevelser",
      "bridgeText": "Rockheim — Norges nasjonalmuseum for pop og rock — holder til i en ombygd kornsilo rett ved hotellet. Trondhjems Kunstforening har vist kunst siden 1845, og Cinemateket i Olavshallen kjører filmhistorie på 35mm.",
      "categories": ["museum", "library", "cinema", "park"]
    },
    {
      "id": "hverdagsbehov",
      "icon": "ShoppingCart",
      "name": "Hverdagsbehov",
      "bridgeText": "Byhaven og Trondheim Torg ligger begge i gangavstand, med over hundre butikker til sammen. For det daglige har MENY Solsiden fullt sortiment, og Middelhavets Marked i Dronningens gate fører spesialvarer fra hele Middelhavsregionen.",
      "categories": ["supermarket", "pharmacy", "shopping", "haircare"]
    },
    {
      "id": "transport",
      "icon": "Bus",
      "name": "Transport & Mobilitet",
      "bridgeText": "Trondheim Bysykkel ved Dokkparken rett utenfor døren, buss fra Pirbadet holdeplass to minutter unna, og Trondheim S med tog mot Oslo og Bodø fjorten minutters gange langs Brattørkaia.",
      "categories": ["bus", "train", "tram", "bike", "parking", "carshare", "taxi", "airport"]
    },
    {
      "id": "trening-velvare",
      "icon": "Dumbbell",
      "name": "Trening & Velvære",
      "bridgeText": "3T Midtbyen i Dronningens gate for styrke og kondisjon, Zenit Yoga på Bakklandet for en roligere start — og for noe helt annet: POA i Pirbadet-bygget, Norges første sportsklubb for pole.",
      "categories": ["gym", "spa"]
    }
  ]'::jsonb
)
WHERE id = '6e8216b1-b17f-41e5-8c00-5b740cac9452';
