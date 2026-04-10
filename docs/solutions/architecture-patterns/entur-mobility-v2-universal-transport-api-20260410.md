---
module: Report
date: 2026-04-10
problem_type: best_practice
component: frontend_stimulus
symptoms:
  - "Transport section only showed static bus stop list"
  - "Hyre API existed but data was never displayed in UI"
  - "Sparkesykler and Getaround had no integration"
root_cause: missing_workflow_step
resolution_type: code_fix
severity: medium
tags: [entur, mobility-api, transport, graphql, sparkesykkel, hyre, getaround, bysykkel, live-data]
---

# Architecture: Entur Mobility v2 as Universal Transport Data Source

## Problem
The transport section showed a flat static list of bus stops. Multiple transport APIs existed in the codebase (Entur sanntid, Bysykkel GBFS, Hyre) but were only used in Explorer POI cards, never in the Report. Sparkesykler (VOI, Ryde, Dott) and Getaround had no integration at all.

## Environment
- Module: Report (Transport & Mobilitet)
- Framework: Next.js 14
- Date: 2026-04-10

## Key Discovery: Entur Mobility v2 GraphQL

**One API serves ALL micromobility in Norway.** Entur Mobility v2 (`https://api.entur.io/mobility/v2/graphql`) provides:

### Station-based systems (via `stations` query)
| System | ID | Type | Data |
|--------|-----|------|------|
| Trondheim Bysykkel | `trondheimbysykkel` | BICYCLE | Station availability |
| Hyre | `hyrenorge` | CAR | Station vehicle count |
| Hertz Bildeling | `hertzbildeling` | CAR | Station vehicle count |

### Free-floating systems (via `vehicles` query)
| System | ID | Type | Data |
|--------|-----|------|------|
| VOI | `voitrondheim` | SCOOTER_STANDING | Individual lat/lng positions |
| Ryde | `rydetrondheim` | SCOOTER | Individual lat/lng positions |
| Dott (tidl. Tier) | `dotttrondheim` | SCOOTER | Individual lat/lng positions |
| Getaround | `getaroundtrondheim` | CAR | Individual lat/lng positions |

### Key GraphQL queries
```graphql
# Station-based (docked vehicles)
query { stations(lat: 63.43, lon: 10.4, range: 15000, availableFormFactors: [CAR]) {
  id name { translation { value } } numVehiclesAvailable lat lon
  system { id name { translation { value } } }
}}

# Free-floating (scooters, Getaround)
query { vehicles(lat: 63.42, lon: 10.45, range: 750, formFactors: [SCOOTER, SCOOTER_STANDING]) {
  id lat lon system { id name { translation { value } } }
}}
```

### API details
- **No API key required** — just `ET-Client-Name` header
- **Response time:** ~500ms for stations, ~800ms for vehicles
- **Caching:** Use `next: { revalidate: 30 }` to prevent upstream overload
- **National coverage:** Works for all Norwegian cities (different system IDs per city)
- **Form factors:** BICYCLE, CAR, SCOOTER, SCOOTER_STANDING, MOPED, CARGO_BICYCLE

## Architecture Pattern: Transport Dashboard

```
useTransportDashboard (90s polling)
├── /api/entur (Entur JourneyPlanner) → sanntidsavganger per holdeplass
├── /api/bysykkel (GBFS) → ledige sykler/låser per stasjon
├── /api/hyre (Entur Mobility stations) → ledige biler per stasjon
└── /api/mobility (Entur Mobility vehicles) → sparkesykler + Getaround posisjoner
```

All four data sources fetched in parallel via `Promise.allSettled` — one failing source doesn't block others.

### Map visualization
- **Bus/train POIs:** Yellow tooltip with next departure countdown
- **Bysykkel POIs:** Tooltip with "X ledige sykler"
- **Hyre POIs:** Tooltip with "X biler ledige"
- **Sparkesykler:** Purple dots at individual vehicle positions (free-floating)
- **Getaround:** Green dots at individual vehicle positions (free-floating)
- **Floating chips:** Aggregated counts in bottom-left corner

## Prevention / Best Practices

- **Always check Entur Mobility first** when adding a new transport type — it likely already has the data
- **Store `enturStopplaceId`, `bysykkelStationId`, `hyreStationId`** on POIs during import for runtime lookups
- **Use `formFactors` filter** to get only relevant vehicle types, not all mobility
- **Cap scooter radius at 750m** for suburbs (1000m+ returns too many for map rendering)
- **Cap car radius at 2000m** (Getaround cars are sparser than scooters)
- **90s polling** is sufficient for a report page — bus departures in suburbs change slowly

## ATB URL Pattern (Gotcha)

ATB (Trondheim bussoperatør) has **no per-line URL pattern**. `atb.no/linje/{lineCode}` returns 404.
Use Entur's stop page instead: `https://entur.no/nearby-stop-place-detail?id={stopPlaceId}` — always works.

## Related Issues

- See also: [import-entur-stops-20260125.md](../data-import/import-entur-stops-20260125.md) — Entur stop import
- See also: [import-hyre-carshare-stations-20260125.md](../data-import/import-hyre-carshare-stations-20260125.md) — Hyre import pattern
- See also: [entur-quay-direction-grouping-Report-20260410.md](../integration-issues/entur-quay-direction-grouping-Report-20260410.md) — Quay-nivå retningsseparasjon
