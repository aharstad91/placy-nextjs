import 'server-only';
import WebSocket from 'ws';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MAP_TOOLS } from '@/lib/realtime/types';
import { backendModel } from '@/lib/live/session-config';
import { getLiveSupervisor } from '@/lib/live/supervisor';
import { disposeMapBridge, getMapBridge, MAP_CANCELLED_OUTPUT, type MapBridge } from '@/lib/live/map-bridge';
import { backendCostUsd, liveVoiceCostUsd, type BackendTokenUsage } from '@/lib/live/usage';
import type {
  DelegationTiming, LiveContextMessage, LiveConversation, LiveEndReason, LiveUsage, MapDirective,
} from '@/lib/live/types';

/**
 * Sideband-kontrollen for Nyhavna-demoens Live-sesjon (2026-09-13).
 *
 * Stemmen (gpt-live-1) snakker med brukeren over WebRTC; denne socketen er
 * serverens egen kanal inn i den samme sesjonen. Her utføres ALLE verktøy:
 * kunnskap og omvisning på serveren, kart i nettleseren via SSE-brua. Backenden
 * (Responses) velger verktøy, men eier verken tilstand eller kart.
 *
 * Ingen fallback til Realtime noe sted: protokollene deler ikke event-navn, og
 * en stille omvei ville gitt en demo som «virker» uten å gjøre det den sier.
 */

const IDLE_MS = 120000;
const MAX_ROUNDS = 6;
/** Appends har et tak på 500 tokens. ~1 800 tegn norsk ligger trygt under. */
const APPEND_MAX_CHARS = 1800;
const CLOSE_GRACE_MS = 5000;
/**
 * Etter at backenden er ferdig sier stemmen selve svaret. Vi venter litt før
 * målepunktene skrives, så `answer_words` faktisk inneholder svaret og ikke bare
 * kvitteringen («jeg sjekker …»).
 */
const ANSWER_GRACE_MS = 4000;
const SUPERSEDED_OUTPUT = MAP_CANCELLED_OUTPUT;

const END_MESSAGES: Record<LiveEndReason, string> = {
  manual: 'Samtalen er avsluttet.',
  limit: 'Samtalen nådde tidsgrensen. Trykk på mikrofonen for å starte en ny samtale.',
  idle: 'Samtalen ble avsluttet fordi det var stille en stund.',
  connection: 'Forbindelsen til samtalen falt.',
  error: 'Samtalen ble avsluttet på grunn av en feil.',
};

interface Round { calls: Set<string>; closed: boolean; continued: boolean }

interface Delegation {
  id: string;
  responseId: string | null;
  startedAt: number;
  superseded: boolean;
  finished: boolean;
  rounds: Round[];
  current: Round | null;
  pending: Map<string, true>;
  delivered: Set<string>;
  mapIds: Set<string>;
  toolChoiceLimited: boolean;
  timing: DelegationTiming;
  settleTimer?: ReturnType<typeof setTimeout>;
}

export interface LiveSidebandOptions {
  browserTools?: Set<string>;
  /** Modellnavn for kostnadsestimatet. Standard: den konfigurerte backend-modellen. */
  backendModelName?: string;
  idleMs?: number;
  maxRounds?: number;
  /** Grunninstruksen backenden fikk ved oppstart; notatet legges etter den. */
  backendInstructions?: string;
  onTiming?: (timing: DelegationTiming) => void;
  onUsage?: (usage: LiveUsage & { reason: string }) => void;
}

export interface LiveSidebandHandle {
  onContext: (message: LiveContextMessage) => void;
  end: (reason: LiveEndReason) => Promise<void>;
}

const globals = globalThis as typeof globalThis & { placyLiveSidebands?: Map<string, LiveSidebandHandle> };

export function getLiveSideband(token: string) {
  return globals.placyLiveSidebands?.get(token);
}

const clip = (text: string) => text.length > APPEND_MAX_CHARS ? `${text.slice(0, APPEND_MAX_CHARS)}…` : text;

