---
title: "feat: Knowledge Base Taxonomy v0.2 — 5 kategorier, 19 sub-topics"
type: feat
date: 2026-02-16
deepened: 2026-02-16
---

# feat: Knowledge Base Taxonomy v0.2

## Enhancement Summary

**Deepened on:** 2026-02-16
**Research agents used:** learnings-researcher, codebase-explorer, best-practices-researcher, architecture-strategist

### Key Improvements
1. Migration wrapped in transaction with `IF EXISTS` for idempotency
2. `as const satisfies` pattern for compile-time exhaustiveness on category-topic mapping
3. Optimized UI grouping: single-pass Map instead of repeated `.filter()` per category
4. MapPopupCard snippet selection updated for expanded topic set
5. Admin filter grouped by category (not flat 20-button list)

### New Considerations Discovered
- Supabase `gen types` does NOT generate union types from CHECK constraints — type safety comes from `lib/types.ts` only
- `components/variants/report/MapPopupCard.tsx:41` has hardcoded `local_knowledge` / `history` priority — needs updating
- 7 files total import KNOWLEDGE_TOPICS — all auto-adapt except MapPopupCard
- PlaceKnowledgeSection is a server component — no `useMemo` needed

---

## Overview

Utvide knowledge-taksonomien fra 9 flate topics til 5 kategorier med 19 sub-topics. Kategoriene grupperer relaterte fakta slik at de kan sys sammen til sammenhengende tekster per POI.

**Bakgrunn:** v0.1 leverte 226 fakta for 20 Trondheim-POI-er. Kurator-review avdekket at innholdet "lekker" mellom topics — stemning havner i architecture, drikke i food, insider-tips i local_knowledge. Nye topics trengs, og de må grupperes logisk.

## Proposed Solution

### Ny taksonomi

```
Historien (story)          Opplevelsen (experience)     Smaken (taste)
├── history                ├── atmosphere               ├── food
├── people                 ├── signature                ├── drinks
├── awards                 ├── culture                  └── sustainability
├── media                  ├── seasonal
└── controversy

Stedet (place)             Innsiden (inside)
├── architecture           ├── practical
├── spatial                ├── insider
├── nature                 └── relationships
└── accessibility
```

**19 sub-topics** (opp fra 9), **5 kategorier** (ny).

### Hva er nytt vs eksisterende

| Status | Topics |
|--------|--------|
| **Beholder** (9) | history, architecture, food, culture, people, nature, practical, spatial |
| **Rename** (1) | local_knowledge → `insider` |
| **Nye** (9) | atmosphere, signature, awards, media, controversy, drinks, sustainability, seasonal, relationships, accessibility |
| **Nytt konsept** | Kategori-gruppering (kun TypeScript, ikke DB) |

### Håndtering av `local_knowledge`

Beholder `local_knowledge` i DB-constraint for bakoverkompatibilitet. Legger til `insider` som ny topic. Kategori-mappingen plasserer begge under "Innsiden". Gradvis migrering av eksisterende `local_knowledge`-fakta til `insider` kan gjøres manuelt eller i neste research-runde.

### Research Insight: Kategorier kun i TypeScript er riktig

**Arkitektur-review bekrefter:** Kategorier er et presentasjons-konsern, ikke et data-konsern. DB lagrer atomiske fakta med topic-klassifisering. Hvordan topics grupperes for visning er en UI-beslutning som kan utvikle seg uavhengig av dataen. Å legge kategorier i DB ville bety enten en overflødig `category`-kolonne (deriverbar fra topic) eller en separat tabell (overengineered for statisk gruppering).

## Technical Approach

### Steg 1: Postgres-migrasjon (ny CHECK constraint)

