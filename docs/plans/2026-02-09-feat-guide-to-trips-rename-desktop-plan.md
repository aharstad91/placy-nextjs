# Plan: Rename Guide → Trip + Desktop Layout

**Dato:** 2026-02-09
**Brainstorm:** `docs/brainstorms/2026-02-09-guide-to-trips-rename-desktop-brainstorm.md`
**Type:** Feature + Refactor
**Tech Audit:** YELLOW → mitigations applied below

---

## Oversikt

Tre sammenhengende oppgaver:
1. **Rename** "Guide" → "Trip" i hele kodebasen (typer, komponenter, ruter, UI-tekst)
2. **Desktop layout** — sidebar + kart side om side (md breakpoint)
3. **Test-data** — Scandic Nidelven trip med 6 stopp

---

## Del 1: Rename Guide → Trip

### 1.1 Types (`lib/types.ts`)

- [x] `GUIDE_CATEGORIES` → `TRIP_CATEGORIES`
- [x] `GUIDE_CATEGORY_LABELS` → `TRIP_CATEGORY_LABELS`
- [x] `GuideCategory` → `TripCategory`
- [x] `GuideDifficulty` → `TripDifficulty`
- [x] `GuideStopConfig` → `TripStopConfig`
- [x] `GuideConfig` → `TripConfig`
- [x] `GuideStopStatus` → `TripStopStatus`
- [x] `isCompletedStop` — uendret (generisk navn)
- [x] `GuideId` → `TripId`
- [x] `createGuideId` → `createTripId`
- [x] `GuideCompletionState` → `TripCompletionState`
- [x] `createGuideStopId` → `createTripStopId`
- [x] `GuideStopId` — branded type, rename til `TripStopId`
- [x] `Project.guideConfig` → `Project.tripConfig`

> **AUDIT-BESLUTNING:** `ProductType = "explorer" | "report" | "guide"` forblir **uendret**. Strengliteralet `"guide"` beholdes i ProductType, database, JSON-filer, og all data-server logikk. Kun typenavnene (GuideConfig → TripConfig), komponentnavn, og UI-tekst renames. Ingen DB-migrasjon, ingen JSON-filendringer, ingen mapping-lag.

### 1.2 Errors (`lib/errors/guide-errors.ts` → `lib/errors/trip-errors.ts`)

- [x] Rename fil
- [x] `GuideErrorCode` → `TripErrorCode`
- [x] `GuideError` → `TripError`
- [x] `isGuideError` → `isTripError`
- [x] `"INVALID_GUIDE_CONFIG"` → `"INVALID_TRIP_CONFIG"`

### 1.3 Validation (`lib/validation/guide-schema.ts` → `lib/validation/trip-schema.ts`)

- [x] Rename fil
- [x] `GuideStopConfigSchema` → `TripStopConfigSchema`
- [x] `GuideConfigSchema` → `TripConfigSchema`
- [x] `parseGuideConfig` → `parseTripConfig`
- [x] Oppdater imports

### 1.4 Hook (`lib/hooks/useGuideCompletion.ts` → `lib/hooks/useTripCompletion.ts`)

- [x] Rename fil
- [x] `useGuideCompletion` → `useTripCompletion`
- [x] localStorage keys: `placy-guide-completions` → `placy-trip-completions`
- [x] localStorage keys: `placy-guide-intros-seen` → `placy-trip-intros-seen`
- [x] **Migrasjon:** Kopier gammel key → ny key (kun hvis ny key ikke finnes). **Ikke slett gammel key** — den er harmløs og unngår race conditions ved flere tabs.
- [x] Oppdater alle type-referanser

### 1.5 Komponenter (`components/variants/guide/` → `components/variants/trip/`)

- [x] **Rename mappe**
- [x] `GuidePage.tsx` → `TripPage.tsx` (komponent: `TripPage`)
- [x] `GuideMap.tsx` → `TripMap.tsx` (komponent: `TripMap`)
- [x] `GuideMap3D.tsx` → `TripMap3D.tsx` (komponent: `TripMap3D`)
- [x] `GuideStopPanel.tsx` → `TripStopPanel.tsx` (komponent: `TripStopPanel`)
- [x] `GuideIntroOverlay.tsx` → `TripIntroOverlay.tsx` (komponent: `TripIntroOverlay`)
- [x] `GuideCompletionScreen.tsx` → `TripCompletionScreen.tsx` (komponent: `TripCompletionScreen`)
- [x] `confetti.ts` — beholdes som er (generisk)
- [x] Oppdater alle interne imports i komponentene
- [x] UI-tekst: "Laster guide..." → "Laster tur..."
- [x] UI-tekst: "Ingen guidedata funnet" → "Ingen turdata funnet"

