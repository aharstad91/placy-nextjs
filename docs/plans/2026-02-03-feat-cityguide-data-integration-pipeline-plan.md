---
title: "feat: CityGuide Data Integration Pipeline"
type: feat
date: 2026-02-03
deepened: 2026-02-03
---

# CityGuide Data Integration Pipeline

## Enhancement Summary

**Deepened on:** 2026-02-03
**Research agents used:** TypeScript Reviewer, Performance Oracle, Security Sentinel, Simplicity Reviewer, Data Integrity Guardian, Pattern Recognition, Web Scraping Best Practices, Google Places API Research, Learnings Extraction

### Key Improvements
1. **Simplified architecture** - Single-file script following existing `import-bysykkel.ts` pattern (~150 LOC vs ~400 LOC)
2. **Type safety** - Proper TypeScript interfaces, Zod validation, no `any` types
3. **Data integrity** - Use existing `upsertPOIsWithEditorialPreservation()`, ID collision detection
4. **Security** - Environment validation, input sanitization, business status filtering
5. **Resilience** - Cheerio 1.x extract API, fallback selectors, exponential backoff

### Critical Findings
- **SIMPLIFY**: 4-phase architecture is over-engineered for 200 POIs - use single-pass pipeline
- **REUSE**: Use existing `slugify()` from `lib/generators/poi-discovery.ts:452`
- **REUSE**: Use existing `upsertPOIsWithEditorialPreservation()` from `lib/supabase/mutations.ts:454`
- **SECURITY**: Add Zod validation for environment variables and scraped data
- **PERFORMANCE**: Sequential scraping is acceptable for 200 POIs (~4 min total)

---

## Overview

Bygg en 4-fase pipeline for å importere POI-er fra CityGuide.no (Visit Trondheim sin turistguide) til Placy sin Supabase-database. CityGuide representerer turistkontorets kuraterte utvalg - vi bruker det som discovery-kilde og beriker med Google Places data.

**Verdi:** Tilgang til 200+ kuraterte turiststeder uten manuell research.

**Tilnærming:** Discovery-liste, ikke innholdskopi. Vi henter navn + kategori, matcher mot Google Places, og genererer eget redaksjonelt innhold.

## Problem Statement

Placy trenger kvalitets-POI-er for turisme-segmentet (restauranter, museer, attraksjoner). CityGuide.no har allerede kuratert denne listen gjennom Visit Trondheim-partnerskap. Manuell registrering av 200+ steder er tidkrevende og duplikerer arbeid som allerede er gjort.

## Proposed Solution

```
FASE 1: Scrape CityGuide kategori-sider
├── Hent alle POI-URLer per kategori (10 kategorier)
└── Output: data/cityguide/categories.json

FASE 2: Hent POI-detaljer
├── For hver URL: scrape navn
└── Output: data/cityguide/cityguide-pois.json

FASE 3: Google Places matching
├── Text Search per POI: "{name} Trondheim"
├── Validering: navn-match, kategori
├── Match confidence score
└── Output: data/cityguide/validated-pois.json

FASE 4: Supabase POI-generering
├── Map CityGuide → Placy kategorier
├── Batch upsert til Supabase
└── Output: POI-er i database
```

## Technical Approach

### Kategori-mapping

| CityGuide | Placy Kategori | Placy ID |
|-----------|----------------|----------|
| Food & Drink | Restaurant/Cafe/Bar | `restaurant`, `cafe`, `bar` |
| Museums & Attractions | Museum | `museum` |
| Galleries | Museum | `museum` |
| Shopping | Shopping | `shopping` |
| Interior | Shopping | `shopping` |
| Activities | Aktivitet | `activity` (ny) |
| Health & Beauty | Spa | `spa` |
| Accommodation | Hotell | `hotel` |
| Transport | *SKIP* | - |
| What's On | *SKIP* (events) | - |

### ID-generering

**Bruk eksisterende `slugify()`** fra `lib/generators/poi-discovery.ts:452` (ikke dupliser):

