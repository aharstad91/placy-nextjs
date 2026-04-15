---
title: "feat: UnifiedMapModal — forening av Mapbox 2D og Google 3D med add-on toggle"
type: feat
date: 2026-04-15
status: approved
brainstorm: docs/brainstorms/2026-04-15-map-unification-brainstorm.md
prior_art:
  - docs/brainstorms/2026-02-04-kartmotor-valg-brainstorm.md
  - docs/solutions/ui-bugs/google-maps-3d-webgl-context-crash-touch-devices-20260415.md
  - docs/solutions/architecture-patterns/report-kart-per-kategori-modal-20260409.md
---

# feat: UnifiedMapModal — forening av Mapbox 2D og Google 3D med add-on toggle

## Overview

Rapport-siden (`/eiendom/[customer]/[project]/rapport`) har i dag to parallelle kart-komponenter med nesten identisk shell men ulike motorer:

| Komponent | Rolle | Motor | Status |
|---|---|---|---|
| `ReportThemeSection` | Per-tema-kart (Hverdagsliv, Mat, Transport...) | Mapbox 2D | Standardleveranse |
| `Report3DMap` | «Alt rundt {område}»-samlekart | Google 3D | Skal være paid add-on |

Vi konsoliderer disse til én `UnifiedMapModal`-komponent med 2D/3D-toggle, der Mapbox er default og Google 3D gates bak `projects.has_3d_addon`-flag. Begge tidligere shell-komponenter blir tynne wrappers som mater inn riktig preset (per-tema med pills, eller samlekart med tema-tabs).

## Problem Statement / Motivation

### Dagens smerter

1. **To parallelle implementasjoner av samme shell.** Sheet-oppsettet, ReportMapDrawer-integrasjonen, dormant-preview-knappen, WebGL-disiplinen — alt er duplisert mellom `ReportThemeSection.tsx:355-419` og `Report3DMap.tsx:203-314` med kun minimale forskjeller. Endringer må gjøres to steder.

2. **Ingen salgbar add-on-struktur.** Google 3D kjøres i dag *alltid* (uten kostnadskontroll) for alle prosjekter. Ingen mekanisme for å bestemme om en kunde har kjøpt 3D.

3. **Inkonsistent brukeropplevelse.** Bruker opplever to ulike «kart-moduser»: tema-kart (2D, pills) og samlekart (3D, tabs). Semantikken er uklar — hvorfor er noen kart i 3D og andre i 2D?

4. **Ingen kontinuitet mellom modusene.** Bruker kan ikke se samme område i både 2D og 3D. De er fullstendig adskilte opplevelser.

### Ønsket tilstand

- Én enhetlig `UnifiedMapModal` med 2D/3D-toggle (3D kun synlig hvis add-on)
- Mapbox 2D default overalt (både tema-kart og samlekart)
- Google 3D som paid add-on, aktivert per prosjekt via `projects.has_3d_addon`
- Kontinuitet: kamera og valgt POI beholdes ved toggle
- Én kilde til sannhet for dormant-preview, Sheet-shell, WebGL-disiplin

## Proposed Solution

### Kjernekomponenter (nye)

**1. `components/map/UnifiedMapModal.tsx`** — state-eier og orchestrator
- Eier: `mode: '2d' | '3d'`, `activePOI: string | null`, `camera: UnifiedCamera`
- Rendrer felles shell (Sheet, header, toggle-knapp, drawer, footer-slot)
- Velger internt mellom `<MapboxMotor>` og `<Google3DMotor>` basert på `mode`
- Eksponerer children/render-props slik at consumers kan injisere preset-spesifikk UI (pills vs tabs)

**2. `components/map/ModeToggle.tsx`** — 2D/3D pill-knapp
- Rendres kun hvis `has3dAddon === true`
- To-knapp pill-komponent, aktiv tilstand klart visualisert
- Tilgjengelig via tastatur (arrow keys)

**3. `lib/utils/camera-map.ts`** — kamera-mapping 2D↔3D
- `mapboxToGoogle3D({ lng, lat, zoom })` → `{ center, range, tilt, heading }`
- `google3DToMapbox({ center, range })` → `{ lng, lat, zoom }`
- Zoom-til-range kalibrering basert på eksisterende `DEFAULT_CAMERA_LOCK` (range=900, tilt=45)
- Heuristikk: Mapbox zoom 14 ≈ Google range 1500, zoom 15 ≈ 900, zoom 16 ≈ 500

**4. Supabase migrasjon `supabase/migrations/065_add_has_3d_addon.sql`**
- `ALTER TABLE projects ADD COLUMN has_3d_addon BOOLEAN NOT NULL DEFAULT FALSE`
- Separat UPDATE for Wesselsløkka-demo: `UPDATE projects SET has_3d_addon = TRUE WHERE url_slug = 'wesselslokka'`

### Modifiserte komponenter

**`components/variants/report/ReportThemeSection.tsx`**
- Erstatt egen `<Sheet>`-implementasjon med `<UnifiedMapModal preset="theme">`
- Send `has3dAddon`-prop ned fra `ReportPage`
- Beholdt: sub-kategori-pills, live transport data, trails, vehiclePositions, mapChips

**`components/variants/report/blocks/Report3DMap.tsx` → `ReportOverviewMap.tsx` (rename)**
- Erstatt egen `<Sheet>`-implementasjon med `<UnifiedMapModal preset="overview">`
- Default mode endres fra `3d` → `2d`
- Beholdt: tema-tab-filter (`MAP3D_TAB_IDS`, `filterPoisByTab`), reset-kamera-knapp
- Dormant preview: viser Mapbox 2D-preview som default (ikke 3D)

**`app/eiendom/[customer]/[project]/rapport/page.tsx`**
- Project-feltet inkluderer nå `has_3d_addon` fra Supabase
- Send ned som prop til `<ReportPage has3dAddon={...}>`

**`components/variants/report/ReportPage.tsx`**
- Prop-drill `has3dAddon` til `ReportThemeSection` og `ReportOverviewMap`

**`app/admin/projects/[id]/project-detail-client.tsx`**
- Ny checkbox i DetailsTab: «3D-satellitt-addon aktivert»
- Persisterer via eksisterende save-handler

**`lib/types.ts`**
- `interface Project` får `has_3d_addon?: boolean` (optional for backward-compat med eldre data)

### Ikke-mål (eksplisitt utenfor scope)

- Global `MapEngine`-abstraksjon for fremtidige motorer (YAGNI — kun 2 motorer)
- Endringer på Explorer, Guide, Story eller admin POI-kart
- Upgrade-CTA / upsell-UI for prosjekter uten add-on (kommer senere)
- Endringer på POI-datamodell eller API-ruter
- Endringer på `applyIllustratedTheme` eller Mapbox styling
- Endringer på Marker3DPin SVG-utseende

## Technical Approach

### Arkitektur

