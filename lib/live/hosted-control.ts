import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import { z } from 'zod';
import { createVoiceLedger, type VoiceSession } from '@/lib/live/metering';
import { createLiveSession, LiveSessionError } from '@/lib/live/create-session';
import { liveHangup, LIVE_SESSION_ID } from '@/lib/live/hangup';
import { createMapBridge } from '@/lib/live/map-bridge';
import { connectLiveSideband, type LiveSidebandHandle, type SidebandMeteringEvent } from '@/lib/live/sideband';
import { resolveVoiceProject } from '@/lib/live/projects';
import { backendModel, liveModel, liveSessionConfig, liveVoice } from '@/lib/live/session-config';
import type { DemoAccess } from '@/lib/live/hosted-access';
import type { LiveEndReason, LiveServerMessage } from '@/lib/live/types';
import { NO_HOSTED_CHAT, type HostedChatVisitors } from '@/lib/live/hosted-chat';
import { siteChatCustomerForDataset } from '@/lib/demo/site-chat/customers';
import { transcriptScope, type SiteChatProfile } from '@/lib/demo/site-chat/profile';
import { consumeDemoQuota } from '@/lib/demo/site-chat/usage';
import { MAX_TRANSCRIPT_TOKEN_LENGTH, verifyTranscript, type VerifiedTranscript } from '@/lib/demo/site-chat/transcript';
import { createVoiceRecording, type VoiceRecording } from '@/lib/demo/site-chat/voice-handoff';
import {
  CHAT_SURFACE_CONTINUED_BACKEND_ADDENDUM, chatSurfaceBackendAddendum, chatSurfaceConversation, chatSurfaceHistoryInput,
  chatSurfaceTools, chatSurfaceVoiceInstructions,
} from '@/lib/live/chat-surface';

const contextSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('theme'), id: z.string().max(120), label: z.string().max(120).optional() }),
  z.object({ kind: z.literal('place'), id: z.string().max(120), name: z.string().max(160).optional() }),
  z.object({ kind: z.literal('state'), selected_category_id: z.string().max(120).nullable(), selected_place_id: z.string().max(120).nullable(), travel_mode: z.enum(['walk','bike','car']), revealed_place_ids: z.array(z.string().max(120)).max(500).optional() }),
  z.object({ kind: z.literal('text'), text: z.string().max(2000) }),
]);
const label = z.string().regex(/^[a-zA-Z0-9_.:-]{1,100}$/);
const startSchema = z.object({ type: z.literal('start'), sdp: z.string().startsWith('v=0').max(32000), snapshotId: z.string().max(150), project: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).optional(), dataset: z.string().max(100).optional(), voice: z.literal('willow').optional(), testRunId: label.optional(), scenarioId: label.optional(),
  // Chatboksen på en kundes nettside (`lib/live/hosted-chat.ts`). Utelatt = boardet.
  surface: z.literal('chat').optional(), transcript: z.string().max(MAX_TRANSCRIPT_TOKEN_LENGTH).optional() }).strict();
/** SDP (≤32 000) + tekstchattens token (≤24 576) + omslag, som den lokale ruta. */
export const CONTROL_MAX_MESSAGE = 64000;
const messageSchema = z.discriminatedUnion('type', [
  startSchema,
  z.object({ type: z.literal('context'), message: contextSchema }).strict(),
  z.object({ type: z.literal('map_result'), id: z.string().max(150), output: z.unknown() }).strict(),
  z.object({ type: z.literal('stop') }).strict(),
]);
const endMessages: Record<LiveEndReason,string> = {
  manual:'Samtalen er avsluttet.', limit:'Samtalen nådde tidsgrensen. Du kan starte en ny samtale.',
  idle:'Samtalen ble avsluttet fordi det var stille en stund.', connection:'Forbindelsen ble brutt. Du kan starte en ny samtale.',
  error:'Samtalen kunne ikke fortsette. Prøv igjen senere, eller bruk kartet.',
};

export interface HostedControlDependencies {
  ledger: ReturnType<typeof createVoiceLedger>;
  createSession: typeof createLiveSession;
  hangup: typeof liveHangup;
  connect: typeof connectLiveSideband;
  resolveProject: typeof resolveVoiceProject;
  /** Chatboks-registeret og kundens stemmekvote (bare chatflaten). */
  chatCustomer: typeof siteChatCustomerForDataset;
  consumeChatVoiceQuota: typeof consumeDemoQuota;
}

/** Hva talen fikk med seg fra tekstchatten; samme statuser som den lokale ruta. */
type ChatContinuity = { status: 'carried'; turns: number; trimmed: boolean } | { status: 'none' | 'rejected' };

const QUOTA_ERRORS = {
  limit: 'Dagens samtaler i chatten er brukt opp. Skriv i stedet, eller prøv igjen i morgen.',
  store: 'Samtalen er midlertidig utilgjengelig. Skriv i stedet, eller prøv igjen om litt.',
};

