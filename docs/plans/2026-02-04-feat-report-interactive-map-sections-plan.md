---
title: "feat: Report Interactive Map Sections"
type: feat
date: 2026-02-04
deepened: 2026-02-04
brainstorm: docs/brainstorms/2026-02-04-explorer-report-samkjoring-brainstorm.md
---

# feat: Report Interactive Map Sections

## Enhancement Summary

**Deepened on:** 2026-02-04
**Research sources:** Context7 (react-map-gl, mapbox-gl-js), WebGL context research, IntersectionObserver best practices, project learnings

### Key Improvements from Research
1. **WebGL Context Management** — Browsers limit to 8-16 contexts. Must call `map.remove()` and implement LRU eviction.
2. **Mobile Gesture Handling** — Use `cooperativeGestures` mode to solve scroll/pan conflict.
3. **Symbol Layers for Performance** — Switch from DOM markers to symbol layers at 15+ POIs.
4. **Disconnect Observer After Load** — Don't keep observing after map loads (performance).

### Critical Gotchas Discovered
- `map.remove()` has a delay before WebGL context is freed — can still hit limits during rapid navigation
- `fitBounds` with `maxZoom: currentZoom` prevents jarring zoom-in (from Explorer learnings)
- Use `useMemo` for filtered data, never `useEffect` + `setState` (from Guide Library learnings)

---

## Overview

Oppgradere Report-produktet med interaktive kart-seksjoner som ligner Explorer sin UX, men uten «power user»-funksjonalitet. Målet er konsistent brukeropplevelse mellom Explorer og Report.

**Endring:** Erstatte nåværende statiske kart (Mapbox Static API) med interaktive Mapbox GL JS-kart per kategori-seksjon.

## Problem Statement / Motivation

**Nåværende tilstand:**
- Report bruker statiske kartbilder via `ReportDensityMap.tsx` (Mapbox Static API)
- Ingen interaksjon mellom POI-kort og kart
- Inkonsistent opplevelse sammenlignet med Explorer
- Brukere (boligkjøpere) får mindre engasjerende kartopplevelse

**Ønsket tilstand:**
- 50/50 layout med POI-kort og interaktivt kart per kategori-seksjon
- Bidirectional synkronisering: klikk kort → marker highlightes, klikk marker → kort scrolles til
- Samme visuelle språk som Explorer (markører, highlight-states)

## Proposed Solution

### Arkitektur

Ny komponent `ReportInteractiveMapSection` som erstatter `ReportThemeSection` sin kartvisning:

```
ReportPage
└── ReportThemeSection (per kategori)
    ├── Heading + Bridge text
    └── ReportInteractiveMapSection (NEW)
        ├── POI Card List (venstre)
        │   └── ReportHighlightCard[] (eksisterende)
        └── Interactive Map (høyre)
            └── Mapbox GL JS + Markers
```

### Layout

**Desktop (≥ 1024px):**
```
┌─────────────────────────┬───────────────────────────┐
│  POI-kort (scrollbar)   │   Interaktivt kart        │
│  ┌─────────────────┐    │                           │
│  │ ☕ Café X       │    │     ●  ●                  │
│  │ ★ 4.6          │←───│────→ ●                    │
│  └─────────────────┘    │        ●                  │
│  ...                    │                           │
└─────────────────────────┴───────────────────────────┘
        50%                        50%
```

**Mobil (< 768px):**
```
┌─────────────────────────────────┐
│  [Liste]  [Kart]    ← Tabs      │
├─────────────────────────────────┤
│                                 │
│  Aktiv tab-innhold              │
│  (kort ELLER kart)              │
│                                 │
└─────────────────────────────────┘
```

### Interaksjoner

| Handling | Respons |
|----------|---------|
| Klikk POI-kort | Kart panorerer til markør, markør highlightes |
| Klikk markør | Kort scrolles til synlig posisjon, kort highlightes |
| Klikk utenfor | Fjern highlight-state |

**Ikke inkludert:**
- Filtrering
- Lagre til samling
- Travel mode / time budget
- Reisetid på kort
- Navigasjon til Explorer (ekstern lenke via egen knapp)

