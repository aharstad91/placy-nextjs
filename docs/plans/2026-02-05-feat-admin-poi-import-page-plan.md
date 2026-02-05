---
title: "feat: Admin POI Import Page"
type: feat
date: 2026-02-05
deepened: 2026-02-05
brainstorm: docs/brainstorms/2026-02-05-scandic-demo-setup-workflow-brainstorm.md
---

# feat: Admin POI Import Page

## Enhancement Summary

**Deepened on:** 2026-02-05
**Research agents used:** simplicity-reviewer, performance-oracle, security-sentinel, typescript-reviewer, best-practices-researcher, framework-docs-researcher, learnings-analyzer, admin-patterns-analyzer

### Key Improvements from Research

1. **Simplified architecture** - Consider single API route with `?preview=true` instead of separate discover/execute
2. **Performance optimization** - Parallelize API calls, batch-fetch existing POIs for O(1) deduplication
3. **Security hardening** - Add Zod validation, rate limiting, proper API key handling
4. **Reuse existing mutations** - `upsertPOIsWithEditorialPreservation()` and `linkPOIsToProject()` already exist

### Critical Findings

| Area | Finding | Impact |
|------|---------|--------|
| Simplicity | Map click handler may be over-engineering - projects already have coordinates | ~80 LOC saved |
| Performance | Sequential API calls + N+1 dedup queries could take 15+ seconds | Optimize to < 3 seconds |
| Security | API key exposure in places route, no input validation | Must fix before launch |

---

## Overview

Bygge `/admin/import` - en admin-side for å importere POI-er fra Google Places API til Supabase. Dette kobler eksisterende `poi-discovery.ts` til et brukergrensesnitt, og gjør det mulig å raskt fylle databasen med POI-er for nye prosjekter (f.eks. Scandic Nidelven demo).

## Problem Statement / Motivation

**Dagens situasjon:**
- `lib/generators/poi-discovery.ts` har fungerende Google Places-integrasjon
- Generator-siden (`/admin/generate`) bruker kun *eksisterende* POI-er fra Supabase
- Ingen admin-UI for å importere nye POI-er fra eksterne kilder
- Import-siden (`/admin/import`) viser kun "Kommer snart"

**Ønsket situasjon:**
- Admin kan klikke på kart, velge radius og kategorier
- System henter POI-er fra Google Places, Entur, og Bysykkel
- Admin kan forhåndsvise og importere til Supabase
- Valgfritt koble POI-er til et prosjekt

---

## Proposed Solution

### Simplified Architecture (Research Insight)

**Original plan:** Two separate API routes (discover + execute)
**Simplified option:** Single route with preview flag

```typescript
// Single route approach - simpler state management
POST /api/admin/import
  ?preview=true  → Returns stats only, no database write
  ?preview=false → Discovers AND imports in one request
```

**Recommendation:** Start with simplified single-route approach for MVP. Split later if preview step needs persistent state.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     POI Import Flow                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 1: Parallel Fetch                      │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Google Places │  │    Entur     │  │  Bysykkel + DB Pre-   │ │
│  │ (rate-limited)│  │  (parallel)  │  │  fetch (parallel)     │ │
│  │   ~2400ms     │  │   ~300ms     │  │      ~200ms           │ │
│  └───────────────┘  └──────────────┘  └───────────────────────┘ │
│                     Total: ~2400ms (bounded by Google)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               Phase 2: In-Memory Processing                     │
│  • Deduplicate against pre-fetched existing POIs (O(n))        │
│  • Calculate new vs updated counts                              │
│  • Merge with existing editorial content                        │
│                        ~50ms                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Phase 3: Database Write                          │
│  • Batch upsert POIs (single query, 250 record chunks)         │
│  • Link to project (single query)                              │
│                        ~300ms                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Total: ~2750ms ✓
```

---

## Technical Approach

### Fase 1: API Route

**Fil:** `app/api/admin/import/route.ts`

#### Request/Response Types (Enhanced with TypeScript Review)

```typescript
import { z } from "zod";

