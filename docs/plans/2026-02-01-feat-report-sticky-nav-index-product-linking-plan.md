---
title: "feat: Report sticky nav, theme index & product deep-linking"
type: feat
date: 2026-02-01
brainstorm: docs/brainstorms/2026-02-01-report-nav-index-product-linking-brainstorm.md
---

# Report: Sticky Nav, Theme Index & Product Deep-Linking

## Overview

Report er hub-produktet som syr sammen Explorer, Guide og Report. Denne planen legger til tre sammenkoblede features:

1. **Sticky produktnav** — felles nav på tvers av alle produkter med pill-toggle
2. **Tema-index tags** — klikkbare tags under hero-ingressen som smooth-scroller til seksjoner
3. **POI deep-linking** — klikk på POI-kort i Report åpner Explorer med fokusert POI og kategorifilter

## Problem Statement / Motivation

I dag er Report en isolert artikkelside uten navigasjon til andre produkter. POI-kort lenker ut til Google Maps i stedet for å drive trafikk internt. Det finnes ingen måte for brukeren å forstå at Explorer og Guide eksisterer for samme lokasjon. Dette begrenser engasjement, tid på plattformen, og affiliate-konvertering.

## Proposed Solution

### Phase 1: Shared Sticky Product Nav

**Ny komponent:** `components/shared/ProductNav.tsx`

```
┌──────────────────────────────────────────────────────────┐
│  Quality Hotel Augustin    [ Explore | Guides | Report ]  🔗 │
└──────────────────────────────────────────────────────────┘
```

- **Venstre:** `project.name` som tekst
- **Midten:** Pill-toggle med tre produkter. Aktiv tab uthevet. Tabs uten tilgjengelig produkt skjules.
- **Høyre:** Share-knapp (`navigator.share()` med clipboard fallback)
- **Plassering:** Alltid synlig, `fixed top-0`, `z-50`
- **Design:** `bg-[#faf9f7]/95 backdrop-blur-sm border-b border-[#e8e4df]` (matcher Report-paletten)

**Produktkobling (for nå):** Hardkodet URL-mønster. Gitt et Report-prosjekt med slug `quality-hotel-augustin`:
- Explorer: `/{customer}/quality-hotel-augustin-explore`
- Guide: `/{customer}/quality-hotel-augustin-guide`
- Report: `/{customer}/quality-hotel-augustin` (nåværende)

Nav-komponenten sjekker om sibling-URLer faktisk eksisterer (server-side i layout) og skjuler tabs som ikke har et prosjekt.

**Insersjonssted:** `app/[customer]/[project]/layout.tsx` — layout wrapperen som omgir alle produktvarianter. Layout må hente prosjektdata for å vite produkttype og bygge sibling-URLer.

**Explorer-spesifikk håndtering:** Explorer bruker `h-screen overflow-hidden`. Sticky nav over Explorer krever at ExplorerPage får `pt-[nav-height]` og at `h-screen` justeres til `h-[calc(100vh-nav-height)]`.

### Phase 2: Theme Index Tags

**Ny komponent:** `components/variants/report/ReportThemeIndex.tsx`

Plasseres i `ReportPage.tsx` mellom `ReportHero` og første `ReportThemeSection`.

```
[ 🍽 Spis & Drikk (13) ]  [ 🚌 Transport (6) ]  [ 🛒 Daglig (4) ]  [ 🏋️ Aktivitet (5) ]
```

- Horisontalt scrollbar rad med `overflow-x-auto` på mobil, wrapping på desktop
- Hver tag er en pill med Lucide-ikon, temanavn, og `(totalPOIs)` count
- Klikk → `document.getElementById(theme.id).scrollIntoView({ behavior: 'smooth' })`
- Tags rendres kun for temaer som vises (≥3 POI-er, filtrert av `transformToReportData`)

**Krever endring i `ReportThemeSection.tsx`:**
- Legg til `id={theme.id}` på `<section>`-elementet (linje 46)
- Legg til `scroll-margin-top: [nav-height + padding]` for å kompensere for sticky nav

