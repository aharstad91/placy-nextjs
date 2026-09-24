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
import { consumeDemoQuota } from '@/lib/demo/site-chat/usage';
import { demoVoiceVisitor } from '@/lib/live/demo-voice-access';
import { hostedChatAdmission } from '@/lib/live/hosted-chat';
import { siteChatCustomerForDataset } from '@/lib/demo/site-chat/customers';
import { transcriptScope, type SiteChatProfile } from '@/lib/demo/site-chat/profile';
import {
  CHAT_SURFACE, chatSurfaceBackendAddendum, CHAT_SURFACE_CONTINUED_BACKEND_ADDENDUM, chatSurfaceConversation,
  chatSurfaceHistoryInput, chatSurfaceTools, chatSurfaceVoiceInstructions,
} from '@/lib/live/chat-surface';
import { MAX_TRANSCRIPT_TOKEN_LENGTH, verifyTranscript, type VerifiedTranscript } from '@/lib/demo/site-chat/transcript';
import { startVoiceHandoff } from '@/lib/demo/site-chat/voice-handoff';

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
  // Flaten stemmen snakker fra. Utelatt = boardet med kart; `chat` = chatboksen
  // uten kart (lib/live/chat-surface.ts).
  surface: z.literal(CHAT_SURFACE).optional(),
  // Tekstchattens signerte historikktoken (bare chatflaten). Verifiseres mot
  // den besøkende og datasettet; klientens egne bobler brukes aldri.
  transcript: z.string().max(MAX_TRANSCRIPT_TOKEN_LENGTH).optional(),
});

/**
 * Hva talen fikk med seg fra tekstchatten. `rejected` = et token ble sendt,
 * men kunne ikke brukes (annen besøkende, ugyldig signatur, eldre innhold,
 * ingen demotilgang); UI-et sier det, og talen starter uten historikk.
 */
type ChatContinuity = { status: 'carried'; turns: number; trimmed: boolean } | { status: 'none' | 'rejected' };

function chatContinuity(token: string | undefined, visitorId: string | null, snapshotId: string, customer: SiteChatProfile): { continuity: ChatContinuity; verified: VerifiedTranscript | null } {
  if (!token) return { continuity: { status: 'none' }, verified: null };
  // Tokenet må være signert for AKKURAT denne kunden og dette datasettet.
  const verified = visitorId ? verifyTranscript(token, visitorId, transcriptScope(customer)) : null;
  if (!verified || verified.snapshotId !== snapshotId) return { continuity: { status: 'rejected' }, verified: null };
  if (!verified.turns.length) return { continuity: { status: 'none' }, verified };
  return { continuity: { status: 'carried', turns: verified.turns.length, trimmed: verified.trimmed }, verified };
}

/** Datasettet forespørselen gjelder, eller null hvis den ba om et ukjent. */
function requestedDataset(value: string | null | undefined) {
  const id = value ?? DEFAULT_LIVE_DATASET;
  return isLiveDataset(id) ? id : null;
}