```sql
-- supabase/migrations/040_knowledge_taxonomy_v02.sql

BEGIN;

-- Idempotent: IF EXISTS forhindrer feil ved re-kjøring
ALTER TABLE place_knowledge
DROP CONSTRAINT IF EXISTS place_knowledge_topic_valid;

ALTER TABLE place_knowledge
ADD CONSTRAINT place_knowledge_topic_valid CHECK (topic IN (
  -- Historien (story)
  'history', 'people', 'awards', 'media', 'controversy',
  -- Opplevelsen (experience)
  'atmosphere', 'signature', 'culture', 'seasonal',
  -- Smaken (taste)
  'food', 'drinks', 'sustainability',
  -- Stedet (place)
  'architecture', 'spatial', 'nature', 'accessibility',
  -- Innsiden (inside)
  'practical', 'insider', 'relationships',
  -- Legacy (bakoverkompatibel)
  'local_knowledge'
));

COMMIT;
```

Ingen data endres. Alle 226 eksisterende fakta forblir gyldige.

#### Research Insights — Migrasjon

**Best practices fra Postgres-dokumentasjon:**
- `DROP CONSTRAINT IF EXISTS` gjør migrasjonen idempotent (trygg å re-kjøre)
- `BEGIN/COMMIT` gjør DROP + ADD atomisk — ingen vindu der constraint mangler
- Med 226 rader er dette effektivt instantant. `NOT VALID`-pattern er overkill her
- Verifiser constraint-navn før DROP: `SELECT conname FROM pg_constraint WHERE conrelid = 'place_knowledge'::regclass AND contype = 'c'`

**Hvorfor CHECK fremfor ENUM:**
- `ALTER TYPE ... ADD VALUE` (ENUM) kan IKKE kjøres i en transaksjon (Postgres-begrensning)
- Fjerne/rename ENUM-verdier krever gjenskaping av type + kolonne
- CHECK + `as const` gir tilsvarende sikkerhet med mye mer fleksibilitet
- Taksonomien er designet for å utvikle seg (v0.1→v0.2→v0.3)

**Institutional learning:** Fra `docs/solutions/feature-implementations/poi-tier-system-fase2-learnings-20260210.md` — navngitte constraints er obligatorisk. Allerede riktig i vår kodebase.

### Steg 2: TypeScript-typer (`lib/types.ts`)

- [ ] Utvid `KNOWLEDGE_TOPICS` array med 10 nye verdier + behold `local_knowledge`
- [ ] Legg til `KNOWLEDGE_CATEGORIES` mapping med `as const satisfies` for type-sikkerhet
- [ ] Oppdater `KNOWLEDGE_TOPIC_LABELS` (NO) for alle nye topics
- [ ] Oppdater `KNOWLEDGE_TOPIC_LABELS_EN` (EN) for alle nye topics
- [ ] Legg til `KnowledgeCategory` type
- [ ] Legg til `TOPIC_TO_CATEGORY` reverse lookup utility

