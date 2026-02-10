---
title: "feat: POI Tier System — Fase 2 (DB, tier-evaluering, UI-integrasjon)"
type: feat
date: 2026-02-10
brainstorm: docs/brainstorms/2026-02-10-poi-tier-system-quality-curation-brainstorm.md
phase: "Fase 2 of POI Tier System"
---

# feat: POI Tier System — Fase 2

## Overview

Fase 2 adds the database schema, Claude-driven tier evaluation, and UI integration for the POI Tier System. Builds on Fase 1 (formula scoring + sub-section fixes, PR #25).

**Core idea:** Claude evaluates each POI via web search and assigns Tier 1/2/3 + editorial content + rich metadata — all in one pass. The UI then uses tiers to surface the best POIs first.

## Problem Statement

Currently all POIs are treated equally — sorted by proximity (Explorer) or formula score (Report). Dense urban areas show too many mediocre results. There's no way to distinguish a local gem from a chain restaurant.

## Proposed Solution

### 1. Database migration — new columns on `pois`

Add tier columns, chain/gem booleans, JSONB metadata, and evaluation timestamp to the existing `pois` table. Global (not per-product) because tier reflects intrinsic POI quality.

### 2. TypeScript type updates

Extend `POI` interface, `DbPoi` type, and `transformPOI()` to propagate tier data from DB to frontend.

### 3. Report: tier-aware highlights

Modify `pickHighlights()` to prefer Tier 1 POIs over formula score fallback. Tier 1 always in highlights, Tier 2 fills remaining slots.

### 4. Explorer: tier-aware sorting within caps

Modify `applyExplorerCaps()` to sort by `(tier asc, score desc)` within each theme. Tier 1 bubbles up, caps remain unchanged.

### 5. Claude tier evaluation command

A Claude Code workflow command that evaluates POIs one-by-one with web search, setting tier + editorial + metadata. Designed for manual invocation per project.

## Technical Approach

### File: `supabase/migrations/017_add_poi_tier_system.sql`

#### Task 1: Database migration

```sql
-- POI Tier System columns
ALTER TABLE pois ADD COLUMN poi_tier SMALLINT CHECK (poi_tier IN (1, 2, 3));
ALTER TABLE pois ADD COLUMN tier_reason TEXT;
ALTER TABLE pois ADD COLUMN is_chain BOOLEAN DEFAULT false;
ALTER TABLE pois ADD COLUMN is_local_gem BOOLEAN DEFAULT false;
ALTER TABLE pois ADD COLUMN poi_metadata JSONB DEFAULT '{}';
ALTER TABLE pois ADD COLUMN tier_evaluated_at TIMESTAMPTZ;

-- Indexes for tier-based queries
CREATE INDEX idx_pois_tier ON pois(poi_tier) WHERE poi_tier IS NOT NULL;
CREATE INDEX idx_pois_chain ON pois(is_chain) WHERE is_chain = true;
CREATE INDEX idx_pois_local_gem ON pois(is_local_gem) WHERE is_local_gem = true;

-- Index for finding unevaluated POIs
CREATE INDEX idx_pois_tier_unevaluated ON pois(created_at) WHERE poi_tier IS NULL;
```

**Pattern follows:** `014_add_poi_trust_score.sql` — same ALTER TABLE + partial indexes approach.

**Null `poi_tier`** means unevaluated — backward compatible, existing sort logic unchanged.

### File: `lib/supabase/types.ts`

#### Task 2: Update `DbPoi` type

Add new columns to the `pois` table Row/Insert/Update types:

```typescript
// Add to pois.Row:
poi_tier: number | null;
tier_reason: string | null;
is_chain: boolean;
is_local_gem: boolean;
poi_metadata: Record<string, unknown>;
tier_evaluated_at: string | null;
```

**Note:** Until `supabase gen types` is run, use `as string` casts in queries. Follow the pattern from `product_pois.featured` (line 796 in queries.ts).

### File: `lib/types.ts`

#### Task 3: Extend `POI` interface

```typescript
// Add to POI interface:
poiTier?: 1 | 2 | 3;
tierReason?: string;
isChain?: boolean;
isLocalGem?: boolean;
poiMetadata?: Record<string, unknown>;
tierEvaluatedAt?: string;
```

### File: `lib/supabase/queries.ts`

#### Task 4a: Update `transformPOI()`

Map the 6 new DB columns to the POI interface fields. Follow existing trust_score pattern (lines 96-98) with direct access:

```typescript
// Add inside transformPOI() — direct access like trust_score fields:
poiTier: dbPoi.poi_tier ?? undefined,
tierReason: dbPoi.tier_reason ?? undefined,
isChain: dbPoi.is_chain ?? undefined,
isLocalGem: dbPoi.is_local_gem ?? undefined,
poiMetadata: dbPoi.poi_metadata ?? undefined,
tierEvaluatedAt: dbPoi.tier_evaluated_at ?? undefined,
```

**Note:** Since Task 2 updates DbPoi types first, direct access works. No `Record<string, unknown>` cast needed — follow the trust_score pattern, not the venue_type pattern.

#### Task 4b: Update `getPOIsWithinRadius()` manual column mapping

**CRITICAL:** `getPOIsWithinRadius()` (line 162-246) manually constructs DbPoi objects from RPC response (lines 214-245). New columns will be **silently dropped** unless added here.

```typescript
// Add to manual DbPoi construction (after trust_score fields, ~line 240):
poi_tier: row.poi_tier ?? null,
tier_reason: row.tier_reason ?? null,
is_chain: row.is_chain ?? false,
is_local_gem: row.is_local_gem ?? false,
poi_metadata: row.poi_metadata ?? {},
tier_evaluated_at: row.tier_evaluated_at ?? null,
```

**Why this is critical:** Without this, Explorer POIs fetched via radius query will have `poiTier: undefined` even after tier evaluation — breaking tier-aware sorting in Explorer caps.

#### Task 4c: Update `upsertPOIsWithEditorialPreservation()` tier field preservation

**CRITICAL:** `upsertPOIsWithEditorialPreservation()` preserves editorial and trust fields during re-imports but NOT tier fields. Without this fix, running `generate-hotel` again destroys all tier evaluations.

Add tier fields to the preservation list alongside editorial and trust fields:

```typescript
// Add to preserved fields (alongside editorial_hook, local_insight, trust_score etc.):
poi_tier: existingPoi.poi_tier,
tier_reason: existingPoi.tier_reason,
is_chain: existingPoi.is_chain,
is_local_gem: existingPoi.is_local_gem,
poi_metadata: existingPoi.poi_metadata,
tier_evaluated_at: existingPoi.tier_evaluated_at,
```

**Pattern:** Same as editorial hook preservation — only overwrite when new value is explicitly provided.

### File: `components/variants/report/report-data.ts`

#### Task 5: Tier-aware `pickHighlights()`

Current logic: featured → formula score fallback. New logic: featured → Tier 1 → formula score.

**IMPORTANT:** Preserve the `featured.length > 0` early return. Current behavior: if ANY featured POIs exist, return only those (even if just 1). This is correct — featured POIs are hand-curated and should not be diluted with non-featured POIs. Only insert Tier 1 logic in the `featured.length === 0` path.

```typescript
function pickHighlights(pois: POI[], displayMode: ThemeDisplayMode): POI[] {
  if (displayMode !== "editorial") return [];

  // 1. Featured POIs (manually curated) — return ALL featured, nothing else
  const featured = pois.filter((p) => p.featured);
  if (featured.length > 0) return featured;

  // 2. Tier 1 POIs next (only reached when no featured POIs exist)
  const tier1 = pois.filter((p) => p.poiTier === 1);
  if (tier1.length >= HIGHLIGHT_FALLBACK_COUNT) {
    return tier1.sort(byFormulaScore).slice(0, HIGHLIGHT_FALLBACK_COUNT);
  }

  // 3. Fallback: fill Tier 1 + top formula-scored POIs
  const tier1Ids = new Set(tier1.map(p => p.id));
  const rest = pois.filter(p => !tier1Ids.has(p.id)).sort(byFormulaScore);
  return [...tier1, ...rest].slice(0, HIGHLIGHT_FALLBACK_COUNT);
}
```

**Behavioral change from current:** None when featured exist. When no featured: Tier 1 POIs now appear before formula-score POIs in highlights.

**Backward compatible:** If no POIs have `poiTier`, the `tier1` array is empty and logic falls through to formula score — identical to current behavior.

#### Task 6: Tier-aware sub-section sorting

Update `buildSubSections()` to sort by tier then formula score:

```typescript
/** Null tier = 2.5 (between tier 2 and 3). Avoids penalizing unevaluated popular POIs during partial evaluation. */
const NULL_TIER_VALUE = 2.5;

function byTierThenScore(a: POI, b: POI): number {
  // Lower tier = better (1 > 2 > 3). Null = 2.5 (between tier 2 and 3)
  const aTier = a.poiTier ?? NULL_TIER_VALUE;
  const bTier = b.poiTier ?? NULL_TIER_VALUE;
  if (aTier !== bTier) return aTier - bTier;
  return calculateReportScore(b) - calculateReportScore(a);
}
```

**Why 2.5 not 3:** During partial evaluation (e.g., only restaurants evaluated), unevaluated POIs in other categories would all sink to the bottom if null=3. With null=2.5, unevaluated popular POIs sort between Tier 2 and Tier 3 — fair during rollout.

Replace `byFormulaScore` in `buildSubSections()` with `byTierThenScore`. Keep `byFormulaScore` for theme-level sorting (themes without sub-sections).

### File: `lib/themes/apply-explorer-caps.ts`

#### Task 7: Tier-aware Explorer sorting

Within each theme, sort by tier first, then score. Change the sort in step 5:

```typescript
// BEFORE (line 60-63):
const themePOIs = transportCapped
  .filter((s) => themeCats.has(s.poi.category.id) && !selectedIds.has(s.poi.id))
  .sort((a, b) => b.score - a.score)
  .slice(0, themeCap);

// AFTER: tier first, then score
const themePOIs = transportCapped
  .filter((s) => themeCats.has(s.poi.category.id) && !selectedIds.has(s.poi.id))
  .sort((a, b) => {
    const aTier = a.poi.poiTier ?? NULL_TIER_VALUE;
    const bTier = b.poi.poiTier ?? NULL_TIER_VALUE;
    if (aTier !== bTier) return aTier - bTier;
    return b.score - a.score;
  })
  .slice(0, themeCap);
```

**Backward compatible:** Null tiers default to 2.5, so without tier data, all POIs have equal tier and sorting is purely by score (same as today). Use the same `NULL_TIER_VALUE` constant exported from `report-data.ts`.

### File: `lib/supabase/mutations.ts`

#### Task 8: Tier update mutation (`updatePOITier`)

Add a function to update tier data for a single POI. Follows `updatePOITrustScore()` pattern: throw on error, validate inputs.

**Editorial overwrite policy:** Only write `editorial_hook` and `local_insight` if the existing value is null. This prevents tier evaluation from destroying hand-crafted editorial content.

```typescript
export async function updatePOITier(
  poiId: string,
  data: {
    poi_tier: 1 | 2 | 3;
    tier_reason: string;
    is_chain: boolean;
    is_local_gem: boolean;
    poi_metadata: Record<string, unknown>;
    editorial_hook?: string;
    local_insight?: string;
    editorial_sources?: string[];
  }
): Promise<void> {
  const client = createServerClient();
  if (!client) throw new Error("Supabase client not available");

  // Only write editorial fields if currently null (preserve hand-crafted content)
  const editorialUpdate: Record<string, unknown> = {};
  if (data.editorial_hook) {
    const { data: existing } = await client
      .from("pois")
      .select("editorial_hook, local_insight")
      .eq("id", poiId)
      .single();
    if (!existing?.editorial_hook) editorialUpdate.editorial_hook = data.editorial_hook;
    if (!existing?.local_insight && data.local_insight) editorialUpdate.local_insight = data.local_insight;
  }

  const { error } = await client
    .from("pois")
    .update({
      poi_tier: data.poi_tier,
      tier_reason: data.tier_reason,
      is_chain: data.is_chain,
      is_local_gem: data.is_local_gem,
      poi_metadata: data.poi_metadata,
      editorial_sources: data.editorial_sources ?? [],
      tier_evaluated_at: new Date().toISOString(),
      ...editorialUpdate,
    } as Record<string, unknown>)
    .eq("id", poiId);

  if (error) throw new Error(`Failed to update POI tier for ${poiId}: ${error.message}`);
}
```

**Naming:** `updatePOITier` (uppercase POI) matches `updatePOITrustScore` pattern.

### Claude Tier Evaluation Command

#### Task 9: Evaluation prompt design

The tier evaluation is a Claude Code command (invoked manually, not an automated script). Design the evaluation prompt:

**Input:** POI name, category, city, existing Google data (rating, reviews, address).

**Skip transport categories:** Bus stops, tram stops, parking garages, etc. are infrastructure — auto-assign Tier 3 without web search.

**Batch strategy:** Evaluate 20-30 POIs per session. Start with restaurants (highest impact), then cafés, then remaining categories.

**Claude does:**
1. Web search for the POI (TripAdvisor, Yelp, local media, blogs)
2. Evaluate against 3 dimensions: locally unique, quality, story-potential
3. Assign tier (1, 2, or 3)
4. Write `editorialHook` and `localInsight` (only if not already set — see Task 8 editorial overwrite policy)
5. Extract metadata (cuisine_type, vibe, best_for, awards, media mentions)
6. Tag `is_chain` and `is_local_gem`

**Output per POI:**
```json
{
  "poi_tier": 1,
  "tier_reason": "Trondheims eldste kafé (1929), lokalt ikon med særegen atmosfære",
  "is_chain": false,
  "is_local_gem": true,
  "editorial_hook": "Dreid Kafé har servert kaffe siden 1929 — Trondheims ubestridte kaffeinstitusjon.",
  "local_insight": "Sett deg i andre etasje for best utsikt. Prøv den hjemmelagde kanelsnurren.",
  "editorial_sources": ["tripadvisor.com/...", "adressa.no/..."],
  "poi_metadata": {
    "cuisine_type": "cafe",
    "vibe": ["historic", "cozy"],
    "best_for": ["coffee", "pastries"],
    "established_year": 1929,
    "third_party_recognition": ["TripAdvisor Travellers Choice 2025"],
    "media_mentions": ["Adresseavisen beste kafé 2024"],
    "notable_details": "Trondheims eldste kafé, åpnet 1929"
  }
}
```

**Tier criteria:**
- **Tier 1** (max 2-3 per category): Locally unique + quality + story-potential. Claude actively recommends.
- **Tier 2**: Solid quality. Good rating + reviews. Formula score handles ranking.
- **Tier 3**: Accessible. Passes trust filter but nothing special.

**Implementation:** This is invoked as a Claude Code session task, not a compiled script. Claude uses WebSearch tool per POI and writes results via Supabase mutation.

#### Task 10: Dry-run on Scandic Lerkendal data

Test the evaluation on a small batch (e.g., 10 restaurant POIs) to validate:
- Tier assignments make sense
- Metadata extraction works
- editorialHook quality improves
- is_chain tagging is accurate (e.g., Peppes Pizza = chain, Bula Neobistro = local gem)

## Acceptance Criteria

- [x] Migration `017_add_poi_tier_system.sql` created and tested locally
- [x] `POI` interface extended with tier fields
- [x] `DbPoi` type updated with new columns
- [x] `transformPOI()` maps new columns (direct access pattern like trust_score)
- [x] `getPOIsWithinRadius()` manual mapping includes 6 new tier columns
- [x] `upsertPOIsWithEditorialPreservation()` preserves tier fields during re-imports
- [x] `pickHighlights()` prefers Tier 1 POIs (only in non-featured path)
- [x] `pickHighlights()` preserves `featured.length > 0` early return (no behavioral change for featured POIs)
- [x] Sub-section sorting uses tier-then-score (null tier = 2.5)
- [x] Explorer caps sort by tier-then-score within themes (null tier = 2.5)
- [x] `updatePOITier()` mutation: throws on error, editorial overwrite only if null
- [x] No regression: themes without tier data render identically to before
- [x] TypeScript compiles without errors
- [x] Existing tests pass

## Testing

### Backward compatibility (critical)
1. **Report without tier data** — renders identically to current behavior
2. **Explorer without tier data** — POI order unchanged (null tier = 2.5, all equal → pure score sort)
3. **Sub-sections** — formula score sorting still works for unevaluated POIs
4. **Re-import preservation** — running `generate-hotel` again does NOT destroy tier data

### Manual verification (after migration + tier evaluation)
1. Navigate to `/scandic/scandic-lerkendal/report` — Tier 1 POIs appear in highlights
2. Check Explorer — Tier 1 POIs surface first within each theme
3. Verify `poi_metadata` JSONB stores valid data

### Unit tests
- [x] `byTierThenScore()` — tier 1 before tier 2 before tier 3
- [x] `byTierThenScore()` — null tier treated as 2.5 (between tier 2 and tier 3)
- [x] `byTierThenScore()` — same tier sorted by formula score
- [x] `byTierThenScore()` — all null tiers = pure formula score sort (backward compat)
- [ ] `pickHighlights()` — featured > tier 1 > formula score
- [ ] `pickHighlights()` — featured POIs returned alone (no Tier 1 mixing)

## References

- Brainstorm: `docs/brainstorms/2026-02-10-poi-tier-system-quality-curation-brainstorm.md`
- Fase 1 plan: `docs/plans/2026-02-10-fix-report-subsections-formula-score-plan.md`
- Fase 1 learnings: `docs/solutions/feature-implementations/report-subcategory-splitting-20260210.md`
- Trust scoring pattern: `docs/solutions/feature-implementations/poi-trust-validation-pipeline-20260208.md`
- Supabase graceful fallback: `docs/solutions/database-issues/supabase-graceful-column-fallback-20260206.md`
- POI scoring: `docs/solutions/feature-implementations/generate-hotel-scoring-featured-capping-20260206.md`
- Migration template: `supabase/migrations/014_add_poi_trust_score.sql`
