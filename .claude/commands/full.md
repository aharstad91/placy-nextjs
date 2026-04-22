---
name: full
description: Full workflow — Brainstorm → Plan → Tech Audit → Work → Code Review → Compound → Repeat (Placy-tuned over compound-engineering 2.68.1)
argument-hint: "[feature description or plan file]"
---

# Full Engineering Workflow (Placy)

Placy-tuned wrapper over compound-engineering-pluginen. Bruker `ce-*`-skillene som motor, men beholder Placy-særegenheter:

- **Tech Audit som eksplisitt gate** før kode skrives (GREEN/YELLOW/RED)
- **Scope is Sacred** — `ce-scope-guardian-reviewer` ekskluderes bevisst fra doc-review
- **AskUserQuestion-checkpoints** mellom hver fase
- **Klientmappe-synk** (LOG.md) til slutt

```
Brainstorm → Plan → Tech Audit → Work → Code Review → Compound → Repeat → Sync
                         ↑                     ↑
                    "Kan dette bygges?"    "Er koden riktig?"
                    ALDRI kutt scope       ALDRI kutt scope
```

## Usage

```bash
/full [feature idea]                  # Start from scratch
/full docs/plans/my-plan.md          # Start from existing plan (skips brainstorm/plan)
/full docs/brainstorms/x-brainstorm.md  # Start from brainstorm (skips brainstorm)
/full                                 # Continue with current work
```

## Feature Description

<workflow_description> #$ARGUMENTS </workflow_description>

**Hvis tom:** "Hva vil du bygge? Gi en feature-idé, eller så kan jeg fortsette med eksisterende arbeid i gang."

---

## Scope is Sacred — les før hver fase

Placy jobber med betalende klienter. Scope er **ratifisert i brainstorming-fasen**, ikke et utkast som skal trimmes senere. Derfor:

- **Tech Audit** vurderer gjennomførbarhet, aldri kutter scope
- **Code Review** vurderer kvalitet, aldri kutter scope
- `ce-scope-guardian-reviewer` brukes **ikke** — den er bygget for Every/Cora (YAGNI-maximalist, stabilt produkt hvor scope er forhandlingsbart). Det er motsatt av vår virkelighet.
- Hvis scope må endres, gå tilbake til brainstorm/plan — ikke gjør det i review-fasene.

---

## Phase 1: Brainstorm

**Mål:** Utforsk idéen og bestem HVA som skal bygges.

### Bestem startpunkt

1. **Plan-fil oppgitt** (slutter med `.md` i `docs/plans/`):
   - Les plan-filen
   - Annonser: "Bruker eksisterende plan: [filnavn]"
   - Hopp til **Phase 3 (Tech Audit)**

2. **Brainstorm-fil oppgitt** (slutter med `brainstorm.md`):
   - Les brainstorm-filen
   - Hopp til **Phase 2 (Plan)**

3. **Feature-beskrivelse oppgitt:**
   - Kjør brainstorm

4. **Ingen arguments:**
   - Kjør `ls -lt docs/brainstorms/*.md docs/plans/*.md 2>/dev/null | head -5`
   - Spør via AskUserQuestion: Ny brainstorm eller fortsette eksisterende?

### Execute

Invoke skill `compound-engineering:ce-brainstorm` med feature-beskrivelsen.

**Output:** `docs/brainstorms/YYYY-MM-DD-topic-brainstorm.md`

**Checkpoint (AskUserQuestion):**
- Gå videre til plan
- Utforsk designet videre
- Ferdig for nå

---

## Phase 2: Plan

**Mål:** Gjør brainstorm-beslutninger om til handlingsrettet plan.

### Unngå scope-guardian-triggere (viktig)

`ce-plan` kjører automatisk `ce-doc-review` i Phase 5.3.8 før den returnerer. `ce-doc-review` aktiverer `ce-scope-guardian-reviewer` automatisk hvis planen har:
- >8 implementation units
- P0/P1/P2-tiers (eller must-have/should-have/nice-to-have)
- "Future Work"- eller "Stretch Goals"-seksjon
- Scope boundary-språk som virker misaligned med goals

