---
title: "feat: POI Content Enrichment & Source Attribution"
type: feat
date: 2026-01-31
brainstorm: docs/brainstorms/2026-01-31-poi-content-enrichment-sources-brainstorm.md
---

# feat: POI Content Enrichment & Source Attribution

## Overview

Bygge en automatisert pipeline som beriker Google-baserte POI-er med innhold fra Google Places API (New) og Foursquare, genererer redaksjonelt innhold med AI, og viser kildehenvisninger som sm&aring; sirkulære logoer i UI-et. Integreres som nytt steg i Story Generator.

## Problem Statement

I dag har kun ~16 av ~80 POI-er redaksjonelt innhold (editorialHook, localInsight). Innholdet genereres manuelt via Claude Code, uten kildehenvisning eller strukturert datasporing. `editorialSources`-feltet eksisterer i types og DB men er ubrukt. Resultatet er at de fleste POI-kort er "tomme" -- kun navn, kategori og rating.

## Proposed Solution

### Arkitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin: Story Generator                    │
│  Step 1: Discovering → Step 2: Enriching → Step 3: Writing  │
│               → Step 4: Structuring → Done                  │
└────────────────────────┬────────────────────────────────────┘
                         │
            ┌────────────▼─────────────┐
            │   poi-enrichment.ts      │
            │   (new generator module) │
            └────────────┬─────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌─────────────┐ ┌──────────┐ ┌─────────────┐
   │ Google      │ │Foursquare│ │ AI Content  │
   │ Places(New) │ │ Places v3│ │ Generator   │
   │             │ │          │ │ (Claude)    │
   │ reviews     │ │ match    │ │             │
   │ reviewSum   │ │ tips     │ │ hook        │
   │ editorial   │ │ rating   │ │ summary     │
   └─────────────┘ └──────────┘ └─────────────┘
          │              │              │
          └──────────────┼──────────────┘
                         ▼
              ┌────────────────────┐
              │   Supabase pois    │
              │   editorial_hook   │
              │   source_summary   │
              │   editorial_sources│
              └────────────────────┘
                         │
              ┌──────────▼──────────┐
              │  ExplorerPOICard    │
              │  ┌──────────────┐  │
              │  │ Editorial    │  │
              │  │ Hook (amber) │  │
              │  ├──────────────┤  │
              │  │ Source       │  │
              │  │ Summary      │  │
              │  ├──────────────┤  │
              │  │ 🟢 🔵 ✨    │  │
              │  │ Source logos  │  │
              │  └──────────────┘  │
              └─────────────────────┘
```

## Technical Approach

### Phase 1: Data Model & API Migration

Grunnlaget: oppdatere typer, DB-skjema, og migrere Google Places til New API.

#### 1.1 Supabase Migration

**Ny migrasjon:** `supabase/migrations/XXX_poi_enrichment_fields.sql`

```sql
-- Endre editorial_sources fra TEXT[] til JSONB (strukturerte kildeobjekter)
ALTER TABLE pois ALTER COLUMN editorial_sources TYPE JSONB USING
  CASE
    WHEN editorial_sources IS NULL THEN NULL
    ELSE to_jsonb(editorial_sources)
  END;

-- Nytt felt for kildesammendrag
ALTER TABLE pois ADD COLUMN source_summary TEXT;

-- Nytt felt for å skille manuelt vs auto-generert innhold
ALTER TABLE pois ADD COLUMN editorial_hook_manual BOOLEAN DEFAULT false;

-- Foursquare-ID for fremtidige oppslag
ALTER TABLE pois ADD COLUMN fsq_id TEXT;
```

#### 1.2 Type Updates

**`lib/types.ts`** -- nye og oppdaterte felter:

```typescript
export interface EditorialSource {
  name: string;           // "Google", "Foursquare"
  url: string;            // Lenke til kildeside
  logo: string;           // "google" | "foursquare" | "placy"
  rating?: number;        // Kildespesifikk rating
  ratingScale?: number;   // 5 for Google, 10 for Foursquare
  reviewCount?: number;
  snippets?: string[];    // Utvalgte sitater/tips
  fetchedAt: string;      // ISO timestamp
}

export interface POI {
  // ... eksisterende felter ...

  // Oppgradert fra string[]
  editorialSources?: EditorialSource[];

  // Nye felter
  sourceSummary?: string;
  editorialHookManual?: boolean;
  fsqId?: string;
}
```

**`lib/supabase/types.ts`** -- oppdater Row-typen:

```typescript
// Endre:
editorial_sources: string[] | null;
// Til:
editorial_sources: EditorialSource[] | null;  // JSONB i DB

