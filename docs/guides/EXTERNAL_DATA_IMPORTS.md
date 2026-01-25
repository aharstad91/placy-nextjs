# External Geographic Data Imports - Prevention Strategies & Best Practices

## Overview

This guide captures lessons learned from importing municipal geographic data (e.g., taxi stands) into the Placy POI system. It provides strategies to approach similar imports efficiently and sustainably.

---

## Key Learnings from Taxi Stand Import

The taxi stand import (`scripts/import-taxi-stands.ts`) revealed critical patterns:

1. **Government data is typically in KMZ/KML format** - Not immediately queryable APIs
2. **Network inspection reveals actual data endpoints** - Check browser DevTools network tab on source websites
3. **Pre-extraction is preferable** - Static datasets are smaller than dynamic parsing libraries
4. **Batch operations over individual inserts** - Use upserts, not row-by-row inserts
5. **Small static datasets can be hardcoded** - 35 taxi stands fit well in a TS array
6. **One-time vs. recurring imports have different strategies** - Static data ≠ dynamic data

---

## Prevention Strategies

### 1. Data Source Assessment

Before starting an import, evaluate the data source:

#### Checklist:
- [ ] Is data available as **API** (preferred) or static file (KMZ/KML/JSON)?
- [ ] What is the **update frequency**? (Never, yearly, monthly, real-time?)
- [ ] What is the **file size**? (< 100KB = hardcode candidate, > 1MB = streaming required)
- [ ] Is there **official documentation** or terms of service?
- [ ] Does the source have **rate limits** or authentication requirements?

#### Example Decision Matrix:

| Data Type | Update Frequency | Size | Strategy |
|-----------|------------------|------|----------|
| Taxi stands | Rarely (yearly) | 35 points | **Hardcode** in TS array |
| Bus stops | Never | 50 points | Hardcode in TS array |
| Bike stations | Rarely | 40 points | Hardcode in TS array |
| Restaurant ratings | Daily | ? | API with caching |
| Real-time departures | Live | ? | Live API endpoint |
| Public events | Weekly | 100-500 | Import script + DB |

### 2. Discovery Strategy

When data isn't in an obvious format:

#### Step-by-step approach:
1. **Visit the official website** where data is referenced
2. **Open browser DevTools → Network tab** (Cmd+Option+I → Network)
3. **Reload the page** and look for suspicious requests
4. **Filter by XHR/Fetch** to find API calls
5. **Check request payload and response** for actual data format
6. **Save response locally** for analysis

#### Example:
- Visit: `trondheim.kommune.no/parkering/taxi`
- Open DevTools → Network
- Look for KMZ/JSON responses
- Found: `globalassets/parkering/system/kart/Taxiholdeplasser.kmz`
- Download and extract using command-line tools

---

## Best Practices

### 1. Hardcoding Small Static Datasets

**When to use:**
- Dataset < 100 items
- Updates less than quarterly
- No need for user-facing import UI

**Benefits:**
- ✅ Zero dependencies (no KMZ/GeoJSON libraries)
- ✅ Type-safe TypeScript validation
- ✅ Git history tracks changes
- ✅ Instant startup (no parsing)
- ✅ Easy to version and review

**Pattern:**
```typescript
// scripts/import-taxi-stands.ts
const TAXI_STANDS = [
  { name: "Moholt Alle", lat: 63.411226, lng: 10.434267 },
  { name: "Nedre Møllenberg gate", lat: 63.432282, lng: 10.413138 },
  // ... 33 more entries
];
```

**Maintenance:**
- When data updates: Download new KMZ, re-extract coordinates, update array
- Document source URL and last-updated date in comments
- Add update frequency note for future maintainers

### 2. Batch Upserts Over Individual Inserts

**When to use:**
- Importing 10+ records
- Database supports bulk operations

**Benefits:**
- ✅ Single transaction (atomic)
- ✅ 100x faster than row-by-row
- ✅ Prevents partial imports
- ✅ Idempotent (safe to re-run)

