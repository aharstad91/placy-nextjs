/**
 * Migration script: Trip JSON data to Supabase trip library tables
 *
 * Reads existing guide project JSON files and migrates trip data
 * to the new trips, trip_stops, and project_trips tables.
 *
 * Usage:
 *   npx tsx scripts/migrate-trips-to-supabase.ts
 *
 * Prerequisites:
 *   - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - Run migration 016_trip_library_schema.sql first
 *   - POIs must already exist in the pois table (from migrate-to-supabase.ts)
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: Missing Supabase environment variables");
  console.error("Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Coordinate matching tolerance (±0.001° ≈ 111m)
const COORD_TOLERANCE = 0.001;

interface JsonCoordinates {
  lat: number;
  lng: number;
}

interface JsonCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface JsonPOI {
  id: string;
  name: string;
  coordinates: JsonCoordinates;
  category: JsonCategory;
  description?: string;
}

interface JsonTripStop {
  id: string;
  poiId: string;
  nameOverride?: string;
  descriptionOverride?: string;
  imageUrlOverride?: string;
  transitionText?: string;
}

interface JsonTripConfig {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  difficulty?: string;
  category?: string;
  featured?: boolean;
  sortOrder?: number;
  precomputedDistanceMeters?: number;
  precomputedDurationMinutes?: number;
  stops: JsonTripStop[];
  reward?: {
    title: string;
    description: string;
    hotelName: string;
    validityDays?: number;
  };
}

interface JsonProject {
  id: string;
  name: string;
  customer: string;
  urlSlug: string;
  productType: string;
  centerCoordinates: JsonCoordinates;
  pois: JsonPOI[];
  tripConfig?: JsonTripConfig;
}

/**
 * Find a POI in Supabase by name and approximate coordinates.
 */
async function findPoiByNameAndCoords(
  name: string,
  lat: number,
  lng: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from("pois")
    .select("id, name, lat, lng")
    .gte("lat", lat - COORD_TOLERANCE)
    .lte("lat", lat + COORD_TOLERANCE)
    .gte("lng", lng - COORD_TOLERANCE)
    .lte("lng", lng + COORD_TOLERANCE);

  if (error || !data || data.length === 0) {
    return null;
  }

  // Prefer exact name match
  const exactMatch = data.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (exactMatch) return exactMatch.id;

  // Fall back to first within coordinate range
  return data[0].id;
}

/**
 * Find the Supabase project ID for a customer + project slug.
 */
async function findProjectId(
  customerSlug: string,
  projectSlug: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("customer_id", customerSlug)
    .eq("url_slug", projectSlug)
    .single();

  if (error || !data) return null;
  return data.id;
}

/**
 * Migrate a single guide project's trip data to Supabase.
 */
