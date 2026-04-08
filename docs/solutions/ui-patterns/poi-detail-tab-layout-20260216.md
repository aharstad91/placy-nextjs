---
module: Public Site
date: 2026-02-16
problem_type: best_practice
component: frontend_stimulus
symptoms:
  - "POI detail page shows all content sequentially — long, unstructured vertical scroll"
  - "No clear information hierarchy between editorial content, knowledge facts, and practical info"
  - "Local insight and opening hours buried in main content flow"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [poi-detail, tabs, layout, sidebar, knowledge-categories, accessibility, wcag, typography]
---

# UI Pattern: POI Detail Page — Tab-Based Layout with Sticky Sidebar

## Problem

The POI detail page (`/[area]/steder/[slug]`) displayed all content in a flat sequential layout: editorial hook in a callout box, local insight, then all 5 knowledge categories stacked vertically. This created a long page without clear structure, making it hard to navigate specific content types.

## Environment
- Module: Public Site (POI detail pages)
- Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS
- Affected pages: `app/(public)/[area]/steder/[slug]/page.tsx` and `app/(public)/en/[area]/places/[slug]/page.tsx`
- Date: 2026-02-16

## Symptoms
- Long vertical scroll with no content organization
- Editorial hook hidden in a colored callout box, felt like a sidebar element rather than intro text
- Local insight and opening hours mixed with knowledge content instead of being in practical sidebar
- No way to jump between knowledge categories (Historien, Opplevelsen, Smaken, Stedet, Innsiden)

## Solution

Redesigned to a tab-based layout inspired by mcpmarket.com:

### Architecture: Server/Client Split

**Server-side grouping** (in page.tsx):
```typescript
const CATEGORY_ORDER: KnowledgeCategory[] = ["story", "experience", "taste", "place", "inside"];

// Filter backfill facts when editorial hook exists
const filteredKnowledge = poi.editorialHook
  ? knowledge.filter((k) => !k.sourceName?.toLowerCase().includes("backfill"))
  : knowledge;

// Group by topic
const byTopic = new Map<KnowledgeTopic, typeof filteredKnowledge>();
for (const fact of filteredKnowledge) {
  const existing = byTopic.get(fact.topic) ?? [];
  existing.push(fact);
  byTopic.set(fact.topic, existing);
}

// Build category tabs
const knowledgeCategories = CATEGORY_ORDER
  .map((catKey) => {
    const cat = KNOWLEDGE_CATEGORIES[catKey];
    const activeTopics = cat.topics.filter((t) => byTopic.has(t as KnowledgeTopic));
    if (activeTopics.length === 0) return null;
    return {
      key: catKey,
      label: cat.labelNo, // or cat.labelEn for English
      topicGroups: activeTopics.map((t) => ({
        topic: t as KnowledgeTopic,
        facts: byTopic.get(t as KnowledgeTopic)!,
        showLabel: activeTopics.length > 1,
      })),
    };
  })
  .filter((c): c is NonNullable<typeof c> => c !== null);
```

**Client component** (`POIDetailBody.tsx`) — minimal, only manages tab state:
```tsx
"use client";
// useState for activeTab, renders ALL tab content in DOM
// Visibility toggled with "hidden" class (SEO: all content in HTML)
<div className={activeTab === cat.key ? "" : "hidden"}>
```

**Server component** (`POIDetailSidebar.tsx`) — passed as children:
```tsx
<POIDetailBody categories={knowledgeCategories} locale="no">
  <POIDetailSidebar poi={poi} staticMapUrl={staticMapUrl} locale="no" />
</POIDetailBody>
```

### New Page Structure
```
[Breadcrumb]
[Image Gallery]
[Category Badge + Title]
[Rating + Address + Save]
[Editorial Hook — plain paragraph, not callout box]
─────────────────────────────────────────
[Tab Bar: Historien | Opplevelsen | ...]
┌─────────────────────────┬──────────────────┐
│ Active tab content      │ Action buttons   │
│ (knowledge facts)       │ Static map       │
│                         │ Opening hours    │
│                         │ Local tip        │
└─────────────────────────┴──────────────────┘
[Similar places]
```

### Typography Rules Applied
- **Minimum 15px font-size** across all text (was 11-14px in various places)
- **No CAPS + letter-spacing** — replaced with `font-semibold` in normal case
- **WCAG AA contrast** — replaced `#a0937d` (3.2:1) and `#8a8a8a` (3.5:1) with `#4a4a4a` (7.7:1) and `#767676` (4.6:1)
- **Dark section labels** — `#1a1a1a` for Historikk, Mennesker, etc. (same as headings)

### Layout Specs
- Container: `max-w-5xl` (1024px)
- Two-column grid: `lg:grid-cols-3` with `gap-16` (64px)
- Sidebar: `lg:sticky lg:top-20`
- Tab bar: `overflow-x-auto scrollbar-hide` on mobile

### Edge Cases Handled
| Scenario | Handling |
|----------|---------|
| 0 knowledge categories | No tab bar, sidebar alone |
| 1 category | Tab bar with one pre-selected tab |
| No editorial hook | No paragraph under title |
| No opening hours | Section hidden in sidebar |
| Mobile viewport | Single column, tabs scroll horizontally |

## Why This Works

1. **Server/client boundary is minimal** — only tab switching is client-side. All data fetched server-side, sidebar is a pure server component passed as children.
2. **SEO preserved** — all tab content rendered in DOM with `hidden` class. Google sees everything.
3. **Content hierarchy clear** — editorial hook as intro, tabs for deep content, sidebar for practical info.
4. **Reuses existing types** — `KNOWLEDGE_CATEGORIES`, `KnowledgeTopic` from `lib/types.ts` drive the tab structure.

## Prevention

- When adding new knowledge categories or topics, they automatically appear as tabs if they have facts (dynamic, data-driven).
- The `PlaceKnowledgeSection` component is preserved for potential reuse elsewhere.
- Both NO and EN pages must be updated in sync — they share `POIDetailBody` and `POIDetailSidebar` but have separate page files for locale-specific data fetching.

## Related Issues

- See also: [poi-gallery-grid-three-images-20260215.md](../feature-implementations/poi-gallery-grid-three-images-20260215.md) — gallery grid used on same page
- See also: [trip-preview-desktop-layout-20260215.md](../ui-patterns/trip-preview-desktop-layout-20260215.md) — similar two-column pattern for trips
