---
title: "feat: Explorer Desktop UI Redesign — Navbar + Floating Panel + Map-First Layout"
type: feat
date: 2026-01-31
---

# Explorer Desktop UI Redesign

## Overview

Redesign av Explorer-sidens desktop-layout fra en 50/50 split (kart venstre, panel h??yre) til et kart-f??rst design med:

1. **Vertikal navbar** (60px, full h??yde, venstre kant) med ikon-baserte funksjoner
2. **Fullskjerm kart** som tar hele bredden
3. **Flytende POI-liste** (~380px) som ligger over kartet p?? venstre side

I tillegg fjernes time budget, s??k, og package-tabs. Kategorier flyttes til navbar med popup for underkategorier. Collection-funksjon f??r forbedret UX med synlig counter i navbar og "Lagre"-label p?? hover.

## Nyyy Layout (Desktop, `lg:` breakpoint)

```
?????????????????????????????????????????????????????????????????????????????????????????????
??? Nav ???                                        ???
??? bar ???  [Flytende POI-liste]                   ???
??? 60px???  380px bred                              ???
???      ???  - Header med tittel/stats              ???
???      ???  - POI-kort med scroll      KART        ???
???      ???  - Lagre-knapp synlig       (100% width)???
???      ???                                         ???
???  ??   ???                                         ???
??? ??   ???                                         ???
???  ??   ???                                         ???
???  ??   ???                                         ???
???  ??   ???                                         ???
??? ??0?? ???                                         ???
?????????????????????????????????????????????????????????????????????????????????????????????
```

**Navbar-ikoner (topp til bunn):**
- Travel Mode: Til fots / Sykkel / Bil (toggle-gruppe)
- Separator
- Pakke-kategorier: Mat, Praktisk, Transport, Aktiv, Alt
- Separator
- Collection counter (badge med antall)

## Hva fjernes

### Time Budget (komplett fjerning)
- [x] Fjern time budget UI-kontroller fra `ExplorerPanel.tsx:192-240`
- [x] Fjern `timeBudget` fra `panelProps` i `ExplorerPage.tsx:348`
- [x] Fjern `onSetTimeBudget` callback
- [x] Fjern `poisWithinBudget` beregning i `ExplorerPage.tsx:182-186`
- [x] Fjern `poisWithinBudgetCount` prop
- [x] Fjern opacity-dimming basert p?? time budget i `ExplorerPOICard.tsx:101` (`isOutsideBudget`)
- [x] Fjern opacity-dimming p?? kartmarkk??rer i `ExplorerMap.tsx:282`
- [x] Fjern "X highlighted within <=Y min" tekst fra header
- [x] Sett `timeBudget` i Zustand store til en h??y default (999) slik at `isWithinTimeBudget` alltid returnerer true, uten ?? bryte andre varianter som bruker store

### S??k
- [x] Fjern s??kefelt fra `ExplorerPanel.tsx:242-264`
- [x] Fjern `searchQuery`/`onSearchChange` props fra panel
- [x] Forenkle filtreringspipeline: `searchFilteredPOIs` kan erstattes med `filteredPOIs` direkte

### Package-tabs (horisontale)
- [x] Fjern horisontal package-rad fra `ExplorerPanel.tsx:266-301`
- [x] Package-logikken beholdes men flyttes til navbar

### Collection bottom bar
- [x] Fjern sticky bottom bar fra `ExplorerPanel.tsx:397-411`
- [x] Collection-trigger flyttes til navbar

## Nye komponenter

### 1. `ExplorerNavbar.tsx` (ny fil)

Vertikal navbar, 60px bred, full viewport-h??yde, fast posisjonert p?? venstre kant.

```
components/variants/explorer/ExplorerNavbar.tsx
```

**Struktur:**

```tsx
<nav className="fixed left-0 top-0 bottom-0 w-[60px] bg-white border-r border-gray-200 z-40
                flex flex-col items-center py-3 gap-1">

  {/* Travel Mode gruppe */}
  <NavIconButton icon={Footprints} label="Til fots" active={mode==="walk"} />
  <NavIconButton icon={Bike} label="Sykkel" active={mode==="bike"} />
  <NavIconButton icon={Car} label="Bil" active={mode==="car"} />

  <Separator />

  {/* Pakke-kategorier */}
  {packages.map(pkg => (
    <NavCategoryButton
      icon={pkg.icon}
      label={pkg.name}
      active={activePackage === pkg.id}
      hasActiveCategories={/* noen av pakkens kategorier er aktive */}
      onClick={() => handlePackageClick(pkg.id)}
      popupOpen={openPopup === pkg.id}
    />
  ))}

  <div className="flex-1" /> {/* Spacer */}

  {/* Collection */}
  <NavCollectionButton count={collectionPOIs.length} onClick={onOpenCollection} />
</nav>
```

