-- Shared admission is operational protection, not customer pricing or invoicing.
-- Additive: historical session identity/purpose is never backfilled.
begin;
alter table v2.voice_tenants add column if not exists purpose text check (purpose in ('public','internal','benchmark'));
alter table v2.voice_sessions add column if not exists purpose text check (purpose in ('public','internal','benchmark'));

create table if not exists v2.voice_projects (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  customer_id text not null references v2.customers(id),
  project_id text not null unique references v2.projects(id),
  content_source text not null check (content_source ~ '^[a-z0-9][a-z0-9_-]{0,99}$'),
  enabled boolean not null default false,
  public_tenant_id text not null unique references v2.voice_tenants(id),
  benchmark_tenant_id text unique references v2.voice_tenants(id),
  internal_tenant_id text unique references v2.voice_tenants(id),
  check (public_tenant_id is distinct from benchmark_tenant_id),
  check (public_tenant_id is distinct from internal_tenant_id),
  check (benchmark_tenant_id is null or benchmark_tenant_id is distinct from internal_tenant_id)
);
create table if not exists v2.voice_admission_policies (
  scope_type text not null check (scope_type in ('platform','customer','project')),
  scope_id text not null check (length(scope_id) between 1 and 200),
  enabled boolean not null default false,
  max_concurrent integer not null check (max_concurrent between 1 and 10000),
  max_per_hour integer not null check (max_per_hour between 1 and 1000000),
  max_per_day integer not null check (max_per_day between 1 and 10000000),
  daily_budget_usd numeric(16,8) not null check (daily_budget_usd > 0 and daily_budget_usd < 1000000),
  primary key(scope_type,scope_id),
  check (scope_type <> 'platform' or scope_id='platform')
);
create index if not exists voice_sessions_customer_admission on v2.voice_sessions(customer_id,created_at);
create index if not exists voice_sessions_project_admission on v2.voice_sessions(project_id,created_at);
create index if not exists voice_sessions_customer_liability on v2.voice_sessions(customer_id) where accounting_status <> 'complete';
create index if not exists voice_sessions_project_liability on v2.voice_sessions(project_id) where accounting_status <> 'complete';

-- Identity is a snapshot, including purpose. Privileged maintenance must not silently
-- reclassify previous supplier usage or reparent an existing admission tenant.
create or replace function v2.voice_identity_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name='voice_sessions' then
    if (new.tenant_id,new.internal_demo_id,new.customer_id,new.project_id,new.purpose,new.models,new.rate_snapshot)
      is distinct from (old.tenant_id,old.internal_demo_id,old.customer_id,old.project_id,old.purpose,old.models,old.rate_snapshot) then
      raise exception 'voice_identity_immutable';
    end if;
  elsif tg_table_name='voice_tenants' then
    if (new.id,new.internal_demo_id,new.customer_id,new.project_id,new.purpose)
      is distinct from (old.id,old.internal_demo_id,old.customer_id,old.project_id,old.purpose) then
      raise exception 'voice_identity_immutable';
    end if;
  elsif (new.slug,new.customer_id,new.project_id) is distinct from (old.slug,old.customer_id,old.project_id) then
    raise exception 'voice_identity_immutable';
  end if;
  return new;
end $$;
drop trigger if exists voice_session_identity_immutable on v2.voice_sessions;
create trigger voice_session_identity_immutable before update on v2.voice_sessions
  for each row execute function v2.voice_identity_immutable();
drop trigger if exists voice_tenant_identity_immutable on v2.voice_tenants;
create trigger voice_tenant_identity_immutable before update on v2.voice_tenants
  for each row execute function v2.voice_identity_immutable();
drop trigger if exists voice_project_identity_immutable on v2.voice_projects;
create trigger voice_project_identity_immutable before update on v2.voice_projects
  for each row execute function v2.voice_identity_immutable();

