-- Migration 054: Fix AI-lenker — Estenstadmarka/Jonsvatnet havnet på feil tema
--
-- 053 brukte gammel indeksering (natur=3). Riktig er:
--   [3] opplevelser
--   [4] natur-friluftsliv
--
-- Denne migrasjonen:
--   1. Gjenoppretter opplevelser (index 3) til original tekst
--   2. Legger AI-lenker inn i natur-friluftsliv (index 4)

-- Gjenopprett opplevelser (index 3) — fjern feilaktig natur-tekst
UPDATE products
SET config = jsonb_set(config,
  '{reportConfig,themes,3,extendedBridgeText}',
  '"Trondheim Folkebibliotek på Moholt er nabolagets nærmeste kulturarena — med arrangementer, lesesal og barne­avdeling. Trondheim Kino på Prinsen har et av byens bredeste kinotilbud, og NTNU Vitenskapsmuseet gir gratis inngang for barn under 16. Rockheim og Pirbadet ligger begge på Brattøra, enkelt tilgjengelig med buss. For familier med barn er Trondheim Aktivitetspark og Leo''s Lekeland populære alternativer i regnværsdager."'::jsonb
)
WHERE id = 'c87b51f6-9cf7-4738-b452-cbea0bb62c65';

-- Legg AI-lenker på natur-friluftsliv (index 4) — behold eksisterende tekst, legg til lenker der det passer
UPDATE products
SET config = jsonb_set(config,
  '{reportConfig,themes,4,extendedBridgeText}',
  '"Brøset Hundepark ligger to minutters gange fra Wesselsløkka og er nabolagets uformelle møteplass. Spruten, friområdet mellom Persaunet og Tyholt, byr på akebakke om vinteren og utsikt hele året. Kantennelunden er en rolig parkperle med gamle trær, mens Gressletta og Strinda Hageby park gir plass til ballspill og piknik. [Estenstadmarka](https://www.google.com/search?udm=50&q=Estenstadmarka+Trondheim+tursti+kart+l%C3%B8yper+utsiktspunkt+lysl%C3%B8ype+langrenn+tur) nås rett fra nabolaget med merkede stier og utsiktspunkter. [Jonsvatnet](https://www.google.com/search?udm=50&q=Jonsvatnet+Trondheim+bading+badeplasser+rundtur+tursti+sykkeltur+friluftsliv) — Trondheims drikkevannskilde og populære badespot — er en kort sykkeltur unna."'::jsonb
)
WHERE id = 'c87b51f6-9cf7-4738-b452-cbea0bb62c65';
