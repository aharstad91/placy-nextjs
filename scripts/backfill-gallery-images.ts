/**
 * Backfill gallery_images for POIs that have a google_place_id.
 *
 * Uses Places API (New) — $0/unlimited for photo operations.
 * Fetches up to 3 photos, resolves to CDN URLs, stores in gallery_images[].
 *
 * Usage: npx tsx scripts/backfill-gallery-images.ts [--area trondheim]
 *
 * Idempotent — skips POIs that already have gallery_images.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { fetchPhotoNames, resolvePhotoUri } from "../lib/google-places/photo-api";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const GALLERY_SIZE = 3;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;

interface POIRow {
  id: string;
  name: string;
  google_place_id: string;
  gallery_images: string[] | null;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GOOGLE_API_KEY) {
    console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY");
    process.exit(1);
  }

  // Parse --area flag
  const areaIdx = process.argv.indexOf("--area");
  const areaSlug = areaIdx !== -1 ? process.argv[areaIdx + 1] : null;

  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  // Build query — POIs with google_place_id but no gallery_images
  let queryUrl = `${SUPABASE_URL}/rest/v1/pois?select=id,name,google_place_id,gallery_images&google_place_id=not.is.null&or=(gallery_images.is.null,gallery_images.eq.{})&order=name`;

  if (areaSlug) {
    // Look up area ID first
    const areaRes = await fetch(
      `${SUPABASE_URL}/rest/v1/areas?slug_no=eq.${areaSlug}&select=id`,
      { headers }
    );
    const areas = await areaRes.json();
    if (!areas?.length) {
      console.error(`Area not found: ${areaSlug}`);
      process.exit(1);
    }
    queryUrl += `&area_id=eq.${areas[0].id}`;
  }

  const res = await fetch(queryUrl, { headers });
  if (!res.ok) {
    console.error(`Failed to fetch POIs: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const pois: POIRow[] = await res.json();
  console.log(`Found ${pois.length} POIs to backfill${areaSlug ? ` in ${areaSlug}` : ""}\n`);

  if (pois.length === 0) {
    console.log("Nothing to do!");
    return;
  }

  let updated = 0;
  let noPhotos = 0;
  let errors = 0;

  for (let i = 0; i < pois.length; i += BATCH_SIZE) {
    const batch = pois.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (poi) => {
        try {
          // Fetch photo names via Places API (New) — $0
          const photoNames = await fetchPhotoNames(poi.google_place_id, GOOGLE_API_KEY);

          if (photoNames.length === 0) {
            noPhotos++;
            console.log(`  SKIP ${poi.name} — no photos available`);
            return;
          }

          // Resolve up to GALLERY_SIZE photos to CDN URLs
          const resolvedUrls: string[] = [];
          for (let j = 0; j < Math.min(GALLERY_SIZE, photoNames.length); j++) {
            const maxWidth = j === 0 ? 800 : 400;
            const cdnUrl = await resolvePhotoUri(photoNames[j], GOOGLE_API_KEY, maxWidth);
            if (cdnUrl) {
              resolvedUrls.push(cdnUrl);
            }
          }

          if (resolvedUrls.length === 0) {
            errors++;
            console.log(`  ERR  ${poi.name} — all photo resolves failed`);
            return;
          }

          // Update gallery_images in Supabase
          const patchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/pois?id=eq.${poi.id}`,
            {
              method: "PATCH",
              headers: { ...headers, Prefer: "return=minimal" },
              body: JSON.stringify({ gallery_images: resolvedUrls }),
            }
          );

          if (patchRes.ok) {
            updated++;
            console.log(`  OK   ${poi.name} — ${resolvedUrls.length} images`);
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

    const progress = Math.min(i + BATCH_SIZE, pois.length);
    console.log(`\n--- Batch done: ${progress}/${pois.length} ---\n`);

    if (i + BATCH_SIZE < pois.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Updated:   ${updated}`);
  console.log(`No photos: ${noPhotos}`);
  console.log(`Errors:    ${errors}`);
  console.log(`Total:     ${pois.length}`);
}

main().catch(console.error);
