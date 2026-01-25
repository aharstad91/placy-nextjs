/**
 * Import Hyre car-sharing stations from Entur Mobility API
 *
 * Data source: https://api.entur.io/mobility/v2/graphql
 * System: hyrenorge
 *
 * Usage:
 *   npm run import:hyre
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ENTUR_MOBILITY_ENDPOINT = "https://api.entur.io/mobility/v2/graphql";
const ET_CLIENT_NAME = "placy-neighborhood-stories";

// Trondheim center coordinates with 15km range
const TRONDHEIM_CENTER = {
  lat: 63.43,
  lon: 10.4,
  range: 15000, // meters
};

const HYRE_STATIONS_QUERY = `
  query GetHyreStations($lat: Float!, $lon: Float!, $range: Int!) {
    stations(
      lat: $lat
      lon: $lon
      range: $range
      availableFormFactors: [CAR]
      systems: ["hyrenorge"]
    ) {
      id
      name {
        translation {
          value
        }
      }
      lat
      lon
      address
      numVehiclesAvailable
    }
  }
`;

interface HyreStation {
  id: string;
  name: {
    translation: Array<{ value: string }>;
  };
  lat: number;
  lon: number;
  address: string | null;
  numVehiclesAvailable: number;
}

interface GraphQLResponse {
  data?: {
    stations: HyreStation[];
  };
  errors?: Array<{ message: string }>;
}

async function fetchHyreStations(): Promise<HyreStation[]> {
  console.log("Fetching Hyre stations from Entur Mobility API...");

  const response = await fetch(ENTUR_MOBILITY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ET-Client-Name": ET_CLIENT_NAME,
    },
    body: JSON.stringify({
      query: HYRE_STATIONS_QUERY,
      variables: {
        lat: TRONDHEIM_CENTER.lat,
        lon: TRONDHEIM_CENTER.lon,
        range: TRONDHEIM_CENTER.range,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }

  const json: GraphQLResponse = await response.json();

  if (json.errors) {
    throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  if (!json.data?.stations) {
    throw new Error("No stations data in response");
  }

  return json.data.stations;
}

function extractStationId(fullId: string): string {
  // ID format: "YHY:VehicleSharingParkingArea:12345"
  const parts = fullId.split(":");
  return parts[parts.length - 1] || fullId;
}

function getStationName(station: HyreStation): string {
  return station.name?.translation?.[0]?.value || `Hyre ${extractStationId(station.id)}`;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Missing Supabase environment variables");
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch stations from Entur
  const stations = await fetchHyreStations();
  console.log(`Found ${stations.length} Hyre stations\n`);

  if (stations.length === 0) {
    console.log("No Hyre stations found in the Trondheim area.");
    return;
  }

  // Ensure carshare category exists
  const { error: categoryError } = await supabase.from("categories").upsert(
    { id: "carshare", name: "Bildeling", icon: "CarFront", color: "#10b981" },
    { onConflict: "id" }
  );

  if (categoryError) {
    console.error("Failed to create carshare category:", categoryError.message);
    process.exit(1);
  }
  console.log("✓ Carshare category ensured");

  // Prepare POIs for batch upsert
  const pois = stations.map((station) => ({
    id: `hyre-${extractStationId(station.id)}`,
    name: getStationName(station),
    lat: station.lat,
    lng: station.lon,
    category_id: "carshare",
    hyre_station_id: station.id,
    address: station.address || null,
  }));

  // Batch upsert all POIs at once
  const { error: poiError } = await supabase
    .from("pois")
    .upsert(pois, { onConflict: "id" });

  if (poiError) {
    console.error("Failed to import POIs:", poiError.message);
    process.exit(1);
  }

  console.log(`✓ Imported ${pois.length} Hyre stations\n`);

  // Log station names for verification
  console.log("Stations:");
  pois.forEach((poi) => console.log(`  - ${poi.name}`));
  console.log();

  console.log("Done! View at: http://localhost:3000/admin/pois?categories=carshare");
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
