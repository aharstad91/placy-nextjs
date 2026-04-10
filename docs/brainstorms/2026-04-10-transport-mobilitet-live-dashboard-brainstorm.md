---
title: Transport & Mobilitet — Live dashboard med sanntid og mobilitetskort
date: 2026-04-10
status: decided
---

# Transport & Mobilitet — Live dashboard med sanntid og mobilitetskort

## Hva vi bygger

Oppgradere Transport & Mobilitet hero insight fra statisk holdeplass-liste til et live transport-dashboard med:
1. **Kollektivliste med sanntidsavganger** — de 2 nærmeste holdeplassene med live countdown per linje
2. **Tre mobilitetskort** — Bysykkel, Sparkesykkel (samlet), Bildeling (Hyre) med live tilgjengelighet
3. **Kart-popover med live data** — sanntid når du klikker en transport-POI i kartet

## Hvorfor

Transport-seksjonen er den viktigste for boligkjøpere etter skole. Men nåværende visning er en flat liste med gangtider — samme info du finner på Google Maps. Placy har UBRUKTE API-integrasjoner:

- **Entur sanntid** — brukes i Explorer POI-kort, men IKKE i Report
- **Bysykkel GBFS** — ledige sykler/låser, brukes i Explorer men IKKE i Report
- **Hyre via Entur Mobility** — henter data men VISES ALDRI i UI
- **Sparkesykler** — VOI, Ryde, Dott finnes alle i Entur Mobility API, aldri integrert

7 operatører er aktive i Trondheim via Entur Mobility v2:
| Operatør | Type | Flåte |
|----------|------|-------|
| ATB (Entur) | Buss/tog | Sanntidsavganger |
| Trondheim Bysykkel | Sykkel | 432 sykler, 71 stasjoner |
| VOI | Sparkesykkel | 1 448 |
| Ryde | Sparkesykkel | 1 276 |
| Dott (tidl. Tier) | Sparkesykkel | 886 |
| Hyre | Bildeling | 66 biler, 59 stasjoner |
| Getaround | Bildeling | 58 biler |

Alt via én API (Entur Mobility v2 GraphQL). Sparkesykler trenger ikke egen backend.

## Design

### Hero Insight Layout

```
┌───────────────────────────────────────────────┐
│ KOLLEKTIVT HERFRA                    oppdatert│
│                                       kl 14:32│
│ 🚌 Brøset Hageby bussholdeplass      1 min   │
│    ● L12  → Sentrum          om 3 min         │
│    ● L113 → Heimdal          om 7 min         │
│    ○ L12  → Sentrum          om 18 min        │
│                                               │
│ 🚌 Brøsetflata bussholdeplass        4 min   │
│    ● L12  → City Lade        om 2 min         │
│    ○ L113 → Kattem           om 12 min        │
│                                               │
│ ● = sanntid  ○ = rutetabell                   │
│ 4 holdeplasser innen 5 min gange              │
├───────────────────────────────────────────────┤
│                                               │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│ │ 🚲         │ │ 🛴         │ │ 🚗         │    │
│ │ Bysykkel  │ │ Sparkesykl│ │ Bildeling  │    │
│ │           │ │           │ │            │    │
│ │ 12 ledige │ │ 86 nærme  │ │ 3 biler    │    │
│ │ sykler    │ │ tilgjeng. │ │ ledige     │    │
│ │           │ │           │ │            │    │
│ │ Valentinl.│ │ VOI · Dott│ │ Hyre       │    │
│ │ 5 min 🚶  │ │ · Ryde    │ │ 8 min 🚶   │    │
│ └───────────┘ └───────────┘ └───────────┘    │
│                                               │
└───────────────────────────────────────────────┘
```

### Kollektiv-liste (øvre del)

- Vis de **2 nærmeste holdeplassene** (uendret fra nåværende utvalg)
- For hver holdeplass: vis **3 neste avganger** fra Entur sanntids-API
- Linjekode som klikkbar lenke til `atb.no/linje/{linjenummer}` (eller tilsvarende URL)
- Grønn prikk (●) = sanntid, grå prikk (○) = rutetabell
- **Poller hvert 60 sekund** via useRealtimeData-mønsteret
- Footer: "X holdeplasser innen 5 min gange" (uendret)
- Tidsstempel "oppdatert kl HH:MM" øverst til høyre

### Mobilitetskort (nedre del)

**Grid:** `grid grid-cols-1 md:grid-cols-3 gap-3` (likt SchoolCard-mønsteret)

#### Bysykkelkort
- Ikon: Bike (Lucide)
- Live-tall: "X ledige sykler" (fra Bysykkel GBFS API)
- Undertekst: Stasjonsnavn + gangtid
- Klikk: Popover med "X ledige sykler · Y ledige låser" + stasjonsstatus

