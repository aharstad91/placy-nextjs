---
title: "/generate-bolig — Automated Residential Neighborhood Reports"
category: feature-implementations
tags: [generate-bolig, residential, report, explorer, nsr, barnehagefakta, overpass, pipeline]
module: Commands
date: 2026-02-18
symptoms: "Need to create neighborhood reports for real estate projects (boligprosjekter)"
root_cause: "generate-hotel optimized for city hotels (800m, guest perspective), not residential (2500m, resident perspective)"
---

# /generate-bolig — Residential Neighborhood Reports

## Problem

`/generate-hotel` was designed for city hotels: 800m radius, guest perspective, 5 themes focused on dining/culture/transport. Real estate reports need a 2-3km "hverdagsradius", schools/kindergartens/sports facilities, and a resident perspective.

## Solution

Forked `/generate-hotel` into `/generate-bolig` with:

### New Categories (DB Migration 042)
- `skole` — from NSR/Udir API (all registered Norwegian schools)
- `barnehage` — from Barnehagefakta API (kindergartens with radius search)
- `idrett` — from Overpass API (sports facilities from OpenStreetMap)

### Key Architecture Decisions

1. **Separate command, not profile-based.** Enough differences to justify separation — different APIs, themes, editorial rules.

2. **New categories bypass Import API.** `GOOGLE_CATEGORY_MAP` and `ALLOWED_CATEGORIES` are for Google Places types only. Schools/kindergartens/sports come from official Norwegian APIs and are inserted directly via Supabase REST.

3. **External-ID-based dedup.** `nsr-{OrgNr}`, `bhf-{id}`, `osm-{type}-{osmId}` — not name-based (fragile).

4. **Institutional baseline scores.** Non-Google POIs have no `googleRating`/`googleReviewCount`. Set `google_rating=4.0, google_review_count=10` as baseline so scoring/featured-selection works.

5. **Theme system expanded globally.** `barnefamilier` and `natur-friluftsliv` added to `DEFAULT_THEMES`. Empty themes auto-hidden in Explorer, so hotel projects unaffected.

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/042_bolig_categories.sql` | 3 categories + 6 category_slugs |
| 5 files (6 locations) | `max(2000)` → `max(3000)` for radius |
| `lib/generators/poi-discovery.ts` | Extended `DiscoveredPOI.source` type |
| `lib/generators/story-writer.ts` | Updated `determineSource()` return type |
| `lib/themes/default-themes.ts` | Added barnefamilier + natur-friluftsliv themes |
| `lib/themes/explorer-caps.ts` | Added caps for new themes |
| `.claude/commands/generate-bolig.md` | 16-step pipeline command |

## Key Gotchas

1. **6 radius locations, not 3.** Two Zod validators in import route + 4 UI sliders across admin pages.
2. **park/outdoor moved from kultur-opplevelser to natur-friluftsliv.** Better semantic fit. Hotel Explorers show "Natur & Friluftsliv" instead.
3. **NSR API uses kommunenummer.** Need to map city → kommunenr (Trondheim=5001, Oslo=0301, Bergen=4601).
4. **Barnehagefakta radius is in degrees.** 0.025° ≈ 2.5km.
5. **Overpass bbox format.** `south,west,north,east` — not the usual order.
6. **Existing POIs must be linked.** Step 5.8 links lekeplasser/badeplasser/bussstopp already in the DB.

## Related

- `docs/solutions/feature-implementations/generate-hotel-scoring-featured-capping-20260206.md`
- `docs/solutions/best-practices/editorial-hooks-no-perishable-info-20260208.md`
- `docs/brainstorms/2026-02-18-generate-bolig-overvik-brainstorm.md`
- `docs/plans/2026-02-18-feat-generate-bolig-command-plan.md`