// Legg til:
source_summary: string | null;
editorial_hook_manual: boolean;
fsq_id: string | null;
```

**`lib/supabase/queries.ts`** -- oppdater mapper:

```typescript
// Legg til i dbPoiToFrontendPoi():
sourceSummary: dbPoi.source_summary ?? undefined,
editorialHookManual: dbPoi.editorial_hook_manual,
fsqId: dbPoi.fsq_id ?? undefined,
```

**`lib/supabase/mutations.ts`** -- oppdater POIImportData og preservasjon:

```typescript
// Legg til i POIImportData:
fsq_id: string | null;

// Legg til i EDITORIAL_FIELD_NAMES:
'source_summary',
'editorial_hook_manual',
```

**`lib/generators/merge-data.ts`** -- oppdater PRESERVED_POI_FIELDS:

```typescript
const PRESERVED_POI_FIELDS: (keyof POI)[] = [
  "editorialHook",
  "localInsight",
  "storyPriority",
  "editorialSources",
  "featuredImage",
  "description",
  "sourceSummary",         // Ny
  "editorialHookManual",   // Ny
];
```

#### 1.3 Google Places API Migration

Migrere fra legacy til Places API (New). Berorer 4 filer:

**`app/api/places/[placeId]/route.ts`** -- Place Details:

Endpoint endres fra:
```
GET maps.googleapis.com/maps/api/place/details/json?place_id={id}&fields={fields}&key={key}
```
Til:
```
GET places.googleapis.com/v1/places/{id}
Headers: X-Goog-Api-Key, X-Goog-FieldMask
```

Field mask for standard detaljer (Enterprise SKU, $20/1000):
```
id,displayName,rating,userRatingCount,photos,websiteUri,nationalPhoneNumber,regularOpeningHours,currentOpeningHours
```

Field mask for enrichment (Enterprise + Atmosphere SKU, $25/1000):
```
id,displayName,rating,userRatingCount,reviews,editorialSummary,generativeSummary,photos,websiteUri,nationalPhoneNumber,regularOpeningHours,currentOpeningHours
```

Respons-mapping:
| Legacy | New |
|--------|-----|
| `result.name` | `displayName.text` |
| `result.rating` | `rating` |
| `result.user_ratings_total` | `userRatingCount` |
| `result.photos[].photo_reference` | `photos[].name` (resource path) |
| `result.website` | `websiteUri` |
| `result.formatted_phone_number` | `nationalPhoneNumber` |
| `result.opening_hours` | `regularOpeningHours.weekdayDescriptions` |
| N/A | `reviews[]` (NEW - opptil 5 anmeldelser) |
| N/A | `editorialSummary.text` (NEW) |
| N/A | `generativeSummary.overview.text` (NEW) |

**`app/api/places/route.ts`** (POST) -- Nearby Search:

Endpoint endres fra GET til POST:
```
POST places.googleapis.com/v1/places:searchNearby
```

Viktig: max 20 resultater per request (ingen paginering). Eksisterende `maxResultsPerCategory: 20` i poi-discovery.ts matcher allerede denne grensen.

**`app/api/places/photo/route.ts`** -- Photo proxy:

Photo reference format endres:
- Legacy: `photo_reference` (opaque string)
- New: `places/{placeId}/photos/{resource}` (resource path)

URL: `places.googleapis.com/v1/{photo.name}/media?maxWidthPx=400&key={key}`

**`lib/generators/poi-discovery.ts`** -- POI Discovery:

Oppdater `discoverGooglePlaces()` til å bruke Places API (New) Nearby Search.

### Phase 2: Enrichment Pipeline

Ny generator-modul som henter data fra kilder og genererer innhold.

#### 2.1 Google Places Enrichment

**Ny fil:** `lib/generators/enrichment/google-places.ts`

```typescript
interface GoogleEnrichmentResult {
  reviews: Array<{
    text: string;
    rating: number;
    author: string;
    relativeTime: string;
  }>;
  editorialSummary?: string;
  generativeSummary?: string;
  reviewCount: number;
  rating: number;
  googleMapsUrl: string;
}

