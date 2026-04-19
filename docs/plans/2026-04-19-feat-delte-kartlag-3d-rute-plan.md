---
title: "feat: Delte kartlag (2D/3D) + walking-rute fra prosjekt til aktivt POI i 3D"
type: feat
date: 2026-04-19
branch: feat/map-modal-bunn-carousel
worktree: placy-ralph-map-carousel
based_on: docs/brainstorms/2026-04-19-delte-kartlag-3d-rute-brainstorm.md
test_url: http://localhost:3002/eiendom/broset-utvikling-as/wesselslokka/rapport
---

# feat: Delte kartlag (2D/3D) + walking-rute fra prosjekt til aktivt POI i 3D

## Enhancement Summary

**Deepened:** 2026-04-19
**Review-agenter brukt:** architecture-strategist, code-simplicity-reviewer, performance-oracle, kieran-typescript-reviewer, pattern-recognition-specialist, spec-flow-analyzer
**Research:** best-practices-researcher (Polyline3DElement API), framework-docs-researcher (@vis.gl/react-google-maps), learnings-researcher (docs/solutions/)

### Key Improvements fra deepen-pass

1. **Lift `routeData` til `SlotContext` fra dag én** (ikke post-V1). Eliminerer dobbelt-fetch ved mode-toggle (en fetch per toggle = unødvendig), dropper separat `ReportRoute3D`-wrapper-komponent. Per-POI-cache via `useMemo` på `activePOI.id`.
2. **Muter `Polyline3DElement.coordinates` i stedet for mount/unmount** ved POI-bytte. Forhindrer GPU-buffer-leak og forenkler StrictMode-race-håndtering. Én langlevet polyline-instans per `map3d`.
3. **`flyTo`-signatur støtter `altitude`** fra dag én — fremtidssikker mot 3D use-cases uten breaking change.
4. **`stop()` dokumenteres som best-effort** i JSDoc på MapAdapter — siste flyTo vinner uansett; token-pattern er primær cancel-mekanisme.
5. **9 nye acceptance criteria** (AC-11 til AC-19) fra spec-flow-analyzer: directions-failure, async-unmount, mode-switch under fly, toggle-rate-limiting, keyboard/a11y, screen-reader, camera-init ved pre-aktiv POI, WebGL-crash fallback, AbortController for rask POI-switch.
6. **Type-aliaser for `Map3DElement`** (`type GoogleMap3D = google.maps.maps3d.Map3DElement`) — ett endringspunkt for fremtidig API-drift.
7. **`coordinates` som navngitte objekter** (`{lat, lng}[]`), ikke `[number, number][]`-tuples — defensivt mot lat/lng-bytte-bugs.

### New Considerations Discovered

- Google Maps `Polyline3DElement` har **native** `outerColor`/`outerWidth`-outline — ingen behov for å stacke to polylines (forkastet Alternative B).
- `AltitudeMode.RELATIVE_TO_MESH` ville fulgt hustak — **`RELATIVE_TO_GROUND`** er korrekt for walking-rute (forkastet Alternative C fra brainstorm).
- `strokeWidth` er i **pixels**, ikke meter — skalerer ikke med zoom. Google-eksempler bruker `10` + `outerWidth: 0.4` for 4px outline.
- `stopCameraAnimation` eksisterer på `Map3DRef` fra @vis.gl, ikke nødvendigvis på `Map3DElement`-instansen vår adapter får — best-effort + token-pattern er planen.
- `@vis.gl/react-google-maps` v1.8.3 har **ingen** deklarativ `<Polyline3D>`-komponent — må gå imperativt via `map3d.append()`.

## Overview

Gjør `UnifiedMapModal` til et kart-agnostisk UI der 2D (Mapbox) og 3D (Google Photorealistic) er utbyttbare rendering-lag, mens alt annet UI — spesielt bottom-carousel, kategori-ikoner og kort-interaksjoner — er identisk på tvers. Toggle "Kart / 3D" bytter sømløst uten layout-shift. Når et POI aktiveres, vises en walking-rute fra prosjektet til POI-et i *begge* modusene (ikke bare 2D som i dag).

Bygger videre på de 5 commitsene som implementerer bunn-carousel (feat/map-modal-bunn-carousel). Målet er ett sammenhengende PR der begge konseptene leveres samlet — de deler 3D-adapter-laget og demoen viser hele verdien samtidig.

## Problem Statement

**Dagens situasjon:**
1. `ReportThemeSection.tsx:484` returnerer `null` fra `bottomSlot` når `mapMode === "3d"` → brukeren mister hele POI-navigasjonen når de bytter til 3D. Demo blir ujevnt.
2. `useInteractionController` (lib/map/use-interaction-controller.ts) er hardkodet mot `mapboxgl.Map` — `map.stop()` + `map.flyTo()`. Ingen måte å fly kameraet i 3D-modus fra kortklikk.
3. Walking-route-polyline vises kun i 2D (Mapbox `line-layer` i `ReportOverviewMap.tsx`/`RouteLayer`). 3D-modusen gir aerial-utsikt uten kontekst for *hvor* POI-et ligger i forhold til prosjektet.
4. `components/map/route-layer-3d.tsx` eksisterer som `@ts-nocheck`-stub med `Polyline3DElement`-implementasjon, men er ikke wired opp til noen render-slot.

**Hvorfor dette må løses nå:**
- Demo-scenariet (Wesselsløkka salgs-rapport) taper impact når 3D-modus er "tomt" uten POI-navigasjon og rute-kontekst.
- Bunn-carousel-arbeidet er allerede levert i 2D; 3D må følge med før PR kan merges for å unngå inkonsistent brukeropplevelse mellom modusene.
- Teknisk gjeld: hardkodet mapbox-avhengighet i `useInteractionController` vil forverre kodebasen for fremtidige kart-integrasjoner (f.eks. hvis vi senere ønsker CesiumJS eller Mapbox 3D terrain).

## Proposed Solution

Tre-lags tilnærming:

**Lag 1 — Adapter-abstraksjon (`MapAdapter`):**
Innfør et minimalt interface `MapAdapter` med kun to metoder: `stop()` og `flyTo({lat, lng}, opts)`. Token-race-patternet i `useInteractionController` forblir uendret (DOM-generisk rAF-guard). Refaktorer hooken til å ta `getAdapter()` i stedet for `getMap()`. To implementasjoner: `mapboxAdapter(map)` og `google3dAdapter(map3d)`.

