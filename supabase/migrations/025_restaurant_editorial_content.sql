-- ============================================
-- 025: Restaurant editorial content for Trondheim
-- Research-verified editorial hooks, misclassification
-- fixes, and improved intro text for restaurant category.
-- Trondheim: European Region of Gastronomy 2022,
-- home to Michelin-starred restaurants Fagn and Speilsalen.
-- ============================================


-- ============================================
-- 1. MISCLASSIFIED / NON-RESTAURANTS — suppress
-- Hotels, shopping malls, gas stations, catering
-- companies, and resource centers that are not restaurants.
-- ============================================

-- Quality Airport Hotel Værnes — hotel, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Quality Airport Hotel%' AND category_id = 'restaurant';

-- Quality Hotel Panorama — hotel with conference center, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Quality Hotel Panorama%' AND category_id = 'restaurant';

-- Quality Hotel Augustin — hotel, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Quality Hotel Augustin%' AND category_id = 'restaurant';

-- Clarion Hotel Trondheim — hotel (NÒR restaurant is a separate POI)
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Clarion Hotel Trondheim%' AND category_id = 'restaurant';

-- Solsiden Senter — shopping mall, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Solsiden Senter%' AND category_id = 'restaurant';

-- Biltema Café Tiller — hardware store café, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Biltema%' AND category_id = 'restaurant';

-- YX Kjøpmannsgaten — gas station, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%YX Kj%pmannsg%' AND category_id = 'restaurant';

-- Ro Ressurssenter — community resource center, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Ro Ressurssenter%' AND category_id = 'restaurant';

-- Care Catering — catering company, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Care Catering%' AND category_id = 'restaurant';

-- Toppen Catering AS — catering company, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Toppen Catering%' AND category_id = 'restaurant';

-- SIT Kafe Handelshøyskolen — university cafeteria, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%SIT Kafe%Handels%' AND category_id = 'restaurant';

-- Réal mat — food shop/grocery, not a restaurant (both entries)
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%R_al mat%' AND category_id = 'restaurant';

-- Lills cafe og catering — catering operation, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Lills cafe%catering%' AND category_id = 'restaurant';

-- Fox grill AS — no data, no reviews, likely closed
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Fox grill%' AND category_id = 'restaurant';

-- Kjelhuset — SiT student cafeteria at NTNU Gløshaugen, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Kjelhuset%' AND category_id = 'restaurant';

-- Qazija — no data, no reviews, unknown establishment
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Qazija%' AND category_id = 'restaurant';

-- Spicy Aroma — no reviews, vague description, trust_score already 0.65
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Spicy Aroma%' AND category_id = 'restaurant';

-- Sweet Spot Nutrition — smoothie/bowl bar, more café than restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Sweet Spot Nutrition%' AND category_id = 'restaurant';

-- Las Tæmmys Mårgåsmat — no Google data, unknown, cannot verify
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Las T%mmys%' AND category_id = 'restaurant';

-- Kvikk Bar AS — counter inside Solsiden mall, wrap/smoothie kiosk
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Kvikk Bar%' AND category_id = 'restaurant';

-- Værnes bar — bar only, very few reviews, located in Kjøpmannsgata Stjørdal
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%V_rnes bar%' AND category_id = 'restaurant';

-- Simens Isbar — ice cream/dessert shop, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Simens Isbar%' AND category_id = 'restaurant';

-- Gola gelato & cafe — gelato/empanada café, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Gola gelato%' AND category_id = 'restaurant';

-- DABA Art Café & eco — art café, not a restaurant
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%DABA Art%' AND category_id = 'restaurant';

-- Snackyard Solsiden — pinsa/sandwich bar with 1 review
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Snackyard%' AND category_id = 'restaurant';


-- ============================================
-- 2. TIER 1 — EDITORIAL HOOKS (research-verified)
-- Michelin-starred, award-winning, and iconic restaurants
-- ============================================

