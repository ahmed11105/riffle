-- Riot/Discord-style player tag. Combined with display_name, this
-- gives every player a unique handle even if many people choose
-- the same name (Alex#0042 vs Alex#0177).
alter table public.profiles
  add column if not exists tag int;

-- Two players can share a name only if their tags differ.
create unique index if not exists profiles_name_tag_unique_idx
  on public.profiles (lower(display_name), tag);

-- Set or change a player's display name. Returns the assigned tag.
-- Picks the lowest unused tag (0001..9999) for that lowercased name.
-- If 9999 names with the same root collide we error out — extremely
-- unlikely; if it ever happens we'll add longer tags.
create or replace function public.set_display_name(p_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text;
  v_old_name text;
  v_old_tag int;
  v_tag int;
begin
  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if length(v_name) = 0 then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  if length(v_name) > 24 then
    return json_build_object('ok', false, 'error', 'too_long');
  end if;

  select display_name, tag into v_old_name, v_old_tag
    from public.profiles where id = v_user_id;

  if v_old_tag is not null and lower(v_old_name) = lower(v_name) then
    update public.profiles set display_name = v_name where id = v_user_id;
    return json_build_object('ok', true, 'name', v_name, 'tag', v_old_tag);
  end if;

  select s.n into v_tag
  from generate_series(1, 9999) as s(n)
  where not exists (
    select 1 from public.profiles p
    where lower(p.display_name) = lower(v_name)
      and p.tag = s.n
      and p.id <> v_user_id
  )
  order by s.n
  limit 1;

  if v_tag is null then
    return json_build_object('ok', false, 'error', 'name_full');
  end if;

  update public.profiles
    set display_name = v_name, tag = v_tag
    where id = v_user_id;

  return json_build_object('ok', true, 'name', v_name, 'tag', v_tag);
end;
$$;

grant execute on function public.set_display_name(text) to authenticated;

-- Backfill tags for existing rows.
do $$
declare
  r record;
  v_tag int;
begin
  for r in
    select id, display_name from public.profiles
    where tag is null and display_name is not null
    order by created_at nulls last, id
  loop
    select s.n into v_tag
    from generate_series(1, 9999) as s(n)
    where not exists (
      select 1 from public.profiles p
      where lower(p.display_name) = lower(r.display_name)
        and p.tag = s.n
    )
    order by s.n
    limit 1;
    if v_tag is not null then
      update public.profiles set tag = v_tag where id = r.id;
    end if;
  end loop;
end $$;