**Lag 2 — Delt carousel på tvers av kartlag:**
Fjern `if (ctx.mapMode === "3d") return null` fra `ReportThemeSection.tsx:484`. Bottom-carousel rendres uendret — `SlotContext` har allerede alt som trengs (`activePOI`, `setActivePOI`, `registerCardElement`, `mapController`). UnifiedMapModal velger riktig adapter basert på `mapMode` og eksponerer den via `mapController`. Ingen endring i `ReportMapBottomCard` eller `ReportMapBottomCarousel`.

**Lag 3 — 3D walking-rute via `Polyline3DElement` (oppdatert etter deepen):**

`routeData` (GeoJSON LineString fra `/api/directions`) **løftes til `SlotContext`** og hentes én gang per `activePOI.id` via `useMemo`-cached fetch. Dette eliminerer dobbelt-fetch ved mode-toggle og gjør at 2D-`RouteLayer` og 3D-`RouteLayer3D` konsumerer samme data.

`RouteLayer3D` rendres inne i `google3dSlot` og er én **langlevet** `Polyline3DElement`-instans per `map3d`. Ved POI-bytte **muterer** vi `polyline.coordinates` — ikke unmount/remount. Dette forhindrer GPU-buffer-leak (iOS/Android) og forenkler StrictMode-race (ingen async mount/unmount-vindu).

Stil fra Google's native API: `strokeColor: "#3B82F6"`, `outerColor: "#FFFFFF"`, `strokeWidth: 10` (pixels), `outerWidth: 0.4` (40% = 4px outline), `AltitudeMode.RELATIVE_TO_GROUND`, `altitude: 3`, `drawsOccludedSegments: true`. AbortController på `/api/directions` ved rask POI-switch forhindrer race-condition (rute for tidligere POI blir ikke levert etter at bruker har byttet POI).

## Technical Approach

### Architecture

```
UnifiedMapModal
├── SlotContext {
│     mapMode, activePOI, setActivePOI, mapController, registerCardElement,
│     routeData,  ← NY: {coordinates, travelMinutes} | null, cached per activePOI.id
│     ...
│   }
│
├── mapboxSlot(ctx)         → ReportOverviewMap 2D → RouteLayer (Mapbox line-layer, konsumerer ctx.routeData)
├── google3dSlot(ctx)       → MapView3D            → RouteLayer3D (Polyline3DElement, konsumerer ctx.routeData)   ← NY
├── bottomSlot(ctx)         → ReportMapBottomCarousel  (UENDRET, men nå aktiv i 3D)
│
├── useRouteData(activePOI, projectCenter)   ← NY: fetcher /api/directions, cacher, AbortController
│
└── mapController = useInteractionController(getAdapter, getCardElement, getPOI)
                                         ↑
                                         └─ velger adapter per mapMode
                                            - mapboxAdapter(mapboxRef.current.getMap())
                                            - google3dAdapter(google3dRef.current)
```

### Nye filer (oppdatert etter deepen — `ReportRoute3D`-wrapper droppet)

```
lib/map/
├── map-adapter.ts              (interface + mapboxAdapter + google3dAdapter)
├── map-adapter.test.ts         (adapter-level unit tests)
├── use-interaction-controller.ts   (refaktorert — tar adapter, ikke map)
└── use-route-data.ts           (NY: henter/cacher routeData med AbortController)

components/map/
└── route-layer-3d.tsx          (rewrite fra @ts-nocheck-stub; én langlevet polyline + muterer coordinates)

docs/solutions/architecture-patterns/
└── map-adapter-2d-3d-20260419.md   (dokumenter mønsteret — naming justert per pattern-review)
```

### Implementation Phases

#### Phase 1: Adapter-abstraksjon (fundament)

**Mål:** `useInteractionController` fungerer adapter-agnostisk. Alle 7 eksisterende tester passerer.

**Tasks:**
1. Opprett `lib/map/map-adapter.ts`:
   ```ts
   // Ett endringspunkt for fremtidig Google Maps 3D API-drift.
   export type GoogleMap3D = google.maps.maps3d.Map3DElement;

   export type FlyToOptions = {
     /** Default true. false => instant (durationMs=0). */
     animate?: boolean;
     /** Override default duration. Default 400ms. */
     durationMs?: number;
   };

   export interface MapAdapter {
     /**
      * Best-effort imperativ cancel av pågående animasjon.
      * Mapbox: kaller map.stop(). Google 3D: no-op (API mangler
      * garantert stop på Map3DElement). Token-pattern i
      * useInteractionController er primær cancel-mekanisme.
      */
     stop(): void;

     /** Animér kamera til target. `altitude` brukes kun av 3D-adapter. */
     flyTo(
       target: { lat: number; lng: number; altitude?: number },
       opts?: FlyToOptions,
     ): void;
   }

   export function mapboxAdapter(map: mapboxgl.Map): MapAdapter { /* ... */ }
   export function google3dAdapter(map3d: GoogleMap3D): MapAdapter { /* ... */ }
   ```

   - **Mapbox:** `stop` → `map.stop()`; `flyTo` → `map.flyTo({center: [lng, lat], duration: opts?.animate === false ? 0 : (opts?.durationMs ?? 400), essential: true})`. `altitude` ignoreres.
   - **Google 3D:** `stop` → forsøker `(map3d as {stopCameraAnimation?: () => void}).stopCameraAnimation?.()` (feature-detection, no-op hvis fraværende); `flyTo` → `map3d.flyCameraTo({endCamera: {center: {lat, lng, altitude: target.altitude ?? map3d.center?.altitude ?? 0}, range: map3d.range, tilt: map3d.tilt, heading: map3d.heading}, durationMillis: opts?.animate === false ? 0 : (opts?.durationMs ?? 400)})` — **behold eksisterende tilt/heading** per brukervalg.

2. Refaktorer `lib/map/use-interaction-controller.ts`:
   - Erstatt `getMap: () => MapboxMap | null` med `getAdapter: () => MapAdapter | null`
   - Erstatt `map.stop()` + `map.flyTo(...)` med `adapter.stop()` + `adapter.flyTo(...)`
   - Token-pattern (flyToken, scrollToken, rAF-guard) UENDRET
   - `scrollCardIntoView` UENDRET (DOM-generisk)

3. Oppdater `use-interaction-controller.test.ts`:
   - Bytt mock `{ stop, flyTo }` til `MapAdapter`-mock (samme shape, samme pattern)
   - Alle 7 eksisterende tester må fortsatt passere

