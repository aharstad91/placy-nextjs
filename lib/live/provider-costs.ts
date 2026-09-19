import { z } from 'zod';

const DAY = 86_400;
const timestamp = z.number().int().nonnegative();
const projectId = z.string().regex(/^proj_[A-Za-z0-9_-]+$/);
const costResult = z.object({
  object: z.literal('organization.costs.result'),
  amount: z.object({ value: z.number().finite(), currency: z.literal('usd') }),
  project_id: projectId,
  line_item: z.string().nullable(),
  api_key_id: z.string().nullable(),
});
const bucket = z.object({ object: z.literal('bucket'), start_time: timestamp, end_time: timestamp, results: z.array(costResult) });
const costsPage = z.object({ data: z.array(bucket), has_more: z.boolean(), next_page: z.string().nullable().optional() });
const projectPage = z.object({
  data: z.array(z.object({ id: projectId, name: z.string(), status: z.enum(['active', 'archived']) })),
  has_more: z.boolean(), last_id: z.string().nullable().optional(),
});
const instant = z.string().datetime({ offset: true });
const ledgerSchema = z.object({
  currency: z.literal('USD'), cutoff: instant, filters: z.record(z.string(), z.unknown()),
  rows: z.array(z.object({
    sessionId: z.string().min(1), startedAt: instant, endedAt: instant.nullable(),
    accountingStatus: z.enum(['complete', 'incomplete', 'provisional']), reconciles: z.boolean(),
    knownTotalUsd: z.number().finite().nonnegative(), customer: z.string().nullable(), project: z.string().nullable(), purpose: z.string(),
  })),
});
export interface CostPeriod { start: number; end: number }
export interface ProviderCosts {
  projectId: string; period: CostPeriod; fetchedAt: string; buckets: z.infer<typeof bucket>[];
}
type Fetcher = typeof fetch;

function validatePeriod(period: CostPeriod) {
  if (![period.start, period.end].every(n => Number.isSafeInteger(n) && n >= 0 && n % DAY === 0) || period.end <= period.start || period.end - period.start > 180 * DAY) {
    throw new Error('Use a period of 1–180 complete UTC days, with an exclusive end date');
  }
}
export function costPeriod(from: string, to: string): CostPeriod {
  const parse = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Dates must use YYYY-MM-DD');
    const ms = Date.parse(`${s}T00:00:00Z`);
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== s) throw new Error('Invalid calendar date');
    return ms / 1000;
  };
  const period = { start: parse(from), end: parse(to) };
  validatePeriod(period);
  return period;
}

/** Fixed origin and GET only. Never log the key, provider error body or raw exception. */
async function readOpenAI(path: string, params: URLSearchParams, key: string, fetcher: Fetcher): Promise<unknown> {
  if (!key.trim()) throw new Error('OPENAI_ADMIN_KEY is required; a normal model key is not used as a fallback');
  let response: Response;
  try {
    response = await fetcher(`https://api.openai.com/v1/organization/${path}?${params}`, {
      method: 'GET', headers: { Authorization: `Bearer ${key}` }, redirect: 'error', signal: AbortSignal.timeout(30_000),
    });
  } catch { throw new Error('OpenAI read failed or timed out; no partial report emitted'); }
  if (!response.ok) throw new Error(`OpenAI read failed (HTTP ${response.status}); verify Admin API key permissions`);
  try { return await response.json(); }
  catch { throw new Error('OpenAI returned invalid JSON; no partial report emitted'); }
}
function parse<T>(schema: z.ZodType<T>, value: unknown, source: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`Invalid ${source} evidence; no partial report emitted`);
  return result.data;
}
function nextCursor(hasMore: boolean, next: string | null | undefined, seen: Set<string>): string | undefined {
  if (!hasMore) return undefined;
  if (!next || seen.has(next)) throw new Error('Provider pagination did not advance');
  seen.add(next);
  return next;
}

export async function listProviderProjects(key: string, fetcher: Fetcher = fetch) {
  const projects: z.infer<typeof projectPage>['data'] = [];
  const cursors = new Set<string>(), ids = new Set<string>();
  let after: string | undefined;
  do {
    const params = new URLSearchParams({ limit: '100', include_archived: 'true' });
    if (after) params.set('after', after);
    const page = parse(projectPage, await readOpenAI('projects', params, key, fetcher), 'provider projects');
    for (const project of page.data) {
      if (ids.has(project.id)) throw new Error('Duplicate provider project');
      ids.add(project.id); projects.push(project);
    }
    after = nextCursor(page.has_more, page.last_id, cursors);
  } while (after);
  return projects;
}

function validateBuckets(costs: ProviderCosts) {
  validatePeriod(costs.period);
  const buckets = [...costs.buckets].sort((a, b) => a.start_time - b.start_time);
  let expected = costs.period.start;
  for (const b of buckets) {
    if (b.start_time !== expected || b.end_time !== b.start_time + DAY || b.end_time > costs.period.end) throw new Error('Incomplete or overlapping provider bucket coverage');
    const groups = new Set<string>();
    for (const row of b.results) {
      if (row.project_id !== costs.projectId) throw new Error('Provider returned costs outside the selected OpenAI project');
      const id = JSON.stringify([row.project_id, row.line_item, row.api_key_id]);
      if (groups.has(id)) throw new Error('Duplicate provider cost group');
      groups.add(id);
    }
    expected = b.end_time;
  }
  if (expected !== costs.period.end) throw new Error('Incomplete provider bucket coverage; missing days are not zero');
}

