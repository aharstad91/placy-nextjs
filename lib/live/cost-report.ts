/** Public accounting projection: never select/spread a ledger session or its owner capability. */
export interface CostSession {
  id: string; tenant_id: string; customer_id: string | null; project_id: string | null;
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
export const SESSION_COLUMNS = 'id,tenant_id,customer_id,project_id,internal_demo_id,provider_session_id,environment,test_run_id,scenario_id,created_at,ended_at,config_version,dataset_version,models,rate_snapshot,voice_seconds,backend_cost_usd,known_cost_usd,accounting_status,termination_reason';
export const EVENT_COLUMNS = 'response_id,model,input_tokens,cached_tokens,output_tokens,cost_usd,evidence_status';
export interface CostFilters { tenant?: string; customer?: string; environment?: string; testRun?: string }
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
    sessionId: s.id, tenant: s.tenant_id, customer: s.customer_id, project: s.project_id, internalDemo: s.internal_demo_id,
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
export function buildCostReport(rows: CostRow[], cutoff: string, filters: CostFilters = {}) {
  const groups = new Map<string, { identity: { tenant: string; customer: string | null; project: string | null; internalDemo: string | null; environment: string; testRunId: string | null; scenario: string | null }; rows: CostRow[] }>();
  for (const row of rows) {
    const { tenant, customer, project, internalDemo, environment, testRunId, scenario } = row;
    const identity = { tenant, customer, project, internalDemo, environment, testRunId, scenario };
    const key = JSON.stringify(identity);
    const group = groups.get(key) ?? { identity, rows: [] };
    group.rows.push(row); groups.set(key, group);
  }
  return { cutoff, filters, currency: 'USD', basis: 'Calculated provider estimates; incomplete/provisional amounts are known lower bounds. Fixed Vercel/Supabase costs excluded.', rows, groups: [...groups.values()].map(g => ({ ...g.identity, ...summary(g.rows) })) };
}
/** Quote every field; neutralize spreadsheet formulas even after leading whitespace. */
export function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function costRowsCsv(rows: CostRow[]) {
  const headers: (keyof CostRow)[] = [
    'sessionId', 'tenant', 'customer', 'project', 'internalDemo', 'providerSessionId',
    'environment', 'testRunId', 'scenario', 'startedAt', 'endedAt', 'durationSeconds',
    'voiceSeconds', 'inputTokens', 'cachedTokens', 'outputTokens', 'usageEventCount',
    'unknownUsageEvents', 'knownVoiceUsd', 'knownBackendUsd', 'knownTotalUsd',
    'accountingStatus', 'ledgerAccountingStatus', 'reconciles', 'termination',
    'voiceModel', 'backendModel', 'speaker', 'observedBackendModels', 'rateVersion',
    'configVersion', 'datasetVersion',
  ];
  return [headers.map(csvCell).join(','), ...rows.map(row => headers.map(key => csvCell(row[key])).join(','))].join('\r\n') + '\r\n';
}
