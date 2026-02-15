---
module: Knowledge Base
date: 2026-02-15
problem_type: feature_implementation
component: editorial-parsing
tags: [knowledge-base, editorial-backfill, batch-parsing, prompt-template]
---

# Editorial Parsing — Examples & Reusable Prompts

Companion document to `docs/plans/2026-02-15-editorial-parsing-batch-design.md`.

---

## Part 1: Concrete Examples

### Example 1: Restaurant Hook → Multiple Topics

**Original hook:**
```
"Grunnlagt av kokken Heidi Bjerkan i 2019, Credo holder én Michelin-stjerne
og bruker kun norske råvarer innenfor 30 mils radius."
```

**Extraction (good):**
```json
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
      "fact_text_en": "Uses only Norwegian ingredients sourced within 30 miles radius",
      "topic": "food",
      "confidence": "verified",
      "source_name": "Editorial hook"
    }
  ],
  "extraction_quality": "high",
  "extraction_notes": "Clean separation of three distinct, verifiable facts"
}
```

**Why this works:**
- 3 facts extracted, each from distinct part of hook
- Topics don't overlap (people → culture → food progression makes sense)
- All facts are verifiable (stated explicitly in hook)
- English translations are natural, not literal

---

### Example 2: Neighborhood Hook → Mix of Objective & Filtered

**Original hook:**
```
"Trondheims sjarmerende bydel med fargerike trehus, koselige kafeer
og unik atmosfære langs Nidelva."
```

**Extraction (good):**
```json
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
  "extraction_notes": "Filtered out 'sjarmerende', 'koselige kafeer' (subjective), and 'unik atmosfære' (vague). Extracted objective spatial and architectural facts."
}
```

**Why this works:**
- Subjective adjectives ("sjarmerende", "koselige") are filtered
- "Koselige kafeer" is dropped (vague descriptor, not verifiable fact)
- "Unik atmosfære" is dropped (pure subjective)
- Two solid facts remain: architecture (trehus) and spatial (Nidelva location)
- Quality flagged as "medium" because filtering was aggressive but justified

---

### Example 3: Historical Building Hook

**Original hook:**
```
"Ombygget etter Pilegrimsleddbranden i 1681 og restaurert ved flere anledninger.
Nå kulturminne av nasjonal betydning."
```

**Extraction (good):**
```json
{
  "extracted_facts": [
    {
      "fact_text": "Ombygget etter Pilegrimsleddbranden i 1681",
      "fact_text_en": "Rebuilt after the Pilgrimsleden fire in 1681",
      "topic": "history",
      "confidence": "verified",
      "source_name": "Editorial hook"
    },
    {
      "fact_text": "Restaurert ved flere anledninger gjennom historien",
      "fact_text_en": "Restored on multiple occasions throughout history",
      "topic": "history",
      "confidence": "verified",
      "source_name": "Editorial hook"
    },
    {
      "fact_text": "Klassifisert som kulturminne av nasjonal betydning",
      "fact_text_en": "Designated as a cultural monument of national significance",
      "topic": "culture",
      "confidence": "verified",
      "source_name": "Editorial hook"
    }
  ],
  "extraction_quality": "high"
}
```