```typescript
// lib/types.ts

export const KNOWLEDGE_TOPICS = [
  'history', 'people', 'awards', 'media', 'controversy',
  'atmosphere', 'signature', 'culture', 'seasonal',
  'food', 'drinks', 'sustainability',
  'architecture', 'spatial', 'nature', 'accessibility',
  'practical', 'insider', 'relationships',
  'local_knowledge', // legacy — mapped til 'inside' category
] as const;

export type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number];

// CategoryDef interface for satisfies-validering
interface CategoryDef {
  readonly labelNo: string;
  readonly labelEn: string;
  readonly topics: readonly KnowledgeTopic[];
}

export const KNOWLEDGE_CATEGORIES = {
  story: {
    labelNo: 'Historien',
    labelEn: 'The Story',
    topics: ['history', 'people', 'awards', 'media', 'controversy'],
  },
  experience: {
    labelNo: 'Opplevelsen',
    labelEn: 'The Experience',
    topics: ['atmosphere', 'signature', 'culture', 'seasonal'],
  },
  taste: {
    labelNo: 'Smaken',
    labelEn: 'The Taste',
    topics: ['food', 'drinks', 'sustainability'],
  },
  place: {
    labelNo: 'Stedet',
    labelEn: 'The Place',
    topics: ['architecture', 'spatial', 'nature', 'accessibility'],
  },
  inside: {
    labelNo: 'Innsiden',
    labelEn: 'The Inside Track',
    topics: ['practical', 'insider', 'relationships', 'local_knowledge'],
  },
} as const satisfies Record<string, CategoryDef>;

export type KnowledgeCategory = keyof typeof KNOWLEDGE_CATEGORIES;

// Reverse lookup: topic → category
export const TOPIC_TO_CATEGORY: Record<KnowledgeTopic, KnowledgeCategory> =
  Object.entries(KNOWLEDGE_CATEGORIES).reduce((acc, [catKey, catDef]) => {
    for (const topic of catDef.topics) {
      acc[topic as KnowledgeTopic] = catKey as KnowledgeCategory;
    }
    return acc;
  }, {} as Record<KnowledgeTopic, KnowledgeCategory>);

export const KNOWLEDGE_TOPIC_LABELS: Record<KnowledgeTopic, string> = {
  history: 'Historikk',
  people: 'Mennesker',
  awards: 'Anerkjennelse',
  media: 'I media',
  controversy: 'Debatt',
  atmosphere: 'Atmosfære',
  signature: 'Signaturen',
  culture: 'Kultur',
  seasonal: 'Sesong',
  food: 'Mat',
  drinks: 'Drikke',
  sustainability: 'Bærekraft',
  architecture: 'Arkitektur',
  spatial: 'Beliggenhet',
  nature: 'Natur',
  accessibility: 'Tilgjengelighet',
  practical: 'Praktisk',
  insider: 'Insider',
  relationships: 'Koblinger',
  local_knowledge: 'Visste du?', // legacy
};

export const KNOWLEDGE_TOPIC_LABELS_EN: Record<KnowledgeTopic, string> = {
  history: 'History',
  people: 'People',
  awards: 'Awards',
  media: 'In the Media',
  controversy: 'Debate',
  atmosphere: 'Atmosphere',
  signature: 'Signature',
  culture: 'Culture',
  seasonal: 'Seasonal',
  food: 'Food',
  drinks: 'Drinks',
  sustainability: 'Sustainability',
  architecture: 'Architecture',
  spatial: 'Location',
  nature: 'Nature',
  accessibility: 'Accessibility',
  practical: 'Practical',
  insider: 'Insider',
  relationships: 'Connections',
  local_knowledge: 'Did you know?', // legacy
};
```

#### Research Insights — TypeScript

**`as const satisfies Record<string, CategoryDef>`** er nøkkelmønsteret:
- `as const` bevarer literal-typer for alle verdier
- `satisfies` validerer formen uten å utvide typene
- Skrivefeil som `'histry'` i topics-arrayen fanges ved kompilering fordi det ikke er assignerbart til `KnowledgeTopic`

**`Record<KnowledgeTopic, string>` for labels:** Hvis du legger til en topic i `KNOWLEDGE_TOPICS` men glemmer label, gir TypeScript umiddelbart feil. Compile-time safety net.

**`TOPIC_TO_CATEGORY` reverse lookup:** Nyttig for admin UI når du trenger å vite hvilken kategori en gitt facts topic tilhører.

**Supabase-typer:** `gen types` genererer IKKE union-typer fra CHECK constraints — bare `string`. Type-sikkerheten kommer fra `lib/types.ts` alene. Transform-funksjoner i `public-queries.ts:472` og `queries.ts:1562` bruker `as KnowledgeTopic` cast som er trygt fordi DB CHECK enforcer gyldige verdier.

### Steg 3: UI — PlaceKnowledgeSection

Endre fra flat topic-liste til kategori-gruppert visning:

- [ ] Importer `KNOWLEDGE_CATEGORIES` og `KnowledgeCategory`
- [ ] Erstatt topic-gruppering med single-pass Map, deretter kategori-iterering
- [ ] Render kategori-headers med sub-topic fakta under
- [ ] Vis sub-topic label kun når kategori har flere aktive topics
- [ ] Bare vis kategorier som har fakta
- [ ] Behold backfill-dedup-filteret (linje 14-16)
- [ ] Behold locale-håndtering for EN/NO

