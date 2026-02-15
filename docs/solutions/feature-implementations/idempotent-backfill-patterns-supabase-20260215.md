---
module: City Knowledge Base (Place Knowledge Backfill)
date: 2026-02-15
problem_type: feature_implementation
category: feature-implementations
severity: high
tags:
  - supabase
  - typescript
  - database
  - idempotency
  - backfill
  - batch-processing
  - deduplication
  - upsert
  - place_knowledge
  - transactions
symptoms:
  - Need to backfill place_knowledge table with facts from external APIs
  - Must be re-runnable without creating duplicates
  - Need to handle partial failures gracefully
  - Want to support --force flag for atomic replacement
---

# Idempotent Database Backfill Patterns — TypeScript + Supabase

## Overview

Building production-grade database backfill scripts requires handling edge cases: duplicates, partial failures, re-runs, and atomic replacements. This document provides **concrete TypeScript patterns** using `@supabase/supabase-js` client, not raw SQL.

The `place_knowledge` table is an ideal case study:
- Schema: `id`, `poi_id`, `area_id`, `topic`, `fact_text`, `source_name`, `confidence`, `display_ready`, etc.
- FK constraints: `poi_id → pois(id) ON DELETE CASCADE`, `area_id → areas(id) ON DELETE RESTRICT`
- Deduplication key: `(poi_id, topic, fact_text)` combination must be unique per run

---

## Pattern 1: SHA-256 Hash for Deduplication (Recommended)

### Rationale

Store a content hash in the database to detect whether a fact has been inserted before. This is superior to UNIQUE constraints because:

1. **Idempotent by design** — Hash is deterministic; same input always produces same hash.
2. **Survives re-imports** — Can re-run script without error (no unique constraint violation).
3. **Detects modifications** — If source data changes, hash differs, triggering an update.
4. **Optional column** — Can add `content_hash` without schema migration (computed on insert/update).

### Schema Change

```sql
-- If you want to make deduplication persistent and queryable:
ALTER TABLE place_knowledge ADD COLUMN content_hash TEXT;
CREATE UNIQUE INDEX idx_pk_content_hash ON place_knowledge(content_hash) WHERE content_hash IS NOT NULL;
```

**But:** For immediate backfill, you can compute hash in memory without schema change.

### TypeScript Implementation

