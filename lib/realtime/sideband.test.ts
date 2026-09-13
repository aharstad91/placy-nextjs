import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ socket: null as unknown, calls: [] as unknown[], stopped: vi.fn(), cleanup: undefined as undefined | (() => void) }));
vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');
  class Socket extends EventEmitter {
    static OPEN = 1;
    readyState = 1;
    constructor() { super(); state.socket = this; queueMicrotask(() => this.emit('open')); }
    send(data: string) { state.calls.push(JSON.parse(data)); }
    close() { this.readyState = 3; }
  }
  return { default: Socket };
});
vi.mock('@/lib/realtime/server-session', () => ({ RealtimeSupervisor: class {
  setCleanup(_token: string, fn: () => void) { state.cleanup = fn; }
  end = state.stopped;
} }));
import { connectSideband } from '@/lib/realtime/sideband';
beforeEach(() => { state.calls = []; state.stopped.mockResolvedValue(true); });
afterEach(() => { state.cleanup?.(); vi.useRealTimers(); });
const emit = (event: unknown) => (state.socket as EventEmitter).emit('message', Buffer.from(JSON.stringify(event)));
describe('sideband tool ownership', () => {
  it('executes knowledge once and waits for client map acknowledgement before continuing once', async () => {
    const execute = vi.fn(() => ({ facts: ['verified'] }));
    await connectSideband('rtc_test', 'token', execute);
    const done = { type: 'response.done', response: { id: 'r1', status: 'completed', output: [
      { type: 'function_call', call_id: 'knowledge', name: 'get_board_facts', arguments: '{}' },
      { type: 'function_call', call_id: 'map', name: 'show_place', arguments: '{"poi_id":"dora"}' },
    ] } };
    emit(done); emit(done);
    expect(execute).toHaveBeenCalledOnce();
    expect(state.calls).toHaveLength(1);
    emit({ type: 'conversation.item.done', item: { type: 'function_call_output', call_id: 'map' } });
    expect(state.calls).toHaveLength(2);
    expect(state.calls[1]).toEqual({ type: 'response.create' });
    emit({ type: 'conversation.item.done', item: { type: 'function_call_output', call_id: 'map' } });
    expect(state.calls).toHaveLength(2);
  });
  it('does not continue stale tool batches after a new user turn', async () => {
    await connectSideband('rtc_test', 'token', () => ({}));
    emit({ type: 'response.done', response: { id: 'r2', status: 'completed', output: [{ type: 'function_call', call_id: 'map2', name: 'show_place' }] } });
    emit({ type: 'input_audio_buffer.speech_started' });
    emit({ type: 'conversation.item.done', item: { type: 'function_call_output', call_id: 'map2' } });
    expect(state.calls).toHaveLength(0);
  });
});

it('ignores a late completed response after a manual map boundary', async () => {
  const execute = vi.fn();
  await connectSideband('rtc_test', 'token', execute);
  emit({ type: 'response.created', response: { id: 'old-map' } });
  emit({ type: 'conversation.item.added', item: { role: 'system', content: [{ text: 'Placy: brukeren tar over kartet; avbryt tidligere kartkommandoer.' }] } });
  emit({ type: 'response.done', response: { id: 'old-map', status: 'completed', output: [{ type: 'function_call', name: 'get_board_facts', call_id: 'old-tool' }] } });
  expect(execute).not.toHaveBeenCalled();
  expect(state.calls).toEqual([{ type: 'response.cancel' }]);
});

it('times out a missing map acknowledgement once and cancels the deadline on a new turn', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  await connectSideband('rtc_test', 'token', () => ({}));
  const done = (id: string) => ({ type: 'response.done', response: { id, status: 'completed', output: [{ type: 'function_call', call_id: id, name: 'show_place' }] } });
  emit(done('missing'));
  await vi.advanceTimersByTimeAsync(10000);
  expect(state.calls).toHaveLength(2);
  expect(state.calls[0]).toMatchObject({ item: { type: 'function_call_output', call_id: 'missing' } });
  expect(state.calls[1]).toEqual({ type: 'response.create' });
  emit(done('cancelled'));
  emit({ type: 'conversation.item.added', item: { role: 'user' } });
  await vi.advanceTimersByTimeAsync(10000);
  expect(state.calls).toHaveLength(2);
});

