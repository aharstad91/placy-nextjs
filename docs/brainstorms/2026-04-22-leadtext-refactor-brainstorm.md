---
date: 2026-04-22
topic: leadtext-refactor
related:
  - docs/brainstorms/2026-04-19-unified-grounded-narrative-brainstorm.md
  - docs/brainstorms/2026-04-10-transport-narrative-split-brainstorm.md
---

# Refactor: lowerNarrative → leadText

## Bakgrunn

Rapport-produktet har i dag to tekst-felt per tema som visuelt oppfører seg helt likt (samme styling, samme inline POI-chips), men som spiller forskjellig redaksjonell rolle:

- **Lead** (alltid synlig under tittel): i kode `theme.lowerNarrative ?? theme.extendedBridgeText`.
- **Body** (bak "Les mer"-disclosure): `theme.grounding.curatedNarrative` (v2) eller `theme.grounding.narrative` (v1).

Feltnavnene er tekniske artefakter fra tidligere iterasjoner. `upperNarrative`/`lowerNarrative` kommer fra et transport-spesifikt kart-layout (migrasjon 051). `extendedBridgeText` er en enda tidligere iterasjon. I utvikler-samtale og kode-review forvirrer navnene fordi de ikke reflekterer rollen teksten spiller.

**Prod-data-realitet (verifisert 2026-04-22):** 0 rader har `lowerNarrative` satt. 65 temaer (på tvers av 13 prosjekter, inkl. Wesselsløkka, Brøset, Stasjonskvartalet) har kun `extendedBridgeText`. `lowerNarrative` ble satt på Wesselsløkka-transport i migrasjon 051, men senere skill-kjøringer (som skriver `extendedBridgeText` per nåværende SKILL.md) har overskrevet feltet. I praksis renamer denne refaktoren `extendedBridgeText` → `leadText`; `lowerNarrative`-branchen i migrasjons-CASE er defensiv mot framtidige data, ikke aktiv i dag.

## Beslutning

**Rename `lowerNarrative` → `leadText`.** Fjern `extendedBridgeText` fullstendig som en del av samme operasjon. Big-bang rollout i én commit med tilhørende Supabase data-migrasjon.

### Hva IKKE endres (bevisst ut av scope)

- **`upperNarrative`** beholdes uendret. Transport-spesifikk, representerer en distinkt posisjon (over kart-widget) ikke bare en "lead-tekst". Endring her øker scope uten tilsvarende gevinst.
- **`theme.grounding.narrative` / `theme.grounding.curatedNarrative`** beholdes uendret. Disse ligger i et versjonert Zod-schema (`groundingVersion: z.literal(1|2)`). Rename ville kreve v3-migrasjon — høy kostnad, lav ROI. UI-kode kan bruke `bodyText` som lokal variabel-navn uten å endre feltnavnet i datamodellen.
- **Story-produktet** (`components/variants/story/`). Ikke aktivt i prod. Vi aksepterer at story slutter å rendre tekst etter migrasjonen. Når story aktiveres igjen, må det oppdateres separat.
- **Historiske migrasjoner og brainstorm/plan-dokumenter.** Append-only historikk. Ikke omskriv.

## Komplett fil-liste

Dette er "alt som skal røres" — listen er bevisst komplett så ingenting glemmes (CLAUDE.md "Ferdig betyr ferdig").

### Produksjonskode — TypeScript

| Fil | Endring |
|-----|---------|
| `lib/types.ts:281` | `lowerNarrative?: string` → `leadText?: string` på `ReportThemeConfig` |
| `components/variants/report/report-data.ts:98-99` | Fjern `extendedBridgeText?: string`, bytt `lowerNarrative?: string` → `leadText?: string` |
| `components/variants/report/report-data.ts:550-551` | Fjern `extendedBridgeText`-linjen, bytt `lowerNarrative` → `leadText` i transform |
| `components/variants/report/report-themes.ts:13-14` | Fjern `extendedBridgeText?: string`, bytt `lowerNarrative?: string` → `leadText?: string`. Oppdater kommentar på linje 27. |
| `components/variants/report/ReportThemeSection.tsx:133-137` | Fjern fallback-logikk. `theme.lowerNarrative ?? theme.extendedBridgeText` → `theme.leadText`. Oppdater kommentar. Variabelnavn `lowerText` → `leadText`. |

