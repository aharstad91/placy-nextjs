// Lese-laget for innsiktsrapporten. Erstatter `engagement-stats.ts`
// (PRD 13 Unit 6), som telte uten kontekst og aldri fikk en leser.
//
// PERSONVERN-KONTRAKT: velger ALDRI session_id. Se types.ts.

import { createServerClient } from "@/lib/supabase/client";
import type { InsightEventRow } from "./types";

const SELECT = "event_type, poi_id, payload, created_at"; // IKKE session_id
/** Tak per spørring. Prototype-volum er ~2k rader/uke totalt; taket er en sikring. */
const MAX_ROWS = 50_000;

export async function fetchProjectEvents(
  projectId: string,
  since: Date,
  until: Date,
): Promise<InsightEventRow[]> {
  const client = createServerClient();
  const { data, error } = await client
    .schema("v2")
    .from("events")
    .select(SELECT)
    .eq("project_id", projectId)
    .gte("created_at", since.toISOString())
    .lte("created_at", until.toISOString())
    .limit(MAX_ROWS);
  if (error) {
    console.error("[insight] spørring mot v2.events feilet:", error.message);
    return [];
  }
  return (data ?? []) as InsightEventRow[];
}

/**
 * Grunnlaget kategori-andelene måles mot: alle ANDRE boards i samme vindu.
 * Bare category_opened trengs. «Placy-snittet» er i dag få boards og skal
 * leses som det — rapporten sier «andre boards», ikke «markedet».
 */
export async function fetchBaselineCategoryEvents(
  excludeProjectId: string,
  since: Date,
  until: Date,
): Promise<InsightEventRow[]> {
  const client = createServerClient();
  const { data, error } = await client
    .schema("v2")
    .from("events")
    .select(SELECT)
    .eq("event_type", "category_opened")
    .neq("project_id", excludeProjectId)
    .gte("created_at", since.toISOString())
    .lte("created_at", until.toISOString())
    .limit(MAX_ROWS);
  if (error) {
    console.error("[insight] baseline-spørring mot v2.events feilet:", error.message);
    return [];
  }
  return (data ?? []) as InsightEventRow[];
}
