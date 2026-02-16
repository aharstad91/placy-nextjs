/**
 * Refresh stale Google Places photo CDN URLs.
 *
 * Targets POIs where photo_resolved_at is older than the threshold
 * (default 14 days) and re-resolves their photo_reference to a fresh
 * lh3.googleusercontent.com URL.
 *
 * Usage: npx tsx scripts/refresh-photo-urls.ts [--days 14]
 *
 * Safe to re-run. Only touches POIs with existing photo_reference.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;

interface POIRow {
  id: string;
  name: string;
  photo_reference: string;
  featured_image: string | null;
  photo_resolved_at: string | null;
}

async function resolvePhotoUrl(
  photoReference: string,
  maxWidth = 800
): Promise<{ url: string | null; status: "ok" | "expired" | "error" }> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url, { redirect: "manual" });

    if (res.status === 302) {
      const location = res.headers.get("location");
      if (location?.includes("googleusercontent.com")) {
        return { url: location, status: "ok" };
      }
    }

    if (res.status === 400 || res.status === 404) {
      return { url: null, status: "expired" };
    }

    return { url: null, status: "error" };
  } catch {
    return { url: null, status: "error" };
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GOOGLE_API_KEY) {
    console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY");
    process.exit(1);
  }

  // Parse --days argument (default 14)
  const daysArg = process.argv.indexOf("--days");
  const rawDays = daysArg !== -1 ? parseInt(process.argv[daysArg + 1], 10) : 14;
  const staleDays = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 14;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);
  const cutoffISO = cutoff.toISOString();

  console.log(`Refreshing photo URLs older than ${staleDays} days (before ${cutoffISO})\n`);

  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  // Fetch POIs with stale or missing photo_resolved_at that have a photo_reference
  const query = `${SUPABASE_URL}/rest/v1/pois?select=id,name,photo_reference,featured_image,photo_resolved_at&photo_reference=not.is.null&or=(photo_resolved_at.is.null,photo_resolved_at.lt.${cutoffISO})&order=name`;

  const res = await fetch(query, { headers });
  if (!res.ok) {
    console.error(`Failed to fetch POIs: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const pois: POIRow[] = await res.json();
  console.log(`Found ${pois.length} POIs to refresh\n`);

  if (pois.length === 0) {
    console.log("All photo URLs are fresh!");
    return;
  }

  let refreshed = 0;
  let expired = 0;
  let errors = 0;

  for (let i = 0; i < pois.length; i += BATCH_SIZE) {
    const batch = pois.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (poi) => {
        const result = await resolvePhotoUrl(poi.photo_reference);

        if (result.status === "ok" && result.url) {
          const patchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/pois?id=eq.${poi.id}`,
            {
              method: "PATCH",
              headers: { ...headers, Prefer: "return=minimal" },
              body: JSON.stringify({
                featured_image: result.url,
                photo_resolved_at: new Date().toISOString(),
              }),
            }
          );

          if (patchRes.ok) {
            refreshed++;
            console.log(`  OK   ${poi.name}`);
          } else {
            errors++;
            console.log(`  ERR  ${poi.name} — DB update failed: ${patchRes.status}`);
          }
        } else if (result.status === "expired") {
          // Null out expired reference and stale CDN URL
          const expPatchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/pois?id=eq.${poi.id}`,
            {
              method: "PATCH",
              headers: { ...headers, Prefer: "return=minimal" },
              body: JSON.stringify({
                photo_reference: null,
                photo_resolved_at: null,
                featured_image: null,
              }),
            }
          );

          if (expPatchRes.ok) {
            expired++;
            console.log(`  EXP  ${poi.name} — photo reference expired, nulled out`);
          } else {
            errors++;
            console.log(`  ERR  ${poi.name} — failed to null expired reference: ${expPatchRes.status}`);
          }
        } else {
          errors++;
          console.log(`  ERR  ${poi.name} — resolve failed`);
        }
      })
    );

    const progress = Math.min(i + BATCH_SIZE, pois.length);
    console.log(`\n--- Batch done: ${progress}/${pois.length} ---\n`);

    if (i + BATCH_SIZE < pois.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Refreshed: ${refreshed}`);
  console.log(`Expired:   ${expired}`);
  console.log(`Errors:    ${errors}`);
  console.log(`Total:     ${pois.length}`);
}

main().catch(console.error);
