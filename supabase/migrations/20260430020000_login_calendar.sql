-- 7-day login calendar. Escalating Riffs rewards day 1→7, day 7 chunky.
-- Resets to day 1 if the user misses a day. Once-per-day claim.

alter table public.profiles
  add column if not exists login_day_index integer not null default 0,
  add column if not exists login_last_claimed_on date,
  add column if not exists login_cycle_completed_count integer not null default 0;

create or replace function public.login_reward_for_day(p_day integer)
returns integer
language sql
immutable
as $$
  select case p_day
    when 1 then 5
    when 2 then 8
    when 3 then 12
    when 4 then 15
    when 5 then 20
    when 6 then 30
    when 7 then 75
    else 0
  end;
$$;

grant execute on function public.login_reward_for_day(integer) to authenticated, anon;

create or replace function public.claim_login_reward()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_profile record;
  v_today date := (now() at time zone 'UTC')::date;
  v_next_day integer;
  v_award integer;
  v_new_balance integer;
  v_cycle_completed integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = v_user for update;
  select id, coin_balance, login_day_index, login_last_claimed_on, login_cycle_completed_count
    into v_profile
    from public.profiles
    where id = v_user;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_profile.login_last_claimed_on = v_today then
    return json_build_object(
      'ok', false,
      'reason', 'already_claimed',
      'day_index', v_profile.login_day_index,
      'next_day', case when v_profile.login_day_index >= 7 then 1 else v_profile.login_day_index + 1 end,
      'next_award', public.login_reward_for_day(case when v_profile.login_day_index >= 7 then 1 else v_profile.login_day_index + 1 end)
    );
  end if;

  if v_profile.login_last_claimed_on is null
     or v_profile.login_last_claimed_on < v_today - interval '1 day'
     or v_profile.login_day_index >= 7
  then
    v_next_day := 1;
  else
    v_next_day := v_profile.login_day_index + 1;
  end if;

  v_award := public.login_reward_for_day(v_next_day);
  v_cycle_completed := v_profile.login_cycle_completed_count + case when v_next_day = 7 then 1 else 0 end;

  update public.profiles
     set coin_balance = coin_balance + v_award,
         login_day_index = v_next_day,
         login_last_claimed_on = v_today,
         login_cycle_completed_count = v_cycle_completed
   where id = v_user
   returning coin_balance into v_new_balance;

  insert into public.coin_transactions (user_id, delta, reason)
  values (v_user, v_award, 'login_calendar:day' || v_next_day::text);

  return json_build_object(
    'ok', true,
    'day_index', v_next_day,
    'awarded', v_award,
    'new_balance', v_new_balance,
    'next_day', case when v_next_day >= 7 then 1 else v_next_day + 1 end,
    'next_award', public.login_reward_for_day(case when v_next_day >= 7 then 1 else v_next_day + 1 end)
  );
end;
$$;

revoke all on function public.claim_login_reward() from public;
grant execute on function public.claim_login_reward() to authenticated;
