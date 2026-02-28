---
title: "Generate Bolig Command Rewrite — Suburban Quality Pipeline"
category: feature-implementations
tags: [generate-bolig, quality-pipeline, suburban, editorial-hooks, translations, featured, command-design]
module: .claude/commands/generate-bolig.md
symptom: "Original generate-bolig command produced unsellable demos — POI noise, missing editorial hooks, stale translations, lost featured markers after filtering"
root_cause: "Command said 'identisk med generate-hotel' for quality steps without specifying suburban-specific rules. Multi-pass quality pipeline, featured re-marking, and translation scoping were not captured."
date: 2026-02-28
---

# Generate Bolig Command Rewrite — Suburban Quality Pipeline

## Problem

The original `generate-bolig.md` (477 lines) produced demos that required extensive manual cleanup before being presentable to customers. Executing the Broset demo revealed multiple gaps:

1. **Quality steps were vague:** Steps 5a/5b said "identisk med generate-hotel" without specifying suburban-specific filtering rules
2. **Featured markers disappeared:** Quality filtering deleted `product_pois` rows, which silently removed `featured=true` flags — resulting in 0 featured POIs
3. **Editorial hooks underspecified:** Tier 3 (commercial POIs) had no batching strategy, no parallel agent instructions, no complete bilingual examples
4. **Stale translations:** English bridgeTexts from a previous project (Overvik) showed up because theme entity_ids are global
5. **API gotchas undocumented:** NSR `ErAktiv` field doesn't exist, Barnehagefakta `id` can be null, heroIntro can't be translated via DB constraint

## Solution

Rewrote the command from 477 to 833 lines (16 to 18 steps), capturing every decision made during the Broset session.

### Key Changes

#### 1. Explicit Suburban Quality Criteria (Steg 5a)

Replaced "identisk med generate-hotel" with 5 specific filtering criteria:

| Criteria | What it catches | Example |
|----------|----------------|---------|
| Student-related | Bars/cafes primarily serving students | Studentersamfundet pub |
| Distance per category | Stricter than grovfilter (restaurant 15min, supermarket 12min) | Crispy Fried Chicken 22min walk |
| Chain fast food | International fast food lowers premium feel | Burger King, Subway |
| Category overflow | 4+ hair salons → keep top 2-3 | Trim bottom-rated hairdressers |
| Subtle name mismatch | LLM catches what regex missed | "Parkering IKEA" as shopping_mall |

#### 2. Featured Re-marking After All Filtering (Steg 7)

Added explicit ordering requirement: Steg 7 MUST run AFTER 5a+5b. The scoring formula and featured selection now run on the cleaned dataset.

Previous behavior: Featured set in Steg 7, then Steg 5a/5b deletes product_pois rows including featured ones. Result: 0 featured.

#### 3. Fully Specified Editorial Hooks (Steg 10)

- **Tier 1:** Complete bilingual templates for schools, kindergartens, sports facilities, playgrounds — with ferskvare-forbud per type
- **Tier 3:** Batch sizing (3 parallel batches of ~10, respecting 4-agent limit), WebSearch per POI, full NO+EN examples
- **Translation saving:** Explicit PATCH for Norwegian on POI + POST to translations table for English

#### 4. Translation Scoping Gotchas (Steg 11)

- **heroIntro:** Cannot be translated via translations table (`entity_type "product"` fails DB check constraint). Documented as Norwegian-only, which is acceptable since the buyer is Norwegian.
- **Theme bridgeTexts:** entity_ids like "hverdagsliv" are GLOBAL. New projects overwrite previous project's English translations. Documented as known limitation.

#### 5. New Steps: Visual QA (Steg 16) + User Review (Steg 17)

- **Steg 16:** Take Chrome DevTools MCP screenshots of Explorer, Report (NO), Report (EN). Verify bridgeTexts are project-specific.
- **Steg 17:** Explicit user feedback loop — remove/add POIs, update featured, refresh categories, revalidate.

#### 6. 10 Gotchas Section

All learned from actual execution errors during the Broset session:

1. Featured disappears after quality filtering
2. heroIntro only Norwegian (DB constraint)
3. Theme translations are global, not project-scoped
4. NSR API has no `ErAktiv` field
5. Barnehagefakta `id` can be null
6. dotenv scripts must run from project directory
7. `product_pois.featured` not `pois.is_featured`
8. Never delete from `pois` table
9. product_categories must refresh after filtering
10. Walk speed constant: 80m/min

## Key Design Decisions

### Command captures execution, not abstraction

The previous command abstracted quality steps as "identisk med generate-hotel." The new command captures the EXACT flow that produced a sellable demo. Every filtering criterion, every batch size, every gotcha — documented at the level of detail needed for Claude Code to reproduce the result without human intervention.

### Bilingual-first throughout

Every content generation step (Tier 1, Tier 3, bridgeTexts) generates NO+EN simultaneously. Previous command added English as an afterthought in some steps and missed it in others.

### Multi-pass quality as explicit architecture

```
Import (grovfilter) → LLM review (5a) → Dedup (5b) → Link (6) → Featured (7) → Categories (8)
```

This ordering is now explicit. Each step depends on the previous. Featured and categories come LAST because they need the final clean dataset.

## Files

| File | Purpose |
|------|---------|
| `.claude/commands/generate-bolig.md` | The rewritten command (833 lines) |

## Gotchas

- **The command is gitignored** (`.claude/*` in `.gitignore`). Changes are local to this machine. If you need to share, copy the file.
- **generate-hotel.md is the reference** for hotel-specific steps. The two commands share infrastructure but have different quality profiles, radius defaults, themes, and editorial perspectives.
- **Agent limit:** CLAUDE.md says max 4 background agents. Editorial hook Tier 3 uses 3 parallel batches to stay within limit.

## Related

- `docs/solutions/feature-implementations/generate-bolig-infrastructure-20260227.md` — DB migration, categories, types
- `docs/solutions/feature-implementations/poi-quality-pipeline-bolig-20260227.md` — Grovfilter implementation in TypeScript
- `docs/solutions/feature-implementations/generate-hotel-quality-upgrade-20260206.md` — Hotel equivalent
- `docs/solutions/feature-implementations/bilingual-i18n-report-translations-20260206.md` — Translation system architecture
- `docs/solutions/best-practices/editorial-hooks-no-perishable-info-20260208.md` — Ferskvare-regel
