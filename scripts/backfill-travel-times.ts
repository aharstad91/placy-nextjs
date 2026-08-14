#!/usr/bin/env npx tsx
/**
 * Backfill av reisetider — gir eksisterende boards gang-, sykkel- og biltid.
 *
 * Provisjonering beregnet bare gangtid fram til 2026-08-14, så ingen board har
 * sykkel eller bil. I tillegg har noen boards hull i gangtiden, med to kjente
 * årsaker (diagnostisert 2026-08-14):
 *
 *   1. POI-er lagt til utenfor provisjonerings-løpet. Reisetid-steget kjørte
 *      aldri for dem. Sundsøya (37 av 78) og Oppdal sentrum (30 av 128).
 *   2. Bolke-bugen: Mapbox Matrix avviste en siste bolk med én destinasjon, så
 *      hvert board med POI-antall ≡ 1 (mod 24) mistet sitt siste punkt. Martin
 *      Barstads veg 23C (1 av 97). Fikset i batchDestinations samme dag.
 *
 * Reisetid er BEREGNET data, ikke kuratert innhold — overskriving er trygg, og
 * kjøringen er idempotent (samme input gir samme tall).
 *
 * Usage:
 *   npx tsx scripts/backfill-travel-times.ts                       # dekningsrapport (leser bare)
 *   npx tsx scripts/backfill-travel-times.ts placy-demo_sundsoya   # rapport for ett board
 *   npx tsx scripts/backfill-travel-times.ts --apply               # SKRIVER til alle boards
 *   npx tsx scripts/backfill-travel-times.ts --apply placy-demo_sundsoya
 *
 * Flags:
 *   --apply      Skriv til databasen. Uten flagget er kjøringen ren lesing.
 *   --dry-run    Eksplisitt no-op (default oppførsel; finnes for lesbarhet i logger).
 *
 * Kostnad: ~4 600 Matrix-elementer for hele porteføljen (1 518 POI-er × 3
 * profiler), altså under 5 % av månedskvoten på 100 000. Ingen batching over
 * døgn nødvendig.
 */

import "./load-env";

import { createServerClient } from "@/lib/supabase/client";
import { computeProjectTravelTimes } from "@/lib/pipeline/travel-times";
import {
  fetchTravelTimeRows,
  summariseCoverage,
  TRAVEL_PROFILES,
  type ProjectCoverage,
} from "@/lib/pipeline/travel-coverage";

interface ProjectRow {
  id: string;
  center_lat: number | null;
  center_lng: number | null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const projectIds = args.filter((a) => !a.startsWith("--"));
  return { apply, projectIds };
}

async function fetchProjects(projectIds: string[]): Promise<ProjectRow[]> {
  const db = createServerClient().schema("v2");
  let query = db.from("projects").select("id, center_lat, center_lng").order("id");
  if (projectIds.length) query = query.in("id", projectIds);

  const { data, error } = await query;
  if (error) throw new Error(`projects-oppslag feilet: ${error.message}`);
  return (data ?? []) as ProjectRow[];
}

async function coverageByProject(projectIds: string[]): Promise<Map<string, ProjectCoverage>> {
  const rows = await fetchTravelTimeRows(projectIds.length ? projectIds : undefined);
  return new Map(summariseCoverage(rows).map((c) => [c.projectId, c]));
}

/** «41/78» med et merke når dekningen ikke er full — hullene skal være lette å se. */
function fraction(covered: number, total: number): string {
  const text = `${covered}/${total}`;
  return covered === total ? text : `${text} ⚠️`;
}

function printCoverage(label: string, projects: ProjectRow[], coverage: Map<string, ProjectCoverage>) {
  console.log(`\n${label}`);
  console.log("  " + "board".padEnd(38) + "gå".padEnd(14) + "sykkel".padEnd(14) + "bil");
  for (const project of projects) {
    const c = coverage.get(project.id);
    if (!c) {
      console.log("  " + project.id.padEnd(38) + "(ingen POI-er)");
      continue;
    }
    console.log(
      "  " +
        project.id.padEnd(38) +
        fraction(c.covered.walk, c.total).padEnd(14) +
        fraction(c.covered.bike, c.total).padEnd(14) +
        fraction(c.covered.car, c.total)
    );
  }
}

async function namesOf(poiIds: string[]): Promise<Map<string, string>> {
  if (poiIds.length === 0) return new Map();
  const db = createServerClient().schema("v2");
  const { data } = await db.from("pois").select("id, name").in("id", poiIds);
  return new Map((data ?? []).map((p) => [p.id as string, p.name as string]));
}

async function main() {
  const { apply, projectIds } = parseArgs();

  const projects = await fetchProjects(projectIds);
  if (projects.length === 0) {
    console.error(
      projectIds.length
        ? `Ingen prosjekt matchet: ${projectIds.join(", ")}`
        : "Ingen prosjekter funnet."
    );
    process.exit(1);
  }

  const before = await coverageByProject(projectIds);
  printCoverage("FØR", projects, before);

  const poiTotal = [...before.values()].reduce((sum, c) => sum + c.total, 0);
  const elements = poiTotal * TRAVEL_PROFILES.length;
  console.log(
    `\n  ${poiTotal} POI-er × ${TRAVEL_PROFILES.length} profiler = ~${elements} Matrix-elementer`
  );

  if (!apply) {
    console.log("\nRen lesing (ingen skriving). Kjør med --apply for å backfille.\n");
    return;
  }

  console.log("\nAPPLY — beregner og skriver reisetider…");
  const failedProjects: string[] = [];

  for (const [index, project] of projects.entries()) {
    if (project.center_lat == null || project.center_lng == null) {
      console.log(`  ${project.id}: mangler senter-koordinat — hoppet over`);
      failedProjects.push(project.id);
      continue;
    }

    // Pause mellom boards: Matrix' grense er 60 requests/minutt, og et board
    // fyrer 3 × ceil(n/24). Retry-logikken i travel-times tar toppene, men en
    // pause her holder oss under grensen i stedet for å bli kastet ut av den.
    if (index > 0) await new Promise((r) => setTimeout(r, 5_000));

    const result = await computeProjectTravelTimes({
      projectId: project.id,
      centerLat: project.center_lat,
      centerLng: project.center_lng,
    });
    console.log(
      `  ${project.id}: ${result.computed} skrevet, ${result.unchanged} uendret av ${result.total} — gå ${result.coverage.walk} · sykkel ${result.coverage.bike} · bil ${result.coverage.car}`
    );
    for (const w of result.warnings) console.log(`    ${w}`);
  }

  const after = await coverageByProject(projectIds);
  printCoverage("ETTER", projects, after);

  // Punkter Matrix beviselig ikke kan rute til skal LISTES, ikke stille mangle.
  const stillMissing = [...after.values()].flatMap((c) =>
    c.missingAll.map((poiId) => ({ projectId: c.projectId, poiId }))
  );
  if (stillMissing.length > 0) {
    const names = await namesOf(stillMissing.map((m) => m.poiId));
    console.log(`\n${stillMissing.length} POI-er har fortsatt ingen reisetid:`);
    for (const m of stillMissing) {
      console.log(`  ${m.projectId}  ${names.get(m.poiId) ?? "(navn ukjent)"}  (${m.poiId})`);
    }
  } else {
    console.log("\nAlle POI-er har reisetid for minst én profil.");
  }

  if (failedProjects.length > 0) {
    console.error(`\nHoppet over: ${failedProjects.join(", ")}`);
    process.exit(1);
  }
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
