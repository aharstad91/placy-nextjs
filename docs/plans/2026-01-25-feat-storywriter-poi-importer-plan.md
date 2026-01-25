# Plan: StoryWriter & POI Importer

**Dato:** 2026-01-25
**Revidert:** 2026-01-25 (etter plan review)
**Brainstorm:** `docs/brainstorms/2026-01-25-story-architecture-poi-importer-storywriter-brainstorm.md`
**Status:** Klar for implementering

## Oversikt

To separate features som sammen gir autonom story-generering:

1. **StoryWriter** - Genererer story-struktur fra eksisterende POI-er i Supabase
2. **POI Importer** - Henter POI-er fra eksterne kilder og lagrer i Supabase

## Prioritet

**StoryWriter først** - Den er kritisk for autonomi og krever kun eksisterende POI-er.
**POI Importer deretter** - Fyller databasen, men import-scripts finnes allerede.

---

## Review-funn (inkorporert)

| # | Problem | Løsning | Status |
|---|---------|---------|--------|
| 1 | Ingen PostGIS i schema | Bruk Haversine i applikasjon (gjenbruk `calculateDistance()`) | ✅ |
| 2 | Type mismatch DbPoi vs DiscoveredPOI | Lag `dbPoiToDiscoveredPOI()` transformer | ✅ |
| 3 | Mangler project_pois populering | StoryWriter populerer `project_pois` først | ✅ |
| 4 | Ufullstendig output | Inkluder `story_sections` og `section_pois` | ✅ |
| 5 | ID-strategi udefinert | Bruk `crypto.randomUUID()` for alle nye entries | ✅ |
| 6 | Ingen feilhåndtering | Validering før skriving, tydelige feilmeldinger | ✅ |
| 7 | Kategori-sync mangler | POI Importer syncer kategorier fra mappings | ✅ |
| 8 | Prosjekt må opprettes i Supabase | StoryWriter oppretter prosjekt hvis det ikke finnes | ✅ |

### Tilleggsfunn fra plan review (implementert)

| # | Problem | Løsning | Implementert i |
|---|---------|---------|----------------|
| P1-1 | Editorial innhold kan overskrives ved re-import | `upsertPOIsWithEditorialPreservation()` med fetch-merge-upsert | `mutations.ts` |
| P1-2 | Ingen transaction support for story writes | `writeStoryStructureWithRollback()` med backup-restore | `mutations.ts` |
| P2-1 | N+1 queries i theme story henting | Batch fetch med IN clause + lookup maps | `queries.ts` |
| P2-2 | Memory-intensive radius filter | Bounding box pre-filter i database før Haversine | `queries.ts` |
| P2-3 | POI ID-kollisjon på tvers av kilder | Source-prefixed IDs: `{source}-{external_id}` | `poi-discovery.ts` |
| P2-4 | Duplikat calculateDistance | Sentralisert i `lib/utils/geo.ts` | `geo.ts` |

---

## Del 1: StoryWriter

### Hva den gjør

1. Tar input: prosjektnavn, kunde, senterkoordinater, radius, kategorier
2. **Oppretter prosjekt** i Supabase (hvis nytt) eller bruker eksisterende
3. Henter POI-er fra Supabase innen radius (Haversine-filtrering)
4. Transformerer DbPoi → DiscoveredPOI for bruk med eksisterende logikk
5. Bruker `story-structure.ts` for å generere themes og seksjoner
6. Skriver **komplett struktur** til Supabase:
   - `project_pois` (kobling mellom prosjekt og POI-er)
   - `theme_stories` (tematiske stories)
   - `theme_story_sections` (seksjoner i themes)
   - `theme_section_pois` (POI-er i theme-seksjoner)
   - `story_sections` (hovedstory seksjoner)
   - `section_pois` (POI-er i hovedstory-seksjoner)

### Arbeidspakker

#### 1.1 Supabase Query: Hent POI-er innen radius
**Fil:** `lib/supabase/queries.ts`

