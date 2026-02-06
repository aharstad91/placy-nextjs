---
title: Project POI Management with Interactive Map and Category Filters
category: feature-implementations
tags:
  - react-map-gl
  - mapbox
  - map-sidebar-pattern
  - category-filters
  - batch-operations
  - type-safety
  - server-actions
  - supabase
  - admin-ui
  - poi-management
module: Admin - Project Detail
symptom: "Flat POI list without spatial insight, no filtering, poor add/remove UX"
root_cause: "Spatial data presented as linear list — no reuse of proven map+sidebar pattern from /admin/pois"
date: 2026-02-06
commit: 46c9a4f
---

# Project POI Map+Sidebar Management

## Problem

The POI-er tab on `/admin/projects/[id]` showed a flat table (name, category, delete button). With 60+ POIs this was unmanageable — editors couldn't see geographic distribution, category coverage, or identify spatial gaps.

## Solution

Replaced the flat list with a two-column **map+sidebar layout** reusing the proven pattern from `/admin/pois`.

### Layout

```
┌──────────────┬──────────────────────────────────┐
│  Sidebar     │                                  │
│  w-72        │         Mapbox map               │
│  ──────────  │         flex-1                   │
│  Stats       │         POI markers              │
│  Filters     │         color-coded by category  │
│  POI list    │                                  │
│  Footer      │                                  │
└──────────────┴──────────────────────────────────┘
```

### Files Changed

| File | Change |
|------|--------|
| `app/admin/projects/[id]/page.tsx` | Extended query, added `batchAddPoisToProject`, `parseStringArray`, `ProjectBase` type |
| `app/admin/projects/[id]/project-detail-client.tsx` | Rewrote `PoisTab` with map+sidebar, add modal, remove popup |

## Key Patterns

### 1. Map+Sidebar in a Tab Container

The map needs a fixed height since it lives inside a tab, not a full page:

```tsx
<div className="h-[calc(100vh-220px)] min-h-[500px] flex rounded-xl overflow-hidden border border-gray-200">
  <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-200">
    {/* sidebar */}
  </div>
  <div className="flex-1 relative">
    <MapGL ref={mapRef} style={{ width: "100%", height: "100%" }} ... />
  </div>
</div>
```

The 220px offset accounts for: header (~64px) + tabs (~48px) + stats bar (~60px) + padding (~48px).

### 2. Uncategorized POI Handling

POIs with `category_id: null` need special handling in category filters. The filter uses `category_id || ""` to map null to empty string, so the `selectedCategories` Set must include `""`:

```tsx
// Initialize with "" for uncategorized POIs
const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
  () => new Set([...globalCategories.map((c) => c.id), ""])
);

// Filter includes uncategorized
const filteredPois = useMemo(
  () => projectPois.filter((pp) => selectedCategories.has(pp.pois.category_id || "")),
  [projectPois, selectedCategories]
);
```

Show an "Ukategorisert" chip only when uncategorized POIs exist:

```tsx
{(projectCategoryStats[""] || 0) > 0 && (
  <button onClick={() => toggleCategory("")} className={...}>
    Ukategorisert <span>{projectCategoryStats[""]}</span>
  </button>
)}
```

**Gotcha:** Forgetting `""` in the initial Set silently filters out all uncategorized POIs.

### 3. Safe JSON.parse for Batch Operations

Server actions receive `poiIds` as JSON string via FormData. Validate before use:

```tsx
function parseStringArray(json: string): string[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) {
    throw new Error("Expected an array of strings");
  }
  return parsed;
}

// In server action:
const poiIds = parseStringArray(getRequiredString(formData, "poiIds"));
```

### 4. Batch Upsert with Conflict Handling

For multi-select add operations, use Supabase upsert to handle race conditions:

```tsx
const rows = poiIds.map((poiId) => ({ project_id: projectId, poi_id: poiId }));
const { error } = await supabase
  .from("project_pois")
  .upsert(rows, { onConflict: "project_id,poi_id", ignoreDuplicates: true });
```

### 5. Sidebar POI List with FlyTo

Clicking a POI in the sidebar flies the map to that location:

```tsx
const mapRef = useRef<MapRef>(null);

// In sidebar item onClick:
mapRef.current?.flyTo({ center: [poi.lng, poi.lat], zoom: 15, duration: 800 });
```

### 6. Hide Mapbox Default Labels

Admin map should show only project markers, not Mapbox's default POI labels:

```tsx
const handleMapLoad = useCallback(() => {
  const map = mapRef.current?.getMap();
  if (map) {
    for (const layer of ["poi-label", "transit-label"]) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, "visibility", "none");
      }
    }
  }
}, []);
```

### 7. Proper Typing Instead of `any`

Define intermediate types for Supabase queries that don't match generated types (e.g., when a column exists via migration but types aren't regenerated):

```tsx
interface ProjectBase {
  id: string;
  short_id: string;
  name: string;
  // ... other fields
}

let project: ProjectBase | null = null;
// Cast at assignment:
project = projectByShortId as unknown as ProjectBase;
```

## Prevention

- **Always include `""` in category filter Sets** when data can have `null` category IDs
- **Always validate JSON.parse output** in server actions — input comes from client
- **Use `upsert` with `ignoreDuplicates`** for batch insert operations to avoid race conditions
- **Test with uncategorized data** — easy to miss when test data always has categories

## Related Documentation

- `best-practices/nextjs-admin-interface-pattern-20260124.md` — Base admin CRUD pattern
- `ui-patterns/explorer-desktop-layout-pattern.md` — Map+sidebar split layout
- `logic-errors/empty-product-categories-explorer-zero-pois-20260205.md` — Category derivation fallback
- `database-issues/schema-mismatch-product-type-column-20260205.md` — Migration type safety
