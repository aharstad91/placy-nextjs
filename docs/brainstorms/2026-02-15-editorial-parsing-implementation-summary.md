---
title: Editorial Parsing Implementation — Decision Summary
date: 2026-02-15
type: decision-summary
scope: knowledge-base-backfill-workflow
---

# Editorial Parsing Implementation — Decisions & Recommendations

**Objective:** Convert 200 POI editorial hooks/insights into structured knowledge facts for `place_knowledge` table.

**Approach:** Inline parsing in Claude Code (no external APIs), then bulk-insert into Supabase.

---

## Decisions Made

| # | Decision | Rationale | Alternative Rejected |
|---|----------|-----------|---------------------|
| 1 | **Batch size: 20 POIs** | 200÷20=10 turns. Maintains context quality. Reviewable. | 50 (too much drift), 10 (inefficient) |
| 2 | **Output: JSON with traceability** | Matches DB schema. Shows original hook → extracted facts. Easy audit trail. | CSV (loses context), plain text (hard to parse) |
| 3 | **Quality rule: SKIP subjective + perishable** | "Koselig" and "kl. 18-22" don't age. Maintains data credibility. | Include all (degrades over time) |
| 4 | **Topics: 9 categories** | Matches KNOWLEDGE_TOPICS in types.ts. Agent-specializable. | All in one topic (loses dimension), 20+ topics (too fragmented) |
| 5 | **Confidence: verified/unverified/disputed** | Separates stated facts from inferred. Curator workflow. | Binary verified/unverified (no room for ambiguity) |
| 6 | **Session timeline: 2.5 hours for 200 POIs** | 10 batches × 15 min per batch = achievable in one focused session | Multiple sessions (loses momentum), 4+ hours (fatigue sets in) |
| 7 | **Checkpoints after batches 3 & 6** | Early warning system for extraction drift. Prevents compounding errors. | No checkpoints (risks 50% of work being wrong), checkpoints every batch (too granular) |
| 8 | **Post-parse: Surface in POI detail pages** | Immediate product value. SEO gains. Validates data quality before scaling. | Wait for AI layer (months away), admin-only view (no visibility) |

---

## Recommendations at a Glance

### 1. Batch Size
**→ 20 POIs per turn. Total: 10 turns.**

- Sufficient context for Claude to maintain consistency
- Produces ~45 facts per batch (expect 1.2–1.5 facts/POI average)
- Reviewable: 45 facts takes ~5 min to scan
- Recovery: If one batch fails, only ~20 POIs need re-parsing

### 2. Output Format
**→ JSON with 5 key fields per extracted fact:**
```json
{
  "fact_text": "Norwegian, max 2 sentences",
  "fact_text_en": "English translation",
  "topic": "one of 9",
  "confidence": "verified|unverified|disputed",
  "source_name": "Editorial hook"
}
```

Plus metadata: `poi_id`, `original_hook`, `extraction_quality`, `extraction_notes`.

This schema aligns with `place_knowledge` columns and enables:
- SQL INSERT directly from JSON
- Audit trail (what was in the hook, what was extracted)
- Quality metrics (topic distribution, confidence breakdown)

### 3. Quality Filters
**→ Conservative: Only extract verifiable, timeless facts.**

| EXTRACT | SKIP |
|---------|------|
| Establishment year | Current pricing |
| Founder name | Current hours |
| Historical event | Transient offers |
| Awards (Michelin, etc.) | Subjective ("koselig") |
| Material/style (era + type) | Marketing claims ("best") |
| Cuisine type | Vague roles ("run by locals") |
| Ingredient sourcing (regional) | |

**Impact:** ~10–20% of hook text is filtered. That's correct — editorial hooks mix fact and marketing.

### 4. Topic Classification
**→ Use decision tree + priority matrix.**

Priority order (when ambiguous):
1. Named person? → people
2. Building/design? → architecture
3. Temporal/event? → history
4. Food/ingredient? → food
5. Art/culture? → culture
6. Geography/nature? → nature
7. Insider tip? → local_knowledge
8. Directions/distance? → spatial
9. Other → practical

**Consistency check:** After batches 3 & 6, verify distribution:
- Expected: food ~25%, history ~20%, culture ~12%, others ~5–10%
- Skew indicator: Any topic > 40% or < 2%

### 5. Workflow
**→ Single focused session, 2.5 hours for 200 POIs.**

| Time | Task |
|------|------|
| 0:00–0:05 | Setup: review rules, confirm schema |
| 0:05–0:20 | Batch 1: Parse, review, save JSON |
| 0:20–0:32 | Batches 2–3: Parse, review, save |
| 0:32–0:37 | **Checkpoint 1:** Spot-check 3 batches |
| 0:37–1:25 | Batches 4–6: Parse, review, save |
| 1:25–1:30 | **Checkpoint 2:** Verify consistency |
| 1:30–2:18 | Batches 7–10: Parse, review, save |
| 2:18–2:33 | Post-processing: merge JSONs, validate counts |

**Total: ~2.5 hours. Breakable into 2 sessions if needed (each 5 batches = 1.5 hours).**

### 6. Post-Parse Integration
**→ Activate immediately in 3 places:**

1. **POI detail pages** (`/[area]/steder/[slug]`)
   - New "Knowledge" section showing facts grouped by topic
   - SEO boost: Each fact = 1 sentence in a unique POI page

2. **MapPopupCard "Insight" tab**
   - Show 1–2 top facts (prefer `local_knowledge` or `history`)
   - "Learn more" → POI detail page

3. **Admin dashboard**
   - Table of all extracted facts
   - Curator toggles `display_ready = true` for verified facts
   - Stats: topic distribution, confidence levels

