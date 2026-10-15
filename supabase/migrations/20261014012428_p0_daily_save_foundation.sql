-- REVIEW ONLY: minimal daily foundation, not applied to production.
-- No customer backfills, historical updates, catalog seeds, or commerce provisioning.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

do $preflight$
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'Daily repair requires an approved administrator connection'; end if;
 if to_regclass('public.clients') is null or to_regclass('public.workout_logs') is null then raise exception 'Required daily base schema is absent'; end if;
 if not exists(select 1 from pg_attribute where attrelid='public.workout_logs'::regclass and attname='workout_date' and atttypid='date'::regtype and not attisdropped) then raise exception 'Review workout_date history type before applying daily repair'; end if;
end $preflight$;

create table if not exists public.client_current_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  injuries text[] not null default '{}',
  limitations text[] not null default '{}',
  equipment_access text[] not null default '{}',
  current_weight numeric,
  primary_goal text,
  workout_days_available integer check (workout_days_available between 0 and 7),
  workout_minutes_available integer check (workout_minutes_available between 0 and 300),
  updated_at timestamptz not null default now(),
  unique (client_id)
);
create table if not exists public.client_profile_change_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  field_name text not null,
  previous_value jsonb,
  new_value jsonb,
  source text not null default 'account_profile',
  changed_at timestamptz not null default now()
);
alter table public.client_current_profiles
  add column if not exists accountability_preferences jsonb not null default '{}'::jsonb,
  add column if not exists accountability_partner_persona jsonb,
  add column if not exists accountability_communication_profile jsonb,
  add column if not exists accountability_memory jsonb not null default '{}'::jsonb,
  add column if not exists accountability_behavior_summary jsonb not null default '{}'::jsonb,
  add column if not exists natal_profile jsonb,
  add column if not exists transit_context jsonb;

comment on column public.client_current_profiles.accountability_preferences is
  'User-stated accountability support preferences. Explicit preferences outrank natal-chart hypotheses.';

comment on column public.client_current_profiles.accountability_partner_persona is
  'Persistent AI accountability partner identity. Do not regenerate a new persona for each message.';

comment on column public.client_current_profiles.accountability_communication_profile is
  'Smoothed learned communication profile derived from preferences, behavior, and optional natal profile.';

comment on column public.client_current_profiles.accountability_memory is
  'Permitted continuity data such as goals, commitments, milestones, and successful support patterns.';

comment on column public.client_current_profiles.accountability_behavior_summary is
  'Aggregated behavioral response signals used to refine partner communication gradually.';

comment on column public.client_current_profiles.natal_profile is
  'Optional normalized natal-chart profile. Missing birth time must not fabricate ascendant or houses.';

comment on column public.client_current_profiles.transit_context is
  'Optional current astrology context for tone only. Must not override physiological, resilience, or safety logic.';

create index if not exists client_profile_history_client_time_idx on public.client_profile_change_history(client_id,changed_at desc);
alter table public.client_current_profiles enable row level security;
alter table public.client_profile_change_history enable row level security;
revoke all on public.client_current_profiles,public.client_profile_change_history from PUBLIC,anon,authenticated;
grant select,insert,update on public.client_current_profiles to authenticated;
grant select,insert on public.client_profile_change_history to authenticated;
grant all on public.client_current_profiles,public.client_profile_change_history to service_role;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='client_current_profiles' and policyname='p0 members select client_current_profiles') then
 create policy "p0 members select client_current_profiles" on public.client_current_profiles for select to authenticated using(user_id=(select auth.uid())) ;
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='client_current_profiles' and policyname='p0 members insert client_current_profiles') then
 create policy "p0 members insert client_current_profiles" on public.client_current_profiles for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=client_current_profiles.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='client_current_profiles' and policyname='p0 members update client_current_profiles') then
 create policy "p0 members update client_current_profiles" on public.client_current_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=client_current_profiles.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='client_profile_change_history' and policyname='p0 members select client_profile_change_history') then
 create policy "p0 members select client_profile_change_history" on public.client_profile_change_history for select to authenticated using(user_id=(select auth.uid())) ;
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='client_profile_change_history' and policyname='p0 members insert client_profile_change_history') then
 create policy "p0 members insert client_profile_change_history" on public.client_profile_change_history for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=client_profile_change_history.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;

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
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_plan_feedback' and policyname='Clients read own workout feedback') then
 create policy "Clients read own workout feedback" on public.workout_plan_feedback
  for select to authenticated using ((select auth.uid()) = user_id);
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_plan_feedback' and policyname='Clients insert own workout feedback') then
 create policy "Clients insert own workout feedback" on public.workout_plan_feedback
  for insert to authenticated with check ((select auth.uid()) = user_id);
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_plan_feedback' and policyname='Clients update own workout feedback') then
 create policy "Clients update own workout feedback" on public.workout_plan_feedback
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
 end if;