### Phase 3: POI Deep-Linking til Explorer

**Endring i Report-komponenter:**

`ReportHighlightCard.tsx`:
- Endre fra wrapping `<a href={googleMapsUrl}>` til `<Link href={explorerDeepLink}>`
- Legg til sekundær Google Maps-ikon (`<a href={googleMapsUrl} target="_blank" onClick={e => e.stopPropagation()}>`)
- Deep-link format: `/{customer}/{explorer-slug}?poi={poi.id}&categories={theme.categories.join(',')}`

`ReportCompactList.tsx`:
- Samme endring: primærklikk → Explorer deep-link, sekundær Google Maps-ikon
- Trenger `themeCategories` prop for å bygge `?categories=` param

**Nye props som må threads gjennom:**
- `explorerBaseUrl: string | null` — fra ReportPage → ReportThemeSection → ReportHighlightCard/ReportCompactList
- `themeCategories: string[]` — allerede tilgjengelig i theme-dataen
- Hvis `explorerBaseUrl` er null (ingen Explorer-prosjekt), faller tilbake til Google Maps-lenke

**Endring i Explorer for å lese query params:**

`app/[customer]/[project]/page.tsx`:
- Les `?poi=` og `?categories=` fra `searchParams` (allerede awaited)
- Pass som props til `ExplorerPage`: `initialPOI?: string`, `initialCategories?: string[]`

`ExplorerPage.tsx`:
- Initialiser `activePOI` fra `initialPOI` prop: `useState<string | null>(initialPOI ?? null)`
- Initialiser `activeCategories` fra `initialCategories` prop: `useState(() => initialCategories ? new Set(initialCategories) : new Set(allCategoryIds))`
- Eksisterende `useEffect` for map fly-to og list scroll reagerer allerede på `activePOI`

### Phase 4: Scroll-preservering

**Mekanisme:** `sessionStorage` nøklet på prosjekt-URL.

- Før navigasjon bort fra Report: lagre `window.scrollY` i `sessionStorage[url]`
- Ved mount av Report: sjekk `sessionStorage[url]` og restore scroll
- Browser back-knapp: nettleserens native `scrollRestoration` håndterer dette automatisk via bfcache
- Sticky nav "Report"-tab fra Explorer: bruker `sessionStorage`-verdien

**Implementering:** En `useScrollRestore` hook i Report som:
1. Ved mount: leser og restorer fra sessionStorage
2. Ved unmount/navigasjon: lagrer nåværende scrollY

## Technical Considerations

### Filer som endres

| Fil | Endring |
|---|---|
| `app/[customer]/[project]/layout.tsx` | Hente prosjektdata, rendre ProductNav, wrappe children med padding-top |
| `components/shared/ProductNav.tsx` | **NY** — shared sticky nav komponent |
| `components/variants/report/ReportPage.tsx` | Legge til ReportThemeIndex, threade explorerBaseUrl |
| `components/variants/report/ReportThemeIndex.tsx` | **NY** — tema-tags komponent |
| `components/variants/report/ReportThemeSection.tsx` | Legge til `id={theme.id}` og `scroll-margin-top`, threade props |
| `components/variants/report/ReportHighlightCard.tsx` | Endre klikkmål til Explorer deep-link, sekundær Google Maps-ikon |
| `components/variants/report/ReportCompactList.tsx` | Endre klikkmål til Explorer deep-link, sekundær Google Maps-ikon |
| `app/[customer]/[project]/page.tsx` | Les og pass `?poi=` og `?categories=` til ExplorerPage |
| `components/variants/explorer/ExplorerPage.tsx` | Motta `initialPOI` og `initialCategories` props, initialiser state |
| `components/variants/portrait/PortraitPage.tsx` | Fjerne intern sticky header (erstattes av shared ProductNav) |
| `lib/supabase/queries.ts` | Legg til helper for å sjekke om sibling-prosjekter eksisterer |

