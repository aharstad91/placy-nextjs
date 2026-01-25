---
title: Import Geographic Data from WFS (Web Feature Service) API
date: 2026-01-25
problem_type: data_import
category: data-import
module: POI Admin
severity: low
tags:
  - poi
  - wfs
  - geoserver
  - geojson
  - supabase
  - batch-import
  - trondheim-kommune
  - geographic-data
  - polygon
  - multipolygon
  - centroid
  - nextjs-cache
  - verification
symptoms:
  - Need to import POI data from municipal map service
  - Data available via WFS (Web Feature Service) API
  - Geometries are polygons/multipolygons requiring centroid calculation
  - Multiple categories with different GeoServer workspaces
  - Import script reports success but data not visible in UI
  - New categories not appearing in admin filter
---

# Import Geographic Data from WFS (Web Feature Service) API

## Problem

Import POI data from Trondheim kommune's GeoServer WFS services for 4 categories:
- Badeplasser (26 locations)
- Hundeparker (2 locations)
- Lekeplasser (116 locations)
- Parker (83 locations)

Total: 227 POIs from polygon geometries requiring centroid calculation.

### Initial Challenge

The kommune's Trondheimskartet at `https://kart.trondheim.kommune.no/trondheimskartet/` displays map layers, but the data is served via WFS endpoints (not static files like KMZ).

## Investigation

### Step 1: Find WFS Endpoints

Analyzed the GeoServer WMS capabilities:

```bash
curl -s "https://kart.trondheim.kommune.no/geoserver/wms?request=GetCapabilities&service=WMS" \
  | grep -i "badeplass\|lekeplass\|hundepark\|park"
```

Found layer names:
| Category | WFS Layer |
|----------|-----------|
| Badeplasser | `friluftsliv:badeplass` |
| Hundeparker | `kommunalteknikk:hundeparker` |
| Lekeplasser | `anleggsregister:lekeplasser` |
| Parker | `anleggsregister:parker` |

### Step 2: Test WFS API

WFS returns GeoJSON when requested:

```bash
curl -s "https://kart.trondheim.kommune.no/geoserver/friluftsliv/wfs?\
service=WFS&version=1.1.0&request=GetFeature&\
typeName=friluftsliv:badeplass&outputFormat=application/json"
```

**Problem discovered:** Default coordinate system is EPSG:25832 (UTM zone 32N), not WGS84 (lat/lng).

### Step 3: Request WGS84 Directly

Added `srsName=EPSG:4326` parameter to request WGS84 coordinates directly from GeoServer:

```bash
curl -s "...&srsName=EPSG:4326"
```

This eliminated the need for proj4 coordinate conversion library.

### Step 4: Handle Geometry Types

Data analysis revealed mixed geometry types:

| Category | Geometry Type |
|----------|--------------|
| Badeplasser | Polygon |
| Hundeparker | Polygon |
| Lekeplasser | **MultiPolygon** |
| Parker | **MultiPolygon** |

Required handling both types in centroid calculation.

## Review Findings

Multi-agent review identified critical issues:

| Finding | Severity | Resolution |
|---------|----------|------------|
| proj4 unnecessary | P2 | Use `srsName=EPSG:4326` - no dependency needed |
| MultiPolygon not handled | P1 | Added geometry type check |
| Re-import overwrites editorial | P1 | Selective upsert, exclude editorial fields |
| No input validation | P2 | Added coordinate/name validation |
| ID collision risk | P2 | Added collision detection with counter |
| Missing request timeout | P2 | Added 30s timeout |

## Solution

### Script: `scripts/import-kommune-pois.ts`

Key components:

#### 1. WFS URL Builder (Request WGS84 Directly)

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

#### 2. Centroid Calculation (Handles Both Polygon Types)

```typescript
function calculateCentroid(geometry: Geometry): { lat: number; lng: number } {
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

#### 3. ID Collision Detection

```typescript
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

#### 4. Input Validation

```typescript
const TRONDHEIM_BOUNDS = {
  minLat: 63.2, maxLat: 63.5,
  minLng: 10.0, maxLng: 10.7,
};

function validatePoi(name: string, lat: number, lng: number): string | null {
  if (!name || name.trim() === "") return "Missing name";
  if (!isFinite(lat) || lat < TRONDHEIM_BOUNDS.minLat || lat > TRONDHEIM_BOUNDS.maxLat) {
    return `Invalid latitude: ${lat}`;
  }
  if (!isFinite(lng) || lng < TRONDHEIM_BOUNDS.minLng || lng > TRONDHEIM_BOUNDS.maxLng) {
    return `Invalid longitude: ${lng}`;
  }
  return null;
}
```

### Run Command

```bash
npm run import:kommune
```

### Output