```typescript
import { slugify } from '../lib/generators/poi-discovery';

// For Google-matchede POI-er - bruk hash for stabilitet:
function generatePoiId(googlePlaceId: string | null, name: string, seenIds: Set<string>): string {
  if (googlePlaceId) {
    const hash = crypto.createHash('sha256')
      .update(googlePlaceId)
      .digest('hex')
      .substring(0, 16);
    return `google-${hash}`;
  }

  // For POI-er uten Google-match - håndter kollisjoner:
  const baseId = `cityguide-${slugify(name)}`;
  if (!seenIds.has(baseId)) {
    seenIds.add(baseId);
    return baseId;
  }

  // Kollisjon - legg til counter
  let counter = 2;
  while (seenIds.has(`${baseId}-${counter}`)) counter++;
  const uniqueId = `${baseId}-${counter}`;
  seenIds.add(uniqueId);
  console.warn(`ID-kollisjon: "${name}" → ${uniqueId}`);
  return uniqueId;
}
```

### Research Insights: ID-generering

**Fra learnings (import-wfs-geographic-data):**
- Bruk `Set<string>` for å spore brukte ID-er
- Legg til counter-suffix ved kollisjoner
- Slugify med NFD-normalisering for norske tegn (ø, å, æ)

### Match-strategi (Google Places)

**MATCH** (automatisk godkjent):
- Navn-likhet > 85% (Levenshtein)
- `businessStatus !== 'CLOSED_PERMANENTLY'`

**REVIEW** (logg til console):
- Navn-likhet 60-85%

**REJECT** (hopp over):
- Navn-likhet < 60%
- `businessStatus: CLOSED_PERMANENTLY`

### Research Insights: Google Places API

**Fra framework-docs research:**
- Bruk **Text Search (New) API** med `locationBias` (ikke `locationRestriction`)
- **Field masks er påkrevd** for New API - reduserer kostnader
- Sjekk `businessStatus` - legacy Nearby Search filtrerer automatisk, Text Search gjør ikke

**Anbefalt field mask (Pro tier):**
```
X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.types
```

**Verifisert kostnad (305 venues, 2026-02-03):**

| Kategori | Antall |
|----------|--------|
| Food & Drink | 109 |
| Shopping | 71 |
| Activities | 36 |
| Accommodation | 32 |
| Museums & Attractions | 25 |
| Galleries | 16 |
| Health & Beauty | 15 |
| Interior | 1 |
| **TOTAL** | **305** |

| API-kall | Kostnad |
|----------|---------|
| Text Search (305×) | $9.76 |
| Place Details (305×) | $5.19 |
| Photos 3× (915×) | $6.41 |
| **Total per kjøring** | **$21.35** |

**Kjøretid:** ~9 minutter

### Duplikat-håndtering

1. Sjekk om `google_place_id` allerede finnes i `pois`-tabellen
2. Hvis ja: oppdater kun faktiske felt, bevar redaksjonelt innhold
3. **KRITISK: Bruk `upsertPOIsWithEditorialPreservation`** fra `lib/supabase/mutations.ts:454-525`

### Felt-oppdatering

| Felt | Handling |
|------|----------|
| `google_rating`, `google_review_count`, `photo_reference` | Oppdater alltid |
| `name`, `lat`, `lng`, `address`, `category_id` | Oppdater hvis tom |
| `editorial_hook`, `local_insight`, `story_priority` | **Aldri overskriv** |

### Research Insights: Data Integrity

**Fra data-integrity-guardian (KRITISK):**

Den nåværende `supabase.upsert()` **vil overskrive alle felt** inkludert redaksjonelt innhold. Dette er en **silent data loss** scenario.

**Løsning - bruk eksisterende funksjon:**
```typescript
import { upsertPOIsWithEditorialPreservation } from '../lib/supabase/mutations';

// Denne funksjonen:
// 1. Henter eksisterende POI-er
// 2. Bevarer editorial_hook, local_insight, story_priority
// 3. Merger nye data med eksisterende redaksjonelt innhold
await upsertPOIsWithEditorialPreservation(pois);
```

