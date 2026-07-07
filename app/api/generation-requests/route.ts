import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAfterResponse } from "@/lib/utils/run-after-response";
import { createServerClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils/slugify";
import { provisionReportBoard } from "@/lib/pipeline/provision";
import { DEFAULT_CUSTOMER } from "@/lib/pipeline/create-report-project";
import type { ReportProfile } from "@/lib/pipeline/report-defaults";
import { createRateLimiter, getClientIp } from "@/lib/utils/rate-limit";
import { findAreaForPoint } from "@/lib/pipeline/find-area-for-point";
import { shareUrl } from "@/lib/megler/urls";

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

// Audit-fiks 2026-07-06: selvbetjent provisjonerings-endepunkt uten rate limit
// er åpent for (a) ubegrenset billet API-spend (Gemini + Google Places + Mapbox)
// og (b) e-post-bombing fra placy.no-domenet. Stram grense: provisjonering er
// dyr og 5 kall/min per IP er mer enn nok for legitim selvbetjening.
const postLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

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
  /**
   * Kontor-scopet inngang (Unit 1/2): slår opp broker_offices og knytter boardet
   * til kontorets kunde. Ukjent/inaktiv → 404 (R15). Vinner over `brokerage`.
   */
  officeSlug: z.string().min(3).max(120).trim().optional(),
  /**
   * Den EKSPLISITTE andre opt-in-en ved avvisning (R17): lagre e-post i
   * coverage_demand for dekningsvarsel. POST-samtykket gjaldt board-varsling.
   */
  notifyWhenCovered: z.boolean().optional(),
  profile: z.enum(["bolig", "naering"]).default("bolig"),
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3,4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeAddress(address: string): string {
  return address.toLowerCase().replace(/\s+/g, " ").trim().normalize("NFC");
}

// v2-scopet klient. MÅ utledes via en KONKRET .schema("v2")-instansiering:
// ReturnType<...["schema"]> uten arg resolver til snittet av public/v2-tabellene
// og mister de v2-eneste tabellene (areas, broker_offices, coverage_demand).
function v2Client() {
  return createServerClient().schema("v2");
}
type Db = ReturnType<typeof v2Client>;

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

/**
 * Slår opp aktivt kontor i registeret (R15). Returnerer kundens id, eller null
 * ved ukjent/inaktiv slug (→ 404). getOrCreateCustomer-upsert gjelder ALDRI
 * denne inngangen. Fail-closed ved DB-feil (samme som page.tsx — ingen
 * rotasjons-orakel), logget for ops.
 */
async function lookupOfficeCustomer(
  db: Db,
  officeSlug: string
): Promise<string | null> {
  const { data, error } = await db
    .from("broker_offices")
    .select("customer_id")
    .eq("slug", officeSlug)
    .eq("active", true)
    .maybeSingle();
  if (error) {
    console.error(
      `[megler] broker_offices-oppslag feilet for "${officeSlug}":`,
      error.message
    );
    return null;
  }
  return data?.customer_id ?? null;
}

/** Navn på alle kuraterte strøk (boundary + report_editorial satt) — vises i
 *  avvisningsmeldingen (R5). Kjøres kun på rejection-stien. */
async function coveredAreaNames(db: Db): Promise<string[]> {
  const { data } = await db
    .from("areas")
    .select("name_no")
    .not("boundary", "is", null)
    .not("report_editorial", "is", null);
  return (data ?? []).map((a) => a.name_no).filter(Boolean);
}

export async function POST(request: NextRequest) {
  if (!postLimiter.check(getClientIp(request.headers))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const db = v2Client();

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

  const { address, email, lat, lng, city, brokerage, officeSlug, profile } =
    parsed.data;
  const notifyWhenCovered = parsed.data.notifyWhenCovered === true;
  const normalized = normalizeAddress(address);

  // Kunde-resolusjon:
  //  - officeSlug → oppslag i broker_offices (ukjent/inaktiv → 404, R15; ALDRI
  //    getOrCreateCustomer). Kontor-scopingen er autoritativ og vinner over brokerage.
  //  - brokerage → egen customer (åpen sides dagens flyt)
  //  - ellers → reservert intern-kunde (via createReportProject sin fallback).
  let customerSlug: string = DEFAULT_CUSTOMER;
  if (officeSlug) {
    const officeCustomer = await lookupOfficeCustomer(db, officeSlug);
    if (!officeCustomer) {
      return NextResponse.json({ error: "Kontor ikke funnet" }, { status: 404 });
    }
    customerSlug = officeCustomer;
  } else if (brokerage) {
    try {
      customerSlug = await getOrCreateCustomer(db, brokerage);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Kunne ikke opprette kunde" },
        { status: 400 }
      );
    }
  }

  // Geofence FØR provisjonering (R5) — håndheves for ALLE innganger, også den
  // åpne /eiendom/generer-siden (kan ikke omgås via URL-bytte). Fail-soft: en
  // Supabase-feil eller throw behandles som «utenfor dekning» (bedre enn å
  // provisjonere et board uten redaksjonelt lag), men logges så falske
  // avvisninger kan oppdages.
  let insideCoverage = false;
  try {
    const { area, warnings } = await findAreaForPoint({ lat, lng });
    warnings.forEach((w) => console.warn("[geofence]", w));
    insideCoverage = area !== null;
  } catch (err) {
    console.warn(
      "[geofence] findAreaForPoint kastet — behandler som utenfor dekning:",
      err instanceof Error ? err.message : err
    );
    insideCoverage = false;
  }

  if (!insideCoverage) {
    // Logg etterspørsel (R6) — atomisk dedup + hits-teller via RPC. E-post lagres
    // KUN ved eksplisitt andre opt-in (R17); POST-samtykket gjaldt board-varsling.
    const { error: demandErr } = await db.rpc("record_coverage_demand", {
      p_address: address,
      p_address_normalized: normalized,
      p_lat: lat,
      p_lng: lng,
      p_office_slug: officeSlug ?? null,
      p_email: notifyWhenCovered ? email : null,
    });
    if (demandErr) {
      console.error("[coverage_demand] logging feilet:", demandErr.message);
    }

    const coveredAreas = await coveredAreaNames(db);
    return NextResponse.json({
      status: "outside_coverage",
      place: city || address.split(",")[0],
      coveredAreas,
      message:
        "Vi lager nabolagskart for områder vi kjenner redaksjonelt. Dette stedet er ikke kartlagt ennå.",
      ...(notifyWhenCovered ? { notified: true } : {}),
    });
  }

  // 7-dagers duplikat-sjekk, scopet per kunde (R16): samme adresse fra et annet
  // kontor gir egen request (ikke gjenbruk av et annet kontors board).
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await db
    .from("generation_requests")
    .select("id, address_slug, status, customer_id, result_url")
    .eq("address_normalized", normalized)
    .eq("customer_id", customerSlug)
    .gte("created_at", sevenDaysAgo)
    .limit(1);

  if (existing && existing.length > 0) {
    const row = existing[0];
    const existingCustomer = row.customer_id ?? customerSlug;
    return NextResponse.json({
      id: row.id,
      slug: row.address_slug,
      // Dup-svar → delings-siden (R16): completed-rader har result_url = delings-
      // side; pending → bygg fra address_slug (delings-siden kanoniserer selv).
      url: row.result_url ?? shareUrl(existingCustomer, row.address_slug),
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
  // Provisorisk delings-side-URL (address_slug) — delings-siden viser vente-
  // tilstand og kanoniserer til url_slug når boardet er ferdig.
  const provisionalUrl = shareUrl(customerSlug, finalSlug);

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
      // finnes — pek result_url til delings-siden (R8) og marker completed.
      const resultUrl = shareUrl(result.customerSlug, result.slug);
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
            Nabolagskartet for <strong>${address}</strong> er klart. På delings-siden
            kan du kopiere lenke til FINN-annonsen, hente iframe-kode til nettsiden
            og QR-kode til visning.
          </p>
          <a href="${projectUrl}" style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
            Åpne delings-siden
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
