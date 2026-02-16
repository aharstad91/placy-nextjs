/**
 * Fetch Google Photos for POIs and persist as featured_image.
 *
 * Uses Places API (New) — $0/unlimited for photo operations.
 * fetchPhotoNames → resolvePhotoUri → store CDN URLs directly.
 */

import { fetchPhotoNames, resolvePhotoUri } from "@/lib/google-places/photo-api";

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 500;

interface FetchResult {
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface POIRow {
  id: string;
  name: string;
  google_place_id: string | null;
  featured_image: string | null;
}

/**
 * Fetch and persist Google Photos for POIs in a project.
 *
 * Only targets POIs with google_place_id and without featured_image.
 * Batches requests to avoid rate limiting.
 */
export async function fetchAndCachePOIPhotos(
  projectId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  googleApiKey: string,
  onProgress?: (current: number, total: number, poiName: string) => void
): Promise<FetchResult> {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  // 1. Get all POIs for this project that need photos
  const poisRes = await fetch(
    `${supabaseUrl}/rest/v1/project_pois?project_id=eq.${projectId}&select=poi_id,pois(id,name,google_place_id,featured_image)`,
    { headers }
  );

  if (!poisRes.ok) {
    throw new Error(`Failed to fetch project POIs: ${poisRes.status}`);
  }

  const projectPois = await poisRes.json();

  // Extract POIs that need photos
  const needsPhoto: POIRow[] = [];
  for (const pp of projectPois) {
    const poi = pp.pois as POIRow | null;
    if (poi && poi.google_place_id && !poi.featured_image) {
      needsPhoto.push(poi);
    }
  }

  const result: FetchResult = {
    updated: 0,
    skipped: projectPois.length - needsPhoto.length,
    failed: 0,
    errors: [],
  };

  if (needsPhoto.length === 0) {
    return result;
  }

  // 2. Process in batches
  for (let i = 0; i < needsPhoto.length; i += BATCH_SIZE) {
    const batch = needsPhoto.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (poi, batchIdx) => {
        const idx = i + batchIdx;
        onProgress?.(idx + 1, needsPhoto.length, poi.name);

        try {
          // Fetch photo names via Places API (New) — $0
          const photoNames = await fetchPhotoNames(poi.google_place_id!, googleApiKey);

          if (photoNames.length === 0) {
            result.failed++;
            result.errors.push(`${poi.name}: No photos available`);
            return;
          }

          // Resolve featured image (first photo, 800px)
          const featuredImage = await resolvePhotoUri(photoNames[0], googleApiKey, 800);
          if (!featuredImage) {
            result.failed++;
            result.errors.push(`${poi.name}: Failed to resolve featured image`);
            return;
          }

          // Resolve up to 3 gallery images (reuse featured as first)
          const galleryImages: string[] = [featuredImage];
          for (let g = 1; g < Math.min(3, photoNames.length); g++) {
            const cdnUrl = await resolvePhotoUri(photoNames[g], googleApiKey, 400);
            if (cdnUrl) {
              galleryImages.push(cdnUrl);
            }
          }

          // Update POI in Supabase — store new-format photo name
          const patchRes = await fetch(
            `${supabaseUrl}/rest/v1/pois?id=eq.${poi.id}`,
            {
              method: "PATCH",
              headers: { ...headers, Prefer: "return=minimal" },
              body: JSON.stringify({
                photo_reference: photoNames[0],
                featured_image: featuredImage,
                photo_resolved_at: new Date().toISOString(),
                ...(galleryImages.length > 0 ? { gallery_images: galleryImages } : {}),
              }),
            }
          );

          if (!patchRes.ok) {
            result.failed++;
            result.errors.push(`${poi.name}: DB update failed ${patchRes.status}`);
            return;
          }

          result.updated++;
        } catch (err) {
          result.failed++;
          result.errors.push(`${poi.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      })
    );

    // Delay between batches to avoid rate limits
    if (i + BATCH_SIZE < needsPhoto.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return result;
}
