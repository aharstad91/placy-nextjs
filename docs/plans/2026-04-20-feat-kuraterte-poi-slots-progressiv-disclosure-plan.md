---
title: "feat: Kuraterte POI-slots + progressiv disclosure i Report-tekstseksjon"
type: feat
date: 2026-04-20
brainstorm: docs/brainstorms/2026-04-20-kuratert-poi-slots-lazy-kart-brainstorm.md
---

# feat: Kuraterte POI-slots + progressiv disclosure i Report

## Overview

To sammenkoblede forbedringer av Report-tekstseksjonen:

1. **Progressiv disclosure**: Placy-narrativ er synlig som default (truncated med fade). POI-slider, Gemini-grounding og kart-preview er skjult bak "Les mer". Brukeren viser interesse → innholdet avdekkes i lag.

2. **Kuraterte slot-logikk i POI-slider**: Slot 1–3 per tema er definerte "ankerplass"-kategorier (f.eks. barneskole, dagligvare, bussholdeplass). Slot 4–6 fylles av score-ranking. Tomme anchors faller tilbake til ranking.

## Problem Statement

I dag vises all tekst, POI-slider og kart-preview alltid for alle kategorier — uavhengig av brukerens interesse. Brukere som ikke er interessert i "Trening & Aktivitet" skroller forbi mye innhold de ikke ba om. POI-slideren viser også ren score-ranking uten hensyn til at boligkjøpere alltid vil vite "hvilken barneskole sokner dette til?" og "er det en dagligvare i nærheten?".

## Proposed Solution

### Seksjonsstruktur etter endring

```
DEFAULT (alltid synlig):
┌─────────────────────────────────────┐
│ Tema-header (Barn & Aktivitet)      │
│ Placy narrativ tekst...             │
│ ...........fade-out gradient....... │
│ [Les mer om Barn & Aktivitet ↓]     │
└─────────────────────────────────────┘

ETTER "Les mer"-klikk:
┌─────────────────────────────────────┐
│ Tema-header                         │
│ Placy narrativ tekst (full)         │
│ ─── POI-slider (6 kort) ───         │  ← første reveal
│ Gemini grounding-tekst              │
│ [Se alle 12 steder på kartet →]     │  ← CTA
└─────────────────────────────────────┘

ETTER CTA-klikk:
┌─────────────────────────────────────┐
│ ...                                 │
│ [Se alle 12 steder på kartet →]     │
│ ┌── Dormant kart-preview (animert) ┐│  ← animate-in
│ │  [klikk → UnifiedMapModal]       ││
│ └──────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Kart-placement (kritisk avklaring)

Kart-preview flyttes **inn i den ekspanderte seksjonen** — den er IKKE lenger alltid synlig under teksten. Dette gir den rene progressive disclosure-flyten:

- Default: kun narrativ-tekst
- Les mer: slider + grounding + CTA
- CTA-klikk: + kart-preview
- Kart-klikk: full modal

## Technical Approach

### Arkitektur

```
report-data.ts
  transformToReportData()
    theme.curatedSliderPOIs: readonly POI[]  ← NY (6 items, build-time)
    theme.topRanked: readonly POI[]          ← BEHOLDT (10 items, for kart-modal)

top-ranked-pois.ts
  THEME_ANCHOR_SLOTS: Record<string, AnchorSlot[]>  ← NY
  getCuratedPOIs(pois, themeId, limit): readonly POI[]  ← NY

ReportThemeSection.tsx
  expanded: boolean  ← NY state (default false)
  mapPreviewVisible: boolean  ← NY state (default false)
  Placy narrativ: truncated + fade når !expanded
  POI-slider: kun når expanded, bruker theme.curatedSliderPOIs
  Grounding-komponent: kun når expanded
  Dormant kart-preview: kun når expanded && mapPreviewVisible
  openMap callback: → setMapPreviewVisible(true) (ikke setMapDialogOpen)
  Dormant kart onClick: → setMapDialogOpen(true)
```

### Implementation Phases

#### Phase 1 — Curated POI util

**Fil: `components/variants/report/top-ranked-pois.ts`**

```typescript
// Ny type
export interface AnchorSlot {
  categoryId: string;    // poi.category.id eksakt match
  poiTier?: 1 | 2 | 3;  // valgfri tier-filter (barn-oppvekst trenger det)
}

