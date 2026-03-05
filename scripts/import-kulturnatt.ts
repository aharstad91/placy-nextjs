/**
 * Import Kulturnatt Trondheim events from trdevents.no GraphQL API
 *
 * Data source: https://trdevents-224613.web.app/graphQL
 * Super event ID: eKI7BBqEEiqOFGrnaAP4
 *
 * Usage:
 *   npx tsx scripts/import-kulturnatt.ts
 *   npx tsx scripts/import-kulturnatt.ts --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { slugify } from "../lib/utils/slugify";

dotenv.config({ path: ".env.local" });

// === Configuration ===

const GRAPHQL_URL = "https://trdevents-224613.web.app/graphQL";
const SUPER_EVENT_ID = "eKI7BBqEEiqOFGrnaAP4";
const FROM_DATE = "2025-09-12T15:00:00";
const UNTIL_DATE = "2025-09-13T01:00:00";

const CUSTOMER_ID = "kulturnatt-trondheim";
const PROJECT_SLUG = "kulturnatt-2025";
const PROJECT_NAME = "Kulturnatt Trondheim 2025";
const PROJECT_CENTER = { lat: 63.4305, lng: 10.3951 }; // Torget

// === Category mapping: trdevents category → Placy category ===

interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  trdeventsIds: string[];
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: "kn-musikk",
    name: "Musikk & Konsert",
    icon: "Music",
    color: "#e11d48",
    trdeventsIds: ["CONCERT"],
  },
  {
    id: "kn-utstilling",
    name: "Utstilling & Galleri",
    icon: "Image",
    color: "#8b5cf6",
    trdeventsIds: ["EXHIBITION", "GALLERY"],
  },
  {
    id: "kn-museum",
    name: "Museum",
    icon: "Landmark",
    color: "#0ea5e9",
    trdeventsIds: ["MUSEUM"],
  },
  {
    id: "kn-teater",
    name: "Teater & Show",
    icon: "Theater",
    color: "#f59e0b",
    trdeventsIds: ["THEATER", "DANCE"],
  },
  {
    id: "kn-familie",
    name: "Familie",
    icon: "Baby",
    color: "#10b981",
    trdeventsIds: ["FAMILY"],
  },
  {
    id: "kn-verksted",
    name: "Verksted & Kurs",
    icon: "Wrench",
    color: "#f97316",
    trdeventsIds: ["COURSE", "HANDWORK"],
  },
  {
    id: "kn-foredrag",
    name: "Foredrag & Samtale",
    icon: "MessageCircle",
    color: "#6366f1",
    trdeventsIds: ["DEBATE", "DISCUSSION", "CONFERENCE", "LITERATURE"],
  },
  {
    id: "kn-mat",
    name: "Mat & Drikke",
    icon: "UtensilsCrossed",
    color: "#dc2626",
    trdeventsIds: ["FOOD_DRINKS", "MARKET"],
  },
  {
    id: "kn-film",
    name: "Film & Teknologi",
    icon: "Film",
    color: "#64748b",
    trdeventsIds: ["MOVIES", "TECHNOLOGY"],
  },
  {
    id: "kn-annet",
    name: "Annet",
    icon: "Star",
    color: "#a855f7",
    trdeventsIds: ["OTHER", "OUTDOORS", "QUIZ", "SENIOR", "SPORT", "CULTURE", "UPOLERT"],
  },
];

// === Types ===

interface TrdeventsEvent {
  id: string;
  title_nb: string;
  desc_nb: string | null;
  startDate: string;
  endDate: string;
  categories: string[];
  venue: {
    id: string;
    name: string;
    address: string | null;
    location: {
      latitude: number;
      longitude: number;
    } | null;
  } | null;
  organizers: { name: string }[];
  images: { urlLarge: string | null; urlSmall: string | null }[] | null;
  event_slug: string;
  ageRestriction: string;
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

function classifyEvent(categories: string[]): CategoryDef {
  // Priority: most specific category wins
  for (const cat of CATEGORY_DEFS) {
    if (categories.some((c) => cat.trdeventsIds.includes(c))) {
      return cat;
    }
  }
  return CATEGORY_DEFS[CATEGORY_DEFS.length - 1]; // "Annet"
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTime(dateStr: string): string {
  // "2025-09-12 15:00:00+02:00" → "15:00"
  const match = dateStr.match(/(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function generatePoiId(slug: string, seenIds: Set<string>): string {
  const baseId = `kn-${slugify(slug || "unnamed")}`;
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

// === GraphQL fetch ===

async function fetchEvents(): Promise<TrdeventsEvent[]> {
  const query = `{
    events(
      filter: {
        superEvent: "${SUPER_EVENT_ID}"
        fromDate: "${FROM_DATE}"
        untilDate: "${UNTIL_DATE}"
      }
      pageSize: 300
    ) {
      totalCount
      data {
        id
        title_nb
        desc_nb
        startDate
        endDate
        categories
        venue {
          id
          name
          address
          location {
            latitude
            longitude
          }
        }
        organizers {
          name
        }
        images {
          urlLarge
          urlSmall
        }
        event_slug
        ageRestriction
      }
    }
  }`;

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://kulturnatt-trondheim.no",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data.events.data;
}

// === Main ===

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = process.argv.includes("--dry-run");

  if (!dryRun && (!supabaseUrl || !supabaseServiceKey)) {
    console.error(
      "Error: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }

  console.log(`\nImporting Kulturnatt Trondheim 2025`);
  if (dryRun) console.log("  (DRY RUN - no database writes)\n");

  // 1. Fetch events
  const events = await fetchEvents();
  console.log(`Fetched ${events.length} events from trdevents.no\n`);

  // 2. Classify and prepare POIs
  const seenIds = new Set<string>();
  const categoryCounts = new Map<string, number>();

  const pois = events
    .map((event) => {
      const venue = event.venue;
      const loc = venue?.location;

      if (!loc?.latitude || !loc?.longitude) {
        console.warn(`  SKIP (no coords): ${event.title_nb}`);
        return null;
      }

      const category = classifyEvent(event.categories);
      const id = generatePoiId(event.event_slug, seenIds);

      categoryCounts.set(
        category.name,
        (categoryCounts.get(category.name) || 0) + 1
      );

      const timeStr = `${formatTime(event.startDate)}–${formatTime(event.endDate)}`;
      const organizers = event.organizers.map((o) => o.name).join(", ");
      const imageUrl = event.images?.[0]?.urlLarge || event.images?.[0]?.urlSmall || null;

      return {
        id,
        name: event.title_nb,
        lat: loc.latitude,
        lng: loc.longitude,
        category_id: category.id,
        editorial_hook: event.desc_nb ? stripHtml(event.desc_nb).substring(0, 300) : null,
        description: null as string | null,
        featured_image: imageUrl,
        poi_metadata: {
          venue: venue?.name || null,
          address: venue?.address || null,
          time: timeStr,
          organizers: organizers || null,
          ageRestriction: event.ageRestriction || null,
          trdeventsId: event.id,
          trdeventsSlug: event.event_slug,
          categories: event.categories,
          datakilde: "trdevents.no / Kulturnatt Trondheim",
        },
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // Print category summary
  console.log("Categories:");
  for (const [name, count] of Array.from(categoryCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${name}: ${count}`);
  }
  console.log(`\nTotal POIs: ${pois.length}\n`);

  if (dryRun) {
    console.log("Sample POIs:");
    for (const poi of pois.slice(0, 3)) {
      console.log(JSON.stringify(poi, null, 2));
      console.log("---");
    }
    console.log("\nDry run complete. Use without --dry-run to import.");
    return;
  }

  // 3. Database operations
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
  const BATCH_SIZE = 100;

  // 3a. Upsert customer
  const { error: customerError } = await supabase.from("customers").upsert(
    { id: CUSTOMER_ID, name: "Kulturnatt Trondheim" },
    { onConflict: "id" }
  );
  if (customerError) {
    console.error(`Customer error: ${customerError.message}`);
    process.exit(1);
  }
  console.log("Customer upserted");

  // 3b. Upsert categories
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
      console.error(`Category "${cat.name}": ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`${usedCategories.length} categories upserted`);

  // 3c. Upsert POIs
  for (let i = 0; i < pois.length; i += BATCH_SIZE) {
    const batch = pois.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("pois").upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`POI batch at ${i}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`${pois.length} POIs upserted`);

  // 3d. Upsert project
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
    console.error(`Project: ${projectError.message}`);
    process.exit(1);
  }
  console.log(`Project: ${PROJECT_NAME}`);

  // 3e. Upsert product (explorer)
  const productId = `${projectId}_explorer`;
  const { error: productError } = await supabase.from("products").upsert(
    {
      id: productId,
      project_id: projectId,
      product_type: "explorer",
      story_title: PROJECT_NAME,
      story_intro_text:
        "Utforsk 132 arrangementer under Kulturnatt Trondheim 2025. Konserter, utstillinger, teater, verksteder og mye mer — alt på ett kart.",
    },
    { onConflict: "id" }
  );
  if (productError) {
    console.error(`Product: ${productError.message}`);
    process.exit(1);
  }
  console.log("Product: explorer");

  // 3f. Link POIs to project
  await supabase.from("project_pois").delete().eq("project_id", projectId);
  const projectPoiLinks = pois.map((poi) => ({
    project_id: projectId,
    poi_id: poi.id,
  }));
  for (let i = 0; i < projectPoiLinks.length; i += BATCH_SIZE) {
    const batch = projectPoiLinks.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("project_pois").insert(batch);
    if (error) {
      console.error(`project_pois batch at ${i}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`${projectPoiLinks.length} POIs linked to project`);

  // 3g. Link POIs to product
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
      console.error(`product_pois batch at ${i}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`${productPoiLinks.length} POIs linked to product`);

  // Done
  console.log("\n" + "=".repeat(50));
  console.log("Import complete!\n");
  console.log(`  Events: ${pois.length}`);
  console.log(`  Categories: ${usedCategories.length}`);
  console.log(`\n  Explorer: /for/${CUSTOMER_ID}/${PROJECT_SLUG}/explore`);
  console.log("=".repeat(50));
}

main().catch((error) => {
  console.error("\nImport failed:", error.message || error);
  process.exit(1);
});
