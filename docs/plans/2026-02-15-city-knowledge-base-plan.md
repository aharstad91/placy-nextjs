---
title: "feat: City Knowledge Base — strukturert bykunnskap som IP"
type: feat
date: 2026-02-15
tech_audit: YELLOW — alle mitigeringer applisert
---

# City Knowledge Base — Strukturert bykunnskap som IP

## Overview

Bygg en proprietær kunnskapsbase om norske byer som lagrer strukturerte, verifiserte fakta per sted. Kunnskapen surfacet umiddelbart i eksisterende produkter (POI-detaljsider, MapPopupCard) og danner grunnlaget for fremtidige AI-produkter.

**Første by:** Trondheim. **Pilot:** 20 nøkkelsteder med research fra alle topics.

**Brainstorm-referanse:** `docs/brainstorms/2026-02-15-city-knowledge-base-brainstorm.md`

---

## Teknisk kontekst

### Eksisterende infrastruktur
- **POI-tabell:** 1000+ POIs med `editorial_hook`, `local_insight`, `poi_metadata` (JSONB, stort sett tom)
- **Areas:** `areas`-tabell med `trondheim` som eneste by
- **POI-detaljside:** `app/(public)/[area]/steder/[slug]/page.tsx` — viser editorial_hook, local_insight, bilde, Google-data, lignende POIs, statisk kart
- **MapPopupCard:** `components/variants/report/MapPopupCard.tsx` — viser editorial_hook, local_insight, åpningstider, action-knapper
- **Queries:** `getPOIBySlug()`, `getSimilarPOIs()` i `lib/public-queries.ts`; admin-queries i `lib/supabase/queries.ts`
- **Typer:** `POI`-interface i `lib/types.ts` med 30+ felter; DB-typer i `lib/supabase/types.ts`
- **Migrasjoner:** Neste er `036_*`

### Kjente begrensninger
- `poi_metadata` JSONB er ustrukturert — ingen schema, ingen indeksering
- POI-detaljsiden er relativt tynn — editorial_hook + local_insight + Google-data
- MapPopupCard har begrenset plass — 300px bred
- `editorial_sources TEXT[]` finnes i schema men er ubrukt
- `getPOIBySlug()` gjør full-table scan (pre-eksisterende tech debt, notert men utenfor scope)

---

## Tech Audit Mitigeringer

Følgende endringer er applisert basert på tech audit (YELLOW):

| # | Funn | Mitigering |
|---|------|-----------|
| 1 | Orphaned rows (poi_id OG area_id NULL) | XOR CHECK constraint |
| 2 | Dual-write editorial_hook + backfill | Backfill tagges med source_name, UI dedup-logikk |
| 3 | area_id ON DELETE CASCADE inkonsistent | Endret til ON DELETE RESTRICT |
| 4 | Mangler BEGIN/COMMIT | Lagt til transaksjon |
| 5 | Sekvensiell query-waterfall | Promise.all() for uavhengige queries |
| 6 | Admin trenger service_role | Split queries: public vs admin |
| 7 | source_url open redirect | isSafeUrl() + SQL CHECK |
| 8 | Engelsk fallback udefinert | Fall tilbake til norsk fact_text |
| 9 | Mangler length-check | CHECK (length > 0) |
| 10 | verified_at inkonsistens | Auto-trigger |

---

## Oppgaver

### 1. DB-migrasjon: `place_knowledge`-tabell

**Fil:** `supabase/migrations/036_place_knowledge.sql`

