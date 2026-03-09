---
title: Event Import Pipeline — Reusable Pattern for Festival/Kulturnatt Imports
date: 2026-03-09
problem_type: data_import
category: data-import
module: Scripts / Explorer
severity: low
tags:
  - event-import
  - explorer
  - venue-clustering
  - kulturnatt
  - festspillene
  - oslo-kulturnatt
  - geocoding
  - pipeline
  - typescript
symptoms:
  - Need to import events from external festival/kulturnatt APIs
  - Events share venues (same coordinates) and need map clustering
  - Multiple data source formats (GraphQL, REST, CMS) need same output
---

# Event Import Pipeline — Reusable Pattern

## Context

Placy imports events from festival/kulturnatt organizers into Explorer products. Two imports exist as reference implementations:

| Import | Data Source | API Type | Events | Geocoding | Script |
|--------|-----------|----------|--------|-----------|--------|
| Kulturnatt Trondheim | trdevents.no | GraphQL | ~130 | Source has coords | `scripts/import-kulturnatt.ts` |
| Festspillene Bergen | fib.no Storyblok | REST CDN | ~56 POIs | Source has coords | `scripts/import-festspillene.ts` |
| Oslo Kulturnatt | oslokulturnatt.no | REST JSON | ~257 | Mapbox geocoding | `scripts/import-oslo-kulturnatt.ts` |

The pipeline structure is identical regardless of data source. Only the fetch + transform step changes.

## Pipeline Structure (7 Steps)

Every event import script follows the same sequence:

```
1. Configuration     — customer ID, project slug, center coords, category mapping
2. Fetch             — API-specific: GraphQL, REST, scraping
3. Transform         — Normalize to Placy POI shape
4. Dry-run output    — --dry-run flag for preview without DB writes
5. DB: Customer      — upsert customer
6. DB: Categories    — upsert used categories
7. DB: POIs + Links  — upsert POIs, project, product, project_pois, product_pois
```

### Step 1: Configuration Block

```typescript
const CUSTOMER_ID = "kulturnatt-trondheim";
const PROJECT_SLUG = "kulturnatt-2025";
const PROJECT_NAME = "Kulturnatt Trondheim 2025";
const PROJECT_CENTER = { lat: 63.4305, lng: 10.3951 };
```

### Step 2: Category Mapping

Map source categories to Placy categories. Every import needs its own mapping since sources use different taxonomies.

```typescript
interface CategoryDef {
  id: string;        // e.g. "kn-musikk" — prefix with customer abbreviation
  name: string;      // Display name
  icon: string;      // Lucide icon name
  color: string;     // Hex color
  sourceIds: string[]; // Source system's category identifiers
}
```

**Always include a catch-all "Annet" category** as the last entry — unmapped events fall here instead of failing.

### Step 3: Event-Specific POI Fields

These flat columns on the `pois` table are purpose-built for events:

| Column | Type | Example | Notes |
|--------|------|---------|-------|
| `event_dates` | `text[]` | `["2025-09-12"]` | Multiple dates for repeated showings |
| `event_time_start` | `text` | `"15:00"` | HH:MM format |
| `event_time_end` | `text` | `"23:00"` | HH:MM format |
| `event_tags` | `text[]` | `["Gratis", "Utendørs"]` | Filterable tags |
| `event_url` | `text` | `https://fib.no/...` | Link back to source |
| `event_description` | `text` | `"45 min"` | Duration or extra info |

**Critical: `poi_metadata.venue`** — This field drives venue clustering on the map. Events at the same venue get the same coordinates, and the `venue` field shows as the popup header.

```typescript
poi_metadata: {
  venue: venue?.name || null,    // ← Required for venue cluster popup
  address: venue?.address || null,
  datakilde: "trdevents.no / Kulturnatt Trondheim",
}
```

### Step 4: Project Tag

Event projects MUST have `tags: ["Event"]` to enable:
- Venue clustering in ExplorerMap (VenueClusterMarker)
- Auto-theme support
- Event-specific POI card layout (dates, times)

```typescript
await supabase.from("projects").upsert({
  // ...
  tags: ["Event"],  // ← Enables event features
});
```

### Step 5: ID Generation

POI IDs must be deterministic and unique. Pattern: `{prefix}-{slugified-name}`.

