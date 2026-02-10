---
name: full
description: Full workflow — Brainstorm → Plan → Tech Audit → Work → Code Review → Compound → Repeat
argument-hint: "[feature description or plan file]"
---

# Full Engineering Workflow

Execute a complete engineering cycle with quality gates at every stage.

```
Brainstorm → Plan → Tech Audit → Work → Code Review → Compound → Repeat
                         ↑                    ↑
                    "Kan dette bygges?"    "Er koden riktig?"
                    ALDRI kutt scope       ALDRI kutt scope
```

## Usage

```bash
/full [feature idea]                  # Start from scratch
/full docs/plans/my-plan.md          # Start from existing plan (skips brainstorm/plan)
/full                                 # Continue with current work
```

## Feature Description

<workflow_description> #$ARGUMENTS </workflow_description>

**If empty, ask:** "What would you like to build? Provide a feature idea, or I can continue with existing work in progress."

---

## Phase 1: Brainstorm

**Goal:** Explore the idea and decide WHAT to build

### Determine Starting Point:

1. **Plan file provided** (ends with `.md` in `docs/plans/`):
   - Read the plan file
   - Announce: "Using existing plan: [filename]"
   - Jump to Phase 3 (Tech Audit)

2. **Brainstorm file provided** (ends with `brainstorm.md`):
   - Read brainstorm file
   - Jump to Phase 2 (Plan)

3. **Feature description provided**:
   - Launch brainstorm workflow

4. **No arguments**:
   - Check for recent brainstorms/plans: `ls -lt docs/brainstorms/*.md docs/plans/*.md 2>/dev/null | head -5`
   - Ask: "Start new brainstorm or continue existing work?"

### Execute:

Run `/brainstorm` with the feature description.

**Output:** `docs/brainstorms/YYYY-MM-DD-topic-brainstorm.md`

**Checkpoint:** After brainstorm, ask:
- Proceed to planning
- Refine design further
- Done for now

---

## Phase 2: Plan

**Goal:** Transform brainstorm decisions into actionable plan

### Execute:

Run `/plan` with the brainstorm file.

**Output:** `docs/plans/YYYY-MM-DD-type-description-plan.md`

**Checkpoint:** After plan creation, ask:
- Proceed to tech audit
- Deepen the plan first (`/deepen-plan`)
- Simplify the plan
- Modify the plan

---

## Phase 3: Tech Audit

**Goal:** Validate technical feasibility BEFORE coding

This is where architecture, security, performance, and data integrity risks get caught — while they're cheap to fix.

### Execute:

Run `/tech-audit` with the plan file.

**Key principle:** Tech audit NEVER suggests removing features. It finds risks and proposes mitigations.

**Output:** Audit report with GREEN/YELLOW/RED verdict

**Checkpoint:** Based on verdict:
- **GREEN** → Proceed to work
- **YELLOW** → Update plan with mitigations, then proceed
- **RED** → Must update plan before proceeding

---

## Phase 4: Work

**Goal:** Execute plan and ship feature

### Execute:

Run `/work` with the plan file.

**Includes:**
- Environment setup (branch creation)
- Todo list from plan
- Incremental implementation with tests
- Pattern following from codebase
- Progressive commits

