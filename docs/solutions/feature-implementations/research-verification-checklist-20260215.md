# Research Verification Checklist

**Used by:** Placy curators during Batch 1–4 fact-checking phase
**Purpose:** Standardized review of AI-generated facts before marking `display_ready=true`

---

## Pre-Review: Batch Preparation

Before diving into facts, curator prepares:

- [ ] All `.json` files exported from `data/research/`
- [ ] Spreadsheet template ready (20 POIs × 9 topics = 180 rows)
- [ ] Browser tabs open: SNL, Wikipedia NO, Visit Trondheim, Google
- [ ] Slack/notes app for logging issues
- [ ] Time blocked: ~3 hours for first batch (5 POIs)

---

## Per-Fact Verification Checklist

For each fact in each `.json` file, work through this checklist:

### 1. Source Verification

- [ ] **Source URL is valid** — Click link, page loads without 404
- [ ] **Source is from Tier 1 or Tier 2** — Not Reddit, Twitter, or random blog
- [ ] **URL matches source_name** — (e.g., snl.no in URL, source_name="SNL")
- [ ] **Page actually discusses the POI** — Not a tangential mention
- [ ] **Page is current** — Check "Last updated" or publication date
  - For practical info: ≤2 years old preferred
  - For historical info: Any age acceptable if sourced

### 2. Fact Accuracy

- [ ] **Fact matches source text** — Read source yourself; agent didn't misquote
- [ ] **No hallucinated details** — Agent didn't invent specifics
- [ ] **No vagueness** — "sometime in 1700s" should be "1774–1778"
- [ ] **Names are spelled correctly** — Cross-check against source
- [ ] **Dates are plausible** — Is year 1800–2025? (Medieval sites: 800–1500?)
- [ ] **Numbers make sense** — "140 rooms" seems reasonable for Stiftsgården?

### 3. Confidence Assessment

**If confidence="verified":**
- [ ] **2+ sources found and cross-checked**
- [ ] **Sources are independent** (not both Wikipedia citing same page)
- [ ] **Both sources agree** — No contradictions
- [ ] **Facts are specific** — Not generic ("historic" vs "founded 1090")
- **Decision:** ✓ Keep as verified OR ⚠ Downgrade to unverified if sources conflict

**If confidence="unverified":**
- [ ] **Reason is clear** — Only 1 source? New venue? Subjective tip?
- [ ] **Source is still credible** — Not random blog without evidence
- [ ] **Fact is plausible** — Even if not double-sourced, it's reasonable
- **Decision:** ✓ Accept unverified OR ❌ Flag for removal if implausible

**If confidence="disputed":**
- [ ] **Curator must decide** — Is one version more credible?
- [ ] **Document both versions** in `structured_data` or `fact_text`
- **Decision:** Resolve to verified, unverified, or split into 2 facts

### 4. Fact Quality (All Confidences)

- [ ] **Fact is standalone** — Doesn't require previous fact for context
- [ ] **Fact is 50–250 characters** — Not a fragment, not a wall
- [ ] **Fact is NOT subjective** — No adjectives (beautiful, cozy, impressive)
  - ✅ "Bakklandet has cobblestone streets and historic timber houses"
  - ❌ "Bakklandet is charming with beautiful cobblestones"
- [ ] **Fact avoids marketing language** — Not "Must see!" or "Don't miss"
- [ ] **Journalist tone** — Informative, not hyperbolic
- [ ] **Norwegian is natural** — Not machine-translated awkwardness
- [ ] **English translation is natural** — Not word-for-word

### 5. Topic Relevance

| Topic | Check For |
|-------|-----------|
| **history** | Founding year, key events, people, historical periods. NOT "it was built" (too vague). |
| **architecture** | Style (Gothic, Baroque, etc.), materials, architect, year built, features. NOT "pretty". |
| **food** | Cuisine, chef, Michelin, dishes, sourcing. NOT "delicious". |
| **culture** | Collections, art forms, cultural significance, events. NOT "worth a visit". |
| **people** | Founder, architect, artist name + role. Verify name spelling. |
| **nature** | Landscape type, fauna, flora, seasonal aspects. NOT "nice park". |
| **practical** | Hours, prices, parking, accessibility. Should be recent (≤2 years). |
| **local_knowledge** | Timing tips, crowd management, insider recommendations. Require 3+ sources for consensus. |
| **spatial** | Distance to nearby POI, direction, walkability, view. Computed + narrative OK. |

