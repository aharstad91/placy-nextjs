---
title: "feat: Lens C — Nabolagsrapporten prototype"
type: feat
date: 2026-01-30
---

# feat: Lens C — Nabolagsrapporten prototype

## Overview

Build a standalone prototype for **Lens C — Nabolagsrapporten**: a data-driven neighborhood report that tests the hypothesis "boligkjopere trenger bevis — data og dekning slar narrativ." The primary surface is a scrollable page with theme sections, each containing aggregated stats, a density map, highlight cards for top POIs, and compact lists for the rest.

**Analogy:** Meglerrapport++ with warm, approachable tone (Airbnb neighborhood guide meets professional analysis).

**URL:** `/[customer]/[project]/v/report`

**Brainstorm:** `docs/brainstorms/2026-01-30-lens-c-nabolagsrapporten-brainstorm.md`

## Problem Statement / Motivation

We have three lens hypotheses to test in parallel. Lens A (Portrait) tests emotion via narrative. Lens B (Explorer) tests freedom via interactive maps. Lens C tests **evidence** — that home buyers want proof the neighborhood delivers. We need a working prototype to evaluate this direction alongside A and B.

## Proposed Solution

A self-contained prototype in `components/variants/report/` following established variant patterns (same as Explorer and Portrait). The page receives a `Project` object via server component, transforms POI data into themed sections with aggregated metrics, and renders a scrollable report.

### Key Design Decisions (from brainstorm)

| Decision | Choice |
|----------|--------|
| Hero element | Summary text with key metrics inline |
| Report structure | Theme sections with scores |
| Kart per seksjon | Tetthetskart (static density map) |
| POI display | Highlight cards (top 2-3) + compact list (rest) |
| Visual tone | Warm and approachable, not clinical |
| Interaction model | Scroll and scan, click to external link |

### Resolved Gaps (from SpecFlow analysis)

These questions surfaced during analysis. Resolution for prototype:

| Gap | Resolution |
|-----|------------|
| Theme inclusion threshold | Include theme if it has >= 3 POIs total. No minimum rating/editorial requirement. |
| Highlight vs list duplication | Highlighted POIs do NOT appear in compact list. List = "remaining". |
| Score formula | Simple arithmetic mean of `googleRating` for POIs in theme that have a rating. Show count. |
| Hero metrics | Total POI count (all), avg rating (rated POIs only), transport count (buss + tog + bysykkel). |
| Density map type | Discrete markers via Mapbox Static Images API (colored by category). Not heatmap. |
| POI click behavior | Highlight card → `googleMapsUrl` new tab. Compact list POI → same. Map → non-interactive. |
| Empty themes | Hide entire theme section. Don't show sparse data. |
| Theme ordering | By data richness: (rated POI count * 2) + (editorial hook count * 3) + total count. Descending. |
| Mobile responsive | Cards stack vertically. Map full-width. Compact list full-width. Standard Tailwind breakpoints. |
| Closing content | Hardcoded summary paragraph for prototype. Data-driven version deferred. |
| Travel time / distance | Show walking distance from project center in compact list (if travelTime.walk exists). |
| Attribution | Footer: "Data: Google, Entur, Trondheim Bysykkel" |

## Technical Approach

### Architecture

```
app/[customer]/[project]/v/[variant]/page.tsx  (existing — add 'report' to VARIANT_COMPONENTS)
  ↓ passes Project object
components/variants/report/
  ├── ReportPage.tsx              (root orchestrator — transforms data, renders sections)
  ├── report-data.ts              (data transformation: Project → ReportData)
  ├── ReportHero.tsx              (summary text with inline metrics)
  ├── ReportThemeSection.tsx      (one theme: score + map + highlights + list)
  ├── ReportDensityMap.tsx        (static Mapbox map for one theme's POIs)
  ├── ReportHighlightCard.tsx     (top POI card: image, rating, hook, distance)
  ├── ReportCompactList.tsx       (remaining POIs: name, rating, distance)
  ├── ReportClosing.tsx           (bottom-line summary + attribution)
  └── report-themes.ts            (theme definitions: category groupings)
```

