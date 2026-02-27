/**
 * POI Discovery Module
 * Henter POI-er fra Google Places, Entur, og Trondheim Bysykkel
 */

import { Category, Coordinates } from "../types";
import { calculateDistance } from "../utils/geo";
import { slugify } from "../utils/slugify";
import {
  evaluateGooglePlaceQuality,
  isWithinCategoryDistance,
  calculateQualityStats,
  logQualityFilterStats,
  type QualityRejection,
} from "./poi-quality";

// === Types ===

export interface DiscoveryConfig {
  center: Coordinates;
  radius: number; // meters
  googleCategories?: string[];
  minRating?: number;
  maxResultsPerCategory?: number;
  includeTransport?: boolean;
}

export interface DiscoveredPOI {
  id: string;
  name: string;
  coordinates: Coordinates;
  address?: string;
  category: Category;
  googlePlaceId?: string;
  googleRating?: number;
  googleReviewCount?: number;
  source: "google" | "entur" | "bysykkel" | "manual";
  enturStopplaceId?: string;
  bysykkelStationId?: string;
  // Editorial fields (added later via Claude or manual editing)
  editorialHook?: string;
  localInsight?: string;
}

// === Category Mappings ===

const GOOGLE_CATEGORY_MAP: Record<string, Category> = {
  restaurant: { id: "restaurant", name: "Restaurant", icon: "UtensilsCrossed", color: "#ef4444" },
  cafe: { id: "cafe", name: "Kafé", icon: "Coffee", color: "#f97316" },
  bar: { id: "bar", name: "Bar", icon: "Wine", color: "#a855f7" },
  bakery: { id: "bakery", name: "Bakeri", icon: "Croissant", color: "#f59e0b" },
  gym: { id: "gym", name: "Treningssenter", icon: "Dumbbell", color: "#ec4899" },
  supermarket: { id: "supermarket", name: "Dagligvare", icon: "ShoppingCart", color: "#22c55e" },
  pharmacy: { id: "pharmacy", name: "Apotek", icon: "Pill", color: "#06b6d4" },
  bank: { id: "bank", name: "Bank", icon: "Building", color: "#6366f1" },
  post_office: { id: "post", name: "Post", icon: "Mail", color: "#f43f5e" },
  shopping_mall: { id: "shopping", name: "Kjøpesenter", icon: "ShoppingBag", color: "#8b5cf6" },
  museum: { id: "museum", name: "Museum", icon: "Landmark", color: "#0ea5e9" },
  library: { id: "library", name: "Bibliotek", icon: "BookOpen", color: "#14b8a6" },
  park: { id: "park", name: "Park", icon: "TreePine", color: "#10b981" },
  movie_theater: { id: "cinema", name: "Kino", icon: "Film", color: "#f472b6" },
  hospital: { id: "hospital", name: "Sykehus", icon: "Hospital", color: "#ef4444" },
  doctor: { id: "doctor", name: "Legesenter", icon: "Stethoscope", color: "#3b82f6" },
  dentist: { id: "dentist", name: "Tannlege", icon: "Smile", color: "#22d3ee" },
  hair_care: { id: "haircare", name: "Frisør", icon: "Scissors", color: "#d946ef" },
  spa: { id: "spa", name: "Spa", icon: "Sparkles", color: "#c084fc" },
  hotel: { id: "hotel", name: "Hotell", icon: "Building2", color: "#0891b2" },
};

const TRANSPORT_CATEGORIES: Record<string, Category> = {
  bus: { id: "bus", name: "Buss", icon: "Bus", color: "#3b82f6" },
  bike: { id: "bike", name: "Bysykkel", icon: "Bike", color: "#22c55e" },
  parking: { id: "parking", name: "Parkering", icon: "ParkingCircle", color: "#6366f1" },
  train: { id: "train", name: "Tog", icon: "TrainFront", color: "#0ea5e9" },
  tram: { id: "tram", name: "Trikk", icon: "Tram", color: "#f97316" },
};