export async function enrichFromGoogle(
  placeId: string,
  apiKey: string
): Promise<GoogleEnrichmentResult | null>
```

Bruker Enterprise + Atmosphere field mask. Returnerer reviews, summaries, og metadata.

#### 2.2 Foursquare Integration

**Ny fil:** `lib/generators/enrichment/foursquare.ts`

Foursquare er designet som **valgfri** (optional) fra dag 1. Systemet fungerer fullt med kun Google.

```typescript
interface FoursquareEnrichmentResult {
  fsqId: string;
  rating?: number;        // 0-10 skala
  popularity?: number;    // 0-1 skala
  tips?: Array<{ text: string; agreeCount: number }>;
  venueUrl: string;
}

// Step 1: Match (Pro tier, gratis opptil 10k/mnd)
export async function matchToFoursquare(
  name: string,
  lat: number,
  lng: number,
  address?: string
): Promise<string | null>  // Returnerer fsqId eller null

// Step 2: Enrich (Premium tier, $18.75/1000)
export async function enrichFromFoursquare(
  fsqId: string,
  apiKey: string
): Promise<FoursquareEnrichmentResult | null>
```

**Matching-strategi:**
- Bruk Foursquare Place Match endpoint (`/v3/places/match`)
- Krev name + coordinates (minimum)
- Legg til address for bedre treff
- Returner `null` ved 404 (ingen match) -- dette er forventet for mange POI-er
- Cache `fsqId` permanent i `pois.fsq_id`-kolonnen for fremtidige oppslag

**Kostnadsoptimalisering:**
- Place Match er Pro tier (gratis opptil 10k/mnd) -- kall dette for alle POI-er
- Tips/Rating er Premium ($18.75/1000) -- kall kun for matchede POI-er
- Cache fsqId permanent -- aldri match samme POI to ganger

#### 2.3 AI Content Generation

**Ny fil:** `lib/generators/enrichment/content-generator.ts`

```typescript
interface ContentGenerationInput {
  poiName: string;
  category: string;
  googleReviews: Array<{ text: string; rating: number }>;
  googleEditorialSummary?: string;
  googleGenerativeSummary?: string;
  googleRating: number;
  googleReviewCount: number;
  foursquareTips?: Array<{ text: string }>;
  foursquareRating?: number;
}

interface GeneratedContent {
  editorialHook: string;    // 1 setning, faktabasert
  sourceSummary: string;    // 2-3 setninger, oppsummering av kilder
}

export async function generateContent(
  input: ContentGenerationInput
): Promise<GeneratedContent>
```

**AI-modell:** Claude Haiku via Anthropic API (billig, rask, bra nok for korte tekster).
- Kostnad: ~$0.01 per POI (80 POI-er = ~$0.80)
- Alternativt: Bruk Google `reviewSummary` direkte som `sourceSummary` og generer kun `editorialHook` med AI

**Prompt-design (faktabasert tone):**

```
Du er en nøytral redaktør for en stedsoversikt. Basert på kildene nedenfor, skriv:

1. editorialHook: Én objektiv setning (maks 15 ord) som oppsummerer hva stedet er kjent for.
2. sourceSummary: 2-3 setninger som nøytralt oppsummerer hva kildene skriver.

Krav:
- Skriv på norsk
- Vær faktabasert og nøytral -- presenter hva kildene sier, ikke din mening
- Nevn konkrete detaljer fra anmeldelsene (atmosfære, populære retter, etc.)
- Inkluder rating og antall anmeldelser der relevant

Sted: {poiName} ({category})
Google-rating: {googleRating}/5 ({googleReviewCount} anmeldelser)
Google-anmeldelser: {reviews}
Google redaksjonelt: {editorialSummary}
Foursquare-tips: {tips}
Foursquare-rating: {fsqRating}/10
```

**Fallback-strategi:**
1. Hvis AI feiler: Bruk Google `generativeSummary` eller `editorialSummary` direkte
2. Hvis Google har lite data: Generer hook fra navn + kategori + rating alene
3. Hvis ingen kilder har data: Sett `editorialHook = null` (POI vises som i dag)

#### 2.4 Pipeline Orchestrator

**Ny fil:** `lib/generators/poi-enrichment.ts`

```typescript
interface EnrichmentConfig {
  projectId: string;
  googleApiKey: string;
  foursquareApiKey?: string;  // Valgfri -- pipeline fungerer uten
  anthropicApiKey?: string;   // Valgfri -- fallback til Google summaries
  onProgress?: (current: number, total: number, poiName: string) => void;
}

interface EnrichmentResult {
  total: number;
  enriched: number;
  skipped: number;  // Manuelt redigerte
  failed: number;
  noMatch: number;  // Foursquare ingen match
  log: EnrichmentLogEntry[];
}