async function migrateTrip(project: JsonProject): Promise<void> {
  const config = project.tripConfig;
  if (!config) {
    console.log(`  Skipping ${project.id} — no tripConfig`);
    return;
  }

  console.log(`\n  Migrating trip: ${config.title}`);

  // Build POI lookup: JSON string ID → Supabase UUID
  const poiIdMap = new Map<string, string>();
  for (const poi of project.pois) {
    const supabaseId = await findPoiByNameAndCoords(
      poi.name,
      poi.coordinates.lat,
      poi.coordinates.lng
    );
    if (supabaseId) {
      poiIdMap.set(poi.id, supabaseId);
      console.log(`    POI mapped: ${poi.id} → ${supabaseId}`);
    } else {
      console.warn(`    ⚠ POI not found in Supabase: ${poi.name} (${poi.id})`);
    }
  }

  // Generate URL slug from title
  const urlSlug = config.title
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Step 1: Insert the trip (upsert on url_slug)
  const { data: tripData, error: tripError } = await supabase
    .from("trips")
    .upsert(
      {
        title: config.title,
        description: config.description ?? null,
        url_slug: urlSlug,
        cover_image_url: config.coverImageUrl ?? null,
        category: config.category ?? null,
        difficulty: config.difficulty ?? null,
        season: "all-year",
        tags: [],
        featured: config.featured ?? false,
        city: "Trondheim",
        region: "Trøndelag",
        country: "NO",
        center_lat: project.centerCoordinates.lat,
        center_lng: project.centerCoordinates.lng,
        distance_meters: config.precomputedDistanceMeters ?? null,
        duration_minutes: config.precomputedDurationMinutes ?? null,
        default_reward_title: config.reward?.title ?? null,
        default_reward_description: config.reward?.description ?? null,
        published: true,
        created_by: "migration-script",
      },
      { onConflict: "url_slug" }
    )
    .select("id")
    .single();

  if (tripError || !tripData) {
    console.error(`    ✗ Failed to insert trip: ${tripError?.message}`);
    return;
  }

  const tripId = tripData.id;
  console.log(`    ✓ Trip inserted: ${tripId}`);

  // Step 2: Delete existing stops for this trip (idempotent)
  await supabase.from("trip_stops").delete().eq("trip_id", tripId);

  // Step 3: Insert trip stops
  let stopCount = 0;
  for (let i = 0; i < config.stops.length; i++) {
    const stop = config.stops[i];
    const supabasePoiId = poiIdMap.get(stop.poiId);

    if (!supabasePoiId) {
      console.warn(`    ⚠ Skipping stop ${stop.id} — POI ${stop.poiId} not found`);
      continue;
    }

    const { error: stopError } = await supabase.from("trip_stops").insert({
      trip_id: tripId,
      poi_id: supabasePoiId,
      sort_order: i,
      name_override: stop.nameOverride ?? null,
      description_override: stop.descriptionOverride ?? null,
      image_url_override: stop.imageUrlOverride ?? null,
      transition_text: stop.transitionText ?? null,
    });

    if (stopError) {
      console.error(`    ✗ Failed to insert stop ${i}: ${stopError.message}`);
    } else {
      stopCount++;
    }
  }
  console.log(`    ✓ ${stopCount}/${config.stops.length} stops inserted`);

  // Step 4: Link to project (if project exists in Supabase)
  // Find the base project slug (without -guide suffix)
  const baseSlug = project.urlSlug.replace(/-guide$/, "");
  const projectId = await findProjectId(project.customer, baseSlug);

  if (projectId) {
    const startPoiId = poiIdMap.get(config.stops[0]?.poiId);

    const { error: ptError } = await supabase.from("project_trips").upsert(
      {
        project_id: projectId,
        trip_id: tripId,
        sort_order: config.sortOrder ?? 0,
        enabled: true,
        start_poi_id: startPoiId ?? null,
        start_name: project.name,
        start_description: config.stops[0]?.transitionText ?? null,
        start_transition_text: config.stops[0]?.transitionText ?? null,
        reward_title: config.reward?.title ?? null,
        reward_description: config.reward?.description ?? null,
        reward_validity_days: config.reward?.validityDays ?? null,
        welcome_text: `Velkommen til ${project.name.replace(/ Guide$/, "")}`,
      },
      { onConflict: "project_id,trip_id" }
    )
    .select("id")
    .single();

    if (ptError) {
      console.error(`    ✗ Failed to link trip to project: ${ptError.message}`);
    } else {
      console.log(`    ✓ Trip linked to project: ${projectId}`);
    }
  } else {
    console.warn(`    ⚠ Project not found in Supabase: ${project.customer}/${baseSlug}`);
  }
}

/**
 * Main migration function.
 */
async function main() {
  console.log("=== Trip Library Migration ===\n");

  // Find all guide JSON files
  const dataDir = path.join(process.cwd(), "data", "projects");
  const allFiles = findJsonFiles(dataDir);

  const guideFiles = allFiles.filter((f) => f.includes("-guide"));
  console.log(`Found ${guideFiles.length} guide file(s) to migrate`);

  for (const file of guideFiles) {
    console.log(`\nProcessing: ${file}`);
    const content = fs.readFileSync(file, "utf-8");
    const project = JSON.parse(content) as JsonProject;

    if (project.productType !== "guide") {
      console.log(`  Skipping — not a guide project`);
      continue;
    }

    await migrateTrip(project);
  }

  console.log("\n=== Migration complete ===");
}

function findJsonFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJsonFiles(fullPath));
    } else if (entry.name.endsWith(".json") && !entry.name.includes("template")) {
      files.push(fullPath);
    }
  }

  return files;
}

main().catch(console.error);
