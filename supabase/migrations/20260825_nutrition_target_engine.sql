alter table public.nutrition_logs
  add column if not exists formula_version text,
  add column if not exists calculation_mode text,
  add column if not exists calculation_status text,
  add column if not exists bmr_kcal numeric,
  add column if not exists estimated_tdee_kcal numeric,
  add column if not exists goal_adjusted_calories numeric,
  add column if not exists nutrition_calculation jsonb not null default '{}'::jsonb,
  add column if not exists calculated_at timestamptz;

do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'health_samples'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%active_energy%'
    and pg_get_constraintdef(c.oid) like '%body_fat_percentage%';

  if constraint_name is not null then
    execute format('alter table public.health_samples drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.health_samples
  add constraint health_samples_metric_type_check check (metric_type in (
    'sleep_duration',
    'sleep_stage',
    'resting_heart_rate',
    'heart_rate_variability',
    'respiratory_rate',
    'body_temperature',
    'steps',
    'active_energy',
    'resting_energy',
    'workout',
    'walking_running_distance',
    'body_weight',
    'body_fat_percentage'
  ));

do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'daily_health_metrics'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%active_energy%'
    and pg_get_constraintdef(c.oid) like '%body_fat_percentage%';

  if constraint_name is not null then
    execute format('alter table public.daily_health_metrics drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.daily_health_metrics
  add constraint daily_health_metrics_metric_type_check check (metric_type in (
    'sleep_duration',
    'sleep_stage',
    'resting_heart_rate',
    'heart_rate_variability',
    'respiratory_rate',
    'body_temperature',
    'steps',
    'active_energy',
    'resting_energy',
    'workout',
    'walking_running_distance',
    'body_weight',
    'body_fat_percentage'
  ));

create index if not exists nutrition_logs_calculation_mode_idx
  on public.nutrition_logs(client_id, log_date desc, calculation_mode);