#### Sparkesykkelkort
- Ikon: Zap eller tilpasset sparkesykkel-ikon
- Live-tall: "X tilgjengelige" (aggregert fra VOI + Ryde + Dott via Entur Mobility)
- Undertekst: "VOI · Dott · Ryde"
- Klikk: Popover med fordeling per operatør
- Radius: 500m fra prosjektsenter (nærmeste sparkesykler)

#### Bildelingskort  
- Ikon: Car (Lucide)
- Live-tall: "X biler ledige" (fra Hyre API)
- Undertekst: Stasjonsnavn + gangtid
- Klikk: Popover med stasjonsnavn + antall biler

### Kart-popover med live data

Når bruker klikker en transport-POI i kartet:
- **Bussholdeplass:** Vis 3 neste avganger med countdown (som i poi-card-expanded)
- **Bysykkelstasjon:** Vis ledige sykler/låser
- **Hyre-stasjon:** Vis ledige biler

## API-arkitektur

### Ny API-rute: `/api/mobility`

Samle-endpoint for Entur Mobility v2 som støtter alle operatører:

```
GET /api/mobility?lat=63.42&lng=10.45&radius=500&formFactors=SCOOTER,SCOOTER_STANDING
```

Returnerer aggregert data fra Entur Mobility:
- Antall kjøretøy per operatør innenfor radius
- Antall totalt

Gjenbruker Entur Mobility v2 GraphQL (samme som Hyre-API-et bruker i dag).

### Eksisterende API-er (gjenbruk)

- `/api/entur?stopPlaceId=X` — sanntidsavganger (eksisterer, bare ny klient i Report)
- `/api/bysykkel?stationId=X` — ledige sykler (eksisterer, bare ny klient i Report)
- `/api/hyre?stationId=X` — ledige biler (eksisterer, bare ny klient i Report)

### Ny hook: `useTransportDashboard`

Dedikert hook for transport-dashboardet som poller alle 4 datakildene:

```typescript
interface TransportDashboardData {
  departures: Array<{
    stopName: string;
    stopId: string;
    walkMin: number;
    departures: EnturDeparture[];
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
    radius: number;
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

Poller hvert 60 sekund. Bruker `Promise.allSettled` for graceful degradation.

## Dataforutsetninger

### Manglende POI-er i Wesselsløkka-prosjektet

Må linkes FØR implementering:
- **Lerkendal stasjon** (tog) — finnes i DB, ikke linket
- **Hyre-stasjoner** (4 stk) — finnes i DB, ikke linket
- **2 ekstra bysykkelstasjoner** — finnes i DB, ikke linket

### Nye POI-felt

Ingen nye felt nødvendig — `enturStopplaceId`, `bysykkelStationId`, `hyreStationId` finnes allerede.

## Scope

- **Kun Transport & Mobilitet hero insight** — andre temaer uberørt
- **Kun Report-produkt** — Explorer har allerede sanntid i POI-kort
- **Kun Trondheim** (for nå) — API-er er Trondheim-spesifikke (Entur er nasjonal, men Bysykkel/sparkesykkel er byspesifikke)
- **Ikke trip planning** — Entur POST-endpoint for reiseplanlegger utsettes

## Nøkkelbeslutninger

1. **Kollektiv-liste + mobilitetskort** — to distinkte deler i samme InsightCard
2. **Live countdown med 60s polling** — sanntid fra Entur, ikke bare rutetabell
3. **Sparkesykler aggregert** — VOI + Ryde + Dott som én samlet kategori, fordeling i popover
4. **Ny `/api/mobility` endpoint** — samle-rute for sparkesykkeldata fra Entur Mobility
5. **ATB-linker** — linjekoder er klikkbare lenker til atb.no
6. **Graceful degradation** — hvis en API feiler, vis de andre. Vis skeleton ved lasting.
7. **Kart-popover med live data** — gjenbruk useRealtimeData i ReportMapDrawer

## Åpne spørsmål

1. Skal vi vise "Sist oppdatert kl HH:MM" på dashboardet? → **Ja**, øverst til høyre
2. Skal sparkesykkel-radius være 500m eller 1000m? → **500m** (nærmeste er mest relevant)
3. Skal vi inkludere Getaround i bildeling, eller bare Hyre? → **Bare Hyre** (mest kjent i Trondheim)

## Tekniske referanser

- `app/api/entur/route.ts` — eksisterende sanntids-API
- `app/api/bysykkel/route.ts` — eksisterende bysykkel-API
- `app/api/hyre/route.ts` — eksisterende Hyre-API
- `lib/hooks/useRealtimeData.ts` — eksisterende polling-hook (mønster å følge)
- `components/poi/poi-card-expanded.tsx:131-155` — eksisterende avgangsliste-rendering
- `components/variants/report/ReportHeroInsight.tsx:374-442` — nåværende TransportInsight
- `components/variants/report/ReportHeroInsight.tsx:90-112` — InsightCard wrapper
- `scripts/import-hyre-stations.ts` — Hyre-import (Entur Mobility mønster)
