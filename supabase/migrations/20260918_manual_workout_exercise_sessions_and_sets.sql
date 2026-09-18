create table if not exists public.workout_exercise_sessions (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs(id) on delete cascade,
  client_id text not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  exercise_name text not null,
  source text not null default 'manual' check (source in ('manual', 'recommended', 'programmed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_log_id, exercise_id, source)
);

create table if not exists public.workout_exercise_sets (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs(id) on delete cascade,
  exercise_session_id uuid not null references public.workout_exercise_sessions(id) on delete cascade,
  exercise_id text not null,
  set_number integer not null check (set_number >= 1),
  weight numeric not null default 0,
  weight_unit text not null default 'lb',
  reps integer not null default 0 check (reps >= 0),
  set_started_at timestamptz,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exercise_session_id, set_number)
);

create index if not exists workout_exercise_sessions_client_started_idx
  on public.workout_exercise_sessions (client_id, started_at desc);

create index if not exists workout_exercise_sets_session_number_idx
  on public.workout_exercise_sets (exercise_session_id, set_number);

alter table public.workout_exercise_sessions enable row level security;
alter table public.workout_exercise_sets enable row level security;

create policy "Clients read own workout exercise sessions"
  on public.workout_exercise_sessions for select to authenticated
  using ((select auth.uid()) = auth_user_id);

create policy "Clients insert own workout exercise sessions"
  on public.workout_exercise_sessions for insert to authenticated
  with check ((select auth.uid()) = auth_user_id);

create policy "Clients update own workout exercise sessions"
  on public.workout_exercise_sessions for update to authenticated
  using ((select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) = auth_user_id);

create policy "Clients read own workout exercise sets"
  on public.workout_exercise_sets for select to authenticated
  using (
    exists (
      select 1
      from public.workout_exercise_sessions session
      where session.id = workout_exercise_sets.exercise_session_id
        and session.auth_user_id = (select auth.uid())
    )
  );

create policy "Clients insert own workout exercise sets"
  on public.workout_exercise_sets for insert to authenticated
  with check (
    exists (
      select 1
      from public.workout_exercise_sessions session
      where session.id = workout_exercise_sets.exercise_session_id
        and session.auth_user_id = (select auth.uid())
    )
  );

create policy "Clients update own workout exercise sets"
  on public.workout_exercise_sets for update to authenticated
  using (
    exists (
      select 1
      from public.workout_exercise_sessions session
      where session.id = workout_exercise_sets.exercise_session_id
        and session.auth_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.workout_exercise_sessions session
      where session.id = workout_exercise_sets.exercise_session_id
        and session.auth_user_id = (select auth.uid())
    )
  );

create policy "Clients delete own workout exercise sets"
  on public.workout_exercise_sets for delete to authenticated
  using (
    exists (
      select 1
      from public.workout_exercise_sessions session
      where session.id = workout_exercise_sets.exercise_session_id
        and session.auth_user_id = (select auth.uid())
    )
  );

grant select, insert, update on public.workout_exercise_sessions to authenticated;
grant select, insert, update, delete on public.workout_exercise_sets to authenticated;
