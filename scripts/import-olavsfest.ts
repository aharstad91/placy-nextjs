/**
 * Import Olavsfest events from olavsfest.no program page
 *
 * Data source: WordPress HTML (olavsfest.no/program/?aar=2025)
 * Geocoding: Hardcoded venue coordinates in Trondheim sentrum
 *
 * HTML structure per event:
 *   <div class="prog-arr-outer" filt-date="YYYYMMDD">
 *     <div class="progdato"><h2>dag DD. måned YYYY</h2></div>   (only first in group)
 *     <a href="..."><img src="..."></a>                          (event image)
 *     <div class="prog-arr-inner">
 *       <div class="progikon"><h5>HH.MM-HH.MM</h5></div>        (time)
 *       <div class="progklokke">
 *         <h4><a href="...">Title</a></h4>                      (title + detail URL)
 *         <p>Venue · <span class="progcat">Cat</span> · Price</p>
 *       </div>
 *     </div>
 *   </div>
 *
 * Usage:
 *   npx tsx scripts/import-olavsfest.ts --dry-run
 *   npx tsx scripts/import-olavsfest.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import * as dotenv from "dotenv";
import { slugify } from "../lib/utils/slugify";

dotenv.config({ path: ".env.local" });

// === Configuration ===

const PROGRAM_URL = "https://olavsfest.no/program/?aar=2025";

const CUSTOMER_ID = "olavsfest";
const PROJECT_SLUG = "olavsfest-2025";
const PROJECT_NAME = "Olavsfest 2025";
const PROJECT_CENTER = { lat: 63.4269, lng: 10.3969 }; // Nidarosdomen

// === Category mapping ===

interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  sourceLabels: string[];
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: "of-konserter",
    name: "Konserter",
    icon: "Music",
    color: "#7c3aed",
    sourceLabels: ["Forestilling/Konsert"],
  },
  {
    id: "of-samtale",
    name: "Samtaleprogram",
    icon: "MessageCircle",
    color: "#2563eb",
    sourceLabels: ["Snakk"],
  },
  {
    id: "of-familie",
    name: "Familiearrangement",
    icon: "Users",
    color: "#16a34a",
    sourceLabels: ["Familiearrangement"],
  },
  {
    id: "of-folkeliv",
    name: "Folkeliv",
    icon: "PartyPopper",
    color: "#ea580c",
    sourceLabels: ["Folkeliv"],
  },
  {
    id: "of-kirke",
    name: "Kirke",
    icon: "Church",
    color: "#854d0e",
    sourceLabels: ["Kirke"],
  },
  {
    id: "of-utstilling",
    name: "Utstillinger",
    icon: "Image",
    color: "#be185d",
    sourceLabels: ["Utstilling"],
  },
];

const CATEGORY_FALLBACK: CategoryDef = {
  id: "of-annet",
  name: "Annet",
  icon: "Calendar",
  color: "#6b7280",
  sourceLabels: [],
};

// === Venue coordinates (Trondheim sentrum) ===

const VENUE_COORDS: Record<string, { lat: number; lng: number }> = {
  "Nidarosdomen": { lat: 63.4269, lng: 10.3969 },
  "Borggården": { lat: 63.4271, lng: 10.3958 },
  "Vestfrontplassen": { lat: 63.4272, lng: 10.3952 },
  "Vår Frue kirke": { lat: 63.4305, lng: 10.3950 },
  "Nye Hjorten Teater": { lat: 63.4313, lng: 10.3965 },
  "Britannia Hotel": { lat: 63.4323, lng: 10.3982 },
  "Britannia": { lat: 63.4323, lng: 10.3982 },
  "Ytre Kongsgård": { lat: 63.4260, lng: 10.3975 },
  "Kongsgården": { lat: 63.4260, lng: 10.3975 },
  "Kirkehagen": { lat: 63.4268, lng: 10.3960 },
  "Prinsen kino": { lat: 63.4330, lng: 10.3983 },
  "Domkirkeparken": { lat: 63.4275, lng: 10.3965 },
  "Trondhjems Kunstforening": { lat: 63.4335, lng: 10.3972 },
  "Bifrons": { lat: 63.4342, lng: 10.4005 },
  "KFUK-KFUM": { lat: 63.4318, lng: 10.3955 },
  "Erkebispegården": { lat: 63.4263, lng: 10.3958 },
  "Bakke kirke": { lat: 63.4340, lng: 10.4045 },
  "Lian": { lat: 63.4100, lng: 10.3450 },
  "Marinen": { lat: 63.4345, lng: 10.4020 },
  "Museumsparken på Kalvskinnet": { lat: 63.4305, lng: 10.3885 },
  "Sula": { lat: 63.3850, lng: 10.1850 },
  "Trondheim Kunstmuseum": { lat: 63.4312, lng: 10.3895 },
  "Trondheim sentrum": { lat: 63.4305, lng: 10.3950 },
  "K-U-K Kjøpmannsgata": { lat: 63.4325, lng: 10.3965 },
  // Partial matches
  "Nordre gate": { lat: 63.4320, lng: 10.3970 },
};

// === Helpers ===

function classifyEvent(label: string): CategoryDef {
  const normalized = label.trim();
  for (const cat of CATEGORY_DEFS) {
    if (cat.sourceLabels.some((sl) => sl.toLowerCase() === normalized.toLowerCase())) {
      return cat;
    }
  }
  return CATEGORY_FALLBACK;
}

function generatePoiId(title: string, seenIds: Set<string>): string {
  let base = slugify(title, 50);
  if (!base) base = "event";
  let id = `of-${base}`;
  let counter = 2;
  while (seenIds.has(id)) {
    id = `of-${base}-${counter}`;
    counter++;
  }
  seenIds.add(id);
  return id;
}

function generateShortId(): string {
  return Math.random().toString(36).substring(2, 8);
}

function findVenueCoords(venueName: string): { lat: number; lng: number } | null {
  if (!venueName) return null;

  // Exact match
  if (VENUE_COORDS[venueName]) return VENUE_COORDS[venueName];

  // Case-insensitive match
  const lower = venueName.toLowerCase();
  for (const [key, coords] of Object.entries(VENUE_COORDS)) {
    if (key.toLowerCase() === lower) return coords;
  }

  // Partial match (venue name contains key or key contains venue name)
  for (const [key, coords] of Object.entries(VENUE_COORDS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return coords;
    }
  }

  return null;
}

/**
 * Parse filt-date attribute "YYYYMMDD" → "YYYY-MM-DD"
 */
