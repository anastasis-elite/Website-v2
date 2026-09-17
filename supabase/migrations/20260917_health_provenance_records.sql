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

create index if not exists health_provenance_records_client_date_idx
  on public.health_provenance_records (client_id, datum_date desc, datum_kind);

alter table public.health_provenance_records enable row level security;

create policy "clients read own health provenance records"
  on public.health_provenance_records for select to authenticated
  using ((select auth.uid()) = user_id);

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

grant select, insert on public.health_provenance_records to authenticated;
