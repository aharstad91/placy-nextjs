---
title: Editorial Parsing Batch Design — Structure Hooks into Knowledge Facts
date: 2026-02-15
type: process-design
scope: knowledge-base-backfill
---

# Editorial Parsing Batch Design

> Operationalizing the backfill of 200+ POI editorial hooks and local insights into structured knowledge facts for the `place_knowledge` table. This document provides practical, executable recommendations for batch parsing within Claude Code without external APIs.

---

## Problem Summary

- **Raw data:** ~200 POIs in Supabase with `editorial_hook` (1-2 sentences, 80-150 chars) and `local_insight` (1-2 sentences, 80-120 chars)
- **Target:** Parse each into structured facts with `topic` (1 of 9), `fact_text` (Norwegian), `fact_text_en` (English optional), `confidence`, `source_name`
- **Constraint:** Parsing happens inline in Claude Code with NO external API calls — just human copy-paste data and Claude analysis
- **Goal:** Create a practical, repeatable process that maintains quality while respecting human cognitive load

---

## 1. Optimal Batch Size: **15–25 POIs per turn**

### Recommendation
Process in batches of **20 POIs** (±5).

### Rationale

| Batch Size | Issues | Notes |
|-----------|--------|-------|
| **5 POIs** | Inefficient — takes 40+ turns for 200 | Over-fragmented |
| **10 POIs** | Safe but under-utilizes context window | Conservative |
| **20 POIs (RECOMMENDED)** | Sweet spot: ~3-4K tokens input, clear outputs | Balances throughput and accuracy |
| **50 POIs** | Context saturation risk, harder to review | Quality degrades noticeably |
| **100+ POIs** | Parsing errors, hallucination, inconsistency | Don't attempt |

### Why 20 works

1. **Context efficiency:** 200 POIs ÷ 20 = 10 turns (achievable in one session)
2. **Quality:** At 20, Claude maintains consistent topic assignments and factual extraction
3. **Editability:** 20 facts is reviewable before inserting into DB; 50+ requires automated QA
4. **Recovery:** If one batch has issues, only ~5 facts need re-parsing, not 50

### Verification strategy
After first 3 batches (60 POIs), pause and spot-check:
- Do topic assignments feel consistent?
- Are confidence levels reasonable?
- Are subjective descriptions actually filtered out?
- If yes: continue in batches of 20. If no: reduce to 15 and refine extraction rules.

---

## 2. Output Format: JSON Matching Backfill Script

### Canonical format (copy into Claude Code script)

```json
{
  "parsing_batch": "trondheim-batch-001",
  "parsed_at": "2026-02-15T14:30:00Z",
  "source_pois": 20,
  "facts": [
    {
      "poi_id": "credo-trondheim",
      "poi_name": "Credo",
      "original_hook": "Grunnlagt av kokken Heidi Bjerkan i 2019, Credo holder én Michelin-stjerne og bruker kun norske råvarer innenfor 30 mils radius.",
      "extracted_facts": [
        {
          "fact_text": "Grunnlagt av kokken Heidi Bjerkan i 2019",
          "fact_text_en": "Founded by chef Heidi Bjerkan in 2019",
          "topic": "people",
          "confidence": "verified",
          "source_name": "Editorial hook"
        },
        {
          "fact_text": "Holder én Michelin-stjerne",
          "fact_text_en": "Holds one Michelin star",
          "topic": "culture",
          "confidence": "verified",
          "source_name": "Editorial hook"
        },
        {
          "fact_text": "Bruker kun norske råvarer innenfor 30 mils radius",
          "fact_text_en": "Uses only Norwegian ingredients within 30 miles radius",
          "topic": "food",
          "confidence": "verified",
          "source_name": "Editorial hook"
        }
      ],
      "extraction_quality": "high",
      "extraction_notes": "Three distinct, verifiable facts cleanly separated"
    },
    {
      "poi_id": "bakklandet-area",
      "poi_name": "Bakklandet",
      "original_hook": "Trondheims sjarmerende bydel med fargerike trehus, koselige kafeer og unik atmosfære langs Nidelva.",
      "extracted_facts": [
        {
          "fact_text": "Trehus med karakteristisk fargekledning",
          "fact_text_en": "Wooden buildings with characteristic painted facades",
          "topic": "architecture",
          "confidence": "verified",
          "source_name": "Editorial hook"
        },
        {
          "fact_text": "Beliggenhet langs Nidelva",
          "fact_text_en": "Located along the Nidelva river",
          "topic": "spatial",
          "confidence": "verified",
          "source_name": "Editorial hook"
        }
      ],
      "extraction_quality": "medium",
      "extraction_notes": "Filtered out 'koselige kafeer' and 'unik atmosfære' as subjective. Extracted objective spatial and architectural facts only."
    }
  ],
  "statistics": {
    "total_hooks_parsed": 20,
    "total_facts_extracted": 47,
    "avg_facts_per_poi": 2.35,
    "topics_breakdown": {
      "history": 8,
      "architecture": 6,
      "food": 12,
      "culture": 5,
      "people": 7,
      "nature": 2,
      "practical": 5,
      "local_knowledge": 2,
      "spatial": 0
    },
    "confidence_breakdown": {
      "verified": 45,
      "unverified": 2,
      "disputed": 0
    }
  },
  "quality_flags": [
    "3 facts have low confidence (uncertain about verifiability)",
    "2 facts about current pricing removed per freshness rules",
    "All temporal claims verified via search"
  ]
}
```

