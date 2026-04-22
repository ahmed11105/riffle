-- New clip-level ladder includes 0.5s. Existing int column can't
-- hold fractional values; switch to numeric(4,1) (0..999.9 with one
-- decimal place) which fits all current and planned levels.
alter table public.daily_results
  alter column clip_level_guessed type numeric(4,1)
  using clip_level_guessed::numeric(4,1);
