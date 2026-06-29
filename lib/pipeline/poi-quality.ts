/**
 * POI Quality Filters
 *
 * Grovfiltre for kvalitetssikring av POI-data fra Google Places.
 * Filtrerer bort stengte bedrifter, irrelevante avstander,
 * hjemmekontorer uten kvalitetssignaler, og feilkategoriserte oppføringer.
 *
 * Brukes av poi-discovery.ts ved import-tid.
 * LLM-baserte finfiltre kjøres som separate generate-command steg.
 */

import { calculateDistance } from "@/lib/utils/geo";

// === Types ===

export interface QualityRejection {
  name: string;
  categoryId: string;
  reason: string;
  filter:
    | "business_status"
    | "distance"
    | "quality"
    | "name_mismatch"
    | "llm_category"
    | "llm_duplicate";
}

export interface QualityFilterStats {
  total: number;
  passed: number;
  rejected: number;
  byReason: Record<string, number>;
  rejections: QualityRejection[];
}

/** Minimal place shape needed by grovfiltre */
export interface PlaceQualityInput {
  name: string;
  business_status?: string;
  user_ratings_total?: number;
  rating?: number;
}

/** POI shape needed by findNearbyGroups */
export interface NearbyGroupInput {
  id: string;
  name: string;
  categoryId: string;
  lat: number;
  lng: number;
}

// === Constants ===

export const WALK_METERS_PER_MINUTE = 80;

/**
 * Maks gangavstand i minutter per kategori.
 * Differensiert: daglige behov kort, bil-destinasjoner høy.
 */
export const MAX_WALK_MINUTES_BY_CATEGORY: Record<string, number> = {
  // Daglige behov — kort avstand
  restaurant: 15,
  cafe: 15,
  bakery: 15,
  supermarket: 15,
  pharmacy: 20,
  haircare: 20,
  lekeplass: 15,
  bus: 10,

  // Ukentlige behov — middels avstand
  bar: 20,
  gym: 20,
  bank: 25,
  post: 25,
  library: 25,
  spa: 25,
  park: 20,
  tram: 20,
  skole: 20,
  barnehage: 20,
  idrett: 25,

  // Bil-destinasjoner — høy avstand (folk kjører dit)
  shopping: 30,
  cinema: 30,
  museum: 30,
  hospital: 45,
  doctor: 30,
  dentist: 30,
  train: 35,
  badeplass: 30,
};

/**
 * Kategorier unntatt fra kvalitetssignal-sjekk.
 * Offentlige tjenester og transport mangler ofte Google-data
 * men har autoritativ data fra Entur, NSR, Barnehagefakta, etc.
 */
export const QUALITY_EXEMPT_CATEGORIES = new Set([
  "park",
  "library",
  "museum",
  "bus",
  "train",
  "tram",
  "bike",
  "skole",
  "barnehage",
  "idrett",
  "lekeplass",
  "badeplass",
]);

/**
 * Ord som ALDRI matcher gitte kategorier.
 * Word-boundary matching — sjekker hele ord, ikke substrings.
 */
export const CATEGORY_NAME_BLOCKLIST: Record<string, string[]> = {
  restaurant: [
    "cleaning",
    "renhold",
    "vask",
    "transport",
    "bygg",
    "teknikk",
    "regnskap",
    "advokat",
    "parkering",
    "bilverksted",
    "elektro",
    "rørlegger",
    "maling",
    "flyttebyrå",
    "eiendom",
  ],
  park: [
    "bygg",
    "teknikk",
    "auto",
    "bil",
    "verksted",
    "kontor",
    "regnskap",
    "eiendom",
    "invest",
    "holding",
    "finans",
  ],
  shopping: ["parkering", "parking", "p-hus"],
  cafe: ["cleaning", "renhold", "bygg", "teknikk", "transport"],
  gym: ["kiropraktor", "fysioterapi", "lege", "tannlege", "optiker"],
};

// === Grovfiltre ===

/**
 * Sjekk om en bedrift er permanent stengt.
 * CLOSED_TEMPORARILY lar vi gjennom — trust-systemet håndterer det.
 */
export function isBusinessClosed(place: {
  business_status?: string;
}): boolean {
  return place.business_status === "CLOSED_PERMANENTLY";
}

/**
 * Sjekk om en POI er innenfor relevant gangavstand for sin kategori.
 */
export function isWithinCategoryDistance(
  distanceMeters: number,
  categoryId: string
): boolean {
  const maxMinutes = MAX_WALK_MINUTES_BY_CATEGORY[categoryId] ?? 25;
  const walkMinutes = distanceMeters / WALK_METERS_PER_MINUTE;
  return walkMinutes <= maxMinutes;
}

/**
 * Sjekk om en POI har minimum kvalitetssignaler.
 * Offentlige kategorier (park, skole, etc.) er unntatt.
 */
export function hasMinimumQualitySignals(
  place: { user_ratings_total?: number; rating?: number },
  categoryId: string
): boolean {
  if (QUALITY_EXEMPT_CATEGORIES.has(categoryId)) return true;
  return (place.user_ratings_total ?? 0) >= 1 || place.rating !== undefined;
}