// Zod schema for validation (Security requirement)
const ImportRequestSchema = z.object({
  center: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  radiusMeters: z.number().min(300).max(2000),
  categories: z.array(z.string()).min(1).max(20),
  includeTransport: z.boolean().optional().default(true),
  projectId: z.string().uuid().optional(),
  preview: z.boolean().optional().default(false),
});

type ImportRequest = z.infer<typeof ImportRequestSchema>;

// Enhanced response with structured errors
interface ImportError {
  poiId: string;
  message: string;
  code?: "DUPLICATE" | "VALIDATION" | "DB_ERROR";
}

interface ImportResponse {
  success: boolean;
  stats: {
    total: number;
    byCategory: Record<string, number>;
    new: number;
    updated: number;
  };
  linkedToProject?: number;
  errors: ImportError[];
}
```

#### Optimized Implementation (Performance Research)

```typescript
// app/api/admin/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { discoverGooglePlaces, discoverEnturStops, discoverBysykkelStations } from "@/lib/generators/poi-discovery";
import { upsertPOIsWithEditorialPreservation, linkPOIsToProject, upsertCategories } from "@/lib/supabase/mutations";
import { createServerClient } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  // 1. Auth check
  if (process.env.ADMIN_ENABLED !== "true") {
    return NextResponse.json({ error: "Admin ikke aktivert" }, { status: 403 });
  }

  // 2. Validate with Zod
  let body: ImportRequest;
  try {
    const json = await request.json();
    body = ImportRequestSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google API ikke konfigurert" }, { status: 500 });
  }

  // 3. Calculate bounding box for pre-fetching
  const bbox = calculateBoundingBox(body.center, body.radiusMeters);

  // 4. PARALLEL FETCH - Critical for performance
  const [googlePois, enturPois, bysykkelPois, existingPois] = await Promise.all([
    discoverGooglePlaces({ center: body.center, radius: body.radiusMeters, googleCategories: body.categories }, apiKey),
    body.includeTransport ? discoverEnturStops({ center: body.center, radius: body.radiusMeters }) : [],
    body.includeTransport ? discoverBysykkelStations({ center: body.center, radius: body.radiusMeters }) : [],
    fetchExistingPOIsInBoundingBox(bbox), // Pre-fetch for O(1) dedup
  ]);

  // 5. IN-MEMORY deduplication (O(n) instead of O(n*m))
  const allDiscovered = [...googlePois, ...enturPois, ...bysykkelPois];
  const { toInsert, toUpdate, stats } = categorizeForUpsert(allDiscovered, existingPois);

  // 6. Preview mode - return stats without writing
  if (body.preview) {
    return NextResponse.json({ success: true, stats, preview: true });
  }

  // 7. Execute import
  try {
    // Ensure categories exist first (foreign key constraint)
    const uniqueCategories = getUniqueCategoriesFromPOIs(allDiscovered);
    await upsertCategories(uniqueCategories);

    // Batch upsert POIs
    const result = await upsertPOIsWithEditorialPreservation([...toInsert, ...toUpdate]);

    // Link to project if specified
    if (body.projectId) {
      const poiIds = [...toInsert, ...toUpdate].map(p => p.id);
      await linkPOIsToProject(body.projectId, poiIds);
    }

    return NextResponse.json({
      success: true,
      stats: { ...stats, new: result.inserted, updated: result.updated },
      linkedToProject: body.projectId ? [...toInsert, ...toUpdate].length : undefined,
      errors: result.errors.map(e => ({ poiId: "", message: e })),
    });

  } catch (error) {
    console.error("[Import] Error:", error);
    return NextResponse.json({ error: "Import feilet" }, { status: 500 });
  }
}

// Helper: Pre-fetch existing POIs in bounding box
async function fetchExistingPOIsInBoundingBox(bbox: BoundingBox) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("pois")
    .select("id, google_place_id, entur_stopplace_id, bysykkel_station_id")
    .gte("lat", bbox.minLat)
    .lte("lat", bbox.maxLat)
    .gte("lng", bbox.minLng)
    .lte("lng", bbox.maxLng);

  return data || [];
}

