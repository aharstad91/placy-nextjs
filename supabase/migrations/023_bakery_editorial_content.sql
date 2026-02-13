-- ============================================
-- 023: Bakery editorial content
-- Add intro text, SEO descriptions, and improve
-- editorial hooks based on verified research.
-- ============================================


-- ============================================
-- 1. IMPROVED EDITORIAL HOOKS (research-verified)
-- Only overwrite where current hook is generic or inaccurate
-- ============================================

-- Nabolaget Bagelri (T1, 4.7★) — founded by Vernie (Canadian) and Odd Inge, opened Sep 2023
UPDATE pois SET
  editorial_hook = 'Håndlagde bagels blant trehusene på Bakklandet — Vernie fra Canada og Odd Inge fra Trondheim åpnet Nabolaget i 2023, og det ble en umiddelbar hit.',
  local_insight = 'Stengt mandager. Kom tidlig på lørdager — de mest populære baglene selger ut fort. Hiking Viking-bagelen er signaturen.'
WHERE name ILIKE '%Nabolaget Bagelri%' AND category_id = 'bakery';

-- Hevd Bakeri & Pizzeria Torget (T1, 4.4★) — Emanuele Spreafico, NM-vinner, Dolce mattino vant Årets bakst
UPDATE pois SET
  editorial_hook = 'Håndverksbakeri på dagen, vedfyrt pizza om kvelden — ledet av NM-vinner Emanuele Spreafico. Dolce mattino (kaffebrødet) vant Årets bakst.',
  local_insight = 'Kom tidlig for croissanter og surdeig — de beste varene går fort. Torget-lokalet er størst, med eget bakerutsalg i Munkegata.'
WHERE name ILIKE '%Hevd Bakeri%Pizzeria%' AND category_id = 'bakery';

-- Daglig Deig (T1, 4.5★) — Stefano Matarese, cøliaki, glutenfritt fokus, fra Flavors Lager 11
UPDATE pois SET
  editorial_hook = 'Italiensk pastificio og bakeri på Bakklandet — grunnlegger Stefano Matarese har selv cøliaki og lager alt glutenfritt uten å kompromisse på smak.',
  local_insight = 'Torsdagskvelden er legendarisk: uendelig pasta til fast pris. Fersk pasta og brød bakes på stedet med italiensk håndverk.'
WHERE name ILIKE '%Daglig%[Dd]eig%' AND category_id = 'bakery';

-- Pascal Konditori (T2, 4.0★) — Pascal Dupuy, Relais Dessert International, fransk tradisjon
UPDATE pois SET
  editorial_hook = 'Pascal Dupuy bringer ekte fransk konditorkunst til Trondheim — macarons, trøfler og croissanter fra en av verdens 80 beste konditorier (Relais Dessert International).',
  local_insight = 'Bestill kaker til helgen innen torsdag — det fulle utvalget er tilgjengelig for henting fredag til søndag. Vis-à-vis Nye Hjorten Teater.'
WHERE name ILIKE '%Pascal Konditori%' AND category_id = 'bakery';

-- Godt Brød (T2, 4.4★) — Norway's most famous organic bakery chain
UPDATE pois SET
  editorial_hook = 'Norges mest kjente økologiske bakeri — Dronningens gate-filialen er et romslig bakeverksted midt i sentrum, med alt bakt fra bunnen av med økologiske råvarer.',
  local_insight = 'Åpner allerede kl. 06:30 på hverdager — ideelt for tidlig frokost med økologisk kaffe og nybakt kanelbolle.'
WHERE name ILIKE '%Godt Brød%Dronningens%' AND category_id = 'bakery';

-- Byåsen Bakeri (T2, 4.2★) — Köhlers Conditori 1931, Nærbakst overtok 2009
UPDATE pois SET
  editorial_hook = 'Tradisjonsrikt bakeri med røtter tilbake til Köhlers Conditori i 1931 — Nærbakst overtok i 2009 og fører videre nesten hundre år med håndverksbaking.',
  local_insight = 'Georginekake, romkake og lukket valnøtt bakes fortsatt etter originaloppskriftene. Utsalg på Tiller, Heimdal, Stavset og Munkvoll.'
WHERE name ILIKE '%Byåsen Bakeri%' AND category_id = 'bakery';

-- Rosenborg Bakeri hovedkontor (T2, 4.4★) — since 1902, 4th gen Helgesen
UPDATE pois SET
  editorial_hook = 'Trondheims eget bakeri siden 1902 — fjerde generasjon Helgesen driver videre med over 600 produkter, alt uten tilsetningsstoffer.',
  local_insight = 'Rosenborg gate-lokalet er originalen der det hele startet. Gå hit for den mest autentiske opplevelsen — skoleboller og skolebrød smaker akkurat som de skal.'
