-- Adds a lobby-configurable toggle for whether tracks where the chosen
-- artist is only a featured performer count as valid rounds. Default off
-- (strict primary-artist matching) because it's too easy to get tripped up
-- by obscure hosts-of-features when the feature is the only reason the
-- track surfaced.
alter table public.rooms
  add column if not exists allow_featured_tracks boolean not null default false;