function parseFiltDate(filtDate: string): string {
  if (filtDate.length !== 8) return filtDate;
  return `${filtDate.slice(0, 4)}-${filtDate.slice(4, 6)}-${filtDate.slice(6, 8)}`;
}

/**
 * Parse time "16.30-17.30" or "16:30-17:30" or "16.30" → { start, end }
 */
function parseTimeRange(timeStr: string): { start: string | null; end: string | null } {
  const cleaned = timeStr.trim().replace(/\./g, ":").replace(/–/g, "-");
  const match = cleaned.match(/(\d{1,2}:\d{2})(?:\s*-\s*(\d{1,2}:\d{2}))?/);
  if (!match) return { start: null, end: null };
  return { start: match[1], end: match[2] || null };
}

// === Parse events from HTML ===

interface RawEvent {
  title: string;
  date: string; // YYYY-MM-DD
  timeStart: string | null;
  timeEnd: string | null;
  venue: string;
  category: string;
  price: string | null;
  url: string | null;
  imageUrl: string | null;
}

function parseProgram(html: string): RawEvent[] {
  const $ = cheerio.load(html);
  const events: RawEvent[] = [];

  // Each event is a div.prog-arr-outer with filt-date attribute
  $("div.prog-arr-outer").each((_, el) => {
    const $el = $(el);
    const filtDate = $el.attr("filt-date");
    if (!filtDate) return;

    const date = parseFiltDate(filtDate);

    // There can be multiple prog-arr-inner within one prog-arr-outer
    // (but typically one)
    const $inner = $el.find("div.prog-arr-inner").first();
    if (!$inner.length) return;

    // Time: h5 inside .progikon
    const timeText = $inner.find(".progikon h5").text().trim();
    const { start: timeStart, end: timeEnd } = parseTimeRange(timeText);

    // Title: h4 a inside .progklokke
    const $titleLink = $inner.find(".progklokke h4 a");
    const title = $titleLink.text().trim();
    const url = $titleLink.attr("href") || null;

    if (!title) return;

    // Parse the <p> inside .progklokke for venue, category, price
    // Format: "Venue · <span class="progcat">Category</span> · Price"
    const $meta = $inner.find(".progklokke p");
    const category = $meta.find("span.progcat").text().trim();

    // Price: either <span class="gratis">Gratis</span> or text like "520,-"
    let price: string | null = null;
    const $gratis = $meta.find("span.gratis");
    if ($gratis.length) {
      price = "Gratis";
    } else {
      // Look for price text (numbers followed by ,-)
      const metaText = $meta.text();
      const priceMatch = metaText.match(/(\d+[,.]?-?(?:\/\d+[,.]?-?)*)/);
      if (priceMatch) {
        price = priceMatch[1];
      }
      // Check for "Utsolgt"
      if (/utsolgt/i.test(metaText)) {
        price = "Utsolgt";
      }
    }

    // Venue: text content of <p> before the first "·"
    // Remove span contents first, then get raw text
    const metaHtml = $meta.html() || "";
    // Extract text before first · that isn't inside a span
    const venueMatch = metaHtml.match(/^([^·<]+)/);
    let venue = "";
    if (venueMatch) {
      venue = venueMatch[1].replace(/<[^>]*>/g, "").trim();
    }
    // Also check: sometimes venue is text node before first ·
    if (!venue) {
      const fullText = $meta.text();
      const parts = fullText.split("·").map((s) => s.trim());
      // First part that isn't a known category or price
      for (const part of parts) {
        if (part && !CATEGORY_DEFS.some((c) => c.sourceLabels.includes(part)) && !/^\d/.test(part) && part !== "Gratis" && part !== "Utsolgt") {
          venue = part;
          break;
        }
      }
    }

    // Image URL
    const $img = $el.find("> a > img").first();
    const imageUrl = $img.attr("src") || null;

    events.push({
      title,
      date,
      timeStart,
      timeEnd,
      venue,
      category,
      price,
      url,
      imageUrl,
    });
  });

  return events;
}