export async function enrichProjectPOIs(
  config: EnrichmentConfig
): Promise<EnrichmentResult>
```

**Pipeline per POI:**
1. Sjekk `editorial_hook_manual === true` → skip (bevar manuelt innhold)
2. Hent Google Places (New) data (reviews, summaries)
3. Sjekk om `fsq_id` allerede finnes → bruk cached, ellers kall Place Match
4. Hvis fsqId finnes, hent Foursquare tips/rating
5. Generer innhold med AI (eller fallback)
6. Bygg `EditorialSource[]` metadata
7. Batch upsert alle berikede POI-er til Supabase

**Rate limiting:**
- 200ms delay mellom Google API-kall (matcher eksisterende mønster i poi-discovery.ts)
- 100ms delay mellom Foursquare-kall
- Prosesser POI-er sekvensielt (ikke parallelt) for å holde oss innenfor API-grenser

**Timeout-håndtering:**
- Pipeline lagrer enrichment-resultater progressivt (etter hver POI)
- Hvis funksjonen avbrytes, er allerede-berikede POI-er lagret
- Re-kjøring hopper over POI-er som allerede har fersk enrichment (basert på `fetchedAt`)

### Phase 3: Admin UI Integration

#### 3.1 Story Generator -- nytt "Enriching"-steg

**Fil:** `app/admin/generate/generate-client.tsx`

Utvid `GenerationStep`:
```typescript
type GenerationStep = "idle" | "discovering" | "enriching" | "structuring" | "writing" | "done" | "error";
```

Ny progress-step med per-POI teller:
```
Step 2: Beriker POI-er (43/80) - Café Løkka...
```

#### 3.2 API Route for Enrichment

**Ny fil:** `app/api/enrich/route.ts`

```typescript
// POST /api/enrich
// Body: { projectId: string }
// Auth: ADMIN_ENABLED check
// Returns: EnrichmentResult
```

Denne ruten kalles av:
1. Story Generator UI (etter discovering-steget)
2. "Berik på nytt"-knappen

#### 3.3 "Berik på nytt"-knapp

Plassering: `/admin/projects/[id]` -- prosjektdetaljsiden.

Viser estimert kostnad/omfang: "80 Google-POI-er vil berikes. ~$2 Google + ~$1.50 Foursquare."

### Phase 4: Source Logos UI

#### 4.1 SourceLogos-komponent

**Ny fil:** `components/poi/SourceLogos.tsx`

```tsx
interface SourceLogosProps {
  sources: EditorialSource[];
}

