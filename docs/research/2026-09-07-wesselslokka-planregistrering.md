# Wesselsløkka: felles plangrunnlag for 2D og 3D

Omfang: A1, A2 og B, samt den lokale delen av kollektivgata sør for byggene.
Resten av Brøset er fortsatt utenfor prototypen.

## Grunnlag og innpassing

Brukerens 1600 × 1000 situasjonsplan med Wesselsløkka-logo og rosa A1/A2/B
er kilde for avtegningen. Den større Brøset-planen viser et annet utsnitt og
brukes som kontekst; pikselkoordinater fra de to planene blandes ikke.

Tre visuelt avleste holdepunkter gir én affin transformasjon:

| Holdepunkt | Piksel x/y i planen | Lengdegrad / breddegrad |
| --- | --- | --- |
| Brøsetvegen / Sigurd Munns veg | 111 / 768 | 10.4496894971 / 63.4218342068 |
| Brøsetvegen ved nordspissen av feltet | 858 / 54 | 10.4567706734 / 63.4244368447 |
| Rundkjøring Tungasletta | 1350 / 770 | 10.4607323086 / 63.4215660552 |

Kartgrunnlag: Mapbox satellite-streets-v12, nord opp, senter 10.455 / 63.4229,
zoom 15.5, 1200 × 1000 logiske piksler. Holdepunktene ble avlest ved
henholdsvis (250, 657), (716.7, 273.6), (977.8, 696.5).
Planen ble lagt halvtransparent over satellittbildet for visuell kontroll av
veikanten og feltets utstrekning. Mellomsvingen i Brøsetvegen er en ekstra
kontroll utenfor de tre punktene som transformasjonen er tilpasset til.

Dette er bildebasert innpassing, ikke en oppmåling. Nordspissen er et svakere
holdepunkt enn veikrysset og rundkjøringen. Antall desimaler bevarer beregningen,
men sier ikke noe om nøyaktigheten. Høydene står fortsatt på anslåtte 14 meter.

## Implementasjon

`lib/map/wesselslokka-site-plan.ts` bevarer avtegnede hjørner i kildebildets
pikselrom og transformerer bygg og vei sammen. Adressepunktet flyttes ikke.
Byggenes hovedomriss er forenklet; balkonger og små innhakk er utelatt.
Veipolygonet beskriver den lokale planlagte korridoren, uten detaljert
kjørefelt-, fortau- eller sykkelveioppdeling. Det påvirker ikke ruteberegning.

Mapbox viser fire GeoJSON-polygoner med separate filtre for bygg og vei.
Google bruker tre ekstruderte, halvtransparente polygoner og ett flatt,
terrengfestet veipolygon. Ingen bildefiler eller modeller lastes i produktet.

Akseptanse: samme grunnriss i begge motorer, vei sør for A1/A2 med forbindelse
til Brøsetvegen, tre bygg, og ingen dupliserte elementer ved motorbytte.
