# Plan: Trail & Sykkelrute Overlay i Report

**Brainstorm:** `docs/brainstorms/2026-04-10-trail-overlay-brainstorm.md`
**Branch:** `feat/trail-overlay`
**Status:** Plan

## Mål

Vis sykkelruter, turstier og pilegrimsruter som fargekodede polylines (GeoJSON) på ReportThemeMap i Natur & Friluftsliv-seksjonen. Data fra Overpass API (OSM route relations).

## Akseptansekriterier

1. Natur & Friluftsliv-kartet viser navngitte sykkel- og turrutelinjer med riktig fargekoding
2. Rutene er synlige i dormant preview OG i aktivert modal
3. Rutenavn vises som hover-tooltip og som labels langs linjen i aktivert modus
4. Trail-data hentes server-side via `/api/trails` og caches i prosjekt-JSON
5. Generate-bolig pipeline henter trails automatisk som del av dataproduksjonen
6. Fungerer for Brøset-demoen (Trondheim) — verifiseres visuelt

## Arkitektur

```
                    ┌─────────────────┐
                    │  Overpass API    │
                    │  (OSM route      │
                    │   relations)     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  /api/trails     │ ← Next.js API route
                    │  GET ?lat&lng    │    Returnerer GeoJSON
                    │  &radiusKm      │    FeatureCollection
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │                              │
     ┌────────▼────────┐          ┌─────────▼─────────┐
     │ generate-story   │          │  ReportPage        │
     │ (pipeline steg)  │          │  (runtime fetch)   │
     │ → lagrer i       │          │  → trails prop     │
     │   project.json   │          │  → ReportTheme-    │
     └─────────────────┘          │    Section          │
                                   └─────────┬─────────┘
                                             │
                                   ┌─────────▼─────────┐
                                   │ ReportThemeMap     │
                                   │ + TrailLayer       │
                                   │ (polylines)        │
                                   └───────────────────┘
```

## Implementeringssteg

### Steg 1: API-route `/api/trails` → TC-01, TC-02, TC-03, TC-04

Ny fil: `app/api/trails/route.ts`

**Input (GET query params):**
- `lat`, `lng` — sentrum
- `radiusKm` — søkeradius (default 3)
- `types` — kommaseparert: `bicycle,hiking,foot` (default alle)

**Overpass-query:**
```
[out:json][timeout:30];
(
  relation["route"="bicycle"](around:{radius},{lat},{lng});
  relation["route"="hiking"](around:{radius},{lat},{lng});
  relation["route"="foot"](around:{radius},{lat},{lng});
);
out geom;
```

**Output:** GeoJSON FeatureCollection:
```typescript
{
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: {
      id: string,         // OSM relation ID
      name: string,       // Rutenavn
      routeType: "bicycle" | "hiking" | "foot",
      network: "lcn" | "rcn" | "ncn" | null,
    },
    geometry: {
      type: "LineString",  // eller MultiLineString for multi-way ruter
      coordinates: [number, number][]
    }
  }]
}
```

**Overpass-detaljer (fra research):**
- `out geom` er optimalt — gir coordinates inline på way members, ingen recursion nødvendig
- `around:3000,lat,lng` — meters, lat-first (ikke GeoJSON-rekkefølge)
- Send som POST med `Content-Type: application/x-www-form-urlencoded`, body: `data=<query>`
- **User-Agent header:** `Placy/1.0 (kontakt@placy.no)` — påkrevd av OSM policy
- **AbortController:** 35s client-side timeout (litt over server-timeout)
- **Rate limiting:** Max 2 samtidige requests. 429 → retry etter 5s, én gang
- **Cache:** `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` (24h fresh, 7d stale)

**Konverteringslogikk (`lib/generators/trail-fetcher.ts`):**
- `out geom` gir members med `geometry: [{lat, lon}]` — konverter til `[lon, lat]` (GeoJSON-rekkefølge)
- Samle way-members per relation → `MultiLineString` (alltid, for gaps)
- Dedup på relation ID med `Set<number>`
- Skip relations uten ways eller geometri
- Skip unnamed routes (krev `tags.name`)
- ~30 linjer, ingen `osmtogeojson` dependency

