---
title: "feat: Build Lens A — Nabolagsportrettet (Longform Portrait Variant)"
type: feat
date: 2026-01-30
brainstorm: docs/brainstorms/2026-01-30-lens-a-nabolagsportrettet-brainstorm.md
---

# feat: Build Lens A — Nabolagsportrettet

## Overview

Build a **longform editorial prototype** for Lens A — a standalone variant that renders neighborhood data as a continuous journalistic feature article. The prototype tests the hypothesis that **narrative and editorial depth** is the primary value for home buyers evaluating a neighborhood.

The variant lives at `/[customer]/[project]/v/portrait/` and is a complete replacement for the rejected magazine variant. It is an isolated prototype with no shared components.

**Reference:** NYT/NRK longform features. Not a POI list in fancy packaging — a continuous narrative where places appear as evidence of the neighborhood's identity.

## Problem Statement

The magazine variant (`components/variants/magazine/`) failed on three counts:
1. Too generic — felt like a template, not a neighborhood
2. Too much listing, too little narrative — a pretty catalog, not a portrait
3. Wrong aesthetic direction — stone-palette grid didn't support emotional storytelling

Longform format forces real narrative. You cannot scroll through a feature article and feel like it's a list. The structure demands: a red thread, a curated selection, context for every place, and meaningful sequencing.

## Proposed Solution

A single, scrollable longform page structured as a feature article:

```
┌─────────────────────────────────────────┐
│ HERO (full-viewport image + title)      │
├─────────────────────────────────────────┤
│ INTRO (2-3 paragraphs: "what is this    │
│ neighborhood?")                         │
├─────────────────────────────────────────┤
│ CHAPTER 1: Identity theme               │
│   Narrative text with 2-3 POIs woven in │
│   [contextual map]                      │
├─────────────────────────────────────────┤
│ CHAPTER 2: Identity theme               │
│   Same pattern                          │
├─────────────────────────────────────────┤
│ ... (3-5 chapters total)                │
├─────────────────────────────────────────┤
│ CLOSING: "Who is this for?"             │
└─────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Narrative structure | Identity-themed chapters | Tests the hypothesis about emotional storytelling |
| Curation | 10-20 POIs total | Only POIs with `editorialHook` + highest rated |
| POI rendering | Inline in text flow | Not cards, not grids — places woven into prose |
| Maps | Small contextual maps between chapters | Static Mapbox images, non-interactive |
| Navigation | Minimal sticky header, no ToC | Pure reading experience for prototype |
| Images | Hero gradient + Google Places API photos where available | Graceful fallback for missing images |
| Typography | Serif headings, narrow reading column | Longform readability conventions |
| Isolation | Completely standalone components | No shared components with magazine or default |

---

## Technical Approach

### Architecture

```
app/[customer]/[project]/v/[variant]/page.tsx  (existing, add portrait registration)
  ↓ loads project data server-side
components/variants/portrait/
  ├── PortraitPage.tsx          (root client component)
  ├── PortraitHero.tsx          (full-viewport hero)
  ├── PortraitChapter.tsx       (narrative chapter with inline POIs)
  ├── PortraitPOIInline.tsx     (inline POI mention within text)
  ├── PortraitContextMap.tsx    (small static map between chapters)
  └── PortraitClosing.tsx       (closing section)
