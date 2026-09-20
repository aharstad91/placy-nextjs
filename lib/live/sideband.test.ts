import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DelegationTiming, LiveConversation, LiveUsage, ToolOutcome } from '@/lib/live/types';

const state = vi.hoisted(() => ({ socket: null as unknown, sent: [] as Array<Record<string, unknown>>, ended: vi.fn(), cleanup: undefined as undefined | ((reason: string) => void) }));
vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');
  class Socket extends EventEmitter {
    static OPEN = 1;
    readyState = 1;
    constructor() { super(); state.socket = this; queueMicrotask(() => this.emit('open')); }
    send(data: string) { state.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; }
  }
  return { default: Socket };
});
vi.mock('@/lib/live/supervisor', () => ({ getLiveSupervisor: () => ({
  setCleanup: (_token: string, fn: (reason: string) => void) => { state.cleanup = fn; },
  end: state.ended,
}) }));

import { connectLiveSideband, getLiveSideband } from '@/lib/live/sideband';
import { createMapBridge, disposeMapBridge, getMapBridge } from '@/lib/live/map-bridge';

const TOKEN = 'token';
const emit = (event: unknown) => (state.socket as EventEmitter).emit('message', Buffer.from(JSON.stringify(event)));
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const typesSent = () => state.sent.map(event => event.type);
const sentOf = (type: string) => state.sent.filter(event => event.type === type);

/** Liten fake for domenet: sideband-et skal ikke vite hvordan Nyhavna er bygget. */
function fakeConversation(overrides: Partial<LiveConversation> = {}) {
  return {
    execute: vi.fn((): ToolOutcome => ({ result: { facts: ['verifisert'] } })),
    observeBrowserResult: vi.fn(),
    noteIfChanged: vi.fn(() => null),
    mapContextIfChanged: vi.fn(() => null),
    onMapSelection: vi.fn(() => null),
    setBoardState: vi.fn(),
    ...overrides,
  } as unknown as LiveConversation & { execute: ReturnType<typeof vi.fn>; observeBrowserResult: ReturnType<typeof vi.fn> };
}

const delegationCreated = (id = 'del_1', responseId = 'resp_1') => ({ type: 'session.delegation.created', offset_ms: 3600, delegation: { id, type: 'delegation', target: 'responses', response_id: responseId } });
const nested = (delegationId: string, event: Record<string, unknown>) => ({ type: 'response.event', delegation_id: delegationId, event });
const functionCall = (callId: string, name: string, args = '{}') => ({ type: 'response.output_item.done', item: { type: 'function_call', call_id: callId, name, arguments: args } });
const completed = (responseId: string, usage?: unknown) => ({ type: 'response.completed', response: { id: responseId, status: 'completed', output: [], ...(usage ? { usage } : {}) } });

let timings: DelegationTiming[];
let usages: Array<LiveUsage & { reason: string }>;
async function connect(conversation: LiveConversation, options: Record<string, unknown> = {}) {
  return connectLiveSideband('live_test', TOKEN, conversation, {
    backendInstructions: 'GRUNNINSTRUKS',
    onTiming: timing => timings.push(timing),
    onUsage: usage => usages.push(usage),
    ...options,
  });
}

beforeEach(() => { state.sent = []; state.cleanup = undefined; state.ended.mockReset(); state.ended.mockResolvedValue(true); timings = []; usages = []; });
afterEach(() => { state.cleanup?.('connection'); disposeMapBridge(TOKEN); vi.useRealTimers(); });

