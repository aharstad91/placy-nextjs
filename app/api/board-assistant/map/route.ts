import { NextRequest, NextResponse } from "next/server";
import { mapResultSchema } from "@/lib/live/anja-protocol";
import { callAnjaService } from "@/lib/live/anja-service-client";
import { boardCapability, sameOrigin, serviceJson } from "@/lib/live/board-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const checked = await boardCapability(request);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: checked.status });
  const response = await callAnjaService("/sessions/map", { method: "GET", signal: request.signal }, checked.capability.session);
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({ error: "Kartkoblingen er ikke tilgjengelig." }));
    return NextResponse.json(payload, { status: response.status });
  }
  return new NextResponse(response.body, { status: 200, headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive",
  } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 404 });
  const checked = await boardCapability(request);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: checked.status });
  const result = mapResultSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: "Ugyldig kartsvar." }, { status: 400 });
  const { response, payload } = await serviceJson("/sessions/map", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data),
  }, checked.capability.session);
  return NextResponse.json(payload, { status: response.status });
}
