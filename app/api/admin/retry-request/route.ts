import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/client";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { runAfterResponse } from "@/lib/utils/run-after-response";
import { provisionReportBoard } from "@/lib/pipeline/provision";
import { DEFAULT_CUSTOMER } from "@/lib/pipeline/create-report-project";

/**
 * Retry-trigger (PRD 12 Unit 5 AC2): re-armer en failed generation_request
 * (pending + error_message=null + updated_at) OG re-kjører PRD 3-pipelinen
 * for raden in-process — samme fire-and-poll-kontrakt som self-serve/admin-
 * provisjon. Raden bærer alt kjernen trenger (adresse, koordinater, kunde,
 * profil), så retry er en reell re-kjøring, ikke bare en status-reset.
 */

export const maxDuration = 300;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function boardUrl(customer: string, slug: string): string {
  return `/eiendom/${customer}/${slug}/rapport-board`;
}

export async function POST(request: NextRequest) {
  const gate = requireAdminApi();
  if (gate) return gate;

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }
  const db = supabase.schema("v2");

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string" || !UUID_REGEX.test(body.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const requestId = body.id;

  // Hent den feilede raden — retry gjelder KUN failed (status-maskinen).
  const { data: row, error: fetchError } = await db
    .from("generation_requests")
    .select(
      "id, address, customer_id, housing_type, geocoded_lat, geocoded_lng, geocoded_city"
    )
    .eq("id", requestId)
    .eq("status", "failed")
    .maybeSingle();

  if (fetchError) {
    console.error("Retry-oppslag feilet:", fetchError.message);
    return NextResponse.json({ error: "Oppslag feilet" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json(
      { error: "Ingen failed request med denne id-en" },
      { status: 404 }
    );
  }

  // Re-arm: pending + nullstilt feil + updated_at (AC2)
  const { error: armError } = await db
    .from("generation_requests")
    .update({
      status: "pending",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "failed");

  if (armError) {
    return NextResponse.json({ error: "Failed to retry" }, { status: 500 });
  }

  const address: string = row.address;
  const customer: string = row.customer_id ?? DEFAULT_CUSTOMER;
  const profile = row.housing_type === "naering" ? ("naering" as const) : ("bolig" as const);
  const lat: number | null = row.geocoded_lat;
  const lng: number | null = row.geocoded_lng;
  const city: string | null = row.geocoded_city;

  runAfterResponse(async () => {
    try {
      const result = await provisionReportBoard({
        name: address.split(",")[0].trim(),
        address,
        customer,
        profile,
        has3dAddon: false,
        // Retry kjører typisk mot et delvis opprettet prosjekt — tillat update.
        allowUpdate: true,
        ...(lat !== null && lng !== null
          ? { confirmCoords: { lat, lng }, placeName: address }
          : {}),
        city: city ?? undefined,
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
        console.error("Retry: klarte ikke markere completed:", updateError.message);
      }
    } catch (err) {
      console.error("[Retry] Pipeline feilet:", err);
      const { error: updateError } = await db
        .from("generation_requests")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Ukjent feil",
        })
        .eq("id", requestId);
      if (updateError) {
        console.error("Retry: klarte ikke markere failed:", updateError.message);
      }
    }
  });

  return NextResponse.json({ ok: true, status: "pending" });
}
