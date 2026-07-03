alter table public.recovery_logs add column if not exists sleep_hours numeric;
alter table public.recovery_logs add column if not exists mood_level integer;
alter table public.recovery_logs add column if not exists hunger_level integer;
alter table public.recovery_logs add column if not exists notes text;
alter table public.recovery_logs add column if not exists daily_tasks jsonb not null default '[]'::jsonb;
alter table public.recovery_logs add column if not exists check_in_completed_at timestamptz;

create table if not exists public.recovery_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  log_date date not null default current_date,
  activity_type text not null,
  duration_minutes integer,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists recovery_activity_client_date_idx
  on public.recovery_activity_logs (client_id, log_date desc);

alter table public.recovery_activity_logs enable row level security;

create policy "Clients read own recovery activities"
  on public.recovery_activity_logs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Clients insert own recovery activities"
  on public.recovery_activity_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.recovery_activity_logs to authenticated;
