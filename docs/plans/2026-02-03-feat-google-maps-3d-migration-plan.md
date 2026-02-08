---
title: "feat: Migrate to Google Maps 3D JavaScript API"
type: feat
date: 2026-02-03
---

# Migrate Placy to Google Maps 3D JavaScript API

## Overview

Migrere Placy fra Mapbox GL JS til Google Maps 3D JavaScript API for å få fotorealistisk 3D-visning med satellite-bilder, bygninger og terreng. Dette gir en "wow-effekt" som differensierer Placy fra konkurrenter.

**Brainstorm:** `docs/brainstorms/2026-02-03-google-maps-3d-migration-brainstorm.md`

## Problem Statement / Motivation

1. **Mangler 3D-visualisering** - Dagens 2D-kart gir ikke brukere romlig forståelse av nabolag
2. **Svak differensiering** - Flat kartvisning ser ut som alle andre eiendomsplattformer
3. **Begrenset "wow-effekt"** - Første inntrykk er ikke minneverdig

**Målet:** Gi brukere en immersiv, fotorealistisk 3D-opplevelse som bygger tillit og engasjement.

## Proposed Solution

Bytt helt fra Mapbox til Google Maps 3D JavaScript API:

- Bruk `<gmp-map-3d />` web component via `@vis.gl/react-google-maps`
- Migrer alle fire kart-komponenter (MapView, ExplorerMap, GuideMap, MasterMap)
- Behold funksjonell paritet med dagens løsning
- Legg til 3D-spesifikke forbedringer (tilt, fly-through)

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    App Layout                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │         APIProvider (Google Maps)                │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │           Map3DProvider                  │    │   │
│  │  │  (shared context for camera, markers)    │    │   │
│  │  │  ┌─────────────────────────────────┐    │    │   │
│  │  │  │  ExplorerMap3D / GuideMap3D     │    │    │   │
│  │  │  │  ┌─────────────────────────┐    │    │    │   │
│  │  │  │  │  <gmp-map-3d />         │    │    │    │   │
│  │  │  │  │  + Marker3DElement      │    │    │    │   │
│  │  │  │  │  + Polyline3DElement    │    │    │    │   │
│  │  │  │  └─────────────────────────┘    │    │    │   │
│  │  │  └─────────────────────────────────┘    │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| React wrapper | `@vis.gl/react-google-maps` | Google-sponsored, TypeScript, maintained |
| Marker type | `Marker3DInteractiveElement` | Supports click events |
| Route styling | Single `Polyline3DElement` | Simpler than 3-layer approach |
| Camera default | 45° tilt, north-up | Balance 3D effect with usability |
| Directions API | Keep Mapbox backend | Avoid double migration, works fine |
| Fallback | Error message + list view | WebGL required for 3D |

### Files to Change

**Must Change:**
| File | Change |
|------|--------|
| `components/map/map-view-3d.tsx` | New: Google 3D map component |
| `components/map/poi-marker-3d.tsx` | New: 3D marker with PinElement |
| `components/map/route-layer-3d.tsx` | New: 3D polyline component |
| `components/variants/explorer/ExplorerMap.tsx` | Replace Mapbox with 3D |
| `components/variants/guide/GuideMap.tsx` | Replace Mapbox with 3D |
| `app/layout.tsx` | Remove Mapbox CSS, add Google script |
| `app/globals.css` | Remove `.mapboxgl-*` styles |
| `.env.example` | Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| `package.json` | Add `@vis.gl/react-google-maps`, remove `react-map-gl` |

**May Keep (backend unchanged):**
| File | Status |
|------|--------|
| `/api/directions/route.ts` | Keep Mapbox - works fine |
| `/api/travel-times/route.ts` | Keep Mapbox - works fine |
| `lib/types.ts` | Keep - coordinate format compatible |

## Implementation Phases

### Phase 1: Setup and POC

**Goal:** Verify Google Maps 3D works with Norwegian coverage

**Tasks:**
- [ ] Create Google Cloud project and enable Maps JavaScript API
- [ ] Add API key to `.env.local` with localhost restriction
- [ ] Install `@vis.gl/react-google-maps`
- [ ] Create minimal `Map3DTest.tsx` component
- [ ] Verify 3D renders for Oslo (59.9139, 10.7522) and Trondheim (63.4305, 10.3951)
- [ ] Test EØS compliance - confirm 3D Maps JS API works with Norwegian billing

**Files:**
```
components/map/Map3DTest.tsx (new, temporary)
.env.local (update)
package.json (update)
```

**Acceptance Criteria:**
- [ ] 3D map renders with photorealistic buildings in Oslo
- [ ] No EØS-related errors in console
- [ ] Basic pan/zoom/tilt works

