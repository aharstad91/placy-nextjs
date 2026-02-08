---
title: "feat: Explorer UX Quality Overhaul"
type: feat
date: 2026-02-06
brainstorm: docs/brainstorms/2026-02-06-explorer-ux-quality-overhaul-brainstorm.md
---

# feat: Explorer UX Quality Overhaul

## Tech Audit Mitigations (2026-02-06)

Følgende endringer er lagt til etter tech audit (YELLOW verdict):

1. **`categories` (ikke `categoryIds`)** — Behold Report-kompatibelt feltnavn i ThemeDefinition
2. **`venue_type` (ikke `project_type`)** — Unngår navnekollisjon med eksisterende `product_type`
3. **Supabase Storage for bilder** — Google Photos-URL-er utløper; last ned og lagre permanent
4. **`ExplorerPanel.tsx`** lagt til i WP4 berørte filer
5. **Catch-all for umappede kategorier** — Sikrer at ingen POI-er blir usynlige
6. **Ny wrapper-funksjon** `calculateWeightedPOIScore` — bevarer eksisterende signatur
7. **Collection view bypass** — Skip cap når `?c=slug` er i URL
8. **`prefers-reduced-motion`** for puls-animasjon
9. **WP6 scoped** til POI-er med `google_place_id`

## Overview

Oppgrader Explorer fra "vis alle POI-er" til "vis de riktige POI-ene, vakkert". Syv sammenkoblede forbedringer fordelt på 7 arbeidspakker:

1. Delt tema-system mellom Report og Explorer
2. Smartere POI-utvalg med hotellprofiler
3. POI-cap på 100 med vektet fordeling per tema
4. Tema-chips UI med underkategorier
5. Prosjektmarkør med navn og puls-effekt
6. Google Photos for alle POI-er (permanent cache)
7. Default reisemodus til fots

## Problem Statement

Basert på visuell QA av Scandic Nidelven Explorer:
- **166 POI-er** er for mange — kartet blir rotete, sidebar er uoverkommelig
- **Irrelevante POI-er** (MMA, Kickboxing, frisører) gir "AI-kuratert"-følelse
- **"breheimen national"** — Google Places-feiltreff som gir null mening
- **Sentrum-markør** viser "Sentrum" i stedet for hotellets navn
- **Mangler bilder** på de fleste POI-kort — fattig UX
- **17 kategorier** i flat dropdown er overveldende og gjemt bort

---

## WP1: Delt Tema-system

**Mål:** Unifiser Report-temaer og Explorer-pakker til én felles `ThemeDefinition`.

### Bakgrunn

Report bruker `ReportThemeDefinition` (report-themes.ts) og Explorer bruker `CategoryPackage` (explorer-packages.ts). De er konseptuelt identiske men strukturelt separate.

| Aspekt | Report | Explorer |
|--------|--------|----------|
| Interface | `ReportThemeDefinition` | `CategoryPackage` |
| Felt for kategorier | `categories` | `categoryIds` |
| Tema-IDer | "mat-drikke" | "food" |
| Lokasjon | `report-themes.ts` | `explorer-packages.ts` |

### Implementering

- [x] Opprett `lib/themes/theme-definitions.ts` med felles `ThemeDefinition` interface:
  ```typescript
  export interface ThemeDefinition {
    id: string;
    name: string;
    icon: string;          // Lucide icon name
    categories: string[];  // NB: "categories" (ikke "categoryIds") for Report-kompatibilitet
    color?: string;        // For chip-styling
  }
  ```
- [x] Opprett `lib/themes/default-themes.ts` med de 5 standard-temaene:
  - `mat-drikke`: restaurant, cafe, bar, bakery (UtensilsCrossed)
  - `kultur-opplevelser`: museum, library, cinema, park (Landmark)
  - `hverdagsbehov`: supermarket, pharmacy, shopping (ShoppingCart)
  - `transport`: bus, train, tram, bike, parking, carshare, taxi, airport (Bus)
  - `trening-velvare`: gym, spa (Dumbbell)
- [x] Legg til catch-all mapping for umappede kategorier:
  - Kategorier som `bank`, `post_office`, `convenience`, `outdoor`, `swimming`, `ferry`, `haircare` som ikke tilhører noe tema
  - Mappes til nærmeste eksisterende tema (f.eks. `convenience` → hverdagsbehov, `outdoor` → kultur-opplevelser)
  - Alternativ: Opprett "Annet"-tema for resterende kategorier
  - **Viktig:** Ingen POI-kategori skal bli usynlig pga manglende tema-tilhørighet
