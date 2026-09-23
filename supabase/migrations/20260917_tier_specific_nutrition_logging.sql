-- Tier-specific nutrition logging metadata.
-- Additive only: preserves existing nutrition_logs, meal_entries, macro_entries,
-- foods, and all historical nutrition data.

alter table public.foods
  add column if not exists barcode text,
  add column if not exists barcode_format text,
  add column if not exists brand text,
  add column if not exists source text not null default 'catalog',
  add column if not exists client_id text references public.clients(client_id) on delete cascade,
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists foods_barcode_unique_idx
  on public.foods (barcode)
  where barcode is not null;

create index if not exists foods_client_created_idx
  on public.foods (client_id, created_at desc)
  where client_id is not null;

alter table public.meal_entries
  add column if not exists entry_source text not null default 'manual',
  add column if not exists meal_period text,
  add column if not exists entry_state text not null default 'confirmed',
  add column if not exists verified boolean not null default true,
  add column if not exists estimated boolean not null default false,
  add column if not exists barcode text,
  add column if not exists confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  add column if not exists estimate_metadata jsonb not null default '{}'::jsonb,
  add column if not exists recurring_food_id uuid,
  add column if not exists confirmed_at timestamptz,
  add column if not exists skipped_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'meal_entries_entry_source_check'
      and conrelid = 'public.meal_entries'::regclass
  ) then
    alter table public.meal_entries
      add constraint meal_entries_entry_source_check
      check (entry_source in ('manual','barcode','recurring','photo_estimate'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'meal_entries_entry_state_check'
      and conrelid = 'public.meal_entries'::regclass
  ) then
    alter table public.meal_entries
      add constraint meal_entries_entry_state_check
      check (entry_state in ('scheduled','pre_logged','confirmed','skipped'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'meal_entries_meal_period_check'
      and conrelid = 'public.meal_entries'::regclass
  ) then
    alter table public.meal_entries
      add constraint meal_entries_meal_period_check
      check (meal_period is null or meal_period in ('Wake Up','Breakfast','Brunch','Lunch','Snack','Dinner','Pre-Bed','Other'));
  end if;
end $$;

update public.meal_entries
set meal_period = case
  when meal_period is not null then meal_period
  when lower(coalesce(meal_name, '')) like '%breakfast%' then 'Breakfast'
  when lower(coalesce(meal_name, '')) like '%lunch%' then 'Lunch'
  when lower(coalesce(meal_name, '')) like '%snack%' then 'Snack'
  when lower(coalesce(meal_name, '')) like '%dinner%' then 'Dinner'
  when lower(coalesce(meal_name, '')) like '%supper%' then 'Dinner'
  when lower(coalesce(meal_name, '')) like '%pre bed%' then 'Pre-Bed'
  else 'Other'
end
where meal_period is null;

create index if not exists meal_entries_source_state_idx
  on public.meal_entries (entry_source, entry_state, created_at desc);

create index if not exists meal_entries_recurring_food_idx
  on public.meal_entries (recurring_food_id)
  where recurring_food_id is not null;

alter table public.macro_entries
  add column if not exists entry_source text not null default 'manual',
  add column if not exists meal_period text,
  add column if not exists verified boolean not null default true,
  add column if not exists estimated boolean not null default false;

create table if not exists public.recurring_food_patterns (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(client_id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  serving_option_id uuid references public.food_serving_options(id) on delete set null,
  serving_amount numeric not null default 1 check (serving_amount > 0),
  serving_unit text,
  meal_period text not null check (meal_period in ('Wake Up','Breakfast','Brunch','Lunch','Snack','Dinner','Pre-Bed','Other')),
  day_block text not null default 'other' check (day_block in ('morning','midday','evening','other')),
  days_of_week smallint[] not null default '{}',
  status text not null default 'suggested' check (status in ('suggested','active','dismissed','paused')),
  detection_metadata jsonb not null default '{}'::jsonb,
  last_prompted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_food_patterns_client_status_idx
  on public.recurring_food_patterns (client_id, status, meal_period);

create index if not exists recurring_food_patterns_food_idx
  on public.recurring_food_patterns (food_id, serving_option_id);

alter table public.recurring_food_patterns enable row level security;

create policy "clients read own recurring food patterns"
  on public.recurring_food_patterns for select to authenticated
  using ((select auth.uid()) = auth_user_id);

create policy "clients insert own recurring food patterns"
  on public.recurring_food_patterns for insert to authenticated
  with check ((select auth.uid()) = auth_user_id);

create policy "clients update own recurring food patterns"
  on public.recurring_food_patterns for update to authenticated
  using ((select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) = auth_user_id);

grant select, insert, update on public.recurring_food_patterns to authenticated;
grant select, insert on public.foods to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'foods'
      and policyname = 'clients insert own custom foods'
  ) then
    create policy "clients insert own custom foods"
      on public.foods for insert to authenticated
      with check (
        (select auth.uid()) = auth_user_id
        and source in ('custom','barcode_custom','photo_estimate')
        and exists (
          select 1 from public.clients c
          where c.client_id = foods.client_id
            and c.auth_user_id = (select auth.uid())
        )
      );
  end if;
end $$;
