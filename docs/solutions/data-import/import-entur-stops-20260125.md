---
title: Import Bus and Tram Stops from Entur API
date: 2026-01-25
problem_type: data_import
category: data-import
module: POI Admin
severity: low
tags:
  - poi
  - entur
  - atb
  - bus
  - tram
  - kollektivtransport
  - graphql
  - supabase
  - batch-import
symptoms:
  - Need to import public transit stops into POI system
  - Want official data source for Norwegian transit stops
  - Need bus/tram stops for a specific municipality
---

# Import Bus and Tram Stops from Entur API

## Problem

Import all bus stops (ATB) and tram stops (Gråkallbanen) in Trondheim municipality into Placy's POI system.

## Solution

Use Entur's National Stop Register (NSR) GraphQL API to fetch all stop places filtered by municipality and transport type.

### API Details

- **Endpoint:** `https://api.entur.io/stop-places/v1/graphql`
- **Auth:** None required (open API)
- **Rate limits:** Be respectful, use `ET-Client-Name` header
- **Documentation:** https://developer.entur.org/pages-nsr-nsr/

### Municipality Codes

Norwegian municipalities use `KVE:TopographicPlace:{code}` format:

| Kommune | Kode |
|---------|------|
| Trondheim | 5001 |
| Oslo | 0301 |
| Bergen | 4601 |
| Stavanger | 1103 |

### Stop Place Types

Available `stopPlaceType` values:

| Type | Description |
|------|-------------|
| `onstreetBus` | Regular bus stops |
| `onstreetTram` | Tram stops |
| `railStation` | Train stations |
| `metroStation` | Metro/T-bane |
| `ferryStop` | Ferry terminals |
| `busStation` | Bus terminals |

### GraphQL Query

```graphql
query GetStops {
  stopPlace(
    size: 2000
    stopPlaceType: onstreetBus
    municipalityReference: "KVE:TopographicPlace:5001"
  ) {
    id
    name { value }
    geometry { coordinates }
  }
}
```

### Response Format

```json
{
  "data": {
    "stopPlace": [
      {
        "id": "NSR:StopPlace:41586",
        "name": { "value": "Pirbadet" },
        "geometry": { "coordinates": [10.402681, 63.440787] }
      }
    ]
  }
}
```

**Note:** Coordinates are in GeoJSON format `[longitude, latitude]`, not `[lat, lng]`.

### Implementation

See `scripts/import-atb-stops.ts` for full implementation.

Key points:
1. Fetch stops per type (bus, tram)
2. Handle duplicate names by appending Entur ID suffix
3. Store `entur_stopplace_id` for future real-time integration
4. Batch upsert in chunks of 500

### Usage

```bash
npm run import:atb
```

## Results

- 651 bus stops imported
- 20 tram stops imported (Gråkallbanen)
- Total: 671 POIs

## Gotchas

1. **GeoJSON coordinates are [lng, lat]** - not [lat, lng] like Google
2. **Duplicate names exist** - e.g., multiple "Sentrum" stops; handle with unique ID suffixes
3. **API returns all of Norway by default** - always filter by `municipalityReference`
4. **No pagination needed** - use `size: 2000` to get all stops in one request
5. **GraphQL field names differ from REST** - use `geometry.coordinates`, not `centroid.location`

## Related

- Existing Entur integration in `lib/generators/poi-discovery.ts` uses Journey Planner API for nearby stops
- NSR GraphQL API is better for bulk imports by municipality
