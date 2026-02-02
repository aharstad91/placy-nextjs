---
title: "feat: Google My Maps KML import CLI"
type: feat
date: 2026-02-02
brainstorm: docs/brainstorms/2026-02-02-google-my-maps-kml-import-explorer-brainstorm.md
---

# feat: Google My Maps KML import CLI

## Overview

CLI-script (`npm run import:kml`) som tar en Google My Maps-URL eller lokal KML-fil og oppretter et komplett Placy Explorer-prosjekt i Supabase. Formålet er outreach/salgsdemo: "Dere har allerede dataene — vi gjør dem 10x bedre."

Første case: **Open House Oslo 2025** (~70+ arkitektursteder, ~10 bydelskategorier).

## Problem Statement / Motivation

Organisasjoner som Open House, turistforeninger, kommuner og festivaler har allerede kartdata i Google My Maps. Disse kartene har dårlig mobil-UX, ingen reisetider, og generisk Google-branding. Placy Explorer gir dramatisk bedre opplevelse, men per i dag krever manuell oppsett av prosjekter og POIs.

En automatisert import-pipeline lar oss:
- Lage en fungerende Explorer-demo fra eksisterende data på minutter
- Bruke det som pitch: "Se hva vi kan lage av dataene dine"
- Bygge referansecaser som viser plattformens styrke

## Proposed Solution

Et TypeScript CLI-script som følger det etablerte mønsteret fra de 7 eksisterende import-scriptene i `scripts/`.

### Dataflyt

```
Google My Maps URL (eller lokal .kml-fil)
  ↓
Hent KML via Google eksport-endpoint
  (https://www.google.com/maps/d/kml?mid={MAP_ID}&forcekml=1)
  ↓
Parse KML med fast-xml-parser
  - <Folder> → Kategori (navn, farge fra <Style>)
  - <Placemark> → POI (navn, koordinater, beskrivelse)
  ↓
Beregn senterpunkt fra gjennomsnitt av alle POI-koordinater
  ↓
Upsert til Supabase (i rekkefølge):
  1. Customer
  2. Categories
  3. POIs
  4. Project (product_type: 'explorer')
  5. project_pois-koblinger
  ↓
Skriv ut Explorer-URL: /{customer}/{slug}
```

### CLI-signatur

```bash
npm run import:kml -- <url-or-file> --customer=<slug> --name="<Project Name>" [--slug=<url-slug>]
```

**Eksempel:**
```bash
npm run import:kml -- "https://www.google.com/maps/d/viewer?mid=1R17q4gu1_9PHYprldgCJlPdxb-AGTkU" \
  --customer=open-house-oslo \
  --name="Open House Oslo 2025"
```

## Technical Considerations

### Ny avhengighet

- **`fast-xml-parser`** — lightweight, zero-dep XML-parser. Håndterer CDATA, attributter, og nøstet struktur. Nødvendig fordi Node.js ikke har innebygd DOM-parser, og KML fra Google My Maps er dynamisk innhold (ikke statisk 35-punkt-datasett som taxiholdeplasser).

### ID-namespace (kritisk for dataintegritet)

Eksisterende import-scripts bruker prefiks for å unngå kollisjoner: `bysykkel-`, `taxi-`, `bus-`, `tram-`, `hyre-`, etc.

KML-importerte data bruker **customer-slug som prefiks**:
- **Kategori-ID:** `{customer}-{slugify(folder-name)}` → f.eks. `open-house-oslo-grunerloekka`
- **POI-ID:** `{customer}-{slugify(folder-name)}-{slugify(poi-name)}` → f.eks. `open-house-oslo-grunerloekka-aulaen`

Dette sikrer at:
- Ingen kollisjon med eksisterende kategorier (`park`, `bus`, etc.)
- Deterministisk — re-import gir samme IDer
- Lesbare og sporbare

### KML-spesifikke detaljer

