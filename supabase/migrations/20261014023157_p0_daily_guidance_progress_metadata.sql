-- P0 daily guidance and progress dependencies. REVIEW ONLY until explicit production approval.
-- No customer backfill, legacy column drops, or historical record updates.
-- Reference seeds insert missing catalog/configuration rows only.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
alter table public.cycle_logs add column if not exists answered_fields text[];
alter table public.cycle_logs add column if not exists ovulation_day boolean;
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
where not exists (
  select 1 from public.nutrient_interactions existing
  where existing.nutrient_id = n1.id
    and existing.related_nutrient_id is not distinct from n2.id
    and existing.interaction_type = item.interaction_type
    and existing.source_id is not distinct from s.id
)
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

revoke truncate,references,trigger,maintain on public.body_assessment_composition_results,public.body_assessment_measurements,public.body_assessment_regional_results,public.body_assessment_sessions,public.client_anastasis_supplement_recommendation_debug,public.client_anastasis_supplement_recommendations,public.client_nutrient_clinical_records,public.client_nutrient_intake_exposures,public.client_nutrient_recommendations,public.client_supplement_intake_logs,public.client_supplement_product_nutrients,public.client_supplement_products,public.clinical_follow_up_events,public.clinical_observation_records,public.clinician_sharing_preferences,public.cycle_burden_scores,public.cycle_burden_trends,public.cycle_daily_symptoms,public.health_provenance_records,public.ingredient_nutrients,public.menstrual_flow_logs,public.menstrual_product_logs,public.nutrient_function_map,public.nutrient_interactions,public.nutrient_reference_sources,public.nutrient_reference_values,public.nutrient_symptom_relationships,public.nutrients,public.pattern_recommendation_events,public.pattern_response_events,public.physiology_pattern_evidence,public.physiology_pattern_flags,public.supplement_ingredients,public.supplement_recommendation_engine_config,public.supplement_supported_functions,public.supplements from PUBLIC,anon,authenticated;
notify pgrst,'reload schema';
commit;
