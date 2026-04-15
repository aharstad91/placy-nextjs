---
title: Google Maps 3D — Kamera-kontroll, UI-knapper og iterasjonen fra custom lock til native gestures
date: 2026-04-15
category: feature-implementations
tags:
  - google-maps-3d
  - react-google-maps
  - flycamerato
  - webgl-gestures
  - ui-controls
  - lat-lng-altitude
  - custom-elements
module: variants/report
symptoms:
  - "UI-kontroller rendrer men gjør ingenting ved klikk"
  - "flyCameraTo: InvalidValueError: in property center: in property lat: not a number"
  - "Kartet hakker/jitter under drag"
  - "Kontroller inne i gmp-map-3d ikke synlige"
  - "useMap3D() returnerer feil/null instans med flere Map3D samtidig"
related:
  - docs/solutions/feature-implementations/google-maps-3d-report-block-20260415.md
---

# Google Maps 3D — kamera-kontroll og UI-knapper

Utvidelse av `google-maps-3d-report-block-20260415.md` med lærdom fra iterasjonen der vi prøvde å bygge "museum-modus" (låst kamera) og deretter UI-kontroller (kompass, rotér, tilt, zoom).

## Kontekst

Første implementasjon av Report3DMap låste kamera via kontrollerte `center`/`range`/`bounds`-props + imperative JS snap-back i `gmp-*-change`-handlers. Dette hakket visuelt. Fire separate forsøk før vi landet på riktig løsning. Deretter UI-kontroller som også måtte gjennom to runder før de faktisk fungerte.

## Fire nye fellesfeller

### 1. Kan ikke matche Googles native gesture-smoothness med JS

Forsøket på museum-lock (helt låst kamera, kun heading fri) gikk gjennom fire iterasjoner:

1. Kontrollerte props (`center`, `range`, `bounds`) + snap-back listeners — **hakket**
2. Capture-phase pointer-interception som stoppet Googles gestures — **jitter ved rask drag**
3. rAF-throttlet pending heading/tilt-updates — **fortsatt hakking**
4. Custom drag-overlay som simulerte egen heading/tilt-skriv — **hakket**

**Root cause:** Googles gesture-system kjører i WebGL/GPU med egen render-loop. Hver JS-drevet property-skriving (`map3d.heading = x`) konkurrerer mot Googles interne animasjons-ticks. Uansett hvor mye rAF-batching du legger på, blir det aldri synkront med Googles pipeline.

**Løsning:** La Googles native gesture-handling få lov — ikke intercept. Begrens bevegelse via Googles egne deklarative props (`bounds`, `minAltitude`/`maxAltitude`, `minTilt`/`maxTilt`). Disse håndheves i WebGL og stopper naturlig ved grensen (som native scroll som stopper ved side-kant).

```tsx
// FEIL — JS-interception
map3d.addEventListener("pointermove", (e) => {
  e.preventDefault();
  e.stopImmediatePropagation();
  map3d.heading = computeNewHeading(e);
}, { capture: true });

// RIKTIG — native bounds
<Map3D
  defaultCenter={center}
  defaultRange={900}
  defaultTilt={45}
  bounds={{ south: ..., north: ..., west: ..., east: ... }}
  minTilt={15} maxTilt={75}
  minAltitude={200} maxAltitude={3000}
/>
```

Brukeren får pan og zoom — det er akseptert i bytte mot native smoothness. Bounds holder dem i nabolaget.

### 2. `LatLngAltitude` har `lat`/`lng` som getters — spread mister dem

Konsoll-feil:

```
InvalidValueError: in property endCamera: in property center: in property lat: not a number
```

Utløsing:

```ts
map3d.flyCameraTo({
  endCamera: {
    center: { ...map3d.center },  // { JB: 63.42, KB: 10.45, IB: 0 }
    // ...
  },
});
```

`map3d.center` returnerer en `google.maps.LatLngAltitude`-instans. `lat`/`lng`/`altitude` er getters via prototypen, ikke egne enumerable properties. Når du sprer med `{...}` får du kun de minifiserte interne feltene (`JB`, `KB`, `IB`) — Google ser ingen `lat` og kaster InvalidValueError.

**Løsning:** Kopier eksplisitt:

```ts
const c = map3d.center;
map3d.flyCameraTo({
  endCamera: {
    center: {
      lat: c.lat,
      lng: c.lng,
      altitude: c.altitude ?? 0,
    },
    range: map3d.range,
    tilt: map3d.tilt,
    heading: map3d.heading,
  },
  durationMillis: 400,
});
```

Samme gjelder `map3d.position` på Marker3D. All JSON-serialization/spread av `LatLngAltitude` må erstattes med eksplisitt felt-kopi.

### 3. `useMap3D()` er upålitelig utenfor Map3D-treet med flere instanser

