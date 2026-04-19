---
title: "MapAdapter-pattern: kart-agnostisk camera-kontroll for 2D/3D"
date: 2026-04-19
status: solution
category: architecture-patterns
tags:
  - mapbox
  - google-maps-3d
  - adapter-pattern
  - map-modal
---

# MapAdapter-pattern: kart-agnostisk camera-kontroll

## Kontekst

`UnifiedMapModal` støtter to rendering-motorer for kart:

- **Mapbox GL JS** (2D) — via `react-map-gl/mapbox`
- **Google Maps Photorealistic 3D Tiles** — via `@vis.gl/react-google-maps`

Før denne endringen var `useInteractionController` hardkodet mot
`mapboxgl.Map`: hooken kalte `map.stop()` og `map.flyTo()` direkte.
Dette gjorde at kort-klikk i bunn-carousel kun fungerte i 2D — 3D-modus
hadde ingen måte å fly kameraet til en POI.

Samtidig hadde `ReportThemeSection.tsx` en `if (mapMode === "3d") return null`
i `bottomSlot` som skjulte hele POI-navigasjonen i 3D.

## Løsning: Minimalt MapAdapter-interface

Vi introduserte et to-metoders interface `MapAdapter` som abstraherer
motor-forskjellene, og to pure-function-implementasjoner:

```ts
// lib/map/map-adapter.ts
export interface MapAdapter {
  /** Best-effort cancel. Token-pattern er primær cancel-mekanisme. */
  stop(): void;

  /** Animér kamera til target. altitude brukes kun av 3D. */
  flyTo(
    target: { lat: number; lng: number; altitude?: number },
    opts?: { animate?: boolean; durationMs?: number },
  ): void;
}

export function mapboxAdapter(map: mapboxgl.Map): MapAdapter { ... }
export function google3dAdapter(map3d: Map3DElement): MapAdapter { ... }
```

`useInteractionController` tar nå `getAdapter: () => MapAdapter | null`
i stedet for `getMap`. Token-pattern (rAF-guard + token-bump) er uendret —
DOM-generisk og kart-agnostisk.

`UnifiedMapModal` velger riktig adapter basert på `mapMode`:

```ts
const getAdapter = useCallback((): MapAdapter | null => {
  if (mapMode === "mapbox") {
    const m = mapboxRef.current?.getMap?.();
    return m ? mapboxAdapter(m) : null;
  }
  if (mapMode === "google3d") {
    const m3d = google3dRef.current;
    return m3d ? google3dAdapter(m3d) : null;
  }
  return null; // switching-* → no-op
}, [mapMode]);
```

## Designbeslutninger

### Hvorfor adapter (og ikke inline if-check)?

Simplicity-reviewer i deepen-pass foreslo å droppe adapter og inline
motor-detaljene i `useInteractionController`. Vi valgte adapter fordi:

1. **Konsistens**: `lib/utils/camera-map.ts` bruker samme pure-function-stil.
2. **ISP-gevinst**: interfacet er kun 2 metoder — ikke over-engineering.
3. **Testbarhet**: adapter-mocking er renere enn motor-specific if-mocking.
4. **Fremtidssikring**: CesiumJS, Mapbox 3D Terrain, etc. kan legges til uten
   å røre hook-en.

80 LOC er en billig pris for klar separation of concerns.

### Hvorfor `stop()` som best-effort?

Mapbox har `map.stop()` som garantert canceller pågående animasjoner.
Google Maps 3D har *ikke* en garantert stop-metode på `Map3DElement`-instansen:

- `stopCameraAnimation()` eksisterer på `Map3DRef` fra `@vis.gl/react-google-maps`,
  men er ikke garantert tilgjengelig på den underliggende `Map3DElement` som
  adapter-en får.
- Vi bruker feature-detection: `(map3d as {stopCameraAnimation?: ...}).stopCameraAnimation?.()`.
  No-op hvis metoden mangler.

