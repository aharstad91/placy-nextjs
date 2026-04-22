---
title: "refactor: lowerNarrative → leadText, fjern extendedBridgeText"
type: refactor
status: active
date: 2026-04-22
origin: docs/brainstorms/2026-04-22-leadtext-refactor-brainstorm.md
---

# refactor: lowerNarrative → leadText, fjern extendedBridgeText

## Overview

Rename `theme.lowerNarrative` og `theme.extendedBridgeText` til én konsolidert `theme.leadText` i rapport-produktet. Omfatter datamodell (TS-types), transform-lag, UI-komponent, tre skill-filer, og én Supabase-migrasjon som flytter feltnavn i prod JSONB. `theme.grounding.narrative`/`curatedNarrative` og `theme.upperNarrative` er bevisst uendret (se origin: `docs/brainstorms/2026-04-22-leadtext-refactor-brainstorm.md`).

## Problem Frame

Rapport-temaer har i dag to tekst-felt som visuelt oppfører seg identisk (samme styling, samme POI-chips) men bærer forskjellig redaksjonell rolle: **lead** (alltid synlig under tittel) og **body** (bak "Les mer"-disclosure). Lead-feltet heter `lowerNarrative` med `extendedBridgeText` som legacy-fallback — begge er historiske tekniske artefakter. I prod-data har 65 temaer på tvers av 13 prosjekter kun `extendedBridgeText` satt; 0 har `lowerNarrative`. I praksis renamer denne refactoren `extendedBridgeText` → `leadText`. Deploy-strategi er "accept outage" siden Placy er i prototype/demo-stadium (memorisert som project-fact).

## Requirements Trace

- **R1.** `theme.lowerNarrative` og `theme.extendedBridgeText` er borte fra TS-types og rapport-produktets kode etter refactor (verifiseres med grep-gate som ekskluderer `components/variants/story/`).
- **R2.** `theme.leadText` erstatter begge, lesing i UI er null-fallback (`theme.leadText` direkte).
- **R3.** Supabase JSONB-data migreres: `products.config.reportConfig.themes[].lowerNarrative` / `.extendedBridgeText` → `.leadText` for alle rader med `product_type='report'`.
- **R4.** Publiserte rapport-prototyper rendrer lead-tekst uendret etter full rollout (Wesselsløkka, Brøset, Stasjonskvartalet verifiseres manuelt; alle 13 rapport-prosjekter med themes-array verifiseres via curl).
- **R5.** Skill-filer (`generate-rapport`, `curator`) refererer til `leadText` i alle prompts, eksempler og kalibreringsreferanser.
- **R6.** Pre-migrasjon backup (`pg_dump`) eksisterer som fil utenfor repo før migrasjon kjøres, verifisert restore-bar før migrasjon starter.
- **R7.** Rollback-SQL er draftet ferdig (med COALESCE safety-net + `jsonb_typeof`-guard) før 067 kjøres.
- **R8.** `upperNarrative` og `grounding.narrative`/`curatedNarrative` er uendret (bevisst out-of-scope).

### Prosjekt-telling (data-realitet)

Prod inneholder **17 rader** med `product_type='report'`; av disse har **13** en ikke-tom `themes`-array (de andre 4 har NULL themes). Tall brukt videre i planen:
- **13**: antall rapport-prosjekter som faktisk har lead-tekst og må verifiseres/revalidateres etter migrasjon.
- **17**: totalt antall rapport-rader som berøres av migrasjonen (inkl. de 4 med tomme themes — UPDATE er no-op for dem fordi WHERE-clause har `jsonb_array_length > 0`).

## Scope Boundaries