| KML-egenskap | Håndtering |
|---|---|
| Koordinater `lng,lat,alt` | Swap til `lat,lng`, ignorer altitude |
| Farger `aabbggrr` (ABGR) | Konverter til `#rrggbb` |
| `<description>` med HTML/CDATA | Strip HTML-tags, behold ren tekst |
| Placemarks utenfor Folder | Opprett default-kategori `{customer}-uncategorized` |
| Nested Folders | Bruk kun leaf-level folders (de som direkte inneholder Placemarks) |
| Manglende Style/farge | Fallback til `#6b7280` (gray-500) |
| Lucide-ikon for kategorier | Default `MapPin` for alle (kan endres i admin etterpå) |

### Re-import / idempotens

- Alle database-operasjoner bruker `upsert` med `onConflict`
- POI-felter fra KML (name, lat, lng, category_id) oppdateres
- Editorielle felter (`editorial_hook`, `local_insight`, `featured_image`) bevares — upsert overskriver IKKE null-verdier over eksisterende data
- `project_pois`-koblinger erstattes helt (delete + insert pattern fra eksisterende scripts)

### Filer som endres/opprettes

| Fil | Endring |
|---|---|
| `scripts/import-kml.ts` | **NY** — hovedscriptet |
| `package.json` | Legg til `"import:kml"` script |

Ny dependency: `fast-xml-parser` (devDependencies)

## Acceptance Criteria

- [x] `npm run import:kml -- <url> --customer=X --name="Y"` henter KML og oppretter Explorer-prosjekt
- [x] `npm run import:kml -- ./file.kml --customer=X --name="Y"` fungerer med lokal fil
- [x] KML ExtendedData/Folders → Placy-kategorier med korrekt navn og farge
- [x] KML Placemarks → POIs med korrekt lat/lng (swapped fra KML lng,lat)
- [x] Project opprettes med `product_type: 'explorer'` og beregnet senterpunkt
- [x] Alle POIs kobles til prosjektet via `project_pois`
- [x] Scriptet er idempotent — kan kjøres flere ganger uten duplikater
- [x] Editorielle felter bevares ved re-import (upsert on factual fields only)
- [x] Kategori/POI-IDer er navnrom-isolert (customer-slug prefix)
- [x] Scriptet skriver ut oppsummeringstabell + Explorer-URL ved ferdigstillelse
- [x] Open House Oslo 2025-kartet importeres korrekt som første test-case (77 POIs, 10 bydeler)

## Success Metrics

- Open House Oslo Explorer fungerer og viser ~70+ steder organisert etter bydel
- Scriptet kan gjenbrukes for fremtidige Google My Maps-importer
- Hele prosessen fra URL til Explorer tar under 30 sekunder

## Dependencies & Risks

| Risiko | Mitigering |
|---|---|
| Google My Maps KML-eksport-URL kan endres | Fallback til lokal fil-import |
| KML-format varierer mellom kart | Robust parsing med fallbacks for manglende data |
| Private kart gir 403 | Tydelig feilmelding, foreslå lokal fil |
| `fast-xml-parser` breaking change | Pin versjon i package.json |

## References & Research

### Interne referanser

- Eksisterende import-scripts: `scripts/import-kommune-pois.ts` (nærmest mønster)
- Migrasjon: `scripts/migrate-to-supabase.ts` (project creation + POI linking)
- Mutations: `lib/supabase/mutations.ts:190-224` (linkPOIsToProject)
- Supabase schema: `supabase/migrations/001_initial_schema.sql`
- POI-type: `lib/types.ts:24-48`
- Kategori-type: `lib/types.ts:18-23`
- Data loading: `lib/data-server.ts:59-63` (Explorer URL-slug convention)

### Institutional learnings

- `docs/solutions/data-import/import-external-geographic-data-20260125.md` — batch upsert, slugify, over-engineering trap
- `docs/solutions/data-import/data-import-taxi-stands-20260125.md` — når IKKE å legge til parser-deps (men vår case rettferdiggjør det: dynamisk data, gjenbrukbart verktøy, 70+ punkter)
- `docs/solutions/data-import/import-wfs-geographic-data-20260125.md` — coordinate validation, centroid beregning
