---
title: "feat: Add camera constraints to 3D map for performance"
type: feat
date: 2026-02-03
---

# feat: Add camera constraints to 3D map for performance

## Overview

Implementer kamerabegrensninger (tilt, range, bounds) på Google Maps 3D for å sikre smooth 60fps-opplevelse på alle enheter og kontrollere API-kostnader.

## Problem Statement / Motivation

Google Maps 3D API eksponerer ikke direkte kontroll over LOD, tile quality eller frame rate. Ved ekstreme kameravinkler (90° tilt) eller zoom-nivåer lastes unødvendig mye 3D-data, noe som:
- Skaper hakking/lagging på mobil
- Øker API-kostnader
- Gir dårlig brukeropplevelse

**Løsning:** Begrense kamera innenfor trygge verdier som gir god ytelse.

## Proposed Solution

"Fri med grenser" — brukeren kan navigere fritt (pan/tilt/zoom), men innenfor definerte min/max-verdier:

| Constraint | Min | Max | Begrunnelse |
|------------|-----|-----|-------------|
| Tilt | 0° | 70° | Unngår "liggende" 90° som laster mye data |
| Range | 150m | 3000m | Balanserer detalj og oversikt |
| Bounds | Prosjektområde + 20% buffer | - | Begrenser API-kostnad |

## Technical Approach

### API Begrensninger

Google Maps 3D API har **native støtte** for:
- ✅ `minTilt` / `maxTilt`
- ✅ `bounds` (lat/lng restriction)
- ❌ `minRange` / `maxRange` — **finnes ikke**

**Range-begrensning må implementeres via event listener.**

### Arkitektur

```
┌─────────────────────────────────────────────────────────────┐
│  ExplorerPage / GuidePage                                   │
│  (beregner bounds fra POI-data)                             │
└─────────────────────────┬───────────────────────────────────┘
                          │ constraints prop
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  ExplorerMap3D / GuideMap3D                                 │
│  (passer constraints videre)                                │
└─────────────────────────┬───────────────────────────────────┘
                          │ constraints prop
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  MapView3D                                                  │
│  - Setter native tilt/bounds på Map3DElement                │
│  - Legger til gmp-rangechange listener for range-clamping   │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: Types og Interface

**Fil:** `lib/types.ts`

```typescript
export interface CameraConstraints {
  minTilt?: number;       // Default: 0
  maxTilt?: number;       // Default: 70
  minRange?: number;      // Default: 150
  maxRange?: number;      // Default: 3000
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  boundsBuffer?: number;  // Default: 0.2 (20% av diagonal)
}
```

**Fil:** `types/google-maps-3d.d.ts`

Legg til manglende type declarations for `minTilt`, `maxTilt`, `bounds`.

#### Phase 2: Bounds Calculation Utility

**Fil:** `lib/map-utils.ts` (ny fil)

```typescript
export function calculateBoundsWithBuffer(
  coordinates: Coordinates[],
  bufferRatio: number = 0.2
): CameraConstraints['bounds'] {
  // 1. Beregn min/max lat/lng fra koordinater
  // 2. Beregn diagonal distanse
  // 3. Legg til buffer (minimum 200m)
  // 4. Returner bounds objekt
}

export function clampRange(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(max, value));
}
```

#### Phase 3: MapView3D Constraints

**Fil:** `components/map/map-view-3d.tsx`

Oppdater `MapView3DInnerProps`:
```typescript
interface MapView3DInnerProps {
  // ... existing props
  constraints?: CameraConstraints;
}
```

I `initMap()` funksjon (linje 100-108):
```typescript
const map3d = new Map3DElement({
  center: { lat: center.lat, lng: center.lng, altitude: 0 },
  tilt: 50,
  heading: 0,
  range: 1200,
  mode: "SATELLITE" as google.maps.MapMode,
  // Native constraints
  minTilt: constraints?.minTilt ?? 0,
  maxTilt: constraints?.maxTilt ?? 70,
  bounds: constraints?.bounds,
});

// Range constraint via listener (ikke native støtte)
map3d.addEventListener("gmp-rangechange", () => {
  const currentRange = map3d.range;
  const minRange = constraints?.minRange ?? 150;
  const maxRange = constraints?.maxRange ?? 3000;

  if (currentRange < minRange) {
    map3d.range = minRange;
  } else if (currentRange > maxRange) {
    map3d.range = maxRange;
  }
});
```

#### Phase 4: Page-Level Integration

**Fil:** `components/variants/explorer/ExplorerMap3D.tsx`

```typescript
// Beregn constraints fra POI-data
const constraints = useMemo((): CameraConstraints => {
  const bounds = calculateBoundsWithBuffer(
    basePOIs.map(p => p.coordinates),
    0.2 // 20% buffer
  );

  return {
    minTilt: 0,
    maxTilt: 70,
    minRange: 150,
    maxRange: 3000,
    bounds,
  };
}, [basePOIs]);

