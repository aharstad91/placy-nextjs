/**
 * POI Import API Route
 * Discovers and imports POIs from Google Places, Entur, and Bysykkel
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  discoverGooglePlaces,
  discoverEnturStops,
  discoverBysykkelStations,
  DiscoveredPOI,
  GOOGLE_CATEGORY_MAP,
  TRANSPORT_CATEGORIES,
} from "@/lib/generators/poi-discovery";
import {
  upsertPOIsWithEditorialPreservation,
  upsertCategories,
  POIImportData,
} from "@/lib/supabase/mutations";
import { createServerClient } from "@/lib/supabase/client";

// Allowed Google Places categories
const ALLOWED_CATEGORIES = [
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "gym",
  "supermarket",
  "pharmacy",
  "bank",
  "post_office",
  "shopping_mall",
  "museum",
  "library",
  "park",
  "movie_theater",
  "hospital",
  "doctor",
  "dentist",
  "hair_care",
  "spa",
  "hotel",
] as const;

// Norway coordinate bounds
const NORWAY_BOUNDS = {
  minLat: 57.0,
  maxLat: 72.0,
  minLng: 4.0,
  maxLng: 32.0,
};

// Zod schema for request validation
const ImportRequestSchema = z.object({
  center: z.object({
    lat: z
      .number()
      .min(NORWAY_BOUNDS.minLat, "Latitude out of Norway bounds")
      .max(NORWAY_BOUNDS.maxLat, "Latitude out of Norway bounds"),
    lng: z
      .number()
      .min(NORWAY_BOUNDS.minLng, "Longitude out of Norway bounds")
      .max(NORWAY_BOUNDS.maxLng, "Longitude out of Norway bounds"),
  }),
  radiusMeters: z.number().min(300).max(2000),
  categories: z
    .array(z.enum(ALLOWED_CATEGORIES))
    .min(1, "Velg minst én kategori")
    .max(20),
  includeEntur: z.boolean().default(true),
  includeBysykkel: z.boolean().default(true),
  projectId: z.string().min(1).optional(),
  preview: z.boolean().default(false),
});

type ImportRequest = z.infer<typeof ImportRequestSchema>;

interface ImportResponse {
  success: boolean;
  preview: boolean;
  stats: {
    total: number;
    byCategory: Record<string, number>;
    new: number;
    updated: number;
  };
  linkedToProject?: string;
  errors: string[];
}

interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// Calculate bounding box from center + radius
function calculateBoundingBox(
  center: { lat: number; lng: number },
  radiusMeters: number
): BoundingBox {
  // Approximate: 1 degree latitude = 111.32 km
  const latDelta = radiusMeters / 111320;
  // Longitude varies with latitude
  const lngDelta = radiusMeters / (111320 * Math.cos((center.lat * Math.PI) / 180));

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

// Pre-fetch existing POIs in bounding box for O(1) deduplication
async function fetchExistingPOIsInBoundingBox(bbox: BoundingBox) {
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

interface ExistingPOI {
  id: string;
  google_place_id: string | null;
  entur_stopplace_id: string | null;
  bysykkel_station_id: string | null;
}

// Categorize POIs for insert vs update using O(1) lookup
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

// Convert DiscoveredPOI to POIImportData for database upsert
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
  };
}

// Get unique categories from POIs for upsert
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

// Link POIs to project
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
}

export async function POST(request: NextRequest) {
  // 1. Admin check
  if (process.env.ADMIN_ENABLED !== "true") {
    return NextResponse.json({ error: "Admin ikke aktivert" }, { status: 403 });
  }

  // 2. Validate request body with Zod
  let body: ImportRequest;
  try {
    const json = await request.json();
    body = ImportRequestSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ugyldig request", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  // 3. Check Google API key
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleApiKey && body.categories.length > 0) {
    return NextResponse.json(
      { error: "Google Places API-nøkkel ikke konfigurert" },
      { status: 500 }
    );
  }

  console.log(`[Import] Starting discovery at (${body.center.lat}, ${body.center.lng}), radius=${body.radiusMeters}m`);

  // 4. Calculate bounding box for pre-fetching existing POIs
  const bbox = calculateBoundingBox(body.center, body.radiusMeters);

  // 5. PARALLEL FETCH - Critical for performance
  const [googlePois, enturPois, bysykkelPois, existingPois] = await Promise.all([
    // Google Places (only if we have categories selected)
    body.categories.length > 0 && googleApiKey
      ? discoverGooglePlaces(
          {
            center: body.center,
            radius: body.radiusMeters,
            googleCategories: [...body.categories],
          },
          googleApiKey
        )
      : Promise.resolve([]),

    // Entur stops
    body.includeEntur
      ? discoverEnturStops({
          center: body.center,
          radius: body.radiusMeters,
        })
      : Promise.resolve([]),

    // Bysykkel stations
    body.includeBysykkel
      ? discoverBysykkelStations({
          center: body.center,
          radius: body.radiusMeters,
        })
      : Promise.resolve([]),

    // Pre-fetch existing POIs for O(1) dedup
    fetchExistingPOIsInBoundingBox(bbox),
  ]);

  // 6. Combine and deduplicate
  const allDiscovered = [...googlePois, ...enturPois, ...bysykkelPois];
  const { toInsert, toUpdate, stats } = categorizeForUpsert(
    allDiscovered,
    existingPois
  );

  console.log(`[Import] Discovered ${stats.total} POIs: ${stats.new} new, ${stats.updated} to update`);

  // 7. Preview mode - return stats without writing
  if (body.preview) {
    return NextResponse.json({
      success: true,
      preview: true,
      stats,
      errors: [],
    } satisfies ImportResponse);
  }

  // 8. Execute import
  const errors: string[] = [];

  try {
    // Ensure categories exist first (foreign key constraint)
    const uniqueCategories = getUniqueCategoriesFromPOIs(allDiscovered);
    if (uniqueCategories.length > 0) {
      await upsertCategories(uniqueCategories);
    }

    // Convert to import format
    const poisToUpsert: POIImportData[] = [
      ...toInsert.map((poi) => convertToPOIImportData(poi)),
      ...toUpdate.map((poi) => convertToPOIImportData(poi, poi.existingId)),
    ];

    // Batch upsert POIs (preserves editorial content)
    if (poisToUpsert.length > 0) {
      const result = await upsertPOIsWithEditorialPreservation(poisToUpsert);
      if (result.errors.length > 0) {
        errors.push(...result.errors);
      }
    }

    // Link to project if specified
    if (body.projectId && poisToUpsert.length > 0) {
      const poiIds = poisToUpsert.map((p) => p.id);
      await addPOIsToProject(body.projectId, poiIds);
    }

    return NextResponse.json({
      success: true,
      preview: false,
      stats,
      linkedToProject: body.projectId,
      errors,
    } satisfies ImportResponse);
  } catch (error) {
    console.error("[Import] Error:", error);
    return NextResponse.json(
      {
        error: "Import feilet",
        details: error instanceof Error ? error.message : "Ukjent feil",
      },
      { status: 500 }
    );
  }
}