export function SourceLogos({ sources }: SourceLogosProps) {
  // Rendrer en rad med ~20px sirkulære logoer
  // Grayscale default, farge ved hover
  // Klikkbar -- åpner source.url i ny fane
  // Logoer: Google (G-ikon), Foursquare (F-ikon), Placy (sparkle)
}
```

Logoer som SVG-ikoner (ikke eksterne bilder) for ytelse og konsistens.

#### 4.2 Integrere i ExplorerPOICard

**Fil:** `components/variants/explorer/ExplorerPOICard.tsx`

Ny layout i expanded state (etter editorialHook):
```
1. Image (eksisterende)
2. editorialHook (amber boks, eksisterende)
3. sourceSummary (NY -- vanlig tekst, grå)
4. SourceLogos (NY -- logorad)
5. localInsight (eksisterende)
6. Opening hours (eksisterende)
7. Realtime data (eksisterende)
8. Actions (eksisterende)
```

#### 4.3 Integrere i POICardExpanded

**Fil:** `components/poi/poi-card-expanded.tsx`

Samme layout som ExplorerPOICard for konsistens.

#### 4.4 Integrere i POIBottomSheet

**Fil:** `components/poi/poi-bottom-sheet.tsx`

Legg til sourceSummary og SourceLogos.

## Acceptance Criteria

### Functional Requirements

- [ ] Google Places API (New) erstatter legacy API i alle 4 berørte filer
- [ ] Enrichment-pipeline henter reviews + summaries fra Google Places (New) per Google-POI
- [ ] Foursquare Place Match matcher POI-er og henter tips/rating (når API-nøkkel er konfigurert)
- [ ] AI genererer `editorialHook` og `sourceSummary` per POI i faktabasert tone
- [ ] `editorialSources` lagres som strukturert JSONB med kildenavn, URL, rating, snippets, timestamp
- [ ] Story Generator viser "Enriching"-steg med per-POI progress
- [ ] "Berik på nytt"-knapp finnes på prosjektdetaljsiden i admin
- [ ] Manuelt redigerte editorialHooks (flagget med `editorial_hook_manual`) bevares ved re-enrichment
- [ ] Source logos (sirkulære, ~20px, grayscale/hover) vises i ExplorerPOICard expanded state
- [ ] Source logos er klikkbare og åpner kildeside i ny fane
- [ ] Foursquare er helt valgfri -- pipeline fungerer fullt med kun Google

### Non-Functional Requirements

- [ ] Enrichment av 80 POI-er fullføres uten å overskride Vercel function timeout
- [ ] Progressiv lagring -- allerede-berikede POI-er bevares ved avbrudd
- [ ] Google API-kall holder seg innenfor 1000 gratis kall/mnd for normal bruk (1-2 prosjekter)
- [ ] Rate limiting: 200ms mellom Google-kall, 100ms mellom Foursquare-kall

## Dependencies & Risks

### Dependencies

| Avhengighet | Status | Risiko |
|-------------|--------|--------|
| Google Places API (New) | Tilgjengelig, eksisterende API-nøkkel | Lav -- migrering, ikke ny tjeneste |
| Foursquare Places API v3 | **Ukjent** -- V3 kan være lukket for nye kontoer | Høy -- verifiser tilgang først |
| Anthropic API (Claude) | Trenger ny API-nøkkel | Lav -- standard integrasjon |
| Supabase migrasjon | Krever migrasjons-SQL | Lav -- eksisterende mønster |

### Risiko

| Risiko | Konsekvens | Mitigering |
|--------|-----------|------------|
| Foursquare V3 lukket for nye kontoer | Mister sekundærkilde | Foursquare er valgfri fra dag 1 |
| AI-generert innhold er feilaktig | Feil info vises til brukere | Admin kan redigere manuelt, flagges `editorial_hook_manual` |
| Google API-kvote overskrides | Enrichment feiler | Progressiv lagring, vis kostnadsestimat før kjøring |
| Vercel function timeout (60s hobby / 300s pro) | Enrichment avbrytes | Progressiv lagring per POI |
| Feil Foursquare-match (feil venue) | Feil tips/rating vises | Foursquare er supplement, ikke primærkilde |

## Implementation Phases

### Phase 1: Data Model & API Migration
- Supabase migration (`editorial_sources` → JSONB, nye kolonner)
- Type updates (`lib/types.ts`, `lib/supabase/types.ts`, queries, mutations, merge-data)
- Google Places API migration (4 filer: `places/[placeId]`, `places/route`, `places/photo`, `poi-discovery`)
- Env: `FOURSQUARE_API_KEY`, `ANTHROPIC_API_KEY` i `.env.example`

### Phase 2: Enrichment Pipeline
- `lib/generators/enrichment/google-places.ts` -- Google Places (New) enrichment
- `lib/generators/enrichment/foursquare.ts` -- Foursquare match + details (valgfri)
- `lib/generators/enrichment/content-generator.ts` -- AI innholdsgenerering
- `lib/generators/poi-enrichment.ts` -- Pipeline orchestrator
- `app/api/enrich/route.ts` -- API endpoint

### Phase 3: Admin UI
- Story Generator: nytt "Enriching"-steg med per-POI progress
- "Berik på nytt"-knapp på prosjektdetaljside
- Kostnadsestimat før enrichment

### Phase 4: Source Logos UI
- `components/poi/SourceLogos.tsx` -- Logo-komponent
- Integrere i ExplorerPOICard, POICardExpanded, POIBottomSheet
- `sourceSummary` rendering mellom editorialHook og localInsight

## Open Questions (Resolved with Defaults)

| Spørsmål | Beslutning/Default |
|----------|-------------------|
| Foursquare-matching threshold | Aksepter alle matches fra Place Match (endpointet returnerer kun confident matches). Cache fsqId permanent. |
| Cache-strategi | Enrichment-data lagres permanent i Supabase. `fetchedAt` på EditorialSource brukes for å vise data-alder. Re-enrichment er manuelt. |
| AI-modell | Claude Haiku via Anthropic API. Fallback: Google `reviewSummary` direkte. |
| Fallback-innhold | POI-er uten meningsfull kildedata beholder eksisterende oppførsel (ingen hook/summary). |
| Batch-kapasitet | Sekvensiell prosessering med 200ms delay. ~20 sekunder for 80 POI-er (Google-kall). |
| Manual vs auto hook | Nytt `editorial_hook_manual` boolean-felt. Settes til `true` ved manuell redigering i admin. |
| Placy sparkle-logo | Vises når `editorial_hook_manual === true`. Ikke klikkbar. |
| sourceSummary i collapsed card | Nei, kun i expanded state. |
| Per-POI enrichment | V1: kun prosjektnivå. V2: per-POI "Berik"-knapp i admin POI-liste. |

## Environment Variables

```env
# Eksisterende
GOOGLE_PLACES_API_KEY=           # Brukes for both legacy og New API

