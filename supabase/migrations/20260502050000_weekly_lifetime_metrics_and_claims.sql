-- Weekly + lifetime metrics + claim tables for the Weekly and Goals
-- tabs in the challenges modal.
--
-- Metric scoping convention:
--   daily      → "<metric>:YYYY-MM-DD"  (existing)
--   weekly     → "<metric>:YYYY-Www"    (ISO week, new)
--   lifetime   → "<metric>:lifetime"     (new)
--
-- The new bump_metric_all RPC fans one event into all three keys
-- atomically so client recordEvent calls only need one round trip.
-- The existing bump_metric stays for direct date-scoped writes
-- (the challenges UI optimistic-bump path still uses it).

create or replace function public.bump_metric_all(p_metric text, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  v_week  text := to_char(now() at time zone 'UTC', 'IYYY-"W"IW');
  v_daily_key    text := p_metric || ':' || v_today;
  v_weekly_key   text := p_metric || ':' || v_week;
  v_lifetime_key text := p_metric || ':lifetime';
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_amount = 0 then
    return;
  end if;

  insert into public.user_metrics (user_id, metrics, updated_at)
  values (
    v_user,
    jsonb_build_object(
      v_daily_key,    p_amount,
      v_weekly_key,   p_amount,
      v_lifetime_key, p_amount
    ),
    now()
  )
  on conflict (user_id) do update
  set metrics = public.user_metrics.metrics
        || jsonb_build_object(v_daily_key,    coalesce((public.user_metrics.metrics ->> v_daily_key)::int, 0)    + p_amount)
        || jsonb_build_object(v_weekly_key,   coalesce((public.user_metrics.metrics ->> v_weekly_key)::int, 0)   + p_amount)
        || jsonb_build_object(v_lifetime_key, coalesce((public.user_metrics.metrics ->> v_lifetime_key)::int, 0) + p_amount),
      updated_at = now();
end;
$$;

grant execute on function public.bump_metric_all(text, integer) to authenticated;

-- Weekly claim ledger. One row per (user, ISO week, template_key)
-- prevents double-claim within the same week. iso_week is stored as
-- "YYYY-Www" text for cheap key reuse with the metric scope.
create table if not exists public.user_weekly_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  iso_week text not null,
  template_key text not null,
  riffs_awarded integer not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, iso_week, template_key)
);
alter table public.user_weekly_claims enable row level security;
create policy "user_weekly_claims: self read"
  on public.user_weekly_claims for select
  using (auth.uid() = user_id);

-- Achievement claim ledger. One row per (user, template_key) ever —
-- achievements are lifetime / one-shot. No iso_week / for_date.
create table if not exists public.user_achievement_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_key text not null,
  riffs_awarded integer not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, template_key)
);
alter table public.user_achievement_claims enable row level security;
create policy "user_achievement_claims: self read"
  on public.user_achievement_claims for select
  using (auth.uid() = user_id);

-- Claim a weekly challenge. Mirrors claim_daily_challenge but the
-- claim ledger row keys on iso_week instead of for_date.
create or replace function public.claim_weekly_challenge(
  p_template_key text,
  p_metric_key text,
  p_target integer,
  p_riffs integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_week text := to_char(now() at time zone 'UTC', 'IYYY-"W"IW');
  v_metric integer;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_riffs < 0 or p_riffs > 5000 then
    raise exception 'Invalid reward';
  end if;

  perform 1 from public.user_weekly_claims
    where user_id = v_user and iso_week = v_week and template_key = p_template_key;
  if found then
    return json_build_object('ok', false, 'reason', 'already_claimed');
  end if;

  select coalesce((metrics ->> p_metric_key)::integer, 0) into v_metric
    from public.user_metrics where user_id = v_user;
  v_metric := coalesce(v_metric, 0);
  if v_metric < p_target then
    return json_build_object('ok', false, 'reason', 'below_target', 'current', v_metric, 'target', p_target);
  end if;

  perform 1 from public.profiles where id = v_user for update;
  update public.profiles set coin_balance = coin_balance + p_riffs
    where id = v_user
    returning coin_balance into v_balance;
  insert into public.coin_transactions (user_id, delta, reason)
    values (v_user, p_riffs, 'weekly:' || p_template_key);

  insert into public.user_weekly_claims (user_id, iso_week, template_key, riffs_awarded)
    values (v_user, v_week, p_template_key, p_riffs);

  return json_build_object('ok', true, 'riffs', p_riffs, 'new_balance', v_balance);
end;
$$;

create or replace function public.claim_achievement(
  p_template_key text,
  p_metric_key text,
  p_target integer,
  p_riffs integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_metric integer;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_riffs < 0 or p_riffs > 10000 then
    raise exception 'Invalid reward';
  end if;

  perform 1 from public.user_achievement_claims
    where user_id = v_user and template_key = p_template_key;
  if found then
    return json_build_object('ok', false, 'reason', 'already_claimed');
  end if;

  select coalesce((metrics ->> p_metric_key)::integer, 0) into v_metric
    from public.user_metrics where user_id = v_user;
  v_metric := coalesce(v_metric, 0);
  if v_metric < p_target then
    return json_build_object('ok', false, 'reason', 'below_target', 'current', v_metric, 'target', p_target);
  end if;

  perform 1 from public.profiles where id = v_user for update;
  update public.profiles set coin_balance = coin_balance + p_riffs
    where id = v_user
    returning coin_balance into v_balance;
  insert into public.coin_transactions (user_id, delta, reason)
    values (v_user, p_riffs, 'achievement:' || p_template_key);

  insert into public.user_achievement_claims (user_id, template_key, riffs_awarded)
    values (v_user, p_template_key, p_riffs);

  return json_build_object('ok', true, 'riffs', p_riffs, 'new_balance', v_balance);
end;
$$;

grant execute on function public.claim_weekly_challenge(text, text, integer, integer) to authenticated;
grant execute on function public.claim_achievement(text, text, integer, integer) to authenticated;

create or replace function public.get_this_week_claims()
returns text[]
language sql
stable security definer
set search_path = public
as $$
  select coalesce(array_agg(template_key), array[]::text[])
  from public.user_weekly_claims
  where user_id = auth.uid()
    and iso_week = to_char(now() at time zone 'UTC', 'IYYY-"W"IW');
$$;

create or replace function public.get_achievement_claims()
returns text[]
language sql
stable security definer
set search_path = public
as $$
  select coalesce(array_agg(template_key), array[]::text[])
  from public.user_achievement_claims
  where user_id = auth.uid();
$$;

grant execute on function public.get_this_week_claims() to authenticated;
grant execute on function public.get_achievement_claims() to authenticated;