/**
 * Sjekk om et POI-navn mismatches sin kategori.
 * Word-boundary matching: splitter på whitespace, sjekker om ord starter med blocklist-term.
 * "Brilliance Cleaning" + restaurant → true (mismatch)
 * "Transport" + restaurant → false (legitimt restaurantnavn)
 */
export function isNameCategoryMismatch(
  name: string,
  categoryId: string
): boolean {
  const blocklist = CATEGORY_NAME_BLOCKLIST[categoryId];
  if (!blocklist) return false;

  const words = name.toLowerCase().split(/\s+/);
  // Single-word names are too ambiguous for rule-based filtering
  // ("Transport" could be a restaurant in Oslo — let LLM handle it)
  if (words.length === 1) return false;
  return blocklist.some((term) =>
    words.some((word) => word === term || word.startsWith(term))
  );
}

// === Composable Filter ===

/**
 * Kjør hele grovfilter-kjeden for en Google Place.
 * Returnerer pass/fail med optional rejection info.
 * Billigste sjekker først: business_status → distance → quality → name_mismatch.
 */
export function evaluateGooglePlaceQuality(
  place: PlaceQualityInput,
  categoryId: string,
  distanceMeters: number,
  rejections?: QualityRejection[]
): { pass: boolean; rejection?: QualityRejection } {
  // 1. business_status (billigst, hardest)
  if (isBusinessClosed(place)) {
    const rejection: QualityRejection = {
      name: place.name,
      categoryId,
      reason: "Permanently closed",
      filter: "business_status",
    };
    rejections?.push(rejection);
    return { pass: false, rejection };
  }

  // 2. Avstandstak per kategori
  if (!isWithinCategoryDistance(distanceMeters, categoryId)) {
    const walkMin = Math.round(distanceMeters / WALK_METERS_PER_MINUTE);
    const maxMin = MAX_WALK_MINUTES_BY_CATEGORY[categoryId] ?? 25;
    const rejection: QualityRejection = {
      name: place.name,
      categoryId,
      reason: `${walkMin} min gange > maks ${maxMin} min for ${categoryId}`,
      filter: "distance",
    };
    rejections?.push(rejection);
    return { pass: false, rejection };
  }

  // 3. Minimum kvalitetssignaler
  if (!hasMinimumQualitySignals(place, categoryId)) {
    const rejection: QualityRejection = {
      name: place.name,
      categoryId,
      reason: "Ingen rating eller reviews",
      filter: "quality",
    };
    rejections?.push(rejection);
    return { pass: false, rejection };
  }

  // 4. Navn-kategori mismatch (dyrest av grovfiltrene)
  if (isNameCategoryMismatch(place.name, categoryId)) {
    const rejection: QualityRejection = {
      name: place.name,
      categoryId,
      reason: `Navn "${place.name}" matcher ikke kategori ${categoryId}`,
      filter: "name_mismatch",
    };
    rejections?.push(rejection);
    return { pass: false, rejection };
  }

  return { pass: true };
}

// === Duplikat-deteksjon helpers ===

/**
 * Finn grupper av nærliggende POI-er med samme kategori.
 * Brute force O(n²) med Haversine — ~4ms for 200 POI-er.
 * Returnerer kun grupper med 2+ POI-er.
 */
export function findNearbyGroups(
  pois: NearbyGroupInput[],
  maxDistanceMeters: number = 300
): NearbyGroupInput[][] {
  const groups: NearbyGroupInput[][] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < pois.length; i++) {
    if (assigned.has(pois[i].id)) continue;

    const group: NearbyGroupInput[] = [pois[i]];

    for (let j = i + 1; j < pois.length; j++) {
      if (assigned.has(pois[j].id)) continue;
      if (pois[i].categoryId !== pois[j].categoryId) continue;

      const dist = calculateDistance(
        pois[i].lat,
        pois[i].lng,
        pois[j].lat,
        pois[j].lng
      );

      if (dist <= maxDistanceMeters) {
        group.push(pois[j]);
      }
    }

    if (group.length >= 2) {
      for (const poi of group) {
        assigned.add(poi.id);
      }
      groups.push(group);
    }
  }

  return groups;
}

// === Safety valve ===

/**
 * Logg kvalitetsfilter-oppsummering til console.
 */
export function logQualityFilterStats(stats: QualityFilterStats): void {
  console.log(
    `\n📊 Kvalitetsfilter: ${stats.total} vurdert, ${stats.passed} bestod, ${stats.rejected} avvist`
  );
  if (stats.rejected > 0) {
    const reasons = Object.entries(stats.byReason)
      .map(([reason, count]) => `${count} ${reason}`)
      .join(", ");
    console.log(`   → ${reasons}`);
  }
}

/**
 * Beregn stats fra en liste med rejections.
 */
export function calculateQualityStats(
  totalEvaluated: number,
  rejections: QualityRejection[]
): QualityFilterStats {
  const byReason: Record<string, number> = {};
  for (const r of rejections) {
    byReason[r.filter] = (byReason[r.filter] ?? 0) + 1;
  }
  return {
    total: totalEvaluated,
    passed: totalEvaluated - rejections.length,
    rejected: rejections.length,
    byReason,
    rejections,
  };
}
