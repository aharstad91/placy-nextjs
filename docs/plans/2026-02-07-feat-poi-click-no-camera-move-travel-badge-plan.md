---
title: "POI-klikk uten kamerabevegelse + travel time badge ved markør"
type: feat
date: 2026-02-07
---

# POI-klikk uten kamerabevegelse + travel time badge ved markør

## Overview

Når en bruker klikker på en POI-markør i Explorer, skal kartet **ikke** bevege seg eller zoome. Kun path (rute-linje) skal tegnes. Travel time-badgen flyttes fra rutens midtpunkt til **nær den klikkede markøren**, slik at brukeren alltid ser reisetiden uavhengig av zoom-nivå.

## Problem Statement

Dagens oppførsel: Klikk på markør → `fitBounds()` kjøres → kartet panner/zoomer for å vise hele ruten. Dette bryter brukerens visuelle kontekst — de mister oversikten de hadde.

Ny tilnærming: La brukeren beholde sin viewport. Vis path + travel time badge ved markøren. Brukeren forstår intuitivt at pathen "kommer fra et sted" og kan selv zoome ut for å se helheten.

## Proposed Solution

### Steg 1: Fjern kamerabevegelse ved POI-klikk

**Fil:** `components/variants/explorer/ExplorerMap.tsx:107-127`

Fjern (eller deaktiver) `useEffect`-blokken som kjører `fitBounds()` når `routeData` ankommer:

```typescript
// FJERN DENNE EFFEKTEN:
useEffect(() => {
  if (!mapRef.current || !mapLoaded || !routeData?.coordinates.length || !activePOI) return;
  if (lastFittedPOIRef.current === activePOI) return;
  lastFittedPOIRef.current = activePOI;
  // ... fitBounds-kode ...
}, [routeData, mapLoaded, mapPadding, activePOI]);
```

Også fjern `lastFittedPOIRef` og tilhørende reset-logikk (linje ~129-133) da de ikke lenger trengs.

### Steg 2: Flytt travel time badge fra rutens midtpunkt til nær klikkede markøren

**Fil:** `components/map/route-layer.tsx`

Endre `RouteLayer` til å plassere travel time-badgen ved destinasjonen (den klikkede POI-en) i stedet for rutens midtpunkt.

**Alternativ A (enklest):** Bruk siste koordinat i ruten (destinasjonen):

```typescript
// Erstatt midpoint-beregning med endpoint
const endpoint = useMemo(() => {
  if (coordinates.length < 2) return null;
  const last = coordinates[coordinates.length - 1];
  return { lng: last[0], lat: last[1] };
}, [coordinates]);
```

Badge-markøren plasseres ved `endpoint` med en offset via `anchor`-prop (f.eks. `anchor="bottom-left"` eller `anchor="left"`) slik at den ikke overlapper selve POI-markøren men ligger like ved.

**Alternativ B (mer kontroll):** Ta inn `destinationCoordinates` som prop:

```typescript
interface RouteLayerProps {
  coordinates: [number, number][];
  travelTime?: number;
  travelMode?: "walk" | "bike" | "car";
  destinationCoordinates?: { lng: number; lat: number }; // ny prop
}
```

Og bruk denne direkte for badge-plassering.

**Anbefalt:** Alternativ A — det er enklere og ruten ender alltid ved POI-en.

### Badge-posisjonering

Badgen bør vises med en liten offset fra markøren, f.eks.:
- `anchor="bottom-left"` — badge vises opp og til høyre for POI-en
- Eller bruk Mapbox `offset` prop: `offset={[20, -10]}` for finkornet kontroll

Eksisterende badge-styling beholdes (hvit pill, skygge, modus-ikon + minutter).

## Acceptance Criteria

- [x] Klikk på POI-markør tegner path uten at kartet beveger seg eller zoomer
- [x] Travel time badge vises nær den klikkede markøren (ikke midt på ruten)
- [x] Badge overlapper ikke selve POI-markøren
- [x] Path tegnes fortsatt korrekt fra origin til POI
- [x] Klikk på kartbakgrunn fjerner path og badge som før
- [x] Fungerer for alle travel modes (walk/bike/car)

## Berørte filer

| Fil | Endring |
|-----|---------|
| `components/variants/explorer/ExplorerMap.tsx` | Fjern fitBounds-effekt + lastFittedPOIRef |
| `components/map/route-layer.tsx` | Flytt badge fra midpoint til endpoint |

## Risiko

Lav. Endringene er isolerte og reversible. Ingen API-endringer, ingen nye avhengigheter.
