-- 098: Døgnkvoter for kundedemoer med tekstchat og stemme (2026-09-23).
--
-- Leangenbukta-kundedemoen teller chatmeldinger og stemmesesjoner per besøkende
-- og samlet per døgn (lib/demo/leangenbukta-site/usage.ts). Tabellen lagrer
-- bare meter, besøks-ID fra den signerte demo-cookien, døgn og antall — ingen
-- meldingstekst, ingen IP.
--
-- Kjøres IKKE automatisk. Delbar demo krever at Andreas godkjenner denne
-- migrasjonen mot produksjonsdatabasen og setter PLACY_LB_DEMO_USAGE_STORE=supabase.

create table if not exists v2.demo_usage_counters (
  meter text not null check (meter in ('chat_message', 'voice_session')),
  day date not null,
  scope text not null check (scope ~ '^(global|v:[0-9a-f-]{36}|v:local)$'),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (meter, day, scope)
);

alter table v2.demo_usage_counters enable row level security;
-- Ingen policy: bare service-role (som omgår RLS) og funksjonen under når tabellen.
revoke all on v2.demo_usage_counters from anon, authenticated;

create or replace function v2.demo_usage_consume(
  p_meter text, p_visitor text, p_day date, p_visitor_limit integer, p_global_limit integer
) returns text
language plpgsql security definer set search_path = '' set statement_timeout = '3s' set lock_timeout = '1s' as $$
declare
  visitor_scope text := 'v:' || p_visitor;
  visitor_count integer;
  global_count integer;
begin
  if p_meter not in ('chat_message', 'voice_session') then raise exception 'demo_usage_invalid_meter'; end if;
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
