/**
 * Reusable POI import pipeline
 *
 * Extracts the core import logic from app/api/admin/import/route.ts
 * so it can be called from CLI scripts, server actions, or API routes.
 */

import { revalidatePath } from "next/cache";
import {
  discoverGooglePlaces,
  discoverEnturStops,
  discoverBysykkelStations,
  DiscoveredPOI,
} from "@/lib/generators/poi-discovery";
import {
  upsertPOIsWithEditorialPreservation,
  upsertCategories,
  POIImportData,
} from "@/lib/supabase/mutations";
import { createServerClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface ExistingPOI {
  id: string;
  google_place_id: string | null;
  entur_stopplace_id: string | null;
  bysykkel_station_id: string | null;
}

export interface ImportPOIsResult {
  total: number;
  new: number;
  updated: number;
  byCategory: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helper functions (copied from route.ts to avoid mutating that file)
// ---------------------------------------------------------------------------

/** Calculate bounding box from center + radius */
function calculateBoundingBox(
  center: { lat: number; lng: number },
  radiusMeters: number
): BoundingBox {
  // Approximate: 1 degree latitude = 111.32 km
  const latDelta = radiusMeters / 111320;
  // Longitude varies with latitude
  const lngDelta =
    radiusMeters / (111320 * Math.cos((center.lat * Math.PI) / 180));

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/** Pre-fetch existing POIs in bounding box for O(1) deduplication */
async function fetchExistingPOIsInBoundingBox(
  bbox: BoundingBox
): Promise<ExistingPOI[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("pois")
    .select("id, google_place_id, entur_stopplace_id, bysykkel_station_id")
    .gte("lat", bbox.minLat)
    .lte("lat", bbox.maxLat)
    .gte("lng", bbox.minLng)
    .lte("lng", bbox.maxLng);

  return data || [];
}

/** Categorize POIs for insert vs update using O(1) lookup */
function categorizeForUpsert(
  discovered: DiscoveredPOI[],
  existing: ExistingPOI[]
) {
  // Build lookup maps for O(1) deduplication
  const byGoogleId = new Map(
    existing
      .filter((p) => p.google_place_id)
      .map((p) => [p.google_place_id, p])
  );
  const byEnturId = new Map(
    existing
      .filter((p) => p.entur_stopplace_id)
      .map((p) => [p.entur_stopplace_id, p])
  );
  const byBysykkelId = new Map(
    existing
      .filter((p) => p.bysykkel_station_id)
      .map((p) => [p.bysykkel_station_id, p])
  );

  const toInsert: DiscoveredPOI[] = [];
  const toUpdate: (DiscoveredPOI & { existingId: string })[] = [];
  const byCategory: Record<string, number> = {};

  for (const poi of discovered) {
    // Try to find existing POI by external ID
    const existingPoi =
      (poi.googlePlaceId && byGoogleId.get(poi.googlePlaceId)) ||
      (poi.enturStopplaceId && byEnturId.get(poi.enturStopplaceId)) ||
      (poi.bysykkelStationId && byBysykkelId.get(poi.bysykkelStationId));

    if (existingPoi) {
      toUpdate.push({ ...poi, existingId: existingPoi.id });
    } else {
      toInsert.push(poi);
    }

    // Count by category
    const catId = poi.category.id;
    byCategory[catId] = (byCategory[catId] || 0) + 1;
  }

  return {
    toInsert,
    toUpdate,
    stats: {
      total: discovered.length,
      byCategory,
      new: toInsert.length,
      updated: toUpdate.length,
    },
  };
}

/** Convert DiscoveredPOI to POIImportData for database upsert */
function convertToPOIImportData(
  poi: DiscoveredPOI,
  existingId?: string
): POIImportData {
  return {
    id: existingId || poi.id,
    name: poi.name,
    lat: poi.coordinates.lat,
    lng: poi.coordinates.lng,
    address: poi.address || null,
    category_id: poi.category.id,
    google_place_id: poi.googlePlaceId || null,
    google_rating: poi.googleRating || null,
    google_review_count: poi.googleReviewCount || null,
    google_maps_url: poi.googlePlaceId
      ? `https://www.google.com/maps/place/?q=place_id:${poi.googlePlaceId}`
      : null,
    photo_reference: null,
    entur_stopplace_id: poi.enturStopplaceId || null,
    bysykkel_station_id: poi.bysykkelStationId || null,
    hyre_station_id: null,
    // Trust: transport POIs are trusted (1.0), Google POIs need validation (null)
    trust_score: poi.enturStopplaceId || poi.bysykkelStationId ? 1.0 : null,
    trust_flags: [],
    trust_score_updated_at: null,
    google_website: null,
    google_business_status: null,
    google_price_level: null,
  };
}

/** Get unique categories from POIs for upsert */
function getUniqueCategoriesFromPOIs(pois: DiscoveredPOI[]) {
  const seen = new Set<string>();
  const categories: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
  }> = [];

  for (const poi of pois) {
    if (!seen.has(poi.category.id)) {
      seen.add(poi.category.id);
      categories.push({
        id: poi.category.id,
        name: poi.category.name,
        icon: poi.category.icon,
        color: poi.category.color,
      });
    }
  }

  return categories;
}

/** Link POIs to project and all its products, then revalidate public pages */
async function addPOIsToProject(projectId: string, poiIds: string[]) {
  const supabase = createServerClient();
  if (!supabase || poiIds.length === 0) return;

  // Get existing links to avoid duplicates
  const { data: existingLinks } = await supabase
    .from("project_pois")
    .select("poi_id")
    .eq("project_id", projectId);

  const existingPoiIds = new Set((existingLinks || []).map((l) => l.poi_id));
  const newLinks = poiIds
    .filter((id) => !existingPoiIds.has(id))
    .map((poiId) => ({ project_id: projectId, poi_id: poiId }));

  if (newLinks.length > 0) {
    await supabase.from("project_pois").insert(newLinks);
  }

  // Auto-add to all products in this project (Explorer, Report, Guide)
  const { data: products } = await supabase
    .from("products")
    .select("id")
    .eq("project_id", projectId);

  if (products && products.length > 0) {
    const productPoiRows = products.flatMap((product) =>
      poiIds.map((poiId) => ({ product_id: product.id, poi_id: poiId }))
    );
    await supabase
      .from("product_pois")
      .upsert(productPoiRows, {
        onConflict: "product_id,poi_id",
        ignoreDuplicates: true,
      });
  }

  // Revalidate public pages so Explorer/Report show new POIs immediately
  const { data: project } = await supabase
    .from("projects")
    .select("customer_id, url_slug")
    .eq("id", projectId)
    .single();

  if (project) {
    revalidatePath(`/${project.customer_id}/${project.url_slug}`, "layout");
  }
}

// ---------------------------------------------------------------------------
// Main pipeline function
// ---------------------------------------------------------------------------

/**
 * Import POIs from Google Places, Entur, and Bysykkel into a project.
 *
 * Handles:
 * 1. Calculate combined bounding box from circles
 * 2. Fetch existing POIs in bounding box for dedup
 * 3. For each circle in parallel: discover Google + Entur + Bysykkel
 * 4. Deduplicate across circles by external ID
 * 5. Categorize for upsert (new vs update)
 * 6. Upsert categories
 * 7. Convert to POIImportData and batch upsert
 * 8. Link to project via addPOIsToProject
 */
export async function importPOIsToProject(options: {
  circles: Array<{ lat: number; lng: number; radiusMeters: number }>;
  categories: string[];
  projectId: string;
  includeEntur?: boolean;
  includeBysykkel?: boolean;
  minRating?: number;
  maxResultsPerCategory?: number;
}): Promise<ImportPOIsResult> {
  const {
    circles,
    categories,
    projectId,
    includeEntur = true,
    includeBysykkel = true,
    minRating,
    maxResultsPerCategory,
  } = options;

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

  // 1. Calculate combined bounding box for pre-fetching existing POIs
  const allBboxes = circles.map((c) =>
    calculateBoundingBox({ lat: c.lat, lng: c.lng }, c.radiusMeters)
  );
  const combinedBbox: BoundingBox = {
    minLat: Math.min(...allBboxes.map((b) => b.minLat)),
    maxLat: Math.max(...allBboxes.map((b) => b.maxLat)),
    minLng: Math.min(...allBboxes.map((b) => b.minLng)),
    maxLng: Math.max(...allBboxes.map((b) => b.maxLng)),
  };

  // 2. Fetch existing POIs for dedup
  const existingPois = await fetchExistingPOIsInBoundingBox(combinedBbox);

  // 3. Discover per circle in parallel, deduplicating across circles
  const seenGoogleIds = new Set<string>();
  const seenEnturIds = new Set<string>();
  const seenBysykkelIds = new Set<string>();

  const allGooglePois: DiscoveredPOI[] = [];
  const allEnturPois: DiscoveredPOI[] = [];
  const allBysykkelPois: DiscoveredPOI[] = [];

  await Promise.all(
    circles.map(async (circle) => {
      const center = { lat: circle.lat, lng: circle.lng };
      const radius = circle.radiusMeters;

      const [googlePois, enturPois, bysykkelPois] = await Promise.all([
        categories.length > 0 && googleApiKey
          ? discoverGooglePlaces(
              {
                center,
                radius,
                googleCategories: [...categories],
                minRating,
                maxResultsPerCategory,
              },
              googleApiKey
            )
          : Promise.resolve([]),
        includeEntur
          ? discoverEnturStops({ center, radius })
          : Promise.resolve([]),
        includeBysykkel
          ? discoverBysykkelStations({ center, radius })
          : Promise.resolve([]),
      ]);

      // 4. Deduplicate across circles by external ID
      for (const poi of googlePois) {
        if (poi.googlePlaceId && !seenGoogleIds.has(poi.googlePlaceId)) {
          seenGoogleIds.add(poi.googlePlaceId);
          allGooglePois.push(poi);
        }
      }
      for (const poi of enturPois) {
        if (poi.enturStopplaceId && !seenEnturIds.has(poi.enturStopplaceId)) {
          seenEnturIds.add(poi.enturStopplaceId);
          allEnturPois.push(poi);
        }
      }
      for (const poi of bysykkelPois) {
        if (
          poi.bysykkelStationId &&
          !seenBysykkelIds.has(poi.bysykkelStationId)
        ) {
          seenBysykkelIds.add(poi.bysykkelStationId);
          allBysykkelPois.push(poi);
        }
      }
    })
  );

  // 5. Combine and categorize for upsert
  const allDiscovered = [...allGooglePois, ...allEnturPois, ...allBysykkelPois];
  const { toInsert, toUpdate, stats } = categorizeForUpsert(
    allDiscovered,
    existingPois
  );

  console.log(
    `[importPOIsToProject] Discovered ${stats.total} POIs: ${stats.new} new, ${stats.updated} to update`
  );

  // 6. Ensure categories exist (foreign key constraint)
  const uniqueCategories = getUniqueCategoriesFromPOIs(allDiscovered);
  if (uniqueCategories.length > 0) {
    await upsertCategories(uniqueCategories);
  }

  // 7. Convert to import format and batch upsert
  const poisToUpsert: POIImportData[] = [
    ...toInsert.map((poi) => convertToPOIImportData(poi)),
    ...toUpdate.map((poi) => convertToPOIImportData(poi, poi.existingId)),
  ];

  if (poisToUpsert.length > 0) {
    const result = await upsertPOIsWithEditorialPreservation(poisToUpsert);
    if (result.errors.length > 0) {
      console.error(
        `[importPOIsToProject] Upsert errors:`,
        result.errors
      );
    }
  }

  // 8. Link to project
  if (poisToUpsert.length > 0) {
    const poiIds = poisToUpsert.map((p) => p.id);
    await addPOIsToProject(projectId, poiIds);
  }

  return stats;
}
