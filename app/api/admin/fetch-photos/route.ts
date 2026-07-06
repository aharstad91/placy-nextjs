import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchAndCachePOIPhotos } from "@/lib/utils/fetch-poi-photos";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { createRateLimiter, getClientIp } from "@/lib/utils/rate-limit";

// Konservativ grense: operatør-rute, Google Places-spend per kall.
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const FetchPhotosRequestSchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const gate = requireAdminApi();
  if (gate) return gate;

  if (!limiter.check(getClientIp(request.headers))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  if (!googleApiKey) {
    return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = FetchPhotosRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ugyldig input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { projectId } = parsed.data;

    const result = await fetchAndCachePOIPhotos(
      projectId,
      supabaseUrl,
      serviceRoleKey,
      googleApiKey
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fetch photos error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