// Ny config — BOLIG-temaer
export const THEME_ANCHOR_SLOTS: Record<string, AnchorSlot[]> = {
  "barn-oppvekst": [
    { categoryId: "skole", poiTier: 1 },   // barneskole
    { categoryId: "skole", poiTier: 2 },   // ungdomsskole
    { categoryId: "skole", poiTier: 3 },   // videregående
  ],
  "hverdagsliv": [
    { categoryId: "supermarket" },
    { categoryId: "pharmacy" },
    { categoryId: "shopping" },
  ],
  "trening-aktivitet": [
    { categoryId: "gym" },  // nærmeste
    { categoryId: "gym" },  // nest nærmeste
    { categoryId: "gym" },  // 3. nærmeste
  ],
  "transport": [
    { categoryId: "bus" },
    { categoryId: "bike" },
    { categoryId: "carshare" },
  ],
  "natur-friluftsliv": [
    { categoryId: "park" },
    { categoryId: "outdoor" },
    { categoryId: "badeplass" },
  ],
  "opplevelser": [
    { categoryId: "library" },
    { categoryId: "cinema" },
    // slot 3 = ranking fallback
  ],
  // mat-drikke: ingen anchor-slots → pure ranking
};

// Ny funksjon
export function getCuratedPOIs(
  pois: readonly POI[],
  themeId: string,
  limit: number,
): readonly POI[] {
  const anchors = THEME_ANCHOR_SLOTS[themeId] ?? [];
  const remaining = [...pois].sort(
    (a, b) => (a.travelTime?.walk ?? Infinity) - (b.travelTime?.walk ?? Infinity)
  );
  const result: POI[] = [];

  for (const anchor of anchors) {
    if (result.length >= limit) break;
    const idx = remaining.findIndex(
      (p) =>
        p.category.id === anchor.categoryId &&
        (anchor.poiTier == null || p.poiTier === anchor.poiTier),
    );
    if (idx >= 0) {
      result.push(remaining.splice(idx, 1)[0]);
    }
  }

  // Fyll resterende slots med ranking (immutabel sort — ikke muter remaining)
  const pinnedIds = new Set(result.map((p) => p.id));
  const ranked = [...remaining]
    .filter((p) => !pinnedIds.has(p.id))
    .sort((a, b) => rankScore(b) - rankScore(a));
  for (const poi of ranked) {
    if (result.length >= limit) break;
    result.push(poi);
  }

  return result;
}
```

**Tiebreaker-logikk**: innenfor én anchor-type velges nærmeste (`travelTime.walk` asc). Fallback-ranking er `rankScore` desc. Deduplication er ivaretatt ved `splice` — brukt POI fjernes fra `remaining`-pool.

**Fil: `components/variants/report/top-ranked-pois.test.ts`** — legg til tester:
- TC-A1: Barn & Aktivitet — barneskole i slot 1, ungdomsskole i slot 2
- TC-A2: Manglende tier → ranking-fill (ingen VGS → slot 3 er beste fra ranking)
- TC-A3: Trening med 3 gyms → alle 3 ulike gyms, nærmest-first
- TC-A4: Mat & Drikke (ingen anchors) → pure ranking, identisk med `getTopRankedPOIs(pois, 6)`
- TC-A5: Tom POI-liste → returnerer []
- TC-A6: Færre enn `limit` POI-er totalt → returnerer hva som finnes (ingen padding)
- TC-A7: Dedup — anchor-POI finnes ikke i ranking-fill-slots

#### Phase 2 — report-data.ts: nytt curatedSliderPOIs-felt

**Fil: `components/variants/report/report-data.ts`**

```typescript
// I ReportTheme interface (ca. linje 89):
// Optional for å unngå kompileringsfeil i eksisterende test-fixtures som konstruerer ReportTheme-literals
curatedSliderPOIs?: readonly POI[];  // 6 items — kuraterte ankerplass + ranking-fill

// I transformToReportData, ved theme-assembly (ca. linje 577):
import { getCuratedPOIs } from "./top-ranked-pois";

// I samme blokk som topRanked:
curatedSliderPOIs: getCuratedPOIs(filtered, theme.id, 6),
```

`theme.topRanked` (10 items, pure ranking) beholdes for kart-modal bunn-carousel.

#### Phase 3 — ReportThemeSection.tsx: progressive disclosure

**Tilstand (ca. linje 99 etter mapDialogOpen):**

```typescript
const [expanded, setExpanded] = useState(false);
const [mapPreviewVisible, setMapPreviewVisible] = useState(false);
```

**Placy narrativ — truncation + fade (der lowerNarrative/extendedBridgeText rendres):**

Bruk `line-clamp` fremfor `max-h` i px — font-size-agnostisk, klipper presist på linjegrense:

```tsx
<div className={`relative ${expanded ? "" : "line-clamp-[6] overflow-hidden"}`}>
  {/* ...eksisterende narrativ-innhold... */}
  {!expanded && (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-white" />
  )}
