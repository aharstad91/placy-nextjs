---
module: City Knowledge Base (Research Pipeline Execution)
date: 2026-02-15
problem_type: feature_implementation
category: feature-implementations
severity: medium
tags:
  - research-pipeline
  - claude-code
  - websearch
  - editorial-backfill
  - place_knowledge
  - multi-agent
  - data-quality
  - trondheim
symptoms:
  - Need to populate place_knowledge with real data for 20 POIs
  - No Anthropic API key — all research must happen in Claude Code with WebSearch
  - Editorial hooks need parsing into structured knowledge facts
  - Must handle dedup between research and editorial sources
---

# Research Pipeline Execution — Results & Lessons Learned

## Problem

Phase 1 of City Knowledge Base delivered infrastructure (table, types, queries, UI) but zero data. Phase 2 needed to populate `place_knowledge` for 20 Trondheim POIs using a research pipeline that runs entirely within Claude Code (no external API keys).

## Solution

### Pipeline Architecture

```
manifest.json (20 POIs)
    ↓
WebSearch research (4 parallel agents × 5 batches)
    ↓
JSON files in data/research/ (132 facts)
    ↓
backfill-knowledge.ts → Supabase (SHA-256 dedup)
    ↓
Editorial parsing (19 POIs with hooks → 54 facts)
    ↓
backfill-knowledge.ts --editorial → Supabase
    ↓
Reconciliation + verification
```

### Results

| Metric | Value |
|--------|-------|
| POIs researched | 20 |
| Research facts | 132 (avg 6.6/POI) |
| Editorial facts | 54 (avg 2.8/POI) |
| Total in DB | 231 (incl. 20 pre-existing + 25 from Phase 1) |
| Unverified facts | 4 of 132 (3%) |
| Insert failures | 0 |
| Idempotency | Verified (re-runs skip all) |
| Build status | Passes |

### Topic Distribution

```
history: 38    culture: 32    practical: 29    food: 28
spatial: 27    people: 25     local_knowledge: 23    architecture: 22
nature: 7
```

Nature is low because most POIs are restaurants/bars/cafés.

## Key Decisions

### 1. Research Agent Batching (max 4 parallel)

CLAUDE.md limits to 4 background agents. Each agent researched 1 POI with WebSearch per topic. Ran 5 batches of 4 agents = 20 POIs total.

### 2. Editorial Backfill as Separate Phase

Instead of mixing editorial parsing with web research, kept them separate:
- Research: WebSearch → detailed facts with external sources
- Editorial: Parse existing hooks → concise facts tagged `Placy editorial (backfill 038)`

This allows UI-level dedup: `PlaceKnowledgeSection` filters out backfill facts when POI has `editorial_hook`.

### 3. Confidence = 'verified' Only with 2+ Sources

Research agents only marked facts as `verified` when found in 2+ independent sources. This caught 4 facts with single-source claims. All editorial facts are `verified` (already curator-written).

### 4. display_ready = false by Default

All 186 new facts require manual curator review before appearing on public pages. The admin interface shows all facts regardless.

## Corrections Found During Research

| POI | Claim in editorial | Research finding |
|-----|-------------------|------------------|
| Britannia Hotel | Renovert for 1,4 mrd | ~1,2 mrd (multiple sources) |
| Bula Neobistro | Top Chef 2015 | Top Chef 2016 |
| Credo | "Verdens første grønne stjerne" | Inaugural cohort 2020 (not sole first) |
| Backstube | Åpnet 2016 | Grunnlagt 2015, Oslo-filial 2016 |
| Den Gode Nabo | "Over tretti år" | Åpnet ~1995 (ca. 31 år) |

These corrections are captured in the research facts but not propagated to editorial hooks (they stay as-is on POI records).

## Gotchas & Lessons

### 1. SHA-256 Dedup is Text-Sensitive

The hash normalizes whitespace and case but preserves punctuation. A fact with "1,400 m²" vs "1400 m²" would NOT be deduped. Keep fact text consistent.

### 2. Topic Overlap is Expected, Not a Bug

54 of 54 editorial facts overlap in topic with research facts. This is by design — editorial is concise, research is detailed. The UI dedup filter handles visibility.

### 3. Nature Topic is Hard for Urban POIs

Only 7 nature facts across 20 POIs. Most urban restaurants/bars have no relevant nature connection. Don't force it — skip topics that don't apply.

### 4. Source Tier Matters

Tier 1 (snl.no, Wikipedia, kulturminnesok) facts are almost always correct. Tier 3 (blogs, TripAdvisor) facts need cross-verification. The akevitt count at Baklandet Skydsstation varies from 191 to 350+ depending on source.

## Prevention

- Always run `--dry-run` before real backfill
- Verify idempotency with a second run
- Check for corrections between editorial hooks and research facts — flag for curator
- Cap parallel agents at 4 per CLAUDE.md

## Related Files

| File | Purpose |
|------|---------|
| `scripts/list-research-targets.ts` | Generate POI manifest from Supabase |
| `scripts/backfill-knowledge.ts` | Insert facts with SHA-256 dedup |
| `data/research/*.json` | Research output (gitignored) |
| `data/research/editorial/*.json` | Editorial parsing output (gitignored) |
| `data/research/manifest.json` | POI target list |
| `components/public/PlaceKnowledgeSection.tsx` | UI with backfill dedup filter |
| `docs/plans/2026-02-15-feat-research-pipeline-backfill-plan.md` | Full plan |

## Cross-References

- [City Knowledge Base Schema & Queries](./city-knowledge-base-schema-queries-20260215.md) — Phase 1 infrastructure
- [Idempotent Backfill Patterns](./idempotent-backfill-patterns-supabase-20260215.md) — Dedup patterns
- [Research Workflow Design](./research-workflow-poi-fact-finding-20260215.md) — Search strategy per topic