# Nye
FOURSQUARE_API_KEY=              # Valgfri -- enrichment fungerer uten
ANTHROPIC_API_KEY=               # For AI content generation (Claude Haiku)
```

## Files to Create/Modify

### New Files
| Fil | Beskrivelse |
|-----|-------------|
| `supabase/migrations/XXX_poi_enrichment_fields.sql` | DB-migrasjon |
| `lib/generators/enrichment/google-places.ts` | Google Places (New) enrichment |
| `lib/generators/enrichment/foursquare.ts` | Foursquare match + details |
| `lib/generators/enrichment/content-generator.ts` | AI content generation |
| `lib/generators/poi-enrichment.ts` | Pipeline orchestrator |
| `app/api/enrich/route.ts` | Enrichment API endpoint |
| `components/poi/SourceLogos.tsx` | Source logo komponent |

### Modified Files
| Fil | Endring |
|-----|--------|
| `lib/types.ts` | Ny `EditorialSource` interface, nye POI-felter |
| `lib/supabase/types.ts` | Oppdatert Row-type med nye kolonner |
| `lib/supabase/queries.ts` | Mapper for nye felter |
| `lib/supabase/mutations.ts` | POIImportData + preservasjon for nye felter |
| `lib/generators/merge-data.ts` | PRESERVED_POI_FIELDS utvidet |
| `app/api/places/[placeId]/route.ts` | Migrere til Places API (New) |
| `app/api/places/route.ts` | Migrere Nearby Search til POST |
| `app/api/places/photo/route.ts` | Oppdatere photo proxy URL-format |
| `lib/generators/poi-discovery.ts` | Migrere discoverGooglePlaces() |
| `app/admin/generate/generate-client.tsx` | Nytt "Enriching"-steg |
| `components/variants/explorer/ExplorerPOICard.tsx` | sourceSummary + SourceLogos |
| `components/poi/poi-card-expanded.tsx` | sourceSummary + SourceLogos |
| `components/poi/poi-bottom-sheet.tsx` | sourceSummary + SourceLogos |
| `.env.example` | Nye env vars |

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-01-31-poi-content-enrichment-sources-brainstorm.md`
- POI types: `lib/types.ts:26-59`
- Editorial sources (unused): `lib/types.ts:46`
- ExplorerPOICard editorial rendering: `components/variants/explorer/ExplorerPOICard.tsx:230-253`
- Story Generator UI: `app/admin/generate/generate-client.tsx:105-203`
- POI discovery pattern: `lib/generators/poi-discovery.ts`
- Merge data preservation: `lib/generators/merge-data.ts:23-30`
- Supabase mutations (editorial preservation): `lib/supabase/mutations.ts`

### External
- [Google Places API (New) Migration Guide](https://developers.google.com/maps/documentation/places/web-service/legacy/migrate-overview)
- [Google Places API Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- [Google AI-Powered Place Summaries](https://developers.google.com/maps/documentation/places/web-service/place-summaries)
- [Google Places Pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Foursquare Place Match API](https://docs.foursquare.com/developer/reference/place-match)
- [Foursquare Places API Overview](https://docs.foursquare.com/developer/reference/places-api-overview)
- [Foursquare Pro/Premium Schemas](https://docs.foursquare.com/data-products/docs/places-pro-and-premium)
- [Foursquare Upcoming Changes (V3 access)](https://docs.foursquare.com/developer/reference/upcoming-changes)

### Institutional Learnings
- Batch upsert pattern: `docs/solutions/data-import/data-import-taxi-stands-20260125.md`
- Server-side API filtering: `docs/solutions/data-import/import-hyre-carshare-stations-20260125.md`
- GeoJSON coordinate gotcha [lng,lat]: `docs/solutions/data-import/import-entur-stops-20260125.md`
- Next.js cache invalidation after DB updates: `docs/solutions/data-import/import-hyre-carshare-stations-20260125.md`
