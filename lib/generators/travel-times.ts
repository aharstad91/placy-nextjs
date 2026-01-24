/**
 * Travel Times Module
 * Beregner reisetider via Mapbox Matrix API
 */

import { Coordinates, TravelMode } from "../types";
import { DiscoveredPOI } from "./poi-discovery";

// === Types ===

export interface TravelTimeResult {
  poiId: string;
  walk?: number;
  bike?: number;
  car?: number;
}

// === Mapbox Matrix API ===

const MAPBOX_PROFILES: Record<TravelMode, string> = {
  walk: "walking",
  bike: "cycling",
  car: "driving",
};

// Mapbox Matrix API has a limit of 25 coordinates per request (1 origin + 24 destinations)
const MAX_DESTINATIONS_PER_REQUEST = 24;

interface MapboxMatrixResponse {
  code: string;
  durations: number[][];
}

async function calculateTravelTimesForProfile(
  origin: Coordinates,
  destinations: { id: string; coordinates: Coordinates }[],
  profile: TravelMode,
  mapboxToken: string
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const mapboxProfile = MAPBOX_PROFILES[profile];

  // Split into batches if needed
  const batches: typeof destinations[] = [];
  for (let i = 0; i < destinations.length; i += MAX_DESTINATIONS_PER_REQUEST) {
    batches.push(destinations.slice(i, i + MAX_DESTINATIONS_PER_REQUEST));
  }

  for (const batch of batches) {
    try {
      // Build coordinates string: origin first, then all destinations
      const coordinates = [
        `${origin.lng},${origin.lat}`,
        ...batch.map((d) => `${d.coordinates.lng},${d.coordinates.lat}`),
      ].join(";");

      // Destination indices (1 to n, since 0 is origin)
      const destinationIndices = batch.map((_, i) => i + 1).join(";");

      const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/${mapboxProfile}/${coordinates}?access_token=${mapboxToken}&sources=0&destinations=${destinationIndices}&annotations=duration`;

      const response = await fetch(url);

      if (!response.ok) {
        console.error(`    ✗ Mapbox API feil for ${profile}: ${response.status}`);
        continue;
      }

      const data: MapboxMatrixResponse = await response.json();

      if (data.code !== "Ok") {
        console.error(`    ✗ Mapbox API returnerte: ${data.code}`);
        continue;
      }

      // Parse durations from matrix response
      const durations = data.durations?.[0] || [];

      for (let i = 0; i < batch.length; i++) {
        const duration = durations[i];
        if (duration !== null && duration !== undefined) {
          results.set(batch[i].id, Math.ceil(duration / 60)); // Convert to minutes
        }
      }
    } catch (error) {
      console.error(`    ✗ Feil ved beregning av ${profile} tider:`, error);
    }

    // Small delay between batches to avoid rate limiting
    if (batches.length > 1) {
      await sleep(100);
    }
  }

  return results;
}

// === Main Function ===

export async function calculateTravelTimes(
  origin: Coordinates,
  pois: DiscoveredPOI[],
  mapboxToken: string,
  profiles: TravelMode[] = ["walk", "bike", "car"]
): Promise<TravelTimeResult[]> {
  console.log(`\n📏 Calculating travel times for ${pois.length} POIs...`);

  // Prepare destinations
  const destinations = pois.map((poi) => ({
    id: poi.id,
    coordinates: poi.coordinates,
  }));

  // Calculate times for each profile
  const timesByProfile: Record<TravelMode, Map<string, number>> = {
    walk: new Map(),
    bike: new Map(),
    car: new Map(),
  };

  for (const profile of profiles) {
    console.log(`   → ${profile}...`);
    timesByProfile[profile] = await calculateTravelTimesForProfile(
      origin,
      destinations,
      profile,
      mapboxToken
    );
    console.log(`     ✓ ${timesByProfile[profile].size} reisetider beregnet`);
  }

  // Combine results
  const results: TravelTimeResult[] = pois.map((poi) => ({
    poiId: poi.id,
    walk: timesByProfile.walk.get(poi.id),
    bike: timesByProfile.bike.get(poi.id),
    car: timesByProfile.car.get(poi.id),
  }));

  console.log(`\n✅ Reisetider beregnet for ${results.length} POI-er`);

  return results;
}

// === Apply Travel Times to POIs ===

export function applyTravelTimesToPOIs(
  pois: DiscoveredPOI[],
  travelTimes: TravelTimeResult[]
): DiscoveredPOI[] {
  const timeMap = new Map(travelTimes.map((t) => [t.poiId, t]));

  return pois.map((poi) => {
    const times = timeMap.get(poi.id);
    if (times) {
      return {
        ...poi,
        travelTime: {
          walk: times.walk,
          bike: times.bike,
          car: times.car,
        },
      } as DiscoveredPOI & { travelTime: { walk?: number; bike?: number; car?: number } };
    }
    return poi;
  });
}

// === Helper ===

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
