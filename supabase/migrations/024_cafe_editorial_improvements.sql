-- ============================================
-- 024: Café editorial improvements
-- Research-verified editorial hooks, misclassification
-- fixes, and improved intro text for café category.
-- ============================================


-- ============================================
-- 1. MISCLASSIFIED — suppress non-cafés
-- ============================================

-- Hell Catering — a catering company in Stjørdal, not a café
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Hell Catering%' AND category_id = 'cafe';

-- Restaurant Kommandanten — a restaurant at Kristiansten Festning, not a café
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Kommandanten%' AND category_id = 'cafe';

-- Kojachi — Asian streetfood restaurant in Powerhouse, not a café
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Kojachi%' AND category_id = 'cafe';

-- Café Løkka — retro-diner with burgers and large beer selection, not a café
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Løkka%' AND category_id = 'cafe';

-- TEKS Kunstsenter — trust_score 0.75 but should be suppressed (art center)
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%TEKS%Kunstsenter%' AND category_id = 'cafe'
  AND trust_score IS DISTINCT FROM 0.1;

-- Online linjeforening — trust_score 0.45 but should be fully suppressed
UPDATE pois SET trust_score = 0.1, poi_tier = 3
WHERE name ILIKE '%Online%linjeforening%' AND category_id = 'cafe'
  AND trust_score IS DISTINCT FROM 0.1;


-- ============================================
-- 2. IMPROVED EDITORIAL HOOKS (research-verified)
-- Only overwrite where current hook is generic or inaccurate
-- ============================================

-- Jacobsen & Svart (T1, 4.7★, 678 reviews) — founded 2012 by Tony Jacobsen
-- in 6 sqm behind a hair salon. Went through bankruptcy 2020, came back with
-- Hans Erik Kleive. Current hook is good but local_insight can be richer.
UPDATE pois SET
  editorial_hook = 'Pioneren bak third-wave kaffe i Trondheim — Tony Jacobsen startet i 6 kvm bak en frisørsalong i 2012, gikk konkurs under pandemien, og kom tilbake sterkere med ny partner i 2020.',
  local_insight = 'Holder til i Arkitektenes hus på Brattøra. Be om filterbrygg med dagens enkeltopprinnelse — Jacobsen & Svart var blant de første til å bringe skandinavisk lysbrente bønner til Trondheim.'
WHERE name ILIKE '%Jacobsen%Svart%'
  AND category_id = 'cafe'
  AND poi_tier = 1;

-- SELLANRAA Bok & Bar (T1, 4.6★, 892 reviews) — opened 2016 in the old fire
-- station / literature house. Named after Hamsun character. Barista Erlend
-- Wessel-Berg won 2019 Brewers Cup and 2025 NM Barista.
UPDATE pois SET
  editorial_hook = 'Litteraturhus-kafé i den gamle brannstasjonen, oppkalt etter Hamsuns Isak Sellanraa — åpnet i 2016 med NM-vinnende baristaer og et kjøkken som bruker lokale råvarer fra Trøndelag.',
  local_insight = 'Barista Erlend Wessel-Berg vant NM i Brewers Cup 2019 og NM Barista 2025. Dør-i-dør med Trondheim bibliotek — perfekt kombinasjon av bøker og byens beste kaffe.'
WHERE name ILIKE '%SELLANRAA%Bok%' AND category_id = 'cafe'
  AND poi_tier = 1;

-- Backstube Bakeri (T1, 4.7★, 430 reviews) — NOT a German artisan bakery.
-- Founded 2016 in Oslo by Felix Heinrich & Matthias Bresser, now 30+ locations
-- across Norway, owned by Jordanes AS since 2023. Correct the misleading hook.
UPDATE pois SET
  editorial_hook = 'Norsk bakeriskjede med europeisk inspirasjon — Backstube åpnet sin første filial i Oslo i 2016 og har nå over 30 utsalg over hele landet, med rimelige priser og effektiv service.',
  local_insight = 'Trondheim-filialen er populær for rask frokost på farten. Kanelsnurrer og croissanter er bestselgere — men forvent kjedeformat, ikke håndverksbakeri.'
WHERE name ILIKE '%Backstube%' AND category_id = 'cafe';

