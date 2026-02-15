---
title: "feat: Research Pipeline + Backfill — City Knowledge Base Phase 2"
type: feat
date: 2026-02-15
---

# Research Pipeline + Backfill — City Knowledge Base Phase 2

## Overview

Bygg to scripts + en Claude Code research-workflow som fyller `place_knowledge`-tabellen med fakta om 20 nøkkelsteder i Trondheim. Phase 1 (infrastruktur) er levert — nå trenger vi DATA.

**Constraint:** Ingen Anthropic API-nøkkel. All AI-drevet research skjer i Claude Code med WebSearch.

**Brainstorm:** `docs/brainstorms/2026-02-15-research-pipeline-backfill-brainstorm.md`

---

## Teknisk kontekst

### Eksisterende infrastruktur (Phase 1, PR #37)

| Komponent | Fil | Status |
|-----------|-----|--------|
| DB-tabell | `supabase/migrations/038_place_knowledge.sql` | Merget |
| Typer | `lib/types.ts` — `KNOWLEDGE_TOPICS`, `PlaceKnowledge` | Merget |
| Public queries | `lib/public-queries.ts` — `getPlaceKnowledge()`, `getPlaceKnowledgeBatch()` | Merget |
| Admin queries | `lib/supabase/queries.ts` — `getAllKnowledgeAdmin()` | Merget |
| UI | `components/public/PlaceKnowledgeSection.tsx` | Merget |
| MapPopupCard | Knowledge-snippet i popup | Merget |
| Admin | `app/admin/knowledge/` | Merget |

### Script-mønster å følge

| Script | Mønster | Relevant for |
|--------|---------|-------------|
| `scripts/seed-trips.ts` | Supabase JS client, `--dry-run`/`--force`, upsert | Backfill-script |
| `scripts/refresh-opening-hours.ts` | REST API + service_role, batch + delay, paginated fetch | List targets |

### DB-constraints å respektere

```sql
-- XOR: nøyaktig én forelder
CONSTRAINT place_knowledge_parent_check CHECK (
  (poi_id IS NOT NULL AND area_id IS NULL) OR
  (poi_id IS NULL AND area_id IS NOT NULL)
)
-- Topic MÅ være en av 9 gyldige verdier
CONSTRAINT place_knowledge_topic_valid CHECK (topic IN (...))
-- Confidence: 'verified' | 'unverified' | 'disputed'
-- source_url MÅ starte med http:// eller https://
-- fact_text kan IKKE være tom streng
```

---

## Oppgaver

### 1. `.gitignore` — legg til `data/research/`

**Fil:** `.gitignore`

Legg til:
```
# Research output (generated, not committed)
data/research/
```

- [x] Legg til `data/research/` i `.gitignore`
- [x] Opprett `data/research/.gitkeep` (tom fil for å beholde mappen i git)

---

### 2. Research Target Script (`scripts/list-research-targets.ts`)

**Formål:** Hent POI-er fra Supabase som trenger research. Outputter `data/research/manifest.json`.

**Mønster:** Følg `refresh-opening-hours.ts` (REST API + service_role).

```typescript
/**
 * List POIs that need knowledge research.
 *
 * Fetches POIs from Supabase, checks existing knowledge,
 * and outputs a manifest of research targets.
 *
 * Usage:
 *   npx tsx scripts/list-research-targets.ts
 *   npx tsx scripts/list-research-targets.ts --area trondheim
 *   npx tsx scripts/list-research-targets.ts --tier 1
 *   npx tsx scripts/list-research-targets.ts --limit 20
 */
```

**Output format (`data/research/manifest.json`):**

```json
{
  "generated_at": "2026-02-15T14:30:00Z",
  "area": "trondheim",
  "total_pois": 20,
  "targets": [
    {
      "poi_id": "abc123",
      "name": "Nidarosdomen",
      "slug": "nidarosdomen",
      "address": "Bispegata 11",
      "category": "sightseeing",
      "editorial_hook": "Nordens viktigste ...",
      "local_insight": "...",
      "tier": 1,
      "existing_topics": [],
      "missing_topics": ["history", "architecture", "culture", "people", "local_knowledge", "spatial", "practical", "nature", "food"]
    }
  ]
}
```

