import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAfterResponse } from "@/lib/utils/run-after-response";
import { createServerClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils/slugify";
import { provisionReportBoard } from "@/lib/pipeline/provision";
import { DEFAULT_CUSTOMER } from "@/lib/pipeline/create-report-project";
import type { ReportProfile } from "@/lib/pipeline/report-defaults";

/**
 * Self-serve adresse→rapport-board (PRD 3 Unit 8).
 *
 * ÉN pipeline: ruta kaller Unit 1-orkestreringskjernen (provisionReportBoard)
 * — v1-modulene for prosjekt-opprettelse og den tredje kategorimodellen er
 * slettet. housing_type-kolonnen bærer nå profilen (bolig|naering);
 * family/young/senior-modellen er død.
 *
 * Async-grense (RATIFISERT 2026-06-29): HTTP-svaret returnerer umiddelbart
 * med pending + provisorisk URL; pipelinen fullfører in-process via
 * runAfterResponse (waitUntil-pickup / detached promise — se helperen for
 * hvorfor ikke Next 15s after-API) og oppdaterer raden til completed/failed.
 * INGEN ekstern jobbkø. Klienten poller GET ?id=<uuid>.
 *
 * Slug-eierskap: createReportProject eier prosjekt-sluggen (fra name).
 * address_slug her er REQUEST-radens nøkkel (dup/kollisjons-sjekk);
 * result_url settes post-completion fra result.slug (autoritativ).
 *
 * PII-grense (PRD 1 RLS): generation_requests (email+consent) er
 * service-role-only. GET-svaret eksponerer ALDRI email.
 */

export const maxDuration = 300;

const RESERVED_SLUGS = ["generer", "tekst", "admin", "api", DEFAULT_CUSTOMER];

const GenerationRequestSchema = z.object({
  address: z.string().min(5).max(200).trim(),
  email: z.string().email().max(254),
  lat: z.number().min(57).max(72),
  lng: z.number().min(4).max(32),
  city: z.string().max(100),
  consentGiven: z.literal(true),
  /** Valgfritt: uten meglerkontor havner boardet under reservert `intern`. */
  brokerage: z.string().min(2).max(200).trim().optional(),
  profile: z.enum(["bolig", "naering"]).default("bolig"),
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3,4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function boardUrl(customer: string, slug: string): string {
  return `/eiendom/${customer}/${slug}/rapport-board`;
}

function normalizeAddress(address: string): string {
  return address.toLowerCase().replace(/\s+/g, " ").trim().normalize("NFC");
}

type Db = ReturnType<
  NonNullable<ReturnType<typeof createServerClient>>["schema"]
>;

async function getOrCreateCustomer(
  db: Db,
  brokerageName: string
): Promise<string> {
  const customerSlug = slugify(brokerageName);

  if (RESERVED_SLUGS.includes(customerSlug)) {
    throw new Error(`Ugyldig meglerkontor-navn: "${brokerageName}"`);
  }

  // Upsert med lesbart navn (createReportProject upserter kun id=name=slug)
  const { error } = await db
    .from("customers")
    .upsert({ id: customerSlug, name: brokerageName }, { onConflict: "id" });
  if (error) {
    throw new Error(`Kunne ikke opprette kunde: ${error.message}`);
  }

  return customerSlug;
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
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

  const parsed = GenerationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { address, email, lat, lng, city, brokerage, profile } = parsed.data;
  const normalized = normalizeAddress(address);

  // Kunde: meglerkontor → egen customer; ellers reservert intern-kunde
  // (intern_<slug> via createReportProject sin DEFAULT_CUSTOMER-fallback).
  let customerSlug: string = DEFAULT_CUSTOMER;
  if (brokerage) {
    try {
      customerSlug = await getOrCreateCustomer(db, brokerage);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Kunne ikke opprette kunde" },
        { status: 400 }
      );
    }
  }

  // 7-dagers duplikat-sjekk på normalisert adresse
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await db
    .from("generation_requests")
    .select("id, address_slug, status, customer_id, result_url")
    .eq("address_normalized", normalized)
    .gte("created_at", sevenDaysAgo)
    .limit(1);

  if (existing && existing.length > 0) {
    const row = existing[0];
    const existingCustomer = row.customer_id ?? customerSlug;
    return NextResponse.json({
      id: row.id,
      slug: row.address_slug,
      url: row.result_url ?? boardUrl(existingCustomer, row.address_slug),
      status: row.status,
      message: "Denne adressen er allerede forespurt",
      existing: true,
    });
  }

  // Request-slug med kollisjons-suffiks (request-radens nøkkel — prosjekt-
  // sluggen eies av createReportProject og kan avvike).
  const baseSlug = slugify(address.split(",")[0]);
  let finalSlug = baseSlug;
  const { data: slugExists } = await db
    .from("generation_requests")
    .select("id")
    .eq("address_slug", baseSlug)
    .limit(1);
  if (slugExists && slugExists.length > 0) {
    finalSlug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
  }

  // Insert pending (v2: status + housing_type er NOT NULL uten default)
  const { data: inserted, error: insertError } = await db
    .from("generation_requests")
    .insert({
      address,
      address_normalized: normalized,
      email,
      housing_type: profile,
      status: "pending",
      geocoded_lat: lat,
      geocoded_lng: lng,
      geocoded_city: city,
      address_slug: finalSlug,
      consent_given: true,
      customer_id: customerSlug,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error(
      "Failed to insert generation request:",
      insertError?.message,
      insertError?.code
    );
    return NextResponse.json({ error: "Kunne ikke lagre forespørsel" }, { status: 500 });
  }

  const requestId: string = inserted.id;
  const provisionalUrl = boardUrl(customerSlug, finalSlug);

  // Pipeline etter HTTP-svaret — in-process, ingen jobbkø (ratifisert grense).
  runAfterResponse(async () => {
    try {
      const result = await provisionReportBoard({
        name: address,
        address,
        customer: customerSlug,
        profile: profile as ReportProfile,
        has3dAddon: false,
        allowUpdate: false,
        confirmCoords: { lat, lng },
        placeName: address,
        city,
      });

      // aborted (prosjektet fantes) er et OK-utfall for bestilleren: boardet
      // finnes — pek result_url dit og marker completed.
      const resultUrl = boardUrl(result.customerSlug, result.slug);
      await db
        .from("generation_requests")
        .update({
          status: "completed",
          project_id: result.projectId,
          result_url: resultUrl,
          completed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      await sendConfirmationEmail(
        email,
        address,
        `https://placy.no${resultUrl}`,
        true
      ).catch((err) => console.error("Failed to send confirmation email:", err));
    } catch (err) {
      console.error("[Pipeline] Failed:", err);
      await db
        .from("generation_requests")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Ukjent feil",
        })
        .eq("id", requestId);

      await sendConfirmationEmail(
        email,
        address,
        `https://placy.no${provisionalUrl}`,
        false
      ).catch((emailErr) =>
        console.error("Failed to send confirmation email:", emailErr)
      );
    }
  });

  return NextResponse.json({
    id: requestId,
    slug: finalSlug,
    url: provisionalUrl,
    status: "pending",
    message: "Forespørsel mottatt — nabolagskartet genereres",
  });
}

/** Polling-endepunkt (AC6): status/result_url per request-id. ALDRI email. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Ugyldig id" }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .schema("v2")
    .from("generation_requests")
    .select("status, result_url, error_message")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Oppslag feilet" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });
  }

  return NextResponse.json({
    status: data.status,
    resultUrl: data.result_url,
    errorMessage: data.error_message,
  });
}

async function sendConfirmationEmail(
  to: string,
  address: string,
  projectUrl: string,
  ready: boolean
) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return;

  const shortAddress = address.split(",")[0];

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Placy", email: "hei@placy.no" },
      to: [{ email: to }],
      subject: ready
        ? `Nabolagskart for ${shortAddress} er klart`
        : `Nabolagskart for ${shortAddress}`,
      htmlContent: ready
        ? `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 20px; color: #111; margin-bottom: 16px;">Nabolagskartet er klart!</h1>
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            Nabolagskartet for <strong>${address}</strong> er generert og klart til bruk.
            Del lenken med potensielle kjøpere.
          </p>
          <a href="${projectUrl}" style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
            Se nabolagskartet
          </a>
          <p style="font-size: 13px; color: #999; margin-top: 32px;">
            Denne e-posten ble sendt fra Placy fordi du bestilte et nabolagskart.
          </p>
        </div>
        `
        : `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 20px; color: #111; margin-bottom: 16px;">Forespørsel mottatt</h1>
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            Vi har mottatt din forespørsel om nabolagskart for <strong>${address}</strong>.
            Genereringen tok lenger enn forventet — vi jobber med saken.
          </p>
          <p style="font-size: 13px; color: #999; margin-top: 32px;">
            Denne e-posten ble sendt fra Placy fordi du bestilte et nabolagskart.
          </p>
        </div>
        `,
    }),
  });
}
