-- Allow the current owner to drain final usage after the media deadline.
-- The controller still stops at deadline_at; recovery waits at most 30 seconds.
begin;
create or replace function v2.voice_mutate(p jsonb) returns jsonb
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
    s.lease_expires_at:=least(clock_timestamp()+interval '60 seconds',s.deadline_at+interval '30 seconds');
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

notify pgrst, 'reload schema';
commit;
