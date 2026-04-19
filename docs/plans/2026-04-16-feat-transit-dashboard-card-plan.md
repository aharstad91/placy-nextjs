---
title: "feat: TransitDashboardCard — multi-stopp kollektiv med tabs og accordion"
type: feat
date: 2026-04-16
brainstorm: docs/brainstorms/2026-04-16-transit-dashboard-card-brainstorm.md
---

# feat: TransitDashboardCard — multi-stopp kollektiv med tabs og accordion

## Oversikt

Eksisterende `TransportDashboard` viser kun **1 holdeplass** og dumper alle retninger i en flat
2-kolonne-grid. Ved travle knutepunkt (Trondheim S: 9+ retninger) blir kortet svært høyt.

Vi erstatter det med en ny `TransitDashboardCard` som:
- Viser **opptil 5 stopp per transportkategori** innen 5 min gange
- Har **tabs** (Buss / Trikk / Tog) — kun om 2+ kategorier er tilstede
- Har **accordion per holdeplass** — kun om 2+ stopp i aktiv tab
- Starter med **alle rader kollapset** — bruker åpner det de er interessert i
- Fungerer identisk i suburban (1 stopp, ingen tabs) og urban (mange stopp, alle tabs)

## Filer som berøres

| Fil | Type endring |
|-----|-------------|
| `lib/hooks/useTransportDashboard.ts` | Refaktor: `selectTransportSources` + nytt `categoryId`-felt |
| `components/variants/report/blocks/TransitDashboardCard.tsx` | Ny fil |
| `components/variants/report/ReportHeroInsight.tsx` | Erstatt InsightCard-blokk, slett DepartureBlock + StaticTransportList |

---

## Fase 1 — Hook: `useTransportDashboard.ts`

### 1.1 Oppdater `StopDepartures`-interface

Legg til `categoryId` felt (linje 14–22):

```typescript
// lib/hooks/useTransportDashboard.ts
export interface StopDepartures {
  stopName: string;
  stopId: string;
  walkMin: number;
  categoryId?: string;         // ← NYTT: "bus" | "tram" | "train" (optional for backward compat)
  quays: QuayDepartures[];
  departures: EnturDeparture[];
}
```

> **Tech Audit:** `categoryId` er **optional** (`?`) — konstruksjonsstedet i `poll()` setter det korrekt,
> men optional unngår TypeScript-brudd på eksisterende kode som ikke setter feltet.

### 1.2 Oppdater `TransportSources`-interface

Erstatt `enturStops: Array<...>` med per-kategori-gruppering (linje 156–161):

```typescript
// Erstatter eksisterende TransportSources
interface TransportSources {
  /** Stopp gruppert per kategori — maks 5 per kategori, walkMin ≤ 5 */
  enturStopsByCategory: Record<string, Array<{ poi: POI; walkMin: number }>>;
  hyreStation: { poi: POI; walkMin: number } | null;
}
```

### 1.3 Skriv om `selectTransportSources` (linje 163–175)

```typescript
function selectTransportSources(pois: POI[], center: Coordinates): TransportSources {
  const WALK_RADIUS = 5; // min
  const MAX_PER_CATEGORY = 5;
  const TRANSIT_CATS = ["bus", "tram", "train"] as const;

  const sorted = [...pois]
    .map((poi) => ({ poi, walkMin: estimateWalkMin(poi, center) }))
    .filter((s) => s.walkMin <= WALK_RADIUS)
    .sort((a, b) => a.walkMin - b.walkMin);

  // Grupper per kategori, dedupliser på enturStopplaceId
  const enturStopsByCategory: TransportSources["enturStopsByCategory"] = {};
  for (const cat of TRANSIT_CATS) {
    const seen = new Set<string>();
    enturStopsByCategory[cat] = sorted
      .filter((s) => s.poi.category.id === cat && s.poi.enturStopplaceId)
      .filter((s) => {
        if (seen.has(s.poi.enturStopplaceId!)) return false;
        seen.add(s.poi.enturStopplaceId!);
        return true;
      })
      .slice(0, MAX_PER_CATEGORY);
  }

  const hyreStation =
    sorted.find((s) => s.poi.hyreStationId) ?? null;

  return { enturStopsByCategory, hyreStation };
}
```

### 1.4 Oppdater `enturIds`-dep-nøkkel og polling-løkke

Dep-nøkkel — flytt **inn i** `useMemo` sammen med `sources` for å unngå phantom polling-restarter:
```typescript
// Erstatter eksisterende sources + enturIds + hyreId (linje 183–199)
const { sources, enturIds, hyreId } = useMemo(() => {
  const s = selectTransportSources(pois, center);
  const allStops = Object.values(s.enturStopsByCategory).flat();
  return {
    sources: s,
    enturIds: allStops.map((st) => st.poi.enturStopplaceId).join(","),
    hyreId: s.hyreStation?.poi.hyreStationId ?? "",
  };
}, [pois, center]);
```

