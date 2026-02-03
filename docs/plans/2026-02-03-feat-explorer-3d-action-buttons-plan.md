---
title: feat: Explorer 3D action buttons with circular markers
type: feat
date: 2026-02-03
---

# Explorer 3D Action Buttons with Circular Markers

## Overview

Implementer Spotlight-inspirert interaksjonsdesign for Explorer 3D-kart med sirkulære markører og action buttons. Når bruker klikker på en POI-markør:

1. **Kameraet holder seg stille** (ingen automatisk tilt/pan) ✅ Allerede implementert
2. **Path vises** mellom brukerens posisjon og POI ✅ Allerede implementert
3. **Action buttons vises** ved siden av markøren:
   - 🏔️ **3D-knapp**: Opt-in for å tilte kameraet til 55° og zoom til 600m
   - ⏱️ **Travel time display**: Viser "Xmin 🚶" basert på routeData

Samtidig byttes POI-markører fra Google Maps `PinElement` til **custom HTML med sirkulær design** for visuell konsistens med action buttons (macOS Spotlight-stil).

---

## Motivation

**Nåværende problem:**
- Klikk på markør holder kameraet stille (✅ bra), men brukere mangler:
  - Tydelig feedback på at path er kalkulert (travel time)
  - Opt-in mulighet til å se 3D når det er relevant (terreng, bygninger)
  - Visuell konsistens — Google Maps pins matcher ikke Placy's designspråk

**Løsning:**
- **Radial action buttons** inspirert av macOS Spotlight (tydelig, kontekstuell, opt-in)
- **Sirkulære markører** med kategorifarge og Lucide-icons for visuell helhet
- **Umiddelbar feedback** på travel time ved klikk

---

## Research Findings

### Eksisterende Patterns (Fra repo-research-analyst)

**1. Custom 3D Markers (poi-marker-3d.tsx:17-100):**
```typescript
// Nåværende: PinElement med category color
const pin = new PinElement({
  background: poi.category.color,
  glyphText: poi.category.name.charAt(0).toUpperCase(),
  scale: isActive ? 1.3 : 1.0,
});

const marker = new Marker3DInteractiveElement({
  position: { lat, lng, altitude: isActive ? 20 : 0 },
  altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
});
marker.append(pin);
```

**Endring:** Bytt `PinElement` med custom HTML content (sirkulær div + Lucide icon).

**2. Action Button Pattern (GeoLocationWidget.tsx:79-100):**
```typescript
// Eksisterende widget-posisjonering
className="absolute bottom-4 left-4 right-4 z-20"

// Button-styling
className={cn(
  "flex items-center gap-2 px-4 py-2.5 rounded-2xl",
  "bg-white shadow-lg border border-gray-200",
  "hover:bg-gray-50 transition-colors"
)}
```

**3. Animasjoner (Tailwind-basert):**
- `transition-all duration-200` — General transitions
- `animate-ping` — Pulsing effect
- `hover:scale-110` — Hover scale
- `prefers-reduced-motion` support i `useMap3DCamera.ts`

**4. Icon Pattern (poi-marker.tsx:5-30):**
```typescript
import { Coffee, UtensilsCrossed, MapPin } from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Coffee,
  UtensilsCrossed,
  MapPin,
};

const Icon = iconMap[poi.category.icon] || MapPin;
<Icon className="w-4 h-4 text-white" />
```

**5. Travel Mode Icons (utils.ts:55-59 + ExplorerNavbar.tsx:12-16):**
```typescript
const travelModeConfig = [
  { mode: "walk", Icon: Footprints },
  { mode: "bike", Icon: Bike },
  { mode: "car", Icon: Car },
];
```

**6. Z-index Hierarchy:**
- z-10: Tooltips, temporary overlays
- **z-20: Floating widgets** ← Action buttons hører hjemme her
- z-30: Bottom sheets
- z-40: Sidebars
- z-50: Modals

---

## Technical Approach

### Phase 1: Sirkulære Markører (Custom HTML)

**Goal:** Bytt fra `PinElement` til custom HTML for full designkontroll.

**Files:**
- `components/map/poi-marker-3d.tsx`

**Implementation:**

#### 1.1. Create Custom Marker HTML

