---
title: Google Maps 3D — SVG label-chip som Marker3D og bounds-semantikk
date: 2026-04-15
category: feature-implementations
tags:
  - google-maps-3d
  - marker3d
  - svg
  - bounds
  - react-google-maps
  - label-chip
  - project-site-marker
module: variants/report
symptoms:
  - "Sirkel-ord (radius/panRadiusKm) antyder rund pan-grense men Google bounds er alltid rektangel"
  - "Usikkerhet om SVG text/rect rendres korrekt som Marker3D-innhold"
  - "Ingenting markerer at 'her kommer prosjektet' i kartet"
related:
  - docs/solutions/feature-implementations/google-maps-3d-report-block-20260415.md
  - docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md
---

# Google Maps 3D — SVG label-chip som Marker3D og bounds-semantikk

Fortsettelse av `google-maps-3d-camera-control-iteration-20260415.md`. To nye lærdomspunkter fra sesjonen etter UI-kontroll-iterasjonen.

## 1. Googles `bounds`-prop er alltid en firkant — aldri en sirkel

### Symptom

Koden het `radiusToBounds()` / `panRadiusKm: 2`. Bruker opplevde hakking langs kanten og antok at det var fordi kanten var sirkulær (treffer kanten under drag). Faktisk årsak: kanten ble truffet for hyppig, ikke fordi geometrien var rund.

### Root cause

**Googles `Map3D.bounds`-prop er `google.maps.LatLngBoundsLiteral` — en rektangulær `{south, north, west, east}`-boks.** Det finnes ingen sirkel-bounds i Google Maps 3D. `panRadiusKm` var et misvisende navn som skapte feil mentalt bilde.

Funksjonen vår returnerte allerede riktig rektangel via `cos(lat)`-korrigert delta. Det var kun terminologien som var feil.

### Løsning

Rename:
- `radiusToBounds()` → `squareBoundsAround()`
- `panRadiusKm` → `panHalfSideKm`

```ts
// FEIL naming — antyder sirkel
function radiusToBounds(center, radiusKm) { ... }
panRadiusKm: 2

// RIKTIG — tydelig firkant-semantikk
function squareBoundsAround(center, halfSideKm) {
  const latDelta = halfSideKm / 111;
  // cos(lat) for breddegrad-korreksjon — viktig på 63°N
  const lngDelta = halfSideKm / (111 * Math.cos((center.lat * Math.PI) / 180));
  return {
    south: center.lat - latDelta,
    north: center.lat + latDelta,
    west: center.lng - lngDelta,
    east: center.lng + lngDelta,
  };
}
panHalfSideKm: 1.5  // → 3×3km totalboks
```

**`cos(lat)`-korreksjonen er kritisk.** På breddegrad 63°N er `cos(63°) ≈ 0.454`, som betyr at 1° lng ≈ 50km (ikke 111km). Uten korreksjonen blir boksen ca 2× for bred øst-vest. Behold alltid denne korreksjonen.

### Tommelfingerregel

Hakking langs kanten skyldes at kanten treffes for hyppig i vanlig navigasjon — ikke at bounds-geometrien er feil. Øk `panHalfSideKm` litt for mer pusterom. Googles native WebGL-bounds-håndtering er smooth ved selve grensen (som native scroll-stop), men høy frekvens av grense-treff gir en opplevelse av hakking.

---

## 2. SVG `<text>` og `<rect>` fungerer som Marker3D-innhold

### Symptom / spørsmål

Vi visste fra `google-maps-3d-report-block-20260415.md` at Googles rasterizer kun håndterer SVG/Pin/img som Marker3D-innhold — ikke HTML. Spørsmålet var: holder dette for _sammensatt_ SVG med `<rect>`, `<text>`, og `<polygon>`? Eller er det kun enkle SVG-elementer som fungerer?

### Root cause / innsikt

Google Maps 3D rasteriserer Marker3D-innhold via **nettleserens SVG-renderer**, ikke en intern begrenset renderer. Nettleseren produserer en `ImageData`-bitmap av SVG-en, og den bitmapen overføres til WebGL som tekstur. Dermed støttes **all gyldig SVG-syntaks** — inkludert:

- `<rect>` med `rx`/`ry` for avrundede hjørner
- `<text>` med `fontSize`, `fontFamily`, `fontWeight`, `dominantBaseline`
- `<polygon>` for pilform
- `<defs>` + `<filter>` for drop-shadow
- Nestede Lucide-ikoner (fra `google-maps-3d-report-block-20260415.md`)

**Begrensning:** CSS-klasser (Tailwind) og React-event-handlers ignoreres. Alt layout må være inline SVG-attributter.

### Løsning — ProjectSitePin label-chip

```tsx
// components/map/ProjectSitePin.tsx
export function ProjectSitePin({ name, subtitle = "Nybygg 2028" }) {
  const chipW = Math.max(name.length * 7.5, 80) + 52;
  const chipH = subtitle ? 44 : 32;
  const totalH = chipH + 10; // + pil

  return (
    <svg width={chipW} height={totalH} viewBox={`0 0 ${chipW} ${totalH}`}>
      {/* Avrundet pill-bakgrunn */}
      <rect x={0} y={0} width={chipW} height={chipH}
        rx={chipH / 2} ry={chipH / 2} fill="#1a1a1a" />

      {/* Prosjektnavn — hvit bold */}
      <text x={40} y={chipH / 2 - 2} fill="white"
        fontSize={12} fontWeight="700" dominantBaseline="middle"
        fontFamily="system-ui,-apple-system,sans-serif">
        {name}
      </text>

      {/* Undertittel — gull */}
      <text x={40} y={chipH / 2 + 11} fill="#e8b86d"
        fontSize={10} fontWeight="500" dominantBaseline="middle"
        fontFamily="system-ui,-apple-system,sans-serif">
        {subtitle}
      </text>

      {/* Pil ned */}
      <polygon
        points={`${chipW/2 - 6},${chipH} ${chipW/2 + 6},${chipH} ${chipW/2},${totalH}`}
        fill="#1a1a1a" />
    </svg>
  );
}
```

Brukes som:

```tsx
<Marker3D
  position={{ lat, lng, altitude: 30 }}
  altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
  title={name}
>
  <ProjectSitePin name={name} subtitle="Nybygg 2028" />
</Marker3D>
```

`altitude: 30` + `RELATIVE_TO_GROUND` lar chipen flyte tydelig over tomten, uavhengig av terrengmodell.

### Generelt mønster for label-markører

Når du trenger en label (ikke bare et ikon) i Google Maps 3D:

1. Lag hele layoutet som inline SVG med hardkodede mål
2. Bruk `system-ui`-font-stack (alltid tilgjengelig i nettleseren)
3. Bruk `dominantBaseline="middle"` for vertikal sentrering av tekst
4. Unngå `dy`/`textLength` — brukes sjeldent i 3D-rendering og kan gi uventet plassering
5. Test SVG i nettleser isolert (`<img src="data:image/svg+xml,...">`) for å verifisere layout

## Referanser

- Seks første fellesfeller: `docs/solutions/feature-implementations/google-maps-3d-report-block-20260415.md`
- UI-kontroll-iterasjon: `docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md`
- Filer: `components/map/ProjectSitePin.tsx`, `components/map/map-view-3d.tsx`
- @vis.gl/react-google-maps v1.8.3: https://visgl.github.io/react-google-maps/
