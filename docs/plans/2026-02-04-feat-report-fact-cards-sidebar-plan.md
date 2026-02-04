---
title: "feat: Report Fact Cards Sidebar"
type: feat
date: 2026-02-04
deepened: 2026-02-04
brainstorm: docs/brainstorms/2026-02-04-report-fact-cards-brainstorm.md
---

# feat: Report Fact Cards Sidebar

## Enhancement Summary

**Deepened on:** 2026-02-04
**Research agents used:** best-practices-researcher (×2), code-simplicity-reviewer, kieran-typescript-reviewer, architecture-strategist, performance-oracle, learnings-researcher, Context7

### Key Improvements
1. **Simplified file structure** - Flatten to single file with inline components (from 7 files to 1-2)
2. **Proper discriminated union types** - Type-safe card rendering with exhaustive checking
3. **Single-pass computation** - O(n) instead of O(4n + n log n) per theme
4. **Mobile snap-scroll** - Native CSS scroll-snap with fade affordances

### New Considerations Discovered
- Use `useMemo` for card computation to prevent re-renders
- Type guards for null-safe filtering
- Fixed card dimensions to prevent CLS
- Fade edges for scroll affordance on mobile

---

## Overview

Implementer en **Sidebar Fact Grid** med 4-5 dynamiske fact cards per kategori-seksjon i Report. Kortene viser statistikk, highlights og innsikt generert fra POI-data for å tilføre redaksjonell verdi uten manuelt arbeid.

**Desktop:** Vertikal sidebar til venstre for kartet
**Mobil:** Horisontalt scrollbar rad over POI-listen
**Interaksjon:** Ikke klikkbare (ren informasjon)

## Korttyper

| # | Type | Innhold | Datakilde |
|---|------|---------|-----------|
| 1 | **Statistics** | "13 steder • Snitt ★ 4.4 • 11k anmeldelser" | `theme.stats` |
| 2 | **Top Pick** | Høyest rangerte POI + editorialHook | `highlightPOIs[0]` |
| 3 | **Category Split** | "8 restauranter • 5 kaféer" | Gruppering av `allPOIs` |
| 4 | **Fun Fact** | Lokal innsikt eller auto-generert | Fallback-kjede (se under) |
| 5 | **Hidden Gem** | POI med høy rating, få anmeldelser | Filter: rating ≥4.3, reviews <500 |

### Fallback-kjeder

**Fun Fact:**
1. `theme.config.categoryFacts[random]` (ny type-utvidelse)
2. `highlightPOIs[0].localInsight`
3. `highlightPOIs[0].editorialHook`
4. Skip kortet

**Top Pick (tie-breaker):**
1. Høyest rating
2. Flest anmeldelser
3. Har editorialHook
4. Alfabetisk

## Technical Approach

### Research Insights: File Structure

**Recommendation from simplicity review:** Start with 1 file, split only when needed.

```
components/variants/report/
├── ReportFactCards.tsx          # Alt i én fil (~200 LOC)
└── (fact-card-utils.ts)         # Kun hvis > 250 LOC
```

**Why single file:**
- 5 card types with 20-30 lines each = ~150 LOC total
- Discriminated union pattern keeps types colocated
- Easier to understand data flow
- Split later if any card exceeds 80 LOC

### Research Insights: Type Safety

**Proper discriminated union (from TypeScript review):**

```typescript
// ✅ Correct: Coupled type/data enables narrowing
export type FactCardData =
  | { type: 'statistics'; data: StatisticsData }
  | { type: 'topPick'; data: TopPickData }
  | { type: 'categorySplit'; data: CategorySplitData }
  | { type: 'funFact'; data: FunFactData }
  | { type: 'hiddenGem'; data: HiddenGemData };

// ❌ Wrong: Uncoupled - TypeScript can't narrow
interface FactCardData {
  type: 'statistics' | 'topPick' | ...;
  data: StatisticsData | TopPickData | ...;
}
```

**Type guard for null-safe filtering:**

```typescript
function hasGoogleRating(poi: POI): poi is POI & { googleRating: number } {
  return poi.googleRating != null;
}

// Now TypeScript knows googleRating exists after filter
const rated = pois.filter(hasGoogleRating);
rated[0].googleRating; // No ?? needed
```

