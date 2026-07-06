import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { createRateLimiter, getClientIp } from "@/lib/utils/rate-limit";
import { createServerClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils/slugify";
import { runAfterResponse } from "@/lib/utils/run-after-response";
import { provisionReportBoard } from "@/lib/pipeline/provision";
import { OptionalReportTierSchema } from "@/lib/validation/report-tier-schema";

/**
 * Kanonisk admin-provisjon-inngang (PRD 12 Unit 4) — operatør-trigger for
 * PRD 3-pipeline-kjernen (`provisionReportBoard`). Produserer et REPORT-board,
 * samme kjerne som CLI-en — de døde legacy-genereringsrutene brukes ikke.
 *
 * Async-grense: IDENTISK fire-and-poll-kontrakt som self-serve (PRD 3 Unit 8
 * AC6): jobb-record i `generation_requests` settes pending, HTTP-svaret
 * returnerer umiddelbart, pipelinen fullfører in-process (runAfterResponse)
 * og oppdaterer raden; admin-UI poller GET /api/generation-requests?id=.
 *
 * Ingen runtime-LLM i request-pathen — kjernen er discovery/hydrering
 * (Google/Entur/NSR-proxyer, nøkler i header via sine moduler).
 */

export const maxDuration = 300;

// Konservativ grense: operatør-rute, dyre oppstrøms-API-kall (Google/Mapbox) per request.
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

/** Jobb-record-krav: generation_requests.email/consent er NOT NULL.
 *  Operatør-triggeren har ingen bestiller — bruk tydelig syntetisk verdi. */
const OPERATOR_EMAIL = "operator@placy.no";

const ProvisionRequestSchema = z.object({
  address: z.string().min(5).max(200).trim(),
  /** Prosjektnavn — default adressens førstesegment. createReportProject
   *  eier slug-avledningen fra navnet. */
  name: z.string().min(2).max(120).trim().optional(),
  customer: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "kunde-slug må være kebab-case"),
  profile: z.enum(["bolig", "naering"]).default("bolig"),
  reportTier: OptionalReportTierSchema,
  has3dAddon: z.boolean().default(false),
  allowUpdate: z.boolean().default(false),
  /** Fra adresse-autocomplete → kjernen hopper over geocoding. Uten →
   *  kjernen geocoder ikke-interaktivt (samme som CLI uten --confirm-coords). */
  lat: z.number().min(57).max(72).optional(),
  lng: z.number().min(4).max(32).optional(),
  city: z.string().max(100).optional(),
});

function boardUrl(customer: string, slug: string): string {
  return `/eiendom/${customer}/${slug}/rapport-board`;
}

export async function POST(request: NextRequest) {
  const gate = requireAdminApi();
  if (gate) return gate;

  if (!limiter.check(getClientIp(request.headers))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }
  const db = supabase.schema("v2");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ProvisionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { address, name, customer, profile, reportTier, has3dAddon, allowUpdate, lat, lng, city } =
    parsed.data;
  const projectName = name ?? address.split(",")[0].trim();

  // Jobb-record (samme status-maskin som self-serve). Request-sluggen er
  // radens nøkkel — prosjekt-sluggen eies av createReportProject.
  const baseSlug = slugify(projectName);
  let requestSlug = baseSlug;
  const { data: slugExists } = await db
    .from("generation_requests")
    .select("id")
    .eq("address_slug", baseSlug)
    .limit(1);
  if (slugExists && slugExists.length > 0) {
    requestSlug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
  }

  const { data: inserted, error: insertError } = await db
    .from("generation_requests")
    .insert({
      address,
      address_normalized: address.toLowerCase().replace(/\s+/g, " ").trim().normalize("NFC"),
      email: OPERATOR_EMAIL,
      housing_type: profile,
      status: "pending",
      geocoded_lat: lat ?? null,
      geocoded_lng: lng ?? null,
      geocoded_city: city ?? null,
      address_slug: requestSlug,
      consent_given: true,
      customer_id: customer,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("Failed to insert provision job:", insertError?.message, insertError?.code);
    return NextResponse.json({ error: "Kunne ikke opprette jobb" }, { status: 500 });
  }

  const requestId: string = inserted.id;

  runAfterResponse(async () => {
    try {
      const result = await provisionReportBoard({
        name: projectName,
        address,
        customer,
        profile,
        reportTier,
        has3dAddon,
        allowUpdate,
        ...(lat !== undefined && lng !== undefined
          ? { confirmCoords: { lat, lng }, placeName: address }
          : {}),
        city,
      });

      const resultUrl = boardUrl(result.customerSlug, result.slug);
      const { error: updateError } = await db
        .from("generation_requests")
        .update({
          status: "completed",
          project_id: result.projectId,
          result_url: resultUrl,
          completed_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (updateError) {
        console.error("Failed to mark provision job completed:", updateError.message);
      }
    } catch (err) {
      console.error("[Provision] Failed:", err);
      const { error: updateError } = await db
        .from("generation_requests")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Ukjent feil",
        })
        .eq("id", requestId);
      if (updateError) {
        console.error("Failed to mark provision job failed:", updateError.message);
      }
    }
  });

  return NextResponse.json({
    id: requestId,
    slug: requestSlug,
    url: boardUrl(customer, baseSlug),
    status: "pending",
    message: "Provisjon startet — pipelinen kjører",
  });
}