```sql
-- Migration: 036_place_knowledge
-- Description: Create place_knowledge table for structured city facts
-- Feature: City Knowledge Base (IP)
-- Tech audit: All 10 mitigations applied

BEGIN;

CREATE TABLE place_knowledge (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,

  -- Kobling til sted (nøyaktig én av disse MÅ settes)
  poi_id TEXT REFERENCES pois(id) ON DELETE CASCADE,
  area_id TEXT REFERENCES areas(id) ON DELETE RESTRICT,

  -- Klassifisering
  topic TEXT NOT NULL,

  -- Innhold
  fact_text TEXT NOT NULL,
  fact_text_en TEXT,
  structured_data JSONB DEFAULT '{}',

  -- Kvalitet
  confidence TEXT NOT NULL DEFAULT 'unverified',

  -- Kilde
  source_url TEXT,
  source_name TEXT,

  -- Sortering og synlighet
  sort_order INTEGER DEFAULT 0,
  display_ready BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,

  -- Named constraints (enkle å endre med ALTER senere)
  CONSTRAINT place_knowledge_topic_valid CHECK (topic IN (
    'history', 'architecture', 'food', 'culture', 'people',
    'nature', 'practical', 'local_knowledge', 'spatial'
  )),
  CONSTRAINT place_knowledge_confidence_valid CHECK (confidence IN (
    'verified', 'unverified', 'disputed'
  )),
  -- XOR: nøyaktig én forelder (audit mitigering #1)
  CONSTRAINT place_knowledge_parent_check CHECK (
    (poi_id IS NOT NULL AND area_id IS NULL) OR
    (poi_id IS NULL AND area_id IS NOT NULL)
  ),
  -- Forhindre tomme strenger (audit mitigering #9)
  CONSTRAINT place_knowledge_fact_text_nonempty CHECK (length(fact_text) > 0),
  -- source_url må være http/https (audit mitigering #7)
  CONSTRAINT place_knowledge_source_url_safe CHECK (
    source_url IS NULL OR source_url ~ '^https?://'
  )
);

-- Indexes optimert for faktiske query-mønstre
-- Public queries: WHERE poi_id = $1 AND display_ready = true ORDER BY sort_order
CREATE INDEX idx_pk_poi_display ON place_knowledge(poi_id, sort_order)
  WHERE poi_id IS NOT NULL AND display_ready = true;

-- Area queries: WHERE area_id = $1 AND display_ready = true ORDER BY sort_order
CREATE INDEX idx_pk_area_display ON place_knowledge(area_id, sort_order)
  WHERE area_id IS NOT NULL AND display_ready = true;

-- Admin queries (ingen display_ready filter)
CREATE INDEX idx_pk_topic ON place_knowledge(topic);
CREATE INDEX idx_pk_poi_topic ON place_knowledge(poi_id, topic, sort_order)
  WHERE poi_id IS NOT NULL;
CREATE INDEX idx_pk_area_topic ON place_knowledge(area_id, topic, sort_order)
  WHERE area_id IS NOT NULL;

-- Step 2: Triggers

-- Auto-update updated_at (gjenbruk eksisterende funksjon)
CREATE TRIGGER update_place_knowledge_updated_at
  BEFORE UPDATE ON place_knowledge
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-set verified_at når confidence → 'verified' (audit mitigering #10)
CREATE OR REPLACE FUNCTION set_place_knowledge_verified_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.confidence = 'verified' AND (OLD IS NULL OR OLD.confidence != 'verified') THEN
    NEW.verified_at = NOW();
  ELSIF NEW.confidence != 'verified' THEN
    NEW.verified_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_place_knowledge_verified_at_trigger
  BEFORE INSERT OR UPDATE OF confidence ON place_knowledge
  FOR EACH ROW EXECUTE FUNCTION set_place_knowledge_verified_at();

-- Step 3: Row Level Security

ALTER TABLE place_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read display-ready knowledge" ON place_knowledge
  FOR SELECT USING (display_ready = true);

CREATE POLICY "Service role full access" ON place_knowledge
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
```

**Verifisering:**
- [ ] Migrasjon kjører: `source .env.local && supabase db push --password "$DATABASE_PASSWORD"`
- [ ] `npm run build` kompilerer

---

### 2. TypeScript-typer

**Filer:** `lib/types.ts` + `lib/supabase/types.ts`

**I `lib/types.ts`:**

