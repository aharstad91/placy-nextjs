/**
 * Import Oslo Kulturnatt events from oslokulturnatt.no REST API
 *
 * Data source: https://www.oslokulturnatt.no/api/events
 * Geocoding: Mapbox forward geocoding (addresses → coordinates)
 *
 * Usage:
 *   npx tsx scripts/import-oslo-kulturnatt.ts --dry-run
 *   npx tsx scripts/import-oslo-kulturnatt.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { slugify } from "../lib/utils/slugify";

dotenv.config({ path: ".env.local" });

// === Configuration ===

const API_URL = "https://www.oslokulturnatt.no/api/events";

const CUSTOMER_ID = "oslo-kulturnatt";
const PROJECT_SLUG = "kulturnatt-2025";
const PROJECT_NAME = "Oslo Kulturnatt 2025";
const PROJECT_CENTER = { lat: 59.9139, lng: 10.7522 }; // Oslo sentrum

// === Category mapping: oslokulturnatt tags → Placy categories ===

interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  sourceTags: string[];
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: "okn-musikk",
    name: "Musikk & Dans",
    icon: "Music",
    color: "#e11d48",
    sourceTags: ["Musikk og dans"],
  },
  {
    id: "okn-kunst",
    name: "Kunst",
    icon: "Image",
    color: "#8b5cf6",
    sourceTags: ["Kunst"],
  },
  {
    id: "okn-arkitektur",
    name: "Arkitektur & Design",
    icon: "Building2",
    color: "#0ea5e9",
    sourceTags: ["Arkitektur og design"],
  },
  {
    id: "okn-utforsk",
    name: "Utforsk",
    icon: "Compass",
    color: "#10b981",
    sourceTags: ["Utforsk"],
  },
  {
    id: "okn-annet",
    name: "Annet",
    icon: "Star",
    color: "#64748b",
    sourceTags: [],
  },
];

// === Hardcoded coordinates for venues that geocoding can't resolve ===
// (multi-location events, landmarks, or ambiguous addresses)

const VENUE_COORD_OVERRIDES: Record<string, { lat: number; lng: number }> = {
  // Multi-location event — pin at first listed location (Spikersuppa)
  "Spikersuppa, Slottsparken, Vigelandsmausoleet, Nesoddbåten tur/retur, Oslofjorden, Akershus festning (ytterside)":
    { lat: 59.9133, lng: 10.7378 },
  // Landmarks
  Youngstorget: { lat: 59.9148, lng: 10.7494 },
  Egertorget: { lat: 59.9147, lng: 10.7401 },
  "Jernbanetorget/Oslo S v/Tigeren": { lat: 59.9111, lng: 10.7528 },
  Frognerparken: { lat: 59.927, lng: 10.7013 },
  "Christiania torv 1": { lat: 59.9102, lng: 10.7414 },
  "Schous Plass": { lat: 59.9219, lng: 10.7612 },
  "Nedre Foss Gård / Mad Goats Akerselva": { lat: 59.9255, lng: 10.7525 },
  Sukkerbiten: { lat: 59.9068, lng: 10.7524 },
  // Compound addresses (geocoding won't handle "og" well)
  "Pilestredet 24 og Kristian Augusts gate 11": { lat: 59.9195, lng: 10.7367 },
};

// Name-based fallbacks for events with empty venue fields
const EVENT_NAME_COORD_FALLBACKS: Record<string, { lat: number; lng: number; venue: string }> = {
  "Gaustad sykehus 170 år": { lat: 59.9472, lng: 10.7167, venue: "Gaustad sykehus" },
  "Oslo kulturnatt på Naturhistorisk museum": { lat: 59.9197, lng: 10.7704, venue: "Naturhistorisk museum" },
  "Kulturnatt i Oslo domkirke": { lat: 59.9116, lng: 10.7468, venue: "Oslo Domkirke" },
};

// === Types ===

interface OsloKulturnattEvent {
  start_time: number;
  end_time: number;
  externalId: string;
  name: string;
  description: string;
  externalVenueName: string;
  start_time_iso: string;
  end_time_iso: string;
  published: boolean;
  imagekitRef?: {
    url?: string;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
  } | null;
  imageUrl?: string;
  tags: string[];
  custom_fields?: {
    arrangør?: string;
    link?: string;
    age?: string;
    numberOfVisitors?: string;
    hcParking?: boolean;
    hcEntrance?: boolean;
    hcWheelchair?: boolean;
    hcToilet?: boolean;
    directions?: string;
  };
}

// === Geocoding ===

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

async function geocodeAddress(
  address: string,
  mapboxToken: string
): Promise<{ lat: number; lng: number } | null> {
  // Check cache (includes overrides from previous calls)
  if (geocodeCache.has(address)) {
    return geocodeCache.get(address)!;
  }

  // Check overrides
  if (VENUE_COORD_OVERRIDES[address]) {
    geocodeCache.set(address, VENUE_COORD_OVERRIDES[address]);
    return VENUE_COORD_OVERRIDES[address];
  }

  // Append ", Oslo, Norway" for better results
  const query = `${address}, Oslo, Norway`;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=1&country=no&bbox=10.5,59.8,10.95,60.0`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`  Geocode HTTP ${response.status} for "${address}"`);
      geocodeCache.set(address, null);
      return null;
    }

    const data = await response.json();
    const feature = data.features?.[0];

    if (!feature) {
      console.warn(`  Geocode: no results for "${address}"`);
      geocodeCache.set(address, null);
      return null;
    }

    const [lng, lat] = feature.center;
    const result = { lat, lng };
    geocodeCache.set(address, result);
    return result;
  } catch (error) {
    console.warn(`  Geocode error for "${address}": ${error}`);
    geocodeCache.set(address, null);
    return null;
  }
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

function classifyEvent(tags: string[]): CategoryDef {
  for (const cat of CATEGORY_DEFS) {
    if (tags.some((t) => cat.sourceTags.includes(t))) {
      return cat;
    }
  }
  return CATEGORY_DEFS[CATEGORY_DEFS.length - 1]; // "Annet"
}

function formatTime(isoStr: string): string | null {
  if (!isoStr) return null;
  // "2025-09-12T07:00:00.000Z" → convert to local Norwegian time (UTC+2 in September)
  const d = new Date(isoStr);
  const hours = d.getUTCHours() + 2; // CEST = UTC+2
  const mins = d.getUTCMinutes();
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function extractDate(isoStr: string): string | null {
  if (!isoStr) return null;
  // Adjust for CEST — event at 2025-09-12T22:00:00.000Z is still Sep 12 in Norway
  const d = new Date(isoStr);
  d.setUTCHours(d.getUTCHours() + 2);
  return d.toISOString().split("T")[0];
}

function generatePoiId(slug: string, seenIds: Set<string>): string {
  const baseId = `okn-${slugify(slug || "unnamed")}`;
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
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const dryRun = process.argv.includes("--dry-run");

  if (!mapboxToken) {
    console.error("Error: Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local");
    process.exit(1);
  }

  if (!dryRun && (!supabaseUrl || !supabaseServiceKey)) {
    console.error(
      "Error: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }

  console.log(`\nImporting ${PROJECT_NAME}`);
  if (dryRun) console.log("  (DRY RUN - no database writes)\n");

  // 1. Fetch events
  console.log("Fetching events from oslokulturnatt.no...");
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`API HTTP ${response.status}: ${response.statusText}`);
  }
  const events: OsloKulturnattEvent[] = await response.json();
  const publishedEvents = events.filter((e) => e.published);
  console.log(
    `  Fetched ${events.length} events (${publishedEvents.length} published)\n`
  );

  // 2. Geocode unique venues
  const uniqueVenues = Array.from(
    new Set(publishedEvents.map((e) => e.externalVenueName).filter(Boolean))
  );
  console.log(`Geocoding ${uniqueVenues.length} unique venues...`);

  for (const venue of uniqueVenues) {
    await geocodeAddress(venue, mapboxToken);
  }

  const geocoded = uniqueVenues.filter((v) => geocodeCache.get(v) != null);
  const failed = uniqueVenues.filter((v) => geocodeCache.get(v) == null);
  console.log(
    `  Geocoded: ${geocoded.length}/${uniqueVenues.length} venues`
  );
  if (failed.length > 0) {
    console.log(`  Failed:`);
    failed.forEach((v) => console.log(`    - ${v}`));
  }

  // 3. Build POIs
  const seenIds = new Set<string>();
  const categoryCounts = new Map<string, number>();
  const skipped: string[] = [];

  const pois = publishedEvents
    .map((event) => {
      // Resolve coordinates: geocoded venue → name-based fallback
      let coords = geocodeCache.get(event.externalVenueName) || null;
      let venueName = event.externalVenueName;

      if (!coords && EVENT_NAME_COORD_FALLBACKS[event.name]) {
        const fallback = EVENT_NAME_COORD_FALLBACKS[event.name];
        coords = { lat: fallback.lat, lng: fallback.lng };
        venueName = fallback.venue;
      }

      if (!coords) {
        skipped.push(event.name);
        return null;
      }

      const category = classifyEvent(event.tags);
      const id = generatePoiId(event.name, seenIds);

      categoryCounts.set(
        category.name,
        (categoryCounts.get(category.name) || 0) + 1
      );

      const eventDate = extractDate(event.start_time_iso);
      const timeStart = formatTime(event.start_time_iso);
      const timeEnd = formatTime(event.end_time_iso);

      // Image: prefer imagekitRef.url, fallback to imageUrl
      const imageUrl =
        event.imagekitRef?.url || event.imageUrl || null;

      // Build event URL from custom_fields.link
      const eventUrl = event.custom_fields?.link
        ? event.custom_fields.link.startsWith("http")
          ? event.custom_fields.link
          : `https://${event.custom_fields.link}`
        : null;

      // Accessibility tags
      const eventTags: string[] = [];
      if (event.custom_fields?.age === "Åpent for alle")
        eventTags.push("Åpent for alle");
      if (event.custom_fields?.hcWheelchair) eventTags.push("Rullestol");

      return {
        id,
        name: event.name.replace(/^"|"$/g, ""), // Strip surrounding quotes
        lat: coords.lat,
        lng: coords.lng,
        category_id: category.id,
        editorial_hook: event.description
          ? event.description.substring(0, 300)
          : null,
        description: null as string | null,
        featured_image: imageUrl,
        event_dates: eventDate ? [eventDate] : null,
        event_time_start: timeStart,
        event_time_end: timeEnd,
        event_url: eventUrl,
        event_tags: eventTags.length > 0 ? eventTags : null,
        poi_metadata: {
          venue: venueName,
          arrangør: event.custom_fields?.arrangør || null,
          age: event.custom_fields?.age || null,
          capacity: event.custom_fields?.numberOfVisitors || null,
          hcParking: event.custom_fields?.hcParking || false,
          hcEntrance: event.custom_fields?.hcEntrance || false,
          hcWheelchair: event.custom_fields?.hcWheelchair || false,
          hcToilet: event.custom_fields?.hcToilet || false,
          externalId: event.externalId,
          datakilde: "oslokulturnatt.no",
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

  if (skipped.length > 0) {
    console.log(`\nSkipped (no geocode): ${skipped.length}`);
    skipped.forEach((n) => console.log(`  - ${n}`));
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

  // 4. Database operations
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
  const BATCH_SIZE = 100;

  // 4a. Upsert customer
  const { error: customerError } = await supabase.from("customers").upsert(
    { id: CUSTOMER_ID, name: "Oslo Kulturnatt" },
    { onConflict: "id" }
  );
  if (customerError) {
    console.error(`Customer error: ${customerError.message}`);
    process.exit(1);
  }
  console.log("Customer upserted");

  // 4b. Upsert categories
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

  // 4c. Upsert POIs
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
      story_intro_text: `Utforsk ${pois.length} arrangementer under Oslo Kulturnatt 2025. Kunst, musikk, arkitektur og opplevelser — alt på ett kart, fredag 12. september.`,
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
  console.log(`\n  Explorer: /for/${CUSTOMER_ID}/${PROJECT_SLUG}/explore`);
  console.log("=".repeat(50));
}

main().catch((error) => {
  console.error("\nImport failed:", error.message || error);
  process.exit(1);
});