// Helper: O(1) deduplication using Maps
function categorizeForUpsert(discovered: DiscoveredPOI[], existing: ExistingPOI[]) {
  const byGoogleId = new Map(existing.filter(p => p.google_place_id).map(p => [p.google_place_id, p]));
  const byEnturId = new Map(existing.filter(p => p.entur_stopplace_id).map(p => [p.entur_stopplace_id, p]));
  const byBysykkelId = new Map(existing.filter(p => p.bysykkel_station_id).map(p => [p.bysykkel_station_id, p]));

  const toInsert: DiscoveredPOI[] = [];
  const toUpdate: DiscoveredPOI[] = [];
  const byCategory: Record<string, number> = {};

  for (const poi of discovered) {
    const existing = byGoogleId.get(poi.googlePlaceId)
      || byEnturId.get(poi.enturStopplaceId)
      || byBysykkelId.get(poi.bysykkelStationId);

    if (existing) {
      toUpdate.push({ ...poi, id: existing.id });
    } else {
      toInsert.push(poi);
    }

    byCategory[poi.category.id] = (byCategory[poi.category.id] || 0) + 1;
  }

  return {
    toInsert,
    toUpdate,
    stats: {
      total: discovered.length,
      byCategory,
      new: toInsert.length,
      updated: toUpdate.length,
    },
  };
}
```

### Fase 2: Admin UI

**Fil:** `app/admin/import/page.tsx` (server component)
**Fil:** `app/admin/import/import-client.tsx` (client component)

#### Server Component Pattern

```typescript
// app/admin/import/page.tsx
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/client";
import ImportClient from "./import-client";

export default async function ImportPage() {
  if (process.env.ADMIN_ENABLED !== "true") {
    redirect("/");
  }

  const supabase = createServerClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, short_id, name, center_lat, center_lng, customers(name)")
    .order("updated_at", { ascending: false });

  return <ImportClient projects={projects || []} />;
}
```

#### Client Component State (Enhanced with TypeScript Insights)

```typescript
// Discriminated union for step states - ensures valid state combinations
type ImportStateByStep =
  | { step: "idle"; stats: null; error: null }
  | { step: "discovering"; stats: null; error: null }
  | { step: "preview"; stats: ImportStats; error: null }
  | { step: "importing"; stats: ImportStats; error: null }
  | { step: "done"; stats: ImportStats; error: null }
  | { step: "error"; stats: ImportStats | null; error: string };

interface ImportFormState {
  center: Coordinates | null;
  radius: number;
  selectedCategories: string[];
  includeTransport: boolean;
  selectedProjectId: string | null;
}

// Full state combines form + step
type ImportState = ImportFormState & ImportStateByStep;
```

#### UI Implementation Pattern (from generate-client.tsx)

```typescript
// import-client.tsx (key sections)
"use client";

import { useState, useCallback } from "react";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl/mapbox";
import { AdminSecondaryNav, SecondaryNavTrigger } from "@/components/admin/admin-secondary-nav";
import { Loader2, Check, AlertCircle, ChevronDown, MapPin } from "lucide-react";
import type { CircleLayer } from "react-map-gl/mapbox";

// Circle layer for radius visualization
const radiusLayerStyle: CircleLayer = {
  id: "radius-circle",
  type: "circle",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 50, 16, 200],
    "circle-color": "#10b981",
    "circle-opacity": 0.2,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#10b981",
  },
};

