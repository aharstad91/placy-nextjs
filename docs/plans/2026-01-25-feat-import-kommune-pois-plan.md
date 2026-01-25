---
title: Import POIs from Trondheim Kommune WFS
type: feat
date: 2026-01-25
status: completed
---

# Import POIs from Trondheim Kommune WFS

## Overview

Import POI data from Trondheim kommune's GeoServer WFS services for 4 categories:
- Badeplasser (26 locations)
- Hundeparker (2 locations)
- Lekeplasser (116 locations)
- Parker (83 locations)

Total: ~227 POIs

## Data Sources

| Category | WFS Layer | Count | Geometry Type |
|----------|-----------|-------|---------------|
| Badeplasser | `friluftsliv:badeplass` | 26 | Polygon |
| Hundeparker | `kommunalteknikk:hundeparker` | 2 | Polygon |
| Lekeplasser | `anleggsregister:lekeplasser` | 116 | **MultiPolygon** |
| Parker | `anleggsregister:parker` | 83 | **MultiPolygon** |

**Base URL:** `https://kart.trondheim.kommune.no/geoserver/{workspace}/wfs`

**Coordinate System:** Request WGS84 directly via `srsName=EPSG:4326` parameter (no conversion needed).

## Technical Approach

### 1. Create Import Script

`scripts/import-kommune-pois.ts`

```typescript
// Structure
1. Define WFS endpoints and category mappings
2. Fetch GeoJSON from each WFS endpoint (with srsName=EPSG:4326)
3. For each feature:
   - Validate required fields (name, geometry)
   - Calculate centroid (handle both Polygon and MultiPolygon)
   - Check for ID collisions
4. Upsert categories to Supabase
5. Upsert POIs to Supabase (exclude editorial fields)
```

### 2. WFS Request (No Coordinate Conversion Needed)

Request WGS84 coordinates directly from the WFS service:

```typescript
function buildWfsUrl(workspace: string, layer: string): string {
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName: `${workspace}:${layer}`,
    outputFormat: "application/json",
    srsName: "EPSG:4326",  // Request WGS84 directly - no proj4 needed!
  });
  return `https://kart.trondheim.kommune.no/geoserver/${workspace}/wfs?${params}`;
}
```

### 3. Centroid Calculation (Handles MultiPolygon)

```typescript
interface Geometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

function calculateCentroid(geometry: Geometry): { lat: number; lng: number } {
  // Get the outer ring of the first polygon
  let ring: number[][];

  if (geometry.type === "MultiPolygon") {
    // MultiPolygon: coordinates[polygon][ring][point]
    const coords = geometry.coordinates as number[][][][];
    if (!coords[0]?.[0]) throw new Error("Empty MultiPolygon");
    ring = coords[0][0];
  } else {
    // Polygon: coordinates[ring][point]
    const coords = geometry.coordinates as number[][][];
    if (!coords[0]) throw new Error("Empty Polygon");
    ring = coords[0];
  }

  // Simple centroid: average of all points
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }

  return {
    lng: sumLng / ring.length,
    lat: sumLat / ring.length,
  };
}
```

### 4. Input Validation

```typescript
// Trondheim approximate bounds
const TRONDHEIM_BOUNDS = {
  minLat: 63.2, maxLat: 63.5,
  minLng: 10.1, maxLng: 10.6,
};

function validatePoi(name: string, lat: number, lng: number): string | null {
  if (!name || name.trim() === "") return "Missing name";
  if (!isFinite(lat) || lat < TRONDHEIM_BOUNDS.minLat || lat > TRONDHEIM_BOUNDS.maxLat) {
    return `Invalid latitude: ${lat}`;
  }
  if (!isFinite(lng) || lng < TRONDHEIM_BOUNDS.minLng || lng > TRONDHEIM_BOUNDS.maxLng) {
    return `Invalid longitude: ${lng}`;
  }
  return null; // Valid
}
```

### 5. ID Generation with Collision Detection

```typescript
// Reuse existing slugify from lib/generators/poi-discovery.ts
import { slugify } from "../lib/generators/poi-discovery";

