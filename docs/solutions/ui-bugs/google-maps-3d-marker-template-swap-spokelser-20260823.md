---
title: Google Maps 3D — spøkelses-markører ved komponent-typebytte, og bunn-midt-forankringen
date: 2026-08-23
category: ui-bugs
module: components/map, variants/report/board
problem_type: rendering_bug
tags:
  - google-maps-3d
  - marker3d
  - vis-gl
  - react
  - rasterisering
  - projeksjon
symptoms:
  - "DOM sier 14 px prikk, skjermen viser 40 px pin — og den blir stående gjennom flere kamera-bevegelser"
  - "En klynge som skal gliste ut til 2 pins + 6 prikker rendrer som 8 fulle pins"
  - "Markør-overlay/hindring bommer med ~en halv markørhøyde vertikalt"
related:
  - docs/solutions/feature-implementations/google-maps-3d-svg-label-marker-og-bounds-semantikk-20260415.md
  - docs/solutions/performance-issues/webgl-context-leak-per-render-probe-20260603.md
---

# Google Maps 3D — spøkelses-markører ved komponent-typebytte

To funn fra 3D-kartets label-/utglisningsrunde (2026-08-23, Strindfjordvegen 10).
Begge er usynlige for enhetstester: DOM-en er korrekt, det er SCENEN som ikke er det.

## 1. Bytt BARNET, aldri komponent-TYPEN, på en `<Marker3D>`

### Symptom

Utglisningen skal tegne taperne i en klynge som små prikker. `document.querySelector`
bekreftet at markørene var byttet — `<svg width="14">` i templaten, riktig antall,
riktige id-er. Skjermen viste fortsatt åtte fulle 40 px-pins. Tilstanden overlevde
kamera-flyvninger, ny rasterisering og flere sekunders ro.

### Rotårsak

Prikk og pin var to ulike React-komponenter (`Marker3DItem` / `CompactMarker3DItem`)
som byttet på å være mountet for samme POI. Et komponent-TYPEBYTTE får React til å
unmounte den ene og mounte den andre — altså fjerne og opprette
`gmp-marker-3d-interactive`-elementet. Google beholdt den fjernede markørens tekstur
i scenen. Den nye markøren tegnes i tillegg, så man ser BEGGE: en full pin (spøkelset)
og en liten prikk (den ekte) på nesten samme punkt.

Samme familie som den etablerte regelen i `useBoardMarkerSet`: pins fjernes ALDRI
via DOM utenfra. Her var fjerningen Reacts egen, men resultatet mot Googles scene er
det samme.

### Løsning

ÉN komponent per POI. Behold `<Marker3D>` mountet og bytt bare BARNET:

```tsx
// FEIL — typebytte river elementet ut av scenen
{compact ? <CompactMarker3DItem {...p} /> : <Marker3DItem {...p} />}

// RIKTIG — samme element, nytt innhold
<Marker3D position={{ lat, lng, altitude: 18 }} ...>
  {compact ? <BlobMarker3D color={c} /> : <Marker3DPin color={c} Icon={I} />}
</Marker3D>
```

Innholds-endringer INNI et bestående element rasteriseres helt fint på nytt (labels
som kommer og går på samme `Marker3DPin` fungerer). Det er elementets liv som er
skjørt, ikke templaten.

Hold også `altitude` lik i begge tilstander. En altitude-flipp er en posisjonsendring
på et element som skal stå stille.

### Tommelfingerregel

Alt som endrer et 3D-markør-uttrykk skal være en PROP på en stabil komponent — aldri
et valg mellom to komponenter. Gjelder både `key` og komponent-type.

## 2. Marker-innhold forankres i BUNN-MIDTEN, ikke i senter

`projectLatLngToScreen` gir markørens ANKER. Google tegner SVG-en med bunnkanten der,
så den synlige skiva ligger en halv SVG-høyde HØYERE enn det projiserte punktet.

Verifisert ved å måle to identifiserbare pins mot projeksjonen: x traff innen 1,6 px,
y bommet konsekvent med ~20 (= halve 40 px-markøren). `ProjectSitePin` har alltid
antatt dette — pila peker ned mot tomta fra bunnkanten.

Konsekvens for alt som regner geometri i skjermrommet (kollisjon, hindringer,
overlays): løft y til visuelt senter først.

```ts
const discCenterY = projected.y - svgHeight / 2;
```

Uten korreksjonen slapp en bussholdeplass rett bak prosjekt-chipen unna
blokkeringen med 1 px — feilen er liten, men den er SYSTEMATISK og peker alltid
samme vei.

`m.fov` er dessuten en ekte property på elementet. Den ble tidligere hardkodet til 35
i projeksjonen; les den, med 35 som default.

## Hvordan finne slikt

Skjermbilder alene holder ikke — de viser symptomet, ikke avviket. Metoden som
avgjorde saken var å lese DOM-en og projeksjonen i SAMME `evaluate_script`, og
sammenligne mot et skjermbilde tatt rett etterpå:

```js
els.map(e => {
  const [lat, lng, alt] = e.getAttribute('position').split(',').map(Number);
  const p = proj(lat, lng, alt);
  const w = (e.outerHTML.match(/<svg width="([\d.]+)"/) || [])[1];
  return { t: e.getAttribute('title'), x: p.x, y: p.y, w };
});
```

Sier DOM-en 14 og skjermen viser 40, er det scenen som er feil — ikke logikken.

## Referanser

- `components/map/map-view-3d.tsx` (`Marker3DItem`), `components/map/Marker3DPin.tsx`
- `components/variants/report/board/use-3d-marker-declutter.ts`
- `components/map/project-latlng-to-screen.ts`
