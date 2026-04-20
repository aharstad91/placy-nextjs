---
title: "Unified POI-carousel i Report — per-kategori slider med CTA til kart"
category: ui-patterns
tags: [carousel, poi, report, a11y, overscroll, roving-tabindex, ranking]
module: Report
symptoms: "Inkonsekvent POI-visning på tvers av kategorier; Mat & Drikke hadde bilder, andre hadde ingenting; kart-kort og tekst-kort var to ulike komponenter"
root_cause: "FeatureCarousel (med bilder) var hardkodet bare for Mat & Drikke. Ingen generisk slider-komponent for tekstseksjonene."
---

## Problem

`ReportThemeSection` viste POI-kort kun for Mat & Drikke, via `FeatureCarousel` med bilder. Alle andre 6 kategorier manglet slider. I tillegg var kart-bunn-kortene (`ReportMapBottomCard`) og tekst-kortene to separate komponenter med ulikt utseende.

## Løsning

### 1. Slett `FeatureCarousel` og `matdrikke-carousel.ts`

Fjern gammel Mat & Drikke-specifik kode. Ingen backwards-compat shim — git har historikk.

### 2. `ReportThemePOICarousel` — generisk slider for tekstseksjonen

```tsx
// components/variants/report/blocks/ReportThemePOICarousel.tsx
export interface ReportThemePOICarouselProps {
  pois: readonly POI[];
  totalCount: number;      // for CTA-tekst og synlighets-guard
  onOpenMap: () => void;   // required — kontrakt er eksplisitt
  areaSlug?: string | null;
  ariaLabel: string;       // "Steder i Mat & Drikke" — required, ingen hardkodet default
}
```

- Gjenbruker `ReportMapBottomCard` (ingen `rovingTabindex` — native Tab-order er nok her)
- CTA `Se alle {totalCount} steder på kartet` vises iff `totalCount > pois.length`
- Nav-piler vises kun på `md:flex`, mobil bruker native swipe

### 3. `ReportMapBottomCarousel` — a11y-oppgradering (kart-modal)

```tsx
// Ny required prop:
ariaLabel: string;  // "Steder i Mat & Drikke" — 7 instanser per side

// Wrapper: <div> → <section aria-label={ariaLabel} aria-roledescription="carousel">
// Scroll-container: role="listbox" → role="group" + aria-keyshortcuts="ArrowLeft ArrowRight Home End"
// Hvert kort: <li aria-roledescription="slide" aria-label="{n} av {N}: {poi.name}">
// Kortene: rovingTabindex={true} (map-modal: bare aktivt kort i tab-order)
```

### 4. Ranking i data-laget

```ts
// components/variants/report/top-ranked-pois.ts
export function rankScore(poi: Pick<POI, "googleRating" | "poiTier">): number {
  return (poi.googleRating ?? 0) * (4 - (poi.poiTier ?? 3));
}
export function getTopRankedPOIs(pois: readonly POI[], limit: number): readonly POI[] {
  if (limit < 1) return [];
  return [...pois].sort((a, b) => rankScore(b) - rankScore(a)).slice(0, limit);
}
```

- Precomputed i `report-data.ts` som `theme.topRanked` (top-10)
- Tekstseksjon: `theme.topRanked.slice(0, 6)` — top-6 uten re-sort
- Kart-bunn: `theme.topRanked` direkte — konsistent rekkefølge på tvers

### 5. `ReportThemeSection` — integrering

```tsx
const openMap = useCallback(() => setMapDialogOpen(true), []);

// Etter grounding-seksjonen, for alle varianter != "secondary":
{variant !== "secondary" && theme.allPOIs.length > 0 && (
  <div className="mt-8">
    <ReportThemePOICarousel
      pois={theme.topRanked.slice(0, 6)}
      totalCount={theme.allPOIs.length}
      onOpenMap={openMap}
      areaSlug={areaSlug}
      ariaLabel={`Steder i ${theme.name}`}
    />
  </div>
)}
```

## A11y-detaljer (W3C APG 2025+)

```
section[aria-roledescription=carousel, aria-label="Steder i X"]
  ul[role=group, aria-orientation=horizontal, aria-keyshortcuts="ArrowLeft ArrowRight Home End"]
    li[aria-roledescription=slide, aria-label="1 av 6: Stedsnamn"]
      button[aria-pressed=isActive, data-poi-id=id]
```

**Ikke** `role=listbox` — listbox er for selekterbare widgets, ikke editorial POI-kort.
**Ikke** `role=option` (tidligere bug i `ReportMapBottomCard`) — erstattet med `aria-pressed`.

## iOS swipe-gotcha

```tsx
// RIKTIG: hindrer pull-to-refresh uten å drepe horizontal swipe
className="... overscroll-x-contain ..."

// FEIL: dreper iOS horizontal swipe (safari touch cancellation)
className="... touch-none ..."
```

`overscroll-x-contain` = `overscrollBehaviorX: "contain"` i inline styles. Safari 16+ universell støtte.

## Gotcha: `scrollRef` type ved container-endring

Endring av scroll-container fra `<div>` til `<ul>` krever oppdatert ref-type:

```tsx
// Feil etter <ul> → TypeScript-feil
const scrollRef = useRef<HTMLDivElement>(null);

// Riktig
const scrollRef = useRef<HTMLUListElement>(null);
// Også: React.KeyboardEvent<HTMLUListElement> i handleKeyDown
```

## Invariant-test for ranking

```ts
// Invariant: slice(0,6) av top-10 === top-6 (same sort, only limit differs)
it("invariant: top-6 er første 6 av top-10", () => {
  const top10 = getTopRankedPOIs(pois, 10);
  const top6 = getTopRankedPOIs(pois, 6);
  expect(top6.map(p => p.id)).toEqual(top10.slice(0, 6).map(p => p.id));
});
```

## Filer

| Fil | Status |
|-----|--------|
| `components/variants/report/blocks/ReportThemePOICarousel.tsx` | NY |
| `components/variants/report/blocks/ReportThemePOICarousel.test.tsx` | NY |
| `components/variants/report/top-ranked-pois.ts` | NY |
| `components/variants/report/top-ranked-pois.test.ts` | NY |
| `components/variants/report/report-data.ts` | ENDRET — `topRanked` felt |
| `components/variants/report/ReportMapBottomCard.tsx` | ENDRET — `rovingTabindex`, `aria-pressed` |
| `components/variants/report/blocks/ReportMapBottomCarousel.tsx` | ENDRET — `ariaLabel`, a11y-semantikk |
| `components/variants/report/ReportThemeSection.tsx` | ENDRET — fjernet FeatureCarousel, lagt til ny slider |
| `components/variants/report/blocks/FeatureCarousel.tsx` | SLETTET |
| `components/variants/report/blocks/matdrikke-carousel.ts` | SLETTET |
