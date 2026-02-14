-- ============================================
-- 027: Café editorial v2
-- Comprehensive improvement of café editorial content:
-- - Suppress permanently closed Café le Frère (Feb 2024)
-- - Research-verified hooks for Antikvariatet, Awake, ISAK Bakeri,
--   Digs, TeaOlogy, Boba Joy, Coffee Annan
-- - Fix tidsregel violations in Sellanraa hooks
-- - Rewrite intro_text (remove avoid-list words, fix tidsregel)
-- - Improve category quote templates
-- ============================================


-- ============================================
-- 1. SUPPRESS CLOSED VENUE
-- ============================================

-- Café le Frère — PERMANENTLY CLOSED February 13, 2024.
-- Founded by Kjell Harry Lyngaas (~Feb 2016), closed after 8 years.
-- Source: Underdusken "Café le farvel", Adressa.
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Caf%le Fr%re%' AND category_id = 'cafe';

-- Also try without accent
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Cafe le Frere%' AND category_id = 'cafe'
  AND trust_score IS DISTINCT FROM 0.1;


-- ============================================
-- 2. NEW & IMPROVED EDITORIAL HOOKS
-- ============================================

-- Antikvariatet (Anbefalt, 4.7★, 433 reviews)
-- Opened 2009 by Carsten Bakke Tourrenc (born France, studied NTNU).
-- ~300 concerts/year. Building from early 1800s on Nedre Bakklandet.
-- Two spaces: café + bokbar with Nidelva/cathedral views.
-- Source: Adressa 15-year profile, Trondheim24, restauranterinorge.com
UPDATE pois SET
  editorial_hook = 'Musikk-kafé og bokbar på Bakklandet, grunnlagt i 2009 av franskfødte Carsten Bakke Tourrenc — rundt 300 konserter i året i en rødmalt trebygning fra tidlig 1800-tall ved Nidelva.',
  local_insight = 'Bokbaren innerst har utsikt mot Gamle Bybro og Nidarosdomen — bøkene på veggene er til salgs. Programmerer alt fra jazz og impro-teater til franske kulturkvelder.'
WHERE name ILIKE '%Antikvariatet%' AND category_id = 'cafe';

-- Awake (T1, 4.9★, 209 reviews)
-- Opened June 2024, run by Norkirken Trondheim Salem and 22B Kontaktsenter.
-- 70 language practice placements via Flyktningenheten.
-- Source: Awake website, Norkirken Salem
UPDATE pois SET
  editorial_hook = 'Inkluderende kafé ved Trondheim Torg, åpnet i juni 2024 — drevet av Norkirken og 22B Kontaktsenter med 70 språkpraksisplasser via kommunens flyktningenhet.',
  local_insight = 'Naturmaterialer i interiøret og gjennomtenkt meny til rimelige priser. En kafé med sosialt formål som også leverer på kvalitet.'
WHERE name ILIKE '%Awake%' AND category_id = 'cafe'
  AND poi_tier = 1;

