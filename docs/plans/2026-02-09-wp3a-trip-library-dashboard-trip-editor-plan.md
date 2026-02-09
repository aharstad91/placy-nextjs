---
title: "WP3A: Trip Library Dashboard + Trip Editor"
type: plan
date: 2026-02-09
status: draft
trello: https://trello.com/c/r415u8Yd
brainstorm: docs/brainstorms/2026-02-09-wp3-admin-trip-editor-brainstorm.md
prd: docs/plans/2026-02-09-prd-trip-library-platform.md
depends_on: WP1
---

# WP3A: Trip Library Dashboard + Trip Editor

## Oversikt

Bygg Placy Trip Library admin-grensesnitt: dashboard for å se/filtrere alle trips, og en trip-editor for å opprette/redigere trips med stopp.

### Filer som endres/opprettes

| Fil | Endring |
|-----|---------|
| `components/admin/admin-sidebar.tsx` | Legg til "Trips" nav-item |
| `app/admin/trips/page.tsx` | NY — Trip Library dashboard (server component) |
| `app/admin/trips/trips-admin-client.tsx` | NY — Dashboard client component |
| `app/admin/trips/[id]/page.tsx` | NY — Trip editor (server component med server actions) |
| `app/admin/trips/[id]/trip-editor-client.tsx` | NY — Trip editor client component |
| `lib/supabase/queries.ts` | Nye admin queries |

### Eksisterende mønster å følge

- **Server component → client component split**: `app/admin/projects/[id]/page.tsx` → `project-detail-client.tsx`
- **Server actions**: Definert i `page.tsx`, sendt som props til client
- **FormData-parsing**: `lib/utils/form-data.ts` (`getRequiredString`, `getOptionalString`, etc.)
- **Supabase queries**: `createServerClient()`, batch fetching, transform-funksjoner
- **Admin layout**: Sidebar med `lg:pl-64` offset, `max-w-7xl` content area

---

## Steg 1: Legg til "Trips" i AdminSidebar

**Fil:** `components/admin/admin-sidebar.tsx`

- [ ] Importer `Route` ikon fra lucide-react
- [ ] Legg til nav-item: `{ href: "/admin/trips", label: "Trips", icon: Route }`
- [ ] Plasser mellom "Prosjekter" og "POI-er"

---

## Steg 2: Admin queries for trips

**Fil:** `lib/supabase/queries.ts`

Nye queries (alle bruker `createServerClient()` — service_role, ingen RLS-begrensning):

- [ ] `getAllTripsAdmin()` — hent alle trips (inkl. upubliserte), sortert etter by + tittel. Returner `Trip[]` uten stopp (listing view).
- [ ] `getTripByIdAdmin(id)` — hent én trip med alle stopp + POI-data (for editor). Inkluder upubliserte.
- [ ] `searchPoisAdmin(query, city?)` — søk POI-er på navn, optional by-filter. Returner max 20 resultater med kategori.

Merk: `createTrip`, `updateTrip`, `deleteTrip`, stopp-mutasjoner gjøres direkte i server actions (ikke som separate query-funksjoner), slik eksisterende admin gjør det.

---

## Steg 3: Trip Library Dashboard

### Server component: `app/admin/trips/page.tsx`

- [ ] `export const dynamic = "force-dynamic"`
- [ ] Admin-enabled check (redirect if not)
- [ ] Fetch alle trips via `getAllTripsAdmin()`
- [ ] Fetch distinkte byer for filter-dropdown
- [ ] Render `TripsAdminClient` med data

### Client component: `app/admin/trips/trips-admin-client.tsx`

- [ ] Filtrering (client-side):
  - Tekstsøk i tittel
  - By (dropdown fra distinkte verdier)
  - Kategori (dropdown med norske labels fra `TRIP_CATEGORY_LABELS`)
  - Sesong (dropdown)
  - Publisert/upublisert/alle (toggle)
- [ ] Tabell/liste med kolonner:
  - Tittel (link til editor)
  - By
  - Kategori (med norsk label)
  - Sesong
  - Stopp-antall
  - Publisert (grønn/grå dot)
  - Dato (updated_at)
- [ ] "Ny trip"-knapp → navigerer til `/admin/trips/new`
- [ ] Tom-state: "Ingen trips funnet"

---

## Steg 4: Trip editor — Server component + Server actions

### Server component: `app/admin/trips/[id]/page.tsx`

- [ ] Admin-enabled check
- [ ] Hent trip: Hvis `id === "new"` → tom editor. Ellers: `getTripByIdAdmin(id)`
- [ ] `notFound()` hvis trip ikke finnes
- [ ] Render `TripEditorClient` med trip-data og server actions

### Server actions

Alle definert i `page.tsx`, følger eksisterende mønster med FormData:

- [ ] `createTrip(formData)` — insert i `trips`, redirect til `/admin/trips/[id]`
  - Felter: title, description, url_slug, cover_image_url, city, region, country, center_lat, center_lng, category, difficulty, season, tags, default_reward_title, default_reward_description, distance_meters, duration_minutes
  - Auto-generer URL slug fra tittel hvis tomt
  - Sett `published = false` som default

- [ ] `updateTrip(formData)` — update `trips` by id
  - Samme felter som createTrip
  - `revalidatePath("/admin/trips")` + `/admin/trips/[id]`

- [ ] `deleteTrip(formData)` — delete fra `trips` (cascade tar stopp)
  - Bekreft at trippen ikke er koblet til prosjekter (sjekk `project_trips`)
  - Redirect til `/admin/trips`

- [ ] `togglePublish(formData)` — toggle `published` felt
  - `revalidatePath` for både admin og frontend

- [ ] `addTripStop(formData)` — insert i `trip_stops`
  - Felter: trip_id, poi_id
  - sort_order: max(existing) + 1
  - `revalidatePath`

- [ ] `updateTripStop(formData)` — update `trip_stops` by id
  - Felter: name_override, description_override, image_url_override, transition_text, local_insight

- [ ] `deleteTripStop(formData)` — delete fra `trip_stops`
  - `revalidatePath`

- [ ] `reorderTripStops(formData)` — batch-oppdater sort_order
  - Input: JSON array av `{ id, sort_order }`
  - Oppdater alle i én transaksjon

- [ ] `searchPois(formData)` — POI-søk for stopp-valg
  - Input: query (string), city (optional)
  - Returner max 20 POI-er med kategori
  - Returnerer JSON-respons (ikke revalidate)

---

## Steg 5: Trip editor — Client component

### Client component: `app/admin/trips/[id]/trip-editor-client.tsx`

To faner: **Detaljer** og **Stopp**.

### Detaljer-fane

- [ ] Skjema med feltene:
  - Tittel (text input, required)
  - URL slug (text input, auto-generert fra tittel. Readonly etter lagring.)
  - Beskrivelse (textarea)
  - Cover image URL (text input)
  - By (text input, required)
  - Region (text input)
  - Land (text input, default "NO")
  - Senterpunkt: lat + lng (number inputs)
  - Kategori (select med TRIP_CATEGORY_LABELS)
  - Vanskelighetsgrad (select: easy/moderate/challenging)
  - Sesong (select: spring/summer/autumn/winter/all-year)
  - Tags (text input, kommaseparert)
  - Avstand i meter (number input)
  - Varighet i minutter (number input)
  - Default reward tittel (text input)
  - Default reward beskrivelse (textarea)

- [ ] Publisert-toggle (switch/checkbox, topp-høyre)
- [ ] Featured-toggle
- [ ] "Lagre"-knapp → kaller `updateTrip`/`createTrip`
- [ ] "Slett trip"-knapp (med ConfirmDialog)

### Stopp-fane

- [ ] Nummerert liste over stopp:
  - Nummer + POI-navn + kategori-badge
  - Forhåndsvisning av transition_text (truncated)
  - Opp/ned-knapper for rekkefølge
  - Klikk for å utvide inline editor

- [ ] Inline stopp-editor (expanded):
  - POI-info (read-only): navn, adresse, kategori
  - Name override (text input)
  - Description override (textarea)
  - Image URL override (text input)
  - Transition text (textarea, placeholder: "Gå videre mot...")
  - Local insight (textarea, placeholder: "Visste du at...")
  - "Lagre stopp" og "Fjern stopp"-knapper

- [ ] "Legg til stopp"-knapp:
  - Åpner søkepanel under listen
  - Søkefelt med debounce (300ms)
  - By-filter forhåndsutfylt fra trip.city
  - Resultatliste: POI-navn, kategori-badge, adresse
  - Klikk for å legge til → kaller `addTripStop`

### Slug-generering

- [ ] Utility: `generateSlug(title)` — lowercase, æøå → ae/o/a, spaces → dashes, strip special chars
- [ ] Auto-sett ved tittel-endring (kun for nye trips)

---

## Steg 6: Verifisering

- [ ] `npm run build` — ingen TypeScript-feil
- [ ] Test manuelt:
  - Navigér til `/admin/trips` — ser tom liste eller eksisterende trips
  - Klikk "Ny trip" → skjema vises
  - Fyll ut metadata, lagre → redirect til editor
  - Bytt til Stopp-fane → søk og legg til POI-er
  - Endre rekkefølge med opp/ned-knapper
  - Publisér trip → synlig i frontend

---

## Rekkefølge

```
Steg 1 → Steg 2 → Steg 3 → Steg 4 → Steg 5 → Steg 6
sidebar   queries   dashboard  server    client    verify
                               actions   editor
```

Steg 1-2 er uavhengige og kan gjøres parallelt. Steg 3-5 er sekvensielle.