```typescript
import { calculateDistance } from '@/lib/generators/poi-discovery';

async function getPOIsWithinRadius(
  center: { lat: number; lng: number },
  radiusMeters: number,
  categoryIds?: string[]
): Promise<DbPoi[]> {
  const supabase = createServerClient();

  // Hent alle POI-er (eventuelt filtrert på kategorier)
  let query = supabase.from('pois').select('*');
  if (categoryIds?.length) {
    query = query.in('category_id', categoryIds);
  }

  const { data: pois } = await query;

  // Filtrer med Haversine (ingen PostGIS avhengighet)
  return (pois || []).filter(poi =>
    calculateDistance(center.lat, center.lng, poi.lat, poi.lng) <= radiusMeters
  );
}
```

#### 1.2 POI Transformer
**Fil:** `lib/generators/story-writer.ts` (ny fil)

```typescript
import { DiscoveredPOI } from './poi-discovery';
import { DbPoi, DbCategory } from '@/lib/supabase/types';

function dbPoiToDiscoveredPOI(
  dbPoi: DbPoi,
  category: DbCategory
): DiscoveredPOI {
  return {
    id: dbPoi.id,
    name: dbPoi.name,
    coordinates: { lat: dbPoi.lat, lng: dbPoi.lng },
    address: dbPoi.address ?? undefined,
    category: {
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
    },
    googlePlaceId: dbPoi.google_place_id ?? undefined,
    googleRating: dbPoi.google_rating ?? undefined,
    googleReviewCount: dbPoi.google_review_count ?? undefined,
    source: determineSource(dbPoi),
    enturStopplaceId: dbPoi.entur_stopplace_id ?? undefined,
    bysykkelStationId: dbPoi.bysykkel_station_id ?? undefined,
    editorialHook: dbPoi.editorial_hook ?? undefined,
    localInsight: dbPoi.local_insight ?? undefined,
  };
}

function determineSource(poi: DbPoi): 'google' | 'entur' | 'bysykkel' | 'manual' {
  if (poi.google_place_id) return 'google';
  if (poi.entur_stopplace_id) return 'entur';
  if (poi.bysykkel_station_id) return 'bysykkel';
  return 'manual';
}
```

#### 1.3 StoryWriter Core Logic
**Fil:** `lib/generators/story-writer.ts` (fortsettelse)

```typescript
interface GeneratedStructure {
  projectPois: string[];                    // POI IDs å koble til prosjekt
  themeStories: ThemeStoryInsert[];
  themeSections: ThemeSectionInsert[];
  themeSectionPois: ThemeSectionPoiInsert[];
  storySections: StorySectionInsert[];      // Hovedstory seksjoner
  sectionPois: SectionPoiInsert[];          // POI-er i hovedstory
}

interface ThemeStoryInsert {
  id: string;  // UUID
  project_id: string;
  slug: string;
  title: string;
  bridge_text: string | null;
  sort_order: number;
}

interface ThemeSectionInsert {
  id: string;  // UUID
  theme_story_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

interface ThemeSectionPoiInsert {
  section_id: string;
  poi_id: string;
  sort_order: number;
}

interface StorySectionInsert {
  id: string;  // UUID
  project_id: string;
  type: 'poi_list' | 'theme_story_cta';
  title: string;
  bridge_text: string | null;
  theme_story_id: string | null;
  sort_order: number;
}

interface SectionPoiInsert {
  section_id: string;
  poi_id: string;
  sort_order: number;
}

async function generateStoryForProject(
  projectId: string,
  pois: DiscoveredPOI[],
  config: StoryGeneratorConfig
): Promise<GeneratedStructure> {
  // Gjenbruker logikk fra story-structure.ts
  const { story, allCategories } = generateStoryStructure(pois, config);

  // Transform til Supabase-format med UUIDs
  return transformToSupabaseStructure(projectId, story, pois);
}
```

#### 1.4 Supabase Write Functions
**Fil:** `lib/supabase/mutations.ts` (ny fil)

