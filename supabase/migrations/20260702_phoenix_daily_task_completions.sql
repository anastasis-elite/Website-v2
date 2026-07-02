create table if not exists public.phoenix_daily_task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  log_date date not null,
  task_id text not null check (char_length(task_id) between 1 and 80),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint phoenix_daily_task_completion_key unique (user_id, client_id, log_date, task_id)
);

create index if not exists phoenix_daily_tasks_client_date_idx
  on public.phoenix_daily_task_completions(client_id, log_date desc);

alter table public.phoenix_daily_task_completions enable row level security;

create policy "Clients can read their Phoenix task completions"
  on public.phoenix_daily_task_completions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Clients can insert their Phoenix task completions"
  on public.phoenix_daily_task_completions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Clients can delete their Phoenix task completions"
  on public.phoenix_daily_task_completions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Clients can update their Phoenix task completions"
  on public.phoenix_daily_task_completions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.phoenix_daily_task_completions to authenticated;