Før `ce-plan` kalles, instruer den eksplisitt til å:
- Bruke **fasinndeling** (Phase 1/2/3) i stedet for prioritets-tiers
- **Dele planen i flere filer** (`plan-A.md`, `plan-B.md`) hvis total-scope overstiger 8 units
- Legge deferred work under `### Deferred to Separate Tasks` (aldri "Future Work")

### Execute

Invoke skill `compound-engineering:ce-plan` med brainstorm-filen.

Planen skal inneholde:
- Kontekst og krav (fra brainstorm)
- Approach og fil-liste
- Edge cases
- Test-strategi
- Rollback-plan

**Output:** `docs/plans/YYYY-MM-DD-type-description-plan.md`

### Håndtering av scope-guardian-funn fra auto-`ce-doc-review`

Når `ce-plan` kjører sin obligatoriske `ce-doc-review` i 5.3.8:

- **Hvis `ce-scope-guardian-reviewer` blir aktivert** (synlig i "Reviewing with:"-annonseringen), **alle funn fra den agenten skal auto-Skip-es** med begrunnelsen: `"Scope is Sacred — scope ratified in brainstorm phase (see CLAUDE.md Compound Engineering Plugin policy)"`.
- Logg Skip-beslutningen i decision primer slik at scope-guardian ikke re-surfacer samme funn i senere runder.
- **Alle andre persona-reviewers behandles normalt** — feasibility, coherence, security-lens, design-lens, product-lens, adversarial.
- Hvis brukeren får presentert det interaktive menyvalget, velg "per-finding walk-through" og Skip eksplisitt hver scope-guardian-finding med samme begrunnelse. Andre funn vurderes normalt.

**Checkpoint (AskUserQuestion):**
- Gå videre til tech audit
- Deepen planen (be `ce-plan` om deepening pass)
- Forenkle planen
- Modifiser planen

---

## Phase 3: Tech Audit

**Mål:** Valider teknisk gjennomførbarhet FØR koding starter.

Dette er hvor arkitektur-, sikkerhets-, ytelses- og dataintegritetsrisiko fanges — mens de er billige å fikse.

### Forholdet til `ce-doc-review` fra Phase 2

`ce-plan` har allerede kjørt `ce-doc-review` automatisk i 5.3.8 på slutten av Phase 2. Tech Audit **gjenbruker funnene derfra** og gjør en fokusert syntese — **ikke en ny full dokument-review**, med mindre Phase 2 resulterte i vesentlige plan-endringer (da kjøres `ce-doc-review` en gang til med samme policy: scope-guardian-funn auto-Skip-es).

### Execute

1. **Samle funnene** fra `ce-plan`s auto-doc-review (notert som "residual findings" eller "P0/P1 findings" i handoff-output).
2. **Prioriter de tekniske reviewers** for Tech Audit-syntese (ignorer eventuelle scope-guardian-funn per CLAUDE.md-policy):
   - `ce-feasibility-reviewer` — overlever approach-et møtet med virkeligheten?
   - `ce-coherence-reviewer` — intern konsistens, terminologi-drift, uklarheter
   - `ce-security-lens-reviewer` — sikkerhetsgap på plan-nivå
   - `ce-design-lens-reviewer` — manglende design-beslutninger, IA, interaksjonstilstander, AI-slop-risiko
   - `ce-product-lens-reviewer` — strategiske konsekvenser (bare for oversikt; ingen scope-kutting)
   - `ce-adversarial-document-reviewer` (hvis aktivert) — failure-scenarioer mot planen
3. **Hvis nye risikodimensjoner har dukket opp** siden Phase 2 (f.eks. ny integrasjon oppdaget i brainstorm-iterasjon): kjør `ce-doc-review` på nytt på den oppdaterte planen. Samme scope-guardian-policy gjelder.

### Syntese til GREEN/YELLOW/RED

Etter at reviewers har kjørt, syntetiser funnene:

- **GREEN** — Ingen P1-funn. Alt er gjennomførbart med planens approach. → Gå videre til work.
- **YELLOW** — P2-funn eller P1-funn med kjente mitigeringer. → Oppdater planen med mitigeringer, så gå videre.
- **RED** — P1-funn uten klar mitigering. → Må oppdatere planen før work starter.

**Husk:** Alle verdikter gjelder *hvordan* vi bygger, ikke *hva*. Funn som sier "drop denne featuren" skal oversettes til "finn annen approach for å levere denne featuren" eller løftes til eksplisitt re-scoping i brainstorm — aldri droppes stille.