```typescript
// === Place Knowledge Types ===

export const KNOWLEDGE_TOPICS = [
  'history', 'architecture', 'food', 'culture', 'people',
  'nature', 'practical', 'local_knowledge', 'spatial'
] as const;

export type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number];

export const KNOWLEDGE_TOPIC_LABELS: Record<KnowledgeTopic, string> = {
  history: 'Historikk',
  architecture: 'Arkitektur',
  food: 'Mat & drikke',
  culture: 'Kultur',
  people: 'Mennesker',
  nature: 'Natur',
  practical: 'Praktisk',
  local_knowledge: 'Visste du?',
  spatial: 'I nærheten',
};

export const KNOWLEDGE_TOPIC_LABELS_EN: Record<KnowledgeTopic, string> = {
  history: 'History',
  architecture: 'Architecture',
  food: 'Food & drink',
  culture: 'Culture',
  people: 'People',
  nature: 'Nature',
  practical: 'Practical',
  local_knowledge: 'Did you know?',
  spatial: 'Nearby',
};

export type KnowledgeConfidence = 'verified' | 'unverified' | 'disputed';

export interface PlaceKnowledge {
  id: string;
  poiId?: string;
  areaId?: string;
  topic: KnowledgeTopic;
  factText: string;
  factTextEn?: string;
  structuredData?: Record<string, unknown>;
  confidence: KnowledgeConfidence;
  sourceUrl?: string;
  sourceName?: string;
  sortOrder: number;
  displayReady: boolean;
  verifiedAt?: string;
}
```

**I `lib/supabase/types.ts`:** (audit mitigering — DbPlaceKnowledge)

```typescript
// KNOWLEDGE TABLES (available after migration 036)
// Legg til place_knowledge i Database-typen og:
export type DbPlaceKnowledge = Tables<"place_knowledge">;
```

- [x] Legg til typer i `lib/types.ts` (med `(typeof X)[number]` parentes-stil)
- [x] Legg til `DbPlaceKnowledge` i `lib/supabase/types.ts`
- [x] `npm run build` kompilerer

---

### 3. Query-funksjoner

**Filer:** `lib/public-queries.ts` (public) + `lib/supabase/queries.ts` (admin)

**Audit-krav:** Split queries — public bruker `createPublicClient()` (RLS), admin bruker `createServerClient()` (service_role).

**I `lib/public-queries.ts`:**

```typescript
import { isSafeUrl } from "@/lib/utils/url";

function transformPlaceKnowledge(row: DbPlaceKnowledge): PlaceKnowledge {
  return {
    id: row.id,
    poiId: row.poi_id ?? undefined,
    areaId: row.area_id ?? undefined,
    topic: row.topic as KnowledgeTopic,
    factText: row.fact_text,
    factTextEn: row.fact_text_en ?? undefined,
    structuredData: row.structured_data ?? undefined,
    confidence: row.confidence as KnowledgeConfidence,
    sourceUrl: row.source_url && isSafeUrl(row.source_url) ? row.source_url : undefined,
    sourceName: row.source_name ?? undefined,
    sortOrder: row.sort_order ?? 0,
    displayReady: row.display_ready ? true : false,
    verifiedAt: row.verified_at ?? undefined,
  };
}

// Hent all display-ready kunnskap for en POI
// ORDER BY topic, sort_order, created_at for deterministisk rekkefølge
export async function getPlaceKnowledge(poiId: string): Promise<PlaceKnowledge[]> {
  const client = createPublicClient();
  if (!client) return [];

  const { data, error } = await client
    .from("place_knowledge")
    .select("*")
    .eq("poi_id", poiId)
    .eq("display_ready", true)
    .order("topic")
    .order("sort_order")
    .order("created_at");

  if (error || !data) return [];
  return data.map(transformPlaceKnowledge);
}

// Batch-hent for listevisninger (maks 100 IDs)
export async function getPlaceKnowledgeBatch(
  poiIds: string[]
): Promise<Record<string, PlaceKnowledge[]>> {
  if (poiIds.length === 0) return {};
  const limitedIds = poiIds.slice(0, 100); // Cap for query plan

  const client = createPublicClient();
  if (!client) return {};

  const { data, error } = await client
    .from("place_knowledge")
    .select("*")
    .in("poi_id", limitedIds)
    .eq("display_ready", true)
    .order("sort_order");

  if (error || !data) return {};

  const result: Record<string, PlaceKnowledge[]> = {};
  for (const row of data) {
    const id = row.poi_id as string;
    if (!result[id]) result[id] = [];
    result[id].push(transformPlaceKnowledge(row));
  }
  return result;
}

// Hent kunnskap for et område (by/nabolag)
export async function getAreaKnowledge(areaId: string): Promise<PlaceKnowledge[]> {
  const client = createPublicClient();
  if (!client) return [];

  const { data, error } = await client
    .from("place_knowledge")
    .select("*")
    .eq("area_id", areaId)
    .eq("display_ready", true)
    .order("topic")
    .order("sort_order");

  if (error || !data) return [];
  return data.map(transformPlaceKnowledge);
}
```

