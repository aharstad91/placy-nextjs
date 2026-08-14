/**
 * Dekningsregnskap for reisetider — hvor mange POI-er per board som faktisk har
 * gang-, sykkel- og biltid i basen.
 *
 * PAGINERING ER LOAD-BEARING: v2.project_pois har over 1 500 rader, og PostgREST
 * avkorter et usidet select ved 1 000 uten å si noe. Et avkortet oppslag ser ut
 * som et fullstendig svar — bare med feil tall. Det er verre enn en feilmelding
 * når tallet er det backfillen styrer etter.
 *
 * Ren lesesti: dette modulet skriver aldri. Skrivingen ligger i
 * `computeProjectTravelTimes` (lib/pipeline/travel-times.ts).
 */

import { createServerClient } from "@/lib/supabase/client";
import type { TravelMode } from "@/lib/types";

const PAGE_SIZE = 1000;

export const TRAVEL_PROFILES: TravelMode[] = ["walk", "bike", "car"];

export interface TravelTimeRow {
  project_id: string;
  poi_id: string;
  travel_times: Record<string, unknown> | null;
}

export interface ProjectCoverage {
  projectId: string;
  total: number;
  /** Antall POI-er med en brukbar verdi, per profil. */
  covered: Record<TravelMode, number>;
  /** POI-er uten en eneste reisetid — kandidatene for «Matrix kan ikke rute hit». */
  missingAll: string[];
}

/**
 * En reisetid teller bare hvis den er et endelig tall. jsonb kan bære en streng,
 * `null` eller «NaN» fra en tidligere skriving; en slik verdi skal ikke telles som
 * dekning og skal ikke lekke inn i et tidsspenn på boardet.
 */
export function hasProfile(
  travelTimes: TravelTimeRow["travel_times"],
  profile: TravelMode
): boolean {
  const value = travelTimes?.[profile];
  return typeof value === "number" && Number.isFinite(value);
}

/** Regnskapet som ren funksjon — testbar uten database. */
export function summariseCoverage(rows: TravelTimeRow[]): ProjectCoverage[] {
  const byProject = new Map<string, ProjectCoverage>();

  for (const row of rows) {
    let entry = byProject.get(row.project_id);
    if (!entry) {
      entry = {
        projectId: row.project_id,
        total: 0,
        covered: { walk: 0, bike: 0, car: 0 },
        missingAll: [],
      };
      byProject.set(row.project_id, entry);
    }

    entry.total++;
    let any = false;
    for (const profile of TRAVEL_PROFILES) {
      if (hasProfile(row.travel_times, profile)) {
        entry.covered[profile]++;
        any = true;
      }
    }
    if (!any) entry.missingAll.push(row.poi_id);
  }

  return [...byProject.values()];
}

/**
 * Henter alle project_pois-rader, sidet. `projectIds` avgrenser til utvalgte
 * boards; utelatt betyr hele porteføljen.
 */
export async function fetchTravelTimeRows(
  projectIds?: string[]
): Promise<TravelTimeRow[]> {
  const db = createServerClient().schema("v2");
  const rows: TravelTimeRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    // Stabil sortering er en forutsetning for sidingen: uten den kan samme rad
    // dukke opp på to sider og en annen falle mellom dem.
    let query = db
      .from("project_pois")
      .select("project_id, poi_id, travel_times")
      .order("project_id")
      .order("poi_id");
    if (projectIds?.length) query = query.in("project_id", projectIds);

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`project_pois-oppslag feilet: ${error.message}`);
    if (!data?.length) break;

    rows.push(...(data as TravelTimeRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  return rows;
}