```typescript
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

interface PlaceKnowledgeInput {
  poi_id?: string;
  area_id?: string;
  topic: "history" | "architecture" | "food" | "culture" | "people" | "nature" | "practical" | "local_knowledge" | "spatial";
  fact_text: string;
  fact_text_en?: string;
  source_name?: string;
  source_url?: string;
  confidence?: "verified" | "unverified" | "disputed";
  display_ready?: boolean;
  sort_order?: number;
}

/**
 * Compute deterministic SHA-256 hash for deduplication.
 * Hash key: poi_id + topic + fact_text (normalized whitespace)
 */
function computeContentHash(
  poiId: string | undefined,
  areaId: string | undefined,
  topic: string,
  factText: string
): string {
  const key = [
    poiId || "",
    areaId || "",
    topic,
    factText.trim().replace(/\s+/g, " "), // Normalize whitespace
  ].join("|");

  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Backfill place_knowledge with deduplication via in-memory hash tracking.
 *
 * Flow:
 * 1. Fetch existing facts + their hashes (or compute hashes)
 * 2. Compute hash for each new fact
 * 3. Only insert if hash not seen before
 * 4. Track results: inserted, skipped, errors
 */
async function backfillPlaceKnowledgeWithHashing(
  facts: PlaceKnowledgeInput[],
  options: { dryRun?: boolean } = {}
): Promise<{
  inserted: number;
  skipped: number;
  errors: Array<{ fact_text: string; error: string }>;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = { inserted: 0, skipped: 0, errors: [] as Array<{ fact_text: string; error: string }> };

  if (facts.length === 0) return result;

  // Step 1: Fetch existing facts and build hash set
  console.log("Fetching existing facts...");
  const { data: existing, error: fetchError } = await supabase
    .from("place_knowledge")
    .select("id, poi_id, area_id, topic, fact_text");

  if (fetchError) {
    throw new Error(`Failed to fetch existing facts: ${fetchError.message}`);
  }

  const existingHashes = new Set<string>(
    (existing || []).map((row) =>
      computeContentHash(row.poi_id, row.area_id, row.topic, row.fact_text)
    )
  );

  console.log(`Found ${existingHashes.size} existing facts`);

  // Step 2: Deduplicate incoming facts
  const deduplicatedFacts: Array<PlaceKnowledgeInput & { _hash: string }> = [];
  const seenInBatch = new Set<string>();

  for (const fact of facts) {
    const hash = computeContentHash(fact.poi_id, fact.area_id, fact.topic, fact.fact_text);

    // Skip if already in database OR duplicate in this batch
    if (existingHashes.has(hash) || seenInBatch.has(hash)) {
      result.skipped++;
      console.log(`⊘ Skipped (hash collision): "${fact.fact_text.substring(0, 50)}..."`);
      continue;
    }

    seenInBatch.add(hash);
    deduplicatedFacts.push({ ...fact, _hash: hash });
  }

  console.log(`Inserting ${deduplicatedFacts.length} new facts...`);

  if (options.dryRun) {
    console.log("[DRY RUN] Would insert:", deduplicatedFacts.length);
    result.inserted = deduplicatedFacts.length;
    return result;
  }

  // Step 3: Batch insert with per-row error handling
  for (const fact of deduplicatedFacts) {
    const { error } = await supabase.from("place_knowledge").insert({
      poi_id: fact.poi_id || null,
      area_id: fact.area_id || null,
      topic: fact.topic,
      fact_text: fact.fact_text,
      fact_text_en: fact.fact_text_en || null,
      source_name: fact.source_name || null,
      source_url: fact.source_url || null,
      confidence: fact.confidence || "unverified",
      display_ready: fact.display_ready ?? false,
      sort_order: fact.sort_order ?? 0,
    });

    if (error) {
      result.errors.push({
        fact_text: fact.fact_text.substring(0, 100),
        error: error.message,
      });
      console.error(`✗ Failed: "${fact.fact_text.substring(0, 50)}..." — ${error.message}`);
    } else {
      result.inserted++;
      console.log(`✓ Inserted: "${fact.fact_text.substring(0, 50)}..."`);
    }
  }

  return result;
}

// Example usage
const facts: PlaceKnowledgeInput[] = [
  {
    poi_id: "google-ChIJtTyDwJkxbUYRSfa9a56pD5o",
    topic: "history",
    fact_text: "Antikvariatet er i en trebygning fra 1700-tallet.",
    fact_text_en: "Antikvariatet is in a wooden building from the 1700s.",
    source_name: "Visit Trondheim",
    confidence: "verified",
    display_ready: true,
  },
  {
    poi_id: "google-ChIJtTyDwJkxbUYRSfa9a56pD5o",
    topic: "food",
    fact_text: "Serverer klassisk norsk mat.",
    fact_text_en: "Serves classic Norwegian food.",
    confidence: "unverified",
    display_ready: false,
  },
];

// Run with deduplication
const result = await backfillPlaceKnowledgeWithHashing(facts);
console.log(`\n✅ Backfill complete:
  Inserted: ${result.inserted}
  Skipped: ${result.skipped}
  Errors: ${result.errors.length}`);

if (result.errors.length > 0) {
  console.error("Errors:", result.errors);
}
```

**Advantages:**
- Re-runnable without errors (no unique constraint violations)
- Transparently detects changes to source data
- Works without schema modifications

**Disadvantages:**
- Hash computation per-fact (small CPU cost)
- Doesn't prevent accidental duplicates if fact_text is altered mid-import

