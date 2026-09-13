import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { realtimeModel, realtimeSessionConfig } from '@/lib/realtime/session-config';
import { getNyhavnaSnapshot } from '@/lib/demo/nyhavna-leve/snapshot';
import { createNyhavnaKnowledge, nyhavnaInstructions, nyhavnaTools } from '@/lib/realtime/nyhavna-knowledge';
import { connectSideband, getSupervisor } from '@/lib/realtime/sideband';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const bodySchema = z.object({ sdp: z.string().startsWith('v=0').max(32000), snapshotId: z.string().max(150), mode: z.enum(['voice', 'text']).default('voice'), context: z.string().max(12000).optional() });
function localRequest(request: NextRequest) {
  let url: URL;
  try { url = new URL(`${request.nextUrl.protocol}//${request.headers.get('host') || request.nextUrl.host}`); } catch { return false; }
  const enabled = process.env.NODE_ENV !== 'production' || process.env.PLACY_LOCAL_REALTIME_DEMO === '1';
  return enabled && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && (!request.headers.get('origin') || request.headers.get('origin') === url.origin);
}
export async function GET(request: NextRequest) {
  if (!localRequest(request)) return new NextResponse(null, { status: 404 });
  try {
    const snapshot = await getNyhavnaSnapshot();
    return NextResponse.json({ configured: Boolean(process.env.OPENAI_API_KEY), model: realtimeModel(), snapshotId: snapshot.snapshotId, serverControlled: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Demoens datagrunnlag kunne ikke lastes.' }, { status: 503 }); }
}
export async function DELETE(request: NextRequest) {
  if (!localRequest(request)) return new NextResponse(null, { status: 404 });
  const token = request.headers.get('x-placy-session');
  if (!token || token.length > 100) return new NextResponse(null, { status: 400 });
  try { return NextResponse.json({ ended: await getSupervisor().end(token) }); }
  catch { return NextResponse.json({ error: 'Samtalen kunne ikke avsluttes. Prøv igjen.' }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  if (!localRequest(request)) return new NextResponse(null, { status: 404 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'Tale er ikke koblet til. Kontroller den lokale API-konfigurasjonen.' }, { status: 503 });
  if (Number(request.headers.get('content-length')) > 50000) return new NextResponse(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 50000) return new NextResponse(null, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Ugyldig forespørsel.' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Last boardet på nytt før du starter samtalen.' }, { status: 400 });
  let snapshot: Awaited<ReturnType<typeof getNyhavnaSnapshot>>;
  try { snapshot = await getNyhavnaSnapshot(); } catch { return NextResponse.json({ error: 'Demoens datagrunnlag kunne ikke lastes.' }, { status: 503 }); }
  if (snapshot.snapshotId !== parsed.data.snapshotId) return NextResponse.json({ error: 'Datagrunnlaget er oppdatert. Last boardet på nytt.' }, { status: 409 });
  const supervisor = getSupervisor();
  let token: string;
  try { token = await supervisor.reserve(); } catch { return NextResponse.json({ error: 'En samtale er aktiv, eller serveren venter på opprydding. Avslutt samtalen og prøv igjen.' }, { status: 429 }); }
  const { sdp, mode } = parsed.data;
  const instructions = nyhavnaInstructions(snapshot.board);
  const form = new FormData();
  form.set('sdp', sdp);
  form.set('session', JSON.stringify(realtimeSessionConfig(instructions, nyhavnaTools, mode)));
  let identityKnown = false;
  try {
    // Do not abort this request midway: the returned call identity is needed to clean up a client abort.
    const upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST', body: form, headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, signal: AbortSignal.timeout(25000),
    });
    if (!upstream.ok) {
      identityKnown = true; // An explicit rejected request did not establish a call.
      const detail = await upstream.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
      const noCredit = detail.error?.type === 'insufficient_quota' || ['insufficient_quota', 'credit_balance_exhausted'].includes(detail.error?.code ?? '');
      await supervisor.end(token);
      return NextResponse.json({ error: noCredit ? 'OpenAI-prosjektet mangler API-kreditt.' : 'Samtaletjenesten kunne ikke starte. Prøv igjen.', ...(noCredit ? { code: 'insufficient_quota' } : {}) }, { status: 502 });
    }
    const callId = upstream.headers.get('location')?.split('/').pop();
    if (!callId || !/^rtc_[a-zA-Z0-9_-]+$/.test(callId)) { await supervisor.blockUnknown(token); throw new Error('Call identity missing'); }
    identityKnown = true;
    await supervisor.attach(token, callId);
    if (request.signal.aborted) { await supervisor.end(token); return new NextResponse(null, { status: 499 }); }
    await connectSideband(callId, token, createNyhavnaKnowledge(snapshot.board));
    const answer = await upstream.text();
    if (request.signal.aborted) { await supervisor.end(token); return new NextResponse(null, { status: 499 }); }
    return new NextResponse(answer, { headers: { 'Content-Type': 'application/sdp', 'Cache-Control': 'no-store', 'X-Placy-Session': token } });
  } catch {
    // A network timeout can hide a successful creation. Block admission until upstream status is checked.
    if (!identityKnown) await supervisor.blockUnknown(token).catch(() => {});
    await supervisor.end(token).catch(() => {});
    return NextResponse.json({ error: 'Samtalen kunne ikke klargjøres. Prøv igjen, eller bruk kartet.' }, { status: 503 });
  }
}
