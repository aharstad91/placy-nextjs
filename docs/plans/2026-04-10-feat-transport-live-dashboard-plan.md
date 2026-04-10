---
title: "feat: Transport & Mobilitet — Live dashboard med sanntid og mobilitetskort"
type: feat
date: 2026-04-10
brainstorm: docs/brainstorms/2026-04-10-transport-mobilitet-live-dashboard-brainstorm.md
---

# feat: Transport & Mobilitet — Live dashboard med sanntid og mobilitetskort

## Overview

Oppgradere Transport & Mobilitet hero insight fra statisk holdeplass-liste til et live transport-dashboard. Kollektivliste med sanntidsavganger (Entur), pluss tre mobilitetskort for Bysykkel, Sparkesykkel (samlet VOI+Ryde+Dott), og Bildeling (Hyre) — alle med live tilgjengelighetsdata.

## Motivasjon

Transport-seksjonen viser i dag en flat holdeplassliste med gangtider. Placy har ubrukte API-integrasjoner (Entur sanntid, Bysykkel GBFS, Hyre) som ikke vises i Report. 7 operatører er aktive i Trondheim via Entur Mobility v2, og all data er tilgjengelig uten nye API-nøkler.

## Akseptansekriterier

### Kollektiv-liste med sanntid
- [x] De 2 nærmeste holdeplassene vises med holdeplassnavn og gangtid
- [x] Under hver holdeplass: 3 neste avganger med linjekode, destinasjon, og "om X min" countdown
- [x] Grønn prikk (●) for sanntid, grå prikk (○) for rutetabell
- [x] Linjekoder er klikkbare lenker til entur.no (ATB har ingen per-linje URLer, verifisert)
- [x] Poller hvert 90 sekund (audit-anbefaling: 90s > 60s for suburbs)
- [x] "Sist oppdatert kl HH:MM" tidsstempel
- [x] Graceful degradation: vis statisk holdeplass-info hvis Entur-API feiler

### Mobilitetskort
- [x] 3-kolonners grid under kollektivlisten (1 kolonne mobil)
- [x] **Bysykkelkort:** Ledige sykler live, stasjonsnavn, gangtid. Popover med sykler/låser
- [x] **Sparkesykkelkort:** Aggregert antall fra VOI+Ryde+Dott innen 750m. Popover med per-operatør
- [x] **Bildelingskort:** Ledige Hyre-biler live, stasjonsnavn, gangtid. Popover med detaljer

### Kart-popover
- [x] Bussholdeplass-klikk i kartet: vis 3 neste avganger med countdown
- [x] Bysykkelstasjon-klikk: vis ledige sykler/låser
- [x] Hyre-stasjon-klikk: vis ledige biler

### Data
- [x] Link manglende transport-POIer til Wesselsløkka (Leangen stasjon, 3 Hyre-stasjoner)
- [x] TypeScript kompilerer uten feil

## Tech Audit Mitigasjoner (YELLOW → GREEN)

1. **ATB URL-verifisering:** Test `atb.no/linje/{lineCode}` før implementering. Fallback: `entur.no/nearby-stop-place-detail?id={stopPlaceId}`.
2. **API caching:** Legg til `next: { revalidate: 30 }` på fetch i `/api/entur`, `/api/hyre`, og ny `/api/mobility`. Forhindrer upstream-overbelastning ved mange samtidige brukere.
3. **Sparkesykkel null-state:** Vis kortet med "Ingen i nærheten nå" i stedet for å skjule det. Øk radius til 750m for suburbs.
4. **Input-validering på `/api/mobility`:** Valider lat/lng/radius/formFactors. Cap radius på 2000m.
5. **`rel="noopener noreferrer"`** på alle `target="_blank"` ATB-lenker.
6. **Polling 90s (ikke 60s):** Busser i suburbs kommer hvert 5-15 min. 90s er nok.

## Teknisk tilnærming

### Steg 1: Ny API-rute `/api/mobility` for sparkesykkeldata

Nytt endpoint som aggregerer data fra Entur Mobility v2 GraphQL:

```
GET /api/mobility?lat=63.42&lng=10.45&radius=500&formFactors=SCOOTER,SCOOTER_STANDING
```

**Implementasjon i** `app/api/mobility/route.ts`:

Spør Entur Mobility `vehicles`-query (free-floating) for VOI, Ryde, Dott innen radius. Returner:

```typescript
{
  total: number;
  byOperator: Array<{ systemId: string; name: string; count: number }>;
  radius: number;
  lastUpdated: string;
}
```

Gjenbruk mønsteret fra `app/api/hyre/route.ts` — samme Entur Mobility v2 URL og headers.

### Steg 2: Ny hook `useTransportDashboard`

Dedikert hook i `lib/hooks/useTransportDashboard.ts` som poller 4 datakilder parallelt.

**Input:** De 2 nærmeste bussholdeplassene (enturStopplaceId), nærmeste bysykkelstasjon (bysykkelStationId), nærmeste Hyre-stasjon (hyreStationId), prosjektkoordinater (for sparkesykkel).