-- Dromedar Bakklandet (T2, 4.6★, 340 reviews) — the ORIGINAL Dromedar,
-- opened 19 March 1997 by Preben Oosterhof and Andreas Hertzberg.
-- Current hook is decent but lacks the specific founding story.
UPDATE pois SET
  editorial_hook = 'Den aller første Dromedar-kaffebaren — åpnet 19. mars 1997 av Preben Oosterhof og Andreas Hertzberg ved Gamle Bybro, rett etter ski-VM i Trondheim.',
  local_insight = 'Grunnleggerne malte vegger, bygde bardisk selv og lånte stoler fra bestemor. Uteserveringen langs Nidelva er fortsatt byens mest ikoniske kaffested.'
WHERE name ILIKE '%Dromedar%Bakklandet%' AND category_id = 'cafe';

-- Dromedar Nordre (T2, 4.3★, 687 reviews) — opened 2001, NOT the first
-- Dromedar. The current hook incorrectly claims this is "Trondheims første kaffebar".
UPDATE pois SET
  editorial_hook = 'Dromedars Nordre gate-filial åpnet i 2001 og omsetter mest per kvadratmeter av alle avdelingene — en institusjon midt i Midtbyen.',
  local_insight = 'Ferskbakte kaker fra Dromedarbageriet (eget bakeri siden 2011) er like stor grunn til å komme som kaffen. Prøv Søt chili — Dromedars signaturdrikk.'
WHERE name ILIKE '%Dromedar%Nordre%' AND category_id = 'cafe';

-- Dromedar Moxness (T2, 4.2★, 601 reviews) — the "28 år" claim doesn't age well.
-- This is the Moxness gate location, not the original.
UPDATE pois SET
  editorial_hook = 'Dromedars filial i Moxnesgate — en av kjedens mest besøkte avdelinger, med Dromedars fulle meny og eget bakeri-sortiment.',
  local_insight = 'Prøv «Søt chili» — Dromedars signaturdrikk som serveres både varm og kald. Hjemmelagde kaker fra Dromedarbageriet er en fast favoritt.'
WHERE name ILIKE '%Dromedar%Moxness%' AND category_id = 'cafe';

-- Habitat Bakklandet (T2, 4.4★, 190 reviews) — NOT a plant-based café.
-- It's a craft beer bar with 24 taps, home of Monkey Brew (rated Norway's
-- best brewery), serving pizza. Correct the entirely wrong hook.
UPDATE pois SET
  editorial_hook = 'Craft beer-bar med 24 tappekraner og eget mikrobryggeri i kjelleren — Monkey Brew er kåret til Norges beste bryggeri, og pizzaen er håndlaget på stedet.',
  local_insight = 'Prøv «Living on the Veg»-pizzaen hvis du er vegetarianer. Bryggeriomvisninger kan bestilles — og du sitter bokstavelig talt oppå der ølet brygges.'
WHERE name ILIKE '%Habitat%Bakklandet%' AND category_id = 'cafe';

-- Onkel Svanhild (T2, 4.7★, 403 reviews) — opened April 2020 by Trond
-- Vardehaug Thuen. Named after his grandmother. Current hook mentions
-- TripAdvisor ranking which is generic and unverifiable.
UPDATE pois SET
  editorial_hook = 'Oppkalt etter grunnleggerens bestemor — Trond Vardehaug Thuen åpnet Onkel Svanhild i april 2020 med kaker, vafler og hjemmekoselig atmosfære i vintage-interiør.',
  local_insight = 'Møblene er samlet fra bruktbutikker for å gjenskape stemningen fra bestemors stue. Kom tidlig for ferskt bakverk — de mest populære produktene er utsolgt innen lunsj.'
WHERE name ILIKE '%Onkel Svanhild%' AND category_id = 'cafe';

-- Transit (T2, 4.3★, 143 reviews) — Trondheim's largest private second-hand
-- shop with barista coffee from Solberg & Hansen. Current hook is good.
-- Just fix the local_insight to mention the coffee supplier.
UPDATE pois SET
  local_insight = 'Kaffen er fra Solberg & Hansen, en av Norges mest anerkjente kaffebrennerier. Det meste av kafémøblene er til salgs — du kan bokstavelig talt kjøpe stolen du sitter på.'
WHERE name ILIKE '%Transit%' AND category_id = 'cafe'
  AND poi_tier = 2;

-- Bristol Conditori (T3, 3.8★, 356 reviews) — founded 1921 as Alliance
-- Konditori, renamed Bristol 1929. Georgine cake from Copenhagen recipe.
-- Currently has NO editorial hook. Add one.
UPDATE pois SET
  editorial_hook = 'Tradisjonskonditori siden 1921 — startet som Alliance Konditori, omdøpt til Bristol i 1929. Georginekaken bakes etter en oppskrift fra København, via en kokk fra tsartidens Russland.',
  local_insight = 'Georginekake og Napoleonskake er bestselgerne, bakt etter originaloppskrifter i over hundre år. Uteserveringen i Dronningens gate er populær om sommeren.',
  poi_tier = 2