- [ ] **Fact matches its topic** — history fact isn't architecture, food isn't people, etc.
- [ ] **Topic is relevant for this POI category**
  - Restaurant: food ✓, history ?, architecture ❌, people ✓
  - Landmark: history ✓, architecture ✓, spatial ✓, food ❌
  - Museum: culture ✓, architecture ?, history ✓, practical ✓

### 6. Structured Data Validation

- [ ] **Fields match schema** — No unexpected keys
- [ ] **Enums are valid**
  - history: event_type ∈ [construction, founding, opening, closing, renovation, disaster]
  - architecture: style ∈ [Gothic, Baroque, Rococo, Neoclassical, ...]
  - food: michelin_stars ∈ [0, 1, 2, 3, null] (NOT string)
- [ ] **Types correct**
  - Numbers: year_start, year_end are integers
  - Strings: person_name is string (not { first: "John", last: "Doe" })
  - Arrays: keywords, materials, awards are arrays (not comma-separated strings)
- [ ] **Values are sensible**
  - year_start ≤ year_end
  - michelin_stars ≤ 3
  - distance_meters ≤ 5000
  - keywords 2–5 items

### 7. Language & Translation

- [ ] **fact_text is readable Norwegian** — Not awkward machine phrasing
- [ ] **fact_text_en is accurate translation** — Not literal word-for-word
  - ✅ fact_text: "Grunnlagt i 1990" → fact_text_en: "Founded in 1990"
  - ❌ fact_text: "Grunnlagt i 1990" → fact_text_en: "Grounded in 1990"
- [ ] **English preserves meaning** — Names, technical terms correct
- [ ] **Both are 50–250 characters** — Similar length
- [ ] **No untranslatable Norwegian concepts** — e.g., "smau" (lane) should be explained

### 8. Special Cases

**Multiple facts per POI × topic:**
- [ ] **Each fact is unique** — No duplicates or near-duplicates
- [ ] **Ordered by importance** — sort_order reflects significance
- [ ] **No redundancy** — Fact 1 and Fact 2 aren't saying same thing

**Conflicting sources:**
- [ ] **Both versions documented** — e.g., year disputed
- [ ] **Source credibility assessed** — Which source is more authoritative?
  - SNL > Wikipedia > Blog
  - Official museum site > Adressa > Tripadvisor
- [ ] **Curator makes final call** — Verified, unverified, or disputed

**Recent venues (< 3 years old):**
- [ ] **Sourced from Google Business + recent article**
- [ ] **Not hallucinated as older**
- [ ] **confidence="unverified"** if only 1 source

**Very old facts (pre-1500):**
- [ ] **Medieval history allowed** — Don't require exact dates
- [ ] **If no primary source found, say "unverified"** — Don't invent

---

## Curator Decision Flowchart

```
START: Review fact JSON object

1. Source exists & valid?
   NO  → ❌ REJECT (no source link)
   YES → continue

2. 2 sources cross-verified for confidence="verified"?
   NO  → Downgrade to "unverified"
   YES → continue

3. Fact matches source text (no hallucination)?
   NO  → ❌ REJECT
   YES → continue

4. Fact is not subjective opinion?
   NO  → ❌ REJECT
   YES → continue

5. Fact is relevant to this topic & POI category?
   NO  → ❌ REJECT
   YES → continue

6. structured_data validates (correct types, enums, ranges)?
   NO  → ❌ REJECT
   YES → continue

7. English translation is natural & accurate?
   NO  → EDIT fact_text_en + continue
   YES → continue

8. Ready for public display?
   YES → ✅ APPROVE
   NO  → ⚠ APPROVE (unverified) or ❌ REJECT

END: Decision logged
```

---

## Batch Review Spreadsheet Template

Track decisions in Google Sheets or Excel:

| POI | Topic | Fact Text | Source | Status | Confidence | Notes | Approved? |
|-----|-------|-----------|--------|--------|------------|-------|-----------|
| Nidarosdomen | history | "Built 1090..." | snl.no | Verified | verified | ✓ | YES |
| Nidarosdomen | history | "1066 shrine..." | wiki NO | Verified | verified | Added note | YES |
| Nidarosdomen | architecture | "Gothic style..." | riksantikvaren | OK | verified | ✓ | YES |
| Stiftsgården | history | "1774–1778 construction..." | snl.no | Verified | verified | ✓ | YES |
| Credo | food | "1 Michelin star..." | michelin.com | Verified | verified | ✓ | YES |
| Credo | food | "Chef Heidi Bjerkan..." | visittrondheim.no | Single source | unverified | Mark unverified | YES |
| Bakklandet | local_knowledge | "Early morning best..." | 3 blogs | Consensus | unverified | 3 sources agree | YES |