- `upperNarrative` (transport-spesifikk, over kart-widget) beholdes uendret — asymmetri er akseptert.
- `grounding.narrative` / `grounding.curatedNarrative` beholdes i Zod-schema (v1/v2) — navn er konseptuelt "body" i UI-kode, men DB-feltene renames ikke.
- Story-produktet (`components/variants/story/`) skippes. Etter migrasjon vil story slutte å rendre tekst (prototype-stadium gjør dette akseptabelt).
- Historiske migrasjoner (049, 051, 052, 053, 054, 055) og gamle dokumenter i `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `WORKLOG.md`, `PROJECT-LOG.md` omskrives ikke (append-only historikk).
- `lib/gemini/grounding.ts` og `scripts/curate-narrative.ts` bruker `narrative` i grounding-kontekst, ikke i lead/body-kontekst — ikke berørt.

### Deferred to Separate Tasks

- Story-produkt-oppdatering til `leadText`: må gjøres når story aktiveres igjen. Ikke del av denne refactoren.
- Eventuell konsolidering av `upperNarrative` i transport-tema: egen brainstorm hvis nødvendig.

## Context & Research

### Relevant Code and Patterns

- `lib/types.ts:280-281` — `ReportThemeConfig`-interface; `lowerNarrative?: string` ligger der, `extendedBridgeText` er IKKE i hovedtypen men i `report-data.ts`.
- `components/variants/report/report-data.ts:98-99, 550-551` — transform-lag med ExtendedThemeDef-cast som pakker begge feltnavn ut fra JSONB.
- `components/variants/report/report-themes.ts:13-14, 27` — parallell type-deklarasjon med `extendedBridgeText?: string` + kommentar.
- `components/variants/report/ReportThemeSection.tsx:133-137` — bruksstedet: `theme.lowerNarrative ?? theme.extendedBridgeText` + variabel `lowerText`.
- `supabase/migrations/067_*.sql` — ledig nummer (066 er sist).
- CLAUDE.md Supabase-seksjon for psql-kommando-mønster.

### Institutional Learnings

- `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md` — mønster for Zod-versjonert grounding-schema; relevant for hvorfor vi IKKE renamer `grounding.narrative`.
- Placy-policy "Scope is Sacred" fra CLAUDE.md: refactor-scope er ratifisert i brainstorm, ingen scope-kutting i review-faser.

### External References

Ingen ekstern research gjort — mekanisk refactor, ingen nye patterns.

## Key Technical Decisions

- **Atomisk rename med JSONB-migrasjon (`jsonb_set` + `jsonb_agg` + CASE)**: Rationale — holder alt i ett SQL-statement, gir row-level atomicity uten app-kode-koordinering. Sikres med NULLIF-guards mot empty-string og COALESCE-fallback mot null-subquery.
- **Preferer `lowerNarrative` over `extendedBridgeText` i CASE**: Defensiv — prod har 0 rader med `lowerNarrative`, men fremtidige generasjoner kan bruke det. CASE er no-op i praksis, men robust.
- **`pg_dump` før migrasjon, ikke bare forward/reverse-SQL**: Rationale — reverse-migrasjon er "best effort" (merger-data kan ikke alltid splittes tilbake). `pg_dump` gir tapsfri rollback.
- **Kode-deploy etter migrasjon (ikke atomisk)**: Placy er prototype-stadium; outage-vindu 1-5 min aksepteres (se project-memory `project_stage_prototype.md`).
- **Grep som primær test-gate, ikke bare `tsc --noEmit`**: Rationale — TS-casts i `report-data.ts:550-551` (som `(themeDef as { lowerNarrative?: string }).lowerNarrative`) bypasser typekompilator. Grep mot code-dirs fanger glemte referanser som `tsc` ikke ser.
- **Skill-filer får transport-case-note i `bridge-text-calibration.md`**: Rationale — i den filen er `lowerNarrative` beskrevet som posisjonelt (under live-kortene) for transport. Blind rename ville blande semantikker. Behold rename men legg inn forklarende kontekst-note.

## Open Questions

### Resolved During Planning

- **Migrasjonsnummer:** 067 (066 var sist; verifisert med `ls supabase/migrations/`).
- **Verifiserings-SELECT kolonne:** `project_id`, ikke `slug` (slug finnes på `projects.url_slug`, ikke på `products`).
- **Transport-tema i bridge-text-calibration:** rename, men legg inn kontekst-note som dokumenterer posisjonell semantikk.

### Deferred to Implementation

*(Ingen — alle planbare detaljer er nå i Unit 7's SQL-enumerering.)*

## Implementation Units

- [ ] **Unit 1: Opprett migrasjonsfil 067**

**Goal:** Lag Supabase-migrasjonen som renamer JSONB-felter i `products.config.reportConfig.themes[]`.

**Requirements:** R3

**Dependencies:** Ingen.

**Files:**
- Create: `supabase/migrations/067_rename_narrative_to_lead.sql`

**Approach:**
- BEGIN/COMMIT-transaksjon
- `jsonb_set` på `{reportConfig,themes}` med `jsonb_agg(CASE ... END)`-subquery
- CASE-branches bruker `COALESCE(NULLIF(theme->>'field', ''), NULL) IS NOT NULL` for empty/null-guard
- `COALESCE(subquery, config->'reportConfig'->'themes')` som safety-net mot NULL-subquery
- WHERE-clause: `product_type = 'report' AND jsonb_typeof(config->'reportConfig'->'themes') = 'array' AND jsonb_array_length(config->'reportConfig'->'themes') > 0`
  - `jsonb_typeof = 'array'`-guard hindrer exception på rad der themes er JSONB-objekt (eksisterer ikke i dag, men forsvar mot fremtidig state)
- Kjør med `psql --set=ON_ERROR_STOP=1` slik at første feil aborter hele scriptet
- Hent SQL-kropp verbatim fra origin-brainstorm (se "Forward-migrasjon"-blokken), men oppdater WHERE-clause per over

**Patterns to follow:**
- Tidligere JSONB-migrasjoner for `products`-tabellen: `supabase/migrations/053_ai_links_barn_mat_natur.sql`, `055_shorten_ai_link_labels.sql`.

**Test scenarios:**
- Happy path: `BEGIN; <full migrasjon>; ROLLBACK;` mot prod via direkte port (5432); verifiser at query planner ikke kaster exception og at post-count SELECT viser forventede endringer (uten commit).
- Edge case: rad med `themes: []` (tom array) — WHERE-clause ekskluderer, ingen endring.
- Edge case: rad uten `reportConfig`-key — WHERE-filter ekskluderer.
- Error path: rad med `themes` som JSONB-objekt (syntetisk test mot lokal dev-DB; ingen slike i prod) — `jsonb_typeof`-guard ekskluderer, ingen exception.
- Happy path real data: etter rollback-dry-run, kjør ekte migrasjon, spot-check at Brøset + Wesselsløkka + Stasjonskvartalet themes har `leadText` og har mistet `lowerNarrative`/`extendedBridgeText`.

**Verification:**
- Syntaks- og runtime-validering: `psql -f 067.sql` med `BEGIN;` i toppen byttet til kjør + `ROLLBACK;` i stedet for `COMMIT;` — kjører hele migrasjonen mot prod uten å committe. Hvis den lykkes uten exception, så er SQL-en runtime-korrekt.
- Post-migrasjon (etter ekte COMMIT): residual-SELECT returnerer 0 rader.

- [ ] **Unit 2: Draft rollback-SQL**

**Goal:** Lag rollback-SQL klar før 067 kjøres. Plasser utenfor `supabase/migrations/` for å unngå at den auto-kjøres av fremtidige CLI-verktøy.

**Requirements:** R7

**Dependencies:** Unit 1 (rollback-logikk speiler forward).

**Files:**
- Create: `scripts/rollback/067_rename_narrative_to_lead.rollback.sql`

**Approach:**
- Reverser: `leadText` → `extendedBridgeText` (matcher prod-state før migrasjon, der `extendedBridgeText` var primærfeltet).
- Samme CASE-guard-mønster som forward: `COALESCE(NULLIF(theme->>'leadText', ''), NULL) IS NOT NULL`.
- **Wrap subquery i `COALESCE(subquery, config->'reportConfig'->'themes')`** (safety-net mot NULL-subquery — forward-migrasjonen har dette, rollback må også ha det).
- Samme WHERE-guards som forward: `product_type = 'report' AND jsonb_typeof(...) = 'array' AND jsonb_array_length(...) > 0`.
- Header-kommentar: "Primær rollback er `pg_dump`-restore fra sikker fil. Denne SQL er sekundær best-effort hvis ingen `leadText`-skrivinger har skjedd etter 067. Hvis skill-filer eller kode er deployet med nye navn, kjør `git revert` på kode + skill-endringer FØR denne SQL."

**Patterns to follow:**
- Hent rollback-SQL skjelett fra origin-brainstorm (se "Rollback-plan / Sekundær"-blokken), men legg til COALESCE og jsonb_typeof-guard.

**Test scenarios:**
- Happy path: kjør forward 067 mot lokal dev-DB (dump fra prod), deretter rollback, verifiser at `extendedBridgeText` er tilbake med identisk innhold.
- Error path: syntetisk rad med themes-objekt (ikke array) — guard skal ekskludere uten exception.

**Verification:**
- `BEGIN; <rollback-SQL>; ROLLBACK;` mot prod validerer runtime uten commit.
- Lokal roundtrip (forward → rollback → diff-sjekk mot baseline) fungerer.

- [ ] **Unit 3: Endre TypeScript-type (lib/types.ts)**

**Goal:** Rename `lowerNarrative?: string` til `leadText?: string` på `ReportThemeConfig`.

**Requirements:** R1, R2

**Dependencies:** Ingen (kan gjøres først for å la kompilator guide resten).

**Files:**
- Modify: `lib/types.ts` (linje ~281)
- Test: N/A — type-definition, verifiseres via `tsc` og downstream-units.

**Approach:**
- Ett felt-rename. Ingen semantikkendringer i typen.
- `lib/types.ts` har IKKE `extendedBridgeText` (det er bare i `report-data.ts` og `report-themes.ts`), så ingen sletting her.

**Test scenarios:**
- Test expectation: none — pure type rename; kompilasjon verifiseres samlet etter alle kode-units.

**Verification:**
- `npx tsc --noEmit` etter alle kode-units skal være 0 errors.

- [ ] **Unit 4: Oppdater transform-lag (report-data.ts, report-themes.ts)**

**Goal:** Fjern `extendedBridgeText`-felt og rename `lowerNarrative` → `leadText` i transform-filer.

**Requirements:** R1, R2

**Dependencies:** Unit 3 (types først så kompilator kan guide).

**Files:**
- Modify: `components/variants/report/report-data.ts` (linje ~98-99 for felt-deklarasjon, ~550-551 for transform-cast)
- Modify: `components/variants/report/report-themes.ts` (linje ~13-14 for felt-deklarasjon, ~27 kommentar)

**Approach:**
- `report-data.ts:98-99`: fjern `extendedBridgeText?: string`, rename `lowerNarrative?: string` → `leadText?: string`.
- `report-data.ts:550-551`: fjern cast-linjen `extendedBridgeText: (themeDef as { extendedBridgeText?: string }).extendedBridgeText,` og rename cast-linjen for `lowerNarrative` → `leadText`.
- `report-themes.ts:13-14`: samme felt-endringer.
- `report-themes.ts:27`: oppdater kommentar som ramser opp editorial fields (fjern extendedBridgeText).

**Patterns to follow:**
- Transform-cast-mønsteret `(themeDef as { field?: string }).field` beholdes — bare feltnavnet endres.

**Test scenarios:**
- Test expectation: none — mekanisk rename; downstream-bruk verifiseres i Unit 5 og integrasjon.

**Verification:**
- `npx tsc --noEmit` — 0 errors etter Unit 5.
- Lokal grep-sjekk for disse to filene: `rg 'extendedBridgeText|lowerNarrative' components/variants/report/report-data.ts components/variants/report/report-themes.ts` skal returnere 0 hits.
- Full grep-gate (hele code-base, med story-ekskludering) kjøres i Unit 7 steg 1 som blokkerende pre-deploy-check.

- [ ] **Unit 5: Oppdater UI-komponent (ReportThemeSection.tsx)**

**Goal:** Fjern fallback-logikk `theme.lowerNarrative ?? theme.extendedBridgeText` og bruk `theme.leadText` direkte.

**Requirements:** R2, R4

**Dependencies:** Unit 3, Unit 4.

**Files:**
- Modify: `components/variants/report/ReportThemeSection.tsx` (linje ~133-137)

**Approach:**
- Bytt `const lowerText = theme.lowerNarrative ?? theme.extendedBridgeText;` til `const leadText = theme.leadText;` (variabelnavn matcher feltet).
- Oppdater kommentar over (linje 133) fra "Falls back to extendedBridgeText for backward compat" til "Lead text — always visible below title".
- Finn alle referanser til `lowerText`-variabel med `rg -n '\blowerText\b' components/variants/report/ReportThemeSection.tsx` og oppdater hver. Post-sjekk: samme grep skal returnere 0 hits.

**Patterns to follow:**
- `linkPOIsInText(leadText, theme.allPOIs)` (samme funksjon, bare ny variabel).

**Test scenarios:**
- Happy path: lokal dev-server, åpne Wesselsløkka-rapport, lead-tekst rendres under tittel for alle 7 temaer.
- Edge case: tema uten `leadText` (f.eks. pre-migrasjon dev-data) — `segments`-array blir tom, ingen crash.

**Verification:**
- Lokalt: rapport-URL rendrer lead-tekst uten feil i konsoll.
- `npx tsc --noEmit` og `npm run lint` — 0 errors.
- `rg -n '\blowerText\b' components/` returnerer 0 hits.

- [ ] **Unit 6: Oppdater skill-filer**

**Goal:** Grep-sveip over tre skill-filer; `extendedBridgeText`/`lowerNarrative` → `leadText`. Special-case note i bridge-text-calibration for transport.

**Requirements:** R5

**Dependencies:** Ingen (parallellisérbar med units 3-5).

**Files:**
- Modify: `.claude/skills/generate-rapport/SKILL.md`
- Modify: `.claude/skills/generate-rapport/references/sj-prinsipper.md`
- Modify: `.claude/skills/curator/references/bridge-text-calibration.md`

**Approach:**
- `SKILL.md`: grep-sveip. Alle forekomster av `extendedBridgeText` og `lowerNarrative` → `leadText`. Forvent ~9+ forekomster.
- `sj-prinsipper.md`: samme sveip; ~2 forekomster.
- `bridge-text-calibration.md`:
  - Sveip `extendedBridgeText` → `leadText`.
  - For transport-seksjonen: i stedet for å beholde gamle feltnavn i noten, skriv en rent posisjonell beskrivelse: "For transport-temaet rendres `leadText` posisjonelt under live-kortene (bil/bildeling/tog/flybuss). Teksten som rendres over live-kortene — fortsatt kjent som `upperNarrative` i datamodellen — er uendret av denne refactoren."
  - Fjern "fallback"-note som ikke lenger er relevant.
  - Dette lar grep-gate returnere 0 hits absolutt — ingen historikk-allowlist behøves.

**Patterns to follow:**
- Skill-filer skriver markdown — ingen kode-syntaks-endringer.

**Test scenarios:**
- Test expectation: none — dokumentasjonsendring; verifiseres via grep.

**Verification:**
- `rg -n 'lowerNarrative|extendedBridgeText' .claude/skills/` returnerer **0 hits absolutt** (ingen historikk-allowlist; alle forekomster er enten renamed eller formulert posisjonelt uten feltnavn-referanse).

- [ ] **Unit 7: Kjør runbook mot prod**

**Goal:** Eksekver deploy-strategien fra brainstormens "Deploy-strategi"-seksjon. Runbooken nedenfor er den autoritative rekkefølgen (planen, ikke brainstormen, er kanonisk siden planen har noen hardening-steg brainstormen ikke har — f.eks. pg_dump-verifisering og grep-gate).

**Requirements:** R3, R4, R6

**Dependencies:** Units 1-6 ferdig, merged til local branch, alle lokale tester passert (grep-gate, tsc, lint).

**Files:**
- Execute: `supabase/migrations/067_rename_narrative_to_lead.sql` via psql mot prod
- Execute: `pg_dump` på products-tabellen (direkte port, ikke pooler)
- Execute: kode-deploy (commit + push)

**Execution note:** Ingen shortcuts. Hver gate må passere før neste steg.

**Approach (runbook — autoritativ rekkefølge):**

1. **Pre-deploy grep-gate** *(blokkerende)*:
   - `rg -n 'lowerNarrative|extendedBridgeText' --type ts --type tsx --glob '!components/variants/story/**' components/ lib/ app/ scripts/` = 0 hits
   - `rg -n 'lowerNarrative|extendedBridgeText' .claude/skills/` = 0 hits
   - `rg -n '\blowerText\b' components/` = 0 hits
   - Hvis noen av disse har hits, fix før runbook fortsetter.

2. **Pre-migrasjon migrasjonsnummer-collision-check** *(blokkerende)*:
   - `ls supabase/migrations/067_*.sql` — hvis flere filer, migrasjons-nummer har kollidert med en annen branch som er merged. Bump til neste ledig nummer, oppdater filnavn + referanser i planen.

3. **pg_dump** *(blokkerende)*:
   - Bruk direkte Postgres-port (5432), ikke pooler (6543). Se CLAUDE.md Supabase-seksjon for kommando-mønster; modifiser connection string til port 5432.
   - Kommando: `pg_dump -t products --no-owner --no-acl --format=plain "${DIRECT_DB_URL}" > ~/placy-backups/products-$(date +%Y-%m-%d-%H%M).sql`
   - Verifiser: `test -s ~/placy-backups/products-*.sql && head -n 20 ~/placy-backups/products-*.sql | grep -q 'PostgreSQL database dump'`
   - Hvis assertion feiler, abort hele runbook.

4. **Pre-count baseline**:
   - Kjør pre-count SELECT fra brainstorm mot prod; skriv til `~/placy-backups/pre-count-$(date +%Y-%m-%d-%H%M).csv`.
   - Assertion: minst 13 rader (tilsvarer antallet rapport-prosjekter med themes-array).

5. **Dry-run migrasjon** *(blokkerende)*:
   - `BEGIN; <full migrasjon fra 067.sql>; ROLLBACK;` mot prod via psql — dette kjører hele UPDATE mot ekte data uten commit, fanger runtime-exceptions.
   - Hvis exception, fix SQL, re-dry-run.

6. **Ekte migrasjon**:
   - `psql --set=ON_ERROR_STOP=1 -f supabase/migrations/067_rename_narrative_to_lead.sql "${DATABASE_URL}"`
   - Hvis exit-code != 0, abort.

7. **Verifisering** *(blokkerende)*:
   - Residual-SELECT: må returnere 0 rader.
   - Post-count SELECT: skriv til `post-count.csv`, `diff pre-count.csv post-count.csv` må vise at `themes_with_lead` ≥ `themes_with_lead_source` for hver rad.
   - Spot-sjekk på innhold (ikke bare presence): `SELECT jsonb_path_query_array(config->'reportConfig'->'themes', '$[*].leadText') FROM products WHERE project_id = 'broset-utvikling-as_wesselslokka'` — verifiser at resultatet er 7 ikke-tomme strenger.
   - Hvis noe avvik: rollback fra pg_dump, undersøk, fix.

8. **Kode-deploy**:
   - Commit units 3-6, push til main, vent til Vercel-deploy er grønn.

9. **Bygg revalidateTag-liste** *(konkret SQL — ikke deferred)*:
   ```sql
   SELECT
     pr.project_id,
     pj.customer_id,
     pj.url_slug
   FROM products pr
   LEFT JOIN projects pj ON pr.project_id = pj.id
   WHERE pr.product_type = 'report'
     AND pr.config->'reportConfig'->'themes' IS NOT NULL
     AND jsonb_array_length(pr.config->'reportConfig'->'themes') > 0;
   ```
   - Forvent 13 rader. Lagre som `revalidate-list.csv`.

10. **Kjør revalidateTag for hver rad** *(bruk /api/revalidate, ikke /api/admin/revalidate)*:
    - For hver rad i `revalidate-list.csv`: `curl -s "${SITE_URL}/api/revalidate?tag=product:${customer_id}_${url_slug}&secret=${REVALIDATE_SECRET}"`.
    - Verifiser at `SITE_URL` peker til prod Vercel URL, ikke localhost. Loop logger hver success/fail.
    - Forvent 13 vellykkede kall. Hvis noen feiler, noter og re-kjør de feilende.
    - `/api/admin/revalidate` er IKKE riktig her — det støtter kun `paths[]`, ikke per-tag-invalidering.

11. **Automatisk innholds-verifisering for alle 13 prosjekter**:
    - For hver rad i `revalidate-list.csv`: `curl -s "${SITE_URL}/eiendom/${customer_id}/${url_slug}/rapport" | grep -c '<h2>'` skal returnere ≥ 7 (ett h2 per tema). Hvis mindre, flagg prosjektet for manuell review.
    - Placy-policy: "Full dekning, aldri sampling" — 13 av 13 må verifiseres, ikke bare 3.

12. **Manuell spot-sjekk (visuell)**:
    - Åpne `/eiendom/broset-utvikling-as/wesselslokka/rapport`, `/eiendom/broset-utvikling-as/stasjonskvartalet/rapport`, `/eiendom/broset-utvikling-as/broset/rapport` — visuell verifisering av at lead-tekst faktisk rendres pent for alle 7 temaer.

13. **Post-runbook**: Rotate `REVALIDATE_SECRET` i `.env.local` og Vercel-config fordi secreten har blitt logget 13 ganger i Vercel request-logs (pre-eksisterende pattern — se SEC-005 fra review).

**Test scenarios:**
- Happy path: alle 13 rapport-URLer viser lead-tekst (verifisert via curl-grep i steg 11).
- Error path: pg_dump feiler i steg 3 → runbook aborter, ingen migrasjon kjørt.
- Error path: dry-run i steg 5 kaster exception → ingen commit, fix SQL.
- Error path: post-count diff viser avvik → rollback fra pg_dump, undersøk, retry.
- Error path: revalidateTag-kall feiler for enkeltprosjekt → noter, re-kjør, om fortsatt feil: manuell cache-invalidering.

**Verification:**
- Grep-gates passerer (steg 1).
- pg_dump-fil eksisterer og er ikke-tom (steg 3).
- Pre/post-count diff OK (steg 7).
- Alle 13 curl-grep-verifiseringer OK (steg 11).
- 3 manuelle rapport-URLer ser pene ut (steg 12).
- REVALIDATE_SECRET rotert (steg 13).

## System-Wide Impact

- **Interaction graph:** `ReportThemeSection` konsumerer `theme.leadText`. Ingen callbacks eller middleware berørt.
- **Error propagation:** Hvis `leadText` mangler (f.eks. dev-data uten migrasjon), blir `segments`-array tom og `<div>` rendrer ikke — ikke crash.
- **State lifecycle risks:** JSONB-migrasjon er atomisk per row. Partial-write ikke mulig innen én row. Mellom rader er det ingen invariant som brytes siden `product_type='report'`-rader er uavhengige.
- **API surface parity:** Ingen ekstern API-endring. `GET /eiendom/.../rapport` er server-rendered med data fra Supabase.
- **Integration coverage:** Grep-gate + manuell rapport-URL-sjekk dekker integrasjonen kode → data.
- **Unchanged invariants:**
  - `theme.upperNarrative` er uendret.
  - `theme.grounding.narrative` og `theme.grounding.curatedNarrative` er uendret (Zod-schema bevart).
  - `theme.bridgeText` (subtittel-intro) er uendret — IKKE det samme som "body"; den ligger fortsatt over lead-tekst.
  - Gemini-grounding-kontrakten og Google ToS-behandlingen er ikke berørt.
  - Story-produktet endres ikke (skippet per scope).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `jsonb_set(..., null)` silent-skriver NULL ved malformed themes | COALESCE-fallback i subquery bevarer original array; WHERE-guards mot `jsonb_typeof != 'array'` og `jsonb_array_length = 0`. |
| TS-casts (`as { ... }`) skjuler glemte referanser for kompilator | Grep-gate mot code-dirs er primær test-verifisering. `--glob '!components/variants/story/**'` ekskluderer ut-av-scope story-filer. |
| Publiserte rapport-prototyper viser blank lead i deploy-vinduet | Akseptert per prototype-status (se memory `project_stage_prototype.md`). Migrasjon → deploy i rask rekkefølge. Automatisk curl-grep-verifisering for alle 13 prosjekter etter revalidateTag. |
| Rollback-SQL er lossy (leadText → extendedBridgeText, ikke lowerNarrative) | Primær rollback er pg_dump-restore (verifisert som ikke-tom fil før migrasjon kjøres); reverse-SQL er sekundær best-effort med samme COALESCE-guard som forward. |
| Skill-filer oppdatert men ny rapport-generering skriver fortsatt gammelt felt | Sveip over `SKILL.md`, `sj-prinsipper.md`, `bridge-text-calibration.md` er del av samme commit som kode-endring. Grep-gate verifiserer 0 hits absolutt (ingen historikk-allowlist). |
| Story-produktet (out-of-scope) rendrer blank tekst etter migrasjon | Akseptert per scope-beslutning. Ekskludert eksplisitt fra grep-gate. TODO for fremtidig aktivering av story. |
| pg_dump via pooler (port 6543) kan gi tom dump pga pgBouncer transaction-mode | Runbook spesifiserer direkte port 5432 + `--no-owner --no-acl`. Dump-størrelse verifiseres før migrasjon kjøres. |
| REVALIDATE_SECRET logget i Vercel request logs pga GET-query (pre-eksisterende) | Rotate secret etter runbook er ferdig. Langsiktig: flytt til Authorization-header i `/api/revalidate` (separat task). |
| revalidateTag treffer 13 prosjekter men bare 3 spot-sjekkes visuelt | Automatisk curl-grep-sjekk i steg 11 dekker alle 13. Full dekning per CLAUDE.md. |
| Migrasjonsnummer 067 kan kollidere hvis annen branch merges først | Eksplisitt collision-check i runbook steg 2. |

## Documentation / Operational Notes

- Ingen runbook-endringer eller CLAUDE.md-oppdateringer. Migrasjonen følger eksisterende psql-mønster.
- Ingen monitoring-oppsett endret.
- Ingen feature-flagger (ikke brukt i Placy — se CLAUDE.md "Bygg noe nytt som erstatter noe gammelt: SLETT det gamle umiddelbart").

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-22-leadtext-refactor-brainstorm.md](../brainstorms/2026-04-22-leadtext-refactor-brainstorm.md)
- **Relevant patterns:**
  - `supabase/migrations/053_ai_links_barn_mat_natur.sql` — JSONB-UPDATE-mønster
  - `components/variants/report/ReportThemeSection.tsx:133-137` — bruksstedet som endres
  - `lib/types.ts:280-281` — type-definisjon
  - `app/api/revalidate/route.ts` — cache-invaliderings-endpoint som brukes i runbook
  - `scripts/gemini-grounding.ts:~450` — eksisterende mønster for å kalle /api/revalidate iterativt
- **Related memory:** `project_stage_prototype.md` (Placy er prototype/demo-stadium)
- **Placy-policy:** CLAUDE.md "Compound Engineering Plugin — Placy-policies" + "Scope is Sacred"
- **Doc-review:** Gjennomført via `ce-doc-review` i headless-mode; safe_auto og gated_auto-fikser applicert direkte i dokumentet. Residual FYI/P2-funn: migrasjonsnummer-collision (mitigert i runbook steg 2); REVALIDATE_SECRET rotation (mitigert i runbook steg 13).
