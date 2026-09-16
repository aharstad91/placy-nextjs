import { parseArgs } from 'node:util';
import { createServerClient } from '@/lib/supabase/client';
import { buildCostReport, costRowsCsv, readCostRows, SESSION_COLUMNS, EVENT_COLUMNS, type CostSession, type CostEvent, type CostFilters, type CostReader } from '@/lib/live/cost-report';

async function main() {
  const { values } = parseArgs({ options: {
    tenant: { type: 'string' }, customer: { type: 'string' }, environment: { type: 'string' },
    'test-run': { type: 'string' }, format: { type: 'string', default: 'json' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('npx tsx scripts/voice-costs.ts [--tenant ID] [--customer ID] [--environment development|preview|production|test] [--test-run ID] [--format json|csv]');
    return;
  }
  if (!['json', 'csv'].includes(values.format!)) throw new Error('Format must be json or csv');
  if (values.environment && !['development','preview','production','test'].includes(values.environment)) throw new Error('Invalid environment');
  const filters: CostFilters = { tenant: values.tenant, customer: values.customer, environment: values.environment, testRun: values['test-run'] };
  const cutoff = new Date().toISOString();
  // dotenv otherwise writes a banner to stdout and corrupts JSON/CSV exports.
  process.env.DOTENV_CONFIG_QUIET = 'true';
  await import('@/scripts/load-env');
  const db = createServerClient().schema('v2');
  const reader: CostReader = {
    async sessions({ after, cutoff, limit, filters }) {
      let query = db.from('voice_sessions').select(SESSION_COLUMNS).lte('created_at', cutoff).order('id').limit(limit);
      if (after) query = query.gt('id', after);
      if (filters.tenant) query = query.eq('tenant_id', filters.tenant);
      if (filters.customer) query = query.eq('customer_id', filters.customer);
      if (filters.environment) query = query.eq('environment', filters.environment);
      if (filters.testRun) query = query.eq('test_run_id', filters.testRun);
      const { data, error } = await query;
      if (error) throw new Error(`Session read failed (${error.code}); verify service-role credentials and migration 093`);
      return data as unknown as CostSession[];
    },
    async events({ sessionId, after, cutoff, limit }) {
      let query = db.from('voice_usage_events').select(EVENT_COLUMNS).eq('session_id', sessionId).lte('received_at', cutoff).order('response_id').limit(limit);
      if (after) query = query.gt('response_id', after);
      const { data, error } = await query;
      if (error) throw new Error(`Usage read failed (${error.code}); no partial report emitted`);
      return data as unknown as CostEvent[];
    },
  };
  const rows = await readCostRows(reader, filters, cutoff);
  process.stdout.write(values.format === 'csv' ? costRowsCsv(rows) : JSON.stringify(buildCostReport(rows, cutoff, filters), null, 2) + '\n');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Cost report failed'); process.exitCode = 1; });
