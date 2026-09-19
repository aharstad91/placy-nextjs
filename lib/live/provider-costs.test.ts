import { describe, expect, it, vi } from 'vitest';
import { fetchProviderCosts, compareProviderCosts, costPeriod, listProviderProjects } from '@/lib/live/provider-costs';

const day = 86400;
const period = { start: 1789516800, end: 1789603200 }; // 2026-09-16 UTC
const result = (value = 2) => ({ object: 'organization.costs.result', amount: { value, currency: 'usd' }, project_id: 'proj_placy', line_item: 'voice', api_key_id: null });
const page = (start = period.start, results = [result()]) => ({ object: 'page', data: [{ object: 'bucket', start_time: start, end_time: start + day, results }], has_more: false, next_page: null });
const ledger = () => ({ currency: 'USD', cutoff: '2026-09-18T00:00:00Z', filters: {}, rows: [{ sessionId: 'one', startedAt: '2026-09-16T10:00:00Z', endedAt: '2026-09-16T10:01:00Z', accountingStatus: 'complete', reconciles: true, knownTotalUsd: 1.5, customer: 'customer', project: 'placy-project', purpose: 'public' }] });
const provider = () => ({ projectId: 'proj_placy', period, fetchedAt: '2026-09-18T00:00:00Z', buckets: page().data });

describe('read-only provider costs', () => {
  it('uses the fixed official endpoint, header auth, UTC dates, project scope and all pages', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ ...page(), has_more: true, next_page: 'second' })).mockResolvedValueOnce(Response.json(page(period.end)));
    const costs = await fetchProviderCosts('secret', 'proj_placy', { ...period, end: period.end + day }, fetcher);
    expect(costs.buckets).toHaveLength(2);
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(url).origin).toBe('https://api.openai.com');
    expect(new URL(url).searchParams.get('project_ids[]')).toBe('proj_placy');
    expect(new URL(url).searchParams.getAll('group_by[]')).toEqual(['project_id', 'line_item', 'api_key_id']);
    expect(options).toMatchObject({ method: 'GET', redirect: 'error', headers: { Authorization: 'Bearer secret' } });
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('page')).toBe('second');
    expect(JSON.stringify(costs)).not.toContain('secret');
  });
  it('rejects partial, overlapping or repeated pagination evidence', async () => {
    const gap = vi.fn().mockResolvedValue(Response.json(page()));
    await expect(fetchProviderCosts('key', 'proj_placy', { ...period, end: period.end + day }, gap)).rejects.toThrow('coverage');
    const repeated = vi.fn().mockImplementation(async () => Response.json({ ...page(), has_more: true, next_page: 'loop' }));
    await expect(fetchProviderCosts('key', 'proj_placy', period, repeated)).rejects.toThrow();
    expect(repeated.mock.calls.length).toBeLessThan(4);
  });
  it.each([null, '2', NaN])('does not turn malformed amount %s into zero', async value => {
    const body = page(); Object.assign(body.data[0].results[0].amount, { value });
    await expect(fetchProviderCosts('key', 'proj_placy', period, vi.fn().mockResolvedValue(Response.json(body)))).rejects.toThrow();
  });
  it('rejects currency changes and out-of-scope results', async () => {
    for (const mutate of [(r: ReturnType<typeof result>) => { r.amount.currency = 'eur'; }, (r: ReturnType<typeof result>) => { r.project_id = 'proj_other'; }]) {
      const body = page(); mutate(body.data[0].results[0]);
      await expect(fetchProviderCosts('key', 'proj_placy', period, vi.fn().mockResolvedValue(Response.json(body)))).rejects.toThrow();
    }
  });
  it('sanitizes provider failures and never falls back to a normal API key', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('secret echoed by provider', { status: 403 }));
    await expect(fetchProviderCosts('key', 'proj_placy', period, fetcher)).rejects.toThrow('HTTP 403');
    await expect(fetchProviderCosts('', 'proj_placy', period, fetcher)).rejects.toThrow('OPENAI_ADMIN_KEY');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('sanitizes transport errors without echoing their credential-bearing message', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('secret echoed in transport failure'));
    await expect(fetchProviderCosts('secret', 'proj_placy', period, fetcher)).rejects.toThrow('OpenAI read failed or timed out; no partial report emitted');
  });
  it('rejects non-JSON success responses without echoing their body', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('secret echoed in invalid body', { status: 200 }));
    await expect(fetchProviderCosts('secret', 'proj_placy', period, fetcher)).rejects.toThrow('OpenAI returned invalid JSON; no partial report emitted');
  });
  it('lists paginated project metadata without leaking unexpected fields', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ data: [{ id: 'proj_placy', name: 'Placy', status: 'active', secret: 'never' }], has_more: true, last_id: 'proj_placy' })).mockResolvedValueOnce(Response.json({ data: [], has_more: false, last_id: null }));
    expect(await listProviderProjects('key', fetcher)).toEqual([{ id: 'proj_placy', name: 'Placy', status: 'active' }]);
  });
  it('validates calendar dates, whole UTC days and bounded intervals', () => {
    expect(costPeriod('2026-09-16', '2026-09-17')).toEqual(period);
    expect(() => costPeriod('2026-02-30', '2026-03-02')).toThrow();
    expect(() => costPeriod('2026-09-17', '2026-09-16')).toThrow();
    expect(() => costPeriod('2025-01-01', '2026-09-16')).toThrow();
  });
});

