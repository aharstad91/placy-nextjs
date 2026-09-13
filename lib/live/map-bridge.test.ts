import { afterEach, describe, expect, it, vi } from 'vitest';
import { disposeMapBridge, getMapBridge, MAP_CANCELLED_OUTPUT, MAP_TIMEOUT_OUTPUT } from '@/lib/live/map-bridge';
import type { LiveServerMessage } from '@/lib/live/types';

afterEach(() => { disposeMapBridge('token'); vi.useRealTimers(); });

const directiveIds = (messages: LiveServerMessage[]) => messages.flatMap(m => m.type === 'map' ? [m.directive.id] : []);

describe('map bridge', () => {
  it('queues directives sent before the browser connects and drains them on subscribe', () => {
    const bridge = getMapBridge('token');
    const first = bridge.dispatch('show_place', { poi_id: 'dora' });
    const second = bridge.dispatch('clear_highlights', {});
    const seen: LiveServerMessage[] = [];
    bridge.subscribe(message => seen.push(message));
    expect(directiveIds(seen)).toEqual([first.id, second.id]);
  });
  it('resolves each directive once with the browser output', async () => {
    const bridge = getMapBridge('token');
    bridge.subscribe(() => {});
    const { id, result } = bridge.dispatch('highlight_places', { poi_ids: ['a'] });
    expect(bridge.resolve(id, { ok: true, highlighted: ['a'] })).toBe(true);
    expect(await result).toEqual({ ok: true, highlighted: ['a'] });
    expect(bridge.resolve(id, { ok: true })).toBe(false);
    expect(bridge.resolve('ukjent', { ok: true })).toBe(false);
  });
  it('times out a silent browser with a directive the model must not overstate', async () => {
    vi.useFakeTimers();
    const bridge = getMapBridge('token');
    const { result } = bridge.dispatch('show_place', { poi_id: 'dora' });
    await vi.advanceTimersByTimeAsync(10000);
    expect(await result).toEqual(MAP_TIMEOUT_OUTPUT);
  });
  it('cancels a superseded directive and stops it from reaching a late subscriber', async () => {
    const bridge = getMapBridge('token');
    const { id, result } = bridge.dispatch('show_place', { poi_id: 'dora' });
    bridge.cancel(id);
    expect(await result).toEqual(MAP_CANCELLED_OUTPUT);
    const seen: LiveServerMessage[] = [];
    bridge.subscribe(message => seen.push(message));
    expect(directiveIds(seen)).toEqual([]);
  });
  it('caps the queue so an absent browser cannot grow it without bound', () => {
    const bridge = getMapBridge('token');
    for (let i = 0; i < 25; i += 1) bridge.dispatch('clear_highlights', {});
    const seen: LiveServerMessage[] = [];
    bridge.subscribe(message => seen.push(message));
    expect(seen).toHaveLength(20);
  });
  it('releases every waiting directive when the session closes', async () => {
    const bridge = getMapBridge('token');
    const { result } = bridge.dispatch('show_place', { poi_id: 'dora' });
    bridge.close();
    expect(await result).toEqual(MAP_TIMEOUT_OUTPUT);
  });
});
