# Research Workflow Design Summary

**Date:** 2026-02-15
**Project:** Placy City Knowledge Base
**Status:** Complete Design Document

---

## What Was Delivered

Four comprehensive documentation files that define a complete research workflow for finding, verifying, and structuring POI facts in Trondheim using Claude Code agents and WebSearch.

### Documents

| Document | Purpose | Audience | File |
|----------|---------|----------|------|
| **Main Guide** | Complete research methodology, sources, verification, hallucination traps, execution plan | PM, all roles | `research-workflow-poi-fact-finding-20260215.md` |
| **Agent Prompts** | Full prompt templates for 9 specialized agents, ready to copy into code | Developer | `research-agent-prompts-template-20260215.md` |
| **Curator Checklist** | Standardized fact-checking template, decision flowchart, sign-off procedures | Content curator | `research-verification-checklist-20260215.md` |
| **Navigator** | Index, quick reference, FAQs, timeline, escalation path | Everyone | `README-research-workflow.md` |

---

## Key Deliverables

### 1. Search Strategy Per Topic (9 Topics)

Each topic has optimized search query patterns targeting Norwegian sources:

| Topic | Primary Query | Best Sources | Example |
|-------|---|---|---|
| history | "{name} grunnlagt år" | SNL, Wiki NO | "Nidarosdomen grunnlagt år" → 1090 |
| architecture | "{name} arkitektur stil" | Riksantikvaren, SNL | "Stiftsgården arkitektur stil" → Baroque |
| food | "{name} Michelin" | michelin.com, Visit TRD | "Credo Michelin" → 1 star |
| culture | "{name} kunstner utstilling" | SNL, Wiki, museums | "Rockheim musikk samling" |
| people | "{name} grunnlegger" | SNL, Wiki, Adressa | "Credo kokk Heidi Bjerkan" |
| nature | "{name} naturlig" | Kommune, Wiki | "Korsvika strand" → beach type |
| practical | "{name} åpningstider" | Google, Visit TRD | "Nidarosdomen billett pris" |
| local_knowledge | "{name} tips hemmelighet" | 3+ blogs, reviews | "Bakklandet morgen best" (consensus) |
| spatial | "{name} avstand" | Mapbox + blogs | "Gamle Bybro avstand Nidarosdomen" |

### 2. Source Authority Framework (Tier 1/2/3)

**Tier 1 (Authoritative):** SNL, Riksantikvaren, Wikipedia (with refs)
- For verification: Tier 1 + Tier 1, or Tier 1 + Tier 2 = VERIFIED
- Single Tier 1 = can mark VERIFIED if well-sourced

**Tier 2 (Good):** Visit Trondheim, Google Business, Adressa, Wikipedia EN
- For verification: Tier 2 + Tier 2 requires 3rd source
- Common for practical/food topics

**Tier 3 (Supplementary):** Travel blogs, Reddit, Instagram, Tripadvisor
- Never alone; need Tier 1 + Tier 2
- Exception: local_knowledge needs 3+ Tier 3 sources for consensus

### 3. Hallucination Traps (20+ Norwegian POI–Specific)

Critical traps identified and mitigation provided:

1. **Date confusion** — "1090" (cathedral) vs "1066" (shrine) for Nidarosdomen
2. **Invented architects** — Model hallucinating designer names when not in sources
3. **Patron vs architect** — Confusing who commissioned vs. who designed (Cecilie Christine Schøller)
4. **Vague timeframes** — "sometime in 1700s" instead of "1774–1778"
5. **Michelin stars** — Guessing or using outdated Michelin ratings (always verify official guide)
6. **Local sourcing** — "Local ingredients" without specifying radius (should be "30 km")
7. **Recent events** — Using training-cutoff info for venues opened 2023–2024
8. **Google staleness** — Trusting outdated Google Business hours
9. **Wikipedia circularity** — Multiple Wikipedia articles cite each other, no original source
10. **Blog consensus as fact** — Treating "3 bloggers say X" as verified fact (it's consensus, not fact)
11. **Place name confusion** — "Bakklandet in Oslo" (it's Trondheim)
12. **Poetic language** — "Beautiful stone facade" instead of "Sandstone facade"
13. **Chain restaurant assumption** — Thinking local restaurant is part of chain
14. **Video recency** — Assuming 2020 video with "2024" caption is current
15. **Instagram popularity as authority** — Treating viral location as local knowledge
... and 5+ more

### 4. Verification Logic (Decision Tree)

Clear rules for marking `confidence = verified | unverified | disputed`:

```
confidence="verified"   → 2+ independent sources agree
                          (Tier 1 + Tier 1, or Tier 1 + Tier 2)

confidence="unverified" → 1 source found, plausible, not contradicted
                          (Tier 2 alone, or high-quality blog)

confidence="disputed"   → 2+ sources contradict
                          (Curator decides which to keep)
```

### 5. Structured Data Schema (Per Topic)

Every fact extracts machine-readable fields beyond `fact_text`:

**history:** `event_type`, `year_start`, `year_end`, `person`, `person_role`, `historical_period`
**architecture:** `style`, `materials`, `architect`, `notable_features`, `restoration_year`
**food:** `cuisine_type`, `chef_name`, `michelin_stars`, `sourcing`, `awards`
**culture:** `institution_type`, `collection_focus`, `curator_or_founder`
**people:** `person_name`, `role`, `birth_year`, `nationality`
**nature:** `landscape_type`, `vegetation`, `wildlife`, `seasonal_best`
**practical:** `opening_hours`, `admission_price`, `parking`, `wheelchair_accessible`
**local_knowledge:** `tip_category`, `best_time`, `consensus_sources`
**spatial:** `relationship_to`, `distance_meters`, `walk_time_minutes`, `relative_direction`

### 6. Agent Prompt Templates (All 9 Topics)

Complete, copy-ready prompts with:
- Role definition per agent
- Input specification (POI data)
- Task definition
- Verification rules (topic-specific)
- Hallucination traps (topic-specific)
- Search query suggestions (3 levels: primary, secondary, fallback)
- JSON schema
- 2–3 examples (good + bad)
- Quality gates (checklist)

Ready for `scripts/research-place-knowledge.ts` implementation.

### 7. Curator Review Checklist

Standardized fact-checking process:
1. Source verification (link valid, Tier 1/2, page discusses POI)
2. Fact accuracy (matches source, no hallucination, no vagueness)
3. Confidence assessment (verified vs unverified vs disputed)
4. Fact quality (standalone, 50–250 chars, no opinion)
5. Topic relevance (matches topic, relevant for POI category)
6. Structured data validation (correct types, valid enums, sensible ranges)
7. Language & translation (Norwegian natural, English accurate)
8. Special cases (multiple facts per POI×topic, conflicts, recent venues, ancient history)

Decision flowchart: 8-step approval path (START → approve/reject/edit → END)

### 8. Pilot Execution Plan (20 POIs, 9 Topics)

5-phase approach:
1. **Setup** — Script implementation, test harness
2. **Batch 1 (5 POIs)** — Nidarosdomen, Stiftsgården, Gamle Bybro, Erkebispegården, Bakklandet
3. **Review & Feedback** — Curator reviews 45 facts, documents issues
4. **Prompt Adjustment** — Update agents based on feedback
5. **Batch 2–4 (15 POIs)** — Scale research, curator reviews 135+ facts

Expected timeline: 3–4 weeks

---

## Specific to Trondheim & Norwegian POIs

This workflow is **not generic**. It's deeply tailored to Norwegian research:

### Norwegian Language Specificity

- Query patterns use Norwegian words: "grunnlagt" (founded), "arkitektur" (architecture), "kokk" (chef)
- Source authority respects Norwegian editorial oversight (SNL curates facts about Norway)
- Fallback to English Wikipedia only after Norwegian sources exhausted
- Distinct Norwegian concepts (e.g., "visste du" = "did you know", not translatable)

### Regional Sources

- **SNL (Store Norske Leksikon)** — Norwegian expert review, strongest authority for Norwegian facts
- **Riksantikvaren** — Official heritage registry, authoritative for architecture/history
- **Trondheim Kommune** — Municipal data on facilities, parks, infrastructure
- **Adressa** — Regional newspaper, best for local news, restaurant reviews, events
- **Visit Trondheim** — Destination marketing, curated attractions, contact info

### POI-Specific Traps

- Confusing St. Olav shrine (pre-1090) with cathedral construction (1090+)
- Architect vs. patron (Cecilie Christine Schøller commissioned, didn't design)
- Restaurant opening year vs. ownership change
- Michelin Guide updates annually; training data may be outdated
- Google Business profiles often lag 1–2 years behind reality

### Local Context

- Bakklandet character ("bohemian") is consensus opinion from bloggers, not encyclopedic fact
- Seasonal beach closing (April–September) is practical fact
- Cobblestones in Bakklandet are factual; "charm" is opinion
- Morning crowds at Nidarosdomen are observation, not fact; verify in reviews

---

## How to Use This Workflow

### For Immediate Implementation (Next 2 Weeks)

1. **Developer:** Read doc #2 (agent prompts), implement `scripts/research-place-knowledge.ts`
2. **Curator:** Read doc #3 (checklist), prepare spreadsheet template
3. **PM:** Read doc #1 (main guide), plan Batch 1 timeline
4. **All:** Use doc #4 (navigator) as reference

### For Batch 1 Research

1. Run agents on 5 POIs (Nidarosdomen, Stiftsgården, Gamle Bybro, Erkebispegården, Bakklandet)
2. Export 45 JSON files (5 POIs × 9 topics)
3. Curator reviews using doc #3 checklist
4. Document issues + feedback in `data/research/FEEDBACK.md`
5. Developer adjusts prompts
6. Proceed to Batch 2–4

### For Ongoing Curation

Use doc #3 spreadsheet template for every batch:
- Rows: 180 facts (20 POIs × 9 topics)
- Columns: POI, Topic, Fact Text, Source, Status, Confidence, Notes, Approved?
- Decision: Approve (✅), Edit + approve (⚠), or Reject (❌)

---

## Success Criteria

The workflow is successful when:

- ✅ **180 facts researched** (20 POIs × 9 topics)
- ✅ **Verified facts** (confidence marked correctly, sources inspected)
- ✅ **No hallucinations** (curator spotted & rejected/edited any fabricated facts)
- ✅ **Consistent schema** (all structured_data valid, enums correct, types match)
- ✅ **Natural language** (Norwegian & English read well, no machine awkwardness)
- ✅ **POI detail pages enhanced** (knowledge sections display correctly)
- ✅ **SEO impact** (200 Trondheim POI pages + 200 English pages now have rich content)
- ✅ **Curator efficiency** (fact-checking takes < 2 hours per batch using checklist)

---

## Beyond the Pilot (Future Phases)

### Phase 2 (Months 2–3)

- Scale to 200+ Trondheim POIs
- Backfill remaining POIs with existing editorial_hook content
- Implement area-level knowledge (neighborhoods, districts)
- Add pgvector embeddings for semantic search

### Phase 3 (Months 4–6)

- Expand to second city (Bergen, Oslo, Stavanger, Tromsø)
- Build curator dashboard for managing knowledge inventory
- Implement automatic quarterly refresh (outdated fact detection)
- Multi-language: Extend EN/NO to German, Swedish (tourism markets)

### Phase 4 (Months 6+)

- AI chat interface using knowledge base (RAG)
- Automated tour generation from knowledge + spatial data
- Personalized experiences based on user preferences + location
- API for third-party integrations

---

## Files in This Series

All files in `/docs/solutions/feature-implementations/`:

- `research-workflow-poi-fact-finding-20260215.md` — Main guide (comprehensive)
- `research-agent-prompts-template-20260215.md` — Agent prompts (ready to code)
- `research-verification-checklist-20260215.md` — Curator checklist (fact review)
- `README-research-workflow.md` — Navigator index (quick reference)
- `SUMMARY-research-workflow-design.md` — This file (overview)

Git commit: `c1579fb` ("docs: POI research workflow — complete guide")

---

## Contact & Questions

Refer to appropriate document:
- **"How do I research this topic?"** → Main guide, Section 1
- **"How do I write agent prompts?"** → Agent prompts doc
- **"How do I review this fact?"** → Curator checklist
- **"When should I use which document?"** → Navigator doc (README)

---

**Workflow Version:** 1.0
**Status:** Ready for implementation
**Last Updated:** 2026-02-15
**Next Milestone:** Batch 1 research completion (2026-02-22)
