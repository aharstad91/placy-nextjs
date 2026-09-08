---
name: Rydde tomta i fotoflisene under planlagte volumer (gmp-flattener)
description: Googles fotorealistiske fliser bærer dagens trær og dagens hus. Tegner man et planlagt prosjekt oppå, stikker skogen opp gjennom volumene og planen blir uleselig. FlattenerElement stryker alt som reiser seg innenfor et omriss og lar terrenget stå — én linje kode i stedet for et plint- eller Cesium-bytte.
type: ui-pattern
problem_type: ui_bug
module: components/map
date: 2026-09-08
tags: [google-3d-tiles, photorealistic, gmp-flattener, flattenerelement, maps3d, massing, volumer, kartmotor, trær]
---

# Rydde tomta i fotoflisene under planlagte volumer

## Symptom

Prosjektvolumene for Wesselsløkka ble tegnet som hvite skall oppå Google
Photorealistic 3D Tiles. Flisene er et fotogrammetri-mesh av dagens Brøset:
trærne i parkdraget, hekkene, låven og husene som skal rives står der fortsatt.
Trekronene er 10–20 m og altså på høyde med tre- og fireetasjes volumer, så de
stakk opp gjennom og foran byggene. Femti hvite bokser i en skog leser ikke som
en plan.

## Hva som *ikke* virker

Alle de nærliggende grepene er blindveier, og det er verdt å skrive ned hvorfor:

- **Høyere dekkevne på volumene.** Treet står *foran* bygget i dybde, ikke bak.
  Ingen alfa hjelper mot et mesh som er nærmere kameraet.
- **Ekstrudere grunnflaten opp til kronehøyde.** Da svelger platen byggene også —
  et treetasjes volum er lavere enn trærne rundt.
- **Løfte hele modellen opp på en plint over kronene.** Fungerer optisk, men
  legger feltet 15 m over nabolaget. Det leser som en svevende bydel, ikke som
  en modell i sitt eget terreng.
- **Bytte til CesiumJS for `clippingPolygons`.** Den klassiske løsningen, men et
  helt annet renderer-bytte for ett problem.

## Løsning

Maps JavaScript API har fått `FlattenerElement` (`<gmp-flattener>`). Den tar en
lukket ring og stryker alt som reiser seg innenfor den — trær, hus, gjerder —
mens terrengets høydedrag blir stående. Nøyaktig det man vil ha: tomta ryddet,
bakken beholdt.

```ts
const lib = await google.maps.importLibrary("maps3d");
const flattener = new lib.FlattenerElement();
flattener.path = siteGround.map(([lng, lat]) => ({ lat, lng }));
map3d.append(flattener);
```

- Omrisset er det samme vi allerede bruker til den grønne grunnflaten. Det som
  blir strøket er nøyaktig det teppet dekker.
- `innerPaths` er unntakshull — områder inne i ringen som *ikke* skal flates.
  Vi bruker dem ikke; skal noe stå, tegner vi det heller selv.
- Av og på er DOM-operasjoner: `map3d.append(flattener)` / `flattener.remove()`.

Låven, som planen beholder, ryker med i samme slengen. Det er riktig: vi tegner
den likevel som eget hvitt volum, og da er den i samme materiale som resten i
stedet for å være det ene fotografiet midt i modellen.

## Fallgruver

- **Egenskapen er ny.** Den ligger i `@types/google.maps@3.64` og virker i
  `weekly` (verifisert 2026-09-08), men `new lib.FlattenerElement()` kaster hvis
  API-versjonen som lastes er eldre. Står kallet inne i samme try-blokk som
  resten av laget, tar det med seg grunnflate, gater og volumer i fallet. Sjekk
  `if (lib.FlattenerElement)` og tegn resten uansett.
- **Flisene oppdaterer seg ikke umiddelbart.** Fjerner du flatteneren i
  konsollen, står den ryddede tomta igjen i noen sekunder til flisene er hentet
  på nytt. Ikke konkluder på første skjermbilde.
- **Kanten er skarp.** Trærne stopper i en rett linje langs omrisset. På en
  byggetomt leser det som ryddet mark, men det er en visuell beslutning: skal
  overgangen mykes, må omrisset selv mykes.

## Se også

- [overlay-opasitet-2d-kart-vs-3d-fotofliser](overlay-opasitet-2d-kart-vs-3d-fotofliser-20260907.md)
  — hvorfor volumene er nesten tette og likevel lyse
- [plandokument-til-kartdata](../data-import/plandokument-til-kartdata-20260907.md)
  — hvor omrisset, volumene, gatene og stien kommer fra
- https://developers.google.com/maps/documentation/javascript/3d/mesh-flattening
