-- ANASTASIS production schema repair review bundle — 2026-10-13.
-- NOT EXECUTED. This is an approval artifact, not a migration-history entry.
-- Run only after review and explicit authorization for this exact SQL.
-- Source algorithms/functions are reused; customer backfills and legacy column drops are omitted.
-- Public recipe/nutrient/supplement/config seeds INSERT missing rows only; no existing row is updated.
-- Source named policies/triggers remain in place; new restrictive boundaries close relational gaps.
-- Exact health CHECK widening is separately reviewable; it is intentionally excluded here.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $preflight$
begin
  if current_user not in ('postgres','supabase_admin') then raise exception 'Schema repair requires an approved database administrator connection'; end if;
  if to_regprocedure('gen_random_uuid()') is null then raise exception 'gen_random_uuid() is required'; end if;
  if not exists (select 1 from storage.buckets where id='assessment_photos' and public is false) then raise exception 'A private assessment_photos storage bucket must be configured before this repair'; end if;
  if to_regclass('public.clients') is null or to_regclass('public.foods') is null then raise exception 'Expected production base schema is missing'; end if;
end
$preflight$;

-- SOURCE: 20260703_workout_os_exercise_metadata.sql
-- SHA256: 7c151b7f893ee825680455fe2d5fdfd23732e21c80ac11d2558314971b4606db
create table if not exists public.exercise_metadata (
  id uuid primary key default gen_random_uuid(),
  exercise_key text not null unique,
  display_name text not null,
  movement_pattern text not null,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  skill_level text not null default 'beginner',
  mobility_requirement integer not null default 1 check (mobility_requirement between 1 and 5),
  balance_requirement integer not null default 1 check (balance_requirement between 1 and 5),
  structural_contraindications text[] not null default '{}',
  capacity_cost integer not null default 1 check (capacity_cost between 1 and 5),
  regression_options text[] not null default '{}',
  progression_options text[] not null default '{}',
  movement_tags text[] not null default '{}',
  universal_cues text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table public.exercise_metadata from public, anon, authenticated;
grant all on table public.exercise_metadata to service_role;


alter table public.exercise_metadata enable row level security;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='exercise_metadata' and policyname='Staff manage exercise metadata') then
    create policy "Staff manage exercise metadata" on public.exercise_metadata for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') in ('admin','coach')) with check ((select auth.jwt()->'app_metadata'->>'role') in ('admin','coach'));
  end if;
end
$source_policy$;

grant select,insert,update,delete on public.exercise_metadata to authenticated;

-- SOURCE: 20260703_workout_plan_feedback.sql
-- SHA256: 95d07c4343890d15cdc7a60f069b3d9c291328725836f62bc0a03e1ca3f918c2
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
revoke all on table public.workout_plan_feedback from public, anon, authenticated;
grant all on table public.workout_plan_feedback to service_role;



create index if not exists workout_feedback_client_date_idx
  on public.workout_plan_feedback (client_id, feedback_date desc);


alter table public.workout_plan_feedback enable row level security;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_plan_feedback' and policyname='Clients read own workout feedback') then
    create policy "Clients read own workout feedback" on public.workout_plan_feedback
  for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_plan_feedback' and policyname='Clients insert own workout feedback') then
    create policy "Clients insert own workout feedback" on public.workout_plan_feedback
  for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_plan_feedback' and policyname='Clients update own workout feedback') then
    create policy "Clients update own workout feedback" on public.workout_plan_feedback
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;

grant select, insert, update on public.workout_plan_feedback to authenticated;

-- SOURCE: 20260708_launch_readiness_profiles_payments_rls.sql
-- SHA256: 60ffdb653ba4f940895dac5090b1ddafd29be5fc116d3cfcc12723158f630893
-- Additive launch-readiness schema. Preserves onboarding and assessment history.

create table if not exists public.client_onboarding_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  snapshot jsonb not null,
  onboarding_version text not null default 'v1',
  created_at timestamptz not null default now(),
  unique (client_id, onboarding_version)
);
revoke all on table public.client_onboarding_snapshots from public, anon, authenticated;
grant all on table public.client_onboarding_snapshots to service_role;



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
revoke all on table public.client_current_profiles from public, anon, authenticated;
grant all on table public.client_current_profiles to service_role;



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
revoke all on table public.client_profile_change_history from public, anon, authenticated;
grant all on table public.client_profile_change_history to service_role;



create table if not exists public.client_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  block_type text not null check (block_type in ('sleep','work','school_dropoff','school_pickup','commute','appointment','other')),
  label text,
  days_of_week smallint[] not null default '{}',
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table public.client_schedule_blocks from public, anon, authenticated;
grant all on table public.client_schedule_blocks to service_role;



create table if not exists public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(client_id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  purpose text not null default 'create_login',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
revoke all on table public.client_invitations from public, anon, authenticated;
grant all on table public.client_invitations to service_role;



create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now(),
  client_id text,
  payload jsonb not null default '{}'
);
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;



create table if not exists public.api_request_events (
  id bigint generated always as identity primary key,
  scope text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);
revoke all on table public.api_request_events from public, anon, authenticated;
grant all on table public.api_request_events to service_role;



create unique index if not exists nutrition_logs_client_date_key on public.nutrition_logs(client_id, log_date);

create unique index if not exists recovery_logs_client_date_key on public.recovery_logs(client_id, log_date);

create unique index if not exists client_billing_client_key on public.client_billing(client_id);

create index if not exists client_profile_history_client_time_idx on public.client_profile_change_history(client_id, changed_at desc);

create index if not exists client_schedule_blocks_client_idx on public.client_schedule_blocks(client_id, active);

create index if not exists client_invitations_client_expiry_idx on public.client_invitations(client_id, expires_at desc);

create index if not exists api_request_events_lookup_idx on public.api_request_events(scope, key_hash, created_at desc);


alter table public.client_onboarding_snapshots enable row level security;

alter table public.client_current_profiles enable row level security;

alter table public.client_profile_change_history enable row level security;

alter table public.client_schedule_blocks enable row level security;

alter table public.client_invitations enable row level security;

alter table public.stripe_webhook_events enable row level security;

alter table public.api_request_events enable row level security;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_onboarding_snapshots' and policyname='clients read own onboarding snapshot') then
    create policy "clients read own onboarding snapshot" on public.client_onboarding_snapshots for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_onboarding_snapshots' and policyname='clients insert own onboarding snapshot') then
    create policy "clients insert own onboarding snapshot" on public.client_onboarding_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_current_profiles' and policyname='clients read own current profile') then
    create policy "clients read own current profile" on public.client_current_profiles for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_current_profiles' and policyname='clients insert own current profile') then
    create policy "clients insert own current profile" on public.client_current_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_current_profiles' and policyname='clients update own current profile') then
    create policy "clients update own current profile" on public.client_current_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_profile_change_history' and policyname='clients read own profile history') then
    create policy "clients read own profile history" on public.client_profile_change_history for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_profile_change_history' and policyname='clients insert own profile history') then
    create policy "clients insert own profile history" on public.client_profile_change_history for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_schedule_blocks' and policyname='clients manage own schedule') then
    create policy "clients manage own schedule" on public.client_schedule_blocks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;


grant select, insert on public.client_onboarding_snapshots to authenticated;

grant select on public.client_profile_change_history to authenticated;

grant select, insert, update on public.client_current_profiles to authenticated;

grant select, insert, update, delete on public.client_schedule_blocks to authenticated;

grant all on public.client_invitations, public.stripe_webhook_events to service_role;

grant all on public.api_request_events to service_role;


-- Secure launch-critical existing tables with their existing ownership columns.
alter table public.assessments enable row level security;

alter table public.nutrition_logs enable row level security;

alter table public.meal_entries enable row level security;

alter table public.recovery_logs enable row level security;

alter table public.workout_logs enable row level security;

alter table public.measurement_logs enable row level security;

alter table public.client_billing enable row level security;

alter table public.program_outputs enable row level security;

alter table public.client_weights enable row level security;

alter table public.assessment_windows enable row level security;

alter table public.food_log_items enable row level security;

alter table public.cycle_logs enable row level security;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='meal_entries' and policyname='clients read own meal entries') then
    create policy "clients read own meal entries" on public.meal_entries for select to authenticated using (exists (select 1 from public.nutrition_logs nl where nl.id = nutrition_log_id and nl.auth_user_id = (select auth.uid())));
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='meal_entries' and policyname='clients insert own meal entries') then
    create policy "clients insert own meal entries" on public.meal_entries for insert to authenticated with check (exists (select 1 from public.nutrition_logs nl where nl.id = nutrition_log_id and nl.auth_user_id = (select auth.uid())));
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='meal_entries' and policyname='clients delete own meal entries') then
    create policy "clients delete own meal entries" on public.meal_entries for delete to authenticated using (exists (select 1 from public.nutrition_logs nl where nl.id = nutrition_log_id and nl.auth_user_id = (select auth.uid())));
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='measurement_logs' and policyname='clients read own measurements') then
    create policy "clients read own measurements" on public.measurement_logs for select to authenticated using ((select auth.uid()) = auth_user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='measurement_logs' and policyname='clients insert own measurements') then
    create policy "clients insert own measurements" on public.measurement_logs for insert to authenticated with check ((select auth.uid()) = auth_user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='measurement_logs' and policyname='clients update own measurements') then
    create policy "clients update own measurements" on public.measurement_logs for update to authenticated using ((select auth.uid()) = auth_user_id) with check ((select auth.uid()) = auth_user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_billing' and policyname='clients read own billing') then
    create policy "clients read own billing" on public.client_billing for select to authenticated using (exists (select 1 from public.clients c where c.client_id = client_billing.client_id and c.auth_user_id = (select auth.uid())));
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_weights' and policyname='clients read own weights') then
    create policy "clients read own weights" on public.client_weights for select to authenticated using (exists (select 1 from public.clients c where c.client_id = client_weights.client_id and c.auth_user_id = (select auth.uid())));
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_weights' and policyname='clients insert own weights') then
    create policy "clients insert own weights" on public.client_weights for insert to authenticated with check (exists (select 1 from public.clients c where c.client_id = client_weights.client_id and c.auth_user_id = (select auth.uid())));
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assessment_windows' and policyname='clients read own assessment windows') then
    create policy "clients read own assessment windows" on public.assessment_windows for select to authenticated using ((select auth.uid()) = auth_user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assessment_windows' and policyname='clients update own assessment windows') then
    create policy "clients update own assessment windows" on public.assessment_windows for update to authenticated using ((select auth.uid()) = auth_user_id) with check ((select auth.uid()) = auth_user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='food_log_items' and policyname='clients read own food items') then
    create policy "clients read own food items" on public.food_log_items for select to authenticated using (exists (select 1 from public.clients c where c.id = food_log_items.client_id and c.auth_user_id = (select auth.uid())));
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='food_log_items' and policyname='clients insert own food items') then
    create policy "clients insert own food items" on public.food_log_items for insert to authenticated with check (exists (select 1 from public.clients c where c.id = food_log_items.client_id and c.auth_user_id = (select auth.uid())));
  end if;
end
$source_policy$;


grant select, insert, update on public.assessments, public.nutrition_logs, public.recovery_logs, public.workout_logs, public.measurement_logs to authenticated;

grant select, insert, delete on public.meal_entries to authenticated;

grant select on public.client_billing to authenticated;

grant select on public.program_outputs to authenticated;

grant select, insert on public.client_weights, public.food_log_items to authenticated;

grant select, update on public.assessment_windows to authenticated;

grant select, insert, update on public.cycle_logs to authenticated;


alter view public.nutrition_log_totals set (security_invoker = true);

alter view public.nutrition_log_totals_by_block set (security_invoker = true);

alter view public.nutrition_log_remaining set (security_invoker = true);

-- SOURCE: 20260728_workout_os_adaptive_foundation.sql
-- SHA256: 17f28a08addf4efb3df0dc375652aa9a2ebb766e9299695198b8d28da50cfbcb
alter table public.recovery_logs
  add column if not exists soreness_regions text[] not null default '{}';


alter table public.exercise_metadata
  add column if not exists muscle_contributions jsonb not null default '{}'::jsonb,
  add column if not exists recovery_profile text not null default 'moderate',
  add column if not exists eccentric_demand integer not null default 1,
  add column if not exists stabilization_demand integer not null default 1;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exercise_metadata_eccentric_demand_check'
      and conrelid = 'public.exercise_metadata'::regclass
  ) then
    alter table public.exercise_metadata
      add constraint exercise_metadata_eccentric_demand_check
      check (eccentric_demand between 1 and 5);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'exercise_metadata_stabilization_demand_check'
      and conrelid = 'public.exercise_metadata'::regclass
  ) then
    alter table public.exercise_metadata
      add constraint exercise_metadata_stabilization_demand_check
      check (stabilization_demand between 1 and 5);
  end if;
end $$;

-- SOURCE: 20260820_posture_photo_landmarks.sql
-- SHA256: 12e954253d8c2272d1413a7152c1430bbb77d25990984e67400e7c795910b387
-- Bucket creation omitted. The existing private assessment_photos bucket is a preflight prerequisite.



create table if not exists public.assessment_photos (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(client_id) on delete cascade,
  auth_user_id uuid not null,
  assessment_type text not null default 'progress',
  front_photo_url text,
  back_photo_url text,
  left_photo_url text,
  right_photo_url text,
  analysis_status text not null default 'pending',
  analysis_type text,
  posture_flags jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now()
);


alter table public.assessment_photos
  add column if not exists landmark_status text not null default 'not_started',
  add column if not exists landmark_metadata jsonb not null default '{}'::jsonb,
  add column if not exists posture_landmarks_confirmed_at timestamptz;


create index if not exists assessment_photos_client_uploaded_idx
  on public.assessment_photos(client_id, uploaded_at desc);


alter table public.assessment_photos enable row level security;


do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assessment_photos'
      and policyname = 'clients read own assessment photos'
  ) then
    create policy "clients read own assessment photos"
      on public.assessment_photos
      for select
      to authenticated
      using ((select auth.uid()) = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assessment_photos'
      and policyname = 'clients insert own assessment photos'
  ) then
    create policy "clients insert own assessment photos"
      on public.assessment_photos
      for insert
      to authenticated
      with check (
        (select auth.uid()) = auth_user_id
        and exists (
          select 1 from public.clients c
          where c.client_id = assessment_photos.client_id
            and c.auth_user_id = (select auth.uid())
            and (
              assessment_photos.assessment_type <> 'posture'
              or lower(coalesce(c.program, 'ignite')) in ('ignite', 'phoenix')
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assessment_photos'
      and policyname = 'clients update own assessment photos'
  ) then
    create policy "clients update own assessment photos"
      on public.assessment_photos
      for update
      to authenticated
      using ((select auth.uid()) = auth_user_id)
      with check ((select auth.uid()) = auth_user_id);
  end if;
end $$;


create table if not exists public.posture_photo_landmarks (
  id uuid primary key default gen_random_uuid(),
  assessment_photo_id uuid not null references public.assessment_photos(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  auth_user_id uuid not null,
  assessment_view text not null check (assessment_view in ('front', 'back', 'left', 'right')),
  landmark_name text not null,
  anatomical_side text not null check (anatomical_side in ('left', 'right', 'center')),
  automatic_x numeric check (automatic_x is null or (automatic_x >= 0 and automatic_x <= 1)),
  automatic_y numeric check (automatic_y is null or (automatic_y >= 0 and automatic_y <= 1)),
  confirmed_x numeric check (confirmed_x is null or (confirmed_x >= 0 and confirmed_x <= 1)),
  confirmed_y numeric check (confirmed_y is null or (confirmed_y >= 0 and confirmed_y <= 1)),
  detection_confidence numeric check (detection_confidence is null or (detection_confidence >= 0 and detection_confidence <= 1)),
  manually_adjusted boolean not null default false,
  visible boolean not null default true,
  low_confidence boolean not null default false,
  image_width integer,
  image_height integer,
  detection_status text,
  detection_metadata jsonb not null default '{}'::jsonb,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_photo_id, assessment_view, landmark_name)
);
revoke all on table public.posture_photo_landmarks from public, anon, authenticated;
grant all on table public.posture_photo_landmarks to service_role;



create index if not exists posture_photo_landmarks_client_photo_idx
  on public.posture_photo_landmarks(client_id, assessment_photo_id, assessment_view);


alter table public.posture_photo_landmarks enable row level security;


do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'posture_photo_landmarks'
      and policyname = 'clients read own posture landmarks'
  ) then
    create policy "clients read own posture landmarks"
      on public.posture_photo_landmarks
      for select
      to authenticated
      using ((select auth.uid()) = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'posture_photo_landmarks'
      and policyname = 'clients insert own posture landmarks'
  ) then
    create policy "clients insert own posture landmarks"
      on public.posture_photo_landmarks
      for insert
      to authenticated
      with check (
        (select auth.uid()) = auth_user_id
        and exists (
          select 1 from public.assessment_photos ap
          join public.clients c on c.client_id = ap.client_id
          where ap.id = posture_photo_landmarks.assessment_photo_id
            and ap.auth_user_id = (select auth.uid())
            and ap.client_id = posture_photo_landmarks.client_id
            and lower(coalesce(c.program, 'ignite')) in ('ignite', 'phoenix')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'posture_photo_landmarks'
      and policyname = 'clients update own posture landmarks'
  ) then
    create policy "clients update own posture landmarks"
      on public.posture_photo_landmarks
      for update
      to authenticated
      using ((select auth.uid()) = auth_user_id)
      with check (
        (select auth.uid()) = auth_user_id
        and exists (
          select 1 from public.clients c
          where c.client_id = posture_photo_landmarks.client_id
            and c.auth_user_id = (select auth.uid())
            and lower(coalesce(c.program, 'ignite')) in ('ignite', 'phoenix')
        )
      );
  end if;
end $$;


grant select, insert, update on public.assessment_photos to authenticated;

grant select, insert, update on public.posture_photo_landmarks to authenticated;


do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'clients upload own assessment photos'
  ) then
    create policy "clients upload own assessment photos"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'assessment_photos'
        and exists (
          select 1 from public.clients c
          where c.client_id = (storage.foldername(name))[1]
            and c.auth_user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'clients read own assessment photos'
  ) then
    create policy "clients read own assessment photos"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'assessment_photos'
        and exists (
          select 1 from public.clients c
          where c.client_id = (storage.foldername(name))[1]
            and c.auth_user_id = (select auth.uid())
        )
      );
  end if;
