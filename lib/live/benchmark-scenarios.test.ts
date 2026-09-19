import { describe, expect, it } from 'vitest';
import { admitBenchmark, benchmarkFailureReason, costDistribution, expandScenarios, liabilityUsd, type BenchmarkLedgerRow } from '@/lib/live/benchmark-scenarios';
const row = (extra: Partial<BenchmarkLedgerRow> = {}): BenchmarkLedgerRow => ({ id: 'id', scenario_id: 'quiet', state: 'closed', accounting_status: 'complete', reservation_usd: 5, known_cost_usd: .3, voice_seconds: 60, backend_cost_usd: .1, invalid_usage: false, provider_closed: true, final_usage_confirmed: true, termination_reason: 'stop', ...extra });
describe('finite audio benchmark', () => {
  it('keeps authored failure evidence while withholding unknown error content', () => {
    for (const reason of ['concurrency_peer_failed', 'concurrency_isolation_failed', 'missing_map_observation', 'ended_before_requested_duration', 'unexpected_silence_termination']) {
      expect(benchmarkFailureReason(new Error(reason), 'audio_or_response_failed')).toBe(reason);
    }
    expect(benchmarkFailureReason(new Error('private provider response'), 'audio_or_response_failed')).toBe('audio_or_response_failed');
    expect(benchmarkFailureReason('private browser content', 'setup_or_start_failed')).toBe('setup_or_start_failed');
  });
  it('defaults to 18 short calls and only opts into long tests explicitly', () => {
    expect(expandScenarios('short', 3)).toHaveLength(18);
    expect(expandScenarios('short', 3).every(s => !s.durationSeconds)).toBe(true);
    expect(expandScenarios('long-26m', 1)[0].durationSeconds).toBe(1560);
    for (const count of [0, 11, Infinity, 1.5]) expect(() => expandScenarios('short', count)).toThrow();
    expect(() => expandScenarios('missing', 1)).toThrow();
  });
  it('retains reservations for incomplete and live calls and budgets concurrent starts together', () => {
    const rows = [row(), row({ accounting_status: 'incomplete' }), row({ state: 'active', known_cost_usd: 6 })];
    expect(liabilityUsd(rows)).toBe(11.3);
    expect(admitBenchmark(rows, 21.3, 2)).toBe(true);
    expect(admitBenchmark(rows, 21.29, 2)).toBe(false);
    expect(admitBenchmark(rows, NaN, 1)).toBe(false);
    expect(() => liabilityUsd([row({ known_cost_usd: NaN })])).toThrow();
  });
  it('keeps incomplete measurements out of nearest-rank distributions', () => {
    expect(costDistribution([row({ known_cost_usd: 1 }), row({ known_cost_usd: 3 }), row({ accounting_status: 'incomplete', known_cost_usd: 90 })])).toEqual({ samples: 2, incomplete: 1, medianUsd: 2, p95Usd: 3, maxUsd: 3 });
    expect(costDistribution([]).medianUsd).toBeNull();
  });
});
