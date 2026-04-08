---
title: "Inline POI-kortsystem med 5 varianter i Story"
date: 2026-04-08
tags: [story, poi-card, dialog, variant-system, entur, bysykkel, hyre, school, realtime, abort-controller]
category: feature-implementations
module: components/variants/story
symptoms:
  - "StoryPOIDialog viser kun standard POI-data for alle typer"
  - "Transport-POI-er mangler sanntidsdata i Story-visningen"
  - "useRealtimeData mangler AbortController og lekker requests"
---

# Inline POI-kortsystem med 5 varianter i Story

## Problem

StoryPOIDialog viste identisk innhold (rating, editorial hook, local insight) for alle POI-typer. Bussholdeplasser, bysykkelstasjoner, Hyre-stasjoner og skoler fikk ingen kontekstuelt tilpasset visning. I tillegg hadde `useRealtimeData`-hooken flere latente bugs: ingen AbortController, ustabile useEffect-dependencies, og Promise.all som lot én API-feil blokkere alle datakilder.

## Løsning

### 1. Variant-system med komposisjon (ikke separate komponenter)

**Designvalg:** Alle 5 varianter lever i én fil (`StoryPOIDialog.tsx`) med en `switch(getCardVariant(poi))` + `assertNever`. Ikke separate filer per variant — én call site per variant betyr at separate komponenter er prematur abstraksjon.

```typescript
type CardVariant = "transit" | "bysykkel" | "hyre" | "school" | "standard";

function getCardVariant(poi: POI): CardVariant {
  if (poi.enturStopplaceId) return "transit";
  if (poi.bysykkelStationId) return "bysykkel";
  if (poi.hyreStationId) return "hyre";
  if (SCHOOL_CATEGORY_IDS.includes(poi.category.id)) return "school";
  return "standard";
}
```

**Rekkefølge:** Transport-IDer sjekkes først (mest spesifikke), kategori er fallback, standard er default.

### 2. useRealtimeData — AbortController + Promise.allSettled

**Før:** Ingen request cancellation, Promise.all (én feil blokkerer alle), ustabile deps (fetchData callback).

**Etter:**
- AbortController threaded inn i alle fetch-kall, abort i cleanup
- Promise.allSettled isolerer feil mellom datakilder
- Dependencies: `[poiId, enturId, bysykkelId, hyreId]` — stabile primitive verdier
- Reset data ved POI-bytte (prevents stale rendering)
- Conditional fetch — bare kall APIer som POI-en har ID for

### 3. Hyre API-endepunkt

Nytt `/api/hyre/route.ts` basert på Entur Mobility v2 GraphQL. Gjenbruker query-mønster fra `scripts/import-hyre-stations.ts`. Inkluderer stationId format-validering (regex) per security-reviewer.

### 4. Skoledata fra poiMetadata (ikke nye POI-felter)

**Designvalg:** schoolLevel/schoolType leses fra `poiMetadata` JSONB via type guard, ikke nye felter på POI-interface. Holder interface rent og unngår DB-migrasjon.

```typescript
function getSchoolMetadata(poi: POI): SchoolMetadata | null {
  const meta = poi.poiMetadata;
  if (!meta || typeof meta !== "object") return null;
  // ... type guard
}
```

## Nøkkelinnsikter

1. **Komposisjon > separate varianter.** Én komponent med switch er enklere enn 5 filer med én call site hver. `assertNever` i default sikrer type-safety.

2. **AbortController er critical for dialog-patterns.** Uten den lekker requests ved rask POI-bytte og dialog-lukking. Alle 5 reviewere flagget dette.

3. **Promise.allSettled > Promise.all for multiple uavhengige datakilder.** Entur nede skal ikke blokkere bysykkel-data.

4. **useEffect deps: bruk primitive verdier, ikke callbacks.** `poi?.id` er stabilt. `fetchData` callback endres ved hver render og trigger unødvendige re-runs.

5. **formatRelativeDepartureTime var duplisert** i ExplorerPOICard og poi-card-expanded. Ekstrahert til `lib/utils/format-time.ts`.

## Filer endret

| Fil | Endring |
|-----|---------|
| `components/variants/story/StoryPOIDialog.tsx` | Refaktorert til variant-system (+290/-17 linjer) |
| `lib/hooks/useRealtimeData.ts` | AbortController, Promise.allSettled, Hyre-støtte |
| `app/api/hyre/route.ts` | Nytt endepunkt (Entur Mobility v2 GraphQL) |
| `lib/utils/format-time.ts` | Delt formatRelativeDepartureTime utility |
| `lib/utils/map-icons.ts` | GraduationCap + CarFront ikoner |
| `components/poi/poi-card-expanded.tsx` | Gated useRealtimeData, bruk delt utility |
| `components/variants/explorer/ExplorerPOICard.tsx` | Bruk delt formatRelativeDepartureTime |
