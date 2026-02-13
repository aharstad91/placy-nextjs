-- ============================================
-- 021: Café editorial content
-- Add editorial hooks + local insights for key cafés,
-- and update intro_text with rich multi-paragraph content.
-- ============================================

-- ============================================
-- 1. EDITORIAL HOOKS + LOCAL INSIGHTS
-- ============================================

-- Backstube Bakeri (Tier 1, 4.7★)
UPDATE pois SET
  editorial_hook = 'Tysk håndverksbakeri med surdeigsbrød og kanelsnurrer som folk står i kø for hver morgen.',
  local_insight = 'Kom tidlig på lørdager — de mest populære brødene er utsolgt innen kl. 11. Kanelsnurrene er byens beste ifølge mange trondhjemmere.'
WHERE name ILIKE '%Backstube%Bakeri%' AND category_id = 'cafe';

-- Dromedar Kaffebar Bakklandet (Tier 2, 4.6★)
UPDATE pois SET
  editorial_hook = 'Trondheims første spesialkaffebar, med utsikt over Nidelva fra ikoniske Bakklandet.',
  local_insight = 'Dromedar var pioneren som startet spesialkaffe-bølgen i Trondheim tidlig på 2000-tallet. Uteserveringen langs elva er magisk på varme dager.'
WHERE name ILIKE '%Dromedar%Bakklandet%' AND category_id = 'cafe';

-- Blomster & Kaffe (Tier 2, 4.6★)
UPDATE pois SET
  editorial_hook = 'En sjarmerende kombinasjon av blomsterbutikk og kafé, med hjemmelagde kaker i en duftende oase.',
  local_insight = 'Perfekt stopp for en rolig formiddagskaffe. Interiøret er like fotogent som kakene — en favoritt på Instagram blant lokale.'
WHERE name ILIKE '%Blomster%Kaffe%' AND category_id = 'cafe';

-- Slabberas Teknobyen (Tier 2, 4.6★)
UPDATE pois SET
  editorial_hook = 'Studentfavoritt på Teknobyen med rimelige lunsjretter og god kaffe i avslappet miljø.',
  local_insight = 'Drives av studenter, for studenter — men maten holder høy kvalitet. Prøv dagens suppe, som alltid er hjemmelaget og raus.'
WHERE name ILIKE '%Slabberas%Teknobyen%' AND category_id = 'cafe';

-- Edgar Kafé (Tier 2, 4.8★)
UPDATE pois SET
  editorial_hook = 'Intim nabolagskafé med fokus på kvalitetskaffe og hjemmelaget bakst i hyggelige omgivelser.',
  local_insight = 'Et av byens best bevarte hemmeligheter. Edgar har lojale stamgjester som sverger til den hjemmelagde bananbrødet.'
WHERE name ILIKE '%Edgar%Kaf%' AND category_id = 'cafe';

-- Kafé Perrongen (Tier 2, 4.8★)
UPDATE pois SET
  editorial_hook = 'Kafé i gamle jernbanebygninger med særpreg og sjel — perfekt for et avbrekk nær sentrum.',
  local_insight = 'Beliggenheten ved Marienborg gir en unik atmosfære. Populær blant kreative sjeler og fjernarbeidere som søker ro utenfor bykjernen.'
WHERE name ILIKE '%Perrongen%' AND category_id = 'cafe';

-- Frøken Berg Kafé (Tier 2, 4.5★)
UPDATE pois SET
  editorial_hook = 'Koselig kafé i Ila med retro-sjarm, hjemmelagde kaker og et bredt utvalg te.',
  local_insight = 'Frøken Berg er en institusjon i Ila-bydelen. Her møtes bestemødre og studenter over samme kakefat — det sier alt om kvaliteten.'
WHERE name ILIKE '%Frøken Berg%' AND category_id = 'cafe';

-- Habitat Bakklandet (Tier 2, 4.4★)
UPDATE pois SET
  editorial_hook = 'Moderne kafékonsept i hjertet av Bakklandet med plantebaserte alternativer og god filterkaffe.',
  local_insight = 'Et grønt tilskudd til Bakklandet. Habitat tiltrekker seg en bevisst gjenganger-gjeng som verdsetter bærekraft like mye som smak.'
WHERE name ILIKE '%Habitat%Bakklandet%' AND category_id = 'cafe';

