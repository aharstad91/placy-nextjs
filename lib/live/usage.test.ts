import { describe, expect, it } from 'vitest';
import { backendCostUsd, liveVoiceCostUsd, normalizeBackendUsage } from '@/lib/live/usage';

describe('live usage estimates', () => {
  it('bills voice per second, not per started minute', () => {
    expect(liveVoiceCostUsd(60)).toBeCloseTo(0.05, 10);
    expect(liveVoiceCostUsd(90)).toBeCloseTo(0.075, 10);
    expect(liveVoiceCostUsd(0)).toBe(0);
  });
  it('prices cached backend input separately and tolerates a dated snapshot name', () => {
    const usage = { input_tokens: 200_000, output_tokens: 1_000_000, input_tokens_details: { cached_tokens: 100_000 } };
    // Terra: 0.1M uncached at $2 + 0.1M cached at $0.2 + 1M output at $12.
    expect(backendCostUsd('gpt-5.6-terra', usage)).toBeCloseTo(0.2 + 0.02 + 12, 6);
    expect(backendCostUsd('gpt-5.6-terra-2026-09-01', usage)).toBeCloseTo(0.2 + 0.02 + 12, 6);
    expect(backendCostUsd('gpt-5.6-luna', usage)).toBeCloseTo(0.02 + 0.002 + 1.2, 6);
    expect(backendCostUsd('gpt-5.6-sol', usage)).toBeCloseTo(0.4 + 0.04 + 20, 6);
  });
  it('returns null for a model without a price list so the total is marked incomplete', () => {
    expect(backendCostUsd('gpt-realtime-2.1-mini', { input_tokens: 10, output_tokens: 10 })).toBeNull();
  });
});

 it('rejects model lookalikes, unverified long-context Terra, and malformed units', () => {
    for (const model of ['gpt-5.6-terra-evil', 'gpt-5.6-terra-2026-99-99']) {
      expect(backendCostUsd(model, {input_tokens: 1, output_tokens: 1})).toBeNull();
    }
    expect(backendCostUsd('gpt-5.6-terra', {input_tokens: 272001, output_tokens: 1})).toBeNull();
    for (const input of [-1, 0.5, NaN, Infinity]) {
      expect(backendCostUsd('gpt-5.6-terra', {input_tokens: input, output_tokens: 1})).toBeNull();
    }
    expect(backendCostUsd('gpt-5.6-terra', {input_tokens: 1, output_tokens: 1, input_tokens_details: {cached_tokens: 2}})).toBeNull();
    expect(() => liveVoiceCostUsd(NaN)).toThrow();
    expect(() => liveVoiceCostUsd(-1)).toThrow();
 });

it('normalizes only numeric units and rejects explicit null or string counts', () => {
  expect(normalizeBackendUsage({input_tokens:1,output_tokens:2,input_tokens_details:{cached_tokens:null}})).toBeNull();
  expect(normalizeBackendUsage({input_tokens:'1',output_tokens:2})).toBeNull();
  expect(normalizeBackendUsage({input_tokens:1,output_tokens:2,text:'private'})).toEqual({input_tokens:1,output_tokens:2,input_tokens_details:{cached_tokens:0}});
});