---

## Pattern 2: UNIQUE Constraint with ON CONFLICT DO NOTHING

### Rationale

PostgreSQL's `ON CONFLICT` clause provides database-level deduplication. This is the fastest approach for batch operations.

### Schema Setup

```sql
-- Create unique constraint on deduplication key
ALTER TABLE place_knowledge ADD CONSTRAINT uk_pk_content UNIQUE (poi_id, topic, fact_text);

-- OR if you allow NULLs in poi_id (use computed hash):
ALTER TABLE place_knowledge ADD COLUMN content_hash TEXT;
ALTER TABLE place_knowledge ADD CONSTRAINT uk_pk_content_hash UNIQUE (content_hash);
```

### TypeScript Implementation

```typescript
/**
 * Batch insert using ON CONFLICT DO NOTHING.
 * Supabase JS client translates to PostgreSQL INSERT ... ON CONFLICT.
 */
async function backfillPlaceKnowledgeWithOnConflict(
  facts: PlaceKnowledgeInput[]
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = { inserted: 0, skipped: 0, errors: [] as string[] };

  if (facts.length === 0) return result;

  // Prepare batch
  const batch = facts.map((fact) => ({
    poi_id: fact.poi_id || null,
    area_id: fact.area_id || null,
    topic: fact.topic,
    fact_text: fact.fact_text,
    fact_text_en: fact.fact_text_en || null,
    source_name: fact.source_name || null,
    source_url: fact.source_url || null,
    confidence: fact.confidence || "unverified",
    display_ready: fact.display_ready ?? false,
    sort_order: fact.sort_order ?? 0,
  }));

  // Step 1: Split into chunks (Supabase has request size limits)
  const CHUNK_SIZE = 100;
  for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
    const chunk = batch.slice(i, i + CHUNK_SIZE);

    // Step 2: Insert with conflict resolution
    const { error, count } = await supabase
      .from("place_knowledge")
      .insert(chunk, { count: "exact" });

    if (error) {
      // Check if error is due to unique constraint
      if (error.message.includes("unique") || error.code === "23505") {
        console.warn(`Chunk ${i / CHUNK_SIZE + 1}: Some facts already exist (OK)`);
        // Can't determine how many were inserted vs. skipped with ON CONFLICT
        // This is a limitation of the current Supabase response
      } else {
        result.errors.push(`Chunk error: ${error.message}`);
        console.error(`✗ Chunk insert failed: ${error.message}`);
      }
    } else {
      // Note: Supabase may not return accurate count with ON CONFLICT
      const inserted = count || 0;
      result.inserted += inserted;
      console.log(`✓ Chunk ${i / CHUNK_SIZE + 1}: Inserted ${inserted} facts`);
    }
  }

  return result;
}
```

**Advantages:**
- Fastest approach (database handles deduplication)
- Atomic at chunk level
- No application-level logic needed

**Disadvantages:**
- Requires unique constraint on (poi_id, topic, fact_text)
- Can't distinguish between "inserted" vs "skipped" in response
- If fact_text changes, old entry becomes orphaned

---

## Pattern 3: SELECT + Merge Pattern (Most Control)

### Rationale

Fetch existing facts, merge with new facts in application, then upsert. This gives maximum control over conflict resolution and update logic.

### Implementation

