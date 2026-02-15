/**
 * Batch-refresh opening hours and phone numbers from Google Places.
 *
 * Fetches opening_hours + formatted_phone_number for all POIs with
 * google_place_id and stores the result in Supabase.
 *
 * Usage: npx tsx scripts/refresh-opening-hours.ts
 *
 * Run monthly or as needed. Safe to re-run (overwrites with fresh data).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;

interface POIRow {
  id: string;
  name: string;
  google_place_id: string;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GOOGLE_API_KEY) {
    console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY");
    process.exit(1);
  }

  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  // Fetch all POIs with google_place_id (paginated)
  const allPois: POIRow[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/pois?select=id,name,google_place_id&google_place_id=not.is.null&order=name&offset=${offset}&limit=${pageSize}`,
      { headers }
    );
    if (!res.ok) {
      console.error(`Failed to fetch POIs: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    const page: POIRow[] = await res.json();
    allPois.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`Found ${allPois.length} POIs with google_place_id\n`);

  if (allPois.length === 0) {
    console.log("Nothing to do!");
    return;
  }

  let updated = 0;
  let noHours = 0;
  let errors = 0;

  for (let i = 0; i < allPois.length; i += BATCH_SIZE) {
    const batch = allPois.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (poi) => {
        try {
          const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${poi.google_place_id}&fields=opening_hours,formatted_phone_number&key=${GOOGLE_API_KEY}`;
          const res = await fetch(url);

          if (!res.ok) {
            errors++;
            console.log(`  ERR  ${poi.name} — Google API ${res.status}`);
            return;
          }

          const data = await res.json();

          if (data.status !== "OK" || !data.result) {
            noHours++;
            console.log(`  SKIP ${poi.name} — no data from Google`);
            return;
          }

          const place = data.result;
          const openingHoursJson = place.opening_hours?.weekday_text
            ? { weekday_text: place.opening_hours.weekday_text }
            : null;
          const phone = place.formatted_phone_number || null;

          const patchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/pois?id=eq.${poi.id}`,
            {
              method: "PATCH",
              headers: { ...headers, Prefer: "return=minimal" },
              body: JSON.stringify({
                opening_hours_json: openingHoursJson,
                google_phone: phone,
                opening_hours_updated_at: new Date().toISOString(),
              }),
            }
          );

          if (patchRes.ok) {
            updated++;
            const hasHours = openingHoursJson ? "hours" : "no-hours";
            const hasPhone = phone ? "phone" : "no-phone";
            console.log(`  OK   ${poi.name} [${hasHours}, ${hasPhone}]`);
          } else {
            errors++;
            console.log(`  ERR  ${poi.name} — DB update failed: ${patchRes.status}`);
          }
        } catch (err) {
          errors++;
          console.log(`  ERR  ${poi.name} — ${err instanceof Error ? err.message : String(err)}`);
        }
      })
    );

    const progress = Math.min(i + BATCH_SIZE, allPois.length);
    console.log(`\n--- Batch done: ${progress}/${allPois.length} ---\n`);

    if (i + BATCH_SIZE < allPois.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Updated:  ${updated}`);
  console.log(`No data:  ${noHours}`);
  console.log(`Errors:   ${errors}`);
  console.log(`Total:    ${allPois.length}`);
}

main().catch(console.error);
