#!/usr/bin/env npx tsx
/**
 * Backfill av rekkevidde-konturer — gir eksisterende boards 5/10/15-minutt-
 * konturer for gange, sykkel og bil.
 *
 * Provisjonssteget (7c) ble lagt til 2026-09-03, så alle boards fra før det
 * står uten konturer og viser derfor ikke av/på-valget i kartkontrollen.
 *
 * Konturene er BEREGNET data, ikke kuratert innhold — overskriving er trygg, og
 * kjøringen er idempotent (samme origo gir samme polygoner). Skrivingen slår
 * likevel sammen per profil: en profil som feiler i denne kjøringen beholder
 * konturen fra forrige.
 *
 * CACHE: skrivingen buster `product:<kunde>_<slug>` via revalidate-endepunktet.
 * Uten det ligger konturene i basen mens boardet fortsetter å vise gammel
 * config, og knappen dukker aldri opp.
 *
 * Usage:
 *   npx tsx scripts/backfill-isochrones.ts                            # rapport (leser bare)
 *   npx tsx scripts/backfill-isochrones.ts broset-utvikling-as_wesselslokka
 *   npx tsx scripts/backfill-isochrones.ts --apply                    # SKRIVER til alle boards
 *   npx tsx scripts/backfill-isochrones.ts --apply placy-demo_sundsoya
 *
 * Flags:
 *   --apply      Skriv til databasen. Uten flagget er kjøringen ren lesing.
 *   --dry-run    Eksplisitt no-op (default; finnes for lesbarhet i logger).
 *
 * Kostnad: tre Isochrone-kall per board. Hele porteføljen er under 50 kall,
 * altså neglisjerbart mot månedskvoten på 100 000.
 */

import "./load-env";

import { createServerClient } from "@/lib/supabase/client";
import { computeProjectIsochrones } from "@/lib/pipeline/isochrones";
import { contourTravelModes } from "@/lib/board/contour-modes";
import { IsochroneSetSchema } from "@/lib/types";
import type { TravelMode } from "@/lib/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

interface ProjectRow {
  id: string;
  url_slug: string;
  customer_id: string;
  center_lat: number | null;
  center_lng: number | null;
}

interface ProductRow {
  id: string;
  project_id: string;
  config: unknown;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    apply: args.includes("--apply"),
    projectIds: args.filter((a) => !a.startsWith("--")),
  };
}

async function fetchProjects(projectIds: string[]): Promise<ProjectRow[]> {
  const db = createServerClient().schema("v2");
  let query = db
    .from("projects")
    .select("id, url_slug, customer_id, center_lat, center_lng")
    .order("id");
  if (projectIds.length) query = query.in("id", projectIds);

  const { data, error } = await query;
  if (error) throw new Error(`projects-oppslag feilet: ${error.message}`);
  return (data ?? []) as ProjectRow[];
}

/** Rapport-produktet per prosjekt — konturene bor i config-en dets. */
async function fetchProducts(projectIds: string[]): Promise<Map<string, ProductRow>> {
  const db = createServerClient().schema("v2");
  let query = db.from("products").select("id, project_id, config").eq("product_type", "report");
  if (projectIds.length) query = query.in("project_id", projectIds);

  const { data, error } = await query;
  if (error) throw new Error(`products-oppslag feilet: ${error.message}`);
  return new Map((data ?? []).map((p) => [(p as ProductRow).project_id, p as ProductRow]));
}

function existingModes(config: unknown): TravelMode[] {
  const parsed =
    typeof config === "string"
      ? (JSON.parse(config) as Record<string, unknown>)
      : ((config ?? {}) as Record<string, unknown>);
  const rc = (parsed.reportConfig ?? {}) as Record<string, unknown>;
  const result = IsochroneSetSchema.safeParse(rc.isochrones);
  return result.success ? contourTravelModes(result.data) : [];
}

function printReport(
  label: string,
  projects: ProjectRow[],
  products: Map<string, ProductRow>,
) {
  console.log(`\n${label}`);
  console.log("  " + "board".padEnd(44) + "konturer");
  for (const project of projects) {
    const product = products.get(project.id);
    if (!product) {
      console.log("  " + project.id.padEnd(44) + "(ingen rapport-produkt)");
      continue;
    }
    const modes = existingModes(product.config);
    console.log(
      "  " + project.id.padEnd(44) + (modes.length ? modes.join(", ") : "ingen ⚠️"),
    );
  }
}

async function revalidateBoard(projectId: string) {
  if (!REVALIDATE_SECRET) {
    console.warn("  REVALIDATE_SECRET ikke satt — cachen er IKKE bustet.");
    return;
  }
  const tag = `product:${projectId}`;
  const url = `${SITE_URL}/api/revalidate?tag=${encodeURIComponent(tag)}&secret=${encodeURIComponent(REVALIDATE_SECRET)}`;
  try {
    const res = await fetch(url);
    console.log(res.ok ? `  cache bustet: ${tag}` : `  cache-bust feilet: ${res.status}`);
  } catch (err) {
    console.warn(`  cache-bust kastet: ${(err as Error).message}`);
  }
}

async function main() {
  const { apply, projectIds } = parseArgs();

  const projects = await fetchProjects(projectIds);
  if (projects.length === 0) {
    console.error(
      projectIds.length
        ? `Ingen prosjekt matchet: ${projectIds.join(", ")}`
        : "Ingen prosjekter funnet.",
    );
    process.exit(1);
  }

  const products = await fetchProducts(projectIds);
  printReport("FØR", projects, products);

  if (!apply) {
    console.log(
      `\nTørrkjøring — ingenting skrevet. ${projects.length} board(s) ville fått tre Isochrone-kall hver.`,
    );
    console.log("Kjør med --apply for å skrive.");
    return;
  }

  console.log(`\nSKRIVER konturer for ${projects.length} board(s)…\n`);
  let written = 0;
  let skipped = 0;

  for (const project of projects) {
    const product = products.get(project.id);
    if (!product) {
      console.log(`${project.id}: ingen rapport-produkt — hoppet over`);
      skipped++;
      continue;
    }
    if (project.center_lat == null || project.center_lng == null) {
      console.log(`${project.id}: mangler origo-koordinat — hoppet over`);
      skipped++;
      continue;
    }

    const result = await computeProjectIsochrones({
      productId: product.id,
      centerLat: project.center_lat,
      centerLng: project.center_lng,
      revalidate: () => revalidateBoard(project.id),
    });

    for (const w of result.warnings) console.log(`  ${w}`);
    if (result.skipped) {
      console.log(`${project.id}: ingenting skrevet`);
      skipped++;
    } else {
      console.log(`${project.id}: ${result.fetched.join(", ")}`);
      written++;
    }
  }

  const after = await fetchProducts(projectIds);
  printReport("ETTER", projects, after);
  console.log(`\n${written} board(s) skrevet, ${skipped} hoppet over.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
