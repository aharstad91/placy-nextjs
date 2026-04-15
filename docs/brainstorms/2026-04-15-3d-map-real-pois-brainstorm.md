---
title: "Brainstorm: Ekte POI-data i Google Maps 3D med distanse-opacity"
date: 2026-04-15
type: brainstorm
---

# Brainstorm: Ekte POI-data i Google Maps 3D

## Problem
`Report3DMap.tsx` viser dummy-data fra `wesselslokka-3d-config.ts`. Rapporten henter allerede
ekte POIs via `getProductAsync()` → `projectData.pois`, men de sendes ikke videre til 3D-kartet.

## Nøkkelinnsikter

### Data er allerede tilgjengelig
`project.pois` og `reportData.centerCoordinates` finnes i `ReportPage`. Ingen nye DB-kall trengs.
Haversine-funksjon finnes allerede i `report-data.ts` (privat, kan eksporteres).

### Kategori-mapping er løst
`lib/themes/default-themes.ts` har `ThemeDefinition.categories[]` som er den autoritative
listen over hvilke `category.id`-verdier som tilhører hvert tema. Eksempler:
- "mat-drikke" → ["restaurant", "cafe", "bar", "bakery"]
- "barnefamilier" → ["skole", "barnehage", "lekeplass", "idrett"]
- "transport" → ["bus", "train", "tram", "bike", ...]
- "trening-velvare" → ["gym", "spa", "swimming"]

Tab-filteret i 3D-kartet skal bruke disse listene (ikke direkte category.id-sammenligning).

### Pilot-gate fjernes
`isWesselslokkaPilot`-sjekken i `ReportPage` var fordi hardkodet config ikke matchet andre
prosjekter. Når vi bruker ekte data, fungerer 3D-kartet for alle rapporter.

### Opacity i Google Maps 3D
`Marker3DPin` er en SVG rasterisert av Google før rendering. `opacity`-prop på `<svg>`-elementet
appliseres FØR Google rasteriserer — dette fungerer korrekt.

## Beslutninger

### Distanse-tiers (to lag)
- **Nær** (≤ 1200m ≈ 15 min gange): full opacity
- **Fjern** (> 1200m): opacity 0.3 — steder som City Lade, Værnes — tilstede men dempet
- 1200m er realistisk gangavstand uten kollektivtransport

### Tab-struktur
Bruk eksisterende tema-IDs fra prosjektets report-themes, ikke hardkodede tab-IDs.
Alternativt: bruk DEFAULT_THEMES til å utlede tab-labels fra faktiske POI-kategorier.
**Valg: tab-mapping basert på DEFAULT_THEMES.categories — gjenbruk eksisterende system.**

### "Vis alt" default
Modal åpner med "Alle" tab → alle pins vises (nær full opacity, fjern 0.3 opacity).
Wow-effekt: umiddelbar romlig oversikt. Filter-tabs er sekundær refinement.

### Ingen distanse-slider i denne iterasjonen
To-lags opacity (hardkodet 1200m) er tilstrekkelig som prototype. Slider vurderes neste gang.

## Scope

### Inn i scope
1. Kable `project.pois` → `Report3DMap` via `ReportPage`
2. Fjerne `isWesselslokkaPilot`-gate
3. Oppdatere `filterPoisByTab` til å matche mot `ThemeDefinition.categories`
4. Legge `opacity`-prop på `Marker3DPin` og `MapView3D`
5. Beregne distanse i `Report3DMap` og sende opacity til hvert POI

### Utenfor scope
- Distanse-slider UI
- Travel-time API-kall (presise gangtider)
- Nye Supabase-kall
