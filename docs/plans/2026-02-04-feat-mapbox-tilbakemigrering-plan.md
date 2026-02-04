---
title: "feat: Migrere tilbake til Mapbox GL JS som hovedkartmotor"
type: feat
date: 2026-02-04
brainstorm: docs/brainstorms/2026-02-04-kartmotor-valg-brainstorm.md
deepened: 2026-02-04
---

# feat: Migrere tilbake til Mapbox GL JS som hovedkartmotor

## Enhancement Summary

**Deepened on:** 2026-02-04
**Research agents used:** best-practices-researcher, framework-docs-researcher, kieran-typescript-reviewer, performance-oracle, julik-frontend-races-reviewer, code-simplicity-reviewer, architecture-strategist, pattern-recognition-specialist

### Key Improvements
1. Detaljerte kodeeksempler for Marker, Popup og kamera-kontroll fra react-map-gl
2. Performance-anbefalinger: Symbol layers for 50+ POI-er, debouncing av kamera-animasjoner
3. Race condition-løsninger: `cleanedUp` flag-pattern, animasjonsstatus-tracking
4. TypeScript-forbedringer: Konsistent bruk av `POI[]` (ikke `GuideStop[]`), standardiser `RouteData`-type
5. Forenkling: Vurder å slette 3D-kode helt i stedet for å beholde den

### New Considerations Discovered
- Camera animasjon-trampling ved raske POI-klikk (må debounce)
- GPS-oppdateringer under animasjon kan forårsake "kartografisk sjøsyke"
- Mapbox vektor-tiles laster 60-70% raskere enn Google 3D-tiles

---

## Oversikt

Bytte tilbake fra Google Maps 3D JS til Mapbox GL JS som primær kartmotor for Explorer og Guide. Google 3D-kode beholdes i kodebasen for fremtidig bruk (flyover-preview, bygningsvisning, 2D/3D-toggle).

**Hvorfor:** Google Maps 3D har vist seg vanskelig å jobbe med for custom markers/HTML, AI-verktøy er dårlig trent på API-et, og kostnadene er høyere ved skala (~$180 vs ~$3 per 50K visninger).

## Problemstilling

### Nåværende tilstand
- Explorer og Guide bruker `ExplorerMap3D.tsx` og `GuideMap3D.tsx` (Google Maps 3D JS)
- Admin-verktøy bruker allerede Mapbox (`poi-admin-client.tsx`, `master-map.tsx`)
- Report bruker Mapbox Static Images API
- Routing API-er (`/api/directions`, `/api/travel-times`) bruker allerede Mapbox

### Ønsket tilstand
- Explorer og Guide bruker Mapbox GL JS
- Google 3D-komponenter flyttes til `components/map/3d/` for fremtidig bruk
- Konsistent kartopplevelse på tvers av alle produkter

---

## Foreslått løsning

### Fase 1: Oppdater ExplorerMap.tsx

`ExplorerMap.tsx` (Mapbox-versjon) eksisterer allerede i kodebasen. Den må oppdateres med manglende features fra 3D-versjonen.

**Fil:** `components/variants/explorer/ExplorerMap.tsx`

#### Research Insights: Custom Markers

**Best practice fra react-map-gl:**
```tsx
import { Marker } from "react-map-gl/mapbox";

<Marker
  longitude={poi.coordinates.lng}
  latitude={poi.coordinates.lat}
  anchor="center"
  onClick={(e) => {
    e.originalEvent.stopPropagation(); // Forhindre map-klikk
    onPOIClick(poi.id);
  }}
>
  <button
    className={cn(
      "flex items-center justify-center rounded-full transition-transform",
      "focus:outline-none focus:ring-2 focus:ring-offset-2",
      isActive ? "w-10 h-10 scale-125" : "w-8 h-8 hover:scale-110"
    )}
    style={{ backgroundColor: poi.category.color }}
    aria-label={`${poi.name} - ${poi.category.name}`}
    type="button"
  >
    <IconComponent className="w-4 h-4 text-white" aria-hidden="true" />
  </button>
</Marker>
```

**Pulsering for aktiv marker (erstatning for altitude):**
```css
/* globals.css */
@keyframes pulse-ring {
  0% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(1.5); opacity: 0; }
}

.marker-active::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 9999px;
  background: currentColor;
  animation: pulse-ring 1.5s ease-out infinite;
}
```

