alter table public.workout_logs
  add column if not exists workout_source text not null default 'recommended'
    check (workout_source in ('recommended', 'manual')),
  add column if not exists planned_exercises jsonb not null default '[]'::jsonb;

create index if not exists workout_logs_client_source_date_idx
  on public.workout_logs (client_id, workout_source, workout_date desc);