```typescript
function generatePoiId(slug: string, seenIds: Set<string>): string {
  const baseId = `kn-${slugify(slug || "unnamed")}`;
  if (!seenIds.has(baseId)) { seenIds.add(baseId); return baseId; }
  let counter = 2;
  while (seenIds.has(`${baseId}-${counter}`)) counter++;
  const uniqueId = `${baseId}-${counter}`;
  seenIds.add(uniqueId);
  return uniqueId;
}
```

Use a **customer-specific prefix** (`kn-`, `fib-`, `okn-`) to avoid ID collisions across imports.

## Gotchas and Lessons Learned

### 1. Venue Clustering Requires Exact Coordinate Match

The map groups events by exact `lat_lng` coordinate key. If venues have slightly different coordinates across events, they won't cluster.

**Solution:** Resolve coordinates from the venue entity, not from individual events. Use a venue lookup map.

### 2. Venue Name in poi_metadata

The `VenueClusterMarker` popup header shows `poi.poiMetadata?.venue`. If this field is missing, the popup shows the first event's name instead (confusing).

**Always set `poi_metadata.venue`** — even if you have to extract it from the event name.

### 3. TypeScript downlevelIteration

The project's TS target doesn't support iterating `Set` or `Map` directly:

```typescript
// ❌ Fails: TS2802
for (const uuid of allUuids) { ... }

// ✅ Works
for (const uuid of Array.from(allUuids)) { ... }
```

Similarly, avoid `new Map<K, V>()` in contexts passed to React components. Use `Record<string, T>` + `Object.keys()`.

### 4. Production Grouping (Festspillene Pattern)

Some festivals have "productions" with multiple "showings". One production = one POI with multiple `event_dates`.

```
Production: "Carmen" (opera)
  └── Showing 1: June 9, 18:30 at Grieghallen
  └── Showing 2: June 11, 18:30 at Grieghallen
  └── Showing 3: June 14, 18:30 at Grieghallen
  = 1 POI with event_dates: ["2026-06-09", "2026-06-11", "2026-06-14"]
```

Kulturnatt events are typically unique (one event = one POI, one date).

### 5. Venue Coordinate Fallbacks

Many CMS systems have incomplete venue data. Maintain a hardcoded fallback map:

```typescript
const VENUE_COORD_FALLBACKS: Record<string, { lat: number; lng: number }> = {
  "Torgallmenningen": { lat: 60.3926, lng: 5.3245 },
  // ...
};
```

### 6. Image URL Optimization

If the source uses Cloudinary (common with Storyblok), add transforms:

```typescript
if (imageUrl?.includes("cloudinary.com")) {
  imageUrl = imageUrl.replace("/upload/", "/upload/w_800,q_auto,f_auto/");
}
```

### 7. Batch Size for Supabase

Always batch upserts. Supabase has payload limits:

```typescript
const BATCH_SIZE = 100;
for (let i = 0; i < pois.length; i += BATCH_SIZE) {
  const batch = pois.slice(i, i + BATCH_SIZE);
  await supabase.from("pois").upsert(batch, { onConflict: "id" });
}
```

### 8. Geocoding Addresses → Coordinates (Oslo Kulturnatt Pattern)

When the source only has text addresses (no lat/lng), use Mapbox forward geocoding:

