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

create policy "clients read own body assessment sessions"
  on public.body_assessment_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "clients insert own body assessment sessions"
  on public.body_assessment_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "clients update own body assessment sessions"
  on public.body_assessment_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "clients read own body assessment measurements"
  on public.body_assessment_measurements for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "clients insert own body assessment measurements"
  on public.body_assessment_measurements for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "clients read own body assessment regional results"
  on public.body_assessment_regional_results for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "clients insert own body assessment regional results"
  on public.body_assessment_regional_results for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "clients update own body assessment regional results"
  on public.body_assessment_regional_results for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.body_assessment_sessions to authenticated;
grant select, insert on public.body_assessment_measurements to authenticated;
grant select, insert, update on public.body_assessment_regional_results to authenticated;
