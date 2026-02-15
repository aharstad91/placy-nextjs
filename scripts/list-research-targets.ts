/**
 * List POIs that need knowledge research.
 *
 * Fetches POIs from Supabase, checks existing place_knowledge,
 * and outputs a manifest of research targets with missing topics.
 *
 * Usage:
 *   npx tsx scripts/list-research-targets.ts
 *   npx tsx scripts/list-research-targets.ts --area trondheim
 *   npx tsx scripts/list-research-targets.ts --tier 1
 *   npx tsx scripts/list-research-targets.ts --limit 20
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { KNOWLEDGE_TOPICS } from "../lib/types";

// === Config ===

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AREA_FLAG = (() => {
  const idx = process.argv.indexOf("--area");
  return idx !== -1 ? process.argv[idx + 1] : "trondheim";
})();

const TIER_FLAG = (() => {
  const idx = process.argv.indexOf("--tier");
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : null;
})();

const LIMIT_FLAG = (() => {
  const idx = process.argv.indexOf("--limit");
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : 20;
})();

/** Categories to exclude — transport infrastructure, not real POIs */
const EXCLUDED_CATEGORIES = ["bike", "taxi", "bus"];

// === Types ===

interface POIRow {
  id: string;
  name: string;
  address: string | null;
  category_id: string;
  editorial_hook: string | null;
  local_insight: string | null;
  poi_tier: number | null;
}

interface KnowledgeRow {
  poi_id: string;
  topic: string;
}

interface ManifestTarget {
  poi_id: string;
  name: string;
  slug: string;
  address: string | null;
  category: string;
  editorial_hook: string | null;
  local_insight: string | null;
  tier: number | null;
  existing_topics: string[];
  missing_topics: string[];
}

interface Manifest {
  generated_at: string;
  area: string;
  total_pois: number;
  targets: ManifestTarget[];
}

// === Helpers ===

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function supabaseGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase GET ${path} failed: ${res.status} ${body}`);
  }

  return res.json();
}

// === Main ===

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  console.log(`=== List Research Targets ===`);
  console.log(`Area: ${AREA_FLAG}`);
  console.log(`Tier filter: ${TIER_FLAG ?? "all (1+2)"}`);
  console.log(`Limit: ${LIMIT_FLAG}`);
  console.log();

  // 1. Fetch all POIs (paginated, exclude transport)
  const allPois: POIRow[] = [];
  let offset = 0;
  const pageSize = 1000;

  // Build category exclusion filter
  const categoryFilter = EXCLUDED_CATEGORIES.map((c) => `"${c}"`).join(",");

  while (true) {
    const path = `pois?select=id,name,address,category_id,editorial_hook,local_insight,poi_tier&category_id=not.in.(${categoryFilter})&order=poi_tier.asc.nullslast,name&offset=${offset}&limit=${pageSize}`;
    const page = await supabaseGet<POIRow[]>(path);
    allPois.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`Found ${allPois.length} POIs (excluding transport categories)`);

  // 2. Filter by tier
  let filtered = allPois;
  if (TIER_FLAG !== null) {
    filtered = allPois.filter((p) => p.poi_tier === TIER_FLAG);
  } else {
    // Default: tier 1 and 2 (exclude tier 3 and null)
    filtered = allPois.filter((p) => p.poi_tier === 1 || p.poi_tier === 2);
  }

  console.log(`After tier filter: ${filtered.length} POIs`);

  // 3. Fetch existing place_knowledge for these POIs
  const poiIds = filtered.map((p) => p.id);
  const existingKnowledge: KnowledgeRow[] = [];

  // Fetch in batches (Supabase URL length limit)
  const BATCH_SIZE = 50;
  for (let i = 0; i < poiIds.length; i += BATCH_SIZE) {
    const batch = poiIds.slice(i, i + BATCH_SIZE);
    const idFilter = batch.map((id) => `"${id}"`).join(",");
    const rows = await supabaseGet<KnowledgeRow[]>(
      `place_knowledge?select=poi_id,topic&poi_id=in.(${idFilter})`
    );
    existingKnowledge.push(...rows);
  }

  // Build lookup: poi_id → set of existing topics
  const existingByPoi = new Map<string, Set<string>>();
  for (const row of existingKnowledge) {
    if (!existingByPoi.has(row.poi_id)) {
      existingByPoi.set(row.poi_id, new Set());
    }
    existingByPoi.get(row.poi_id)!.add(row.topic);
  }

  console.log(`Existing knowledge: ${existingKnowledge.length} facts across ${existingByPoi.size} POIs`);

  // 4. Build targets with missing topics
  const targets: ManifestTarget[] = filtered.map((poi) => {
    const existing = existingByPoi.get(poi.id) ?? new Set();
    const existingTopics = Array.from(existing);
    const missingTopics = KNOWLEDGE_TOPICS.filter((t) => !existing.has(t));

    return {
      poi_id: poi.id,
      name: poi.name,
      slug: slugify(poi.name),
      address: poi.address,
      category: poi.category_id,
      editorial_hook: poi.editorial_hook,
      local_insight: poi.local_insight,
      tier: poi.poi_tier,
      existing_topics: existingTopics,
      missing_topics: missingTopics,
    };
  });

  // 5. Sort: tier 1 first, then tier 2, then by name
  targets.sort((a, b) => {
    const tierA = a.tier ?? 99;
    const tierB = b.tier ?? 99;
    if (tierA !== tierB) return tierA - tierB;
    return a.name.localeCompare(b.name, "no");
  });

  // 6. Apply limit
  const limited = targets.slice(0, LIMIT_FLAG);

  // 7. Write manifest
  const manifest: Manifest = {
    generated_at: new Date().toISOString(),
    area: AREA_FLAG,
    total_pois: limited.length,
    targets: limited,
  };

  const fs = await import("fs");
  const path = await import("path");

  const outDir = path.join(process.cwd(), "data", "research");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "manifest.json");
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`\nWrote manifest: ${outPath}`);
  console.log(`\n=== Summary ===`);
  console.log(`Targets: ${limited.length}`);

  const totalMissing = limited.reduce((sum, t) => sum + t.missing_topics.length, 0);
  console.log(`Total missing topics: ${totalMissing}`);
  console.log(`Average missing per POI: ${(totalMissing / limited.length).toFixed(1)}`);

  // Show top 5 targets
  console.log(`\nTop targets:`);
  for (const t of limited.slice(0, 5)) {
    console.log(`  ${t.name} (tier ${t.tier}) — ${t.missing_topics.length} missing topics`);
  }

  if (limited.length > 5) {
    console.log(`  ... and ${limited.length - 5} more`);
  }
}

main().catch(console.error);
