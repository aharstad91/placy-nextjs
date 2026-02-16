/**
 * Batch-resolve Google Places photo proxy URLs to direct CDN URLs.
 *
 * Uses Places API (New) — $0/unlimited for photo operations.
 * Replaces `/api/places/photo?photoReference=...` in featured_image
 * with direct `lh3.googleusercontent.com` URLs.
 * Also re-fetches POIs that have photo_reference but no featured_image.
 *
 * For legacy photo_references, re-fetches via google_place_id to migrate
 * to new-format photo names automatically.
 *
 * Usage: npx tsx scripts/resolve-photo-urls.ts
 *
 * Idempotent — skips POIs that already have CDN URLs.
 * Safe to re-run.
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
  featured_image: string | null;
  photo_reference: string | null;
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

  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  // Fetch POIs that need resolving:
  // 1. featured_image starts with /api/places/photo (proxy URL)
  // 2. OR photo_reference is set but featured_image is null
  const query = `${SUPABASE_URL}/rest/v1/pois?select=id,name,google_place_id,featured_image,photo_reference&or=(featured_image.like./api/places/photo%25,and(photo_reference.not.is.null,featured_image.is.null))&order=name`;

  const res = await fetch(query, { headers });
  if (!res.ok) {
    console.error(`Failed to fetch POIs: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const pois: POIRow[] = await res.json();
  console.log(`Found ${pois.length} POIs to resolve\n`);

  if (pois.length === 0) {
    console.log("Nothing to do!");
    return;
  }

  let resolved = 0;
  let expired = 0;
  let errors = 0;
  let skipped = 0;

  for (let i = 0; i < pois.length; i += BATCH_SIZE) {
    const batch = pois.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (poi) => {
        try {
          const photoRef = poi.photo_reference ?? extractPhotoRefFromUrl(poi.featured_image);

          // If we have a new-format photo name, resolve directly
          if (photoRef && isNewPhotoFormat(photoRef)) {
            const cdnUrl = await resolvePhotoUri(photoRef, GOOGLE_API_KEY, 800);
            if (cdnUrl) {
              await updatePoi(poi.id, headers, {
                featured_image: cdnUrl,
                photo_resolved_at: new Date().toISOString(),
              });
              resolved++;
              console.log(`  OK   ${poi.name} (new format)`);
            } else {
              errors++;
              console.log(`  ERR  ${poi.name} — resolve failed`);
            }
            return;
          }

          // Legacy format — re-fetch via google_place_id using New API
          if (!poi.google_place_id) {
            skipped++;
            console.log(`  SKIP ${poi.name} — no google_place_id`);
            return;
          }

          const photoNames = await fetchPhotoNames(poi.google_place_id, GOOGLE_API_KEY);
          if (photoNames.length === 0) {
            await updatePoi(poi.id, headers, {
              photo_reference: null,
              photo_resolved_at: null,
              ...(poi.featured_image?.startsWith("/api/places/photo")
                ? { featured_image: null }
                : {}),
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
            resolved++;
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
  console.log(`Resolved: ${resolved}`);
  console.log(`Expired:  ${expired}`);
  console.log(`Errors:   ${errors}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Total:    ${pois.length}`);
}

function extractPhotoRefFromUrl(url: string | null): string | null {
  if (!url?.startsWith("/api/places/photo")) return null;
  const match = url.match(/photoReference=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

main().catch(console.error);