> **Tech Audit:** `enturIds` utenfor `useMemo` lager ny streng ved memo-miss → restarter polling-intervallet.
> Inni `useMemo` er dep-nøkkelen stabil by construction.

Polling-løkke — erstatt Entur-fetch-blokken (linje 219–231):
```typescript
// Alle stopp på tvers av kategorier
const allStops = Object.entries(s.enturStopsByCategory).flatMap(
  ([catId, stops]) => stops.map((stop) => ({ ...stop, catId }))
);
for (const stop of allStops) {
  if (stop.poi.enturStopplaceId) {
    promises.push(
      fetchDepartures(stop.poi.enturStopplaceId, controller.signal).then((r) => ({
        type: "entur" as const,
        stopId: stop.poi.enturStopplaceId!,
        categoryId: stop.catId,           // ← sendes med
        walkMin: stop.walkMin,
        ...r,
      })),
    );
  }
}
```

Aggregering — oppdater `departures.push(...)` (linje 284–289):
```typescript
if (val.type === "entur") {
  departures.push({
    stopName: val.stopName as string,
    stopId: val.stopId as string,
    walkMin: val.walkMin as number,
    categoryId: val.categoryId as string,  // ← nytt felt
    quays: val.quays as QuayDepartures[],
    departures: val.departures as EnturDeparture[],
  });
}
```

---

## Fase 2 — Ny komponent: `TransitDashboardCard.tsx`

**Fil:** `components/variants/report/blocks/TransitDashboardCard.tsx`

### Komponent-interface

```typescript
interface TransitDashboardCardProps {
  stops: StopDepartures[];
  loading: boolean;
  lastUpdated: Date | null;
  transitCount: number;
}
```

### Intern logikk

```
grouped = group stops by categoryId
activeCategories = CATEGORY_ORDER.filter(cat => grouped[cat]?.length > 0)
showTabs = activeCategories.length >= 2

// activeTab starter som null — settes av useEffect når data ankommer
// Forhindrer race condition der tabs forblir blanke
useEffect: if (!activeTab && activeCategories.length > 0) → setActiveTab(activeCategories[0].id)

resolvedTab = activeTab ?? activeCategories[0]?.id
currentStops = grouped[resolvedTab] ?? []
showAccordion = currentStops.length >= 2
```

> **Tech Audit:** Initialiser `activeTab` som `null`, ikke fra `activeCategories[0]` direkte.
> `stops` starter som `[]` → `activeCategories[0]` er `undefined` på mount → tab forblir blank.
> `useEffect`-mønsteret setter tab trygt når data ankommer.

### Kategori-rekkefølge og labels

```typescript
const CATEGORIES = [
  { id: "train", label: "Tog",   Icon: Train },
  { id: "tram",  label: "Trikk", Icon: TrainFront },
  { id: "bus",   label: "Buss",  Icon: Bus },
] as const;
```

> **Obs:** `Tram` finnes ikke i denne versjonen av lucide-react — bruk `TrainFront` for trikk.
> Kontroller med `node -e "require('lucide-react').TramFront"` — bruk `TramFront` om tilgjengelig.

### Visningslogikk per case

| Kategorier | Stopp i tab | Visning |
|-----------|-------------|---------|
| 1 | 1 | Ingen tabs, ingen accordion — flat avgangsliste |
| 1 | 2–5 | Ingen tabs, accordion per stopp |
| 2–3 | 1 | Tabs, flat avgangsliste |
| 2–3 | 2–5 | Tabs, accordion per stopp |

### Tabs

Bruk Radix `Tabs`-komponent fra `@/components/ui/tabs`:
```tsx
<Tabs value={resolvedTab} onValueChange={setActiveTab}>
  <TabsList>
    {activeCategories.map(cat => (
      <TabsTrigger key={cat.id} value={cat.id}>
        <CatIcon className="w-3.5 h-3.5" />
        {cat.label}
        <span className="text-xs opacity-60 ml-1">{grouped[cat.id].length}</span>
      </TabsTrigger>
    ))}
  </TabsList>
  {activeCategories.map(cat => (
    <TabsContent key={cat.id} value={cat.id}>
      <StopList stops={grouped[cat.id]} showAccordion={grouped[cat.id].length >= 2} />
    </TabsContent>
  ))}
</Tabs>
```

### Accordion per stopp

**Custom accordion** — ingen ny dep. State: `openStops: Set<string>`.