```typescript
interface PlaceKnowledgeFull extends PlaceKnowledgeInput {
  id: string;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
}

/**
 * Select-merge-upsert pattern for granular control over deduplication.
 *
 * Flow:
 * 1. SELECT existing facts for target POIs
 * 2. Merge: keep existing if unchanged, skip if duplicate, INSERT new
 * 3. Upsert merged facts
 */
async function backfillPlaceKnowledgeWithMerge(
  facts: PlaceKnowledgeInput[],
  options: { force?: boolean } = {}
): Promise<{ inserted: number; updated: number; skipped: number; errors: string[] }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

  if (facts.length === 0) return result;

  // Step 1: Identify target POI/Area IDs
  const targetPoiIds = [...new Set(facts.map((f) => f.poi_id).filter(Boolean))];
  const targetAreaIds = [...new Set(facts.map((f) => f.area_id).filter(Boolean))];

  // Step 2: Fetch existing facts for these targets
  console.log(`Fetching ${targetPoiIds.length} POIs and ${targetAreaIds.length} areas...`);

  let existingFacts: PlaceKnowledgeFull[] = [];
  if (targetPoiIds.length > 0) {
    const { data: poiFacts, error } = await supabase
      .from("place_knowledge")
      .select("*")
      .in("poi_id", targetPoiIds);

    if (error) {
      throw new Error(`Failed to fetch POI facts: ${error.message}`);
    }
    existingFacts.push(...(poiFacts || []));
  }

  if (targetAreaIds.length > 0) {
    const { data: areaFacts, error } = await supabase
      .from("place_knowledge")
      .select("*")
      .in("area_id", targetAreaIds);

    if (error) {
      throw new Error(`Failed to fetch area facts: ${error.message}`);
    }
    existingFacts.push(...(areaFacts || []));
  }

  // Step 3: Build deduplication map
  const existingMap = new Map<string, PlaceKnowledgeFull>();
  for (const fact of existingFacts) {
    const key = `${fact.poi_id || ""}|${fact.area_id || ""}|${fact.topic}|${fact.fact_text}`;
    existingMap.set(key, fact);
  }

  // Step 4: Merge incoming facts with existing
  const toInsert: any[] = [];
  const toUpdate: any[] = [];

  for (const fact of facts) {
    const key = `${fact.poi_id || ""}|${fact.area_id || ""}|${fact.topic}|${fact.fact_text}`;
    const existing = existingMap.get(key);

    if (!existing) {
      // New fact
      toInsert.push({
        poi_id: fact.poi_id || null,
        area_id: fact.area_id || null,
        topic: fact.topic,
        fact_text: fact.fact_text,
        fact_text_en: fact.fact_text_en || null,
        source_name: fact.source_name || null,
        source_url: fact.source_url || null,
        confidence: fact.confidence || "unverified",
        display_ready: fact.display_ready ?? false,
        sort_order: fact.sort_order ?? 0,
      });
    } else if (options.force) {
      // Force mode: update metadata (source, confidence, display_ready)
      toUpdate.push({
        id: existing.id,
        source_name: fact.source_name || existing.source_name,
        source_url: fact.source_url || existing.source_url,
        confidence: fact.confidence || existing.confidence,
        display_ready: fact.display_ready ?? existing.display_ready,
      });
    } else {
      // Normal mode: skip if exists
      result.skipped++;
    }
  }

  // Step 5: Batch insert new facts
  if (toInsert.length > 0) {
    console.log(`Inserting ${toInsert.length} new facts...`);
    const { error } = await supabase.from("place_knowledge").insert(toInsert);

    if (error) {
      result.errors.push(`Insert failed: ${error.message}`);
    } else {
      result.inserted = toInsert.length;
    }
  }

  // Step 6: Batch update existing facts (if force mode)
  if (toUpdate.length > 0) {
    console.log(`Updating ${toUpdate.length} facts...`);

    for (const update of toUpdate) {
      const { id, ...data } = update;
      const { error } = await supabase
        .from("place_knowledge")
        .update(data)
        .eq("id", id);

      if (error) {
        result.errors.push(`Update failed for ${id}: ${error.message}`);
      } else {
        result.updated++;
      }
    }
  }

  return result;
}

// Example: --force flag for re-running script
const isForce = process.argv.includes("--force");
const result = await backfillPlaceKnowledgeWithMerge(facts, { force: isForce });
console.log(`Result:
  Inserted: ${result.inserted}
  Updated: ${result.updated}
  Skipped: ${result.skipped}
  Errors: ${result.errors.length}`);
```

