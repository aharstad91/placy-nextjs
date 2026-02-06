---
title: "feat: Automated /generate-hotel Claude Code Skill"
type: feat
date: 2026-02-06
brainstorm: docs/brainstorms/2026-02-06-auto-hotel-report-skill-brainstorm.md
deepened: 2026-02-06
tech-audit: 2026-02-06
tech-audit-verdict: YELLOW
---

# feat: Automated /generate-hotel Claude Code Skill

## Enhancement Summary

**Deepened on:** 2026-02-06
**Review agents used:** TypeScript Reviewer, Architecture Strategist, Performance Oracle, Security Sentinel, Code Simplicity Reviewer, Agent-Native Reviewer, Pattern Recognition Specialist, Data Integrity Guardian, Skill Creator Best Practices, Agent-Native Architecture

### Key Improvements from Deepening

1. **Simplified MVP to 7 steps** — Removed regional discovery, hotel type classification, and distance-based filtering from Phase 1. All POIs go to both products.
2. **Added cache revalidation endpoint** — `POST /api/admin/revalidate` to fix Next.js stale data after Supabase REST writes.
3. **Added human checkpoints** — Geocoding confirmation and customer creation approval before proceeding.
4. **Import API already links project_pois** — Steps 8-9 were redundant. Only product_pois linking needed.
5. **Command file as goal + judgment** — Not a bash tutorial. Describe the goal and let Claude Code reason about implementation.
6. **UPSERT everywhere** — Use `Prefer: resolution=merge-duplicates` for idempotency.
7. **Editorial hooks optional in MVP** — Default to skip, opt-in with explicit request.

### Critical Findings from Reviews

| Finding | Source | Impact | Resolution |
|---------|--------|--------|------------|
| Cache revalidation bypass | Agent-Native, Patterns | Pages show stale data | Add `/api/admin/revalidate` endpoint |
| Regional discovery too complex for MVP | Simplicity | +40% complexity for 1 edge case | Defer to Phase 2 |
| Steps 8-9 redundant | Patterns | Import API already links project_pois | Remove, only add product_pois |
| Slugify NFD bug with æ | TypeScript, Patterns | Data corruption risk | Fix with canonical slugify |
| No rollback on partial failure | Data Integrity | Orphaned records | Add cleanup guidance |
| No human checkpoints | Agent-Native | Wrong geocoding = useless project | Add confirmations |
| Editorial hooks bottleneck | Performance | 2-4 min wait | Make optional, parallelize later |

---

## Overview

En Claude Code command (`/generate-hotel`) som tar hotellnavn + adresse og automatisk genererer et komplett Report + Explorer-produkt med POI-er og kartmarkører. Én kommando → publiserbart resultat.

```
/generate-hotel "Radisson Blu Trondheim Airport" "Langstranda 1, Stjørdal"
```

**Resultat:** Fullstendig prosjekt med:
- Kunde (Radisson Hotels)
- Prosjekt (Radisson Blu Trondheim Airport) med koordinater
- Explorer-produkt (POI-er med kartmarkører)
- Report-produkt (POI-er med temaer og kart)
- 30-60 POI-er
- Publiserbare URL-er

## Problem Statement

Manuell opprettelse av et hotellprosjekt krever 10+ steg i admin-UIet. For 10-20 hoteller er dette ikke skalerbart. Skillen automatiserer hele flyten.

## Proposed Solution

En Claude Code command-fil (`.claude/commands/generate-hotel.md`) som instruerer Claude Code til å utføre stegene programmatisk via eksisterende byggeklosser.

## Technical Approach

### Arkitektur

Skillen er en **goal-oriented orchestrator** — den beskriver MÅL og VURDERINGSKRITERIER, ikke bash-scripts. Claude Code bruker sitt eget omdømme for å utføre stegene via eksisterende API-er og Supabase REST.