WHERE name ILIKE '%Bristol Conditori%' AND category_id = 'cafe';

-- Awake (T1, 4.9★, 209 reviews) — opened June 2024 by Norkirken Trondheim
-- Salem. Current hook is good. Refine local_insight with verified details.
UPDATE pois SET
  local_insight = 'Drevet av Norkirken og 22B Kontaktsenter med 70 språkpraksisplasser via Flyktningenheten i kommunen. Naturmaterialer i interiøret og gjennomtenkt meny.'
WHERE name ILIKE '%Awake%' AND category_id = 'cafe'
  AND poi_tier = 1;


-- ============================================
-- 3. IMPROVED INTRO TEXT — Norwegian (multi-paragraph)
-- Fix: Jacobsen & Svart has NOT won Nordic barista championships;
-- it was Sellanraa's barista Erlend Wessel-Berg who won NM.
-- Also enrich with more verified facts.
-- ============================================

UPDATE category_slugs SET
  intro_text = 'Trondheim har en av Norges mest spennende kaféscener. Fra prisvinnende kaffebrennere som Jacobsen & Svart til sjarmerende kaféer i trehusene langs Bakklandet — her er det noe for enhver smak. Studentbyen gir en unik energi til kafélivet, med alt fra stille lesekroker til livlige brunchsteder.

Bakklandet er selve episenteret for kafékultur i Trondheim. Det var her Dromedar åpnet Trondheims første moderne kaffebar 19. mars 1997 — grunnlagt av Preben Oosterhof og Andreas Hertzberg ved Gamle Bybro. De fargerike trehusene langs Nidelva huser fortsatt noen av byens mest ikoniske kaféer, og bydeler som Ila, Møllenberg og Solsiden byr på skjulte perler.

Kvaliteten på kaffen i Trondheim er i toppklasse. Sellanraa Bok & Bar i den gamle brannstasjonen har NM-vinnende baristaer, og Jacobsen & Svart var blant de første til å bringe third-wave kaffe til Trondheim fra sitt lille 6-kvadratmeter brenneri i 2012. Flere av byens kaféer brenner egne bønner og tar håndverket på alvor.

Enten du er ute etter en rask espresso, en lang formiddagskaffe med hjemmelaget bakst, eller en koselig kveldsstund med te og kake — denne guiden hjelper deg å finne de beste kaféene i Trondheim, kuratert med ekte lokalkunnskap.',
  seo_description = 'Oppdag de beste kaféene i Trondheim. Fra Dromedar (1997) og Jacobsen & Svart til NM-vinnende baristaer på Sellanraa — kuratert guide med lokalkunnskap.'
WHERE category_id = 'cafe' AND locale = 'no';


-- ============================================
-- 4. IMPROVED INTRO TEXT — English (multi-paragraph)
-- Same corrections as Norwegian version.
-- ============================================

UPDATE category_slugs SET
  intro_text = 'Trondheim has one of Norway''s most exciting café scenes. From pioneering coffee roasters like Jacobsen & Svart to charming cafés in the colorful wooden houses along Bakklandet — there''s something for every taste. The student city brings unique energy to café culture, with everything from quiet reading nooks to lively brunch spots.

Bakklandet is the epicenter of café culture in Trondheim. This is where Dromedar opened Trondheim''s first modern coffee bar on March 19, 1997 — founded by Preben Oosterhof and Andreas Hertzberg by the Old Town Bridge. The colorful wooden houses along the Nidelva river still house some of the city''s most iconic cafés, and neighborhoods like Ila, Møllenberg, and Solsiden offer hidden gems worth discovering.

The quality of coffee in Trondheim is world-class. Sellanraa Bok & Bar in the old fire station boasts Norwegian Barista Championship winners, and Jacobsen & Svart was among the first to bring third-wave coffee to Trondheim from their tiny 6-square-meter roastery in 2012. Several of the city''s cafés roast their own beans and take the craft seriously.

Whether you''re looking for a quick espresso, a leisurely morning coffee with homemade pastries, or a cozy evening with tea and cake — this guide helps you find the best cafés in Trondheim, curated with genuine local knowledge.',
  seo_description = 'Discover the best cafés in Trondheim. From Dromedar (1997) and Jacobsen & Svart to Norwegian Barista Championship winners at Sellanraa — curated guide with local knowledge.'
WHERE category_id = 'cafe' AND locale = 'en';
