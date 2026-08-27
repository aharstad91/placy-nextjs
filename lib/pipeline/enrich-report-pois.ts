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
import {
  discoverAnchorsForProject,
  ANCHOR_GOOGLE_TYPE,
  type AnchorImportReport,
} from "@/lib/pipeline/discover-anchors";

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
  // Recall-fiks 2026-08-24 (Ranheim KIWI-funnet): `supermarket` fant hverken
  // Rema eller Kiwi — de bærer bare `grocery_store` hos Google. Begge typene
  // søkes nå; de mapper til samme Placy-kategori (`supermarket`), så dedupen
  // på place-id gjør at et sted som bærer begge kun importeres én gang.
  "grocery_store",
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
  // Recall-fiks 2026-08-24 (butikk-familien): de fire typene over var HELE
  // `butikk`-kilden. Klær, sko, sport, smykker, leker, kosmetikk, dyr, sykkel,
  // jernvare, gaver og møbler ble aldri søkt etter — 55 målte treff i
  // produksjons-bboxen som ingen annen type i lista fanget.
  "clothing_store",
  "shoe_store",
  "sporting_goods_store",
  "jewelry_store",
  "toy_store",
  "cosmetics_store",
  "pet_store",
  "bicycle_store",
  "hardware_store",
  "gift_shop",
  "furniture_store",
  // Kategorier tema-defaultene renderte uten at noen kilde fylte dem.
  "convenience_store",
  "beach",
  "beauty_salon",
  // Recall-fiks 2026-08-24 (Ranheim pumptrack): `gym` var den ENESTE
  // sport-typen som ble søkt etter, så idrettsanlegg, skøytebaner, pumptracks,
  // svømmehaller, lekeplasser og turområder falt ut av Google-stien helt.
  // Rekkefølgen er ikke tilfeldig: dedupliseringen i discoverGooglePlaces lar
  // FØRSTE treff eie kategorien, så de spesifikke typene må ligge foran
  // paraplyen `sports_activity_location` — ellers ble «3T-Ranheim» et
  // idrettsanlegg i stedet for et treningssenter.
  "sports_complex",
  "athletic_field",
  "stadium",
  "ice_skating_rink",
  "cycling_park",
  "skateboard_park",
  "golf_course",
  "swimming_pool",
  "playground",
  "hiking_area",
  "dog_park",
  "sports_activity_location",
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
  "grocery_store",
  "pharmacy",
  "gym",
  "park",
  "museum",
  "library",
  "movie_theater",
  "hair_care",
  "hotel",
  // Bare de to som HAR et tema i næringsprofilen (`swimming` i Trening &
  // Aktivitet, `outdoor` i Nabolaget). `idrett`/`lekeplass`/`hundepark` er
  // ikke med i noe næringstema, og ville blitt importert til ingenting —
  // samme tomme-kategori-bug som marina hadde før 2026-08-12.
  "swimming_pool",
  "hiking_area",
];

export interface EnrichReportPoisResult {
  google: {
    total: number;
    new: number;
    updated: number;
    byCategory: Record<string, number>;
  };
  /** Anker-passet. Utelatt når profilen ikke søker etter kjøpesenter. */
  anchors?: {
    candidatesFound: number;
    imported: AnchorImportReport[];
    beyondCircle: number;
    /** Fjerne kandidater som ikke besto realitets-gaten (≥4 virksomheter). */
    rejected: Array<{ name: string; distanceMeters: number; memberCount: number }>;
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

  // Steg 2: anker-pass utenfor prosjektsirkelen.
  //
  // Gates på at profilen i det hele tatt søker etter kjøpesenter:
  // næringsprofilen tok `shopping_mall` UT bevisst (bolig-tyngde), og skal
  // ikke få ankre inn bakveien. Passet er fail-soft — det kan aldri felle en
  // provisjonering, bare rapportere at det ikke fant noe.
  let anchors: EnrichReportPoisResult["anchors"];
  if (categories.includes(ANCHOR_GOOGLE_TYPE)) {
    const anchorResult = await discoverAnchorsForProject({
      projectId,
      lat,
      lng,
      radiusMeters,
    });
    warnings.push(...anchorResult.warnings);
    anchors = {
      candidatesFound: anchorResult.candidatesFound,
      imported: anchorResult.imported,
      beyondCircle: anchorResult.beyondCircle,
      rejected: anchorResult.rejected,
    };
  }

  // Steg 3 (FOTO) DEFERRED → PRD 4 Unit 4. Når foto-tasken lander, wires
  // fetchAndCachePOIPhotos inn her og `photos` legges tilbake i resultatet.

  return {
    google: googleResult,
    ...(anchors ? { anchors } : {}),
    warnings,
  };
}
