---
status: complete
priority: p2
issue_id: "004"
tags: [code-review, performance, queries]
dependencies: []
---

# Add Bounding Box Pre-filter for POI Radius Query

## Problem Statement

`getPOIsWithinRadius()` laster ALLE POI-er fra databasen til minne, deretter filtrerer med Haversine i JavaScript. Ved 100,000 POI-er brukes ~400MB minne og responstiden blir uakseptabel.

**Serverless limit:** Vercel har 1GB minnegrense. Ved 250,000 POI-er vil funksjonen krasje med OOM.

## Findings

**Performance Oracle Agent:**
> "At 100,000 POIs: ~400MB memory, problematic for serverless. At 1,000,000 POIs: ~4GB memory, will cause OOM crashes."

**Architecture Strategist Agent:**
> "Plan suggests loading all POIs for radius filter. For a large database, this is extremely inefficient."

**Kode (`lib/supabase/queries.ts:151-222`):**
```typescript
// Henter ALLE POI-er
let query = client.from("pois").select(`*, categories (*)`);
const { data: pois } = await query;

// Filtrerer i JavaScript - O(n) for ALLE POI-er
const filtered = pois.filter((poi) => {
  const distance = calculateDistance(center.lat, center.lng, poi.lat, poi.lng);
  return distance <= radiusMeters;
});
```

## Proposed Solutions

### Option A: Bounding Box Pre-filter (Recommended)
**Effort:** Small | **Risk:** Low

Legg til WHERE-clause som filtrerer på lat/lng bounding box FØR data sendes til klienten:

```typescript
export async function getPOIsWithinRadius(
  center: { lat: number; lng: number },
  radiusMeters: number,
  categoryIds?: string[]
): Promise<{ poi: DbPoi; category: DbCategory | null }[]> {
  const client = createServerClient();

  // Beregn bounding box (1 grad lat ≈ 111km)
  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos(center.lat * Math.PI / 180));

  let query = client
    .from("pois")
    .select(`*, categories (*)`)
    // Bounding box filter - reduserer data ~99%
    .gte('lat', center.lat - latDelta)
    .lte('lat', center.lat + latDelta)
    .gte('lng', center.lng - lngDelta)
    .lte('lng', center.lng + lngDelta);

  if (categoryIds?.length) {
    query = query.in("category_id", categoryIds);
  }

  const { data: pois, error } = await query;

  // Presis Haversine-filter på redusert datasett
  return (pois || []).filter(poi =>
    calculateDistance(center.lat, center.lng, poi.lat, poi.lng) <= radiusMeters
  );
}
```

**Pros:** 99% reduksjon i data transferert, minimal kodeendring
**Cons:** Bounding box er rektangulær, Haversine fortsatt nødvendig for presis sirkel

### Option B: PostGIS Extension
**Effort:** High | **Risk:** Medium

Installer PostGIS og bruk `ST_DWithin`:
```sql
SELECT * FROM pois
WHERE ST_DWithin(
  ST_MakePoint(lng, lat)::geography,
  ST_MakePoint($center_lng, $center_lat)::geography,
  $radius_meters
);
```

**Pros:** Mest effektivt, eksakt sirkel-filter i database
**Cons:** Krever Supabase extension, migration, spatial indexes

## Recommended Action

<!-- Fylles ut under triage -->

## Technical Details

**Affected files:**
- `lib/supabase/queries.ts:151-222`

**Database indexes needed:**
```sql
CREATE INDEX idx_pois_lat ON pois (lat);
CREATE INDEX idx_pois_lng ON pois (lng);
CREATE INDEX idx_pois_lat_lng ON pois (lat, lng);
```

**Scalability impact:**
| POIs | Current | With Bounding Box |
|------|---------|-------------------|
| 1,000 | 4MB, 200ms | 40KB, 50ms |
| 10,000 | 40MB, 1s | 400KB, 100ms |
| 100,000 | 400MB, 10s | 4MB, 200ms |

## Acceptance Criteria

- [ ] getPOIsWithinRadius bruker database-filter for bounding box
- [ ] Responstid <500ms for 1000m radius ved 100,000 POI-er
- [ ] Minnebruk <50MB for typiske queries
- [ ] Database indexes opprettet

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-25 | Created | Identifisert under plan review |

## Resources

- Haversine formel: https://en.wikipedia.org/wiki/Haversine_formula
- Supabase filters: https://supabase.com/docs/reference/javascript/gte
