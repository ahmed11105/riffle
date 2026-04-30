-- Streak freezes: bridge a 1-day gap so a missed day doesn't reset the
-- streak. Free users get the bootstrap 1 freeze (already in init_schema).
-- Pro users get an auto-granted freeze every 7 days (cap 2). Anyone can
-- buy a freeze with Riffs (cap 2).
--
-- Freeze consumption happens inside record_daily_result: if the user
-- solved today, last_play_date was 2 days ago (i.e. they missed exactly
-- yesterday), and they have a freeze available, we burn one freeze and
-- treat the gap as if they played yesterday — so the streak increments
-- from its previous value instead of resetting to 1.
--
-- Larger gaps (>1 day missed) still reset the streak. Spending 2 freezes
-- to bridge 2 missed days is intentionally not supported — keeps the
-- mechanic simple and avoids a runaway "buy your way out of any lapse"
-- pattern that regulators flag as predatory.

alter table public.streaks
  add column if not exists last_freeze_grant_at timestamptz;

-- Cap freezes_available at 2 via a check constraint (existing rows already
-- conform: default is 1, no path bumps above 2).
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'streaks'
      and constraint_name = 'streaks_freezes_cap'
  ) then
    alter table public.streaks
      add constraint streaks_freezes_cap check (freezes_available between 0 and 2);
  end if;
end $$;

