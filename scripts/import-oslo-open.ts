/**
 * Import Oslo Open artists from osloopen.no JSON API
 *
 * Data source: https://osloopen.no/nb/kunstnere.json
 * 446 artists with coordinates, images, techniques, day (saturday/sunday)
 *
 * Oslo Open is an annual open-studio art event in Oslo (18-19 April 2026).
 * Artists open their studios for the public. Each artist = 1 POI.
 * Artists at the same address share coordinates → venue clustering on map.
 *
 * Usage:
 *   npx tsx scripts/import-oslo-open.ts --dry-run
 *   npx tsx scripts/import-oslo-open.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { slugify } from "../lib/utils/slugify";

dotenv.config({ path: ".env.local" });

// === Configuration ===

const API_URL = "https://osloopen.no/nb/kunstnere.json";

const CUSTOMER_ID = "oslo-open";
const PROJECT_SLUG = "oslo-open-2026";
const PROJECT_NAME = "Oslo Open 2026";
const PROJECT_CENTER = { lat: 59.9200, lng: 10.7600 }; // Oslo sentrum

// === Category mapping: technique keywords → Placy categories ===

interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** Keywords matched against the artist's "technique" field (case-insensitive) */
  keywords: string[];
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: "oo-maleri",
    name: "Maleri & Tegning",
    icon: "Palette",
    color: "#e11d48",
    keywords: [
      "maleri", "tegning", "akvarell", "akryl", "olje", "gouache",
      "drawing", "painting", "kull", "blyant", "tusj", "pastell",
    ],
  },
  {
    id: "oo-skulptur",
    name: "Skulptur & Installasjon",
    icon: "Box",
    color: "#8b5cf6",
    keywords: [
      "skulptur", "installasjon", "objekt", "assemblage", "kinetisk",
      "sculpture", "installation", "stedsspesifikk", "romlig",
    ],
  },
  {
    id: "oo-foto",
    name: "Foto & Video",
    icon: "Camera",
    color: "#0ea5e9",
    keywords: [
      "foto", "video", "film", "fotografi", "kamera", "photograph",
      "documentary", "16mm", "super 8", "animasjon", "animation",
    ],
  },
  {
    id: "oo-grafikk",
    name: "Grafikk & Trykk",
    icon: "Printer",
    color: "#f59e0b",
    keywords: [
      "grafikk", "trykk", "litografi", "silketrykk", "etsning",
      "radering", "xylografi", "monotypi", "risografi", "print",
      "woodcut", "linocut", "screen", "offset",
    ],
  },
  {
    id: "oo-keramikk",
    name: "Keramikk & Kunsthåndverk",
    icon: "Gem",
    color: "#d97706",
    keywords: [
      "keramikk", "ceramic", "leire", "porselen", "glass",
      "smykke", "jewelry", "emaljering", "enamel", "kunsthåndverk",
      "craft", "dreie",
    ],
  },
  {
    id: "oo-tekstil",
    name: "Tekstil & Fiber",
    icon: "Scissors",
    color: "#ec4899",
    keywords: [
      "tekstil", "textile", "fiber", "vev", "broderi", "strikk",
      "quilting", "billedvev", "tapestry", "embroidery", "sying",
    ],
  },
  {
    id: "oo-mixed",
    name: "Mixed Media",
    icon: "Layers",
    color: "#10b981",
    keywords: [
      "mixed media", "blandet", "collage", "montasje",
      "materialbasert", "konseptuell", "tverrfaglig", "interdisciplinary",
    ],
  },
  {
    id: "oo-annet",
    name: "Annet",
    icon: "Star",
    color: "#64748b",
    keywords: [], // catch-all
  },
];

// === Source API types ===

interface SourceArtist {
  id: number;
  name: string;
  technique: string;
  url: string;
  day: "saturday" | "sunday";
  organization: string;
  planned_projects: string;
  description: string;
  cv: string;
  image_url: string;
  images: Array<{ title: string; photo_credit: string; src: string }>;
  latitude: string;
  longitude: string;
  address: string;
  postal_code: string;
}

