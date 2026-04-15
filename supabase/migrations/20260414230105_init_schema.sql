-- Riffle initial schema
-- Anonymous + optional account. Daily, Solo, Rooms, Packs, Wagers, Streaks, Coins.

create extension if not exists "pgcrypto";

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  coin_balance integer not null default 100,
  xp integer not null default 0,
  level integer not null default 1,
  is_pro boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: public read" on public.profiles for select using (true);
create policy "profiles: self insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: self update" on public.profiles for update using (auth.uid() = id);

-- streaks
create table public.streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_play_date date,
  freezes_available integer not null default 1
);
alter table public.streaks enable row level security;
create policy "streaks: self read" on public.streaks for select using (auth.uid() = user_id);
create policy "streaks: self insert" on public.streaks for insert with check (auth.uid() = user_id);
create policy "streaks: self update" on public.streaks for update using (auth.uid() = user_id);

-- tracks catalog
create table public.tracks (
  id text primary key,
  source text not null,
  title text not null,
  artist text not null,
  album text,
  album_art_url text,
  preview_url text not null,
  duration_ms integer,
  genre_tags text[] not null default '{}',
  release_year integer,
  created_at timestamptz not null default now()
);
alter table public.tracks enable row level security;
create policy "tracks: public read" on public.tracks for select using (true);
create index tracks_genre_idx on public.tracks using gin (genre_tags);

-- packs (themed SEO landing pages)
create table public.packs (
  slug text primary key,
  name text not null,
  description text,
  cover_url text,
  accent_color text,
  is_premium boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.packs enable row level security;
create policy "packs: public read" on public.packs for select using (true);

create table public.pack_tracks (
  pack_slug text references public.packs(slug) on delete cascade,
  track_id text references public.tracks(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (pack_slug, track_id)
);
alter table public.pack_tracks enable row level security;
create policy "pack_tracks: public read" on public.pack_tracks for select using (true);

-- daily puzzles
create table public.daily_puzzles (
  puzzle_date date primary key,
  track_id text not null references public.tracks(id),
  pack_slug text references public.packs(slug),
  difficulty text not null default 'normal',
  stats jsonb not null default '{}'::jsonb
);
alter table public.daily_puzzles enable row level security;
create policy "daily_puzzles: public read" on public.daily_puzzles for select using (true);

-- daily results
create table public.daily_results (
  user_id uuid references public.profiles(id) on delete cascade,
  puzzle_date date references public.daily_puzzles(puzzle_date) on delete cascade,
  clip_level_guessed integer,
  correct boolean not null default false,
  time_ms integer not null default 0,
  score integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, puzzle_date)
);
alter table public.daily_results enable row level security;
create policy "daily_results: public read" on public.daily_results for select using (true);
create policy "daily_results: self insert" on public.daily_results for insert with check (auth.uid() = user_id);

-- rooms
create table public.rooms (
  code text primary key,
  host_id uuid references public.profiles(id),
  status text not null default 'lobby',
  mode text not null default 'wager',
  pack_slug text references public.packs(slug),
  rounds_total integer not null default 10,
  current_round integer not null default 0,
  starting_bank integer not null default 100,
  created_at timestamptz not null default now()
);
alter table public.rooms enable row level security;
create policy "rooms: public read" on public.rooms for select using (true);
create policy "rooms: public insert" on public.rooms for insert with check (true);
create policy "rooms: host update" on public.rooms for update using (host_id = auth.uid() or host_id is null);

create table public.room_players (
  room_code text references public.rooms(code) on delete cascade,
  user_id uuid,
  display_name text not null,
  bank integer not null default 100,
  correct_count integer not null default 0,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_code, display_name)
);
alter table public.room_players enable row level security;
create policy "room_players: public read" on public.room_players for select using (true);
create policy "room_players: public insert" on public.room_players for insert with check (true);
create policy "room_players: public update" on public.room_players for update using (true);

create table public.room_rounds (
  room_code text references public.rooms(code) on delete cascade,
  round_num integer,
  track_id text references public.tracks(id),
  wagers jsonb not null default '{}'::jsonb,
  guesses jsonb not null default '{}'::jsonb,
  revealed_at timestamptz,
  primary key (room_code, round_num)
);
alter table public.room_rounds enable row level security;
create policy "room_rounds: public read" on public.room_rounds for select using (true);
create policy "room_rounds: public insert" on public.room_rounds for insert with check (true);
create policy "room_rounds: public update" on public.room_rounds for update using (true);

-- achievements + coin ledger
create table public.achievements (
  user_id uuid references public.profiles(id) on delete cascade,
  key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.achievements enable row level security;
create policy "achievements: self read" on public.achievements for select using (auth.uid() = user_id);
create policy "achievements: self insert" on public.achievements for insert with check (auth.uid() = user_id);

create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.coin_transactions enable row level security;
create policy "coin_tx: self read" on public.coin_transactions for select using (auth.uid() = user_id);

-- realtime publication for rooms
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
alter publication supabase_realtime add table public.room_rounds;

-- bootstrap new users: create profile + streak row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Player'))
  on conflict (id) do nothing;

  insert into public.streaks (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
