---
status: complete
priority: p3
issue_id: "007"
tags: [code-review, simplicity, poi-importer]
dependencies: []
---

# Simplify POI Importer Implementation

## Problem Statement

POI Importer-planen er over-engineered med ~300 nye linjer kode for funksjonalitet som allerede eksisterer i CLI-scripts. Kan reduseres med ~60%.

## Findings

**Code Simplicity Reviewer Agent:**
> "Total potential LOC reduction: ~60% of POI Importer section. The existing `poi-discovery.ts` (446 lines) and import scripts already do 90% of the work."

**Unødvendige abstraksjoner identifisert:**

| Foreslått | Problem | Alternativ |
|-----------|---------|------------|
| `discoverAndPrepareForImport()` | 10-linje map inline | Inline transformasjon |
| `syncCategories()` | 3-linje upsert | Inline per import |
| `upsertPOIs()` med batching | Supabase håndterer dette | Enkel `.upsert()` |
| Admin GUI | CLI-scripts fungerer | Behold CLI |

**YAGNI-brudd:**
- Batch-prosessering med 500 - ingen evidens for store importer ennå
- Insert/update/skip counting - nice-to-have, ikke nødvendig
- Separat Admin GUI - dupliserer CLI-funksjonalitet

## Proposed Solutions

### Option A: Minimal API Route Only (Recommended)
**Effort:** Small | **Risk:** Low

Hele POI Importer kan være ~40 linjer:

```typescript
// app/api/import-pois/route.ts
export async function POST(req: Request) {
  const { source, center, radius, categories } = await req.json();

  const config = { center, radius, googleCategories: categories, includeTransport: true };
  const discovered = await discoverPOIs(config, process.env.GOOGLE_API_KEY!);

  // Transform inline (10 linjer, ikke egen funksjon)
  const pois = discovered.map(poi => ({
    id: poi.id,
    name: poi.name,
    lat: poi.coordinates.lat,
    lng: poi.coordinates.lng,
    category_id: poi.category.id,
    google_place_id: poi.googlePlaceId || null,
    // ...
  }));

  // Upsert kategorier inline (3 linjer)
  const usedCategories = [...new Map(discovered.map(p => [p.category.id, p.category])).values()];
  await supabase.from("categories").upsert(usedCategories, { onConflict: "id" });

  // Enkel upsert (1 linje)
  await supabase.from("pois").upsert(pois, { onConflict: "id" });

  return Response.json({ imported: pois.length });
}
```

**Pros:** Minimal kode, gjenbruker eksisterende logikk
**Cons:** Mindre granulær feilhåndtering

### Option B: Keep CLI-only
**Effort:** None | **Risk:** None

Behold eksisterende CLI-scripts (`npm run import:bysykkel`), ikke lag API.

**Pros:** Null ny kode, allerede testet
**Cons:** Må bruke terminal

## Recommended Action

<!-- Fylles ut under triage -->

## Technical Details

**Filer som IKKE trenger opprettes:**
- ~~`app/admin/import/page.tsx`~~ - 100+ LOC spart
- ~~`discoverAndPrepareForImport()`~~ - 30 LOC spart
- ~~`syncCategories()`~~ - 20 LOC spart
- ~~Batch-logikk i upsertPOIs~~  - 50 LOC spart

**Total estimert besparelse:** ~200 LOC

## Acceptance Criteria

- [x] POI Import fungerer via enkel API route ELLER CLI
- [x] Ingen unødvendige abstraksjoner
- [x] Gjenbruk av eksisterende `discoverPOIs()` funksjon
- [x] Kan legge til GUI senere ved behov

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-25 | Created | Identifisert under plan review |
| 2026-01-25 | Completed | Oppdatert plan med forenklet tilnærming, markert eksisterende implementasjoner |

## Resources

- Eksisterende script: `scripts/import-bysykkel.ts`
- YAGNI: https://martinfowler.com/bliki/Yagni.html
