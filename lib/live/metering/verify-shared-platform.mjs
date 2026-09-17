/** SQL proof shared by disposable PGlite and independent PostgreSQL connections.
 * No provider calls. The PostgreSQL runner rewrites only the fixed v2 schema name.
 */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function verifySharedPlatform(db, race) {
  const migration = await readFile(new URL('../../../supabase/migrations/095_shared_voice_platform.sql', import.meta.url), 'utf8');
  await db.exec(`create schema v2;
    create table v2.customers(id text primary key);
    create table v2.projects(id text primary key,customer_id text references v2.customers(id));
    insert into v2.customers values ('nyhavna-utvikling'), ('fixture-customer'), ('fixture-other');
    insert into v2.projects values ('nyhavna-utvikling_nyhavna','nyhavna-utvikling'),
      ('fixture-a','fixture-customer'),('fixture-b','fixture-customer'),('fixture-c','fixture-other');`);
  for (const name of ['093_voice_metering.sql', '094_voice_close_lease.sql']) {
    await db.exec(await readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  }
  const owner = '10000000-0000-4000-8000-000000000000';
  const payload = tenantId => ({ tenantId, ownerToken: owner, environment: 'test', configVersion: 'v1', datasetVersion: 'v1',
    models: { voice: 'gpt-live-1', backend: 'gpt-5.6-terra', speaker: 'willow' }, rateSnapshot: { version: 'openai-2026-09-16-v1' } });
  const rpc = async (name, p) => (await db.query(`select v2.${name}($1::jsonb) as result`, [JSON.stringify(p)])).rows[0].result;
  const reserve = (id, fields = {}) => rpc('voice_reserve', { ...payload(id), ...fields });
  const finalize = session => rpc('voice_mutate', { sessionId: session.id, ownerToken: owner, action: 'finalize',
    terminationReason: 'verification_not_created', providerClosed: false, finalUsageConfirmed: false, neverCreated: true });
  await db.exec(`insert into v2.voice_tenants(id,internal_demo_id,enabled,max_concurrent,max_per_hour,max_per_day,daily_budget_usd,reservation_usd)
    values('legacy','legacy',true,20,100,100,100,5);`);
  // Pre-change evidence: 093 admits without any platform/customer/project policy.
  const historical = await reserve('legacy');
  assert.equal(historical.purpose, undefined);
  await db.query(`update v2.voice_sessions set state='closed', accounting_status='incomplete',
    created_at=clock_timestamp()-interval '2 days' where id=$1`, [historical.id]);
  await db.exec(migration);
  assert.equal((await db.query('select purpose from v2.voice_sessions where id=$1', [historical.id])).rows[0].purpose, null);

  await db.exec(`insert into v2.voice_tenants(id,customer_id,project_id,purpose,enabled,max_concurrent,max_per_hour,max_per_day,daily_budget_usd,reservation_usd)
    values ('fixture-a','fixture-customer','fixture-a','public',true,20,100,100,100,5),
      ('fixture-ab','fixture-customer','fixture-a','benchmark',true,20,100,100,100,5),
      ('fixture-ai','fixture-customer','fixture-a','internal',true,20,100,100,100,5),
      ('fixture-b','fixture-customer','fixture-b','public',true,20,100,100,100,5),
      ('fixture-c','fixture-other','fixture-c','public',true,20,100,100,100,5);
    insert into v2.voice_projects(slug,customer_id,project_id,content_source,enabled,public_tenant_id,benchmark_tenant_id,internal_tenant_id)
      values ('fixture-a','fixture-customer','fixture-a','fixture-a',true,'fixture-a','fixture-ab','fixture-ai'),
        ('fixture-b','fixture-customer','fixture-b','fixture-b',true,'fixture-b',null,null),
        ('fixture-c','fixture-other','fixture-c','fixture-c',true,'fixture-c',null,null);
    insert into v2.voice_admission_policies(scope_type,scope_id,enabled,max_concurrent,max_per_hour,max_per_day,daily_budget_usd)
      values ('customer','fixture-customer',true,20,100,100,100),('customer','fixture-other',true,20,100,100,100),
        ('project','fixture-a',true,20,100,100,100),('project','fixture-b',true,20,100,100,100),('project','fixture-c',true,20,100,100,100);`);
  const clear = () => db.exec("delete from v2.voice_sessions where tenant_id like 'fixture-%'");
  const policy = (type, id, column, value) => {
    assert.ok(['max_concurrent', 'max_per_hour', 'max_per_day', 'daily_budget_usd', 'enabled'].includes(column));
    return db.query(`update v2.voice_admission_policies set ${column}=$3 where scope_type=$1 and scope_id=$2`, [type, id, value]);
  };
  // Missing and disabled parent policies fail closed, including legacy's platform policy.
  for (const [type, id] of [['platform', 'platform'], ['customer', 'fixture-customer'], ['project', 'fixture-a']]) {
    await policy(type, id, 'enabled', false);
    await assert.rejects(reserve('fixture-a'), new RegExp(`voice_policy_denied:${type}`));
    if (type === 'platform') await assert.rejects(reserve('legacy'), /voice_policy_denied:platform/);
    await policy(type, id, 'enabled', true);
    const row = (await db.query('delete from v2.voice_admission_policies where scope_type=$1 and scope_id=$2 returning *', [type, id])).rows[0];
    await assert.rejects(reserve('fixture-a'), new RegExp(`voice_policy_denied:${type}`));
    await db.query('insert into v2.voice_admission_policies select * from jsonb_populate_record(null::v2.voice_admission_policies,$1::jsonb)', [JSON.stringify(row)]);
  }
  // Project exhaustion does not block its eligible sibling. Purposes share ceilings.
  await policy('project', 'fixture-a', 'max_concurrent', 1);
  const a = await reserve('fixture-a', { customerId: 'forged', purpose: 'benchmark', reservationUsd: 0 });
  assert.equal(a.customer_id, 'fixture-customer'); assert.equal(a.project_id, 'fixture-a'); assert.equal(a.purpose, 'public');
  assert.equal(a.reservation_usd, 5);
  await assert.rejects(reserve('fixture-ab'), /voice_admission_limit:project/);
  await reserve('fixture-b');
  await policy('project', 'fixture-a', 'max_concurrent', 20); await clear();
  // Both customer and global ceilings span otherwise independent project tenants.
  for (const [type, id, other] of [['customer', 'fixture-customer', 'fixture-b'], ['platform', 'platform', 'fixture-c']]) {
    await policy(type, id, 'max_concurrent', 1);
    if (race) {
      const outcomes = await race([payload('fixture-a'), payload(other)]);
      assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
      const denied = outcomes.find(outcome => outcome.status === 'rejected');
      assert.match(denied.reason.message, new RegExp(`voice_admission_limit:${type}`));
    } else {
      await reserve('fixture-a'); await assert.rejects(reserve(other), new RegExp(`voice_admission_limit:${type}`));
    }
    if (type === 'customer') await reserve('fixture-c');
    else await assert.rejects(reserve('legacy'), /voice_admission_limit:platform/);
    await clear(); await policy(type, id, 'max_concurrent', type === 'platform' ? 8 : 20);
  }
  // Complete/no-create still counts as an admitted call for hour/day rate limits.
  for (const column of ['max_per_hour', 'max_per_day']) {
    await policy('customer', 'fixture-customer', column, 1);
    await finalize(await reserve('fixture-a'));
    await assert.rejects(reserve('fixture-b'), /voice_admission_limit:customer/);
    await policy('customer', 'fixture-customer', column, 100); await clear();
  }
  // Every purpose consumes money protection, including old incomplete evidence.
  await policy('project', 'fixture-a', 'daily_budget_usd', 10);
  await reserve('fixture-a'); await reserve('fixture-ab');
  await assert.rejects(reserve('fixture-ai'), /voice_admission_limit:project/);
  await clear(); await policy('project', 'fixture-a', 'daily_budget_usd', 100);
  await policy('platform', 'platform', 'daily_budget_usd', 9);
  await assert.rejects(reserve('fixture-c'), /voice_admission_limit:platform/); // $5 old + $5 new
  await policy('platform', 'platform', 'daily_budget_usd', 10);
  const cost = await reserve('fixture-ai'); assert.equal(cost.purpose, 'internal');
  await clear(); await policy('platform', 'platform', 'daily_budget_usd', 200);
  const incomplete = await reserve('fixture-ab');
  await db.query(`update v2.voice_sessions set state='closed',accounting_status='incomplete',known_cost_usd=30,
    created_at=clock_timestamp()-interval '3 days' where id=$1`, [incomplete.id]);
  await policy('project', 'fixture-a', 'daily_budget_usd', 34);
  await assert.rejects(reserve('fixture-a'), /voice_admission_limit:project/); // max(reservation, known), regardless of age
  await clear(); await policy('project', 'fixture-a', 'daily_budget_usd', 100);

  // Disabled registry, a missing binding, stale tenant binding and ownership mismatch all deny.
  await db.exec("update v2.voice_projects set enabled=false where slug='fixture-a'");
  await assert.rejects(reserve('fixture-a'), /voice_identity_invalid/);
  await db.exec("update v2.voice_projects set enabled=true,public_tenant_id='legacy' where slug='fixture-a'");
  await assert.rejects(reserve('fixture-a'), /voice_identity_invalid/);
  await db.exec("update v2.voice_projects set public_tenant_id='fixture-a' where slug='fixture-a'; update v2.projects set customer_id='fixture-other' where id='fixture-a'");
  await assert.rejects(reserve('fixture-a'), /voice_identity_invalid/);
  await db.exec("update v2.projects set customer_id='fixture-customer' where id='fixture-a'");
  await db.exec("delete from v2.voice_projects where slug='fixture-c'");
  await assert.rejects(reserve('fixture-c'), /voice_identity_invalid/);
  const legacy = await reserve('legacy'); assert.equal(legacy.purpose, 'internal'); await finalize(legacy);
  // Accounting identity/purpose cannot be rewritten by maintenance or mutation paths.
  await assert.rejects(db.query("update v2.voice_sessions set purpose='public' where id=$1", [historical.id]), /voice_identity_immutable/);
  await assert.rejects(db.exec("update v2.voice_tenants set purpose='benchmark' where id='fixture-a'"), /voice_identity_immutable/);
  await assert.rejects(db.exec("update v2.voice_projects set customer_id='fixture-other' where slug='fixture-a'"), /voice_identity_immutable/);
  const owned = await reserve('fixture-a');
  await assert.rejects(db.query("update v2.voice_sessions set rate_snapshot='{}'::jsonb where id=$1", [owned.id]), /voice_identity_immutable/);
  await assert.rejects(rpc('voice_mutate', { sessionId: owned.id, ownerToken: '20000000-0000-4000-8000-000000000000', action: 'creating' }), /voice_owner_denied/);
  await rpc('voice_mutate', { sessionId: owned.id, ownerToken: owner, action: 'creating' });
  await rpc('voice_mutate', { sessionId: owned.id, ownerToken: owner, action: 'bind', providerSessionId: 'fixture-provider' });
  await db.query("update v2.voice_sessions set deadline_at=clock_timestamp()+interval '2 seconds' where id=$1", [owned.id]);
  const heartbeat = await rpc('voice_mutate', { sessionId: owned.id, ownerToken: owner, action: 'heartbeat' });
  assert.equal(Date.parse(heartbeat.lease_expires_at) - Date.parse(heartbeat.deadline_at), 30_000);
  await rpc('voice_mutate', { sessionId: owned.id, ownerToken: owner, action: 'voice', seconds: 30 });
  const closed = await rpc('voice_mutate', { sessionId: owned.id, ownerToken: owner, action: 'finalize', terminationReason: 'stopped', providerClosed: true, finalUsageConfirmed: true });
  assert.equal(closed.accounting_status, 'complete'); assert.equal(closed.purpose, 'public'); await clear();

  // Migration replay preserves edited budget/enabled config and historical meaning.
  await policy('project', 'nyhavna-utvikling_nyhavna', 'daily_budget_usd', 123);
  await db.exec("update v2.voice_projects set enabled=false where slug='nyhavna'; update v2.voice_tenants set daily_budget_usd=99 where id='nyhavna-public'");
  await db.exec(migration);
  assert.equal(Number((await db.query("select daily_budget_usd from v2.voice_admission_policies where scope_type='project' and scope_id='nyhavna-utvikling_nyhavna'")).rows[0].daily_budget_usd), 123);
  assert.equal((await db.query("select enabled from v2.voice_projects where slug='nyhavna'")).rows[0].enabled, false);
  assert.equal(Number((await db.query("select daily_budget_usd from v2.voice_tenants where id='nyhavna-public'")).rows[0].daily_budget_usd), 99);
  assert.equal((await db.query('select purpose from v2.voice_sessions where id=$1', [historical.id])).rows[0].purpose, null);
  await db.exec("update v2.projects set customer_id='fixture-other' where id='nyhavna-utvikling_nyhavna'");
  await assert.rejects(db.exec(migration), /voice_seed_owner_mismatch/); await db.exec('rollback');

  for (const table of ['voice_projects', 'voice_admission_policies', 'voice_sessions', 'voice_tenants', 'voice_usage_events']) {
    for (const role of ['anon', 'authenticated']) {
      const grant = (await db.query(`select has_table_privilege($1,'v2.${table}','select,insert,update,delete') as allowed`, [role])).rows[0];
      assert.equal(grant.allowed, false);
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query(`select * from v2.${table}`), /permission denied/);
      await db.exec('reset role');
    }
  }
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query("select has_function_privilege($1,'v2.voice_reserve(jsonb)','execute') as allowed", [role])).rows[0].allowed, false);
    await db.exec(`set role ${role}`); await assert.rejects(reserve('legacy'), /permission denied/); await db.exec('reset role');
  }
  assert.equal((await db.query("select has_table_privilege('service_role','v2.voice_projects','select') as allowed")).rows[0].allowed, true);
  const rls = await db.query("select count(*)::integer as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='v2' and c.relname in ('voice_projects','voice_admission_policies') and c.relrowsecurity");
  assert.equal(rls.rows[0].n, 2);
  return { checks: 'identity, policy presence, scope isolation, all-purpose/history exposure, purpose snapshots, grants/RLS, idempotency, owner fencing, deadline drain', concurrentConnections: Boolean(race) };
}

async function main() {
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    const result = await verifySharedPlatform(db);
    console.log('PASS: shared platform SQL', JSON.stringify(result));
  } finally { await db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