**Why this works:**
- Historical facts are verifiable and timeless
- "Restaurert ved flere anledninger" is extracted as stated, not over-specified (doesn't claim which anledninger)
- "Kulturminne av nasjonal betydning" is objective (can be verified in Riksantikvaren registry)
- All facts pass the "will still be true in 5 years" test

---

### Example 4: Café Hook with Perishable Info (AVOID)

**Original hook:**
```
"Åpent mandag-lørdag 9-18, lukket søndag. Lunch special 119 kr 11-14.
Kjent for søtebakst og espresso."
```

**Extraction (bad — shows what NOT to do):**
```json
{
  "extracted_facts": [
    {
      "fact_text": "Åpent mandag-lørdag kl. 9-18",
      "topic": "practical",
      "confidence": "verified"
    },
    {
      "fact_text": "Lukket søndag",
      "topic": "practical",
      "confidence": "verified"
    },
    {
      "fact_text": "Lunch special 119 kr 11-14",
      "topic": "practical",
      "confidence": "verified"
    }
  ]
}
```

**Why this is WRONG:**
- Opening hours change (were wrong by February 2025, possibly still are)
- Price changed (119 kr is 2024 data)
- Lunch special may have been discontinued
- All will be flagged as stale/unreliable within weeks

**Correct extraction:**
```json
{
  "extracted_facts": [
    {
      "fact_text": "Kjent for håndlaget søtebakst og espresso",
      "fact_text_en": "Known for handmade pastries and espresso",
      "topic": "food",
      "confidence": "verified",
      "source_name": "Editorial hook"
    }
  ],
  "extraction_quality": "low",
  "extraction_notes": "Filtered out current hours, pricing, and promotions per freshness rules. Only retained timeless food characteristic."
}
```

---

### Example 5: Local Insight with Insider Tip

**Original local_insight:**
```
"Spør om 'tapas menyen' på spansk — det er hemmeligheten som ikke står på ordinær meny."
```

**Extraction:**
```json
{
  "extracted_facts": [
    {
      "fact_text": "Tilbyr tapas-meny som ikke fremkommer på ordinær meny",
      "fact_text_en": "Offers a tapas menu not listed on the regular menu",
      "topic": "local_knowledge",
      "confidence": "unverified",
      "source_name": "Editorial local insight"
    }
  ],
  "extraction_quality": "medium",
  "extraction_notes": "Confidence: 'unverified' because this is an insider tip, not publicly documented fact. Removed the vague instruction 'spør på spansk'."
}
```

**Why this works:**
- Insider knowledge is labeled `local_knowledge` topic (correct)
- Confidence is `unverified` (appropriate — it's insider intel, not independently verifiable)
- The actionable fact is extracted (tapas menu exists) without the vague instruction ("spør på spansk")
- Will remain true even if the instruction becomes outdated

---

### Example 6: Mixed Content — Filter Aggressively

**Original hook:**
```
"Historisk kafé fra 1923 med koselig atmosfære, deilig kaffe og populært
blant både turister og lokale. Ligger sentralt ved Torvet."
```

**Extraction:**
```json
{
  "extracted_facts": [
    {
      "fact_text": "Etablert i 1923",
      "fact_text_en": "Established in 1923",
      "topic": "history",
      "confidence": "verified",
      "source_name": "Editorial hook"
    },
    {
      "fact_text": "Ligger sentralt ved Torvet",
      "fact_text_en": "Located centrally near Torget",
      "topic": "spatial",
      "confidence": "verified",
      "source_name": "Editorial hook"
    }
  ],
  "extraction_quality": "medium",
  "extraction_notes": "Filtered out 'koselig atmosfære' (subjective), 'deilig kaffe' (vague), 'populært blant turister og lokale' (marketing claim). Retained verifiable facts: establishment year and spatial location."
}
```

**Why this works:**
- 6 claims in original hook → 2 verifiable facts extracted
- Aggressive filtering is appropriate (removes all marketing-speak)
- Remaining facts are solid: year (checkable in tax records) and location (verifiable on map)
- Quality marked as "medium" (not "high") because filtering was heavy

---

## Part 2: Reusable Prompt Templates

### Template 1: Initial Batch Parsing Prompt

```
You are an editorial fact-extraction specialist. Your job is to parse
editorial hooks and local insights from Placy POIs into structured,
verifiable knowledge facts.

## Data Input
I will provide 20 POIs, each with:
- poi_id: unique identifier
- poi_name: display name
- editorial_hook: 1-2 sentence hook text
- local_insight: optional insider tip

## Extraction Rules

### What to extract
- Establishment year ("Åpnet i 1987")
- Founder/owner names ("Grunnlagt av Heidi Bjerkan")
- Historical events ("Ombygget etter brannen i 1681")
- Awards/recognition ("Michelin-stjerne", "UNESCO-arv")
- Material/architecture ("Gotisk trearkitektur", "Stenfasade fra 1600-tallet")
- Cuisine/food type ("Italiensk kjøkken", "Norske råvarer")
- Ingredient sourcing ("Lokale ingredienser fra Sogn")
- Spatial relationships ("Ved Torvet", "Langs Nidelva")
- Seating/capacity ("200 seter", "Intim atmosfære for 30 personer")

### What to SKIP (filter out)
- Subjective adjectives: "koselig", "deilig", "sjarmerende", "vakker"
- Vague quality claims: "populært", "best", "en av de beste"
- Current pricing: "299 kr", "lunsj 159 kr"
- Current hours: "Åpent 18-22", "Mandag-fredag"
- Transient offers: "sommerkampanje", "3-gangers meny", "happy hour"
- Current management: "drevet av lokale eiere" (unless historically notable)
- Marketing fluff: "unikt", "autentisk", "genuine"

### Topic Assignment
Assign ONE topic from: history, architecture, food, culture, people,
nature, practical, local_knowledge, spatial

Use this priority order when ambiguous:
1. Is it about a named person → "people"
2. Is it about building/design → "architecture"
3. Is it about an event/time → "history"
4. Is it food-related → "food"
5. Is it art/culture → "culture"
6. Is it geography/nature → "nature"
7. Is it a secret/insider tip → "local_knowledge"
8. Is it directions/walkability → "spatial"
9. Otherwise → "practical"

### Confidence Levels
- "verified": fact is explicitly stated in the hook
- "unverified": fact is implied, inferred, or from insider knowledge
- "disputed": fact contradicts other known info (rare; flag these)

### Quality Score
- "high": 3+ clean, distinct facts extracted
- "medium": 2 facts extracted, some filtering applied
- "low": 1 fact extracted, heavy filtering required
- "skip": hook is entirely subjective/perishable, 0 facts extracted

## Output Format
Return JSON matching this schema exactly:

{
  "parsing_batch": "batch-001",
  "facts": [
    {
      "poi_id": "string",
      "poi_name": "string",
      "original_hook": "string",
      "extracted_facts": [
        {
          "fact_text": "Norwegian only, max 2 sentences",
          "fact_text_en": "English only, natural phrasing",
          "topic": "one of 9 topics",
          "confidence": "verified|unverified|disputed",
          "source_name": "Editorial hook" or "Editorial local insight"
        }
      ],
      "extraction_quality": "high|medium|low|skip",
      "extraction_notes": "why you filtered, any ambiguities noted"
    }
  ],
  "statistics": {
    "total_hooks_parsed": 20,
    "total_facts_extracted": number,
    "avg_facts_per_poi": number,
    "topics_breakdown": { "history": count, ... },
    "confidence_breakdown": { "verified": count, ... }
  }
}

## Example
INPUT:
- poi_id: "credo-trondheim"
- poi_name: "Credo"
- editorial_hook: "Grunnlagt av kokken Heidi Bjerkan i 2019, Credo holder
  én Michelin-stjerne og bruker kun norske råvarer innenfor 30 mils radius."

OUTPUT (facts array):
[
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
    "fact_text_en": "Uses only Norwegian ingredients sourced within 30 miles radius",
    "topic": "food",
    "confidence": "verified",
    "source_name": "Editorial hook"
  }
]

## Now parse these 20 POIs:

[INSERT YOUR 20 POIs HERE IN JSON FORMAT]

After extraction, I will review your work and may ask for refinements.
Then we move to the next batch.
```

---

### Template 2: Checkpoint Prompt (After Batch 3 or 6)

```
Review the patterns in the extracted facts so far. I'm doing a quality
checkpoint.

Based on batches 1-3, tell me:

1. **Topic Distribution:** Are topics evenly distributed or weighted toward food/history?
   (I'm aiming for ~25% food, 20% history, 15% culture, 10-12% each for others)

2. **Extraction Rate:** Average facts per POI so far?
   (I'm aiming for 1.2-1.5. If < 1.0, we're being too strict. If > 2.5, we're extracting subjective stuff)

3. **Filtering:** Have we been consistently filtering subjective claims?
   (Show me 1-2 examples where we correctly skipped "koselig" or "populært")

4. **Confidence:** What % are "verified" vs "unverified"?
   (I'm targeting 90%+ verified, < 10% unverified)

5. **Issues spotted:** Any patterns of mistakes?
   - Are certain topics consistently over/under-assigned?
   - Are we accidentally including perishable info (hours, prices)?
   - Are English translations consistent in tone?

Based on your analysis, should we:
A) Continue as-is (rules are working)
B) Tighten extraction (< 1.0 facts/POI, too conservative)
C) Loosen extraction (> 2.5 facts/POI, too permissive)
D) Adjust specific topic assignments

Tell me which, and if we need tweaks, show me how the next batch should change.
```

---

### Template 3: Refinement Prompt (If Quality Issues Arise)

```
Looking at [Batch N], I notice [issue]. Examples:

[PASTE 2-3 problematic extractions from the batch]

The problem is: [describe what went wrong]

Please re-extract those [X] POIs with these adjustments:
- [specific instruction, e.g., "Skip any mention of pricing"]
- [specific instruction, e.g., "For architecture topics, prefer 'material + era' over vague style names"]

Also tell me: should we update the extraction rules for the remaining batches?
```

---

### Template 4: Final Merge & Validation Prompt

```
I've saved all 10 batches as separate JSON files. I need to:

1. Merge them into one master JSON file (all facts in a single "facts" array)
2. Count total facts extracted and facts per POI
3. Check for any obvious errors:
   - Duplicate facts (same poi_id + fact_text)?
   - Empty fact_text?
   - Topic not in [history, architecture, food, culture, people, nature, practical, local_knowledge, spatial]?
   - Confidence not in [verified, unverified, disputed]?

Here are the 10 batch files:
[PASTE CONTENTS OF batch-001.json, batch-002.json, ..., batch-010.json]

Please:
1. Merge into one file
2. Run these validations
3. Tell me:
   - Total facts extracted: [count]
   - Average facts per POI: [math]
   - Topics used: [list with counts]
   - Confidence levels: [counts]
   - Any validation errors found? [list any issues]
4. Output the merged JSON (I'll save to /tmp/all-facts-merged.json)
```

---

## Part 3: Troubleshooting Reference

### When Claude extracts too few facts (< 1.0/POI)

**Symptom:** Batch 1 returns only 30 facts from 20 POIs.

**Cause:** Extraction rules are too strict. "Koselig kafé" was correct to filter, but Claude is also filtering facts that ARE verifiable.

**Fix prompt:**
```
I notice we're getting ~1.5 facts per POI. I want to aim for 2-3 facts per POI
to better capture the editorial content.

Can you be more inclusive? Examples I want to see extracted:
- "Serves traditional Nordic cuisine" (food topic) ✓
- "Open since 1987" (history topic) ✓
- "Family-run restaurant" (people topic, if family is named) ✓
- "Located near the market square" (spatial topic) ✓

But still filter out:
- "Cozy atmosphere" ✗
- "Popular with tourists" ✗
- "299 kr lunch" ✗

Does this guidance help? Let's re-parse Batch 2 with this in mind.
```

---

### When Claude extracts too many facts (> 2.5/POI)

**Symptom:** Batch 2 returns 65 facts from 20 POIs (3.25 each).

**Cause:** Claude is extracting near-synonyms or minor variations as separate facts.

**Fix prompt:**
```
I see we're getting 3+ facts per POI now. That's too many — we're capturing
near-duplicates. Examples:

POI: "Italiensk restaurant med klassisk carbonara og originale italienske
oppskrifter"

You extracted:
- "Italiensk restaurant"
- "Tilbyr klassisk carbonara"
- "Bruker originale italienske oppskrifter"

But these are all ~same fact (Italian cuisine). One fact should suffice:
- "Italian restaurant known for classical pasta dishes"

Please consolidate similar/overlapping facts into one. Aim for 1.5-2.0 per POI,
not 3-4.
```

---

### When topic distribution is skewed

**Symptom:** After 3 batches, you have 40% food, 5% history, 30% practical.

**Cause:** Either data skew (many restaurants), or Claude is over-assigning food topics.

**Fix prompt:**
```
Our topic distribution so far:
- food: 40%
- history: 5%
- culture: 10%
- practical: 30%
- others: 15%

This is skewed toward food. I expected ~25% food, ~20% history.

Looking at the extracted facts, I think we're assigning some historical facts
to "practical" instead. Examples:

POI: "Ombygget i 1890"
You assigned: practical (wrong)
Should be: history ✓

Can you recalibrate? For batches 4-10, use the decision tree more carefully:
- If it has a year/temporal marker → history (first priority)
- If it's about building/style → architecture
- If it's about food/recipe → food
- Only assign practical if it's accessibility/seating/service

Let's re-check Batch 3 with this in mind.
```

---

## Summary: Quick Lookup

| Situation | Template | Adjustment |
|-----------|----------|-----------|
| Starting first batch | Template 1 | Copy-paste, fill in your 20 POIs |
| After batch 3 | Template 2 | Checkpoint: spot-check distribution |
| Quality issues mid-batch | Template 3 | Refinement request for specific POIs |
| Merging all 10 batches | Template 4 | Final validation before DB insert |
| Too few facts | Troubleshooting 1 | Loosen rules, show good examples |
| Too many facts | Troubleshooting 2 | Tighten rules, consolidate |
| Topic skew | Troubleshooting 3 | Recalibrate with decision tree |

---

## Test Data (For Practice)

If you want to test extraction before starting with real data, here are 5 sample hooks:

```json
[
  {
    "poi_id": "test-1",
    "poi_name": "Test Restaurant",
    "editorial_hook": "Åpnet i 1995, kjent for hjemmelaget pasta og lokale råvarer fra Trøndelag."
  },
  {
    "poi_id": "test-2",
    "poi_name": "Test Museum",
    "editorial_hook": "Dokumenterer Trondheims maritime historie fra Viking-tiden til i dag. Ikonisk bilde: 'Nidarosdomen fra sjøen' av Axel Ender."
  },
  {
    "poi_id": "test-3",
    "poi_name": "Test Café",
    "editorial_hook": "Koselig kafé med hyggelig atmosfære, perfekt for å jobbe eller møtes med venner."
  },
  {
    "poi_id": "test-4",
    "poi_name": "Test Historic Building",
    "editorial_hook": "Bygget i 1783 som prestegård, senere omgjort til pensjonat. Klassisistisk stil bevart intakt."
  },
  {
    "poi_id": "test-5",
    "poi_name": "Test Neighborhood",
    "editorial_hook": "Bakklandet er Trondheims mest sjarmerende bydel, med fargede trehus fra 1800-tallet og lummert nabolagskjensle."
  }
]
```

Expected high-quality extraction:
- test-1: ~2 facts (history, food)
- test-2: ~2 facts (history, culture)
- test-3: ~0 facts (all subjective, skip)
- test-4: ~2 facts (history, architecture)
- test-5: ~1 fact (architecture), skip "sjarmerende" and "lummert nabolagskjensle"

**Total: ~7 facts from 5 POIs = 1.4 facts/POI** ✓