### Database — ny Supabase-migrasjon

| Fil | Innhold |
|-----|---------|
| `supabase/migrations/067_rename_narrative_to_lead.sql` | JSONB UPDATE mot `products.config.reportConfig.themes[]`. For hver tema-entry: kopier `lowerNarrative` → `leadText` (hvis finnes og non-empty), ellers kopier `extendedBridgeText` → `leadText`. Deretter slett begge gamle felter. Guarded mot NULL/empty/malformed themes-array. |

**Kjøres i work-fasen mot prod via psql** (se CLAUDE.md Supabase-seksjon). Må verifiseres med before/after SELECT (pre-count lagret før migrasjon, diff etter).

**Pre-migrasjon backup:** Kjør `pg_dump -t products` til fil utenfor repo FØR 067 kjøres. Supabase PITR er fallback, men eksplisitt dump gir raskere restore.

### Skill-filer og referanser

| Fil | Endring |
|-----|---------|
| `.claude/skills/generate-rapport/SKILL.md` | Grep-sveip: alle forekomster av `extendedBridgeText`/`lowerNarrative` → `leadText`. Post-sjekk: `rg -c 'extendedBridgeText\|lowerNarrative' .claude/skills/generate-rapport/SKILL.md` må returnere 0. |
| `.claude/skills/generate-rapport/references/sj-prinsipper.md` | Samme grep-sveip-mønster. Post-sjekk: 0 hits. |
| `.claude/skills/curator/references/bridge-text-calibration.md` | **Special case for transport-temaet:** filen beskriver `lowerNarrative` som posisjonelt (under kart-widget) i transport-seksjonen. Rename til `leadText` ville blande posisjonell semantikk med redaksjonell "lead"-rolle. Legg til en eksplisitt note: "For transport-temaet representerer `leadText` fortsatt teksten under live-kortene; `upperNarrative` ligger over." Dette bevarer historikk og unngår semantisk drift. Post-sjekk: `rg -c 'lowerNarrative' .claude/skills/curator/` = 0, men kontekst-kommentarer nevner hvor feltet tidligere het `lowerNarrative`. |

### Ikke endres (bevisst)

- `supabase/migrations/049, 051, 052, 053, 054, 055` — historiske, append-only
- `docs/brainstorms/*`, `docs/plans/*`, `docs/solutions/*`, `docs/audits/*` — historisk dokumentasjon
- `WORKLOG.md`, `PROJECT-LOG.md` — historisk logg
- `components/variants/story/` — skippet per scope-beslutning
- `lib/gemini/grounding.ts`, `scripts/curate-narrative.ts` — disse bruker `narrative` i `grounding`-konteksten, ikke lead/body

## Deploy-strategi

**Valgt: accept outage.** Placy er i prototype/demo-stadium uten live klient-trafikk (ingen SLA, ingen betalende brukere på publiserte rapporter). Rekkefølge:

1. Kjør `pg_dump -t products` til sikker lokasjon utenfor repo.
2. Kjør migrasjon 067 mot prod-DB via psql.
3. Verifiser med pre/post-count diff + residual-felt SELECT.
4. Deploy kode-commit (inkl. type-endring, skill-filer, UI).
5. Kall `revalidateTag('product:${customer}_${slug}')` for alle 17 prosjekter (nice-to-have, tvinger ny HTML før 3600-sek TTL utløper).
6. Spot-sjekk 2-3 rapport-URLer i browser.

Potensielt outage-vindu mellom steg 2 og 4 (~1-5 min): gamle kode leser `lowerNarrative ?? extendedBridgeText` → begge undefined → blank lead. Kun cache-miss rammes; Next.js-cache varmer fra siste HTML. Akseptabelt for prototype-stadiet.

## Risiko & mitigeringer

