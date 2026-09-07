---
name: Overlay-opasitet går motsatt vei i 2D-kart og 3D-fotofliser
description: Samme lyse fyll som er riktig over Mapbox' vektorkart blir grumsete brunt over Googles fotorealistiske fliser, fordi bakgrunnen er lys og tegnet i den ene motoren og mørk og fotografert i den andre. For ekstruderte volumer snur regelen igjen — der skyggelegger Google flatene selv, og lavere dekkevne gjør dem mørkere, ikke lysere.
type: ui-pattern
problem_type: ui_bug
module: components/map
date: 2026-09-07
tags: [mapbox, google-3d-tiles, photorealistic, opasitet, alpha, massing, volumer, palett, kartmotor, polygon3delement, skyggelegging, model3delement]
---

# Overlay-opasitet går motsatt vei i 2D-kart og 3D-fotofliser

## Symptom

Prosjektvolumene ble endret fra rosa til lyst fyll (`#f6e7dc`) på bestilling.
I Mapbox ble de akkurat som ønsket: lyse bokser med farget kontur, og
gatenettet under fortsatt lesbart. I Google Photorealistic 3D Tiles, med samme
farge og en alfa på 0,78, ble de **grumsete brune**. Ikke lyse i det hele tatt.

## Hvorfor

Bakgrunnen er ikke den samme type flate i de to motorene.

| | Mapbox (2D) | Google (3D) |
|---|---|---|
| Underlag | tegnet vektorkart, lyst og flatt | fotografi: gress, trekroner, skygge |
| Luminans under | høy og jevn | lav og svært ujevn |
| Hva gjennomsiktighet gir | kartet leses gjennom volumet | fotoets mørke og teksturen blør opp i fyllet |

Et lyst fyll over en lys, flat bakgrunn holder seg lyst uansett alfa. Det samme
fyllet over mørkt gress trekkes mot gresset — og fordi teksturen varierer, blir
hver flate ujevn i tillegg til mørk. Resultatet leser som skitten brun, ikke som
en lys boks.

Motsatt: i 2D er kartet under **verdt** å se. Gatenavn og kvartalsstruktur som
skinner gjennom er halve poenget med å tegne planlagte bygg oppå et kart.

## Løsning

Én palett, to alfaregimer. Fargen er en produktbeslutning og skal ikke gaffles;
dekkevnen er en motorbeslutning og må det.

```ts
// 2D — kartet under er verdt å se gjennom flatene
"fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.4, 0.88],  // salg
"fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.4, 0.82],  // kontekst

// 3D — fyllet må nesten dekke, ellers blir det grumsete brunt
sale:    withAlpha(palette.shellFill, 0.95)
context: withAlpha(palette.shellFill, 0.92)
```

Fargene er heller ikke de samme lenger: 3D fikk `shellFill`/`shellEdge` i rent
hvitt, fordi volumene der skal lese som en fysisk modell, ikke som karttegning.
Se seksjonen om ekstruderte volumer under for hvorfor det måtte bli *rent* hvitt.

Google-motoren tar bare CSS-farger, ikke Mapbox-paint, så palettens hex må
uansett gjennom en `withAlpha()`-funksjon på vei inn. Det er stedet å legge
forskjellen.

## Generalisering

Regelen er ikke «3D trenger høyere alfa», den er: **alfa er en funksjon av hva
som ligger under, ikke av laget du tegner**.

- Lyst fyll over mørkt underlag → nesten dekkende, ellers dør fargen.
- Mørkt fyll over lyst underlag → tåler mye gjennomsiktighet.
- Fotografisk underlag → teksturen blør gjennom i tillegg til luminansen, så
  terskelen ligger høyere enn ren luminansregning skulle tilsi.

Samme avveining gjelder ruter, sirkler for rekkevidde og alt annet vi tegner i
begge motorer. Deler man én alfaverdi mellom dem, er den nødvendigvis feil i én
av dem.

## Ekstruderte volumer: motoren skygger, og fargen din taper

Regelen over gjelder **flate** overlegg. Ekstruderte `gmp-polygon-3d` er et annet
dyr, og her tar intuisjonen feil.

Google skyggelegger sideflatene selv, etter hvilken vei de vender, og det lyset
kan ikke settes. Målt på ett og samme kamera, med rent hvitt og full dekning,
tegner motoren den samme flaten fra **122 til 247** i luminans. Hele spennet
mellom svart og hvitt er altså brukt opp av motorens eget lys før fargen din får
si noe. Et fyll som starter under hvitt blir bare gråere; over hvitt finnes ikke.

Og dekkevnen redder deg ikke:

| Dekkevne | Lyse flater | Mørke flater |
|---|---|---|
| 1,00 | 223 | 127 |
| 0,86 | 210 | 118 |
| 0,55 | 181 | 109 |

De mørke flatene lot seg nesten ikke lyse opp av å slippe det lyse gresset
gjennom — 127 mot 109 — mens de lyse flatene tapte 42. **Lav dekkevne gjorde
volumene jevnt over mørkere, ikke lysere**, selv om hver enkelt mørk flate ble
en anelse lysere. Det er motsatt av hva den flate regelen over skulle tilsi, og
grunnen er at skyggen ligger på materialet, ikke på komposisjonen.

To utveier ble prøvd og forkastet:

- **Droppe ekstruderingen** og bygge veggene som egne flate polygoner. En
  loddrett prøveflate landet på 128 — nøyaktig samme skyggelegging. Normalen
  avgjør, ikke `extruded`.
- **Snu vindingen** på omrisset, i håp om at toppflatens normal pekte ned.
  Ingen forskjell.

Vil man ha en jevnt hvit modell — den fysiske akrylmodellen på salgskontoret —
må volumene tegnes som `Model3DElement` med en glTF der materialet er
`KHR_materials_unlit`. Det er den eneste veien utenom motorens lys, og det er
en egen jobb.

## Fallgruve ved verifisering

HMR bytter ikke stil på allerede opprettede `gmp-polygon-3d`-elementer — de
lever like lenge som den persistente `Map3DElement`-instansen og muteres bare
ved dataendring. En stilendring i koden vises ikke før siden lastes på nytt.
Sjekk `fillColor` på et element før du konkluderer med at endringen ikke hjalp:

```js
document.querySelector('gmp-polygon-3d').fillColor
// "rgba(246, 231, 220, 0.78)"  <- fortsatt gammel verdi, HMR har ikke tatt
```

## Se også

- [plandokument-til-kartdata](../data-import/plandokument-til-kartdata-20260907.md)
  — hvor volumene og høydene deres kommer fra
- `docs/research/2026-09-07-wesselslokka-planregistrering.md`
