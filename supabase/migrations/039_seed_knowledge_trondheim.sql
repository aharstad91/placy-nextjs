-- Seed knowledge facts for top 20 Trondheim POIs
-- Mix of topics, confidence levels, and display_ready states
-- Idempotent: uses ON CONFLICT DO NOTHING (requires unique combo)

-- Note: No unique constraint exists yet, so we use a CTE to check for duplicates
-- by (poi_id, topic, fact_text) before inserting.

INSERT INTO place_knowledge (poi_id, topic, fact_text, fact_text_en, source_name, source_url, confidence, display_ready, sort_order)
VALUES
-- === Antikvariatet ===
('google-ChIJtTyDwJkxbUYRSfa9a56pD5o', 'history',
 'Antikvariatet holder til i en av Trondheims eldste trebygninger fra 1700-tallet, opprinnelig et bolighus i Bakklandet.',
 'Antikvariatet is housed in one of Trondheim''s oldest wooden buildings from the 1700s, originally a residential house in Bakklandet.',
 'Visit Trondheim', 'https://visittrondheim.no', 'verified', true, 1),

('google-ChIJtTyDwJkxbUYRSfa9a56pD5o', 'local_knowledge',
 'Kjent blant lokale som det beste stedet for en rolig øl i autentiske omgivelser. Interiøret er fylt med antikviteter og kuriositeter samlet over flere tiår.',
 'Known among locals as the best spot for a quiet beer in authentic surroundings. The interior is filled with antiques and curiosities collected over decades.',
 NULL, NULL, 'verified', true, 2),

('google-ChIJtTyDwJkxbUYRSfa9a56pD5o', 'practical',
 'Begrenset antall plasser — kom tidlig på fredager og lørdager. Ingen reservasjon mulig.',
 'Limited seating — arrive early on Fridays and Saturdays. No reservations accepted.',
 NULL, NULL, 'unverified', true, 3),

-- === Baklandet Skydsstation ===
('google-ChIJqb152pkxbUYRPnGsWN9VfPQ', 'history',
 'Baklandet Skydsstation var opprinnelig et skysstasjon fra 1800-tallet der reisende kunne bytte hester og overnatte. Bygningen er restaurert med respekt for den opprinnelige stilen.',
 'Baklandet Skydsstation was originally a coaching inn from the 1800s where travelers could change horses and stay overnight. The building has been restored with respect for the original style.',
 'Wikipedia', 'https://no.wikipedia.org/wiki/Bakklandet', 'verified', true, 1),

('google-ChIJqb152pkxbUYRPnGsWN9VfPQ', 'food',
 'Serverer hjemmelaget norsk mat med vekt på tradisjonsretter som raspeballer, komle og fårikål i sesong. Sveler med brunost er en lokal favoritt.',
 'Serves homemade Norwegian food focusing on traditional dishes like potato dumplings and lamb stew in season. Sveler with brown cheese is a local favorite.',
 NULL, NULL, 'verified', true, 2),

('google-ChIJqb152pkxbUYRPnGsWN9VfPQ', 'spatial',
 'Ligger midt i Bakklandet, Trondheims mest sjarmerende bydel med fargerike trehus langs Nidelva. Gamlebybro er rett ved.',
 'Located in the heart of Bakklandet, Trondheim''s most charming neighborhood with colorful wooden houses along the Nidelva river. The Old Town Bridge is right nearby.',
 NULL, NULL, 'verified', true, 3),

-- === Bula Neobistro ===
('google-ChIJH2iWMJsxbUYRE8sFPMTIAEU', 'food',
 'Bula blander nordisk og asiatisk kjøkken i det de kaller «neobistro» — uformelt, men med kokker fra Michelin-bakgrunn. Menyen endres ukentlig basert på sesong.',
 'Bula blends Nordic and Asian cuisine in what they call "neobistro" — informal, but with chefs from Michelin backgrounds. The menu changes weekly based on season.',
 NULL, NULL, 'verified', true, 1),

('google-ChIJH2iWMJsxbUYRE8sFPMTIAEU', 'local_knowledge',
 'Bestill delemenyen — den gir best innsikt i kjøkkenets bredde. Vinlisten er uvanlig god for prisklassen.',
 'Order the sharing menu — it gives the best insight into the kitchen''s range. The wine list is unusually good for the price range.',
 NULL, NULL, 'unverified', true, 2),