**Pattern:**
```typescript
// Prepare all POIs for batch upsert
const pois = TAXI_STANDS.map((stand) => ({
  id: `taxi-${slugify(stand.name)}`,
  name: stand.name,
  lat: stand.lat,
  lng: stand.lng,
  category_id: "taxi",
}));

// Single batch operation
const { error } = await supabase
  .from("pois")
  .upsert(pois, { onConflict: "id" });
```

**Anti-pattern:**
```typescript
// ❌ DON'T DO THIS - 35 separate transactions
for (const stand of TAXI_STANDS) {
  await supabase.from("pois").insert([{ ...stand }]);
}
```

### 3. Pre-extraction Over Dynamic Parsing

**When to use:**
- Dataset size < 1MB
- Updates infrequent (< quarterly)
- Team size < 10 (maintenance burden acceptable)

**Benefits:**
- ✅ No parsing dependencies (smaller bundle)
- ✅ No runtime errors from malformed files
- ✅ Easier to review in code
- ✅ Faster load times

**Pattern:**
```typescript
// Extract once at import time
// ✓ KMZ downloaded → extracted to JSON
// ✓ JSON loaded → coordinates copied to TS array
// ✓ TS array committed to git

const TAXI_STANDS = [...]; // Pre-extracted data

// No parsing logic needed
```

**When to reject this approach:**
- Dataset > 1000 items
- Updates weekly or more frequently
- Need versioning (multiple versions live simultaneously)

### 4. Idempotency: Upsert IDs Matter

**When to use:**
- Always, for batch imports

**Benefits:**
- ✅ Safe to re-run without duplicates
- ✅ Easy to update existing records
- ✅ Prevents accidental data loss

**Pattern:**
```typescript
// ID generation should be deterministic
const id = `taxi-${slugify(stand.name)}`;

// Same input → same ID → can be re-run
// If stand.name never changes, this is idempotent
```

**Consideration:**
- Choose ID based on stable properties (name, reference number)
- Avoid auto-incrementing IDs for imports
- Document ID scheme for future maintainers

### 5. Category Management in Imports

**Pattern:**
```typescript
// 1. Ensure category exists (upsert with onConflict)
const { error: categoryError } = await supabase
  .from("categories")
  .upsert(
    { id: "taxi", name: "Taxi", icon: "Car", color: "#fbbf24" },
    { onConflict: "id" }
  );

// 2. Then import POIs referencing the category
const { error: poiError } = await supabase
  .from("pois")
  .upsert(pois, { onConflict: "id" });
```

**Why:**
- Ensures referential integrity
- Category exists before POIs reference it
- Safe to re-run multiple times

---

## Common Pitfalls to Avoid

### 1. Over-Engineering with Unnecessary Dependencies

**❌ Bad:**
```typescript
import kmz from 'kmz';  // New dependency
import geoJSON from 'geojson';  // Another dependency
import { parse } from 'xml2js';  // And another

// 3 new dependencies for one-time import of 35 points
```

**✅ Good:**
```typescript
// Pre-extracted data, no dependencies
const TAXI_STANDS = [ /* ... */ ];
```

### 2. Hardcoding Runtime Imports

**❌ Bad:**
```typescript
// At app startup
const TAXI_DATA = require('./data/taxi-stands.kmz');
// Parsing happens on every server restart

app.get('/api/taxi', (req, res) => {
  const parsed = parseKMZ(TAXI_DATA); // Every request?
  res.json(parsed);
});
```

**✅ Good:**
```typescript
// Import runs once during setup
// npm run import:taxi
// Data stored in database

app.get('/api/taxi', (req, res) => {
  const pois = await db.pois.findWhere({ category: 'taxi' });
  res.json(pois);
});
```

### 3. Row-by-Row Inserts

**❌ Bad:**
```typescript
let inserted = 0;
for (const stand of TAXI_STANDS) {
  await db.insert(stand);
  inserted++;
  console.log(`Inserted ${inserted}/${TAXI_STANDS.length}`);
}
// 35 transactions, slow, rollback nightmare
```