-- Replace record_daily_result with a freeze-aware version. The signature
-- and return shape stay the same — callers don't need to change. The
-- response now includes `freeze_consumed` (boolean) so the UI can show
-- a "saved by a freeze" toast.
create or replace function public.record_daily_result(
  p_puzzle_date date,
  p_correct boolean,
  p_clip_level integer default null,
  p_time_ms integer default 0,
  p_score integer default 0
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_existing record;
  v_streak record;
  v_new_current integer;
  v_new_longest integer;
  v_freeze_consumed boolean := false;
  v_inserted boolean := false;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Insert (or skip) daily_result. First attempt of the day is the
  -- official record.
  insert into public.daily_results (user_id, puzzle_date, clip_level_guessed, correct, time_ms, score)
  values (v_user, p_puzzle_date, p_clip_level, p_correct, p_time_ms, p_score)
  on conflict (user_id, puzzle_date) do nothing;
  get diagnostics v_inserted = row_count;

  -- Resubmission: no-op on the streak.
  if v_inserted = false or v_inserted is null then
    select * into v_streak from public.streaks where user_id = v_user;
    if found then
      return json_build_object(
        'current_streak', v_streak.current_streak,
        'longest_streak', v_streak.longest_streak,
        'freezes_available', v_streak.freezes_available,
        'freeze_consumed', false,
        'updated', false
      );
    end if;
  end if;

  perform 1 from public.streaks where user_id = v_user for update;
  select * into v_streak from public.streaks where user_id = v_user;

  if not found then
    insert into public.streaks (user_id, current_streak, longest_streak, last_play_date)
    values (v_user, case when p_correct then 1 else 0 end, case when p_correct then 1 else 0 end, p_puzzle_date)
    returning current_streak, longest_streak into v_new_current, v_new_longest;
    return json_build_object(
      'current_streak', v_new_current,
      'longest_streak', v_new_longest,
      'freezes_available', 1,
      'freeze_consumed', false,
      'updated', true
    );
  end if;

  if not p_correct then
    update public.streaks
       set current_streak = 0,
           last_play_date = p_puzzle_date
     where user_id = v_user
     returning current_streak, longest_streak into v_new_current, v_new_longest;
    return json_build_object(
      'current_streak', v_new_current,
      'longest_streak', v_new_longest,
      'freezes_available', v_streak.freezes_available,
      'freeze_consumed', false,
      'updated', true
    );
  end if;

  -- Correct today.
  if v_streak.last_play_date = (p_puzzle_date - interval '1 day')::date then
    -- Played yesterday → normal increment.
    v_new_current := v_streak.current_streak + 1;
  elsif v_streak.last_play_date = p_puzzle_date then
    return json_build_object(
      'current_streak', v_streak.current_streak,
      'longest_streak', v_streak.longest_streak,
      'freezes_available', v_streak.freezes_available,
      'freeze_consumed', false,
      'updated', false
    );
  elsif v_streak.last_play_date = (p_puzzle_date - interval '2 days')::date
    and v_streak.freezes_available > 0
    and v_streak.current_streak > 0
  then
    -- Missed exactly yesterday but a freeze is available and the user
    -- had an active streak going. Burn one freeze, bridge the gap.
    v_new_current := v_streak.current_streak + 1;
    v_freeze_consumed := true;
  else
    -- Gap >1 day or no freeze: reset to 1.
    v_new_current := 1;
  end if;

  v_new_longest := greatest(v_streak.longest_streak, v_new_current);

  update public.streaks
     set current_streak = v_new_current,
         longest_streak = v_new_longest,
         last_play_date = p_puzzle_date,
         freezes_available = case when v_freeze_consumed then freezes_available - 1 else freezes_available end
   where user_id = v_user;

  return json_build_object(
    'current_streak', v_new_current,
    'longest_streak', v_new_longest,
    'freezes_available', case when v_freeze_consumed then v_streak.freezes_available - 1 else v_streak.freezes_available end,
    'freeze_consumed', v_freeze_consumed,
    'updated', true
  );
end;
$$;

grant execute on function public.record_daily_result(date, boolean, integer, integer, integer) to authenticated;

-- Pro-only weekly freeze grant. Idempotent — caps at 2 freezes and
-- requires 7+ days since last grant. Safe to call on every app load.
create or replace function public.grant_weekly_freeze()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_streak record;
  v_pro boolean;
  v_now timestamptz := now();
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  v_pro := public.is_pro_active(v_user);
  if not v_pro then
    return json_build_object('granted', false, 'reason', 'not_pro');
  end if;

  perform 1 from public.streaks where user_id = v_user for update;
  select * into v_streak from public.streaks where user_id = v_user;

  if not found then
    insert into public.streaks (user_id) values (v_user);
    select * into v_streak from public.streaks where user_id = v_user;
  end if;

  if v_streak.last_freeze_grant_at is not null
     and v_streak.last_freeze_grant_at > v_now - interval '7 days'
  then
    return json_build_object(
      'granted', false,
      'reason', 'rate_limited',
      'freezes_available', v_streak.freezes_available,
      'next_grant_at', v_streak.last_freeze_grant_at + interval '7 days'
    );
  end if;

  if v_streak.freezes_available >= 2 then
    -- Update timestamp anyway so we don't recheck on every load when
    -- the user is sitting at the cap. They'll resume gaining at the
    -- next 7-day mark after they consume one.
    update public.streaks
       set last_freeze_grant_at = v_now
     where user_id = v_user;
    return json_build_object(
      'granted', false,
      'reason', 'at_cap',
      'freezes_available', v_streak.freezes_available
    );
  end if;

  update public.streaks
     set freezes_available = freezes_available + 1,
         last_freeze_grant_at = v_now
   where user_id = v_user;

  return json_build_object(
    'granted', true,
    'freezes_available', v_streak.freezes_available + 1
  );
end;
$$;

revoke all on function public.grant_weekly_freeze() from public;
grant execute on function public.grant_weekly_freeze() to authenticated;

-- Buy a freeze with Riffs. Atomic — spend + grant in one transaction.
create or replace function public.buy_streak_freeze(p_cost integer default 50)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_streak record;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_cost < 0 or p_cost > 500 then
    raise exception 'Invalid cost';
  end if;

  perform 1 from public.streaks where user_id = v_user for update;
  select * into v_streak from public.streaks where user_id = v_user;

  if not found then
    insert into public.streaks (user_id) values (v_user);
    select * into v_streak from public.streaks where user_id = v_user;
  end if;

  if v_streak.freezes_available >= 2 then
    return json_build_object('ok', false, 'reason', 'at_cap');
  end if;

  v_balance := public.spend_coins(p_cost, 'streak_freeze', null);

  update public.streaks
     set freezes_available = freezes_available + 1
   where user_id = v_user;

  return json_build_object(
    'ok', true,
    'freezes_available', v_streak.freezes_available + 1,
    'new_balance', v_balance
  );
end;
$$;

revoke all on function public.buy_streak_freeze(integer) from public;
grant execute on function public.buy_streak_freeze(integer) to authenticated;
