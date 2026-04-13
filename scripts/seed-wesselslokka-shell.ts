#!/usr/bin/env npx tsx
/**
 * Seed Wesselsløkka shell-data: homepage_url + theme.primaryColor.
 *
 * Usage:
 *   npx tsx scripts/seed-wesselslokka-shell.ts              # dry-run (default)
 *   npx tsx scripts/seed-wesselslokka-shell.ts --apply      # actually write
 *
 * Safeguards:
 *   - Default dry-run (ingen writes uten --apply)
 *   - Pre-write backup til backups/projects-{id}-shell-{ts}.json
 *   - JSONB-merge (preserver eksisterende theme-felter — bruker `||`-operator)
 *   - Concurrency guard via updated_at optimistic lock
 *   - Post-write verifisering (GET + sjekk at feltene er satt)
 *   - Idempotent — re-kjøring er safe
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

config({ path: ".env.local" });

const CUSTOMER_SLUG = "broset-utvikling-as";
const PROJECT_SLUG = "wesselslokka";

const TARGET_HOMEPAGE_URL = "https://www.wesselslokka.no/";
const TARGET_PRIMARY_COLOR = "#204c4c"; // teal (brainstorm-beslutning)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DRY_RUN = !process.argv.includes("--apply");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`ASSERT FAILED: ${message}`);
    process.exit(1);
  }
}

async function main() {
  assert(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL not set");
  assert(supabaseKey, "SUPABASE_SERVICE_ROLE_KEY not set");

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  console.log(`\n${DRY_RUN ? "🔍 DRY-RUN" : "✍️  APPLY"} — Wesselsløkka shell seed\n`);

  // --- 1. Hent nåværende state ---
  const getUrl = `${supabaseUrl}/rest/v1/projects?customer_id=eq.${CUSTOMER_SLUG}&url_slug=eq.${PROJECT_SLUG}&select=id,name,theme,homepage_url,updated_at`;
  const getRes = await fetch(getUrl, { headers });
  assert(getRes.ok, `GET failed: ${getRes.status}`);
  const rows = await getRes.json();
  assert(Array.isArray(rows) && rows.length === 1, `Expected 1 row, got ${rows?.length}`);

  const current = rows[0] as {
    id: string;
    name: string;
    theme: Record<string, unknown> | null;
    homepage_url: string | null;
    updated_at: string;
  };

  console.log("📊 BEFORE:");
  console.log(`  id:           ${current.id}`);
  console.log(`  name:         ${current.name}`);
  console.log(`  homepage_url: ${current.homepage_url ?? "null"}`);
  console.log(`  theme:        ${JSON.stringify(current.theme) ?? "null"}`);
  console.log(`  updated_at:   ${current.updated_at}`);

  // --- 2. Backup ---
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `projects-${current.id}-shell-${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(current, null, 2));
  console.log(`\n💾 Backup: ${backupPath}`);

  // --- 3. Build merged theme (preserver eksisterende felter) ---
  const mergedTheme = {
    ...(current.theme ?? {}),
    primaryColor: TARGET_PRIMARY_COLOR,
  };

  console.log("\n📝 PLANLAGTE ENDRINGER:");
  console.log(`  homepage_url: ${current.homepage_url ?? "null"} → ${TARGET_HOMEPAGE_URL}`);
  console.log(`  theme:        merge + primaryColor=${TARGET_PRIMARY_COLOR}`);
  console.log(`  merged theme: ${JSON.stringify(mergedTheme)}`);

  if (DRY_RUN) {
    console.log("\n✅ DRY-RUN complete. Re-run med --apply for å skrive.");
    return;
  }

  // --- 4. Apply via PATCH med optimistic concurrency lock ---
  const patchUrl = `${supabaseUrl}/rest/v1/projects?id=eq.${current.id}&updated_at=eq.${encodeURIComponent(current.updated_at)}`;
  const patchRes = await fetch(patchUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      homepage_url: TARGET_HOMEPAGE_URL,
      theme: mergedTheme,
    }),
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    console.error(`\n❌ PATCH failed: ${patchRes.status}\n${errText}`);
    process.exit(1);
  }

  const updated = (await patchRes.json()) as unknown[];
  assert(
    Array.isArray(updated) && updated.length === 1,
    `Concurrency lock trigget — rad endret siden backup. Re-kjør scriptet. (got ${updated?.length} rows)`
  );

  console.log("\n✅ PATCH OK");

  // --- 5. Verifiser ---
  const verifyRes = await fetch(getUrl, { headers });
  assert(verifyRes.ok, "Verification GET failed");
  const verifyRows = await verifyRes.json();
  const after = verifyRows[0];

  console.log("\n📊 AFTER:");
  console.log(`  homepage_url: ${after.homepage_url}`);
  console.log(`  theme:        ${JSON.stringify(after.theme)}`);

  assert(
    after.homepage_url === TARGET_HOMEPAGE_URL,
    `homepage_url mismatch: expected ${TARGET_HOMEPAGE_URL}, got ${after.homepage_url}`
  );
  assert(
    after.theme?.primaryColor === TARGET_PRIMARY_COLOR,
    `theme.primaryColor mismatch: expected ${TARGET_PRIMARY_COLOR}, got ${after.theme?.primaryColor}`
  );

  // Sjekk at eksisterende theme-felter er bevart (hvis noen)
  if (current.theme) {
    for (const [key, val] of Object.entries(current.theme)) {
      if (key === "primaryColor") continue; // vi overrider denne med vilje
      assert(
        JSON.stringify(after.theme[key]) === JSON.stringify(val),
        `Theme-nøkkel "${key}" ble ikke bevart! Before=${JSON.stringify(val)}, After=${JSON.stringify(after.theme[key])}`
      );
    }
    console.log(`  ✓ Alle eksisterende theme-felter bevart`);
  }

  console.log(`\n🎉 Success. Backup: ${backupPath}`);
  console.log(`\nRollback-kommando (manuell):`);
  console.log(`  curl -X PATCH "${supabaseUrl}/rest/v1/projects?id=eq.${current.id}" \\`);
  console.log(`    -H "apikey: \$SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '${JSON.stringify({ homepage_url: current.homepage_url, theme: current.theme })}'`);
}

main().catch((err) => {
  console.error("\n💥 Error:", err);
  process.exit(1);
});
