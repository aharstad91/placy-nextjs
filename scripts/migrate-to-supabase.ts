/**
 * Migration script: JSON files to Supabase
 *
 * This script reads existing project JSON files and migrates
 * the data to Supabase with proper deduplication of POIs.
 *
 * Usage:
 *   npm run migrate:supabase
 *
 * Prerequisites:
 *   - Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - Run the database migration (001_initial_schema.sql) in Supabase Dashboard
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.local explicitly
dotenv.config({ path: ".env.local" });

// Types from the JSON structure
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
  address?: string;
  category: JsonCategory;
  description?: string;
  featuredImage?: string;
  googlePlaceId?: string;
  googleRating?: number;
  googleReviewCount?: number;
  googleMapsUrl?: string;
  photoReference?: string;
  editorialHook?: string;
  localInsight?: string;
  storyPriority?: "must_have" | "nice_to_have" | "filler";
  editorialSources?: string[];
  enturStopplaceId?: string;
  bysykkelStationId?: string;
  hyreStationId?: string;
}

interface JsonThemeStorySection {
  id: string;
  title: string;
  description?: string;
  images?: string[];
  pois: string[];
}

interface JsonThemeStory {
  id: string;
  slug: string;
  title: string;
  bridgeText?: string;
  illustration?: string;
  sections: JsonThemeStorySection[];
}

interface JsonStorySection {
  id: string;
  type: string;
  categoryLabel?: string;
  title?: string;
  bridgeText?: string;
  content?: string;
  images?: string[];
  pois?: string[];
  themeStoryId?: string;
}

interface JsonStory {
  id: string;
  title: string;
  introText?: string;
  heroImages?: string[];
  sections: JsonStorySection[];
  themeStories: JsonThemeStory[];
}

interface JsonProject {
  id: string;
  name: string;
  customer: string;
  urlSlug: string;
  centerCoordinates: JsonCoordinates;
  categories: JsonCategory[];
  pois: JsonPOI[];
  story: JsonStory;
}

// Create Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: Missing Supabase environment variables");
  console.error("Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Track what's been inserted to avoid duplicates
const insertedCategories = new Set<string>();
const insertedPois = new Set<string>();
const insertedCustomers = new Set<string>();

/**
 * Find all project JSON files
 */
function findProjectFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findProjectFiles(fullPath));
    } else if (
      entry.name.endsWith(".json") &&
      !entry.name.endsWith(".input.json") &&
      !entry.name.includes("template")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Insert categories (if not already inserted)
 */
async function insertCategories(categories: JsonCategory[]): Promise<void> {
  for (const cat of categories) {
    if (insertedCategories.has(cat.id)) continue;

    const { error } = await supabase.from("categories").upsert({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
    });

    if (error) {
      console.error(`Error inserting category ${cat.id}:`, error.message);
    } else {
      insertedCategories.add(cat.id);
      console.log(`  Inserted category: ${cat.name}`);
    }
  }
}

/**
 * Insert POIs (with deduplication based on ID or googlePlaceId)
 */
async function insertPOIs(pois: JsonPOI[]): Promise<void> {
  for (const poi of pois) {
    // Skip if already inserted
    if (insertedPois.has(poi.id)) continue;

    // Upsert the POI
    const { error } = await supabase.from("pois").upsert({
      id: poi.id,
      name: poi.name,
      lat: poi.coordinates.lat,
      lng: poi.coordinates.lng,
      address: poi.address ?? null,
      category_id: poi.category.id,
      google_place_id: poi.googlePlaceId ?? null,
      google_rating: poi.googleRating ?? null,
      google_review_count: poi.googleReviewCount ?? null,
      google_maps_url: poi.googleMapsUrl ?? null,
      photo_reference: poi.photoReference ?? null,
      editorial_hook: poi.editorialHook ?? null,
      local_insight: poi.localInsight ?? null,
      story_priority: poi.storyPriority ?? null,
      editorial_sources: poi.editorialSources ?? null,
      featured_image: poi.featuredImage ?? null,
      description: poi.description ?? null,
      entur_stopplace_id: poi.enturStopplaceId ?? null,
      bysykkel_station_id: poi.bysykkelStationId ?? null,
      hyre_station_id: poi.hyreStationId ?? null,
    });

    if (error) {
      console.error(`Error inserting POI ${poi.id}:`, error.message);
    } else {
      insertedPois.add(poi.id);
      console.log(`  Inserted POI: ${poi.name}`);
    }
  }
}

/**
 * Insert customer (if not already inserted)
 */
async function insertCustomer(customerId: string): Promise<void> {
  if (insertedCustomers.has(customerId)) return;

  // Create a display name from the ID
  const displayName = customerId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const { error } = await supabase.from("customers").upsert({
    id: customerId,
    name: displayName,
  });

  if (error) {
    console.error(`Error inserting customer ${customerId}:`, error.message);
  } else {
    insertedCustomers.add(customerId);
    console.log(`  Inserted customer: ${displayName}`);
  }
}

/**
 * Insert project and all related data
 */
async function insertProject(project: JsonProject): Promise<void> {
  console.log(`\nMigrating project: ${project.name}`);

  // 1. Insert customer
  await insertCustomer(project.customer);

  // 2. Insert categories
  await insertCategories(project.categories);

  // 3. Insert POIs
  await insertPOIs(project.pois);

  // 4. Insert project
  const { error: projError } = await supabase.from("projects").upsert({
    id: project.id,
    customer_id: project.customer,
    name: project.name,
    url_slug: project.urlSlug,
    center_lat: project.centerCoordinates.lat,
    center_lng: project.centerCoordinates.lng,
    story_title: project.story.title,
    story_intro_text: project.story.introText ?? null,
    story_hero_images: project.story.heroImages ?? null,
  });

  if (projError) {
    console.error(`Error inserting project ${project.id}:`, projError.message);
    return;
  }
  console.log(`  Inserted project: ${project.name}`);

  // 5. Link POIs to project
  const projectPoiLinks = project.pois.map((poi) => ({
    project_id: project.id,
    poi_id: poi.id,
  }));

  // Delete existing links first
  await supabase
    .from("project_pois")
    .delete()
    .eq("project_id", project.id);

  if (projectPoiLinks.length > 0) {
    const { error: linkError } = await supabase
      .from("project_pois")
      .insert(projectPoiLinks);

    if (linkError) {
      console.error("Error linking POIs to project:", linkError.message);
    }
  }

  // 6. Insert theme stories
  for (let tsIndex = 0; tsIndex < project.story.themeStories.length; tsIndex++) {
    const ts = project.story.themeStories[tsIndex];

    const { error: tsError } = await supabase.from("theme_stories").upsert({
      id: ts.id,
      project_id: project.id,
      slug: ts.slug,
      title: ts.title,
      bridge_text: ts.bridgeText ?? null,
      illustration: ts.illustration ?? null,
      sort_order: tsIndex,
    });

    if (tsError) {
      console.error(`Error inserting theme story ${ts.id}:`, tsError.message);
      continue;
    }
    console.log(`  Inserted theme story: ${ts.title}`);

    // Insert theme story sections
    for (let secIndex = 0; secIndex < ts.sections.length; secIndex++) {
      const section = ts.sections[secIndex];

      const { error: secError } = await supabase
        .from("theme_story_sections")
        .upsert({
          id: section.id,
          theme_story_id: ts.id,
          title: section.title,
          description: section.description ?? null,
          images: section.images ?? null,
          sort_order: secIndex,
        });

      if (secError) {
        console.error(`Error inserting theme section ${section.id}:`, secError.message);
        continue;
      }

      // Link POIs to theme section
      if (section.pois.length > 0) {
        // Delete existing links
        await supabase
          .from("theme_section_pois")
          .delete()
          .eq("section_id", section.id);

        const poiLinks = section.pois.map((poiId, poiIndex) => ({
          section_id: section.id,
          poi_id: poiId,
          sort_order: poiIndex,
        }));

        const { error: poiLinkError } = await supabase
          .from("theme_section_pois")
          .insert(poiLinks);

        if (poiLinkError) {
          console.error("Error linking POIs to theme section:", poiLinkError.message);
        }
      }
    }
  }

  // 7. Insert story sections
  for (let secIndex = 0; secIndex < project.story.sections.length; secIndex++) {
    const section = project.story.sections[secIndex];

    const { error: secError } = await supabase.from("story_sections").upsert({
      id: section.id,
      project_id: project.id,
      type: section.type,
      sort_order: secIndex,
      category_label: section.categoryLabel ?? null,
      title: section.title ?? null,
      bridge_text: section.bridgeText ?? null,
      content: section.content ?? null,
      images: section.images ?? null,
      theme_story_id: section.themeStoryId ?? null,
    });

    if (secError) {
      console.error(`Error inserting story section ${section.id}:`, secError.message);
      continue;
    }

    // Link POIs to section
    if (section.pois && section.pois.length > 0) {
      // Delete existing links
      await supabase
        .from("section_pois")
        .delete()
        .eq("section_id", section.id);

      const poiLinks = section.pois.map((poiId, poiIndex) => ({
        section_id: section.id,
        poi_id: poiId,
        sort_order: poiIndex,
      }));

      const { error: poiLinkError } = await supabase
        .from("section_pois")
        .insert(poiLinks);

      if (poiLinkError) {
        console.error("Error linking POIs to story section:", poiLinkError.message);
      }
    }
  }
}

/**
 * Main migration function
 */
async function migrate(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Placy: JSON to Supabase Migration");
  console.log("=".repeat(60));
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log("");

  // Find all project files
  const projectsDir = path.join(process.cwd(), "data/projects");
  const projectFiles = findProjectFiles(projectsDir);

  console.log(`Found ${projectFiles.length} project file(s):`);
  projectFiles.forEach((f) => console.log(`  - ${path.relative(process.cwd(), f)}`));
  console.log("");

  // Migrate each project
  for (const file of projectFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const project: JsonProject = JSON.parse(content);

      // Validate basic structure
      if (!project.id || !project.customer || !project.story) {
        console.warn(`Skipping ${file}: Invalid project structure`);
        continue;
      }

      await insertProject(project);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Migration complete!");
  console.log(`  Categories: ${insertedCategories.size}`);
  console.log(`  POIs: ${insertedPois.size}`);
  console.log(`  Customers: ${insertedCustomers.size}`);
  console.log(`  Projects: ${projectFiles.length}`);
  console.log("=".repeat(60));
}

// Run migration
migrate().catch(console.error);
