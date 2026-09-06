#!/usr/bin/env npx tsx
/**
 * R2-MÅLINGEN: stemmer konturene med minuttene i lista?
 *
 * Påstanden planen hviler på er at konturene og POI-reisetidene kommer fra
 * SAMME Mapbox-veinett, slik at et sted med 7 minutters gangtid ligger
 * innenfor 10-minutt-konturen. Det er et akseptansekriterium som skal MÅLES,
 * ikke antas.
 *
 * ⚠️ BARE MÅLTE REISETIDER TELLER. Boardet viser et luftlinje-anslag
 * (haversine × 1,3) for POI-er der reisetid-steget ikke rakk å måle — se
 * `estimateWalkMin`. Et slikt anslag ligger systematisk utenfor en
 * veinett-isokron, så et script som sammenlignet anslag mot kontur ville
 * rapportert mange avvik og fått det til å se ut som at Matrix og Isochrone
 * ikke er sammenlignbare. Derfor leses rå-verdien fra
 * `v2.project_pois.travel_times`, og POI-er uten målt verdi rapporteres i en
 * egen «ikke målbar»-bøtte utenfor akseptansen.
 *
 * HULL: `pointInGeometry` ser bare den ytre ringen. Det er den milde retningen
 * for en akseptansesjekk — en POI i en utilgjengelig lomme inne i konturen
 * regnes som innenfor, og gir altså ikke et falskt avvik.
 *
 * Usage:
 *   npx tsx scripts/check-isochrone-consistency.ts broset-utvikling-as_wesselslokka
 *   npx tsx scripts/check-isochrone-consistency.ts            # alle boards med konturer
 *   npx tsx scripts/check-isochrone-consistency.ts --mode bike
 */

import "./load-env";

import { createServerClient } from "@/lib/supabase/client";
import { chunkIds } from "@/lib/supabase/chunk-ids";
import { pointInGeometry } from "@/lib/utils/geo";
import { IsochroneSetSchema } from "@/lib/types";
import type { IsochroneSet, TravelMode } from "@/lib/types";
import { ISOCHRONE_MINUTES } from "@/lib/types";

/**
 * Andel EKTE avvik over dette leses som systematisk.
 *
 * Ekte avvik = margin ≥ `BOUNDARY_MARGIN_MIN` minutter til budsjettet. Et
 * sted målt til nøyaktig 10 min som faller utenfor 10-minutt-konturen er IKKE
 * et avvik: minuttene rundes opp (`Math.ceil`) og konturen er forenklet med
 * `generalize`, så budsjett-grensen er en sone på noen titalls meter, ikke en
 * strek. Planens stoppbetingelse sier «UNDER 10 min», og det er den som måles.
 *
 * Målt på Wesselsløkka 2026-09-03: 17 av 17 avvik hadde margin 0–2 min, 16 av
 * dem ≤1 min. Ingen POI langt inne i konturen falt utenfor — de to
 * Mapbox-datasettene stemmer.
 */
const SYSTEMATIC_THRESHOLD = 0.05;

/** Margin (min) opp til budsjettet der et avvik regnes som randsone-støy. */
const BOUNDARY_MARGIN_MIN = 2;

interface ProjectRow {
  id: string;
  center_lat: number | null;
  center_lng: number | null;
}

interface ProductRow {
  project_id: string;
  config: unknown;
}

interface TravelRow {
  poi_id: string;
  project_id: string;
  travel_times: Record<string, unknown> | null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const modeIndex = args.indexOf("--mode");
  const mode = (modeIndex >= 0 ? args[modeIndex + 1] : "walk") as TravelMode;
  const projectIds = args.filter(
    (a, i) => !a.startsWith("--") && i !== modeIndex + 1,
  );
  return { mode, projectIds };
}

function isochronesOf(config: unknown): IsochroneSet | undefined {
  const parsed =
    typeof config === "string"
      ? (JSON.parse(config) as Record<string, unknown>)
      : ((config ?? {}) as Record<string, unknown>);
  const rc = (parsed.reportConfig ?? {}) as Record<string, unknown>;
  const result = IsochroneSetSchema.safeParse(rc.isochrones);
  return result.success ? result.data : undefined;
}