end $policy$;
grant select, insert, update on public.workout_plan_feedback to authenticated;

revoke all on public.workout_plan_feedback from PUBLIC,anon,authenticated;
grant select,insert,update on public.workout_plan_feedback to authenticated;
grant all on public.workout_plan_feedback to service_role;
alter table public.workout_logs
  add column if not exists workout_source text not null default 'recommended'
    check (workout_source in ('recommended', 'manual')),
  add column if not exists planned_exercises jsonb not null default '[]'::jsonb;

create index if not exists workout_logs_client_source_date_idx
  on public.workout_logs (client_id, workout_source, workout_date desc);

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

do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sessions' and policyname='Clients read own workout exercise sessions') then
 create policy "Clients read own workout exercise sessions"
  on public.workout_exercise_sessions for select to authenticated
  using ((select auth.uid()) = auth_user_id);
 end if;
end $policy$;

do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sessions' and policyname='Clients insert own workout exercise sessions') then
 create policy "Clients insert own workout exercise sessions"
  on public.workout_exercise_sessions for insert to authenticated
  with check ((select auth.uid()) = auth_user_id);
 end if;
end $policy$;

do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sessions' and policyname='Clients update own workout exercise sessions') then
 create policy "Clients update own workout exercise sessions"
  on public.workout_exercise_sessions for update to authenticated
  using ((select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) = auth_user_id);
 end if;
end $policy$;

do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sets' and policyname='Clients read own workout exercise sets') then
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
 end if;
end $policy$;

do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sets' and policyname='Clients insert own workout exercise sets') then
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
 end if;
end $policy$;

do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sets' and policyname='Clients update own workout exercise sets') then
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
 end if;
end $policy$;

do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sets' and policyname='Clients delete own workout exercise sets') then
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
 end if;
end $policy$;

grant select, insert, update on public.workout_exercise_sessions to authenticated;
grant select, insert, update, delete on public.workout_exercise_sets to authenticated;

revoke all on public.workout_exercise_sessions,public.workout_exercise_sets from PUBLIC,anon,authenticated;
grant select,insert,update on public.workout_exercise_sessions to authenticated;
grant select,insert,update,delete on public.workout_exercise_sets to authenticated;
grant all on public.workout_exercise_sessions,public.workout_exercise_sets to service_role;
create table if not exists public.client_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  block_type text not null check (block_type in
    ('sleep','work','school_dropoff','school_pickup','commute','appointment','other')),
  label text,
  days_of_week smallint[] not null default '{}',
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_schedule_blocks_client_idx
  on public.client_schedule_blocks(client_id,active);
create index if not exists client_schedule_blocks_user_idx
  on public.client_schedule_blocks(user_id);
alter table public.client_schedule_blocks enable row level security;
revoke all on table public.client_schedule_blocks from public,anon,authenticated;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='client_schedule_blocks' and policyname='members manage owned client commitments') then
 create policy "members manage owned client commitments"
  on public.client_schedule_blocks for all to authenticated
  using (
    user_id=(select auth.uid()) and exists (
      select 1 from public.clients c
      where c.client_id=client_schedule_blocks.client_id
        and c.auth_user_id=(select auth.uid())
    )
  )
  with check (
    user_id=(select auth.uid()) and exists (
      select 1 from public.clients c
      where c.client_id=client_schedule_blocks.client_id
        and c.auth_user_id=(select auth.uid())
    )
  );
 end if;
