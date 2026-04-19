---
date: 2026-04-16
topic: transit-dashboard-card
---

# TransitDashboardCard — Redesign av kollektivtransport-komponent

## Problemet

Eksisterende `TransportDashboard` (i `ReportHeroInsight.tsx`) henter kun **1 holdeplass** og viser alle
retninger i en flat 2-kolonne-grid. Ved travle knutepunkt (f.eks. Trondheim S) kan dette gi 9+ retninger
som alle vises simultant — kortet blir svært høyt og overveldende.

Rootkausen: `selectTransportSources()` i `useTransportDashboard.ts` gjør `.slice(0, 1)` på sorterte stopp.

## Hva vi bygger

En ny `TransitDashboardCard`-komponent som erstatter det eksisterende `InsightCard`-blokken for kollektiv.

Komponentet skal:
- **Vise inntil 5 stopp per transportkategori** innen 5 min gange
- **Tabs per kategori** (Buss / Trikk / Tog) — kun om 2+ kategorier er tilstede
- **Accordion per holdeplass** — kun om 2+ stopp i aktiv tab, ellers flat visning
- **Alle rader kollapset som standard** — bruker åpner det de er interessert i
- **Fungere i suburban og urban** uten konfigurasjonsendringer

## Tilnærming: To-lags struktur

```
[Buss] [Trikk] [Tog]        ← Tabs (kun om 2+ kategorier)
────────────────────────
▶ Trondheim S      1 min    ← Accordion header (alle lukket)
▶ Prinsens gate    3 min
▶ Kongens gate     5 min
────────────────────────
  ← footer: 3 bussholdeplasser innen 5 min gange
```

Når bruker åpner en rad:
```
▼ Trondheim S      1 min    ← Expanded
  → Stjørdal
    ● 311  om 2 min
    ● 311  om 17 min
  → Lerkendal
    ● R70  om Nå
    ● R70  om 15 min
▶ Prinsens gate    3 min
```

### Suburban-case (1 stopp, 1 kategori)
Ingen tabs, ingen accordion — flat visning av avganger direkte. Minimalt UI-overhead.

### Suburban-case (2-3 stopp, 1 kategori)
Ingen tabs, men accordion per stopp.

### Urban-case (mange stopp, 2-3 kategorier)
Tabs vises. Aktiv tab viser accordion med inntil 5 stopp. Alt kollapset som default.

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|-----------|------|-------------|
| Stopp-grense | 5 per kategori | Rikt urban utvalg, uten å begrense tabs |
| Accordion default | Alle kollapset | Bruker velger selv; kortere card initialt |
| Gangradius | 5 min | Pragmatisk — viser bare nærliggende alternativer |
| Tabs | Kun om 2+ kategorier | Unngår unødvendig chrome i suburban |
| Accordion | Kun om 2+ stopp i tab | Flat ved 1 stopp = enklere UX |
| Accordion-komponent | Custom (chevron + CSS) | Ingen Radix/extern dep. nødvendig |

## Datalag-endringer

**`useTransportDashboard.ts`:**
- `selectTransportSources()`: fjern `slice(0, 1)` — erstatt med filter på walkMin ≤ 5 + slice(0, 5) **per kategori**
- Krever ny `TransportSources`-type: `enturStopsByCategory: Record<string, Array<{poi, walkMin}>>`
- Alle matchede stopp hentes parallelt via `Promise.allSettled` (eksisterende mønster)
- Maks ~15 Entur API-kall per polling-syklus (5 bus + 5 tram + 5 train)

**Ingen Entur API-endringer** — quay-struktur er allerede der.

## Kategorier som støttes

Kun POIs med `enturStopplaceId` og `category.id` i `["bus", "tram", "train"]`. T-bane/metro og ferje
er ikke i vår POI-modell ennå — naturlig utvidelse senere.

Tab-label-mapping:
- `bus` → "Buss"
- `tram` → "Trikk"  
- `train` → "Tog"

## Åpne spørsmål for planleggingsfasen

1. **Performance-budsjettering**: 15 parallelle Entur-kall er greit i dev, men bør vi sette et tak?
   `Promise.allSettled` garanterer at ingen kall blokkerer resten.
2. **Polling-frekvens**: Eksisterende 90s polling er riktig å beholde, men med 15 kall istedenfor 1
   bør vi verifisere at det ikke overflater Entur rate limits.
3. **`StopDepartures`-mapping**: Hook returnerer `stopId` = `enturStopplaceId`. Vi trenger å matche
   dette tilbake til POI's `category.id` for tab-gruppering — POI-lista må følge med ned i komponenten.

## Filer som berøres

| Fil | Endring |
|-----|---------|
| `lib/hooks/useTransportDashboard.ts` | Ny `selectTransportSources` — per-kategori, 5-min radius |
| `components/variants/report/ReportHeroInsight.tsx` | Erstatt `InsightCard`-blokken + slett `DepartureBlock` + `StaticTransportList` |
| `components/variants/report/blocks/TransitDashboardCard.tsx` | Ny fil |

## Neste steg

→ `/workflows:plan` for implementeringsdetaljer
