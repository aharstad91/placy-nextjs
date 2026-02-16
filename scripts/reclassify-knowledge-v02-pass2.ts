/**
 * Reclassify place_knowledge facts — Pass 2.
 *
 * After reading ALL 231 facts with full text, these 9 additional moves
 * were identified. Pass 1 moved 50 facts; pass 2 catches the remaining
 * misplacements after thorough review.
 *
 * Usage:
 *   npx tsx scripts/reclassify-knowledge-v02-pass2.ts --dry-run
 *   npx tsx scripts/reclassify-knowledge-v02-pass2.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const RECLASSIFICATIONS: Record<string, { newTopic: string; reason: string }> = {
  // === culture → history (historical event, not cultural identity) ===
  "ad44499e": { newTopic: "history", reason: "Deportation of 74 Jews to Auschwitz in 1942 — historical event" },

  // === culture → signature (what defines the place) ===
  "294b1aad": { newTopic: "signature", reason: "Hevd's unique 3-tradition baking philosophy + Dolcemattino award — defines the place" },

  // === local_knowledge → practical (current status info) ===
  "4a148384": { newTopic: "practical", reason: "Credo not in Trondheim anymore — practical status update for visitors" },

  // === local_knowledge → culture (cultural significance) ===
  "7a11554a": { newTopic: "culture", reason: "Credo's food cluster and loss of green Michelin star — cultural impact on city" },
  "a9069d4d": { newTopic: "culture", reason: "Brattørgata as independent/chain-free cultural street — neighborhood culture" },

  // === local_knowledge → architecture (building features) ===
  "099a4e27": { newTopic: "architecture", reason: "Medieval heating shaft, private chambers, covered bridge — building features" },

  // === nature → spatial (man-made courtyard, not nature) ===
  "20ff18f3": { newTopic: "spatial", reason: "Erkebispegården courtyard is man-made stone space — not nature" },

  // === practical → insider (actionable local tip) ===
  "3c45178e": { newTopic: "insider", reason: "'Come early, best items sell fast' — insider advice" },

  // === architecture → practical (facility description, not architecture) ===
  "f8b9a5d3": { newTopic: "practical", reason: "'1400 m² with pool, mineral pool, treatment rooms' — facility specs, not architecture" },
};

async function supabasePatch(
  id: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/place_knowledge?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }
  return { ok: true };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const entries = Object.entries(RECLASSIFICATIONS);
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== RECLASSIFY KNOWLEDGE v0.2 — PASS 2 ===");
  console.log(`${entries.length} facts to reclassify\n`);

  // Fetch current topics
  const ids = entries.map(([id]) => id);
  const idFilter = ids.map((id) => `id.like.${id}*`).join(",");

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/place_knowledge?select=id,topic,fact_text,pois(name)&or=(${idFilter})`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    console.error(`Failed to fetch facts: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const facts = (await res.json()) as {
    id: string;
    topic: string;
    fact_text: string;
    pois: { name: string } | null;
  }[];

  const factMap = new Map<string, typeof facts[0]>();
  for (const f of facts) {
    factMap.set(f.id.slice(0, 8), f);
  }

  const moveGroups = new Map<string, { id: string; fullId: string; poiName: string; factSnippet: string; reason: string }[]>();

  let notFound = 0;
  let alreadyCorrect = 0;

  for (const [shortId, { newTopic, reason }] of entries) {
    const fact = factMap.get(shortId);
    if (!fact) {
      console.warn(`  WARN: Fact ${shortId} not found in database — skipping`);
      notFound++;
      continue;
    }

    if (fact.topic === newTopic) {
      alreadyCorrect++;
      continue;
    }

    const moveKey = `${fact.topic} → ${newTopic}`;
    const group = moveGroups.get(moveKey) ?? [];
    group.push({
      id: shortId,
      fullId: fact.id,
      poiName: fact.pois?.name ?? "?",
      factSnippet: fact.fact_text.length > 80 ? fact.fact_text.slice(0, 80) + "..." : fact.fact_text,
      reason,
    });
    moveGroups.set(moveKey, group);
  }

  let totalMoves = 0;
  for (const [moveKey, group] of [...moveGroups.entries()].sort()) {
    console.log(`\n${moveKey} (${group.length}):`);
    for (const item of group) {
      console.log(`  ${item.poiName}: ${item.factSnippet}`);
      console.log(`    ↳ ${item.reason}`);
    }
    totalMoves += group.length;
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total reclassifications: ${totalMoves}`);
  console.log(`Already correct: ${alreadyCorrect}`);
  console.log(`Not found: ${notFound}`);

  if (DRY_RUN) {
    console.log("\nThis was a DRY RUN. No data was modified.");
    return;
  }

  console.log("\nApplying changes...\n");
  let success = 0;
  let failed = 0;

  for (const [, group] of moveGroups) {
    for (const item of group) {
      const newTopic = RECLASSIFICATIONS[item.id].newTopic;
      const result = await supabasePatch(item.fullId, { topic: newTopic });

      if (result.ok) {
        success++;
        console.log(`  OK   [${item.id}] ${item.poiName}: → ${newTopic}`);
      } else {
        failed++;
        console.error(`  ERR  [${item.id}] ${item.poiName}: ${result.error}`);
      }
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Updated: ${success}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
