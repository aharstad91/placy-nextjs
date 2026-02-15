# Brainstorm: Research Pipeline + Backfill — City Knowledge Base Phase 2

**Dato:** 2026-02-15
**Kontekst:** Phase 1 av City Knowledge Base er levert (PR #37): `place_knowledge`-tabell, TypeScript-typer, queries, POI-detaljside, MapPopupCard, admin-visning. Alt fungerer — mangler bare DATA. Denne brainstormen designer pipeline for å fylle kunnskapsbasen med fakta.

---

## Bakgrunn — Hva trigget dette

Phase 1 bygget infrastrukturen. Nå ser vi tomme knowledge-seksjoner på POI-detaljsidene fordi tabellen er tom. 20 nøkkelsteder i Trondheim trenger research-verifiserte fakta, og 200+ eksisterende editorial hooks bør parses til strukturerte fakta.

### Constraint: Ingen API-nøkkel

Brukeren har Claude Max 20x (høy kapasitet), men **ingen Anthropic API-nøkkel**. Det betyr:
- Kan IKKE kjøre Node.js-scripts som kaller Claude API programmatisk
- All AI-driven research MÅ skje **inne i Claude Code-sesjoner** med WebSearch
- Backfill-scripts (JSON → Supabase) er standard Node.js uten AI-avhengighet

---

## Hva vi bygger

**Tre separate verktøy:**

### 1. Research Target Script (`scripts/list-research-targets.ts`)
Henter POI-er fra Supabase som trenger research. Outputter en manifest-fil (`data/research/manifest.json`) med:
- POI ID, navn, adresse, kategori, eksisterende editorial_hook
- Hvilke topics som allerede har fakta (skip de)
- Prioritering: Tier 1 først, deretter Tier 2

### 2. Research Workflow (Claude Code + WebSearch)
Ikke et script — en **strukturert prosess** som kjøres i Claude Code:
- Les manifest → velg batch (5 POI-er)
- For hver POI: WebSearch per relevant topic
- Output: JSON-fil per POI i `data/research/{poi-slug}.json`
- Kan spawne Task-agenter for parallellitet (maks 4)
- Bruker `/curator`-skillen for fact_text-formulering

### 3. Backfill Script (`scripts/backfill-knowledge.ts`)
Standard Node.js script som:
- Leser JSON-filer fra `data/research/`
- Inserter til `place_knowledge` via Supabase service_role
- Idempotent: dedup på poi_id + topic + SHA-256 hash av fact_text
- Default: `display_ready = false`, `confidence = 'unverified'`
- `--dry-run` for preview, `--force` for re-insert

---

## Designbeslutninger

### 1. Tre separate steg, ikke ett script

**Valg:** Research targets → Claude Code research → Backfill insert

**Begrunnelse:**
- Human review mellom research og insert (kvalitetskontroll)
- Research kan ta timer/dager — backfill tar sekunder
- Ulike teknologier: Node.js for DB-arbeid, Claude Code for AI-research
- JSON-filer som mellomformat gir versjonerbar output

### 2. Claude Code med WebSearch for research (ikke API)

**Valg:** Research skjer i Claude Code-sesjoner med WebSearch-verktøyet.

**Begrunnelse:**
- Ingen API-nøkkel tilgjengelig
- Claude Max 20x gir rikelig kapasitet
- WebSearch-verktøyet i Claude Code er allerede tilgjengelig
- Task-agenter kan parallellisere (4 om gangen)
- Manuell kontroll over research-kvalitet

### 3. Alle 9 topics for alle 20 steder

**Valg:** Maksimal dekning — ikke begrenset til "relevante" topics.

**Begrunnelse:**
- Brukeren ønsker så mye data som mulig
- Tomme topics er OK — scriptet skipper de uten funn
- 20 steder × 9 topics = opptil 180 fakta (realistisk ~100-120, noen topics vil være tomme for noen steder)
- Bedre å ha for mye data og kuratere ned enn å mangle fakta

### 4. JSON per POI, ikke per topic

**Valg:** `data/research/nidarosdomen.json` inneholder ALLE topics for den POI-en.

**Begrunnelse:**
- Lettere å review per sted (se alt om Nidarosdomen i én fil)
- Backfill-scriptet itererer over filer, ikke topics
- Lettere å re-researche ett sted uten å røre andre

### 5. Curator-stemme for fact_text

**Valg:** Research-prosessen bruker `/curator`-skillen for fact_text-formulering.

**Begrunnelse:**
- Fakta skal leses av brukere på POI-detaljsiden
- Curator-prinsippene (navngi, bevegelse, saklig entusiasme) gjelder
- Tidsregelen: historisk tilknytning er trygg, nåværende er skjør
- NO primærspråk, EN med mer forklarende kontekst

### 6. Editorial backfill som inline Claude Code-prosess

**Valg:** Claude Code leser alle POI-er med editorial_hook, parser inline, outputter JSON.

**Begrunnelse:**
- Ingen API-nøkkel → kan ikke kjøre batch-script
- ~200 hooks à 80-150 tegn = lite data, håndterbart i én sesjon
- Claude Code kan verifisere fakta-ekstraksjon direkte
- Tagges med `source_name: 'Placy editorial (backfill 038)'` for dedup

---

## Research Output Format

```json
{
  "poi_id": "abc123",
  "poi_name": "Nidarosdomen",
  "poi_slug": "nidarosdomen",
  "researched_at": "2026-02-15T14:30:00Z",
  "facts": [
    {
      "topic": "history",
      "fact_text": "Byggearbeidet startet rundt 1070 over graven til Olav den hellige, og katedralen sto ferdig i sin nåværende form på 1300-tallet.",
      "fact_text_en": "Construction began around 1070 over the grave of Saint Olav, and the cathedral reached its current form in the 14th century.",
      "structured_data": {
        "year_start": 1070,
        "century_completed": 14,
        "person": "Olav den hellige",
        "building_type": "katedral"
      },
      "confidence": "verified",
      "source_url": "https://www.nidarosdomen.no/historie",
      "source_name": "Nidarosdomen.no"
    }
  ]
}
```

### Krav per faktum:
- `fact_text`: Norsk, Curator-tone, 1-2 setninger
- `fact_text_en`: Engelsk oversettelse (mer forklarende for internasjonale lesere)
- `structured_data`: Maskinlesbare felter (årstall, personer, materialer)
- `confidence`: "verified" kun hvis 2+ uavhengige kilder bekrefter
- `source_url`: HTTPS-URL til primærkilde
- `source_name`: Lesbart kildenavn

---

## Research-prosess per POI

1. **Forbered kontekst:** Hent POI-data (navn, adresse, kategori, eksisterende hooks)
2. **WebSearch per topic:** Søk "[POI-navn] Trondheim [topic-keyword]"
3. **Verifiser:** Kryss-sjekk mot minst 2 kilder for `verified` confidence
4. **Strukturer:** Ekstraher maskinlesbare felter til `structured_data`
5. **Formuler:** Skriv `fact_text` (NO) og `fact_text_en` (EN) med Curator-stemme
6. **Lagre:** Skriv JSON-fil til `data/research/{slug}.json`

### Topics og søkeord:

| Topic | Søkeord (eksempel for Nidarosdomen) |
|-------|-------------------------------------|
| history | "Nidarosdomen Trondheim historie" |
| architecture | "Nidarosdomen arkitektur byggestil" |
| food | (skip for katedral — topic-relevans) |
| culture | "Nidarosdomen kultur tradisjon" |
| people | "Nidarosdomen historiske personer" |
| nature | (skip for katedral) |
| practical | "Nidarosdomen åpningstider billetter" |
| local_knowledge | "Nidarosdomen hemmeligheter ukjent" |
| spatial | "Nidarosdomen nabolag gangavstand" |

### Multi-agent batching:
- Batch à 5 POI-er
- 4 Task-agenter parallelt (1 POI per agent, alle topics)
- Agent 5 = reconciliation/review
- 4 batches à 5 = 20 POI-er totalt

---

## 20 Nøkkelsteder (Trondheim)

Basert på eksisterende Tier 1-data og landemerke-status:

**Landemerker (7):**
Nidarosdomen, Erkebispegården, Kristiansten festning, Gamle Bybro, Stiftsgården, Torvet, Munkholmen

**Kultur (5):**
Rockheim, Ringve musikmuseum, Vitenskapsmuseet, Sverresborg folkemuseum, Kunstmuseum

**Mat (5):**
Britannia Hotel, Credo, Bakklandet Skydsstation, Ravnkloa, Sellanraa

**Nabolag/Områder (3):**
Bakklandet, Solsiden, Midtbyen

*Justeres basert på faktisk Tier 1-data i databasen.*

---

## Åpne spørsmål

### Hallusinering
WebSearch reduserer risikoen vs. ren LLM-generering, men Claude kan fremdeles feiltolke kilder. Mitigering: `confidence: 'unverified'` som default, manuell kurator-review før `display_ready = true`.

### Rate limits
Claude Max 20x gir ~200 meldinger per 5-timer-vindu. 20 POI-er × ~10 WebSearch-kall per POI = ~200 kall. Kan treffe grensen. Mitigering: kjør i batches over flere sesjoner om nødvendig.

### Duplikater med editorial_hook
Mange fakta i research-output vil overlappe med eksisterende editorial hooks. Mitigering: Backfill-script sjekker for lignende tekst (fuzzy match) og tagger med `source_name` for UI-dedup (allerede implementert i PlaceKnowledgeSection).

---

## Beslutninger

| # | Beslutning | Begrunnelse |
|---|-----------|-------------|
| 1 | Tre separate steg med JSON mellomformat | Human review, ulike teknologier, versjonerbar output |
| 2 | Claude Code + WebSearch for research | Ingen API-nøkkel, Claude Max 20x gir kapasitet |
| 3 | Alle 9 topics for alle 20 steder | Maksimal dekning, kurator-review etterpå |
| 4 | JSON per POI (ikke per topic) | Lettere å review og re-researche |
| 5 | Curator-stemme for fact_text | Konsistent med eksisterende editorial voice |
| 6 | Editorial backfill som inline Claude Code | Ingen API → Claude Code parser direkte |
| 7 | Task-agenter for parallellitet (4 om gangen) | Respekterer CLAUDE.md max 4-grense |
| 8 | Idempotent backfill med SHA-256 dedup | Kan kjøres flere ganger uten duplikater |

---

## Neste steg

Kjør `/plan` med dette som grunnlag:
1. `scripts/list-research-targets.ts` — hent POI-manifest fra Supabase
2. Research-workflow i Claude Code med Task-agenter
3. `scripts/backfill-knowledge.ts` — JSON → Supabase insert
4. Editorial backfill — parse eksisterende hooks inline
5. Pilot: 5 steder først, evaluér, juster, deretter 15 til
