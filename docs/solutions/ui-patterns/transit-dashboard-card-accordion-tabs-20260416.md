---
module: report
date: 2026-04-16
problem_type: ui_pattern
component: TransitDashboardCard
symptoms:
  - "tall card — single stop shown even in urban context with 3+ stops"
  - "no accordion — all stops always fully expanded, no way to collapse"
  - "flat grid — tabs missing when multiple transport categories exist"
  - "single stop — suburban layout identical to urban, feels oversized"
category: ui-patterns
root_cause: data_shape_and_component_architecture
resolution_type: design_pattern
severity: medium
tags: [ui-patterns, transit, accordion, tabs, radix-ui, react-hooks]
---

# Multi-stop Transit Card with Tabs + Accordion

## Problem

`ReportHeroInsight` innehold `DepartureBlock` og `StaticTransportList` — to separate komponenter som håndterte kollektivdata med ulike datakilder og ulik presentasjon. I urbane kontekster (mange stopp, flere transportkategorier) ble kortet voldsomt høyt fordi alle stopp ble vist fullt ut samtidig. I forstadskontekster (1 stopp, 1 kategori) ble komponentene vist med tabs og accordion som var tomme og overflødige. Det fantes ingen felles logikk for å skille disse to situasjonene.

## Environment

- Next.js 14, TypeScript, Tailwind CSS
- Radix UI Tabs (`@/components/ui/tabs` — allerede i prosjektet)
- `lib/hooks/useTransportDashboard.ts` — data-hook for kollektivdata
- `components/variants/report/blocks/TransitDashboardCard.tsx` — ny komponent
- `components/variants/report/ReportHeroInsight.tsx` — integrasjonspunkt (slettet DepartureBlock + StaticTransportList herfra)
- Date: 2026-04-16

## Solution

### 1. Per-category hook architecture i `useTransportDashboard`

`selectTransportSources` ble redesignet fra flat `slice(0,1)` array til en per-kategori-struktur:

```ts
// Før: flat array, alltid slice(0,1)
type TransportSources = { pois: Array<{poi, walkMin}> }

// Etter: grouped by category
type TransportSources = {
  enturStopsByCategory: Record<string, Array<{poi, walkMin}>>
}
```

Logikken per kategori (inne i `useMemo`):
1. Filter `walkMin ≤ 5` — kun steder man kan nå til fots innen 5 min
2. Dedup på `enturStopplaceId` — unngår at samme platform vises to ganger
3. `slice(0, 5)` per kategori — maks 5 stopp per transporttype

```ts
const enturStopsByCategory = useMemo(() => {
  const byCategory: Record<string, Array<{poi: POI, walkMin: number}>> = {}
  for (const source of allSources) {
    if (source.walkMin > 5) continue
    const cat = source.poi.category ?? 'other'
    if (!byCategory[cat]) byCategory[cat] = []
    const alreadySeen = byCategory[cat].some(
      s => s.poi.enturStopplaceId === source.poi.enturStopplaceId
    )
    if (!alreadySeen) byCategory[cat].push(source)
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat] = byCategory[cat].slice(0, 5)
  }
  return byCategory
}, [allSources])
```

### 2. `enturIds` inne i `useMemo` (Tech Audit finding)

`enturIds` ble tidligere beregnet utenfor `useMemo` — ny array på hver render — noe som forårsaket at polling-effekten restartet på hvert re-render, selv uten faktiske dataendringer.

```ts
// Før: ny array på hvert render → polling restarter konstant
const enturIds = sources.map(s => s.poi.enturStopplaceId)
useEffect(() => { startPolling(enturIds) }, [enturIds])

// Etter: stabil referanse, kun oppdateres når sources endres
const { enturStopsByCategory, enturIds } = useMemo(() => {
  const enturIds = allSources.map(s => s.poi.enturStopplaceId)
  // ... resten av logikken
  return { enturStopsByCategory, enturIds }
}, [allSources])
```

### 3. `categoryId` som optional field (Tech Audit finding)

For å unngå TypeScript-bruddendring på alle eksisterende `StopDepartures`-konstruksjoner:

```ts
// lib/types.ts
type StopDepartures = {
  stopPlaceId: string
  departures: Departure[]
  categoryId?: string  // optional — ingen eksisterende kode brekker
}
```

Komponenten leser `categoryId` kun der det er relevant (accordion-gruppering per kategori), og degraderer gracefully til flat liste uten det.

### 4. `activeTab` lazy initialization via `useEffect` (Tech Audit finding)

`activeTab` starter som `null`, ikke `activeCategories[0]`. Ved mount er `activeCategories` tom (data ikke lastet ennå), så `activeCategories[0]` er `undefined` → tabs vises blanke.

```ts
// Feil: tab settes til undefined på mount
const [activeTab, setActiveTab] = useState(activeCategories[0])

// Rett: null på mount, sett når data ankommer
const [activeTab, setActiveTab] = useState<string | null>(null)

useEffect(() => {
  if (activeTab === null && activeCategories.length > 0) {
    setActiveTab(activeCategories[0])
  }
}, [activeCategories, activeTab])
```

