alter table public.recovery_logs
  add column if not exists soreness_regions text[] not null default '{}';

notify pgrst, 'reload schema';