**Advantages:**
- Full control over update vs. insert logic
- Can distinguish inserted/updated/skipped
- Supports --force flag for re-runs
- Flexible merge strategy

**Disadvantages:**
- More complex code
- Two database round-trips (SELECT + INSERT/UPDATE)
- Slower for large datasets

---

## Pattern 4: --force Flag with Atomic Deletion + Rebuild

### Rationale

For scripts that support a `--force` flag, atomically delete old facts for target POIs and rebuild from scratch. This ensures consistency.

### Implementation

```typescript
/**
 * Backfill with --force support.
 * --force deletes existing facts for target POIs and rebuilds atomically.
 *
 * Prerequisites:
 * - ON DELETE CASCADE from pois → place_knowledge
 * - No manual locks needed; Supabase handles transaction isolation
 */
async function backfillPlaceKnowledgeWithForce(
  facts: PlaceKnowledgeInput[],
  options: { force?: boolean } = {}
): Promise<{ inserted: number; deleted: number; errors: string[] }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = { inserted: 0, deleted: 0, errors: [] as string[] };

  if (facts.length === 0) return result;

  // Identify target POIs
  const targetPoiIds = [...new Set(facts.map((f) => f.poi_id).filter(Boolean))] as string[];

  if (options.force) {
    console.log(`🔥 FORCE MODE: Deleting ${targetPoiIds.length} POI's existing facts...`);

    for (const poiId of targetPoiIds) {
      const { error, count } = await supabase
        .from("place_knowledge")
        .delete()
        .eq("poi_id", poiId)
        .then((res) => ({
          error: res.error,
          count: res.count,
        }));

      if (error) {
        result.errors.push(`Failed to delete facts for POI ${poiId}: ${error.message}`);
      } else {
        result.deleted += count || 0;
      }
    }

    console.log(`Deleted ${result.deleted} facts. Rebuilding...`);
  }

  // Insert all facts (fresh start or new facts)
  const batch = facts.map((fact) => ({
    poi_id: fact.poi_id || null,
    area_id: fact.area_id || null,
    topic: fact.topic,
    fact_text: fact.fact_text,
    fact_text_en: fact.fact_text_en || null,
    source_name: fact.source_name || null,
    source_url: fact.source_url || null,
    confidence: fact.confidence || "unverified",
    display_ready: fact.display_ready ?? false,
    sort_order: fact.sort_order ?? 0,
  }));

  // Batch in chunks
  const CHUNK_SIZE = 100;
  for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
    const chunk = batch.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from("place_knowledge").insert(chunk);

    if (error) {
      result.errors.push(`Chunk insert failed: ${error.message}`);
    } else {
      result.inserted += chunk.length;
    }
  }

  return result;
}

// Usage
if (process.argv.includes("--force")) {
  console.log("⚠️  Running with --force (will DELETE existing facts)");
  const result = await backfillPlaceKnowledgeWithForce(facts, { force: true });
  console.log(`Result: Deleted ${result.deleted}, Inserted ${result.inserted}`);
} else {
  const result = await backfillPlaceKnowledgeWithForce(facts);
  console.log(`Result: Inserted ${result.inserted}`);
}
```

**Schema Requirement:**

```sql
-- place_knowledge.poi_id must have ON DELETE CASCADE
ALTER TABLE place_knowledge
DROP CONSTRAINT place_knowledge_poi_id_fkey;

ALTER TABLE place_knowledge
ADD CONSTRAINT place_knowledge_poi_id_fkey
FOREIGN KEY (poi_id) REFERENCES pois(id) ON DELETE CASCADE;
```

**Advantages:**
- Atomic: delete + rebuild is transactional
- No orphaned records
- Simplest semantics for --force

**Disadvantages:**
- Destructive (requires careful confirmation)
- Cascades to dependent tables

---

## Pattern 5: Batch Processing with Error Recovery

### Rationale

Large backfills (1000+ facts) need chunking and per-row error handling to continue after failures.

### Implementation

```typescript
/**
 * Backfill with chunking and per-row error tracking.
 * Continues on errors, reports summary.
 */