end $$;

-- SOURCE: 20260824_recipe_infrastructure.sql
-- SHA256: ffcf26beeefcd8aa49315a638b5b53098886b16f03b030bb579bb1cd5ddc33e1
create table if not exists public.recipes (
  id text primary key,
  title text not null,
  description text,
  image_url text,
  servings numeric not null default 1 check (servings > 0),
  prep_minutes integer not null default 0 check (prep_minutes >= 0),
  cook_minutes integer not null default 0 check (cook_minutes >= 0),
  total_minutes integer not null default 0 check (total_minutes >= 0),
  ingredients jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  calories integer not null default 0 check (calories >= 0),
  protein_g numeric not null default 0 check (protein_g >= 0),
  carbs_g numeric not null default 0 check (carbs_g >= 0),
  fat_g numeric not null default 0 check (fat_g >= 0),
  fiber_g numeric check (fiber_g is null or fiber_g >= 0),
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  tags text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  allergens text[] not null default '{}',
  cuisine text,
  difficulty text not null default 'easy' check (difficulty in ('easy','moderate')),
  substitutions jsonb not null default '[]'::jsonb,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table public.recipes from public, anon, authenticated;
grant all on table public.recipes to service_role;



create table if not exists public.client_recipe_favorites (
  client_id text not null references public.clients(client_id) on delete cascade,
  recipe_id text not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, recipe_id)
);
revoke all on table public.client_recipe_favorites from public, anon, authenticated;
grant all on table public.client_recipe_favorites to service_role;



alter table public.recipes enable row level security;

alter table public.client_recipe_favorites enable row level security;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='recipes' and policyname='Authenticated users can read active recipes') then
    create policy "Authenticated users can read active recipes"
  on public.recipes for select to authenticated
  using (active = true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_recipe_favorites' and policyname='Clients read own recipe favorites') then
    create policy "Clients read own recipe favorites"
  on public.client_recipe_favorites for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.client_id = client_recipe_favorites.client_id
        and c.auth_user_id = (select auth.uid())
    )
  );
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_recipe_favorites' and policyname='Clients insert own recipe favorites') then
    create policy "Clients insert own recipe favorites"
  on public.client_recipe_favorites for insert to authenticated
  with check (
    exists (
      select 1 from public.clients c
      where c.client_id = client_recipe_favorites.client_id
        and c.auth_user_id = (select auth.uid())
    )
  );
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_recipe_favorites' and policyname='Clients delete own recipe favorites') then
    create policy "Clients delete own recipe favorites"
  on public.client_recipe_favorites for delete to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.client_id = client_recipe_favorites.client_id
        and c.auth_user_id = (select auth.uid())
    )
  );
  end if;
end
$source_policy$;


grant select on public.recipes to authenticated;

grant select, insert, delete on public.client_recipe_favorites to authenticated;


alter table public.meal_entries
  add column if not exists recipe_id text references public.recipes(id),
  add column if not exists recipe_servings numeric check (recipe_servings is null or recipe_servings > 0);


insert into public.recipes (
  id,title,description,servings,prep_minutes,cook_minutes,total_minutes,ingredients,instructions,
  calories,protein_g,carbs_g,fat_g,fiber_g,meal_type,tags,dietary_tags,allergens,cuisine,difficulty,substitutions
) values
  (
    'protein-yogurt-berry-bowl','Protein Yogurt Berry Bowl','A fast breakfast with Greek yogurt, berries, oats, and seeds.',
    1,6,0,6,
    '[{"name":"Greek yogurt","quantity":"1 cup"},{"name":"Berries","quantity":"1 cup"},{"name":"Rolled oats","quantity":"1/3 cup"},{"name":"Chia seeds","quantity":"1 tbsp"}]'::jsonb,
    '["Add yogurt to a bowl.","Top with berries, oats, and chia.","Stir or leave layered."]'::jsonb,
    360,34,42,8,9,'breakfast',
    array['protein-forward','quick','no-cook'],array['vegetarian'],array['dairy'],'general','easy',
    '["Use dairy-free high-protein yogurt if needed."]'::jsonb
  ),
  (
    'chicken-rice-lunch-bowl','Chicken Rice Lunch Bowl','A practical lunch bowl built from chicken, rice, vegetables, and sauce.',
    1,10,5,15,
    '[{"name":"Cooked chicken breast","quantity":"5 oz"},{"name":"Cooked rice","quantity":"1 cup"},{"name":"Mixed vegetables","quantity":"1 cup"},{"name":"Olive oil or sauce","quantity":"1 tbsp"}]'::jsonb,
    '["Warm rice and vegetables.","Add chicken.","Finish with sauce and season to taste."]'::jsonb,
    520,44,58,14,6,'lunch',
    array['protein-forward','meal-prep','post-workout'],array[]::text[],array[]::text[],'general','easy',
    '[]'::jsonb
  ),
  (
    'turkey-potato-comfort-skillet','Turkey Potato Comfort Skillet','A warm dinner with lean turkey, potatoes, vegetables, and broth.',
    2,10,20,30,
    '[{"name":"Lean ground turkey","quantity":"12 oz"},{"name":"Diced potatoes","quantity":"2 cups"},{"name":"Frozen vegetables","quantity":"2 cups"},{"name":"Broth","quantity":"1/2 cup"}]'::jsonb,
    '["Brown turkey in a skillet.","Add potatoes and broth; cover until tender.","Stir in vegetables and season."]'::jsonb,
    455,35,46,15,7,'dinner',
    array['comfort','protein-forward','easy-dinner'],array[]::text[],array[]::text[],'general','easy',
    '[]'::jsonb
  ),
  (
    'cottage-cheese-crunch-plate','Cottage Cheese Crunch Plate','A snack plate with cottage cheese, fruit, and whole-grain crackers.',
    1,5,0,5,
    '[{"name":"Cottage cheese","quantity":"3/4 cup"},{"name":"Fruit","quantity":"1 serving"},{"name":"Whole-grain crackers","quantity":"1 serving"}]'::jsonb,
    '["Add cottage cheese to a bowl or plate.","Pair with fruit and crackers.","Season sweet or savory."]'::jsonb,
    310,28,34,8,5,'snack',
    array['snack','quick','protein-forward'],array['vegetarian'],array['dairy','gluten'],'general','easy',
    '["Use tuna, tofu dip, or hummus if avoiding dairy."]'::jsonb
  )
on conflict (id) do nothing;

-- SOURCE: 20260827_accountability_partner_engine.sql
-- SHA256: 64cc1a432396e5410c0920a1e27304d06c1882d2c999cc8b1ec5f106ef9b9322
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

-- SOURCE: 20260828_suggested_food_micronutrients.sql
-- SHA256: 42799a665dfdc93119cef41a60187f1021ad09ce27b1f5bd1388564158ca36b5
-- Suggested Foods can rank macros from the existing foods table immediately.
-- These nullable nutrient columns let the same scoring path use micronutrient
-- data when the food source has it, without changing target calculations.

alter table public.foods
  add column if not exists allergens text[] not null default '{}',
  add column if not exists fiber_g numeric check (fiber_g is null or fiber_g >= 0),
  add column if not exists sodium_mg numeric check (sodium_mg is null or sodium_mg >= 0),
  add column if not exists potassium_mg numeric check (potassium_mg is null or potassium_mg >= 0),
  add column if not exists magnesium_mg numeric check (magnesium_mg is null or magnesium_mg >= 0),
  add column if not exists calcium_mg numeric check (calcium_mg is null or calcium_mg >= 0),
  add column if not exists iron_mg numeric check (iron_mg is null or iron_mg >= 0),
  add column if not exists zinc_mg numeric check (zinc_mg is null or zinc_mg >= 0),
  add column if not exists selenium_mcg numeric check (selenium_mcg is null or selenium_mcg >= 0),
  add column if not exists choline_mg numeric check (choline_mg is null or choline_mg >= 0),
  add column if not exists vitamin_a_mcg numeric check (vitamin_a_mcg is null or vitamin_a_mcg >= 0),
  add column if not exists vitamin_c_mg numeric check (vitamin_c_mg is null or vitamin_c_mg >= 0),
  add column if not exists vitamin_d_mcg numeric check (vitamin_d_mcg is null or vitamin_d_mcg >= 0),
  add column if not exists vitamin_e_mg numeric check (vitamin_e_mg is null or vitamin_e_mg >= 0),
  add column if not exists vitamin_k_mcg numeric check (vitamin_k_mcg is null or vitamin_k_mcg >= 0),
  add column if not exists b1_mg numeric check (b1_mg is null or b1_mg >= 0),
  add column if not exists b2_mg numeric check (b2_mg is null or b2_mg >= 0),
  add column if not exists b3_mg numeric check (b3_mg is null or b3_mg >= 0),
  add column if not exists b5_mg numeric check (b5_mg is null or b5_mg >= 0),
  add column if not exists b6_mg numeric check (b6_mg is null or b6_mg >= 0),
  add column if not exists b9_mcg numeric check (b9_mcg is null or b9_mcg >= 0),
  add column if not exists b12_mcg numeric check (b12_mcg is null or b12_mcg >= 0);

-- SOURCE: 20260909_body_assessment_architecture.sql
-- SHA256: e57cb83a58b59725ee3de9b9c5990cbde31681c902397cedd508c34f5533e512
-- Additive Body Assessment architecture.
-- Raw measurement capture is separated from derived regional estimates.

create table if not exists public.body_assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  assessment_type text not null check (assessment_type in ('monthly', 'structural', 'full')),
  status text not null default 'draft' check (status in ('draft', 'completed', 'abandoned')),
  protocol_version text not null default 'body_assessment_protocol_v1',
  formula_version text not null default 'body_regional_estimate_v0.1.0',
  measurement_date date not null default current_date,
  scale_weight_lbs numeric,
  notes text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table public.body_assessment_sessions from public, anon, authenticated;
grant all on table public.body_assessment_sessions to service_role;



create table if not exists public.body_assessment_measurements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.body_assessment_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  measurement_group text not null check (measurement_group in ('regional_circumference', 'skinfold', 'structural_length', 'scale')),
  region text not null,
  side text check (side in ('left', 'right', 'midline')),
  site text,
  attempt_number integer not null default 1 check (attempt_number > 0),
  value numeric not null check (value > 0),
  unit text not null check (unit in ('in', 'cm', 'mm', 'lb', 'kg')),
  measurement_quality text not null default 'not_recorded' check (measurement_quality in ('high', 'moderate', 'low', 'not_recorded')),
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  tissue_pinch_quality text check (tissue_pinch_quality in ('easy', 'moderate', 'difficult', 'not_recorded')),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
revoke all on table public.body_assessment_measurements from public, anon, authenticated;
grant all on table public.body_assessment_measurements to service_role;



create table if not exists public.body_assessment_regional_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.body_assessment_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  region text not null,
  side text check (side in ('left', 'right', 'midline')),
  formula_version text not null,
  estimate_status text not null check (estimate_status in ('estimated', 'insufficient_data')),
  estimated_volume_liters numeric,
  estimated_subcutaneous_fat_mass_kg numeric,
  estimated_remaining_non_fat_mass_kg numeric,
  scale_weight_reconciliation jsonb not null default '{}'::jsonb,
  quality_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (session_id, region, side)
);
revoke all on table public.body_assessment_regional_results from public, anon, authenticated;
grant all on table public.body_assessment_regional_results to service_role;



create index if not exists body_assessment_sessions_client_date_idx
  on public.body_assessment_sessions (client_id, measurement_date desc, completed_at desc);

create index if not exists body_assessment_sessions_active_idx
  on public.body_assessment_sessions (client_id, status)
  where status = 'draft';

create index if not exists body_assessment_measurements_session_idx
  on public.body_assessment_measurements (session_id, measurement_group, region, side);

create index if not exists body_assessment_results_session_idx
  on public.body_assessment_regional_results (session_id, region, side);


alter table public.body_assessment_sessions enable row level security;

alter table public.body_assessment_measurements enable row level security;

alter table public.body_assessment_regional_results enable row level security;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_sessions' and policyname='clients read own body assessment sessions') then
    create policy "clients read own body assessment sessions"
  on public.body_assessment_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_sessions' and policyname='clients insert own body assessment sessions') then
    create policy "clients insert own body assessment sessions"
  on public.body_assessment_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_sessions' and policyname='clients update own body assessment sessions') then
    create policy "clients update own body assessment sessions"
  on public.body_assessment_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_measurements' and policyname='clients read own body assessment measurements') then
    create policy "clients read own body assessment measurements"
  on public.body_assessment_measurements for select to authenticated
  using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_measurements' and policyname='clients insert own body assessment measurements') then
    create policy "clients insert own body assessment measurements"
  on public.body_assessment_measurements for insert to authenticated
  with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_regional_results' and policyname='clients read own body assessment regional results') then
    create policy "clients read own body assessment regional results"
  on public.body_assessment_regional_results for select to authenticated
  using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_regional_results' and policyname='clients insert own body assessment regional results') then
    create policy "clients insert own body assessment regional results"
  on public.body_assessment_regional_results for insert to authenticated
  with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_regional_results' and policyname='clients update own body assessment regional results') then
    create policy "clients update own body assessment regional results"
  on public.body_assessment_regional_results for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;


grant select, insert, update on public.body_assessment_sessions to authenticated;

grant select, insert on public.body_assessment_measurements to authenticated;

grant select, insert, update on public.body_assessment_regional_results to authenticated;

-- SOURCE: 20260912_body_assessment_mass_conserving_results.sql
-- SHA256: b3eeae0c8bf04acca0783855d53ee2bc0f34b48fcbad38b54d9ada3c046361ed
-- Body Assessment mass-conserving composition results.
-- Raw historical measurements are not rewritten or backfilled here.

alter table public.body_assessment_regional_results
  add column if not exists raw_estimated_segment_mass_kg numeric,
  add column if not exists final_estimated_segment_mass_kg numeric,
  add column if not exists estimated_adipose_volume_liters numeric,
  add column if not exists estimated_non_adipose_volume_liters numeric,
  add column if not exists regional_fat_mass_percentage numeric,
  add column if not exists regional_mass_share numeric,
  add column if not exists regional_fat_distribution numeric,
  add column if not exists confidence text check (confidence is null or confidence in ('high', 'moderate', 'low', 'insufficient')),
  add column if not exists data_completeness numeric check (data_completeness is null or (data_completeness >= 0 and data_completeness <= 1));


create table if not exists public.body_assessment_composition_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.body_assessment_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  formula_version text not null,
  estimate_status text not null check (estimate_status in ('estimated', 'insufficient_data')),
  measured_body_weight_lbs numeric,
  measured_body_weight_kg numeric,
  modeled_raw_mass_kg numeric not null default 0,
  modeled_final_mass_kg numeric not null default 0,
  total_estimated_fat_mass_kg numeric,
  total_estimated_non_fat_mass_kg numeric,
  whole_body_fat_percentage numeric,
  unresolved_structural_mass_kg numeric,
  reconciliation_mass_kg numeric,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  quality_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (session_id)
);
revoke all on table public.body_assessment_composition_results from public, anon, authenticated;
grant all on table public.body_assessment_composition_results to service_role;



create index if not exists body_assessment_composition_results_session_idx
  on public.body_assessment_composition_results (session_id);

create index if not exists body_assessment_composition_results_client_date_idx
  on public.body_assessment_composition_results (client_id, created_at desc);


alter table public.body_assessment_composition_results enable row level security;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_composition_results' and policyname='clients read own body assessment composition results') then
    create policy "clients read own body assessment composition results"
  on public.body_assessment_composition_results for select to authenticated
  using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_composition_results' and policyname='clients insert own body assessment composition results') then
    create policy "clients insert own body assessment composition results"
  on public.body_assessment_composition_results for insert to authenticated
  with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_composition_results' and policyname='clients update own body assessment composition results') then
    create policy "clients update own body assessment composition results"
  on public.body_assessment_composition_results for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;


grant select, insert, update on public.body_assessment_composition_results to authenticated;

-- SOURCE: 20260914_menstrual_burden_physiology_patterns.sql
-- SHA256: 8d9898e7f764442a36a7944742e129614aa0b5609c764a04659096aa5e4749f6
-- Menstrual burden and non-diagnostic physiology pattern architecture.
-- Raw reproductive-health data is intentionally separated from calculated
-- burden scores, algorithmic wellness observations, and clinician-provided data.

alter table public.cycle_logs
  add column if not exists flow_burden_band text check (flow_burden_band in ('none','light','moderate','high','very_high')),
  add column if not exists flow_burden_score numeric,
  add column if not exists flow_burden_algorithm_version text;


create table if not exists public.menstrual_flow_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  log_date date not null default current_date,
  cycle_log_id uuid,
  cycle_day integer,
  cycle_phase text,
  bleeding_day integer,
  source text not null default 'member_entry' check (source in ('member_entry','clinician_entry','import')),
  raw_entry jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table public.menstrual_flow_logs from public, anon, authenticated;
grant all on table public.menstrual_flow_logs to service_role;



create table if not exists public.menstrual_product_logs (
  id uuid primary key default gen_random_uuid(),
  flow_log_id uuid not null references public.menstrual_flow_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  log_date date not null,
  product_type text not null check (product_type in ('tampon','pad','cup','disc','period_underwear','other')),
  absorbency text check (absorbency in ('light','regular','super','super_plus','ultra','heavy','overnight','moderate','custom')),
  quantity integer not null default 1 check (quantity > 0 and quantity <= 40),
  saturation text check (saturation in ('25','50','75','100','overflow')),
  estimated_ml numeric,
  empties integer,
  capacity_ml numeric,
  fullness text check (fullness in ('25','50','75','100','overflow')),
  change_interval_hours numeric,
  leak_or_overflow boolean not null default false,
  custom_label text,
  raw_entry jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
revoke all on table public.menstrual_product_logs from public, anon, authenticated;
grant all on table public.menstrual_product_logs to service_role;



create table if not exists public.cycle_daily_symptoms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  log_date date not null default current_date,
  cycle_log_id uuid,
  cycle_day integer,
  cycle_phase text,
  energy integer check (energy between 1 and 10),
  fatigue integer check (fatigue between 1 and 10),
  perceived_recovery integer check (perceived_recovery between 1 and 10),
  training_readiness integer check (training_readiness between 1 and 10),
  symptom_severity jsonb not null default '{}'::jsonb,
  numeric_scales jsonb not null default '{}'::jsonb,
  wearable_context jsonb not null default '{}'::jsonb,
  raw_entry jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id, log_date)
);
revoke all on table public.cycle_daily_symptoms from public, anon, authenticated;
grant all on table public.cycle_daily_symptoms to service_role;



