/**
 * Import Festspillene i Bergen (Bergen International Festival) events
 * from Storyblok CMS via public CDN API.
 *
 * Data sources:
 *   - Events: Storyblok component=Event (showings with date/time/venue)
 *   - Productions: Storyblok starts_with=no/program/2026/ (descriptions, images)
 *   - Venues: Storyblok starts_with=no/praktisk-info/arenaer/ (coordinates)
 *
 * Events are grouped by production — repeated showings become one POI
 * with multiple event_dates. Unique events get their own POI.
 *
 * Usage:
 *   npx tsx scripts/import-festspillene.ts
 *   npx tsx scripts/import-festspillene.ts --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { slugify } from "../lib/utils/slugify";

dotenv.config({ path: ".env.local" });

// === Configuration ===

const STORYBLOK_TOKEN = "9GLqtx9xc3ueOm5rVi0sZgtt";
const STORYBLOK_BASE = "https://api.storyblok.com/v2/cdn";
const YEAR = "2026";

const CUSTOMER_ID = "festspillene-bergen";
const PROJECT_SLUG = "festspillene-2026";
const PROJECT_NAME = "Festspillene i Bergen 2026";
const PROJECT_CENTER = { lat: 60.391, lng: 5.324 }; // Bergen sentrum

// === Category mapping: fib.no genre UUID → Placy category ===

interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  storyblokNames: string[]; // Names from fib.no Storyblok categories
}

const GENRE_CATEGORIES: CategoryDef[] = [
  {
    id: "fib-musikk",
    name: "Musikk",
    icon: "Music",
    color: "#e11d48",
    storyblokNames: ["Musikk"],
  },
  {
    id: "fib-opera",
    name: "Opera",
    icon: "Mic",
    color: "#9333ea",
    storyblokNames: ["Opera"],
  },
  {
    id: "fib-teater",
    name: "Teater & Scenekunst",
    icon: "Theater",
    color: "#f59e0b",
    storyblokNames: ["Teater"],
  },
  {
    id: "fib-dans",
    name: "Dans",
    icon: "Footprints",
    color: "#ec4899",
    storyblokNames: ["Dans"],
  },
  {
    id: "fib-ordskifte",
    name: "Ordskifte & Samtale",
    icon: "MessageCircle",
    color: "#6366f1",
    storyblokNames: ["Ordskifte", "m/Ordskifte"],
  },
  {
    id: "fib-familie",
    name: "Familie",
    icon: "Baby",
    color: "#10b981",
    storyblokNames: ["Familie"],
  },
  {
    id: "fib-annet",
    name: "Annet",
    icon: "Star",
    color: "#64748b",
    storyblokNames: [],
  },
];

// Tags (not categories) — mapped to event_tags
const TAG_NAMES = new Set(["Gratis", "Utendørs"]);

// Venue names in fib.no categories (to skip as genre)
const KNOWN_VENUE_NAMES = new Set([
  "Grieghallen",
  "Troldhaugen",
  "Bergen Offentlige Bibliotek",
  "Det Vestnorske Teateret",
  "Litteraturhuset i Bergen",
  "Torgallmenningen",
  "Siljustøl",
  "Johanneskirken",
  "USF Verftet",
  "Studio Bergen",
  "Østre",
  "Kulturhuset i Bergen",
  "Rasmussen Samlingene",
  "Gamlehaugen",
  "Valestrand",
  "Bergen Kjøtt",
  "Håkonshallen",
  "Korskirken",
  "Universitetsaulaen",
]);

// Hardcoded coordinates for venues missing them in Storyblok
const VENUE_COORD_FALLBACKS: Record<string, { lat: number; lng: number }> = {
  Johanneskirken: { lat: 60.3934, lng: 5.3264 },
  "Hallen USF": { lat: 60.3968, lng: 5.3073 },
  "USF Verftet": { lat: 60.3968, lng: 5.3073 },
  "Bergen Kjøtt": { lat: 60.3917, lng: 5.319 },
  "Kode, Permanenten": { lat: 60.3905, lng: 5.3258 },
  Torgallmenningen: { lat: 60.3926, lng: 5.3245 },
  Fløibanen: { lat: 60.3965, lng: 5.3285 },
  Valestrand: { lat: 60.3926, lng: 5.3245 }, // Fallback to Bergen center
  "Bergen sentrum": { lat: 60.3926, lng: 5.3245 },
  Ute: { lat: 60.3926, lng: 5.3245 },
  "Fana Kulturhus": { lat: 60.3189, lng: 5.3483 },
};

// === Types ===

interface StoryblokStory {
  uuid: string;
  name: string;
  slug: string;
  full_slug: string;
  content: Record<string, unknown>;
}

interface VenueData {
  uuid: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
}

interface ProductionData {
  uuid: string;
  syncId: string | null;
  name: string;
  slug: string;
  excerpt: string | null;
  thumbnailUrl: string | null;
  venueUuid: string | null;
  bookingUrl: string | null;
  categoryUuids: string[];
}

interface EventData {
  uuid: string;
  name: string;
  startTime: string; // "2026-06-09 18:30"
  endTime: string;
  duration: string;
  venueUuid: string;
  scene: string | null;
  productionId: string | null;
  productionUuids: string[];
  freeEvent: boolean;
  categoryUuids: string[];
  bookingUrl: string | null;
}

// === Storyblok API helpers ===

async function fetchAllStories(
  params: string,
  label: string
): Promise<StoryblokStory[]> {
  const stories: StoryblokStory[] = [];
  let page = 1;
  let total = 0;

  do {
    const url = `${STORYBLOK_BASE}/stories?token=${STORYBLOK_TOKEN}&version=published&per_page=100&page=${page}&${params}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Storyblok ${label} HTTP ${response.status}`);
    }
    const data = await response.json();
    total = data.total;
    stories.push(...data.stories);
    page++;
  } while (stories.length < total);

  return stories;
}

async function fetchStoryByUuid(uuid: string): Promise<StoryblokStory | null> {
  const url = `${STORYBLOK_BASE}/stories/${uuid}?token=${STORYBLOK_TOKEN}&version=published&find_by=uuid`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  return data.story || null;
}

// === Data fetchers ===

async function fetchVenues(): Promise<Map<string, VenueData>> {
  const stories = await fetchAllStories(
    "starts_with=no/praktisk-info/arenaer/",
    "venues"
  );
  // UUID → VenueData, plus name → VenueData for fallback lookups
  const map = new Map<string, VenueData>();
  const byName = new Map<string, VenueData>();

  for (const s of stories) {
    const c = s.content;
    const name = (c.SyncName as string) || s.name;
    let lat = parseFloat(c.SyncLatitude as string) || 0;
    let lng = parseFloat(c.SyncLongitude as string) || 0;

    // Use fallback coordinates for venues missing them
    if ((!lat || !lng) && VENUE_COORD_FALLBACKS[name]) {
      lat = VENUE_COORD_FALLBACKS[name].lat;
      lng = VENUE_COORD_FALLBACKS[name].lng;
    }

    if (!lat || !lng) continue; // Skip venues we can't locate

    const venue: VenueData = {
      uuid: s.uuid,
      name,
      lat,
      lng,
      address: (c.SyncAddressOne as string) || null,
      city: (c.SyncCity as string) || null,
    };
    map.set(s.uuid, venue);
    byName.set(name, venue);
  }

  // Add fallback venues that don't exist as Storyblok stories
  for (const [name, coords] of Object.entries(VENUE_COORD_FALLBACKS)) {
    if (!byName.has(name)) {
      const fallbackVenue: VenueData = {
        uuid: `fallback-${slugify(name)}`,
        name,
        lat: coords.lat,
        lng: coords.lng,
        address: null,
        city: "Bergen",
      };
      byName.set(name, fallbackVenue);
    }
  }

  // Store byName lookup on the map for fallback resolution
  (map as VenueMap).__byName = byName;
  return map;
}

type VenueMap = Map<string, VenueData> & {
  __byName?: Map<string, VenueData>;
};

async function fetchProductions(): Promise<Map<string, ProductionData>> {
  const stories = await fetchAllStories(
    `starts_with=no/program/${YEAR}/`,
    "productions"
  );
  const map = new Map<string, ProductionData>();

  for (const s of stories) {
    const c = s.content;
    const thumbnailUrl =
      (c.thumbnail as { filename?: string })?.filename || null;

    const prod: ProductionData = {
      uuid: s.uuid,
      syncId: (c.SyncId as string) || null,
      name: s.name,
      slug: s.slug,
      excerpt: (c.excerpt as string) || null,
      thumbnailUrl,
      venueUuid: (c.SyncVenue as string) || null,
      bookingUrl: (c.SyncBookingLink as { url?: string })?.url || null,
      categoryUuids: (c.Categories as string[]) || [],
    };

    map.set(s.uuid, prod);
    if (prod.syncId) {
      map.set(`syncId:${prod.syncId}`, prod);
    }
  }

  return map;
}

async function fetchEvents(): Promise<EventData[]> {
  const stories = await fetchAllStories(
    "filter_query[component][in]=Event",
    "events"
  );

  return stories.map((s) => {
    const c = s.content;
    return {
      uuid: s.uuid,
      name: s.name,
      startTime: (c.SyncEventStartTime as string) || "",
      endTime: (c.SyncEventEndTime as string) || "",
      duration: (c.SyncEventDuration as string) || "",
      venueUuid: (c.SyncVenue as string) || "",
      scene: (c.SyncScene as string) || null,
      productionId: (c.SyncProductionId as string) || null,
      productionUuids: (c.SyncProduction as string[]) || [],
      freeEvent: (c.SyncFreeEvent as boolean) || false,
      categoryUuids: (c.SyncCategories as string[]) || [],
      bookingUrl: (c.SyncBookingLink as { url?: string })?.url || null,
    };
  });
}

// === Category resolution ===

async function buildCategoryNameMap(
  events: EventData[],
  productions: Map<string, ProductionData>
): Promise<Map<string, string>> {
  const allUuids = new Set<string>();
  events.forEach((e) => e.categoryUuids.forEach((u) => allUuids.add(u)));
  productions.forEach((p) => p.categoryUuids.forEach((u) => allUuids.add(u)));

  const nameMap = new Map<string, string>();
  for (const uuid of Array.from(allUuids)) {
    const story = await fetchStoryByUuid(uuid);
    if (story) nameMap.set(uuid, story.name);
  }
  return nameMap;
}

function classifyByCategories(
  categoryUuids: string[],
  categoryNames: Map<string, string>
): { category: CategoryDef; tags: string[] } {
  const names = categoryUuids
    .map((u) => categoryNames.get(u))
    .filter((n): n is string => !!n);

  // Extract tags
  const tags = names.filter((n) => TAG_NAMES.has(n));

  // Find genre (skip venue names and tags)
  const genreNames = names.filter(
    (n) => !KNOWN_VENUE_NAMES.has(n) && !TAG_NAMES.has(n)
  );

  for (const cat of GENRE_CATEGORIES) {
    if (genreNames.some((n) => cat.storyblokNames.includes(n))) {
      return { category: cat, tags };
    }
  }

  return { category: GENRE_CATEGORIES[GENRE_CATEGORIES.length - 1], tags }; // "Annet"
}

// === Helpers ===

function generateShortId(length = 7): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function extractDate(dateTimeStr: string): string | null {
  const match = dateTimeStr.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function extractTime(dateTimeStr: string): string | null {
  const match = dateTimeStr.match(/(\d{2}:\d{2})$/);
  return match ? match[1] : null;
}

function generatePoiId(slug: string, seenIds: Set<string>): string {
  const baseId = `fib-${slugify(slug || "unnamed")}`;
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
  const dryRun = process.argv.includes("--dry-run");

  if (!dryRun && (!supabaseUrl || !supabaseServiceKey)) {
    console.error(
      "Error: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }

  console.log(`\nImporting ${PROJECT_NAME}`);
  if (dryRun) console.log("  (DRY RUN - no database writes)\n");

  // 1. Fetch all data from Storyblok
  console.log("Fetching data from Storyblok...");
  const [events, venues, productions] = await Promise.all([
    fetchEvents(),
    fetchVenues(),
    fetchProductions(),
  ]);
  console.log(
    `  Events: ${events.length}, Venues: ${venues.size}, Productions: ${productions.size}`
  );

  // 2. Resolve category names
  console.log("Resolving categories...");
  const categoryNames = await buildCategoryNameMap(events, productions);
  console.log(`  Resolved ${categoryNames.size} category names`);

  // 3. Group events by production
  // Events with same productionId → one POI with multiple dates
  // Events without productionId → each is its own POI
  interface EventGroup {
    production: ProductionData | null;
    events: EventData[];
    name: string;
  }

  const groupMap = new Map<string, EventGroup>();

  for (const event of events) {
    let groupKey: string;
    let production: ProductionData | null = null;

    if (event.productionId) {
      groupKey = `prod:${event.productionId}`;
      production = productions.get(`syncId:${event.productionId}`) || null;
    } else if (event.productionUuids.length > 0) {
      // Use first production UUID as group key
      groupKey = `uuid:${event.productionUuids[0]}`;
      production = productions.get(event.productionUuids[0]) || null;
    } else {
      // Unique event — use event UUID as group key
      groupKey = `event:${event.uuid}`;
    }

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        production,
        events: [],
        name: production?.name || event.name.replace(/\s*-\s*\d{2}\.\d{2}$/, ""),
      });
    }
    groupMap.get(groupKey)!.events.push(event);
  }

  console.log(
    `\nGrouped ${events.length} events into ${groupMap.size} POIs`
  );

  // 4. Build POIs
  const seenIds = new Set<string>();
  const categoryCounts = new Map<string, number>();
  const skippedNoVenue: string[] = [];

  const pois = Array.from(groupMap.values())
    .map((group) => {
      const { production, events: groupEvents, name } = group;

      // Resolve venue: production's SyncVenue → venue map (primary path)
      // Event's SyncVenue in fib.no points to Category stories, not Venue stories.
      // Production's SyncVenue points to actual Venue/Arena stories.
      const primaryEvent = groupEvents[0];
      const venueMap = venues as VenueMap;

      // 1. Try production's venue UUID (most reliable)
      let venue = production?.venueUuid
        ? venues.get(production.venueUuid)
        : null;

      // 2. Try event's venue UUID (sometimes it's a real venue)
      if (!venue && primaryEvent.venueUuid) {
        venue = venues.get(primaryEvent.venueUuid);
      }

      // 3. Fallback: resolve event's venue UUID to a name, match by name
      if (!venue && primaryEvent.venueUuid && categoryNames.has(primaryEvent.venueUuid)) {
        const venueName = categoryNames.get(primaryEvent.venueUuid)!;
        venue = venueMap.__byName?.get(venueName) || null;
      }

      if (!venue) {
        skippedNoVenue.push(name);
        return null;
      }

      // Aggregate dates from all events in group
      const eventDatesSet = new Set(
        groupEvents
          .map((e) => extractDate(e.startTime))
          .filter((d): d is string => !!d)
      );
      const eventDates = Array.from(eventDatesSet).sort();

      // Use first event's time (most showings have consistent times)
      const timeStart = extractTime(primaryEvent.startTime);
      const timeEnd = extractTime(primaryEvent.endTime);

      // Classify by category — merge from event + production categories
      const catUuidSet = new Set([
        ...primaryEvent.categoryUuids,
        ...(production?.categoryUuids || []),
      ]);
      const allCatUuids = Array.from(catUuidSet);
      const { category, tags: eventTags } = classifyByCategories(
        allCatUuids,
        categoryNames
      );

      // Add "Gratis" tag if any event in group is free
      if (groupEvents.some((e) => e.freeEvent) && !eventTags.includes("Gratis")) {
        eventTags.push("Gratis");
      }

      categoryCounts.set(
        category.name,
        (categoryCounts.get(category.name) || 0) + 1
      );

      const id = generatePoiId(
        production?.slug || slugify(name),
        seenIds
      );

      // Build event URL: link to fib.no production page
      const eventUrl = production?.slug
        ? `https://www.fib.no/program/${YEAR}/${production.slug}`
        : production?.bookingUrl || primaryEvent.bookingUrl || null;

      // Build thumbnail URL with Cloudinary transforms for optimization
      let featuredImage = production?.thumbnailUrl || null;
      if (featuredImage?.includes("cloudinary.com")) {
        // Add responsive transform: 800px wide, auto quality
        featuredImage = featuredImage.replace(
          "/upload/",
          "/upload/w_800,q_auto,f_auto/"
        );
      }

      return {
        id,
        name,
        lat: venue.lat,
        lng: venue.lng,
        category_id: category.id,
        editorial_hook: production?.excerpt || null,
        description: null as string | null,
        featured_image: featuredImage,
        // Event fields
        event_dates: eventDates.length > 0 ? eventDates : null,
        event_time_start: timeStart,
        event_time_end: timeEnd,
        event_description: primaryEvent.duration || null,
        event_url: eventUrl,
        event_tags: eventTags.length > 0 ? eventTags : null,
        poi_metadata: {
          venue: venue.name,
          scene: primaryEvent.scene,
          address: venue.address,
          city: venue.city,
          showings: groupEvents.length,
          freeEvent: groupEvents.some((e) => e.freeEvent),
          bookingUrl: production?.bookingUrl || primaryEvent.bookingUrl || null,
          datakilde: "Storyblok / Festspillene i Bergen",
        },
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // Print summary
  console.log("\nCategories:");
  for (const [name, count] of Array.from(categoryCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${name}: ${count}`);
  }

  if (skippedNoVenue.length > 0) {
    console.log(`\nSkipped (no venue coordinates): ${skippedNoVenue.length}`);
    skippedNoVenue.forEach((n) => console.log(`  - ${n}`));
  }

  // Date range
  const allDates = pois
    .flatMap((p) => p.event_dates || [])
    .sort();
  const dateRange =
    allDates.length > 0
      ? `${allDates[0]} → ${allDates[allDates.length - 1]}`
      : "no dates";
  console.log(`\nDate range: ${dateRange}`);
  console.log(`Total POIs: ${pois.length}\n`);

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
    { id: CUSTOMER_ID, name: "Festspillene i Bergen" },
    { onConflict: "id" }
  );
  if (customerError) {
    console.error(`Customer error: ${customerError.message}`);
    process.exit(1);
  }
  console.log("Customer upserted");

  // 5b. Upsert categories
  const usedCategories = GENRE_CATEGORIES.filter((c) =>
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

  // 5d. Upsert project (with Event tag for bransjeprofil)
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
      story_intro_text: `Utforsk ${pois.length} forestillinger og arrangementer under Festspillene i Bergen ${YEAR}. Konserter, opera, teater, dans, ordskifter og mye mer — alt på ett kart.`,
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
  console.log(`  Date range: ${dateRange}`);
  console.log(`  Free events: ${pois.filter((p) => p.event_tags?.includes("Gratis")).length}`);
  console.log(
    `\n  Explorer: /for/${CUSTOMER_ID}/${PROJECT_SLUG}/explore`
  );
  console.log("=".repeat(50));
}

main().catch((error) => {
  console.error("\nImport failed:", error.message || error);
  process.exit(1);
});