**Checkpoint (AskUserQuestion):**
- Basert på verdikt: gå videre / oppdater plan / tilbake til brainstorm

---

## Phase 4: Work

**Mål:** Eksekver planen og ship featuren.

### Execute

Invoke skill `compound-engineering:ce-work` med plan-filen.

Dette dekker:
- Environment setup (branch / worktree via `ce-worktree` ved behov)
- Todo-liste fra planen
- Inkrementell implementering med tester
- Pattern-følging fra kodebasen
- Progressive commits

### Quality gates (må passeres før neste fase)

- `npm test` — alle tester passerer
- `npx tsc --noEmit` — ingen typefeil
- `npm run lint` — 0 errors
- Alle plan-checkboxes fullført
- For UI: manuell verifisering i nettleser (se CLAUDE.md "Output-fokus")

### Supabase-migrasjoner

Migrasjoner er en del av work-fasen. Ikke ferdig før migrasjonen er **kjørt og verifisert mot produksjonsdatabasen**. Se CLAUDE.md for psql-kommandoen.

**Checkpoint:** Verifiser at alt arbeid er komplett:
- [ ] Alle todos fullført
- [ ] Tester passerer
- [ ] Lint/TS passerer
- [ ] Feature fungerer (verifisert, ikke bare "koden ser riktig ut")

---

## Phase 5: Code Review

**Mål:** Fang bugs og kvalitetsissues FØR PR opprettes.

### Execute

Invoke skill `compound-engineering:ce-code-review` på current changes.

Dette spawner 12+ persona-reviewers parallelt:
- `ce-correctness-reviewer` (logikk, edge cases, state-bugs)
- `ce-security-reviewer` (hvis diff rører auth/input/permissions)
- `ce-performance-reviewer` (hvis diff rører DB/loops/I/O)
- `ce-reliability-reviewer` (retries, timeouts, jobs)
- `ce-api-contract-reviewer` (hvis diff rører API/types)
- `ce-data-migrations-reviewer` (hvis diff rører schema/migrations)
- `ce-testing-reviewer` (coverage-gap, brittle tests)
- `ce-maintainability-reviewer` (premature abstraction, dead code)
- `ce-project-standards-reviewer` (CLAUDE.md-standarder)
- `ce-kieran-typescript-reviewer` (TS-kvalitet)
- `ce-julik-frontend-races-reviewer` (hvis diff rører async UI)
- `ce-cli-readiness-reviewer` (hvis diff rører CLI)

**Scope-policy:** Review vurderer kvalitet på eksisterende kode, aldri kutter feature-scope. Funn som sier "fjern denne funksjonaliteten" skal oversettes til "implementer denne funksjonaliteten riktig".

**Output:** P1/P2/P3-funn med fikser.

### Resolve findings parallelt

Invoke skill `compound-engineering:ce-resolve-pr-feedback` for å fikse P1-funnene parallelt. P1s først, deretter P2s. Vurder P3s basert på tid.

**Checkpoint (AskUserQuestion):**
- Alle P1 fikset → opprett PR
- Gå videre til compound
- Manuell overstyring av funn

---

## Phase 6: Compound

**Mål:** Dokumenter løsningen for fremtidig referanse.

### Execute

Invoke skill `compound-engineering:ce-compound` med kort kontekst om hva som ble løst.

**Output:** `docs/solutions/[category]/[filename].md`

**Vurder også:** Hvis vi oppdaget at en eksisterende solution-doc er utdatert, trigger `compound-engineering:ce-compound-refresh` med den spesifikke filen som scope.

**Gevinster:**
- Første gang løst → 30 min
- Dokumentert løsning → 5 min
- Fremtidig oppslag → 2 min

---

## Phase 7: Repeat

**Mål:** Fortsett å shippe.

Spør via AskUserQuestion-tool:

**Question:** "Feature komplett! Hva nå?"

**Options:**
1. **Ny feature** — start `/full` med ny brainstorm
2. **Fortsett current feature** — mer arbeid i samme område
3. **Deploy & monitor** — ship til prod
4. **Review documentation** — sjekk docs/solutions/-entry
5. **Ta en pause** — vis summary av det som ble gjort

