---
module: Report
date: 2026-04-10
problem_type: integration_issue
component: frontend_stimulus
symptoms:
  - "Bussavganger blandes fra begge retninger i én flat liste"
  - "Ingen måte å skille 'mot Dragvoll' fra 'mot Marienborg' i UI"
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags: [entur, graphql, quay, direction, departures, transport]
---

# Integration: Entur quay-nivå for retningsseparerte avganger

## Problem

Entur JourneyPlanner GraphQL returnerer avganger fra `stopPlace.estimatedCalls` som én flat liste. En holdeplass som Brøset Hageby har to retninger (mot Dragvoll og mot Marienborg via Strindheim), men disse blandes i samme array uten noen indikator for hvilken vei bussen går. Resultatet i UI: brukeren ser 6 avganger uten å vite at tre av dem kjører den andre veien.

## Environment

- Module: Report (Transport & Mobilitet hero insight)
- Framework: Next.js 14
- Entur API: JourneyPlanner v3 (`https://api.entur.io/journey-planner/v3/graphql`)
- Filer: `app/api/entur/route.ts`, `lib/hooks/useTransportDashboard.ts`, `components/variants/report/ReportHeroInsight.tsx`
- Date: 2026-04-10

## Symptoms

- Flat avgangsliste — ingen retningsseparasjon
- "Dragvoll" og "Marienborg via Strindheim" blandes om hverandre uten gruppering
- Umulig å si fra UI om neste avgang er "din" retning

## What Didn't Work

**Direct solution:** Identifisert og fikset i én runde etter å ha lest Entur-dokumentasjon.

## Solution

Bruk `stopPlace.quays { id estimatedCalls(...) }` i stedet for `stopPlace.estimatedCalls`. Hvert quay representerer én fysisk platform/retning.

**GraphQL query — før (flat):**
```graphql
stopPlace(id: $stopPlaceId) {
  id
  name
  estimatedCalls(numberOfDepartures: $numberOfDepartures) {
    expectedDepartureTime
    destinationDisplay { frontText }
    serviceJourney { line { publicCode ... } }
  }
}
```

**GraphQL query — etter (per quay):**
```graphql
stopPlace(id: $stopPlaceId) {
  id
  name
  quays {
    id
    estimatedCalls(numberOfDepartures: $numberOfDepartures) {
      expectedDepartureTime
      destinationDisplay { frontText }
      serviceJourney { line { publicCode ... } }
    }
  }
}
```

**API response-parsing (`app/api/entur/route.ts`):**
```typescript
const rawQuays: Array<{ id: string; estimatedCalls: RawCall[] }> = stopPlace.quays || [];

const quays = rawQuays
  .filter((q) => q.estimatedCalls?.length > 0)
  .map((q) => ({
    quayId: q.id,
    departures: q.estimatedCalls.map(formatCall),
  }));

// Backward compat: first departure per quay for map tooltips
const departures = quays.map((q) => q.departures[0]).filter(Boolean);

return NextResponse.json({ stopPlace: { id, name }, quays, departures });
```

**Type i hook (`lib/hooks/useTransportDashboard.ts`):**
```typescript
export interface QuayDepartures {
  quayId: string;
  departures: EnturDeparture[];
}

export interface StopDepartures {
  stopName: string;
  stopId: string;
  walkMin: number;
  quays: QuayDepartures[];      // ny — per-retning
  departures: EnturDeparture[]; // bakoverkompatibel flat liste
}
```

**UI-rendering (`DepartureBlock` i `ReportHeroInsight.tsx`):**
```tsx
<div className="grid grid-cols-2 gap-x-8">
  {stop.quays.map((quay) => {
    const directionLabel = quay.departures[0].destination;
    return (
      <div key={quay.quayId}>
        <div className="text-[10px] uppercase text-[#a0937d]">
          → {directionLabel}
        </div>
        {quay.departures.map((dep, i) => (
          <div key={i} className="flex gap-2 text-sm">
            <span>{dep.lineCode}</span>
            <span>om {formatRelativeDepartureTime(dep.departureTime)}</span>
          </div>
        ))}
      </div>
    );
  })}
</div>
```

## Why This Works

Entur modellerer holdeplasser hierarkisk: `StopPlace` → `Quay[]` → `EstimatedCall[]`. Et `Quay` er én fysisk perrong/stoppunkt, og busser som kjører i én retning bruker konsekvent samme quay. Ved å gruppere per quay får vi automatisk retningsseparasjon — directionLabel = `destinationDisplay.frontText` på første avgang i quayen.

Det er ingen eksplisitt "retning"-felt i API-et; quay-grupperingen er den korrekte abstraksjonen.

## Prevention

- Bruk alltid `quays { id estimatedCalls(...) }` når du vil vise retningsseparerte avganger
- `stopPlace.estimatedCalls` gir flat liste — kun egnet for "neste avgang uansett retning" (f.eks. map tooltip)
- Sett `numberOfDepartures` på 3 per quay (ikke 5 totalt) — med to quays gir det 6 avganger totalt
- Filtrer quays med `estimatedCalls?.length > 0` — noen quays har ingen aktive avganger
- Hold `departures` (flat) på `StopDepartures` for backward compat med `poiLiveInfo` i `ReportThemeSection.tsx`

## Related Issues

- Se også: [entur-mobility-v2-universal-transport-api-20260410.md](../architecture-patterns/entur-mobility-v2-universal-transport-api-20260410.md) — full transportdashboard-arkitektur
- Se også: [import-entur-stops-20260125.md](../data-import/import-entur-stops-20260125.md) — import av Entur-holdeplasser