create table if not exists public.cycle_burden_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  flow_log_id uuid references public.menstrual_flow_logs(id) on delete set null,
  log_date date not null,
  cycle_day integer,
  cycle_phase text,
  algorithm_version text not null,
  burden_score numeric not null check (burden_score >= 0),
  burden_band text not null check (burden_band in ('none','light','moderate','high','very_high')),
  normalized_factors jsonb not null default '{}'::jsonb,
  raw_data_refs jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, client_id, log_date)
);
revoke all on table public.cycle_burden_scores from public, anon, authenticated;
grant all on table public.cycle_burden_scores to service_role;



create table if not exists public.cycle_burden_trends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  algorithm_version text not null,
  cycles_analyzed integer not null default 0,
  typical_highest_flow_days integer[] not null default '{}',
  heavy_flow_window_days integer,
  energy_falls_on_high_flow_days boolean not null default false,
  readiness_falls_on_high_flow_days boolean not null default false,
  headache_window_days integer[] not null default '{}',
  baseline_score numeric,
  latest_cycle_deviation text not null default 'insufficient_data' check (latest_cycle_deviation in ('increased','decreased','stable','insufficient_data')),
  anticipatory_window jsonb,
  observations text[] not null default '{}',
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
revoke all on table public.cycle_burden_trends from public, anon, authenticated;
grant all on table public.cycle_burden_trends to service_role;



create table if not exists public.physiology_pattern_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  pattern_key text not null check (pattern_key in (
    'estrogen_associated',
    'progesterone_associated',
    'androgen_associated',
    'insulin_metabolic_associated',
    'stress_recovery_associated'
  )),
  classification text not null default 'algorithmic_wellness_observation_non_diagnostic',
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  contributing_domains text[] not null default '{}',
  supporting_observations jsonb not null default '[]'::jsonb,
  conflicting_observations jsonb not null default '[]'::jsonb,
  longitudinal_consistency text not null check (longitudinal_consistency in ('not_established','emerging','recurring','consistent')),
  date_first_observed timestamptz,
  date_last_evaluated timestamptz not null default now(),
  recommendation_effects jsonb not null default '[]'::jsonb,
  clinical_escalation_status text not null default 'none' check (clinical_escalation_status in ('none','watch','consider_follow_up')),
  algorithm_version text not null,
  suppressed_reason text,
  created_at timestamptz not null default now()
);
revoke all on table public.physiology_pattern_flags from public, anon, authenticated;
grant all on table public.physiology_pattern_flags to service_role;



create table if not exists public.physiology_pattern_evidence (
  id uuid primary key default gen_random_uuid(),
  pattern_flag_id uuid references public.physiology_pattern_flags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  pattern_key text not null,
  evidence_category text not null check (evidence_category in ('measured','self_reported','calculated','algorithmic_wellness_observation','clinician_provided')),
  domain text not null,
  direction text not null check (direction in ('supporting','conflicting')),
  strength text not null check (strength in ('low','moderate','high')),
  observation text not null,
  source_table text,
  source_record_id uuid,
  algorithm_version text not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
revoke all on table public.physiology_pattern_evidence from public, anon, authenticated;
grant all on table public.physiology_pattern_evidence to service_role;



create table if not exists public.pattern_recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  recommendation_date date not null default current_date,
  recommendation_area text not null check (recommendation_area in ('nutrition','recovery','readiness','training')),
  affected_item text,
  pattern_keys text[] not null default '{}',
  evidence_domains text[] not null default '{}',
  rule_version text not null,
  confidence_at_recommendation numeric,
  recommendation_effects jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
revoke all on table public.pattern_recommendation_events from public, anon, authenticated;
grant all on table public.pattern_recommendation_events to service_role;



create table if not exists public.pattern_response_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  response_date date not null default current_date,
  related_recommendation_event_id uuid references public.pattern_recommendation_events(id) on delete set null,
  response_category text not null check (response_category in ('symptom_change','energy_change','cycle_change','body_composition_change','recovery_change','member_feedback')),
  measured_data jsonb not null default '{}'::jsonb,
  self_reported_data jsonb not null default '{}'::jsonb,
  calculated_data jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
revoke all on table public.pattern_response_events from public, anon, authenticated;
grant all on table public.pattern_response_events to service_role;



create table if not exists public.clinical_observation_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  observation_date date not null default current_date,
  title text not null,
  classification text not null,
  measured_data jsonb not null default '{}'::jsonb,
  self_reported_data jsonb not null default '{}'::jsonb,
  calculated_data jsonb not null default '{}'::jsonb,
  algorithmic_wellness_observation jsonb not null default '{}'::jsonb,
  clinician_provided_data jsonb not null default '{}'::jsonb,
  clinical_interpretation text,
  algorithm_version text,
  source_pattern_flag_id uuid references public.physiology_pattern_flags(id) on delete set null,
  created_at timestamptz not null default now()
);
revoke all on table public.clinical_observation_records from public, anon, authenticated;
grant all on table public.clinical_observation_records to service_role;



create table if not exists public.clinical_follow_up_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  event_date date not null default current_date,
  event_type text not null check (event_type in ('menstrual_flow','physiology_pattern')),
  status text not null check (status in ('watch','consider_follow_up','dismissed')),
  reasons text[] not null default '{}',
  user_message text,
  algorithm_version text not null,
  source_table text,
  source_record_id uuid,
  created_at timestamptz not null default now()
);
revoke all on table public.clinical_follow_up_events from public, anon, authenticated;
grant all on table public.clinical_follow_up_events to service_role;



create table if not exists public.clinician_sharing_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  clinician_contact jsonb not null default '{}'::jsonb,
  preferred_clinician_specialty text,
  appointment_request_prompt_enabled boolean not null default false,
  authorized_to_contact_clinician boolean not null default false,
  authorized_to_share_health_summary boolean not null default false,
  authorization_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);
revoke all on table public.clinician_sharing_preferences from public, anon, authenticated;
grant all on table public.clinician_sharing_preferences to service_role;



create index if not exists menstrual_flow_logs_client_date_idx
  on public.menstrual_flow_logs (client_id, log_date desc);

create index if not exists menstrual_product_logs_flow_idx
  on public.menstrual_product_logs (flow_log_id, product_type);

create index if not exists cycle_daily_symptoms_client_date_idx
  on public.cycle_daily_symptoms (client_id, log_date desc);

create index if not exists cycle_burden_scores_client_date_idx
  on public.cycle_burden_scores (client_id, log_date desc);

create index if not exists cycle_burden_trends_client_date_idx
  on public.cycle_burden_trends (client_id, calculated_at desc);

create index if not exists physiology_pattern_flags_client_pattern_idx
  on public.physiology_pattern_flags (client_id, pattern_key, date_last_evaluated desc);

create index if not exists physiology_pattern_evidence_flag_idx
  on public.physiology_pattern_evidence (pattern_flag_id, domain);

create index if not exists pattern_recommendation_events_client_date_idx
  on public.pattern_recommendation_events (client_id, recommendation_date desc, recommendation_area);

create index if not exists clinical_follow_up_events_client_date_idx
  on public.clinical_follow_up_events (client_id, event_date desc, event_type);


alter table public.menstrual_flow_logs enable row level security;

alter table public.menstrual_product_logs enable row level security;

alter table public.cycle_daily_symptoms enable row level security;

alter table public.cycle_burden_scores enable row level security;

alter table public.cycle_burden_trends enable row level security;

alter table public.physiology_pattern_flags enable row level security;

alter table public.physiology_pattern_evidence enable row level security;

alter table public.pattern_recommendation_events enable row level security;

alter table public.pattern_response_events enable row level security;

alter table public.clinical_observation_records enable row level security;

alter table public.clinical_follow_up_events enable row level security;

alter table public.clinician_sharing_preferences enable row level security;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menstrual_flow_logs' and policyname='clients read own menstrual flow logs') then
    create policy "clients read own menstrual flow logs" on public.menstrual_flow_logs for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menstrual_flow_logs' and policyname='clients insert own menstrual flow logs') then
    create policy "clients insert own menstrual flow logs" on public.menstrual_flow_logs for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menstrual_flow_logs' and policyname='clients update own menstrual flow logs') then
    create policy "clients update own menstrual flow logs" on public.menstrual_flow_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menstrual_product_logs' and policyname='clients read own menstrual product logs') then
    create policy "clients read own menstrual product logs" on public.menstrual_product_logs for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menstrual_product_logs' and policyname='clients insert own menstrual product logs') then
    create policy "clients insert own menstrual product logs" on public.menstrual_product_logs for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cycle_daily_symptoms' and policyname='clients read own cycle daily symptoms') then
    create policy "clients read own cycle daily symptoms" on public.cycle_daily_symptoms for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cycle_daily_symptoms' and policyname='clients insert own cycle daily symptoms') then
    create policy "clients insert own cycle daily symptoms" on public.cycle_daily_symptoms for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cycle_daily_symptoms' and policyname='clients update own cycle daily symptoms') then
    create policy "clients update own cycle daily symptoms" on public.cycle_daily_symptoms for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cycle_burden_scores' and policyname='clients read own cycle burden scores') then
    create policy "clients read own cycle burden scores" on public.cycle_burden_scores for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cycle_burden_scores' and policyname='clients insert own cycle burden scores') then
    create policy "clients insert own cycle burden scores" on public.cycle_burden_scores for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cycle_burden_scores' and policyname='clients update own cycle burden scores') then
    create policy "clients update own cycle burden scores" on public.cycle_burden_scores for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cycle_burden_trends' and policyname='clients read own cycle burden trends') then
    create policy "clients read own cycle burden trends" on public.cycle_burden_trends for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cycle_burden_trends' and policyname='clients insert own cycle burden trends') then
    create policy "clients insert own cycle burden trends" on public.cycle_burden_trends for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='physiology_pattern_flags' and policyname='clients read own physiology pattern flags') then
    create policy "clients read own physiology pattern flags" on public.physiology_pattern_flags for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='physiology_pattern_flags' and policyname='clients insert own physiology pattern flags') then
    create policy "clients insert own physiology pattern flags" on public.physiology_pattern_flags for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='physiology_pattern_evidence' and policyname='clients read own physiology pattern evidence') then
    create policy "clients read own physiology pattern evidence" on public.physiology_pattern_evidence for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='physiology_pattern_evidence' and policyname='clients insert own physiology pattern evidence') then
    create policy "clients insert own physiology pattern evidence" on public.physiology_pattern_evidence for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pattern_recommendation_events' and policyname='clients read own pattern recommendation events') then
    create policy "clients read own pattern recommendation events" on public.pattern_recommendation_events for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pattern_recommendation_events' and policyname='clients insert own pattern recommendation events') then
    create policy "clients insert own pattern recommendation events" on public.pattern_recommendation_events for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pattern_response_events' and policyname='clients read own pattern response events') then
    create policy "clients read own pattern response events" on public.pattern_response_events for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pattern_response_events' and policyname='clients insert own pattern response events') then
    create policy "clients insert own pattern response events" on public.pattern_response_events for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinical_observation_records' and policyname='clients read own clinical observation records') then
    create policy "clients read own clinical observation records" on public.clinical_observation_records for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinical_observation_records' and policyname='clients insert own clinical observation records') then
    create policy "clients insert own clinical observation records" on public.clinical_observation_records for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinical_follow_up_events' and policyname='clients read own clinical follow up events') then
    create policy "clients read own clinical follow up events" on public.clinical_follow_up_events for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinical_follow_up_events' and policyname='clients insert own clinical follow up events') then
    create policy "clients insert own clinical follow up events" on public.clinical_follow_up_events for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinician_sharing_preferences' and policyname='clients read own clinician sharing preferences') then
    create policy "clients read own clinician sharing preferences" on public.clinician_sharing_preferences for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinician_sharing_preferences' and policyname='clients insert own clinician sharing preferences') then
    create policy "clients insert own clinician sharing preferences" on public.clinician_sharing_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinician_sharing_preferences' and policyname='clients update own clinician sharing preferences') then
    create policy "clients update own clinician sharing preferences" on public.clinician_sharing_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;


grant select, insert, update on public.menstrual_flow_logs to authenticated;

grant select, insert on public.menstrual_product_logs to authenticated;

grant select, insert, update on public.cycle_daily_symptoms to authenticated;

grant select, insert, update on public.cycle_burden_scores to authenticated;

grant select, insert on public.cycle_burden_trends to authenticated;

grant select, insert on public.physiology_pattern_flags to authenticated;

grant select, insert on public.physiology_pattern_evidence to authenticated;

grant select, insert on public.pattern_recommendation_events to authenticated;

grant select, insert on public.pattern_response_events to authenticated;

grant select, insert on public.clinical_observation_records to authenticated;

grant select, insert on public.clinical_follow_up_events to authenticated;

grant select, insert, update on public.clinician_sharing_preferences to authenticated;

-- SOURCE: 20260914_provenance_audit_privacy_hardening.sql
-- SHA256: 8e5316845c24d33e52155b1314d6491879d1c359f3de3a45367d51b4d38a7594
-- Hardening layer for provenance, recommendation auditability, and trusted clinician contact fields.
-- This migration only adds metadata columns to the existing menstrual physiology architecture.

alter table public.menstrual_flow_logs
  add column if not exists provenance_category text not null default 'self_reported'
    check (provenance_category in ('measured','self_reported','calculated','algorithmic_wellness_observation','clinician_provided','user_provided_lab'));


alter table public.menstrual_product_logs
  add column if not exists provenance_category text not null default 'measured'
    check (provenance_category in ('measured','self_reported','calculated','algorithmic_wellness_observation','clinician_provided','user_provided_lab'));


alter table public.cycle_daily_symptoms
  add column if not exists provenance_category text not null default 'self_reported'
    check (provenance_category in ('measured','self_reported','calculated','algorithmic_wellness_observation','clinician_provided','user_provided_lab'));


alter table public.cycle_burden_scores
  add column if not exists provenance_category text not null default 'calculated'
    check (provenance_category in ('measured','self_reported','calculated','algorithmic_wellness_observation','clinician_provided','user_provided_lab'));


alter table public.cycle_burden_trends
  add column if not exists provenance_category text not null default 'calculated'
    check (provenance_category in ('measured','self_reported','calculated','algorithmic_wellness_observation','clinician_provided','user_provided_lab'));


alter table public.physiology_pattern_flags
  add column if not exists provenance_category text not null default 'algorithmic_wellness_observation'
    check (provenance_category in ('measured','self_reported','calculated','algorithmic_wellness_observation','clinician_provided','user_provided_lab'));


alter table public.pattern_recommendation_events
  add column if not exists recommendation jsonb not null default '{}'::jsonb,
  add column if not exists formulation_rule_id text,
  add column if not exists algorithm_version text,
  add column if not exists user_response jsonb not null default '{}'::jsonb;


alter table public.clinical_follow_up_events
  add column if not exists provenance_category text not null default 'algorithmic_wellness_observation'
    check (provenance_category in ('measured','self_reported','calculated','algorithmic_wellness_observation','clinician_provided','user_provided_lab')),
  add column if not exists appointment_request_offered boolean not null default false,
  add column if not exists clinician_contact_authorized boolean not null default false,
  add column if not exists health_summary_share_authorized boolean not null default false;


alter table public.clinician_sharing_preferences
  add column if not exists clinician_name text,
  add column if not exists clinician_specialty text,
  add column if not exists clinician_practice text,
  add column if not exists clinician_email text,
  add column if not exists clinician_phone text,
  add column if not exists preferred_clinician boolean not null default false;

-- SOURCE: 20260915_manual_workout_source_and_planned_exercises.sql
-- SHA256: 6c967b365d703510e34a467723b054ef51ecdf8ec2a54f3c0b1ca79afb3f76f3
alter table public.workout_logs
  add column if not exists workout_source text not null default 'recommended'
    check (workout_source in ('recommended', 'manual')),
  add column if not exists planned_exercises jsonb not null default '[]'::jsonb;


create index if not exists workout_logs_client_source_date_idx
  on public.workout_logs (client_id, workout_source, workout_date desc);

-- SOURCE: 20260917_health_provenance_records.sql
-- SHA256: d0b7aabd944000d12fc9061f3e4c3c93fb164c247944b92e4d8e12f0dfd785d8
-- Minimal provenance ledger for health data that should remain separate from
-- algorithmic wellness observations, especially labs and clinician diagnoses.

create table if not exists public.health_provenance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  datum_date date,
  datum_kind text not null check (datum_kind in (
    'menstrual_product_log',
    'cycle_symptom',
    'flow_burden',
    'physiology_pattern',
    'lab_value',
    'medical_diagnosis',
    'medication_hrt_supplement',
    'body_measurement',
    'posture_assessment',
    'recovery_metric'
  )),
  provenance_category text not null check (provenance_category in (
    'measured',
    'self_reported',
    'calculated',
    'algorithmic_wellness_observation',
    'clinician_provided',
    'user_provided_lab'
  )),
  source_label text,
  source_table text,
  source_record_id uuid,
  datum_payload jsonb not null default '{}'::jsonb,
  may_influence_wellness_recommendations boolean not null default true,
  may_be_treated_as_diagnosis boolean not null default false,
  created_at timestamptz not null default now(),
  constraint labs_are_not_diagnoses check (
    datum_kind <> 'lab_value'
    or may_be_treated_as_diagnosis = false
  ),
  constraint diagnoses_are_clinician_provided check (
    datum_kind <> 'medical_diagnosis'
    or provenance_category = 'clinician_provided'
  ),
  constraint algorithmic_observations_are_not_diagnoses check (
    provenance_category <> 'algorithmic_wellness_observation'
    or may_be_treated_as_diagnosis = false
  )
);
revoke all on table public.health_provenance_records from public, anon, authenticated;
grant all on table public.health_provenance_records to service_role;