describe('live sideband delegation loop', () => {
  it('runs a knowledge tool at once and continues the backend exactly once per round', async () => {
    const conversation = fakeConversation();
    await connect(conversation);
    emit(delegationCreated());
    emit(nested('del_1', { type: 'response.created', response: { id: 'resp_1' } }));
    emit(nested('del_1', functionCall('call_1', 'get_place_facts', '{"poi_id":"dora"}')));
    await flush();
    // Utført på output_item.done, ikke ved response.completed: ventetiden er brukerens.
    expect(conversation.execute).toHaveBeenCalledWith('get_place_facts', { poi_id: 'dora' });
    expect(sentOf('response.item.create')[0]).toMatchObject({ item: { type: 'function_call_output', call_id: 'call_1', output: JSON.stringify({ facts: ['verifisert'] }) } });
    // Ingen response.create før runden er lukket – ellers ber vi om svar midt i.
    expect(typesSent()).not.toContain('response.create');
    emit(nested('del_1', completed('resp_1')));
    await flush();
    expect(sentOf('response.create')).toHaveLength(1);
  });

  it('does not treat an empty lifecycle snapshot as a round without tool calls', async () => {
    const conversation = fakeConversation();
    await connect(conversation);
    emit(delegationCreated());
    emit(nested('del_1', { type: 'response.created', response: { id: 'resp_1' } }));
    emit(nested('del_1', functionCall('call_1', 'get_place_facts')));
    emit(nested('del_1', completed('resp_1')));
    await flush();
    expect(sentOf('response.create')).toHaveLength(1);
  });

  it('ends the delegation without a continuation when the round had no tool calls', async () => {
    const conversation = fakeConversation();
    await connect(conversation);
    emit(delegationCreated());
    emit(nested('del_1', { type: 'response.created', response: { id: 'resp_1' } }));
    emit(nested('del_1', completed('resp_1')));
    await flush();
    expect(typesSent()).not.toContain('response.create');
  });

  it('keeps the browser in a stable work state until the backend is ready to answer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const bridge = getMapBridge(TOKEN);
    const activities: string[] = [];
    bridge.subscribe(message => { if (message.type === 'activity') activities.push(message.activity); });
    await connect(fakeConversation());
    emit(delegationCreated());
    emit(nested('del_1', { type: 'response.created', response: { id: 'resp_1' } }));
    emit(nested('del_1', completed('resp_1')));
    await vi.advanceTimersByTimeAsync(0);
    expect(activities).toEqual(['working', 'answering']);
    await vi.advanceTimersByTimeAsync(4000);
    expect(activities).toEqual(['working', 'answering', 'idle']);
  });

  it('sends map work to the browser and mirrors the browser answer in conversation state', async () => {
    const conversation = fakeConversation();
    const bridge = getMapBridge(TOKEN);
    const seen: Array<{ id: string; name: string }> = [];
    bridge.subscribe(message => { if (message.type === 'map') seen.push({ id: message.directive.id, name: message.directive.name }); });
    await connect(conversation);
    emit(delegationCreated());
    emit(nested('del_1', { type: 'response.created', response: { id: 'resp_1' } }));
    emit(nested('del_1', functionCall('call_map', 'highlight_places', '{"poi_ids":["a","b"]}')));
    await flush();
    expect(seen[0].name).toBe('highlight_places');
    expect(conversation.execute).not.toHaveBeenCalled();
    expect(sentOf('response.item.create')).toHaveLength(0);
    bridge.resolve(seen[0].id, { ok: true, highlighted: ['a', 'b'] });
    await flush();
    expect(conversation.observeBrowserResult).toHaveBeenCalledWith('highlight_places', { poi_ids: ['a', 'b'] }, { ok: true, highlighted: ['a', 'b'] });
    expect(sentOf('response.item.create')[0]).toMatchObject({ item: { call_id: 'call_map', output: JSON.stringify({ ok: true, highlighted: ['a', 'b'] }) } });
  });

  it('tells the backend the map did not answer instead of letting it claim a move', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const conversation = fakeConversation();
    await connect(conversation);
    emit(delegationCreated());
    emit(nested('del_1', { type: 'response.created', response: { id: 'resp_1' } }));
    emit(nested('del_1', functionCall('call_map', 'show_place', '{"poi_id":"dora"}')));
    emit(nested('del_1', completed('resp_1')));
    await vi.advanceTimersByTimeAsync(10000);
    expect(sentOf('response.item.create')[0]).toMatchObject({ item: { call_id: 'call_map', output: JSON.stringify({ error: 'Kartet svarte ikke. Ikke påstå at det ble flyttet.' }) } });
    expect(sentOf('response.create')).toHaveLength(1);
  });

  it('supersedes an unfinished delegation when the user moves on, without continuing it', async () => {
    const conversation = fakeConversation();
    await connect(conversation);
    emit(delegationCreated('del_1', 'resp_1'));
    emit(nested('del_1', { type: 'response.created', response: { id: 'resp_1' } }));
    emit(nested('del_1', functionCall('call_map', 'show_place', '{"poi_id":"dora"}')));
    emit(nested('del_1', completed('resp_1')));
    emit(delegationCreated('del_2', 'resp_2'));
    await flush();
    expect(sentOf('response.item.create')[0]).toMatchObject({ item: { call_id: 'call_map', output: JSON.stringify({ error: 'superseded: brukeren gikk videre' }) } });
    expect(typesSent()).not.toContain('response.create');
    expect(timings.at(-1)).toMatchObject({ delegation_id: 'del_1', end: 'superseded' });
  });

  it('appends the tour note last in the backend instructions and the map context as silent thinking', async () => {
    const conversation = fakeConversation({ noteIfChanged: vi.fn(() => 'NOTAT') as never, mapContextIfChanged: vi.fn(() => 'Kartet viser nå: 1 A.') as never });
    await connect(conversation);
    emit(delegationCreated());
    emit(nested('del_1', { type: 'response.created', response: { id: 'resp_1' } }));
    emit(nested('del_1', functionCall('call_1', 'open_theme')));
    emit(nested('del_1', completed('resp_1')));
    await flush();
    expect(sentOf('session.update')[0]).toMatchObject({ session: { delegation: { type: 'responses', responses: { instructions: 'GRUNNINSTRUKS\n\nNOTAT' } } } });
    expect(sentOf('session.thinking.append')[0]).toMatchObject({ delegation_id: null, content: 'Kartet viser nå: 1 A.' });
  });

  it('stops an endless tool loop at the round limit and restores tool use afterwards', async () => {
    const conversation = fakeConversation();
    await connect(conversation, { maxRounds: 2 });
    emit(delegationCreated());
    for (let round = 1; round <= 2; round += 1) {
      emit(nested('del_1', { type: 'response.created', response: { id: `resp_${round}` } }));
      emit(nested('del_1', functionCall(`call_${round}`, 'get_place_facts')));
      emit(nested('del_1', completed(`resp_${round}`)));
      await flush();
    }
    expect(sentOf('session.update').at(-1)).toMatchObject({ session: { delegation: { responses: { tool_choice: 'none' } } } });
    emit(nested('del_1', { type: 'response.created', response: { id: 'resp_3' } }));
    emit(nested('del_1', completed('resp_3')));
    await flush();
    expect(sentOf('session.update').at(-1)).toMatchObject({ session: { delegation: { responses: { tool_choice: 'auto' } } } });
  });

  it('speaks a map selection as commentary and moves the map itself', async () => {
    const conversation = fakeConversation({
      onMapSelection: vi.fn(() => ({ commentary: 'Brukeren valgte temaet «Mat».', directives: [{ name: 'highlight_places', args: { poi_ids: ['a'] } }] })) as never,
    });
    const bridge = getMapBridge(TOKEN);
    const seen: string[] = [];
    bridge.subscribe(message => { if (message.type === 'map') { seen.push(message.directive.id); bridge.resolve(message.directive.id, { ok: true }); } });
    const handle = await connect(conversation);
    handle.onContext({ kind: 'theme', id: 'mat', label: 'Mat' });
    await flush();
    expect(conversation.onMapSelection).toHaveBeenCalledWith('theme', 'mat');
    expect(seen).toHaveLength(1);
    expect(sentOf('session.commentary.append')[0]).toMatchObject({ delegation_id: null, content: 'Brukeren valgte temaet «Mat».' });
  });

  it('drops a delayed theme commentary when a place is selected afterward', async () => {
    const conversation = fakeConversation({
      onMapSelection: vi.fn((kind: string) => kind === 'theme'
        ? { commentary: 'Servering med flere steder', directives: [{ name: 'highlight_places', args: { poi_ids: ['a'] } }] }
        : { commentary: 'Bare Dora Kaffebar', directives: [] }) as never,
    });
    const bridge = getMapBridge(TOKEN);
    let pendingId = '';
    bridge.subscribe(message => { if (message.type === 'map') pendingId = message.directive.id; });
    const handle = await connect(conversation);
    handle.onContext({ kind: 'theme', id: 'mat' });
    handle.onContext({ kind: 'place', id: 'dora' });
    expect(pendingId).not.toBe('');
    bridge.resolve(pendingId, { ok: true });
    await flush();
    expect(sentOf('session.commentary.append').map(e => e.content)).toEqual(['Bare Dora Kaffebar']);
    expect(conversation.observeBrowserResult).not.toHaveBeenCalled();
  });

  it('turns a board-state message into silent context, never speech', async () => {
    const conversation = fakeConversation({ mapContextIfChanged: vi.fn(() => 'Tema i kartet: Mat.') as never });
    const handle = await connect(conversation);
    handle.onContext({ kind: 'state', selected_category_id: 'mat', selected_place_id: null, travel_mode: 'walk' });
    await flush();
    expect(conversation.setBoardState).toHaveBeenCalledWith({ selected_category_id: 'mat', selected_place_id: null, travel_mode: 'walk' });
    expect(sentOf('session.thinking.append')[0]).toMatchObject({ content: 'Tema i kartet: Mat.' });
    expect(typesSent()).not.toContain('session.commentary.append');
  });

  it('logs voice seconds and backend tokens separately and closes the session gracefully', async () => {
    const conversation = fakeConversation();
    const handle = await connect(conversation);
    emit(delegationCreated());
    emit(nested('del_1', { type: 'response.created', response: { id: 'resp_1' } }));
    emit(nested('del_1', completed('resp_1', { input_tokens: 1000, input_tokens_details: { cached_tokens: 400 }, output_tokens: 200 })));
    emit({ type: 'session.usage.updated', usage: { seconds: 60 } });
    emit({ type: 'session.usage.updated', usage: { seconds: 120 } });
    const ending = handle.end('idle');
    expect(typesSent()).toContain('session.close');
    emit({ type: 'session.closed', reason: 'close_requested', usage: { seconds: 130 } });
    await ending;
    // Snapshot, ikke sum: 60 + 120 + 130 ville vært feil.
    expect(usages.at(-1)).toMatchObject({ voiceSeconds: 130, backendResponses: 1, backendInputTokens: 1000, backendCachedTokens: 400, backendOutputTokens: 200, complete: true, reason: 'close_requested' });
    expect(usages.at(-1)!.estimatedUsd).toBeGreaterThan(0.1);
    expect(state.ended).toHaveBeenCalledWith(TOKEN, 'idle');
  });

  it('keeps the session alive when a moderation error arrives', async () => {
    const conversation = fakeConversation();
    await connect(conversation);
    emit({ type: 'error', error: { type: 'invalid_request_error', code: 'content_filter', message: 'blocked' } });
    expect(state.ended).not.toHaveBeenCalled();
  });

  it('records ack and answer words on opposite sides of the backend result', async () => {
    const conversation = fakeConversation();
    await connect(conversation, { maxRounds: 6 });
    emit({ type: 'session.input_transcript.delta', delta: 'Hva er i nærheten?', start_ms: 1000, end_ms: 2000 });
    emit(delegationCreated());
    emit({ type: 'session.output_transcript.delta', delta: 'Jeg sjekker.', start_ms: 2100, end_ms: 2600 });
    emit(nested('del_1', { type: 'response.created', response: { id: 'resp_1' } }));
    emit(nested('del_1', completed('resp_1')));
    await flush();
    emit({ type: 'session.output_transcript.delta', delta: 'Det er tre kafeer.', start_ms: 3000, end_ms: 4000 });
    state.cleanup?.('manual');
    expect(timings.at(-1)).toMatchObject({ delegation_id: 'del_1', offset_ms: 3600, user_end_ms: 2000, ack_words: 'Jeg sjekker.', answer_words: 'Det er tre kafeer.' });
  });
});

