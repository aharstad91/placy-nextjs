---
title: "Claude Code Skill Pattern: Goal-Oriented Pipeline with Human Checkpoints"
date: 2026-02-06
category: architecture-patterns
module: .claude/commands
tags:
  - claude-code
  - skill
  - slash-command
  - agent-native
  - pipeline
  - automation
  - human-in-the-loop
severity: low
status: resolved
symptoms:
  - "Manual multi-step project setup is tedious and error-prone"
  - "Ad-hoc agent prompting produces inconsistent results"
  - "No standard pattern for structuring autonomous CLI skills"
root_cause: "No established pattern existed for writing .claude/commands/*.md files that orchestrate multi-step workflows with safety checkpoints."
affected_files:
  - .claude/commands/generate-hotel.md
---

# Claude Code Skill Pattern: Goal-Oriented Pipeline with Human Checkpoints

## Problem

Creating a new Placy project (customer, project, products, POIs, cache) required 7 manual steps through the admin UI. We needed a single Claude Code skill (`/generate-hotel`) to automate the full pipeline, but had no established pattern for structuring such skills.

## Solution: The Generate-Hotel Skill as Reference Implementation

`.claude/commands/generate-hotel.md` — 166 lines of declarative markdown, no executable code.

### Seven Design Principles

#### 1. Input Contract

Define exact invocation syntax up front:

```
/generate-hotel "Hotellnavn" "Adresse"
```

This gives the agent clear expectations about arguments.

#### 2. Prerequisites Section

State required environment so the agent can fail fast:

```markdown
## Forutsetninger
- `npm run dev` kjører på `localhost:3000`
- `ADMIN_ENABLED=true` i `.env.local`
```

#### 3. Numbered Pipeline Steps

Each step uses the output of the previous step. Explicit data flow:

```
Geocode → Coordinates → Customer → Project → Products → POI Discovery → Product Linking → Cache Revalidation
```

Steps are numbered 1-7 with clear input/output contracts between them.

#### 4. Human Checkpoints at Irreversible Decisions

Steps that write to the database pause for user approval:

```markdown
**Checkpoint:** Vis stedsnavn og koordinater. Spør brukeren om bekreftelse.
Hvis avvist: Spør etter korrigert adresse og geocode på nytt. Gjenta til godkjent.
```

Pattern: Show result → Ask for confirmation → If rejected: recovery path → Repeat.

Used at:
- Step 1: Geocode confirmation (wrong address = wrong everything)
- Step 2: Customer name confirmation (wrong customer = data mess)

#### 5. Reference Canonical Utilities, Don't Inline Logic

The skill references `lib/utils/slugify.ts` by path rather than embedding slugify logic:

```markdown
Slugify kundenavnet med `lib/utils/slugify.ts`-logikken (æ→ae, ø→o, å→a FØR NFD).
```

This prevents drift between the skill and the codebase.

#### 6. Structured Output

Specify exactly what the final summary should contain:

```markdown
## Output
Vis en oppsummering med:
- Kundenavn og slug
- Prosjektnavn
- Antall POI-er totalt og per kategori
- Explorer-URL, Report-URL, og Admin-URL
```

#### 7. Optional Extensions Clearly Marked

Editorial hooks are explicitly marked optional:

```markdown
## Valgfritt: Editorial Hooks
Kun hvis brukeren eksplisitt ber om det.
```

This prevents scope creep during normal runs.

### Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Do This Instead |
|--------------|-------------|-----------------|
| 200 lines of curl commands | Agent can't adapt when APIs change | Describe goals and judgment criteria |
| Inline slugify logic in the skill | Drifts from actual implementation | Reference `lib/utils/slugify.ts` by path |
| No checkpoints | Wrong geocode = entire pipeline wasted | Pause before irreversible writes |
| Everything required | Slows down normal usage | Mark extensions as "Valgfritt" |

### Structural Observations

- **Entirely declarative markdown** — the agent interprets the instructions, no executable code
- **Uses localhost URLs** — assumes running dev server, doesn't import internal modules
- **References section at bottom** — links to actual source files for when implementations change
- **Under 200 lines** — concise enough to fit in agent context without compression

## When to Use This Pattern

- Automating multi-step workflows that involve database writes
- Pipelines where some steps need human verification
- Skills that orchestrate existing API endpoints rather than implementing new logic
- Any `.claude/commands/*.md` that does more than a simple one-shot task

## Prevention

When creating new skills:
1. Start with input contract and prerequisites
2. Number the pipeline steps with explicit data flow
3. Add checkpoints before irreversible operations
4. Reference existing utilities by path, don't inline
5. Mark optional features clearly
6. Include a References section linking to source files

## References

- Commit: `a3b2053` feat: add /generate-hotel skill
- Reference implementation: `.claude/commands/generate-hotel.md`
- Related: `docs/solutions/workflow-issues/stack-agnostic-workflow-commands-20260205.md`
- Related: `docs/solutions/ux-improvements/nanoid-short-urls-admin-projects-20260205.md`
- Related: `docs/solutions/logic-errors/empty-product-categories-explorer-zero-pois-20260205.md`
