-- 099: Egne døgnkvoter for Nyhavna-kopiens chat og stemme (2026-09-24).
--
-- Nyhavna-nettsidekopien (/demo/nyhavna-nettside) har fått samme chatboks som
-- Leangenbukta. Den teller i sine egne målere, slik at én demo aldri kan bruke
-- opp en annens kvote (lib/demo/leangenbukta-site/usage.ts). Samme tabell og
-- funksjon som 098; bare listen over godkjente målere utvides.
--
-- Forutsetter 098. Kjøres IKKE automatisk: delt Nyhavna-chat krever at Andreas
-- godkjenner 098 og 099 mot produksjonsdatabasen og setter
-- PLACY_NH_CHAT_USAGE_STORE=supabase.

alter table v2.demo_usage_counters drop constraint if exists demo_usage_counters_meter_check;
alter table v2.demo_usage_counters add constraint demo_usage_counters_meter_check
  check (meter in ('chat_message', 'voice_session', 'nh_chat_message', 'nh_voice_session'));

create or replace function v2.demo_usage_consume(
  p_meter text, p_visitor text, p_day date, p_visitor_limit integer, p_global_limit integer
) returns text
language plpgsql security definer set search_path = '' set statement_timeout = '3s' set lock_timeout = '1s' as $$
declare
  visitor_scope text := 'v:' || p_visitor;
  visitor_count integer;
  global_count integer;
begin
  if p_meter not in ('chat_message', 'voice_session', 'nh_chat_message', 'nh_voice_session') then raise exception 'demo_usage_invalid_meter'; end if;
  if p_visitor !~ '^([0-9a-f-]{36}|local)$' then raise exception 'demo_usage_invalid_visitor'; end if;
  if p_visitor_limit < 0 or p_global_limit < 0 then raise exception 'demo_usage_invalid_limit'; end if;

  -- Global rad først, alltid i samme rekkefølge, slik at samtidige kall ikke
  -- låser hverandre fast.
  insert into v2.demo_usage_counters (meter, day, scope) values (p_meter, p_day, 'global')
    on conflict do nothing;
  insert into v2.demo_usage_counters (meter, day, scope) values (p_meter, p_day, visitor_scope)
    on conflict do nothing;
  select count into global_count from v2.demo_usage_counters
    where meter = p_meter and day = p_day and scope = 'global' for update;
  select count into visitor_count from v2.demo_usage_counters
    where meter = p_meter and day = p_day and scope = visitor_scope for update;

  if visitor_count >= p_visitor_limit then return 'visitor'; end if;
  if global_count >= p_global_limit then return 'global'; end if;

  update v2.demo_usage_counters set count = count + 1, updated_at = now()
    where meter = p_meter and day = p_day and scope in ('global', visitor_scope);
  return 'ok';
end;
$$;

revoke all on function v2.demo_usage_consume(text, text, date, integer, integer) from public, anon, authenticated;
grant execute on function v2.demo_usage_consume(text, text, date, integer, integer) to service_role;
