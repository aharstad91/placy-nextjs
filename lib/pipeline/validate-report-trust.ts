/**
 * Trust-scoring som pipeline-steg (R8) — kjøres mellom enrich (Steg 4) og
 * hydrering, slik at read-time-filteret (`filterTrustedPOIs`, «null = vis»)
 * faktisk biter på nye rapport-boards.
 *
 * Avgrensning: KUN POIer med `google_place_id` scores. Offentlige kilde-POIer
 * (NSR, Barnehagefakta, Overpass, Entur, bysykkel) skippes BEVISST og beholder
 * `trust_score = null` — heuristikken er designet for kommersielle Google-POIer
 * og ville gitt skoler/barnehager 0.45 (< MIN_TRUST_SCORE) og masse-skjult dem.
 *
 * Fail-soft: enkelt-POI-feil stopper aldri steget. Google-POIer som forblir
 * uten score (enrichment-/persisteringsfeil, manglende API-nøkkel) listes i
 * `stillNull` og må QA-klareres før et board telles som evaluert (Unit 7).
 * INGEN unlinking fra project_pois/product_pois — filtrering, ikke sletting.
 */

import { createServerClient } from "@/lib/supabase/client";
import {
  enrichTrustSignals,
  mapPoiRowToPOIForTrust,
  type TrustScoringRow,
} from "@/lib/google-places/trust-enrichment";
import { batchValidateTrust } from "@/lib/utils/poi-trust";
import { updatePOITrustScore } from "@/lib/supabase/mutations";

const DEFAULT_CONCURRENCY = 10;

export interface ValidateReportTrustResult {
  /** Google-POIer scoret og persistert i denne kjøringen */
  scored: number;
  /** Skippet: manual_override eller allerede scoret */
  skipped: number;
  /** Skippet bevisst: offentlige kilde-POIer uten google_place_id (beholder null = vis) */
  skippedPublic: number;
  /** Navn på Google-POIer som forble uten score — må QA-klareres (Unit 7) */
  stillNull: string[];
  warnings: string[];
}

export async function validateReportTrust(options: {
  projectId: string;
  concurrency?: number;
}): Promise<ValidateReportTrustResult> {
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  const { projectId } = options;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  const result: ValidateReportTrustResult = {
    scored: 0,
    skipped: 0,
    skippedPublic: 0,
    stillNull: [],
    warnings: [],
  };

  // 1. Hent prosjektets POIer (project_pois → pois). Fail-soft: feil her gir
  //    dagens oppførsel (alle null = vis) + warning, ikke abort.
  const { data: projectPois, error: ppError } = await supabase
    .from("project_pois")
    .select("poi_id")
    .eq("project_id", projectId);

  if (ppError) {
    result.warnings.push(
      `⚠️  Henting av project_pois feilet: ${ppError.message} — trust-scoring hoppet over`
    );
    return result;
  }
  if (!projectPois || projectPois.length === 0) {
    result.warnings.push("⚠️  Ingen POI-er koblet til prosjektet — trust-scoring hoppet over");
    return result;
  }

  const poiIds = projectPois.map((p) => p.poi_id);

  const { data: rows, error: poisError } = await supabase
    .from("pois")
    .select("*")
    .in("id", poiIds);

  if (poisError || !rows) {
    result.warnings.push(
      `⚠️  Henting av POI-data feilet: ${poisError?.message ?? "ukjent"} — trust-scoring hoppet over`
    );
    return result;
  }

  // 2. Avgrens til Google-POIer; skip manual_override og allerede scorede
  //    (samme semantikk som app/api/admin/trust-validate — uten force).
  const candidates: TrustScoringRow[] = [];
  for (const row of rows) {
    if (!row.google_place_id) {
      result.skippedPublic++;
      continue;
    }
    const flags = (row.trust_flags as string[] | null) ?? [];
    if (flags.includes("manual_override")) {
      result.skipped++;
      continue;
    }
    if (row.trust_score != null) {
      result.skipped++;
      continue;
    }
    candidates.push(row);
  }

  if (candidates.length === 0) return result;

  // 3. Enrichment-fase (delt med routen): Steg 4-importen nuller
  //    google_website/google_business_status, så uten Place Details scorer
  //    alle legitime POIer `no_website` (0.45) og filtreres feilaktig.
  //    POIer der enrichment feiler scores IKKE med degraderte signaler —
  //    de forblir null (= vis) og QA-klareres via stillNull.
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  const needsEnrichment = candidates.filter((c) => !c.google_website);
  const excludedIds = new Set<string>();

  if (!googleApiKey && needsEnrichment.length > 0) {
    result.warnings.push(
      `⚠️  GOOGLE_PLACES_API_KEY mangler — ${needsEnrichment.length} POI-er kan ikke enriches og scores ikke (havner i stillNull)`
    );
    for (const poi of needsEnrichment) excludedIds.add(poi.id);
  } else if (googleApiKey) {
    const enrichResult = await enrichTrustSignals({
      supabase,
      pois: candidates,
      googleApiKey,
      concurrency,
    });
    for (const err of enrichResult.errors) result.warnings.push(`⚠️  ${err}`);
    for (const id of enrichResult.failedPoiIds) excludedIds.add(id);
  }

  const nameById = new Map(candidates.map((c) => [c.id, c.name]));
  for (const id of Array.from(excludedIds)) {
    result.stillNull.push(nameById.get(id) ?? id);
  }

  const toScore = candidates.filter((c) => !excludedIds.has(c.id));
  if (toScore.length === 0) return result;

  // 4. Re-les radene så scoringen ser de enrichede signalene
  const scoreIds = toScore.map((c) => c.id);
  const { data: enrichedRows, error: rereadError } = await supabase
    .from("pois")
    .select("*")
    .in("id", scoreIds);

  if (rereadError || !enrichedRows || enrichedRows.length === 0) {
    result.warnings.push(
      `⚠️  Re-lesing etter enrichment feilet: ${rereadError?.message ?? "ingen rader"} — ${toScore.length} POI-er ikke scoret`
    );
    for (const c of toScore) result.stillNull.push(c.name);
    return result;
  }

  // Defensivt: rader som forsvant mellom les og re-les
  const enrichedById = new Set(enrichedRows.map((r) => r.id));
  for (const c of toScore) {
    if (!enrichedById.has(c.id)) result.stillNull.push(c.name);
  }

  // 5. Scoring in-process + persistering. Fail-soft per POI.
  const poisForScoring = enrichedRows.map(mapPoiRowToPOIForTrust);
  const scores = await batchValidateTrust(poisForScoring, concurrency);

  for (const poi of poisForScoring) {
    const trust = scores.get(poi.id);
    if (!trust) {
      result.stillNull.push(poi.name);
      continue;
    }
    try {
      await updatePOITrustScore(poi.id, trust.score, trust.flags);
      result.scored++;
    } catch (e) {
      result.warnings.push(
        `⚠️  Trust-persistering feilet for ${poi.name} (${poi.id}): ${e instanceof Error ? e.message : "ukjent"}`
      );
      result.stillNull.push(poi.name);
    }
  }

  return result;
}
