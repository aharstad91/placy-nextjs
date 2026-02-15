---
module: Knowledge Base
date: 2026-02-15
problem_type: executive_summary
tags: [knowledge-base, editorial-backfill, process-design, batch-parsing]
---

# Editorial Parsing Process — Executive Summary

## TL;DR

Parse 200 POI editorial hooks into structured knowledge facts using **20-POI batches in one 2.5-hour Claude Code session**. Output: ~240–300 facts (1.2–1.5 per POI), formatted as JSON, ready for Supabase `place_knowledge` table insertion.

---

## What & Why

**Problem:** 200 POIs have rich editorial text (hooks + local insights) but no structured, queryable knowledge base. Marketing copy and facts are mixed. Temporal claims can't be filtered.

**Solution:** Parse hooks into discrete, verifiable facts with topic + confidence, enabling:
- POI detail pages with "What Placy knows about this place"
- MapPopupCard insight snippets
- SEO landing pages (200 steder × 2 languages = 400 pages)
- Foundation for Phase 2 (multi-agent research, AI layer)

---

## Numbers at a Glance

| Metric | Value |
|--------|-------|
| **POIs to parse** | 200 |
| **Batch size** | 20 POIs (10 batches total) |
| **Facts per POI** | 1.2–1.5 (target) |
| **Total facts expected** | 240–300 |
| **Session duration** | 2.5 hours |
| **Checkpoints** | After batches 3 & 6 |
| **Output format** | JSON (matches DB schema) |
| **Topics (categories)** | 9: history, architecture, food, culture, people, nature, practical, local_knowledge, spatial |
| **Confidence levels** | verified (90%+), unverified (~10%), disputed (<1%) |

---

## Process (4 Phases)

### Phase 1: Setup (5 min)
- Export 200 POIs from Supabase
- Confirm `place_knowledge` table exists
- Review filtering rules + topic decision tree

### Phase 2: Batches 1–3 (45 min)
- Parse POIs 1–20 → Batch 1 (15 min)
- Parse POIs 21–40 → Batch 2 (12 min)
- Parse POIs 41–60 → Batch 3 (12 min)
- **Checkpoint 1:** Verify topic distribution, extraction rate, filtering consistency (5 min)

### Phase 3: Batches 4–10 (1.5 hours)
- Batches 4–6 (45 min) + Checkpoint 2 (5 min)
- Batches 7–10 (40 min)
- Post-processing: Merge JSONs, validate schema (15 min)

### Phase 4: Integration (1–2 hours, separate session)
- Bulk-insert facts into `place_knowledge`
- Surface in POI detail pages + MapPopupCard
- Test & monitor

---

## Key Rules (Quality Filters)

**EXTRACT:**
- Establishment year: "Åpnet i 1987" ✓
- Named people: "Grunnlagt av Heidi Bjerkan" ✓
- Historical events: "Ombygget etter brannen i 1681" ✓
- Awards: "Michelin-stjerne" ✓
- Material/style: "Gotisk trearkitektur" ✓
- Cuisine/ingredients: "Norske råvarer" ✓

**SKIP:**
- Subjective: "koselig", "vakker", "sjarmerende" ✗
- Vague: "populært", "best", "authentic" ✗
- Perishable: "kl. 18-22", "199 kr", "sommerkampanje" ✗

**Why:** Subjective and perishable claims degrade data quality. Conservative filtering = sustainable knowledge base.

---

## Topic Assignment

Use this priority order when assigning one topic per fact:

1. Named person? → **people**
2. Building/structure? → **architecture**
3. Temporal/event? → **history**
4. Food/cuisine? → **food**
5. Art/culture? → **culture**
6. Geography/nature? → **nature**
7. Insider secret? → **local_knowledge**
8. Directions/distance? → **spatial**
9. Other → **practical**

---

## Quality Checkpoints

| When | What | Action |
|------|------|--------|
| After batch 1 | Extraction quality | Does 1.2–1.5 facts/POI feel right? Adjust rules if needed. |
| After batch 3 | **Checkpoint 1** | Topic distribution. Are we getting ~25% food, ~20% history? Consistency. |
| After batch 6 | **Checkpoint 2** | Final consistency check. Any topic > 40% or < 2%? Refine if needed. |
| After batch 10 | Data quality | > 90% verified? No perishable info? All 9 topics represented? |

---

## Gotchas (Solved)