```typescript
function overpassToGeoJSON(elements: OverpassElement[]): TrailCollection {
  const features: TrailFeature[] = [];
  const seen = new Set<number>();
  for (const el of elements) {
    if (el.type !== "relation" || seen.has(el.id)) continue;
    seen.add(el.id);
    const lines: [number, number][][] = [];
    for (const m of el.members) {
      if (m.type === "way" && m.geometry?.length) {
        lines.push(m.geometry.map(p => [p.lon, p.lat]));
      }
    }
    if (!lines.length || !el.tags?.name) continue;
    features.push({
      type: "Feature",
      properties: {
        id: String(el.id),
        name: el.tags.name,
        routeType: el.tags.route as "bicycle" | "hiking" | "foot",
        network: (el.tags.network as "lcn" | "rcn" | "ncn") ?? null,
      },
      geometry: lines.length === 1
        ? { type: "LineString", coordinates: lines[0] }
        : { type: "MultiLineString", coordinates: lines },
    });
  }
  return { type: "FeatureCollection", features };
}
```

### Steg 2: TypeScript-typer for trails → TC-05

Utvid `lib/types.ts`:

```typescript
export interface TrailFeature {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    routeType: "bicycle" | "hiking" | "foot";
    network: "lcn" | "rcn" | "ncn" | null;
  };
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
}

export interface TrailCollection {
  type: "FeatureCollection";
  features: TrailFeature[];
}
```

Utvid `ReportConfig`:
```typescript
export interface ReportConfig {
  // ... eksisterende felter
  trails?: TrailCollection;  // Pre-fetched trail data
}
```

### Steg 3: `TrailLayer.tsx` komponent → TC-06, TC-07, TC-08

Ny fil: `components/map/trail-layer.tsx`

Bygger på mønsteret fra `route-layer.tsx` (Source + Layer fra react-map-gl), men enklere:

**Struktur:** Én `<Source>` med to `<Layer>`:
1. **`trail-lines`** (type: `line`) — polylines med `match`-basert fargekoding
2. **`trail-labels`** (type: `symbol`) — rutenavn langs linjen, kun i activated modus

**Fargekoding via `match` expression (ikke `case` som route-layer):**
```tsx
paint={{
  "line-color": [
    "match", ["get", "routeType"],
    "bicycle", "#22C55E",
    "hiking", "#D97706",
    "foot", "#D97706",
    "#888888"  // fallback (påkrevd)
  ],
  "line-width": [
    "match", ["get", "routeType"],
    "bicycle", 3,
    "hiking", 2.5,
    "foot", 2.5,
    2  // fallback
  ],
  "line-opacity": activated ? 0.8 : 0.3,
  "line-opacity-transition": { duration: 300, delay: 0 },
}}
```

**Labels med `symbol-placement: "line-center"`:**
```tsx
<Layer
  id="trail-labels"
  type="symbol"
  layout={{
    "symbol-placement": "line-center",
    "text-field": ["get", "name"],
    "text-size": 12,
    "text-font": ["Open Sans Semibold"],
    "text-offset": [0, -0.8],
    "text-max-angle": 30,
  }}
  paint={{
    "text-color": "#1a1a1a",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
    "text-opacity": activated ? 1 : 0,
    "text-opacity-transition": { duration: 300, delay: 0 },
  }}
/>
```

**Ingen glow/casing-lag** — enklere visuelt uttrykk som bakgrunnslinjer.
**MultiLineString:** Mapbox GL håndterer nativt — ingen flattening.
**DOM Markers (POI-er):** Rendres alltid OVER GL layers — ingen `beforeId` nødvendig.
**Memoize:** GeoJSON og paint-objects med `useMemo` for å unngå unødvendige re-renders.

**Komponentens props:**
```typescript
interface TrailLayerProps {
  trails: TrailCollection;
  activated?: boolean;  // dimmet i dormant, fullt synlig i modal
}
```

