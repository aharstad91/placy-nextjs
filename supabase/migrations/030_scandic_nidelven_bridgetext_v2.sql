-- ============================================
-- 029: Scandic Nidelven — bridgeText v2 (nabolagskarakter)
-- Rewrites bridgeText using neighborhood character approach:
--   - Describe the personality of the category in THIS area
--   - 1-2 anchor points as compass endpoints, not recommendations
--   - No stats (UI already shows count, rating, reviews)
--   - Register: introduction to a room, not a museum sign
-- Replaces 028's POI-centric approach which cherry-picked
-- 3 of 90 places without explaining why.
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
      "bridgeText": "Matscenen spenner fra Britannia-kvartalets fine dining til Bakklandets trehuskaféer — et uformelt og variert nabolag der sidegatene byr på like mye som hovedgatene.",
      "categories": ["restaurant", "cafe", "bar", "bakery"]
    },
    {
      "id": "kultur-opplevelser",
      "icon": "Landmark",
      "name": "Kultur & Opplevelser",
      "bridgeText": "Området har en kulturakse fra Rockheims kornsilo på Brattøra til de eldre galleriene mot sentrum — med parker langs Nidelva og kinosaler i Olavshallen innimellom.",
      "categories": ["museum", "library", "cinema", "park"]
    },
    {
      "id": "hverdagsbehov",
      "icon": "ShoppingCart",
      "name": "Hverdagsbehov",
      "bridgeText": "Sentrumshandelen fordeler seg mellom Byhaven og Trondheim Torg, med spesialbutikker langs Dronningens gate — de fleste hverdagsbehov løses til fots fra hotellet.",
      "categories": ["supermarket", "pharmacy", "shopping", "haircare"]
    },
    {
      "id": "transport",
      "icon": "Bus",
      "name": "Transport & Mobilitet",
      "bridgeText": "Nedre Elvehavn er godt tilknyttet — bysykkel og buss rett utenfor, og gangavstand til Trondheim S langs Brattørkaia.",
      "categories": ["bus", "train", "tram", "bike", "parking", "carshare", "taxi", "airport"]
    },
    {
      "id": "trening-velvare",
      "icon": "Dumbbell",
      "name": "Trening & Velvære",
      "bridgeText": "Treningstilbudet strekker seg fra fullskala kjeder i Midtbyen til nisjestudioer for yoga og kampsport på Bakklandet — bredere enn forventet for et sentrumsområde.",
      "categories": ["gym", "spa"]
    }
  ]'::jsonb
)
WHERE id = '6e8216b1-b17f-41e5-8c00-5b740cac9452';
