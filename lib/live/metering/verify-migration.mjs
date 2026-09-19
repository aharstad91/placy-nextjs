/** Run with PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node lib/live/metering/verify-migration.mjs.
 * Disposable PostgreSQL/WASM validation; no hosted DB writes, no provider requests.
 * Root additionally verifies real Supabase grants and competing connections before release.
 */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
process.on('uncaughtException',error=>{console.error(error.message);process.exit(1);});
const {PGlite}=await import(process.env.PGLITE_MODULE);
const db=new PGlite();
await db.exec(`create schema v2; create role anon; create role authenticated; create role service_role;
create table v2.customers(id text primary key); create table v2.projects(id text primary key,customer_id text references v2.customers(id));`);
await db.exec(await readFile(new URL('../../../supabase/migrations/095_voice_metering.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../../../supabase/migrations/096_voice_close_lease.sql',import.meta.url),'utf8'));
await db.exec(`insert into v2.voice_tenants(id,internal_demo_id,enabled,max_concurrent,max_per_hour,max_per_day,daily_budget_usd,reservation_usd)
 values ('test','internal-test',true,2,10,30,2.2,1);`);
const owner='10000000-0000-4000-8000-000000000000';
const recovery='20000000-0000-4000-8000-000000000000';
const reserve={tenantId:'test',ownerToken:owner,environment:'test',configVersion:'v1',datasetVersion:'v1',rateSnapshot:{version:'openai-2026-09-16-v1'},models:{voice:'gpt-live-1',backend:'gpt-5.6-terra',speaker:'willow'}};
const rpc=async(name,p)=>(await db.query(`select v2.${name}($1::jsonb) as result`,[JSON.stringify(p)])).rows[0].result;
const a=await rpc('voice_reserve',reserve);
const b=await rpc('voice_reserve',reserve);
await assert.rejects(rpc('voice_reserve',reserve),/voice_admission_limit/);
let owned={sessionId:a.id,ownerToken:owner};
const mutate=(action,rest={})=>rpc('voice_mutate',{...owned,action,...rest});
await assert.rejects(rpc('voice_mutate',{...owned,ownerToken:recovery,action:'heartbeat'}),/voice_owner_denied/);
await mutate('creating');
await mutate('bind',{providerSessionId:'provider-a'});
for (const seconds of [120,60,130]) await mutate('voice',{seconds});
const event={responseId:'response-a',model:'gpt-5.6-terra',evidenceStatus:'valid',inputTokens:100,cachedTokens:20,outputTokens:30,knownRate:true};
await mutate('event',event); await mutate('event',event);
let row=(await db.query('select * from v2.voice_sessions where id=$1',[a.id])).rows[0];
assert.equal(Number(row.voice_seconds),130);
assert.equal(Number(row.backend_cost_usd),0.000524);
assert.equal((await db.query('select * from v2.voice_usage_events')).rows.length,1);
row=await mutate('finalize',{terminationReason:'stopped',providerClosed:true,finalUsageConfirmed:false});
assert.equal(row.accounting_status,'incomplete');
// Incomplete terminal rows keep the reservation; slot availability never means budget availability.
await assert.rejects(rpc('voice_reserve',reserve),/voice_admission_limit/);
row=await mutate('finalize',{terminationReason:'stopped',providerClosed:true,finalUsageConfirmed:true});
assert.equal(row.accounting_status,'complete');
await rpc('voice_mutate',{sessionId:b.id,ownerToken:owner,action:'creating'});
await db.query("update v2.voice_sessions set lease_expires_at=now()-interval '1 minute' where id=$1",[b.id]);
const claims=await rpc('voice_claim_recoveries',{ownerToken:recovery,limit:10});
assert.equal(claims.length,1); assert.equal(claims[0].id,b.id);
assert.equal((await rpc('voice_claim_recoveries',{ownerToken:owner,limit:10})).length,0);
await assert.rejects(rpc('voice_mutate',{sessionId:b.id,ownerToken:owner,action:'heartbeat'}),/voice_owner_denied/);
await rpc('voice_mutate',{sessionId:b.id,ownerToken:recovery,action:'finalize',terminationReason:'lost_owner',providerClosed:false,finalUsageConfirmed:false});
await db.query("update v2.voice_sessions set created_at=now()-interval '2 days' where id=$1",[b.id]);
const c=await rpc('voice_reserve',reserve);
// Old unresolved session still reserves $1; second new $1 would exceed ceiling.
await assert.rejects(rpc('voice_reserve',reserve),/voice_admission_limit/);
owned={sessionId:c.id,ownerToken:owner};
await mutate('creating');
row=await mutate('finalize',{terminationReason:'http_rejected',providerClosed:false,finalUsageConfirmed:false,creationRejected:true});
assert.equal(row.accounting_status,'complete'); assert.equal(row.known_cost_usd,0);
const d=await rpc('voice_reserve',reserve); owned={sessionId:d.id,ownerToken:owner};
await mutate('creating'); await mutate('bind',{providerSessionId:'provider-d'});
await mutate('voice',{seconds:10});
await mutate('event',{...event,responseId:'long-context',inputTokens:272001});
row=await mutate('finalize',{terminationReason:'stopped',providerClosed:true,finalUsageConfirmed:true});
assert.equal(row.accounting_status,'incomplete');
// Separate hourly/day policies, and customer/project identity integrity.
await db.exec(`insert into v2.voice_tenants(id,internal_demo_id,enabled,max_concurrent,max_per_hour,max_per_day,daily_budget_usd,reservation_usd)
 values ('hour','hour',true,2,1,30,10,1),('day','day',true,2,10,1,10,1);
 insert into v2.customers values('customer-a'),('customer-b');
 insert into v2.projects values('project-a','customer-a');
 insert into v2.voice_tenants(id,customer_id,project_id,enabled,daily_budget_usd,reservation_usd)
 values ('mismatch','customer-b','project-a',true,10,1);`);