/**
 * Each upgraded connection owns its tools and map bridge; only the ledger is shared.
 * `chatVisitors` is decided once from the upgrade request's cookies; without it
 * the chat surface is never admitted.
 */
export function runHostedControl(socket: WebSocket, access: DemoAccess, overrides: Partial<HostedControlDependencies> = {}, chatVisitors: HostedChatVisitors = NO_HOSTED_CHAT): Promise<void> {
  const deps: HostedControlDependencies = { ledger:createVoiceLedger(),createSession:createLiveSession,hangup:liveHangup,connect:connectLiveSideband,resolveProject:resolveVoiceProject,
    chatCustomer:siteChatCustomerForDataset,consumeChatVoiceQuota:consumeDemoQuota,...overrides };
  const ownerToken = randomUUID();
  const bridge = createMapBridge();
  let session: VoiceSession | undefined;
  let providerId: string | undefined;
  let providerClosed = false;
  let providerAttempted = false;
  let creationRejected = false;
  let finalUsageConfirmed = false;
  let meteringFailed = false;
  let closing = false;
  let reason: LiveEndReason = 'connection';
  let handle: LiveSidebandHandle | undefined;
  let cleanup: ((reason: string) => void) | undefined;
  let startPromise: Promise<void> | undefined;
  let finishPromise: Promise<void> | undefined;
  let meterQueue = Promise.resolve();
  let meterPending = 0;
  let lastPong = Date.now();
  let messageWindow = Date.now();
  let messageCount = 0;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let heartbeatBusy = false;
  // Chatflaten: opptaket av talen og den besøkende det tilhører. Tokenet sendes
  // tilbake på denne forbindelsen før den lukkes, aldri via et annet kall.
  let recording: VoiceRecording | undefined;
  let chatVisitorId: string | null = null;
  let ready = false;
  let startError = 'Samtalen kunne ikke starte. Last siden på nytt og prøv igjen om litt.';
  let resolveDone!: () => void;
  const done = new Promise<void>(resolve => { resolveDone = resolve; });
  const owned = () => ({sessionId:session!.id,ownerToken});
  const send = (message: unknown) => { if(socket.readyState === 1) socket.send(JSON.stringify(message)); };
  const admissionTimer = setTimeout(() => { void requestEnd('connection'); }, 30000);
  const heartbeat = setInterval(() => {
    if (closing) return;
    if (Date.now() - lastPong > 45000) { void requestEnd('connection'); return; }
    socket.ping();
    if (!session || heartbeatBusy) return;
    heartbeatBusy = true;
    void deps.ledger.heartbeat(owned()).then(checkBudget).catch(() => { meteringFailed = true; void requestEnd('error'); }).finally(() => { heartbeatBusy = false; });
  }, 20000);
  admissionTimer.unref?.(); heartbeat.unref?.();

  function checkBudget(updated: VoiceSession) {
    if (updated.known_cost_usd >= updated.reservation_usd) void requestEnd('limit');
  }
  function enqueue(write: () => Promise<VoiceSession>) {
    if (++meterPending > 64) { meteringFailed = true; void requestEnd('error'); return; }
    meterQueue = meterQueue.then(async () => {
      if (!meteringFailed) checkBudget(await write());
    }).catch(() => { meteringFailed = true; void requestEnd('error'); }).finally(() => { meterPending -= 1; });
  }
  function onMeteringEvent(event: SidebandMeteringEvent) {
    if (!session) return;
    if (event.type === 'voice.snapshot') {
      if (event.final) providerClosed = true;
      if (event.seconds !== null) enqueue(() => deps.ledger.recordVoiceUsage({...owned(),seconds:event.seconds!}));
    } else if (event.type === 'backend.terminal') {
      if (event.responseId) enqueue(() => deps.ledger.recordUsageEvent({...owned(),responseId:event.responseId!,model:event.model,usage:event.usage}));
    } else if (event.type === 'finalized') finalUsageConfirmed = event.complete;
  }

  function finish(): Promise<void> {
    if (finishPromise) return finishPromise;
    finishPromise = (async () => {
      closing = true;
      clearInterval(heartbeat); clearTimeout(admissionTimer); clearTimeout(deadline);
      cleanup?.(reason);
      if (providerId && !providerClosed) {
        try { await deps.hangup(providerId); providerClosed = true; }
        catch { /* Durable lease remains recoverable; never claim confirmed termination. */ }
      }
      await meterQueue;
      if (session) {
        try {
          await deps.ledger.finalize({...owned(),terminationReason:reason,providerClosed,
            finalUsageConfirmed:finalUsageConfirmed && !meteringFailed,
            neverCreated:!providerAttempted,creationRejected});
        } catch {
          // No raw errors, provider contents, credentials or conversation fragments.
          console.error('voice_finalization_pending', {sessionId:session.id});
        }
      }
      bridge.close();
      if (recording && chatVisitorId && ready) {
        const handoff = recording.issue(chatVisitorId);
        send(handoff.ok ? {type:'handoff',status:'ready',transcript:handoff.transcript,voiceTurns:handoff.voiceTurns,trimmed:handoff.trimmed} : {type:'handoff',status:'failed'});
      }
      send({type:'ended',reason,message:endMessages[reason]});
      socket.close(1000,'conversation ended');
      resolveDone();
    })();
    return finishPromise;
  }

  async function requestEnd(nextReason: LiveEndReason) {
    if (!closing) reason = nextReason;
    closing = true;
    if (startPromise) await startPromise.catch(() => {});
    if (handle && !finishPromise) await handle.end(reason);
    await finish();
  }

  bridge.subscribe((message: LiveServerMessage) => {
    if(message.type === 'ended') { if (!closing) reason = message.reason; return; }
    if(!closing) send(message);
  });

  async function start(input: z.infer<typeof startSchema>) {
    clearTimeout(admissionTimer);
    if (access.role !== 'benchmark' && (input.testRunId || input.scenarioId)) throw new Error('test_authorization');
    const chat = input.surface === 'chat';
    let customer: SiteChatProfile | null = null;
    if (chat) {
      // Chatflaten: bare en registrert kunde med binding i den delte stemmen, og
      // bare for kundens egen besøkende. Prosjektet velges av kundens profil,
      // aldri av nettleseren; et annet prosjekt eller et testløp avvises.
      customer = deps.chatCustomer(input.dataset);
      if (!customer?.voice.hosted || input.testRunId || input.scenarioId
        || (input.project !== undefined && input.project !== customer.voice.hosted.project)) throw new Error('chat_surface');
      chatVisitorId = chatVisitors.visitorFor(customer.id);
      if (!chatVisitorId) throw new Error('chat_access');
    } else if (input.transcript !== undefined) throw new Error('transcript_without_chat');
    const selection = customer
      ? {project:customer.voice.hosted!.project,dataset:customer.dataset}
      : {...(input.project === undefined ? {} : {project:input.project}),...(input.dataset === undefined ? {} : {dataset:input.dataset})};
    const resolved = await deps.resolveProject(selection,access.role === 'benchmark' ? 'benchmark' : 'public');
    const demo = resolved.demo;
    if (closing) return;
    if (demo.snapshotId !== input.snapshotId) throw new Error('snapshot');
    // Eksakt binding: bindingens innhold må være kundens eget datasett.
    if (customer && demo.id !== customer.dataset) throw new Error('chat_binding');
    if (liveModel() !== 'gpt-live-1' || backendModel() !== 'gpt-5.6-terra' || liveVoice() !== 'willow') throw new Error('model_config');

    // Tekstchattens token er bundet til kunden, den besøkende og kildens egen
    // innholdsversjon (det tekstendepunktet serverer), ikke prosjektets.
    let continuity: ChatContinuity | null = null;
    let verified: VerifiedTranscript | null = null;
    if (customer) {
      if (!input.transcript) continuity = {status:'none'};
      else {
        const candidate = verifyTranscript(input.transcript, chatVisitorId!, transcriptScope(customer));
        if (!candidate || candidate.snapshotId !== resolved.contentSnapshotId) continuity = {status:'rejected'};
        else if (!candidate.turns.length) { continuity = {status:'none'}; verified = candidate; }
        else { continuity = {status:'carried',turns:candidate.turns.length,trimmed:candidate.trimmed}; verified = candidate; }
      }
    }
    const backendFor = (withHistory: boolean) => customer
      ? `${demo.backendInstructions}\n\n${chatSurfaceBackendAddendum(customer.voice)}${withHistory ? `\n${CHAT_SURFACE_CONTINUED_BACKEND_ADDENDUM}` : ''}`
      : demo.backendInstructions;
    const configFor = (withHistory: boolean) => {
      const config = customer
        ? liveSessionConfig(chatSurfaceVoiceInstructions(customer.voice,{continued:withHistory}),backendFor(withHistory),chatSurfaceTools(demo.tools))
        : liveSessionConfig(demo.voiceInstructions ?? '', demo.backendInstructions, demo.tools);
      config.delegation.responses.parallel_tool_calls = demo.parallelTools ?? true;
      return config;
    };
    let continued = continuity?.status === 'carried';
    // The config version names instructions and tools, never conversation content.
    const configuration = configFor(continued);
    const configVersion = createHash('sha256').update(JSON.stringify(configuration)).digest('hex');
    const withInput = (config: ReturnType<typeof configFor>, history: boolean) =>
      history && verified ? {...config,input:chatSurfaceHistoryInput(verified.turns)} : config;
    const environment = process.env.VERCEL_ENV === 'production' ? 'production' : process.env.VERCEL_ENV === 'preview' ? 'preview' : 'development';
    session = await deps.ledger.reserve({tenantId:resolved.tenant.id,ownerToken,environment,configVersion,datasetVersion:demo.snapshotId,
      models:{voice:'gpt-live-1',backend:'gpt-5.6-terra',speaker:'willow'},testRunId:input.testRunId,scenarioId:input.scenarioId});
    if (closing) { await finish(); return; }
    if (customer) {
      // Kundens egen døgnkvote i tillegg til prosjektets budsjett i registeret.
      // Trekkes etter en vellykket reservasjon, og feiler lukket.
      const quota = await deps.consumeChatVoiceQuota(chatVisitorId!, customer.voice.meter);
      if (!quota.allowed) {
        startError = quota.reason === 'store' ? QUOTA_ERRORS.store : QUOTA_ERRORS.limit;
        throw new Error('chat_quota');
      }
      if (closing) { await finish(); return; }
    }
    await deps.ledger.markCreating(owned());
    if (closing) {
      await finish(); return;
    }
    providerAttempted = true;
    let created;
    try {
      created = await deps.createSession(withInput(configuration,continued),input.sdp);
    } catch (error) {
      // Avviser Live historikken (400, ingen sesjon opprettet), startes talen
      // uten den — med ærlig status og ny-samtale-instruks.
      if (!continued || !(error instanceof LiveSessionError) || error.status !== 400 || error.created) throw error;
      continuity = {status:'rejected'}; continued = false; verified = null;
      created = await deps.createSession(configFor(false),input.sdp);
    }
    if (LIVE_SESSION_ID.test(created.sessionId)) providerId = created.sessionId;
    if (!providerId || (created.model && created.model !== 'gpt-live-1' && !/^gpt-live-1-\d{4}-\d{2}-\d{2}$/.test(created.model))) throw new Error('provider_identity');
    await deps.ledger.bindProvider({...owned(),providerSessionId:providerId});
    if (closing) { await finish(); return; }
    const remaining = Math.min(Date.parse(session.deadline_at)-Date.now(), 28*60*1000);
    if (remaining <= 10000) throw new Error('deadline');
    deadline = setTimeout(() => { void requestEnd('limit'); },remaining);
    deadline.unref?.();
    if (customer) recording = createVoiceRecording({scope:transcriptScope(customer),visitorId:chatVisitorId!,snapshotId:resolved.contentSnapshotId,
      baseTurns:verified?.turns ?? [],baseTrimmed:verified?.trimmed ?? false});
    handle = await deps.connect(providerId,ownerToken,customer ? chatSurfaceConversation(demo.createConversation()) : demo.createConversation(),{
      hosted:true,bridge,backendInstructions:backendFor(continued),onMeteringEvent,
      // Chatflaten har ingen nettleserbro: ingen kartverktøy sendes til nettleseren.
      ...(customer ? {browserTools:new Set<string>(),transcript:recording!.sink} : {}),
      supervisor:{setCleanup:(_token,callback) => {cleanup=callback;},end:async (_token,endReason) => {
        if (!closing && endReason && endReason in endMessages) reason = endReason as LiveEndReason;
        await finish();return true;
      }},
    });
    if (closing) { await handle.end(reason); await finish(); return; }
    ready = true;
    send({type:'ready',sdp:created.sdp,sessionId:session.id,warningMs:Math.max(0,remaining-120000),...(continuity ? {continuity} : {})});
  }

  socket.on('pong', () => {lastPong=Date.now();});
  socket.on('message', raw => {
    if (closing) return;
    if (Date.now()-messageWindow > 1000) {messageWindow=Date.now();messageCount=0;}
    if (++messageCount > 50 || raw.toString().length > CONTROL_MAX_MESSAGE) {void requestEnd('error');return;}
    let parsed: ReturnType<typeof messageSchema.safeParse>;
    try {parsed=messageSchema.safeParse(JSON.parse(raw.toString()));} catch {void requestEnd('error');return;}
    if(!parsed.success) {void requestEnd('error');return;}
    const input=parsed.data;
    if(input.type === 'start') {
      if(startPromise) {void requestEnd('error');return;}
      startPromise=start(input).catch(async error => {
        if(error instanceof LiveSessionError && !error.created) creationRejected=true;
        send({type:'error',message:startError});
        reason='error';await finish();
      });
    } else if (input.type === 'stop') void requestEnd('manual');
    else if(handle && input.type === 'context') {
      handle.onContext(input.message);
    } else if(handle && input.type === 'map_result') bridge.resolve(input.id,input.output);
  });
  socket.on('close', () => {void requestEnd('connection');});
  socket.on('error', () => {void requestEnd('connection');});
  return done;
}
