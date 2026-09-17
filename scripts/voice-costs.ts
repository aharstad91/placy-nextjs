import { parseArgs } from 'node:util';
import { createServerClient } from '@/lib/supabase/client';
import { buildCostReport, costRowsCsv, readCostRows, readAdmissionSnapshot, SESSION_COLUMNS, EVENT_COLUMNS, ADMISSION_COLUMNS, POLICY_COLUMNS, type CostSession, type CostEvent, type CostFilters, type CostReader, type AdmissionReader, type AdmissionSession } from '@/lib/live/cost-report';
import type { VoiceAdmissionPolicy } from '@/lib/live/metering/types';

async function main() {
  const { values } = parseArgs({ options: {
    tenant: { type: 'string' }, customer: { type: 'string' }, project: { type: 'string' }, purpose: { type: 'string' }, environment: { type: 'string' },
    'test-run': { type: 'string' }, format: { type: 'string', default: 'json' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('npx tsx scripts/voice-costs.ts [--tenant ID] [--customer ID] [--project ID] [--purpose public|internal|benchmark|legacy] [--environment development|preview|production|test] [--test-run ID] [--format json|csv]\nJSON separates filtered usage from unfiltered operational headroom. CSV contains selected sessions only.');
    return;
  }
  if (!['json', 'csv'].includes(values.format!)) throw new Error('Format must be json or csv');
  if (values.environment && !['development','preview','production','test'].includes(values.environment)) throw new Error('Invalid environment');
  if (values.purpose && !['public', 'internal', 'benchmark', 'legacy'].includes(values.purpose)) throw new Error('Invalid purpose');
  const filters: CostFilters = { tenant: values.tenant, customer: values.customer, project: values.project, purpose: values.purpose as CostFilters['purpose'], environment: values.environment, testRun: values['test-run'] };
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
      if (filters.project) query = query.eq('project_id', filters.project);
      if (filters.purpose === 'legacy') query = query.is('purpose', null);
      else if (filters.purpose) query = query.eq('purpose', filters.purpose);
      if (filters.environment) query = query.eq('environment', filters.environment);
      if (filters.testRun) query = query.eq('test_run_id', filters.testRun);
      const { data, error } = await query;
      if (error) throw new Error(`Session read failed (${error.code}); verify service-role credentials and migrations 093–095`);
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
  const admissionReader: AdmissionReader = {
    async sessions({ after, cutoff, limit }) {
      let query = db.from('voice_sessions').select(ADMISSION_COLUMNS).lte('created_at', cutoff).order('id').limit(limit);
      if (after) query = query.gt('id', after);
      const { data, error } = await query;
      if (error) throw new Error(`Admission ledger read failed (${error.code}); no partial report emitted`);
      return data as unknown as AdmissionSession[];
    },
    async policies({ offset, limit }) {
      const { data, error } = await db.from('voice_admission_policies').select(POLICY_COLUMNS)
        .order('scope_type').order('scope_id').range(offset, offset + limit - 1);
      if (error) throw new Error(`Admission policy read failed (${error.code}); verify migration 095; no partial report emitted`);
      return data as unknown as VoiceAdmissionPolicy[];
    },
  };
  // Mandatory independent projection: a filtered customer's rows cannot establish
  // its parent's or the platform's available budget. No event fan-out here.
  const admission = await readAdmissionSnapshot(admissionReader, cutoff);
  const rows = await readCostRows(reader, filters, cutoff);
  process.stdout.write(values.format === 'csv' ? costRowsCsv(rows) : JSON.stringify(buildCostReport(rows, cutoff, filters, admission), null, 2) + '\n');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Cost report failed'); process.exitCode = 1; });