> **Tech Audit + mønster:** `Set` i React state er etablert i `ReportInteractiveMapSection.tsx:37`.
> Bruk alltid `new Set(prev)` for toggle — aldri muter eksisterende Set, da React ikke oppdager endringen:
> ```typescript
> // Toggle-hjelpefunksjon (navngi den for lesbarhet):
> const toggleStop = (stopId: string) =>
>   setOpenStops(prev =>
>     prev.has(stopId)
>       ? (prev => { const s = new Set(prev); s.delete(stopId); return s; })(prev)
>       : new Set(prev).add(stopId)
>   );
> ```

```tsx
function StopAccordionRow({ stop, isOpen, onToggle }) {
  return (
    <div className="border-b border-[#f0ede8] last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-3 text-left"
      >
        <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 truncate">
          {stop.stopName}
        </span>
        <span className="text-sm text-[#8a8a8a] shrink-0">{stop.walkMin} min</span>
        <ChevronDown
          className={`w-4 h-4 text-[#a0937d] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="pb-3">
          <DepartureGrid stop={stop} />
        </div>
      )}
    </div>
  );
}
```

### Flat visning (1 stopp i tab)

Vis stopnavn/link + `DepartureGrid` direkte — ingen accordion-overhead.

### `DepartureGrid` — intern helper

Trekk ut logikken fra eksisterende `DepartureBlock` (linje 752–847):
- `hasQuays` → 2-kolonne quay-grid
- Fallback → flat liste
- Bruker `formatRelativeDepartureTime` fra `@/lib/utils/format-time`

### Skeleton og tomstater

```tsx
// Loading: stops.length === 0 && loading
<div className="space-y-3 animate-pulse">...</div>

// Tom: stops.length === 0 && !loading
<div className="text-sm text-[#a0a0a0]">Ingen kollektivtransport i nærheten</div>
```

### Footer

```tsx
{transitCount > 0 && (
  <div className="mt-3 pt-3 border-t border-[#eae6e1] text-sm text-[#8a8a8a]">
    {transitCount} holdeplasser innen 5 min gange
  </div>
)}
```

---

## Fase 3 — Integrasjon: `ReportHeroInsight.tsx`

### 3.1 Legg til import

```typescript
import TransitDashboardCard from "./blocks/TransitDashboardCard";
```

### 3.2 Erstatt InsightCard-blokken (linje 510–552)

Fjern hele `<InsightCard title="Nærmeste bussholdeplass" ...>...</InsightCard>`-blokken.

Erstatt med:
```tsx
<TransitDashboardCard
  stops={dashboard.departures}
  loading={dashboard.loading}
  lastUpdated={dashboard.lastUpdated}
  transitCount={transitStops}
