-- Migration 062: Wesselsløkka bridgeText — Apple-style two-tone typography
--
-- Rewrites each theme's bridgeText with **markdown bold** markup around the
-- emphasized opening statement. ReportThemeSection renders **phrase** as
-- darker/weighted text while surrounding text is softer — creating the
-- "confident claim + supporting detail" rhythm from Apple product pages.
--
-- Pattern: open with short confident claim (wrapped in **...**), follow with
-- specific supporting detail (plain, softer).
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
                '"**Valentinlyst Senter samler det meste under ett tak.** Dagligvare, apotek og frisør, alt i gangavstand fra Wesselsløkka."'::jsonb
              ),
              '{reportConfig,themes,1,bridgeText}',
              '"**Et naturlig valg for barnefamilier.** Trygge skoleveier, nærhet til lekeplasser og et bredt idrettstilbud."'::jsonb
            ),
            '{reportConfig,themes,2,bridgeText}',
            '"**Valentinlyst og Tyholttårnet er matnabolag i gangavstand.** Fyr og VYDA for burger og vietnamesisk, Il Fornaio for italiensk med utsikt."'::jsonb
          ),
          '{reportConfig,themes,3,bridgeText}',
          '"**Nabolagets kulturhus ligger på Moholt.** Trondheim folkebibliotek tilbyr aktiviteter for alle aldersgrupper."'::jsonb
        ),
        '{reportConfig,themes,4,bridgeText}',
        '"**Bygget rundt grøntarealene, ikke ved siden av dem.** Over halvparten av Brøset er park og nær-natur."'::jsonb
      ),
      '{reportConfig,themes,5,bridgeText}',
      '"**Brøset er godt koblet.** Hverdagsmobilitet på gangavstand og regional tilgjengelighet innen kort rekkevidde."'::jsonb
    ),
    '{reportConfig,themes,6,bridgeText}',
    '"**Fem treningssentre innen gangavstand.** Fra budsjett til kampkunst — lett å finne riktig tilbud."'::jsonb
  )
WHERE id = 'c87b51f6-9cf7-4738-b452-cbea0bb62c65';