// === Google Places Discovery ===

// Map of related types that count as a valid match for a search category.
// Google returns a `types` array per result — we require at least one match
// to avoid junk results (e.g. stadiums returned for "hotel" searches).
const VALID_TYPES_FOR_CATEGORY: Record<string, Set<string>> = {
  restaurant: new Set(["restaurant", "food"]),
  cafe: new Set(["cafe", "coffee_shop"]),
  bar: new Set(["bar", "night_club"]),
  bakery: new Set(["bakery"]),
  gym: new Set(["gym", "health"]),
  supermarket: new Set(["supermarket", "grocery_or_supermarket"]),
  pharmacy: new Set(["pharmacy", "drugstore"]),
  bank: new Set(["bank"]),
  post_office: new Set(["post_office"]),
  shopping_mall: new Set(["shopping_mall"]),
  museum: new Set(["museum"]),
  library: new Set(["library"]),
  park: new Set(["park"]),
  movie_theater: new Set(["movie_theater"]),
  hospital: new Set(["hospital"]),
  doctor: new Set(["doctor"]),
  dentist: new Set(["dentist"]),
  hair_care: new Set(["hair_care", "beauty_salon"]),
  spa: new Set(["spa"]),
  hotel: new Set(["lodging", "hotel"]),
};

interface GooglePlaceResult {
  place_id: string;
  name: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  vicinity?: string;
  types?: string[];
}

export async function discoverGooglePlaces(
  config: DiscoveryConfig,
  apiKey: string
): Promise<DiscoveredPOI[]> {
  const categories = config.googleCategories || [
    "restaurant",
    "cafe",
    "bar",
    "bakery",
    "gym",
    "supermarket",
  ];

  const minRating = config.minRating || 0;
  const maxPerCategory = config.maxResultsPerCategory || 20;
  const allPOIs: DiscoveredPOI[] = [];
  const rejections: QualityRejection[] = [];
  let totalEvaluated = 0;

  for (const category of categories) {
    console.log(`  → Søker etter ${category}...`);

    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${config.center.lat},${config.center.lng}&radius=${config.radius}&type=${category}&key=${apiKey}`;

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`    ✗ Feil ved søk etter ${category}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.error(`    ✗ Google API feil: ${data.status}`);
        continue;
      }

      const places: GooglePlaceResult[] = data.results || [];
      const categoryDef = GOOGLE_CATEGORY_MAP[category] || {
        id: category,
        name: category,
        icon: "MapPin",
        color: "#6b7280",
      };

      let addedCount = 0;
      for (const place of places) {
        // Filter by actual distance (Google API treats radius as preference, not strict)
        const distance = calculateDistance(
          config.center.lat,
          config.center.lng,
          place.geometry.location.lat,
          place.geometry.location.lng
        );
        if (distance > config.radius) {
          continue;
        }

        // Filter by type match — Google returns junk (stadiums, offices) for some categories
        const validTypes = VALID_TYPES_FOR_CATEGORY[category];
        if (validTypes && place.types) {
          const hasMatch = place.types.some((t) => validTypes.has(t));
          if (!hasMatch) {
            continue;
          }
        }

        // Filter by rating
        if (place.rating && place.rating < minRating) {
          continue;
        }

        // Quality filter chain (business_status → distance → quality → name_mismatch)
        totalEvaluated++;
        const qualityResult = evaluateGooglePlaceQuality(
          {
            name: place.name,
            business_status: place.business_status,
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
          },
          categoryDef.id,
          distance,
          rejections
        );
        if (!qualityResult.pass) {
          continue;
        }

        // Limit per category
        if (addedCount >= maxPerCategory) {
          break;
        }

        // Create POI ID with source prefix (using Google place_id for stability)
        const id = generatePoiId("google", place.name, place.place_id);

        // Check for duplicates
        if (allPOIs.some((p) => p.id === id)) {
          continue;
        }

        allPOIs.push({
          id,
          name: place.name,
          coordinates: {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
          },
          address: place.vicinity,
          category: categoryDef,
          googlePlaceId: place.place_id,
          googleRating: place.rating,
          googleReviewCount: place.user_ratings_total,
          source: "google",
        });

        addedCount++;
      }

      console.log(`    ✓ Fant ${addedCount} ${category}`);
    } catch (error) {
      console.error(`    ✗ Feil ved søk etter ${category}:`, error);
    }

    // Small delay to avoid rate limiting
    await sleep(200);
  }

  // Log quality filter stats
  if (totalEvaluated > 0) {
    const stats = calculateQualityStats(totalEvaluated, rejections);
    logQualityFilterStats(stats);
  }

  return allPOIs;
}