```
┌─────────────────────────────────────────────────┐
│  /generate-hotel command                        │
│  Goal: Complete hotel project with products     │
├─────────────────────────────────────────────────┤
│                                                  │
│  Step 1: Geocode ──────► /api/geocode            │
│  Step 2: Customer ─────► Supabase REST (UPSERT)  │
│  Step 3: Project ──────► Supabase REST (INSERT)   │
│  Step 4: Products ─────► Supabase REST (INSERT)   │
│  Step 5: POI Discovery ► /api/admin/import       │
│  Step 6: Product Links ► Supabase REST (UPSERT)   │
│  Step 7: Revalidate ──► /api/admin/revalidate    │
│                                                  │
│  Optional:                                       │
│  Step 8: Editorial ───► WebSearch + Supabase     │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Research Insights: Skill Design

**Best Practice (from Skill Creator analysis):**
- Write in imperative form, not second person
- Describe goals and judgment criteria, not step-by-step bash commands
- Keep under 500 lines
- Include concrete examples with expected input/output
- Reference institutional learnings for edge cases

**Anti-Pattern Avoided:**
The original plan had 200 lines of curl commands. The enhanced command file describes WHAT to achieve and WHY, letting Claude Code figure out HOW. This makes the skill adaptable to edge cases (rural hotels, ambiguous addresses, few POIs).

### Implementation Phases

#### Phase 1: MVP (7-step pipeline)

**Mål:** Kommandoen fungerer ende-til-ende for et hotell. Alle POI-er går til begge produkter.

**Filer:**

1. `NEW: .claude/commands/generate-hotel.md` — Command-instruksjoner (~100 linjer)
2. `NEW: lib/utils/slugify.ts` — Kanonisk slugify (~20 linjer)
3. `NEW: app/api/admin/revalidate/route.ts` — Cache revalidation endpoint (~20 linjer)
4. `EDIT: app/admin/projects/projects-admin-client.tsx` — Bruk kanonisk slugify
5. `EDIT: lib/generators/poi-discovery.ts` — Bruk kanonisk slugify
6. `EDIT: app/api/generate/route.ts` — Bruk kanonisk slugify
7. `EDIT: app/api/story-writer/route.ts` — Bruk kanonisk slugify
8. `EDIT: lib/generators/story-structure.ts` — Bruk kanonisk slugify

**Forutsetninger:**
- `npm run dev` kjører på `localhost:3000`
- `ADMIN_ENABLED=true` er satt i `.env.local`

**7-steg pipeline:**

**Step 1: Geocode adresse + bekreft**
```bash
curl "http://localhost:3000/api/geocode?q=Langstranda+1,+Stjørdal"
# → { features: [{ center: [10.9227, 63.4578], place_name: "...", relevance: 0.95 }] }
```
- **GeoJSON gotcha:** Koordinater er `[lng, lat]`, MÅ reverseres til `{ lat, lng }`
- Feil hvis ingen resultater eller relevance < 0.5
- **Human checkpoint:** Vis koordinater og stedsnavn, be bruker bekrefte før neste steg
- **Avvisningsflyt:** Hvis bruker avviser, spør etter korrigert adresse og kjør geocoding på nytt. Gjenta til bruker godkjenner eller avbryter.

**Research Insight (Agent-Native):** Geocoding er et high-stakes steg — feil lokasjon gjør hele prosjektet verdiløst. Vis alltid resultatet og vent på bekreftelse.

**Step 2: Opprett/finn kunde**
```
Chain name extraction (AI parser):
- "Radisson Blu Trondheim Airport" → "Radisson Blu" (slug: "radisson-blu")
- "Scandic Nidelven" → "Scandic" (slug: "scandic")
- "Thon Hotel Prinsen" → "Thon Hotel" (slug: "thon-hotel")
```
- **Human checkpoint:** Vis utledet kundenavn, be bruker bekrefte
- **Avvisningsflyt:** Hvis bruker avviser, spør etter korrekt kundenavn (f.eks. "Strawberry Hotels" i stedet for AI-utledet "Comfort Hotel"). Bruk brukerens input som kundenavn og slugify det.
- UPSERT med `Prefer: resolution=merge-duplicates` for idempotency (conflict target: `id` primary key)
- Slugify med eksplisitt norsk tegnhåndtering: æ→ae, ø→o, å→a

**Research Insight (Data Integrity):** Bruk UPSERT, ikke INSERT + sjekk. Supabase REST støtter `Prefer: resolution=merge-duplicates` header som gjør operasjonen idempotent.

**Step 3: Opprett prosjekt**
```
URL slug: slugify(hotellnavn) → "radisson-blu-trondheim-airport"
Container ID: "{customerId}_{urlSlug}"
Short ID: nanoid(7)
```
- INSERT med alle felter (id, customer_id, url_slug, center_lat, center_lng, short_id, name)
- Feil med tydelig melding hvis prosjekt allerede eksisterer (UNIQUE constraint)

**Research Insight (Patterns):** Container ID-formatet `{customerId}_{urlSlug}` er brukt konsekvent i hele kodebasen. Short ID bruker nanoid(7) for admin-URL-er (ref: `docs/solutions/ux-improvements/nanoid-short-urls-admin-projects-20260205.md`).

**Step 4: Opprett produkter**
```
Generer product IDs: crypto.randomUUID() for hvert produkt (matcher admin UI-mønster)
UPSERT Explorer (id: "{explorerProductId}", project_id: "{containerId}", product_type: "explorer")
UPSERT Report (id: "{reportProductId}", project_id: "{containerId}", product_type: "report")
```
- UPSERT med `onConflict: "project_id,product_type"` for idempotency ved re-kjøring
- Generer product IDs **før** INSERT — de trengs i Step 6 for `product_pois`-linking
- Ikke sett `config` — database default er `{}` (matcher eksisterende mønster i `app/admin/projects/page.tsx:117`)
- Report bruker default themes fra `report-themes.ts`
- Explorer bruker category-fallback (ref: `docs/solutions/logic-errors/empty-product-categories-explorer-zero-pois-20260205.md`)

> **Tech Audit fix:** Endret fra INSERT til UPSERT (idempotent). Eksplisitt ID-generering med `crypto.randomUUID()` slik at product IDs kan brukes i Step 6. Fjernet `config: {}` — la database default gjelde.

**Research Insight (Simplicity):** Ikke populer `product_categories` eller `config.themes`. Fallback-mekanismene håndterer dette automatisk. Mindre kode = færre bugs.

**Step 5: POI Discovery**
```bash
POST http://localhost:3000/api/admin/import
{
  "projectId": "{containerId}",
  "center": { "lat": 63.4578, "lng": 10.9227 },
  "radiusMeters": 1000,
  "categories": ["restaurant","cafe","bar","bakery","supermarket","pharmacy",
                  "gym","park","museum","library"],
  "includeEntur": true,
  "includeBysykkel": true
}
```
> **Tech Audit fix:** Feltnavn rettet — `radiusMeters` (ikke `radius`), `includeEntur`/`includeBysykkel` (ikke `includeTransport`), fjernet `church`/`tourist_attraction` (ikke i `ALLOWED_CATEGORIES`).
> **Forutsetning:** `ADMIN_ENABLED=true` må være satt i `.env.local`, ellers returnerer import-API 403.
- Import-API håndterer Google Places + Entur + Bysykkel **parallelt**
- Deduplisering via google_place_id/entur_id/bysykkel_id
- Upsert med editorial preservation
- **Linker automatisk til project_pois** (import-API gjør dette!)

**Research Insight (Patterns):** Import-API-et linker allerede POI-er til `project_pois` via `addPOIsToProject()` i sin egen pipeline. Separate steg for project_pois-linking er unødvendig.

**Research Insight (Performance):** Google Places-kategorier kjøres sekvensielt med 200ms delay. For 12 kategorier tar dette ~5 sekunder. Kan parallelliseres i batches av 3 (Phase 2), men akseptabelt for MVP.

**Minimum POI-validering:** Hvis færre enn 10 POI-er returneres, vis advarsel og foreslå større radius.

**Step 6: Link POI-er til produkter**
```
# Hent alle project_pois for prosjektet
GET /rest/v1/project_pois?project_id=eq.{projectId}&select=poi_id