-- Kafe Skansen (Tier 2, 4.3★)
UPDATE pois SET
  editorial_hook = 'Historisk kafé ved Kristiansten festning med byens beste panoramautsikt.',
  local_insight = 'Ta turen opp til festningen og belønne deg med kaffe og vafler med utsikt over hele Trondheim. Spesielt magisk ved solnedgang.'
WHERE name ILIKE '%Skansen%' AND category_id = 'cafe';

-- Dromedar Kaffebar Øya (Tier 2, 4.3★)
UPDATE pois SET
  editorial_hook = 'Dromedars filial på Øya — nær NTNU og Studentersamfundet, populær blant studenter og akademikere.',
  local_insight = 'Samme kvalitetskaffe som Bakklandet-filialen, men med en mer studentpreget stemning. Perfekt mellom forelesninger.'
WHERE name ILIKE '%Dromedar%Øya%' AND category_id = 'cafe';

-- The Communitea (Tier 2, 4.3★)
UPDATE pois SET
  editorial_hook = 'Trondheims teparadis med over 100 sorter te fra hele verden, pluss veganske bakevarer.',
  local_insight = 'Et unikt konsept i byen. Eierne importerer te direkte og kan fortelle historien bak hver blanding. Perfekt for te-elskere.'
WHERE name ILIKE '%Communitea%' AND category_id = 'cafe';

-- Café ni muser (Tier 2, 4.2★)
UPDATE pois SET
  editorial_hook = 'Kulturkafé i kunstnermiljøet på Svartlamon med bohemsk atmosfære og rimelige priser.',
  local_insight = 'Svartlamon er Trondheims alternative bydel, og Ni Muser er dens uoffisielle storstue. Forvent vinyl på platespilleren og hjemmelaget mat.'
WHERE name ILIKE '%ni muser%' AND category_id = 'cafe';

-- Rosenborg Bakeri / Lillebakern (Tier 2, 4.1★)
UPDATE pois SET
  editorial_hook = 'Tradisjonelt nabolagsbakeri med nostalgisk sjarm og ærlige bakevarer uten dikkedarer.',
  local_insight = 'Et av de få gjenværende klassiske bakeriene i byen. Skoleboller og skolebrød her smaker akkurat som de gjorde for 30 år siden.'
WHERE name ILIKE '%Rosenborg Bakeri%' AND category_id = 'cafe';

-- Also try Lillebakern variant
UPDATE pois SET
  editorial_hook = 'Tradisjonelt nabolagsbakeri med nostalgisk sjarm og ærlige bakevarer uten dikkedarer.',
  local_insight = 'Et av de få gjenværende klassiske bakeriene i byen. Skoleboller og skolebrød her smaker akkurat som de gjorde for 30 år siden.'
WHERE name ILIKE '%Lillebakern%' AND category_id = 'cafe'
  AND editorial_hook IS NULL;

-- Lyche Bar & Kafé (Tier 2, 4.1★)
UPDATE pois SET
  editorial_hook = 'Legendarisk studentkafé i Studentersamfundets kjeller — Trondheims sosiale smeltedigel siden 1929.',
  local_insight = 'Lyche er mer enn en kafé — det er et kulturelt landemerke. Her har generasjoner av studenter diskutert, debattert og feiret.'
WHERE name ILIKE '%Lyche%' AND category_id = 'cafe';

-- Château de Sorgenfri (Tier 2, 5.0★)
UPDATE pois SET
  editorial_hook = 'Eksklusiv kafé-opplevelse i villastrøket på Sorgenfri, med franske inspirasjoner og utsøkte desserter.',
  local_insight = 'Navnet betyr «slottet uten bekymringer» — og det stemmer. En skjult perle som få turister finner, men som lokale elsker for spesielle anledninger.'
WHERE name ILIKE '%Château de Sorgenfri%' AND category_id = 'cafe';

-- Also try without accent
UPDATE pois SET
  editorial_hook = 'Eksklusiv kafé-opplevelse i villastrøket på Sorgenfri, med franske inspirasjoner og utsøkte desserter.',
  local_insight = 'Navnet betyr «slottet uten bekymringer» — og det stemmer. En skjult perle som få turister finner, men som lokale elsker for spesielle anledninger.'