// === Entur Stop Places Discovery ===

const ENTUR_API_URL = "https://api.entur.io/journey-planner/v3/graphql";

const STOP_PLACES_QUERY = `
  query GetNearbyStopPlaces($lat: Float!, $lon: Float!, $distance: Float!) {
    nearest(
      latitude: $lat
      longitude: $lon
      maximumDistance: $distance
      filterByPlaceTypes: [stopPlace]
      filterByInUse: true
      multiModalMode: parent
    ) {
      edges {
        node {
          place {
            ... on StopPlace {
              id
              name
              latitude
              longitude
              transportMode
            }
          }
          distance
        }
      }
    }
  }
`;

interface EnturStopPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  transportMode: string[];
}

export async function discoverEnturStops(
  config: DiscoveryConfig
): Promise<DiscoveredPOI[]> {
  console.log("  → Søker etter kollektivholdeplasser...");

  try {
    const response = await fetch(ENTUR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ET-Client-Name": "placy-story-generator",
      },
      body: JSON.stringify({
        query: STOP_PLACES_QUERY,
        variables: {
          lat: config.center.lat,
          lon: config.center.lng,
          distance: config.radius,
        },
      }),
    });

    if (!response.ok) {
      console.error(`    ✗ Entur API feil: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (data.errors) {
      console.error("    ✗ Entur GraphQL feil:", data.errors[0]?.message);
      return [];
    }

    const edges = data.data?.nearest?.edges || [];
    const pois: DiscoveredPOI[] = [];

    for (const edge of edges) {
      const place = edge.node?.place as EnturStopPlace;
      if (!place || !place.id) continue;

      // Determine transport mode
      const modes = place.transportMode || [];
      let category = TRANSPORT_CATEGORIES.bus;
      let suffix = "";
      let categoryId = "bus";

      if (modes.includes("rail")) {
        category = TRANSPORT_CATEGORIES.train;
        categoryId = "train";
        suffix = " stasjon";
      } else if (modes.includes("tram")) {
        category = TRANSPORT_CATEGORIES.tram;
        categoryId = "tram";
        suffix = " holdeplass";
      } else if (modes.includes("metro")) {
        category = TRANSPORT_CATEGORIES.train;
        categoryId = "train";
        suffix = " T-bane";
      } else {
        suffix = " bussholdeplass";
      }

      const name = place.name + (place.name.toLowerCase().includes("holdeplass") || place.name.toLowerCase().includes("stasjon") ? "" : suffix);

      // Distance-based quality filter for transport
      const stopDistance = calculateDistance(
        config.center.lat,
        config.center.lng,
        place.latitude,
        place.longitude
      );
      if (!isWithinCategoryDistance(stopDistance, categoryId)) {
        continue;
      }

      // Create POI ID with source prefix (using Entur stopplace_id for stability)
      const id = generatePoiId("entur", name, place.id);

      // Skip duplicates
      if (pois.some((p) => p.id === id)) continue;

      pois.push({
        id,
        name,
        coordinates: {
          lat: place.latitude,
          lng: place.longitude,
        },
        category,
        source: "entur",
        enturStopplaceId: place.id,
      });
    }

    console.log(`    ✓ Fant ${pois.length} holdeplasser`);
    return pois;
  } catch (error) {
    console.error("    ✗ Entur API feil:", error);
    return [];
  }
}

// === Trondheim Bysykkel Discovery ===

const BYSYKKEL_STATION_INFO_URL =
  "https://gbfs.urbansharing.com/trondheimbysykkel.no/station_information.json";

interface BysykkelStation {
  station_id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  capacity: number;
}

export async function discoverBysykkelStations(
  config: DiscoveryConfig
): Promise<DiscoveredPOI[]> {
  console.log("  → Søker etter bysykkelstasjoner...");

  try {
    const response = await fetch(BYSYKKEL_STATION_INFO_URL, {
      headers: {
        "Client-Identifier": "placy-story-generator",
      },
    });

    if (!response.ok) {
      console.error(`    ✗ Bysykkel API feil: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const stations: BysykkelStation[] = data.data?.stations || [];

    const pois: DiscoveredPOI[] = [];

    for (const station of stations) {
      // Check if within radius
      const distance = calculateDistance(
        config.center.lat,
        config.center.lng,
        station.lat,
        station.lon
      );

      if (distance > config.radius) continue;

      // Distance-based quality filter for bike stations
      if (!isWithinCategoryDistance(distance, "bike")) {
        continue;
      }

      const name = `Trondheim Bysykkel: ${station.name}`;

      // Create POI ID with source prefix (using station_id for stability)
      const id = generatePoiId("bysykkel", name, station.station_id);

      pois.push({
        id,
        name,
        coordinates: {
          lat: station.lat,
          lng: station.lon,
        },
        address: station.address,
        category: TRANSPORT_CATEGORIES.bike,
        source: "bysykkel",
        bysykkelStationId: station.station_id,
      });
    }

    console.log(`    ✓ Fant ${pois.length} bysykkelstasjoner`);
    return pois;
  } catch (error) {
    console.error("    ✗ Bysykkel API feil:", error);
    return [];
  }
}

