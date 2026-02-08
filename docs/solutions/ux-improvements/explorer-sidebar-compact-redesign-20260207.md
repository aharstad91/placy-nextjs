---
module: Explorer
date: 2026-02-07
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Category filter chips with full background color are visually heavy and dominate the UI"
  - "Travel mode dropdown takes horizontal space from category chips"
  - "Expanded POI card image takes 70% of sidebar height"
  - "Opening hours show all 7 days, consuming excessive vertical space"
  - "Sub-category dropdown items lack visual connection to map markers"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [explorer, sidebar, compact, ui, filter-chips, poi-card, opening-hours, category-dropdown]
---

# Explorer Sidebar: Compact Redesign of Filters and POI Cards

## Problem
The Explorer sidebar had several UI density issues: filter chips with full background color were visually overwhelming, the travel mode dropdown competed for horizontal space with category chips, expanded POI cards showed oversized images and full 7-day opening hours lists, and sub-category dropdowns used generic checkboxes instead of category-specific icons.

## Environment
- Module: Explorer
- Stack: Next.js 14, Tailwind CSS, Lucide React
- Affected Components: `ExplorerThemeChips.tsx`, `ExplorerPOIList.tsx`, `ExplorerPOICard.tsx`
- Date: 2026-02-07

## Symptoms
- Category chips with full saturated backgrounds overwhelm the sidebar
- "Til fots" dropdown sits next to chips, squeezing chip layout
- POI card image at `aspect-[16/9]` takes most of visible sidebar
- Opening hours show Monday through Sunday (7 lines) when only today matters
- Sub-category dropdown uses generic colored checkboxes, not category-specific markers

## Solution

### 1. Filter chips: White background + circular color indicators

Replaced full-color chip backgrounds with white chips containing small circular icons matching map markers:

```tsx
// ExplorerThemeChips.tsx — Before:
style={isActive ? { backgroundColor: theme.color, color: "white" } : undefined}

// After: White background, circular marker indicator
<div className="... bg-white border-gray-200">
  <div
    className={cn(
      "w-6 h-6 rounded-full border-2 border-white shadow-sm",
      !isActive && "opacity-30 grayscale"
    )}
    style={{ backgroundColor: theme.color }}
  >
    <Icon className="w-3 h-3 text-white" />
  </div>
  <span className={isActive ? "text-gray-900" : "text-gray-600"}>
    {theme.name}
  </span>
</div>
```

Active state: full-color circle + dark text. Inactive: desaturated circle + medium gray text.

### 2. Partial filter counter: `(15/30)` instead of dot indicator

When some categories within a theme are disabled, show fraction instead of a small dot:

```tsx
// Before: (30) + small dot indicator
// After:
{hasPartialFilter ? `(${activeCount}/${count})` : `(${count})`}
```

### 3. Travel mode moved to title row

Moved "Til fots" dropdown from the chips row to the right side of the title, giving chips full width:

```tsx
// ExplorerPOIList.tsx — Before:
<div className="flex items-center gap-2">
  <div className="flex-1"><ExplorerThemeChips /></div>
  <TravelModeDropdown />  {/* Squeezes chips */}
</div>

// After:
<div className="flex items-start justify-between">
  <div><h1>Utforsk ...</h1><p>stats</p></div>
  <TravelModeDropdown />  {/* Next to title */}
</div>
<ExplorerThemeChips />  {/* Full width below */}
```

### 4. Sub-category dropdown with category icons and colors

Replaced generic checkboxes with per-category circular markers (icon + color), derived from POI data:

```tsx
// Built categoryInfo map from POI data
const categoryInfo = useMemo(() => {
  const info = new Map<string, { name: string; icon: string; color: string }>();
  for (const poi of pois) {
    if (!info.has(poi.category.id)) {
      info.set(poi.category.id, { name: poi.category.name, icon: poi.category.icon, color: poi.category.color });
    }
  }
  return info;
}, [pois]);

// Dropdown item: circular marker instead of checkbox
<div
  className={cn("w-6 h-6 rounded-full ...", !isCatActive && "opacity-30 grayscale")}
  style={{ backgroundColor: cat?.color }}
>
  <CatIcon className="w-3 h-3 text-white" />
</div>
```

### 5. Compact POI card

- Image: `aspect-[16/9]` → `aspect-[21/9]` (cinematic strip, ~40% less height)
- Opening hours: Full 7-day list → single line "I dag: 6:00 PM – 2:30 AM · Åpen nå"
- Removed left margin indent on expanded content (saves ~36-48px per card)
- Tighter spacing: `space-y-3` → `space-y-2.5`

```tsx
// Opening hours — Before: 7 lines
{openingHours.openingHours.map((line, i) => <div key={i}>{line}</div>)}

// After: Single line with today's hours
const today = days[new Date().getDay()];
const todayLine = openingHours.openingHours.find(line =>
  line.toLowerCase().startsWith(today.toLowerCase())
);
// Renders: "I dag: 6:00 PM – 2:30 AM · Åpen nå"
```

## Why This Works

1. **Visual hierarchy:** White chips with colored markers create clear active/inactive states without overwhelming color. The circular indicators directly match map markers, creating visual consistency between sidebar and map.
2. **Space efficiency:** Moving travel mode to the title row frees horizontal space for chips. The fraction counter `(15/30)` communicates partial filtering state without an extra UI element.
3. **Information density:** Cinematic image strips still give visual context but don't dominate. Today's opening hours is the only actionable info — showing all 7 days wastes space for the common use case.
4. **Pattern consistency:** Using the same circular marker style (icon + category color + grayscale inactive) in both map markers, theme chips, and category dropdowns creates a unified visual language.

## Prevention

- Default to compact representations — only show detailed views on explicit user interaction (e.g., "show all hours" toggle)
- When adding filter UI elements, match the visual language of the data they filter (markers → circular indicators)
- Keep sidebar controls (travel mode, filters) from competing for the same horizontal row — stack them vertically when possible

## Related Issues
- See also: [explorer-desktop-layout-pattern.md](../ui-patterns/explorer-desktop-layout-pattern.md)
