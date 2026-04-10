#!/usr/bin/env npx tsx
/**
 * Restore a product's config from a backup file created by seed-wesselslokka-summary.ts.
 *
 * Usage:
 *   npx tsx scripts/restore-product-config.ts backups/products-{id}-{ts}.json
 *
 * The backup file was written by the seed script before it PATCHed the product.
 * This script reads backup.config and PATCHes it back, restoring the pre-seed state.
 */

import * as fs from "fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`ASSERT FAILED: ${message}`);
    process.exit(1);
  }
}

async function main() {
  const backupPath = process.argv[2];
  assert(
    backupPath,
    "Usage: npx tsx scripts/restore-product-config.ts <backup-path>",
  );
  assert(supabaseUrl, "Missing NEXT_PUBLIC_SUPABASE_URL");
  assert(supabaseKey, "Missing SUPABASE_SERVICE_ROLE_KEY");
  assert(fs.existsSync(backupPath), `Backup file not found: ${backupPath}`);

  const backup = JSON.parse(fs.readFileSync(backupPath, "utf-8")) as {
    id: string;
    config: unknown;
  };

  assert(backup.id, "Backup file is missing `id` field");
  assert("config" in backup, "Backup file is missing `config` field");

  console.log("=== Restore Product Config ===");
  console.log(`Target:    ${supabaseUrl}`);
  console.log(`Product:   ${backup.id}`);
  console.log(`Backup:    ${backupPath}`);
  console.log();
  console.log("Proceeding with PATCH in 2 seconds. Ctrl+C to abort.");
  await new Promise((r) => setTimeout(r, 2000));

  const res = await fetch(
    `${supabaseUrl}/rest/v1/products?id=eq.${backup.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseKey!,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ config: backup.config }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`PATCH failed: ${res.status} ${text}`);
    process.exit(1);
  }

  const patched = (await res.json()) as Array<{ id: string }>;
  assert(
    Array.isArray(patched) && patched.length > 0,
    "PATCH affected 0 rows",
  );

  console.log(`✓ Restored product ${backup.id} from backup`);
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
