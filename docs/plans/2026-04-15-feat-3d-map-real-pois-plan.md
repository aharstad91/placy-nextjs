---
title: "feat: Ekte POI-data i Google Maps 3D med distanse-opacity"
date: 2026-04-15
type: feat
status: ready
brainstorm: docs/brainstorms/2026-04-15-3d-map-real-pois-brainstorm.md
tech-audit: YELLOW → korrigert → klar
---

# Plan: Ekte POI-data i Google Maps 3D

## Mål

Erstatt hardkodet dummy-data i `Report3DMap` med ekte POIs fra Supabase (allerede
hentet), og legg til distansebasert opacity-tiers for "nær/fjern"-effekt.

## Akseptansekriterier

- [ ] 3D-kartet viser ekte POIs fra `project.pois` (ikke dummy-data)
- [ ] Preview-kartet viser ekte POIs (ikke bare modal-kartet)
- [ ] CTA viser korrekt antall POIs (ikke hardkodet 15)
- [ ] Tab-filteret (Alle / Mat / Oppvekst / Transport / Trening / Natur) matcher ekte kategorier
- [ ] Pins ≤1200m fra prosjektsenter vises i full opacity
- [ ] Pins >1200m vises i opacity 0.3
- [ ] "Vis alt" er default ved modalåpning
- [ ] `Report3DMap` vises for alle rapporter med POIs (ikke bare Wesselsløkka-piloten)
- [ ] Modal-kartet mountes kun når modalen er åpen (én WebGL-kontekst)
- [ ] Ingen nye Supabase-kall — kun bruk eksisterende `project.pois`
- [ ] TypeScript: 0 feil, lint: 0 feil

## Arkitekturoversikt

```
page.tsx (server)
  → projectData.pois (POI[])
  → ReportPage
      → effectiveProject.pois + reportData.centerCoordinates
      → Report3DMap (pois: POI[], center: Coordinates)
            → calculateDistance() fra lib/utils/geo.ts (allerede eksisterer)
            → visiblePois = filterPoisByTab(poisWithOpacity, activeTab)
            → MapView3D (opacities: Record<string, number>)
                  → [React.memo] Marker3DItem
                        → Marker3DPin (opacity?: number på SVG root)
```

## Fase 1: Generell config — `wesselslokka-3d-config.ts` → `report-3d-config.ts`

**Fil:** `components/variants/report/blocks/wesselslokka-3d-config.ts`

### Endringer
- Rename fil til `report-3d-config.ts`
- Rename eksporterte konstantnavn:
  - `WESSELSLOKKA_CENTER` → fjernes (ikke lenger brukt; center kommer fra props)
  - `WESSELSLOKKA_CAMERA_LOCK` → `DEFAULT_CAMERA_LOCK`
  - `WESSELSLOKKA_TAB_IDS` → `MAP3D_TAB_IDS`
  - `WESSELSLOKKA_TAB_LABELS` → `MAP3D_TAB_LABELS`
  - `WesselslokkaTabId` → `Map3DTabId`
- Fjern: alle `WESSELSLOKKA_POIS`, alle `CAT_*`-konstantene
- Behold: kamerakonfig-objekt, tab-IDs, tab-labels

### Tab-mapping (ny)
```ts
import { DEFAULT_THEMES } from "@/lib/themes/default-themes";

// Mapping: tab-ID → DEFAULT_THEMES.id
const THEME_BY_TAB: Record<string, string> = {
  mat: "mat-drikke",           // restaurant, cafe, bar, bakery
  oppvekst: "barnefamilier",   // skole, barnehage, lekeplass, idrett
  natur: "kultur-opplevelser", // museum, library, cinema, park, outdoor, badeplass
  transport: "transport",      // bus, train, tram, bike, parking, carshare, taxi...
  trening: "trening-velvare",  // gym, spa, swimming
};

export function filterPoisByTab(pois: POI[], tabId: Map3DTabId): POI[] {
  if (tabId === "alle") return pois;
  const themeId = THEME_BY_TAB[tabId];
  const theme = DEFAULT_THEMES.find((t) => t.id === themeId);
  if (!theme) return pois;
  const catSet = new Set(theme.categories);
  return pois.filter((poi) => catSet.has(poi.category.id));
}
```

**Viktig:** Oppdater den ene importeren i `Report3DMap.tsx` til å bruke den nye filstien og nye navn.

## Fase 2: Fjern `isWesselslokkaPilot`-gate i ReportPage

**Fil:** `components/variants/report/ReportPage.tsx:51-57`

- Slett `isWesselslokkaPilot`-beregningen (useMemo-blokken)
- Bytt betingelsen til `effectiveProject.pois.length > 0`
- Send `pois={effectiveProject.pois}` ned som ny prop

```tsx
{effectiveProject.pois.length > 0 && (
  <Report3DMap
    areaSlug={areaSlug}
    projectName={reportData.projectName}
    center={reportData.centerCoordinates}
    pois={effectiveProject.pois}
  />
)}
```

## Fase 3: Oppdater `Report3DMap.tsx` — bruk ekte POIs

**Fil:** `components/variants/report/blocks/Report3DMap.tsx`

### Props-interface
```ts
interface Report3DMapProps {
  areaSlug?: string | null;
  projectName?: string;
  center?: { lat: number; lng: number };
  pois: POI[];  // NY — ekte POIs fra prosjektet
}
```

