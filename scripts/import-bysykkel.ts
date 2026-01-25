/**
 * Import bysykkel stations from Trondheim Bysykkel GBFS API
 *
 * Data source: https://gbfs.urbansharing.com/trondheimbysykkel.no/station_information.json
 *
 * Usage:
 *   npm run import:bysykkel
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const STATION_INFO_URL =
  "https://gbfs.urbansharing.com/trondheimbysykkel.no/station_information.json";
const CLIENT_IDENTIFIER = "placy-neighborhood-stories";

interface BysykkelStation {
  station_id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  capacity: number;
}

interface GBFSResponse {
  data: {
    stations: BysykkelStation[];
  };
}

async function fetchBysykkelStations(): Promise<BysykkelStation[]> {
  console.log("Fetching bysykkel stations from GBFS API...");

  const response = await fetch(STATION_INFO_URL, {
    headers: {
      "Client-Identifier": CLIENT_IDENTIFIER,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }

  const json: GBFSResponse = await response.json();

  if (!json.data?.stations) {
    throw new Error("No stations data in response");
  }

  return json.data.stations;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

  // Fetch stations from GBFS API
  const stations = await fetchBysykkelStations();
  console.log(`Found ${stations.length} bysykkel stations\n`);

  if (stations.length === 0) {
    console.log("No bysykkel stations found.");
    return;
  }

  // Ensure bike category exists
  const { error: categoryError } = await supabase.from("categories").upsert(
    { id: "bike", name: "Bysykkel", icon: "Bike", color: "#22c55e" },
    { onConflict: "id" }
  );

  if (categoryError) {
    console.error("Failed to create bike category:", categoryError.message);
    process.exit(1);
  }
  console.log("✓ Bike category ensured");

  // Delete existing bysykkel POIs (clean import)
  const { error: deleteError, count: deleteCount } = await supabase
    .from("pois")
    .delete({ count: "exact" })
    .eq("category_id", "bike");

  if (deleteError) {
    console.error("Failed to delete existing bysykkel POIs:", deleteError.message);
    process.exit(1);
  }
  console.log(`✓ Deleted ${deleteCount ?? 0} existing bysykkel POIs`);

  // Prepare POIs for batch insert
  const pois = stations.map((station) => ({
    id: `bysykkel-${station.station_id}`,
    name: station.name,
    lat: station.lat,
    lng: station.lon,
    category_id: "bike",
    bysykkel_station_id: station.station_id,
    address: station.address || null,
  }));

  // Batch insert all POIs
  const { error: poiError } = await supabase.from("pois").insert(pois);

  if (poiError) {
    console.error("Failed to import POIs:", poiError.message);
    process.exit(1);
  }

  console.log(`✓ Imported ${pois.length} bysykkel stations\n`);

  // Log station names for verification
  console.log("Stations:");
  pois.slice(0, 10).forEach((poi) => console.log(`  - ${poi.name}`));
  if (pois.length > 10) {
    console.log(`  ... and ${pois.length - 10} more`);
  }
  console.log();

  console.log("Done! View at: http://localhost:3000/admin/pois?categories=bike");
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
