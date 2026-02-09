---
title: "WP3: Admin + Trip Editor — Brainstorm"
type: brainstorm
date: 2026-02-09
status: decided
trello: https://trello.com/c/nTyrxTh1
depends_on: WP1 (database + queries)
---

# WP3: Admin + Trip Editor — Brainstorm

## Kontekst

WP3 gir Placy-teamet alt de trenger for å administrere trips. WP1 (database-schema, queries, typer) er allerede implementert. WP2 (gjesteside) er under arbeid/ferdig.

Denne brainstormen dekker:
- Placy Trip Library dashboard (`/admin/trips`)
- Trip editor (opprett/rediger trips med stopp)
- Trips-fane i prosjekt-admin (`/admin/projects/[id]`)
- Override-skjema per trip (startpunkt, reward, branding)
- Geo-baserte forslag

---

## Beslutning 1: Oppdeling i to kort

**Beslutning: Del WP3 i to Trello-kort for bedre flyten.**

### WP3A: Trip Library Dashboard + Trip Editor
- `/admin/trips` — liste alle trips, filtrer på by/kategori/sesong
- `/admin/trips/new` — opprett ny trip
- `/admin/trips/[id]` — rediger trip (metadata + stopp)
- Stopp-editor: velg POI, skriv transition_text og local_insight

### WP3B: Project Admin — Trips-fane + Overrides
- Trips-fane i `/admin/projects/[id]`
- Vis tilknyttede trips med overrides
- Søk/bla i Trip Library for å koble nye trips
- Geo-baserte forslag (trips i samme by)
- Override-skjema per trip (startpunkt, reward, branding)

**Begrunnelse:** WP3A kan bygges og testes uavhengig. WP3B bygger på WP3A (bruker trip-data). Rekkefølge: WP3A først → WP3B.

---

## Beslutning 2: Trip Library Dashboard (`/admin/trips`)

**Beslutning: Enkel liste med filtrering. Følg eksisterende admin-mønster.**

### Visning
- Tabell/grid med: tittel, by, kategori, sesong, stopp-antall, publisert-status
- Klikk → åpne trip editor (`/admin/trips/[id]`)
- "Ny trip"-knapp øverst

### Filtrering
- By (dropdown fra distinkte verdier)
- Kategori (chips/dropdown)
- Sesong (dropdown)
- Publisert/upublisert (toggle)
- Tekstsøk i tittel

### Mønster
Følger `projects-admin-client.tsx`:
- Server component henter data, sender til client component
- Client component håndterer filtrering og UI

---

## Beslutning 3: Trip Editor

**Beslutning: To-fane editor (Detaljer + Stopp). Server actions for mutasjoner.**

### Tab: Detaljer
Metadata-skjema:
- Tittel, beskrivelse, URL-slug (auto-generert fra tittel)
- Cover image URL
- By, region, land, senterpunkt (lat/lng)
- Kategori, vanskelighetsgrad, sesong
- Tags (kommaseparert input)
- Default reward (tittel + beskrivelse)
- Avstand (meter), varighet (minutter)
- Published toggle
- Featured toggle

### Tab: Stopp
Stopp-liste med redigering:
- Vertikal liste med nummererte stopp
- Hvert stopp viser: POI-navn, kategori-ikon, transition_text (forhåndsvisning)
- **Opp/ned-knapper** for rekkefølge (ikke drag-and-drop i MVP)
- "Legg til stopp"-knapp → åpner POI-søk
- Klikk på stopp → utvid inline editor:
  - Viser: POI-info (navn, adresse, bilde)
  - Redigerbare felt: name_override, description_override, image_url_override
  - transition_text (textarea)
  - local_insight (textarea)
  - Fjern-knapp

### POI-valg for nytt stopp
**Beslutning: Søkefelt + resultatliste. Ingen kart.**

- Tekstsøk i POI-database (navn, adresse)
- Filtrér på by (forhåndsutfylt fra trip.city)
- Resultatliste med: navn, kategori, adresse
- Klikk for å legge til som stopp
- Lukk søkepanelet etter valg

### Slug-generering
- Auto-generert fra tittel ved opprettelse
- Kan overstyres manuelt
- Validering: `^[a-z0-9-]+$`, unik
- Readonly etter første lagring (for å unngå broken URLs)

---

## Beslutning 4: Server Actions vs API Routes

**Beslutning: Server actions for alle mutasjoner. Følger eksisterende mønster.**

