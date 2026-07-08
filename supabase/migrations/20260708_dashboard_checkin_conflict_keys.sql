create unique index if not exists recovery_logs_client_date_key
  on public.recovery_logs(client_id, log_date);

create unique index if not exists cycle_logs_client_date_key
  on public.cycle_logs(client_id, log_date);