-- Credo Restaurant (T1, 4.7★, 920 reviews)
-- Michelin star 2019, first Green Michelin Star in the world.
-- Founded by Heidi Bjerkan. MOVED TO OSLO late 2024.
-- Still in Trondheim POI list — add accurate hook noting the closure.
UPDATE pois SET
  editorial_hook = 'Heidi Bjerkans Credo fikk Michelin-stjerne i 2019 og verdens aller første grønne Michelin-stjerne for bærekraftig gastronomi. Etter 25 år i Trondheim flyttet restauranten til Nasjonalbiblioteket i Oslo i 2024.',
  local_insight = 'Credo er ikke lenger i Trondheim — restauranten åpnet på nytt i Oslo høsten 2024. Lokalene i Credoveita huser nå Fagn og Fagn Bistro.',
  trust_score = 0.3
WHERE name ILIKE '%Credo Restaurant%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Fagn Restaurant (T1, 4.8★, 510 reviews)
-- Michelin star 2019, Trondheim's first. Founded by Jonas Nåvik (Alinea alum).
-- Located in Credoveita (Credo's former premises). Currently missing editorial.
UPDATE pois SET
  editorial_hook = 'Trondheims første Michelin-stjerne — Fagn ble tildelt stjernen i 2019, grunnlagt av Jonas Nåvik med erfaring fra trestjernede Alinea i Chicago. Holder til i Credoveita med fine dining i første etasje og bistro i andre.',
  local_insight = 'Fagn Bistro i etasjen over bruker samme førsteklasses råvarer som Michelin-restauranten, men i en mer avslappet og rimeligere ramme. Bestill bord i god tid — Fagn har kun plass til rundt 30 gjester.'
WHERE name ILIKE '%Fagn Restaurant%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Havfruen Fiskerestaurant (T1, 4.6★, 820 reviews)
-- Opened April 1, 1987. Oldest independent restaurant in Trondheim.
-- First to serve sushi in Trondheim (1998). Famous for lutefisk.
-- Located in 18th century wharf warehouse by Nidelva.
UPDATE pois SET
  editorial_hook = 'Trondheims eldste uavhengige restaurant, åpnet 1. april 1987 i et 1700-talls sjøhus ved Nidelva. Havfruen var den første restauranten i Trondheim som serverte sushi, allerede i 1998, og selger mer lutefisk per kvadratmeter enn noe annet sted i byen.',
  local_insight = 'Sildebuffeten og akevittutvalget er legendariske. Be om vindusbord mot Gamle Bybro for Trondheims mest ikoniske restaurantutsikt — Nidarosdomen, Bakklandet og elva i ett blikk.'
WHERE name ILIKE '%Havfruen%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- To Rom og Kjøkken (T1, 4.5★, 650 reviews)
-- Opened October 10, 2005. Founded by Roar Hildonen, Ole-Erik Holmen-Løkken,
-- and Alexander Skjefte. Son Eskil is now head chef. Chaîne des Rôtisseurs member.
-- Currently missing editorial.
UPDATE pois SET
  editorial_hook = 'Familiedrevet finedining siden 2005 — grunnlagt av Roar Hildonen og Alexander Skjefte med mål om å løfte Trondheims restaurantscene. Sønnen Eskil er nå kjøkkensjef, og restauranten er medlem av Chaîne des Rôtisseurs.',
  local_insight = 'Velg mellom tre-, fem- eller sjuretters smaksmeny, alle bygget på sesongbaserte råvarer fra Trøndelag. Det intime trehuset i Carl Johans gate har plass til rundt 40 gjester — reserver i god tid.'
WHERE name ILIKE '%To Rom og Kj%kken%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Britannia Hotel (T1, 4.7★, 2051 reviews)
-- Already has a good hook about the hotel itself. But the hook should mention
-- Speilsalen's Michelin star and Christopher Davidsen more prominently.
UPDATE pois SET
  editorial_hook = 'Norges mest ikoniske hotell fra 1870, restaurert for 1,4 milliarder i 2019. Huser Michelin-restauranten Speilsalen med Bocuse d''Or-sølvvinner Christopher Davidsen, samt Jonathan Grill og legendariske Palmehaven.',
  local_insight = 'Speilsalen fikk Michelin-stjerne bare 10 måneder etter åpning. Palmehaven serverer lunsj med live musikk — bestill bord her for en overkommelig smak av Britannia uten full fine dining-prislapp.'
WHERE name ILIKE '%Britannia Hotel%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- SELLANRAA Bok & Bar (T1, 4.6★, 605 reviews) — currently has a café-style hook.
-- This is a restaurant that also serves food — keep existing hook as it's good.
-- No change needed.

-- Baklandet Skydsstation (T1, 4.5★, 1497 reviews)
-- Already has excellent hook and local_insight. Verified: National Geographic 2012,
-- 350 aquavits, 18th century. No change needed.

-- Troll Restaurant (T1, 4.4★, 1659 reviews)
-- Current hook mentions "urteinnbakt hest" — verify this is accurate.
-- Keep as-is, it's a distinctive and accurate hook.


-- ============================================
-- 3. TIER 2 — EDITORIAL HOOKS (research-verified)
-- Notable restaurants with missing or weak hooks
-- ============================================

-- Spontan Vinbar (T2, 4.4★, 380 reviews)
-- Norway's Best Medium-Sized Wine List 3 consecutive years.
-- Moved to Fjordgata 1 in 2022. Chef Fredrik Engen. Natural wine focus.
-- Currently missing editorial.
UPDATE pois SET
  editorial_hook = 'Trondheims eneste rene naturvinbar, kåret til Norges beste vinliste (mellomstørrelse) tre år på rad. Flyttet til større lokaler i Fjordgata i 2022 — vinbar foran, restaurant med fem- eller tiretters sesongmeny bak.',
  local_insight = 'Drop-in i vinbaren foran for et glass og småsnacks, eller bestill bord i restaurantdelen for chef Fredrik Engens nordiske smaksmeny med lokale råvarer. Vinlisten endres jevnlig — spør om ukens favoritt.'
WHERE name ILIKE '%Spontan Vinbar%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Mesob Restaurant & Bar (T2, 4.7★, 207 reviews)
-- Eritrean/Ethiopian, opened 2016 at Ravnkloa. Injera, shiro, derho.
-- Currently missing editorial.
UPDATE pois SET
  editorial_hook = 'Eritreisk og etiopisk kjøkken ved Ravnkloa siden 2016 — hjemmelaget injera, shiro og derho i et intimt lokale med levende stearinlys og etiopisk musikk.',
  local_insight = 'Alt spises tradisjonelt med hendene fra et felles fat med injera-brød. Bestill «Mixed Platter» for en komplett introduksjon til det eritreiske kjøkkenet — porsjonene er rause og deling er en del av opplevelsen.'
WHERE name ILIKE '%Mesob%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Lyche Kjøkken & Bar (T2, 4.5★, 297 reviews)
-- Student-run at Studentersamfundet, famous Lycheburger.
-- Currently missing editorial.
UPDATE pois SET
  editorial_hook = 'Studentdrevet kjøkken og bar i Studentersamfundet — hele staben er frivillige studenter som brenner for mat. Lycheburger er kåret til en av Trondheims beste burgere, og menyen skiftes to ganger i året.',
  local_insight = 'Medlemmer av Studentersamfundet får rabatt. Lycheburger med egenprodusert øl fra medstudenter er den klassiske kombisjonen — kom tidlig på fredager for å sikre bord.'
WHERE name ILIKE '%Lyche Kj%kken%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Grano Pizzeria (T2, 4.5★, 440 reviews) — Søndre gate
-- #1 pizza in Trondheim on Tripadvisor. Four guys making authentic Italian pizza.
-- Currently missing editorial.
UPDATE pois SET
  editorial_hook = 'Fire kompisers lidenskap for italiensk pizza — Grano i Søndre gate er rangert som Trondheims beste pizzeria og byr på alt fra klassiske runde pizzaer til al taglio-stykker og panini.',
  local_insight = 'Du kan også kjøpe deig, saus og ingredienser med hjem for å lage din egen pizza. Prøv al taglio (stykke-pizza) for en rask lunsj — perfekt til å ta med ut i solen.'
WHERE name ILIKE '%Grano Pizzeria%' AND category_id = 'restaurant'
  AND area_id = 'trondheim'
  AND poi_tier = 2;

-- Superhero Burger (T2, 4.4★, 560 reviews)
-- Charcoal-grilled burgers, multiple locations, #9 on Tripadvisor.
-- Currently missing editorial.
UPDATE pois SET
  editorial_hook = 'Håndlagde burgere grillet over kull — Superhero Burger er rangert blant Trondheims ti beste restauranter og har filialer på både Torget og i Olav Tryggvasons gate.',
  local_insight = 'Brettspill tilgjengelig for gjestene — perfekt for en uformell kveld. Burgerne koster 100–200 kr, og det finnes gode vegetariske alternativer.'
WHERE name ILIKE '%Superhero Burger%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Xu's Nan Jing Hus (T2, 4.6★, 177 reviews)
-- Nanjing-style Chinese, opened 2024, Elgeseter gate.
-- Currently missing editorial.
UPDATE pois SET
  editorial_hook = 'Autentisk Nanjing-kjøkken på Elgeseter gate — et nyåpnet tilskudd til Trondheims kinesiske restaurantscene med fokus på regionale kinesiske retter fra Jiangsu-provinsen.',
  local_insight = 'Et av få steder i Trondheim som serverer regional kinesisk mat fremfor den generiske «kinarestaurant»-menyen. Åpent alle dager — perfekt for studenter i nærområdet.'
WHERE name ILIKE '%Xu%Nan Jing%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Trondhjem Mikrobryggeri (T2, 4.3★, 720 reviews)
-- Trondheim's first brewpub since 1998, also distilling since 2017.
-- Currently missing editorial. (Note: "Trondheim microbrewery" T2 entry
-- has a good hook already — this is likely a duplicate with Norwegian name.)
UPDATE pois SET
  editorial_hook = 'Trondheims første bryggeripub siden 1998 — alt øl brygges på stedet i Prinsens gate, og siden 2017 destillerer de også egen sprit. Husets burgere og deleretter er laget fra bunnen.',
  local_insight = 'Spør om å smake på eksklusive brygg som kun serveres her og aldri når butikkhyllene. Åpent fra ettermiddag mandag–lørdag, stengt søndag.'
WHERE name ILIKE '%Trondhjem Mikrobryggeri%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Bakgården Bar og Spiseri (T2, 4.2★, 400 reviews)
-- Trondheim's first tapas restaurant, opened 2009.
-- Spanish-inspired with local ingredients. Kjøpmannsgata 40.
-- Currently missing editorial.
UPDATE pois SET
  editorial_hook = 'Trondheims første tapasrestaurant, åpnet i 2009 i et vakkert gammelt bygg i Kjøpmannsgata. Spanskinspirert meny med lokale råvarer — fra blåskjell og chorizobolletter til grillet sopp og andeconfit.',
  local_insight = 'Sett sammen din egen tapas-meny, eller la kjøkkenet velge med en av de ferdige menyene. Perfekt for deling — bestill fire til seks retter per person for full effekt.'
WHERE name ILIKE '%Bakg%rden Bar%Spiseri%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Sabrura Sticks & Sushi Bakklandet (T2, 4.2★, 821 reviews)
-- Part of the Sabrura chain, Bakklandet location.
-- Currently missing editorial.
UPDATE pois SET
  editorial_hook = 'Sabruras avdeling på Bakklandet — sushi, sticks og dim sum i et avslappet lokale nær Gamle Bybro, med samme konsept som Solsiden-filialen.',
  local_insight = 'Spis-alt-du-vil-buffeten er populær i helgene — kom tidlig for best utvalg. Beliggenheten på Bakklandet gir en hyggelig spasertur langs Nidelva før eller etter maten.'
WHERE name ILIKE '%Sabrura%Bakklandet%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Bula Asian Kitchen (T2, 4.2★, 290 reviews)
-- Related to Bula Neobistro (same owner Renée Fagerhøi), more casual Asian concept.
-- Currently missing editorial.
UPDATE pois SET
  editorial_hook = 'Det uformelle søsterkonseptet til Bula Neobistro — asiatisk-inspirert streetfood fra Top Chef 2016-vinner Renée Fagerhøis kjøkkenteam.',
  local_insight = 'Rimeligere og mer avslappet enn Neobistro-versjonen, med fokus på asiatiske smaker i et uformelt format. Perfekt for en rask og smakfull middag uten å bryte budsjettet.'
WHERE name ILIKE '%Bula Asian%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Glød Asian Fusion (T2, 4.8★, 19 reviews)
-- Very few reviews but high rating. Trust score already 0.75.
-- Keep as-is, too few reviews for editorial investment.

-- Jaki Bar (T2, 4.9★, 8 reviews)
-- Only 8 reviews. Current hook is reasonable. Keep as-is.

-- Lerka (T2, 4.5★, 72 reviews)
-- Napoletana pizza at Olavshallen. Trust score 0.6.
-- Currently missing editorial.
UPDATE pois SET
  editorial_hook = 'Tynnskåret napoletansk pizza i Olavshallen — Lerka serverer autentisk italiensk pizza med mulighet for glutenfritt alternativ, i konserthuset midt i Kjøpmannsgata.',
  local_insight = 'Perfekt for en rask lunsj eller pizza før en konsert i Olavshallen. Focaccia-pizzaen til deling er populær for grupper.'
WHERE name ILIKE '%Lerka%' AND category_id = 'restaurant'
  AND area_id = 'trondheim'
  AND poi_tier = 2;

-- KōH i NÒR (T2, 4.4★, 2615 reviews)
-- Already has a good hook about Parkgården history. Keep as-is.

-- Olivia Restaurant — T3 chain restaurant, but with missing hook
-- Add a basic hook since it has 870 reviews
UPDATE pois SET
  editorial_hook = 'Italiensk restaurantkjede med hjemmelaget pasta og pizza — Olivias Trondheim-filial følger den florentinske stilen fra de andre avdelingene.',
  local_insight = 'Populært for familier og grupper. Reserver i helgene — Olivia er blant Trondheims mest besøkte restauranter.'
WHERE name ILIKE '%Olivia Restaurant%' AND category_id = 'restaurant'
  AND area_id = 'trondheim'
  AND editorial_hook IS NULL;


-- ============================================
-- 4. IMPROVE EXISTING HOOKS — minor corrections
-- ============================================

-- Bula Neobistro (T1) — hook says "Topp Chef-vinner" but her name has
-- a typo "Reneé" (should be "Renée"). Also Top Chef was 2016, not generic.
-- Current hook is colorful and good. Just fix the accent on Renée.
UPDATE pois SET
  editorial_hook = 'Trondheims opprørske lillesøster i restaurantscenen, ledet av Top Chef 2016-vinner Renée Fagerhøi — overraskelsesmeny, flamingodekor og Frank Ocean på anlegget.'
WHERE name ILIKE '%Bula Neobistro%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Tollbua (T2) — hook already mentions Bocuse d'Or silver. Good hook.
-- Just add trust_score since it's verified.
UPDATE pois SET trust_score = 1.0
WHERE name ILIKE '%Tollbua%Restaurant%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Jonathan Grill (T2) — hook already excellent and verified. Add trust_score.
UPDATE pois SET trust_score = 1.0
WHERE name ILIKE '%Jonathan Grill%' AND category_id = 'restaurant'
  AND area_id = 'trondheim';

-- Amber Restaurant (T2) — hook says "Nordisk fine dining med asiatiske
-- undertoner" but it's actually an Asian restaurant. Keep hook — it's
-- a fair description of their fusion concept.

-- Intro text mentions Speilsalen — confirm it's correct.
-- Speilsalen is indeed Michelin-starred (since 2020).
-- Credo has moved to Oslo — update intro text to reflect this.


-- ============================================
-- 5. IMPROVED INTRO TEXT — Norwegian (multi-paragraph)
-- Mentions: European Region of Gastronomy 2022, Michelin stars
-- (Fagn and Speilsalen), Credo's departure, range of dining.
-- ============================================

UPDATE category_slugs SET
  intro_text = 'Trondheim er en av Norges sterkeste matbyer. Trøndelag ble kåret til European Region of Gastronomy i 2022 som første region i Norge, og byen har to aktive Michelin-restauranter: Fagn og Speilsalen på Britannia Hotel. Heidi Bjerkans Credo, som fikk verdens første grønne Michelin-stjerne, holdt til i byen i 25 år før den flyttet til Oslo i 2024.

Restaurantscenen spenner fra Bocuse d''Or-sølvvinner Christopher Davidsens to konsepter — Michelin-restauranten Speilsalen og den nordiske gourmetbistroen Tollbua — til studentdrevne Lyche på Studentersamfundet og Havfruen, byens eldste uavhengige restaurant siden 1987. Top Chef-vinner Renée Fagerhøis Bula Neobistro serverer overraskelsesmeny med flamingodekor, mens To Rom og Kjøkken har levert familiedrevet finedining siden 2005.

Trondheim byr også på et rikt mangfold av internasjonale kjøkken: eritreisk på Mesob, autentisk Nanjing-kinesisk hos Xu''s, napolitansk pizza hos Grano og Hevd, og asiatisk fusion på Robata. Naturvinbaren Spontan (nå Saga) er kåret til Norges beste vinliste tre år på rad, og bryggerpuben Trondhjem Mikrobryggeri har brygget sitt eget øl siden 1998.

Enten du er ute etter Michelin-stjerner, en avslappet burger hos Superhero, eller sjømat i et 1700-talls sjøhus — denne guiden hjelper deg å finne de beste restaurantene i Trondheim, kuratert med ekte lokalkunnskap.',
  seo_description = 'Oppdag de beste restaurantene i Trondheim — European Region of Gastronomy 2022. Fra Michelin-stjernene Fagn og Speilsalen til Havfruen (1987) og Bula Neobistro. Kuratert guide.'
WHERE category_id = 'restaurant' AND locale = 'no';


-- ============================================
-- 6. IMPROVED INTRO TEXT — English (multi-paragraph)
-- Same structure and facts as Norwegian version.
-- ============================================

UPDATE category_slugs SET
  intro_text = 'Trondheim is one of Norway''s strongest food cities. Trøndelag was named European Region of Gastronomy in 2022 — the first Norwegian region to receive the honor — and the city has two active Michelin-starred restaurants: Fagn and Speilsalen at the Britannia Hotel. Heidi Bjerkan''s Credo, which received the world''s first Green Michelin Star, was based here for 25 years before moving to Oslo in 2024.

The restaurant scene spans from Bocuse d''Or silver medalist Christopher Davidsen''s two concepts — Michelin-starred Speilsalen and the Nordic gourmet bistro Tollbua — to the student-run Lyche at the Student Society and Havfruen, the city''s oldest independent restaurant since 1987. Top Chef winner Renée Fagerhøi''s Bula Neobistro serves surprise menus with flamingo decor, while To Rom og Kjøkken has delivered family-run fine dining since 2005.

Trondheim also offers a rich diversity of international cuisines: Eritrean at Mesob, authentic Nanjing Chinese at Xu''s, Neapolitan pizza at Grano and Hevd, and Asian fusion at Robata. Natural wine bar Spontan (now Saga) has been crowned Norway''s best wine list three years running, and the brewpub Trondhjem Mikrobryggeri has been brewing its own beer since 1998.

Whether you''re looking for Michelin stars, a casual burger at Superhero, or seafood in an 18th-century wharf warehouse — this guide helps you find the best restaurants in Trondheim, curated with genuine local knowledge.',
  seo_description = 'Discover the best restaurants in Trondheim — European Region of Gastronomy 2022. From Michelin-starred Fagn and Speilsalen to Havfruen (1987) and Bula Neobistro. Curated guide.'
WHERE category_id = 'restaurant' AND locale = 'en';