### Research Insights: Performance

**Problem:** Multiple iterations over POI arrays (O(4n + n log n))

**Solution:** Single-pass computation with `useMemo`:

```typescript
const factCards = useMemo(() => {
  // Single pass collects all data
  const { categoryCounts, hiddenGem } = theme.allPOIs.reduce(
    (acc, poi) => {
      // Category counting
      acc.categoryCounts[poi.category.id] = (acc.categoryCounts[poi.category.id] || 0) + 1;

      // Hidden gem tracking (no sort needed)
      if (isHiddenGemCandidate(poi)) {
        if (!acc.hiddenGem || poi.googleRating! > acc.hiddenGem.googleRating!) {
          acc.hiddenGem = poi;
        }
      }
      return acc;
    },
    { categoryCounts: {} as Record<string, number>, hiddenGem: null as POI | null }
  );

  return buildFactCards(theme, categoryCounts, hiddenGem);
}, [theme]);
```

**Complexity:** O(4n + n log n) → O(n)

### Data-flow

```
ReportInteractiveMapSection.tsx
  └─ useMemo: computeFactCards(theme)
       └─ ReportFactCards (presentational)
            └─ Switch on card.type → render correct card
```

### Layout-integrasjon

**Desktop (from architecture review):**

```tsx
// ReportInteractiveMapSection.tsx - desktop
<div className="hidden lg:flex gap-8">
  {/* Fact cards sidebar - fixed width */}
  <div className="w-[280px] flex-shrink-0">
    <div className="sticky top-20 space-y-3">
      {factCards.map(card => (
        <FactCard key={card.type} card={card} />
      ))}
    </div>
  </div>

  {/* Eksisterende: POI-grid + kart */}
  <div className="flex-1 flex gap-16">
    <div className="w-1/2">...</div>
    <div className="w-1/2">...</div>
  </div>
</div>
```

**Mobil med snap-scroll (from Tailwind research):**

```tsx
// ReportInteractiveMapSection.tsx - mobil
<div className="lg:hidden relative">
  {/* Fade edges for scroll affordance */}
  <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#faf9f7] to-transparent z-10" />
  <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#faf9f7] to-transparent z-10" />

  {/* Snap-scroll container */}
  <div
    className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 -mx-4 px-4"
    style={{ WebkitOverflowScrolling: 'touch' }}
  >
    {factCards.map(card => (
      <div
        key={card.type}
        className="flex-shrink-0 w-[200px] snap-start"
      >
        <FactCard card={card} />
      </div>
    ))}
  </div>
</div>
```

**CSS for hidden scrollbar:**

```css
/* globals.css */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

## Acceptance Criteria

### Funksjonelle krav

- [x] Statistics-kort viser POI-antall, snittrating og totale anmeldelser
- [x] Top Pick-kort viser høyest rangerte POI med editorialHook (hvis tilgjengelig)
- [x] Category Split-kort viser fordeling per underkategori med ikoner
- [x] Fun Fact-kort følger fallback-kjeden for innhold
- [x] Hidden Gem-kort viser POI med rating ≥4.3 og <500 anmeldelser
- [x] Kort uten gyldig data skjules (3-4 kort vises hvis ikke alle har data)
- [x] Desktop: Vertikal sidebar til venstre for kartet (240px bred, sticky)
- [x] Mobil: Horisontalt scroll med `snap-x snap-mandatory`
- [x] Kort er IKKE klikkbare

### Edge cases

- [x] Tema med kun 1 POI: Vis Statistics ("1 sted"), skip andre kort
- [x] Tema med kun 1 kategori: Skip Category Split
- [x] Ingen POI-er med rating: Statistics viser kun antall, skip rating-avhengige kort
- [x] Ingen Hidden Gems finnes: Skip Hidden Gem-kortet
- [x] Lange POI-navn: Truncate med `line-clamp-1`
- [x] Lange editorialHooks: `line-clamp-2`

### Styling

- [x] Følg eksisterende fargepalett (`#faf9f7`, `#eae6e1`, `#b45309` for stjerner)
- [x] Kort-stil: `bg-white rounded-lg p-3 border border-[#eae6e1]`
- [x] Desktop sidebar: `w-[240px] flex-shrink-0 sticky top-20 space-y-3`
- [x] Mobil kort: `w-[200px] flex-shrink-0 snap-start`
- [x] Fade edges på mobil for scroll-affordance

