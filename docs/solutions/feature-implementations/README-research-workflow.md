# Research Workflow Documentation — Complete Index

This directory contains the complete research workflow for Placy's City Knowledge Base project. Use this file as your starting point.

---

## Documents in This Series

### 1. **research-workflow-poi-fact-finding-20260215.md** ← START HERE
**Primary document** — Comprehensive guide to research strategy.

Contains:
- Search query templates for each of 9 topics
- Tier 1/2/3 source evaluation
- Verification strategy (what counts as "2 independent sources")
- Hallucination traps specific to Norwegian POIs
- Structured data extraction schema per topic
- Pilot execution checklist

**Use this to:**
- Understand the full workflow
- Design search queries
- Learn how to cross-verify facts
- Know what fields to extract
- Plan the pilot phase

**Skip if:** You just need to write agent prompts (see doc #2) or review facts (see doc #3)

---

### 2. **research-agent-prompts-template-20260215.md**
**For developers** — Complete prompt templates for all 9 research agents.

Contains:
- Full prompt text for history, architecture, food, culture, people, nature, practical, local_knowledge agents
- Spatial topic approach (computed + narrative)
- Hallucination traps embedded in each prompt
- Search query suggestions per agent
- JSON schema for output
- Examples of good/bad outputs

**Use this to:**
- Implement `scripts/research-place-knowledge.ts`
- Copy/paste prompts into code
- Understand what each agent looks for
- Train agents to avoid topic-specific hallucinations

**Skip if:** You're a curator reviewing facts (see doc #3) or just planning the workflow

---

### 3. **research-verification-checklist-20260215.md**
**For curators** — Standardized fact-checking template.

Contains:
- Per-fact verification checklist (8 sections)
- Decision flowchart (when to approve/reject/edit)
- Red flag list (auto-reject conditions)
- Green light list (auto-approve conditions)
- Batch progress tracking
- Sign-off template

**Use this to:**
- Review AI-generated facts consistently
- Document decisions
- Track batch progress
- Know when to reject/edit/approve
- Sign off before database insert

**Skip if:** You're developing the script (see doc #2) or planning (see doc #1)

---

## Quick Navigation

### By Role

**Product Manager / Project Lead**
1. Read doc #1 (sections 1–4)
2. Review pilot checklist (section 10)
3. Monitor doc #3 batch progress

**Developer / Engineer**
1. Skim doc #1 (sections 1–3 for context)
2. Read doc #2 in detail
3. Implement `scripts/research-place-knowledge.ts` using prompts from doc #2
4. Implement backfill script
5. Run integration tests

**Curator / Content Reviewer**
1. Skim doc #1 (sections 1–5 for context)
2. Read doc #3 in detail
3. Use spreadsheet template during batch 1–4 reviews
4. Document decisions + feedback
5. Sign off before INSERT

**Data Analyst / QA**
1. Read doc #1 (section 5: hallucination traps)
2. Read doc #3 (red flags section)
3. Spot-check sample facts from each batch
4. Report quality metrics

---

### By Phase

**Phase 1: Planning (Before sprint)**
- Doc #1: Entire document
- Doc #3: Skip (not yet needed)
- Doc #2: Reference only

**Phase 2: Implementation (Sprint week 1–2)**
- Doc #2: Detailed read for developers
- Doc #1: Section 9 (research script execution)
- Doc #3: Skip (not yet needed)

**Phase 3: Pilot Research (Sprint week 2–3)**
- Doc #1: Section 10 (pilot checklist)
- Doc #2: As reference during debugging
- Doc #3: Not yet (post-research review)

**Phase 4: Curator Review (Sprint week 3–4)**
- Doc #3: Detailed read for all curators
- Doc #1: Sections 3–4 (source authority, verification)
- Doc #2: Reference if unsure about topic intent

**Phase 5: Database Insert & QA (Sprint week 4+)**
- Doc #3: Sign-off template
- Doc #1: Section 11 (maintenance)
- Doc #2: Debugging edge cases

---

## Key Concepts at a Glance

### 1. The 9 Topics

| Topic | Best Source | Hallucination Risk | Example Query |
|-------|-------------|-------------------|---|
| **history** | SNL, Wiki NO | Confused dates, invented architects | "Nidarosdomen grunnlagt år" |
| **architecture** | Riksantikvaren, SNL | Poetic language instead of facts | "Stiftsgården arkitektur stil" |
| **food** | Michelin, Visit TRD | Fake Michelin stars | "Credo Michelin stjerne" |
| **culture** | SNL, Wiki | Overclaiming significance | "Rockheim musikk samling" |
| **people** | SNL, Wiki, Adressa | Invented names | "Stiftsgården grunnlegger" |
| **nature** | Kommune, Wiki | Vague descriptions | "Korsvika strand Trondheim" |
| **practical** | Google, Visit TRD | Outdated hours | "Nidarosdomen åpningstider" |
| **local_knowledge** | Blogs, reviews, Reddit | Single-source as fact | "Bakklandet tips hemmelighet" (need 3+ sources) |
| **spatial** | Mapbox + blogs | Invented distances | "Gamle Bybro avstand" |

### 2. Source Hierarchy

**Tier 1 (Authoritative):** SNL, Riksantikvaren, Wikipedia (with refs)
**Tier 2 (Good):** Visit Trondheim, Google Business, Adressa
**Tier 3 (Supplementary):** Travel blogs, Reddit, Instagram, Tripadvisor

For `confidence="verified"`: Tier 1 + Tier 1, OR Tier 1 + Tier 2

### 3. Verification Logic

```
confidence="verified"   → 2+ independent sources agree
confidence="unverified" → 1 source, plausible, not verified
confidence="disputed"   → 2+ sources disagree → curator decides
```

### 4. Structured Data

Every fact has:
- `fact_text` (Norwegian, journalist tone)
- `fact_text_en` (English translation)
- `structured_data` (JSON schema for machine reading)
- `source_url` (verifiable link)
- `source_name` (SNL, Wiki, Michelin, etc.)

Example:
```json
{
  "fact_text": "Stiftsgården ble bygget 1774–1778",
  "structured_data": {
    "year_start": 1774,
    "year_end": 1778,
    "event_type": "construction"
  },
  "confidence": "verified",
  "source_url": "https://snl.no/...",
  "source_name": "SNL"
}
```

---

## Workflow Execution Timeline

```
Week 1: Planning & Setup
├─ Doc #1: Read full document (PM + Dev + Curator)
├─ DB migration created (Dev)
├─ TypeScript types added (Dev)
└─ Agent script skeleton written (Dev)

Week 2: Implementation & Pilot Batch 1
├─ Agent prompts finalized (Dev reads Doc #2)
├─ Research script complete (Dev)
├─ Batch 1 research: 5 POIs (Agents + Dev)
├─ Batch 1 review: 45 facts (Curator reads Doc #3)
└─ Feedback documented

Week 3: Adjustment & Batch 2–4
├─ Prompts adjusted based on feedback (Dev)
├─ Batch 2–4 research: 15 POIs (Agents + Dev)
├─ Batch 2–4 review: 135 facts (Curator)
├─ Backfill from editorial hooks (Dev)
└─ Total: 180 facts ready for INSERT

Week 4: Database & QA
├─ INSERT all 180 facts (Dev)
├─ POI detail pages test (QA)
├─ MapPopupCard test (QA)
├─ Admin interface test (QA)
└─ Public launch

Week 5+: Monitoring & Rollout
├─ SEO impact tracking
├─ User engagement analytics
└─ Plan scale to 200+ POIs
```

---

## File Dependencies

```
docs/solutions/feature-implementations/
├─ README-research-workflow.md (this file)
├─ research-workflow-poi-fact-finding-20260215.md (main guide)
├─ research-agent-prompts-template-20260215.md (developer prompts)
└─ research-verification-checklist-20260215.md (curator template)

scripts/
├─ research-place-knowledge.ts (uses prompts from doc #2)
├─ backfill-knowledge-from-editorial.ts
└─ insert-knowledge-facts.ts

data/research/ (created during pilot)
├─ nidarosdomen__history.json
├─ nidarosdomen__architecture.json
├─ ... (180 files total)
└─ FEEDBACK.md (curator notes per batch)
```

---

## Critical Success Factors

1. **Verification before display** — Use doc #3 checklist for every fact
2. **Source credibility** — Tier 1 sources preferred; avoid single-sourcing
3. **Hallucination vigilance** — Know topic-specific traps (doc #1, section 5)
4. **Curator quality gate** — No facts approved without source inspection
5. **Prompt iteration** — Adjust prompts after batch 1 feedback
6. **Batch pacing** — 5 POIs per batch, not all 20 at once (allows feedback loop)

---

## Common Questions

**Q: Can I use one blog as source?**
A: No. Require Tier 1 source + Tier 2, OR Tier 1 + Tier 1. Blogs are Tier 3 (supplementary only). Exception: local_knowledge needs 3+ blog sources for consensus.

**Q: Fact says X but Google says Y?**
A: Mark as `disputed` and let curator decide. Google can be outdated. Prefer SNL or Wikipedia if available.

**Q: What if I can't find any sources?**
A: Return empty array `[]` for that topic. Better to skip than hallucinate.

**Q: How long does one POI × one topic take to research?**
A: ~15–30 minutes per agent (including retry logic). With 4 parallel agents (2 batches of 4), a POI takes ~45–60 minutes total.

**Q: Can I research all 20 POIs at once?**
A: No. Batch 1 (5 POIs) first, review, adjust prompts, then Batch 2–4 (15 POIs). Feedback loop is critical.

**Q: What if the agent output is gibberish JSON?**
A: Log error, retry with exponential backoff 3x. After 3 failures, skip topic and note in stderr. Continue with next topic.

**Q: How do I validate JSON before inserting to DB?**
A: Create `scripts/validate-knowledge-json.ts` that:
- Parses JSON
- Checks schema (all required fields)
- Validates enums (topic, confidence, event_type, etc.)
- Checks types (year_start is integer, not string)
- Validates source_url with `isSafeUrl()`
- Reports errors per file

---

## Escalation Path

| Issue | Owner | Escalate To |
|-------|-------|-------------|
| Prompt quality (fact hallucination) | Developer | Product Lead |
| Data quality (low accuracy) | Curator | Product Lead |
| Performance (too slow) | Developer | CTO |
| Verification ambiguity (X vs Y sources) | Curator | Product Lead |
| Scale beyond 20 POIs | Product Lead | Executive |

---

## Next Steps

1. **PM:** Read doc #1 in full. Schedule kickoff meeting.
2. **Dev:** Read docs #1 and #2. Estimate implementation time.
3. **Curator:** Read doc #3. Prepare review process.
4. **All:** Agree on timeline and resource allocation (section: Workflow Execution Timeline).

---

## Document Metadata

| Attribute | Value |
|-----------|-------|
| Created | 2026-02-15 |
| Version | 1.0 |
| Authors | Product + Engineering Teams (Placy) |
| Type | Reference Documentation |
| Status | Active (in use) |
| Review Date | 2026-03-15 (after pilot completion) |

---

**Questions?** Refer to the specific document sections listed above, or contact the product lead.
