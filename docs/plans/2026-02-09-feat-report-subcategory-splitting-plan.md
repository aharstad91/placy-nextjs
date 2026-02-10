# Plan: Report Sub-kategori Splitting

**Brainstorm:** `docs/brainstorms/2026-02-09-report-subcategory-splitting-brainstorm.md`
**Dato:** 2026-02-09
**Branch:** `feat/trips-samleside-redesign` (eksisterende branch)
**Tech audit:** Utført — RED-funn mitigert (scroll-tracking), YELLOW-funn adressert

## Oversikt

Når en sub-kategori (f.eks. "restaurant") innad i et tema har >15 POI-er, brytes den automatisk ut som en nestet sub-seksjon under foreldre-temaet. Splitting skjer runtime i `transformToReportData`.

## Arkitekturbeslutninger (fra tech audit)

1. **To separate props, ikke composite IDs:** `ReportStickyMap` mottar `activeThemeId` + `activeSubSectionCategoryId` (nullable). Ingen string-parsing.
2. **Sub-seksjoner som separate observerte regioner:** I stedet for å neste sub-seksjoner inne i tema-`<section>`, rendres de som separate elementer registrert i `useActiveSection`. Tema-headeren beholder sin `<section id={themeId}>`, men sub-seksjoner får `<div id={themeId:catId}>`.
3. **Mobil: Ingen sub-seksjoner.** Mobil bruker `ReportInteractiveMapSection` som allerede har tilgang til `theme.allPOIs`. Ingen endring nødvendig — `allPOIs` inneholder fortsatt alle POI-er.
4. **`theme.stats` reflekterer ALLE POI-er** (inkludert de i sub-seksjoner). Hero-kort og tema-header viser totaltall.
5. **`expandedThemes`-sett:** Utvides til å tracke sub-seksjoner med composite key `themeId:categoryId`.

## Implementeringssteg

### Steg 1: Utvid datamodellen i `report-data.ts`

**Fil:** `components/variants/report/report-data.ts`

- [x] Legg til `ReportSubSection` interface:
  ```ts
  export interface ReportSubSection {
    categoryId: string;
    name: string;
    icon: string;
    color: string;
    stats: ReportThemeStats;
    highlightPOIs: POI[];
    listPOIs: POI[];
    hiddenPOIs: POI[];
    allPOIs: POI[];
    displayMode: ThemeDisplayMode;
    quote: string;
  }
  ```
- [x] Utvid `ReportTheme` med:
  ```ts
  subSections?: ReportSubSection[];
  ```
- [x] Legg til terskel-konstant: `const SUB_SECTION_THRESHOLD = 15;`
- [x] `theme.highlightPOIs`/`listPOIs`/`hiddenPOIs` settes fra **alle** tema-POI-er (som nå) — sub-seksjoner har sine egne lister i tillegg. `theme.allPOIs` bevares uendret.

**Referansefiler:** Eksisterende `ReportTheme` interface (linje 41-56), `INITIAL_VISIBLE_COUNT` (linje 86)

### Steg 2: Implementer splitting-logikk i `transformToReportData`

**Fil:** `components/variants/report/report-data.ts`

- [x] Etter at eksisterende highlight/list/hidden splitting er ferdig (linje 154-179), legg til sub-seksjon-logikk:
  ```
  For hvert tema med sorterte POI-er:
    1. Grupper POI-er per poi.category.id → Map<categoryId, POI[]>
    2. Sjekk om noen kategori har > SUB_SECTION_THRESHOLD POI-er
    3. Hvis ja: Bygg ReportSubSection[] for store kategorier
       - Hver sub-seksjon får egne highlightPOIs (top 3 by rating), listPOIs (6), hiddenPOIs
       - Stats beregnes per sub-seksjon
       - quote via generateCategoryQuote(categoryId, ...)
    4. Sorter sub-seksjoner etter antall POI-er (flest først)
    5. Tema-nivå lister (highlightPOIs, listPOIs, hiddenPOIs) BEHOLDES som nå
       (de brukes av mobil-visning og som fallback)
  ```
- [x] Arv `displayMode` fra foreldre-tema via `CATEGORY_DISPLAY_MODE[themeDef.id]`

**Referansefiler:** Eksisterende splitting-logikk (linje 154-179), `calculateCategoryScore` og `generateCategoryQuote` fra `lib/utils/category-score.ts`

### Steg 3: Legg til quote-templates for sub-kategorier

**Fil:** `lib/utils/category-score.ts`

- [x] Fiks eksisterende QUOTE_TEMPLATES nøkler til å matche tema-IDer:
  - `food` → `mat-drikke`
  - `culture` → `kultur-opplevelser`
  - `services` + `shopping` → `hverdagsbehov`
  - `fitness` → `trening-velvare`
  - `transport` → `transport` (allerede korrekt)
- [x] Legg til templates for sub-kategori-nivå quotes:
  ```ts
  restaurant: {
    exceptional: ["Matmekka — mangfoldig restaurantscene"],
    very_good: ["Rikt restaurantutvalg i gangavstand"],
    good: ["Godt utvalg av restauranter"],
    sufficient: ["Noen restauranter i nærheten"],
    limited: ["Begrenset restauranttilbud"],
  },
  cafe: { ... },
  bar: { ... },
  supermarket: { ... },
  shopping: { ... },
  bus: { ... },
  ```

