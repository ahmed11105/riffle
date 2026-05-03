-- Replace record_daily_result so p_clip_level accepts numeric (the
-- ladder uses 0.5, 1, 2, 4, 7, 10). The integer signature was
-- silently rejecting every solve at the 0.5s level with a 22P02
-- "invalid input syntax for type integer" — meaning the streak
-- never advanced and the daily_solve metric never fired for those
-- clips. Drop the int variant before creating the numeric one so
-- there's exactly one overload.

drop function if exists public.record_daily_result(date, boolean, integer, integer, integer);

create or replace function public.record_daily_result(
  p_puzzle_date date,
  p_correct boolean,
  p_clip_level numeric default null,
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
  v_streak record;
  v_new_current integer;
  v_new_longest integer;
  v_freeze_consumed boolean := false;
  v_inserted integer := 0;
  v_riffs_granted integer := 0;
  v_new_balance integer := null;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.daily_results (user_id, puzzle_date, clip_level_guessed, correct, time_ms, score)
  values (v_user, p_puzzle_date, p_clip_level, p_correct, p_time_ms, p_score)
  on conflict (user_id, puzzle_date) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 and p_correct then
    update public.profiles
       set coin_balance = coin_balance + 10
     where id = v_user
     returning coin_balance into v_new_balance;
    v_riffs_granted := 10;
  end if;

  if v_inserted = 0 then
    select * into v_streak from public.streaks where user_id = v_user;
    if found then
      return json_build_object(
        'current_streak', v_streak.current_streak,
        'longest_streak', v_streak.longest_streak,
        'freezes_available', v_streak.freezes_available,
        'freeze_consumed', false,
        'updated', false,
        'riffs_granted', 0,
        'new_balance', null
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
      'updated', true,
      'riffs_granted', v_riffs_granted,
      'new_balance', v_new_balance
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
      'updated', true,
      'riffs_granted', 0,
      'new_balance', null
    );
  end if;

  if v_streak.last_play_date = (p_puzzle_date - interval '1 day')::date then
    v_new_current := v_streak.current_streak + 1;
  elsif v_streak.last_play_date = p_puzzle_date then
    return json_build_object(
      'current_streak', v_streak.current_streak,
      'longest_streak', v_streak.longest_streak,
      'freezes_available', v_streak.freezes_available,
      'freeze_consumed', false,
      'updated', false,
      'riffs_granted', v_riffs_granted,
      'new_balance', v_new_balance
    );
  elsif v_streak.last_play_date = (p_puzzle_date - interval '2 days')::date
    and v_streak.freezes_available > 0
    and v_streak.current_streak > 0
  then
    v_new_current := v_streak.current_streak + 1;
    v_freeze_consumed := true;
  else
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
    'updated', true,
    'riffs_granted', v_riffs_granted,
    'new_balance', v_new_balance
  );
end;
$$;

grant execute on function public.record_daily_result(date, boolean, numeric, integer, integer) to authenticated;
