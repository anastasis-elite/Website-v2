-- Nullable by design: historical onset-only records cannot establish whether
-- a period is currently active. No existing history is rewritten or backfilled.
alter table public.cycle_logs
  add column if not exists period_status text
  check (period_status in ('active', 'ended'));

create index if not exists cycle_logs_explicit_period_status_idx
  on public.cycle_logs (client_id, auth_user_id, log_date desc)
  where period_status is not null;

notify pgrst, 'reload schema';
