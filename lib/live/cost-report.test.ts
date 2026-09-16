import { describe, expect, it, vi } from 'vitest';
import { buildCostReport, costRow, costRowsCsv, csvCell, readCostRows, SESSION_COLUMNS, type CostSession, type CostEvent, type CostReader } from '@/lib/live/cost-report';
const cutoff = '2026-09-17T00:00:00Z';
function session(overrides: Partial<CostSession> = {}): CostSession {
  return { id: '001', tenant_id: 'nyhavna', customer_id: null, project_id: null, internal_demo_id: 'nyhavna', provider_session_id: 'provider-1',
    environment: 'test', test_run_id: 'run-1', scenario_id: 'short', created_at: '2026-09-16T23:00:00Z', ended_at: '2026-09-16T23:02:00Z',
    config_version: 'c1', dataset_version: 'd1', models: { voice: 'gpt-live-1', backend: 'gpt-5.6-terra', speaker: 'willow' },
    rate_snapshot: { version: 'r1', voiceUsdPerMinute: 0.05 }, voice_seconds: 120, backend_cost_usd: 0.02, known_cost_usd: 0.12,
    accounting_status: 'complete', termination_reason: 'stopped', ...overrides };
}
const event: CostEvent = { response_id: 'response-1', model: 'gpt-5.6-terra', input_tokens: 1000, cached_tokens: 200, output_tokens: 500, cost_usd: 0.02, evidence_status: 'valid' };
describe('cost evidence and statistics', () => {
  it('reconciles durable component amounts and preserves cached tokens without double counting', () => {
    const row = costRow(session(), [event]);
    expect(row.knownVoiceUsd).toBeCloseTo(0.1); expect(row.knownTotalUsd).toBeCloseTo(0.12);
    expect(row).toMatchObject({ inputTokens: 1000, cachedTokens: 200, outputTokens: 500, accountingStatus: 'complete', reconciles: true, durationSeconds: 120 });
  });
  it('excludes incomplete and provisional costs from complete totals and percentiles', () => {
    const rows = [1,2,3,4].map(n => costRow(session({ voice_seconds: n*120, known_cost_usd: n*0.1 + 0.02 }), [event]));
    rows.push(costRow(session({ accounting_status: 'incomplete', voice_seconds: 12000, known_cost_usd: 10.02 }), [event]));
    rows.push(costRow(session({ accounting_status: 'provisional' }), [event]));
    const group = buildCostReport(rows, cutoff).groups[0];
    expect(group).toMatchObject({ attemptedCount: 6, completeCount: 4, incompleteCount: 1, provisionalCount: 1 });
    expect(group.medianUsd).toBeCloseTo(0.27); expect(group.p95Usd).toBeCloseTo(0.42); expect(group.maxUsd).toBeCloseTo(0.42);
    expect(group.completeTotalUsd).toBeCloseTo(1.08); expect(group.incompleteKnownLowerBoundUsd).toBeCloseTo(10.02);
  });
  it('keeps unknown prices visibly incomplete and does not invent missing voice usage', () => {
    const row = costRow(session({ voice_seconds: null }), [{ ...event, cost_usd: null, evidence_status: 'unknown_rate' }]);
    expect(row).toMatchObject({ accountingStatus: 'incomplete', knownVoiceUsd: null, unknownUsageEvents: 1 });
    expect(buildCostReport([row], cutoff).groups[0]).toMatchObject({ completeCount: 0, medianUsd: null, p95Usd: null, maxUsd: null });
  });
  it('downgrades complete when events do not reconcile to session checkpoint', () => {
    expect(costRow(session(), []).accountingStatus).toBe('incomplete');
  });
  it('separates synthetic runs, customer identity, environment and scenario', () => {
    const rows = [session(), session({ test_run_id: 'run-2' }), session({ test_run_id: null, customer_id: 'customer', project_id: 'project', internal_demo_id: null }), session({ environment: 'production' }), session({ scenario_id: 'long' })].map(s => costRow(s, [event]));
    expect(buildCostReport(rows, cutoff).groups).toHaveLength(5);
    expect(buildCostReport([], cutoff)).toMatchObject({ rows: [], groups: [] });
  });
  it('explicitly projects output and never selects or exports owner tokens', () => {
    const row = costRow({ ...session(), owner_token: 'SECRET' } as CostSession, [event]);
    expect(SESSION_COLUMNS).not.toContain('owner_token'); expect(JSON.stringify(row)).not.toContain('SECRET'); expect(costRowsCsv([row])).not.toContain('owner_token');
  });
});
describe('complete keyset reads', () => {
  it('reads 1001 sessions and 1001 events even with a lower server page cap; forwards filters and fixed cutoff', async () => {
    const sessions = Array.from({ length: 1001 }, (_, i) => session({ id: String(i).padStart(4, '0') }));
    const events = Array.from({ length: 1001 }, (_, i) => ({ ...event, response_id: String(i).padStart(4, '0') }));
    const filters = { tenant: 'nyhavna', customer: 'customer', environment: 'test', testRun: 'run-1' };
    const reader: CostReader = {
      sessions: vi.fn(async r => { expect(r.filters).toEqual(filters); expect(r.cutoff).toBe(cutoff); return sessions.filter(s => !r.after || s.id > r.after).slice(0, 500); }),
      events: vi.fn(async r => { expect(r.cutoff).toBe(cutoff); return r.sessionId === '0000' ? events.filter(e => !r.after || e.response_id > r.after).slice(0, 500) : []; }),
    };
    const rows = await readCostRows(reader, filters, cutoff);
    expect(rows).toHaveLength(1001); expect(new Set(rows.map(r => r.sessionId)).size).toBe(1001);
    expect(rows[0].usageEventCount).toBe(1001); expect(reader.sessions).toHaveBeenCalledTimes(4);
  });
  it('fails instead of returning partial financial data on denied reads', async () => {
    const reader: CostReader = { sessions: async () => { throw new Error('42501'); }, events: async () => [] };
    await expect(readCostRows(reader, {}, cutoff)).rejects.toThrow('42501');
  });
});
describe('CSV', () => {
  it('quotes commas, quotes and newlines and neutralizes spreadsheet formulas', () => {
    expect(csvCell('x,"y"\nz')).toBe('"x,""y""\nz"');
    for (const s of ['=SUM(A1:A2)', '+cmd', '-cmd', '@cmd', '  =cmd', '\tcmd', '\rcmd']) expect(csvCell(s)).toBe('"\'' + s + '"');
    expect(costRowsCsv([])).toContain('"sessionId"');
    expect(costRowsCsv([costRow(session({ scenario_id: '=cmd' }), [event])])).toContain('"\'=cmd"');
  });
});