4. Opprett `lib/map/map-adapter.test.ts`:
   - Tests for `mapboxAdapter` (min 3):
     - `flyTo` konverterer `{lat, lng}` til `[lng, lat]` riktig
     - `flyTo` respekterer `animate: false` → `duration: 0`
     - `stop` kaller `map.stop()`
   - Tests for `google3dAdapter` (min 3):
     - `flyTo` bevarer eksisterende `tilt`, `heading`, `range`
     - `flyTo` respekterer `altitude` når gitt; fallback til `map3d.center.altitude`
     - `stop` er trygg feature-detection (no-op når `stopCameraAnimation` mangler)
   - Type-safety: bruk `MockedFunction<MapAdapter["flyTo"]>` for strikt type-check på mocks

5. Legg til **test for mode-switch race** i `use-interaction-controller.test.ts`:
   - Simulér: bruker kaller `flyTo(poiA)` → før rAF-guard resolver, `getAdapter()` returnerer ny adapter-instans (mode-skift) → verifiser at den andre flyTo ikke kjøres på gammel adapter (token-invalidation).

**Quality gate:** `npm test -- use-interaction-controller` + `npm test -- map-adapter` → alle grønne. `tsc --noEmit` → 0 errors.

**Estimert effort:** 60-75 min (inkludert race-test + altitude-støtte + type-aliaser).

---

#### Phase 2: Adapter-velger i UnifiedMapModal

**Mål:** `mapController` virker i både 2D- og 3D-modus. Adapter velges automatisk basert på `mapMode`.

**Tasks:**
1. I `components/map/UnifiedMapModal.tsx`:
   - Erstatt `const getMap = () => mapboxRef.current?.getMap() ?? null` med:
     ```ts
     const getAdapter = useCallback((): MapAdapter | null => {
       if (mapMode === "mapbox" && mapboxRef.current?.getMap) {
         const m = mapboxRef.current.getMap();
         return m ? mapboxAdapter(m) : null;
       }
       if (mapMode === "google3d" && google3dRef.current) {
         return google3dAdapter(google3dRef.current);
       }
       return null; // switching-states → no-op
     }, [mapMode]);
     ```
   - Send `getAdapter` til `useInteractionController` i stedet for `getMap`
   - Oppdater `SlotContext`-typen (ingen endring utad — `mapController` har samme API)

2. Verifiser `cancelAll()`-kall ved mapMode-skift (eksisterer allerede på linje 347-351) fortsatt fungerer.

3. Hold state-machine-transitions uendret. Adapter-velger returnerer `null` under `switching-to-3d`/`switching-to-2d`, og hooken no-ops silent.

**Quality gate:** Manuell test: toggle mellom 2D og 3D i modalen, klikk kort i begge modusene, verifiser at kameraet flyr riktig sted. `tsc --noEmit` → 0 errors.

**Estimert effort:** 20-30 min.

---

#### Phase 3: Delt bottom-carousel (fjern 3D-gate)

**Mål:** Bottom-carousel vises med identisk UI i både 2D- og 3D-modus. Kort-klikk fly kameraet i 3D.

**Tasks:**
1. `components/variants/report/ReportThemeSection.tsx:484`:
   - Fjern `if (ctx.mapMode === "3d") return null;`
   - Behold `if (topPOIs.length === 0) return null;`
   - Verifiser at `onCardClick` fortsatt virker (ctx.mapController.flyTo er adapter-agnostisk nå)

2. Verifiser `onMarkerClick` fungerer på tvers av modus:
   - I 2D: Mapbox-markører trigger `ctx.setActivePOI(poiId, "marker")` + `ctx.mapController.scrollCardIntoView(poiId, {behavior: "instant"})`. Uendret.
   - I 3D: `Marker3DElement`-klikk må trigge samme handler. Sjekk eksisterende kobling i `MapView3D`/`Map3DControls` — om ikke, legg til i en Phase 3b.

**Quality gate:** Manuell test på test-URL:
- [ ] Åpne modal, bytt til 3D
- [ ] Kort synes i bunnen
- [ ] Klikk på kort 2 — kameraet flyr til POI i 3D
- [ ] Klikk på POI-markør i 3D — korresponderende kort scrolles i visning og aktiveres
- [ ] Bytt tilbake til 2D — aktiv state bevares

**Estimert effort:** 20-30 min (ren UI-endring + verifisering).

---

#### Phase 4: 3D walking-rute via Polyline3DElement (omfattende oppdatering etter deepen)

**Mål:** Walking-rute i 3D, cachet på tvers av mode-toggle, ingen GPU-leak ved rask POI-bytte. Polished fra dag én.

**Arkitektur-endring:** Separate ansvar i 3 små lag: `useRouteData`-hook (fetch + cache + abort) → `SlotContext.routeData` → `RouteLayer3D` (muter eksisterende polyline-coordinates).

**Tasks:**

1. **Opprett `lib/map/use-route-data.ts`:**
   ```ts
   import { z } from "zod";

   const DirectionsResponseSchema = z.object({
     geometry: z.object({
       coordinates: z
         .array(z.tuple([z.number().finite(), z.number().finite()]))
         .min(2)
         .max(500),
       type: z.literal("LineString"),
     }),
     duration: z.number().nonnegative(),
   });

   export type RouteData = {
     coordinates: ReadonlyArray<{ lat: number; lng: number }>;
     travelMinutes: number;
   };

   export function useRouteData(
     activePOI: POI | null,
     projectCenter: { lat: number; lng: number },
   ): { data: RouteData | null; error: Error | null } {
     // useState + useEffect med:
     //   - Debounce 200ms på activePOI-endring (AC-21)
     //   - AbortController for cancel-on-change (AC-19)
     //   - Zod-validering av respons (AC-20)
     //   - Error-state rapporteres (caller beslutter UI — AC-11)
     //   - AbortError catch: return silent (ingen loggspam)
     //
     // Cache-strategi V1: single-slot (useState). Post-V1: LRU Map keyed på poi.id.
     //
     // Response shape → typed RouteData:
     //   geometry.coordinates: [[lng, lat], ...] → [{lat, lng}, ...]
     //   duration (minutes) → travelMinutes
   }
   ```
   Referanse-fetch-pattern: `ReportThemeMap.tsx:132`, men med AbortController + debounce + Zod.

