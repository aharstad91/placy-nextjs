---
module: Knowledge Base
date: 2026-02-16
problem_type: best_practice
component: database
symptoms:
  - "Pass 1 reclassification only covered 50/231 facts — stopped at 'good enough'"
  - "Remaining 181 facts not verified after initial obvious moves"
  - "No completeness reporting — unclear how much was actually reviewed"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: high
tags: [data-migration, reclassification, multi-pass, quality-standard, completeness]
---

# Multi-Pass Data Reclassification — "Ferdig betyr ferdig"

## Problem

When reclassifying 231 knowledge facts from 9 flat topics to 19 sub-topics, pass 1 identified 50 obvious moves in ~5 minutes and stopped. The remaining 181 facts were assumed correct without verification. This produced a 78% incomplete result — only the easy cases were handled.

## Environment
- Module: Knowledge Base (`place_knowledge` table)
- Stack: TypeScript scripts + Supabase REST API
- Data size: 231 facts across 17 active topics (of 19 possible)
- Date: 2026-02-16

## Symptoms
- Pass 1 moved 50 facts and reported "done" — but 181 facts were never read with full text
- No completeness metric reported (e.g., "50 of 231 reviewed")
- After thorough pass 2 (reading ALL 231 facts), 9 additional misplacements were found — borderline cases that required full-text reading to catch

## What Didn't Work

**Pass 1 alone (single-pass approach):**
- Read facts grouped by topic, identified obvious misplacements
- Worked well for clear cases (food → drinks, architecture → atmosphere)
- Failed to catch borderline cases: `culture → history` (Jewish Museum deportation), `nature → spatial` (man-made courtyard), `architecture → practical` (facility specs vs architecture)
- **Why it failed:** One-pass scanning optimizes for speed, not accuracy. Borderline facts require reading full text and comparing against topic definitions.

## Solution

**3-pass methodology for data classification work:**

### Pass 1: Decision mode (speed-optimized)
Scan all facts, move obvious misplacements. Goal: handle the 80% that are clearly wrong.

```typescript
// scripts/reclassify-knowledge-v02.ts
const RECLASSIFICATIONS: Record<string, { newTopic: string; reason: string }> = {
  // Each entry: shortId → { newTopic, reason }
  "e60a24bb": { newTopic: "drinks", reason: "Bar Moskus is a drinks bar with no food" },
  // ... 50 entries total
};
```

**Result: 50 moves, ~5 minutes**

### Pass 2: Verification mode (accuracy-optimized)
Export ALL facts with full text. Read every single one. Verify current topic or identify new moves.

```typescript
// scripts/export-knowledge-full.ts — export with full text for review
const res = await fetch(
  `${url}/rest/v1/place_knowledge?select=id,poi_id,topic,fact_text,source_name,confidence,display_ready,pois(name)&order=topic,poi_id`,
  { headers: { apikey: key!, Authorization: `Bearer ${key}` } }
);
```

Topic-by-topic review of all 231 facts:
- ACCESSIBILITY (2) — verified
- ARCHITECTURE (18) — found 1 move (facility specs, not architecture)
- ATMOSPHERE (10) — verified
- ... (all 17 active topics reviewed)

```typescript
// scripts/reclassify-knowledge-v02-pass2.ts
const RECLASSIFICATIONS: Record<string, { newTopic: string; reason: string }> = {
  "ad44499e": { newTopic: "history", reason: "Deportation to Auschwitz 1942 — historical event" },
  "20ff18f3": { newTopic: "spatial", reason: "Man-made stone courtyard — not nature" },
  // ... 9 entries total
};
```

**Result: 9 additional moves from reading all 231 facts**

### Pass 3: Spot-check mode (validation)
Randomly sample 6 pass 1 decisions and verify against full text. All confirmed correct.

### Script pattern: Supabase REST API batch update

```typescript
// Reusable pattern for idempotent reclassification
async function supabasePatch(
  id: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/place_knowledge?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    }
  );
  return res.ok ? { ok: true } : { ok: false, error: await res.text() };
}

// Short-ID matching: use `id.like.{prefix}*` for 8-char prefixes
const idFilter = ids.map((id) => `id.like.${id}*`).join(",");
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/place_knowledge?select=id,topic&or=(${idFilter})`,
  { headers: { ... } }
);
```

### Completeness report format

```
231/231 fakta gjennomgått
Pass 1: 50 endret
Pass 2: 9 endret, 222 bekreftet
Pass 3: 6 stikkprøver, alle korrekte
Totalt: 59 endret, 172 bekreftet riktig
```

## Why This Works

1. **Pass 1 catches the obvious (80%).** Speed is appropriate for clear misplacements.
2. **Pass 2 catches the borderline (remaining 20%).** Full-text reading reveals nuances that scanning misses. The 9 additional moves were all borderline cases requiring careful judgment.
3. **Pass 3 validates pass 1 quality.** Spot-checking prevents systematic errors from propagating.
4. **Completeness reporting creates accountability.** "X of Y reviewed" makes coverage explicit, not assumed.

The key insight: the *last 4%* of moves (9 of 59 total) required *80%* of the effort (reading all 231 facts). But those borderline cases are where classification quality lives.

## Prevention

- **Define "done" before starting.** State: "All N items will be reviewed. Report: X reviewed, Y changed, Z confirmed."
- **Never report data work as complete without a completeness metric.** "50 moved" is not the same as "231 reviewed, 50 moved."
- **Use multi-pass for any data > 50 items.** Single-pass works for small datasets. For hundreds of items, plan for verification.
- **Script pattern: always include `--dry-run`.** Preview changes before applying. Both pass 1 and pass 2 scripts supported dry-run mode.
- **Idempotent scripts.** Both scripts can be re-run safely — if a fact is already in the correct topic, it's skipped.

## Related Issues

- See also: [knowledge-taxonomy-v02-categories-20260216.md](../feature-implementations/knowledge-taxonomy-v02-categories-20260216.md) — the schema/TypeScript changes that created the 19 topics
- See also: [idempotent-backfill-patterns-supabase-20260215.md](../feature-implementations/idempotent-backfill-patterns-supabase-20260215.md) — related Supabase script patterns