### Why this format

1. **Batch-as-unit:** Groups 20 facts under one batch ID — track which turn they came from
2. **Traceability:** `original_hook` stays in output so you can spot-check Claude's extraction
3. **Statistics:** Auto-computed breakdown shows if topic distribution looks reasonable
4. **Quality flags:** Human reviewer (you) can quickly scan for issues before DB insert
5. **JSON-to-SQL:** Easy to convert to INSERT statements or Supabase bulk-write

---

## 3. Quality Filters: Strict Verifiability Rules

### What constitutes a "verifiable fact"

**PASS — Extract these:**
- Establishment year: "Åpnet i 1987" ✓
- Founder/owner name: "Grunnlagt av Heidi Bjerkan" ✓
- Historical event: "Ombygget etter brannen i 1681" ✓
- Award/recognition: "Holder én Michelin-stjerne" ✓
- Material/architecture: "Bygget i trearkitektur fra 1800-tallet" ✓
- Cuisine type: "Italiensk kjøkken" ✓
- Ingredient sourcing: "Lokale råvarer fra Sogn" ✓ (as long as not perishable)
- Spatial relationship: "Ligger ved Torvet" ✓
- Seating/capacity: "200 seter" ✓

**SKIP — Filter these out:**
- Subjective atmosphere: "Koselig atmosfære" ✗
- Vague quality claims: "Populært sted" ✗
- Relative descriptions: "En av Trondheims beste" ✗
- Current pricing: "299 kr for pizza" ✗ (changes too fast)
- Current opening hours: "Åpent 18-22" ✗ (outdated within weeks)
- Transient offerings: "Sommerkampanje" ✗
- Current staff/management: "Drevet av lokale eiere" ✗ (if not notable historically)
- Unverifiable claims: "Hemmeligheten er [spesiell ingrediens]" ✗

### Quality scores for batch output

```
extraction_quality: "high" | "medium" | "low" | "skip"

"high"   → 3+ clean, distinct facts extracted
"medium" → 2 facts extracted, some filtering applied
"low"    → 1 fact extracted, heavy filtering required
"skip"   → Editorial hook is entirely subjective/perishable, 0 facts
```

Track in your batch output: If > 20% of POIs score "skip" or "low", your extraction rules may be too strict.

---

## 4. Topic Classification Rules: Deterministic Assignment

### Decision tree for topic assignment

When a fact could fit multiple topics, use this priority order:

```
Fact: "Åpnet i 1987 som bokhandel"

├─ Is it about a person? No. → Skip "people"
├─ Is it about building/structure? No. → Skip "architecture"
├─ Is it about history/temporal? YES → "history"
└─ PRIMARY TOPIC: history

Fact: "Kjent for sjokoladetronfler og cappuccino"

├─ About a person? No.
├─ About food/drink? YES → "food"
└─ PRIMARY TOPIC: food

Fact: "Designet av arkitekten Linn Arnesen i 1912"

├─ About architecture/structure? Slightly.
├─ About a historical person? YES (named architect) → "people"
├─ But primarily about the building design → Check context
└─ DECISION: If the notable thing is THE PERSON, use "people". If the notable thing is THE STYLE, use "architecture"
    → In this case: PRIMARY TOPIC: architecture (the design is the news)
    → SECONDARY DATA: mention person name in fact_text
```

