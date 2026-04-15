---
title: Google Maps 3D Report-block — Photorealistic Tiles med låst kamera og fri heading
date: 2026-04-15
category: feature-implementations
tags:
  - google-maps-3d
  - photorealistic-tiles
  - react-google-maps
  - marker-3d
  - ssr
  - webgl
  - report
module: variants/report
symptoms:
  - "black screen in Map3D"
  - "useMap3D returns Map3DElement not context"
  - "Marker3D HTML children not rendering"
  - "no minRange maxRange in google maps 3d"
  - "sky only in 3D view"
---

# Google Maps 3D Report-block — lærdom fra implementering

## Kontekst

Skulle erstatte en akvarell-JPG-basert `TabbedAerialMap` (som brøt Google Map Tiles API Policies ved å lage deriverte verk av screenshots) med en ekte `Map3DElement` via `@vis.gl/react-google-maps@^1.8.3`. Kamera skulle låses slik at brukeren kun kan rotere 360° rundt et fast punkt — ikke panorere, tilte eller zoome.

## Seks fellesfeller

### 1. `useMap3D()` returnerer `Map3DElement` direkte — ikke et context-objekt

Intuisjonen er at hooken returnerer `{ map3d }` (som context-typen heter). Den gjør det ikke.

```tsx
// FEIL
const ctx = useMap3D();
const map3d = ctx?.map3d;

// RIKTIG
const map3d = useMap3D();
```

Sjekk `node_modules/@vis.gl/react-google-maps/dist/index.d.ts` direkte for signaturen — typen løser seg slik:
`declare function useMap3D(id?: string | null): google.maps.maps3d.Map3DElement | null;`

### 2. `<Marker3D>` rasteriserer kun SVG/Pin/img — HTML via portal fungerer IKKE

Den tidligere komponenten `poi-marker-3d.tsx` brukte `createPortal` til å rendre en `<div>` med Tailwind-klasser inn i `Marker3DInteractiveElement`. Koden kompilerer, men Google sin rasterizer ignorerer alt som ikke er SVG, `<img>` eller `<PinElement>`.

**Løsning:** Bygg en ren SVG-komponent som renderes som children:

```tsx
<Marker3D position={...} onClick={...}>
  <svg width={40} height={40} viewBox="0 0 40 40">
    <circle cx={20} cy={20} r={17} fill={color} stroke="white" strokeWidth="2" />
    <g transform="translate(10 10)">
      <LucideIcon width={20} height={20} stroke="white" strokeWidth={2.2} />
    </g>
  </svg>
</Marker3D>
```

Lucide-ikoner er SVG-komponenter og kan nestes direkte inn i den ytre SVG-en.

### 3. Ingen native `minRange`/`maxRange` → må snap-back imperativt

`Map3DElementProps` har `minTilt`/`maxTilt` og `minAltitude`/`maxAltitude`, men ingen range-lås. Controlled-prop funker ikke fordi Google oppdaterer element-state internt når brukeren scroller — React re-rendrer ikke hvis prop-verdien er lik.

**Løsning:** Attach `gmp-rangechange` listener imperativt på element-ref:

```tsx
function CameraSnapBack({ center, range }) {
  const map3d = useMap3D();
  useEffect(() => {
    if (!map3d) return;
    const onRangeChange = () => {
      if (map3d.range !== range) map3d.range = range;
    };
    map3d.addEventListener("gmp-rangechange", onRangeChange);
    return () => map3d.removeEventListener("gmp-rangechange", onRangeChange);
  }, [map3d, range]);
  return null;
}
```

Samme pattern for `gmp-centerchange` gir defense-in-depth hvis `bounds`-deklarasjonen drifter.

### 4. `minAltitude={0}` + `maxAltitude={0}` gir svart skjerm

Den første implementasjonen tenkte at disse proppene låste senter-altitude (ground level). Men de låser KAMERA-altitude. Med begge satt til 0 plasseres kameraet under bakken → rendrer kun sort.

**Løsning:** Ikke sett altitude-begrensninger for pilot med bakkenivå-center. `tilt`/`range` definerer kamera-posisjon implisit.

### 5. Tilt-konvensjon: 0° = rett ned, 90° = horisontal

Forvirret først med tilt=67.5° (for horisontalt — viste mest himmel). For bird's-eye nabolagsvisning: tilt=30-45°. Google Maps-URL-en i attribusjon har `t`-parameter som matcher den aktive verdien — nyttig til debugging.

### 6. Map3D krever WebGL → må lazy-loades med `ssr: false`

Komponenten crasher under Next.js SSR. Use `dynamic`:

```tsx
const Report3DMap = dynamic(() => import("./blocks/Report3DMap"), {
  ssr: false,
});
```

Samme mønster som allerede er etablert for `ReportThemeMap`.

## v1.8.3 API-oppgraderinger vs v1.5

Oppgradering fra den reverterte feb-2026-versjonen (@vis.gl v1.5) til v1.8.3 (mars 2026) er KRITISK. v1.8+ legger til deklarative `<Map3D>` og `<Marker3D>` komponenter. Det erstatter all imperativ DOM-kode fra forrige forsøk. Faktisk ENKLERE enn v1.5-implementasjonen.

## Kameraprofil for "museum-modus"

```tsx
const LOCKED = {
  center: { lat: 63.42, lng: 10.463, altitude: 0 },
  range: 900,
  tilt: 45,
  bounds: { south: 63.4195, north: 63.4205, west: 10.4625, east: 10.4635 },
};

<Map3D
  mode={MapMode.SATELLITE}
  center={LOCKED.center}
  range={LOCKED.range}
  tilt={LOCKED.tilt}
  defaultHeading={0}
  minTilt={LOCKED.tilt}
  maxTilt={LOCKED.tilt}
  bounds={LOCKED.bounds}
  defaultUIHidden
>
  <CameraSnapBack center={LOCKED.center} range={LOCKED.range} />
  {/* markers */}
</Map3D>
```

La `heading` være uncontrolled (bare `defaultHeading={0}`) → bruker kan rotere fritt 360°. IKKE sett `minHeading`/`maxHeading` — de wraps ved 360 og gir udefinert adferd når min===max.

## Juridisk gevinst

Direkte Map Tiles API-kall via offisielt SDK er 100% innenfor Google sine ToS. Ingen tiles caches lokalt, attribusjon vises automatisk. Erstatter derivative-work-risikoen fra akvarell-pipelinen (screenshot → Gemini stil-transfer → lagret som eget bilde).

## Referanser

- Plan: `docs/plans/2026-04-15-feat-report-3d-map-plan.md`
- Brainstorm: `docs/brainstorms/2026-04-15-report-3d-map-brainstorm.md`
- v1.8 d.ts: `node_modules/@vis.gl/react-google-maps/dist/index.d.ts`
- Google docs: https://developers.google.com/maps/documentation/javascript/3d/overview