export async function connectLiveSideband(
  sessionId: string,
  token: string,
  conversation: LiveConversation,
  options: LiveSidebandOptions = {},
): Promise<LiveSidebandHandle> {
  const browserTools = options.browserTools ?? MAP_TOOLS;
  const model = options.backendModelName ?? backendModel();
  const idleMs = options.idleMs ?? IDLE_MS;
  const maxRounds = options.maxRounds ?? MAX_ROUNDS;
  const baseInstructions = options.backendInstructions ?? '';
  const supervisor = getLiveSupervisor();
  const bridge: MapBridge = getMapBridge(token);
  // Loggen går både til stdout og til `.context/nyhavna-live.log` (ikke i git):
  // demoens server kjører i et terminalvindu ingen leser under møtet, og
  // målepunktene skal kunne hentes etterpå.
  const log = (line: string) => {
    if (process.env.NODE_ENV === 'test') return;
    process.stdout.write(line);
    void appendFile(join(process.cwd(), '.context', 'nyhavna-live.log'), `${new Date().toISOString()} ${line}`).catch(() => {});
  };
  const onTiming = options.onTiming ?? ((timing: DelegationTiming) => log(`nyhavna_live_turn ${JSON.stringify(timing)}\n`));
  const onUsage = options.onUsage ?? ((usage: LiveUsage & { reason: string }) => log(`nyhavna_live_usage ${JSON.stringify(usage)}\n`));

  const socket = new WebSocket(`wss://api.openai.com/v1/live/sessions/${sessionId}/attach`, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  });

  let ended = false;
  let closing = false;
  let sawClosed = false;
  let lastActivity = Date.now();
  let lastUserEndMs: number | null = null;
  let eventCounter = 0;
  const usage: LiveUsage = {
    voiceSeconds: 0, backendResponses: 0, backendInputTokens: 0, backendCachedTokens: 0,
    backendOutputTokens: 0, estimatedUsd: 0, complete: true,
  };
  const delegations = new Map<string, Delegation>();
  const byResponse = new Map<string, Delegation>();
  let active: Delegation | null = null;
  let closedWaiter: (() => void) | null = null;

  const send = (event: Record<string, unknown>) => {
    if (ended || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ event_id: `evt_${++eventCounter}`, ...event }));
  };
  const since = (delegation: Delegation) => Date.now() - delegation.startedAt;

  const settle = (delegation: Delegation, end: DelegationTiming['end']) => {
    if (!delegations.has(delegation.id)) return;
    delegations.delete(delegation.id);
    if (delegation.responseId) byResponse.delete(delegation.responseId);
    if (active === delegation) active = null;
    clearTimeout(delegation.settleTimer);
    onTiming({ ...delegation.timing, end });
  };

  const finish = (delegation: Delegation, end: DelegationTiming['end']) => {
    if (delegation.finished) return;
    delegation.finished = true;
    if (delegation.timing.backend_done_ms === null) delegation.timing.backend_done_ms = since(delegation);
    // Rundetaket var en nødbrems for ÉN delegering; neste forespørsel skal ha verktøy igjen.
    if (delegation.toolChoiceLimited) {
      send({ type: 'session.update', session: { delegation: { type: 'responses', responses: { tool_choice: 'auto' } } } });
      delegation.toolChoiceLimited = false;
    }
    delegation.settleTimer = setTimeout(() => settle(delegation, end), ANSWER_GRACE_MS);
    delegation.settleTimer.unref?.();
  };

  const deliver = (delegation: Delegation, callId: string, output: unknown) => {
    if (delegation.delivered.has(callId)) return;
    delegation.delivered.add(callId);
    delegation.pending.delete(callId);
    send({ type: 'response.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(output ?? null) } });
  };

  const supersede = (delegation: Delegation) => {
    if (delegation.superseded || delegation.finished) return;
    delegation.superseded = true;
    for (const id of delegation.mapIds) bridge.cancel(id);
    for (const callId of [...delegation.pending.keys()]) deliver(delegation, callId, SUPERSEDED_OUTPUT);
    // INGEN response.create: backenden skal ikke fortsette på et spørsmål brukeren gikk fra.
    settle(delegation, 'superseded');
  };

  /** Sender ett direktiv og husker ID-en, så en superseded delegering kan trekke det tilbake. */
  const dispatchMap = (delegation: Delegation, name: string, args: Record<string, unknown>) => {
    const { id, result } = bridge.dispatch(name, args);
    delegation.mapIds.add(id);
    return result.finally(() => delegation.mapIds.delete(id));
  };

  const maybeContinue = (delegation: Delegation) => {
    if (delegation.superseded || delegation.finished) return;
    const round = delegation.current;
    if (!round || !round.closed || round.continued) return;
    for (const callId of round.calls) if (!delegation.delivered.has(callId)) return;
    round.continued = true;
    if (round.calls.size === 0) { finish(delegation, 'done'); return; }
    const responses: Record<string, unknown> = {};
    // Notatet legges SIST, så cache-prefikset (grunninstruksen) står urørt.
    const note = conversation.noteIfChanged();
    if (note) responses.instructions = `${baseInstructions}\n\n${note}`;
    if (delegation.rounds.length >= maxRounds && !delegation.toolChoiceLimited) {
      responses.tool_choice = 'none';
      delegation.toolChoiceLimited = true;
    }
    if (Object.keys(responses).length) send({ type: 'session.update', session: { delegation: { type: 'responses', responses } } });
    const mapContext = conversation.mapContextIfChanged();
    if (mapContext) send({ type: 'session.thinking.append', delegation_id: null, content: clip(mapContext) });
    send({ type: 'response.create' });
  };

  const runServerDirectives = async (delegation: Delegation, directives: Array<Pick<MapDirective, 'name' | 'args'>>) => {
    // Avventes med vilje: notatet og kartkonteksten under skal si hva kartet
    // FAKTISK viser, ikke hva serveren hadde tenkt å vise. Frist er brua sin.
    for (const directive of directives) {
      const timing = delegation.timing;
      if (timing.first_map_call === null) {
        timing.first_map_call = directive.name;
        timing.first_map_args = JSON.stringify(directive.args).slice(0, 160) || null;
        timing.first_map_call_ms = since(delegation);
      }
      const output = await dispatchMap(delegation, directive.name, directive.args);
      if (delegation.superseded) continue;
      const failed = !output || typeof output !== 'object' || typeof (output as { error?: unknown }).error === 'string';
      if (!failed && timing.map_ok_ms === null) timing.map_ok_ms = since(delegation);
      conversation.observeBrowserResult(directive.name, directive.args, output);
    }
  };

  const runCall = async (delegation: Delegation, callId: string, name: string, rawArguments: string) => {
    let args: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(rawArguments || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
    } catch { args = null; }
    if (!args) { deliver(delegation, callId, { error: 'Ugyldige argumenter.' }); maybeContinue(delegation); return; }
    let output: unknown;
    if (browserTools.has(name)) {
      const timing = delegation.timing;
      if (timing.first_map_call === null) {
        timing.first_map_call = name;
        timing.first_map_args = JSON.stringify(args).slice(0, 160) || null;
        timing.first_map_call_ms = since(delegation);
      }
      output = await dispatchMap(delegation, name, args);
      if (!delegation.superseded) {
        const failed = !output || typeof output !== 'object' || typeof (output as { error?: unknown }).error === 'string';
        if (!failed && timing.map_ok_ms === null) timing.map_ok_ms = since(delegation);
        conversation.observeBrowserResult(name, args, output);
      }
    } else {
      try {
        const outcome = await conversation.execute(name, args);
        output = outcome.result;
        if (outcome.directives?.length) await runServerDirectives(delegation, outcome.directives);
      } catch { output = { error: 'Kunnskapsforespørselen kunne ikke besvares.' }; }
    }
    if (delegation.superseded) { deliver(delegation, callId, SUPERSEDED_OUTPUT); return; }
    deliver(delegation, callId, output);
    maybeContinue(delegation);
  };

  const nestedUsage = (raw: unknown) => {
    const value = raw as BackendTokenUsage | undefined;
    if (!value || typeof value.input_tokens !== 'number') return null;
    return value;
  };

  const handleResponseEvent = (delegationId: string | null, nested: Record<string, unknown>) => {
    const type = typeof nested.type === 'string' ? nested.type : '';
    const response = nested.response as { id?: string; status?: string; usage?: unknown; error?: { code?: string; message?: string }; incomplete_details?: { reason?: string } } | undefined;
    const delegation = (delegationId && delegations.get(delegationId))
      || (response?.id ? byResponse.get(response.id) : undefined)
      || (typeof nested.item_id === 'string' ? active : null)
      || active;
    if (!delegation) return;
    if (type === 'response.created') {
      if (response?.id) { delegation.responseId = response.id; byResponse.set(response.id, delegation); }
      const round: Round = { calls: new Set(), closed: false, continued: false };
      delegation.rounds.push(round);
      delegation.current = round;
      return;
    }
    if (type === 'response.output_item.done') {
      const item = nested.item as { type?: string; call_id?: string; name?: string; arguments?: string } | undefined;
      if (item?.type !== 'function_call' || !item.call_id || !item.name) return;
      // Lifecycle-snapshottene har tom `output`; kallene finnes BARE her.
      if (!delegation.current) {
        // `response.created` kan mangle (sideband-et kobles til etter at
        // backenden alt jobber): kallet må likevel få en runde å fullføre.
        const round: Round = { calls: new Set(), closed: false, continued: false };
        delegation.rounds.push(round);
        delegation.current = round;
      }
      delegation.current.calls.add(item.call_id);
      delegation.pending.set(item.call_id, true);
      // Utføres straks, ikke ved `response.completed`: ventetiden er brukerens.
      void runCall(delegation, item.call_id, item.name, item.arguments ?? '{}');
      return;
    }
    if (type !== 'response.completed' && type !== 'response.failed' && type !== 'response.incomplete') return;
    const round = delegation.current;
    const tokens = nestedUsage(response?.usage);
    if (tokens) {
      usage.backendResponses += 1;
      usage.backendInputTokens += tokens.input_tokens;
      usage.backendCachedTokens += tokens.input_tokens_details?.cached_tokens ?? 0;
      usage.backendOutputTokens += tokens.output_tokens ?? 0;
      const cost = backendCostUsd(model, tokens);
      usage.estimatedUsd += cost ?? 0;
      usage.complete &&= cost !== null;
    } else usage.complete = false;
    const errorText = `${response?.incomplete_details?.reason ?? ''} ${response?.error?.code ?? ''} ${response?.error?.message ?? ''}`.replace(/\s+/g, ' ').trim();
    delegation.timing.rounds.push({
      done_ms: since(delegation),
      output: [...(round?.calls ?? [])].map(id => `fn:${id}`),
      status: response?.status ?? type.replace('response.', ''),
      ...(errorText ? { error: errorText.slice(0, 200) } : {}),
      input_tokens: tokens?.input_tokens ?? 0,
      cached_tokens: tokens?.input_tokens_details?.cached_tokens ?? 0,
      output_tokens: tokens?.output_tokens ?? 0,
    });
    if (round) round.closed = true;
    if (type !== 'response.completed') { finish(delegation, 'failed'); return; }
    maybeContinue(delegation);
  };

  const onMessage = (raw: WebSocket.RawData) => {
    if (ended) return;
    let event: Record<string, unknown>;
    try { event = JSON.parse(raw.toString()); } catch { return; }
    const type = typeof event.type === 'string' ? event.type : '';
    if (type === 'session.delegation.created') {
      const delegationInfo = event.delegation as { id?: string; target?: string; response_id?: string } | undefined;
      if (delegationInfo?.target !== 'responses' || !delegationInfo.id) return;
      lastActivity = Date.now();
      if (active) supersede(active);
      const offsetMs = typeof event.offset_ms === 'number' ? event.offset_ms : 0;
      const delegation: Delegation = {
        id: delegationInfo.id, responseId: delegationInfo.response_id ?? null, startedAt: Date.now(),
        superseded: false, finished: false, rounds: [], current: null, pending: new Map(), delivered: new Set(),
        mapIds: new Set(), toolChoiceLimited: false,
        timing: {
          delegation_id: delegationInfo.id, offset_ms: offsetMs, user_end_ms: lastUserEndMs,
          ack_words: '', ack_ms: null, first_map_call: null, first_map_args: null, first_map_call_ms: null,
          map_ok_ms: null, rounds: [], backend_done_ms: null, answer_words: '', answer_ms: null, end: 'done',
        },
      };
      delegations.set(delegation.id, delegation);
      if (delegation.responseId) byResponse.set(delegation.responseId, delegation);
      active = delegation;
      return;
    }
    if (type === 'response.event') {
      const nested = event.event as Record<string, unknown> | undefined;
      if (!nested) return;
      lastActivity = Date.now();
      handleResponseEvent(typeof event.delegation_id === 'string' ? event.delegation_id : null, nested);
      return;
    }
    if (type === 'session.input_transcript.delta') {
      lastActivity = Date.now();
      if (typeof event.end_ms === 'number') lastUserEndMs = event.end_ms;
      return;
    }
    if (type === 'session.output_transcript.delta') {
      lastActivity = Date.now();
      const delta = typeof event.delta === 'string' ? event.delta : '';
      const timing = active?.timing;
      if (!active || !delta || !timing) return;
      // Før backenden er ferdig er ordene en kvittering («jeg sjekker …»);
      // etterpå er de selve svaret. Skillet er hele poenget med målingen.
      if (timing.backend_done_ms === null) {
        if (timing.ack_ms === null) timing.ack_ms = since(active);
        if (timing.ack_words.length < 80) timing.ack_words = (timing.ack_words + delta).slice(0, 80);
      } else {
        if (timing.answer_ms === null) timing.answer_ms = since(active);
        if (timing.answer_words.length < 80) timing.answer_words = (timing.answer_words + delta).slice(0, 80);
      }
      return;
    }
    if (type === 'session.usage.updated') {
      const seconds = (event.usage as { seconds?: number } | undefined)?.seconds;
      // Snapshot, ikke et tillegg: skal settes, aldri summeres.
      if (typeof seconds === 'number') usage.voiceSeconds = seconds;
      return;
    }
    if (type === 'session.closed') {
      sawClosed = true;
      const seconds = (event.usage as { seconds?: number } | undefined)?.seconds;
      if (typeof seconds === 'number') usage.voiceSeconds = seconds;
      closedWaiter?.();
      const reason = typeof event.reason === 'string' ? event.reason : 'connection';
      cleanup(reason);
      // Sesjonen døde uten at vi ba om det (nettleseren lastet siden på nytt,
      // tidsgrense hos OpenAI, moderasjon): supervisoren må frigi plassen,
      // ellers nekter serveren neste start med «en samtale er aktiv».
      if (!closing) void supervisor.end(token, 'connection').catch(() => {});
      return;
    }
    if (type === 'error') {
      const error = event.error as { code?: string; type?: string; message?: string } | undefined;
      // Moderasjon kan kutte lyd uten å drepe sesjonen: logg, ikke legg på.
      log(`nyhavna_live_error ${JSON.stringify({ code: error?.code ?? null, type: error?.type ?? null, message: (error?.message ?? '').slice(0, 200) })}\n`);
    }
  };

  function cleanup(reason: string) {
    if (ended) return;
    ended = true;
    clearInterval(idleTimer);
    for (const delegation of [...delegations.values()]) settle(delegation, 'ended');
    usage.estimatedUsd += liveVoiceCostUsd(usage.voiceSeconds);
    onUsage({ ...usage, reason });
    disposeMapBridge(token);
    socket.close();
  }

  const end = async (reason: LiveEndReason) => {
    if (closing || ended) return;
    closing = true;
    bridge.send({ type: 'ended', reason, message: END_MESSAGES[reason] });
    send({ type: 'session.close' });
    if (!sawClosed) {
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, CLOSE_GRACE_MS);
        timer.unref?.();
        closedWaiter = () => { clearTimeout(timer); resolve(); };
      });
      closedWaiter = null;
    }
    // Supervisorens `stop` er `liveHangup`; 404 der betyr at close-veien vant.
    await supervisor.end(token, reason).catch(() => {});
  };

  const idleTimer = setInterval(() => {
    if (!ended && !active && Date.now() - lastActivity > idleMs) void end('idle');
  }, 10000);
  idleTimer.unref?.();

  let selectionVersion = 0;
  const onContext = (message: LiveContextMessage) => {
    if (ended) return;
    lastActivity = Date.now();
    if (message.kind === 'state') {
      conversation.setBoardState({
        selected_category_id: message.selected_category_id,
        selected_place_id: message.selected_place_id,
        travel_mode: message.travel_mode,
        revealed_place_ids: message.revealed_place_ids,
      });
      const mapContext = conversation.mapContextIfChanged();
      if (mapContext) send({ type: 'session.thinking.append', delegation_id: null, content: clip(mapContext) });
      return;
    }
    if (message.kind === 'text') {
      // Kun dev-hook: simulerer en brukertur uten at noen faktisk sa noe.
      log(`nyhavna_live_simulated_text ${JSON.stringify({ chars: message.text.length })}\n`);
      send({ type: 'response.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: message.text.slice(0, 2000) }] } });
      send({ type: 'response.create' });
      return;
    }
    const version = ++selectionVersion;
    const selection = conversation.onMapSelection(message.kind, message.id);
    if (!selection) return;
    void (async () => {
      for (const directive of selection.directives) {
        if (ended || version !== selectionVersion) return;
        const output = await bridge.dispatch(directive.name, directive.args).result;
        if (ended || version !== selectionVersion) return;
        conversation.observeBrowserResult(directive.name, directive.args, output);
      }
      if (ended || version !== selectionVersion) return;
      const note = conversation.noteIfChanged();
      if (note) send({ type: 'session.update', session: { delegation: { type: 'responses', responses: { instructions: `${baseInstructions}\n\n${note}` } } } });
      // Kommentar, ikke instruks: stemmen skal FORTELLE dette, parafrasert.
      send({ type: 'session.commentary.append', delegation_id: null, content: clip(selection.commentary) });
    })();
  };

  socket.on('message', onMessage);
  socket.on('close', () => { if (!ended) void supervisor.end(token, 'connection').catch(() => {}); });
  socket.on('error', () => { if (!ended) void supervisor.end(token, 'connection').catch(() => {}); });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup('connection'); reject(new Error('Serverkontrollen fikk ikke kontakt.')); }, 10000);
    socket.once('open', () => { clearTimeout(timeout); resolve(); });
    socket.once('error', () => { clearTimeout(timeout); reject(new Error('Serverkontrollen kunne ikke starte.')); });
  });

  const handle: LiveSidebandHandle = { onContext, end };
  globals.placyLiveSidebands ??= new Map();
  globals.placyLiveSidebands.set(token, handle);
  supervisor.setCleanup(token, reason => {
    globals.placyLiveSidebands?.delete(token);
    if (!closing) {
      // Supervisoren avsluttet oss (tidsgrense eller DELETE): meld fra og be
      // pent om å lukke. Hangupen supervisoren gjør etterpå er nødbremsen.
      bridge.send({ type: 'ended', reason: (reason as LiveEndReason) in END_MESSAGES ? reason as LiveEndReason : 'connection', message: END_MESSAGES[(reason as LiveEndReason) in END_MESSAGES ? reason as LiveEndReason : 'connection'] });
      send({ type: 'session.close' });
    }
    cleanup(reason);
  });
  return handle;
}