```
┌──────────────────────────────────────────────────────────────┐
│ ReportPage (client)                                          │
│   has3dAddon: boolean ← fra server component                 │
│   ├─ ReportThemeSection (per tema)                          │
│   │    └─ UnifiedMapModal preset="theme"                    │
│   │         ├─ Mapbox (default)                             │
│   │         └─ Google 3D (if has3dAddon && mode==='3d')     │
│   │                                                          │
│   └─ ReportOverviewMap ("Alt rundt")                        │
│        └─ UnifiedMapModal preset="overview"                 │
│             ├─ Mapbox (default)                             │
│             └─ Google 3D (if has3dAddon && mode==='3d')     │
└──────────────────────────────────────────────────────────────┘

UnifiedMapModal (state eier):
  mode                  → '2d' | '3d'
  activePOI             → string | null
  camera (unified)      → { lng, lat, zoom }  (brukt internt som kilde)

  <Sheet>
    <Header>
      <Title/Icon>
      {has3dAddon && <ModeToggle value={mode} onChange={setMode} />}
      <ResetView> (kun hvis preset="overview")
      <Close>
    <Header>
    <Content>
      {mode === '2d' ? <ReportThemeMap {...}/> : <MapView3D {...}/>}
      {activePOI && <ReportMapDrawer poi={...} onClose={...}/>}
    <Content>
    <Footer>
      {preset === 'theme' && <CategoryPills />}     ← renderProp
      {preset === 'overview' && <ThemeTabs />}      ← renderProp
    <Footer>
  <Sheet>
```

### Camera mapping (utvidet etter deepen-research)

Mapbox bruker zoom-nivå (1-22), Google 3D bruker `range` (meters fra kamera til center, **ikke ground footprint**). Konverteringen er ikke heuristisk — den kan utledes eksakt fra Web Mercator-projeksjonen + Google 3D sin perspektiv-kamera-geometri.

#### Utledet formel

Mapbox GL JS bruker 512px-tiles, så:
```
metersPerPixel(zoom, lat) = C * cos(lat_rad) / 2^(zoom + 9)
                            der C = 40,075,016.686m (jordens omkrets)
```

Google 3D `range` for å matche samme ground footprint som et viewport-bredde W:
```
range = (W * metersPerPixel * cos(tilt_rad)) / (2 * tan(fov_h / 2))
        der fov_h = 2 * atan(aspect * tan(fov_v / 2)),  fov_v = 35° default
```

Forenklet for lat 63.4 (Trondheim/Wesselsløkka), W=672px, aspect=4/3, fov_v=35°:
```
range = 27,978,121 * cos(tilt_rad) / 2^zoom
```

#### Kalibreringstabell (lat ~63.4, viewport 672x504, fov_v=35°)

| Mapbox zoom | metersPerPixel | range tilt=0° | range tilt=45° | Ground width |
|---|---|---|---|---|
| 12 | 17.22m | 6,831m | 4,830m | ~11,572m |
| 13 | 8.61m | 3,416m | 2,415m | ~5,786m |
| 14 | 4.31m | 1,708m | 1,208m | ~2,893m |
| 15 | 2.15m | 854m | 604m | ~1,447m |
| 16 | 1.08m | 427m | 302m | ~723m |
| 17 | 0.54m | 213m | 151m | ~362m |

Merk: tidligere heuristikk `range ≈ 4000 * 2^(-(zoom - 12))` var ~17% lav på zoom 12 (4000 vs faktisk 4830 ved tilt=45). Den nye formelen er innenfor ±5% toleranse.

#### Implementasjonsskisse (`lib/utils/camera-map.ts`)

```typescript
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
const DEFAULT_FOV_V_DEG = 35;  // Google 3D default
const TILE_PIXEL_OFFSET = 9;   // Mapbox GL JS bruker 512px-tiles → +9

export function zoomToRange(
  zoom: number,
  latDeg: number,
  tiltDeg: number,
  viewportWidth: number,
  viewportHeight: number,
  fovVDeg = DEFAULT_FOV_V_DEG,
): number {
  const latRad = (latDeg * Math.PI) / 180;
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const fovVRad = (fovVDeg * Math.PI) / 180;
  const aspect = viewportWidth / viewportHeight;
  const fovHRad = 2 * Math.atan(aspect * Math.tan(fovVRad / 2));

  const metersPerPixel = (EARTH_CIRCUMFERENCE_M * Math.cos(latRad)) /
    Math.pow(2, zoom + TILE_PIXEL_OFFSET);
  const groundWidth = viewportWidth * metersPerPixel;
  return (groundWidth * Math.cos(tiltRad)) / (2 * Math.tan(fovHRad / 2));
}

export function rangeToZoom(
  range: number,
  latDeg: number,
  tiltDeg: number,
  viewportWidth: number,
  viewportHeight: number,
  fovVDeg = DEFAULT_FOV_V_DEG,
): number {
  const latRad = (latDeg * Math.PI) / 180;
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const fovVRad = (fovVDeg * Math.PI) / 180;
  const aspect = viewportWidth / viewportHeight;
  const fovHRad = 2 * Math.atan(aspect * Math.tan(fovVRad / 2));

  const groundWidth = (range * 2 * Math.tan(fovHRad / 2)) / Math.cos(tiltRad);
  const metersPerPixel = groundWidth / viewportWidth;
  return Math.log2(
    (EARTH_CIRCUMFERENCE_M * Math.cos(latRad)) / (metersPerPixel * 512),
  );
}
```

#### Tilt og heading

- **Tilt**: 1:1 mapping mellom Mapbox `pitch` og Google `tilt`. Begge er vinkel fra nadir.
- **Heading**: 1:1 mapping. Begge bruker compass-grader (0=nord, klokke).
- Når vi bytter 2D→3D fra Mapbox (typisk pitch=0), default Google tilt=45° (god 3D-perspektiv uten å miste overblikk).
- Når vi bytter 3D→2D, sett Mapbox pitch=0 (top-down) — Mapbox sin pitch i tema-kart-modus er alltid 0.

#### Viktige gotchas

- **Latitude er kritisk.** Mercator-skala dobles ved lat 63 vs ekvator. Glemmer du `cos(lat_rad)` blir formelen 2x feil i Trondheim.
- **Viewport-størrelse må reflektere faktisk container.** Hvis modal resizes (mobil vs desktop), recompute range.
- **FOV-default må pinnes.** Hvis vi setter `fov` på `Map3DElement`, må samme verdi brukes i kalibrering. Anbefaling: ikke sett FOV — bruk Google sin default 35°.
- **Høy tilt (>60°) gir asymmetrisk footprint** — formelen matcher kun ground-scale ved center. Akseptabelt fordi vi pinner default tilt=45°.

### State-synkronisering ved toggle (utvidet etter deepen-research)

#### WebGL-asymmetri mellom motorene (kritisk)

Research avdekket viktig asymmetri:
- **Mapbox `react-map-gl`** kaller `WEBGL_lose_context.loseContext()` synkront ved `map.remove()` på unmount. **Pålitelig kontekstrelease.**
- **Google 3D `@vis.gl/react-google-maps`** har **ingen eksplisitt cleanup** av `<gmp-map-3d>`-elementet. Kontekstrelease avhenger av browser GC, som er treig på iOS WebKit.