// === Main ===

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // 1. Fetch and parse
  console.log(`Fetching: ${PROGRAM_URL}`);
  const response = await fetch(PROGRAM_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const html = await response.text();
  console.log(`HTML size: ${(html.length / 1024).toFixed(0)} KB`);

  const rawEvents = parseProgram(html);
  console.log(`Parsed ${rawEvents.length} events from HTML`);

  if (rawEvents.length < 50) {
    console.warn(`Warning: Only ${rawEvents.length} events (expected ~222). HTML structure may have changed.`);
    if (rawEvents.length === 0) {
      console.error("No events found. Aborting.");
      process.exit(1);
    }
  }

  // Filter to festival dates (Jul 27 – Aug 3, skip pre-events in April/December)
  const festivalEvents = rawEvents.filter((e) => e.date >= "2025-07-27" && e.date <= "2025-08-03");
  console.log(`Festival events (Jul 27 – Aug 3): ${festivalEvents.length} of ${rawEvents.length}`);

  // 2. Build POIs
  const seenIds = new Set<string>();
  const categoryCounts = new Map<string, number>();
  const skipped: string[] = [];
  const venuesMissing = new Set<string>();

  const pois = festivalEvents
    .map((event) => {
      const coords = findVenueCoords(event.venue);
      if (!coords) {
        skipped.push(`${event.title} (venue: "${event.venue}")`);
        if (event.venue) venuesMissing.add(event.venue);
        return null;
      }

      const category = classifyEvent(event.category);
      const id = generatePoiId(event.title, seenIds);

      categoryCounts.set(category.name, (categoryCounts.get(category.name) || 0) + 1);

      const eventTags: string[] = [];
      if (event.price === "Gratis") eventTags.push("Gratis");
      if (event.price === "Utsolgt") eventTags.push("Utsolgt");

      return {
        id,
        name: event.title,
        lat: coords.lat,
        lng: coords.lng,
        category_id: category.id,
        editorial_hook: null as string | null,
        description: null as string | null,
        featured_image: event.imageUrl,
        event_dates: [event.date],
        event_time_start: event.timeStart,
        event_time_end: event.timeEnd,
        event_url: event.url,
        event_tags: eventTags.length > 0 ? eventTags : null,
        event_description: event.price && event.price !== "Gratis" && event.price !== "Utsolgt" ? event.price : null,
        poi_metadata: {
          venue: event.venue,
          datakilde: "olavsfest.no",
          price: event.price,
          source_category: event.category,
        },
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // 3. Summary
  console.log("\nCategories:");
  for (const [name, count] of Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped (no venue coords): ${skipped.length}`);
    skipped.slice(0, 15).forEach((n) => console.log(`  - ${n}`));
    if (skipped.length > 15) console.log(`  ... and ${skipped.length - 15} more`);
  }

  if (venuesMissing.size > 0) {
    console.log(`\nMissing venue coordinates for:`);
    Array.from(venuesMissing).forEach((v) => {
      console.log(`  "${v}"`);
    });
  }

  const coordGroups = new Map<string, number>();
  for (const poi of pois) {
    const key = `${poi.lat}_${poi.lng}`;
    coordGroups.set(key, (coordGroups.get(key) || 0) + 1);
  }
  const clusterCount = Array.from(coordGroups.values()).filter((c) => c > 1).length;
  console.log(`\nVenue clusters: ${clusterCount} locations with multiple events`);
  console.log(`Total POIs: ${pois.length}\n`);

  if (dryRun) {
    console.log("Sample POIs:");
    for (const poi of pois.slice(0, 5)) {
      console.log(JSON.stringify(poi, null, 2));
      console.log("---");
    }
    console.log(`\nDry run complete. Use without --dry-run to import.`);
    return;
  }

  // 4. Database operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const BATCH_SIZE = 100;

  // 4a. Upsert customer
  const { error: customerError } = await supabase
    .from("customers")
    .upsert({ id: CUSTOMER_ID, name: "Olavsfest" }, { onConflict: "id" });
  if (customerError) {
    console.error(`Customer error: ${customerError.message}`);
    process.exit(1);
  }
  console.log("Customer upserted");

  // 4b. Upsert categories
  const usedCategories = [
    ...CATEGORY_DEFS.filter((c) => categoryCounts.has(c.name)),
    ...(categoryCounts.has(CATEGORY_FALLBACK.name) ? [CATEGORY_FALLBACK] : []),
  ];
  for (const cat of usedCategories) {
    const { error } = await supabase
      .from("categories")
      .upsert({ id: cat.id, name: cat.name, icon: cat.icon, color: cat.color }, { onConflict: "id" });
    if (error) {
      console.error(`Category "${cat.name}": ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`${usedCategories.length} categories upserted`);

  // 4c. Upsert POIs
  for (let i = 0; i < pois.length; i += BATCH_SIZE) {
    const batch = pois.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("pois").upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`POI batch at ${i}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`${pois.length} POIs upserted`);

  // 4d. Upsert project
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
      tags: ["Event"],
    },
    { onConflict: "id" }
  );
  if (projectError) {
    console.error(`Project: ${projectError.message}`);
    process.exit(1);
  }
  console.log(`Project: ${PROJECT_NAME} (tag: Event)`);

  // 4e. Upsert product (explorer)
  const productId = `${projectId}_explorer`;
  const { error: productError } = await supabase.from("products").upsert(
    {
      id: productId,
      project_id: projectId,
      product_type: "explorer",
      story_title: PROJECT_NAME,
      story_intro_text: `Utforsk ${pois.length} arrangementer under Olavsfest 2025. Konserter, samtaler, kirke og utstillinger — alt på ett kart, 28. juli – 3. august.`,
    },
    { onConflict: "id" }
  );
  if (productError) {
    console.error(`Product: ${productError.message}`);
    process.exit(1);
  }
  console.log("Product: explorer");

  // 4f. Link POIs to project
  await supabase.from("project_pois").delete().eq("project_id", projectId);
  const projectPoiLinks = pois.map((poi) => ({ project_id: projectId, poi_id: poi.id }));
  for (let i = 0; i < projectPoiLinks.length; i += BATCH_SIZE) {
    const batch = projectPoiLinks.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("project_pois").insert(batch);
    if (error) {
      console.error(`project_pois batch at ${i}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`${projectPoiLinks.length} POIs linked to project`);

  // 4g. Link POIs to product
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
  console.log(`  Venue clusters: ${clusterCount}`);
  console.log(`\n  Explorer: /for/${CUSTOMER_ID}/${PROJECT_SLUG}/explore`);
  console.log("=".repeat(50));
}

main().catch((error) => {
  console.error("\nImport failed:", error.message || error);
  process.exit(1);
});
