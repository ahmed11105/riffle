-- Pro subscription support.
--
-- The existing schema has profiles.is_pro (boolean). This migration:
--   1. Adds Stripe subscription tracking columns (customer/subscription ids,
--      current_period_end, status) so the webhook can keep state in sync.
--   2. Adds is_pro_active() helper that combines is_pro + period_end check.
--   3. Adds can_host_room() RPC: free users may host 1 room per UTC day;
--      Pro users have no cap. Joining is unrestricted for everyone.
--   4. Adds grant_pro() / revoke_pro() service-role RPCs called by the
--      Stripe webhook on subscription lifecycle events.
--   5. Backfills rooms.host_id index for the daily-cap query.

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists pro_current_period_end timestamptz,
  add column if not exists pro_status text;

create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id);
create index if not exists profiles_stripe_subscription_idx
  on public.profiles (stripe_subscription_id);

-- Cap-check index. The query is host_id=$1 AND created_at >= today_utc.
create index if not exists rooms_host_created_idx
  on public.rooms (host_id, created_at desc);

-- 1. is_pro_active(): single source of truth for "is this user currently Pro".
-- True if either (a) is_pro flag set with a future period_end, or (b) is_pro
-- set with a NULL period_end (lifetime / manually granted, future-proofing).
create or replace function public.is_pro_active(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select is_pro and (
        pro_current_period_end is null
        or pro_current_period_end > now()
      )
      from public.profiles
      where id = p_user
    ),
    false
  );
$$;

grant execute on function public.is_pro_active(uuid) to authenticated;

-- 2. can_host_room(): free users limited to 1 room per UTC day.
create or replace function public.can_host_room()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today_count integer;
begin
  if v_user is null then
    return false;
  end if;

  if public.is_pro_active(v_user) then
    return true;
  end if;

  select count(*) into v_today_count
  from public.rooms
  where host_id = v_user
    and created_at >= date_trunc('day', now() at time zone 'UTC');

  return v_today_count < 1;
end;
$$;

grant execute on function public.can_host_room() to authenticated;

-- 3. grant_pro / revoke_pro: only service_role. Called from the Stripe webhook.
create or replace function public.grant_pro(
  p_user uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_period_end timestamptz,
  p_status text default 'active'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text := current_setting('request.jwt.claims', true)::json->>'role';
begin
  if v_caller_role <> 'service_role' then
    raise exception 'grant_pro is service-role only' using errcode = '42501';
  end if;

  update public.profiles
     set is_pro = true,
         stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id),
         stripe_subscription_id = coalesce(p_stripe_subscription_id, stripe_subscription_id),
         pro_current_period_end = p_period_end,
         pro_status = p_status
   where id = p_user;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke all on function public.grant_pro(uuid, text, text, timestamptz, text) from public;
grant execute on function public.grant_pro(uuid, text, text, timestamptz, text) to service_role;

create or replace function public.revoke_pro(p_user uuid, p_status text default 'cancelled')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text := current_setting('request.jwt.claims', true)::json->>'role';
begin
  if v_caller_role <> 'service_role' then
    raise exception 'revoke_pro is service-role only' using errcode = '42501';
  end if;

  update public.profiles
     set is_pro = false,
         pro_status = p_status
   where id = p_user;
end;
$$;

revoke all on function public.revoke_pro(uuid, text) from public;
grant execute on function public.revoke_pro(uuid, text) to service_role;
