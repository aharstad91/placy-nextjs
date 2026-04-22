---
module: rapport
date: 2026-04-22
problem_type: architecture_pattern
component: database
severity: medium
applies_when:
  - Rename av felt inne i JSONB-blob mot prod-Supabase (f.eks. products.config.reportConfig.*)
  - Big-bang refactor der kodebase + DB-data må migreres samtidig
  - Refaktor der gammelt legacy-felt og nytt primærfelt begge finnes i schema men bare ett i data
related_components:
  - tooling
  - documentation
tags:
  - jsonb
  - migration
  - runbook
  - supabase
  - postgres
  - refactor
  - terminology
  - pg-dump
  - rollback
---

# Safe JSONB-field-rename mot prod Supabase — runbook-pattern

## Context

Rapport-produktet hadde to tekst-felt per tema med historiske navn fra tidligere iterasjoner: `lowerNarrative` og `extendedBridgeText` (legacy-fallback). Begge kartlagt til samme redaksjonelle rolle ("lead-tekst" — alltid synlig under tittel), men navnene dekket ikke rollen. Datamodellen ligger i `products.config.reportConfig.themes[N].*` som JSONB-blob, med 17 rapport-prosjekter og 65 temaer i prod. Placy er på prototype-stadium (ingen live klient-trafikk, se memory `project_stage_prototype.md`), så kortvarig outage er akseptabelt.

Denne refactoren ga oss et gjenbrukbart pattern for å gjøre slike rename-operasjoner trygt: kode-endringer + SQL JSONB-migrasjon + pg_dump-backup + hardened CASE-SQL + pre/post-count-diff + runbook-scripts som utføres stegvis.

## Guidance

### 1. Hardened CASE-SQL for JSONB-rename

Wrap CASE-branches i `COALESCE(NULLIF(theme->>'field', ''), NULL) IS NOT NULL` for å hoppe forbi tom-string og null. Wrap hele `jsonb_agg(...)`-subquery i `COALESCE(subquery, original_array)` som safety-net. Legg til `jsonb_typeof = 'array'`-guard i WHERE-klausulen mot malformed data.

```sql
BEGIN;

UPDATE products p
SET config = jsonb_set(
  config,
  '{reportConfig,themes}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN COALESCE(NULLIF(theme->>'oldField1', ''), NULL) IS NOT NULL THEN
            (theme - 'oldField1' - 'oldField2')
              || jsonb_build_object('newField', theme->'oldField1')
          WHEN COALESCE(NULLIF(theme->>'oldField2', ''), NULL) IS NOT NULL THEN
            (theme - 'oldField2')
              || jsonb_build_object('newField', theme->'oldField2')
          ELSE theme
        END
      )
      FROM jsonb_array_elements(p.config->'reportConfig'->'themes') AS theme
    ),
    p.config->'reportConfig'->'themes'
  )
)
WHERE p.product_type = 'report'
  AND p.config->'reportConfig'->'themes' IS NOT NULL
  AND jsonb_typeof(p.config->'reportConfig'->'themes') = 'array'
  AND jsonb_array_length(p.config->'reportConfig'->'themes') > 0;

COMMIT;
```

### 2. pg_dump via pooler port 5432 (session-mode)