### Data Flow

```
Project (server)
  → ReportPage (client component)
    → transformToReportData(project) [report-data.ts]
      → Group POIs by theme (report-themes.ts)
      → For each theme:
        → Filter POIs with ratings → sort by rating desc
        → Top 2-3 → highlight cards
        → Remaining → compact list
        → Calculate theme stats (avg rating, count, review volume)
      → Filter themes by inclusion threshold (>= 3 POIs)
      → Sort themes by richness score
    → Render: Hero → ThemeSections → Closing
```

### Theme Groupings (report-themes.ts)

```typescript
export const REPORT_THEMES = [
  {
    id: 'mat-drikke',
    name: 'Mat & Drikke',
    icon: 'UtensilsCrossed',
    categories: ['restaurant', 'cafe'],
  },
  {
    id: 'transport',
    name: 'Transport & Mobilitet',
    icon: 'Bus',
    categories: ['bus', 'train', 'bike', 'parking', 'carshare', 'taxi', 'airport'],
  },
  {
    id: 'daglig',
    name: 'Daglig & Praktisk',
    icon: 'ShoppingCart',
    categories: ['supermarket'],
  },
  {
    id: 'aktivitet',
    name: 'Aktivitet & Fritid',
    icon: 'Dumbbell',
    categories: ['gym', 'outdoor'],
  },
] as const;
```

### Data Types (report-data.ts)

```typescript
interface ReportData {
  projectName: string;
  address: string;
  heroMetrics: {
    totalPOIs: number;
    ratedPOIs: number;
    avgRating: number;
    totalReviews: number;
    transportCount: number;
  };
  themes: ReportTheme[];
}

interface ReportTheme {
  id: string;
  name: string;
  icon: string;
  stats: {
    totalPOIs: number;
    ratedPOIs: number;
    avgRating: number | null;
    totalReviews: number;
    editorialCount: number;
  };
  highlightPOIs: POI[];  // top 2-3
  listPOIs: POI[];       // remaining
  allPOIs: POI[];        // for density map
  richnessScore: number; // for ordering
}
```

### Implementation Phases

#### Phase 1: Foundation + Data Layer

**Goal:** Data transformation pipeline and routing.

**Files:**

- `components/variants/report/report-themes.ts`
  - Theme definitions with category groupings
  - `REPORT_THEMES` constant array

- `components/variants/report/report-data.ts`
  - `transformToReportData(project: Project): ReportData`
  - Groups POIs by theme using category matching
  - Calculates per-theme stats (avg rating, count, reviews)
  - Sorts themes by richness score
  - Filters out themes with < 3 POIs
  - Separates highlight POIs (top 2-3 by rating) from list POIs

- `components/variants/report/ReportPage.tsx`
  - Root `'use client'` component
  - Receives `{ project: Project }` prop
  - Calls `transformToReportData(project)` in `useMemo`
  - Renders placeholder sections for each theme
  - Warm styling foundation: background colors, typography, spacing

- `app/[customer]/[project]/v/[variant]/page.tsx`
  - Add `report: ReportPage` to `VARIANT_COMPONENTS` map
  - Import from `components/variants/report/ReportPage`

**Acceptance:**
- [x] `/klp-eiendom/ferjemannsveien-10/v/report` loads without error
- [x] Console.log shows correct ReportData with themes, stats, and POI splits
- [x] At least 2 themes pass inclusion threshold for demo data

#### Phase 2: Hero + Theme Sections

**Goal:** Visual structure with real data.

**Files:**

- `components/variants/report/ReportHero.tsx`
  - Summary paragraph with inline metrics (bold numbers)
  - Project name as heading
  - Warm, approachable typography (not clinical)
  - Responsive: smaller text on mobile, same structure

- `components/variants/report/ReportThemeSection.tsx`
  - Section heading with Lucide icon + theme name
  - Stats row: "22 steder | Snitt 4.4★ | 15 200 anmeldelser"
  - Placeholder for density map (gray box with dimensions)
  - Slots for highlight cards and compact list
  - Visual separator between sections

