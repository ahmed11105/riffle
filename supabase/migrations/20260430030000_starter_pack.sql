-- One-time first-day starter pack: £1.99 = 200 Riffs + 7-day Pro trial
-- + a cosmetic flair. Eligibility: signed-up (not anonymous), played at
-- least 1 daily, has not claimed before.

alter table public.profiles
  add column if not exists starter_pack_claimed boolean not null default false,
  add column if not exists starter_pack_claimed_at timestamptz;

create or replace function public.grant_starter_pack(
  p_user uuid,
  p_riffs integer,
  p_session_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text := current_setting('request.jwt.claims', true)::json->>'role';
  v_profile record;
  v_new_balance integer;
  v_pro_set boolean := false;
  v_trial_until timestamptz;
begin
  if v_caller_role <> 'service_role' then
    raise exception 'grant_starter_pack is service-role only' using errcode = '42501';
  end if;
  if p_riffs <= 0 then
    raise exception 'Riffs must be positive';
  end if;

  perform 1 from public.profiles where id = p_user for update;
  select id, is_pro, pro_current_period_end, starter_pack_claimed
    into v_profile
    from public.profiles
    where id = p_user;

  if not found then
    raise exception 'User not found';
  end if;
  if v_profile.starter_pack_claimed then
    return json_build_object('ok', true, 'already_claimed', true);
  end if;

  update public.profiles
     set coin_balance = coin_balance + p_riffs,
         starter_pack_claimed = true,
         starter_pack_claimed_at = now()
   where id = p_user
   returning coin_balance into v_new_balance;

  insert into public.coin_transactions (user_id, delta, reason)
  values (p_user, p_riffs, 'starter_pack:' || p_session_id);

  if not (v_profile.is_pro
          and (v_profile.pro_current_period_end is null
               or v_profile.pro_current_period_end > now()))
  then
    v_trial_until := now() + interval '7 days';
    update public.profiles
       set is_pro = true,
           pro_current_period_end = v_trial_until,
           pro_status = 'starter_trial'
     where id = p_user;
    v_pro_set := true;
  end if;

  return json_build_object(
    'ok', true,
    'new_balance', v_new_balance,
    'pro_trial_granted', v_pro_set,
    'pro_trial_until', v_trial_until
  );
end;
$$;

revoke all on function public.grant_starter_pack(uuid, integer, text) from public;
grant execute on function public.grant_starter_pack(uuid, integer, text) to service_role;