2. **Utvid `SlotContext` i `UnifiedMapModal.tsx`:** legg til `routeData: RouteData | null` felt. `UnifiedMapModal` kaller `useRouteData(activePOI, projectCenter)` og legger resultatet i slotCtx.

3. **Omskriv `components/map/route-layer-3d.tsx`:**
   - Fjern `@ts-nocheck`
   - Props: `{ map3d: GoogleMap3D | null; routeData: RouteData | null }`
   - **Én langlevet polyline-instans** (opprettes ved map3d-ready, fjernes ved unmount). Ved routeData-endring: muter `polyline.coordinates` i stedet for remount.
   ```ts
   // Skisse:
   const polylineRef = useRef<google.maps.maps3d.Polyline3DElement | null>(null);
   const libraryRef = useRef<google.maps.Maps3DLibrary | null>(null);

   // Effect 1: Lazy-import library + opprett polyline NÅR map3d blir klar
   useEffect(() => {
     if (!map3d) return;
     let cancelled = false;
     (async () => {
       const lib = libraryRef.current ?? (await google.maps.importLibrary("maps3d") as google.maps.Maps3DLibrary);
       if (cancelled || !map3d) return;
       libraryRef.current = lib;
       if (polylineRef.current) return; // allerede opprettet

       const polyline = new lib.Polyline3DElement({
         strokeColor: "#3B82F6", outerColor: "#FFFFFF",
         strokeWidth: 10, outerWidth: 0.4,
         altitudeMode: lib.AltitudeMode.RELATIVE_TO_GROUND,
         drawsOccludedSegments: true,
       });
       polyline.coordinates = [];
       map3d.append(polyline);
       if (cancelled) { polyline.remove(); return; } // AC-12 sikkerhet
       polylineRef.current = polyline;
     })();
     return () => {
       cancelled = true;
       polylineRef.current?.remove();
       polylineRef.current = null;
     };
   }, [map3d]);

   // Effect 2: Muter coordinates når routeData endres
   useEffect(() => {
     const polyline = polylineRef.current;
     if (!polyline) return;
     polyline.coordinates = (routeData?.coordinates ?? []).map(
       ({ lat, lng }) => ({ lat, lng, altitude: 3 }),
     );
   }, [routeData]);

   return null;
   ```
   - **StrictMode-guard:** `cancelled`-flag sjekket **før og etter** `map3d.append()` (AC-12). Se `docs/solutions/ui-bugs/google-maps-3d-popover-not-rendering.md`.

4. **Wire opp i google3dSlot** i `components/variants/report/blocks/ReportOverviewMap.tsx`:
   ```tsx
   google3dSlot={(ctx) => (
     <>
       <MapView3D ... onMapReady={ctx.registerGoogle3dMap} />
       <RouteLayer3D map3d={ctx.google3dRef.current} routeData={ctx.routeData} />
     </>
   )}
   ```

5. **Oppdater 2D `RouteLayer`-forbruker** til å lese fra `ctx.routeData` i stedet for lokalt state (konsolider fetch). Sjekk at eksisterende 2D-oppførsel er uendret (regresjonssjekk).

6. **SSR-guard:** `RouteLayer3D` og `use-route-data.ts` er `"use client"`. `google.maps.importLibrary` refereres kun inne i `useEffect` (client-side).

**Quality gate (manuell test på test-URL):**
- [ ] AC-6: Blå linje med hvit outline vises i 3D når POI aktivt
- [ ] AC-7: Linje svever 3m over bakkemesh, ingen z-fighting (RELATIVE_TO_GROUND)
- [ ] AC-8: strokeWidth 10px + 4px outline = leselig fra aerial-vinkel
- [ ] AC-9: POI-bytte → coordinates muteres, ingen remount-flicker
- [ ] AC-10: Rask klikk 5x → kun siste POI's rute vises, ingen lingering polylines
- [ ] AC-11: Directions-failure → ruten forblir usynlig, kamera-fly skjer, kort aktiveres
- [ ] AC-12: Lukk modal under importLibrary-resolve → ingen polyline appended til detached map3d
- [ ] AC-19: AbortController canceller forrige fetch ved rask POI-switch (verifiser i Network-tab)
- [ ] Toggle til 2D og tilbake → rute vises i begge modus uten re-fetch (verifiser i Network-tab: kun 1 request per POI)

**Estimert effort:** 75-105 min (inkludert use-route-data-hook + polyline-mutation-strategi + empirisk altitude-test + AbortController).

---

#### Phase 5: Polish & observability

**Mål:** Edge-cases håndtert, demo-klar.

**Tasks:**
1. Edge-case: `coordinates.length === 0` (API failure eller no-route) → ingen polyline rendret, ingen error
2. Edge-case: rask switch mellom POI-er i 3D → gammel polyline fjernes før ny appendes (cleanup i useEffect)
3. Edge-case: toggle mellom 2D/3D mens rute er aktiv → rute følger med (re-fetches fra aktiv state ved mount)
4. Visual regression-sjekk: kjør Chrome DevTools MCP på test-URL, ta screenshot av 2D vs 3D med aktivt POI side-by-side. Legg i WORKLOG.md.
5. Dokumenter i `docs/solutions/architecture-patterns/map-adapter-pattern-20260419.md`:
   - Hvorfor adapter-pattern (mapbox/google3d konkrete forskjeller)
   - Native outline-trick (`outerColor`/`outerWidth`)
   - `RELATIVE_TO_GROUND` vs `RELATIVE_TO_MESH` (feil valg ville fulgt hustak)
   - Token-pattern er uendret — DOM-generisk
6. Oppdater WORKLOG.md

**Quality gate:** Chrome DevTools MCP kjøring med alle AC verifisert. `npm test` + `npm run lint` + `npm run build` = alle grønne.

**Estimert effort:** 30-45 min.

---

## Alternative Approaches Considered

### A. Full abstraksjon over alle kart-operasjoner
Bygge et komplett `UnifiedMap`-interface som wrapper ALLE mapbox/google3d-metoder (markers, popovers, layers, events). **Forkastet** fordi:
- YAGNI: vi trenger kun flyTo + stop i adapter. Resten er slot-spesifikt og bedre tjent av separate kodeveier per slot.
- Over-engineering gir koblet test-overflate. To små adaptere er enklere å teste og endre.