it('serializes text follow-up cancellation and creation on the server socket', async () => {
  await connectSideband('rtc_test', 'token', () => ({}));
  emit({ type: 'response.created', response: { id: 'prior' } });
  emit({ type: 'conversation.item.added', item: { role: 'user', content: [{ type: 'input_text', text: 'Neste spørsmål' }] } });
  expect(state.calls).toEqual([{ type: 'response.cancel' }, { type: 'response.create' }]);
});

it('deduplicates a user item across lifecycle event names', async () => {
  await connectSideband('rtc_test', 'token', () => ({}));
  const item = { id: 'user-one', role: 'user', content: [{ type: 'input_text', text: 'Hei' }] };
  emit({ type: 'conversation.item.added', item });
  emit({ type: 'conversation.item.created', item });
  expect(state.calls).toEqual([{ type: 'response.create' }]);
});
it('still stops an idle session after manually interrupting a response', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  state.stopped.mockClear();
  await connectSideband('rtc_test', 'token', () => ({}));
  emit({ type: 'response.created', response: { id: 'interrupted' } });
  emit({ type: 'conversation.item.added', item: { role: 'system', content: [{ text: 'Placy: brukeren tar over kartet; avbryt tidligere kartkommandoer.' }] } });
  emit({ type: 'response.done', response: { id: 'interrupted', status: 'cancelled' } });
  await vi.advanceTimersByTimeAsync(130000);
  expect(state.stopped).toHaveBeenCalledWith('token', 'idle');
});

it('backs off a rate-limited answer at most three times and cancels retry on a new user turn', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  await connectSideband('rtc_test', 'token', () => ({}));
  const failed = (id: string) => ({ type: 'response.done', response: { id, status: 'failed', status_details: { error: { code: 'rate_limit_exceeded', message: 'Please try again in 2s.' } } } });
  emit(failed('limit-one'));
  expect(state.calls).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(2499);
  expect(state.calls).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(state.calls[1]).toEqual({ type: 'response.create' });
  emit(failed('limit-two'));
  await vi.advanceTimersByTimeAsync(2500);
  expect(state.calls).toHaveLength(4);
  emit(failed('limit-three'));
  await vi.advanceTimersByTimeAsync(2500);
  expect(state.calls).toHaveLength(6);
  // Takgrensen er per minutt: tre forsøk, så gir serveren seg for denne turen.
  emit(failed('limit-four'));
  await vi.advanceTimersByTimeAsync(5000);
  expect(state.calls).toHaveLength(6);
  emit({ type: 'input_audio_buffer.speech_started' });
  emit(failed('next-limit'));
  emit({ type: 'input_audio_buffer.speech_started' });
  await vi.advanceTimersByTimeAsync(2500);
  expect(state.calls).toHaveLength(7);
});