// Pass til MapView3D
<MapView3D
  constraints={constraints}
  // ... other props
/>
```

**Fil:** `components/variants/guide/GuideMap3D.tsx`

Samme mønster med tour stops istedenfor POIs.

#### Phase 5: GPS Far Mode Håndtering

**Problem:** Nåværende kode bruker `maxRange: 5000` for GPS far mode (linje 137).

**Løsning:** Bruk UI-indikator istedenfor å vise begge i viewport.

```typescript
// I ExplorerMap3D.tsx
if (geoMode === "gps-far") {
  // Vis prosjektområdet normalt (innenfor constraints)
  // Vis retningsindikator til brukerens posisjon
  showUserDirectionIndicator(userPosition, center);
}
```

Alternativt: Legg til `ignoreConstraints?: boolean` option for spesialtilfeller.

## Acceptance Criteria

### Functional Requirements

- [ ] Tilt begrenses til 0°-70° på alle 3D-kart
- [ ] Range begrenses til 150m-3000m på alle 3D-kart
- [ ] Bruker kan ikke panorere utenfor prosjektområde + buffer
- [ ] Constraints beregnes automatisk fra POI/stop-data
- [ ] GPS far mode viser retningsindikator (ikke zoom ut til 5000m)

### Non-Functional Requirements

- [ ] 60fps opprettholdes under gestures på mid-range mobil
- [ ] Ingen merkbar forsinkelse ved constraint-clamping
- [ ] Constraint-sjekk tar <1ms per event

### Quality Gates

- [ ] Fungerer på Chrome, Safari, Firefox (desktop)
- [ ] Fungerer på iOS Safari 15+, Android Chrome 100+
- [ ] Ingen console errors ved normal bruk
- [ ] `prefers-reduced-motion` respekteres fortsatt

## Edge Cases

| Scenario | Håndtering |
|----------|------------|
| Single POI | Minimum bounds 500m x 500m |
| POI ved bounds-kant | Buffer sikrer margin |
| Route > 3000m range | Vis ved maxRange, bruker kan panorere |
| Animation til ugyldig posisjon | Pre-clamp target før animasjon |
| User hits boundary | Hard stop (ingen bounce) |

## Dependencies

- Eksisterende `@vis.gl/react-google-maps` wrapper
- Google Maps 3D API (preview)

## Risks

| Risiko | Sannsynlighet | Mitigation |
|--------|---------------|------------|
| Native bounds støtte mangler | Lav | Fallback til listener |
| Range listener performance | Medium | Debounce hvis nødvendig |
| Mobile gesture-konflikter | Medium | Test tidlig på devices |

## Files to Modify

| Fil | Endring |
|-----|---------|
| `lib/types.ts` | Legg til `CameraConstraints` interface |
| `lib/map-utils.ts` | Ny fil: bounds calculation utilities |
| `types/google-maps-3d.d.ts` | Legg til constraint type declarations |
| `components/map/map-view-3d.tsx` | Legg til constraints prop og enforcement |
| `components/variants/explorer/ExplorerMap3D.tsx` | Beregn og pass constraints |
| `components/variants/guide/GuideMap3D.tsx` | Beregn og pass constraints |

## Testing Checklist

- [ ] Desktop: Pan til bounds-grense
- [ ] Desktop: Tilt til max (70°)
- [ ] Desktop: Zoom ut til max range
- [ ] Mobile: Pinch zoom constraints
- [ ] Mobile: Two-finger tilt constraints
- [ ] POI click flyTo respekterer constraints
- [ ] Guide stop navigation respekterer constraints
- [ ] Route fitBounds clamps til maxRange
- [ ] Single-POI prosjekt fungerer

## Open Questions (Resolved)

| Spørsmål | Beslutning |
|----------|------------|
| Boundary behavior? | Hard stop (ingen bounce) |
| GPS far mode? | UI-indikator, ikke zoom ut |
| Buffer størrelse? | 20% av diagonal, min 200m |
| Configurable per-project? | Nei, global defaults først |
| Visual feedback ved grense? | Nei, ikke i MVP |

## References

- [Google Maps 3D Reference](https://developers.google.com/maps/documentation/javascript/reference/3d-map)
- [Brainstorm doc](../brainstorms/2026-02-03-3d-map-performance-ux-brainstorm.md)
- [Migration plan](./2026-02-03-feat-google-maps-3d-migration-plan.md)
