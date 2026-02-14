-- ============================================
-- 026: Museum editorial content for Trondheim
-- Research-verified editorial hooks and local
-- insights for museum POIs. Covers cathedrals,
-- galleries, open-air museums, and specialist
-- collections in the Trondheim area.
-- ============================================


-- ============================================
-- 1. NIDAROSDOMEN (Nidaros Cathedral)
-- ============================================

UPDATE pois
SET editorial_hook = 'Nordens største middelalderkatedral, bygget over gravstedet til helgenkongen St. Olav fra ca. 1070. Vestfrontens 76 skulpturer er et mesterverkt i gotisk steinhugging — mange av originalene står i Erkebispegårdens museum.',
    local_insight = 'Gå tidlig for å unngå turgrupper — interiøret er mest atmosfærisk i morgenlyset. Om sommeren holdes gratis orgelkonserter hver lørdag kl. 13.30. Bestill tårnklatring på forhånd for panoramautsikt over byen.'
WHERE name ILIKE '%Nidaros%' AND category_id = 'museum'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');

UPDATE pois
SET editorial_hook = 'Nordens største middelalderkatedral, bygget over gravstedet til helgenkongen St. Olav fra ca. 1070. Vestfrontens 76 skulpturer er et mesterverk i gotisk steinhugging — mange av originalene står i Erkebispegårdens museum.',
    local_insight = 'Gå tidlig for å unngå turgrupper — interiøret er mest atmosfærisk i morgenlyset. Om sommeren holdes gratis orgelkonserter hver lørdag kl. 13.30. Bestill tårnklatring på forhånd for panoramautsikt over byen.'
WHERE name ILIKE '%Nidarosdomen%' AND category_id = 'sightseeing'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');


-- ============================================
-- 2. ROCKHEIM — Norges nasjonale museum for populærmusikk
-- ============================================

UPDATE pois
SET editorial_hook = 'Norges nasjonalmuseum for pop og rock, huset i et ombygd kornsilo på Brattøra med den ikoniske «Top Box» på taket. Interaktive utstillinger lar deg spille gitar med Ronni Le Tekrø, prøve breakdance og DJ-ing, og vandre gjennom norsk musikkhistorie fra 1950-tallet til i dag.',
    local_insight = 'Start på 6. etasje og jobb deg nedover for kronologisk opplevelse — beregn 2-3 timer. Barn under 15 kommer gratis inn med betalende voksen. Rockheim Panorama på toppen har utsikt over fjorden og god kafé.'
WHERE name ILIKE '%Rockheim%'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');


-- ============================================
-- 3. RINGVE MUSIKKMUSEUM
-- ============================================

UPDATE pois
SET editorial_hook = 'Norges nasjonale museum for musikk og musikkinstrumenter, med samlinger fra hele verden — fra middelalderharper til Moog-synthesizere. Ligger på den historiske herregården Ringve Gård, omgitt av en vakker botanisk hage.',
    local_insight = 'Kombiner besøket med en tur i Ringve Botaniske Hage — den er gratis og åpen hele året. Guidede turer i museet inkluderer live-demonstrasjoner av instrumentene, noe som gjør opplevelsen langt mer levende enn vanlige museer.'
WHERE name ILIKE '%Ringve%'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');


