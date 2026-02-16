/**
 * Batch-resolve Google Places photo proxy URLs to direct CDN URLs.
 *
 * Replaces `/api/places/photo?photoReference=...` in featured_image
 * with direct `lh3.googleusercontent.com` URLs.
 *
 * Usage: npx tsx scripts/resolve-photo-urls.ts
 *
 * Idempotent — skips POIs that already have CDN URLs.
 * Safe to re-run.
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
  featured_image: string | null;
  photo_reference: string | null;
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

function extractPhotoReference(poi: POIRow): string | null {
  // Try photo_reference column first
  if (poi.photo_reference) return poi.photo_reference;

  // Extract from proxy URL in featured_image
  if (poi.featured_image?.startsWith("/api/places/photo")) {
    const match = poi.featured_image.match(/photoReference=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
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
  const query = `${SUPABASE_URL}/rest/v1/pois?select=id,name,featured_image,photo_reference&or=(featured_image.like./api/places/photo%25,and(photo_reference.not.is.null,featured_image.is.null))&order=name`;

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
        const photoRef = extractPhotoReference(poi);
        if (!photoRef) {
          console.log(`  SKIP ${poi.name} — no photo reference found`);
          skipped++;
          return;
        }

        const result = await resolvePhotoUrl(photoRef);

        if (result.status === "ok" && result.url) {
          // Update featured_image with CDN URL and mark resolve timestamp
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
            resolved++;
            console.log(`  OK   ${poi.name}`);
          } else {
            errors++;
            console.log(`  ERR  ${poi.name} — DB update failed: ${patchRes.status}`);
          }
        } else if (result.status === "expired") {
          // Null out expired photo_reference and stale featured_image
          const expPatchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/pois?id=eq.${poi.id}`,
            {
              method: "PATCH",
              headers: { ...headers, Prefer: "return=minimal" },
              body: JSON.stringify({
                photo_reference: null,
                photo_resolved_at: null,
                ...(poi.featured_image?.startsWith("/api/places/photo")
                  ? { featured_image: null }
                  : {}),
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
  console.log(`Resolved: ${resolved}`);
  console.log(`Expired:  ${expired}`);
  console.log(`Errors:   ${errors}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Total:    ${pois.length}`);
}

main().catch(console.error);
