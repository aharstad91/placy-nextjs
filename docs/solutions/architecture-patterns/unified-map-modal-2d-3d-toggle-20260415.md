---
title: UnifiedMapModal — sikker toggling mellom Mapbox 2D og Google Photorealistic 3D
date: 2026-04-15
category: architecture-patterns
tags: [maps, mapbox, google-3d-tiles, webgl, modal, ios-webkit, sheet, unified-component]
module: components/map
symptoms:
  - "WebGL kontekst-krasj på iOS Safari når to kart-engines mountes samtidig"
  - "Toggle-knapp ('3D-kart') vises ikke selv om has_3d_addon=true i database"
  - "Theme map og Overview map har forskjellig UX/UI"
  - "POI-klikk åpner ikke sidebar i 3D-modus"
related_files:
  - components/map/UnifiedMapModal.tsx
  - components/variants/report/blocks/ReportOverviewMap.tsx
  - components/variants/report/ReportThemeSection.tsx
  - lib/utils/camera-map.ts
  - lib/supabase/queries.ts
  - lib/types.ts
---

# UnifiedMapModal — Mapbox 2D ↔ Google 3D toggle

## Problem

Rapport-siden hadde to parallelle kart-komponenter med duplisert logikk:
- **ReportThemeMap** (Mapbox 2D) per tema-seksjon
- **Report3DMap** (Google Photorealistic 3D Tiles) for "Alt rundt"

UX divergerte over tid (forskjellige sheets, ulik POI-drawer-oppførsel, forskjellig touch-håndtering). I tillegg krevde forretningssiden at 3D skulle være paid add-on, ikke standard.

## Løsning

Én delt `UnifiedMapModal`-shell med render-slot-mønster. Default 2D Mapbox; valgfri 3D-toggle som kun vises når `has3dAddon=true` på prosjektet.

### Arkitektur

```
UnifiedMapModal (shell)
├── Header (tittel + Tilbake-knapp + ModeToggle + Lukk)
├── mapboxSlot(ctx)   → ReportThemeMap (Mapbox)
├── google3dSlot(ctx) → MapView3D (Google 3D Tiles)
├── ReportMapDrawer   (motor-agnostisk POI-sidebar)
└── bottomSlot        (kategori-pills, tabs, etc.)
```

`SlotContext` gir hver slot tilgang til delt POI-state og to ref-callbacks (`registerMapboxMap`, `registerGoogle3dMap`) slik at shell kan lese kamera-state ved toggle.

## Tre kritiske gotchas

### 1. WebGL kontekst-asymmetri (iOS WebKit)

iOS Safari tillater **kun én WebGL-kontekst om gangen**. To samtidige kart-engines = krasj.

Løsning: 4-tilstands maskin med eksplisitt teardown-vindu:

```typescript
type MapMode = "mapbox" | "switching-to-3d" | "google3d" | "switching-to-2d";

// Mapbox kaller WEBGL_lose_context.loseContext() synkront i map.remove()
const MAPBOX_TEARDOWN_MS = 150;

// Google 3D har INGEN eksplisitt cleanup — vi venter på GC
const GOOGLE3D_TEARDOWN_MS = 350;
```

Spam-click guard: `if (isSwitching) return;` på toggle.

### 2. Kamera-konvertering mellom engines

Mapbox bruker `zoom` (logaritmisk skala). Google 3D bruker `range` (meter fra kamera til target). Web Mercator gir konverteringsformelen:

```typescript
range = 27_978_121 * cos(tiltRad) / 2^zoom   // ved lat 0
// Faktoren skaleres med 1/cos(latRad) for å kompensere
```

Implementert i `lib/utils/camera-map.ts` (`zoomToRange` / `rangeToZoom`).

Default ved første 3D-aktivering: `tilt=60` (god perspektiv uten å miste oversikt).
Tilbake til 2D: `tilt=0` (Mapbox lander flatt — bevisst UX).

### 3. has3dAddon-flagget MÅ propageres gjennom RIKTIG loader

**Bug vi traff:** `has_3d_addon: true` i DB, men toggle vises ikke.

**Årsak:** To parallelle Supabase-loadere:
- `getProjectFromSupabase` (legacy) — hadde mappingen
- `getProductFromSupabase` (ny hierarki via `ProjectContainer`) — manglet mappingen

Rapport-siden bruker `getProductAsync` først, så fallback til `getProjectAsync`. Mappingen i kun den gamle pathen ga lydig `has3dAddon: false` i nye prosjekter.

**Fix:** Legg `has3dAddon` på `ProjectContainer`-typen, populer i `getProjectContainerFromSupabase`, og forward i `getProductFromSupabase`:

```typescript
// lib/types.ts
interface ProjectContainer {
  // ...
  has3dAddon?: boolean;
}

// lib/supabase/queries.ts (begge loadere)
homepageUrl: (projectAny.homepage_url as string | null) ?? null,
has3dAddon: (projectAny.has_3d_addon as boolean) ?? false,
```

**Lærdom:** Når en ny loader-path innføres parallelt med en gammel, må ALLE felter mappes i begge — eller den gamle slettes umiddelbart.

## Render-slot-mønster

Slots tar imot `ctx: SlotContext` og returnerer `ReactNode`. Det gir hver consumer (theme map, overview map, future explorer map) full kontroll over hvilke POIs som rendres, hvilke tabs som vises, og hvordan POI-klikk håndteres — uten å duplisere shell-logikken.

```tsx
<UnifiedMapModal
  has3dAddon={effectiveProject.has3dAddon ?? false}
  mapboxSlot={(ctx) => <ReportThemeMap ... onMarkerClick={ctx.setActivePOI} />}
  google3dSlot={(ctx) => <MapView3D ... onPOIClick={ctx.setActivePOI} />}
  bottomSlot={<CategoryTabs />}
  onResetCamera={handleResetCamera}
/>
```

## Touch på dormant preview

WebGL-canvas i preview-wrapper fanger touch-eventer på iOS, slik at klikk-knappen rundt aldri trigges. Fix: `pointer-events-none` på wrapper-diven rundt `<ReportThemeMap>` i `ReportOverviewMap.tsx` linje 176.

I tillegg: unmount preview når modal er åpen (`{!sheetOpen && <preview />}`) — én WebGL-kontekst om gangen.

## Verifisering (visuell)

- Wesselsløkka (`has_3d_addon: true`): toggle vises med "Kart"/"3D" pill ✓
- Leangen (`has_3d_addon: false`): kun X-knapp i header, ingen toggle ✓
- Toggle Mapbox → Google 3D → Mapbox round-trip: kamera bevart, ingen WebGL-feil ✓
- Google Photorealistic 3D Tiles renderer aerial-view med POI-markører ✓

## Når du møter dette igjen

- Ny modal med to motorer? Bruk `UnifiedMapModal` som mal — ikke bygg ny.
- WebGL-krasj på iOS? Se 4-tilstands maskin + teardown-konstanter.
- Toggle vises ikke selv om DB-flagg er satt? Sjekk om data går gjennom `getProductFromSupabase`-pathen og at `ProjectContainer` har feltet.
