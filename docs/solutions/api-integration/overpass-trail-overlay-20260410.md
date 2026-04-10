---
title: Overpass API Trail Overlay — Mapbox GL polyline-lag
date: 2026-04-10
category: api-integration
tags: [overpass, osm, mapbox, trails, geojson, react-map-gl]
module: report, map
symptoms:
  - vil vise sykkelruter/turstier på kart
  - trenger OSM route relations som GeoJSON
  - polyline-overlay med fargekoding
---

# Overpass API Trail Overlay — Mapbox GL polyline-lag

## Kontekst

Natur & Friluftsliv-seksjonen i Report-produktet trenger å vise named bicycle/hiking/foot routes
fra OpenStreetMap som polylines på kartet. Overpass API gir route relations med full geometri.

## Arkitektur

```
Overpass API (OSM route relations)
  → fetchTrails() [lib/generators/trail-fetcher.ts]
  → TrailCollection (GeoJSON FeatureCollection)
  → products.config.reportConfig.trails (Supabase JSONB)
  → ReportThemeSection → ReportThemeMap → TrailLayer
```

Data seedes manuelt via `scripts/seed-trails-to-project.ts`. Kan også genereres automatisk
i pipeline via `scripts/generate-story.ts` (step 2.5).

## Overpass Query

```
[out:json][timeout:30];
(
  relation["route"="bicycle"](around:3000,63.422,10.451);
  relation["route"="hiking"](around:3000,63.422,10.451);
  relation["route"="foot"](around:3000,63.422,10.451);
);
out geom;
```

**`out geom`** er kritisk — gir geometri per member-way inline. Uten dette får du bare relations-metadata.

## Fallback-endepunkter

```typescript
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",      // Primær (rate-limit issues)
  "https://overpass.kumi.systems/api/interpreter", // Fallback
];
```

Retry på 429, fallback til neste endpoint på 5xx/network error. 35s timeout per request.

## GeoJSON-konvertering

Overpass leverer `{lat, lon}` — GeoJSON krever `[lon, lat]` (X,Y-ordre!):

```typescript
function toGeoJSONCoord(point: OverpassGeometryPoint): [number, number] {
  return [point.lon, point.lat]; // lon first — GeoJSON standard
}
```

Single way → `LineString`. Multiple ways → `MultiLineString` (gaps mellom veisegmenter er OK).

## TrailLayer — Mapbox GL Source + Layers

```tsx
<Source id="trails" type="geojson" data={trails}>
  {/* Polylines */}
  <Layer
    id="trail-lines"
    type="line"
    paint={{
      "line-color": ["match", ["get", "routeType"],
        "bicycle", "#22C55E",   // green
        "#D97706"               // amber (hiking/foot)
      ],
      "line-width": ["match", ["get", "routeType"], "bicycle", 3, 2],
      "line-opacity": activated ? 0.8 : 0.3,
      "line-opacity-transition": { duration: 300, delay: 0 },
    }}
    layout={{ "line-join": "round", "line-cap": "round" }}
  />
  {/* Labels */}
  <Layer
    id="trail-labels"
    type="symbol"
    layout={{
      "symbol-placement": "line-center",
      "text-field": ["get", "name"],
      "text-size": 11,
    }}
    paint={{ "text-opacity": activated ? 1 : 0 }}
  />
</Source>
```

## Kritisk gotcha — mapLoaded gate

TrailLayer MÅ renderes etter at kart-stilen er lastet. Prøver du å legge til en Source
mens stilen ikke er ferdig, krasjer Mapbox med "Style is not done loading":

```tsx
// I ReportThemeMap:
const [mapLoaded, setMapLoaded] = useState(false);

const handleMapLoad = useCallback(() => {
  setMapLoaded(true);  // ← setter denne i onLoad callback
  // ...
}, []);

// Render TrailLayer KUN etter mapLoaded:
{mapLoaded && trails && trails.features.length > 0 && (
  <TrailLayer trails={trails} activated={activated} />
)}
```

## Data-seeding

```bash
# Hent ekte Overpass-data (stdout = JSON, stderr = progress)
npx tsx scripts/seed-trails.ts 63.422074 10.450617 3 > /tmp/trails.json

# Seed til Supabase
npx tsx scripts/seed-trails-to-project.ts <project-slug> /tmp/trails.json
```

Lagres i `products.config.reportConfig.trails` (JSONB). Koste: ~100KB per prosjekt for 3km radius.

## TypeScript-typer

```typescript
// lib/types.ts
export interface TrailFeatureProperties {
  id: string;        // String(element.id) — OSM relation ID
  name: string;
  routeType: "bicycle" | "hiking" | "foot";
  network: "lcn" | "rcn" | "ncn" | null;
}
export type TrailFeature = GeoJSON.Feature<
  GeoJSON.LineString | GeoJSON.MultiLineString,
  TrailFeatureProperties
>;
export type TrailCollection = GeoJSON.FeatureCollection<
  GeoJSON.LineString | GeoJSON.MultiLineString,
  TrailFeatureProperties
>;
```

`id` MÅ være string (canonical type). Konverter med `String(element.id)` fra Overpass sin number.

## Kjente begrensninger

- Overpass API er tidvis overbelastet (504/503). Begge kjente endpoints gikk ned 2026-04-10.
  Løsning: seed data manuelt når servere er oppe, cache i Supabase (ingen runtime Overpass-kall).
- `out geom` kan gi store responses for tette byområder — test med 3km radius, reduser ved behov.
- Named routes only — `tags.name` er påkrevd. Mange lokale stier i OSM mangler navn.