for (const tenantId of ['hour','day']) {
  const session=await rpc('voice_reserve',{...reserve,tenantId});
  await rpc('voice_mutate',{sessionId:session.id,ownerToken:owner,action:'finalize',terminationReason:'not_started',providerClosed:false,finalUsageConfirmed:false,neverCreated:true});
  await assert.rejects(rpc('voice_reserve',{...reserve,tenantId}),/voice_admission_limit/);
}
await assert.rejects(rpc('voice_reserve',{...reserve,tenantId:'mismatch'}),/voice_identity_invalid/);
await assert.rejects(rpc('voice_reserve',{...reserve,tenantId:'missing'}),/voice_admission_denied/);
// Unknown/invalid usage never becomes a known zero backend charge.
await db.exec(`insert into v2.voice_tenants(id,internal_demo_id,enabled,daily_budget_usd,reservation_usd) values('invalid','invalid',true,10,1);`);
const invalid=await rpc('voice_reserve',{...reserve,tenantId:'invalid'});
owned={sessionId:invalid.id,ownerToken:owner};
await mutate('creating'); await mutate('bind',{providerSessionId:'provider-invalid'});
await assert.rejects(mutate('event',{...event,inputTokens:1.5}),/voice_invalid_tokens/);
await mutate('event',{responseId:'invalid-evidence',model:'gpt-5.6-terra',evidenceStatus:'invalid'});
await mutate('voice',{seconds:0});
row=await mutate('finalize',{terminationReason:'stopped',providerClosed:true,finalUsageConfirmed:true});
assert.equal(row.accounting_status,'incomplete'); assert.equal(row.invalid_usage,true);
// A disconnected owner can prove it never attempted creation after checkpointing creating.
await db.exec(`insert into v2.voice_tenants(id,internal_demo_id,enabled,daily_budget_usd,reservation_usd) values('no-attempt','no-attempt',true,10,1);`);
const noAttempt=await rpc('voice_reserve',{...reserve,tenantId:'no-attempt'});
owned={sessionId:noAttempt.id,ownerToken:owner};
await mutate('creating');
row=await mutate('finalize',{terminationReason:'disconnected_before_create',providerClosed:false,finalUsageConfirmed:false,neverCreated:true});
assert.equal(row.accounting_status,'complete'); assert.equal(row.known_cost_usd,0); assert.equal(row.state,'closed');
await assert.rejects(mutate('finalize',{terminationReason:'invalid_repeat',providerClosed:false,finalUsageConfirmed:false,neverCreated:true}),/voice_invalid_no_create/);
const attempted=await rpc('voice_reserve',{...reserve,tenantId:'no-attempt'});
owned={sessionId:attempted.id,ownerToken:owner};
await mutate('creating'); await mutate('bind',{providerSessionId:'provider-attempted'});
await assert.rejects(mutate('finalize',{terminationReason:'invalid_active',providerClosed:false,finalUsageConfirmed:false,neverCreated:true}),/voice_invalid_no_create/);
// Stale untouched reservations are conclusively free and never handed to the reaper.
await db.exec(`insert into v2.voice_tenants(id,internal_demo_id,enabled,daily_budget_usd,reservation_usd) values('untouched','untouched',true,1,1);`);
const untouched=await rpc('voice_reserve',{...reserve,tenantId:'untouched'});
await db.query("update v2.voice_sessions set lease_expires_at=now()-interval '1 minute' where id=$1",[untouched.id]);
const untouchedClaims=await rpc('voice_claim_recoveries',{ownerToken:recovery,limit:50});
assert.equal(untouchedClaims.some(row=>row.id===untouched.id),false);
const untouchedRow=(await db.query('select * from v2.voice_sessions where id=$1',[untouched.id])).rows[0];
assert.equal(untouchedRow.state,'closed'); assert.equal(untouchedRow.accounting_status,'complete');
assert.equal(Number(untouchedRow.known_cost_usd),0); assert.equal(untouchedRow.termination_reason,'expired_before_create');
await rpc('voice_reserve',{...reserve,tenantId:'untouched'}); // reservation liability was released
await assert.rejects(rpc('voice_mutate',{sessionId:untouched.id,ownerToken:owner,action:'creating'}),/voice_owner_denied/);
// A deadline stops media but preserves a bounded final-usage drain lease.
await db.exec(`insert into v2.voice_tenants(id,internal_demo_id,enabled,daily_budget_usd,reservation_usd) values('deadline','deadline',true,10,1);`);
const deadlineSession=await rpc('voice_reserve',{...reserve,tenantId:'deadline'});
owned={sessionId:deadlineSession.id,ownerToken:owner};
await mutate('creating'); await mutate('bind',{providerSessionId:'provider-deadline'});
await db.query("update v2.voice_sessions set deadline_at=clock_timestamp()+interval '2 seconds' where id=$1",[deadlineSession.id]);
const heartbeatRow=await mutate('heartbeat');
assert.equal(Date.parse(heartbeatRow.lease_expires_at)-Date.parse(heartbeatRow.deadline_at),30000);
await db.query("update v2.voice_sessions set deadline_at=clock_timestamp()-interval '1 second' where id=$1",[deadlineSession.id]);
await assert.rejects(mutate('heartbeat'),/voice_invalid_state/);
await mutate('voice',{seconds:30});
row=await mutate('finalize',{terminationReason:'limit',providerClosed:true,finalUsageConfirmed:true});
assert.equal(row.accounting_status,'complete');
const grants=(await db.query(`select has_table_privilege('anon','v2.voice_sessions','select') as anon,
has_table_privilege('authenticated','v2.voice_usage_events','insert') as auth,
has_table_privilege('service_role','v2.voice_sessions','select') as service,
has_function_privilege('anon','v2.voice_reserve(jsonb)','execute') as fn`)).rows[0];
assert.deepEqual(grants,{anon:false,auth:false,service:true,fn:false});
assert.equal((await db.query("select count(*)::integer as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='v2' and c.relname like 'voice_%' and c.relrowsecurity")).rows[0].n,3);
console.warn('PASS: migration, identity, admission caps, budget liability, owner fencing, response deduplication, monotonic voice, late final evidence, rejected create, unknown rate, recovery claim, grants and RLS');
await db.close();