end $policy$;
grant select,insert,update,delete on public.client_schedule_blocks to authenticated;

-- SECURITY INVOKER preserves table RLS. The client row serializes replacements.
-- DELETE and INSERT are one function transaction; invalid inserts restore old blocks.
create or replace function public.replace_daily_commitments(p_client_id text,p_blocks jsonb)
returns void language plpgsql security invoker
set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform 1 from public.clients
    where client_id=p_client_id and auth_user_id=auth.uid() for update;
  if not found then raise exception 'Client not found'; end if;
  if jsonb_typeof(p_blocks) is distinct from 'array' then
    raise exception 'Invalid commitments';
  end if;
  if jsonb_array_length(p_blocks)>100 then raise exception 'Invalid commitments'; end if;
  delete from public.client_schedule_blocks
    where client_id=p_client_id and user_id=auth.uid();
  insert into public.client_schedule_blocks
    (user_id,client_id,block_type,label,days_of_week,start_time,end_time,active)
  select auth.uid(),p_client_id,block_type,label,days_of_week,
         start_time::time,end_time::time,true
  from jsonb_to_recordset(p_blocks) as x
    (block_type text,label text,days_of_week smallint[],start_time text,end_time text);
end
$$;
revoke all on function public.replace_daily_commitments(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.replace_daily_commitments(text,jsonb) to authenticated;

grant all on public.client_schedule_blocks to service_role;
-- Editing confirmed sets cannot leave a session empty after an insert failure.
create or replace function public.replace_workout_sets(p_session_id uuid, p_sets jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_session public.workout_exercise_sessions%rowtype;
begin
  select * into v_session from public.workout_exercise_sessions s
    where s.id=p_session_id and s.auth_user_id=auth.uid()
      and exists(select 1 from public.clients c where c.client_id=s.client_id and c.auth_user_id=auth.uid())
    for update;
  if not found then raise exception 'Session not found'; end if;
  if jsonb_typeof(p_sets) is distinct from 'array' then raise exception 'Invalid sets'; end if;
  if jsonb_array_length(p_sets)>100 then raise exception 'Invalid sets'; end if;
  delete from public.workout_exercise_sets where exercise_session_id = p_session_id;
  insert into public.workout_exercise_sets(workout_log_id,exercise_session_id,exercise_id,set_number,weight,weight_unit,reps,set_started_at,completed_at)
    select v_session.workout_log_id,p_session_id,v_session.exercise_id,set_number,weight,weight_unit,reps,set_started_at,completed_at
    from jsonb_to_recordset(p_sets) as x(set_number int,weight numeric,weight_unit text,reps int,set_started_at timestamptz,completed_at timestamptz);
end $$;
revoke all on function public.replace_workout_sets(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.replace_workout_sets(uuid,jsonb) to authenticated;

-- Restrictive writes bind auth ownership to the referenced client.
-- USING preserves the caller-owned legacy read visibility; no record is relabeled.
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='nutrition_logs' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.nutrition_logs as restrictive for all to authenticated using(auth_user_id=(select auth.uid())) with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=nutrition_logs.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='recovery_logs' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.recovery_logs as restrictive for all to authenticated using(auth_user_id=(select auth.uid())) with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=recovery_logs.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cycle_logs' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.cycle_logs as restrictive for all to authenticated using(auth_user_id=(select auth.uid())) with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=cycle_logs.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_logs' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.workout_logs as restrictive for all to authenticated using(auth_user_id=(select auth.uid())) with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=workout_logs.client_id and c.auth_user_id=(select auth.uid()) and (workout_logs.program is null or workout_logs.program=c.program)));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='measurement_logs' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.measurement_logs as restrictive for all to authenticated using(auth_user_id=(select auth.uid())) with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=measurement_logs.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='assessments' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.assessments as restrictive for all to authenticated using(auth_user_id=(select auth.uid())) with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=assessments.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='assessment_photos' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.assessment_photos as restrictive for all to authenticated using(auth_user_id=(select auth.uid())) with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=assessment_photos.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='client_symptom_logs' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.client_symptom_logs as restrictive for all to authenticated using(auth_user_id=(select auth.uid())) with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=client_symptom_logs.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='recurring_food_patterns' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.recurring_food_patterns as restrictive for all to authenticated using(auth_user_id=(select auth.uid())) with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=recurring_food_patterns.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='sleep_logs' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.sleep_logs as restrictive for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=sleep_logs.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='recovery_activity_logs' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.recovery_activity_logs as restrictive for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=recovery_activity_logs.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='daily_execution_status' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.daily_execution_status as restrictive for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=daily_execution_status.client_id and c.auth_user_id=(select auth.uid()) and (daily_execution_status.program is null or daily_execution_status.program=c.program)));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dashboard_daily_recommendations' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.dashboard_daily_recommendations as restrictive for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=dashboard_daily_recommendations.client_id and c.auth_user_id=(select auth.uid()) and (dashboard_daily_recommendations.program is null or dashboard_daily_recommendations.program=c.program)));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='phoenix_daily_task_completions' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.phoenix_daily_task_completions as restrictive for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=phoenix_daily_task_completions.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_plan_feedback' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.workout_plan_feedback as restrictive for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=workout_plan_feedback.client_id and c.auth_user_id=(select auth.uid()) and (workout_plan_feedback.program is null or workout_plan_feedback.program=c.program)));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='client_current_profiles' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.client_current_profiles as restrictive for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=client_current_profiles.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='client_profile_change_history' and policyname='p0 referenced client ownership') then
 create policy "p0 referenced client ownership" on public.client_profile_change_history as restrictive for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=client_profile_change_history.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sessions' and policyname='p0 workout parent ownership') then
 create policy "p0 workout parent ownership" on public.workout_exercise_sessions as restrictive for all to authenticated using(auth_user_id=(select auth.uid()) and exists(select 1 from public.workout_logs w where w.id=workout_exercise_sessions.workout_log_id and w.auth_user_id=(select auth.uid()) and w.client_id=workout_exercise_sessions.client_id)) with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.workout_logs w join public.clients c on c.client_id=w.client_id where w.id=workout_exercise_sessions.workout_log_id and w.auth_user_id=(select auth.uid()) and w.client_id=workout_exercise_sessions.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sets' and policyname='p0 set parent consistency') then
 create policy "p0 set parent consistency" on public.workout_exercise_sets as restrictive for all to authenticated using(exists(select 1 from public.workout_exercise_sessions s where s.id=workout_exercise_sets.exercise_session_id and s.auth_user_id=(select auth.uid()) and s.workout_log_id=workout_exercise_sets.workout_log_id and s.exercise_id=workout_exercise_sets.exercise_id)) with check(exists(select 1 from public.workout_exercise_sessions s join public.clients c on c.client_id=s.client_id where s.id=workout_exercise_sets.exercise_session_id and s.auth_user_id=(select auth.uid()) and s.workout_log_id=workout_exercise_sets.workout_log_id and s.exercise_id=workout_exercise_sets.exercise_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='meal_symptoms' and policyname='p0 meal symptom ownership') then
 create policy "p0 meal symptom ownership" on public.meal_symptoms as restrictive for all to authenticated using(exists(select 1 from public.meal_entries m join public.nutrition_logs n on n.id=m.nutrition_log_id join public.clients c on c.client_id=n.client_id where m.id=meal_symptoms.meal_entry_id and n.auth_user_id=(select auth.uid()) and c.auth_user_id=(select auth.uid()))) with check(exists(select 1 from public.meal_entries m join public.nutrition_logs n on n.id=m.nutrition_log_id join public.clients c on c.client_id=n.client_id where m.id=meal_symptoms.meal_entry_id and n.auth_user_id=(select auth.uid()) and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;

-- Restrict deletion independently so legacy caller-owned rows remain readable
-- while a mismatched referenced client cannot be changed through DELETE.
do $owned_delete$
declare v_table text;v_owner text;
begin
 for v_table,v_owner in select * from (values
  ('nutrition_logs','auth_user_id'),('recovery_logs','auth_user_id'),('cycle_logs','auth_user_id'),('workout_logs','auth_user_id'),
  ('measurement_logs','auth_user_id'),('assessments','auth_user_id'),('assessment_photos','auth_user_id'),('client_symptom_logs','auth_user_id'),
  ('recurring_food_patterns','auth_user_id'),('sleep_logs','user_id'),('recovery_activity_logs','user_id'),('daily_execution_status','user_id'),
  ('dashboard_daily_recommendations','user_id'),('phoenix_daily_task_completions','user_id'),('workout_plan_feedback','user_id'),
  ('client_current_profiles','user_id'),('client_profile_change_history','user_id')
 ) as owned(table_name,owner_column) loop
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=v_table and policyname='p0 delete client ownership') then
   execute format('create policy "p0 delete client ownership" on public.%I as restrictive for delete to authenticated using(%I=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=%I.client_id and c.auth_user_id=(select auth.uid())))',v_table,v_owner,v_table);
  end if;
 end loop;
end $owned_delete$;
do $policy$
begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sets' and policyname='p0 set delete ownership') then
  create policy "p0 set delete ownership" on public.workout_exercise_sets as restrictive for delete to authenticated
   using(exists(select 1 from public.workout_exercise_sessions s join public.clients c on c.client_id=s.client_id
    where s.id=workout_exercise_sets.exercise_session_id and s.auth_user_id=(select auth.uid()) and c.auth_user_id=(select auth.uid())
      and s.workout_log_id=workout_exercise_sets.workout_log_id and s.exercise_id=workout_exercise_sets.exercise_id));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='anastasis_schedule_events' and policyname='p0 schedule delete ownership') then
  create policy "p0 schedule delete ownership" on public.anastasis_schedule_events as restrictive for delete to authenticated
   using(user_id=(select auth.uid()) and (client_id is null or exists(select 1 from public.clients c
     where c.client_id=anastasis_schedule_events.client_id and c.auth_user_id=(select auth.uid()))));
 end if;
end $policy$;

alter table public.assessment_windows enable row level security;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='assessment_windows' and policyname='p0 members select assessment windows') then
 create policy "p0 members select assessment windows" on public.assessment_windows for select to authenticated using(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=assessment_windows.client_id and c.auth_user_id=(select auth.uid()))) ;
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='assessment_windows' and policyname='p0 members insert assessment windows') then
 create policy "p0 members insert assessment windows" on public.assessment_windows for insert to authenticated with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=assessment_windows.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='assessment_windows' and policyname='p0 members update assessment windows') then
 create policy "p0 members update assessment windows" on public.assessment_windows for update to authenticated using(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=assessment_windows.client_id and c.auth_user_id=(select auth.uid()))) with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=assessment_windows.client_id and c.auth_user_id=(select auth.uid())));
 end if;
