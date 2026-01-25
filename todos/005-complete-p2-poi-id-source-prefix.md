---
status: complete
priority: p2
issue_id: "005"
tags: [code-review, data-integrity, poi-importer]
dependencies: []
---

# Add Source Prefix to POI IDs

## Problem Statement

POI ID-er genereres med `slugify(name)` uten kilde-prefix. To POI-er med samme navn fra forskjellige kilder (f.eks. restaurant "Bakgarden" fra Google og busstopp "Bakgarden" fra Entur) vil kollidere.

**Planen nevner** (linje 569): "Slug-basert ID med kilde-prefix ved konflikt" - men implementasjonen mangler dette.

## Findings

**Data Integrity Guardian Agent:**
> "No source prefix implementation exists. Cross-source collision scenario: Restaurant 'Bakgarden' from Google gets ID `bakgarden`, bus stop 'Bakgarden' from Entur also gets ID `bakgarden`. Second import will fail or silently overwrite."

**Architecture Strategist Agent:**
> "Architectural inconsistency: The existing bysykkel import uses `bysykkel-{station_id}` but `poi-discovery.ts` uses `slugify(name)`. This will create duplicate POIs or conflicts."

**Kodeanalyse:**

`poi-discovery.ts:137-143`:
```typescript
const id = slugify(place.name);  // Ingen prefix!
```

`scripts/import-bysykkel.ts:111`:
```typescript
id: `bysykkel-${station.station_id}`,  // HAR prefix
```

Inkonsistent mønster mellom poi-discovery og import-scripts.

## Proposed Solutions

### Option A: Use External ID with Source Prefix (Recommended)
**Effort:** Small | **Risk:** Low

```typescript
function generatePoiId(
  name: string,
  source: 'google' | 'entur' | 'bysykkel' | 'manual',
  externalId?: string
): string {
  // Bruk ekstern ID når tilgjengelig (stabil)
  if (externalId) {
    return `${source}-${externalId}`;
  }
  // Fallback til slug med prefix
  return `${source}-${slugify(name)}`;
}

// Bruk:
// Google: google-ChIJN1t_tDeuEmsRUsoyG83frY4
// Entur: entur-NSR:StopPlace:58366
// Bysykkel: bysykkel-123
// Manual: manual-cafe-lansen
```

**Pros:**
- Unik på tvers av kilder
- Stabil ID (endrer ikke ved navnebytte)
- Matchet eksisterende pattern i import-scripts

**Cons:** Eksisterende POI-er må migreres

### Option B: Namespace-basert ID
**Effort:** Medium | **Risk:** Low

```typescript
const id = `${source}:${slugify(name)}`;
// google:bakgarden
// entur:bakgarden
```

**Pros:** Lesbar, enkel å debugge
**Cons:** Kolon kan være problematisk i noen kontekster

## Recommended Action

<!-- Fylles ut under triage -->

## Technical Details

**Affected files:**
- `lib/generators/poi-discovery.ts:137-143` (Google)
- `lib/generators/poi-discovery.ts:275` (Entur)
- `lib/generators/poi-discovery.ts:349` (Bysykkel)
- `scripts/import-*.ts` (allerede har prefix)

**Migration needed:**
```sql
-- Eksempel migration for eksisterende POI-er
UPDATE pois SET id = 'google-' || id WHERE google_place_id IS NOT NULL AND id NOT LIKE 'google-%';
UPDATE pois SET id = 'entur-' || entur_stopplace_id WHERE entur_stopplace_id IS NOT NULL AND id NOT LIKE 'entur-%';
```

## Acceptance Criteria

- [ ] Alle nye POI-er får kilde-prefix i ID
- [ ] Google POI-er bruker `google-{place_id}`
- [ ] Entur POI-er bruker `entur-{stopplace_id}`
- [ ] Bysykkel POI-er bruker `bysykkel-{station_id}`
- [ ] Migration for eksisterende data (om nødvendig)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-25 | Created | Identifisert under plan review |

## Resources

- Plan: `docs/plans/2026-01-25-feat-storywriter-poi-importer-plan.md` (linje 569)
