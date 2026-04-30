-- Streak restore: when a streak resets (>=3), remember what it was.
-- Within 48h of the break, allow the user to restore it for Riffs.
-- Once-per-break gating prevents repeat refunds; Riffs (not cash) keeps
-- this on the right side of the dark-pattern line.

alter table public.streaks
  add column if not exists pre_break_streak integer not null default 0,
  add column if not exists broken_at timestamptz;

create or replace function public.restore_streak_with_riffs(p_cost integer default 100)
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
  if p_cost < 0 or p_cost > 1000 then
    raise exception 'Invalid cost';
  end if;

  perform 1 from public.streaks where user_id = v_user for update;
  select * into v_streak from public.streaks where user_id = v_user;

  if not found
     or v_streak.pre_break_streak < 3
     or v_streak.broken_at is null
     or v_streak.broken_at < now() - interval '48 hours'
     or v_streak.current_streak >= v_streak.pre_break_streak
  then
    return json_build_object('ok', false, 'reason', 'not_eligible');
  end if;

  v_balance := public.spend_coins(p_cost, 'streak_restore', null);

  update public.streaks
     set current_streak = v_streak.pre_break_streak,
         longest_streak = greatest(longest_streak, v_streak.pre_break_streak),
         pre_break_streak = 0,
         broken_at = null
   where user_id = v_user;

  return json_build_object(
    'ok', true,
    'current_streak', v_streak.pre_break_streak,
    'new_balance', v_balance
  );
end;
$$;

revoke all on function public.restore_streak_with_riffs(integer) from public;
grant execute on function public.restore_streak_with_riffs(integer) to authenticated;