describe('omvisningens tilstand gjennom sideband-et', () => {
  const spokenDone = (calls: Array<{ call_id: string; name: string; args?: unknown }>, id = 'r-spoken') => ({ type: 'response.done', response: { id, status: 'completed', output: [
    { type: 'message', role: 'assistant', content: [{ type: 'output_audio', transcript: 'Her er tre steder.' }] },
    ...calls.map(c => ({ type: 'function_call', call_id: c.call_id, name: c.name, arguments: JSON.stringify(c.args ?? {}) })),
  ] } });
  it('observerer kartsvaret, sender notatet og lar et alt talt svar stå uten ny videreføring', async () => {
    const observe = vi.fn();
    let noted = 0;
    const note = vi.fn(() => (noted++ === 0 ? 'Samtalenotat (data): fremhevet 1 A' : null));
    await connectSideband('rtc_test', 'token', () => ({}), { observe, note });
    emit(spokenDone([{ call_id: 'hl', name: 'highlight_places', args: { poi_ids: ['a'] } }]));
    expect(state.calls).toHaveLength(0);
    emit({ type: 'conversation.item.done', item: { type: 'function_call_output', call_id: 'hl', output: JSON.stringify({ ok: true, highlighted: [{ ord: 1, id: 'a', name: 'A' }] }) } });
    expect(observe).toHaveBeenCalledWith('highlight_places', { poi_ids: ['a'] }, { ok: true, highlighted: [{ ord: 1, id: 'a', name: 'A' }] }, 'Her er tre steder.');
    expect(state.calls).toEqual([{ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: 'Samtalenotat (data): fremhevet 1 A' }] } }]);
  });
  it('gir modellen ordet igjen med faktaene når observasjonen har data å fortsette med, selv om den alt snakket', async () => {
    const observe = vi.fn(() => 'Kartet har åpnet stedet. Fakta (data): {}');
    await connectSideband('rtc_test', 'token', () => ({}), { observe, note: () => null });
    emit(spokenDone([{ call_id: 'sp', name: 'show_place', args: { poi_id: 'a' } }], 'r-sp'));
    emit({ type: 'conversation.item.done', item: { type: 'function_call_output', call_id: 'sp', output: JSON.stringify({ ok: true, shown: 'A', poi_id: 'a' }) } });
    expect(state.calls).toEqual([
      { type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: 'Kartet har åpnet stedet. Fakta (data): {}' }] } },
      { type: 'response.create' },
    ]);
  });
  it('gir modellen ordet igjen når kartet svarer med feil, og observerer ikke feilen', async () => {
    const observe = vi.fn();
    await connectSideband('rtc_test', 'token', () => ({}), { observe, note: () => null });
    emit(spokenDone([{ call_id: 'bad', name: 'highlight_places', args: { poi_ids: ['x'] } }], 'r-bad'));
    emit({ type: 'conversation.item.done', item: { type: 'function_call_output', call_id: 'bad', output: JSON.stringify({ error: 'Ukjente kart-ID-er' }) } });
    expect(observe).not.toHaveBeenCalled();
    expect(state.calls).toEqual([{ type: 'response.create' }]);
  });
  it('fortsetter alltid etter et kunnskapsverktøy, også når modellen snakket, og sender notatet først', async () => {
    const execute = vi.fn(() => ({ ok: true, chapter: {} }));
    await connectSideband('rtc_test', 'token', execute, { note: () => 'Samtalenotat: tema nå X' });
    emit(spokenDone([{ call_id: 'k', name: 'open_theme', args: { theme_id: 'x' } }], 'r-k'));
    expect(execute).toHaveBeenCalledWith('open_theme', { theme_id: 'x' });
    expect(state.calls.map(c => (c as { type: string }).type)).toEqual(['conversation.item.create', 'conversation.item.create', 'response.create']);
    expect(state.calls[0]).toMatchObject({ item: { type: 'function_call_output', call_id: 'k' } });
    expect(state.calls[1]).toMatchObject({ item: { role: 'system', content: [{ text: 'Samtalenotat: tema nå X' }] } });
  });
  it('et stille verktøysvar (uten tale) videreføres som før', async () => {
    await connectSideband('rtc_test', 'token', () => ({}), { note: () => null });
    emit({ type: 'response.done', response: { id: 'r-silent', status: 'completed', output: [{ type: 'function_call', call_id: 's', name: 'show_place', arguments: '{"poi_id":"a"}' }] } });
    emit({ type: 'conversation.item.done', item: { type: 'function_call_output', call_id: 's', output: JSON.stringify({ ok: true, shown: 'A' }) } });
    expect(state.calls).toEqual([{ type: 'response.create' }]);
  });
});

describe('brukerens trykk i kartet', () => {
  it('legger ved dataene for et trykk og notatet før modellen får svare, i den rekkefølgen', async () => {
    const onUserText = vi.fn((text: string) => (text.includes('tema-ID mat') ? 'Kapittel (data): {"theme_id":"mat"}' : null));
    await connectSideband('rtc_test', 'token', () => ({}), { onUserText, note: () => 'Samtalenotat: tema nå Mat' });
    emit({ type: 'conversation.item.added', item: { id: 'u1', role: 'user', content: [{ type: 'input_text', text: 'Jeg valgte temaet «Mat» i kartet (tema-ID mat).' }] } });
    expect(onUserText).toHaveBeenCalledWith('Jeg valgte temaet «Mat» i kartet (tema-ID mat).');
    expect(state.calls).toEqual([
      { type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: 'Kapittel (data): {"theme_id":"mat"}' }] } },
      { type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: 'Samtalenotat: tema nå Mat' }] } },
      { type: 'response.create' },
    ]);
    state.calls = [];
    emit({ type: 'conversation.item.added', item: { id: 'u2', role: 'user', content: [{ type: 'input_text', text: 'Hva koster det?' }] } });
    // Forrige svar er ikke ferdig: det avbrytes først, så kommer notatet og det nye svaret.
    expect(state.calls).toEqual([
      { type: 'response.cancel' },
      { type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: 'Samtalenotat: tema nå Mat' }] } },
      { type: 'response.create' },
    ]);
  });
});