**Columns:**
- **POI:** POI name
- **Topic:** history, architecture, food, etc.
- **Fact Text:** First 50 chars of fact
- **Source:** source_name from JSON
- **Status:** Verified | Single source | Hallucination | Conflict
- **Confidence:** verified | unverified | disputed
- **Notes:** Curator comments, edits made
- **Approved?:** YES | NO | EDIT+RESUBMIT

---

## Red Flags: When to REJECT a Fact

Reject immediately if:

❌ **Source is inaccessible** — Link is broken, 404, or requires login you don't have
❌ **Source doesn't mention POI** — Found completely different location
❌ **Hallucinated name** — "Designed by [famous architect]" but source doesn't say so
❌ **Hallucinated date** — "Founded 1774" but source says "late 1700s" (agent guessed)
❌ **Contradicted by 2 better sources** — Blog says X, but SNL + Wikipedia say Y
❌ **Pure opinion** — "Beautiful", "must see", "perfect spot" (no fact content)
❌ **Confidently wrong** — e.g., "Nidarosdomen is in Bergen" (location error)
❌ **Too short** — < 50 characters (fragment, not standalone fact)
❌ **Structured data is invalid** — Wrong enum, wrong type, impossible range

---

## Green Lights: When to APPROVE a Fact

Approve if:

✅ **Source exists and is Tier 1 or Tier 2**
✅ **Fact matches source text** — No hallucination detected
✅ **For verified:** 2 independent sources agree
✅ **For unverified:** Fact is plausible even if single-sourced
✅ **Fact is specific** — Dates, names, numbers are concrete
✅ **Fact is relevant** — Matches topic and POI category
✅ **Fact is not opinion** — Objective, factual phrasing
✅ **structured_data is valid** — Correct types and enums
✅ **Translation is natural** — English reads well, not literal

---

## Edit Decision: When to EDIT + RE-APPROVE

Edit (don't reject) if issue is minor:

⚠ **fact_text is awkward phrasing** → Rephrase in Curator voice
⚠ **fact_text_en is stiff translation** → Improve English wording
⚠ **confidence is verified but only 1 source found** → Change to unverified
⚠ **Source is current but no publication date visible** → Add {approx. date} note
⚠ **structured_data has typo** → Fix (e.g., "rococo" → "Rococo")
⚠ **Keywords are generic** → Replace with specific keywords

---

## Batch Progress Tracking

After each batch (5 POIs), curator reports:

- [ ] **POIs reviewed:** 5/5
- [ ] **Total facts reviewed:** 45 (5 POIs × 9 topics)
- [ ] **Approved:** ____ facts
- [ ] **Edited:** ____ facts
- [ ] **Rejected:** ____ facts
- [ ] **Issues identified:** [List]
  - Common hallucination: [e.g., "Agent guesses architect"]
  - Prompt adjustment needed: [e.g., "Need more emphasis on verification"]
  - Data quality: [e.g., "Practical topic needs recent sourcing"]

---

## Final Sign-Off Checklist

Before inserting 180 facts into Supabase:

- [ ] All 20 POIs reviewed (100% coverage)
- [ ] All 9 topics checked (not just popular ones)
- [ ] No facts rejected without reason documented
- [ ] No facts approved with known hallucinations
- [ ] Spreadsheet complete with decisions + notes
- [ ] Batch feedback doc written (issues + prompt adjustments)
- [ ] Sample of 5 random facts spot-checked by second curator
- [ ] No critical data quality issues (e.g., all dates hallucinated)

---

## Curator Sign-Off

After review completion:

**Batch 1 (5 POIs) Review Complete**

- Reviewed by: [Curator name]
- Date: [Date]
- Facts approved: [X] / 45
- Facts edited: [X]
- Facts rejected: [X]
- Main issues: [List of 3–5 top findings]
- Prompts adjusted: [Yes/No]
- Ready for database insert: [Yes/No/Conditional]

---

**Template Version:** 1.0
**Last Updated:** 2026-02-15