**Props:**

```typescript
interface ExplorerNavbarProps {
  travelMode: TravelMode;
  onSetTravelMode: (mode: TravelMode) => void;
  packages: Package[];
  activePackage: string | null;
  activeCategories: Set<string>;
  categories: Category[];
  onSelectPackage: (id: string) => void;
  onToggleCategory: (id: string) => void;
  collectionCount: number;
  onOpenCollection: () => void;
}
```

**Ikon-knapp med tooltip:**

```tsx
// Gjenbruk m??nster fra admin-sidebar.tsx:124-135
<button className="group relative w-10 h-10 rounded-lg flex items-center justify-center
                   hover:bg-gray-100 transition-colors">
  <Icon className="w-5 h-5" />

  {/* Tooltip */}
  <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs
                  font-medium rounded-lg opacity-0 invisible group-hover:opacity-100
                  group-hover:visible transition-all duration-150 whitespace-nowrap z-50
                  pointer-events-none">
    {label}
    <div className="absolute right-full top-1/2 -translate-y-1/2
                    border-4 border-transparent border-r-gray-900" />
  </div>
</button>
```

### 2. `CategoryPopup.tsx` (ny fil)

Inline popup som vises n??r en pakke-kategori klikkes i navbar.

```
components/variants/explorer/CategoryPopup.tsx
```

**Oppf??rsel:**
- Vises til h??yre for navbar-ikonet, vertikalt aligned
- Viser alle underkategorier i pakken som toggle-chips
- Klikk p?? pakke-ikon: aktiverer alle pakkens kategorier + ??pner popup
- Toggle individuelle tags i popup: sl??r av/p?? den kategorien globalt
- Kun ??n popup ??pen om gangen
- Lukkes ved: klikk utenfor, Escape, klikk p?? annet pakke-ikon

**State for overlappende kategorier:** Kategorier som "supermarket" (finnes i b??de Food og Practical) bruker ??n global `activeCategories` Set. Toggle i ??n popup p??virker alle pakker. Popup viser korrekt state uavhengig av hvilken pakke som ??pnet den.

**"Alt"-pakken:** Klikk p?? "Alt" aktiverer alle kategorier. ??pner IKKE popup (ingen underkategorier ?? vise). Fungerer som reset-knapp.

**Visuell aktiv-state p?? navbar-ikon:**
- Fullt aktiv (alle pakkens kategorier p??): ikon f??r `bg-gray-900 text-white`
- Delvis aktiv (noen av pakkens kategorier p??): liten farget dot/badge p?? ikonet
- Ingen aktive: standard gr?? ikon

```tsx
<div className="absolute left-[60px] top-0 ml-2 bg-white rounded-xl shadow-lg
                border border-gray-200 p-3 min-w-[200px] z-50">
  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{packageName}</p>
  <div className="flex flex-wrap gap-1.5">
    {categories.map(cat => (
      <button
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
          isActive ? "text-white" : "bg-gray-100 text-gray-500"
        )}
        style={isActive ? { backgroundColor: cat.color } : undefined}
      >
        <CatIcon className="w-3.5 h-3.5" />
        {cat.name}
        <span className="text-xs opacity-75">{count}</span>
      </button>
    ))}
  </div>
</div>
```

### 3. Oppdatert `ExplorerPage.tsx` layout

```tsx
// Ny desktop layout (lg: breakpoint)
<div className="h-screen w-screen relative overflow-hidden">
  {/* Kart -- fullskjerm */}
  <div className="absolute inset-0 lg:pl-[60px]">
    <ExplorerMap {...mapProps} />
  </div>

  {/* Desktop: Navbar (venstre kant) */}
  <div className="hidden lg:block">
    <ExplorerNavbar {...navbarProps} />
  </div>

  {/* Desktop: Flytende POI-liste */}
  <div className="hidden lg:flex flex-col absolute top-4 bottom-4 left-[76px] w-[380px]
                  bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] z-30 overflow-hidden">
    <ExplorerPOIList {...listProps} />
  </div>

  {/* Mobil: Uendret bottom sheet (under lg breakpoint) */}
  <div className="lg:hidden">
    {/* Kart fullskjerm */}
    <div className="absolute inset-0">
      <ExplorerMap {...mapProps} />
    </div>
    <ExplorerBottomSheet snapPoints={snapPoints} initialSnap={1}>
      <ExplorerPanel {...panelProps} />
    </ExplorerBottomSheet>
  </div>

  <CollectionDrawer ... />
</div>
```

