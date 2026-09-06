// Lese-laget for innsiktsrapporten. Erstatter `engagement-stats.ts`
// (PRD 13 Unit 6), som telte uten kontekst og aldri fikk en leser.
//
// PERSONVERN-KONTRAKT: velger ALDRI session_id. Se types.ts.
//
// PAGINERT (2026-09-06): `.limit(50_000)` så ut som en sikring og var det
// motsatte. PostgREST' `db-max-rows` er et SERVERSIDIG tak på 1 000 rader, og
// klientens limit kan bare senke det, aldri heve det — så spørringen leverte
// 1 000 hendelser og rapporten regnet andeler av dem som om det var alt.
// Feilen viser seg først når et board blir populært, altså nøyaktig når tallene
// begynner å bety noe for kunden. Se `fetch-all-rows.ts`.
//
// SORTERINGEN er en forutsetning for sidingen, ikke pynt: `created_at` alene er
// ikke unik (flere hendelser deler millisekund), og uten en total orden kan en
// rad dukke opp på to sider mens en annen faller mellom dem. `id` sorteres på
// uten å velges — personvern-kontrakten gjelder hva vi LESER, ikke hva vi
// sorterer på.

import { createServerClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
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
  const { rows, error } = await fetchAllRows(
    (from, to) =>
      client
        .schema("v2")
        .from("events")
        .select(SELECT)
        .eq("project_id", projectId)
        .gte("created_at", since.toISOString())
        .lte("created_at", until.toISOString())
        .order("created_at")
        .order("id")
        .range(from, to),
    { maxTotalRows: MAX_ROWS },
  );
  if (error) {
    console.error("[insight] spørring mot v2.events feilet:", error);
    return [];
  }
  return rows as InsightEventRow[];
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
  const { rows, error } = await fetchAllRows(
    (from, to) =>
      client
        .schema("v2")
        .from("events")
        .select(SELECT)
        .eq("event_type", "category_opened")
        .neq("project_id", excludeProjectId)
        .gte("created_at", since.toISOString())
        .lte("created_at", until.toISOString())
        .order("created_at")
        .order("id")
        .range(from, to),
    { maxTotalRows: MAX_ROWS },
  );
  if (error) {
    console.error("[insight] baseline-spørring mot v2.events feilet:", error);
    return [];
  }
  return rows as InsightEventRow[];
}
