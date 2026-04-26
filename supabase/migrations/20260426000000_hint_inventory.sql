-- Per-player hint inventory. Each key is a HintKind (year /
-- artist_letter / artist), value is the count of "free" uses the
-- player has banked. Costs Riffs once depleted. Earned via the
-- ad-watch flow.
alter table public.profiles
  add column if not exists hint_inventory jsonb not null default '{}'::jsonb;

create or replace function public.consume_hint(p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count int;
begin
  if v_user is null then return false; end if;
  select coalesce((hint_inventory ->> p_kind)::int, 0)
    into v_count
    from public.profiles
    where id = v_user
    for update;
  if v_count <= 0 then return false; end if;
  update public.profiles
    set hint_inventory =
      jsonb_set(
        hint_inventory,
        array[p_kind],
        to_jsonb(v_count - 1),
        true
      )
    where id = v_user;
  return true;
end;
$$;

create or replace function public.grant_hint(p_kind text, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_current int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_amount <= 0 then return; end if;
  select coalesce((hint_inventory ->> p_kind)::int, 0)
    into v_current
    from public.profiles
    where id = v_user
    for update;
  update public.profiles
    set hint_inventory =
      jsonb_set(
        hint_inventory,
        array[p_kind],
        to_jsonb(v_current + p_amount),
        true
      )
    where id = v_user;
end;
$$;

grant execute on function public.consume_hint(text) to authenticated;
grant execute on function public.grant_hint(text, int) to authenticated;
