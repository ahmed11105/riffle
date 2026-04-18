-- Daily streak RPC. Increments the current streak if the user played
-- yesterday, resets to 1 if they missed a day, leaves it alone if they
-- already played today (idempotent within a UTC day).
--
-- Also writes the daily_results row in the same transaction so the
-- streak and the result row stay in sync.

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
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Insert (or fetch existing) daily_result. We never overwrite an
  -- existing row, the user's first attempt of the day is the result of
  -- record.
  insert into public.daily_results (user_id, puzzle_date, clip_level_guessed, correct, time_ms, score)
  values (v_user, p_puzzle_date, p_clip_level, p_correct, p_time_ms, p_score)
  on conflict (user_id, puzzle_date) do nothing
  returning * into v_existing;

  -- If the row already existed (re-submission), no-op on the streak.
  if v_existing is null then
    select * into v_streak from public.streaks where user_id = v_user;
    if found then
      return json_build_object('current_streak', v_streak.current_streak, 'longest_streak', v_streak.longest_streak, 'updated', false);
    end if;
  end if;

  -- Update streak. Lock the row so concurrent inserts (rare) serialise.
  perform 1 from public.streaks where user_id = v_user for update;
  select * into v_streak from public.streaks where user_id = v_user;

  if not found then
    insert into public.streaks (user_id, current_streak, longest_streak, last_play_date)
    values (v_user, case when p_correct then 1 else 0 end, case when p_correct then 1 else 0 end, p_puzzle_date)
    returning current_streak, longest_streak into v_new_current, v_new_longest;
    return json_build_object('current_streak', v_new_current, 'longest_streak', v_new_longest, 'updated', true);
  end if;

  if not p_correct then
    -- Failed today, streak resets to 0 (still record the play date).
    update public.streaks
       set current_streak = 0,
           last_play_date = p_puzzle_date
     where user_id = v_user
     returning current_streak, longest_streak into v_new_current, v_new_longest;
    return json_build_object('current_streak', v_new_current, 'longest_streak', v_new_longest, 'updated', true);
  end if;

  -- Correct today. If last play was yesterday, increment. Otherwise reset to 1.
  if v_streak.last_play_date = (p_puzzle_date - interval '1 day')::date then
    v_new_current := v_streak.current_streak + 1;
  elsif v_streak.last_play_date = p_puzzle_date then
    -- Already counted today (shouldn't happen if existing-row check above worked, but be defensive).
    return json_build_object('current_streak', v_streak.current_streak, 'longest_streak', v_streak.longest_streak, 'updated', false);
  else
    v_new_current := 1;
  end if;

  v_new_longest := greatest(v_streak.longest_streak, v_new_current);

  update public.streaks
     set current_streak = v_new_current,
         longest_streak = v_new_longest,
         last_play_date = p_puzzle_date
   where user_id = v_user;

  return json_build_object('current_streak', v_new_current, 'longest_streak', v_new_longest, 'updated', true);
end;
$$;

grant execute on function public.record_daily_result(date, boolean, integer, integer, integer) to authenticated;
