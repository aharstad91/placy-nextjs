import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils/slugify";
import { eiendomUrl } from "@/lib/urls";

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

  return NextResponse.json({
    slug: finalSlug,
    url: eiendomUrl(customerSlug, finalSlug),
    message: "Forespørsel mottatt",
  });
}
