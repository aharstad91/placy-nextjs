# Wesselsløkka: felles plangrunnlag for 2D og 3D

Omfang: A1, A2 og B — de tre byggene salgsmaterialet merker i rosa.
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

## Stadfesting mot uavhengige kilder (2026-09-07)

Innpassingen var i utgangspunktet kontrollert mot samme satellittbilde som den
ble avlest fra, altså mot seg selv. Den er nå kontrollert mot to kilder som
ikke er bildet:

1. **Brøsetjordet.** Planens søndre kollektivgate faller sammen med veien slik
   OpenStreetMap tegner den (way 1502590316). Tre punkter langs den ligger
   4–11 m fra OSMs senterlinje. Det er innenfor det en bildeinnpassing kan
   love, og det binder både skala og rotasjon.
2. **OSMs egen plassholder for prosjektet** (way 1502590318,
   `building=construction` + `construction=apartments`, merket
   «very approximate position / size»). A1/A2/B lander oppå den, ~10 m fra
   dens tyngdepunkt. En helt annen kartlegger har altså plassert prosjektet
   samme sted.

Begge er kodet som `WESSELSLOKKA_REGISTRATION_CHECKS` og testet. De inngår
ikke i tilpasningen, så de faller hvis noen flytter et holdepunkt.

**Adressepunktet er ikke fasit.** Prosjektets registrerte senter
(10.450617 / 63.422074) ligger på Brøsetvegen, ~100 m nordvest for byggene.
At volumene tegnes et stykke fra pinnen er riktig, ikke en feil: pinnen er
adressen, byggene står inne på jordet. Rosa logo-pin i situasjonsplanen er
dekor i logobåndet og har ingen posisjonsbetydning.

Dette er fortsatt bildebasert innpassing, ikke en oppmåling. Nordspissen er et
svakere holdepunkt enn veikrysset og rundkjøringen. Antall desimaler bevarer
beregningen, men sier ikke noe om nøyaktigheten. Høydene står på anslåtte
14 meter.

## Kollektivgata er tatt ut

Den avtegnede veien lå innenfor ~10 m av Brøsetjordet, altså oppå en vei
begge kartmotorene allerede tegner selv. Resultatet var en dobbel vei: et
beige belte forskjøvet fra den ekte streken. Veipolygonet er slettet fra både
data og de to lagene. Planens «Kollektivgata» er i praksis en oppgradering av
Brøsetjordet, og den forteller ikke leseren noe nytt.

## Implementasjon

`lib/map/wesselslokka-site-plan.ts` bevarer avtegnede hjørner i kildebildets
pikselrom. Adressepunktet flyttes ikke. Byggenes hovedomriss er forenklet;
balkonger og små innhakk er utelatt.

Fargene kommer fra salgsmaterialet: flatene i planens rosa (`#e79bbc`),
konturen i logoens mørkere rosa (`#a8386a`). Omrisset i kartet skal leses som
«dette er byggene i planen du nettopp så».

**Mapbox (2D):** tre GeoJSON-polygoner med fyll, kontur og bokstav (A1/A2/B).
Volumene toner inn med zoom — usynlige på boardets åpningszoom (~13,5), fulle
fra 15,4, bokstavene fra 15,5. Grunnen er at hele feltet er noen få piksler
bredt i oversikten: der er prosjektet pinnen, ikke tre omriss som krangler med
den.

**Google (3D):** samme tre polygoner, ekstrudert og halvtransparente, i samme
palett omgjort til rgba. Ingen bildefiler eller modeller lastes i produktet.

Akseptanse: samme grunnriss i begge motorer, tre bygg, ingen dupliserte
elementer ved motorbytte, og ingen tegnet vei oppå en ekte vei.