```typescript
import { createServerClient } from './client';

// Opprett prosjekt
async function createProject(data: {
  name: string;
  customerId: string;
  urlSlug: string;
  centerLat: number;
  centerLng: number;
}): Promise<string> {
  const supabase = createServerClient();
  const id = crypto.randomUUID();

  const { error } = await supabase.from('projects').insert({
    id,
    name: data.name,
    customer_id: data.customerId,
    url_slug: data.urlSlug,
    center_lat: data.centerLat,
    center_lng: data.centerLng,
  });

  if (error) throw new Error(`Kunne ikke opprette prosjekt: ${error.message}`);
  return id;
}

// Koble POI-er til prosjekt
async function linkPOIsToProject(projectId: string, poiIds: string[]): Promise<void> {
  const supabase = createServerClient();

  // Slett eksisterende koblinger
  await supabase.from('project_pois').delete().eq('project_id', projectId);

  // Sett inn nye
  if (poiIds.length > 0) {
    const inserts = poiIds.map(poiId => ({ project_id: projectId, poi_id: poiId }));
    const { error } = await supabase.from('project_pois').insert(inserts);
    if (error) throw new Error(`Kunne ikke koble POI-er: ${error.message}`);
  }
}

// Skriv komplett story-struktur
async function writeStoryStructure(
  projectId: string,
  structure: GeneratedStructure
): Promise<void> {
  const supabase = createServerClient();
  const errors: string[] = [];

  // 1. Koble POI-er til prosjekt
  await linkPOIsToProject(projectId, structure.projectPois);

  // 2. Slett eksisterende story-data for prosjektet
  await supabase.from('theme_stories').delete().eq('project_id', projectId);
  await supabase.from('story_sections').delete().eq('project_id', projectId);

  // 3. Sett inn theme stories
  if (structure.themeStories.length > 0) {
    const { error } = await supabase.from('theme_stories').insert(structure.themeStories);
    if (error) errors.push(`theme_stories: ${error.message}`);
  }

  // 4. Sett inn theme sections
  if (structure.themeSections.length > 0) {
    const { error } = await supabase.from('theme_story_sections').insert(structure.themeSections);
    if (error) errors.push(`theme_story_sections: ${error.message}`);
  }

  // 5. Sett inn theme section POIs
  if (structure.themeSectionPois.length > 0) {
    const { error } = await supabase.from('theme_section_pois').insert(structure.themeSectionPois);
    if (error) errors.push(`theme_section_pois: ${error.message}`);
  }

  // 6. Sett inn story sections
  if (structure.storySections.length > 0) {
    const { error } = await supabase.from('story_sections').insert(structure.storySections);
    if (error) errors.push(`story_sections: ${error.message}`);
  }

  // 7. Sett inn section POIs
  if (structure.sectionPois.length > 0) {
    const { error } = await supabase.from('section_pois').insert(structure.sectionPois);
    if (error) errors.push(`section_pois: ${error.message}`);
  }

  if (errors.length > 0) {
    throw new Error(`Feil ved skriving: ${errors.join('; ')}`);
  }
}
```

#### 1.5 API Route
**Fil:** `app/api/story-writer/route.ts` (ny fil)

```typescript
POST /api/story-writer
Body: {
  // For nytt prosjekt:
  name: string
  customerId: string
  center: { lat: number, lng: number }
  radius: number
  categoryIds?: string[]

  // ELLER for eksisterende:
  projectId?: string  // Hvis satt, regenerer for eksisterende prosjekt
}
Response: {
  success: boolean
  projectId: string
  projectUrl: string
  themeCount: number
  poiCount: number
  message?: string  // Feilmelding eller advarsel
}
```

**Valideringer:**
- Minimum 1 POI innen radius (ellers feil med forslag om større radius)
- Gyldig kunde-ID
- Gyldige kategori-IDer

#### 1.6 Oppdater Generate GUI
**Fil:** `app/admin/generate/generate-client.tsx`

Endringer:
- Kall `/api/story-writer` i stedet for `/api/generate`
- Fjern JSON-fil-referanser fra success state
- Legg til feilhåndtering for "ingen POI-er funnet"
- Behold samme UX (progress steps, success state)

### Filer som endres/opprettes (StoryWriter)

