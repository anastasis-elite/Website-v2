create table if not exists public.workout_plan_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  feedback_date date not null default current_date,
  assigned_workout_id text not null,
  workout_title text,
  program text not null check (program in ('ember','ignite','phoenix')),
  response text not null check (response in ('love_it','looks_good','too_much_today','too_easy','not_feeling_workout')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_plan_feedback_daily unique (user_id, feedback_date, assigned_workout_id)
);

create index if not exists workout_feedback_client_date_idx
  on public.workout_plan_feedback (client_id, feedback_date desc);

alter table public.workout_plan_feedback enable row level security;
create policy "Clients read own workout feedback" on public.workout_plan_feedback
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Clients insert own workout feedback" on public.workout_plan_feedback
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Clients update own workout feedback" on public.workout_plan_feedback
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update on public.workout_plan_feedback to authenticated;
