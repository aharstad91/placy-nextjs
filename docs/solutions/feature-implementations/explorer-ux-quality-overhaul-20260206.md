---
title: "Explorer UX Quality Overhaul: Shared Themes, Venue Profiles, POI Capping"
category: feature-implementations
tags: [themes, explorer, filtering, server-side-capping, derived-state, migration, refactoring, venue-profiles]
module: Explorer, Report, lib/themes
date: 2026-02-06
severity: high
---

# Explorer UX Quality Overhaul

Replaced the per-product CategoryPackage filter system with a shared theme architecture, added venue-aware POI scoring, and capped Explorer to 100 high-quality POIs with weighted distribution.

**PR:** [#14](https://github.com/aharstad91/placy-nextjs/pull/14)
**Branch:** `feat/explorer-ux-quality-overhaul` (7 commits, 20 files, +755/-526)

## Problem

The Explorer had three UX quality issues:
1. **Category dropdown was confusing** — flat list of 30+ categories with no grouping
2. **Too many POIs** — some projects had 150+ POIs, overwhelming the map and list
3. **No venue awareness** — a hotel guest saw the same POIs as a residential buyer

## Solution: 5 Interconnected Changes

### 1. Shared Theme System (`lib/themes/`)

Created a shared module with 6 files, used by both Explorer and Report:

```
lib/themes/
  theme-definitions.ts   — ThemeDefinition interface
  default-themes.ts      — 5 themes + CATEGORY_TO_THEME reverse map
  venue-profiles.ts      — hotel/residential/commercial profiles
  explorer-caps.ts       — per-theme cap constants
  apply-explorer-caps.ts — server-side capping algorithm
  index.ts               — barrel export (only public API)
```

**Key decision:** Field named `categories` (not `categoryIds`) for backward compatibility with Report's existing `reportConfig.themes` data in Supabase.

**Key decision:** Barrel export does NOT export `applyExplorerCaps` or `EXPLORER_THEME_CAPS` — these are implementation details only consumed by the server page.

```typescript
// lib/themes/theme-definitions.ts
export interface ThemeDefinition {
  id: string;
  name: string;
  icon: string;        // Lucide icon name
  categories: string[];
  color: string;       // Hex for chip styling
}
```

Report extends this:
```typescript
// components/variants/report/report-themes.ts
export interface ReportThemeDefinition extends ThemeDefinition {
  intro?: string;
  bridgeText?: string;
}
```

### 2. Server-Side POI Capping (6-Step Pipeline)

Runs in `page.tsx` (Server Component) before hydration — client never sees uncapped data.

```
Score → Blacklist → Transport Cap → Per-Theme Top-N → Unmapped Catch-All → Total Cap (100)
```

```typescript
// app/[customer]/[project]/explore/page.tsx
const isCollectionView = typeof resolvedSearchParams.c === "string";
if (!isCollectionView) {
  const profile = getVenueProfile(projectData.venueType);
  projectData = {
    ...projectData,
    pois: applyExplorerCaps(projectData.pois, DEFAULT_THEMES, profile),
  };
}
```

**Key decision:** Collection views (`?c=slug`) bypass caps — they are user-curated.

**Key decision:** Transport caps applied BEFORE per-theme distribution. Otherwise low-quality transport POIs consume the per-theme budget.

Cap constants (easily tunable):
```typescript
export const EXPLORER_THEME_CAPS: Record<string, number> = {
  "mat-drikke": 30,
  "kultur-opplevelser": 15,
  "transport": 20,
  "trening-velvare": 15,
  "hverdagsbehov": 20,
};
export const EXPLORER_TOTAL_CAP = 100;
```

### 3. Derived State for Multi-Level Filtering

Two independent state sets → derived `activeCategories` via `useMemo`:

```typescript
// ExplorerPage.tsx — TWO sources of truth
const [activeThemes, setActiveThemes] = useState<Set<string>>(
  () => new Set(DEFAULT_THEMES.map((t) => t.id))
);
const [disabledCategories, setDisabledCategories] = useState<Set<string>>(
  () => new Set()
);

// DERIVED — never stored directly
const activeCategories = useMemo(() => {
  const cats = new Set<string>();
  for (const theme of DEFAULT_THEMES) {
    if (!activeThemes.has(theme.id)) continue;
    for (const catId of theme.categories) {
      if (!disabledCategories.has(catId)) cats.add(catId);
    }
  }
  return cats;
}, [activeThemes, disabledCategories]);
```

**Why `disabledCategories` (negative set)?** Default is empty set = all visible. Adding new categories to themes in the future doesn't require state migration.

**Why not store `activeCategories` directly?** Toggling a parent theme would require syncing a flat set, causing race conditions and inconsistencies.

### 4. Nullable Migration for venue_type

```sql
-- supabase/migrations/012_add_venue_type.sql
ALTER TABLE projects
  ADD COLUMN venue_type TEXT
  CONSTRAINT projects_venue_type_check CHECK (venue_type IN ('hotel', 'residential', 'commercial'));
```

**Key decision:** `NULL` (not `NOT NULL DEFAULT 'hotel'`). Existing projects get NULL = "not configured." App-layer fallback handles this:

```typescript
export function getVenueProfile(venueType?: string | null): VenueProfile {
  if (venueType && venueType in VENUE_PROFILES) {
    return VENUE_PROFILES[venueType as VenueType];
  }
  return VENUE_PROFILES.hotel; // Safe default
}
```

### 5. Theme Chips UI

`ExplorerThemeChips.tsx` — visual chips with split-click design:
- **Left click:** Toggle entire theme on/off
- **Chevron click:** Open sub-category popover for granular control
- **Partial filter dot:** Small white dot when theme is active but some sub-categories are disabled

## Gotchas & Lessons Learned

### 1. Field naming for backward compatibility
When Report already stores `categories` in Supabase JSONB (via `reportConfig.themes`), the shared interface MUST use the same field name. Renaming to `categoryIds` would break existing data.

### 2. Transport caps must come before theme distribution
If you cap per-theme first, transport POIs (bus, train, bike) can dominate a theme's budget. Apply transport caps as a separate step before distributing across themes.

### 3. NULL vs NOT NULL DEFAULT for classification columns
`NOT NULL DEFAULT 'hotel'` silently assigns wrong venue type to ALL existing rows. Use NULL + app-layer fallback. This makes "not configured" explicit and auditable.

### 4. Dead code cleanup after system replacement
After replacing CategoryPackage → Themes, must grep for ALL references:
- Type interfaces (`CategoryPackage`)
- Type imports (`import { CategoryPackage }`)
- Object fields (`packages: null` in query returns)
- Prop interfaces and destructuring (`categories: Category[]`)
- The deleted file itself (`explorer-packages.ts`)

Run `npx tsc --noEmit` after each cleanup step.

### 5. Barrel exports control refactoring surface
By NOT exporting `applyExplorerCaps` through `lib/themes/index.ts`, the capping algorithm is an implementation detail. Only `page.tsx` imports it directly. This means the algorithm can change without affecting other consumers.

## Prevention Strategies

| Pattern | Do | Avoid |
|---------|-----|-------|
| Shared interfaces | Define base in `lib/`, extend per-product | Duplicate interface per product |
| Server-side capping | Cap in Server Component before hydration | Send all data to client and filter there |
| Hierarchical filtering | Two independent state sets → derived via useMemo | Store flat derived state directly |
| New classification columns | `TEXT NULL` + CHECK constraint + app fallback | `NOT NULL DEFAULT 'value'` on existing rows |
| System replacement | Grep all references, delete file, run tsc | Delete the file and hope for the best |

## Related Documentation

- [POI Scoring & Capping](../feature-implementations/generate-hotel-scoring-featured-capping-20260206.md) — earlier capping work for Report
- [Skeleton Loading Explorer](../ux-loading/skeleton-loading-explorer-20260204.md) — loading state machine
- [Supabase Graceful Column Fallback](../database-issues/supabase-graceful-column-fallback-20260206.md) — migration safety
- [Explorer Desktop Layout](../ui-patterns/explorer-desktop-layout-pattern.md) — base layout architecture
- [Explorer 0 POIs Bug](../logic-errors/empty-product-categories-explorer-zero-pois-20260205.md) — filtering edge case

## Files Changed

### New
- `lib/themes/` (6 files) — shared theme system
- `components/variants/explorer/ExplorerThemeChips.tsx` — theme chip UI
- `supabase/migrations/012_add_venue_type.sql` — nullable venue_type column

### Modified
- `ExplorerPage.tsx` — derived state pattern
- `ExplorerPOIList.tsx`, `ExplorerPanel.tsx` — replaced dropdowns with chips
- `ExplorerMap.tsx` — project marker with name + pulse
- `report-themes.ts` — derives from shared DEFAULT_THEMES
- `lib/types.ts` — removed CategoryPackage, added venueType
- `lib/supabase/queries.ts` — venueType plumbing
- `tailwind.config.ts` — pulse-ring animation

### Deleted
- `components/variants/explorer/explorer-packages.ts` — dead CategoryPackage system
