---
title: "Google Maps 3D — WebGL-kontekstkrasj på touch devices"
date: 2026-04-15
category: ui-bugs
tags: [google-maps-3d, webgl, ios, touch, mobile, react]
symptoms:
  - Chrome på iOS krasjer når brukeren trykker på preview-kartet for å åpne 3D-modalen
  - Tab krasjer stille — ingen JavaScript-feil i konsoll
  - Fungerer fint på desktop Chrome
  - Android kan også krasje avhengig av enhet og minnepress
---

# Google Maps 3D — WebGL-kontekstkrasj på touch devices

## Problem

Chrome på iOS krasjet stille ved åpning av 3D-modal-kartet.

**Rotårsak:** To samtidige WebGL-kontekster.

Komponenten hadde alltid en preview `<MapView3D>` mountet på siden. Når modalen ble åpnet, ble en ny modal `<MapView3D>` mountet i tillegg — begge aktive samtidig. iOS WebKit (som alle iOS-nettlesere bruker, inkl. Chrome) tåler kun én aktiv WebGL-kontekst per side. Med to kontekster krasjet WebKit stille.

**Sekundærproblem:** WebGL-elementet (Google Maps 3D custom element `<gmp-map-3d>`) fanget touch-events og kunne blokkere knappens click-handler på touch devices, slik at tap på preview ikke åpnet modalen pålitelig.

## Løsning

### 1. Én WebGL-kontekst om gangen — unmount preview ved modal-åpning

```tsx
{/* Unmount preview når modal er åpen — iOS WebKit tåler kun én WebGL-kontekst */}
{!sheetOpen && (
  <div className="absolute inset-0 pointer-events-none">
    <MapView3D mapId="report-3d-preview" activated={false} ... />
  </div>
)}

{/* Modal — deferred mount */}
{sheetOpen && (
  <MapView3D mapId="report-3d-modal" activated ... />
)}
```

`!sheetOpen` sikrer at preview-konteksten er frigitt (WebGL-context destroyed) FØR modal-konteksten opprettes. Browseren får aldri to samtidige WebGL-kontekster.

### 2. pointer-events-none på preview-wrapper

WebGL custom elements kan konsumere touch-events selv med `activated={false}`. En `pointer-events-none` wrapper på preview-div-en sikrer at alle taps rutes til `<button>`-elementet utenfor.

```tsx
<div className="absolute inset-0 pointer-events-none">
  <MapView3D mapId="report-3d-preview" activated={false} ... />
</div>
```

**Merk:** Dette berører ikke modalkartet — det skal motta touch-events og bruker `GestureHandling.GREEDY`.

## Hva som IKKE var problemet

- iOS-inkompatibilitet med Google Maps 3D: WebKit støtter Google Maps 3D fint (iOS 15+).
- Manglende `touch-action: none`: Map3DInner har allerede `touch-none` på sin wrapper.

En tidlig hypotese var at Chrome på iOS ikke støtter WebGL2 godt nok for Google Maps 3D. Dette er feil — WebGL rapporterer som tilgjengelig og fungerer, men krasjer ved to samtidige kontekster.

## Mønster å følge

Når du har en preview + en modal med Google Maps 3D:

```tsx
// FEIL — to kontekster aktivt samtidig
<MapView3D preview ... />
{open && <MapView3D modal ... />}

// RIKTIG — kun én kontekst om gangen
{!open && <MapView3D preview ... />}
{open && <MapView3D modal ... />}
```

Samme prinsipp gjelder for alle WebGL-tunge komponenter (Three.js, Babylon.js, etc.) på iOS.

## Berørte filer

- `components/variants/report/blocks/Report3DMap.tsx`
