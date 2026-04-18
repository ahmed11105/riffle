-- Stripe webhook idempotency.
--
-- Stripe delivers events at-least-once. Without dedup, a retried
-- checkout.session.completed could grant Riffs twice. We record every
-- event id we successfully process; the webhook checks this table
-- before doing any work.
--
-- Service-role only, no RLS access from clients.

create table if not exists public.stripe_processed_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_processed_events enable row level security;

-- No client access. Inserts/reads happen only through the service-role
-- key in the webhook handler.
create policy "stripe_processed_events: deny" on public.stripe_processed_events
  for all using (false) with check (false);

create index if not exists stripe_processed_events_processed_at_idx
  on public.stripe_processed_events (processed_at desc);