## Technical Considerations

### Komponenter å opprette

| Fil | Beskrivelse |
|-----|-------------|
| `components/variants/report/ReportInteractiveMapSection.tsx` | Hoved-wrapper med 50/50 layout |
| `components/variants/report/ReportInteractiveMap.tsx` | Mapbox GL kart med markers |
| `components/variants/report/ReportMapTabs.tsx` | Mobil tabs (Liste/Kart) |

### Eksisterende komponenter å gjenbruke

| Komponent | Fil | Bruk |
|-----------|-----|------|
| `ReportHighlightCard` | `components/variants/report/ReportHighlightCard.tsx` | POI-kort (fjern Link-wrapper, legg til onClick) |
| Marker-logikk | `components/variants/explorer/ExplorerMap.tsx:150-180` | Lucide-ikoner som markører |
| Category colors | `lib/utils/category-colors.ts` | Konsistente farger |

### State Management

**Lokal state per seksjon** (ikke global Zustand):
```typescript
const [activePOI, setActivePOI] = useState<string | null>(null);
```

Begrunnelse: Seksjoner er uavhengige, global state vil skape forvirring når bruker scroller mellom seksjoner.

### Lazy Loading (kritisk for ytelse)

Mange kart på én side krever lazy loading:

```typescript
// IntersectionObserver pattern
const [isInView, setIsInView] = useState(false);
const sectionRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => setIsInView(entry.isIntersecting),
    { rootMargin: '100px' } // Load 100px before visible
  );
  if (sectionRef.current) observer.observe(sectionRef.current);
  return () => observer.disconnect();
}, []);

// Render map only when in view
{isInView ? <ReportInteractiveMap {...props} /> : <MapPlaceholder />}
```

#### Research Insights: IntersectionObserver Best Practices

