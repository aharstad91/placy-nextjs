/**
 * Fetch Google Photos for POIs and persist as featured_image.
 *
 * Strategy: Call Google Places Details to get photo references,
 * then store a proxy URL as featured_image on the POI.
 * The proxy (/api/places/photo) handles API key and caching.
 */

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
          // Fetch place details from Google Places API directly
          const placeUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${poi.google_place_id}&fields=photos&key=${googleApiKey}`;
          const placeRes = await fetch(placeUrl);

          if (!placeRes.ok) {
            result.failed++;
            result.errors.push(`${poi.name}: Places API ${placeRes.status}`);
            return;
          }

          const placeData = await placeRes.json();

          if (placeData.status !== "OK" || !placeData.result?.photos?.length) {
            result.failed++;
            result.errors.push(`${poi.name}: No photos available`);
            return;
          }

          const photoRef = placeData.result.photos[0].photo_reference;
          const featuredImage = `/api/places/photo?photoReference=${photoRef}&maxWidth=800`;

          // Update POI in Supabase
          const patchRes = await fetch(
            `${supabaseUrl}/rest/v1/pois?id=eq.${poi.id}`,
            {
              method: "PATCH",
              headers: { ...headers, Prefer: "return=minimal" },
              body: JSON.stringify({
                photo_reference: photoRef,
                featured_image: featuredImage,
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