async function backfillPlaceKnowledgeWithErrorRecovery(
  facts: PlaceKnowledgeInput[],
  options: { chunkSize?: number; dryRun?: boolean } = {}
): Promise<{
  inserted: number;
  skipped: number;
  failed: Array<{ factText: string; poiId?: string; error: string }>;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const CHUNK_SIZE = options.chunkSize || 50;
  const result = {
    inserted: 0,
    skipped: 0,
    failed: [] as Array<{ factText: string; poiId?: string; error: string }>,
  };

  console.log(`Processing ${facts.length} facts in chunks of ${CHUNK_SIZE}...`);

  // Fetch existing hashes once
  const { data: existing } = await supabase
    .from("place_knowledge")
    .select("id, poi_id, area_id, topic, fact_text");

  const existingHashes = new Set<string>(
    (existing || []).map((row) =>
      computeContentHash(row.poi_id, row.area_id, row.topic, row.fact_text)
    )
  );

  for (let chunkIdx = 0; chunkIdx < facts.length; chunkIdx += CHUNK_SIZE) {
    const chunk = facts.slice(chunkIdx, chunkIdx + CHUNK_SIZE);
    const chunkNum = Math.floor(chunkIdx / CHUNK_SIZE) + 1;

    console.log(`\nChunk ${chunkNum}/${Math.ceil(facts.length / CHUNK_SIZE)}`);

    // Deduplicate within chunk
    const toInsert = [];
    for (const fact of chunk) {
      const hash = computeContentHash(fact.poi_id, fact.area_id, fact.topic, fact.fact_text);
      if (!existingHashes.has(hash)) {
        toInsert.push(fact);
        existingHashes.add(hash); // Mark as seen
      } else {
        result.skipped++;
      }
    }

    if (toInsert.length === 0) {
      console.log(`  ⊘ All ${chunk.length} facts already exist`);
      continue;
    }

    console.log(`  Inserting ${toInsert.length} facts...`);

    // Insert with per-row error handling
    if (options.dryRun) {
      result.inserted += toInsert.length;
      console.log(`  [DRY RUN] Would insert ${toInsert.length}`);
      continue;
    }

    for (const fact of toInsert) {
      const { error } = await supabase.from("place_knowledge").insert({
        poi_id: fact.poi_id || null,
        area_id: fact.area_id || null,
        topic: fact.topic,
        fact_text: fact.fact_text,
        fact_text_en: fact.fact_text_en || null,
        source_name: fact.source_name || null,
        source_url: fact.source_url || null,
        confidence: fact.confidence || "unverified",
        display_ready: fact.display_ready ?? false,
        sort_order: fact.sort_order ?? 0,
      });

      if (error) {
        result.failed.push({
          factText: fact.fact_text.substring(0, 100),
          poiId: fact.poi_id,
          error: error.message,
        });
        console.error(`    ✗ ${fact.fact_text.substring(0, 50)}... — ${error.message}`);
      } else {
        result.inserted++;
      }
    }
  }

  return result;
}

// Usage with reporting
const result = await backfillPlaceKnowledgeWithErrorRecovery(facts, {
  chunkSize: 50,
  dryRun: false,
});

console.log(`\n${"=".repeat(60)}`);
console.log(`✅ Backfill Summary`);
console.log(`  Inserted: ${result.inserted}`);
console.log(`  Skipped: ${result.skipped}`);
console.log(`  Failed: ${result.failed.length}`);

