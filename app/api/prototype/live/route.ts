import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { backendModel, liveModel, liveSessionConfig } from '@/lib/live/session-config';
import { createLiveSession, LiveSessionError } from '@/lib/live/create-session';
import { connectLiveSideband } from '@/lib/live/sideband';
import { getLiveSupervisor } from '@/lib/live/supervisor';
import { LIVE_SESSION_ID } from '@/lib/live/hangup';
import { NYHAVNA_VOICE_INSTRUCTIONS } from '@/lib/live/voice-instructions';
import { localRequest } from '@/lib/live/local-request';
import { getNyhavnaSnapshot } from '@/lib/demo/nyhavna-leve/snapshot';
import { nyhavnaInstructions } from '@/lib/realtime/nyhavna-knowledge';
import { createNyhavnaConversation, nyhavnaTools } from '@/lib/realtime/nyhavna-conversation';
import { nyhavnaProjectInfo } from '@/lib/realtime/nyhavna-project-info';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ingen `mode`, ingen `context`, ingen `tools`: Live har ikke tekstmodus, og
// instruksene kommer fra serveren.
const bodySchema = z.object({ sdp: z.string().startsWith('v=0').max(32000), snapshotId: z.string().max(150) });


export async function GET(request: NextRequest) {
  if (!localRequest(request)) return new NextResponse(null, { status: 404 });
  try {
    const snapshot = await getNyhavnaSnapshot();
    return NextResponse.json(
      { configured: Boolean(process.env.OPENAI_API_KEY), voiceModel: liveModel(), backendModel: backendModel(), snapshotId: snapshot.snapshotId, protocol: 'live' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch { return NextResponse.json({ error: 'Demoens datagrunnlag kunne ikke lastes.' }, { status: 503 }); }
}

export async function DELETE(request: NextRequest) {
  if (!localRequest(request)) return new NextResponse(null, { status: 404 });
  const token = request.headers.get('x-placy-session');
  if (!token || token.length > 100) return new NextResponse(null, { status: 400 });
  try { return NextResponse.json({ ended: await getLiveSupervisor().end(token, 'manual') }); }
  catch { return NextResponse.json({ error: 'Samtalen kunne ikke avsluttes. Prøv igjen.' }, { status: 503 }); }
}

/** Feiltekst brukeren kan handle på, uten nøkkel og uten OpenAIs egen melding. */
function upstreamMessage(error: LiveSessionError) {
  if (error.code === 'insufficient_quota' || error.code === 'credit_balance_exhausted') return 'OpenAI-prosjektet mangler API-kreditt.';
  if (error.status === 403 || error.code === 'model_not_found' || error.code === 'unsupported_model') return `Prosjektet har ikke tilgang til ${liveModel()}.`;
  return error.message;
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
  const supervisor = getLiveSupervisor();
  let token: string;
  try { token = await supervisor.reserve(); } catch { return NextResponse.json({ error: 'En samtale er aktiv, eller serveren venter på opprydding. Avslutt samtalen og prøv igjen.' }, { status: 429 }); }
  const backendInstructions = nyhavnaInstructions(snapshot.board);
  let identityKnown = false;
  try {
    const session = liveSessionConfig(NYHAVNA_VOICE_INSTRUCTIONS, backendInstructions, nyhavnaTools);
    const created = await createLiveSession(session, parsed.data.sdp);
    identityKnown = true;
    // Gaten mot en modell som ikke er Live: fortsetter vi her, snakker resten av
    // koden en protokoll sesjonen ikke bruker.
    if (!LIVE_SESSION_ID.test(created.sessionId) || (created.model && !created.model.startsWith('gpt-live'))) {
      await supervisor.blockUnknown(token);
      await supervisor.end(token).catch(() => {});
      return NextResponse.json({ error: 'GPT-Live svarte med en ukjent sesjon. Samtalen ble ikke startet.' }, { status: 503 });
    }
    await supervisor.attach(token, created.sessionId);
    if (request.signal.aborted) { await supervisor.end(token); return new NextResponse(null, { status: 499 }); }
    // Samtaletilstanden lever like lenge som sesjonen: interesser, tema,
    // fremhevede steder og returpunkt ligger her, ikke i modellens historikk.
    const conversation = createNyhavnaConversation(snapshot.board, { projectInfo: nyhavnaProjectInfo });
    await connectLiveSideband(created.sessionId, token, conversation, { backendInstructions });
    if (request.signal.aborted) { await supervisor.end(token); return new NextResponse(null, { status: 499 }); }
    return NextResponse.json({ sdp: created.sdp, sessionId: created.sessionId }, { headers: { 'Cache-Control': 'no-store', 'X-Placy-Session': token } });
  } catch (error) {
    if (error instanceof LiveSessionError) {
      if (error.created) await supervisor.blockUnknown(token).catch(() => {});
      await supervisor.end(token).catch(() => {});
      return NextResponse.json({ error: upstreamMessage(error), code: error.code }, { status: 502 });
    }
    // Et nettverksbrudd kan skjule en opprettet sesjon: sperr oppstart til
    // oppryddingen er bekreftet.
    if (!identityKnown) await supervisor.blockUnknown(token).catch(() => {});
    await supervisor.end(token).catch(() => {});
    return NextResponse.json({ error: 'Samtalen kunne ikke klargjøres. Prøv igjen, eller bruk kartet.' }, { status: 503 });
  }
}