```typescript
// poi-marker-3d.tsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { POI } from "@/lib/types";
import { cn } from "@/lib/utils";

// Icon mapping (subset to start, expand later)
import {
  Building2,
  Museum,
  Trees,
  Utensils,
  Coffee,
  MapPin,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  building: Building2,
  museum: Museum,
  park: Trees,
  restaurant: Utensils,
  cafe: Coffee,
};

function POIMarker3D({ poi, isActive, onClick, map3d }: POIMarker3DProps) {
  const markerRef = useRef<google.maps.maps3d.Marker3DInteractiveElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map3d) return;

    const initMarker = async () => {
      const { Marker3DInteractiveElement, AltitudeMode } =
        await google.maps.importLibrary("maps3d") as google.maps.Maps3DLibrary;

      // Clean up existing
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // Create container div for React portal
      const container = document.createElement('div');
      containerRef.current = container;

      // Create marker
      const marker = new Marker3DInteractiveElement({
        position: {
          lat: poi.coordinates.lat,
          lng: poi.coordinates.lng,
          altitude: isActive ? 20 : 0,
        },
        altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
        extruded: true,
      });

      // Append container to marker
      marker.append(container);

      // Handle click
      marker.addEventListener("gmp-click", () => {
        onClick?.(poi.id);
      });

      markerRef.current = marker;
      map3d.append(marker);
    };

    initMarker();

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [map3d, poi.id, poi.coordinates.lat, poi.coordinates.lng, isActive, onClick]);

  // Update altitude when active state changes
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.position = {
        lat: poi.coordinates.lat,
        lng: poi.coordinates.lng,
        altitude: isActive ? 20 : 0,
      };
    }
  }, [isActive, poi.coordinates]);

  // Render circular marker via portal
  if (!containerRef.current) return null;

  const Icon = CATEGORY_ICONS[poi.category.icon] || MapPin;

  return createPortal(
    <div
      className={cn(
        "flex items-center justify-center rounded-full transition-all duration-200",
        "border-2 border-white shadow-lg cursor-pointer",
        isActive ? "w-10 h-10 scale-125" : "w-8 h-8 hover:scale-110"
      )}
      style={{
        backgroundColor: poi.category.color,
      }}
    >
      <Icon className={cn("text-white", isActive ? "w-5 h-5" : "w-4 h-4")} />

      {/* Optional: Pulse effect when active */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ backgroundColor: poi.category.color }}
        />
      )}
    </div>,
    containerRef.current
  );
}
```

**Styling Details:**
- Default: 32px (w-8 h-8)
- Active: 40px (w-10 h-10) + scale-125
- Border: 2px white
- Shadow: shadow-lg
- Hover: scale-110
- Icon: 16px default, 20px active

---

### Phase 2: Action Buttons Component

**Goal:** Create floating action buttons that appear next to active marker.

**Files:**
- `components/map/MarkerActionButtons.tsx` (NEW)

**Implementation:**

#### 2.1. Component Structure