| Fil | Handling |
|-----|----------|
| `lib/supabase/queries.ts` | Legg til `getPOIsWithinRadius()` |
| `lib/supabase/mutations.ts` | **Ny fil** - createProject, linkPOIs, writeStoryStructure |
| `lib/generators/story-writer.ts` | **Ny fil** - dbPoiToDiscoveredPOI, generateStoryForProject |
| `app/api/story-writer/route.ts` | **Ny fil** - API endpoint |
| `app/admin/generate/generate-client.tsx` | Oppdater til å bruke ny API |

---

## Del 2: POI Importer (Forenklet)

> **Note:** Etter code-simplicity-reviewer feedback er denne seksjonen forenklet.
> Eksisterende CLI-scripts (`npm run import:bysykkel`, etc.) fungerer allerede.
> API route er valgfri - kun hvis Admin GUI trengs.

### Hva den gjør

1. Henter POI-data fra ekstern kilde (Google, Entur, Bysykkel)
2. **Bevarer eksisterende editorial innhold** via `upsertPOIsWithEditorialPreservation()`
3. Kategorier synces inline (3 linjer, ikke egen funksjon)
4. POI-er får **source-prefixed IDs** via `generatePoiId()` for å unngå kollisjon

### Allerede implementert

Følgende er ferdig implementert i kodebasen:

| Funksjon | Fil | Beskrivelse |
|----------|-----|-------------|
| `generatePoiId()` | `poi-discovery.ts` | Source-prefixed IDs: `google-{place_id}`, `entur-{stopplace_id}` |
| `upsertPOIsWithEditorialPreservation()` | `mutations.ts` | Fetch-merge-upsert som bevarer editorial content |
| `upsertCategories()` | `mutations.ts` | Syncer kategorier fra POI-data |
| `calculateBoundingBox()` | `utils/geo.ts` | Database pre-filter for radius-søk |

### Anbefalt tilnærming: Minimal API Route

Hele POI Importer kan være ~40 linjer:

```typescript
// app/api/import-pois/route.ts
import { discoverPOIs, GOOGLE_CATEGORY_MAP, TRANSPORT_CATEGORIES } from '@/lib/generators/poi-discovery';
import { upsertPOIsWithEditorialPreservation, upsertCategories } from '@/lib/supabase/mutations';

export async function POST(req: Request) {
  const { center, radius, categories } = await req.json();

  // 1. Discover POIs (gjenbruker eksisterende logikk)
  const config = { center, radius, googleCategories: categories, includeTransport: true };
  const discovered = await discoverPOIs(config, process.env.GOOGLE_API_KEY!);

  // 2. Transform inline (10 linjer, ikke egen funksjon)
  const pois = discovered.map(poi => ({
    id: poi.id,  // Allerede source-prefixed fra generatePoiId()
    name: poi.name,
    lat: poi.coordinates.lat,
    lng: poi.coordinates.lng,
    address: poi.address || null,
    category_id: poi.category.id,
    google_place_id: poi.googlePlaceId || null,
    google_rating: poi.googleRating || null,
    google_review_count: poi.googleReviewCount || null,
    entur_stopplace_id: poi.enturStopplaceId || null,
    bysykkel_station_id: poi.bysykkelStationId || null,
  }));

  // 3. Sync kategorier inline (3 linjer)
  const usedCategories = [...new Map(discovered.map(p => [p.category.id, p.category])).values()];
  await upsertCategories(usedCategories);

  // 4. Upsert med editorial preservation
  const result = await upsertPOIsWithEditorialPreservation(pois);

  return Response.json({
    success: true,
    imported: result.inserted + result.updated,
    ...result
  });
}
```

### Alternativ: Behold CLI-only

Eksisterende scripts fungerer allerede:
- `npm run import:bysykkel`
- `npm run import:hyre`
- `npm run import:atb-stops`
- `npm run import:taxi-stands`

**Fordel:** Null ny kode, allerede testet
**Ulempe:** Må bruke terminal

### Filer som endres/opprettes (POI Importer)