export async function fetchProviderCosts(key: string, selectedProject: string, period: CostPeriod, fetcher: Fetcher = fetch): Promise<ProviderCosts> {
  validatePeriod(period);
  if (!projectId.safeParse(selectedProject).success) throw new Error('Select an explicit OpenAI project ID (proj_...) using --list-projects');
  const buckets: ProviderCosts['buckets'] = [], cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ start_time: String(period.start), end_time: String(period.end), bucket_width: '1d', limit: '180' });
    params.append('project_ids[]', selectedProject);
    for (const group of ['project_id', 'line_item', 'api_key_id']) params.append('group_by[]', group);
    if (cursor) params.set('page', cursor);
    const page = parse(costsPage, await readOpenAI('costs', params, key, fetcher), 'provider costs');
    buckets.push(...page.data);
    if (buckets.length > 180) throw new Error('Unexpected provider bucket count');
    cursor = nextCursor(page.has_more, page.next_page, cursors);
  } while (cursor);
  const report = { projectId: selectedProject, period, fetchedAt: new Date().toISOString(), buckets };
  validateBuckets(report);
  return report;
}

export function compareProviderCosts(costs: unknown, ledgerInput: unknown) {
  // Revalidate even persisted/imported evidence, not just network responses.
  const provider = parse(z.object({ projectId, period: z.object({ start: timestamp, end: timestamp }), fetchedAt: instant, buckets: z.array(bucket) }), costs, 'provider costs');
  validateBuckets(provider);
  const ledger = parse(ledgerSchema, ledgerInput, 'ledger');
  if (Object.keys(ledger.filters).length) throw new Error('Use an unfiltered voice-costs JSON export; a customer subset cannot represent the OpenAI project');
  const start = provider.period.start * 1000, end = provider.period.end * 1000;
  const cutoff = Date.parse(ledger.cutoff), observed = Date.parse(provider.fetchedAt);
  const reasons = ['provider_project_to_ledger_mapping_unverified', 'aggregate_costs_cannot_reconcile_individual_sessions', 'provider_reporting_may_lag'];
  if (cutoff < end || observed < end) reasons.push('period_not_fully_observed');
  const seen = new Set<string>();
  let changedDuringExport = false;
  let completeUsd = 0, incompleteKnownUsd = 0, completeCount = 0, incompleteCount = 0, boundaryCount = 0, outsidePeriodCount = 0;
  const boundarySessionIds: string[] = [];
  const byProject = new Map<string, { customer: string | null; project: string | null; purpose: string; knownUsd: number; sessions: number }>();
  for (const row of ledger.rows) {
    if (seen.has(row.sessionId)) throw new Error('Duplicate ledger session');
    seen.add(row.sessionId);
    const began = Date.parse(row.startedAt), ended = row.endedAt === null ? null : Date.parse(row.endedAt);
    if (began > cutoff || (ended !== null && ended < began)) throw new Error('Ledger timestamps contradict its observation cutoff');
    // The producer filters creation/event timestamps, but its session reads are not a transaction snapshot.
    if (ended !== null && ended > cutoff) changedDuringExport = true;
    if (began >= end || (ended !== null && ended <= start)) { outsidePeriodCount++; continue; }
    if (began < start || ended === null || ended > end) { boundaryCount++; boundarySessionIds.push(row.sessionId); continue; }
    if (row.accountingStatus === 'complete' && row.reconciles) { completeUsd += row.knownTotalUsd; completeCount++; }
    else { incompleteKnownUsd += row.knownTotalUsd; incompleteCount++; }
    const identity = { customer: row.customer, project: row.project, purpose: row.purpose };
    const id = JSON.stringify(identity);
    const group = byProject.get(id) ?? { ...identity, knownUsd: 0, sessions: 0 };
    group.knownUsd += row.knownTotalUsd; group.sessions++; byProject.set(id, group);
  }
  if (boundaryCount) reasons.push('sessions_cross_period_boundary');
  if (changedDuringExport) reasons.push('ledger_changed_during_export');
  if (incompleteCount) reasons.push('incomplete_ledger_costs');
  const providerUsd = provider.buckets.reduce((sum, b) => sum + b.results.reduce((s, r) => s + r.amount.value, 0), 0);
  const knownUsd = completeUsd + incompleteKnownUsd;
  return {
    status: 'needs_review' as const, currency: 'USD', reasons,
    basis: 'Read-only aggregate comparison. The OpenAI project may contain non-voice or unmetered work. A difference is unallocated, not a customer charge or proof of a missing session. No ledger statuses or reservations are changed.',
    period: provider.period, providerProjectId: provider.projectId, providerFetchedAt: provider.fetchedAt, ledgerCutoff: ledger.cutoff,
    providerUsd,
    ledger: { completeUsd, incompleteKnownUsd, knownUsd, completeCount, incompleteCount, boundaryCount, boundarySessionIds, outsidePeriodCount, groups: [...byProject.values()] },
    unallocatedDifferenceUsd: boundaryCount || cutoff < end || observed < end ? null : providerUsd - knownUsd,
    providerBuckets: provider.buckets,
  };
}