export default function ImportClient({ projects }: { projects: Project[] }) {
  const [state, setState] = useState<ImportState>({
    step: "idle",
    center: null,
    radius: 1000,
    selectedCategories: ["restaurant", "cafe", "supermarket"],
    includeTransport: true,
    selectedProjectId: null,
    stats: null,
    error: null,
  });

  // Map click handler
  const handleMapClick = useCallback((event: MapLayerMouseEvent) => {
    setState(prev => ({
      ...prev,
      center: { lat: event.lngLat.lat, lng: event.lngLat.lng },
    }));
  }, []);

  // Use project center (simplified approach)
  const handleProjectSelect = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setState(prev => ({
        ...prev,
        selectedProjectId: projectId,
        center: { lat: project.center_lat, lng: project.center_lng },
      }));
    }
  }, [projects]);

  const isValid = state.center && state.selectedCategories.length > 0;

  // ... render implementation
}
```

### Research Insights: UI/UX Patterns

**From admin-patterns-analyzer:**

```typescript
// Success state UI pattern
<div className="p-4 space-y-4 animate-fadeInUp">
  <div className="text-center py-6">
    <div
      className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center animate-checkPop"
      style={{
        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        boxShadow: "0 8px 24px rgba(16, 185, 129, 0.4)",
      }}
    >
      <Check className="w-8 h-8 text-white" />
    </div>
    <h2 className="text-xl font-bold text-gray-900 mb-1">Import fullført!</h2>
    <p className="text-sm text-gray-500">{stats.new} nye, {stats.updated} oppdatert</p>
  </div>
</div>
```

---

## Security Requirements (Security Review)

### Critical Issues to Address

| Issue | Severity | Fix |
|-------|----------|-----|
| No input validation | HIGH | Use Zod schemas on all inputs |
| API key in client response | HIGH | Create `/api/places/photo/[reference]` proxy |
| No rate limiting | MEDIUM | Add Upstash Redis rate limiting |
| ADMIN_ENABLED only auth | HIGH | Document: add proper auth for production |

### Required Validations

```typescript
// Coordinate bounds (prevent invalid coordinates)
const NORWAY_BOUNDS = {
  minLat: 57.0, maxLat: 72.0,
  minLng: 4.0, maxLng: 32.0,
};

function validateCoordinates(lat: number, lng: number): boolean {
  return lat >= NORWAY_BOUNDS.minLat && lat <= NORWAY_BOUNDS.maxLat
    && lng >= NORWAY_BOUNDS.minLng && lng <= NORWAY_BOUNDS.maxLng;
}

