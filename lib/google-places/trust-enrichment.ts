/**
 * Delt trust-enrichment for Google-POIer.
 *
 * Brukes av både admin-routen (`app/api/admin/trust-validate/route.ts`) og
 * pipeline-steget (`lib/pipeline/validate-report-trust.ts`) slik at
 * enrichment-semantikken (kandidat = har `google_place_id`, mangler
 * `google_website`) og rad→POI-mappingen for scoring ikke dupliseres.
 *
 * Bakgrunn: POI-importen (`lib/pipeline/import-pois.ts`) nuller
 * `google_website`/`google_business_status` eksplisitt — uten denne fasen
 * scorer alle legitime Google-POIer `no_website` (0.45 < MIN_TRUST_SCORE)
 * og filtreres feilaktig bort.
 *
 * `facebook_url` POPULERES IKKE her: det er et manuelt/seed-felt (migration 033)
 * + passthrough-mappinger som kun videresender eksisterende verdi. Enrichment
 * skal ALDRI forsøke å fylle det (PRD 4 Unit 2 AC5).
 *
 * `google_rating`/`google_review_count` er REFRESH-felt med bevart import-verdi
 * (`import-pois.ts`). De overskrives KUN når Place Details faktisk returnerer en
 * verdi — manglende felt nulles IKKE (AC6: unngå stille data-tap; samme vern som
 * foto-pathen i photo-api.ts).
 */

import {
  fetchPlaceDetails,
  TRUST_ENRICHMENT_FIELDS,
} from "@/lib/google-places/fetch-place-details";
import type { createServerClient } from "@/lib/supabase/client";
import type { POI } from "@/lib/types";

type SupabaseServerClient = NonNullable<ReturnType<typeof createServerClient>>;

/** Minste rad-form enrichment trenger. */
export interface TrustEnrichmentRow {
  id: string;
  google_place_id: string | null;
  google_website: string | null;
}

/** Rad-form for trust-scoring (rad → POI-mapping). */
export interface TrustScoringRow extends TrustEnrichmentRow {
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  category_id: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  google_business_status: string | null;
  google_price_level: number | null;
  trust_score: number | null;
  trust_flags: string[] | null;
}

export interface EnrichTrustSignalsResult {
  enriched: number;
  /** POI-IDer der enrichment feilet (fetch eller DB-skriving). */
  failedPoiIds: string[];
  errors: string[];
}

/**
 * Hent Place Details (`TRUST_ENRICHMENT_FIELDS`) for POIer som mangler
 * trust-signaler og persistér dem på pois-raden. Concurrency-pool,
 * fail-soft per POI — feil rapporteres i `errors` + `failedPoiIds`.
 */
export async function enrichTrustSignals(options: {
  supabase: SupabaseServerClient;
  pois: TrustEnrichmentRow[];
  googleApiKey: string;
  concurrency: number;
}): Promise<EnrichTrustSignalsResult> {
  const { supabase, pois, googleApiKey, concurrency } = options;

  const result: EnrichTrustSignalsResult = {
    enriched: 0,
    failedPoiIds: [],
    errors: [],
  };

  const enrichEntries = pois
    .filter((poi) => poi.google_place_id && !poi.google_website)
    .map((poi) => ({
      poiId: poi.id,
      placeId: poi.google_place_id as string,
    }));

  if (enrichEntries.length === 0) return result;

  let running = 0;
  let idx = 0;

  await new Promise<void>((resolve) => {
    const next = () => {
      while (running < concurrency && idx < enrichEntries.length) {
        const entry = enrichEntries[idx++];
        running++;

        try {
          fetchPlaceDetails(entry.placeId, googleApiKey, TRUST_ENRICHMENT_FIELDS)
            .then(async (details) => {
              if (!details) {
                // Place not found: importen nuller signalene, så POI-en ville
                // scoret 0.45 (no_website) og forsvunnet stille fra boardet.
                // Behandles som feil → havner i stillNull og QA-gates (Unit 7).
                result.errors.push(
                  `Place not found in Google API for ${entry.poiId} (place_id: ${entry.placeId})`
                );
                result.failedPoiIds.push(entry.poiId);
                return;
              }
              // AC6: rating/review_count er refresh-felt med bevart import-verdi
              // — overskriv KUN når Place Details returnerer en verdi, ellers
              // ville `?? null` stille nulle ut eksisterende import-data.
              const update: {
                google_website: string | null;
                google_business_status: string | null;
                google_price_level: number | null;
                google_rating?: number;
                google_review_count?: number;
              } = {
                google_website: details.website || null,
                google_business_status: details.businessStatus || null,
                google_price_level: details.priceLevel ?? null,
              };
              if (details.rating !== undefined) update.google_rating = details.rating;
              if (details.reviewCount !== undefined) {
                update.google_review_count = details.reviewCount;
              }
              const { error } = await supabase
                .from("pois")
                .update(update)
                .eq("id", entry.poiId);
              if (error) {
                result.errors.push(
                  `Enrichment DB update failed for ${entry.poiId}: ${error.message}`
                );
                result.failedPoiIds.push(entry.poiId);
              } else {
                result.enriched++;
              }
            })
            .catch((e) => {
              result.errors.push(
                `Enrichment failed for ${entry.poiId}: ${e instanceof Error ? e.message : "unknown"}`
              );
              result.failedPoiIds.push(entry.poiId);
            })
            .finally(() => {
              running--;
              if (idx >= enrichEntries.length && running === 0) {
                resolve();
              } else {
                next();
              }
            });
        } catch (e) {
          // Synkron throw (f.eks. mock/feilkonfigurasjon) skal aldri etterlate
          // Promise-en uresolved — poolen må alltid telles ned (deadlock-vern).
          result.errors.push(
            `Enrichment failed for ${entry.poiId}: ${e instanceof Error ? e.message : "unknown"}`
          );
          result.failedPoiIds.push(entry.poiId);
          running--;
          if (idx >= enrichEntries.length && running === 0) {
            resolve();
          }
          // ellers: while-løkka fortsetter og plukker neste entry
        }
      }
    };
    next();
  });

  return result;
}

/** Map en pois-rad til POI-typen som `batchValidateTrust` scorer. */
export function mapPoiRowToPOIForTrust(row: TrustScoringRow): POI {
  return {
    id: row.id,
    name: row.name,
    coordinates: { lat: row.lat, lng: row.lng },
    address: row.address ?? undefined,
    category: { id: row.category_id ?? "", name: "", icon: "", color: "" },
    googlePlaceId: row.google_place_id ?? undefined,
    googleRating: row.google_rating ?? undefined,
    googleReviewCount: row.google_review_count ?? undefined,
    googleWebsite: row.google_website ?? undefined,
    googleBusinessStatus: row.google_business_status ?? undefined,
    googlePriceLevel: row.google_price_level ?? undefined,
    trustScore: row.trust_score ?? undefined,
    trustFlags: row.trust_flags ?? [],
  };
}
