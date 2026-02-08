---
module: System
date: 2026-02-05
problem_type: workflow_issue
component: development_workflow
symptoms:
  - "Compound-engineering workflow commands hardcoded to Rails stack"
  - "Review command combined pre-plan and post-work concerns into one phase"
  - "No scope protection — review agents would suggest removing features"
  - "Commands not reusable across different tech stack projects"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: high
tags: [workflow, commands, stack-agnostic, tech-audit, code-review, scope-protection]
---

# Stack-Agnostic Workflow Commands with Scope Protection

## Problem

The default compound-engineering workflow commands were designed for Rails projects and combined all review concerns into a single `/review` phase. This had three issues: (1) commands referenced Rails-specific agents and tools, (2) review happened only after implementation when architecture changes are expensive, and (3) review agents would suggest removing features or cutting scope.

## Environment
- Module: System (user-level CLI commands)
- Stack: Any (commands are stack-agnostic)
- Location: `~/.claude/plugins/user-custom/commands/`
- Date: 2026-02-05

## Symptoms
- `/review` used `kieran-rails-reviewer`, `dhh-rails-reviewer`, `cora-test-reviewer` — irrelevant for non-Rails projects
- No technical validation happened between planning and implementation
- Review agents would say "this feature is over-engineered" or "consider removing this"
- Commands referenced `bin/rails test`, `bin/dev` — only works for Rails

## What Didn't Work

**Using compound-engineering's built-in workflows directly:**
- Workflows assume Rails/Ruby stack throughout
- `/plan_review` uses DHH reviewer (Rails-specific personality)
- `/workflows:review` runs 13+ agents including many Rails-specific ones
- No mechanism to protect scope from being cut by reviewers

## Solution

Created 7 custom command files at `~/.claude/plugins/user-custom/commands/`:

### 1. Split review into two scope-protected phases

**tech-audit.md** (post-plan, pre-work):
- Runs 7 parallel agents: architecture-strategist, security-sentinel, performance-oracle, data-integrity-guardian, spec-flow-analyzer, pattern-recognition-specialist, learnings-researcher
- Cardinal rule at top of file: NEVER suggest removing features, ALWAYS propose solutions
- Outputs GREEN/YELLOW/RED verdict

**code-review.md** (post-work, pre-compound):
- Runs 5+1 parallel agents: [language-reviewer], security-sentinel, performance-oracle, code-simplicity-reviewer, pattern-recognition-specialist + conditional data-integrity-guardian
- Cardinal rule: NEVER suggest removing implemented features, simplicity applies to CODE not FEATURES
- Outputs P1/P2/P3 findings

### 2. Made all commands stack-agnostic

Each command starts with **Phase 0: Detect Project Context** that reads the project's `CLAUDE.md` to determine:

```
- Tech stack → selects language reviewer agent
- Test command → e.g., npm test, bin/rails test, pytest
- Lint command → e.g., npm run lint, rubocop, ruff
- Type check → e.g., npx tsc --noEmit (if applicable)
- Dev server → e.g., npm run dev, bin/dev
- Database type → determines migration path patterns
```

**Language reviewer selection:**

| Stack | Agent |
|-------|-------|
| TypeScript/JavaScript | `kieran-typescript-reviewer` |
| Ruby/Rails | `kieran-rails-reviewer` |
| Python | `kieran-python-reviewer` |

### 3. Full 7-phase pipeline

```
/brainstorm → /plan → /tech-audit → /work → /code-review → /compound → repeat
```

### Files changed

| File | Action |
|------|--------|
| `commands/tech-audit.md` | Created — post-plan validation |
| `commands/code-review.md` | Created — post-work quality review |
| `commands/full.md` | Rewritten — 7-phase orchestration |
| `commands/brainstorm.md` | Updated — added learnings-researcher |
| `commands/plan.md` | Updated — generic code examples, /tech-audit reference |
| `commands/work.md` | Updated — dynamic agents/commands |
| `commands/compound.md` | Updated — dynamic language reviewer |
| `commands/review.md` | Deleted — replaced by tech-audit + code-review |

## Why This Works

1. **Scope protection via cardinal rules**: By placing explicit "NEVER cut scope" instructions at the top of tech-audit and code-review, agents stay focused on their actual job (feasibility/quality) instead of second-guessing product decisions.

2. **Two-phase review catches issues when they're cheapest to fix**: Architecture problems found in tech-audit (before coding) cost minutes to fix. Found in code-review (after coding) they cost hours.

3. **Stack detection via CLAUDE.md**: Every project already has a CLAUDE.md describing its stack. Reading it dynamically means the same command files work for TypeScript, Rails, Python, or any other stack.

4. **Underlying agents are compound-engineering's**: The orchestration is custom but the agents (kieran-typescript-reviewer, security-sentinel, etc.) come from the compound-engineering plugin, so they improve as the plugin updates.

## Prevention

When setting up a new project to use these commands:

1. Ensure the project's `CLAUDE.md` includes:
   - Tech stack (language, framework, database)
   - Test/lint/typecheck commands
   - Dev server command
2. Create `docs/solutions/` directory for institutional knowledge
3. Add "Workflow Commands" and "Institutional Knowledge" sections to CLAUDE.md

The commands auto-detect everything else from CLAUDE.md.

## Related Issues

No related issues documented yet.
