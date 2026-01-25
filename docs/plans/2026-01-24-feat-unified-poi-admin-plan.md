---
title: "feat: Unified POI Admin with Category Filtering"
type: feat
date: 2026-01-24
brainstorm: docs/brainstorms/2026-01-24-master-poi-map-brainstorm.md
---

# Unified POI Admin with Category Filtering

## Overview

Utvide `/admin/pois` til å vise og redigere **alle POIs** (native + Google), med kategori-filtrering i sidebar. Ett sted for all POI-administrasjon.

## Problem Statement / Motivation

**Nåværende situasjon:**
- Admin/pois viser kun native POIs (filter: `google_place_id IS NULL`)
- Ingen måte å se helheten av tilgjengelige POIs
- Google POIs kan ikke redigeres (editorial hooks, local insight)
- Ingen kategori-filtrering

**Ønsket situasjon:**
- Se alle POIs på ett kart
- Filtrere per kategori
- Redigere både native og Google POIs

## Proposed Solution

Evolve eksisterende `/admin/pois` med minimal endring:

1. **Fjern google_place_id filter** i data-henting
2. **Legg til kategori filter-panel** i sidebar
3. **Tilpass skjema** for å håndtere Google POIs (read-only felter for rating/reviews)

## Technical Considerations

### Filer som endres

| Fil | Endring |
|-----|---------|
| `app/admin/pois/page.tsx` | Fjern `.is("google_place_id", null)` filter |
| `app/admin/pois/poi-admin-client.tsx` | Legg til filter state, filter UI, Google-felter i form |

### Data-endring

```typescript
// page.tsx linje 136-137 - FØR:
const { data: pois } = await supabase
  .from("pois")
  .select("*")
  .is("google_place_id", null)  // ← Fjern denne
  .order("created_at", { ascending: false });

// ETTER:
const { data: pois } = await supabase
  .from("pois")
  .select("*")
  .order("created_at", { ascending: false });
```

### Filter State med URL Sync (poi-admin-client.tsx)

```typescript
import { useSearchParams, useRouter } from 'next/navigation';

// Les kategorier fra URL, fallback til alle
const searchParams = useSearchParams();
const router = useRouter();

const categoriesParam = searchParams.get('categories');
const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => {
  if (categoriesParam) {
    return new Set(categoriesParam.split(','));
  }
  return new Set(categories.map(c => c.id)); // Alle ON ved start
});

// Sync til URL når filter endres
const updateCategories = (newSet: Set<string>) => {
  setSelectedCategories(newSet);
  const params = new URLSearchParams(searchParams);
  if (newSet.size === categories.length) {
    params.delete('categories'); // Fjern param når alle er valgt
  } else {
    params.set('categories', Array.from(newSet).join(','));
  }
  router.replace(`?${params.toString()}`, { scroll: false });
};

// Filter POIs for visning
const filteredPois = pois.filter(poi =>
  selectedCategories.has(poi.category_id || '')
);
```

### Sidebar Layout

```
┌─────────────────────────────────────────────┐
│ SIDEBAR (venstre)          │ KART (høyre)   │
├─────────────────────────────────────────────┤
│ ┌─────────────────────┐    │                │
│ │ Kategori Filter     │    │   Mapbox       │
│ │ ☑ Restaurant (12)   │    │   med alle     │
│ │ ☑ Kafé (8)          │    │   markører     │
│ │ ☑ Transport (15)    │    │                │
│ │ [Select all] [None] │    │                │
│ └─────────────────────┘    │                │
│                             │                │
│ ┌─────────────────────┐    │                │
│ │ POI Form            │    │                │
│ │ (når POI valgt)     │    │                │
│ └─────────────────────┘    │                │
│                             │                │
│ ┌─────────────────────┐    │                │
│ │ POI Liste           │    │                │
│ │ (filtrert)          │    │                │
│ └─────────────────────┘    │                │
└─────────────────────────────────────────────┘
```