```typescript
// components/map/MarkerActionButtons.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { Cuboid, Footprints, Bike, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TravelMode } from "@/lib/types";

interface MarkerActionButtonsProps {
  markerElement: google.maps.maps3d.Marker3DInteractiveElement | null;
  travelTime: number; // in minutes
  travelMode: TravelMode;
  onToggle3D: () => void;
  show: boolean;
}

const TRAVEL_MODE_ICONS = {
  walk: Footprints,
  bike: Bike,
  car: Car,
} as const;

export function MarkerActionButtons({
  markerElement,
  travelTime,
  travelMode,
  onToggle3D,
  show,
}: MarkerActionButtonsProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate screen position of marker
  useEffect(() => {
    if (!markerElement || !show) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      // Find the marker's DOM element (first child of Marker3DInteractiveElement)
      const markerDOM = markerElement.querySelector('div');
      if (!markerDOM) return;

      const rect = markerDOM.getBoundingClientRect();

      // Position to the right of marker with 8px gap
      const x = rect.right + 8;
      const y = rect.top + rect.height / 2; // Vertically centered

      setPosition({ x, y });
    };

    // Initial position
    updatePosition();

    // Update on scroll/resize (marker moves in viewport)
    const observer = new MutationObserver(updatePosition);
    observer.observe(markerElement, { attributes: true, childList: true, subtree: true });

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [markerElement, show]);

  if (!position || !show) return null;

  const TravelIcon = TRAVEL_MODE_ICONS[travelMode];

  return (
    <div
      ref={containerRef}
      className="fixed z-20 pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateY(-50%)', // Center vertically
      }}
    >
      <div className="flex items-center gap-2">
        {/* 3D Button */}
        <button
          onClick={onToggle3D}
          className={cn(
            "pointer-events-auto w-8 h-8 rounded-full flex items-center justify-center",
            "bg-white border-2 border-gray-200 shadow-lg",
            "transition-all duration-200",
            "hover:scale-105 hover:shadow-xl hover:bg-blue-50",
            "active:scale-95",
            // Entry animation
            "opacity-0 translate-x-[-8px] animate-[fadeInSlide_200ms_ease-out_50ms_forwards]"
          )}
          aria-label="Se i 3D"
        >
          <Cuboid className="w-4 h-4 text-gray-700" />
        </button>

        {/* Travel Time Display */}
        <div
          className={cn(
            "pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full",
            "bg-white border-2 border-gray-200 shadow-lg",
            "text-sm font-medium text-gray-700",
            "transition-all duration-200",
            // Entry animation with delay
            "opacity-0 translate-x-[-8px] animate-[fadeInSlide_200ms_ease-out_100ms_forwards]"
          )}
        >
          <span>{travelTime}min</span>
          <TravelIcon className="w-4 h-4 text-gray-500" />
        </div>
      </div>
    </div>
  );
}
```

#### 2.2. Add Tailwind Animation

```typescript
// tailwind.config.ts (add to theme.extend.keyframes)
keyframes: {
  fadeInSlide: {
    '0%': { opacity: '0', transform: 'translateX(-8px)' },
    '100%': { opacity: '1', transform: 'translateX(0)' },
  },
},
animation: {
  fadeInSlide: 'fadeInSlide 200ms ease-out forwards',
}
```

**Positioning Strategy:**
- Use `position: fixed` with calculated screen coordinates
- `pointer-events-none` on container, `pointer-events-auto` on buttons
- Update position on:
  - Initial render
  - Window resize
  - Map camera change (via MutationObserver)
  - Scroll events

**Smart Positioning (P2 - Optional):**
- Check if `position.x + buttonWidth > window.innerWidth`
- If true, position to **left** of marker instead

---

### Phase 3: Integration with ExplorerMap3D

**Goal:** Wire up action buttons to ExplorerMap3D and handle 3D camera transitions.

**Files:**
- `components/variants/explorer/ExplorerMap3D.tsx`

**Implementation:**

#### 3.1. Add State for Active Marker Element

```typescript
// ExplorerMap3D.tsx
import { MarkerActionButtons } from "@/components/map/MarkerActionButtons";

export default function ExplorerMap3D({ ... }: ExplorerMap3DProps) {
  const cameraRef = useRef<ReturnType<typeof useMap3DCamera> | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // NEW: Track active marker element for action buttons
  const [activeMarkerElement, setActiveMarkerElement] =
    useState<google.maps.maps3d.Marker3DInteractiveElement | null>(null);

  // ... existing code ...
}
```

#### 3.2. Pass Marker Ref to POIMarker3D

```typescript
// Update POIMarkers3D to expose marker ref
export function POIMarkers3D({
  pois,
  activePOI,
  onPOIClick,
  map3d,
  onActiveMarkerRef, // NEW callback
}: POIMarkers3DProps) {
  return (
    <>
      {pois.map((poi) => (
        <POIMarker3D
          key={poi.id}
          poi={poi}
          isActive={activePOI === poi.id}
          onClick={onPOIClick}
          map3d={map3d}
          onMarkerRef={activePOI === poi.id ? onActiveMarkerRef : undefined}
        />
      ))}
    </>
  );
}

// In POIMarker3D component
useEffect(() => {
  // ... marker creation ...

  // Call callback when marker is created
  if (isActive && onMarkerRef) {
    onMarkerRef(marker);
  }
}, [isActive, onMarkerRef]);
```

#### 3.3. Handle 3D Toggle