**Logikk:**
1. Hent alle POI-er for area (paginert, ekskluder transport-kategorier)
2. Filtrer på tier (default: tier 1 og 2)
3. For hver POI: sjekk om det finnes fakta i `place_knowledge` allerede
4. Beregn `missing_topics` = KNOWLEDGE_TOPICS minus eksisterende topics
5. Sorter: Tier 1 først, deretter Tier 2
6. Begrens til `--limit` (default: 20)
7. Skriv manifest til `data/research/manifest.json`

- [x] JSDoc header med usage-eksempler
- [x] CLI-flagg: `--area`, `--tier`, `--limit`
- [x] Paginated POI-fetch (1000 per page)
- [x] Ekskluder transport-kategorier (bike, taxi, bus)
- [x] Sjekk eksisterende place_knowledge per POI
- [x] Output manifest.json med missing_topics
- [x] Console output: sammendrag (antall POI-er, topics totalt)

---

### 3. Backfill Script (`scripts/backfill-knowledge.ts`)

**Formål:** Les JSON-filer fra `data/research/`, insert til `place_knowledge` via Supabase service_role.

**Mønster:** Følg `seed-trips.ts` (Supabase JS client, `--dry-run`/`--force`).

```typescript
/**
 * Backfill place_knowledge from research JSON files.
 *
 * Reads JSON files from data/research/ and inserts facts
 * into the place_knowledge table via Supabase service_role.
 *
 * Usage:
 *   npx tsx scripts/backfill-knowledge.ts --dry-run
 *   npx tsx scripts/backfill-knowledge.ts
 *   npx tsx scripts/backfill-knowledge.ts --file data/research/nidarosdomen.json
 *   npx tsx scripts/backfill-knowledge.ts --force  # Re-insert (delete existing first)
 *   npx tsx scripts/backfill-knowledge.ts --editorial  # Process editorial backfill files
 */
```

**Input format** (per JSON-fil i `data/research/`):

```json
{
  "poi_id": "abc123",
  "poi_name": "Nidarosdomen",
  "poi_slug": "nidarosdomen",
  "researched_at": "2026-02-15T14:30:00Z",
  "facts": [
    {
      "topic": "history",
      "fact_text": "Byggearbeidet startet rundt 1070...",
      "fact_text_en": "Construction began around 1070...",
      "structured_data": { "year_start": 1070 },
      "confidence": "verified",
      "source_url": "https://www.nidarosdomen.no/historie",
      "source_name": "Nidarosdomen.no"
    }
  ]
}
```

**Logikk:**
1. Les alle `.json`-filer i `data/research/` (eller spesifikk fil med `--file`)
2. Valider hvert faktum: topic er gyldig, fact_text ikke tom, source_url er https
3. **Dedup:** For hvert faktum, beregn SHA-256 hash av `poi_id + topic + fact_text`
4. Sjekk om hash allerede finnes (via select med poi_id + topic + likhet-sjekk)
5. Insert nye fakta med:
   - `display_ready: false` (kurator aktiverer manuelt)
   - `confidence`: fra JSON (default 'unverified')
   - `sort_order`: 0 (kurator sorterer manuelt)
6. `--force`: Slett eksisterende fakta for POI-en først, deretter insert alle
7. `--dry-run`: Vis hva som ville blitt inserted, uten å gjøre det

**Dedup-strategi (Hybrid Hash + Batch):**
- Beregn SHA-256 hash av normalisert `poi_id + topic + fact_text`
- Normaliser før hash: `.toLowerCase().trim().replace(/\s+/g, ' ')` — behold tegnsetting (kun whitespace+case)
- Fetch eksisterende hashes **scoped til target POI IDs** (ikke hele tabellen)
- Batch insert i chunks à 100 rader (Supabase request size limit)
- Ingen delay mellom chunks; eksponentiell backoff kun ved feil (429/500)
- `--force` gir full re-import (slett + insert per POI)
- Ref: `docs/solutions/feature-implementations/idempotent-backfill-patterns-supabase-20260215.md`