### Distanse og opacity (useMemo)
```ts
import { calculateDistance } from "@/lib/utils/geo"; // eksisterer allerede

const NEAR_THRESHOLD_M = 1200;
const FAR_OPACITY = 0.3;

const poisWithOpacity = useMemo(() => {
  if (!center) return pois.map((p) => ({ ...p, opacity: 1 as number }));
  return pois.map((poi) => {
    const dist = calculateDistance(
      center.lat, center.lng,
      poi.coordinates.lat, poi.coordinates.lng
    );
    return { ...poi, opacity: dist <= NEAR_THRESHOLD_M ? 1 : FAR_OPACITY };
  });
}, [pois, center]);

// opacities-record for MapView3D (stabil referanse via useMemo)
const opacities = useMemo(
  () => Object.fromEntries(poisWithOpacity.map((p) => [p.id, p.opacity])),
  [poisWithOpacity]
);
```

### Oppdater begge MapView3D-instanser
- Preview (linje ~132): `pois={poisWithOpacity}` — OBS: var `WESSELSLOKKA_POIS`
- Modal: `pois={visiblePois}` med `opacities={opacities}`

### CTA-tekst
```tsx
<p ...>{pois.length} steder i 3D</p>  // var WESSELSLOKKA_POIS.length
```

### Deferred modal WebGL-kontekst
Wrap modal-kartet slik at det kun mountes når modalen er åpen:
```tsx
{sheetOpen && (
  <MapView3D
    mapId="report-3d-modal"
    ...
    opacities={opacities}
  />
)}
```

**NB:** Rename variabelnavnene `dialogOpen` → `sheetOpen`, `handleDialogChange` → `handleSheetChange`, `handleOpenDialog` → `handleOpenSheet` for å matche at vi bruker `<Sheet>`, ikke `<Dialog>`.

## Fase 4: Legg `opacity`-prop på `Marker3DPin`

**Fil:** `components/map/Marker3DPin.tsx`

```ts
interface Marker3DPinProps {
  color: string;
  Icon: LucideIcon;
  number?: number;
  size?: number;
  opacity?: number;  // NY — 0–1, default 1
}

// På SVG root:
<svg opacity={opacity ?? 1} ...>
```

SVG `opacity`-attributt appliseres før Google Maps 3D rasteriserer markøren → fungerer korrekt.

## Fase 5: Legg `opacities` gjennom `MapView3D`

**Fil:** `components/map/map-view-3d.tsx`

```ts
interface MapView3DProps {
  // ... eksisterende
  opacities?: Record<string, number>;  // poi.id → opacity (0–1)
}

// I Marker3D-mappingen:
<Marker3DPin
  opacity={opacities?.[poi.id] ?? 1}
  ...
/>
```

### React.memo for individuelle markers (ytelse)
Wrap hvert `<Marker3D>` + `<Marker3DPin>` i en memoized komponent for å hindre
full re-render av alle 80 markers ved hvert POI-klikk:

```tsx
const Marker3DItem = React.memo(function Marker3DItem({
  poi, isActive, opacity, onPOIClick,
}: {
  poi: POI; isActive: boolean; opacity: number; onPOIClick?: (id: string) => void;
}) {
  const Icon = getIcon(poi.category.icon);
  return (
    <Marker3D
      position={{ lat: poi.coordinates.lat, lng: poi.coordinates.lng, altitude: isActive ? 20 : 0 }}
      altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
      onClick={() => onPOIClick?.(poi.id)}
      title={poi.name}
    >
      <Marker3DPin
        color={poi.category.color}
        Icon={Icon}
        size={isActive ? 48 : 40}
        opacity={opacity}
      />
    </Marker3D>
  );
});
```

Erstatter inline `{pois.map((poi) => ...)}` i `Map3DInner`.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `wesselslokka-3d-config.ts` → `report-3d-config.ts` | Rename fil + alle identifiers + ny filterlogikk |
| `ReportPage.tsx` | Fjern pilot-gate, legg til `pois`-prop, `pois.length > 0`-betingelse |
| `Report3DMap.tsx` | Bruk `pois`-prop, distanse+opacity, deferred modal, navnefix |
| `Marker3DPin.tsx` | Legg til `opacity?: number` |
| `map-view-3d.tsx` | Legg til `opacities?: Record<string, number>`, `React.memo` wrapper |

## Tech audit-funn løst

| Funn | Løsning |
|------|---------|
| `haversineMeters` vs `calculateDistance` | Bruker eksisterende `calculateDistance` fra `lib/utils/geo.ts` |
| `WesselslokkaTabId` type-rename | → `Map3DTabId` |
| Preview brukte WESSELSLOKKA_POIS | Fase 3 oppdaterer begge MapView3D-instanser |
| To WebGL-kontekster | Deferred modal med `{sheetOpen && ...}` |
| `Map<string, number>` → `Record` | Bruker `Record<string, number>` overalt |
| Tom POI-liste | `pois.length > 0`-gate i ReportPage |
| `dialogOpen` naming vs Sheet | Rename til `sheetOpen` |

## Ikke inkludert

- Distanse-slider UI
- Travel-time API-kall (presise gangtider)
- Dynamisk tab-suppression basert på faktiske POI-kategorier (kan vurderes)
- Naering/hotell bransjeprofil-strategi for 3D-tabs (fremtidig)
