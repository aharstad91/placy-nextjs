---
title: Building a Claude Code editorial skill from inspiration texts
category: best-practices
tags: [editorial, skill, voice, style-guide, claude-code]
date: 2026-02-14
---

# Building a Claude Code editorial skill from inspiration texts

## Problem

Editorial text quality varied between migrations. Migration 021 (café) produced generic hooks like "Intim nabolagskafé med fokus på kvalitetskaffe og hjemmelaget bakst i hyggelige omgivelser", while 025 (restaurant) achieved professional quality with specific names, dates, and sensory details.

## Root cause

No formalized editorial voice — Claude generated text based on general patterns rather than a defined style grounded in real inspiration.

## Solution

Created a Claude Code skill (`.claude/skills/placy-editorial/`) with voice principles destilled from 72 analyzed texts across 4 source types.

### Key insight: Skills need source material, not just summaries

First attempt was based on the brainstorm summary — principles without supporting evidence. This produced thin guidance that Claude couldn't calibrate against.

The fix: ground every principle in actual quotes from the inspiration sources.

**Example — Principle B (Bevegelse):**
- Thin version: "Skape mental reise gjennom rom og sted"
- Rich version: Includes Sem & Johnsen quote "Langs Akerselva kan du spasere ned til sentrum, eller opp forbi Nydalen, Frysja og videre innover mot Maridalsvannet" + Kinfolk spatial progression quote

### Skill structure

```
.claude/skills/placy-editorial/
├── SKILL.md                        # Main: voice, checklist, quick ref (113 lines)
└── references/
    ├── voice-principles.md         # 6 principles with source quotes (194 lines)
    ├── text-type-specs.md          # Structure patterns + register templates (207 lines)
    └── before-after-examples.md    # Real migration comparisons (154 lines)
```

### Design decisions

1. **Project-level** (`.claude/skills/`) — version-controlled, shared with collaborators
2. **Progressive loading** — SKILL.md is self-contained; references loaded on demand
3. **Register-differentiated templates** — same text type gets different treatment for Michelin vs. café vs. museum
4. **4 structural patterns** from travel guides as named options
5. **Stil-DNA per source** — distilled what each of the 4 sources contributes

## Verification

- Principles A-F consistent across all 4 files
- All 5 registers covered for both editorial_hook and local_insight
- Before-after examples use real migration data
- Word lists aligned with brainstorm decisions

## Lessons

1. **Don't summarize inspiration — quote it.** The actual words matter for tone calibration.
2. **Register differentiation is the feature.** "One voice, adjusted register" means different templates per context — not just a principle statement.
3. **Before-after examples are the strongest teaching tool.** Annotated comparisons with principle labels show Claude exactly what to do.
4. **Source attribution in principles** helps Claude understand *why* a principle exists, not just *what* it says.
