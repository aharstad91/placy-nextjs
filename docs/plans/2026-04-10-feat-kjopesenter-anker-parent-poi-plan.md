---
title: "feat: Kjøpesenter-anker med parent-child POI-hierarki"
type: feat
date: 2026-04-10
---

# feat: Kjøpesenter-anker med parent-child POI-hierarki

## Overview

Kjøpesenteret (f.eks. Valentinlyst Senter) blir en samlet enhet i rapporten istedenfor spredte enkeltbutikker. Senteret er en POI med markør på kart og beriket rad i hero insight-kortet. Butikker inne i senteret knyttes via `parentPoiId` og vises innfoldet — ikke som separate markører/rader.

To flater, samme data:
1. **Hero insight-kort**: Senter-raden berikes med oppsummering + nettside-lenke + Google AI-lenke
2. **Kart + drawer**: Senteret er en markør. Klikk åpner drawer med senter-info og barn-POI-er

## Problem Statement

Hero-kortet viser 5 enkeltsteder (Coop Mega, Boots, Vinmonopolet, frisør, senter) uten å kommunisere omfanget av hva senteret tilbyr. Brukeren ser butikkene, men forstår ikke at de alle er samlet under ett tak. Senteret har 20+ butikker — det er verdien, ikke de 5 vi viser.

## Proposed Solution

### Datamodell

Legg til `parent_poi_id` på `pois`-tabellen. Barn-POI-er (Coop Mega, Boots, etc.) får `parent_poi_id = valentinlyst-senter-poi-id`. Legg til `anchor_summary` for kort oppsummering.

**Reuse eksisterende felt:**
- `googleWebsite` → senterets nettside (allerede på POI)
- `"shopping"` kategori → allerede definert (fra Google `shopping_mall`)
- Ingen ny kategori nødvendig

### Filtrering

POI-er med `parentPoiId` filtreres fra:
- Kart-markører (vises bare i senter-drawer)
- Hero insight-kortrader (vises innfoldet under senter-raden)
- Narrativtekst-matching (unngå dobbel-visning)

Senter-POI-en (parent) beholdes som vanlig markør/rad.

### Hero Insight-kort (HverdagslivInsight)

Senter-raden (Tier 1 anchor, allerede implementert) berikes med:
- `anchorSummary` under senter-navnet (f.eks. "Dagligvare, apotek, frisør, post, vinmonopol")
- Nettside-lenke (ExternalLink-ikon) → valentinlyst.no
- Google AI-lenke (Sparkles-ikon) → google.com/search?udm=50&q=...
- Barn-POI-er vises som kompakt liste under senter-raden (ikon + navn + kategori)

### Kart-drawer (ReportMapDrawer)

Klikk på senter-markør åpner drawer med:
- Senter-navn, ikon, gangavstand
- `anchorSummary`
- Barn-POI-liste gruppert per kategori (ikon + navn)
- Nettside-knapp + Google AI-knapp
- Eksisterende felter (editorial hook, rating, etc.) om tilgjengelig

## Technical Approach

### Steg 1: Database-migrasjon → TC-01, TC-02

**Fil:** `supabase/migrations/056_parent_poi_id.sql`

```sql
BEGIN;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS parent_poi_id TEXT
  CONSTRAINT pois_parent_poi_id_fkey REFERENCES pois(id) ON DELETE SET NULL;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS anchor_summary TEXT;
ALTER TABLE pois ADD CONSTRAINT pois_no_self_parent CHECK (parent_poi_id IS NULL OR parent_poi_id != id);
CREATE INDEX IF NOT EXISTS idx_pois_parent_poi_id ON pois(parent_poi_id);
COMMIT;
```

**Audit-mitigasjoner innarbeidet:**
- `ON DELETE SET NULL` — sletting av parent gjør barn til standalone POI-er
- `IF NOT EXISTS` — trygg re-kjøring
- `BEGIN/COMMIT` — atomisk migrasjon
- `CHECK` constraint — forhindrer self-referanse
- Named constraint for PostgREST-kompatibilitet

Kjør via psql (ikke `supabase db push`). Verifiser med curl.

### Steg 2: TypeScript-typer → TC-03

**Fil:** `lib/types.ts`

