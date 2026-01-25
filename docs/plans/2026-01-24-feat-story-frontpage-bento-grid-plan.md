---
title: "feat: Story Frontpage Bento Grid Redesign"
type: feat
date: 2026-01-24
brainstorm: docs/brainstorms/2026-01-24-story-frontpage-bento-brainstorm.md
reviewed: 2026-01-24 (DHH, Kieran TypeScript, Code Simplicity)
---

# ✨ feat: Story Frontpage Bento Grid Redesign

## Overview

Redesign av Story-forsiden der hver tema-seksjon viser 2 POI-highlights + CTA i stedet for dagens ThemeStoryCTA-knapper.

**Estimert endringer:** ~30-40 linjer endret i én fil
**Nye filer:** 0
**Datamodell-endringer:** 0

## Proposed Solution (Ultra-enkel)

Erstatt dagens `ThemeStoryCTA`-seksjon (linje 118-134 i `ProjectPageClient.tsx`) med inline JSX som viser:
- 2 POI-highlights (nærmest først basert på travelMode)
- CTA-knapp med "Se alle X steder"

**Visuelt:**
```
[TRANSPORT OG MOBILITET]
Kort beskrivelse

┌──────────┐ ┌──────────┐ ┌──────────┐
│ POI 1    │ │ POI 2    │ │ Se alle  │
│ 2 min    │ │ 5 min    │ │ 10 steder│
└──────────┘ └──────────┘ └──────────┘
```

## Implementation

### Endringer i `app/[customer]/[project]/ProjectPageClient.tsx`

**Erstatt linje 118-134** med:

```tsx
{/* Theme Story Previews */}
<div className="space-y-10 mt-8">
  {story.themeStories.map((themeStory) => {
    const themePois = themeStory.sections.flatMap(s => s.pois);
    const pois = poisWithTravelTime
      .filter(poi => themePois.includes(poi.id))
      .sort((a, b) =>
        (a.travelTime?.[travelMode] ?? Infinity) -
        (b.travelTime?.[travelMode] ?? Infinity)
      );
    const highlights = pois.slice(0, 2);

    return (
      <section key={themeStory.id}>
        <h3 className="text-xl font-semibold text-gray-900 mb-1">
          {themeStory.title}
        </h3>
        {themeStory.bridgeText && (
          <p className="text-gray-600 mb-4 max-w-xl">
            {themeStory.bridgeText}
          </p>
        )}
        <div className="flex gap-3 overflow-x-auto pb-2 md:overflow-visible">
          {highlights.map(poi => (
            <POICard
              key={poi.id}
              poi={poi}
              travelMode={travelMode}
              onShowOnMap={() => setActiveThemeStory(themeStory.id)}
            />
          ))}
          <button
            onClick={() => setActiveThemeStory(themeStory.id)}
            className="min-w-[160px] flex-shrink-0 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl p-4 flex flex-col items-center justify-center transition-colors"
          >
            <span className="text-sm font-medium text-primary-700">
              Se alle {pois.length} steder
            </span>
            <ChevronRight className="w-5 h-5 text-primary-400 mt-1" />
          </button>
        </div>
      </section>
    );
  })}
</div>
```

### Import-endring

Legg til `ChevronRight` i import:

```tsx
// Linje ~6 i ProjectPageClient.tsx - legg til i eksisterende lucide-react import
import { ChevronRight } from "lucide-react";
```

## Acceptance Criteria

- [x] Hver tema viser 2 nærmeste POI-kort + CTA-knapp
- [x] Klikk på POI-kort eller CTA åpner tema-modal
- [x] Fungerer på mobil (horisontal scroll) og desktop

## Hva vi IKKE gjør (YAGNI)

Basert på reviewer-feedback:

| Droppet | Begrunnelse |
|---------|-------------|
| Ny komponent `ThemeBentoSection` | Brukes kun ett sted - inline er enklere |
| POICard `variant="compact"` | Eksisterende kort fungerer fint |
| Stat card | Redundant - count er i CTA-teksten |
| Edge fade indicator | Prematur - vent til brukere klager |
| Theme color palettes | Bruk eksisterende `poi.category.color` |
| Custom scroll-hide CSS | Standard oppførsel er OK |
| `useMemo` for themeStoryData | Overkill for 5-8 temaer |

## Files Changed

| Fil | Endring |
|-----|---------|
| `app/[customer]/[project]/ProjectPageClient.tsx` | Erstatt ThemeStoryCTA-seksjon (~30 linjer) |

## References

- Brainstorm: `docs/brainstorms/2026-01-24-story-frontpage-bento-brainstorm.md`
- Eksisterende POICard: `components/poi/poi-card.tsx`
- ProjectPageClient: `app/[customer]/[project]/ProjectPageClient.tsx:118-134`
