-- Service-only accounting. No transcript, SDP, access secret or provider response body.
begin;
create table v2.voice_tenants (
  id text primary key check (id ~ '^[a-z0-9_-]{1,80}$'),
  internal_demo_id text unique,
  customer_id text references v2.customers(id),
  project_id text references v2.projects(id),
  enabled boolean not null default false,
  max_concurrent integer not null default 2 check (max_concurrent between 1 and 20),
  max_per_hour integer not null default 10 check (max_per_hour between 1 and 1000),
  max_per_day integer not null default 30 check (max_per_day between 1 and 10000),
  daily_budget_usd numeric(16,8) not null check (daily_budget_usd > 0 and daily_budget_usd < 10000),
  reservation_usd numeric(16,8) not null check (reservation_usd > 0 and reservation_usd <= daily_budget_usd),
  max_duration_seconds integer not null default 1500 check (max_duration_seconds between 30 and 1650),
  check ((internal_demo_id is not null and customer_id is null and project_id is null)
    or (internal_demo_id is null and customer_id is not null and project_id is not null)),
  check (internal_demo_id is null or internal_demo_id ~ '^[a-z0-9_-]{1,80}$')
);
create table v2.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references v2.voice_tenants(id),
  internal_demo_id text,
  customer_id text,
  project_id text,
  owner_token uuid not null,
  state text not null default 'reserved' check (state in ('reserved','creating','active','recovering','closed','unresolved')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  lease_expires_at timestamptz not null,
  deadline_at timestamptz not null,
  provider_session_id text unique,
  environment text not null check (environment in ('development','preview','production','test')),
  config_version text not null,
  dataset_version text not null,
  models jsonb not null,
  rate_snapshot jsonb not null,
  test_run_id text,
  scenario_id text,
  reservation_usd numeric(16,8) not null,
  voice_seconds numeric,
  backend_cost_usd numeric not null default 0,
  known_cost_usd numeric not null default 0,
  invalid_usage boolean not null default false,
  provider_closed boolean not null default false,
  final_usage_confirmed boolean not null default false,
  accounting_status text not null default 'provisional' check (accounting_status in ('provisional','complete','incomplete')),
  termination_reason text,
  ended_at timestamptz,
  recovery_attempts integer not null default 0
);
create index voice_sessions_admission on v2.voice_sessions(tenant_id,created_at);
create index voice_sessions_liability on v2.voice_sessions(tenant_id) where accounting_status <> 'complete';
create index voice_sessions_recovery on v2.voice_sessions(lease_expires_at) where state <> 'closed';
create table v2.voice_usage_events (
  session_id uuid not null references v2.voice_sessions(id),
  response_id text not null check (length(response_id) between 1 and 200),
  model text not null check (length(model) between 1 and 100),
  input_tokens bigint,
  cached_tokens bigint,
  output_tokens bigint,
  cost_usd numeric,
  evidence_status text not null check (evidence_status in ('valid','invalid','unknown_rate')),
  received_at timestamptz not null default clock_timestamp(),
  primary key(session_id,response_id),
  check ((input_tokens is null and cached_tokens is null and output_tokens is null)
    or (input_tokens >= 0 and cached_tokens >= 0 and cached_tokens <= input_tokens and output_tokens >= 0))
);

