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

create index if not exists client_anastasis_supp_recs_client_status_idx
  on public.client_anastasis_supplement_recommendations (client_id, status, recommended_at desc);

create index if not exists client_anastasis_supp_recs_user_client_idx
  on public.client_anastasis_supplement_recommendations (user_id, client_id, supplement_id);

create index if not exists client_anastasis_supp_debug_client_eval_idx
  on public.client_anastasis_supplement_recommendation_debug (client_id, evaluated_at desc);

alter table public.supplement_recommendation_engine_config enable row level security;
alter table public.client_anastasis_supplement_recommendations enable row level security;
alter table public.client_anastasis_supplement_recommendation_debug enable row level security;

create policy "authenticated read supplement recommendation config"
  on public.supplement_recommendation_engine_config
  for select to authenticated
  using (true);

create policy "clients read own anastasis supplement recommendations"
  on public.client_anastasis_supplement_recommendations
  for select to authenticated
  using ((select auth.uid()) = user_id);

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

create policy "clients update own anastasis supplement recommendations"
  on public.client_anastasis_supplement_recommendations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
on conflict (config_key) do update set
  config_value = excluded.config_value,
  description = excluded.description,
  updated_at = now();

update public.supplements
set
  recommendation_category = 'sleep_support',
  recommendation_copy = coalesce(
    recommendation_copy,
    'Your recent food logs show that you have not consistently been getting foods that provide several nutrients involved in sleep support. Your sleep quality has also been lower during this period. Anastasis Sleep Support contains nutrients that can help supplement what you are getting through food.'
  ),
  disclaimer_copy = coalesce(
    disclaimer_copy,
    'This recommendation is based on your logged nutrition and wellness patterns and does not identify or diagnose a nutrient deficiency.'
  ),
  contraindication_metadata = coalesce(nullif(contraindication_metadata, '{}'::jsonb), '{
    "suppressWhen": [
      "pregnancy_or_breastfeeding",
      "medication_interaction_concern",
      "diagnosed_condition_concern"
    ],
    "ingredientAllergens": [],
    "upperIntakeConcernNutrients": ["magnesium"]
  }'::jsonb),
  minimum_matching_requirements = coalesce(nullif(minimum_matching_requirements, '{}'::jsonb), '{
    "minRecurringNutrients": 1,
    "minFunctionalCategories": 1
  }'::jsonb)
where supplement_key = 'anastasis_sleep_support';

notify pgrst, 'reload schema';
