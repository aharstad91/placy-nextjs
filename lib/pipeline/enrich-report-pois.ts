/**
 * Google Places-discovery (+ Entur, Bysykkel) for rapport-provisjon.
 *
 * Gjenbruker `lib/pipeline/import-pois.ts` (allerede uten dev-server).
 *
 * FOTO-FASE DEFERRED → PRD 4 Unit 4 (egen foto-task, eier-beslutning 2026-06-27):
 * `fetchAndCachePOIPhotos`-kallet wires inn igjen når foto-tasken lander. Inntil
 * da rendres POI-er med kategorifarge/pin (no-photo-fallback i PRD 5/9), og
 * resultatet rapporterer ikke et `photos`-ledd.
 */

import { importPOIsToProject } from "@/lib/pipeline/import-pois";

/** Google Places-kategorier for boligprofilen.
 *  Recall-fiks 2026-08-12 (Straumen-fasitøvelsen, 18 % recall): lista manglet
 *  doctor/dentist/hotel/bank/post_office/liquor_store — kategorier tema-
 *  defaultene alt renderte, men som aldri ble SØKT etter — pluss hele den
 *  rurale halen (kirke, veterinær, drivstoff, lading, camping, småbåthavn,
 *  spesialbutikker). Fasit: data/areas/straumen.fasit.md */
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
  "doctor",
  "dentist",
  "hotel",
  "bank",
  "post_office",
  "liquor_store",
  "church",
  "veterinary_care",
  "gas_station",
  "electric_vehicle_charging_station",
  "campground",
  "marina",
  "community_center",
  "book_store",
  "florist",
  "electronics_store",
  "home_goods_store",
];

/** Norske tekstsøk for hverdagssteder uten pålitelig Google-type.
 *  Kjøres som searchText-pass i tillegg til typefiltrert searchNearby. */
export const BOLIG_TEXT_QUERIES = [
  {
    query: "trafikkskole",
    category: { id: "trafikkskole", name: "Trafikkskole", icon: "Car", color: "#3b82f6" },
  },
  {
    query: "ungdomsklubb",
    category: { id: "fritidsklubb", name: "Fritidsklubb", icon: "Users", color: "#f472b6" },
  },
  {
    // Norske legesentre er upålitelig typet hos Google (Straumen: doctor-søket
    // fant fysioterapeuten, ikke legesenteret) — tekstsøk bærer kategorien.
    query: "legesenter",
    category: { id: "doctor", name: "Legesenter", icon: "Stethoscope", color: "#3b82f6" },
  },
];

/** Google Places-kategorier for næringsprofilen: hotel inn (gjeste-/kunde-
 *  overnatting + møtefasiliteter), shopping_mall + spa ut (bolig-tyngde). */
export const NAERING_GOOGLE_CATEGORIES = [
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
  "movie_theater",
  "hair_care",
  "hotel",
];

export interface EnrichReportPoisResult {
  google: {
    total: number;
    new: number;
    updated: number;
    byCategory: Record<string, number>;
  };
  warnings: string[];
}

export async function enrichReportPois(options: {
  projectId: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  /** Google Places-kategorier å hente. Default boligprofilen. */
  categories?: string[];
}): Promise<EnrichReportPoisResult> {
  const { projectId, lat, lng, radiusMeters } = options;
  const categories = options.categories ?? BOLIG_GOOGLE_CATEGORIES;
  const warnings: string[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mangler");
  }

  // Steg 1: Google Places + Entur + Bysykkel
  // Cache-isolasjon (PRD 3 / r03.3): import-pois rører ikke lenger
  // revalidatePath, så ingen `msg.includes("revalidatePath")`-svelge-landmine
  // arves — returverdien er alltid intakt. Ekte importfeil får kaste.
  let googleResult: Awaited<ReturnType<typeof importPOIsToProject>>;
  try {
    googleResult = await importPOIsToProject({
      circles: [{ lat, lng, radiusMeters }],
      categories,
      projectId,
      textQueries: BOLIG_TEXT_QUERIES,
      includeEntur: true,
      includeBysykkel: true,
      minRating: 0,
      maxResultsPerCategory: 20,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Google Places import feilet: ${msg}`);
  }

  if (googleResult.total < 10) {
    warnings.push(
      `⚠️  Bare ${googleResult.total} kommersielle POI-er funnet (normalområde: 15–40). Sjekk radius eller by.`
    );
  }

  // Steg 2 (FOTO) DEFERRED → PRD 4 Unit 4. Når foto-tasken lander, wires
  // fetchAndCachePOIPhotos inn her og `photos` legges tilbake i resultatet.

  return {
    google: googleResult,
    warnings,
  };
}
