-- Audit log of email-address changes on auth.users so an admin can
-- look up a user by any address that was once attached, even after
-- the address has been swapped (e.g. compromised account, hostile
-- email change).
--
-- The table is append-only. A row is inserted on every email change
-- by the trigger below. RLS denies all client access; only the
-- service role (admin server route) reads this table.

create table if not exists public.email_change_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  old_email text,
  new_email text,
  changed_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid,
  reason text
);

create index if not exists email_change_audit_user_idx
  on public.email_change_audit(user_id);
create index if not exists email_change_audit_old_email_idx
  on public.email_change_audit(lower(old_email));
create index if not exists email_change_audit_new_email_idx
  on public.email_change_audit(lower(new_email));

alter table public.email_change_audit enable row level security;
-- No policies → only service role can read/write.

create or replace function public._log_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    insert into public.email_change_audit(user_id, old_email, new_email)
    values (new.id, old.email, new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists log_email_change on auth.users;
create trigger log_email_change
  after update of email on auth.users
  for each row
  execute function public._log_email_change();