-- === Den Gode Nabo AS ===
('google-ChIJnSfpw5kxbUYRrD-oYXLVPTI', 'local_knowledge',
 'Navnet betyr «den gode naboen» — og det er nøyaktig hva stedet er for Bakklandet-beboere. En uformell pub der alle kjenner alle.',
 'The name means "the good neighbor" — and that''s exactly what the place is for Bakklandet residents. An informal pub where everyone knows everyone.',
 NULL, NULL, 'verified', true, 1),

('google-ChIJnSfpw5kxbUYRrD-oYXLVPTI', 'practical',
 'Har livemusikk flere kvelder i uken, spesielt jazz og folk. Sjekk Facebook-siden for program.',
 'Has live music several evenings a week, especially jazz and folk. Check the Facebook page for schedule.',
 NULL, NULL, 'unverified', false, 2),

-- === Good Omens ===
('google-ChIJYwZDEJwxbUYRWpQ0OTz0jnA', 'food',
 'Naturvinbar med fokus på småskala produsenter fra Europa. Matmenyen er tapas-inspirert med norske råvarer.',
 'Natural wine bar focusing on small-scale producers from Europe. The food menu is tapas-inspired with Norwegian ingredients.',
 NULL, NULL, 'verified', true, 1),

('google-ChIJYwZDEJwxbUYRWpQ0OTz0jnA', 'culture',
 'Del av den nye bølgen av naturvinbarer i Trondheim som har endret byens matkultur de siste årene. Startet av unge gründere med bakgrunn fra Oslos restaurantscene.',
 'Part of the new wave of natural wine bars in Trondheim that has changed the city''s food culture in recent years. Started by young entrepreneurs with backgrounds from Oslo''s restaurant scene.',
 NULL, NULL, 'unverified', true, 2),

-- === Bar Moskus ===
('google-ChIJ5_4fB5wxbUYRLMbvQCrjPJA', 'local_knowledge',
 'Trondheims mest populære cocktailbar, kjent for kreative drinker med nordiske ingredienser som bjørkesaft, tyttebær og urter.',
 'Trondheim''s most popular cocktail bar, known for creative drinks with Nordic ingredients like birch sap, lingonberries and herbs.',
 NULL, NULL, 'verified', true, 1),

('google-ChIJ5_4fB5wxbUYRLMbvQCrjPJA', 'practical',
 'Fullt nesten hver kveld — spesielt torsdag til lørdag. Har ikke reservasjon, men køen går relativt fort.',
 'Packed almost every evening — especially Thursday to Saturday. No reservations, but the line moves relatively quickly.',
 NULL, NULL, 'unverified', true, 2),

-- === Hevd Bakeri & Pizzeria ===
('google-ChIJT806p0kxbUYRAkZ9PyWmptQ', 'food',
 'Hevd bruker surdeigsmetoder for alt brød og pizza. Melet er steinmalt fra lokale møller, og deigen hviler i minimum 48 timer.',
 'Hevd uses sourdough methods for all bread and pizza. The flour is stone-ground from local mills, and the dough rests for a minimum of 48 hours.',
 NULL, NULL, 'verified', true, 1),

('google-ChIJT806p0kxbUYRAkZ9PyWmptQ', 'local_knowledge',
 'Pizzaen er blant Norges beste ifølge flere matanmeldere. Prøv «Bakklandet-pizzaen» med lokal ost og urter fra hagen.',
 'The pizza is among Norway''s best according to several food critics. Try the "Bakklandet pizza" with local cheese and herbs from the garden.',
 NULL, NULL, 'unverified', true, 2),

-- === Archbishop's Palace ===
('google-ChIJRei0vpAxbUYRC3DvDFLTy8Y', 'history',
 'Erkebispegården er Skandinavias eldste profane bygning, med deler som dateres tilbake til 1100-tallet. Det var erkebiskopens residens og maktsentrum i middelalderen.',
 'The Archbishop''s Palace is Scandinavia''s oldest secular building, with parts dating back to the 1100s. It was the archbishop''s residence and center of power in the Middle Ages.',
 'Wikipedia', 'https://no.wikipedia.org/wiki/Erkebispeg%C3%A5rden', 'verified', true, 1),

('google-ChIJRei0vpAxbUYRC3DvDFLTy8Y', 'architecture',
 'Komplekset omfatter bygninger fra fire epoker: middelalder (1100-tallet), renessanse, barokk og nyere tilbygg. Ruinene i kjelleren er blant Norges best bevarte middelalderruiner.',
 'The complex encompasses buildings from four eras: medieval (1100s), renaissance, baroque and newer additions. The ruins in the basement are among Norway''s best-preserved medieval ruins.',
 'Riksantikvaren', 'https://riksantikvaren.no', 'verified', true, 2),

