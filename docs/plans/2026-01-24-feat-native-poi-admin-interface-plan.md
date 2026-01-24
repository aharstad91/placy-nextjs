---
title: "feat: Native POI Admin Interface"
type: feat
date: 2026-01-24
reviewed: true
---

# feat: Native POI Admin Interface

## Overview

Bygg et admin-grensesnitt i Placy for å registrere native POIs - steder som ikke kommer fra Google Places. Grensesnittet skal støtte rask registrering av 20+ POIs per prosjekt.

Native POIs skal fungere identisk med Google POIs i UI.

## Problem Statement

I dag hentes POIs kun fra Google Places API. Noen steder finnes ikke i Google, eller vi ønsker egne steder med redaksjonelt innhold. Det trengs en enkel måte å registrere disse på.

## Proposed Solution

**Én side** på `/admin/pois` med alt samlet:
- Kart med klikk-for-koordinater
- Adressesøk via Mapbox Geocoding
- Enkelt skjema
- POI-liste under

## Technical Approach

### Arkitektur (forenklet etter review)

```
/app/admin/pois/
  page.tsx              # Alt i én fil (~350 linjer)
                        # - Server Component shell med auth-sjekk
                        # - Client Component med kart + form + liste

/app/api/geocode/
  route.ts              # Mapbox Geocoding proxy (~15 linjer)
```

**Det er det.** Ingen separate komponenter, ingen CRUD API-ruter, ingen layout-wrapper.

### Hvorfor så enkelt?

Review-feedback fra DHH/Kieran/Simplicity:
- Separate API-ruter er overkill for intern admin
- Bruk Server Actions for CRUD direkte mot Supabase
- Alt i én fil til det faktisk blir smertefullt (det blir det ikke)
- 6 faser for et CRUD-skjema er over-engineering

### Database

Bruker eksisterende `pois`-tabell. Native POIs har `google_place_id = NULL`.

### Sikkerhet

```typescript
// Toppen av page.tsx
if (process.env.ADMIN_ENABLED !== 'true') {
  redirect('/');
}
```

### Koordinat-input

1. **Klikk på kart:** `<Map onClick={(e) => setCoordinates(...)} />`
2. **Adressesøk:** Fetch til `/api/geocode` → oppdater koordinater

## Implementation

### page.tsx struktur

```typescript
// app/admin/pois/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/client';

// Auth check
if (process.env.ADMIN_ENABLED !== 'true') {
  redirect('/');
}

// Server Actions
async function createPOI(formData: FormData) {
  'use server';
  const supabase = createServerClient();
  // Insert directly to Supabase
}

async function deletePOI(id: string) {
  'use server';
  // Delete from Supabase
}

// Fetch existing POIs
export default async function AdminPOIsPage() {
  const supabase = createServerClient();
  const { data: pois } = await supabase
    .from('pois')
    .select('*')
    .is('google_place_id', null);

  const { data: categories } = await supabase
    .from('categories')
    .select('*');

  return <POIAdminClient pois={pois} categories={categories} />;
}

// Client Component (same file or separate 'use client' section)
'use client';
function POIAdminClient({ pois, categories }) {
  const [coordinates, setCoordinates] = useState(null);
  // Map + Form + List - all inline
}
```

### Geocode API

```typescript
// app/api/geocode/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${process.env.MAPBOX_TOKEN}&country=NO&limit=5`
  );

  return Response.json(await res.json());
}
```

### Form-felt

**Required:**
- `name` - Tekstfelt
- `coordinates` - Fra kart/søk (lat, lng)
- `category` - Dropdown

**Optional (vis med "Vis flere felt"):**
- `address` - Autofylt fra geocoding
- `description` - Tekstområde
- `editorialHook` - Tekstfelt
- `localInsight` - Tekstfelt
- `storyPriority` - Dropdown

### Validering

Enkel inline validering, ingen Zod:

```typescript
function validate(data) {
  if (!data.name?.trim()) return 'Navn er påkrevd';
  if (!data.coordinates) return 'Velg posisjon på kartet';
  if (!data.category) return 'Velg kategori';
  return null;
}
```

## Acceptance Criteria

- [x] `/admin/pois` viser kart og skjema
- [x] Klikk på kart setter koordinater
- [x] Adressesøk fungerer og oppdaterer kart
- [x] Kan opprette POI med navn, koordinat, kategori
- [x] POI lagres i Supabase og vises i liste
- [x] Kan slette POI fra listen
- [x] Ruten er beskyttet med `ADMIN_ENABLED`

## Success Metrics

- Kan registrere 20+ POIs uten friksjon
- POIs vises korrekt i hovedappen

## Dependencies

- Supabase `pois`-tabell
- Supabase `categories`-tabell
- Mapbox token

## References

- POI-type: `lib/types.ts`
- Supabase client: `lib/supabase/client.ts`
- MapView: `components/map/map-view.tsx`
- [Mapbox Geocoding API](https://docs.mapbox.com/api/search/geocoding/)
- Brainstorm: `docs/brainstorms/2026-01-24-native-poi-registration-brainstorm.md`

---

*Plan forenklet etter review av DHH/Kieran/Simplicity-agenter 2026-01-24*
