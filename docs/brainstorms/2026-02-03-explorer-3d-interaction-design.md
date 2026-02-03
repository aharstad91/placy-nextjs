---
date: 2026-02-03
topic: explorer-3d-interaction-design
---

# Explorer 3D Map Interaction Design

## What We're Building

Et interaksjonsdesign for Explorer der brukere kan velge å se POI-er i 3D-perspektiv gjennom tydelige action buttons ved markører. Når en markør klikkes:

1. **Kameraet holder seg stille** (ingen automatisk tilt/pan)
2. **Path vises** mellom brukerens posisjon og POI
3. **Action buttons vises** ved siden av markøren:
   - **3D-knapp**: Opt-in for å tilte kameraet og se området i 3D
   - **Travel time display**: Viser reisetid og mode (f.eks. "3min 🚶")

Samtidig går vi tilbake til **sirkulære markører** (i stedet for Google Maps PinElement) for visuell konsistens med Spotlight-inspirert design.

## Why This Approach

**Problem:**
- Nåværende løsning: Klikk på markør holder kameraet stille, men brukere mangler:
  - Tydelig feedback på at path er kalkulert
  - Mulighet til å se 3D når det er relevant (terreng, bygninger)
  - Visuell konsistens med moderne UI-patterns

**Approaches considered:**
1. **Global 3D-toggle**: Enklere, men mindre granulær kontroll
2. **Context menu**: Mer kompleks, fungerer dårlig på touch
3. **Radial action buttons** (valgt): Tydelig, kontekstuell, inspirert av kjente patterns

**Why radial buttons:**
- Eksplisitt opt-in som ønsket
- Visuelt tydelig (macOS Spotlight-stil)
- Gir umiddelbar feedback på travel time
- Enkel å utvide med flere actions senere

**Why sirkulære markører:**
- Visuell konsistens med action buttons (alle elementer sirkulære)
- Full kontroll over design (ikke låst til Google Maps PinElement)
- Bedre matching med Placy's designspråk

## Key Decisions

### 1. Markør-design

**Stil:**
- Sirkulær form (32px default, 40px active)
- Kategorifarge som bakgrunn
- Hvit vector icon (Lucide React)
- Hvit border (2px)
- Shadow for depth

**Implementasjon:**
- `Marker3DInteractiveElement` med custom HTML content
- CSS for styling
- Icon mapping per kategori (Museum → `Museum`, Bygning → `Building2`, osv.)

### 2. Action Buttons

**Knapper:**
1. **3D**: Cube/mountain icon → Trigger tilt (55°, range: 600m)
2. **Travel time**: "Xmin" + mode icon (🚶/🚴/🚗) → Display only (kan evt. klikkes for full route)

**Layout:**
- Vises til høyre av markør (8px gap)
- Sirkulære (32px)
- Smart positioning (unngå skjermkanter)

**Entry animation:**
- Fade in (150ms) + slide from left (200ms)
- Stagger: 50ms delay mellom knapper

### 3. Interaksjonsdetaljer

**Hover states:**
- Markør: Scale 1.0 → 1.1, lysere farge, større shadow
- Action buttons: Scale 1.0 → 1.05, solid bakgrunn

**Klikk-feedback:**
- Bounce animation (scale 1 → 1.15 → 1.0 over 200ms)
- Ripple effect fra sentrum

**Active state:**
- Markør: Scale 1.25, sterkere shadow, optional pulse (opacity 1.0 ↔ 0.9)
- Altitude lift: +20m (allerede implementert)

**3D-kamera transition:**
- Duration: 1200ms
- Easing: cubic-bezier(0.4, 0.0, 0.2, 1)
- Smooth tilt: 0° → 55°

### 4. Accessibility

- Keyboard navigation (Tab, Enter, Escape)
- Focus states (2px blue outline)
- Reduced motion support (duration = 0, no bounce/pulse)
- Aria labels for screen readers

### 5. Mobile-tilpasninger

- Større touch targets (44px minimum)
- Ingen hover states (kun active)
- Haptic feedback på klikk
- Long-press = klikk

## Implementation Notes

**Files to modify:**
- `components/map/poi-marker-3d.tsx` - Switch from PinElement to custom HTML
- `components/variants/explorer/ExplorerMap3D.tsx` - Add action buttons logic
- New: `components/map/MarkerActionButtons.tsx` - Action buttons component

**Data flow:**
```
User clicks marker
  ↓
ExplorerMap3D.handlePOIClick(poiId)
  ↓
1. onPOIClick(poiId) → Parent calculates route
2. Show MarkerActionButtons with:
   - 3D button → cameraRef.current.flyTo({ tilt: 55, range: 600 })
   - Travel time from routeData.travelTime
```

**Icon mapping:**
```typescript
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  museum: Museum,
  building: Building2,
  park: Trees,
  restaurant: Utensils,
  // ... etc
}
```

## Polish Hierarchy

**P0 (Must-have):**
- ✅ Sirkulære markører med category icons
- ✅ Action buttons (3D + travel time)
- ✅ Smooth fade-in animation
- ✅ Scale transitions
- ✅ Pointer cursor

**P1 (Nice-to-have):**
- ✅ Stagger animation for buttons
- ✅ Bounce feedback på klikk
- ✅ Ripple effect

**P2 (Polish):**
- ⭐ Pulse animation på aktiv markør
- ⭐ 3D icon rotation på hover
- ⭐ Smart positioning (avoid screen edges)

## Open Questions

- [ ] Skal travel time-knappen være klikkbar? (f.eks. åpne full route details)
- [ ] Hvilke kategorier trenger custom icons? (start med subset)
- [ ] Skal 3D-knapp ha toggle state? (kan toggle tilbake til 2D)

## Next Steps

→ `/workflows:plan` for implementation details