('google-ChIJRei0vpAxbUYRC3DvDFLTy8Y', 'practical',
 'Huser Rustkammeret (våpenmuseum) og Erkebispegårdens museum. Kombinasjonsbillett med Nidarosdomen gir best verdi.',
 'Houses the Rustkammeret (weapons museum) and the Archbishop''s Palace Museum. A combination ticket with Nidaros Cathedral gives the best value.',
 NULL, NULL, 'verified', true, 3),

-- === Scandic Bakklandet ===
('google-ChIJnS3aKZkxbUYRGSaBC1FDbVk', 'spatial',
 'Perfekt plassert i gangavstand til Bakklandet, Solsiden og sentrum. Gamlebybro og Nidelva er bokstavelig talt utenfor døren.',
 'Perfectly located within walking distance of Bakklandet, Solsiden and the city center. The Old Town Bridge and Nidelva river are literally outside the door.',
 NULL, NULL, 'verified', true, 1),

-- === SELLANRAA Bok & Bar ===
('sellanraa-bok-bar', 'culture',
 'Oppkalt etter Knut Hamsuns roman «Markens Grøde» (Sellanraa er gården i boken). En kombinasjon av bokhandel, bar og kulturscene som er unik i Trondheim.',
 'Named after Knut Hamsun''s novel "Growth of the Soil" (Sellanraa is the farm in the book). A combination of bookstore, bar and cultural venue that is unique in Trondheim.',
 NULL, NULL, 'verified', true, 1),

('sellanraa-bok-bar', 'local_knowledge',
 'Har jevnlig forfatterkvelder, boklanseringer og debatter. Det uformelle miljøet tiltrekker seg både studenter og professorer fra NTNU.',
 'Regularly hosts author evenings, book launches and debates. The informal atmosphere attracts both students and professors from NTNU.',
 NULL, NULL, 'unverified', true, 2),

-- === Awake ===
('google-ChIJt48wUgAxbUYRQD9ZY-s23d0', 'food',
 'Spesialkaffe-bar som rister sine egne bønner. Én av svært få i Norge som scorer over 90 på SCA-skalaen for kaffebrygning.',
 'Specialty coffee bar that roasts their own beans. One of very few in Norway scoring above 90 on the SCA scale for coffee brewing.',
 NULL, NULL, 'unverified', true, 1),

('google-ChIJt48wUgAxbUYRQD9ZY-s23d0', 'local_knowledge',
 'Trondheim er en av Norges kaffebyer, og Awake er blant de som driver scenen videre. Spør baristene om smaksprofiler — de elsker å forklare.',
 'Trondheim is one of Norway''s coffee cities, and Awake is among those pushing the scene forward. Ask the baristas about flavor profiles — they love to explain.',
 NULL, NULL, 'unverified', false, 2),

-- === Britannia Hotel ===
('britannia-hotel', 'history',
 'Åpnet i 1870 som Trondheims første luksushotell. Stengt i 2016 for en massiv renovering på over 1 milliard kroner, gjenåpnet i 2019 som et av Norges mest eksklusive hoteller.',
 'Opened in 1870 as Trondheim''s first luxury hotel. Closed in 2016 for a massive renovation costing over 1 billion NOK, reopened in 2019 as one of Norway''s most exclusive hotels.',
 'Wikipedia', 'https://no.wikipedia.org/wiki/Britannia_Hotel', 'verified', true, 1),

('britannia-hotel', 'architecture',
 'Palmehaven, hotellets ikoniske vinterhage, har et glasstak fra 1918 og er inspirert av europeiske grand hotels. Det er fredet av Riksantikvaren.',
 'Palmehaven, the hotel''s iconic winter garden, has a glass roof from 1918 and is inspired by European grand hotels. It is listed by the Directorate for Cultural Heritage.',
 'Riksantikvaren', 'https://riksantikvaren.no', 'verified', true, 2),

('britannia-hotel', 'food',
 'Har fire restauranter og barer, inkludert Speilsalen som har én Michelin-stjerne. Jonathan Cooking Club tilbyr uformell fine dining.',
 'Has four restaurants and bars, including Speilsalen which has one Michelin star. Jonathan Cooking Club offers informal fine dining.',
 NULL, NULL, 'verified', true, 3),