-- ============================================
-- 4. ERKEBISPEGÅRDEN (Archbishop's Palace)
-- ============================================

UPDATE pois
SET editorial_hook = 'Skandinavias eldste verdslige bygning, med de eldste murene fra 1100-tallet. Huser tre museer, inkludert Riksregaliene — Norges kongekrone og kroningsobjekter på permanent utstilling i vesthvelvet siden 2006.',
    local_insight = 'Kjøp kombibilletten som dekker både Erkebispegården og Nidarosdomen — det sparer penger og lar deg se originalskulpturene fra katedralen som er flyttet innendørs for bevaring. Gårdsplassen er fritt tilgjengelig og verdt en stopp alene.'
WHERE name ILIKE '%Erkebispeg%'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');


-- ============================================
-- 5. NTNU VITENSKAPSMUSEET
-- ============================================

UPDATE pois
SET editorial_hook = 'Et av Norges eldste museer, grunnlagt i 1760 som Det Kongelige Norske Videnskabers Selskab. Samlingene spenner fra arkeologi og naturhistorie til kirkekunst, med høydepunkter som vikingfunn fra Trøndelag og den omfattende mineralsamlingen.',
    local_insight = 'Middelaldersalen med kirkekunst er et skjult høydepunkt som mange besøkende går forbi. Museet har også en kjent hvalsamling og et naturhistorisk diorama som barna elsker. Gratis inngang for barn under 16.'
WHERE name ILIKE '%Vitenskapsmuseet%'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');


-- ============================================
-- 6. RUSTKAMMERET (Military Museum)
-- ============================================

UPDATE pois
SET editorial_hook = 'Militærhistorisk museum i Erkebispegårdens vestfløy, med våpen og rustninger fra middelalderen til andre verdenskrig. Samlingen inkluderer sverd, hellebarder og kanoner som forteller historien om Trondheims strategiske rolle som forsvarsby.',
    local_insight = 'Inngangen er inkludert i kombibilletten med Erkebispegården og Nidarosdomen. Den gotiske hvelvsalen i kjelleren er atmosfærisk og perfekt for historie-entusiaster — og ofte overraskende rolig selv i høysesong.'
WHERE name ILIKE '%Rustkammer%'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');


-- ============================================
-- 7. TRONDHEIM KUNSTMUSEUM
-- ============================================

UPDATE pois
SET editorial_hook = 'Trondheims kunstmuseum med en samling norsk kunst fra 1850 til i dag, inkludert verker av Edvard Munch, Håkon Bleken og de store trøndermalerne. Bygningen fra 1845 ligger sentralt mellom Nidarosdomen og Kristiansten festning.',
    local_insight = 'Museet har ofte sterke gjesteutstillinger som ikke er like godt markedsført som den faste samlingen — sjekk programmet på forhånd. Onsdager har utvidet åpningstid og tidvis gratis inngang.'
WHERE name ILIKE '%Kunstmuseum%' AND name ILIKE '%Trondheim%'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');


-- ============================================
-- 8. NORDENFJELDSKE KUNSTINDUSTRIMUSEUM
-- ============================================

UPDATE pois
SET editorial_hook = 'Et av Norges mest undervurderte museer, med en imponerende samling dekorativ kunst og design fra renessansen til i dag. Høydepunktene inkluderer en sjelden japansk samling, jugendinteriøret og Hannah Ryggens verdenskjente tekstilkunst.',
    local_insight = 'Den japanske samlingen i toppetasjen er et skjult juvel — en av de beste i Nord-Europa. Museet administrerer også guidede turer i Stiftsgården om sommeren, så du kan kombinere begge.'
WHERE name ILIKE '%Nordenfjeldske%'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');


-- ============================================
-- 9. STIFTSGÅRDEN (Royal Residence)
-- ============================================

UPDATE pois
SET editorial_hook = 'Nord-Europas største trehus og Trondheims offisielle kongelige residens, bygget 1774-78 av forretningskvinnen Cecilie Christine Schøller. De 140 rommene har bevart mye av sin opprinnelige rokokko- og empirestil.',
    local_insight = 'Kun tilgjengelig via guidede turer, og kun om sommeren (juni-august). Bestill på forhånd i høysesong — turene fylles raskt. Fasaden langs Munkegata er fotogen hele året, selv når museet er stengt.'
WHERE name ILIKE '%Stiftsg%'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');


-- ============================================
-- 10. SVERRESBORG TRØNDELAG FOLKEMUSEUM
-- ============================================

UPDATE pois
SET editorial_hook = 'Norges tredje største friluftsmuseum, med over 80 historiske bygninger samlet fra hele Trøndelag. Høydepunktet er Haltdalen stavkirke fra 1170-tallet — den eneste bevarte østskandinaviske stavkirken av sitt slag, og en av Norges eldste trebygninger.',
    local_insight = 'Beregn minst 2-3 timer — området er stort og det er lett å bruke mer tid enn planlagt. Sommersesongen byr på levende historie med kostymer, håndverk og husdyr. Sverresborg kafé serverer tradisjonell trøndersk mat.'
WHERE name ILIKE '%Sverresborg%'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');


-- ============================================
-- 11. TRONDHEIM SJØFARTSMUSEUM (Maritime Museum)
-- ============================================

UPDATE pois
SET editorial_hook = 'Forteller historien om Trondheims tusenårige sjøfartstradisjon, fra vikingtid til moderne skipsfart. Museet forvalter også SDS Hansteen fra 1866 — Norges eldste bevarte dampskip, som tidvis seiler på Trondheimsfjorden om sommeren.',
    local_insight = 'Spør om SDS Hansteen-seilasene — de arrangeres uregelmessig om sommeren og er en unik opplevelse. Selve museumsbygningen er et av Trondheims eldste murhus, en gammel vaktbygning fra 1700-tallet.'
WHERE name ILIKE '%Sjøfart%'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');


-- ============================================
-- 12. JØDISK MUSEUM TRONDHEIM
-- ============================================

UPDATE pois
SET editorial_hook = 'Europas nordligste synagoge, i en bygning som huset Trondheims første jernbanestasjon fra 1864 før det jødiske samfunnet kjøpte og vigslet den som synagoge i 1925. Utstillingen formidler jødisk historie i Trøndelag — fra de første innvandrerne til Holocaust og gjenoppbyggingen.',
    local_insight = 'Et lite, men gripende museum som forteller en viktig del av norsk krigshistorie. Åpent begrensede timer — sjekk nettsiden før besøk. Bygningen brukes fortsatt aktivt til jødiske høytider og samlinger.'
WHERE name ILIKE '%Jødisk%'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');

-- Also match English name variant
UPDATE pois
SET editorial_hook = 'Europas nordligste synagoge, i en bygning som huset Trondheims første jernbanestasjon fra 1864 før det jødiske samfunnet kjøpte og vigslet den som synagoge i 1925. Utstillingen formidler jødisk historie i Trøndelag — fra de første innvandrerne til Holocaust og gjenoppbyggingen.',
    local_insight = 'Et lite, men gripende museum som forteller en viktig del av norsk krigshistorie. Åpent begrensede timer — sjekk nettsiden før besøk. Bygningen brukes fortsatt aktivt til jødiske høytider og samlinger.'
WHERE name ILIKE '%Jewish Museum%'
  AND area_id = (SELECT id FROM areas WHERE slug_no = 'trondheim');