end $policy$;
revoke all on public.assessment_windows from PUBLIC,anon,authenticated;
grant select,insert,update on public.assessment_windows to authenticated;
alter table public.program_outputs
  add column if not exists auth_user_id uuid references auth.users(id),
  add column if not exists program_json jsonb,
  add column if not exists status text;
alter table public.program_outputs enable row level security;
grant select, insert, update on public.program_outputs to authenticated;

-- Restrictive ownership applies even when a previous deployment has broader policies.
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='program_outputs' and policyname='member program ownership boundary') then
 create policy "member program ownership boundary" on public.program_outputs
  as restrictive for all to authenticated
  using (exists (
    select 1 from public.clients c
    where c.client_id = program_outputs.client_id
      and c.auth_user_id = (select auth.uid())
      and (program_outputs.auth_user_id is null or program_outputs.auth_user_id = (select auth.uid()))
  ))
  with check (program_outputs.auth_user_id = (select auth.uid()) and exists (
    select 1 from public.clients c
    where c.client_id = program_outputs.client_id
      and c.auth_user_id = (select auth.uid())
      and c.program = program_outputs.program
      and c.access is true and c.active is true
  ));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='program_outputs' and policyname='members read saved programs') then
 create policy "members read saved programs" on public.program_outputs
  for select to authenticated using (true);
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='program_outputs' and policyname='members save own programs') then
 create policy "members save own programs" on public.program_outputs
  for insert to authenticated with check (true);
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='program_outputs' and policyname='members update own programs') then
 create policy "members update own programs" on public.program_outputs
  for update to authenticated using (true) with check (true);
 end if;
