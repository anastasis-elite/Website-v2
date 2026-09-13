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

create index if not exists body_assessment_composition_results_session_idx
  on public.body_assessment_composition_results (session_id);
create index if not exists body_assessment_composition_results_client_date_idx
  on public.body_assessment_composition_results (client_id, created_at desc);

alter table public.body_assessment_composition_results enable row level security;

create policy "clients read own body assessment composition results"
  on public.body_assessment_composition_results for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "clients insert own body assessment composition results"
  on public.body_assessment_composition_results for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "clients update own body assessment composition results"
  on public.body_assessment_composition_results for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.body_assessment_composition_results to authenticated;
