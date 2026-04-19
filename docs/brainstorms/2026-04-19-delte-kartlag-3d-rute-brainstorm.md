---
date: 2026-04-19
topic: Delte kartlag (2D/3D) + rute fra prosjekt til aktivt POI i 3D
status: brainstorm
related:
  - docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md
  - docs/solutions/feature-implementations/google-maps-3d-report-block-20260415.md
  - docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md
  - docs/plans/2026-04-19-feat-map-modal-bunn-carousel-plan.md
---

# Brainstorm — Delte kartlag + 3D-rute fra prosjekt til aktivt POI

## What We're Building

**Konsept 1 — 2D og 3D som utbyttbare kartlag, UI er felles:**
Kart-modalen behandler Mapbox 2D og Google Photorealistic 3D som to rendering-lag. Alt annet UI (bottom-carousel med POI-kort, kategori-pills, toggle, drawers) er identisk på tvers. Toggle "Kart / 3D" i top høyre bytter sømløst uten layout-shift. Kort-klikk i carousel skal fly kameraet til POI i begge moduser.

**Konsept 2 — Walking-rute i 3D:**
Når et POI aktiveres, vises en blå walking-rute fra prosjektet til POI-et. I 2D bruker vi `/api/directions` → GeoJSON LineString → Mapbox line-layer (allerede implementert). I 3D gjenbruker vi samme data, konverterer til `{lat, lng, altitude}[]` og rendrer via `Polyline3DElement` med `RELATIVE_TO_MESH` altitude-mode slik at ruta følger terreng/bakke.

## Why This Approach

**Research-funn som driver beslutningene:**

1. **`components/map/route-layer-3d.tsx` finnes allerede** som `@ts-nocheck`-stub med `Polyline3DElement`, `AltitudeMode.RELATIVE_TO_MESH` og `drawsOccludedSegments: true`. Implementasjonen er ~80% klar — den er bare ikke wired opp til noe render-slot. Vi aktiverer eksisterende arbeid i stedet for å bygge fra scratch.

2. **Slot-arkitekturen støtter delt UI allerede.** `bottomSlot` rendres som absolute overlay utenfor `mapboxSlot`/`google3dSlot` (UnifiedMapModal.tsx:515-519). Det som blokkerer er én linje i `ReportThemeSection.tsx:484` (`if (ctx.mapMode === "3d") return null`) — ikke arkitektur.

3. **`useInteractionController` er eksklusivt Mapbox** (lib/map/use-interaction-controller.ts). Hardkodet `map.stop()` + `map.flyTo()`. Må abstraheres til adapter-interface med to implementasjoner. Google 3D har *ingen* `stop()` — cancel-semantikk må løses annerledes.

4. **Google 3D bruker `@vis.gl/react-google-maps` React-wrapper** rundt `<gmp-map-3d>` WebComponent. `MapView3D` eksponerer imperative tilgang til `Map3DElement`-instansen via `onMapReady`-callback (map-view-3d.tsx:54-78). Dette gir oss et identisk "ref-lignende"-mønster for adapter-implementasjonen som i Mapbox.

5. **Walking-rute-pipeline er allerede modulær.** `/api/directions` returnerer GeoJSON LineString som konsumeres av RouteLayer (2D) eller kan konsumeres av RouteLayer3D. Ingen ny endpoint trengs.

**YAGNI-vurdering:**
- Vi bygger IKKE en full abstraksjon over alle mapbox/google3d-forskjeller. Kun `flyTo` og `cancelAll` i adapter-interfacet.
- Vi bygger IKKE en delt POI-marker-renderer. 2D har Mapbox-markers, 3D har `Marker3DElement` — de rendres i hver sin slot, ingen merverdi i å dele.
- Vi bygger IKKE egen route-styling-engine. Bruker native prop-er på `Polyline3DElement` (stroke, altitude, occluded-segments).

## Key Decisions

### Scope: Full polish fra dag én
- Konsept 1 + Konsept 2 sammen i én PR
- 3D-rute får altitude-offset 2-5m + outline/glow for kontrast mot aerial-bakgrunn
- Bottom-carousel virker identisk i begge moduser fra V1

### PR-struktur: Én samlet plan og PR
Konseptene er teknisk tett koblet — begge bruker `google3dRef` og krever 3D-adapter. Splitting ville skapt koordinerings-overhead uten isolasjons-gevinst. Ett testrunde, ett demo-punkt.

### Kameraperspektiv i 3D: Behold brukerens tilt/heading
`flyCameraTo` flytter kun `center` + `range`. Brukeren beholder 3D-rotasjonen de selv har satt (via orbit-drag). Simpleste og minst desorienterende. Tilt-endringer kan eksperimentere vi med senere hvis UX krever det.

