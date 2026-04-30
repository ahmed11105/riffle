-- Genre takeover events. Monthly themed weeks (80s, Hip-Hop, K-Pop) with
-- their own scoring track + milestone Riffs payouts + leaderboard +
-- exclusive cosmetic badge. Scoring fires inside record_daily_result so
-- the daily puzzle is the primary on-ramp.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  accent_color text not null default '#f59e0b',
  icon text not null default '🎸',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  milestone_thresholds jsonb not null default '[]'::jsonb,
  badge_label text,
  created_at timestamptz not null default now()
);

create index if not exists events_active_idx on public.events (starts_at, ends_at);

alter table public.events enable row level security;
create policy "events: public read" on public.events for select using (true);

create table if not exists public.event_entries (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null default 0,
  milestone_claims integer[] not null default '{}',
  last_updated timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_entries_score_idx
  on public.event_entries (event_id, score desc);

alter table public.event_entries enable row level security;
create policy "event_entries: public read" on public.event_entries for select using (true);

create or replace function public.get_active_event()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  accent_color text,
  icon text,
  starts_at timestamptz,
  ends_at timestamptz,
  milestone_thresholds jsonb,
  badge_label text
)
language sql
stable
as $$
  select id, slug, name, description, accent_color, icon, starts_at, ends_at,
         milestone_thresholds, badge_label
  from public.events
  where now() between starts_at and ends_at
  order by starts_at desc
  limit 1;
$$;

grant execute on function public.get_active_event() to authenticated, anon;

create or replace function public.event_points_for_level(p_clip_level integer)
returns integer
language sql
immutable
as $$
  select case
    when p_clip_level is null then 1
    when p_clip_level <= 1 then 10
    when p_clip_level <= 2 then 7
    when p_clip_level <= 4 then 5
    when p_clip_level <= 7 then 3
    else 2
  end;
$$;

grant execute on function public.event_points_for_level(integer) to authenticated, anon;

create or replace function public.claim_event_milestone(
  p_event_id uuid,
  p_milestone_index integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_event record;
  v_entry record;
  v_milestone jsonb;
  v_required integer;
  v_riffs integer;
  v_new_balance integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Unknown event';
  end if;
  if now() > v_event.ends_at + interval '7 days' then
    raise exception 'Event milestones closed';
  end if;

  v_milestone := v_event.milestone_thresholds -> p_milestone_index;
  if v_milestone is null then
    raise exception 'Unknown milestone';
  end if;
  v_required := (v_milestone->>'score')::integer;
  v_riffs := (v_milestone->>'riffs')::integer;

  perform 1 from public.event_entries
    where event_id = p_event_id and user_id = v_user
    for update;
  select * into v_entry from public.event_entries
    where event_id = p_event_id and user_id = v_user;
  if not found then
    return json_build_object('ok', false, 'reason', 'no_score');
  end if;
  if v_entry.score < v_required then
    return json_build_object('ok', false, 'reason', 'below_threshold');
  end if;
  if p_milestone_index = any(v_entry.milestone_claims) then
    return json_build_object('ok', false, 'reason', 'already_claimed');
  end if;

  perform 1 from public.profiles where id = v_user for update;
  update public.profiles set coin_balance = coin_balance + v_riffs
    where id = v_user
    returning coin_balance into v_new_balance;
  insert into public.coin_transactions (user_id, delta, reason)
    values (v_user, v_riffs, 'event_milestone:' || v_event.slug || ':' || p_milestone_index::text);

  update public.event_entries
     set milestone_claims = milestone_claims || array[p_milestone_index]
   where event_id = p_event_id and user_id = v_user;

  return json_build_object('ok', true, 'riffs', v_riffs, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.claim_event_milestone(uuid, integer) from public;
grant execute on function public.claim_event_milestone(uuid, integer) to authenticated;

-- Update record_daily_result to bank event score on correct solves.
-- Live function source-of-truth was applied via apply_migration; this
-- file is here so the next fresh `db reset` reproduces the same shape.
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
  v_streak record;
  v_new_current integer;
  v_new_longest integer;
  v_freeze_consumed boolean := false;
  v_inserted_count integer;
  v_will_break boolean := false;
  v_event_id uuid;
  v_event_points integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.daily_results (user_id, puzzle_date, clip_level_guessed, correct, time_ms, score)
  values (v_user, p_puzzle_date, p_clip_level, p_correct, p_time_ms, p_score)
  on conflict (user_id, puzzle_date) do nothing;
  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    select * into v_streak from public.streaks where user_id = v_user;
    if found then
      return json_build_object(
        'current_streak', v_streak.current_streak,
        'longest_streak', v_streak.longest_streak,
        'freezes_available', v_streak.freezes_available,
        'freeze_consumed', false,
        'event_points_awarded', 0,
        'updated', false
      );
    end if;
  end if;

  if v_inserted_count > 0 and p_correct then
    select id into v_event_id from public.events
      where now() between starts_at and ends_at
      order by starts_at desc limit 1;
    if v_event_id is not null then
      v_event_points := public.event_points_for_level(p_clip_level);
      insert into public.event_entries (event_id, user_id, score)
        values (v_event_id, v_user, v_event_points)
      on conflict (event_id, user_id)
        do update set score = public.event_entries.score + excluded.score,
                      last_updated = now();
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
      'event_points_awarded', coalesce(v_event_points, 0),
      'updated', true
    );
  end if;

  if not p_correct then
    update public.streaks
       set current_streak = 0,
           last_play_date = p_puzzle_date,
           pre_break_streak = case when v_streak.current_streak >= 3 then v_streak.current_streak else pre_break_streak end,
           broken_at = case when v_streak.current_streak >= 3 then now() else broken_at end
     where user_id = v_user
     returning current_streak, longest_streak into v_new_current, v_new_longest;
    return json_build_object(
      'current_streak', v_new_current,
      'longest_streak', v_new_longest,
      'freezes_available', v_streak.freezes_available,
      'freeze_consumed', false,
      'event_points_awarded', 0,
      'updated', true
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
      'event_points_awarded', coalesce(v_event_points, 0),
      'updated', false
    );
  elsif v_streak.last_play_date = (p_puzzle_date - interval '2 days')::date
    and v_streak.freezes_available > 0
    and v_streak.current_streak > 0
  then
    v_new_current := v_streak.current_streak + 1;
    v_freeze_consumed := true;
  else
    v_will_break := v_streak.current_streak >= 3;
    v_new_current := 1;
  end if;

  v_new_longest := greatest(v_streak.longest_streak, v_new_current);

  update public.streaks
     set current_streak = v_new_current,
         longest_streak = v_new_longest,
         last_play_date = p_puzzle_date,
         freezes_available = case when v_freeze_consumed then freezes_available - 1 else freezes_available end,
         pre_break_streak = case when v_will_break then v_streak.current_streak else pre_break_streak end,
         broken_at = case when v_will_break then now() else broken_at end
   where user_id = v_user;

  return json_build_object(
    'current_streak', v_new_current,
    'longest_streak', v_new_longest,
    'freezes_available', case when v_freeze_consumed then v_streak.freezes_available - 1 else v_streak.freezes_available end,
    'freeze_consumed', v_freeze_consumed,
    'event_points_awarded', coalesce(v_event_points, 0),
    'updated', true
  );
end;
$$;

grant execute on function public.record_daily_result(date, boolean, integer, integer, integer) to authenticated;