describe('provider versus ledger comparison', () => {
  it('shows an unallocated difference, never certifies session reconciliation from matching totals', () => {
    const report = compareProviderCosts(provider(), ledger());
    expect(report).toMatchObject({ status: 'needs_review', providerUsd: 2, ledger: { completeUsd: 1.5, incompleteKnownUsd: 0 }, unallocatedDifferenceUsd: 0.5 });
    const matching = ledger(); matching.rows[0].knownTotalUsd = 2;
    expect(compareProviderCosts(provider(), matching).status).toBe('needs_review');
  });
  it('keeps incomplete costs and boundary-spanning calls separate', () => {
    const input = ledger(); input.rows[0].accountingStatus = 'incomplete';
    input.rows.push({ ...input.rows[0], sessionId: 'boundary', startedAt: '2026-09-15T23:59:00Z' });
    const report = compareProviderCosts(provider(), input);
    expect(report.ledger).toMatchObject({ completeUsd: 0, incompleteKnownUsd: 1.5, incompleteCount: 1, boundaryCount: 1 });
    expect(report.unallocatedDifferenceUsd).toBeNull();
  });
  it('refuses filtered exports, duplicates and invalid ledger evidence', () => {
    const filtered = { ...ledger(), filters: { project: 'nyhavna' } };
    expect(() => compareProviderCosts(provider(), filtered)).toThrow('unfiltered');
    const duplicate = ledger(); duplicate.rows.push(duplicate.rows[0]);
    expect(() => compareProviderCosts(provider(), duplicate)).toThrow('Duplicate');
    const invalid = ledger(); invalid.rows[0].knownTotalUsd = NaN;
    expect(() => compareProviderCosts(provider(), invalid)).toThrow();
  });
  it('marks stale or current-day windows provisional and retains negative provider credits', () => {
    const input = ledger(); input.cutoff = '2026-09-16T12:00:00Z';
    const costs = provider(); costs.fetchedAt = '2026-09-16T12:00:00Z'; costs.buckets[0].results[0].amount.value = -0.25;
    const report = compareProviderCosts(costs, input);
    expect(report.providerUsd).toBe(-0.25);
    expect(report.unallocatedDifferenceUsd).toBeNull();
    expect(report.reasons).toContain('period_not_fully_observed');
  });
  it('handles a zero-use day only when the provider returned its bucket', () => {
    const costs = provider(); costs.buckets[0].results = [];
    const input = ledger(); input.rows = [];
    expect(compareProviderCosts(costs, input)).toMatchObject({ providerUsd: 0, status: 'needs_review' });
  });
  it('accepts a session closing during export without corrupting a historical comparison', () => {
    const input = ledger();
    input.cutoff = '2026-09-18T10:00:00Z';
    input.rows.push({ ...input.rows[0], sessionId: 'closed-during-export', startedAt: '2026-09-18T09:59:00Z', endedAt: '2026-09-18T10:00:01Z' });
    const report = compareProviderCosts(provider(), input);
    expect(report).toMatchObject({ status: 'needs_review', unallocatedDifferenceUsd: 0.5 });
    expect(report.ledger).toMatchObject({ completeCount: 1, outsidePeriodCount: 1 });
    expect(report.reasons).toContain('ledger_changed_during_export');
  });
});
