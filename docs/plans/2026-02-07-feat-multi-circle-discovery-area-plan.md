---
title: "feat: Multi-sirkel discovery-område for POI-import"
type: feat
date: 2026-02-07
---

# Multi-sirkel Discovery-område

## Overview

Erstatt enkel-sirkel radius med multi-sirkel discovery-område. Admin kan legge til flere sirkler på kartet for å definere POI-import-området. Hver sirkel har eget senterpunkt og justerbar radius. Import henter POI-er fra union av alle sirkler.

**Brainstorm:** `docs/brainstorms/2026-02-07-multi-circle-discovery-area-brainstorm.md`

## Problem

En enkelt sirkel rundt hotellet lager unaturlig avgrensning. For Scandic Nidelven kuttes Midtbyen og Bakklandet av radiusen. Å øke radius inkluderer uinteressante områder (industriområder, motorvei).

## Løsning

La admin legge til **flere sirkler** for å dekke irregulære områder. Union-logikk: en POI er innenfor hvis den er innenfor *minst én* sirkel. Uønskede POI-er fjernes manuelt etter import.

## Nøkkelbeslutninger (fra brainstorm)

1. **Multi-sirkel, ikke polygon** — gjenbruker eksisterende radius-logikk
2. **JSONB-kolonne** — `projects.discovery_circles`: `[{lat, lng, radiusMeters}]`
3. **Begge UI-steder** — Prosjektdetalj (definer sirkler) + Import (bruk ved import)
4. **Manuell re-import** — Admin tegner sirkler, trykker "Importer"
5. **Behold eksisterende POI-er** — Sirkler styrer kun NY import
6. **Auto-generert fra /generate-hotel** — Én default-sirkel
7. **Maks 10 sirkler** — Praktisk begrensning

## Teknisk tilnærming

### Fase 1: Database

#### `supabase/migrations/013_add_discovery_circles.sql`

```sql
ALTER TABLE projects
  ADD COLUMN discovery_circles JSONB DEFAULT NULL;

COMMENT ON COLUMN projects.discovery_circles IS
  'Array of {lat, lng, radiusMeters} objects defining POI discovery area';
```

- [x] Nullable, ingen NOT NULL — eksisterende prosjekter har `NULL` = bruk fallback (enkelt-sirkel fra center/radius)
- [x] Ingen CHECK constraint på JSONB — validering i app-lag
- [x] Graceful column fallback-mønster (fra `docs/solutions/database-issues/supabase-graceful-column-fallback-20260206.md`)

### Fase 2: TypeScript-typer

#### `lib/types.ts`

```typescript
export interface DiscoveryCircle {
  lat: number;
  lng: number;
  radiusMeters: number;
}
```

- [x] Legg til `discoveryCircles?: DiscoveryCircle[] | null` på `ProjectData`-typen
- [x] Gjenbruk i alle filer som håndterer prosjektdata

### Fase 3: Prosjektdetalj — "Discovery-område"-seksjon

#### `app/admin/projects/[id]/discovery-circles-editor.tsx` (ny fil)

Ny komponent som vises i prosjektdetalj-siden:

**UI:**
- Kart med eksisterende sirkler (semi-transparent fyll, fargekodet)
- Klikk på kart = legg til ny sirkel (default 500m radius)
- Klikk på eksisterende sirkel = velg den
- Valgt sirkel: radius-slider (300–2000m) + slett-knapp
- Lagre-knapp → PATCH `projects.discovery_circles`
- Tekst som viser antall sirkler: "3 sirkler definert"

**Gjenbruk:**
- `createCircleCoordinates()` fra `import-client.tsx` — flytt til `lib/utils/geo.ts`
- `react-map-gl/mapbox` med Source/Layer for sirkelvisning
- Radius-slider-mønsteret fra import-siden

**State:**
```typescript
const [circles, setCircles] = useState<DiscoveryCircle[]>([]);
const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
const [isDirty, setIsDirty] = useState(false);
```

**Kart-interaksjon:**
- `onClick` på kart (ikke på eksisterende sirkel) → legg til ny sirkel
- Klikk på sirkel → velg den (highlight med annen farge)
- Slett valgt sirkel → fjern fra array

**Lagring:**
```typescript
// PATCH via admin API
await fetch(`/api/admin/projects/${projectId}`, {
  method: "PATCH",
  body: JSON.stringify({ discovery_circles: circles }),
});
```

### Fase 4: Import-side — Bruk discovery_circles

#### `app/admin/import/import-client.tsx` (modifiser)

**Endringer:**
1. Når prosjekt velges og har `discovery_circles`: vis alle sirkler på kart
2. Fallback: hvis `discovery_circles` er null/tom → vis enkelt-sirkel (som i dag)
3. "Importer"-knappen sender alle sirkler til API