-- === The Armoury ===
('google-ChIJjQkgjpAxbUYRGgqE9vF7QYU', 'food',
 'Gastropub i Britannia Hotels kjeller med fokus på craft øl og delemat. Menyen er inspirert av britisk pubkultur tilpasset nordiske råvarer.',
 'Gastropub in Britannia Hotel''s basement focusing on craft beer and sharing food. The menu is inspired by British pub culture adapted to Nordic ingredients.',
 NULL, NULL, 'verified', true, 1),

-- === Backstube Trondheim ===
('google-ChIJ-XqIan8xbUYR20tOfjDNhn4', 'food',
 'Tysk-inspirert bakeri og konditori drevet av tyske bakere. Alt bakes etter tradisjonelle tyske oppskrifter med surdeig og langsom heving.',
 'German-inspired bakery and patisserie run by German bakers. Everything is baked according to traditional German recipes with sourdough and slow fermentation.',
 NULL, NULL, 'verified', true, 1),

('google-ChIJ-XqIan8xbUYR20tOfjDNhn4', 'local_knowledge',
 'Har Trondheims kanskje beste brød — spesielt rugbrødet og pretzelene. Kom før 10 for best utvalg; de mest populære brødene er utsolgt innen lunsj.',
 'Has arguably Trondheim''s best bread — especially the rye bread and pretzels. Come before 10 for the best selection; the most popular breads sell out before lunch.',
 NULL, NULL, 'unverified', true, 2),

-- === Jewish Museum Trondheim ===
('google-ChIJge7KZ5AxbUYRpt9V6VoT6dU', 'history',
 'Norges eneste jødiske museum, innviet i 2005 i den restaurerte synagogen fra 1925. Forteller historien om den jødiske befolkningen i Trondheim og deportasjonene under andre verdenskrig.',
 'Norway''s only Jewish museum, inaugurated in 2005 in the restored synagogue from 1925. Tells the story of the Jewish population in Trondheim and the deportations during World War II.',
 'Wikipedia', 'https://no.wikipedia.org/wiki/J%C3%B8disk_museum_Trondheim', 'verified', true, 1),

('google-ChIJge7KZ5AxbUYRpt9V6VoT6dU', 'culture',
 'Trondheim hadde en av Norges mest etablerte jødiske menigheter. Av 130 jøder i byen ble 74 deportert til Auschwitz i 1942 — kun én overlevde.',
 'Trondheim had one of Norway''s most established Jewish congregations. Of 130 Jews in the city, 74 were deported to Auschwitz in 1942 — only one survived.',
 'HL-senteret', 'https://www.hlsenteret.no', 'verified', true, 2),

-- === Daglig deig ===
('google-ChIJG3ZhDgAxbUYRsYbeZCN_gKQ', 'food',
 'Håndverksbasert bakeri med fokus på surdeigsbrød og kanelboller. Bruker økologisk mel og langsomme hevingsprosesser.',
 'Artisan bakery focusing on sourdough bread and cinnamon buns. Uses organic flour and slow fermentation processes.',
 NULL, NULL, 'unverified', true, 1),

-- === Daglighallen Bar & Mikrobryggeri ===
('google-ChIJQ2sCtZYxbUYR7mf95Vr8XBc', 'local_knowledge',
 'Trondheims første mikrobryggeri med servering i egne lokaler. Brygger 20+ varianter som endres med sesongen. Omvisning i bryggeriet er mulig på lørdager.',
 'Trondheim''s first microbrewery with on-site serving. Brews 20+ varieties that change with the season. Brewery tours are available on Saturdays.',
 NULL, NULL, 'unverified', true, 1),

('google-ChIJQ2sCtZYxbUYR7mf95Vr8XBc', 'spatial',
 'Ligger i Nedre Elvehavn, det gamle industriområdet som er transformert til Trondheims mest moderne bydel med boliger, restauranter og kontorer.',
 'Located in Nedre Elvehavn, the old industrial area transformed into Trondheim''s most modern district with housing, restaurants and offices.',
 NULL, NULL, 'verified', true, 2),

-- === Kunsthall Trondheim ===
('google-ChIJw6111psxbUYR60CVMUkuYjI', 'culture',
 'En av Norges viktigste arenaer for samtidskunst. Viser 4-6 utstillinger årlig med fokus på internasjonale og norske samtidskunstnere.',
 'One of Norway''s most important venues for contemporary art. Shows 4-6 exhibitions annually focusing on international and Norwegian contemporary artists.',
 NULL, NULL, 'verified', true, 1),