### 4. `ExplorerPOIList.tsx` (ny fil, eller refaktorert ExplorerPanel)

Forenklet POI-liste for det flytende panelet. Inneholder kun:
- Kompakt header med tittel + statistikk
- Kontekst-hint
- Scrollbar POI-liste

```
components/variants/explorer/ExplorerPOIList.tsx
```

**Header (lys, ikke dark):**

```tsx
<div className="flex-shrink-0 p-4 pb-3 border-b border-gray-100">
  <h1 className="text-lg font-bold text-gray-900">{projectName}</h1>
  <p className="text-sm text-gray-500 mt-0.5">
    {visibleCount} av {totalCount} steder synlige
  </p>
  {contextHint && (
    <p className="text-xs text-sky-600 mt-1">{contextHint}</p>
  )}
</div>
```

**POI-liste:**

```tsx
<div className="flex-1 overflow-y-auto">
  <div className="space-y-2 p-3">
    {pois.map(poi => (
      <ExplorerPOICard key={poi.id} {...cardProps} />
    ))}
  </div>
</div>
```

### 5. Oppdatert `ExplorerPOICard.tsx` — "Lagre" hover-animasjon

Endre + knappen til ?? vise "Lagre" label p?? hover:

```tsx
{/* Collection-knapp med animert label */}
<div className="flex items-center gap-0 overflow-hidden">
  {/* Label: slider inn fra h??yre p?? card hover */}
  <span className={cn(
    "text-xs font-medium whitespace-nowrap transition-all duration-200 ease-out",
    isCardHovered && !isInCollection
      ? "opacity-100 max-w-[60px] mr-1.5"
      : "opacity-0 max-w-0",
    isInCollection ? "text-sky-500" : "text-gray-400"
  )}>
    {isInCollection ? "Lagret" : "Lagre"}
  </span>

  {/* Ikon */}
  <button className={cn(
    "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
    isInCollection
      ? "bg-sky-50 text-sky-500"
      : "bg-gray-50 text-gray-400 hover:bg-sky-50 hover:text-sky-500"
  )}>
    {isInCollection ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
  </button>
</div>
```

**Implementasjon:** Legg til `onMouseEnter`/`onMouseLeave` p?? kort-rooten for ?? tracke hover-state.

### 6. Collection counter i navbar

```tsx
<button className="group relative w-10 h-10 rounded-lg flex items-center justify-center
                   hover:bg-gray-100 transition-colors">
  <Bookmark className="w-5 h-5 text-gray-600" />

  {/* Badge med antall */}
  {count > 0 && (
    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-sky-500
                     text-white text-[10px] font-bold flex items-center justify-center
                     animate-in zoom-in-50 duration-200">
      {count}
    </span>
  )}

  {/* Tooltip */}
  <div className="absolute left-full ml-2 ...">
    {count > 0 ? `Min samling (${count})` : "Min samling"}
  </div>
</button>
```

## Kart-justeringer

### Map padding for kamera-operasjoner

Kartet m?? kompensere for navbar + flytende panel slik at `flyTo`, `fitBounds` og senter-beregning bruker synlig omr??de:

```tsx
// I ExplorerMap.tsx - legg til padding prop
const mapPadding = {
  left: 60 + 380 + 16,  // navbar + panel + gap
  top: 16,
  right: 16,
  bottom: 16,
};

// Bruk i alle kamera-operasjoner:
map.flyTo({ center: [lng, lat], padding: mapPadding });
map.fitBounds(bounds, { padding: mapPadding });
```

**Ny prop p?? ExplorerMap:**

```typescript
mapPadding?: { left: number; top: number; right: number; bottom: number };
```

### NavigationControl reposisjonering

Flytt zoom-kontroller til h??yre side (allerede `top-right`, men verifiser at de ikke overlapper med geo-info-banner).

## Breakpoint-strategi

| Viewport | Layout |
|----------|--------|
| `< 1024px` (under `lg`) | Mobil: Fullskjerm kart + ExplorerBottomSheet (uendret) |
| `>= 1024px` (`lg`) | Desktop: Navbar + Kart + Flytende POI-liste |

Breakpoint flyttes fra `md (768px)` til `lg (1024px)` fordi navbar (60px) + panel (380px) = 440px krever minimum ~600px kartbredde for ?? v??re nyttig.

## Eksisterende ExplorerPanel

`ExplorerPanel.tsx` beholdes for mobil bottom sheet (som `children` i `ExplorerBottomSheet`). P?? mobil vises fortsatt travel mode, kategorier osv. inline i panelet. Den nye navbar + floating list er kun for desktop (`lg:`).

