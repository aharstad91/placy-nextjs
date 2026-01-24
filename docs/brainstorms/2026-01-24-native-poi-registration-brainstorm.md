---
date: 2026-01-24
topic: native-poi-registration
---

# Native POI Registration

## What We're Building

Et admin-grensesnitt i Placy for å registrere native POIs (steder som ikke kommer fra Google Places). Grensesnittet skal gjøre det enkelt å legge inn 20+ steder per prosjekt, med fleksibilitet til å starte enkelt og berike med mer info senere.

Native POIs skal fungere identisk med Google POIs i UI - samme kort, samme kart-markører, samme visning. Forskjellen er kun datakilden.

## Why This Approach

**Vurderte alternativer:**

| Tilnærming | Fordeler | Ulemper |
|------------|----------|---------|
| A: Admin i Placy | Gjenbruker kart, samme stack, ser POIs i kontekst | Må beskytte ruten |
| B: Supabase Studio | Null kode, fungerer nå | Ingen kart, manuell koordinat-håndtering |
| C: Hybrid script + admin | Effektiv bulk, visuell finjustering | To verktøy, mer kompleksitet |

**Valgt: A - Admin-rute i Placy**

Grunner:
- Kartet er allerede der - klikk for koordinater
- Visuell feedback underveis ved 20+ POIs
- Adressesøk via Mapbox Geocoding (allerede integrert)
- "Enkel først, berik senere" passer godt med form-tilnærming

## Key Decisions

- **Plassering:** `/admin/pois` rute i Next.js-appen
- **Koordinat-input:** Klikk på kart + adressesøk (Mapbox Geocoding)
- **Minimale felt først:** Navn, koordinater, kategori
- **Berik senere:** editorialHook, localInsight, description, featuredImage
- **Bilder:** Utsettes til senere fase
- **Beskyttelse:** Enkel env-basert sjekk (ADMIN_ENABLED=true) eller basic auth
- **Brukergruppe:** Kun utviklere/interne

## Data Model

Bruker eksisterende POI-interface fra `lib/types.ts`. Native POIs identifiseres ved fravær av `googlePlaceId`.

**Minimale felt for registrering:**
- `name` (required)
- `coordinates.lat`, `coordinates.lng` (required)
- `category` (required, dropdown)
- `address` (optional, kan geokodes)

**Valgfrie felt for berikelse:**
- `description`
- `editorialHook`
- `localInsight`
- `storyPriority`
- `featuredImage` (URL, senere: opplasting)

## Open Questions

- Skal admin-siden vise alle POIs (inkl. Google) eller kun native?
- Trenger vi redigering av eksisterende POIs, eller kun oppretting?
- Hvordan håndtere sletting - soft delete eller hard delete?
- Skal POIs knyttes til prosjekt ved opprettelse, eller være globale?

## Next Steps

→ `/workflows:plan` for implementasjonsdetaljer
