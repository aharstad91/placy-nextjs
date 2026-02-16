/**
 * Refresh stale Google Places photo CDN URLs.
 *
 * Uses Places API (New) — $0/unlimited for photo operations.
 * Targets POIs where photo_resolved_at is older than the threshold
 * (default 14 days) and re-resolves their photo_reference to a fresh
 * lh3.googleusercontent.com URL.
 *
 * Handles both formats:
 * - New: "places/{placeId}/photos/{ref}" → resolve directly via New API
 * - Legacy: opaque string → re-fetch via google_place_id, migrate to new format
 *
 * Usage: npx tsx scripts/refresh-photo-urls.ts [--days 14]
 *
 * Safe to re-run. Only touches POIs with existing photo_reference.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  fetchPhotoNames,
  resolvePhotoUri,
  isNewPhotoFormat,
} from "../lib/google-places/photo-api";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;

interface POIRow {
  id: string;
  name: string;
  google_place_id: string | null;
  photo_reference: string;
  featured_image: string | null;
  photo_resolved_at: string | null;
}

async function updatePoi(
  poiId: string,
  headers: Record<string, string>,
  data: Record<string, unknown>,
) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pois?id=eq.${poiId}`,
    {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    throw new Error(`DB update failed: ${res.status}`);
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
  const query = `${SUPABASE_URL}/rest/v1/pois?select=id,name,google_place_id,photo_reference,featured_image,photo_resolved_at&photo_reference=not.is.null&or=(photo_resolved_at.is.null,photo_resolved_at.lt.${cutoffISO})&order=name`;

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
  let migrated = 0;
  let expired = 0;
  let errors = 0;

  for (let i = 0; i < pois.length; i += BATCH_SIZE) {
    const batch = pois.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (poi) => {
        try {
          // New format: resolve directly
          if (isNewPhotoFormat(poi.photo_reference)) {
            const cdnUrl = await resolvePhotoUri(poi.photo_reference, GOOGLE_API_KEY, 800);
            if (cdnUrl) {
              await updatePoi(poi.id, headers, {
                featured_image: cdnUrl,
                photo_resolved_at: new Date().toISOString(),
              });
              refreshed++;
              console.log(`  OK   ${poi.name}`);
            } else {
              // Photo name no longer valid — null out
              await updatePoi(poi.id, headers, {
                photo_reference: null,
                photo_resolved_at: null,
                featured_image: null,
              });
              expired++;
              console.log(`  EXP  ${poi.name} — photo no longer available`);
            }
            return;
          }

          // Legacy format — re-fetch via google_place_id to migrate
          if (!poi.google_place_id) {
            errors++;
            console.log(`  ERR  ${poi.name} — legacy format, no google_place_id to migrate`);
            return;
          }

          const photoNames = await fetchPhotoNames(poi.google_place_id, GOOGLE_API_KEY);
          if (photoNames.length === 0) {
            await updatePoi(poi.id, headers, {
              photo_reference: null,
              photo_resolved_at: null,
              featured_image: null,
            });
            expired++;
            console.log(`  EXP  ${poi.name} — no photos from New API, nulled out`);
            return;
          }

          const cdnUrl = await resolvePhotoUri(photoNames[0], GOOGLE_API_KEY, 800);
          if (cdnUrl) {
            await updatePoi(poi.id, headers, {
              photo_reference: photoNames[0],
              featured_image: cdnUrl,
              photo_resolved_at: new Date().toISOString(),
            });
            migrated++;
            console.log(`  OK   ${poi.name} (migrated to new format)`);
          } else {
            errors++;
            console.log(`  ERR  ${poi.name} — resolve failed`);
          }
        } catch (err) {
          errors++;
          console.log(`  ERR  ${poi.name} — ${err instanceof Error ? err.message : String(err)}`);
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
  console.log(`Migrated:  ${migrated}`);
  console.log(`Expired:   ${expired}`);
  console.log(`Errors:    ${errors}`);
  console.log(`Total:     ${pois.length}`);
}

main().catch(console.error);
