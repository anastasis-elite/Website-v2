create unique index if not exists recovery_logs_client_date_key
  on public.recovery_logs(client_id, log_date);

alter table public.recovery_logs enable row level security;

grant select, insert, update on public.recovery_logs to authenticated;

notify pgrst, 'reload schema';