### Topic priority matrix

When in doubt, assign to earliest column that fits:

| Primary Signal | Topic | Example |
|---|---|---|
| Year, temporal event, founding | `history` | "Åpnet i 1987" |
| Building style, materials, structure | `architecture` | "Gotisk natursteinfasade" |
| Food, recipe, cuisine type, ingredient | `food` | "Italiensk pasta casa" |
| Art, music, theater, festival | `culture` | "Årlig jazzfestival" |
| Named person, founder, famous resident | `people` | "Grunnlagt av Heidi Bjerkan" |
| Geography, weather, fauna, flora | `nature` | "Ved bredden av Nidelva" |
| Price, hours, accessibility, parking | `practical` | "Tilgjengelig for rullestol" |
| Local secret, insider tip, surprise | `local_knowledge` | "Spør om tapas-menyen" |
| Walking distance, nearby landmark, navigation | `spatial` | "2 min fra Torvet" |

### Consistency check after batch

After parsing 20 POIs, count facts per topic:
- Expected distribution: food (25-30%), history (15-20%), culture (10-15%), others (10% each)
- If food is 50%: ✓ normal for restaurant/café-heavy data
- If history is 5%: ⚠ may indicate under-extraction of temporal facts
- If practical is 40%: ⚠ may indicate over-extraction of perishable info (pricing/hours)

Adjust extraction rules if distribution seems skewed.

---

## 5. Practical Workflow: Step-by-Step Process

### Phase 1: Data Export (One-time setup)

```bash
# In your Supabase client (web UI or CLI):
SELECT
  id,
  name,
  editorial_hook,
  local_insight,
  category_id
FROM pois
WHERE editorial_hook IS NOT NULL
ORDER BY created_at DESC
LIMIT 200;

# Export as CSV or JSON
# Save to /tmp/pois-hooks-200.json
```

Keep this file in your repo root (or `/tmp`) for reference during parsing.

### Phase 2: Batch 1 (POIs 1-20)

**In Claude Code:**

1. **Read first 20 POIs from the exported file**
   ```
   I'll parse POIs 1-20 from pois-hooks-200.json. Read the file and show me the hooks.
   ```

2. **Paste the editorial hooks for review**
   - Claude reads them
   - Identifies extraction opportunities

3. **Request structured extraction**
   ```
   Parse each hook into verifiable facts. Follow the rules:
   - Topic must be one of: history, architecture, food, culture, people, nature, practical, local_knowledge, spatial
   - Skip subjective claims ("koselig", "populært")
   - Skip perishable info (current prices, hours)
   - Translate each fact to English
   - Confidence: "verified" if fact is in the hook text; "unverified" if inferred

   Output as JSON matching this schema: [batch format shown above]
   ```

4. **Review output**
   - Read Claude's extracted facts
   - Flag any that seem subjective or unverifiable
   - Request refinements: "Remove fact 3 (too subjective), clarify fact 5 (is it architecture or spatial?)"

5. **Save batch JSON to file**
   ```
   # In your editor, save Claude's output to:
   /tmp/batch-001-pois-1-20.json
   ```

6. **Document in project**
   ```
   # Update docs/solutions/feature-implementations/parsing-editorial-hooks-backfill.md

   ## Batch 001 (POIs 1-20)
   - Extracted: 45 facts
   - Topics: food (12), people (8), history (7), architecture (6), culture (5), practical (5), nature (2)
   - Confidence: verified (43), unverified (2)
   - Quality: HIGH
   - Issues: None
   ```

### Phase 3: Batches 2-10 (POIs 21-200)

Repeat Phase 2, adjusting only if:
- Topic distribution changes drastically → revise extraction rules
- Quality score drops to "low" → take smaller batches (15 POIs instead of 20)
- Human reviewer (you) spots systematic issues → request rule clarification from Claude

### Phase 4: Post-Processing (After all batches)

```bash
# Concatenate all batch JSONs into one file
jq -s 'reduce .[] as $item ({"all_facts": [], "metadata": {}};
  .all_facts += $item.facts |
  .metadata.total_batches += 1 |
  .metadata.total_facts += ($item.facts | length)
)' /tmp/batch-*.json > /tmp/all-parsed-facts.json

# Validate: should have ~200-250 facts total (avg 1.2-1.5 facts per POI)
jq '.metadata' /tmp/all-parsed-facts.json
```

### Phase 5: Insertion into Supabase

