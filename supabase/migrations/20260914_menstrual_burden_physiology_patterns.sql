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

create policy "clients read own menstrual flow logs" on public.menstrual_flow_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own menstrual flow logs" on public.menstrual_flow_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clients update own menstrual flow logs" on public.menstrual_flow_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "clients read own menstrual product logs" on public.menstrual_product_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own menstrual product logs" on public.menstrual_product_logs for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "clients read own cycle daily symptoms" on public.cycle_daily_symptoms for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own cycle daily symptoms" on public.cycle_daily_symptoms for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clients update own cycle daily symptoms" on public.cycle_daily_symptoms for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "clients read own cycle burden scores" on public.cycle_burden_scores for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own cycle burden scores" on public.cycle_burden_scores for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clients update own cycle burden scores" on public.cycle_burden_scores for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "clients read own cycle burden trends" on public.cycle_burden_trends for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own cycle burden trends" on public.cycle_burden_trends for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "clients read own physiology pattern flags" on public.physiology_pattern_flags for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own physiology pattern flags" on public.physiology_pattern_flags for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "clients read own physiology pattern evidence" on public.physiology_pattern_evidence for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own physiology pattern evidence" on public.physiology_pattern_evidence for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "clients read own pattern recommendation events" on public.pattern_recommendation_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own pattern recommendation events" on public.pattern_recommendation_events for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "clients read own pattern response events" on public.pattern_response_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own pattern response events" on public.pattern_response_events for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "clients read own clinical observation records" on public.clinical_observation_records for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own clinical observation records" on public.clinical_observation_records for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "clients read own clinical follow up events" on public.clinical_follow_up_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own clinical follow up events" on public.clinical_follow_up_events for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "clients read own clinician sharing preferences" on public.clinician_sharing_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own clinician sharing preferences" on public.clinician_sharing_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clients update own clinician sharing preferences" on public.clinician_sharing_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

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