**Fra [LogRocket](https://blog.logrocket.com/lazy-loading-using-the-intersection-observer-api/) og [HackerNoon](https://hackernoon.com/how-to-lazy-load-react-components-with-an-intersection-observer):**

1. **Disconnect etter første interseksjon** — For one-time lazy loads, call `observer.disconnect()` etter element blir synlig:
```typescript
useEffect(() => {
  if (isInView) return; // Already loaded, skip
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      setIsInView(true);
      observer.disconnect(); // Stop observing after first load
    }
  }, { rootMargin: '100px' });
  if (sectionRef.current) observer.observe(sectionRef.current);
  return () => observer.disconnect();
}, [isInView]);
```

2. **Bruk `react-intersection-observer` for enklere API:**
```typescript
import { useInView } from 'react-intersection-observer';
const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '100px' });
```

3. **Kombiner med React.lazy for code splitting** — Defer non-critical code for bedre FCP.

### Ytelseshensyn

| Bekymring | Løsning |
|-----------|---------|
| Mange WebGL-kontekster | Max 4 aktive kart, LRU-eviction |
| DOM-baserte markører | Bruk symbol layers for > 15 POI-er |
| Tile caching | Delt style mellom alle kart |
| Initial load | Placeholder til seksjon er synlig |

#### Research Insights: WebGL Context Limits

**Fra [Mapbox GitHub Issues](https://github.com/mapbox/mapbox-gl-js/issues/7332) og [Esri-Leaflet](https://github.com/Esri/esri-leaflet-vector/issues/120):**

> "Browsers usually limit WebGL to 8-16 contexts max. When displaying multiple maps, it only displays the first 15 instances. The next instances appear as broken images."

**Kritiske funn:**
1. **Browser limits:** Chrome/Safari typisk 16, iOS Safari ~8 kontekster
2. **`map.remove()` har delay** — WebGL context frigjøres ikke umiddelbart
3. **iOS-spesifikt:** Etter ~15 navigasjoner kan kart slutte å rendre

**Implementasjonsanbefaling:**
```typescript
// MapInstanceManager - track and evict old maps
const activeMapIds = useRef<string[]>([]);
const MAX_MAPS = 4; // Conservative for mobile

function registerMap(mapId: string, mapRef: MapRef) {
  activeMapIds.current.push(mapId);
  if (activeMapIds.current.length > MAX_MAPS) {
    const oldestId = activeMapIds.current.shift();
    // Signal parent to unmount oldest map
    onEvict?.(oldestId);
  }
}

// On unmount, call map.remove() explicitly
useEffect(() => {
  return () => {
    mapRef.current?.remove();
  };
}, []);
```

#### Research Insights: Symbol Layers vs DOM Markers

**Fra [react-map-gl docs](https://github.com/visgl/react-map-gl/blob/master/docs/get-started/tips-and-tricks.md):**

> "Symbol layers are rendered in WebGL, offering significantly better performance for numerous features."

**Terskel:** Switch til symbol layers ved > 15 POI-er per seksjon:

```tsx
const vehiclesGeoJSON = useMemo(() => ({
  type: 'FeatureCollection',
  features: pois.map(poi => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [poi.coordinates.lng, poi.coordinates.lat] },
    properties: { id: poi.id, icon: poi.category.icon, color: getCategoryColor(poi.category.slug) }
  }))
}), [pois]);

// Use symbol layer instead of Marker components
<Source id="pois" type="geojson" data={vehiclesGeoJSON}>
  <Layer type="symbol" layout={{ 'icon-image': ['get', 'icon'], 'icon-size': 1 }} />
</Source>
```

### Kjente gotchas fra learnings

1. **useEffect async cleanup**: Bruk `cleanedUp` flag, sjekk ETTER async
2. **Hydration**: `useState(false)` + `useEffect(() => setHydrated(true), [])`
3. **Filtrering**: Bruk `useMemo`, aldri `useEffect` + `setState`
4. **Map padding**: `{ left: 60, top: 60, right: 60, bottom: 60 }` uniform
5. **fitBounds**: Bruk `maxZoom: currentZoom` for å unngå jarring zoom

## Acceptance Criteria

### Funksjonelle krav

- [ ] Hver kategori-seksjon har 50/50 layout med interaktivt kart (desktop)
- [ ] Klikk på POI-kort panorerer kart til markør og highlighter markør
- [ ] Klikk på markør scroller POI-kort til synlig posisjon og highlighter kort
- [ ] Markører bruker kategori-farge og Lucide-ikon
- [ ] POI-kort viser: navn, kategori, rating (hvis tilgjengelig), editorial hook
- [ ] POI-kort viser IKKE reisetid
- [ ] Mobil: Tabs mellom "Liste" og "Kart" visning

### Ikke-funksjonelle krav

- [ ] Lazy loading: kart initialiseres kun når seksjon er synlig
- [ ] Max 4 aktive kart-instanser samtidig
- [ ] Smooth scroll til kort (300ms animation)
- [ ] Smooth pan til markør (flyTo med zoom 15)
- [ ] Fungerer med 10+ seksjoner uten merkbar ytelsesnedgang

### Testing

- [ ] Desktop: Chrome, Safari, Firefox
- [ ] Mobil: iOS Safari, Android Chrome
- [ ] Test med 3, 8, og 15 seksjoner
- [ ] Test med 5, 15, og 30 POI-er per seksjon

## Success Metrics

| Metrikk | Mål |
|---------|-----|
| Time to Interactive | < 3s på 4G |
| Memory usage | < 200MB med 8 seksjoner |
| User engagement | Økt scroll depth på Report-sider |
| Consistency | Visuelt lik Explorer-opplevelse |

## Dependencies & Risks

### Dependencies

- Eksisterende `react-map-gl/mapbox` setup
- POI-data med koordinater og kategorier
- Kategori-farge-mapping

### Risks

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| WebGL-kontekst-limit | Medium | Crash på enheter med lite minne | LRU-eviction, max 4 kart |
| Touch scroll/pan konflikt | Medium | Frustrerende UX på mobil | Cooperative gestures |
| Mange POI-er = treg rendering | Lav | Hakking ved scroll | Symbol layers, clustering |

#### Research Insights: Mobile Gesture Handling

**Fra [Google Maps API](https://developers.google.com/maps/documentation/javascript/interaction) og [Leaflet.GestureHandling](https://github.com/elmarquis/Leaflet.GestureHandling):**

> "Mobile web users often get frustrated when trying to scroll the page, but an embedded map captures their swipe and pans the map instead."

**Løsning: Cooperative Gesture Handling**

```typescript
// react-map-gl støtter cooperativeGestures prop
<Map
  cooperativeGestures={true}
  // ...
>
```

**Oppførsel med `cooperativeGestures: true`:**
- Ett-finger swipe → scroller siden (ikke kartet)
- To-finger gesture → panner kartet
- Ctrl+scroll (desktop) → zoomer kartet
- Viser melding: "Use two fingers to move the map"

**CSS touch-action alternativ:**
```css
.map-container {
  touch-action: pan-y; /* Allow vertical scroll, capture horizontal */
}
```

**Anbefaling for Report:** Bruk `cooperativeGestures={true}` siden kartene er embedded i en lang artikkel.

## References & Research

### Interne referanser

- Layout-mønster: `components/variants/explorer/ExplorerPage.tsx:461-526`
- Kart-initialisering: `components/variants/explorer/ExplorerMap.tsx:211-245`
- POI-kort: `components/variants/report/ReportHighlightCard.tsx`
- Kategori-farger: `lib/utils/category-colors.ts`

### Learnings

- Async useEffect: `docs/solutions/ui-bugs/google-maps-3d-popover-not-rendering.md`
- Layout pattern: `docs/solutions/ui-patterns/explorer-desktop-layout-pattern.md`
- Hydration: `docs/solutions/architecture-patterns/placy-guide-mobile-prototype.md`

### Brainstorm

- Beslutninger og skisser: `docs/brainstorms/2026-02-04-explorer-report-samkjoring-brainstorm.md`

---

## MVP Implementation Sketch

### ReportInteractiveMapSection.tsx (Enhanced)

```tsx
'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ReportTheme } from './report-data';
import { ReportHighlightCard } from './ReportHighlightCard';
import { ReportInteractiveMap } from './ReportInteractiveMap';
import { ReportMapTabs } from './ReportMapTabs';
import { Coordinates } from '@/lib/types';
import type { MapRef } from 'react-map-gl/mapbox';

interface Props {
  theme: ReportTheme;
  center: Coordinates;
  sectionId: string;
  onMapMount?: (sectionId: string, mapRef: MapRef) => void;
  onMapUnmount?: (sectionId: string) => void;
}

export function ReportInteractiveMapSection({
  theme,
  center,
  sectionId,
  onMapMount,
  onMapUnmount
}: Props) {
  const [activePOI, setActivePOI] = useState<string | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Lazy loading with triggerOnce pattern (disconnect after first intersection)
  useEffect(() => {
    if (isInView) return; // Already loaded, don't re-observe

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect(); // Stop observing after first load
        }
      },
      { rootMargin: '100px' }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [isInView]);

  // Scroll to card when marker clicked (with debounce to prevent rapid scroll conflicts)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (activePOI) {
      // Clear any pending scroll
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

      scrollTimeoutRef.current = setTimeout(() => {
        const cardEl = cardRefs.current.get(activePOI);
        cardEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50); // Small delay to let rapid clicks settle
    }
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [activePOI]);

  // Derive POIs with useMemo (from Guide Library learnings - never useEffect + setState)
  const pois = useMemo(() =>
    theme.highlighted.concat(theme.additional),
    [theme.highlighted, theme.additional]
  );

  // Map lifecycle callbacks
  const handleMapMount = useCallback((mapRef: MapRef) => {
    onMapMount?.(sectionId, mapRef);
  }, [sectionId, onMapMount]);

  const handleMapUnmount = useCallback(() => {
    onMapUnmount?.(sectionId);
  }, [sectionId, onMapUnmount]);

  // Clear active POI when clicking outside
  const handleDismiss = useCallback(() => {
    setActivePOI(null);
  }, []);

  return (
    <div ref={sectionRef} className="min-h-[400px]">
      {/* Mobile: Tabs */}
      <div className="lg:hidden">
        <ReportMapTabs activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === 'list' ? (
          <div className="space-y-4 p-4">
            {pois.map(poi => (
              <ReportHighlightCard
                key={poi.id}
                poi={poi}
                isActive={activePOI === poi.id}
                onClick={() => setActivePOI(poi.id)}
                ref={el => el && cardRefs.current.set(poi.id, el)}
              />
            ))}
          </div>
        ) : (
          isInView && (
            <div className="h-[400px]">
              <ReportInteractiveMap
                pois={pois}
                center={center}
                activePOI={activePOI}
                onPOIClick={setActivePOI}
                onMapMount={handleMapMount}
                onMapUnmount={handleMapUnmount}
              />
            </div>
          )
        )}
      </div>

      {/* Desktop: 50/50 split (from Explorer layout pattern) */}
      <div className="hidden lg:flex h-[500px]">
        {/* Left: POI cards with internal scroll */}
        <div className="w-1/2 overflow-y-auto p-4 space-y-4 border-r border-gray-200">
          {pois.map(poi => (
            <ReportHighlightCard
              key={poi.id}
              poi={poi}
              isActive={activePOI === poi.id}
              onClick={() => setActivePOI(poi.id)}
              ref={el => el && cardRefs.current.set(poi.id, el)}
            />
          ))}
        </div>

        {/* Right: Interactive map */}
        <div className="w-1/2 relative">
          {isInView ? (
            <ReportInteractiveMap
              pois={pois}
              center={center}
              activePOI={activePOI}
              onPOIClick={setActivePOI}
              onMapMount={handleMapMount}
              onMapUnmount={handleMapUnmount}
            />
          ) : (
            <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
              <span className="text-gray-400 text-sm">Laster kart...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Forbedringer fra research:**
- `triggerOnce` pattern — disconnect observer etter første interseksjon (ytelse)
- Scroll debounce — forhindrer race conditions ved raske klikk
- `useMemo` for derived data — aldri useEffect + setState (fra Guide Library)
- Map lifecycle callbacks — for LRU eviction management
- Faste høyder — `h-[400px]` og `h-[500px]` forhindrer CLS

### ReportInteractiveMap.tsx (Enhanced)

```tsx
'use client';

import { useRef, useCallback, useEffect, useMemo } from 'react';
import Map, { Marker, Source, Layer, type MapRef } from 'react-map-gl/mapbox';
import { POI, Coordinates } from '@/lib/types';
import { getCategoryColor } from '@/lib/utils/category-colors';
import * as LucideIcons from 'lucide-react';

interface Props {
  pois: POI[];
  center: Coordinates;
  activePOI: string | null;
  onPOIClick: (poiId: string) => void;
  onMapMount?: (mapRef: MapRef) => void;
  onMapUnmount?: () => void;
}

// Threshold for switching to symbol layers
const USE_SYMBOL_LAYER_THRESHOLD = 15;

export function ReportInteractiveMap({
  pois,
  center,
  activePOI,
  onPOIClick,
  onMapMount,
  onMapUnmount
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const useSymbolLayers = pois.length > USE_SYMBOL_LAYER_THRESHOLD;

  // Cleanup on unmount - critical for WebGL context management
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      onMapUnmount?.();
    };
  }, [onMapUnmount]);

  const handleMapLoad = useCallback(() => {
    if (mapRef.current) {
      onMapMount?.(mapRef.current);

      // Initial fitBounds to show all POIs
      if (pois.length > 0) {
        const bounds = pois.reduce(
          (acc, poi) => ({
            minLng: Math.min(acc.minLng, poi.coordinates.lng),
            maxLng: Math.max(acc.maxLng, poi.coordinates.lng),
            minLat: Math.min(acc.minLat, poi.coordinates.lat),
            maxLat: Math.max(acc.maxLat, poi.coordinates.lat),
          }),
          { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity }
        );
        mapRef.current.fitBounds(
          [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
          { padding: 60, duration: 0 }
        );
      }
    }
  }, [pois, onMapMount]);

  // Use fitBounds instead of flyTo for smoother experience (from Explorer learnings)
  const handleMarkerClick = useCallback((poiId: string, coords: Coordinates) => {
    onPOIClick(poiId);
    const map = mapRef.current;
    if (!map) return;

    // Don't zoom in beyond current level - only pan
    map.fitBounds(
      [[coords.lng - 0.002, coords.lat - 0.002], [coords.lng + 0.002, coords.lat + 0.002]],
      { padding: 60, duration: 400, maxZoom: map.getZoom() }
    );
  }, [onPOIClick]);

  // GeoJSON for symbol layer (performance optimization)
  const geojsonData = useMemo(() => {
    if (!useSymbolLayers) return null;
    return {
      type: 'FeatureCollection' as const,
      features: pois.map(poi => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [poi.coordinates.lng, poi.coordinates.lat] },
        properties: {
          id: poi.id,
          icon: poi.category.icon,
          isActive: poi.id === activePOI
        }
      }))
    };
  }, [pois, activePOI, useSymbolLayers]);

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{
        longitude: center.lng,
        latitude: center.lat,
        zoom: 14,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      onLoad={handleMapLoad}
      cooperativeGestures={true} // Two-finger pan on mobile
    >
      {/* Use DOM markers for small POI counts, symbol layer for large */}
      {!useSymbolLayers ? (
        pois.map(poi => {
          const Icon = LucideIcons[poi.category.icon as keyof typeof LucideIcons] || LucideIcons.MapPin;
          const isActive = activePOI === poi.id;
          const color = getCategoryColor(poi.category.slug);

          return (
            <Marker
              key={poi.id}
              longitude={poi.coordinates.lng}
              latitude={poi.coordinates.lat}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleMarkerClick(poi.id, poi.coordinates);
              }}
            >
              <div
                className={`
                  flex items-center justify-center rounded-full cursor-pointer
                  transition-transform duration-200
                  ${isActive ? 'scale-125 ring-2 ring-white shadow-lg z-10' : ''}
                `}
                style={{ backgroundColor: color, width: 32, height: 32 }}
              >
                <Icon size={16} className="text-white" />
              </div>
            </Marker>
          );
        })
      ) : (
        <Source id="pois" type="geojson" data={geojsonData!}>
          <Layer
            id="poi-circles"
            type="circle"
            paint={{
              'circle-radius': ['case', ['get', 'isActive'], 16, 12],
              'circle-color': '#C45C3A', // Default terracotta
              'circle-stroke-width': ['case', ['get', 'isActive'], 2, 0],
              'circle-stroke-color': '#ffffff',
            }}
          />
        </Source>
      )}
    </Map>
  );
}
```

**Forbedringer fra research:**
- `cooperativeGestures={true}` — løser scroll/pan-konflikt på mobil
- `map.remove()` i cleanup — frigjør WebGL context
- `fitBounds` med `maxZoom: currentZoom` — unngår jarring zoom (fra Explorer learnings)
- Symbol layer for > 15 POI-er — WebGL-basert rendering for ytelse
- `e.originalEvent.stopPropagation()` — forhindrer event bubbling

### ReportMapTabs.tsx

```tsx
interface Props {
  activeTab: 'list' | 'map';
  onTabChange: (tab: 'list' | 'map') => void;
}