```tsx
// components/public/PlaceKnowledgeSection.tsx — ny rendering-logik

import type { PlaceKnowledge, KnowledgeTopic, KnowledgeCategory } from "@/lib/types";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_TOPIC_LABELS,
  KNOWLEDGE_TOPIC_LABELS_EN,
} from "@/lib/types";

const CATEGORY_ORDER: KnowledgeCategory[] = ['story', 'experience', 'taste', 'place', 'inside'];

// Steg 1: Behold backfill-dedup filter (eksisterende logikk)
const filtered = hasEditorialHook
  ? knowledge.filter((k) => !k.sourceName?.toLowerCase().includes("backfill"))
  : knowledge;

// Steg 2: Single-pass Map-gruppering (O(n), én iterasjon)
const byTopic = new Map<KnowledgeTopic, PlaceKnowledge[]>();
for (const fact of filtered) {
  const existing = byTopic.get(fact.topic) ?? [];
  existing.push(fact);
  byTopic.set(fact.topic, existing);
}

const topicLabels = locale === "en" ? KNOWLEDGE_TOPIC_LABELS_EN : KNOWLEDGE_TOPIC_LABELS;

// Steg 3: Render kategorier med sub-topics
{CATEGORY_ORDER.map((catKey) => {
  const cat = KNOWLEDGE_CATEGORIES[catKey];

  // Filtrer til topics som har fakta (bevarer kanonisk rekkefølge innen kategori)
  const activeTopics = cat.topics.filter((t) => byTopic.has(t));
  if (activeTopics.length === 0) return null;

  const catLabel = locale === "en" ? cat.labelEn : cat.labelNo;

  return (
    <section key={catKey}>
      <h3 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-3">
        {catLabel}
      </h3>
      <div className="space-y-4">
        {activeTopics.map((topic) => {
          const facts = byTopic.get(topic)!;
          return (
            <div key={topic} className="space-y-2">
              {/* Vis sub-topic label kun når kategori har flere aktive topics */}
              {activeTopics.length > 1 && (
                <h4 className="text-[11px] font-medium text-[#6a6a6a] uppercase tracking-wider">
                  {topicLabels[topic]}
                </h4>
              )}
              {facts.map((fact) => {
                const text = locale === "en"
                  ? (fact.factTextEn ?? fact.factText)
                  : fact.factText;
                return (
                  <p key={fact.id} className="text-sm text-[#4a4a4a] leading-relaxed">
                    {text}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
})}
```

#### Research Insights — UI

**Performance:** PlaceKnowledgeSection er en server component (ingen `"use client"`, ingen hooks). `useMemo` er irrelevant — komponenten kjører én gang på serveren. Single-pass `Map`-gruppering + `.filter()` på `CATEGORY_ORDER` (5 items) og `cat.topics` (~4 items) er neglisjerbart.

**Anti-pattern å unngå:** `CATEGORY_ORDER.map(cat => filtered.filter(f => cat.topics.includes(f.topic)))` er O(n * k). Map-basert tilnærming er O(n + k), strengt bedre.

**Sub-topic labels:** Vis sub-topic heading kun når en kategori har 2+ aktive topics. Hvis bare én topic har data under en kategori, vises kun kategori-headingen (unngår redundans).

**Empty category suppression:** `activeTopics.length === 0 ? return null` håndterer dette riktig.

### Steg 3b: MapPopupCard snippet-oppdatering

- [ ] Oppdater topic-prioritet i `components/variants/report/MapPopupCard.tsx:41`

```typescript
// Nåværende (hardkodet):
knowledge.find((k) => k.topic === "local_knowledge") ??
knowledge.find((k) => k.topic === "history") ??

// Oppdatert (utvidet prioritetsliste):
const SNIPPET_TOPIC_PRIORITY: KnowledgeTopic[] = [
  'insider', 'local_knowledge', 'signature', 'atmosphere', 'history'
];
const snippet = SNIPPET_TOPIC_PRIORITY
  .map(t => knowledge.find(k => k.topic === t))
  .find(Boolean) ?? knowledge[0];
```