---

### Phase 2: Core Components

**Goal:** Build reusable 3D map primitives

**Tasks:**
- [x] Create `MapView3D` component with `<gmp-map-3d />`
- [x] Implement `useMap3DCamera` hook for flyTo/fitBounds
- [x] Create `POIMarker3D` with `Marker3DInteractiveElement` + `PinElement`
- [x] Create `RouteLayer3D` with `Polyline3DElement`
- [x] Add TypeScript declarations for web components
- [x] Implement label hiding via map styling

**Files:**
```typescript
// components/map/map-view-3d.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';

interface MapView3DProps {
  center: { lat: number; lng: number };
  pois: POI[];
  activePOI?: string | null;
  onPOIClick?: (poiId: string) => void;
  showRoute?: boolean;
  routeCoordinates?: [number, number][];
}

export function MapView3D({ center, pois, activePOI, onPOIClick, showRoute, routeCoordinates }: MapView3DProps) {
  useMapsLibrary('maps3d');
  useMapsLibrary('marker');

  const mapRef = useRef<HTMLElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Implementation...
}
```

```typescript
// components/map/poi-marker-3d.tsx
export function POIMarker3D({ poi, isActive, onClick }: POIMarker3DProps) {
  // Use Marker3DInteractiveElement with PinElement
  // Category color from poi.category.color
  // Click handler via gmp-click event
}
```

```typescript
// components/map/route-layer-3d.tsx
export function RouteLayer3D({ coordinates, color }: RouteLayer3DProps) {
  // Use Polyline3DElement
  // altitudeMode: RELATIVE_TO_MESH for bridges/tunnels
  // drawsOccludedSegments: true
}
```

```typescript
// lib/hooks/useMap3DCamera.ts
export function useMap3DCamera() {
  const mapRef = useRef<HTMLElement>(null);

  const flyTo = (target: LatLng, options?: { range?: number; tilt?: number }) => {
    mapRef.current?.flyCameraTo({
      endCamera: { center: target, range: options?.range ?? 1000, tilt: options?.tilt ?? 45 },
      durationMillis: 2000
    });
  };

  const fitBounds = (bounds: Bounds) => {
    // Calculate center and range from bounds
    // Then flyTo
  };

  return { mapRef, flyTo, fitBounds };
}
```

**Acceptance Criteria:**
- [ ] `MapView3D` renders 3D map with correct center
- [ ] POI markers show with category colors
- [ ] Click on marker triggers `onPOIClick`
- [ ] Route polyline renders when `showRoute` is true
- [ ] `flyTo` animates camera smoothly

---

### Phase 3: Explorer Migration

**Goal:** Replace ExplorerMap with 3D version

**Tasks:**
- [x] Create `ExplorerMap3D` based on existing `ExplorerMap`
- [x] Migrate GPS location display (user dot with accuracy circle)
- [x] Implement route fetching with origin from GPS or center
- [x] Add visible POI tracking (which POIs are in viewport)
- [x] Implement fitBounds for initial load and route display
- [x] Handle click-to-dismiss (background click clears selection)
- [ ] Test on mobile (touch gestures)

**Files:**
```
components/variants/explorer/ExplorerMap3D.tsx (new)
components/variants/explorer/ExplorerPage.tsx (update import)
```

**Key Behavior:**
```typescript
// ExplorerMap3D.tsx - Key differences from Mapbox version

// 1. Initial bounds fitting
useEffect(() => {
  if (!isReady || hasInitialFit.current) return;
  hasInitialFit.current = true;
  fitBounds(calculateBounds(pois));
}, [isReady, pois]);

// 2. POI click -> flyTo + fetch route
const handlePOIClick = (poiId: string) => {
  const poi = pois.find(p => p.id === poiId);
  if (!poi) return;

  setActivePOI(poiId);
  flyTo({ lat: poi.coordinates.lat, lng: poi.coordinates.lng }, { range: 500, tilt: 60 });
  fetchRoute(origin, poi.coordinates);
};

// 3. Route display
useEffect(() => {
  if (!routeData?.coordinates) return;
  // RouteLayer3D handles polyline rendering
}, [routeData]);
```

**Acceptance Criteria:**
- [ ] Explorer loads with 3D map showing all POIs
- [ ] Clicking POI flies camera and shows route
- [ ] GPS location shows user dot (if enabled)
- [ ] Routes render with correct styling
- [ ] Mobile touch gestures work (pan, pinch-zoom, two-finger tilt)

---

### Phase 4: Guide Migration

**Goal:** Replace GuideMap with 3D version

**Status:** ✅ Complete

