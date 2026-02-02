/**
 * Import POIs from Google My Maps (KML) into a Placy Explorer project
 *
 * Supports:
 * - Google My Maps URL (auto-extracts KML via export endpoint)
 * - Local .kml file
 *
 * Categories are determined by:
 * - Multiple KML Folders → folder names become categories
 * - Single folder + ExtendedData grouping field → field values become categories
 * - Fallback: single default category
 *
 * Usage:
 *   npm run import:kml -- <url-or-file> --customer=<slug> --name="Project Name" [--slug=<url-slug>] [--group-by=<ExtendedData field>]
 *
 * Examples:
 *   npm run import:kml -- "https://www.google.com/maps/d/viewer?mid=1R17q4gu1_9PHYprldgCJlPdxb-AGTkU" --customer=open-house-oslo --name="Open House Oslo 2025"
 *   npm run import:kml -- ./data.kml --customer=my-org --name="My Project" --group-by=Bydel
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import { XMLParser } from "fast-xml-parser";

dotenv.config({ path: ".env.local" });

// === Types ===

interface ParsedPOI {
  name: string;
  lat: number;
  lng: number;
  description: string | null;
  address: string | null;
  imageUrl: string | null;
  category: string;
  styleColor: string | null;
  extendedData: Record<string, string>;
}

interface ParsedCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface CliArgs {
  source: string;
  customer: string;
  name: string;
  slug: string | null;
  groupBy: string | null;
}

// === CLI Argument Parsing ===

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: npm run import:kml -- <url-or-file> --customer=<slug> --name="Project Name" [options]

Arguments:
  <url-or-file>          Google My Maps URL or local .kml file path

Required:
  --customer=<slug>      Customer slug (e.g., open-house-oslo)
  --name="<name>"        Project display name

Optional:
  --slug=<slug>          URL slug (defaults to slugified name)
  --group-by=<field>     ExtendedData field for categories (e.g., Bydel)

Examples:
  npm run import:kml -- "https://www.google.com/maps/d/viewer?mid=..." --customer=open-house-oslo --name="Open House Oslo 2025"
  npm run import:kml -- ./data.kml --customer=my-org --name="My Project" --group-by=Bydel
`);
    process.exit(0);
  }

  const source = args[0];
  const getFlag = (prefix: string): string | null => {
    const arg = args.find((a) => a.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : null;
  };

  const customer = getFlag("--customer=");
  const name = getFlag("--name=");
  const slug = getFlag("--slug=");
  const groupBy = getFlag("--group-by=");

  if (!source) {
    console.error("Error: Missing source (URL or file path)");
    process.exit(1);
  }
  if (!customer) {
    console.error("Error: Missing --customer=<slug>");
    process.exit(1);
  }
  if (!name) {
    console.error('Error: Missing --name="<name>"');
    process.exit(1);
  }

  return { source, customer, name, slug, groupBy };
}

// === Helpers ===

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractMapId(url: string): string | null {
  const match = url.match(/mid=([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function isUrl(source: string): boolean {
  return source.startsWith("http://") || source.startsWith("https://");
}

/**
 * Extract hex color from Google My Maps styleUrl.
 * Format: #icon-{number}-{HEXCOLOR} or #icon-{number}-{HEXCOLOR}-nodesc
 * Example: #icon-1899-0F9D58 → #0F9D58
 */
function extractColorFromStyleUrl(styleUrl: string | undefined): string | null {
  if (!styleUrl) return null;
  const match = styleUrl.match(/-([0-9A-Fa-f]{6})(?:-|$)/);
  return match ? `#${match[1]}` : null;
}

/**
 * Strip HTML tags from a string, returning plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, "") // Remove images
    .replace(/<br\s*\/?>/gi, "\n") // br → newline
    .replace(/<\/p>/gi, "\n") // </p> → newline
    .replace(/<[^>]+>/g, "") // Strip remaining tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n") // Collapse multiple newlines
    .trim();
}

/**
 * Extract the first image URL from HTML content.
 */
function extractImageUrl(html: string): string | null {
  const match = html.match(/<img[^>]+src="([^"]+)"/i);
  return match ? match[1] : null;
}

function generatePoiId(
  prefix: string,
  categorySlug: string,
  name: string,
  seenIds: Set<string>
): string {
  const baseId = `${prefix}-${categorySlug}-${slugify(name)}`;

  if (!seenIds.has(baseId)) {
    seenIds.add(baseId);
    return baseId;
  }

  let counter = 2;
  while (seenIds.has(`${baseId}-${counter}`)) {
    counter++;
  }
  const uniqueId = `${baseId}-${counter}`;
  seenIds.add(uniqueId);
  console.warn(`  ⚠️  ID collision: "${name}" → ${uniqueId}`);
  return uniqueId;
}

// === KML Fetching ===

