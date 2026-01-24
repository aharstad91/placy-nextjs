---
title: "refactor: Fullscreen map layout with floating panel"
type: refactor
date: 2026-01-24
brainstorm: docs/brainstorms/2026-01-24-fullscreen-map-layout-brainstorm.md
---

# Fullscreen Map Layout with Floating Panel

## Overview

Refaktorere `/admin/pois` fra 50/50 grid til **fullskjerm kart** med flytende panel i topp-venstre, inspirert av Google Maps.

## Problem Statement / Motivation

**Nåværende:**
- Kart tar kun 50% av bredden
- Fast 400px høyde på kart
- Header tar plass
- Vanskelig å se helheten i POI-dekning

**Ønsket:**
- Kart fyller hele viewport
- GUI-elementer flyter oppå kartet
- Maksimal visuell oversikt

## Proposed Solution

### Layout Structure

```
┌─────────────────────────────────────────────────┐
│ ┌────────────┐                                  │
│ │ 🔍 Søk...  │                                  │
│ │ ☑ Kafé    │                                  │
│ │ ☑ Rest    │        FULLSKJERM KART            │
│ │ [+ Ny POI]│        (100% viewport)            │
│ │           │                                  │
│ │ ───────── │          ● ●  ●                  │
│ │ Edit form │        ●    ●  ●                 │
│ │ (når valgt)│           ●                      │
│ └────────────┘                                  │
│                                     [Nav ctrl]  │
└─────────────────────────────────────────────────┘
```

### Filer som endres

| Fil | Endring |
|-----|---------|
| `app/admin/pois/poi-admin-client.tsx` | Komplett layout-refaktorering |

## Technical Approach

### 1. Container Structure

```tsx
<div className="relative w-full h-screen">
  {/* Fullskjerm kart */}
  <div className="absolute inset-0">
    <Map ... />
  </div>

  {/* Flytende panel */}
  <div className="absolute top-4 left-4 z-20
                  w-80 max-w-[30vw] max-h-[90vh]
                  bg-white rounded-lg shadow-lg
                  flex flex-col overflow-hidden">
    {/* Panel content */}
  </div>
</div>
```

### 2. Panel States

```tsx
type PanelState = 'idle' | 'editing' | 'creating';
const [panelState, setPanelState] = useState<PanelState>('idle');
```

| State | Trigger | Innhold |
|-------|---------|---------|
| `idle` | Default, klikk X | Søk + filter + "Ny POI" knapp |
| `editing` | Klikk markør | Alt fra idle + edit-form med data |
| `creating` | Klikk "Ny POI" | Alt fra idle + tom form |

### 3. Panel Content by State

```tsx
{/* Alltid synlig: Søk + Filter */}
<div className="p-4 border-b">
  <SearchField />
  <CategoryFilter compact />
</div>

{/* Conditional: Form eller "Ny POI" knapp */}
{panelState === 'idle' ? (
  <button onClick={() => setPanelState('creating')}>
    + Ny POI
  </button>
) : (
  <div className="flex-1 overflow-y-auto p-4">
    <POIForm
      poi={panelState === 'editing' ? editingPoi : null}
      onClose={() => {
        setPanelState('idle');
        setEditingPoi(null);
      }}
    />
  </div>
)}
```

### 4. Map Click Handler Update

```tsx
const handleMapClick = (event) => {
  if (panelState === 'creating') {
    // Sett koordinater for ny POI
    setCoordinates({ lat: event.lngLat.lat, lng: event.lngLat.lng });
  }
  // Ikke gjør noe i idle/editing state
};
```

### 5. Marker Click Handler

```tsx
onClick={(e) => {
  e.originalEvent.stopPropagation();
  startEditing(poi);
  setPanelState('editing');
}}
```

### 6. Styling (matcher master-map.tsx)

```tsx
// Panel container
className="absolute top-4 left-4 z-20
           w-80 max-w-[30vw] max-h-[90vh]
           bg-white/95 backdrop-blur-sm
           rounded-lg shadow-lg
           flex flex-col overflow-hidden"

// Scrollable form area
className="flex-1 overflow-y-auto"

// Compact filter
className="flex flex-wrap gap-2"
```

## Acceptance Criteria

### Layout
- [x] Kart fyller 100% av viewport (h-screen)
- [x] Ingen header - kun kart + panel
- [x] Panel flyter i topp-venstre med margin (top-4 left-4)
- [x] Panel max 30% bredde, max 90% høyde

### Panel Behavior
- [x] Default viser: søkefelt + kompakt filter + "Ny POI" knapp
- [x] Klikk markør → panel utvides med edit-form
- [x] Klikk "Ny POI" → panel viser tom form, kart-klikk setter koordinater
- [x] Klikk X → panel tilbake til default

### Preservert Funksjonalitet
- [x] Kategori-filter med URL sync fungerer
- [x] Adresse-søk fungerer
- [x] CRUD operasjoner fungerer
- [x] Google vs Native badges vises
- [x] Markør-klikk starter edit

## Technical Notes

### Referanse-pattern fra codebase

`components/map/master-map.tsx` linjer 59-125:
```tsx
<div className="absolute top-4 left-4 right-4 z-10
                bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
```

### Fjernes
- Header-seksjon
- `max-w-7xl` container
- `grid grid-cols-2` layout
- Fast `height: 400px` på kart
- Egen POI-liste kolonne (integreres i panel eller fjernes)

### Beholdes
- Alle Server Actions
- URL state sync for filter
- Form validation
- Google POI read-only felter

## References

### Internal
- Pattern: `components/map/master-map.tsx:59-125`
- Current: `app/admin/pois/poi-admin-client.tsx`
- Brainstorm: `docs/brainstorms/2026-01-24-fullscreen-map-layout-brainstorm.md`