---

## Phase 8: Synkroniser til klientmappe

**Mål:** Skriv en kort sesjonslogg til klientmappen slik at klienten har oversikt.

### Execute

1. **Les CLAUDE.md** i prosjektroten og finn `klientmappe`-verdien (en absolutt sti).
   - Hvis `klientmappe` ikke finnes: si fra og hopp over dette steget.

2. **Åpne `LOG.md`** i klientmappen. Hvis filen ikke finnes, opprett med overskrift `# Sesjonslogg`.

3. **Legg til ny entry ØVERST** (nyeste først), rett under overskriften:

```markdown
## YYYY-MM-DD | Kort beskrivende tittel

- **Gjort:** Punktliste over hva som ble implementert/endret
- **Beslutninger:** Viktige valg (arkitektur, design, verktøy)
- **Neste:** Hva som bør gjøres neste sesjon
- **Solutions skrevet:** Liste over nye filer i docs/solutions/
```

4. **Hold det kort** — maks 10–15 linjer. Oppsummering, ikke full logg.

5. **Bekreft** at LOG.md ble oppdatert.

---

## Workflow State Tracking

```yaml
current_phase: [brainstorm|plan|tech_audit|work|code_review|compound|repeat|sync_log]
feature_description: "[beskrivelse]"
brainstorm_file: "docs/brainstorms/[filnavn].md"
plan_file: "docs/plans/[filnavn].md"
tech_audit_verdict: "[GREEN|YELLOW|RED]"
branch_name: "[feature-branch]"
pr_number: "[PR #]"
solution_file: "docs/solutions/[kategori]/[filnavn].md"
completed_phases: []
pending_phases: []
```

**Recovery:** Hvis workflow avbrytes, sjekk state og fortsett fra siste fullførte fase.

---

## Key Principles

### Scope is Sacred
- Brainstorm bestemmer HVA som bygges
- Plan bestemmer HVORDAN
- Tech Audit validerer gjennomførbarhet — aldri kutter scope
- Code Review validerer kvalitet — aldri kutter scope
- `ce-scope-guardian-reviewer` brukes aldri (motsatt filosofi)

### Ship Complete Features
- Gå ikke til neste fase med halvferdig arbeid
- Hver fase har klare fullføringskriterier
- Bedre å shippe noe ferdig enn perfekt uferdig
- Se CLAUDE.md "Ferdig betyr ferdig" — full dekning, aldri sampling

### Compound Knowledge
- Hver dokumentert løsning gjør fremtidig arbeid raskere
- Knowledge bygger på seg selv

### Quality at Every Gate
- Tech Audit fanger arkitektur-issues tidlig
- Tester og lint under implementering
- Code Review fanger bugs før PR
- Inkrementell validering forhindrer store overraskelser

---

## When to Use

**Bruk `/full` når:**
- Ny feature fra scratch
- Krav trenger utforskning før implementering
- Du vil ha end-to-end workflow med validering på hver fase

**Ikke bruk `/full` når:**
- Rask bugfix → bare `ce-work` eller `ce-debug`
- Krav er krystallklare → skip brainstorm, invoke `ce-plan` direkte
- Trenger bare review → `ce-doc-review` (plan) eller `ce-code-review` (kode)

---

## Related ce-* Skills

| Skill | Bruk |
|-------|------|
| `ce-brainstorm` | Bare idéfasen |
| `ce-ideate` | AI foreslår retninger (før brainstorm) |
| `ce-plan` | Bare plan-fasen (inkl. deepening) |
| `ce-doc-review` | Plan-review (ekskluder scope-guardian!) |
| `ce-work` | Bare implementerings-fasen |
| `ce-code-review` | Parallell multi-persona kode-review |
| `ce-resolve-pr-feedback` | Parallell fiksing av review-funn |
| `ce-compound` | Bare dokumentasjons-fasen |
| `ce-compound-refresh` | Refresh utdaterte solution-docs |
| `ce-commit` | Smart commit med repo-konvensjoner |
| `ce-commit-push-pr` | Commit + push + PR i ett |
| `ce-pr-description` | Skriv PR-body |
| `ce-debug` | Root-cause debugging |
| `ce-worktree` | Administrer worktrees for parallelt arbeid |
