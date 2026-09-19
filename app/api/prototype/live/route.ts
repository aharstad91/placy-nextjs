import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hostedVoiceEnabled, requestDemoAccess } from '@/lib/live/hosted-access';
import { LIVE_VOICES } from '@/lib/live/voices';
import { backendModel, liveModel, liveSessionConfig, liveVoice } from '@/lib/live/session-config';
import { createLiveSession, LiveSessionError } from '@/lib/live/create-session';
import { connectLiveSideband } from '@/lib/live/sideband';
import { getLiveSupervisor } from '@/lib/live/supervisor';
import { LIVE_SESSION_ID } from '@/lib/live/hangup';
import { NYHAVNA_VOICE_INSTRUCTIONS } from '@/lib/live/voice-instructions';
import { localRequest } from '@/lib/live/local-request';
import { DEFAULT_LIVE_DATASET, isLiveDataset, loadLiveDemo, type LiveDemo } from '@/lib/live/demos';
import { resolveVoiceProject, VoiceProjectError } from '@/lib/live/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ingen `mode`, ingen `context`, ingen `tools`: Live har ikke tekstmodus, og
// instruksene kommer fra serveren.
// `dataset` velger datagrunnlaget (se lib/live/demos.ts). Utelatt = den frosne
// Nyhavna-demoen, som er den eneste som fantes før 2026-09-13.
const bodySchema = z.object({
  voice: z.enum(LIVE_VOICES).optional(),
  sdp: z.string().startsWith('v=0').max(32000),
  snapshotId: z.string().max(150),
  dataset: z.string().max(60).optional(),
});

/** Datasettet forespørselen gjelder, eller null hvis den ba om et ukjent. */
function requestedDataset(value: string | null | undefined) {
  const id = value ?? DEFAULT_LIVE_DATASET;
  return isLiveDataset(id) ? id : null;
}


export async function GET(request: NextRequest) {
  const hosted = hostedVoiceEnabled();
  const access = hosted ? requestDemoAccess(request) : null;
  if (hosted ? !access : !localRequest(request)) return new NextResponse(null, { status: 404 });
  if (hosted) {
    try {
      const project = request.nextUrl.searchParams.get('project') ?? undefined;
      const dataset = request.nextUrl.searchParams.get('dataset') ?? undefined;
      const resolved = await resolveVoiceProject(
        { ...(project ? { project } : {}), ...(dataset ? { dataset } : {}) },
        access?.role === 'benchmark' ? 'benchmark' : 'public',
      );
      return NextResponse.json({
        configured: Boolean(process.env.OPENAI_API_KEY),
        voiceModel: liveModel(), voice: liveVoice(), backendModel: backendModel(),
        dataset: resolved.demo.id, snapshotId: resolved.demo.snapshotId,
        protocol: 'live', project: resolved.slug, transport: 'websocket', warningMs: 26 * 60 * 1000,
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof VoiceProjectError && error.kind === 'not_found') {
        return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
      }
      console.error('hosted_voice_project_load_failed', error);
      return NextResponse.json({ error: 'Prosjektet er midlertidig utilgjengelig. Prøv igjen om litt.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }
  const dataset = requestedDataset(request.nextUrl.searchParams.get('dataset'));
  if (!dataset) return NextResponse.json({ error: 'Ukjent datasett.' }, { status: 400 });
  try {
    const demo = await loadLiveDemo(dataset);
    return NextResponse.json(
      { configured: Boolean(process.env.OPENAI_API_KEY), voiceModel: liveModel(), voice: liveVoice(), backendModel: backendModel(), dataset: demo.id, snapshotId: demo.snapshotId, protocol: 'live' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Datasettets egne feilmeldinger peker på fil og felt; de er verdt å se i
    // terminalen når demoen fylles med innhold.
    console.error('live_dataset_load_failed', error);
    return NextResponse.json({ error: 'Demoens datagrunnlag kunne ikke lastes.' }, { status: 503 });
  }
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
  const datasetId = requestedDataset(parsed.data.dataset);
  if (!datasetId) return NextResponse.json({ error: 'Ukjent datasett. Last boardet på nytt.' }, { status: 400 });
  let demo: LiveDemo;
  try { demo = await loadLiveDemo(datasetId); } catch (error) {
    console.error('live_dataset_load_failed', error);
    return NextResponse.json({ error: 'Demoens datagrunnlag kunne ikke lastes.' }, { status: 503 });
  }
  if (demo.snapshotId !== parsed.data.snapshotId) return NextResponse.json({ error: 'Datagrunnlaget er oppdatert. Last boardet på nytt.' }, { status: 409 });
  const supervisor = getLiveSupervisor();
  let token: string;
  try { token = await supervisor.reserve(); } catch { return NextResponse.json({ error: 'En samtale er aktiv, eller serveren venter på opprydding. Avslutt samtalen og prøv igjen.' }, { status: 429 }); }
  const backendInstructions = demo.backendInstructions;
  let identityKnown = false;
  try {
    const session = liveSessionConfig(demo.voiceInstructions ?? NYHAVNA_VOICE_INSTRUCTIONS, backendInstructions, demo.tools, parsed.data.voice);
    session.delegation.responses.parallel_tool_calls = demo.parallelTools ?? true;
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
    const conversation = demo.createConversation();
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