WHERE name ILIKE '%Chateau de Sorgenfri%' AND category_id = 'cafe'
  AND editorial_hook IS NULL;

-- Slabberas Gløshaugen (Tier 2, 5.0★)
UPDATE pois SET
  editorial_hook = 'NTNUs egen kafé på Gløshaugen — rimelig, hjemmelaget mat i universitetets hjerte.',
  local_insight = 'Drevet av engasjerte studenter med fokus på bærekraft. Menyene skifter etter sesong, og alt er laget fra bunnen av.'
WHERE name ILIKE '%Slabberas%Gløshaugen%' AND category_id = 'cafe';

-- Also try without ø
UPDATE pois SET
  editorial_hook = 'NTNUs egen kafé på Gløshaugen — rimelig, hjemmelaget mat i universitetets hjerte.',
  local_insight = 'Drevet av engasjerte studenter med fokus på bærekraft. Menyene skifter etter sesong, og alt er laget fra bunnen av.'
WHERE name ILIKE '%Slabberas%Gl_shaugen%' AND category_id = 'cafe'
  AND editorial_hook IS NULL;


-- ============================================
-- 2. RICH INTRO TEXT — Norwegian (multi-paragraph)
-- ============================================

UPDATE category_slugs SET
  intro_text = 'Trondheim har en av Norges mest spennende kaféscener. Fra prisvinnende kaffebrennere som Jacobsen & Svart og Dromedar til sjarmerende kaféer i trehusene langs Bakklandet — her er det noe for enhver smak. Studentbyen gir en unik energi til kafélivet, med alt fra stille lesekroker til livlige brunchsteder.

Bakklandet er selve episenteret for kafékultur i Trondheim. De fargerike trehusene langs Nidelva huser noen av byens mest ikoniske kafeer, der du kan nyte en kopp kaffe med utsikt over den gamle bybro. Men også bydeler som Ila, Møllenberg og Solsiden byr på skjulte perler som er verdt å oppdage.

Kvaliteten på kaffen i Trondheim er i toppklasse. Jacobsen & Svart har vunnet nordiske barista-mesterskap, og Dromedar var en av de første spesialkaffebarene i Norge. Flere av byens kaféer brenner egne bønner og tar håndverket på alvor — noe du smaker i koppen.

Enten du er ute etter en rask espresso, en lang formiddagskaffe med hjemmelaget bakst, eller en koselig kveldsstund med te og kake — denne guiden hjelper deg å finne de beste kaféene i Trondheim, kuratert med ekte lokalkunnskap.',
  seo_description = 'Oppdag de beste kaféene i Trondheim. Kuratert guide med lokalkunnskap — fra prisvinnende kaffebrennere til sjarmerende nabolagskaféer i Bakklandet, Ila og Solsiden.'
WHERE category_id = 'cafe' AND locale = 'no';


-- ============================================
-- 3. RICH INTRO TEXT — English (multi-paragraph)
-- ============================================

UPDATE category_slugs SET
  intro_text = 'Trondheim has one of Norway''s most exciting café scenes. From award-winning coffee roasters like Jacobsen & Svart and Dromedar to charming cafés in the colorful wooden houses along Bakklandet — there''s something for every taste. The student city brings unique energy to café culture, with everything from quiet reading nooks to lively brunch spots.

Bakklandet is the epicenter of café culture in Trondheim. The colorful wooden houses along the Nidelva river house some of the city''s most iconic cafés, where you can enjoy a cup of coffee overlooking the Old Town Bridge. But neighborhoods like Ila, Møllenberg, and Solsiden also offer hidden gems worth discovering.

The quality of coffee in Trondheim is world-class. Jacobsen & Svart has won Nordic barista championships, and Dromedar was one of the first specialty coffee bars in Norway. Several of the city''s cafés roast their own beans and take the craft seriously — something you can taste in every cup.

Whether you''re looking for a quick espresso, a leisurely morning coffee with homemade pastries, or a cozy evening with tea and cake — this guide helps you find the best cafés in Trondheim, curated with genuine local knowledge.',
  seo_description = 'Discover the best cafés in Trondheim. Curated guide with local knowledge — from award-winning coffee roasters to charming neighborhood cafés in Bakklandet, Ila, and Solsiden.'
WHERE category_id = 'cafe' AND locale = 'en';