end $policy$;


create or replace function public.protect_member_entitlements()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_field text;
begin
  if current_user in ('anon','authenticated') then
    if tg_op='INSERT' then raise exception 'Member entitlements must be provisioned by the server'; end if;
    foreach v_field in array array['client_id','auth_user_id','email','login_email','program','verified_purchase','access','active','subscription_status','subscription_started_at','subscription_ends_at'] loop
      if to_jsonb(new)->v_field is distinct from to_jsonb(old)->v_field then raise exception 'Member entitlement fields cannot be changed from the browser'; end if;
    end loop;
  end if;
  return new;
end $$;
create or replace trigger protect_member_entitlements before insert or update on public.clients for each row execute function public.protect_member_entitlements();
revoke execute on function public.protect_member_entitlements() from public,anon,authenticated,service_role;

-- Immutable recommendation/consent operations remain privileged server-only.
revoke all on public.recommendation_audit_logs,public.feature_consent_events from PUBLIC,anon,authenticated,service_role;
grant insert on public.recommendation_audit_logs to service_role;
grant select,insert on public.feature_consent_events to service_role;
revoke all on public.legal_acceptances from PUBLIC,anon,authenticated,service_role;
grant select,insert on public.legal_acceptances to service_role;

-- Preserve DATE history; only newly saved rows acquire a real session timestamp.
alter table public.workout_logs add column if not exists workout_started_at timestamptz;
create index if not exists workout_logs_client_started_idx on public.workout_logs(client_id,workout_started_at desc) where workout_started_at is not null;

