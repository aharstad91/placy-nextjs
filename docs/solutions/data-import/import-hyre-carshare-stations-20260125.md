---
title: Import Hyre Car-Sharing Stations from Entur Mobility API
date: 2026-01-25
problem_type: data_import
category: data-import
module: POI Admin
severity: low
tags:
  - entur
  - mobility-api
  - graphql
  - poi-import
  - carshare
  - hyre
  - realtime-data
symptoms:
  - Need to import Hyre bildelingspunkter into POI system
  - Data available via Entur Mobility v2 GraphQL API
  - Require station IDs for future realtime vehicle availability
---

# Import Hyre Car-Sharing Stations from Entur Mobility API

## Problem

Import Hyre bildelingspunkter (car-sharing stations) from Entur's Mobility API into Placy's POI database. Unlike the taxi stands import (static KMZ file), Hyre stations are fetched dynamically from a GraphQL API and include station IDs needed for future realtime availability queries.

## Investigation

### Finding the Data Source

Entur provides a unified Mobility API that aggregates vehicle sharing services in Norway:

- **Endpoint:** `https://api.entur.io/mobility/v2/graphql`
- **Documentation:** [Entur Mobility API v2](https://developer.entur.org/pages-mobility-docs-mobility-v2)
- **Authentication:** Client name header only (no API key required)

### Key Discovery: GraphQL Filtering

The Mobility v2 API supports filtering by:
- `availableFormFactors: [CAR]` - Only car-sharing, not bikes/scooters
- `systems: ["hyrenorge"]` - Only Hyre provider

This eliminates the need to filter client-side.

## Solution

Created `scripts/import-hyre-stations.ts` that:
1. Fetches stations from Entur Mobility v2 GraphQL API
2. Creates `carshare` category automatically
3. Transforms and batch upserts POIs
4. Stores `hyre_station_id` for future realtime data integration

### Script: `scripts/import-hyre-stations.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ENTUR_MOBILITY_ENDPOINT = "https://api.entur.io/mobility/v2/graphql";
const ET_CLIENT_NAME = "placy-neighborhood-stories";

// Trondheim center coordinates with 15km range
const TRONDHEIM_CENTER = {
  lat: 63.43,
  lon: 10.4,
  range: 15000, // meters
};

const HYRE_STATIONS_QUERY = `
  query GetHyreStations($lat: Float!, $lon: Float!, $range: Int!) {
    stations(
      lat: $lat
      lon: $lon
      range: $range
      availableFormFactors: [CAR]
      systems: ["hyrenorge"]
    ) {
      id
      name {
        translation {
          value
        }
      }
      lat
      lon
      address
      numVehiclesAvailable
    }
  }
`;

async function fetchHyreStations(): Promise<HyreStation[]> {
  const response = await fetch(ENTUR_MOBILITY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ET-Client-Name": ET_CLIENT_NAME,
    },
    body: JSON.stringify({
      query: HYRE_STATIONS_QUERY,
      variables: {
        lat: TRONDHEIM_CENTER.lat,
        lon: TRONDHEIM_CENTER.lon,
        range: TRONDHEIM_CENTER.range,
      },
    }),
  });

  const json: GraphQLResponse = await response.json();
  return json.data.stations;
}
```

### ID Extraction Pattern

Entur IDs follow a format like `YHY:VehicleSharingParkingArea:12345`. The script extracts the UUID portion for cleaner POI IDs:

```typescript
function extractStationId(fullId: string): string {
  const parts = fullId.split(":");
  return parts[parts.length - 1] || fullId;
}
```

Resulting POI IDs: `hyre-12345`, `hyre-67890`, etc.

### Run Command

```bash
npm run import:hyre
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **GraphQL over REST** | Entur Mobility v2 uses GraphQL. Allows precise field selection and filtering. |
| **Server-side filtering** | Use `availableFormFactors` and `systems` parameters to filter at API level vs client-side. |
| **Store full station ID** | Keep `hyre_station_id` (e.g., `YHY:VehicleSharingParkingArea:...`) for realtime queries. |
| **Batch upsert** | Single database operation. Idempotent with `onConflict: "id"`. |
| **Auto-create category** | Script ensures `carshare` category exists before importing POIs. |

## Comparison: Static vs Dynamic Import

| Aspect | Taxi Stands (Static) | Hyre Stations (Dynamic) |
|--------|---------------------|------------------------|
| **Data source** | KMZ file (pre-extracted) | GraphQL API (runtime fetch) |
| **Update frequency** | Rarely (manual) | Can re-run anytime |
| **Data hardcoded** | Yes (35 coordinates) | No (fetched dynamically) |
| **Dependencies** | None | None (native fetch) |
| **Realtime integration** | N/A | Station ID for availability queries |

## Gotcha: Next.js Cache

After running the import, new POIs may not appear immediately in the admin interface due to Next.js server-side caching.

**Fix:**
```bash
rm -rf .next && npm run dev
```

This is a common issue when:
- Server components fetch data at build/first-request time
- Data changes in the database after initial fetch
- Using `force-static` or similar caching strategies

## Result

- 53 Hyre stations imported in Trondheim area (15km radius)
- New `carshare` category created with icon `CarFront` and color `#10b981`
- POIs visible at: `http://localhost:3000/admin/pois?categories=carshare`
- Each POI includes `hyre_station_id` for future realtime availability

## Future: Realtime Vehicle Availability

The stored `hyre_station_id` enables future realtime queries:

```graphql
query GetAvailability($stationIds: [String!]!) {
  stations(ids: $stationIds) {
    id
    numVehiclesAvailable
    vehicleTypesAvailable {
      vehicleType { formFactor }
      count
    }
  }
}
```

This can power:
- Live "X cars available" badges on POI cards
- Availability-based filtering in the map view
- Push notifications when cars become available

## Related Files

- `scripts/import-hyre-stations.ts` - The import script
- `scripts/import-taxi-stands.ts` - Similar pattern for static data
- `app/admin/pois/page.tsx` - Admin interface displaying imported POIs
- `docs/solutions/data-import/import-external-geographic-data-20260125.md` - Related taxi stands solution

## API Reference

### Entur Mobility v2

- **Endpoint:** `https://api.entur.io/mobility/v2/graphql`
- **Required header:** `ET-Client-Name: your-app-name`
- **Documentation:** https://developer.entur.org/pages-mobility-docs-mobility-v2
- **GraphQL Playground:** https://api.entur.io/graphql-explorer/mobility-v2

### GraphQL Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `lat` | Float | Center latitude |
| `lon` | Float | Center longitude |
| `range` | Int | Search radius in meters |
| `availableFormFactors` | [FormFactor] | Filter by vehicle type: `CAR`, `BICYCLE`, `SCOOTER` |
| `systems` | [String] | Filter by operator system ID: `hyrenorge`, `oslobysykkel`, etc. |

## Lessons Learned

1. **GraphQL filtering is powerful.** Use API-level filtering over client-side when available.
2. **Store original IDs.** Keep the full Entur ID for future API calls even if you use a simplified POI ID.
3. **Cache invalidation matters.** Next.js server-side caching can hide database changes - remember to clear `.next/` when debugging.
4. **Reusable pattern.** This same approach works for other Entur mobility providers (bysykkel, Voi, Tier, etc.) by changing the `systems` filter.
