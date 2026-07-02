create extension if not exists pgcrypto;

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  health_disclaimer_version text not null,
  ai_disclaimer_version text not null,
  research_consent_version text,
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  acceptance_source text not null,
  created_at timestamptz not null default now()
);

create index if not exists legal_acceptances_user_time_idx
  on public.legal_acceptances (user_id, accepted_at desc);

create table if not exists public.feature_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in (
    'progress_photos', 'posture_assessment_photos', 'symptom_tracking',
    'cycle_tracking', 'nutrition_tracking', 'wearable_integrations',
    'ai_recommendations', 'anonymized_research_use', 'marketing_emails'
  )),
  granted boolean not null,
  consent_version text not null,
  recorded_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  acceptance_source text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists feature_consent_user_type_time_idx
  on public.feature_consent_events (user_id, consent_type, recorded_at desc);

create table if not exists public.recommendation_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_type text not null,
  input_snapshot jsonb,
  input_reference text,
  engine_version text not null,
  recommendation_output jsonb not null,
  confidence_level text,
  safety_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_audit_user_time_idx
  on public.recommendation_audit_logs (user_id, created_at desc);

create or replace function public.prevent_compliance_record_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Compliance records are immutable';
end;
$$;

drop trigger if exists legal_acceptances_immutable on public.legal_acceptances;
create trigger legal_acceptances_immutable before update on public.legal_acceptances
for each row execute function public.prevent_compliance_record_mutation();

drop trigger if exists feature_consent_events_immutable on public.feature_consent_events;
create trigger feature_consent_events_immutable before update on public.feature_consent_events
for each row execute function public.prevent_compliance_record_mutation();

alter table public.legal_acceptances enable row level security;
alter table public.feature_consent_events enable row level security;
alter table public.recommendation_audit_logs enable row level security;

create policy "users read own legal acceptances" on public.legal_acceptances for select using (auth.uid() = user_id);
create policy "users insert own legal acceptances" on public.legal_acceptances for insert with check (auth.uid() = user_id);
create policy "users read own feature consents" on public.feature_consent_events for select using (auth.uid() = user_id);
create policy "users insert own feature consents" on public.feature_consent_events for insert with check (auth.uid() = user_id);
create policy "users read own recommendation logs" on public.recommendation_audit_logs for select using (auth.uid() = user_id);
create policy "users insert own recommendation logs" on public.recommendation_audit_logs for insert with check (auth.uid() = user_id);