// === Main Discovery Function ===

export async function discoverPOIs(
  config: DiscoveryConfig,
  googleApiKey: string
): Promise<DiscoveredPOI[]> {
  console.log(`\n🔍 Discovering POIs around (${config.center.lat}, ${config.center.lng})...`);
  console.log(`   Radius: ${config.radius}m\n`);

  const allPOIs: DiscoveredPOI[] = [];

  // Google Places
  if (config.googleCategories && config.googleCategories.length > 0) {
    console.log("📍 Google Places:");
    const googlePOIs = await discoverGooglePlaces(config, googleApiKey);
    allPOIs.push(...googlePOIs);
  }

  // Transport
  if (config.includeTransport !== false) {
    console.log("\n🚌 Transport:");
    const enturPOIs = await discoverEnturStops(config);
    allPOIs.push(...enturPOIs);

    const bysykkelPOIs = await discoverBysykkelStations(config);
    allPOIs.push(...bysykkelPOIs);
  }

  console.log(`\n✅ Totalt funnet: ${allPOIs.length} POI-er`);

  return allPOIs;
}

// === Helper Functions ===

/**
 * Generate a unique POI ID with source prefix.
 *
 * Uses external ID when available for stability (ID won't change if name changes).
 * Falls back to slugified name with source prefix.
 *
 * Examples:
 * - google-ChIJN1t_tDeuEmsR (using place_id)
 * - entur-NSR-StopPlace-58366 (using stopplace_id)
 * - bysykkel-123 (using station_id)
 * - google-cafe-lansen (fallback using name)
 */
function generatePoiId(
  source: "google" | "entur" | "bysykkel" | "manual",
  name: string,
  externalId?: string
): string {
  if (externalId) {
    // Clean the external ID (replace colons with dashes for URL-safety)
    const cleanId = externalId.replace(/:/g, "-");
    return `${source}-${cleanId}`;
  }
  return `${source}-${slugify(name)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export categories and utilities for use elsewhere
export { GOOGLE_CATEGORY_MAP, TRANSPORT_CATEGORIES, generatePoiId };