**Tasks:**
- [x] Create `GuideMap3D` with numbered stop markers
- [x] Implement stop progression (current, completed, upcoming)
- [x] Add route polyline between stops
- [x] Camera follows active stop
- [ ] Test with existing guide data

**Files:**
```
components/variants/guide/GuideMap3D.tsx (new)
components/variants/guide/GuidePage.tsx (update import)
```

**Acceptance Criteria:**
- [x] Guide loads with numbered markers (1, 2, 3...)
- [x] Current stop highlighted (blue, larger)
- [x] Completed stops show checkmark
- [x] Route line connects stops
- [x] Advancing stop flies camera to new location

---

### Phase 5: Cleanup and Polish

**Goal:** Remove Mapbox, optimize performance, add fallbacks

**Status:** ✅ Complete (Mapbox kept for admin tools only)

**Completed Tasks:**
- [x] Add WebGL detection with fallback message (`Map3DFallback.tsx`)
- [x] Add loading state while 3D tiles load
- [x] Add `prefers-reduced-motion` support (skip animations)
- [x] Delete temporary Map3DTest.tsx POC component
- [x] `.env.example` already has Google Maps API key documented

**Kept for Admin Tools:**
- Mapbox dependencies (`react-map-gl`, `mapbox-gl`) kept in package.json
- Mapbox CSS kept in layout.tsx
- Old Mapbox components kept (`map-view.tsx`, `poi-marker.tsx`, `route-layer.tsx`)
- Admin tools (`/admin/pois`, `/admin/generate`) still use Mapbox

**User-Facing Pages Now Using Google Maps 3D:**
- Explorer (`/explorer/*`) - uses ExplorerMap3D
- Guide (`/guide/*`) - uses GuideMap3D

**Files Created/Modified:**
```
components/map/Map3DFallback.tsx (new - WebGL check + fallback UI)
components/map/map-view-3d.tsx (updated - WebGL check, loading state)
lib/hooks/useMap3DCamera.ts (updated - prefers-reduced-motion support)
app/globals.css (comment updated)
```

**Acceptance Criteria:**
- [x] User-facing pages use Google Maps 3D (Explorer, Guide)
- [x] Admin tools continue working with Mapbox
- [x] Fallback shows for non-WebGL browsers
- [x] Loading indicator while 3D initializes
- [x] Animations respect reduced-motion preference

---

## Acceptance Criteria

### Functional Requirements
- [ ] Explorer shows 3D map with all POIs
- [ ] Guide shows 3D map with numbered stops
- [ ] POI click triggers camera fly + route display
- [ ] GPS location works (user dot + routes from position)
- [ ] Category filtering works in MasterMap
- [ ] All existing POI data displays correctly

### Non-Functional Requirements
- [ ] Initial map load < 3 seconds on 4G
- [ ] Camera animations at 30+ FPS on mid-range devices
- [ ] Works on Chrome, Safari, Edge (2020+)
- [ ] Graceful fallback on non-WebGL browsers

### Quality Gates
- [ ] Manual testing on desktop (Chrome, Safari, Firefox)
- [ ] Manual testing on mobile (iOS Safari, Android Chrome)
- [ ] Verify Norwegian city 3D coverage (Oslo, Trondheim, Bergen)
- [ ] No console errors during normal usage

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Norwegian cities lack 3D coverage | Low | High | Test in Phase 1 before major work |
| EØS restrictions block API | Low | High | Use Maps JS API (not raw tiles) |
| Performance issues on mobile | Medium | Medium | Test early, simplify if needed |
| Google API costs spike | Low | Medium | Set billing alerts, monitor usage |
| Feature regression | Medium | Medium | Keep old components during transition |

## Dependencies

- Google Cloud account with billing enabled
- Google Maps Platform API key with Maps JavaScript API enabled
- Domain restrictions configured for production

## Success Metrics

- [ ] 3D map renders successfully in all target browsers
- [ ] No increase in page load time vs Mapbox
- [ ] User engagement metrics maintained or improved

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-02-03-google-maps-3d-migration-brainstorm.md`
- Current map: `components/map/map-view.tsx`
- Explorer map: `components/variants/explorer/ExplorerMap.tsx`
- Layout patterns: `docs/solutions/ui-patterns/explorer-desktop-layout-pattern.md`

### External
- [Google Maps 3D Overview](https://developers.google.com/maps/documentation/javascript/3d/overview)
- [3D Maps API Reference](https://developers.google.com/maps/documentation/javascript/reference/3d-map)
- [@vis.gl/react-google-maps](https://visgl.github.io/react-google-maps/)
- [Marker3DElement Docs](https://developers.google.com/maps/documentation/javascript/reference/3d-map-draw)
- [EØS FAQ](https://developers.google.com/maps/comms/eea/faq)
