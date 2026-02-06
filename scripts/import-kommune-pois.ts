/**
 * Import POIs from Trondheim Kommune WFS services
 *
 * Data sources:
 * - Badeplasser: friluftsliv:badeplass
 * - Hundeparker: kommunalteknikk:hundeparker
 * - Lekeplasser: anleggsregister:lekeplasser
 * - Parker: anleggsregister:parker
 *
 * GeoServer: https://kart.trondheim.kommune.no/geoserver/
 *
 * Usage:
 *   npm run import:kommune
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { slugify } from "../lib/utils/slugify";

dotenv.config({ path: ".env.local" });

// === Types ===

interface CategoryConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  workspace: string;
  layer: string;
}

interface Geometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

interface WfsFeature {
  type: "Feature";
  geometry: Geometry;
  properties: {
    navn?: string;
    name?: string;
    [key: string]: unknown;
  };
}

interface WfsFeatureCollection {
  type: "FeatureCollection";
  features: WfsFeature[];
}

// === Configuration ===

const CATEGORIES: CategoryConfig[] = [
  {
    id: "badeplass",
    name: "Badeplass",
    icon: "Waves",
    color: "#0ea5e9",
    workspace: "friluftsliv",
    layer: "badeplass",
  },
  {
    id: "hundepark",
    name: "Hundepark",
    icon: "Dog",
    color: "#a855f7",
    workspace: "kommunalteknikk",
    layer: "hundeparker",
  },
  {
    id: "lekeplass",
    name: "Lekeplass",
    icon: "Baby",
    color: "#22c55e",
    workspace: "anleggsregister",
    layer: "lekeplasser",
  },
  {
    id: "park",
    name: "Park",
    icon: "Trees",
    color: "#16a34a",
    workspace: "anleggsregister",
    layer: "parker",
  },
];

// Trondheim approximate bounds (with margin for surrounding areas)
const TRONDHEIM_BOUNDS = {
  minLat: 63.2,
  maxLat: 63.5,
  minLng: 10.0,
  maxLng: 10.7,
};

// === Helper Functions ===

function buildWfsUrl(workspace: string, layer: string): string {
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName: `${workspace}:${layer}`,
    outputFormat: "application/json",
    srsName: "EPSG:4326", // Request WGS84 directly - no proj4 needed!
  });
  return `https://kart.trondheim.kommune.no/geoserver/${workspace}/wfs?${params}`;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

function calculateCentroid(geometry: Geometry): { lat: number; lng: number } {
  // Get the outer ring of the first polygon
  let ring: number[][];

  if (geometry.type === "MultiPolygon") {
    // MultiPolygon: coordinates[polygon][ring][point]
    const coords = geometry.coordinates as number[][][][];
    if (!coords[0]?.[0]) throw new Error("Empty MultiPolygon");
    ring = coords[0][0];
  } else {
    // Polygon: coordinates[ring][point]
    const coords = geometry.coordinates as number[][][];
    if (!coords[0]) throw new Error("Empty Polygon");
    ring = coords[0];
  }

  // Simple centroid: average of all points
  let sumLng = 0,
    sumLat = 0;
  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }

  return {
    lng: sumLng / ring.length,
    lat: sumLat / ring.length,
  };
}

function validatePoi(
  name: string,
  lat: number,
  lng: number
): string | null {
  if (!name || name.trim() === "") return "Missing name";
  if (
    !isFinite(lat) ||
    lat < TRONDHEIM_BOUNDS.minLat ||
    lat > TRONDHEIM_BOUNDS.maxLat
  ) {
    return `Invalid latitude: ${lat}`;
  }
  if (
    !isFinite(lng) ||
    lng < TRONDHEIM_BOUNDS.minLng ||
    lng > TRONDHEIM_BOUNDS.maxLng
  ) {
    return `Invalid longitude: ${lng}`;
  }
  return null; // Valid
}

function generatePoiId(
  category: string,
  name: string,
  seenIds: Set<string>
): string {
  const baseId = `${category}-${slugify(name)}`;

  if (!seenIds.has(baseId)) {
    seenIds.add(baseId);
    return baseId;
  }

  // Handle collision by appending counter
  let counter = 2;
  while (seenIds.has(`${baseId}-${counter}`)) {
    counter++;
  }
  const uniqueId = `${baseId}-${counter}`;
  seenIds.add(uniqueId);
  console.warn(`  ⚠️  ID collision detected: "${name}" -> ${uniqueId}`);
  return uniqueId;
}

// === Main Import Logic ===

async function fetchWfsData(
  category: CategoryConfig
): Promise<WfsFeatureCollection> {
  const url = buildWfsUrl(category.workspace, category.layer);
  console.log(`  Fetching from ${category.workspace}:${category.layer}...`);

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as WfsFeatureCollection;

  if (!data.features || !Array.isArray(data.features)) {
    throw new Error("Invalid WFS response: missing features array");
  }

  return data;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Missing Supabase environment variables");
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("🗺️  Importing POIs from Trondheim Kommune WFS...\n");

  // Track all seen IDs across categories for collision detection
  const seenIds = new Set<string>();
  let totalImported = 0;
  let totalSkipped = 0;

  // Process each category
  for (const category of CATEGORIES) {
    console.log(`\n📍 ${category.name}`);

    // Ensure category exists
    const { error: categoryError } = await supabase.from("categories").upsert(
      {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
      },
      { onConflict: "id" }
    );

    if (categoryError) {
      console.error(
        `  ❌ Failed to create category: ${categoryError.message}`
      );
      continue;
    }
    console.log(`  ✓ Category ensured`);

    // Fetch WFS data
    let data: WfsFeatureCollection;
    try {
      data = await fetchWfsData(category);
      console.log(`  ✓ Fetched ${data.features.length} features`);
    } catch (error) {
      console.error(
        `  ❌ Failed to fetch: ${error instanceof Error ? error.message : error}`
      );
      continue;
    }

    // Process features
    const pois: Array<{
      id: string;
      name: string;
      lat: number;
      lng: number;
      category_id: string;
    }> = [];

    let skipped = 0;

    for (const feature of data.features) {
      const name = feature.properties.navn || feature.properties.name;

      if (!name) {
        console.warn(`  ⚠️  Skipping feature with no name`);
        skipped++;
        continue;
      }

      // Calculate centroid
      let centroid: { lat: number; lng: number };
      try {
        centroid = calculateCentroid(feature.geometry);
      } catch (error) {
        console.warn(
          `  ⚠️  Skipping "${name}": ${error instanceof Error ? error.message : error}`
        );
        skipped++;
        continue;
      }

      // Validate coordinates
      const validationError = validatePoi(name, centroid.lat, centroid.lng);
      if (validationError) {
        console.warn(`  ⚠️  Skipping "${name}": ${validationError}`);
        skipped++;
        continue;
      }

      // Generate unique ID
      const id = generatePoiId(category.id, name, seenIds);

      pois.push({
        id,
        name,
        lat: centroid.lat,
        lng: centroid.lng,
        category_id: category.id,
      });
    }

    if (pois.length === 0) {
      console.log(`  ⚠️  No valid POIs to import`);
      totalSkipped += skipped;
      continue;
    }

    // Batch upsert POIs (only factual fields - preserves editorial content)
    const { error: poiError } = await supabase
      .from("pois")
      .upsert(pois, { onConflict: "id" });

    if (poiError) {
      console.error(`  ❌ Failed to import POIs: ${poiError.message}`);
      continue;
    }

    console.log(`  ✓ Imported ${pois.length} POIs`);
    if (skipped > 0) {
      console.log(`  ⚠️  Skipped ${skipped} invalid features`);
    }

    totalImported += pois.length;
    totalSkipped += skipped;
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Import complete!`);
  console.log(`   Total imported: ${totalImported} POIs`);
  if (totalSkipped > 0) {
    console.log(`   Total skipped: ${totalSkipped} features`);
  }
  console.log(`\nView at: http://localhost:3000/admin/pois`);
  console.log(`Filter by category:`);
  for (const cat of CATEGORIES) {
    console.log(`  - ${cat.name}: /admin/pois?categories=${cat.id}`);
  }
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