WHERE name ILIKE '%Rosenborg Bakeri%' AND category_id = 'bakery'
  AND name NOT ILIKE '%Solsiden%'
  AND name NOT ILIKE '%avd%'
  AND name NOT ILIKE '%AS%';

-- Hevd Håndverksbakeri Søndre (T2, 4.1★)
UPDATE pois SET
  editorial_hook = 'Hevds avdeling i Bankkvartalet — surdeig og focaccia fra Emanuele Spreafico og teamet, i rolige omgivelser øverst i Søndre gate.',
  local_insight = 'Vis-à-vis Litteraturhuset — ta med en focaccia og sett deg i parken like ved. Mindre folksomt enn Torget-lokalet.'
WHERE name ILIKE '%Hevd%Søndre%' AND category_id = 'bakery';

-- Ciabatta og Dråpen (T3, 3.8★) — Hofstad sisters
UPDATE pois SET
  editorial_hook = 'Søstrene Hofstad driver Ciabatta i Kjøpmannsgata med mottoet «noe å tygge på, noe å drikke og ingenting å bli lurt av» — ærlig bakst og generøse smørbrød.',
  local_insight = 'Perfekt for en rask og ærlig lunsj mellom Olavshallen og Solsiden. Enkel, uten dikkedarer — akkurat slik det skal være.'
WHERE name ILIKE '%Ciabatta%' AND category_id = 'bakery';


-- ============================================
-- 2. RICH INTRO TEXT — Norwegian (multi-paragraph)
-- ============================================

UPDATE category_slugs SET
  intro_text = 'Trondheim har et overraskende rikt bakerilandskap, fra prisbelønte håndverksbakerier til tradisjonsrike familiedrevne konditorier. Byens bakerier spenner fra italiensk surdeig og franske macarons til norske klassikere som skoleboller og kanelsnurrer.

Det som gjør bakeri-scenen i Trondheim spesiell er mangfoldet. Hevd Bakeri har vunnet Årets bakst med sin Dolce mattino — et kaffebrød av norsk mesterbaker Emanuele Spreafico. Daglig Deig på Bakklandet serverer glutenfri italiensk bakst av en grunnlegger som selv har cøliaki. Og Rosenborg Bakeri har bakt for trondhjemmere siden 1902, nå i fjerde generasjon.

Fra nybakte bagels på Bakklandet til økologisk surdeig fra Godt Brød og tradisjonelle kaker fra Byåsen Bakeri (som startet som Köhlers Conditori i 1931) — Trondheim har et bakeri for enhver smak. Denne guiden hjelper deg å finne de beste, kuratert med ekte lokalkunnskap.',
  seo_description = 'Oppdag de beste bakeriene i Trondheim. Fra prisbelønte håndverksbakerier som Hevd og Nabolaget Bagelri til tradisjonsrike familiekonditorier — kuratert guide med lokalkunnskap.'
WHERE category_id = 'bakery' AND locale = 'no';


-- ============================================
-- 3. RICH INTRO TEXT — English (multi-paragraph)
-- ============================================

UPDATE category_slugs SET
  intro_text = 'Trondheim has a surprisingly rich bakery scene, from award-winning craft bakeries to tradition-steeped family-run patisseries. The city''s bakeries range from Italian sourdough and French macarons to Norwegian classics like skoleboller and kanelsnurrer (cinnamon rolls).

What makes Trondheim''s bakery scene special is its diversity. Hevd Bakeri won Norway''s "Baked Product of the Year" with their Dolce mattino — a coffee bread by champion baker Emanuele Spreafico. Daglig Deig on Bakklandet serves gluten-free Italian baked goods from a founder who himself has celiac disease. And Rosenborg Bakeri has been baking for locals since 1902, now in its fourth generation.

From hand-rolled bagels on Bakklandet to organic sourdough from Godt Brød and traditional cakes from Byåsen Bakeri (which started as Köhlers Conditori in 1931) — Trondheim has a bakery for every taste. This guide helps you find the best ones, curated with genuine local knowledge.',
  seo_description = 'Discover the best bakeries in Trondheim. From award-winning craft bakeries like Hevd and Nabolaget Bagelri to tradition-steeped family patisseries — curated guide with local knowledge.'
WHERE category_id = 'bakery' AND locale = 'en';