## Migreringsplan

### Fase 1: Rydding (fjern features)
1. Fjern time budget UI + dimming-logikk
2. Fjern s??kefelt
3. Fjern package-tabs fra ExplorerPanel (beholdes for mobil forel??pig)
4. Fjern collection bottom bar fra ExplorerPanel

### Fase 2: Nye komponenter
5. Opprett `ExplorerNavbar.tsx` med travel mode + pakke-ikoner + collection counter
6. Opprett `CategoryPopup.tsx` med tag-toggle
7. Opprett `ExplorerPOIList.tsx` (forenklet panel for floating list)

### Fase 3: Layout
8. Endre `ExplorerPage.tsx` layout til ny struktur med navbar + flytende panel + fullskjerm kart
9. Legg til map padding for kamera-operasjoner
10. Oppdater breakpoints fra `md` til `lg`

### Fase 4: POI-kort forbedringer
11. Implementer "Lagre" hover-animasjon p?? `ExplorerPOICard.tsx`
12. Implementer collection badge-animasjon i navbar

## Ekstra UX-forslag

Basert p?? designretningen, her er noen tillegg som vil forbedre opplevelsen:

1. **POI-kort hover ??? kart-highlight:** N??r bruker hovrer over et POI-kort, puls/highlight markk??ren p?? kartet. Gir visuell kobling mellom liste og kart.

2. **Navbar badge-bounce:** N??r et POI legges til i collection, animer badge-counteret (scale bounce) for ?? gi taktil feedback.

3. **Smooth popup-transition:** Kategori-popup f??r en subtle scale+fade animasjon (`transform: scale(0.95) ??? scale(1)`) for polert f??lelse.

4. **Visuell indikator p?? aktive pakker:** Dot-indikator p?? navbar-ikon som viser om noen/alle kategorier i pakken er aktive, selv n??r popup er lukket.

5. **Flytende panel rounded corners + shadow:** Panelet f??r `rounded-2xl` og en myk skygge for ?? skille det visuelt fra kartet, lik et kort som "flyter" over kartet.

6. **Collection view forenklet:** N??r `?c=` collection view er aktiv, skjul pakke-filterikoner i navbar (irrelevant i read-only modus). Vis kun travel mode og en "Tilbake til Explorer" lenke.

## Acceptance Criteria

- [x] Desktop layout: Navbar (60px) + fullskjerm kart + flytende POI-liste (380px)
- [x] Kart er p?? h??yre side, all UI p?? venstre
- [x] Time budget UI og all tilh??rende logikk er fjernet
- [x] S??kefelt er fjernet
- [x] Navbar inneholder travel mode toggle med ikoner + tooltip
- [x] Navbar inneholder 5 pakke-kategorier med ikoner + tooltip
- [x] Klikk p?? pakke-ikon ??pner popup med underkategori-tags
- [x] Tags kan toggles individuelt, filtrerer b??de kart og liste
- [x] "Alt" aktiverer alle kategorier uten popup
- [x] Kun ??n popup ??pen om gangen, lukkes ved klikk utenfor/Escape
- [x] Navbar inneholder collection counter med badge
- [x] POI-kort viser animert "Lagre" label p?? hover
- [x] Kart-kamera kompenserer for panel-bredde (padding)
- [x] Mobil layout (under `lg:`) er uendret (bottom sheet)
- [x] Collection drawer fungerer som f??r (trigget fra navbar)

## Filreferanser

| Fil | Endringer |
|-----|-----------|
| `components/variants/explorer/ExplorerPage.tsx` | Ny layout, fjern time budget props, ny breakpoint |
| `components/variants/explorer/ExplorerPanel.tsx` | Fjern time budget, s??k, packages, collection bar. Beholdes for mobil |
| `components/variants/explorer/ExplorerNavbar.tsx` | **NY** ??? Vertikal navbar |
| `components/variants/explorer/CategoryPopup.tsx` | **NY** ??? Kategori tag-popup |
| `components/variants/explorer/ExplorerPOIList.tsx` | **NY** ??? Forenklet POI-liste for flytende panel |
| `components/variants/explorer/ExplorerPOICard.tsx` | "Lagre" hover-animasjon |
| `components/variants/explorer/ExplorerMap.tsx` | Map padding prop |
| `components/variants/explorer/ExplorerBottomSheet.tsx` | Uendret |
| `components/variants/explorer/explorer-packages.ts` | Uendret |
| `lib/store.ts` | Sett timeBudget default h??yt (valgfritt) |