### B. Stack to polylines for outline (underliggende hvit + overliggende blå)
Før research trodde jeg native outline ikke fantes. **Forkastet** etter research: `Polyline3DElement` har native `outerColor` + `outerWidth`. Google sitt eget eksempel bruker nøyaktig dette mønsteret.

### C. `RELATIVE_TO_MESH` altitude-mode
Brainstormen foreslo dette. **Forkastet** etter research: RELATIVE_TO_MESH følger 3D-mesh inkludert bygninger — walking-ruta ville klatret på hustak. Riktig valg er `RELATIVE_TO_GROUND` med altitude 2-3m (konstant clearance over bakkemesh).

### D. Stor cancel-refactor til Promise-basert flyCameraTo
`flyCameraTo` kan wrappes i Promise via `gmp-animationend`-event. **Forkastet for V1**: Token-patternet vårt gjør ikke bruk av await-semantikk — siste call vinner både i mapbox og google3d. Promise-wrap er nice-to-have for fremtidig awaiting, ikke kritisk nå.

### E. To separate PR-er (én per konsept)
**Forkastet** per brukervalg: konseptene deler 3D-adapter-laget. Split ville gitt koordinerings-overhead uten risiko-isolasjonsgevinst (én enkelt PR er fortsatt liten nok for review).

### F. Mount/unmount polyline per POI-bytte (NY — vurdert i deepen)
Original plan gjorde dette. **Forkastet etter performance-review:** GPU-buffer-allokering per mount er risikabelt på iOS/Android. Korrekt løsning er én langlevet instans med `coordinates`-mutasjon.

### G. Dropp MapAdapter, inline if-check i hook (NY — foreslått av simplicity-reviewer)
Simplicity-reviewer argumenterte for å inline engine-detaljer direkte i `useInteractionController` for å spare ~80 LOC. **Forkastet etter avveining:**
- Adapter er konsistent med eksisterende `lib/trip-adapter.ts` og `lib/utils/camera-map.ts`-stil (pure-function-closures)
- ISP-gevinst: interfacet er kun 2 metoder — ikke over-engineering
- Testbarhet: adapter-mocking er renere enn if-sjekk-mocking
- Fremtidig CesiumJS/Mapbox-3D er "usikker" men ikke usannsynlig — adapter gjør tillegg trivielt
Konklusjon: **80 LOC er en billig pris for klar separation of concerns.**

## Acceptance Criteria

### Functional Requirements

- [ ] **AC-1:** Bottom-carousel vises med identisk UI i 2D- og 3D-modus (samme kort, samme kategori-ikoner, samme kort-bredde, samme active-state-morph)
- [ ] **AC-2:** Kort-klikk i 2D-modus flyr Mapbox-kameraet til POI (uendret fra dagens oppførsel)
- [ ] **AC-3:** Kort-klikk i 3D-modus flyr Google 3D-kameraet til POI via `flyCameraTo`, behold eksisterende tilt/heading
- [ ] **AC-4:** POI-markør-klikk i 3D scroller korresponderende kort i visning og aktiverer det
- [ ] **AC-5:** Toggle mellom 2D/3D bevarer aktiv POI-state (hvis POI X er aktivt i 2D, forblir det aktivt etter skift til 3D)
- [ ] **AC-6:** I 3D vises walking-rute som blå polyline med hvit outline fra prosjekt til aktivt POI
- [ ] **AC-7:** Polyline-altitude er `RELATIVE_TO_GROUND` med 3m høyde (konstant clearance, følger bakke-mesh)
- [ ] **AC-8:** Polyline-strokeWidth er 10px, outerWidth 0.4 (40% = 4px outline), `drawsOccludedSegments: true`
- [ ] **AC-9:** Polyline fjernes når POI deaktiveres; `coordinates` muteres (ikke unmount/remount) ved POI-bytte
- [ ] **AC-10:** Rask klikking mellom POI-er i 3D gir ingen lingering polylines og ingen GPU-buffer-leak (én langlevet instans)

**Nye AC-er fra deepen (spec-flow-analyzer):**

- [ ] **AC-11:** `/api/directions`-failure logges via eksisterende error-handler; kamera-fly skjer uavhengig av rute-fetch; POI aktiveres uansett. Ingen synlig feilmelding (stillhet i begge moduser — konsistent med dagens 2D-oppførsel).
- [ ] **AC-12:** Unmount av `RouteLayer3D` eller modal-close under `importLibrary`-resolve skal ikke appende polyline til detached `map3d`. Cancelled-flag sjekket før og etter `map3d.append()`.
- [ ] **AC-13:** Mode-switch under pågående fly-animation: ny map-instans flyr til `activePOI` umiddelbart ved mount hvis `activePOI !== null`. Tokens fra forrige adapter invalideres.
- [ ] **AC-14:** Toggle-button er disabled under `switching-*`-states (forhindrer rask toggle-spam → iOS WebGL-crash).
- [ ] **AC-15:** Arrow-keys (Left/Right/Home/End) på bottom-carousel fungerer identisk i 2D og 3D. Tab-rekkefølge: toggle-button → carousel → lukk-button.
- [ ] **AC-16:** Aktiv POI annonseres via eksisterende `aria-live`-region med reisetid ("5 min gange til Rema 1000"). Samme pattern i 2D og 3D — ingen ny announcement for rute-visning (visuell-only).
- [ ] **AC-17:** Ved mount av 3D med `activePOI !== null`: kamera starter sentrert på POI (ikke standard project-center). Implementert via `useEffect` som kaller `mapController.flyTo(activePOI.coords, {animate: false})` når `getAdapter()` blir ikke-null og `activePOI` finnes.
- [ ] **AC-18:** 3D-mount-failure (WebGL-crash, `mapId` ugyldig, etc.) faller tilbake til 2D med discreet toast. Carousel forblir funksjonell. Leveres kun hvis vi allerede har et error-boundary-pattern — ellers dokumentert som follow-up.
- [ ] **AC-19:** Rask POI-switch canceller forrige `/api/directions`-fetch via `AbortController`. Polyline viser alltid siste aktive POI's rute, aldri stale data. `AbortError` svelges i catch (ikke loggspam).
- [ ] **AC-20:** `/api/directions`-response valideres med Zod før state-update: `z.object({geometry: z.object({coordinates: z.array(z.tuple([z.number().finite(), z.number().finite()])).min(2).max(500), type: z.literal("LineString")}), duration: z.number().nonnegative()})`. Max 500 coordinates forhindrer minne-DoS fra corrupted response. Invalid respons → `routeData: null`, ingen polyline rendret, feilen logges uten å lekke koordinater.
- [ ] **AC-21:** `useRouteData` debouncer fetch-trigger med 200ms etter `activePOI`-endring. Forhindrer DoS på `/api/directions` ved rask POI-spam. Debounce er klientsidig; serverside rate-limit er separat concern (NFR-9).

