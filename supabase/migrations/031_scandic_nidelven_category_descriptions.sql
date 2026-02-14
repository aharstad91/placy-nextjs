-- ============================================
-- 031: Scandic Nidelven — category descriptions + longer bridgeText
-- Adds curator-style nabolagskarakter descriptions for all sub-categories
-- and doubles the length of theme-level bridgeText.
-- Writing approach: neighborhood character + 1-2 anchor endpoints.
-- No stats in text (UI shows count/rating/reviews separately).
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
      "bridgeText": "Matscenen spenner fra Britannia-kvartalets fine dining til Bakklandets trehuskaféer — et uformelt og variert nabolag der sidegatene byr på like mye som hovedgatene. Solsiden har blitt et naturlig tyngdepunkt med restauranter langs bryggekanten, mens Fjordgata og Jomfrugata har utviklet seg til et alternativt matstrøk med håndverksbakerier, vinbarer og kafeer drevet av lokale gründere.",
      "categories": ["restaurant", "cafe", "bar", "bakery"],
      "categoryDescriptions": {
        "restaurant": "Restaurantscenen rundt Nedre Elvehavn strekker seg fra det etablerte finedining-segmentet i Britannia-kvartalet til en nyere bølge av uformelle neobistrøer og asiatiske kjøkken i Fjordgata-strøket. Det er kort avstand mellom Michelin-anbefalte adresser og enklere hverdagsrestauranter — nabolaget har begge deler uten at det ene dominerer det andre.",
        "cafe": "Kafékulturen i området er formet av den korte avstanden mellom Bakklandet og Solsiden — to strøk med helt ulik karakter som til sammen gir et bredt spekter. Bakklandet har de eldre, stedbundne kaféene i trehus langs Nidelva, mens Solsiden og Midtbyen har nyere konsepter med spesialkaffe og sosialt entreprenørskap.",
        "bar": "Barscenen rundt hotellet fordeler seg i to retninger: de etablerte stedene i Brattørgata og Nedre Elvehavn med cocktails og vinbarer, og det mer undergrunns-pregede strøket i Fjordgata med rockebarer og upretensiøse nabolagssteder. Området har overraskende bredde — fra naturvin og jazz til brettspill og metalkonserter.",
        "bakery": "Bakerilandskapet har endret seg merkbart de siste årene, med en ny generasjon håndverksbakerier som har etablert seg i sidegatene rundt sentrum. Europeisk surdeigsbrød, italienske focaccia og norske tradisjonsbakerier med over hundre års historie finnes alle i gangavstand fra hotellet."
      }
    },
    {
      "id": "kultur-opplevelser",
      "icon": "Landmark",
      "name": "Kultur & Opplevelser",
      "bridgeText": "Området har en kulturakse fra Rockheims kornsilo på Brattøra til de eldre galleriene mot sentrum — med parker langs Nidelva og kinosaler i Olavshallen innimellom. Det er et nabolag der nasjonale institusjoner ligger vegg i vegg med små gallerier og uavhengige kulturscener, og der havnepromenaden og elveparken gir rom mellom inntrykkene.",
      "categories": ["museum", "library", "cinema", "park"],
      "categoryDescriptions": {
        "museum": "Museumstilbudet i gangavstand spenner fra nasjonale institusjoner som Rockheim og NTNU Vitenskapsmuseet til mindre gallerier og kulturhistoriske bygninger. Erkebispegården fra 1160 og Jødisk Museum i Europas nordligste synagoge gir historisk dybde, mens Kunsthall Trondheim og Trondhjems Kunstforening viser samtidskunst og skiftende utstillinger.",
        "library": "Trondheim hovedbibliotek ved Peter Egges Plass er sammensatt av tre bygninger — det gamle rådhuset, Lorck-gården og Cicignons plass — og fungerer som et stille sentrum midt i byen. Gunnerus-biblioteket, Norges eldste vitenskapelige bibliotek fra 1768, ligger like ved og er åpent for alle.",
        "cinema": "Kinotilbudet deler seg mellom det kommersielle og det kuraterte: Nova på Solsiden har byens største sal med Dolby Atmos, mens Cinemateket i Olavshallen viser smalere film på 35mm-projektor. Prinsen kinosenter i Prinsens gate har vist film siden 1918 og gir et historisk bakteppe.",
        "park": "Parkene og uterommene rundt hotellet følger Nidelva og havnelinjen — fra Dokkparken rett utenfor til Bybroplassen med utsikt over Bakklandet og Gamle Bybro. Det er et nabolag der du kan gå langs vannet i begge retninger, med skulpturer, minnesmerker og sesongbaserte aktiviteter som skøytebane på Solsiden om vinteren."
      }
    },
    {
      "id": "hverdagsbehov",
      "icon": "ShoppingCart",
      "name": "Hverdagsbehov",
      "bridgeText": "Sentrumshandelen fordeler seg mellom Byhaven og Trondheim Torg, med spesialbutikker langs Dronningens gate — de fleste hverdagsbehov løses til fots fra hotellet. Solsiden har det nærmeste dagligvaretilbudet med MENY og Extra, mens Dronningens gate og Olav Tryggvasons gate dekker alt fra apotek og frisører til spesialforretninger med importvarer.",
      "categories": ["supermarket", "pharmacy", "shopping", "haircare"],
      "categoryDescriptions": {
        "supermarket": "Dagligvaretilbudet dekkes av flere butikker i ulik størrelse og profil innenfor kort gangavstand. MENY Solsiden er nærmest og har det bredeste sortimentet, mens Extra-butikkene i Kongens gate og på Rosenborg dekker det daglige grunnbehovet til lavere priser.",
        "shopping": "Handelen i området er konsentrert rundt to kjøpesentre — Byhaven i Olav Tryggvasons gate og Trondheim Torg på byens hovedtorg — som til sammen rommer over hundre butikker. Mellom dem ligger Mercurgården fra 1863 med nisjebutikker og interiør i en historisk ramme.",
        "pharmacy": "Apotek og helsetjenester er tilgjengelige i gangavstand via kjøpesentrene og gatene rundt. Dekningen er god nok til at det sjelden er mer enn fem minutters gange til nærmeste apotek fra hotellet.",
        "haircare": "Frisører og velværetjenester finnes spredt i sentrumsgatene og inne i kjøpesentrene — fra moderne salonger til mer etablerte frisører med lang fartstid i Midtbyen."
      }
    },
    {
      "id": "transport",
      "icon": "Bus",
      "name": "Transport & Mobilitet",
      "bridgeText": "Nedre Elvehavn er godt tilknyttet — bysykkel og buss rett utenfor, og gangavstand til Trondheim S langs Brattørkaia. Området ligger sentralt nok til at de fleste daglige gjøremål kan løses til fots, men for lengre turer gir busstilbudet og togstasjonen god dekning mot resten av byen og regionen.",
      "categories": ["bus", "train", "tram", "bike", "parking", "carshare", "taxi", "airport"],
      "categoryDescriptions": {
        "bus": "Bussholdeplassene i området gir god dekning mot de fleste bydeler og knutepunkter. Pirbadet og Olav Tryggvasons gate er de nærmeste holdeplassene, med avganger mot både sentrum, Lade, Byåsen og sørover mot Tiller og Heimdal.",
        "train": "Trondheim S ligger langs Brattørkaia i gangavstand fra hotellet, med tog mot Oslo, Bodø og regiontogene i Trøndelag. Stasjonen er også knutepunkt for Værnes-ekspressen til flyplassen.",
        "bike": "Trondheim Bysykkel har flere stasjoner i nærområdet — Dokkparken rett utenfor hotellet er den nærmeste. Bysykkelen dekker sentrum og nærområdene og er et praktisk alternativ for kortere turer langs Nidelva og havnepromenaden.",
        "tram": "Gråkallbanen — verdens nordligste tramway — har endestopp på St. Olavs gate i sentrum og går opp til Lian i Bymarka. Holdeplassen ligger i gangavstand og gir tilgang til friluftsområdene vest for byen.",
        "parking": "Parkeringsmulighetene i området inkluderer både parkeringshus og gateparkering. Solsiden P-hus og Midtbyen P-hus er de nærmeste alternativene for de som ankommer med bil.",
        "taxi": "Taxiholdeplasser finnes ved Trondheim S og i sentrumsgatene. Trøndertaxi og Norgestaxi opererer begge i området.",
        "carshare": "Bildeleordninger som Bilkollektivet har biler plassert i sentrum for de som trenger bil til enkelturer uten å eie.",
        "airport": "Trondheim Lufthavn Værnes ligger 35 minutter unna med Værnes-ekspressen fra Trondheim S, eller 30 minutter med bil via E6."
      }
    },
    {
      "id": "trening-velvare",
      "icon": "Dumbbell",
      "name": "Trening & Velvære",
      "bridgeText": "Treningstilbudet strekker seg fra fullskala kjeder i Midtbyen til nisjestudioer for yoga og kampsport på Bakklandet — bredere enn forventet for et sentrumsområde. Nabolaget har alt fra døgnåpne treningssentre og gruppetimer til roligere alternativer som pilates, yoga og massasje, fordelt mellom Midtbyen og de mer tilbaketrukne gatene på Bakklandet og Rosenborg.",
      "categories": ["gym", "spa"],
      "categoryDescriptions": {
        "gym": "Treningssentrene i området dekker et bredt spekter — fra store kjedegym med fullt utstyr og gruppetimer til spesialiserte studioer for kampsport, pole, pilates og yoga. Midtbyen har de mest tilgjengelige alternativene, mens Bakklandet og Rosenborg har roligere studioer med en annen karakter.",
        "spa": "Velværetilbudet i nabolaget inkluderer alt fra massasje og behandlinger til mer holistiske tilnærminger. Det er et supplement til treningssentrene — en roligere motpol for de som vil kombinere trening med restitusjon."
      }
    }
  ]'::jsonb
)
WHERE id = '6e8216b1-b17f-41e5-8c00-5b740cac9452';
