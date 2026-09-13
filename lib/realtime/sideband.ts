import 'server-only';
import WebSocket from 'ws';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { realtimeCost, type RealtimeTokenUsage } from '@/lib/realtime/usage';
import { realtimeModel } from '@/lib/realtime/session-config';
import { RealtimeSupervisor } from '@/lib/realtime/server-session';

/** Én tilstandsfil per demo, så to lokale demoer i samme repo ikke rydder opp i hverandres samtaler. */
const stateFile = (scope: string) => join(process.cwd(), '.context', `${scope}-realtime-call.json`);
export async function hangup(callId: string) {
  if (!/^rtc_[a-zA-Z0-9_-]+$/.test(callId)) throw new Error('Invalid call identity');
  const response = await fetch(`https://api.openai.com/v1/realtime/calls/${callId}/hangup`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok && response.status !== 404) throw new Error('Samtalen kunne ikke avsluttes. Prøv igjen.');
}
const globals = globalThis as typeof globalThis & { placySupervisors?: Map<string, RealtimeSupervisor> };
export function getSupervisor(scope = 'nyhavna') {
  globals.placySupervisors ??= new Map();
  let supervisor = globals.placySupervisors.get(scope);
  if (supervisor) return supervisor;
  supervisor = new RealtimeSupervisor({
    stop: hangup,
    read: async () => {
      try {
        const parsed = JSON.parse(await readFile(stateFile(scope), 'utf8'));
        if (typeof parsed.callId !== 'string') throw new Error('Invalid session state');
        return parsed.callId;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    save: async (callId) => {
      await mkdir(join(process.cwd(), '.context'), { recursive: true });
      if (!callId) { await unlink(stateFile(scope)).catch(error => { if (error.code !== 'ENOENT') throw error; }); return; }
      const tmp = `${stateFile(scope)}.tmp`;
      await writeFile(tmp, JSON.stringify({ callId }), { mode: 0o600 });
      await rename(tmp, stateFile(scope));
    },
  });
  globals.placySupervisors.set(scope, supervisor);
  return supervisor;
}
import { MAP_TOOLS, MAP_INTERRUPT_MARKER, SESSION_END_PREFIX, RATE_WAIT_PREFIX } from '@/lib/realtime/types';
type ToolCall = { type: string; call_id?: string; name?: string; arguments?: string; content?: Array<{ transcript?: string; text?: string }> };
interface RealtimeEvent {
  type: string;
  delta?: string;
  item?: { id?: string; type?: string; call_id?: string; name?: string; arguments?: string; role?: string; content?: Array<{ type?: string; text?: string }>; output?: string };
  response?: { id?: string; usage?: RealtimeTokenUsage; status_details?: { reason?: string; error?: { code?: string; message?: string } }; status?: string; output?: ToolCall[] };
}
/**
 * Målepunkter for ÉN brukertur, i millisekunder fra brukerens input var ferdig
 * (talen stoppet, eller tekstmeldingen kom inn). Skrives som én logglinje når
 * turen er avgjort, så ventetiden kan leses runde for runde: hva modellen
 * gjorde i hver runde, når brukeren først hørte noe, og når kartet reagerte.
 */
export interface TurnTiming {
  turn: number;
  source: 'voice' | 'text' | 'auto';
  /** Første lyd ut til brukeren. */
  first_audio_ms: number | null;
  /** De første ordene i talen, og når de kom – «la meg sjekke» teller ikke som svar. */
  first_words: string;
  first_words_ms: number | null;
  /** Første kartkall modellen sendte, og når kartet bekreftet det. */
  first_map_call: string | null;
  first_map_args: string | null;
  first_map_call_ms: number | null;
  map_ok_ms: number | null;
  /** Hver modellrunde: når den var ferdig, hva den inneholdt, status (med feil, f.eks. takgrense) og inndata-tokens (derav bufret). */
  rounds: Array<{ done_ms: number; output: string[]; status: string; error?: string; input_tokens: number; cached_tokens: number; output_tokens: number }>;
  settled_ms: number;
  end: 'done' | 'interrupted' | 'ended' | 'cancelled' | 'failed' | 'incomplete';
}
/** Server owns knowledge results and continuation; browser owns only reversible map commands. */
export interface SidebandOptions {
  /** Demo-navn; styrer supervisor og tilstandsfil. */
  scope?: string;
  /** Verktøy nettleseren eier (kart). Alt annet utføres på serveren. */
  browserTools?: Set<string>;
  /** Modell for kostnadsestimat. */
  model?: string;
  /** Maks ventetid før serveren avslutter en stille samtale. */
  idleMs?: number;
  /**
   * Nettleserens kartsvar, når de kommer inn som function_call_output. Lar
   * samtaletilstanden på serveren speile det som FAKTISK står i kartet
   * (fremhevede steder i rekkefølge), ikke det modellen hadde tenkt å vise.
   * `spoken` er det modellen sa i samme svar som kartkallet (transkripsjon).
   * Returnerer den en tekst, er det data modellen trenger for å fortsette
   * (f.eks. fakta om stedet som nettopp ble åpnet, eller at det som ble sagt
   * bare var en innledning): teksten sendes som systemmelding, og modellen får
   * ordet igjen selv om den alt snakket.
   */
  observe?: (name: string, args: Record<string, unknown>, output: unknown, spoken: string) => string | void;
  /**
   * Kompakt samtalenotat når tilstanden har endret seg, ellers null. Sendes som
   * systemmelding før modellen får fortsette, så notatet alltid er det ferskeste
   * innslaget og overlever en eventuell forkorting av eldre historikk.
   */
  note?: () => string | null;
  /**
   * Brukerens tekstmelding før modellen svarer. Returnerer den en tekst, er det
   * data som legges ved som systemmelding før svaret – f.eks. kapittelet når
   * brukeren trykket på et tema i kartet, så modellen slipper en egen
   * verktøyrunde for det (målt 2026-09-13: én runde ≈ 11 000 tokens og 1,5 s,
   * og hver runde teller mot takgrensen på tokens per minutt).
   */
  onUserText?: (text: string) => string | null;
  /** Mottar målepunktene for hver avgjorte tur. Standard: én logglinje `<scope>_realtime_turn`. */
  onTurn?: (timing: TurnTiming) => void;
}
export async function connectSideband(callId: string, token: string, execute: (name: string, args: Record<string, unknown>) => unknown, options: SidebandOptions = {}) {
  const scope = options.scope ?? 'nyhavna';
  const browserTools = options.browserTools ?? MAP_TOOLS;
  const model = options.model ?? realtimeModel();
  const idleMs = options.idleMs ?? 120000;
  const supervisor = getSupervisor(scope);
  const socket = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${callId}`, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  });
  let ended = false;
  let lastActivity = Date.now();
  let responding = false;
  let playing = false;
  let userSpeaking = false;
  const controlItems = new Set<string>();
  let rounds = 0;
  let pending: Set<string> | null = null;
  /** Kallene i gjeldende runde som nettleseren eier: call_id → navn og argumenter, til observasjonen. */
  const browserCalls = new Map<string, { name: string; args: Record<string, unknown> }>();
  /**
   * Om modellen alt SNAKKET i svaret som utløste kartkallene. Da er det ikke noe
   * mer å si når kartet bekrefter – et nytt response.create ville gitt et
   * ekstra «jeg har nå vist …». Feil fra kartet, eller et kunnskapsverktøy,
   * krever derimot at modellen får ordet igjen.
   */
  let spokeInBatch = false;
  let spokenText = '';
  let needsContinuation = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const completed = new Set<string>();
  const responseTurns = new Map<string, number>();
  let turn = 0;
  const usage = { responses: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0, complete: true };
  const received = new Set<string>();
  const send = (event: unknown) => { if (!ended && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event)); };
  // Tidsmåling per tur. `timing` lever fra brukerens input er ferdig til turen
  // er avgjort (ingen flere runder) eller avbrutt av en ny tur.
  let timing: (TurnTiming & { startedAt: number }) | null = null;
  const onTurn = options.onTurn ?? ((t: TurnTiming) => { if (process.env.NODE_ENV !== 'test') process.stdout.write(`${scope}_realtime_turn ${JSON.stringify(t)}\n`); });
  const sinceInput = () => timing ? Date.now() - timing.startedAt : 0;
  const settle = (end: TurnTiming['end']) => {
    if (!timing) return;
    const { startedAt: _startedAt, ...record } = timing;
    timing = null;
    onTurn({ ...record, settled_ms: Date.now() - _startedAt, end });
  };
  const beginTurn = (source: TurnTiming['source']) => {
    settle('interrupted');
    timing = { startedAt: Date.now(), turn, source, first_audio_ms: null, first_words: '', first_words_ms: null, first_map_call: null, first_map_args: null, first_map_call_ms: null, map_ok_ms: null, rounds: [], settled_ms: 0, end: 'done' };
  };
  const sendNote = () => {
    const note = options.note?.();
    if (note) send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: note }] } });
  };
  const continueIfReady = () => {
    if (!pending || pending.size) return;
    pending = null;
    clearTimeout(deadline);
    sendNote();
    if (spokeInBatch && !needsContinuation) { settle('done'); return; }
    rounds += 1;
    responding = true;
    send({ type: 'response.create', ...(rounds >= 6 ? { response: { tool_choice: 'none' } } : {}) });
  };
  const cleanup = (reason = 'connection') => {
    if (ended) return;
    if (reason === 'limit' || reason === 'idle') {
      send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: SESSION_END_PREFIX + reason }] } });
    }
    settle('ended');
    process.stdout.write(`${scope}_realtime_usage ` + JSON.stringify({ ...usage, model, excludes: 'input transcription', endedAt: new Date().toISOString() }) + '\n');
    ended = true;
    clearInterval(idle);
    clearTimeout(retryTimer);
    clearTimeout(deadline);
    socket.close();
  };
  const stop = (reason = 'connection') => { if (!ended) void supervisor.end(token, reason).catch(() => {}); };
  const idle = setInterval(() => { if (!responding && !playing && !userSpeaking && Date.now() - lastActivity > idleMs) stop("idle"); }, 10000);
  idle.unref?.();
  supervisor.setCleanup(token, cleanup);
  socket.on('message', raw => {
    let event: RealtimeEvent;
    try { event = JSON.parse(raw.toString()); } catch { return; }
    if (ended) return;
    const manual = event.item?.content?.some(c => c.text === MAP_INTERRUPT_MARKER);
    const control = ['conversation.item.added', 'conversation.item.created'].includes(event.type) && (event.item?.role === 'user' || manual);
    const freshControl = control && (!event.item?.id || !controlItems.has(event.item.id));
    if (event.type === 'input_audio_buffer.speech_started' || freshControl) {
      if (freshControl && event.item?.id) controlItems.add(event.item.id);
      turn += 1; rounds = 0; retries = 0; clearTimeout(retryTimer); pending = null; browserCalls.clear(); clearTimeout(deadline); lastActivity = Date.now();
      if (manual) {
        if (responding) send({ type: 'response.cancel' });
        responding = false;
        settle('interrupted');
      }
      if (event.type === 'input_audio_buffer.speech_started') { userSpeaking = true; responding = false; settle('interrupted'); }
      const userText = event.item?.role === 'user' ? event.item.content?.find(c => c.type === 'input_text')?.text : undefined;
      if (typeof userText === 'string') {
        // One ordered server socket owns text responses and tool continuation, including fast follow-ups.
        if (responding) send({ type: 'response.cancel' });
        beginTurn('text');
        const attached = options.onUserText?.(userText);
        if (attached) send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: attached }] } });
        sendNote();
        responding = true;
        send({ type: 'response.create' });
      }
    }
    if (event.type === 'input_audio_buffer.speech_stopped') { userSpeaking = false; lastActivity = Date.now(); beginTurn('voice'); }
    if (event.type === 'response.created') { if (event.response?.id) responseTurns.set(event.response.id, turn); responding = true; lastActivity = Date.now(); if (!timing) beginTurn('auto'); }
    if (event.type === 'output_audio_buffer.started') { playing = true; if (timing && timing.first_audio_ms === null) timing.first_audio_ms = sinceInput(); }
    if (event.type === 'output_audio_buffer.stopped' || event.type === 'output_audio_buffer.cleared') { playing = false; lastActivity = Date.now(); }
    if (event.type === 'response.output_audio_transcript.delta' && timing && timing.first_words.length < 80 && typeof event.delta === 'string') {
      if (timing.first_words_ms === null) timing.first_words_ms = sinceInput();
      timing.first_words = (timing.first_words + event.delta).slice(0, 80);
    }
    if (event.type === 'response.output_item.done' && event.item?.type === 'function_call' && event.item.name && browserTools.has(event.item.name) && timing && timing.first_map_call === null) {
      timing.first_map_call = event.item.name;
      timing.first_map_args = (event.item.arguments ?? '').slice(0, 160) || null;
      timing.first_map_call_ms = sinceInput();
    }
    if (['conversation.item.added', 'conversation.item.done', 'conversation.item.created'].includes(event.type) && event.item?.type === 'function_call_output' && event.item.call_id) {
      const callId = event.item.call_id;
      const browserCall = browserCalls.get(callId);
      if (browserCall && !received.has(callId)) {
        browserCalls.delete(callId);
        let output: unknown = undefined;
        try { output = event.item.output ? JSON.parse(event.item.output) : undefined; } catch { output = undefined; }
        const failed = !output || typeof output !== 'object' || typeof (output as { error?: unknown }).error === 'string';
        if (failed) needsContinuation = true;
        else {
          if (timing && timing.map_ok_ms === null) timing.map_ok_ms = sinceInput();
          const followUp = options.observe?.(browserCall.name, browserCall.args, output, spokenText);
          if (typeof followUp === 'string' && followUp) {
            send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: followUp }] } });
            needsContinuation = true;
          }
        }
      }
      received.add(callId);
      pending?.delete(callId);
      continueIfReady();
    }
    if (event.type !== 'response.done') return;
    lastActivity = Date.now();
    const response = event.response;
    if (!response?.id || completed.has(response.id)) return;
    completed.add(response.id);
    if (response.usage) {
      usage.responses += 1; usage.inputTokens += response.usage.input_tokens; usage.outputTokens += response.usage.output_tokens;
      const cost = realtimeCost(model, response.usage);
      usage.estimatedUsd += cost ?? 0; usage.complete &&= cost !== null;
    }
    const responseTurn = responseTurns.get(response.id);
    responseTurns.delete(response.id);
    if (responseTurn !== undefined && responseTurn !== turn) return;
    responding = false;
    timing?.rounds.push({
      done_ms: sinceInput(),
      output: response.output?.map(c => c.type === 'function_call' ? `fn:${c.name}` : c.type) ?? [],
      status: response.status ?? 'unknown',
      ...(response.status_details?.error || response.status_details?.reason ? { error: `${response.status_details.reason ?? ''} ${response.status_details.error?.code ?? ''} ${response.status_details.error?.message ?? ''}`.replace(/\s+/g, ' ').trim().slice(0, 200) } : {}),
      input_tokens: response.usage?.input_tokens ?? 0,
      cached_tokens: response.usage?.input_token_details?.cached_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
    });
    // Takgrensen er per minutt (målt 2026-09-13: 40 000 tokens/min på mini, én
    // runde koster 8 000–14 000). Tre forsøk med API-ets oppgitte ventetid
    // rekker over minuttgrensen; ellers står brukeren uten svar.
    if (response.status_details?.error?.code === 'rate_limit_exceeded' && retries < 3) {
      const match = response.status_details.error.message?.match(/try again in ([\d.]+)(ms|s)/i);
      const delay = Math.min(60000, Math.max(1000, match ? Number(match[1]) * (match[2] === 's' ? 1000 : 1) + 500 : 15000));
      const retryTurn = turn;
      retries += 1;
      send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: RATE_WAIT_PREFIX + Math.ceil(delay / 1000) }] } });
      retryTimer = setTimeout(() => {
        if (ended || turn !== retryTurn) return;
        responding = true;
        send({ type: 'response.create', ...(rounds >= 6 ? { response: { tool_choice: 'none' } } : {}) });
      }, delay);
      retryTimer.unref?.();
      return;
    }
    if (response.status !== 'completed') {
      pending = null; clearTimeout(deadline);
      settle(response.status === 'cancelled' ? 'cancelled' : response.status === 'incomplete' ? 'incomplete' : 'failed');
      return;
    }
    const calls = response.output?.filter(c => c.type === 'function_call' && c.call_id && c.name) ?? [];
    if (!calls.length) { settle('done'); return; }
    spokeInBatch = response.output?.some(c => c.type === 'message') ?? false;
    spokenText = response.output?.filter(c => c.type === 'message').flatMap(c => c.content ?? []).map(c => c.transcript ?? c.text ?? '').join(' ').trim() ?? '';
    needsContinuation = false;
    pending = new Set(calls.map(c => c.call_id!).filter(id => !received.has(id)));
    for (const call of calls) {
      if (browserTools.has(call.name!)) {
        let args: Record<string, unknown> = {};
        try { const parsed = JSON.parse(call.arguments || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed; } catch { /* ugyldige argumenter: nettleseren svarer med feil */ }
        if (!received.has(call.call_id!)) browserCalls.set(call.call_id!, { name: call.name!, args });
        continue;
      }
      // Et kunnskapsverktøy krever at modellen får resultatet og svarer.
      needsContinuation = true;
      let result: unknown;
      try {
        const args = JSON.parse(call.arguments || '{}');
        if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('invalid');
        result = execute(call.name!, args);
      } catch { result = { error: 'Ugyldig kunnskapsforespørsel.' }; }
      send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) } });
      received.add(call.call_id!);
      pending?.delete(call.call_id!);
    }
    if (pending?.size) deadline = setTimeout(() => {
      for (const id of pending ?? []) {
        browserCalls.delete(id);
        send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: id, output: JSON.stringify({ error: 'Kartet svarte ikke. Ikke påstå at det ble flyttet.' }) } });
      }
      needsContinuation = true;
      pending?.clear(); continueIfReady();
    }, 10000);
    continueIfReady();
  });
  socket.on('close', () => stop());
  socket.on('error', () => stop());
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Serverkontrollen fikk ikke kontakt.')); }, 10000);
    socket.once('open', () => { clearTimeout(timeout); resolve(); });
    socket.once('error', () => { clearTimeout(timeout); reject(new Error('Serverkontrollen kunne ikke starte.')); });
  });
}