**Token-pattern er primær cancel-mekanisme.** Siste `flyTo` overskriver forrige
på begge motorer (API queuer ikke — siste call vinner), så stale rAF-guards
i `useInteractionController` unngår side-effekter uansett.

JSDoc på `MapAdapter.stop()` dokumenterer dette eksplisitt for fremtidige lesere.

### Hvorfor altitude-parameter i `flyTo`?

Fremtidssikret for 3D-spesifikke use-cases uten breaking change:

- Mapbox-adapter **ignorerer** `altitude` (2D vet ikke hva meter-over-bakken betyr
  for en pan-animasjon).
- Google 3D-adapter bruker `target.altitude ?? map3d.center?.altitude ?? 0`
  slik at eksisterende camera-altitude beholdes når ikke spesifisert.

Dette tillater fremtidige use-cases som "fly til fugleperspektiv over POI"
uten å endre interfacet.

### Hvorfor beholder vi eksisterende tilt/heading i Google 3D flyTo?

`flyCameraTo` i Google 3D tar `endCamera` med `center`, `range`, `tilt`, `heading`.
Vi forwarder `map3d.tilt`, `map3d.heading`, `map3d.range` uendret — bare center
endres. Grunnen: brukeren har kanskje selv rotert kartet (orbit-drag), og
plutselig reset av perspektiv ville føltes desorienterende.

## Empiriske funn

### Google 3D `stopCameraAnimation` — ikke tilgjengelig på Map3DElement

Feature-detection i `google3dAdapter.stop()` har aldri truffet under testing
på Wesselsløkka (Trondheim). `stopCameraAnimation` finnes kun på `Map3DRef`
fra @vis.gl — ikke på instansen adapter får via `onMapReady`-callback.

I praksis vinner siste `flyCameraTo` uansett, så token-pattern + "last call wins"
gir samme effekt som eksplisitt cancel. Dokumentert for å unngå forvirring.

## Walking-rute som deler adapter-laget

Phase 4 av planen la til en 3D walking-rute fra prosjekt til aktivt POI via
`Polyline3DElement`. Rute-data (`RouteData`) hentes én gang via
`useRouteData`-hook i `UnifiedMapModal`, eksponeres via `SlotContext`, og
konsumeres deklarativt av `RouteLayer3D`.

Viktige designvalg her:

- **`AltitudeMode.RELATIVE_TO_GROUND` med 3m altitude** — ikke `RELATIVE_TO_MESH`
  (som ville fulgt hustak). Konstant clearance over bakkemesh unngår z-fighting
  og ser riktig ut for en gående rute.
- **Native `outerColor`/`outerWidth`** for outline (blå linje + 4px hvit kant) —
  ingen behov for å stacke to polylines.
- **Én langlevet `Polyline3DElement`-instans** per `map3d`. Ved POI-bytte
  muteres `polyline.coordinates` — ingen mount/unmount. Forhindrer
  GPU-buffer-leak på iOS/Android.
- **`drawsOccludedSegments: true`** — ruta vises semi-transparent gjennom
  bygninger, demo-vennlig i tett bebyggelse.

## Relaterte filer

- `lib/map/map-adapter.ts` — interface + to implementasjoner
- `lib/map/map-adapter.test.ts` — 11 unit-tester (mapbox + google3d)
- `lib/map/use-interaction-controller.ts` — hook refaktorert til adapter
- `lib/map/use-route-data.ts` — Zod-validert fetch + debounce + AbortController
- `components/map/route-layer-3d.tsx` — Polyline3DElement med coordinate-mutation
- `components/map/UnifiedMapModal.tsx` — adapter-velger + SlotContext.routeData

## Relaterte dokumenter

- `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md`
- `docs/solutions/ui-bugs/google-maps-3d-popover-not-rendering.md` (StrictMode-pattern)
- `docs/plans/2026-04-19-feat-delte-kartlag-3d-rute-plan.md`
- `docs/brainstorms/2026-04-19-delte-kartlag-3d-rute-brainstorm.md`
