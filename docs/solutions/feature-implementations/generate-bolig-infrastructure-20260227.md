---
title: "Generate Bolig Infrastructure — Categories, Themes, Radius, Types"
category: feature-implementations
tags: [generate-bolig, categories, themes, radius, nsr, barnehagefakta, overpass, residential]
module: lib/themes/default-themes.ts, supabase/migrations/042_bolig_categories.sql
symptom: "Bolig-prosjekter i suburbs trenger større radius, nye kategorier (skole/barnehage/idrett), og residential-perspektiv"
root_cause: "Hele systemet var optimalisert for byhoteller med 800m radius. Boligprosjekter opererer i 2000-2500m radius med andre behov."
date: 2026-02-27
---

# Generate Bolig Infrastructure

## Problem

Systemet var optimalisert for byhoteller: 800m radius, 14 Google Places-kategorier, gjeste-perspektiv. Boligprosjekter trenger:
- 2000-2500m radius (forstadsområder)
- Skoler, barnehager, idrettsanlegg (ikke i Google Places)
- Beboer-perspektiv i redaksjonelt innhold

## Solution

### 1. Database (Migration 042)

3 nye kategorier + source tracking:
- `skole`, `barnehage`, `idrett` med ikoner og farger
- `source` kolonne på `pois` med index (Google, NSR, Barnehagefakta, OSM)
- External ID-kolonner (`nsr_id`, `barnehagefakta_id`, `osm_id`) med partial unique indexes for dedup

### 2. Max Radius: 2000 → 3000

7 steder i 6 filer — Zod-validering + UI-sliders. Inkluderer `app/api/admin/projects/[id]/route.ts` som den originale planen manglet.

### 3. barnefamilier Theme

Ny theme i DEFAULT_THEMES: skole, barnehage, lekeplass, idrett. Cap 15 i explorer-caps. badeplass lagt til kultur-opplevelser.

### 4. Type Extensions

- `DiscoveredPOI.source`: lagt til `"nsr" | "barnehagefakta" | "osm"`
- `determineSource()`: sjekker nye ID-kolonner
- `POIImportData`: nye optional felter
- `DbPoi` (types.ts): nye kolonner i Row/Insert/Update

### 5. generate-bolig.md Command

16-stegs pipeline (gitignored). Nøkkelforskjeller fra generate-hotel:
- minRating=0, radius 2500m, 6 temaer (vs 5)
- Steps 5.5-5.7: NSR/Barnehagefakta/Overpass API-integrasjoner
- Step 5.8: Link eksisterende lekeplasser/badeplasser
- Tier 1 editorial hooks: metadata-basert for skoler/bhg/idrett (ingen WebSearch)

## Gotchas

- **7 radius-steder, ikke 6:** `app/api/admin/projects/[id]/route.ts` linje 16 har også `.max(2000)` — lett å glemme
- **generate-bolig.md er gitignored:** `.claude/*` i `.gitignore`. Endringer er lokale
- **badeplass og lekeplass:** Allerede eksisterende kategorier, bare tema-tilordningen er ny
- **Supabase types.ts er manuelt oppdatert:** Auto-generering fra Supabase dekker ikke nye kolonner. Må oppdatere Row/Insert/Update manuelt
- **onConflict for nye API-er:** Bruk `nsr_id`/`barnehagefakta_id`/`osm_id` for upsert, IKKE navn-basert dedup

## Files

| File | Purpose |
|------|---------|
| `supabase/migrations/042_bolig_categories.sql` | DB migration |
| `lib/themes/default-themes.ts` | barnefamilier theme |
| `lib/themes/explorer-caps.ts` | Cap for barnefamilier |
| `lib/generators/poi-discovery.ts` | Extended source type |
| `lib/generators/story-writer.ts` | Extended determineSource |
| `lib/supabase/types.ts` | DbPoi with new columns |
| `lib/supabase/mutations.ts` | POIImportData with new fields |
| `.claude/commands/generate-bolig.md` | 16-step command (local only) |
