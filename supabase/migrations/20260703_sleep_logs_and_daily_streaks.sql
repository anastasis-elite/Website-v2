create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  log_date date not null default current_date,
  duration_hours numeric not null check (duration_hours between 0 and 24),
  quality integer not null check (quality between 1 and 10),
  bedtime time,
  wake_time time,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id, log_date)
);

create index if not exists sleep_logs_client_date_idx on public.sleep_logs (client_id, log_date desc);
alter table public.sleep_logs enable row level security;

create policy "Clients read own sleep logs" on public.sleep_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy "Clients insert own sleep logs" on public.sleep_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Clients update own sleep logs" on public.sleep_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update on public.sleep_logs to authenticated;

create table if not exists public.daily_execution_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  log_date date not null default current_date,
  program text not null check (program in ('ember','ignite','phoenix')),
  capacity_status text not null,
  missed_day_count integer not null default 0,
  required_items jsonb not null default '{}'::jsonb,
  completed_items jsonb not null default '{}'::jsonb,
  completion_score integer not null check (completion_score between 0 and 100),
  streak_eligible boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, client_id, log_date)
);

create index if not exists daily_execution_client_date_idx on public.daily_execution_status (client_id, log_date desc);
alter table public.daily_execution_status enable row level security;
create policy "Clients read own daily execution" on public.daily_execution_status for select to authenticated using ((select auth.uid()) = user_id);
create policy "Clients insert own daily execution" on public.daily_execution_status for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Clients update own daily execution" on public.daily_execution_status for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.daily_execution_status to authenticated;