```
🗺️  Importing POIs from Trondheim Kommune WFS...

📍 Badeplass
  ✓ Category ensured
  ✓ Fetched 26 features
  ✓ Imported 26 POIs

📍 Hundepark
  ✓ Category ensured
  ✓ Fetched 2 features
  ✓ Imported 2 POIs

📍 Lekeplass
  ✓ Category ensured
  ✓ Fetched 116 features
  ✓ Imported 116 POIs

📍 Park
  ✓ Category ensured
  ✓ Fetched 83 features
  ✓ Imported 83 POIs

==================================================
✅ Import complete!
   Total imported: 227 POIs
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Request WGS84 directly** | `srsName=EPSG:4326` eliminates proj4 dependency. GeoServer does the conversion. |
| **Simple centroid** | Average of polygon points. For parks/playgrounds, exact mathematical centroid is overkill. |
| **Handle MultiPolygon** | Use first polygon's outer ring. These are single-area features, just stored as MultiPolygon. |
| **Collision detection** | Same name in category gets counter suffix (e.g., `badeplass-kyvatnet-2`). |
| **Bounds validation** | Catches coordinate conversion errors before database insert. |
| **Selective upsert** | Only update `name`, `lat`, `lng`, `category_id`. Preserves editorial content. |
| **Timeout on fetch** | 30s timeout prevents hanging on slow/unresponsive GeoServer. |

## WFS vs KMZ: When to Use Each

| Approach | Use When |
|----------|----------|
| **WFS API** | Data is frequently updated. Large datasets. Need to filter server-side. |
| **KMZ/KML File** | Static snapshot. Small dataset (<100 records). No API available. |

## Prevention: WFS Import Checklist

### Discovery

- [ ] Find GeoServer URL (often `/geoserver/` path)
- [ ] Query WMS GetCapabilities for layer names
- [ ] Test WFS endpoint returns GeoJSON
- [ ] Check default coordinate system (request EPSG:4326 if needed)

### Data Analysis

- [ ] Identify geometry type (Point, Polygon, MultiPolygon)
- [ ] Check which properties contain the name field (`navn`, `name`, etc.)
- [ ] Verify coordinate bounds make sense for the area

### Implementation

- [ ] Handle both Polygon and MultiPolygon geometries
- [ ] Request WGS84 directly via `srsName=EPSG:4326`
- [ ] Add request timeout (30s recommended)
- [ ] Validate coordinates before insert
- [ ] Detect and handle ID collisions
- [ ] Use batch upsert (not loops)
- [ ] Preserve editorial content on re-import

## Related Files

- `scripts/import-kommune-pois.ts` - The WFS import script
- `scripts/import-taxi-stands.ts` - Similar pattern for KMZ data
- `lib/generators/poi-discovery.ts` - Shared `slugify` function
- `docs/plans/2026-01-25-feat-import-kommune-pois-plan.md` - Original plan with review findings
- `docs/guides/poi-data-sourcing.md` - Legal guidelines for using public data

## Verification

After running the import script, verify the data was correctly imported:

### Step 1: Query Database Directly

```typescript
// Quick verification script
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Check categories exist
const { data: cats } = await supabase
  .from('categories')
  .select('id, name')
  .in('id', ['badeplass', 'hundepark', 'lekeplass', 'park']);
console.log('Categories:', cats);

// Check POI count and sample coordinates
const { data: pois, count } = await supabase
  .from('pois')
  .select('id, name, lat, lng, category_id', { count: 'exact' })
  .in('category_id', ['badeplass', 'hundepark', 'lekeplass', 'park'])
  .limit(5);
console.log('POI count:', count);
console.log('Sample POIs:', pois);
```

**Expected output:**
- Categories: 4 entries (badeplass, hundepark, lekeplass, park)
- POI count: 227
- Sample coordinates: lat ~63.x, lng ~10.x (Trondheim area)

### Step 2: Verify in Admin UI

Navigate to `http://localhost:3000/admin/pois`

**Common issue: Next.js caching**

If new categories/POIs don't appear in the admin UI but exist in the database, the page is serving cached data.

**Solution:** Hard refresh the page:
- **Chrome/Edge:** Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- **Or:** Open DevTools → Network tab → Check "Disable cache" → Refresh

After hard refresh, verify:
- Total POI count increased (e.g., 161 → 388)
- New category buttons appear in filter sidebar
- Markers visible on map for new categories

### Step 3: Filter by Category

Test each category filter:
- `http://localhost:3000/admin/pois?categories=badeplass` → 26 POIs
- `http://localhost:3000/admin/pois?categories=hundepark` → 2 POIs
- `http://localhost:3000/admin/pois?categories=lekeplass` → 116 POIs
- `http://localhost:3000/admin/pois?categories=park` → 83 POIs

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Script says success but no POIs in UI | Next.js cache | Hard refresh (Cmd+Shift+R) |
| Categories missing from filter | Next.js cache | Hard refresh |
| POIs exist but wrong location | Coordinate system issue | Verify `srsName=EPSG:4326` in WFS request |
| Coordinates like 6300000, 500000 | UTM not converted | Add `srsName=EPSG:4326` parameter |
| "Invalid latitude" errors | Bounds too strict | Expand TRONDHEIM_BOUNDS in script |

## Result

227 POIs successfully imported across 4 categories:

| Category | Count | Example POI |
|----------|-------|-------------|
| Badeplass | 26 | Strandveikaia (63.44°N, 10.42°E) |
| Hundepark | 2 | - |
| Lekeplass | 116 | - |
| Park | 83 | - |

**Total POIs after import:** 388 (161 existing + 227 new)

Visible at:
- `http://localhost:3000/admin/pois?categories=badeplass`
- `http://localhost:3000/admin/pois?categories=hundepark`
- `http://localhost:3000/admin/pois?categories=lekeplass`
- `http://localhost:3000/admin/pois?categories=park`

Screenshot: `screenshots/admin-pois-kommune-imported.png`
