/**
 * Import fredede bygninger from Riksantikvaren ArcGIS REST API
 *
 * Data source: https://kart.ra.no/arcgis/rest/services/Distribusjon/Kulturminner20180301/MapServer
 * Layer 1: FredaBygninger (protected buildings, point geometry)
 * License: NLOD 2.0 (Norwegian Licence for Open Government Data)
 *
 * Usage:
 *   npm run import:riksantikvaren
 *   npm run import:riksantikvaren -- --kommune=Oslo
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { slugify } from "../lib/utils/slugify";

dotenv.config({ path: ".env.local" });

// === Configuration ===

const BASE_URL =
  "https://kart.ra.no/arcgis/rest/services/Distribusjon/Kulturminner20180301/MapServer";
const LAYER_FREDA_BYGNINGER = 1;
const MAX_RECORDS_PER_REQUEST = 200;

const CUSTOMER_ID = "trondheim-kommune";
const PROJECT_SLUG = "fredede-bygninger";
const PROJECT_NAME = "Fredede bygninger i Trondheim";
const PROJECT_CENTER = { lat: 63.4305, lng: 10.3951 }; // Torget

// Category mapping: kulturminneOpprinneligFunksjon → category
interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  keywords: string[];
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: "ra-religios",
    name: "Kirker og kapell",
    icon: "Landmark",
    color: "#8b5cf6",
    keywords: ["Religiøs", "religiøs", "Kirke", "kirke"],
  },
  {
    id: "ra-bolig",
    name: "Bolighus",
    icon: "Home",
    color: "#f59e0b",
    keywords: ["Bolig", "bolig", "bosetning"],
  },
  {
    id: "ra-forsvar",
    name: "Forsvar og militært",
    icon: "Building2",
    color: "#64748b",
    keywords: ["Forsvar", "forsvar", "Militær", "militær"],
  },
  {
    id: "ra-helse",
    name: "Helse og pleie",
    icon: "Hospital",
    color: "#ef4444",
    keywords: ["Helse", "helse", "pleie", "Sykehus"],
  },
  {
    id: "ra-naering",
    name: "Næring og handel",
    icon: "ShoppingBag",
    color: "#10b981",
    keywords: [
      "Næring",
      "næring",
      "handel",
      "Handel",
      "industri",
      "Industri",
      "Produksjon",
    ],
  },
  {
    id: "ra-utdanning",
    name: "Utdanning og kultur",
    icon: "BookOpen",
    color: "#3b82f6",
    keywords: [
      "Utdanning",
      "utdanning",
      "Kultur",
      "kultur",
      "Skole",
      "Museum",
    ],
  },
  {
    id: "ra-samferdsel",
    name: "Samferdsel",
    icon: "TrainFront",
    color: "#06b6d4",
    keywords: ["Samferdsel", "samferdsel", "Transport", "transport"],
  },
  {
    id: "ra-annet",
    name: "Øvrige kulturminner",
    icon: "Star",
    color: "#a855f7",
    keywords: [],
  },
];

// === Types ===

interface ArcGISFeature {
  attributes: {
    OBJECTID: number;
    navn?: string;
    informasjon?: string;
    kulturminneDatering?: string;
    kulturminneDateringKvalitet?: string;
    kulturminneHovedMateriale?: string;
    kulturminneOpprinneligFunksjon?: string;
    kulturminneNavaerendeFunksjon?: string;
    kulturminneKategori?: string;
    kulturminneEnkeltminneArt?: string;
    vernetype?: string;
    vernedato?: string;
    verneparagraf?: string;
    vernelov?: string;
    sefrakId?: string;
    bygningsnummer?: string;
    lokalId?: string;
    linkKulturminnesok?: string;
    linkAskeladden?: string;
    kommune?: string;
    matrikkelnummer?: string;
    [key: string]: unknown;
  };
  geometry: {
    x: number;
    y: number;
  };
}

interface ArcGISResponse {
  features: ArcGISFeature[];
  exceededTransferLimit?: boolean;
}

// === Helpers ===

function generateShortId(length = 7): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function classifyFunction(funksjon: string | undefined): CategoryDef {
  if (!funksjon) return CATEGORY_DEFS[CATEGORY_DEFS.length - 1];

  for (const cat of CATEGORY_DEFS) {
    if (cat.keywords.some((kw) => funksjon.includes(kw))) {
      return cat;
    }
  }

  return CATEGORY_DEFS[CATEGORY_DEFS.length - 1]; // "Øvrige kulturminner"
}

function buildQueryUrl(
  kommune: string,
  offset: number
): string {
  const params = new URLSearchParams({
    where: `kommune LIKE '%${kommune}%'`,
    outFields: "*",
    outSR: "4326",
    f: "json",
    resultRecordCount: String(MAX_RECORDS_PER_REQUEST),
    resultOffset: String(offset),
    returnGeometry: "true",
  });

  return `${BASE_URL}/${LAYER_FREDA_BYGNINGER}/query?${params}`;
}

function formatVernedato(raw: string | undefined): string | null {
  if (!raw || raw.length < 8) return null;
  // Format: 20120216120000 → 2012-02-16
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function generatePoiId(lokalId: string | undefined, name: string, seenIds: Set<string>): string {
  // Prefer lokalId for stable IDs
  if (lokalId) {
    const id = `ra-${lokalId.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      return id;
    }
  }

  const baseId = `ra-${slugify(name || "unnamed")}`;
  if (!seenIds.has(baseId)) {
    seenIds.add(baseId);
    return baseId;
  }

  let counter = 2;
  while (seenIds.has(`${baseId}-${counter}`)) counter++;
  const uniqueId = `${baseId}-${counter}`;
  seenIds.add(uniqueId);
  return uniqueId;
}

// === Main ===

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(
      "Error: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }

  // Parse CLI args
  const args = process.argv.slice(2);
  const kommuneArg = args
    .find((a) => a.startsWith("--kommune="))
    ?.slice("--kommune=".length);
  const kommune = kommuneArg || "Trondheim";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`\n🏛️  Importing fredede bygninger from Riksantikvaren`);
  console.log(`   Kommune: ${kommune}\n`);

  // 1. Fetch all features (paginated)
  const allFeatures: ArcGISFeature[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const url = buildQueryUrl(kommune, offset);
    console.log(`   Fetching offset ${offset}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as ArcGISResponse;

    if (!data.features || data.features.length === 0) {
      hasMore = false;
      break;
    }

    allFeatures.push(...data.features);
    offset += data.features.length;
    hasMore = !!data.exceededTransferLimit;
  }

  console.log(`\n✓ Fetched ${allFeatures.length} fredede bygninger\n`);

  if (allFeatures.length === 0) {
    console.log("No buildings found. Exiting.");
    process.exit(0);
  }

  // 2. Classify and prepare POIs
  const seenIds = new Set<string>();
  const categoryCounts = new Map<string, number>();

  const pois = allFeatures
    .map((feature) => {
      const { attributes: a, geometry: g } = feature;

      // Skip features without coordinates or name
      if (!g || !isFinite(g.x) || !isFinite(g.y)) return null;

      const name = a.navn || `Bygning ${a.OBJECTID}`;
      const category = classifyFunction(a.kulturminneOpprinneligFunksjon);
      const id = generatePoiId(a.lokalId, name, seenIds);

      categoryCounts.set(
        category.name,
        (categoryCounts.get(category.name) || 0) + 1
      );

      return {
        id,
        name,
        lat: g.y,
        lng: g.x,
        category_id: category.id,
        editorial_hook: a.informasjon || null,
        description: null as string | null,
        poi_metadata: {
          datering: a.kulturminneDatering || null,
          materiale: a.kulturminneHovedMateriale || null,
          opprinneligFunksjon: a.kulturminneOpprinneligFunksjon || null,
          nåværendeFunksjon: a.kulturminneNavaerendeFunksjon || null,
          vernetype: a.vernetype || null,
          vernedato: formatVernedato(a.vernedato),
          verneparagraf: a.verneparagraf || null,
          vernelov: a.vernelov || null,
          sefrakId: a.sefrakId || null,
          bygningsnummer: a.bygningsnummer || null,
          lokalId: a.lokalId || null,
          linkKulturminnesok: a.linkKulturminnesok || null,
          linkAskeladden: a.linkAskeladden || null,
          matrikkelnummer: a.matrikkelnummer || null,
          datakilde: "Riksantikvaren / Kulturminnesøk (NLOD 2.0)",
        },
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // Print category summary
  console.log("📊 Categories:");
  for (const [name, count] of categoryCounts.entries()) {
    console.log(`   ${name}: ${count}`);
  }
  console.log();

  // 3. Upsert categories
  const usedCategories = CATEGORY_DEFS.filter((c) =>
    categoryCounts.has(c.name)
  );

  for (const cat of usedCategories) {
    const { error } = await supabase
      .from("categories")
      .upsert(
        { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color },
        { onConflict: "id" }
      );
    if (error) {
      console.error(`❌ Category "${cat.name}": ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${usedCategories.length} categories upserted`);

  // 4. Upsert POIs in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < pois.length; i += BATCH_SIZE) {
    const batch = pois.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("pois")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`❌ POI batch at ${i}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${pois.length} POIs upserted`);

  // 5. Upsert project
  const projectId = `${CUSTOMER_ID}_${PROJECT_SLUG}`;
  const { error: projectError } = await supabase.from("projects").upsert(
    {
      id: projectId,
      customer_id: CUSTOMER_ID,
      name: PROJECT_NAME,
      url_slug: PROJECT_SLUG,
      center_lat: PROJECT_CENTER.lat,
      center_lng: PROJECT_CENTER.lng,
      short_id: generateShortId(),
    },
    { onConflict: "id" }
  );

  if (projectError) {
    console.error(`❌ Project: ${projectError.message}`);
    process.exit(1);
  }
  console.log(`✓ Project: ${PROJECT_NAME}`);

  // 6. Upsert product (explorer)
  const productId = `${projectId}_explorer`;
  const { error: productError } = await supabase.from("products").upsert(
    {
      id: productId,
      project_id: projectId,
      product_type: "explorer",
      story_title: PROJECT_NAME,
      story_intro_text:
        "Utforsk Trondheims 200 fredede bygninger — fra middelalderkirker til jugendvillaer. Basert på åpne data fra Riksantikvaren.",
    },
    { onConflict: "id" }
  );

  if (productError) {
    console.error(`❌ Product: ${productError.message}`);
    process.exit(1);
  }
  console.log(`✓ Product: explorer`);

  // 7. Link POIs to project pool (project_pois — required for container query)
  await supabase.from("project_pois").delete().eq("project_id", projectId);

  const projectPoiLinks = pois.map((poi) => ({
    project_id: projectId,
    poi_id: poi.id,
  }));

  for (let i = 0; i < projectPoiLinks.length; i += BATCH_SIZE) {
    const batch = projectPoiLinks.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("project_pois").insert(batch);
    if (error) {
      console.error(`❌ project_pois batch at ${i}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${projectPoiLinks.length} POIs linked to project`);

  // 8. Link POIs to product (product_pois — required for product-level filtering)
  await supabase.from("product_pois").delete().eq("product_id", productId);

  const productPoiLinks = pois.map((poi, index) => ({
    product_id: productId,
    poi_id: poi.id,
    sort_order: index,
  }));

  for (let i = 0; i < productPoiLinks.length; i += BATCH_SIZE) {
    const batch = productPoiLinks.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("product_pois").insert(batch);
    if (error) {
      console.error(`❌ product_pois batch at ${i}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${productPoiLinks.length} POIs linked to product`);

  // Done
  console.log("\n" + "=".repeat(50));
  console.log("✅ Import complete!\n");
  console.log(`   Bygninger: ${pois.length}`);
  console.log(`   Kategorier: ${usedCategories.length}`);
  console.log(
    `\n   Explorer: /for/trondheim-kommune/fredede-bygninger/explore`
  );
  console.log("=".repeat(50));
}

main().catch((error) => {
  console.error("\n❌ Import failed:", error.message || error);
  process.exit(1);
});