```typescript
interface TransportDashboardData {
  departures: Array<{
    stopName: string;
    stopId: string;
    walkMin: number;
    departures: EnturDeparture[];  // gjenbruk fra useRealtimeData
  }>;
  bysykkel: {
    stationName: string;
    walkMin: number;
    availableBikes: number;
    availableDocks: number;
    isOpen: boolean;
  } | null;
  scooters: {
    total: number;
    byOperator: Array<{ name: string; count: number }>;
  } | null;
  carShare: {
    stationName: string;
    walkMin: number;
    numVehiclesAvailable: number;
  } | null;
  loading: boolean;
  lastUpdated: Date | null;
}
```

Poller hvert 60s. Bruker `Promise.allSettled` — én feilende kilde blokkerer ikke resten.

### Steg 3: Erstatt TransportInsight med TransportDashboard

I `components/variants/report/ReportHeroInsight.tsx`:

**Øvre del — Kollektivliste med sanntid:**

```tsx
<InsightCard title="Kollektivt herfra" footer={footerText}>
  {/* Tidsstempel */}
  <div className="text-xs text-[#a0a0a0] text-right -mt-1 mb-2">
    oppdatert kl {format(lastUpdated, 'HH:mm')}
  </div>
  
  {/* Per holdeplass */}
  {nearestStops.map(stop => (
    <div key={stop.stopId}>
      {/* Holdeplass-header: ikon + navn + gangtid */}
      <div className="flex items-center gap-3 py-1.5">...</div>
      
      {/* Avgangsliste under holdeplassen */}
      {stop.departures.slice(0, 3).map(dep => (
        <div className="flex items-center gap-2 pl-10 py-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${dep.isRealtime ? 'bg-green-500' : 'bg-gray-400'}`} />
          <a href={`https://www.atb.no/linje/${dep.lineCode}`} target="_blank" className="font-medium text-sm">
            {dep.lineCode}
          </a>
          <span className="text-sm text-[#6a6a6a]">→ {dep.destination}</span>
          <span className="text-sm text-[#8a8a8a] ml-auto">om {formatRelativeDepartureTime(dep.departureTime)}</span>
        </div>
      ))}
    </div>
  ))}
</InsightCard>
```

**Nedre del — Mobilitetskort (3-grid):**

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
  {bysykkelData && <MobilityCard type="bysykkel" data={bysykkelData} />}
  {scooterData && <MobilityCard type="scooter" data={scooterData} />}
  {carShareData && <MobilityCard type="carshare" data={carShareData} />}
</div>
```

Hver `MobilityCard`:
- Ikon-sirkel øverst (kategorifarve bakgrunn)
- Transporttype-label (BYSYKKEL / SPARKESYKKEL / BILDELING)
- Live-tall sentrert stort ("12 ledige sykler")
- Undertekst (stasjonsnavn + gangtid ELLER operatørliste)
- Popover ved klikk med detaljer

### Steg 4: Live data i kart-popover (ReportMapDrawer)

Utvid `ReportMapDrawer` til å vise sanntidsdata for transport-POIs. Bruk eksisterende `useRealtimeData`-hook.

I `components/variants/report/ReportMapDrawer.tsx`:
- Sjekk om POI har `enturStopplaceId`, `bysykkelStationId`, eller `hyreStationId`
- Hvis ja: kall `useRealtimeData(poi)` og vis live-data under POI-info
- Avgangsliste for buss (3 linjer med countdown)
- Bysykkel: "X ledige sykler · Y ledige låser"
- Hyre: "X biler ledige"

### Steg 5: Link manglende transport-POIer

Via Supabase REST — link eksisterende POIs til prosjektet:

```
POST /rest/v1/project_pois
Prefer: resolution=merge-duplicates
Body: [
  { project_id: "broset-utvikling-as_wesselslokka", poi_id: "{lerkendal-poi-id}" },
  { project_id: "broset-utvikling-as_wesselslokka", poi_id: "{hyre-poi-1}" },
  ...
]
```

Også link til begge produkter (Explorer + Report) via `product_pois`.

### Steg 6: Oppdater TIER1_EXTRACTORS

Oppdater transport-extractoren til å inkludere bysykkel og carshare POIs som brukes i dashboardet, slik at de får permanente labels i kartet.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `app/api/mobility/route.ts` | **NY** — sparkesykkel-aggregering via Entur Mobility |
| `lib/hooks/useTransportDashboard.ts` | **NY** — polling-hook for transport-dashboard |
| `components/variants/report/ReportHeroInsight.tsx` | Erstatt `TransportInsight` med `TransportDashboard` + `MobilityCard` |
| `components/variants/report/ReportMapDrawer.tsx` | Legg til sanntidsdata for transport-POIs |

## Referanser

- Brainstorm: `docs/brainstorms/2026-04-10-transport-mobilitet-live-dashboard-brainstorm.md`
- `app/api/entur/route.ts` — eksisterende sanntids-API
- `app/api/bysykkel/route.ts` — eksisterende bysykkel-API
- `app/api/hyre/route.ts` — eksisterende Hyre-API (mønster for `/api/mobility`)
- `lib/hooks/useRealtimeData.ts` — eksisterende polling-mønster
- `components/poi/poi-card-expanded.tsx:131-155` — eksisterende avgangsliste-rendering
- `components/variants/report/ReportHeroInsight.tsx:374-442` — nåværende TransportInsight
- `components/variants/report/ReportHeroInsight.tsx:90-112` — InsightCard wrapper
- `lib/utils/format-time.ts` — `formatRelativeDepartureTime()`
