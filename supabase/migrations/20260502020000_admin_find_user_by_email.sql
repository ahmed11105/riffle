-- Lookup an auth.users row by email (current value). Used by the
-- admin email-rollback endpoint to find which user_id owns / once
-- owned a given address. SECURITY DEFINER so the admin server route
-- can call it via the service-role key without granting wide auth
-- schema access. Returns at most one row — emails on auth.users are
-- unique by index.

create or replace function public.admin_find_user_by_email(p_email text)
returns table(user_id uuid, email text, created_at timestamptz, is_anonymous boolean)
language sql
security definer
set search_path = public
as $$
  select id, email, created_at, is_anonymous
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;
$$;

-- This function is intentionally NOT granted to authenticated. Only
-- the service role (admin server) calls it.
revoke execute on function public.admin_find_user_by_email(text) from public;
revoke execute on function public.admin_find_user_by_email(text) from authenticated;