**Hovedendringer:**
- [ ] Legg til `POIActionPopup` for aktiv POI (reisetid-visning)
- [ ] Implementer pulsering på aktiv marker (erstatning for altitude)
- [ ] Legg til prosjekt-senter marker med sky-blue pin
- [ ] Implementer camera bounds-begrensning via `maxBounds`
- [ ] Behold reduced-motion støtte fra eksisterende kode

---

### Fase 2: Opprett GuideMap.tsx

`GuideMap.tsx` eksisterer ikke - må opprettes basert på `GuideMap3D.tsx` og eksisterende Mapbox-patterns.

**Ny fil:** `components/variants/guide/GuideMap.tsx`

#### Research Insights: TypeScript Interface

**Viktig:** Bruk `POI[]` for `stops`, ikke `GuideStop[]` (typen eksisterer ikke):

```tsx
interface GuideMapProps {
  center: Coordinates;
  stops: POI[];  // Bruk POI[], ikke GuideStop[]
  currentStopIndex: number;
  completedStops: Set<number>;
  routeData?: RouteData | null;  // Standardisert type
  travelMode?: TravelMode;
  userPosition?: Coordinates;  // Velg undefined ELLER null, ikke begge
  onStopClick: (index: number) => void;
}

// Standardiser RouteData-type (lib/types.ts)
interface RouteData {
  coordinates: [number, number][];
  travelTime: number;  // sekunder
  distance?: number;   // meter (valgfritt)
}
```

#### Research Insights: Camera Animation Trampling

**Problem:** Bruker trykker raskt gjennom stopp 1→2→3. Tre `flyTo`-kall fyres av, kameraet prøver å ære alle tre og "trampler" hverandre.

**Løsning:** Debounce med animasjonstilstand:

```tsx
const animatingRef = useRef(false);
const pendingTargetRef = useRef<Coordinates | null>(null);

const flyToStop = useCallback((coordinates: Coordinates) => {
  if (!mapRef.current) return;

  // Hvis allerede animerer, lagre målet for senere
  if (animatingRef.current) {
    pendingTargetRef.current = coordinates;
    return;
  }

  animatingRef.current = true;

  mapRef.current.flyTo({
    center: [coordinates.lng, coordinates.lat],
    duration: 1200,
  });

  // Vent på animasjon (flyTo har ingen callback, bruk timeout)
  setTimeout(() => {
    animatingRef.current = false;
    if (pendingTargetRef.current) {
      const target = pendingTargetRef.current;
      pendingTargetRef.current = null;
      flyToStop(target); // Rekursivt kall
    }
  }, 1200);
}, []);
```

**Hovedfunksjoner:**
- [ ] Nummererte sirkel-markører for hvert stopp
- [ ] Tre tilstander: `upcoming` (grå), `active` (primærfarge), `completed` (grønn med check)
- [ ] Camera flyTo med debouncing ved stopp-endring
- [ ] Rute-visning via eksisterende `RouteLayer`

---

### Fase 3: Opprett POIActionPopup

Erstatter Google's `PopoverElement` med Mapbox-kompatibel løsning.

**Ny fil:** `components/map/POIActionPopup.tsx`

#### Research Insights: Mapbox Popup API

```tsx
import { Popup } from "react-map-gl/mapbox";

interface POIActionPopupProps {
  poi: POI;
  travelTime?: number;
  travelMode?: TravelMode;
  onClose: () => void;
}

export function POIActionPopup({ poi, travelTime, travelMode, onClose }: POIActionPopupProps) {
  return (
    <Popup
      longitude={poi.coordinates.lng}
      latitude={poi.coordinates.lat}
      anchor="bottom"
      offset={[0, -10]}
      closeButton={true}
      closeOnClick={false}
      onClose={onClose}
      maxWidth="280px"
      focusAfterOpen={true}
    >
      <div className="p-3 flex items-center gap-2">
        <span className="font-medium">{travelTime}min</span>
        <TravelModeIcon mode={travelMode} />
      </div>
    </Popup>
  );
}
```

**CSS for popup-styling (globals.css):**
```css
.mapboxgl-popup-content {
  padding: 0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.mapboxgl-popup-close-button {
  font-size: 18px;
  padding: 4px 8px;
}
```

---

### Fase 4: Oppdater page-imports

**Filer å endre:**