('google-ChIJw6111psxbUYR60CVMUkuYjI', 'practical',
 'Gratis inngang. Åpent tirsdag til søndag 12-17 (torsdag til 20). Ligger sentralt ved Kongens gate.',
 'Free admission. Open Tuesday to Sunday 12-17 (Thursday until 20). Centrally located on Kongens gate.',
 NULL, NULL, 'verified', true, 2),

-- === Britannia Spa ===
('google-ChIJs9tBIpAxbUYRXzA3AqS2VX8', 'practical',
 'Hotellets spa er åpent også for ikke-gjester, men krever forhåndsbestilling. Bassenget og badstuen har utsikt over Trondheims tak.',
 'The hotel spa is also open to non-guests, but requires advance booking. The pool and sauna have views over Trondheim''s rooftops.',
 NULL, NULL, 'unverified', false, 1),

-- === Trondhjems Kunstforening ===
('google-ChIJ8_v-eJAxbUYR-1iTAZMEEuc', 'history',
 'Grunnlagt i 1845, en av Norges eldste kunstforeninger. Holder til i en ærverdige villa fra 1800-tallet som i seg selv er verdt et besøk.',
 'Founded in 1845, one of Norway''s oldest art societies. Located in a venerable 1800s villa that is worth a visit in itself.',
 NULL, NULL, 'verified', true, 1),

('google-ChIJ8_v-eJAxbUYR-1iTAZMEEuc', 'culture',
 'Har en permanent samling av norsk kunst fra 1800- og 1900-tallet, samt vekslende utstillinger med samtidskunst.',
 'Has a permanent collection of Norwegian art from the 1800s and 1900s, as well as changing exhibitions of contemporary art.',
 NULL, NULL, 'verified', true, 2),

-- === Area-level knowledge (Trondheim) ===
('google-ChIJtTyDwJkxbUYRSfa9a56pD5o', 'nature',
 'Bakklandet har et eget mikroklima — skjermet av åsen og oppvarmet av solrefleksjonen fra Nidelva. Våren kommer ofte en uke tidligere her enn på Lade.',
 'Bakklandet has its own microclimate — sheltered by the hill and warmed by the sun''s reflection from the Nidelva river. Spring often arrives a week earlier here than at Lade.',
 NULL, NULL, 'unverified', false, 1);

-- Also seed a few area-level facts
INSERT INTO place_knowledge (area_id, topic, fact_text, fact_text_en, source_name, source_url, confidence, display_ready, sort_order)
VALUES
('trondheim', 'history',
 'Trondheim ble grunnlagt i 997 av Olav Tryggvason og var Norges hovedstad i vikingtiden og middelalderen. Nidarosdomen ble et av Nord-Europas viktigste pilegrimsmål.',
 'Trondheim was founded in 997 by Olav Tryggvason and was Norway''s capital during the Viking Age and Middle Ages. Nidaros Cathedral became one of Northern Europe''s most important pilgrimage destinations.',
 'Wikipedia', 'https://no.wikipedia.org/wiki/Trondheim', 'verified', true, 1),

('trondheim', 'culture',
 'Trondheim er Norges teknologihovedstad med NTNU og SINTEF, men også en matby i sterk vekst. Byen har gått fra null til flere Michelin-anbefalinger på ti år.',
 'Trondheim is Norway''s technology capital with NTNU and SINTEF, but also a rapidly growing food city. The city has gone from zero to several Michelin recommendations in ten years.',
 NULL, NULL, 'verified', true, 2),

('trondheim', 'local_knowledge',
 'Bakklandet og Møllenberg er de mest karakteristiske bydelene — fargerike trehus, bratte gater, og en uformell nabolagsfølelse som er sjelden i norske byer.',
 'Bakklandet and Møllenberg are the most distinctive neighborhoods — colorful wooden houses, steep streets, and an informal neighborhood feel that is rare in Norwegian cities.',
 NULL, NULL, 'verified', true, 3),

('trondheim', 'practical',
 'Bysykkelen i Trondheim (Trondheim Bysykkel) er gratis den første timen. Byen er relativt flat og sykkelbar — perfekt for å utforske Bakklandet, Solsiden og sentrum.',
 'The city bike in Trondheim (Trondheim Bysykkel) is free for the first hour. The city is relatively flat and bikeable — perfect for exploring Bakklandet, Solsiden and the city center.',
 'Trondheim Bysykkel', 'https://trfrombikes.no', 'verified', true, 4);