**Koordinat-validering (fra learnings):**
```typescript
const TRONDHEIM_BOUNDS = {
  minLat: 63.35, maxLat: 63.50,
  minLng: 10.20, maxLng: 10.60,
};

function validateCoordinates(lat: number, lng: number, name: string): void {
  if (lat === 0 && lng === 0) {
    throw new Error(`Ugyldige koordinater (0,0) for: ${name}`);
  }
  if (lat < TRONDHEIM_BOUNDS.minLat || lat > TRONDHEIM_BOUNDS.maxLat ||
      lng < TRONDHEIM_BOUNDS.minLng || lng > TRONDHEIM_BOUNDS.maxLng) {
    console.warn(`Koordinater utenfor Trondheim for: ${name} (${lat}, ${lng})`);
  }
}
```

## Acceptance Criteria

### Funksjonelle krav

- [ ] Script scraper alle 8 relevante CityGuide-kategorier
- [ ] Script matcher POI-er mot Google Places (binær match: found/not-found)
- [ ] POI-er uten Google-match logges til console (ikke opprettes)
- [ ] Eksisterende POI-er oppdateres uten å overskrive redaksjonelt innhold
- [ ] Nye kategorier (`activity`) opprettes automatisk

### Tekniske krav

- [ ] Følger eksisterende import-mønster (`scripts/import-bysykkel.ts`)
- [ ] Bruker `upsertPOIsWithEditorialPreservation()` fra `lib/supabase/mutations.ts`
- [ ] Bruker `slugify()` fra `lib/generators/poi-discovery.ts`
- [ ] 1.5 sekund delay mellom CityGuide-requests
- [ ] 200ms delay mellom Google API requests
- [ ] Validerer miljøvariabler ved oppstart

### Kvalitetskrav

- [ ] > 80% match-rate mot Google Places
- [ ] 0 duplikater i database etter kjøring
- [ ] Alle koordinater validert mot Trondheim bounds
- [ ] Ingen `any` types i TypeScript kode

### Research Insights: Acceptance Criteria Oppdateringer

**Fjernet (over-engineering):**
- ~~Checkpoint-fil for resume ved feil~~ - Unødvendig for 4 min kjøretid
- ~~Confidence scoring (high/medium/low/none)~~ - Forenklet til binær match
- ~~Exponential backoff~~ - Fast delay er tilstrekkelig for vårt volum
- ~~Manual review JSON export~~ - Console logging er tilstrekkelig

## Dependencies & Risks

### Dependencies

- Google Places API (allerede integrert)
- Supabase (allerede integrert)
- CityGuide.no tilgjengelig og scrape-bar

### Risks

| Risk | Sannsynlighet | Konsekvens | Mitigering |
|------|---------------|------------|------------|
| CityGuide endrer HTML-struktur | Medium | Scraper feiler | Modulær scraper med tydelige selectors |
| Google API rate limit | Lav | Pipeline stopper | Checkpoint + resume |
| IP-blokkering fra CityGuide | Lav | Ingen data | Respektfull scraping (1s delay) |
| Lav match-rate | Medium | Mange manuelle reviews | Justér confidence threshold |

## MVP Implementation

### Research Insights: Forenklet Arkitektur

**Fra simplicity-reviewer og pattern-recognition:**

Den opprinnelige 4-fase arkitekturen med mellomliggende JSON-filer er **over-engineered** for 200 POI-er. Sammenlign med `scripts/import-bysykkel.ts` som importerer lignende data i **145 linjer** uten faser, checkpointing, eller mellomfiler.

**Anbefalt: Single-file pipeline (~150 LOC)**

```
scripts/import-cityguide.ts   # Alt i én fil, følger import-bysykkel.ts mønster
```