Konsekvens: enkel betinget rendering (`{is3D ? <Map3D/> : <Mapbox/>}`) er **ikke trygt** — React kan unmounte og mounte i samme commit, og Google 3D rekker ikke å frigjøre konteksten før Mapbox prøver å allokere ny.

#### 4-state machine for trygg toggling

```
States: 'mapbox' | 'switching-to-3d' | 'google3d' | 'switching-to-2d'

Bruker trykker [3D] (fra 2D):
  1. setEngine('switching-to-3d')           → render: {spinner med last frame screenshot}
  2. React unmounter <MapboxMotor>          → loseContext() kalles synkront
  3. await 150ms (én GC-tick som safety)
  4. setEngine('google3d')                  → mount <Google3DMotor> med ny camera

Bruker trykker [2D] (fra 3D):
  1. setEngine('switching-to-2d')           → render: {spinner med last frame screenshot}
  2. (helst) Hent canvas fra <gmp-map-3d>.shadowRoot, kall loseContext() eksplisitt
  3. React unmounter <Google3DMotor>        → DOM removal
  4. await 350ms (lengre delay pga manglende cleanup)
  5. setEngine('mapbox')                    → mount <MapboxMotor> med ny camera
```

#### Camera + POI sync ved toggle

1. Før unmount: les current camera via:
   - Mapbox: `mapRef.getCenter()`, `getZoom()`, `getBearing()` — pitch alltid 0
   - Google 3D: `map3dRef.center`, `range`, `tilt`, `heading`
2. Konverter via `camera-map.ts` (zoomToRange / rangeToZoom — se Camera mapping-seksjonen).
3. Lagre i UnifiedMapModal-state som `pendingCamera` før mount av nytt engine.
4. `activePOI` bevares via React state (ikke refs) — passes til ny motor som `activePOIId`-prop.
5. `ReportMapDrawer` rendres uavhengig av motor (motor-agnostic) → bevares automatisk.

#### Spam-click guard (innebygd i state machine)

Klikk under `switching-*` states ignoreres:
```typescript
const handleToggle = useCallback(() => {
  if (engine === 'switching-to-3d' || engine === 'switching-to-2d') return;
  // ... state transition
}, [engine]);
```

Toggle-knappen skal disables visuelt (opacity + `pointer-events-none`) under switch.

#### Crossfade-strategi (anti-mønster)

**Ikke crossfade med begge motorer stacked** — bryter "én kontekst om gangen"-prinsippet og krasjer iOS. I stedet:
- **For 2D→3D:** Capture last Mapbox frame via `map.getCanvas().toDataURL()` rett før unmount. Mapbox kan settes med `preserveDrawingBuffer: true` for å garantere at canvas har innhold tilgjengelig.
- **For 3D→2D:** Bruk fade-til-spinner. `<gmp-map-3d>` shadow DOM-canvas har trolig `preserveDrawingBuffer: false` (Google sin internal config) → `toDataURL()` returnerer blank. Ikke prøv (audit-finding 10).
- Total switching-tid 150-350ms — fade-til-spinner er akseptabel UX for så kort overgang.

#### Generell WebGL-disiplin (uendret fra før)

- Mapbox og Google 3D rendres ALDRI samtidig (gjelder også preview vs modal — `{!sheetOpen &&}`-mønsteret).
- Dormant preview bruker Mapbox 2D (lettere), ikke Google 3D.
- iOS-fallback (`useWebGLCheck`) i `MapView3D` bevares as-is.

#### `webglcontextlost` recovery

Lytt på begge motorer for `webglcontextlost`. Hvis fired:
1. `e.preventDefault()` — signaliser intent å recoverer
2. Sett `contextLost=true` state
3. Vis "Last på nytt"-knapp som incrementer en `key={remountCounter}` på motoren — tvinger full remount

### Preset-konfig

**Render-slot pattern (verifisert mot codebase-konvensjon):** Vi bruker `React.ReactNode`-props for footer-content (categoryPills, tabs) — IKKE render-props/funksjoner. Dette matcher eksisterende mønster i `components/ui/sheet.tsx`, `components/ui/Modal.tsx` (footer-prop), og `ReportMapTabs.tsx` (callback-basert state). Consumers wirer egne callbacks ved composition.

```typescript
type MapModalPreset = 'theme' | 'overview';

interface UnifiedMapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: MapModalPreset;
  has3dAddon: boolean;
  title: string;
  titleIcon?: React.ReactNode;
  pois: POI[];
  center: Coordinates;
  projectName?: string;
  areaSlug?: string | null;

  // Preset-specific, optional
  themeProps?: {            // brukes av preset='theme'
    mapStyle?: string;
    trails?: TrailCollection;
    poiLiveInfo?: Record<string, string>;
    mapChips?: Array<{ icon: React.ReactNode; label: string }>;
    vehiclePositions?: Array<{ lat: number; lng: number; color: string }>;
    featuredPOIIds?: Set<string>;
    categoryPills?: React.ReactNode;  // render slot for sub-kategori-pills
  };
  overviewProps?: {         // brukes av preset='overview'
    opacities?: Record<string, number>;
    tabs?: React.ReactNode;  // render slot for tema-tabs
    resetOnReset?: boolean;  // toggler synlighet av reset-knapp
  };
}
```

**Bruksmønster (eksempel for overview):**
```tsx
<UnifiedMapModal
  preset="overview"
  has3dAddon={project.has3dAddon ?? false}
  pois={visiblePois}
  // ...
  overviewProps={{
    opacities,
    tabs: (
      <ThemeTabs
        activeTab={activeTab}
        onTabChange={(id) => {
          setActiveTab(id);
          setSelectedPOIId(null);
        }}
      />
    ),
  }}
/>
```

`ThemeTabs` eier sin egen render-logikk; consumer eier state. UnifiedMapModal får ferdig JSX å plassere i footer-slot.

### Implementation Phases

#### Phase 1: Foundation (DB + typer + admin)
**Mål:** `has_3d_addon`-feltet finnes i DB, type, admin-UI og leses i rapport-page.

**Konkrete filer/funksjoner (verifisert mot codebase):**
- DB-kolonne: `projects.has_3d_addon BOOLEAN NOT NULL DEFAULT FALSE`
- TypeScript-felt: `Project.has3dAddon?: boolean` (camelCase, matcher konvensjon — `homepageUrl`, `venueType`)
- Loader: `getProjectFromSupabase()` i `lib/supabase/queries.ts:528` — bruker `select("*")` så ingen select-endring nødvendig, men return-mapping på linje 588-604 må extracte feltet:
  ```typescript
  has3dAddon: (project as Record<string, unknown>).has_3d_addon as boolean ?? false,
  ```