- [x] Opprett `lib/themes/index.ts` som eksporterer alt
- [x] Migrer `components/variants/report/report-themes.ts` til å importere fra `lib/themes/`
  - Behold `ReportThemeConfig` (extends ThemeDefinition med intro/bridgeText) i report-spesifikk fil
  - Behold `getReportThemes()` som henter prosjekt-override
- [ ] Fjern `components/variants/explorer/explorer-packages.ts` — erstattes av shared themes
- [x] Oppdater alle imports i Report-komponenter
- [x] Verifiser at Report-siden fortsatt fungerer etter migrering (tsc clean)

### Berørte filer
- `lib/themes/theme-definitions.ts` (ny)
- `lib/themes/default-themes.ts` (ny)
- `lib/themes/index.ts` (ny)
- `components/variants/report/report-themes.ts` (refaktor)
- `components/variants/explorer/explorer-packages.ts` (slett)
- `components/variants/report/report-data.ts` (oppdater imports)
- `components/variants/report/ReportThemeSection.tsx` (oppdater imports)

---

## WP2: Smartere POI-utvalg med Hotellprofiler

**Mål:** Fjern irrelevante POI-er basert på prosjekttype og forbedre scoring.

### Hotellprofil-system

- [x] Opprett `lib/themes/venue-profiles.ts` med profil-definisjoner:
  ```typescript
  export type VenueType = "hotel" | "residential" | "commercial";

  export interface VenueProfile {
    type: VenueType;
    categoryBlacklist: string[];     // Kategorier som aldri vises
    categoryWeights: Record<string, number>; // Relevans-vekt 0-1
    transportCap: number;            // Maks antall transport-POI-er
  }
  ```
- [x] Definer hotellprofil:
  - **Blacklist:** `mma`, `kickboxing`, `martial_arts`, `boxing` (nisjekampsport)
  - **Lav vekt (0.3):** `haircare` (frisør — folk klipper seg hjemme)
  - **Normal vekt (1.0):** restaurant, cafe, bar, bakery, museum, park, cinema, spa, gym, supermarket, pharmacy
  - **Transport-cap:** Maks 4 bussholdeplasser, 6 bysykkelstasjoner
- [x] Definer boligprofil (residential):
  - Bredere blacklist (bare fjern de mest nisjete)
  - Høyere vekt for hverdagsbehov (dagligvare, apotek, frisør)
  - Mer transport
- [x] Legg til `venue_type` på `projects`-tabellen:
  - [x] Migrasjon: `ALTER TABLE projects ADD COLUMN venue_type TEXT DEFAULT 'hotel' CHECK (venue_type IN ('hotel', 'residential', 'commercial'));`
  - [x] NB: Bruker `venue_type` (ikke `project_type`) for å unngå kollisjon med eksisterende `product_type`-kolonne
  - [x] Oppdater `lib/supabase/types.ts` med ny kolonne
  - [ ] Oppdater admin-UI for å sette venue-type (deferred — not needed for initial rollout)

### Forbedret scoring

- [x] Opprett ny wrapper-funksjon i `lib/utils/poi-score.ts` (bevar eksisterende `calculatePOIScore` signatur):
  ```typescript
  // Eksisterende funksjon — IKKE endre signatur
  export function calculatePOIScore(input: POIScoreInput): number { ... }

  // Ny wrapper med venue-profil vekting
  export function calculateWeightedPOIScore(
    input: POIScoreInput,
    profile?: VenueProfile
  ): number {
    const baseScore = calculatePOIScore(input);
    const relevanceWeight = profile?.categoryWeights[input.category] ?? 1.0;
    return baseScore * relevanceWeight;
  }
  ```
- [ ] Transport-spesifikk logikk: Busstopp sortert kun på avstand (nærmeste først), cappes til `transportCap`
- [ ] Bysykkel: Sorter på avstand, cap til 6 nærmeste
- [ ] Fjern POI-er som er i blacklist før scoring

### Berørte filer
- `lib/themes/venue-profiles.ts` (ny)
- `lib/utils/poi-score.ts` (utvid)
- `supabase/migrations/012_add_venue_type.sql` (ny)
- `lib/supabase/types.ts` (oppdater)
- `app/admin/projects/` (oppdater for venue_type)