| Risiko | Mitigering |
|--------|-----------|
| Publiserte rapport-prototyper (13 prosjekter, 65 temaer) viser blank lead-seksjon i deploy-vinduet | Akseptert per prototype-status. Gjør steg 2→4 i raskt rekkefølge; unngå cache-purge før deploy er ute. |
| Migrasjon skriver `leadText` med feil verdi ved samtidig outgoing data | CASE-branch bruker `NULLIF(..., '')` — empty string/null-verdier hopper til neste branch. Prod har 0 rader med `lowerNarrative`, men CASE er defensiv mot framtidige data. |
| `jsonb_set(..., subquery)` silent-skriver NULL hvis subquery returnerer NULL (malformed themes) | Wrap subquery i `COALESCE(jsonb_agg(...), NULL)` + WHERE `jsonb_array_length(themes) > 0` AND `product_type = 'report'`. |
| Verifisering fanger ikke silent data-loss i enkelttema | Lagre pre-count (per produkt: antall temaer med tekst) FØR migrasjon. Post-count må være `>=`. Avvik = rollback. |
| Skill-filer blir inkonsistente med kode etter deploy | Oppdater skill-filer i samme commit som kode-endringen. `rg` post-sjekk for 0 hits av gamle navn. |
| Nye rapporter genereres med gammelt feltnavn pga gammel generate-rapport skill | Skill-filer oppdateres som del av refactor. |
| Story-produktet eller andre dead-code-paths crasher | Story er skippet per beslutning. `tsc --noEmit` + `rg -n 'lowerNarrative\|extendedBridgeText' --type ts --type tsx` i code-dirs (ikke docs/, WORKLOG, migrasjoner) må returnere 0 som test-gate. |
| Next.js `unstable_cache` (revalidate=3600) serverer stale HTML i opptil 1 time etter deploy | Kall `revalidateTag('product:${customer}_${slug}')` for alle 17 prosjekter etter steg 4. Ikke kritisk (cache-miss naturlig revalidate innen 3600s), men ryddig og gjør spot-sjekk forutsigbar. |

## Migrasjonsstrategi (DB)

### Runbook (steg-for-steg)

```
1. Ta pg_dump av products-tabellen til fil utenfor repo
2. Kjør pre-count SELECT (lagre output som baseline)
3. Kjør 067_rename_narrative_to_lead.sql i transaksjon
4. Kjør post-count SELECT — diff må være == 0 mot baseline
5. Kjør residual-felt SELECT — må returnere 0 rader
6. Revalidate Next.js cache for alle 17 publiserte prosjekter
7. Curl hver rapport-URL — verifiser lead-tekst i HTML-output
```

### Pre-count baseline

```sql
-- Lagres i fil før migrasjon kjøres
SELECT
  p.id,
  p.project_id,
  (SELECT COUNT(*)
   FROM jsonb_array_elements(p.config->'reportConfig'->'themes') t
   WHERE (t ? 'lowerNarrative' AND COALESCE(NULLIF(t->>'lowerNarrative',''), NULL) IS NOT NULL)
      OR (t ? 'extendedBridgeText' AND COALESCE(NULLIF(t->>'extendedBridgeText',''), NULL) IS NOT NULL)
  ) AS themes_with_lead_source
FROM products p
WHERE p.product_type = 'report'
  AND p.config->'reportConfig'->'themes' IS NOT NULL
  AND jsonb_array_length(p.config->'reportConfig'->'themes') > 0;
```

### Forward-migrasjon

```sql
-- 067_rename_narrative_to_lead.sql
BEGIN;

-- Hardened CASE:
-- - NULLIF mot empty string → hopp til neste branch
-- - jsonb_array_length > 0 guard unngår NULL-subquery
-- - product_type='report' eksplisitt scope
-- - COALESCE beskytter mot jsonb_agg-null
UPDATE products p
SET config = jsonb_set(
  config,
  '{reportConfig,themes}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN COALESCE(NULLIF(theme->>'lowerNarrative', ''), NULL) IS NOT NULL THEN
            (theme - 'lowerNarrative' - 'extendedBridgeText')
              || jsonb_build_object('leadText', theme->'lowerNarrative')
          WHEN COALESCE(NULLIF(theme->>'extendedBridgeText', ''), NULL) IS NOT NULL THEN
            (theme - 'extendedBridgeText')
              || jsonb_build_object('leadText', theme->'extendedBridgeText')
          ELSE theme
        END
      )
      FROM jsonb_array_elements(p.config->'reportConfig'->'themes') AS theme
    ),
    config->'reportConfig'->'themes'  -- fallback: behold original array uendret
  )
)
WHERE p.product_type = 'report'
  AND config->'reportConfig'->'themes' IS NOT NULL
  AND jsonb_array_length(config->'reportConfig'->'themes') > 0;

COMMIT;
```