Create a migration script (or use Supabase web UI):

```sql
-- Insert parsed facts into place_knowledge
INSERT INTO place_knowledge (poi_id, topic, fact_text, fact_text_en, confidence, source_name, sort_order, display_ready)
SELECT
  (SELECT id FROM pois WHERE id = fact->>'poi_id'),
  fact->>'topic',
  fact->>'fact_text',
  fact->>'fact_text_en',
  fact->>'confidence',
  'Editorial hook backfill',
  row_number() OVER (PARTITION BY fact->>'poi_id' ORDER BY fact->>'topic') AS sort_order,
  false  -- Start as draft; curator approves
FROM (
  SELECT jsonb_array_elements(
    jsonb_agg(
      jsonb_build_object(
        'poi_id', facts->>'poi_id',
        'topic', facts->>'topic',
        'fact_text', facts->>'fact_text',
        'fact_text_en', facts->>'fact_text_en',
        'confidence', facts->>'confidence'
      )
    )
  ) AS fact
  FROM json_to_recordset(
    pg_read_file('/tmp/all-parsed-facts.json')::json->'facts'
  ) AS facts(poi_id text, fact_text text)
);
```

Or use Supabase REST API directly from Node.js script.

---

## 6. Session Workflow Timeline

For a single Claude Code session targeting all 200 POIs:

| Phase | Time | Action |
|-------|------|--------|
| 00:00 | 5 min | Read file, understand schema, review rules |
| 00:05 | 15 min | Batch 1: Parse POIs 1-20, review output, save JSON |
| 00:20 | 12 min | Batch 2: Parse POIs 21-40, review, save |
| 00:32 | 12 min | Batch 3: Parse POIs 41-60, review, save |
| 00:44 | 5 min | Checkpoint: spot-check 3 batches, verify consistency |
| 00:49 | 12 min | Batch 4: Parse POIs 61-80 |
| 01:01 | 12 min | Batch 5: Parse POIs 81-100 |
| 01:13 | 12 min | Batch 6: Parse POIs 101-120 |
| 01:25 | 5 min | Checkpoint: review topic distribution, refine rules if needed |
| 01:30 | 12 min | Batch 7: Parse POIs 121-140 |
| 01:42 | 12 min | Batch 8: Parse POIs 141-160 |
| 01:54 | 12 min | Batch 9: Parse POIs 161-180 |
| 02:06 | 12 min | Batch 10: Parse POIs 181-200 |
| 02:18 | 5 min | Checkpoint: final quality review |
| 02:23 | 10 min | Post-processing: merge JSONs, validate counts, documentation |
| 02:33 | – | DONE. Ready for Supabase insertion |

**Total session: ~2.5 hours for 200 POIs**

If you have less time or want to go slower:
- **Quick mode (1.5 hours):** 25 POIs per batch, 8 batches
- **Leisurely (4 hours):** 10 POIs per batch, 20 batches, more review time

---

## 7. Quality Assurance Checklist

### After each batch (done immediately)
- [ ] All facts are 1-3 sentences max
- [ ] No pronouns ("it", "this") — facts stand alone
- [ ] No subjective adjectives ("nice", "cozy", "popular")
- [ ] No current pricing or hours
- [ ] English translations exist and are accurate
- [ ] Topic assignments feel correct (re-read decision tree)

### After 3 batches (checkpoint)
- [ ] Topic distribution matches expected baseline
- [ ] Extraction rules have been applied consistently
- [ ] No patterns of over-extraction or under-extraction
- [ ] Batch JSON schema is valid (can be parsed by script)

### After all 10 batches (final checkpoint)
- [ ] Total facts: 200-250 (1.2-1.5 per POI) ✓
- [ ] Confidence: >90% are "verified" ✓
- [ ] All 9 topics represented (even if rare) ✓
- [ ] No facts that directly contradict Supabase data ✓
- [ ] Source tracking is consistent ("Editorial hook backfill") ✓
- [ ] JSON concatenation produces valid schema ✓

### Red flags (stop and investigate)
- Batch suddenly produces 0-1 facts per POI (extraction rules too strict?)
- > 30% of facts are "unverified" (insufficient confidence in parsing?)
- Single topic > 50% of facts (overfitting to one category?)
- Parsing quality drops after batch 5 (fatigue/context decay?)

---

## 8. Practical Gotchas & Mitigation

### Gotcha 1: Context decay after batch 6
**Issue:** By batch 7-10, Claude may start applying rules inconsistently.

