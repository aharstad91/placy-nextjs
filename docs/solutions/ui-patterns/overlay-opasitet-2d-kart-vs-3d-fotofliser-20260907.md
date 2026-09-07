---
name: Overlay-opasitet går motsatt vei i 2D-kart og 3D-fotofliser
description: Samme lyse fyll som er riktig over Mapbox' vektorkart blir grumsete brunt over Googles fotorealistiske fliser. Bakgrunnen er lys og tegnet i 2D, mørk og fotografert i 3D — så gjennomsiktighet er en gave i den ene motoren og et tap i den andre. Ett palettvalg, to ulike alfaverdier.
type: ui-pattern
problem_type: ui_bug
module: components/map
date: 2026-09-07
tags: [mapbox, google-3d-tiles, photorealistic, opasitet, alpha, massing, volumer, palett, kartmotor]
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
sale:    withAlpha(palette.fill, 0.94)
context: withAlpha(palette.contextFill, 0.90)
```

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
