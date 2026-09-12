import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { realtimeModel } from "@/lib/realtime/session-config";
import { connectSideband, getSupervisor } from "@/lib/realtime/sideband";
import { BOLIG_FIXTURE } from "@/lib/prototype/bolig/fixture";
import { BROWSER_TOOLS, createBoligKnowledge } from "@/lib/prototype/bolig/knowledge";
import { BOLIG_SCOPE, boligSessionConfig } from "@/lib/prototype/bolig/session-config";

/**
 * Lokalt, ulevert prototype-endepunkt for bruktbolig-samtalen. Serveren eier
 * kunnskapsverktøy, videreføring, inaktivitetsgrense og opprydding (sideband).
 * Nettleseren eier bare kartmarkering. Ingen nøkler forlater serveren.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ sdp: z.string().startsWith("v=0").max(32000), version: z.number().int(), mode: z.literal("voice").default("voice") });

function localRequest(request: NextRequest) {
  let url: URL;
  try { url = new URL(`${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`); } catch { return false; }
  const enabled = process.env.NODE_ENV !== "production" || process.env.PLACY_LOCAL_REALTIME_DEMO === "1";
  // Telefonprøve: mikrofon krever HTTPS, så én ekstra vert (f.eks. en ngrok-adresse) kan tillates eksplisitt i .env.local.
  const extraHost = process.env.PLACY_REALTIME_EXTRA_HOST?.trim();
  const hostAllowed = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || (Boolean(extraHost) && url.hostname === extraHost);
  return enabled && hostAllowed && (!request.headers.get("origin") || request.headers.get("origin") === url.origin);
}

export async function GET(request: NextRequest) {
  if (!localRequest(request)) return new NextResponse(null, { status: 404 });
  return NextResponse.json({ configured: Boolean(process.env.OPENAI_API_KEY), model: realtimeModel(), version: BOLIG_FIXTURE.version, serverControlled: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest) {
  if (!localRequest(request)) return new NextResponse(null, { status: 404 });
  const token = request.headers.get("x-placy-session");
  if (!token || token.length > 100) return new NextResponse(null, { status: 400 });
  try { return NextResponse.json({ ended: await getSupervisor(BOLIG_SCOPE).end(token) }); }
  catch { return NextResponse.json({ error: "Samtalen kunne ikke avsluttes. Prøv igjen." }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  if (!localRequest(request)) return new NextResponse(null, { status: 404 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Tale er ikke koblet til. Legg OPENAI_API_KEY i .env.local." }, { status: 503 });
  if (Number(request.headers.get("content-length")) > 50000) return new NextResponse(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 50000) return new NextResponse(null, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Last siden på nytt før du starter samtalen." }, { status: 400 });
  if (parsed.data.version !== BOLIG_FIXTURE.version) return NextResponse.json({ error: "Datagrunnlaget er oppdatert. Last siden på nytt." }, { status: 409 });
  const supervisor = getSupervisor(BOLIG_SCOPE);
  let token: string;
  try { token = await supervisor.reserve(); } catch { return NextResponse.json({ error: "En samtale er allerede aktiv, eller serveren rydder opp. Avslutt den og prøv igjen." }, { status: 429 }); }
  const form = new FormData();
  form.set("sdp", parsed.data.sdp);
  form.set("session", JSON.stringify(boligSessionConfig(BOLIG_FIXTURE)));
  let identityKnown = false;
  try {
    const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST", body: form, headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, signal: AbortSignal.timeout(25000),
    });
    if (!upstream.ok) {
      identityKnown = true;
      const detail = await upstream.json().catch(() => ({})) as { error?: { code?: string; type?: string; message?: string } };
      const noCredit = detail.error?.type === "insufficient_quota" || ["insufficient_quota", "credit_balance_exhausted"].includes(detail.error?.code ?? "");
      await supervisor.end(token);
      console.error("bolig realtime upstream", upstream.status, detail.error?.code ?? detail.error?.message ?? "");
      return NextResponse.json({ error: noCredit ? "OpenAI-prosjektet mangler API-kreditt." : upstream.status === 429 ? "OpenAI har nådd en kvote eller kapasitetsgrense. Prøv igjen om litt." : "Samtaletjenesten kunne ikke starte. Prøv igjen." }, { status: 502 });
    }
    const callId = upstream.headers.get("location")?.split("/").pop();
    if (!callId || !/^rtc_[a-zA-Z0-9_-]+$/.test(callId)) { await supervisor.blockUnknown(token); throw new Error("Call identity missing"); }
    identityKnown = true;
    await supervisor.attach(token, callId);
    if (request.signal.aborted) { await supervisor.end(token); return new NextResponse(null, { status: 499 }); }
    await connectSideband(callId, token, createBoligKnowledge(BOLIG_FIXTURE), { scope: BOLIG_SCOPE, browserTools: BROWSER_TOOLS });
    const answer = await upstream.text();
    if (request.signal.aborted) { await supervisor.end(token); return new NextResponse(null, { status: 499 }); }
    return new NextResponse(answer, { headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store", "X-Placy-Session": token } });
  } catch (error) {
    console.error("bolig realtime start failed", error instanceof Error ? error.message : error);
    if (!identityKnown) await supervisor.blockUnknown(token).catch(() => {});
    await supervisor.end(token).catch(() => {});
    return NextResponse.json({ error: "Samtalen kunne ikke klargjøres. Prøv igjen." }, { status: 503 });
  }
}
