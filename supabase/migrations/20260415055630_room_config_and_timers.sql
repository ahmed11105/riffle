-- Room config (category/artist selection) + server-stamped phase timers + pause.

alter table public.rooms
  add column if not exists genres text[] not null default '{}',
  add column if not exists artist_query text,
  add column if not exists phase_started_at timestamptz,
  add column if not exists paused boolean not null default false;