async function fetchKml(source: string): Promise<string> {
  if (!isUrl(source)) {
    // Local file
    if (!fs.existsSync(source)) {
      throw new Error(`File not found: ${source}`);
    }
    console.log(`📄 Reading KML from file: ${source}`);
    return fs.readFileSync(source, "utf-8");
  }

  // Google My Maps URL
  const mapId = extractMapId(source);
  if (!mapId) {
    throw new Error(
      `Could not extract map ID from URL: ${source}\nExpected format: https://www.google.com/maps/d/viewer?mid=...`
    );
  }

  const kmlUrl = `https://www.google.com/maps/d/kml?mid=${mapId}&forcekml=1`;
  console.log(`🌐 Fetching KML from: ${kmlUrl}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(kmlUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          "Access denied (403). The map may be private. Try downloading the KML file manually and using a local file path."
        );
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    if (!text.includes("<kml") && !text.includes("<Document")) {
      throw new Error(
        "Response does not appear to be KML. The map may require authentication."
      );
    }

    return text;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out after 30 seconds");
    }
    throw error;
  }
}

// === KML Parsing ===

function parseKml(
  kmlText: string,
  customerSlug: string,
  groupByField: string | null
): { pois: ParsedPOI[]; categories: ParsedCategory[]; documentName: string } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => {
      // Force arrays for elements that can repeat
      return ["Folder", "Placemark", "Data", "Style", "StyleMap"].includes(
        name
      );
    },
  });

  const parsed = parser.parse(kmlText);
  const document = parsed.kml?.Document;

  if (!document) {
    throw new Error("Invalid KML: missing Document element");
  }

  const documentName = document.name || "Untitled";

  // Collect all placemarks with their folder context
  interface RawPlacemark {
    placemark: Record<string, unknown>;
    folderName: string | null;
  }

  const rawPlacemarks: RawPlacemark[] = [];

  function collectPlacemarks(
    node: Record<string, unknown>,
    folderName: string | null
  ) {
    const folders = (node.Folder as Record<string, unknown>[]) || [];
    const placemarks = (node.Placemark as Record<string, unknown>[]) || [];

    for (const pm of placemarks) {
      rawPlacemarks.push({ placemark: pm, folderName });
    }

    for (const folder of folders) {
      const name = (folder.name as string) || null;
      collectPlacemarks(folder, name);
    }
  }

  collectPlacemarks(document, null);

  if (rawPlacemarks.length === 0) {
    throw new Error("No placemarks found in KML");
  }

  // Determine distinct folder names
  const folderNames = new Set(
    rawPlacemarks
      .map((r) => r.folderName)
      .filter((n): n is string => n !== null)
  );

  // Decide category source
  const useExtendedDataGrouping =
    groupByField !== null || folderNames.size <= 1;

  // Parse placemarks
  const pois: ParsedPOI[] = [];
  const categoryColors = new Map<string, string>();

  for (const { placemark, folderName } of rawPlacemarks) {
    const name = placemark.name as string | undefined;
    if (!name) {
      console.warn("  ⚠️  Skipping placemark with no name");
      continue;
    }

    // Extract coordinates
    const point = placemark.Point as Record<string, unknown> | undefined;
    if (!point?.coordinates) {
      console.warn(`  ⚠️  Skipping "${name}": no Point coordinates`);
      continue;
    }

    const coordStr = String(point.coordinates).trim();
    const parts = coordStr.split(",");
    if (parts.length < 2) {
      console.warn(`  ⚠️  Skipping "${name}": invalid coordinates "${coordStr}"`);
      continue;
    }

    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);

    if (!isFinite(lat) || !isFinite(lng)) {
      console.warn(`  ⚠️  Skipping "${name}": non-numeric coordinates`);
      continue;
    }

    // Extract ExtendedData
    const extendedData: Record<string, string> = {};
    const extData = placemark.ExtendedData as Record<string, unknown> | undefined;
    if (extData?.Data) {
      const dataItems = extData.Data as Array<Record<string, unknown>>;
      for (const item of dataItems) {
        const fieldName = item["@_name"] as string;
        const value = item.value;
        if (fieldName && value !== undefined && value !== null && value !== "") {
          extendedData[fieldName] = String(value);
        }
      }
    }

    // Determine category
    let categoryName: string;
    const effectiveGroupBy = groupByField || "Bydel";

    if (useExtendedDataGrouping && extendedData[effectiveGroupBy]) {
      categoryName = extendedData[effectiveGroupBy];
    } else if (!useExtendedDataGrouping && folderName) {
      categoryName = folderName;
    } else {
      categoryName = "Annet";
    }

    // Extract color from styleUrl
    const styleUrl = placemark.styleUrl as string | undefined;
    const styleColor = extractColorFromStyleUrl(styleUrl);

    // Track first color seen per category
    if (styleColor && !categoryColors.has(categoryName)) {
      categoryColors.set(categoryName, styleColor);
    }

    // Extract description and image
    let description: string | null = null;
    let imageUrl: string | null = null;
    if (placemark.description) {
      const raw = String(placemark.description);
      imageUrl = extractImageUrl(raw);
      const stripped = stripHtml(raw);
      if (stripped) description = stripped;
    }

    // Extract address from ExtendedData
    const address =
      extendedData["Adresse"] ||
      extendedData["adresse"] ||
      extendedData["Address"] ||
      extendedData["address"] ||
      null;

    pois.push({
      name,
      lat,
      lng,
      description,
      address,
      imageUrl,
      category: categoryName,
      styleColor,
      extendedData,
    });
  }

  // Build category list
  const uniqueCategories = [...new Set(pois.map((p) => p.category))];
  const categories: ParsedCategory[] = uniqueCategories.map((catName) => ({
    id: `${customerSlug}-${slugify(catName)}`,
    name: catName,
    color: categoryColors.get(catName) || "#6b7280",
    icon: "MapPin",
  }));

  return { pois, categories, documentName };
}

// === Main ===

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

  const args = parseArgs();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("\n🗺️  Google My Maps → Placy Explorer Import\n");

  // 1. Fetch KML
  const kmlText = await fetchKml(args.source);
  console.log(`✓ KML fetched (${(kmlText.length / 1024).toFixed(1)} KB)\n`);

  // 2. Parse KML
  const { pois, categories, documentName } = parseKml(
    kmlText,
    args.customer,
    args.groupBy
  );

  console.log(`📋 Document: ${documentName}`);
  console.log(`📍 ${pois.length} POIs in ${categories.length} categories:\n`);

  // Print summary table
  for (const cat of categories) {
    const count = pois.filter((p) => p.category === cat.name).length;
    console.log(`   ${cat.color} ${cat.name}: ${count} steder`);
  }
  console.log();

  // 3. Calculate center
  const centerLat = pois.reduce((sum, p) => sum + p.lat, 0) / pois.length;
  const centerLng = pois.reduce((sum, p) => sum + p.lng, 0) / pois.length;
  console.log(
    `📌 Center: ${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}\n`
  );

  // 4. Upsert customer
  const customerDisplayName = args.customer
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const { error: customerError } = await supabase
    .from("customers")
    .upsert({ id: args.customer, name: customerDisplayName });

  if (customerError) {
    console.error(`❌ Failed to upsert customer: ${customerError.message}`);
    process.exit(1);
  }
  console.log(`✓ Customer: ${customerDisplayName}`);

  // 5. Upsert categories
  for (const cat of categories) {
    const { error } = await supabase
      .from("categories")
      .upsert(
        { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color },
        { onConflict: "id" }
      );

    if (error) {
      console.error(`❌ Failed to upsert category "${cat.name}": ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${categories.length} categories upserted`);

  // 6. Upsert POIs
  const seenIds = new Set<string>();
  const categoryIdMap = new Map(categories.map((c) => [c.name, c.id]));

  const dbPois = pois.map((poi) => {
    const categoryId = categoryIdMap.get(poi.category)!;
    const categorySlug = slugify(poi.category);
    const id = generatePoiId(args.customer, categorySlug, poi.name, seenIds);

    return {
      id,
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      category_id: categoryId,
      address: poi.address,
      description: poi.description,
      featured_image: poi.imageUrl,
    };
  });

  // Batch upsert (only factual fields — editorial content preserved)
  const BATCH_SIZE = 500;
  for (let i = 0; i < dbPois.length; i += BATCH_SIZE) {
    const batch = dbPois.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("pois")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`❌ Failed to upsert POIs (batch ${i}): ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${dbPois.length} POIs upserted`);

  // 7. Create project
  const projectSlug = args.slug || slugify(args.name);
  const projectId = `${args.customer}-${projectSlug}`;

  const { error: projectError } = await supabase.from("projects").upsert(
    {
      id: projectId,
      customer_id: args.customer,
      name: args.name,
      url_slug: projectSlug,
      center_lat: centerLat,
      center_lng: centerLng,
      product_type: "explorer",
    },
    { onConflict: "id" }
  );

  if (projectError) {
    console.error(`❌ Failed to upsert project: ${projectError.message}`);
    process.exit(1);
  }
  console.log(`✓ Project: ${args.name}`);

  // 8. Link POIs to project
  await supabase
    .from("project_pois")
    .delete()
    .eq("project_id", projectId);

  const poiLinks = dbPois.map((poi) => ({
    project_id: projectId,
    poi_id: poi.id,
  }));

  if (poiLinks.length > 0) {
    const { error: linkError } = await supabase
      .from("project_pois")
      .insert(poiLinks);

    if (linkError) {
      console.error(`❌ Failed to link POIs: ${linkError.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${poiLinks.length} POIs linked to project`);

  // Done!
  console.log("\n" + "=".repeat(50));
  console.log("✅ Import complete!\n");
  console.log(`   Project: ${args.name}`);
  console.log(`   POIs:    ${dbPois.length}`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`\n   Explorer: http://localhost:3000/${args.customer}/${projectSlug}`);
  console.log("=".repeat(50));
}

main().catch((error) => {
  console.error("\n❌ Import failed:", error.message || error);
  process.exit(1);
});
