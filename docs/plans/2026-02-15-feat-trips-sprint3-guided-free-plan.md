---
title: "feat: Trips Sprint 3 — Guided/Free toggle"
type: feat
date: 2026-02-15
---

# Trips Sprint 3: Guided/Free Toggle

## Overview

Legg til veksling mellom Guided mode (anbefalt rute) og Free mode (fri utforskning) i TripPage. Guided er allerede implementert. Free mode viser alle stopp uten rute, sortert etter avstand fra bruker.

## Proposed Solution

### 1. DB-migrasjon: `trips.default_mode`

- Ny kolonne `default_mode TEXT CHECK (default_mode IN ('guided', 'free'))` med default `'guided'`
- Oppdater Supabase-typer manuelt (legg til i Row/Insert/Update)
- Oppdater `Trip`-type med `defaultMode` + legg til `TripMode` type

### 2. Type-endringer

- `lib/types.ts`: Legg til `TripMode = "guided" | "free"` + `defaultMode` i `Trip` og `TripConfig`
- `lib/supabase/types.ts`: Legg til `default_mode` i trips Row/Insert/Update
- `lib/supabase/queries.ts`: Map `default_mode` i `transformTrip()`
- `lib/trip-adapter.ts`: Pass `defaultMode` gjennom til `TripConfig`

### 3. TripPage: Mode state + toggle

- Ny state `tripMode` initialisert fra `tripConfig.defaultMode ?? "guided"`
- localStorage-persistens per trip: `trip-mode-${tripId}`
- Toggle UI i mobil header + desktop TripHeader

### 4. Free mode behavior i TripPage

- **Kart:** Vis alle stoppmarkører, men skjul rute-polyline
- **Stopp-liste:** Sortert etter avstand fra bruker (nærmeste først), oppdateres dynamisk
- **Stopp-panel:** Skjul transitionText, vis kun localInsight
- **Navigasjon:** Fjern prev/next-knapper, alle stopp er likeverdige
- **Markører:** Ingen "current stop" — alle er likeverdige

### 5. TripPreview: Mention free mode

- Legg til tekst under rute-kartet: "Du kan også utforske stoppene i din egen rekkefølge"

## Acceptance Criteria

- [x] DB-migrasjon for `trips.default_mode` kjørt
- [x] TypeScript-typer oppdatert (Trip, TripConfig, TripMode)
- [x] Toggle synlig i TripPage header (mobil + desktop)
- [x] Guided mode fungerer som før
- [x] Free mode: ingen rute, avstandssortert, kun localInsight
- [x] Brukervalg lagres i localStorage
- [x] TripPreview nevner fri utforskning
- [x] TypeScript 0 errors, build passes

## Implementation Tasks

- [x] 1. DB-migrasjon `036_trip_default_mode.sql`
- [x] 2. Oppdater Supabase-typer + frontend-typer + queries + adapter
- [x] 3. Implementer mode state + toggle i TripPage
- [x] 4. Implementer Free mode behavior (sortert liste, skjul rute, skjul transitionText)
- [x] 5. Oppdater TripPreview med fri utforskning-tekst
- [x] 6. Visuell verifikasjon + TypeScript-sjekk

## References

- `components/variants/trip/TripPage.tsx` — hovedkomponent
- `components/variants/trip/TripHeader.tsx` — desktop header
- `components/variants/trip/TripStopPanel.tsx` — mobil stopp-panel
- `components/variants/trip/TripStopList.tsx` — desktop stopp-liste
- `components/variants/trip/TripStopDetail.tsx` — stopp-detaljer
- `components/variants/trip/TripPreview.tsx` — preview-side
- `lib/trip-adapter.ts` — Trip → Project adapter
- `docs/prd/trips-v2.md:277-311` — Sprint 3 spec