| Fil | Endring |
|-----|---------|
| `components/variants/explorer/ExplorerPage.tsx:14` | `import ExplorerMap from "./ExplorerMap"` |
| `components/variants/explorer/ExplorerPage.tsx:467,532` | `<ExplorerMap ...>` |
| `components/variants/guide/GuidePage.tsx:9` | `import GuideMap from "./GuideMap"` |
| `components/variants/guide/GuidePage.tsx:235` | `<GuideMap ...>` |

---

### Fase 5: Organiser 3D-kode

Flytt Google 3D-komponenter til egen mappe for fremtidig bruk.

#### Research Insights: Forenkling (YAGNI-vurdering)

**Alternativ:** Vurder å **slette** 3D-koden helt i stedet for å beholde den:

| Argument FOR å beholde | Argument MOT å beholde |
|------------------------|------------------------|
| Fremtidig 2D/3D-toggle | ~900 LOC ekstra å vedlikeholde |
| Flyover-preview mulighet | Ingen konkret use case nå |
| Investering allerede gjort | "Sunk cost fallacy" |

**Anbefaling:** Start med å **ikke** flytte 3D-kode. Hvis den ikke brukes innen 3 måneder, slett den. Git-historikk bevarer alt.

**Mappestruktur (hvis du beholder 3D):**

```
components/map/
├── 3d/                          # Google Maps 3D (beholdes)
│   ├── map-view-3d.tsx
│   ├── poi-marker-3d.tsx
│   ├── route-layer-3d.tsx
│   ├── Map3DActionButtons.tsx
│   ├── MarkerActionButtons.tsx
│   └── Map3DFallback.tsx
├── map-view.tsx                 # Mapbox 2D (hovedkart)
├── poi-marker.tsx               # Mapbox markers
├── route-layer.tsx              # Mapbox routes
└── POIActionPopup.tsx           # NY: Mapbox popup
```

---

## Tekniske hensyn

### Marker-system forskjeller

| Feature | Google 3D | Mapbox | Løsning |
|---------|-----------|--------|---------|
| Custom HTML markers | Vanskelig (templates) | Enkelt (`element` prop) | Bruk Mapbox |
| Aktiv marker høyde | `altitude: 20` | Ikke mulig | Pulsering + scale |
| Popover | `PopoverElement` | `Popup` | Custom styling |
| Click events | `gmp-click` | `onClick` | Standard React |

### Camera-konvertering

```typescript
// Google 3D → Mapbox
range: 1000    → zoom: ~15 (logaritmisk: 18 - log2(range/250))
tilt: 55       → pitch: 55 (samme skala, 0-85)
heading: 180   → bearing: 180 (samme skala, 0-360)
```

### Bounds-begrensning

```tsx
// Google 3D
constraints={{ bounds: { north, south, east, west } }}

// Mapbox
<Map
  maxBounds={[[west, south], [east, north]]}
  minZoom={10}
  maxZoom={18}
  maxPitch={60}
/>
```

---

## Performance-anbefalinger

### Research Insights: Performance Budget

| Metric | Mål | Måling |
|--------|-----|--------|
| Initial kartlasting | < 2s på 4G | Lighthouse |
| Frame rate | 60fps stabil | Chrome DevTools |
| Minnebruk | < 150MB | Performance monitor |
| Time to interactive | < 3s | Web Vitals |

### Forventet forbedring etter migrering

| Aspekt | Google 3D | Mapbox | Forbedring |
|--------|-----------|--------|------------|
| Tile-størrelse | 5-50MB per tile | 20-100KB per tile | 60-70% raskere load |
| Minnebruk | 200-500MB | 50-150MB | 50-70% reduksjon |
| Render per frame | 60-120ms | 8-16ms | 5x raskere |

### Marker-optimalisering for 50+ POI-er

**Viktig:** Bruk `useMemo` for å forhindre re-render under kamera-animasjoner:

```tsx
const markers = useMemo(
  () =>
    pois.map((poi) => (
      <POIMarker
        key={poi.id}
        poi={poi}
        isActive={activePOI === poi.id}
        onClick={() => onPOIClick(poi.id)}
      />
    )),
  [pois, activePOI, onPOIClick]
);

return <Map>{markers}</Map>;
```

---

## Race Condition-løsninger

### Research Insights: Identifiserte race conditions

| Problem | Alvorlighet | Løsning |
|---------|-------------|---------|
| React StrictMode double-mount | KRITISK | Bruk `cleanedUp` flag |
| Kamera-animasjon trampling | HØY | Debounce med animasjonsstatus |
| GPS-oppdateringer under animasjon | MEDIUM | Debounce GPS + statussjekk |

### Pattern: Async i useEffect med cleanup

