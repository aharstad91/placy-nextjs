#!/usr/bin/env npx tsx
/**
 * Placy Story Generator
 *
 * Genererer en komplett story fra en input-fil.
 *
 * Bruk:
 *   npx tsx scripts/generate-story.ts <input-fil>
 *   npx tsx scripts/generate-story.ts data/projects/klp-eiendom/nytt-prosjekt.input.json
 *
 * Input-fil format: Se data/templates/input.template.json
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

import { Project, Coordinates, Category } from "../lib/types";
import {
  discoverPOIs,
  DiscoveredPOI,
  GOOGLE_CATEGORY_MAP,
  TRANSPORT_CATEGORIES,
} from "../lib/generators/poi-discovery";
import { calculateTravelTimes, applyTravelTimesToPOIs } from "../lib/generators/travel-times";
import {
  generateStoryStructure,
  convertToPOI,
  ThemeConfig,
} from "../lib/generators/story-structure";
import { mergeProjectData } from "../lib/generators/merge-data";
import { fetchTrails } from "../lib/generators/trail-fetcher";
import type { TrailCollection } from "../lib/types";

// === Input Types ===

interface InputFile {
  name: string;
  customer: string;
  center: { lat: number; lng: number };
  radius?: number;

  discover?: {
    googleCategories?: string[];
    minRating?: number;
    maxResultsPerCategory?: number;
    includeTransport?: boolean;
  };

  themes?: Array<{
    id: string;
    title: string;
    categories?: string[];
    bridgeText?: string;
  }>;
}

// === Default Configuration ===

const DEFAULT_GOOGLE_CATEGORIES = [
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "gym",
  "supermarket",
  "pharmacy",
];

const DEFAULT_THEMES: ThemeConfig[] = [
  { id: "mat-drikke", title: "Mat & Drikke" },
  { id: "transport", title: "Transport & Mobilitet" },
  { id: "trening-helse", title: "Trening & Helse" },
  { id: "daglig-liv", title: "Daglige Ærender" },
];

// === Main Script ===

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const inputPath = args[0];
  const isUpdate = args.includes("--update");

  // Validate input file exists
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input-fil ikke funnet: ${inputPath}`);
    process.exit(1);
  }

  // Check for API keys
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!googleApiKey) {
    console.error("❌ GOOGLE_PLACES_API_KEY mangler i .env.local");
    process.exit(1);
  }

  if (!mapboxToken) {
    console.error("❌ NEXT_PUBLIC_MAPBOX_TOKEN mangler i .env.local");
    process.exit(1);
  }

  // Read input file
  console.log(`\n📄 Leser input: ${inputPath}`);
  const inputContent = fs.readFileSync(inputPath, "utf-8");
  const input: InputFile = JSON.parse(inputContent);

  // Validate required fields
  if (!input.name || !input.customer || !input.center) {
    console.error("❌ Input-fil mangler påkrevde felt: name, customer, center");
    process.exit(1);
  }

  // Determine output path
  const outputDir = path.dirname(inputPath);
  const baseName = path.basename(inputPath, ".input.json");
  const outputPath = path.join(outputDir, `${baseName}.json`);

  // Check for existing data
  let existingProject: Project | null = null;
  if (fs.existsSync(outputPath)) {
    console.log(`📂 Fant eksisterende data: ${outputPath}`);
    const existingContent = fs.readFileSync(outputPath, "utf-8");
    existingProject = JSON.parse(existingContent);
  }

  console.log(`\n🚀 Genererer story for: ${input.name}`);
  console.log(`   Kunde: ${input.customer}`);
  console.log(`   Sentrum: (${input.center.lat}, ${input.center.lng})`);
  console.log(`   Radius: ${input.radius || 1000}m`);

  // === Step 1: Discover POIs ===
  const discoverConfig = {
    center: input.center as Coordinates,
    radius: input.radius || 1000,
    googleCategories: input.discover?.googleCategories || DEFAULT_GOOGLE_CATEGORIES,
    minRating: input.discover?.minRating || 0,
    maxResultsPerCategory: input.discover?.maxResultsPerCategory || 20,
    includeTransport: input.discover?.includeTransport !== false,
  };

  const discoveredPOIs = await discoverPOIs(discoverConfig, googleApiKey);

  if (discoveredPOIs.length === 0) {
    console.error("\n❌ Ingen POI-er funnet. Sjekk koordinater og radius.");
    process.exit(1);
  }

  // === Step 2: Calculate Travel Times (optional) ===
  let poisWithTravelTimes = discoveredPOIs;
  const skipTravelTimes = args.includes("--skip-travel-times");

  if (!skipTravelTimes) {
    try {
      const travelTimes = await calculateTravelTimes(
        input.center as Coordinates,
        discoveredPOIs,
        mapboxToken
      );
      poisWithTravelTimes = applyTravelTimesToPOIs(discoveredPOIs, travelTimes);
    } catch (error) {
      console.log("\n⚠️  Kunne ikke beregne reisetider (Matrix API krever betalt Mapbox-tilgang)");
      console.log("   Reisetider beregnes av frontend ved runtime.\n");
    }
  } else {
    console.log("\n⏭️  Skipper reisetidsberegning (--skip-travel-times)");
    console.log("   Reisetider beregnes av frontend ved runtime.\n");
  }

  // === Step 2.5: Fetch Trails from Overpass API (optional) ===
  let trailData: TrailCollection | undefined;
  const skipTrails = args.includes("--skip-trails");

  if (!skipTrails) {
    try {
      console.log("\n🗺️  Henter sykkelruter og turstier fra Overpass/OSM...");
      trailData = await fetchTrails({
        lat: input.center.lat,
        lng: input.center.lng,
        radiusKm: (input.radius || 1000) / 1000 * 3, // Use 3x discovery radius for trails
      });
      console.log(`   Fant ${trailData.features.length} navngitte ruter`);
      for (const f of trailData.features.slice(0, 5)) {
        console.log(`   - ${f.properties.name} (${f.properties.routeType})`);
      }
      if (trailData.features.length > 5) {
        console.log(`   ... og ${trailData.features.length - 5} til`);
      }
    } catch (error) {
      console.log("\n⚠️  Kunne ikke hente trails fra Overpass API");
      console.log(`   ${error instanceof Error ? error.message : "Ukjent feil"}\n`);
    }
  } else {
    console.log("\n⏭️  Skipper trail-henting (--skip-trails)");
  }

  // === Step 3: Generate Story Structure ===
  const themes = input.themes || DEFAULT_THEMES;

  const { story, allCategories, missingEditorialHooks } = generateStoryStructure(
    poisWithTravelTimes,
    {
      projectName: input.name,
      themes: themes as ThemeConfig[],
      maxPOIsPerSection: 10,
      featuredPOIsInMainStory: 3,
    }
  );

  // === Step 4: Build Project Object ===
  const newProject: Project = {
    id: slugify(baseName),
    name: input.name,
    customer: input.customer,
    urlSlug: slugify(baseName),
    productType: "explorer",
    centerCoordinates: input.center as Coordinates,
    categories: allCategories,
    pois: poisWithTravelTimes.map((p) => convertToPOI(p as DiscoveredPOI & { travelTime?: { walk?: number; bike?: number; car?: number } })),
    story,
    ...(trailData && trailData.features.length > 0 && {
      reportConfig: { trails: trailData },
    }),
  };

  // === Step 5: Merge with Existing Data ===
  const { project: finalProject, stats } = mergeProjectData(
    existingProject,
    newProject
  );

  // === Step 6: Write Output ===
  console.log(`\n💾 Skriver til: ${outputPath}`);
  fs.writeFileSync(outputPath, JSON.stringify(finalProject, null, 2), "utf-8");

  // === Summary ===
  console.log("\n" + "=".repeat(50));
  console.log("✅ Story generert!");
  console.log("=".repeat(50));
  console.log(`   📍 POI-er: ${stats.totalPOIs}`);
  console.log(`      - Nye: ${stats.newPOIs}`);
  console.log(`      - Oppdatert: ${stats.updatedPOIs}`);
  console.log(`      - Bevart: ${stats.preservedPOIs}`);
  console.log(`   📖 Theme Stories: ${finalProject.story.themeStories.length}`);
  console.log(`   📄 Seksjoner: ${finalProject.story.sections.length}`);

  if (missingEditorialHooks.length > 0) {
    console.log(`\n⚠️  ${missingEditorialHooks.length} POI-er mangler editorial hooks.`);
    console.log("   Kjør følgende i Claude Code for å generere:");
    console.log(`   "Generer editorial hooks for POI-ene i ${outputPath}"`);
  }

  console.log(`\n📂 Output: ${outputPath}`);
  console.log(`🌐 URL: /${input.customer}/${slugify(baseName)}/`);
}

// === Helper Functions ===

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function printUsage() {
  console.log(`
Placy Story Generator
=====================

Bruk:
  npx tsx scripts/generate-story.ts <input-fil> [options]

Argumenter:
  <input-fil>   Path til .input.json fil

Options:
  --update            Oppdater eksisterende data (merger ny data)
  --skip-travel-times Skip reisetidsberegning (bruker frontend runtime)
  --skip-trails       Skip henting av sykkelruter/turstier fra Overpass
  --help, -h          Vis denne hjelpeteksten

Eksempel:
  npx tsx scripts/generate-story.ts data/projects/klp-eiendom/nytt.input.json

Input-fil format:
  Se data/templates/input.template.json for eksempel.

Miljøvariabler (kreves i .env.local):
  GOOGLE_PLACES_API_KEY    Google Places API nøkkel
  NEXT_PUBLIC_MAPBOX_TOKEN Mapbox access token
`);
}

// Run
main().catch((error) => {
  console.error("\n❌ Feil:", error.message);
  process.exit(1);
});
