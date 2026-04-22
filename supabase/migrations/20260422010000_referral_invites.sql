-- Per-user persistent invite code.
create table public.invite_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text unique not null,
  created_at timestamptz default now()
);

-- Each successful redemption. One row per redeemed friend.
create table public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_by_user_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_email text not null,
  redeemed_at timestamptz default now(),
  reward_amount int not null
);
-- One redemption per email forever — same email coming back later
-- can't double-claim. Email is normalized lowercase by the RPC.
create unique index invite_redemptions_email_idx
  on public.invite_redemptions(redeemed_email);
create index invite_redemptions_inviter_idx
  on public.invite_redemptions(inviter_id);

alter table public.invite_codes enable row level security;
alter table public.invite_redemptions enable row level security;

create policy "invite_codes: self read"
  on public.invite_codes for select
  using (auth.uid() = user_id);

create policy "invite_redemptions: self read"
  on public.invite_redemptions for select
  using (auth.uid() = inviter_id or auth.uid() = redeemed_by_user_id);

-- Get or lazily create the caller's invite code.
create or replace function public.get_or_create_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  select code into v_code from public.invite_codes where user_id = v_user_id;
  if v_code is not null then
    return v_code;
  end if;
  loop
    -- 8-char base36-ish from a uuid; uppercase for shareability.
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
    begin
      insert into public.invite_codes(user_id, code) values (v_user_id, v_code);
      return v_code;
    exception when unique_violation then
      continue;
    end;
  end loop;
end;
$$;

-- Server-side redeem with anti-abuse rules.
-- Returns json: { ok: bool, error?: string, reward?: int }
create or replace function public.redeem_invite(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_inviter_id uuid;
  v_reward int := 100;
  v_existing uuid;
begin
  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select lower(email) into v_email from auth.users where id = v_user_id;
  if v_email is null or v_email = '' then
    return json_build_object('ok', false, 'error', 'no_email');
  end if;

  select user_id into v_inviter_id from public.invite_codes where code = upper(p_code);
  if v_inviter_id is null then
    return json_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if v_inviter_id = v_user_id then
    return json_build_object('ok', false, 'error', 'self_redemption');
  end if;

  select id into v_existing from public.invite_redemptions where redeemed_email = v_email;
  if v_existing is not null then
    return json_build_object('ok', false, 'error', 'already_redeemed');
  end if;

  insert into public.invite_redemptions(inviter_id, redeemed_by_user_id, redeemed_email, reward_amount)
  values (v_inviter_id, v_user_id, v_email, v_reward);

  perform public.grant_coins(v_inviter_id, v_reward, 'invite_reward', concat('inviter:', v_user_id::text));
  perform public.grant_coins(v_user_id, v_reward, 'invite_reward', concat('redeemer:', v_inviter_id::text));

  return json_build_object('ok', true, 'reward', v_reward);
end;
$$;

grant execute on function public.get_or_create_invite_code() to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
