#!/usr/bin/env npx tsx
/**
 * Seed POIs from OpenStreetMap (Overpass) into a project's POI pool in Supabase.
 *
 * Free, unlimited POI volume from OSM — used to show neighborhood density on the
 * report-board. Build-time only (no runtime Overpass calls), matching the trail-fetcher
 * pattern. OSM POIs carry trust_score = NULL (passes the trust filter as "show", per
 * queries.ts:51) and source = "osm". They have no Google rating/photo, so they render as
 * map pins and sort after rated POIs — exactly the density layer we want.
 *
 * Usage:
 *   npx tsx scripts/seed-osm-pois.ts <project-id> [--radius 2000] [--dry-run]
 *   npx tsx scripts/seed-osm-pois.ts bane-nor-eiendom_stasjonskvartalet --dry-run
 *   npx tsx scripts/seed-osm-pois.ts bane-nor-eiendom_stasjonskvartalet
 *   npx tsx scripts/seed-osm-pois.ts bane-nor-eiendom_stasjonskvartalet --cleanup
 *
 * --dry-run : fetch + dedup + print counts, write nothing
 * --cleanup : delete every osm-* POI previously seeded for this project (full reversal)
 *
 * Writes to three tables: pois (data), project_pois (project pool), product_pois (per product).
 * Dedup: skips an OSM candidate if an existing POI sits within 25 m (same spot) or within
 * 60 m with a matching normalized name (same business).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const USER_AGENT = "Placy/1.0 (kontakt@placy.no)";

// OSM tag (key -> value -> Placy category_id). Every target category_id exists in the
// `categories` table (FK) and belongs to a stasjonskvartalet theme. Transport is omitted
// on purpose: it is owned by Entur + Bysykkel (real-time, authoritative). Keys are checked
// in order; the first match wins. Extend by adding rows here.
const TAG_MAP: Record<string, Record<string, string>> = {
  amenity: {
    // mat-drikke
    restaurant: "restaurant", fast_food: "restaurant", food_court: "restaurant",
    cafe: "cafe", ice_cream: "cafe",
    bar: "bar", pub: "bar", biergarten: "bar",
    // hverdagsliv
    pharmacy: "pharmacy", bank: "bank", post_office: "post",
    doctors: "doctor", dentist: "dentist", hospital: "hospital", clinic: "hospital",
    // barn-oppvekst
    kindergarten: "barnehage", school: "skole",
    // opplevelser
    library: "library", cinema: "cinema", theatre: "theatre",
  },
  shop: {
    bakery: "bakery", pastry: "bakery",       // mat-drikke
    supermarket: "supermarket", convenience: "convenience", // hverdagsliv
    hairdresser: "haircare", mall: "shopping", department_store: "shopping",
    alcohol: "liquor_store",
  },
  leisure: {
    park: "park", nature_reserve: "outdoor", garden: "outdoor",        // natur-friluftsliv
    playground: "lekeplass",                                           // barn-oppvekst
    sports_centre: "idrett", pitch: "idrett", stadium: "idrett",       // barn-oppvekst
    fitness_centre: "gym", fitness_station: "fitness_park",            // trening-aktivitet
    swimming_pool: "swimming", swimming_area: "swimming", spa: "spa",  // trening-aktivitet
    bowling_alley: "bowling",                                          // opplevelser
  },
  tourism: { museum: "museum", gallery: "museum" },                    // opplevelser
  natural: { beach: "badeplass" },                                     // natur-friluftsliv
};

// category_id -> theme (for grouped reporting only)
const CATEGORY_THEME: Record<string, string> = {
  restaurant: "mat-drikke", cafe: "mat-drikke", bar: "mat-drikke", bakery: "mat-drikke",
  shopping: "hverdagsliv", supermarket: "hverdagsliv", convenience: "hverdagsliv",
  pharmacy: "hverdagsliv", bank: "hverdagsliv", post: "hverdagsliv", doctor: "hverdagsliv",
  dentist: "hverdagsliv", hospital: "hverdagsliv", haircare: "hverdagsliv", liquor_store: "hverdagsliv",
  skole: "barn-oppvekst", barnehage: "barn-oppvekst", lekeplass: "barn-oppvekst", idrett: "barn-oppvekst",
  museum: "opplevelser", library: "opplevelser", cinema: "opplevelser", theatre: "opplevelser", bowling: "opplevelser",
  park: "natur-friluftsliv", outdoor: "natur-friluftsliv", badeplass: "natur-friluftsliv",
  gym: "trening-aktivitet", swimming: "trening-aktivitet", spa: "trening-aktivitet", fitness_park: "trening-aktivitet",
};

interface Candidate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  category_id: string;
  osm_id: string;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function buildOverpassQuery(lat: number, lng: number, radius: number): string {
  const blocks = Object.entries(TAG_MAP)
    .map(([key, m]) => `  nwr["${key}"~"^(${Object.keys(m).join("|")})$"](around:${radius},${lat},${lng});`)
    .join("\n");
  return `[out:json][timeout:90];
(
${blocks}
);
out center tags;`;
}

async function fetchOverpass(query: string): Promise<OverpassElement[]> {
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.status === 429) {
        console.warn(`  rate-limited by ${url}, trying next endpoint...`);
        continue;
      }
      if (!res.ok) {
        console.warn(`  ${url} returned ${res.status}, trying next...`);
        continue;
      }
      const data = await res.json();
      return data.elements || [];
    } catch (err) {
      console.warn(`  ${url} failed (${(err as Error).message}), trying next...`);
    }
  }
  throw new Error("All Overpass endpoints failed");
}

function elementToCandidate(el: OverpassElement): Candidate | null {
  const tags = el.tags || {};
  const name = tags.name?.trim();
  if (!name) return null; // skip unnamed POIs — they look like junk on a demo

  let category_id: string | undefined;
  for (const key of Object.keys(TAG_MAP)) {
    const v = tags[key];
    if (v && TAG_MAP[key][v]) { category_id = TAG_MAP[key][v]; break; }
  }
  if (!category_id) return null;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  const street = tags["addr:street"];
  const num = tags["addr:housenumber"];
  const address = street ? `${street}${num ? " " + num : ""}` : null;

  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    lat,
    lng,
    address,
    category_id,
    osm_id: `${el.type}/${el.id}`,
  };
}

async function rest(
  path: string,
  init?: RequestInit & { preferCount?: boolean }
): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
}

async function getJson<T = unknown>(path: string): Promise<T> {
  const res = await rest(path);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function insertBatch(table: string, rows: object[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const res = await rest(table, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      throw new Error(`INSERT ${table} -> ${res.status} ${await res.text()}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const projectId = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const cleanup = args.includes("--cleanup");
  const radiusArg = args.find((a) => a.startsWith("--radius"));
  const radius = radiusArg ? parseInt(radiusArg.split(/[= ]/)[1] || "2000", 10) : 2000;

  if (!projectId) {
    console.error("Usage: npx tsx scripts/seed-osm-pois.ts <project-id> [--radius 2000] [--dry-run] [--cleanup]");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  // --- Cleanup mode: remove every osm-* POI for this project ---
  if (cleanup) {
    const existing = await getJson<{ poi_id: string }[]>(
      `project_pois?project_id=eq.${projectId}&select=poi_id&poi_id=like.osm-*`
    );
    const ids = existing.map((r) => r.poi_id);
    if (!ids.length) {
      console.log("No osm-* POIs to clean up.");
      return;
    }
    const inList = `(${ids.map((id: string) => `"${id}"`).join(",")})`;
    await rest(`product_pois?poi_id=in.${inList}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    await rest(`project_pois?poi_id=in.${inList}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    await rest(`pois?id=in.${inList}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    console.log(`🧹 Removed ${ids.length} osm-* POIs from ${projectId}.`);
    return;
  }

  // --- Resolve project center + products ---
  const projects = await getJson<{ center_lat: number; center_lng: number; name: string }[]>(
    `projects?id=eq.${projectId}&select=center_lat,center_lng,name`
  );
  if (!projects.length) {
    console.error(`Project not found: ${projectId}`);
    process.exit(1);
  }
  const { center_lat: lat, center_lng: lng, name: projectName } = projects[0];
  const products = await getJson<{ id: string; product_type: string }[]>(
    `products?project_id=eq.${projectId}&select=id,product_type`
  );
  console.log(`📍 ${projectName} (${lat}, ${lng}) — radius ${radius}m`);
  console.log(`   Products: ${products.map((p) => p.product_type).join(", ")}`);

  // --- Fetch OSM candidates ---
  console.log(`\n🌍 Querying Overpass for food POIs...`);
  const elements = await fetchOverpass(buildOverpassQuery(lat, lng, radius));
  const candidates = elements
    .map(elementToCandidate)
    .filter((c): c is Candidate => c !== null);
  console.log(`   ${elements.length} OSM elements -> ${candidates.length} named food POIs`);

  // --- Dedup against existing project POIs ---
  const existingPois = await getJson<
    { pois: { name: string; lat: number; lng: number; category_id: string } }[]
  >(`project_pois?project_id=eq.${projectId}&select=pois(name,lat,lng,category_id)`);
  const existing = existingPois.map((r) => r.pois).filter(Boolean);
  // Dedup tuned to keep distinct businesses in a dense center. A candidate is a duplicate
  // only if it's essentially the SAME place: identical point (<8m, any category), the same
  // spot in the same category (<12m), or the same name nearby (<200m, handles OSM/Google
  // coord drift for one business). Neighbours of a different category are NOT dropped.
  const existingNorm = existing.map((e) => ({ lat: e.lat, lng: e.lng, n: normalizeName(e.name), cat: e.category_id }));
  const fresh: Candidate[] = [];
  const freshNorm: { lat: number; lng: number; n: string; cat: string }[] = [];
  let dupSpot = 0;
  let dupName = 0;
  const isDuplicate = (
    c: Candidate,
    cn: string,
    list: { lat: number; lng: number; n: string; cat?: string }[]
  ): boolean => {
    for (const e of list) {
      const d = haversine(c.lat, c.lng, e.lat, e.lng);
      if (d <= 8) { dupSpot++; return true; }
      if (d <= 12 && e.cat === c.category_id) { dupSpot++; return true; }
      if (d <= 200 && e.n === cn) { dupName++; return true; }
    }
    return false;
  };
  for (const c of candidates) {
    const cn = normalizeName(c.name);
    if (isDuplicate(c, cn, existingNorm)) continue;
    if (isDuplicate(c, cn, freshNorm)) continue;
    fresh.push(c);
    freshNorm.push({ lat: c.lat, lng: c.lng, n: cn, cat: c.category_id });
  }

  // --- Report counts per category, grouped by theme ---
  const byCat: Record<string, number> = {};
  for (const c of fresh) byCat[c.category_id] = (byCat[c.category_id] || 0) + 1;
  console.log(`\n📊 New (after dedup): ${fresh.length}  [skipped ${dupSpot} same-spot, ${dupName} same-name]`);
  const byTheme = new Map<string, string[]>();
  for (const cat of Object.keys(byCat)) {
    const theme = CATEGORY_THEME[cat] || "annet";
    if (!byTheme.has(theme)) byTheme.set(theme, []);
    byTheme.get(theme)!.push(`${cat} +${byCat[cat]}`);
  }
  Array.from(byTheme.entries()).forEach(([theme, cats]) => {
    console.log(`   ${theme.padEnd(18)} ${cats.join(", ")}`);
  });

  if (dryRun) {
    console.log(`\n🔎 DRY RUN — nothing written. Sample:`);
    fresh.slice(0, 8).forEach((c) => console.log(`   ${c.category_id.padEnd(11)} ${c.name}`));
    console.log(`\n   Re-run without --dry-run to seed ${fresh.length} POIs.`);
    return;
  }

  if (!fresh.length) {
    console.log("Nothing new to seed.");
    return;
  }

  // --- Write: pois -> project_pois -> product_pois ---
  console.log(`\n💾 Seeding ${fresh.length} POIs...`);
  await insertBatch("pois", fresh.map((c) => ({
    id: c.id,
    name: c.name,
    lat: c.lat,
    lng: c.lng,
    address: c.address,
    category_id: c.category_id,
    source: "osm",
    osm_id: c.osm_id,
    trust_score: null, // passes filterTrustedPOIs (queries.ts:51) as "show"
  })));
  await insertBatch("project_pois", fresh.map((c) => ({ project_id: projectId, poi_id: c.id })));
  for (const product of products) {
    await insertBatch("product_pois", fresh.map((c) => ({ product_id: product.id, poi_id: c.id })));
  }

  console.log(`✅ Seeded ${fresh.length} OSM POIs into ${projectId} (pois + project_pois + product_pois×${products.length}).`);
  console.log(`   Reverse anytime with: npx tsx scripts/seed-osm-pois.ts ${projectId} --cleanup`);
  console.log(`   Remember to bust the cache (revalidateTag product:${projectId}) to see them.`);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
