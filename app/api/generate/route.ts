/**
 * Story Generator API Route
 *
 * Wraps the existing generator modules for use from the admin GUI.
 * Mirrors the logic in scripts/generate-story.ts
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

import { Project, Coordinates } from "@/lib/types";
import { discoverPOIs, DiscoveredPOI } from "@/lib/generators/poi-discovery";
import { generateStoryStructure, convertToPOI, ThemeConfig } from "@/lib/generators/story-structure";
import { mergeProjectData } from "@/lib/generators/merge-data";
import { slugify } from "@/lib/utils/slugify";

// Default configuration
const DEFAULT_THEMES: ThemeConfig[] = [
  { id: "mat-drikke", title: "Mat & Drikke" },
  { id: "transport", title: "Transport & Mobilitet" },
  { id: "trening-helse", title: "Trening & Helse" },
  { id: "daglig-liv", title: "Daglige Ærender" },
];

interface GenerateRequest {
  name: string;
  customer: string;
  center: { lat: number; lng: number };
  radius: number;
  categories: string[];
  includeTransport: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Check admin access
    if (process.env.ADMIN_ENABLED !== "true") {
      return NextResponse.json(
        { message: "Admin not enabled" },
        { status: 403 }
      );
    }

    // Parse request body
    const body: GenerateRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.customer || !body.center) {
      return NextResponse.json(
        { message: "Mangler påkrevde felt: name, customer, center" },
        { status: 400 }
      );
    }

    // Check for API keys
    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!googleApiKey) {
      return NextResponse.json(
        { message: "GOOGLE_PLACES_API_KEY er ikke konfigurert" },
        { status: 500 }
      );
    }

    const slug = slugify(body.name);

    // === Step 1: Discover POIs ===
    console.log(`[Generate] Starting discovery for: ${body.name}`);

    const discoverConfig = {
      center: body.center as Coordinates,
      radius: body.radius || 1000,
      googleCategories: body.categories || ["restaurant", "cafe", "supermarket"],
      minRating: 0,
      maxResultsPerCategory: 15,
      includeTransport: body.includeTransport !== false,
    };

    const discoveredPOIs = await discoverPOIs(discoverConfig, googleApiKey);

    if (discoveredPOIs.length === 0) {
      return NextResponse.json(
        { message: "Ingen POI-er funnet. Prøv et annet sted eller større radius." },
        { status: 400 }
      );
    }

    console.log(`[Generate] Discovered ${discoveredPOIs.length} POIs`);

    // === Step 2: Generate Story Structure ===
    // Skip travel times calculation (uses frontend runtime instead)
    const { story, allCategories, missingEditorialHooks } = generateStoryStructure(
      discoveredPOIs,
      {
        projectName: body.name,
        themes: DEFAULT_THEMES,
        maxPOIsPerSection: 10,
        featuredPOIsInMainStory: 3,
      }
    );

    console.log(`[Generate] Structure generated with ${story.themeStories.length} themes`);

    // === Step 3: Build Project Object ===
    const newProject: Project = {
      id: slug,
      name: body.name,
      customer: body.customer,
      urlSlug: slug,
      productType: "explorer",
      centerCoordinates: body.center as Coordinates,
      categories: allCategories,
      pois: discoveredPOIs.map((p) =>
        convertToPOI(p as DiscoveredPOI & { travelTime?: { walk?: number; bike?: number; car?: number } })
      ),
      story,
    };

    // === Step 4: Prepare Output Path ===
    const outputDir = path.join(process.cwd(), "data", "projects", body.customer);
    const outputPath = path.join(outputDir, `${slug}.json`);

    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Check for existing data and merge
    let finalProject = newProject;
    if (fs.existsSync(outputPath)) {
      console.log(`[Generate] Merging with existing data at ${outputPath}`);
      const existingContent = fs.readFileSync(outputPath, "utf-8");
      const existingProject: Project = JSON.parse(existingContent);
      const { project } = mergeProjectData(existingProject, newProject);
      finalProject = project;
    }

    // === Step 5: Write Output ===
    fs.writeFileSync(outputPath, JSON.stringify(finalProject, null, 2), "utf-8");
    console.log(`[Generate] Wrote output to ${outputPath}`);

    // Return success
    return NextResponse.json({
      success: true,
      path: `data/projects/${body.customer}/${slug}.json`,
      slug,
      poiCount: discoveredPOIs.length,
      themeCount: story.themeStories.length,
      missingEditorialHooks: missingEditorialHooks.length,
      projectUrl: `/${body.customer}/${slug}`,
    });
  } catch (error) {
    console.error("[Generate] Error:", error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Ukjent feil under generering",
      },
      { status: 500 }
    );
  }
}