- [x] JSDoc header med usage
- [x] CLI-flagg: `--dry-run`, `--force`, `--file`, `--editorial`
- [x] Les JSON-filer fra `data/research/`
- [x] Valider JSON-struktur: schema-sjekk per fil (poi_id, facts array, topic enum, fact_text non-empty)
- [x] Valider topic mot importert `KNOWLEDGE_TOPICS` fra `lib/types.ts` (ikke hardcode)
- [x] Valider source_url med `isSafeUrl()` (inlined) + `new URL()` for normalisering
- [x] Valider XOR-constraint eksplisitt: poi_id XOR area_id (fail fast med tydelig feilmelding)
- [x] Verifiser poi_id per chunk (ikke én gang ved start) — catch FK-feil gracefully
- [x] Dedup: Hash-basert (SHA-256 av normalisert poi_id + topic + fact_text), scoped til target POI IDs
- [x] Batch insert i chunks à 100, ingen delay; eksponentiell backoff kun ved feil
- [x] Auto-assign sort_order: `MAX(sort_order) + 1` per poi_id+topic (auto-append etter eksisterende)
- [x] Insert med `display_ready: false`, `confidence` fra JSON
- [x] `--force`: delete + re-insert per POI
- [x] Console output: inserted/skipped/failed per fil + totalt sammendrag
- [x] Feilhåndtering: fortsett med neste fil ved feil, logg til stderr
- [x] Logg valideringsfeil til `data/research/validation-errors.log`

---

### 4. Research Workflow — Claude Code med WebSearch

**Formål:** Research fakta om POI-er via WebSearch, output JSON til `data/research/`.

**IKKE et Node.js script** — dette er en prosess som kjøres manuelt i Claude Code.

**Prosess per batch (5 POI-er):**

1. Les `data/research/manifest.json` for neste batch
2. For hver POI i batchen:
   a. WebSearch per topic: `"[POI-navn] Trondheim [topic-nøkkelord]"`
   b. Verifiser fakta mot 2+ kilder
   c. Formuler `fact_text` (NO) med Curator-stemme
   d. Oversett til `fact_text_en` (EN, mer forklarende)
   e. Ekstraher `structured_data` (årstall, personer, materialer)
   f. Oppgi `source_url` + `source_name`
   g. Marker `confidence`: "verified" kun med 2+ kilder
3. Skriv JSON-fil til `data/research/{slug}.json`

**Topic-søkeord:**

| Topic | Norsk søkeord | Eksempel |
|-------|--------------|----------|
| history | historie, grunnlagt, brant, krig | "Nidarosdomen historie" |
| architecture | arkitektur, byggestil, materiale, arkitekt | "Nidarosdomen arkitektur gotisk" |
| food | mat, drikke, spesialitet, kokk, meny | "Britannia Hotel restaurant" |
| culture | kultur, festival, kunst, musikk, tradisjon | "Rockheim utstilling" |
| people | grunnlegger, historisk person, kjent | "Erkebispegården erkebiskop" |
| nature | natur, park, utsikt, sesong | "Kristiansten festning utsikt" |
| practical | åpningstider, priser, tilgjengelighet | "Vitenskapsmuseet priser" |
| local_knowledge | hemmelighet, ukjent fakta, visste du | "Gamle Bybro hemmelig" |
| spatial | gangavstand, i nærheten, rute | "Bakklandet nabolag" |

**Kvalitetskrav per faktum:**
- Curator-stemme (jf. `.claude/skills/curator/SKILL.md`)
- Historisk form — "Grunnlagt av X i Y", ikke "X driver stedet"
- Spesifikke detaljer — årstall, navn, mål, materialer
- NO primærspråk, EN med mer kontekst for internasjonale lesere
- Kun verifiserbare fakta — skip subjektive beskrivelser ("koselig", "populært", "vakker")
- **Lengde:** 30-100 ord per faktum (1-2 setninger)
- **Filtrér perishable info:** ALDRI current priser, åpningstider, kampanjer