create function v2.voice_reserve(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' set lock_timeout = '2s' as $$
declare t v2.voice_tenants; s v2.voice_sessions; active_count bigint; hour_count bigint; day_count bigint; liability numeric;
begin
  select * into t from v2.voice_tenants where id = p->>'tenantId' for update;
  if not found or not t.enabled then raise exception 'voice_admission_denied'; end if;
  if t.customer_id is not null and not exists(select 1 from v2.projects where id=t.project_id and customer_id=t.customer_id) then
    raise exception 'voice_identity_invalid';
  end if;
  select count(*) filter(where state <> 'closed'),
    count(*) filter(where created_at > clock_timestamp()-interval '1 hour'),
    count(*) filter(where created_at > clock_timestamp()-interval '24 hours'),
    coalesce(sum(case when accounting_status <> 'complete' then greatest(reservation_usd,known_cost_usd)
      when created_at > clock_timestamp()-interval '24 hours' then known_cost_usd else 0 end),0)
    into active_count,hour_count,day_count,liability from v2.voice_sessions where tenant_id=t.id
    and (created_at > clock_timestamp()-interval '24 hours' or accounting_status <> 'complete' or state <> 'closed');
  if active_count >= t.max_concurrent or hour_count >= t.max_per_hour or day_count >= t.max_per_day
    or liability+t.reservation_usd > t.daily_budget_usd then raise exception 'voice_admission_limit'; end if;
  if length(p->>'configVersion') not between 1 and 100 or length(p->>'datasetVersion') not between 1 and 100
    or coalesce(p->>'configVersion','')='' or coalesce(p->>'datasetVersion','')=''
    or coalesce(p->'rateSnapshot'->>'version','') <> 'openai-2026-09-16-v1'
    or coalesce(p->'models'->>'voice','') <> 'gpt-live-1'
    or coalesce(p->'models'->>'backend','') <> 'gpt-5.6-terra'
    or coalesce(p->'models'->>'speaker','') <> 'willow'
    or length(coalesce(p->>'testRunId','')) > 100 or length(coalesce(p->>'scenarioId','')) > 100 then
    raise exception 'voice_invalid_metadata';
  end if;
  insert into v2.voice_sessions(tenant_id,internal_demo_id,customer_id,project_id,owner_token,lease_expires_at,deadline_at,
    environment,config_version,dataset_version,models,rate_snapshot,test_run_id,scenario_id,reservation_usd)
  values(t.id,t.internal_demo_id,t.customer_id,t.project_id,(p->>'ownerToken')::uuid,clock_timestamp()+interval '60 seconds',
    clock_timestamp()+make_interval(secs=>t.max_duration_seconds),p->>'environment',p->>'configVersion',p->>'datasetVersion',
    jsonb_build_object('voice','gpt-live-1','backend','gpt-5.6-terra','speaker','willow'),
    '{"version":"openai-2026-09-16-v1","voiceUsdPerMinute":0.05,"backendUsdPerMillion":{"gpt-5.6-terra":[2,0.2,12],"gpt-5.6-luna":[0.2,0.02,1.2],"gpt-5.6-sol":[4,0.4,20]},"terraMaxVerifiedInputTokens":272000}'::jsonb,
    p->>'testRunId',p->>'scenarioId',t.reservation_usd) returning * into s;
  return to_jsonb(s);
end $$;

-- All mutations lock a single session. Owner tokens are server-generated capabilities,
-- never browser credentials. A recovery claim replaces the token and fences old owners.
create function v2.voice_mutate(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' set lock_timeout = '2s' as $$
declare s v2.voice_sessions; action text := p->>'action'; seconds numeric; inserted integer;
  i bigint; c bigint; o bigint; cost numeric; evidence text; model text; base_model text; rates jsonb;
begin
  select * into s from v2.voice_sessions where id=(p->>'sessionId')::uuid for update;
  if not found or s.owner_token <> (p->>'ownerToken')::uuid or p->>'ownerToken' is null then raise exception 'voice_owner_denied'; end if;
  if s.state <> 'closed' and s.lease_expires_at < clock_timestamp() then raise exception 'voice_lease_expired'; end if;
  if action='creating' then
    if s.state <> 'reserved' then raise exception 'voice_invalid_state'; end if;
    s.state := 'creating';
  elsif action='bind' then
    if s.state not in ('creating','active') or coalesce(length(p->>'providerSessionId'),0) not between 1 and 200
      or (s.provider_session_id is not null and s.provider_session_id <> p->>'providerSessionId') then raise exception 'voice_invalid_binding'; end if;
    s.provider_session_id:=p->>'providerSessionId'; s.state:='active';
  elsif action='heartbeat' then
    if s.state in ('closed','unresolved') or s.deadline_at <= clock_timestamp() then raise exception 'voice_invalid_state'; end if;
    s.lease_expires_at:=least(clock_timestamp()+interval '60 seconds',s.deadline_at);
  elsif action='voice' then
    if s.state='reserved' then raise exception 'voice_invalid_state'; end if;
    if jsonb_typeof(p->'seconds') is distinct from 'number' then raise exception 'voice_invalid_seconds'; end if;
    seconds:=(p->>'seconds')::numeric;
    if seconds < 0 or seconds > 86400 then raise exception 'voice_invalid_seconds'; end if;
    s.voice_seconds:=greatest(s.voice_seconds,seconds);
  elsif action='event' then
    if s.state='reserved' then raise exception 'voice_invalid_state'; end if;
    model:=p->>'model'; evidence:=p->>'evidenceStatus';
    if evidence not in ('valid','invalid') or evidence is null then raise exception 'voice_invalid_evidence'; end if;
    if evidence='valid' then
      if jsonb_typeof(p->'inputTokens') is distinct from 'number' or jsonb_typeof(p->'cachedTokens') is distinct from 'number'
        or jsonb_typeof(p->'outputTokens') is distinct from 'number' then raise exception 'voice_invalid_tokens'; end if;
      if (p->>'inputTokens')::numeric <> trunc((p->>'inputTokens')::numeric)
        or (p->>'cachedTokens')::numeric <> trunc((p->>'cachedTokens')::numeric)
        or (p->>'outputTokens')::numeric <> trunc((p->>'outputTokens')::numeric) then raise exception 'voice_invalid_tokens'; end if;
      i:=(p->>'inputTokens')::bigint; c:=(p->>'cachedTokens')::bigint; o:=(p->>'outputTokens')::bigint;
      if i < 0 or c < 0 or c > i or o < 0 or greatest(i,c,o)>9007199254740991 then raise exception 'voice_invalid_tokens'; end if;
      -- The caller has validated exact dated snapshots; SQL independently rejects suffix lookalikes.
      base_model:=substring(model from '^(gpt-5[.]6-(terra|luna|sol))($|-[0-9]{4}-[0-9]{2}-[0-9]{2}$)');
      rates:=s.rate_snapshot->'backendUsdPerMillion'->base_model;
      if rates is null or (base_model='gpt-5.6-terra' and i>272000) or coalesce((p->>'knownRate')::boolean,false)=false then
        evidence:='unknown_rate';
      else cost:=((i-c)*(rates->>0)::numeric+c*(rates->>1)::numeric+o*(rates->>2)::numeric)/1000000; end if;
    end if;
    insert into v2.voice_usage_events(session_id,response_id,model,input_tokens,cached_tokens,output_tokens,cost_usd,evidence_status)
      values(s.id,p->>'responseId',model,i,c,o,cost,evidence) on conflict(session_id,response_id) do nothing;
    get diagnostics inserted = row_count;
    if inserted=1 then
      s.backend_cost_usd:=s.backend_cost_usd+coalesce(cost,0);
      s.invalid_usage:=s.invalid_usage or evidence <> 'valid';
    end if;
  elsif action='finalize' then
    if coalesce(length(p->>'terminationReason'),0) not between 1 and 80 or (p->>'terminationReason') !~ '^[a-z0-9_:-]+$' then raise exception 'voice_invalid_reason'; end if;
    s.provider_closed:=s.provider_closed or coalesce((p->>'providerClosed')::boolean,false);
    s.final_usage_confirmed:=s.final_usage_confirmed or coalesce((p->>'finalUsageConfirmed')::boolean,false);
    -- Trusted owner asserts no paid request was attempted, even if creating was checkpointed.
    if coalesce((p->>'neverCreated')::boolean,false) or coalesce((p->>'creationRejected')::boolean,false) then
      if s.provider_session_id is not null or not ((s.state in ('reserved','creating') and coalesce((p->>'neverCreated')::boolean,false))
        or (s.state = 'creating' and coalesce((p->>'creationRejected')::boolean,false))) then raise exception 'voice_invalid_no_create'; end if;
      s.provider_closed:=true; s.final_usage_confirmed:=true; s.voice_seconds:=0;
    end if;
    s.state:=case when s.provider_closed then 'closed' else 'unresolved' end;
    s.termination_reason:=p->>'terminationReason'; s.ended_at:=coalesce(s.ended_at,clock_timestamp());
    s.lease_expires_at:=clock_timestamp()+interval '5 minutes';
  else raise exception 'voice_invalid_action'; end if;
  s.known_cost_usd:=s.backend_cost_usd+coalesce(s.voice_seconds,0)/60*(s.rate_snapshot->>'voiceUsdPerMinute')::numeric;
  s.accounting_status:=case when s.provider_closed and s.final_usage_confirmed and s.voice_seconds is not null and not s.invalid_usage then 'complete'
    when s.state in ('closed','unresolved') or s.invalid_usage then 'incomplete' else 'provisional' end;
  update v2.voice_sessions set state=s.state,lease_expires_at=s.lease_expires_at,provider_session_id=s.provider_session_id,
    updated_at=clock_timestamp(),voice_seconds=s.voice_seconds,backend_cost_usd=s.backend_cost_usd,known_cost_usd=s.known_cost_usd,
    invalid_usage=s.invalid_usage,provider_closed=s.provider_closed,final_usage_confirmed=s.final_usage_confirmed,
    accounting_status=s.accounting_status,termination_reason=s.termination_reason,ended_at=s.ended_at where id=s.id;
  return to_jsonb(s);
end $$;

create function v2.voice_claim_recoveries(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' set lock_timeout = '2s' as $$
declare result jsonb;
begin
  if coalesce((p->>'limit')::integer,10) not between 1 and 50 or p->>'ownerToken' is null then raise exception 'voice_invalid_claim'; end if;
  -- An expired reservation never crossed markCreating, so no paid request was allowed.
  -- Lock/skip-locked makes this race safely with the owner checkpoint and other reapers.
  with untouched as (
    select id from v2.voice_sessions where state='reserved' and provider_session_id is null
      and lease_expires_at < clock_timestamp() order by lease_expires_at
      for update skip locked limit coalesce((p->>'limit')::integer,10)
  ) update v2.voice_sessions s set state='closed',provider_closed=true,final_usage_confirmed=true,
    voice_seconds=0,backend_cost_usd=0,known_cost_usd=0,accounting_status='complete',
    termination_reason='expired_before_create',ended_at=clock_timestamp(),updated_at=clock_timestamp(),
    owner_token=(p->>'ownerToken')::uuid
    from untouched u where s.id=u.id;
  with candidates as (
    select id from v2.voice_sessions where state not in ('closed','reserved') and lease_expires_at < clock_timestamp()
      order by lease_expires_at for update skip locked limit coalesce((p->>'limit')::integer,10)
  ), claimed as (
    update v2.voice_sessions s set state='recovering',owner_token=(p->>'ownerToken')::uuid,
      lease_expires_at=clock_timestamp()+interval '60 seconds',updated_at=clock_timestamp(),recovery_attempts=recovery_attempts+1,
      accounting_status='incomplete' from candidates c where s.id=c.id returning s.*
  ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into result from claimed;
  return result;
end $$;

alter table v2.voice_tenants enable row level security;
alter table v2.voice_sessions enable row level security;
alter table v2.voice_usage_events enable row level security;
revoke all on v2.voice_tenants,v2.voice_sessions,v2.voice_usage_events from public,anon,authenticated;
grant usage on schema v2 to service_role;
grant select,insert,update,delete on v2.voice_tenants,v2.voice_sessions,v2.voice_usage_events to service_role;
revoke all on function v2.voice_reserve(jsonb),v2.voice_mutate(jsonb),v2.voice_claim_recoveries(jsonb) from public,anon,authenticated;
grant execute on function v2.voice_reserve(jsonb),v2.voice_mutate(jsonb),v2.voice_claim_recoveries(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
