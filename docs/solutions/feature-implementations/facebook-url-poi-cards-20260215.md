---
module: Explorer & POI
date: 2026-02-15
problem_type: best_practice
component: frontend_stimulus
symptoms:
  - "No link from POI cards to Facebook pages"
  - "isSafeUrl utility duplicated in two SEO pages"
root_cause: missing_workflow_step
resolution_type: code_fix
severity: low
tags: [facebook, social-media, poi-cards, explorer, bottom-sheet, url-safety, deduplication]
---

# Facebook URL on POI Cards (Phase 1)

## Problem

Placy curates information from many sources, but had no way to link users to a POI's Facebook page — which often contains photos, reviews, and updates that Google Places doesn't have. Additionally, the `isSafeUrl()` utility was duplicated in two SEO page files.

## Solution

### 1. Database: `facebook_url` column

```sql
ALTER TABLE pois
  ADD COLUMN IF NOT EXISTS facebook_url TEXT
  CHECK (facebook_url IS NULL OR facebook_url ~ '^https://');
```

HTTPS-only CHECK constraint as defense-in-depth. Follows existing pattern with `google_maps_url`.

### 2. Shared `isSafeUrl` utility

Extracted from two SEO pages into `lib/utils/url.ts`:

```typescript
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
```

Now imported by 4 files: 2 SEO pages + ExplorerPOICard + POIBottomSheet.

### 3. UI: Facebook link in ExplorerPOICard

Text link style matching Google Maps pattern, with `stopPropagation` since it's inside a clickable card:

```tsx
{poi.facebookUrl && isSafeUrl(poi.facebookUrl) && (
  <a href={poi.facebookUrl} target="_blank" rel="noopener noreferrer"
     onClick={(e) => e.stopPropagation()}
     className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
    <ExternalLink className="w-3 h-3" />
    Facebook
  </a>
)}
```

Also added `flex-wrap` to the action row to prevent overflow on narrow screens.

### 4. UI: Facebook link in POIBottomSheet

Icon-only button matching the existing Google Maps button style in the expanded view.

## Key Decisions

- **Dedicated column, not JSONB.** Queryable, consistent with existing URL columns
- **ExternalLink icon, not Facebook icon.** Lucide's Facebook icon is deprecated; ExternalLink is universal
- **Client-side `isSafeUrl` + DB CHECK constraint.** Defense in depth
- **`flex-wrap` on action row.** Proactive fix for 4+ action elements on narrow screens

## Files Changed

| File | Change |
|------|--------|
| `lib/utils/url.ts` | **NEW** — shared isSafeUrl utility |
| `supabase/migrations/033_add_facebook_url.sql` | **NEW** — column + CHECK constraint |
| `lib/types.ts` | `facebookUrl?: string` |
| `lib/supabase/types.ts` | `facebook_url` in Row/Insert/Update |
| `lib/supabase/queries.ts` | transformPOI + getPOIsWithinRadius |
| `components/variants/explorer/ExplorerPOICard.tsx` | Facebook link + flex-wrap |
| `components/poi/poi-bottom-sheet.tsx` | Facebook link in expanded view |
| `app/(public)/[area]/steder/[slug]/page.tsx` | Import from shared utility |
| `app/(public)/en/[area]/places/[slug]/page.tsx` | Import from shared utility |

## Future Work (Phase 2)

- OG-metadata scraping from Facebook pages
- `og:image` as image fallback for POIs without Google photos
- Richer preview widget with Facebook data