| Issue | Symptom | Fix |
|-------|---------|-----|
| **Under-extraction** | < 1.0 facts/POI | Show examples of "verifiable but not obvious" facts. Loosen slightly. |
| **Over-extraction** | > 2.5 facts/POI | Consolidate near-duplicates. Tighten filtering. |
| **Topic drift** | One topic > 40% | Use decision tree explicitly. Check after every 3 batches. |
| **Context decay** | Batch 8 rules different from batch 2 | Include full rules in every prompt. Reset rules at checkpoint 2. |
| **Translation quality** | Awkward English | Request "natural English, as if written by native speaker". Show examples. |

---

## Output Format

Each extracted fact has:
```json
{
  "fact_text": "Norwegian, max 2 sentences",
  "fact_text_en": "English translation",
  "topic": "one of 9",
  "confidence": "verified|unverified|disputed",
  "source_name": "Editorial hook"
}
```

Plus batch metadata:
- `poi_id`, `poi_name`, `original_hook`
- `extraction_quality`: high | medium | low | skip
- `extraction_notes`: why filtered, ambiguities noted
- Statistics: topics breakdown, confidence breakdown

---

## Success Criteria

✓ **Data Quality**
- > 90% verified facts
- Zero facts about current pricing or hours
- All 9 topics represented
- Topic distribution within expected ranges

✓ **Process**
- All 200 POIs parsed in 2.5–3 hours
- Zero data loss (all batches saved)
- Spot-checks at batches 3 & 6 show consistency
- JSON schema validates

✓ **Product Impact**
- POI detail pages show 3–5 facts per page
- MapPopupCard "Insight" tab populates
- Admin dashboard shows all facts
- SEO: 200+ unique detail pages indexed

---

## Documents

Three companion documents provide implementation details:

1. **`docs/plans/2026-02-15-editorial-parsing-batch-design.md`**
   - Full process design (batching, quality filters, workflow timeline)
   - QA checklist, gotchas & mitigations
   - Post-parse integration

2. **`docs/solutions/feature-implementations/editorial-parsing-examples-prompts-20260215.md`**
   - 6 worked examples (good & bad extractions)
   - 4 reusable prompt templates
   - Troubleshooting reference

3. **`docs/brainstorms/2026-02-15-city-knowledge-base-brainstorm.md`** (existing)
   - Strategic context (knowledge base as IP)
   - Future vision (AI layer, POI detail pages)

---

## Timeline

| Phase | Duration | Content |
|-------|----------|---------|
| **Setup** | 5 min | Export data, review rules |
| **Batches 1–3 + Checkpoint 1** | 50 min | 60 POIs, 90 facts, quality check |
| **Batches 4–10 + Checkpoint 2** | 1 hr 45 min | 140 POIs, 210 facts, final validation |
| **Post-processing** | 15 min | Merge JSONs, generate statistics |
| **TOTAL SESSION** | **2.5 hours** | All 200 POIs, all facts extracted |

(Integration in separate session: +1–2 hours)

---

## Next Step

Ready to start? Follow this order:

1. **Read:** `docs/solutions/feature-implementations/editorial-parsing-examples-prompts-20260215.md` (examples + prompt templates)
2. **Schedule:** 3 hours uninterrupted for parsing session
3. **Execute:** Use Batch 1 prompt, parse POIs 1–20, save JSON
4. **Review:** Verify extraction quality, decide on rules adjustments
5. **Continue:** Batches 2–10 with checkpoints at 3 & 6
6. **Post-parse:** Merge JSONs, validate
7. **Integrate:** Insert into Supabase, surface in products

---

## Appendix: Quick Reference

### Confidence Definition
- **verified**: Fact is explicitly stated in the hook
- **unverified**: Fact is implied, inferred, or from insider knowledge
- **disputed**: Fact contradicts other known info (rare; flag these)

### Topic Decision Tree
```
Is it about a named person? → people
Is it about building/style? → architecture
Is it about history/time? → history
Is it food-related? → food
Is it art/culture? → culture
Is it geography/nature? → nature
Is it a secret/insider tip? → local_knowledge
Is it location/distance? → spatial
Else → practical
```

### Filtering Rule
**Keep** facts that will be true in 6 months. **Skip** facts that can change within weeks (hours, pricing, campaigns).

### Quality Threshold
- **High:** 3+ distinct facts extracted per POI
- **Medium:** 2 facts, with filtering applied
- **Low:** 1 fact, heavy filtering
- **Skip:** Hook is entirely subjective/perishable

---

## Questions?

Refer to supporting documents:
- **"How do I extract that specific hook?"** → Examples doc, section Part 1
- **"What's the exact prompt to use?"** → Examples doc, section Part 2
- **"What if topic distribution skews?"** → Batch Design doc, section 7 or Examples doc troubleshooting
- **"How long does each batch take?"** → Batch Design doc, section 6
- **"What if I run out of time?"** → Batch Design doc allows two 1.5-hour sessions instead of one 2.5-hour session

