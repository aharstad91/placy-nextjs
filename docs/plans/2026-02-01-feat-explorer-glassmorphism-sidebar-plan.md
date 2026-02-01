---
title: "feat: Explorer glassmorphism sidebar"
type: feat
date: 2026-02-01
---

# Explorer: Glassmorphism sidebar med kart bak

## Overview

Gjor sidebar-panelet semi-transparent med backdrop-blur slik at kartet skinner subtilt gjennom. Kartet rendres fullbredde bak sidebaren, og sidebaren flyter oppaa med glassmorphism-effekt. Gir et mer flytende, moderne UI.

## Navaerende layout

```
+---------------------------+----------------+
|                           |                |
|   Map (flex-1 / 60%)     | Sidebar (40%)  |
|                           |  bg-white      |
|                           |  border-l      |
+---------------------------+----------------+
```

Kart og sidebar er side-by-side i en flex-row. Kartet stoppes ved sidebar-kanten.

## Nytt layout

```
+------------------------------------------+
|                                          |
|   Map (fullscreen, absolute inset-0)     |
|                          +---------------+
|                          | Sidebar (40%) |
|                          | bg-white/92   |
|                          | backdrop-blur  |
|                          | shadow         |
+------------------------------------------+
```

Kartet rendres fullbredde. Sidebaren er absolutt posisjonert oppaa kartet med semi-transparent bakgrunn og blur.

## Teknisk tilnaerming

### ExplorerPage.tsx — Desktop layout

Endre fra flex-row split til layered approach:

```tsx
{/* Desktop: fullscreen map + floating sidebar */}
<div className="hidden lg:block h-full relative">
  {/* Map: full viewport */}
  <div className="absolute inset-0">
    <ExplorerMap {...mapProps} mapPadding={desktopMapPadding} />
  </div>

  {/* Sidebar: floating right panel */}
  <div className="absolute top-0 right-0 bottom-0 w-[40%]
                  bg-white/92 backdrop-blur-md
                  border-l border-white/50
                  shadow-[-4px_0_24px_rgba(0,0,0,0.06)]
                  overflow-hidden flex flex-col z-10">
    <ExplorerPOIList {...listProps} />
  </div>
</div>
```

- [x] Endre desktop layout fra `lg:flex` til `lg:block relative`
- [x] Map wrapper: `absolute inset-0` (fullbredde)
- [x] Sidebar wrapper: `absolute top-0 right-0 bottom-0 w-[40%]` med glassmorphism
- [x] Oppdater `desktopMapPadding` — sett `right: 40vw` saa kartet sentrerer POI-er utenfor sidebar-omraadet

### Glassmorphism-stil

Basert paa eksisterende moenstre i kodebasen (`master-map.tsx`, `ExplorerMap.tsx` info banner):

| Egenskap | Verdi | Forklaring |
|----------|-------|------------|
| Bakgrunn | `bg-white/92` | 92% opacity — subtilt gjennomsiktig |
| Blur | `backdrop-blur-md` | Middels blur (12px) — kart skimtes men er uskarp |
| Border | `border-l border-white/50` | Mykere kant enn solid gray |
| Shadow | `shadow-[-4px_0_24px_rgba(0,0,0,0.06)]` | Subtil venstreskygge for dybde |

### ExplorerPOIList.tsx — Bakgrunnsfarger

Flere elementer inne i POI-lista har hardkodet `bg-white` som maa justeres:

- [x] Header-seksjon: Transparent (arver fra parent)
- [x] Filter toolbar: Transparent (arver fra parent)
- [x] Gradient fade i bunn: Endre fra `from-white` til `from-white/92` (matcher sidebar-opacity)
- [x] Collection bar empty state: Endre fra `bg-white/95` til `bg-white/80 backdrop-blur-sm` (stacker paa sidebar-blur)
- [x] Separator: Endre fra `bg-gray-100` til `bg-gray-200/50`
- [x] POI cards: Beholder `bg-white` — kortene skal vaere solide for lesbarhet
- [x] Dropdown-paneler: Beholder `bg-white` — dropdowns skal vaere solide

### ExplorerPOICard.tsx — Kort-stil

- [x] Vurder om kort trenger `bg-white` eksplisitt (de har det sannsynligvis via parent eller egen stil)
- [x] Ingen endring paakrevd om kort allerede er solide

### Map padding

Oppdater `desktopMapPadding` saa kartet vet at hoyre 40% er dekket:

```tsx
const desktopMapPadding = {
  left: 0,
  top: 0,
  right: typeof window !== "undefined" ? window.innerWidth * 0.4 : 500,
  bottom: 0,
};
```

- [x] Beregn right-padding dynamisk basert paa vindubredde
- [x] Eventuelt bruk en fast verdi som `right: 500` som tilnaerming

### Padding-oppdatering (px-8, py-8)

Bruker ville ha mer luft i sidebaren:

- [x] Header: Endre `px-4 pt-4 pb-3` til `px-8 pt-8 pb-3`
- [x] Filter toolbar: Endre `px-4 pb-3` til `px-8 pb-3`
- [x] Separator: Endre `mx-4` til `mx-8`
- [x] POI-liste innhold: Endre `px-4 py-4` til `px-8 py-4`
- [x] Collection bar: Endre `px-4 pb-4` til `px-8 pb-4`
- [x] Empty state: Endre `px-8` til `px-12` (relativt til ny base)

## Acceptance Criteria

- [x] Kartet rendres fullbredde bak sidebaren paa desktop
- [x] Sidebar har semi-transparent bakgrunn med blur-effekt
- [x] Kartet kan saavidt skimtes gjennom sidebaren
- [x] POI-kort forblir fullt lesbare (solid bakgrunn)
- [x] Dropdowns forblir solide og lesbare
- [x] Sidebar har px-8 og py-8 padding
- [x] Kartet sentrerer korrekt med padding for sidebar-omraadet
- [x] Ingen endring paa mobil-layout

## Referanser

- Eksisterende glassmorphism: `components/map/master-map.tsx:61` (`bg-white/95 backdrop-blur-sm`)
- Eksisterende glassmorphism: `components/variants/explorer/ExplorerMap.tsx:333` (info banner)
- Eksisterende glassmorphism: `components/variants/explorer/ExplorerPOIList.tsx:387` (collection bar)