### Google POI Form-håndtering

```typescript
// Sjekk om POI er fra Google
const isGooglePoi = editingPoi?.google_place_id != null;

// I form: vis read-only felter for Google POIs
{isGooglePoi && (
  <div className="p-3 bg-gray-50 rounded-lg space-y-2">
    <p className="text-xs text-gray-500 font-medium">Google Places Data</p>
    <div className="text-sm">
      <span className="text-gray-500">Rating:</span> {editingPoi.google_rating}
      ({editingPoi.google_review_count} reviews)
    </div>
  </div>
)}
```

### Server Actions Update

Eksisterende `updatePOI` action må håndtere Google POIs - de har allerede alle felter i DB, så ingen endring nødvendig i action selv.

## Acceptance Criteria

### Funksjonelle krav
- [x] Alle POIs vises på kartet (native + Google)
- [x] Kategori filter-panel med toggle per kategori
- [x] "Select all" og "Deselect all" knapper
- [x] Klikk markør → velger POI og viser i form
- [x] Native POIs: full redigering
- [x] Google POIs: redigering av editorial felter, read-only for Google-data

### UI/UX krav
- [x] Kategori-toggles viser antall POIs per kategori
- [x] Filtrering påvirker både kart-markører og POI-liste
- [x] Google POIs får visuell indikator på markør OG i liste (f.eks. liten "G" badge)
- [x] Native POIs får annen indikator (f.eks. "N" badge eller ingen)
- [x] Form tilpasser seg POI-type automatisk
- [x] URL state sync: filter reflekteres i `?categories=cafe,restaurant`
- [x] Tom filtrering: vis melding "Ingen POIs matcher filter"

### Tekniske krav
- [x] Ingen Zustand - bruk lokal React state
- [x] Behold eksisterende Server Actions pattern
- [x] Typesikkerhet for Google-felter
- [x] URL params for filter state (shareable, bookmarkable)
- [x] Kategorier lastes fra Supabase (allerede implementert i page.tsx)

## Success Metrics

- Admin kan se totalt antall POIs på tvers av kategorier
- Admin kan enkelt filtrere ned til spesifikke kategorier
- Admin kan legge til editorial content på Google POIs
- Ingen regresjoner i native POI-administrasjon

## Dependencies & Risks

### Dependencies
- Supabase database må ha Google POIs (allerede tilfelle via story generator)
- Categories tabellen må være populert

### Risks
| Risk | Mitigation |
|------|------------|
| Mange POIs → treg lasting | Vurder paginering i fase 2 |
| Kart-ytelse med mange markører | Mapbox clustering (kan legges til senere) |

## Edge Cases

| Case | Handling |
|------|----------|
| Alle kategorier deselected | Vis melding "Ingen POIs matcher filter" |
| POI uten kategori | Behandles som om det ikke matcher noen kategori |
| URL med ugyldig kategori-ID | Ignorer ugyldige IDer, bruk kun gyldige |
| Tom database | Vis "Ingen POIs funnet" med link til "Opprett ny" |

## Visual Distinction

**Markør-indikatorer:**
- Google POI: Liten "G" badge i hjørnet av markør
- Native POI: Ingen ekstra badge (ren markør)

**Liste-indikatorer:**
- Google POI: `<span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">Google</span>`
- Native POI: `<span className="text-xs bg-green-100 text-green-700 px-1 rounded">Native</span>`

## References & Research

### Internal References
- Eksisterende admin: `app/admin/pois/page.tsx`, `app/admin/pois/poi-admin-client.tsx`
- Sidebar pattern: `components/layout/sidebar.tsx`
- POI types: `lib/types.ts:26-59`
- Supabase queries: `lib/supabase/queries.ts`

### Brainstorm
- `docs/brainstorms/2026-01-24-master-poi-map-brainstorm.md`

### Best Practices
- `docs/solutions/best-practices/nextjs-admin-interface-pattern-20260124.md`
