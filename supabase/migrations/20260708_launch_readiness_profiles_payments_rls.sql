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

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now(),
  client_id text,
  payload jsonb not null default '{}'
);

create table if not exists public.api_request_events (
  id bigint generated always as identity primary key,
  scope text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);

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

create policy "clients read own onboarding snapshot" on public.client_onboarding_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own onboarding snapshot" on public.client_onboarding_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clients read own current profile" on public.client_current_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own current profile" on public.client_current_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clients update own current profile" on public.client_current_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "clients read own profile history" on public.client_profile_change_history for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own profile history" on public.client_profile_change_history for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clients manage own schedule" on public.client_schedule_blocks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

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

create policy "clients read own meal entries" on public.meal_entries for select to authenticated using (exists (select 1 from public.nutrition_logs nl where nl.id = nutrition_log_id and nl.auth_user_id = (select auth.uid())));
create policy "clients insert own meal entries" on public.meal_entries for insert to authenticated with check (exists (select 1 from public.nutrition_logs nl where nl.id = nutrition_log_id and nl.auth_user_id = (select auth.uid())));
create policy "clients delete own meal entries" on public.meal_entries for delete to authenticated using (exists (select 1 from public.nutrition_logs nl where nl.id = nutrition_log_id and nl.auth_user_id = (select auth.uid())));
create policy "clients read own measurements" on public.measurement_logs for select to authenticated using ((select auth.uid()) = auth_user_id);
create policy "clients insert own measurements" on public.measurement_logs for insert to authenticated with check ((select auth.uid()) = auth_user_id);
create policy "clients update own measurements" on public.measurement_logs for update to authenticated using ((select auth.uid()) = auth_user_id) with check ((select auth.uid()) = auth_user_id);
create policy "clients read own billing" on public.client_billing for select to authenticated using (exists (select 1 from public.clients c where c.client_id = client_billing.client_id and c.auth_user_id = (select auth.uid())));
create policy "clients read own weights" on public.client_weights for select to authenticated using (exists (select 1 from public.clients c where c.client_id = client_weights.client_id and c.auth_user_id = (select auth.uid())));
create policy "clients insert own weights" on public.client_weights for insert to authenticated with check (exists (select 1 from public.clients c where c.client_id = client_weights.client_id and c.auth_user_id = (select auth.uid())));
create policy "clients read own assessment windows" on public.assessment_windows for select to authenticated using ((select auth.uid()) = auth_user_id);
create policy "clients update own assessment windows" on public.assessment_windows for update to authenticated using ((select auth.uid()) = auth_user_id) with check ((select auth.uid()) = auth_user_id);
create policy "clients read own food items" on public.food_log_items for select to authenticated using (exists (select 1 from public.clients c where c.id = food_log_items.client_id and c.auth_user_id = (select auth.uid())));
create policy "clients insert own food items" on public.food_log_items for insert to authenticated with check (exists (select 1 from public.clients c where c.id = food_log_items.client_id and c.auth_user_id = (select auth.uid())));

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

-- Preserve a baseline for clients who completed onboarding before this migration.
insert into public.client_onboarding_snapshots (user_id, client_id, snapshot, onboarding_version)
select c.auth_user_id, c.client_id,
  jsonb_build_object(
    'submitted', coalesce(c.onboarding_data, '{}'::jsonb),
    'client', jsonb_build_object(
      'birthdate', c.birthdate,
      'address_line_1', c.address_line_1,
      'address_line_2', c.address_line_2,
      'city', c.city,
      'state', c.state,
      'postal_code', c.postal_code,
      'reproductive_status', c.reproductive_status,
      'last_period_start', c.last_period_start,
      'average_cycle_length', c.average_cycle_length
    )
  ),
  'v1'
from public.clients c
where c.auth_user_id is not null and c.onboarding_completed is true
on conflict (client_id, onboarding_version) do nothing;

insert into public.client_current_profiles (user_id, client_id, current_weight, primary_goal, workout_days_available, workout_minutes_available)
select c.auth_user_id, c.client_id,
  case when (a.data->>'weight') ~ '^\d+(\.\d+)?$' then (a.data->>'weight')::numeric else null end,
  coalesce(nullif(a.data->>'goal',''), nullif(a.data->>'primary_goal','')),
  c.workout_days_available,
  c.current_workout_minutes_per_session
from public.clients c
left join lateral (
  select data from public.assessments
  where assessments.client_id = c.client_id
  order by submitted_at desc nulls last
  limit 1
) a on true
where c.auth_user_id is not null
on conflict (client_id) do nothing;