create index if not exists health_provenance_records_client_date_idx
  on public.health_provenance_records (client_id, datum_date desc, datum_kind);


alter table public.health_provenance_records enable row level security;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='health_provenance_records' and policyname='clients read own health provenance records') then
    create policy "clients read own health provenance records"
  on public.health_provenance_records for select to authenticated
  using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='health_provenance_records' and policyname='clients insert own health provenance records') then
    create policy "clients insert own health provenance records"
  on public.health_provenance_records for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.clients c
      where c.client_id = health_provenance_records.client_id
        and c.auth_user_id = (select auth.uid())
    )
  );
  end if;
end
$source_policy$;


grant select, insert on public.health_provenance_records to authenticated;

-- SOURCE: 20260918_manual_workout_exercise_sessions_and_sets.sql
-- SHA256: ccc6672775be2d79eec50e75178800b07590ac2f58f7e5b460f76d71e1ca318a
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
revoke all on table public.workout_exercise_sessions from public, anon, authenticated;
grant all on table public.workout_exercise_sessions to service_role;



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
revoke all on table public.workout_exercise_sets from public, anon, authenticated;
grant all on table public.workout_exercise_sets to service_role;



create index if not exists workout_exercise_sessions_client_started_idx
  on public.workout_exercise_sessions (client_id, started_at desc);


create index if not exists workout_exercise_sets_session_number_idx
  on public.workout_exercise_sets (exercise_session_id, set_number);


alter table public.workout_exercise_sessions enable row level security;