### 5. Immutable Set toggle (Tech Audit finding)

React gjenkjenner ikke mutasjoner på samme Set-referanse. Toggle-callbacks MÅ returnere ny Set:

```ts
// Feil: React ser ikke endringen
setOpenStops(prev => { prev.delete(id); return prev })

// Rett: alltid ny Set-referanse
setOpenStops(prev =>
  prev.has(id)
    ? (s => { s.delete(id); return s })(new Set(prev))
    : new Set(prev).add(id)
)
```

### 6. Radix Tabs — `data-active` ikke `aria-selected`

Tabs brukes fra `@/components/ui/tabs` (allerede i prosjektet). `TabsTrigger` eksponerer aktiv tilstand via `data-active`, ikke `aria-selected`:

```tsx
<TabsTrigger
  value={catId}
  className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
>
  {label}
</TabsTrigger>
```

Bruk `data-[state=active]:` — ikke `data-[active]:` eller `aria-selected:`.

### 7. `TramFront` ikke `Tram` i lucide-react

`lucide-react` eksporterer ikke `Tram`. Bruk `TramFront`. Verifiser tilgjengelige ikoner uten å åpne nettleser:

```bash
node -e "const l = require('lucide-react'); console.log(['Tram','TramFront','TrainFront'].filter(k=>l[k]))"
# Output: [ 'TramFront', 'TrainFront' ]
```

### 8. Adaptive display logic

Komponentens oppførsel styres av to booleans avledet fra data — ingen ekstern konfigurasjon nødvendig:

```ts
const showTabs = activeCategories.length >= 2
const showAccordion = stops.length >= 2
```

| Kontekst | Tabs | Accordion | Layout |
|----------|------|-----------|--------|
| Forstad (1 stopp, 1 kategori) | Nei | Nei | Flat `DepartureGrid` |
| Mellomting (1 kategori, 2+ stopp) | Nei | Ja | Accordion, ingen tabs |
| Urban (2+ kategorier, 3+ stopp) | Ja | Ja | Tabs + accordion per tab |

Logikken er ren data-drevet: sett med 1 element → ingen tabs, én rad → ingen accordion. Zero-config — fungerer likt for alle prosjekter.

## Deleted code

`DepartureBlock` og `StaticTransportList` ble slettet fra `ReportHeroInsight.tsx` som del av denne endringen. `TransitDashboardCard` erstatter begge. Ingen andre forbrukere fantes.

## Why This Works

1. **Per-kategori gruppering i hooken** holder komponent-laget enkelt — den mottar ferdig strukturert data, ikke rådata som krever lokal gruppering.

2. **Stabil `useMemo`-referanse for `enturIds`** forhindrer phantom polling-restarts. Uten dette kaller `useEffect` `startPolling` på hvert re-render fordi array-referansen alltid er ny, selv om innholdet er identisk.

3. **`activeTab: null` på mount** er korrekt tomtilstand. `useState(someArray[0])` er en vanlig React-feil — array er tom ved mount, verdien er `undefined`, og ingen `useEffect` setter den etterpå fordi verdien teknisk sett "allerede er satt".

4. **Ny Set-referanse i toggle** er den eneste måten React kan oppdage endringer i Set/Map. JavaScript-mutasjon på samme referanse er usynlig for Reacts reconciler.

5. **Adaptive display — ingen konfigurasjonsparameter** betyr at komponenten aldri kan konfigureres feil. En komponent som alltid gjør rett ting basert på data er mer robust enn en med `showTabs={false}` props som kan glemmes.

## Prevention

- **Sjekk alltid `enturIds` / liknende array-derivater:** Er de inne i `useMemo`? Utenfor gir ny referanse per render → `useEffect`-dependencies trigges unødvendig.
- **Tomtilstand for tab-state:** Bruk `null`, ikke `array[0]`. Bruk `useEffect` for å sette initial verdi etter data-load.
- **Set/Map i state:** Alltid `new Set(prev)` / `new Map(prev)` i updater-funksjoner — aldri muter in-place.
- **Lucide-ikoner:** Sjekk alltid om ikonet faktisk finnes før du antar det. Bruk `node -e "..."` check over nettleser-guessing. Ikonene endrer navn mellom versjoner (f.eks. `Tram` → `TramFront`).
- **Radix Tabs aktiv-state:** `data-[state=active]:` for styling — ikke `aria-selected:`, `data-[active]:` eller `data-[selected]:`.

## Related Files

- `lib/hooks/useTransportDashboard.ts` — hook-endringer (per-kategori + stabil enturIds)
- `components/variants/report/blocks/TransitDashboardCard.tsx` — ny komponent
- `components/variants/report/ReportHeroInsight.tsx` — integrasjon + slettet DepartureBlock + StaticTransportList
- `lib/types.ts` — `categoryId?: string` på `StopDepartures`
