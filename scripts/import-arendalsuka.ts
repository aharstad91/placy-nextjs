/**
 * Import Arendalsuka events from Typesense search API
 *
 * Data source: Typesense hosted search (public API key)
 * Geocoding: Mapbox forward geocoding (venue addresses → coordinates)
 *
 * Arendalsuka is Norway's largest political festival (Aug 10-14, 2026).
 * 2300+ events at 30+ venues across Arendal city center.
 * Program is published gradually — re-run this script as more events appear.
 *
 * Usage:
 *   npx tsx scripts/import-arendalsuka.ts --dry-run
 *   npx tsx scripts/import-arendalsuka.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { slugify } from "../lib/utils/slugify";

dotenv.config({ path: ".env.local" });

// === Configuration ===

const TYPESENSE_HOST = "h6vy028rm4uj1tfbp-1.a2.typesense.net";
const TYPESENSE_API_KEY = "FmesrBmkVBUSYXULakewoJDL84uoNI8D";
const TYPESENSE_COLLECTION = "events";

const CUSTOMER_ID = "arendalsuka";
const PROJECT_SLUG = "arendalsuka-2026";
const PROJECT_NAME = "Arendalsuka 2026";
const PROJECT_CENTER = { lat: 58.4615, lng: 8.7725 }; // Arendal sentrum

// === Category mapping: Arendalsuka subjects → Placy categories ===

interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  sourceSubjects: string[];
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: "au-demokrati",
    name: "Demokrati & Rettigheter",
    icon: "Scale",
    color: "#2563eb",
    sourceSubjects: ["Demokrati og rettigheter"],
  },
  {
    id: "au-helse",
    name: "Helse & Velferd",
    icon: "Heart",
    color: "#dc2626",
    sourceSubjects: ["Helse og velferd"],
  },
  {
    id: "au-klima",
    name: "Klima & Miljø",
    icon: "Leaf",
    color: "#16a34a",
    sourceSubjects: ["Klima, natur og miljø"],
  },
  {
    id: "au-oppvekst",
    name: "Oppvekst & Utdanning",
    icon: "GraduationCap",
    color: "#9333ea",
    sourceSubjects: ["Oppvekst og utdanning"],
  },
  {
    id: "au-sikkerhet",
    name: "Sikkerhet & Beredskap",
    icon: "Shield",
    color: "#ea580c",
    sourceSubjects: ["Sikkerhet og beredskap"],
  },
  {
    id: "au-arbeidsliv",
    name: "Arbeidsliv",
    icon: "Briefcase",
    color: "#0891b2",
    sourceSubjects: ["Arbeidsliv"],
  },
  {
    id: "au-naering",
    name: "Næring & Økonomi",
    icon: "TrendingUp",
    color: "#ca8a04",
    sourceSubjects: ["Næring og økonomi"],
  },
  {
    id: "au-teknologi",
    name: "Teknologi & Forskning",
    icon: "Cpu",
    color: "#6366f1",
    sourceSubjects: ["Teknologi og forskning"],
  },
  {
    id: "au-energi",
    name: "Energi & Industri",
    icon: "Zap",
    color: "#f59e0b",
    sourceSubjects: ["Energi og industri"],
  },
  {
    id: "au-kultur",
    name: "Kultur & Frivillighet",
    icon: "Music",
    color: "#e11d48",
    sourceSubjects: ["Kultur og frivillighet"],
  },
  {
    id: "au-internasjonalt",
    name: "Internasjonalt",
    icon: "Globe",
    color: "#0d9488",
    sourceSubjects: ["Internasjonalt"],
  },
  {
    id: "au-stedsutvikling",
    name: "Stedsutvikling & Samferdsel",
    icon: "MapPin",
    color: "#7c3aed",
    sourceSubjects: ["Stedsutvikling og samferdsel"],
  },
  {
    id: "au-annet",
    name: "Annet",
    icon: "Star",
    color: "#64748b",
    sourceSubjects: ["Annet"],
  },
];

// === Hardcoded coordinates for venues that geocoding may struggle with ===

const VENUE_COORD_OVERRIDES: Record<string, { lat: number; lng: number }> = {
  // Main venues in Arendal sentrum — verified from map/local knowledge
  "Samfunnsteltet": { lat: 58.4612, lng: 8.7667 }, // Ferjekaia
  "Store Torungen": { lat: 58.4618, lng: 8.7716 }, // Sam Eydes plass 2
  "Bakgården": { lat: 58.4593, lng: 8.7698 }, // Nedre Tyholmsvei 16
  "Frivillighetsteltet": { lat: 58.4608, lng: 8.7672 }, // Jaktekaia
  "Bærekraftscenen": { lat: 58.4622, lng: 8.7737 }, // Friergangen 3
  "Kanalplass-scenen": { lat: 58.4612, lng: 8.7745 }, // Kanalplassen
  "Bystyresalen": { lat: 58.4618, lng: 8.7716 }, // Sam Eydes plass 2 (same as Store Torungen)
  "Torvscenen": { lat: 58.4628, lng: 8.7733 }, // Torvet
  "Ishavsskuta Berntine": { lat: 58.4595, lng: 8.7690 }, // Nedre Tyholmsvei 15
};

// === Source API types ===

interface SourceEvent {
  id: string;
  title: string;
  description: string;
  start_timestamp: number;
  end_timestamp: number;
  day_label: string;
  event_type: string;
  subjects: string[];
  organizers: string[];
  participant_names: string[];
  participant_organizations: string[];
  program_category: string[];
  venue_name: string;
  venue_address: string;
  url: string;
  language: string;
  external_id: number;
  is_canceled: boolean;
  has_streaming: boolean;
  wheelchair_accessible: boolean;
  wheelchair_wc: boolean;
  hearing_loop: boolean;
  sign_language: boolean;
  time_of_day: string;
}

// === Classification ===

function classifyEvent(subjects: string[]): CategoryDef {
  if (!subjects || subjects.length === 0) {
    return CATEGORY_DEFS[CATEGORY_DEFS.length - 1]; // "Annet"
  }
  // Use the first matching subject
  for (const subject of subjects) {
    for (const cat of CATEGORY_DEFS) {
      if (cat.sourceSubjects.includes(subject)) {
        return cat;
      }
    }
  }
  return CATEGORY_DEFS[CATEGORY_DEFS.length - 1];
}

// === Geocoding ===

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

async function geocodeVenue(
  venueName: string,
  venueAddress: string,
  mapboxToken: string
): Promise<{ lat: number; lng: number } | null> {
  // Cache key: venue name (venues have consistent names)
  if (geocodeCache.has(venueName)) return geocodeCache.get(venueName)!;

  // Check hardcoded overrides
  if (VENUE_COORD_OVERRIDES[venueName]) {
    geocodeCache.set(venueName, VENUE_COORD_OVERRIDES[venueName]);
    return VENUE_COORD_OVERRIDES[venueName];
  }

  // Mapbox forward geocoding with Arendal bbox
  const query = venueAddress
    ? `${venueAddress}, Arendal, Norway`
    : `${venueName}, Arendal, Norway`;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${mapboxToken}&limit=1&country=no&bbox=8.74,58.44,8.82,58.48`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const [lng, lat] = data.features?.[0]?.center ?? [0, 0];
    const result = lat && lng ? { lat, lng } : null;
    geocodeCache.set(venueName, result);
    return result;
  } catch {
    geocodeCache.set(venueName, null);
    return null;
  }
}

// === ID generation ===

function generatePoiId(title: string, seenIds: Set<string>): string {
  const baseId = `au-${slugify(title || "unnamed")}`;
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

// === Short ID for project ===

function generateShortId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// === Timestamp helpers ===

function formatDate(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  // Adjust for CEST (UTC+2) — Arendalsuka is in August
  const cest = new Date(d.getTime() + 2 * 60 * 60 * 1000);
  const h = String(cest.getUTCHours()).padStart(2, "0");
  const min = String(cest.getUTCMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

// === Fetch all events from Typesense ===

async function fetchAllEvents(): Promise<SourceEvent[]> {
  const allEvents: SourceEvent[] = [];
  let page = 1;
  const perPage = 250;

  while (true) {
    const url =
      `https://${TYPESENSE_HOST}/collections/${TYPESENSE_COLLECTION}/documents/search` +
      `?q=*&per_page=${perPage}&page=${page}`;

    const resp = await fetch(url, {
      headers: { "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY },
    });
    const data = await resp.json();
    const hits = data.hits || [];

    for (const hit of hits) {
      allEvents.push(hit.document as SourceEvent);
    }

    if (hits.length < perPage) break;
    page++;
  }

  return allEvents;
}

// === Main ===

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN for geocoding");
    process.exit(1);
  }

  if (!dryRun && (!supabaseUrl || !supabaseServiceKey)) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // 1. Fetch events
  console.log("Fetching events from Typesense...");
  const allEvents = await fetchAllEvents();
  console.log(`  Fetched ${allEvents.length} events`);

  // Filter out canceled events
  const events = allEvents.filter((e) => !e.is_canceled);
  const canceled = allEvents.length - events.length;
  if (canceled > 0) console.log(`  Filtered out ${canceled} canceled events`);

  // 2. Geocode unique venues
  const uniqueVenues = new Map<string, string>(); // venue_name → venue_address
  for (const event of events) {
    if (event.venue_name && !uniqueVenues.has(event.venue_name)) {
      uniqueVenues.set(event.venue_name, event.venue_address || "");
    }
  }

  console.log(`\nGeocoding ${uniqueVenues.size} unique venues...`);
  for (const [name, address] of Array.from(uniqueVenues.entries())) {
    await geocodeVenue(name, address, mapboxToken);
  }

  const geocoded = Array.from(uniqueVenues.keys()).filter(
    (v) => geocodeCache.get(v) != null
  );
  const failed = Array.from(uniqueVenues.keys()).filter(
    (v) => geocodeCache.get(v) == null
  );
  console.log(`  Geocoded: ${geocoded.length}/${uniqueVenues.size} venues`);
  if (failed.length > 0) {
    console.log("  Failed:");
    failed.forEach((v) =>
      console.log(`    - ${v} (${uniqueVenues.get(v)})`)
    );
  }

  // 3. Build POIs
  const seenIds = new Set<string>();
  const categoryCounts = new Map<string, number>();
  const skipped: string[] = [];

  const pois = events
    .map((event) => {
      const coords = geocodeCache.get(event.venue_name) || null;
      if (!coords) {
        skipped.push(`${event.title} (${event.venue_name})`);
        return null;
      }

      const category = classifyEvent(event.subjects);
      const id = generatePoiId(event.title, seenIds);

      categoryCounts.set(
        category.name,
        (categoryCounts.get(category.name) || 0) + 1
      );

      const eventDate = formatDate(event.start_timestamp);
      const timeStart = formatTime(event.start_timestamp);
      const timeEnd = formatTime(event.end_timestamp);

      // Event tags: type + accessibility
      const eventTags: string[] = [];
      if (event.event_type) eventTags.push(event.event_type);
      if (event.language && event.language !== "Norsk")
        eventTags.push(event.language);
      if (event.wheelchair_accessible) eventTags.push("Rullestol");
      if (event.hearing_loop) eventTags.push("Teleslynge");
      if (event.sign_language) eventTags.push("Tegnspråk");
      if (event.has_streaming) eventTags.push("Streaming");

      // Description: truncate for editorial_hook
      const hook = event.description
        ? event.description.substring(0, 300)
        : null;

      // Organizer string for display
      const organizer = (event.organizers || []).join(", ");

      return {
        id,
        name: event.title,
        lat: coords.lat,
        lng: coords.lng,
        category_id: category.id,
        editorial_hook: hook,
        description: null as string | null,
        featured_image: null as string | null,
        event_dates: [eventDate],
        event_time_start: timeStart,
        event_time_end: timeEnd,
        event_url: event.url || null,
        event_tags: eventTags.length > 0 ? eventTags : null,
        event_description: event.event_type || null,
        poi_metadata: {
          venue: event.venue_name,
          address: event.venue_address || null,
          organizer: organizer || null,
          subjects: event.subjects || [],
          program_category: event.program_category || [],
          external_id: event.external_id,
          datakilde: "arendalsuka.no",
        },
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // 4. Print summary
  console.log("\nCategories:");
  for (const [name, count] of Array.from(categoryCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${name}: ${count}`);
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped (no geocode): ${skipped.length}`);
    skipped.forEach((n) => console.log(`  - ${n}`));
  }

  // Venue clustering summary
  const coordGroups = new Map<string, number>();
  for (const poi of pois) {
    const key = `${poi.lat}_${poi.lng}`;
    coordGroups.set(key, (coordGroups.get(key) || 0) + 1);
  }
  const clusterCount = Array.from(coordGroups.values()).filter(
    (c) => c > 1
  ).length;
  console.log(
    `\nVenue clusters: ${clusterCount} venues with multiple events`
  );

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

  // 5. Database operations
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
  const BATCH_SIZE = 100;

  // 5a. Upsert customer
  const { error: customerError } = await supabase.from("customers").upsert(
    { id: CUSTOMER_ID, name: "Arendalsuka" },
    { onConflict: "id" }
  );
  if (customerError) {
    console.error(`Customer error: ${customerError.message}`);
    process.exit(1);
  }
  console.log("Customer upserted");

  // 5b. Upsert categories
  const usedCategories = CATEGORY_DEFS.filter((c) =>
    categoryCounts.has(c.name)
  );
  for (const cat of usedCategories) {
    const { error } = await supabase.from("categories").upsert(
      { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color },
      { onConflict: "id" }
    );
    if (error) {
      console.error(`Category "${cat.name}": ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`${usedCategories.length} categories upserted`);

  // 5c. Upsert POIs
  for (let i = 0; i < pois.length; i += BATCH_SIZE) {
    const batch = pois.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("pois")
      .upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`POI batch at ${i}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`${pois.length} POIs upserted`);

  // 5d. Upsert project
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

  // 5e. Upsert product (explorer)
  const productId = `${projectId}_explorer`;
  const { error: productError } = await supabase.from("products").upsert(
    {
      id: productId,
      project_id: projectId,
      product_type: "explorer",
      story_title: PROJECT_NAME,
      story_intro_text: `Utforsk ${pois.length} arrangementer under Arendalsuka 2026. Debatter, samtaler og seminarer — alt på ett kart, 10.–14. august.`,
    },
    { onConflict: "id" }
  );
  if (productError) {
    console.error(`Product: ${productError.message}`);
    process.exit(1);
  }
  console.log("Product: explorer");

  // 5f. Link POIs to project
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

  // 5g. Link POIs to product
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
  console.log(
    `\n  NOTE: Arendalsuka program grows to 2300+ events by August.`
  );
  console.log(`  Re-run this script to update with new events.`);
  console.log("=".repeat(50));
}

main().catch((error) => {
  console.error("\nImport failed:", error.message || error);
  process.exit(1);
});
