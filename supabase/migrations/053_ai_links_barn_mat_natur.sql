-- Migration 053: AI-lenker i narrativtekster — Barn, Mat & Drikke, Natur
--
-- Legger til Google AI søk-lenker [tekst](google.com/search?udm=50&q=...)
-- i extendedBridgeText for tre temaer:
--
-- [1] barnefamilier: Skolekrets-søk (barneskole + ungdomsskole + VGS)
-- [2] mat-drikke: Bakklandet til Solsiden restaurantscene
-- [3] natur-friluftsliv: Estenstadmarka + Jonsvatnet
--
-- Produkt: Wesselsløkka (broset-utvikling-as)
-- Theme-indekser: barnefamilier=1, mat-drikke=2, natur-friluftsliv=3

-- Barn & Aktivitet (index 1) — skolekrets AI-søk
UPDATE products
SET config = jsonb_set(config,
  '{reportConfig,themes,1,extendedBridgeText}',
  '"Brøset-kretsen har aktivt FAU og variert SFO-tilbud for barna. Brøset barnehage er nærmest, men over tjue alternativer finnes innen kort avstand, både kommunale og private. Blussuvoll ungdomsskole ligger like ved for de eldre barna. [Skolekretsen dekker barneskole, ungdomsskole og videregående](https://www.google.com/search?udm=50&q=skolekrets+Br%C3%B8set+Trondheim+barneskole+ungdomsskole+videreg%C3%A5ende+Blussuvoll+Strindheim+Charlottenlund+opptaksomr%C3%A5de) — og det skjer mye i området med ny utbygging. Idrettsanleggene på Leangen og Blussuvoll har fotball, handball, svømming og friidrett — og lekeplassen i Ole Hogstads veg er to minutter fra døren. Et nabolag der barna kan gå til skolen på egenhånd og finne noe å gjøre etter skoletid."'::jsonb
)
WHERE id = 'c87b51f6-9cf7-4738-b452-cbea0bb62c65';

-- Mat & Drikke (index 2) — Bakklandet til Solsiden
UPDATE products
SET config = jsonb_set(config,
  '{reportConfig,themes,2,extendedBridgeText}',
  '"Matscenen rundt Brøset er i utvikling. Moholt Allmenning fungerer som voksende knutepunkt med nyåpnede steder i takt med studentbyens utbygging. Leangen har restauranter knyttet til handelsområdet, og Strindheim byr på både pizzeria og asiatiske kjøkken. Bakeri og kafé finnes innen fem til ti minutters sykkeltur. Sentrum — fra [Bakklandet til Solsiden](https://www.google.com/search?udm=50&q=beste+restauranter+Bakklandet+Solsiden+Trondheim+kafeer+spisesteder+anbefalinger) — er ti til femten minutter med buss, med hele Trondheims restaurantscene innen rekkevidde."'::jsonb
)
WHERE id = 'c87b51f6-9cf7-4738-b452-cbea0bb62c65';

-- Natur & Friluftsliv (index 3) — Estenstadmarka + Jonsvatnet
UPDATE products
SET config = jsonb_set(config,
  '{reportConfig,themes,3,extendedBridgeText}',
  '"Fra Brøset kan du gå rett inn i [Estenstadmarka](https://www.google.com/search?udm=50&q=Estenstadmarka+Trondheim+tursti+kart+l%C3%B8yper+utsiktspunkt+lysl%C3%B8ype+langrenn+tur) — et sammenhengende turområde med merkede stier, flere utsiktspunkter mot byen og fjorden, og lysløype for langrenn om vinteren. Leangenbekken renner gjennom nabolaget og gir en naturlig grønn korridor. [Jonsvatnet](https://www.google.com/search?udm=50&q=Jonsvatnet+Trondheim+bading+badeplasser+rundtur+tursti+sykkeltur+friluftsliv) — Trondheims drikkevannskilde og populære badespot — er en kort sykkeltur unna. Bymarka er tilgjengelig via sykkelsti gjennom Moholt. Et nabolag der du kan gå fra morgenkaffi til tursti uten å sette deg i bilen."'::jsonb
)
WHERE id = 'c87b51f6-9cf7-4738-b452-cbea0bb62c65';