**Mitigation:**
- Include extraction rules in every prompt (not just batch 1)
- Show 2-3 example extractions from previous batches as reference
- Do a "rules reset" at batch 6 checkpoint — re-state rules explicitly

### Gotcha 2: Over-extracting vs under-extracting
**Issue:** Claude may extract 0.5 facts per POI (too strict) or 4 facts per POI (too loose).

**Mitigation:**
- First batch, examine Claude's natural extraction rate
- If < 1.0 facts/POI: explicitly ask "extract at least 1 fact per hook"
- If > 2.5 facts/POI: explicitly ask "limit to verifiable facts only, skip subjective claims"
- Anchor expectations: "Expect ~1.5-2.0 facts per POI"

### Gotcha 3: English translation quality
**Issue:** Claude's English translations may be awkward or inaccurate.

**Mitigation:**
- Request "translate as if written by a native English speaker, not literal word-for-word"
- Show 2-3 good translations from batch 1 as examples
- Flag awkward translations in review and request revision

### Gotcha 4: Confidence assignment drift
**Issue:** Claude may assign "verified" to inferred facts, or "unverified" to stated facts.

**Mitigation:**
- Define strictly: "Verified" = fact is stated in the original hook; "Unverified" = inferred or implied
- Show examples: "Fact 'Åpnet i 1987' is verified (stated in hook). Fact 'Populært blant lokale' is unverified (not stated)."

### Gotcha 5: Mixed Norwegian/English in fact_text
**Issue:** Claude may slip Norwegian into English translations or vice versa.

**Mitigation:**
- Make format explicit: `fact_text: [Norwegian only] | fact_text_en: [English only, no Norwegian]`
- Spot-check translations in each batch for language purity

---

## 9. Post-Backfill Integration

Once facts are in `place_knowledge`, activate them:

### 1. POI Detail Pages
Link from `/trondheim/steder/[slug]` to knowledge facts:
```typescript
const knowledge = await getPlaceKnowledge(poi.id);
// Group by topic, render sections
```

### 2. MapPopupCard "Insight" Tab
Show 1-2 facts per POI in popup:
```typescript
const topFact = knowledge
  .filter(k => ['local_knowledge', 'history'].includes(k.topic))
  .sort((a, b) => a.sortOrder - b.sortOrder)
  [0];
```

### 3. Admin Dashboard
Show all facts for a POI, allow curator to mark `display_ready = true`:
```typescript
// /admin/pois/[poiId]/knowledge
// Table: topic | fact_text | confidence | display_ready (toggle)
```

### 4. SEO
Each verified fact powers 1 long-tail search opportunity.
- 200 POIs × 1.5 facts avg = 300 facts
- Each fact = 1 sentence in SEO-rich POI detail page
- 300 detail pages × 2 languages = 600 indexed pages

---

## Summary: Key Recommendations

| What | Recommendation | Why |
|------|---|---|
| Batch size | 20 POIs per turn | Balance throughput (10 turns total) vs context quality |
| Output format | JSON with traceability | Schema matches DB insert, easy to review and audit |
| Quality rule | SKIP subjective + perishable info | "Koselig" and "kl. 18-22" don't age well |
| Topic assignment | Use decision tree + priority matrix | Deterministic, reduces re-work |
| Session structure | 10 batches × 2-3 min review = 2.5 hours | Achievable in one focused session |
| QA checkpoints | After batches 3 and 6 | Catch drift before it compounds |
| Gotcha mitigation | Reset rules each batch, show examples | Prevents context decay and inconsistency |
| Post-backfill | Display in POI detail pages + MapPopupCard | Proves value, supports SEO, drives product differentiation |

---

## Next Steps

1. **Export data:** `SELECT id, name, editorial_hook, local_insight FROM pois LIMIT 200`
2. **Validate schema:** Confirm `place_knowledge` table is in Supabase
3. **Schedule session:** Reserve 3 hours for 200 POIs (or 1.5 hours for 100)
4. **Set reminders:** Checkpoints at batches 3 and 6
5. **Post-parse:** Run validation script, merge JSONs, document batches
6. **Insert:** Use migration or Supabase REST API to bulk-insert
7. **Activate:** Link POI detail pages to knowledge data, mark `display_ready = true` for verified facts
8. **Monitor:** Track engagement on detail pages; feedback informs Phase 2 research (new facts beyond editorial hooks)

