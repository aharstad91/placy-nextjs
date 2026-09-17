import type { VoiceAdmissionPolicy, VoicePurpose, VoiceSession } from '@/lib/live/metering/types';

/** Accounting projection: never select/spread a ledger session or its owner capability. */
export interface CostSession {
  id: string; tenant_id: string; customer_id: string | null; project_id: string | null;
  purpose?: VoicePurpose | null;
  internal_demo_id: string | null; provider_session_id: string | null;
  environment: string; test_run_id: string | null; scenario_id: string | null;
  created_at: string; ended_at: string | null; config_version: string; dataset_version: string;
  models: unknown; rate_snapshot: unknown; voice_seconds: number | null;
  backend_cost_usd: number; known_cost_usd: number;
  accounting_status: 'complete' | 'provisional' | 'incomplete'; termination_reason: string | null;
}
export interface CostEvent {
  response_id: string; model: string; input_tokens: number | null; cached_tokens: number | null;
  output_tokens: number | null; cost_usd: number | null; evidence_status: string;
}
export const SESSION_COLUMNS = 'id,tenant_id,customer_id,project_id,purpose,internal_demo_id,provider_session_id,environment,test_run_id,scenario_id,created_at,ended_at,config_version,dataset_version,models,rate_snapshot,voice_seconds,backend_cost_usd,known_cost_usd,accounting_status,termination_reason';
export const EVENT_COLUMNS = 'response_id,model,input_tokens,cached_tokens,output_tokens,cost_usd,evidence_status';
export interface CostFilters { tenant?: string; customer?: string; project?: string; purpose?: VoicePurpose | 'legacy'; environment?: string; testRun?: string }
export type AdmissionSession = Pick<VoiceSession, 'id' | 'customer_id' | 'project_id' | 'created_at' | 'state' | 'accounting_status' | 'reservation_usd' | 'known_cost_usd'>;
export const ADMISSION_COLUMNS = 'id,customer_id,project_id,created_at,state,accounting_status,reservation_usd,known_cost_usd';
export const POLICY_COLUMNS = 'scope_type,scope_id,enabled,max_concurrent,max_per_hour,max_per_day,daily_budget_usd';
export interface AdmissionSnapshot { sessions: AdmissionSession[]; policies: VoiceAdmissionPolicy[] }
export interface AdmissionReader {
  // Deliberately no filters: operational limits include every purpose/environment.
  sessions(request: { after?: string; cutoff: string; limit: number }): Promise<AdmissionSession[]>;
  policies(request: { offset: number; limit: number }): Promise<VoiceAdmissionPolicy[]>;
}
export async function readAdmissionSnapshot(reader: AdmissionReader, cutoff: string): Promise<AdmissionSnapshot> {
  const sessions: AdmissionSession[] = [], policies: VoiceAdmissionPolicy[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await reader.sessions({ after, cutoff, limit: 1000 });
    if (!page.length) break;
    if (after === page.at(-1)!.id) throw new Error('Admission pagination did not advance');
    sessions.push(...page); after = page.at(-1)!.id;
  }
  const seen = new Set<string>();
  for (;;) {
    const page = await reader.policies({ offset: policies.length, limit: 1000 });
    if (!page.length) break;
    for (const policy of page) {
      const key = JSON.stringify([policy.scope_type, policy.scope_id]);
      if (seen.has(key)) throw new Error('Policy pagination did not advance');
      seen.add(key); policies.push(policy);
    }
  }
  return { sessions, policies };
}
export interface CostReader {
  sessions(request: { after?: string; cutoff: string; limit: number; filters: CostFilters }): Promise<CostSession[]>;
  events(request: { sessionId: string; after?: string; cutoff: string; limit: number }): Promise<CostEvent[]>;
}
export async function readCostRows(reader: CostReader, filters: CostFilters, cutoff: string) {
  const rows: CostRow[] = [];
  let after: string | undefined;
  for (;;) {
    const sessions = await reader.sessions({ after, cutoff, limit: 1000, filters });
    if (!sessions.length) break;
    if (after === sessions.at(-1)!.id) throw new Error('Session pagination did not advance');
    // Bound database pressure and preserve session order even when reads finish
    // out of order. A failed batch prevents any later batch from being issued.
    for (let offset = 0; offset < sessions.length; offset += 10) {
      const batch = await Promise.all(sessions.slice(offset, offset + 10).map(async session => {
        const events: CostEvent[] = [];
        let eventAfter: string | undefined;
        for (;;) {
          const page = await reader.events({ sessionId: session.id, after: eventAfter, cutoff, limit: 1000 });
          if (!page.length) break;
          if (eventAfter === page.at(-1)!.response_id) throw new Error('Event pagination did not advance');
          events.push(...page);
          eventAfter = page.at(-1)!.response_id;
        }
        return costRow(session, events);
      }));
      rows.push(...batch);
    }
    after = sessions.at(-1)!.id;
  }
  return rows;
}
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const label = (value: unknown): string | null => typeof value === 'string' ? value : null;
const validNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function costRow(s: CostSession, events: CostEvent[]) {
  const rates = object(s.rate_snapshot), models = object(s.models);
  const voiceCost = validNumber(s.voice_seconds) && validNumber(rates.voiceUsdPerMinute) ? s.voice_seconds / 60 * rates.voiceUsdPerMinute : null;
  const backendCost = events.reduce((sum, e) => sum + (validNumber(e.cost_usd) ? e.cost_usd : 0), 0);
  const tokens = (key: 'input_tokens' | 'cached_tokens' | 'output_tokens') => events.reduce((sum, e) => sum + (validNumber(e[key]) ? e[key] : 0), 0);
  const knownCost = (voiceCost ?? 0) + backendCost;
  const reconciles = Math.abs(backendCost - s.backend_cost_usd) < 1e-7 && Math.abs(knownCost - s.known_cost_usd) < 1e-7;
  const evidenceMissing = voiceCost === null || !label(rates.version) || events.some(e => e.evidence_status !== 'valid' || !validNumber(e.cost_usd) || !validNumber(e.input_tokens) || !validNumber(e.cached_tokens) || !validNumber(e.output_tokens));
  const status = s.accounting_status === 'complete' && (evidenceMissing || !reconciles) ? 'incomplete' : s.accounting_status;
  return {
    sessionId: s.id, tenant: s.tenant_id, customer: s.customer_id, project: s.project_id, purpose: s.purpose ?? 'legacy', internalDemo: s.internal_demo_id,
    providerSessionId: s.provider_session_id, environment: s.environment, testRunId: s.test_run_id, scenario: s.scenario_id,
    startedAt: s.created_at, endedAt: s.ended_at,
    durationSeconds: s.ended_at ? Math.max(0, (Date.parse(s.ended_at) - Date.parse(s.created_at)) / 1000) : null,
    voiceSeconds: s.voice_seconds, inputTokens: tokens('input_tokens'), cachedTokens: tokens('cached_tokens'), outputTokens: tokens('output_tokens'),
    usageEventCount: events.length, unknownUsageEvents: events.filter(e => e.evidence_status !== 'valid' || e.cost_usd === null).length,
    knownVoiceUsd: voiceCost, knownBackendUsd: backendCost, knownTotalUsd: knownCost,
    accountingStatus: status, ledgerAccountingStatus: s.accounting_status, reconciles,
    termination: s.termination_reason, voiceModel: label(models.voice), backendModel: label(models.backend), speaker: label(models.speaker),
    observedBackendModels: [...new Set(events.map(e => e.model))].sort().join(';'),
    rateVersion: label(rates.version), configVersion: s.config_version, datasetVersion: s.dataset_version,
  };
}
export type CostRow = ReturnType<typeof costRow>;
function summary(rows: CostRow[]) {
  const complete = rows.filter(r => r.accountingStatus === 'complete');
  const costs = complete.map(r => r.knownTotalUsd).sort((a,b) => a-b);
  const n = costs.length;
  const sum = (items: CostRow[], key: 'knownVoiceUsd' | 'knownBackendUsd' | 'knownTotalUsd') => items.reduce((s,r) => s + (r[key] ?? 0), 0);
  return {
    attemptedCount: rows.length, completeCount: n,
    provisionalCount: rows.filter(r => r.accountingStatus === 'provisional').length,
    incompleteCount: rows.filter(r => r.accountingStatus === 'incomplete').length,
    completeVoiceUsd: sum(complete, 'knownVoiceUsd'), completeBackendUsd: sum(complete, 'knownBackendUsd'), completeTotalUsd: sum(complete, 'knownTotalUsd'),
    incompleteKnownLowerBoundUsd: sum(rows.filter(r => r.accountingStatus === 'incomplete'), 'knownTotalUsd'),
    provisionalKnownLowerBoundUsd: sum(rows.filter(r => r.accountingStatus === 'provisional'), 'knownTotalUsd'),
    medianUsd: n ? (costs[Math.floor((n-1)/2)] + costs[Math.floor(n/2)]) / 2 : null,
    p95Usd: n ? costs[Math.ceil(n * 0.95)-1] : null, maxUsd: n ? costs[n-1] : null,
  };
}
function selectedScopeTotals(rows: CostRow[]) {
  const customers = new Map<string, CostRow[]>(), projects = new Map<string, CostRow[]>();
  for (const row of rows) {
    if (row.customer !== null) {
      const items = customers.get(row.customer) ?? []; items.push(row); customers.set(row.customer, items);
    }
    if (row.project !== null) {
      const items = projects.get(row.project) ?? []; items.push(row); projects.set(row.project, items);
    }
  }
  return {
    basis: 'Selected rows only; scopes overlap and must not be added together. This is not operational exposure.',
    platform: summary(rows),
    customers: [...customers].map(([customer, items]) => ({ customer, ...summary(items) })),
    projects: [...projects].map(([project, items]) => ({ project, ...summary(items) })),
    unattributed: summary(rows.filter(row => row.customer === null || row.project === null)),
  };
}

