# Plan: Report Map Popup Card

**Dato:** 2026-02-13
**Branch:** `feat/report-map-popup-card`
**Brainstorm:** `docs/brainstorms/2026-02-13-report-map-popup-card-brainstorm.md`

---

## Oversikt

Erstatt Report sin accordion-expand i kortlista med en popup-card over markøren i kartet. Endre layout fra 60/40 til 50/50. All detaljert POI-info flyttes til kartet.

## Implementeringssteg

### Steg 1: Layout 60/40 → 50/50

**Fil:** `components/variants/report/ReportPage.tsx`

- [ ] Endre `w-[60%]` → `w-[50%]` på venstre kolonne (content)
- [ ] Endre `w-[40%]` → `w-[50%]` på høyre kolonne (sticky map)
- [ ] Verifiser at featured cards (horisontal scroll) fortsatt fungerer med smalere bredde
- [ ] Verifiser at two-col grid fungerer med smalere bredde

### Steg 2: MapPopupCard komponent

**Ny fil:** `components/variants/report/MapPopupCard.tsx`

- [ ] Opprett `MapPopupCard` komponent med props:
  ```typescript
  interface MapPopupCardProps {
    poi: POI;
    onClose: () => void;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string;
  }
  ```

- [ ] Innhold i kortet (top-to-bottom):
  1. **Header bar:** Lukk-knapp (X) høyre side
  2. **Featured image** (16:9) — fra `featuredImage` eller Google photo proxy, fallback til kategori-ikon
  3. **POI-navn** + kategori + Google rating + reviews
  4. **Editorial hook** (amber highlight boks med Sparkles-ikon) — vises hvis tilgjengelig
  5. **Local insight** — vises hvis tilgjengelig
  6. **Åpningstider** — hentet on-demand fra `/api/places/{googlePlaceId}`
  7. **Action buttons:** "Vis rute" + "Google Maps"

- [ ] Styling:
  - Max-bredde: `max-w-[320px]`
  - Hvit bakgrunn, rounded-xl, shadow-xl, border
  - Pil/arrow nedover som peker mot markør (CSS triangle)
  - `pointer-events: auto` (viktig — standard for Marker children)

- [ ] Data-fetching:
  - Åpningstider: `useEffect` som fetcher `/api/places/${poi.googlePlaceId}` ved mount
  - Bruk samme mønster som ReportPOIRow (fetchedRef for å unngå re-fetch)

### Steg 3: Integrer MapPopupCard i ReportStickyMap

**Fil:** `components/variants/report/ReportStickyMap.tsx`

- [ ] Legg til ny prop: `activePOI: ActivePOIState | null` (allerede tilgjengelig i parent)
- [ ] Finn aktiv POI-data fra `allPOIs` basert på `activePOI.poiId`
- [ ] Render `MapPopupCard` som child av en egen `<Marker>` plassert på aktiv POI sine koordinater
  - Offset: `[0, -50]` (over markøren, ikke oppå)
  - Høyeste z-index (over alle markører)
  - Kun rendret når `activePOI !== null`

- [ ] Klikk på tomt kart lukker popup:
  - Legg til `onClick` handler på `<Map>` som kaller `onMapClick?.()` → setter `activePOI = null`
  - Sjekk at markør-klikk stopper propagation (allerede gjort: `e.originalEvent.stopPropagation()`)

### Steg 4: Fjern accordion-expand fra ReportPOIRow

**Fil:** `components/variants/report/ReportThemeSection.tsx`

- [ ] Fjern expanded state og toggle-logikk fra `ReportPOIRow`
- [ ] Fjern alt expanded content (bilde, editorial, åpningstider, realtime, action buttons)
- [ ] Fjern `useRealtimeData` og `/api/places` fetch fra ReportPOIRow
- [ ] Fjern chevron-ikon (expand/collapse indicator)
- [ ] Behold: kompakt header-visning (thumbnail, navn, kategori, rating, walk time)
- [ ] Gjør hele raden klikkbar → kaller `onPOIClick(poi.id)` (som i dag)
- [ ] Behold `data-poi-id` attributt for scroll-to-card
- [ ] Behold aktiv-state visuell styling (`bg-[#f0ede8] border-[#d4cfc8]`)

### Steg 5: Wire opp state i ReportPage

**Fil:** `components/variants/report/ReportPage.tsx`

- [ ] Pass `activePOI` state til `ReportStickyMap`
- [ ] Legg til `onMapClick` callback som setter `activePOI = null`
- [ ] Verifiser bidireksjonell sync:
  - Klikk kort → `source: "card"` → map flyTo + popup åpnes
  - Klikk markør → `source: "marker"` → scroll til kort + popup åpnes
  - Klikk X på popup → `activePOI = null`
  - Klikk annen markør → bytter popup (allerede håndtert av toggle-logikk)
  - Klikk tomt kart → lukker popup

### Steg 6: Visuell polish og testing

- [ ] Test med Scandic Lerkendal (297 POIs, alle temaer)
- [ ] Verifiser at popup ikke overflower kart-container (spesielt nær kanter)
- [ ] Verifiser at markør-klikk og kort-klikk begge åpner popup korrekt
- [ ] Verifiser at lukking fungerer (X, tomt kart, annen markør)
- [ ] Sjekk at featured cards fortsatt fungerer (horisontal scroll)
- [ ] Sjekk at sub-section switching oppdaterer markører korrekt (som i dag)
- [ ] Screenshot-validering med Chrome DevTools MCP

---

## Filer som endres

| Fil | Endring |
|-----|---------|
| `components/variants/report/ReportPage.tsx` | Layout 50/50, onMapClick, pass activePOI |
| `components/variants/report/ReportStickyMap.tsx` | Render MapPopupCard, onMapClick handler |
| `components/variants/report/ReportThemeSection.tsx` | Fjern accordion-expand fra ReportPOIRow |
| `components/variants/report/MapPopupCard.tsx` | **NY** — popup-card komponent |

## Avhengigheter

- Ingen nye pakker
- Ingen DB-migrasjoner
- Ingen API-endringer
- Gjenbruker eksisterende `/api/places` endpoint for åpningstider

## Risiko

- **Popup nær kartkant:** Kan bli klippet. Mitigering: la Mapbox flyTo sentrere markøren når popup åpnes
- **Smal popup på 320px:** Må teste at editorial hooks og bilder ser bra ut. Mitigering: truncate lange tekster
- **Tap av accordion-info:** Brukere mister realtime transit-data i Report. Akseptabelt — transit er mest relevant i Explorer
