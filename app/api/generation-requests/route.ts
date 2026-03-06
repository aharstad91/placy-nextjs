import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/client";

const GenerationRequestSchema = z.object({
  address: z.string().min(5).max(200).trim(),
  email: z.string().email().max(254),
  housingType: z.enum(["family", "young", "senior"]),
  lat: z.number().min(57).max(72),
  lng: z.number().min(4).max(32),
  city: z.string().max(100),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  consentGiven: z.literal(true),
});

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function POST(request: NextRequest) {
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

  const { address, email, housingType, lat, lng, city, slug, consentGiven } = parsed.data;
  const normalized = normalizeAddress(address);

  // Check for recent duplicate
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("generation_requests")
    .select("address_slug, status")
    .eq("address_normalized", normalized)
    .gte("created_at", sevenDaysAgo)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({
      slug: existing[0].address_slug,
      url: `/kart/${existing[0].address_slug}`,
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
    const suffix = Math.random().toString(36).slice(2, 6);
    finalSlug = `${slug}-${suffix}`;
  }

  // Insert
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
  });

  if (error) {
    console.error("Failed to insert generation request:", error);
    return NextResponse.json({ error: "Kunne ikke lagre forespørsel" }, { status: 500 });
  }

  return NextResponse.json({
    slug: finalSlug,
    url: `/kart/${finalSlug}`,
    message: "Forespørsel mottatt",
  });
}
