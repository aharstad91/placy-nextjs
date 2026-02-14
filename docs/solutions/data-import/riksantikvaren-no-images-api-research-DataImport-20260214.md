---
module: Data Import
date: 2026-02-14
problem_type: documentation_gap
component: documentation
symptoms:
  - "No image/photo fields in Riksantikvaren ArcGIS FredaBygninger layer (hasAttachments: false)"
  - "Need building photos for Explorer POI cards but no obvious image source in any Riksantikvaren API"
root_cause: inadequate_documentation
resolution_type: documentation_update
severity: medium
tags: [riksantikvaren, kulturminnesok, images, brukerminner, arcgis, api-research, photos]
---

# Research: Image Availability Across Riksantikvaren APIs

## Problem
After importing 200 fredede bygninger from the Riksantikvaren ArcGIS API, we needed building photos for the Explorer. No documentation existed about which Riksantikvaren/Kulturminnesøk APIs (if any) serve images.

## Environment
- Module: Data Import (scripts/import-riksantikvaren.ts)
- Stack: Next.js 14, TypeScript, Supabase
- Data source: Riksantikvaren / Kulturminnesøk
- Date: 2026-02-14

## Symptoms
- ArcGIS FredaBygninger layer has `hasAttachments: false` — no image fields exist
- Kulturminnesøk website loads images dynamically (SPA), making scraping impractical
- No documentation from Riksantikvaren about image APIs

## Investigation — 4 APIs Checked

### 1. ArcGIS MapServer (what we use for import)
**Endpoint:** `https://kart.ra.no/arcgis/rest/services/Distribusjon/Kulturminner20180301/MapServer/1`
- **Result:** No images. `hasAttachments: false`. Only metadata fields (navn, informasjon, datering, etc.)
- Two URL fields exist (`linkAskeladden`, `linkKulturminnesok`) but point to registry databases, not media

### 2. OGC Features API
**Endpoint:** `https://api.ra.no/LokaliteterEnkeltminnerOgSikringssoner/collections/lokaliteter/items/{id}`
- **Result:** No images. Same metadata as ArcGIS, plus polygon geometry and `senterpunkt`
- Full OpenAPI spec at `https://api.ra.no/LokaliteterEnkeltminnerOgSikringssoner/api?f=json`
- 3 collections: `enkeltminner`, `lokaliteter`, `sikringssoner` — none have image fields

### 3. Kulturminnesøk Frontend (kulturminnesok.no)
- **Result:** SPA that loads content dynamically. HTML contains only SVG icons and site branding
- Internal API at `kms-api.kulturminnesok.no` — serves images for the frontend but undocumented
- URL pattern: `https://kms-api.kulturminnesok.no/image/xxl/files/uploads/{filename}.jpg`

### 4. Brukerminner API (user-contributed content)
**Endpoint:** `https://api.ra.no/brukerminner/collections/brukerminner/items`
- **Result: HAS IMAGES!** CC-BY 3.0 licensed user photos
- 87 brukerbilder in Trondheim (kommune=Trondheim)
- Image URL pattern: `https://kms-api.kulturminnesok.no/image/xxl/files/uploads/{filename}.jpg`
- **Problem:** Linked via UUID (`linkkulturminnesok`), NOT via lokalitets-ID. No direct join to fredede bygninger.

**Queryable fields for brukerminner:**
```
tittel, beskrivelse, fylke, kommune, opprettet, opprettet_av,
linkkulturminnesok, gpsposisjon, bilder.url, bilder.fotograf,
bilder.beskrivelse, bilder.lisens, bilder.opprettet
```

**Example image URL from API response:**
```
https://kms-api.kulturminnesok.no/image/xxl/files/uploads/kongesteinen.jpg
```

## Solution

No single API provides images linked to fredede bygninger. Documented four alternative approaches:

1. **Google Places API** — already integrated in Placy. Search by building name + coordinates. Best coverage for well-known buildings (Nidarosdomen, Stiftsgården, etc.)

2. **Brukerminner geographic matching** — query `api.ra.no/brukerminner` with coordinate bounding box, match within ~50m radius of POIs. CC-BY license. Risk of false matches.

3. **Wikimedia Commons** — many fredede bygninger have CC images. Requires per-building lookup via Wikipedia/Wikidata API.

4. **No images** — Explorer functions with map markers and editorial text. Images are enhancement, not requirement.

## Why This Matters

When planning data imports from Riksantikvaren, do not assume images are available. The official APIs (ArcGIS + OGC Features) serve metadata and geometry only. Images exist only in the brukerminner (user-contributed) API, where they're linked by UUID rather than kulturminne-ID — making automatic matching unreliable.

## Prevention

- Before planning image features for cultural heritage data, check this document for API capabilities
- For Riksantikvaren imports, plan for Google Places API as primary image source
- The brukerminner API is a secondary source — geographic matching can supplement but not replace structured image sources
- `kms-api.kulturminnesok.no` serves images but is undocumented and may change without notice

## Related Issues

- See also: [arcgis-dual-table-linking-DataImport-20260214.md](./arcgis-dual-table-linking-DataImport-20260214.md) — the import that triggered this research
- See also: [import-external-geographic-data-20260125.md](./import-external-geographic-data-20260125.md) — general external data import patterns