### Cancel-strategi for Google 3D flyCameraTo
Google 3D har ingen `stop()`. Vi bruker token-pattern + ignore-on-stale-token for begge adaptere:
- **Mapbox:** `map.stop()` + rAF-guard (som i dag)
- **Google 3D:** Ingen imperativ cancel. Token-pattern garanterer at *ny* flyCameraTo med ny end-camera overskriver forrige (API-et queuer ikke — siste call vinner). Stale rAF-guards unngår side-effekter etter superseding.

### Adapter-interface (foreslått navn: `MapController`)
```
type MapController = {
  flyTo(poiId: string, opts?: { animate?: boolean }): void;
  scrollCardIntoView(poiId: string, opts?: { behavior?: ScrollBehavior }): void;
  cancelAll(): void;
};
```
Scroll-delen er DOM-generisk (ingen kartlag), men holdes i samme interface for enkel testbarhet. `useInteractionController` blir wrapper som svitsjer mellom `mapbox`- og `google3d`-strategy basert på `mapMode`.

### Rute-altitude-strategi
- `AltitudeMode.RELATIVE_TO_MESH` (følger terreng og bygninger automatisk)
- `altitude: 3` (meter over mesh — unngår z-fighting, gir "svevende" visuell effekt som leser tydelig)
- `drawsOccludedSegments: true` (bygninger blir semi-transparente der rute passerer gjennom — demo-vennlig)

### Rute-styling
- **2D:** uendret (blå linje med hvit casing + glow, som i dag)
- **3D:** blå hovedlinje (`#2563eb`), hvit outline (eller glow via `outerColor`), stroke-width økt til 8-10px for å være lesbar fra aerial-vinkel

## Open Questions

1. **Har `Polyline3DElement` native `outerColor`/outline-prop?** Hvis ikke, må vi rendre to paralelle polylines (hvit underliggende, blå over). Research fra deepen.

2. **Hva skjer med flyCameraTo-animasjonen hvis brukeren manuelt rorker kartet midt i animasjonen?** Mapbox stopper animasjonen på user-gesture. Google 3D — ukjent. Må testes empirisk; dokumenteres i deepen.

3. **Performance:** Er det en merkbar cost ved å kontinuerlig ha route-polyline mounted i 3D (vs re-mount per active POI)? Sannsynligvis nei, men verdt et bench-check ved mange POIer.

4. **Hvordan ser flyCameraTo-range ut for POI i tett nabolag (f.eks. `range: 400`)?** Range settes basert på avstand fra prosjekt. Må kalibreres med visuelle tester.

5. **"Vis rute"-knappen i aktivt kort — skjuler vi den i 3D?** I 3D vises ruta automatisk når POI blir aktivt, så knappen kan bli redundant. Eller la den åpne Google Maps i ny fane (samme som i 2D) — mest konsistent.

## Non-Goals (V1)

- Delte POI-markers på tvers av 2D/3D (hver slot rendrer sine egne)
- Animert path-trace (ruta bygges gradvis) — statisk polyline holder
- Multi-POI-ruter (én rute om gangen, fra prosjekt til aktivt POI)
- Transit-ruter i 3D (kun walking, som i 2D)
- Altitude-calibration per terreng (RELATIVE_TO_MESH håndterer det native)

## Files That Will Change (Preview)

| Fil | Endring |
|-----|---------|
| `lib/map/use-interaction-controller.ts` | Abstrahér til adapter-pattern, legg til google3d-strategy |
| `lib/map/use-interaction-controller.test.ts` | Ny test-suite for google3d-strategy + cross-mode-switching |
| `components/variants/report/ReportThemeSection.tsx:484` | Fjern `if (ctx.mapMode === "3d") return null` |
| `components/map/route-layer-3d.tsx` | Fjern `@ts-nocheck`, wire opp `routeData`-prop, styling-polish |
| `components/map/map-view-3d.tsx` | Eksponér polyline-slot eller child-rendering for route |
| `components/variants/report/blocks/ReportOverviewMap.tsx` | Propager `routeData` til google3dSlot-ctx |
| `components/map/UnifiedMapModal.tsx` | Utvid `SlotContext` med adapter-switch og routeData |
| `docs/solutions/architecture-patterns/` | Ny doc: "map-layer-agnostic-controller" |

## Next

Kjør `/plan` for å omsette dette til implementasjonsplan. Deepen-plan vil fokusere på:
- Empirisk test av Google 3D flyCameraTo-cancel-semantikk
- `Polyline3DElement` outline/glow-kapabiliteter
- `MapView3D` route-child vs imperativ append-strategi