# Link ALLE POI-er til begge produkter (MVP: ingen filtrering)
POST /rest/v1/product_pois (alle poi_ids → explorer_product_id)
POST /rest/v1/product_pois (alle poi_ids → report_product_id)
```
- Batch UPSERT med `onConflict: "product_id,poi_id"` og `ignoreDuplicates: true`
- **Ikke** populer `product_categories` — fallback utleder automatisk

**Research Insight (Simplicity):** MVP gir ALLE POI-er til begge produkter. Ingen avstandsfiltrering. Brukeren kan kuratere manuelt i admin-UIet etterpå. Regional discovery (flyplasshoteller) utsettes til Phase 2.

**Step 7: Revalidate cache + valider**
```bash
# Revalidate Next.js cache (bruker "layout" mode som revaliderer nested routes)
POST http://localhost:3000/api/admin/revalidate
{ "paths": ["/admin/projects", "/admin/projects/{shortId}", "/{customerId}/{urlSlug}"] }

# Valider at URL-er fungerer
curl -I http://localhost:3000/{customerId}/{urlSlug}/explore
curl -I http://localhost:3000/{customerId}/{urlSlug}/report
```
> **Tech Audit fix:** Lagt til admin prosjektdetalj-path. Endepunktet bruker `revalidatePath(path, "layout")` som revaliderer alle nested routes (/explore, /report) automatisk.

**Research Insight (Agent-Native, Critical):** Supabase REST API-kall trigrer IKKE `revalidatePath()`. Uten eksplisitt revalidering viser admin-UIet og offentlige sider gammel data. `/api/admin/revalidate` er en ny endpoint som wrapper `revalidatePath()`.

**Output:**
```
Prosjekt opprettet: Radisson Blu Trondheim Airport
Kunde: Radisson Blu (radisson-blu)
POI-er: 47 stykker

