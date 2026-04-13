-- Migration 063: Wesselsløkka bridgeText — expand with one more sentence per theme
--
-- Adds one supporting sentence to each theme's bridgeText to give the Apple-style
-- composition more weight. Pattern preserved: **confident claim** → detail → context.
--
-- Produkt: Wesselsløkka (broset-utvikling-as)
-- Theme order in reportConfig.themes:
--   [0] hverdagsliv
--   [1] barn-oppvekst
--   [2] mat-drikke
--   [3] opplevelser
--   [4] natur-friluftsliv
--   [5] transport
--   [6] trening-aktivitet

UPDATE products
SET config =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(config,
                '{reportConfig,themes,0,bridgeText}',
                '"**Valentinlyst Senter samler det meste under ett tak.** Dagligvare, apotek og frisør, alt i gangavstand fra Wesselsløkka. Sentrum og Strindheim er få minutter unna når hverdagen krever mer."'::jsonb
              ),
              '{reportConfig,themes,1,bridgeText}',
              '"**Et naturlig valg for barnefamilier.** Trygge skoleveier, nærhet til lekeplasser og et bredt idrettstilbud. Brøset er planlagt som et grønt, bilredusert nabolag der barn kan bevege seg fritt mellom skole, venner og aktiviteter."'::jsonb
            ),
            '{reportConfig,themes,2,bridgeText}',
            '"**Valentinlyst og Tyholttårnet er matnabolag i gangavstand.** Fyr og VYDA for burger og vietnamesisk, Il Fornaio for italiensk med utsikt. Solsiden og sentrum ligger innen kort reise når anledningen ber om noe spesielt."'::jsonb
          ),
          '{reportConfig,themes,3,bridgeText}',
          '"**Nabolagets kulturhus ligger på Moholt.** Trondheim folkebibliotek tilbyr aktiviteter for alle aldersgrupper. Sentrum er aldri langt unna — scener, kinoer og museer innen kort reise."'::jsonb
        ),
        '{reportConfig,themes,4,bridgeText}',
        '"**Bygget rundt grøntarealene, ikke ved siden av dem.** Over halvparten av Brøset er park og nær-natur. Stinettet kobler nabolaget til større turområder — turen starter ved inngangsdøren."'::jsonb
      ),
      '{reportConfig,themes,5,bridgeText}',
      '"**Brøset er godt koblet.** Hverdagsmobilitet på gangavstand og regional tilgjengelighet innen kort rekkevidde. Buss, bysykkel og bildeling gjør bilen til et valg — ikke en nødvendighet."'::jsonb
    ),
    '{reportConfig,themes,6,bridgeText}',
    '"**Fem treningssentre innen gangavstand.** Fra budsjett til kampkunst — lett å finne riktig tilbud. Svømmehaller og flerbrukshaller i kort avstand åpner for mer spesialisert aktivitet."'::jsonb
  )
WHERE id = 'c87b51f6-9cf7-4738-b452-cbea0bb62c65';