Supabase pooler kjører to modi: port **6543 (transaction-mode)** for app-queries, og port **5432 (session-mode)** som er nødvendig for pg_dump (transaction-mode rejekter pg_dump's interne COPY-kommandoer). Hvis CLAUDE.md-eksempelet bruker 6543, bytt til 5432 for dump-operasjoner.

```bash
PGPASSWORD="$DATABASE_PASSWORD" \
  /opt/homebrew/Cellar/libpq/17.2/bin/pg_dump \
  -h aws-1-eu-west-1.pooler.supabase.com \
  -p 5432 \
  -U postgres.<project-ref> \
  -d postgres \
  -t <table> \
  --no-owner --no-acl --format=plain \
  > ~/placy-backups/<table>-$(date +%Y-%m-%d-%H%M).sql
```

`--no-owner --no-acl` gjør dump-filen portabel (GRANT-statements peker ellers på project-scoped role som ikke finnes ved restore i annet miljø).

### 3. Runbook som bash-scripts i `scripts/rollback/`

Hvert runbook-steg får sitt eget script med `set -euo pipefail`. Scriptene henter env-vars via `source .env.local`. Navn dem `runbook-NNN-<steg>.sh` (NNN = migrasjonsnummer). Viktige scripts:

| Steg | Script |
|------|--------|
| Test DB-tilkobling | `runbook-NNN-test-connection.sh` |
| pg_dump backup | `runbook-NNN-pg-dump.sh` |
| Pre-count baseline → CSV | `runbook-NNN-pre-count.sh` |
| Dry-run (BEGIN/ROLLBACK) | `runbook-NNN-dry-run.sh` |
| Ekte migrasjon (med y-confirm) | `runbook-NNN-commit.sh` |
| Residual + post-count diff | `runbook-NNN-verify.sh` |

**Pre/post-count-diff** er kritisk — verifiserer at antall non-null felt per rad er identisk før og etter. Fanger silent data-loss som residual-sjekk alene ikke gjør.

### 4. Dry-run før COMMIT

Kjør hele migrasjonen mot prod innenfor `BEGIN; ... ROLLBACK;` først. Dette fanger runtime-exceptions (f.eks. malformed data) som EXPLAIN ikke gjør. Hvis dry-run kaster exception → fix SQL, retry. Bare kjør ekte COMMIT etter clean dry-run.

```sql
BEGIN;
-- full migrasjon
-- (temp verification SELECT som viser endringer)
ROLLBACK;  -- ingen commits
```

### 5. Grep-gate heller enn `tsc --noEmit` alene

TypeScript `as { field?: T }`-casts bypasser kompilatoren. For rename-refaktorer er `rg` den faktiske safety-net-en. Bruk `-t ts` (dekker både `.ts` og `.tsx`) og `-g '!path/to/excluded/*'` for å ekskludere out-of-scope dirs. **`--type tsx` finnes IKKE i rg** — vanlig feil.

```bash
rg -n 'oldField1|oldField2' -t ts -g '!components/excluded-scope/*' components/ lib/ app/ scripts/
# Må returnere 0 hits
```

### 6. Minimal scope for versjonerte Zod-schemas

Hvis et felt ligger i et versjonert Zod-schema (discriminated union på `version: z.literal(N)`), er det kostbart å rename. Krever v+1 med data-migrasjon. For slike felter: la DB-feltnavnet stå, og bruk nytt navn som **lokal variabel i UI-kode** om ønskelig. Premiere ROI kontra versjons-bump-risiko.

## Why This Matters

- **Prod-data-realitet kan avvike fra schema-navn.** I vår refactor antok vi først at "nyere felt" (`lowerNarrative`) var primær, men empirisk query mot prod viste 0 rader med det feltet og 65 med legacy-feltet. `ce-doc-review`s adversarial-persona fanget dette. Verifiser mot ekte data, ikke bare schema, før du skriver migrasjon.
- **`jsonb_set(path, NULL)` skriver NULL stille.** Uten COALESCE-safety-net kan en malformed rad destroye themes-arrayen for den raden uten å trigge exception. Hardenede WHERE-guards og COALESCE fanger dette.
- **Rollback-SQL er lossy når flere kilde-felter mapper til ett mål-felt.** Etter `extendedBridgeText → leadText`-merge kan reverse-SQL ikke vite om data opprinnelig kom fra `extendedBridgeText` eller `lowerNarrative`. Derfor er `pg_dump` primær rollback, reverse-SQL sekundær best-effort.
- **Pooler-mode-kunnskap** sparer tid. "pg_dump henger" er typisk fordi port 6543 bruker transaction-mode som ikke støtter pg_dump's COPY. Å vite 5432-vs-6543-skillet umiddelbart er verdt det.
- **Pre/post-count-diff fanger silent data-loss** som en ren "residual = 0"-sjekk ikke gjør. En rad der CASE falt til ELSE-branch vil passe residual-sjekk selv om data ble korrumpert.

## When to Apply

- Når du renamer JSONB-felt i prod med ≥10 rader
- Når du gjør big-bang refactor der gammelt og nytt navn må skifte samtidig
- Når du har en Supabase-migrasjon som må kjøres manuelt via psql (ikke `supabase db push`)
- Ikke nødvendig for: pure dev-data-endringer, migrasjoner som auto-kjøres via CI, eller rename med transitional-fallback-støtte i kode

## Examples

### Full runbook-kjøring (ca 5 min total tid)

```
$ bash scripts/rollback/runbook-067-test-connection.sh
 connection_ok → 1

$ bash scripts/rollback/runbook-067-pg-dump.sh
Dumpfil OK (267K, 1 COPY).

$ bash scripts/rollback/runbook-067-pre-count.sh
13 rader lagret → pre-count-<timestamp>.csv
Sum: 65 temaer med lead-kilde.

$ bash scripts/rollback/runbook-067-dry-run.sh
BEGIN; UPDATE 13; ROLLBACK;
should_be_zero_after_rollback=0, should_be_65=65

$ bash scripts/rollback/runbook-067-commit.sh
BEGIN; UPDATE 13; COMMIT;

$ bash scripts/rollback/runbook-067-verify.sh
Residual: 0 rader (OK)
Pre/post-count diff: kun kolonne-header (OK)
```

### Faktiske filer fra denne refactoren

- `supabase/migrations/067_rename_narrative_to_lead.sql` — forward-migrasjon
- `scripts/rollback/067_rename_narrative_to_lead.rollback.sql` — best-effort reverse-SQL
- `scripts/rollback/runbook-067-*.sh` — seks runbook-scripts
- `docs/brainstorms/2026-04-22-leadtext-refactor-brainstorm.md` — brainstorm med scope-beslutninger
- `docs/plans/2026-04-22-001-refactor-leadtext-rename-plan.md` — plan med 7 implementation units og runbook
