/**
 * Admin API: Single POI Trust Score Update (with flag merging)
 *
 * Used by Claude Code Layer 3 skill to update individual POIs after web search.
 * Merges new flags with existing Layer 1+2 flags — never replaces.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/client";
import { ALL_TRUST_FLAGS } from "@/lib/utils/poi-trust";
import { updatePOITrustScore } from "@/lib/supabase/mutations";

const UpdateSchema = z.object({
  poiId: z.string().min(1),
  trustScore: z.number().min(0).max(1),
  trustFlags: z.array(z.string()),
});

function checkBearerAuth(request: NextRequest): boolean {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return true;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${token}`;
}

export async function POST(request: NextRequest) {
  // 1. Admin + bearer token check
  if (process.env.ADMIN_ENABLED !== "true") {
    return NextResponse.json({ error: "Admin ikke aktivert" }, { status: 403 });
  }
  if (!checkBearerAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Zod validation
  let body: z.infer<typeof UpdateSchema>;
  try {
    const json = await request.json();
    body = UpdateSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ugyldig request", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  // Validate all flags against the single source of truth
  const validFlags = new Set<string>(ALL_TRUST_FLAGS);
  for (const flag of body.trustFlags) {
    if (!validFlags.has(flag)) {
      return NextResponse.json(
        { error: `Invalid trust flag: ${flag}` },
        { status: 400 }
      );
    }
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert" }, { status: 500 });
  }

  try {
    // 3. Read existing trust_flags for merging
    const { data: existing, error: readError } = await supabase
      .from("pois")
      .select("trust_flags")
      .eq("id", body.poiId)
      .single();

    if (readError || !existing) {
      return NextResponse.json(
        { error: `POI not found: ${body.poiId}` },
        { status: 404 }
      );
    }

    // 4. Merge: existing flags + new flags (never replace)
    const existingFlags = (existing.trust_flags as string[]) || [];
    const mergedFlags = Array.from(new Set([...existingFlags, ...body.trustFlags]));

    // 5. Update via shared mutation (validates score + flags)
    await updatePOITrustScore(body.poiId, body.trustScore, mergedFlags);

    // 6. Revalidate — find the project(s) this POI belongs to
    const { data: projectLinks } = await supabase
      .from("project_pois")
      .select("project_id")
      .eq("poi_id", body.poiId);

    if (projectLinks) {
      for (const link of projectLinks) {
        const { data: project } = await supabase
          .from("projects")
          .select("customer_id, url_slug")
          .eq("id", link.project_id)
          .single();

        if (project) {
          revalidatePath(`/${project.customer_id}/${project.url_slug}`, "layout");
        }
      }
    }

    return NextResponse.json({ success: true, mergedFlags });
  } catch (error) {
    console.error("[trust-validate/update] Error:", error);
    return NextResponse.json(
      {
        error: "Trust update feilet",
        details: error instanceof Error ? error.message : "Ukjent feil",
      },
      { status: 500 }
    );
  }
}
