/**
 * POI Discovery Module
 * Henter POI-er fra Google Places, Entur, og Trondheim Bysykkel
 */

import { POI, Category, Coordinates } from "../types";

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

interface GooglePlaceResult {
  place_id: string;
  name: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
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
        // Filter by rating
        if (place.rating && place.rating < minRating) {
          continue;
        }

        // Limit per category
        if (addedCount >= maxPerCategory) {
          break;
        }

        // Create POI ID from name (slug)
        const id = slugify(place.name);

        // Check for duplicates (same name already added)
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

      if (modes.includes("rail")) {
        category = TRANSPORT_CATEGORIES.train;
        suffix = " stasjon";
      } else if (modes.includes("tram")) {
        category = TRANSPORT_CATEGORIES.tram;
        suffix = " holdeplass";
      } else if (modes.includes("metro")) {
        category = TRANSPORT_CATEGORIES.train;
        suffix = " T-bane";
      } else {
        suffix = " bussholdeplass";
      }

      const name = place.name + (place.name.toLowerCase().includes("holdeplass") || place.name.toLowerCase().includes("stasjon") ? "" : suffix);
      const id = slugify(name);

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

      const name = `Trondheim Bysykkel: ${station.name}`;
      const id = slugify(name);

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export categories for use elsewhere
export { GOOGLE_CATEGORY_MAP, TRANSPORT_CATEGORIES };
