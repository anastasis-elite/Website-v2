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