### Non-Functional Requirements

- [ ] **NFR-1:** `npm run build` passerer uten TS-feil eller warnings
- [ ] **NFR-2:** Eksisterende 7 tester i `use-interaction-controller.test.ts` passerer etter adapter-refaktorering
- [ ] **NFR-3:** Nye tester i `map-adapter.test.ts` (min 4 tester: 2 per adapter)
- [ ] **NFR-4:** Ingen iOS WebGL-context-regresjoner (4-state machine uendret, verifisert)
- [ ] **NFR-5:** SSR-trygg (`google`-objektet refereres aldri uten client-guard)
- [ ] **NFR-6:** Ingen runtime-warnings i Chrome DevTools console ved toggle mellom moduser
- [ ] **NFR-7:** Polyline-mount/unmount respekterer StrictMode double-render (cancelled-flag pattern)
- [ ] **NFR-8:** API-nøkler verifisert før merge: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` har HTTP-referrer-restrictions (placy.no + localhost:3002), kvote-cap, og er begrenset til Maps JavaScript API + Photorealistic 3D Tiles. `MAPBOX_ACCESS_TOKEN` er serverside-only (ingen `NEXT_PUBLIC_`-prefiks). Dokumentert med skjermbilde av Google Cloud Console-config i WORKLOG.
- [ ] **NFR-9:** `/api/directions` har input-validering (lat/lng som `Number` + range-check -90..90 / -180..180) og rate-limit (60 req/min per IP). Hvis rate-limit ikke finnes: flagg som follow-up issue, ikke blocker for V1 demo.

### Quality Gates

- [ ] `npm run lint` → 0 errors, 0 warnings
- [ ] `npm test` → alle grønne
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run build` → succeeds
- [ ] Chrome DevTools MCP screenshot-verifisering av AC-1 til AC-10
- [ ] Manuell E2E-test på test-URL, alle 10 AC verifisert
- [ ] WORKLOG.md oppdatert
- [ ] Ny doc: `docs/solutions/architecture-patterns/map-adapter-pattern-20260419.md`

## Success Metrics

- **Demo-impact:** 3D-modus er nå *like* navigerbar som 2D. Salgs-demo kan starte i 2D, toggle til 3D for aerial-wow-faktor, og beholde full POI-funksjonalitet.
- **Teknisk gjeld:** 0 mapbox-spesifikke imports i `lib/map/use-interaction-controller.ts` etter refactor.
- **Kodebase-renhet:** `route-layer-3d.tsx` er ikke lenger `@ts-nocheck` — full type-safety gjenopprettet.

## Dependencies & Prerequisites

**Bibliotek:**
- `@vis.gl/react-google-maps@^1.8.3` (allerede installert)
- `mapbox-gl` (allerede installert)
- `google.maps.maps3d.*` via `google.maps.importLibrary("maps3d")` (runtime, ingen build-tid-import)

**Andre PR-er / arbeid som må være ferdig:**
- feat/map-modal-bunn-carousel (5 commits) er fundamentet — allerede på branchen
- Ingen blokkerende work-items

**Eksterne avhengigheter:**
- Google Maps API-nøkkel med 3D Tiles aktivert (allerede konfigurert for test-URL)

## Risk Analysis & Mitigation

### 3.1 Google 3D `stopCameraAnimation`-API — eksakt tilgjengelighet
**Risk:** Research viste at `stopCameraAnimation()` eksponeres av `Map3DRef` fra `@vis.gl/react-google-maps`, ikke direkte på `Map3DElement`. Vår `google3dAdapter` får imperativ tilgang til `Map3DElement` (ikke `Map3DRef`).

**Impact:** Hvis `stopCameraAnimation` ikke er tilgjengelig på `Map3DElement`, må `stop()` være no-op i `google3dAdapter` — men siste flyCameraTo overskriver uansett, så token-pattern garanterer cancel.

**Mitigation:**
- Phase 1 verifikasjon: prøv `map3d.stopCameraAnimation?.()` i adapter. Hvis metoden eksisterer, bruk den. Hvis ikke, no-op.
- Legg til empirisk test: klikk raskt mellom to POI-er i 3D — verifiser at andre flyCameraTo starter fra current state (ikke hopper fra opprinnelig start).
- Dokumenter faktisk oppførsel i `map-adapter-pattern-20260419.md`.

### 3.2 Altitude-kalibrering på Photorealistic 3D Tiles Trondheim
**Risk:** Google's anbefaling "2-3m" altitude er uten eksplisitt docs-grunnlag — empirisk fra Cesium/Mapbox-community. Trondheim-tiles kan ha annen mesh-oppløsning enn Oslo/test-områder.

**Impact:** For lav altitude → z-fighting (flimmer). For høy → ruta ser "svevende" ut i nadir.

**Mitigation:**
- Test på Wesselsløkka med altitude: 2, 3, 5, 8 — velg visuelt beste.
- Hvis problemer: iterer i Phase 4, ikke ship dårlig visuell kvalitet.
- Dokumenter valgt altitude + rationale i doc.

### 3.3 `routeData` dobbelt-fetch (REDUSERT — løst via SlotContext-lift)
**Oppdatert etter deepen:** Performance-reviewer flagget at "kun ved mode-switching" var feil — det skjer **ved hver toggle**, ikke bare switching. Løsning inkorporert i Phase 4: `useRouteData`-hook i `UnifiedMapModal` cacher per `activePOI.id`, og `routeData` eksponeres via `SlotContext`. Både 2D-`RouteLayer` og 3D-`RouteLayer3D` konsumerer samme data. **Null dobbelt-fetch i V1.**

**Residual risk:** Hook-ens useState kan race ved veldig rask POI-switch hvis AbortController ikke brukes. Mitigering: AC-19 + AbortController i `use-route-data.ts`.

### 3.4 StrictMode double-mount race
**Risk:** React StrictMode kjører useEffect to ganger. Polyline3DElement kan mountes, unmountes, mountes igjen før første async `importLibrary` resolver.

**Impact:** Polyline synes ikke, eller dobbelt polyline appended.