/>
```

### 3.3 Slett dead code

- Slett `DepartureBlock`-funksjonen (linje 764–853) komplett
- Slett `StaticTransportList`-funksjonen (linje 857–903) komplett
- Fjern ubrukte imports:
  - `StopDepartures` fra `useTransportDashboard`
  - `formatRelativeDepartureTime` fra `format-time`

---

## Akseptansekriterier

### Funksjonelle

- [ ] **TC-01 — Urban, multiple kategorier**: Rapport-siden for Stasjonskvartalet viser tabs (Buss/Trikk/Tog) om 2+ kategorier har stopp innen 5 min
- [ ] **TC-02 — Accordion kollapset**: Alle accordion-rader starter kollapset; ingen avganger vises før bruker klikker
- [ ] **TC-03 — Accordion expand**: Klikk på en rad ekspanderer den og viser quay-grupperte avganger med linjenummer og tid
- [ ] **TC-04 — Flat visning (1 stopp)**: Hvis kun 1 stopp i aktiv tab vises avgangene direkte uten accordion-header
- [ ] **TC-05 — Ingen tabs (1 kategori)**: Suburban-scenario med kun buss viser ingen tab-navigasjon
- [ ] **TC-06 — Maks 5 stopp per tab**: Maksimalt 5 holdeplasser vises per kategori-tab
- [ ] **TC-07 — Loading skeleton**: Skjelettlasting vises mens hook henter data første gang
- [ ] **TC-08 — MobilityStackCards uberørt**: Bysykkel/sparkesykkel/bildeling-kortene under vises som før

### Tekniske

- [ ] `npx tsc --noEmit` — 0 feil
- [ ] `npm run lint` — 0 feil
- [ ] `DepartureBlock` og `StaticTransportList` finnes ikke lenger i `ReportHeroInsight.tsx`
- [ ] `StopDepartures.categoryId` er satt på alle departures returnert av hooken

---

## Edge Cases (fra SpecFlow-analyse)

### Feilhåndtering og tomstater

| Situasjon | Oppførsel |
|-----------|-----------|
| Entur API-kall feiler for ett stopp | Stoppet vises ikke (Promise.allSettled = stille feil). Ingen feilmelding. |
| Stopp har 0 avganger | Stoppet vises i accordion, men innholdet viser "Ingen avganger" |
| Ingen stopp funnet totalt | Tekst: "Ingen kollektivtransport innen 5 min gange" |
| Loading, ingen data ennå | Skeleton (2 rader animate-pulse) |

### Tab-bytte og accordion-state

Accordion-state (`openStops: Set<string>`) er **global** — persists på tvers av tab-bytte.
Bruker som har åpnet "Trondheim S" under Buss og så bytter til Tog og tilbake, finner raden fortsatt åpen.

### Flat visning — hva er "flat"?

Flat visning (1 stopp i tab) betyr: quay-grupperte avganger vises **direkte** uten accordion-wrapper.
Fortsatt gruppert per retning (quay), men stopnavn + tid vises uten collapsible header.

### Tilgjengelighet

- **Accordion-knapper**: `aria-expanded={isOpen}` på hver `<button>`
- **Tabs**: Radix `Tabs`-komponenten håndterer `role="tablist"`, `role="tab"`, `aria-selected`, og tastaturnavigasjon automatisk
- Accordion-knapper responderer på Enter og Space (native `<button>`)

### Foreldede avganger

Hooken poller hvert 90. sekund. `lastUpdated`-timestamp vises i header ("oppdatert kl HH:MM").
Ingen ytterligere staleness-indikator nødvendig — eksisterende atferd er uendret.

---

## Tekniske notater

### Lucide-ikon for trikk
Sjekk tilgjengelig ikon FØR implementering:
```bash
node -e "const l = require('lucide-react'); console.log(['Tram','TramFront','TrainFront'].filter(k => l[k]))"
```
Bruk første tilgjengelige. Fallback: `Bus`-ikonet for alle kategorier hvis trikk-spesifikt ikke finnes.

### Entur rate limits
API cacher 30s server-side (`revalidate: 30`). 15 kall per 90s polling-syklus = ~30 kall/min totalt. Trygt innenfor rimelig bruk av Entur JourneyPlanner.

### `enturIds` dep-nøkkel
Hooken bruker `enturIds` som effect-dependency. Med nye struktur:
```typescript
const allEnturStops = Object.values(sources.enturStopsByCategory).flat();
const enturIds = allEnturStops.map((s) => s.poi.enturStopplaceId).join(",");
```
Uendret streng = ingen re-fetch. Korrekt.

### Ingen `hasLiveData`-variabel
Den eksisterende `hasLiveData`-variabelen i `TransportDashboard` slettes. `TransitDashboardCard` håndterer alle tilstander internt (loading, empty, data).

### Tabs-komponent
Bruk `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` fra `@/components/ui/tabs`. Radix-basert, tilgjengelig, konsistent med resten av prosjektet.

### Dynamisk stil
Kategorifarger (om brukt) MÅ bruke `style={{ color: ... }}` — ikke Tailwind arbitrary values. Se learnings: `docs/solutions/ui-patterns/spoersmaalskort-report-hero-redesign-20260303.md`.

---

## Implementeringsrekkefølge

```
Fase 1: Hook (useTransportDashboard.ts)
  → Interface + selectTransportSources + polling-loop + aggregering
  → Verifiser: console.log departures i dev tools, sjekk categoryId er satt

Fase 2: Ny komponent (TransitDashboardCard.tsx)
  → DepartureGrid (fra DepartureBlock-logikk)
  → StopAccordionRow
  → CategoryStopList (flat vs accordion)
  → Hoved-komponent med tabs og states

Fase 3: Integrasjon (ReportHeroInsight.tsx)
  → Erstatt InsightCard
  → Slett DepartureBlock + StaticTransportList
  → Fjern ubrukte imports

Fase 4: Verifisering
  → npx tsc --noEmit
  → npm run lint
  → Manuell sjekk på localhost:3000/eiendom/banenor-eiendom/stasjonskvartalet/rapport
  → Test alle TC-01 til TC-08
```

---

## Referanser

- Brainstorm: `docs/brainstorms/2026-04-16-transit-dashboard-card-brainstorm.md`
- Entur quay-mønster: `docs/solutions/integration-issues/entur-quay-direction-grouping-Report-20260410.md`
- Transport API-arkitektur: `docs/solutions/architecture-patterns/entur-mobility-v2-universal-transport-api-20260410.md`
- Hook som endres: `lib/hooks/useTransportDashboard.ts:163` (selectTransportSources)
- Komponent som endres: `components/variants/report/ReportHeroInsight.tsx:496` (TransportDashboard)
- Tabs UI: `components/ui/tabs.tsx`
- Tidformat-util: `lib/utils/format-time.ts`