### Steg 4: Integrasjon i ReportThemeMap → TC-09, TC-10

Utvid `ReportThemeMap`:
- Ny prop: `trails?: TrailCollection`
- Render `<TrailLayer>` inni `<Map>`, FØR POI-markører (under i z-rekkefølge)
- Trails vises i BÅDE dormant og activated modus (bare dimmet i dormant)
- fitBounds: utvid bounding box til å inkludere trail-geometri (ikke bare POI-er)

### Steg 5: Data-flow fra ReportThemeSection → TC-11

Utvid `ReportTheme` interface i `report-data.ts`:
```typescript
export interface ReportTheme {
  // ... eksisterende felter
  trails?: TrailCollection;
}
```

Utvid `transformToReportData()` i for-loopen (~linje 420, etter `themes.push({...})`):
```typescript
// Inside the for loop, when building the theme object:
trails: themeDef.id === "natur-friluftsliv"
  ? project.reportConfig?.trails
  : undefined,
```
- Kun `natur-friluftsliv` temaet får trails — ikke transport, mat, etc.
- **NB:** Næring-profilen har `nabolaget` i stedet for `natur-friluftsliv` — trails vises IKKE for næringsprosjekter (riktig atferd)

Utvid `ReportThemeSection`:
- Pass `theme.trails` videre til ReportThemeMap som prop
- Gjelder for BEGGE ReportThemeMap-instanser (dormant + modal)

### Steg 6: Pipeline-integrasjon (`generate-story.ts`) → TC-12, TC-13

Nytt steg i generate-story.ts etter travel-times (steg 2), før story-structure (steg 3):

```
Step 2.5: Fetch trails from Overpass API
```

- Kall trail-fetcher direkte (ikke via Next.js API route — pipeline kjøres utenfor server)
- **NB:** `newProject` i generate-story.ts har ingen `reportConfig`. Initialiser den:
  ```typescript
  const newProject: Project = {
    ...eksisterende felter,
    reportConfig: trailData ? { trails: trailData } : undefined,
  };
  ```
- `mergeProjectData()` må bevare `reportConfig.trails` ved merge — verifiser at den merger JSONB-felter korrekt
- Legg til `--skip-trails` flag for å hoppe over (som `--skip-travel-times`)

**Felles logikk:**
- `lib/generators/trail-fetcher.ts` — delt mellom API-route og pipeline
- Håndterer Overpass-query, geometri-konvertering, dedup

### Steg 7: Manuell test og visuell verifisering → TC-14

- Oppdater Brøset prosjekt-JSON med trail-data (via pipeline eller manuell API-kall)
- Start dev-server, naviger til Report
- Verifiser at Natur & Friluftsliv-kartet viser trails i dormant og modal
- Sjekk at Jonsvannsruta, Moholtruta etc. er synlige med riktig fargekoding

## Test Cases

### Funksjonelle
```
TC-01 | Functional | P1
Requirement: API returnerer GeoJSON fra Overpass
Given: Brøset-koordinater (63.42, 10.39) med 3km radius
When: GET /api/trails?lat=63.42&lng=10.39&radiusKm=3
Then: Returnerer FeatureCollection med >0 features, alle med name og routeType

TC-02 | Functional | P1
Requirement: API filtrerer på rutetype
Given: types=bicycle parameter
When: GET /api/trails?lat=63.42&lng=10.39&radiusKm=3&types=bicycle
Then: Kun features med routeType="bicycle" i respons

TC-03 | Error | P1
Requirement: API håndterer Overpass-feil
Given: Overpass API er nede eller timeout
When: GET /api/trails
Then: Returnerer 502 med forklarende feilmelding, ikke crash

TC-04 | Functional | P2
Requirement: API deduper route relations
Given: Route som krysser bbox på flere punkter
When: Parsing av Overpass-respons
Then: Kun én feature per relation ID

TC-05 | Functional | P1
Requirement: TypeScript-typer kompilerer
Given: Nye typer i types.ts og report-data.ts
When: npx tsc --noEmit
Then: Ingen typefeil
```

