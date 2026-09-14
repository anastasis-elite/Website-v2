alter table public.cycle_logs enable row level security;

grant select, insert, update on public.cycle_logs to authenticated;

notify pgrst, 'reload schema';