- `components/variants/report/ReportHighlightCard.tsx`
  - Image (Google Places photo via `photoReference`, or category-colored fallback)
  - POI name + category
  - Rating: stars + review count
  - Editorial hook (if available, displayed as quote/callout)
  - Walking distance from project center (if `travelTime.walk` exists)
  - Click → opens `googleMapsUrl` in new tab
  - Responsive: 3 cards in row on desktop, stack on mobile

- `components/variants/report/ReportCompactList.tsx`
  - Dense rows: icon + name + rating + distance
  - No images, no expansion
  - Category icon from `poi.category.icon`
  - Max ~10-15 items visible, rest behind "Vis alle (N)" toggle
  - Click POI name → `googleMapsUrl` in new tab

**Acceptance:**
- [x] Hero displays correct metrics for Ferjemannsveien 10
- [x] Each theme section shows correct stats
- [x] Highlight cards display top 2-3 POIs with images (or fallback)
- [x] Compact list shows remaining POIs, sorted by rating
- [x] Page is scrollable, readable, and has warm visual tone
- [x] Responsive on mobile (375px) and desktop (1280px)

#### Phase 3: Density Maps + Closing

**Goal:** Static maps per theme and closing section.

**Files:**

- `components/variants/report/ReportDensityMap.tsx`
  - Static Mapbox image via Static Images API (same pattern as PortraitContextMap)
  - URL format: `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/{markers}/auto/{width}x{height}@2x`
  - Markers: one pin per POI in theme, colored by category
  - Auto-fit bounds to POI coordinates
  - Project center marked with different marker
  - Non-interactive (it's an `<img>` tag)
  - Rounded corners, subtle shadow
  - Responsive: full-width, height proportional

- `components/variants/report/ReportClosing.tsx`
  - Hardcoded summary paragraph for prototype
  - Ties back to hero metrics
  - Attribution footer: "Data: Google, Entur, Trondheim Bysykkel"
  - Subtle divider from last theme section

**Acceptance:**
- [x] Each theme section has a density map showing its POIs
- [x] Maps auto-fit to show all POIs in theme
- [x] Project center is marked on each map
- [x] Closing section renders with attribution
- [x] Mapbox Static API called correctly (check Network tab)
- [x] Fallback renders if Mapbox fails (empty state, not broken layout)

#### Phase 4: Polish + Visual Refinement

**Goal:** Warm, approachable visual tone. Scannable and trustworthy.

**Tasks:**

- [x] Refine typography hierarchy: heading sizes, weights, line heights
- [x] Apply warm color palette:
  - Background: warm off-white (similar to Portrait: `#faf9f7`)
  - Text hierarchy: 3 levels (heading, body, caption)
  - Accent color for metrics/numbers (amber/warm tone)
  - Category colors on icons and map markers
- [x] Whitespace and spacing: generous padding between sections
- [x] Card styling: subtle shadows, rounded corners (`rounded-xl`), warm borders
- [x] Stats row styling: clear but not dashboard-aggressive
- [x] Image fallback: category-colored placeholder when no Google photo
- [x] "Vis alle" toggle animation (smooth expand)
- [x] Mobile polish: touch targets, spacing, readability
- [x] Test with real data: verify all metrics, maps, and cards render correctly

**Acceptance:**
- [x] Visually distinct from Portrait (no longform narrative feel)
- [x] Visually distinct from Explorer (no interactive map feel)
- [x] Feels warm and approachable, not clinical
- [x] Scannable: user can get key info in 10 seconds from hero
- [x] Trustworthy: numbers are defensible, sources attributed

## Key Implementation Patterns

### From existing variants (use these patterns)

```typescript
// Variant routing registration (page.tsx)
const VARIANT_COMPONENTS: Record<string, React.ComponentType<{ project: any }>> = {
  magazine: MagazinePage,
  portrait: PortraitPage,
  explorer: ExplorerPage,
  report: ReportPage, // ADD
};

// POI lookup pattern
const poiMap = useMemo(
  () => new Map(project.pois.map(p => [p.id, p])),
  [project.pois]
);

// Static Mapbox image (from PortraitContextMap)
const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${markers}/auto/800x400@2x?access_token=${token}`;

// Category color from POI
const color = poi.category.color; // hex string like "#ef4444"
```

### New patterns for Report variant

```typescript
// Data transformation (in useMemo, not re-computed on every render)
const reportData = useMemo(
  () => transformToReportData(project),
  [project]
);

// Theme filtering with threshold
const viableThemes = themes.filter(t => t.allPOIs.length >= 3);

// Richness score for ordering
const richnessScore = (ratedCount * 2) + (editorialCount * 3) + totalCount;

// Compact list with "show more" toggle
const [showAll, setShowAll] = useState(false);
const visiblePOIs = showAll ? listPOIs : listPOIs.slice(0, 5);
```

## File Inventory

### New files (8)

| File | Purpose |
|------|---------|
| `components/variants/report/ReportPage.tsx` | Root orchestrator |
| `components/variants/report/report-data.ts` | Data transformation pipeline |
| `components/variants/report/report-themes.ts` | Theme definitions |
| `components/variants/report/ReportHero.tsx` | Summary hero section |
| `components/variants/report/ReportThemeSection.tsx` | Individual theme section |
| `components/variants/report/ReportDensityMap.tsx` | Static density map |
| `components/variants/report/ReportHighlightCard.tsx` | Top POI card |
| `components/variants/report/ReportCompactList.tsx` | Remaining POIs list |
| `components/variants/report/ReportClosing.tsx` | Closing + attribution |

### Modified files (1)

| File | Change |
|------|--------|
| `app/[customer]/[project]/v/[variant]/page.tsx` | Add `report: ReportPage` to variant map |

## Acceptance Criteria

### Functional Requirements

- [x] `/klp-eiendom/ferjemannsveien-10/v/report` renders a complete report
- [x] Hero displays correct aggregate metrics for the project
- [x] At least 2 theme sections render with stats, map, highlights, and list
- [x] Theme sections are ordered by data richness
- [x] Themes with < 3 POIs are hidden
- [x] Highlight cards show top 2-3 POIs per theme (by rating)
- [x] Compact list shows remaining POIs, not duplicating highlights
- [x] Density maps show POI distribution per theme
- [x] POI clicks open Google Maps in new tab
- [x] Attribution footer is present

### Non-Functional Requirements

- [x] Page loads in < 2 seconds on desktop (most work is server-side)
- [x] Responsive on mobile (375px+) and desktop
- [x] No shared components with Portrait or Explorer variants
- [x] No runtime errors in console

### Quality Gates

- [x] Visually distinct from Lens A and Lens B
- [x] Feels like a "warm meglerrapport" — professional but approachable
- [x] Scannable: 10-second first impression communicates neighborhood quality

## Dependencies & Prerequisites

- Existing variant routing system (`app/[customer]/[project]/v/[variant]/page.tsx`)
- Demo project data (`data/projects/klp-eiendom/ferjemannsveien-10.json`)
- Mapbox access token (`NEXT_PUBLIC_MAPBOX_TOKEN`)
- Google Places photos (via `photoReference` in POI data)

No new dependencies needed. All infrastructure exists.

## References & Research

### Internal References

- Variant routing: `app/[customer]/[project]/v/[variant]/page.tsx`
- Explorer pattern: `components/variants/explorer/ExplorerPage.tsx`
- Portrait pattern: `components/variants/portrait/PortraitPage.tsx`
- Static map pattern: `components/variants/portrait/PortraitContextMap.tsx`
- Lens types: `lib/lens/types.ts`
- POI/Project types: `lib/types.ts`
- Data loading: `lib/data-server.ts`

### Brainstorm

- `docs/brainstorms/2026-01-30-lens-c-nabolagsrapporten-brainstorm.md`

### Context Documents

- `context/lens-brainstorm-guide.md` — Lens definition methodology
- `context/lens-implementation-guide.md` — Prototyping principles
- `context/lens-log.md` — All lens status tracking
- `context/lens-workflow.md` — Parallel prototyping methodology
