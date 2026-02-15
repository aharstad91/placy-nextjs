---
module: Trips
date: 2026-02-15
problem_type: ui_improvement
component: react_component
symptoms:
  - "Cover images missing from trip cards and preview hero"
  - "Trip Library category navigation lacks visual differentiation"
  - "Preview hero gradient too dark, obscuring cover image"
  - "Transition text hard to read during walking"
root_cause: initial_implementation_minimal
severity: medium
tags: [trips, visual-polish, cover-images, wikimedia-commons, tailwind]
---

# Trips Visual Polish — Sprint 5

## Problem

The trips feature was functionally complete (Sprints 1-4) but visually minimal for a demo presentation. Cover images were missing, category navigation was plain white, the preview hero gradient was too dark, and transition text was plain italic text that was hard to read while walking.

## Investigation

- Tried Unsplash (SPA-rendered, can't extract URLs), Pexels (403), Pixabay (redirects to tiny files)
- Wikimedia Commons REST API provides reliable, CC-licensed images with stable thumbnail URLs
- Reviewed all trip components for visual improvement opportunities

## Solution

### Cover Images via Wikimedia Commons

```bash
# API returns JSON with direct image URLs
curl "https://commons.wikimedia.org/w/api.php?action=query&titles=File:Bakklandet_in_Trondheim_3.jpg&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json"
```

Downloaded to `public/trips/` and updated `trips.cover_image_url` in Supabase.

### Category Accent Colors

```typescript
const CATEGORY_ACCENT_COLORS: Record<TripCategory, string> = {
  food: "bg-amber-50 text-amber-700 border-amber-100",
  culture: "bg-stone-50 text-stone-700 border-stone-200",
  nature: "bg-emerald-50 text-emerald-700 border-emerald-100",
  // ...per-category colored backgrounds
};
```

### Lighter Hero Gradient

```diff
- from-black/70 via-black/20 to-black/10
+ from-black/60 via-black/10 to-transparent
```

### Transition Text as Navigation Card

```tsx
<div className="flex gap-2.5 mb-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
  <Navigation className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
  <p className="text-sm text-blue-800 leading-relaxed">
    {stopConfig.transitionText}
  </p>
</div>
```

## Prevention

- For free-to-use images, Wikimedia Commons API is the most reliable source
- Always test gradients on actual images — `from-black/70` is too heavy for most photos
- Walking-mode UI text needs card-style treatment for readability, not inline italic

## Related

- Sprint 1-4 compound docs (feature implementation)
- `components/variants/trip/TripPreview.tsx` — preview page
- `components/variants/trip/TripStopDetail.tsx` — stop detail with transition text
- `app/for/[customer]/[project]/trips/TripLibraryClient.tsx` — library with category cards
