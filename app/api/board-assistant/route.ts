import { NextRequest, NextResponse } from "next/server";
import { boardIdentitySchema, startBoardSessionSchema } from "@/lib/live/anja-protocol";
import { boardCapabilityCookie, issueBoardCapability } from "@/lib/live/board-capability";
import { boardCapability, boardSource, sameOrigin, serviceJson } from "@/lib/live/board-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = boardIdentitySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Ugyldig board." }, { status: 400 });
  const checked = await boardSource(parsed.data.customer, parsed.data.projectSlug, parsed.data.contentVersion);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: checked.status });
  const query = new URLSearchParams(parsed.data).toString();
  const { response, payload } = await serviceJson(`/health?${query}`, { method: "GET" });
  return NextResponse.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 404 });
  if (Number(request.headers.get("content-length")) > 50_000) return new NextResponse(null, { status: 413 });
  const parsed = startBoardSessionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Last boardet på nytt før du starter samtalen." }, { status: 400 });
  const checked = await boardSource(parsed.data.customer, parsed.data.projectSlug, parsed.data.contentVersion);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: checked.status });
  const { response, payload } = await serviceJson("/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  const session = response.headers.get("x-anja-session");
  if (!response.ok || !session) return NextResponse.json(payload, { status: response.status });
  const result = NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  result.cookies.set(boardCapabilityCookie(issueBoardCapability({
    session,
    customer: parsed.data.customer,
    projectSlug: parsed.data.projectSlug,
    contentVersion: parsed.data.contentVersion,
  })));
  return result;
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 404 });
  const checked = await boardCapability(request);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: checked.status });
  const { response, payload } = await serviceJson("/sessions", { method: "DELETE" }, checked.capability.session);
  const result = NextResponse.json(payload, { status: response.status });
  result.cookies.set({ ...boardCapabilityCookie(""), maxAge: 0 });
  return result;
}
