import { describe, expect, it } from 'vitest';
import { backendCostUsd, liveVoiceCostUsd } from '@/lib/live/usage';

describe('live usage estimates', () => {
  it('bills voice per second, not per started minute', () => {
    expect(liveVoiceCostUsd(60)).toBeCloseTo(0.05, 10);
    expect(liveVoiceCostUsd(90)).toBeCloseTo(0.075, 10);
    expect(liveVoiceCostUsd(0)).toBe(0);
  });
  it('prices cached backend input separately and tolerates a dated snapshot name', () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 1_000_000, input_tokens_details: { cached_tokens: 500_000 } };
    // terra: 0,5M ubufret à $2 + 0,5M bufret à $0,2 + 1M ut à $12.
    expect(backendCostUsd('gpt-5.6-terra', usage)).toBeCloseTo(1 + 0.1 + 12, 6);
    expect(backendCostUsd('gpt-5.6-terra-2026-09-01', usage)).toBeCloseTo(1 + 0.1 + 12, 6);
    expect(backendCostUsd('gpt-5.6-luna', usage)).toBeCloseTo(0.1 + 0.01 + 1.2, 6);
    expect(backendCostUsd('gpt-5.6-sol', usage)).toBeCloseTo(2 + 0.2 + 20, 6);
  });
  it('returns null for a model without a price list so the total is marked incomplete', () => {
    expect(backendCostUsd('gpt-realtime-2.1-mini', { input_tokens: 10, output_tokens: 10 })).toBeNull();
  });
});