-- ISAK Bakeri (sourdough bakery in Trondheim's old town hall)
-- Opened 2020, part of Sellanraa family. Uses ancient grains from Gullimunn.
-- Serves tea from Gravraak Teatelier (Hanne Charlotte Heggberget,
-- Norway's only Master Tea Blender).
-- Source: sellanraa.no, Visit Trondheim, Scan Magazine (Gravraak)
UPDATE pois SET
  editorial_hook = 'Surdeigsbakeriet i Trondheims gamle rådhus — del av Sellanraa-familien siden 2020, med urkornsbrød fra trønderske Gullimunn og te fra Norges eneste Master Tea Blender.',
  local_insight = 'Brødvinduet mot gaten selger ferskt brød og ferdiglaget lunsj. Prøv Dala-hvete fra Gullimunn — et urkorn som gir brødet nøtteaktig dybde.'
WHERE name ILIKE '%ISAK%Bakeri%' AND category_id = 'cafe';

-- Also try ISAKS variant
UPDATE pois SET
  editorial_hook = 'Surdeigsbakeriet i Trondheims gamle rådhus — del av Sellanraa-familien siden 2020, med urkornsbrød fra trønderske Gullimunn og te fra Norges eneste Master Tea Blender.',
  local_insight = 'Brødvinduet mot gaten selger ferskt brød og ferdiglaget lunsj. Prøv Dala-hvete fra Gullimunn — et urkorn som gir brødet nøtteaktig dybde.'
WHERE name ILIKE '%ISAKS%' AND category_id = 'cafe'
  AND editorial_hook IS NULL;

-- Digs Kafé (café in Trondheim's first coworking space)
-- Founded 2013 by Arnstein Johannes Syltern. Crown Prince Haakon
-- opened expanded space May 1, 2019. Serves Pala coffee.
-- Source: Life in Norway, Zebr Institute, Visit Trondheim, Wikitia
UPDATE pois SET
  editorial_hook = 'Kafé i Trondheims første coworking-space — Digs ble grunnlagt i 2013 av industridesigner Arnstein Syltern og offisielt åpnet av Kronprins Haakon i 2019.',
  local_insight = 'Serverer Pala-kaffe fra lokal trondheimsk mikrobrenner og ferske kanelsnurrer hver morgen. Utsikt mot Nidarosdomen fra etasjen over.'
WHERE name ILIKE '%Digs%' AND category_id = 'cafe';

-- TeaOlogy (bubble tea chain, Trondheim Torg)
-- Trondheim location opened August 20, 2021 (4th "tea station").
-- Now 9 locations across Norway. 100% plant-based milk.
-- Source: TeaOlogy website, Trondheim Torg, TripAdvisor
UPDATE pois SET
  editorial_hook = 'Norsk bubble tea-kjede med kun plantebasert melk — Trondheim-filialen på Trondheim Torg åpnet i august 2021 som kjedens fjerde lokale.',
  local_insight = 'All te brygges fersk hver time. Velg mellom rismelk, soyamelk, kokosmelk og mandelmelk — ingen meieriprodukter på menyen.'
WHERE name ILIKE '%TeaOlogy%' AND category_id = 'cafe';

-- Boba Joy (Asian snack shop + bubble tea bar)
-- Founded August 2021 by Mymy Moa. Opened early 2022.
-- Address: Olav Tryggvasons gate 1. 4.7★, 124 reviews.
-- Source: bobajoy.no, Proff.no, Wolt
UPDATE pois SET
  editorial_hook = 'Asiatisk snackbutikk og bubble tea-bar i Olav Tryggvasons gate, startet av Mymy Moa i 2021 — kombinerer asiatiske snacks med egenblandede drikker.',
  local_insight = 'Mer enn bare bubble tea — ferskbrygget iste, smoothies og asiatiske snacks under samme tak. Brown sugar fresh milk er signaturdrikken.'
WHERE name ILIKE '%Boba Joy%' AND category_id = 'cafe';

-- Coffee Annan (in-house café at Kultursenteret ISAK)
-- ISAK opened 1993 as youth culture center, municipally run.
-- Name is a pun on Kofi Annan (ISAK = originally Internasjonalt Senter).
-- 130 events/year, board games, live music, drug-free.
-- Source: isak.no, Trondheim kommune
UPDATE pois SET
  editorial_hook = 'Kafé og kulturscene i Kultursenteret ISAK — kommunalt ungdomshus i et gammelt sjøhus i Prinsens gate siden 1993, med brettspill, konserter og rimelige priser.',
  local_insight = 'Navnet er en ordlek på Kofi Annan — ISAK sto opprinnelig for Internasjonalt Senter. Rusfritt og inkluderende, med over 130 åpne arrangementer i året.'
WHERE name ILIKE '%Coffee Annan%' AND category_id = 'cafe';


-- ============================================
-- 3. FIX TIDSREGEL VIOLATIONS IN EXISTING HOOKS
-- ============================================

-- SELLANRAA Bok & Bar — fix "med NM-vinnende baristaer" (present tense
-- about employees). Use historical form instead.
-- Also fix local_insight to use historical form for barista.
UPDATE pois SET
  editorial_hook = 'Litteraturhus-kafé i den gamle brannstasjonen, oppkalt etter Hamsuns Isak Sellanraa — åpnet høsten 2016 med kafé, bar og restaurant i Trondheims litteraturhus.',
  local_insight = 'Erlend Wessel-Berg vant NM i Brewers Cup 2019 og NM Barista 2025 på Sellanraa. Serverer kaffe fra Tim Wendelboe og lokale Pala — dør-i-dør med Trondheim bibliotek.'
WHERE name ILIKE '%SELLANRAA%Bok%' AND category_id = 'cafe'
  AND poi_tier = 1;


-- ============================================
-- 4. CHAIN CAFÉS — basic factual hooks
-- ============================================

-- Kaffebrenneriet — Norwegian specialty coffee chain, founded 1994
UPDATE pois SET
  editorial_hook = 'Norsk spesialkaffe-kjede grunnlagt i Oslo i 1994 — en av landets første lysbrent-kaffe-aktører, med filialer i de fleste norske byer.',
  local_insight = 'Godt valg for konsistent kvalitetskaffe. Kaffebrenneriet brenner alle bønner selv og tilbyr filterkaffe, espresso og sesongdrikker.'
WHERE name ILIKE '%Kaffebrenneriet%' AND category_id = 'cafe'
  AND editorial_hook IS NULL;

-- Godt Brød — organic bakery chain, founded Bergen 1995
UPDATE pois SET
  editorial_hook = 'Økologisk bakeriskjede grunnlagt i Bergen i 1995 — alt brød bakes med sertifiserte økologiske råvarer og sakte heving.',
  local_insight = 'Surdeigsbrødet og kanelsnurrene er faste bestselgere. Frokostmenyen med ferske sandwicher og salater er populær blant kontorfolk.'
WHERE name ILIKE '%Godt Brød%' AND category_id = 'cafe'
  AND editorial_hook IS NULL;

-- Starbucks — global chain, basic factual hook
UPDATE pois SET
  editorial_hook = 'Verdens største kaffekjede, grunnlagt i Seattle i 1971 — Trondheim-filialene følger det globale konseptet med standardisert meny.',
  local_insight = 'Forutsigbar kvalitet og lang åpningstid. Wi-Fi og strømuttak gjør det til et praktisk valg for fjernarbeidere.'
WHERE name ILIKE '%Starbucks%' AND category_id = 'cafe'
  AND editorial_hook IS NULL;

-- Espresso House — Swedish chain, founded 1996
UPDATE pois SET
  editorial_hook = 'Svensk kaffekjede grunnlagt i 1996 — Skandinavias største kaffebar-kjede med over 500 lokasjoner.',
  local_insight = 'Bred meny med både kaffe og mat, lange åpningstider og gode arbeidsplasser. Flat white og kanelbulle er populære valg.'
WHERE name ILIKE '%Espresso House%' AND category_id = 'cafe'
  AND editorial_hook IS NULL;


-- ============================================
-- 5. IMPROVED INTRO TEXT — Norwegian
-- Fixes: tidsregel, avoid-list words (sjarmerende, noe for enhver smak,
-- skjulte perler, koselig, spennende)
-- ============================================

UPDATE category_slugs SET
  intro_text = 'Trondheim har en kafescene formet av studentbyen og kaffepionerene. Dromedar åpnet byens første moderne kaffebar 19. mars 1997 ved Gamle Bybro, grunnlagt av Preben Oosterhof og Andreas Hertzberg rett etter ski-VM. Tony Jacobsen startet Jacobsen & Svart i 6 kvm bak en frisørsalong i 2012 og var blant de første til å bringe lysbrent spesialkaffe til byen.

Bakklandet er kjernen i kafélivet — her ligger originale Dromedar, Antikvariatet med rundt 300 konserter i året, og trehuskaféer langs Nidelva. Men også Solsiden, Ila og Midtbyen har sterke kaféer: ISAK Bakeri serverer surdeigsbrød med urkorn fra Gullimunn, Onkel Svanhild gjenskaper bestemors stue i vintage-interiør, og Digs Kafé har Pala-kaffe i byens første coworking-space.

Kaffestandarden er høy. Erlend Wessel-Berg vant NM Barista 2025 på Sellanraa Bok & Bar i den gamle brannstasjonen. Bristol Conditori har bakt Georginekake etter originaloppskrift siden 1921. Gravraak Teateliers te — laget av Norges eneste Master Tea Blender — serveres på ISAK Bakeri.

Denne guiden kuraterer kaféene i Trondheim, fra rask espresso til langsom frokost med surdeigsbrød.',
  seo_description = 'Oppdag de beste kaféene i Trondheim. Fra Dromedar (1997) og Jacobsen & Svart til NM-vinnende baristaer på Sellanraa og surdeigsbrød fra ISAK Bakeri. Kuratert guide.'
WHERE category_id = 'cafe' AND locale = 'no';


-- ============================================
-- 6. IMPROVED INTRO TEXT — English
-- Same quality improvements as Norwegian.
-- More explanatory for international readers.
-- ============================================

UPDATE category_slugs SET
  intro_text = 'Trondheim''s café scene was shaped by the student city and its coffee pioneers. Dromedar opened the city''s first modern coffee bar on March 19, 1997 at the Old Town Bridge, founded by Preben Oosterhof and Andreas Hertzberg just after the World Ski Championships. Tony Jacobsen started Jacobsen & Svart in a 6-square-meter space behind a hair salon in 2012, among the first to bring Scandinavian light-roast coffee to the city.

Bakklandet is the heart of café culture — home to the original Dromedar, Antikvariatet with around 300 concerts a year, and wooden-house cafés along the Nidelva river. Beyond Bakklandet, neighborhoods like Solsiden, Ila, and Midtbyen have strong offerings: ISAK Bakeri serves sourdough bread with ancient grains from local producer Gullimunn, Onkel Svanhild recreates a grandmother''s living room in vintage furniture, and Digs Kafé serves Pala coffee in the city''s first coworking space.

The coffee standard is high. Erlend Wessel-Berg won the Norwegian Barista Championship 2025 at Sellanraa Bok & Bar in the old fire station. Bristol Conditori has baked their Georgine cake from an original recipe since 1921. Tea from Gravraak Teatelier — made by Norway''s only Master Tea Blender — is served at ISAK Bakeri.

This guide curates the cafés in Trondheim, from quick espresso to slow breakfast with sourdough bread.',
  seo_description = 'Discover the best cafés in Trondheim. From Dromedar (1997) and Jacobsen & Svart to Norwegian Barista Championship winners at Sellanraa and sourdough from ISAK Bakeri. Curated guide.'
WHERE category_id = 'cafe' AND locale = 'en';