export function ReportMapTabs({ activeTab, onTabChange }: Props) {
  return (
    <div className="flex border-b border-gray-200">
      <button
        className={`flex-1 py-3 text-sm font-medium ${
          activeTab === 'list'
            ? 'text-gray-900 border-b-2 border-gray-900'
            : 'text-gray-500'
        }`}
        onClick={() => onTabChange('list')}
      >
        Liste
      </button>
      <button
        className={`flex-1 py-3 text-sm font-medium ${
          activeTab === 'map'
            ? 'text-gray-900 border-b-2 border-gray-900'
            : 'text-gray-500'
        }`}
        onClick={() => onTabChange('map')}
      >
        Kart
      </button>
    </div>
  );
}
```

---

### MapInstanceManager.ts (Optional - for LRU Eviction)

```typescript
/**
 * Manages WebGL context limits by tracking active map instances.
 * Evicts oldest maps when limit is exceeded.
 *
 * NOTE: This is optional for MVP. Start without it, add if WebGL errors occur.
 */

import type { MapRef } from 'react-map-gl/mapbox';

const MAX_ACTIVE_MAPS = 4; // Conservative for mobile devices

interface MapInstance {
  sectionId: string;
  mapRef: MapRef;
  lastAccessed: number;
}

class MapInstanceManager {
  private instances: Map<string, MapInstance> = new Map();
  private evictionCallbacks: Map<string, () => void> = new Map();