**Fjernet kompleksitet:**
- ~~4 separate faser~~ → Single-pass pipeline
- ~~Intermediate JSON files~~ → Pass data gjennom memory
- ~~Checkpoint/resume system~~ → Kjør på nytt ved feil (4 min total)
- ~~Separate lib/ filer~~ → Inline i hovedscript
- ~~Confidence scoring (4 tiers)~~ → Binary match (found/not-found)
- ~~Manual review JSON export~~ → Console.log failures

### Filstruktur (Forenklet)

```
scripts/
└── import-cityguide.ts          # Komplett script (~150 LOC)

data/
└── cityguide/                   # Kun for debugging/logging
    └── import-log.json          # Valgfri: resultat-logg
```

### Forenklet Implementering (Single-File)

**Research Insights integrert:**
- Zod-validering for environment og scraped data (fra security-sentinel)
- Cheerio 1.x `fromURL` og `extract` API (fra web-scraping research)
- Proper TypeScript interfaces (fra kieran-typescript-reviewer)
- Reuse eksisterende funksjoner (fra pattern-recognition)

### TypeScript Interfaces (inline i script)

```typescript
// Typed interfaces - ingen `any`
interface ScrapedVenue {
  name: string;
  category: string;
  cityguideUrl: string;
}

interface GoogleMatch {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  address: string;
  businessStatus: string;
}

interface ImportablePOI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  category_id: string;
  google_place_id: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  editorial_sources: string[];
}
```

### Web Scraping med Cheerio 1.x

```typescript
import * as cheerio from 'cheerio';

const CITYGUIDE_BASE = 'https://cityguide.no/trondheim';

// Cheerio 1.x extract API - mer robust enn manuell DOM traversal
async function scrapeVenueLinks(categoryPath: string): Promise<string[]> {
  const $ = await cheerio.fromURL(`${CITYGUIDE_BASE}${categoryPath}`);

  // Layered fallback selectors for resilience
  const selectors = [
    'a[data-venue-link]',
    'a.venue-card',
    '.venue-list a[href*="/trondheim/"]',
  ];

  for (const selector of selectors) {
    const links = $(selector).map((_, el) => $(el).attr('href')).get();
    if (links.length > 0) return links.filter(Boolean) as string[];
  }

  console.warn(`Ingen venues funnet med standard selectors for ${categoryPath}`);
  return [];
}

async function scrapeVenueName(url: string): Promise<string | null> {
  const $ = await cheerio.fromURL(url);

  // Fallback selectors for venue name
  const nameSelectors = [
    'h1[data-venue-name]',
    'h1.venue-name',
    '[itemtype="LocalBusiness"] [itemprop="name"]',
    'header h1',
  ];

  for (const selector of nameSelectors) {
    const name = $(selector).first().text().trim();
    if (name) return name;
  }

  return null;
}
```

### Google Places Matching (Forenklet)

```typescript
import { distance as levenshtein } from 'fastest-levenshtein';

interface GoogleTextSearchResponse {
  status: string;
  results: Array<{
    place_id: string;
    name: string;
    geometry: { location: { lat: number; lng: number } };
    rating?: number;
    user_ratings_total?: number;
    formatted_address: string;
    business_status?: string;
  }>;
}

async function matchWithGoogle(
  name: string,
  apiKey: string
): Promise<GoogleMatch | null> {
  const query = `${name} Trondheim`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google API HTTP error: ${response.status}`);
  }

  const data: GoogleTextSearchResponse = await response.json();

  if (data.status === 'ZERO_RESULTS') return null;
  if (data.status !== 'OK') {
    throw new Error(`Google API error: ${data.status}`);
  }

  // Filter aktive steder og finn beste match
  const activeResults = data.results.filter(
    r => r.business_status !== 'CLOSED_PERMANENTLY'
  );

  if (activeResults.length === 0) return null;

  const normalizedQuery = name.toLowerCase().trim();

  for (const result of activeResults) {
    const normalizedResult = result.name.toLowerCase().trim();
    const dist = levenshtein(normalizedQuery, normalizedResult);
    const maxLen = Math.max(normalizedQuery.length, normalizedResult.length);
    const similarity = 1 - dist / maxLen;

    // Binary match: > 60% similarity = accept
    if (similarity > 0.6) {
      return {
        placeId: result.place_id,
        name: result.name,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        rating: result.rating || 0,
        reviewCount: result.user_ratings_total || 0,
        address: result.formatted_address,
        businessStatus: result.business_status || 'OPERATIONAL',
      };
    }
  }

  // Ingen god match
  console.log(`  Ingen match for: ${name}`);
  return null;
}