**Mitigation:**
- `let cancelled = false` + `if (cancelled) return` etter importLibrary await. Mønster fra `google-maps-3d-popover-not-rendering.md`.
- Cleanup fjerner polyline via `polyline?.remove()`.
- Dokumentert i AC-NFR-7.

### 3.5 Bunn-carousel blokkerer 3D-kart-gestures
**Risk:** Bottom-carousel rendres som absolute overlay med `pointer-events-auto` på content. I 3D kan dette blokkere orbit-drag/zoom-gestures hvis brukeren prøver å dra i området hvor kortene ligger.

**Impact:** UX-degradering i 3D (man kan ikke orbit der kortene er).

**Mitigation:**
- Carousel-wrappen har allerede `pointer-events-none` på container, `auto` kun på content (UnifiedMapModal.tsx:516-517).
- Kort-bredde er 280-300px, gap 12px — de fleste 3D-gestures har plass til å ta tak i mellom/over kortene.
- Post-V1: vurder auto-collapse av carousel ved langvarig 3D-interaksjon. Ikke V1.

### 3.6 Polyline GPU-buffer-leak ved rask POI-bytte (NY fra deepen — performance-oracle)
**Risk:** Original plan unmounted/remounted `Polyline3DElement` per POI-endring. På iOS/Android kan dette akkumulere WebGL-buffere fordi 3D-tiles-rendereren ikke alltid frigjør ressurser raskt.

**Impact:** Memory leak ved rask POI-spam, potensielt WebGL-context-crash på iOS (1-kontekst-limit dokumentert i `google-maps-3d-webgl-context-crash-touch-devices-20260415.md`).

**Mitigation:**
- **Løst i Phase 4:** én langlevet `Polyline3DElement`-instans per `map3d`. Ved POI-bytte muteres `polyline.coordinates` — ingen allokering av nye buffere.
- Verifikasjonsmetode: `mcp__chrome-devtools__take_memory_snapshot` før/etter 50 raske POI-byttes i 3D. Se etter retained polyline-objekter eller voksende WebGL-buffer-sum.

### 3.8 DoS-risiko mot `/api/directions` (NY fra tech-audit — security-sentinel)
**Risk:** Rask POI-spam klientsidig multipliseres mot Mapbox Directions API (vår serverside-proxy). Selv om klient aborter, fullfører Next.js-routen til Mapbox.

**Impact:** Mapbox-kvote kan brukes opp, serverside-cost øker. Demo-risk lav, prod-risk reell.

**Mitigation (innebakt i AC-20/21/NFR-9):**
- Debounce 200ms i `useRouteData` (AC-21)
- Zod-validering + max 500 coordinates (AC-20)
- Serverside rate-limit 60 req/min/IP (NFR-9) — hvis ikke allerede på plass, flagget som follow-up
- Vurder Redis/memory-cache på `/api/directions` keyed på `origin+destination+profile` med 24h TTL (post-V1)

### 3.9 Malformed Directions-response crasher Polyline3DElement (NY fra tech-audit — security-sentinel)
**Risk:** Hvis `/api/directions` returnerer `{coordinates: null}` eller strings i stedet for numbers, `polyline.coordinates = [...]` kan kaste runtime-feil.

**Impact:** 3D-modus kræsjer for brukeren ved spesifikke POI-er.

**Mitigation (AC-20):** Zod-schema-validering før state-update. Ved schema-failure: `routeData: null`, polyline rendres ikke, feilen logges uten koordinater.

### 3.7 Adapter `stop()` som leaky abstraction (NY fra deepen — architecture-strategist)
**Risk:** `MapAdapter.stop()` lover imperativ cancel. Mapbox leverer. Google 3D er best-effort (fallback til no-op hvis `stopCameraAnimation` mangler på `Map3DElement`-instansen). Fremtidige lesere kan anta sterkere garanti.

**Impact:** Fremtidige bugs hvis noen bruker `stop()` antatt deterministisk cancel.

**Mitigation:**
- JSDoc på `MapAdapter.stop()` eksplisitt dokumenterer best-effort-semantikk.
- Peker på token-pattern som primær cancel-mekanisme.
- Dokumentert i `docs/solutions/architecture-patterns/map-adapter-2d-3d-20260419.md`.

## Resource Requirements

**Tid:** ~3-4 timer totalt
- Phase 1 (adapter): 45-60 min
- Phase 2 (velger): 20-30 min
- Phase 3 (delt carousel): 20-30 min
- Phase 4 (3D-rute): 60-90 min
- Phase 5 (polish): 30-45 min

**Tools:** Chrome DevTools MCP for visuell verifisering.
**Infrastructure:** Local dev server på :3002 (allerede kjører i worktree).

## Future Considerations

Etter V1 levert:
1. **Awaitable flyTo:** Wrap adapter-flyTo i Promise via `gmp-animationend` for deterministisk awaiting (f.eks. chained animations i story-mode).
2. **Multi-POI-rute:** Vis rute til topp-3 POI-er samtidig, ulike farger per kategori.
3. **Transit-ruter:** Legg til kollektivtransport-rute-variant i 3D (krever `/api/entur`-integrasjon).
4. **Altitude-kalibrering automatisk:** Query terrain-elevation via Google Elevation API for å sette optimal altitude per segment.
5. **Animert path-trace:** Bygg ruta gradvis (fra prosjekt til POI) — demo-impact, men krever `gmp-animationend`-coordination.
6. **Delt POI-marker-adapter:** Abstrahér også marker-rendering (i dag: egne impls per slot). Ikke YAGNI-begrunnet før vi har 3. kart-motor.

## Documentation Plan

**Nye docs:**
- `docs/solutions/architecture-patterns/map-adapter-pattern-20260419.md` — mønsteret, hvorfor, alternativene vi forkastet, empiriske funn (altitude, stopCameraAnimation)

**Oppdateringer:**
- `WORKLOG.md` — legg til dagsoppføring etter ship
- `CLAUDE.md` — vurder om adapter-pattern bør nevnes i arkitekturregler (sannsynligvis ikke — for spesifikt for ett modul)
- `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md` — oppdater med referanse til nytt adapter-mønster

**Kode-kommentarer:**
- Blokk-kommentar øverst i `map-adapter.ts` som forklarer token-pattern og hvorfor adapter er minimal
- Kommentar ved `altitude: 3` i `route-layer-3d.tsx` — rationale og referanse til doc

## References & Research

### Internal References

