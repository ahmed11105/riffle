-- Seed starter themed packs. Empty pack_tracks for now, an admin can
-- populate them via /admin once the catalog has the right tracks.
-- Using ON CONFLICT DO NOTHING so re-running is safe.

insert into public.packs (slug, name, description, accent_color, is_premium, sort_order) values
  ('90s', '90s Hits',           'Decade-defining tracks from grunge to Britpop to first-wave R&B.', '#ec4899', false, 10),
  ('2000s-pop', '2000s Pop',    'Y2K pop, dance, and chart toppers from the iPod era.',             '#fbbf24', false, 20),
  ('hip-hop', 'Hip-Hop',         'From the golden age to today, beats and bars across the years.',  '#a855f7', false, 30),
  ('rock', 'Rock Classics',     'Stadium anthems, riff-driven monsters, and indie standards.',      '#dc2626', false, 40),
  ('uk-charts', 'UK Charts',    'Number ones from the British Official Charts.',                    '#2563eb', false, 50),
  ('movie-songs', 'Big Screen', 'Songs from soundtracks: closing credits, montages, montage memes.','#f59e0b', false, 60),
  ('one-hit-wonders', 'One-Hit Wonders', 'Tracks the world remembers, by artists most don''t.',     '#10b981', true,  70),
  ('cant-miss', 'Can''t-Miss Bangers', 'A premium pack of universally recognisable tracks.',        '#f97316', true,  80)
on conflict (slug) do nothing;