### scripts/import-cityguide.ts (Forenklet ~150 LOC)

```typescript
/**
 * CityGuide POI Import Script
 *
 * Følger eksisterende mønster fra import-bysykkel.ts
 * Single-pass pipeline: scrape → match → upsert
 */
import * as dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { distance as levenshtein } from 'fastest-levenshtein';
import { slugify } from '../lib/generators/poi-discovery';
import { upsertPOIsWithEditorialPreservation } from '../lib/supabase/mutations';

dotenv.config({ path: '.env.local' });

// ============ ENVIRONMENT VALIDATION ============
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Feil: Mangler miljøvariabel: ${name}`);
    process.exit(1);
  }
  return value;
}

// ============ CONSTANTS ============
const CITYGUIDE_BASE = 'https://cityguide.no/trondheim';
const DELAY_MS = 1500; // Respektfull scraping

const CATEGORY_MAP: Record<string, string> = {
  '/food-drink': 'restaurant',
  '/museums-attractions': 'museum',
  '/galleries': 'museum',
  '/shopping': 'shopping',
  '/interior': 'shopping',
  '/activities': 'activity',
  '/health-beauty': 'spa',
  '/accommodation': 'hotel',
};

const TRONDHEIM_BOUNDS = {
  minLat: 63.35, maxLat: 63.50,
  minLng: 10.20, maxLng: 10.60,
};

// ============ HELPERS ============
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function validateCoordinates(lat: number, lng: number): boolean {
  if (lat === 0 && lng === 0) return false;
  return lat >= TRONDHEIM_BOUNDS.minLat && lat <= TRONDHEIM_BOUNDS.maxLat &&
         lng >= TRONDHEIM_BOUNDS.minLng && lng <= TRONDHEIM_BOUNDS.maxLng;
}

