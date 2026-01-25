---
status: complete
priority: p1
issue_id: "001"
tags: [code-review, data-integrity, poi-importer]
dependencies: []
---

# Editorial Content Preservation in POI Upsert

## Problem Statement

Supabase upsert med `onConflict: 'id'` vil **overskrive alle kolonner** som sendes, inkludert editorial-felter. Planen antar feilaktig at upsert bevarer eksisterende verdier for kolonner som ikke er inkludert.

**Konsekvens:** Hver re-import vil slette all manuelt kuratert innhold (editorial_hook, local_insight, description, etc.).

## Findings

**Data Integrity Guardian Agent:**
> "Supabase upsert does NOT preserve unspecified columns by default. Every re-import will destroy all editorial content."

**Scenario:**
1. Dag 1: Import POI "Cafe Lansen"
2. Dag 2: Redaktør legger til `editorial_hook = "Trondheims eldste kaffebrenneri"`
3. Dag 3: Re-import fra Google → editorial_hook blir NULL

**Berørte felter:**
- `editorial_hook`
- `local_insight`
- `description`
- `story_priority`
- `editorial_sources`
- `featured_image`

## Proposed Solutions

### Option A: Fetch-Merge-Upsert Pattern (Recommended)
**Effort:** Medium | **Risk:** Low

```typescript
async function upsertPOIsWithPreservation(pois: POIForImport[]) {
  // Hent eksisterende editorial data FØR upsert
  const { data: existing } = await supabase
    .from('pois')
    .select('id, editorial_hook, local_insight, description, story_priority')
    .in('id', pois.map(p => p.id));

  const existingMap = new Map(existing?.map(e => [e.id, e]));

  // Merge: bevar editorial fra eksisterende
  const merged = pois.map(poi => ({
    ...poi,
    editorial_hook: existingMap.get(poi.id)?.editorial_hook ?? null,
    local_insight: existingMap.get(poi.id)?.local_insight ?? null,
    // ... etc
  }));

  await supabase.from('pois').upsert(merged, { onConflict: 'id' });
}
```

**Pros:** Garanterer bevaring, eksplisitt logikk
**Cons:** Ekstra query per batch

### Option B: Database Trigger
**Effort:** Medium | **Risk:** Medium

Lag en PostgreSQL trigger som bevarer editorial-felter ved UPDATE.

**Pros:** Automatisk, kan ikke bypasses
**Cons:** Logikk skjult i database, vanskeligere å debugge

### Option C: Separate Insert/Update Logic
**Effort:** High | **Risk:** Low

Sjekk om POI eksisterer, bruk INSERT for nye og UPDATE (med COALESCE) for eksisterende.

**Pros:** Full kontroll
**Cons:** Mer kompleks kode

## Recommended Action

<!-- Fylles ut under triage -->

## Technical Details

**Affected files:**
- `lib/supabase/mutations.ts` - upsertPOIs funksjon
- Plan seksjon 2.3 (linjer 418-471)

**Database columns to preserve:**
```sql
editorial_hook TEXT,
local_insight TEXT,
description TEXT,
story_priority INTEGER,
editorial_sources TEXT[],
featured_image TEXT
```

## Acceptance Criteria

- [ ] Re-import av eksisterende POI bevarer alle editorial-felter
- [ ] Nye POI-er får NULL for editorial-felter (ikke undefined)
- [ ] Test: Import POI → Legg til editorial → Re-import → Verifiser editorial bevart
- [ ] Type-safe implementasjon med eksplisitt Omit<> type

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-25 | Created | Identifisert under plan review |

## Resources

- Plan: `docs/plans/2026-01-25-feat-storywriter-poi-importer-plan.md` (linjer 443-455)
- Supabase upsert docs: https://supabase.com/docs/reference/javascript/upsert