```typescript
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

async function geocodeAddress(address: string, mapboxToken: string) {
  if (geocodeCache.has(address)) return geocodeCache.get(address)!;

  // Check hardcoded overrides first (landmarks, multi-location events)
  if (VENUE_COORD_OVERRIDES[address]) {
    geocodeCache.set(address, VENUE_COORD_OVERRIDES[address]);
    return VENUE_COORD_OVERRIDES[address];
  }

  const query = `${address}, Oslo, Norway`; // Append city + country
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${mapboxToken}&limit=1&country=no&bbox=10.5,59.8,10.95,60.0`;

  const data = await (await fetch(url)).json();
  const [lng, lat] = data.features?.[0]?.center ?? [0, 0];
  const result = lat && lng ? { lat, lng } : null;
  geocodeCache.set(address, result);
  return result;
}
```

**Key patterns:**
- **Always cache results** — overrides MUST be cached too (bug: first version returned overrides without caching, so the POI builder couldn't find them)
- **Bounding box** (`bbox`) — restrict to city area to avoid false matches in other cities
- **Append city + country** — `"Rådhusgata 19, Oslo, Norway"` is much more precise than just `"Rådhusgata 19"`
- **Override map for landmarks** — Youngstorget, Egertorget, Frognerparken etc. don't geocode well as street addresses
- **Name-based event fallbacks** — when `externalVenueName` is empty, use event name to look up known venues (e.g. "Gaustad sykehus 170 år" → Gaustad sykehus coords)
- **Expect ~97-99% hit rate** — some events will have empty venue fields from the source

### 9. Delete-then-Insert for Link Tables

`project_pois` and `product_pois` link tables don't have unique constraints suitable for upsert. Always delete existing links first:

```typescript
await supabase.from("project_pois").delete().eq("project_id", projectId);
// Then insert fresh links
```

## Checklist for New Event Import

### Research Phase
- [ ] Identify data source (API, CMS, scraping)
- [ ] Check if trdevents.no is used (search for GraphQL endpoint or superEvent ID)
- [ ] Find event count and date range
- [ ] List all source categories/genres
- [ ] Check venue data quality (coordinates present?)
- [ ] Determine if events have productions/groupings or are flat

### Implementation Phase
- [ ] Copy template: `import-kulturnatt.ts` (flat+coords), `import-festspillene.ts` (grouped+coords), or `import-oslo-kulturnatt.ts` (flat+geocoding)
- [ ] Update configuration block (customer, project, center coords)
- [ ] Map source categories → Placy categories (with catch-all "Annet")
- [ ] If no coords in source: set up Mapbox geocoding with bbox, city suffix, override map
- [ ] Set `poi_metadata.venue` for every POI
- [ ] Set `event_dates`, `event_time_start`, `event_time_end`
- [ ] Set project tag `["Event"]`
- [ ] Use customer-specific POI ID prefix

### Verification Phase
- [ ] Run with `--dry-run` first — check category counts, skipped events
- [ ] Run actual import
- [ ] Open Explorer URL — verify map loads, venues cluster correctly
- [ ] Click a venue cluster — verify popup shows events, dates, is scrollable
- [ ] Click an event in popup — verify sidebar card opens with correct data
- [ ] Verify category filter works

## Data Source Notes

### trdevents.no (GraphQL)
Used by: Kulturnatt Trondheim. May be used by other Norwegian kulturnatt events.

```graphql
{
  events(filter: { superEvent: "EVENT_ID", fromDate: "...", untilDate: "..." }) {
    data { id, title_nb, venue { location { latitude, longitude } }, ... }
  }
}
```

Each kulturnatt has a unique `superEvent` ID. **Check if the target city's kulturnatt uses this platform** — if so, you only need a new superEvent ID and category mapping.

### Storyblok CMS (REST)
Used by: Festspillene Bergen (fib.no). Common CMS for Norwegian cultural institutions.

```
GET https://api.storyblok.com/v2/cdn/stories?token=TOKEN&starts_with=no/program/2026/
```

Requires resolving: events → productions → venues (3 separate queries, joined by UUID).

### Oslo Kulturnatt (REST JSON + Mapbox geocoding)
Used by: Oslo Kulturnatt (oslokulturnatt.no). Simple public REST API.

```
GET https://www.oslokulturnatt.no/api/events
→ JSON array of event objects with: name, description, externalVenueName, tags, start_time_iso, custom_fields
```

**No coordinates in source** — only text addresses in `externalVenueName`. Requires Mapbox forward geocoding (see gotcha #8).

Only 4 tags: `Musikk og dans`, `Kunst`, `Utforsk`, `Arkitektur og design`.

**Not trdevents.no** — confirmed 2026-03-09. Custom Next.js app with own backend.

## Related Files

- `scripts/import-kulturnatt.ts` — Simple flat event import (GraphQL, coords in source)
- `scripts/import-festspillene.ts` — Complex grouped event import (Storyblok, coords in source)
- `scripts/import-oslo-kulturnatt.ts` — Flat event import with Mapbox geocoding (REST, no coords)
- `components/map/venue-cluster-marker.tsx` — Map venue clustering component
- `components/variants/explorer/ExplorerMap.tsx` — Venue grouping logic
- `app/globals.css` — `.adaptive-marker__count` CSS for cluster badges
