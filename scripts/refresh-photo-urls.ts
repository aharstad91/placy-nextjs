/**
 * Refresh stale Google Places photo CDN URLs.
 *
 * Uses Places API (New) — $0/unlimited for photo operations.
 * Targets POIs where photo_resolved_at is older than the threshold
 * (default 14 days) and re-resolves their stored photos to fresh
 * lh3.googleusercontent.com URLs.
 *
 * Dekker TO kolonne-sett per POI (begge stemples med `photo_resolved_at`):
 *   1. `photo_reference` → `featured_image` (hero-bildet)
 *      - Nytt format: "places/{placeId}/photos/{ref}" → resolves direkte
 *      - Legacy: opak streng → hentes på nytt via google_place_id og migreres
 *   2. `gallery_images[]` → hele galleriet, hentet på nytt via google_place_id
 *
 * HVORFOR GALLERIET MÅTTE MED (2026-08-12): `backfill-gallery-images.ts` skriver
 * `gallery_images` og stempler `photo_resolved_at`, men dette scriptet så
 * tidligere KUN på `photo_reference`. Galleri-URL-ene råtnet derfor uten at noe
 * kunne fornye dem, og stempelet var pynt. Galleriet har ingen egen
 * referanse-kolonne (kun én `photo_reference`-tekstkolonne finnes), så navnene
 * hentes på nytt via `fetchPhotoNames` — som er $0 på Essentials-nivået.
 *
 * Usage: npx tsx scripts/refresh-photo-urls.ts [--days 14]
 *
 * Safe to re-run. Touches only POIs that already have photo_reference or
 * gallery_images.
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

const GALLERY_SIZE = 3;

interface POIRow {
  id: string;
  name: string;
  google_place_id: string | null;
  photo_reference: string | null;
  featured_image: string | null;
  gallery_images: string[] | null;
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
      headers: { ...headers, Prefer: "return=minimal", "Content-Profile": "v2" },
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
  const staleDays = Number.isFinite(rawDays) && rawDays >= 0 ? rawDays : 14;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);
  const cutoffISO = cutoff.toISOString();

  console.log(`Refreshing photo URLs older than ${staleDays} days (before ${cutoffISO})\n`);

  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    "Accept-Profile": "v2",
  };

  // POI-er med utløpt/manglende photo_resolved_at som har ENTEN photo_reference
  // ELLER gallery_images. Nestet and/or fordi to `or=`-parametre ville kollidert
  // på samme nøkkel.
  const query =
    `${SUPABASE_URL}/rest/v1/pois?select=id,name,google_place_id,photo_reference,featured_image,gallery_images,photo_resolved_at` +
    `&and=(or(photo_resolved_at.is.null,photo_resolved_at.lt.${cutoffISO}),or(photo_reference.not.is.null,gallery_images.not.is.null))` +
    `&order=name`;

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
  let galleries = 0;
  let expired = 0;
  let errors = 0;

  for (let i = 0; i < pois.length; i += BATCH_SIZE) {
    const batch = pois.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (poi) => {
        // Én PATCH per POI. Hero og galleri kan begge trenge fornying, og to
        // separate PATCH-er ville gitt to `photo_resolved_at`-stempler og en
        // halvskrevet rad hvis den andre feilet.
        const patch: Record<string, unknown> = {};
        const notes: string[] = [];

        try {
          // ── Hero-bildet: photo_reference → featured_image ──
          if (poi.photo_reference) {
            if (isNewPhotoFormat(poi.photo_reference)) {
              const cdnUrl = await resolvePhotoUri(poi.photo_reference, GOOGLE_API_KEY, 800);
              if (cdnUrl) {
                patch.featured_image = cdnUrl;
                refreshed++;
                notes.push("hero");
              } else {
                // 404 fra Google = bildet finnes genuint ikke lenger. (Transiente
                // feil kaster nå i resolvePhotoUri og havner i catch-en under,
                // så vi sletter ikke data på en rate limit.)
                patch.photo_reference = null;
                patch.featured_image = null;
                expired++;
                notes.push("hero utløpt");
              }
            } else if (!poi.google_place_id) {
              errors++;
              console.log(`  ERR  ${poi.name} — legacy format, no google_place_id to migrate`);
            } else {
              // Legacy format — hent på nytt via google_place_id og migrer
              const photoNames = await fetchPhotoNames(poi.google_place_id, GOOGLE_API_KEY);
              if (photoNames.length === 0) {
                patch.photo_reference = null;
                patch.featured_image = null;
                expired++;
                notes.push("hero utløpt");
              } else {
                const cdnUrl = await resolvePhotoUri(photoNames[0], GOOGLE_API_KEY, 800);
                if (cdnUrl) {
                  patch.photo_reference = photoNames[0];
                  patch.featured_image = cdnUrl;
                  migrated++;
                  notes.push("hero migrert");
                } else {
                  errors++;
                  notes.push("hero resolve feilet");
                }
              }
            }
          }

          // ── Galleriet: gallery_images[] ──
          // Galleriet har ingen egen referanse-kolonne, så navnene hentes på nytt
          // via google_place_id ($0 på Essentials-nivået).
          if (poi.gallery_images && poi.gallery_images.length > 0) {
            if (!poi.google_place_id) {
              errors++;
              notes.push("galleri: ingen google_place_id");
            } else {
              const names = await fetchPhotoNames(poi.google_place_id, GOOGLE_API_KEY);
              const urls: string[] = [];
              for (let j = 0; j < Math.min(GALLERY_SIZE, names.length); j++) {
                const url = await resolvePhotoUri(names[j], GOOGLE_API_KEY, j === 0 ? 800 : 400);
                if (url) urls.push(url);
              }
              if (urls.length > 0) {
                patch.gallery_images = urls;
                galleries++;
                notes.push(`galleri ${urls.length} bilder`);
              } else {
                // Ingen bilder igjen hos Google → tom kolonne er riktig svar.
                patch.gallery_images = null;
                expired++;
                notes.push("galleri utløpt");
              }
            }
          }

          if (Object.keys(patch).length === 0) {
            if (notes.length > 0) console.log(`  ERR  ${poi.name} — ${notes.join(", ")}`);
            return;
          }

          // Stempelet settes bare når noe faktisk ble fornyet. Ble ALT nullet ut,
          // er det ingenting å holde ferskt — da nulles stempelet også, slik at
          // POI-en ikke plukkes opp igjen hver kjøring.
          const allNulled = Object.values(patch).every((v) => v === null);
          patch.photo_resolved_at = allNulled ? null : new Date().toISOString();

          await updatePoi(poi.id, headers, patch);
          console.log(`  OK   ${poi.name} — ${notes.join(", ")}`);
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
  console.log(`Galleries: ${galleries}`);
  console.log(`Expired:   ${expired}`);
  console.log(`Errors:    ${errors}`);
  console.log(`Total:     ${pois.length}`);
}

main().catch(console.error);
