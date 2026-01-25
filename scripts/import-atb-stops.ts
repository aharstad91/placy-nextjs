/**
 * Import ATB bus stops and Gråkallbanen tram stops from Entur
 *
 * Data source: Entur National Stop Register (NSR)
 * API: https://api.entur.io/stop-places/v1/graphql
 * Municipality: Trondheim (KVE:TopographicPlace:5001)
 *
 * Usage:
 *   npm run import:atb
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ENTUR_GRAPHQL_URL = "https://api.entur.io/stop-places/v1/graphql";
const TRONDHEIM_MUNICIPALITY = "KVE:TopographicPlace:5001";

interface EnturStopPlace {
  id: string;
  name: { value: string };
  geometry: { coordinates: [number, number] }; // [lng, lat]
}

interface EnturResponse {
  data: {
    stopPlace: EnturStopPlace[];
  };
  errors?: Array<{ message: string }>;
}

const STOP_TYPES = [
  { type: "onstreetBus", categoryId: "bus", categoryName: "Buss", icon: "Bus", color: "#3b82f6" },
  { type: "onstreetTram", categoryId: "tram", categoryName: "Trikk", icon: "Tram", color: "#f97316" },
] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchStops(stopPlaceType: string): Promise<EnturStopPlace[]> {
  const query = `
    query GetTrondheimStops {
      stopPlace(
        size: 2000
        stopPlaceType: ${stopPlaceType}
        municipalityReference: "${TRONDHEIM_MUNICIPALITY}"
      ) {
        id
        name { value }
        geometry { coordinates }
      }
    }
  `;

  const response = await fetch(ENTUR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ET-Client-Name": "placy-import",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Entur API error: ${response.status}`);
  }

  const data: EnturResponse = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL error: ${data.errors[0].message}`);
  }

  return data.data.stopPlace || [];
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

  console.log("Importing ATB stops from Entur...\n");

  let totalImported = 0;

  for (const stopType of STOP_TYPES) {
    console.log(`Fetching ${stopType.categoryName} stops...`);

    // Ensure category exists
    const { error: categoryError } = await supabase.from("categories").upsert(
      {
        id: stopType.categoryId,
        name: stopType.categoryName,
        icon: stopType.icon,
        color: stopType.color,
      },
      { onConflict: "id" }
    );

    if (categoryError) {
      console.error(`Failed to create ${stopType.categoryId} category:`, categoryError.message);
      continue;
    }

    // Fetch stops from Entur
    const stops = await fetchStops(stopType.type);
    console.log(`  Found ${stops.length} ${stopType.categoryName.toLowerCase()} stops`);

    if (stops.length === 0) continue;

    // Track seen IDs to handle duplicates
    const seenIds = new Set<string>();

    // Prepare POIs for batch upsert
    const pois = stops
      .filter((stop) => {
        // Skip stops without coordinates
        if (!stop.geometry?.coordinates) return false;
        return true;
      })
      .map((stop) => {
        let id = `${stopType.categoryId}-${slugify(stop.name.value)}`;

        // Handle duplicate names by appending Entur ID suffix
        if (seenIds.has(id)) {
          const enturIdSuffix = stop.id.split(":").pop();
          id = `${id}-${enturIdSuffix}`;
        }
        seenIds.add(id);

        return {
          id,
          name: stop.name.value,
          lat: stop.geometry.coordinates[1], // GeoJSON is [lng, lat]
          lng: stop.geometry.coordinates[0],
          category_id: stopType.categoryId,
          entur_stopplace_id: stop.id,
        };
      });

    // Batch upsert in chunks of 500
    const chunkSize = 500;
    for (let i = 0; i < pois.length; i += chunkSize) {
      const chunk = pois.slice(i, i + chunkSize);
      const { error: poiError } = await supabase.from("pois").upsert(chunk, { onConflict: "id" });

      if (poiError) {
        console.error(`Failed to import POIs (chunk ${i / chunkSize + 1}):`, poiError.message);
        continue;
      }
    }

    console.log(`  ✓ Imported ${pois.length} ${stopType.categoryName.toLowerCase()} stops`);
    totalImported += pois.length;
  }

  console.log(`\nDone! Imported ${totalImported} stops total.`);
  console.log("View at: http://localhost:3000/admin/pois?categories=bus,tram");
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
