-- Riffs (in-game currency), atomic spend/grant + pack unlocks + ad earn cap.
--
-- The existing schema already has profiles.coin_balance and the
-- coin_transactions ledger. Internally we keep the SQL columns named
-- "coin_balance" / "coin_transactions", externally (UI/copy) we call
-- the currency "Riffs". This migration:
--   1. Adds atomic spend/grant RPCs that lock the row + write a ledger entry
--      in one transaction, so two concurrent hint-buys can't double-spend.
--   2. Adds user_pack_unlocks: which packs each user has bought.
--   3. Adds ad_grants: per-day cap on rewarded-ad earnings (anti-farming).
--   4. Tightens RLS so users can only read their own balance/ledger.

-- 1. Atomic spend
create or replace function public.spend_coins(
  p_amount integer,
  p_reason text,
  p_ref text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_new_balance integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  -- Lock the profile row to serialise concurrent spends.
  perform 1 from public.profiles where id = v_user for update;

  update public.profiles
     set coin_balance = coin_balance - p_amount
   where id = v_user
     and coin_balance >= p_amount
   returning coin_balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'Insufficient Riffs' using errcode = 'P0001';
  end if;

  insert into public.coin_transactions (user_id, delta, reason)
  values (v_user, -p_amount, coalesce(p_reason || case when p_ref is not null then ':' || p_ref else '' end, p_reason));

  return v_new_balance;
end;
$$;

revoke all on function public.spend_coins(integer, text, text) from public;
grant execute on function public.spend_coins(integer, text, text) to authenticated;

-- 2. Atomic grant. Callable only by service_role (Stripe webhook, ad reward
-- handler, achievement unlock). Never by the client directly.
create or replace function public.grant_coins(
  p_user uuid,
  p_amount integer,
  p_reason text,
  p_ref text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text := current_setting('request.jwt.claims', true)::json->>'role';
  v_new_balance integer;
begin
  if v_caller_role <> 'service_role' then
    raise exception 'grant_coins is service-role only' using errcode = '42501';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  perform 1 from public.profiles where id = p_user for update;

  update public.profiles
     set coin_balance = coin_balance + p_amount
   where id = p_user
   returning coin_balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'User not found';
  end if;

  insert into public.coin_transactions (user_id, delta, reason)
  values (p_user, p_amount, coalesce(p_reason || case when p_ref is not null then ':' || p_ref else '' end, p_reason));

  return v_new_balance;
end;
$$;

revoke all on function public.grant_coins(uuid, integer, text, text) from public;
grant execute on function public.grant_coins(uuid, integer, text, text) to service_role;

-- 3. Pack unlocks. Each row = a user owns a pack (whether earned or paid).
create table if not exists public.user_pack_unlocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pack_slug text not null references public.packs(slug) on delete cascade,
  unlocked_via text not null check (unlocked_via in ('riffs', 'stripe', 'free', 'promo')),
  riffs_paid integer,
  stripe_session_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, pack_slug)
);
alter table public.user_pack_unlocks enable row level security;

create policy "user_pack_unlocks: self read"
  on public.user_pack_unlocks for select
  using (auth.uid() = user_id);

-- Inserts only via the unlock_pack RPC below (service-role bypasses RLS).
create policy "user_pack_unlocks: deny direct insert"
  on public.user_pack_unlocks for insert with check (false);

-- 4. Atomic pack-unlock RPC: spend + record unlock in one transaction.
create or replace function public.unlock_pack_with_riffs(
  p_pack_slug text,
  p_cost integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_already integer;
  v_pack_exists integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_cost < 0 then
    raise exception 'Cost must be non-negative';
  end if;

  select 1 into v_pack_exists from public.packs where slug = p_pack_slug;
  if v_pack_exists is null then
    raise exception 'Unknown pack';
  end if;

  select 1 into v_already
  from public.user_pack_unlocks
  where user_id = v_user and pack_slug = p_pack_slug;
  if v_already is not null then
    return 'already_unlocked';
  end if;

  if p_cost > 0 then
    perform public.spend_coins(p_cost, 'pack_unlock', p_pack_slug);
  end if;

  insert into public.user_pack_unlocks (user_id, pack_slug, unlocked_via, riffs_paid)
  values (v_user, p_pack_slug, case when p_cost = 0 then 'free' else 'riffs' end, p_cost);

  return 'unlocked';
end;
$$;

revoke all on function public.unlock_pack_with_riffs(text, integer) from public;
grant execute on function public.unlock_pack_with_riffs(text, integer) to authenticated;

-- 5. Daily ad-grant cap: max 5 rewarded-ad redemptions per UTC day per user.
create table if not exists public.ad_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  riffs_awarded integer not null
);
alter table public.ad_grants enable row level security;
create policy "ad_grants: self read"
  on public.ad_grants for select
  using (auth.uid() = user_id);
create index ad_grants_user_day_idx on public.ad_grants (user_id, granted_at);

create or replace function public.claim_ad_reward(p_amount integer default 25)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today_count integer;
  v_new_balance integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_amount <= 0 or p_amount > 100 then
    raise exception 'Invalid ad reward amount';
  end if;

  select count(*) into v_today_count
  from public.ad_grants
  where user_id = v_user
    and granted_at >= date_trunc('day', now() at time zone 'UTC');

  if v_today_count >= 5 then
    raise exception 'Daily ad limit reached' using errcode = 'P0002';
  end if;

  perform 1 from public.profiles where id = v_user for update;
  update public.profiles set coin_balance = coin_balance + p_amount
   where id = v_user
   returning coin_balance into v_new_balance;

  insert into public.ad_grants (user_id, riffs_awarded) values (v_user, p_amount);
  insert into public.coin_transactions (user_id, delta, reason)
  values (v_user, p_amount, 'ad_reward');

  return v_new_balance;
end;
$$;

revoke all on function public.claim_ad_reward(integer) from public;
grant execute on function public.claim_ad_reward(integer) to authenticated;

-- 6. Tighten coin_transactions RLS: users see only their own, no inserts from client.
drop policy if exists "coin_tx: self read" on public.coin_transactions;
create policy "coin_tx: self read"
  on public.coin_transactions for select
  using (auth.uid() = user_id);
create policy "coin_tx: deny direct insert"
  on public.coin_transactions for insert with check (false);
