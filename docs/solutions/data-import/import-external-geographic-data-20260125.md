---
title: Import External Geographic Data (KMZ/KML) into POI System
date: 2026-01-25
problem_type: data_import
category: data-import
module: POI Admin
severity: low
tags:
  - poi
  - taxi
  - kmz
  - kml
  - supabase
  - batch-import
  - trondheim-kommune
  - geographic-data
symptoms:
  - Need to import external geographic data into POI system
  - Data exists in KMZ/KML format from government source
  - Initial approach over-engineered with unnecessary dependencies
---

# Import External Geographic Data (KMZ/KML) into POI System

## Problem

Import 35 taxi stands from Trondheim kommune's official data source into Placy's POI admin system. The data was available as a KMZ file (compressed KML), which is a common format for government geographic data.

### Initial Challenge

The kommune website at `https://www.trondheim.kommune.no/parkering/innhold/parkere/taxi/` showed a map with taxi stands but no direct data download. The coordinates were not visible in the HTML source.

## Investigation

### Step 1: Web Fetch (Failed)

Fetching the page directly returned only general information text, no coordinates.

### Step 2: Open Data Search (Failed)

Searched Trondheim Åpne Data and ArcGIS services - found parking data but no taxi-specific dataset.

### Step 3: Network Inspection (Success)

Used Chrome DevTools to inspect network requests when the map loaded:

```
GET https://www.trondheim.kommune.no/globalassets/parkering/system/kart/Taxiholdeplasser.kmz
```

### Step 4: KMZ Extraction

Downloaded and extracted the KMZ file (which is a ZIP containing KML):

```bash
curl -sL "https://www.trondheim.kommune.no/globalassets/parkering/system/kart/Taxiholdeplasser.kmz" \
  -o taxi.kmz && unzip -o taxi.kmz && cat doc.kml
```

Found 35 Placemark elements with coordinates in the KML XML.

## Initial Over-Engineered Approach

The first plan proposed:
- Using `adm-zip` package to extract KMZ at runtime
- Using `xml2js` package to parse KML XML
- Individual upserts in a loop (35 network calls)

## Reviewer Feedback

Three reviewers identified issues:

| Reviewer | Key Feedback |
|----------|-------------|
| **DHH** | Use batch upsert. For 35 static records, consider hardcoding data. |
| **Kieran** | Add error handling, dotenv loading, env validation. |
| **Simplicity** | 60% LOC reduction possible. Zero new dependencies needed. |

## Final Solution

Pre-extract the coordinates once, hardcode as a constant array, batch upsert to Supabase.

### Script: `scripts/import-taxi-stands.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Pre-extracted from Trondheim kommune KMZ file
const TAXI_STANDS = [
  { name: "Moholt Alle", lat: 63.411226, lng: 10.434267 },
  { name: "Trondheim Sentralstasjon", lat: 63.4359903, lng: 10.3995309 },
  { name: "Studentersamfundet", lat: 63.4221761, lng: 10.3956212 },
  // ... 32 more entries
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Missing Supabase environment variables");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Ensure category exists first
  const { error: categoryError } = await supabase.from("categories").upsert(
    { id: "taxi", name: "Taxi", icon: "Car", color: "#fbbf24" },
    { onConflict: "id" }
  );

  if (categoryError) {
    console.error("Failed to create category:", categoryError.message);
    process.exit(1);
  }

  // Batch upsert all POIs at once
  const pois = TAXI_STANDS.map((stand) => ({
    id: `taxi-${slugify(stand.name)}`,
    name: stand.name,
    lat: stand.lat,
    lng: stand.lng,
    category_id: "taxi",
    address: stand.name,
  }));

  const { error: poiError } = await supabase
    .from("pois")
    .upsert(pois, { onConflict: "id" });

  if (poiError) {
    console.error("Failed to import:", poiError.message);
    process.exit(1);
  }

  console.log(`Imported ${pois.length} taxi stands`);
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
```

### Run Command

```bash
npm run import:taxi
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Hardcoded data** | Static dataset (updated 10.10.2024). No runtime parsing needed. Auditable in git. |
| **Batch upsert** | Single database operation vs 35 individual inserts. Atomic and idempotent. |
| **Slugify with NFD** | Handles Norwegian characters (ø, å, æ). Creates stable, collision-free IDs. |
| **Category upsert first** | Ensures foreign key constraint won't fail. |
| **Zero new dependencies** | Uses only existing `@supabase/supabase-js` and `dotenv`. |

## Prevention: Future Import Checklist

### Data Assessment

- [ ] Check data source update frequency (static vs dynamic)
- [ ] Estimate record count
- [ ] Identify data format (KMZ, GeoJSON, CSV, API)
- [ ] Find actual data endpoint (inspect network requests)

### Implementation

- [ ] For < 100 static records: hardcode data
- [ ] For > 100 or frequently updated: write parser
- [ ] Always use batch upsert, not loops
- [ ] Include proper error handling
- [ ] Validate environment variables
- [ ] Use `process.exit(1)` on failures

### Code Quality

- [ ] Use slugify for deterministic IDs
- [ ] Document data source URL and last update date
- [ ] Add npm script to package.json
- [ ] Test idempotency (run twice, verify no duplicates)

## Related Files

- `scripts/import-taxi-stands.ts` - The import script
- `scripts/migrate-to-supabase.ts` - Similar pattern for JSON migration
- `app/admin/pois/page.tsx` - Admin interface that displays imported POIs
- `docs/plans/2026-01-25-feat-import-taxi-stands-from-trondheim-kommune-plan.md` - Original plan

## Result

35 taxi stands successfully imported and visible at:
`http://localhost:3000/admin/pois?categories=taxi`
