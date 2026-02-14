---
module: POI Editorial
date: 2026-02-14
problem_type: best_practice
component: tooling
symptoms:
  - "93 restaurant POIs lacked research-verified editorial hooks"
  - "Existing hooks contained factual errors (wrong chef, wrong cuisine, wrong location)"
  - "No systematic workflow for curating an entire category at scale"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: medium
tags: [curator, editorial-hooks, parallel-agents, restaurant, batch-processing, migration]
---

# Systematisk kurator-pass per kategori — restauranter som mønster

## Problem

Etter at Curator-skillen ble opprettet og café-kategorien ble gjort som første test (v2), manglet det en skalerbar metode for å kuratere en hel kategori (93+ POIs) med research-verifisert innhold. Manuell én-og-én-tilnærming ville tatt for lang tid.

## Environment
- Stack: Next.js 14, Supabase, TypeScript
- Skill: `.claude/skills/curator/SKILL.md`
- Migration: `supabase/migrations/029_restaurant_editorial_v2.sql`
- Date: 2026-02-14

## Tilnærming — 4-batch parallell agent-mønster

### 1. Eksporter alle aktive POIs i kategorien

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
sb.from('pois').select('id, name, poi_tier, editorial_hook, local_insight, google_rating, trust_score')
  .eq('category_id', 'restaurant')
  .gt('trust_score', 0.1)  // Ekskluder suppressed
  .order('poi_tier')
  .then(({data}) => require('fs').writeFileSync('/tmp/pois.json', JSON.stringify(data, null, 2)));
"
```

### 2. Split i 4 batches (maks 4 agenter per CLAUDE.md)

```
Batch 1: POI 1-24  (alle Tier 1 + start Tier 2)
Batch 2: POI 25-48
Batch 3: POI 49-72
Batch 4: POI 73-93
```

### 3. Kjør 4 parallelle background agents

Hver agent:
- Leser Curator-skillen (voice principles, text specs, time rule)
- WebSearcher hvert POI for å verifisere fakta
- Skriver SQL UPDATE-statements til `/tmp/restaurant-sql-batch-N.sql`
- Klassifiserer: KEEP / REWRITE / NEW / SUPPRESS

### 4. Assembler én migrasjon

Kombiner 4 batch-filer til `supabase/migrations/NNN_description.sql`. Sjekk for konflikter mellom agenter (f.eks. ulike årstall for samme fakta).

### 5. Push og verifiser

```bash
source .env.local && supabase db push --password "$DATABASE_PASSWORD"
```

## Nøkkelresultater

| Metrikk | Verdi |
|---------|-------|
| Totalt POIs behandlet | 93 |
| REWRITE | ~85 |
| KEEP (allerede gode) | 3 (Credo, Frati, et par til) |
| NEW (manglet hook) | ~4 |
| SUPPRESS | 1 (Jafs Pirbadet, 1.9 rating) |
| Faktafeil korrigert | 6 |

### Faktafeil funnet via research

| POI | Feil | Korrigert til |
|-----|------|---------------|
| Bula Neobistro | Top Chef 2016 | Top Chef **2015** (Renée Fagerhøi) |
| Speilsalen | Christopher Davidsen leder kjøkkenet | Fjernet — han har sluttet (tidsregel) |
| Hevd | Napolitansk pizza | **Pala Romana** — annen deigtype |
| Amber Restaurant | Nordisk fine dining | **Asiatisk fusjon** |
| Lerka | I Olavshallen | I **Dybdahlsgården** |
| Spontan | Spontan | Omdøpt til **Saga** |

## Viktige lærdommer

### 1. Migrasjonsnummer-konflikter ved parallelle sesjoner
En annen sesjon hadde allerede pushet `028_scandic_nidelven_bridgetext_curator.sql`. Vår fil måtte renames fra 028 → 029. **Sjekk alltid `supabase migration list` før du velger nummer.**

### 2. Agenter finner ulike fakta — krever manuell reconciliation
Batch 1 fant Top Chef **2015**, Batch 3 brukte **2016** for samme person. Når du assembler batch-resultater: **søk etter overlappende entiteter og velg riktig kilde.**

### 3. Curator tidsregel fanger ferskvare
Flere hooks nevnte nåværende kokker ("X leder kjøkkenet"). Tidsregelen konverterte disse til historisk form ("Grunnlagt av X") eller fjernet dem. Dette forhindrer at hooks blir utdatert.

### 4. Database-kolonner er ikke intuitive
- `poi_tier` (ikke `tier`)
- `trust_score = 0.1` for suppression (ingen `is_suppressed`-kolonne)
- `category_id` er sluggen direkte (ingen separat `slug`-kolonne på categories)

### 5. Batch-størrelse: 20-25 POIs per agent er sweet spot
Gir nok arbeid til å rettferdiggjøre agent-overhead, men lite nok til at agenten fullfører innen rimelig tid.

## Mal for neste kategori

```
1. Eksporter aktive POIs: category_id = '[kategori]', trust_score > 0.1
2. Split i 4 batches à ~25 POIs
3. Lag prompt med: Curator skill + POI JSON + output-format (SQL)
4. Kjør 4 background agents parallelt
5. Assembler SQL, reconciler konflikter
6. Sjekk migrasjonsnummer, push, verifiser
```

Neste kandidater: `attraction`, `shopping`, `nightlife`

## Prevention

- **Sjekk migrasjonsnummer** før du oppretter fil — `ls supabase/migrations/*.sql | tail -3`
- **Reconciler batch-resultater** — søk etter samme personnavn/stedsnavn på tvers av batches
- **Verifiser etter push** — kjør SELECT på noen POIs for å sjekke at hooks er oppdatert

## Related Issues

- See also: [editorial-hooks-no-perishable-info-20260208.md](editorial-hooks-no-perishable-info-20260208.md) — Ferskvare-regelen som nå er integrert i Curator-skillen
- See also: [editorial-voice-skill-from-inspiration-texts.md](editorial-voice-skill-from-inspiration-texts.md) — Opprettelsen av selve Curator-skillen