describe('tidsmåling per tur', () => {
  it('måler fra brukerens input til første ord, første kartkall, kart-ok og avgjort tur, runde for runde', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const onTurn = vi.fn();
    await connectSideband('rtc_test', 'token', () => ({ ok: true }), { note: () => null, onTurn });
    emit({ type: 'conversation.item.added', item: { id: 'u1', role: 'user', content: [{ type: 'input_text', text: 'Kaféer og kunst' }] } });
    vi.advanceTimersByTime(1500);
    emit({ type: 'response.created', response: { id: 'r1' } });
    emit({ type: 'response.done', response: { id: 'r1', status: 'completed', usage: { input_tokens: 7000, output_tokens: 30, input_token_details: { cached_tokens: 6000 } }, output: [{ type: 'function_call', call_id: 'k', name: 'set_interests', arguments: '{"interests":["kaféer"]}' }] } });
    vi.advanceTimersByTime(2000);
    emit({ type: 'response.created', response: { id: 'r2' } });
    emit({ type: 'response.output_audio_transcript.delta', delta: 'Da begynner vi ' });
    emit({ type: 'response.output_audio_transcript.delta', delta: 'med kaféene.' });
    emit({ type: 'output_audio_buffer.started' });
    vi.advanceTimersByTime(1000);
    emit({ type: 'response.output_item.done', item: { type: 'function_call', call_id: 'hl', name: 'highlight_places' } });
    emit({ type: 'response.done', response: { id: 'r2', status: 'completed', output: [
      { type: 'message', role: 'assistant' },
      { type: 'function_call', call_id: 'hl', name: 'highlight_places', arguments: '{"poi_ids":["a"]}' },
    ] } });
    vi.advanceTimersByTime(500);
    emit({ type: 'conversation.item.done', item: { type: 'function_call_output', call_id: 'hl', output: JSON.stringify({ ok: true, highlighted: [{ ord: 1, id: 'a', name: 'A' }] }) } });
    expect(onTurn).toHaveBeenCalledOnce();
    expect(onTurn.mock.calls[0][0]).toEqual({
      turn: 1, source: 'text',
      first_audio_ms: 3500, first_words: 'Da begynner vi med kaféene.', first_words_ms: 3500,
      first_map_call: 'highlight_places', first_map_args: null, first_map_call_ms: 4500, map_ok_ms: 5000,
      rounds: [
        { done_ms: 1500, output: ['fn:set_interests'], status: 'completed', input_tokens: 7000, cached_tokens: 6000, output_tokens: 30 },
        { done_ms: 4500, output: ['message', 'fn:highlight_places'], status: 'completed', input_tokens: 0, cached_tokens: 0, output_tokens: 0 },
      ],
      settled_ms: 5000, end: 'done',
    });
  });
  it('avgjør en pågående tur som avbrutt når brukeren begynner å snakke, og starter neste ved talens slutt', async () => {
    const onTurn = vi.fn();
    await connectSideband('rtc_test', 'token', () => ({}), { onTurn });
    emit({ type: 'conversation.item.added', item: { id: 'u1', role: 'user', content: [{ type: 'input_text', text: 'Hei' }] } });
    emit({ type: 'input_audio_buffer.speech_started' });
    expect(onTurn).toHaveBeenCalledOnce();
    expect(onTurn.mock.calls[0][0]).toMatchObject({ turn: 1, source: 'text', end: 'interrupted', rounds: [] });
    emit({ type: 'input_audio_buffer.speech_stopped' });
    emit({ type: 'response.created', response: { id: 'v1' } });
    emit({ type: 'response.done', response: { id: 'v1', status: 'completed', output: [{ type: 'message' }] } });
    expect(onTurn).toHaveBeenCalledTimes(2);
    expect(onTurn.mock.calls[1][0]).toMatchObject({ turn: 2, source: 'voice', end: 'done', rounds: [{ output: ['message'] }] });
  });
});