### Steg 4: Render sub-seksjoner i `ReportThemeSection.tsx`

**Fil:** `components/variants/report/ReportThemeSection.tsx`

- [x] I `StickyMapContent` — sjekk om `theme.subSections` finnes og har entries:
  - Hvis ja: Render hver sub-seksjon med:
    - Eget `<div>` med `id={themeId:categoryId}` og `ref={registerRef(themeId:categoryId)}`
    - Sub-header (h3) med kategori-ikon, navn, stats og quote
    - Egen `CompactPOIList`
    - Egen "Hent flere"-knapp
  - Render POI-er fra kategorier under terskel samlet etter sub-seksjonene (uten sub-header)
  - Hvis nei: Render som i dag (ingen endring)
- [x] Sub-seksjon header-design — visuelt nestet under tema:
  ```
  [Kategori-ikon i farget sirkel] Restauranter
  42 steder  |  Snitt ⭐ 4.2  |  18 420 anmeldelser
  "Rikt restaurantutvalg i gangavstand"
  ```
- [x] Props: Motta `registerRef` og `onExpand` som støtter composite keys

**Referansefiler:** `StickyMapContent` (linje 176-259), `CompactPOIList` (linje 262-295)

### Steg 5: Oppdater scroll-tracking i `ReportPage.tsx`

**Fil:** `components/variants/report/ReportPage.tsx`

- [x] `useActiveSection` returnerer fortsatt `activeSectionId` — men verdien kan nå være:
  - `"mat-drikke"` (tema-nivå) eller `"mat-drikke:restaurant"` (sub-seksjon)
- [x] Parse `activeSectionId` til to separate verdier:
  ```ts
  const activeThemeId = activeSectionId?.split(':')[0] ?? null;
  const activeSubSectionCategoryId = activeSectionId?.includes(':')
    ? activeSectionId.split(':')[1]
    : null;
  ```
- [x] Send begge til `ReportStickyMap`
- [x] `expandedThemes` sett: Utvid til å støtte composite keys (`"mat-drikke:restaurant"`)
- [x] `handleExpandTheme` callback: Motta composite key for sub-seksjoner

**Referansefiler:** `useActiveSection` (linje 62-63), `ReportStickyMap` props (linje 164-172)

### Steg 6: Oppdater kart-markør-filtrering i `ReportStickyMap.tsx`

**Fil:** `components/variants/report/ReportStickyMap.tsx`

- [x] Legg til `activeSubSectionCategoryId` prop
- [x] `poisByTheme` memo: Bygg også entries for sub-seksjoner:
  ```ts
  // Theme-level: alle synlige POI-er i temaet
  lookup[theme.id] = [...allVisiblePOIs];
  // Sub-section level: kun POI-er med matching categoryId
  for (const sub of theme.subSections ?? []) {
    const key = `${theme.id}:${sub.categoryId}`;
    const visible = [...sub.highlightPOIs, ...sub.listPOIs];
    if (expandedThemes.has(key)) visible.push(...sub.hiddenPOIs);
    lookup[key] = visible;
  }
  ```
- [x] `isPoiInActiveTheme`: Bruk `activeSubSectionCategoryId` for å filtrere:
  ```ts
  if (activeSubSectionCategoryId) {
    // Vis kun markører for aktiv sub-seksjon
    const key = `${activeThemeId}:${activeSubSectionCategoryId}`;
    return poisByTheme[key]?.some(p => p.id === poiId) ?? false;
  }
  // Fallback: vis alle markører i temaet
  return poiThemeMap[poiId]?.has(activeThemeId) ?? false;
  ```
- [x] `fitBoundsForTheme`: Bruk composite key når sub-seksjon er aktiv
- [x] `expandedThemes` prop: Støtter nå composite keys

**Referansefiler:** `poisByTheme` (linje 55-65), `isPoiInActiveTheme` (linje 239-245)

## Fil-endringer (oppsummert)

| Fil | Type endring |
|-----|-------------|
| `components/variants/report/report-data.ts` | Datamodell + splitting-logikk |
| `lib/utils/category-score.ts` | Fiks nøkler + sub-kategori-templates |
| `components/variants/report/ReportThemeSection.tsx` | Render sub-seksjoner |
| `components/variants/report/ReportPage.tsx` | Parse activeSectionId, to props til kart |
| `components/variants/report/ReportStickyMap.tsx` | Sub-seksjon-filtrering, poisByTheme |

## Testing

- [x] Verifiser Scandic Lerkendal: "Mat & Drikke" splittes i sub-seksjoner (restaurant, kafé, bar)
- [x] Verifiser at prosjekter med få POI-er IKKE splittes (ingen regressjon)
- [x] Verifiser kart-markører oppdateres ved scroll mellom sub-seksjoner
- [x] Verifiser "Hent flere" fungerer per sub-seksjon uavhengig
- [x] Verifiser at highlights vises korrekt per sub-seksjon
- [x] Verifiser mobil-visning uendret (bruker theme.allPOIs som før)
- [x] Verifiser hero-kort viser totaltall (ikke bare remaining)
- [x] Verifiser TypeScript kompilerer uten feil