### 1.6 Ruter (App Router)

- [x] `app/[customer]/guides/` → `app/[customer]/trips/`
  - `page.tsx`: Oppdater imports, rename `GuidesPage` → `TripsPage`
  - `GuideLibraryClient.tsx` → `TripLibraryClient.tsx`
- [x] `app/[customer]/[project]/guide/` → `app/[customer]/[project]/trip/`
  - `page.tsx`: Oppdater imports, rename `GuideProductPage` → `TripProductPage`

### 1.7 Data Server (`lib/data-server.ts`)

- [x] `getGuidesByCustomer` → `getTripsByCustomer`
- [x] **Beholder** `getBaseSlug` — sjekker fortsatt for `"-guide"` suffix (JSON-filer bruker fortsatt dette)
- [x] **Beholder** `SiblingProducts.guide` — dette er knyttet til ProductType som forblir `"guide"`
- [x] **Beholder** `getProductAsync` switch case `"guide"` — ProductType er uendret
- [x] Rename kun funksjonsnavnet `getGuidesByCustomer` → `getTripsByCustomer` + variabelnavn/kommentarer
- [x] **Beholder** `productType === "guide"` sjekk overalt — dette er database-verdien

### 1.8 Middleware (`middleware.ts`)

- [x] `PRODUCT_SUFFIXES`: legg til `"trip"`, behold `"guide"` for redirect
- [x] Legg til ekstra redirect: `/customer/guides` → `/customer/trips` (301)

### 1.9 Andre filer som refererer Guide

- [x] `app/[customer]/[project]/page.tsx`:
  - Import: `GuidePage` → `TripPage`
  - `PRODUCT_CONFIG.guide`:
    - title: "Guide" → "Trip"
    - description: oppdater tekst
    - path: "guide" → "trip"
  - **Beholder** `productType === "guide"` — ProductType er uendret
  - Metadata: "Guide" → "Trip"
- [x] `app/[customer]/[project]/layout.tsx`:
  - `guide: { label: "Guides", subPath: "/guide" }` → `guide: { label: "Trips", subPath: "/trip" }`
  - (NB: nøkkelen er fortsatt `guide` pga ProductType, kun label og subPath endres)
- [x] `app/admin/projects/page.tsx`: oppdater UI-strenger "Guide" → "Trip" (men **behold** `"guide"` som filter-verdi)

### 1.10 Supabase Types (`lib/supabase/types.ts`)

- [x] **Uendret** — `"guide"` forblir som database-verdi, ingen mapping nødvendig
- [x] `lib/supabase/queries.ts` — uendret (refererer til `"guide"` som er korrekt)

### 1.11 Context docs

- [x] `context/products.md`: "Guide" → "Trip" i tekst

---

## Del 2: Desktop Layout

### 2.1 Responsive TripPage (CSS-only, ingen JS hook)

`components/variants/trip/TripPage.tsx`:

> **AUDIT-BESLUTNING:** Bruk **Tailwind responsive classes** (`hidden lg:flex` / `lg:hidden`) — IKKE `useMediaQuery` hook. Dette følger det velprøvde mønsteret fra ExplorerPage. Begge layouts rendres på server, CSS viser/skjuler. Null hydration-risiko.

- [x] Under `lg` (1024px): eksisterende mobil-layout (fullscreen map + bottom sheet) — `lg:hidden`
- [x] Over `lg`: ny desktop-layout med sidebar — `hidden lg:flex`

### 2.2 Desktop Layout Container

Ny layout i `TripPage.tsx` — følger ExplorerPage-mønsteret:

```tsx
{/* Mobile layout */}
<div className="lg:hidden h-screen relative">
  <TripMap ... />
  <ExplorerBottomSheet>
    <TripStopPanel showProgressDots />
  </ExplorerBottomSheet>
</div>

{/* Desktop layout */}
<div className="hidden lg:flex h-screen">
  {/* Map: takes remaining width */}
  <div className="flex-1 relative">
    <TripMap ... />
  </div>
  {/* Sidebar: flush right panel */}
  <div className="w-[40%] flex-shrink-0 bg-white border-l border-stone-200 flex flex-col overflow-hidden">
    <TripHeader ... />
    <TripStopList ... />
    <TripStopPanel showProgressDots={false} />
  </div>
</div>
```

> **AUDIT-MØNSTER:** `w-[40%]` (fra Explorer), ikke `w-[380px]`. Map til venstre, sidebar til høyre (som Explorer).