## Implementation Phases

### Fase 1: Single-file implementation

**Mål:** Fullt fungerende på desktop

1. Opprett `ReportFactCards.tsx` med:
   - Discriminated union types
   - `computeFactCards()` med single-pass
   - Inline card components
2. Wrap med `useMemo` i `ReportInteractiveMapSection`
3. Integrer i desktop layout

**Filer:**
- `components/variants/report/ReportFactCards.tsx`

### Fase 2: Mobil snap-scroll

**Mål:** Touch-vennlig horizontal scroll

1. Legg til `variant="horizontal"` prop
2. Implementer snap-scroll container
3. Legg til fade-edges for scroll affordance
4. Test på iOS Safari og Android Chrome

**Filer:**
- `components/variants/report/ReportFactCards.tsx`
- `components/variants/report/ReportInteractiveMapSection.tsx`
- `app/globals.css` (scrollbar-hide)

### Fase 3: Type-utvidelse og polish

**Mål:** categoryFacts support + edge cases

1. Utvid `lib/types.ts` med `categoryFacts?: string[]`
2. Test alle edge cases
3. Finjuster spacing/typography

**Filer:**
- `lib/types.ts`

## Code Examples

### ReportFactCards.tsx (Complete)

```typescript
import { useMemo, memo } from 'react';
import { Star, Gem, TrendingUp, Utensils, Coffee } from 'lucide-react';
import { POI, Category } from '@/lib/types';
import { ReportTheme, ReportThemeConfig } from './report-data';
import { cn } from '@/lib/utils';

// ============ TYPES ============

interface StatisticsData {
  totalPOIs: number;
  avgRating: number | null;
  totalReviews: number;
}

interface TopPickData {
  poi: POI;
}

interface CategorySplitData {
  categories: Array<{ category: Category; count: number }>;
}

interface FunFactData {
  text: string;
}

interface HiddenGemData {
  poi: POI;
}

type FactCardData =
  | { type: 'statistics'; data: StatisticsData }
  | { type: 'topPick'; data: TopPickData }
  | { type: 'categorySplit'; data: CategorySplitData }
  | { type: 'funFact'; data: FunFactData }
  | { type: 'hiddenGem'; data: HiddenGemData };

// ============ TYPE GUARDS ============

function hasGoogleRating(poi: POI): poi is POI & { googleRating: number } {
  return poi.googleRating != null;
}

function isHiddenGemCandidate(poi: POI): poi is POI & { googleRating: number; googleReviewCount: number } {
  return (
    poi.googleRating != null &&
    poi.googleRating >= 4.3 &&
    poi.googleReviewCount != null &&
    poi.googleReviewCount > 0 &&
    poi.googleReviewCount < 500
  );
}

// ============ COMPUTATION ============

export function computeFactCards(
  theme: ReportTheme,
  config?: ReportThemeConfig
): FactCardData[] {
  const cards: FactCardData[] = [];

  // Single pass over allPOIs for categoryCounts and hiddenGem
  const { categoryCounts, hiddenGem } = theme.allPOIs.reduce(
    (acc, poi) => {
      // Category counting
      const catId = poi.category.id;
      const existing = acc.categoryCounts.find(c => c.category.id === catId);
      if (existing) {
        existing.count++;
      } else {
        acc.categoryCounts.push({ category: poi.category, count: 1 });
      }

      // Hidden gem tracking (find max rating, no sort)
      if (isHiddenGemCandidate(poi)) {
        if (!acc.hiddenGem || poi.googleRating > acc.hiddenGem.googleRating) {
          acc.hiddenGem = poi;
        }
      }

      return acc;
    },
    {
      categoryCounts: [] as Array<{ category: Category; count: number }>,
      hiddenGem: null as (POI & { googleRating: number; googleReviewCount: number }) | null,
    }
  );

  // 1. Statistics (always if > 0 POIs)
  if (theme.stats.totalPOIs > 0) {
    cards.push({
      type: 'statistics',
      data: {
        totalPOIs: theme.stats.totalPOIs,
        avgRating: theme.stats.avgRating,
        totalReviews: theme.stats.totalReviews,
      },
    });
  }

  // 2. Top Pick (requires rating) - use pre-sorted highlightPOIs
  const topPick = theme.highlightPOIs.find(hasGoogleRating);
  if (topPick) {
    cards.push({
      type: 'topPick',
      data: { poi: topPick },
    });
  }

  // 3. Category Split (requires 2+ categories)
  if (categoryCounts.length >= 2) {
    cards.push({
      type: 'categorySplit',
      data: { categories: categoryCounts.sort((a, b) => b.count - a.count) },
    });
  }

  // 4. Fun Fact (fallback chain)
  const funFactText = selectFunFact(config?.categoryFacts, theme.highlightPOIs);
  if (funFactText) {
    cards.push({
      type: 'funFact',
      data: { text: funFactText },
    });
  }

  // 5. Hidden Gem
  if (hiddenGem) {
    cards.push({
      type: 'hiddenGem',
      data: { poi: hiddenGem },
    });
  }

  return cards;
}

function selectFunFact(categoryFacts: string[] | undefined, highlightPOIs: POI[]): string | null {
  if (categoryFacts && categoryFacts.length > 0) {
    return categoryFacts[Math.floor(Math.random() * categoryFacts.length)];
  }
  const topPOI = highlightPOIs[0];
  if (topPOI?.localInsight) return topPOI.localInsight;
  if (topPOI?.editorialHook) return topPOI.editorialHook;
  return null;
}

// ============ CARD COMPONENTS ============

function FactCardWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-lg p-3 border border-[#eae6e1]', className)}>
      {children}
    </div>
  );
}

function StatisticsCard({ data }: { data: StatisticsData }) {
  return (
    <FactCardWrapper>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#4a4a4a]">
        <span className="font-semibold text-[#1a1a1a]">{data.totalPOIs}</span>
        <span>steder</span>
        {data.avgRating != null && (
          <>
            <span className="text-[#d4cfc8]">•</span>
            <span className="flex items-center gap-1">
              Snitt
              <Star className="w-3.5 h-3.5 text-[#b45309] fill-[#b45309]" />
              <span className="font-semibold text-[#1a1a1a]">{data.avgRating.toFixed(1)}</span>
            </span>
          </>
        )}
        {data.totalReviews > 0 && (
          <>
            <span className="text-[#d4cfc8]">•</span>
            <span>{formatReviewCount(data.totalReviews)} anmeldelser</span>
          </>
        )}
      </div>
    </FactCardWrapper>
  );
}

function TopPickCard({ data }: { data: TopPickData }) {
  const { poi } = data;
  return (
    <FactCardWrapper>
      <div className="flex items-center gap-1 mb-1">
        <TrendingUp className="w-3.5 h-3.5 text-[#b45309]" />
        <span className="text-[11px] font-medium text-[#b45309]">Anbefalt</span>
      </div>
      <h4 className="font-semibold text-[#1a1a1a] text-sm line-clamp-1">{poi.name}</h4>
      {poi.editorialHook && (
        <p className="text-xs text-[#6a6a6a] leading-relaxed line-clamp-2 mt-1">
          {poi.editorialHook}
        </p>
      )}
    </FactCardWrapper>
  );
}

function CategorySplitCard({ data }: { data: CategorySplitData }) {
  return (
    <FactCardWrapper>
      <div className="flex flex-wrap gap-2">
        {data.categories.slice(0, 4).map(({ category, count }) => (
          <span
            key={category.id}
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: category.color }}
          >
            <span className="font-medium">{count}</span>
            <span className="text-[#6a6a6a]">{category.name.toLowerCase()}</span>
          </span>
        ))}
      </div>
    </FactCardWrapper>
  );
}

function FunFactCard({ data }: { data: FunFactData }) {
  return (
    <FactCardWrapper className="bg-[#faf9f7]">
      <p className="text-xs text-[#4a4a4a] leading-relaxed line-clamp-3 italic">
        "{data.text}"
      </p>
    </FactCardWrapper>
  );
}

function HiddenGemCard({ data }: { data: HiddenGemData }) {
  const { poi } = data;
  return (
    <FactCardWrapper>
      <div className="flex items-center gap-1 mb-1">
        <Gem className="w-3.5 h-3.5 text-purple-600" />
        <span className="text-[11px] font-medium text-purple-600">Skjult perle</span>
      </div>
      <h4 className="font-semibold text-[#1a1a1a] text-sm line-clamp-1">{poi.name}</h4>
      <p className="text-xs text-[#6a6a6a] mt-0.5">
        ★ {poi.googleRating?.toFixed(1)} • {poi.googleReviewCount} anmeldelser
      </p>
    </FactCardWrapper>
  );
}

// ============ MAIN COMPONENT ============

function FactCard({ card }: { card: FactCardData }) {
  switch (card.type) {
    case 'statistics':
      return <StatisticsCard data={card.data} />;
    case 'topPick':
      return <TopPickCard data={card.data} />;
    case 'categorySplit':
      return <CategorySplitCard data={card.data} />;
    case 'funFact':
      return <FunFactCard data={card.data} />;
    case 'hiddenGem':
      return <HiddenGemCard data={card.data} />;
  }
}

interface ReportFactCardsProps {
  cards: FactCardData[];
  variant?: 'vertical' | 'horizontal';
}

export const ReportFactCards = memo(function ReportFactCards({
  cards,
  variant = 'vertical',
}: ReportFactCardsProps) {
  if (cards.length === 0) return null;

  if (variant === 'horizontal') {
    return (
      <>
        {cards.map(card => (
          <div key={card.type} className="flex-shrink-0 w-[200px] snap-start">
            <FactCard card={card} />
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {cards.map(card => (
        <FactCard key={card.type} card={card} />
      ))}
    </div>
  );
});

// ============ UTILS ============

function formatReviewCount(count: number): string {
  if (count >= 10000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toLocaleString('nb-NO');
}
```