| Fil | Handling | Status |
|-----|----------|--------|
| `lib/generators/poi-discovery.ts` | `generatePoiId()` med source prefix | ✅ Implementert |
| `lib/supabase/mutations.ts` | `upsertPOIsWithEditorialPreservation()` | ✅ Implementert |
| `lib/supabase/mutations.ts` | `upsertCategories()` | ✅ Implementert |
| `lib/utils/geo.ts` | `calculateBoundingBox()`, `calculateDistance()` | ✅ Implementert |
| `app/api/import-pois/route.ts` | **Valgfri** - API endpoint | ⏳ Ved behov |
| `app/admin/import/page.tsx` | **Valgfri** - Admin GUI | ⏳ Ved behov |

---

## Implementeringsrekkefølge

### Fase 1: StoryWriter (kritisk)
1. `lib/supabase/queries.ts` - getPOIsWithinRadius med Haversine
2. `lib/supabase/mutations.ts` - createProject, linkPOIs, writeStoryStructure
3. `lib/generators/story-writer.ts` - transformer + generateStoryForProject
4. `app/api/story-writer/route.ts` - API endpoint
5. `app/admin/generate/generate-client.tsx` - oppdater GUI

### Fase 2: POI Importer
1. `lib/generators/poi-discovery.ts` - discoverAndPrepareForImport
2. `lib/supabase/mutations.ts` - syncCategories, upsertPOIs
3. `app/api/poi-importer/route.ts` - API endpoint
4. `app/admin/import/page.tsx` - Admin GUI

---

## Testing

### StoryWriter
- [ ] Oppretter nytt prosjekt i Supabase
- [ ] Regenererer story for eksisterende prosjekt
- [x] Henter kun POI-er innen radius (bounding box + Haversine)
- [ ] Kategorifiltrering fungerer
- [ ] Genererer themes, sections og POI-koblinger
- [ ] Data vises korrekt i Story Editor etterpå
- [ ] Håndterer 0 POI-er med tydelig feilmelding
- [x] Transaction support: Rollback ved feil (writeStoryStructureWithRollback)
- [x] N+1 queries fikset (batch fetch med IN clause)

### POI Importer
- [ ] Syncer kategorier før import
- [ ] Google import lagrer i Supabase
- [ ] Entur import lagrer i Supabase
- [ ] Bysykkel import lagrer i Supabase
- [x] Upsert bevarer editorial innhold (upsertPOIsWithEditorialPreservation)
- [x] Duplikater håndteres korrekt (source-prefixed IDs)
- [x] POI IDs har source prefix (google-, entur-, bysykkel-)
- [ ] CLI scripts fungerer (npm run import:bysykkel, etc.)

---

## Avhengigheter

- ✅ Haversine i applikasjon (ingen PostGIS nødvendig)
- ✅ `calculateDistance()` og `calculateBoundingBox()` fra `lib/utils/geo.ts`
- ✅ `generatePoiId()` fra `lib/generators/poi-discovery.ts`
- ✅ `upsertPOIsWithEditorialPreservation()` fra `lib/supabase/mutations.ts`
- ✅ `writeStoryStructureWithRollback()` fra `lib/supabase/mutations.ts`
- Eksisterende kategorier synces automatisk
- Google Places API key konfigurert
- ADMIN_ENABLED=true

## Risiko og mitigering

| Risiko | Mitigering | Status |
|--------|------------|--------|
| Ingen POI-er i radius | Tydelig feilmelding: "Ingen POI-er funnet. Prøv større radius eller importer POI-er først." | ⏳ |
| Stor database (alle POI-er lastes) | **Bounding box pre-filter** i database før Haversine | ✅ Implementert |
| API rate limiting (Google) | Batch med delays (200ms), caching av resultater | ✅ Eksisterer |
| Duplikat-IDer på tvers av kilder | **Source-prefixed IDs**: `{source}-{external_id}` via `generatePoiId()` | ✅ Implementert |
| Editorial innhold overskrives | **Fetch-merge-upsert** via `upsertPOIsWithEditorialPreservation()` | ✅ Implementert |
| Story write feiler midtveis | **Backup-restore pattern** via `writeStoryStructureWithRollback()` | ✅ Implementert |
| N+1 queries ved theme story henting | **Batch fetch med IN clause** og lookup maps | ✅ Implementert |
