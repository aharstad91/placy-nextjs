---
title: "3D-kart med ekte POI-data og distansebasert opacity"
date: 2026-04-15
category: feature-implementations
tags: [google-maps-3d, pois, opacity, react-memo, webgl, performance]
symptoms:
  - Report3DMap viser hardkodet dummy-data i stedet for ekte Supabase-POIs
  - 3D-kart vises kun for Wesselsløkka-pilot, ikke alle rapporter
  - Alle pins har lik synlighet uavhengig av avstand fra prosjekt
---

# 3D-kart med ekte POI-data og distansebasert opacity

## Problem

`Report3DMap.tsx` brukte 15 hardkodede dummy-POIs fra `wesselslokka-3d-config.ts`.
Ekte POIs var allerede hentet fra Supabase i `ReportPage`, men ble ignorert av 3D-kartet.

## Løsning

### 1. Dataflyt — ingen nye API-kall

Eksisterende `project.pois` fra `getProductAsync()` sendes som prop nedover:

```
page.tsx
  → ReportPage (effectiveProject.pois)
    → Report3DMap (pois: POI[])
      → MapView3D (opacities: Record<string, number>)
        → Marker3DItem → Marker3DPin (opacity on SVG root)
```

Gate i ReportPage: `effectiveProject.pois.length > 0` (erstatter `isWesselslokkaPilot`).

### 2. SVG-opacity i Google Maps 3D

Google Maps 3D **rasteriserer** `<Marker3D>`-innholdet til en texture FØR rendering.
Opacity satt på SVG root-elementet appliseres under rasterisering → fungerer korrekt.

```tsx
// Marker3DPin.tsx
<svg opacity={opacity ?? 1} ...>
```

**Merk:** CSS `opacity`-klasser (Tailwind) fungerer IKKE — Google ignorerer disse.
Bruk SVG `opacity`-attributt direkte.

### 3. Distansebasert opacity (to-lags)

```ts
const NEAR_THRESHOLD_M = 1200; // ≈15 min gange
const FAR_OPACITY = 0.3;

const opacities = useMemo(
  () => Object.fromEntries(
    pois.map((poi) => {
      const dist = center ? calculateDistance(...) : 0;
      return [poi.id, dist <= NEAR_THRESHOLD_M ? 1 : FAR_OPACITY];
    })
  ),
  [pois, center]
);
```

`Record<string, number>` (ikke `Map<K,V>`) — konsistent med resten av codebasen.

`calculateDistance` fra `lib/utils/geo.ts` brukes direkte — ikke dupliser haversine.

### 4. Deferred WebGL-kontekst

```tsx
{/* Kun mount modal-kartet når modalen er åpen */}
{sheetOpen && (
  <MapView3D mapId="report-3d-modal" ... />
)}
```

Prevents to simultane WebGL-kontekster (preview + modal). WebGL har begrensede kontekster
per side, og å ha begge aktive gir ressurs-leak og potensielle krasj.

### 5. React.memo for 100+ markører

```tsx
const Marker3DItem = memo(function Marker3DItem({ poi, isActive, opacity, onPOIClick }) {
  const Icon = getIcon(poi.category.icon);
  return <Marker3D ...><Marker3DPin ... /></Marker3D>;
});
```

Uten `memo`: hvert klikk på én PIN re-rendrer alle 103 markører.
Med `memo`: kun den aktive PIN-en re-rendrer (isActive endres).

### 6. Tab-filter mot ekte kategori-IDs

Tabs (Oppvekst, Mat, Natur, Transport, Trening) mappes til `DEFAULT_THEMES.categories`:

```ts
const THEME_BY_TAB: Record<string, string> = {
  mat: "mat-drikke",        // ["restaurant", "cafe", "bar", "bakery"]
  oppvekst: "barnefamilier", // ["skole", "barnehage", "lekeplass", "idrett"]
  natur: "kultur-opplevelser",
  transport: "transport",
  trening: "trening-velvare",
};
```

Viktig: ekte Supabase `category.id` bruker verdier som `"restaurant"`, `"bus"`, `"gym"` —
IKKE de gamle dummy-IDene (`"mat"`, `"transport"`, `"trening"`).

## Filer endret

| Fil | Hva |
|-----|-----|
| `wesselslokka-3d-config.ts` → SLETTET | Erstattet av `report-3d-config.ts` |
| `report-3d-config.ts` (NY) | Generell kamera/tab-konfig, filterPoisByTab mot DEFAULT_THEMES |
| `ReportPage.tsx` | Fjernet isWesselslokkaPilot-gate, lagt til pois-prop |
| `Report3DMap.tsx` | Ekte POIs, distanse+opacity, deferred modal, sheetOpen naming |
| `Marker3DPin.tsx` | `opacity?: number` på SVG root |
| `map-view-3d.tsx` | `opacities?: Record<string, number>`, Marker3DItem memo |

## Resultat

- 103 ekte POIs vises for Wesselsløkka (mot 15 dummy)
- Nær-sone ≤1200m: full opacity; Fjern-sone: 0.3 opacity
- 3D-kartet fungerer nå for ALLE rapporter med POIs
- Ingen nye Supabase-kall — kun existing `project.pois`
