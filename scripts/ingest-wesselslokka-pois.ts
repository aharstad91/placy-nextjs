#!/usr/bin/env npx tsx
/**
 * Kurert merge-ingest: legger NETTO-NYE Wesselsløkka-POI-er fra
 * data/projects/broset-utvikling-as/wesselslokka.json inn i Supabase, UTEN å
 * røre eksisterende POI-er, projects-raden eller products.config (grounding +
 * Plan A-felt er trygge).
 *
 * Kuratering:
 *   - Netto-nye: navn ikke allerede koblet til prosjektet
 *   - Kvalitet: har googleRating ELLER googleReviewCount > 0 (dropper "Fotballbane" o.l.)
 *   - Nærhet: ≤ MAX_DIST_M fra senter (dropper Dragvoll-student-kjellere ~2 km)
 *   - Eksplisitt navn-blokk: NAME_BLOCKLIST
 *
 * Skriver til: pois (upsert), project_pois (insert), product_pois (insert).
 *
 * Usage:
 *   npx tsx scripts/ingest-wesselslokka-pois.ts            # dry-run (default)
 *   npx tsx scripts/ingest-wesselslokka-pois.ts --apply    # skriv til Supabase
 *
 * Rollback: backups/ingest-wesselslokka-<ts>.json lister inserted poi_ids.
 * For å angre: slett de poi_id-ene fra project_pois + product_pois (og evt. pois).
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

config({ path: ".env.local" });

const CUSTOMER = "broset-utvikling-as";
const SLUG = "wesselslokka";
const PROJECT_ID = "broset-utvikling-as_wesselslokka";
const PRODUCT_ID = "c87b51f6-9cf7-4738-b452-cbea0bb62c65";
const CENTER = { lat: 63.422074, lng: 10.450617 };
const MAX_DIST_M = 1300;
const NAME_BLOCKLIST = new Set<string>([
  // Åpenbar støy / lite relevant for boligkjøper (kan utvides)
  "fotballbane",
]);

const DISCOVERY = path.resolve(
  "data/projects/broset-utvikling-as/wesselslokka.json",
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = !process.argv.includes("--apply");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`ASSERT FAILED: ${msg}`);
    process.exit(1);
  }
}

function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function sbGet(query: string): Promise<unknown> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${query}`, {
    headers: { apikey: supabaseKey!, Authorization: `Bearer ${supabaseKey}` },
  });
  if (!res.ok) {
    console.error(`GET ${query} failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  return res.json();
}

async function sbWrite(
  table: string,
  rows: unknown[],
  opts: { upsert?: boolean } = {},
): Promise<void> {
  if (rows.length === 0) return;
  const headers: Record<string, string> = {
    apikey: supabaseKey!,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    Prefer: opts.upsert
      ? "resolution=merge-duplicates,return=minimal"
      : "return=minimal",
  };
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    console.error(`POST ${table} failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
}

interface DiscoveryPOI {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  address?: string;
  category: { id: string };
  googlePlaceId?: string;
  googleRating?: number;
  googleReviewCount?: number;
}

async function main() {
  assert(supabaseUrl, "Mangler NEXT_PUBLIC_SUPABASE_URL");
  assert(supabaseKey, "Mangler SUPABASE_SERVICE_ROLE_KEY");
  assert(fs.existsSync(DISCOVERY), `Mangler discovery-fil: ${DISCOVERY}`);

  console.log("=== Wesselsløkka POI merge-ingest ===");
  console.log(`Target: ${supabaseUrl}`);
  console.log(`Mode:   ${DRY_RUN ? "DRY RUN (ingen skriving)" : "APPLY"}`);
  console.log();

  const discovery = JSON.parse(fs.readFileSync(DISCOVERY, "utf-8")) as {
    pois: DiscoveryPOI[];
  };

  // Eksisterende koblede POI-navn + link-sett
  const existingLinks = (await sbGet(
    `project_pois?project_id=eq.${encodeURIComponent(PROJECT_ID)}&select=poi_id,pois(name)`,
  )) as Array<{ poi_id: string; pois: { name: string } | null }>;
  const existingNames = new Set(
    existingLinks.map((l) => (l.pois?.name ?? "").trim().toLowerCase()),
  );
  const existingProjectPoiIds = new Set(existingLinks.map((l) => l.poi_id));

  const existingProductLinks = (await sbGet(
    `product_pois?product_id=eq.${PRODUCT_ID}&select=poi_id`,
  )) as Array<{ poi_id: string }>;
  const existingProductPoiIds = new Set(
    existingProductLinks.map((l) => l.poi_id),
  );

  console.log(
    `Eksisterende: ${existingNames.size} navn, ${existingProjectPoiIds.size} project_pois, ${existingProductPoiIds.size} product_pois`,
  );

  // Kandidater
  const dropped: Record<string, number> = {};
  const drop = (reason: string) => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
  };
  const candidates = discovery.pois.filter((p) => {
    const name = (p.name ?? "").trim().toLowerCase();
    if (!name) return false;
    if (existingNames.has(name)) return drop("allerede-finnes"), false;
    if (NAME_BLOCKLIST.has(name)) return drop("navn-blokk"), false;
    const hasSignal =
      p.googleRating != null || (p.googleReviewCount ?? 0) > 0;
    if (!hasSignal) return drop("ingen-rating/anmeldelser"), false;
    const dist = haversineM(CENTER, p.coordinates);
    if (dist > MAX_DIST_M) return drop(`>${MAX_DIST_M}m`), false;
    return true;
  });

  console.log(`\nKandidater (netto-nye, kuratert): ${candidates.length}`);
  console.log("Frafalt:", JSON.stringify(dropped));
  console.log("\n  kat            rating  anm   dist  navn");
  for (const p of candidates) {
    const dist = Math.round(haversineM(CENTER, p.coordinates));
    console.log(
      `  ${(p.category.id || "?").padEnd(13)} ${(p.googleRating ?? "-")
        .toString()
        .padStart(5)} ${(p.googleReviewCount ?? 0)
        .toString()
        .padStart(5)} ${dist.toString().padStart(5)}m  ${p.name}`,
    );
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN ferdig. ${candidates.length} POI-er ville blitt lagt til.`);
    console.log("Re-kjør med --apply for å skrive.");
    return;
  }

  if (candidates.length === 0) {
    console.log("\nIngen kandidater — ingenting å skrive.");
    return;
  }

  // Backup (liste over poi_ids vi legger til → rollback-grunnlag)
  const backupDir = path.resolve("backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `ingest-wesselslokka-${process.hrtime.bigint()}.json`,
  );
  const addedIds = candidates.map((p) => p.id);
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      { projectId: PROJECT_ID, productId: PRODUCT_ID, addedPoiIds: addedIds },
      null,
      2,
    ),
  );
  console.log(`\nBackup (added poi_ids): ${backupPath}`);

  // 1. Upsert POIs
  await sbWrite(
    "pois",
    candidates.map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.coordinates.lat,
      lng: p.coordinates.lng,
      address: p.address ?? null,
      category_id: p.category.id,
      google_place_id: p.googlePlaceId ?? null,
      google_rating: p.googleRating ?? null,
      google_review_count: p.googleReviewCount ?? null,
    })),
    { upsert: true },
  );
  console.log(`  ✓ pois upsert: ${candidates.length}`);

  // 2. project_pois (kun nye lenker)
  const newProjectLinks = candidates
    .filter((p) => !existingProjectPoiIds.has(p.id))
    .map((p) => ({ project_id: PROJECT_ID, poi_id: p.id }));
  await sbWrite("project_pois", newProjectLinks);
  console.log(`  ✓ project_pois insert: ${newProjectLinks.length}`);

  // 3. product_pois (kun nye lenker)
  const newProductLinks = candidates
    .filter((p) => !existingProductPoiIds.has(p.id))
    .map((p) => ({ product_id: PRODUCT_ID, poi_id: p.id }));
  await sbWrite("product_pois", newProductLinks);
  console.log(`  ✓ product_pois insert: ${newProductLinks.length}`);

  // 4. Verifiser
  const verifyProj = (await sbGet(
    `project_pois?project_id=eq.${encodeURIComponent(PROJECT_ID)}&select=poi_id`,
  )) as unknown[];
  const verifyProd = (await sbGet(
    `product_pois?product_id=eq.${PRODUCT_ID}&select=poi_id`,
  )) as unknown[];
  console.log(
    `\nEtter: ${verifyProj.length} project_pois (+${verifyProj.length - existingProjectPoiIds.size}), ${verifyProd.length} product_pois (+${verifyProd.length - existingProductPoiIds.size})`,
  );
  console.log(`✓ Ferdig. Rollback-grunnlag: ${backupPath}`);
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
