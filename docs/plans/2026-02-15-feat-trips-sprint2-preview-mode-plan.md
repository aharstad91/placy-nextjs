---
title: "feat: Trips Sprint 2 — Preview-modus"
type: feat
date: 2026-02-15
---

# Trips Sprint 2: Preview-modus

## Overview

Legg til en Preview-side mellom Trip Library og aktiv tur-modus. I dag klikker gjesten på en tur og går rett inn i navigeringsmodus (kart, geolocation, bottom sheet). Med Preview-modus får de en statisk oversikt først: hero image, metadata, stopp-liste, kart med rute, rewards-teaser, og en "Start turen"-knapp.

## Proposed Solution

### Ny komponent: TripPreview

Server-rendret side som viser tur-oversikt. Ingen geolocation, ingen completion-tracking.

**Seksjoner (scroll-rekkefølge):**
1. Hero: cover image + tittel + kategori-badge
2. Metadata-stripe: varighet, distanse, antall stopp, vanskelighetsgrad
3. Beskrivelse
4. Statisk kart med alle stopp markert + anbefalt rute (polyline)
5. Stopp-liste: nummererte kort med navn, thumbnail, kort beskrivelse
6. Rewards-teaser (hvis konfigurert)
7. "Start turen"-knapp (stor, tydelig CTA)

### Routing-endring

- `/for/[customer]/[project]/trips/[tripSlug]` → viser TripPreview (NY)
- `/for/[customer]/[project]/trips/[tripSlug]?mode=active` → viser TripPage (eksisterende)
- `/trips/[slug]` (SEO) → viser TripPreview (NY)
- `/trips/[slug]?mode=active` → viser TripPage (eksisterende)

"Start turen"-knappen navigerer til `?mode=active`.

### Trip Library-kort oppgradering

Allerede har metadata (varighet, stopp, vanskelighetsgrad). Lenker til preview (allerede riktig URL).

## Acceptance Criteria

- [ ] TripPreview-komponent med hero, metadata, kart, stopp-liste, CTA
- [ ] Statisk kart med stopp-markører og rute-polyline
- [ ] "Start turen" navigerer til aktiv modus
- [ ] Routing: default = Preview, ?mode=active = TripPage
- [ ] Begge ruter (project + SEO) støtter Preview
- [ ] Responsiv: mobil og desktop
- [ ] Rewards-teaser vises hvis konfigurert

## Implementation Tasks

- [ ] 1. Opprett `TripPreview.tsx` client-komponent med layout
- [ ] 2. Legg til `TripPreviewMap.tsx` — statisk kart med markører + rute
- [ ] 3. Oppdater `[tripSlug]/page.tsx` — route til Preview vs Active basert på query param
- [ ] 4. Oppdater `trips/[slug]/page.tsx` — samme routing for SEO-rute
- [ ] 5. Visuell verifikasjon i browser
- [ ] 6. TypeScript-sjekk + build

## References

- `components/variants/trip/TripPage.tsx` — eksisterende aktiv modus
- `app/for/[customer]/[project]/trips/TripLibraryClient.tsx` — Trip Library
- `lib/trip-adapter.ts` — tripToProject adapter
- `docs/prd/trips-v2.md:237-274` — Sprint 2 spec