Når både preview (`activated=false`) og modal (`activated=true`) er mountet samtidig, er det to `<Map3D>` i DOM. En `<Map3DControls>`-komponent plassert som søsken til Map3D (ikke child) bruker `useMap3D()` — hooken returnerer ikke konsistent riktig instans.

Selv med `useMap3D(mapId)` der `mapId` matcher Map3D sin `id`-prop, fungerer det ikke pålitelig fra utsiden av Map3D-treet. Context-lookup funker kun som descendant.

**Løsning:** Prop-drill instansen via en bridge-komponent inne i Map3D:

```tsx
function MapReadyBridge({ onReady }) {
  const map3d = useMap3D();  // Fungerer PÅLITELIG inne i Map3D-treet
  useEffect(() => {
    onReady(map3d);
    return () => onReady(null);
  }, [map3d, onReady]);
  return null;
}

function Map3DInner(...) {
  const [mapInstance, setMapInstance] = useState(null);

  return (
    <div className="relative w-full h-full">
      <Map3D ...>
        <MapReadyBridge onReady={setMapInstance} />
        {/* markers */}
      </Map3D>
      {activated && (
        <Map3DControls map3d={mapInstance} ... />  // Får instansen direkte
      )}
    </div>
  );
}
```

### 4. DOM-elementer inne i `<gmp-map-3d>` absorberes i shadow DOM

Kontroll-komponenten vår renderet opprinnelig som child av Map3D:

```tsx
<Map3D ...>
  <Map3DControls ... />  // ← usynlig!
  {markers}
</Map3D>
```

Den ble ikke synlig. Årsak: `gmp-map-3d` er et custom element med egen shadow DOM. Det bruker children via `<template>` eller interne slots. Vanlige React `<div>`-elementer med Tailwind-klasser passer ikke inn i den logikken.

Marker3D/Pin/img fungerer som children fordi Map3D eksplisitt håndterer dem (auto-wraps i `<template>` per docs). Alt annet ignoreres visuelt.

**Løsning:** Plasser kontrollene som **søsken til Map3D**, inne i en felles `relative`-container:

```tsx
<div className="relative w-full h-full">
  <Map3D ...>{markers}</Map3D>
  <Map3DControls className="absolute bottom-4 right-4" ... />
</div>
```

`useMap3D` inne i Map3DControls vil fungere via APIProvider-context, men kun hvis det kun finnes én Map3D-instans. Ved flere: se fellesfelle #3.

## `flyCameraTo` som enhetlig animasjons-API

UI-knappene bruker alle `flyCameraTo` med 400ms varighet:

```ts
function flyBy(delta: Partial<{ heading: number; tilt: number; range: number }>) {
  const c = map3d.center;
  map3d.flyCameraTo({
    endCamera: {
      center: { lat: c.lat, lng: c.lng, altitude: c.altitude ?? 0 },
      range: delta.range ?? map3d.range,
      tilt: delta.tilt ?? map3d.tilt,
      heading: delta.heading ?? map3d.heading,
    },
    durationMillis: 400,
  });
}
```

Fordel: samme motor som drag-gestures → smooth, WebGL-drevet animasjon mellom state-verdier. Ingen hakking.

- **Rotér 45°**: `flyBy({ heading: (currentHeading + 45) % 360 })`
- **Tilt ±15°** (klemmet til min/maxTilt): `flyBy({ tilt: clamp(currentTilt + delta, min, max) })`
- **Zoom 1.5×** (klemmet til min/maxAltitude): `flyBy({ range: clamp(currentRange * factor, min, max) })`
- **Reset til start**: lengre duration (1500ms) for "fly back"-følelse

## Live-oppdatert kompass via `gmp-headingchange`

```tsx
useEffect(() => {
  if (!map3d) return;
  const update = () => setHeading(map3d.heading ?? 0);
  update();
  map3d.addEventListener("gmp-headingchange", update);
  return () => map3d.removeEventListener("gmp-headingchange", update);
}, [map3d]);

// I render:
<Navigation style={{ transform: `rotate(${-heading}deg)` }} />
```

Passive listener, ingen render-loop-konflikt.

## Tommelfinger-regler

1. **Aldri kjemp mot Googles WebGL-pipeline med JS.** Bruk deres deklarative props eller `flyCameraTo`.
2. **Spread aldri LatLng/LatLngAltitude.** Kopier lat/lng/altitude eksplisitt.
3. **UI-overlay = søsken til Map3D**, aldri child.
4. **Flere Map3D-instanser = prop-drill instansen.** Ikke stol på `useMap3D(id)` fra utsiden.
5. **UI-knapper = `flyCameraTo` med kort durationMillis** (300-500ms). Smooth uten JS-rAF.

## Referanser

- Seks første fellesfeller: `docs/solutions/feature-implementations/google-maps-3d-report-block-20260415.md`
- @vis.gl v1.8 docs: https://visgl.github.io/react-google-maps/
- Google Map3DElement.flyCameraTo: https://developers.google.com/maps/documentation/javascript/reference/3d-map#Map3DElement.flyCameraTo