create or replace function v2.voice_reserve(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' set lock_timeout = '2s' as $$
declare
  initial_t v2.voice_tenants; t v2.voice_tenants; s v2.voice_sessions;
  registry v2.voice_projects; policy v2.voice_admission_policies;
  scope_types text[]; scope_ids text[]; scope_index integer;
  active_count bigint; hour_count bigint; day_count bigint; liability numeric;
  checked_at timestamptz; project_owner text;
begin
  -- Read only to determine lock keys. Identity is immutable and checked again below.
  select * into initial_t from v2.voice_tenants where id=p->>'tenantId';
  if not found then raise exception 'voice_admission_denied'; end if;
  scope_types:=array['platform']; scope_ids:=array['platform'];
  if initial_t.customer_id is not null then
    scope_types:=scope_types || array['customer','project'];
    scope_ids:=scope_ids || array[initial_t.customer_id,initial_t.project_id];
  end if;
  -- Every admission, including legacy/internal tenants, takes the global lock first.
  -- Separate SQL statements after the lock see admissions committed by earlier callers.
  for scope_index in 1..array_length(scope_types,1) loop
    select * into policy from v2.voice_admission_policies
      where scope_type=scope_types[scope_index] and scope_id=scope_ids[scope_index] for update;
    if not found or not policy.enabled then raise exception 'voice_policy_denied:%',scope_types[scope_index]; end if;
  end loop;
  select * into t from v2.voice_tenants where id=initial_t.id for update;
  if not found or not t.enabled then raise exception 'voice_admission_denied'; end if;
  if (t.customer_id,t.project_id,t.internal_demo_id,t.purpose)
    is distinct from (initial_t.customer_id,initial_t.project_id,initial_t.internal_demo_id,initial_t.purpose) then
    raise exception 'voice_identity_invalid';
  end if;
  if t.customer_id is not null then
    select * into registry from v2.voice_projects where project_id=t.project_id for share;
    if not found or not registry.enabled or registry.customer_id<>t.customer_id or t.purpose is null
      or (case t.purpose when 'public' then registry.public_tenant_id
        when 'benchmark' then registry.benchmark_tenant_id when 'internal' then registry.internal_tenant_id end)
        is distinct from t.id then raise exception 'voice_identity_invalid'; end if;
    select customer_id into project_owner from v2.projects where id=t.project_id for share;
    if not found or project_owner is distinct from t.customer_id then raise exception 'voice_identity_invalid'; end if;
  end if;
  checked_at:=clock_timestamp();
  for scope_index in 1..array_length(scope_types,1) loop
    select * into policy from v2.voice_admission_policies
      where scope_type=scope_types[scope_index] and scope_id=scope_ids[scope_index];
    select count(*) filter(where state <> 'closed'),
      count(*) filter(where created_at > checked_at-interval '1 hour'),
      count(*) filter(where created_at > checked_at-interval '24 hours'),
      coalesce(sum(case when accounting_status <> 'complete' then greatest(reservation_usd,known_cost_usd)
        when created_at > checked_at-interval '24 hours' then known_cost_usd else 0 end),0)
      into active_count,hour_count,day_count,liability from v2.voice_sessions
      where (scope_types[scope_index]='platform'
        or (scope_types[scope_index]='customer' and customer_id=t.customer_id)
        or (scope_types[scope_index]='project' and project_id=t.project_id))
      and (created_at > checked_at-interval '24 hours' or accounting_status <> 'complete' or state <> 'closed');
    if active_count >= policy.max_concurrent or hour_count >= policy.max_per_hour or day_count >= policy.max_per_day
      or liability+t.reservation_usd > policy.daily_budget_usd then
      raise exception 'voice_admission_limit:%',scope_types[scope_index];
    end if;
  end loop;
  select count(*) filter(where state <> 'closed'),
    count(*) filter(where created_at > checked_at-interval '1 hour'),
    count(*) filter(where created_at > checked_at-interval '24 hours'),
    coalesce(sum(case when accounting_status <> 'complete' then greatest(reservation_usd,known_cost_usd)
      when created_at > checked_at-interval '24 hours' then known_cost_usd else 0 end),0)
    into active_count,hour_count,day_count,liability from v2.voice_sessions where tenant_id=t.id
    and (created_at > checked_at-interval '24 hours' or accounting_status <> 'complete' or state <> 'closed');
  if active_count >= t.max_concurrent or hour_count >= t.max_per_hour or day_count >= t.max_per_day
    or liability+t.reservation_usd > t.daily_budget_usd then raise exception 'voice_admission_limit:tenant'; end if;
  if length(p->>'configVersion') not between 1 and 100 or length(p->>'datasetVersion') not between 1 and 100
    or coalesce(p->>'configVersion','')='' or coalesce(p->>'datasetVersion','')=''
    or coalesce(p->'rateSnapshot'->>'version','') <> 'openai-2026-09-16-v1'
    or coalesce(p->'models'->>'voice','') <> 'gpt-live-1'
    or coalesce(p->'models'->>'backend','') <> 'gpt-5.6-terra'
    or coalesce(p->'models'->>'speaker','') <> 'willow'
    or length(coalesce(p->>'testRunId','')) > 100 or length(coalesce(p->>'scenarioId','')) > 100 then
    raise exception 'voice_invalid_metadata';
  end if;
  insert into v2.voice_sessions(tenant_id,internal_demo_id,customer_id,project_id,purpose,owner_token,lease_expires_at,deadline_at,
    environment,config_version,dataset_version,models,rate_snapshot,test_run_id,scenario_id,reservation_usd)
  values(t.id,t.internal_demo_id,t.customer_id,t.project_id,coalesce(t.purpose,'internal'),(p->>'ownerToken')::uuid,
    checked_at+interval '60 seconds',checked_at+make_interval(secs=>t.max_duration_seconds),
    p->>'environment',p->>'configVersion',p->>'datasetVersion',
    jsonb_build_object('voice','gpt-live-1','backend','gpt-5.6-terra','speaker','willow'),
    '{"version":"openai-2026-09-16-v1","voiceUsdPerMinute":0.05,"backendUsdPerMillion":{"gpt-5.6-terra":[2,0.2,12],"gpt-5.6-luna":[0.2,0.02,1.2],"gpt-5.6-sol":[4,0.4,20]},"terraMaxVerifiedInputTokens":272000}'::jsonb,
    p->>'testRunId',p->>'scenarioId',t.reservation_usd) returning * into s;
  return to_jsonb(s);
end $$;

-- Abort on missing or unexpected ownership. Never create/reparent customer data.
do $$ begin
  if not exists(select 1 from v2.projects where id='nyhavna-utvikling_nyhavna' and customer_id='nyhavna-utvikling') then
    raise exception 'voice_seed_owner_mismatch';
  end if;
end $$;
insert into v2.voice_tenants(id,customer_id,project_id,purpose,enabled,max_concurrent,max_per_hour,max_per_day,
  daily_budget_usd,reservation_usd,max_duration_seconds) values
  ('nyhavna-public','nyhavna-utvikling','nyhavna-utvikling_nyhavna','public',true,5,60,200,100,5,1650),
  ('nyhavna-benchmark','nyhavna-utvikling','nyhavna-utvikling_nyhavna','benchmark',true,3,60,100,50,5,1650)
  on conflict(id) do nothing;
insert into v2.voice_projects(slug,customer_id,project_id,content_source,enabled,public_tenant_id,benchmark_tenant_id)
  values ('nyhavna','nyhavna-utvikling','nyhavna-utvikling_nyhavna','nyhavna-lokal',true,'nyhavna-public','nyhavna-benchmark')
  on conflict do nothing;
-- Existing edited limits/enabled states are intentionally retained on replay.
-- $200 global includes the $150 combined project allowance plus old incomplete
-- liabilities and operating headroom. This is not a sales entitlement.
insert into v2.voice_admission_policies(scope_type,scope_id,enabled,max_concurrent,max_per_hour,max_per_day,daily_budget_usd)
  values ('platform','platform',true,8,120,300,200),
    ('customer','nyhavna-utvikling',true,8,120,300,150),
    ('project','nyhavna-utvikling_nyhavna',true,8,120,300,150)
  on conflict(scope_type,scope_id) do nothing;
do $$ begin
  if not exists(select 1 from v2.voice_projects where slug='nyhavna' and customer_id='nyhavna-utvikling'
      and project_id='nyhavna-utvikling_nyhavna' and content_source='nyhavna-lokal'
      and public_tenant_id='nyhavna-public' and benchmark_tenant_id='nyhavna-benchmark')
    or (select count(*) from v2.voice_tenants where customer_id='nyhavna-utvikling'
      and project_id='nyhavna-utvikling_nyhavna' and internal_demo_id is null
      and ((id='nyhavna-public' and purpose='public') or (id='nyhavna-benchmark' and purpose='benchmark'))) <> 2 then
    raise exception 'voice_seed_binding_mismatch';
  end if;
end $$;

alter table v2.voice_projects enable row level security;
alter table v2.voice_admission_policies enable row level security;
revoke all on v2.voice_projects,v2.voice_admission_policies from public,anon,authenticated;
grant select,insert,update,delete on v2.voice_projects,v2.voice_admission_policies to service_role;
revoke all on function v2.voice_identity_immutable(),v2.voice_reserve(jsonb) from public,anon,authenticated;
grant execute on function v2.voice_reserve(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