// ============ MAIN ============
async function main() {
  const googleApiKey = getRequiredEnv('GOOGLE_PLACES_API_KEY');
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, supabaseKey);
  const seenIds = new Set<string>();

  console.log('CityGuide Import');
  console.log('================');

  // 1. Scrape alle kategorier
  console.log('\n1. Scraper CityGuide kategorier...');
  const scrapedVenues: ScrapedVenue[] = [];

  for (const [categoryPath, placyCategory] of Object.entries(CATEGORY_MAP)) {
    const links = await scrapeVenueLinks(categoryPath);
    console.log(`  ${categoryPath}: ${links.length} venues`);

    for (const link of links) {
      const name = await scrapeVenueName(link);
      if (name) {
        scrapedVenues.push({ name, category: placyCategory, cityguideUrl: link });
      }
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n  Totalt scraped: ${scrapedVenues.length} venues`);

  // 2. Match mot Google Places
  console.log('\n2. Matcher mot Google Places...');
  const pois: ImportablePOI[] = [];
  let matchCount = 0;
  let noMatchCount = 0;

  for (const venue of scrapedVenues) {
    const match = await matchWithGoogle(venue.name, googleApiKey);

    if (match && validateCoordinates(match.lat, match.lng)) {
      const id = generatePoiId(match.placeId, venue.name, seenIds);
      pois.push({
        id,
        name: match.name,
        lat: match.lat,
        lng: match.lng,
        address: match.address,
        category_id: venue.category,
        google_place_id: match.placeId,
        google_rating: match.rating,
        google_review_count: match.reviewCount,
        editorial_sources: ['cityguide.no'],
      });
      matchCount++;
    } else {
      console.log(`  Ingen match: ${venue.name}`);
      noMatchCount++;
    }

    await sleep(200); // Google rate limiting
  }

  console.log(`\n  Matchet: ${matchCount}, Ingen match: ${noMatchCount}`);
  console.log(`  Match rate: ${((matchCount / scrapedVenues.length) * 100).toFixed(1)}%`);

  // 3. Opprett manglende kategorier
  console.log('\n3. Oppretter kategorier...');
  const { error: catError } = await supabase.from('categories').upsert({
    id: 'activity',
    name: 'Aktivitet',
    icon: 'Compass',
    color: '#f97316',
  }, { onConflict: 'id' });

  if (catError) {
    console.error('Kategori-feil:', catError.message);
  }

  // 4. Importer til Supabase med editorial preservation
  console.log('\n4. Importerer til Supabase...');
  await upsertPOIsWithEditorialPreservation(pois);

  console.log(`\n✓ Ferdig! Importert ${pois.length} POI-er`);
}

main().catch(err => {
  console.error('Fatal feil:', err);
  process.exit(1);
});
```

## Kommando

```bash
# Full kjøring (forenklet - ingen faser)
npx tsx scripts/import-cityguide.ts

# Dry-run for testing (valgfritt å implementere)
npx tsx scripts/import-cityguide.ts --dry-run
```

### Research Insights: Avhengigheter

**Nye pakker som må installeres:**
```bash
npm install cheerio@^1.0.0 fastest-levenshtein
```

**Eksisterende pakker som brukes:**
- `@supabase/supabase-js` (allerede installert)
- `dotenv` (allerede installert)

## Success Metrics

| Metrikk | Mål |
|---------|-----|
| Match rate (high + medium) | > 80% |
| Duplikater etter import | 0 |
| Koordinater innenfor bounds | 100% |
| Kjøretid full pipeline | < 30 minutter |

## Security Considerations

**Fra security-sentinel review:**

### API Key Protection
- Google API key brukes kun server-side i CLI script
- Konfigurer API key restrictions i Google Cloud Console (IP allowlist)
- Sett quota limits for å forhindre misbruk

### Input Sanitization
```typescript
// Valider scraped data før bruk
function sanitizeName(name: string): string {
  return name
    .trim()
    .slice(0, 200) // Max lengde
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // Fjern control chars
}
```

### Supabase Service Role
- Service role key gir full database-tilgang
- Kun bruk i CLI scripts, aldri client-side
- Scriptet validerer env vars ved oppstart

## References

### Internal References

- Import mønster: `scripts/import-bysykkel.ts:65-140`
- Editorial preservation: `lib/supabase/mutations.ts:454-525`
- Slugify funksjon: `lib/generators/poi-discovery.ts:452`
- ID generering: `lib/generators/poi-discovery.ts:433-445`
- Kategori-mapping: `lib/generators/poi-discovery.ts:39-60`
- Google Places API: `app/api/places/route.ts:1-133`

### Learnings Applied

- `docs/solutions/data-import/import-wfs-geographic-data-20260125.md` - ID collision detection, bounds validation
- `docs/solutions/data-import/data-import-taxi-stands-20260125.md` - Slugify with NFD, batch upsert pattern
- `docs/solutions/data-import/import-entur-stops-20260125.md` - Duplicate name handling, store external IDs

### External References

- CityGuide Trondheim: https://cityguide.no/trondheim
- Google Places Text Search (New): https://developers.google.com/maps/documentation/places/web-service/text-search
- Google Places Field Masks: https://developers.google.com/maps/documentation/places/web-service/choose-fields
- Cheerio 1.x Documentation: https://cheerio.js.org/
- fastest-levenshtein: https://www.npmjs.com/package/fastest-levenshtein

### Brainstorm

- `docs/brainstorms/2026-02-03-cityguide-data-integration-brainstorm.md`