- **Brainstorm:** `docs/brainstorms/2026-04-19-delte-kartlag-3d-rute-brainstorm.md`
- **Eksisterende 3D-integrasjon:**
  - `components/map/map-view-3d.tsx` (React-wrapper med `MapReadyBridge`-pattern)
  - `components/map/Map3DControls.tsx:32-40` (`Map3DAny` duck-type)
  - `components/map/Map3DControls.tsx:74-86` (kanonisk `flyCameraTo`-bruk)
  - `components/map/route-layer-3d.tsx` (stub som skal aktiveres)
  - `types/google-maps-3d.d.ts:82-84` (ambient types for Polyline3DElement)
- **Slot-arkitektur:**
  - `components/map/UnifiedMapModal.tsx:61-87` (SlotContext)
  - `components/map/UnifiedMapModal.tsx:177-183` (registerMapboxMap/registerGoogle3dMap)
  - `components/map/UnifiedMapModal.tsx:40` (mapMode state-machine)
  - `components/map/UnifiedMapModal.tsx:347-351` (cancelAll ved mode-skift)
  - `components/map/UnifiedMapModal.tsx:515-519` (bottomSlot overlay-rendering)
- **Hook-arkitektur:**
  - `lib/map/use-interaction-controller.ts` (77 linjer, skal refaktoreres)
  - `lib/map/use-interaction-controller.test.ts` (7 eksisterende tester, må fortsatt passere)
  - `lib/utils/camera-map.ts` (pure-function-closures-pattern som adapter skal følge)
- **Route-data-flow (2D):**
  - `components/variants/report/ReportThemeMap.tsx:132` (fetch-pattern)
  - `components/map/route-layer.tsx` (RouteLayer — 2D referanse-impl)

### Institutional Learnings

- `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md` — 4-state machine, iOS WebGL 1-context limit
- `docs/solutions/feature-implementations/google-maps-3d-report-block-20260415.md` — tidligere Polyline3DElement-stub-beslutning
- `docs/solutions/feature-implementations/google-maps-3d-camera-control-iteration-20260415.md` — anti-patterns (JS property-override, defineProperty)
- `docs/solutions/ui-bugs/google-maps-3d-popover-not-rendering.md` — StrictMode double-mount race + cancelled-flag pattern
- `docs/solutions/ui-bugs/google-maps-3d-webgl-context-crash-touch-devices-20260415.md` — iOS kontekst-håndtering
- `docs/solutions/ui-bugs/useeffect-object-dependency-infinite-loop-20260410.md` — primitive deps vs objekt-deps

### External References

**Google Maps Photorealistic 3D Tiles:**
- [Shapes and lines | Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/3d/shapes-lines)
- [Basic polyline example](https://developers.google.com/maps/documentation/javascript/examples/3d/polyline)
- [3D Maps JS API reference](https://developers.google.com/maps/documentation/javascript/reference/3d-map)
- [3d-map-draw reference](https://developers.google.com/maps/documentation/javascript/reference/3d-map-draw) (Polyline3DElement full API)
- [Camera positioning and movement](https://developers.google.com/maps/documentation/javascript/examples/3d/move-camera)
- [Control the map and camera](https://developers.google.com/maps/documentation/javascript/3d/interaction)

**@vis.gl/react-google-maps:**
- [Map3D component docs](https://github.com/visgl/react-google-maps/blob/main/docs/api-reference/components/map-3d.md)
- [npm @vis.gl/react-google-maps](https://www.npmjs.com/package/@vis.gl/react-google-maps)

**Relaterte patterns:**
- [Immerse yourself: 3D Maps blog](https://mapsplatform.google.com/resources/blog/immerse-yourself-how-to-get-started-using-3d-maps-in-the-maps-javascript-api/)
- [Add markers and animation codelab](https://developers.google.com/codelabs/maps-platform/maps-platform-3d-maps-js-markers)

### Deepen-review-outputs (2026-04-19)

- **architecture-strategist:** adapter-pattern konsistent med eksisterende `camera-map.ts`-stil; flagget mode-switch race (→ AC-13 + ny test i Phase 1); `stop()` som leaky abstraction (→ risiko 3.7 + JSDoc).
- **code-simplicity-reviewer:** foreslo å droppe adapter; forkastet i Alternative G med rationale.
- **performance-oracle:** P0 dobbelt-fetch (→ lift til SlotContext); P1 GPU-leak (→ muter coordinates, risiko 3.6); P3 durationMillis distanseavhengig (→ future-consideration).
- **kieran-typescript-reviewer:** altitude-støtte i flyTo (→ oppdatert signatur); `GoogleMap3D` type-alias (→ tilføyd); `{lat, lng}[]` i stedet for tuples (→ implementert i Phase 4).
- **pattern-recognition-specialist:** doc-naming `map-adapter-2d-3d-20260419.md` (→ oppdatert); `ReportRoute3D` feilplassert i `blocks/` (→ moot, wrapper droppet); filstruktur konsistent.
- **spec-flow-analyzer:** 9 missing AC-er (→ AC-11 til AC-19).

### Tech-audit-verdict (2026-04-19)

**Verdict: YELLOW** — løst ved oppdatert plan

- **security-sentinel:** Medium-risk DoS på `/api/directions` ved rask POI-spam (→ AC-21 debounce 200ms + NFR-9 rate-limit); Medium-risk malformed response kan krasje `Polyline3DElement` (→ AC-20 Zod-validering + max 500 coords); Medium-risk API-nøkkel-eksponering (→ NFR-8 verifiser referrer-restrictions).
- **data-integrity-guardian:** LAV risiko. Ingen DB-endringer. Client-side cache-coherence OK via `activePOI.id`-nøkkel. Tre små anbefalinger (persistering, AbortError-svelging, ID-basert POI-referering) er allerede dekket i plan.

**Alle YELLOW-funn er nå addressert i planen** via AC-20/21, NFR-8/9, og risiko 3.8/3.9. Planen går til GREEN etter denne oppdateringen.

### Related Work

- **Branch:** `feat/map-modal-bunn-carousel` (5 commits bygger opp bunn-carousel-arbeid)
- **Plan som blokkerer:** Ingen. Denne planen er self-contained på worktree.

## Next

Kjør `/deepen-plan` for å berike planen med enda mer research (empirisk test av `stopCameraAnimation`, visuell altitude-kalibrering-strategi), deretter `/tech-audit` for teknisk validering før Trello-kortet opprettes.
