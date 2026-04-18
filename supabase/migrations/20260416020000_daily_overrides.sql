-- Server-side daily overrides. When the admin pins a song to a specific
-- day via the admin dashboard, it goes here so every user sees the same
-- curated daily, not just the admin's device.
create table if not exists public.daily_overrides (
  day_key text primary key,            -- e.g. "2026-3-16" (year-month0idx-day)
  track_id text not null,
  title text not null,
  artist text not null,
  album text not null default '',
  album_art_url text not null default '',
  preview_url text not null,
  duration_ms integer not null default 0,
  release_year integer,
  created_at timestamptz not null default now()
);

-- Allow public reads (the daily page checks this table). Writes are
-- gated by the admin flag on the client, but we add an RLS policy that
-- allows inserts/updates/deletes from anon for now (v1 simplicity -
-- tighten once we have real auth).
alter table public.daily_overrides enable row level security;
create policy "daily_overrides_read" on public.daily_overrides for select using (true);
create policy "daily_overrides_write" on public.daily_overrides for all using (true) with check (true);