```typescript
useEffect(() => {
  let cleanedUp = false;

  const asyncWork = async () => {
    const result = await someAsyncOperation();

    if (cleanedUp) return; // ✅ Sjekk ETTER async

    doSomethingWith(result);
  };

  asyncWork();

  return () => {
    cleanedUp = true;
  };
}, [deps]);
```

### Pattern: Reduced Motion Support

```tsx
function useReducedMotion(): boolean {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
}

// Bruk:
const reducedMotion = useReducedMotion();

const flyTo = useCallback((coords: Coordinates) => {
  if (reducedMotion) {
    mapRef.current?.jumpTo({ center: [coords.lng, coords.lat] });
  } else {
    mapRef.current?.flyTo({ center: [coords.lng, coords.lat], duration: 1000 });
  }
}, [reducedMotion]);
```

---

## Akseptansekriterier

### Funksjonelle krav
- [ ] Explorer viser alle POI-er med korrekt kategori-farge
- [ ] Klikk på POI viser rute og reisetid
- [ ] GPS-modus fungerer (near/far/fallback)
- [ ] Guide viser nummererte stopp med riktig tilstand
- [ ] Kamera følger aktiv stopp i Guide
- [ ] Rute-styling matcher design (blå/grønn/lilla per travelMode)

### Ikke-funksjonelle krav
- [ ] Kartlasting < 2s på 4G (forbedret fra 3s)
- [ ] Smooth 60fps panning/zooming
- [ ] Redusert bevegelse respekteres
- [ ] Fungerer i Safari, Chrome, Firefox (desktop + mobil)

### Kvalitetskriterier
- [ ] Ingen TypeScript-feil
- [ ] Eksisterende admin-verktøy fungerer fortsatt
- [ ] Report-produktet uendret

---

## Avhengigheter

### Allerede på plass
- `mapbox-gl: ^3.18.1` i package.json
- `react-map-gl: ^8.1.0` i package.json
- `NEXT_PUBLIC_MAPBOX_TOKEN` miljøvariabel
- `/api/directions` (Mapbox Directions API)
- `/api/travel-times` (Mapbox Matrix API)

### Trenger ikke endres
- Google API-nøkkel (beholdes for fremtidig 3D-bruk)
- Places API (fortsatt Google)
- Geocoding (bruker Mapbox for admin)

---

## Risikoanalyse

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| GuideMap.tsx tar lang tid | Medium | Medium | Basere på eksisterende ExplorerMap-patterns |
| Popup-posisjonering vanskelig | Lav | Lav | Mapbox Popup API er veldokumentert |
| Performance-problemer | Lav | Medium | Mapbox er generelt raskere enn 3D tiles |
| Styling-avvik | Medium | Lav | Iterativ justering med screenshots |
| Camera animation trampling | Medium | Medium | Implementer debouncing fra start |

---

## Dokumenterte learnings å huske

Fra `docs/solutions/`:

1. **React StrictMode + async** - Bruk `cleanedUp` flag sjekket ETTER async, ikke `mounted` før
2. **fitBounds vs flyTo** - Bruk `fitBounds` på ruter med `maxZoom: currentZoom`
3. **Flex split layout** - Bedre enn absolutt overlay for sidebar
4. **Hydration guard** - Alltid ha vakt ved tilgang til browser-API-er
5. **Drag vs click detection** - Bruk `mouseDownPosRef` med 5px terskel for å skille
6. **Marker click stopPropagation** - Alltid `e.originalEvent.stopPropagation()` på marker-klikk

---

## Referanser

### Interne filer
- `components/variants/explorer/ExplorerMap.tsx` - Eksisterende Mapbox Explorer
- `components/map/map-view.tsx` - Mapbox wrapper
- `components/map/poi-marker.tsx` - Mapbox markers
- `components/map/route-layer.tsx` - Mapbox routes
- `docs/solutions/ui-patterns/explorer-desktop-layout-pattern.md`
- `docs/solutions/ui-bugs/google-maps-3d-popover-not-rendering.md`

### Ekstern dokumentasjon
- [react-map-gl Docs](https://visgl.github.io/react-map-gl/)
- [react-map-gl Marker API](https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/marker)
- [react-map-gl Popup API](https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/popup)
- [Mapbox GL JS Docs](https://docs.mapbox.com/mapbox-gl-js/)
- [Mapbox GL JS Map Options](https://docs.mapbox.com/mapbox-gl-js/api/map/)
