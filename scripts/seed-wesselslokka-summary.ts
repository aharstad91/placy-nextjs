#!/usr/bin/env npx tsx
/**
 * Seed Wesselsløkka summary/brokers/cta into products.config via Supabase REST.
 *
 * Usage:
 *   npx tsx scripts/seed-wesselslokka-summary.ts              # dry-run (default, safe)
 *   npx tsx scripts/seed-wesselslokka-summary.ts --apply      # actually write
 *
 * Safeguards:
 *   - Default dry-run (no writes without --apply)
 *   - Pre-write backup to backups/products-{id}-{ts}.json
 *   - Whitelist check on existing reportConfig keys
 *   - Concurrency guard via updated_at optimistic lock
 *   - Shallow merge (preserves themes, trails, heroIntro, label, mapStyle)
 *   - Post-write data verification (deep-equal against backup for preserved keys)
 *   - Post-write HTTP verification (rapport route renders with headline)
 *   - Logs exact rollback command on success
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import {
  WESSELSLOKKA_SUMMARY,
  WESSELSLOKKA_BROKERS,
  WESSELSLOKKA_CTA,
} from "../data/wesselslokka-summary";

config({ path: ".env.local" });

const CUSTOMER_SLUG = "broset-utvikling-as";
const PROJECT_SLUG = "wesselslokka";
const REPORT_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

const ALLOWED_REPORTCONFIG_KEYS = new Set([
  "label",
  "heroIntro",
  "themes",
  "summary",
  "brokers",
  "cta",
  "mapStyle",
  "trails",
  // Deprecated but tolerated — old rows may still carry these JSONB keys
  "closingTitle",
  "closingText",
]);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DRY_RUN = !process.argv.includes("--apply");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`ASSERT FAILED: ${message}`);
    process.exit(1);
  }
}

async function fetchProject(): Promise<{ id: string }> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/projects?customer_id=eq.${CUSTOMER_SLUG}&url_slug=eq.${PROJECT_SLUG}&select=id`,
    {
      headers: {
        apikey: supabaseKey!,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  );
  const body = await res.json();
  assert(Array.isArray(body), `Unexpected response from projects query: ${JSON.stringify(body)}`);
  const rows = body as Array<{ id: string }>;
  assert(rows.length > 0, `No project found for ${CUSTOMER_SLUG}/${PROJECT_SLUG}`);
  return { id: rows[0].id };
}

interface Product {
  id: string;
  config: Record<string, unknown> | null;
  updated_at: string;
}

async function fetchReportProduct(projectId: string): Promise<Product> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/products?project_id=eq.${projectId}&product_type=eq.report&select=id,config,updated_at`,
    {
      headers: {
        apikey: supabaseKey!,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  );
  const body = await res.json();
  assert(Array.isArray(body), `Unexpected response from products query: ${JSON.stringify(body)}`);
  const rows = body as Product[];
  assert(rows.length > 0, `No report product for project ${projectId}`);
  return rows[0];
}

async function main() {
  assert(supabaseUrl, "Missing NEXT_PUBLIC_SUPABASE_URL");
  assert(supabaseKey, "Missing SUPABASE_SERVICE_ROLE_KEY");

  console.log("=== Wesselsløkka Summary Seed ===");
  console.log(`Target: ${supabaseUrl}`);
  console.log(`Mode:   ${DRY_RUN ? "DRY RUN (no writes)" : "APPLY"}`);
  console.log();

  // 1. Find target
  const project = await fetchProject();
  const product = await fetchReportProduct(project.id);
  console.log(`Project:   ${project.id}`);
  console.log(`Product:   ${product.id}`);
  console.log(`Updated:   ${product.updated_at}`);
  console.log();

  const existingConfig = product.config ?? {};
  const existingReportConfig =
    (existingConfig as Record<string, unknown>).reportConfig as
      | Record<string, unknown>
      | undefined ?? {};

  // 2. Whitelist check
  const existingKeys = Object.keys(existingReportConfig);
  const unknownKeys = existingKeys.filter(
    (k) => !ALLOWED_REPORTCONFIG_KEYS.has(k),
  );
  if (unknownKeys.length > 0) {
    console.error(
      `ABORT: Unknown reportConfig keys found: ${unknownKeys.join(", ")}`,
    );
    console.error(
      "Refusing to write without understanding all existing keys.",
    );
    process.exit(1);
  }
  console.log(
    `Whitelist OK. Existing keys: ${existingKeys.length ? existingKeys.join(", ") : "(none)"}`,
  );

  // 3. Backup
  const backupDir = path.resolve(".", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `products-${product.id}-${Date.now()}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(product, null, 2));
  console.log(`Backup:    ${backupPath}`);
  console.log();

  // 4. Merge (shallow spread preserves themes, trails, heroIntro, label, mapStyle)
  const newReportConfig = {
    ...existingReportConfig,
    summary: WESSELSLOKKA_SUMMARY,
    brokers: WESSELSLOKKA_BROKERS,
    cta: WESSELSLOKKA_CTA,
  };
  const newConfig = {
    ...existingConfig,
    reportConfig: newReportConfig,
  };

  // 5. Show diff
  console.log("--- Diff (reportConfig only) ---");
  console.log("Before keys:", Object.keys(existingReportConfig).sort());
  console.log("After  keys:", Object.keys(newReportConfig).sort());
  console.log();
  console.log("New summary.headline:", WESSELSLOKKA_SUMMARY.headline);
  console.log(`New brokers: ${WESSELSLOKKA_BROKERS.length}`);
  console.log("New cta.leadUrl:", WESSELSLOKKA_CTA.leadUrl);
  console.log();

  if (DRY_RUN) {
    console.log("DRY RUN complete. Re-run with --apply to write.");
    console.log(`Backup is still at: ${backupPath}`);
    return;
  }

  // 6. Concurrency guard: updated_at must match what we just read
  const patchUrl = new URL(`${supabaseUrl}/rest/v1/products`);
  patchUrl.searchParams.set("id", `eq.${product.id}`);
  patchUrl.searchParams.set("updated_at", `eq.${product.updated_at}`);

  const patchRes = await fetch(patchUrl.toString(), {
    method: "PATCH",
    headers: {
      apikey: supabaseKey!,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ config: newConfig }),
  });

  if (!patchRes.ok) {
    const text = await patchRes.text();
    console.error(`PATCH failed: ${patchRes.status} ${text}`);
    console.error(`Backup available at: ${backupPath}`);
    process.exit(1);
  }

  const patched = (await patchRes.json()) as Product[];
  if (!Array.isArray(patched) || patched.length === 0) {
    console.error(
      "PATCH affected 0 rows — possible concurrent write. Aborting.",
    );
    console.error(`Backup available at: ${backupPath}`);
    process.exit(1);
  }
  console.log(`PATCH OK. ${patched.length} row(s) updated.`);

  // 7. Post-write data verification
  const verifiedProduct = await fetchReportProduct(project.id);
  const verifiedReportConfig =
    (verifiedProduct.config as Record<string, unknown>)?.reportConfig as
      | Record<string, unknown>
      | undefined ?? {};

  // New fields present?
  const vSummary = verifiedReportConfig.summary as ReturnType<
    () => typeof WESSELSLOKKA_SUMMARY
  >;
  assert(
    vSummary?.headline === WESSELSLOKKA_SUMMARY.headline,
    "summary.headline not persisted",
  );
  const vBrokers = verifiedReportConfig.brokers as typeof WESSELSLOKKA_BROKERS;
  assert(
    Array.isArray(vBrokers) && vBrokers.length === WESSELSLOKKA_BROKERS.length,
    "brokers not persisted correctly",
  );
  const vCta = verifiedReportConfig.cta as typeof WESSELSLOKKA_CTA;
  assert(
    vCta?.leadUrl === WESSELSLOKKA_CTA.leadUrl,
    "cta.leadUrl not persisted",
  );
  console.log("Data verification: new fields present");

  // Preserved fields deep-equal against backup
  const backup = JSON.parse(
    fs.readFileSync(backupPath, "utf-8"),
  ) as Product;
  const backupReportConfig =
    (backup.config as Record<string, unknown>)?.reportConfig as
      | Record<string, unknown>
      | undefined ?? {};
  const preservedKeys = ["label", "heroIntro", "themes", "trails", "mapStyle"];
  for (const key of preservedKeys) {
    const before = JSON.stringify(backupReportConfig[key] ?? null);
    const after = JSON.stringify(verifiedReportConfig[key] ?? null);
    assert(
      before === after,
      `Preserved key '${key}' was modified! Rollback: npx tsx scripts/restore-product-config.ts ${backupPath}`,
    );
  }
  console.log("Data verification: preserved fields unchanged");

  // 8. Post-write HTTP verification
  const reportUrl = `${REPORT_URL}/eiendom/${CUSTOMER_SLUG}/${PROJECT_SLUG}/rapport`;
  console.log(`HTTP check: ${reportUrl}`);
  try {
    const reportRes = await fetch(reportUrl);
    assert(
      reportRes.status === 200,
      `Report route returned ${reportRes.status}`,
    );
    const html = await reportRes.text();
    const headlineSnippet = WESSELSLOKKA_SUMMARY.headline.slice(0, 40);
    assert(
      html.includes(headlineSnippet),
      `Headline "${headlineSnippet}" not found in rendered HTML`,
    );
    console.log("HTTP check: 200 + headline present in HTML");
  } catch (err) {
    console.warn(
      `HTTP check skipped (dev server may not be running): ${err instanceof Error ? err.message : err}`,
    );
  }

  console.log();
  console.log("✓ Seed complete and verified");
  console.log(`  Backup:   ${backupPath}`);
  console.log(
    `  Rollback: npx tsx scripts/restore-product-config.ts ${backupPath}`,
  );
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
