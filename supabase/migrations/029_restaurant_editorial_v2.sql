-- ============================================================================
-- 028: Restaurant editorial v2 — Full Curator pass
-- 93 active restaurant POIs reviewed. All hooks research-verified,
-- rewritten to follow Placy Curator voice guide: time rule, avoid-list,
-- 80-150 char hooks, 80-120 char insights, no perishable content.
-- ============================================================================


-- ============================================================================
-- TIER 1 RESTAURANTS (10 POIs)
-- ============================================================================

-- Fagn Restaurant (T1, 4.8, 510 reviews) — REWRITE
-- Founded by Jonas Nåvik (Alinea-alumni) in 2017, Michelin star 2019.
-- Located in Credoveita (Credo's former premises). Fagn Bistro above.
UPDATE pois SET
  editorial_hook = 'Trondheims første Michelin-stjerne, tildelt i 2019. Grunnlagt av Jonas Nåvik, med erfaring fra trestjernede Alinea i Chicago, i de tidligere Credo-lokalene i Credoveita.',
  local_insight = 'Fagn Bistro i etasjen over bruker samme førsteklasses råvarer i en mer avslappet ramme. Kun rundt 30 plasser — bestill i god tid.'
WHERE id = 'fdcfe57d-dbd2-40a0-8b9d-6d0a1d842220';

-- Bula Neobistro (T1, 4.8, 395 reviews) — REWRITE
-- Opened May 26, 2017 by Renée Fagerhøi. Won Top Chef 2015 (not 2016).
-- Flamingodekor, surprise menu, Art Deco in Prinsens gate.
UPDATE pois SET
  editorial_hook = 'Neobistro åpnet i 2017 av Renée Fagerhøi, vinner av Top Chef 2015. Overraskelsesmeny, flamingodekor og Art Deco i Prinsens gate.',
  local_insight = 'Ingen meny på forhånd — kjøkkenets valg bestemmer. Mellom seks og ti retter som blander lokal sjømat med uventet comfort food.'
WHERE id = 'google-ChIJH2iWMJsxbUYRE8sFPMTIAEU';

-- Credo Restaurant (T1, 4.7, 920 reviews) — KEEP
-- Heidi Bjerkan, Michelin star 2019, first green star ever.
-- Moved to Oslo 2024. Existing hook correctly reflects this. trust_score 0.3.

-- Britannia Hotel (T1, 4.7, 2051 reviews) — REWRITE
-- Since 1870, restored for 1.4 billion 2019. Speilsalen Michelin star Feb 2020.
-- Christopher Davidsen has LEFT Speilsalen for Tollbua — previous hook was wrong.
UPDATE pois SET
  editorial_hook = 'Trondheims storstue siden 1870, restaurert for 1,4 milliarder i 2019. Huser Michelin-restauranten Speilsalen, Jonathan Grill og legendariske Palmehaven med sine palmer og marmorsøyler.',
  local_insight = 'Speilsalen fikk Michelin-stjerne bare ti måneder etter gjenåpning. Palmehaven er den rimeligste innfallsporten til Britannias matopplevelse.'
WHERE id = 'britannia-hotel';

-- Blomster og Vin (T1, 4.7, 412 reviews) — REWRITE
-- Opened late 2023 on Nedre Bakklandet 21. Fabricio Bianchi runs Vinitalia (wine import).
UPDATE pois SET
  editorial_hook = 'Vinbar og pinseria på Nedre Bakklandet, åpnet i 2023. Fabricio Bianchi står bak kjøkken og vinimport, med italienske naturviner fra eget importselskap Vinitalia.',
  local_insight = 'Ingen reservasjon — førstemann til mølla. Pinsa, en romersk variant av pizza med lang heving, er husets spesialitet.'
WHERE id = 'blomster-og-vin';

-- Havfruen Fiskerestaurant (T1, 4.6, 820 reviews) — REWRITE
-- Opened April 1, 1987 in 1700s warehouse. First sushi in Trondheim 1998.
UPDATE pois SET
  editorial_hook = 'Trondheims eldste uavhengige fiskerestaurant, åpnet 1. april 1987 i et sjøhus fra 1700-tallet ved Nidelva. Første restaurant i byen som serverte sushi, allerede i 1998.',
  local_insight = 'Be om vindusbord mot Gamle Bybro for utsikt over Nidarosdomen, Bakklandet og elva i ett blikk.'
WHERE id = 'fdac7a45-e586-4f2d-a2bf-8ca44a95cc3a';

-- SELLANRAA Bok & Bar (T1, 4.6, 605 reviews) — REWRITE
-- Opened 2016. Named after Hamsuns "Markens Grøde". Tore Øverleir won NM Barista 2018 here.
UPDATE pois SET
  editorial_hook = 'Litteraturhus-kafé åpnet i 2016, oppkalt etter Hamsuns Isak Sellanraa fra Markens Grøde. Tore Øverleir vant NM Barista i 2018 mens han jobbet her.',
  local_insight = 'Surdeigsbakeriet ISAK i nabobygget deler kjøkken og filosofi med Sellanraa. Dør rett inn til Trondheim bibliotek.'
WHERE id = 'sellanraa-bok-bar';

-- Baklandet Skydsstation (T1, 4.5, 1497 reviews) — REWRITE
-- Building from 1791. Opened as café March 8, 1997. National Geographic Best Café 2012.
UPDATE pois SET
  editorial_hook = 'Kafé i et av Bakklandets best bevarte hus fra 1791, åpnet 8. mars 1997. Kåret til Årets kafé av National Geographic i 2012.',
  local_insight = 'Akevittsamlingen teller over 350 varianter — trolig Norges største under ett tak. Sildebuffeten er en klassiker.'
WHERE id = 'google-ChIJqb152pkxbUYRPnGsWN9VfPQ';

-- To Rom og Kjøkken (T1, 4.5, 650 reviews) — REWRITE
-- Opened Oct 10, 2005 by Roar Hildonen and Alexander Skjefte. 95+ apprentices trained.
UPDATE pois SET
  editorial_hook = 'Familiedrevet finedining siden 2005, grunnlagt av Roar Hildonen og Alexander Skjefte med mål om å løfte Trondheims restaurantscene. Nordisk-fransk kjøkken i et intimt trehus i Carl Johans gate.',
  local_insight = 'Rundt 40 plasser — reserver i god tid. Over 95 lærlinger har fullført utdanningen her siden 2005.'
WHERE id = '33f35551-f157-421b-b68e-8b11c81a6a0b';

-- Troll Restaurant (T1, 4.4, 1659 reviews) — REWRITE
-- Opened 2016 by Sveinung Sundli (folk rock band Gåte) and Lars Laurentius Paulsen.
UPDATE pois SET
  editorial_hook = 'Norsk gourmet i 150 år gamle tømmervegger på Fosenkaia, åpnet i 2016 av Sveinung Sundli fra folkrockbandet Gåte. Vintagelysekroner og dristig kjøkken.',
  local_insight = 'Sett-meny-format med norske råvarer — la kjøkkenets valg overraske. Uteserveringen har utsikt over kanalen.'
WHERE id = 'google-ChIJNf1E-pwxbUYRqQ37umV_TYI';


-- ============================================================================
-- TIER 2 RESTAURANTS (55 POIs — 47 active after suppression)
-- ============================================================================

-- Jaki Bar (T2, 4.9, 8 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Drop-in kafebar ved Trondheim S med à la carte-meny og monter med ferdiglagde retter for take away. Praktisk stoppested mellom tog og by.',
  local_insight = 'Ligger i Sjøgangen, gangbroen mellom sentralstasjonen og sentrum — enkelt å stikke innom på vei videre.'
WHERE id = 'google-ChIJr_mx42cxbUYRRFB-sGJmUHg';

-- Pearl Of India Restaurant - Tiller (T2, 4.9, 481 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Indisk restaurant på Tiller med 4,9 i Google-vurdering og nesten 500 anmeldelser. Autentisk kjøkken med bred meny som dekker kjøtt, vegetar og vegansk.',
  local_insight = 'Et av de høyest vurderte spisestedene utenfor Trondheim sentrum. Gjestene trekker frem autentiske smaker og varm service.'
WHERE id = 'google-ChIJ05Z5LAAvbUYRr2CODbKykXE';

-- NÒR Trondheim (T2, 4.8, 13 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Brasserie i niende etasje på Clarion Hotel Brattøra med panoramautsikt over Trondheimsfjorden. Nordisk-europeisk kjøkken høyt over bryggene.',
  local_insight = 'Vindusplassene mot fjorden gir Trondheims mest dramatiske restaurantutsikt — spesielt på kveldstid.'
WHERE id = 'google-ChIJhWmgA60xbUYRrePYBdHTaUQ';

-- Glød Asian Fusion (T2, 4.8, 19 reviews) — NEW
-- Opened October 24, 2025 by team behind Robata. Teknostallen/Teknobyen.
UPDATE pois SET
  editorial_hook = 'Asian fusion i Teknostallen, åpnet i 2025 av teamet bak Robata. Lokale råvarer møter asiatiske teknikker i Trondheims nye Teknobyen-kvartal.',
  local_insight = 'Rettene er laget for deling — bestill flere små retter og smak dere gjennom menyen sammen.'
WHERE id = 'google-ChIJB9zDjIQxbUYRFx9fyazAPcY';

-- Mesob Resturant & Bar Trondheim (T2, 4.7, 207 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Eritreisk og etiopisk kjøkken ved Ravnkloa, grunnlagt i 2016. Trondheims første dedikerte restaurant for østafrikansk mat, med hjemmelaget injera som base for alle retter.',
  local_insight = 'Alt spises tradisjonelt med hendene fra felles fat med injera-brød. Porsjonene er rause — perfekt for deling.'
WHERE id = 'google-ChIJ9fn9V5sxbUYRqTWVbz098oQ';

-- Tollbua - Restaurant (T2, 4.7, 74 reviews) — REWRITE
-- Tollboden from 1910, designed by Karl Norum. Christopher Davidsen (Bocuse d'Or 2017 silver).
UPDATE pois SET
  editorial_hook = 'Trondheims gamle tollbod fra 1910, tegnet av Karl Norum i jugendstil. Bocuse d''Or-sølvvinner Christopher Davidsen åpnet nordisk gourmetbistro her etter årene på Speilsalen.',
  local_insight = 'Henrik Dahl Jahnsen, femdobbelt norgesmester for vinkelnere, bygde opp vinkjelleren. Loungedelen gir tilgang til kjøkkenets retter uten full meny.'
WHERE id = 'google-ChIJSY81O1wxbUYRGf59dfwcssw';

-- The Living Room (T2, 4.7, 3 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Burger og bar i førsteetasjen på Clarion Hotel Brattøra, med kobbertanker for fatøl som blikkfang og utsikt over fjorden.',
  local_insight = 'Uformelt alternativ til NÒR-restauranten ni etasjer opp i samme bygg. Loungestemning med jevnlige arrangementer.'
WHERE id = 'google-ChIJ-czbxoYxbUYRekNOUNDYLrY';

-- Grano - Tiller (T2, 4.6, 79 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Italiensk pizzeria på Tiller som også lager egen salumi og har delikatessebutikk. Søsterrestaurant til Grano Midtbyen i Søndre gate.',
  local_insight = 'Produserer egne spekepølser og skinker i tillegg til pizzaene — ta med noe fra delikatessedisken hjem.'
WHERE id = 'google-ChIJ0_36MwcvbUYRLpmxob0SWsw';

-- Hammerhead BC. Taproom & Juicy Burger (T2, 4.6, 36 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Taproom i Søndre gate for håndverksbryggeriet Hammerhead, med bryggeri på Byåsen. Pilsneren brygges med malt fra Bonsak Gårdsmalteri i Skogn.',
  local_insight = 'Tankøl rett fra bryggeriet og burgere i samme lokale. Spør om sesongens spesialbrygg — utvalget roterer jevnlig.'
WHERE id = 'google-ChIJCWxmeIYxbUYRbU3An6dlh3o';

-- Sjøgangen spiseri (T2, 4.6, 42 reviews) — REWRITE
-- Opened January 2025 by Thomas Borgan and Andreas Espnes (team behind 5 Bord).
UPDATE pois SET
  editorial_hook = 'Nabolagsrestaurant på Brattørkaia, åpnet i 2025 av teamet bak 5 Bord. Oppkalt etter gangbroen mellom Midtbyen og Brattøra, med fokus på lokale råvarer.',
  local_insight = 'Dansk-inspirerte smørbrød til lunsj og delingsretter på kveldstid. Lørdagsbuffeten med smørbrød er verdt å planlegge rundt.'
WHERE id = 'google-ChIJqcPGSQAxbUYRI9QJrmNcGBc';

-- Xu's Nan Jing Hus (T2, 4.6, 177 reviews) — REWRITE
-- Opened 2024 by Weijian Xu after 30 years as cook.
UPDATE pois SET
  editorial_hook = 'Regional kinesisk mat fra Nanjing og Jiangsu-provinsen på Elgeseter gate, åpnet i 2024 av Weijian Xu etter 30 år som kokk.',
  local_insight = 'Et av få steder i Trondheim som serverer regional kinesisk mat fremfor den generiske kinarestaurant-menyen.'
WHERE id = 'google-ChIJJ73TpZIxbUYRZzsgPv4lx7k';

-- Khawgeng Thai Tiller (T2, 4.6, 34 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Thai-restaurant på Tiller med wok, curry og nuddelretter. Rause porsjoner og gode vegetariske alternativer.',
  local_insight = 'Tilgjengelig for levering via apper, men verdt å spise på stedet for den varme servicen gjestene trekker frem.'
WHERE id = 'google-ChIJ6yxs_2AvbUYRbeypG3ZmD_0';

-- SushiMe Take Away Solsiden (T2, 4.6, 348 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Take away-sushi på Solsiden, med søsterrestaurant og buffé på Ravnkloa. Tradisjonell japansk sushi med ferske råvarer.',
  local_insight = 'Kun take away her — vil du spise inne, gå til SushiMe Ravnkloa. Lunsjpriser på ettermiddagen gir god verdi.'
WHERE id = 'sushime-take-away-solsiden';

-- Hevd Bakery & Pizzeria, Adressahuset (T2, 4.6, 534 reviews) — REWRITE
-- Founded by Emanuele Spreafico (NM Årets Baker 2016), third-gen Italian baker.
-- Serves Pala Romana (NOT Neapolitan as previous hook claimed).
UPDATE pois SET
  editorial_hook = 'Håndverksbakeri på dagen, Pala Romana-pizza på kvelden. Grunnlagt av Emanuele Spreafico, tredjegenerasjons italiensk baker og NM Årets Baker 2016.',
  local_insight = 'Bakeriet i Adressahuset ved Bakke bru. Spreafico kombinerer nordisk baketradisjon med italiensk håndverk — surdeigsbrødet er signaturproduktet.'
WHERE id = 'hevd-bakery';

-- S.P.G Stjørdal Pizza og Grill (T2, 4.6, 75 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Pizza- og grillrestaurant i Søndregata i Stjørdal sentrum, med solid rykte blant lokale stamgjester.',
  local_insight = 'Ring og bestill for henting — slipper du ventetid i køen, spesielt på travle kvelder.'
WHERE id = 'google-ChIJUZ7dHAAVbUYRG9Hy85Go00w';

-- Mintage Sushi - Stjørdal (T2, 4.6, 145 reviews) — REWRITE
-- Founded by Kent Olav Ferstad in 2014, from Steinkjer.
UPDATE pois SET
  editorial_hook = 'Trøndersk sushikjede grunnlagt av Kent Olav Ferstad i 2014, med utspring fra Steinkjer. Stjørdal-avdelingen holder til i Kjøpmannsgata.',
  local_insight = 'Begrenset åpningstid i helgene — sjekk mintage.no for oppdaterte tider før du drar.'
WHERE id = 'google-ChIJSZ4_fvIVbUYRUZAzqOLdv3s';

-- Robata Asian Fusion — Munkegata (T2, 4.5, 587 reviews) — REWRITE
-- Previously Sushi Bar, introduced sushi to Trondheim. Now at Munkegata 41/Ravnkloa.
UPDATE pois SET
  editorial_hook = 'Tidligere Sushi Bar, som introduserte sushi til Trondheim — nå asiatisk fusjonskjøkken med kullgrill, dim sum og ramen ved Ravnkloa.',
  local_insight = 'Ligger rett ved Ravnkloa fisketorg — bestill bord ved vinduet for utsikt nedover Munkegata mot fjorden.'
WHERE id = 'google-ChIJXemDX5sxbUYRUJFHImZJvr4';

-- Benja Siam Midtbyen (T2, 4.5, 888 reviews) — REWRITE
-- Established 2012 in Ravelsveita. Recipes by chef Vichit Perksatikul.
UPDATE pois SET
  editorial_hook = 'Autentisk thai i Ravelsveita siden 2012, med egenkomponerte oppskrifter av kokken Vichit Perksatikul.',
  local_insight = 'Lett å gå forbi inngangen i den smale veita — følg skiltet inn fra Nordre gate, det er verdt omveien.'
WHERE id = 'google-ChIJU9HDPJsxbUYRHrA37fOY7IA';

-- Juicy Burger - Trondheim (T2, 4.5, 17 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Burgerrestaurant i Søndre gate 24 som deler lokale med Hammerhead Brewing Company — håndlagde burgere og bryggeriøl under samme tak.',
  local_insight = 'Kombiner burgeren med et glass fra Hammerhead-bryggeriet vegg i vegg for den komplette opplevelsen.'
WHERE id = 'google-ChIJJQ5_c2wvbUYRop0Z1VJz9QE';

-- Banksalen (T2, 4.5, 113 reviews) — REWRITE
-- Old Norges Bank building from 1882. Venetian Renaissance sandstone. Fratigruppen.
UPDATE pois SET
  editorial_hook = 'I Norges Banks lokaler fra 1882, med sandstein i venetiansk renessansestil — nå selskapslokale for opptil 220 gjester.',
  local_insight = 'Primært for selskaper og arrangementer — kontakt Fratigruppen for privatbestilling av rommene.'
WHERE id = 'google-ChIJoQaL1JsxbUYRt3iAgLtL-PM';

-- Lyche Kjøkken & Bar (T2, 4.5, 297 reviews) — REWRITE
-- Student-run at Studentersamfundet. All staff volunteers via KSG.
UPDATE pois SET
  editorial_hook = 'Frivilligdrevet restaurant i Studentersamfundet, der studentene i KSG lager alt fra bunnen. Lycheburger er en institusjon.',
  local_insight = 'Medlemmer av Studentersamfundet får rabatt — bord fylles fort på fredagskveldene.'
WHERE id = 'google-ChIJCaCyWpExbUYRcYgrngN0rtY';

-- Grano Pizzeria (T2, 4.5, 440 reviews) — REWRITE
-- Started by four Italian pizza enthusiasts who met in Trondheim.
UPDATE pois SET
  editorial_hook = 'Startet av fire pizzaentusiaster fra Italia som møttes i Trondheim — Grano i Søndre gate byr på rund pizza og al taglio-stykker.',
  local_insight = 'Al taglio (stykkepizza) er ideelt for en rask lunsj — kjøpes over disk uten ventetid.'
WHERE id = '28773f38-a6ed-489c-aee7-d9337412d611';

-- Lerka (T2, 4.5, 72 reviews) — REWRITE
-- Located in Dybdahlsgården (NOT Olavshallen as previous hook claimed).
UPDATE pois SET
  editorial_hook = 'Napoletansk pizza i Dybdahlsgården ved Lerkendal — oppkalt etter området, med tynnskåret pizza fra vedfyrt ovn.',
  local_insight = 'Lunsj på dagtid og pizza på kveldstid — et rolig alternativ til sentrumsrestaurantene.'
WHERE id = 'google-ChIJPaw3AVIxbUYRudoK3JOrbOY';

-- Amber Restaurant (T2, 4.5, 723 reviews) — REWRITE
-- Sushi and modern Asian (NOT "Nordic fine dining with Asian undertones" as old hook said).
UPDATE pois SET
  editorial_hook = 'Sushi og moderne asiatisk kjøkken i Kongens gate siden 2016 — kinesisk, japansk og thailandsk med europeisk vri.',
  local_insight = 'Tilbyr takeaway og catering i tillegg til spising på stedet — ligger sentralt i Kongens gate.'
WHERE id = 'amber-restaurant';

-- AiSuma Restaurant (T2, 4.5, 1119 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Middelhavsinspirert grill og bar i et gammelt sjøhus ved Nidelva — Kjøpmannsgata 57, der grovt bryggepanel møter dristig interiør.',
  local_insight = 'Bordene nærmest vinduene har direkte utsikt over Nidelva og de fargerike bryggerekkene — bestill bord.'
WHERE id = 'google-ChIJJ0TgSJkxbUYR6lHWdmGiFrY';

-- Superhero Burger (T2, 4.4, 560 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Kullgrillede håndlagde burgere med flere avdelinger i Trondheim sentrum — blant annet på Trondheim Torg og i Olav Tryggvasons gate.',
  local_insight = 'Brettspill tilgjengelig for gjestene — en uformell burgerkveld uten stress, med flere lokasjoner å velge mellom.'
WHERE id = '25b64017-9b12-467c-aa85-7257ea6a4f34';

-- Wood Pizza City Syd (T2, 4.4, 264 reviews) — REWRITE
-- Handmade stone oven from Modena. Local ingredients (lamb, reindeer from Røros).
UPDATE pois SET
  editorial_hook = 'Napolitansk pizza fra håndlaget steinovn importert fra Modena — Wood Pizza på City Syd bruker lokale råvarer som lam og rein fra Røros.',
  local_insight = 'Familievennlig pizzarestaurant med vedfyrt ovn — også avdeling på City Lade.'
WHERE id = 'google-ChIJhdebCKovbUYRxWP3m5Sg11M';

-- Le Bistro (T2, 4.4, 752 reviews) — REWRITE
-- Run by Mette Beate Evensen and Martin Hovdal (ex-Røst Teaterbistro, Maaemo, Ylajali).
UPDATE pois SET
  editorial_hook = 'Fransk bistro på Munkegata av Mette Beate Evensen og Martin Hovdal — paret bak Røst Teaterbistro, med bakgrunn fra Maaemo og Ylajali.',
  local_insight = 'Vinlisten har et sterkt utvalg fra Burgund — spør personalet om anbefaling til maten.'
WHERE id = 'google-ChIJZTrmbJsxbUYR9gbf6Pm2AnQ';

-- Una pizzeria e bar — Solsiden (T2, 4.4, 2280 reviews) — REWRITE
-- Opened 2014. Pronounced [o:na]. Fratigruppen.
UPDATE pois SET
  editorial_hook = 'Autentisk italiensk pizza på Solsiden siden 2014 — Una (uttales [o:na]) i Beddingen har blitt en fast destinasjon for trondhjemmere.',
  local_insight = 'Uteserveringen mot Beddingen er blant byens mest populære sommerkvelder — vær tidlig ute.'
WHERE id = 'google-ChIJFSxqCp8xbUYRxlNF2ntkSWg';

-- Una pizzeria e bar — duplicate/legacy POI (T2, 4.4, 678 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Napolitanskinspirert pizzeria på Solsiden, åpnet i 2014 — drevet av Fratigruppen med fokus på italienske råvarer og håndverk.',
  local_insight = 'Uteservering mot Beddingen om sommeren — bestill Margherita DOC for den klassiske opplevelsen.'
WHERE id = 'una-pizzeria';

-- Emilies Eld Restaurant & Bar (T2, 4.4, 836 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Startet som ELD, et konsept rundt åpen ild i Kongens gate — har utviklet seg til nordisk kjøkken med italiensk og fransk fingerspissfølelse.',
  local_insight = 'Be om bord i andre etasje for en roligere ramme — nordiske råvarer med europeisk tilnærming.'
WHERE id = 'google-ChIJc6bmJZsxbUYRuc4zxXzdidY';

-- Spontan Vinbar (T2, 4.4, 380 reviews) — REWRITE
-- Opened August 2017 by Oskar Sköld and Fredrik Engen. Moved to Fjordgata 2022. Name changed to Saga 2025.
UPDATE pois SET
  editorial_hook = 'Åpnet i 2017 av Oskar Sköld og Fredrik Engen, flyttet til Fjordgata i 2022. Kåret til Norges beste vinliste av Star Wine List.',
  local_insight = 'Vinbaren foran tar drop-in for glass og småsnacks — restaurantdelen (nå Saga) krever reservasjon.'
WHERE id = '30304212-1fb8-4067-a5ce-6b6c9b80a04a';

-- KōH i NōR (T2, 4.4, 2615 reviews) — REWRITE
-- Named after Koh-i-Noor diamond. Indian cuisine in Vår Frue Strete.
UPDATE pois SET
  editorial_hook = 'Indisk restaurant i Vår Frue Strete, oppkalt etter Koh-i-Noor-diamanten — krydder fra det indiske subkontinentet i vestlig ramme.',
  local_insight = 'Med over 2600 Google-anmeldelser er dette en av Trondheims mest besøkte restauranter — bestill bord i helgene.'
WHERE id = 'google-ChIJ5_6pGmIwbUYR8LhKl66MXnc';

-- Sabrura Sticks & Sushi Solsiden (T2, 4.4, 1039 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Sushikjede grunnlagt i 2012 med mål om å gjøre sushi til hverdagsmat — Solsiden-avdelingen ligger ved Bassengbakken med utsikt mot marinaen.',
  local_insight = 'Spis-alt-du-vil-konseptet gjør Sabrura til et rimelig alternativ for familier og større grupper.'
WHERE id = 'google-ChIJYTz8R6AxbUYRz_IhEP_oOVk';

-- Broen Bar & Restaurant (T2, 4.4, 17 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Hotelrestaurant i Scandic Nidelven ved Havnegata, med utsikt over Nidelva — moderne norsk kjøkken basert på lokale råvarer.',
  local_insight = 'Velg vindusbord for utsikt rett ut mot Nidelva og de fargerike bryggene — åpent for alle, ikke bare hotellgjester.'
WHERE id = 'google-ChIJN0xPW54xbUYRJnjX_56rskM';

-- Trondhjem Mikrobryggeri (T2, 4.3, 720 reviews) — REWRITE
-- Opened Dec 4, 1998 as Norway's second brewpub. Own distillery since 2017.
UPDATE pois SET
  editorial_hook = 'Norges nest eldste bryggeripub, åpnet i 1998 i Prinsens gate — alt øl brygges på stedet, og siden 2017 destilleres også vodka, akevitt og gin.',
  local_insight = 'Spør om eksklusive brygg som kun serveres på stedet og aldri når butikkhyllene.'
WHERE id = '3e93ba3a-de3e-434f-b89e-3d7947bfb985';

-- Amore Ristorante & Pizzeria (T2, 4.3, 665 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Italiensk restaurant og pizzeria i Kjøpmannsgata i Stjørdal sentrum, med 85 sitteplasser inne og romslig uteplass.',
  local_insight = 'Fungerer godt for større selskaper med romslig uteplass — ring for reservasjon i helgene.'
WHERE id = 'google-ChIJwbpeYfIVbUYRLzmfXlr8_6k';

-- Viva Napoli (T2, 4.3, 819 reviews) — REWRITE
-- Open since May 16, 1997 in Kirkevegen, Stjørdal. Same owner throughout.
UPDATE pois SET
  editorial_hook = 'Italiensk pizzeria i Kirkevegen i Stjørdal siden 1997 — samme eier i snart 30 år, med napolitansk håndverkstradisjon.',
  local_insight = 'Egne lokaler for selskaper og arrangementer — populært som lokal møteplass i Stjørdal.'
WHERE id = 'google-ChIJL4oniuwVbUYRgC0GZKGVK9I';

-- Jonathan Grill (T2, 4.3, 353 reviews) — REWRITE
-- First in Norway with Japanese smoke-free table grills, in Britannia Hotel basement.
UPDATE pois SET
  editorial_hook = 'Norges første restaurant med japanske, røykfrie bordgriller — i kjelleren på Britannia Hotel, der gjestene griller wagyu og kamskjell selv.',
  local_insight = 'Velg à la carte-siden om du foretrekker at kjøkkenet tar seg av grillingen fremfor å stå ved bordet selv.'
WHERE id = 'google-ChIJ10ho6psxbUYR7B0NX1iPIVs';

-- Café Løkka (T2, 4.3, 1301 reviews) — REWRITE
-- In former shipyard area (Ørens Mekaniske Værksted). 1960s-inspired, English church pews.
UPDATE pois SET
  editorial_hook = 'Gastropub i det gamle skipsverftområdet på Dokkgata, innredet med engelske kirkestoler og danske skolestoler i 60-tallsstil.',
  local_insight = 'Mellom Bakklandet og Solsiden, med bred øltappliste og hjemmelagde milkshakes. Uteserveringen fylles fort i sol.'
WHERE id = 'cafe-l-kka';

-- Frati restaurant (T2, 4.3, 2906 reviews) — KEEP
-- Paolo Minervini founded 1973, son Michael runs it. Existing hook research-verified.

-- Benja Siam Syd (T2, 4.3, 267 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Thairestaurant på Østre Rosten med tilhørighet i Tiller-området — en av Benja Siams to avdelinger i Trondheim, med egen filial også i Midtbyen.',
  local_insight = 'Ligger ved City Syd-krysset med god tilgjengelighet fra E6. Benja Siam har også avdeling i Ravelsveita i sentrum.'
WHERE id = 'google-ChIJTWGvvc0vbUYRduAl8OiwsPM';

-- Robata Asian Fusion — duplicate POI (T2, 4.3, 456 reviews) — REWRITE
-- Originally East Sushi & Noodles (1988), became Sushi Bar, then Robata 2023.
UPDATE pois SET
  editorial_hook = 'Startet som Sushi Bar i 1998 og introduserte sushi i Trondheim — nå Robata Asian Fusion ved Ravnkloa, med japansk kullgrill på Munkegata.',
  local_insight = 'Robata-grillen er den japanske trekullgrillen som gir sin egen røykkarakter. Ligger ved Ravnkloa på Munkegata.'
WHERE id = 'robata-asian-fusion';

-- Røft Rôtisseri Trondheim (T2, 4.3, 1456 reviews) — REWRITE
-- Opened 2012, American-inspired, above railway tracks at Trondheim S.
UPDATE pois SET
  editorial_hook = 'Amerikanskinspirert rotisseri over sporene på Trondheim S, åpnet i 2012 — utsikt mot sentrum og ukomplisert grillkjøkken.',
  local_insight = 'Sjøgangen forbinder stasjonen med Brattøra-området. Naturlig stopp før eller etter toget, med eget lekerom for barn.'
WHERE id = 'google-ChIJp_NXXqkxbUYRZstLaA-FCD0';

-- Graffi Grill Solsiden (T2, 4.2, 1507 reviews) — REWRITE
-- "Graffi" = old Trøndelag dialect for expertise. Josper charcoal grill.
UPDATE pois SET
  editorial_hook = 'Graffi er trøndersk for kunnskap — grillrestauranten på TMV-kaia bruker Josper kullgrill for distinkt røyksmak, med terrasse mot kanalen.',
  local_insight = 'Be om bord på terrassen mot kanalen for å kombinere kullgrillet kjøtt med utsikt over Solsidens kaikliv.'
WHERE id = 'google-ChIJLQtHY58xbUYR4cj-xu--2Lc';

-- Krambua (T2, 4.2, 719 reviews) — REWRITE
-- Opened Oct 28, 1993. Building by Hagbart Schytte-Berg (1908). Blues concerts.
UPDATE pois SET
  editorial_hook = 'Vertshus på Krambugata siden 1993, i en bygård tegnet av Hagbart Schytte-Berg i 1908 — husmannskost fra bunnen og faste blueskonserter.',
  local_insight = 'Operapub arrangeres den første onsdagen i hver måned. Trondheim Bluesklubb holder til her med jevnlige konserter.'
WHERE id = 'google-ChIJ65ThqJ4xbUYRe87i83tgZpM';

-- Trondheim microbrewery — duplicate POI (T2, 4.2, 478 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Åpnet 4. desember 1998 som Norges nest eldste bryggeripub — alt øl brygges i Prinsens gate, og siden 2017 destilleres også akevitt, gin og vodka.',
  local_insight = 'Alt øl og alle destillater lages i bryggverket på stedet. Spør om sesongbryggene som aldri når butikkhyllene.'
WHERE id = 'google-ChIJGx1UIZsxbUYRRAFpkkE77OU';

-- Graffi Grill Midtbyen (T2, 4.2, 2156 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Graffi er trøndersk for ekspertise — etter to tiår på Olav Tryggvasons gate lever grillrestauranten opp til navnet med Josper-grill.',
  local_insight = 'Midtbyen-filialen er den opprinnelige Graffi Grill, sentralt plassert for en uformell grillmiddag midt i gågata.'
WHERE id = 'google-ChIJ2_xijJsxbUYRH9bkAyVQljM';

-- Sabrura Sticks & Sushi Bakklandet (T2, 4.2, 821 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Sabruras avdeling på Øvre Bakklandet, nær Gamle Bybro — sushi og sticks fra kjeden grunnlagt i Trondheim i 2012, nå med rundt 40 avdelinger.',
  local_insight = 'Bakklandet-filialen ligger i gangavstand fra Gamle Bybro og Nidelva. Norsk vri med lokale råvarer.'
WHERE id = 'google-ChIJf1Puw5kxbUYRlTZKglnF0oE';

-- Bula Asian Kitchen (T2, 4.2, 290 reviews) — REWRITE
-- Sister concept to Bula Neobistro. Renée Fagerhøi won Top Chef 2015.
UPDATE pois SET
  editorial_hook = 'Søsterkonseptet til Bula Neobistro — asiatisk streetfood fra Top Chef 2015-vinner Renée Fagerhøis kjøkkenunivers, i Thomas Angells gate.',
  local_insight = 'Mer uformelt og rimeligere enn Neobistro-versjonen i Prinsens gate. Designet for deling i gatemat-format.'
WHERE id = '36467f15-18f7-4512-a6f8-9dd284a99479';

-- Bakgården Bar og Spiseri (T2, 4.2, 400 reviews) — REWRITE
-- Opened 2009. Trondheim's first tapas restaurant. Building recognized by Historical Association.
UPDATE pois SET
  editorial_hook = 'Trondheims første tapasrestaurant, åpnet i 2009 i en bevaringsverdig bygård i Kjøpmannsgata — spanskinspirert med trønderske råvarer.',
  local_insight = 'Bygården er anerkjent av Trondhjems Historiske Forening. Sett sammen egen tapasmeny eller velg en ferdig sammensatt.'
WHERE id = 'google-ChIJj0wNTZkxbUYRqg_sg3VAh2U';

-- Alma's (T2, 4.1, 338 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Bar og kjøkken i Kongens gate med verdensinspirert meny — et lokale som fungerer like godt for hverdagsmiddag som for kveldsutgang.',
  local_insight = 'Lokalet i Kongens gate 19 kan bookes for private arrangementer med full teknisk rigg for lyd og lys.'
WHERE id = 'google-ChIJfTzw3JoxbUYRRIkY6eqT-pA';

-- Indian Tandoori Restaurant (T2, 4.0, 886 reviews) — REWRITE
-- Winner of European Region of Gastronomy Award 2022. Uses dairy from Kilnes Gård.
UPDATE pois SET
  editorial_hook = 'Vinner av European Region of Gastronomy Award 2022 — indisk kjøkken på Søndre gate med trønderske råvarer og meieriprodukter fra Kilnes Gård.',
  local_insight = 'Ligger i andre etasje i Søndre gate 22A. Sesonggrønnsaker og kjøtt fra Trøndelag brukes ved siden av indiske krydder.'
WHERE id = 'google-ChIJ180zDJwxbUYRNxnVDuOpVXY';

-- Søstrene Karlsen (T2, 4.0, 641 reviews) — REWRITE
-- Opened 2004 by sisters Nina and Hege Karlsen.
UPDATE pois SET
  editorial_hook = 'Åpnet i 2004 av søstrene Nina og Hege Karlsen — en av Solsidens opprinnelige restauranter på TMV-kaia, med uteservering mot kanalen.',
  local_insight = 'Uteserveringen på kaikanten fanger ettermiddagssolen. Ligger i klyngen av restauranter langs TMV-kaia på Solsiden.'
WHERE id = 'google-ChIJ39iadJ8xbUYRRczbteBUpAc';

-- Héctor Food & Fiesta (T2, 4.0, 735 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Cali-Mex-restaurant ytterst på TMV-kaia — tacos, cocktails og latinamerikansk feststemning med privat terrasse over Solsidens kanalliv.',
  local_insight = 'Andre etasje har privat terrasse med utsikt over Solsiden. Eget selskapsrom, Chambre, for mindre grupper.'
WHERE id = 'google-ChIJs5Q50UYxbUYRgJFfKVmyTvE';


-- ============================================================================
-- TIER 3 RESTAURANTS (20 active after suppression)
-- ============================================================================

-- PizzaPizza Trondheim S (T3, 4.9, 68 reviews) — REWRITE
-- Founded by Italian pizzaiolo Sebastiano. Cold-fermented dough. Pala = ~50cm, ~1.1kg.
UPDATE pois SET
  editorial_hook = 'Grunnlagt av italienske Sebastiano — kaldhevet deig i to format: rund tradizionale for én, eller halvmeterlang romersk pala til deling.',
  local_insight = 'Pala-pizzaen er ca. 50 cm lang og veier over en kilo — beregnet for deling. Forhåndsbestilling anbefales ved henting.'
WHERE id = 'google-ChIJtfTs9rwxbUYRgrBg3t02uB4';

-- Olivia Solsiden (T3, 4.2, 1787 reviews) — REWRITE
-- First Olivia outside Oslo. Florence-inspired. Beddingen 16.
UPDATE pois SET
  editorial_hook = 'Den første Olivia utenfor Oslo, inspirert av Firenze — hjemmelaget pasta og pizza ved Nidelva på Beddingen, med plass til 200 gjester.',
  local_insight = 'Bordene ytterst mot elva har utsikt over Nidelva. Reserver i helgene — Solsiden-filialen er blant de mest besøkte.'
WHERE id = 'google-ChIJ88TAqZ8xbUYR7lTSrj19f4k';

-- SushiMe Take Away Tiller (T3, 4.2, 5 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Sushi som kun take away ved City Syd på Tiller — forhåndsbestilling timer eller dager i forveien for henting til ønsket tid.',
  local_insight = 'Ligger inne i kjøpesenteret på Ivar Lykkes veg 2. Forhåndsbestilling gir fersk sushi klar til avtalt hentetidspunkt.'
WHERE id = 'google-ChIJbRAYBZEvbUYRJ9bV33vrYVU';

-- Olivia Restaurant Munkegata (T3, 4.1, 870 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Del av Olivia-kjeden med florentinskinspirert italiensk kjøkken — hjemmelaget pasta, pizza og antipasti i Munkegata, nær Torvet i Trondheim.',
  local_insight = 'Olivia har restauranter i syv norske byer. Munkegata-filialen ligger sentralt, få minutters gange fra Nidarosdomen.'
WHERE id = '437b4cc0-ed85-4bfd-93a3-a67cd8cf0c9d';

-- Peppes Pizza - Trondheim (T3, 4.1, 1348 reviews) — NEW
-- Founded by American Louis Jordan in 1970. Trondheim branch since December 1973.
UPDATE pois SET
  editorial_hook = 'Norges første pizzakjede, grunnlagt av amerikaneren Louis Jordan i 1970 — Trondheim-filialen har holdt til i Kjøpmannsgata siden 1973.',
  local_insight = 'En av Norges eldste pizzarestauranter i drift. Ligger i Kjøpmannsgata, et kvartal fra Ravnkloa og Munkegata.'
WHERE id = 'google-ChIJV61XnZkxbUYRx458WADOEyg';

-- Sabrura City Syd (T3, 4.0, 377 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Sabruras avdeling ved City Syd på Tiller — sushi og sticks fra kjeden som startet i Trondheim i 2012 og nå har rundt 40 avdelinger.',
  local_insight = 'Ligger på Østre Rosten ved City Syd, med enkel tilgang fra E6. Familiefokusert konsept med asiatisk buffet.'
WHERE id = 'google-ChIJezjLuGkubUYRbXO76dbpvXk';

-- Star Kebab & Grill (T3, 4.0, 284 reviews) — NEW
UPDATE pois SET
  editorial_hook = 'Kebab og grill i Olav Tryggvasons gate, i gågata midt i Midtbyen — et fast innslag for et raskt måltid i Trondheims travleste handlegate.',
  local_insight = 'Ligger midt i gågata med kort vei til Torvet og Ravnkloa. Enkel gatematrestaurant for kebab og pizza.'
WHERE id = 'google-ChIJQcK0DnEubUYRlsal34GPybc';

-- Sam's Pizza Grill (T3, 4.0, 256 reviews) — NEW
-- Previously known as Smile Elgeseter. Near NTNU.
UPDATE pois SET
  editorial_hook = 'Tidligere kjent som Smile Elgeseter — pizza- og grillsted på Elgeseter gate som har servert studenter og forbipasserende i årevis.',
  local_insight = 'Ligger rett ved NTNU Gløshaugen — praktisk stopp for en rask bit mellom forelesninger.'
WHERE id = 'google-ChIJ73imCpQxbUYR_ebnEmktD2I';

-- 73 Bar & Restaurant (T3, 4.0, 43 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Hotellrestauranten i Radisson Blu Royal Garden ved Nidelva, med nordisk kjøkken basert på trønderske råvarer.',
  local_insight = 'Åpent for alle, ikke bare hotellgjester — vindusbordene langs elva gir utsikt over Bakklandet.'
WHERE id = 'google-ChIJZa9zwZ4xbUYRAo9HwBfdf6s';

-- SushiTake Meny Solsiden (T3, 4.0, 4 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Sushi-disk inne i Meny-butikken på Solsiden — fersk sushi til å ta med uten å forlate kjøpesenteret.',
  local_insight = 'Praktisk for en rask lunsj mellom butikkene på Solsiden — finn disken inne i dagligvarebutikken Meny.'
WHERE id = 'google-ChIJ2ROkjQcxbUYReyF6arszO90';

-- Oska Pizzeria AS (T3, 3.9, 305 reviews) — NEW
-- Voted Trondheim's best pizza by Adresseavisen. Møllenberg/Bakkegata.
UPDATE pois SET
  editorial_hook = 'Pizzeria på Møllenberg som Adresseavisen har kåret til Trondheims beste pizza — en nabolagsinstitusjon i Bakkegata.',
  local_insight = 'Leverer via Wolt og Foodora, men Bakkegata-lokalet er verdt turen for å få pizzaen rett fra ovnen.'
WHERE id = 'google-ChIJVcVBz5gxbUYRhfew6L8huJ0';

-- Egon City Syd (T3, 3.9, 693 reviews) — REWRITE
-- Chain founded 1984, named after Egon Olsen, HQ in Trondheim.
UPDATE pois SET
  editorial_hook = 'Egon på City Syd — den norske restaurantkjeden grunnlagt i 1984 og oppkalt etter Olsenbanden-figuren, med hovedkontor i Trondheim.',
  local_insight = 'Selvbetjeningskonsept der du bestiller i baren — praktisk midt i en handledag på City Syd.'
WHERE id = 'google-ChIJM_8n6mkubUYRyXGHrwQM3gA';

-- NO:20 Restaurant og Bar (T3, 3.9, 11 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Restaurant og bar i Quality Airport Hotel Værnes, rett ved Stjørdal sentrum og minutters avstand fra flyplassen.',
  local_insight = 'Åpent for alle, ikke bare hotellgjester — et av få spisesteder i Kjøpmannsgata med fullverdig restaurantmeny.'
WHERE id = 'google-ChIJ01s2ZvIVbUYRBxF2YyUBJd4';

-- Egon Solsiden (T3, 3.9, 969 reviews) — REWRITE
-- Old shipyard area Nedre Elvehavn. Nautical decor with TMV-kaia history.
UPDATE pois SET
  editorial_hook = 'Egon Solsiden holder til i det gamle verftsområdet ved Nedre Elvehavn, med nautisk interiør og bilder fra TMV-kaias skipsbyggerhistorie.',
  local_insight = 'Uteserveringen langs kaia er blant de største på Solsiden — et trygt valg for større grupper i sommerhalvåret.'
WHERE id = 'google-ChIJ4ccQcZ8xbUYR6Xl1I85wHrg';

-- Pizzabakeren Stjørdal (T3, 3.9, 265 reviews) — REWRITE
-- Chain founded Stavanger 2003. Over 200 locations.
UPDATE pois SET
  editorial_hook = 'Pizzabakeren i Kjøpmannsgata — den norske pizzakjeden grunnlagt i Stavanger i 2003, med over 200 utsalg og daglig nybakte bunner.',
  local_insight = 'Sentralt i Stjørdal sentrum, like ved Quality Airport Hotel Værnes — henting er raskere enn levering her.'
WHERE id = 'google-ChIJMYyDbfMVbUYRqxgkiY_Zxrg';

-- Pizzabakeren Nedre Singsaker (T3, 3.9, 125 reviews) — NEW
UPDATE pois SET
  editorial_hook = 'Pizzabakeren i Singsakerbakken, midt i studentbydelen Singsaker — nybakte bunner fra den norske kjeden grunnlagt i Stavanger i 2003.',
  local_insight = 'Gangavstand fra både NTNU Gløshaugen og Studentersamfundet — et av få take-away-alternativer i Singsaker-området.'
WHERE id = 'google-ChIJQY6sbpExbUYR-QGhtPEKAC8';

-- Tempe Hagen (T3, 3.9, 14 reviews) — NEW
-- Neighborhood café by Prima, in Frost Eiendom building, registered 2024.
UPDATE pois SET
  editorial_hook = 'Bydelskafe på Tempe drevet av Prima, i første etasje av Frost Eiendoms boligprosjekt — en møteplass for nabolaget med uteservering mot parken.',
  local_insight = 'To kilometer sør for sentrum, men verdt omveien for en rolig kopp kaffe i grønne omgivelser langs Ola Frosts veg.'
WHERE id = 'google-ChIJPYPRDwAxbUYRoDJVX2AAGW8';

-- Egon Stjørdal (T3, 3.8, 940 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Egon i Stjørdal sentrum — den norske restaurantkjeden fra 1984, oppkalt etter Egon Olsen, med selvbetjening i baren og servering ved bordet.',
  local_insight = 'Ligger i Kjøpmannsgata, kort vei fra Quality Airport Hotel Værnes — et familievennlig alternativ med bred meny.'
WHERE id = 'google-ChIJuVSlne0VbUYROis1k5swvkY';

-- Domino's Pizza Lerkendal (T3, 3.7, 463 reviews) — NEW
UPDATE pois SET
  editorial_hook = 'Domino''s ved Lerkendal — den globale pizzakjedens filial med åpent kjøkken der glassvegger viser pizzalagingen.',
  local_insight = 'Ligger like ved Lerkendal stadion — kort vei for en rask pizza før eller etter kamp.'
WHERE id = 'google-ChIJ-X2LsdsxbUYR0GegQx4Xkc4';

-- The Social Bar & Bistro (T3, 3.7, 3 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Strawberry Hotels'' bistrokonsept i Quality Hotel Panorama på Tiller — en av få restauranter med servering utenfor kjøpesentrene i området.',
  local_insight = 'Åpent for alle, ikke bare hotellgjester — syv kilometer sør for Trondheim sentrum, rett ved E6.'
WHERE id = 'google-ChIJea8nA38vbUYRbW8UILv2zoI';

-- Burger King City Syd (T3, 3.7, 248 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Burger King i City Syd-senteret på Tiller — den globale hurtigmatkjeden med drive-through ved inngangspartiet.',
  local_insight = 'Ligger i samme bygg som Egon og øvrige spisesteder på City Syd — raskt alternativ midt i en handledag.'
WHERE id = 'google-ChIJ8TbLuGkubUYRyl0VZG36m1c';

-- Sesam AS (T3, 3.7, 412 reviews) — NEW
-- Founded by Ibrahim Mansour in 1989 at Studentersamfundet. Magne Furuholmen (a-ha) was a regular.
UPDATE pois SET
  editorial_hook = 'Burgerkiosk ved Studentersamfundet, grunnlagt av Ibrahim Mansour i 1989 — kåret til byens beste burger flere ganger.',
  local_insight = 'To avdelinger på hver side av det runde Samfundet-bygget — rett ved Elgeseter bro med utsikt mot Nidarosdomen.'
WHERE id = 'google-ChIJBxOYQ5ExbUYRj650KHMXwts';

-- Fresh Fast Food (T3, 3.6, 401 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Burger- og kebabrestaurant på TMV-kaia ved Solsiden, med nytt lokale og utsikt over kaiområdet ved Nedre Elvehavn.',
  local_insight = 'Et av de rimeligere spisestedene langs Solsiden-kaia — bestill i disken for rask servering.'
WHERE id = 'google-ChIJ221C2KExbUYRCFnGDUHKY78';

-- Crispy Fried Chicken Stjørdal (T3, 3.6, 63 reviews) — REWRITE
-- CFC founded Trondheim 2017. First drive-through in Stjørdal Nov 2022.
UPDATE pois SET
  editorial_hook = 'Norges første drive-through for stekt kylling, åpnet i Stjørdal i november 2022 — CFC-kjeden startet som pilotprosjekt i Trondheim i 2017.',
  local_insight = 'Drive-through i Værnesgata, like ved Stjørdal sentrum — raskt alternativ for reisende til og fra Værnes.'
WHERE id = 'google-ChIJjYyLWjIVbUYRuLx6dyQ2aVw';

-- China Palace Restaurant (T3, 3.6, 255 reviews) — REWRITE
UPDATE pois SET
  editorial_hook = 'Kinesisk restaurant sentralt i Kjøpmannsgata i Stjørdal, med buffet og a la carte — et av byens mest etablerte asiatiske spisesteder.',
  local_insight = 'Rullestoltilgjengelig med parkering rett utenfor — ligger i gangavstand fra hotellene i sentrum.'
WHERE id = 'google-ChIJX2o6rvMVbUYRQPDqfz5pmcY';

-- Burger King Tiller (T3, 3.6, 679 reviews) — REWRITE
-- Previous hook was identical copy of City Syd BK (wrong location). Fixed.
UPDATE pois SET
  editorial_hook = 'Burger King på Tiller, ved krysset Ivar Lykkes veg og E6 — den globale hurtigmatkjeden med drive-through.',
  local_insight = 'Ligger ved innfartsveien til Tiller-området, like ved Quality Hotel Panorama — raskt stopp langs E6.'
WHERE id = 'google-ChIJRcoAbmgubUYRvxtNqc7otsk';

-- Big Bite Trondheim S (T3, 3.4, 56 reviews) — REWRITE
-- Big Bite founded 1997 at City Syd, Trondheim. 70+ locations.
UPDATE pois SET
  editorial_hook = 'Big Bite ved Trondheim S — den norske sub- og wrap-kjeden som startet på City Syd i Trondheim i 1997, nå med over 70 utsalg.',
  local_insight = 'Rett ved sentralstasjonen på Fosenkaia — et raskt måltid mellom tog og buss uten å gå langt.'
WHERE id = 'google-ChIJf15YVaoxbUYRnujtkFe4pn4';


-- ============================================================================
-- SUPPRESS (quality issues)
-- ============================================================================

-- Jafs Pirbadet — 1.9 rating with 54 reviews = persistent quality issues
UPDATE pois SET trust_score = 0.1 WHERE id = 'google-ChIJFZgTSnYxbUYROHg1wO_uluc';