create or replace function public.save_daily_workout(p_client_id text,p_day_start timestamptz,p_day_end timestamptz,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_client public.clients%rowtype;v_log public.workout_logs%rowtype;v_id uuid;v_keys jsonb;v_timestamp timestamptz;v_date date;v_zone text;v_state_zone text;v_state text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into v_client from public.clients where client_id=p_client_id and auth_user_id=auth.uid() for update;
 if not found then raise exception 'Client not found'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or p_payload->>'program' is distinct from v_client.program then raise exception 'Workout does not match your program'; end if;
 if p_payload->>'workout_source' is null or p_payload->>'workout_source' not in ('manual','recommended') then raise exception 'Invalid workout source'; end if;
 if nullif(p_payload->>'day_name','') is null or length(p_payload->>'day_name')>200 then raise exception 'Invalid workout name'; end if;
 if jsonb_typeof(p_payload->'exercise_logs') is distinct from 'array' then raise exception 'Invalid exercises'; end if;
 if jsonb_array_length(p_payload->'exercise_logs') not between 1 and 100 then raise exception 'Invalid exercises'; end if;
 if jsonb_typeof(p_payload->'planned_exercises') is distinct from 'array' then raise exception 'Invalid planned exercises'; end if;
 if jsonb_array_length(p_payload->'planned_exercises')>100 then raise exception 'Invalid planned exercises'; end if;
 if p_payload->>'workout_local_date' is null or p_payload->>'workout_local_date' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid workout local date'; end if;
 v_timestamp:=(p_payload->>'workout_date')::timestamptz;v_date:=(p_payload->>'workout_local_date')::date;
 if p_day_start is null or p_day_end is null or v_timestamp is null or not isfinite(p_day_start) or not isfinite(p_day_end) or not isfinite(v_timestamp) or p_day_end<=p_day_start or v_timestamp<p_day_start or v_timestamp>=p_day_end then raise exception 'Session date outside local day'; end if;
 v_state:=upper(coalesce(nullif(btrim(v_client.state),''),nullif(btrim(v_client.onboarding_data->>'state'),''),''));
 v_state_zone:=case
  when v_state='AK' then 'America/Anchorage'
  when v_state='AZ' then 'America/Phoenix'
  when v_state='HI' then 'Pacific/Honolulu'
  when v_state='IN' then 'America/Indiana/Indianapolis'
  when v_state in ('CA','NV','OR','WA') then 'America/Los_Angeles'
  when v_state in ('CO','ID','MT','NM','UT','WY') then 'America/Denver'
  when v_state in ('CT','DE','FL','GA','KY','MA','MD','ME','MI','NC','NH','NJ','NY','OH','PA','RI','SC','VA','VT','WV') then 'America/New_York'
  else 'America/Chicago' end;
 v_zone:=coalesce(nullif(v_client.timezone,''),nullif(v_client.onboarding_data->>'timezone',''),v_state_zone);
 if not exists(select 1 from pg_timezone_names where name=v_zone) then v_zone:=v_state_zone; end if;
 if (v_timestamp at time zone v_zone)::date is distinct from v_date or (p_day_start at time zone v_zone)::date is distinct from v_date or (p_day_start at time zone v_zone)::time is distinct from time '00:00' or (p_day_end at time zone v_zone)::date is distinct from v_date+1 or (p_day_end at time zone v_zone)::time is distinct from time '00:00' then raise exception 'Session date outside local day'; end if;
 select jsonb_agg(coalesce(item->>'session_key',coalesce(item->>'id',item->>'exercise',item->>'name')||':'||(position-1)::text) order by position)
 into v_keys from jsonb_array_elements(p_payload->'exercise_logs') with ordinality as exercises(item,position);
 select id into v_id from public.workout_logs where client_id=p_client_id and auth_user_id=auth.uid()
  and day_name=p_payload->>'day_name' and coalesce(workout_source,'recommended')=p_payload->>'workout_source'
  and ((workout_started_at is not null and workout_started_at>=p_day_start and workout_started_at<p_day_end) or (workout_started_at is null and workout_date=v_date))
  and (select jsonb_agg(coalesce(item->>'session_key',coalesce(item->>'id',item->>'exercise',item->>'name')||':'||(position-1)::text) order by position)
   from jsonb_array_elements(coalesce(exercise_logs,'[]'::jsonb)) with ordinality as exercises(item,position)) is not distinct from v_keys
  order by workout_started_at desc nulls last,updated_at desc nulls last,id limit 1;
 if v_id is null then
  insert into public.workout_logs(client_id,auth_user_id,program,day_name,workout_source,workout_date,workout_started_at,planned_exercises,exercise_logs,completed,updated_at)
  values(p_client_id,auth.uid(),v_client.program,p_payload->>'day_name',p_payload->>'workout_source',v_date,v_timestamp,p_payload->'planned_exercises',p_payload->'exercise_logs',coalesce((p_payload->>'completed')::boolean,false),now()) returning * into v_log;
 else
  update public.workout_logs set planned_exercises=p_payload->'planned_exercises',exercise_logs=p_payload->'exercise_logs',completed=coalesce((p_payload->>'completed')::boolean,false),updated_at=now()
  where id=v_id and auth_user_id=auth.uid() returning * into v_log;
 end if;
 return to_jsonb(v_log);
end $$;
revoke all on function public.save_daily_workout(text,timestamptz,timestamptz,jsonb) from PUBLIC,anon,authenticated,service_role;
grant execute on function public.save_daily_workout(text,timestamptz,timestamptz,jsonb) to authenticated;

-- Data API roles need bounded data operations, not DDL/whole-table capabilities.
revoke truncate,references,trigger,maintain on public.clients,public.nutrition_logs,public.recovery_logs,public.cycle_logs,public.workout_logs,
 public.measurement_logs,public.assessments,public.assessment_photos,public.client_symptom_logs,public.recurring_food_patterns,public.sleep_logs,
 public.recovery_activity_logs,public.daily_execution_status,public.dashboard_daily_recommendations,public.phoenix_daily_task_completions,
 public.workout_plan_feedback,public.client_current_profiles,public.client_profile_change_history,public.client_schedule_blocks,
 public.workout_exercise_sessions,public.workout_exercise_sets,public.meal_symptoms,public.program_outputs,public.assessment_windows,
 public.anastasis_schedule_events,public.macro_entries,public.meal_entries,public.foods,public.food_nutrients,public.food_serving_options,
 public.daily_health_metrics,public.health_samples,public.health_integrations,public.symptom_types,public.body_regions
 from PUBLIC,anon,authenticated;
notify pgrst,'reload schema';
commit;