Legg til på POI-interface:
- `parentPoiId?: string`
- `anchorSummary?: string`
- `childPOIs?: POI[]` (populated runtime, ikke i DB)

### Steg 3: Data-transformasjon → TC-04, TC-05

**Fil:** `lib/supabase/queries.ts` — `transformPOI()` + select-kolonner

Følg 6-stegs upsert-sjekklisten fra POI Tier System:
1. `.select()` kolonner
2. Map constructor (existingMap)
3. Merge-logikk
4. `DbPoi` types
5. `POI` interface (steg 2)
6. `transformPOI()` mapping
7. `getPOIsWithinRadius()` manuell DbPoi

### Steg 4: POI-filtrering i report-data → TC-06, TC-07

**Fil:** `components/variants/report/report-data.ts` — `transformToReportData()`

**Audit-mitigasjon: cross-theme guard + heroMetrics + single filter point.**

1. Bygg child-lookup **før** theme-loopen:
```typescript
const childByParent = new Map<string, POI[]>();
for (const poi of allPOIs) {
  if (poi.parentPoiId) {
    const arr = childByParent.get(poi.parentPoiId);
    if (arr) arr.push(poi); else childByParent.set(poi.parentPoiId, [poi]);
  }
}
```

2. Filtrer `heroMetrics.totalPOIs` — ekskluder barn fra tellingen (før linje 346).

3. **Per tema**: Filtrer barn KUN når parent er i samme tema:
```typescript
const parentIdsInTheme = new Set(themePOIs.filter(p => !p.parentPoiId).map(p => p.id));
const filtered = themePOIs.filter(p => !p.parentPoiId || !parentIdsInTheme.has(p.parentPoiId));
```

4. Populer `childPOIs` på parent-POI fra lookup-mappen.

**VIKTIG:** All filtrering skjer HER — ikke i ReportThemeSection eller ReportThemeMap. Én kilde, alle downstream-konsumenter arver.

### Steg 5: Hero insight-kort berikelse → TC-08, TC-09, TC-10

**Fil:** `components/variants/report/ReportHeroInsight.tsx` — `HverdagslivInsight`

Berik anchor-raden (Tier 1):
- Vis `anchorSummary` under navn
- Vis `googleWebsite` med ExternalLink-ikon (allerede implementert, behold)
- Legg til Google AI-lenke med Sparkles-ikon
- Vis barn-POI-er som kompakt liste (ikon + navn + kategori-label)

### ~~Steg 6: Kart-markør filtrering~~ → FJERNET (audit)

**Audit-mitigasjon:** Filtrering skjer i Steg 4 (report-data.ts). `theme.allPOIs` ekskluderer allerede barn-POI-er. Ingen endring i ReportThemeSection eller ReportThemeMap nødvendig. Senter-markøren vises som vanlig Tier 1 markør via eksisterende rendering.

### Steg 7: Drawer-berikelse → TC-12, TC-13

**Fil:** `components/variants/report/ReportMapDrawer.tsx`

Når valgt POI har `childPOIs`:
- Vis seksjon "Butikker i senteret" med barn-POI-er (ikon + navn + kategori)
- Vis `anchorSummary`
- Legg til nettside-knapp + Google AI-knapp
- Behold alle eksisterende felter (rating, editorial, transport, etc.)

### Steg 8: Wesselsløkka-data → TC-14

**Fil:** `supabase/migrations/057_wesselslokka_parent_pois.sql`

Sett `parent_poi_id` på barn-POI-er (Coop Mega, Boots, Vinmonopolet, Studio Sax) til Valentinlyst Senter POI-ID. Sett `anchor_summary` på senteret.

## Acceptance Criteria

- [ ] `parent_poi_id` og `anchor_summary` kolonner på pois-tabellen
- [ ] POI TypeScript-type har `parentPoiId`, `anchorSummary`, `childPOIs`
- [ ] Barn-POI-er vises IKKE som egne markører på kart
- [ ] Barn-POI-er vises IKKE som egne rader i hero-kort
- [ ] Senter-raden i hero-kort viser oppsummering + lenker + barn-liste
- [ ] Klikk på senter-markør åpner drawer med barn-POI-er + lenker
- [ ] Valentinlyst Senter har korrekt data (parent-child, summary)
- [ ] Eksisterende rapport fungerer uten regressjon for temaer uten senter-POI