/** Mirror voice_reserve's ledger projection, not event-reconciled reporting rows. */
function operationalReport(snapshot: AdmissionSnapshot, cutoff: string) {
  const now = Date.parse(cutoff);
  if (!Number.isFinite(now)) throw new Error('Invalid admission cutoff');
  const scopeMap = new Map<string, { scopeType: VoiceAdmissionPolicy['scope_type']; scopeId: string; policy: VoiceAdmissionPolicy | null; sessions: AdmissionSession[] }>();
  const scope = (scopeType: VoiceAdmissionPolicy['scope_type'], scopeId: string) => {
    const key = JSON.stringify([scopeType, scopeId]);
    let item = scopeMap.get(key);
    if (!item) { item = { scopeType, scopeId, policy: null, sessions: [] }; scopeMap.set(key, item); }
    return item;
  };
  scope('platform', 'platform');
  for (const policy of snapshot.policies) scope(policy.scope_type, policy.scope_id).policy = policy;
  for (const session of snapshot.sessions) {
    scope('platform', 'platform').sessions.push(session);
    if (session.customer_id !== null) scope('customer', session.customer_id).sessions.push(session);
    if (session.project_id !== null) scope('project', session.project_id).sessions.push(session);
  }
  const warningThreshold = 0.8;
  const scopes = [...scopeMap.values()].map(({ scopeType, scopeId, policy, sessions }) => {
    let activeCalls = 0, attemptsLastHour = 0, attemptsLast24Hours = 0, completeLast24HoursUsd = 0;
    let unresolvedReservationUsd = 0, unresolvedKnownLowerBoundUsd = 0, unresolvedExposureUsd = 0, oldIncompleteExposureUsd = 0;
    for (const session of sessions) {
      const started = Date.parse(session.created_at);
      if (!Number.isFinite(started) || !validNumber(session.reservation_usd) || !validNumber(session.known_cost_usd)) throw new Error('Invalid admission ledger evidence');
      if (started > now) throw new Error('Admission ledger exceeds report cutoff');
      if (session.state !== 'closed') activeCalls++;
      if (started > now - 3_600_000) attemptsLastHour++;
      const inDay = started > now - 86_400_000;
      if (inDay) attemptsLast24Hours++;
      if (session.accounting_status !== 'complete') {
        const liability = Math.max(session.reservation_usd, session.known_cost_usd);
        unresolvedReservationUsd += session.reservation_usd;
        unresolvedKnownLowerBoundUsd += session.known_cost_usd;
        unresolvedExposureUsd += liability;
        if (!inDay && session.accounting_status === 'incomplete') oldIncompleteExposureUsd += liability;
      } else if (inDay) completeLast24HoursUsd += session.known_cost_usd;
    }
    const exposureUsd = completeLast24HoursUsd + unresolvedExposureUsd;
    const ratios = policy ? [activeCalls / policy.max_concurrent, attemptsLastHour / policy.max_per_hour, attemptsLast24Hours / policy.max_per_day, exposureUsd / policy.daily_budget_usd] : [];
    const status = !policy ? 'missing_policy' : !policy.enabled ? 'disabled' : ratios.some(r => r >= 1) ? 'limit_reached' : ratios.some(r => r >= warningThreshold) ? 'warning' : 'ok';
    return {
      scopeType, scopeId, policy, activeCalls, attemptsLastHour, attemptsLast24Hours,
      completeLast24HoursUsd, unresolvedReservationUsd, unresolvedKnownLowerBoundUsd, unresolvedExposureUsd, oldIncompleteExposureUsd, exposureUsd,
      concurrentRemaining: policy ? Math.max(0, policy.max_concurrent - activeCalls) : null,
      hourlyRemaining: policy ? Math.max(0, policy.max_per_hour - attemptsLastHour) : null,
      dailyRemaining: policy ? Math.max(0, policy.max_per_day - attemptsLast24Hours) : null,
      budgetRemainingUsd: policy ? Math.max(0, policy.daily_budget_usd - exposureUsd) : null,
      status,
    };
  });
  return {
    basis: 'Unfiltered ledger across all purposes, environments and history. Separate REST reads, not a transactional snapshot or admission guarantee; tenant limits and the next call reservation also apply.',
    window: 'Strictly newer than cutoff minus 1 hour/24 hours by created_at. Incomplete/provisional liability and nonclosed calls never age out.',
    warningThreshold, scopes,
  };
}

