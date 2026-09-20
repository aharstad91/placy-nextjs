/**
 * No provider requests. No production migration or operational policy changes.
 * VOICE_VERIFY_DATABASE_URL=<private PostgreSQL connection> npx tsx scripts/verify-voice-platform.ts --fixtures
 * --fixtures: exact migrations in a unique disposable schema, real competing connections, cleanup in finally.
 * --read-only: check the live v2 schema's binding, ceilings and privileges without writes.
 * Production application of migration 095 is deliberately a separate operator step.
 */
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// pg is already installed for operator tooling; keep its types out of the app dependency graph.
interface PgClient {
  query(sql: string, parameters?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
}
interface PgPool { connect(): Promise<PgClient>; end(): Promise<void> }
const pg = createRequire(import.meta.url)('pg') as { Pool: new (options: Record<string, unknown>) => PgPool };
import { verifySharedPlatform } from '@/lib/live/metering/verify-shared-platform.mjs';

async function main() {
  const { values } = parseArgs({ options: {
    fixtures: { type: 'boolean' }, 'read-only': { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('VOICE_VERIFY_DATABASE_URL=<PostgreSQL URL> npx tsx scripts/verify-voice-platform.ts --fixtures | --read-only');
    return;
  }
  if (Boolean(values.fixtures) === Boolean(values['read-only'])) throw new Error('Choose exactly --fixtures or --read-only');
  const connectionString = process.env.VOICE_VERIFY_DATABASE_URL;
  if (!connectionString) throw new Error('Set VOICE_VERIFY_DATABASE_URL privately; connection values are never printed');
  const pool = new pg.Pool({ connectionString, max: 4, connectionTimeoutMillis: 10_000,
    application_name: 'placy-voice-platform-verification', statement_timeout: 15_000 });
  const client = await pool.connect();
  let schema: string | undefined;
  try {
    if (values['read-only']) {
      await client.query('begin read only');
      const binding = await client.query(`select r.*, p.customer_id as actual_customer_id from v2.voice_projects r
        join v2.projects p on p.id=r.project_id where r.slug='nyhavna'`);
      assert.equal(binding.rows.length, 1);
      const row = binding.rows[0];
      assert.equal(row.customer_id, 'nyhavna-utvikling');
      assert.equal(row.actual_customer_id, row.customer_id);
      assert.equal(row.project_id, 'nyhavna-utvikling_nyhavna');
      assert.equal(row.content_source, 'nyhavna-lokal');
      assert.equal(row.enabled, true);
      for (const [purpose, id] of [['public', row.public_tenant_id], ['benchmark', row.benchmark_tenant_id]]) {
        const tenant = await client.query('select customer_id,project_id,purpose,enabled from v2.voice_tenants where id=$1', [id]);
        assert.deepEqual(tenant.rows, [{ customer_id: row.customer_id, project_id: row.project_id, purpose, enabled: true }]);
      }
      const policies = await client.query(`select scope_type,scope_id,enabled,max_concurrent,max_per_hour,max_per_day,daily_budget_usd
        from v2.voice_admission_policies where (scope_type='platform' and scope_id='platform')
          or (scope_type='customer' and scope_id=$1) or (scope_type='project' and scope_id=$2)
        order by scope_type`, [row.customer_id, row.project_id]);
      assert.equal(policies.rows.length, 3);
      for (const role of ['anon', 'authenticated']) {
        const grants = await client.query(`select
          has_table_privilege($1,'v2.voice_projects','select,insert,update,delete') as registry,
          has_table_privilege($1,'v2.voice_admission_policies','select,insert,update,delete') as policies,
          has_function_privilege($1,'v2.voice_reserve(jsonb)','execute') as reserve`, [role]);
        assert.deepEqual(grants.rows[0], { registry: false, policies: false, reserve: false });
      }
      await client.query('commit');
      console.log(JSON.stringify({ mode: 'read-only', binding: row, policies: policies.rows, rolePrivileges: 'denied' }, null, 2));
      return;
    }
    schema = `voice_verify_${randomUUID().replaceAll('-', '')}`;
    // Only this known constant namespace is rewritten. No customer data or live policy is touched.
    const sql = (query: string) => query.replace(/\bv2\b/g, schema!);
    const db = {
      async exec(query: string) {
        // SET LOCAL inside a transaction also works with Supabase's transaction pooler.
        const role = /^set role (anon|authenticated)$/.exec(query)?.[1];
        if (role) { await client.query('begin'); await client.query(`set local role ${role}`); return; }
        if (query === 'reset role') { await client.query('rollback'); return; }
        await client.query(sql(query));
      },
      async query(query: string, parameters?: unknown[]) {
        return client.query(sql(query), parameters);
      },
    };
    const race = async (payloads: object[]) => {
      const connections = await Promise.all(payloads.map(() => pool.connect()));
      try {
        // Independent backend transactions compete for the same scope rows.
        return await Promise.allSettled(connections.map((connection, index) =>
          connection.query(sql('select v2.voice_reserve($1::jsonb) as result'), [JSON.stringify(payloads[index])])));
      } finally { connections.forEach(connection => connection.release()); }
    };
    const result = await verifySharedPlatform(db, race);
    console.log(JSON.stringify({ mode: 'disposable-private-schema', database: 'real PostgreSQL',
      migrations: '093,094,095; namespace only rewritten', ...result }, null, 2));
  } finally {
    // A failed expected assertion may leave a transaction aborted; clear it before cleanup.
    await client.query('rollback').catch(() => undefined);
    try {
      if (schema) await client.query(`drop schema if exists ${schema} cascade`);
    } finally {
      client.release();
      await pool.end();
    }
  }
}
main().catch(error => {
  // Connection errors may contain endpoints. Emit a bounded diagnostic, never the URL/config.
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted connection]') : 'Verification failed');
  process.exitCode = 1;
});
