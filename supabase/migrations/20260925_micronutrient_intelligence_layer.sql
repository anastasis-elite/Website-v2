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

create table if not exists public.supplement_supported_functions (
  id uuid primary key default gen_random_uuid(),
  supplement_id uuid not null references public.supplements(id) on delete cascade,
  function_key text not null,
  function_label text not null,
  support_summary text,
  created_at timestamptz not null default now(),
  unique (supplement_id, function_key)
);

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

create policy "authenticated read nutrient reference" on public.nutrients for select to authenticated using (true);
create policy "authenticated read nutrient sources" on public.nutrient_reference_sources for select to authenticated using (true);
create policy "authenticated read nutrient reference values" on public.nutrient_reference_values for select to authenticated using (true);
create policy "authenticated read nutrient symptom relationships" on public.nutrient_symptom_relationships for select to authenticated using (true);
create policy "authenticated read nutrient interactions" on public.nutrient_interactions for select to authenticated using (true);
create policy "authenticated read nutrient function map" on public.nutrient_function_map for select to authenticated using (true);
create policy "authenticated read supplements" on public.supplements for select to authenticated using (true);
create policy "authenticated read supplement ingredients" on public.supplement_ingredients for select to authenticated using (true);
create policy "authenticated read ingredient nutrients" on public.ingredient_nutrients for select to authenticated using (true);
create policy "authenticated read supplement supported functions" on public.supplement_supported_functions for select to authenticated using (true);

create policy "clients read own supplement products" on public.client_supplement_products for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own supplement products" on public.client_supplement_products for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clients update own supplement products" on public.client_supplement_products for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "clients read own supplement product nutrients" on public.client_supplement_product_nutrients for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own supplement product nutrients" on public.client_supplement_product_nutrients for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clients update own supplement product nutrients" on public.client_supplement_product_nutrients for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "clients read own supplement intake logs" on public.client_supplement_intake_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own supplement intake logs" on public.client_supplement_intake_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clients update own supplement intake logs" on public.client_supplement_intake_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "clients read own nutrient clinical records" on public.client_nutrient_clinical_records for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own nutrient clinical records" on public.client_nutrient_clinical_records for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "clients read own nutrient exposures" on public.client_nutrient_intake_exposures for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own nutrient exposures" on public.client_nutrient_intake_exposures for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clients update own nutrient exposures" on public.client_nutrient_intake_exposures for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "clients read own nutrient recommendations" on public.client_nutrient_recommendations for select to authenticated using ((select auth.uid()) = user_id);
create policy "clients insert own nutrient recommendations" on public.client_nutrient_recommendations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clients update own nutrient recommendations" on public.client_nutrient_recommendations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

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
on conflict (source_key) do update set
  title = excluded.title,
  organization = excluded.organization,
  url = excluded.url,
  source_type = excluded.source_type,
  notes = excluded.notes;

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
on conflict (nutrient_key) do update set
  canonical_name = excluded.canonical_name,
  aliases = excluded.aliases,
  category = excluded.category,
  default_unit = excluded.default_unit,
  directly_provides_calories = false,
  review_status = excluded.review_status;

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
on conflict (nutrient_id, function_key) do update set
  function_label = excluded.function_label,
  evidence_strength = excluded.evidence_strength,
  source_id = excluded.source_id,
  notes = excluded.notes;

with supplement_rows as (
  insert into public.supplements (supplement_key, product_name, status, positioning_summary, serving_size, evidence_notes)
  values (
    'anastasis_sleep_support',
    'Anastasis Sleep Support',
    'active',
    'Supports sleep routines when nutrient intake patterns and sleep experience align.',
    'See product label',
    'Eligibility must require longitudinal nutrient patterns plus matching sleep experience.'
  )
  on conflict (supplement_key) do update set
    product_name = excluded.product_name,
    status = excluded.status,
    positioning_summary = excluded.positioning_summary,
    serving_size = excluded.serving_size,
    evidence_notes = excluded.evidence_notes
  returning id
), magnesium as (
  select id from public.nutrients where nutrient_key = 'magnesium'
), ingredient_rows as (
  insert into public.supplement_ingredients (supplement_id, ingredient_key, ingredient_name, amount_per_serving, unit, ingredient_form, display_order)
  select supplement_rows.id, 'magnesium', 'Magnesium', null, 'mg', null, 10
  from supplement_rows
  on conflict (supplement_id, ingredient_key) do update set
    ingredient_name = excluded.ingredient_name,
    amount_per_serving = excluded.amount_per_serving,
    unit = excluded.unit,
    ingredient_form = excluded.ingredient_form,
    display_order = excluded.display_order
  returning id
)
insert into public.ingredient_nutrients (supplement_ingredient_id, nutrient_id, amount_per_serving, unit, contribution_notes)
select ingredient_rows.id, magnesium.id, null, 'mg', 'Product nutrient contribution is label-driven; recommendation logic matches function and pattern, not dosage advice.'
from ingredient_rows, magnesium
on conflict (supplement_ingredient_id, nutrient_id) do update set
  amount_per_serving = excluded.amount_per_serving,
  unit = excluded.unit,
  contribution_notes = excluded.contribution_notes;

with supplement_rows as (
  select id from public.supplements where supplement_key = 'anastasis_sleep_support'
)
insert into public.supplement_supported_functions (supplement_id, function_key, function_label, support_summary)
select id, 'sleep', 'Sleep quality', 'Matched only when sleep experience and longitudinal nutrient pattern both support eligibility.'
from supplement_rows
on conflict (supplement_id, function_key) do update set
  function_label = excluded.function_label,
  support_summary = excluded.support_summary;

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
on conflict do nothing;

notify pgrst, 'reload schema';