- Server action-mønster fra `app/admin/projects/[id]/page.tsx:792-811` (kopier `updateProjectTags`-mønster):
  ```typescript
  async function updateProjectHas3dAddon(formData: FormData) {
    "use server";
    const id = getRequiredString(formData, "id");
    const shortId = getRequiredString(formData, "shortId");
    const has3dAddon = formData.get("has3dAddon") === "true";
    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");
    const { error } = await supabase
      .from("projects")
      .update({ has_3d_addon: has3dAddon })
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
  }
  ```
- Admin checkbox i `project-detail-client.tsx:394-418`-mønsteret (kopier tags-knapp, tilpass til single boolean)
- Server-page `app/eiendom/[customer]/[project]/rapport/page.tsx` allerede henter project og passer til `<ReportPage project={...}>` (linje 96-101) — ingen endring her, ReportPage får hele Project og prop-driller `has3dAddon` videre

**Steg:**
- Skriv migrasjon `065_add_has_3d_addon.sql`
- Kjør migrasjon direkte via psql (CLAUDE.md-mønster) og verifiser
- Utvid `Project`-interface i `lib/types.ts:336-358` → `has3dAddon?: boolean`
- Oppdater return-statement i `getProjectFromSupabase()` til å mappe feltet
- Legg til checkbox i `DetailsTab` i `app/admin/projects/[id]/project-detail-client.tsx` + server action i `page.tsx`
- Prop-drill `has3dAddon` fra `ReportPage` ned til `ReportThemeSection` og `ReportOverviewMap`
- Sett `has_3d_addon=true` for Wesselsløkka via separat SQL-update i samme migrasjon
- → **TC-01, TC-02, TC-03**

#### Phase 2: Core UnifiedMapModal + ModeToggle + camera-map
**Mål:** Ny komponent finnes og er isolert testbar, men ikke enda tatt i bruk.

- Skriv `lib/utils/camera-map.ts` med 2-veis mapping
- Skriv enhetstester i `lib/utils/camera-map.test.ts` (co-located, matcher konvensjon fra `lib/utils/poi-score.test.ts`, IKKE i `__tests__/`)
- Skriv `components/map/ModeToggle.tsx` (ren UI-komponent)
- Skriv `components/map/UnifiedMapModal.tsx` med state-håndtering, preset-branching, Sheet-shell, ReportMapDrawer-integrasjon
- **Ren API (audit-finding 9):** Bruk `useRef<Map3DRef>` + `ref`-prop på `<Map3D>`-komponenten i Google 3D-wrapper, ikke `onMapReady`-callback med `Map3DInstance`. `Map3DRef` har `flyCameraTo` typesikkert eksponert — eliminer `as unknown as`-cast som finnes i nåværende `Report3DMap.tsx:71-83`.
- **Sheet top-offset (audit-finding 11):** Bruk `!top-[4vh]` (større kart-areal) som unified default. Tidligere ReportThemeSection brukte `!top-[8vh]` — overskriv til 4vh for konsistens.
- → **TC-04, TC-05, TC-06, TC-07**

#### Phase 3: Integrate ReportThemeSection
**Mål:** Per-tema-kartene bruker UnifiedMapModal. Alle eksisterende funksjoner (trails, live data, pills) virker.

- Refaktor `ReportThemeSection.tsx` til å bruke `UnifiedMapModal preset="theme"`
- Flytt `CategoryFilters`-komponenten som render-slot (categoryPills)
- Fjern duplisert Sheet/ReportMapDrawer-kode
- Send `has3dAddon`-prop fra `ReportPage`
- **KRITISK (audit-finding 3):** Wrap dormant `<ReportThemeMap>`-preview i `ReportThemeSection.tsx` med `{!mapDialogOpen && ...}` guard, identisk med `Report3DMap.tsx:167`-mønsteret. Ellers vil Mapbox-preview + Google 3D-modal være mounted samtidig på iOS → krasj. (I dag er det safe fordi begge er Mapbox.)
- **KRITISK (audit-finding 1):** UnifiedMapModal må lese Mapbox-kamera ved toggle. Legg til `onMapReady?: (ref: MapRef) => void`-callback på `ReportThemeMap.tsx` (matcher mønster fra `MapView3D.onMapReady`). Eller alternativt: La UnifiedMapModal eie `<Map>`-komponenten direkte og kun bruke ReportThemeMap-shell-en for markers/overlays. Anbefalt: `onMapReady`-callback (mindre refactor, samme mønster).
- Manuell verifisering i browser — trykk på en tema-preview, sjekk at alt fungerer som før (2D default)
- → **TC-08, TC-09, TC-10, TC-11**

#### Phase 4: Integrate ReportOverviewMap (rename fra Report3DMap)
**Mål:** «Alt rundt»-samlekart bruker UnifiedMapModal. Default endret fra 3D → 2D. Tema-tabs virker.

- Rename `Report3DMap.tsx` → `ReportOverviewMap.tsx` (Supabase-filter: git mv)
- Oppdater import-referanser i `ReportPage.tsx`
- Dormant preview bruker Mapbox 2D (ikke 3D)
- Modal åpner i 2D default, switcher til 3D via toggle (hvis has3dAddon)
- Flytt tema-tab-filter som render-slot (tabs)
- Behold reset-kamera-knapp i header
- Manuell verifisering
- → **TC-12, TC-13, TC-14, TC-15**

#### Phase 5: Toggle-oppførsel + polish
**Mål:** Smooth toggle 2D↔3D med kamera-kontinuitet og POI-persist.

- Implementer 4-state machine (`mapbox` | `switching-to-3d` | `google3d` | `switching-to-2d`) i UnifiedMapModal
- Camera-sync via `camera-map.ts` ved hver mode-overgang (bruk `pendingCamera`-state mellom unmount og mount)
- Switching-state UI: enten last-frame-screenshot (`canvas.toDataURL()` rett før unmount) eller enkel fade-til-spinner
- Toggle-knapp disabled visuelt under switching (opacity + `pointer-events-none`)
- (Helst) Eksplisitt `loseContext()` på Google 3D canvas via `<gmp-map-3d>.shadowRoot` før unmount
- Bevar `activePOI` og `ReportMapDrawer` på tvers av mode-bytte (state lever utenfor motor)
- Lytt på `webglcontextlost` på begge motorer + recovery via `key`-remount
- WebGL-disiplin verifisering: ingen periode med 2 mounted motorer (verifiser med React DevTools eller console.log i mount/unmount)
- → **TC-16, TC-17, TC-18, TC-19**

#### Phase 6: Verification + cleanup
**Mål:** Alle mekaniske sjekker passerer, Wesselsløkka-demo funker ende-til-ende, død kode er fjernet.

- Kjør `npm run lint` — 0 errors
- Kjør `npm test` — alle eksisterende tester passerer + nye camera-map-tester
- Kjør `npx tsc --noEmit` — ingen typefeil
- Kjør `npm run build` — bygger uten feil
- Manuell test i browser på `http://localhost:3000/eiendom/broset-utvikling-as/wesselslokka/rapport`:
  - Toggle synlig (Wesselsløkka har add-on)
  - Tema-kart og samlekart åpner i 2D
  - Toggle til 3D virker, kamera mappes korrekt, POI-valg bevares
  - Toggle tilbake til 2D virker
  - Mobile touch: toggle + POI-klikk funker
  - iOS-fallback virker (kan testes med Safari Developer → Enable WebGL = off)