function generatePoiId(category: string, name: string, seenIds: Set<string>): string {
  const baseId = `${category}-${slugify(name)}`;

  if (!seenIds.has(baseId)) {
    seenIds.add(baseId);
    return baseId;
  }

  // Handle collision by appending counter
  let counter = 2;
  while (seenIds.has(`${baseId}-${counter}`)) {
    counter++;
  }
  const uniqueId = `${baseId}-${counter}`;
  seenIds.add(uniqueId);
  console.warn(`ID collision detected: "${name}" -> ${uniqueId}`);
  return uniqueId;
}
```

### 6. Selective Upsert (Preserve Editorial Content)

**CRITICAL:** Only update factual fields, preserve manually-added editorial content:

```typescript
const pois = features.map((f) => ({
  id: generatePoiId(category.id, f.properties.navn, seenIds),
  name: f.properties.navn,
  lat: centroid.lat,
  lng: centroid.lng,
  category_id: category.id,
  // Do NOT include: description, editorial_hook, local_insight
  // These may have been manually curated
}));

// Use raw SQL for selective update
const { error } = await supabase.rpc("upsert_kommune_pois", { pois_json: pois });
```

Or use standard upsert but check for existing editorial content:

```typescript
// Alternative: Check if POI exists before deciding update strategy
const { data: existing } = await supabase
  .from("pois")
  .select("id, editorial_hook")
  .in("id", poiIds);

const existingWithEditorial = new Set(
  existing?.filter(p => p.editorial_hook).map(p => p.id) || []
);

// Only update coordinates for POIs with editorial content
// Full upsert for new POIs
```

### 7. Category Definitions

| ID | Name | Icon | Color |
|----|------|------|-------|
| `badeplass` | Badeplass | `Waves` | `#0ea5e9` |
| `hundepark` | Hundepark | `Dog` | `#a855f7` |
| `lekeplass` | Lekeplass | `Baby` | `#22c55e` |
| `park` | Park | `Trees` | `#16a34a` |

### 8. Fetch with Timeout

```typescript
async function fetchWithTimeout(url: string, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}
```

## Implementation Steps

### Step 1: Export slugify function

Make `slugify` exportable from `lib/generators/poi-discovery.ts` (currently private).

### Step 2: Create Import Script

Create `scripts/import-kommune-pois.ts` with:
- WFS fetch with timeout
- Geometry handling (Polygon + MultiPolygon)
- Input validation
- ID collision detection
- Selective upsert (preserve editorial)

### Step 3: Add npm Script

```json
{
  "scripts": {
    "import:kommune": "tsx scripts/import-kommune-pois.ts"
  }
}
```

### Step 4: Run Import

```bash
npm run import:kommune
```

## Acceptance Criteria

- [x] 4 new categories created in Supabase
- [x] ~227 POIs imported with correct coordinates
- [x] POIs visible at `/admin/pois`
- [x] Each category filterable via `?categories=badeplass` etc.
- [x] No duplicates on re-run (upsert by ID)
- [x] Coordinates within Trondheim bounds (63.2-63.5°N, 10.1-10.6°E)
- [x] **ID collisions logged and handled** (1 collision: Kyvatnet badeplass)
- [x] **Existing editorial content preserved on re-import**
- [x] **MultiPolygon geometries handled correctly**

## Data Mapping

All categories use the same mapping:

| WFS Field | POI Field | Notes |
|-----------|-----------|-------|
| `navn` | `name` | Required |
| centroid | `lat`, `lng` | Calculated from geometry |
| - | `category_id` | Set per category |
| `beskrivelse` | - | **NOT imported** (write editorial manually) |

## Review Findings Addressed

| Finding | Severity | Resolution |
|---------|----------|------------|
| proj4 unnecessary | P2 | Use `srsName=EPSG:4326` - no dependency needed |
| MultiPolygon not handled | P1 | Added geometry type check |
| Re-import overwrites editorial | P1 | Selective upsert, exclude editorial fields |
| No input validation | P2 | Added coordinate/name validation |
| ID collision risk | P2 | Added collision detection with counter |
| Duplicated slugify | P2 | Reuse from poi-discovery.ts |
| Missing request timeout | P2 | Added 30s timeout |

## References

- [POI Data Sourcing Guide](../guides/poi-data-sourcing.md)
- [Taxi Import Script](../../scripts/import-taxi-stands.ts)
- [Trondheim Kommune GeoServer](https://kart.trondheim.kommune.no/geoserver/)