**✅ Good:**
```typescript
// Single transaction
const result = await db.upsert(TAXI_STANDS);
console.log(`Imported ${result.count} records`);
```

### 4. Missing Error Handling

**❌ Bad:**
```typescript
const pois = TAXI_STANDS.map(stand => ({
  id: slugify(stand.name),
  name: stand.name,
  lat: stand.lat,
  lng: stand.lng,
}));
await supabase.from("pois").upsert(pois);
console.log("Done!");
```

**✅ Good:**
```typescript
// Check environment
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

// Check response
if (error) {
  console.error("Failed to import:", error.message);
  process.exit(1);
}

// Log results
console.log(`✓ Imported ${pois.length} taxi stands`);
```

### 5. Forgetting to Validate Coordinates

**❌ Bad:**
```typescript
const TAXI_STANDS = [
  { name: "Moholt Alle", lat: 63.411226, lng: 10.434267 },
  { name: "Invalid", lat: 999, lng: 999 }, // Oops!
];
```

**✅ Good:**
```typescript
// Validate on import
const pois = TAXI_STANDS.map(stand => {
  if (stand.lat < -90 || stand.lat > 90) {
    throw new Error(`Invalid latitude for ${stand.name}`);
  }
  if (stand.lng < -180 || stand.lng > 180) {
    throw new Error(`Invalid longitude for ${stand.name}`);
  }
  return { /* ... */ };
});
```

---

## Complete Checklist for External Data Imports

Use this before starting any import:

### Data Assessment
- [ ] Data source identified and documented
- [ ] Update frequency understood
- [ ] Terms of service reviewed (copyright, licensing)
- [ ] File size measured
- [ ] Format determined (API/KMZ/JSON/other)

### Implementation Approach
- [ ] Decision made: hardcode vs. import script vs. API
- [ ] No unnecessary dependencies added
- [ ] Batch operations planned (no row-by-row)
- [ ] ID generation scheme documented
- [ ] Category/relationship entities ensured first

### Code Quality
- [ ] Source URL and last-update date in comments
- [ ] Coordinate validation included
- [ ] Error handling with clear messages
- [ ] Environment variable checks
- [ ] Idempotency verified (safe to re-run)
- [ ] Helpful output logged to console

### Documentation
- [ ] Source URL documented
- [ ] Last updated date recorded
- [ ] Update frequency noted
- [ ] Maintenance instructions clear
- [ ] Data license/attribution included

### Testing
- [ ] Import can be re-run without duplication
- [ ] Coordinates validated (lat/lng in bounds)
- [ ] Relationships (categories) preserved
- [ ] Record counts correct
- [ ] Data appears correctly on map/in UI

---

## Specific Patterns by Use Case

### Pattern 1: One-Time Static Import (Like Taxi Stands)

**Data:** Government dataset, rarely changes, < 100 points

**Approach:**
1. Extract data from source (KMZ → JSON → TS array)
2. Hardcode in `scripts/import-{name}.ts`
3. Run: `npm run import:{name}`
4. Commit script to git (with source URL)
5. Document: "Last updated Oct 2024, update quarterly"

**Example file:**
```
scripts/import-taxi-stands.ts
├── TAXI_STANDS array (lines 18-54)
├── Data source URL (line 4)
├── Last updated date (line 6)
├── Batch upsert (lines 102-105)
└── Clear error handling (lines 86-89)
```

### Pattern 2: Recurring Scheduled Import

**Data:** Updates monthly, 100-500 points, still static file

**Approach:**
1. Create import script (like Pattern 1)
2. Add to COMMANDS.md with execution instructions
3. Set up cron job or manual monthly update
4. Script validates and reports changes
5. Changes tracked in git history

**Enhancement:**
```typescript
// Track what changed
const stats = {
  totalImported: pois.length,
  newRecords: added.length,
  updatedRecords: updated.length,
  removedRecords: removed.length,
};
console.log("Import stats:", stats);
```

### Pattern 3: Live API Integration

**Data:** Real-time, high update frequency, official API