if (result.failed.length > 0) {
  console.log(`\n⚠️  Failed facts:`);
  for (const fail of result.failed.slice(0, 10)) {
    console.log(`  - ${fail.factText} (${fail.poiId}): ${fail.error}`);
  }
  if (result.failed.length > 10) {
    console.log(`  ... and ${result.failed.length - 10} more`);
  }
}
```

**Advantages:**
- Handles large datasets gracefully
- Per-row error tracking
- Can resume after partial failure
- Progress feedback

**Disadvantages:**
- Slower than batch insert (per-row round-trips)
- More verbose logging

---

## Comparison Matrix

| Pattern | Deduplication | Re-runnable | Code Complexity | Performance | Use When |
|---------|---------------|-------------|-----------------|-------------|----------|
| **Hash** | In-memory SHA-256 | ✅ Yes | Medium | Good | Need full control, frequent re-runs |
| **ON CONFLICT** | DB unique constraint | ✅ Yes | Low | Excellent | Large batches, don't need update tracking |
| **SELECT + Merge** | App-level map | ✅ Yes | High | Fair | Need granular merge logic, --force support |
| **--force Delete** | Atomic delete + rebuild | ✅ Yes (destructive) | Medium | Good | Know targets upfront, want atomic guarantees |
| **Batch + Recovery** | In-memory hash + chunks | ✅ Yes | High | Fair | 1000+ facts, need error recovery |

---

## Recommended: Hybrid Pattern (Hash + Batch)

For production backfills of `place_knowledge`, combine Hash deduplication with batch chunking:

```typescript
async function backfillPlaceKnowledge(
  facts: PlaceKnowledgeInput[],
  options: { force?: boolean; chunkSize?: number; dryRun?: boolean } = {}
): Promise<BackfillResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const CHUNK_SIZE = options.chunkSize || 100;
  const result: BackfillResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    errors: [],
  };

  if (facts.length === 0) {
    console.log("No facts to backfill");
    return result;
  }

  // Phase 1: Optionally delete existing facts (--force)
  if (options.force) {
    const targetPoiIds = [...new Set(facts.map((f) => f.poi_id).filter(Boolean))] as string[];
    console.log(`🔥 --force: Deleting existing facts for ${targetPoiIds.length} POIs...`);

    for (const poiId of targetPoiIds) {
      const { count, error } = await supabase
        .from("place_knowledge")
        .delete()
        .eq("poi_id", poiId)
        .then((res) => ({
          count: res.count || 0,
          error: res.error,
        }));

      if (error) {
        result.errors.push(`Failed to delete ${poiId}: ${error.message}`);
      } else {
        result.deleted += count;
      }
    }
  }

  // Phase 2: Fetch existing facts for deduplication
  console.log("Fetching existing facts for deduplication...");
  const { data: existing } = await supabase
    .from("place_knowledge")
    .select("id, poi_id, area_id, topic, fact_text");

  const existingHashes = new Set<string>(
    (existing || []).map((row) =>
      computeContentHash(row.poi_id, row.area_id, row.topic, row.fact_text)
    )
  );

  // Phase 3: Process in chunks
  console.log(`Processing ${facts.length} facts in chunks of ${CHUNK_SIZE}...\n`);

  for (let i = 0; i < facts.length; i += CHUNK_SIZE) {
    const chunk = facts.slice(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(facts.length / CHUNK_SIZE);

    console.log(`Chunk ${chunkNum}/${totalChunks}:`);

    // Deduplicate
    const toInsert = [];
    const seenInChunk = new Set<string>();

    for (const fact of chunk) {
      const hash = computeContentHash(fact.poi_id, fact.area_id, fact.topic, fact.fact_text);

      if (existingHashes.has(hash) || seenInChunk.has(hash)) {
        result.skipped++;
      } else {
        toInsert.push(fact);
        seenInChunk.add(hash);
        existingHashes.add(hash);
      }
    }

    if (toInsert.length === 0) {
      console.log(`  ⊘ All ${chunk.length} facts already exist\n`);
      continue;
    }

    // Insert
    if (options.dryRun) {
      console.log(`  [DRY RUN] Would insert ${toInsert.length} facts\n`);
      result.inserted += toInsert.length;
      continue;
    }

    const batch = toInsert.map((fact) => ({
      poi_id: fact.poi_id || null,
      area_id: fact.area_id || null,
      topic: fact.topic,
      fact_text: fact.fact_text,
      fact_text_en: fact.fact_text_en || null,
      source_name: fact.source_name || null,
      source_url: fact.source_url || null,
      confidence: fact.confidence || "unverified",
      display_ready: fact.display_ready ?? false,
      sort_order: fact.sort_order ?? 0,
    }));

    const { error } = await supabase.from("place_knowledge").insert(batch);

    if (error) {
      result.errors.push(`Chunk ${chunkNum} insert failed: ${error.message}`);
      console.error(`  ✗ Insert failed: ${error.message}\n`);
    } else {
      result.inserted += toInsert.length;
      console.log(`  ✓ Inserted ${toInsert.length} facts\n`);
    }
  }

  return result;
}