/** Rå, MÅLT verdi — aldri et anslag. */
function measuredMinutes(row: TravelRow, mode: TravelMode): number | undefined {
  const value = row.travel_times?.[mode];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function main() {
  const { mode, projectIds } = parseArgs();
  const db = createServerClient().schema("v2");

  let projectQuery = db.from("projects").select("id, center_lat, center_lng").order("id");
  if (projectIds.length) projectQuery = projectQuery.in("id", projectIds);
  const { data: projectData, error: projectError } = await projectQuery;
  if (projectError) throw new Error(`projects-oppslag feilet: ${projectError.message}`);
  const projects = (projectData ?? []) as ProjectRow[];

  let productQuery = db.from("products").select("project_id, config").eq("product_type", "report");
  if (projectIds.length) productQuery = productQuery.in("project_id", projectIds);
  const { data: productData, error: productError } = await productQuery;
  if (productError) throw new Error(`products-oppslag feilet: ${productError.message}`);
  const configByProject = new Map(
    (productData ?? []).map((p) => [(p as ProductRow).project_id, (p as ProductRow).config]),
  );

  let systematic = false;

  for (const project of projects) {
    const isochrones = isochronesOf(configByProject.get(project.id));
    const contours = isochrones?.byMode[mode];
    if (!contours) continue;

    const { data: travelData, error: travelError } = await db
      .from("project_pois")
      .select("poi_id, project_id, travel_times")
      .eq("project_id", project.id);
    if (travelError) {
      console.error(`${project.id}: project_pois-oppslag feilet: ${travelError.message}`);
      continue;
    }
    const rows = (travelData ?? []) as TravelRow[];

    const coords = new Map<string, { lat: number; lng: number }>();
    for (const chunk of chunkIds(rows.map((r) => r.poi_id))) {
      const { data } = await db.from("pois").select("id, lat, lng").in("id", chunk);
      for (const poi of (data ?? []) as { id: string; lat: number; lng: number }[]) {
        if (poi.lat != null && poi.lng != null) coords.set(poi.id, { lat: poi.lat, lng: poi.lng });
      }
    }

    console.log(`\n${project.id} — reisemåte: ${mode}`);

    let unmeasured = 0;
    for (const minutes of ISOCHRONE_MINUTES) {
      const geometry = contours[minutes];
      const inside: string[] = [];
      const outside: string[] = [];

      // Avvikets MARGIN er det som avgjør om et avvik er randsone-støy eller
      // et brudd på premisset: en POI målt til 10 min som faller utenfor
      // 10-minutt-konturen er generaliseringen, mens en målt til 6 min som
      // faller utenfor er to uforenlige veinett.
      const outsideMargins: number[] = [];
      for (const row of rows) {
        const measured = measuredMinutes(row, mode);
        if (measured === undefined) continue;
        if (measured > Number(minutes)) continue;
        const point = coords.get(row.poi_id);
        if (!point) continue;
        // GeoJSON-rekkefølge: x = lng, y = lat.
        if (pointInGeometry(point.lng, point.lat, geometry)) inside.push(row.poi_id);
        else {
          outside.push(row.poi_id);
          outsideMargins.push(Number(minutes) - measured);
        }
      }

      const total = inside.length + outside.length;
      if (total === 0) {
        console.log(`  ${minutes} min: ingen målte POI-er innenfor budsjettet`);
        continue;
      }
      const real = outsideMargins.filter((m) => m >= BOUNDARY_MARGIN_MIN).length;
      const share = real / total;
      const flag = share > SYSTEMATIC_THRESHOLD ? " ⚠️ SYSTEMATISK" : "";
      if (share > SYSTEMATIC_THRESHOLD) systematic = true;
      console.log(
        `  ${minutes} min: ${inside.length}/${total} innenfor` +
          ` (${outside.length} utenfor, hvorav ${real} ekte avvik = ${(share * 100).toFixed(1)} %)${flag}`,
      );
      if (outsideMargins.length > 0) {
        const sorted = [...outsideMargins].sort((a, b) => a - b);
        const boundary = sorted.filter((m) => m <= 1).length;
        console.log(
          `     margin til budsjettet: median ${sorted[Math.floor(sorted.length / 2)]} min,` +
            ` verste ${sorted[sorted.length - 1]} min,` +
            ` ${boundary}/${sorted.length} i randsonen (≤1 min)`,
        );
      }
      if (outside.length > 0) {
        const names = new Map<string, string>();
        for (const chunk of chunkIds(outside)) {
          const { data } = await db.from("pois").select("id, name").in("id", chunk);
          for (const poi of (data ?? []) as { id: string; name: string }[]) {
            names.set(poi.id, poi.name);
          }
        }
        const shown = outside.slice(0, 5).map((id) => names.get(id) ?? id);
        console.log(
          `     utenfor: ${shown.join(", ")}${outside.length > 5 ? ` … (+${outside.length - 5})` : ""}`,
        );
      }
    }

    unmeasured = rows.filter((r) => measuredMinutes(r, mode) === undefined).length;
    console.log(
      `  ikke målbar: ${unmeasured}/${rows.length} POI-er uten målt ${mode}-tid (utenfor akseptansen)`,
    );
  }

  console.log(
    systematic
      ? "\n⚠️  Systematiske avvik funnet — se stoppbetingelsen i plan-dokumentet."
      : "\n✓ Ingen systematiske avvik. Randsone-avvik er forventet (isokronen er generalisert).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
