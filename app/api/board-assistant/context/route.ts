import { NextRequest, NextResponse } from "next/server";
import { liveContextSchema } from "@/lib/live/anja-protocol";
import { boardCapability, sameOrigin, serviceJson } from "@/lib/live/board-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 404 });
  const checked = await boardCapability(request);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: checked.status });
  const message = liveContextSchema.safeParse(await request.json().catch(() => null));
  if (!message.success) return NextResponse.json({ error: "Ugyldig kontekst." }, { status: 400 });
  const { response, payload } = await serviceJson("/sessions/context", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(message.data),
  }, checked.capability.session);
  return NextResponse.json(payload, { status: response.status });
}