export async function GET(request: NextRequest) {
  const hosted = hostedVoiceEnabled();
  const access = hosted ? requestDemoAccess(request) : null;
  const surface = request.nextUrl.searchParams.get('surface');
  const demoVisitor = hosted ? null : demoVoiceVisitor(request, { dataset: request.nextUrl.searchParams.get('dataset'), surface });
  if (hosted ? !access : !localRequest(request) && !demoVisitor) return new NextResponse(null, { status: 404 });
  // Chatflaten finnes for kundene i chatboks-registeret. På den delte stemmen
  // bare for en kunde med binding der og med kundens egen tilgang
  // (`lib/live/hosted-chat.ts`). Avvisning gir en synlig feil, ikke et kart.
  const hostedChat = hosted && surface === CHAT_SURFACE ? hostedChatAdmission(request, request.nextUrl.searchParams.get('dataset')) : null;
  if (surface !== null && (surface !== CHAT_SURFACE || (hosted ? !hostedChat : !siteChatCustomerForDataset(request.nextUrl.searchParams.get('dataset'))))) {
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  if (hostedChat) {
    try {
      const customer = hostedChat.customer;
      const resolved = await resolveVoiceProject({ project: customer.voice.hosted!.project, dataset: customer.dataset }, access?.role === 'benchmark' ? 'benchmark' : 'public');
      if (resolved.demo.id !== customer.dataset) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
      return NextResponse.json({
        configured: Boolean(process.env.OPENAI_API_KEY),
        voiceModel: liveModel(), voice: liveVoice(), backendModel: backendModel(),
        dataset: resolved.demo.id, snapshotId: resolved.demo.snapshotId,
        protocol: 'live', project: resolved.slug, surface: CHAT_SURFACE, transport: 'websocket', warningMs: 26 * 60 * 1000,
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof VoiceProjectError && error.kind === 'not_found') return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
      console.error('hosted_chat_voice_project_load_failed', error instanceof VoiceProjectError ? error.kind : 'unknown');
      return NextResponse.json({ error: 'Samtalen er midlertidig utilgjengelig. Prøv igjen om litt.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }
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
  if (!localRequest(request) && !demoVoiceVisitor(request)) return new NextResponse(null, { status: 404 });
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
  const local = localRequest(request);
  // Utenfor loopback kan bare besøkende hos en kunde i chatboks-registeret
  // slippe inn, etter kundens egen tilgang; det avgjøres endelig først når
  // datasettet er lest. Ellers er ruta 404.
  if (!local && !demoVoiceVisitor(request)) return new NextResponse(null, { status: 404 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'Tale er ikke koblet til. Kontroller den lokale API-konfigurasjonen.' }, { status: 503 });
  // SDP (≤32 000) + historikktoken (≤24 576) + omslag.
  if (Number(request.headers.get('content-length')) > 64000) return new NextResponse(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 64000) return new NextResponse(null, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Ugyldig forespørsel.' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Last boardet på nytt før du starter samtalen.' }, { status: 400 });
  const datasetId = requestedDataset(parsed.data.dataset);
  const demoVisitor = demoVoiceVisitor(request, { dataset: datasetId, surface: parsed.data.surface ?? null });
  if (!local && !demoVisitor) return new NextResponse(null, { status: 404 });
  if (!datasetId) return NextResponse.json({ error: 'Ukjent datasett. Last boardet på nytt.' }, { status: 400 });
  const chat = parsed.data.surface === CHAT_SURFACE;
  const customer = chat ? siteChatCustomerForDataset(datasetId) : null;
  if (chat && !customer) return NextResponse.json({ error: 'Talesamtale i chatten finnes ikke for dette datasettet.' }, { status: 400 });
  let demo: LiveDemo;
  try { demo = await loadLiveDemo(datasetId); } catch (error) {
    console.error('live_dataset_load_failed', error);
    return NextResponse.json({ error: 'Demoens datagrunnlag kunne ikke lastes.' }, { status: 503 });
  }
  if (demo.snapshotId !== parsed.data.snapshotId) return NextResponse.json({ error: 'Datagrunnlaget er oppdatert. Last boardet på nytt.' }, { status: 409 });
  // Historikken bindes til samme besøkende som tekstchatten (kopiens egen
  // cookie, eller `local` på en ukonfigurert utviklingsserver), aldri til noe
  // klienten påstår.
  const chatVisitor = customer ? customer.visitor(request) : null;
  let { continuity, verified } = customer
    ? chatContinuity(parsed.data.transcript, chatVisitor?.visitorId ?? null, demo.snapshotId, customer)
    : { continuity: null, verified: null };
  let continued = continuity?.status === 'carried';
  const supervisor = getLiveSupervisor();
  let token: string;
  try { token = await supervisor.reserve(); } catch { return NextResponse.json({ error: 'En samtale er aktiv, eller serveren venter på opprydding. Avslutt samtalen og prøv igjen.' }, { status: 429 }); }
  // Kundedemoens døgnkvote trekkes først ETTER en vellykket reservasjon: en
  // opptatt plass skal ikke koste kvote. Avvises kvoten, gis reservasjonen
  // tilbake med samme opprydding som resten av ruta.
  if (demoVisitor) {
    const quota = await consumeDemoQuota(demoVisitor.visitorId, demoVisitor.meter);
    if (!quota.allowed) {
      await supervisor.end(token).catch(() => {});
      return NextResponse.json({ error: quota.reason === 'store' ? 'Samtalen er midlertidig utilgjengelig. Bruk kartet eller tekstchatten.' : 'Dagens samtaler i demoen er brukt opp. Bruk kartet eller tekstchatten, eller prøv igjen i morgen.' }, { status: quota.reason === 'store' ? 503 : 429 });
    }
  }
  // Instruksene avhenger av om historikken faktisk ble med; se reserveforsøket under.
  const backendFor = (withHistory: boolean) => customer
    ? `${demo.backendInstructions}\n\n${chatSurfaceBackendAddendum(customer.voice)}${withHistory ? `\n${CHAT_SURFACE_CONTINUED_BACKEND_ADDENDUM}` : ''}`
    : demo.backendInstructions;
  const sessionFor = (withHistory: boolean) => {
    const session = customer
      ? liveSessionConfig(chatSurfaceVoiceInstructions(customer.voice, { continued: withHistory }), backendFor(withHistory), chatSurfaceTools(demo.tools), parsed.data.voice)
      : liveSessionConfig(demo.voiceInstructions ?? NYHAVNA_VOICE_INSTRUCTIONS, backendFor(false), demo.tools, parsed.data.voice);
    session.delegation.responses.parallel_tool_calls = demo.parallelTools ?? true;
    // Tidligere turer ligger i sesjonen FØR stemmen hilser: Live snakker ikke
    // av seg selv på historikk, hilsenen kommer etterpå som instruks.
    return withHistory && verified ? { ...session, input: chatSurfaceHistoryInput(verified.turns) } : session;
  };
  let identityKnown = false;
  try {
    let created;
    try {
      created = await createLiveSession(sessionFor(continued), parsed.data.sdp);
    } catch (error) {
      // Avviser Live historikken (400, ingen sesjon opprettet), startes talen
      // uten den heller enn ikke i det hele tatt — med ærlig status og ny-samtale-instruks.
      if (!continued || !(error instanceof LiveSessionError) || error.status !== 400 || error.created) throw error;
      console.warn('lb_chat_voice_history_rejected', { code: error.code, turns: verified?.turns.length ?? 0 });
      continuity = { status: 'rejected' };
      continued = false;
      verified = null;
      created = await createLiveSession(sessionFor(false), parsed.data.sdp);
    }
    const backendInstructions = backendFor(continued);
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
    const conversation = chat ? chatSurfaceConversation(demo.createConversation()) : demo.createConversation();
    // Chatflaten har ingen nettleserbro: ingen verktøy skal kunne sendes dit.
    // Opptaket av talens turer (tale → tekst) bindes til sesjonstokenet og den
    // besøkende. Uten besøkende kan ingen handoff utstedes; klienten får da en
    // ærlig feil når den ber om den.
    const recorder = customer && chatVisitor
      ? startVoiceHandoff(token, { scope: transcriptScope(customer), visitorId: chatVisitor.visitorId, snapshotId: demo.snapshotId, baseTurns: verified?.turns ?? [], baseTrimmed: verified?.trimmed ?? false })
      : undefined;
    await connectLiveSideband(created.sessionId, token, conversation, {
      backendInstructions,
      ...(chat ? { browserTools: new Set<string>() } : {}),
      ...(recorder ? { transcript: recorder } : {}),
    });
    if (request.signal.aborted) { await supervisor.end(token); return new NextResponse(null, { status: 499 }); }
    return NextResponse.json(
      { sdp: created.sdp, sessionId: created.sessionId, ...(continuity ? { continuity } : {}) },
      { headers: { 'Cache-Control': 'no-store', 'X-Placy-Session': token } },
    );
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