**Ny prop/state:**
```typescript
// Når prosjekt er valgt:
const circles = selectedProject?.discoveryCircles ??
  (center ? [{ lat: center.lat, lng: center.lng, radiusMeters: radius }] : []);
```

### Fase 5: Import API — Union-logikk

#### `app/api/admin/import/route.ts` (modifiser)

**Utvid Zod-schema:**
```typescript
const ImportRequestSchema = z.object({
  // Eksisterende (bakoverkompatibel):
  center: z.object({ lat: z.number(), lng: z.number() }).optional(),
  radiusMeters: z.number().min(300).max(2000).optional(),
  // Nytt:
  circles: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
    radiusMeters: z.number().min(300).max(2000),
  })).max(10).optional(),
  // ... resten som før
});
```

**Logikk:**
1. Hvis `circles` er satt → bruk dem
2. Ellers → fallback til `center` + `radiusMeters` (bakoverkompatibel)
3. For hver sirkel: beregn bounding box, hent POI-er
4. Dedupliser basert på `google_place_id` / `entur_id`
5. Union: POI er inkludert hvis den er innenfor *minst én* sirkel

**Per-sirkel discovery:**
```typescript
for (const circle of circles) {
  const discovered = await discoverGooglePlaces({
    center: { lat: circle.lat, lng: circle.lng },
    radiusMeters: circle.radiusMeters,
    categories,
    // ...
  });
  allDiscovered.push(...discovered);
}
// Dedupliser
const unique = deduplicateByPlaceId(allDiscovered);
```

### Fase 6: /generate-hotel — Default-sirkel

#### `.claude/commands/generate-hotel.md` (modifiser)

Etter prosjektopprettelse: lagre én default discovery_circle:
```typescript
const defaultCircle = {
  lat: hotelLat,
  lng: hotelLng,
  radiusMeters: citySpecificRadius, // 700-1200 basert på by
};
await supabase.from("projects").update({
  discovery_circles: [defaultCircle],
}).eq("id", projectId);
```

### Fase 7: Queries — Hent discovery_circles

#### `lib/supabase/queries.ts` (modifiser)

- [x] Legg til `discovery_circles` i prosjekt-select
- [x] Map til `discoveryCircles` i TypeScript

## Refactoring: Flytt createCircleCoordinates

`createCircleCoordinates()` finnes i `import-client.tsx` og `generate-client.tsx`. Flytt til `lib/utils/geo.ts` som delt utility:

```typescript
// lib/utils/geo.ts
export function createCircleCoordinates(
  lng: number,
  lat: number,
  radiusMeters: number,
  points: number = 64
): [number, number][] {
  // ... eksisterende implementering
}
```

Oppdater imports i begge filer.

## Acceptance Criteria

- [x] Admin kan legge til 1-10 sirkler på kartet i prosjektdetalj
- [x] Sirkler vises som semi-transparente sirkler med Mapbox
- [x] Admin kan velge en sirkel og justere radius (300-2000m) eller slette den
- [x] Sirkler lagres som JSONB på prosjektet
- [x] Import-siden viser prosjektets sirkler på kartet
- [x] Import henter POI-er fra union av alle sirkler (deduplisert)
- [x] Bakoverkompatibel: prosjekter uten discovery_circles bruker enkelt-sirkel
- [x] /generate-hotel oppretter én default-sirkel
- [x] createCircleCoordinates er flyttet til lib/utils/geo.ts

## Filendringer

### Nye filer
- `supabase/migrations/013_add_discovery_circles.sql`
- `app/admin/projects/[id]/discovery-circles-editor.tsx`

### Modifiserte filer
- `lib/types.ts` — DiscoveryCircle type
- `lib/utils/geo.ts` — createCircleCoordinates (flyttes hit)
- `lib/supabase/queries.ts` — hent discovery_circles
- `app/api/admin/import/route.ts` — union-logikk
- `app/admin/import/import-client.tsx` — vis multiple sirkler
- `app/admin/projects/[id]/project-detail-client.tsx` — vis discovery-seksjon
- `app/admin/generate/generate-client.tsx` — oppdater import
- `.claude/commands/generate-hotel.md` — default-sirkel

## Relevant docs/solutions/

- `database-issues/supabase-graceful-column-fallback-20260206.md` — nullable kolonne med app-layer fallback
- `feature-implementations/explorer-ux-quality-overhaul-20260206.md` — NULL DEFAULT NULL pattern for nye kolonner
- `feature-implementations/project-poi-map-sidebar-20260204.md` — admin map+sidebar mønster
- `data-import/wfs-data-import-pattern-20260204.md` — import API patterns