export function buildCostReport(rows: CostRow[], cutoff: string, filters: CostFilters = {}, admission?: AdmissionSnapshot) {
  const groups = new Map<string, { identity: Pick<CostRow, 'tenant' | 'customer' | 'project' | 'purpose' | 'internalDemo' | 'environment' | 'testRunId' | 'scenario'>; rows: CostRow[] }>();
  for (const row of rows) {
    const { tenant, customer, project, purpose, internalDemo, environment, testRunId, scenario } = row;
    const identity = { tenant, customer, project, purpose, internalDemo, environment, testRunId, scenario };
    const key = JSON.stringify(identity);
    const group = groups.get(key) ?? { identity, rows: [] };
    group.rows.push(row); groups.set(key, group);
  }
  return { cutoff, filters, currency: 'USD', basis: 'Calculated provider estimates, not invoices or customer prices; incomplete/provisional amounts are known lower bounds. Vercel, Supabase and maps costs/allocation are unmeasured and excluded.', rows, groups: [...groups.values()].map(g => ({ ...g.identity, ...summary(g.rows) })), selectedTotals: selectedScopeTotals(rows), operational: admission ? operationalReport(admission, cutoff) : null };
}
/** Quote every field; neutralize spreadsheet formulas even after leading whitespace. */
export function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function costRowsCsv(rows: CostRow[]) {
  const headers: (keyof CostRow)[] = [
    'sessionId', 'tenant', 'customer', 'project', 'purpose', 'internalDemo', 'providerSessionId',
    'environment', 'testRunId', 'scenario', 'startedAt', 'endedAt', 'durationSeconds',
    'voiceSeconds', 'inputTokens', 'cachedTokens', 'outputTokens', 'usageEventCount',
    'unknownUsageEvents', 'knownVoiceUsd', 'knownBackendUsd', 'knownTotalUsd',
    'accountingStatus', 'ledgerAccountingStatus', 'reconciles', 'termination',
    'voiceModel', 'backendModel', 'speaker', 'observedBackendModels', 'rateVersion',
    'configVersion', 'datasetVersion',
  ];
  return [headers.map(csvCell).join(','), ...rows.map(row => headers.map(key => csvCell(row[key])).join(','))].join('\r\n') + '\r\n';
}
