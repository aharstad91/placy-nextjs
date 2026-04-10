-- Migration 051: Transport & Mobilitet — split narrativ i upperNarrative/lowerNarrative
--
-- Deler den eksisterende enkelt-teksten i to posisjonelle felt:
--   upperNarrative: over live-kortene (buss, bysykkel, sparkesykkel)
--   lowerNarrative: under live-kortene (bil, bildeling, elbillading, tog, flybuss)
--
-- Bridge text oppdateres til generisk kategori-intro (uten sub-kategori-spesifisitet).
-- extendedBridgeText beholdes for bakoverkompatibilitet.
--
-- Produkt: Wesselsløkka (broset-utvikling-as)
-- Transport-tema er index [5] i reportConfig.themes-arrayen.

UPDATE products
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(config,
      '{reportConfig,themes,5,bridgeText}',
      '"Brøset er godt koblet — hverdagsmobilitet på gangavstand og regional tilgjengelighet innen kort rekkevidde."'::jsonb
    ),
    '{reportConfig,themes,5,upperNarrative}',
    '"Brøset Hageby holdeplass er rett utenfor — linje 12 og 113 gir direkteavganger mot Strindheimsentrum og Dragvoll. Trondheim Bysykkel har to stasjoner innen gangavstand: Valentinlyst og Kong Øysteins veg dekker begge retninger langs Valentinlystveien. Sparkesykler fra Ryde, VOI og Dott er spredt i nabolaget for korte, fleksible hopp."'::jsonb
  ),
  '{reportConfig,themes,5,lowerNarrative}',
  '"For bil er Nyhavnavveien en rask vei mot E6 og videre sørover. Hyre og Getaround tilbyr bildeling uten binding — begge er tilgjengelige i nabolaget. Fire elbilladere finnes innen ti minutters gange. Leangen stasjon nås med kort sykkeltur og har regiontog mot Stjørdal og Steinkjer."'::jsonb
)
WHERE id = 'c87b51f6-9cf7-4738-b452-cbea0bb62c65';
