#!/usr/bin/env npx tsx
/**
 * Seed trail data into a project's reportConfig.
 *
 * Usage:
 *   npx tsx scripts/seed-trails.ts <lat> <lng> [radiusKm]
 *   npx tsx scripts/seed-trails.ts 63.42 10.39 3
 *
 * Outputs GeoJSON to stdout. Pipe to a file or use to update Supabase.
 */

import { fetchTrails } from "../lib/generators/trail-fetcher";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: npx tsx scripts/seed-trails.ts <lat> <lng> [radiusKm]");
    process.exit(1);
  }

  const lat = parseFloat(args[0]);
  const lng = parseFloat(args[1]);
  const radiusKm = args[2] ? parseFloat(args[2]) : 3;

  console.error(`Fetching trails for (${lat}, ${lng}) radius ${radiusKm}km...`);

  try {
    const trails = await fetchTrails({ lat, lng, radiusKm });

    console.error(`Found ${trails.features.length} trails:`);
    for (const f of trails.features) {
      const coordCount = f.geometry.type === "LineString"
        ? f.geometry.coordinates.length
        : f.geometry.coordinates.reduce((s, l) => s + l.length, 0);
      console.error(`  - ${f.properties.name} (${f.properties.routeType}, ${coordCount} coords)`);
    }

    // Output JSON to stdout
    process.stdout.write(JSON.stringify(trails, null, 2));
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

main();