**Quality gates:**
- All tests pass (project's test command)
- Type check passes (if applicable for stack)
- Linting passes (project's lint command)
- All plan checkboxes completed

**Output:**
- Feature branch with commits
- Working, tested code
- Updated plan with completed checkboxes

**Checkpoint:** Verify all work is complete:
- [ ] All todos completed
- [ ] Tests passing
- [ ] Lint passing
- [ ] Feature fully functional

---

## Phase 5: Code Review

**Goal:** Catch bugs and quality issues BEFORE creating PR

### Execute:

Run `/code-review current`

**Key principle:** Code review NEVER suggests removing features. It makes existing code correct, secure, and clean.

**Includes:**
- TypeScript quality review
- Security vulnerability scan
- Performance analysis
- Code simplicity check (code, not features)
- Pattern consistency check
- Automated checks (tsc, lint, tests)

**Output:** P1/P2/P3 findings with fixes

**Checkpoint:** After review:
- Fix P1 issues (must fix)
- Fix all findings
- Create PR
- Proceed to compound

---

## Phase 6: Compound

**Goal:** Document solution for future reference

### Execute:

Run `/compound` with brief context about what was solved.

**Output:** `docs/solutions/[category]/[filename].md`

**Benefits:**
- First time solving → 30 min
- Documented solution → 5 min
- Future lookups → 2 min
- Knowledge compounds

---

## Phase 7: Repeat

**Goal:** Continue shipping

Ask user using **AskUserQuestion tool**:

**Question:** "Feature complete! What's next?"

**Options:**
1. **Start new feature** — Begin /full with new brainstorm
2. **Continue current feature** — More work on same area
3. **Deploy & monitor** — Ship to production
4. **Review documentation** — Check docs/solutions/ entry
5. **Take a break** — Show summary of what was accomplished

---

## Phase 8: Synkroniser til klientmappe

**Goal:** Skriv en kort sesjonslogg til klientmappen slik at klienten har oversikt over hva som er gjort.

### Execute:

1. **Les CLAUDE.md** i prosjektroten og finn verdien for `klientmappe` (en absolutt sti).
   - Hvis `klientmappe` ikke finnes i CLAUDE.md: **si fra til brukeren og hopp over dette steget.**

2. **Åpne `LOG.md`** i klientmappen. Hvis filen ikke finnes, opprett den med overskriften `# Sesjonslogg`.

3. **Legg til en ny entry ØVERST i filen** (nyeste først), rett under overskriften, med dette formatet:

```markdown
## YYYY-MM-DD | Kort beskrivende tittel

- **Gjort:** Punktliste over hva som ble implementert/endret
- **Beslutninger:** Viktige valg som ble tatt (arkitektur, design, verktøy)
- **Neste:** Hva som bør gjøres neste sesjon
- **Solutions skrevet:** Liste over nye filer i docs/solutions/ denne sesjonen
```

4. **Hold det kort** — maks 10-15 linjer. Dette er en oppsummering, ikke en komplett logg.

5. **Bekreft** at LOG.md ble oppdatert.

---

## Workflow State Tracking

```yaml
current_phase: [brainstorm|plan|tech_audit|work|code_review|compound|sync_log|repeat]
feature_description: "[description]"
brainstorm_file: "docs/brainstorms/[filename].md"
plan_file: "docs/plans/[filename].md"
branch_name: "[feature-branch]"
pr_number: "[PR #]"
solution_file: "docs/solutions/[category]/[filename].md"
completed_phases: []
pending_phases: []
```

**Recovery:** If workflow interrupted, check state and resume from last completed phase.

## Key Principles

### Scope is Sacred
- Brainstorm decides WHAT to build
- Plan decides HOW to build it
- Tech Audit validates feasibility — never cuts scope
- Code Review validates quality — never cuts scope

### Ship Complete Features
- Don't move to next phase with half-done work
- Each phase has clear completion criteria
- Better to ship something finished than perfect unfinished work

### Compound Knowledge
- Every solution documented makes future work faster
- Knowledge builds on itself

### Quality at Every Gate
- Tech Audit catches architecture issues early
- Tests and lint during implementation
- Code Review catches bugs before PR
- Incremental validation prevents big surprises

## When to Use

**Use `/full` when:**
- Starting a new feature from scratch
- Requirements need exploration before implementation
- You want end-to-end workflow with validation at every stage

**Don't use `/full` when:**
- Quick bug fix → just use `/work`
- Requirements are crystal clear → skip brainstorm, use `/plan`
- Only need review → use `/tech-audit` or `/code-review`

## Related Commands

- `/brainstorm` — Just ideation phase
- `/plan` — Just planning phase
- `/tech-audit` — Just technical validation
- `/work` — Just implementation phase
- `/code-review` — Just code review phase
- `/compound` — Just documentation phase
- `/deepen-plan` — Enhance plan depth