**I `lib/supabase/queries.ts`:** (admin — service_role, ser alle rader)

```typescript
// Admin: hent alle knowledge-rader (inkl. non-display-ready)
export async function getAllKnowledgeAdmin(): Promise<PlaceKnowledge[]> {
  const client = createServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from("place_knowledge")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(transformPlaceKnowledge);
}
```

- [x] Implementer public queries i `lib/public-queries.ts` med `createPublicClient()`
- [x] Implementer admin query i `lib/supabase/queries.ts` med `createServerClient()`
- [x] Transform-funksjon med `isSafeUrl()` for source_url (audit #7)
- [x] ORDER BY topic, sort_order, created_at
- [x] Batch-funksjon med 100 ID cap
- [x] Client null-guard i alle funksjoner

---

### 4. POI-detaljside: Kunnskapsseksjoner

**Fil:** `app/(public)/[area]/steder/[slug]/page.tsx`

Utvid eksisterende detaljside med knowledge-seksjoner etter editorial_hook og local_insight:

```
[Eksisterende: Bilde + Navn + Kategori]
[Eksisterende: Editorial Hook (italic callout)]
[Eksisterende: Local Insight]
─────────────────────────────────
[NY: Historikk]           ← topic: history
[NY: Arkitektur]          ← topic: architecture
[NY: Visste du?]          ← topic: local_knowledge
[NY: Mennesker]           ← topic: people
─────────────────────────────────
[Eksisterende: Lignende steder]
```

**Audit-krav: Parallelliser uavhengige queries (#5):**

```typescript
// ETTER area + poi er hentet (sekvensielt, avhenger av hverandre):
const [similar, knowledge, allCategorySlugs] = await Promise.all([
  getSimilarPOIs(area.id, poi.category.id, poi.id, 4),
  getPlaceKnowledge(poi.id),
  getCategoriesForArea(area.id, "no"),
]);
```

**Komponent:** `components/public/PlaceKnowledgeSection.tsx` (NB: `public/`, IKKE `place/`)

```typescript
interface Props {
  knowledge: PlaceKnowledge[];
  locale: 'no' | 'en';
  hasEditorialHook?: boolean; // For dedup-logikk
}
```

**Logikk:**
- Gruppér fakta etter topic
- Render kun topics som har data (ingen tomme seksjoner)
- Bruk `KNOWLEDGE_TOPIC_LABELS` / `_EN` for overskrifter
- Vis `source_name` som diskret kildehenvisning per faktum (link med `isSafeUrl()` hvis source_url finnes)
- Kun `display_ready = true` vises (håndteres av RLS + query)
- **Engelsk fallback (audit #8):** Bruk `fact_text_en ?? fact_text` — fall tilbake til norsk
- **Dedup (audit #2):** Filtrer bort fakta med `source_name` som inneholder 'backfill' HVIS `hasEditorialHook` er true
- **Server Component** — ingen `"use client"`, null bundle size impact
- Plassér innenfor `lg:col-span-2` for å holde sidebar synlig på desktop
- Semantisk HTML: `<section>` per topic med `<h3>` overskrift (under eksisterende `<h2>`-nivå)

- [x] Ny komponent `components/public/PlaceKnowledgeSection.tsx`
- [x] Integrer i detaljsiden med `Promise.all()` parallellisering
- [x] Betinget rendering — ingen kunnskaps-seksjon hvis 0 fakta
- [x] Engelsk fallback: `fact_text_en ?? fact_text`
- [x] Dedup-logikk for backfill vs editorial_hook
- [x] Render `fact_text` via JSX text interpolation (ALDRI `dangerouslySetInnerHTML`)
- [x] `isSafeUrl()` på source_url lenker

---

### 5. MapPopupCard: Innsikt-snippet

**Fil:** `components/variants/report/MapPopupCard.tsx`

Legg til 1 faktum fra kunnskapsbasen under editorial_hook.

**Data-flow (audit-krav):**
1. `getPlaceKnowledgeBatch(poiIds)` kalles på **side-nivå** (Report page / Explorer page)
2. Resultat `Record<string, PlaceKnowledge[]>` sendes som prop til map-komponent
3. Map-komponent sender relevant slice `knowledge={knowledgeMap[poi.id]}` til MapPopupCard

**Logikk:**
- Vis maks 1 faktum fra `local_knowledge` eller `history` topic (i den rekkefølgen)
- Kort tekst, line-clamped til 2 linjer
- Kun hvis `PlaceKnowledge[]` er ikke-tom
- Diskret styling — ikke konkurrere med editorial_hook

- [x] Utvid MapPopupCard props med `knowledge?: PlaceKnowledge[]`
- [x] Vis snippet mellom editorial_hook og action-knapper
- [x] Diskret styling, line-clamp-2
- [x] Pre-fetch på side-nivå, ALDRI per-popup query

---

### 6. Research agent-prompt

**Fil:** `scripts/research-place-knowledge.ts`

Et script som kan kjøres per sted eller per nabolag. Bruker WebSearch for research og outputter strukturert JSON.

**Input:** POI-navn + koordinater + eksisterende data (category, editorial_hook)
**Output:** Array av `PlaceKnowledge`-objekter klare for INSERT

**Script-mønster:** Følg `scripts/seed-trips.ts` (Supabase SDK, dotenv, JSDoc header):

```typescript
/**
 * Research place knowledge for POIs using web search.
 *
 * Usage:
 *   npx tsx scripts/research-place-knowledge.ts --poi-id <id>
 *   npx tsx scripts/research-place-knowledge.ts --batch --area trondheim
 *   npx tsx scripts/research-place-knowledge.ts --dry-run
 *   npx tsx scripts/research-place-knowledge.ts --topic history
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
```

**Prompt-mal per topic:**

```
Du er en research-agent for Placy sin kunnskapsbase.

STED: {poi.name}
ADRESSE: {poi.address}
KATEGORI: {poi.category}
EKSISTERENDE INFO: {poi.editorialHook}

OPPGAVE: Research {topic} for dette stedet.

REGLER:
1. Bruk WebSearch for å finne fakta. Verifiser mot minst 2 kilder.
2. Skriv fact_text på norsk, presist og engasjerende (Curator-tone).
3. Skriv fact_text_en på engelsk (alltid inkluder oversettelse).
4. Inkluder årstall, navn, og spesifikke detaljer.
5. Returner structured_data med maskinlesbare felter.
6. Oppgi source_url (https://) og source_name for hver kilde.
7. Marker confidence: "verified" kun hvis 2+ uavhengige kilder bekrefter.
8. KUN verifiserbare fakta — SKIP subjektive beskrivelser og meninger.

OUTPUT FORMAT (JSON array):
[
  {
    "topic": "{topic}",
    "fact_text": "...",
    "fact_text_en": "...",
    "structured_data": { ... },
    "confidence": "verified|unverified",
    "source_url": "https://...",
    "source_name": "..."
  }
]
```

**Feilhåndtering:**
- Retry 3x med exponential backoff ved WebSearch-feil
- Skip topic etter 3 mislykkede forsøk, logg til stderr
- Skip hooks kortere enn 50 tegn (for lite å parse)

**Output:** JSON-filer i `data/research/` (gitignored) for review før INSERT.

- [ ] JSDoc header med usage-eksempler
- [ ] Skriv prompt-maler for alle 9 topics
- [ ] Script med --poi-id, --batch, --dry-run, --topic flagg
- [ ] Output til `data/research/` (legg til i `.gitignore`)
- [ ] Retry-logikk (3x exponential backoff)
- [ ] Idempotent: sjekk eksisterende fakta før INSERT (unngå duplikater)
- [ ] Default: `confidence: 'unverified'`, `display_ready: false`

---

### 7. Pilot: 20 nøkkelsteder i Trondheim

Research 20 Tier 1/landemerke-steder med alle relevante topics.

**Steder (foreslått — justeres basert på eksisterende Tier 1-data):**

Landemerker: Nidarosdomen, Erkebispegården, Kristiansten festning, Gamle Bybro, Stiftsgården, Torvet
Kultur: Rockheim, Ringve musikmuseum, Vitenskapsmuseet, Sverresborg folkemuseum
Mat: Britannia Hotel, Sellanraa, Bakklandet Skydsstation, Ravnkloa, Credo
Nabolag: Bakklandet, Solsiden, Midtbyen, Ila, Brattøra

**Prosess:**
1. Kjør research-script for 5 steder x 4 topics (batch 1)
2. Review output — juster prompts ved behov
3. Kjør for resterende 15 steder (maks 4 parallelle agenter per batch)
4. Kurator-review: marker som `display_ready` og `verified` via admin-side
5. INSERT til Supabase

- [ ] Velg 20 steder fra eksisterende Tier 1-POIs
- [ ] Batch 1: 5 steder, evaluér output
- [ ] Juster prompts basert på kvalitet
- [ ] Batch 2-4: resterende 15 steder
- [ ] Kurator-review og verification pass
- [ ] INSERT alle fakta

---

### 8. Backfill: Parse eksisterende editorial hooks

**Fil:** `scripts/backfill-knowledge-from-editorial.ts`

Parse eksisterende `editorial_hook` og `local_insight` for alle POIs med redaksjonelt innhold til `place_knowledge`-fakta.

**Eksempel:**
```
editorial_hook: "Grunnlagt av kokken Heidi Bjerkan i 2019, Credo holder
én Michelin-stjerne og bruker kun norske råvarer innenfor 30 mils radius."

-> place_knowledge:
  topic: "food", fact_text: "Bruker kun norske råvarer innenfor 30 mils radius"
  topic: "people", fact_text: "Grunnlagt av kokken Heidi Bjerkan i 2019"
  topic: "culture", fact_text: "Holder én Michelin-stjerne"
```

**Tilnærming:** Bruk Claude API til å parse — ikke regex. Editorial hooks er for varierte i struktur.

**Audit-krav (dedup #2):**
- Alle backfill-fakta tagges med `source_name: 'Placy editorial (backfill 036)'`
- PlaceKnowledgeSection bruker dette for å unngå duplisering med editorial_hook
- `editorial_hook` og `local_insight` beholdes på `pois`-tabellen (legacy, IKKE slett)

**Prompt-instruksjoner:**
- KUN verifiserbare fakta — skip subjektive beskrivelser ("koselig atmosfære", "perfekt for en regnværsdag")
- Skip hooks kortere enn 50 tegn
- Inkluder `fact_text_en` oversettelse for alle fakta

**Script-mønster:** Følg `seed-trips.ts` med upsert-logikk og `--force` flagg.

- [ ] Script som leser alle POIs med editorial_hook (skip < 50 tegn)
- [ ] Claude API-kall per hook -> strukturerte fakta (kun verifiserbare fakta)
- [ ] Output JSON for review
- [ ] INSERT med `confidence: 'verified'`, `display_ready: false` (kurator aktiverer)
- [ ] `source_name: 'Placy editorial (backfill 036)'` for dedup-tagging
- [ ] Inkluder `fact_text_en` for alle fakta
- [ ] Etter INSERT: POST til `/api/admin/revalidate` for cache-oppdatering (learnings)

---

### 9. Admin-visning

**Filer:** `app/admin/knowledge/page.tsx` + `app/admin/knowledge/knowledge-admin-client.tsx`

**Audit-krav:** Følg trips admin-mønster nøyaktig.

**Server page (`page.tsx`):**
```typescript
import { redirect } from "next/navigation";
import { getAllKnowledgeAdmin } from "@/lib/supabase/queries";
import { KnowledgeAdminClient } from "./knowledge-admin-client";

export const dynamic = "force-dynamic"; // MÅ ha for admin (learnings)

const adminEnabled = process.env.ADMIN_ENABLED === "true";

export default async function KnowledgeAdminPage() {
  if (!adminEnabled) redirect("/");
  const knowledge = await getAllKnowledgeAdmin();
  return <KnowledgeAdminClient knowledge={knowledge} />;
}
```

**Client component (`knowledge-admin-client.tsx`):** `"use client"`

**Funksjonalitet:**
- [x] Tabell med alle `place_knowledge`-rader
- [x] Filter: per POI, per topic, per confidence, per display_ready
- [x] Tellere: totalt fakta, verified %, topics-fordeling
- [x] **Minimal edit:** Toggle `display_ready` og `confidence` per rad (audit-krav for kurator-workflow)
- [x] Link fra admin POI-liste til knowledge-filter for den POI-en
- [x] Sidebar-nav: ny "Kunnskap" item med `BookOpen`-ikon i `components/admin/admin-sidebar.tsx`
- [x] `export const dynamic = "force-dynamic"` (learnings)
- [x] `ADMIN_ENABLED` guard
- [ ] `revalidatePath()` etter mutations

---

### 10. Verifisering og opprydding

- [x] **Build:** `npm run build` kompilerer uten feil
- [x] **Lint:** `npm run lint` ingen nye feil
- [ ] **Detaljside:** Verifiser at knowledge-seksjoner vises for pilotstedene
- [ ] **Tom state:** Verifiser at steder uten knowledge ikke viser tomme seksjoner
- [ ] **MapPopupCard:** Innsikt-snippet vises for steder med knowledge
- [ ] **Admin:** Knowledge-oversikt viser korrekte tall + toggle fungerer
- [ ] **Engelsk:** EN-versjon bruker `fact_text_en` med fallback til `fact_text`
- [ ] **Dedup:** POIs med editorial_hook viser IKKE dupliserte backfill-fakta
- [ ] **Security:** source_url lenker bruker `isSafeUrl()`, fact_text via JSX (ikke dangerouslySetInnerHTML)

---

## Akseptkriterier

- [ ] `place_knowledge`-tabell finnes i Supabase med XOR constraint, named constraints, og RLS
- [ ] TypeScript-typer for `PlaceKnowledge`, `KnowledgeTopic`, labels NO+EN, `DbPlaceKnowledge`
- [ ] POI-detaljsiden viser knowledge-seksjoner gruppert etter topic (parallellisert med Promise.all)
- [ ] MapPopupCard viser 1 knowledge-snippet for steder som har data (pre-fetched på side-nivå)
- [ ] 20 nøkkelsteder har research-verifiserte fakta i kunnskapsbasen
- [ ] Backfill fra eksisterende editorial hooks gir umiddelbar dekning (tagget for dedup)
- [ ] Admin-side viser knowledge-inventar med filtre + toggle display_ready/confidence
- [ ] `npm run build` og `npm run lint` passerer
- [ ] Engelsk fallback til norsk når `fact_text_en` er NULL

---

## Viktige filer

| Fil | Endring |
|-----|---------|
| `supabase/migrations/036_place_knowledge.sql` | NY — kunnskapstabell med audit-mitigeringer |
| `lib/types.ts` | Legg til PlaceKnowledge, KnowledgeTopic, labels |
| `lib/supabase/types.ts` | Legg til DbPlaceKnowledge |
| `lib/public-queries.ts` | Nye public queries: getPlaceKnowledge, batch, area |
| `lib/supabase/queries.ts` | Ny admin query: getAllKnowledgeAdmin |
| `components/public/PlaceKnowledgeSection.tsx` | NY — rendrer kunnskapsseksjoner |
| `app/(public)/[area]/steder/[slug]/page.tsx` | Integrer knowledge + Promise.all |
| `app/(public)/en/[area]/places/[slug]/page.tsx` | Integrer knowledge (EN) |
| `components/variants/report/MapPopupCard.tsx` | Legg til knowledge-snippet |
| `scripts/research-place-knowledge.ts` | NY — research agent-script |
| `scripts/backfill-knowledge-from-editorial.ts` | NY — parse editorial -> knowledge |
| `app/admin/knowledge/page.tsx` | NY — admin server page |
| `app/admin/knowledge/knowledge-admin-client.tsx` | NY — admin client component |
| `components/admin/admin-sidebar.tsx` | Ny "Kunnskap" nav-item |

---

## Rekkefølge / avhengigheter

```
1. DB-migrasjon (036)                        <- fundament, må først
2. TypeScript-typer (types.ts + supabase/types.ts) <- avhenger av 1
3. Query-funksjoner (public + admin)         <- avhenger av 2
4. Research agent-prompt + script            <- avhenger av 2 (output-format)
5. Pilot: 5 steder (batch 1)                <- avhenger av 4
6. Evaluér + juster prompts                  <- avhenger av 5
7. Pilot: 15 steder (batch 2-4)             <- avhenger av 6
8. Backfill fra editorial hooks              <- avhenger av 2, kan parallelliseres med 5-7
9. PlaceKnowledgeSection komponent           <- avhenger av 3
10. Integrer i POI-detaljside (NO + EN)      <- avhenger av 9
11. MapPopupCard snippet                     <- avhenger av 3, kan parallelliseres med 9-10
12. Admin-visning (server + client)          <- avhenger av 3, kan parallelliseres med 9-11
13. Verifisering + opprydding               <- avhenger av alt
```

**Parallelliserbare steg:**
- 8 (backfill) kan kjøre samtidig som 5-7 (pilot research)
- 9-10 (frontend) kan kjøre samtidig som 11 (MapPopupCard) og 12 (admin)

---

## Bevisst deferred (etter tech audit)

Følgende er schema-klare men har INGEN UI i denne planen:
- **Area-level kunnskap:** XOR constraint tillater `area_id` uten `poi_id`, men ingen visningskomponent. Pilot fokuserer på POI-level.
- **JSON-LD / SEO markup:** Knowledge-innhold på siden, men ingen `FAQPage` eller `Article` structured data ennå.
- **Admin: full CRUD:** Kun toggle display_ready + confidence. Full create/edit/delete er fremtidig.

---

## Autonomi-notater

Høy autonomi for steg 1-4, 8-12 (kode + migrasjoner).

**Bruker reviewer:**
- Research-output fra steg 5-7 (er faktaene korrekte? riktig tone?)
- Prompt-justering i steg 6 (er agent-promptene gode nok?)
- Visuell review av knowledge-seksjoner på detaljsiden
- Visuell review av MapPopupCard snippet

---

## Fremtidige utvidelser (IKKE i scope)

- pgvector embeddings for semantisk søk
- AI chat-grensesnitt over kunnskapsbasen
- Automatisk tur-generering fra knowledge
- Personaliserte opplevelser basert på preferanser
- Flere byer (Bergen, Oslo, Stavanger, Tromsø)
- "I nærheten"-seksjonen basert på spatial knowledge
- Area-level knowledge visning (by/nabolag-sider)
- JSON-LD enrichment for SEO
- Full admin CRUD for knowledge-fakta