**Approach:**
1. Do NOT import; call API at runtime
2. Add caching strategy (see `placy-concept-spec.md`)
3. Handle rate limits gracefully
4. Add fallback for API downtime

**Example:**
```typescript
// Cache API responses
// Entur: No cache (real-time)
// Google Places: 24-hour cache
// Bysykkel: 1-minute cache
```

### Pattern 4: User-Initiated Import (Admin UI)

**Data:** User uploads file or specifies parameters

**Approach:**
1. Validate file before processing
2. Dry-run: show user what will be imported
3. Confirm before executing
4. Show progress during import
5. Report results with statistics

**Example:**
```typescript
// Admin would:
// 1. Click "Import POIs"
// 2. Upload KMZ/JSON file
// 3. See preview of 35 records
// 4. Confirm "Import"
// 5. See "✓ Imported 35 taxi stands"
```

---

## Tools and Commands Reference

### Working with KMZ Files

KMZ is a ZIP archive containing KML (XML) files.

```bash
# Extract KMZ to KML
unzip Taxiholdeplasser.kmz

# View KML structure (XML)
cat doc.kml | head -100

# Extract coordinates using grep/awk
grep -oP '<coordinates>\K[^<]+' doc.kml

# Convert to JSON using Python
python3 -c "
import zipfile, xml.etree.ElementTree as ET
with zipfile.ZipFile('Taxiholdeplasser.kmz') as z:
    kml = ET.parse(z.open('doc.kml'))
    root = kml.getroot()
    # Parse placemark elements
"
```

### Testing Coordinates

```bash
# Validate coordinates are in Norway bounds
# Latitude: 58-72°N
# Longitude: 4-32°E

# Using jq (JSON processor)
jq '.[] | select(.lat < 58 or .lat > 72) | "Invalid:" + .name' taxi.json

# Using TypeScript validation
if (lat < 58 || lat > 72 || lng < 4 || lng > 32) {
  throw new Error(`Invalid coordinates for ${name}`);
}
```

### Batch Operations in Supabase

```typescript
// Upsert with conflict handling
const { error } = await supabase
  .from("table")
  .upsert(records, { onConflict: "id" });

// Insert with error on conflict
const { error } = await supabase
  .from("table")
  .insert(records);

// Update only if exists
const { error } = await supabase
  .from("table")
  .update(changes)
  .eq("id", recordId);
```

---

## Future Maintenance

### When to Update

- Yearly for static government data
- Quarterly for moderately changing data
- Monthly for frequently updated data
- Never hardcode data that changes weekly

### How to Update

1. Download new source file
2. Extract coordinates (or re-run if script exists)
3. Update the array/data file
4. Run import script
5. Verify counts and spot-check locations
6. Commit with message: `data: update taxi stands (Nov 2024)`

### Communication

When updating, document:
```typescript
// Last updated: November 2024
// Source: https://www.trondheim.kommune.no/parkering/innhold/parkere/taxi/
// Update frequency: Yearly (expected next update Nov 2025)
// Total records: 35
// Last change: Added "Cluster downtown" in Sept 2024
```

---

## Related Documentation

- `CLAUDE.md` - Project context and POI system overview
- `context/placy-concept-spec.md` - Full POI data model
- `lib/types.ts` - TypeScript interfaces (POI, Category, etc.)
- `lib/generators/poi-discovery.ts` - Auto-discovery from Google/Entur
- `COMMANDS.md` - Available scripts and how to run

---

## Summary: The Golden Rules

1. **Assess first** - Know your data before building
2. **Keep it simple** - No dependencies unless necessary
3. **Batch operations** - Never insert row-by-row
4. **Pre-extract static data** - Smaller footprint, easier review
5. **Document thoroughly** - Future maintainers will thank you
6. **Make it idempotent** - Safe to re-run anytime
7. **Validate always** - Check coordinates and required fields
8. **Handle errors** - Clear messages, proper exit codes

---

*Last updated: January 2026*
*Based on: `scripts/import-taxi-stands.ts` implementation*