```

**Data flow:**
1. Server component loads project via `getProjectAsync()` — existing pattern
2. Pass full `Project` to `PortraitPage` client component
3. `PortraitPage` curates POIs (filter to those with `editorialHook`, sort by rating)
4. Maps curated POIs to chapters based on `themeStories`
5. Renders longform layout

### Critical Content Decision

The SpecFlow analysis identified that **narrative text is the single biggest risk**. Current data has only short-form `editorialHook` (1 sentence) and `bridgeText` (1-2 sentences per theme). A longform article needs 200-400 words per chapter.

**Approach for prototype:** Hardcode narrative content for the Ferjemannsveien 10 project. This means:
- Write 3-4 chapters of narrative prose that weave POIs naturally into the text
- Store as a content object in the portrait component (not in the data pipeline)
- Accept this is a prototype-specific limitation — production would need an editorial pipeline

This is the right trade-off because:
- It tests the hypothesis at the highest fidelity
- It avoids building an editorial pipeline before validating the direction
- It mirrors how real editorial products work — humans write the narrative

---

## Implementation Phases

### Phase 1: Foundation — Routing + Skeleton

Register the portrait variant and create the page skeleton.

**Files to create/modify:**

- [x] `components/variants/portrait/PortraitPage.tsx` — Root client component with scroll layout
- [x] `app/[customer]/[project]/v/[variant]/page.tsx` — Add `portrait: PortraitPage` to `VARIANT_COMPONENTS`

**What PortraitPage does:**
- Receives `{ project: Project }` prop
- Curates POIs: filters to `editorialHook !== undefined`, sorts by `googleRating` descending, limits to ~15
- Groups curated POIs by matching to `project.story.themeStories` categories
- Excludes chapters with < 2 curated POIs
- Renders: Hero → Intro → Chapters → Closing

**Acceptance criteria:**
- [x] `/klp-eiendom/ferjemannsveien-10/v/portrait/` renders without errors
- [x] Page shows a basic scrollable layout with placeholder content
- [x] Curated POI count is 10-20

### Phase 2: Hero + Intro

Build the emotional first impression.

**Files to create:**

- [x] `components/variants/portrait/PortraitHero.tsx` — Full-viewport hero section

**Hero design:**
- Full viewport height (`100vh`, min 600px)
- Background: gradient overlay on hero image (if available) or a rich editorial gradient
- Large serif title (project name or neighborhood name)
- Subtitle with location/POI count context
- Scroll indicator at bottom
- No navigation overlay in hero (keep it immersive)

**Intro section (in PortraitPage):**
- 2-3 paragraphs of narrative text introducing the neighborhood
- Uses `project.story.introText` as seed, supplemented with hardcoded editorial text
- Narrow reading column: `max-w-prose` (~65ch) centered
- Generous whitespace above and below

**Acceptance criteria:**
- [x] Hero fills viewport with image or gradient
- [x] Intro text is readable and well-spaced
- [x] Scroll from hero to intro is smooth

### Phase 3: Chapters with Inline POIs

The core of the prototype — narrative chapters where POIs appear naturally.

**Files to create:**

- [x] `components/variants/portrait/PortraitChapter.tsx` — A narrative chapter
- [x] `components/variants/portrait/PortraitPOIInline.tsx` — Inline POI element

**Chapter structure:**
```
[Chapter number / Label]
[Chapter title]
[Narrative prose paragraph 1]
[Inline POI: image + name + hook, woven into text]
[Narrative prose paragraph 2]
[Inline POI]
[Narrative prose paragraph 3]
[Optional: contextual map]
```

**Inline POI rendering:**
The defining design innovation. Not a card, not a list item — a styled element within the text flow.

**Two rendering modes:**

1. **Text-woven** (primary): POI name appears bold within a prose paragraph, followed by its editorial hook as a natural continuation of the sentence. Example:
   > Around the corner, **Sellanraa Bok & Bar** combines a bookstore with some of the neighborhood's best coffee — a place where locals come to think out loud.

2. **Feature block** (for visual break): A wider element that interrupts the text column with an image (if available), POI name, and editorial hook. Used for 1-2 POIs per chapter that deserve visual emphasis. Example:
   ```
   ┌─────────────────────────────────┐
   │ [IMAGE]                         │
   │                                 │
   │  SELLANRAA BOK & BAR            │
   │  "Combines a bookstore with     │
   │   some of the neighborhood's    │
   │   best coffee"                  │
   │                                 │
   │  ★ 4.6 · Øvre Bakklandet 32b   │
   └─────────────────────────────────┘
   ```

**Content for chapters (hardcoded for prototype):**
- Each chapter gets a content object with: `title`, `label`, `paragraphs[]` (with POI IDs as insertion markers)
- Write 3-4 chapters for Ferjemannsveien 10:
  - "Matbyen" (Mat & Drikke) — restaurants, cafes with the richest editorial hooks
  - "Elvebyen" (local identity) — outdoor, parks, the river area
  - "Det daglige" (daily life) — supermarket, gym, practical amenities
- Each chapter: ~200-300 words of narrative + 2-4 POIs inline

**Acceptance criteria:**
- [x] Chapters render with continuous narrative text
- [x] POIs appear inline, not in a grid or list
- [x] Text-woven POIs feel like part of the sentence
- [x] Feature-block POIs provide visual rhythm without breaking reading flow
- [x] The experience feels fundamentally different from the magazine variant

### Phase 4: Contextual Maps

Small, supporting maps between chapters.

**Files to create:**

- [x] `components/variants/portrait/PortraitContextMap.tsx` — Static contextual map

**Implementation approach: Mapbox Static Images API**

Use static map images instead of embedded GL JS components. This is the right choice because:
- Non-interactive by design (spec says "supporting role")
- Dramatically lighter than GL JS (~5KB per image vs ~500KB per GL instance)
- Consistent rendering (no client-side loading flicker)
- Works without JavaScript

**How it works:**
- Construct a Mapbox Static Images API URL with:
  - Center: midpoint of the chapter's POIs (or `project.centerCoordinates`)
  - Zoom: calculated to fit all chapter POIs
  - Markers: category-colored pins for each POI in the chapter
  - Style: `mapbox/light-v11` (subtle, editorial)
  - Size: `800x400` (retina: `800x400@2x`)
- Render as an `<img>` with `loading="lazy"` and proper alt text
- Full-width within the text column, with rounded corners

**Fallback:** If Mapbox token is missing or API fails, hide the map silently.

**Acceptance criteria:**
- [x] Static maps appear between chapters showing relevant POIs
- [x] Maps are lightweight (no GL JS loaded)
- [x] Maps lazy-load when scrolled into view
- [x] Maps have descriptive alt text

### Phase 5: Closing + Navigation Chrome

Wrap up the narrative and add minimal navigation.

**Closing section (in PortraitPage or dedicated component):**

- [x] `components/variants/portrait/PortraitClosing.tsx` — Narrative conclusion

**Content:**
- "Who is this neighborhood for?" — hardcoded editorial conclusion
- Summarizes the neighborhood's character based on the chapters
- Optional: a single full-width contextual map showing all featured POIs
- Placy branding / attribution at the very end

**Minimal navigation:**
- Sticky header: project name only, appears after scrolling past hero (opacity transition)
- No table of contents, no chapter navigation (prototype simplicity)
- No variant picker
- No footer navigation

**POI click behavior:**
- POI names in text-woven mode: link to `googleMapsUrl` (new tab) if available
- Feature-block POIs: same behavior
- No modals, no expand, no interruption to reading flow

**Acceptance criteria:**
- [x] Closing section provides narrative conclusion
- [x] Sticky header appears smoothly after hero scroll
- [x] POI links open Google Maps in new tab (coded; no googleMapsUrl in current data)
- [x] Page ends cleanly

### Phase 6: Typography + Visual Polish

Elevate from functional to editorial.

**Typography system:**

| Element | Specification |
|---------|--------------|
| Page background | `bg-white` or warm off-white (`#faf9f7`) |
| Text column | `max-w-prose` (~65ch / 680px) centered |
| Hero title | Serif, `text-5xl md:text-7xl`, light weight |
| Chapter label | Sans-serif, `text-xs uppercase tracking-widest`, muted |
| Chapter title | Serif, `text-3xl md:text-4xl`, light weight |
| Body text | Sans-serif (Inter), `text-lg md:text-xl`, `leading-relaxed` (1.75) |
| Inline POI name | Bold within body text, slightly different color |
| Feature POI name | Serif, `text-xl`, with category label above |
| Editorial hook | Italic or styled quote within body text |

