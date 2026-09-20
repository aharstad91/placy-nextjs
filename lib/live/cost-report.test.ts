import { describe, expect, it, vi } from 'vitest';
import { buildCostReport, costRow, costRowsCsv, csvCell, readCostRows, readAdmissionSnapshot, SESSION_COLUMNS, ADMISSION_COLUMNS, type CostSession, type CostEvent, type CostReader, type AdmissionSession } from '@/lib/live/cost-report';
import type { VoiceAdmissionPolicy } from '@/lib/live/metering/types';
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
describe('shared platform reporting', () => {
  const policy = (scope_type: VoiceAdmissionPolicy['scope_type'], scope_id: string, overrides: Partial<VoiceAdmissionPolicy> = {}): VoiceAdmissionPolicy => ({ scope_type, scope_id, enabled: true, max_concurrent: 5, max_per_hour: 10, max_per_day: 20, daily_budget_usd: 10, ...overrides });
  const admission = (overrides: Partial<AdmissionSession> = {}): AdmissionSession => ({ id: '001', customer_id: 'customer', project_id: 'project-a', created_at: '2026-09-16T23:30:00Z', state: 'closed', accounting_status: 'complete', reservation_usd: 5, known_cost_usd: 1, ...overrides });
  it('aggregates two children exactly once and preserves purpose as an independent cohort', () => {
    const rows = ['project-a', 'project-b'].map((project_id, i) => costRow(session({ id: String(i), customer_id: 'customer', project_id, purpose: i ? 'internal' : 'public' }), [event]));
    const report = buildCostReport(rows, cutoff);
    expect(report.selectedTotals.platform).toMatchObject({ attemptedCount: 2 });
    expect(report.selectedTotals.platform.completeTotalUsd).toBeCloseTo(0.24);
    expect(report.selectedTotals.customers).toEqual([expect.objectContaining({ customer: 'customer', attemptedCount: 2 })]);
    expect(report.selectedTotals.customers[0].completeTotalUsd).toBeCloseTo(0.24);
    expect(report.selectedTotals.projects).toHaveLength(2);
    expect(report.groups.map(g => g.purpose)).toEqual(['public', 'internal']);
    expect(costRow(session(), [event]).purpose).toBe('legacy');
    expect(costRowsCsv(rows)).toContain('"purpose"');
  });
  it('keeps empty filtered use empty while global exposure counts other projects, purposes and old incomplete history', () => {
    const snapshot = { policies: [policy('platform', 'platform'), policy('customer', 'customer'), policy('project', 'project-a')], sessions: [
      admission(), admission({ id: '002', project_id: 'project-b', state: 'active', accounting_status: 'provisional', known_cost_usd: 7 }),
      admission({ id: '003', customer_id: null, project_id: null, created_at: '2020-01-01T00:00:00Z', accounting_status: 'incomplete', reservation_usd: 2, known_cost_usd: 0.5 }),
      admission({ id: '004', created_at: '2020-01-01T00:00:00Z', known_cost_usd: 100 }),
    ] };
    const report = buildCostReport([], cutoff, { project: 'missing', purpose: 'public' }, snapshot);
    expect(report.selectedTotals.platform).toMatchObject({ attemptedCount: 0, completeTotalUsd: 0 });
    expect(report.selectedTotals.projects).toEqual([]);
    expect(report.operational!.scopes.find(s => s.scopeType === 'platform')).toMatchObject({ activeCalls: 1, attemptsLastHour: 2, attemptsLast24Hours: 2, completeLast24HoursUsd: 1, unresolvedReservationUsd: 7, unresolvedExposureUsd: 9, oldIncompleteExposureUsd: 2, exposureUsd: 10, budgetRemainingUsd: 0, status: 'limit_reached' });
    expect(report.operational!.scopes.find(s => s.scopeType === 'customer')).toMatchObject({ exposureUsd: 8, budgetRemainingUsd: 2, status: 'warning' });
    expect(report.operational!.scopes.find(s => s.scopeId === 'project-a')).toMatchObject({ exposureUsd: 1, status: 'ok' });
    expect(report.operational!.scopes.find(s => s.scopeId === 'project-b')).toMatchObject({ policy: null, status: 'missing_policy', budgetRemainingUsd: null });
  });
  it('matches strict SQL time boundaries, counts failed attempts, and retains old nonclosed calls', () => {
    const report = buildCostReport([], cutoff, {}, { policies: [policy('platform', 'platform', { max_concurrent: 1 })], sessions: [
      admission({ created_at: '2026-09-16T23:00:00Z' }),
      admission({ id: '002', created_at: '2026-09-16T00:00:00Z' }),
      admission({ id: '003', created_at: '2020-01-01T00:00:00Z', state: 'unresolved', accounting_status: 'incomplete' }),
    ] });
    expect(report.operational!.scopes[0]).toMatchObject({ attemptsLastHour: 0, attemptsLast24Hours: 1, activeCalls: 1, concurrentRemaining: 0, hourlyRemaining: 10, dailyRemaining: 19, exposureUsd: 6, status: 'limit_reached' });
  });
  it('does not claim known headroom without its independent read; disabled policies are explicit', () => {
    expect(buildCostReport([], cutoff).operational).toBeNull();
    const report = buildCostReport([], cutoff, {}, { sessions: [], policies: [policy('platform', 'platform', { enabled: false })] });
    expect(report.operational!.scopes[0].status).toBe('disabled');
  });
  it('reads all admission rows and policies across server caps without selecting owner capabilities or events', async () => {
    const sessions = Array.from({ length: 1001 }, (_, i) => admission({ id: String(i).padStart(4, '0') }));
    const policies = [policy('platform', 'platform'), policy('customer', 'customer'), policy('project', 'project-a')];
    const reader = {
      sessions: vi.fn(async (r: { after?: string; cutoff: string }) => { expect(r.cutoff).toBe(cutoff); expect(r).not.toHaveProperty('filters'); return sessions.filter(s => !r.after || s.id > r.after).slice(0, 500); }),
      policies: vi.fn(async (r: { offset: number }) => policies.slice(r.offset, r.offset + 1)),
    };
    const snapshot = await readAdmissionSnapshot(reader, cutoff);
    expect(snapshot.sessions).toHaveLength(1001); expect(snapshot.policies).toEqual(policies);
    expect(reader.sessions).toHaveBeenCalledTimes(4); expect(reader.policies).toHaveBeenCalledTimes(4);
    expect(ADMISSION_COLUMNS).not.toContain('owner_token');
  });
  it('fails the independent snapshot when policy permissions fail', async () => {
    await expect(readAdmissionSnapshot({ sessions: async () => [], policies: async () => { throw new Error('42501'); } }, cutoff)).rejects.toThrow('42501');
  });
  it('keeps an unmatched purpose/project selection empty without fetching any usage events', async () => {
    const reader: CostReader = {
      sessions: vi.fn(async request => { expect(request.filters).toEqual({ project: 'project-a', purpose: 'benchmark' }); return []; }),
      events: vi.fn(async () => []),
    };
    const rows = await readCostRows(reader, { project: 'project-a', purpose: 'benchmark' }, cutoff);
    expect(rows).toEqual([]); expect(reader.events).not.toHaveBeenCalled();
    const report = buildCostReport(rows, cutoff, { project: 'project-a', purpose: 'benchmark' }, { sessions: [admission()], policies: [policy('platform', 'platform')] });
    expect(report.selectedTotals.platform.attemptedCount).toBe(0);
    expect(report.operational!.scopes[0].exposureUsd).toBe(1);
  });
  it('refuses repeated admission pages rather than returning an incomplete or duplicated export', async () => {
    await expect(readAdmissionSnapshot({ sessions: async () => [admission()], policies: async () => [] }, cutoff)).rejects.toThrow('Admission pagination did not advance');
    await expect(readAdmissionSnapshot({ sessions: async () => [], policies: async () => [policy('platform', 'platform')] }, cutoff)).rejects.toThrow('Policy pagination did not advance');
  });
});
describe('complete keyset reads', () => {
  it('bounds concurrent event reads and keeps session order despite reversed completion', async () => {
    const sessions = Array.from({ length: 23 }, (_, i) => session({ id: String(i).padStart(3, '0') }));
    let active = 0, peak = 0, issued = 0;
    const pending: (() => void)[] = [];
    const reader: CostReader = {
      sessions: async r => r.after ? [] : sessions,
      events: async () => {
        active++; issued++; peak = Math.max(peak, active);
        await new Promise<void>(resolve => {
          pending.push(resolve);
          if (issued % 10 === 0 || issued === sessions.length) {
            queueMicrotask(() => { for (const finish of pending.splice(0).reverse()) finish(); });
          }
        });
        active--;
        return [];
      },
    };
    const rows = await readCostRows(reader, {}, cutoff);
    expect(peak).toBe(10);
    expect(rows.map(row => row.sessionId)).toEqual(sessions.map(s => s.id));
  });
  it('does not schedule later event batches after a read fails', async () => {
    const sessions = Array.from({ length: 23 }, (_, i) => session({ id: String(i) }));
    const reader: CostReader = {
      sessions: async () => sessions,
      events: vi.fn(async () => { throw new Error('event_read_failed'); }),
    };
    await expect(readCostRows(reader, {}, cutoff)).rejects.toThrow('event_read_failed');
    expect(reader.events).toHaveBeenCalledTimes(10);
  });
  it('reads 1001 sessions and 1001 events even with a lower server page cap; forwards filters and fixed cutoff', async () => {
    const sessions = Array.from({ length: 1001 }, (_, i) => session({ id: String(i).padStart(4, '0') }));
    const events = Array.from({ length: 1001 }, (_, i) => ({ ...event, response_id: String(i).padStart(4, '0') }));
    const filters = { tenant: 'nyhavna', customer: 'customer', project: 'project', purpose: 'public' as const, environment: 'test', testRun: 'run-1' };
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
