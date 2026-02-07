import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/client";
import { z } from "zod";

const NORWAY_BOUNDS = {
  minLat: 57.0,
  maxLat: 72.0,
  minLng: 4.0,
  maxLng: 32.0,
};

const DiscoveryCircleSchema = z.object({
  lat: z.number().min(NORWAY_BOUNDS.minLat).max(NORWAY_BOUNDS.maxLat),
  lng: z.number().min(NORWAY_BOUNDS.minLng).max(NORWAY_BOUNDS.maxLng),
  radiusMeters: z.number().min(300).max(2000),
});

const PatchProjectSchema = z.object({
  discovery_circles: z.array(DiscoveryCircleSchema).max(10).nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.ADMIN_ENABLED !== "true") {
    return NextResponse.json({ error: "Admin ikke aktivert" }, { status: 403 });
  }

  const { id: projectId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PatchProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database ikke konfigurert" },
      { status: 500 }
    );
  }

  // Cast needed: discovery_circles column added in migration 013 but Supabase types not regenerated
  const { error } = await supabase
    .from("projects")
    .update({ discovery_circles: parsed.data.discovery_circles } as Record<string, unknown>)
    .eq("id", projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