**Font choice:** Use Georgia/serif for headings to differentiate from the sans-serif default. Body stays Inter for readability. This creates an editorial hierarchy that feels like longform journalism.

If Georgia isn't available/wanted, use the lens system's typography option (`lib/lens/types.ts` supports `georgia`).

**Spacing rhythm:**
- `py-24 md:py-32` between chapters (generous breathing room)
- `py-16` between paragraphs within a chapter
- `my-12` for feature-block POIs
- `my-16` for contextual maps

**Color:**
- Minimal palette: near-black text (#1a1a1a), warm white background, one accent color for POI names/links
- No stone palette (rejected from magazine)
- Consider warm tones: amber/terracotta accent for POI highlights

**Images:**
- Hero: use `project.story.heroImages[0]` if exists, otherwise editorial gradient
- POI images: use `poi.featuredImage` → `poi.photoReference` via `/api/places/photo` → gradient fallback
- Feature-block POIs: 16:9 aspect ratio, `object-cover`, subtle rounded corners
- Full-bleed option: maps and key images break out of `max-w-prose` to `max-w-3xl`

**Acceptance criteria:**
- [x] Typography creates a clear editorial hierarchy
- [x] Reading column is comfortable (45-75 chars per line)
- [x] Spacing between sections creates rhythm without wasted space
- [x] Color palette feels warm and editorial, not generic
- [x] Images load gracefully with fallbacks
- [x] The page looks like a feature article, not a web app

---

## Acceptance Criteria (Overall)

### Functional Requirements
- [x] Portrait variant accessible at `/klp-eiendom/ferjemannsveien-10/v/portrait/`
- [x] 10-20 curated POIs rendered inline in narrative text
- [x] 3-4 thematic chapters with continuous prose
- [x] Contextual static maps between chapters
- [x] Minimal sticky header after hero scroll
- [x] POI names link to Google Maps (coded; awaiting googleMapsUrl data)
- [x] Responsive: works on mobile, tablet, desktop

### Hypothesis Test
- [x] The experience feels fundamentally different from the magazine variant
- [x] A reader would describe this as "an article about a neighborhood," not "a list of places"
- [x] The narrative has a red thread (neighborhood identity) that connects chapters
- [x] POIs feel like characters in a story, not items in a database

### Quality Gates
- [x] No shared components with magazine or default story variants
- [x] Page loads without errors on all breakpoints
- [x] Images and maps have fallbacks for missing data
- [x] Semantic HTML with proper heading hierarchy (h1 → h2 → h3)

---

## File Summary

### New files

| File | Description |
|------|-------------|
| `components/variants/portrait/PortraitPage.tsx` | Root client component, curation logic, page layout |
| `components/variants/portrait/PortraitHero.tsx` | Full-viewport hero with image/gradient |
| `components/variants/portrait/PortraitChapter.tsx` | Narrative chapter with inline POIs |
| `components/variants/portrait/PortraitPOIInline.tsx` | Inline POI element (text-woven + feature-block modes) |
| `components/variants/portrait/PortraitContextMap.tsx` | Static Mapbox map between chapters |
| `components/variants/portrait/PortraitClosing.tsx` | Closing narrative section |

### Modified files

| File | Change |
|------|--------|
| `app/[customer]/[project]/v/[variant]/page.tsx` | Add `portrait: PortraitPage` to `VARIANT_COMPONENTS` |

---

## Dependencies & Risks

### Dependencies
- Mapbox Static Images API for contextual maps (requires `NEXT_PUBLIC_MAPBOX_TOKEN`)
- Google Places Photo API for POI images (requires `GOOGLE_PLACES_API_KEY`, existing proxy at `/api/places/photo`)
- Existing `getProjectAsync()` data loading (no changes needed)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Hardcoded narrative text limits reusability | High | Low for prototype | Accept — this is a prototype, not a product. Content pipeline is a Phase 2 concern. |
| Only 16 POIs have editorial hooks | Certain | Medium | Filter to these 16, build 3 chapters around the richest categories (Mat & Drikke, Trening, Outdoor) |
| No POI images in current dataset | Certain | Medium | Use `photoReference` + Google Places API proxy if available; gradient fallback for missing |
| Hero images may not exist on disk | Possible | Low | Gradient fallback in hero component |
| Static maps require internet (Mapbox API) | Low | Low | Hide map gracefully if unavailable |

---

## Open Questions (deferred to implementation)

1. **Editorial pipeline for production:** If the portrait variant is selected post-evaluation, how do we generate narrative text at scale? AI-assisted editorial? Human writers? This is a convergence-phase question.
2. **SEO and social sharing:** Should the portrait variant have OpenGraph metadata? Out of scope for prototype but trivial to add.
3. **Print/PDF export:** Longform articles are naturally printable. Worth considering in convergence phase.
4. **Scroll analytics:** Should we track how far users scroll? Useful for hypothesis validation but out of scope for initial prototype.

---

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-01-30-lens-a-nabolagsportrettet-brainstorm.md`
- Lens workflow: `context/lens-workflow.md`
- Lens implementation guide: `context/lens-implementation-guide.md`
- Lens log: `context/lens-log.md`
- Variant routing brainstorm: `docs/brainstorms/2026-01-29-design-variants-as-routes-brainstorm.md`
- Existing variant page: `app/[customer]/[project]/v/[variant]/page.tsx`
- Magazine variant (reference for what NOT to do): `components/variants/magazine/`
- Data loading: `lib/data-server.ts:getProjectAsync()`
- Project data: `data/projects/klp-eiendom/ferjemannsveien-10.json`
- Types: `lib/types.ts`
- Map components: `components/map/` (MapView, POIMarker)
- Lens curation: `lib/lens/curate.ts`

### Patterns from docs/solutions/
- Server/client data loading separation: `docs/solutions/best-practices/nextjs-dynamic-json-imports-20250125.md`
- Server Actions pattern (future): `docs/solutions/best-practices/nextjs-admin-interface-pattern-20260124.md`
