-- The tracks catalog needs to be writable by the server so the room advance
-- route can cache iTunes results before referencing them in room_rounds.
-- Without this policy, every upsert was silently failing and the FK from
-- room_rounds.track_id was breaking room creation entirely.

create policy "tracks: public insert" on public.tracks for insert with check (true);
create policy "tracks: public update" on public.tracks for update using (true);
