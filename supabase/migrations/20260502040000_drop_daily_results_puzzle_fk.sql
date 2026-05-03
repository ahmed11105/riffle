-- daily_results.puzzle_date used to FK into daily_puzzles, but the
-- daily-puzzle scheduler was replaced by deterministic per-date
-- selection from the bundled NOW pool (with optional daily_overrides
-- for admin-curated days). The daily_puzzles table is now empty +
-- unused, and its lingering FK on daily_results was silently
-- rejecting every daily solve insert (23503 foreign-key violation),
-- which meant streaks never advanced and the daily_solve metric
-- never fired.
--
-- We keep the (user_id, puzzle_date) primary key on daily_results
-- (still the right uniqueness guarantee — one row per user per day).

alter table public.daily_results
  drop constraint if exists daily_results_puzzle_date_fkey;
