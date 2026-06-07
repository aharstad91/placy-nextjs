/**
 * Google Places-discovery, Entur, Bysykkel og foto-henting for basic-tier rapport.
 *
 * Gjenbruker `lib/pipeline/import-pois.ts` (allerede uten dev-server) og
 * `lib/utils/fetch-poi-photos.ts` (direkte Supabase REST, ingen proxy).
 */

import { importPOIsToProject } from "@/lib/pipeline/import-pois";
import { fetchAndCachePOIPhotos } from "@/lib/utils/fetch-poi-photos";
import { createServerClient } from "@/lib/supabase/client";

/** Google Places-kategorier for boligprofilen */
export const BOLIG_GOOGLE_CATEGORIES = [
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "supermarket",
  "pharmacy",
  "gym",
  "park",
  "museum",
  "library",
  "shopping_mall",
  "movie_theater",
  "hair_care",
  "spa",
];

export interface EnrichReportPoisResult {
  google: {
    total: number;
    new: number;
    updated: number;
    byCategory: Record<string, number>;
  };
  photos: {
    updated: number;
    skipped: number;
    failed: number;
  };
  warnings: string[];
}

export async function enrichReportPois(options: {
  projectId: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}): Promise<EnrichReportPoisResult> {
  const { projectId, lat, lng, radiusMeters } = options;
  const warnings: string[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mangler");
  }

  // Steg 1: Google Places + Entur + Bysykkel
  // importPOIsToProject kaller revalidatePath til slutt — i CLI-kontekst kaster
  // dette, men data er allerede skrevet. Fanger feilen og fortsetter.
  let googleResult: Awaited<ReturnType<typeof importPOIsToProject>>;
  try {
    googleResult = await importPOIsToProject({
      circles: [{ lat, lng, radiusMeters }],
      categories: BOLIG_GOOGLE_CATEGORIES,
      projectId,
      includeEntur: true,
      includeBysykkel: true,
      minRating: 0,
      maxResultsPerCategory: 20,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // revalidatePath kaster i CLI-kontekst — ignorer, data er skrevet
    if (msg.includes("revalidatePath") || msg.includes("cache")) {
      warnings.push(`ℹ️  revalidatePath ikke tilgjengelig i CLI — ignorerer (data er skrevet)`);
      // Les faktisk antall fra DB siden returnverdien gikk tapt i throw
      const supabase = createServerClient();
      let total = 0;
      if (supabase) {
        const { count } = await supabase
          .from("project_pois")
          .select("*", { count: "exact", head: true })
          .eq("project_id", projectId);
        total = count ?? 0;
      }
      googleResult = { total, new: total, updated: 0, byCategory: {} };
    } else {
      throw new Error(`Google Places import feilet: ${msg}`);
    }
  }

  if (googleResult.total < 10) {
    warnings.push(
      `⚠️  Bare ${googleResult.total} kommersielle POI-er funnet (normalområde: 15–40). Sjekk radius eller by.`
    );
  }

  // Steg 2: Foto-batch (CDN-URL-er, ingen proxy)
  let photos = { updated: 0, skipped: 0, failed: 0 };
  if (googleApiKey) {
    try {
      const photoResult = await fetchAndCachePOIPhotos(
        projectId,
        supabaseUrl,
        serviceRoleKey,
        googleApiKey
      );
      photos = {
        updated: photoResult.updated,
        skipped: photoResult.skipped,
        failed: photoResult.failed,
      };
      if (photoResult.failed > 0) {
        warnings.push(`⚠️  ${photoResult.failed} POI-er fikk ikke foto (de bruker kategorifarge)`);
      }
    } catch (err) {
      warnings.push(`⚠️  Foto-henting feilet: ${err}. POI-er bruker kategorifarge.`);
    }
  } else {
    warnings.push("⚠️  GOOGLE_PLACES_API_KEY mangler — ingen foto-henting");
  }

  return {
    google: googleResult,
    photos,
    warnings,
  };
}
