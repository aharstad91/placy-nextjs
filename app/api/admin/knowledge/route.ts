import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/client";

const PatchSchema = z.object({
  id: z.string().uuid(),
  displayReady: z.boolean().optional(),
  confidence: z.enum(["verified", "unverified", "disputed"]).optional(),
});

export async function PATCH(request: NextRequest) {
  if (process.env.ADMIN_ENABLED !== "true") {
    return NextResponse.json({ error: "Admin ikke aktivert" }, { status: 403 });
  }

  let body: z.infer<typeof PatchSchema>;
  try {
    const json = await request.json();
    body = PatchSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ugyldig request", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  // Must update at least one field
  if (body.displayReady === undefined && body.confidence === undefined) {
    return NextResponse.json(
      { error: "Minst ett felt må oppdateres (displayReady eller confidence)" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert" }, { status: 500 });
  }

  const updates: Record<string, unknown> = {};
  if (body.displayReady !== undefined) updates.display_ready = body.displayReady;
  if (body.confidence !== undefined) updates.confidence = body.confidence;

  const { error } = await supabase
    .from("place_knowledge")
    .update(updates)
    .eq("id", body.id);

  if (error) {
    console.error("[admin/knowledge] Update failed:", error);
    return NextResponse.json(
      { error: "Oppdatering feilet", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
