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
