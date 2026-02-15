---
module: Knowledge Base
date: 2026-02-15
problem_type: best_practice
component: database
symptoms:
  - "No structured storage for curated city/place knowledge"
  - "POI detail pages lack local insights, history, and practical tips"
root_cause: missing_workflow_step
resolution_type: migration
severity: medium
tags: [knowledge-base, supabase, place-knowledge, xor-constraint, rls, multi-topic, admin]
---

# City Knowledge Base — Schema, Queries & UI (Phase 1)

## Problem

Placy had rich POI data (Google Places, editorial hooks) but no structured way to store **curated knowledge** — local tips, history, accessibility info, seasonal notes — that differentiates from competitors. Needed a flexible, multi-topic knowledge system that works for both individual POIs and city areas.

## Solution

### 1. Database: `place_knowledge` table

```sql
CREATE TABLE place_knowledge (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id        UUID REFERENCES pois(id) ON DELETE CASCADE,
  area_id       UUID REFERENCES areas(id) ON DELETE CASCADE,
  topic         TEXT NOT NULL CHECK (topic IN (
    'history','architecture','local_knowledge','food_drink',
    'practical_tips','accessibility','sustainability',
    'seasonal','neighborhood'
  )),
  fact_text     TEXT NOT NULL,
  fact_text_en  TEXT,
  source_name   TEXT,
  source_url    TEXT CHECK (source_url IS NULL OR source_url ~ '^https?://'),
  confidence    TEXT NOT NULL DEFAULT 'unverified'
                CHECK (confidence IN ('verified','unverified','disputed')),
  display_ready BOOLEAN NOT NULL DEFAULT false,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- XOR: exactly one of poi_id or area_id must be set
  CONSTRAINT chk_pk_target CHECK (
    (poi_id IS NOT NULL AND area_id IS NULL) OR
    (poi_id IS NULL AND area_id IS NOT NULL)
  )
);
```

**Key design decisions:**

- **XOR constraint** — each fact belongs to exactly one POI or one area, never both or neither
- **Named CHECK constraints** — explicit constraint names for clear error messages
- **9 topics** — comprehensive but bounded enum covering all knowledge types
- **Confidence levels** — `verified`/`unverified`/`disputed` for editorial workflow
- **`display_ready` flag** — controls public visibility, decoupled from confidence
- **Bilingual** — `fact_text` (Norwegian primary) + `fact_text_en` (English optional)

### 2. RLS Policies

```sql
-- Public: only display_ready facts
CREATE POLICY pk_public_read ON place_knowledge
  FOR SELECT USING (display_ready = true);

-- Service role: full access for admin/research pipeline
ALTER TABLE place_knowledge ENABLE ROW LEVEL SECURITY;
```

Two-tier access: public queries through `createPublicClient()` (RLS-enforced), admin through `createServerClient()` (service_role bypasses RLS).

### 3. Indexes (5 targeted indexes)

```sql
CREATE INDEX idx_pk_poi_display    ON place_knowledge (poi_id, sort_order) WHERE display_ready = true;
CREATE INDEX idx_pk_area_display   ON place_knowledge (area_id, sort_order) WHERE display_ready = true;
CREATE INDEX idx_pk_topic          ON place_knowledge (topic);
CREATE INDEX idx_pk_confidence     ON place_knowledge (confidence);
CREATE INDEX idx_pk_display_ready  ON place_knowledge (display_ready) WHERE display_ready = true;
```

Partial indexes on `display_ready = true` keep public queries fast by excluding draft facts.

### 4. Query Architecture

**Public queries** (`lib/public-queries.ts`):
- `getPlaceKnowledge(poiId)` — single POI, partial index covers it
- `getPlaceKnowledgeBatch(poiIds)` — batch for map popups (limit 5 per POI)
- `getAreaKnowledge(areaId)` — area-level facts

**Admin queries** (`lib/supabase/queries.ts`):
- `getAllKnowledgeAdmin()` — all facts with place name join, for admin dashboard

**Transform pattern** — `transformPlaceKnowledge()` maps snake_case DB rows to camelCase TypeScript with `isSafeUrl()` guard on source URLs.

### 5. UI Components

- **PlaceKnowledgeSection** — server component, groups facts by topic in canonical `KNOWLEDGE_TOPICS` order, deduplicates, handles EN fallback
- **MapPopupCard** — shows 1 knowledge snippet (prefers `local_knowledge` > `history`) via `useMemo`
- **KnowledgeAdminClient** — full admin table with topic/confidence/display filters, stats dashboard

### 6. Integration Pattern

POI detail pages use `Promise.all` to parallelize knowledge + existing queries:

```typescript
const [poi, knowledge] = await Promise.all([
  getPOIBySlug(slug),
  poi?.id ? getPlaceKnowledge(poi.id) : Promise.resolve([]),
]);
```

## Code Review Learnings

- **Query ordering must match index** — `.order("topic")` on a `(poi_id, sort_order)` index forces a sort step. Removed topic ordering from query since `PlaceKnowledgeSection` groups by topic in canonical order client-side.
- **IIFE in JSX is an anti-pattern** — replaced with `useMemo` for better readability and memoization
- **Strict boolean transforms** — `row.display_ready === true` is safer than `row.display_ready ? true : false` for Supabase's nullable booleans

## Prevention

- When adding Supabase queries with `.order()`, verify the ORDER BY columns match an existing index
- For knowledge facts displayed publicly, always query through `createPublicClient()` to enforce RLS
- When adding new topics, update both `KNOWLEDGE_TOPICS` array and the DB CHECK constraint

## Related Issues

- See also: [facebook-url-poi-cards-20260215.md](./facebook-url-poi-cards-20260215.md) — shared `isSafeUrl` utility reused here
- See also: [report-map-popup-card-20260213.md](./report-map-popup-card-20260213.md) — MapPopupCard extended with knowledge snippet
