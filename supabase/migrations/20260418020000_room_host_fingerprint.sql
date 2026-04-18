-- Anonymous host tracking for Friends rooms.
--
-- Friends rooms are playable without an account. To enforce the
-- 1-room-per-UTC-day cap on free hosts without requiring login, we
-- set a long-lived httpOnly cookie on the device and store its uuid
-- in rooms.host_fingerprint. The daily-cap query counts rooms by
-- fingerprint over today's UTC window.
--
-- Pro users (when authenticated) bypass the cap via is_pro_active().

alter table public.rooms
  add column if not exists host_fingerprint text;

create index if not exists rooms_host_fingerprint_created_idx
  on public.rooms (host_fingerprint, created_at desc);
