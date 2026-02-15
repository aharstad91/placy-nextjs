/**
 * Backfill place_knowledge from research JSON files.
 *
 * Reads JSON files from data/research/ and inserts facts
 * into the place_knowledge table via Supabase service_role.
 *
 * Usage:
 *   npx tsx scripts/backfill-knowledge.ts --dry-run
 *   npx tsx scripts/backfill-knowledge.ts
 *   npx tsx scripts/backfill-knowledge.ts --file data/research/nidarosdomen.json
 *   npx tsx scripts/backfill-knowledge.ts --force       # Delete existing + re-insert per POI
 *   npx tsx scripts/backfill-knowledge.ts --editorial   # Process editorial backfill files
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createHash } from "crypto";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { KNOWLEDGE_TOPICS, type KnowledgeTopic } from "../lib/types";

// === Config ===

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const EDITORIAL = process.argv.includes("--editorial");

const FILE_FLAG = (() => {
  const idx = process.argv.indexOf("--file");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const CHUNK_SIZE = 100;
const VALID_TOPICS = new Set<string>(KNOWLEDGE_TOPICS);
const VALID_CONFIDENCE = new Set(["verified", "unverified", "disputed"]);

// === Types ===

interface ResearchFact {
  topic: string;
  fact_text: string;
  fact_text_en?: string;
  structured_data?: Record<string, unknown>;
  confidence?: string;
  source_url?: string;
  source_name?: string;
}

interface ResearchFile {
  poi_id: string;
  poi_name: string;
  poi_slug: string;
  researched_at?: string;
  facts: ResearchFact[];
}

interface ExistingKnowledge {
  poi_id: string;
  topic: string;
  fact_text: string;
  sort_order: number;
}

interface ValidationError {
  file: string;
  factIndex: number;
  field: string;
  message: string;
}

// === Helpers ===

function normalizeForHash(text: string): string {
  // Normalize whitespace and case only — keep punctuation (tech audit TA.1)
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function computeHash(poiId: string, topic: string, factText: string): string {
  const normalized = `${poiId}|${topic}|${normalizeForHash(factText)}`;
  return createHash("sha256").update(normalized).digest("hex");
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const supabaseHeaders = () => ({
  apikey: SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
});

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
    throw new Error(`Supabase GET failed: ${res.status} ${body}`);
  }

  return res.json();
}

async function supabasePost(path: string, body: unknown): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, error: text };
  }

  return { ok: true, status: res.status };
}

async function supabaseDelete(path: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: supabaseHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text };
  }

  return { ok: true };
}

// === Validation ===

function validateFact(fact: ResearchFact, fileIndex: number, fileName: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!VALID_TOPICS.has(fact.topic)) {
    errors.push({
      file: fileName,
      factIndex: fileIndex,
      field: "topic",
      message: `Invalid topic "${fact.topic}". Must be one of: ${Array.from(VALID_TOPICS).join(", ")}`,
    });
  }

  if (!fact.fact_text || fact.fact_text.trim().length === 0) {
    errors.push({
      file: fileName,
      factIndex: fileIndex,
      field: "fact_text",
      message: "fact_text is empty",
    });
  }

  if (fact.confidence && !VALID_CONFIDENCE.has(fact.confidence)) {
    errors.push({
      file: fileName,
      factIndex: fileIndex,
      field: "confidence",
      message: `Invalid confidence "${fact.confidence}". Must be: verified, unverified, or disputed`,
    });
  }

  if (fact.source_url && !isSafeUrl(fact.source_url)) {
    errors.push({
      file: fileName,
      factIndex: fileIndex,
      field: "source_url",
      message: `Invalid source_url "${fact.source_url}". Must start with http:// or https://`,
    });
  }

  return errors;
}

function validateFile(data: unknown, fileName: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    errors.push("File content is not an object");
    return { valid: false, errors };
  }

  const file = data as Record<string, unknown>;

  if (!file.poi_id || typeof file.poi_id !== "string") {
    errors.push("Missing or invalid poi_id");
  }

  if (!Array.isArray(file.facts)) {
    errors.push("Missing or invalid facts array");
  }

  return { valid: errors.length === 0, errors };
}

// === Main Logic ===

async function getExistingForPois(poiIds: string[]): Promise<Map<string, Set<string>>> {
  // Tech audit TA.2: Scope fetch to target POI IDs only
  const existing = new Map<string, Set<string>>();
  const BATCH = 50;

  for (let i = 0; i < poiIds.length; i += BATCH) {
    const batch = poiIds.slice(i, i + BATCH);
    const idFilter = batch.map((id) => `"${id}"`).join(",");
    const rows = await supabaseGet<ExistingKnowledge[]>(
      `place_knowledge?select=poi_id,topic,fact_text,sort_order&poi_id=in.(${idFilter})`
    );

    for (const row of rows) {
      const hash = computeHash(row.poi_id, row.topic, row.fact_text);
      if (!existing.has(row.poi_id)) {
        existing.set(row.poi_id, new Set());
      }
      existing.get(row.poi_id)!.add(hash);
    }
  }

  return existing;
}

async function getMaxSortOrders(poiIds: string[]): Promise<Map<string, number>> {
  // Tech audit TA.5: Get MAX(sort_order) per poi_id+topic for auto-append
  const maxOrders = new Map<string, number>();
  const BATCH = 50;

  for (let i = 0; i < poiIds.length; i += BATCH) {
    const batch = poiIds.slice(i, i + BATCH);
    const idFilter = batch.map((id) => `"${id}"`).join(",");
    const rows = await supabaseGet<{ poi_id: string; topic: string; sort_order: number }[]>(
      `place_knowledge?select=poi_id,topic,sort_order&poi_id=in.(${idFilter})&order=sort_order.desc`
    );

    for (const row of rows) {
      const key = `${row.poi_id}|${row.topic}`;
      if (!maxOrders.has(key)) {
        maxOrders.set(key, row.sort_order);
      }
    }
  }

  return maxOrders;
}

async function verifyPoiExists(poiIds: string[]): Promise<Set<string>> {
  // Tech audit TA.3: Verify POI existence per chunk
  const validIds = new Set<string>();
  const BATCH = 50;

  for (let i = 0; i < poiIds.length; i += BATCH) {
    const batch = poiIds.slice(i, i + BATCH);
    const idFilter = batch.map((id) => `"${id}"`).join(",");
    const rows = await supabaseGet<{ id: string }[]>(`pois?select=id&id=in.(${idFilter})`);
    for (const row of rows) {
      validIds.add(row.id);
    }
  }

  return validIds;
}

async function processFile(
  filePath: string,
  existingHashes: Map<string, Set<string>>,
  maxSortOrders: Map<string, number>,
  validPoiIds: Set<string>,
  stats: { inserted: number; skipped: number; failed: number; validationErrors: ValidationError[] }
): Promise<void> {
  const fileName = basename(filePath);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.error(`  ERR  ${fileName}: Invalid JSON — ${err instanceof Error ? err.message : String(err)}`);
    stats.failed++;
    return;
  }

  // Validate file structure
  const fileValidation = validateFile(raw, fileName);
  if (!fileValidation.valid) {
    console.error(`  ERR  ${fileName}: ${fileValidation.errors.join(", ")}`);
    stats.failed++;
    return;
  }

  const data = raw as ResearchFile;

  // Tech audit: Validate XOR constraint — we only handle poi_id (no area_id in research)
  if (!data.poi_id) {
    console.error(`  ERR  ${fileName}: Missing poi_id`);
    stats.failed++;
    return;
  }

  // Tech audit TA.3: Verify POI exists per chunk
  if (!validPoiIds.has(data.poi_id)) {
    console.warn(`  WARN ${fileName}: POI ${data.poi_id} not found in database — skipping`);
    stats.failed++;
    return;
  }

  // Force mode: delete existing knowledge for this POI first
  if (FORCE && !DRY_RUN) {
    const deleteResult = await supabaseDelete(
      `place_knowledge?poi_id=eq.${data.poi_id}`
    );
    if (!deleteResult.ok) {
      console.error(`  ERR  ${fileName}: Failed to delete existing: ${deleteResult.error}`);
      stats.failed++;
      return;
    }
    console.log(`  DEL  ${data.poi_name}: Deleted existing knowledge (--force)`);
    // Clear hashes for this POI since we deleted them
    existingHashes.set(data.poi_id, new Set());
  }

  const poiHashes = existingHashes.get(data.poi_id) ?? new Set();
  const rowsToInsert: Record<string, unknown>[] = [];

  // Track sort_order counters per topic for this file
  const localSortCounters = new Map<string, number>();

  for (let i = 0; i < data.facts.length; i++) {
    const fact = data.facts[i];

    // Validate fact
    const factErrors = validateFact(fact, i, fileName);
    if (factErrors.length > 0) {
      stats.validationErrors.push(...factErrors);
      console.warn(`  WARN ${fileName}[${i}]: ${factErrors.map((e) => e.message).join("; ")}`);
      continue;
    }

    // Compute dedup hash
    const hash = computeHash(data.poi_id, fact.topic, fact.fact_text);
    if (poiHashes.has(hash)) {
      stats.skipped++;
      continue;
    }

    // Tech audit TA.5: Auto-append sort_order
    const topicKey = `${data.poi_id}|${fact.topic}`;
    const existingMax = maxSortOrders.get(topicKey) ?? -1;
    const localCount = localSortCounters.get(topicKey) ?? 0;
    const sortOrder = existingMax + 1 + localCount;
    localSortCounters.set(topicKey, localCount + 1);

    // Normalize source_url if present
    let normalizedUrl = fact.source_url ?? null;
    if (normalizedUrl) {
      try {
        normalizedUrl = new URL(normalizedUrl).href;
      } catch {
        normalizedUrl = null;
      }
    }

    rowsToInsert.push({
      poi_id: data.poi_id,
      topic: fact.topic as KnowledgeTopic,
      fact_text: fact.fact_text,
      fact_text_en: fact.fact_text_en ?? null,
      structured_data: fact.structured_data ?? {},
      confidence: fact.confidence ?? "unverified",
      source_url: normalizedUrl,
      source_name: fact.source_name ?? null,
      sort_order: sortOrder,
      display_ready: false,
    });

    // Mark hash as used (prevent within-file duplicates)
    poiHashes.add(hash);
  }

  if (rowsToInsert.length === 0) {
    console.log(`  SKIP ${data.poi_name}: 0 new facts (all duplicates or invalid)`);
    return;
  }

  if (DRY_RUN) {
    console.log(`  DRY  ${data.poi_name}: Would insert ${rowsToInsert.length} facts`);
    stats.inserted += rowsToInsert.length;
    return;
  }

  // Batch insert in chunks
  let insertedCount = 0;
  let backoffMs = 0;

  for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);

    // Tech audit TA.3: Exponential backoff only on errors
    if (backoffMs > 0) {
      await new Promise((r) => setTimeout(r, backoffMs));
    }

    const result = await supabasePost("place_knowledge", chunk);

    if (result.ok) {
      insertedCount += chunk.length;
      backoffMs = 0; // Reset on success
    } else if (result.status === 429) {
      // Rate limited — exponential backoff
      backoffMs = Math.min((backoffMs || 100) * 2, 5000);
      console.warn(`  RATE ${data.poi_name}: Rate limited, backing off ${backoffMs}ms`);
      i -= CHUNK_SIZE; // Retry this chunk
    } else {
      console.error(`  ERR  ${data.poi_name}: Insert failed (${result.status}): ${result.error}`);
      stats.failed += chunk.length;
      // Exponential backoff on server errors too
      if (result.status >= 500) {
        backoffMs = Math.min((backoffMs || 100) * 2, 5000);
      }
    }
  }

  stats.inserted += insertedCount;
  console.log(`  OK   ${data.poi_name}: Inserted ${insertedCount} facts`);
}

// === Main ===

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== BACKFILL KNOWLEDGE ===");
  if (FORCE) console.log("FORCE mode: will delete existing knowledge per POI before insert");
  console.log();

  // Determine source directory
  const baseDir = EDITORIAL
    ? join(process.cwd(), "data", "research", "editorial")
    : join(process.cwd(), "data", "research");

  // Get list of JSON files to process
  let jsonFiles: string[];

  if (FILE_FLAG) {
    jsonFiles = [FILE_FLAG];
  } else {
    try {
      jsonFiles = readdirSync(baseDir)
        .filter((f) => f.endsWith(".json") && f !== "manifest.json")
        .map((f) => join(baseDir, f));
    } catch {
      console.error(`Directory not found: ${baseDir}`);
      console.error("Run research workflow first to generate JSON files.");
      process.exit(1);
    }
  }

  if (jsonFiles.length === 0) {
    console.log("No JSON files found to process.");
    return;
  }

  console.log(`Files to process: ${jsonFiles.length}`);
  console.log();

  // Pre-read all files to get POI IDs for batch queries
  const allPoiIds = new Set<string>();
  for (const f of jsonFiles) {
    try {
      const raw = JSON.parse(readFileSync(f, "utf-8"));
      if (raw?.poi_id) allPoiIds.add(raw.poi_id);
    } catch {
      // Will be caught during processFile
    }
  }

  const poiIdArray = Array.from(allPoiIds);

  // Batch verify POI existence + fetch existing hashes + max sort orders
  console.log(`Verifying ${poiIdArray.length} POI IDs...`);
  const [validPoiIds, existingHashes, maxSortOrders] = await Promise.all([
    verifyPoiExists(poiIdArray),
    FORCE ? Promise.resolve(new Map<string, Set<string>>()) : getExistingForPois(poiIdArray),
    FORCE ? Promise.resolve(new Map<string, number>()) : getMaxSortOrders(poiIdArray),
  ]);

  const invalidCount = poiIdArray.length - validPoiIds.size;
  if (invalidCount > 0) {
    console.warn(`WARNING: ${invalidCount} POI IDs not found in database`);
  }
  console.log();

  // Process files
  const stats = {
    inserted: 0,
    skipped: 0,
    failed: 0,
    validationErrors: [] as ValidationError[],
  };

  for (const filePath of jsonFiles) {
    await processFile(filePath, existingHashes, maxSortOrders, validPoiIds, stats);
  }

  // Write validation errors log if any
  if (stats.validationErrors.length > 0) {
    const logDir = join(process.cwd(), "data", "research");
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, "validation-errors.log");
    const logContent = stats.validationErrors
      .map((e) => `[${e.file}:${e.factIndex}] ${e.field}: ${e.message}`)
      .join("\n");
    writeFileSync(logPath, logContent, "utf-8");
    console.log(`\nValidation errors logged to: ${logPath}`);
  }

  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Files processed: ${jsonFiles.length}`);
  console.log(`Inserted: ${stats.inserted}`);
  console.log(`Skipped (dedup): ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Validation errors: ${stats.validationErrors.length}`);

  if (DRY_RUN) {
    console.log("\nThis was a DRY RUN. No data was modified.");
  }
}

main().catch(console.error);