describe('live sideband when Live closes the session on its own', () => {
  it('frees the supervisor slot on remote_hangup so the next start is not refused', async () => {
    await connect(fakeConversation());
    emit({ type: 'session.closed', reason: 'remote_hangup', usage: { seconds: 15 } });
    await flush();
    expect(state.ended).toHaveBeenCalledWith(TOKEN, 'connection');
    expect(usages[0]).toMatchObject({ reason: 'remote_hangup', voiceSeconds: 15 });
  });
});

describe('hosted metering and ownership', () => {
  it('counts orphan terminal responses once and keeps cumulative voice monotonic', async () => {
    const events: unknown[] = [];
    await connect(fakeConversation(), { hosted: true, onMeteringEvent: (event: unknown) => events.push(event) });
    emit(nested('gone', { type: 'response.created', response: { id: 'orphan' } }));
    const terminal = nested('gone', completed('orphan', { input_tokens: 100, output_tokens: 10, input_tokens_details: { cached_tokens: 20 }, secret: 'SENTINEL' }));
    emit(terminal); emit(terminal);
    emit({ type: 'session.usage.updated', usage: { seconds: 20 } });
    emit({ type: 'session.closed', usage: { seconds: 10 } });
    expect(usages[0]).toMatchObject({ backendResponses: 1, voiceSeconds: 20, complete: true });
    expect(events.filter(e => (e as {type:string}).type === 'backend.terminal')).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain('SENTINEL');
  });

  it('never calls hosted timing diagnostics with transcript, arguments or errors', async () => {
    await connect(fakeConversation(), { hosted: true });
    emit(delegationCreated());
    emit({ type: 'session.output_transcript.delta', delta: 'SENTINEL' });
    emit(nested('del_1', { type: 'response.failed', response: { id: 'resp_1', error: { message: 'SENTINEL' } } }));
    state.cleanup?.('manual');
    expect(timings).toEqual([]);
    expect(usages[0].complete).toBe(false);
  });
});


