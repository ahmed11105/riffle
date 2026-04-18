-- Tighten RLS policies. The anon key is public (embedded in the client
-- bundle), so we must restrict what it can do.

-- daily_overrides: anon can read, only service_role can write.
drop policy if exists "daily_overrides_write" on public.daily_overrides;
create policy "daily_overrides_service_write" on public.daily_overrides
  for all using (true) with check (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
  );

-- rooms: anyone can read, anyone can insert (creating a room), only
-- the room's existence matters for joining.
alter table public.rooms enable row level security;
drop policy if exists "rooms_read" on public.rooms;
drop policy if exists "rooms_write" on public.rooms;
create policy "rooms_read" on public.rooms for select using (true);
create policy "rooms_insert" on public.rooms for insert with check (true);
create policy "rooms_update" on public.rooms for update using (true);

-- room_players: anyone can read, insert (joining), update their own row.
alter table public.room_players enable row level security;
drop policy if exists "room_players_read" on public.room_players;
drop policy if exists "room_players_write" on public.room_players;
create policy "room_players_read" on public.room_players for select using (true);
create policy "room_players_insert" on public.room_players for insert with check (true);
create policy "room_players_update" on public.room_players for update using (true);

-- room_rounds: anyone can read, insert, update (game state is shared).
alter table public.room_rounds enable row level security;
drop policy if exists "room_rounds_read" on public.room_rounds;
drop policy if exists "room_rounds_write" on public.room_rounds;
create policy "room_rounds_read" on public.room_rounds for select using (true);
create policy "room_rounds_insert" on public.room_rounds for insert with check (true);
create policy "room_rounds_update" on public.room_rounds for update using (true);
create policy "room_rounds_delete" on public.room_rounds for delete using (true);

-- tracks: anyone can read, server can insert/update (upsert from advance route).
alter table public.tracks enable row level security;
drop policy if exists "tracks_read" on public.tracks;
drop policy if exists "tracks_write" on public.tracks;
create policy "tracks_read" on public.tracks for select using (true);
create policy "tracks_write" on public.tracks for insert with check (true);
create policy "tracks_update" on public.tracks for update using (true);