---

## WP3: POI-cap på 100 med Vektet Fordeling

**Mål:** Begrens Explorer til maks 100 POI-er, fordelt på temaer med vekter.

### Explorer-cap konfiguration

- [x] Opprett `lib/themes/explorer-caps.ts`:
  ```typescript
  export const EXPLORER_THEME_CAP: Record<string, number> = {
    "mat-drikke": 30,
    "kultur-opplevelser": 15,
    "transport": 20,
    "trening-velvare": 15,
    "hverdagsbehov": 20,
  };
  export const EXPLORER_TOTAL_CAP = 100;
  ```
- [x] Implementer cap-logikk i ny funksjon `lib/themes/apply-explorer-caps.ts`:
  ```typescript
  export function applyExplorerCaps(
    pois: POI[],
    themes: ThemeDefinition[],
    profile: VenueProfile,
    caps: Record<string, number>
  ): POI[] {
    // 1. Fjern blacklisted kategorier
    // 2. Score alle POI-er med profil-vekter
    // 3. Per tema: ta top N basert på cap
    // 4. Dedup (POI kan tilhøre flere temaer)
    // 5. Returner maks EXPLORER_TOTAL_CAP
  }
  ```
- [x] Integrer cap-logikk i Explorer data-loading:
  - Enten server-side i `page.tsx` (anbefalt — mindre data over nettverket)
  - Eller client-side i `ExplorerPage.tsx` (mer fleksibelt for filter-endringer)
- [x] **Collection view bypass:** Når `?c=slug` er i URL, skip cap-logikken helt. Collection-POI-er kan referere til POI-er utenfor 100-cappen, så collection-view bruker egen ufiltrert POI-liste.

### Beslutning: Server-side vs client-side cap

Server-side anbefales: Hent alle POI-er fra Supabase, kjør cap-logikk, send kun 100 til klienten. Fordeler:
- Mindre payload (100 vs 166 POI-er)
- Raskere initial render
- Færre kart-markører = bedre framerate

### Berørte filer
- `lib/themes/explorer-caps.ts` (ny)
- `lib/themes/apply-explorer-caps.ts` (ny)
- `app/[customer]/[project]/explore/page.tsx` (integrer cap)
- `components/variants/explorer/ExplorerPage.tsx` (motta cappede POI-er)

---

## WP4: Tema-chips UI med Underkategorier

**Mål:** Erstatt flat kategori-dropdown med tema-chips som har underkategori-toggle.

### Design

```
[🍴 Mat & Drikke (30) ▾] [🏛 Kultur (15) ▾] [🚌 Transport (20) ▾] [🏋 Trening (15) ▾] [🛒 Hverdag (20) ▾]
```

Hver chip:
- Viser tema-ikon, navn, og antall synlige POI-er
- Klikk på chip: toggle hele temaet av/på
- Klikk på chevron (▾): åpner underkategori-dropdown
- Underkategori-dropdown: checkboxer for individuelle kategorier

Start-tilstand: Alle temaer aktive (alle POI-er synlige).

### Implementering

- [x] Opprett `components/variants/explorer/ExplorerThemeChips.tsx`:
  ```typescript
  interface ThemeChipProps {
    theme: ThemeDefinition;
    count: number;           // Antall POI-er i dette temaet
    isActive: boolean;
    activeCategories: Set<string>;
    onToggleTheme: (themeId: string) => void;
    onToggleCategory: (categoryId: string) => void;
  }
  ```
- [x] Chip-komponent med split-design:
  - Venstre del (klikk = toggle tema): `[Ikon] Label (count)`
  - Høyre del (klikk = åpne dropdown): `[▾]`
  - Aktiv: filled bakgrunn med tema-farge
  - Inaktiv: outline/ghost stil
- [x] Underkategori-popover (bruker Radix Popover eller enkel dropdown):
  - Liste med checkboxer per kategori i temaet
  - Viser kategori-ikon + navn + count
  - Toggle av én kategori skrur ikke av hele temaet
- [x] Horizontal scroll på mobil (chips wrapper med `overflow-x-auto`)
- [x] Oppdater `ExplorerPage.tsx`:
  - Fjern gammel pakke/kategori-logikk (handleSelectPackage, toggleCategory)
  - Erstatt med tema-basert filtrering
  - State: `activeThemes: Set<string>` + `activeCategories: Set<string>`
