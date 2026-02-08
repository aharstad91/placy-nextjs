---
title: "Multi-sirkel discovery-område for POI-import"
date: 2026-02-07
tags: [admin, import, discovery, radius, multi-circle, poi]
---

# Multi-sirkel Discovery-område

## Problemet

En sirkel rundt hotellet lager en unaturlig avgrensning. For Scandic Nidelven kuttes Midtbyen og Bakklandet — områdene med flest interessante POI-er — av radiusen. Å øke radius inkluderer uinteressante områder (industriområder, motorvei).

## Hva Vi Bygger

La admin legge til **flere sirkler** for å definere discovery-området. Hver sirkel har eget senterpunkt (klikk på kart) og justerbar radius. Import henter POI-er som er innenfor *minst én* sirkel. Uønskede POI-er fjernes manuelt etter import.

## Hvorfor Denne Tilnærmingen

- **Enklest mulig utvidelse** — eksisterende sirkel-visning og radius-logikk gjenbrukes direkte
- **Ingen nye bibliotek** — ingen Mapbox Draw, ingen PostGIS, ingen Turf.js
- **Pragmatisk** — dekker behovet uten over-engineering. Treffer man ekstra POI-er, fjerner man dem etter import
- **YAGNI** — polygon-tegning er kraftigere men unødvendig kompleksitet for dette brukstilfellet

## Nøkkelbeslutninger

1. **Multi-sirkel, ikke polygon** — enklere å implementere, bruker eksisterende radius-logikk
2. **Lagres på prosjekt** — `projects.discovery_circles` JSONB-kolonne: `[{lat, lng, radiusMeters}]`
3. **Begge steder i UI** — Prosjektdetalj-siden (definer/juster sirkler) + import-siden (bruk sirklene ved import)
4. **Manuell re-import** — Admin tegner sirkler, trykker "Importer" for å hente POI-er
5. **Behold alle POI-er** — Sirkler styrer kun NY import, fjerner ikke eksisterende POI-er utenfor
6. **Auto-generert fra /generate-hotel** — Én default-sirkel med by-spesifikk radius (som i dag)
7. **Union-logikk** — En POI er innenfor hvis den er innenfor *minst én* sirkel (Haversine per sirkel)

## Brukerflyt

### Admin: Prosjektdetalj
1. Ny seksjon/fane "Discovery-område" med kart
2. Kart viser eksisterende sirkler (semi-transparent fyll)
3. Klikk på kart = legg til ny sirkel (default 500m radius)
4. Klikk på eksisterende sirkel = velg den, vis radius-slider
5. Slett-knapp per sirkel
6. Lagre-knapp persisterer til `discovery_circles`

### Admin: Import
1. Hvis prosjekt har `discovery_circles`: bruk dem (vis på kart)
2. Hvis ikke: fallback til enkelt-sirkel (som i dag)
3. Import-knapp henter POI-er innenfor union av sirklene

### /generate-hotel
1. Oppretter prosjekt med én default-sirkel (by-spesifikk radius)
2. Admin kan etterpå legge til flere sirkler og re-importere

## Åpne Spørsmål

- Maks antall sirkler? (Foreslår 5-10)
- Skal sirkler ha labels/navn? (Trolig unødvendig)
- Skal det være en "reset til standard"-knapp?