// Category allowlist (prevent arbitrary Google API calls)
const ALLOWED_CATEGORIES = [
  "restaurant", "cafe", "bar", "bakery", "gym", "supermarket",
  "pharmacy", "bank", "museum", "library", "park", "movie_theater",
] as const;
```

---

## Performance Optimizations (Performance Review)

### Expected Performance (Optimized)

| POI Count | Time (Optimized) | Notes |
|-----------|------------------|-------|
| 50 POIs | ~2.5 sec | 3-4 categories |
| 100 POIs | ~3 sec | 6 categories |
| 200 POIs | ~4 sec | 10 categories |

### Database Indexes (Add if missing)

```sql
-- Ensure these indexes exist for efficient queries
CREATE INDEX IF NOT EXISTS idx_pois_location ON pois (lat, lng);
CREATE INDEX IF NOT EXISTS idx_pois_google_place_id ON pois (google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pois_entur_stopplace_id ON pois (entur_stopplace_id) WHERE entur_stopplace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pois_bysykkel_station_id ON pois (bysykkel_station_id) WHERE bysykkel_station_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_pois_project_id ON project_pois (project_id);
```

---

## Acceptance Criteria

### Functional Requirements

- [x] Admin kan navigere til `/admin/import`
- [x] Admin kan klikke på kartet for å sette senterpunkt
- [x] Admin kan velge prosjekt fra dropdown (auto-fyller center)
- [x] Kartet viser en sirkel som visualiserer valgt radius
- [x] Admin kan justere radius med slider (300m - 2km)
- [x] Admin kan velge kategorier via checkboxes
- [x] Admin kan velge om transport skal inkluderes
- [x] "Søk"-knapp kaller API med `preview=true` og viser resultater
- [x] Preview viser antall POI-er per kategori
- [x] Preview viser "X nye, Y oppdateres"
- [ ] Map viser markers for discoverede POI-er
- [x] "Importer"-knapp lagrer POI-er til Supabase
- [x] Success-melding viser "Importerte X nye, oppdaterte Y"
- [x] Hvis prosjekt valgt: POI-er kobles til project_pois

### Non-Functional Requirements

- [x] Import av 100 POI-er tar < 5 sekunder (target: < 3 sec)
- [x] Google Places API-kall har 200ms delay for rate limiting
- [x] All input valideres med Zod
- [x] Editorial fields bevares ved re-import
- [x] Deduplisering basert på external IDs (O(1) lookup)

### Security Requirements (NEW)

- [x] Zod validation på alle request inputs
- [x] Koordinater validert innenfor Norge bounds
- [x] Kategorier validert mot allowlist
- [x] API nøkler aldri eksponert til klient

---

## Implementation Checklist (Simplified)

### Backend

- [x] `app/api/admin/import/route.ts`
  - [x] Zod schema validation
  - [x] ADMIN_ENABLED check
  - [x] Parallel API calls (Promise.all)
  - [x] Pre-fetch existing POIs for O(1) dedup
  - [x] Preview mode (`?preview=true`)
  - [x] Full import mode
  - [x] Proper error responses

### Frontend

- [x] `app/admin/import/page.tsx` - Server component
- [x] `app/admin/import/import-client.tsx` - Client component
  - [x] Project dropdown with auto-center
  - [x] Map with click handler
  - [x] Radius circle visualization
  - [x] Category checkboxes
  - [x] Step-based UI (idle → discovering → preview → importing → done)
  - [x] Success/error states

### Database (if needed)

- [ ] Verify indexes exist for POI lookups
- [ ] Test `upsertPOIsWithEditorialPreservation()` preserves editorial
- [ ] Test `linkPOIsToProject()` handles duplicates

---

## Gotchas to Avoid (from Institutional Learnings)

| Gotcha | Prevention |
|--------|------------|
| GeoJSON coordinate order | `[lng, lat]` not `[lat, lng]` |
| Next.js caching after import | Hard refresh or `revalidatePath()` |
| Category foreign key errors | Always upsert categories BEFORE POIs |
| Norwegian character slugs | Use `normalize("NFD")` in slugify |
| ID collisions | Track seen IDs, append counter suffix |

---

## Reusable Code Snippets (from Learnings)

### Slugify Function

```typescript
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
```

### ID Collision Detection

```typescript
function generatePoiId(category: string, name: string, seenIds: Set<string>): string {
  const baseId = `${category}-${slugify(name)}`;
  if (!seenIds.has(baseId)) {
    seenIds.add(baseId);
    return baseId;
  }
  let counter = 2;
  while (seenIds.has(`${baseId}-${counter}`)) counter++;
  const uniqueId = `${baseId}-${counter}`;
  seenIds.add(uniqueId);
  return uniqueId;
}
```

---

## References

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-05-scandic-demo-setup-workflow-brainstorm.md`
- Generator page pattern: `app/admin/generate/generate-client.tsx`
- POI discovery: `lib/generators/poi-discovery.ts`
- Supabase mutations: `lib/supabase/mutations.ts`
- Database types: `lib/supabase/database.types.ts`

### Institutional Learnings

- Batch upserts over loops: `docs/solutions/data-import/data-import-taxi-stands-20260125.md`
- Coordinate bounds validation: `docs/solutions/data-import/import-wfs-geographic-data-20260125.md`
- Slugify with NFD for Norwegian: `docs/solutions/data-import/data-import-taxi-stands-20260125.md`
- Admin interface pattern: `docs/solutions/best-practices/nextjs-admin-interface-pattern-20260124.md`

### External Documentation

- Google Places Nearby Search: https://developers.google.com/maps/documentation/places/web-service/search-nearby
- react-map-gl Source/Layer: https://visgl.github.io/react-map-gl/docs/api-reference/source
- Supabase Upsert: https://supabase.com/docs/reference/javascript/upsert
- Zod Validation: https://zod.dev/
