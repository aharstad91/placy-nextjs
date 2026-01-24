---
date: 2026-01-24
topic: master-poi-map
---

# Master POI Map - Unified POI Admin

## What We're Building

Utvide eksisterende `/admin/pois` til å vise og redigere **alle POIs** (både native og Google-oppdagede), med kategori-filtrering i sidebar.

Hovedmål:
- Se helheten i tilgjengelige POIs på tvers av typer
- Redigere både native og Google POIs på samme måte
- Filtrere visning per kategori

## Why This Approach

**Vurderte alternativer:**
1. **Evolve admin/pois (valgt)** - Minst arbeid, gjenbruker eksisterende struktur
2. **Ny side fra scratch** - Mer arbeid, ingen klar fordel

Valgte A fordi:
- Eksisterende kode er godt strukturert
- Endringene er isolerte (fjern filter, legg til toggles)
- Ingen migrasjon nødvendig

## Key Decisions

### Datavisning
- **Vis alle POIs:** Fjern `.is("google_place_id", null)` filteret
- **Kategori-filter:** Alle kategorier ON ved load, toggle individuelt

### Layout (Sidebar + Kart)
- **Venstre sidebar:**
  1. Kategori filter-panel (toggles)
  2. Redigeringsskjema (når POI valgt)
  3. POI-liste (filtrert)
- **Høyre:** Fullskjerm kart med markører

### Redigering
- **Native POIs:** Full redigering (alle felter)
- **Google POIs:**
  - Read-only: rating, review count, Google Place ID
  - Redigerbar: editorial hook, local insight, story priority, description

### Markører
- Samme stil som nåværende admin/pois (farget etter kategori)
- Klikk → velg POI → vis i sidebar form

## Open Questions

- Skal det være søk/filter på POI-navn i tillegg til kategorier?
- Trengs paginering eller er lazy loading av markører nok?
- Skal "Create new" knappen alltid være synlig, eller bare når ingen POI er valgt?

## Technical Notes

Google POIs ligger allerede i Supabase med:
- `google_place_id` (identifiserer Google-opprinnelse)
- `google_rating`, `google_review_count` (fra Google Places API)

Transformasjon håndteres av eksisterende `transformPOI()` i `lib/supabase/queries.ts`.

## Next Steps

→ `/workflows:plan` for implementasjonsdetaljer