### Verifisering etter kjøring

```sql
-- Residual-felt må være 0 rader:
SELECT id, project_id
FROM products
WHERE config->'reportConfig'->'themes' @? '$[*].lowerNarrative'
   OR config->'reportConfig'->'themes' @? '$[*].extendedBridgeText';

-- Post-count må være == pre-count per rad:
SELECT
  p.id,
  p.project_id,
  (SELECT COUNT(*)
   FROM jsonb_array_elements(p.config->'reportConfig'->'themes') t
   WHERE COALESCE(NULLIF(t->>'leadText',''), NULL) IS NOT NULL
  ) AS themes_with_lead
FROM products p
WHERE p.product_type = 'report'
  AND p.config->'reportConfig'->'themes' IS NOT NULL;
```

Diff pre/post-output (f.eks. `diff pre.csv post.csv`). Avvik = rollback.

## Rollback-plan

**Primær (trygg):** restore pg_dump fra steg 1. Ren point-in-time recovery.

**Sekundær (best-effort, bare hvis ingen leadText-skrivinger har skjedd etter 067):**

```sql
-- rollback_067.sql — draftes ferdig FØR 067 kjøres
BEGIN;
UPDATE products p
SET config = jsonb_set(
  config,
  '{reportConfig,themes}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN theme ? 'leadText' THEN
          (theme - 'leadText')
            || jsonb_build_object('extendedBridgeText', theme->'leadText')
        ELSE theme
      END
    )
    FROM jsonb_array_elements(p.config->'reportConfig'->'themes') AS theme
  )
)
WHERE p.product_type = 'report'
  AND config->'reportConfig'->'themes' IS NOT NULL;
COMMIT;
```

Merk: rollback gjenoppretter til `extendedBridgeText` (ikke `lowerNarrative`), siden det matcher faktisk prod-state før migrasjon. Hvis skill-filer eller kode er deployet med nye navn, krever rollback også git-revert på kode + skill-endringer.

**Kode-rollback:** `git revert` på commit, redeploy. TS-kompilator fanger alle referanser.

## Test-strategi

- `npx tsc --noEmit` — 0 errors
- `npm run lint` — 0 errors
- `npm test` — alle eksisterende tester passerer
- **Grep-gate (kritisk):** `rg -n 'lowerNarrative|extendedBridgeText' --type ts --type tsx components/ lib/ app/ scripts/` må returnere 0 hits. Grunn: TypeScript `as`-casts i f.eks. `report-data.ts:550-551` bypasser typekompilator — grep er den faktiske safety-net-en. Tilsvarende `rg 'lowerNarrative|extendedBridgeText' .claude/skills/` må returnere 0 (kontekst-kommentarer som nevner historien er OK; gjør manuell gjennomgang).
- Manuelt (lokalt, etter migrasjon): åpne `/eiendom/broset-utvikling-as/wesselslokka/rapport`, `/eiendom/broset-utvikling-as/stasjonskvartalet/rapport`, `/eiendom/broset-utvikling-as/broset/rapport` — verifiser at lead-tekst rendres for alle 7 temaer.
- Database: kjør pre/post-count diff + residual-felt SELECTs.
- **Cache-invalidering etter migrasjon:** kall `revalidateTag('product:${customer}_${slug}')` for alle 17 publiserte prosjekter. Verifiser med `curl -s <url> | grep -c '<h2>'` eller lignende at seksjoner rendres med innhold.

## Neste steg

→ `/ce-plan` over denne brainstormen. Plan må produsere eksakt todo-liste og rekkefølge i henhold til Deploy-strategi-seksjonen: pg_dump → migrasjon 067 → verifisering → kode-commit (types → transform → UI → skill-filer) → revalidateTag → spot-sjekk.
