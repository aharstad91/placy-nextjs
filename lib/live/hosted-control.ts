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

const contextSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('theme'), id: z.string().max(120), label: z.string().max(120).optional() }),
  z.object({ kind: z.literal('place'), id: z.string().max(120), name: z.string().max(160).optional() }),
  z.object({ kind: z.literal('state'), selected_category_id: z.string().max(120).nullable(), selected_place_id: z.string().max(120).nullable(), travel_mode: z.enum(['walk','bike','car']), revealed_place_ids: z.array(z.string().max(120)).max(500).optional() }),
  z.object({ kind: z.literal('text'), text: z.string().max(2000) }),
]);
const label = z.string().regex(/^[a-zA-Z0-9_.:-]{1,100}$/);
const startSchema = z.object({ type: z.literal('start'), sdp: z.string().startsWith('v=0').max(32000), snapshotId: z.string().max(150), project: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).optional(), dataset: z.string().max(100).optional(), source: z.literal('report').optional(), voice: z.literal('willow').optional(), testRunId: label.optional(), scenarioId: label.optional() }).strict();
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
}

/** Each upgraded connection owns its tools and map bridge; only the ledger is shared. */
export function runHostedControl(socket: WebSocket, access: DemoAccess, overrides: Partial<HostedControlDependencies> = {}): Promise<void> {
  const deps: HostedControlDependencies = { ledger:createVoiceLedger(),createSession:createLiveSession,hangup:liveHangup,connect:connectLiveSideband,resolveProject:resolveVoiceProject,...overrides };
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
    const resolved = await deps.resolveProject({...(input.project === undefined ? {} : {project:input.project}),...(input.dataset === undefined ? {} : {dataset:input.dataset}),...(input.source === undefined ? {} : {source:input.source})},access.role === 'benchmark' ? 'benchmark' : 'public');
    const demo = resolved.demo;
    if (closing) return;
    if (demo.snapshotId !== input.snapshotId) throw new Error('snapshot');
    if (liveModel() !== 'gpt-live-1' || backendModel() !== 'gpt-5.6-terra' || liveVoice() !== 'willow') throw new Error('model_config');
    const configuration = liveSessionConfig(demo.voiceInstructions ?? '', demo.backendInstructions, demo.tools);
    configuration.delegation.responses.parallel_tool_calls = demo.parallelTools ?? true;
    const configVersion = createHash('sha256').update(JSON.stringify(configuration)).digest('hex');
    const environment = process.env.VERCEL_ENV === 'production' ? 'production' : process.env.VERCEL_ENV === 'preview' ? 'preview' : 'development';
    session = await deps.ledger.reserve({tenantId:resolved.tenant.id,ownerToken,environment,configVersion,datasetVersion:demo.snapshotId,
      models:{voice:'gpt-live-1',backend:'gpt-5.6-terra',speaker:'willow'},testRunId:input.testRunId,scenarioId:input.scenarioId});
    if (closing) { await finish(); return; }
    await deps.ledger.markCreating(owned());
    if (closing) {
      await finish(); return;
    }
    providerAttempted = true;
    const created = await deps.createSession(configuration,input.sdp);
    if (LIVE_SESSION_ID.test(created.sessionId)) providerId = created.sessionId;
    if (!providerId || (created.model && created.model !== 'gpt-live-1' && !/^gpt-live-1-\d{4}-\d{2}-\d{2}$/.test(created.model))) throw new Error('provider_identity');
    await deps.ledger.bindProvider({...owned(),providerSessionId:providerId});
    if (closing) { await finish(); return; }
    const remaining = Math.min(Date.parse(session.deadline_at)-Date.now(), 28*60*1000);
    if (remaining <= 10000) throw new Error('deadline');
    deadline = setTimeout(() => { void requestEnd('limit'); },remaining);
    deadline.unref?.();
    handle = await deps.connect(providerId,ownerToken,demo.createConversation(),{
      hosted:true,bridge,backendInstructions:demo.backendInstructions,onMeteringEvent,
      supervisor:{setCleanup:(_token,callback) => {cleanup=callback;},end:async (_token,endReason) => {
        if (!closing && endReason && endReason in endMessages) reason = endReason as LiveEndReason;
        await finish();return true;
      }},
    });
    if (closing) { await handle.end(reason); await finish(); return; }
    send({type:'ready',sdp:created.sdp,sessionId:session.id,warningMs:Math.max(0,remaining-120000)});
  }

  socket.on('pong', () => {lastPong=Date.now();});
  socket.on('message', raw => {
    if (closing) return;
    if (Date.now()-messageWindow > 1000) {messageWindow=Date.now();messageCount=0;}
    if (++messageCount > 50 || raw.toString().length > 50000) {void requestEnd('error');return;}
    let parsed: ReturnType<typeof messageSchema.safeParse>;
    try {parsed=messageSchema.safeParse(JSON.parse(raw.toString()));} catch {void requestEnd('error');return;}
    if(!parsed.success) {void requestEnd('error');return;}
    const input=parsed.data;
    if(input.type === 'start') {
      if(startPromise) {void requestEnd('error');return;}
      startPromise=start(input).catch(async error => {
        if(error instanceof LiveSessionError && !error.created) creationRejected=true;
        send({type:'error',message:'Samtalen kunne ikke starte. Last siden på nytt og prøv igjen om litt.'});
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
