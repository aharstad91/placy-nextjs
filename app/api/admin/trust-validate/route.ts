/**
 * Admin API: Batch Trust Validation
 *
 * Enriches POIs with Google Places data, then runs Layer 1+2 trust scoring.
 * Pipeline: enrich → score → batch DB update → revalidate cache.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/client";
import {
  fetchPlaceDetails,
  TRUST_ENRICHMENT_FIELDS,
} from "@/lib/google-places/fetch-place-details";
import {
  batchValidateTrust,
  type TrustFlag,
} from "@/lib/utils/poi-trust";
import { updatePOITrustScore } from "@/lib/supabase/mutations";
import type { POI } from "@/lib/types";

const MAX_POIS_PER_REQUEST = 100;

const TrustValidateSchema = z.object({
  projectId: z.string().min(1),
  force: z.boolean().default(false),
  concurrency: z.number().min(1).max(20).default(10),
  skipEnrichment: z.boolean().default(false),
});

interface TrustValidateResponse {
  success: boolean;
  stats: {
    total: number;
    enriched: number;
    validated: number;
    trusted: number;
    flagged: number;
    needsClaudeReview: number;
    skipped: number;
  };
  hasMore: boolean;
  errors: string[];
}

function checkBearerAuth(request: NextRequest): boolean {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return true; // No token configured = no auth required

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${token}`;
}

export async function POST(request: NextRequest) {
  // 1. Admin + bearer token check
  if (process.env.ADMIN_ENABLED !== "true") {
    return NextResponse.json({ error: "Admin ikke aktivert" }, { status: 403 });
  }
  if (!checkBearerAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Zod validation
  let body: z.infer<typeof TrustValidateSchema>;
  try {
    const json = await request.json();
    body = TrustValidateSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ugyldig request", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert" }, { status: 500 });
  }

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleApiKey && !body.skipEnrichment) {
    return NextResponse.json(
      { error: "Google Places API key not configured" },
      { status: 500 }
    );
  }

  const errors: string[] = [];
  const stats = {
    total: 0,
    enriched: 0,
    validated: 0,
    trusted: 0,
    flagged: 0,
    needsClaudeReview: 0,
    skipped: 0,
  };

  try {
    // 3. Fetch POIs for this project
    const { data: projectPois, error: fetchError } = await supabase
      .from("project_pois")
      .select("poi_id")
      .eq("project_id", body.projectId);

    if (fetchError) {
      return NextResponse.json(
        { error: `Kunne ikke hente POIs: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!projectPois || projectPois.length === 0) {
      return NextResponse.json({
        success: true,
        stats,
        hasMore: false,
        errors: [],
      } satisfies TrustValidateResponse);
    }

    const poiIds = projectPois.map((pp) => pp.poi_id);

    const { data: rawPois, error: poisError } = await supabase
      .from("pois")
      .select("*")
      .in("id", poiIds);

    if (poisError || !rawPois) {
      return NextResponse.json(
        { error: `Kunne ikke hente POI-data: ${poisError?.message}` },
        { status: 500 }
      );
    }

    stats.total = rawPois.length;

    // 4. Filter: skip manual_override ALWAYS, skip already validated unless force=true
    const toProcess = rawPois.filter((poi) => {
      const flags = (poi.trust_flags as string[]) || [];
      if (flags.includes("manual_override")) {
        stats.skipped++;
        return false;
      }
      if (!body.force && poi.trust_score != null) {
        stats.skipped++;
        return false;
      }
      return true;
    });

    // Limit to MAX_POIS_PER_REQUEST
    const batch = toProcess.slice(0, MAX_POIS_PER_REQUEST);
    const hasMore = toProcess.length > MAX_POIS_PER_REQUEST;

    // 5. Enrich POIs missing Google data
    if (!body.skipEnrichment && googleApiKey) {
      const toEnrich = batch.filter(
        (poi) => poi.google_place_id && !poi.google_website
      );

      if (toEnrich.length > 0) {
        // Concurrency pool for enrichment
        let running = 0;
        let idx = 0;
        const enrichEntries = toEnrich.map((poi) => ({
          poiId: poi.id,
          placeId: poi.google_place_id as string,
        }));

        await new Promise<void>((resolve) => {
          if (enrichEntries.length === 0) { resolve(); return; }

          const next = () => {
            while (running < body.concurrency && idx < enrichEntries.length) {
              const entry = enrichEntries[idx++];
              running++;

              fetchPlaceDetails(entry.placeId, googleApiKey, TRUST_ENRICHMENT_FIELDS)
                .then(async (details) => {
                  if (details) {
                    try {
                      await supabase
                        .from("pois")
                        .update({
                          google_website: details.website || null,
                          google_business_status: details.businessStatus || null,
                          google_price_level: details.priceLevel ?? null,
                          google_rating: details.rating ?? null,
                          google_review_count: details.reviewCount ?? null,
                        })
                        .eq("id", entry.poiId);
                      stats.enriched++;
                    } catch (e) {
                      errors.push(`Enrichment DB update failed for ${entry.poiId}: ${e instanceof Error ? e.message : "unknown"}`);
                    }
                  }
                })
                .catch((e) => {
                  errors.push(`Enrichment failed for ${entry.poiId}: ${e instanceof Error ? e.message : "unknown"}`);
                })
                .finally(() => {
                  running--;
                  if (idx >= enrichEntries.length && running === 0) {
                    resolve();
                  } else {
                    next();
                  }
                });
            }
          };
          next();
        });
      }
    }

    // 6. Re-read enriched POIs for scoring
    const batchIds = batch.map((p) => p.id);
    const { data: enrichedPois } = await supabase
      .from("pois")
      .select("*")
      .in("id", batchIds);

    if (!enrichedPois || enrichedPois.length === 0) {
      return NextResponse.json({
        success: true,
        stats,
        hasMore,
        errors,
      } satisfies TrustValidateResponse);
    }

    // 7. Map DB rows to POI type for batchValidateTrust
    const poisForScoring: POI[] = enrichedPois.map((row) => ({
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
      trustFlags: (row.trust_flags as string[]) ?? [],
    }));

    // 8. Run Layer 1+2 batch validation
    const results = await batchValidateTrust(poisForScoring, body.concurrency);

    // 9. Batch update trust scores in DB
    for (const [poiId, result] of Array.from(results.entries())) {
      try {
        await updatePOITrustScore(
          poiId,
          result.score,
          result.flags as TrustFlag[]
        );
        stats.validated++;
        if (result.score >= 0.5) {
          stats.trusted++;
        } else {
          stats.flagged++;
        }
        if (result.needsClaudeReview) {
          stats.needsClaudeReview++;
        }
      } catch (e) {
        errors.push(`Trust update failed for ${poiId}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }

    // 10. Revalidate cached Explorer pages
    const { data: project } = await supabase
      .from("projects")
      .select("customer_id, url_slug")
      .eq("id", body.projectId)
      .single();

    if (project) {
      revalidatePath(`/${project.customer_id}/${project.url_slug}`, "layout");
    }

    return NextResponse.json({
      success: true,
      stats,
      hasMore,
      errors,
    } satisfies TrustValidateResponse);
  } catch (error) {
    console.error("[trust-validate] Error:", error);
    return NextResponse.json(
      {
        error: "Trust validation feilet",
        details: error instanceof Error ? error.message : "Ukjent feil",
      },
      { status: 500 }
    );
  }
}
