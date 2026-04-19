---
title: "feat: Per-prosjekt default heading for 3D-kart"
type: feat
date: 2026-04-16
---

# feat: Per-prosjekt default heading for 3D-kart

## Oversikt

Alle 3D-kart i rapporten har hardkodet `heading: 0` (nord). For noen prosjekter er ikke nord den beste vinkelen. Stasjonskvartalet bør f.eks. vises med 180° (sør) for å vise prosjektet fra den mest fordelaktige siden.

Vi legger til ett konfigurasjonsfelt per prosjekt som deles av **alle** 3D-kart-instanser.

---

## Problem

To hardkodede steder:

1. `components/map/map-view-3d.tsx:275` — `defaultHeading={0}` ved initialisering
2. `components/variants/report/blocks/ReportOverviewMap.tsx:103` — `heading: 0` i reset-camera handler

Ingen per-prosjekt mekanisme for å overstyre disse.

---

## Løsning

### Mønster: `PROJECT_3D_HEADINGS` i `report-data.ts`

Følger eksakt samme mønster som eksisterende `PROJECT_THEME_ILLUSTRATIONS`:

```typescript
// report-data.ts
const PROJECT_3D_HEADINGS: Record<string, number> = {
  "banenor-eiendom_stasjonskvartalet": 180,
};
```

Ingen DB-migrasjon. Ingen ny abstraksjon. Verdien propageres som prop via `ReportPage` → `ReportOverviewMap` → `MapView3D`.

---

## Berørte filer — endringer

### 1. `components/map/map-view-3d.tsx` — Legg `heading` i `CameraLock`

**Linje 34–50:** Utvid `CameraLock`-interfacet:

```typescript
export interface CameraLock {
  range: number;
  tilt: number;
  minTilt?: number;
  maxTilt?: number;
  minAltitude?: number;
  maxAltitude?: number;
  panHalfSideKm?: number;
  /** Default heading (bearing) i grader. 0 = nord. Default 0 hvis ikke satt. */
  heading?: number;
}
```

**Linje 275:** Erstatt hardkodet verdi:

```typescript
// FØR
defaultHeading={0}

// ETTER
defaultHeading={cameraLock.heading ?? 0}
```

### 2. `components/variants/report/blocks/ReportOverviewMap.tsx` — Prop + reset-handler

**Prop-interface (linje 27–36):** Legg til `initialHeading`:

```typescript
interface ReportOverviewMapProps {
  areaSlug?: string | null;
  projectName?: string;
  center?: { lat: number; lng: number };
  pois: POI[];
  has3dAddon: boolean;
  /** Default heading for alle 3D-kart-instanser. 0 = nord. */
  initialHeading?: number;
}
```

**Tidlig i funksjonskomponenten** — bygg `effectiveCameraLock`:

```typescript
const effectiveCameraLock = useMemo(
  () => ({ ...DEFAULT_CAMERA_LOCK, heading: initialHeading ?? 0 }),
  [initialHeading],
);
```

**Reset-handler (linje 103):** Bruk `effectiveCameraLock.heading`:

```typescript
// FØR
heading: 0,

// ETTER
heading: effectiveCameraLock.heading,
```

**MapView3D-kall (linje 234):** Bruk `effectiveCameraLock`:

```typescript
// FØR
cameraLock={DEFAULT_CAMERA_LOCK}

// ETTER
cameraLock={effectiveCameraLock}
```

### 3. `components/variants/report/report-data.ts` — `PROJECT_3D_HEADINGS` + `ReportData`

**Etter `PROJECT_THEME_ILLUSTRATIONS`-blokken (~linje 131):**

```typescript
/** Per-prosjekt default heading for 3D-kart. 0 = nord. */
const PROJECT_3D_HEADINGS: Record<string, number> = {
  "banenor-eiendom_stasjonskvartalet": 180,
};
```

**`ReportData`-interfacet (~linje 133):** Legg til felt:

```typescript
export interface ReportData {
  projectName: string;
  address: string;
  centerCoordinates: { lat: number; lng: number };
  heroMetrics: ReportHeroMetrics;
  themes: ReportTheme[];
  label?: string;
  heroIntro?: string;
  heroImage?: string;
  summary?: ReportSummary;
  brokers?: BrokerInfo[];
  cta?: ReportCTA;
  mapStyle?: string;
  /** Default heading for 3D-kart (0–359°). Undefined = nord (0). */
  initialHeading?: number;
}
```

**Return-statement i `getReportData` (~linje 549):** Legg til felt:

```typescript
return {
  // ... eksisterende felt ...
  mapStyle: rc?.mapStyle,
  initialHeading: PROJECT_3D_HEADINGS[`${project.customer}_${project.urlSlug}`],
};
```

### 4. `components/variants/report/ReportPage.tsx` — Pipe prop til `ReportOverviewMap`

**Linje 145–151:** Legg til `initialHeading`:

```typescript
<ReportOverviewMap
  areaSlug={areaSlug}
  projectName={reportData.projectName}
  center={reportData.centerCoordinates}
  pois={effectiveProject.pois}
  has3dAddon={effectiveProject.has3dAddon ?? false}
  initialHeading={reportData.initialHeading}
/>
```

---

## Akseptansekriterier

- [ ] Stasjonskvartalet-rapporten åpner 3D-kart med 180° bearing (sørvendt)
- [ ] Reset-knappen (↺) returnerer til 180°, ikke 0°
- [ ] Prosjekter uten override (alle andre) bruker 0° (nord) som før — uendret oppførsel
- [ ] TypeScript kompilerer uten feil (`npx tsc --noEmit`)
- [ ] ESLint passerer (`npm run lint`)

---

## Scope — ikke i scope

- Per-tema heading — avvist, overkompleksitet
- Admin UI for heading — avvist, ingen runtime LLM / admin-self-service her
- Mapbox 2D reset heading — 2D-kartet resetter allerede til `bearing: 0`, uendret
- Pitch/tilt override — separat vurdering om nødvendig

---

## Tekniske notater

- `CameraLock` er **ikke** i `lib/types.ts` — den er co-lokalisert i `map-view-3d.tsx:34`
- `ReportOverviewMap` importerer `DEFAULT_CAMERA_LOCK` direkte fra `report-3d-config.ts:19` — spread-override er renere enn å endre `DEFAULT_CAMERA_LOCK`
- `useMemo` på `effectiveCameraLock` for å unngå ny objektreferanse per render
- Mapbox 2D `bearing` i reset-handler (linje 75) forblir `0` — det er 2D-kartet, ikke 3D

---

## Referanser

- Eksisterende mønster: `PROJECT_THEME_ILLUSTRATIONS` — `report-data.ts:120–131`
- `CameraLock` interface: `map-view-3d.tsx:34–50`
- `DEFAULT_CAMERA_LOCK`: `report-3d-config.ts:19–31`
- Reset-handler: `ReportOverviewMap.tsx:68–107`
- `MapView3D` defaultHeading: `map-view-3d.tsx:275`
- `ReportPage` → `ReportOverviewMap` call: `ReportPage.tsx:145–151`