**Why this order:**
- Proves data quality immediately (users see it)
- Drives SEO (200 steder × 2 languages = 400 landing pages)
- Validates research direction before AI layer

---

## Key Numbers

| Metric | Target | Reasoning |
|--------|--------|-----------|
| **Batch size** | 20 POIs | 10 batches total, 2.5 hour session |
| **Facts/POI** | 1.2–1.5 | Balances richness vs filtering |
| **Total facts** | 240–300 | 200 POIs × 1.5 facts avg |
| **Verified facts** | >90% | Remaining ~10% are unverified/disputed |
| **Extraction rate** | 60–80 min/batch | Includes review time |
| **Topic distribution** | Food 25%, History 20%, Culture 12%, Others 5–10% | Expected from restaurant/café-heavy data |
| **Subjective filter rate** | 10–20% | Hooks contain marketing copy; filtered normally |

---

## Gotchas & Mitigations

| Gotcha | Risk | Mitigation |
|--------|------|-----------|
| **Context decay after batch 6** | Inconsistent rules applied | Include full rules in every prompt. Reset at checkpoint 2. |
| **Over-extraction** | Too many near-duplicate facts | Show extraction rate after batch 1. If > 2.5 facts/POI, tighten rules. |
| **Under-extraction** | Miss good facts due to strict filtering | Show examples of "verifiable but not obvious" facts. Aim for 1.2+ facts/POI. |
| **Topic drift** | Food = 50%, history = 5% | Check distribution after every 3 batches. Use decision tree explicitly. |
| **Translation quality** | Awkward English ("uses only Norwegian ingredients within 30 miles radius") | Request "natural English, as if written by native speaker". Show good examples. |
| **Confidence overconfidence** | Mark inferred facts as "verified" | Define strictly: "verified" = stated in hook. Inferred = "unverified". Show examples. |
| **Batch loss** | One batch corrupted, lose 1 hour of work | Save each batch JSON as it finishes. Don't wait till end to save. |

---

## Implementation Checklist

### Pre-session (5 min)
- [ ] Export 200 POIs from Supabase (id, name, editorial_hook, local_insight)
- [ ] Confirm `place_knowledge` table exists in Supabase
- [ ] Review decision tree and filtering rules (30 sec)
- [ ] Skim example extractions in `editorial-parsing-examples-prompts-20260215.md`

### During session (2.5 hours)
- [ ] Batch 1: Use Template 1 prompt, parse POIs 1–20
- [ ] Review batch 1 output (5 min)
- [ ] Batches 2–3: Parse POIs 21–60
- [ ] **Checkpoint 1 (00:32):** Verify topic distribution, extraction rate, filtering consistency
- [ ] Batches 4–6: Parse POIs 61–120
- [ ] **Checkpoint 2 (01:30):** Final consistency check
- [ ] Batches 7–10: Parse POIs 121–200
- [ ] Post-processing: Merge 10 JSONs, validate schema

### Post-session (30 min)
- [ ] Run validation script: total facts, topic breakdown, confidence %
- [ ] Document batches in `docs/solutions/feature-implementations/parsing-editorial-hooks-backfill.md`
- [ ] Prepare JSON for Supabase bulk-insert

### Integration (1–2 hours, separate session)
- [ ] Create migration: INSERT from JSON → `place_knowledge`
- [ ] Update POI detail page component to display knowledge facts
- [ ] Update MapPopupCard with "Insight" tab
- [ ] Update admin dashboard with knowledge table
- [ ] Test: Visit 5 random POI detail pages, verify facts display correctly
- [ ] Deploy and monitor engagement

---

## Success Criteria

### Data Quality
- ✓ > 90% of facts are "verified"
- ✓ No facts about current pricing or hours
- ✓ No purely subjective descriptors ("koselig", "vakker")
- ✓ All 9 topics represented (even if rare)
- ✓ Topic distribution within expected ranges

### Process
- ✓ All 200 POIs parsed in one 2.5–3 hour session
- ✓ Zero data loss (all batches saved)
- ✓ Spot-checks at batches 3 & 6 show consistency
- ✓ JSON validates (no schema errors)

### Impact
- ✓ POI detail pages look visibly richer (3–5 facts per page)
- ✓ "Insight" tab in MapPopupCard shows local knowledge
- ✓ Admin can see all facts, toggle `display_ready`
- ✓ SEO: 200 unique detail pages indexed

---

## What's NOT Included (Phase 2+)

- Automatic research (no agent swarms in this backfill — only parsing existing editorial data)
- Vector embeddings (pgvector comes later)
- AI chat interface (future product)
- Multi-city scaling (Trondheim only for now)
- Automated refresh (quarterly manual updates, future automation)

This backfill is **just the parsing**: editorial_hook → structured facts. The research pipeline comes next.

---

## Documents

This recommendation is documented across three files:

1. **`docs/plans/2026-02-15-editorial-parsing-batch-design.md`** (THIS FILE REFERENCE)
   - Detailed process design
   - Batch sizing rationale
   - QA checklist
   - Gotchas & mitigations
   - Full workflow timeline

2. **`docs/solutions/feature-implementations/editorial-parsing-examples-prompts-20260215.md`**
   - 6 concrete examples (good & bad extractions)
   - 4 reusable prompt templates
   - Troubleshooting reference
   - Test data for practice

3. **`docs/brainstorms/2026-02-15-city-knowledge-base-brainstorm.md`** (EXISTING)
   - Strategic context (knowledge base as IP)
   - Why this matters
   - Future vision (AI layer, stedsider)

**Next step:** Run `/plan` with scope "Implement editorial parsing backfill, batches 1–10, single session."

