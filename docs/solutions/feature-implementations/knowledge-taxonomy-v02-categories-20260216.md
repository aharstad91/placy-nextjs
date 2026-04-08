---
title: "Knowledge Base Taxonomy v0.2 — Category-Grouped Topics"
category: feature-implementations
tags: [knowledge-base, taxonomy, typescript, postgres, check-constraint, categories]
module: Knowledge Base
date: 2026-02-16
severity: medium
problem_type: feature_extension
---

# Knowledge Base Taxonomy v0.2 — Category-Grouped Topics

## Problem

v0.1 had 9 flat topics (`history`, `architecture`, `food`, etc.). Curator review of 226 facts revealed content "bleeding" between topics — atmosphere facts in architecture, drink facts in food, insider tips in local_knowledge. Needed both more topics and logical grouping.

## Solution

Extended from 9 flat topics to **5 categories** with **19 sub-topics** + 1 legacy value.

### Key Technical Decisions

**1. Categories in TypeScript only (not DB)**

Categories are a presentation concern. DB stores atomic facts with a topic classification. How topics are grouped for display is a UI decision that can evolve independently.

```typescript
// as const satisfies — compile-time validation of category-topic mapping
export const KNOWLEDGE_CATEGORIES = {
  story: { labelNo: 'Historien', labelEn: 'The Story', topics: ['history', 'people', 'awards', 'media', 'controversy'] },
  experience: { labelNo: 'Opplevelsen', labelEn: 'The Experience', topics: ['atmosphere', 'signature', 'culture', 'seasonal'] },
  taste: { labelNo: 'Smaken', labelEn: 'The Taste', topics: ['food', 'drinks', 'sustainability'] },
  place: { labelNo: 'Stedet', labelEn: 'The Place', topics: ['architecture', 'spatial', 'nature', 'accessibility'] },
  inside: { labelNo: 'Innsiden', labelEn: 'The Inside Track', topics: ['practical', 'insider', 'relationships', 'local_knowledge'] },
} as const satisfies Record<string, CategoryDef>;
```

**2. CHECK constraint over ENUM**

`ALTER TYPE ... ADD VALUE` cannot run inside a transaction. CHECK constraints can be replaced atomically with `BEGIN/COMMIT`. Better for evolving taxonomies.

**3. Idempotent migration**

`DROP CONSTRAINT IF EXISTS` + `BEGIN/COMMIT` makes migration re-runnable.

**4. Sub-topic labels conditional**

Only show sub-topic headings when a category has 2+ active topics. Single-topic categories show only the category heading.

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/041_knowledge_taxonomy_v02.sql` | CHECK constraint from 9→20 values |
| `lib/types.ts:566-655` | KNOWLEDGE_TOPICS, KNOWLEDGE_CATEGORIES, labels |
| `components/public/PlaceKnowledgeSection.tsx` | Category-grouped rendering |
| `components/variants/report/MapPopupCard.tsx:38-45` | Extended snippet priority |
| `app/admin/knowledge/knowledge-admin-client.tsx` | Grouped filter UI |

### Discovery: MapPopupCard

Codebase exploration during deepened plan phase found `MapPopupCard.tsx:41` had hardcoded `local_knowledge`/`history` topic priority — would have been missed without systematic file search. Always search for all imports of modified types.

## Prevention

- `Record<KnowledgeTopic, string>` for label maps forces compile-time completeness
- `as const satisfies` catches typos in category topic arrays
- 7 files import KNOWLEDGE_TOPICS — most auto-adapt, but components with hardcoded topic strings need manual review

## Related

- v0.1 schema: `docs/solutions/feature-implementations/city-knowledge-base-schema-queries-20260215.md`
- Supabase fallback: `docs/solutions/database-issues/supabase-graceful-column-fallback-20260206.md`
- PR: #44