</div>

{!expanded ? (
  <button
    type="button"
    onClick={() => setExpanded(true)}
    className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#6a5f51] hover:text-[#3a3530] transition-colors"
  >
    Les mer om {theme.name}
    <ChevronDown className="w-3.5 h-3.5" />
  </button>
) : (
  <button
    type="button"
    onClick={() => { setExpanded(false); setMapPreviewVisible(false); }}
    className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#6a5f51] hover:text-[#3a3530] transition-colors"
  >
    Vis mindre
    <ChevronUp className="w-3.5 h-3.5" />
  </button>
)}
```

**Gradient-farge**: verifiser at `to-white` matcher seksjonsbakgrunn. Seksjonene alternerer bakgrunnsfarge — sjekk om `to-[#f5f1ec]` trengs for annenhver seksjon.
```

**POI-slider — kun når expanded (husk variant !== "secondary" guard):**

```tsx
{expanded && variant !== "secondary" && theme.curatedSliderPOIs.length > 0 && (
  <div className="mt-8">
    <ReportThemePOICarousel
      pois={theme.curatedSliderPOIs}
      totalCount={theme.allPOIs.length}
      onOpenMap={() => setMapPreviewVisible(true)}  // ← ENDRET
      areaSlug={areaSlug}
      ariaLabel={`Steder i ${theme.name}`}
    />
  </div>
)}
```

**Grounding-komponent — kun når expanded:**

```tsx
{expanded && (
  <>
    {/* ...eksisterende grounding-rendering... */}
  </>
)}
```

**Dormant kart-preview — flyttes inn i expanded-seksjon. `!mapDialogOpen` er load-bearing (dual-WebGL-prevensjon):**

```tsx
{expanded && mapPreviewVisible && !mapDialogOpen && theme.allPOIs.length > 0 && (
  <div className="mt-6 animate-in fade-in duration-300">
    {/* ...eksisterende dormant preview-kode... */}
    {/* onClick → setMapDialogOpen(true) som i dag */}
  </div>
)}
```

**OBS**: Fjern den eksisterende `{!mapDialogOpen && ...dormant preview...}` som i dag er utenfor expanded-seksjonen.

**Callback-endring**: `openMap` i ReportThemeSection endres fra `setMapDialogOpen(true)` til `setMapPreviewVisible(true)`. Modal-åpning skjer fra kart-preview-klikk som alltid.

#### Phase 4 — Navnekollisjon "Les mer"-knapper

Seksjonsnivå-knappen bruker teksten **"Les mer om [tema.name]"** (f.eks. "Les mer om Barn & Aktivitet"). `ReportCuratedGrounded`s interne knapp bruker "Les hele utdypingen". Ingen konflikt — distinkte labels, ingen a11y-problem.

## Acceptance Criteria

### Funksjonelle krav

- [ ] TC-1: Default-tilstand viser kun Placy-narrativ (truncated) + "Les mer om [tema]"-knapp. POI-slider, grounding og kart-preview er ikke i DOM.
- [ ] TC-2: Klikk på "Les mer om [tema]" avdekker POI-slider, grounding og CTA (kart-preview fortsatt skjult).
- [ ] TC-3: CTA "Se alle N steder på kartet" viser kart-preview (dormant) under grounding med fade-in animasjon.
- [ ] TC-4: Klikk på kart-preview åpner UnifiedMapModal.
- [ ] TC-5: "Vis mindre"-knapp kollapser seksjonen og skjuler kart-preview igjen.
- [ ] TC-6: Barn & Aktivitet — slot 1 er barneskole (poiTier=1), slot 2 er ungdomsskole (poiTier=2) hvis begge eksisterer.
- [ ] TC-7: Transport — slot 1 er bussholdeplass, slot 2 er bysykkelstasjon, slot 3 er bildeling hvis alle kategorier eksisterer.
- [ ] TC-8: Manglende anchor-slot fylles av neste beste fra ranking — slider er alltid 6 kort (eller færre hvis totalantall POI-er < 6).
- [ ] TC-9: Trening — 3 ulike gyms, sortert nærmest-first.
- [ ] TC-10: Mat & Drikke — ingen anchor-slots, pure ranking (identisk med `getTopRankedPOIs(pois, 6)`).
- [ ] TC-11: `theme.topRanked` (kart-modal bunn-carousel) er uendret — fortsatt pure ranking, 10 items.
- [ ] TC-12: POI-slider CTA viser riktig antall: `theme.allPOIs.length`.

### Edge cases

- [ ] TC-13: Tema med 0 POI-er — "Les mer"-seksjon vises ikke (slider er allerede conditionally hidden).
- [ ] TC-14: Tema med 2 POI-er totalt — slider viser 2 kort, ingen padding.
- [ ] TC-15: Ingen bysykkel/bildeling i nærhet — transport-slider viser bussholdeplass + ranking-fill.
- [ ] TC-16: `mapDialogOpen` allerede true (f.eks. åpnet et annet sted) — CTA-klikk setter kun `mapPreviewVisible`, påvirker ikke modal-tilstand.

### Kvalitetskrav

- [ ] `npm run lint` — 0 feil
- [ ] `npm test` — alle eksisterende + nye tester grønne
- [ ] `npx tsc --noEmit` — 0 typefeil
- [ ] `npm run build` — bygger uten feil

## Dependencies & Risks

### Avhengigheter

- `theme.id` må eksistere på `ReportTheme`-objektet og matche nøklene i `THEME_ANCHOR_SLOTS` (f.eks. `"barn-oppvekst"`, `"transport"`). Verifiser i `report-data.ts` at `theme.id` propageres korrekt.
- `poi.category.id` og `poi.poiTier` må være pålitelig populert for anchor-matching.
- `poi.travelTime?.walk` brukes som tiebreaker — kan mangle for noen POI-er. Fallback: `Infinity` (sist i anchor-kandidater).

### Risiko

**MEDIUM: `travelTime.walk` er SSR-ikke-populert for Opplevelser**
Eksisterende kjent bug (Opplevelser-tema på Stasjonskvartalet har manglende travelTime). Anchor-slots for Opplevelser bruker `library` og `cinema` — disse matcher på `categoryId`, ikke `travelTime`. Tiebreaker er `travelTime.walk` for candidater av samme anchor-type, men da Opplevelser har 2 distinkte anchors (library, cinema) er dette en non-issue. Risiko: lav.

**MEDIUM: `theme.id` propagering**
Verifiser at `transformToReportData` inkluderer `id` på `ReportTheme`. Hvis ikke: legg til.

**LAV: "Vis mindre" og `mapPreviewVisible` reset**
Når brukeren klikker "Vis mindre", resetter vi `mapPreviewVisible(false)` slik at kart-preview er skjult neste gang seksjonen ekspanderes. Dette er korrekt adferd.

**LAV: Gradient-farge**
Narrativ-fade bruker `to-white`. Seksjonene kan ha ulike bakgrunnsfarger (alternating). Sjekk at gradient stemmer med seksjons-bakgrunn.

## Filer som endres

| Fil | Type | Endring |
|-----|------|---------|
| `components/variants/report/top-ranked-pois.ts` | ENDRET | + `AnchorSlot`, `THEME_ANCHOR_SLOTS`, `getCuratedPOIs` |
| `components/variants/report/top-ranked-pois.test.ts` | ENDRET | + TC-A1 til TC-A7 |
| `components/variants/report/report-data.ts` | ENDRET | + `curatedSliderPOIs` på `ReportTheme` + populering |
| `components/variants/report/ReportThemeSection.tsx` | ENDRET | + `expanded`, `mapPreviewVisible` state + progressive disclosure-struktur |

Ingen nye filer. Ingen slettinger.

## References

- Brainstorm: `docs/brainstorms/2026-04-20-kuratert-poi-slots-lazy-kart-brainstorm.md`
- `ReportCuratedGrounded.tsx:55` — eksisterende `expanded` pattern (CSS-teknikk gjenbrukes)
- `components/variants/report/top-ranked-pois.ts` — eksisterende `rankScore` + `getTopRankedPOIs`
- `lib/themes/bransjeprofiler.ts` — `BOLIG_THEMES` med kategori-ID-er per tema
- `docs/solutions/ui-patterns/unified-poi-carousel-report-20260420.md` — forrige feature
- SpecFlow-gap: `mapPreviewVisible` vs. alltid-synlig-kart er løst — preview flyttes inn i expanded-seksjon
