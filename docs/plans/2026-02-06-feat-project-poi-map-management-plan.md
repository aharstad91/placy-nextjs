# Plan: Prosjekt POI kartvisning og forbedret håndtering

**Dato:** 2026-02-06
**Brainstorm:** `docs/brainstorms/2026-02-06-project-poi-map-management-brainstorm.md`
**Type:** Feature — erstatt flat POI-liste med kart+sidebar i prosjektdetalj

---

## Sammendrag

Erstatt den flate POI-tabellen i prosjektets POI-er-tab med en todelt kart+sidebar-visning. Sidebar viser kategorifiltre med statistikk, og kartet viser prosjektets POI-er som fargekodede markers. Mønsteret gjenbrukes fra `/admin/pois` som allerede fungerer bra.

---

## Filer som endres

| Fil | Endring |
|-----|---------|
| `app/admin/projects/[id]/project-detail-client.tsx` | Omskriv `PoisTab` med kart+sidebar layout |
| `app/admin/projects/[id]/page.tsx` | Utvid `allPois` query med lat/lng/google_rating/categories for kartvisning |

**Ingen nye filer** — alt bygges inne i eksisterende `PoisTab`-komponent.

---

## Implementeringssteg

### Steg 1: Utvid data fra server

**Fil:** `page.tsx`

Nåværende `allPois`-query henter kun `id, name, category_id`. For kartvisningen trenger vi lat, lng, google_rating og categories.

- [ ] Endre `allPois`-query til å hente `id, name, lat, lng, category_id, google_rating, google_place_id, categories(*)`
- [ ] Oppdater `PoisTabProps` interface med utvidet `allPois`-type

### Steg 2: Omskriv PoisTab med kart+sidebar

**Fil:** `project-detail-client.tsx`

Erstatt hele `PoisTab`-funksjonen (linje 615–881) med ny implementering:

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  [Statistikk-bar: 60 POI-er · 14 kategorier]   │
├──────────────┬──────────────────────────────────┤
│  Sidebar     │                                  │
│  ──────────  │         Mapbox kart              │
│  Kategori-   │         med POI-markers          │
│  filtre med  │         fargekodet etter          │
│  antall      │         kategori                  │
│              │                                   │
│  ──────────  │                                   │
│  "Legg til   │                                   │
│   POI"-knapp │                                   │
│              │                                   │
│  ──────────  │                                   │
│  Footer:     │                                   │
│  X/Y vist    │                                   │
├──────────────┴──────────────────────────────────┤
```

**Implementeringsdetaljer:**

- [ ] Legg til `import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/mapbox"` øverst
- [ ] Legg til `useRef`, `useCallback`, `useMemo` imports
- [ ] **State:**
  - `selectedCategories: Set<string>` — standard: alle valgt (ulikt /admin/pois som starter tom)
  - `hoveredPoiId: string | null` — for hover-labels
  - `activePoi: string | null` — for popup ved klikk
  - `isAddModalOpen: boolean` — legg til POI modal
  - `searchQuery: string` — søk i tilgjengelige POI-er (for modal)
- [ ] **Beregninger (useMemo):**
  - `poiCountByCategory` — antall POI-er per kategori
  - `projectCategories` — unike kategorier som finnes i prosjektets POI-er
  - `filteredPois` — prosjektets POI-er filtrert etter valgte kategorier
- [ ] **Layout:** `flex` container med fast høyde `h-[calc(100vh-220px)]` (hensyn til header, tabs, padding)
  - Sidebar: `w-80 flex-shrink-0` med overflow scroll
  - Kart: `flex-1`

### Steg 3: Sidebar — kategorifiltre

- [ ] **Statistikk-header:** Vis "X POI-er i prosjektet · Y kategorier"
- [ ] **Filter-section:** Gjenbruk mønsteret fra `/admin/pois`:
  - "Alle" / "Ingen" toggle-knapper
  - Kategori-chips med farge fra `categories.color` og antall
  - Toggle individuelle kategorier