- Verifiser at et prosjekt uten `has_3d_addon` ikke viser toggle
- Slett eventuell dead code (gamle Sheet-fragmenter)
- → **TC-20, TC-21**

## Alternative Approaches Considered

### B — `MapEngine`-abstraksjon
Felles interface (`setCenter`, `addMarker`, `onClick`) som Mapbox og Google 3D implementerer. Elegant, men krever refaktor av begge motorene til å være plug-and-play. Over-engineering for kun 2 motorer og én bruker (rapport-siden). **Rejected:** YAGNI + for stor refactor mot prototype-fokus.

### C — Kopi + konsolider
Legg `mode`-prop direkte i eksisterende komponenter + duplisering av toggle/camera-logikk. **Rejected:** Dupliserer toggle-UI to steder, divergerer over tid.

### Alternativ modus-default per preset
Tidlig forslag: «Alt rundt» åpner i 3D (add-on), tema-kart i 2D. **Rejected:** Bryter med prinsippet om at Mapbox er default overalt. Inkonsistent UX.

### Feature flag via env-variabel
`NEXT_PUBLIC_ENABLE_3D_ADDON=true` global flag. **Rejected:** Umulig å demo per kunde, og når flere betaler for add-on må vi uansett ha per-prosjekt-flag.

## Acceptance Criteria

### Functional Requirements

- [ ] `projects.has_3d_addon` eksisterer i Supabase som `BOOLEAN NOT NULL DEFAULT FALSE`
- [ ] Wesselsløkka-prosjekt har `has_3d_addon=true` i DB
- [ ] Admin-UI har checkbox for `has_3d_addon` i prosjekt-detaljer
- [ ] `Project`-typen i `lib/types.ts` inkluderer `has_3d_addon?: boolean`
- [ ] Rapport-page fetcher `has_3d_addon` og sender ned til `ReportPage`
- [ ] Tema-kart (`ReportThemeSection`) bruker `UnifiedMapModal` og åpner i 2D default
- [ ] Samlekart («Alt rundt», `ReportOverviewMap`) bruker `UnifiedMapModal` og åpner i 2D default
- [ ] Når `has_3d_addon=true`: 2D/3D-toggle er synlig i header
- [ ] Når `has_3d_addon=false`: 2D/3D-toggle er skjult helt
- [ ] Toggle 2D→3D bevarer kartsenter og zoom (mappet)
- [ ] Toggle 3D→2D bevarer kartsenter og zoom (mappet)
- [ ] Toggle bevarer `activePOI` og `ReportMapDrawer`-tilstand
- [ ] Per-tema-kart viser sub-kategori-pills (uendret fra i dag)
- [ ] Samlekart viser tema-tabs i footer (uendret fra i dag)
- [ ] Transport-tema fortsatt viser `trails`, `mapChips`, `vehiclePositions`, live-data i 2D-modus
- [ ] «Tilbake»-knapp (reset kamera) fortsatt virker i samlekart

### Non-Functional Requirements

- [ ] **iOS WebGL-disiplin:** Kun én motor aktiv om gangen. Dormant preview og modal-kart aldri mounted samtidig.
- [ ] **Touch event-routing:** Toggle-knapp respondere på første tap, selv over Google 3D custom element.
- [ ] **Performance:** Toggle-bytte < 500ms visuell overgang.
- [ ] **Mobile responsivitet:** Modal og toggle fungerer identisk på mobil (touch) og desktop.
- [ ] **Backward compat:** Eksisterende prosjekter uten `has_3d_addon`-verdi behandles som `false`.

### Quality Gates

- [ ] `npm run lint` — 0 errors
- [ ] `npm test` — alle tester passerer, inkludert nye camera-map-tester
- [ ] `npx tsc --noEmit` — 0 typefeil
- [ ] `npm run build` — bygger uten feil
- [ ] Migrasjon 065 kjørt og verifisert mot Supabase
- [ ] Manuell browser-test på Wesselsløkka-rapport bestått
- [ ] Ingen dead code (alle gamle Sheet-fragmenter slettet)

## Success Metrics

### Kortsiktige (når ferdig)
- 100% av rapport-kart går gjennom `UnifiedMapModal`
- Wesselsløkka-demoen viser fortsatt 3D-kapabilitet (samme wow-faktor som før)
- Kode-reduksjon: ~300 linjer duplisert Sheet/drawer-logikk fjernet

### Langsiktige (etter noen uker i prod)
- Ved neste Google 3D-feature: kun én komponent å endre
- Add-on-status synlig i admin → enklere å styre kostnad

## Dependencies & Prerequisites

### Teknisk
- Supabase-tilgang for migrasjon (psql via DATABASE_PASSWORD i `.env.local`)
- Wesselsløkka-prosjekt må eksistere i DB (verifiseres i Phase 1)
- `react-map-gl/mapbox` (Mapbox motor) — allerede installert
- `@vis.gl/react-google-maps` (Google 3D motor) — allerede installert

### Organisatorisk
- Ingen — dette er et internt refactor uten stakeholder-awareness

## Risk Analysis & Mitigation

### Risiko 1: Kamera-mapping blir unøyaktig
**Sannsynlighet:** Lav (nedjustert etter deepen-research).
**Konsekvens:** Bruker kommer til et litt forskjellig sted i 3D enn i 2D.
**Mitigering:** Formelen er nå utledet fra Web Mercator + perspektiv-geometri, ikke heuristisk — se Camera mapping-seksjonen. Enhetstester på kalibreringsbrekkpunkter (zoom 12, 14, 15, 16, 17). Inkluderer eksplisitt latitude-korreksjon (kritisk på 63.4°). Manuell visuell verifisering på Wesselsløkka. Toleranse ±5% innenfor formelen, akseptabel UX-toleranse ±20%.

### Risiko 2: iOS WebGL-kontekst-krasj ved rask toggle-spamming
**Sannsynlighet:** Høy hvis enkel betinget rendering brukes (oppjustert etter research).
**Konsekvens:** Stille krasj, kart slutter å reagere — særlig hvis Google 3D unmountes uten eksplisitt loseContext (`@vis.gl/react-google-maps` har ingen automatisk cleanup).
**Mitigering:** Implementer 4-state machine (`mapbox` | `switching-to-3d` | `google3d` | `switching-to-2d`) med `setTimeout`-gap mellom unmount og mount. Klikk under `switching-*`-state ignoreres → innebygd spam-guard, ingen ekstern debounce nødvendig. Anbefalt timing: 150ms for Mapbox→3D (Mapbox releaser kontekst synkront), 350ms for 3D→Mapbox (Google 3D mangler cleanup). Helst: hent canvas fra `<gmp-map-3d>.shadowRoot` og kall `loseContext()` eksplisitt før unmount → kan redusere 3D→2D-delay til 150ms. Test på faktisk iPhone SE / 12 Mini (lavest RAM, hardest case). Se også Risiko 6 nedenfor.

