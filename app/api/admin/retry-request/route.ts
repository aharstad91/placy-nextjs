import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("generation_requests")
    .update({
      status: "pending",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .eq("status", "failed");

  if (error) {
    return NextResponse.json({ error: "Failed to retry" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