## Dependencies & Risks

- **Valentinlyst Senter må være en POI** i databasen med `"shopping"` kategori — allerede tilfelle
- **POI-IDer** for Coop Mega, Boots etc. må identifiseres i prod-data
- **Ingen breaking change** — `parentPoiId = null` er default, alle eksisterende POI-er uberørt
- **isSafeUrl guard** kreves for website-lenker (allerede mønster)

## References

- Brainstorm: `docs/brainstorms/2026-04-10-kjopesenter-anker-brainstorm.md`
- Hverdagsliv 3-tier redesign: `docs/solutions/architecture-patterns/hverdagsliv-tre-tier-redesign-20260410.md`
- POI tier system upsert checklist: `docs/solutions/feature-implementations/poi-tier-system-fase2-learnings-20260210.md`
- Area hierarki parent-child pattern: `docs/solutions/architecture-patterns/area-hierarki-strok-eiendom-20260409.md`
- HverdagslivInsight: `components/variants/report/ReportHeroInsight.tsx:316-455`
- ReportMapDrawer: `components/variants/report/ReportMapDrawer.tsx`
- report-data transform: `components/variants/report/report-data.ts:345-492`
- POI types: `lib/types.ts:27-97`

## Test Cases

### TC-01 | Functional | P1
Requirement: parent_poi_id column exists
Given: Migration 056 has been run
When: Query pois table for parent_poi_id column
Then: Column exists, accepts TEXT, allows NULL

### TC-02 | Functional | P1
Requirement: anchor_summary column exists
Given: Migration 056 has been run
When: Query pois table for anchor_summary column
Then: Column exists, accepts TEXT, allows NULL

### TC-03 | Functional | P1
Requirement: POI TypeScript type updated
Given: lib/types.ts updated
When: TypeScript compilation runs
Then: No type errors, parentPoiId/anchorSummary/childPOIs available

### TC-04 | Functional | P1
Requirement: transformPOI maps new fields
Given: POI row with parent_poi_id and anchor_summary in database
When: transformPOI processes the row
Then: POI object has parentPoiId and anchorSummary populated

### TC-05 | Edge Case | P2
Requirement: transformPOI handles null parent_poi_id
Given: POI row with parent_poi_id = null
When: transformPOI processes the row
Then: POI object has parentPoiId = undefined

### TC-06 | Functional | P1
Requirement: Child POIs filtered from theme.allPOIs
Given: Theme has POIs where some have parentPoiId set
When: transformToReportData runs
Then: allPOIs array excludes child POIs, parent POI has childPOIs populated

### TC-07 | Edge Case | P2
Requirement: Theme without parent-child POIs unchanged
Given: Theme with no POIs having parentPoiId
When: transformToReportData runs
Then: allPOIs array unchanged, no childPOIs on any POI

### TC-08 | Functional | P1
Requirement: Hero insight anchor shows summary
Given: Senter-POI with anchorSummary set
When: HverdagslivInsight renders
Then: Summary text visible under senter name

### TC-09 | Functional | P1
Requirement: Hero insight shows child POIs
Given: Senter-POI with childPOIs populated
When: HverdagslivInsight renders
Then: Child POIs shown as compact list under senter row

### TC-10 | Functional | P2
Requirement: Hero insight shows Google AI link
Given: Senter-POI rendered in hero card
When: User sees the card
Then: Sparkles icon + Google AI link visible next to website link

### TC-11 | Functional | P1
Requirement: Child POIs not shown as map markers
Given: Theme with parent-child POIs
When: Map renders
Then: Only parent POI has marker, children do not

### TC-12 | Functional | P1
Requirement: Drawer shows children for senter POI
Given: User clicks senter marker on map
When: Drawer opens
Then: "Butikker i senteret" section shows child POIs

### TC-13 | Functional | P2
Requirement: Drawer shows Google AI + website buttons
Given: Senter-POI selected in drawer
When: Drawer renders
Then: Both nettside-button and Google AI-button visible

### TC-14 | Functional | P1
Requirement: Wesselsløkka data correct
Given: Migration 057 run
When: Query Valentinlyst Senter and its children
Then: Coop Mega, Boots, Vinmonopolet, Studio Sax have parent_poi_id pointing to senter