alter table public.workout_exercise_sets enable row level security;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sessions' and policyname='Clients read own workout exercise sessions') then
    create policy "Clients read own workout exercise sessions"
  on public.workout_exercise_sessions for select to authenticated
  using ((select auth.uid()) = auth_user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sessions' and policyname='Clients insert own workout exercise sessions') then
    create policy "Clients insert own workout exercise sessions"
  on public.workout_exercise_sessions for insert to authenticated
  with check ((select auth.uid()) = auth_user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sessions' and policyname='Clients update own workout exercise sessions') then
    create policy "Clients update own workout exercise sessions"
  on public.workout_exercise_sessions for update to authenticated
  using ((select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) = auth_user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sets' and policyname='Clients read own workout exercise sets') then
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
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sets' and policyname='Clients insert own workout exercise sets') then
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
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sets' and policyname='Clients update own workout exercise sets') then
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
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sets' and policyname='Clients delete own workout exercise sets') then
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
end
$source_policy$;


grant select, insert, update on public.workout_exercise_sessions to authenticated;

grant select, insert, update, delete on public.workout_exercise_sets to authenticated;

-- SOURCE: 20260919_nutrition_food_schema_alignment.sql
-- SHA256: 0df828661e48c3ea401502b8c673a3cac8c2dcf5455494b6b6898232147f2617
-- Align food logging with the normalized food catalog schema.
-- Canonical brand storage is public.foods.brand.
-- Canonical nutrition storage is public.food_nutrients per 100 grams.

alter table public.foods
  add column if not exists brand text,
  add column if not exists barcode text,
  add column if not exists barcode_format text,
  add column if not exists source text not null default 'catalog',
  add column if not exists client_id text references public.clients(client_id) on delete cascade,
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;


-- Legacy brand_name update/drop omitted: existing columns and data remain intact.

create unique index if not exists foods_barcode_unique_idx
  on public.foods (barcode)
  where barcode is not null;


create index if not exists foods_client_created_idx
  on public.foods (client_id, created_at desc)
  where client_id is not null;


alter table public.foods enable row level security;

alter table public.food_nutrients enable row level security;

alter table public.food_serving_options enable row level security;


grant select, insert on public.foods to authenticated;

grant select, insert on public.food_nutrients to authenticated;

grant select, insert on public.food_serving_options to authenticated;


do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'foods'
      and policyname = 'clients insert own custom foods'
  ) then
    create policy "clients insert own custom foods"
      on public.foods for insert to authenticated
      with check (
        (select auth.uid()) = auth_user_id
        and source in ('custom','barcode_custom','photo_estimate')
        and exists (
          select 1 from public.clients c
          where c.client_id = foods.client_id
            and c.auth_user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'food_nutrients'
      and policyname = 'clients insert nutrients for own custom foods'
  ) then
    create policy "clients insert nutrients for own custom foods"
      on public.food_nutrients for insert to authenticated
      with check (
        exists (
          select 1 from public.foods f
          where f.id = food_nutrients.food_id
            and f.auth_user_id = (select auth.uid())
            and f.source in ('custom','barcode_custom','photo_estimate')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'food_serving_options'
      and policyname = 'clients insert servings for own custom foods'
  ) then
    create policy "clients insert servings for own custom foods"
      on public.food_serving_options for insert to authenticated
      with check (
        exists (
          select 1 from public.foods f
          where f.id = food_serving_options.food_id
            and f.auth_user_id = (select auth.uid())
            and f.source in ('custom','barcode_custom','photo_estimate')
        )
      );
  end if;
end $$;


notify pgrst, 'reload schema';

-- SOURCE: 20260925_micronutrient_intelligence_layer.sql
-- SHA256: bf0c4b51c4d9315fde9ed438652f292ce358960e28dd6083d7cfaa7450d6a487
-- Micronutrient intelligence layer.
-- Reference data is separated from private member data. Clinical states remain
-- explicit member/clinician-entered records and are never inferred from symptoms.

create table if not exists public.nutrients (
  id uuid primary key default gen_random_uuid(),
  nutrient_key text not null unique,
  canonical_name text not null,
  aliases text[] not null default '{}',
  category text not null check (category in ('vitamin','mineral','other')),
  default_unit text not null,
  directly_provides_calories boolean not null default false,
  physiological_functions jsonb not null default '[]'::jsonb,
  energy_role_categories text[] not null default '{}',
  food_sources jsonb not null default '[]'::jsonb,
  absorption_enhancers jsonb not null default '[]'::jsonb,
  absorption_inhibitors jsonb not null default '[]'::jsonb,
  medication_interaction_metadata jsonb not null default '[]'::jsonb,
  increased_requirement_contexts jsonb not null default '[]'::jsonb,
  evidence_summary jsonb not null default '{}'::jsonb,
  last_evidence_review_date date,
  review_status text not null default 'needs_authoritative_review'
    check (review_status in ('needs_authoritative_review','partially_reviewed','reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table public.nutrients from public, anon, authenticated;
grant all on table public.nutrients to service_role;



create table if not exists public.nutrient_reference_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  title text not null,
  organization text,
  url text not null,
  source_type text not null check (source_type in ('government','national_academy','peer_reviewed','clinical_guideline','other')),
  publication_year integer,
  accessed_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
revoke all on table public.nutrient_reference_sources from public, anon, authenticated;
grant all on table public.nutrient_reference_sources to service_role;



create table if not exists public.nutrient_reference_values (
  id uuid primary key default gen_random_uuid(),
  nutrient_id uuid not null references public.nutrients(id) on delete cascade,
  reference_type text not null check (reference_type in ('rda','ai','ul','ear')),
  amount numeric not null check (amount >= 0),
  unit text not null,
  applies_to_intake_source text not null default 'total'
    check (applies_to_intake_source in ('total','supplemental','food','specific_form')),
  nutrient_form text,
  sex text not null default 'any' check (sex in ('female','male','any')),
  min_age_years numeric,
  max_age_years numeric,
  pregnancy_status text not null default 'not_applicable'
    check (pregnancy_status in ('not_applicable','not_pregnant','pregnant','lactating','any')),
  demographic_notes text,
  source_id uuid not null references public.nutrient_reference_sources(id),
  evidence_notes text,
  effective_date date,
  last_reviewed_at date,
  created_at timestamptz not null default now()
);
revoke all on table public.nutrient_reference_values from public, anon, authenticated;
grant all on table public.nutrient_reference_values to service_role;



create table if not exists public.nutrient_symptom_relationships (
  id uuid primary key default gen_random_uuid(),
  nutrient_id uuid not null references public.nutrients(id) on delete cascade,
  symptom_type_id uuid references public.symptom_types(id) on delete cascade,
  symptom_key text,
  relationship_type text not null check (relationship_type in (
    'inadequate_intake_association',
    'deficiency_association',
    'excessive_intake_association',
    'toxicity_association'
  )),
  evidence_strength text not null check (evidence_strength in ('low','moderate','high','authoritative')),
  source_id uuid not null references public.nutrient_reference_sources(id),
  notes text,
  applicable_context jsonb not null default '{}'::jsonb,
  last_reviewed_at date,
  created_at timestamptz not null default now(),
  check (symptom_type_id is not null or symptom_key is not null)
);
revoke all on table public.nutrient_symptom_relationships from public, anon, authenticated;
grant all on table public.nutrient_symptom_relationships to service_role;



create table if not exists public.nutrient_interactions (
  id uuid primary key default gen_random_uuid(),
  nutrient_id uuid not null references public.nutrients(id) on delete cascade,
  related_nutrient_id uuid not null references public.nutrients(id) on delete cascade,
  interaction_type text not null check (interaction_type in (
    'enhances_absorption',
    'reduces_absorption',
    'competes_for_absorption',
    'excessive_intake_may_affect',
    'metabolic_dependency',
    'timing_consideration'
  )),
  evidence_strength text not null check (evidence_strength in ('low','moderate','high','authoritative')),
  source_id uuid not null references public.nutrient_reference_sources(id),
  notes text,
  applicable_context jsonb not null default '{}'::jsonb,
  last_reviewed_at date,
  created_at timestamptz not null default now()
);
revoke all on table public.nutrient_interactions from public, anon, authenticated;
grant all on table public.nutrient_interactions to service_role;



create table if not exists public.nutrient_function_map (
  id uuid primary key default gen_random_uuid(),
  nutrient_id uuid not null references public.nutrients(id) on delete cascade,
  function_key text not null,
  function_label text not null,
  evidence_strength text not null check (evidence_strength in ('low','moderate','high','authoritative')),
  source_id uuid references public.nutrient_reference_sources(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (nutrient_id, function_key)
);
revoke all on table public.nutrient_function_map from public, anon, authenticated;
grant all on table public.nutrient_function_map to service_role;



create table if not exists public.supplements (
  id uuid primary key default gen_random_uuid(),
  supplement_key text not null unique,
  product_name text not null,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  positioning_summary text,
  serving_size text,
  evidence_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table public.supplements from public, anon, authenticated;
grant all on table public.supplements to service_role;



create table if not exists public.supplement_ingredients (
  id uuid primary key default gen_random_uuid(),
  supplement_id uuid not null references public.supplements(id) on delete cascade,
  ingredient_key text not null,
  ingredient_name text not null,
  amount_per_serving numeric check (amount_per_serving is null or amount_per_serving >= 0),
  unit text,
  ingredient_form text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (supplement_id, ingredient_key)
);
revoke all on table public.supplement_ingredients from public, anon, authenticated;
grant all on table public.supplement_ingredients to service_role;



create table if not exists public.ingredient_nutrients (
  id uuid primary key default gen_random_uuid(),
  supplement_ingredient_id uuid not null references public.supplement_ingredients(id) on delete cascade,
  nutrient_id uuid not null references public.nutrients(id),
  amount_per_serving numeric check (amount_per_serving is null or amount_per_serving >= 0),
  unit text,
  contribution_notes text,
  created_at timestamptz not null default now(),
  unique (supplement_ingredient_id, nutrient_id)
);
revoke all on table public.ingredient_nutrients from public, anon, authenticated;
grant all on table public.ingredient_nutrients to service_role;



create table if not exists public.supplement_supported_functions (
  id uuid primary key default gen_random_uuid(),
  supplement_id uuid not null references public.supplements(id) on delete cascade,
  function_key text not null,
  function_label text not null,
  support_summary text,
  created_at timestamptz not null default now(),
  unique (supplement_id, function_key)
);
revoke all on table public.supplement_supported_functions from public, anon, authenticated;
grant all on table public.supplement_supported_functions to service_role;



create table if not exists public.client_supplement_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  product_name text not null,
  brand text,
  serving_size text,
  frequency text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table public.client_supplement_products from public, anon, authenticated;
grant all on table public.client_supplement_products to service_role;



create table if not exists public.client_supplement_product_nutrients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  supplement_product_id uuid not null references public.client_supplement_products(id) on delete cascade,
  nutrient_id uuid not null references public.nutrients(id),
  amount_per_serving numeric not null check (amount_per_serving >= 0),
  unit text not null,
  nutrient_form text,
  source text not null default 'member_label_entry'
    check (source in ('member_label_entry','coach_entry','import','clinician_entry')),
  created_at timestamptz not null default now()
);
revoke all on table public.client_supplement_product_nutrients from public, anon, authenticated;
grant all on table public.client_supplement_product_nutrients to service_role;



create table if not exists public.client_supplement_intake_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  supplement_product_id uuid references public.client_supplement_products(id) on delete set null,
  log_date date not null default current_date,
  servings_consumed numeric not null default 1 check (servings_consumed >= 0),
  time_consumed time,
  notes text,
  created_at timestamptz not null default now()
);
revoke all on table public.client_supplement_intake_logs from public, anon, authenticated;
grant all on table public.client_supplement_intake_logs to service_role;



create table if not exists public.client_nutrient_clinical_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  nutrient_id uuid not null references public.nutrients(id),
  clinical_state text not null check (clinical_state in ('confirmed_deficiency','confirmed_toxicity')),
  record_date date not null default current_date,
  source_type text not null check (source_type in ('clinician_entry','lab_entry','medical_record_import')),
  source_label text,
  measured_data jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
revoke all on table public.client_nutrient_clinical_records from public, anon, authenticated;
grant all on table public.client_nutrient_clinical_records to service_role;



create table if not exists public.client_nutrient_intake_exposures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  nutrient_id uuid not null references public.nutrients(id),
  exposure_date date not null,
  food_amount numeric,
  supplement_amount numeric,
  total_amount numeric,
  unit text not null,
  calculation_status text not null default 'estimated'
    check (calculation_status in ('estimated','partial','complete','insufficient_data')),
  source_refs jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, client_id, nutrient_id, exposure_date)
);
revoke all on table public.client_nutrient_intake_exposures from public, anon, authenticated;
grant all on table public.client_nutrient_intake_exposures to service_role;



create table if not exists public.client_nutrient_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  nutrient_id uuid references public.nutrients(id) on delete set null,
  recommendation_date date not null default current_date,
  action text not null check (action in (
    'no_action',
    'food_first_recommendation',
    'monitor_pattern',
    'review_supplement_intake',
    'discuss_labs_with_clinician',
    'safety_warning_clinician_recommendation'
  )),
  status text not null default 'active' check (status in ('active','acted','dismissed','expired')),
  confidence_category text not null check (confidence_category in ('low_information','moderate_pattern','stronger_pattern','confirmed_clinical_data')),
  pattern_state text not null check (pattern_state in (
    'possible_inadequate_intake',
    'symptom_pattern_possibly_associated_with_inadequacy',
    'confirmed_deficiency',
    'possible_excessive_intake',
    'intake_above_established_ul',
    'possible_toxicity_pattern',
    'confirmed_toxicity',
    'none'
  )),
  user_message text not null,
  safety_escalation_reason text,
  signals_considered jsonb not null default '[]'::jsonb,
  evidence_relationships_used jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  algorithm_version text not null,
  acted_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);
revoke all on table public.client_nutrient_recommendations from public, anon, authenticated;
grant all on table public.client_nutrient_recommendations to service_role;



create index if not exists nutrients_category_idx on public.nutrients(category, nutrient_key);

create index if not exists nutrient_reference_values_lookup_idx on public.nutrient_reference_values(nutrient_id, reference_type, sex, min_age_years, max_age_years);

create index if not exists nutrient_symptom_relationships_lookup_idx on public.nutrient_symptom_relationships(nutrient_id, relationship_type);

create index if not exists nutrient_interactions_lookup_idx on public.nutrient_interactions(nutrient_id, related_nutrient_id, interaction_type);

create index if not exists nutrient_function_map_lookup_idx on public.nutrient_function_map(nutrient_id, function_key);

create index if not exists supplement_ingredients_supplement_idx on public.supplement_ingredients(supplement_id, display_order);

create index if not exists ingredient_nutrients_nutrient_idx on public.ingredient_nutrients(nutrient_id);

create index if not exists supplement_supported_functions_lookup_idx on public.supplement_supported_functions(supplement_id, function_key);

create index if not exists client_supplement_products_client_idx on public.client_supplement_products(client_id, created_at desc);

create index if not exists client_supplement_intake_logs_client_date_idx on public.client_supplement_intake_logs(client_id, log_date desc);

create index if not exists client_nutrient_exposures_client_date_idx on public.client_nutrient_intake_exposures(client_id, exposure_date desc, nutrient_id);

create index if not exists client_nutrient_recommendations_client_date_idx on public.client_nutrient_recommendations(client_id, recommendation_date desc, action);


alter table public.nutrients enable row level security;

alter table public.nutrient_reference_sources enable row level security;

alter table public.nutrient_reference_values enable row level security;

alter table public.nutrient_symptom_relationships enable row level security;

alter table public.nutrient_interactions enable row level security;

alter table public.nutrient_function_map enable row level security;

alter table public.supplements enable row level security;

alter table public.supplement_ingredients enable row level security;

alter table public.ingredient_nutrients enable row level security;

alter table public.supplement_supported_functions enable row level security;

alter table public.client_supplement_products enable row level security;

alter table public.client_supplement_product_nutrients enable row level security;

alter table public.client_supplement_intake_logs enable row level security;

alter table public.client_nutrient_clinical_records enable row level security;

alter table public.client_nutrient_intake_exposures enable row level security;

alter table public.client_nutrient_recommendations enable row level security;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nutrients' and policyname='authenticated read nutrient reference') then
    create policy "authenticated read nutrient reference" on public.nutrients for select to authenticated using (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nutrient_reference_sources' and policyname='authenticated read nutrient sources') then
    create policy "authenticated read nutrient sources" on public.nutrient_reference_sources for select to authenticated using (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nutrient_reference_values' and policyname='authenticated read nutrient reference values') then
    create policy "authenticated read nutrient reference values" on public.nutrient_reference_values for select to authenticated using (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nutrient_symptom_relationships' and policyname='authenticated read nutrient symptom relationships') then
    create policy "authenticated read nutrient symptom relationships" on public.nutrient_symptom_relationships for select to authenticated using (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nutrient_interactions' and policyname='authenticated read nutrient interactions') then
    create policy "authenticated read nutrient interactions" on public.nutrient_interactions for select to authenticated using (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nutrient_function_map' and policyname='authenticated read nutrient function map') then
    create policy "authenticated read nutrient function map" on public.nutrient_function_map for select to authenticated using (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='supplements' and policyname='authenticated read supplements') then
    create policy "authenticated read supplements" on public.supplements for select to authenticated using (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='supplement_ingredients' and policyname='authenticated read supplement ingredients') then
    create policy "authenticated read supplement ingredients" on public.supplement_ingredients for select to authenticated using (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ingredient_nutrients' and policyname='authenticated read ingredient nutrients') then
    create policy "authenticated read ingredient nutrients" on public.ingredient_nutrients for select to authenticated using (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='supplement_supported_functions' and policyname='authenticated read supplement supported functions') then
    create policy "authenticated read supplement supported functions" on public.supplement_supported_functions for select to authenticated using (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_supplement_products' and policyname='clients read own supplement products') then
    create policy "clients read own supplement products" on public.client_supplement_products for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_supplement_products' and policyname='clients insert own supplement products') then
    create policy "clients insert own supplement products" on public.client_supplement_products for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_supplement_products' and policyname='clients update own supplement products') then
    create policy "clients update own supplement products" on public.client_supplement_products for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_supplement_product_nutrients' and policyname='clients read own supplement product nutrients') then
    create policy "clients read own supplement product nutrients" on public.client_supplement_product_nutrients for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_supplement_product_nutrients' and policyname='clients insert own supplement product nutrients') then
    create policy "clients insert own supplement product nutrients" on public.client_supplement_product_nutrients for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_supplement_product_nutrients' and policyname='clients update own supplement product nutrients') then
    create policy "clients update own supplement product nutrients" on public.client_supplement_product_nutrients for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_supplement_intake_logs' and policyname='clients read own supplement intake logs') then
    create policy "clients read own supplement intake logs" on public.client_supplement_intake_logs for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_supplement_intake_logs' and policyname='clients insert own supplement intake logs') then
    create policy "clients insert own supplement intake logs" on public.client_supplement_intake_logs for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_supplement_intake_logs' and policyname='clients update own supplement intake logs') then
    create policy "clients update own supplement intake logs" on public.client_supplement_intake_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_nutrient_clinical_records' and policyname='clients read own nutrient clinical records') then
    create policy "clients read own nutrient clinical records" on public.client_nutrient_clinical_records for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_nutrient_clinical_records' and policyname='clients insert own nutrient clinical records') then
    create policy "clients insert own nutrient clinical records" on public.client_nutrient_clinical_records for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_nutrient_intake_exposures' and policyname='clients read own nutrient exposures') then
    create policy "clients read own nutrient exposures" on public.client_nutrient_intake_exposures for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_nutrient_intake_exposures' and policyname='clients insert own nutrient exposures') then
    create policy "clients insert own nutrient exposures" on public.client_nutrient_intake_exposures for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_nutrient_intake_exposures' and policyname='clients update own nutrient exposures') then
    create policy "clients update own nutrient exposures" on public.client_nutrient_intake_exposures for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_nutrient_recommendations' and policyname='clients read own nutrient recommendations') then
    create policy "clients read own nutrient recommendations" on public.client_nutrient_recommendations for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_nutrient_recommendations' and policyname='clients insert own nutrient recommendations') then
    create policy "clients insert own nutrient recommendations" on public.client_nutrient_recommendations for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_nutrient_recommendations' and policyname='clients update own nutrient recommendations') then
    create policy "clients update own nutrient recommendations" on public.client_nutrient_recommendations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;


grant select on public.nutrients, public.nutrient_reference_sources, public.nutrient_reference_values, public.nutrient_symptom_relationships, public.nutrient_interactions, public.nutrient_function_map, public.supplements, public.supplement_ingredients, public.ingredient_nutrients, public.supplement_supported_functions to authenticated;

grant select, insert, update on public.client_supplement_products, public.client_supplement_product_nutrients, public.client_supplement_intake_logs to authenticated;

grant select, insert on public.client_nutrient_clinical_records to authenticated;

grant select, insert, update on public.client_nutrient_intake_exposures, public.client_nutrient_recommendations to authenticated;


insert into public.nutrient_reference_sources (source_key, title, organization, url, source_type, publication_year, notes)
values
  ('nih_ods_iron_hp', 'Iron - Fact Sheet for Health Professionals', 'NIH Office of Dietary Supplements', 'https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/', 'government', null, 'Authoritative fact sheet for iron physiology, intake, safety, and interactions.'),
  ('nih_ods_zinc_hp', 'Zinc - Fact Sheet for Health Professionals', 'NIH Office of Dietary Supplements', 'https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/', 'government', null, 'Authoritative fact sheet for zinc physiology, intake, safety, and interactions.'),
  ('nih_ods_magnesium_hp', 'Magnesium - Fact Sheet for Health Professionals', 'NIH Office of Dietary Supplements', 'https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/', 'government', null, 'Authoritative fact sheet for magnesium physiology, intake, safety, and interactions.'),
  ('nam_dri_summary_tables', 'Dietary Reference Intakes Summary Tables', 'Food and Nutrition Board, National Academies', 'https://www.ncbi.nlm.nih.gov/books/NBK222881/', 'national_academy', null, 'DRI summary tables and UL definitions used as source metadata before numeric loading.')
on conflict (source_key) do nothing;


insert into public.nutrients (nutrient_key, canonical_name, aliases, category, default_unit, directly_provides_calories, review_status)
values
  ('vitamin_a', 'Vitamin A', array['retinol','retinyl esters','provitamin A carotenoids'], 'vitamin', 'mcg', false, 'needs_authoritative_review'),
  ('vitamin_c', 'Vitamin C', array['ascorbic acid'], 'vitamin', 'mg', false, 'partially_reviewed'),
  ('vitamin_d', 'Vitamin D', array['cholecalciferol','ergocalciferol'], 'vitamin', 'mcg', false, 'partially_reviewed'),
  ('vitamin_e', 'Vitamin E', array['alpha-tocopherol'], 'vitamin', 'mg', false, 'needs_authoritative_review'),
  ('vitamin_k', 'Vitamin K', array['phylloquinone','menaquinones'], 'vitamin', 'mcg', false, 'needs_authoritative_review'),
  ('b1', 'Thiamin', array['vitamin B1','thiamine'], 'vitamin', 'mg', false, 'needs_authoritative_review'),
  ('b2', 'Riboflavin', array['vitamin B2'], 'vitamin', 'mg', false, 'needs_authoritative_review'),
  ('b3', 'Niacin', array['vitamin B3','nicotinic acid','niacinamide'], 'vitamin', 'mg', false, 'needs_authoritative_review'),
  ('b5', 'Pantothenic acid', array['vitamin B5'], 'vitamin', 'mg', false, 'needs_authoritative_review'),
  ('b6', 'Vitamin B6', array['pyridoxine','pyridoxal','pyridoxamine'], 'vitamin', 'mg', false, 'needs_authoritative_review'),
  ('b7', 'Biotin', array['vitamin B7'], 'vitamin', 'mcg', false, 'needs_authoritative_review'),
  ('b9', 'Folate', array['vitamin B9','folic acid'], 'vitamin', 'mcg', false, 'needs_authoritative_review'),
  ('b12', 'Vitamin B12', array['cobalamin'], 'vitamin', 'mcg', false, 'needs_authoritative_review'),
  ('choline', 'Choline', array[]::text[], 'vitamin', 'mg', false, 'needs_authoritative_review'),
  ('calcium', 'Calcium', array[]::text[], 'mineral', 'mg', false, 'needs_authoritative_review'),
  ('chloride', 'Chloride', array[]::text[], 'mineral', 'mg', false, 'needs_authoritative_review'),
  ('chromium', 'Chromium', array[]::text[], 'mineral', 'mcg', false, 'needs_authoritative_review'),
  ('copper', 'Copper', array[]::text[], 'mineral', 'mcg', false, 'partially_reviewed'),
  ('iodine', 'Iodine', array[]::text[], 'mineral', 'mcg', false, 'needs_authoritative_review'),
  ('iron', 'Iron', array['heme iron','non-heme iron'], 'mineral', 'mg', false, 'partially_reviewed'),
  ('magnesium', 'Magnesium', array[]::text[], 'mineral', 'mg', false, 'partially_reviewed'),
  ('manganese', 'Manganese', array[]::text[], 'mineral', 'mg', false, 'needs_authoritative_review'),
  ('molybdenum', 'Molybdenum', array[]::text[], 'mineral', 'mcg', false, 'needs_authoritative_review'),
  ('phosphorus', 'Phosphorus', array['phosphate'], 'mineral', 'mg', false, 'needs_authoritative_review'),
  ('potassium', 'Potassium', array[]::text[], 'mineral', 'mg', false, 'needs_authoritative_review'),
  ('selenium', 'Selenium', array[]::text[], 'mineral', 'mcg', false, 'needs_authoritative_review'),
  ('sodium', 'Sodium', array[]::text[], 'mineral', 'mg', false, 'needs_authoritative_review'),
  ('zinc', 'Zinc', array[]::text[], 'mineral', 'mg', false, 'partially_reviewed')
on conflict (nutrient_key) do nothing;


with source_ids as (
  select source_key, id from public.nutrient_reference_sources
), nutrient_ids as (
  select nutrient_key, id from public.nutrients
)
insert into public.nutrient_function_map (nutrient_id, function_key, function_label, evidence_strength, source_id, notes)
select n.id, item.function_key, item.function_label, item.evidence_strength, s.id, item.notes
from (
  values
    ('magnesium','sleep','Sleep quality','moderate','nih_ods_magnesium_hp','Use only as contextual support when intake and sleep patterns recur together.'),
    ('magnesium','muscle_function','Muscle function','authoritative','nih_ods_magnesium_hp','Magnesium participates in normal muscle and nerve function.'),
    ('magnesium','nervous_system','Nervous system function','authoritative','nih_ods_magnesium_hp','Use common-language wellness copy; do not diagnose.'),
    ('iron','energy','Energy and oxygen transport','authoritative','nih_ods_iron_hp','Iron context can support food-first observation when intake, symptoms, and cycle burden align.'),
    ('iron','blood_oxygen','Blood and oxygen-related nutrition','authoritative','nih_ods_iron_hp','Escalate persistent concerning patterns to clinician discussion without diagnosing anemia.'),
    ('zinc','immune_function','Immune function','authoritative','nih_ods_zinc_hp','Useful as reference metadata for food-first or safety review patterns.'),
    ('vitamin_c','immune_function','Immune function','authoritative','nih_ods_iron_hp','Tracked as a related nutrition function and iron absorption context.'),
    ('calcium','muscle_function','Muscle function','moderate','nam_dri_summary_tables','Reference metadata only; avoid causal claims.')
) as item(nutrient_key, function_key, function_label, evidence_strength, source_key, notes)
join nutrient_ids n on n.nutrient_key = item.nutrient_key
left join source_ids s on s.source_key = item.source_key
on conflict (nutrient_id, function_key) do nothing;


alter table public.supplements
  add column if not exists product_url text,
  add column if not exists recommendation_copy text,
  add column if not exists disclaimer_copy text,
  add column if not exists contraindication_metadata jsonb not null default '{}'::jsonb,
  add column if not exists minimum_matching_requirements jsonb not null default '{}'::jsonb,
  add column if not exists recommendation_category text;



with supplement_rows as (
  insert into public.supplements (supplement_key, product_name, status, positioning_summary, serving_size, evidence_notes,recommendation_category,recommendation_copy,disclaimer_copy,contraindication_metadata,minimum_matching_requirements)
  values (
    'anastasis_sleep_support',
    'Anastasis Sleep Support',
    'active',
    'Supports sleep routines when nutrient intake patterns and sleep experience align.',
    'See product label',
    'Eligibility must require longitudinal nutrient patterns plus matching sleep experience.',
    'sleep_support',
    'Your recent food logs show that you have not consistently been getting foods that provide several nutrients involved in sleep support. Your sleep quality has also been lower during this period. Anastasis Sleep Support contains nutrients that can help supplement what you are getting through food.',
    'This recommendation is based on your logged nutrition and wellness patterns and does not identify or diagnose a nutrient deficiency.',
    '{"suppressWhen":["pregnancy_or_breastfeeding","medication_interaction_concern","diagnosed_condition_concern"],"ingredientAllergens":[],"upperIntakeConcernNutrients":["magnesium"]}'::jsonb,
    '{"minRecurringNutrients":1,"minFunctionalCategories":1}'::jsonb
  )
  on conflict (supplement_key) do nothing
  returning id
), magnesium as (
  select id from public.nutrients where nutrient_key = 'magnesium'
), ingredient_rows as (
  insert into public.supplement_ingredients (supplement_id, ingredient_key, ingredient_name, amount_per_serving, unit, ingredient_form, display_order)
  select supplement_rows.id, 'magnesium', 'Magnesium', null, 'mg', null, 10
  from supplement_rows
  on conflict (supplement_id, ingredient_key) do nothing
  returning id
)
insert into public.ingredient_nutrients (supplement_ingredient_id, nutrient_id, amount_per_serving, unit, contribution_notes)
select ingredient_rows.id, magnesium.id, null, 'mg', 'Product nutrient contribution is label-driven; recommendation logic matches function and pattern, not dosage advice.'
from ingredient_rows, magnesium
on conflict (supplement_ingredient_id, nutrient_id) do nothing;


alter table public.supplements
  add column if not exists product_url text,
  add column if not exists recommendation_copy text,
  add column if not exists disclaimer_copy text,
  add column if not exists contraindication_metadata jsonb not null default '{}'::jsonb,
  add column if not exists minimum_matching_requirements jsonb not null default '{}'::jsonb,
  add column if not exists recommendation_category text;



with supplement_rows as (
  select id from public.supplements where supplement_key = 'anastasis_sleep_support'
)
insert into public.supplement_supported_functions (supplement_id, function_key, function_label, support_summary)
select id, 'sleep', 'Sleep quality', 'Matched only when sleep experience and longitudinal nutrient pattern both support eligibility.'
from supplement_rows
on conflict (supplement_id, function_key) do nothing;


with source_ids as (
  select source_key, id from public.nutrient_reference_sources
), nutrient_ids as (
  select nutrient_key, id from public.nutrients
)
insert into public.nutrient_interactions (nutrient_id, related_nutrient_id, interaction_type, evidence_strength, source_id, notes, applicable_context, last_reviewed_at)
select n1.id, n2.id, item.interaction_type, item.evidence_strength, s.id, item.notes, item.context::jsonb, current_date
from (
  values
    ('vitamin_c','iron','enhances_absorption','authoritative','nih_ods_iron_hp','Vitamin C is tracked as a contextual enhancer for non-heme iron absorption; wording must avoid implying treatment.', '{"form":"non_heme_iron","recommendation_boundary":"food_context_only"}'),
    ('calcium','iron','timing_consideration','moderate','nih_ods_iron_hp','Calcium and iron supplement timing can be considered when reviewing supplement intake; this does not diagnose low iron.', '{"source":"supplement_timing"}'),
    ('zinc','copper','excessive_intake_may_affect','authoritative','nih_ods_zinc_hp','Excessive or prolonged zinc supplement intake can affect copper status; use for safety review and clinician escalation.', '{"source":"supplemental_or_denture_adhesive"}'),
    ('magnesium','vitamin_d','metabolic_dependency','moderate','nih_ods_magnesium_hp','Magnesium and vitamin D physiology may be contextually related; do not infer deficiency from this interaction alone.', '{"recommendation_boundary":"context_only"}')
) as item(nutrient_key, related_nutrient_key, interaction_type, evidence_strength, source_key, notes, context)
join nutrient_ids n1 on n1.nutrient_key = item.nutrient_key
join nutrient_ids n2 on n2.nutrient_key = item.related_nutrient_key
join source_ids s on s.source_key = item.source_key
on conflict do nothing;


notify pgrst, 'reload schema';

-- SOURCE: 20260925_supplement_recommendation_engine_v1.sql
-- SHA256: da4dbb03bf3231cd86f08c3bb88b93a0c5b7bed86c13c0bc3f6eb08adc988a2f
-- Anastasis supplement recommendation engine V1.
-- Deterministic, conservative, non-clinical product eligibility layer.

alter table public.supplements
  add column if not exists product_url text,
  add column if not exists recommendation_copy text,
  add column if not exists disclaimer_copy text,
  add column if not exists contraindication_metadata jsonb not null default '{}'::jsonb,
  add column if not exists minimum_matching_requirements jsonb not null default '{}'::jsonb,
  add column if not exists recommendation_category text;


create table if not exists public.supplement_recommendation_engine_config (
  config_key text primary key,
  config_value numeric not null,
  description text not null,
  updated_at timestamptz not null default now()
);
revoke all on table public.supplement_recommendation_engine_config from public, anon, authenticated;
grant all on table public.supplement_recommendation_engine_config to service_role;



create table if not exists public.client_anastasis_supplement_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  supplement_id uuid not null references public.supplements(id) on delete cascade,
  status text not null default 'active' check (status in ('active','dismissed','resolved','expired')),
  recommendation_category text not null,
  recommended_at timestamptz not null default now(),
  last_qualified_at timestamptz,
  resolved_at timestamptz,
  dismissed_at timestamptz,
  recommendation_reason_codes text[] not null default '{}',
  algorithm_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id, supplement_id)
);
revoke all on table public.client_anastasis_supplement_recommendations from public, anon, authenticated;
grant all on table public.client_anastasis_supplement_recommendations to service_role;



create table if not exists public.client_anastasis_supplement_recommendation_debug (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  evaluated_at timestamptz not null default now(),
  observation_days integer not null,
  logging_completeness numeric not null,
  recurring_nutrient_patterns jsonb not null default '[]'::jsonb,
  relevant_functional_trends jsonb not null default '[]'::jsonb,
  eligible_formulations jsonb not null default '[]'::jsonb,
  recommendation_generated boolean not null default false,
  reason_codes text[] not null default '{}',
  algorithm_version text not null
);
revoke all on table public.client_anastasis_supplement_recommendation_debug from public, anon, authenticated;
grant all on table public.client_anastasis_supplement_recommendation_debug to service_role;



create index if not exists client_anastasis_supp_recs_client_status_idx
  on public.client_anastasis_supplement_recommendations (client_id, status, recommended_at desc);


create index if not exists client_anastasis_supp_recs_user_client_idx
  on public.client_anastasis_supplement_recommendations (user_id, client_id, supplement_id);


create index if not exists client_anastasis_supp_debug_client_eval_idx
  on public.client_anastasis_supplement_recommendation_debug (client_id, evaluated_at desc);


alter table public.supplement_recommendation_engine_config enable row level security;

alter table public.client_anastasis_supplement_recommendations enable row level security;

alter table public.client_anastasis_supplement_recommendation_debug enable row level security;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='supplement_recommendation_engine_config' and policyname='authenticated read supplement recommendation config') then
    create policy "authenticated read supplement recommendation config"
  on public.supplement_recommendation_engine_config
  for select to authenticated
  using (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_anastasis_supplement_recommendations' and policyname='clients read own anastasis supplement recommendations') then
    create policy "clients read own anastasis supplement recommendations"
  on public.client_anastasis_supplement_recommendations
  for select to authenticated
  using ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_anastasis_supplement_recommendations' and policyname='clients insert own anastasis supplement recommendations') then
    create policy "clients insert own anastasis supplement recommendations"
  on public.client_anastasis_supplement_recommendations
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.clients c
      where c.client_id = client_anastasis_supplement_recommendations.client_id
        and c.auth_user_id = (select auth.uid())
    )
  );
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_anastasis_supplement_recommendations' and policyname='clients update own anastasis supplement recommendations') then
    create policy "clients update own anastasis supplement recommendations"
  on public.client_anastasis_supplement_recommendations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
  end if;
end
$source_policy$;


grant select on public.supplement_recommendation_engine_config to authenticated;

grant select, insert, update on public.client_anastasis_supplement_recommendations to authenticated;


insert into public.supplement_recommendation_engine_config (config_key, config_value, description)
values
  ('minObservationDays', 10, 'Minimum usable observation days before any supplement recommendation can qualify.'),
  ('standardObservationDays', 14, 'Preferred observation window for normal confidence.'),
  ('minDataCompleteness', 0.70, 'Minimum share of observed days with nutrition logging.'),
  ('minRecurrenceRate', 0.72, 'Minimum recurring food coverage pattern rate.'),
  ('adequateCoverageThreshold', 0.85, 'Food coverage ratio treated as adequate for recurrence checks.'),
  ('minFunctionalDays', 4, 'Minimum wellness/function data days needed for corroboration.'),
  ('suboptimalFunctionalThreshold', 5, 'Suboptimal threshold for 1-10 higher-is-better wellness scores.'),
  ('decliningTrendDelta', -0.75, 'Minimum negative trend delta considered meaningfully worse.'),
  ('resolutionRecurrenceRate', 0.45, 'Recurrence rate below which active recommendation can decay/resolution-check.'),
  ('resolutionFunctionalThreshold', 6, 'Functional trend threshold for resolution checks.'),
  ('recentlyResolvedDays', 14, 'Days to suppress a recently resolved product recommendation.')
on conflict (config_key) do nothing;



notify pgrst, 'reload schema';

-- SOURCE: 20261009004035_coordinated_daily_dashboard.sql
-- SHA256: a8e0cf1d0ce3dff46a8032b32e71cc4c22e354d77b1cd68a9be76cfa2be895b0
alter table public.cycle_logs add column if not exists answered_fields text[];

-- Additive: retain all existing logs, dates, RLS, and tier policies.
-- Water submissions are serialized on the daily log; retries never add the same drink twice.
alter table public.nutrition_logs add column if not exists water_submission_ids uuid[] not null default '{}';


create or replace function public.add_daily_water(p_log_id uuid, p_ounces numeric, p_submission_id uuid)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_log public.nutrition_logs%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_submission_id is null or p_ounces is null or p_ounces <= 0 or p_ounces::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter a valid water amount'; end if;
  select * into v_log from public.nutrition_logs where id = p_log_id and auth_user_id = auth.uid() for update;
  if not found then raise exception 'Nutrition log not found'; end if;
  if p_submission_id = any(v_log.water_submission_ids) then return to_jsonb(v_log); end if;
  update public.nutrition_logs set water_consumed_oz = coalesce(water_consumed_oz, 0) + p_ounces,
    water_submission_ids = array_append(water_submission_ids, p_submission_id), updated_at = now()
    where id = p_log_id and auth_user_id = auth.uid() returning * into v_log;
  return to_jsonb(v_log);
end $$;

revoke all on function public.add_daily_water(uuid,numeric,uuid) from public, anon;

grant execute on function public.add_daily_water(uuid,numeric,uuid) to authenticated;


-- Both statements run in one transaction: invalid inserts restore the original commitments.
create or replace function public.replace_daily_commitments(p_client_id text, p_blocks jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform 1 from public.clients where client_id = p_client_id and auth_user_id = auth.uid() for update;
  if not found then raise exception 'Client not found'; end if;
  if jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) > 100 then raise exception 'Invalid commitments'; end if;
  delete from public.client_schedule_blocks where client_id = p_client_id and user_id = auth.uid();
  insert into public.client_schedule_blocks(user_id,client_id,block_type,label,days_of_week,start_time,end_time,active)
    select auth.uid(), p_client_id, block_type, label, days_of_week, start_time::time, end_time::time, true
    from jsonb_to_recordset(p_blocks) as x(block_type text,label text,days_of_week smallint[],start_time text,end_time text);
end $$;

revoke all on function public.replace_daily_commitments(text,jsonb) from public, anon;

grant execute on function public.replace_daily_commitments(text,jsonb) to authenticated;


create or replace function public.save_daily_workout(p_client_id text, p_day_start timestamptz, p_day_end timestamptz, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id uuid; v_log public.workout_logs%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform 1 from public.clients where client_id = p_client_id and auth_user_id = auth.uid() for update;
  if not found then raise exception 'Client not found'; end if;
  if (p_payload->>'workout_date')::timestamptz < p_day_start or (p_payload->>'workout_date')::timestamptz >= p_day_end then raise exception 'Session date outside local day'; end if;
  select id into v_id from public.workout_logs where client_id = p_client_id and auth_user_id = auth.uid()
    and day_name = p_payload->>'day_name' and workout_source = p_payload->>'workout_source'
    and workout_date >= p_day_start and workout_date < p_day_end order by workout_date desc limit 1;
  if v_id is null then
    insert into public.workout_logs(client_id,auth_user_id,program,day_name,workout_source,workout_date,planned_exercises,exercise_logs,completed,updated_at)
      values(p_client_id,auth.uid(),p_payload->>'program',p_payload->>'day_name',p_payload->>'workout_source',(p_payload->>'workout_date')::timestamptz,p_payload->'planned_exercises',p_payload->'exercise_logs',(p_payload->>'completed')::boolean,now()) returning * into v_log;
  else
    update public.workout_logs set planned_exercises = p_payload->'planned_exercises', exercise_logs = p_payload->'exercise_logs',
      completed = (p_payload->>'completed')::boolean, updated_at = now()
      where id = v_id and auth_user_id = auth.uid() returning * into v_log;
  end if;
  return to_jsonb(v_log);
end $$;

revoke all on function public.save_daily_workout(text,timestamptz,timestamptz,jsonb) from public, anon;

grant execute on function public.save_daily_workout(text,timestamptz,timestamptz,jsonb) to authenticated;


-- Editing confirmed sets cannot leave a session empty after an insert failure.
create or replace function public.replace_workout_sets(p_session_id uuid, p_sets jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_session public.workout_exercise_sessions%rowtype;
begin
  select * into v_session from public.workout_exercise_sessions where id = p_session_id and auth_user_id = auth.uid() for update;
  if not found then raise exception 'Session not found'; end if;
  if jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets)>100 then raise exception 'Invalid sets'; end if;
  delete from public.workout_exercise_sets where exercise_session_id = p_session_id;
  insert into public.workout_exercise_sets(workout_log_id,exercise_session_id,exercise_id,set_number,weight,weight_unit,reps,set_started_at,completed_at)
    select v_session.workout_log_id,p_session_id,v_session.exercise_id,set_number,weight,weight_unit,reps,set_started_at,completed_at
    from jsonb_to_recordset(p_sets) as x(set_number int,weight numeric,weight_unit text,reps int,set_started_at timestamptz,completed_at timestamptz);
end $$;

revoke all on function public.replace_workout_sets(uuid,jsonb) from public, anon;

grant execute on function public.replace_workout_sets(uuid,jsonb) to authenticated;

-- SOURCE: 20261011210620_connected_calendars.sql
-- SHA256: 03e2b5cb5c746226661c8afa0bca7d225a76cf9003706541ff93896acd856dd8
-- Additive calendar integration. No changes to subscription, nutrition, login or existing events.
create table if not exists public.calendar_connections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider in ('google','icloud')), provider_account_id text not null, account_label text not null,
 status text not null default 'connected' check(status in ('connected','reconnect_required','error')),
 last_synced_at timestamptz, error_code text, error_message text, next_sync_at timestamptz not null default now(),
 failure_count integer not null default 0, lease_id uuid, lease_until timestamptz,
 created_at timestamptz not null default now(), unique(user_id,provider,provider_account_id), unique(id,user_id)
);
revoke all on table public.calendar_connections from public, anon, authenticated;
grant all on table public.calendar_connections to service_role;


create table if not exists public.calendar_credentials (
 connection_id uuid primary key references public.calendar_connections(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, encrypted_value text not null,
 foreign key(connection_id,user_id) references public.calendar_connections(id,user_id) on delete cascade
);
revoke all on table public.calendar_credentials from public, anon, authenticated;
grant all on table public.calendar_credentials to service_role;


create table if not exists public.connected_calendars (
 id uuid primary key default gen_random_uuid(), connection_id uuid not null, user_id uuid not null,
 provider_calendar_id text not null, name text not null, timezone text not null default 'UTC',
 writable boolean not null default false, selected boolean not null default false,
 sync_token text, metadata jsonb not null default '{}', last_synced_at timestamptz,
 foreign key(connection_id,user_id) references public.calendar_connections(id,user_id) on delete cascade,
 unique(connection_id,provider_calendar_id), unique(id,user_id)
);
revoke all on table public.connected_calendars from public, anon, authenticated;
grant all on table public.connected_calendars to service_role;


create table if not exists public.calendar_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 default_calendar_id uuid references public.connected_calendars(id) on delete set null,
 timezone text not null default 'America/Chicago', preferred_start time not null default '07:00', preferred_end time not null default '21:00',
 buffer_minutes integer not null default 10 check(buffer_minutes between 0 and 120),
 check(preferred_end > preferred_start)
);
revoke all on table public.calendar_preferences from public, anon, authenticated;
grant all on table public.calendar_preferences to service_role;


create table if not exists public.calendar_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 calendar_id uuid, provider_event_id text not null, provider_payload jsonb not null,
 event_type text not null default 'personal', etag text not null, synced_at timestamptz not null default now(),
 foreign key(calendar_id,user_id) references public.connected_calendars(id,user_id) on delete cascade,
 unique(calendar_id,provider_event_id), unique(id,user_id)
);
revoke all on table public.calendar_events from public, anon, authenticated;
grant all on table public.calendar_events to service_role;


create table if not exists public.calendar_oauth_states (
 state_hash text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 encrypted_verifier text not null, expires_at timestamptz not null, created_at timestamptz not null default now()
);
revoke all on table public.calendar_oauth_states from public, anon, authenticated;
grant all on table public.calendar_oauth_states to service_role;


create table if not exists public.calendar_write_operations (
 user_id uuid not null references auth.users(id) on delete cascade, idempotency_key uuid not null,
 request_hash text not null, response jsonb,
 connection_id uuid references public.calendar_connections(id) on delete cascade,
 target_event_id uuid, target_external boolean, target_calendar_id uuid,
 target_provider_event_id text, target_provider_etag text,
 deletion_confirmed boolean not null default false, created_at timestamptz not null default now(),
 primary key(user_id,idempotency_key),
 foreign key(connection_id,user_id) references public.calendar_connections(id,user_id) on delete cascade,
 foreign key(target_calendar_id,user_id) references public.connected_calendars(id,user_id) on delete cascade
);
revoke all on table public.calendar_write_operations from public, anon, authenticated;
grant all on table public.calendar_write_operations to service_role;


create index if not exists calendar_connections_due_idx on public.calendar_connections(next_sync_at) where status <> 'reconnect_required';

create index if not exists calendar_events_user_idx on public.calendar_events(user_id);

create index if not exists connected_calendars_user_idx on public.connected_calendars(user_id);

-- All exposed tables are user-specific read-only via Data API. Writes go through ownership-checked server routes.
alter table public.calendar_connections enable row level security;

alter table public.connected_calendars enable row level security;

alter table public.calendar_preferences enable row level security;

alter table public.calendar_events enable row level security;

alter table public.calendar_credentials enable row level security;

alter table public.calendar_oauth_states enable row level security;

alter table public.calendar_write_operations enable row level security;

revoke all on public.calendar_connections, public.connected_calendars, public.calendar_preferences, public.calendar_events,
 public.calendar_credentials, public.calendar_oauth_states, public.calendar_write_operations from anon, authenticated;

grant select on public.calendar_connections, public.connected_calendars, public.calendar_preferences, public.calendar_events to authenticated;

grant all on public.calendar_connections, public.connected_calendars, public.calendar_preferences, public.calendar_events,
 public.calendar_credentials, public.calendar_oauth_states, public.calendar_write_operations to service_role;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calendar_connections' and policyname='calendar_connections_owner') then
    create policy calendar_connections_owner on public.calendar_connections for select to authenticated using((select auth.uid())=user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='connected_calendars' and policyname='connected_calendars_owner') then
    create policy connected_calendars_owner on public.connected_calendars for select to authenticated using((select auth.uid())=user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calendar_preferences' and policyname='calendar_preferences_owner') then
    create policy calendar_preferences_owner on public.calendar_preferences for select to authenticated using((select auth.uid())=user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calendar_events' and policyname='calendar_events_owner') then
    create policy calendar_events_owner on public.calendar_events for select to authenticated using((select auth.uid())=user_id);
  end if;
end
$source_policy$;

-- Service-only atomic lease; invoker rights, no bypass of RLS for browser users.
create or replace function public.claim_calendar_sync(p_id uuid, p_user uuid, p_lease uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
 update public.calendar_connections set lease_id=p_lease, lease_until=now()+interval '4 minutes'
 where id=p_id and user_id=p_user and (lease_until is null or lease_until < now());
 return found;
end; $$;

revoke all on function public.claim_calendar_sync(uuid,uuid,uuid) from public,anon,authenticated;

grant execute on function public.claim_calendar_sync(uuid,uuid,uuid) to service_role;

-- Atomic account disconnect cascades imported data/credentials. Never deletes provider events.
create or replace function public.disconnect_calendar(p_id uuid,p_user uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
 delete from public.calendar_connections where id=p_id and user_id=p_user;
 return found;
end; $$;

revoke all on function public.disconnect_calendar(uuid,uuid) from public,anon,authenticated;

grant execute on function public.disconnect_calendar(uuid,uuid) to service_role;

-- SOURCE: 20261012173013_member_program_ownership_and_workout_history.sql
-- SHA256: 590c0fe9c6d3cce924704664438461fbad33c7e9f82058387d310a5179b7d722


create table if not exists public.program_outputs (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(client_id),
  auth_user_id uuid references auth.users(id),
  program text not null,
  status text,
  program_json jsonb,
  generated_at timestamptz not null default now()
);

alter table public.program_outputs
  add column if not exists auth_user_id uuid references auth.users(id),
  add column if not exists program_json jsonb,
  add column if not exists status text;

alter table public.program_outputs enable row level security;

grant select, insert, update on public.program_outputs to authenticated;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='program_outputs' and policyname='member program ownership boundary') then
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
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='program_outputs' and policyname='members read saved programs') then
    create policy "members read saved programs" on public.program_outputs
  for select to authenticated using (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='program_outputs' and policyname='members save own programs') then
    create policy "members save own programs" on public.program_outputs
  for insert to authenticated with check (true);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='program_outputs' and policyname='members update own programs') then
    create policy "members update own programs" on public.program_outputs
  for update to authenticated using (true) with check (true);
  end if;
end
$source_policy$;


-- Additive replacement; apply after 20261009004035_coordinated_daily_dashboard.sql.
-- The function retains prior same-day sessions when the exercise identities change.
-- No existing workout rows are changed by applying this definition.
create or replace function public.save_daily_workout(p_client_id text, p_day_start timestamptz, p_day_end timestamptz, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id uuid; v_log public.workout_logs%rowtype; v_program text; v_keys jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select program into v_program from public.clients where client_id = p_client_id and auth_user_id = auth.uid() for update;
  if not found then raise exception 'Client not found'; end if;
  if p_payload->>'program' is distinct from v_program then raise exception 'Workout does not match your program'; end if;
  if p_day_end <= p_day_start or (p_payload->>'workout_date')::timestamptz < p_day_start or (p_payload->>'workout_date')::timestamptz >= p_day_end then raise exception 'Session date outside local day'; end if;
  if jsonb_typeof(p_payload->'exercise_logs') is distinct from 'array' or jsonb_array_length(p_payload->'exercise_logs') not between 1 and 100 then raise exception 'Invalid exercises'; end if;
  select jsonb_agg(coalesce(item->>'session_key', coalesce(item->>'id',item->>'exercise',item->>'name') || ':' || (position-1)::text) order by position)
    into v_keys from jsonb_array_elements(p_payload->'exercise_logs') with ordinality as exercises(item,position);
  select id into v_id from public.workout_logs where client_id = p_client_id and auth_user_id = auth.uid()
    and day_name = p_payload->>'day_name' and workout_source = p_payload->>'workout_source'
    and workout_date >= p_day_start and workout_date < p_day_end
    and (select jsonb_agg(coalesce(item->>'session_key', coalesce(item->>'id',item->>'exercise',item->>'name') || ':' || (position-1)::text) order by position)
      from jsonb_array_elements(coalesce(exercise_logs,'[]'::jsonb)) with ordinality as exercises(item,position)) is not distinct from v_keys
    order by workout_date desc limit 1;
  if v_id is null then
    insert into public.workout_logs(client_id,auth_user_id,program,day_name,workout_source,workout_date,planned_exercises,exercise_logs,completed,updated_at)
      values(p_client_id,auth.uid(),v_program,p_payload->>'day_name',p_payload->>'workout_source',(p_payload->>'workout_date')::timestamptz,p_payload->'planned_exercises',p_payload->'exercise_logs',(p_payload->>'completed')::boolean,now()) returning * into v_log;
  else
    update public.workout_logs set planned_exercises = p_payload->'planned_exercises', exercise_logs = p_payload->'exercise_logs',
      completed = (p_payload->>'completed')::boolean, updated_at = now()
      where id = v_id and auth_user_id = auth.uid() returning * into v_log;
  end if;
  return to_jsonb(v_log);
end $$;

revoke all on function public.save_daily_workout(text,timestamptz,timestamptz,jsonb) from public, anon;

grant execute on function public.save_daily_workout(text,timestamptz,timestamptz,jsonb) to authenticated;

-- SOURCE: 20261012174637_secure_checkout_fulfillment_and_billing.sql
-- SHA256: b1fc2a8cc0161f6418edc6ee795b0def46fc5932ee0809c3dbc101a23119ee86
-- Additive payment hardening; reviewed source and CLI-generated migration.
-- Not applied to production. Isolated PostgreSQL verification only.
alter table public.client_invitations add column if not exists delivered_at timestamptz;

create table if not exists public.stripe_webhook_events (
  event_id text primary key, event_type text not null,
  processed_at timestamptz not null default now(), client_id text,
  payload jsonb not null default '{}'
);
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;


alter table public.stripe_webhook_events enable row level security;

revoke all on public.stripe_webhook_events from anon, authenticated;

grant all on public.stripe_webhook_events to service_role;


create table if not exists public.checkout_purchases (
  session_id text primary key,
  client_id text not null references public.clients(client_id),
  email text not null, program text not null check(program in ('ember','ignite','phoenix')),
  livemode boolean not null, purchased_at timestamptz not null,
  fulfilled_at timestamptz not null default now()
);
revoke all on table public.checkout_purchases from public, anon, authenticated;
grant all on table public.checkout_purchases to service_role;


alter table public.checkout_purchases enable row level security;

revoke all on public.checkout_purchases from anon, authenticated;

grant all on public.checkout_purchases to service_role;

alter table public.client_billing add column if not exists last_checkout_created_at timestamptz;

alter table public.client_billing add column if not exists last_subscription_event_created bigint not null default 0;

create unique index if not exists client_billing_client_key on public.client_billing(client_id);


create or replace function public.fulfill_checkout_purchase(p_purchase jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_client public.clients%rowtype;
  v_previous public.checkout_purchases%rowtype;
  v_id text := p_purchase->>'session_id';
  v_client_id text;
  v_email text := lower(trim(p_purchase->>'email'));
  v_started timestamptz := (p_purchase->>'period_start')::timestamptz;
  v_ends timestamptz := (p_purchase->>'period_end')::timestamptz;
  v_purchased timestamptz := (p_purchase->>'purchased_at')::timestamptz;
  v_access boolean := (p_purchase->>'access_active')::boolean;
  v_last timestamptz;
  v_existing_billing public.client_billing%rowtype;
begin
  if v_id is null or v_email is null or v_email='' or p_purchase->>'program' not in ('ember','ignite','phoenix') or v_ends<=v_started then raise exception 'Invalid purchase'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_id,0));
  select * into v_previous from public.checkout_purchases where session_id=v_id;
  if found then
    select * into v_client from public.clients where client_id=v_previous.client_id;
    return jsonb_build_object('client_id',v_client.client_id,'email',v_previous.email,'program',v_client.program,'auth_user_id',v_client.auth_user_id,'replayed',true);
  end if;
  if nullif(p_purchase->>'bound_client_id','') is not null then
    select * into v_client from public.clients
      where client_id=p_purchase->>'bound_client_id'
        and auth_user_id=(p_purchase->>'bound_user_id')::uuid for update;
    if not found then raise exception 'Purchase owner does not match client'; end if;
    v_client_id:=v_client.client_id;
  else
    -- An email entered at Checkout is not proof of an existing member's ownership.
    -- A guest purchase gets its own pending record, never an email-selected client.
    v_client_id:='AN-'||md5(v_id);
    insert into public.clients(client_id,email,full_name,program,auth_user_id,login_email,onboarding_completed,verified_purchase,access,active,subscription_status,subscription_started_at,subscription_ends_at,updated_at)
    values(v_client_id,v_email,nullif(p_purchase->>'full_name',''),p_purchase->>'program',null,null,false,true,v_access,v_access,p_purchase->>'billing_status',v_started,v_ends,now());
  end if;
  select * into v_existing_billing from public.client_billing where client_id=v_client_id for update;
  v_last:=v_existing_billing.last_checkout_created_at;
  if nullif(v_existing_billing.stripe_subscription_id,'') is not null
     and v_existing_billing.stripe_subscription_id is distinct from nullif(p_purchase->>'subscription_id','')
     and coalesce(v_existing_billing.billing_status,'') not in ('canceled','incomplete_expired') then
    raise exception 'Existing recurring subscription requires support before activating another purchase';
  end if;
  if v_last is not null and v_purchased<=v_last
     and nullif(p_purchase->>'subscription_id','') is not null
     and nullif(p_purchase->>'subscription_id','') is distinct from v_existing_billing.stripe_subscription_id
     and coalesce(p_purchase->>'billing_status','') not in ('canceled','incomplete_expired') then
    raise exception 'Older recurring purchase requires support before activation';
  end if;
  if v_last is null or v_purchased>v_last then
    update public.clients set program=p_purchase->>'program',verified_purchase=true,access=v_access,active=v_access,
      subscription_status=p_purchase->>'billing_status',subscription_started_at=v_started,subscription_ends_at=v_ends,updated_at=now() where client_id=v_client_id;
    insert into public.client_billing(client_id,stripe_customer_id,stripe_subscription_id,billing_type,billing_status,current_period_start,current_period_end,last_payment_date,next_payment_date,access_active,cancel_at_period_end,updated_at,last_checkout_created_at,last_subscription_event_created)
      values(v_client_id,p_purchase->>'customer_id',p_purchase->>'subscription_id',p_purchase->>'billing_type',p_purchase->>'billing_status',v_started,v_ends,v_purchased,case when p_purchase->>'billing_type'='subscription' then v_ends else null end,v_access,coalesce((p_purchase->>'cancel_at_period_end')::boolean,false),now(),v_purchased,0)
      on conflict(client_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,billing_type=excluded.billing_type,billing_status=excluded.billing_status,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,last_payment_date=excluded.last_payment_date,next_payment_date=excluded.next_payment_date,access_active=excluded.access_active,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=excluded.updated_at,last_checkout_created_at=excluded.last_checkout_created_at,last_subscription_event_created=0;
  end if;
  insert into public.checkout_purchases(session_id,client_id,email,program,livemode,purchased_at)
    values(v_id,v_client_id,v_email,p_purchase->>'program',(p_purchase->>'livemode')::boolean,v_purchased);
  select * into v_client from public.clients where client_id=v_client_id;
  return jsonb_build_object('client_id',v_client.client_id,'email',v_email,'program',v_client.program,'auth_user_id',v_client.auth_user_id,'replayed',false);
end $$;

revoke execute on function public.fulfill_checkout_purchase(jsonb) from public,anon,authenticated;

grant execute on function public.fulfill_checkout_purchase(jsonb) to service_role;


create or replace function public.sync_member_subscription(p_subscription_id text,p_state jsonb)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_billing public.client_billing%rowtype;v_created bigint:=(p_state->>'event_created')::bigint;v_access boolean;
begin
  select * into v_billing from public.client_billing where stripe_subscription_id=p_subscription_id for update;
  if not found then return; end if;
  if v_created<v_billing.last_subscription_event_created then return; end if;
  -- Stripe cancellation is terminal for this subscription ID. Equal-second
  -- delivery races must not resurrect it from an older active snapshot.
  if v_billing.billing_status in ('canceled','incomplete_expired') and p_state->>'status' not in ('canceled','incomplete_expired') then return; end if;
  v_access:=coalesce((p_state->>'access')::boolean,false) and (p_state->>'end')::timestamptz>now();
  update public.client_billing set billing_status=p_state->>'status',access_active=v_access,current_period_start=(p_state->>'start')::timestamptz,current_period_end=(p_state->>'end')::timestamptz,
    cancel_at_period_end=coalesce((p_state->>'cancelAtPeriodEnd')::boolean,false),last_subscription_event_created=v_created,updated_at=now() where client_id=v_billing.client_id;
  update public.clients set subscription_status=p_state->>'status',access=v_access,active=v_access,subscription_started_at=(p_state->>'start')::timestamptz,subscription_ends_at=(p_state->>'end')::timestamptz,updated_at=now() where client_id=v_billing.client_id;
end $$;

revoke execute on function public.sync_member_subscription(text,jsonb) from public,anon,authenticated;

grant execute on function public.sync_member_subscription(text,jsonb) to service_role;


-- A returning customer may pay as a guest. A verified login with the receipt
-- email can claim that pending purchase; the email typed at checkout alone
-- never alters a previous member account.
create or replace function public.claim_checkout_purchase(p_session_id text,p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,auth,pg_temp as $$
declare v_purchase public.checkout_purchases%rowtype;v_pending public.clients%rowtype;v_target public.clients%rowtype;v_billing public.client_billing%rowtype;v_existing_billing public.client_billing%rowtype;v_email text;v_latest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_session_id,0));
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select lower(email) into v_email from auth.users where id=p_user_id and email_confirmed_at is not null;
  select * into v_purchase from public.checkout_purchases where session_id=p_session_id for update;
  if v_email is null or v_purchase.email is distinct from v_email then raise exception 'Purchase email does not match verified login'; end if;
  select * into v_pending from public.clients where client_id=v_purchase.client_id for update;
  if v_pending.auth_user_id is not null and v_pending.auth_user_id<>p_user_id then raise exception 'Purchase already belongs to another login'; end if;
  select * into v_target from public.clients where auth_user_id=p_user_id limit 1 for update;
  if not found then
    update public.clients set auth_user_id=p_user_id,login_email=v_email,updated_at=now() where client_id=v_pending.client_id;
    v_target:=v_pending;v_target.auth_user_id:=p_user_id;
  elsif v_target.client_id<>v_pending.client_id then
    select * into v_billing from public.client_billing where client_id=v_pending.client_id for update;
    select * into v_existing_billing from public.client_billing where client_id=v_target.client_id for update;
    v_latest:=v_existing_billing.last_checkout_created_at;
    if v_billing.client_id is null then raise exception 'Pending purchase billing missing'; end if;
    -- A second purchase must not hide an existing recurring charge from its portal.
    -- Keep both identities intact for support to reconcile rather than dropping one.
    if nullif(v_existing_billing.stripe_subscription_id,'') is not null
       and v_existing_billing.stripe_subscription_id is distinct from v_billing.stripe_subscription_id
       and coalesce(v_existing_billing.billing_status,'') not in ('canceled','incomplete_expired') then
      raise exception 'Existing recurring subscription requires support before connecting another purchase';
    end if;
    if v_latest is not null and v_purchase.purchased_at<=v_latest
       and nullif(v_billing.stripe_subscription_id,'') is not null
       and v_billing.stripe_subscription_id is distinct from v_existing_billing.stripe_subscription_id
       and coalesce(v_billing.billing_status,'') not in ('canceled','incomplete_expired') then
      raise exception 'Older recurring purchase requires support before connecting';
    end if;
    if v_latest is null or v_purchase.purchased_at>v_latest then
      update public.clients set program=v_pending.program,verified_purchase=true,access=v_pending.access,active=v_pending.active,subscription_status=v_pending.subscription_status,subscription_started_at=v_pending.subscription_started_at,subscription_ends_at=v_pending.subscription_ends_at,updated_at=now() where client_id=v_target.client_id;
      insert into public.client_billing(client_id,stripe_customer_id,stripe_subscription_id,billing_type,billing_status,current_period_start,current_period_end,last_payment_date,next_payment_date,access_active,cancel_at_period_end,updated_at,last_checkout_created_at,last_subscription_event_created)
        values(v_target.client_id,v_billing.stripe_customer_id,v_billing.stripe_subscription_id,v_billing.billing_type,v_billing.billing_status,v_billing.current_period_start,v_billing.current_period_end,v_billing.last_payment_date,v_billing.next_payment_date,v_billing.access_active,v_billing.cancel_at_period_end,now(),v_billing.last_checkout_created_at,v_billing.last_subscription_event_created)
        on conflict(client_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,billing_type=excluded.billing_type,billing_status=excluded.billing_status,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,last_payment_date=excluded.last_payment_date,next_payment_date=excluded.next_payment_date,access_active=excluded.access_active,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now(),last_checkout_created_at=excluded.last_checkout_created_at,last_subscription_event_created=excluded.last_subscription_event_created;
    end if;
    update public.checkout_purchases set client_id=v_target.client_id where session_id=p_session_id;
    update public.client_billing set stripe_customer_id=null,stripe_subscription_id=null,access_active=false,updated_at=now() where client_id=v_pending.client_id;
    update public.clients set access=false,active=false,updated_at=now() where client_id=v_pending.client_id;
  end if;
  select * into v_target from public.clients where client_id=v_target.client_id;
  return jsonb_build_object('client_id',v_target.client_id,'email',v_email,'program',v_target.program,'auth_user_id',p_user_id);
end $$;

revoke execute on function public.claim_checkout_purchase(text,uuid) from public,anon,authenticated;

grant execute on function public.claim_checkout_purchase(text,uuid) to service_role;


-- Customer IDs authorize the billing portal. Browser callers must never be
-- able to replace them, even when older permissive grants/policies remain.
revoke insert,update,delete on public.client_billing from anon,authenticated;

create or replace function public.protect_member_billing()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if current_user in ('anon','authenticated') then raise exception 'Billing records can only be changed by the server'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
do $source_trigger$
begin
  if not exists (select 1 from pg_trigger where tgrelid='public.client_billing'::regclass and tgname='protect_member_billing' and not tgisinternal) then
    create trigger protect_member_billing before insert or update or delete on public.client_billing for each row execute function public.protect_member_billing();
  end if;
end
$source_trigger$;

revoke execute on function public.protect_member_billing() from public,anon,authenticated;


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
do $source_trigger$
begin
  if not exists (select 1 from pg_trigger where tgrelid='public.clients'::regclass and tgname='protect_member_entitlements' and not tgisinternal) then
    create trigger protect_member_entitlements before insert or update on public.clients for each row execute function public.protect_member_entitlements();
  end if;
end
$source_trigger$;

revoke execute on function public.protect_member_entitlements() from public,anon,authenticated;

notify pgrst,'reload schema';


create or replace function public.commerce_configuration_ready()
returns boolean language sql security invoker set search_path=public,pg_temp as $$ select true $$;

revoke execute on function public.commerce_configuration_ready() from public,anon,authenticated;

grant execute on function public.commerce_configuration_ready() to service_role;
-- ADDITIVE SECURITY CORRECTIONS: keep source named policies; restrictive guards combine with them.
do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assessment_photos' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.assessment_photos
      as restrictive for all to authenticated
      using (assessment_photos.auth_user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=assessment_photos.client_id and c.auth_user_id=assessment_photos.auth_user_id) and (assessment_photos.assessment_type <> 'posture' or exists (select 1 from public.clients c where c.client_id=assessment_photos.client_id and lower(c.program) in ('ignite','phoenix'))))
      with check (assessment_photos.auth_user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=assessment_photos.client_id and c.auth_user_id=assessment_photos.auth_user_id) and (assessment_photos.assessment_type <> 'posture' or exists (select 1 from public.clients c where c.client_id=assessment_photos.client_id and lower(c.program) in ('ignite','phoenix'))));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_composition_results' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.body_assessment_composition_results
      as restrictive for all to authenticated
      using (body_assessment_composition_results.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=body_assessment_composition_results.client_id and c.auth_user_id=body_assessment_composition_results.user_id) and exists (select 1 from public.body_assessment_sessions p where p.id=body_assessment_composition_results.session_id and p.user_id=body_assessment_composition_results.user_id and p.client_id=body_assessment_composition_results.client_id))
      with check (body_assessment_composition_results.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=body_assessment_composition_results.client_id and c.auth_user_id=body_assessment_composition_results.user_id) and exists (select 1 from public.body_assessment_sessions p where p.id=body_assessment_composition_results.session_id and p.user_id=body_assessment_composition_results.user_id and p.client_id=body_assessment_composition_results.client_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_measurements' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.body_assessment_measurements
      as restrictive for all to authenticated
      using (body_assessment_measurements.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=body_assessment_measurements.client_id and c.auth_user_id=body_assessment_measurements.user_id) and exists (select 1 from public.body_assessment_sessions p where p.id=body_assessment_measurements.session_id and p.user_id=body_assessment_measurements.user_id and p.client_id=body_assessment_measurements.client_id))
      with check (body_assessment_measurements.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=body_assessment_measurements.client_id and c.auth_user_id=body_assessment_measurements.user_id) and exists (select 1 from public.body_assessment_sessions p where p.id=body_assessment_measurements.session_id and p.user_id=body_assessment_measurements.user_id and p.client_id=body_assessment_measurements.client_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_regional_results' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.body_assessment_regional_results
      as restrictive for all to authenticated
      using (body_assessment_regional_results.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=body_assessment_regional_results.client_id and c.auth_user_id=body_assessment_regional_results.user_id) and exists (select 1 from public.body_assessment_sessions p where p.id=body_assessment_regional_results.session_id and p.user_id=body_assessment_regional_results.user_id and p.client_id=body_assessment_regional_results.client_id))
      with check (body_assessment_regional_results.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=body_assessment_regional_results.client_id and c.auth_user_id=body_assessment_regional_results.user_id) and exists (select 1 from public.body_assessment_sessions p where p.id=body_assessment_regional_results.session_id and p.user_id=body_assessment_regional_results.user_id and p.client_id=body_assessment_regional_results.client_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='body_assessment_sessions' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.body_assessment_sessions
      as restrictive for all to authenticated
      using (body_assessment_sessions.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=body_assessment_sessions.client_id and c.auth_user_id=body_assessment_sessions.user_id))
      with check (body_assessment_sessions.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=body_assessment_sessions.client_id and c.auth_user_id=body_assessment_sessions.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_anastasis_supplement_recommendation_debug' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.client_anastasis_supplement_recommendation_debug
      as restrictive for all to authenticated
      using (client_anastasis_supplement_recommendation_debug.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_anastasis_supplement_recommendation_debug.client_id and c.auth_user_id=client_anastasis_supplement_recommendation_debug.user_id))
      with check (client_anastasis_supplement_recommendation_debug.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_anastasis_supplement_recommendation_debug.client_id and c.auth_user_id=client_anastasis_supplement_recommendation_debug.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_anastasis_supplement_recommendations' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.client_anastasis_supplement_recommendations
      as restrictive for all to authenticated
      using (client_anastasis_supplement_recommendations.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_anastasis_supplement_recommendations.client_id and c.auth_user_id=client_anastasis_supplement_recommendations.user_id))
      with check (client_anastasis_supplement_recommendations.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_anastasis_supplement_recommendations.client_id and c.auth_user_id=client_anastasis_supplement_recommendations.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_current_profiles' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.client_current_profiles
      as restrictive for all to authenticated
      using (client_current_profiles.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_current_profiles.client_id and c.auth_user_id=client_current_profiles.user_id))
      with check (client_current_profiles.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_current_profiles.client_id and c.auth_user_id=client_current_profiles.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_nutrient_clinical_records' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.client_nutrient_clinical_records
      as restrictive for all to authenticated
      using (client_nutrient_clinical_records.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_nutrient_clinical_records.client_id and c.auth_user_id=client_nutrient_clinical_records.user_id))
      with check (client_nutrient_clinical_records.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_nutrient_clinical_records.client_id and c.auth_user_id=client_nutrient_clinical_records.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_nutrient_intake_exposures' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.client_nutrient_intake_exposures
      as restrictive for all to authenticated
      using (client_nutrient_intake_exposures.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_nutrient_intake_exposures.client_id and c.auth_user_id=client_nutrient_intake_exposures.user_id))
      with check (client_nutrient_intake_exposures.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_nutrient_intake_exposures.client_id and c.auth_user_id=client_nutrient_intake_exposures.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_nutrient_recommendations' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.client_nutrient_recommendations
      as restrictive for all to authenticated
      using (client_nutrient_recommendations.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_nutrient_recommendations.client_id and c.auth_user_id=client_nutrient_recommendations.user_id))
      with check (client_nutrient_recommendations.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_nutrient_recommendations.client_id and c.auth_user_id=client_nutrient_recommendations.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_onboarding_snapshots' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.client_onboarding_snapshots
      as restrictive for all to authenticated
      using (client_onboarding_snapshots.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_onboarding_snapshots.client_id and c.auth_user_id=client_onboarding_snapshots.user_id))
      with check (client_onboarding_snapshots.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_onboarding_snapshots.client_id and c.auth_user_id=client_onboarding_snapshots.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_profile_change_history' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.client_profile_change_history
      as restrictive for all to authenticated
      using (client_profile_change_history.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_profile_change_history.client_id and c.auth_user_id=client_profile_change_history.user_id))
      with check (client_profile_change_history.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_profile_change_history.client_id and c.auth_user_id=client_profile_change_history.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_schedule_blocks' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.client_schedule_blocks
      as restrictive for all to authenticated
      using (client_schedule_blocks.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_schedule_blocks.client_id and c.auth_user_id=client_schedule_blocks.user_id))
      with check (client_schedule_blocks.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_schedule_blocks.client_id and c.auth_user_id=client_schedule_blocks.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_supplement_intake_logs' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.client_supplement_intake_logs
      as restrictive for all to authenticated
      using (client_supplement_intake_logs.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_supplement_intake_logs.client_id and c.auth_user_id=client_supplement_intake_logs.user_id) and (client_supplement_intake_logs.supplement_product_id is null or exists (select 1 from public.client_supplement_products p where p.id=client_supplement_intake_logs.supplement_product_id and p.user_id=client_supplement_intake_logs.user_id and p.client_id=client_supplement_intake_logs.client_id)))
      with check (client_supplement_intake_logs.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_supplement_intake_logs.client_id and c.auth_user_id=client_supplement_intake_logs.user_id) and (client_supplement_intake_logs.supplement_product_id is null or exists (select 1 from public.client_supplement_products p where p.id=client_supplement_intake_logs.supplement_product_id and p.user_id=client_supplement_intake_logs.user_id and p.client_id=client_supplement_intake_logs.client_id)));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_supplement_product_nutrients' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.client_supplement_product_nutrients
      as restrictive for all to authenticated
      using (client_supplement_product_nutrients.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_supplement_product_nutrients.client_id and c.auth_user_id=client_supplement_product_nutrients.user_id) and exists (select 1 from public.client_supplement_products p where p.id=client_supplement_product_nutrients.supplement_product_id and p.user_id=client_supplement_product_nutrients.user_id and p.client_id=client_supplement_product_nutrients.client_id))
      with check (client_supplement_product_nutrients.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_supplement_product_nutrients.client_id and c.auth_user_id=client_supplement_product_nutrients.user_id) and exists (select 1 from public.client_supplement_products p where p.id=client_supplement_product_nutrients.supplement_product_id and p.user_id=client_supplement_product_nutrients.user_id and p.client_id=client_supplement_product_nutrients.client_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_supplement_products' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.client_supplement_products
      as restrictive for all to authenticated
      using (client_supplement_products.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_supplement_products.client_id and c.auth_user_id=client_supplement_products.user_id))
      with check (client_supplement_products.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=client_supplement_products.client_id and c.auth_user_id=client_supplement_products.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinical_follow_up_events' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.clinical_follow_up_events
      as restrictive for all to authenticated
      using (clinical_follow_up_events.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=clinical_follow_up_events.client_id and c.auth_user_id=clinical_follow_up_events.user_id))
      with check (clinical_follow_up_events.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=clinical_follow_up_events.client_id and c.auth_user_id=clinical_follow_up_events.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinical_observation_records' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.clinical_observation_records
      as restrictive for all to authenticated
      using (clinical_observation_records.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=clinical_observation_records.client_id and c.auth_user_id=clinical_observation_records.user_id) and (clinical_observation_records.source_pattern_flag_id is null or exists (select 1 from public.physiology_pattern_flags p where p.id=clinical_observation_records.source_pattern_flag_id and p.user_id=clinical_observation_records.user_id and p.client_id=clinical_observation_records.client_id)))
      with check (clinical_observation_records.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=clinical_observation_records.client_id and c.auth_user_id=clinical_observation_records.user_id) and (clinical_observation_records.source_pattern_flag_id is null or exists (select 1 from public.physiology_pattern_flags p where p.id=clinical_observation_records.source_pattern_flag_id and p.user_id=clinical_observation_records.user_id and p.client_id=clinical_observation_records.client_id)));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinician_sharing_preferences' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.clinician_sharing_preferences
      as restrictive for all to authenticated
      using (clinician_sharing_preferences.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=clinician_sharing_preferences.client_id and c.auth_user_id=clinician_sharing_preferences.user_id))
      with check (clinician_sharing_preferences.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=clinician_sharing_preferences.client_id and c.auth_user_id=clinician_sharing_preferences.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cycle_burden_scores' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.cycle_burden_scores
      as restrictive for all to authenticated
      using (cycle_burden_scores.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=cycle_burden_scores.client_id and c.auth_user_id=cycle_burden_scores.user_id) and (cycle_burden_scores.flow_log_id is null or exists (select 1 from public.menstrual_flow_logs p where p.id=cycle_burden_scores.flow_log_id and p.user_id=cycle_burden_scores.user_id and p.client_id=cycle_burden_scores.client_id)))
      with check (cycle_burden_scores.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=cycle_burden_scores.client_id and c.auth_user_id=cycle_burden_scores.user_id) and (cycle_burden_scores.flow_log_id is null or exists (select 1 from public.menstrual_flow_logs p where p.id=cycle_burden_scores.flow_log_id and p.user_id=cycle_burden_scores.user_id and p.client_id=cycle_burden_scores.client_id)));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cycle_burden_trends' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.cycle_burden_trends
      as restrictive for all to authenticated
      using (cycle_burden_trends.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=cycle_burden_trends.client_id and c.auth_user_id=cycle_burden_trends.user_id))
      with check (cycle_burden_trends.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=cycle_burden_trends.client_id and c.auth_user_id=cycle_burden_trends.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cycle_daily_symptoms' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.cycle_daily_symptoms
      as restrictive for all to authenticated
      using (cycle_daily_symptoms.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=cycle_daily_symptoms.client_id and c.auth_user_id=cycle_daily_symptoms.user_id) and (cycle_daily_symptoms.cycle_log_id is null or exists (select 1 from public.cycle_logs p where p.id=cycle_daily_symptoms.cycle_log_id and p.auth_user_id=cycle_daily_symptoms.user_id and p.client_id=cycle_daily_symptoms.client_id)))
      with check (cycle_daily_symptoms.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=cycle_daily_symptoms.client_id and c.auth_user_id=cycle_daily_symptoms.user_id) and (cycle_daily_symptoms.cycle_log_id is null or exists (select 1 from public.cycle_logs p where p.id=cycle_daily_symptoms.cycle_log_id and p.auth_user_id=cycle_daily_symptoms.user_id and p.client_id=cycle_daily_symptoms.client_id)));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='health_provenance_records' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.health_provenance_records
      as restrictive for all to authenticated
      using (health_provenance_records.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=health_provenance_records.client_id and c.auth_user_id=health_provenance_records.user_id))
      with check (health_provenance_records.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=health_provenance_records.client_id and c.auth_user_id=health_provenance_records.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menstrual_flow_logs' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.menstrual_flow_logs
      as restrictive for all to authenticated
      using (menstrual_flow_logs.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=menstrual_flow_logs.client_id and c.auth_user_id=menstrual_flow_logs.user_id) and (menstrual_flow_logs.cycle_log_id is null or exists (select 1 from public.cycle_logs p where p.id=menstrual_flow_logs.cycle_log_id and p.auth_user_id=menstrual_flow_logs.user_id and p.client_id=menstrual_flow_logs.client_id)))
      with check (menstrual_flow_logs.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=menstrual_flow_logs.client_id and c.auth_user_id=menstrual_flow_logs.user_id) and (menstrual_flow_logs.cycle_log_id is null or exists (select 1 from public.cycle_logs p where p.id=menstrual_flow_logs.cycle_log_id and p.auth_user_id=menstrual_flow_logs.user_id and p.client_id=menstrual_flow_logs.client_id)));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menstrual_product_logs' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.menstrual_product_logs
      as restrictive for all to authenticated
      using (menstrual_product_logs.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=menstrual_product_logs.client_id and c.auth_user_id=menstrual_product_logs.user_id) and exists (select 1 from public.menstrual_flow_logs p where p.id=menstrual_product_logs.flow_log_id and p.user_id=menstrual_product_logs.user_id and p.client_id=menstrual_product_logs.client_id))
      with check (menstrual_product_logs.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=menstrual_product_logs.client_id and c.auth_user_id=menstrual_product_logs.user_id) and exists (select 1 from public.menstrual_flow_logs p where p.id=menstrual_product_logs.flow_log_id and p.user_id=menstrual_product_logs.user_id and p.client_id=menstrual_product_logs.client_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pattern_recommendation_events' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.pattern_recommendation_events
      as restrictive for all to authenticated
      using (pattern_recommendation_events.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=pattern_recommendation_events.client_id and c.auth_user_id=pattern_recommendation_events.user_id))
      with check (pattern_recommendation_events.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=pattern_recommendation_events.client_id and c.auth_user_id=pattern_recommendation_events.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pattern_response_events' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.pattern_response_events
      as restrictive for all to authenticated
      using (pattern_response_events.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=pattern_response_events.client_id and c.auth_user_id=pattern_response_events.user_id) and (pattern_response_events.related_recommendation_event_id is null or exists (select 1 from public.pattern_recommendation_events p where p.id=pattern_response_events.related_recommendation_event_id and p.user_id=pattern_response_events.user_id and p.client_id=pattern_response_events.client_id)))
      with check (pattern_response_events.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=pattern_response_events.client_id and c.auth_user_id=pattern_response_events.user_id) and (pattern_response_events.related_recommendation_event_id is null or exists (select 1 from public.pattern_recommendation_events p where p.id=pattern_response_events.related_recommendation_event_id and p.user_id=pattern_response_events.user_id and p.client_id=pattern_response_events.client_id)));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='physiology_pattern_evidence' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.physiology_pattern_evidence
      as restrictive for all to authenticated
      using (physiology_pattern_evidence.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=physiology_pattern_evidence.client_id and c.auth_user_id=physiology_pattern_evidence.user_id) and (physiology_pattern_evidence.pattern_flag_id is null or exists (select 1 from public.physiology_pattern_flags p where p.id=physiology_pattern_evidence.pattern_flag_id and p.user_id=physiology_pattern_evidence.user_id and p.client_id=physiology_pattern_evidence.client_id and p.pattern_key=physiology_pattern_evidence.pattern_key)))
      with check (physiology_pattern_evidence.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=physiology_pattern_evidence.client_id and c.auth_user_id=physiology_pattern_evidence.user_id) and (physiology_pattern_evidence.pattern_flag_id is null or exists (select 1 from public.physiology_pattern_flags p where p.id=physiology_pattern_evidence.pattern_flag_id and p.user_id=physiology_pattern_evidence.user_id and p.client_id=physiology_pattern_evidence.client_id and p.pattern_key=physiology_pattern_evidence.pattern_key)));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='physiology_pattern_flags' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.physiology_pattern_flags
      as restrictive for all to authenticated
      using (physiology_pattern_flags.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=physiology_pattern_flags.client_id and c.auth_user_id=physiology_pattern_flags.user_id))
      with check (physiology_pattern_flags.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=physiology_pattern_flags.client_id and c.auth_user_id=physiology_pattern_flags.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='posture_photo_landmarks' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.posture_photo_landmarks
      as restrictive for all to authenticated
      using (posture_photo_landmarks.auth_user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=posture_photo_landmarks.client_id and c.auth_user_id=posture_photo_landmarks.auth_user_id) and exists (select 1 from public.assessment_photos a join public.clients c on c.client_id=a.client_id where a.id=posture_photo_landmarks.assessment_photo_id and a.client_id=posture_photo_landmarks.client_id and a.auth_user_id=posture_photo_landmarks.auth_user_id and lower(c.program) in ('ignite','phoenix')))
      with check (posture_photo_landmarks.auth_user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=posture_photo_landmarks.client_id and c.auth_user_id=posture_photo_landmarks.auth_user_id) and exists (select 1 from public.assessment_photos a join public.clients c on c.client_id=a.client_id where a.id=posture_photo_landmarks.assessment_photo_id and a.client_id=posture_photo_landmarks.client_id and a.auth_user_id=posture_photo_landmarks.auth_user_id and lower(c.program) in ('ignite','phoenix')));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sessions' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.workout_exercise_sessions
      as restrictive for all to authenticated
      using (workout_exercise_sessions.auth_user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=workout_exercise_sessions.client_id and c.auth_user_id=workout_exercise_sessions.auth_user_id) and exists (select 1 from public.workout_logs w where w.id=workout_exercise_sessions.workout_log_id and w.client_id=workout_exercise_sessions.client_id and w.auth_user_id=workout_exercise_sessions.auth_user_id))
      with check (workout_exercise_sessions.auth_user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=workout_exercise_sessions.client_id and c.auth_user_id=workout_exercise_sessions.auth_user_id) and exists (select 1 from public.workout_logs w where w.id=workout_exercise_sessions.workout_log_id and w.client_id=workout_exercise_sessions.client_id and w.auth_user_id=workout_exercise_sessions.auth_user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_plan_feedback' and policyname='repair relational ownership boundary') then
    create policy "repair relational ownership boundary" on public.workout_plan_feedback
      as restrictive for all to authenticated
      using (workout_plan_feedback.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=workout_plan_feedback.client_id and c.auth_user_id=workout_plan_feedback.user_id))
      with check (workout_plan_feedback.user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.client_id=workout_plan_feedback.client_id and c.auth_user_id=workout_plan_feedback.user_id));
  end if;