  register(sectionId: string, mapRef: MapRef, onEvict: () => void) {
    this.instances.set(sectionId, {
      sectionId,
      mapRef,
      lastAccessed: Date.now(),
    });
    this.evictionCallbacks.set(sectionId, onEvict);

    this.enforceLimit();
  }

  unregister(sectionId: string) {
    const instance = this.instances.get(sectionId);
    if (instance) {
      instance.mapRef.remove(); // Free WebGL context
      this.instances.delete(sectionId);
      this.evictionCallbacks.delete(sectionId);
    }
  }

  touch(sectionId: string) {
    const instance = this.instances.get(sectionId);
    if (instance) {
      instance.lastAccessed = Date.now();
    }
  }

  private enforceLimit() {
    if (this.instances.size <= MAX_ACTIVE_MAPS) return;

    // Sort by lastAccessed, oldest first
    const sorted = Array.from(this.instances.values())
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    // Evict oldest until under limit
    while (this.instances.size > MAX_ACTIVE_MAPS) {
      const oldest = sorted.shift();
      if (!oldest) break;

      console.log(`[MapInstanceManager] Evicting map: ${oldest.sectionId}`);
      const callback = this.evictionCallbacks.get(oldest.sectionId);
      callback?.();
      this.unregister(oldest.sectionId);
    }
  }
}

