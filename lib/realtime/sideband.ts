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
type ToolCall = { type: string; call_id?: string; name?: string; arguments?: string };
interface RealtimeEvent {
  type: string;
  item?: { id?: string; type?: string; call_id?: string; role?: string; content?: Array<{ type?: string; text?: string }>; output?: string };
  response?: { id?: string; usage?: RealtimeTokenUsage; status_details?: { error?: { code?: string; message?: string } }; status?: string; output?: ToolCall[] };
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
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const completed = new Set<string>();
  const responseTurns = new Map<string, number>();
  let turn = 0;
  const usage = { responses: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0, complete: true };
  const received = new Set<string>();
  const send = (event: unknown) => { if (!ended && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event)); };
  const continueIfReady = () => {
    if (!pending || pending.size) return;
    pending = null;
    clearTimeout(deadline);
    rounds += 1;
    responding = true;
    send({ type: 'response.create', ...(rounds >= 6 ? { response: { tool_choice: 'none' } } : {}) });
  };
  const cleanup = (reason = 'connection') => {
    if (ended) return;
    if (reason === 'limit' || reason === 'idle') {
      send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: SESSION_END_PREFIX + reason }] } });
    }
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
      turn += 1; rounds = 0; retries = 0; clearTimeout(retryTimer); pending = null; clearTimeout(deadline); lastActivity = Date.now();
      if (manual) {
        if (responding) send({ type: 'response.cancel' });
        responding = false;
      }
      if (event.type === 'input_audio_buffer.speech_started') { userSpeaking = true; responding = false; }
      if (event.item?.role === 'user' && event.item.content?.some(c => c.type === 'input_text')) {
        // One ordered server socket owns text responses and tool continuation, including fast follow-ups.
        if (responding) send({ type: 'response.cancel' });
        responding = true;
        send({ type: 'response.create' });
      }
    }
    if (event.type === 'input_audio_buffer.speech_stopped') { userSpeaking = false; lastActivity = Date.now(); }
    if (event.type === 'response.created') { if (event.response?.id) responseTurns.set(event.response.id, turn); responding = true; lastActivity = Date.now(); }
    if (event.type === 'output_audio_buffer.started') playing = true;
    if (event.type === 'output_audio_buffer.stopped' || event.type === 'output_audio_buffer.cleared') { playing = false; lastActivity = Date.now(); }
    if (['conversation.item.added', 'conversation.item.done', 'conversation.item.created'].includes(event.type) && event.item?.type === 'function_call_output' && event.item.call_id) {
      received.add(event.item.call_id);
      pending?.delete(event.item.call_id);
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
    if (response.status_details?.error?.code === 'rate_limit_exceeded' && retries < 2) {
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
    if (response.status !== 'completed') { pending = null; clearTimeout(deadline); return; }
    const calls = response.output?.filter(c => c.type === 'function_call' && c.call_id && c.name) ?? [];
    if (!calls.length) return;
    pending = new Set(calls.map(c => c.call_id!).filter(id => !received.has(id)));
    for (const call of calls) {
      if (browserTools.has(call.name!)) continue;
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
        send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: id, output: JSON.stringify({ error: 'Kartet svarte ikke. Ikke påstå at det ble flyttet.' }) } });
      }
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