### Risiko 3: `featuredPOIIds`, `trails`, `vehiclePositions` fungerer kun i 2D
**Sannsynlighet:** Høy. Disse er Mapbox-spesifikke.
**Konsekvens:** Bruker i 3D-modus mister noen overlays.
**Mitigering:** Dokumenter eksplisitt at disse kun vises i 2D for nå. 3D har fortsatt POI-markører og modal-interaksjon. Fremtidig arbeid kan legge til tilsvarende overlays i 3D hvis ønskelig.

### Risiko 4: Prosjekter uten `has_3d_addon`-verdi bryter ved lesing
**Sannsynlighet:** Lav. Migrasjonen setter `DEFAULT FALSE`.
**Konsekvens:** N/A — default håndteres i migrasjon.
**Mitigering:** Type er `boolean?` (optional) og koden bruker `?? false` som fallback.

### Risiko 5: Mapbox markers usynlig pga CSS-cascade i ny container
**Sannsynlighet:** Lav-medium. UnifiedMapModal introduserer ny layout-hierarki.
**Konsekvens:** Markers collapser til 100% width i ny modal.
**Mitigering:** Verifiser `.mapboxgl-marker` width i DevTools. Eksplisitt `width: auto` på marker-containeren om nødvendig. Ref learning: `mapbox-markers-invisible-missing-css-EventRoute-20260413.md`.

### Risiko 6: Rename `Report3DMap.tsx` → `ReportOverviewMap.tsx` glemmer import
**Sannsynlighet:** Lav med `git mv` + grep-verifisering.
**Konsekvens:** Build-feil.
**Mitigering:** Grep for `Report3DMap` etter rename, oppdater alle referanser.

### Risiko 7: Crossfade-anti-mønster
**Sannsynlighet:** Medium hvis vi prøver å lage smooth animasjon mellom motorene.
**Konsekvens:** Begge WebGL-kontekster aktive samtidig under crossfade → iOS-krasj.
**Mitigering:** Aldri stack begge motorer. Bruk last-frame-screenshot via `canvas.toDataURL()` i switching-state, eller enkel fade-til-spinner. Eksplisitt anti-pattern dokumentert i UnifiedMapModal-kommentarer.

### Risiko 8b: Dormant Mapbox-preview + Google 3D-modal samtidig på iOS
**Sannsynlighet:** Sikker hvis Phase 3 ikke implementerer guard.
**Konsekvens:** iOS WebGL-krasj (to kontekster: preview-Mapbox + modal-Google3D).
**Mitigering:** Wrap dormant `<ReportThemeMap>`-preview med `{!mapDialogOpen && ...}`-guard, identisk med eksisterende `Report3DMap.tsx:167`-mønster. Merket som KRITISK i Phase 3-checklist.

### Risiko 9: FOV-default endres på Map3DElement → kalibrering bryter
**Sannsynlighet:** Lav (vi setter ikke fov i dag).
**Konsekvens:** Camera-mapping blir off med samme prosent som FOV avviker.
**Mitigering:** Aldri sett `fov` på Map3DElement. Bruk Google sin default 35°. Hvis vi senere må sette FOV, oppdater `DEFAULT_FOV_V_DEG` i `camera-map.ts` synkront.

## Resource Requirements

- Utvikler: 1 (Claude autonomt via `/full`)
- Estimert omfang: ~400 linjer ny kode, ~300 linjer sletting, 1 migrasjon, 3 render-slot-komponenter

## Future Considerations

### Etter denne leveransen
- **Upsell-UI:** Når gating er etablert, kan vi legge til «Oppgrader til 3D»-CTA for prosjekter uten add-on
- **Streetview som tredje modus:** Samme UnifiedMapModal-arkitektur støtter `mode: 'streetview'` som fremtidig utvidelse
- **3D-overlays:** Porte `trails`, `vehiclePositions`, `mapChips` til Google 3D hvis add-on-kunder etterspør det
- **Per-seksjon default mode:** Hvis add-on-kunder vil at «Alt rundt» skal åpne direkte i 3D, legg til `defaultMode`-prop på UnifiedMapModal
- **Customer-tier i stedet for prosjekt-flag:** Når flere prosjekter per kunde har add-on, vurder å flytte flagget opp til customer-nivå

### YAGNI — ikke bygg nå
- Global `MapEngine`-abstraksjon (kun 2 motorer, én bruker)
- Watermark/preview-modus for ikke-betalende (kompleks, lav verdi)
- Tredje kart-motor (Apple Maps, OSM raw)

## Documentation Plan

### Under implementering
- Kommentarer i `UnifiedMapModal.tsx` som forklarer preset-branching og WebGL-disiplin
- JSDoc på `camera-map.ts` med eksempler

### Etter fullføring (Phase 6: Compound)
- `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md` — dokumenterer arkitekturen og beslutningene
- Oppdater `PROJECT-LOG.md` med beslutning om gating-modell
- Hvis nye bugs oppdages under utvikling: legg til i `docs/solutions/ui-bugs/`

## Test Cases

Hvert krav i Acceptance Criteria mappes til ett eller flere TC-XX. Implementation phases er annotert med relevante TC-IDs (se Implementation Phases-seksjonen).

### Functional — Phase 1 (Foundation)

**TC-01 | functional | P1** — DB-kolonne eksisterer
- **Krav:** `projects.has_3d_addon BOOLEAN NOT NULL DEFAULT FALSE`
- **Given:** Migrasjon 065 har kjørt
- **When:** Query `SELECT column_name FROM information_schema.columns WHERE table_name='projects' AND column_name='has_3d_addon'`
- **Then:** Returnerer 1 rad med `data_type=boolean`, `is_nullable=NO`, `column_default=false`

**TC-02 | functional | P1** — Wesselsløkka har add-on
- **Krav:** Wesselsløkka-prosjekt har `has_3d_addon=true`
- **Given:** Migrasjon 065 har kjørt med UPDATE-statement
- **When:** `SELECT has_3d_addon FROM projects WHERE url_slug='wesselslokka'`
- **Then:** Returnerer `true`

**TC-03 | functional | P1** — Admin checkbox persisterer
- **Krav:** Admin checkbox toggler flag og lagrer via server action
- **Given:** Admin er på `/admin/projects/[id]` for Wesselsløkka, has3dAddon=true
- **When:** Trykker checkbox så den deselectes
- **Then:** DB oppdateres til `has_3d_addon=false`, side reloades, checkbox er deselected

### Functional — Phase 2 (Camera-map + Toggle + UnifiedMapModal core)

**TC-04 | functional | P1** — Camera mapping presisjon
- **Krav:** `zoomToRange(15, 63.4, 45, 672, 504)` returnerer ~604m
- **Given:** Implementert `camera-map.ts` med utledet formel
- **When:** Kall `zoomToRange(15, 63.4, 45, 672, 504)`
- **Then:** Returnerer mellom 574m og 634m (±5% av 604)