// === Classification ===

function classifyArtist(technique: string): CategoryDef {
  const lower = technique.toLowerCase();
  for (const cat of CATEGORY_DEFS) {
    if (cat.keywords.length === 0) continue; // skip catch-all
    if (cat.keywords.some((kw) => lower.includes(kw))) {
      return cat;
    }
  }
  return CATEGORY_DEFS[CATEGORY_DEFS.length - 1]; // "Annet"
}

// === ID generation ===

function generatePoiId(name: string, seenIds: Set<string>): string {
  const baseId = `oo-${slugify(name || "unnamed")}`;
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

// === Main ===

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!dryRun && (!supabaseUrl || !supabaseServiceKey)) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // 1. Fetch artists
  console.log(`Fetching artists from ${API_URL}...`);
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`API fetch failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const artists: SourceArtist[] = data.artists;
  console.log(`  Fetched ${artists.length} artists`);

  // 2. Filter artists with valid coordinates
  const validArtists = artists.filter((a) => {
    const lat = parseFloat(a.latitude);
    const lng = parseFloat(a.longitude);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  });
  const skippedNoCoords = artists.length - validArtists.length;
  if (skippedNoCoords > 0) {
    console.log(`  Skipped ${skippedNoCoords} artists without coordinates:`);
    artists
      .filter((a) => !validArtists.includes(a))
      .forEach((a) => console.log(`    - ${a.name} (${a.address})`));
  }

  // 2b. Normalize coordinates: artists at same address → same coords
  // The source gives slightly different coords per artist even at the same address.
  // VenueClusterMarker groups by exact lat_lng, so we pick the first artist's coords per address.
  // Normalize address for grouping: lowercase, trim, collapse whitespace
  // Also normalize common Norwegian char variants (romsas → romsås)
  const addressKey = (a: SourceArtist) => {
    const addr = a.address.trim().toLowerCase().replace(/\s+/g, " ");
    return `${addr}|${a.postal_code.trim()}`;
  };
  const addressCoords = new Map<string, { lat: number; lng: number }>();
  for (const artist of validArtists) {
    const key = addressKey(artist);
    if (!addressCoords.has(key)) {
      addressCoords.set(key, {
        lat: parseFloat(artist.latitude),
        lng: parseFloat(artist.longitude),
      });
    }
  }
  console.log(`  Normalized ${validArtists.length} artists to ${addressCoords.size} unique addresses`);

  // 3. Build POIs
  const seenIds = new Set<string>();
  const categoryCounts = new Map<string, number>();

  const pois = validArtists.map((artist) => {
    const category = classifyArtist(artist.technique);
    const id = generatePoiId(artist.name.trim(), seenIds);

    categoryCounts.set(
      category.name,
      (categoryCounts.get(category.name) || 0) + 1
    );

    // Use normalized coords so same-address artists share exact coordinates
    const normalizedCoords = addressCoords.get(addressKey(artist))!;
    const lat = normalizedCoords.lat;
    const lng = normalizedCoords.lng;

    // Image URL — use largest available image, prepend domain
    let featuredImage: string | null = null;
    if (artist.images && artist.images.length > 0 && artist.images[0].src) {
      featuredImage = `https://osloopen.no${artist.images[0].src}`;
    } else if (artist.image_url) {
      featuredImage = `https://osloopen.no${artist.image_url}`;
    }

    // Event date: saturday = 2026-04-18, sunday = 2026-04-19
    const eventDate = artist.day === "saturday" ? "2026-04-18" : "2026-04-19";

    // Day label
    const dayLabel = artist.day === "saturday" ? "Lørdag" : "Søndag";

    // Build description from technique + planned projects
    const descParts: string[] = [];
    if (artist.technique) descParts.push(artist.technique.trim().replace(/\.$/, ""));
    const desc = descParts.join(". ");

    // Event tags
    const eventTags: string[] = [dayLabel];
    if (artist.organization) {
      eventTags.push(...artist.organization.split(",").map((o) => o.trim()).filter(Boolean));
    }

    // Venue name: use address for cluster popup
    const venueName = artist.address.trim();

    return {
      id,
      name: artist.name.trim(),
      lat,
      lng,
      category_id: category.id,
      editorial_hook: desc || null,
      description: artist.description ? artist.description.substring(0, 500) : null,
      featured_image: featuredImage,
      event_dates: [eventDate],
      event_time_start: null as string | null,
      event_time_end: null as string | null,
      event_url: `https://osloopen.no${artist.url}`,
      event_tags: eventTags.length > 0 ? eventTags : null,
      event_description: artist.technique || null,
      poi_metadata: {
        venue: venueName,
        address: `${artist.address.trim()}, ${artist.postal_code.trim()} Oslo`,
        artist_id: artist.id,
        organization: artist.organization || null,
        datakilde: "osloopen.no / Oslo Open",
      },
    };
  });

  // 4. Print summary
  console.log("\nCategories:");
  for (const [name, count] of Array.from(categoryCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${name}: ${count}`);
  }

  // Venue clustering summary
  const coordGroups = new Map<string, number>();
  for (const poi of pois) {
    const key = `${poi.lat}_${poi.lng}`;
    coordGroups.set(key, (coordGroups.get(key) || 0) + 1);
  }
  const clusterCount = Array.from(coordGroups.values()).filter((c) => c > 1).length;
  const clusteredPois = Array.from(coordGroups.values())
    .filter((c) => c > 1)
    .reduce((sum, c) => sum + c, 0);
  console.log(`\nVenue clusters: ${clusterCount} venues with multiple artists (${clusteredPois} POIs)`);

  console.log(`\nTotal POIs: ${pois.length}\n`);

  if (dryRun) {
    console.log("Sample POIs:");
    for (const poi of pois.slice(0, 3)) {
      console.log(JSON.stringify(poi, null, 2));
      console.log("---");
    }
    // Show a cluster example
    const bigCluster = Array.from(coordGroups.entries())
      .sort((a, b) => b[1] - a[1])[0];
    if (bigCluster && bigCluster[1] > 1) {
      const [clusterKey] = bigCluster;
      const clusterPois = pois.filter(
        (p) => `${p.lat}_${p.lng}` === clusterKey
      );
      console.log(`\nLargest venue cluster (${clusterPois.length} artists at ${clusterPois[0].poi_metadata.venue}):`);
      clusterPois.slice(0, 5).forEach((p) =>
        console.log(`  - ${p.name} [${p.category_id}] — ${p.event_dates?.[0]}`)
      );
      if (clusterPois.length > 5) console.log(`  ... and ${clusterPois.length - 5} more`);
    }
    console.log("\nDry run complete. Use without --dry-run to import.");
    return;
  }

  // 5. Database operations
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
  const BATCH_SIZE = 100;

  // 5a. Upsert customer
  const { error: customerError } = await supabase.from("customers").upsert(
    { id: CUSTOMER_ID, name: "Oslo Open" },
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
      story_intro_text: `Utforsk ${pois.length} atelierer under Oslo Open 2026. Kunstnere åpner dørene 18.–19. april — finn atelieret som inspirerer deg.`,
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
  console.log(`  Artists: ${pois.length}`);
  console.log(`  Categories: ${usedCategories.length}`);
  console.log(`  Venue clusters: ${clusterCount}`);
  console.log(`\n  Explorer: /for/${CUSTOMER_ID}/${PROJECT_SLUG}/explore`);
  console.log("=".repeat(50));
}

main().catch((error) => {
  console.error("\nImport failed:", error.message || error);
  process.exit(1);
});