#### Research Insight — MapPopupCard

Denne filen ble oppdaget av codebase-explorer — den var IKKE i original plan. Hardkodet `local_knowledge` / `history` referanse i `MapPopupCard.tsx:41` må oppdateres for å inkludere nye topics som `insider` og `signature` for bedre snippet-valg.

### Steg 4: Admin-side

- [ ] Oppdater topic-filter i `knowledge-admin-client.tsx` til gruppert visning
- [ ] Grupper filter-chips per kategori med visuelle separatorer
- [ ] Legg til kategori-nivå filter (klikk på kategori-header for å filtrere alle topics i den)

```tsx
// app/admin/knowledge/knowledge-admin-client.tsx — gruppert filter

{Object.entries(KNOWLEDGE_CATEGORIES).map(([catKey, cat]) => {
  const catTopics = cat.topics.filter(t => (topicCounts[t] ?? 0) > 0);
  if (catTopics.length === 0) return null;

  return (
    <div key={catKey} className="flex flex-wrap items-center gap-1">
      <span className="text-[10px] text-gray-400 uppercase tracking-wider mr-1">
        {cat.labelNo}
      </span>
      {catTopics.map((topic) => (
        <button
          key={topic}
          onClick={() => setTopicFilter(topicFilter === topic ? "all" : topic)}
          className={/* aktiv/inaktiv styling */}
        >
          {KNOWLEDGE_TOPIC_LABELS[topic]} ({topicCounts[topic]})
        </button>
      ))}
    </div>
  );
})}
```

#### Research Insight — Admin UX

Med 20 topics i flat liste blir filteret uoversiktlig. Gruppert per kategori med visuelle separatorer gir bedre scan-barhet. Topics med 0 fakta skjules allerede (linje 151 i eksisterende kode).

### Steg 5: Backfill-script

- [ ] `scripts/backfill-knowledge.ts` — importerer `KNOWLEDGE_TOPICS`, reflekterer automatisk
- [ ] Verifiser at nye topic-verdier aksepteres av valideringen

#### Research Insight — Backfill

Backfill-scriptet bruker `const VALID_TOPICS = new Set<string>(KNOWLEDGE_TOPICS)` (linje 38). Når `KNOWLEDGE_TOPICS` utvides til 20 verdier, plukker dette automatisk opp nye topics. **Ingen kodeendring nødvendig** — bare verifiser etter TypeScript-endringene.

### Steg 6: Regenerer Supabase-typer

```bash
source .env.local && supabase db push --password "$DATABASE_PASSWORD"
npx supabase gen types --linked > lib/supabase/types.ts
npx tsc --noEmit
```

- [ ] Kjør migrasjon
- [ ] Regenerer typer
- [ ] `npx tsc --noEmit` — verifiser ingen type-feil

#### Research Insight — Type-regenerering

Supabase `gen types` vil fortsatt vise `topic: string` (ikke union type) fordi CHECK constraints ikke introspekteres. Dette er forventet og ufarlig — type-sikkerheten kommer fra `lib/types.ts`. Regenerering er likevel viktig for å fange eventuelle andre schema-endringer.

## Acceptance Criteria

- [ ] Ny migrasjon `040_knowledge_taxonomy_v02.sql` utvider CHECK constraint (idempotent med `IF EXISTS`)
- [ ] `KNOWLEDGE_TOPICS` har 20 verdier (19 aktive + 1 legacy)
- [ ] `KNOWLEDGE_CATEGORIES` grupperer topics i 5 kategorier (med `satisfies`-validering)
- [ ] `TOPIC_TO_CATEGORY` reverse lookup er tilgjengelig
- [ ] `KNOWLEDGE_TOPIC_LABELS` og `_EN` har labels for alle 20 topics
- [ ] PlaceKnowledgeSection viser fakta gruppert per kategori med sub-topic labels
- [ ] MapPopupCard bruker utvidet snippet-prioritet
- [ ] Admin-side viser topics gruppert per kategori i filter
- [ ] Backfill-script godtar nye topic-verdier (automatisk via KNOWLEDGE_TOPICS import)
- [ ] `npm run build` passerer
- [ ] Eksisterende 226 fakta vises korrekt (ingen regresjoner)
- [ ] Nye topics kan brukes i neste research-runde

