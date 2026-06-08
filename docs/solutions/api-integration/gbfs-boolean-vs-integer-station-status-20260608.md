---
module: Report
date: 2026-06-08
problem_type: integration_issue
component: api_route
symptoms:
  - "Alle bysykkelstasjoner vises som '(Stengt)' selv om de er åpne"
  - "isOpen er alltid false i bysykkel-API-responsen"
root_cause: type_mismatch
resolution_type: code_fix
severity: medium
tags: [bysykkel, gbfs, boolean, type-coercion, transport, station-status]
---

# Integration: GBFS boolean-felt feiltolket som integer (alltid "Stengt")

## Problem

`/api/bysykkel` returnerte `isOpen: false` for **alle** stasjoner, året rundt.
I board-popup, rapport-drawer, transport-dashboard og explorer-kort viste
samtlige bysykkelstasjoner "(Stengt)" — selv med sykler tilgjengelig og full
sesong.

## Rotårsak

Trondheim Bysykkel GBFS-feeden (`gbfs.urbansharing.com`) returnerer
`is_installed`, `is_renting` og `is_returning` som **boolean** (`true`/`false`):

```json
{
  "station_id": "7696",
  "is_installed": true,
  "is_renting": true,
  "num_bikes_available": 3,
  "num_docks_available": 20
}
```

Koden sjekket mot **integer** `1`:

```typescript
isOpen: status.is_installed === 1 && status.is_renting === 1
```

I JavaScript er `true === 1` → `false` (streng likhet, ingen type-coercion).
Resultat: `isOpen` ble alltid `false`. TypeScript fanget det ikke fordi
interfacet feilaktig deklarerte feltene som `number`.

GBFS-spesifikasjonen brukte historisk `1`/`0`, men v2.x+ definerer disse som
boolean. urbansharing-feedene (Oslo/Bergen/Trondheim Bysykkel) sender boolean.

## Løsning

Robust helper som håndterer **både** boolean-feeden og legacy `1`/`0`-feeder
via `Boolean()` (truthy-coercion):

```typescript
interface StationStatus {
  // ...
  is_installed: boolean | number;
  is_renting: boolean | number;
  is_returning: boolean | number;
}

function isStationOpen(status: StationStatus): boolean {
  return Boolean(status.is_installed) && Boolean(status.is_renting);
}
```

Brukt på alle tre responssteder i `app/api/bysykkel/route.ts` (radius-nearest,
single-station, all-stations). Siden alle konsumenter leser samme endepunkt,
fikset én endring visningen overalt.

## Lærdom / sjekkliste

- **Aldri `=== 1` mot GBFS-status-felt.** Bruk `Boolean(x)` eller `!!x` —
  feltene kan komme som boolean ELLER integer avhengig av feed-versjon.
- **Verifiser eksterne API-felt mot rå respons**, ikke mot antatt type. Rask
  sjekk: `curl <feed> | python3 -c "...; print(type(s['is_renting']))"`.
- Symptom "alle X er false/stengt/0" lukter type-mismatch i en boolsk
  sammenligning — sjekk streng likhet (`===`) mot eksterne felt først.

## Relaterte filer

- `app/api/bysykkel/route.ts` — `isStationOpen`-helper
- `lib/hooks/useRealtimeData.ts` — `BysykkelStatus.isOpen` konsumeres her
- `components/variants/report/blocks/POIRealtimeSection.tsx` — viser "(Stengt)"