- [ ] **Footer:** "Viser X av Y POI-er"

### Steg 4: Kartvisning

- [ ] Mapbox kart sentrert på `project.center_lat` / `project.center_lng`
- [ ] Vis kun prosjektets POI-er (`project.project_pois`) som markers
- [ ] Markers fargekodet etter kategori (bruk `categories.color`)
- [ ] Hover → vis POI-navn tooltip (som i `/admin/pois`)
- [ ] Klikk marker → vis popup med:
  - POI-navn, kategori, eventuell Google-rating
  - "Fjern fra prosjekt"-knapp
- [ ] NavigationControl top-right
- [ ] Skjul Mapbox default poi-label og transit-label layers

### Steg 5: Legg til POI fra prosjekt-kontekst

- [ ] "Legg til POI"-knapp i sidebar
- [ ] Åpner forbedret modal med:
  - Søkefelt for å filtrere tilgjengelige POI-er (etter navn)
  - Liste med tilgjengelige POI-er (de som IKKE er i prosjektet), gruppert etter kategori
  - Checkbox per POI for multi-select
  - "Legg til valgte"-knapp
- [ ] Gjenbruk eksisterende `addPoiToProject` server action

### Steg 6: Fjern POI fra popup

- [ ] Klikk marker → popup → "Fjern fra prosjekt"-knapp
- [ ] Gjenbruk eksisterende `removePoiFromProject` server action
- [ ] Bekreftelsesdialog (gjenbruk `ConfirmDialog`)

---

## Tekniske detaljer

### Mapbox-integrasjon
- Gjenbruk nøyaktig samme `react-map-gl/mapbox` pattern som `/admin/pois`
- Token: `process.env.NEXT_PUBLIC_MAPBOX_TOKEN`
- Style: `mapbox://styles/mapbox/streets-v12`
- Initial zoom: 13 (tettere enn global /admin/pois som bruker 12)

### Kategorifarger
POI-markers bruker `categories.color` for å bestemme bakgrunnsfarge. Kategori-chips i sidebar bruker samme farge.

### Høydehåndtering
Taben er inne i prosjektdetaljsiden med header, tabs-navigasjon osv. Kartet trenger en fast høyde:
```tsx
<div className="h-[calc(100vh-220px)] flex rounded-xl overflow-hidden border border-gray-200">
```
220px = ~64px header + ~48px tab-nav + ~60px stats-bar + ~48px padding.

### Data-flow
```
page.tsx (server):
  project.project_pois → POI-er som er i prosjektet (med lat/lng/kategori)
  allPois → Alle globale POI-er (for "legg til"-modal)
  globalCategories → Alle kategorier (for filter + farger)

PoisTab (client):
  filteredPois = project_pois filtrert etter selectedCategories
  availablePois = allPois minus projectPoiIds
```

---

## Hva som IKKE endres

- Server actions (`addPoiToProject`, `removePoiFromProject`) — fungerer som de er
- Andre tabs (Detaljer, Produkter) — ikke påvirket
- Database-skjema — ingen migrasjoner nødvendig
- Global `/admin/pois` — forblir som den er
- Ingen nye npm-pakker — `react-map-gl` er allerede installert

---

## Testkriterer

- [ ] POI-er vises på kart med riktige posisjoner og kategorifarger
- [ ] Kategorifiltre fungerer — viser/skjuler markers
- [ ] Klikk på marker → popup med info + fjern-knapp
- [ ] Fjern POI fra prosjekt → marker forsvinner, statistikk oppdateres
- [ ] Legg til POI → ny marker vises, statistikk oppdateres
- [ ] Kart sentrert på prosjektets senterpunkt
- [ ] Responsivt — fungerer på forskjellige skjermstørrelser
- [ ] Ingen regresjoner i Detaljer- og Produkter-tabs