end
$repair_policy$;

do $repair_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_exercise_sets' and policyname='repair parent workout ownership boundary') then
    create policy "repair parent workout ownership boundary" on public.workout_exercise_sets
      as restrictive for all to authenticated
      using (exists (select 1 from public.workout_exercise_sessions s where s.id=workout_exercise_sets.exercise_session_id and s.auth_user_id=(select auth.uid()) and s.workout_log_id=workout_exercise_sets.workout_log_id and s.exercise_id=workout_exercise_sets.exercise_id))
      with check (exists (select 1 from public.workout_exercise_sessions s where s.id=workout_exercise_sets.exercise_session_id and s.auth_user_id=(select auth.uid()) and s.workout_log_id=workout_exercise_sets.workout_log_id and s.exercise_id=workout_exercise_sets.exercise_id));
  end if;
end
$repair_policy$;

-- Source profile history INSERT policy is required by app/api/account/profile/route.ts.
grant select, insert on public.client_profile_change_history to authenticated;
revoke all on sequence public.api_request_events_id_seq from public,anon,authenticated;
grant usage, select on sequence public.api_request_events_id_seq to service_role;

-- Credential, purchase, rate-limit and debug data remain server-only even with Supabase defaults.
revoke all on public.client_invitations,public.stripe_webhook_events,public.checkout_purchases,
  public.api_request_events,public.calendar_credentials,public.calendar_oauth_states,
  public.calendar_write_operations,public.client_anastasis_supplement_recommendation_debug
  from public,anon,authenticated;
grant all on public.client_invitations,public.stripe_webhook_events,public.checkout_purchases,
  public.api_request_events,public.calendar_credentials,public.calendar_oauth_states,
  public.calendar_write_operations,public.client_anastasis_supplement_recommendation_debug to service_role;
notify pgrst,'reload schema';
commit;