describe('hosted graceful shutdown', () => {
  it('installs its waiter before session.close and returns one shared shutdown promise', async () => {
    const events: unknown[] = [];
    const owner = { setCleanup: vi.fn(), end: vi.fn(async () => true) };
    const handle = await connect(fakeConversation(), { hosted: true, bridge: createMapBridge(), supervisor: owner, onMeteringEvent: (event: unknown) => events.push(event) });
    expect(getLiveSideband(TOKEN)).toBeUndefined();
    const socket = state.socket as { send: (data: string) => void };
    const original = socket.send.bind(socket);
    socket.send = data => {
      original(data);
      if (JSON.parse(data).type === 'session.close') emit({ type: 'session.closed', usage: { seconds: 8 } });
    };
    const ending = handle.end('manual');
    expect(handle.end('manual')).toBe(ending);
    await ending;
    expect(owner.end).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toMatchObject({ type: 'finalized', complete: true, finalVoiceConfirmed: true });
  });

  it('rejects commands while draining but observes late terminal usage', async () => {
    const owner = { setCleanup: vi.fn(), end: vi.fn(async () => true) };
    const handle = await connect(fakeConversation(), { hosted: true, supervisor: owner });
    emit(nested('gone', { type: 'response.created', response: { id: 'late' } }));
    const ending = handle.end('manual');
    const count = state.sent.length;
    handle.onContext({ kind: 'text', text: 'SENTINEL' });
    emit(nested('gone', completed('late', { input_tokens: 3, output_tokens: 2, input_tokens_details: { cached_tokens: 0 } })));
    expect(state.sent).toHaveLength(count);
    emit({ type: 'session.closed', usage: { seconds: 8 } });
    await ending;
    expect(usages[0]).toMatchObject({ complete: true, backendResponses: 1 });
  });

  it.each([
    ['missing output', { input_tokens: 3, input_tokens_details: { cached_tokens: 0 } }],
    ['negative', { input_tokens: -1, output_tokens: 2, input_tokens_details: { cached_tokens: 0 } }],
    ['invalid cache', { input_tokens: 1, output_tokens: 2, input_tokens_details: { cached_tokens: 3 } }],
  ])('keeps %s usage incomplete', async (_label, usage) => {
    await connect(fakeConversation(), { hosted: true });
    emit(nested('gone', completed('bad', usage)));
    emit({ type: 'session.closed', usage: { seconds: 5 } });
    expect(usages[0].complete).toBe(false);
  });

  it('keeps an observed but unterminated backend incomplete', async () => {
    await connect(fakeConversation(), { hosted: true });
    emit(nested('gone', { type: 'response.created', response: { id: 'missing' } }));
    emit({ type: 'session.closed', usage: { seconds: 5 } });
    expect(usages[0].complete).toBe(false);
  });

  it('keeps unknown model pricing incomplete', async () => {
    await connect(fakeConversation(), { hosted: true, backendModelName: 'unknown' });
    emit(nested('gone', completed('bad', { input_tokens: 3, output_tokens: 2, input_tokens_details: { cached_tokens: 0 } })));
    emit({ type: 'session.closed', usage: { seconds: 5 } });
    expect(usages[0].complete).toBe(false);
  });

  it('times out gracefully with incomplete evidence when final usage is missing', async () => {
    vi.useFakeTimers();
    const handle = await connect(fakeConversation(), { hosted: true });
    const ending = handle.end('limit');
    await vi.advanceTimersByTimeAsync(5000);
    await ending;
    expect(usages[0].complete).toBe(false);
  });
});