## Ikke i scope

- Re-kategorisering av eksisterende 226 fakta (gjøres gradvis)
- Instagram/hashtag/social-integrering (parkert)
- Ny research-runde med de nye topics (separat oppgave)
- Sammensying av fakta til kategori-tekster med AI (v0.3)
- Runtime validation guard i transform-funksjoner (lav risiko med CHECK constraint)

## Risiko

| Risiko | Sannsynlighet | Mitigering |
|--------|---------------|------------|
| CHECK constraint-navn mismatch | Lav | Verifiser med `SELECT conname FROM pg_constraint` før DROP. Bruk `IF EXISTS`. |
| Eksisterende fakta med `local_knowledge` topic bryter | Ingen | `local_knowledge` beholdes i constraint |
| Admin-filter blir rotete med 20 knapper | Medium | Grupper per kategori i admin UI (løst i steg 4) |
| Topic lagt til i TS men glemt i migrasjon | Lav | `Record<KnowledgeTopic, string>` + `satisfies` gir compile-time feil for TS-delen. Sjekk begge steder. |
| MapPopupCard viser feil snippet | Lav | Utvidet prioritetsliste (steg 3b) |

## Filer som påvirkes (komplett liste)

| Fil | Endring | Auto-adapter? |
|-----|---------|---------------|
| `supabase/migrations/040_*.sql` | **NY** — CHECK constraint utvidelse | — |
| `lib/types.ts:566-595` | Utvid KNOWLEDGE_TOPICS, legg til CATEGORIES + labels | — |
| `components/public/PlaceKnowledgeSection.tsx` | Strukturell rewrite: topic→kategori gruppering | Nei |
| `components/variants/report/MapPopupCard.tsx:41` | Utvid snippet topic-prioritet | Nei |
| `app/admin/knowledge/knowledge-admin-client.tsx` | Gruppert filter UI | Nei |
| `lib/supabase/types.ts` | Regenereres automatisk | Ja |
| `scripts/backfill-knowledge.ts:38` | Auto-adapter via KNOWLEDGE_TOPICS import | Ja |
| `scripts/list-research-targets.ts:17` | Auto-adapter via KNOWLEDGE_TOPICS import | Ja |
| `lib/public-queries.ts:472` | Ingen endring nødvendig (cast er trygt) | Ja |
| `lib/supabase/queries.ts:1562` | Ingen endring nødvendig (cast er trygt) | Ja |

## References

- Phase 1 plan: `docs/plans/2026-02-15-city-knowledge-base-plan.md`
- Brainstorm: `docs/brainstorms/2026-02-15-city-knowledge-base-brainstorm.md`
- Schema docs: `docs/solutions/feature-implementations/city-knowledge-base-schema-queries-20260215.md`
- Learnings: `docs/solutions/database-issues/supabase-graceful-column-fallback-20260206.md`
- POI tier learnings: `docs/solutions/feature-implementations/poi-tier-system-fase2-learnings-20260210.md`
- Idempotent backfill: `docs/solutions/feature-implementations/idempotent-backfill-patterns-supabase-20260215.md`
- Key files:
  - `lib/types.ts:566-595` — KNOWLEDGE_TOPICS + labels
  - `supabase/migrations/038_place_knowledge.sql:42-45` — CHECK constraint
  - `components/public/PlaceKnowledgeSection.tsx` — public UI
  - `components/variants/report/MapPopupCard.tsx:41` — snippet selection (NY)
  - `app/admin/knowledge/knowledge-admin-client.tsx` — admin UI
  - `scripts/backfill-knowledge.ts:38-39` — validation
