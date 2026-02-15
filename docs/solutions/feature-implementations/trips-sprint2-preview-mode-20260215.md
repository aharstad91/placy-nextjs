---
module: Trips
date: 2026-02-15
problem_type: feature_implementation
component: ui_component
symptoms:
  - "Trips go directly to active navigation mode with no preview"
  - "No way for guest to evaluate a trip before starting"
root_cause: feature_gap
severity: medium
tags: [trips, preview, routing, mapbox, query-params]
---

# Trips Sprint 2: Preview Mode

## Problem

Clicking a trip in the Trip Library went directly to active navigation mode (TripPage with geolocation, completion tracking, bottom sheet). Guests had no way to preview a trip before committing — they couldn't see the route, stops, or rewards ahead of time.

## Solution

### New Component: TripPreview

A client component at `components/variants/trip/TripPreview.tsx` that shows a static trip overview:

1. **Hero** — cover image or gradient fallback with category badge
2. **Metadata stripe** — duration, distance, stop count, difficulty
3. **Description** — trip intro text
4. **Static map** — TripPreviewMap with numbered markers + route polyline
5. **Stop list** — numbered cards with timeline connector, thumbnails, descriptions
6. **Rewards teaser** — shown if reward is configured (from project override or trip defaults)
7. **Sticky CTA** — "Start turen" button at bottom

### Routing via Query Param

Instead of separate routes, both modes share the same URL with a query parameter:

```
/for/[customer]/[project]/trips/[tripSlug]          → TripPreview (default)
/for/[customer]/[project]/trips/[tripSlug]?mode=active → TripPage
/trips/[slug]                                         → TripPreview (default)
/trips/[slug]?mode=active                             → TripPage
```

This keeps URLs clean and avoids new route segments.

### Key Pattern: Server Component with Query Param Branching

```typescript
export default async function TripDetailPage({ params, searchParams }: PageProps) {
  const { mode } = await searchParams;
  const trip = await getTripBySlugAsync(tripSlug);

  if (mode === "active") {
    const projectData = tripToProject(trip, override);
    return <TripPage project={projectData} />;
  }

  return <TripPreview trip={trip} override={override} activeHref={`${basePath}?mode=active`} />;
}
```

TripPreview receives the raw `Trip` type directly — no adapter needed. Only active mode uses `tripToProject()` to convert to the legacy `Project` shape.

### TripPreviewMap: Simplified Static Map

A lightweight version of TripMap that:
- Fetches route from `/api/directions` on mount
- Shows numbered markers (no completion state, no geolocation)
- Disables scroll zoom (prevents accidental zoom when scrolling page)
- Fits bounds to all stops on load

## Prevention

- **New trip modes**: Use query params (`?mode=X`) for mode switching instead of separate routes
- **Direct types vs adapter**: New components should receive Supabase types directly. Only legacy components need the `tripToProject()` adapter
- **Map variants**: Use TripPreviewMap for static display, TripMap for interactive navigation

## Related Files

- `components/variants/trip/TripPreview.tsx` — Preview component
- `components/variants/trip/TripPreviewMap.tsx` — Static map
- `app/for/[customer]/[project]/trips/[tripSlug]/page.tsx` — Route branching
- `app/trips/[slug]/page.tsx` — SEO route branching
