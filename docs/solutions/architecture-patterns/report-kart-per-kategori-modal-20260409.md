---
module: Report
date: 2026-04-09
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Sticky sidebar-kart dominerte layouten og viste alle kategoriers markorer samtidig"
  - "Svak visuell kobling mellom tekst og kart — bruker visste ikke hvilke POI-er som horte til teksten"
  - "60/40 split-layout ga for lite plass til innhold og for mye til kart"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [report, map, layout, modal, per-category, mapbox, ux-architecture]
---

# Report kart-arkitektur: Fra sticky sidebar til per-kategori modal

## Problem

Report-produktet brukte ett sticky kart (40% sidebar) som viste alle POI-er og oppdaterte seg basert pa scroll-posisjon. Dette ga svak visuell kobling mellom tekst og kart, kartet dominerte layouten, og det skjedde for mye samtidig.

## Environment

- Module: Report (components/variants/report/)
- Stack: Next.js 14, react-map-gl/mapbox, shadcn Dialog
- Date: 2026-04-09

## Symptoms

- Kartet til hoyre dominerte — bruker saa alle kategoriers markorer samtidig
- Scrollsynkronisering var kompleks (marker pooling, opacity toggle, theme switching)
- 60/40 split-layout ga lite plass til narrativ tekst
- Ingen tydelig kobling mellom inline-POI i teksten og markorer pa kartet

## Solution

Tre-stegs refaktorering:

### Steg 1: Per-kategori kart

Erstattet ett sticky kart med individuelle kart per kategoriseksjon.

**Ny komponent `ReportThemeMap.tsx`:**
- Mottar kun én kategoris POI-er
- Illustrated map style (MAP_STYLE_STANDARD + applyIllustratedTheme)
- Hotel/prosjekt-marker, tier-aware POI-markorer, MarkerTooltip
- cooperativeGestures for a unnga utilsiktet zoom

**Layout endret fra 60/40 split til full bredde:**
```tsx
// FOR: 60/40 split med sticky kart
<div className="hidden lg:flex">
  <div className="w-[60%]">{/* tekst */}</div>
  <div className="w-[40%]">{/* sticky kart for ALLE temaer */}</div>
</div>

// ETTER: Full bredde, kart per seksjon
<div className="px-16">
  {themes.map(theme => (
    <ReportThemeSection theme={theme} />
    {/* Hvert tema har eget kart under teksten */}
  ))}
</div>
```

### Steg 2: To-stegs kart-aktivering med modal

**State 1 (dormant):** Kart vises i `max-w-4xl` (lik tekst-bredde) med gradient overlay og "Utforsk kartet"-CTA. Ikke interaktivt.

**State 2 (modal):** CTA apner shadcn Dialog (80vw x 80vh) med:
- Header: kategori-ikon + navn til venstre, X-knapp til hoyre
- Fullt interaktivt kart
- Venstre drawer (desktop) / bunn drawer (mobil) for POI-detaljer ved marker-klikk

```tsx
<Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
  <DialogContent className="flex flex-col w-[90vw] md:w-[80vw] h-[80vh] !max-w-none p-0">
    {/* Header + Map + Drawer */}
  </DialogContent>
</Dialog>
```

**Viktig: `!max-w-none` trengs** fordi shadcn DialogContent har `sm:max-w-md` som overstyrer vanlig `max-w-none` (responsive prefix er mer spesifikt i Tailwind).

### Steg 3: Featured POI labels

POI-er som nevnes i narrativ tekst (inline-POI) far permanente MarkerTooltip-labels pa kartet i modalen.

```tsx
// Ekstraher POI-IDer fra tekst-segmenter
const featuredPOIIds = useMemo(
  () => new Set(segments.filter(s => s.type === "poi" && s.poi).map(s => s.poi!.id)),
  [segments]
);

// I ReportThemeMap: vis tooltip for featured POI-er
const isFeatured = activated && featuredPOIIds?.has(poi.id);
{activated && (isHovered || isHighlighted || isFeatured) && (
  <MarkerTooltip ... />
)}
```

## Why This Works

1. **Visuell kobling:** Hvert kart viser kun sin kategoris POI-er — ingen stoy fra andre kategorier
2. **Progressiv disclosure:** Dormant kart gir preview, modal gir full utforskning
3. **Self-contained state:** Hver seksjon eier sin egen POI-state — ingen global koordinering nodvendig
4. **Featured labels:** Kobler narrativ tekst til kartets markorer visuelt

## Filer

| Fil | Rolle |
|-----|-------|
| `ReportThemeMap.tsx` | Per-kategori kartkomponent med activated/dormant modus |
| `ReportMapDrawer.tsx` | Venstre sidebar (desktop) / bunn drawer (mobil) for POI-detaljer |
| `ReportThemeSection.tsx` | Eier kart-state, Dialog, dormant preview, featured POI-beregning |
| `ReportPage.tsx` | Forenklet — ingen kart-state, ingen sticky map, full bredde layout |

## Slettet dead code

- `ReportStickyMap.tsx` — 483 linjer, marker pooling, theme switching
- `MapMetadata` komponent i ReportPage
- `ActivePOIState` type (erstattet av lokal state per seksjon)

## Prevention

- **Per-seksjon kart > sticky kart** nar innholdet er seksjonert og brukeren leser lineaert
- **Modal for utforskning** unngaar at kartet tar permanent plass i layouten
- **`!important` i Tailwind** (`!max-w-none`) trengs nar du overstyrer responsive klasser fra shadcn-komponenter
- **cooperativeGestures** for kart i scrollbar innhold — unngaar utilsiktet zoom

## Related Issues

- See also: [inline-poi-kortsystem-5-varianter-20260408.md](../feature-implementations/inline-poi-kortsystem-5-varianter-20260408.md)