- [x] Oppdater `ExplorerPOIList.tsx`:
  - Fjern gammel CategoryPackageSelector
  - Erstatt med ExplorerThemeChips
  - Behold reisemodus-velger (Til fots / Sykkel / Bil)
- [x] Fjern travel mode dropdown label "Sykkel" som default-visning — skal vise aktiv modus

### State-arkitektur for tema-filtrering

Bruk **derived state pattern** — ikke to uavhengige Sets:
```typescript
// Primær state
activeThemes: Set<string>        // Hvilke temaer er toggled on
disabledCategories: Set<string>  // Individuelle kategorier brukeren har skrudd av

// Derived (beregnet, ikke lagret)
activeCategories = themes
  .filter(t => activeThemes.has(t.id))
  .flatMap(t => t.categories)
  .filter(c => !disabledCategories.has(c))
```

**Ikke persist tema-state i Zustand/localStorage** — start alltid med alle temaer aktive.

### Berørte filer
- `components/variants/explorer/ExplorerThemeChips.tsx` (ny)
- `components/variants/explorer/ExplorerPage.tsx` (refaktor filter-logikk)
- `components/variants/explorer/ExplorerPOIList.tsx` (erstatt pakke-selector)
- `components/variants/explorer/ExplorerPanel.tsx` (mottar nye tema-props, fjern pakke-props)
- `lib/store.ts` (IKKE persist tema-state — alltid fresh)

---

## WP5: Prosjektmarkør med Navn og Puls-effekt

**Mål:** Vis prosjektnavn på sentrum-markøren og legg til puls-animasjon.

### Implementering

- [x] Oppdater `ExplorerMap.tsx:262-278`:
  - Erstatt hardkodet "Sentrum" med `project.name` (f.eks. "Scandic Nidelven")
  - Begrens tekst til maks 20 tegn med ellipsis
- [x] Legg til CSS puls-animasjon:
  ```css
  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  .center-marker-pulse {
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(14, 165, 233, 0.3); /* sky-500 */
    animation: pulse-ring 2s ease-out infinite;
    will-change: transform, opacity;
  }
  @media (prefers-reduced-motion: reduce) {
    .center-marker-pulse { animation: none; opacity: 0.3; }
  }
  ```
- [x] Vis puls KUN når geolokasjon IKKE er aktiv:
  - `geoMode === "disabled" || geoMode === "loading" || geoMode === "fallback"` → vis puls
  - `geoMode === "gps-near" || geoMode === "gps-far"` → skjul puls (geolokasjon tar over)
- [x] Markør-struktur:
  ```tsx
  <div className="flex flex-col items-center">
    {/* Puls-ring (bak markøren) */}
    {showPulse && <div className="center-marker-pulse" />}
    {/* Selve markøren */}
    <div className="w-10 h-10 bg-sky-500 rounded-full ...">
      <MapPin />
    </div>
    {/* Prosjektnavn */}
    <span className="text-[10px] font-medium ...">
      {project.name}
    </span>
  </div>
  ```

### Berørte filer
- `components/variants/explorer/ExplorerMap.tsx` (oppdater markør)
- `app/globals.css` eller inline Tailwind (puls-animasjon)

---

## WP6: Google Photos for Alle POI-er

**Mål:** Hent og cache Google Photos permanent for alle POI-er i Explorer.

### Implementering

- [ ] Opprett `lib/utils/fetch-poi-photos.ts`:
  ```typescript
  export async function fetchAndCachePOIPhotos(
    pois: POI[],
    supabaseUrl: string,
    serviceRoleKey: string
  ): Promise<{updated: number, skipped: number, failed: number}>
  ```
  - **Scope:** Kun POI-er med `google_place_id` og uten `featured_image` (native POI-er bruker manuelt bilde via admin)
  - Hent `photoReference` via Google Places Details API
  - **Last ned bildet** og lagre i **Supabase Storage** bucket (f.eks. `poi-photos/`)
  - Lagre permanent Supabase Storage public URL som `featured_image` på POI-en
  - **NB: Ikke cache Google Photos URL-er direkte** — de har signerte tokens som utløper etter timer/dager
  - Batch i grupper av 10 med 500ms delay (rate limiting)
- [ ] Oppdater `/generate-hotel` skill:
  - Etter POI-import og scoring: kall `fetchAndCachePOIPhotos` for alle 100 POI-er
  - Logg: "Henter bilder for X POI-er..."
  - Estimert kostnad: ~$0.70 per prosjekt (100 API-kall)