### Rendering
```
TC-06 | Functional | P1
Requirement: TrailLayer rendrer polylines
Given: TrailCollection med 3 features (1 bicycle, 2 hiking)
When: TrailLayer mountes i ReportThemeMap
Then: 3 synlige polylines med korrekte farger (grønn for bike, oransje for hike)

TC-07 | Functional | P2
Requirement: Trail labels vises langs linjen
Given: Trail med name="Jonsvannsruta"
When: Kartet er i activated modus
Then: Rutenavnet vises som text label langs linjen

TC-08 | Functional | P1
Requirement: Trails dimmes i dormant modus
Given: ReportThemeMap med activated=false
When: Map rendres med trails
Then: Trails synlige men med redusert opacity (0.3)
```

### Integrasjon
```
TC-09 | Functional | P1
Requirement: Trails vises i Natur & Friluftsliv-kart
Given: Project med trails i reportConfig
When: Report lastes
Then: Natur & Friluftsliv-seksjonens kart viser trail-polylines

TC-10 | Functional | P1
Requirement: Trails vises IKKE i andre temaers kart
Given: Project med trails
When: Mat & Drikke-seksjonens kart åpnes
Then: Ingen trail-polylines synlige

TC-11 | Functional | P1
Requirement: Data flyter fra reportConfig til kart-komponent
Given: project.reportConfig.trails med data
When: transformToReportData() kjøres
Then: Natur-friluftsliv theme har trails-felt, andre temaer har det ikke

TC-12 | Functional | P1
Requirement: Pipeline henter trails
Given: generate-story kjøres med Brøset-input
When: Steg 2.5 kjøres
Then: Output project.json inneholder reportConfig.trails med FeatureCollection

TC-13 | Functional | P2
Requirement: --skip-trails flag fungerer
Given: generate-story kjøres med --skip-trails
When: Pipeline kjøres
Then: reportConfig.trails er undefined, ingen Overpass-kall
```

### Visuell
```
TC-14 | Visual | P1
Requirement: Brøset-demo viser kjente ruter
Given: Brøset prosjekt med trails
When: Report åpnes i browser
Then: Jonsvannsruta (grønn), Hjerterunden (oransje) synlige i Natur & Friluftsliv-kart
```

## Rekkefølge og avhengigheter

```
[Steg 2: Typer] ─────────────────────────────────┐
                                                    ▼
[Steg 1: API-route] ──┬──> [Steg 6: Pipeline]    [Steg 3: TrailLayer]
                       │                            │
                       └──> [Steg 4: Map-integrasjon] ◄──┘
                                  │
                            [Steg 5: Data-flow]
                                  │
                            [Steg 7: Test]
```

Paralleliserbart:
- Steg 1 (API) + Steg 2 (Typer) + Steg 3 (TrailLayer) kan kjøres parallelt
- Steg 4 (Map-integrasjon) avhenger av Steg 2 + 3
- Steg 5 (Data-flow) avhenger av Steg 2 + 4
- Steg 6 (Pipeline) avhenger av Steg 1 + 2
- Steg 7 (Test) avhenger av alt

## Risiko

| Risiko | Sannsynlighet | Mitigering |
|--------|---------------|------------|
| Overpass timeout for store radier | Medium | 30s timeout, 3km default radius, cache i prosjekt-JSON |
| MultiLineString gaps i ruter | Lav | Støtt MultiLineString i TrailLayer, Mapbox håndterer det nativt |
| For mange ruter → uoversiktlig kart | Lav | Route relations er kuraterte, typisk 15-20 i 3km radius |
| Overpass rate limiting | Lav | Pipeline henter én gang, lagrer i JSON. Runtime aldri. |

## Ikke i scope

- Individuelle ways (bare route relations — kuraterte navngitte ruter)
- Skiløyper (fremtidig — `route=ski`)
- NVDB-data (supplerende, ikke MVP)
- Klikk-interaksjon på trails (ikke popup/drawer — bare visuell overlay)
- Høydeprofil eller distanse-visning per rute
