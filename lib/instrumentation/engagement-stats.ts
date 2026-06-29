// Engasjements-aggregering (lese-laget). Eid av PRD 13 (§5.5 / Unit 6).
//
// PERSONVERN-KONTRAKT (G5 + PRD 1 «NY tabell — events»): returnerer KUN aggregater
// (tellinger per kategori/poi/type), ALDRI rå session_id-sekvenser eller per-bruker-
// spor. session_id velges aldri ut av spørringen. Plassert i lib/instrumentation/
// (samlokalisert med PRD 13s øvrige moduler) framfor legacy public-queries.ts.

import { createServerClient } from "@/lib/supabase/client";

export interface EngagementStats {
  boardViews: number;
  categoryOpensByCategory: Record<string, number>;
  voiceoverPlays: number;
  poiClicksByPoi: Record<string, number>;
}

function emptyStats(): EngagementStats {
  return { boardViews: 0, categoryOpensByCategory: {}, voiceoverPlays: 0, poiClicksByPoi: {} };
}

/**
 * Aggregerte engasjements-tall for ett board/prosjekt, valgfritt avgrenset til et
 * tidsvindu. Leser v2.events via service-role-klienten. Velger BEVISST ikke
 * session_id (personvern). Aggregerer i minne over ikke-PII-kolonner; for
 * prototype-volum er dette tilstrekkelig (SQL-side GROUP BY kan innføres når
 * volumet tilsier det — PRD 13 Deferred: retensjon/partisjonering).
 */
export async function getEngagementStats(
  projectId: string,
  opts?: { since?: Date; until?: Date },
): Promise<EngagementStats> {
  const client = createServerClient();
  let query = client
    .schema("v2")
    .from("events")
    .select("event_type, payload, poi_id") // IKKE session_id
    .eq("project_id", projectId);
  if (opts?.since) query = query.gte("created_at", opts.since.toISOString());
  if (opts?.until) query = query.lte("created_at", opts.until.toISOString());

  const { data, error } = await query;
  if (error) {
    console.error("[getEngagementStats] spørring mot v2.events feilet:", error.message);
    return emptyStats(); // ingen stille swallow — logget; tomt aggregat ved feil
  }

  const stats = emptyStats();
  for (const row of data ?? []) {
    switch (row.event_type) {
      case "board_viewed":
        stats.boardViews++;
        break;
      case "voiceover_played":
        stats.voiceoverPlays++;
        break;
      case "category_opened": {
        const cat = (row.payload as { category_id?: string } | null)?.category_id;
        if (cat) stats.categoryOpensByCategory[cat] = (stats.categoryOpensByCategory[cat] ?? 0) + 1;
        break;
      }
      case "poi_clicked": {
        if (row.poi_id) stats.poiClicksByPoi[row.poi_id] = (stats.poiClicksByPoi[row.poi_id] ?? 0) + 1;
        break;
      }
    }
  }
  return stats;
}