export const mapInstanceManager = new MapInstanceManager();
```

**Bruk i ReportPage:**
```tsx
import { mapInstanceManager } from './MapInstanceManager';

function ReportPage({ themes }: Props) {
  const [evictedSections, setEvictedSections] = useState<Set<string>>(new Set());

  const handleMapMount = useCallback((sectionId: string, mapRef: MapRef) => {
    mapInstanceManager.register(sectionId, mapRef, () => {
      setEvictedSections(prev => new Set(prev).add(sectionId));
    });
  }, []);

  const handleMapUnmount = useCallback((sectionId: string) => {
    mapInstanceManager.unregister(sectionId);
    setEvictedSections(prev => {
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
  }, []);

  return themes.map(theme => (
    <ReportInteractiveMapSection
      key={theme.id}
      theme={theme}
      sectionId={theme.id}
      onMapMount={handleMapMount}
      onMapUnmount={handleMapUnmount}
      // If evicted, show placeholder instead of map
      isEvicted={evictedSections.has(theme.id)}
    />
  ));
}
```

---

## External References (from Research)

### Mapbox & react-map-gl
- [react-map-gl Documentation](https://visgl.github.io/react-map-gl/)
- [Symbol Layers for Performance](https://github.com/visgl/react-map-gl/blob/master/docs/get-started/tips-and-tricks.md)
- [Multiple Maps with MapProvider](https://github.com/visgl/react-map-gl/blob/master/docs/api-reference/maplibre/use-map.md)
- [WebGL Context Limits Issue #7332](https://github.com/mapbox/mapbox-gl-js/issues/7332)
- [Mapbox Performance Troubleshooting](https://docs.mapbox.com/help/troubleshooting/mapbox-gl-js-performance/)

### IntersectionObserver
- [Lazy Loading with IntersectionObserver - LogRocket](https://blog.logrocket.com/lazy-loading-using-the-intersection-observer-api/)
- [react-intersection-observer npm](https://www.npmjs.com/package/react-intersection-observer)

### Mobile Gesture Handling
- [Google Maps Cooperative Gestures](https://developers.google.com/maps/documentation/javascript/interaction)
- [Leaflet.GestureHandling](https://github.com/elmarquis/Leaflet.GestureHandling)
- [MDN touch-action CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)

---

*Plan opprettet: 2026-02-04*
*Plan deepened: 2026-02-04*