// Main script
async function main() {
  const isForce = process.argv.includes("--force");
  const isDryRun = process.argv.includes("--dry-run");

  console.log(`${"=".repeat(60)}`);
  console.log(`📚 Place Knowledge Backfill`);
  console.log(`  Mode: ${isForce ? "FORCE (delete + rebuild)" : "NORMAL (insert new)"}`);
  console.log(`  Dry Run: ${isDryRun ? "YES" : "NO"}`);
  console.log(`${"=".repeat(60)}\n`);

  const facts = await loadFactsFromAPI(); // Your data source

  const result = await backfillPlaceKnowledge(facts, {
    force: isForce,
    dryRun: isDryRun,
    chunkSize: 100,
  });

  // Report
  console.log(`${"=".repeat(60)}`);
  console.log(`✅ Backfill Complete`);
  console.log(`  Inserted: ${result.inserted}`);
  console.log(`  Updated: ${result.updated}`);
  console.log(`  Skipped: ${result.skipped}`);
  console.log(`  Deleted: ${result.deleted}`);
  console.log(`  Errors: ${result.errors.length}`);
  console.log(`${"=".repeat(60)}`);

  if (result.errors.length > 0) {
    console.error("\nErrors:");
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
}

main().catch(console.error);
```

---

## Command-Line Interface

```bash
# Normal run (insert new facts only)
npx tsx scripts/backfill-place-knowledge.ts

# Dry run (preview without inserting)
npx tsx scripts/backfill-place-knowledge.ts --dry-run

# Force mode (delete existing, rebuild from scratch)
npx tsx scripts/backfill-place-knowledge.ts --force

# Force + dry run (preview what would be deleted)
npx tsx scripts/backfill-place-knowledge.ts --force --dry-run
```

---

## Summary: Quick Decision Tree

```
Do you know the exact POIs that will be affected?
├─ YES → Use --force Delete pattern (Pattern 4)
│       Atomic, prevents orphans, simplest semantics
└─ NO → Use Hash + Batch pattern (Hybrid)
        Idempotent, works with discovery, full control

Is this a one-time bulk import or recurring?
├─ ONE-TIME → Use ON CONFLICT (Pattern 2)
│             Fastest, minimal code
└─ RECURRING → Use Hash (Pattern 1) or Hybrid
               Re-runnable, detects changes

Do you need to distinguish inserted/updated/skipped?
├─ YES → Use SELECT + Merge (Pattern 3)
│       Full control, granular tracking
└─ NO → Use ON CONFLICT (Pattern 2)
        Simplest, fastest
```

---

## Related Files

- `supabase/migrations/038_place_knowledge.sql` — Schema definition
- `supabase/migrations/039_seed_knowledge_trondheim.sql` — SQL seed example (reference only)
- `scripts/import-kommune-pois.ts` — Real-world import with error handling
- `scripts/migrate-trips-to-supabase.ts` — Trip migration with upsert patterns

