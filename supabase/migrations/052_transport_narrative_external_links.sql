-- Migration 052: Transport — ekstern lenking i narrativtekster
--
-- Legger til markdown-lenker [tekst](url) i upperNarrative og lowerNarrative
-- for Wesselsløkka. Rendereren støtter nå [text](url) → <a target="_blank">.
--
-- Endringer:
--   upperNarrative: Trondheim Bysykkel, Ryde, VOI, Dott → lenket
--   lowerNarrative: Hyre, Getaround → lenket; "elbilladere" → "ladestasjoner"

UPDATE products
SET config = jsonb_set(
  jsonb_set(config,
    '{reportConfig,themes,5,upperNarrative}',
    '"[Brøset Hageby holdeplass](https://entur.no/kart/stoppested?id=NSR:StopPlace:43929) er rett utenfor — [linje 12 og 113 (nattbuss)](https://www.google.com/search?udm=50&q=linje+12+og+113+Br%C3%B8set+Hageby+holdeplass+Trondheim+ruter+reisetid+destinasjoner+avganger) gir direkteavganger mot Strindheimsentrum og Dragvoll. [Trondheim Bysykkel](https://trondheimbysykkel.no) har to stasjoner innen gangavstand: Valentinlyst og Kong Øysteins veg dekker begge retninger langs Valentinlystveien. Sparkesykler fra [Ryde](https://www.ryde-technology.com), [VOI](https://www.voi.com) og [Dott](https://ridedott.com) er spredt i nabolaget for korte, fleksible hopp."'::jsonb
  ),
  '{reportConfig,themes,5,lowerNarrative}',
  '"For bil er Nyhavnavveien en rask vei mot E6 og videre sørover. [Hyre](https://www.hyre.no) og [Getaround](https://www.getaround.com) tilbyr bildeling uten binding — begge er tilgjengelige i nabolaget. Nærmeste ladestasjon er Kople Valentinlyst senter. Leangen stasjon nås med kort sykkeltur og har [regiontog til Værnes og Steinkjer](https://www.google.com/search?udm=50&q=regiontog+Leangen+stasjon+Trondheim+Stj%C3%B8rdal+Steinkjer+flyplass+Trondheim+Lufthavn+V%C3%A6rnes+rutetider+avganger)."'::jsonb
)
WHERE id = 'c87b51f6-9cf7-4738-b452-cbea0bb62c65';