### Arkitektur-implikasjoner

- **Layout data-fetching:** `layout.tsx` må kalle `getProjectAsync` for å vite produkttype og bygge nav. Dette er en duplikat-fetch, men Next.js dedupliserer automatisk via request memoization.
- **Explorer sizing:** ExplorerPage sin `h-screen` må justeres til `h-[calc(100vh-var(--nav-height))]` med CSS custom property.
- **SSR/hydration:** ProductNav kan være en server component som mottar data fra layout. Pill-toggle og share-knapp trenger client-side interaktivitet — bruk en client component for interaktive deler.

### Performance

- Ingen nye API-kall (sibling-sjekk gjøres server-side i layout med en enkel Supabase query)
- Smooth-scroll er native browser API — ingen tredjepart
- `sessionStorage` er synkront og minimalt

## Acceptance Criteria

### Sticky Product Nav
- [x] Nav er alltid synlig øverst på Report, Explorer, og Portrait
- [x] Prosjektnavn vises til venstre
- [x] Pill-toggle viser Explore/Guides/Report med aktiv tab markert
- [x] Tabs uten tilgjengelig prosjekt er skjult
- [x] Share-knapp kopierer URL til clipboard (med native share på mobile)
- [x] Nav fungerer på mobil (komprimert layout, responsiv)

### Theme Index Tags
- [x] Tags rendres under hero-ingress, over første temaseksjon
- [x] Hver tag viser ikon, temanavn, og POI-count
- [x] Klikk smooth-scroller til korrekt seksjon
- [x] Scroll-offset kompenserer for sticky nav-høyde
- [x] Horisontalt scrollbar på mobil hvis tags overflower

### POI Deep-Linking
- [x] Klikk på highlight-kort navigerer til Explorer med `?poi=` og `?categories=`
- [x] Klikk på compact-liste-rad navigerer til Explorer med `?poi=` og `?categories=`
- [x] Google Maps-lenke beholdes som sekundær ikon
- [x] Explorer åpner med riktig POI fokusert (kort åpent, kart sentrert)
- [x] Explorer åpner med riktig kategorifilter aktivt
- [x] Hvis Explorer-prosjekt ikke finnes, faller POI-lenke tilbake til Google Maps

### Scroll-preservering
- [ ] Browser back-knapp fra Explorer restorer scroll-posisjon i Report
- [ ] "Report"-tab i sticky nav fra Explorer restorer scroll-posisjon
- [ ] Scroll-posisjon lagres per prosjekt-URL i sessionStorage

## Dependencies & Risks

| Risk | Mitigering |
|---|---|
| Explorer-prosjekt eksisterer ikke for et Report-prosjekt | Graceful fallback: skjul Explorer-tab, POI-lenker faller tilbake til Google Maps |
| Hardkodet URL-mønster er skjørt | Dokumenter konvensjonen, valider server-side at prosjekt eksisterer |
| Layout data-fetching dupliserer page.tsx | Next.js request memoization dedupliserer automatisk |
| Explorer `h-screen` kolliderer med sticky nav | CSS custom property `--nav-height` med `calc()` |
| POI-IDer matcher ikke mellom prosjekter | POI-er deles via Supabase `pois`-tabellen — IDer er konsistente |

## References & Research

### Internal References
- Portrait sticky header: `components/variants/portrait/PortraitPage.tsx:16-60`
- URL param pattern: `app/admin/pois/poi-admin-client.tsx:59-85`
- Collection param handling: `app/[customer]/[project]/page.tsx:34-49`
- Explorer POI focus: `components/variants/explorer/ExplorerPage.tsx:39,185-194`
- Explorer category filtering: `components/variants/explorer/ExplorerPage.tsx:41-43,110-112`
- Explorer map fly-to: `components/variants/explorer/ExplorerMap.tsx:94-105`
- Report theme data: `components/variants/report/report-data.ts:57-160`

### Brainstorm
- `docs/brainstorms/2026-02-01-report-nav-index-product-linking-brainstorm.md`