- `createTrip(formData)` — oppretter trip, returnerer ID for redirect
- `updateTrip(formData)` — oppdaterer trip-metadata
- `deleteTrip(formData)` — sletter trip (med bekreftelse)
- `publishTrip(formData)` — toggler published-status
- `addTripStop(formData)` — legger til stopp med POI-referanse
- `updateTripStop(formData)` — oppdaterer stopp-detaljer
- `deleteTripStop(formData)` — fjerner stopp
- `reorderTripStops(formData)` — oppdaterer sort_order for alle stopp

For POI-søk: bruker eksisterende query-mønster, ingen egen API route nødvendig.

---

## Beslutning 5: POI-søk for stopp

**Beslutning: Server-side søk via server action.**

```
searchPoisForTrip(formData: { query, city? })
→ Supabase: pois.select("id, name, address, lat, lng, categories(name, icon)")
  .ilike("name", `%${query}%`)
  .eq("city", city)  // optional filter
  .limit(20)
```

- Debounced søk (300ms)
- Maks 20 resultater
- Viser POI-kategori ikon og adresse i listen

---

## Beslutning 6: Trips-fane i prosjekt-admin (WP3B)

**Beslutning: Ny tab "Trips" i project-detail-client.tsx.**

### Visning: Tilknyttede trips
- Liste over trips koblet via `project_trips`
- Hver rad: tittel, kategori, stopp-antall, enabled-toggle
- Klikk → utvid override-skjema

### Legg til trip
- "Legg til trip"-knapp → åpner søk/bla-panel
- Geo-forslag: trips i samme by som prosjektet (automatisk)
- Tekstsøk i hele trip-biblioteket
- Klikk for å koble → oppretter `project_trips`-rad

### Override-skjema
Per trip, redigerbare felt:
- Start-POI (søk i prosjektets POI-pool)
- Start-navn, beskrivelse, transition_text
- Reward: tittel, beskrivelse, kode, gyldighets-dager
- Velkomsttekst
- Sortering (opp/ned)
- Enabled toggle
- Fjern kobling

### Geo-baserte forslag
- Hent trips der `trips.city = project.city` (eller nærmeste by)
- Vis som "Foreslåtte trips" over søkeresultater
- Exclude allerede koblede trips

---

## Beslutning 7: Admin sidebar-oppdatering

**Beslutning: Legg til "Trips" link i AdminSidebar.**

```
Dashboard
Customers
Projects
Trips ← NY
POIs
Categories
Stories
Editorial
Generate
Import
```

Ikon: `Map` fra Lucide (eller `Route`).

---

## Tekniske noter

### Eksisterende kode å bygge på
- `lib/supabase/queries.ts` — har allerede `getTripsByCity()`, `getTripBySlug()`, etc.
- `lib/types.ts` — har `Trip`, `TripStop`, `ProjectTripOverride`
- `app/admin/projects/[id]/page.tsx` — server action pattern
- `components/admin/AdminSidebar.tsx` — navigasjonsstruktur

### Nye queries som trengs
- `getAllTrips()` — for admin dashboard (inkl. upubliserte)
- `getTripById(id)` — for editor (inkl. stops + POI-data)
- `searchPois(query, city?)` — for stopp-valg
- `createTrip(data)` — insert + return
- `updateTrip(id, data)` — update metadata
- `deleteTrip(id)` — delete (cascade tar stops)
- `addTripStop(tripId, poiId, sortOrder)` — insert stop
- `updateTripStop(id, data)` — update stop details
- `deleteTripStop(id)` — delete stop
- `reorderTripStops(tripId, stopIds[])` — batch update sort_order
- `linkTripToProject(projectId, tripId)` — insert project_trip
- `unlinkTripFromProject(projectId, tripId)` — delete project_trip
- `updateProjectTripOverride(id, data)` — update override

### RLS-hensyn
Admin bruker `service_role` key (server-side). Ingen RLS-problemer for admin-operasjoner.

---

## Oppsummering

| Tema | Beslutning |
|------|-----------|
| Oppdeling | To kort: WP3A (library + editor), WP3B (project admin) |
| Dashboard | Tabell med filtrering (by, kategori, sesong, publisert) |
| Trip editor | To-fane: Detaljer + Stopp |
| POI-valg | Søkefelt + resultatliste, ingen kart |
| Rekkefølge stopp | Opp/ned-knapper (ikke DnD) |
| Mutasjoner | Server actions (følg eksisterende mønster) |
| Sidebar | Legg til "Trips" i AdminSidebar |
| POI-søk | Server-side med debounce, filtrér på by |