```typescript
// ExplorerMap3D.tsx
const handle3DToggle = useCallback(() => {
  if (!cameraRef.current) return;

  const currentCamera = cameraRef.current.getCamera();

  // Check if already in 3D (tilt > 30°)
  const isIn3D = currentCamera?.tilt && currentCamera.tilt > 30;

  if (isIn3D) {
    // Return to top-down
    cameraRef.current.flyTo(
      { lat: currentCamera.center.lat, lng: currentCamera.center.lng },
      { tilt: 0, range: currentCamera.range, duration: 1200 }
    );
  } else {
    // Go to 3D
    cameraRef.current.flyTo(
      { lat: currentCamera.center.lat, lng: currentCamera.center.lng },
      { tilt: 55, range: 600, duration: 1200 }
    );
  }
}, []);
```

#### 3.4. Render Action Buttons

```typescript
// ExplorerMap3D.tsx (in return statement)
return (
  <div className="w-full h-full relative">
    <MapView3D
      center={center}
      pois={poisWithCenter}
      activePOI={activePOI}
      onPOIClick={handlePOIClick}
      onMapClick={handleMapClick}
      onMapReady={handleMapReady}
      showRoute={!!routeData}
      routeCoordinates={routeData?.coordinates}
      travelMode={travelMode}
      userPosition={userPosition}
      userAccuracy={userAccuracy ?? undefined}
      initialBounds={initialBounds}
      cameraRef={cameraRef}
      showProjectCenter={showProjectCenter}
      projectCenterLabel="Sentrum"
      constraints={constraints}
      onActiveMarkerRef={setActiveMarkerElement}
    />

    {/* Action buttons overlay */}
    {activePOI && routeData && (
      <MarkerActionButtons
        markerElement={activeMarkerElement}
        travelTime={Math.round(routeData.travelTime)}
        travelMode={travelMode}
        onToggle3D={handle3DToggle}
        show={true}
      />
    )}

    {/* Existing geolocation widget */}
    {showGeoWidget && onEnableGeolocation && (
      <GeoLocationWidget ... />
    )}
  </div>
);
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] **Sirkulære markører**
  - [ ] POI-markører vises som sirkler med kategorifarge
  - [ ] Lucide-icon sentrert i sirkelen (hvit farge)
  - [ ] Hvit border (2px)
  - [ ] Aktiv markør: 40px, inaktiv: 32px
  - [ ] Hover: scale 1.1
  - [ ] Aktiv markør heiser seg 20m i høyden (allerede implementert)

- [ ] **Action buttons**
  - [ ] Vises kun når en markør er aktiv og routeData eksisterer
  - [ ] Posisjonert til høyre av markør (8px gap)
  - [ ] **3D-knapp**: Cuboid/mountain icon, trigger tilt 55° + range 600m
  - [ ] **Travel time display**: Viser "Xmin" + travel mode icon
  - [ ] Fade-in + slide animation (stagger 50ms)
  - [ ] Forsvinner når markør deaktiveres

- [ ] **3D Camera Toggle**
  - [ ] Klikk på 3D-knapp → kamera tilter til 55°, zoom til 600m
  - [ ] Smooth animasjon (1200ms, cubic-bezier easing)
  - [ ] Respekterer `prefers-reduced-motion`
  - [ ] Optional: Toggle tilbake til 2D ved andre klikk

- [ ] **Positioning**
  - [ ] Action buttons følger markør ved kamera-bevegelse
  - [ ] Oppdaterer posisjon ved window resize
  - [ ] Z-index: 20 (over kart, under modals)

### Non-Functional Requirements

- [ ] **Performance**
  - [ ] Ingen jank ved markør-klikk (60fps)
  - [ ] Action buttons renders i < 100ms
  - [ ] MutationObserver avregistreres korrekt

- [ ] **Accessibility**
  - [ ] 3D-knapp har `aria-label="Se i 3D"`
  - [ ] Keyboard navigation: Tab til knapper, Enter/Space trigger
  - [ ] Focus ring synlig (2px blue outline)

- [ ] **Responsive**
  - [ ] Touch targets: minimum 44px (iOS guideline)
  - [ ] Fungerer på mobile (iPad/iPhone)
  - [ ] Smart positioning unngår skjermkanter (P2)

---

## Implementation Phases

### Phase 1: Sirkulære Markører ⏱️ Est: 2-3 timer

**Tasks:**
- [x] Update `poi-marker-3d.tsx`:
  - [x] Legg til icon mapping (CATEGORY_ICONS)
  - [x] Bytt fra PinElement til custom HTML container
  - [x] Render sirkulær div med React portal
  - [x] Style med Tailwind (w-8/10, rounded-full, border-2)
  - [x] Conditional rendering av Icon-komponent
- [ ] Test markører i Explorer
  - [ ] Verifiser kategorifarger vises korrekt
  - [ ] Sjekk hover/active states
  - [ ] Bekreft altitude lift fungerer

**Exit Criteria:**
✅ Alle POI-markører vises som sirkler med category icons
✅ Hover og active states fungerer smooth
✅ Ingen console errors

---

### Phase 2: Action Buttons Component ⏱️ Est: 3-4 timer

**Tasks:**
- [x] Create `components/map/MarkerActionButtons.tsx`:
  - [x] Component structure med props
  - [x] Screen position calculation (getBoundingClientRect)
  - [x] MutationObserver for position updates
  - [x] Event listeners (resize, scroll)
  - [x] Cleanup i useEffect return
- [x] Style buttons:
  - [x] 3D-knapp: Cuboid icon, circular, white bg
  - [x] Travel time: Rounded pill, "Xmin" + icon
  - [x] Hover states (scale 1.05, shadow-xl)
- [x] Add Tailwind keyframes:
  - [x] fadeInSlide animation
  - [x] Stagger delays (50ms, 100ms)
- [ ] Test posisjonering:
  - [ ] Buttons følger markør ved pan/zoom
  - [ ] Oppdateres ved window resize
  - [ ] Ikke overlapper markør

**Exit Criteria:**
✅ Action buttons vises ved siden av aktiv markør
✅ Posisjon oppdateres dynamisk
✅ Animasjoner er smooth
✅ Cleanup fungerer (ingen memory leaks)

---

### Phase 3: Integration & 3D Toggle ⏱️ Est: 2-3 timer

**Tasks:**
- [x] Update `ExplorerMap3D.tsx`:
  - [x] Add state: `activeMarkerElement`
  - [x] Pass `onActiveMarkerRef` callback til POIMarkers3D
  - [x] Implement `handle3DToggle` med flyTo logic
  - [x] Render `<MarkerActionButtons />` conditional
- [x] Update `POIMarkers3D` og `POIMarker3D`:
  - [x] Add `onMarkerRef` prop
  - [x] Call callback når marker er aktiv
- [x] Implement 3D camera transition:
  - [x] Tilt 0° → 55°
  - [x] Range current → 600m
  - [x] Duration: 1200ms
  - [x] Respect `prefers-reduced-motion` (already in useMap3DCamera)
- [ ] Test full flow:
  - [ ] Klikk markør → buttons vises
  - [ ] Klikk 3D-knapp → kamera tilter
  - [ ] Klikk annen markør → buttons flytter seg
  - [ ] Klikk bakgrunn → buttons forsvinner

**Exit Criteria:**
✅ Full interaksjonsflyt fungerer end-to-end
✅ 3D-toggle smooth og responsiv
✅ Action buttons synkronisert med markør-state
✅ Ingen console errors eller warnings

---

### Phase 4: Polish & Accessibility ⏱️ Est: 1-2 timer

**Tasks:**
- [x] Accessibility:
  - [x] Add aria-labels til buttons
  - [x] Keyboard navigation (Tab, Enter, Space)
  - [x] Focus states (focus:ring-2 focus:ring-blue-500)
  - [ ] Test med screen reader (optional - defer to manual testing)
- [x] Polish:
  - [ ] Ripple effect ved klikk (optional, P1 - defer)
  - [ ] Bounce animation ved markør-klikk (optional, P1 - defer)
  - [x] Pulse animation på aktiv markør (implemented)
  - [ ] Smart positioning ved skjermkanter (optional, P2 - defer)
- [x] Mobile testing:
  - [x] Touch targets: 44px (w-11 h-11)
  - [ ] Test på iPhone/iPad Safari (manual testing required)
  - [ ] Verifiser haptic feedback (optional - defer)
- [x] Performance:
  - [x] MutationObserver cleanup implemented
  - [x] Event listener cleanup implemented
  - [x] Animations use CSS for 60fps

**Exit Criteria:**
✅ Keyboard navigation fungerer (Enter/Space on button)
✅ Touch targets er store nok (44px)
✅ Smooth performance (CSS animations, proper cleanup)
✅ Aria labels present for accessibility

---

## Technical Considerations

### Performance

**Optimization Strategies:**
1. **Debounce position updates** — Avoid recalculating position on every pixel of pan/zoom
   ```typescript
   const debouncedUpdate = useMemo(
     () => debounce(updatePosition, 100),
     []
   );
   ```

2. **RequestAnimationFrame** — Sync position updates with browser paint
   ```typescript
   const updatePosition = () => {
     requestAnimationFrame(() => {
       const rect = markerDOM.getBoundingClientRect();
       setPosition({ x: rect.right + 8, y: rect.top + rect.height / 2 });
     });
   };
   ```

3. **Conditional rendering** — Only render when `show === true && position !== null`

4. **Cleanup** — Always cleanup MutationObserver, event listeners, and RAF

**Performance Targets:**
- Action buttons render: **< 100ms**
- Position update: **< 16ms** (60fps)
- Animation frame rate: **30+ FPS** on mid-range devices

---

### Browser Compatibility

**Supported:**
- Chrome 90+ (Marker3DInteractiveElement introduced 2021)
- Safari 15+ (iOS Safari 15+)
- Edge 90+
- Android Chrome 100+

**Gotchas:**
- `MutationObserver` required for position tracking — supported in all modern browsers
- `getBoundingClientRect()` is performant but avoid calling in tight loops
- Touch events: Use `onClick` (not `onPointerDown`) for consistency

---

### Alternative Approaches Considered

#### Approach A: CSS-based positioning (Rejected)
**Idea:** Use CSS `transform` and `position: absolute` relative to marker.

**Why rejected:**
- Cannot position relative to `Marker3DInteractiveElement` in DOM tree
- Would require wrapper element, complicating marker structure
- React portal + fixed positioning is more flexible

#### Approach B: Canvas overlay (Rejected)
**Idea:** Draw action buttons on HTML canvas overlaid on map.

**Why rejected:**
- No native hover/click events on canvas elements
- Harder to maintain and style
- Accessibility nightmare (no semantic HTML)

#### Approach C: Mapbox GL JS custom controls (N/A)
**Idea:** Use Mapbox's IControl API for custom UI.

**Why rejected:**
- Not applicable — we're using Google Maps 3D, not Mapbox
- Google Maps 3D doesn't have equivalent control API

---

## Dependencies & Risks

### Dependencies

**External:**
- ✅ `@vis.gl/react-google-maps` (already in use)
- ✅ `lucide-react` (already in use)
- ✅ `tailwindcss` (already configured)

**Internal:**
- ✅ `useMap3DCamera` hook (components/lib/hooks/useMap3DCamera.ts)
- ✅ Google Maps 3D API (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
- ✅ Route data (routeData from parent component)

**Data Flow:**
```
User clicks marker
  ↓
