---
title: "POI Quality Pipeline for Bolig Projects"
category: feature-implementations
tags: [poi, quality, filtering, google-places, suburban, bolig, pipeline]
module: lib/generators/poi-quality.ts
symptom: "Google Places data i forstadsområder full av søppel — feilkategoriserte bedrifter, duplikater, hjemmekontor uten data, POI-er for langt unna"
root_cause: "Hotell-generator slipper unna med 800m radius + minRating 3.5 i bykjerner. Bolig-prosjekter opererer i 2000-2500m radius med dårligere Google-data."
date: 2026-02-27
---

# POI Quality Pipeline for Bolig Projects

## Problem

Google Places data i forstadsområder (Overvik, Brøset) er full av søppel som ødelegger demoene:

1. **Feilkategoriserte:** "Brilliance Cleaning" → Restaurant, "MT Byggteknikk" → Park
2. **Duplikater:** "H2 Frisør" + "H2 Grilstad Marina" = samme frisørkjede
3. **Hjemmekontor:** "Oasen Yoga" uten rating/reviews = privat adresse
4. **For langt unna:** "Crispy Fried Chicken" 22 min gange = irrelevant for bolig

Hotell-generatoren slipper unna fordi 800m radius + minRating 3.5 naturlig filtrerer dette.

## Solution: Hybrid Pipeline (Grovfiltre + LLM)

### Grovfiltre (TypeScript, import-tid)

Fire regelbaserte filtre i billigste-først rekkefølge:

```typescript
// lib/generators/poi-quality.ts
evaluateGooglePlaceQuality(place, categoryId, distanceMeters, rejections?)
```

1. **business_status** — Kun `CLOSED_PERMANENTLY` hard-rejectes. `CLOSED_TEMPORARILY` lar vi gjennom (trust-systemet håndterer).
2. **distance** — Per-kategori gangavstand (restaurant: 15 min, bus: 10 min, hospital: 45 min). Konstant: `WALK_METERS_PER_MINUTE = 80`.
3. **quality** — Krever rating ELLER reviews ≥ 1. Offentlige kategorier (park, bus, skole, etc.) er unntatt.
4. **name_mismatch** — Word-boundary blocklist. Krever 2+ ord i navnet (enkel-ord er tvetydig for LLM).

### LLM-filtre (Claude Code command-steg, post-import)

- **Steg 5a:** Kategori-validering — batch på 25, confidence 0.85, behold ved tvil
- **Steg 5b:** Duplikat-clustering — `findNearbyGroups()` pre-filter + Claude vurderer grupper

Stegene er uavhengige. Feil i ett blokkerer ikke det andre.

## Key Design Decisions

### Word-boundary matching for name-mismatch

Single-word names exempted: "Transport" (kjent restaurant i Oslo) ville blitt feilaktig avvist. Multi-word gir kontekst: "Transport Service AS" er tydelig ikke en restaurant.

```typescript
if (words.length === 1) return false; // For tvetydig for regelbasert filter
```

### Accumulator pattern for rejections

Optional parameter som ikke endrer return type. Samler rejections for logging uten å bryte `DiscoveredPOI[]` kontrakten.

### Distance caps gjelder ALLE kilder

Google, Entur, og Bysykkel filtreres alle med `isWithinCategoryDistance()`. Quality signals og name-mismatch kun for Google (transport har autoritativ data fra Entur).

### LLM som Claude Code command-steg, ikke SDK

Prosjektet har ingen `@anthropic-ai/sdk` avhengighet. All LLM-reasoning følger editorial hooks-mønsteret: Claude Code leser data, vurderer, og oppdaterer via Supabase REST.

## Files

| File | Purpose |
|------|---------|
| `lib/generators/poi-quality.ts` | Grovfiltre, findNearbyGroups, stats |
| `lib/generators/poi-quality.test.ts` | 50 tester med Overvik regression data |
| `lib/generators/poi-discovery.ts` | Integrert kvalitetsfiltre for alle kilder |
| `.claude/commands/generate-hotel.md` | Steg 5a/5b (LLM-filtre) |

## Gotchas

- `QUALITY_EXEMPT_CATEGORIES` — park, bus, skole etc. har ikke Google-rating. Ikke filtrer dem på quality signals.
- `findNearbyGroups()` — O(n²) er fine for ≤200 POI-er (~4ms). R-tree er overkill.
- Slett ALDRI fra `pois`-tabellen — kun fjern `project_pois`/`product_pois` koblinger. POI-er deles på tvers av prosjekter.