Explorer: 47 POI-er
Report: 47 POI-er

URL-er:
  Admin:    http://localhost:3000/admin/projects/{shortId}
  Explorer: http://localhost:3000/radisson-blu/radisson-blu-trondheim-airport/explore
  Report:   http://localhost:3000/radisson-blu/radisson-blu-trondheim-airport/report
```

**Step 8 (Valgfritt): Editorial hooks**
Kun hvis bruker eksplisitt ber om det.
```
For hver POI (unntatt transport-kategorier):
1. WebSearch "{poi.name} {poi.address} anmeldelse tips"
2. Generer editorialHook (1 setning) og localInsight (lokal kontekst)
3. PATCH /rest/v1/pois?id=eq.{poiId}
```
- Hopp over POI-er som allerede har `editorial_hook` (idempotent)
- Hopp over transport-kategorier (bus, train, bike, tram, parking)
- Vis progress: `[15/42] Generating hook for Havfruen Fiskerestaurant...`
- Forventet tid: ~2-3 sek per POI

**Research Insight (Performance):** Editorial hooks er den klare flaskehalsen (2-4 min for 50 POI-er). Ved å gjøre det valgfritt kan brukeren iterere raskt på prosjektoppsett og legge til editorial senere.

#### Phase 2: Kvalitetsforbedring

- Regional POI-discovery for flyplasshoteller (hotelltype-klassifisering + nærmeste by)
- Explorer vs Report POI-filtrering (lokal vs regional avstand)
- Parallellisering av Google Places-kategorier (batches av 3)
- `--force` flagg for re-kjøring av eksisterende prosjekt
- Rollback ved partial failure
- Parallellisering av editorial hooks (5 samtidige)

#### Phase 3: Skalering

- Batch-modus for mange hoteller
- Bysykkel-URL deteksjon per by
- Konfigurerbar radius

## Acceptance Criteria

### Functional Requirements

- [ ] `/generate-hotel "Hotellnavn" "Adresse"` oppretter kunde, prosjekt, 2 produkter, og POI-er
- [ ] Begge produkter inneholder alle oppdagede POI-er
- [ ] Publiserbare URL-er fungerer etter kjøring (Explorer + Report viser kart med markører)
- [ ] Kommandoen viser geocoding-resultat for bekreftelse før den fortsetter
- [ ] Kommandoen viser kundenavn for bekreftelse
- [ ] Re-kjøring feiler med tydelig melding (UNIQUE constraint)

### Quality Gates

- [ ] Report har minst 3 temaer med 3+ POI-er hver
- [ ] Explorer har minst 10 POI-er
- [ ] Norske tegn (æøå) håndteres korrekt i slug-er
- [ ] GeoJSON-koordinater reverseres korrekt (lng,lat → lat,lng)
- [ ] Next.js cache revalideres — admin og offentlige sider viser ferske data

## Key Design Decisions

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| **Implementeringsform** | `.claude/commands/generate-hotel.md` | Følger eksisterende command-mønster |
| **Command-stil** | Mål + vurderingskriterier | Ikke bash-tutorial. Claude Code bruker eget omdømme (ref: Skill Creator) |
| **Backend-endringer** | 1 ny endpoint (revalidate) | Minimum for å fikse cache-gap |
| **MVP-scope** | 7 steg, ingen regional discovery | Simplicity reviewer: -40% kompleksitet, edge case deferred |
| **POI-filtrering** | Alle POI-er til begge produkter | Simplicity: ingen avstandsberegning, bruker kan kuratere i admin |
| **Editorial hooks** | Valgfritt (opt-in) | Performance: fjerner 2-4 min flaskehals fra standard-kjøring |
| **Idempotency** | UPSERT med merge-duplicates | Architecture: forhindrer duplikater ved re-kjøring |
| **Cache** | `/api/admin/revalidate` endpoint | Agent-native: fikser stale data etter REST-skrivinger |
| **Human checkpoints** | Geocoding + kundenavn | Agent-native: forhindrer feil ved high-stakes steg |
| **Slugify** | Eksplisitt norsk tegnhåndtering | æ→ae BEFORE NFD normalize. Riktig rekkefølge er kritisk |
| **Product categories** | Ikke populer | Fallback utleder fra POI-er automatisk |

## Risiko og Mitigering

| Risiko | Sannsynlighet | Impact | Mitigering |
|--------|---------------|--------|------------|
| Google Places API rate limit | Medium | Blokkerer discovery | 200ms delay allerede implementert |
| Feil geocoding-resultat | Lav | Alle POI-er feil plassert | Human checkpoint: bekreft koordinater |
| For få POI-er i rural områder | Medium | Tom rapport | Vis advarsel, foreslå større radius |
| Slugify-divergens (æ-bug) | Lav | Data corruption | Fiks med kanonisk slugify.ts |
| Stale Next.js cache | Høy | Sider viser gammel data | Ny `/api/admin/revalidate` endpoint |
| Partial failure (orphaned records) | Medium | Garbage data | Rapporter hvilke steg som fullførte + ID-er. Bruker kan slette prosjekt via admin UI eller re-kjøre import separat |
| Feil kundenavn-utledning | Medium | Feil kunde-slug | Human checkpoint: bekreft kundenavn |

## Dependencies

| Avhengighet | Status | Blokkerer |
|-------------|--------|-----------|
| `/api/geocode` | Klar | Step 1 |
| `/api/admin/import` | Klar | Step 5 |
| Supabase REST API | Klar | Step 2-4, 6 |
| `/api/admin/revalidate` | **MÅ BYGGES** | Step 7 |
| `report-themes.ts` defaults | Klar | Report rendering |

## Ny kode som må bygges

### 1. `app/api/admin/revalidate/route.ts` (~20 linjer)

```typescript
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  // Match existing admin endpoint pattern (ref: app/api/admin/import/route.ts:270)
  if (process.env.ADMIN_ENABLED !== "true") {
    return NextResponse.json({ error: "Admin ikke aktivert" }, { status: 403 });
  }

  const { paths } = await request.json();
  if (!Array.isArray(paths) || paths.length === 0 || paths.some((p: unknown) => typeof p !== "string" || !String(p).startsWith("/"))) {
    return NextResponse.json({ error: "paths must be non-empty array of absolute paths" }, { status: 400 });
  }

  for (const path of paths) {
    revalidatePath(path, "layout");  // "layout" revalidates page + all nested routes
  }
  return NextResponse.json({ revalidated: paths });
}
```

> **Tech Audit fix:** Lagt til `ADMIN_ENABLED` guard (matcher alle eksisterende admin-endepunkter), input-validering, og endret fra `"page"` til `"layout"` for å revalidere nested routes (/explore, /report).

### 2. `lib/utils/slugify.ts` (~20 linjer)

```typescript
/**
 * Canonical slugify with explicit Norwegian character handling.
 * CRITICAL: æ/ø/å replacements MUST happen BEFORE NFD normalization,
 * because NFD decomposes æ to "a" + combining char (losing the "e").
 */
