import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils/slugify";
import { eiendomUrl } from "@/lib/urls";
import { createGeneratedProject } from "@/lib/pipeline/create-project";
import { importPOIsToProject } from "@/lib/pipeline/import-pois";
import { getHousingCategories } from "@/lib/pipeline/housing-categories";
import type { HousingType } from "@/lib/pipeline/housing-categories";

const RESERVED_SLUGS = ["generer", "tekst", "admin", "api"];

const GenerationRequestSchema = z.object({
  address: z.string().min(5).max(200).trim(),
  email: z.string().email().max(254),
  housingType: z.enum(["family", "young", "senior"]),
  lat: z.number().min(57).max(72),
  lng: z.number().min(4).max(32),
  city: z.string().max(100),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  consentGiven: z.literal(true),
  brokerage: z.string().min(2).max(200).trim(),
});

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFC");
}

async function getOrCreateCustomer(
  supabase: ReturnType<typeof createServerClient>,
  brokerageName: string
): Promise<string> {
  const customerSlug = slugify(brokerageName);

  if (RESERVED_SLUGS.includes(customerSlug)) {
    throw new Error(`Ugyldig meglerkontor-navn: "${brokerageName}"`);
  }

  // Upsert: insert if not exists, ignore on conflict (race-safe)
  await supabase!
    .from("customers")
    .upsert({ id: customerSlug, name: brokerageName }, { onConflict: "id" });

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

  const { address, email, housingType, lat, lng, city, slug, consentGiven, brokerage } = parsed.data;
  const normalized = normalizeAddress(address);

  // Get or create customer from brokerage name
  let customerSlug: string;
  try {
    customerSlug = await getOrCreateCustomer(supabase, brokerage);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke opprette kunde" },
      { status: 400 }
    );
  }

  // Check for recent duplicate
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("generation_requests")
    .select("address_slug, status, customer_id")
    .eq("address_normalized", normalized)
    .gte("created_at", sevenDaysAgo)
    .limit(1);

  if (existing && existing.length > 0) {
    const existingCustomer = existing[0].customer_id ?? customerSlug;
    return NextResponse.json({
      slug: existing[0].address_slug,
      url: eiendomUrl(existingCustomer, existing[0].address_slug),
      message: "Denne adressen er allerede forespurt",
      existing: true,
    });
  }

  // Check slug collision, append suffix if needed
  let finalSlug = slug;
  const { data: slugExists } = await supabase
    .from("generation_requests")
    .select("id")
    .eq("address_slug", slug)
    .limit(1);

  if (slugExists && slugExists.length > 0) {
    const suffix = crypto.randomUUID().slice(0, 6);
    finalSlug = `${slug}-${suffix}`;
  }

  // Insert with customer_id
  const { error } = await supabase.from("generation_requests").insert({
    address,
    address_normalized: normalized,
    email,
    housing_type: housingType,
    geocoded_lat: lat,
    geocoded_lng: lng,
    geocoded_city: city,
    address_slug: finalSlug,
    consent_given: consentGiven,
    customer_id: customerSlug,
  });

  if (error) {
    console.error("Failed to insert generation request:", error.message, error.code);
    return NextResponse.json({ error: "Kunne ikke lagre forespørsel" }, { status: 500 });
  }

  // === Pipeline: Generate project + import POIs ===
  const resultUrl = eiendomUrl(customerSlug, finalSlug);
  let pipelineSuccess = false;

  try {
    // 1. Create project + explorer product in Supabase
    const { projectId } = await createGeneratedProject({
      customerSlug,
      slug: finalSlug,
      address,
      lat,
      lng,
      housingType: housingType as HousingType,
    });

    // 2. Import POIs from Google Places + Entur + Bysykkel
    const categories = getHousingCategories(housingType as HousingType);
    const importResult = await importPOIsToProject({
      circles: [{ lat, lng, radiusMeters: 2000 }],
      categories,
      projectId,
      includeEntur: true,
      includeBysykkel: true,
    });

    console.log(`[Pipeline] Imported ${importResult.total} POIs for ${address}`);

    // 3. Update request to completed
    await supabase.from("generation_requests").update({
      status: "completed",
      project_id: projectId,
      result_url: resultUrl,
      completed_at: new Date().toISOString(),
    }).eq("address_slug", finalSlug);

    pipelineSuccess = true;
  } catch (err) {
    console.error("[Pipeline] Failed:", err);
    await supabase.from("generation_requests").update({
      status: "failed",
      error_message: err instanceof Error ? err.message : "Ukjent feil",
    }).eq("address_slug", finalSlug);
  }

  // Send confirmation email
  const projectUrl = `https://placy.no${resultUrl}`;
  await sendConfirmationEmail(email, address, projectUrl, pipelineSuccess).catch((err) =>
    console.error("Failed to send confirmation email:", err)
  );

  return NextResponse.json({
    slug: finalSlug,
    url: resultUrl,
    message: pipelineSuccess ? "Nabolagskart generert" : "Forespørsel mottatt — generering pågår",
    status: pipelineSuccess ? "completed" : "failed",
  });
}

async function sendConfirmationEmail(to: string, address: string, projectUrl: string, ready: boolean) {
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