- [ ] Oppdater `ExplorerPOICard.tsx` bildeprioritering:
  1. `poi.featuredImage` (nå populert for alle)
  2. `poi.photoReference` (fallback for uventede tilfeller)
  3. Kategori-ikon (siste fallback)
- [ ] Verifiser at bildene vises i Explorer-sidebar og ved klikk/expand

### Permanent cache-strategi
- Bilder lagres i **Supabase Storage** bucket `poi-photos/` med public URL
- `featured_image` peker til Supabase Storage URL (permanent, ingen utløp)
- Ingen TTL — oppdateres manuelt eller via cron hvert halvår
- Unngår gjentatte API-kall ved sidevisninger
- Google Places API-URL-er brukes KUN under nedlasting, aldri lagret permanent

### Berørte filer
- `lib/utils/fetch-poi-photos.ts` (ny)
- `.claude/commands/generate-hotel.md` (oppdater steg)
- `components/variants/explorer/ExplorerPOICard.tsx` (verifiser)

---

## WP7: Default Reisemodus til Fots

**Mål:** Verifiser og fiks at "Til fots" er default i alle sammenhenger.

### Status

`lib/store.ts:11` setter allerede `travelMode: "walk"` som default. Men:
- UI-dropdown i ExplorerPOIList kan vise feil label visuelt
- LocalStorage kan ha cached "bike" fra tidligere testing

### Implementering

- [x] Verifiser `lib/store.ts` default: `travelMode: "walk"` ✓
- [x] Sjekk `ExplorerPOIList.tsx` travel mode dropdown:
  - Verifiser at "Til fots" vises som valgt når `travelMode === "walk"`
  - Fiks evt. visuell bug der "Sykkel" vises som default
- [x] Test: Åpne Explorer i incognito-vindu → skal vise "Til fots" og gangavstander

### Berørte filer
- `lib/store.ts` (verifiser)
- `components/variants/explorer/ExplorerPOIList.tsx` (fiks evt. bug)

---

## Implementeringsrekkefølge

```
WP1 (Tema-system) → WP2 (Profiler) → WP3 (Cap) → WP4 (UI) → WP5 (Markør) → WP6 (Bilder) → WP7 (Default)
```

WP1 er grunnlaget — alle andre WP-er bygger på det delte tema-systemet.
WP5, WP6, WP7 er uavhengige og kan gjøres parallelt etter WP4.

## Acceptance Criteria

- [ ] Explorer viser maks 100 POI-er for Scandic Nidelven (ned fra 166)
- [ ] Ingen MMA/kickboxing/kampsport-POI-er synlige for hotellprosjekter
- [ ] Frisør-POI-er nedprioritert (maks 1-2 hvis plass)
- [ ] Busstopp begrenset til 3-4 nærmeste
- [ ] Tema-chips synlige i sidebar (erstatter flat dropdown)
- [ ] Alle temaer aktive som default, toggle av/på fungerer
- [ ] Underkategori-dropdown åpnes via chevron på chip
- [ ] Sentrum-markør viser "Scandic Nidelven" (ikke "Sentrum")
- [ ] Puls-effekt på sentrum-markør, skrus av ved geolokasjon
- [ ] Alle POI-er med google_place_id har bilder (lagret i Supabase Storage)
- [ ] "Til fots" er default reisemodus
- [ ] Collection view (`?c=slug`) viser alle collection-POI-er uavhengig av cap
- [ ] Ingen POI-kategorier er usynlige (catch-all mapping for umappede)
- [ ] Puls-animasjon respekterer `prefers-reduced-motion`
- [ ] Report-siden fungerer fortsatt etter tema-refaktorering

## References

- Brainstorm: `docs/brainstorms/2026-02-06-explorer-ux-quality-overhaul-brainstorm.md`
- Eksisterende scoring: `lib/utils/poi-score.ts`
- Report-temaer: `components/variants/report/report-themes.ts`
- Explorer-pakker: `components/variants/explorer/explorer-packages.ts`
- Explorer map: `components/variants/explorer/ExplorerMap.tsx:262-278`
- Skeleton loading: `docs/solutions/ux-loading/skeleton-loading-explorer-20260204.md`
- Layout-pattern: `docs/solutions/ui-patterns/explorer-desktop-layout-pattern.md`