export function slugify(text: string, maxLength = 63): string {
  return text
    .toLowerCase()
    .replace(/æ/g, "ae")    // BEFORE NFD
    .replace(/ø/g, "o")     // BEFORE NFD
    .replace(/å/g, "a")     // BEFORE NFD
    .normalize("NFD")        // Decompose remaining diacritics (é→e)
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}
```

**Research Insight (TypeScript Reviewer):** Rekkefølgen er kritisk. NFD normaliserer æ til "a" + combining char, som deretter strippes til bare "a". Eksplisitte erstatninger MÅ komme først. maxLength forhindrer 200-char slugs fra lange hotellnavn.

### 3. `.claude/commands/generate-hotel.md` (~100 linjer)

Ikke et bash-script, men en goal-oriented instruksjon. Se "Command-stil" i design decisions.

## MVP Scope

**Phase 1 er MVP:** 7-steg pipeline, alle POI-er til begge produkter, editorial hooks valgfritt, human checkpoints for geocoding og kundenavn.

**Estimerte fil-endringer:**
1. `NEW: .claude/commands/generate-hotel.md` — Command-instruksjoner (~100 linjer)
2. `NEW: lib/utils/slugify.ts` — Kanonisk slugify (~20 linjer)
3. `NEW: app/api/admin/revalidate/route.ts` — Cache revalidation (~20 linjer)
4. `EDIT: app/admin/projects/projects-admin-client.tsx` — Bruk kanonisk slugify
5. `EDIT: lib/generators/poi-discovery.ts` — Bruk kanonisk slugify
6. `EDIT: app/api/generate/route.ts` — Bruk kanonisk slugify (har NFD-bug)
7. `EDIT: app/api/story-writer/route.ts` — Bruk kanonisk slugify (har NFD-bug)
8. `EDIT: lib/generators/story-structure.ts` — Bruk kanonisk slugify (har NFD-bug)

> **Tech Audit fix:** Utvidet fra 2 til 5 EDIT-filer. Kodebasen har 8+ slugify-implementeringer med æ-bug. Filer 4-8 er i app/lib-katalogene og MÅ oppdateres. Scripts (import-*.ts, generate-story.ts) kan tas som oppfølging.

## Performance Profil

| Steg | Estimert tid | Flaskehals? |
|------|-------------|-------------|
| Geocoding | ~300ms | Nei |
| Customer UPSERT | ~100ms | Nei |
| Project INSERT | ~100ms | Nei |
| Products INSERT ×2 | ~200ms | Nei |
| POI Discovery (Google×12 + Entur + Bysykkel) | ~5-8s | Ja (Google sekvensielt) |
| Product POI linking ×2 | ~300ms | Nei |
| Cache revalidation | ~200ms | Nei |
| **Total uten editorial** | **~7-10s** | |
| Editorial hooks (valgfritt, 40 POI-er) | ~100-120s | Ja (sekvensielt) |
| **Total med editorial** | **~2 min** | |

**Phase 2 optimering:** Parallellisere Google Places (batches×3) → 2s, parallellisere editorial (5 samtidige) → 25s. Total med editorial: ~30s.

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-02-06-auto-hotel-report-skill-brainstorm.md`
- Import API: `app/api/admin/import/route.ts`
- POI discovery: `lib/generators/poi-discovery.ts`
- Supabase mutations: `lib/supabase/mutations.ts`
- Report themes: `components/variants/report/report-themes.ts`
- Geocoding: `app/api/geocode/route.ts`
- Admin slugify: `app/admin/projects/projects-admin-client.tsx:69-77`
- Command mønster: `.claude/commands/full.md`

