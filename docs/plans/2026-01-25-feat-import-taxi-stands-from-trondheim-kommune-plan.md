---
title: Import Taxi Stands from Trondheim Kommune
type: feat
date: 2026-01-25
---

# Import Taxi Stands from Trondheim Kommune

## Overview

Import 35 taxiholdeplasser (taxi stands) from Trondheim kommune's official KMZ data source into Placy's POI database, making them visible in the admin interface at `/admin/pois?categories=taxi`.

## Data Source

**URL:** `https://www.trondheim.kommune.no/globalassets/parkering/system/kart/Taxiholdeplasser.kmz`

This is an official KMZ file from Trondheim kommune containing all public taxi stands in Trondheim. The data was last updated 10.10.2024.

### Sample Data (35 locations)

| Name | Lat | Lng |
|------|-----|-----|
| Trondheim Sentralstasjon | 63.4359903 | 10.3995309 |
| Studentersamfundet | 63.4221761 | 10.3956212 |
| Solsiden | 63.434641 | 10.41368 |
| City Lade/Håkon Magnussons gate | 63.4439862 | 10.4460492 |
| Nidarosdomen (Bispegata) | 63.4276953 | 10.396752 |
| ... (30 more) | | |

## Technical Approach

### Option A: One-time Import Script (Recommended)

Create a Node.js script that:
1. Downloads the KMZ file
2. Extracts and parses the KML XML
3. Ensures taxi category exists in database
4. Inserts POIs via Supabase client

**Pros:** Simple, reusable, can be re-run to update data
**Cons:** Requires manual execution

### Option B: Admin UI Bulk Import

Add a "Import from URL" feature to the POI admin.

**Pros:** User-friendly, no CLI needed
**Cons:** Over-engineering for a one-time import

## Acceptance Criteria

- [ ] All 35 taxi stands are imported to Supabase `pois` table
- [ ] Each POI has `category_id: "taxi"`
- [ ] POIs are visible at `/admin/pois?categories=taxi`
- [ ] POIs display correctly on the map with taxi markers
- [ ] No duplicate entries if script is run multiple times (upsert by name)

## Implementation Plan

### Phase 1: Import Script

Create `scripts/import-taxi-stands.ts`:

```typescript
// scripts/import-taxi-stands.ts
import { createClient } from "@supabase/supabase-js";
import { parseStringPromise } from "xml2js";
import AdmZip from "adm-zip";

const TAXI_KMZ_URL = "https://www.trondheim.kommune.no/globalassets/parkering/system/kart/Taxiholdeplasser.kmz";

interface TaxiStand {
  name: string;
  lat: number;
  lng: number;
  description?: string;
}

async function fetchAndParseKMZ(): Promise<TaxiStand[]> {
  // 1. Fetch KMZ file
  const response = await fetch(TAXI_KMZ_URL);
  const buffer = await response.arrayBuffer();

  // 2. Extract KML from KMZ (it's a zip file)
  const zip = new AdmZip(Buffer.from(buffer));
  const kmlEntry = zip.getEntry("doc.kml");
  const kmlContent = kmlEntry?.getData().toString("utf-8");

  // 3. Parse KML XML
  const result = await parseStringPromise(kmlContent);
  const placemarks = result.kml.Document[0].Placemark;

  // 4. Extract taxi stands
  return placemarks.map((pm: any) => {
    const coords = pm.Point[0].coordinates[0].trim().split(",");
    return {
      name: pm.name[0],
      lng: parseFloat(coords[0]),
      lat: parseFloat(coords[1]),
      description: pm.description?.[0] || undefined,
    };
  });
}

async function importToSupabase(stands: TaxiStand[]) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Need service role for insert
  );

  // Ensure taxi category exists
  await supabase.from("categories").upsert({
    id: "taxi",
    name: "Taxi",
    icon: "Car",
    color: "#fbbf24",
  });

  // Import POIs with upsert (by name to avoid duplicates)
  for (const stand of stands) {
    const { error } = await supabase.from("pois").upsert(
      {
        id: `taxi-${stand.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`,
        name: stand.name,
        lat: stand.lat,
        lng: stand.lng,
        category_id: "taxi",
        address: stand.name, // Use name as address placeholder
        description: stand.description,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error(`Failed to import ${stand.name}:`, error);
    } else {
      console.log(`Imported: ${stand.name}`);
    }
  }
}

async function main() {
  console.log("Fetching taxi stands from Trondheim kommune...");
  const stands = await fetchAndParseKMZ();
  console.log(`Found ${stands.length} taxi stands`);

  console.log("Importing to Supabase...");
  await importToSupabase(stands);
  console.log("Done!");
}

main().catch(console.error);
```

### Phase 2: Add npm Script

Update `package.json`:

```json
{
  "scripts": {
    "import:taxi": "tsx scripts/import-taxi-stands.ts"
  }
}
```

### Phase 3: Dependencies

```bash
npm install adm-zip xml2js
npm install -D @types/adm-zip @types/xml2js
```

## Dependencies & Prerequisites

- [ ] `SUPABASE_SERVICE_ROLE_KEY` env variable (for insert permissions)
- [ ] Taxi category in categories table (script creates if missing)
- [ ] `adm-zip` and `xml2js` packages

## Success Metrics

- 35 taxi stands visible in admin POI list
- Map shows taxi markers at correct locations
- Data matches official Trondheim kommune source

## References

- **Data source:** [Trondheim parkering - Taxi](https://www.trondheim.kommune.no/parkering/innhold/parkere/taxi/)
- **KMZ file:** `https://www.trondheim.kommune.no/globalassets/parkering/system/kart/Taxiholdeplasser.kmz`
- **POI admin pattern:** `app/admin/pois/page.tsx`
- **Migration script example:** `scripts/migrate-to-supabase.ts`
