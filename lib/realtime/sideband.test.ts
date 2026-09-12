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

it('backs off a rate-limited answer at most twice and cancels retry on a new user turn', async () => {
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
  await vi.advanceTimersByTimeAsync(5000);
  expect(state.calls).toHaveLength(4);
  emit({ type: 'input_audio_buffer.speech_started' });
  emit(failed('next-limit'));
  emit({ type: 'input_audio_buffer.speech_started' });
  await vi.advanceTimersByTimeAsync(2500);
  expect(state.calls).toHaveLength(5);
});