ExplorerMap3D.handlePOIClick(poiId)
  ↓
Parent (page.tsx) calculates route via API
  ↓
routeData flows back to ExplorerMap3D
  ↓
MarkerActionButtons renders with travelTime
  ↓
User clicks 3D button
  ↓
cameraRef.current.flyTo({ tilt: 55, range: 600 })
```

### Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Position calculation laggy** | Medium | Medium | Debounce updates, use RAF, add loading state |
| **Buttons overlap at screen edges** | Low | Low | Implement smart positioning (P2) |
| **Memory leak from observers** | Low | High | Always cleanup in useEffect return |
| **3D API quota exceeded** | Low | High | Monitor usage, add rate limiting if needed |
| **Icons not rendering in portal** | Low | Medium | Test early, ensure React 18+ (already in use) |
| **Touch targets too small on mobile** | Medium | Medium | Use 44px minimum, test on real devices |

---

## Testing Strategy

### Unit Tests (Optional - Ved behov)

```typescript
// __tests__/MarkerActionButtons.test.tsx
describe('MarkerActionButtons', () => {
  it('renders buttons when show=true and position exists', () => {
    // Test rendering logic
  });

  it('calculates position relative to marker element', () => {
    // Test getBoundingClientRect usage
  });

  it('calls onToggle3D when 3D button clicked', () => {
    // Test click handler
  });

  it('cleans up observers on unmount', () => {
    // Test cleanup
  });
});
```

### Manual Testing Checklist

**Desktop (Chrome, Safari, Firefox):**
- [ ] Klikk markør → action buttons vises
- [ ] Buttons posisjonert korrekt (8px gap)
- [ ] Hover states fungerer (scale 1.05)
- [ ] Klikk 3D-knapp → kamera tilter smooth
- [ ] Travel time viser riktig verdi (fra routeData)
- [ ] Buttons følger markør ved pan/zoom
- [ ] Buttons forsvinner ved bakgrunn-klikk
- [ ] Keyboard: Tab → buttons, Enter → 3D toggle

**Mobile (iPhone Safari, Android Chrome):**
- [ ] Touch targets: minimum 44px
- [ ] Buttons vises etter markør-tap
- [ ] 3D-toggle fungerer på touch
- [ ] Ingen layout-shift ved button-visning
- [ ] Pinch-to-zoom påvirker ikke buttons
- [ ] Buttons forsvinner ved tap utenfor

**Accessibility:**
- [ ] Screen reader leser button labels
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Focus rings synlige (2px blue)
- [ ] Reduced motion: Instant camera change (duration: 0)

---

## Success Metrics

**Quantitative:**
- Time to render action buttons: **< 100ms**
- Animation frame rate: **30+ FPS**
- Touch target size: **≥ 44px**
- Interaction latency: **< 200ms** (click → camera start)

**Qualitative:**
- ✅ Brukere forstår umiddelbart hva 3D-knappen gjør
- ✅ Travel time gir tydelig feedback på distanse
- ✅ Sirkulære markører føles mer "native" enn Google pins
- ✅ Animasjoner føles smooth, ikke distraherande

---

## Open Questions

- [ ] **Skal travel time-knappen være klikkbar?**
  - Forslag: Klikk → vis full route details modal
  - Eller: Keep it read-only for now

- [ ] **Hvilke kategorier trenger custom icons?**
  - Start med subset: building, museum, park, restaurant, cafe
  - Utvid etter behov basert på project data

- [ ] **Skal 3D-knapp ha toggle state?**
  - Forslag: Ja — endre ikon til "2D" når tilt > 30°
  - Eller: Alltid samme ikon, men tooltip endres

- [ ] **Smart positioning ved skjermkanter?**
  - Prioritet: P2 (nice-to-have)
  - Implementer hvis tid tillater

---

## References & Research

### Internal References

**Existing Components:**
- `components/map/poi-marker-3d.tsx:17-100` — Current marker implementation
- `components/variants/explorer/GeoLocationWidget.tsx:79-100` — Widget positioning pattern
- `lib/hooks/useMap3DCamera.ts` — Camera control hook
- `components/map/route-layer-3d.tsx` — Route rendering pattern

**Utilities:**
- `lib/utils.ts:1-7` — `cn()` function for Tailwind
- `lib/map-utils.ts:109-140` — Distance/bearing calculations

**Type Definitions:**
- `lib/types.ts` — POI, Coordinates, TravelMode types

**Brainstorm Document:**
- `docs/brainstorms/2026-02-03-explorer-3d-interaction-design.md`

**Related Plans:**
- `docs/plans/2026-02-03-feat-google-maps-3d-migration-plan.md` — Google Maps 3D migration (Phases 1-4 complete)
- `docs/plans/2026-02-03-feat-3d-map-camera-constraints-plan.md` — Camera constraints pattern

### External References

**Google Maps 3D API:**
- [Marker3DInteractiveElement](https://developers.google.com/maps/documentation/javascript/3d-maps/markers)
- [Map3DElement Camera](https://developers.google.com/maps/documentation/javascript/3d-maps/camera)

**Design Inspiration:**
- macOS Spotlight search (circular action buttons)
- Apple Maps (floating UI controls)

**Icon Library:**
- [Lucide React Icons](https://lucide.dev/)

---

## Next Steps

1. **Review plan** — Get feedback on approach and priorities
2. **Execute Phase 1** — Implement circular markers first
3. **Iterate** — Test each phase before moving to next
4. **Polish** — Add accessibility and performance optimizations
5. **Deploy** — Ship to staging, then production

---

**Ready to start implementation?** → Run `/workflows:work docs/plans/2026-02-03-feat-explorer-3d-action-buttons-plan.md`