**TC-05 | functional | P1** — Roundtrip stabilitet
- **Krav:** zoomToRange → rangeToZoom returnerer samme zoom
- **Given:** Implementert begge funksjoner
- **When:** `rangeToZoom(zoomToRange(15, 63.4, 45, 672, 504), 63.4, 45, 672, 504)`
- **Then:** Returnerer 15.00 ± 0.01

**TC-06 | edge-case | P1** — Latitude-korreksjon
- **Krav:** Mapping må inkludere `cos(lat)` for å unngå Mercator-feil
- **Given:** Implementert `zoomToRange`
- **When:** Kall med samme zoom/tilt på lat=0 vs lat=63.4
- **Then:** Verdiene differerer med faktor `cos(63.4°)/cos(0)` = 0.4476 (±1%)

**TC-07 | functional | P2** — ModeToggle keyboard
- **Krav:** ModeToggle tilgjengelig via tastatur (arrow keys)
- **Given:** ModeToggle rendret med fokus
- **When:** Trykk Right Arrow
- **Then:** Mode bytter, `aria-pressed` oppdateres på pill-knappene

### Functional — Phase 3 (ReportThemeSection integration)

**TC-08 | functional | P1** — Per-tema-modal bruker UnifiedMapModal i 2D
- **Krav:** Tema-kart åpner via UnifiedMapModal preset='theme', mode='mapbox' default
- **Given:** ReportPage refaktorert
- **When:** Bruker klikker preview for "Mat & Drikke"-tema
- **Then:** UnifiedMapModal åpnes, Mapbox-motor er mounted, Google 3D er ikke mounted

**TC-09 | functional | P1** — Sub-kategori-pills i footer-slot
- **Krav:** CategoryPills rendres i footer-slot via `themeProps.categoryPills`
- **Given:** Tema-modal er åpen for "Mat & Drikke"
- **When:** Inspiser DOM
- **Then:** Pills (Restaurant, Cafe, Bar, Bakeri) er synlig i footer

**TC-10 | functional | P1** — Mapbox overlays bevart
- **Krav:** trails, vehiclePositions, mapChips, poiLiveInfo virker som før
- **Given:** Tema-modal åpen for "Transport & Mobilitet"
- **When:** Inspiser kartet
- **Then:** Sykkel-prikker vises (vehiclePositions), live-chip i hjørnet (mapChips), tooltip viser live-data

**TC-11 | functional | P1** — featuredPOIIds permanent label
- **Krav:** POIs nevnt i narrative tekst får permanent label
- **Given:** Tema-modal åpen for tema med featured POIs
- **When:** Inspiser DOM
- **Then:** featured POIs har MarkerTooltip synlig uten hover

### Functional — Phase 4 (ReportOverviewMap integration)

**TC-12 | functional | P1** — Rename gjennomført
- **Krav:** `Report3DMap.tsx` slettet, `ReportOverviewMap.tsx` opprettet
- **Given:** Rename har skjedd via git mv
- **When:** `grep -r "Report3DMap" components/ app/` (ekskl. .git)
- **Then:** Returnerer 0 treff

**TC-13 | functional | P1** — Overview åpner i 2D
- **Krav:** «Alt rundt»-modal åpner med Mapbox 2D default
- **Given:** ReportOverviewMap integrert
- **When:** Bruker klikker «Alt rundt»-preview
- **Then:** UnifiedMapModal åpnes, mode='mapbox', Mapbox-motor er mounted (ikke Google 3D)

**TC-14 | functional | P1** — Tema-tabs i footer
- **Krav:** MAP3D_TAB_IDS rendres som tabs i footer-slot
- **Given:** Overview-modal åpen
- **When:** Inspiser footer
- **Then:** Tabs "Alle, Oppvekst, Mat, Natur, Transport, Trening" er synlig og klikkbare

**TC-15 | functional | P1** — Reset-knapp virker i begge motorer
- **Krav:** «Tilbake»-knapp resetter kamera til startpunkt
- **Given:** Overview-modal åpen, bruker har panned/zoomet
- **When:** Trykk «Tilbake»
- **Then:** Mapbox flyTo til center og initial zoom; etter toggle til 3D, samme reset-knapp kaller flyCameraTo til DEFAULT_CAMERA_LOCK

### Functional — Phase 5 (Toggle behavior)

**TC-16 | functional | P1** — Toggle synlig kun med add-on
- **Krav:** has3dAddon styrer toggle-synlighet
- **Given:** To prosjekter — A med has3dAddon=true, B med has3dAddon=false
- **When:** Åpne tema-modal i begge
- **Then:** A viser ModeToggle i header, B viser ikke ModeToggle (DOM-element fraværende)

**TC-17 | functional | P1** — Camera bevares ved toggle
- **Krav:** Toggle 2D↔3D bevarer kart-senter og scale
- **Given:** Tema-modal i 2D, bruker har pannet til (lat=63.4, lng=10.4) og zoom=15
- **When:** Trykk [3D]
- **Then:** Google 3D mountes med center=(63.4, 10.4), range mellom 574-634m (TC-04-toleranse)

**TC-18 | functional | P1** — activePOI bevares ved toggle
- **Krav:** Valgt POI og ReportMapDrawer overlever mode-bytte
- **Given:** Modal med valgt POI og drawer åpen
- **When:** Toggle 2D→3D
- **Then:** Drawer fortsatt synlig, samme POI fortsatt highlighted, `activePOIId` props sendt korrekt til ny motor

**TC-19 | edge-case | P1** — Spam-click toggle blokkeres
- **Krav:** Klikk under switching-state ignoreres
- **Given:** Modal i 2D
- **When:** Spam-klikk toggle 5 ganger raskt (innen 100ms)
- **Then:** Kun én transition skjer (2D→3D), ingen WebGL-krasj, toggle disabled visuelt under switching

### Non-functional / Quality gates — Phase 6

**TC-20 | quality-gate | P1** — Mekaniske sjekker passerer
- **Krav:** lint, test, typecheck, build alle 0 errors
- **Given:** Phase 1-5 implementert
- **When:** Kjør `npm run lint && npm test && npx tsc --noEmit && npm run build`
- **Then:** Alle 4 kommandoer exit code 0

**TC-21 | edge-case | P1** — iOS Safari toggle uten krasj
- **Krav:** Toggle 2D↔3D fungerer på iPhone uten WebGL-krasj
- **Given:** Wesselsløkka-rapport åpnet på iPhone Safari
- **When:** Åpne tema-modal, trykk [3D], trykk [2D], gjenta 3x
- **Then:** Ingen krasj, toggle responsiv hver gang, kart fortsatt funksjonelt etter 3 sykluser

**TC-22 | non-functional | P2** — Toggle visuell overgang <500ms
- **Krav:** Bytte mellom motorer føles responsivt
- **Given:** Modal åpen
- **When:** Trykk toggle, mål tid fra klikk til ny motor visible
- **Then:** Mapbox→3D ≤500ms, 3D→Mapbox ≤700ms (lengre pga Google 3D-cleanup)

