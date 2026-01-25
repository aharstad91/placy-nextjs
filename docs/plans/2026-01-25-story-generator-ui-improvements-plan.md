# Plan: Story Generator UI-forbedringer

**Dato:** 2026-01-25
**Status:** Fullført

## Mål
Forbedre brukeropplevelsen i Story Generator (`/admin/generate`) med bedre inputfelt og mer kompakt kategori-visning.

## Endringer

### 1. Kunde som select
- Endre fra fritekst til dropdown med eksisterende kunder fra DB
- Hente kunder server-side og sende som prop til client-komponenten
- Vise kundenavn, lagre kunde-ID

### 2. 50/50 layout på Senter + Søkeradius
- Plasser begge i en 2-kolonne grid
- Senter til venstre, Søkeradius til høyre
- Beholder funksjonalitet, bare layout-endring

### 3. Kompakt kategoriliste med checkboxes
- Erstatt 2-kolonne colored buttons med vertikal liste
- Checkboxes for å vise aktiv status
- Inkluder alle kategorier fra `GOOGLE_CATEGORY_MAP`
- Legg til transport-kategorier (bus, bike, train, tram) som vanlige kategorier

### 4. Fjern transport-toggle
- Kollektivtransport håndteres som vanlige kategorier
- Fjern `includeTransport` state og toggle-UI

## Filer som endres
- `app/admin/generate/page.tsx` - Hente kunder server-side
- `app/admin/generate/generate-client.tsx` - UI-endringer
- `lib/generators/poi-discovery.ts` - Eksporter alle kategorier

## Utsatt
- Målgruppe-felt - venter til POI-prioritering er implementert
