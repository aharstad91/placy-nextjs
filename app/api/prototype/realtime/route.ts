import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { realtimeSessionConfig } from "@/lib/realtime/session-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sdp: z.string().startsWith("v=0").max(32000),
  instructions: z.string().max(100000),
  mode: z.enum(["voice", "text"]).default("voice"),
  tools: z.array(z.object({
    type: z.literal("function"), name: z.string().regex(/^[a-zA-Z0-9_]+$/).max(64),
    description: z.string().max(3000), parameters: z.record(z.string(), z.unknown()),
  })).max(16),
});

// These are local, deliberately unshipped experiments. Never expose a paid
// unauthenticated session factory if someone later deploys this worktree.
function localRequest(request: NextRequest) {
  // Next dev normalizes request.nextUrl to localhost even when the browser
  // requested 127.0.0.1. Check the actual Host, still restricted to loopback.
  let publicUrl: URL;
  try {
    publicUrl = new URL(`${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`);
  } catch { return false; }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(publicUrl.hostname);
  const origin = request.headers.get("origin");
  return process.env.NODE_ENV !== "production" && local && (!origin || origin === publicUrl.origin);
}

const starts: number[] = [];

export async function GET(request: NextRequest) {
  if (!localRequest(request)) return new NextResponse(null, { status: 404 });
  return NextResponse.json({ configured: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!localRequest(request)) return new NextResponse(null, { status: 404 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Tale er ikke koblet til ennå. Legg OPENAI_API_KEY i .env.local, og prøv igjen." }, { status: 503 });
  }
  const now = Date.now();
  while (starts.length && starts[0] < now - 3600000) starts.shift();
  if (starts.length >= 60) return NextResponse.json({ error: "Prototypens grense på 60 samtalestarter per time er nådd." }, { status: 429 });
  if (Number(request.headers.get("content-length")) > 180000) return new NextResponse(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 180000) return new NextResponse(null, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Samtalen kunne ikke klargjøres. Last siden på nytt." }, { status: 400 });
  starts.push(now);
  const { sdp, instructions, tools, mode } = parsed.data;
  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(realtimeSessionConfig(instructions, tools, mode)));
  try {
    const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST", body: form,
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(25000)]),
    });
    if (!upstream.ok) {
      const detail = await upstream.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
      const noCredit = detail.error?.type === "insufficient_quota" ||
        detail.error?.code === "insufficient_quota" || detail.error?.code === "credit_balance_exhausted";
      const message = noCredit ? "OpenAI-prosjektet mangler tilgjengelig API-kreditt. Aktiver API-fakturering eller fyll på saldo i OpenAI-dashboardet, og prøv igjen."
        : upstream.status === 401 ? "OpenAI-nøkkelen ble avvist. Kontroller .env.local."
        : upstream.status === 429 ? "OpenAI har nådd en kvote eller kapasitetsgrense. Prøv igjen om litt."
        : `OpenAI kunne ikke starte samtalen (${upstream.status}). Kontroller modelltilgang og prøv igjen.`;
      return NextResponse.json({ error: message, ...(noCredit ? { code: "insufficient_quota" } : {}) }, { status: 502 });
    }
    return new NextResponse(await upstream.text(), { headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Fikk ikke kontakt med OpenAI. Kontroller nettet og prøv igjen." }, { status: 504 });
  }
}