**TC-23 | edge-case | P2** — Backward compat (manglende felt)
- **Krav:** Prosjekter uten has_3d_addon-verdi behandles som false
- **Given:** Hypotetisk prosjekt med `has_3d_addon=NULL` (kan ikke skje pga NOT NULL DEFAULT FALSE, men test for sikkerhets skyld)
- **When:** Last rapport-page
- **Then:** ModeToggle ikke synlig, ingen runtime-feil

**TC-24 | non-functional | P2** — Mobile responsivitet
- **Krav:** Modal og toggle fungerer identisk på mobil og desktop
- **Given:** Wesselsløkka-rapport på mobil viewport (375x667)
- **When:** Åpne modal, trykk toggle
- **Then:** Toggle synlig i header, fingertap registreres, modal slide-up animasjon kjører

### TC ↔ Implementation Phase mapping

| Phase | TC-IDs |
|---|---|
| Phase 1 (Foundation) | TC-01, TC-02, TC-03, TC-23 |
| Phase 2 (Core) | TC-04, TC-05, TC-06, TC-07 |
| Phase 3 (ThemeSection) | TC-08, TC-09, TC-10, TC-11 |
| Phase 4 (OverviewMap) | TC-12, TC-13, TC-14, TC-15 |
| Phase 5 (Toggle) | TC-16, TC-17, TC-18, TC-19, TC-22, TC-24 |
| Phase 6 (Verification) | TC-20, TC-21 |

Alle 24 TC mappes til minst én phase. Ingen phase mangler test-dekning.

## Deep Research Findings (2026-04-15)

Plan-en er beriket med fire parallelle research-agenter. Sammendrag:

### 1. Camera mapping er ikke heuristisk — den er utledbar
Forrige formel `range ≈ 4000 * 2^(-(zoom - 12))` var ~17% off på zoom 12. Ny formel basert på Web Mercator + Google 3D-perspektivgeometri: `range = 27,978,121 * cos(tilt_rad) / 2^zoom` (ved lat 63.4, viewport 672x504, fov_v=35°). Implementeres i `camera-map.ts` med eksplisitt latitude-korreksjon. Se Camera mapping-seksjonen for kalibreringstabell.

### 2. WebGL-asymmetri Mapbox vs Google 3D
**Mapbox** (`react-map-gl`) kaller `loseContext()` synkront ved unmount → trygt. **Google 3D** (`@vis.gl/react-google-maps`) har ingen automatisk cleanup → trenger eksplisitt `loseContext()` på shadowRoot canvas, eller 350ms delay før neste motor mountes. Krever 4-state machine, ikke enkel betinget rendering. Se State-synkronisering ved toggle-seksjonen.

### 3. Render-slot pattern er ReactNode props (verifisert mot codebase)
Codebase bruker konsekvent `React.ReactNode`-props med `onChange`-callbacks (sett i `components/ui/sheet.tsx`, `components/ui/Modal.tsx`, `ReportMapTabs.tsx`). Ingen render-prop-mønstre eksisterer. UnifiedMapModalProps får `categoryPills?: ReactNode` og `tabs?: ReactNode` — consumers wirer egne callbacks ved composition.

### 4. Project-flag følger eksisterende konvensjon
- Loader `getProjectFromSupabase()` i `lib/supabase/queries.ts:528` bruker `select("*")` — ingen select-endring nødvendig.
- Project-typen bruker camelCase (`homepageUrl`, `venueType`) → bruk `has3dAddon`, ikke `has_3d_addon`, i TS-typen.
- Admin server action-mønster fra `app/admin/projects/[id]/page.tsx:792-811` (`updateProjectTags`) er direkte gjenbrukbart.
- Rapport-page `app/eiendom/[customer]/[project]/rapport/page.tsx:96-101` passer allerede hele `project`-objektet til `<ReportPage>` — kun `ReportPage` som må prop-drille videre.

## References & Research

### Interne referanser

**Eksisterende kode som konsolideres:**
- `components/variants/report/ReportThemeSection.tsx:355-419` (per-tema Sheet-modal)
- `components/variants/report/blocks/Report3DMap.tsx:203-314` (samlekart Sheet-modal)
- `components/variants/report/ReportMapDrawer.tsx:28-33` (delt drawer, motor-agnostic)
- `components/variants/report/ReportThemeMap.tsx:13-34` (Mapbox-motor, uendret)
- `components/map/map-view-3d.tsx:201-219` (Google 3D-motor, uendret)
- `components/variants/report/blocks/report-3d-config.ts` (DEFAULT_CAMERA_LOCK, tab-definisjoner)

**Supabase-mønster:**
- `supabase/migrations/061_projects_homepage_url.sql` (siste schema-migrasjon på projects)
- `supabase/migrations/006_project_hierarchy_ddl.clean.sql:41-46` (projects-tabell-definisjon)

**Admin-mønster:**
- `app/admin/projects/[id]/project-detail-client.tsx:246` (DetailsTab hvor checkbox plasseres)

**Relevante hooks og utils:**
- `lib/types.ts:336-358` (Project-typen som utvides)
- `lib/themes/map-styles.ts` (MAP_STYLE_STANDARD, applyIllustratedTheme)

### Prior art

- `docs/brainstorms/2026-02-04-kartmotor-valg-brainstorm.md` — besluttet Mapbox default, Google 3D som spesialfunksjon
- `docs/brainstorms/2026-04-15-map-unification-brainstorm.md` — denne feature-en
- `docs/plans/2026-02-03-feat-3d-map-camera-constraints-plan.md` — eksisterende kamera-constraints
- `docs/plans/2026-02-03-feat-explorer-3d-action-buttons-plan.md` — 3D-markør-interaksjon

### Institutional learnings

- `docs/solutions/ui-bugs/google-maps-3d-webgl-context-crash-touch-devices-20260415.md` — **kritisk**: én WebGL-kontekst om gangen på iOS
- `docs/solutions/ui-patterns/apple-style-slide-up-modal-with-backdrop-blur-20260415.md` — unike keyframe-navn
- `docs/solutions/ui-bugs/modal-backdrop-half-viewport-css-animation-collision-20260215.md` — CSS animation name-kollisjon
- `docs/solutions/ui-bugs/mapbox-markers-invisible-missing-css-EventRoute-20260413.md` — marker-width collapse
- `docs/solutions/architecture-patterns/report-kart-per-kategori-modal-20260409.md` — modal-pattern for kart
- `docs/solutions/feature-implementations/google-maps-3d-report-block-20260415.md` — `useMap3D()` returnerer element direkte

### CLAUDE.md-regler som gjelder

- Data-henting via server components (ingen klient-Supabase)
- Alltid `next/image`, aldri `<img>`
- `@/`-prefix for alle imports
- Slett dead code umiddelbart når ny erstatter gammel
- Migrasjoner kjøres via psql (ikke supabase db push)
- Verifiser i browser at features virker, ikke bare at koden ser riktig ut