### 2.3 TripHeader (ny komponent for desktop)

`components/variants/trip/TripHeader.tsx`:

- [x] Trip title
- [x] Distance + duration info
- [x] Progress bar (x/y stopp)
- [x] Back-knapp (valgfritt)
- [x] Brukes kun i desktop-layout

### 2.4 TripStopList (ny komponent for desktop sidebar)

`components/variants/trip/TripStopList.tsx`:

- [x] Nummerert liste over alle stopp
- [x] Klikkbar — setter currentStopIndex
- [x] Viser completion-status (checkmark for fullførte)
- [x] Highlight for aktiv stopp
- [x] Scrollbar for lange turer

### 2.5 Tilpasse eksisterende TripStopPanel

- [x] Legg til `showProgressDots?: boolean` prop (default: `true`)
- [x] Mobile: `showProgressDots={true}` — viser dots + prev/next nav
- [x] Desktop: `showProgressDots={false}` — TripStopList håndterer navigasjon
- [x] Stop detail vises i sidebar under stop-listen på desktop

### 2.6 Tilpasse TripMap for desktop

- [x] Fjern title overlay (det er i sidebar/header på desktop)
- [x] Fjern bottom padding for bottom sheet (ikke brukt på desktop)
- [x] Kart fyller hele høyre side

---

## Del 3: Test-data (Scandic Nidelven)

### 3.1 Opprett data-fil

`data/projects/scandic/scandic-nidelven-trip.json`:

- [x] 6 POI-er rundt Scandic Nidelven, Trondheim
- [x] TripConfig med reward
- [x] ProductType: "guide" (i JSON, mappes til trip i kode)

**POI-er:**
1. Gamle Bybro (63.4270, 10.4020)
2. Bakklandet (63.4280, 10.4040)
3. Nidarosdomen (63.4269, 10.3967)
4. Erkebispegården (63.4272, 10.3987)
5. Solsiden (63.4345, 10.4090)
6. Scandic Nidelven (63.4350, 10.4060)

**Reward:**
- Title: "15% rabatt i baren"
- Description: "Vis denne skjermen i resepsjonen"
- Hotel: "Scandic Nidelven"
- Validity: 7 dager

---

## Rekkefølge

1. **Rename** (del 1) — ren refactoring, ingen ny funksjonalitet
2. **Desktop layout** (del 2) — ny funksjonalitet, bygger på renamed kode
3. **Test-data** (del 3) — for å verifisere at alt fungerer

---

## Risiko & mitigering

| Risiko | Mitigering |
|--------|-----------|
| Import-feil etter rename | TypeScript fanger dette — kjør `npx tsc --noEmit` etter rename |
| Database ProductType | ProductType forblir `"guide"` overalt — ingen mismatch |
| localStorage-data forsvinner | Kopier til ny key uten å slette gammel — idempotent |
| Middleware-redirect-loops | Kun redirect fra gammel → ny, aldri tilbake |
| Desktop layout bryter mobil | CSS-only (`hidden lg:flex`), begge rendres, ingen JS-logikk |
| Map resize ved layout-bytte | `react-map-gl` håndterer resize automatisk via ResizeObserver |

---

## Filer som endres (komplett liste)

### Rename (eksisterende filer)
1. `lib/types.ts` — rename alle Guide*-typer
2. `lib/errors/guide-errors.ts` → `lib/errors/trip-errors.ts`
3. `lib/validation/guide-schema.ts` → `lib/validation/trip-schema.ts`
4. `lib/hooks/useGuideCompletion.ts` → `lib/hooks/useTripCompletion.ts`
5. `lib/data-server.ts` — rename funksjoner og suffixer
6. `middleware.ts` — legg til "trip" suffix + redirect
7. `app/[customer]/guides/` → `app/[customer]/trips/` (2 filer)
8. `app/[customer]/[project]/guide/` → `app/[customer]/[project]/trip/` (1 fil)
9. `components/variants/guide/` → `components/variants/trip/` (6 filer)
10. `app/[customer]/[project]/page.tsx` — oppdater imports og config
11. `app/[customer]/[project]/layout.tsx` — oppdater label/path
12. `app/admin/projects/page.tsx` — oppdater guide-referanser
13. `context/products.md` — oppdater tekst

### Nye filer (desktop)
14. `components/variants/trip/TripHeader.tsx`
15. `components/variants/trip/TripStopList.tsx`

### Ny fil (test-data)
16. `data/projects/scandic/scandic-nidelven-trip.json`

**Totalt: ~16 filer endret/opprettet**