### Institutional Learnings
- Batch import: `docs/solutions/data-import/import-external-geographic-data-20260125.md`
- GeoJSON koordinat-felle: `docs/solutions/data-import/import-entur-stops-20260125.md`
- Category fallback: `docs/solutions/logic-errors/empty-product-categories-explorer-zero-pois-20260205.md`
- Server actions pattern: `docs/solutions/best-practices/nextjs-admin-interface-pattern-20260124.md`
- Map+sidebar mønster: `docs/solutions/feature-implementations/admin-project-poi-map-sidebar-20260206.md`
- Nanoid short URLs: `docs/solutions/ux-improvements/nanoid-short-urls-admin-projects-20260205.md`
- Schema mismatch post-migration: `docs/solutions/database-issues/schema-mismatch-product-type-column-20260205.md`

### Review Agent Insights (Deepened)
- **Architecture:** Use UPSERT everywhere, consider Server Action wrappers for Phase 2
- **Performance:** Google Places sequential is acceptable for MVP, parallelize in Phase 2
- **Security:** Service role key usage is appropriate for admin tooling, add auth to revalidate endpoint in prod
- **Simplicity:** 7 steps vs 11, defer regional discovery and editorial to later phases
- **Agent-Native:** Cache revalidation endpoint, human checkpoints, verification step
- **Data Integrity:** UNIQUE constraints handle re-run safety, no transaction wrapper needed for MVP
- **Patterns:** Import API already links project_pois — don't duplicate

### Tech Audit Findings (2026-02-06, Verdict: YELLOW)

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 1 | Import API field names wrong (`radius` → `radiusMeters`, `includeTransport` → `includeEntur`/`includeBysykkel`, invalid categories `church`/`tourist_attraction`) | Critical | Fixed curl examples |
| 2 | Revalidate endpoint missing `ADMIN_ENABLED` guard | High | Added guard to code sample |
| 3 | Project INSERT missing `short_id` field | High | Already mentioned, now explicit in INSERT fields |
| 4 | Product ID capture gap (Step 4 → Step 6) | Medium | Generate with `crypto.randomUUID()`, carry to Step 6 |
| 5 | Product creation not idempotent | Medium | Changed to UPSERT with `onConflict: "project_id,product_type"` |
| 6 | Slugify scope larger than stated (8+ files, not 2) | Medium | Expanded file list to 5 app/lib files |
| 7 | Human checkpoint rejection flow undefined | Medium | Added re-try guidance |
| 8 | `ADMIN_ENABLED` prerequisite not documented | Low | Added to prerequisites |
| 9 | Revalidation paths incomplete (missing /explore, /report) | Low | Fixed path list |
