/**
 * Reclassify place_knowledge facts from v0.1 (9 topics) to v0.2 (19 topics).
 *
 * Hand-curated reclassification based on reading all 231 facts.
 * Each move is a clear improvement — borderline cases are left as-is.
 *
 * Usage:
 *   npx tsx scripts/reclassify-knowledge-v02.ts --dry-run    # Preview changes
 *   npx tsx scripts/reclassify-knowledge-v02.ts               # Apply changes
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

// === Reclassification map: id → new topic ===
// Each entry was manually reviewed. Only clear improvements — no borderline moves.

const RECLASSIFICATIONS: Record<string, { newTopic: string; reason: string }> = {
  // === architecture → atmosphere (interior/vibe, not building structure) ===
  "d664f093": { newTopic: "atmosphere", reason: "Describes compact, intimate space feel — not building architecture" },
  "83482688": { newTopic: "atmosphere", reason: "Interior design by Myhr Interiør — atmosphere, not architecture" },
  "c1f09969": { newTopic: "atmosphere", reason: "Art Deco interior with flamingo decor — atmosphere" },
  "eb9356c9": { newTopic: "atmosphere", reason: "Interior design by Metropolis — spa atmosphere" },

  // === culture → awards (recognition/prizes) ===
  "bdd9b9d8": { newTopic: "awards", reason: "National Geographic Årets kafé — award" },
  "94ce1e75": { newTopic: "awards", reason: "National Geographic Best Cafe of the Year — award" },

  // === culture → sustainability ===
  "4801e413": { newTopic: "sustainability", reason: "Pioneer for sustainable gastronomy, green Michelin star" },

  // === culture → signature (what makes a place distinctively itself) ===
  "76a09546": { newTopic: "signature", reason: "Surprise menu concept — Bula's signature" },
  "80c71115": { newTopic: "signature", reason: "Three Italian food traditions under one roof — DDs signature" },

  // === culture → atmosphere ===
  "37e5f513": { newTopic: "atmosphere", reason: "Continental bar with intimate concert stage — describes vibe" },
  "f1a31b6b": { newTopic: "atmosphere", reason: "Wine bar with photo exhibitions — atmosphere" },
  "d0bd2811": { newTopic: "atmosphere", reason: "Rock/metal bar with board games and retro games — describes vibe" },

  // === culture → relationships (community/social connections) ===
  "76ddee87": { newTopic: "relationships", reason: "70 language practice spots via refugee services — community" },
  "dd581422": { newTopic: "relationships", reason: "Social café with work training — community relationships" },

  // === food → drinks (beverage-focused facts in food topic) ===
  "e60a24bb": { newTopic: "drinks", reason: "Bar Moskus is a drinks bar with no food — 11 beer taps" },
  "2edc17b3": { newTopic: "drinks", reason: "Craft beer and cocktails — drinks" },
  "d71f413d": { newTopic: "drinks", reason: "Den Gode Nabo beer selection — drinks" },
  "7c5e83a6": { newTopic: "drinks", reason: "Carpe Diem wine bar — drinks" },
  "9e71f939": { newTopic: "drinks", reason: "Daglighallen beer bar and microbrewery — drinks" },
  "b6cdb446": { newTopic: "drinks", reason: "Akevitt collection of 350+ varieties — drinks" },
  "7b2f38c0": { newTopic: "drinks", reason: "Specialty coffee roaster, SCA 90+ score — drinks" },
  "2b970c5b": { newTopic: "drinks", reason: "Natural wine bar — drinks" },
  "cf644e86": { newTopic: "drinks", reason: "Italian natural wines from own import company — drinks focus" },

  // === food → signature (what defines a place's food identity) ===
  "6dd7d11f": { newTopic: "signature", reason: "Credo's local-only, seasonal philosophy — their signature" },
  "3720abfa": { newTopic: "signature", reason: "Surprise menu where kitchen decides — Bula's signature" },
  "4db7d84d": { newTopic: "signature", reason: "Nordic-Asian neobistro concept — Bula's signature" },

  // === local_knowledge → insider (actionable tips) ===
  "ba2ad79d": { newTopic: "insider", reason: "Cheapest way to experience Britannia — insider tip" },
  "df815ee7": { newTopic: "insider", reason: "Best window seats, lutefisk season tip — insider" },
  "0d88651a": { newTopic: "insider", reason: "Bistro uses same premium ingredients — insider tip" },
  "90149d04": { newTopic: "insider", reason: "Best bread in town, come before 10 — insider tip" },
  "7a4b4cd9": { newTopic: "insider", reason: "Most popular cocktail bar — insider recommendation" },
  "278301a8": { newTopic: "insider", reason: "Thursday unlimited pasta night — insider tip" },
  "8ad88e51": { newTopic: "insider", reason: "Order the sharing menu for best experience — insider tip" },
  "c738047f": { newTopic: "insider", reason: "Open to non-guests with treatment booking — insider tip" },
  "da6def2c": { newTopic: "insider", reason: "Coffee city tip, ask baristas — insider" },
  "9c961a4b": { newTopic: "insider", reason: "Among Norway's best pizza — insider recommendation" },
  "62197396": { newTopic: "insider", reason: "Known among locals as best spot — insider" },
  "48aee83b": { newTopic: "insider", reason: "Bakklandet/Møllenberg neighborhood guide — insider" },

  // === local_knowledge → culture ===
  "75e01c4f": { newTopic: "culture", reason: "Author evenings, book launches — cultural programming" },

  // === local_knowledge → history ===
  "7db42365": { newTopic: "history", reason: "Historical skydsstation function explained — history" },
  "c847141f": { newTopic: "history", reason: "Largest archaeological excavation in Norway — history" },

  // === local_knowledge → atmosphere ===
  "894c5b77": { newTopic: "atmosphere", reason: "130 board games, Nintendo 64 — describes the vibe" },

  // === nature → atmosphere (interior design, not nature) ===
  "45d33f55": { newTopic: "atmosphere", reason: "Mineral pool with Astral Lights dome — spa atmosphere" },
  "bd55d774": { newTopic: "atmosphere", reason: "Palmehaven winter garden interior — atmosphere" },

  // === nature → spatial (location relative to river, not nature itself) ===
  "2459c6d0": { newTopic: "spatial", reason: "Describes Havfruen's position on west side of Nidelva — location" },
  "cca0cbfd": { newTopic: "spatial", reason: "Den Gode Nabo directly on Nidelva — location description" },
  "b62cffeb": { newTopic: "spatial", reason: "East side of Nidelva with views — location description" },

  // === practical → accessibility ===
  "807555c1": { newTopic: "accessibility", reason: "Wheelchair accessible — accessibility info" },
  "11806aff": { newTopic: "accessibility", reason: "Not wheelchair accessible — accessibility info" },

  // === practical → insider (hidden tips disguised as practical info) ===
  "5f554228": { newTopic: "insider", reason: "Full most nights, no reservation — insider knowledge" },
};

// === Helpers ===

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

// === Main ===

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const entries = Object.entries(RECLASSIFICATIONS);
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== RECLASSIFY KNOWLEDGE v0.2 ===");
  console.log(`${entries.length} facts to reclassify\n`);

  // Fetch current topics to verify and show before→after
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

  // Build lookup by short ID prefix
  const factMap = new Map<string, typeof facts[0]>();
  for (const f of facts) {
    factMap.set(f.id.slice(0, 8), f);
  }

  // Group by move type for readable output
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

  // Print grouped summary
  let totalMoves = 0;
  for (const [moveKey, group] of Array.from(moveGroups.entries()).sort()) {
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

  // Apply changes
  console.log("\nApplying changes...\n");
  let success = 0;
  let failed = 0;

  for (const [, group] of Array.from(moveGroups)) {
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