## Dependencies & Risks

### Dependencies

- Ingen eksterne dependencies (bruker eksisterende Lucide icons)
- Avhenger av eksisterende `report-data.ts` transformasjoner

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tomme kort ved lite data | Dårlig UX | Robust fallback-kjede, skip kort uten data |
| Layout-shift ved lasting | Visuell glitch | Fixed dimensions på kort |
| Mobil scroll oppdages ikke | Brukere ser ikke alle kort | Fade-edges + partial card peek |
| Re-render performance | Langsom UI | `useMemo` + `React.memo` |

### Research Insights: Risk Mitigations

**From learnings-researcher:**
- Use state machine for loading states, not boolean flags
- Fixed card dimensions prevent CLS
- Fade edges provide scroll affordance

**From performance-oracle:**
- `useMemo` with theme dependency prevents recomputation
- Single-pass reduce instead of multiple filter/sort
- `React.memo` on `ReportFactCards` prevents unnecessary re-renders

## References

### Internal

- `components/variants/report/ReportHighlightCard.tsx:61-103` - kort-styling
- `components/variants/report/report-data.ts:12-19` - ReportThemeStats interface
- `components/variants/report/ReportInteractiveMapSection.tsx:201-240` - desktop layout
- `docs/brainstorms/2026-02-04-report-fact-cards-brainstorm.md` - design-beslutninger

### Learnings

- `docs/solutions/ui-patterns/explorer-desktop-layout-pattern.md` - sidebar layout (flex split, not overlay)
- `docs/solutions/ux-loading/skeleton-loading-explorer-20260204.md` - loading states (state machine)
- `docs/solutions/architecture-patterns/guide-library-spotify-pattern-20260204.md` - useMemo for filtering

### External

- [Tailwind Scroll Snap](https://v3.tailwindcss.com/docs/scroll-snap-type) - `snap-x snap-mandatory`
- [CSS Scroll Shadows](https://css-tricks.com/modern-scroll-shadows-using-scroll-driven-animations/) - fade affordances
- [Accessible Carousels](https://developer.chrome.com/blog/accessible-carousel) - a11y patterns