**Kilde-hierarki (Source Tiers):**
- **Tier 1 (prioriter):** snl.no, no.wikipedia.org, kulturminnesok.no, riksantikvaren.no, michelin.com
- **Tier 2 (backup):** visittrondheim.no, adressa.no, en.wikipedia.org, stedets egen nettside
- **Tier 3 (bare for local_knowledge):** travel blogs, Tripadvisor, Reddit — krever 3+ kilder som sier det samme
- **Verifisering:** `confidence: 'verified'` KUN med 2+ uavhengige kilder. Én kilde → `'unverified'`

**Hallusinering-mitigering:**
- Alltid inkluder "Trondheim" i søkestreng (unngå forveksling med andre byer)
- Dato-feller: Nidarosdomen har ulike årstall for shrine vs. katedral — vær presis
- Michelin: KUN verifiser mot michelin.com, ikke blogg-artikler
- Wikipedia-sirkularitet: Hvis NO Wiki → EN Wiki → NO Wiki uten primærkilde, marker `'unverified'`

**Multi-agent batching:**
- Batch 1: 5 POI-er → 4 Task-agenter (general-purpose) + 1 review
- Batch 2-4: 5 POI-er per batch
- Maks 4 agenter parallelt (CLAUDE.md-grense)
- Reconciliation mellom batches: sjekk for overlappende fakta

