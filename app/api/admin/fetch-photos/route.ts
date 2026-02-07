import { NextRequest, NextResponse } from "next/server";
import { fetchAndCachePOIPhotos } from "@/lib/utils/fetch-poi-photos";

export async function POST(request: NextRequest) {
  const adminEnabled = process.env.ADMIN_ENABLED === "true";
  if (!adminEnabled) {
    return NextResponse.json({ error: "Admin not enabled" }, { status: 403 });
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
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

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
