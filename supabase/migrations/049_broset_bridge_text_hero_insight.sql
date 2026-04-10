-- Migration 049: Update Brøset bridge texts to complement hero insight cards
--
-- The hero insight card now shows Tier 1 facts (school zone, nearest grocery, etc.)
-- Bridge texts are updated to provide mood, context, and Tier 2 POIs instead of
-- repeating the structured data already visible in the card.

UPDATE products
SET config = jsonb_set(
  config,
  '{reportConfig,themes}',
  '[
    {
      "id": "hverdagsliv",
      "bridgeText": "Hverdagstjenestene er samlet i gangavstand — Valentinlyst Senter med alt under ett tak, og flere alternativer langs Valentinlystveien. Det meste ordnes uten bil.",
      "extendedBridgeText": "Valentinlyst Senter samler dagligvare, apotek, post og butikker under ett tak — et naturlig stoppested på vei hjem. Videre langs Valentinlystveien ligger MENY Moholt med ferskvaredisk og parkeringsmuligheter for de større handlekurvene. For variasjon er Rema 1000 på Strindheim og Bunnpris på Eberg begge innen kort rekkevidde. Fem frisører finnes innen ti minutters gangavstand — fra Cowboys and Angels til Persaunet Hårsenter, som har holdt det gående i over førti år. Fastlege og legevakt ligger på Øya, rundt ti minutter med buss.",
      "categories": ["supermarket", "pharmacy", "convenience", "doctor", "dentist", "hospital", "haircare", "bank", "post_office"]
    },
    {
      "id": "barnefamilier",
      "bridgeText": "Et rolig og barnevennlig nabolag med lite gjennomgangstrafikk. Lekeplassene langs Brøsetveien er populære samlingspunkter, og idrettsanleggene gir rom for alt fra fotball til friidrett.",
      "extendedBridgeText": "Brøset-kretsen har aktivt FAU og variert SFO-tilbud for barna. Brøset barnehage er nærmest, men over tjue alternativer finnes innen kort avstand, både kommunale og private. Blussuvoll ungdomsskole ligger like ved for de eldre barna. Idrettsanleggene på Leangen og Blussuvoll har fotball, handball, svømming og friidrett — og lekeplassen i Ole Hogstads veg er to minutter fra døren. Et nabolag der barna kan gå til skolen på egenhånd og finne noe å gjøre etter skoletid.",
      "categories": ["skole", "barnehage", "lekeplass", "idrett"]
    },
    {
      "id": "mat-drikke",
      "bridgeText": "Moholt Allmenning har fått nye spisesteder de siste årene, og studentbyen tilfører kaféer og uformelle møteplasser. Sentrum med full restaurantbredde er et kvarter med buss.",
      "extendedBridgeText": "Matscenen rundt Brøset er i utvikling. Moholt Allmenning fungerer som voksende knutepunkt med nyåpnede steder i takt med studentbyens utbygging. Leangen har restauranter knyttet til handelsområdet, og Strindheim byr på både pizzeria og asiatiske kjøkken. Bakeri og kafé finnes innen fem til ti minutters sykkeltur. Sentrum — fra Bakklandet til Solsiden — er ti til femten minutter med buss, med hele Trondheims restaurantscene innen rekkevidde.",
      "categories": ["restaurant", "cafe", "bar", "bakery"]
    },
    {
      "id": "natur-friluftsliv",
      "bridgeText": "Naturen starter i enden av gaten — merkede stier, lysløype om vinteren og utsikt over byen. Leangenbekken gir et grønt drag gjennom nabolaget.",
      "extendedBridgeText": "Fra Brøset kan du gå rett inn i Estenstadmarka — et sammenhengende turområde med merkede stier, flere utsiktspunkter mot byen og fjorden, og lysløype for langrenn om vinteren. Leangenbekken renner gjennom nabolaget og gir en naturlig grønn korridor. Jonsvatnet — Trondheims drikkevannskilde og populære badespot — er en kort sykkeltur unna. Bymarka er tilgjengelig via sykkelsti gjennom Moholt. Et nabolag der du kan gå fra morgenkaffi til tursti uten å sette deg i bilen.",
      "categories": ["park", "outdoor", "badeplass"]
    },
    {
      "id": "transport",
      "bridgeText": "Hyppige avganger og kort vei til holdeplassene. Trondheim bysykkel på Moholt og Blussuvoll, og sykkelekspressen langs Klæbuveien tar deg til NTNU Gløshaugen på under ti minutter.",
      "extendedBridgeText": "Bussen går hvert tiende minutt i rushtid, og sentrum nås på tolv minutter. NTNU Gløshaugen ligger to kilometer unna — de fleste sykler dit på under ti minutter via sykkelekspressen langs Klæbuveien. Trondheim bysykkel har stasjoner på Moholt og Blussuvoll, og e-sykler gjør bakken fra sentrum overkommelig. For bil er det kort vei til E6 via Omkjøringsveien. Nye gang- og sykkelveier planlegges i forbindelse med utbyggingen på Brøset.",
      "categories": ["bus", "train", "tram", "bike", "parking", "carshare", "taxi", "charging_station"]
    },
    {
      "id": "trening-velvare",
      "bridgeText": "Varierte treningsmuligheter i gangavstand — fra styrkerom til klatrevegg, svømmebasseng og utendørs treningsapparater. Estenstadmarka har lysløype for de som foretrekker frisk luft.",
      "extendedBridgeText": "Treningsmulighetene er et av nabolagets sterkeste kort. Fresh Fitness på Valentinlyst er et rimelig alternativ med lang åpningstid. Blussuvollhallen har svømmebasseng, og Grip klatresenter på Leangen er populært for alle aldre. For utendørs trening har Estenstadmarka apparater langs stiene, og lysløypa er populær for langrenn om vinteren. Leangen idrettsanlegg har friidrettsbane, fotballbaner og tennisbaner tilgjengelige for publikum.",
      "categories": ["gym", "swimming", "spa", "fitness_park"]
    }
  ]'::jsonb
)
WHERE id = '16fd0346-28e3-473d-85a8-2b3904b10488';