- [x] Batch 1: 5 POI-er (3B Vinkjeller, Antikvariatet, Archbishop's Palace, Awake, Backstube Bakeri) — 34 fakta
- [x] Batch 2: 5 POI-er (Backstube Jomfrugata, Baklandet Skydsstation, Bar Moskus, Blomster og Vin, Britannia Hotel) — 31 fakta
- [x] Batch 3: 5 POI-er (Britannia Spa, Bula Neobistro, Credo, Daglig Deig, Daglighallen) — 34 fakta
- [x] Batch 4: 5 POI-er (Den Gode Nabo, Fagn, Good Omens, Havfruen, Hevd Bakeri) — 33 fakta
- [x] Backfill til Supabase: 132 fakta inserted, 0 feil, idempotency verifisert
- [x] Reconciliation: 54 topic-overlaps mellom research+editorial (komplementære, ikke duplikater). SHA-256 dedup forhindrer eksakte duplikater. UI-dedup skjuler backfill-fakta når editorial_hook finnes.
- [ ] Kurator-review: verifiser fakta, tone, kilder — 186 fakta med display_ready=false venter på manuell gjennomgang

---

### 5. Editorial Backfill — Parse eksisterende hooks

**Formål:** Parse eksisterende `editorial_hook` og `local_insight` til strukturerte knowledge-fakta.

**Prosess (kjøres i Claude Code):**

1. Hent alle POI-er med `editorial_hook IS NOT NULL` fra Supabase (via list-research-targets eller direkte query)
2. For hver POI med hook ≥ 50 tegn:
   a. Les editorial_hook + local_insight
   b. Parse til strukturerte fakta (topic + fact_text + fact_text_en)
   c. **Kun verifiserbare fakta** — skip "koselig atmosfære", "perfekt for regnværsdag"
   d. Tag: `source_name: 'Placy editorial (backfill 038)'`
   e. `confidence: 'verified'` (editorial hooks er allerede verifisert)
3. Output JSON-filer til `data/research/editorial/` (egen undermappe)
4. Kjør `backfill-knowledge.ts --editorial` for insert

**Eksempel parsing:**

```
Input (editorial_hook):
"Grunnlagt av kokken Heidi Bjerkan i 2019, Credo holder én Michelin-stjerne
og bruker kun norske råvarer innenfor 30 mils radius."

Output:
[
  { "topic": "people", "fact_text": "Grunnlagt av kokken Heidi Bjerkan i 2019" },
  { "topic": "culture", "fact_text": "Holder én Michelin-stjerne" },
  { "topic": "food", "fact_text": "Bruker kun norske råvarer innenfor 30 mils radius" }
]
```

**Dedup med UI (allerede implementert i Phase 1):**
- `PlaceKnowledgeSection` filtrerer bort fakta med `source_name` som inneholder 'backfill' HVIS POI har `editorial_hook`
- Editorial hooks beholdes på `pois`-tabellen (legacy, ALDRI slett)
- **NB:** Denne dedup er en runtime UI-filter, ikke DB-constraint. Hvis en kurator sletter editorial_hook, vil backfill-fakta bli synlige uten review. Mitigering: backfill-fakta har `display_ready: false` som default — kurator MÅ aktivere manuelt.

**Ekstraksjonsregler:**
- EKSTRAHER: årstall, grunnlegger, historisk hendelse, pris/stjerne, byggestil, ingrediens/råvare, nabolag-relasjon
- SKIP: "koselig", "deilig", "sjarmerende", "populært", nåværende priser/timer, kampanjer
- **Mål:** 1.2-1.5 fakta per POI (noen hooks er rent subjektive → 0 fakta)
- **Checkpoint:** Etter batch 3 og 6, sjekk topic-distribusjon og ekstraksjon-rate
- Ref: `docs/solutions/feature-implementations/editorial-parsing-examples-prompts-20260215.md`

- [x] Hent POI-er med editorial_hook ≥ 50 tegn — 19 av 20 (Daglighallen har null)
- [x] Parse inline i Claude Code → JSON per POI — kun verifiserbare fakta, subjektive skippet
- [x] Tag med `source_name: 'Placy editorial (backfill 038)'`
- [x] Output til `data/research/editorial/` — 19 filer, 54 fakta
- [x] Kjør backfill-script for insert — 54 inserted, 0 feil, idempotency verifisert
- [x] Verifiser dedup i UI (PlaceKnowledgeSection) — backfill-038 skjult når hasEditorialHook=true

---

### 6. Verifisering

- [x] `data/research/` er gitignored
- [x] `list-research-targets.ts` henter korrekte POI-er fra Supabase
- [x] `backfill-knowledge.ts --dry-run` viser forventet output
- [x] `backfill-knowledge.ts` inserter uten feil — 132 research + 54 editorial = 186 totalt
- [x] Admin knowledge-side viser nye fakta (getAllKnowledgeAdmin henter alle uavhengig av display_ready)
- [x] POI-detaljside viser knowledge-seksjoner for pilot-steder (display_ready=true fakta synlige)
- [x] MapPopupCard viser snippet for steder med knowledge (local_knowledge > history fallback)
- [x] Dedup: editorial backfill-fakta skjules når editorial_hook finnes — verifisert for Britannia Hotel
- [x] `npm run build` kompilerer

---

## Akseptkriterier

- [x] `scripts/list-research-targets.ts` henter POI-manifest fra Supabase med missing topics
- [x] `scripts/backfill-knowledge.ts` leser JSON og inserter idempotent til place_knowledge — idempotency verifisert
- [x] 20 nøkkelsteder har research-verifiserte fakta (132 research-fakta, 9 topics dekket der relevant)
- [x] Eksisterende editorial hooks er parset og backfyllt med dedup-tagging — 19 POI-er, 54 fakta
- [x] Admin knowledge-side viser alle fakta med filtre (getAllKnowledgeAdmin)
- [x] POI-detaljsider viser knowledge-seksjoner for steder med data
- [x] `npm run build` passerer

---

## Viktige filer

| Fil | Endring |
|-----|---------|
| `.gitignore` | Legg til `data/research/` |
| `scripts/list-research-targets.ts` | NY — hent POI-manifest |
| `scripts/backfill-knowledge.ts` | NY — JSON → Supabase insert |
| `data/research/manifest.json` | GENERERT — research targets |
| `data/research/{slug}.json` | GENERERT — research output per POI |
| `data/research/editorial/{slug}.json` | GENERERT — editorial backfill |

---

## Rekkefølge / avhengigheter

```
1. .gitignore update                      <- trivielt, gjør først
2. list-research-targets.ts               <- fundament for research
3. backfill-knowledge.ts                  <- fundament for insert
4. Research Batch 1 (5 landemerker)       <- avhenger av 2
5. Evaluér + juster prosess              <- avhenger av 4
6. Backfill Batch 1                       <- avhenger av 3 + 4
7. Verifiser i admin + UI                 <- avhenger av 6
8. Research Batch 2-4 (15 steder)         <- avhenger av 5
9. Backfill Batch 2-4                     <- avhenger av 3 + 8
10. Editorial backfill                    <- avhenger av 3, kan kjøres parallelt med 4-9
11. Final verifisering                    <- avhenger av alt
```

**Parallelliserbare steg:**
- 10 (editorial backfill) kan kjøres uavhengig av 4-9 (research)
- Batch 2-4 research kan delvis parallelliseres (4 agenter om gangen)

---

## Autonomi-notater

Høy autonomi for steg 1-3 (scripts) og 10 (editorial backfill).

**Bruker reviewer:**
- Research-output fra steg 4-5 (er faktaene korrekte? riktig tone? riktig kilde?)
- Prompt/prosess-justering i steg 5
- Kurator-review før `display_ready = true` (via admin-side)

---

## Enhancement Summary (Deepened 2026-02-15)

**Research-agenter brukt:** 4 parallelle
**Nøkkelforsterkning:** Dedup-strategi, JSON-validering, kildehierarki, hallusinering-mitigering

### Viktigste forbedringer fra deepening

1. **Hybrid Hash+Batch dedup** — SHA-256 med tekst-normalisering, chunks à 100, `--force` med atomic delete per POI
2. **JSON-validering** — skjema-sjekk per fil + per-fact, logg til validation-errors.log, fortsett ved feil
3. **POI-existens-sjekk** — verifiser at poi_id finnes før insert (unngå FK-violation crash)
4. **Kilde-tier-system** — Tier 1/2/3 med ulike confidence-regler per nivå
5. **Hallusinering-traps** — Nidarosdomen-datoer, Michelin-verifisering, Wikipedia-sirkularitet
6. **sort_order auto-assign** — 0-indeksert per topic per POI (ikke alt = 0)
7. **Editorial ekstraksjon-rubrikk** — 30-100 ord, skip subjektive/perishable, checkpoint etter batch 3+6
8. **URL-normalisering** — `new URL()` for æøå-encoding i source_url

### Edge cases identifisert (P1/P2) + Tech Audit mitigations

| ID | Risiko | Mitigering |
|---|--------|-----------|
| P1.2 | Dedup feiler på whitespace/punctuation-varianter | Normaliser whitespace+case, behold tegnsetting |
| P1.3 | æøå i URL-er gir dedup-feil | `new URL()` normalisering + `isSafeUrl()` |
| P1.4 | Malformed JSON crasher script | Schema-validering + continue-on-error |
| P1.5 | POI slettet mellom manifest og backfill | Verifiser poi_id per chunk, catch FK gracefully |
| P2.1 | Alle facts har sort_order = 0 | `MAX(sort_order)+1` per poi_id+topic |
| P2.4 | 200+ POI-er = 1800 rows, insert blir treg | Batch insert i chunks à 100 |
| TA.1 | XOR-constraint brudd crasher midt i batch | Eksplisitt XOR-validering før insert |
| TA.2 | Dedup fetcher hele place_knowledge-tabellen | Scope til target POI IDs |
| TA.3 | Fast 100ms backoff er unødvendig overhead | Ingen delay; exponential backoff kun ved feil |
| TA.4 | Topic hardcoded → drift fra DB constraint | Import KNOWLEDGE_TOPICS fra lib/types.ts |
| TA.5 | sort_order kolliderer med kurator-sorterte fakta | Auto-append med MAX(sort_order)+1 |

### Research-dokumenter opprettet

| Fil | Innhold |
|-----|---------|
| `docs/solutions/.../idempotent-backfill-patterns-supabase-20260215.md` | 5 dedup-patterns med kode |
| `docs/solutions/.../editorial-parsing-examples-prompts-20260215.md` | 6 eksempler + prompt-maler |
| `docs/solutions/.../research-workflow-poi-fact-finding-20260215.md` | Per-topic søkestrategi, structured_data-skjema, hallusinering-traps |
