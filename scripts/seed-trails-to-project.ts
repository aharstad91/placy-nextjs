#!/usr/bin/env npx tsx
/**
 * Seed trail GeoJSON into a project's reportConfig in Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed-trails-to-project.ts <project-slug> <trails-json-path>
 *   npx tsx scripts/seed-trails-to-project.ts broset data/test-trails-broset.json
 *
 * This updates the product's config JSONB to include reportConfig.trails.
 */

import * as fs from "fs";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: npx tsx scripts/seed-trails-to-project.ts <project-slug> <trails-json>");
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const projectSlug = args[0];
  const trailsPath = args[1];

  // Read trails JSON
  const trailsJson = JSON.parse(fs.readFileSync(trailsPath, "utf-8"));
  console.log(`Loaded ${trailsJson.features.length} trails from ${trailsPath}`);

  // Find the project container by slug
  const containerRes = await fetch(
    `${supabaseUrl}/rest/v1/project_containers?url_slug=eq.${projectSlug}&select=id`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  const containers = await containerRes.json();

  if (!containers.length) {
    console.error(`No project container found with slug: ${projectSlug}`);
    process.exit(1);
  }

  const containerId = containers[0].id;
  console.log(`Found container: ${containerId}`);

  // Find the report product
  const productRes = await fetch(
    `${supabaseUrl}/rest/v1/products?container_id=eq.${containerId}&product_type=eq.report&select=id,config`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  const products = await productRes.json();

  if (!products.length) {
    console.error(`No report product found for container: ${containerId}`);
    process.exit(1);
  }

  const product = products[0];
  const existingConfig = product.config || {};
  const existingReportConfig = existingConfig.reportConfig || {};

  // Merge trails into reportConfig
  const updatedConfig = {
    ...existingConfig,
    reportConfig: {
      ...existingReportConfig,
      trails: trailsJson,
    },
  };

  // Update the product
  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/products?id=eq.${product.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ config: updatedConfig }),
    }
  );

  if (!updateRes.ok) {
    const text = await updateRes.text();
    console.error(`Failed to update product: ${updateRes.status} ${text}`);
    process.exit(1);
  }

  console.log(`Updated report product ${product.id} with ${trailsJson.features.length} trails`);
  console.log("Done! Reload the report page to see the trails.");
}

main();
